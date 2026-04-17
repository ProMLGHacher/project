package media

import (
	"context"
	"fmt"
	"sync"

	"github.com/araik/codex-webrtc/project/backend/internal/domain"
	"github.com/araik/codex-webrtc/project/backend/internal/protocol"
	"github.com/pion/rtp"
	"github.com/pion/webrtc/v4"
)

type SignalEmitter interface {
	Emit(sessionID string, envelope protocol.Envelope) error
}

type SessionLookup interface {
	SessionIDByParticipant(ctx context.Context, participantID string) (string, bool)
	ParticipantsInRoom(ctx context.Context, roomID string) []string
}

type participantSlotKey struct {
	ParticipantID string
	Kind          domain.SlotKind
}

type PublisherPeer struct {
	RoomID        string
	ParticipantID string
	PC            *webrtc.PeerConnection
	DesiredSlots  map[domain.SlotKind]bool
}

type SubscriberPeer struct {
	RoomID        string
	ParticipantID string
	PC            *webrtc.PeerConnection
	Senders       map[participantSlotKey]*webrtc.RTPSender
	IsNegotiating bool
	PendingOffer  bool
}

type SourceTrack struct {
	RoomID        string
	ParticipantID string
	Kind          domain.SlotKind
	Track         *webrtc.TrackLocalStaticRTP
}

type SFU struct {
	mu          sync.RWMutex
	api         *webrtc.API
	emitter     SignalEmitter
	lookup      SessionLookup
	publishers  map[string]*PublisherPeer
	subscribers map[string]*SubscriberPeer
	sources     map[participantSlotKey]*SourceTrack
}

func NewSFU(api *webrtc.API, emitter SignalEmitter, lookup SessionLookup) *SFU {
	return &SFU{
		api:         api,
		emitter:     emitter,
		lookup:      lookup,
		publishers:  map[string]*PublisherPeer{},
		subscribers: map[string]*SubscriberPeer{},
		sources:     map[participantSlotKey]*SourceTrack{},
	}
}

func (s *SFU) EnsurePublisher(roomID, participantID string) (*PublisherPeer, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if peer, exists := s.publishers[participantID]; exists {
		return peer, nil
	}

	pc, err := s.api.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		return nil, err
	}

	if _, err := pc.AddTransceiverFromKind(webrtc.RTPCodecTypeAudio, webrtc.RTPTransceiverInit{Direction: webrtc.RTPTransceiverDirectionRecvonly}); err != nil {
		return nil, err
	}
	if _, err := pc.AddTransceiverFromKind(webrtc.RTPCodecTypeVideo, webrtc.RTPTransceiverInit{Direction: webrtc.RTPTransceiverDirectionRecvonly}); err != nil {
		return nil, err
	}
	if _, err := pc.AddTransceiverFromKind(webrtc.RTPCodecTypeVideo, webrtc.RTPTransceiverInit{Direction: webrtc.RTPTransceiverDirectionRecvonly}); err != nil {
		return nil, err
	}

	peer := &PublisherPeer{
		RoomID:        roomID,
		ParticipantID: participantID,
		PC:            pc,
		DesiredSlots:  map[domain.SlotKind]bool{},
	}

	pc.OnICECandidate(func(candidate *webrtc.ICECandidate) {
		if candidate == nil {
			return
		}

		sessionID, ok := s.lookup.SessionIDByParticipant(context.Background(), participantID)
		if !ok {
			return
		}

		_ = s.emitter.Emit(sessionID, protocol.MustEnvelope(protocol.TypeTrickleCandidate, protocol.CandidatePayload{
			Peer:      "publisher",
			Candidate: candidate.ToJSON(),
		}))
	})

	pc.OnTrack(func(track *webrtc.TrackRemote, _ *webrtc.RTPReceiver) {
		slotKind := s.resolveSlot(peer, track.Kind())
		if slotKind == "" {
			return
		}

		if err := s.publishTrack(peer.RoomID, peer.ParticipantID, slotKind, track); err != nil {
			return
		}
	})

	s.publishers[participantID] = peer
	return peer, nil
}

func (s *SFU) EnsureSubscriber(roomID, participantID string) (*SubscriberPeer, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if peer, exists := s.subscribers[participantID]; exists {
		return peer, nil
	}

	pc, err := s.api.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		return nil, err
	}

	peer := &SubscriberPeer{
		RoomID:        roomID,
		ParticipantID: participantID,
		PC:            pc,
		Senders:       map[participantSlotKey]*webrtc.RTPSender{},
	}

	pc.OnICECandidate(func(candidate *webrtc.ICECandidate) {
		if candidate == nil {
			return
		}

		sessionID, ok := s.lookup.SessionIDByParticipant(context.Background(), participantID)
		if !ok {
			return
		}

		_ = s.emitter.Emit(sessionID, protocol.MustEnvelope(protocol.TypeTrickleCandidate, protocol.CandidatePayload{
			Peer:      "subscriber",
			Candidate: candidate.ToJSON(),
		}))
	})

	s.subscribers[participantID] = peer
	return peer, nil
}

