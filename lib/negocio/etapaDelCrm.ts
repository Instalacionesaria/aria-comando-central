// EL escritor de la etapa del Pipeline Maestro y de la Salida de cada lead.
//
// ═══════════════════════════════════════════════════════════════════════════════
// GOHIGHLEVEL LA MUEVE; COMANDO CENTRAL LA REGISTRA
//
// Decidido el 2026-10-27 (cierra la F1 de `docs/_privado/modelo-de-datos/23-REVISION-PARA-PRODUCCION.md`): la etapa estándar
// (lead › conversacion › calificado › agendado › asistio › venta › onboarding) y la Salida las mueven los workflows de
// GoHighLevel en la oportunidad del lead. Acá se REGISTRA cada cambio con su hora, como un evento:
//
//   · `etapa_cambiada` cuando la etapa que llega es distinta de la vigente;
//   · `salida_marcada` cuando la Salida cambia (también cuando se vacía: `salida: null`).
//
// Y se actualizan las columnas vigentes de `negocio.contactos` (`etapa_estandar`, `etapa_estandar_el`, `salida`,
// `salida_el`, `ghl_oportunidad_id`), en la MISMA transacción y con el contacto bloqueado (`for update`): dos avisos
// del mismo lead que llegan juntos no pueden leer los dos la etapa vieja.
//
// ── LA ETAPA SÓLO AVANZA ───────────────────────────────────────────────────
//
// El SOP dice que la etapa sólo avanza. Si GoHighLevel la mueve hacia atrás (a mano), el evento se registra IGUAL,
// con `retrocede: true` —la historia no se esconde—, pero la vigente se queda con la más alta. Un aviso que llega
// desordenado no es un retroceso: es una llegada tardía (abajo). Avanzar vacía la Salida: un lead que vuelve a moverse
// ya no está detenido.
//
// ── ES EL ÚNICO ESCRITOR DE `negocio.eventos` EN EL CÓDIGO ──────────────────────
//
// Los demás eventos los escriben los disparadores de la base (la `106`). La prueba 332 lo exige: ningún otro archivo
// de `lib/`, `app/` o `scripts/` inserta en `eventos`.
//
// ── LA IDEMPOTENCIA ────────────────────────────────────────────────────────
//
// GoHighLevel reentrega. El evento lleva un `id_externo` determinista (el de quien llama, más `:etapa`, `:salida` o
// `:salida_vaciada`) y un `ocurrio_el` determinista (el de quien llama), y entra con `on conflict do nothing` contra
// el único `(org_id, cuenta_id, fuente, id_externo, ocurrio_el)`: reprocesar el mismo aviso no duplica nada.
//
// Y las columnas vigentes se mueven SÓLO si su evento entró. Un hecho que ya estaba registrado es una reentrega: si
// después llegó otro cambio (la Salida vieja de un aviso que se reentrega cuando un avance ya la vació), aplicarlo de
// nuevo dejaría el estado vigente distinto de la historia, con una hora vieja y sin evento.
//
// ── LA LLEGADA TARDÍA (el orden de la hora, no el de llegada al candado) ────────────
//
// El `for update` serializa en el orden en que los avisos llegan al candado, no en el de su hora: dos ramas del mismo
// movimiento corren en paralelo, y una reentrega llega con la hora de su primera llegada. Así que lo vigente se compara
// con la HORA del cambio (`etapa_estandar_el`, `salida_el`):
//
//   · una etapa más vieja que la vigente (`ocurrio < etapa_estandar_el`) es TARDÍA: se registra con `tardio: true`, su
//     `etapa_anterior` y su `retrocede` contra la etapa que regía A ESA HORA (la más alta de los `etapa_cambiada`
//     anteriores). La vigente no baja; pero si la tardía es MÁS ALTA que la vigente, la sube, con SU hora: en orden la
//     habría subido igual, y lo que vino después era menor (un retroceso, que no la baja). Así lo vigente es siempre la
//     más alta de la historia, llegue en el orden que llegue (y la tardía que sube cuenta como avance para la Salida);
//   · una Salida más vieja que la vigente (`ocurrio < salida_el`) también: se registra tardía y la vigente se queda;
//   · y una Salida más vieja que el último AVANCE (`ocurrio < etapa_estandar_el`) también: en orden, ese avance la
//     habría vaciado, aunque al llegar no encontrara ninguna Salida que vaciar;
//   · avanzar vacía la Salida sólo si ésta es anterior al avance: un avance viejo no vacía una Salida más nueva.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { conOrganizacion, datos } from '../datos/contexto.ts';
import type { AmbitoDeUnCliente } from './ambitoDelCliente.ts';

