// Por dónde entró cada persona. La llave de Conversion, en UN solo lugar.
//
// ═══════════════════════════════════════════════════════════════════════════════
// TRES RAMAS, SEIS FAMILIAS, Y LA AUSENCIA DE URL **NO** ES UN HUECO
//
// El departamento entero se apoya en una idea: la unidad es el CONTACTO —no la sesión, porque no
// existe ninguna tabla de sesiones— y a cada contacto se le puede nombrar el camino por el que
// llegó. Medido contra producción el 2026-09-20 sobre 590 contactos.
//
// ── POR QUÉ EL ÚLTIMO TOQUE Y NO EL PRIMERO ─────────────────────────────────
//
// `atribucion_primera` responde «de qué anuncio vino», que es de Acquisition. `atribucion_ultima`
// responde «por dónde volvió a entrar», que es lo de acá. La columna existe desde la migración
// `048`, está poblada en **475 de 590 contactos con `url`** —contra 329 de la primera— y hasta hoy
// **ningún módulo del repositorio la leía**.
//
// El caso que lo prueba: `Trigger Link` vale 29 de 584 en la última y **0 de 584 en la primera**. Un
// módulo que lo buscara en la primera mediría cero para siempre y lo reportaría como «no se usan».
//
// ── LAS TRES RAMAS, EN ORDEN ────────────────────────────────────────────────
//
//   1 · **Trae `url`** ⟹ la familia sale del HOST. Siete hosts y son cinco cosas distintas: sumarlos
//       cuenta cinco poblaciones como si fueran una.
//   2 · **No trae `url` pero sí `sessionSource`** ⟹ llegó sin pisar página. Medido: 89 contactos, y
//       **88 con `medium: facebook` y `sessionSource: Paid Social`** — formulario nativo de Meta,
//       que por definición nunca abre una landing. El que falta es Instagram orgánico, y por eso la
//       familia se llama `sin-pagina` y no `meta`: se nombra por lo que la define, no por su mayoría.
//   3 · **No trae ninguno de los dos** ⟹ sin rastro. 26 contactos, **ninguno de septiembre**, y
//       son exactamente los 26 que traen `atribucion_ultima = {}` entero.
//
// **El error fácil sería clasificar por `sessionSource`.** Medido: `Paid Social` son 193 contactos y
// **105 de ellos SÍ traen URL** — más de la mitad hizo clic y llegó a una página. Lo que identifica
// al formulario nativo es la AUSENCIA de la URL; el `sessionSource` sólo le pone nombre.
//
// ── Y POR QUÉ NO SE NORMALIZA NADA ANTES ────────────────────────────────────
//
// La trampa habitual sería que la clave `url` existiera con valor vacío, y entonces «no hay dato» y
// «hay una URL vacía» colapsaran en la misma rama. Medido el 2026-09-20 sobre los 475 que la traen:
// **cero vacías, cero nulos de JSON, cero que no empiecen por `http`**. La distinción «trae la clave
// o no la trae» es limpia, así que las tres ramas son distinguibles sin limpiar nada primero.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';

import { datos } from '../datos/contexto.ts';
import { campoPorNombre } from './camposDelCrm.ts';

/**
 * Las familias de recorrido, en el orden en que se dibujan.
 *
 * El orden **no es alfabético ni por volumen**: es el del embudo que el § 1 del documento funcional
 * describe —landing, luego el formulario, luego la cita— seguido de los caminos que se lo saltan.
 * Ordenar por volumen haría que la pantalla cambiara de forma cada semana.
 */
export const FAMILIAS = [
  'landing',
  'sin-pagina',
  'meta-navegador',
  'widget',
  'precall',
  'otra',
  'sin-rastro',
] as const;

export type Familia = (typeof FAMILIAS)[number];

