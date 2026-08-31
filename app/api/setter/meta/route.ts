// La meta del mes del setter. **Son DOS, una por tramo**, y esa es toda la diferencia con la del closer.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ NO ALCANZA CON LA RUTA DEL CLOSER Y UN PARÁMETRO MÁS
//
// La del closer escribe `meta_mensual` de la fila `(org, persona, 'closer')`. La clave primaria de
// `negocio.comisiones` incluye el `tipo`, así que el setter tiene **dos filas** —`setter_directo` y
// `setter_diferido`— y cada una lleva su propia meta.
//
// Y no es una duplicación cosmética: son dos metas que la persona se pone por separado porque miden
// dos cosas distintas. «Quiero cobrar $2.000 de ventas chicas» y «quiero cobrar $5.000 del tramo
// diferido» son dos decisiones, y la segunda depende de que su closer venda. Una meta única sobre la
// suma no se podría atribuir a ninguna de las dos, y el anillo de cada tramo no tendría arco.
//
// Así que el `tramo` viene en el cuerpo, y **se valida contra la lista cerrada**. Sin esa validación,
// un `tramo: 'closer'` desde el navegador dejaría que un setter se escriba la meta del closer, y un
// `tramo: 'cualquiera'` fallaría con el `check` de la base y el mensaje del motor.
//
// ── LO QUE SE COPIA TAL CUAL, Y HAY QUE DECIRLO ─────────────────────────────
//
// Las cuatro decisiones de la ruta del closer valen igual acá y no se repiten sus razones:
//
//   · Pide **`setter.ver`**, la capacidad de su propia pantalla, y no una de administración. Con
//     `credenciales.editar` el anillo diría «fijá tu meta» y el botón fallaría para todo el equipo
//     salvo quien administra — el modo de falla del `07` § 2.
//   · Escribe **solo `meta_mensual`**. El porcentaje lo fija otro endpoint y otra persona; un
//     `?? null` sobre las dos columnas borraría la mitad ajena en cada guardado.
//   · Corta al superadministrador que mira otra empresa, con su propio motivo: su `usuarioId` no
//     pertenece a esa empresa y la clave foránea compuesta rechazaría el `insert`.
//   · Devuelve la comisión **recalculada** y no un «listo»: la meta cambia «cuánto falta» y «meta
//     superada», y decir «guardado» sin leer lo que quedó es reportar un éxito sin verificarlo.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion, datos } from '../../../../lib/datos/contexto.ts';
import {
  TIPO_SETTER_DIFERIDO,
  TIPO_SETTER_DIRECTO,
  comisionDelSetter,
} from '../../../../lib/negocio/comisionDelSetter.ts';

export const PANTALLA = 'setter';

/**
 * Los dos tramos que ESTA ruta puede escribir. **Lista cerrada, y no es la de la base.**
 *
 * La base admite tres —`closer` también, por la migración 025— y acá hay dos a propósito: esta ruta
 * es la del setter, así que dejar pasar `closer` le permitiría a un setter escribirle la meta al
 * closer desde el navegador. El `check` de la base no lo impediría: `'closer'` es un tipo válido.
 */
const TRAMOS = [TIPO_SETTER_DIRECTO, TIPO_SETTER_DIFERIDO] as const;

const MOTIVOS: Record<string, string> = {
  cuerpo_invalido: 'El cuerpo de la petición no es JSON válido.',
  tramo_invalido:
    'Hay que decir de qué tramo es la meta: «setter_directo» (tus ventas chicas) o ' +
    '«setter_diferido» (lo que cobrás sobre las ventas del closer en tus leads).',
  meta_invalida:
    'La meta tiene que ser un monto mayor que cero, o `null` para quitarla. Una meta de cero no ' +
    'significa nada y la base no la acepta.',
  otra_empresa:
    'Estás mirando otra empresa. La meta es tuya y va en la tuya: acá no hay ninguna comisión ' +
    'tuya que configurar.',
};

export async function PATCH(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['setter.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  if (contexto.mirandoOtraOrganizacion) {
    return rechazo('peticion_invalida', MOTIVOS['otra_empresa']);
  }

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return rechazo('peticion_invalida', MOTIVOS['cuerpo_invalido']);
  }
  const c = cuerpo as { meta?: unknown; tramo?: unknown } | null;
  if (!c) return rechazo('peticion_invalida', MOTIVOS['cuerpo_invalido']);

  /* El tramo, contra la lista. Se compara con `includes` sobre la lista declarada y no con un
     `startsWith('setter')`: con eso, un `setter_lo_que_sea` pasaría la validación y llegaría al
     `check` de la base. */
  const tramo = TRAMOS.find((t) => t === c.tramo);
  if (tramo === undefined) return rechazo('peticion_invalida', MOTIVOS['tramo_invalido']);

  /* `Object.hasOwn` y no `c.meta !== undefined`, y hay que decir exactamente cuánto vale esa
     elección: **sobre JSON las dos formas se comportan igual**. `JSON.parse` no produce claves con
     valor `undefined`, así que «vino en `null`» y «no vino» ya se distinguen con cualquiera de las
     dos, y una mutación de una a la otra **sobrevive** — medido, no supuesto.

     Se escribe así igual porque dice la intención —la pregunta es si la clave ESTÁ, no qué vale— y
     porque deja de ser equivalente el día que este cuerpo no venga de `JSON.parse`. Lo que no hay
     acá es una guarda: es una forma de escribir. */
  if (!Object.hasOwn(c, 'meta')) {
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

  const comision = await conOrganizacion(contexto.orgEfectiva, async () => {
    await datos()
      .insertInto('comisiones')
      .values({
        usuario_id: contexto.usuarioId,
        tipo: tramo,
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

    /* Se devuelven LOS DOS tramos y no solo el que se tocó. Cuesta una consulta más y evita que la
       pantalla tenga que fusionar la respuesta con lo que ya tenía: con un solo tramo de vuelta,
       cualquier error de fusión deja el otro anillo mostrando un número viejo, y un número viejo en
       un tablero de sueldos no se distingue de uno actual. */
    return comisionDelSetter(contexto.usuarioId, contexto.organizacion.zonaHoraria);
  });

  return ok({ comision });
}
