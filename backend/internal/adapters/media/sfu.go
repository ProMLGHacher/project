package media

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/pion/rtcp"
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
	ID            uint64
	RoomID        string
	ParticipantID string
	Kind          domain.SlotKind
	Track         *webrtc.TrackLocalStaticRTP
	Remote        *webrtc.TrackRemote
	stopPLI       chan struct{}
}

type SFU struct {
	mu          sync.RWMutex
	api         *webrtc.API
	emitter     SignalEmitter
	lookup      SessionLookup
	publishers  map[string]*PublisherPeer
	subscribers map[string]*SubscriberPeer
	sources     map[participantSlotKey]*SourceTrack
	nextSourceID uint64
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
			log.Printf("[sfu] publisher-ice-gathering-complete participant_id=%s", participantID)
			return
		}

		candidateJSON := candidate.ToJSON()
		log.Printf("[sfu] publisher-local-candidate participant_id=%s protocol_hint=%s candidate=%q", participantID, protocolHint(candidateJSON.Candidate), candidateJSON.Candidate)

		sessionID, ok := s.lookup.SessionIDByParticipant(context.Background(), participantID)
		if !ok {
			return
		}

		_ = s.emitter.Emit(sessionID, protocol.MustEnvelope(protocol.TypeTrickleCandidate, protocol.CandidatePayload{
			Peer:      "publisher",
			Candidate: candidateJSON,
		}))
	})

	pc.OnICEConnectionStateChange(func(state webrtc.ICEConnectionState) {
		log.Printf("[sfu] publisher-ice-state participant_id=%s state=%s", participantID, state.String())
		if state == webrtc.ICEConnectionStateDisconnected || state == webrtc.ICEConnectionStateFailed {
			log.Printf("[sfu] publisher-ice-degraded participant_id=%s state=%s", participantID, state.String())
		}
	})

	pc.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
		log.Printf("[sfu] publisher-connection-state participant_id=%s state=%s", participantID, state.String())
	})

	pc.OnSignalingStateChange(func(state webrtc.SignalingState) {
		log.Printf("[sfu] publisher-signaling-state participant_id=%s state=%s", participantID, state.String())
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
	log.Printf("[sfu] ensure-publisher room_id=%s participant_id=%s", roomID, participantID)
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
			log.Printf("[sfu] subscriber-ice-gathering-complete participant_id=%s", participantID)
			return
		}

		candidateJSON := candidate.ToJSON()
		log.Printf("[sfu] subscriber-local-candidate participant_id=%s protocol_hint=%s candidate=%q", participantID, protocolHint(candidateJSON.Candidate), candidateJSON.Candidate)

		sessionID, ok := s.lookup.SessionIDByParticipant(context.Background(), participantID)
		if !ok {
			return
		}

		_ = s.emitter.Emit(sessionID, protocol.MustEnvelope(protocol.TypeTrickleCandidate, protocol.CandidatePayload{
			Peer:      "subscriber",
			Candidate: candidateJSON,
		}))
	})

	pc.OnICEConnectionStateChange(func(state webrtc.ICEConnectionState) {
		log.Printf("[sfu] subscriber-ice-state participant_id=%s state=%s", participantID, state.String())
		if state == webrtc.ICEConnectionStateDisconnected || state == webrtc.ICEConnectionStateFailed {
			log.Printf("[sfu] subscriber-ice-degraded participant_id=%s state=%s", participantID, state.String())
		}
	})

	pc.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
		log.Printf("[sfu] subscriber-connection-state participant_id=%s state=%s", participantID, state.String())
	})

	pc.OnSignalingStateChange(func(state webrtc.SignalingState) {
		log.Printf("[sfu] subscriber-signaling-state participant_id=%s state=%s", participantID, state.String())
	})

	s.subscribers[participantID] = peer
	log.Printf("[sfu] ensure-subscriber room_id=%s participant_id=%s", roomID, participantID)
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
	log.Printf("[sfu] update-slot-preference participant_id=%s kind=%s enabled=%t", participantID, kind, enabled)

	// Voice and video slots stay reserved even while a track is temporarily removed.
	// That lets the same publisher/subscriber graph recover on resume without rebuilding
	// downstream subscriber senders or forcing a new remote slot identity.
	return nil
}

