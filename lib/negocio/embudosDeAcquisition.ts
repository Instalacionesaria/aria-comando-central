// Los tres funnels de Acquisition, con los datos reales: lo que dibuja el front del prototipo.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ ES, Y DE DÓNDE SALE CADA CIFRA
//
// El front que vuelve el 2026-09-30 (`docs/acquisition/14-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`)
// reparte las campañas en tres funnels y, para cada uno, dibuja una cadena de etapas con su tasa, su
// costo y su variación contra la ventana anterior. Este módulo arma todo eso en el servidor, por
// campaña y por funnel. El navegador no calcula nada: dibuja lo que llega, igual que antes
// (`lib/negocio/vistaDeAcquisition.ts`).
//
//   · inversión y clics: `negocio.metricas_de_anuncio`, sumado por `anuncios.meta_campana_id`. La inversión
//     del TOTAL es la de toda la cuenta (`negocio.gasto_de_la_cuenta`, `076`), igual al Administrador de
//     anuncios; los costos de personas se pagan sólo con la de las campañas que traen contactos (A14-19);
//   · contactos: los que traen esa campaña en `atribucion_primera->>'campaignId'`, dados de alta en la
//     ventana (A14-04);
//   · agendados: `tieneCitaAlcanzable`; calificados: `esCalificado`, agendados sin descarte (A14-07);
//   · ICP: el puntaje de los calificados, con los cortes de `tramosDelIcp.ts` (A14-08);
//   · el funnel de cada campaña: `negocio.funnels_de_campana`, asignado a mano (A14-03);
//   · el nombre y el estado: `negocio.campanas` (A14-13).
//
// ── POR QUÉ EL SERVIDOR CALCULA LAS TASAS, Y NO EL NAVEGADOR ──────────────
//
// El prototipo calculaba tasas y deltas en el navegador. Acá no se puede: el piso de las tasas,
// `PISO_DE_UNA_TASA`, vive en `indicadoresDeCitas.ts`, que importa la base, y un módulo del navegador
// que lo importara arrastraría el cliente de PostgreSQL al paquete (`periodo.ts` cuenta cuándo pasó).
// Copiar el número sería una segunda definición del mismo piso (A14-17).
//
// ── LAS VENTANAS: DÍAS CERRADOS, Y HOY APARTE ─────────────────────────────
//
// Decidido por el usuario el 2026-09-30, después de la revisión de AQ-3 (A14-10):
//
//   · **«7 días» y «30 días» son días CERRADOS**: los `dias` días completos hasta el último día que el
//     colector ya releyó DESPUÉS de que terminó, como en el Administrador de anuncios de Meta. El gasto de
//     un día se lee a las 06:17 UTC de ese día —en la hora de la cuenta casi no empezó— y se relee a la
//     misma hora del día siguiente, así que **ayer recién está cerrado después de la pasada de hoy**, y
//     si se perdió una pasada, anteayer tampoco. Se busca el último día releído después de la medianoche
//     de la empresa (su `zona_horaria`, la mejor aproximación a la de la cuenta de Meta, que la API no
//     dice), y la ventana se exige con TODOS sus días cerrados; si el colector está atrasado —no
//     escribe, o escribe sin cerrar días—, no se compara (lo encontraron la segunda a la quinta revisión
//     de AQ-3). Una ventana con un día a medias compararía seis días y medio contra siete: la flecha
//     bajaría siempre, en rojo, con el negocio igual;
//   · **«Hoy» es hoy**, a medias: no compara y no publica costos, porque su gasto es una foto de la
//     madrugada y sus contactos son del día entero;
//   · **«Completo» es todo lo guardado**: empieza en el primer dato —gasto o contacto con campaña, el
//     que sea más viejo— y termina hoy. No compara, y su gasto se exige entero hasta el último día
//     cerrado: hoy, a medias, no cuenta para eso.
//
// Los costos se publican sólo si el gasto de la ventana está entero: con un día sin gasto, o con
// contactos de antes del primer gasto guardado, el costo por contacto saldría bajo y se leería como
// un dato. Por qué no hay costos viaja en `sinCostos`.
//
// La ventana anterior es la del mismo largo, justo antes, y se compara sólo si los datos la describen
// entera (A14-11). Sin esa guarda, una ventana anterior guardada a medias achica el denominador, y la
// flecha sube contra días que nadie guardó.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';

import { datos } from '../datos/contexto.ts';
import { esCalificado, tieneCitaAlcanzable } from './citasAlcanzables.ts';
import { bordesDelPeriodo } from './diasCerrados.ts';
import { coberturaDelGasto, type MotivoDelGasto } from './gastoDeLaCuenta.ts';
import { cohorteEntre } from './recorrido.ts';
import { funnelsDeLasCampanas, FUNNELS, type Funnel } from './funnelDeLaCampana.ts';
import { PISO_DE_UNA_TASA } from './indicadoresDeCitas.ts';
import type { ClaveDePeriodo } from './periodo.ts';
import { UMBRAL_ALTO, UMBRAL_MEDIO } from './tramosDelIcp.ts';

// ─── La forma ───────────────────────────────────────────────────────────────

/** Las etapas del prototipo. `forms` es sólo de Booking directo. */
export type Etapa = 'contactos' | 'forms' | 'clics' | 'agendados';

