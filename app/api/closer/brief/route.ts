// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
//
// El Brief del closer de una cita (AG12 de los agentes; `docs/OTROS/agentes/fichas/F13-CLOSER-Y-BRIEF.md`,
// `D-19`): leer el guardado y generarlo al abrir la cita, o regenerarlo a mano.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUIÉN, Y CON QUÉ
//
//   · El GET pide `closer.ver`, como las demás lecturas de esta pantalla; el POST, `cerebro.usar`: gasta
//     tokens, como preguntarle al cerebro desde la caja del pie (`app/api/closer/cerebro/route.ts`).
//   · **Más estricto que la ficha** (AG-F13-4): la cita tiene que ser de un contacto del territorio del
//     closer y, para un closer con «mío», de uno suyo. Si no, 404: para quien pide no existe. Lo decide
//     `entradaDelBrief`, también en el GET: leer un Brief guardado es leer datos de esa persona.
//   · **Bajo delegación no se genera** (AG-F13-5): gastaría la llave del cliente. El ya guardado se lee.
//   · **Sin llave** no se genera (AG-F13-6), y el GET lo dice para que la pantalla no ofrezca un botón que
//     va a fallar.
//   · **Generar al abrir no cuenta para el tope; regenerar a mano sí** (`06`, AG-96): reserva un lugar con
//     el mismo candado que una pregunta al cerebro.
//
// La llave se resuelve acá con `conIdentidad` y viaja como dato; lo de negocio va en transacciones cortas, y
// ninguna queda abierta mientras se espera al modelo (`01`, AG-05).
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import { conOrganizacion } from '../../../../lib/datos/contexto.ts';
import { resolverLlaveDeIa } from '../../../../lib/credenciales/resolver.ts';
import { alcanceDeQuienMira } from '../../../../lib/negocio/alcanceDelCloser.ts';
import { entradaDelBrief } from '../../../../lib/agentes/brief/entrada.ts';
import { generarBrief } from '../../../../lib/agentes/brief/brief.ts';
import { guardarBrief, leerBrief } from '../../../../lib/agentes/brief/guardar.ts';
import { bloquearYContar, cerrarLugar, quedaLugar, reservarLugar } from '../../../../lib/agentes/executive/topes.ts';

export const PANTALLA = 'closer';

/** Una llamada al modelo de hasta 120 s, más lo de antes y lo de después (AG-F13-7). */
export const maxDuration = 300;
/** La espera de la llamada: la del cerebro. */
const ESPERA_DEL_BRIEF_MS = 120_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El Brief guardado de la cita, y lo que la pantalla necesita para ofrecer generarlo: `?cita=`. */
export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['closer.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  const cita = new URL(peticion.url).searchParams.get('cita');
  if (cita === null || !UUID.test(cita)) return rechazo('no_encontrado');

  const llave = await conIdentidad((db) => resolverLlaveDeIa(db, contexto.orgEfectiva));
  const leido = await conOrganizacion(contexto.orgEfectiva, async () => {
    const { alcance } = await alcanceDeQuienMira(contexto.usuarioId, null);
    const entrada = await entradaDelBrief(cita, alcance);
    if (!entrada) return null;
    return { entrada, guardado: await leerBrief(cita) };
  });
  if (!leido) return rechazo('no_encontrado');
  const { entrada, guardado } = leido;

  /* Por qué no se puede generar, en el orden en que la pantalla lo diría. `null` = se puede. */
  const noSePuede = contexto.mirandoOtraOrganizacion
    ? 'bajo_delegacion'
    : !contexto.permisos.has('cerebro.usar')
      ? 'sin_permiso'
      : llave.tipo === 'falta'
        ? 'sin_llave'
        : null;
  return ok({
    brief: guardado?.brief ?? null,
    generadoEl: guardado?.generadoEl ?? null,
    sinFormulario: entrada.sinFormulario,
    // Lo que leyó el Brief guardado ya no es lo de hoy: el formulario cambió o hay una llamada nueva.
    datosNuevos: guardado !== null && guardado.huella !== entrada.huella,
    noSePuede,
  });
}