func (s *SFU) HandlePublisherOffer(participantID string, offer webrtc.SessionDescription) (webrtc.SessionDescription, error) {
	s.mu.RLock()
	peer, exists := s.publishers[participantID]
	s.mu.RUnlock()
	if !exists {
		return webrtc.SessionDescription{}, fmt.Errorf("unknown publisher participant %s", participantID)
	}

	log.Printf("[sfu] handle-publisher-offer participant_id=%s type=%s sdp_len=%d", participantID, offer.Type.String(), len(offer.SDP))
	if err := peer.PC.SetRemoteDescription(offer); err != nil {
		log.Printf("[sfu] handle-publisher-offer-set-remote-failed participant_id=%s err=%v", participantID, err)
		return webrtc.SessionDescription{}, err
	}

	answer, err := peer.PC.CreateAnswer(nil)
	if err != nil {
		return webrtc.SessionDescription{}, err
	}
	if err := peer.PC.SetLocalDescription(answer); err != nil {
		log.Printf("[sfu] handle-publisher-offer-set-local-failed participant_id=%s err=%v", participantID, err)
		return webrtc.SessionDescription{}, err
	}

	log.Printf("[sfu] publisher-answer-created participant_id=%s type=%s sdp_len=%d", participantID, peer.PC.LocalDescription().Type.String(), len(peer.PC.LocalDescription().SDP))
	return *peer.PC.LocalDescription(), nil
}

func (s *SFU) HandlePublisherCandidate(participantID string, candidate webrtc.ICECandidateInit) error {
	s.mu.RLock()
	peer, exists := s.publishers[participantID]
	s.mu.RUnlock()
	if !exists {
		return fmt.Errorf("unknown publisher participant %s", participantID)
	}

	log.Printf("[sfu] handle-publisher-candidate participant_id=%s protocol_hint=%s candidate=%q", participantID, protocolHint(candidate.Candidate), candidate.Candidate)
	if err := peer.PC.AddICECandidate(candidate); err != nil {
		log.Printf("[sfu] handle-publisher-candidate-failed participant_id=%s err=%v", participantID, err)
		return err
	}
	return nil
}

func (s *SFU) CreateSubscriberOffer(participantID string, iceRestart bool) (webrtc.SessionDescription, error) {
	s.mu.Lock()
	peer, exists := s.subscribers[participantID]
	if !exists {
		s.mu.Unlock()
		return webrtc.SessionDescription{}, fmt.Errorf("unknown subscriber participant %s", participantID)
	}
	if peer.IsNegotiating {
		log.Printf("[sfu] create-subscriber-offer-deferred participant_id=%s ice_restart=%t", participantID, iceRestart)
		peer.PendingOffer = true
		s.mu.Unlock()
		return webrtc.SessionDescription{}, nil
	}
	peer.IsNegotiating = true
	s.mu.Unlock()

	offer, err := peer.PC.CreateOffer(&webrtc.OfferOptions{ICERestart: iceRestart})
	if err != nil {
		s.finishNegotiation(participantID)
		log.Printf("[sfu] create-subscriber-offer-failed participant_id=%s ice_restart=%t err=%v", participantID, iceRestart, err)
		return webrtc.SessionDescription{}, err
	}
	if err := peer.PC.SetLocalDescription(offer); err != nil {
		s.finishNegotiation(participantID)
		log.Printf("[sfu] set-subscriber-local-description-failed participant_id=%s ice_restart=%t err=%v", participantID, iceRestart, err)
		return webrtc.SessionDescription{}, err
	}

	log.Printf("[sfu] subscriber-offer-created participant_id=%s ice_restart=%t sdp_len=%d", participantID, iceRestart, len(peer.PC.LocalDescription().SDP))
	return *peer.PC.LocalDescription(), nil
}

