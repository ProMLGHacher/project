package protocol

import (
	"encoding/json"

	"github.com/araik/codex-webrtc/project/backend/internal/domain"
	"github.com/pion/webrtc/v4"
)

const (
	TypeRoomSnapshot        = "room.snapshot"
	TypeParticipantJoined   = "participant.joined"
	TypeParticipantLeft     = "participant.left"
	TypeParticipantUpdated  = "participant.updated"
	TypeError               = "error"
	TypeHeartbeatPing       = "heartbeat.ping"
	TypeHeartbeatPong       = "heartbeat.pong"
	TypePublisherOffer      = "publisher.offer"
	TypePublisherAnswer     = "publisher.answer"
	TypeSubscriberOffer     = "subscriber.offer"
	TypeSubscriberAnswer    = "subscriber.answer"
	TypeTrickleCandidate    = "trickle.candidate"
	TypeMediaSlotUpdated    = "media.slot.updated"
	TypeIceRestartRequested = "ice.restart.requested"
	TypeIceRestartCompleted = "ice.restart.completed"
)

type Envelope struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type RoomSnapshotPayload struct {
	Snapshot domain.RoomSnapshot `json:"snapshot"`
}

type ParticipantPayload struct {
	Participant domain.ParticipantState `json:"participant"`
}

type SessionDescriptionPayload struct {
	Peer        string                    `json:"peer"`
	Description webrtc.SessionDescription `json:"description"`
}

type CandidatePayload struct {
	Peer      string                  `json:"peer"`
	Candidate webrtc.ICECandidateInit `json:"candidate"`
}

type SlotUpdatedPayload struct {
	ParticipantID string          `json:"participantId"`
	Kind          domain.SlotKind `json:"kind"`
	Enabled       bool            `json:"enabled"`
	Publishing    bool            `json:"publishing"`
	TrackBound    bool            `json:"trackBound"`
}

type IceRestartPayload struct {
	Peer string `json:"peer"`
}

type ErrorPayload struct {
	Message string `json:"message"`
}

type HeartbeatPayload struct {
	Timestamp int64 `json:"timestamp"`
}

func MustEnvelope(messageType string, payload any) Envelope {
	body, err := json.Marshal(payload)
	if err != nil {
		panic(err)
	}

	return Envelope{
		Type:    messageType,
		Payload: body,
	}
}
