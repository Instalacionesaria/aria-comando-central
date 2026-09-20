// Cómo se comportó cada pieza en la subasta: hook rate, link CTR y las vistas de la landing.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ESTAS CIFRAS ESTABAN DECLARADAS IMPOSIBLES, Y LLEGABAN DESDE EL PRIMER DÍA
//
// `lib/ghl/anuncios.ts` afirmaba que esta vía no daba «ninguna métrica de video… tampoco `link
// clicks`, `link CTR` ni `landing page views`». De esas ocho cosas, cuatro venían en un campo
// anidado —`results`— que `numero()` convertía en nulo. La migración `053` le dio columna y el
// colector la escribe; esto es lo que se puede publicar con ella.
//
// Dos de las seis métricas de «video y creativo» del § 18.7 y **las tres de «interacción» que
// faltaban**. Lo que sigue sin fuente —cuartiles, tiempo medio visto, retención de seis segundos,
// placement y el activo creativo— está medido como imposible en
// `docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md`, con el código de error de cada intento.
//
// ── EL ERROR MÁS FÁCIL DE COMETER ACÁ, Y NO FALLA ──────────────────────────
//
// El desglose NO viene en todas las filas. Remedido el 2026-09-19 sobre los 28 días con desglose y
// sus **240 filas anuncio-día con entrega**: `videoView` en 224 (93 %), `linkClick` en 171 (71 %),
// `landingPageView` en 150 (63 %).
//
// El denominador son las filas que tienen desglose Y entrega, no todas las que entregaron: las de
// los tres días anteriores a la migración `053` no tienen la columna, y contarlas como «el
// proveedor no reportó» sería el mismo error de denominador que este bloque describe, cometido al
// medirlo. Antes decía «224 de 266», que es eso.
//
// Sumar el numerador sobre el 63 % de los días y el denominador sobre el 100 % da una tasa
// **sistemáticamente baja, plausible y falsa**. Es el mismo error que `indicadoresDeCitas` evita
// poniendo `asistio is not null` en el DENOMINADOR, y la razón por la que cada tasa de acá viaja con
// su par `diasConLaClave / diasConEntrega`.
//
// ── Y EL GASTO NO SE RECALCULA: SE CONSUME ─────────────────────────────────
//
// El § 18.16 dice que Acquisition **entrega** a Creative el rendimiento por anuncio. Acá eso es un
// `import`: `costoDelAnuncio(dias)` ya suma el gasto por anuncio, y este módulo agrupa sus filas por
// el nombre de la pieza. Escribir una segunda suma del mismo gasto es exactamente cómo dos pantallas
// del mismo producto terminan mostrando dos números, y la divergencia no aparece primero en la
// cifra: aparece en el borde de la ventana.
//
// Lo único que se consulta acá es lo que `costoDelAnuncio` no tiene: el desglose de acciones. Y usa
// `ventanaDeMetricas`, que es literalmente la misma expresión.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';

import { datos } from '../datos/contexto.ts';
import { DIAS_DE_LA_TASA, PISO_DE_UNA_TASA } from './indicadoresDeCitas.ts';
import { costoDelAnuncio, ventanaDeMetricas } from './costoDelAnuncio.ts';
import { llaveDelCreativo } from './creativo.ts';

/**
 * Cuántas impresiones hacen falta antes de publicar una tasa cuyo denominador son impresiones.
 *
 * **No es `PISO_DE_UNA_TASA` y no puede serlo**: aquél cuenta eventos —diez citas, diez contactos— y
 * acá el denominador son impresiones. Con cien impresiones una sola reproducción mueve la cifra un
 * punto entero, así que diez no protege de nada.
 *
 * **Y no está calibrado contra nada.** Mil es el tamaño de lote con el que se cotiza el CPM, así que
 * es el número que ya usa la industria para decir «esto es una muestra y no una anécdota» — pero no
 * sale de medir el ruido de estas cifras. El § 18.19 del documento funcional declara pendiente
 * *«definir umbrales iniciales»*, y éste es uno de ellos.
 *
 * Medido el 2026-09-19 sobre los 28 días con desglose: con mil, catorce piezas publican hook rate; el
 * resto conserva su conteo y pierde la tasa.
 */
export const PISO_DE_IMPRESIONES = 1000;