/** Generar el Brief de la cita: `{ cita, regenerar? }`. Sin `regenerar`, si ya hay uno, devuelve ése. */
export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['cerebro.usar'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  if (contexto.mirandoOtraOrganizacion) {
    return rechazo('cerebro_bajo_delegacion', 'Estás mirando otra empresa: el Brief no se genera aquí.');
  }
  let cuerpo: { cita?: unknown; regenerar?: unknown };
  try {
    cuerpo = (await peticion.json()) as typeof cuerpo;
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo no es JSON.');
  }
  const cita = cuerpo?.cita;
  if (typeof cita !== 'string' || !UUID.test(cita)) return rechazo('peticion_invalida', 'No se dijo qué cita.');
  const regenerar = cuerpo?.regenerar === true;

  const llave = await conIdentidad((db) => resolverLlaveDeIa(db, contexto.orgEfectiva));
  if (llave.tipo === 'falta') return rechazo(llave.que);

  const zona = contexto.organizacion.zonaHoraria;
  const preparado = await conOrganizacion(contexto.orgEfectiva, async () => {
    const { alcance } = await alcanceDeQuienMira(contexto.usuarioId, null);
    const entrada = await entradaDelBrief(cita, alcance);
    if (!entrada) return { tipo: 'no_encontrado' as const };
    const guardado = await leerBrief(cita);
    if (guardado && !regenerar) return { tipo: 'ya_estaba' as const, guardado, entrada };
    if (!regenerar) return { tipo: 'generar' as const, entrada, lugar: null };
    // Regenerar a mano cuenta para el tope, con el candado de las preguntas al cerebro.
    const usado = await bloquearYContar(contexto.usuarioId, zona);
    if (!quedaLugar(usado)) return { tipo: 'tope' as const, usado };
    return { tipo: 'generar' as const, entrada, lugar: await reservarLugar(contexto.usuarioId) };
  });
  if (preparado.tipo === 'no_encontrado') return rechazo('no_encontrado');
  if (preparado.tipo === 'tope') {
    const quien = preparado.usado.usadasPorPersona >= preparado.usado.porPersona ? 'Llegaste al tope de hoy' : 'Tu empresa llegó al tope de hoy';
    return rechazo('tope_del_cerebro', `${quien}. Se renueva a la medianoche.`);
  }
  if (preparado.tipo === 'ya_estaba') {
    return ok({ brief: preparado.guardado.brief, generadoEl: preparado.guardado.generadoEl, sinFormulario: preparado.entrada.sinFormulario, datosNuevos: preparado.guardado.huella !== preparado.entrada.huella });
  }

  // Sin transacción abierta mientras se espera al modelo.
  const { entrada, lugar } = preparado;
  const r = await generarBrief({ entrada, llave: llave.claveIa, orgId: contexto.orgEfectiva, usuarioId: contexto.usuarioId, espera: ESPERA_DEL_BRIEF_MS });
  const generadoEl = new Date().toISOString();
  await conOrganizacion(contexto.orgEfectiva, async () => {
    if (r.tipo === 'listo') {
      await guardarBrief(cita, { brief: r.brief, sinFormulario: entrada.sinFormulario, huella: entrada.huella, modelo: r.modelo, generadoPor: contexto.usuarioId });
    }
    if (lugar !== null) await cerrarLugar(lugar, r.tipo === 'listo' ? 'respondida' : r.pagado ? 'fallida_pagada' : 'fallida');
  });
  if (r.tipo === 'fallo') return rechazo('modelo_no_disponible', `${r.situacion} · ref ${r.ref}`);
  return ok({ brief: r.brief, generadoEl, sinFormulario: entrada.sinFormulario, datosNuevos: false });
}
