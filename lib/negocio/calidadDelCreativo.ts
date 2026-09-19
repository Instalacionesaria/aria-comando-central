// Qué pieza trae mejor gente: ICP y tasa de agenda por creativo.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ESTO SE PUEDE CALCULAR HOY, Y ES LA ÚNICA PREGUNTA QUE SÓLO CREATIVE CONTESTA
//
// El § 18.1 dice que Acquisition **no puede** decidir solo qué anuncio genera más dinero, *«porque
// esa conclusión requiere cruzar adquisición, ICP, agendamientos, ventas y revenue»*. De esa cadena,
// las ventas no existen —`negocio.resultados` tiene 7 filas y cero ventas— pero el ICP y los
// agendamientos sí, y son los dos eslabones que separan «esta pieza trae mucha gente» de «esta pieza
// trae la gente que sirve».
//
// Medido el 2026-09-18, ventana de 30 días: el ICP promedio va de **29,2 a 69,2** según la pieza
// —factor 2,4— y la tasa de agenda de **31 % a 77 %**. Seis piezas sobre el piso.
//
// Y no necesita nada de Meta: ni una credencial nueva, ni una llamada, ni el colector. Por eso este
// módulo es el que hace que Creative deje de ser una maqueta, y por eso se escribe antes que el que
// lee el desglose de acciones.
//
// ── LA UNIDAD ES LA PIEZA, Y AGRUPAR POR `adId` BORRA UNA CAMPAÑA ENTERA ────
//
// La llave es el nombre del creativo normalizado, no el identificador del anuncio. Medido: los 79
// anuncios de `negocio.anuncios` son **32 piezas distintas** y 21 de ellas corren en más de un
// `adId`, hasta seis. Y del lado del contacto, `utmContent` está en 505 de 589 (85,7 %) contra 213
// de 589 (36,2 %) de `adId`.
//
// Ese 36 % no es una muestra al azar: el `adId` llega **si y sólo si** el lead entró por el anuncio,
// y falta entero en las otras dos puertas de entrada (`costoDelAnuncio.ts:14-21`). Agrupar por él no
// da «una cobertura del 36 %»: da una población distinta.
//
// ── Y LAS CITAS SÍ ENVEJECEN, AUNQUE LOS CONTACTOS NO ───────────────────────
//
// La cohorte se arma con `alta_en_el_crm`, que el barrido reescribe tal cual en cada pasada: un
// contacto de hace veintinueve días vale hoy lo mismo que el día que llegó. Pero una cita
// **congelada** —`ghl_calendario_id is null`— es una que el CRM ya no devuelve, y su proporción
// crece con la ventana: medido el 2026-09-15, 7,0 % a catorce días y **27,2 % a treinta**.
//
// Por eso `congeladas` viaja en la misma respuesta y en la misma pasada. Es la condición bajo la
// cual una ventana de treinta días es publicable en una cifra de citas, y es lo mismo que hace
// `tasaDeCancelacion` (`indicadoresDeCitas.ts:345`).
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';

import { datos } from '../datos/contexto.ts';
import { campoPorNombre } from './camposDelCrm.ts';
import { DIAS_DE_LA_TASA, PISO_DE_UNA_TASA } from './indicadoresDeCitas.ts';

/**
 * El nombre del campo del CRM que trae el puntaje de encaje.
 *
 * **Exacto y no parecido**, y no es una precaución abstracta: el catálogo de esta empresa tiene
 * DIEZ campos con nombre parecido —`Pre-Score | ICP`, `Puntaje | Meta Lead Ads`,
 * `Pre-Score | Meta Lead Ads`, `Puntaje Final`, `Puntaje Survey HT`, `perfil_icp`,
 * `puntaje_encaje_icp`, `puntaje_interaccion`, `Lead Score`— y elegir el equivocado da una columna
 * llena de números plausibles sobre otra pregunta. `campoPorNombre` compara exacto por eso mismo.
 *
 * Medido el 2026-09-18: es `9HXxl5DW6aayQgKUPiOS`, el campo más poblado de la cohorte (344 de 344
 * contactos de treinta días).
 */
