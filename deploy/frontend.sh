#!/usr/bin/env bash
set -euo pipefail
# Ejecutado por SSM como root. Argumentos: registro ECR, imagen con tag SHA.
registry=${1:?Falta registro ECR}
image=${2:?Falta imagen ECR}
cert_dir=/etc/letsencrypt/live/100.49.172.129
fail() {
    echo "ERROR: $*" >&2
    exit 1
}
for dependency in openssl aws docker curl; do
    command -v "$dependency" >/dev/null 2>&1 || fail "Falta instalar $dependency en la instancia EC2."
done
test -s "$cert_dir/fullchain.pem" || fail "Falta $cert_dir/fullchain.pem. Completar la emisión TLS según docs/aws-publication.md."
test -s "$cert_dir/privkey.pem" || fail "Falta $cert_dir/privkey.pem. Completar la emisión TLS según docs/aws-publication.md."
test -d /var/www/certbot || fail "Falta /var/www/certbot. Completar la configuración ACME según docs/aws-publication.md."
# Fallar antes de detener la versión actual si el certificado no sirve.
openssl x509 -in "$cert_dir/fullchain.pem" -checkend 86400 -noout || fail "El certificado no es válido por al menos 24 horas; revisar la renovación."
openssl x509 -in "$cert_dir/fullchain.pem" -checkip 100.49.172.129 -noout || fail "El certificado no corresponde a la IP 100.49.172.129."
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin "$registry"
docker pull "$image"
mounts=(-v /etc/letsencrypt:/etc/letsencrypt:ro -v /var/www/certbot:/var/www/certbot:ro)
docker run --rm "${mounts[@]}" --entrypoint nginx "$image" -t
previous=
original=
legacy=camisetas360-frontend-frontend-1
if docker container inspect app-produccion >/dev/null 2>&1; then
    original=app-produccion
    if docker container inspect "$legacy" >/dev/null 2>&1; then
        fail "Existen app-produccion y $legacy. Revisar los contenedores antes de desplegar."
    fi
elif docker container inspect "$legacy" >/dev/null 2>&1; then
    original=$legacy
fi
stopped=false
renamed=false
replacement_attempted=false
rollback() {
    status=$1
    trap - ERR
    echo "ERROR: Falló el despliegue; restaurando el contenedor anterior." >&2
    if [ "$replacement_attempted" = true ]; then
        docker rm -f app-produccion >/dev/null 2>&1 || true
    fi
    if [ "$renamed" = true ]; then
        docker rename "$previous" "$original" || echo "ERROR: No se pudo restaurar el nombre $original desde $previous." >&2
    fi
    if [ "$stopped" = true ]; then
        docker start "$original" || echo "ERROR: No se pudo iniciar $original; requiere recuperación manual." >&2
    fi
    exit "$status"
}
trap 'rollback "$?"' ERR
if [ -n "$original" ]; then
    previous="$original-backup-$(date +%s)"
    docker stop "$original"
    stopped=true
    docker rename "$original" "$previous"
    renamed=true
fi
# El Nginx del host conserva el puerto 80 y las rutas hacia las APIs.
replacement_attempted=true
docker run -d --restart unless-stopped -p 443:443 \
    "${mounts[@]}" --name app-produccion "$image"
curl --fail --silent --show-error --retry 5 --retry-connrefused --retry-delay 2 \
    --connect-timeout 5 --max-time 15 \
    --resolve 100.49.172.129:443:127.0.0.1 https://100.49.172.129/catalog >/dev/null
trap - ERR
# Se conserva el contenedor anterior detenido para rollback manual.
