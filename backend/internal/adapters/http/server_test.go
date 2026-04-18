package httpadapter

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/araik/codex-webrtc/project/backend/internal/adapters/media"
	"github.com/araik/codex-webrtc/project/backend/internal/adapters/repository"
	"github.com/araik/codex-webrtc/project/backend/internal/adapters/signaling"
	"github.com/araik/codex-webrtc/project/backend/internal/application"
	"github.com/araik/codex-webrtc/project/backend/internal/domain"
	"github.com/pion/webrtc/v4"
)

func TestCreateRoomAndJoinEndpoints(t *testing.T) {
	roomRepo := repository.NewInMemoryRoomRepository()
	sessionRepo := repository.NewInMemorySessionRepository()
	clock := repository.NewFixedClock(time.Date(2026, 4, 17, 12, 0, 0, 0, time.UTC))
	ids := repository.NewDeterministicIDGenerator("room-1", "host-seed", "participant-1", "session-1")
	baseURL, _ := url.Parse("http://localhost:5173")
	invites := application.NewHMACInviteService([]byte("secret"), clock, time.Hour)
	roomService := application.NewRoomService(roomRepo, sessionRepo, invites, clock, ids, baseURL, []application.ICEConfig{
		{URLs: []string{"stun:turn.local:3478"}},
	})
	hub := signaling.NewHub()
	lookup := repository.NewSessionLookup(roomRepo, sessionRepo)
	sfu := media.NewSFU(webrtc.NewAPI(), hub, lookup)
	coordinator := application.NewSignalingCoordinator(roomRepo, sessionRepo, hub, lookup, &mediaBridgeAdapter{sfu: sfu})
	server := NewServer(roomService, coordinator, hub)

	createRecorder := httptest.NewRecorder()
	createRequest := httptest.NewRequest(http.MethodPost, "/api/rooms", nil)
	server.Handler().ServeHTTP(createRecorder, createRequest)

	if createRecorder.Code != http.StatusCreated {
		t.Fatalf("expected 201 on create, got %d", createRecorder.Code)
	}

	var createResponse application.CreateRoomResult
	if err := json.Unmarshal(createRecorder.Body.Bytes(), &createResponse); err != nil {
		t.Fatalf("expected create response to be valid json, got %v", err)
	}

	body, _ := json.Marshal(application.PrejoinPreferences{
		DisplayName:   "Guest",
		MicEnabled:    true,
		CameraEnabled: false,
	})
	joinRecorder := httptest.NewRecorder()
	joinRequest := httptest.NewRequest(http.MethodPost, "/api/invites/"+createResponse.ParticipantInviteToken+"/join", bytes.NewReader(body))
	server.Handler().ServeHTTP(joinRecorder, joinRequest)

	if joinRecorder.Code != http.StatusOK {
		t.Fatalf("expected 200 on join, got %d with body %s", joinRecorder.Code, joinRecorder.Body.String())
	}
}

func TestEndpointsUseRequestHostForInviteAndWebSocketURLs(t *testing.T) {
	roomRepo := repository.NewInMemoryRoomRepository()
	sessionRepo := repository.NewInMemorySessionRepository()
	clock := repository.NewFixedClock(time.Date(2026, 4, 17, 12, 0, 0, 0, time.UTC))
	ids := repository.NewDeterministicIDGenerator("room-1", "host-seed", "participant-1", "session-1")
	baseURL, _ := url.Parse("http://fallback.invalid")
	invites := application.NewHMACInviteService([]byte("secret"), clock, time.Hour)
	roomService := application.NewRoomService(roomRepo, sessionRepo, invites, clock, ids, baseURL, []application.ICEConfig{
		{URLs: []string{"stun:turn.local:3478"}},
	})
	hub := signaling.NewHub()
	lookup := repository.NewSessionLookup(roomRepo, sessionRepo)
	sfu := media.NewSFU(webrtc.NewAPI(), hub, lookup)
	coordinator := application.NewSignalingCoordinator(roomRepo, sessionRepo, hub, lookup, &mediaBridgeAdapter{sfu: sfu})
	server := NewServer(roomService, coordinator, hub)

	createRecorder := httptest.NewRecorder()
	createRequest := httptest.NewRequest(http.MethodPost, "http://localhost:8023/api/rooms", nil)
	createRequest.Host = "localhost:8023"
	server.Handler().ServeHTTP(createRecorder, createRequest)

	if createRecorder.Code != http.StatusCreated {
		t.Fatalf("expected 201 on create, got %d", createRecorder.Code)
	}

	var createResponse application.CreateRoomResult
	if err := json.Unmarshal(createRecorder.Body.Bytes(), &createResponse); err != nil {
		t.Fatalf("expected create response to be valid json, got %v", err)
	}

	if !strings.HasPrefix(createResponse.HostInviteURL, "http://localhost:8023/invite/") {
		t.Fatalf("expected host invite url to use request host, got %s", createResponse.HostInviteURL)
	}

	body, _ := json.Marshal(application.PrejoinPreferences{
		DisplayName:   "Guest",
		MicEnabled:    true,
		CameraEnabled: false,
	})
	joinRecorder := httptest.NewRecorder()
	joinRequest := httptest.NewRequest(http.MethodPost, "http://localhost:8023/api/invites/"+createResponse.ParticipantInviteToken+"/join", bytes.NewReader(body))
	joinRequest.Host = "localhost:8023"
	server.Handler().ServeHTTP(joinRecorder, joinRequest)

	if joinRecorder.Code != http.StatusOK {
		t.Fatalf("expected 200 on join, got %d with body %s", joinRecorder.Code, joinRecorder.Body.String())
	}

	var joinResponse application.JoinResult
	if err := json.Unmarshal(joinRecorder.Body.Bytes(), &joinResponse); err != nil {
		t.Fatalf("expected join response to be valid json, got %v", err)
	}

	if joinResponse.WSURL != "ws://localhost:8023/ws?sessionId=session-1" {
		t.Fatalf("expected ws url to use request host, got %s", joinResponse.WSURL)
	}
}

