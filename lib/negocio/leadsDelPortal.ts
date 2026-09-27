// La cohorte de Leads Portal: una fila por persona, y las cinco tarjetas contadas sobre esas filas.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA ÚNICA PANTALLA QUE CUENTA PERSONAS Y, EN LA MISMA RESPUESTA, DICE CUÁLES
//
// Las demás publican conteos. Ésta publica el conteo **y la lista** que lo produce: «ICP alto 51» y,
// debajo, las 51 tarjetas. Si las dos cosas salieran de dos consultas, un barrido que entra entre una
// y otra deja la tarjeta diciendo 51 sobre una rejilla de 52, y ninguna de las dos está mal.
//
// Por eso es **una sola sentencia**: una CTE arma una fila por persona —con su tramo, su cita, su
// asistencia y su venta ya decididos— y de esa misma CTE salen la lista y el resumen. El resumen
// agrupa por la columna `tramo` de la CTE: no vuelve a clasificar a nadie, así que la tarjeta y la
// fila no pueden discrepar sobre dónde cae una persona.
//
// ── LOS PREDICADOS NO SON DE ESTA PANTALLA ──────────────────────────────────
//
// «Agendó» es `tieneCitaAlcanzable`, «descartado» es `contactoDescartado`, «la cita ya debería haber
// ocurrido» es `citaCerrable`, el plantón es `marcadaComoPlanton` y la venta es `tieneVenta`. Todos
// vienen de donde ya los usan Sales, Creative y Conversion. Lo único propio es el tramo, que es una
// clasificación y no un hecho (`tramosDelIcp.ts`).
//
// ── LA VENTANA ──────────────────────────────────────────────────────────────
//
// `alta_en_el_crm >= now() - make_interval(days => N)`: el alta y no `creado_el`, que es cuándo lo
// vio nuestro barrido y en la carga inicial es la misma marca para cientos; de cualquier territorio,
// porque el territorio es consecuencia de agendar; y móvil, como la cadena de Sales, porque nada acá
// es una columna `date`. Es el mismo predicado de cohorte que `cadenaDeCierre.ts`, y la prueba de la
// ruta compara las dos.
// ═══════════════════════════════════════════════════════════════════════════════

import { type RawBuilder, sql } from 'kysely';

import { datos } from '../datos/contexto.ts';
import type { CadenaDeCierre } from './cadenaDeCierre.ts';
import {
  citaCerrable,
  contactoDescartado,
  marcadaComoPlanton,
  tieneCitaAlcanzable,
} from './citasAlcanzables.ts';
import { DIAS_DE_LA_TASA, PISO_DE_UNA_TASA } from './indicadoresDeCitas.ts';
import { avisoDeLaCola } from './periodo.ts';
import { type ClaveDeTramo, ROTULO_DE_TODOS, TRAMOS, UMBRAL_ALTO, UMBRAL_MEDIO } from './tramosDelIcp.ts';
import { hayVentasRegistradas, montoReportado, tieneVenta, ventasSinMonto } from './ventasDelContacto.ts';

/**
 * Cuántas filas viajan como mucho.
 *
 * La cohorte viaja ENTERA porque los filtros y la búsqueda corren en el navegador, y filtrar ahí sólo
 * es honesto si ahí está todo (`buscarLead.ts` dice por qué). Medido el 2026-09-27: 286 a 30 días y
 * 569 en «Completo». Cinco mil es el mismo tope que el Pipeline (`TOPE_SIN_PAGINAR` en `fila.ts`), y
 * hoy no se alcanza; si se alcanza, `truncado` lo dice y las tarjetas siguen contando a todos.
 */
export const TOPE_DE_LA_COHORTE = 5000;

/**
 * Desde hace cuántos días un puntaje 0 cuenta como «reciente» para el guardián.
 *
 * Catorce porque es lo que se midió: los 47 ceros son de altas del 21 de agosto al 3 de septiembre y
 * ninguno de los últimos 14 días (2026-09-27). Un 0 adentro de esta ventana es algo nuevo.
 */
export const DIAS_DE_LOS_CEROS_RECIENTES = 14;

/**
 * Si la persona llegó a tener cita.
 *
 * `agendo` es `tieneCitaAlcanzable`, cancelada incluida. `solo_congeladas` es que tuvo citas y todas
 * dejaron de refrescarse: agendó, pero no cuenta en «Agendados» porque ya no se sabe en qué quedó.
 */
