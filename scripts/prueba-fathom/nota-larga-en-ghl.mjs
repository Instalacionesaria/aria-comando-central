// ¿CABE UNA TRANSCRIPCIÓN ENTERA EN UNA NOTA DE GHL? **Medición, no deducción.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA PREGUNTA
//
// La conexión Fathom ↔ GHL (la de HighLevel, en los workflows) no guarda nada sola: para que la llamada
// quede en el contacto, el workflow tiene que agregar una NOTA. Y la documentación de GHL no dice
// cuánto texto entra en una nota. Una llamada de una hora son 50.000–60.000 caracteres; si la nota se
// corta, lo que lean los agentes desde GHL es media llamada, y no avisa.
//
// Esto escribe notas de largo creciente en UN contacto de prueba, las relee por la API y compara. Por
// omisión las borra al terminar.
//
//   node --env-file=.env.fathom scripts/prueba-fathom/nota-larga-en-ghl.mjs [--desde-archivo X.txt] [--dejar]
//
// `.env.fathom`: GHL_TOKEN_PRUEBA (Private Integration de una subcuenta de PRUEBA, con
// contacts.write) y GHL_CONTACTO_PRUEBA (el id de un contacto de prueba de esa subcuenta).
// `--desde-archivo` usa una transcripción real (por ejemplo un .txt de `fathom.mjs reuniones`),
// repetida hasta el largo de cada escalón; sin él, se arma un texto en castellano con tildes y eñes.
//
// ── LO QUE NO HACE ───────────────────────────────────────────────────────────
//
// No toca la base. Escribe SÓLO en el contacto que se le da, y sólo notas que después borra (salvo
// `--dejar`). No imprime el texto ni el token.
// ═══════════════════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';
import { pedirExterno } from '../../lib/http/cliente.ts';

const BASE = 'https://services.leadconnectorhq.com';
// La misma versión que `lib/ghl/cliente.ts`.
const VERSION = '2021-07-28';
const ESCALONES = [5_000, 20_000, 60_000, 120_000];

const argv = process.argv.slice(2);
const dejar = argv.includes('--dejar');
const iArchivo = argv.indexOf('--desde-archivo');
const archivo = iArchivo >= 0 ? argv[iArchivo + 1] : null;

const token = (process.env.GHL_TOKEN_PRUEBA || '').trim();
const contacto = (process.env.GHL_CONTACTO_PRUEBA || '').trim();
if (!token || !contacto) {
  console.error('Faltan GHL_TOKEN_PRUEBA y/o GHL_CONTACTO_PRUEBA en .env.fathom.');
  process.exit(2);
}

const cabeceras = { Authorization: `Bearer ${token}`, Version: VERSION, Accept: 'application/json' };

function texto(largo) {
  let base = archivo
    ? readFileSync(archivo, 'utf8')
    : Array.from({ length: 200 }, (_, i) => `[Closer]: Línea ${i + 1}, ¿qué te frenó? Año, niño, acción: ñandú.\n[Prospecto]: Mmm, el presupuesto…\n`).join('');
  if (!base.trim()) base = 'vacío ';
  let t = '';
  while (t.length < largo) t += base;
  return `MEDICIÓN DE LARGO (${largo}) · ${t}`.slice(0, largo);
}

async function ghl(ruta, opciones = {}) {
  const r = await pedirExterno(`${BASE}${ruta}`, { cabeceras, ...opciones });
  if (r.tipo === 'sin_respuesta') throw new Error(`GHL no respondió: ${r.causa}`);
  if (r.tipo === 'rechazado') throw new Error(`GHL ${r.estado}: ${r.detalle ?? r.codigo}`);
  return r.datos;
}

console.log(`Contacto de prueba: ${contacto} · ${archivo ? `texto de ${archivo}` : 'texto sintético'}\n`);
console.log('  pedido     aceptó   guardado   igual   nota');
const creadas = [];
try {
  for (const largo of ESCALONES) {
    const cuerpo = texto(largo);
    let id = null;
    try {
      const r = await ghl(`/contacts/${encodeURIComponent(contacto)}/notes`, { metodo: 'POST', cuerpo: { body: cuerpo } });
      id = r?.note?.id ?? r?.id ?? null;
    } catch (e) {
      console.log(`  ${String(largo).padStart(7)}    NO       —          —       ${e.message}`);
      continue;
    }
    if (id) creadas.push(id);
    const lista = await ghl(`/contacts/${encodeURIComponent(contacto)}/notes`);
    const nota = (lista?.notes ?? []).find((n) => n.id === id);
    const guardado = nota?.body?.length ?? null;
    // GHL puede devolver la nota con HTML o con los saltos cambiados: además de la igualdad exacta se
    // mira si, sin espacios, el texto es el mismo.
    const igual = nota?.body === cuerpo ? 'sí' : nota && nota.body.replace(/\s+/g, '') === cuerpo.replace(/\s+/g, '') ? 'sí*' : 'NO';
    console.log(`  ${String(largo).padStart(7)}    sí       ${String(guardado ?? '¿no está?').padEnd(10)} ${igual.padEnd(7)} ${id ?? '(sin id en la respuesta)'}`);
  }
  console.log('\n  sí* = mismo texto con los espacios o saltos cambiados.');
} finally {
  if (!dejar) {
    for (const id of creadas) {
      try {
        await ghl(`/contacts/${encodeURIComponent(contacto)}/notes/${encodeURIComponent(id)}`, { metodo: 'DELETE' });
      } catch (e) {
        console.log(`  ⚠ No se pudo borrar la nota ${id}: ${e.message}`);
      }
    }
    console.log(`\n${creadas.length} nota(s) de prueba borrada(s).`);
  } else console.log(`\n--dejar: quedan ${creadas.length} nota(s) en el contacto.`);
}
