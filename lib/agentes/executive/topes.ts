// Los topes del cerebro: cuántas preguntas por día admite, por persona y por empresa. Único escritor de
// `negocio.topes_del_executive` y de `negocio.preguntas_del_executive` (migración 071). Los topes los fija
// el Admin desde Ajustes (`fijarTopes`, `app/api/admin/cerebro/route.ts`).
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL CANDADO
//
// `docs/OTROS/agentes/06-MODELOS-USO-TOPES-E-INCIDENTES.md`, AG-96. Contar y reservar tienen que pasar
// juntos: dos preguntas en paralelo que cuentan 49 antes de que cualquiera reserve pasarían las dos el 50.
// Por eso `bloquearYContar` toma `select … for update` sobre la fila de topes de la empresa —la casa
// bloquea filas, como `lib/negocio/pulso.ts`— y quien reserva lo hace en la MISMA transacción, antes de
// soltarla. La fila se crea la primera vez con los valores por omisión: sin fila no habría qué bloquear.
//
// ── QUÉ CUENTA ───────────────────────────────────────────────────────────────
//
// Se cuenta en `preguntas_del_executive`, que no cuelga de los hilos: borrar un hilo no devuelve sus
// preguntas al tope. Cuentan:
//   · las `respondida`;
//   · las `fallida_pagada`: el proveedor contestó y se pagó, aunque la respuesta no sirviera. Sin esto, una
//     pregunta hecha para no llegar nunca a la forma de `responder` costaría seis rondas y se podría
//     repetir sin límite;
//   · las `reservada` de los últimos `VIGENCIA_DE_UNA_RESERVA_MIN` minutos. Una más vieja es de una función
//     que la plataforma cortó a mitad de camino, y no puede ocupar un lugar hasta la medianoche.
// Una `fallida` sin pago (el proveedor no contestó) no cuenta.
//
// El día es el de la empresa: se cuenta desde la medianoche de su zona.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../../datos/contexto.ts';

/** `D-16`: 50 por persona y 300 por empresa, hasta que el Admin los cambie (AG7). */
export const TOPES_POR_OMISION = { porPersona: 50, porEmpresa: 300 } as const;

/** Más que una pregunta entera (240 s de modelo dentro de una función de 300). Ver el encabezado. */
export const VIGENCIA_DE_UNA_RESERVA_MIN = 10;

export type FinalDeUnaPregunta = 'respondida' | 'fallida' | 'fallida_pagada';

export interface LoUsadoHoy {
  porPersona: number;
  porEmpresa: number;
  usadasPorPersona: number;
  usadasPorEmpresa: number;
  /** La próxima medianoche de la empresa, cuando se renueva. */
  renuevaEl: Date;
}

/**
 * Bloquea la fila de topes de la empresa y cuenta las preguntas de hoy que cuentan. **Corre dentro de la
 * `conOrganizacion` de la reserva**, y el candado dura hasta que esa transacción termine.
 */
export async function bloquearYContar(usuarioId: string, zona: string): Promise<LoUsadoHoy> {
  await datos().insertInto('topes_del_executive').values({} as never).onConflict((oc) => oc.column('org_id').doNothing()).execute();
  const topes = await datos()
    .selectFrom('topes_del_executive')
    .select(['por_persona', 'por_empresa'])
    .forUpdate()
    .executeTakeFirstOrThrow();
  return contar(usuarioId, zona, Number(topes.por_persona), Number(topes.por_empresa));
}

/**
 * Lo mismo SIN candado ni escritura, para mostrar cuánto queda (el GET de la ruta). Puede quedar viejo un
 * instante después; la reserva vuelve a contar bajo candado.
 */
export async function loUsadoHoy(usuarioId: string, zona: string): Promise<LoUsadoHoy> {
  const topes = await datos().selectFrom('topes_del_executive').select(['por_persona', 'por_empresa']).executeTakeFirst();
  return contar(
    usuarioId,
    zona,
    topes ? Number(topes.por_persona) : TOPES_POR_OMISION.porPersona,
    topes ? Number(topes.por_empresa) : TOPES_POR_OMISION.porEmpresa,
  );
}

