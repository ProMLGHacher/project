package application

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"slices"

	"github.com/araik/codex-webrtc/project/backend/internal/domain"
)

var ErrRoomNotFound = errors.New("room not found")

type RoomService struct {
	rooms      RoomRepository
	sessions   SessionRepository
	invites    InviteService
	clock      Clock
	ids        IDGenerator
	baseURL    *url.URL
	iceServers []ICEConfig
}

type CreateRoomResult struct {
	RoomID string `json:"roomId"`
}

func NewRoomService(
	rooms RoomRepository,
	sessions SessionRepository,
	invites InviteService,
	clock Clock,
	ids IDGenerator,
	baseURL *url.URL,
	iceServers []ICEConfig,
) *RoomService {
	return &RoomService{
		rooms:      rooms,
		sessions:   sessions,
		invites:    invites,
		clock:      clock,
		ids:        ids,
		baseURL:    baseURL,
		iceServers: iceServers,
	}
}

func (s *RoomService) CreateRoom(ctx context.Context) (CreateRoomResult, error) {
	return s.CreateRoomForBaseURL(ctx, nil)
}

func (s *RoomService) CreateRoomForBaseURL(ctx context.Context, baseURL *url.URL) (CreateRoomResult, error) {
	_ = baseURL
	roomID := s.ids.NewID()
	now := s.clock.Now()
	host := domain.NewParticipant(s.ids.NewID(), "Host", domain.RoleHost, now, domain.JoinPreferences{})
	room := domain.NewRoom(roomID, now, host)

	if err := s.rooms.Save(ctx, room); err != nil {
		return CreateRoomResult{}, fmt.Errorf("save room: %w", err)
	}

	return CreateRoomResult{
		RoomID: roomID,
	}, nil
}

func (s *RoomService) JoinRoom(ctx context.Context, token string, prefs PrejoinPreferences) (JoinResult, error) {
	return s.JoinRoomForBaseURL(ctx, token, prefs, nil)
}

func (s *RoomService) JoinRoomForBaseURL(ctx context.Context, token string, prefs PrejoinPreferences, baseURL *url.URL) (JoinResult, error) {
	claims, err := s.invites.ParseToken(token)
	if err != nil {
		return JoinResult{}, err
	}

	return s.joinRoom(ctx, claims.RoomID, claims.Role, prefs, baseURL)
}

func (s *RoomService) GetRoomMetadata(ctx context.Context, roomID string) (RoomMetadata, error) {
	room, err := s.rooms.FindByID(ctx, roomID)
	if err != nil {
		return RoomMetadata{}, err
	}

	roles := make([]domain.ParticipantRole, 0, len(room.Participants))
	for _, participant := range room.Participants {
		roles = append(roles, participant.Role)
	}
	slices.Sort(roles)

	return RoomMetadata{
		RoomID:            room.ID,
		HostParticipantID: room.HostParticipantID,
		ParticipantCount:  len(room.Participants),
		Roles:             roles,
	}, nil
}

func (s *RoomService) JoinRoomByID(ctx context.Context, roomID string, prefs PrejoinPreferences, baseURL *url.URL) (JoinResult, error) {
	role := domain.RoleParticipant
	if prefs.Role == string(domain.RoleHost) {
		role = domain.RoleHost
	}

	return s.joinRoom(ctx, roomID, role, prefs, baseURL)
}

func (s *RoomService) joinRoom(ctx context.Context, roomID string, role domain.ParticipantRole, prefs PrejoinPreferences, baseURL *url.URL) (JoinResult, error) {
	room, err := s.rooms.FindByID(ctx, roomID)
	if err != nil {
		return JoinResult{}, err
	}
	if room == nil {
		return JoinResult{}, ErrRoomNotFound
	}

	now := s.clock.Now()
	var participant *domain.Participant

	if role == domain.RoleHost && room.HostParticipantID != "" {
		existingHost, exists := room.Participants[room.HostParticipantID]
		if !exists {
			return JoinResult{}, ErrRoomNotFound
		}
		domain.ApplyJoinPreferences(existingHost, prefs.DisplayName, now, domain.JoinPreferences{
			MicEnabled:    prefs.MicEnabled,
			CameraEnabled: prefs.CameraEnabled,
		})
		existingHost.Role = domain.RoleHost
		participant = existingHost
	} else {
		participantID := s.ids.NewID()
		participant = domain.NewParticipant(participantID, prefs.DisplayName, role, now, domain.JoinPreferences{
			MicEnabled:    prefs.MicEnabled,
			CameraEnabled: prefs.CameraEnabled,
		})
		if role == domain.RoleHost {
			participant.Role = domain.RoleHost
		}

		if err := room.AddParticipant(participant); err != nil {
			return JoinResult{}, err
		}
	}

	if err := s.rooms.Save(ctx, room); err != nil {
		return JoinResult{}, fmt.Errorf("persist room after join: %w", err)
	}

	session := &domain.PeerSession{
		ID:                  s.ids.NewID(),
		RoomID:              room.ID,
		ParticipantID:       participant.ID,
		PublisherState:      domain.NegotiationStable,
		SubscriberState:     domain.NegotiationStable,
		PublisherIceHealth:  domain.IceHealthNew,
		SubscriberIceHealth: domain.IceHealthNew,
	}

	if err := s.sessions.Save(ctx, session); err != nil {
		return JoinResult{}, fmt.Errorf("save session: %w", err)
	}

	return JoinResult{
		SessionID:     session.ID,
		ParticipantID: participant.ID,
		RoomID:        room.ID,
		Role:          participant.Role,
		WSURL:         s.buildWSURL(baseURL, session.ID),
		ICEServers:    s.iceServers,
		Snapshot:      room.Snapshot(),
	}, nil
}

func (s *RoomService) GetInviteMetadata(token string) (InviteClaims, error) {
	return s.invites.ParseToken(token)
}

func (s *RoomService) buildWSURL(baseURL *url.URL, sessionID string) string {
	u := *s.resolveBaseURL(baseURL)
	if u.Scheme == "https" {
		u.Scheme = "wss"
	} else {
		u.Scheme = "ws"
	}
	u.Path = "/ws"
	query := u.Query()
	query.Set("sessionId", sessionID)
	u.RawQuery = query.Encode()
	return u.String()
}

func (s *RoomService) resolveBaseURL(baseURL *url.URL) *url.URL {
	if baseURL != nil {
		return baseURL
	}

	return s.baseURL
}
