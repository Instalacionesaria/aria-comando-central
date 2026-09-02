// La carga inicial de los links de cobro del CLOSER de UNA empresa.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ES UN SCRIPT Y NO UNA MIGRACIÓN
//
// Los links son datos de una empresa, no del esquema. Una migración corre contra TODAS las bases
// —producción, la local de cada quien, la de las pruebas— y ahí la empresa dueña de estos links no
// existe. Escribirla igual dejaría filas huérfanas o un `insert` que no hace nada, y en los dos
// casos la migración estaría mintiendo sobre lo que hace.
//
// La otra mitad del motivo: estos diez se cargan UNA vez. De ahí en adelante se administran en
// Closer → Inicio, que es donde tiene que estar — cambiar un precio no puede ser un despliegue.
//
// ── SOLO LA ZONA DEL CLOSER, Y NO HAY UN `--territorio` ──────────────────────
//
// La lista de abajo son diez links de cobro: Stripe y WHOP. El setter no cobra —agenda—, así que
// **no hay una lista suya que sembrar**: los suyos los carga cada empresa desde Setter → Inicio.
//
// Agregar una opción para elegir la zona sería ofrecer cargar estos diez en el menú del setter, que
// es justo lo que no tiene que pasar. La zona va fija abajo, en un solo lugar.
//
// ── POR OMISIÓN NO ESCRIBE ───────────────────────────────────────────────────
//
//   node --env-file=.env.supabase scripts/enlaces-rapidos.mjs --empresa=<slug>
//   node --env-file=.env.supabase scripts/enlaces-rapidos.mjs --empresa=<slug> --aplicar
//
// El primero muestra el plan con el NOMBRE de la empresa que encontró, que es la comprobación que
// importa: `--empresa` recibe un slug, y un slug equivocado escribiría los links de cobro de ARIA en
// la cuenta de un cliente. Mismo criterio que `scripts/altas-high-ticket.mjs` y
// `scripts/credenciales.mjs`.
//
// ── IDEMPOTENTE ──────────────────────────────────────────────────────────────
//
// Se salta los que ya están, por dirección. Correrlo dos veces no duplica nada, y agregar un link a
// la lista de abajo y volver a correrlo carga solo ése.
// ═══════════════════════════════════════════════════════════════════════════════

import { conIdentidad, cerrarClientes } from '../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../lib/datos/contexto.ts';
import { crearEnlace, listarEnlaces, urlDePagoValida } from '../lib/negocio/enlacesRapidos.ts';

const APLICAR = process.argv.includes('--aplicar');
const EMPRESA = (() => {
  const arg = process.argv.find((a) => a.startsWith('--empresa='));
  return arg ? arg.slice('--empresa='.length).trim() : null;
})();

/**
 * Los links de ARIA, en el orden en que llegaron: Stripe primero, WHOP después.
 *
 * ── EL NOMBRE ES EL PROVEEDOR, Y SE REPITE A PROPÓSITO ─────────────────────
 *
 * Cinco filas se llaman «Stripe». La unicidad de la tabla es por DIRECCIÓN, no por nombre, justo
 * para que esto se pueda escribir así: en el menú se distinguen por el monto, que es lo que uno
 * busca. Nombres artificiales del tipo «Stripe 4k» satisfarían a la base y no a quien lee.
 *
 * ── «Monto libre» ES UN MONTO ──────────────────────────────────────────────
 *
 * Es el link donde el cliente escribe cuánto paga. Va como texto porque no es un número, y ése es
 * el motivo por el que la columna es de texto — el largo está en la migración 035.
 */
/** Todos son de la zona del closer. Ver el encabezado: no hay opción para cambiarla. */
const ZONA = 'closer';

const ENLACES = [
  { nombre: 'Stripe', monto: '$4.000', descripcion: 'Pago único', url: 'https://buy.stripe.com/3cI9AUg2xeMc1bD1I97N60c' },
  { nombre: 'Stripe', monto: '$3.000', descripcion: 'Pago único', url: 'https://buy.stripe.com/4gMeVecQl8nOcUl0E57N60d' },
  { nombre: 'Stripe', monto: '$2.000', descripcion: 'Pago único', url: 'https://buy.stripe.com/8x2bJ23fLfQg4nPgD37N60e' },
  { nombre: 'Stripe', monto: '$250', descripcion: 'Pago único', url: 'https://buy.stripe.com/9B614o4jP7jKg6x5Yp7N60f' },
  { nombre: 'Stripe', monto: 'Monto libre', descripcion: 'El cliente elige cuánto paga', url: 'https://buy.stripe.com/8x2fZi3fL47y4nP0E57N60g' },
  { nombre: 'WHOP', monto: '$8.000', descripcion: 'En cuotas', url: 'https://whop.com/checkout/plan_exRHX2twhhnFQ' },
  { nombre: 'WHOP', monto: '$6.000', descripcion: 'En cuotas', url: 'https://whop.com/checkout/plan_PSZLUvZPUTeac' },
  { nombre: 'WHOP', monto: '$4.000', descripcion: 'En cuotas', url: 'https://whop.com/checkout/plan_RndmMwE6LYcht?d2c=true' },
  { nombre: 'WHOP', monto: '$3.000', descripcion: 'En cuotas', url: 'https://whop.com/checkout/plan_5whQ4JvP7P4WN?d2c=true' },
  { nombre: 'WHOP', monto: '$2.000', descripcion: 'En cuotas', url: 'https://whop.com/checkout/plan_7fC2Ryu1kv4K1?d2c=true' },
];

