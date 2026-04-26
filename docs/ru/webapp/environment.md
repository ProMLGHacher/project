# Environment variables

Переменные окружения настраиваются отдельно для каждого контура:

- `deploy/.env.dev` - готовое localhost-окружение для разработки.
- `deploy/.env` - production/server окружение.

Для локальной разработки обычно ничего создавать не нужно, потому что `deploy/.env.dev` уже
подготовлен.

Для server/prod-настройки начни с:

```bash
cd deploy
cp .env.example .env
```

Не коммить реальные production values.

## Gateway

| Variable          | Example               | Описание                                                                                         |
| ----------------- | --------------------- | ------------------------------------------------------------------------------------------------ |
| `GATEWAY_PORT`    | `8023`                | Host port, который публикует nginx gateway. External proxy должен проксировать HTTP сюда.        |
| `PUBLIC_BASE_URL` | `https://example.com` | Public URL, который backend использует для room links. Должен совпадать с browser-facing origin. |
| `PUBLIC_HOST`     | `example.com`         | Human-readable host для deploy/config conventions. Держи в sync с public host.                   |

## Backend HTTP

| Variable        | Example      | Описание                                                                                 |
| --------------- | ------------ | ---------------------------------------------------------------------------------------- |
| `HTTP_ADDR`     | `:8080`      | Address backend внутри Docker network. Обычно не меняется.                               |
| `INVITE_SECRET` | `replace-me` | HMAC secret для signed invite/session-related данных. В production нужен сильный secret. |

## SFU ICE

| Variable           | Example        | Описание                                                                          |
| ------------------ | -------------- | --------------------------------------------------------------------------------- |
| `ICE_PUBLIC_IP`    | `203.0.113.10` | Public IP, который SFU объявляет в ICE candidates. Должен быть доступен клиентам. |
| `ICE_UDP_PORT_MIN` | `50000`        | Первый UDP port для backend WebRTC media.                                         |
| `ICE_UDP_PORT_MAX` | `50100`        | Последний UDP port для backend WebRTC media.                                      |

Диапазон портов должен совпадать с Docker Compose published ports и firewall rules.

## TURN

| Variable              | Example                                | Описание                                            |
| --------------------- | -------------------------------------- | --------------------------------------------------- |
| `TURN_URL`            | `turn:203.0.113.10:3478?transport=udp` | TURN URL для UDP relay, отправляется клиентам.      |
| `TURN_TLS_URL`        | `turns:example.com:5349?transport=tcp` | TURN TLS/TCP fallback URL, отправляется клиентам.   |
| `TURN_USERNAME`       | `voice`                                | TURN username для клиентов.                         |
| `TURN_PASSWORD`       | `replace-me`                           | TURN credential. В production нужен сильный secret. |
| `TURN_REALM`          | `voice.example.com`                    | coturn realm. Обычно product domain.                |
| `TURN_EXTERNAL_IP`    | `203.0.113.10`                         | Public IP, который coturn advertises клиентам.      |
| `TURN_PORT`           | `3478`                                 | Host port для TURN UDP/TCP.                         |
| `TURN_TLS_PORT`       | `5349`                                 | Host port для TURN TLS/TCP fallback.                |
| `TURN_RELAY_PORT_MIN` | `49160`                                | Первый TURN relay UDP port.                         |
| `TURN_RELAY_PORT_MAX` | `49200`                                | Последний TURN relay UDP port.                      |

В production firewall должен разрешать:

- gateway TCP port, обычно за external HTTPS proxy;
- TURN UDP/TCP port;
- TURN TLS/TCP port;
- TURN relay UDP range;
- backend ICE UDP range.

## Frontend build

| Variable                | Example                           | Описание                                                                                 |
| ----------------------- | --------------------------------- | ---------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`     | empty                             | Обычно пустой, потому что nginx отдаёт frontend и проксирует `/api` и `/ws` same-origin. |
| `VITE_ALLOWED_HOSTS`    | `localhost,127.0.0.1,example.com` | Hosts, разрешённые Vite dev server. Используется для local development.                  |
| `VITE_API_PROXY_TARGET` | `http://localhost:8023`           | Target, который Vite использует, если фронт запускается напрямую в dev-режиме вне nginx. |

Production Docker build отдаёт static files через nginx, поэтому runtime API access должен
оставаться same-origin.

## Локальная сеть

Для тестирования с телефона в LAN замени host/IP values на LAN address машины:

```text
PUBLIC_BASE_URL=http://192.168.1.10:8023
ICE_PUBLIC_IP=192.168.1.10
TURN_URL=turn:192.168.1.10:3478?transport=udp
TURN_TLS_URL=turns:192.168.1.10:5349?transport=tcp
TURN_EXTERNAL_IP=192.168.1.10
```

Браузеры могут ограничивать camera/microphone на non-HTTPS origins вне `localhost`. Для реальной
remote-проверки лучше использовать HTTPS domain.
