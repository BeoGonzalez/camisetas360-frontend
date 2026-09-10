# HTTPS desde Session Manager en AWS Academy

Procedimiento para la configuración inspeccionada el 10 de septiembre de 2026:
Nginx del host atiende HTTP y las APIs; Docker atiende HTTPS. Ejecutar en la
terminal web de **EC2 → Conectar → Session Manager**.

## 1. Preparar HTTP para la validación, conservando las APIs

Este bloque agrega un include al servidor existente, respalda su configuración
y valida Nginx antes de recargarlo. No detiene el contenedor HTTPS.

```bash
sudo bash <<'SETUP'
set -euo pipefail
config=/etc/nginx/conf.d/camisetas360-api.conf
backup="$config.backup-$(date +%s)"
test -f "$config"
cp -a "$config" "$backup"
mkdir -p /var/www/certbot/.well-known/acme-challenge
cat > /etc/nginx/camisetas360-acme.inc <<'NGINX'
location ^~ /.well-known/acme-challenge/ {
    root /var/www/certbot;
    default_type text/plain;
    try_files $uri =404;
}
location / {
    return 301 https://100.49.172.129$request_uri;
}
NGINX
if ! grep -Fq 'include /etc/nginx/camisetas360-acme.inc;' "$config"; then
    test "$(grep -c 'server_name.*100[.]49[.]172[.]129;' "$config")" = 1
    sed -i '/server_name.*100[.]49[.]172[.]129;/a\    include /etc/nginx/camisetas360-acme.inc;' "$config"
fi
grep -F 'include /etc/nginx/camisetas360-acme.inc;' "$config"
if ! nginx -t; then
    cp -a "$backup" "$config"
    echo 'No se aplicó el cambio: se restauró la configuración.' >&2
    exit 1
fi
systemctl reload nginx
printf 'camisetas360-acme-ok\n' > /var/www/certbot/.well-known/acme-challenge/comprobacion
curl --fail --silent --show-error -H 'Host: 100.49.172.129' \
    http://127.0.0.1/.well-known/acme-challenge/comprobacion
SETUP
```

Desde un navegador externo abrir
`http://100.49.172.129/.well-known/acme-challenge/comprobacion`.
Debe responder `camisetas360-acme-ok`. Si no responde, revisar que el security
group permita HTTP TCP 80 y que la IP pública actual siga siendo 100.49.172.129.
No continuar con Certbot hasta que sea accesible desde Internet.

## 2. Emitir el certificado usando Docker

La [imagen oficial de Certbot](https://eff-certbot.readthedocs.io/en/stable/install.html#running-with-docker)
evita instalar paquetes en el host. Se requiere versión 5.4 o posterior para
[webroot con direcciones IP](https://letsencrypt.org/2026/03/11/shorter-certs-certbot).

```bash
sudo docker pull certbot/certbot:latest
sudo docker run --rm certbot/certbot:latest --version
sudo docker run --rm -it \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/lib/letsencrypt:/var/lib/letsencrypt \
  -v /var/log/letsencrypt:/var/log/letsencrypt \
  -v /var/www/certbot:/var/www/certbot \
  certbot/certbot:latest certonly \
  --preferred-profile shortlived \
  --webroot --webroot-path /var/www/certbot \
  --cert-name 100.49.172.129 --ip-address 100.49.172.129
```

Completar personalmente las preguntas de registro y términos de Certbot.
El comando usa la CA de producción. No publica puertos Docker ni detiene Nginx.
Verificar el resultado sin leer la clave privada:

```bash
sudo openssl x509 -in /etc/letsencrypt/live/100.49.172.129/fullchain.pem \
  -noout -issuer -dates -ext subjectAltName
```

## 3. Publicar los cambios del repositorio y desplegar

El workflow debe incluir el `deploy/frontend.sh` actualizado que publica solo
443 y reconoce `camisetas360-frontend-frontend-1`. Reejecutar un workflow de un
commit antiguo no incorpora este cambio. Publicar el commit actualizado en main
para iniciar el despliegue. Los secretos temporales de Academy en GitHub deben
seguir vigentes.

El primer despliegue detiene y renombra el contenedor de Compose como respaldo,
y crea `app-produccion`. Hay una breve interrupción de HTTPS durante el reemplazo.
Si falla, restaura el contenedor anterior con su nombre original. Las APIs del
Nginx del host siguen atendiendo HTTP. No volver a ejecutar el Compose antiguo
después de una migración exitosa: GitHub Actions pasa a administrar el frontend.

```bash
sudo docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
curl --fail --show-error --resolve 100.49.172.129:443:127.0.0.1 \
  https://100.49.172.129/catalog -o /dev/null
```

## 4. Configurar renovación automática después del despliegue exitoso

Los certificados para IP duran seis días. Docker no instala un timer de Certbot:
crear uno en el host. Este script renueva y recarga el Nginx del contenedor cuando
Certbot termina correctamente, incluso si aún no era necesario renovar. No se
monta el socket de Docker dentro del contenedor de Certbot.

```bash
sudo tee /usr/local/sbin/camisetas360-renew >/dev/null <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/lib/letsencrypt:/var/lib/letsencrypt \
  -v /var/log/letsencrypt:/var/log/letsencrypt \
  -v /var/www/certbot:/var/www/certbot \
  certbot/certbot:latest renew --cert-name 100.49.172.129 "$@"
docker exec app-produccion nginx -t
docker exec app-produccion nginx -s reload
SCRIPT
sudo chmod 750 /usr/local/sbin/camisetas360-renew
sudo /usr/local/sbin/camisetas360-renew --dry-run
```

Continuar solo si la prueba anterior termina correctamente:

```bash
sudo tee /etc/systemd/system/camisetas360-renew.service >/dev/null <<'UNIT'
[Unit]
Description=Renovar TLS de Camisetas360 y recargar Nginx
Wants=network-online.target
After=network-online.target docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/camisetas360-renew
UNIT
sudo tee /etc/systemd/system/camisetas360-renew.timer >/dev/null <<'UNIT'
[Unit]
Description=Comprobar renovacion TLS dos veces al dia

[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=30m
Persistent=true

[Install]
WantedBy=timers.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now camisetas360-renew.timer
sudo systemctl list-timers camisetas360-renew.timer
```

Consultar fallos con `sudo journalctl -u camisetas360-renew.service`.
En Academy, un laboratorio detenido no ejecuta renovaciones; al reanudar revisar
vigencia e IP pública antes de probar HTTPS. Si cambia la IP, actualizar primero
la configuración y emitir un certificado para la IP nueva.
