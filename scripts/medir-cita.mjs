// ¿GoHighLevel dice cuándo se RESERVÓ una cita? **Medición, no deducción.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ EXISTE ESTE ARCHIVO
//
// `lib/ghl/calendarios.ts` empieza diciendo: *«TODO ESTE ARCHIVO SALE DE MEDIR LA SUBCUENTA REAL.
// NO HAY ESPECIFICACIÓN»*. Sus seis hallazgos numerados salieron de llamadas de verdad, y ninguno
// menciona un sello de creación.
//
// Hace falta uno: sin la fecha en que la cita se RESERVÓ, ninguna tasa del embudo se puede dar por
// período —sólo acumulada—, y ése es el techo de Conversation Intelligence hoy. El nombre no se
// puede adivinar: en las dos familias vecinas de la MISMA API el sello de creación se llama
// `dateAdded` (contactos en `lib/ghl/cliente.ts`, mensajes en `lib/ghl/conversaciones.ts`), no
// `createdAt`. Escribir uno de los dos a ciegas sería la primera línea del repositorio que afirma
// un campo del CRM sin medirlo.
//
//   node --env-file=.env.supabase scripts/medir-cita.mjs
//
// ── LO QUE ESTE GUION NO HACE, Y ES DELIBERADO ──────────────────────────────
//
// **No imprime datos de nadie.** La respuesta trae citas reales: títulos, identificadores de
// contacto, direcciones de sala. Acá se imprime el CONJUNTO DE CLAVES y, de los campos que parecen
// fechas, sólo su valor —que es lo único que responde la pregunta—. Los demás valores se reducen a
// su tipo y su largo. Una medición no necesita ver el contenido, y volcarlo dejaría datos de
// clientes en un registro de consola.
//
// **Sólo hace `GET`.** Dos llamadas: la lista de calendarios, y los eventos de uno. No escribe
// nada, ni en el CRM ni en la base.
//
// **Y la petición va por `pedirExterno`**, como todo el resto del proyecto. No es prolijidad: el
// `ADR-0305` afirma que `fetch(` aparece en **exactamente dos** archivos, y `30-portero` lo
// comprueba. Un guion de medición con su propio `fetch` parece inofensivo —corre a mano, contra la
// API del proveedor, sin pantalla que llenar— y ése es justamente el argumento con el que la lista
// de excepciones crece hasta que nadie sabe cuántos clientes HTTP hay. El cable trampa saltó acá y
// se le hizo caso.
// ═══════════════════════════════════════════════════════════════════════════════

import { conIdentidad, cerrarClientes } from '../lib/datos/capa.ts';
import { resolverAccesoAGhl } from '../lib/credenciales/resolver.ts';
import { listarCalendarios } from '../lib/ghl/calendarios.ts';
import { pedirExterno } from '../lib/http/cliente.ts';

/** Los nombres que podrían ser un sello de creación. Se busca por forma, no por corazonada. */
const SOSPECHOSAS = /(^|_)(created|added|date|fecha|stamp|at)($|_)|createdAt|dateAdded|dateUpdated/i;

/** Un valor, reducido a lo que se puede imprimir sin exponer a nadie. */
function seguro(clave, v) {
  if (v === null || v === undefined) return String(v);
  if (typeof v === 'boolean' || typeof v === 'number') return `${typeof v}: ${v}`;
  if (typeof v !== 'string') return `${Array.isArray(v) ? 'array' : typeof v}(${JSON.stringify(v).length} bytes)`;
  // Sólo se muestra entero lo que parece una fecha, que es lo que vinimos a medir.
  const pareceFecha = /^\d{4}-\d{2}-\d{2}|^\d{10,13}$/.test(v.trim());
  if (pareceFecha || SOSPECHOSAS.test(clave)) return `"${v}"`;
  return `string(${v.length})`;
}

