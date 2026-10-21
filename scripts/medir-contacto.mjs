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
// ── Y LA PREGUNTA QUE DECIDE SI ES SEGURO ESCRIBIRLOS ───────────────────────
//
// `guardar()` no corre sólo en el barrido: corre también **al abrir la ficha**, con lo que devuelva
// `GET /contacts/{id}`. Así que si un campo viniera en la búsqueda y NO en el `GET`, escribirlo sin
// condición haría que abrir una ficha **borrara la atribución** — justo cuando alguien la mira, y
// sin un solo error. Es el mismo defecto que el comentario de `sincronizar.ts` ya describe para
// `campos_del_crm`, y por eso la `039` midió las dos llamadas antes de guardar nada.
//
// Esto compara las dos respuestas para el MISMO contacto. La comparación no reemplaza al patrón de
// «clave ausente ⟹ no se escribe»: dice si la ficha refresca la atribución o sólo el cron la puebla.
//
// ── LO QUE NO HACE ──────────────────────────────────────────────────────────
//
// **Sólo lee**, por `pedirExterno`. No imprime datos de nadie: del contacto salen los NOMBRES de
// las claves y, de los campos de atribución, sólo si están presentes y su forma — nunca el valor,
// que puede ser una URL con el identificador de una persona adentro.
//
// **Mide a cada cliente activo con SU token** (el nivel 3), y con más de uno la cabecera dice
// «Empresa · Cliente». Con un cliente por empresa, mide lo mismo que medía.
// ═══════════════════════════════════════════════════════════════════════════════

import { conIdentidad, cerrarClientes } from '../lib/datos/capa.ts';
import { clientesParaBarrer } from '../lib/administracion/cuentas.ts';
import { resolverAccesoAGhl } from '../lib/credenciales/resolver.ts';
import { pedirExterno } from '../lib/http/cliente.ts';

const BASE = 'https://services.leadconnectorhq.com';
const VERSION = '2021-07-28';
const CUANTOS = 100;

/** Los nombres que el documento necesita. Se busca por forma, no por corazonada. */
const DE_ATRIBUCION = /attribution|utm|fbclid|gclid|referrer|campaign|adset|ad_?id|creative|session/i;

/**
 * Las cinco claves que se van a declarar y guardar. La comparación search vs GET es sobre ÉSTAS y
 * no sobre todas: lo que importa no es que las dos respuestas sean idénticas —no lo son, el `GET`
 * trae más— sino que ninguna de las cinco desaparezca al abrir la ficha.
 */
const LAS_QUE_VAMOS_A_GUARDAR = [
  'dateAdded',
  'attributionSource',
  'lastAttributionSource',
  'timezone',
  'country',
];

/** Presente = tiene valor. Un objeto vacío no es presencia: no hay nada que guardar. */
function presente(v) {
  if (v === null || v === undefined || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

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
    /* Sus clientes ACTIVOS (el nivel 3), cada uno con SU token y SU subcuenta, el principal primero: los contactos de
       otro cliente están en otra subcuenta, y el GET de uno con el token de otro no lo encuentra. */
    const clientes = await conIdentidad(async (db) => {
      const nombres = new Map(
        (await db.selectFrom('cuentas').select(['id', 'nombre']).where('org_id', '=', org.id).execute()).map((c) => [
          c.id,
          c.nombre,
        ]),
      );
      const salida = [];
      for (const cuenta of await clientesParaBarrer(db, org.id)) {
        salida.push({ cuenta, nombre: nombres.get(cuenta.id) ?? cuenta.id, acceso: await resolverAccesoAGhl(db, org.id, cuenta) });
      }
      return salida;
    });
    const varios = clientes.length > 1;
    for (const c of clientes) await medirUnCliente(org, c, varios);
  }
}