/** Cómo se llama cada familia en pantalla, y qué es. Viaja en la respuesta; ver `rotulos`. */
export const ROTULOS: Record<Familia, { titulo: string; que: string }> = {
  landing: {
    titulo: 'Landing con VSL',
    que: 'Entró por la página propia con el video y el formulario. Es el recorrido que el documento funcional describe.',
  },
  'sin-pagina': {
    titulo: 'Llegó sin abrir una página',
    que: 'Tiene origen de sesión pero ninguna dirección: no abrió ninguna página nuestra, así que no hay URL que registrar. No es un dato que falte, es el recorrido. Medido el 2026-09-20: 88 de 89 son formulario nativo de Meta y uno es Instagram orgánico — por eso la familia se llama por lo que la define, la ausencia de página, y no por el origen de la mayoría.',
  },
  'meta-navegador': {
    titulo: 'Meta, navegador interno',
    que: 'La última dirección registrada es la del navegador de Facebook, no una página nuestra. Abrió algo dentro de Facebook y no se puede saber qué.',
  },
  widget: {
    titulo: 'Widget de reserva',
    que: 'Fue directo a agendar, sin pasar por la landing ni por el formulario.',
  },
  precall: {
    titulo: 'Precall',
    que: 'La última dirección es posterior al agendamiento. Pertenece a Appointment Flow, no a este departamento, y se dibuja para que la cohorte cuadre.',
  },
  otra: { titulo: 'Otra página', que: 'Una dirección propia que no es ninguna de las anteriores.' },
  'sin-rastro': {
    titulo: 'Sin rastro',
    que: 'Ni dirección ni origen de sesión. Medido el 2026-09-20: 26 contactos, todos anteriores a septiembre, y son exactamente los que traen la atribución vacía entera.',
  },
};

/**
 * Los hosts de cada familia, y **por qué son una lista y no una expresión regular**.
 *
 * Una expresión regular sobre el host entero acertaría hasta el día que alguien monte
 * `accelerator.ariaia.com.mx` o un subdominio nuevo, y entonces cae en «otra» sin que nada avise.
 * Con la lista, un host nuevo **también** cae en «otra» — pero «otra» es una fila dibujada con su
 * conteo, así que aparecer ahí es visible. Es la diferencia entre un descarte y un grupo.
 *
 * Medido el 2026-09-20 sobre los 475 contactos con `url`: siete hosts, ninguno fuera de esta lista
 * salvo dos previsualizaciones de `vibepreview.com` (5 contactos, todos de agosto).
 */
const HOSTS: Record<string, Familia> = {
  'accelerator.ariaia.com': 'landing',
  'grow.ariaia.com': 'landing',
  'calls.ariaia.com': 'widget',
  'api.leadconnectorhq.com': 'widget',
  'precall.ariaia.com': 'precall',
  'www.fbsbx.com': 'meta-navegador',
  'm.facebook.com': 'meta-navegador',
  'l.facebook.com': 'meta-navegador',
};

/**
 * El host de la última dirección, en minúsculas y sin puerto. `null` si no hay dirección.
 *
 * `substring` con la expresión `://([^/?#:]+)` y no `split`: hay URLs con la cadena de consulta
 * pegada al host sin barra, y cortar por `/` las dejaría enteras. El `#` y el `:` están en la clase
 * negada porque un ancla o un puerto irían al host y lo harían único por contacto.
 */
function hostDeLaUltima(alias: string) {
  return sql<string | null>`lower(substring(${sql.raw(alias)}.atribucion_ultima ->> 'url' from '://([^/?#:]+)'))`;
}

/**
 * La familia de recorrido de un contacto. **La única definición del departamento.**
 *
 * `alias` es la tabla de contactos tal como esté nombrada en la consulta que llama.
 *
 * El `case` va en este orden y no en otro: la rama del host manda sobre la del origen, porque un
 * contacto con URL **y** `sessionSource` llegó a una página y eso es lo que se quiere contar. Poner
 * el origen primero mandaría a «formulario nativo» a los 105 de `Paid Social` que sí abrieron la
 * landing — que es exactamente el error que este módulo existe para no cometer.
 */