export type EstadoDeCita = 'agendo' | 'solo_congeladas' | 'sin_cita';

/**
 * Lo que se registró de su asistencia. **`null` no es «no»: es que no había nada que registrar** —sin
 * cita, sólo futuras, sólo canceladas o sólo congeladas—.
 *
 * El orden importa y es éste: un `true` en cualquier cita gana, después un `false`, y sólo sin
 * ninguno de los dos se mira si hubo una cita que ya debería haber ocurrido.
 */
export type Asistencia = 'asistio' | 'no_asistio' | 'sin_registrar';

/** Una persona de la cohorte. **Exactamente estas claves**: ver `CLAVES_DE_LA_FILA`. */
export interface LeadDelPortal {
  id: string;
  nombre: string;
  /** El alta en el CRM, en ISO. Es la clave del orden y de la ventana. */
  altaEl: string;
  /** `campaign` del primer toque, o `null`. Nunca se inventa un origen. */
  campana: string | null;
  /** `utmContent` del primer toque: la llave de pieza que usa Creative. */
  creativo: string | null;
  /** El número del CRM, **0 incluido**. El tramo dice cómo se lee. */
  puntaje: number | null;
  tramo: ClaveDeTramo;
  territorio: 'closer' | 'setter' | 'congelado';
  descartado: boolean;
  cita: EstadoDeCita;
  asistencia: Asistencia | null;
  /** El calendario la marcó como plantón. Va aparte y nunca se suma con `asistencia`. */
  planton: boolean;
  vendio: boolean;
  /** Lo que el closer reportó por sus ventas; `null` sin venta o con ventas sin monto. */
  monto: number | null;
}

/**
 * Las claves de cada fila, en una lista para que la prueba compare **exactamente** contra ella.
 *
 * Ni teléfono, ni correo, ni la atribución cruda, ni los campos del CRM, ni las etiquetas: la lista
 * no los manda al navegador. El usuario decidió el 2026-09-26 que teléfono y correo van sólo en la
 * ficha, y la atribución cruda puede llevar el identificador de una persona dentro de una URL.
 * «Exactamente» y no «no contiene X»: una clave nueva tiene que poner la prueba en rojo aunque hoy
 * no esté prohibida, para que alguien decida si viaja.
 */
export const CLAVES_DE_LA_FILA = [
  'id',
  'nombre',
  'altaEl',
  'campana',
  'creativo',
  'puntaje',
  'tramo',
  'territorio',
  'descartado',
  'cita',
  'asistencia',
  'planton',
  'vendio',
  'monto',
] as const satisfies readonly (keyof LeadDelPortal)[];

export type PorQueSinCierre = 'sin_ventas_registradas' | 'bajo_el_piso';
export type PorQueSinMonto = 'sin_ventas_registradas' | 'ventas_sin_monto';

/** Una tarjeta: un tramo, o «Todos». */
export interface ResumenDeTramo {
  clave: ClaveDeTramo | 'todos';
  rotulo: string;
  contactos: number;
  /** De la cohorte, de 0 a 1. `null` con la cohorte vacía: un «0 %» afirmaría algo. */
  porcion: number | null;
  agendados: number;
  asistieron: number;
  vendidos: number;
  /** Vendidos sobre contactos del tramo. Ver `cierreDe` para cuándo es `null`. */
  cierre: number | null;
  porQueSinCierre: PorQueSinCierre | null;
  montoReportado: number | null;
  porQueSinMonto: PorQueSinMonto | null;
  /** Ventas del tramo sin monto cargado. El monto suma las otras. */
  ventasSinMonto: number;
  /** Personas con una cita que ya debería haber ocurrido y sin asistencia registrada. */
  sinRegistrar: number;
  /** Personas que agendaron y sólo les quedan citas congeladas. No están en `agendados`. */
  soloCongeladas: number;
}

