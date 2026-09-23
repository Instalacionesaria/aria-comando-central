// La capa de datos de los Analizadores: las seis tablas de la `056`.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ REEMPLAZA, Y QUÉ CAMBIÓ
//
// En ARIA Brain esto era `db.ts`: 27 funciones sobre PostgREST con la llave de servicio, que se salta
// la RLS, y un `cliente_id` escrito a mano en cada `where`. Un `where` olvidado era una fuga entre
// cuentas, y nada lo habría dicho. Acá no hay ningún `where org_id`: lo pone la política de fila con
// lo que `conOrganizacion(` fijó, y la inyección lo agrega a cada `insert`.
//
// Lo demás que cambió, cada cosa por un defecto del origen:
//
//   · **El análisis y el DONE van en la MISMA transacción.** El origen los escribía en dos pedidos y
//     por eso tenía un «orden contractual» —primero el análisis, después el estado—: si el segundo
//     fallaba quedaba un análisis huérfano, y si se invertía, una llamada DONE sin informe. Con una
//     transacción las dos cosas pasan juntas o no pasa ninguna.
//   · **El candado es un `update` condicional.** El origen leía el estado y después escribía
//     ANALYZING: el cron y el botón podían tomar la misma llamada y pagar dos análisis.
//   · **Borrar y dejar la lápida van juntos.** Con un borrado sin lápida, el siguiente
//     descubrimiento trae la reunión de vuelta y la paga de nuevo.
//   · **Las fichas faltantes se buscan con `NOT EXISTS`.** El origen traía `limit * 4` llamadas y
//     filtraba en memoria: una ficha vieja que caía fuera de esa ventana no se generaba nunca.
//
// ── Y DÓNDE CORRE CADA CONSULTA ──────────────────────────────────────────────
//
// Cada función abre una transacción CORTA con `conOrganizacion(`, o reutiliza la que ya esté abierta
// si es de la misma organización. Ninguna queda abierta mientras se espera al modelo: eso retendría
// una conexión del agrupador durante minutos (el mismo criterio que `lib/fundaciones/almacen.ts`).
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import type { Trx } from '../datos/capa.ts';
import { conOrganizacion, datos, hayOrganizacion, organizacionActual } from '../datos/contexto.ts';
import type {
  EstadoDeLlamadaAnalizada,
  ProveedorDeReuniones,
  TipoDeLlamadaAnalizada,
} from '../datos/esquema.ts';
import type { NormalizedSegment, NormalizedTranscript } from './nucleo/types.ts';
import type { TokenUsage } from './nucleo/pricing.ts';

/** Corre `trabajo` en la transacción de la organización, abriéndola si hace falta. */
async function enOrganizacion<T>(orgId: string, trabajo: (db: Trx) => Promise<T>): Promise<T> {
  if (hayOrganizacion()) {
    const abierta = organizacionActual();
    // Un contexto ajeno no se reutiliza en silencio: leería y escribiría las llamadas de otra.
    if (abierta !== orgId) throw new Error(`el contexto abierto es de la organización ${abierta}, no de ${orgId}`);
    return trabajo(datos());
  }
  return conOrganizacion(orgId, () => trabajo(datos()));
}

/** Cuánto se guarda de un error. El detalle entero queda en el registro del servidor. */
export const TOPE_DEL_ERROR = 500;

/** Cuánto tiempo en ANALYZING se considera colgada, y se puede volver a tomar. */
export const MINUTOS_PARA_DARLA_POR_COLGADA = 15;

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · Crear
// ═══════════════════════════════════════════════════════════════════════════════

/** Los datos de una llamada nueva. Los duros vienen del proveedor, nunca del modelo. */
export interface LlamadaNueva {
  tipo: TipoDeLlamadaAnalizada;
  proveedor: ProveedorDeReuniones;
  estado: EstadoDeLlamadaAnalizada;
  reunionExternaId: string | null;
  titulo: string | null;
  prospectoId: string | null;
  prospectoNombre: string | null;
  prospectoEmail: string | null;
  motivo: string | null;
  fechaDeLaReunion: string | null;
  duracionSeg: number | null;
  organizadorNombre: string | null;
  organizadorEmail: string | null;
  urlDeLaGrabacion: string | null;
  invitados: { name?: string; email?: string }[] | null;
  metaDelProveedor: Record<string, unknown> | null;
}

