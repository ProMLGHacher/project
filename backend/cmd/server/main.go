package main

import (
	"log"
	"net/http"
	"time"

	httpadapter "github.com/araik/codex-webrtc/project/backend/internal/adapters/http"
	"github.com/araik/codex-webrtc/project/backend/internal/adapters/media"
	"github.com/araik/codex-webrtc/project/backend/internal/adapters/repository"
	"github.com/araik/codex-webrtc/project/backend/internal/adapters/signaling"
	"github.com/araik/codex-webrtc/project/backend/internal/application"
	"github.com/araik/codex-webrtc/project/backend/internal/config"
	"github.com/araik/codex-webrtc/project/backend/internal/domain"
	"github.com/pion/webrtc/v4"
)

func main() {
	cfg := config.Load()
	api, err := media.NewWebRTCAPI(cfg.Media)
	if err != nil {
		log.Fatal(err)
	}
	roomRepo := repository.NewInMemoryRoomRepository()
	sessionRepo := repository.NewInMemorySessionRepository()
	clock := repository.RuntimeClock{}
	roomIDs := repository.NewHumanRoomIDGenerator()
	ids := repository.UUIDGenerator{}
	invites := application.NewHMACInviteService(cfg.InviteSecret, clock, 24*time.Hour)
	roomService := application.NewRoomService(roomRepo, sessionRepo, invites, clock, roomIDs, ids, cfg.PublicBaseURL, cfg.ICEServers)
	hub := signaling.NewHub()
	lookup := repository.NewSessionLookup(roomRepo, sessionRepo)
	sfu := media.NewSFU(api, hub, lookup)
	coordinator := application.NewSignalingCoordinator(roomRepo, sessionRepo, hub, lookup, &mediaBridgeAdapter{sfu: sfu})
	server := httpadapter.NewServer(roomService, coordinator, hub)

	log.Printf("backend listening on %s", cfg.HTTPAddr)
	if err := http.ListenAndServe(cfg.HTTPAddr, server.Handler()); err != nil {
		log.Fatal(err)
	}
}

type mediaBridgeAdapter struct {
	sfu *media.SFU
}

func (a *mediaBridgeAdapter) EnsurePublisher(roomID, participantID string) error {
	_, err := a.sfu.EnsurePublisher(roomID, participantID)
	return err
}

func (a *mediaBridgeAdapter) EnsureSubscriber(roomID, participantID string) error {
	_, err := a.sfu.EnsureSubscriber(roomID, participantID)
	return err
}

func (a *mediaBridgeAdapter) AttachExistingSources(participantID string) error {
	return a.sfu.AttachExistingSources(participantID)
}

func (a *mediaBridgeAdapter) RemoveParticipant(participantID string) error {
	return a.sfu.RemoveParticipant(participantID)
}

func (a *mediaBridgeAdapter) UpdateSlotPreference(participantID string, kind domain.SlotKind, enabled bool) error {
	return a.sfu.UpdateSlotPreference(participantID, kind, enabled)
}

func (a *mediaBridgeAdapter) HandlePublisherOffer(participantID string, offer webrtc.SessionDescription, slotBindings map[string]domain.SlotKind) (webrtc.SessionDescription, error) {
	return a.sfu.HandlePublisherOffer(participantID, offer, slotBindings)
}

func (a *mediaBridgeAdapter) HandlePublisherCandidate(participantID string, candidate webrtc.ICECandidateInit) error {
	return a.sfu.HandlePublisherCandidate(participantID, candidate)
}

func (a *mediaBridgeAdapter) CreateSubscriberOffer(participantID string, iceRestart bool) (webrtc.SessionDescription, error) {
	return a.sfu.CreateSubscriberOffer(participantID, iceRestart)
}

func (a *mediaBridgeAdapter) HandleSubscriberAnswer(participantID string, answer webrtc.SessionDescription) (*webrtc.SessionDescription, error) {
	return a.sfu.HandleSubscriberAnswer(participantID, answer)
}

func (a *mediaBridgeAdapter) HandleSubscriberCandidate(participantID string, candidate webrtc.ICECandidateInit) error {
	return a.sfu.HandleSubscriberCandidate(participantID, candidate)
}