export interface LeadsDelPortal {
  dias: number;
  cohorte: {
    /** Contactos con alta en la ventana, contados SIN el tope. */
    total: number;
    /** El alta más vieja y la más nueva que la ventana alcanzó, no los bordes de la ventana. */
    desde: string | null;
    hasta: string | null;
    /** El alta más nueva de toda la empresa, sin ventana: con la cohorte vacía, dice cuándo entró el último. */
    ultimaAlta: string | null;
    /** Contactos de la empresa sin alta: no entran en ninguna ventana, ni en «Completo». */
    sinAlta: number;
    /** Contactos de la empresa, con y sin alta. */
    universo: number;
    /** `avisoDeLaCola`: cuando `desde` es un caso suelto y el grueso llegó mucho después. */
    avisoDeLaVentana: string | null;
  };
  /** Los cuatro tramos, en el orden de `TRAMOS`, aunque alguno esté vacío. */
  tramos: ResumenDeTramo[];
  /** La suma de los cuatro. No se cuenta aparte: si no da, se ve. */
  todos: ResumenDeTramo;
  sinCalificar: {
    /** De la cohorte, sin puntaje. */
    sinPuntaje: number;
    /** De la cohorte, con el puntaje en 0. Con `sinPuntaje` suma el tramo, siempre. */
    enCero: number;
    /** De la EMPRESA, con 0 y alta en los últimos 14 días, sin la ventana. El guardián. */
    cerosRecientes: number;
  };
  /** Si la empresa tiene alguna venta registrada, en toda la base. */
  hayVentasRegistradas: boolean;
  piso: number;
  leads: LeadDelPortal[];
  /** La cohorte tenía más filas que `TOPE_DE_LA_COHORTE`. Las tarjetas cuentan a todas igual. */
  truncado: boolean;
  aviso: string | null;
}

/** Lo que el resumen de la sentencia trae por tramo, antes de armar la tarjeta. */
interface ConteoDeTramo {
  tramo: ClaveDeTramo;
  contactos: number;
  agendados: number;
  asistieron: number;
  vendidos: number;
  monto: number | null;
  ventas_sin_monto: number;
  sin_registrar: number;
  solo_congeladas: number;
}

interface FilaDeLaSentencia {
  total: number;
  leads: (Omit<LeadDelPortal, 'monto'> & { monto: number | string | null })[];
  tramos: ConteoDeTramo[];
  sin_puntaje: number;
  en_cero: number;
  desde: Date | null;
  hasta: Date | null;
  mitad: Date | null;
  proporcion: string | number | null;
  ceros_recientes: number;
  universo: number;
  sin_alta: number;
  ultima_alta: Date | null;
  hay_ventas: boolean;
}

/** Existe una cita de la persona `alias` y, si se pide, que cumpla `y`. */
function unaCitaDe(alias: string, y: RawBuilder<boolean> | null = null): RawBuilder<boolean> {
  const a = sql.raw(alias);
  const deLaPersona = sql<boolean>`ci.org_id = ${a}.org_id and ci.contacto_id = ${a}.id`;
  return y === null
    ? sql<boolean>`exists (select 1 from negocio.citas ci where ${deLaPersona})`
    : sql<boolean>`exists (select 1 from negocio.citas ci where ${deLaPersona} and ${y})`;
}

/**
 * **Si la persona agendó**, con los tres valores de `EstadoDeCita`.
 *
 * Exportada porque la ficha dice lo mismo que la fila: si el estado de la cita se calculara dos
 * veces, la tarjeta podría decir «agendó» y la ficha «sólo congeladas» de la misma persona.
 *
 * @param alias El nombre con el que la consulta llama a la tabla `contactos`.
 */
export function estadoDeCita(alias: string): RawBuilder<EstadoDeCita> {
  return sql<EstadoDeCita>`(case when ${tieneCitaAlcanzable(alias)} then 'agendo'
                  when ${unaCitaDe(alias)} then 'solo_congeladas'
                  else 'sin_cita' end)`;
}

/**
 * **Lo que se registró de su asistencia**, o `null` si no había nada que registrar.
 *
 * `asistio` lo escribe Avanzar, no el CRM: congelarse no lo vuelve viejo, así que se lee de
 * cualquier cita. `sin_registrar`, en cambio, exige una cita cerrable, que es la única sobre la que
 * alguien pudo haber registrado algo. Exportada por lo mismo que `estadoDeCita`.
 */
export function asistenciaDe(alias: string): RawBuilder<Asistencia | null> {
  return sql<Asistencia | null>`(case when ${unaCitaDe(alias, sql<boolean>`ci.asistio is true`)} then 'asistio'
                  when ${unaCitaDe(alias, sql<boolean>`ci.asistio is false`)} then 'no_asistio'
                  when ${unaCitaDe(alias, citaCerrable('ci'))} then 'sin_registrar' end)`;
}