/**
 * Los tipos de acción que este producto lee, con su cobertura medida el 2026-09-19.
 *
 * En un solo lugar y no esparcidos por las consultas: son literales de un proveedor, y un literal
 * mal escrito **no da error, no hace nada** — la tasa sale nula para siempre y parece que la pieza
 * no es de video. La cobertura viaja al lado para que se pueda comparar contra lo que la pantalla
 * publique: si una clave baja del uno por ciento, se escribió mal o el proveedor la renombró.
 */
export const ACCIONES_QUE_LEEMOS = {
  /* ── SE FUE `coberturaMedida`, Y NO POR ESTAR VENCIDA ──────────────────────
     *
     * Cada clave traía un `coberturaMedida` —0,84 · 0,64 · 0,56 · 0,90— que **ningún archivo leía
     * nunca**: medido el 2026-09-19 con una búsqueda en todo el repositorio, las cuatro se
     * escribían y no se consultaban. Y estaban mal: salían de dividir por 266 filas anuncio-día,
     * que incluye las de los tres días anteriores a la migración `053` —los que no tienen la
     * columna—, o sea contando «nunca le preguntamos» como «el proveedor no reportó». Sobre el
     * denominador honesto (240 filas con desglose Y entrega) dan 0,933 · 0,713 · 0,625 · 0,938.
     *
     * Pero el motivo de borrarlas no es que estuvieran vencidas: es que **no puede haber dos
     * coberturas de lo mismo**. La viva viaja por pieza en cada `TasaDeAccion`
     * (`anuncioDiasConLaClave / anuncioDiasConEntrega`) y se dibuja al lado de cada tasa. Un
     * promedio global escrito a mano al lado de una cobertura calculada es un segundo número para
     * la misma pregunta, que diverge en silencio — que es exactamente lo que pasó.
     *
     * `titulo` SÍ se queda, porque ahora se dibuja: es la definición de la columna, en su título
     * emergente. Antes tampoco lo leía nadie. */
  videoView: { titulo: 'Reproducciones que Meta contó' },
  linkClick: { titulo: 'Clics al enlace' },
  landingPageView: { titulo: 'Vistas de la landing' },
  postEngagement: { titulo: 'Interacciones con la publicación' },
} as const;

/*
 * `lead` NO ESTÁ ACÁ, Y ES DELIBERADO: ES UN AGREGADO DERIVADO QUE CUENTA DOS VECES
 *
 * Viene en el 48 % de las filas y es el candidato obvio para una «tasa de leads» por pieza. Medido
 * el 2026-09-19 sobre las 64 filas que lo traen, **en las 64**:
 *
 *     lead = onsiteWebLead + onsiteConversion.leadGrouped
 *     lead = offsiteConversion.fbPixelLead + offsiteSearchAddMetaLeads
 *
 * Las dos igualdades a la vez, exactas, en todas. O sea que las ocho claves con pinta de lead son
 * **dos hechos: uno con TRES nombres y otro con CUATRO** —287 y 215 en la ventana— más `lead`
 * (502), que los suma. Tres más cuatro más el agregado dan las ocho claves del censo. Y
 * los dos hechos ocurren en los MISMOS anuncios: 10 de los 15 reportan los dos, con 220 y 213.
 *
 * Nuestros contactos de esos 10 anuncios son 197: el 90 % de **una** de las dos cifras y el 45 % de
 * la suma. Dividir `lead` por impresiones publicaría una tasa de conversión del doble de la real,
 * y —como el defecto de grano de `costoDelAnuncio.ts:157-164`— no fallaría: daría un número más
 * grande y perfectamente creíble.
 *
 * Qué son los dos hechos exactamente, Meta no lo documenta en ningún lado que se pueda leer desde
 * GoHighLevel. Mientras no se sepa, no hay forma honesta de elegir uno, y sumarlos es lo único que
 * está medido como incorrecto. El conteo de leads de esta pantalla sale de `calidadDelCreativo`,
 * que cuenta contactos de nuestra base y sabe cuáles son.
 */

