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
if docker container inspect app-produccion >/dev/null 2>&1; then
    previous="app-produccion-backup-$(date +%s)"
    docker stop app-produccion
    docker rename app-produccion "$previous"
fi
rollback() {
    docker rm -f app-produccion >/dev/null 2>&1 || true
    if [ -n "$previous" ]; then
        docker rename "$previous" app-produccion
        docker start app-produccion
    fi
}
trap rollback ERR
docker run -d --restart unless-stopped -p 80:80 -p 443:443 \
    "${mounts[@]}" --name app-produccion "$image"
curl --fail --silent --show-error --retry 5 --retry-connrefused --retry-delay 2 \
    --connect-timeout 5 --max-time 15 \
    --resolve 100.49.172.129:443:127.0.0.1 https://100.49.172.129/catalog >/dev/null
trap - ERR
# Se conserva el contenedor anterior detenido para rollback manual.