/** **El calendario marcó alguna de sus citas como plantón.** Nunca se suma con `asistenciaDe`. */
export function plantonDe(alias: string): RawBuilder<boolean> {
  return unaCitaDe(alias, marcadaComoPlanton('ci'));
}

/**
 * La cohorte de la ventana, con sus tarjetas y su lista.
 *
 * Se corre dentro de `conOrganizacion(`: ninguna subconsulta filtra por empresa a mano, lo hace la
 * política de cada tabla.
 */
export async function leadsDelPortal(
  dias = DIAS_DE_LA_TASA,
  tope = TOPE_DE_LA_COHORTE,
): Promise<LeadsDelPortal> {
  const { rows } = await sql<FilaDeLaSentencia>`
    with filas as (
      select c.id,
             c.nombre,
             c.alta_en_el_crm as alta_el,
             nullif(btrim(c.atribucion_primera ->> 'campaign'), '') as campana,
             nullif(btrim(c.atribucion_primera ->> 'utmContent'), '') as creativo,
             c.score as puntaje,
             /* El corte de \`tramoDelPuntaje\`, con SUS constantes como parámetros. La forma se repite
                acá porque la base no puede llamar a una función de TypeScript; la prueba de la base
                pasa cada borde por las dos y exige que coincidan. */
             case when c.score is null or c.score = 0 then 'sin_calificar'
                  when c.score >= ${UMBRAL_ALTO} then 'alto'
                  when c.score >= ${UMBRAL_MEDIO} then 'medio'
                  else 'bajo' end as tramo,
             coalesce(c.territorio, 'congelado') as territorio,
             ${contactoDescartado('c')} as descartado,
             ${estadoDeCita('c')} as cita,
             ${asistenciaDe('c')} as asistencia,
             ${plantonDe('c')} as planton,
             ${tieneVenta('c')} as vendio,
             ${montoReportado('c')} as monto,
             ${ventasSinMonto('c')} as ventas_sin_monto
        from negocio.contactos c
       where c.alta_en_el_crm >= now() - make_interval(days => ${dias})
    )
    select
      (select count(*) from filas)::int as total,
      /* El orden es por alta y, a igualdad, por id: «Mostrar más» agrega las siguientes sin repetir
         ni saltear a nadie, y una recarga no reordena lo que ya está a la vista. */
      (select coalesce(json_agg(json_build_object(
                'id', f.id, 'nombre', f.nombre, 'altaEl', f.alta_el,
                'campana', f.campana, 'creativo', f.creativo,
                'puntaje', f.puntaje, 'tramo', f.tramo, 'territorio', f.territorio,
                'descartado', f.descartado, 'cita', f.cita, 'asistencia', f.asistencia,
                'planton', f.planton, 'vendio', f.vendio,
                'monto', case when f.vendio then f.monto end)
              order by f.alta_el desc, f.id), '[]'::json)
         from (select * from filas order by alta_el desc, id limit ${tope}) f) as leads,
      (select coalesce(json_agg(t), '[]'::json) from (
         select tramo,
                count(*)::int as contactos,
                count(*) filter (where cita = 'agendo')::int as agendados,
                count(*) filter (where asistencia = 'asistio')::int as asistieron,
                count(*) filter (where vendio)::int as vendidos,
                sum(monto) as monto,
                coalesce(sum(ventas_sin_monto), 0)::int as ventas_sin_monto,
                count(*) filter (where asistencia = 'sin_registrar')::int as sin_registrar,
                count(*) filter (where cita = 'solo_congeladas')::int as solo_congeladas
           from filas group by tramo) t) as tramos,
      (select count(*) from filas where puntaje is null)::int as sin_puntaje,
      (select count(*) from filas where puntaje = 0)::int as en_cero,
      (select min(alta_el) from filas) as desde,
      (select max(alta_el) from filas) as hasta,
      /* La mediana y la proporción, como Lead Flow: \`percentile_disc\` devuelve un alta que existe, y
         el «ahora» de la proporción es el mismo reloj que escribió las filas. */
      (select percentile_disc(0.5) within group (order by alta_el) from filas) as mitad,
      (select extract(epoch from (now() - percentile_disc(0.5) within group (order by alta_el)))
              / nullif(extract(epoch from (now() - min(alta_el))), 0) from filas) as proporcion,
      /* Lo que sigue es de la EMPRESA y va sin la ventana a propósito. */
      (select count(*) from negocio.contactos
        where score = 0
          and alta_en_el_crm >= now() - make_interval(days => ${DIAS_DE_LOS_CEROS_RECIENTES}))::int
        as ceros_recientes,
      (select count(*) from negocio.contactos)::int as universo,
      (select count(*) from negocio.contactos where alta_en_el_crm is null)::int as sin_alta,
      (select max(alta_en_el_crm) from negocio.contactos) as ultima_alta,
      ${hayVentasRegistradas()} as hay_ventas
  `.execute(datos());

  const f = rows[0]!;
  const hayVentas = Boolean(f.hay_ventas);
  const total = Number(f.total);

  const porTramo = new Map(f.tramos.map((t) => [t.tramo, t]));
  const tramos = TRAMOS.map((t) =>
    tarjeta(t.clave, t.rotulo, porTramo.get(t.clave) ?? vacio(t.clave), total, hayVentas),
  );

  /* «Todos» es la suma de las cuatro, no una cuenta aparte. Si un puntaje cayera fuera de los cuatro
     tramos, la suma daría menos que \`cohorte.total\` y la diferencia se vería. */
  const suma = (k: keyof ConteoDeTramo): number =>
    tramos.reduce((acc, t) => acc + Number(porTramo.get(t.clave as ClaveDeTramo)?.[k] ?? 0), 0);
  const montos = f.tramos.map((t) => t.monto).filter((m) => m !== null && m !== undefined);
  const todos = tarjeta(
    'todos',
    ROTULO_DE_TODOS,
    {
      contactos: suma('contactos'),
      agendados: suma('agendados'),
      asistieron: suma('asistieron'),
      vendidos: suma('vendidos'),
      monto: montos.length === 0 ? null : montos.reduce((a, m) => a + Number(m), 0),
      ventas_sin_monto: suma('ventas_sin_monto'),
      sin_registrar: suma('sin_registrar'),
      solo_congeladas: suma('solo_congeladas'),
    },
    total,
    hayVentas,
  );

  /* Clave por clave y nunca `...l`. Es la segunda puerta de la lista blanca: si alguien agrega una
     columna al `json_build_object` de arriba, acá se cae antes de salir. La mutación lo probó —con
     el teléfono metido en el SQL y este mapeo intacto, la prueba de las catorce claves sigue verde, y
     sólo se pone roja cuando se abre el mapeo—. */
  const leads: LeadDelPortal[] = f.leads.map((l) => ({
    id: l.id,
    nombre: l.nombre,
    /* En ISO y en UTC: dentro de un \`json_build_object\` la fecha sale con el desfase de la sesión de
       la base, y así no depende de dónde corre. */
    altaEl: new Date(l.altaEl).toISOString(),
    campana: l.campana,
    creativo: l.creativo,
    puntaje: l.puntaje,
    tramo: l.tramo,
    territorio: l.territorio,
    descartado: l.descartado,
    cita: l.cita,
    asistencia: l.asistencia,
    planton: l.planton,
    vendio: l.vendio,
    monto: l.monto === null ? null : Number(l.monto),
  }));

  const salida: LeadsDelPortal = {
    dias,
    cohorte: {
      total,
      desde: iso(f.desde),
      hasta: iso(f.hasta),
      ultimaAlta: iso(f.ultima_alta),
      sinAlta: Number(f.sin_alta),
      universo: Number(f.universo),
      avisoDeLaVentana: avisoDeLaCola(
        f.proporcion === null ? null : Number(f.proporcion),
        f.mitad,
        'la mitad de los contactos entró',
      ),
    },
    tramos,
    todos,
    sinCalificar: {
      sinPuntaje: Number(f.sin_puntaje),
      enCero: Number(f.en_cero),
      cerosRecientes: Number(f.ceros_recientes),
    },
    hayVentasRegistradas: hayVentas,
    piso: PISO_DE_UNA_TASA,
    leads,
    truncado: total > leads.length,
    aviso: null,
  };
  salida.aviso = avisoDe(salida, tope);
  return salida;
}

