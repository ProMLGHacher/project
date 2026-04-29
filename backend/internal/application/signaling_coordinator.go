package application

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"

	"github.com/araik/codex-webrtc/project/backend/internal/domain"
	"github.com/araik/codex-webrtc/project/backend/internal/protocol"
	"github.com/pion/webrtc/v4"
)

type SignalingEmitter interface {
	Emit(sessionID string, envelope protocol.Envelope) error
}

type SessionLookup interface {
	SessionIDByParticipant(ctx context.Context, participantID string) (string, bool)
	ParticipantsInRoom(ctx context.Context, roomID string) []string
}

type MediaBridge interface {
	EnsurePublisher(roomID, participantID string) error
	EnsureSubscriber(roomID, participantID string) error
	AttachExistingSources(participantID string) error
	RemoveParticipant(participantID string) error
	UpdateSlotPreference(participantID string, kind domain.SlotKind, enabled bool) error
	HandlePublisherOffer(participantID string, offer webrtc.SessionDescription, slotBindings map[string]domain.SlotKind) (webrtc.SessionDescription, error)
	HandlePublisherCandidate(participantID string, candidate webrtc.ICECandidateInit) error
	CreateSubscriberOffer(participantID string, iceRestart bool) (webrtc.SessionDescription, error)
	HandleSubscriberAnswer(participantID string, answer webrtc.SessionDescription) (*webrtc.SessionDescription, error)
	HandleSubscriberCandidate(participantID string, candidate webrtc.ICECandidateInit) error
}

type SignalingCoordinator struct {
	rooms    RoomRepository
	sessions SessionRepository
	emitter  SignalingEmitter
	lookup   SessionLookup
	media    MediaBridge
}

func NewSignalingCoordinator(
	rooms RoomRepository,
	sessions SessionRepository,
	emitter SignalingEmitter,
	lookup SessionLookup,
	media MediaBridge,
) *SignalingCoordinator {
	return &SignalingCoordinator{
		rooms:    rooms,
		sessions: sessions,
		emitter:  emitter,
		lookup:   lookup,
		media:    media,
	}
}

func (c *SignalingCoordinator) OnConnected(ctx context.Context, sessionID string) error {
	session, err := c.sessions.FindByID(ctx, sessionID)
	if err != nil {
		return err
	}

	log.Printf("[signaling] on-connected session_id=%s room_id=%s participant_id=%s", sessionID, session.RoomID, session.ParticipantID)

	room, err := c.rooms.FindByID(ctx, session.RoomID)
	if err != nil {
		return err
	}

	if err := c.media.EnsurePublisher(room.ID, session.ParticipantID); err != nil {
		return err
	}
	if err := c.media.EnsureSubscriber(room.ID, session.ParticipantID); err != nil {
		return err
	}
	if err := c.media.AttachExistingSources(session.ParticipantID); err != nil {
		return err
	}

	return c.broadcastRoomSnapshot(ctx, room.ID)
}

func (c *SignalingCoordinator) OnDisconnected(ctx context.Context, sessionID string) error {
	session, err := c.sessions.FindByID(ctx, sessionID)
	if err != nil {
		return nil
	}

	log.Printf("[signaling] on-disconnected session_id=%s room_id=%s participant_id=%s", sessionID, session.RoomID, session.ParticipantID)

	room, err := c.rooms.FindByID(ctx, session.RoomID)
	if err != nil {
		_ = c.sessions.Delete(ctx, sessionID)
		return nil
	}

	if err := room.RemoveParticipant(session.ParticipantID); err != nil && !errors.Is(err, domain.ErrParticipantNotFound) {
		return err
	}
	if err := c.rooms.Save(ctx, room); err != nil {
		return err
	}
	if err := c.sessions.Delete(ctx, sessionID); err != nil {
		return err
	}
	if err := c.media.RemoveParticipant(session.ParticipantID); err != nil {
		return err
	}

	return c.broadcastRoomSnapshot(ctx, room.ID)
}