/** Un funnel, «Sin funnel» o el total de la pantalla. */
export type ClaveDeGrupo = Funnel | 'sin_funnel' | 'total';

/**
 * Qué etapas tiene cada grupo, en orden. Las del prototipo (`aios-command-center_1.html`, `FUNNELS`):
 * Booking directo tiene la del formulario entre la entrada y la landing. «Sin funnel» y el total
 * usan la cadena corta, que es la de las cinco cifras de arriba.
 */
export const ETAPAS: Readonly<Record<ClaveDeGrupo, readonly Etapa[]>> = {
  leadform: ['contactos', 'clics', 'agendados'],
  profile: ['contactos', 'clics', 'agendados'],
  booking: ['contactos', 'forms', 'clics', 'agendados'],
  sin_funnel: ['contactos', 'clics', 'agendados'],
  total: ['contactos', 'clics', 'agendados'],
};

/** Los números crudos de una campaña o de un grupo, en UNA ventana. Se suman; no se promedian. */
export interface Cifras {
  inversion: number;
  /**
   * La inversión de las campañas que trajeron algún contacto atribuido, alguna vez (A14-19). Es el único
   * numerador de los costos de personas —por contacto, por agendado, por calificado—: una campaña de mensajes,
   * cuyos contactos llegan sin `campaignId`, no puede inflar el costo por contacto de las demás.
   */
  inversionConContactos: number;
  /**
   * El gasto de las filas CON desglose de acciones, que es de donde salen los clics. El costo por clic
   * divide esto y no la inversión entera: las filas sin desglose gastaron, pero sus clics no se saben.
   */
  inversionConDesglose: number;
  /**
   * `null` = hubo entrega en la ventana y ningún desglose de acciones de Meta: los clics no se saben. Si
   * nada entregó, son CERO —el proveedor omite el desglose cuando el anuncio no entregó, y sin entrega
   * no hay clics—. Sin ninguna fila en la ventana, también `null`: de esa campaña no se guardó nada.
   */
  clics: number | null;
  contactos: number;
  agendados: number;
  calificados: number;
  /** El reparto de los calificados. Los cuatro suman `calificados`. */
  alto: number;
  medio: number;
  bajo: number;
  sinCalificar: number;
  /** Para el promedio del ICP: la suma y la cantidad de puntajes mayores que cero. */
  sumaDePuntajes: number;
  conPuntaje: number;
}

export const CIFRAS_VACIAS: Readonly<Cifras> = {
  inversion: 0,
  inversionConContactos: 0,
  inversionConDesglose: 0,
  clics: null,
  contactos: 0,
  agendados: 0,
  calificados: 0,
  alto: 0,
  medio: 0,
  bajo: 0,
  sinCalificar: 0,
  sumaDePuntajes: 0,
  conPuntaje: 0,
};

/**
 * Cómo se movió una cifra contra la ventana anterior.
 *
 * `lectura` es el color, y no depende sólo de la flecha: en la Inversión subir no es bueno ni malo
 * (A14-11). Llega calculada para que el navegador no tenga una segunda tabla de qué es bueno.
 */
export type Variacion =
  | { tipo: 'sin_comparacion' }
  | { tipo: 'igual' }
  | { tipo: 'sube' | 'baja'; porcentaje: number; lectura: 'buena' | 'mala' | 'neutra' };

export interface EtapaDelGrupo {
  etapa: Etapa;
  /**
   * `null` en una etapa sin dato: `forms`, siempre (A14-06); `clics`, si hubo entrega sin ningún
   * desglose, si no hay filas, o si el desglose no cubre la ventana (A14-05).
   */
  valor: number | null;
  /** `true` en `clics`: la cuenta Meta, no son personas, y por eso no lleva tasa (A14-05). */
  deMeta: boolean;
  /**
   * Contra la etapa de PERSONAS anterior con dato. `null` en la entrada, en `clics` y bajo el piso.
   *
   * **Una sola tasa, y no las dos del prototipo.** El segmentado «Paso a paso / Acumulada» divide
   * por la etapa anterior o por la entrada; con los clics fuera —no son personas— y el formulario sin
   * dato, la etapa anterior de personas es siempre la entrada, y las dos tasas darían el mismo número.
   * El usuario decidió el 2026-09-30 no dibujar el segmentado hasta que haya una etapa que las haga
   * diferir; ese día vuelve la acumulada (A14-09).
   */
  tasa: number | null;
  /**
   * Inversión dividida por la etapa —la de los clics, por el gasto con desglose; la de personas, por la
   * inversión con contactos (A14-19)—. `null` sin inversión, sin etapa, en «Hoy», o si el gasto de la ventana
   * no está entero (A14-09; el motivo, en `sinCostos`).
   */
  costo: number | null;
  variacion: Variacion;
}

export interface CalificadosDelGrupo {
  valor: number;
  /**
   * **Siempre «sin comparación», por ahora.** Los agendados de la ventana anterior se cuentan a la
   * misma edad (`reservada_el`), pero el descarte no tiene fecha —es una etiqueta—, así que la
   * anterior tuvo días de más para recibirlo y sus calificados saldrían más bajos: la flecha subiría
   * siempre, en verde, con el negocio igual. Lo encontró la segunda revisión de AQ-3. Vuelve el día que
   * se guarde cuándo se pone cada etiqueta de descarte (A14-11).
   */
  variacion: Variacion;
  /** Calificados sobre agendados, con el piso. */
  tasa: number | null;
  costo: number | null;
  icp: {
    alto: number;
    medio: number;
    bajo: number;
    sinCalificar: number;
    /** El promedio del puntaje de los calificados con puntaje; `null` bajo el piso (A14-08). */
    promedio: number | null;
  };
}

