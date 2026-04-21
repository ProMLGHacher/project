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
	roomIDs := repository.NewDeterministicIDGenerator("river-sky-42")
	ids := repository.NewDeterministicIDGenerator("host-seed", "participant-1", "session-1")
	baseURL, _ := url.Parse("http://localhost:5173")
	invites := application.NewHMACInviteService([]byte("secret"), clock, time.Hour)
	roomService := application.NewRoomService(roomRepo, sessionRepo, invites, clock, roomIDs, ids, baseURL, []application.ICEConfig{
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
	joinRequest := httptest.NewRequest(http.MethodPost, "/api/rooms/"+createResponse.RoomID+"/join", bytes.NewReader(body))
	server.Handler().ServeHTTP(joinRecorder, joinRequest)

	if joinRecorder.Code != http.StatusOK {
		t.Fatalf("expected 200 on join, got %d with body %s", joinRecorder.Code, joinRecorder.Body.String())
	}
}

func TestRoomMetadataEndpoint(t *testing.T) {
	roomRepo := repository.NewInMemoryRoomRepository()
	sessionRepo := repository.NewInMemorySessionRepository()
	clock := repository.NewFixedClock(time.Date(2026, 4, 17, 12, 0, 0, 0, time.UTC))
	roomIDs := repository.NewDeterministicIDGenerator("river-sky-42")
	ids := repository.NewDeterministicIDGenerator("host-seed", "participant-1", "session-1")
	baseURL, _ := url.Parse("http://fallback.invalid")
	invites := application.NewHMACInviteService([]byte("secret"), clock, time.Hour)
	roomService := application.NewRoomService(roomRepo, sessionRepo, invites, clock, roomIDs, ids, baseURL, []application.ICEConfig{
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

	roomRecorder := httptest.NewRecorder()
	roomRequest := httptest.NewRequest(http.MethodGet, "http://localhost:8023/api/rooms/"+createResponse.RoomID, nil)
	roomRequest.Host = "localhost:8023"
	server.Handler().ServeHTTP(roomRecorder, roomRequest)

	if roomRecorder.Code != http.StatusOK {
		t.Fatalf("expected 200 on room metadata, got %d with body %s", roomRecorder.Code, roomRecorder.Body.String())
	}

	var roomResponse application.RoomMetadata
	if err := json.Unmarshal(roomRecorder.Body.Bytes(), &roomResponse); err != nil {
		t.Fatalf("expected room metadata response to be valid json, got %v", err)
	}

	if roomResponse.RoomID != createResponse.RoomID {
		t.Fatalf("expected room metadata to use created room id, got %s", roomResponse.RoomID)
	}
}

func TestEndpointsUseRequestHostForWebSocketURLs(t *testing.T) {
	roomRepo := repository.NewInMemoryRoomRepository()
	sessionRepo := repository.NewInMemorySessionRepository()
	clock := repository.NewFixedClock(time.Date(2026, 4, 17, 12, 0, 0, 0, time.UTC))
	roomIDs := repository.NewDeterministicIDGenerator("river-sky-42")
	ids := repository.NewDeterministicIDGenerator("host-seed", "participant-1", "session-1")
	baseURL, _ := url.Parse("http://fallback.invalid")
	invites := application.NewHMACInviteService([]byte("secret"), clock, time.Hour)
	roomService := application.NewRoomService(roomRepo, sessionRepo, invites, clock, roomIDs, ids, baseURL, []application.ICEConfig{
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

	body, _ := json.Marshal(application.PrejoinPreferences{
		DisplayName:   "Guest",
		MicEnabled:    true,
		CameraEnabled: false,
	})
	joinRecorder := httptest.NewRecorder()
	joinRequest := httptest.NewRequest(http.MethodPost, "http://localhost:8023/api/rooms/"+createResponse.RoomID+"/join", bytes.NewReader(body))
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
	roomIDs := repository.NewDeterministicIDGenerator("river-sky-42")
	ids := repository.NewDeterministicIDGenerator("host-seed", "participant-1", "session-1")
	baseURL, _ := url.Parse("http://fallback.invalid")
	invites := application.NewHMACInviteService([]byte("secret"), clock, time.Hour)
	roomService := application.NewRoomService(roomRepo, sessionRepo, invites, clock, roomIDs, ids, baseURL, []application.ICEConfig{
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
	joinRequest := httptest.NewRequest(http.MethodPost, "http://internal-proxy/api/rooms/"+createResponse.RoomID+"/join", bytes.NewReader(body))
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

func TestSwaggerAndOpenAPIEndpoints(t *testing.T) {
	roomRepo := repository.NewInMemoryRoomRepository()
	sessionRepo := repository.NewInMemorySessionRepository()
	clock := repository.NewFixedClock(time.Date(2026, 4, 17, 12, 0, 0, 0, time.UTC))
	roomIDs := repository.NewDeterministicIDGenerator("river-sky-42")
	ids := repository.NewDeterministicIDGenerator("host-seed", "participant-1", "session-1")
	baseURL, _ := url.Parse("http://fallback.invalid")
	invites := application.NewHMACInviteService([]byte("secret"), clock, time.Hour)
	roomService := application.NewRoomService(roomRepo, sessionRepo, invites, clock, roomIDs, ids, baseURL, []application.ICEConfig{
		{URLs: []string{"stun:turn.local:3478"}},
	})
	hub := signaling.NewHub()
	lookup := repository.NewSessionLookup(roomRepo, sessionRepo)
	sfu := media.NewSFU(webrtc.NewAPI(), hub, lookup)
	coordinator := application.NewSignalingCoordinator(roomRepo, sessionRepo, hub, lookup, &mediaBridgeAdapter{sfu: sfu})
	server := NewServer(roomService, coordinator, hub)

	openAPIRecorder := httptest.NewRecorder()
	openAPIRequest := httptest.NewRequest(http.MethodGet, "/api/openapi.json", nil)
	server.Handler().ServeHTTP(openAPIRecorder, openAPIRequest)

	if openAPIRecorder.Code != http.StatusOK {
		t.Fatalf("expected 200 on openapi, got %d", openAPIRecorder.Code)
	}
	if contentType := openAPIRecorder.Header().Get("Content-Type"); contentType != "application/json" {
		t.Fatalf("expected application/json openapi content type, got %q", contentType)
	}

	var document map[string]any
	if err := json.Unmarshal(openAPIRecorder.Body.Bytes(), &document); err != nil {
		t.Fatalf("expected openapi response to be valid json, got %v", err)
	}
	if document["openapi"] != "3.1.0" {
		t.Fatalf("expected openapi 3.1.0 document, got %v", document["openapi"])
	}

	paths, ok := document["paths"].(map[string]any)
	if !ok {
		t.Fatalf("expected openapi paths object")
	}
	for _, path := range []string{"/api/rooms", "/api/rooms/{roomId}", "/api/rooms/{roomId}/join", "/ws"} {
		if _, exists := paths[path]; !exists {
			t.Fatalf("expected openapi path %s to be documented", path)
		}
	}

	swaggerRecorder := httptest.NewRecorder()
	swaggerRequest := httptest.NewRequest(http.MethodGet, "/api/swagger", nil)
	server.Handler().ServeHTTP(swaggerRecorder, swaggerRequest)

	if swaggerRecorder.Code != http.StatusOK {
		t.Fatalf("expected 200 on swagger, got %d", swaggerRecorder.Code)
	}
	if contentType := swaggerRecorder.Header().Get("Content-Type"); contentType != "text/html; charset=utf-8" {
		t.Fatalf("expected html swagger content type, got %q", contentType)
	}
	if !strings.Contains(swaggerRecorder.Body.String(), "/api/openapi.json") {
		t.Fatalf("expected swagger html to point to openapi json")
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