/**
 * Lo que el § 18.12 y el § 18.7 piden y **esta vía no puede dar**, con el motivo medido.
 *
 * ── POR QUÉ VIAJA A LA PANTALLA EN VEZ DE QUEDARSE EN UN DOC ────────────────
 *
 * Es el patrón `fueraDeAlcance` de `calidadDeLaAtribucion.ts:69`, y existe por lo mismo: *«viajan
 * para que nadie los rehaga»*. Un hueco que sólo vive en `docs/` es un hueco que el próximo vuelve
 * a medir desde cero — y acá medirlo cuesta un día de sondas contra la API del proveedor.
 *
 * Pero hay un segundo motivo, y es el que decidió el usuario el 2026-09-18 al elegir «sólo GHL, y
 * el hueco se declara»: **la pantalla del prototipo dibujaba estas cinco cosas con números
 * inventados.** Alguien que conozca la pantalla vieja va a buscar la curva de retención, y si no la
 * encuentra ni encuentra por qué, la conclusión razonable es que se rompió. Decir «no se puede, y
 * éste es el motivo» es lo único que distingue un hueco declarado de una regresión.
 *
 * Las cuatro mediciones son del 2026-09-18 contra la subcuenta real, y están en
 * `docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md` con la sonda para repetirlas.
 */
export const FUERA_DE_ALCANCE: { punto: string; porque: string }[] = [
  {
    punto: 'La curva de retención y los cuartiles de video',
    porque:
      'el parámetro `fields` de GoHighLevel es un enum cerrado de once valores, y ' +
      '`video_p25_watched_actions`, `thruplay` y el resto dan 422 «each value in fields must be a ' +
      'valid enum value» — incluido un campo inventado, que es el control negativo. Hace falta Meta directo',
  },
  {
    punto: 'El placement y los desgloses por edad, género o dispositivo',
    porque: '`groupBy` sólo acepta `day`, `week` y `month`; cualquier otro desglose da 422. Hace falta Meta directo',
  },
  {
    punto: 'El activo creativo: la imagen, el video, el copy y la miniatura',
    porque:
      '`/entity?entityType=AD` devuelve sólo `{name, adId, adAccountId, locationId}`, y `/creatives`, ' +
      '`/videos` y `/posts` dan 404. No hay ruta que los sirva. Hace falta Meta directo',
  },
  {
    punto: 'El formato y la duración de cada pieza',
    porque:
      'no vienen en ninguna respuesta. Se podrían inferir del NOMBRE —`broll`, `horizontal`, ' +
      '`entrevista`, `native`, `VSL`—, y eso es una decisión sin tomar: inferir un formato de una ' +
      'convención de nombres acierta hasta el día que alguien nombra distinto, y nada avisa',
  },
];

/**
 * Una tasa construida sobre el desglose, con la cobertura de su propio numerador.
 *
 * Los cuatro campos viajan siempre. `tasa` sin `anuncioDiasConLaClave` se lee como si hablara de
 * toda la ventana, y no habla: habla de los anuncio-día en que el proveedor reportó esa acción.
 */
export interface TasaDeAccion {
  /** La suma del tipo de acción sobre los días que TRAÍAN la clave. `null` = ningún día la trajo. */
  cantidad: number | null;
  /** La tasa, en porcentaje. `null` sin denominador suficiente. **Nunca cero por ausencia.** */
  tasa: number | null;
  /**
   * Anuncio-día de esta pieza en los que el proveedor reportó esta acción.
   *
   * **El grano va en el nombre y no sólo en el comentario**, y eso cuesta un renombre: se llamaban
   * `diasConLaClave` y `diasConEntrega`, y había un TERCER campo llamado igual que el segundo —el de
   * la pieza— construido sobre otro predicado. Los dos se dibujaban en la misma frase de la
   * pantalla, los dos con la palabra «día». Ver `FilaDeRendimiento.diasConEntrega`.
   */
  anuncioDiasConLaClave: number;
  /** Anuncio-día de esta pieza con impresiones. El denominador de la cobertura, mismo grano. */
  anuncioDiasConEntrega: number;
}

export interface FilaDeRendimiento {
  /** El nombre de la pieza, normalizado. La misma llave que `calidadDelCreativo`. */
  creativo: string;
  /** En cuántos anuncios corre. Medido: 21 de 32 piezas corren en más de uno, hasta seis. */
  anuncios: number;

