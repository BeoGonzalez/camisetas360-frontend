# ==========================================
# ANGULAR BUILD
# ==========================================

FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build


# ==========================================
# NGINX
# ==========================================

FROM nginx:alpine

# Eliminar configuración default de Nginx
RUN rm -f /etc/nginx/conf.d/default.conf

# Copiar configuración propia
COPY nginx/nginx.conf \
    /etc/nginx/conf.d/default.conf

# Copiar Angular compilado
COPY --from=builder \
    /app/dist/camisetas360-frontend/browser \
    /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK \
    --interval=30s \
    --timeout=5s \
    --start-period=10s \
    --retries=3 \
    CMD wget -q -O - http://127.0.0.1/health | grep -q "OK" || exit 1

CMD ["nginx", "-g", "daemon off;"]