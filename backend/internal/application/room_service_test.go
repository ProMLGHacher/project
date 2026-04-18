package application

import (
	"context"
	"net/url"
	"testing"
	"time"

	"github.com/araik/codex-webrtc/project/backend/internal/adapters/repository"
	"github.com/araik/codex-webrtc/project/backend/internal/domain"
)

func TestInviteServiceRoundTrip(t *testing.T) {
	clock := repository.NewFixedClock(time.Date(2026, 4, 17, 12, 0, 0, 0, time.UTC))
	service := NewHMACInviteService([]byte("secret"), clock, time.Hour)

	token, err := service.CreateToken("room-1", domain.RoleParticipant)
	if err != nil {
		t.Fatalf("expected create token to succeed, got %v", err)
	}

	claims, err := service.ParseToken(token)
	if err != nil {
		t.Fatalf("expected parse token to succeed, got %v", err)
	}

	if claims.RoomID != "room-1" {
		t.Fatalf("expected room id to round trip, got %q", claims.RoomID)
	}
}

func TestInviteServiceRejectsExpiredToken(t *testing.T) {
	issuedAt := time.Date(2026, 4, 17, 12, 0, 0, 0, time.UTC)
	clock := repository.NewMutableClock(issuedAt)
	service := NewHMACInviteService([]byte("secret"), clock, time.Minute)

	token, err := service.CreateToken("room-1", domain.RoleParticipant)
	if err != nil {
		t.Fatalf("expected create token to succeed, got %v", err)
	}

	clock.Set(issuedAt.Add(2 * time.Minute))
	if _, err := service.ParseToken(token); err == nil {
		t.Fatalf("expected expired token to fail")
	}
}

func TestCreateRoomAndJoinRoom(t *testing.T) {
	roomRepo := repository.NewInMemoryRoomRepository()
	sessionRepo := repository.NewInMemorySessionRepository()
	clock := repository.NewFixedClock(time.Date(2026, 4, 17, 12, 0, 0, 0, time.UTC))
	invites := NewHMACInviteService([]byte("secret"), clock, time.Hour)
	ids := repository.NewDeterministicIDGenerator("room-1", "host-1", "participant-1", "session-1")
	baseURL, _ := url.Parse("http://localhost:5173")

	service := NewRoomService(roomRepo, sessionRepo, invites, clock, ids, baseURL, []ICEConfig{
		{URLs: []string{"stun:turn.local:3478"}},
	})

	createResult, err := service.CreateRoom(context.Background())
	if err != nil {
		t.Fatalf("expected create room to succeed, got %v", err)
	}

	if createResult.RoomID != "room-1" {
		t.Fatalf("expected room id to be returned, got %q", createResult.RoomID)
	}

	joinResult, err := service.JoinRoomByID(context.Background(), createResult.RoomID, PrejoinPreferences{
		DisplayName:   "Guest",
		MicEnabled:    true,
		CameraEnabled: false,
	}, nil)
	if err != nil {
		t.Fatalf("expected join room to succeed, got %v", err)
	}

	if joinResult.WSURL != "ws://localhost:5173/ws?sessionId=session-1" {
		t.Fatalf("unexpected ws url %q", joinResult.WSURL)
	}

	if len(joinResult.Snapshot.Participants) != 2 {
		t.Fatalf("expected host + guest in snapshot, got %d", len(joinResult.Snapshot.Participants))
	}

	if !joinResult.Snapshot.Participants[1].Slots[0].Enabled {
		t.Fatalf("expected mic-preferred participant to start with audio enabled")
	}
}

func TestHostJoinReusesReservedHostSlot(t *testing.T) {
	roomRepo := repository.NewInMemoryRoomRepository()
	sessionRepo := repository.NewInMemorySessionRepository()
	clock := repository.NewFixedClock(time.Date(2026, 4, 17, 12, 0, 0, 0, time.UTC))
	invites := NewHMACInviteService([]byte("secret"), clock, time.Hour)
	ids := repository.NewDeterministicIDGenerator("room-1", "host-seed", "session-1")
	baseURL, _ := url.Parse("http://localhost:5173")

	service := NewRoomService(roomRepo, sessionRepo, invites, clock, ids, baseURL, nil)

	createResult, err := service.CreateRoom(context.Background())
	if err != nil {
		t.Fatalf("expected create room to succeed, got %v", err)
	}

	joinResult, err := service.JoinRoomByID(context.Background(), createResult.RoomID, PrejoinPreferences{
		DisplayName:   "Actual Host",
		MicEnabled:    true,
		CameraEnabled: true,
		Role:          string(domain.RoleHost),
	}, nil)
	if err != nil {
		t.Fatalf("expected host join to succeed, got %v", err)
	}

	if len(joinResult.Snapshot.Participants) != 1 {
		t.Fatalf("expected reserved host slot to be reused, got %d participants", len(joinResult.Snapshot.Participants))
	}

	if joinResult.ParticipantID != "host-seed" {
		t.Fatalf("expected host to reuse reserved id, got %q", joinResult.ParticipantID)
	}

	if joinResult.Snapshot.Participants[0].DisplayName != "Actual Host" {
		t.Fatalf("expected host display name to be updated, got %q", joinResult.Snapshot.Participants[0].DisplayName)
	}
}

func TestIceRecoveryPolicy(t *testing.T) {
	service := NewIceRecoveryService()

	if got := service.NextAction(domain.IceHealthDisconnected); got != IceRecoveryRestartICE {
		t.Fatalf("expected disconnected to restart ice, got %q", got)
	}

	if got := service.NextAction(domain.IceHealthRecovering); got != IceRecoveryFullRejoin {
		t.Fatalf("expected recovering to escalate, got %q", got)
	}
}

func TestSelectVideoQuality(t *testing.T) {
	service := NewSubscriptionService()

	if got := service.SelectVideoQuality(SubscriptionDecisionInput{IsScreenShare: true}); got != VideoQualityHigh {
		t.Fatalf("expected screen share to be high quality, got %q", got)
	}

	if got := service.SelectVideoQuality(SubscriptionDecisionInput{IsActiveSpeaker: true}); got != VideoQualityMedium {
		t.Fatalf("expected active speaker to be medium quality by default, got %q", got)
	}

	if got := service.SelectVideoQuality(SubscriptionDecisionInput{TileAreaRatio: 0.05}); got != VideoQualityLow {
		t.Fatalf("expected small tile to be low quality, got %q", got)
	}
}
