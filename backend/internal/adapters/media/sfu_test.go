package media

import (
	"context"
	"testing"

	"github.com/araik/codex-webrtc/project/backend/internal/domain"
	"github.com/araik/codex-webrtc/project/backend/internal/protocol"
	"github.com/pion/ice/v4"
	"github.com/pion/webrtc/v4"
)

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

type stubLookup struct {
	sessions     map[string]string
	participants map[string][]string
}

func (l stubLookup) SessionIDByParticipant(_ context.Context, participantID string) (string, bool) {
	sessionID, ok := l.sessions[participantID]
	return sessionID, ok
}

func (l stubLookup) ParticipantsInRoom(_ context.Context, roomID string) []string {
	return l.participants[roomID]
}

func TestEnsurePublisherCreatesReservedTransceivers(t *testing.T) {
	api := newTestAPI()
	sfu := NewSFU(api, newStubEmitter(), stubLookup{})

	peer, err := sfu.EnsurePublisher("room-1", "participant-1")
	if err != nil {
		t.Fatalf("expected ensure publisher to succeed, got %v", err)
	}

	transceivers := peer.PC.GetTransceivers()
	if len(transceivers) != 3 {
		t.Fatalf("expected audio + camera + screen transceivers, got %d", len(transceivers))
	}
}

func TestSubscriberNegotiationQueuesFollowUpOffer(t *testing.T) {
	api := newTestAPI()
	sfu := NewSFU(api, newStubEmitter(), stubLookup{})

	peer, err := sfu.EnsureSubscriber("room-1", "participant-1")
	if err != nil {
		t.Fatalf("expected ensure subscriber to succeed, got %v", err)
	}

	peer.IsNegotiating = true
	peer.PendingOffer = true
	track, err := webrtc.NewTrackLocalStaticRTP(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeVP8},
		"camera",
		"participant-2",
	)
	if err != nil {
		t.Fatalf("expected track creation to succeed, got %v", err)
	}
	if _, err := peer.PC.AddTrack(track); err != nil {
		t.Fatalf("expected add track to succeed, got %v", err)
	}

	if next := sfu.finishNegotiation("participant-1"); next == nil {
		t.Fatalf("expected pending offer to surface follow-up local description after answer")
	}
}

func TestAttachExistingSourcesEmitsSubscriberOffer(t *testing.T) {
	lookup := stubLookup{
		sessions: map[string]string{
			"participant-1": "session-1",
		},
	}
	emitter := newStubEmitter()
	api := newTestAPI()
	sfu := NewSFU(api, emitter, lookup)

	if _, err := sfu.EnsureSubscriber("room-1", "participant-1"); err != nil {
		t.Fatalf("expected ensure subscriber to succeed, got %v", err)
	}

	track, err := webrtc.NewTrackLocalStaticRTP(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeOpus},
		string(domain.SlotAudio),
		"participant-2",
	)
	if err != nil {
		t.Fatalf("expected track creation to succeed, got %v", err)
	}

	sfu.sources[participantSlotKey{ParticipantID: "participant-2", Kind: domain.SlotAudio}] = &SourceTrack{
		RoomID:        "room-1",
		ParticipantID: "participant-2",
		Kind:          domain.SlotAudio,
		Track:         track,
	}

	if err := sfu.AttachExistingSources("participant-1"); err != nil {
		t.Fatalf("expected attach existing sources to succeed, got %v", err)
	}

	envelopes := emitter.messages["session-1"]
	if len(envelopes) == 0 {
		t.Fatalf("expected subscriber offer to be emitted")
	}
	if envelopes[0].Type != protocol.TypeSubscriberOffer {
		t.Fatalf("expected first emitted envelope to be subscriber.offer, got %s", envelopes[0].Type)
	}
}

func TestUpdateSlotPreferenceDisablesExistingSource(t *testing.T) {
	api := newTestAPI()
	sfu := NewSFU(api, newStubEmitter(), stubLookup{})

	publisher, err := sfu.EnsurePublisher("room-1", "participant-1")
	if err != nil {
		t.Fatalf("expected ensure publisher to succeed, got %v", err)
	}
	publisher.DesiredSlots[domain.SlotCamera] = true
	sfu.sources[participantSlotKey{ParticipantID: "participant-1", Kind: domain.SlotCamera}] = &SourceTrack{
		RoomID:        "room-1",
		ParticipantID: "participant-1",
		Kind:          domain.SlotCamera,
	}

	if err := sfu.UpdateSlotPreference("participant-1", domain.SlotCamera, false); err != nil {
		t.Fatalf("expected disable slot to succeed, got %v", err)
	}

	if _, exists := sfu.sources[participantSlotKey{ParticipantID: "participant-1", Kind: domain.SlotCamera}]; exists {
		t.Fatalf("expected source to be removed after disable")
	}
}

func TestUpdateSlotPreferenceKeepsAudioSourceWhenMuted(t *testing.T) {
	api := newTestAPI()
	sfu := NewSFU(api, newStubEmitter(), stubLookup{})

	publisher, err := sfu.EnsurePublisher("room-1", "participant-1")
	if err != nil {
		t.Fatalf("expected ensure publisher to succeed, got %v", err)
	}
	publisher.DesiredSlots[domain.SlotAudio] = true
	sfu.sources[participantSlotKey{ParticipantID: "participant-1", Kind: domain.SlotAudio}] = &SourceTrack{
		RoomID:        "room-1",
		ParticipantID: "participant-1",
		Kind:          domain.SlotAudio,
	}

	if err := sfu.UpdateSlotPreference("participant-1", domain.SlotAudio, false); err != nil {
		t.Fatalf("expected mute update to succeed, got %v", err)
	}

	if _, exists := sfu.sources[participantSlotKey{ParticipantID: "participant-1", Kind: domain.SlotAudio}]; !exists {
		t.Fatalf("expected audio source to remain published while muted")
	}
}

func newTestAPI() *webrtc.API {
	var settings webrtc.SettingEngine
	settings.SetICEMulticastDNSMode(ice.MulticastDNSModeDisabled)
	return webrtc.NewAPI(webrtc.WithSettingEngine(settings))
}
