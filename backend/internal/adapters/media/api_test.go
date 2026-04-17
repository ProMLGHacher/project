package media

import (
	"testing"
	"time"

	"github.com/araik/codex-webrtc/project/backend/internal/config"
	"github.com/pion/webrtc/v4"
)

func TestNewWebRTCAPIAcceptsLocalLANConfig(t *testing.T) {
	api, err := NewWebRTCAPI(config.MediaConfig{
		PublicIP:   "192.168.1.248",
		UDPPortMin: 50000,
		UDPPortMax: 50100,
	})
	if err != nil {
		t.Fatalf("expected api creation to succeed, got %v", err)
	}

	pc, err := api.NewPeerConnection(configuration())
	if err != nil {
		t.Fatalf("expected peer connection creation to succeed, got %v", err)
	}
	defer pc.Close()

	if _, err := pc.CreateDataChannel("probe", nil); err != nil {
		t.Fatalf("expected data channel creation to succeed, got %v", err)
	}

	offer, err := pc.CreateOffer(nil)
	if err != nil {
		t.Fatalf("expected offer creation to succeed, got %v", err)
	}

	gatherComplete := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(offer); err != nil {
		t.Fatalf("expected local description to succeed with LAN config, got %v", err)
	}

	select {
	case <-gatherComplete:
	case <-time.After(3 * time.Second):
		t.Fatalf("expected candidate gathering to complete")
	}
}

func TestNewWebRTCAPIIgnoresHostnamePublicIP(t *testing.T) {
	api, err := NewWebRTCAPI(config.MediaConfig{
		PublicIP:   "localhost",
		UDPPortMin: 50000,
		UDPPortMax: 50100,
	})
	if err != nil {
		t.Fatalf("expected api creation to succeed, got %v", err)
	}

	pc, err := api.NewPeerConnection(configuration())
	if err != nil {
		t.Fatalf("expected peer connection creation to succeed, got %v", err)
	}
	defer pc.Close()

	if _, err := pc.CreateDataChannel("probe", nil); err != nil {
		t.Fatalf("expected data channel creation to succeed, got %v", err)
	}

	offer, err := pc.CreateOffer(nil)
	if err != nil {
		t.Fatalf("expected offer creation to succeed, got %v", err)
	}

	gatherComplete := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(offer); err != nil {
		t.Fatalf("expected local description to succeed when public ip is a hostname, got %v", err)
	}

	select {
	case <-gatherComplete:
	case <-time.After(3 * time.Second):
		t.Fatalf("expected candidate gathering to complete")
	}
}

func configuration() webrtc.Configuration {
	return webrtc.Configuration{}
}
