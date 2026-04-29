package domain

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestNewRoomSeedsHostAndStableSlots(t *testing.T) {
	now := time.Date(2026, 4, 17, 12, 0, 0, 0, time.UTC)
	host := NewParticipant("host-1", "Host", RoleHost, now, JoinPreferences{
		MicEnabled:    true,
		CameraEnabled: false,
	})

	room := NewRoom("room-1", now, host)

	if room.HostParticipantID != "host-1" {
		t.Fatalf("expected host participant id to be preserved, got %q", room.HostParticipantID)
	}

	if len(host.Slots) != 4 {
		t.Fatalf("expected 4 stable slots, got %d", len(host.Slots))
	}

	if !host.Slots[SlotAudio].Enabled {
		t.Fatalf("expected microphone slot to be enabled")
	}

	if host.Slots[SlotCamera].Enabled {
		t.Fatalf("expected camera slot to start disabled")
	}
}

func TestRoomAddRemoveAndUpdateSlot(t *testing.T) {
	now := time.Date(2026, 4, 17, 12, 0, 0, 0, time.UTC)
	host := NewParticipant("host-1", "Host", RoleHost, now, JoinPreferences{})
	room := NewRoom("room-1", now, host)
	guest := NewParticipant("guest-1", "Guest", RoleParticipant, now, JoinPreferences{})

	if err := room.AddParticipant(guest); err != nil {
		t.Fatalf("expected add participant to succeed, got %v", err)
	}

	updated, err := room.UpdateSlot("guest-1", SlotCamera, true, true, true)
	if err != nil {
		t.Fatalf("expected update slot to succeed, got %v", err)
	}

	if !updated.Slots[SlotCamera].TrackBound {
		t.Fatalf("expected camera slot to be marked track-bound")
	}

	if updated.Slots[SlotCamera].Revision != 2 {
		t.Fatalf("expected revision bump on slot update, got %d", updated.Slots[SlotCamera].Revision)
	}

	if err := room.RemoveParticipant("guest-1"); err != nil {
		t.Fatalf("expected remove participant to succeed, got %v", err)
	}

	if _, exists := room.Participants["guest-1"]; exists {
		t.Fatalf("expected participant to be removed")
	}
}

func TestRoomSnapshotSortsHostFirst(t *testing.T) {
	now := time.Date(2026, 4, 17, 12, 0, 0, 0, time.UTC)
	host := NewParticipant("b-host", "Host", RoleHost, now, JoinPreferences{})
	room := NewRoom("room-1", now, host)
	_ = room.AddParticipant(NewParticipant("a-guest", "Guest", RoleParticipant, now, JoinPreferences{}))

	snapshot := room.Snapshot()

	if len(snapshot.Participants) != 2 {
		t.Fatalf("expected two participants, got %d", len(snapshot.Participants))
	}

	if snapshot.Participants[0].Role != RoleHost {
		t.Fatalf("expected host first in snapshot")
	}
}

func TestRoomSnapshotUsesFrontendFriendlySlotJSON(t *testing.T) {
	now := time.Date(2026, 4, 17, 12, 0, 0, 0, time.UTC)
	host := NewParticipant("host-1", "Host", RoleHost, now, JoinPreferences{MicEnabled: true})
	room := NewRoom("room-1", now, host)

	payload, err := json.Marshal(room.Snapshot())
	if err != nil {
		t.Fatalf("expected snapshot marshal to succeed, got %v", err)
	}

	body := string(payload)
	if !strings.Contains(body, `"kind":"audio"`) {
		t.Fatalf("expected slot json to use lowercase field names, got %s", body)
	}
	if strings.Contains(body, `"Kind"`) {
		t.Fatalf("expected slot json to avoid Go-style capitalized keys, got %s", body)
	}
}
