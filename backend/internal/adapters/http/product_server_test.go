package httpadapter

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/araik/codex-webrtc/project/backend/internal/adapters/repository"
	"github.com/araik/codex-webrtc/project/backend/internal/application"
	"github.com/araik/codex-webrtc/project/backend/internal/domain"
)

func TestProductChatSessionDoesNotCreateRMSSession(t *testing.T) {
	roomRepo := repository.NewInMemoryRoomRepository()
	sessionRepo := repository.NewInMemorySessionRepository()
	clock := repository.NewFixedClock(time.Date(2026, 4, 17, 12, 0, 0, 0, time.UTC))
	roomIDs := repository.NewDeterministicIDGenerator("river-sky-42")
	ids := repository.NewDeterministicIDGenerator("host-seed")
	baseURL, _ := url.Parse("http://localhost:8023")
	invites := application.NewHMACInviteService([]byte("secret"), clock, time.Hour)
	roomService := application.NewRoomService(roomRepo, sessionRepo, invites, clock, roomIDs, ids, baseURL, nil)
	rms := &stubProductRMSAdmin{}
	chat := &stubProductChatAdmin{}
	server := NewProductServer(roomService, rms, chat)

	createRecorder := httptest.NewRecorder()
	createRequest := httptest.NewRequest(http.MethodPost, "/api/rooms", nil)
	server.Handler().ServeHTTP(createRecorder, createRequest)
	if createRecorder.Code != http.StatusCreated {
		t.Fatalf("expected 201 on create, got %d with body %s", createRecorder.Code, createRecorder.Body.String())
	}

	var createResponse application.CreateRoomResult
	if err := json.Unmarshal(createRecorder.Body.Bytes(), &createResponse); err != nil {
		t.Fatalf("expected create response json, got %v", err)
	}

	body, _ := json.Marshal(application.PrejoinPreferences{
		DisplayName: "Chat Reader",
		Role:        string(domain.RoleParticipant),
	})
	for range 3 {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPost, "/api/rooms/"+createResponse.RoomID+"/chat/session", bytes.NewReader(body))
		server.Handler().ServeHTTP(recorder, request)
		if recorder.Code != http.StatusOK {
			t.Fatalf("expected 200 on chat session, got %d with body %s", recorder.Code, recorder.Body.String())
		}

		var response map[string]any
		if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
			t.Fatalf("expected chat session response json, got %v", err)
		}
		if _, exists := response["wsUrl"]; exists {
			t.Fatalf("chat-only response must not include RMS wsUrl")
		}
		if _, exists := response["joinToken"]; exists {
			t.Fatalf("chat-only response must not include RMS joinToken")
		}
	}

	if rms.sessionCalls != 0 {
		t.Fatalf("expected chat-only sessions to avoid RMS, got %d RMS session calls", rms.sessionCalls)
	}
	if chat.sessionCalls != 3 {
		t.Fatalf("expected three chat sessions, got %d", chat.sessionCalls)
	}
}

func TestProductJoinStillCreatesRMSSession(t *testing.T) {
	roomRepo := repository.NewInMemoryRoomRepository()
	sessionRepo := repository.NewInMemorySessionRepository()
	clock := repository.NewFixedClock(time.Date(2026, 4, 17, 12, 0, 0, 0, time.UTC))
	roomIDs := repository.NewDeterministicIDGenerator("river-sky-42")
	ids := repository.NewDeterministicIDGenerator("host-seed")
	baseURL, _ := url.Parse("http://localhost:8023")
	invites := application.NewHMACInviteService([]byte("secret"), clock, time.Hour)
	roomService := application.NewRoomService(roomRepo, sessionRepo, invites, clock, roomIDs, ids, baseURL, nil)
	rms := &stubProductRMSAdmin{}
	chat := &stubProductChatAdmin{}
	server := NewProductServer(roomService, rms, chat)

	createRecorder := httptest.NewRecorder()
	createRequest := httptest.NewRequest(http.MethodPost, "/api/rooms", nil)
	server.Handler().ServeHTTP(createRecorder, createRequest)
	if createRecorder.Code != http.StatusCreated {
		t.Fatalf("expected 201 on create, got %d with body %s", createRecorder.Code, createRecorder.Body.String())
	}

	var createResponse application.CreateRoomResult
	if err := json.Unmarshal(createRecorder.Body.Bytes(), &createResponse); err != nil {
		t.Fatalf("expected create response json, got %v", err)
	}

	body, _ := json.Marshal(application.PrejoinPreferences{
		DisplayName:   "Guest",
		MicEnabled:    true,
		CameraEnabled: true,
		Role:          string(domain.RoleParticipant),
	})
	joinRecorder := httptest.NewRecorder()
	joinRequest := httptest.NewRequest(http.MethodPost, "/api/rooms/"+createResponse.RoomID+"/join", bytes.NewReader(body))
	server.Handler().ServeHTTP(joinRecorder, joinRequest)
	if joinRecorder.Code != http.StatusOK {
		t.Fatalf("expected 200 on join, got %d with body %s", joinRecorder.Code, joinRecorder.Body.String())
	}
	if rms.sessionCalls != 1 {
		t.Fatalf("expected conference join to create one RMS session, got %d", rms.sessionCalls)
	}
}

type stubProductRMSAdmin struct {
	roomCalls    int
	sessionCalls int
}

func (s *stubProductRMSAdmin) CreateRoom(context.Context, string) error {
	s.roomCalls++
	return nil
}

func (s *stubProductRMSAdmin) CreateSession(_ context.Context, roomID string, prefs application.PrejoinPreferences) (application.JoinResult, error) {
	s.sessionCalls++
	return application.JoinResult{
		SessionID:     "session-1",
		ParticipantID: "participant-1",
		RoomID:        roomID,
		Role:          domain.ParticipantRole(prefs.Role),
		WSURL:         "ws://rms/ws?sessionId=session-1",
		Snapshot: domain.RoomSnapshot{
			RoomID:       roomID,
			Participants: nil,
		},
	}, nil
}

type stubProductChatAdmin struct {
	sessionCalls int
}

func (s *stubProductChatAdmin) CreateSpace(context.Context, string, string) error {
	return nil
}

func (s *stubProductChatAdmin) CreateChannel(context.Context, string, string, string) error {
	return nil
}

func (s *stubProductChatAdmin) CreateSession(_ context.Context, channelID string, participantID string, _ application.PrejoinPreferences) (application.ChatBootstrap, error) {
	s.sessionCalls++
	return application.ChatBootstrap{
		ChatURL:       "http://chat.local",
		ChatToken:     "chat-token",
		ChatSpaceID:   "river-sky-42",
		ChatChannelID: channelID,
		ParticipantID: participantID,
	}, nil
}
