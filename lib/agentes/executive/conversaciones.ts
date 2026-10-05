// Los hilos del cerebro y sus mensajes. Único escritor de `negocio.conversaciones_del_executive` y
// `negocio.mensajes_del_executive` (migración 071).
//
// ═══════════════════════════════════════════════════════════════════════════════
// LAS CONVERSACIONES SON DE QUIEN LAS ESCRIBIÓ
//
// `D-14` y `docs/OTROS/agentes/03-EL-CEREBRO.md`, AG-51. La RLS separa empresas, no personas: dentro de una
// empresa, todo lo que lee o borra un hilo filtra por `usuario_id`, y un hilo ajeno se contesta igual que
// uno que no existe (404). Ninguna función de acá recibe un hilo sin recibir también quién pregunta.
//
// Todas corren dentro de la `conOrganizacion` CORTA que abre quien llama: la de la reserva (con el candado
// de `./topes.ts`), la de la respuesta, la de la lista. Ninguna mientras se espera al modelo.
//
// ── LO QUE SE GUARDA ─────────────────────────────────────────────────────────
//
// De la respuesta, la forma validada y la evidencia, con los nombres de personas que trajo la evidencia
// reemplazados en las dos (`paraGuardar`): quedan los identificadores y las cifras (`AG-48`). La pregunta se
// guarda como la escribió la persona. Ningún bloque de pensamiento.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../../datos/contexto.ts';
import { bloquearYContar, cerrarLugar, quedaLugar, reservarLugar, type LoUsadoHoy } from './topes.ts';
import type { Evidencia, RespuestaValidada } from './respuesta.ts';

/** El largo del título: la primera pregunta, recortada. El mismo tope que el `check` de la `071`. */
export const LARGO_DEL_TITULO = 120;

/** Cuántos intercambios anteriores viajan al modelo, y hasta cuántos caracteres en total (`T-15`). */
const INTERCAMBIOS_DEL_HISTORIAL = 8;
const CARACTERES_DEL_HISTORIAL = 12_000;

export type OrigenDelHilo = 'inicio' | 'pie' | 'reunion';

/** Un turno anterior, reducido a lo que el modelo necesita para seguir el hilo. */
export interface TurnoAnterior {
  pregunta: string;
  /** La conclusión y las cifras de la respuesta, en texto. Sin pensamiento ni evidencia. */
  respuesta: string;
}

export type ResultadoDeLaReserva =
  | {
      tipo: 'reservada';
      hiloId: string;
      /** El mensaje de la pregunta en el hilo. */
      preguntaId: string;
      /** Su lugar en el registro del tope (`./topes.ts`). */
      lugarId: string;
      anteriores: TurnoAnterior[];
      usado: LoUsadoHoy;
    }
  | { tipo: 'tope'; usado: LoUsadoHoy }
  | { tipo: 'no_encontrado' };

/** La conclusión y las cifras de una respuesta guardada, como texto para el historial. */
function reducir(respuesta: unknown, texto: string): string {
  const cifras = (respuesta as { cifras?: { valor: number; que_es: string; periodo: string }[] } | null)?.cifras ?? [];
  const lineas = cifras.map((c) => `- ${c.valor} ${c.que_es} (${c.periodo})`);
  return [texto, ...lineas].join('\n');
}

/**
 * Reserva una pregunta: comprueba que el hilo pedido sea de quien pregunta, lee los turnos anteriores, y
 * recién entonces cuenta el tope bajo candado y, si queda lugar, deja la pregunta `reservada` en el hilo y
 * en el registro del tope. Lo que no necesita el candado va antes de tomarlo: el candado es de la empresa
 * entera, y mientras se sostiene nadie más empieza una pregunta.
 */
