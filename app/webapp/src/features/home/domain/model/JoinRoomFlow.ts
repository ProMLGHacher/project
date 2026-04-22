export type JoinRoomFlowParams = {
  roomId: string
}

export type JoinRoomFlowResult = {
  roomId: string
}

export type JoinRoomFlowError = { type: 'unknown-error' } | { type: 'room-not-found' }