const iso = (d: Date | null): string | null => (d === null ? null : new Date(d).toISOString());

function vacio(tramo: ClaveDeTramo): ConteoDeTramo {
  return {
    tramo,
    contactos: 0,
    agendados: 0,
    asistieron: 0,
    vendidos: 0,
    monto: null,
    ventas_sin_monto: 0,
    sin_registrar: 0,
    solo_congeladas: 0,
  };
}

function tarjeta(
  clave: ClaveDeTramo | 'todos',
  rotulo: string,
  c: Omit<ConteoDeTramo, 'tramo'>,
  total: number,
  hayVentas: boolean,
): ResumenDeTramo {
  const contactos = Number(c.contactos);
  const vendidos = Number(c.vendidos);
  const cierre = cierreDe(contactos, vendidos, hayVentas);
  const monto = montoDe(vendidos, c.monto === null ? null : Number(c.monto), hayVentas);
  return {
    clave,
    rotulo,
    contactos,
    porcion: total === 0 ? null : contactos / total,
    agendados: Number(c.agendados),
    asistieron: Number(c.asistieron),
    vendidos,
    cierre: cierre.valor,
    porQueSinCierre: cierre.porque,
    montoReportado: monto.valor,
    porQueSinMonto: monto.porque,
    ventasSinMonto: Number(c.ventas_sin_monto),
    sinRegistrar: Number(c.sin_registrar),
    soloCongeladas: Number(c.solo_congeladas),
  };
}