  /* ── Lo que se CONSUME de `costoDelAnuncio`, sumado por pieza ───────────── */
  gasto: number | null;
  impresiones: number | null;
  clics: number | null;
  /**
   * Las tres derivadas se recalculan sobre las sumas de la pieza y **no se promedian** las de sus
   * anuncios: promediar el CPM de un anuncio de mil impresiones con el de uno de cien mil no da el
   * CPM de la pieza, da el promedio de dos números. Es la misma razón por la que `costoDelAnuncio`
   * las recalcula en vez de promediar las que el proveedor manda por día.
   */
  cpm: number | null;
  cpc: number | null;
  ctr: number | null;
  /**
   * En cuántos **días de calendario** entregó la pieza, dentro de la ventana.
   *
   * ── ESTO ERA DOS DEFECTOS A LA VEZ, Y LOS DOS DABAN UN NÚMERO MÁS GRANDE ──
   *
   * Se construía sumando el `diasConEntrega` de cada anuncio que devuelve `costoDelAnuncio`, y eso
   * fallaba dos veces:
   *
   *   · **Otro predicado.** El de `costoDelAnuncio.ts:287` cuenta `gasto is not null`; el
   *     denominador de todas las tasas de acá cuenta `impresiones is not null`. Medido el
   *     2026-09-19 sobre los 30 días: **35 de 275 filas tienen gasto y no tienen impresiones**, o
   *     sea que los dos números diferían en el 12,7 % de las filas. Y la pantalla los dibujaba en
   *     la MISMA frase, los dos con la palabra «día». El texto de al lado delataba cuál era el
   *     correcto: *«no es que gastara cero: no se mostró»* habla de impresiones.
   *   · **Otro grano.** Sumar a lo largo de los anuncios de la pieza cuenta dos veces el día en que
   *     dos de sus anuncios entregaron. Medido: **11 de 26 piezas** daban un número inflado, hasta
   *     en 7 días. Hoy no supera los 30 de la ventana por casualidad del borde —el máximo da
   *     exactamente 30—, y el día que dos anuncios se solapen dirá «entregó 34 días» en una ventana
   *     de 30: el defecto de grano de `costoDelAnuncio.ts:157-164` otra vez, que no falla y
   *     devuelve un número más grande y creíble.
   *
   * Ahora sale de `count(distinct fecha)` en la MISMA consulta que el denominador de las tasas, así
   * que los dos hablan del mismo hecho. El par de la cobertura sigue siendo anuncio-día, que es su
   * grano correcto —el denominador de la tasa son impresiones sumadas sobre anuncio-día— y por eso
   * ahora lo dice su nombre.
   */
  diasConEntrega: number;

  /* ── Y lo que sale del desglose ─────────────────────────────────────────── */
  /** `videoView` / impresiones. Ver el aviso de definición en `avisoDe`. */
  hookRate: TasaDeAccion;
  /** `linkClick` / impresiones. **No es el CTR**: `linkClick ≤ clics`, y la diferencia es el § 18.7. */
  linkCtr: TasaDeAccion;
  landingPageViewRate: TasaDeAccion;
  /** `landingPageView` / `linkClick`. Cuánto se pierde entre el clic y la carga. */
  clickToLanding: TasaDeAccion;
  interaccion: TasaDeAccion;
}

export interface RendimientoDeLosCreativos {
  dias: number;
  /** Los extremos del GASTO guardado. */
  desde: string | null;
  hasta: string | null;
  /**
   * El primer día con desglose, que **no es el mismo** que el del gasto.
   *
   * La columna `acciones` nació con la migración `053`, así que las filas anteriores la tienen en
   * nulo salvo las que el relleno alcanzó. Una pantalla que diga «30 días» mientras el hook rate
   * habla de tres afirma algo falso sobre el alcance de la cifra, y es la regla 9 aplicada a una
   * columna en vez de a una cohorte.
   */
  desdeElDesglose: string | null;
  filas: FilaDeRendimiento[];
  gastoTotal: number | null;
  /** Lo que esta vía no puede dar, con el motivo. Se DIBUJA; ver `FUERA_DE_ALCANCE`. */
  fueraDeAlcance: { punto: string; porque: string }[];
  /**
   * Cómo se llama cada acción del desglose, para el título emergente de su columna.
   *
   * Viaja UNA vez por respuesta y no una por fila: es una propiedad del dato, no de la pieza. Y
   * viaja en vez de importarse porque la pantalla es `'use client'` y este módulo abre la base —
   * importarlo desde el navegador arrastra `pg` al paquete.
   */
  titulos: Record<Clave, string>;
  aviso: string | null;
}