/** Un cambio que GoHighLevel hizo en la oportunidad de un lead, ya traducido al idioma común. */
export interface CambioDelCrm {
  /** El contacto NUESTRO (`negocio.contactos.id`), del cliente del ámbito. */
  readonly contactoId: string;
  /** La etapa (clave de `catalogo.etapas`). Ausente = el cambio no trae etapa. */
  readonly etapa?: string;
  /** La Salida (clave de `catalogo.salidas`); `null` = se vació. Ausente = el cambio no trae Salida. */
  readonly salida?: string | null;
  /** El id de la oportunidad en GoHighLevel, si se sabe. */
  readonly oportunidadId: string | null;
  /** El id del pipeline en GoHighLevel, si se sabe. */
  readonly pipelineId?: string | null;
  /** Cuándo pasó, DETERMINISTA para el mismo hecho (la idempotencia lo necesita). Nunca después de ahora. */
  readonly ocurrioEl: Date;
  /** La base del `id_externo` de los eventos: el id del hecho en quien lo trajo (`aviso:<id del aviso>`). */
  readonly idExterno: string;
  /** Por dónde llegó. */
  readonly via: 'aviso' | 'conciliacion';
  /** Los valores tal cual llegaron del CRM, antes de traducir (hasta 100 caracteres). */
  readonly origen: { readonly etapa?: string; readonly salida?: string };
}

/**
 * Lo que pasó con un cambio. `igual` también cuando el hecho ya estaba registrado (una reentrega): nada se movió.
 * `tardia` = el hecho es más viejo que lo vigente: quedó en la historia y lo vigente no se movió.
 */
export interface ResultadoDelCambio {
  readonly etapa: 'avanzo' | 'igual' | 'retrocede' | 'tardia' | 'no_vino';
  readonly salida: 'cambio' | 'igual' | 'tardia' | 'no_vino';
  /** Cuántos eventos se escribieron de verdad (un reproceso escribe cero). */
  readonly eventos: number;
}

const TOPE_DEL_ID_EXTERNO = 300;
const TOPE_DEL_ORIGEN = 100;

/** Un objeto sin las claves `undefined`: los datos del evento llevan sólo lo que se sabe. */
function sinIndefinidos(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}

/** Escribe un evento del pipeline; devuelve 1 si entró y 0 si ya estaba. */
async function unEvento(
  tipo: 'etapa_cambiada' | 'salida_marcada',
  contactoId: string,
  ocurrioEl: Date,
  idExterno: string,
  datosDelEvento: Record<string, unknown>,
): Promise<number> {
  const filas = await datos()
    .insertInto('eventos')
    .values({
      ocurrio_el: ocurrioEl,
      tipo,
      contacto_id: contactoId,
      // Un workflow de GoHighLevel: el sistema, no una persona ni el lead.
      actor_tipo: 'sistema',
      actor_id: null,
      fuente: 'ghl',
      id_externo: idExterno.slice(0, TOPE_DEL_ID_EXTERNO),
      datos: JSON.stringify(sinIndefinidos(datosDelEvento)),
    } as never)
    .onConflict((oc) => oc.columns(['org_id', 'cuenta_id', 'fuente', 'id_externo', 'ocurrio_el']).doNothing())
    .returning('id')
    .execute();
  return filas.length;
}

/**
 * La etapa y la Salida que regían ANTES de `ocurrio`, según la historia del lead: la etapa más alta de los
 * `etapa_cambiada` anteriores (la vigente sólo avanza) y la del último `salida_marcada` anterior. Sólo para un cambio
 * tardío; con el contacto ya bloqueado.
 */
async function aEsaHora(
  contacto: { id: string; cuenta_id: string },
  ocurrio: Date,
  etapas: ReadonlyMap<string, number>,
): Promise<{ etapa: string | null; salida: string | null }> {
  const previos = await datos()
    .selectFrom('eventos')
    .select(['tipo', 'datos', 'ocurrio_el'])
    .where('cuenta_id', '=', contacto.cuenta_id)
    .where('contacto_id', '=', contacto.id)
    .where('tipo', 'in', ['etapa_cambiada', 'salida_marcada'])
    .where('ocurrio_el', '<', ocurrio)
    .orderBy('ocurrio_el')
    .orderBy('registrado_el')
    .execute();
  let etapa: string | null = null;
  let salida: string | null = null;
  for (const p of previos) {
    const d = (typeof p.datos === 'string' ? JSON.parse(p.datos) : p.datos) as { etapa?: unknown; salida?: unknown };
    if (p.tipo === 'etapa_cambiada' && typeof d.etapa === 'string') {
      if (etapa === null || (etapas.get(d.etapa) ?? 0) > (etapas.get(etapa) ?? 0)) etapa = d.etapa;
    } else if (p.tipo === 'salida_marcada') {
      salida = typeof d.salida === 'string' ? d.salida : null;
    }
  }
  return { etapa, salida };
}

