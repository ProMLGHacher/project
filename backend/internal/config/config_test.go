package config

import "testing"

func TestLoadAssignsCredentialsToAllTurnServers(t *testing.T) {
	t.Setenv("TURN_URL", "turn:turn.local:3478?transport=udp")
	t.Setenv("TURN_TLS_URL", "turns:turn.local:5349?transport=tcp")
	t.Setenv("TURN_USERNAME", "voice-user")
	t.Setenv("TURN_PASSWORD", "voice-pass")

	cfg := Load()
	if len(cfg.ICEServers) != 2 {
		t.Fatalf("expected two configured ice servers, got %d", len(cfg.ICEServers))
	}

	for index, server := range cfg.ICEServers {
		if server.Username != "voice-user" || server.Credential != "voice-pass" {
			t.Fatalf("expected server %d to carry turn credentials", index)
		}
	}
}