/**
 * Crea la llamada Y su transcripción en una sola transacción.
 *
 * Juntas porque una llamada sin transcripción no se puede analizar ni reencaminar, y el origen las
 * creaba en dos pedidos: si el segundo fallaba, quedaba una PENDING que el drenado tomaba, no
 * encontraba texto y marcaba FAILED para siempre.
 *
 * Devuelve `null` si la reunión externa ya estaba (la carrera entre el cron y el botón): el único
 * `(org_id, proveedor, reunion_externa_id)` la frena y no se escribe nada.
 */
export async function crearLlamadaConTranscripcion(
  orgId: string,
  llamada: LlamadaNueva,
  transcripcion: NormalizedTranscript,
  conMarcasDeTiempo: boolean,
): Promise<string | null> {
  return enOrganizacion(orgId, async (db) => {
    const fila = await db
      .insertInto('analizador_llamadas')
      .values({
        tipo: llamada.tipo,
        proveedor: llamada.proveedor,
        estado: llamada.estado,
        reunion_externa_id: llamada.reunionExternaId,
        titulo: llamada.titulo,
        prospecto_id: llamada.prospectoId,
        prospecto_nombre: llamada.prospectoNombre,
        prospecto_email: llamada.prospectoEmail,
        motivo: llamada.motivo,
        fecha_de_la_reunion: llamada.fechaDeLaReunion === null ? null : new Date(llamada.fechaDeLaReunion),
        duracion_seg: llamada.duracionSeg,
        organizador_nombre: llamada.organizadorNombre,
        organizador_email: llamada.organizadorEmail,
        url_de_la_grabacion: llamada.urlDeLaGrabacion,
        invitados: llamada.invitados === null ? null : JSON.stringify(llamada.invitados),
        meta_del_proveedor: llamada.metaDelProveedor === null ? null : JSON.stringify(llamada.metaDelProveedor),
      } as never)
      .onConflict((oc) => oc.columns(['org_id', 'proveedor', 'reunion_externa_id']).doNothing())
      .returning('id')
      .executeTakeFirst();
    if (!fila) return null;
    await escribirTranscripcion(db, fila.id, transcripcion, conMarcasDeTiempo);
    return fila.id;
  });
}

async function escribirTranscripcion(
  db: Trx,
  llamadaId: string,
  t: NormalizedTranscript,
  conMarcasDeTiempo: boolean,
): Promise<void> {
  const valores = {
    texto: t.fullText,
    segmentos: JSON.stringify(t.segments),
    idioma: t.language,
    con_marcas_de_tiempo: conMarcasDeTiempo,
  };
  await db
    .insertInto('analizador_transcripciones')
    .values({ llamada_id: llamadaId, ...valores } as never)
    .onConflict((oc) => oc.columns(['org_id', 'llamada_id']).doUpdateSet(valores as never))
    .execute();
}

/**
 * El prospecto de una llamada: el que ya existe con ese correo, o uno nuevo.
 *
 * Sin correo SIEMPRE se crea uno nuevo, y es a propósito: dos llamadas sin correo pueden ser dos
 * personas distintas con el mismo nombre, y unirlas mezclaría sus historiales en la ficha.
 */
