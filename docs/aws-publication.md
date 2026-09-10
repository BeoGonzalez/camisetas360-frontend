# Publicación HTTPS y CORS de Camisetas360

## Estado comprobado el 10 de septiembre de 2026

Los cambios de este repositorio están preparados; **no se han aplicado a AWS**.
La identidad disponible para AWS CLI devuelve `ExpiredToken`. No hay una sesión
de consola AWS abierta en el navegador conectado. El workflow existente utiliza
SSM y el secreto `EC2_FRONTEND_ID`; hace falta renovar la sesión e identificar la
instancia antes de inspeccionar o modificar el servidor.

| Verificación pública | Resultado observado |
| --- | --- |
| `curl -i https://100.49.172.129/catalog` sin `-k` | Error 60, `SEC_E_UNTRUSTED_ROOT`; no se obtiene respuesta HTTP |
| Navegador, misma URL | `net::ERR_CERT_AUTHORITY_INVALID` |
| GET catálogo con Origin HTTPS de la IP | HTTP 200, sin `Access-Control-Allow-Origin` |
| OPTIONS con Origin, método GET y headers authorization,content-type | HTTP 200 vacío, sin los tres headers CORS requeridos |
| HTTP `/catalog` (solo diagnóstico de redirección) | HTTP 404; no redirige a HTTPS |

El certificado presentado tiene sujeto y emisor idénticos:
`C=US, ST=State, L=City, O=Organization, CN=100.49.172.129`.
Vigencia: 2026-09-09 11:28 UTC a 2027-09-09 11:28 UTC. No contiene SAN.
Coincide con la generación autofirmada del Dockerfile original y las rutas
`/etc/ssl/certs/nginx-selfsigned.crt` y `/etc/ssl/private/nginx-selfsigned.key`
del Nginx original. La configuración remota efectiva aún requiere inspección.

El GET público devolvió los siguientes datos (no son datos embebidos en la aplicación):

| SKU | Nombre | Precio API | Stock | Estado |
| --- | --- | --- | --- | --- |
| CAM-001 | Camiseta Titular 2026 | 39.99 | 100 | Disponible |
| CAM-002 | Camiseta Visitante 2026 | 39.99 | 80 | Disponible |
| CAM-003 | Camiseta Retro Edición Especial | 49.99 | 25 | Disponible |

## Certificado público para la IP

