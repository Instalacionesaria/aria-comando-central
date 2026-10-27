// El reproceso de los avisos de OPORTUNIDAD que quedaron sin procesar.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ EXISTE (revisión final de la estructura, 2026-10-27)
//
// La etapa del Pipeline Maestro y la Salida llegan SÓLO por el aviso del CRM (`?evento=oportunidad.etapa` y
// `?evento=oportunidad.salida`): ni la búsqueda de contactos ni `GET /contacts/{id}` traen la oportunidad
// (`lib/ghl/avisos.ts`). Con los mensajes, un aviso perdido lo trae el sondeo diez minutos después; con la etapa, no
// hay sondeo. Y la ruta responde 200 aunque la interpretación falle —GoHighLevel apaga un workflow ante fallos
// repetidos—, así que GoHighLevel no reintenta.
//
// Entonces un aviso de oportunidad que quedó guardado y sin procesar se reprocesa ACÁ, en la tarea `contactos` del
// barrido (cada diez minutos, por cliente, después de releer los contactos: un contacto nuevo ya está en la caché):
//
//   · los que fallaron por algo transitorio (`MOTIVO_FALLO`: un 429 o 5xx de GoHighLevel al pedir el contacto, un error
//     de la base) o porque faltaba la credencial (`MOTIVO_SIN_CREDENCIAL`);
//   · los que la ruta guardó por encima del tope por hora y dejó para después (`MOTIVO_EN_ESPERA`);
//   · los que quedaron sin procesar y sin motivo: la función se cortó (`maxDuration`) a mitad de camino. Con
//     `MINUTOS_DE_GRACIA`, para no pisar a la ruta que todavía está en ellos.
//
// Los que no se interpretaron por un motivo que no cambia solo (sin mapear, sin dato, sin contacto, un evento
// desconocido) NO se reprocesan: su motivo es lo que el monitor tiene que mostrar.
//
// ── IDEMPOTENTE ─────────────────────────────────────────────────────────────
//
// Se interpreta con la MISMA fila —su `id` y su `recibido_el`—, o sea con el mismo `aviso:<id>` y la misma hora que
// usó la ruta: si la ruta llegó a escribir el evento antes de caerse, el `on conflict do nothing` de
// `lib/negocio/etapaDelCrm.ts` no escribe otro. Y en orden de `recibido_el`: los cambios de un lead entran en el orden
// en que pasaron.
//
// ── ACOTADO ─────────────────────────────────────────────────────────────────
//
// Hasta `TOPE_DEL_REPROCESO` filas por pasada y por cliente, de los últimos `DIAS_DEL_REPROCESO` días, y hasta
// `INTENTOS_DEL_REPROCESO` intentos por fila (el intento va en el motivo: `reintento N: …`). Lo que queda se informa
// en el resumen (`quedan`) y el sello lo dice (`motivoDeLoIncompleto`).
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { conOrganizacion, datos } from '../datos/contexto.ts';
import { cuentaDe, type AmbitoDeUnCliente } from './ambitoDelCliente.ts';
import { interpretarAviso, type Interpretado, type LectorDeContacto } from './avisoDelCrm.ts';
import { refrescarUnContacto } from './sincronizar.ts';

/** Cuántos avisos por pasada y por cliente. Uno de un contacto conocido no llama al CRM: son milisegundos de base. */
export const TOPE_DEL_REPROCESO = 100;
/** Hasta cuántos días atrás se reprocesa: más viejo, ya no es un fallo transitorio. */
export const DIAS_DEL_REPROCESO = 7;
/** Cuántas veces se reintenta una fila que vuelve a fallar. Un dígito: el filtro lo lee del motivo. */
export const INTENTOS_DEL_REPROCESO = 5;
/** Una fila sin procesar y sin motivo más nueva que esto puede ser de una ruta que todavía corre (`maxDuration` 10 s). */
export const MINUTOS_DE_GRACIA = 2;

/** El motivo de un aviso cuya interpretación lanzó: transitorio, se reprocesa. */
export const MOTIVO_FALLO = 'el mapeo no pudo completarse';
/** El prefijo del motivo de un aviso que llegó sin la credencial del CRM: se reprocesa cuando la hay. */
export const MOTIVO_SIN_CREDENCIAL = 'sin credencial del CRM';
/** El motivo de un aviso de oportunidad guardado por encima del tope por hora: lo procesa el reproceso. */
export const MOTIVO_EN_ESPERA = 'en espera: pasó el tope de avisos por hora';

/** Los eventos que se reprocesan: los de la oportunidad, que no tienen otra puerta. */
const EVENTOS = ['oportunidad.etapa', 'oportunidad.salida'] as const;

/** El motivo que queda en la fila de un aviso que no se procesó. */
export function motivoDelAviso(r: Exclude<Interpretado, { tipo: 'listo' }>): string {
  if (r.tipo === 'desconocido') return `evento desconocido: ${r.evento ?? '(sin parámetro)'}`;
  // El valor de la etapa o la Salida es el nombre de una etapa del CRM, no un dato de la persona.
  if (r.tipo === 'sin_mapear') return `${r.que} sin mapear: ${r.valor}`;
  if (r.tipo === 'sin_dato') return `sin ${r.que} en la URL ni en el cuerpo`;
  return r.tipo;
}

/** El motivo del siguiente intento fallido: `reintento N: …`. */
function motivoDelReintento(anterior: string | null): string {
  const n = /^reintento (\d+): /.exec(anterior ?? '');
  return `reintento ${(n ? Number(n[1]) : 0) + 1}: ${MOTIVO_FALLO}`;
}