export interface Grupo {
  clave: ClaveDeGrupo;
  campanas: number;
  /** Cuántas de esas campañas gastaron en la ventana. */
  conGasto: number;
  inversion: number;
  /**
   * La parte de la inversión que no paga ningún costo de personas: la de las campañas sin contactos atribuidos
   * y, en el total, la que la cuenta cobró sin que ninguna campaña leída la explique (A14-19).
   */
  inversionSinContactos: number;
  variacionDeInversion: Variacion;
  etapas: EtapaDelGrupo[];
  calificados: CalificadosDelGrupo;
}

export interface CampanaDeAcquisition {
  /** El identificador de Meta. La llave es ésta y nunca el nombre (A1-10). */
  campana: string;
  /** `null` si GoHighLevel no la listó o no mandó nombre: la pantalla dibuja el identificador. */
  nombre: string | null;
  estado: string | null;
  /** Si GoHighLevel la listó (`065`). Sólo una conocida se puede asignar a un funnel (`066`). */
  conocida: boolean;
  /**
   * Si alguna vez trajo un contacto con su `campaignId` en la atribución. Sin eso, sus etapas de personas se
   * dibujan «—» y no 0: no se sabe cuánta gente trajo (A14-19).
   */
  conContactos: boolean;
  funnel: Funnel | null;
  cifras: Grupo;
}

/**
 * Por qué no hay flechas:
 *
 *   · `periodo`: «Hoy» y «Completo» no comparan, como en el prototipo;
 *   · `sin_historia`: los datos no describen la ventana anterior entera —empiezan después, o le falta
 *     algún día de gasto—;
 *   · `faltan_dias`: a la ventana ACTUAL le falta algún día de gasto cerrado —y su inversión saldría
 *     baja—, o el colector está atrasado: no escribe hace más de 26 horas, o su último día cerrado
 *     quedó más de tres días atrás. En ese caso tampoco hay costos.
 */
export type SinComparacion = 'periodo' | 'sin_historia' | 'faltan_dias';

/**
 * Por qué no hay costos: `hoy`, porque el gasto de hoy es una foto de la madrugada; `gasto_incompleto`,
 * porque a la ventana le falta algún día de gasto cerrado, porque tiene contactos de antes del primer
 * gasto, o porque el colector está atrasado (ver `SinComparacion`).
 */
export type SinCostos = 'hoy' | 'gasto_incompleto';

export interface EmbudosDeAcquisition {
  ventana: { desde: string; hasta: string };
  anterior: { desde: string; hasta: string } | null;
  sinComparacion: SinComparacion | null;
  sinCostos: SinCostos | null;
  /**
   * El gasto de la ventana según la cuenta (`076`):
   *
   *   · `deLaCuenta`: lo que Meta cobró en toda la cuenta, que es la inversión del total. `null` si a algún día
   *     de la ventana le falta el total de la cuenta: entonces el total suma lo leído por campaña;
   *   · `motivo`: por qué el gasto no está entero, o `null`. `no_cuadra` es «falta gasto de algunas campañas»:
   *     la cuenta dice más de lo que se alcanzó a leer por campaña, y el relleno lo está buscando.
   */
  gasto: { deLaCuenta: number | null; motivo: MotivoDelGasto | null };
  total: Grupo;
  funnels: Record<Funnel, Grupo>;
  sinFunnel: Grupo;
  /** Las campañas, ordenadas por inversión y después por contactos (A14-18). */
  campanas: CampanaDeAcquisition[];
  /** Cuántos contactos de la ventana traen campaña, sobre el total (A14-12). */
  cobertura: { conCampana: number; sobre: number };
}

// ─── Las cuentas, puras ─────────────────────────────────────────────────────

/** Una proporción con el piso de siempre en el denominador. `null` debajo del piso o sin dato. */
export function tasa(numerador: number | null, denominador: number | null): number | null {
  if (numerador === null || denominador === null || denominador < PISO_DE_UNA_TASA) return null;
  return numerador / denominador;
}

/**
 * Cuánto costó cada unidad de una etapa. `null` si la etapa no tiene dato o está en cero, y también si
 * la ventana no gastó nada: con la pauta parada, «$0 por contacto» diría que los contactos salieron
 * gratis, cuando lo que pasa es que llegaron de lo que se gastó antes (A14-09).
 */
export function costo(inversion: number, cantidad: number | null): number | null {
  if (inversion <= 0 || cantidad === null || cantidad <= 0) return null;
  return inversion / cantidad;
}

/** Qué quiere decir que una cifra suba. Sólo la Inversión es neutra (A14-11). */
export type Sentido = 'mas_es_mejor' | 'neutro';

/**
 * La variación contra la ventana anterior, con las reglas del prototipo y las de A14-11:
 *
 *   · sin ventana anterior, o con la cifra sin dato en alguna de las dos → «sin comparación»;
 *   · con la anterior en cero → «sin comparación»: no hay porcentaje contra cero. El prototipo se
 *     guardaba también de la actual en cero (`if(!prev || !cur)`), y así una caída a cero no tenía
 *     flecha; A5-16 de `05` pide la guarda del denominador y no la del numerador;
 *   · bajo 0,5 % → «=» (`aios-command-center_1.html:5469`).
 */
