package domain

type NegotiationState string

const (
	NegotiationStable      NegotiationState = "stable"
	NegotiationLocalOffer  NegotiationState = "local-offer"
	NegotiationRemoteOffer NegotiationState = "remote-offer"
)

type IceHealth string

const (
	IceHealthNew          IceHealth = "new"
	IceHealthConnected    IceHealth = "connected"
	IceHealthDisconnected IceHealth = "disconnected"
	IceHealthRecovering   IceHealth = "recovering"
	IceHealthFailed       IceHealth = "failed"
)

type PeerSession struct {
	ID                  string
	RoomID              string
	ParticipantID       string
	PublisherState      NegotiationState
	SubscriberState     NegotiationState
	PublisherIceHealth  IceHealth
	SubscriberIceHealth IceHealth
}