async function contar(usuarioId: string, zona: string, porPersona: number, porEmpresa: number): Promise<LoUsadoHoy> {
  const cuentas = await datos()
    .selectFrom('preguntas_del_executive')
    .select([
      sql<string>`count(*)`.as('empresa'),
      sql<string>`count(*) filter (where usuario_id = ${usuarioId})`.as('persona'),
      sql<Date>`(date_trunc('day', now() at time zone ${zona}) + interval '1 day') at time zone ${zona}`.as('renueva_el'),
    ])
    .where('creada_el', '>=', sql<Date>`(date_trunc('day', now() at time zone ${zona}) at time zone ${zona})`)
    .where((eb) =>
      eb.or([
        eb('estado', 'in', ['respondida', 'fallida_pagada']),
        eb.and([
          eb('estado', '=', 'reservada'),
          eb('creada_el', '>', sql<Date>`now() - make_interval(mins => ${VIGENCIA_DE_UNA_RESERVA_MIN})`),
        ]),
      ]),
    )
    .executeTakeFirstOrThrow();
  return {
    porPersona,
    porEmpresa,
    usadasPorPersona: Number(cuentas.persona),
    usadasPorEmpresa: Number(cuentas.empresa),
    renuevaEl: new Date(cuentas.renueva_el),
  };
}

/** ¿Queda lugar para una pregunta más? */
export function quedaLugar(u: LoUsadoHoy): boolean {
  return u.usadasPorPersona < u.porPersona && u.usadasPorEmpresa < u.porEmpresa;
}

/** Reserva el lugar de una pregunta. En la misma transacción que `bloquearYContar`, antes de soltar el candado. */
export async function reservarLugar(usuarioId: string): Promise<string> {
  const fila = await datos()
    .insertInto('preguntas_del_executive')
    .values({ usuario_id: usuarioId } as never)
    .returning('id')
    .executeTakeFirstOrThrow();
  return fila.id;
}

/** Cierra la pregunta con su final. Sólo la que sigue `reservada`: un final no pisa otro. */
export async function cerrarLugar(id: string, final: FinalDeUnaPregunta): Promise<void> {
  await datos()
    .updateTable('preguntas_del_executive')
    .set({ estado: final, terminada_el: sql`now()` } as never)
    .where('id', '=', id)
    .where('estado', '=', 'reservada')
    .execute();
}

/** El techo de lo que el Admin puede fijar: un número fuera de escala es un error de tipeo, no un tope. */
export const TOPE_MAXIMO = 5000;

export interface TopesDeLaEmpresa {
  porPersona: number;
  porEmpresa: number;
  /** Cuándo los cambió alguien, y quién; `null` si siguen los de omisión. */
  actualizadoEl: Date | null;
  actualizadoPor: string | null;
}

/** Los topes de la empresa, o los de omisión si nadie los fijó. Sin escribir: la fila nace al reservar. */
export async function topesDeLaEmpresa(): Promise<TopesDeLaEmpresa> {
  const f = await datos()
    .selectFrom('topes_del_executive')
    .select(['por_persona', 'por_empresa', 'actualizado_el', 'actualizado_por'])
    .executeTakeFirst();
  if (!f) return { ...TOPES_POR_OMISION, actualizadoEl: null, actualizadoPor: null };
  return {
    porPersona: Number(f.por_persona),
    porEmpresa: Number(f.por_empresa),
    actualizadoEl: new Date(f.actualizado_el),
    actualizadoPor: f.actualizado_por,
  };
}

/**
 * Fija los dos topes de la empresa (AG-97). `autor` es quien los cambió, o `null` bajo delegación: la fila
 * apunta a una persona de ESTA empresa, y quien mira desde otra no lo es (`autorDelCambio`). Toma el mismo
 * candado que la reserva, así un cambio no se cruza con una pregunta que está contando.
 */
export async function fijarTopes(porPersona: number, porEmpresa: number, autor: string | null): Promise<void> {
  await datos()
    .insertInto('topes_del_executive')
    .values({ por_persona: porPersona, por_empresa: porEmpresa, actualizado_por: autor } as never)
    .onConflict((oc) =>
      oc.column('org_id').doUpdateSet({ por_persona: porPersona, por_empresa: porEmpresa, actualizado_por: autor, actualizado_el: sql`now()` } as never),
    )
    .execute();
}