export function variacion(actual: number | null, anterior: number | null | undefined, sentido: Sentido): Variacion {
  if (anterior === undefined || anterior === null || actual === null || anterior === 0) {
    return { tipo: 'sin_comparacion' };
  }
  const d = (actual - anterior) / anterior;
  if (Math.abs(d) < 0.005) return { tipo: 'igual' };
  const tipo = d > 0 ? 'sube' : 'baja';
  const lectura = sentido === 'neutro' ? 'neutra' : tipo === 'sube' ? 'buena' : 'mala';
  return { tipo, porcentaje: Math.abs(d), lectura };
}

/** Suma dos cifras. Los clics siguen siendo `null` sólo si los dos lo son. */
export function sumar(a: Cifras, b: Cifras): Cifras {
  return {
    inversion: a.inversion + b.inversion,
    inversionConContactos: a.inversionConContactos + b.inversionConContactos,
    inversionConDesglose: a.inversionConDesglose + b.inversionConDesglose,
    clics: a.clics === null && b.clics === null ? null : (a.clics ?? 0) + (b.clics ?? 0),
    contactos: a.contactos + b.contactos,
    agendados: a.agendados + b.agendados,
    calificados: a.calificados + b.calificados,
    alto: a.alto + b.alto,
    medio: a.medio + b.medio,
    bajo: a.bajo + b.bajo,
    sinCalificar: a.sinCalificar + b.sinCalificar,
    sumaDePuntajes: a.sumaDePuntajes + b.sumaDePuntajes,
    conPuntaje: a.conPuntaje + b.conPuntaje,
  };
}

/** El valor de una etapa en unas cifras. `forms` no tiene dato: el campo dejó de escribirse (A14-06). */
function valorDe(etapa: Etapa, c: Cifras): number | null {
  if (etapa === 'contactos') return c.contactos;
  if (etapa === 'agendados') return c.agendados;
  if (etapa === 'clics') return c.clics;
  return null;
}

/**
 * Un grupo —una campaña, un funnel o el total— con sus etapas calculadas.
 *
 * @param anterior Las cifras de la ventana anterior, o `null` si no se compara.
 * @param conCostos `false` en «Hoy» —el gasto de hoy es una foto de la madrugada— y cuando el gasto de
 *   la ventana no está entero (A14-09).
 */
export function armarGrupo(
  clave: ClaveDeGrupo,
  etapas: readonly Etapa[],
  actual: Cifras,
  anterior: Cifras | null,
  campanas: number,
  conCostos = true,
  /** Cuántas campañas del grupo gastaron. Por omisión, una si gastó: el grupo de una sola campaña. */
  conGasto = actual.inversion > 0 ? 1 : 0,
): Grupo {
  const calculadas: EtapaDelGrupo[] = [];
  /* La etapa de personas anterior con dato: contra ella se mide la tasa. Se salta `clics` —son
     clics, no personas— y `forms`, que no tiene dato. */
  let anteriorDePersonas: number | null = null;
  const costoDe = (inversion: number, cantidad: number | null) => (conCostos ? costo(inversion, cantidad) : null);

  etapas.forEach((etapa, i) => {
    const valor = valorDe(etapa, actual);
    const deMeta = etapa === 'clics';
    calculadas.push({
      etapa,
      valor,
      deMeta,
      tasa: i === 0 || deMeta ? null : tasa(valor, anteriorDePersonas),
      /* Los clics se pagan con el gasto de las filas que los cuentan; las personas, con el de las campañas que
         traen contactos (A14-19). */
      costo: costoDe(deMeta ? actual.inversionConDesglose : actual.inversionConContactos, valor),
      variacion: variacion(valor, anterior === null ? null : valorDe(etapa, anterior), 'mas_es_mejor'),
    });
    if (!deMeta && valor !== null) anteriorDePersonas = valor;
  });

  return {
    clave,
    campanas,
    conGasto,
    inversion: actual.inversion,
    inversionSinContactos: Math.max(0, Math.round((actual.inversion - actual.inversionConContactos) * 100) / 100),
    variacionDeInversion: variacion(actual.inversion, anterior?.inversion, 'neutro'),
    etapas: calculadas,
    calificados: {
      valor: actual.calificados,
      variacion: { tipo: 'sin_comparacion' },
      tasa: tasa(actual.calificados, actual.agendados),
      costo: costoDe(actual.inversionConContactos, actual.calificados),
      icp: {
        alto: actual.alto,
        medio: actual.medio,
        bajo: actual.bajo,
        sinCalificar: actual.sinCalificar,
        promedio: actual.conPuntaje >= PISO_DE_UNA_TASA ? actual.sumaDePuntajes / actual.conPuntaje : null,
      },
    },
  };
}

/** Una campaña del universo, con lo que se sabe de ella. */
export interface CampanaConocida {
  campana: string;
  nombre: string | null;
  estado: string | null;
  conocida: boolean;
  conContactos: boolean;
  funnel: Funnel | null;
}