export async function reservarPregunta(p: {
  usuarioId: string;
  zona: string;
  hiloId: string | null;
  texto: string;
  origen: OrigenDelHilo;
  seccion: string | null;
  contexto: Record<string, unknown>;
}): Promise<ResultadoDeLaReserva> {
  let anteriores: TurnoAnterior[] = [];
  if (p.hiloId !== null) {
    const propio = await datos()
      .selectFrom('conversaciones_del_executive')
      .select('id')
      .where('id', '=', p.hiloId)
      .where('usuario_id', '=', p.usuarioId)
      .executeTakeFirst();
    if (!propio) return { tipo: 'no_encontrado' };
    anteriores = await turnosAnteriores(p.hiloId);
  }

  // El candado: hasta que esta transacción termine, nadie de la empresa cuenta ni reserva.
  const usado = await bloquearYContar(p.usuarioId, p.zona);
  if (!quedaLugar(usado)) return { tipo: 'tope', usado };
  const lugarId = await reservarLugar(p.usuarioId);

  const hiloId =
    p.hiloId ??
    (
      await datos()
        .insertInto('conversaciones_del_executive')
        .values({
          usuario_id: p.usuarioId,
          titulo: p.texto.slice(0, LARGO_DEL_TITULO),
          origen: p.origen,
          seccion: p.seccion,
          contexto: JSON.stringify(p.contexto),
        } as never)
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

  const pregunta = await datos()
    .insertInto('mensajes_del_executive')
    .values({ conversacion_id: hiloId, rol: 'persona', texto: p.texto, estado: 'reservada' } as never)
    .returning('id')
    .executeTakeFirstOrThrow();
  await datos().updateTable('conversaciones_del_executive').set({ actualizada_el: sql`now()` } as never).where('id', '=', hiloId).execute();
  return {
    tipo: 'reservada',
    hiloId,
    preguntaId: pregunta.id,
    lugarId,
    anteriores,
    usado: { ...usado, usadasPorPersona: usado.usadasPorPersona + 1, usadasPorEmpresa: usado.usadasPorEmpresa + 1 },
  };
}

/**
 * Las preguntas respondidas del hilo con sus respuestas, las últimas, dentro del presupuesto. Cada respuesta
 * se empareja con su pregunta por `responde_a`, no por el orden: dos preguntas seguidas en el mismo hilo
 * llegan como pregunta, pregunta, respuesta, respuesta.
 */
async function turnosAnteriores(hiloId: string): Promise<TurnoAnterior[]> {
  const ultimas = await datos()
    .selectFrom('mensajes_del_executive as p')
    .innerJoin('mensajes_del_executive as r', (j) => j.onRef('r.org_id', '=', 'p.org_id').onRef('r.responde_a', '=', 'p.id'))
    .select(['p.texto as pregunta', 'r.texto as conclusion', 'r.respuesta as respuesta'])
    .where('p.conversacion_id', '=', hiloId)
    .where('p.estado', '=', 'respondida')
    .orderBy('p.creado_el', 'desc')
    .orderBy('p.id', 'desc')
    .limit(INTERCAMBIOS_DEL_HISTORIAL)
    .execute();
  const turnos = ultimas.reverse().map((t) => ({ pregunta: t.pregunta, respuesta: reducir(t.respuesta, t.conclusion) }));
  // Sin pasar el presupuesto: se descartan los más viejos.
  while (turnos.length > 0 && turnos.reduce((n, t) => n + t.pregunta.length + t.respuesta.length, 0) > CARACTERES_DEL_HISTORIAL) {
    turnos.shift();
  }
  return turnos;
}

/** Los nombres de personas que trajo la evidencia: los valores de las claves `nombre`, en cualquier profundidad. */
function nombresDe(evidencias: readonly Evidencia[]): string[] {
  const nombres = new Set<string>();
  const recorrer = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(recorrer);
    else if (v !== null && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if (k === 'nombre' && typeof x === 'string' && x.trim().length >= 3) nombres.add(x.trim());
        else recorrer(x);
      }
    }
  };
  evidencias.forEach((e) => recorrer(e.datos));
  // Los más largos primero: «Ana María» antes que «Ana».
  return [...nombres].sort((a, b) => b.length - a.length);
}

/**
 * Lo que se guarda de una respuesta y su evidencia, SIN los nombres de personas que trajo la evidencia: en
 * la evidencia se quitan las claves `nombre`, y en el texto que escribió el modelo cada uno de esos nombres
 * se reemplaza por «[persona]». Quedan los identificadores y las cifras. La respuesta que ve la persona en
 * el momento lleva los nombres; el hilo guardado, no.
 */
export function paraGuardar(respuesta: RespuestaValidada, evidencias: readonly Evidencia[]): { respuesta: RespuestaValidada; evidencia: unknown } {
  const nombres = nombresDe(evidencias);
  const sinNombresEnTexto = (v: unknown): unknown => {
    if (typeof v === 'string') return nombres.reduce((t, n) => t.split(n).join('[persona]'), v);
    if (Array.isArray(v)) return v.map(sinNombresEnTexto);
    if (v !== null && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sinNombresEnTexto(x)]));
    return v;
  };
  const sinClavesNombre = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sinClavesNombre);
    if (v === null || typeof v !== 'object') return v;
    return Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'nombre').map(([k, x]) => [k, sinClavesNombre(x)]));
  };
  return {
    respuesta: sinNombresEnTexto(respuesta) as RespuestaValidada,
    evidencia: evidencias.map((e) => ({ id: e.id, herramienta: e.herramienta, argumentos: e.argumentos, datos: sinClavesNombre(e.datos) })),
  };
}