/**
 * La medición de UN cliente: sus contactos más nuevos y el GET de uno, con SU token. Con un solo cliente, la cabecera es
 * la de la empresa, como antes. Cada `return` corta a este cliente y no a los demás; los dos `continue` de adentro
 * saltean una clave vacía o una que no es de atribución.
 */
async function medirUnCliente(org, { nombre, acceso }, varios) {
  const titulo = varios ? `${org.nombre} · ${nombre}` : org.nombre;
  if (acceso.tipo !== 'listo') {
    // Con un cliente se calla, como antes: una empresa sin token no es noticia. Con varios, el que falta se nombra.
    if (varios) console.log(`\n═══ ${titulo} ═══\n  SIN MEDIR — sin acceso al CRM (${acceso.que})`);
    return;
  }

  console.log(`\n═══ ${titulo} ═══`);

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
    return;
  }

  const lista = Array.isArray(r.datos?.contacts) ? r.datos.contacts : [];
  if (lista.length === 0) {
    console.log('  la subcuenta no devolvió contactos.');
    return;
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

  /* La cobertura de las cinco, junta. `timezone` y `country` no los pesca el regex de atribución
     —no tienen por qué— y sin esto aparecen en la lista de claves sin decir en cuántos vienen. */
  console.log('\n  cobertura de las cinco que se van a guardar:');
  for (const k of LAS_QUE_VAMOS_A_GUARDAR) {
    console.log(`    ${k.padEnd(34)} ${String(claves.get(k) ?? 0).padStart(4)} de ${lista.length}`);
  }

  // El GET, con el token de ESTE cliente: el contacto es de su subcuenta.
  await compararConElGet(acceso, lista);
}

/**
 * ¿El `GET /contacts/{id}` trae las mismas cinco claves que la búsqueda?
 *
 * Se mide sobre el primer contacto que las traiga en la búsqueda: preguntarle al que no las tiene
 * no distingue «el GET no las manda» de «este contacto no las tiene», que es la confusión que
 * volvería inútil la medición.
 */
async function compararConElGet(acceso, lista) {
  const conAlguna = lista.find((c) => LAS_QUE_VAMOS_A_GUARDAR.some((k) => presente(c?.[k])));
  if (conAlguna === undefined) {
    console.log('\n  Ningún contacto de la búsqueda trae ninguna de las cinco: nada que comparar.');
    return;
  }

  const r = await pedirExterno(`${BASE}/contacts/${conAlguna.id}`, { cabeceras: cabeceras(acceso.token) });
  if (r.tipo !== 'datos') {
    console.log(`\n  el GET del contacto no respondió: ${r.tipo} ${r.estado ?? r.causa ?? ''}`);
    return;
  }
  const delGet = r.datos?.contact ?? r.datos ?? {};

  console.log('\n  ┌─ ¿ABRIR LA FICHA BORRARÍA LO QUE GUARDÓ EL BARRIDO? ──────────────');
  console.log('  │  clave                      search   GET');
  let ausenteEnElGet = 0;
  for (const k of LAS_QUE_VAMOS_A_GUARDAR) {
    const enBusqueda = presente(conAlguna[k]);
    const enElGet = presente(delGet[k]);
    if (enBusqueda && !enElGet) ausenteEnElGet++;
    console.log(`  │  ${k.padEnd(26)} ${enBusqueda ? 'sí' : 'no'}       ${enElGet ? 'sí' : 'no'}`);
  }
  console.log('  │');
  console.log(
    ausenteEnElGet === 0
      ? '  │  Las que trae la búsqueda las trae también el GET: la ficha las refresca.'
      : `  │  ${ausenteEnElGet} de las cinco vienen en la búsqueda y NO en el GET. El patrón de\n` +
          '  │  «clave ausente ⟹ no se escribe» deja de ser prolijidad y pasa a ser lo único\n' +
          '  │  que impide que abrir una ficha borre lo que el cron guardó.',
  );
  console.log('  └──────────────────────────────────────────────────────────────────');
}

try {
  await main();
} finally {
  await cerrarClientes();
}