export interface ResumenDelReproceso {
  /** Cuántas filas se tomaron en esta pasada. */
  revisados: number;
  /** Cuántas quedaron procesadas. */
  procesados: number;
  /** Cuántas se interpretaron y no se pudieron procesar por un motivo que no cambia solo (quedó anotado). */
  sinProcesar: number;
  /** Cuántas volvieron a fallar (se reintentan en la pasada siguiente, hasta `INTENTOS_DEL_REPROCESO`). */
  fallaron: number;
  /** Quedaron más para la pasada siguiente (el tope o el fin de la corrida). */
  quedan: boolean;
  /** Cuántas veces se le pidió un contacto a GoHighLevel. */
  llamadas: number;
}

interface FilaPendiente {
  id: string;
  evento: string;
  cuerpo: string;
  consulta: string | null;
  recibido_el: Date;
  error: string | null;
}

/**
 * Reprocesa los avisos de oportunidad pendientes de UN cliente. Corre fuera de un contexto: abre el del cliente.
 *
 * @param fin Hasta cuándo puede correr (milisegundos, el reloj de `ahora`): el fin de la corrida del barrido.
 */
export async function reprocesarAvisosDeOportunidad(
  ambito: AmbitoDeUnCliente,
  acceso: { token: string; locationId: string },
  opciones: { tope?: number; fin?: number; ahora?: () => number; leerContacto?: LectorDeContacto } = {},
): Promise<ResumenDelReproceso> {
  const tope = opciones.tope ?? TOPE_DEL_REPROCESO;
  const ahora = opciones.ahora ?? Date.now;
  const resumen: ResumenDelReproceso = { revisados: 0, procesados: 0, sinProcesar: 0, fallaron: 0, quedan: false, llamadas: 0 };
  const lector = opciones.leerContacto ?? refrescarUnContacto;
  const leerContacto: LectorDeContacto = async (a, id) => {
    resumen.llamadas += 1;
    return lector(a, id);
  };

  const pendientes = await conOrganizacion(ambito, async () =>
    datos()
      .selectFrom('avisos_del_crm')
      .select(['id', 'evento', 'cuerpo', 'consulta', 'recibido_el', 'error'])
      .where('cuenta_id', '=', cuentaDe(ambito))
      .where('evento', 'in', [...EVENTOS])
      .where('procesado_el', 'is', null)
      .where(sql<boolean>`recibido_el > now() - make_interval(days => ${DIAS_DEL_REPROCESO})`)
      .where(
        sql<boolean>`(
          (error is null and visto_ultimo_el < now() - make_interval(mins => ${MINUTOS_DE_GRACIA}))
          or error = ${MOTIVO_FALLO}
          or error = ${MOTIVO_EN_ESPERA}
          or starts_with(error, ${MOTIVO_SIN_CREDENCIAL})
          or error ~ ${`^reintento [1-${INTENTOS_DEL_REPROCESO - 1}]: `}
        )`,
      )
      .orderBy('recibido_el')
      .orderBy('id')
      .limit(tope + 1)
      .execute(),
  ) as FilaPendiente[];

  if (pendientes.length > tope) resumen.quedan = true;
  for (const fila of pendientes.slice(0, tope)) {
    if (opciones.fin !== undefined && ahora() > opciones.fin) {
      resumen.quedan = true;
      break;
    }
    resumen.revisados += 1;
    // Se marca la fila con SU hora: si mientras tanto llegó un hecho nuevo de la misma rama (otro `recibido_el`), ésa
    // queda pendiente y no se da por procesada con lo de éste.
    const marcar = (cambio: { procesado_el: Date | null; error: string | null }) =>
      conOrganizacion(ambito, async () => {
        await datos()
          .updateTable('avisos_del_crm')
          .set({ ...cambio, error: cambio.error?.slice(0, 500) ?? null } as never)
          .where('id', '=', fila.id)
          .where(sql<boolean>`date_trunc('milliseconds', recibido_el) = ${fila.recibido_el}`)
          .execute();
      });

    let cuerpo: Record<string, unknown> | null = null;
    try {
      const crudo: unknown = JSON.parse(fila.cuerpo);
      cuerpo = crudo !== null && typeof crudo === 'object' ? (crudo as Record<string, unknown>) : null;
    } catch {
      cuerpo = null;
    }
    if (cuerpo === null) {
      resumen.sinProcesar += 1;
      await marcar({ procesado_el: null, error: 'cuerpo ilegible' });
      continue;
    }

    try {
      const r = await interpretarAviso(ambito, { tipo: 'listo', ...acceso }, fila.evento, cuerpo, leerContacto, {
        id: fila.id,
        recibidoEl: fila.recibido_el,
        parametros: new URLSearchParams(fila.consulta ?? `evento=${fila.evento}`),
      });
      if (r.tipo === 'listo') {
        resumen.procesados += 1;
        await marcar({ procesado_el: new Date(), error: null });
      } else {
        resumen.sinProcesar += 1;
        await marcar({ procesado_el: null, error: motivoDelAviso(r) });
      }
    } catch (e) {
      // El mensaje va al registro (`ADR-0704`); en la fila, el motivo genérico con su número de intento.
      console.error(`reproceso de avisos: ${fila.evento} ${fila.id} volvió a fallar`, e);
      resumen.fallaron += 1;
      await marcar({ procesado_el: null, error: motivoDelReintento(fila.error) });
    }
  }
  return resumen;
}
