// Los DOS TRAMOS de la comisión del setter, y el segundo no se parece a nada del closer.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL SETTER COBRA POR DOS HECHOS DISTINTOS
//
//   · **Directo** — sus ventas chicas. Las cerró él, y la base es la misma forma que la del closer:
//     `resultados.registrado_por = él`.
//   · **Diferido** — el tramo sobre las ventas GRANDES que cerró el closer **sobre leads que él
//     originó**. Acá `registrado_por` es de otra persona, así que esa base no sirve: la atribución
//     sale de `contactos.sello_setter_id`.
//
// Un porcentaje único para los dos obligaría a elegir cuál de los dos negocios es el verdadero. La
// migración 025 abrió los dos tramos en `negocio.comisiones`, y la clave primaria
// `(org_id, usuario_id, tipo)` los deja convivir sin tabla nueva.
//
// ── EL SUJETO ES QUIEN MIRA, Y NO UN DESIGNADO ──────────────────────────────
//
// Y ahí está la diferencia estructural con el Inicio del closer. El closer es un **puesto
// designado**: `negocio.closer_asignado` tiene `org_id` como clave primaria entera, así que hay uno
// por empresa y el cockpit tiene un sujeto único para todos los que abren la pantalla.
//
// El setter es **multi-persona por construcción** — el disparador del sello existe justamente porque
// *«el segundo setter no le roba la atribución al primero»*. Así que no hay a quién designar, y no
// hace falta tabla: **el sujeto es quien mira**, y su atribución es el sello.
//
// ── EL MES ES EL DE LA VENTA, NO EL DEL SELLO ───────────────────────────────
//
// El tramo diferido se paga **cuando entra la plata**, así que se cuenta en el mes de la venta del
// closer y no en el mes en que el setter trabajó el lead. La consecuencia está aceptada y conviene
// escribirla: un setter puede cobrar en julio por un lead que trabajó en marzo, y **sigue generando
// comisión después de irse de la empresa**. Es lo que quiere decir «diferido».
//
// Por eso el conteo de leads atribuidos NO se filtra por mes: un sello de marzo es exactamente lo
// que hace que la venta de julio pague.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { armarTramo, type ComisionDelMes } from './comision.ts';

/** Sus ventas chicas. Las cobró él de punta a punta. */
export const TIPO_SETTER_DIRECTO = 'setter_directo';
/** El tramo sobre las ventas del closer en leads que él originó. */
export const TIPO_SETTER_DIFERIDO = 'setter_diferido';

export interface ComisionDelSetter {
  directo: ComisionDelMes;
  diferido: ComisionDelMes;
  /**
   * Cuántos leads tiene atribuidos por el sello. **En total, no del mes** — ver el encabezado.
   *
   * Viaja para que la pantalla pueda decir por qué el tramo diferido vale cero: *«0 sobre tus 12
   * leads»* es un cero explicado, y `$0` a secas se lee como «no trabajaste». Es un conteo medido:
   * cero acá significa que todavía no originó ninguno.
   */
  leadsAtribuidos: number;
}

/**
 * Los dos tramos del mes de UNA persona. **Corre dentro de `conOrganizacion(`.**
 *
 * @param usuarioId De quién. Sin valor por omisión, por lo mismo que en `comisionDelMes`: un valor
 *   por omisión acá sería el identificador de una persona real firmando los números de otra.
 * @param zonaHoraria La de la ORGANIZACIÓN. El mes de un setter en Lima no empieza cuando empieza el
 *   del servidor.
 */
