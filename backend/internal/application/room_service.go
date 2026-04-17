package application

import (
	"context"
	"errors"
	"fmt"
	"net/url"

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
	RoomID                 string `json:"roomId"`
	HostInviteToken        string `json:"hostInviteToken"`
	ParticipantInviteToken string `json:"participantInviteToken"`
	HostInviteURL          string `json:"hostInviteUrl"`
	ParticipantInviteURL   string `json:"participantInviteUrl"`
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
	roomID := s.ids.NewID()
	now := s.clock.Now()
	host := domain.NewParticipant(s.ids.NewID(), "Host", domain.RoleHost, now, domain.JoinPreferences{})
	room := domain.NewRoom(roomID, now, host)

	if err := s.rooms.Save(ctx, room); err != nil {
		return CreateRoomResult{}, fmt.Errorf("save room: %w", err)
	}

	hostToken, err := s.invites.CreateToken(roomID, domain.RoleHost)
	if err != nil {
		return CreateRoomResult{}, fmt.Errorf("create host token: %w", err)
	}

	participantToken, err := s.invites.CreateToken(roomID, domain.RoleParticipant)
	if err != nil {
		return CreateRoomResult{}, fmt.Errorf("create participant token: %w", err)
	}

	return CreateRoomResult{
		RoomID:                 roomID,
		HostInviteToken:        hostToken,
		ParticipantInviteToken: participantToken,
		HostInviteURL:          s.buildInviteURL(hostToken),
		ParticipantInviteURL:   s.buildInviteURL(participantToken),
	}, nil
}

func (s *RoomService) JoinRoom(ctx context.Context, token string, prefs PrejoinPreferences) (JoinResult, error) {
	claims, err := s.invites.ParseToken(token)
	if err != nil {
		return JoinResult{}, err
	}

	room, err := s.rooms.FindByID(ctx, claims.RoomID)
	if err != nil {
		return JoinResult{}, err
	}
	if room == nil {
		return JoinResult{}, ErrRoomNotFound
	}

	now := s.clock.Now()
	var participant *domain.Participant

	if claims.Role == domain.RoleHost && room.HostParticipantID != "" {
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
		participant = domain.NewParticipant(participantID, prefs.DisplayName, claims.Role, now, domain.JoinPreferences{
			MicEnabled:    prefs.MicEnabled,
			CameraEnabled: prefs.CameraEnabled,
		})
		if claims.Role == domain.RoleHost {
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
		WSURL:         s.buildWSURL(session.ID),
		ICEServers:    s.iceServers,
		Snapshot:      room.Snapshot(),
	}, nil
}

func (s *RoomService) GetInviteMetadata(token string) (InviteClaims, error) {
	return s.invites.ParseToken(token)
}

func (s *RoomService) buildInviteURL(token string) string {
	u := *s.baseURL
	u.Path = fmt.Sprintf("/invite/%s", token)
	return u.String()
}

func (s *RoomService) buildWSURL(sessionID string) string {
	u := *s.baseURL
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
