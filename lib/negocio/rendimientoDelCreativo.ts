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
// El desglose NO viene en todas las filas. Medido sobre 24 días de producción: `videoView` en 224 de
// 266 filas anuncio-día con entrega, `linkClick` en 171, `landingPageView` en 150.
//
// Sumar el numerador sobre el 56 % de los días y el denominador sobre el 100 % da una tasa
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
import { DIAS_DE_LA_TASA } from './indicadoresDeCitas.ts';
import { costoDelAnuncio, ventanaDeMetricas } from './costoDelAnuncio.ts';

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
 * Medido el 2026-09-19 sobre 24 días de producción: con mil, catorce piezas publican hook rate; el
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
  videoView: { titulo: 'Reproducciones que Meta contó', coberturaMedida: 0.84 },
  linkClick: { titulo: 'Clics al enlace', coberturaMedida: 0.64 },
  landingPageView: { titulo: 'Vistas de la landing', coberturaMedida: 0.56 },
  postEngagement: { titulo: 'Interacciones con la publicación', coberturaMedida: 0.9 },
} as const;

/**
 * Una tasa construida sobre el desglose, con la cobertura de su propio numerador.
 *
 * Los cuatro campos viajan siempre. `tasa` sin `diasConLaClave` se lee como si hablara de toda la
 * ventana, y no habla: habla de los días en que el proveedor reportó esa acción.
 */
export interface TasaDeAccion {
  /** La suma del tipo de acción sobre los días que TRAÍAN la clave. `null` = ningún día la trajo. */
  cantidad: number | null;
  /** La tasa, en porcentaje. `null` sin denominador suficiente. **Nunca cero por ausencia.** */
  tasa: number | null;
  /** Días anuncio-día de esta pieza en los que el proveedor reportó esta acción. */
  diasConLaClave: number;
  /** Días anuncio-día de esta pieza con impresiones. El denominador de la cobertura. */
  diasConEntrega: number;
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
  aviso: string | null;
}

type Clave = keyof typeof ACCIONES_QUE_LEEMOS;

/** La llave de agrupación del departamento. La MISMA que `calidadDelCreativo`. */
function llaveDelCreativo(columna: string) {
  return sql<string>`lower(btrim(${sql.raw(columna)}))`;
}

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
    const clave = (f.nombre ?? '').trim().toLowerCase();
    /* Un anuncio sin nombre no puede agruparse por nombre. No se descarta en silencio: cae en su
       propia fila, rotulada, porque su gasto es real y tiene que seguir sumando el total. */
    const creativo = clave === '' ? '(anuncio sin nombre)' : clave;

    const acc = porPieza.get(creativo) ?? nuevaFila(creativo);
    acc.anuncios += 1;
    acc.gasto = suma(acc.gasto, f.gasto);
    acc.impresiones = suma(acc.impresiones, f.impresiones);
    acc.clics = suma(acc.clics, f.clics);
    acc.diasConEntrega += f.diasConEntrega;
    porPieza.set(creativo, acc);
  }

  for (const fila of porPieza.values()) {
    const { gasto, impresiones, clics } = fila;
    fila.gasto = gasto === null ? null : redondear(gasto, 2);
    fila.cpm = gasto !== null && impresiones ? redondear((gasto / impresiones) * MIL_IMPRESIONES, 2) : null;
    fila.cpc = gasto !== null && clics ? redondear(gasto / clics, 4) : null;
    fila.ctr = impresiones && clics !== null ? redondear((clics / impresiones) * 100, 3) : null;

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
    aviso: avisoDe(filas, desdeElDesglose, costo.desde),
  };
}

function nuevaFila(creativo: string): FilaDeRendimiento {
  const vacia = (): TasaDeAccion => ({ cantidad: null, tasa: null, diasConLaClave: 0, diasConEntrega: 0 });
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
  diasConEntrega: number;
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
      sql<number>`count(*) filter (where m.impresiones is not null)`.as('diasConEntrega'),
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
    .where(sql<boolean>`coalesce(a.nombre, '') <> ''`)
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
      diasConEntrega: Number(f.diasConEntrega ?? 0),
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
  const sobreImpresiones = (k: Clave): TasaDeAccion => {
    const v = d.porClave.get(k);
    /* Sin ningún día con la clave, la tasa es NULA y no cero. La diferencia es la que separa «esta
       pieza no es un video» de «nadie la reprodujo», y publicarlas igual arrastra el promedio de
       las piezas de video hacia abajo con las estáticas. */
    if (!v) return { cantidad: null, tasa: null, diasConLaClave: 0, diasConEntrega: d.diasConEntrega };
    return {
      cantidad: v.cantidad,
      tasa:
        v.impresiones >= PISO_DE_IMPRESIONES
          ? redondear((v.cantidad / v.impresiones) * 100, 2)
          : null,
      diasConLaClave: v.dias,
      diasConEntrega: d.diasConEntrega,
    };
  };

  fila.hookRate = sobreImpresiones('videoView');
  fila.linkCtr = sobreImpresiones('linkClick');
  fila.landingPageViewRate = sobreImpresiones('landingPageView');
  fila.interaccion = sobreImpresiones('postEngagement');

  /* El click-to-landing tiene otro denominador —clics al enlace, que son eventos contables— así que
     su piso es el de los eventos y no el de las impresiones.
     *
     * Y PUEDE PASAR DE 100 %: Meta puede contar una vista de landing de un clic de otro día. Si
     * pasa, se dice; no se topa. Toparlo esconde el desajuste de atribución, que es justamente lo
     * que esta cifra sirve para ver. */
  fila.clickToLanding = {
    cantidad: d.cruce.dias === 0 ? null : d.cruce.landingPageView,
    tasa:
      d.cruce.linkClick > 0 && d.cruce.dias > 0
        ? redondear((d.cruce.landingPageView / d.cruce.linkClick) * 100, 1)
        : null,
    diasConLaClave: d.cruce.dias,
    diasConEntrega: d.diasConEntrega,
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

  if (desdeElDesglose === null) {
    partes.push(
      'Todavía no hay ningún día con el desglose de acciones guardado, así que el hook rate y las ' +
        'tasas de enlace no se pueden calcular.',
    );
  } else if (desdeElGasto !== null && desdeElDesglose > desdeElGasto) {
    /* Las DOS ventanas, dichas. Sin esto la pantalla afirma que el hook rate habla de treinta días
       cuando habla de los que alcanzó el relleno. */
    partes.push(
      `El gasto va desde el ${desdeElGasto} y el desglose de acciones sólo desde el ` +
        `${desdeElDesglose}: las tasas de video y de enlace hablan de menos días que el dinero.`,
    );
  }

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