type Clave = keyof typeof ACCIONES_QUE_LEEMOS;

/** Los títulos, aplanados una sola vez. La pantalla los recibe; no importa el módulo. */
const TITULOS = Object.fromEntries(
  Object.entries(ACCIONES_QUE_LEEMOS).map(([k, v]) => [k, v.titulo]),
) as Record<Clave, string>;

function redondear(v: number, decimales: number): number {
  const f = 10 ** decimales;
  return Math.round(v * f) / f;
}

const MIL_IMPRESIONES = 1000;

/**
 * El rendimiento de entrega por pieza, en la ventana.
 *
 * Se corre dentro de `conOrganizacion(`.
 */
export async function rendimientoDelCreativo(
  dias = DIAS_DE_LA_TASA,
): Promise<RendimientoDeLosCreativos> {
  const [costo, desglose, desdeElDesglose] = await Promise.all([
    costoDelAnuncio(dias),
    desglosePorCreativo(dias),
    primerDiaConDesglose(dias),
  ]);

  /* Las filas de Acquisition, agrupadas por el nombre de la pieza. Acá NO hay riesgo de grano: sus
     filas ya vienen una por anuncio, y varios anuncios de la misma pieza se suman — que es
     exactamente lo que el departamento existe para hacer. */
  const porPieza = new Map<string, FilaDeRendimiento>();

  for (const f of costo.filas) {
    /* La llave viene YA NORMALIZADA por la base. Calcularla acá con `.trim().toLowerCase()` era una
       segunda definición de «la misma pieza», y las dos no son equivalentes: ver `creativo.ts`.

       Un anuncio sin nombre no se descarta en silencio: cae en su propia fila, rotulada, porque su
       gasto es real y tiene que seguir sumando el total de la pantalla. */
    const creativo = f.creativo === '' ? '(anuncio sin nombre)' : f.creativo;

    const acc = porPieza.get(creativo) ?? nuevaFila(creativo);
    acc.anuncios += 1;
    acc.gasto = suma(acc.gasto, f.gasto);
    acc.impresiones = suma(acc.impresiones, f.impresiones);
    acc.clics = suma(acc.clics, f.clics);
    /* `f.diasConEntrega` NO se acumula acá: es el predicado del gasto y el grano del anuncio. Los
       días de la pieza los pone `volcarElDesglose` desde la consulta del desglose. Ver el campo. */
    porPieza.set(creativo, acc);
  }

  for (const fila of porPieza.values()) {
    const { gasto, impresiones, clics } = fila;
    fila.gasto = gasto === null ? null : redondear(gasto, 2);
    fila.cpm = gasto !== null && impresiones ? redondear((gasto / impresiones) * MIL_IMPRESIONES, 2) : null;
    fila.cpc = gasto !== null && clics ? redondear(gasto / clics, 4) : null;
    /* ── EL CTR TAMBIÉN ES UNA TASA SOBRE IMPRESIONES, Y SE LE HABÍA OLVIDADO EL PISO ──
       *
       * `PISO_DE_IMPRESIONES` se declara treinta líneas más arriba como *«cuántas impresiones hacen
       * falta antes de publicar una tasa cuyo denominador son impresiones»*, y las cuatro tasas del
       * desglose lo respetan. El CTR tiene ese mismo denominador y no lo respetaba.
       *
       * Medido el 2026-09-19 sobre los 30 días: **12 de 26 piezas** quedan por debajo, la más chica
       * con 122 impresiones — y **la de mayor CTR entre ellas da 5,816 %**, o sea que se dibujaba
       * arriba de todo como la mejor pieza del departamento con el equivalente a un puñado de
       * impresiones. Es el defecto contra el que la constante existe, en el único lugar donde no se
       * la había aplicado.
       *
       * Las impresiones y los clics **siguen viajando**: «no alcanza para una tasa» no es «no hay
       * dato», y quien mire la fila ve sobre qué base se decidió callar. */
    fila.ctr =
      impresiones !== null && impresiones >= PISO_DE_IMPRESIONES && clics !== null
        ? redondear((clics / impresiones) * 100, 3)
        : null;

    const d = desglose.get(fila.creativo);
    if (d) volcarElDesglose(fila, d);
  }

  const filas = [...porPieza.values()].sort((a, b) => (b.gasto ?? 0) - (a.gasto ?? 0));

  return {
    dias,
    desde: costo.desde,
    hasta: costo.hasta,
    desdeElDesglose,
    filas,
    gastoTotal: costo.gastoTotal,
    fueraDeAlcance: FUERA_DE_ALCANCE,
    titulos: TITULOS,
    aviso: avisoDe(filas, desdeElDesglose, costo.desde),
  };
}

