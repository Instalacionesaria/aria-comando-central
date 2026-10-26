// ¿Cómo llega el cuadrante del ICP desde el CRM? **Medición, antes de escribir una línea que dependa de él.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA PREGUNTA (el paso Q0 del cuadrante del ICP, 2026-10-26)
//
// El puntaje del lead deja de ser «Puntaje | ICP», un número de 0 a 100, y pasa a ser una de cuatro palabras
// —Prioriza, Valida, Financia, Descarta— que GoHighLevel calcula y manda en el campo `contact.cuadrante_de_clasificacion`.
// El plan reconoce el campo por su `fieldKey` (la memoria `fieldkey-de-ghl`: el id cambia de subcuenta en subcuenta y
// el nombre se edita; la clave no). Antes de escribirlo hay que ver, en cada cliente:
//
//   · que el campo exista con ESA clave exacta, y con qué id, nombre, tipo y opciones;
//   · qué textos llegan de verdad en los contactos: si son las cuatro palabras, con qué mayúsculas y espacios, y
//     cuántos contactos ya lo traen —el usuario dice que GHL clasifica también a los viejos—.
//
//   node --env-file=.env.supabase scripts/medir-cuadrante.mjs
//
// ── LO QUE NO HACE ──────────────────────────────────────────────────────────
//
// **Sólo lee**, por `pedirExterno`, con el token de cada cliente activo. No imprime datos de nadie: del catálogo, la
// definición del campo; de los contactos, cuántos traen cada valor. Un valor que no es una de las cuatro palabras se
// cuenta por su largo, nunca se imprime: un campo de texto libre podría traer cualquier cosa.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { conIdentidad, cerrarClientes } from '../lib/datos/capa.ts';
import { clientesParaBarrer } from '../lib/administracion/cuentas.ts';
import { resolverAccesoAGhl } from '../lib/credenciales/resolver.ts';
import { pedirExterno } from '../lib/http/cliente.ts';

const BASE = 'https://services.leadconnectorhq.com';
/** La versión de los contactos y del catálogo: la misma que `VERSION_CONTACTOS` de `lib/ghl/cliente.ts`. */
const VERSION = '2021-07-28';
const CUANTOS = 100;

/** La clave que el plan va a fijar en `lib/ghl/contrato.ts`. */
const CLAVE = 'contact.cuadrante_de_clasificacion';

/** Las cuatro palabras, normalizadas como las va a normalizar `cuadranteDeUnValor`. */
const PALABRAS = ['prioriza', 'valida', 'financia', 'descarta'];

const normalizar = (t) =>
  String(t)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

function cabeceras(token) {
  return { Authorization: `Bearer ${token}`, Version: VERSION, Accept: 'application/json' };
}

async function main() {
  const orgs = await conIdentidad(async (db) =>
    db.selectFrom('organizaciones').select(['id', 'nombre']).orderBy('nombre').execute(),
  );
  /* Producción todavía no tiene clientes (la `082` y las que siguen no se subieron): ahí cada empresa es una subcuenta,
     la de su credencial. Con la base del nivel 3, cada cliente activo con la suya. */
  const conClientes = await conIdentidad(async (db) =>
    (await sql`select to_regclass('identidad.cuentas') is not null as hay`.execute(db)).rows[0].hay,
  );
  for (const org of orgs) {
    if (!conClientes) {
      const acceso = await conIdentidad((db) => resolverAccesoAGhl(db, org.id, 'la_de_la_empresa'));
      await medirUnCliente(org.nombre, acceso);
      continue;
    }
    const clientes = await conIdentidad(async (db) => {
      const nombres = new Map(
        (await db.selectFrom('cuentas').select(['id', 'nombre']).where('org_id', '=', org.id).execute()).map((c) => [
          c.id,
          c.nombre,
        ]),
      );
      const salida = [];
      for (const cuenta of await clientesParaBarrer(db, org.id)) {
        salida.push({ nombre: nombres.get(cuenta.id) ?? cuenta.id, acceso: await resolverAccesoAGhl(db, org.id, cuenta) });
      }
      return salida;
    });
    for (const c of clientes) await medirUnCliente(`${org.nombre} · ${c.nombre}`, c.acceso);
  }
}

