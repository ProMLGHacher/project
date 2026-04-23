# Webapp Business Architecture

This app follows feature-oriented clean architecture. The `app/webapp` layer is the product client for the voice-first conference experience, with explicit feature and capability boundaries.

## Layers

- `app` owns composition: router, providers, DI modules, app bootstrap and feature loading.
- `core` owns only technical primitives: design system, logger, http/config utilities, formatting helpers and generic errors.
- `features` own user flows: home, prejoin and room.
- `capabilities` own reusable application subsystems: media, rtc, user preferences, saved join session, clipboard and client logs.
- `data/infra` will later own concrete browser/network/localStorage/WebRTC implementations. This pass intentionally defines contracts and business rules first.

## Dependency Rules

- Features may depend on their own domain and on capability/domain contracts.
- A feature may depend on another feature domain only when that feature owns the business concept. For example, `home` and `prejoin` use `room/domain` use cases instead of redefining room models.
- Capabilities must not depend on features.
- `core` must not contain room, rtc, media, preference or user-flow business language.
- ViewModels coordinate UI state and navigation effects, but raw browser APIs belong in capability data/infra implementations.

## Feature: Home

The home feature is the entry point. It describes two business actions:

- Create a new room and navigate to its prejoin/room flow.
- Accept either a short room id or a full room link, normalize it, verify that the room exists and continue the join flow.

Owned models and use cases:

- `CreateRoomFlowUseCase` wraps room creation as a home user flow.
- `ValidateRoomIdInputUseCase` extracts and validates room ids from user input.
- `JoinRoomFlowUseCase` checks room existence and returns the normalized `roomId`.

Home does not own room persistence, room joining or media permissions.

## Feature: Prejoin

The prejoin feature prepares a person before entering a room. It coordinates room metadata, local media preview and saved user preferences.

Business responsibilities:

- Load room metadata and saved preferences.
- Prepare the display name, microphone state, camera state and selected devices.
- Start local preview before joining.
- Save display name and default media choices on successful join.
- Join the room and store the resulting session so a refresh can recover the current room.

Owned models and use cases:

- `LoadPrejoinContextUseCase` combines room metadata, media devices and saved preferences.
- `StartPrejoinPreviewUseCase` starts local preview from user-selected prejoin options.
- `JoinRoomFlowUseCase` performs the final join orchestration.

Prejoin is allowed to orchestrate multiple capabilities because it is a user flow. It still does not directly call `navigator.mediaDevices`, `localStorage` or REST clients.

## Feature: Room

The room feature owns the live conference screen and room-level user actions.

Business responsibilities:

- Show participants and stable media slots: audio, camera and screen.
- Keep microphone control voice-first: toggling mic changes enabled state, it does not recreate the session.
- Toggle camera and screen through RTC/media use cases without breaking the audio path.
- Copy a room link.
- Export/clear client logs for support.
- Leave the room by disconnecting RTC, stopping local preview and clearing the saved session.
- Show diagnostics only as presentation state, not as the default product experience.

Owned models and use cases:

- `RoomRepository` owns room creation, metadata lookup, existence checks and join handshake.
- `ObserveRoomSessionUseCase` exposes current RTC room state.
- `ToggleRoomMicrophoneUseCase`, `ToggleRoomCameraUseCase` and `ToggleRoomScreenShareUseCase` describe room controls.
- `BuildRoomLinkUseCase` and `CopyRoomLinkUseCase` describe link sharing without embedding clipboard APIs in UI.
- `LeaveRoomUseCase` describes the coordinated leave flow.

## Capability: Media

The media capability owns local device and preview rules.

Business responsibilities:

- List microphones and cameras.
- Request and maintain local preview state.
- Enable/disable microphone, camera and screen share.
- Keep noise suppression as an explicit user preference and media setting.

Media does not know about room navigation, room participants or signaling.

## Capability: RTC

The RTC capability owns WebRTC and signaling lifecycle at application level.

Business responsibilities:

- Connect to a room with one publisher and one subscriber session.
- Publish local audio/camera/screen slots.
- Observe remote participants and their slots.
- Disconnect gracefully.
- Decide whether degraded ICE state should wait, restart ICE, or fail.

RTC does not know how the room screen is laid out or how to show UI feedback.

## Capability: User Preferences

The user preferences capability owns local user defaults.

Business responsibilities:

- Persist display name.
- Persist preferred microphone and camera ids.
- Persist default mic/camera enabled state.

This is intentionally separate from `RoomRepository`; joining a room and remembering local UX choices are different business responsibilities.

## Capability: Session

The session capability owns refresh recovery for the current joined room.

Business responsibilities:

- Save the successful join session.
- Load the last session when the user opens `/rooms/:roomId` directly or refreshes the page.
- Clear the session on leave.

Session storage is a local app concern and is not part of the room backend contract.

## Capability: Clipboard

The clipboard capability owns write access to the browser clipboard.

Business responsibilities:

- Copy text from feature use cases.
- Normalize clipboard failures into domain-friendly errors.

Room link generation remains in `room/domain`; browser clipboard access remains in clipboard data/infra.

## Capability: Client Logs

The client logs capability owns support diagnostics collected on the device.

Business responsibilities:

- Append structured client events.
- Export logs as a text file payload.
- Clear local logs.

The room feature decides when to expose export/clear actions; the capability owns the reusable log storage contract.

## Main User Flows

### Create Room

1. Home calls `CreateRoomFlowUseCase`.
2. The flow delegates room creation to `CreateRoomUseCase`.
3. UI navigates to `/rooms/:roomId`.
4. Room page opens prejoin if there is no valid active session.

### Join Existing Room

1. Home accepts a room id or full room link.
2. `ValidateRoomIdInputUseCase` normalizes the input.
3. `RoomExistsByIdUseCase` verifies the room.
4. UI navigates to the room route and shows prejoin.

### Prejoin

1. `LoadPrejoinContextUseCase` loads room metadata, devices and preferences.
2. `StartPrejoinPreviewUseCase` starts preview with selected mic/camera settings.
3. User confirms join.
4. `JoinRoomFlowUseCase` validates display name, joins the room, saves preferences and stores the join session.

### Live Room

1. Room loads saved session or waits for prejoin completion.
2. RTC connects and publishes local media slots.
3. Participants are rendered from room snapshots and RTC slot state.
4. User actions call room use cases, not raw WebRTC/browser APIs.

### Leave Room

1. `LeaveRoomUseCase` disconnects RTC.
2. Local preview is stopped.
3. Saved join session is cleared.
4. UI navigates home.

## Not Implemented In This Pass

- Concrete REST repositories.
- Concrete WebSocket/WebRTC adapters.
- Concrete localStorage/clipboard/browser media adapters.
- Final ViewModel wiring for every screen.
- Replacement of the temporary chat demo route.

Those belong to the next implementation pass after the domain map is accepted.