/**
 * El cierre de una tarjeta: vendidos sobre contactos, **con dos motivos para no publicarlo**.
 *
 * En este orden, y el orden importa:
 *
 *   1 · **La empresa no tiene ninguna venta registrada.** Es el caso de hoy. Un «0 %» en cada
 *       tarjeta se leería como «ningún tramo compra», cuando lo cierto es que nadie registró una
 *       venta: es el hueco que `huecosDeSales.ts` ya declara, y esta pantalla no lo contradice.
 *   2 · **El tramo tiene menos de `PISO_DE_UNA_TASA` contactos.** Con tres personas, una venta es un
 *       33 %. El piso es del denominador, no del total.
 *
 * Fuera de esos dos, se publica, **0 incluido**: si la empresa vende y un tramo de cincuenta no, ese
 * cero está medido.
 */
export function cierreDe(
  contactos: number,
  vendidos: number,
  hayVentas: boolean,
): { valor: number | null; porque: PorQueSinCierre | null } {
  if (!hayVentas) return { valor: null, porque: 'sin_ventas_registradas' };
  if (contactos < PISO_DE_UNA_TASA) return { valor: null, porque: 'bajo_el_piso' };
  return { valor: vendidos / contactos, porque: null };
}

/**
 * El monto reportado de una tarjeta. **Tres estados, y ninguno se colapsa en otro.**
 *
 * Sin ventas en la empresa, `null`. Con ventas del tramo y ningún monto cargado, `null` también, con
 * otro motivo: un «$0» diría que vendió gratis. Y si el tramo no vendió pero la empresa sí, `0`: ahí
 * el cero es un hecho.
 */
export function montoDe(
  vendidos: number,
  suma: number | null,
  hayVentas: boolean,
): { valor: number | null; porque: PorQueSinMonto | null } {
  if (!hayVentas) return { valor: null, porque: 'sin_ventas_registradas' };
  if (vendidos > 0 && suma === null) return { valor: null, porque: 'ventas_sin_monto' };
  return { valor: suma ?? 0, porque: null };
}