export const CAMPO_DE_ICP = 'Puntaje | ICP';

/** Las tres etapas del embudo, tal como aparecen en el nombre de campaña. */
export const ETAPAS = ['TOFU', 'MOFU', 'BOFU'] as const;
export type Etapa = (typeof ETAPAS)[number];

export interface FilaDeCreativo {
  /** El nombre de la pieza, normalizado. `null` = el contacto no trae creativo. */
  creativo: string | null;
  /**
   * La etapa del embudo, leída del nombre de campaña. `null` = no se pudo leer.
   *
   * **No se fuerza a ninguna rama**: lo que no trae un segmento reconocible cae acá y se cuenta
   * aparte. Medido, hay tres clases: `{{CAMPAIGN.NAME}}` (la plantilla sin expandir), `IG-DM` y un
   * nombre propio.
   */
  etapa: Etapa | null;
  contactos: number;
  /** Cuántos de esos contactos traen el campo de ICP. Viaja siempre, con el promedio. */
  conPuntaje: number;
  /** `null` bajo el piso, o si el campo no está en el catálogo. Nunca cero. */
  icpPromedio: number | null;
  agendaron: number;
  /** `null` bajo el piso. Nunca cero: sin base no hay tasa. */
  tasaDeAgenda: number | null;
  /**
   * En cuántos anuncios de Meta corre esta pieza. `0` = el nombre no cruza contra
   * `negocio.anuncios`.
   *
   * No es decoración: es la única mitigación honesta de que dos piezas distintas con el mismo
   * nombre se fundan sin que nada lo diga. Una pieza que salta de dos a siete anuncios de una
   * semana a la otra se ve.
   */
  anunciosDeMeta: number;
}

export interface CalidadDeLosCreativos {
  dias: number;
  /** Los dos extremos de la cohorte REAL, no los de la ventana pedida. */
  desde: string | null;
  hasta: string | null;
  filas: FilaDeCreativo[];
  /**
   * Citas de la ventana que el CRM ya no devuelve. **Viaja siempre y en la misma pasada.**
   *
   * Dos consultas podrían ver estados distintos de la tabla —el barrido escribe cada hora— y
   * entonces las dos poblaciones de la misma pantalla no sumarían, sin que nada falle.
   */
  congeladas: number;
  /** La cobertura del cruce nombre↔anuncio, con sus dos términos. Se dibuja ARRIBA de todo ranking. */
  puente: { con: number; sobre: number };
  /**
   * El identificador del campo de ICP, o `null` si no está en el catálogo del CRM.
   *
   * `null` **apaga la columna entera y lo dice**. Publicar ceros ahí sería afirmar que todos los
   * leads tienen encaje cero, que es una afirmación sobre el negocio hecha con un campo que no
   * existe.
   */
  campoDeIcp: string | null;
  /** `null` ⟹ la pantalla no dibuja nada. La regla del silencio de este proyecto. */
  aviso: string | null;
}

/** La llave de agrupación del departamento, en UN solo lugar. */
function llaveDelCreativo(columna: string) {
  /* `lower(btrim(...))` y no `lower(trim(...))` por costumbre del motor: son lo mismo, y `btrim` es
     lo que el resto del repositorio escribe.
     *
     * Vive acá y no repetida en cada consulta porque es el predicado de agrupación de toda la
     * pantalla: dos consultas con dos normalizaciones distintas darían dos definiciones de «la misma
     * pieza», que es la regla 12 de las transversales con otro traje. Medido, sin esto
     * `Evoluciona native` y `evoluciona native` salen como dos piezas. */
  return sql<string | null>`nullif(lower(btrim(${sql.raw(columna)})), '')`;
}

