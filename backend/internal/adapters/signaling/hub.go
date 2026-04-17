package signaling

import (
	"encoding/json"
	"sync"

	"github.com/araik/codex-webrtc/project/backend/internal/protocol"
	"github.com/gorilla/websocket"
)

type Hub struct {
	mu      sync.RWMutex
	clients map[string]*clientConn
}

type clientConn struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

func NewHub() *Hub {
	return &Hub{
		clients: map[string]*clientConn{},
	}
}

func (h *Hub) Register(sessionID string, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[sessionID] = &clientConn{conn: conn}
}

func (h *Hub) Unregister(sessionID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients, sessionID)
}

func (h *Hub) Emit(sessionID string, envelope protocol.Envelope) error {
	h.mu.RLock()
	client, exists := h.clients[sessionID]
	h.mu.RUnlock()
	if !exists {
		return nil
	}

	client.mu.Lock()
	defer client.mu.Unlock()
	return client.conn.WriteJSON(envelope)
}

func DecodeEnvelope(raw []byte) (protocol.Envelope, error) {
	var envelope protocol.Envelope
	err := json.Unmarshal(raw, &envelope)
	return envelope, err
}
