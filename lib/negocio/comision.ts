// La comisión del mes de UNA persona, y su meta.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LAS DOS MITADES SON DEL MISMO DUEÑO, Y ES TODO EL DISEÑO
//
// El porcentaje es de la persona y la base también. La alternativa —el porcentaje personal por el
// «cobrado» que el cockpit ya calcula— es correcta con un closer y **falsa desde el segundo**,
// porque ese cobrado es de toda la organización. Y no falla: da un número plausible y más alto.
//
// El cockpit NO se toca: su `cobrado` sigue siendo de la empresa y ya está rotulado así. La comisión
// trae **su propia base**, con su propio testigo de «hubo datos». Dos números, dos rótulos, los dos
// honestos.
//
// ── LOS CUATRO ESTADOS DEL NÚMERO, Y NINGUNO SE COLAPSA ─────────────────────
//
// Es el `11` § 9 regla 1 aplicado a un número que decide cuánto cobra una persona:
//
//   1 · **Sin porcentaje cargado** → `null` con motivo. Nadie lo configuró.
//   2 · **Porcentaje en 0 a propósito** → `0`. Un cero MEDIDO. Colapsarlo con (1) sería afirmar que
//       nadie lo configuró cuando alguien decidió que es cero.
//   3 · **Sin ningún resultado propio este mes** → `null` con motivo. La base no está medida, y el
//       testigo tiene que ser el conteo FILTRADO POR PERSONA: el total de la organización diría que
//       hubo datos cuando esta persona no registró nada.
//   4 · **Con resultados propios y sin ventas** → `0`. Otro cero medido, y distinto del (3).
//
// Un `?? 0` en cualquier punto de la cadena —la tabla, el endpoint, esta función, la pantalla—
// convierte (1) y (3) en (2) y (4). Y `Number(null)` es `0`, así que ni el tipo ni el motor avisan.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';

/** Hoy hay un solo tramo. Ver el encabezado de la migración 015. */
export const TIPO_CLOSER = 'closer';

export interface ComisionDelMes {
  /**
   * El porcentaje configurado. `null` = **nadie lo cargó**, que no es lo mismo que cero.
   *
   * Lo fija quien administra la empresa, no la persona. Por eso el texto de la pantalla no dice
   * «cargá tu porcentaje»: decirle a alguien que cargue algo que no puede cargar es peor que no
   * decir nada.
   */
  porcentaje: number | null;
  /** La meta del mes, que sí la fija la propia persona. `null` = sin meta. Nunca cero: lo prohíbe la base. */
  meta: number | null;
  /**
   * La comisión estimada. `null` cuando falta CUALQUIERA de las dos mitades —el porcentaje o la
   * base—, y con `falta` diciendo cuál de las dos.
   */
  valor: number | null;
  falta?: string;
  /** Las ventas propias del mes, para poder estimar cuántas faltan. `null` si la base no está medida. */
  ventas: number | null;
  /** La base sobre la que se calculó: la suma de las ventas que esta persona registró. */
  base: number | null;
  /**
   * Cuánto falta para la meta. Negativo o cero = superada.
   *
   * `null` cuando no hay meta o no hay comisión: sin las dos mitades, «faltan $X» es un número
   * inventado.
   */
  faltaParaLaMeta: number | null;
  /**
   * `true` solo con las TRES condiciones. Ver el comentario de la función.
   */
  metaSuperada: boolean;
}

/**
 * La comisión del mes de una persona. **Corre dentro de `conOrganizacion(`.**
 *
 * @param usuarioId De quién. Se pasa siempre y no tiene valor por omisión: un valor por omisión acá
 *   sería el identificador de una persona real firmando los números de otra — el defecto que
 *   `auditarAdministracion` documenta en su encabezado.
 * @param zonaHoraria La de la ORGANIZACIÓN, igual que el cockpit: el mes de un closer en Lima no
 *   empieza cuando empieza el del servidor.
 */
