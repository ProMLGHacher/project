package application

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/araik/codex-webrtc/project/backend/internal/adapters/repository"
	"github.com/araik/codex-webrtc/project/backend/internal/domain"
	"github.com/araik/codex-webrtc/project/backend/internal/protocol"
	"github.com/pion/webrtc/v4"
)

type stubMediaBridge struct {
	updateCalls []slotPreferenceCall
}

type slotPreferenceCall struct {
	participantID string
	kind          domain.SlotKind
	enabled       bool
}

func (m *stubMediaBridge) EnsurePublisher(string, string) error { return nil }

func (m *stubMediaBridge) EnsureSubscriber(string, string) error { return nil }

func (m *stubMediaBridge) AttachExistingSources(string) error { return nil }

func (m *stubMediaBridge) UpdateSlotPreference(participantID string, kind domain.SlotKind, enabled bool) error {
	m.updateCalls = append(m.updateCalls, slotPreferenceCall{
		participantID: participantID,
		kind:          kind,
		enabled:       enabled,
	})
	return nil
}

func (m *stubMediaBridge) HandlePublisherOffer(string, webrtc.SessionDescription) (webrtc.SessionDescription, error) {
	return webrtc.SessionDescription{}, nil
}

func (m *stubMediaBridge) HandlePublisherCandidate(string, webrtc.ICECandidateInit) error { return nil }

func (m *stubMediaBridge) CreateSubscriberOffer(string, bool) (webrtc.SessionDescription, error) {
	return webrtc.SessionDescription{}, nil
}

func (m *stubMediaBridge) HandleSubscriberAnswer(string, webrtc.SessionDescription) (*webrtc.SessionDescription, error) {
	return nil, nil
}

func (m *stubMediaBridge) HandleSubscriberCandidate(string, webrtc.ICECandidateInit) error { return nil }

type stubEmitter struct {
	messages map[string][]protocol.Envelope
}

func newStubEmitter() *stubEmitter {
	return &stubEmitter{messages: map[string][]protocol.Envelope{}}
}

func (e *stubEmitter) Emit(sessionID string, envelope protocol.Envelope) error {
	e.messages[sessionID] = append(e.messages[sessionID], envelope)
	return nil
}

func TestOnConnectedBroadcastsRoomSnapshotToExistingParticipants(t *testing.T) {
	roomRepo := repository.NewInMemoryRoomRepository()
	sessionRepo := repository.NewInMemorySessionRepository()
	lookup := repository.NewSessionLookup(roomRepo, sessionRepo)
	emitter := newStubEmitter()
	media := &stubMediaBridge{}
	coordinator := NewSignalingCoordinator(roomRepo, sessionRepo, emitter, lookup, media)

	now := time.Date(2026, 4, 17, 12, 0, 0, 0, time.UTC)
	host := domain.NewParticipant("host-1", "Host", domain.RoleHost, now, domain.JoinPreferences{MicEnabled: true})
	room := domain.NewRoom("room-1", now, host)
	guest := domain.NewParticipant("guest-1", "Guest", domain.RoleParticipant, now, domain.JoinPreferences{MicEnabled: true})
	if err := room.AddParticipant(guest); err != nil {
		t.Fatalf("expected guest add to succeed, got %v", err)
	}
	if err := roomRepo.Save(context.Background(), room); err != nil {
		t.Fatalf("expected room save to succeed, got %v", err)
	}
	if err := sessionRepo.Save(context.Background(), &domain.PeerSession{ID: "session-host", RoomID: room.ID, ParticipantID: host.ID}); err != nil {
		t.Fatalf("expected host session save to succeed, got %v", err)
	}
	if err := sessionRepo.Save(context.Background(), &domain.PeerSession{ID: "session-guest", RoomID: room.ID, ParticipantID: guest.ID}); err != nil {
		t.Fatalf("expected guest session save to succeed, got %v", err)
	}

	if err := coordinator.OnConnected(context.Background(), "session-guest"); err != nil {
		t.Fatalf("expected OnConnected to succeed, got %v", err)
	}

	if len(emitter.messages["session-host"]) != 1 || emitter.messages["session-host"][0].Type != protocol.TypeRoomSnapshot {
		t.Fatalf("expected host session to receive a room snapshot broadcast")
	}
	if len(emitter.messages["session-guest"]) != 1 || emitter.messages["session-guest"][0].Type != protocol.TypeRoomSnapshot {
		t.Fatalf("expected guest session to receive its room snapshot broadcast")
	}
}

