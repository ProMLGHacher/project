package application

import (
	"context"
	"time"

	"github.com/araik/codex-webrtc/project/backend/internal/domain"
)

type Clock interface {
	Now() time.Time
}

type IDGenerator interface {
	NewID() string
}

type RoomRepository interface {
	Save(context.Context, *domain.Room) error
	FindByID(context.Context, string) (*domain.Room, error)
}

type SessionRepository interface {
	Save(context.Context, *domain.PeerSession) error
	FindByID(context.Context, string) (*domain.PeerSession, error)
}

type InviteService interface {
	CreateToken(roomID string, role domain.ParticipantRole) (string, error)
	ParseToken(token string) (InviteClaims, error)
}

type InviteClaims struct {
	RoomID    string
	Role      domain.ParticipantRole
	ExpiresAt time.Time
}

type PrejoinPreferences struct {
	DisplayName   string `json:"displayName"`
	MicEnabled    bool   `json:"micEnabled"`
	CameraEnabled bool   `json:"cameraEnabled"`
}

type ICEConfig struct {
	URLs       []string `json:"urls"`
	Username   string   `json:"username,omitempty"`
	Credential string   `json:"credential,omitempty"`
}

type JoinResult struct {
	SessionID     string                 `json:"sessionId"`
	ParticipantID string                 `json:"participantId"`
	RoomID        string                 `json:"roomId"`
	Role          domain.ParticipantRole `json:"role"`
	WSURL         string                 `json:"wsUrl"`
	ICEServers    []ICEConfig            `json:"iceServers"`
	Snapshot      domain.RoomSnapshot    `json:"snapshot"`
}
