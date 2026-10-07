// ¿Cómo se trae de GoHighLevel el gasto de TODA la cuenta publicitaria? **Medición, no deducción.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA PREGUNTA
//
// El 2026-10-07 la app informaba 0 de inversión en 7 días y 865,58 en 30 contra $200,19 y $2.234,55 del
// Administrador de anuncios de la misma cuenta: el colector diario pedía sólo las 13 campañas que nombraba la
// atribución de los contactos, y una campaña de mensajes no aparecía nunca ahí. Antes de arreglarlo se midió
// qué entrega el proveedor:
//
//   S1 · la serie diaria de la cuenta (`/reporting?groupBy=day`): ¿suma lo que dice Meta? ¿manda los días en 0?
//   S2 · `/reporting/list?listType=ads` SIN `campaignId`: ¿da todos los anuncios de la cuenta en un día?
//   S3 · `listType=campaigns` de un día: ¿trae el gasto por campaña?
//   S4 · `listType=ads` de una campaña con un RANGO: ¿el total del rango es el de Meta? ¿cómo viene un cero?
//
// ── LO QUE DIJO, EL 2026-10-07 ──────────────────────────────────────────────
//
//   S1 · Del 18-ago al 6-oct (50 días) vinieron **25 filas**, cortadas el 11-sep, y `totals` sumaba sólo esas:
//        el proveedor corta en 25 filas y no lo dice. Partida en tramos, la serie suma 200,19 en 7 días y
//        2.234,55 en 30, **al centavo** con Meta. Los días sin gasto no vienen: del 12-sep al 6-oct (25 días)
//        llegaron 23 filas, y la suma coincide. De ahí `DIAS_POR_TRAMO_DE_LA_SERIE` y los ceros de los días
//        que no vinieron (`lib/ghl/anuncios.ts`).
//   S2 · 422 los dos días: `campaignId` es obligatorio. No hay una llamada por día para toda la cuenta.
//   S3 · 200 con las 61 campañas y **ninguna con `spend`**: no sirve para saber quién gastó.
//   S4 · La campaña de mensajes del 30-sep al 6-oct: 3 anuncios, 200,19, igual a Meta; su objetivo es
//        `OUTCOME_ENGAGEMENT`. Una campaña que nunca gastó, en 50 días: 5 anuncios sin `spend` ni
//        `impressions`, suma 0. De ahí `totalDeLaCampana` y el relleno por rangos (`rellenarAnuncios.ts`).
//   Las latencias: la serie 0,6 a 1 s por tramo; un rango de una campaña, 2 a 4,6 s; un 422, 0,2 a 0,3 s.
//
// ── CÓMO SE CORRE ───────────────────────────────────────────────────────────
//
//   node --env-file=.env.supabase scripts/medir-gasto-de-la-cuenta.mjs                       → dice cuántas llamadas hace
//   node --env-file=.env.supabase scripts/medir-gasto-de-la-cuenta.mjs --confirmo [--campana=ID --desde=AAAA-MM-DD --hasta=AAAA-MM-DD]
//
// La campaña de S4 va por argumento y no escrita acá: el repositorio es público, y un nombre de campaña puede
// llevar el nombre de una persona. Sin `--campana`, S4 no corre.
//
// ── LO QUE NO HACE ──────────────────────────────────────────────────────────
//
// **Sólo lee**: todas las llamadas son GET, y no escribe en la base ni en disco. No imprime ids, nombres ni
// tokens. Imprime estados, conteos, sumas, la unión de claves y los milisegundos. El texto de un 4xx sí se
// imprime, porque valida la PETICIÓN, no es un dato.
// ═══════════════════════════════════════════════════════════════════════════════

import { conIdentidad, cerrarClientes } from '../lib/datos/capa.ts';
import { resolverAccesoAGhl } from '../lib/credenciales/resolver.ts';
import { pedirExterno } from '../lib/http/cliente.ts';
import { serieDeLaCuenta } from '../lib/ghl/anuncios.ts';

const BASE = 'https://services.leadconnectorhq.com/ad-publishing/facebook';
const VERSION = '2021-07-28';
const SECRETO = /token|secret|access|password|cookie/i;
let llamadas = 0;

/** Un argumento `--nombre=valor`, o `null`. */
function argumento(nombre) {
  const a = process.argv.find((x) => x.startsWith(`--${nombre}=`));
  return a ? a.slice(nombre.length + 3) : null;
}

/** Un día `n` días antes de hoy, en UTC. */
const haceDias = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

async function leer(camino, token) {
  llamadas += 1;
  const t0 = Date.now();
  const r = await pedirExterno(`${BASE}${camino}`, {
    cabeceras: { Authorization: `Bearer ${token}`, Version: VERSION, Accept: 'application/json' },
  });
  return { r, ms: Date.now() - t0 };
}

function describir({ r, ms }) {
  if (r.tipo === 'datos') return `200 en ${ms} ms`;
  if (r.tipo === 'rechazado') return `rechazado ${r.estado} (${r.codigo})${r.detalle ? `: ${String(r.detalle).slice(0, 240)}` : ''} en ${ms} ms`;
  return `sin respuesta (${r.causa}) en ${ms} ms`;
}

