// El relleno del cuadrante del ICP para los calificados viejos. **En seco por omisión: no escribe nada.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ HACE (decisión del usuario, 2026-10-29; la guía es docs/4-produccion/RELLENO-DEL-CUADRANTE.md)
//
// A los contactos que eran «calificados» con la regla de antes del 2026-10-26 —agendaron, sin etiqueta de descarte— y
// que hoy no tienen cuadrante, les escribe en el campo «Cuadrante de Clasificacion» del CRM un valor según su puntaje
// viejo del ICP (75 o más → Prioriza; 50 a 74 → Valida; el resto o sin puntaje → Descarta), y relee cada contacto para
// que nuestra base lo guarde con la historia a nombre de una persona (la `109`). Sólo los que reservaron por primera
// vez antes del corte (2026-10-26 por omisión). Las reglas están en `lib/negocio/rellenoDelCuadrante.ts`.
//
//   node --env-file=.env.supabase scripts/clasificar-calificados-viejos.mjs --org aria
//       En seco: cuántos, con qué valor y cuántos quedan afuera y por qué. Ninguna llamada al CRM, ninguna escritura.
//   … --org aria --muestra 5
//       Además, los ids del CRM (nunca nombres) de los 5 primeros con su valor, para elegir uno para --solo.
//   … --org aria --solo <ghlContactId> --escribir
//       Uno solo (tiene que ser candidato). Escribe, relee y anota en el diario.
//   … --org aria --escribir --tope 25
//       Una tanda: hasta 25 escrituras aceptadas, de a una, con --pausa ms entre contactos (600 por omisión).
//   … --org aria --deshacer <diario.jsonl> [--escribir] [--solo <id>]
//       Vuelve a vaciar el campo SÓLO donde el CRM todavía tiene el valor que escribimos. Sin --escribir, en seco.
//
// Otras banderas: --antes-de AAAA-MM-DD (el corte), --sin-solo-canceladas (deja afuera a quien canceló todas sus
// citas; la regla vieja los contaba), --diario <ruta> (dónde anotar; por omisión docs/_privado/relleno-del-cuadrante/,
// o la carpeta temporal del sistema si no hay docs/_privado: nunca dentro de git).
//
// ── LO QUE NO HACE ──────────────────────────────────────────────────────────
//
// No imprime nombres: sólo conteos, y los ids del CRM únicamente con --muestra o --solo. No escribe en seco. No pisa un
// campo que ya tiene valor en el CRM. No manda etiquetas: el PUT lleva sólo el campo (`escribirCampoDelContacto`).
// Corta ante un 401, 403 o 429. Es secuencial: una corrida a la vez.
//
// ── LOS DOS DOMINIOS, Y QUÉ QUEDA A MEDIAS ──────────────────────────────────
//
// De identidad sólo LEE (la empresa, sus clientes y, para escribir, la credencial), antes de escribir nada. Lo que
// puede quedar a medias es lo de afuera: un PUT que el CRM aceptó y cuya relectura falló (o el proceso se cortó entre
// los dos). La línea del diario se escribe igual, así que se puede deshacer; y la sincronización alcanza el valor en
// diez minutos, pero con origen `crm` y no `persona` —o una corrida siguiente lo relee como «ya tiene valor», también
// como CRM—. Es la única forma de que el relleno quede en la historia a nombre del CRM, y el diario la delata.
// ═══════════════════════════════════════════════════════════════════════════════

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { conIdentidad, cerrarClientes } from '../lib/datos/capa.ts';
import { conOrganizacion } from '../lib/datos/contexto.ts';
import { clientesParaBarrer } from '../lib/administracion/cuentas.ts';
import { resolverAccesoAGhl } from '../lib/credenciales/resolver.ts';
import { ambitoDeUnCliente } from '../lib/negocio/ambitoDelCliente.ts';
import { camposDelCuadrante } from '../lib/negocio/camposDelCrm.ts';
import {
  CORTE_POR_OMISION,
  candidatosDelRelleno,
  corteDe,
  correrElDeshacer,
  correrElRelleno,
  escritosDelDiario,
  porQueNoEsCandidato,
  resumenDelRelleno,
} from '../lib/negocio/rellenoDelCuadrante.ts';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const PAUSA_POR_OMISION = 600;