/**
 * Quién queda como autor de la carga.
 *
 * `enlaces_rapidos.actualizado_por` tiene una clave foránea COMPUESTA contra
 * `identidad.usuarios (org_id, id)`, así que un identificador inventado no pasa — y eso está bien.
 * Se usa el administrador principal de la empresa: es quien habría hecho esto desde la pantalla.
 */
async function quienCarga(orgId) {
  const fila = await conIdentidad(async (db) =>
    db
      .selectFrom('usuarios')
      .select(['id', 'nombre'])
      .where('org_id', '=', orgId)
      .where('activo', '=', true)
      .orderBy('creado_el')
      .executeTakeFirst(),
  );
  if (!fila) throw new Error('esa empresa no tiene ninguna persona activa: no hay a quién atribuirle la carga');
  return fila;
}

async function principal() {
  if (!EMPRESA) {
    console.error('Falta --empresa=<slug>. Sin él no se sabe a qué empresa cargarle los links, y');
    console.error('cargárselos a la equivocada le pone a un cliente nuestras cuentas de cobro.');
    process.exitCode = 1;
    return;
  }

  /* Las direcciones se validan ANTES de tocar la base. La base tiene su `check` y la ruta su
     validación; acá se comprueba para que un error de tipeo salga como una línea legible y no como
     un `23514` a mitad de la carga, con la mitad de los links adentro. */
  const malas = ENLACES.filter((e) => !urlDePagoValida(e.url));
  if (malas.length > 0) {
    console.error('Hay direcciones que no son `https://` con dominio:');
    for (const m of malas) console.error(`  ${m.nombre} ${m.monto}  ${m.url}`);
    process.exitCode = 1;
    return;
  }

  const org = await conIdentidad(async (db) =>
    db.selectFrom('organizaciones').select(['id', 'nombre', 'slug']).where('slug', '=', EMPRESA).executeTakeFirst(),
  );
  if (!org) {
    console.error(`No hay ninguna empresa con el slug "${EMPRESA}".`);
    process.exitCode = 1;
    return;
  }

  const persona = await quienCarga(org.id);
  /* Solo los de la zona que este guion carga: un link con la misma dirección en la zona del setter
     es legítimo y no tiene que hacer que éste se salte. */
  const yaHay = (await conOrganizacion(org.id, listarEnlaces)).filter((e) => e.territorio === ZONA);
  const porUrl = new Set(yaHay.map((e) => e.url));
  const faltan = ENLACES.filter((e) => !porUrl.has(e.url));

  console.log('');
  console.log(`Empresa   ${org.nombre}  (${org.slug})`);
  console.log(`Autor     ${persona.nombre}`);
  console.log(`Ya tiene  ${yaHay.length} link(s)`);
  console.log('');

  if (faltan.length === 0) {
    console.log('No falta ninguno: los diez ya están cargados.');
    return;
  }

  console.log(`Se cargarían ${faltan.length}:`);
  for (const e of faltan) {
    console.log(`  ${e.nombre.padEnd(8)} ${String(e.monto).padEnd(12)} ${e.descripcion}`);
    console.log(`           ${e.url}`);
  }
  console.log('');

  if (!APLICAR) {
    console.log('Esto es el PLAN. Para escribirlo, volvé a correrlo con --aplicar.');
    return;
  }

  /* Uno por uno y con el motivo a la vista. `crearEnlace` devuelve por qué NO guardó —`tope` o
     `url_repetida`— y tragarse eso dejaría una carga a medias que se ve igual que una completa. */
  let cargados = 0;
  for (const e of faltan) {
    const porque = await conOrganizacion(org.id, () =>
      crearEnlace({ ...e, territorio: ZONA }, persona.id),
    );
    if (porque !== null) {
      console.error(`  NO se cargó ${e.nombre} ${e.monto}: ${porque}`);
      continue;
    }
    cargados += 1;
  }

  const quedaron = await conOrganizacion(org.id, listarEnlaces);
  console.log('');
  console.log(`Cargados ${cargados}. La empresa queda con ${quedaron.length} link(s).`);
}

try {
  await principal();
} finally {
  await cerrarClientes();
}
