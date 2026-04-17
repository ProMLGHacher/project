package signaling

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/araik/codex-webrtc/project/backend/internal/protocol"
	"github.com/gorilla/websocket"
)

func TestHubEmitSerializesConcurrentWrites(t *testing.T) {
	upgrader := websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}
	serverConnCh := make(chan *websocket.Conn, 1)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade failed: %v", err)
			return
		}
		serverConnCh <- conn
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	clientConn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial failed: %v", err)
	}
	defer clientConn.Close()

	serverConn := <-serverConnCh
	defer serverConn.Close()

	hub := NewHub()
	hub.Register("session-1", serverConn)

	const writes = 20
	var (
		wg          sync.WaitGroup
		readMu      sync.Mutex
		received    []protocol.Envelope
		readDone    = make(chan struct{})
		readTimeout = time.After(5 * time.Second)
	)

	go func() {
		for len(received) < writes {
			var envelope protocol.Envelope
			if err := clientConn.ReadJSON(&envelope); err != nil {
				return
			}
			readMu.Lock()
			received = append(received, envelope)
			readMu.Unlock()
		}
		close(readDone)
	}()

	for i := 0; i < writes; i++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			if err := hub.Emit("session-1", protocol.MustEnvelope(protocol.TypeRoomSnapshot, map[string]int{"index": index})); err != nil {
				t.Errorf("emit failed: %v", err)
			}
		}(i)
	}

	wg.Wait()

	select {
	case <-readDone:
	case <-readTimeout:
		t.Fatalf("timed out waiting for websocket messages")
	}

	readMu.Lock()
	defer readMu.Unlock()
	if len(received) != writes {
		t.Fatalf("expected %d websocket messages, got %d", writes, len(received))
	}
}
