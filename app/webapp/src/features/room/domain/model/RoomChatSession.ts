export type CreateRoomChatSessionParams = {
  readonly roomId: string
  readonly displayName: string
}

export type RoomChatSessionResult = {
  readonly chatUrl: string
  readonly chatToken: string
  readonly chatSpaceId: string
  readonly chatChannelId: string
  readonly participantId: string
}

export type RoomChatSessionError = { readonly type: 'unknown-error' } | { readonly type: 'room-not-found' }