function nuevaFila(creativo: string): FilaDeRendimiento {
  const vacia = (): TasaDeAccion => ({
    cantidad: null,
    tasa: null,
    anuncioDiasConLaClave: 0,
    anuncioDiasConEntrega: 0,
  });
  return {
    creativo,
    anuncios: 0,
    gasto: null,
    impresiones: null,
    clics: null,
    cpm: null,
    cpc: null,
    ctr: null,
    diasConEntrega: 0,
    hookRate: vacia(),
    linkCtr: vacia(),
    landingPageViewRate: vacia(),
    clickToLanding: vacia(),
    interaccion: vacia(),
  };
}

/**
 * Suma que conserva el nulo.
 *
 * `null + null` es `null` —ninguno de los anuncios de la pieza entregó— y `null + 3` es `3`. Un
 * `?? 0` acá haría que una pieza que nunca entregó publicara «gastó 0», que es una afirmación
 * distinta de «no se mostró».
 */
function suma(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return a + b;
}

interface DesgloseDeUnaPieza {
  /** Anuncio-día con impresiones: el denominador de la cobertura de cada tasa. */
  anuncioDias: number;
  /** Días de CALENDARIO con impresiones: lo que la pantalla llama «entregó N días». */
  dias: number;
  porClave: Map<Clave, { cantidad: number; impresiones: number; dias: number }>;
  /** El par de `clickToLanding`: los días que traen las DOS claves. */
  cruce: { landingPageView: number; linkClick: number; dias: number };
}

/**
 * Las sumas del desglose por pieza, con el denominador filtrado por la presencia de cada clave.
 *
 * Una consulta y no cuatro: los cuatro tipos viven en la misma fila, así que separarlos sería pedirle
 * cuatro veces lo mismo a la base y arriesgar que cada una vea un estado distinto de la tabla — el
 * barrido escribe todos los días.
 */