Actualmente sí es posible conservar la IP: [Let's Encrypt soporta certificados
para IP con Certbot 5.4 o posterior](https://letsencrypt.org/2026/03/11/shorter-certs-certbot).
Su perfil `shortlived` dura seis días y exige renovación automática operativa.
El certificado de producción debe incluir la IP en SAN. La cadena completa se
monta en Nginx; ninguna clave privada debe entrar al repositorio o a la imagen.

Antes de cambiar el servidor, revisar por SSM o SSH:

```bash
sudo docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
sudo ss -ltnp
sudo docker exec app-produccion nginx -T
sudo nginx -T # solo si también hay un Nginx en el host
certbot --version
```

Identificar quién ocupa 80/443 y guardar copia de sus configuraciones. No arrancar
otro servidor encima ni reemplazar un proxy que también sirve al backend. Si el
host ya termina TLS, adaptar allí la configuración y el deploy antes de ejecutarlo.
El script de este repositorio asume que el contenedor frontend será el dueño de
ambos puertos.

1. Mantener accesibles 80 y 443 para el frontend en el security group. Crear
   `/var/www/certbot` en el host. Servir `/.well-known/acme-challenge/` por HTTP
   desde ese directorio en el proxy existente. Si está en Docker, montar el
   directorio en ese contenedor. `deploy/nginx-acme-bootstrap.conf` sirve como
   referencia para la primera emisión, antes de disponer de los archivos TLS.
2. Comprobar desde fuera que un archivo temporal en el directorio de challenge
   devuelve su contenido con HTTP 200. Retirarlo después de verificarlo.
3. Con Certbot >= 5.4 instalado desde su distribución oficial, emitir en el host:

```bash
sudo certbot certonly --preferred-profile shortlived \
  --webroot --webroot-path /var/www/certbot \
  --ip-address 100.49.172.129
```

Usar la CA de producción; `--staging` produce certificados que el navegador no
confía. Completar el registro de Certbot con el responsable del servicio cuando
corresponda. No imprimir ni copiar `privkey.pem`.

4. Verificar los archivos en `/etc/letsencrypt/live/100.49.172.129/`. Si Certbot
   asigna otro nombre de lineage, ajustar Nginx y `deploy/frontend.sh`. Montar
   **todo** `/etc/letsencrypt` como solo lectura (los enlaces de `live` apuntan a
   `archive`). El workflow publica 80/443, prueba `nginx -t`, despliega la imagen
   por SHA y comprueba TLS sin deshabilitar validación. Ante fallo restaura el
   contenedor previo. Requiere `curl` y `openssl` en el host.
5. Instalar un hook ejecutable en
   `/etc/letsencrypt/renewal-hooks/deploy/reload-camisetas360`:

```sh
#!/bin/sh
set -eu
docker exec app-produccion nginx -t
docker exec app-produccion nginx -s reload
```

6. Confirmar que el timer de Certbot ejecuta renovaciones al menos dos veces al
   día (`systemctl list-timers --all`), ejecutar `sudo certbot renew --dry-run`
   y probar el hook contra el contenedor activo. Supervisar fallos y expiración;
   reiniciar el contenedor no renueva el certificado.

Alternativa: usar un dominio controlado, como `app.midominio.com`, con DNS hacia
una IP estable o balanceador. Antes de migrar, obtener certificado para ese nombre
y actualizar `server_name`, redirección, rutas TLS, comprobación del deploy,
`AllowOrigins` y redirect URI registrado en Entra ID y en environments. No usar
el dominio de ejemplo como si ya existiera ni dejar simultáneamente la IP en CORS
si el origen definitivo pasa a ser el dominio.

## CORS en API Gateway HTTP API

Ejecutar desde la raíz del repositorio con credenciales vigentes. No guardar
credenciales en estos archivos. Antes de mutar, revisar tipo de API, configuración,
routes y stages; guardar la configuración CORS previa en un respaldo operativo.

```bash
aws sts get-caller-identity --region us-east-1
aws apigatewayv2 get-api --api-id 4ohe7l86rh --region us-east-1
aws apigatewayv2 get-stages --api-id 4ohe7l86rh --region us-east-1
aws apigatewayv2 get-routes --api-id 4ohe7l86rh --region us-east-1
aws apigatewayv2 update-api --api-id 4ohe7l86rh --region us-east-1 \
  --cors-configuration file://deploy/cors.json
```

Continuar solo si `ProtocolType` es `HTTP`. La configuración permite únicamente
`https://100.49.172.129`, los seis métodos solicitados, Content-Type y Authorization;
credentials es false y expose headers está vacío.
[API Gateway agrega los headers y responde a preflights](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-cors.html).
No basta con cambiar Spring o Nginx.

Si el stage que sirve la URL tiene `AutoDeploy: false`, crear un deployment y
asignarlo a ese stage. Para el stage `$default` de la URL sin prefijo:

```bash
deployment_id=$(aws apigatewayv2 create-deployment --api-id 4ohe7l86rh \
  --region us-east-1 --description 'CORS frontend HTTPS' \
  --query DeploymentId --output text)
aws apigatewayv2 update-stage --api-id 4ohe7l86rh --region us-east-1 \
  --stage-name '$default' --deployment-id "$deployment_id"
```

No ejecutar este paso si AutoDeploy está activo. Si existe `$default` con
authorizer y OPTIONS queda protegido, configurar `OPTIONS /{proxy+}` sin
autorización con una integración verificada según la documentación de AWS.
Conservar la protección de las rutas de negocio.

## Validación posterior al despliegue

Ejecutar estos comandos sin `-k` (en Windows usar `curl.exe`):

```bash
curl -i https://100.49.172.129/catalog
curl -i -H 'Origin: https://100.49.172.129' \
  https://4ohe7l86rh.execute-api.us-east-1.amazonaws.com/api/v1/catalog/products
curl -i -X OPTIONS \
  -H 'Origin: https://100.49.172.129' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: authorization,content-type' \
  https://4ohe7l86rh.execute-api.us-east-1.amazonaws.com/api/v1/catalog/products
```

Exigir frontend HTTP 200 con TLS confiable; GET 200 con Allow-Origin exacto;
OPTIONS 200/204 con Allow-Origin exacto, GET en Allow-Methods y ambos headers en
Allow-Headers (comparación sin distinguir mayúsculas). Verificar que un origen
ajeno no recibe autorización CORS. Comprobar también redirección HTTP a HTTPS.

Abrir `/catalog` sin excepciones de certificado, comprobar en Network el GET 200
a API Gateway y ausencia de errores CORS; cotejar nombres, precios y stock con la
respuesta del momento. El stock no se fija a 100/80/25. Las pruebas locales usan
fixtures y no sustituyen esta validación en producción.

## Comprobaciones locales realizadas

- `pnpm exec ng test --watch=false`: 6 pruebas aprobadas, incluidas URL exacta,
  petición pública sin Bearer ni credentials, tres productos y stocks, y compra
  deshabilitada cuando stock es cero.
- `pnpm run build`: correcto. Advertencia: bundle inicial 585.13 kB frente al
  presupuesto de advertencia de 500 kB (límite de error: 1 MB).
- `git diff --check`: sin errores de whitespace.
- No se ejecutó `nginx -t` localmente: Docker Engine no está disponible. El script
  de despliegue lo exige antes de detener el contenedor actual.
- Certificado CA, renovación, cambios API Gateway y prueba final de navegador
  siguen pendientes de acceso operativo a AWS.