export function familiaDelRecorrido(alias: string) {
  const host = hostDeLaUltima(alias);
  const a = sql.raw(alias);

  /* ── LOS LITERALES VAN POR `sql.raw`, Y NO ES UN DESCUIDO ──────────────────
   *
   * Un `${host} = ${h}` se compila a `= $n`, y esta expresión se usa en el `select` **y** en el
   * `group by` de `recorridoDelLead`. Con parámetros los dos sitios reciben números distintos —`$3`
   * y `$9`—, PostgreSQL deja de reconocerlos como la misma expresión y la consulta muere con
   * `42803 · subquery uses ungrouped column`.
   *
   * Es el mismo caso que `creativo.ts:etapaDelNombre` documenta, y costó un intento acá también.
   * `sql.raw` mantiene la identidad TEXTUAL, que es lo que el `group by` compara.
   *
   * **Y es seguro porque los valores son constantes de este archivo**: los hosts y las claves de
   * familia están escritos arriba, sin entrada de nadie, y `comillas()` rechaza cualquier cosa que
   * no sea minúsculas, dígitos, punto y guion. Si algún día salieran de un dato del usuario, esto
   * sería una inyección y habría que resolver el `group by` de otra forma. */
  const casos = Object.entries(HOSTS).map(
    ([h, f]) => sql`when ${host} = ${sql.raw(comillas(h))} then ${sql.raw(comillas(f))}`,
  );

  return sql<Familia>`(case
      ${sql.join(casos, sql` `)}
      when ${a}.atribucion_ultima ? 'url' then 'otra'
      when nullif(btrim(${a}.atribucion_ultima ->> 'sessionSource'), '') is not null then 'sin-pagina'
      else 'sin-rastro'
    end)`;
}

/**
 * Un literal de texto para SQL, con el guardia que hace segura la decisión de arriba.
 *
 * Lanza en vez de escapar: si un valor no cumple, el problema es que alguien metió algo que no es
 * un host ni una clave de familia, y escaparlo lo dejaría pasar en silencio. Es un error de
 * programación y tiene que fallar al primer uso, no producir una consulta rara.
 */
function comillas(v: string): string {
  if (!/^[a-z0-9.-]+$/.test(v)) {
    throw new Error(
      `«${v}» no es un host ni una clave de familia: sólo minúsculas, dígitos, punto y guion. ` +
        'Estos valores se interpolan crudos en el SQL para que el `group by` los reconozca.',
    );
  }
  return `'${v}'`;
}

/**
 * La ventana de la cohorte de contactos, anclada al día. **Un solo lugar, y por eso es exportada.**
 *
 * Es la misma que usan `costoDelAnuncio.ts:348` y `calidadDelCreativo.ts:230`, y tiene que serlo:
 * las tres pantallas cuentan contactos sobre la misma ventana y con la misma etiqueta arriba.
 *
 * **Anclada al día y no móvil de 24 horas**, al revés que el resto del sistema. El argumento entero
 * está en `costoDelAnuncio.ts:33-63`: Conversion cruza sus contactos con el gasto y con las piezas,
 * que viven en columnas `date`, y mezclar las dos formas dividió una vez treinta y un días de gasto
 * entre treinta de leads.
 */
export function ventanaDeLaCohorte(alias: string, dias: number) {
  return sql<boolean>`${sql.raw(alias)}.alta_en_el_crm >= (current_date - make_interval(days => ${dias} - 1))`;
}

/**
 * El campo del CRM que guarda el embudo del formulario de la landing.
 *
 * **El nombre exacto, y va en una constante con su medición al lado** porque el catálogo tiene 172
 * campos y varios con nombre parecido. Medido el 2026-09-20: `XqOfGEWle6fay7hPuvWp`, 247 contactos,
 * tres valores y sólo tres.
 */
export const CAMPO_DEL_FORMULARIO = 'Form Landing VSL';