func (s *SFU) UpdateSlotPreference(participantID string, kind domain.SlotKind, enabled bool) error {
	s.mu.Lock()
	peer, exists := s.publishers[participantID]
	if !exists {
		s.mu.Unlock()
		return nil
	}
	peer.DesiredSlots[kind] = enabled
	s.mu.Unlock()

	// Audio stays on the same sender/transceiver and is muted via track.enabled.
	// Only camera and screen slot disables should unpublish and trigger subscriber renegotiation.
	if kind != domain.SlotAudio && !enabled {
		return s.unpublish(participantID, kind)
	}

	return nil
}

func (s *SFU) HandlePublisherOffer(participantID string, offer webrtc.SessionDescription) (webrtc.SessionDescription, error) {
	s.mu.RLock()
	peer, exists := s.publishers[participantID]
	s.mu.RUnlock()
	if !exists {
		return webrtc.SessionDescription{}, fmt.Errorf("unknown publisher participant %s", participantID)
	}

	if err := peer.PC.SetRemoteDescription(offer); err != nil {
		return webrtc.SessionDescription{}, err
	}

	answer, err := peer.PC.CreateAnswer(nil)
	if err != nil {
		return webrtc.SessionDescription{}, err
	}
	if err := peer.PC.SetLocalDescription(answer); err != nil {
		return webrtc.SessionDescription{}, err
	}

	return *peer.PC.LocalDescription(), nil
}

func (s *SFU) HandlePublisherCandidate(participantID string, candidate webrtc.ICECandidateInit) error {
	s.mu.RLock()
	peer, exists := s.publishers[participantID]
	s.mu.RUnlock()
	if !exists {
		return fmt.Errorf("unknown publisher participant %s", participantID)
	}

	return peer.PC.AddICECandidate(candidate)
}

func (s *SFU) CreateSubscriberOffer(participantID string, iceRestart bool) (webrtc.SessionDescription, error) {
	s.mu.Lock()
	peer, exists := s.subscribers[participantID]
	if !exists {
		s.mu.Unlock()
		return webrtc.SessionDescription{}, fmt.Errorf("unknown subscriber participant %s", participantID)
	}
	if peer.IsNegotiating {
		peer.PendingOffer = true
		s.mu.Unlock()
		return webrtc.SessionDescription{}, nil
	}
	peer.IsNegotiating = true
	s.mu.Unlock()

	offer, err := peer.PC.CreateOffer(&webrtc.OfferOptions{ICERestart: iceRestart})
	if err != nil {
		s.finishNegotiation(participantID)
		return webrtc.SessionDescription{}, err
	}
	if err := peer.PC.SetLocalDescription(offer); err != nil {
		s.finishNegotiation(participantID)
		return webrtc.SessionDescription{}, err
	}

	return *peer.PC.LocalDescription(), nil
}

func (s *SFU) HandleSubscriberAnswer(participantID string, answer webrtc.SessionDescription) (*webrtc.SessionDescription, error) {
	s.mu.RLock()
	peer, exists := s.subscribers[participantID]
	s.mu.RUnlock()
	if !exists {
		return nil, fmt.Errorf("unknown subscriber participant %s", participantID)
	}

	if err := peer.PC.SetRemoteDescription(answer); err != nil {
		return nil, err
	}

	return s.finishNegotiation(participantID), nil
}

func (s *SFU) HandleSubscriberCandidate(participantID string, candidate webrtc.ICECandidateInit) error {
	s.mu.RLock()
	peer, exists := s.subscribers[participantID]
	s.mu.RUnlock()
	if !exists {
		return fmt.Errorf("unknown subscriber participant %s", participantID)
	}

	return peer.PC.AddICECandidate(candidate)
}

func (s *SFU) AttachExistingSources(participantID string) error {
	s.mu.RLock()
	peer, exists := s.subscribers[participantID]
	if !exists {
		s.mu.RUnlock()
		return nil
	}

	sources := make([]*SourceTrack, 0, len(s.sources))
	for _, source := range s.sources {
		if source.ParticipantID == participantID || source.RoomID != peer.RoomID {
			continue
		}
		sources = append(sources, source)
	}
	s.mu.RUnlock()

	attachedAny := false
	for _, source := range sources {
		if err := s.addSourceToSubscriber(peer, source); err != nil {
			return err
		}
		attachedAny = true
	}

	if !attachedAny {
		return nil
	}

	offer, err := s.CreateSubscriberOffer(participantID, false)
	if err != nil {
		return err
	}
	if offer.Type == 0 {
		return nil
	}

	sessionID, ok := s.lookup.SessionIDByParticipant(context.Background(), participantID)
	if !ok {
		return nil
	}

	return s.emitter.Emit(sessionID, protocol.MustEnvelope(protocol.TypeSubscriberOffer, protocol.SessionDescriptionPayload{
		Peer:        "subscriber",
		Description: offer,
	}))
}

