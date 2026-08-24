// Correr SQL contra el proyecto de Supabase por la Management API.
//
//   node scripts/supabase.mjs leer  "select …"                 solo lectura
//   node scripts/supabase.mjs leer  --archivo consulta.sql     solo lectura, desde archivo
//   node scripts/supabase.mjs correr --archivo db/arranque/001_catalogo.sql
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTE ARCHIVO EXISTE, Y POR QUÉ NO ES `db.mjs`
//
// `scripts/db.mjs` habla TCP con `DATABASE_URL_ADMIN`, que contra Supabase **no existe a
// propósito**: la contraseña de `postgres` no vive en ninguna máquina de acá. Lo que sí hay es
// un token personal de la cuenta, y `POST /v1/projects/{ref}/database/query` con
// `read_only: false` conecta como `postgres` — que en Supabase tiene `rolbypassrls` y
// `rolcreaterole`, medido y no supuesto.
//
// Eso lo convierte en el ÚNICO camino para las dos cosas que necesitan omitir RLS:
// `db/arranque/000_cluster.sql` (los tres roles) y `db/arranque/001_catalogo.sql` (el catálogo
// de capacidades, que vive detrás del forzado de RLS sin política para `migrador`).
//
// ── LOS TRES FRENOS, Y CADA UNO POR UN MODO DE FALLA CONCRETO ───────────────
//
// 1 · **`leer` es el verbo por omisión y `correr` hay que escribirlo.** Un error de tipeo no
//     puede terminar en una escritura contra producción. `leer` manda `read_only: true`, que
//     lo hace cumplir el motor y no este archivo.
//
// 2 · **El proyecto se compara con `DATABASE_URL_MIGRADOR`.** El `ref` no se escribe a mano:
//     sale de la misma cadena de conexión que usa el resto del despliegue. Con dos proyectos
//     de Supabase, un `ref` copiado de otra ventana aplica el catálogo en el proyecto
//     equivocado y **no falla** — las tablas existen en los dos.
//
// 3 · **No imprime el token ni el cuerpo de la petición.** Un `console.log` de depuración en
//     un script de despliegue es cómo un token termina en el registro de una terminal.
// ═══════════════════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';

const API = 'https://api.supabase.com';

/** El `ref` del proyecto, deducido de la cadena de conexión del migrador. */
function refDelProyecto() {
  const url = process.env.DATABASE_URL_MIGRADOR;
  if (!url) {
    throw new Error(
      'DATABASE_URL_MIGRADOR no está definida. Corré con:\n' +
        '  node --env-file=.env.supabase scripts/supabase.mjs …',
    );
  }
  const u = new URL(url);
  // Dos formas, y las dos se ven en este proyecto:
  //   · directa   → db.<ref>.supabase.co
  //   · agrupador → usuario `migrador.<ref>` en aws-0-….pooler.supabase.com
  const porHost = u.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.(co|com)$/);
  if (porHost) return porHost[1];
  const porUsuario = decodeURIComponent(u.username).match(/\.([a-z0-9]{20})$/);
  if (porUsuario) return porUsuario[1];
  throw new Error(
    `no pude deducir el proyecto de DATABASE_URL_MIGRADOR (host ${u.hostname}). ` +
      'Se deduce de la conexión a propósito: un `ref` escrito a mano puede aplicar en el ' +
      'proyecto equivocado sin fallar.',
  );
}

async function consultar(sql, { escribe }) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN no está definida (va en `.env.supabase`).');
  const ref = refDelProyecto();

  const r = await fetch(`${API}/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql, read_only: !escribe }),
  });

  const texto = await r.text();
  if (!r.ok) {
    // El cuerpo de la RESPUESTA sí se muestra: es el error de PostgreSQL y es lo único que
    // permite diagnosticar. El de la PETICIÓN no, porque lleva el SQL con sus contraseñas
    // sustituidas.
    throw new Error(`la API respondió ${r.status}: ${texto.slice(0, 2000)}`);
  }
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

const [verbo, ...resto] = process.argv.slice(2);

if (verbo !== 'leer' && verbo !== 'correr') {
  console.error('uso: node scripts/supabase.mjs leer|correr ["SQL" | --archivo ruta.sql]');
  process.exit(2);
}

let sql;
if (resto[0] === '--archivo') {
  if (!resto[1]) throw new Error('--archivo necesita una ruta');
  // Los finales de línea de Windows se normalizan: un `\r` dentro de un `$$…$$` de PL/pgSQL
  // llega al cuerpo de la función y rompe con un error de sintaxis que no dice por qué.
  sql = readFileSync(resto[1], 'utf8').replace(/\r\n/g, '\n');
} else {
  sql = resto.join(' ');
}
if (!sql?.trim()) throw new Error('no hay SQL para correr');

// Y el último freno, éste sobre el CONTENIDO: `correr` con un archivo que tiene marcas sin
// sustituir mandaría `@CLAVE_MIGRADOR@` literal al motor. `db.mjs` las sustituye antes; este
// script no sustituye ninguna, así que su presencia es un error de uso, no un caso a manejar.
const marcas = sql.match(/@[A-Z_]+@/g);
if (marcas) {
  throw new Error(
    `el SQL tiene marcas sin sustituir: ${[...new Set(marcas)].join(', ')}. ` +
      'Este script no sustituye ninguna — usá `scripts/db.mjs` o sustituilas antes.',
  );
}

const salida = await consultar(sql, { escribe: verbo === 'correr' });
console.log(JSON.stringify(salida, null, 2));