/** Las banderas. Una desconocida, o una que pide valor y no lo trae, corta antes de tocar nada. */
function leerBanderas(argv) {
  const b = { org: null, seco: false, escribir: false, solo: null, tope: Infinity, pausa: PAUSA_POR_OMISION, antesDe: CORTE_POR_OMISION, deshacer: null, diario: null, muestra: 0, sinSoloCanceladas: false };
  const conValor = new Set(['--org', '--solo', '--tope', '--pausa', '--antes-de', '--deshacer', '--diario', '--muestra']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--seco') b.seco = true;
    else if (a === '--escribir') b.escribir = true;
    else if (a === '--sin-solo-canceladas') b.sinSoloCanceladas = true;
    else if (conValor.has(a)) {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} necesita un valor`);
      if (a === '--org') b.org = v;
      else if (a === '--solo') b.solo = v;
      else if (a === '--antes-de') b.antesDe = v;
      else if (a === '--deshacer') b.deshacer = v;
      else if (a === '--diario') b.diario = v;
      else {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0) throw new Error(`${a} necesita un entero no negativo`);
        if (a === '--tope') b.tope = n;
        else if (a === '--pausa') b.pausa = n;
        else b.muestra = n;
      }
    } else throw new Error(`bandera desconocida: ${a}`);
  }
  if (!b.org) throw new Error('falta --org <slug>');
  if (b.seco && b.escribir) throw new Error('--seco y --escribir son excluyentes');
  if (b.tope === 0) throw new Error('--tope 0 no escribiría nada: usa el seco');
  return b;
}

/** Dónde anotar: lo pedido, o docs/_privado/relleno-del-cuadrante/ (local, ignorado por git), o la temporal. */
function rutaDelDiario(pedida, prefijo) {
  if (pedida) return resolve(pedida);
  const sello = new Date().toISOString().replace(/[:.]/g, '-');
  const privado = join(RAIZ, 'docs', '_privado');
  const carpeta = existsSync(privado) ? join(privado, 'relleno-del-cuadrante') : join(tmpdir(), 'relleno-del-cuadrante');
  return join(carpeta, `${prefijo}-${sello}.jsonl`);
}

function anotador(ruta) {
  let creada = false;
  return (linea) => {
    if (!creada) {
      mkdirSync(dirname(ruta), { recursive: true });
      creada = true;
    }
    // Una línea por contacto, en el momento: si la corrida se corta, lo anotado ya está en disco.
    appendFileSync(ruta, `${JSON.stringify(linea)}\n`, 'utf8');
  };
}

const ordenado = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]);

function imprimirTotales(t, verbo) {
  console.log(`  ${verbo}: ${t.escritos} (en nuestra base quedaron ${t.quedaron}; descongelados ${t.descongelados})`);
  for (const [k, n] of ordenado(t.porValor)) console.log(`    ${k.padEnd(28)} ${String(n).padStart(4)}`);
  const salteados = ordenado(t.salteados);
  if (salteados.length > 0) console.log('  salteados:');
  for (const [k, n] of salteados) console.log(`    ${k.padEnd(28)} ${String(n).padStart(4)}`);
  if (t.cortada) console.log(`  CORTADA: ${t.cortada}. Lo anotado está en el diario; se puede volver a correr después.`);
}

async function main() {
  const b = leerBanderas(process.argv.slice(2));
  const antesDe = corteDe(b.antesDe);
  const escribe = b.escribir;

  const org = await conIdentidad(async (db) =>
    db.selectFrom('organizaciones').select(['id', 'nombre']).where('slug', '=', b.org).executeTakeFirst(),
  );
  if (!org) throw new Error(`no hay ninguna organización con el slug «${b.org}»`);
  // Las credenciales se resuelven SÓLO para escribir: el seco no llama al CRM.
  const clientes = await conIdentidad(async (db) => {
    const salida = [];
    for (const cuenta of await clientesParaBarrer(db, org.id)) {
      salida.push({ cuenta, acceso: escribe ? await resolverAccesoAGhl(db, org.id, cuenta) : null });
    }
    return salida;
  });

  const diarioDeshacer = b.deshacer ? escritosDelDiario(readFileSync(resolve(b.deshacer), 'utf8')) : null;
  const rutaDiario = escribe ? rutaDelDiario(b.diario, b.deshacer ? `deshacer-${b.org}` : b.org) : null;
  const anotar = rutaDiario ? anotador(rutaDiario) : null;

  console.log(`${escribe ? 'ESCRIBIENDO' : 'EN SECO (no escribe nada)'} · ${org.nombre} · ${b.deshacer ? 'deshacer' : `corte ${b.antesDe}`}`);
  if (rutaDiario) console.log(`diario: ${rutaDiario}`);
  if (diarioDeshacer && diarioDeshacer.ilegibles > 0) console.log(`  (el diario tiene ${diarioDeshacer.ilegibles} líneas sin forma: se ignoran)`);

  let cortada = false;
  // El tope es de la CORRIDA, no de cada cliente: con dos clientes, `--tope 25` escribe 25 en total, no 50.
  let restante = b.tope;
  for (const { cuenta, acceso } of clientes) {
    if (cortada || restante <= 0) break;
    const ambito = ambitoDeUnCliente(org.id, cuenta.id);
    console.log(`\n═══ cliente ${cuenta.esPorOmision ? '(por omisión)' : cuenta.id} ═══`);

    // El campo del cuadrante de ESTE cliente: el relleno lo escribe y el deshacer vacía sólo ése (nunca el que diga el
    // diario).
    const campo = (await conOrganizacion(ambito, () => camposDelCuadrante()))[0];
    if (!campo) {
      console.log('  el catálogo de este cliente no tiene el campo del cuadrante: no se hace nada');
      continue;
    }

    if (diarioDeshacer) {
      let lineas = diarioDeshacer.lineas.filter((l) => l.cuentaId === cuenta.id);
      if (b.solo) lineas = lineas.filter((l) => l.ghlContactId === b.solo);
      if (!escribe) {
        const otroCampo = lineas.filter((l) => l.campoId !== campo).length;
        lineas = lineas.filter((l) => l.campoId === campo);
        if (otroCampo > 0) console.log(`  (${otroCampo} líneas nombran otro campo que el del cuadrante: no se vacían)`);
        const porValor = {};
        for (const l of lineas) porValor[l.valorNuevo] = (porValor[l.valorNuevo] ?? 0) + 1;
        console.log(`  en el diario: ${lineas.length} escritos de este cliente (se vacían sólo si el CRM todavía tiene ese valor)`);
        for (const [k, n] of ordenado(porValor)) console.log(`    ${k.padEnd(28)} ${String(n).padStart(4)}`);
        continue;
      }
      if (acceso.tipo !== 'listo') {
        console.log(`  SIN ACCESO al CRM (${acceso.que}): no se deshace nada`);
        continue;
      }
      const t = await correrElDeshacer({ ambito, acceso, campoId: campo, lineas, tope: restante, pausaMs: b.pausa, anotar });
      imprimirTotales(t, 'vaciados');
      restante -= t.escritos;
      cortada = t.cortada !== null;
      continue;
    }

    if (b.solo) {
      const motivo = await conOrganizacion(ambito, () => porQueNoEsCandidato(b.solo, { antesDe, sinSoloCanceladas: b.sinSoloCanceladas }));
      if (motivo) {
        console.log(`  --solo: no es candidato en este cliente (${motivo})`);
        continue;
      }
    }

    if (!escribe) {
      const r = await conOrganizacion(ambito, () => resumenDelRelleno({ antesDe, sinSoloCanceladas: b.sinSoloCanceladas }));
      console.log(`  agendaron (cita alcanzable):         ${r.agendaron}`);
      console.log(`  afuera · ya tienen cuadrante:        ${r.yaClasificados}`);
      console.log(`  afuera · descartados por etiqueta:   ${r.descartadosPorEtiqueta}`);
      console.log(`  afuera · primera reserva desde ${b.antesDe}: ${r.desdeElCorte}`);
      if (b.sinSoloCanceladas) console.log(`  afuera · sólo citas canceladas:      ${r.soloCanceladasExcluidos}`);
      console.log(`  CANDIDATOS:                          ${r.candidatos}`);
      for (const [k, n] of Object.entries(r.porValor)) console.log(`    ${k.padEnd(28)} ${String(n).padStart(4)}`);
      console.log(`  de ellos: congelados ${r.congelados} · sólo con citas canceladas ${r.soloCanceladas} · con baja en el CRM ${r.conBaja} (se saltean)`);
      if (b.muestra > 0 || b.solo) {
        const lista = await conOrganizacion(ambito, () =>
          candidatosDelRelleno({ antesDe, sinSoloCanceladas: b.sinSoloCanceladas, ...(b.solo ? { solo: b.solo } : {}) }),
        );
        for (const c of lista.slice(0, b.solo ? 1 : b.muestra)) {
          console.log(`    id del CRM ${c.ghlContactId} → ${c.valor}${c.territorio === null ? ' (congelado)' : ''}`);
        }
      }
      continue;
    }

    if (acceso.tipo !== 'listo') {
      console.log(`  SIN ACCESO al CRM (${acceso.que}): no se escribe nada`);
      continue;
    }
    const candidatos = await conOrganizacion(ambito, () =>
      candidatosDelRelleno({ antesDe, sinSoloCanceladas: b.sinSoloCanceladas, ...(b.solo ? { solo: b.solo } : {}) }),
    );
    console.log(`  candidatos: ${candidatos.length}${Number.isFinite(restante) ? ` · tope ${restante}` : ''} · pausa ${b.pausa} ms`);
    const t = await correrElRelleno({ ambito, acceso, campoId: campo, candidatos, tope: restante, pausaMs: b.pausa, anotar });
    imprimirTotales(t, 'escritos');
    restante -= t.escritos;
    cortada = t.cortada !== null;
  }
  if (cortada) process.exitCode = 2;
}

try {
  await main();
} catch (e) {
  console.error(`clasificar-calificados-viejos: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
} finally {
  await cerrarClientes();
}
