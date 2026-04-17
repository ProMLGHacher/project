package repository

import (
	"context"

	"github.com/araik/codex-webrtc/project/backend/internal/domain"
)

type SessionLookup struct {
	rooms    *InMemoryRoomRepository
	sessions *InMemorySessionRepository
}

func NewSessionLookup(rooms *InMemoryRoomRepository, sessions *InMemorySessionRepository) *SessionLookup {
	return &SessionLookup{
		rooms:    rooms,
		sessions: sessions,
	}
}

func (l *SessionLookup) SessionIDByParticipant(_ context.Context, participantID string) (string, bool) {
	l.sessions.mu.RLock()
	defer l.sessions.mu.RUnlock()
	for _, session := range l.sessions.sessions {
		if session.ParticipantID == participantID {
			return session.ID, true
		}
	}
	return "", false
}

func (l *SessionLookup) ParticipantsInRoom(_ context.Context, roomID string) []string {
	l.rooms.mu.RLock()
	defer l.rooms.mu.RUnlock()
	room, exists := l.rooms.rooms[roomID]
	if !exists {
		return nil
	}

	participants := make([]string, 0, len(room.Participants))
	for _, participant := range room.Participants {
		participants = append(participants, participant.ID)
	}
	return participants
}

var _ = domain.PeerSession{}
