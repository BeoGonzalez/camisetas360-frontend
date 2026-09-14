# ==========================================
# ANGULAR BUILD
# ==========================================

FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable \
    && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./

RUN pnpm install \
    --no-frozen-lockfile \
    --unsafe-perm=true

COPY . .

RUN pnpm run build


# ==========================================
# NGINX
# ==========================================

FROM nginx:alpine

COPY --from=builder \
    /app/dist/camisetas360-frontend/browser \
    /usr/share/nginx/html

RUN mkdir -p /etc/nginx/snippets

COPY nginx.conf.template \
    /etc/nginx/templates/default.conf.template

COPY nginx/proxy-headers.conf \
    /etc/nginx/snippets/proxy-headers.conf

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]