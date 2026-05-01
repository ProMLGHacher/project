package httpadapter

import (
	"encoding/json"
	"net/http"
)

func (s *Server) handleOpenAPI(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(openAPISpec)
}

func (s *Server) handleSwagger(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(swaggerHTML)
}

var openAPISpec = mustMarshalOpenAPI(map[string]any{
	"openapi": "3.1.0",
	"info": map[string]any{
		"title":       "Kvatum Conference API",
		"version":     "0.1.0",
		"description": "HTTP API for product room bootstrap. Realtime signaling and media routing are handled by RMS (Realtime Media Service) through the browser SDK.",
		"contact": map[string]any{
			"name": "Kvatum backend",
		},
	},
	"servers": []any{
		map[string]any{
			"url":         "/",
			"description": "Same origin gateway. In production this is served through nginx on the public domain.",
		},
		map[string]any{
			"url":         "https://kvt.araik.dev",
			"description": "Production gateway domain.",
		},
		map[string]any{
			"url":         "http://localhost:8023",
			"description": "Local docker compose gateway.",
		},
	},
	"tags": []any{
		map[string]any{"name": "System", "description": "Health and API documentation endpoints."},
		map[string]any{"name": "Rooms", "description": "Room creation, metadata, and join bootstrap flow."},
		map[string]any{"name": "Invites", "description": "Legacy signed invite-token flow kept for compatibility."},
		map[string]any{"name": "Signaling", "description": "WebSocket signaling contract used after REST join."},
	},
	"paths": map[string]any{
		"/healthz": map[string]any{
			"get": map[string]any{
				"tags":        []any{"System"},
				"summary":     "Backend health check",
				"description": "Returns a small JSON payload when the backend process is alive. This endpoint does not verify TURN reachability or active media sessions.",
				"operationId": "getHealth",
				"responses": map[string]any{
					"200": response("Backend is healthy.", "#/components/schemas/HealthResponse"),
				},
			},
		},
		"/api/swagger": map[string]any{
			"get": map[string]any{
				"tags":        []any{"System"},
				"summary":     "Swagger UI",
				"description": "Interactive API documentation page. The page loads this service's OpenAPI document from /api/openapi.json.",
				"operationId": "getSwaggerUI",
				"responses": map[string]any{
					"200": map[string]any{
						"description": "HTML Swagger UI page.",
						"content": map[string]any{
							"text/html": map[string]any{
								"schema": map[string]any{"type": "string"},
							},
						},
					},
				},
			},
		},
		"/api/openapi.json": map[string]any{
			"get": map[string]any{
				"tags":        []any{"System"},
				"summary":     "OpenAPI JSON document",
				"description": "Machine-readable OpenAPI 3.1 specification for REST endpoints and the WebSocket signaling message schema.",
				"operationId": "getOpenAPI",
				"responses": map[string]any{
					"200": response("OpenAPI document.", "#/components/schemas/OpenAPIDocument"),
				},
			},
		},
		"/api/rooms": map[string]any{
			"post": map[string]any{
				"tags":        []any{"Rooms"},
				"summary":     "Create a room",
				"description": "Creates an in-memory conference room and returns a short human-readable room id such as river-sky-42. The room initially contains a host placeholder. The browser should then navigate to /rooms/{roomId} and call POST /api/rooms/{roomId}/join with prejoin preferences.",
				"operationId": "createRoom",
				"responses": map[string]any{
					"201": response("Room created.", "#/components/schemas/CreateRoomResponse"),
					"500": errorResponse("Room could not be created."),
				},
			},
		},
		"/api/rooms/{roomId}": map[string]any{
			"get": map[string]any{
				"tags":        []any{"Rooms"},
				"summary":     "Get room metadata",
				"description": "Returns lightweight prejoin metadata for a room. This endpoint is safe to call before camera/microphone permissions are requested. It does not create a participant session.",
				"operationId": "getRoomMetadata",
				"parameters":  []any{roomIDParameter()},
				"responses": map[string]any{
					"200": response("Room metadata.", "#/components/schemas/RoomMetadata"),
					"404": errorResponse("Room id was not found."),
					"500": errorResponse("Room metadata could not be loaded."),
				},
			},
		},
		"/api/rooms/{roomId}/join": map[string]any{
			"post": map[string]any{
				"tags":        []any{"Rooms"},
				"summary":     "Join a room by id",
				"description": "Creates or refreshes a participant session for the given room id and returns RMS bootstrap data: joinToken, rmsUrl, ICE server configuration, participant id, role, and current room snapshot. The browser SDK opens /v1/connect on RMS with the returned joinToken.",
				"operationId": "joinRoomByID",
				"parameters":  []any{roomIDParameter()},
				"requestBody": map[string]any{
					"required": true,
					"content": map[string]any{
						"application/json": map[string]any{
							"schema": ref("#/components/schemas/PrejoinPreferences"),
							"examples": map[string]any{
								"micOnly": map[string]any{
									"summary": "Join with microphone enabled and camera disabled.",
									"value": map[string]any{
										"displayName":   "Araik",
										"micEnabled":    true,
										"cameraEnabled": false,
									},
								},
								"cameraOn": map[string]any{
									"summary": "Join with microphone and camera enabled.",
									"value": map[string]any{
										"displayName":   "Guest",
										"micEnabled":    true,
										"cameraEnabled": true,
										"role":          "participant",
									},
								},
							},
						},
					},
				},
				"responses": map[string]any{
					"200": response("Join bootstrap data.", "#/components/schemas/JoinResponse"),
					"400": errorResponse("Request JSON is invalid."),
					"404": errorResponse("Room id was not found."),
					"500": errorResponse("Join failed."),
				},
			},
		},
		"/api/rooms/{roomId}/chat/session": map[string]any{
			"post": map[string]any{
				"tags":        []any{"Rooms"},
				"summary":     "Create a chat-only room session",
				"description": "Creates a Chat Service session for the room without creating an RMS participant/session. This is used by the home recent chat drawer, where opening chat must not add a conference participant.",
				"operationId": "createRoomChatSession",
				"parameters":  []any{roomIDParameter()},
				"requestBody": map[string]any{
					"required": true,
					"content": map[string]any{
						"application/json": map[string]any{
							"schema": ref("#/components/schemas/ChatSessionRequest"),
							"examples": map[string]any{
								"default": map[string]any{
									"summary": "Open room chat from outside the conference.",
									"value": map[string]any{
										"displayName": "Araik",
										"role":        "participant",
									},
								},
							},
						},
					},
				},
				"responses": map[string]any{
					"200": response("Chat-only bootstrap data.", "#/components/schemas/ChatSessionResponse"),
					"400": errorResponse("Request JSON is invalid."),
					"404": errorResponse("Room id was not found."),
					"502": errorResponse("Chat Service session could not be created."),
					"503": errorResponse("Chat Service is not configured."),
				},
			},
		},
		"/api/invites/{token}": map[string]any{
			"get": map[string]any{
				"tags":        []any{"Invites"},
				"summary":     "Read invite metadata",
				"description": "Compatibility endpoint for signed invite tokens. New user flows should prefer room-id links and /api/rooms/{roomId}/join.",
				"operationId": "getInviteMetadata",
				"parameters":  []any{inviteTokenParameter()},
				"responses": map[string]any{
					"200": response("Invite claims.", "#/components/schemas/InviteClaims"),
					"400": errorResponse("Invite token is malformed, expired, or invalid."),
				},
			},
		},
		"/api/invites/{token}/join": map[string]any{
			"post": map[string]any{
				"tags":        []any{"Invites"},
				"summary":     "Join a room by signed invite token",
				"description": "Compatibility endpoint that parses a signed invite token, then returns the same join bootstrap payload as room-id join.",
				"operationId": "joinRoomByInvite",
				"parameters":  []any{inviteTokenParameter()},
				"requestBody": map[string]any{
					"required": true,
					"content": map[string]any{
						"application/json": map[string]any{
							"schema": ref("#/components/schemas/PrejoinPreferences"),
						},
					},
				},
				"responses": map[string]any{
					"200": response("Join bootstrap data.", "#/components/schemas/JoinResponse"),
					"400": errorResponse("Request JSON or invite token is invalid."),
					"404": errorResponse("Invite points to a missing room."),
					"500": errorResponse("Join failed."),
				},
			},
		},
		"/v1/connect": map[string]any{
			"get": map[string]any{
				"tags":        []any{"Signaling"},
				"summary":     "Open RMS signaling WebSocket",
				"description": "Upgrades to a WebSocket signaling session. Clients pass the server-issued joinToken as a query parameter. JSON messages use the SignalEnvelope schema. This socket does not carry media; it carries room snapshots, SDP offers/answers, ICE candidates, heartbeat ping/pong, slot state updates, and ICE restart requests.",
				"operationId": "openRmsSignalingWebSocket",
				"parameters": []any{
					map[string]any{
						"name":        "token",
						"in":          "query",
						"required":    true,
						"description": "Short-lived RMS join token returned by a successful join call.",
						"schema":      map[string]any{"type": "string"},
						"example":     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
					},
				},
				"responses": map[string]any{
					"101": map[string]any{"description": "WebSocket upgrade accepted."},
					"400": errorResponse("Missing sessionId."),
				},
			},
		},
	},
	"components": map[string]any{
		"schemas": schemas(),
	},
})