async function desglosePorCreativo(dias: number): Promise<Map<string, DesgloseDeUnaPieza>> {
  const llave = llaveDelCreativo('a.nombre');

  /* Por cada clave, TRES columnas: la suma de la acción, la suma de las impresiones **de los mismos
     días**, y cuántos días fueron. Sin la segunda, el denominador sería el de toda la ventana y la
     tasa saldría baja, plausible y falsa. */
  const columnas = (Object.keys(ACCIONES_QUE_LEEMOS) as Clave[]).flatMap((k) => [
    sql<string | null>`sum((m.acciones ->> ${k})::numeric) filter (where m.acciones ? ${k})`.as(`c_${k}`),
    sql<string | null>`sum(m.impresiones) filter (where m.acciones ? ${k})`.as(`i_${k}`),
    sql<number>`count(*) filter (where m.acciones ? ${k})`.as(`d_${k}`),
  ]);

  const filas = await datos()
    .selectFrom('metricas_de_anuncio as m')
    .innerJoin('anuncios as a', (j) =>
      // Por las DOS columnas, como en `costoDelAnuncio`: sin `org_id` de los dos lados una métrica
      // podría nombrarse con el anuncio de otro inquilino, y la política de fila no lo desmiente.
      j.onRef('a.org_id', '=', 'm.org_id').onRef('a.meta_anuncio_id', '=', 'm.meta_anuncio_id'),
    )
    .select([
      llave.as('creativo'),
      /* El denominador de la COBERTURA: días con impresiones, no con gasto. Son distintos —un día
         puede entregar con gasto nulo— y el que corresponde acá es el de las impresiones, porque es
         el denominador de todas estas tasas. */
      sql<number>`count(*) filter (where m.impresiones is not null)`.as('anuncioDias'),
      /* Y los días de CALENDARIO, que no son los mismos: una pieza corre en hasta seis anuncios, y
         el día en que dos de ellos entregan es UN día y DOS anuncio-día. El `distinct` es la única
         diferencia entre las dos líneas, y es la que separa «entregó 34 días» de una ventana de 30. */
      sql<number>`count(distinct m.fecha) filter (where m.impresiones is not null)`.as('dias'),
      ...columnas,
      /* El cruce de `clickToLanding` necesita los días que traen las DOS claves: dividir la suma de
         una por la suma de la otra sobre días distintos da una proporción entre dos poblaciones. */
      sql<string | null>`sum((m.acciones ->> 'landingPageView')::numeric)
        filter (where m.acciones ? 'landingPageView' and m.acciones ? 'linkClick')`.as('x_lpv'),
      sql<string | null>`sum((m.acciones ->> 'linkClick')::numeric)
        filter (where m.acciones ? 'landingPageView' and m.acciones ? 'linkClick')`.as('x_lc'),
      sql<number>`count(*) filter (
        where m.acciones ? 'landingPageView' and m.acciones ? 'linkClick')`.as('x_dias'),
    ])
    .where(ventanaDeMetricas('m', dias))
    /* El filtro va sobre la LLAVE y no sobre el nombre crudo: `coalesce(a.nombre,'') <> ''` deja
       pasar un nombre de sólo espacios, que normaliza a cadena vacía. Esa fila quedaría agrupada
       bajo la llave `''`, que del otro lado se rotula «(anuncio sin nombre)» — o sea que su
       desglose quedaría huérfano y la pieza saldría con gasto y sin ninguna tasa. Es la misma
       familia de defecto que la normalización doble que `creativo.ts` cierra. */
    .where(sql<boolean>`${llaveDelCreativo('a.nombre')} <> ''`)
    .groupBy(llave)
    .execute();

  const salida = new Map<string, DesgloseDeUnaPieza>();
  for (const f of filas) {
    const porClave = new Map<Clave, { cantidad: number; impresiones: number; dias: number }>();
    for (const k of Object.keys(ACCIONES_QUE_LEEMOS) as Clave[]) {
      const dias_ = Number((f as Record<string, unknown>)[`d_${k}`] ?? 0);
      if (dias_ === 0) continue;
      porClave.set(k, {
        cantidad: Number((f as Record<string, unknown>)[`c_${k}`] ?? 0),
        impresiones: Number((f as Record<string, unknown>)[`i_${k}`] ?? 0),
        dias: dias_,
      });
    }
    salida.set(f.creativo, {
      anuncioDias: Number(f.anuncioDias ?? 0),
      dias: Number(f.dias ?? 0),
      porClave,
      cruce: {
        landingPageView: Number(f.x_lpv ?? 0),
        linkClick: Number(f.x_lc ?? 0),
        dias: Number(f.x_dias ?? 0),
      },
    });
  }
  return salida;
}