export async function comisionDelMes(
  usuarioId: string,
  zonaHoraria: string,
): Promise<ComisionDelMes> {
  const desdeElPrimero = sql<Date>`date_trunc('month', timezone(${zonaHoraria}, now())) at time zone ${zonaHoraria}`;

  const config = await datos()
    .selectFrom('comisiones')
    .select(['porcentaje', 'meta_mensual'])
    .where('usuario_id', '=', usuarioId)
    .where('tipo', '=', TIPO_CLOSER)
    .executeTakeFirst();

  /* ── LA BASE, FILTRADA POR PERSONA ─────────────────────────────────────────
   *
   * `where registrado_por = usuarioId` es la línea que hace honesto todo el resto, y es de la clase
   * que este repositorio llama «el único lugar donde olvidarse un `where` devuelve filas ajenas sin
   * ningún error»: la política de RLS aísla por ORGANIZACIÓN, no por persona, así que sin esta línea
   * la consulta devuelve las ventas de todos los compañeros y el número sale más alto.
   *
   * `total` es el testigo de «hubo datos», y también filtrado: el total de la organización diría que
   * hubo resultados cuando esta persona no registró ninguno.
   */
  const r = await datos()
    .selectFrom('resultados')
    .where('creado_el', '>=', desdeElPrimero)
    .where('registrado_por', '=', usuarioId)
    .select(({ fn, eb }) => [
      fn
        .sum<string | null>(
          eb.case().when('salida', '=', 'venta').then(eb.ref('monto')).else(null).end(),
        )
        .as('base'),
      fn.countAll<string>().filterWhere('salida', '=', 'venta').as('ventas'),
      fn.countAll<string>().as('total'),
    ])
    .executeTakeFirst();

  const porcentaje = config?.porcentaje === null || config?.porcentaje === undefined
    ? null
    : Number(config.porcentaje);
  const meta = config?.meta_mensual === null || config?.meta_mensual === undefined
    ? null
    : Number(config.meta_mensual);

  const huboResultadosPropios = Number(r?.total ?? 0) > 0;
  const base = huboResultadosPropios ? Number(r?.base ?? 0) : null;
  const ventas = huboResultadosPropios ? Number(r?.ventas ?? 0) : null;

  // ── LOS DOS MOTIVOS DE AUSENCIA, SEPARADOS ────────────────────────────────
  //
  // Se comprueban en este orden porque el primero es el que la persona no puede resolver sola, y
  // decirle «no registraste ventas» a quien no tiene porcentaje cargado lo manda a trabajar para que
  // el número siga sin aparecer.
  if (porcentaje === null) {
    return {
      porcentaje: null,
      meta,
      valor: null,
      falta:
        'Nadie cargó tu porcentaje de comisión todavía. Lo fija quien administra la empresa, en ' +
        'Ajustes → Comisiones.',
      ventas,
      base,
      faltaParaLaMeta: null,
      metaSuperada: false,
    };
  }
  if (base === null) {
    return {
      porcentaje,
      meta,
      valor: null,
      falta: 'Todavía no registraste ningún resultado este mes. La comisión sale de Avanzar.',
      ventas,
      base,
      faltaParaLaMeta: null,
      metaSuperada: false,
    };
  }

  // Acá los dos están medidos, así que el cero es un cero de verdad.
  const valor = redondearACentavos((base * porcentaje) / 100);
  const faltaParaLaMeta = meta === null ? null : redondearACentavos(meta - valor);

  return {
    porcentaje,
    meta,
    valor,
    ventas,
    base,
    faltaParaLaMeta,
    /* ── «META SUPERADA» PIDE LAS TRES CONDICIONES, Y DOS SON INALCANZABLES HOY ──
     *
     * La implementación de referencia felicita con `falta <= 0 && comision > 0` y **no mira la
     * meta**, así que con la meta en 0 dibuja el anillo vacío y el cartel de felicitación a la vez.
     *
     * Acá la meta en cero la impide la base, y eso tiene una consecuencia que conviene dejar escrita
     * porque una prueba de mutación la demostró: **con `meta > 0` garantizado, `valor > 0` no puede
     * cambiar el resultado**. Si `valor` es 0 entonces `falta = meta - 0 = meta > 0`, así que la
     * última condición ya es falsa. Quitar `valor > 0` no rompe ninguna prueba, y no porque falte una
     * prueba: porque el estado no existe.
     *
     * Se escriben igual las tres, y el motivo es concreto y no estético: **el día que alguien relaje
     * el `check (meta_mensual > 0)` de la migración 015, esta línea pasa a ser la única defensa** —
     * y quien lo relaje va a estar mirando el SQL, no este archivo. Que las tres condiciones estén
     * acá con esta explicación es lo que hace que ese cambio no felicite en silencio a quien no
     * vendió nada.
     */
    metaSuperada: meta !== null && meta > 0 && valor > 0 && faltaParaLaMeta !== null && faltaParaLaMeta <= 0,
  };
}

/**
 * Dos decimales, y sin `toFixed`.
 *
 * Un porcentaje sobre un monto da colas binarias —`1234.56 * 7 / 100` no es exacto— y arrastrarlas
 * hace que la pantalla muestre `86.4192000000001`. Se redondea a centavos porque es plata.
 */
function redondearACentavos(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Una fila del panel de administración: la persona y su porcentaje, sin su meta. */
export interface PorcentajeDeUnaPersona {
  usuarioId: string;
  nombre: string;
  email: string | null;
  /** `null` = sin configurar. **Nunca 0 por omisión.** */
  porcentaje: number | null;
  actualizadoEl: Date | null;
}

/**
 * Los porcentajes de la empresa, para el panel de administración. **Corre dentro de `conOrganizacion(`.**
 *
 * ── SE LISTAN LOS USUARIOS ACTIVOS, NO LOS QUE TIENEN FILA ──────────────────
 *
 * Al revés, el panel arrancaría vacío y no habría forma de cargarle el porcentaje a nadie: la fila
 * se crea al guardar. Y tampoco se filtra por rol: en producción los roles ya cambiaron una vez
 * —`closer` y `setter` se retiraron— así que filtrar por rol devolvería una tabla vacía sin ningún
 * error. El tramo es un dato de la fila de comisión, no una deducción del rol.
 *
 * El `join` con `identidad.usuarios` se hace desde el cliente del INQUILINO, y se puede: tiene
 * `select` sobre las cuatro columnas que hacen falta y su política filtra por `app.org_id`. O sea que
 * el filtro por empresa lo pone la política, no un `where` escrito a mano.
 */
export async function porcentajesDeLaEmpresa(): Promise<PorcentajeDeUnaPersona[]> {
  const filas = await datos()
    .selectFrom('usuarios as u')
    .leftJoin('comisiones as c', (j) =>
      j.onRef('c.usuario_id', '=', 'u.id').on('c.tipo', '=', TIPO_CLOSER),
    )
    .where('u.activo', '=', true)
    .select(['u.id', 'u.nombre', 'u.email', 'c.porcentaje', 'c.actualizado_el'])
    .orderBy('u.nombre', 'asc')
    .execute();

  return filas.map((f) => ({
    usuarioId: f.id,
    nombre: f.nombre,
    email: f.email,
    // `null` se conserva como `null`. Un `?? 0` acá haría que el panel mostrara «0 %» para todos los
    // que nadie configuró — y alguien lo leería como una decisión tomada.
    porcentaje: f.porcentaje === null || f.porcentaje === undefined ? null : Number(f.porcentaje),
    actualizadoEl: f.actualizado_el ?? null,
  }));
}