/**
 * Todo lo de la pantalla, a partir de las filas leídas. **Puro**: no toca la base.
 *
 * Las campañas se reparten por funnel; las que no tienen, van a «Sin funnel». Las cinco cifras de
 * arriba son el total de TODAS, con o sin funnel: suman todo lo que la pauta trajo (A14-14).
 */
export function armarEmbudos(entrada: {
  ventana: { desde: string; hasta: string };
  anterior: { desde: string; hasta: string } | null;
  sinComparacion: SinComparacion | null;
  campanas: readonly CampanaConocida[];
  actual: ReadonlyMap<string, Cifras>;
  /** `null` cuando no se compara. Una campaña que no aparece acá tuvo cero en la anterior. */
  previa: ReadonlyMap<string, Cifras> | null;
  cobertura: { conCampana: number; sobre: number };
  /** Por qué no hay costos, o `null` si los hay. */
  sinCostos: SinCostos | null;
  /**
   * El total de la cuenta en la ventana y en la anterior (`null` si le falta algún día), y por qué el gasto no
   * está entero. Sin esto —las pruebas puras—, el total es la suma de las campañas.
   */
  gasto?: { deLaCuenta: number | null; deLaCuentaAnterior: number | null; motivo: MotivoDelGasto | null };
}): EmbudosDeAcquisition {
  const deLa = (m: ReadonlyMap<string, Cifras>, c: string) => m.get(c) ?? CIFRAS_VACIAS;

  const campanas = entrada.campanas.map((c) => {
    const actual = deLa(entrada.actual, c.campana);
    const anterior = entrada.previa === null ? null : deLa(entrada.previa, c.campana);
    const clave = c.funnel ?? 'sin_funnel';
    return { ...c, actual, anterior, cifras: armarGrupo(clave, ETAPAS[clave], actual, anterior, 1, entrada.sinCostos === null) };
  });

  // A14-18: el orden lo da el gasto, que es un hecho; el desempate, la gente y después el
  // identificador, para que dos campañas iguales no cambien de lugar entre lecturas.
  campanas.sort(
    (a, b) =>
      b.actual.inversion - a.actual.inversion ||
      b.actual.contactos - a.actual.contactos ||
      a.campana.localeCompare(b.campana),
  );

  function grupo(clave: ClaveDeGrupo, cuales: typeof campanas): Grupo {
    const actual = cuales.reduce((s, c) => sumar(s, c.actual), CIFRAS_VACIAS);
    const anterior =
      entrada.previa === null ? null : cuales.reduce((s, c) => sumar(s, c.anterior ?? CIFRAS_VACIAS), CIFRAS_VACIAS);
    const conGasto = cuales.filter((c) => c.actual.inversion > 0).length;
    return armarGrupo(clave, ETAPAS[clave], actual, anterior, cuales.length, entrada.sinCostos === null, conGasto);
  }

  /* ── LA INVERSIÓN DEL TOTAL ES LA DE LA CUENTA (A14-19) ────────────────────
     Lo que Meta cobró, de todas las campañas, crucen o no con contactos: igual al Administrador de anuncios. La
     suma por campaña queda por debajo mientras el relleno busca qué campaña gastó, o si un día es residuo (gasto
     de una campaña que la cuenta ya no lista). Los costos de personas no cambian: se pagan con la inversión con
     contactos, que sale de las campañas. Lo que la cuenta cobró de más va a `inversionSinContactos`. */
  const total = grupo('total', campanas);
  const deLaCuenta = entrada.gasto?.deLaCuenta ?? null;
  if (deLaCuenta !== null) {
    const anterior = entrada.gasto?.deLaCuentaAnterior ?? null;
    total.inversion = deLaCuenta;
    total.inversionSinContactos = Math.max(
      0,
      Math.round((deLaCuenta - campanas.reduce((s, c) => s + c.actual.inversionConContactos, 0)) * 100) / 100,
    );
    total.variacionDeInversion =
      entrada.previa === null ? { tipo: 'sin_comparacion' } : variacion(deLaCuenta, anterior, 'neutro');
  }

  const funnels = Object.fromEntries(
    FUNNELS.map((f) => [f, grupo(f, campanas.filter((c) => c.funnel === f))]),
  ) as Record<Funnel, Grupo>;

  return {
    ventana: entrada.ventana,
    anterior: entrada.anterior,
    sinComparacion: entrada.sinComparacion,
    sinCostos: entrada.sinCostos,
    gasto: { deLaCuenta, motivo: entrada.gasto?.motivo ?? null },
    total,
    funnels,
    sinFunnel: grupo('sin_funnel', campanas.filter((c) => c.funnel === null)),
    campanas: campanas.map(({ campana, nombre, estado, conocida, conContactos, funnel, cifras }) => ({
      campana,
      nombre,
      estado,
      conocida,
      conContactos,
      funnel,
      cifras,
    })),
    cobertura: entrada.cobertura,
  };
}

// ─── La lectura ─────────────────────────────────────────────────────────────

/** Un identificador de campaña de verdad: dígitos. Saca `{{campaign.id}}`, la plantilla sin expandir. */
const CAMPANA_NUMERICA = '^[0-9]+$';

const n = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

