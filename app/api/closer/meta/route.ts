// La meta del mes de la propia persona. La fija ella, no quien administra.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO NO PIDE UNA CAPACIDAD DE ADMINISTRACIÓN
//
// Es un trámite de la propia cuenta, igual que las tres rutas del segundo factor: se escribe una
// columna de la fila de quien está pidiendo, y de ninguna otra. Así que pide `closer.ver`, la
// capacidad de su propia pantalla — la misma que las otras cinco operaciones de `PANTALLA = 'closer'`,
// como `ADR-0304` exige.
//
// Exigir `credenciales.editar` acá sería más estricto y estaría mal: el anillo del cockpit diría
// «cargá tu meta» y el botón fallaría con un rechazo para todo el equipo salvo quien administra. Es
// el modo de falla del `07` § 2 — la pantalla se ve completa y una parte no funciona.
//
// ── Y LA COLUMNA QUE NO SE TOCA ─────────────────────────────────────────────
//
// **Solo `meta_mensual`.** El porcentaje lo fija otro endpoint y otra persona. Un único endpoint que
// escribiera las dos columnas con `?? null` borraría la mitad ajena en cada guardado, y el síntoma
// —«se me borró el porcentaje»— no tendría ninguna pista de quién lo borró.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { mensajeDeDisparador, ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion, datos } from '../../../../lib/datos/contexto.ts';
import { comisionDelMes, TIPO_CLOSER } from '../../../../lib/negocio/comision.ts';

export const PANTALLA = 'closer';

const MOTIVOS: Record<string, string> = {
  cuerpo_invalido: 'El cuerpo de la petición no es JSON válido.',
  meta_invalida:
    'La meta tiene que ser un monto mayor que cero, o `null` para quitarla. Una meta de cero no ' +
    'significa nada y la base no la acepta.',
  otra_empresa:
    'Estás mirando otra empresa. La meta es tuya y va en la tuya: acá no hay ninguna comisión ' +
    'tuya que configurar.',
};

export async function PATCH(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['closer.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  /* ── EL SUPERADMINISTRADOR MIRANDO OTRA EMPRESA ───────────────────────────
   *
   * Al conmutar de empresa, `orgEfectiva` cambia y `usuarioId` NO. Así que un `insert` acá intentaría
   * crear la fila `(empresa visitada, esa persona)`, y la clave foránea compuesta la rechazaría —con
   * un 409 y el mensaje del motor, que no explica nada.
   *
   * Se corta antes y con su propio motivo, porque la respuesta honesta no es «no se pudo»: es que en
   * la empresa de otro no hay ninguna comisión suya. La pantalla usa lo mismo para no ofrecerle
   * configurar algo imposible.
   */
  if (contexto.mirandoOtraOrganizacion) {
    return rechazo('peticion_invalida', MOTIVOS['otra_empresa']);
  }

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return rechazo('peticion_invalida', MOTIVOS['cuerpo_invalido']);
  }
  const c = cuerpo as { meta?: unknown } | null;

  /* `Object.hasOwn` y no `c.meta !== undefined`, y hay que decir exactamente cuánto vale esa
     elección: **sobre JSON las dos formas se comportan igual**. `JSON.parse` no produce claves con
     valor `undefined`, así que «vino en `null`» y «no vino» ya se distinguen con cualquiera de las
     dos, y una mutación de una a la otra **sobrevive** — medido, no supuesto.

     Se escribe así igual porque dice la intención —la pregunta es si la clave ESTÁ, no qué vale— y
     porque deja de ser equivalente el día que este cuerpo no venga de `JSON.parse`. Lo que no hay
     acá es una guarda: es una forma de escribir. */
  if (!c || !Object.hasOwn(c, 'meta')) {
    return rechazo('peticion_invalida', MOTIVOS['meta_invalida']);
  }
  const m = c.meta;
  const valida = typeof m === 'number' && Number.isFinite(m) && m > 0;
  if (m !== null && !valida) {
    // El cero cae acá. La base también lo rechazaría —tiene un `check`— pero el rechazo con motivo es
    // lo que hace que quien lo escribió entienda por qué, en vez de recibir el mensaje del motor.
    return rechazo('peticion_invalida', MOTIVOS['meta_invalida']);
  }
  const meta = m === null ? null : (m as number);

  /* ── UN RECHAZO DE LA BASE NO PUEDE SALIR COMO 500 SIN CUERPO ──────────
   *
   * Medido, y era un defecto VIVO en producción: sin este `try`, una violación del `check` de
   * `comisiones.tipo` **escapa del manejador**. Next devuelve 500 con el cuerpo vacío, `pedir()` no
   * puede parsear un cuerpo vacío y cae en su rama genérica, y la pantalla termina diciendo
   * «El servidor respondió 500» — que no le dice a nadie que falta una migración.
   *
   * El caso concreto: producción estuvo con el `check` viejo —solo `'closer'`— mientras este código
   * ya estaba desplegado, así que cualquiera que apretara «Fijar mi meta» veía ese 500.
   *
   * ── Y EL `try` ENVUELVE LA TRANSACCIÓN ENTERA, NO SU CUERPO ────────────────
   *
   * Un `try/catch` DENTRO del callback de `conOrganizacion` compila igual y está mal: el `return
   * rechazo(…)` saldría del callback y no del manejador, así que la `Response` terminaría **serializada
   * adentro de un 200**. El tipo no lo atrapa porque `ok()` recibe `unknown`. Medido: se escribió así
   * primero y `tsc` no dijo una palabra.
   *
   * `mensajeDeDisparador` solo deja pasar `P0001`, o sea un `raise` escrito por nosotros. Una
   * violación de `check` es `23514`, así que devuelve `null` y el rechazo va **sin detalle**: es lo
   * correcto, porque `ADR-0704` prohibe que un cuerpo de error revele estructura y el mensaje del
   * motor nombra la tabla y la restricción. El código `rechazo_de_la_base` (409) es lo que manda a
   * mirar la base en vez de este archivo. */
  let comision;
  try {
    comision = await conOrganizacion(contexto.orgEfectiva, async () => {
      await datos()
        .insertInto('comisiones')
        .values({
          usuario_id: contexto.usuarioId,
          tipo: TIPO_CLOSER,
          meta_mensual: meta,
          actualizado_el: new Date(),
          actualizado_por: contexto.usuarioId,
        } as never)
        .onConflict((oc) =>
          // **Solo `meta_mensual`.** `porcentaje` no aparece: no se puede pisar desde acá.
          oc.columns(['org_id', 'usuario_id', 'tipo']).doUpdateSet({
            meta_mensual: meta,
            actualizado_el: new Date(),
            actualizado_por: contexto.usuarioId,
          } as never),
        )
        .execute();

      // Se devuelve la comisión RECALCULADA, no un `{ ok: true }`: la meta cambia «cuánto falta» y
      // «meta superada», y mostrar «guardado» sin leer lo que quedó es reportar un éxito sin verificar.
      return comisionDelMes(contexto.usuarioId, contexto.organizacion.zonaHoraria);
    });
  } catch (e) {
    const deDisparador = mensajeDeDisparador(e);
    return deDisparador
      ? rechazo('rechazo_de_la_base', deDisparador)
      : rechazo('rechazo_de_la_base');
  }

  return ok({ comision });
}
