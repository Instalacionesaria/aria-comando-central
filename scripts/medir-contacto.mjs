// ¿El CRM manda la atribución del anuncio? **Medición, no deducción.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA PREGUNTA, Y CUÁNTO DINERO DECIDE
//
// El documento de arquitectura pide, para Lead Flow: campaña de origen, ad set, anuncio, creativo,
// UTM de primer y último toque, y landing de origen. La respuesta obvia es «hace falta conectar la
// API de Meta», que es una app, un token de larga duración y una revisión de app.
//
// Pero puede que no haga falta: GoHighLevel documenta un `attributionSource` /
// `lastAttributionSource` en el contacto —con `utmSource`, `utmMedium`, `utmContent`,
// `utmCampaign`, `referrer`, `fbclid` y `sessionSource`— y `ContactoDeGhl` **no lo declara**, así
// que si viene, se descarta al parsear LA MISMA respuesta que ya pedimos.
//
// Esto lo mide. Si viene poblado, la atribución cuesta declarar unos campos y una columna; si no
// viene, entonces sí hay que ir a Meta.
//
//   node --env-file=.env.supabase scripts/medir-contacto.mjs
//
// Y de paso la otra pregunta barata: **`dateAdded`**, que está declarado en el tipo y sólo se usa
// para ordenar. Es la fecha real de entrada del lead, y hoy toda cohorte se arma con `creado_el`
// —cuándo lo vio NUESTRO barrido—, que en la carga inicial es la misma para todos.
//
// ── LO QUE NO HACE ──────────────────────────────────────────────────────────
//
// **Sólo `GET`**, por `pedirExterno`. No imprime datos de nadie: del contacto salen los NOMBRES de
// las claves y, de los campos de atribución, sólo si están presentes y su forma — nunca el valor,
// que puede ser una URL con el identificador de una persona adentro.
// ═══════════════════════════════════════════════════════════════════════════════

import { conIdentidad, cerrarClientes } from '../lib/datos/capa.ts';
import { resolverAccesoAGhl } from '../lib/credenciales/resolver.ts';
import { pedirExterno } from '../lib/http/cliente.ts';

const BASE = 'https://services.leadconnectorhq.com';
const VERSION = '2021-07-28';
const CUANTOS = 100;

/** Los nombres que el documento necesita. Se busca por forma, no por corazonada. */
const DE_ATRIBUCION = /attribution|utm|fbclid|gclid|referrer|campaign|adset|ad_?id|creative|session/i;

function cabeceras(token) {
  return { Authorization: `Bearer ${token}`, Version: VERSION, Accept: 'application/json' };
}

function sumar(mapa, clave) {
  mapa.set(clave, (mapa.get(clave) ?? 0) + 1);
}

function imprimir(titulo, mapa, total) {
  console.log(`\n  ${titulo}`);
  const filas = [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  if (filas.length === 0) return console.log('    (ninguno)');
  for (const [k, n] of filas) {
    console.log(`    ${String(k).padEnd(34)} ${String(n).padStart(4)} de ${total}`);
  }
}

async function main() {
  const orgs = await conIdentidad(async (db) =>
    db.selectFrom('organizaciones').select(['id', 'nombre']).orderBy('nombre').execute(),
  );

  for (const org of orgs) {
    const acceso = await conIdentidad(async (db) => resolverAccesoAGhl(db, org.id));
    if (acceso.tipo !== 'listo') continue;

    console.log(`\n═══ ${org.nombre} ═══`);

    const r = await pedirExterno(`${BASE}/contacts/search`, {
      metodo: 'POST',
      cabeceras: cabeceras(acceso.token),
      cuerpo: {
        locationId: acceso.locationId,
        pageLimit: CUANTOS,
        sort: [{ field: 'dateAdded', direction: 'desc' }],
      },
    });
    if (r.tipo !== 'datos') {
      console.log(`  no se pudieron traer contactos: ${r.tipo} ${r.estado ?? r.causa ?? ''}`);
      continue;
    }

    const lista = Array.isArray(r.datos?.contacts) ? r.datos.contacts : [];
    if (lista.length === 0) {
      console.log('  la subcuenta no devolvió contactos.');
      continue;
    }
    console.log(`  contactos mirados: ${lista.length} (los más nuevos)`);

    const claves = new Map();
    const atribucion = new Map();
    let conDateAdded = 0;

    for (const c of lista) {
      const o = c ?? {};
      for (const [k, v] of Object.entries(o)) {
        if (v === null || v === undefined || v === '') continue;
        sumar(claves, k);
        if (!DE_ATRIBUCION.test(k)) continue;
        /* De los campos de atribución se mira la FORMA, nunca el valor: un `referrer` o una url de
           sesión puede llevar el identificador de una persona adentro. */
        if (typeof v === 'object' && !Array.isArray(v)) {
          for (const k2 of Object.keys(v)) {
            if (v[k2] !== null && v[k2] !== undefined && v[k2] !== '') sumar(atribucion, `${k}.${k2}`);
          }
        } else {
          sumar(atribucion, `${k} : ${Array.isArray(v) ? 'array' : typeof v}`);
        }
      }
      if (o.dateAdded) conDateAdded++;
    }

    console.log(`\n  TODAS las claves con valor (${claves.size}):`);
    console.log('    ' + [...claves.keys()].sort().join(', '));

    console.log('\n  ┌─ LO QUE DECIDE SI HACE FALTA EL API DE META ──────────────────────');
    imprimir('campos de atribución presentes:', atribucion, lista.length);
    console.log('  │');
    console.log('  │  El documento pide: campaña, ad set, anuncio, creativo, UTM de primer y último');
    console.log('  │  toque, y landing de origen. Lo que no aparezca arriba, no viene por acá.');
    console.log('  └──────────────────────────────────────────────────────────────────');

    console.log(`\n  \`dateAdded\` (la fecha real de entrada del lead): ${conDateAdded} de ${lista.length}`);
  }
}

try {
  await main();
} finally {
  await cerrarClientes();
}