/**
 * La etapa, leída del NOMBRE de campaña.
 *
 * Se parte por `|` y se busca el segmento que, en mayúsculas y sin espacios, sea una de las tres.
 * Leer el nombre entero no sirve y está medido: `NUEVA ERA | BOFU | AGENDAS | LATAM+USA` y
 * `… | LATAM USA` son la misma campaña y parten 45 contactos en 43 + 2. Normalizar mayúsculas
 * tampoco alcanza —el `+` no es una mayúscula—, así que se mira sólo el segmento que importa.
 *
 * Lo que no trae ninguno de los tres devuelve `null`, y eso es un grupo, no un descarte.
 */
const ETAPA_DEL_NOMBRE = sql<Etapa | null>`(
  select btrim(e)
    from unnest(string_to_array(upper(coalesce(contactos.atribucion_primera ->> 'campaign', '')), '|')) e
   where btrim(e) in ('TOFU', 'MOFU', 'BOFU')
   limit 1)`;

/**
 * El ICP y las agendas por pieza, en la ventana.
 *
 * `dias` es el de `PERIODOS`; el valor por omisión es el de las cifras de citas del proyecto.
 * Se corre dentro de `conOrganizacion(`.
 */
export async function calidadDelCreativo(
  dias = DIAS_DE_LA_TASA,
): Promise<CalidadDeLosCreativos> {
  /* El campo se resuelve UNA vez y se pasa a la consulta. Si no está, la columna se apaga y el
     aviso lo dice — no se consulta un identificador vacío ni se publica cero. */
  const campoDeIcp = await campoPorNombre(CAMPO_DE_ICP);

  const [filas, extremos, congeladas, puente] = await Promise.all([
    porCreativo(dias, campoDeIcp),
    extremosDeLaCohorte(dias),
    congeladasDeLaVentana(dias),
    coberturaDelPuente(dias),
  ]);

  return {
    dias,
    desde: extremos.desde,
    hasta: extremos.hasta,
    filas,
    congeladas,
    puente,
    campoDeIcp,
    aviso: avisoDe({ filas, congeladas, campoDeIcp, puente }),
  };
}

/**
 * Cuántos anuncios de Meta hay bajo cada nombre de pieza.
 *
 * Consulta aparte y no una subconsulta correlacionada, y el motivo no es de estilo: son dos hechos
 * de **distinto grano** —uno por contacto, otro por anuncio— y unirlos en una sola consulta
 * multiplicaría los contactos por la cantidad de anuncios de la pieza, hasta seis. Es el defecto que
 * `costoDelAnuncio.ts:157-164` documenta para su propio par de tablas: «no falla, devuelve un número
 * más grande».
 *
 * (El primer intento sí la escribió correlacionada, y PostgreSQL la rechazó con `42803` porque la
 * subconsulta nombraba `contactos.org_id` fuera del `group by`. El error fue suerte: la versión que
 * compila es la que además tiene el grano bien.)
 */
async function anunciosPorNombre(): Promise<Map<string, number>> {
  const filas = await datos()
    .selectFrom('anuncios')
    .select([
      sql<string>`lower(btrim(nombre))`.as('n'),
      sql<number>`count(*)`.as('c'),
    ])
    .where(sql<boolean>`coalesce(nombre, '') <> ''`)
    .groupBy(sql`1`)
    .execute();

  return new Map(filas.map((f) => [f.n, Number(f.c ?? 0)]));
}

