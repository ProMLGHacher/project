package media

import (
	"net"

	"github.com/araik/codex-webrtc/project/backend/internal/config"
	"github.com/pion/ice/v4"
	"github.com/pion/webrtc/v4"
)

func NewWebRTCAPI(cfg config.MediaConfig) (*webrtc.API, error) {
	var settings webrtc.SettingEngine
	settings.SetICEMulticastDNSMode(ice.MulticastDNSModeDisabled)

	if cfg.UDPPortMin != 0 && cfg.UDPPortMax != 0 {
		if err := settings.SetEphemeralUDPPortRange(cfg.UDPPortMin, cfg.UDPPortMax); err != nil {
			return nil, err
		}
	}

	if shouldUseNAT1To1(cfg.PublicIP) {
		settings.SetNAT1To1IPs([]string{cfg.PublicIP}, webrtc.ICECandidateTypeHost)
	}

	return webrtc.NewAPI(webrtc.WithSettingEngine(settings)), nil
}

func shouldUseNAT1To1(ip string) bool {
	if ip == "" {
		return false
	}

	parsed := net.ParseIP(ip)
	if parsed == nil {
		return false
	}

	if parsed.IsLoopback() || parsed.IsPrivate() || parsed.IsLinkLocalUnicast() || parsed.IsLinkLocalMulticast() {
		return false
	}

	return true
}
