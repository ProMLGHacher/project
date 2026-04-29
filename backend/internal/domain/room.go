package domain

import (
	"errors"
	"slices"
	"time"
)

type SlotKind string

const (
	SlotAudio       SlotKind = "audio"
	SlotCamera      SlotKind = "camera"
	SlotScreen      SlotKind = "screen"
	SlotScreenAudio SlotKind = "screenAudio"
)

var StableSlotKinds = []SlotKind{SlotAudio, SlotCamera, SlotScreen, SlotScreenAudio}

type ParticipantRole string

const (
	RoleHost        ParticipantRole = "host"
	RoleParticipant ParticipantRole = "participant"
)

type SlotState struct {
	Kind       SlotKind `json:"kind"`
	Enabled    bool     `json:"enabled"`
	Publishing bool     `json:"publishing"`
	TrackBound bool     `json:"trackBound"`
	Revision   int      `json:"revision"`
}

type Participant struct {
	ID          string
	DisplayName string
	Role        ParticipantRole
	JoinedAt    time.Time
	Slots       map[SlotKind]SlotState
}

type Room struct {
	ID                string
	CreatedAt         time.Time
	HostParticipantID string
	Participants      map[string]*Participant
}

type JoinPreferences struct {
	MicEnabled    bool
	CameraEnabled bool
}

var (
	ErrParticipantExists   = errors.New("participant already exists")
	ErrParticipantNotFound = errors.New("participant not found")
)

func NewParticipant(id, displayName string, role ParticipantRole, joinedAt time.Time, prefs JoinPreferences) *Participant {
	slots := make(map[SlotKind]SlotState, len(StableSlotKinds))
	for _, kind := range StableSlotKinds {
		slots[kind] = SlotState{
			Kind:     kind,
			Enabled:  initialEnabled(kind, prefs),
			Revision: 1,
		}
	}

	return &Participant{
		ID:          id,
		DisplayName: displayName,
		Role:        role,
		JoinedAt:    joinedAt,
		Slots:       slots,
	}
}

func ApplyJoinPreferences(participant *Participant, displayName string, joinedAt time.Time, prefs JoinPreferences) {
	participant.DisplayName = displayName
	participant.JoinedAt = joinedAt

	audio := participant.Slots[SlotAudio]
	audio.Enabled = prefs.MicEnabled
	audio.Revision++
	participant.Slots[SlotAudio] = audio

	camera := participant.Slots[SlotCamera]
	camera.Enabled = prefs.CameraEnabled
	camera.Revision++
	participant.Slots[SlotCamera] = camera
}

func NewRoom(id string, createdAt time.Time, host *Participant) *Room {
	return &Room{
		ID:                id,
		CreatedAt:         createdAt,
		HostParticipantID: host.ID,
		Participants: map[string]*Participant{
			host.ID: host,
		},
	}
}

func (r *Room) AddParticipant(participant *Participant) error {
	if _, exists := r.Participants[participant.ID]; exists {
		return ErrParticipantExists
	}

	r.Participants[participant.ID] = participant
	return nil
}

func (r *Room) RemoveParticipant(participantID string) error {
	if _, exists := r.Participants[participantID]; !exists {
		return ErrParticipantNotFound
	}

	delete(r.Participants, participantID)
	return nil
}

func (r *Room) UpdateSlot(participantID string, kind SlotKind, enabled, publishing, trackBound bool) (*Participant, error) {
	participant, exists := r.Participants[participantID]
	if !exists {
		return nil, ErrParticipantNotFound
	}

	slot := participant.Slots[kind]
	slot.Enabled = enabled
	slot.Publishing = publishing
	slot.TrackBound = trackBound
	slot.Revision++
	participant.Slots[kind] = slot

	return participant, nil
}

type RoomSnapshot struct {
	RoomID            string             `json:"roomId"`
	HostParticipantID string             `json:"hostParticipantId"`
	Participants      []ParticipantState `json:"participants"`
}

type ParticipantState struct {
	ID          string          `json:"id"`
	DisplayName string          `json:"displayName"`
	Role        ParticipantRole `json:"role"`
	Slots       []SlotState     `json:"slots"`
}

func (r *Room) Snapshot() RoomSnapshot {
	participants := make([]ParticipantState, 0, len(r.Participants))
	for _, participant := range r.Participants {
		slots := make([]SlotState, 0, len(participant.Slots))
		for _, kind := range StableSlotKinds {
			slots = append(slots, participant.Slots[kind])
		}
		participants = append(participants, ParticipantState{
			ID:          participant.ID,
			DisplayName: participant.DisplayName,
			Role:        participant.Role,
			Slots:       slots,
		})
	}

	slices.SortFunc(participants, func(a, b ParticipantState) int {
		switch {
		case a.Role == RoleHost && b.Role != RoleHost:
			return -1
		case a.Role != RoleHost && b.Role == RoleHost:
			return 1
		default:
			return compareStrings(a.ID, b.ID)
		}
	})

	return RoomSnapshot{
		RoomID:            r.ID,
		HostParticipantID: r.HostParticipantID,
		Participants:      participants,
	}
}

func initialEnabled(kind SlotKind, prefs JoinPreferences) bool {
	switch kind {
	case SlotAudio:
		return prefs.MicEnabled
	case SlotCamera:
		return prefs.CameraEnabled
	default:
		return false
	}
}

func compareStrings(a, b string) int {
	switch {
	case a < b:
		return -1
	case a > b:
		return 1
	default:
		return 0
	}
}