func TestEndpointsPreserveForwardedHTTPSForWebSocketURLs(t *testing.T) {
	roomRepo := repository.NewInMemoryRoomRepository()
	sessionRepo := repository.NewInMemorySessionRepository()
	clock := repository.NewFixedClock(time.Date(2026, 4, 17, 12, 0, 0, 0, time.UTC))
	ids := repository.NewDeterministicIDGenerator("room-1", "host-seed", "participant-1", "session-1")
	baseURL, _ := url.Parse("http://fallback.invalid")
	invites := application.NewHMACInviteService([]byte("secret"), clock, time.Hour)
	roomService := application.NewRoomService(roomRepo, sessionRepo, invites, clock, ids, baseURL, []application.ICEConfig{
		{URLs: []string{"stun:turn.local:3478"}},
	})
	hub := signaling.NewHub()
	lookup := repository.NewSessionLookup(roomRepo, sessionRepo)
	sfu := media.NewSFU(webrtc.NewAPI(), hub, lookup)
	coordinator := application.NewSignalingCoordinator(roomRepo, sessionRepo, hub, lookup, &mediaBridgeAdapter{sfu: sfu})
	server := NewServer(roomService, coordinator, hub)

	createRecorder := httptest.NewRecorder()
	createRequest := httptest.NewRequest(http.MethodPost, "http://internal-proxy/api/rooms", nil)
	createRequest.Host = "internal-proxy"
	createRequest.Header.Set("X-Forwarded-Host", "kvt.araik.dev")
	createRequest.Header.Set("X-Forwarded-Proto", "https,http")
	server.Handler().ServeHTTP(createRecorder, createRequest)

	if createRecorder.Code != http.StatusCreated {
		t.Fatalf("expected 201 on create, got %d", createRecorder.Code)
	}

	var createResponse application.CreateRoomResult
	if err := json.Unmarshal(createRecorder.Body.Bytes(), &createResponse); err != nil {
		t.Fatalf("expected create response to be valid json, got %v", err)
	}

	body, _ := json.Marshal(application.PrejoinPreferences{
		DisplayName:   "Guest",
		MicEnabled:    true,
		CameraEnabled: false,
	})
	joinRecorder := httptest.NewRecorder()
	joinRequest := httptest.NewRequest(http.MethodPost, "http://internal-proxy/api/invites/"+createResponse.ParticipantInviteToken+"/join", bytes.NewReader(body))
	joinRequest.Host = "internal-proxy"
	joinRequest.Header.Set("X-Forwarded-Host", "kvt.araik.dev")
	joinRequest.Header.Set("X-Forwarded-Proto", "https,http")
	server.Handler().ServeHTTP(joinRecorder, joinRequest)

	if joinRecorder.Code != http.StatusOK {
		t.Fatalf("expected 200 on join, got %d with body %s", joinRecorder.Code, joinRecorder.Body.String())
	}

	var joinResponse application.JoinResult
	if err := json.Unmarshal(joinRecorder.Body.Bytes(), &joinResponse); err != nil {
		t.Fatalf("expected join response to be valid json, got %v", err)
	}

	if joinResponse.WSURL != "wss://kvt.araik.dev/ws?sessionId=session-1" {
		t.Fatalf("expected ws url to preserve forwarded https, got %s", joinResponse.WSURL)
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

func (a *mediaBridgeAdapter) UpdateSlotPreference(participantID string, kind domain.SlotKind, enabled bool) error {
	return a.sfu.UpdateSlotPreference(participantID, kind, enabled)
}

func (a *mediaBridgeAdapter) HandlePublisherOffer(participantID string, offer webrtc.SessionDescription) (webrtc.SessionDescription, error) {
	return a.sfu.HandlePublisherOffer(participantID, offer)
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