/** La unión de claves de un valor, con camino, hasta cuatro niveles. */
function claves(valor, prefijo = '', salida = new Set(), nivel = 0) {
  if (nivel > 4 || valor === null || typeof valor !== 'object') return salida;
  if (Array.isArray(valor)) {
    for (const v of valor.slice(0, 50)) claves(v, `${prefijo}[]`, salida, nivel + 1);
    return salida;
  }
  for (const [k, v] of Object.entries(valor)) {
    const camino = prefijo ? `${prefijo}.${k}` : k;
    if (SECRETO.test(k)) {
      salida.add(`${camino} (forma de secreto)`);
      continue;
    }
    salida.add(camino);
    claves(v, camino, salida, nivel + 1);
  }
  return salida;
}

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const suma = (filas, campo = 'spend') => Math.round(filas.reduce((s, f) => s + (num(f?.[campo]) ?? 0), 0) * 100) / 100;
const filasDe = (datos) => (Array.isArray(datos) ? datos : Array.isArray(datos?.data) ? datos.data : null);

async function principal() {
  const confirmo = process.argv.includes('--confirmo');
  const campana = argumento('campana');
  const desde = argumento('desde') ?? haceDias(7);
  const hasta = argumento('hasta') ?? haceDias(1);
  const primera = haceDias(50);
  console.log(
    `Sondas del gasto de la cuenta: ${campana ? 8 : 7} llamadas GET a GoHighLevel con el token de la empresa principal ` +
      '(la serie de 50 días va en 3 tramos).',
  );
  if (!confirmo) {
    console.log('No corre sin el OK. Para correrla: --confirmo');
    return;
  }
  const org = await conIdentidad((db) => db.selectFrom('organizaciones').select('id').where('es_principal', '=', true).executeTakeFirstOrThrow());
  const acceso = await conIdentidad((db) => resolverAccesoAGhl(db, org.id));
  if (acceso.tipo !== 'listo') {
    console.log(`Sin acceso a GoHighLevel: ${acceso.tipo}`);
    return;
  }
  const loc = `locationId=${encodeURIComponent(acceso.locationId)}`;
  const t = acceso.token;

  // S1 · La serie de la cuenta: primero de una vez, para ver el corte, y después con el cliente, en tramos.
  const campos = encodeURIComponent('impressions,clicks,spend,cpc,cpm,reach,frequency');
  const entera = await leer(`/reporting?${loc}&groupBy=day&type=INTEGRATION&startDate=${primera}&endDate=${hasta}&fields=${campos}`, t);
  const filas = entera.r.tipo === 'datos' && Array.isArray(entera.r.datos?.grouped) ? entera.r.datos.grouped : [];
  const fechas = filas.map((f) => String(f?.dateStart ?? '')).sort();
  console.log(`S1 · serie de ${primera} a ${hasta}, de una vez: ${describir(entera)}`);
  console.log(`     ${filas.length} filas, de ${fechas[0] ?? '—'} a ${fechas.at(-1) ?? '—'}; suma ${suma(filas)}; totals.spend ${num(entera.r.datos?.totals?.spend)}`);
  const t0 = Date.now();
  const porTramos = await serieDeLaCuenta(acceso, primera, hasta);
  llamadas += porTramos.llamadas;
  if (porTramos.tipo === 'datos') {
    const enLaVentana = porTramos.datos.filter((d) => d.dia >= desde && d.dia <= hasta);
    const centavos = (lista) => Math.round(lista.reduce((s, d) => s + (d.gasto ?? 0), 0) * 100) / 100;
    console.log(
      `     en tramos: ${porTramos.llamadas} llamadas en ${Date.now() - t0} ms; ${porTramos.datos.length} días, ` +
        `${porTramos.datos.filter((d) => (d.gasto ?? 0) > 0).length} con gasto; suma ${centavos(porTramos.datos)}; ` +
        `de ${desde} a ${hasta}: ${centavos(enLaVentana)}`,
    );
  } else {
    console.log(`     en tramos: falló (${porTramos.fallo.tipo})`);
  }

  // S2 · Todos los anuncios de la cuenta en un día, sin campaignId.
  {
    const r = await leer(`/reporting/list?${loc}&listType=ads&type=INTEGRATION&startDate=${hasta}&endDate=${hasta}`, t);
    console.log(`\nS2 · anuncios sin campaignId, ${hasta}: ${describir(r)}`);
  }

  // S3 · Las campañas de un día, a ver si traen gasto.
  {
    const r = await leer(`/reporting/list?${loc}&listType=campaigns&type=INTEGRATION&startDate=${hasta}&endDate=${hasta}`, t);
    console.log(`\nS3 · campañas de un día (${hasta}): ${describir(r)}`);
    const lista = r.r.tipo === 'datos' ? filasDe(r.r.datos) : null;
    if (lista) console.log(`     ${lista.length} filas; ${lista.filter((f) => num(f?.spend) !== null).length} con spend; claves: ${[...claves(lista.slice(0, 5))].join(', ')}`);
  }

  // S4 · Una campaña, con un rango.
  if (campana) {
    const r = await leer(`/reporting/list?${loc}&listType=ads&type=INTEGRATION&campaignId=${encodeURIComponent(campana)}&startDate=${desde}&endDate=${hasta}`, t);
    console.log(`\nS4 · la campaña pedida, ${desde} a ${hasta}: ${describir(r)}`);
    const lista = r.r.tipo === 'datos' ? filasDe(r.r.datos) : null;
    if (lista) {
      const objetivos = [...new Set(lista.map((f) => f?.objective))].join(', ');
      console.log(`     ${lista.length} anuncios, ${lista.filter((f) => (num(f?.spend) ?? 0) > 0).length} con gasto, suma ${suma(lista)}; objetivos: ${objetivos || '—'}`);
    }
  }
  console.log(`\nTotal: ${llamadas} llamadas.`);
}

principal()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => cerrarClientes());
