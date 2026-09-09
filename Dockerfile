# ==========================================
# ETAPA 1: Construcción (Builder)
# ==========================================
FROM node:22-alpine AS builder
WORKDIR /app

# Habilitamos Corepack para usar el gestor pnpm nativo del proyecto
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiamos los manifiestos y el lockfile de pnpm
COPY package.json pnpm-lock.yaml ./

# Instalamos las dependencias permitiendo scripts nativos (esbuild, parcel, etc.)
RUN pnpm install --no-frozen-lockfile --unsafe-perm=true

# Copiamos el resto del código fuente
COPY . .

# Generamos el build de producción
RUN pnpm run build

# ==========================================
# ETAPA 2: Servidor de Producción (Nginx)
# ==========================================
FROM nginx:alpine

# Copiamos los archivos compilados hacia la carpeta pública de Nginx
COPY --from=builder /app/dist/camisetas360-frontend/browser /usr/share/nginx/html

# Copiamos la configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Instalamos openssl para generar el certificado autofirmado
RUN apk add --no-cache openssl && \
    mkdir -p /etc/ssl/private /etc/ssl/certs && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/nginx-selfsigned.key \
    -out /etc/ssl/certs/nginx-selfsigned.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=44.200.56.103"

EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]