async function main() {
  const orgs = await conIdentidad(async (db) =>
    db.selectFrom('organizaciones').select(['id', 'nombre']).orderBy('nombre').execute(),
  );

  for (const org of orgs) {
    const acceso = await conIdentidad(async (db) => resolverAccesoAGhl(db, org.id));
    if (acceso.tipo !== 'listo') continue;

    console.log(`\n═══ ${org.nombre} ═══`);
    const cals = await listarCalendarios(acceso);
    if (cals.tipo !== 'datos') {
      console.log('  no se pudieron leer los calendarios:', cals.fallo?.que ?? '(sin motivo)');
      continue;
    }
    console.log(`  calendarios: ${cals.datos.length}`);

    // Una ventana ancha hacia atrás: se busca una cita cualquiera, no las de hoy.
    const hasta = new Date();
    const desde = new Date(hasta.getTime() - 120 * 86_400_000);

    for (const cal of cals.datos) {
      const q = new URLSearchParams({
        locationId: acceso.locationId,
        calendarId: cal.id,
        startTime: String(desde.getTime()),
        endTime: String(hasta.getTime()),
      });
      const r = await pedirExterno(`https://services.leadconnectorhq.com/calendars/events?${q}`, {
        cabeceras: {
          Authorization: `Bearer ${acceso.token}`,
          Version: '2021-04-15',
          Accept: 'application/json',
        },
      });
      if (r.tipo !== 'datos') {
        console.log(`  ${cal.id}: ${r.tipo} ${r.estado ?? r.causa ?? ''} ${r.codigo ?? ''}`.trimEnd());
        continue;
      }
      const eventos = Array.isArray(r.datos?.events) ? r.datos.events : [];
      if (eventos.length === 0) continue;

      console.log(`\n  calendario ${cal.id} — ${eventos.length} evento(s). Claves del primero:`);
      const e = eventos[0];
      for (const k of Object.keys(e).sort()) console.log(`    ${k.padEnd(22)} ${seguro(k, e[k])}`);

      /* El censo COMPLETO, no sólo el de las candidatas. Un campo puede venir en algunos eventos y
         no en el primero —`rescheduledAt` es justamente así de esperable— y filtrar antes de contar
         es cómo una medición termina respondiendo la pregunta que uno hizo en vez de la que tenía. */
      const todas = new Set();
      for (const ev of eventos) for (const k of Object.keys(ev)) todas.add(k);
      console.log(`
  censo sobre los ${eventos.length} eventos — TODAS las claves vistas:`);
      for (const k of [...todas].sort()) {
        const n = eventos.filter((ev) => ev[k] !== null && ev[k] !== undefined && ev[k] !== '').length;
        const marca = SOSPECHOSAS.test(k) || /reschedul|assign/i.test(k) ? '  <<<' : '';
        console.log(`    ${k.padEnd(22)} presente en ${String(n).padStart(4)} de ${eventos.length}${marca}`);
      }

      /* Y la comprobación que de verdad decide si `reservada_el` sirve: ¿`dateAdded` es distinto de
         `startTime`? Si fueran iguales, sería la hora de la cita con otro nombre y no la de reserva. */
      const distintos = eventos.filter((ev) => {
        const a = ev.dateAdded ? new Date(ev.dateAdded).getTime() : null;
        const b = ev.startTime ? new Date(ev.startTime).getTime() : null;
        return a !== null && b !== null && Math.abs(a - b) > 60_000;
      }).length;
      console.log(`
  dateAdded difiere de startTime en más de un minuto: ${distintos} de ${eventos.length}`);

      const antes = eventos.filter((ev) => {
        const a = ev.dateAdded ? new Date(ev.dateAdded).getTime() : null;
        const b = ev.startTime ? new Date(ev.startTime).getTime() : null;
        return a !== null && b !== null && a < b;
      }).length;
      console.log(`  y es ANTERIOR a la cita (que es lo que tiene que ser): ${antes} de ${eventos.length}`);

      return; // Con un calendario que tenga citas alcanza para responder la pregunta.
    }
    console.log('  ningún calendario devolvió citas en la ventana.');
  }
}

try {
  await main();
} finally {
  await cerrarClientes();
}