/** Los tres valores que el campo puede tomar. **Vocabulario cerrado**; ver `embudoDelFormulario`. */
export const ESTADOS_DEL_FORMULARIO = [
  'Agendado',
  'Form completo sin agendar',
  'Form incompleto sin agendar',
] as const;

export type EstadoDelFormulario = (typeof ESTADOS_DEL_FORMULARIO)[number];

/**
 * El corte de época: hasta cuándo se escribió el embudo del formulario.
 *
 * ── POR QUÉ SE DETECTA Y NO SE ESCRIBE ──────────────────────────────────────
 *
 * El corte es el 2026-08-31, y escribir esa fecha en el código sería una cifra medida que envejece
 * sin que nada avise — el defecto que Creative pagó tres veces y que
 * `components/creative/PanelDeCreative.jsx:32-37` documenta.
 *
 * Sale del dato: el último día con el campo escrito. Si la landing vuelve y el campo se repuebla, el
 * corte se mueve solo; si nunca vuelve, se queda donde está y la pantalla lo sigue diciendo.
 *
 * **`null` significa que el campo nunca se escribió**, que no es lo mismo que «no hay corte»: quiere
 * decir que no hay época que comparar, y el aviso lo dice distinto.
 */
export async function ultimoDiaDelFormulario(): Promise<string | null> {
  const campo = await campoPorNombre(CAMPO_DEL_FORMULARIO);
  if (campo === null) return null;

  const f = await datos()
    .selectFrom('contactos')
    .select(sql<string | null>`max(alta_en_el_crm)::date::text`.as('ultimo'))
    .where(sql<boolean>`campos_del_crm ? ${campo}`)
    .executeTakeFirst();

  return f?.ultimo ?? null;
}

/**
 * Si la ventana pedida cruza el corte de época.
 *
 * Es la regla 2 del departamento —*«nunca mezclar cohortes de antes y después del 2026-08-31»*,
 * `docs/estado actual/03-CONVERSION.md:219`— convertida en un campo que la pantalla no puede
 * ignorar por descuido. Una regla que vive sólo en un documento es una regla que el próximo viola.
 *
 * Medido el 2026-09-20 con las cuatro ventanas del sistema: **las dos que NO cruzan el corte no
 * tienen volumen** —«hoy» son 0 contactos y «7 días» son 4— **y las dos que tienen volumen lo
 * cruzan**. No hay una sola ventana que sirva, y por eso esto viaja siempre.
 */
export interface CorteDeEpoca {
  /** El último día con el formulario escrito. `null` = nunca se escribió. */
  fecha: string | null;
  /** `true` = la ventana empieza antes del corte, o sea que mezcla dos regímenes de adquisición. */
  laVentanaLoCruza: boolean;
}

export async function corteDeEpoca(dias: number): Promise<CorteDeEpoca> {
  const fecha = await ultimoDiaDelFormulario();
  if (fecha === null) return { fecha: null, laVentanaLoCruza: false };

  /* El primer día de la ventana, calculado por la BASE y con la misma expresión que
     `ventanaDeLaCohorte`. Hacerlo en JavaScript con `new Date()` usaría la zona del servidor, que
     no es la de la base: el borde caería un día antes o después según dónde corra esto.
     *
     * `selectNoFrom` y no un `select … from contactos limit 1`: con la tabla vacía ese `limit`
     * devolvería cero filas y el `?? false` diría «la ventana no cruza el corte» sobre una pregunta
     * que no depende de que haya contactos. Es el mismo cero indistinguible de siempre, en la
     * respuesta de una consulta en vez de en una columna. */
  const f = await datos()
    .selectNoFrom(
      sql<boolean>`(current_date - make_interval(days => ${dias} - 1))::date <= ${fecha}::date`.as('cruza'),
    )
    .executeTakeFirstOrThrow();

  return { fecha, laVentanaLoCruza: f.cruza };
}
