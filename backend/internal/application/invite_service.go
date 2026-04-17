package application

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/araik/codex-webrtc/project/backend/internal/domain"
)

var ErrInvalidInviteToken = errors.New("invalid invite token")

type HMACInviteService struct {
	secret []byte
	clock  Clock
	ttl    time.Duration
}

type invitePayload struct {
	RoomID    string                 `json:"roomId"`
	Role      domain.ParticipantRole `json:"role"`
	ExpiresAt time.Time              `json:"expiresAt"`
}

func NewHMACInviteService(secret []byte, clock Clock, ttl time.Duration) *HMACInviteService {
	return &HMACInviteService{
		secret: secret,
		clock:  clock,
		ttl:    ttl,
	}
}

func (s *HMACInviteService) CreateToken(roomID string, role domain.ParticipantRole) (string, error) {
	payload := invitePayload{
		RoomID:    roomID,
		Role:      role,
		ExpiresAt: s.clock.Now().Add(s.ttl),
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshal invite payload: %w", err)
	}

	encodedBody := base64.RawURLEncoding.EncodeToString(body)
	signature := s.sign(encodedBody)

	return fmt.Sprintf("%s.%s", encodedBody, signature), nil
}

func (s *HMACInviteService) ParseToken(token string) (InviteClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return InviteClaims{}, ErrInvalidInviteToken
	}

	if expected := s.sign(parts[0]); !hmac.Equal([]byte(expected), []byte(parts[1])) {
		return InviteClaims{}, ErrInvalidInviteToken
	}

	body, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return InviteClaims{}, ErrInvalidInviteToken
	}

	var payload invitePayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return InviteClaims{}, ErrInvalidInviteToken
	}

	if s.clock.Now().After(payload.ExpiresAt) {
		return InviteClaims{}, ErrInvalidInviteToken
	}

	return InviteClaims{
		RoomID:    payload.RoomID,
		Role:      payload.Role,
		ExpiresAt: payload.ExpiresAt,
	}, nil
}

func (s *HMACInviteService) sign(encodedBody string) string {
	mac := hmac.New(sha256.New, s.secret)
	mac.Write([]byte(encodedBody))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}