/** El aviso de la cohorte. **`null` ⟹ la pantalla no dibuja nada.** */
function avisoDe(r: LeadsDelPortal, tope: number): string | null {
  const partes: string[] = [];

  /* Primero, porque cambia la lectura de todo lo demás: con las campañas pausadas desde el 14 de
     septiembre, «Hoy» y «7 días» vienen vacíos o casi, y eso no es un dato que falta. Pero NO corta
     el aviso como en la cadena de Sales: el guardián de los ceros y los que no tienen alta son de la
     empresa, no de la ventana, y tienen que decirse igual. */
  if (r.cohorte.total === 0) {
    partes.push(
      'No entró ni un contacto en esta ventana. No es que falte el dato: no hubo gente. Probá una ' +
        'ventana más larga.',
    );
  }

  if (r.sinCalificar.cerosRecientes > 0) {
    partes.push(
      `${r.sinCalificar.cerosRecientes} contacto(s) entraron en los últimos ` +
        `${DIAS_DE_LOS_CEROS_RECIENTES} días con el puntaje del CRM en 0. Se siguen contando como ` +
        '«Sin calificar», pero un 0 nuevo puede ser un puntaje real o el puntuador del CRM parado, y ' +
        'el CRM no dice cuál de los dos es.',
    );
  }

  if (r.todos.sinRegistrar > 0) {
    partes.push(
      `${r.todos.sinRegistrar} persona(s) tuvieron una cita que ya debería haber ocurrido y nadie ` +
        'registró si se presentaron. «Asistieron» cuenta sólo lo registrado: un 0 ahí no dice que no ' +
        'fue nadie.',
    );
  }

  if (r.todos.soloCongeladas > 0) {
    partes.push(
      `${r.todos.soloCongeladas} persona(s) agendaron y sólo les quedan citas congeladas: el CRM ya ` +
        'no devuelve en qué quedaron, así que no cuentan en «Agendados».',
    );
  }

  if (r.todos.ventasSinMonto > 0) {
    partes.push(
      `${r.todos.ventasSinMonto} venta(s) no tienen el monto cargado: el monto reportado suma sólo ` +
        'las que lo tienen.',
    );
  }

  /* Los que no tienen alta: la única población que ninguna ventana recupera. La frase es la de la
     cadena de Sales, para que las dos pantallas lo digan igual. */
  if (r.cohorte.sinAlta > 0) {
    partes.push(
      `${r.cohorte.sinAlta} contacto(s) de la empresa no tienen fecha de alta en el CRM, así que no ` +
        'entran en esta cohorte ni en ninguna otra: ampliar la ventana no los trae.',
    );
  }

  if (r.truncado) {
    partes.push(
      `La lista llegó recortada: se muestran ${r.leads.length} de ${r.cohorte.total} (el tope es ` +
        `${tope}). Las tarjetas cuentan a todos; la búsqueda y los filtros, sólo a los que llegaron.`,
    );
  }

  /* La nota de definición, sólo cuando hay ventas que leer. Sin ventas, lo dice el hueco de la
     venta, y repetirlo acá sería ruido encima del hueco. */
  if (r.hayVentasRegistradas) {
    partes.push(
      'Una venta acá es la que el closer reportó, no un pago verificado: este sistema no tiene ' +
        'ninguna integración de cobros.',
    );
  }

  return partes.length === 0 ? null : partes.join(' ');
}

/** Lo que la cadena de Sales dice de la misma ventana, al lado de lo que dice esta pestaña. */
export interface CoherenciaConSales {
  cohorte: number;
  agendados: number;
  coincide: boolean;
}

/**
 * **Compara la cohorte y «agendó» con la cadena de Sales**, y si no coinciden lo agrega al aviso.
 *
 * Las dos pestañas usan la misma expresión de cohorte y el mismo predicado de «agendó», así que en
 * la misma ventana tienen que dar lo mismo. Si no lo dan, ninguna de las dos falla por separado: el
 * defecto sólo se ve poniéndolas una al lado de la otra. Por eso no se elige una de las dos cifras —no
 * hay forma de saber desde acá cuál tiene razón—: se publican las dos y el aviso lo dice.
 *
 * Es una función aparte, y pura, para poder probarla con cifras que NO coinciden: con el código
 * correcto nunca divergen, así que ninguna prueba de la ruta vería si la alarma se apagó.
 */
export function coherenciaConSales(
  portal: Pick<LeadsDelPortal, 'cohorte' | 'todos' | 'aviso'>,
  cadena: Pick<CadenaDeCierre, 'cohorte' | 'eslabones'>,
): { coherencia: CoherenciaConSales; aviso: string | null } {
  const agendados = cadena.eslabones.find((e) => e.clave === 'con_cita')?.contactos ?? 0;
  const coincide = cadena.cohorte === portal.cohorte.total && agendados === portal.todos.agendados;
  const coherencia = { cohorte: cadena.cohorte, agendados, coincide };
  if (coincide) return { coherencia, aviso: portal.aviso };
  const alarma =
    `Esta pestaña y Sales no cuentan lo mismo en esta ventana: ${portal.cohorte.total} contra ` +
    `${cadena.cohorte} contactos, y ${portal.todos.agendados} contra ${agendados} que agendaron. Es ` +
    'un defecto: las dos usan la misma cohorte y el mismo «agendó».';
  return { coherencia, aviso: portal.aviso === null ? alarma : `${alarma} ${portal.aviso}` };
}
