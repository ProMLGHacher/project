package repository

import (
	"context"
	"testing"

	"github.com/araik/codex-webrtc/project/backend/internal/domain"
)

func TestSessionRepositorySaveReplacesPreviousSessionForParticipant(t *testing.T) {
	repo := NewInMemorySessionRepository()
	lookup := NewSessionLookup(NewInMemoryRoomRepository(), repo)

	first := &domain.PeerSession{
		ID:            "session-1",
		RoomID:        "room-1",
		ParticipantID: "participant-1",
	}
	second := &domain.PeerSession{
		ID:            "session-2",
		RoomID:        "room-1",
		ParticipantID: "participant-1",
	}

	if err := repo.Save(context.Background(), first); err != nil {
		t.Fatalf("expected first save to succeed, got %v", err)
	}
	if err := repo.Save(context.Background(), second); err != nil {
		t.Fatalf("expected second save to succeed, got %v", err)
	}

	if _, err := repo.FindByID(context.Background(), first.ID); err == nil {
		t.Fatalf("expected previous session to be replaced")
	}

	sessionID, ok := lookup.SessionIDByParticipant(context.Background(), "participant-1")
	if !ok {
		t.Fatalf("expected lookup to find active session")
	}
	if sessionID != second.ID {
		t.Fatalf("expected lookup to return latest session id, got %q", sessionID)
	}
}
