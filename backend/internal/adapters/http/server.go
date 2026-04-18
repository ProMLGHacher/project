package httpadapter

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/url"
	"strings"

	"github.com/araik/codex-webrtc/project/backend/internal/adapters/signaling"
	"github.com/araik/codex-webrtc/project/backend/internal/application"
	"github.com/araik/codex-webrtc/project/backend/internal/protocol"
	"github.com/gorilla/websocket"
)

type Server struct {
	roomService *application.RoomService
	coordinator *application.SignalingCoordinator
	hub         *signaling.Hub
	upgrader    websocket.Upgrader
}

func NewServer(roomService *application.RoomService, coordinator *application.SignalingCoordinator, hub *signaling.Hub) *Server {
	return &Server{
		roomService: roomService,
		coordinator: coordinator,
		hub:         hub,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(*http.Request) bool { return true },
		},
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", s.handleHealth)
	mux.HandleFunc("/api/rooms", s.handleCreateRoom)
	mux.HandleFunc("/api/rooms/", s.handleRoomRoutes)
	mux.HandleFunc("/api/invites/", s.handleInviteRoutes)
	mux.HandleFunc("/ws", s.handleWebSocket)
	return mux
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleCreateRoom(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}

	result, err := s.roomService.CreateRoomForBaseURL(r.Context(), requestBaseURL(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}

	log.Printf("[http] create-room room_id=%s host=%s", result.RoomID, requestBaseURL(r).Host)
	writeJSON(w, http.StatusCreated, result)
}

func (s *Server) handleRoomRoutes(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/rooms/")
	parts := strings.Split(path, "/")
	if len(parts) == 0 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}

	roomID := parts[0]

	if len(parts) == 1 && r.Method == http.MethodGet {
		metadata, err := s.roomService.GetRoomMetadata(r.Context(), roomID)
		if err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, application.ErrRoomNotFound) {
				status = http.StatusNotFound
			}
			writeError(w, status, err)
			return
		}

		writeJSON(w, http.StatusOK, metadata)
		return
	}

	if len(parts) == 2 && parts[1] == "join" && r.Method == http.MethodPost {
		var prefs application.PrejoinPreferences
		if err := json.NewDecoder(r.Body).Decode(&prefs); err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}

		result, err := s.roomService.JoinRoomByID(r.Context(), roomID, prefs, requestBaseURL(r))
		if err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, application.ErrRoomNotFound) {
				status = http.StatusNotFound
			}
			writeError(w, status, err)
			return
		}

		log.Printf("[http] join-room room_id=%s participant_id=%s role=%s display_name=%q", result.RoomID, result.ParticipantID, result.Role, prefs.DisplayName)
		writeJSON(w, http.StatusOK, result)
		return
	}

	http.NotFound(w, r)
}

func (s *Server) handleInviteRoutes(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/invites/")
	parts := strings.Split(path, "/")
	if len(parts) == 0 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}
	token := parts[0]

	if len(parts) == 1 && r.Method == http.MethodGet {
		claims, err := s.roomService.GetInviteMetadata(token)
		if err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		writeJSON(w, http.StatusOK, claims)
		return
	}

	if len(parts) == 2 && parts[1] == "join" && r.Method == http.MethodPost {
		var prefs application.PrejoinPreferences
		if err := json.NewDecoder(r.Body).Decode(&prefs); err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		result, err := s.roomService.JoinRoomForBaseURL(r.Context(), token, prefs, requestBaseURL(r))
		if err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, application.ErrRoomNotFound) {
				status = http.StatusNotFound
			}
			writeError(w, status, err)
			return
		}
		writeJSON(w, http.StatusOK, result)
		return
	}

	http.NotFound(w, r)
}

func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("sessionId")
	if sessionID == "" {
		writeError(w, http.StatusBadRequest, errors.New("missing sessionId"))
		return
	}

	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	log.Printf("[ws] connected session_id=%s remote=%s", sessionID, r.RemoteAddr)
	s.hub.Register(sessionID, conn)
	defer func() {
		s.hub.Unregister(sessionID)
		_ = s.coordinator.OnDisconnected(context.Background(), sessionID)
		_ = conn.Close()
		log.Printf("[ws] disconnected session_id=%s remote=%s", sessionID, r.RemoteAddr)
	}()

	if err := s.coordinator.OnConnected(context.Background(), sessionID); err != nil {
		_ = conn.WriteJSON(protocol.MustEnvelope(protocol.TypeError, protocol.ErrorPayload{Message: err.Error()}))
		return
	}

	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			return
		}

		envelope, err := signaling.DecodeEnvelope(data)
		if err != nil {
			_ = conn.WriteJSON(protocol.MustEnvelope(protocol.TypeError, protocol.ErrorPayload{Message: err.Error()}))
			continue
		}

		if envelope.Type == protocol.TypeHeartbeatPing {
			var payload protocol.HeartbeatPayload
			_ = json.Unmarshal(envelope.Payload, &payload)
			_ = conn.WriteJSON(protocol.MustEnvelope(protocol.TypeHeartbeatPong, payload))
			continue
		}

		if err := s.coordinator.HandleEnvelope(context.Background(), sessionID, envelope); err != nil {
			_ = conn.WriteJSON(protocol.MustEnvelope(protocol.TypeError, protocol.ErrorPayload{Message: err.Error()}))
		}
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func requestBaseURL(r *http.Request) *url.URL {
	scheme := "http"
	if forwardedProto := firstForwardedValue(r.Header.Get("X-Forwarded-Proto")); forwardedProto != "" {
		scheme = forwardedProto
	} else if r.TLS != nil {
		scheme = "https"
	}

	host := firstForwardedValue(r.Header.Get("X-Forwarded-Host"))
	if host == "" {
		host = r.Host
	}

	return &url.URL{
		Scheme: scheme,
		Host:   host,
	}
}

func firstForwardedValue(value string) string {
	if value == "" {
		return ""
	}

	parts := strings.Split(value, ",")
	return strings.TrimSpace(parts[0])
}
