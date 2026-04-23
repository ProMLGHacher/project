# Voice-First SFU Conference

Isolated greenfield workspace for a voice-first SFU conferencing stack.

## Layout

- `app/webapp` - React + TypeScript client with prejoin, room UI, and WebRTC orchestration.
- `app/kvt` - local KVT framework packages used by the client.
- `backend` - Go + Pion SFU, signaling, room management, and HTTP API.
- `deploy` - local development infrastructure for TURN and environment wiring.

## Local Commands

- `npm --prefix app install`
- `npm --prefix app run dev -w webapp`
- `npm run lint`
- `cd backend && go test ./...`

## Notes

- Runtime avoids WHIP/WHEP to preserve seamless mid-call renegotiation.
- Audio remains the highest-priority media path.
- The initial implementation is single-node and in-memory, with interfaces left open for Redis/Postgres later.