func (s *SFU) publishTrack(roomID, participantID string, kind domain.SlotKind, remote *webrtc.TrackRemote) error {
	codec := remote.Codec().RTPCodecCapability
	local, err := webrtc.NewTrackLocalStaticRTP(codec, string(kind), participantID)
	if err != nil {
		return err
	}

	key := participantSlotKey{ParticipantID: participantID, Kind: kind}

	s.mu.Lock()
	s.sources[key] = &SourceTrack{
		RoomID:        roomID,
		ParticipantID: participantID,
		Kind:          kind,
		Track:         local,
	}

	subscribers := make([]*SubscriberPeer, 0, len(s.subscribers))
	for _, subscriber := range s.subscribers {
		if subscriber.RoomID == roomID && subscriber.ParticipantID != participantID {
			subscribers = append(subscribers, subscriber)
		}
	}
	s.mu.Unlock()

	for _, subscriber := range subscribers {
		if err := s.addSourceToSubscriber(subscriber, s.sources[key]); err != nil {
			return err
		}
		if offer, err := s.CreateSubscriberOffer(subscriber.ParticipantID, false); err == nil && offer.Type != 0 {
			sessionID, ok := s.lookup.SessionIDByParticipant(context.Background(), subscriber.ParticipantID)
			if ok {
				_ = s.emitter.Emit(sessionID, protocol.MustEnvelope(protocol.TypeSubscriberOffer, protocol.SessionDescriptionPayload{
					Peer:        "subscriber",
					Description: offer,
				}))
			}
		}
	}

	go func() {
		for {
			packet, _, err := remote.ReadRTP()
			if err != nil {
				_ = s.unpublish(participantID, kind)
				return
			}
			_ = local.WriteRTP(packet)
		}
	}()

	return nil
}

func (s *SFU) addSourceToSubscriber(subscriber *SubscriberPeer, source *SourceTrack) error {
	key := participantSlotKey{ParticipantID: source.ParticipantID, Kind: source.Kind}

	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := subscriber.Senders[key]; exists {
		return nil
	}

	sender, err := subscriber.PC.AddTrack(source.Track)
	if err != nil {
		return err
	}

	subscriber.Senders[key] = sender
	return nil
}

func (s *SFU) unpublish(participantID string, kind domain.SlotKind) error {
	key := participantSlotKey{ParticipantID: participantID, Kind: kind}

	s.mu.Lock()
	delete(s.sources, key)

	targets := make([]*SubscriberPeer, 0, len(s.subscribers))
	for _, subscriber := range s.subscribers {
		if sender, exists := subscriber.Senders[key]; exists {
			_ = subscriber.PC.RemoveTrack(sender)
			delete(subscriber.Senders, key)
			targets = append(targets, subscriber)
		}
	}
	s.mu.Unlock()

	for _, subscriber := range targets {
		if offer, err := s.CreateSubscriberOffer(subscriber.ParticipantID, false); err == nil && offer.Type != 0 {
			sessionID, ok := s.lookup.SessionIDByParticipant(context.Background(), subscriber.ParticipantID)
			if ok {
				_ = s.emitter.Emit(sessionID, protocol.MustEnvelope(protocol.TypeSubscriberOffer, protocol.SessionDescriptionPayload{
					Peer:        "subscriber",
					Description: offer,
				}))
			}
		}
	}

	return nil
}

func (s *SFU) finishNegotiation(participantID string) *webrtc.SessionDescription {
	s.mu.Lock()
	defer s.mu.Unlock()

	peer, exists := s.subscribers[participantID]
	if !exists {
		return nil
	}

	peer.IsNegotiating = false
	if !peer.PendingOffer {
		return nil
	}

	peer.PendingOffer = false
	offer, err := peer.PC.CreateOffer(nil)
	if err != nil {
		return nil
	}
	if err := peer.PC.SetLocalDescription(offer); err != nil {
		return nil
	}
	peer.IsNegotiating = true
	local := *peer.PC.LocalDescription()
	return &local
}

func (s *SFU) resolveSlot(peer *PublisherPeer, codecType webrtc.RTPCodecType) domain.SlotKind {
	if codecType == webrtc.RTPCodecTypeAudio {
		return domain.SlotAudio
	}

	if peer.DesiredSlots[domain.SlotCamera] {
		return domain.SlotCamera
	}

	if peer.DesiredSlots[domain.SlotScreen] {
		return domain.SlotScreen
	}

	return domain.SlotCamera
}

func clonePacket(packet *rtp.Packet) *rtp.Packet {
	if packet == nil {
		return nil
	}
	clone := *packet
	return &clone
}