export async function comisionDelSetter(
  usuarioId: string,
  zonaHoraria: string,
): Promise<ComisionDelSetter> {
  const desdeElPrimero = sql<Date>`date_trunc('month', timezone(${zonaHoraria}, now())) at time zone ${zonaHoraria}`;

  /* Las dos configuraciones en UNA consulta. Son dos filas de la misma tabla con la misma clave
     menos el `tipo`, así que dos viajes serían dos veces el mismo índice. */
  const filas = await datos()
    .selectFrom('comisiones')
    .select(['tipo', 'porcentaje', 'meta_mensual'])
    .where('usuario_id', '=', usuarioId)
    .where('tipo', 'in', [TIPO_SETTER_DIRECTO, TIPO_SETTER_DIFERIDO])
    .execute();

  const config = (tipo: string) => {
    const f = filas.find((x) => x.tipo === tipo);
    return {
      /* `null` = **nadie lo cargó**, y no cero. Se comprueba contra `undefined` Y contra `null`
         porque son dos ausencias distintas —sin fila, y con fila sin porcentaje— que dan el mismo
         resultado; un `?? 0` acá las convertiría a las dos en «cobra cero». */
      porcentaje: f?.porcentaje === null || f?.porcentaje === undefined ? null : Number(f.porcentaje),
      meta: f?.meta_mensual === null || f?.meta_mensual === undefined ? null : Number(f.meta_mensual),
    };
  };

  // ── TRAMO DIRECTO ─────────────────────────────────────────────────────────
  //
  // Misma forma que el del closer, con `venta_chica` en lugar de `venta`. El `where registrado_por`
  // es de la clase que este repositorio llama «el único lugar donde olvidarse un `where` devuelve
  // filas ajenas sin ningún error»: la política de RLS aísla por ORGANIZACIÓN, no por persona, así
  // que sin esa línea la consulta trae las ventas chicas de todos los compañeros y el número sale
  // más alto — plausible y falso.
  const propio = await datos()
    .selectFrom('resultados')
    .where('creado_el', '>=', desdeElPrimero)
    .where('registrado_por', '=', usuarioId)
    .select(({ fn, eb }) => [
      fn
        .sum<string | null>(
          eb.case().when('salida', '=', 'venta_chica').then(eb.ref('monto')).else(null).end(),
        )
        .as('base'),
      fn.countAll<string>().filterWhere('salida', '=', 'venta_chica').as('ventas'),
      /* El testigo de «hubo datos», y también filtrado por persona. Cuenta CUALQUIER resultado, no
         solo las ventas chicas: un setter con cuarenta agendas y ninguna venta chica tiene un cero
         MEDIDO, y decirle «no registraste nada» sería falso. */
      fn.countAll<string>().as('total'),
    ])
    .executeTakeFirst();

  const huboResultadosPropios = Number(propio?.total ?? 0) > 0;

  const directo = armarTramo({
    ...config(TIPO_SETTER_DIRECTO),
    base: huboResultadosPropios ? Number(propio?.base ?? 0) : null,
    ventas: huboResultadosPropios ? Number(propio?.ventas ?? 0) : null,
    /* ── EL DESTINO QUE ESTE TEXTO NOMBRABA NO EXISTE, Y NO PUEDE EXISTIR ───
     *
     * Decía «en Ajustes → Comisiones». Medido: `pruebas/codigo/105-comisiones.test.ts` afirma que
     * Ajustes tiene **exactamente tres** pestañas y que **ninguna es Comisiones** — se decidió a
     * propósito y hay una prueba que lo defiende. O sea que el texto mandaba a un lugar que el propio
     * repositorio se prohíbe tener.
     *
     * Ahora nombra dónde está de verdad: **al final de esta misma pantalla**, en el panel que solo ve
     * quien administra. Y no es un enlace, a propósito: este texto lo lee el setter, y el panel solo
     * lo ve quien administra. Un enlace a una pantalla a la que no tenés acceso es peor que un texto.
     *
     * La palabra «administra» tiene que quedar: `pruebas/base/98-setter-inicio` la exige, porque es lo
     * que impide que el texto le diga a esta persona que vaya a cargar algo que no puede cargar. */
    sinPorcentaje:
      'Nadie cargó tu porcentaje sobre ventas chicas todavía. Lo fija quien administra la empresa, ' +
      'al final de esta pantalla.',
    sinBase: 'Todavía no registraste ningún resultado este mes. La comisión sale de Avanzar.',
  });

  // ── TRAMO DIFERIDO ────────────────────────────────────────────────────────
  //
  // ── EL TESTIGO ES OTRO, Y ES LA DECISIÓN QUE HACE HONESTO ESTE TRAMO ──────
  //
  // Acá **no se puede usar `huboResultadosPropios`**: cuenta lo que esta persona registró, y las
  // ventas de este tramo las registró el closer. Con ese testigo, un setter con cuarenta agendas y
  // ningún resultado propio vería *«no registraste nada»* cuando la verdad es «tu closer todavía no
  // vendió sobre tus leads» — y peor al revés: uno que registró un `nurture` vería `$0` como cero
  // medido sin tener un solo lead atribuido.
  //
  // El testigo correcto es **si tiene leads atribuidos**, y por eso es su propia consulta: si el
  // conteo saliera de la misma consulta que la suma, cero filas no distinguiría «no tengo leads» de
  // «tengo leads y este mes no se vendió», que son los dos hechos que hay que separar.
  const atribuidos = await datos()
    .selectFrom('contactos')
    .where('sello_setter_id', '=', usuarioId)
    .select(({ fn }) => fn.countAll<string>().as('leads'))
    .executeTakeFirst();

  const leadsAtribuidos = Number(atribuidos?.leads ?? 0);

  /* ── LA SUMA, SOLO SI HAY A QUIÉN ATRIBUIRLE ──────────────────────────────
   *
   * Sin ningún lead atribuido la consulta no se hace: no hay nada que sumar y el testigo ya
   * respondió. Es una consulta menos por cada setter nuevo que abre la pantalla.
   *
   * Y va con `innerJoin`, no con dos consultas y una lista de identificadores. El plan de esta obra
   * decía que no había relación declarada y estaba equivocado: la migración 011 sí la declara
   * —`foreign key (org_id, contacto_id) references negocio.contactos`— y `lib/negocio/agenda.ts` ya
   * une por ahí. Con una lista de identificadores habría además un tope que truncaría en silencio a
   * un setter con muchos leads. */
  const delCloser =
    leadsAtribuidos === 0
      ? undefined
      : await datos()
          .selectFrom('resultados as r')
          .innerJoin('contactos as k', 'k.id', 'r.contacto_id')
          .where('r.creado_el', '>=', desdeElPrimero)
          /* La venta GRANDE. No se filtra por `r.rol` ni por `r.registrado_por`, y las dos ausencias
             son a propósito: `venta` es una salida del closer y de nadie más, y **quién la registró
             es justamente lo que este tramo no mira** — su base es el sello, no el autor. */
          .where('r.salida', '=', 'venta')
          .where('k.sello_setter_id', '=', usuarioId)
          .select(({ fn }) => [
            fn.sum<string | null>('r.monto').as('base'),
            fn.countAll<string>().as('ventas'),
          ])
          .executeTakeFirst();

  const diferido = armarTramo({
    ...config(TIPO_SETTER_DIFERIDO),
    /* Con leads atribuidos, la base está MEDIDA aunque sea cero: es «este mes no se vendió sobre mis
       leads», un hecho. Sin leads, es `null`: no hay nada que medir. */
    base: leadsAtribuidos === 0 ? null : Number(delCloser?.base ?? 0),
    ventas: leadsAtribuidos === 0 ? null : Number(delCloser?.ventas ?? 0),
    sinPorcentaje:
      'Nadie cargó tu porcentaje diferido todavía. Es el que se paga sobre las ventas que cierra el ' +
      'closer en los leads que originaste, y lo fija quien administra la empresa al final de esta ' +
      'pantalla.',
    sinBase:
      'Todavía no hay ningún lead atribuido a vos. El sello se pone solo, cuando trabajás un ' +
      'contacto: al registrar un resultado o al responder un mensaje.',
  });

  return { directo, diferido, leadsAtribuidos };
}