/** Guarda la respuesta del cerebro, sin nombres (`paraGuardar`), y cierra la pregunta como respondida. */
export async function guardarRespuesta(
  hiloId: string,
  preguntaId: string,
  lugarId: string,
  respuesta: RespuestaValidada,
  evidencias: readonly Evidencia[],
): Promise<void> {
  const guardable = paraGuardar(respuesta, evidencias);
  await datos().updateTable('mensajes_del_executive').set({ estado: 'respondida' } as never).where('id', '=', preguntaId).execute();
  await datos()
    .insertInto('mensajes_del_executive')
    .values({
      conversacion_id: hiloId,
      rol: 'cerebro',
      texto: guardable.respuesta.conclusion,
      respuesta: JSON.stringify(guardable.respuesta),
      evidencia: JSON.stringify(guardable.evidencia),
      responde_a: preguntaId,
    } as never)
    .execute();
  await datos().updateTable('conversaciones_del_executive').set({ actualizada_el: sql`now()` } as never).where('id', '=', hiloId).execute();
  await cerrarLugar(lugarId, 'respondida');
}

/**
 * Una pregunta que no se pudo contestar. Cuenta para el tope sólo si se pagó (`pagada`: el proveedor
 * contestó al menos una vez). `situacion` y `ref` son nulas cuando lo que falló no fue el modelo.
 */
export async function marcarFallida(preguntaId: string, lugarId: string, situacion: string | null, ref: string | null, pagada: boolean): Promise<void> {
  await datos()
    .updateTable('mensajes_del_executive')
    .set({ estado: 'fallida', situacion, ref } as never)
    .where('id', '=', preguntaId)
    .execute();
  await cerrarLugar(lugarId, pagada ? 'fallida_pagada' : 'fallida');
}

export interface HiloListado {
  id: string;
  titulo: string;
  origen: OrigenDelHilo;
  seccion: string | null;
  actualizadaEl: string;
}

/** Los hilos de quien pregunta, los más recientes primero. Con `seccion`, sólo los de esa caja del pie. */
export async function listarHilos(usuarioId: string, seccion: string | null = null, limite = 50): Promise<HiloListado[]> {
  let consulta = datos()
    .selectFrom('conversaciones_del_executive')
    .select(['id', 'titulo', 'origen', 'seccion', 'actualizada_el'])
    .where('usuario_id', '=', usuarioId);
  if (seccion !== null) consulta = consulta.where('seccion', '=', seccion);
  const filas = await consulta.orderBy('actualizada_el', 'desc').limit(limite).execute();
  return filas.map((f) => ({
    id: f.id,
    titulo: f.titulo,
    origen: f.origen,
    seccion: f.seccion,
    actualizadaEl: new Date(f.actualizada_el).toISOString(),
  }));
}

export interface MensajeDelHilo {
  id: string;
  rol: 'persona' | 'cerebro';
  texto: string;
  estado: string | null;
  respuesta: unknown;
  situacion: string | null;
  ref: string | null;
  creadoEl: string;
}

/** Los mensajes de un hilo PROPIO, en orden, o `null` si no existe o es de otra persona. */
export async function leerHilo(usuarioId: string, hiloId: string): Promise<MensajeDelHilo[] | null> {
  const propio = await datos()
    .selectFrom('conversaciones_del_executive')
    .select('id')
    .where('id', '=', hiloId)
    .where('usuario_id', '=', usuarioId)
    .executeTakeFirst();
  if (!propio) return null;
  const filas = await datos()
    .selectFrom('mensajes_del_executive')
    .select(['id', 'rol', 'texto', 'estado', 'respuesta', 'situacion', 'ref', 'creado_el'])
    .where('conversacion_id', '=', hiloId)
    .orderBy('creado_el')
    .orderBy('id')
    .execute();
  return filas.map((f) => ({
    id: f.id,
    rol: f.rol,
    texto: f.texto,
    estado: f.estado,
    respuesta: f.respuesta,
    situacion: f.situacion,
    ref: f.ref,
    creadoEl: new Date(f.creado_el).toISOString(),
  }));
}

/** Borra un hilo PROPIO con sus mensajes (`D-14`: el autor borra). `false` si no existe o es de otra persona. */
export async function borrarHilo(usuarioId: string, hiloId: string): Promise<boolean> {
  const r = await datos()
    .deleteFrom('conversaciones_del_executive')
    .where('id', '=', hiloId)
    .where('usuario_id', '=', usuarioId)
    .executeTakeFirst();
  return Number(r.numDeletedRows) > 0;
}
