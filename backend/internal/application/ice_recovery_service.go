package application

import "github.com/araik/codex-webrtc/project/backend/internal/domain"

type IceRecoveryAction string

const (
	IceRecoveryNone       IceRecoveryAction = "none"
	IceRecoveryRestartICE IceRecoveryAction = "restart-ice"
	IceRecoveryFullRejoin IceRecoveryAction = "full-rejoin"
)

type IceRecoveryService struct{}

func NewIceRecoveryService() *IceRecoveryService {
	return &IceRecoveryService{}
}

func (s *IceRecoveryService) NextAction(health domain.IceHealth) IceRecoveryAction {
	switch health {
	case domain.IceHealthDisconnected, domain.IceHealthFailed:
		return IceRecoveryRestartICE
	case domain.IceHealthRecovering:
		return IceRecoveryFullRejoin
	default:
		return IceRecoveryNone
	}
}