/**
 * Las cifras de cada campaña en una ventana `[desde, hasta]` de días de calendario, los dos incluidos.
 *
 * @param edad Si se pide, los agendados se cuentan **a esa edad**: sólo las citas reservadas antes de
 *   `now() - edad días` (`tieneCitaAlcanzable`, con su regla para las citas sin `reservada_el`). Es lo
 *   que hace comparable la ventana anterior: sus contactos llevan `edad` días más en la base, y sin el
 *   corte habrían tenido más tiempo para agendar, así que la flecha de los agendados bajaría siempre
 *   (lo encontró la revisión de AQ-3). Las etiquetas de descarte no tienen fecha, así que el descarte
 *   se mira como está hoy, y por eso los calificados no comparan (ver `CalificadosDelGrupo`).
 *
 * Exportada para que la prueba de la base mire una ventana exacta, con sus bordes, sin pasar por el
 * período: es donde vive el error de un día que no falla solo.
 */
export async function cifrasPorCampana(desde: string, hasta: string, edad: number | null = null): Promise<Map<string, Cifras>> {
  const gasto = await sql<{
    campana: string;
    inversion: string | null;
    entregadas: string;
    con_desglose: string;
    inversion_con_desglose: string | null;
    clics: string | null;
  }>`
    select a.meta_campana_id as campana,
           sum(m.gasto) as inversion,
           count(*) filter (where coalesce(m.impresiones, 0) > 0) as entregadas,
           count(m.acciones) as con_desglose,
           sum(m.gasto) filter (where m.acciones is not null) as inversion_con_desglose,
           sum((m.acciones->>'linkClick')::numeric) as clics
      from negocio.metricas_de_anuncio m
      join negocio.anuncios a on a.org_id = m.org_id and a.meta_anuncio_id = m.meta_anuncio_id
     where m.fecha between ${desde}::date and ${hasta}::date
       and a.meta_campana_id is not null
     group by a.meta_campana_id`.execute(datos());

  // El «agendó» es el predicado compartido; con `edad`, a esa edad (ver `tieneCitaAlcanzable`).
  const agendo = tieneCitaAlcanzable('c', edad);
  /* Los calificados, y el reparto de su puntaje, con el mismo `case` que `tramoDelPuntaje`: 0 o
     nulo es «sin calificar», y los cortes son los umbrales de `tramosDelIcp.ts`, pasados como
     parámetros para que no haya un segundo número. */
  const calificado = esCalificado('c', edad);
  const gente = await sql<{
    campana: string;
    contactos: string;
    agendados: string;
    calificados: string;
    alto: string;
    medio: string;
    bajo: string;
    sin_calificar: string;
    suma: string | null;
    con_puntaje: string;
  }>`
    select c.atribucion_primera->>'campaignId' as campana,
           count(*) as contactos,
           count(*) filter (where ${agendo}) as agendados,
           count(*) filter (where ${calificado}) as calificados,
           count(*) filter (where ${calificado} and c.score >= ${UMBRAL_ALTO}) as alto,
           count(*) filter (where ${calificado} and c.score >= ${UMBRAL_MEDIO} and c.score < ${UMBRAL_ALTO}) as medio,
           count(*) filter (where ${calificado} and c.score > 0 and c.score < ${UMBRAL_MEDIO}) as bajo,
           count(*) filter (where ${calificado} and coalesce(c.score, 0) = 0) as sin_calificar,
           sum(c.score) filter (where ${calificado} and c.score > 0) as suma,
           count(*) filter (where ${calificado} and c.score > 0) as con_puntaje
      from negocio.contactos c
     where ${cohorteEntre('c', { desde, hasta })}
       and c.atribucion_primera->>'campaignId' ~ ${CAMPANA_NUMERICA}
     group by c.atribucion_primera->>'campaignId'`.execute(datos());

  /* Las campañas que trajeron algún contacto atribuido, ALGUNA VEZ y no sólo en la ventana: una campaña de
     leads que esta semana gastó sin traer a nadie sí tiene que pagar el costo por contacto —es justo lo que ese
     costo mide—; una de mensajes, cuyos contactos llegan sin `campaignId`, no (A14-19). */
  const conContactos = await campanasConContactos();

  const cifras = new Map<string, Cifras>();
  const de = (campana: string) => {
    let c = cifras.get(campana);
    if (!c) {
      c = { ...CIFRAS_VACIAS };
      cifras.set(campana, c);
    }
    return c;
  };
  for (const g of gasto.rows) {
    const c = de(g.campana);
    c.inversion = n(g.inversion);
    c.inversionConContactos = conContactos.has(g.campana) ? c.inversion : 0;
    c.inversionConDesglose = n(g.inversion_con_desglose);
    /* Sin entrega, cero clics. Con entrega y sin ningún desglose, no se saben. Con desglose, la suma de
       `linkClick` —cero si ese tipo no ocurrió—; si sólo una parte de las filas lo trae, el costo por
       clic se paga con el gasto de esa parte (`inversionConDesglose`). */
    c.clics = n(g.entregadas) === 0 ? 0 : n(g.con_desglose) === 0 ? null : n(g.clics);
  }
  for (const p of gente.rows) {
    const c = de(p.campana);
    c.contactos = n(p.contactos);
    c.agendados = n(p.agendados);
    c.calificados = n(p.calificados);
    c.alto = n(p.alto);
    c.medio = n(p.medio);
    c.bajo = n(p.bajo);
    c.sinCalificar = n(p.sin_calificar);
    c.sumaDePuntajes = n(p.suma);
    c.conPuntaje = n(p.con_puntaje);
  }
  return cifras;
}

