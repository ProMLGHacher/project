package config

import (
	"net/url"
	"os"
	"strconv"

	"github.com/araik/codex-webrtc/project/backend/internal/application"
)

type MediaConfig struct {
	PublicIP   string
	UDPPortMin uint16
	UDPPortMax uint16
}

type Config struct {
	HTTPAddr      string
	PublicBaseURL *url.URL
	InviteSecret  []byte
	ICEServers    []application.ICEConfig
	Media         MediaConfig
}

func Load() Config {
	publicBaseURL, _ := url.Parse(getEnv("PUBLIC_BASE_URL", "http://localhost:5173"))
	return Config{
		HTTPAddr:      getEnv("HTTP_ADDR", ":8080"),
		PublicBaseURL: publicBaseURL,
		InviteSecret:  []byte(getEnv("INVITE_SECRET", "local-dev-secret")),
		ICEServers: []application.ICEConfig{
			{
				URLs:       []string{getEnv("TURN_URL", "turn:localhost:3478?transport=udp")},
				Username:   getEnv("TURN_USERNAME", "voice"),
				Credential: getEnv("TURN_PASSWORD", "voice-secret"),
			},
			{
				URLs:       []string{getEnv("TURN_TLS_URL", "turns:localhost:5349?transport=tcp")},
				Username:   getEnv("TURN_USERNAME", "voice"),
				Credential: getEnv("TURN_PASSWORD", "voice-secret"),
			},
		},
		Media: MediaConfig{
			PublicIP:   getEnv("ICE_PUBLIC_IP", ""),
			UDPPortMin: getEnvUint16("ICE_UDP_PORT_MIN", 0),
			UDPPortMax: getEnvUint16("ICE_UDP_PORT_MAX", 0),
		},
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

func getEnvUint16(key string, fallback uint16) uint16 {
	value, ok := os.LookupEnv(key)
	if !ok || value == "" {
		return fallback
	}

	parsed, err := strconv.ParseUint(value, 10, 16)
	if err != nil {
		return fallback
	}

	return uint16(parsed)
}
