#!/usr/bin/env bash
# Smoke test de salud de la imagen Docker del frontend (la misma que va a ECS).
# Uso: scripts/smoke-image.sh <imagen>
# Verifica: nginx arranca SIN el contenedor app-pagos, /health, fallback SPA en deep links,
# JS comprimido y con caché inmutable, index.html sin caché y 404 para assets inexistentes.
set -euo pipefail

IMAGE="${1:?uso: $0 <imagen>}"
NAME="c360-smoke-$$"
PORT="${SMOKE_PORT:-8099}"
BASE="http://127.0.0.1:${PORT}"
fallas=0

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$NAME" -p "127.0.0.1:${PORT}:80" "$IMAGE" >/dev/null

for _ in $(seq 1 30); do
  curl -fsS "$BASE/health" >/dev/null 2>&1 && break
  sleep 1
done

check() {
  local desc="$1" esperado="$2" obtenido="$3"
  if [[ "$obtenido" == "$esperado" ]]; then
    echo "ok   - $desc"
  else
    echo "FAIL - $desc (esperado: '$esperado', obtenido: '$obtenido')"
    fallas=$((fallas + 1))
  fi
}

check "contenedor sigue corriendo" "true" "$(docker inspect -f '{{.State.Running}}' "$NAME")"
check "/health responde 200" "200" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/health")"
check "deep link /pedidos/7 sirve la SPA" "200" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/pedidos/7")"
check "index.html contiene <app-root>" "1" "$(curl -s "$BASE/pedidos/7" | grep -c '<app-root')"
check "index.html sin caché" "no-cache" \
  "$(curl -s -D - -o /dev/null "$BASE/" | tr -d '\r' | awk -F': ' 'tolower($1)=="cache-control"{print $2}')"

js="$(curl -s "$BASE/" | grep -oE 'main-[A-Za-z0-9]+\.js' | head -1)"
check "index.html referencia main-*.js" "1" "$([[ -n "$js" ]] && echo 1 || echo 0)"
headers="$(curl -s -D - -o /dev/null -H 'Accept-Encoding: gzip' "$BASE/$js" | tr -d '\r')"
check "JS comprimido con gzip" "gzip" "$(awk -F': ' 'tolower($1)=="content-encoding"{print $2}' <<<"$headers")"
check "JS con caché inmutable" "public, max-age=31536000, immutable" \
  "$(awk -F': ' 'tolower($1)=="cache-control"{print $2}' <<<"$headers")"
check "asset inexistente da 404" "404" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/no-existe.js")"

if ((fallas > 0)); then
  echo "--- logs del contenedor ---"
  docker logs "$NAME" 2>&1 | tail -30
  exit 1
fi
echo "Smoke test OK"