async function porCreativo(dias: number, campoDeIcp: string | null): Promise<FilaDeCreativo[]> {
  const llave = llaveDelCreativo("contactos.atribucion_primera ->> 'utmContent'");
  const anuncios = await anunciosPorNombre();

  /* El puntaje sólo se castea cuando parece un número. Un valor de texto en ese campo haría que
     `::numeric` lance `22P02` y **se lleve puesta la consulta entera, no una fila**: la pantalla de
     una empresa en blanco por un dato raro de un contacto. El guard es del mismo tipo que el que la
     `053` puso en el escritor del desglose, por el mismo motivo. */
  const puntaje = campoDeIcp
    ? sql<number | null>`nullif(contactos.campos_del_crm ->> ${campoDeIcp}, '')`
    : sql<number | null>`null::text`;

  const numerico = sql<boolean>`${puntaje} ~ '^[0-9]+([.][0-9]+)?$'`;

  const filas = await datos()
    .selectFrom('contactos')
    .select([
      llave.as('creativo'),
      ETAPA_DEL_NOMBRE.as('etapa'),
      sql<number>`count(*)`.as('contactos'),
      sql<number>`count(*) filter (where ${numerico})`.as('conPuntaje'),
      sql<number | null>`avg((${puntaje})::numeric) filter (where ${numerico})`.as('icp'),
      /* El MISMO `exists` con `ghl_calendario_id` que `costoDelAnuncio.ts:302-305` y que
         `atribucionDelLead`. Tiene que ser el mismo, o las filas de este corte no sumarían la cifra
         grande de al lado y nadie tendría cómo saber cuál de las dos está mal.
         *
         * Y `exists` y no un `join` con `count(*)`: verificado en `02-CREATIVE.md:258`, un contacto
         * con dos citas inflaba «agendamiento - yaping» de 109 a 112. */
      sql<number>`count(*) filter (where exists (
        select 1 from negocio.citas ci
         where ci.org_id = contactos.org_id and ci.contacto_id = contactos.id
           and ci.ghl_calendario_id is not null))`.as('agendaron'),
    ])
    // La misma ventana anclada al día que usa el gasto. Ver `costoDelAnuncio`.
    .where(sql<boolean>`contactos.alta_en_el_crm >= (current_date - make_interval(days => ${dias} - 1))`)
    /* Se agrupa por la EXPRESIÓN y no por un alias: PostgreSQL no admite alias en `group by` con
       subconsultas correlacionadas de por medio. */
    .groupBy([llave, ETAPA_DEL_NOMBRE])
    .execute();

  return filas
    .map((f) => {
      const contactos = Number(f.contactos ?? 0);
      const agendaron = Number(f.agendaron ?? 0);
      const conPuntaje = Number(f.conPuntaje ?? 0);
      return {
        creativo: f.creativo,
        etapa: f.etapa,
        contactos,
        conPuntaje,
        /* El piso es del DENOMINADOR de cada cifra, no del total de la fila: el ICP se promedia
           sobre los que traen el campo y la tasa se calcula sobre todos los contactos, así que son
           dos denominadores distintos y cada uno responde por el suyo. */
        icpPromedio: conPuntaje >= PISO_DE_UNA_TASA && f.icp !== null ? Number(f.icp) : null,
        agendaron,
        tasaDeAgenda: contactos >= PISO_DE_UNA_TASA ? agendaron / contactos : null,
        anunciosDeMeta: f.creativo === null ? 0 : (anuncios.get(f.creativo) ?? 0),
      };
    })
    /* Por volumen, que es un hecho. No por tasa: ordenar por una cifra que la mayoría de las filas
       tiene en `null` pone los nulos en una punta y parece un ranking. */
    .sort((a, b) => b.contactos - a.contactos);
}

/** Los dos extremos de la cohorte real. Una ventana de 30 días sobre 5 no muestra «poca gente». */
async function extremosDeLaCohorte(dias: number): Promise<{ desde: string | null; hasta: string | null }> {
  const f = await datos()
    .selectFrom('contactos')
    .select([
      sql<string | null>`min(alta_en_el_crm)::date::text`.as('desde'),
      sql<string | null>`max(alta_en_el_crm)::date::text`.as('hasta'),
    ])
    .where(sql<boolean>`alta_en_el_crm >= (current_date - make_interval(days => ${dias} - 1))`)
    .executeTakeFirst();

  return { desde: f?.desde ?? null, hasta: f?.hasta ?? null };
}