func TestHandleMediaSlotUpdatedPersistsRoomStateAndBroadcastsSnapshot(t *testing.T) {
	roomRepo := repository.NewInMemoryRoomRepository()
	sessionRepo := repository.NewInMemorySessionRepository()
	lookup := repository.NewSessionLookup(roomRepo, sessionRepo)
	emitter := newStubEmitter()
	media := &stubMediaBridge{}
	coordinator := NewSignalingCoordinator(roomRepo, sessionRepo, emitter, lookup, media)

	now := time.Date(2026, 4, 17, 12, 0, 0, 0, time.UTC)
	host := domain.NewParticipant("host-1", "Host", domain.RoleHost, now, domain.JoinPreferences{MicEnabled: true})
	room := domain.NewRoom("room-1", now, host)
	guest := domain.NewParticipant("guest-1", "Guest", domain.RoleParticipant, now, domain.JoinPreferences{MicEnabled: true})
	if err := room.AddParticipant(guest); err != nil {
		t.Fatalf("expected guest add to succeed, got %v", err)
	}
	if err := roomRepo.Save(context.Background(), room); err != nil {
		t.Fatalf("expected room save to succeed, got %v", err)
	}
	if err := sessionRepo.Save(context.Background(), &domain.PeerSession{ID: "session-host", RoomID: room.ID, ParticipantID: host.ID}); err != nil {
		t.Fatalf("expected host session save to succeed, got %v", err)
	}
	if err := sessionRepo.Save(context.Background(), &domain.PeerSession{ID: "session-guest", RoomID: room.ID, ParticipantID: guest.ID}); err != nil {
		t.Fatalf("expected guest session save to succeed, got %v", err)
	}

	envelope := protocol.MustEnvelope(protocol.TypeMediaSlotUpdated, protocol.SlotUpdatedPayload{
		ParticipantID: "local",
		Kind:          domain.SlotAudio,
		Enabled:       false,
		Publishing:    false,
		TrackBound:    true,
	})
	if err := coordinator.HandleEnvelope(context.Background(), "session-host", envelope); err != nil {
		t.Fatalf("expected slot update to succeed, got %v", err)
	}

	updatedRoom, err := roomRepo.FindByID(context.Background(), room.ID)
	if err != nil {
		t.Fatalf("expected room reload to succeed, got %v", err)
	}
	audioSlot := updatedRoom.Participants[host.ID].Slots[domain.SlotAudio]
	if audioSlot.Enabled {
		t.Fatalf("expected audio slot to be persisted as muted")
	}

	if len(media.updateCalls) != 1 {
		t.Fatalf("expected media bridge to receive one slot update, got %d", len(media.updateCalls))
	}
	if media.updateCalls[0].participantID != host.ID || media.updateCalls[0].kind != domain.SlotAudio || media.updateCalls[0].enabled {
		t.Fatalf("expected media bridge call to target the host audio slot")
	}

	if len(emitter.messages["session-host"]) != 1 || len(emitter.messages["session-guest"]) != 1 {
		t.Fatalf("expected room snapshot broadcast to both participants")
	}

	var payload protocol.RoomSnapshotPayload
	if err := json.Unmarshal(emitter.messages["session-guest"][0].Payload, &payload); err != nil {
		t.Fatalf("expected snapshot payload to unmarshal, got %v", err)
	}
	guestView := payload.Snapshot.Participants[0].Slots[0]
	if guestView.Kind != domain.SlotAudio || guestView.Enabled {
		t.Fatalf("expected guest snapshot to reflect muted host audio slot")
	}
}
