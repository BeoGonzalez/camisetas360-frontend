# ==========================================
# ANGULAR BUILD
# ==========================================

FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

# Configuración del SPA (ver .env.example). Se inyecta con --build-arg; quedan en el bundle
# del navegador, así que solo van IDs públicos y URLs, nunca secretos.
ARG NG_APP_ENTRA_CLIENT_ID
ARG NG_APP_ENTRA_TENANT_ID
ARG NG_APP_API_SCOPE_BASE
ARG NG_APP_API_BASE_URL
ARG NG_APP_TELEMETRIA_WS_URL

# ENV_STRICT=1: el build falla si falta la configuración de Entra.
RUN ENV_STRICT=1     NG_APP_ENTRA_CLIENT_ID="$NG_APP_ENTRA_CLIENT_ID"     NG_APP_ENTRA_TENANT_ID="$NG_APP_ENTRA_TENANT_ID"     NG_APP_API_SCOPE_BASE="$NG_APP_API_SCOPE_BASE"     NG_APP_API_BASE_URL="$NG_APP_API_BASE_URL"     NG_APP_TELEMETRIA_WS_URL="$NG_APP_TELEMETRIA_WS_URL"     pnpm run build


# ==========================================
# NGINX
# ==========================================

FROM nginx:alpine

# Eliminar configuración default de Nginx
RUN rm -f /etc/nginx/conf.d/default.conf

# Eliminar el contenido por defecto de Nginx (el "Welcome to nginx")
RUN rm -rf /usr/share/nginx/html/*

# Copiar configuración propia desde la raíz
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar solo la aplicación compilada (la carpeta browser)
COPY --from=builder /app/dist/camisetas360-frontend/browser/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK \
    --interval=30s \
    --timeout=5s \
    --start-period=10s \
    --retries=3 \
    CMD wget -q -O - http://127.0.0.1/health | grep -q "OK" || exit 1

CMD ["nginx", "-g", "daemon off;"]