# Voice-First SFU Conference

Isolated greenfield workspace for a voice-first SFU conferencing stack.

## Layout

- `web` - React + TypeScript client with prejoin, room UI, and WebRTC orchestration.
- `backend` - Go + Pion SFU, signaling, room management, and HTTP API.
- `deploy` - local development infrastructure for TURN and environment wiring.

## Local Commands

- `npm --prefix web install`
- `npm --prefix web run dev`
- `npm --prefix web run test`
- `cd backend && go test ./...`

## Notes

- Runtime avoids WHIP/WHEP to preserve seamless mid-call renegotiation.
- Audio remains the highest-priority media path.
- The initial implementation is single-node and in-memory, with interfaces left open for Redis/Postgres later.