func (c *SignalingCoordinator) HandleEnvelope(ctx context.Context, sessionID string, envelope protocol.Envelope) error {
	session, err := c.sessions.FindByID(ctx, sessionID)
	if err != nil {
		return err
	}

	log.Printf("[signaling] handle-envelope session_id=%s room_id=%s participant_id=%s type=%s", sessionID, session.RoomID, session.ParticipantID, envelope.Type)

	switch envelope.Type {
	case protocol.TypeParticipantLeft:
		return c.OnDisconnected(ctx, sessionID)
	case protocol.TypePublisherOffer:
		var payload protocol.SessionDescriptionPayload
		if err := json.Unmarshal(envelope.Payload, &payload); err != nil {
			return err
		}
		answer, err := c.media.HandlePublisherOffer(session.ParticipantID, payload.Description, payload.SlotBindings)
		if err != nil {
			return err
		}
		return c.emitter.Emit(sessionID, protocol.MustEnvelope(protocol.TypePublisherAnswer, protocol.SessionDescriptionPayload{
			Peer:        "publisher",
			Description: answer,
		}))
	case protocol.TypeSubscriberAnswer:
		var payload protocol.SessionDescriptionPayload
		if err := json.Unmarshal(envelope.Payload, &payload); err != nil {
			return err
		}
		next, err := c.media.HandleSubscriberAnswer(session.ParticipantID, payload.Description)
		if err != nil {
			return err
		}
		if next != nil {
			return c.emitter.Emit(sessionID, protocol.MustEnvelope(protocol.TypeSubscriberOffer, protocol.SessionDescriptionPayload{
				Peer:        "subscriber",
				Description: *next,
			}))
		}
		return nil
	case protocol.TypeTrickleCandidate:
		var payload protocol.CandidatePayload
		if err := json.Unmarshal(envelope.Payload, &payload); err != nil {
			return err
		}
		switch payload.Peer {
		case "publisher":
			return c.media.HandlePublisherCandidate(session.ParticipantID, payload.Candidate)
		case "subscriber":
			return c.media.HandleSubscriberCandidate(session.ParticipantID, payload.Candidate)
		default:
			return fmt.Errorf("unsupported candidate target %s", payload.Peer)
		}
	case protocol.TypeMediaSlotUpdated:
		var payload protocol.SlotUpdatedPayload
		if err := json.Unmarshal(envelope.Payload, &payload); err != nil {
			return err
		}
		room, err := c.rooms.FindByID(ctx, session.RoomID)
		if err != nil {
			return err
		}
		if _, err := room.UpdateSlot(session.ParticipantID, payload.Kind, payload.Enabled, payload.Publishing, payload.TrackBound); err != nil {
			return err
		}
		if err := c.rooms.Save(ctx, room); err != nil {
			return err
		}
		if err := c.media.UpdateSlotPreference(session.ParticipantID, payload.Kind, payload.Enabled); err != nil {
			return err
		}
		return c.broadcastRoomSnapshot(ctx, room.ID)
	case protocol.TypeIceRestartRequested:
		var payload protocol.IceRestartPayload
		if err := json.Unmarshal(envelope.Payload, &payload); err != nil {
			return err
		}
		if payload.Peer != "subscriber" {
			return errors.New("publisher restart is initiated by the browser offerer")
		}

		offer, err := c.media.CreateSubscriberOffer(session.ParticipantID, true)
		if err != nil {
			return err
		}
		if offer.Type == 0 {
			return nil
		}
		return c.emitter.Emit(sessionID, protocol.MustEnvelope(protocol.TypeSubscriberOffer, protocol.SessionDescriptionPayload{
			Peer:        "subscriber",
			Description: offer,
		}))
	default:
		return nil
	}
}

func (c *SignalingCoordinator) broadcastRoomSnapshot(ctx context.Context, roomID string) error {
	room, err := c.rooms.FindByID(ctx, roomID)
	if err != nil {
		return err
	}

	log.Printf("[signaling] broadcast-room-snapshot room_id=%s participants=%d", roomID, len(room.Participants))

	envelope := protocol.MustEnvelope(protocol.TypeRoomSnapshot, protocol.RoomSnapshotPayload{
		Snapshot: room.Snapshot(),
	})

	for _, participantID := range c.lookup.ParticipantsInRoom(ctx, roomID) {
		sessionID, ok := c.lookup.SessionIDByParticipant(ctx, participantID)
		if !ok {
			continue
		}
		if err := c.emitter.Emit(sessionID, envelope); err != nil {
			return err
		}
	}

	return nil
}