var swaggerHTML = []byte(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Kvatum API Swagger</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; background: #f8fafc; }
    .topbar { display: none; }
    .swagger-ui .info .title { font-family: ui-sans-serif, system-ui, sans-serif; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle({
        url: "/api/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        displayRequestDuration: true,
        persistAuthorization: true,
        tryItOutEnabled: true
      });
    };
  </script>
</body>
</html>`)

func mustMarshalOpenAPI(value any) []byte {
	body, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		panic(err)
	}
	return body
}

func roomIDParameter() map[string]any {
	return map[string]any{
		"name":        "roomId",
		"in":          "path",
		"required":    true,
		"description": "Short human-readable room id generated by POST /api/rooms.",
		"schema": map[string]any{
			"type":    "string",
			"pattern": "^[a-z]+-[a-z]+-[0-9]{2}$",
		},
		"example": "river-sky-42",
	}
}

func inviteTokenParameter() map[string]any {
	return map[string]any{
		"name":        "token",
		"in":          "path",
		"required":    true,
		"description": "Signed invite token. This flow is legacy-compatible; new clients should use room ids directly.",
		"schema":      map[string]any{"type": "string"},
	}
}

func response(description, schemaRef string) map[string]any {
	return map[string]any{
		"description": description,
		"content": map[string]any{
			"application/json": map[string]any{
				"schema": ref(schemaRef),
			},
		},
	}
}

func errorResponse(description string) map[string]any {
	return map[string]any{
		"description": description,
		"content": map[string]any{
			"application/json": map[string]any{
				"schema": ref("#/components/schemas/ErrorResponse"),
			},
		},
	}
}

func ref(schemaRef string) map[string]any {
	return map[string]any{"$ref": schemaRef}
}

func schemas() map[string]any {
	return map[string]any{
		"OpenAPIDocument": map[string]any{
			"type":        "object",
			"description": "OpenAPI document object.",
		},
		"HealthResponse": map[string]any{
			"type":                 "object",
			"additionalProperties": false,
			"required":             []any{"status"},
			"properties": map[string]any{
				"status": map[string]any{
					"type":        "string",
					"description": "Health status.",
					"enum":        []any{"ok"},
					"example":     "ok",
				},
			},
		},
		"ErrorResponse": map[string]any{
			"type":                 "object",
			"additionalProperties": false,
			"required":             []any{"error"},
			"properties": map[string]any{
				"error": map[string]any{
					"type":        "string",
					"description": "Human-readable error message.",
					"example":     "room not found",
				},
			},
		},
		"CreateRoomResponse": map[string]any{
			"type":                 "object",
			"additionalProperties": false,
			"required":             []any{"roomId"},
			"properties": map[string]any{
				"roomId": map[string]any{
					"type":        "string",
					"description": "Short room id used in user-facing room URLs and REST paths.",
					"pattern":     "^[a-z]+-[a-z]+-[0-9]{2}$",
					"example":     "clear-sun-37",
				},
			},
		},
		"PrejoinPreferences": map[string]any{
			"type":                 "object",
			"additionalProperties": false,
			"required":             []any{"displayName", "micEnabled", "cameraEnabled"},
			"properties": map[string]any{
				"displayName": map[string]any{
					"type":        "string",
					"description": "Name shown to other participants in the room.",
					"minLength":   1,
					"maxLength":   80,
					"example":     "Araik",
				},
				"micEnabled": map[string]any{
					"type":        "boolean",
					"description": "Initial microphone preference. When true, the client publishes the audio slot after joining.",
					"example":     true,
				},
				"cameraEnabled": map[string]any{
					"type":        "boolean",
					"description": "Initial camera preference. Camera can later be toggled by replacing the reserved camera sender track without closing the publisher connection.",
					"example":     false,
				},
				"role": map[string]any{
					"type":        "string",
					"description": "Optional requested role for direct room-id join. The host role is mainly used by room creation flows.",
					"enum":        []any{"host", "participant"},
					"default":     "participant",
					"example":     "participant",
				},
			},
		},
		"ChatSessionRequest": map[string]any{
			"type":                 "object",
			"additionalProperties": false,
			"required":             []any{"displayName"},
			"properties": map[string]any{
				"displayName": map[string]any{
					"type":        "string",
					"description": "Name used for this chat session.",
					"minLength":   1,
					"maxLength":   80,
					"example":     "Araik",
				},
				"role": map[string]any{
					"type":        "string",
					"description": "Optional chat role requested by the product app.",
					"enum":        []any{"host", "participant"},
					"default":     "participant",
					"example":     "participant",
				},
			},
		},
		"RoomMetadata": map[string]any{
			"type":                 "object",
			"additionalProperties": false,
			"required":             []any{"roomId", "hostParticipantId", "participantCount", "roles"},
			"properties": map[string]any{
				"roomId":            stringSchema("Room id.", "clear-sun-37"),
				"hostParticipantId": stringSchema("Current host participant id.", "f9d1b482-5a36-45c3-b203-ac42c1e47261"),
				"participantCount": map[string]any{
					"type":        "integer",
					"minimum":     0,
					"description": "Number of participants currently tracked in the room snapshot.",
					"example":     2,
				},
				"roles": map[string]any{
					"type":        "array",
					"description": "Roles currently present in the room.",
					"items":       ref("#/components/schemas/ParticipantRole"),
					"example":     []any{"host", "participant"},
				},
			},
		},
		"ParticipantRole": map[string]any{
			"type":        "string",
			"description": "Participant role in a room.",
			"enum":        []any{"host", "participant"},
		},
		"SlotKind": map[string]any{
			"type":        "string",
			"description": "Stable logical media slot. Slot identity is participantId + kind, not raw WebRTC track id.",
			"enum":        []any{"audio", "camera", "screen", "screenAudio"},
		},
		"SlotState": map[string]any{
			"type":                 "object",
			"additionalProperties": false,
			"required":             []any{"kind", "enabled", "publishing", "trackBound", "revision"},
			"properties": map[string]any{
				"kind":       ref("#/components/schemas/SlotKind"),
				"enabled":    booleanSchema("Whether the participant wants this slot enabled in UI state.", true),
				"publishing": booleanSchema("Whether the client says it is publishing media for this slot.", true),
				"trackBound": booleanSchema("Whether a local MediaStreamTrack is currently bound to the reserved sender.", true),
				"revision": map[string]any{
					"type":        "integer",
					"minimum":     1,
					"description": "Monotonic slot state revision used by clients to reason about updates.",
					"example":     3,
				},
			},
		},
		"ParticipantState": map[string]any{
			"type":                 "object",
			"additionalProperties": false,
			"required":             []any{"id", "displayName", "role", "slots"},
			"properties": map[string]any{
				"id":          stringSchema("Stable participant id for the active session.", "feb454a0-15cb-45ce-b0d5-e6c1b89c8841"),
				"displayName": stringSchema("Display name shown in the room.", "Mobile"),
				"role":        ref("#/components/schemas/ParticipantRole"),
				"slots": map[string]any{
					"type":        "array",
					"description": "Stable media slots. The backend always models microphone, camera, screen video, and screen audio slots.",
					"items":       ref("#/components/schemas/SlotState"),
				},
			},
		},
		"RoomSnapshot": map[string]any{
			"type":                 "object",
			"additionalProperties": false,
			"required":             []any{"roomId", "hostParticipantId", "participants"},
			"properties": map[string]any{
				"roomId":            stringSchema("Room id.", "clear-sun-37"),
				"hostParticipantId": stringSchema("Host participant id.", "f9d1b482-5a36-45c3-b203-ac42c1e47261"),
				"participants": map[string]any{
					"type":        "array",
					"description": "Ordered participant states. Host is sorted first, then participants by id.",
					"items":       ref("#/components/schemas/ParticipantState"),
				},
			},
		},
		"ICEServerConfig": map[string]any{
			"type":                 "object",
			"additionalProperties": false,
			"required":             []any{"urls"},
			"properties": map[string]any{
				"urls": map[string]any{
					"type":        "array",
					"description": "STUN/TURN URLs passed directly to RTCPeerConnection.",
					"items":       map[string]any{"type": "string"},
					"example":     []any{"turn:kvt.araik.dev:3478?transport=udp"},
				},
				"username":   stringSchema("TURN username when required.", "voice"),
				"credential": stringSchema("TURN password or credential when required.", "secret"),
			},
		},
		"JoinResponse": map[string]any{
			"type":                 "object",
			"additionalProperties": false,
			"required":             []any{"sessionId", "participantId", "roomId", "role", "wsUrl", "rmsUrl", "joinToken", "iceServers", "snapshot"},
			"properties": map[string]any{
				"sessionId":     stringSchema("Opaque realtime session id.", "6c0656f5-50fd-4366-b2b6-394a52ca071f"),
				"participantId": stringSchema("Participant id assigned to this session.", "feb454a0-15cb-45ce-b0d5-e6c1b89c8841"),
				"roomId":        stringSchema("Room id that was joined.", "clear-sun-37"),
				"role":          ref("#/components/schemas/ParticipantRole"),
				"wsUrl": map[string]any{
					"type":        "string",
					"description": "Legacy signaling URL kept for backward compatibility. New clients should use rmsUrl + joinToken through the RMS SDK.",
					"example":     "wss://kvatum.ru/v1/connect?token=...",
				},
				"rmsUrl": map[string]any{
					"type":        "string",
					"description": "Public RMS base URL used by the browser SDK.",
					"example":     "https://kvatum.ru",
				},
				"joinToken": map[string]any{
					"type":        "string",
					"description": "Short-lived server-issued token used to connect to RMS.",
					"example":     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
				},
				"iceServers": map[string]any{
					"type":        "array",
					"description": "ICE servers for publisher/subscriber RTCPeerConnections.",
					"items":       ref("#/components/schemas/ICEServerConfig"),
				},
				"snapshot": ref("#/components/schemas/RoomSnapshot"),
			},
		},
		"ChatSessionResponse": map[string]any{
			"type":                 "object",
			"additionalProperties": false,
			"required":             []any{"chatUrl", "chatToken", "chatSpaceId", "chatChannelId", "participantId"},
			"description":          "Chat-only bootstrap payload. It intentionally does not contain RMS joinToken/wsUrl/iceServers, because this flow must not join the conference media room.",
			"properties": map[string]any{
				"chatUrl":       stringSchema("Public Chat Service base URL.", "https://kvatum.ru"),
				"chatToken":     stringSchema("Short-lived server-issued token used to connect to Chat Service.", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."),
				"chatSpaceId":   stringSchema("Chat space id mapped to the product room.", "clear-sun-37"),
				"chatChannelId": stringSchema("Conference chat channel id.", "clear-sun-37:conference"),
				"participantId": stringSchema("Chat-only participant id. This id is not an RMS conference participant.", "chat-6c0656f5-50fd-4366-b2b6-394a52ca071f"),
			},
		},
		"InviteClaims": map[string]any{
			"type":                 "object",
			"additionalProperties": false,
			"required":             []any{"RoomID", "Role", "ExpiresAt"},
			"description":          "Legacy Go-encoded invite claims. Field names currently match backend struct names.",
			"properties": map[string]any{
				"RoomID":    stringSchema("Room id encoded in the invite token.", "clear-sun-37"),
				"Role":      ref("#/components/schemas/ParticipantRole"),
				"ExpiresAt": stringSchema("Invite expiration timestamp.", "2026-04-21T12:00:00Z"),
			},
		},
		"SignalEnvelope": map[string]any{
			"type":                 "object",
			"additionalProperties": false,
			"required":             []any{"type"},
			"description":          "Every WebSocket signaling message is a JSON envelope with a type and optional payload. See the specific payload schemas for each type.",
			"properties": map[string]any{
				"type": map[string]any{
					"type":        "string",
					"description": "Message type.",
					"enum": []any{
						"room.snapshot",
						"participant.joined",
						"participant.left",
						"participant.updated",
						"error",
						"heartbeat.ping",
						"heartbeat.pong",
						"publisher.offer",
						"publisher.answer",
						"subscriber.offer",
						"subscriber.answer",
						"trickle.candidate",
						"media.slot.updated",
						"ice.restart.requested",
						"ice.restart.completed",
					},
				},
				"payload": map[string]any{
					"description": "Message-specific payload. Empty object is valid for participant.left.",
					"oneOf": []any{
						ref("#/components/schemas/RoomSnapshotPayload"),
						ref("#/components/schemas/SessionDescriptionPayload"),
						ref("#/components/schemas/CandidatePayload"),
						ref("#/components/schemas/SlotUpdatedPayload"),
						ref("#/components/schemas/IceRestartPayload"),
						ref("#/components/schemas/HeartbeatPayload"),
						ref("#/components/schemas/ErrorPayload"),
					},
				},
			},
		},
		"RoomSnapshotPayload": map[string]any{
			"type":       "object",
			"required":   []any{"snapshot"},
			"properties": map[string]any{"snapshot": ref("#/components/schemas/RoomSnapshot")},
		},
		"SessionDescriptionPayload": map[string]any{
			"type":       "object",
			"required":   []any{"peer", "description"},
			"properties": map[string]any{"peer": ref("#/components/schemas/PeerKind"), "description": ref("#/components/schemas/RTCSessionDescription")},
		},
		"CandidatePayload": map[string]any{
			"type":       "object",
			"required":   []any{"peer", "candidate"},
			"properties": map[string]any{"peer": ref("#/components/schemas/PeerKind"), "candidate": ref("#/components/schemas/RTCIceCandidateInit")},
		},
		"SlotUpdatedPayload": map[string]any{
			"type":       "object",
			"required":   []any{"participantId", "kind", "enabled", "publishing", "trackBound"},
			"properties": map[string]any{"participantId": stringSchema("Participant id or local placeholder on outbound client messages.", "local"), "kind": ref("#/components/schemas/SlotKind"), "enabled": booleanSchema("Slot enabled state.", true), "publishing": booleanSchema("Slot publishing state.", true), "trackBound": booleanSchema("Whether a track is bound.", true)},
		},
		"IceRestartPayload": map[string]any{
			"type":       "object",
			"required":   []any{"peer"},
			"properties": map[string]any{"peer": ref("#/components/schemas/PeerKind")},
		},
		"HeartbeatPayload": map[string]any{
			"type":       "object",
			"required":   []any{"timestamp"},
			"properties": map[string]any{"timestamp": map[string]any{"type": "integer", "format": "int64", "description": "Client timestamp echoed by heartbeat.pong.", "example": 1776617076217}},
		},
		"ErrorPayload": map[string]any{
			"type":       "object",
			"required":   []any{"message"},
			"properties": map[string]any{"message": stringSchema("Error message.", "missing sessionId")},
		},
		"PeerKind": map[string]any{
			"type":        "string",
			"description": "Local peer connection side.",
			"enum":        []any{"publisher", "subscriber"},
		},
		"RTCSessionDescription": map[string]any{
			"type":                 "object",
			"additionalProperties": true,
			"required":             []any{"type", "sdp"},
			"description":          "Browser RTCPeerConnection session description.",
			"properties": map[string]any{
				"type": map[string]any{"type": "string", "enum": []any{"offer", "answer", "pranswer", "rollback"}},
				"sdp":  stringSchema("Raw SDP text.", "v=0\\r\\n..."),
			},
		},
		"RTCIceCandidateInit": map[string]any{
			"type":                 "object",
			"additionalProperties": true,
			"required":             []any{"candidate"},
			"description":          "Browser RTCIceCandidateInit payload from candidate.toJSON().",
			"properties": map[string]any{
				"candidate":        stringSchema("Raw ICE candidate line.", "candidate:3318510753 1 udp 58597631 85.192.132.222 49192 typ relay ..."),
				"sdpMid":           stringSchema("Media section id.", "0"),
				"sdpMLineIndex":    map[string]any{"type": "integer", "minimum": 0, "example": 0},
				"usernameFragment": stringSchema("ICE username fragment.", "Dwfh"),
			},
		},
	}
}

func stringSchema(description, example string) map[string]any {
	return map[string]any{
		"type":        "string",
		"description": description,
		"example":     example,
	}
}

func booleanSchema(description string, example bool) map[string]any {
	return map[string]any{
		"type":        "boolean",
		"description": description,
		"example":     example,
	}
}
