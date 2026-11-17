#!/usr/bin/env node
/**
 * Genera src/environments/env.generated.ts a partir de variables de entorno.
 *
 * Angular no lee archivos .env: este script toma `.env` (si existe) y `process.env`
 * (process.env tiene prioridad, así CI/Docker pueden inyectar valores con --build-arg o
 * variables del workflow) y escribe un módulo TypeScript que importan los environments.
 *
 * Uso: node scripts/write-env.mjs [--strict]
 *   --strict (o ENV_STRICT=1): falla si falta alguna variable obligatoria de Entra.
 *
 * Nada de lo que se genera es secreto (IDs públicos de Entra y URLs): todo termina en el
 * bundle del navegador. Igual no se commitea, para no fijar valores de un entorno en el repo.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'src/environments/env.generated.ts');
const strict = process.argv.includes('--strict') || process.env.ENV_STRICT === '1';

/** Parser mínimo de .env: KEY=VALUE, comentarios con #, comillas opcionales. */
function readDotEnv(file) {
  if (!existsSync(file)) return {};
  const vars = {};
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    vars[key] = value;
  }
  return vars;
}

const fileVars = readDotEnv(resolve(root, '.env'));
const get = (key) => (process.env[key] ?? fileVars[key] ?? '').trim();
const noTrailingSlash = (v) => v.replace(/\/+$/, '');

const env = {
  entraClientId: get('NG_APP_ENTRA_CLIENT_ID'),
  entraTenantId: get('NG_APP_ENTRA_TENANT_ID'),
  apiScopeBase: noTrailingSlash(get('NG_APP_API_SCOPE_BASE')),
  apiBaseUrl: noTrailingSlash(get('NG_APP_API_BASE_URL')),
  telemetriaWsUrl: noTrailingSlash(get('NG_APP_TELEMETRIA_WS_URL')),
};

const required = {
  NG_APP_ENTRA_CLIENT_ID: env.entraClientId,
  NG_APP_ENTRA_TENANT_ID: env.entraTenantId,
  NG_APP_API_SCOPE_BASE: env.apiScopeBase,
};
const missing = Object.entries(required)
  .filter(([, v]) => !v)
  .map(([k]) => k);

const errors = [];
if (env.apiScopeBase && !/^(api:\/\/|https:\/\/)/.test(env.apiScopeBase)) {
  errors.push('NG_APP_API_SCOPE_BASE debe ser el Application ID URI (api://... o https://...).');
}
if (env.apiBaseUrl && !/^https?:\/\//.test(env.apiBaseUrl)) {
  errors.push('NG_APP_API_BASE_URL debe empezar con http:// o https://.');
}
if (env.telemetriaWsUrl && !/^wss?:\/\//.test(env.telemetriaWsUrl)) {
  errors.push('NG_APP_TELEMETRIA_WS_URL debe empezar con ws:// o wss://.');
}
if (errors.length) {
  for (const e of errors) console.error(`[write-env] ${e}`);
  process.exit(1);
}
if (missing.length) {
  const msg = `[write-env] Faltan variables: ${missing.join(', ')} (ver .env.example).`;
  if (strict) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(`${msg} El login con Entra no funcionará hasta configurarlas.`);
}

const content = `// GENERADO por scripts/write-env.mjs desde .env / variables de entorno. No editar ni commitear.
export const ENV: Readonly<Record<${Object.keys(env)
  .map((k) => `'${k}'`)
  .join(' | ')}, string>> = ${JSON.stringify(env, null, 2)};
`;
writeFileSync(out, content);
console.log(`[write-env] ${out.replace(root, '.')} actualizado.`);
