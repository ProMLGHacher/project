package repository

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/araik/codex-webrtc/project/backend/internal/domain"
)

var ErrNotFound = errors.New("not found")

type InMemoryRoomRepository struct {
	mu    sync.RWMutex
	rooms map[string]*domain.Room
}

func NewInMemoryRoomRepository() *InMemoryRoomRepository {
	return &InMemoryRoomRepository{
		rooms: map[string]*domain.Room{},
	}
}

func (r *InMemoryRoomRepository) Save(_ context.Context, room *domain.Room) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.rooms[room.ID] = room
	return nil
}

func (r *InMemoryRoomRepository) FindByID(_ context.Context, roomID string) (*domain.Room, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	room, exists := r.rooms[roomID]
	if !exists {
		return nil, ErrNotFound
	}

	return room, nil
}

type InMemorySessionRepository struct {
	mu                   sync.RWMutex
	sessions             map[string]*domain.PeerSession
	sessionByParticipant map[string]string
}

func NewInMemorySessionRepository() *InMemorySessionRepository {
	return &InMemorySessionRepository{
		sessions:             map[string]*domain.PeerSession{},
		sessionByParticipant: map[string]string{},
	}
}

func (r *InMemorySessionRepository) Save(_ context.Context, session *domain.PeerSession) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if previousSessionID, exists := r.sessionByParticipant[session.ParticipantID]; exists && previousSessionID != session.ID {
		delete(r.sessions, previousSessionID)
	}

	r.sessions[session.ID] = session
	r.sessionByParticipant[session.ParticipantID] = session.ID
	return nil
}

func (r *InMemorySessionRepository) FindByID(_ context.Context, sessionID string) (*domain.PeerSession, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	session, exists := r.sessions[sessionID]
	if !exists {
		return nil, ErrNotFound
	}

	return session, nil
}

func (r *InMemorySessionRepository) Delete(_ context.Context, sessionID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	session, exists := r.sessions[sessionID]
	if exists {
		if currentSessionID, ok := r.sessionByParticipant[session.ParticipantID]; ok && currentSessionID == sessionID {
			delete(r.sessionByParticipant, session.ParticipantID)
		}
	}

	delete(r.sessions, sessionID)
	return nil
}

type FixedClock struct {
	now time.Time
}

func NewFixedClock(now time.Time) *FixedClock {
	return &FixedClock{now: now}
}

func (c *FixedClock) Now() time.Time {
	return c.now
}

type MutableClock struct {
	mu  sync.RWMutex
	now time.Time
}

func NewMutableClock(now time.Time) *MutableClock {
	return &MutableClock{now: now}
}

func (c *MutableClock) Now() time.Time {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.now
}

func (c *MutableClock) Set(now time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.now = now
}

type DeterministicIDGenerator struct {
	mu      sync.Mutex
	values  []string
	current int
}

func NewDeterministicIDGenerator(values ...string) *DeterministicIDGenerator {
	return &DeterministicIDGenerator{values: values}
}

func (g *DeterministicIDGenerator) NewID() string {
	g.mu.Lock()
	defer g.mu.Unlock()
	value := g.values[g.current]
	g.current++
	return value
}
