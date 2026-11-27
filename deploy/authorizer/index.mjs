// Authorizer Lambda del HTTP API del backend (xzaze5dfn5): acepta tokens de Cognito y de
// Microsoft Entra ID. Un authorizer JWT de API Gateway admite un solo issuer, por eso existe.
// Formato: payload 2.0 con respuestas simples ({ isAuthorized, context }).
// Variables: COGNITO_ISSUER, COGNITO_CLIENT_IDS (coma), ENTRA_TENANT_ID, ENTRA_AUDIENCES (coma).
import { createPublicKey, createVerify } from 'node:crypto';

const lista = (v) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const COGNITO_ISSUER = process.env.COGNITO_ISSUER;
const COGNITO_CLIENT_IDS = lista(process.env.COGNITO_CLIENT_IDS);
const TENANT = process.env.ENTRA_TENANT_ID;
const ENTRA_AUDIENCES = lista(process.env.ENTRA_AUDIENCES);

// Entra emite tokens v1 (sts.windows.net) o v2 (login.microsoftonline.com/v2.0) según el
// manifiesto de la API (accessTokenAcceptedVersion); ambos se firman con las mismas claves.
const ENTRA_ISSUERS = [
  `https://login.microsoftonline.com/${TENANT}/v2.0`,
  `https://sts.windows.net/${TENANT}/`,
];

const JWKS_URL = {
  cognito: `${COGNITO_ISSUER}/.well-known/jwks.json`,
  entra: `https://login.microsoftonline.com/${TENANT}/discovery/v2.0/keys`,
};

const cacheJwks = new Map(); // proveedor -> { claves: Map<kid, KeyObject>, leido: ms }
const TTL_JWKS_MS = 60 * 60 * 1000;

async function clave(proveedor, kid) {
  let c = cacheJwks.get(proveedor);
  const vencido = !c || Date.now() - c.leido > TTL_JWKS_MS;
  // Si el kid no está, se relee una vez: las claves rotan.
  if (vencido || !c.claves.has(kid)) {
    const res = await fetch(JWKS_URL[proveedor]);
    if (!res.ok) throw new Error(`JWKS ${proveedor}: HTTP ${res.status}`);
    const { keys } = await res.json();
    c = {
      claves: new Map(
        keys
          .filter((k) => k.kty === 'RSA')
          .map((k) => [k.kid, createPublicKey({ key: k, format: 'jwk' })]),
      ),
      leido: Date.now(),
    };
    cacheJwks.set(proveedor, c);
  }
  return c.claves.get(kid);
}

const b64 = (s) => Buffer.from(s, 'base64url');

function proveedorDe(iss) {
  if (iss === COGNITO_ISSUER) return 'cognito';
  if (ENTRA_ISSUERS.includes(iss)) return 'entra';
  return null;
}

function audienciaValida(proveedor, p) {
  if (proveedor === 'cognito') {
    // Access token: client_id; ID token: aud.
    if (p.token_use !== 'access' && p.token_use !== 'id') return false;
    return COGNITO_CLIENT_IDS.includes(p.token_use === 'access' ? p.client_id : p.aud);
  }
  const auds = Array.isArray(p.aud) ? p.aud : [p.aud];
  return auds.some((a) => ENTRA_AUDIENCES.includes(a));
}

export async function verificar(token) {
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  const [h, c, firma] = partes;
  const header = JSON.parse(b64(h).toString('utf8'));
  const payload = JSON.parse(b64(c).toString('utf8'));
  if (header.alg !== 'RS256' || !header.kid) return { motivo: 'algoritmo' };

  const proveedor = proveedorDe(payload.iss);
  if (!proveedor) return { motivo: 'issuer' };

  const pub = await clave(proveedor, header.kid);
  if (!pub) return { motivo: `kid-${proveedor}` };
  const ok = createVerify('RSA-SHA256').update(`${h}.${c}`).verify(pub, b64(firma));
  if (!ok) return { motivo: `firma-${proveedor}` };
  if (!audienciaValida(proveedor, payload)) return { motivo: `audiencia-${proveedor}` };

  const ahora = Math.floor(Date.now() / 1000);
  const margen = 60;
  if (typeof payload.exp !== 'number') return { motivo: 'sin-exp' };
  if (typeof payload.nbf === 'number' && payload.nbf - margen > ahora) return { motivo: 'nbf' };
  // Vencido pero auténtico (firma, issuer y audiencia propios): pasa. El microservicio lo rechaza
  // con 401, y ante 401 el frontend renueva o vuelve al login. Si el authorizer lo negara,
  // API Gateway respondería 403 y el usuario quedaría atascado con una sesión inservible.
  const vencido = payload.exp + margen < ahora;

  return { proveedor, payload, vencido };
}

export async function handler(event) {
  const auth = event.headers?.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return { isAuthorized: false };
  try {
    const r = await verificar(token);
    if (!r || r.motivo) {
      // Solo el motivo: nunca el token ni sus claims.
      console.warn(`authorizer: rechazado (${r?.motivo ?? 'formato'})`);
      return { isAuthorized: false };
    }
    if (r.vencido)
      console.warn(`authorizer: token ${r.proveedor} vencido, lo rechazará el servicio (401)`);
    const p = r.payload;
    const roles = r.proveedor === 'cognito' ? (p['cognito:groups'] ?? []) : (p.roles ?? []);
    return {
      isAuthorized: true,
      // Contexto para el backend ($context.authorizer.<clave>); solo strings.
      context: {
        proveedor: r.proveedor,
        sub: String(p.sub ?? p.oid ?? ''),
        roles: roles.join(','),
      },
    };
  } catch (e) {
    // Nunca se registra el token.
    console.error('authorizer:', e.message);
    return { isAuthorized: false };
  }
}