export async function prospectoDeLaLlamada(
  orgId: string,
  nombre: string | null,
  email: string | null,
): Promise<string> {
  const correo = email === null ? null : email.trim().toLowerCase() || null;
  return enOrganizacion(orgId, async (db) => {
    if (correo === null) {
      const nueva = await db
        .insertInto('analizador_prospectos')
        .values({ nombre, email: null } as never)
        .returning('id')
        .executeTakeFirstOrThrow();
      return nueva.id;
    }
    /* `do update` y no `do nothing`: con `do nothing` el `returning` vuelve vacío cuando ya existía,
       y habría que hacer una segunda lectura. El nombre solo se completa si faltaba: el primero que
       lo trajo manda. */
    const fila = await db
      .insertInto('analizador_prospectos')
      .values({ nombre, email: correo } as never)
      .onConflict((oc) =>
        oc.columns(['org_id', 'email']).doUpdateSet({
          nombre: sql`coalesce(analizador_prospectos.nombre, excluded.nombre)`,
          actualizado_el: sql`now()`,
        } as never),
      )
      .returning('id')
      .executeTakeFirstOrThrow();
    return fila.id;
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · El ciclo del análisis
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Toma una llamada para analizarla: la pasa a ANALYZING si y solo si nadie la tiene.
 *
 * Es UN `update` condicional y no «leer el estado y después escribir»: entre la lectura y la
 * escritura, el cron y el botón podían tomar la misma llamada y pagar dos análisis. Acá la base
 * decide, y solo uno de los dos ve la fila devuelta.
 *
 * Se puede tomar una PENDING, una FAILED (reintentar), una DONE (reanalizar) y una ANALYZING que
 * lleve más de 15 minutos ahí (se colgó). Una OTRO no se analiza nunca: primero se reencamina.
 */
export async function tomarParaAnalizar(orgId: string, llamadaId: string): Promise<boolean> {
  return enOrganizacion(orgId, async (db) => {
    const fila = await db
      .updateTable('analizador_llamadas')
      .set({ estado: 'ANALYZING', tomada_el: sql`now()`, error: null, actualizado_el: sql`now()` } as never)
      .where('id', '=', llamadaId)
      .where('tipo', '<>', 'OTRO')
      .where((eb) =>
        eb.or([
          eb('estado', 'in', ['PENDING', 'FAILED', 'DONE']),
          eb.and([
            eb('estado', '=', 'ANALYZING'),
            eb('tomada_el', '<', sql<Date>`now() - make_interval(mins => ${MINUTOS_PARA_DARLA_POR_COLGADA})`),
          ]),
        ]),
      )
      .returning('id')
      .executeTakeFirst();
    return fila !== undefined;
  });
}

/** Lo que el motor devolvió, ya listo para guardar. */
export interface ResultadoDelModelo {
  tipo: 'HT' | 'OB';
  modelo: string;
  uso: TokenUsage;
  costoUsd: number | null;
  versionDeRubrica: string;
}

function columnasDeUso(uso: TokenUsage) {
  return {
    tokens_entrada: uso.input,
    tokens_salida: uso.output,
    tokens_escritura_cache: uso.cacheWrite,
    tokens_lectura_cache: uso.cacheRead,
  };
}

async function escribirAnalisis(db: Trx, llamadaId: string, valores: Record<string, unknown>): Promise<void> {
  await db
    .insertInto('analizador_analisis')
    .values({ llamada_id: llamadaId, ...valores, analizado_el: sql`now()` } as never)
    .onConflict((oc) => oc.columns(['org_id', 'llamada_id']).doUpdateSet({ ...valores, analizado_el: sql`now()` } as never))
    .execute();
}

/**
 * Guarda el análisis y deja la llamada en DONE, **en la misma transacción**. Si una de las dos
 * escrituras falla, ninguna queda: no puede existir una DONE sin informe.
 */
export async function terminarConAnalisis(
  orgId: string,
  llamadaId: string,
  r: ResultadoDelModelo & {
    analisis: unknown;
    columnas: { score?: number | null; outcome?: string | null; scoreColor?: string | null; readiness?: string | null; summary?: string | null };
  },
): Promise<void> {
  await enOrganizacion(orgId, async (db) => {
    await escribirAnalisis(db, llamadaId, {
      tipo: r.tipo,
      coincide: true,
      analisis: JSON.stringify(r.analisis),
      modelo: r.modelo,
      ...columnasDeUso(r.uso),
      costo_usd: r.costoUsd,
      version_de_rubrica: r.versionDeRubrica,
      puntaje: r.columnas.score ?? null,
      resultado: r.columnas.outcome ?? null,
      color_del_puntaje: r.columnas.scoreColor ?? null,
      preparacion: r.columnas.readiness ?? null,
      resumen: r.columnas.summary ?? null,
    });
    await db
      .updateTable('analizador_llamadas')
      .set({ estado: 'DONE', motivo: null, error: null, actualizado_el: sql`now()` } as never)
      .where('id', '=', llamadaId)
      .execute();
  });
}

/**
 * El veto: el modelo vio la transcripción entera y dijo que no era. Queda NOT_MATCH con su motivo, Y
 * con lo que costó: el veto también se pagó, y el origen no lo registraba.
 */
export async function terminarConVeto(
  orgId: string,
  llamadaId: string,
  r: ResultadoDelModelo & { motivo: string },
): Promise<void> {
  await enOrganizacion(orgId, async (db) => {
    await escribirAnalisis(db, llamadaId, {
      tipo: r.tipo,
      coincide: false,
      analisis: null,
      modelo: r.modelo,
      ...columnasDeUso(r.uso),
      costo_usd: r.costoUsd,
      version_de_rubrica: r.versionDeRubrica,
      puntaje: null,
      resultado: null,
      color_del_puntaje: null,
      preparacion: null,
      resumen: null,
    });
    await db
      .updateTable('analizador_llamadas')
      .set({ estado: 'NOT_MATCH', motivo: r.motivo, error: null, actualizado_el: sql`now()` } as never)
      .where('id', '=', llamadaId)
      .execute();
  });
}

/** El fallo: FAILED con el error recortado. El análisis anterior, si había, no se toca. */
export async function terminarConFallo(orgId: string, llamadaId: string, error: string): Promise<void> {
  await enOrganizacion(orgId, (db) =>
    db
      .updateTable('analizador_llamadas')
      .set({ estado: 'FAILED', error: error.slice(0, TOPE_DEL_ERROR), actualizado_el: sql`now()` } as never)
      .where('id', '=', llamadaId)
      .execute(),
  );
}

/** Vuelve a PENDING una llamada que se tomó y no se llegó a analizar (la guardia de reloj). */
export async function devolverAPendiente(orgId: string, llamadaId: string): Promise<void> {
  await enOrganizacion(orgId, (db) =>
    db
      .updateTable('analizador_llamadas')
      .set({ estado: 'PENDING', tomada_el: null, actualizado_el: sql`now()` } as never)
      .where('id', '=', llamadaId)
      .where('estado', '=', 'ANALYZING')
      .execute(),
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · La ficha
// ═══════════════════════════════════════════════════════════════════════════════

export type FichaParaGuardar =
  | (ResultadoDelModelo & {
      estado: 'OK';
      ficha: unknown;
      columnas: { intent?: string | null; decisionMaker?: string | null; riskCount?: number | null; headline?: string | null };
    })
  | { estado: 'FAILED'; error: string };

/** Guarda la ficha, OK o FAILED. Una FAILED nunca toca la llamada: sigue DONE con su análisis. */
export async function guardarFicha(orgId: string, llamadaId: string, f: FichaParaGuardar): Promise<void> {
  const valores =
    f.estado === 'OK'
      ? {
          estado: 'OK',
          ficha: JSON.stringify(f.ficha),
          error: null,
          modelo: f.modelo,
          ...columnasDeUso(f.uso),
          costo_usd: f.costoUsd,
          version_de_rubrica: f.versionDeRubrica,
          intencion: f.columnas.intent ?? null,
          decisor: f.columnas.decisionMaker ?? null,
          riesgos: f.columnas.riskCount ?? null,
          titular: f.columnas.headline ?? null,
        }
      : {
          estado: 'FAILED',
          ficha: null,
          error: f.error.slice(0, TOPE_DEL_ERROR),
          modelo: null,
          tokens_entrada: null,
          tokens_salida: null,
          tokens_escritura_cache: null,
          tokens_lectura_cache: null,
          costo_usd: null,
          version_de_rubrica: null,
          intencion: null,
          decisor: null,
          riesgos: null,
          titular: null,
        };
  await enOrganizacion(orgId, (db) =>
    db
      .insertInto('analizador_fichas')
      .values({ llamada_id: llamadaId, tipo_derivado: 'PROSPECT_CARD', ...valores } as never)
      .onConflict((oc) =>
        oc.columns(['org_id', 'llamada_id', 'tipo_derivado']).doUpdateSet({ ...valores, actualizado_el: sql`now()` } as never),
      )
      .execute(),
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · Borrar y reencaminar
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Borra la llamada y deja la lápida, **en la misma transacción**. Transcripción, análisis y ficha
 * se van por cascada.
 *
 * Devuelve `false` si la llamada no existe en esta organización —que incluye «existe en otra»: la
 * política de fila no la deja ver, y eso es exactamente lo que tiene que pasar—.
 */
export async function borrarLlamada(orgId: string, llamadaId: string): Promise<boolean> {
  return enOrganizacion(orgId, async (db) => {
    const borrada = await db
      .deleteFrom('analizador_llamadas')
      .where('id', '=', llamadaId)
      .returning(['proveedor', 'reunion_externa_id'])
      .executeTakeFirst();
    if (!borrada) return false;
    if (borrada.reunion_externa_id !== null) {
      await db
        .insertInto('analizador_lapidas')
        .values({ proveedor: borrada.proveedor, reunion_externa_id: borrada.reunion_externa_id } as never)
        .onConflict((oc) => oc.columns(['org_id', 'proveedor', 'reunion_externa_id']).doNothing())
        .execute();
    }
    return true;
  });
}

export type ResultadoDeReencaminar = 'hecho' | 'no_encontrada' | 'ya_analizada' | 'en_curso' | 'mismo_tipo';

/**
 * Cambia el tipo de una llamada. A HT u OB queda PENDING; a OTRO queda NOT_MATCH.
 *
 * ── UNA DONE NO SE REENCAMINA, Y LO DICE EL SERVIDOR ─────────────────────────
 *
 * En el origen lo impedía solo la pantalla. Una HT en DONE movida a OB quedaba PENDING con su
 * análisis de HT adentro, y el detalle OB lo habría dibujado como si fuera un onboarding. Acá la
 * condición va en el mismo `update`, así que ni una petición armada a mano lo consigue.
 */
export async function reencaminar(
  orgId: string,
  llamadaId: string,
  nuevoTipo: TipoDeLlamadaAnalizada,
): Promise<ResultadoDeReencaminar> {
  return enOrganizacion(orgId, async (db) => {
    const actual = await db
      .selectFrom('analizador_llamadas')
      .select(['tipo', 'estado'])
      .where('id', '=', llamadaId)
      .executeTakeFirst();
    if (!actual) return 'no_encontrada';
    if (actual.tipo === nuevoTipo) return 'mismo_tipo';
    if (actual.estado === 'DONE') return 'ya_analizada';
    if (actual.estado === 'ANALYZING') return 'en_curso';

    const aOtro = nuevoTipo === 'OTRO';
    const fila = await db
      .updateTable('analizador_llamadas')
      .set({
        tipo: nuevoTipo,
        estado: aOtro ? 'NOT_MATCH' : 'PENDING',
        motivo: aOtro ? 'Movida a «no corresponde» a mano.' : null,
        error: null,
        actualizado_el: sql`now()`,
      } as never)
      .where('id', '=', llamadaId)
      .where('estado', 'not in', ['DONE', 'ANALYZING'])
      .returning('id')
      .executeTakeFirst();
    return fila ? 'hecho' : 'en_curso';
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · Leer
// ═══════════════════════════════════════════════════════════════════════════════

export type FiltroDeLista = 'analizadas' | 'pendientes' | 'descartadas';

/** Qué estados entran en cada filtro de la lista. */
export const ESTADOS_DEL_FILTRO: Readonly<Record<FiltroDeLista, readonly EstadoDeLlamadaAnalizada[]>> = {
  analizadas: ['DONE'],
  pendientes: ['PENDING', 'ANALYZING', 'FAILED'],
  descartadas: ['NOT_MATCH'],
};

export interface FilaDeLista {
  id: string;
  tipo: TipoDeLlamadaAnalizada;
  proveedor: ProveedorDeReuniones;
  estado: EstadoDeLlamadaAnalizada;
  titulo: string | null;
  prospectoNombre: string | null;
  prospectoEmail: string | null;
  fechaDeLaReunion: string | null;
  creadoEl: string;
  tomadaEl: string | null;
  motivo: string | null;
  error: string | null;
  puntaje: number | null;
  resultado: string | null;
  colorDelPuntaje: string | null;
  preparacion: string | null;
  resumen: string | null;
}

/**
 * La lista de una pestaña.
 *
 * Las descartadas de una pestaña son **sus vetadas más todas las OTRO**: una OTRO no es de ninguna
 * de las dos, y es desde cualquiera de las dos que alguien la puede reencaminar.
 */
export async function listarLlamadas(
  orgId: string,
  tipo: 'HT' | 'OB',
  filtro: FiltroDeLista,
  limite = 200,
): Promise<FilaDeLista[]> {
  const filas = await enOrganizacion(orgId, (db) =>
    db
      .selectFrom('analizador_llamadas as l')
      .leftJoin('analizador_analisis as a', (j) => j.onRef('a.org_id', '=', 'l.org_id').onRef('a.llamada_id', '=', 'l.id'))
      .select([
        'l.id', 'l.tipo', 'l.proveedor', 'l.estado', 'l.titulo', 'l.prospecto_nombre', 'l.prospecto_email',
        'l.fecha_de_la_reunion', 'l.creado_el', 'l.tomada_el', 'l.motivo', 'l.error',
        'a.puntaje', 'a.resultado', 'a.color_del_puntaje', 'a.preparacion', 'a.resumen',
      ])
      .where((eb) =>
        filtro === 'descartadas'
          ? eb.and([
              eb('l.estado', '=', 'NOT_MATCH'),
              eb.or([eb('l.tipo', '=', tipo), eb('l.tipo', '=', 'OTRO')]),
            ])
          : eb.and([eb('l.tipo', '=', tipo), eb('l.estado', 'in', [...ESTADOS_DEL_FILTRO[filtro]])]),
      )
      .orderBy(sql`coalesce(l.fecha_de_la_reunion, l.creado_el)`, 'desc')
      .limit(limite)
      .execute(),
  );
  return filas.map((f) => ({
    id: f.id,
    tipo: f.tipo,
    proveedor: f.proveedor,
    estado: f.estado,
    titulo: f.titulo,
    prospectoNombre: f.prospecto_nombre,
    prospectoEmail: f.prospecto_email,
    fechaDeLaReunion: f.fecha_de_la_reunion === null ? null : f.fecha_de_la_reunion.toISOString(),
    creadoEl: f.creado_el.toISOString(),
    tomadaEl: f.tomada_el === null ? null : f.tomada_el.toISOString(),
    motivo: f.motivo,
    error: f.error,
    puntaje: f.puntaje,
    resultado: f.resultado,
    colorDelPuntaje: f.color_del_puntaje,
    preparacion: f.preparacion,
    resumen: f.resumen,
  }));
}

/** Cuántas hay en cada filtro de una pestaña, para «Pendientes (n)». */
export async function contarPorFiltro(orgId: string, tipo: 'HT' | 'OB'): Promise<Record<FiltroDeLista, number>> {
  const filas = await enOrganizacion(orgId, (db) =>
    db
      .selectFrom('analizador_llamadas')
      .select(['tipo', 'estado', sql<number>`count(*)::int`.as('n')])
      .where((eb) => eb.or([eb('tipo', '=', tipo), eb('tipo', '=', 'OTRO')]))
      .groupBy(['tipo', 'estado'])
      .execute(),
  );
  const cuenta: Record<FiltroDeLista, number> = { analizadas: 0, pendientes: 0, descartadas: 0 };
  for (const f of filas) {
    if (f.estado === 'NOT_MATCH') cuenta.descartadas += f.n;
    else if (f.tipo !== 'OTRO' && f.estado === 'DONE') cuenta.analizadas += f.n;
    else if (f.tipo !== 'OTRO') cuenta.pendientes += f.n;
  }
  return cuenta;
}

/** El detalle de una llamada. **No trae la transcripción**: ninguna respuesta de la API la devuelve. */
export interface DetalleDeLlamada {
  llamada: FilaDeLista & {
    prospectoId: string | null;
    duracionSeg: number | null;
    organizadorNombre: string | null;
    organizadorEmail: string | null;
    urlDeLaGrabacion: string | null;
    invitados: { name?: string; email?: string }[] | null;
    conMarcasDeTiempo: boolean | null;
  };
  analisis: {
    coincide: boolean;
    tipo: 'HT' | 'OB';
    analisis: unknown;
    modelo: string;
    versionDeRubrica: string;
    analizadoEl: string;
    uso: { entrada: number | null; salida: number | null; escrituraCache: number | null; lecturaCache: number | null };
    costoUsd: string | null;
  } | null;
  ficha: {
    estado: 'OK' | 'FAILED';
    ficha: unknown;
    error: string | null;
    versionDeRubrica: string | null;
    actualizadoEl: string;
  } | null;
  /** «Reunión N de M»: las llamadas del mismo prospecto, de la más vieja a la más nueva. */
  historial: { id: string; fechaDeLaReunion: string | null; creadoEl: string }[];
}

export async function leerDetalle(orgId: string, llamadaId: string): Promise<DetalleDeLlamada | null> {
  return enOrganizacion(orgId, async (db) => {
    const l = await db
      .selectFrom('analizador_llamadas as l')
      .leftJoin('analizador_transcripciones as t', (j) => j.onRef('t.org_id', '=', 'l.org_id').onRef('t.llamada_id', '=', 'l.id'))
      .leftJoin('analizador_analisis as a', (j) => j.onRef('a.org_id', '=', 'l.org_id').onRef('a.llamada_id', '=', 'l.id'))
      .select([
        'l.id', 'l.tipo', 'l.proveedor', 'l.estado', 'l.titulo', 'l.prospecto_id', 'l.prospecto_nombre',
        'l.prospecto_email', 'l.fecha_de_la_reunion', 'l.creado_el', 'l.tomada_el', 'l.motivo', 'l.error',
        'l.duracion_seg', 'l.organizador_nombre', 'l.organizador_email', 'l.url_de_la_grabacion', 'l.invitados',
        't.con_marcas_de_tiempo',
        'a.coincide', 'a.tipo as a_tipo', 'a.analisis', 'a.modelo', 'a.version_de_rubrica', 'a.analizado_el',
        'a.tokens_entrada', 'a.tokens_salida', 'a.tokens_escritura_cache', 'a.tokens_lectura_cache', 'a.costo_usd',
        'a.puntaje', 'a.resultado', 'a.color_del_puntaje', 'a.preparacion', 'a.resumen',
      ])
      .where('l.id', '=', llamadaId)
      .executeTakeFirst();
    if (!l) return null;

    const f = await db
      .selectFrom('analizador_fichas')
      .select(['estado', 'ficha', 'error', 'version_de_rubrica', 'actualizado_el'])
      .where('llamada_id', '=', llamadaId)
      .where('tipo_derivado', '=', 'PROSPECT_CARD')
      .executeTakeFirst();

    const historial =
      l.prospecto_id === null
        ? []
        : await db
            .selectFrom('analizador_llamadas')
            .select(['id', 'fecha_de_la_reunion', 'creado_el'])
            .where('prospecto_id', '=', l.prospecto_id)
            .orderBy(sql`coalesce(fecha_de_la_reunion, creado_el)`, 'asc')
            .execute();

    return {
      llamada: {
        id: l.id,
        tipo: l.tipo,
        proveedor: l.proveedor,
        estado: l.estado,
        titulo: l.titulo,
        prospectoId: l.prospecto_id,
        prospectoNombre: l.prospecto_nombre,
        prospectoEmail: l.prospecto_email,
        fechaDeLaReunion: l.fecha_de_la_reunion === null ? null : l.fecha_de_la_reunion.toISOString(),
        creadoEl: l.creado_el.toISOString(),
        tomadaEl: l.tomada_el === null ? null : l.tomada_el.toISOString(),
        motivo: l.motivo,
        error: l.error,
        puntaje: l.puntaje,
        resultado: l.resultado,
        colorDelPuntaje: l.color_del_puntaje,
        preparacion: l.preparacion,
        resumen: l.resumen,
        duracionSeg: l.duracion_seg,
        organizadorNombre: l.organizador_nombre,
        organizadorEmail: l.organizador_email,
        urlDeLaGrabacion: l.url_de_la_grabacion,
        invitados: l.invitados,
        conMarcasDeTiempo: l.con_marcas_de_tiempo,
      },
      analisis:
        l.coincide === null || l.a_tipo === null || l.modelo === null || l.version_de_rubrica === null || l.analizado_el === null
          ? null
          : {
              coincide: l.coincide,
              tipo: l.a_tipo,
              analisis: l.analisis,
              modelo: l.modelo,
              versionDeRubrica: l.version_de_rubrica,
              analizadoEl: l.analizado_el.toISOString(),
              uso: {
                entrada: l.tokens_entrada,
                salida: l.tokens_salida,
                escrituraCache: l.tokens_escritura_cache,
                lecturaCache: l.tokens_lectura_cache,
              },
              costoUsd: l.costo_usd,
            },
      ficha: f
        ? {
            estado: f.estado,
            ficha: f.ficha,
            error: f.error,
            versionDeRubrica: f.version_de_rubrica,
            actualizadoEl: f.actualizado_el.toISOString(),
          }
        : null,
      historial: historial.map((h) => ({
        id: h.id,
        fechaDeLaReunion: h.fecha_de_la_reunion === null ? null : h.fecha_de_la_reunion.toISOString(),
        creadoEl: h.creado_el.toISOString(),
      })),
    };
  });
}

/** Lo que el motor necesita de una llamada para analizarla. */
export interface LlamadaParaAnalizar {
  id: string;
  tipo: TipoDeLlamadaAnalizada;
  estado: EstadoDeLlamadaAnalizada;
  titulo: string | null;
  prospectoId: string | null;
  prospectoNombre: string | null;
  prospectoEmail: string | null;
  fechaDeLaReunion: string | null;
  organizadorNombre: string | null;
  organizadorEmail: string | null;
  transcripcion: NormalizedTranscript | null;
}

export async function leerParaAnalizar(orgId: string, llamadaId: string): Promise<LlamadaParaAnalizar | null> {
  const fila = await enOrganizacion(orgId, (db) =>
    db
      .selectFrom('analizador_llamadas as l')
      .leftJoin('analizador_transcripciones as t', (j) => j.onRef('t.org_id', '=', 'l.org_id').onRef('t.llamada_id', '=', 'l.id'))
      .select([
        'l.id', 'l.tipo', 'l.estado', 'l.titulo', 'l.prospecto_id', 'l.prospecto_nombre', 'l.prospecto_email',
        'l.fecha_de_la_reunion', 'l.organizador_nombre', 'l.organizador_email', 'l.reunion_externa_id',
        't.texto', 't.segmentos',
      ])
      .where('l.id', '=', llamadaId)
      .executeTakeFirst(),
  );
  if (!fila) return null;
  return {
    id: fila.id,
    tipo: fila.tipo,
    estado: fila.estado,
    titulo: fila.titulo,
    prospectoId: fila.prospecto_id,
    prospectoNombre: fila.prospecto_nombre,
    prospectoEmail: fila.prospecto_email,
    fechaDeLaReunion: fila.fecha_de_la_reunion === null ? null : fila.fecha_de_la_reunion.toISOString(),
    organizadorNombre: fila.organizador_nombre,
    organizadorEmail: fila.organizador_email,
    /* El identificador y el idioma como los armaba el origen al leer de la base (`pipeline.ts`,
       `loadTranscriptForCall`): van en la cabecera del mensaje al modelo, así que son parte del
       prompt. `idioma` queda guardado, pero el origen mandaba siempre 'es'. */
    transcripcion:
      fila.texto === null || fila.segmentos === null
        ? null
        : {
            externalMeetingId: fila.reunion_externa_id || `call-${fila.id}`,
            language: 'es',
            segments: fila.segmentos as NormalizedSegment[],
            fullText: fila.texto,
          },
  };
}

/** Las PENDING de estos tipos, en orden de llegada. */
export async function pendientesParaAnalizar(
  orgId: string,
  tipos: readonly ('HT' | 'OB')[],
  limite: number,
): Promise<string[]> {
  if (tipos.length === 0) return [];
  const filas = await enOrganizacion(orgId, (db) =>
    db
      .selectFrom('analizador_llamadas')
      .select('id')
      .where('estado', '=', 'PENDING')
      .where('tipo', 'in', [...tipos])
      .orderBy('creado_el', 'asc')
      .limit(limite)
      .execute(),
  );
  return filas.map((f) => f.id);
}

/**
 * Las HT analizadas que no tienen ficha. `NOT EXISTS` y no «traer varias y filtrar en memoria»: una
 * ficha vieja que caía fuera de la ventana del origen no se generaba nunca.
 */
export async function llamadasSinFicha(orgId: string, limite: number): Promise<string[]> {
  const filas = await enOrganizacion(orgId, (db) =>
    db
      .selectFrom('analizador_llamadas as l')
      .innerJoin('analizador_analisis as a', (j) => j.onRef('a.org_id', '=', 'l.org_id').onRef('a.llamada_id', '=', 'l.id'))
      .select('l.id')
      .where('l.tipo', '=', 'HT')
      .where('l.estado', '=', 'DONE')
      .where('a.coincide', '=', true)
      .where(({ not, exists, selectFrom }) =>
        not(
          exists(
            selectFrom('analizador_fichas as f')
              .select(sql`1`.as('uno'))
              .whereRef('f.org_id', '=', 'l.org_id')
              .whereRef('f.llamada_id', '=', 'l.id'),
          ),
        ),
      )
      .orderBy('l.creado_el', 'asc')
      .limit(limite)
      .execute(),
  );
  return filas.map((f) => f.id);
}

/**
 * De estos identificadores externos, cuáles ya están: guardados como llamada o con lápida. Es el
 * descarte del descubrimiento, y va antes de pagar un solo clasificador.
 */
export async function reunionesConocidas(
  orgId: string,
  proveedor: ProveedorDeReuniones,
  ids: readonly string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  return enOrganizacion(orgId, async (db) => {
    // En serie y no con `Promise.all`: las dos van por la MISMA conexión de la transacción.
    const llamadas = await db
      .selectFrom('analizador_llamadas')
      .select('reunion_externa_id')
      .where('proveedor', '=', proveedor)
      .where('reunion_externa_id', 'in', [...ids])
      .execute();
    const lapidas = await db
      .selectFrom('analizador_lapidas')
      .select('reunion_externa_id')
      .where('proveedor', '=', proveedor)
      .where('reunion_externa_id', 'in', [...ids])
      .execute();
    const conocidas = new Set<string>();
    for (const f of [...llamadas, ...lapidas]) if (f.reunion_externa_id !== null) conocidas.add(f.reunion_externa_id);
    return conocidas;
  });
}