/** Las campañas que alguna vez trajeron un contacto con su `campaignId` en la atribución (A14-19). */
async function campanasConContactos(): Promise<Set<string>> {
  const r = await sql<{ campana: string }>`
    select distinct atribucion_primera->>'campaignId' as campana from negocio.contactos
     where atribucion_primera->>'campaignId' ~ ${CAMPANA_NUMERICA}`.execute(datos());
  return new Set(r.rows.map((f) => f.campana));
}

/**
 * Las campañas que la pantalla muestra: toda campaña con anuncios guardados, con contactos atribuidos
 * alguna vez, o con un funnel asignado. **No sólo las de la ventana**, y es a propósito: con la pauta
 * parada, una ventana de 7 días no tendría ninguna, y no habría a quién asignarle un funnel (A14-18).
 */
async function universoDeCampanas(): Promise<CampanaConocida[]> {
  const filas = await sql<{ campana: string; nombre: string | null; estado: string | null; conocida: boolean }>`
    with todas as (
      select meta_campana_id as campana from negocio.anuncios where meta_campana_id is not null
      union
      select atribucion_primera->>'campaignId' from negocio.contactos
       where atribucion_primera->>'campaignId' ~ ${CAMPANA_NUMERICA}
      union
      select meta_campana_id from negocio.funnels_de_campana
    )
    select t.campana, k.nombre, k.estado, (k.meta_campana_id is not null) as conocida
      from todas t
      left join negocio.campanas k on k.meta_campana_id = t.campana`.execute(datos());

  const funnels = new Map((await funnelsDeLasCampanas()).map((f) => [f.campana, f.funnel]));
  const conContactos = await campanasConContactos();
  return filas.rows.map((f) => ({
    campana: f.campana,
    nombre: f.nombre,
    estado: f.estado,
    conocida: f.conocida,
    conContactos: conContactos.has(f.campana),
    funnel: funnels.get(f.campana) ?? null,
  }));
}

/**
 * Si los datos guardados describen una ventana entera, para poder compararla.
 *
 *   · **El gasto, contra la cuenta** (`coberturaDelGasto`, `076`): cada día con su total de la cuenta, releído
 *     después de terminar en la zona de la empresa, y el detalle por campaña cuadrando con él. Hasta el
 *     2026-10-07 bastaba con que el día tuviera alguna fila de métricas, y así se escondió que el colector pedía
 *     13 de las 61 campañas: las filas nulas de las pausadas tapaban a la única que gastó. El precio de un día
 *     sin cerrar está dicho en docs/acquisition/14, A14-10: las ventanas que lo contienen no comparan ni
 *     publican costos hasta que el día sale de ellas. Una empresa sin ningún gasto guardado y sin contactos de
 *     campaña no frena: nunca pautó, y su inversión cero compara bien. Si tiene contactos de campaña, sí pautó y
 *     lo que falta es la recolección: el gasto no está entero.
 *   · **Los contactos, por su comienzo.** Un día sin altas es un día normal, así que acá no se pueden
 *     ver huecos; lo que sí se exige es que la historia empiece antes de la ventana.
 *   · **Los clics, por el comienzo del desglose**, que es posterior al del gasto (la `053`). Sin él, la
 *     ventana anterior tendría gasto sin clics y la flecha de los clics mentiría; ahí se apaga sólo esa.
 */
async function coberturaDeLaVentana(desde: string, hasta: string, dias: number, zona: string) {
  const g = await coberturaDelGasto(desde, hasta, dias, zona);
  const r = await sql<{ hay_gasto: boolean; contactos_desde: string | null; desglose_desde: string | null }>`
    select (exists (select 1 from negocio.gasto_de_la_cuenta) or exists (select 1 from negocio.metricas_de_anuncio)) as hay_gasto,
           (select to_char(min(alta_en_el_crm)::date, 'YYYY-MM-DD') from negocio.contactos
             where atribucion_primera->>'campaignId' ~ ${CAMPANA_NUMERICA}) as contactos_desde,
           (select to_char(min(fecha), 'YYYY-MM-DD') from negocio.metricas_de_anuncio
             where acciones is not null) as desglose_desde`.execute(datos());
  const f = r.rows[0]!;
  const sinPautaNunca = !f.hay_gasto && f.contactos_desde === null;
  const motivo: MotivoDelGasto | null = f.hay_gasto ? g.motivo : sinPautaNunca ? null : 'dias_sin_leer';
  return {
    gasto: motivo === null,
    motivo,
    contactos: f.contactos_desde === null || f.contactos_desde <= desde,
    clics: f.desglose_desde === null || f.desglose_desde <= desde,
  };
}

/**
 * La pantalla entera, para un período. Corre dentro de `conOrganizacion`: todo lo que lee está bajo la
 * RLS de la empresa.
 */
export async function embudosDeAcquisition(
  periodo: { clave: ClaveDePeriodo; dias: number },
  /** La zona de la empresa (`identidad.organizaciones.zona_horaria`): cuándo termina su día. */
  zona: string,
): Promise<EmbudosDeAcquisition> {
  return (await lecturaDeAcquisition(periodo, zona)).embudos;
}