function volcarElDesglose(fila: FilaDeRendimiento, d: DesgloseDeUnaPieza): void {
  // Los días de la pieza salen de ACÁ, no de sumar los de sus anuncios. Ver el campo.
  fila.diasConEntrega = d.dias;

  const sobreImpresiones = (k: Clave): TasaDeAccion => {
    const v = d.porClave.get(k);
    /* Sin ningún día con la clave, la tasa es NULA y no cero. La diferencia es la que separa «esta
       pieza no es un video» de «nadie la reprodujo», y publicarlas igual arrastra el promedio de
       las piezas de video hacia abajo con las estáticas. */
    if (!v) {
      return { cantidad: null, tasa: null, anuncioDiasConLaClave: 0, anuncioDiasConEntrega: d.anuncioDias };
    }
    return {
      cantidad: v.cantidad,
      tasa:
        v.impresiones >= PISO_DE_IMPRESIONES
          ? redondear((v.cantidad / v.impresiones) * 100, 2)
          : null,
      anuncioDiasConLaClave: v.dias,
      anuncioDiasConEntrega: d.anuncioDias,
    };
  };

  fila.hookRate = sobreImpresiones('videoView');
  fila.linkCtr = sobreImpresiones('linkClick');
  fila.landingPageViewRate = sobreImpresiones('landingPageView');
  fila.interaccion = sobreImpresiones('postEngagement');

  /* El click-to-landing tiene otro denominador —clics al enlace, que son eventos contables— así que
     su piso es el de los eventos y no el de las impresiones.
     *
     * **Y ese piso no estaba puesto**: el comentario lo afirmaba y el código sólo exigía `> 0`.
     * Medido el 2026-09-19: de las 24 piezas con cruce, **8 tienen menos de diez clics al enlace y
     * la más chica tiene UNO** — o sea que la pantalla habría publicado un 100 % sobre un solo clic
     * al lado de un 64 % construido sobre mil. Es el defecto que `PISO_DE_UNA_TASA` existe para
     * evitar, y se usa ESE y no uno nuevo: dos pisos distintos para la misma regla divergen sin que
     * nada falle, que es lo que su propio comentario dejó escrito.
     *
     * Y PUEDE PASAR DE 100 %: Meta puede contar una vista de landing de un clic de otro día. Si
     * pasa, se dice; no se topa. Toparlo esconde el desajuste de atribución, que es justamente lo
     * que esta cifra sirve para ver. */
  fila.clickToLanding = {
    cantidad: d.cruce.dias === 0 ? null : d.cruce.landingPageView,
    tasa:
      d.cruce.linkClick >= PISO_DE_UNA_TASA && d.cruce.dias > 0
        ? redondear((d.cruce.landingPageView / d.cruce.linkClick) * 100, 1)
        : null,
    anuncioDiasConLaClave: d.cruce.dias,
    anuncioDiasConEntrega: d.anuncioDias,
  };
}

/** El primer día de la ventana que tiene desglose. Distinto del primer día con gasto. */
async function primerDiaConDesglose(dias: number): Promise<string | null> {
  const f = await datos()
    .selectFrom('metricas_de_anuncio as m')
    .select(sql<string | null>`min(m.fecha)::text`.as('d'))
    .where(ventanaDeMetricas('m', dias))
    .where(sql<boolean>`m.acciones is not null`)
    .executeTakeFirst();

  return f?.d ?? null;
}

/**
 * El aviso. **`null` ⟹ la pantalla no dibuja nada.**
 *
 * El orden es el mismo criterio que `costoDelAnuncio`: primero lo que describe mal a la ventana
 * entera, después lo que recorta una cifra.
 */
function avisoDe(
  filas: FilaDeRendimiento[],
  desdeElDesglose: string | null,
  desdeElGasto: string | null,
): string | null {
  const partes: string[] = [];

  /* ── LAS DOS VENTANAS SE DICEN UNA SOLA VEZ, Y NO ES ACÁ ────────────────────
   *
   * Acá había dos ramas que armaban la frase de las dos ventanas. **Y la pantalla ya la dice**, en
   * el bloque de cobertura (`PanelDeCreative.jsx`, «Las DOS ventanas, dichas»), con las tres
   * fechas en formato corto y con su propia rama para el caso sin desglose.
   *
   * O sea que el mismo hecho se dibujaba dos veces en la misma pantalla: una en `21 ago` y otra en
   * `2026-08-21`. Dos formas del mismo dato se leen como dos datos, y quien las compare va a buscar
   * cuál de las dos ventanas es la buena. Es el mismo defecto que ya se corrigió con la frase de
   * las citas congeladas, que también se dibujaba en dos lugares.
   *
   * Lo que se conserva es el CAMPO `desdeElDesglose`, que es lo que la pantalla lee para armar la
   * frase. El aviso es para lo que nada más dice — y de eso queda la definición de `videoView`. */

  /* La definición de `videoView`, que el proveedor no documenta. Se dice una vez y siempre, no por
     fila: es una propiedad de la fuente, no de ninguna pieza. Sin esto, alguien reescribe un gancho
     por un número que quizá cuenta ThruPlays. */
  if (filas.some((f) => f.hookRate.cantidad !== null)) {
    partes.push(
      'El hook rate cuenta las reproducciones que Meta reporta; el proveedor no documenta si son ' +
        'las de tres segundos.',
    );
  }

  return partes.length === 0 ? null : partes.join(' ');
}