/**
 * Registra un cambio de etapa o de Salida del CRM. Una transacción, en el ámbito de UN cliente.
 *
 * Lanza si el contacto no es de este cliente, o si la etapa o la Salida no existen en su catálogo: quien llama traduce
 * antes (`lib/negocio/idiomaComun.ts`), así que una clave inválida acá es un defecto del código, no un dato.
 */
export async function registrarCambioDelCrm(ambito: AmbitoDeUnCliente, c: CambioDelCrm): Promise<ResultadoDelCambio> {
  // Nunca en el futuro: el control de `negocio.eventos` exige `ocurrio_el <= registrado_el + 5 min`.
  const ocurrio = new Date(Math.min(c.ocurrioEl.getTime(), Date.now()));
  const origenEtapa = c.origen.etapa?.slice(0, TOPE_DEL_ORIGEN);
  const origenSalida = c.origen.salida?.slice(0, TOPE_DEL_ORIGEN);

  return conOrganizacion(ambito, async () => {
    const contacto = await datos()
      .selectFrom('contactos')
      .select(['id', 'cuenta_id', 'etapa_estandar', 'etapa_estandar_el', 'salida', 'salida_el', 'ghl_oportunidad_id'])
      .where('id', '=', c.contactoId)
      .forUpdate()
      .executeTakeFirst();
    if (!contacto) throw new Error('registrarCambioDelCrm: el contacto no es de este cliente');

    const etapas = new Map(
      (await sql<{ clave: string; orden: number }>`select clave, orden from catalogo.etapas`.execute(datos())).rows.map(
        (e) => [e.clave, Number(e.orden)] as const,
      ),
    );
    if (c.etapa !== undefined && !etapas.has(c.etapa)) {
      throw new Error(`registrarCambioDelCrm: la etapa «${c.etapa}» no existe en catalogo.etapas`);
    }
    if (c.salida !== undefined && c.salida !== null) {
      const existe = await sql<{ n: number }>`select count(*)::int as n from catalogo.salidas where clave = ${c.salida}`.execute(datos());
      if ((existe.rows[0]?.n ?? 0) === 0) {
        throw new Error(`registrarCambioDelCrm: la Salida «${c.salida}» no existe en catalogo.salidas`);
      }
    }

    const comun = {
      oportunidad_id_externo: c.oportunidadId ?? undefined,
      via: c.via,
    };
    const cambios: Record<string, unknown> = {};
    let eventos = 0;
    // Lo que regía a la hora del cambio, sólo si llegó tarde (una consulta más, y sólo entonces).
    let previo: { etapa: string | null; salida: string | null } | null = null;
    const loQueRegia = async () => (previo ??= await aEsaHora(contacto, ocurrio, etapas));

    // ── LA ETAPA ─────────────────────────────────────────────────────────────
    let etapa: ResultadoDelCambio['etapa'] = 'no_vino';
    let etapaVigente = contacto.etapa_estandar;
    if (c.etapa !== undefined) {
      if (c.etapa === contacto.etapa_estandar) {
        etapa = 'igual';
      } else if (contacto.etapa_estandar_el !== null && ocurrio < contacto.etapa_estandar_el) {
        // Llegó tarde: la vigente es de una hora posterior. Se registra contra lo que regía a SU hora, y no se mueve.
        const regia = (await loQueRegia()).etapa;
        if (c.etapa === regia) {
          etapa = 'igual';
        } else {
          const entro = await unEvento('etapa_cambiada', contacto.id, ocurrio, `${c.idExterno}:etapa`, {
            etapa: c.etapa,
            etapa_anterior: regia,
            pipeline_id: c.pipelineId ?? undefined,
            retrocede: regia !== null && (etapas.get(c.etapa) ?? 0) < (etapas.get(regia) ?? 0),
            tardio: true,
            etapa_origen: origenEtapa,
            ...comun,
          });
          eventos += entro;
          etapa = entro === 0 ? 'igual' : 'tardia';
          // Más alta que la vigente: la sube, con su hora (la vigente es la más alta de la historia, en cualquier orden).
          const vigente = contacto.etapa_estandar === null ? 0 : (etapas.get(contacto.etapa_estandar) ?? 0);
          if (entro > 0 && (etapas.get(c.etapa) ?? 0) > vigente) {
            cambios.etapa_estandar = c.etapa;
            cambios.etapa_estandar_el = ocurrio;
            etapaVigente = c.etapa;
            etapa = 'avanzo';
          }
        }
      } else {
        const antes = contacto.etapa_estandar === null ? 0 : (etapas.get(contacto.etapa_estandar) ?? 0);
        const retrocede = (etapas.get(c.etapa) ?? 0) < antes;
        const entro = await unEvento('etapa_cambiada', contacto.id, ocurrio, `${c.idExterno}:etapa`, {
          etapa: c.etapa,
          etapa_anterior: contacto.etapa_estandar,
          pipeline_id: c.pipelineId ?? undefined,
          retrocede,
          etapa_origen: origenEtapa,
          ...comun,
        });
        eventos += entro;
        // Ya registrado: es una reentrega, y la vigente no se toca (ni se vacía la Salida por este avance).
        etapa = entro === 0 ? 'igual' : retrocede ? 'retrocede' : 'avanzo';
        if (entro > 0 && !retrocede) {
          cambios.etapa_estandar = c.etapa;
          cambios.etapa_estandar_el = ocurrio;
          etapaVigente = c.etapa;
        }
      }
    }

    // ── LA SALIDA ────────────────────────────────────────────────────────────
    let salida: ResultadoDelCambio['salida'] = 'no_vino';
    let salidaVigente = contacto.salida;
    // Avanzar vacía la Salida: el lead volvió a moverse. Salvo que el mismo cambio traiga su Salida (Asistió con
    // Adelanto): entonces decide la rama de abajo, con un solo evento. Y salvo que la Salida sea POSTERIOR al avance
    // (las dos ramas del mismo movimiento llegaron al candado al revés): un avance viejo no vacía una Salida nueva.
    const salidaPosterior = contacto.salida_el !== null && contacto.salida_el >= ocurrio;
    if (etapa === 'avanzo' && salidaVigente !== null && c.salida === undefined && !salidaPosterior) {
      eventos += await unEvento('salida_marcada', contacto.id, ocurrio, `${c.idExterno}:salida_vaciada`, {
        salida: null,
        salida_anterior: salidaVigente,
        etapa: etapaVigente,
        ...comun,
      });
      cambios.salida = null;
      cambios.salida_el = ocurrio;
      salidaVigente = null;
      salida = 'cambio';
    }
    // El último avance: el de este mismo cambio si avanzó (o subió), si no el que ya estaba.
    const ultimoAvance = (cambios.etapa_estandar_el as Date | undefined) ?? contacto.etapa_estandar_el;
    if (c.salida !== undefined) {
      if (c.salida === salidaVigente) {
        if (salida === 'no_vino') salida = 'igual';
      } else if (
        (contacto.salida_el !== null && ocurrio < contacto.salida_el) ||
        (ultimoAvance !== null && ocurrio < ultimoAvance)
      ) {
        // Llegó tarde: la vigente es de una hora posterior, o hubo un avance después (que en orden la habría vaciado).
        // Queda en la historia, contra lo que regía a SU hora.
        const regia = await loQueRegia();
        if (c.salida === regia.salida) {
          if (salida === 'no_vino') salida = 'igual';
        } else {
          const entro = await unEvento('salida_marcada', contacto.id, ocurrio, `${c.idExterno}:salida`, {
            salida: c.salida,
            salida_anterior: regia.salida,
            etapa: regia.etapa,
            tardio: true,
            salida_origen: origenSalida,
            ...comun,
          });
          eventos += entro;
          if (salida === 'no_vino') salida = entro === 0 ? 'igual' : 'tardia';
        }
      } else {
        const entro = await unEvento('salida_marcada', contacto.id, ocurrio, `${c.idExterno}:salida`, {
          salida: c.salida,
          salida_anterior: salidaVigente,
          etapa: etapaVigente,
          salida_origen: origenSalida,
          ...comun,
        });
        eventos += entro;
        if (entro > 0) {
          cambios.salida = c.salida;
          cambios.salida_el = ocurrio;
          salida = 'cambio';
        } else if (salida === 'no_vino') {
          // Ya registrado: una reentrega de una Salida que después cambió. La vigente se queda como está.
          salida = 'igual';
        }
      }
    }

    // ── LA OPORTUNIDAD ───────────────────────────────────────────────────────
    // Se guarda la PRIMERA. Si otra oportunidad ya la tiene otro contacto del cliente (el «crear o actualizar» del SOP
    // falló en GoHighLevel), no se pisa ni se falla: el índice único lo rechazaría y se perdería el cambio de etapa.
    if (c.oportunidadId !== null && contacto.ghl_oportunidad_id === null) {
      const ajena = await datos()
        .selectFrom('contactos')
        .select('id')
        .where('ghl_oportunidad_id', '=', c.oportunidadId)
        .where('id', '<>', contacto.id)
        .executeTakeFirst();
      if (!ajena) cambios.ghl_oportunidad_id = c.oportunidadId;
    }

    if (Object.keys(cambios).length > 0) {
      await datos()
        .updateTable('contactos')
        .set(cambios as never)
        .where('id', '=', contacto.id)
        .execute();
    }
    return { etapa, salida, eventos };
  });
}
