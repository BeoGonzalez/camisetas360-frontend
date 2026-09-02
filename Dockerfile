# ==========================================
# ETAPA 1: Construcción (Builder)
# ==========================================
FROM node:20-alpine AS builder
WORKDIR /app

# Copiamos primero los archivos de dependencias para aprovechar la caché de Docker
COPY package*.json pnpm-lock.yaml ./

# Instalamos dependencias (Ajustado para usar pnpm según tu proyecto)
RUN npm install -g pnpm && pnpm install

# Copiamos el resto del código fuente
COPY . .

# Generamos el build de producción
RUN pnpm run build

# ==========================================
# ETAPA 2: Servidor de Producción (Nginx)
# ==========================================
FROM nginx:alpine

# Copiamos los archivos compilados desde la Etapa 1 hacia la carpeta pública de Nginx
# Nota: En Angular 17+, la ruta de salida es dist/camisetas360-frontend/browser
COPY --from=builder /app/dist/camisetas360-frontend/browser /usr/share/nginx/html

# Copiamos nuestra configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponemos el puerto 80 para que el NLB/ALB de AWS pueda conectarse
EXPOSE 80

# Arrancamos Nginx en primer plano
CMD ["nginx", "-g", "daemon off;"]