func (s *SFU) HandleSubscriberAnswer(participantID string, answer webrtc.SessionDescription) (*webrtc.SessionDescription, error) {
	s.mu.RLock()
	peer, exists := s.subscribers[participantID]
	s.mu.RUnlock()
	if !exists {
		return nil, fmt.Errorf("unknown subscriber participant %s", participantID)
	}

	log.Printf("[sfu] handle-subscriber-answer participant_id=%s type=%s sdp_len=%d", participantID, answer.Type.String(), len(answer.SDP))
	if err := peer.PC.SetRemoteDescription(answer); err != nil {
		log.Printf("[sfu] handle-subscriber-answer-set-remote-failed participant_id=%s err=%v", participantID, err)
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

	log.Printf("[sfu] handle-subscriber-candidate participant_id=%s protocol_hint=%s candidate=%q", participantID, protocolHint(candidate.Candidate), candidate.Candidate)
	if err := peer.PC.AddICECandidate(candidate); err != nil {
		log.Printf("[sfu] handle-subscriber-candidate-failed participant_id=%s err=%v", participantID, err)
		return err
	}
	return nil
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
		log.Printf("[sfu] attach-existing-sources participant_id=%s attached=0", participantID)
		return nil
	}
	log.Printf("[sfu] attach-existing-sources participant_id=%s attached=%d", participantID, len(sources))

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

func (s *SFU) RemoveParticipant(participantID string) error {
	s.mu.RLock()
	sourceKeys := make([]participantSlotKey, 0, len(s.sources))
	for key, source := range s.sources {
		if source.ParticipantID == participantID {
			sourceKeys = append(sourceKeys, key)
		}
	}
	s.mu.RUnlock()

	for _, key := range sourceKeys {
		if err := s.unpublish(participantID, key.Kind); err != nil {
			log.Printf("[sfu] cleanup-unpublish-failed participant_id=%s kind=%s err=%v", participantID, key.Kind, err)
		}
	}

	s.mu.Lock()
	if publisher, exists := s.publishers[participantID]; exists {
		delete(s.publishers, participantID)
		_ = publisher.PC.Close()
	}
	if subscriber, exists := s.subscribers[participantID]; exists {
		delete(s.subscribers, participantID)
		_ = subscriber.PC.Close()
	}
	s.mu.Unlock()

	log.Printf("[sfu] remove-participant participant_id=%s unpublished=%d", participantID, len(sourceKeys))
	return nil
}

func (s *SFU) publishTrack(roomID, participantID string, kind domain.SlotKind, remote *webrtc.TrackRemote) error {
	log.Printf(
		"[sfu] publish-track room_id=%s participant_id=%s kind=%s track_id=%s stream_id=%s rid=%s ssrc=%d mime=%s",
		roomID,
		participantID,
		kind,
		remote.ID(),
		remote.StreamID(),
		remote.RID(),
		remote.SSRC(),
		remote.Codec().MimeType,
	)
	codec := remote.Codec().RTPCodecCapability
	local, err := webrtc.NewTrackLocalStaticRTP(codec, string(kind), participantID)
	if err != nil {
		return err
	}

	key := participantSlotKey{ParticipantID: participantID, Kind: kind}

	s.mu.Lock()
	if existing, ok := s.sources[key]; ok && existing.stopPLI != nil {
		close(existing.stopPLI)
	}
	s.nextSourceID++
	s.sources[key] = &SourceTrack{
		ID:            s.nextSourceID,
		RoomID:        roomID,
		ParticipantID: participantID,
		Kind:          kind,
		Track:         local,
		Remote:        remote,
		stopPLI:       make(chan struct{}),
	}
	source := s.sources[key]

	subscribers := make([]*SubscriberPeer, 0, len(s.subscribers))
	for _, subscriber := range s.subscribers {
		if subscriber.RoomID == roomID && subscriber.ParticipantID != participantID {
			subscribers = append(subscribers, subscriber)
		}
	}
	s.mu.Unlock()

	for _, subscriber := range subscribers {
		if err := s.addSourceToSubscriber(subscriber, source); err != nil {
			log.Printf("[sfu] add-source-to-subscriber-failed subscriber_id=%s source_participant_id=%s kind=%s err=%v", subscriber.ParticipantID, source.ParticipantID, source.Kind, err)
			_ = s.RemoveParticipant(subscriber.ParticipantID)
			continue
		}
		if offer, err := s.CreateSubscriberOffer(subscriber.ParticipantID, false); err == nil && offer.Type != 0 {
			sessionID, ok := s.lookup.SessionIDByParticipant(context.Background(), subscriber.ParticipantID)
			if ok {
				_ = s.emitter.Emit(sessionID, protocol.MustEnvelope(protocol.TypeSubscriberOffer, protocol.SessionDescriptionPayload{
					Peer:        "subscriber",
					Description: offer,
				}))
			}
		} else if err != nil {
			log.Printf("[sfu] create-subscriber-offer-failed subscriber_id=%s source_participant_id=%s kind=%s err=%v", subscriber.ParticipantID, source.ParticipantID, source.Kind, err)
			_ = s.RemoveParticipant(subscriber.ParticipantID)
		}
	}

	if remote.Kind() == webrtc.RTPCodecTypeVideo {
		s.startPLILoop(participantID, source)
		s.requestKeyframe(participantID, source)
	}

	go func() {
		packetCount := 0
		totalPayloadBytes := 0
		firstPacketLogged := false

		for {
			packet, _, err := remote.ReadRTP()
			if err != nil {
				log.Printf(
					"[sfu] source-read-ended participant_id=%s kind=%s source_id=%d packets=%d payload_bytes=%d err=%v",
					source.ParticipantID,
					source.Kind,
					source.ID,
					packetCount,
					totalPayloadBytes,
					err,
				)
				_ = s.unpublishSource(source)
				return
			}
			packetCount++
			totalPayloadBytes += len(packet.Payload)
			if !firstPacketLogged {
				firstPacketLogged = true
				log.Printf(
					"[sfu] source-first-packet participant_id=%s kind=%s source_id=%d sequence=%d timestamp=%d payload_bytes=%d marker=%t",
					source.ParticipantID,
					source.Kind,
					source.ID,
					packet.SequenceNumber,
					packet.Timestamp,
					len(packet.Payload),
					packet.Marker,
				)
			}
			_ = local.WriteRTP(packet)
		}
	}()

	return nil
}

func (s *SFU) addSourceToSubscriber(subscriber *SubscriberPeer, source *SourceTrack) error {
	key := participantSlotKey{ParticipantID: source.ParticipantID, Kind: source.Kind}

	s.mu.Lock()
	if _, exists := subscriber.Senders[key]; exists {
		s.mu.Unlock()
		return nil
	}

	sender, err := subscriber.PC.AddTrack(source.Track)
	if err != nil {
		s.mu.Unlock()
		return err
	}

	subscriber.Senders[key] = sender
	isVideo := source.Remote != nil && source.Remote.Kind() == webrtc.RTPCodecTypeVideo
	s.mu.Unlock()

	log.Printf(
		"[sfu] add-source-to-subscriber subscriber_id=%s source_participant_id=%s kind=%s source_id=%d track_id=%s",
		subscriber.ParticipantID,
		source.ParticipantID,
		source.Kind,
		source.ID,
		source.Track.ID(),
	)
	go s.drainSenderRTCP(subscriber.ParticipantID, source, sender)
	if isVideo {
		s.requestKeyframe(source.ParticipantID, source)
	}
	return nil
}

func (s *SFU) unpublish(participantID string, kind domain.SlotKind) error {
	key := participantSlotKey{ParticipantID: participantID, Kind: kind}
	s.mu.RLock()
	source, exists := s.sources[key]
	s.mu.RUnlock()
	if !exists {
		return nil
	}

	return s.unpublishSource(source)
}

func (s *SFU) unpublishSource(source *SourceTrack) error {
	log.Printf("[sfu] unpublish participant_id=%s kind=%s source_id=%d", source.ParticipantID, source.Kind, source.ID)
	key := participantSlotKey{ParticipantID: source.ParticipantID, Kind: source.Kind}
	s.mu.Lock()
	current, exists := s.sources[key]
	if !exists || current.ID != source.ID {
		s.mu.Unlock()
		return nil
	}
	if current.stopPLI != nil {
		close(current.stopPLI)
	}
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

	log.Printf("[sfu] unpublish-detach-count participant_id=%s kind=%s source_id=%d subscribers=%d", source.ParticipantID, source.Kind, source.ID, len(targets))

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
		log.Printf("[sfu] finish-negotiation participant_id=%s pending_offer=false", participantID)
		return nil
	}

	peer.PendingOffer = false
	offer, err := peer.PC.CreateOffer(nil)
	if err != nil {
		log.Printf("[sfu] finish-negotiation-create-offer-failed participant_id=%s err=%v", participantID, err)
		return nil
	}
	if err := peer.PC.SetLocalDescription(offer); err != nil {
		log.Printf("[sfu] finish-negotiation-set-local-failed participant_id=%s err=%v", participantID, err)
		return nil
	}
	peer.IsNegotiating = true
	local := *peer.PC.LocalDescription()
	log.Printf("[sfu] finish-negotiation participant_id=%s pending_offer=true sdp_len=%d", participantID, len(local.SDP))
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

func (s *SFU) drainSenderRTCP(subscriberID string, source *SourceTrack, sender *webrtc.RTPSender) {
	for {
		packets, _, err := sender.ReadRTCP()
		if err != nil {
			return
		}

		if source.Remote == nil || source.Remote.Kind() != webrtc.RTPCodecTypeVideo {
			continue
		}

		for _, packet := range packets {
			switch packet.(type) {
			case *rtcp.PictureLossIndication, *rtcp.FullIntraRequest:
				log.Printf("[sfu] rtcp-keyframe-request subscriber_id=%s source_participant_id=%s kind=%s", subscriberID, source.ParticipantID, source.Kind)
				s.requestKeyframe(source.ParticipantID, source)
			}
		}
	}
}

func (s *SFU) startPLILoop(participantID string, source *SourceTrack) {
	if source.stopPLI == nil || source.Remote == nil || source.Remote.Kind() != webrtc.RTPCodecTypeVideo {
		return
	}

	go func(stop <-chan struct{}) {
		ticker := time.NewTicker(3 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				s.requestKeyframe(participantID, source)
			case <-stop:
				return
			}
		}
	}(source.stopPLI)
}

func (s *SFU) requestKeyframe(participantID string, source *SourceTrack) {
	if source.Remote == nil || source.Remote.Kind() != webrtc.RTPCodecTypeVideo {
		return
	}

	s.mu.RLock()
	publisher := s.publishers[participantID]
	s.mu.RUnlock()
	if publisher == nil {
		return
	}

	if err := publisher.PC.WriteRTCP([]rtcp.Packet{
		&rtcp.PictureLossIndication{MediaSSRC: uint32(source.Remote.SSRC())},
	}); err != nil {
		log.Printf("[sfu] request-keyframe-failed participant_id=%s kind=%s err=%v", participantID, source.Kind, err)
		return
	}

	log.Printf("[sfu] request-keyframe participant_id=%s kind=%s ssrc=%d", participantID, source.Kind, source.Remote.SSRC())
}

func protocolHint(candidate string) string {
	switch {
	case candidate == "":
		return "unknown"
	case strings.Contains(candidate, " udp "):
		return "udp"
	case strings.Contains(candidate, " tcp "):
		return "tcp"
	case strings.Contains(candidate, "typ relay"):
		return "relay"
	default:
		return "other"
	}
}