async function medirUnCliente(titulo, acceso) {
  if (acceso.tipo !== 'listo') {
    console.log(`\n═══ ${titulo} ═══\n  SIN MEDIR — sin acceso al CRM (${acceso.que})`);
    return;
  }
  console.log(`\n═══ ${titulo} ═══`);

  // ── El catálogo: el campo con ESA clave, y los que se le parecen por si la clave no es la esperada ──
  const cat = await pedirExterno(`${BASE}/locations/${encodeURIComponent(acceso.locationId)}/customFields`, {
    cabeceras: cabeceras(acceso.token),
  });
  if (cat.tipo !== 'datos' || !Array.isArray(cat.datos?.customFields)) {
    console.log(`  no se pudo leer el catálogo: ${cat.tipo} ${cat.estado ?? cat.causa ?? ''}`);
    return;
  }
  const campos = cat.datos.customFields;
  const conClave = campos.filter((f) => typeof f?.fieldKey === 'string').length;
  console.log(`  catálogo: ${campos.length} entradas, ${conClave} con fieldKey`);

  const exacto = campos.find((f) => f?.fieldKey === CLAVE);
  const parecidos = campos.filter((f) => f !== exacto && /cuadrante|clasificaci/i.test(`${f?.fieldKey ?? ''} ${f?.name ?? ''}`));
  for (const f of [exacto, ...parecidos].filter(Boolean)) {
    console.log(`  ${f === exacto ? 'EL CAMPO' : 'parecido'}:`);
    console.log(`    id ${f.id} · fieldKey ${f.fieldKey} · nombre «${f.name}» · tipo ${f.dataType} · carpeta ${f.parentId}`);
    const opciones = f.picklistOptions ?? f.options ?? null;
    if (opciones !== null) console.log(`    opciones: ${JSON.stringify(opciones)}`);
  }
  if (!exacto) {
    console.log(`  NO HAY un campo con fieldKey «${CLAVE}».`);
    return;
  }

  // ── Los contactos más nuevos: qué valores traen en ese campo ──
  const r = await pedirExterno(`${BASE}/contacts/search`, {
    metodo: 'POST',
    cabeceras: cabeceras(acceso.token),
    cuerpo: { locationId: acceso.locationId, pageLimit: CUANTOS, sort: [{ field: 'dateAdded', direction: 'desc' }] },
  });
  if (r.tipo !== 'datos') {
    console.log(`  no se pudieron traer contactos: ${r.tipo} ${r.estado ?? r.causa ?? ''}`);
    return;
  }
  const lista = Array.isArray(r.datos?.contacts) ? r.datos.contacts : [];
  const valores = new Map();
  let sinCampo = 0;
  for (const c of lista) {
    const v = (c?.customFields ?? []).find((x) => x?.id === exacto.id)?.value;
    if (v === undefined || v === null || String(v).trim() === '') {
      sinCampo++;
      continue;
    }
    const crudo = Array.isArray(v) ? `[arreglo de ${v.length}]` : typeof v === 'object' ? '[objeto]' : String(v);
    const clave = PALABRAS.includes(normalizar(crudo))
      ? `«${crudo}» (${typeof v})`
      : `OTRO: ${typeof v}, ${crudo.length} caracteres`;
    valores.set(clave, (valores.get(clave) ?? 0) + 1);
  }
  console.log(`  contactos mirados: ${lista.length} (los más nuevos) · sin el campo: ${sinCampo}`);
  for (const [k, n] of [...valores.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k.padEnd(40)} ${String(n).padStart(4)}`);
  }
}

try {
  await main();
} finally {
  await cerrarClientes();
}
