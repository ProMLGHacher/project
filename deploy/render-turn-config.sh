#!/bin/sh
set -eu

cat > /tmp/turnserver.conf <<EOF
lt-cred-mech
user=${TURN_USERNAME}:${TURN_PASSWORD}
realm=${TURN_REALM}
server-name=voice-local-turn
fingerprint
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
relay-ip=0.0.0.0
min-port=${TURN_RELAY_PORT_MIN}
max-port=${TURN_RELAY_PORT_MAX}
external-ip=${TURN_EXTERNAL_IP}
no-multicast-peers
no-cli
no-loopback-peers
total-quota=100
bps-capacity=0
stale-nonce=600
cert=/etc/ssl/certs/ssl-cert-snakeoil.pem
pkey=/etc/ssl/private/ssl-cert-snakeoil.key
EOF

exec turnserver --log-file=stdout -c /tmp/turnserver.conf