/** Las citas de la ventana que el CRM ya no devuelve. Ver el encabezado. */
async function congeladasDeLaVentana(dias: number): Promise<number> {
  const f = await datos()
    .selectFrom('citas')
    .select(sql<number>`count(*) filter (where citas.ghl_calendario_id is null)`.as('n'))
    /* Por la cohorte de CONTACTOS y no por la fecha de la cita: la pantalla habla de los contactos
       que entraron en la ventana, así que las congeladas que importan son las suyas. Medir por la
       fecha de la cita daría otra población y la resta no cerraría. */
    .where(sql<boolean>`exists (
      select 1 from negocio.contactos ct
       where ct.org_id = citas.org_id and ct.id = citas.contacto_id
         and ct.alta_en_el_crm >= (current_date - make_interval(days => ${dias} - 1)))`)
    .executeTakeFirst();

  return Number(f?.n ?? 0);
}

/**
 * Cuántos contactos con creativo cruzan contra un anuncio real de Meta.
 *
 * Los dos términos, siempre: una proporción sola se lee como precisión y el par dice de cuántos
 * habla. Medido el 2026-09-18 sobre la base entera: 477 de 505 (94,5 %). Los que no cruzan no son
 * un defecto —`link_in_bio`, `{{ad.name}}` sin expandir, pruebas— pero la pantalla no puede saberlo
 * sola, así que publica el par y deja la lectura a quien mira.
 */
async function coberturaDelPuente(dias: number): Promise<{ con: number; sobre: number }> {
  const llave = llaveDelCreativo("contactos.atribucion_primera ->> 'utmContent'");

  const f = await datos()
    .selectFrom('contactos')
    .select([
      sql<number>`count(*) filter (where ${llave} is not null)`.as('sobre'),
      sql<number>`count(*) filter (where exists (
        select 1 from negocio.anuncios a
         where a.org_id = contactos.org_id and lower(btrim(a.nombre)) = ${llave}))`.as('con'),
    ])
    .where(sql<boolean>`contactos.alta_en_el_crm >= (current_date - make_interval(days => ${dias} - 1))`)
    .executeTakeFirst();

  return { con: Number(f?.con ?? 0), sobre: Number(f?.sobre ?? 0) };
}

/**
 * El aviso. **`null` ⟹ la pantalla no dibuja nada**, que es la regla del silencio de este proyecto.
 *
 * El orden importa y es el mismo criterio que `costoDelAnuncio`: primero lo que invalida la columna
 * entera, después lo que la recorta. Un campo de ICP que no existe describe mal toda una columna;
 * unas congeladas describen mal una cifra que igual se puede leer.
 */
function avisoDe(r: {
  filas: FilaDeCreativo[];
  congeladas: number;
  campoDeIcp: string | null;
  puente: { con: number; sobre: number };
}): string | null {
  const partes: string[] = [];

  if (r.campoDeIcp === null) {
    partes.push(
      `El CRM de esta empresa no tiene un campo «${CAMPO_DE_ICP}», o cambió de nombre. Sin él no ` +
        'hay encaje que promediar: no es que los leads tengan encaje cero.',
    );
  }

  /* Las congeladas, con su conteo. El texto es el de `tasaDeCancelacion` y a propósito: es la misma
     cosa contada sobre otra población, y decirla de dos maneras distintas en el mismo producto
     obliga a quien lee a averiguar si son lo mismo. */
  if (r.congeladas > 0) {
    partes.push(
      `No se cuentan ${r.congeladas} cita(s) de este período: quedaron congeladas y el CRM ya no ` +
        'devuelve sus eventos.',
    );
  }

  /* Y cuántas piezas quedaron sin tasa. No es un defecto —es el piso funcionando— pero una tabla
     con doce guiones se lee como un error si nadie dice que son doce piezas con poca gente. */
  const sinTasa = r.filas.filter((f) => f.tasaDeAgenda === null).length;
  if (sinTasa > 0 && r.filas.length > 0) {
    partes.push(
      `${sinTasa} de ${r.filas.length} pieza(s) no llegan a ${PISO_DE_UNA_TASA} contactos, así que ` +
        'tienen conteo y no tasa.',
    );
  }

  return partes.length === 0 ? null : partes.join(' ');
}
