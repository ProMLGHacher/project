export type RoomExistsByIdParams = {
  roomId: string
}

export type RoomExistsByIdResult = {
  exists: boolean
}

export type RoomExistsByIdError = { type: 'unknown-error' }