/**
 * Lo que lee la pantalla, con las cifras crudas de cada campaña en las dos ventanas. La pantalla usa sólo
 * `embudos`; el detector de Acquisition (`lib/agentes/detectores/acquisition.ts`) compara contra la ventana
 * anterior con estas mismas cifras, así que **consume la lectura de la pantalla y no la recalcula**: la misma
 * ventana, los mismos días cerrados y la misma edad de los agendados.
 */
export interface LecturaDeAcquisition {
  embudos: EmbudosDeAcquisition;
  actual: ReadonlyMap<string, Cifras>;
  /** `null` cuando no se compara (`embudos.sinComparacion`). Una campaña que no aparece tuvo cero. */
  previa: ReadonlyMap<string, Cifras> | null;
}

export async function lecturaDeAcquisition(
  periodo: { clave: ClaveDePeriodo; dias: number },
  zona: string,
): Promise<LecturaDeAcquisition> {
  const d = periodo.dias;

  /* Los bordes de la ventana, con la regla de los días cerrados (A14-10). Vivían acá; desde el 2026-10-08 viven
     en `diasCerrados.ts` con su porqué, para que Conversion corte los mismos días (CV15-21). El primer dato propio
     de esta pantalla es el primer contacto con campaña: «Completo» empieza en él o en el primer día de gasto, el
     más viejo.

     **El colector atrasado** —la serie sin leer hace más de 26 horas, o su último día cerrado de hace más de
     tres— lo encontraron la cuarta y la quinta revisión de AQ-3, sobre las métricas; desde la `076` se mide
     sobre la serie, que es la que dice si un día está entero. Acá deja la ventana sin comparar (`faltan_dias`). */
  const contactos = await sql<{ desde: string | null }>`
    select to_char(min(alta_en_el_crm)::date, 'YYYY-MM-DD') as desde from negocio.contactos
     where atribucion_primera->>'campaignId' ~ ${CAMPANA_NUMERICA}`.execute(datos());
  const b = await bordesDelPeriodo(periodo, zona, contactos.rows[0]?.desde ?? null);
  const { ventana, cerrados, colectorAtrasado } = b;
  // La cobertura de la actual se mide hasta el último día cerrado: en «Completo», hoy a medias no cuenta.
  const actualEntera = await coberturaDeLaVentana(ventana.desde, b.cierre, b.diasHastaElCierre, zona);

  let anterior: { desde: string; hasta: string } | null = null;
  let sinComparacion: SinComparacion | null = null;
  let clicsComparables = true;
  if (!cerrados) {
    sinComparacion = 'periodo';
  } else if (colectorAtrasado || !actualEntera.gasto) {
    sinComparacion = 'faltan_dias';
  } else {
    const previaEntera = await coberturaDeLaVentana(b.anteriorCandidata.desde, b.anteriorCandidata.hasta, d, zona);
    if (!previaEntera.gasto || !previaEntera.contactos) sinComparacion = 'sin_historia';
    else {
      anterior = b.anteriorCandidata;
      clicsComparables = previaEntera.clics;
    }
  }
  const sinCostos: SinCostos | null =
    periodo.clave === 'hoy' ? 'hoy' : colectorAtrasado || !actualEntera.gasto ? 'gasto_incompleto' : null;

  /* Lo que la cuenta cobró en la ventana ENTERA —con hoy a medias en «Hoy» y en «Completo»—, que es la inversión
     del total; y en la anterior, para su flecha. `null` si a algún día le falta el total de la cuenta. */
  const deLaCuenta = (await coberturaDelGasto(ventana.desde, ventana.hasta, b.dias, zona)).deLaCuenta;
  const motivoDelGasto: MotivoDelGasto | null = colectorAtrasado ? 'colector_atrasado' : actualEntera.motivo;

  const cobertura = await sql<{ con_campana: string; sobre: string }>`
    select count(*) filter (where atribucion_primera->>'campaignId' ~ ${CAMPANA_NUMERICA}) as con_campana,
           count(*) as sobre
      from negocio.contactos
     where ${cohorteEntre('contactos', ventana)}`.execute(datos());

  const actual = await cifrasPorCampana(ventana.desde, ventana.hasta);
  // Si el desglose no cubre la ventana actual, sus clics serían los de una parte: no se publican.
  if (!actualEntera.clics) for (const c of actual.values()) c.clics = null;

  let previa: Map<string, Cifras> | null = null;
  if (anterior !== null) {
    // La anterior se lee a la MISMA edad que la actual: sus contactos llevan `d` días más en la base.
    previa = await cifrasPorCampana(anterior.desde, anterior.hasta, d);
    // Sin desglose que cubra la anterior, sólo los clics dejan de comparar: el resto sí se sabe.
    if (!clicsComparables) for (const c of previa.values()) c.clics = null;
  }

  const embudos = armarEmbudos({
    ventana,
    anterior,
    sinComparacion,
    campanas: await universoDeCampanas(),
    actual,
    previa,
    cobertura: { conCampana: n(cobertura.rows[0]?.con_campana), sobre: n(cobertura.rows[0]?.sobre) },
    sinCostos,
    gasto: {
      deLaCuenta,
      deLaCuentaAnterior:
        anterior === null ? null : (await coberturaDelGasto(anterior.desde, anterior.hasta, d, zona)).deLaCuenta,
      motivo: periodo.clave === 'hoy' ? null : motivoDelGasto,
    },
  });
  return { embudos, actual, previa };
}
