// Qué piezas están cansando a su audiencia: la caída del CTR contra el tiempo.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA MITAD DE LA FATIGA DEL § 18.12 NO SE PUEDE CONSTRUIR, Y HAY QUE DECIRLO
//
// El indicador clásico es «la frecuencia sube y el CTR baja». La primera mitad **no existe** y no es
// una limitación del proveedor: es aritmética. `costoDelAnuncio.ts:88-95` ya lo dejó escrito para el
// alcance y la frecuencia:
//
//     «Sumar siete días de alcance cuenta siete veces a quien vio el anuncio los siete días… es un
//      número más grande que no significa nada, y que encima se parece a uno que sí.»
//
// Al grano de la pieza es **peor** que al grano del anuncio: la misma persona alcanzada por los hasta
// seis anuncios de una pieza se contaría seis veces. No hay «frecuencia de la pieza en la ventana»,
// y publicar un promedio de promedios diarios sería exactamente el número que no significa nada.
//
// Lo que sí se puede es la otra mitad: el CTR se construye sobre clics e impresiones, que se suman
// las dos. Así que esto detecta **caída de CTR**, y la pantalla no puede llamarlo «fatiga» a secas
// sin decir sobre qué se midió.
//
// ── EL UMBRAL NO ESTÁ CALIBRADO, Y EL DOCUMENTO LO SABE ────────────────────
//
// El § 18.19 declara pendiente *«definir umbrales iniciales de anomalía y fatiga»*. Publicar
// «fatigado» con un umbral inventado es exactamente lo que se le critica al prototipo, así que acá
// se hacen las dos cosas: **la serie viaja siempre** —los dos CTR y la caída, que son hechos— y el
// veredicto viaja con un aviso que dice que su umbral es provisional.
//
// ── Y LA BASE ES CORTA, MEDIDO ─────────────────────────────────────────────
//
// El colector arrancó el 2026-08-18. Medido el 2026-09-18: 28 piezas con entrega, 8,1 días de
// promedio cada una, **16 con siete días o más y sólo 5 con catorce**. Una tendencia sobre siete
// días se mueve con un día malo, así que la cantidad de días viaja en cada fila y el piso es
// explícito.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';

import { datos } from '../datos/contexto.ts';
import { DIAS_DE_LA_TASA } from './indicadoresDeCitas.ts';
import { ventanaDeMetricas } from './costoDelAnuncio.ts';
import { llaveDelCreativo } from './creativo.ts';
import { PISO_DE_IMPRESIONES } from './rendimientoDelCreativo.ts';

/**
 * Cuántos días de entrega hacen falta para partir la serie en dos mitades comparables.
 *
 * Ocho, o sea cuatro contra cuatro. **No está calibrado**: sale de que con menos de cuatro días por
 * mitad un solo día malo mueve la mitad entera, y de que con la base medida —8,1 días de promedio—
 * un piso más alto dejaría casi todas las piezas sin veredicto.
 *
 * Medido el 2026-09-18: de 28 piezas con entrega, 16 tienen siete días o más y 5 tienen catorce.
 */
export const DIAS_MINIMOS_DE_SERIE = 8;

/**
 * Cuánto tiene que caer el CTR para llamarlo fatiga.
 *
 * Veinte por ciento **relativo**, no en puntos: una pieza que va de 4 % a 3,2 % cayó lo mismo, en
 * proporción, que una que va de 1 % a 0,8 %. En puntos, la primera caería cuatro veces más y la
 * segunda no se notaría nunca.
 *
 * **Y este número no sale de medir nada.** El § 18.19 del documento funcional declara pendiente
 * *«definir umbrales iniciales de anomalía y fatiga»*, y éste es uno de ellos. Va acompañado de un
 * aviso que lo dice, porque un veredicto con un umbral inventado es lo que se le critica al
 * prototipo — la diferencia entre esto y aquello es que acá la serie viaja al lado y se puede
 * discutir el número.
 */
export const CAIDA_QUE_PREOCUPA = 0.2;

export interface FatigaDeUnCreativo {
  creativo: string;
  /** Días con entrega de la pieza en la ventana. Viaja siempre: una tendencia sobre 8 no es una sobre 26. */
  dias: number;
  desde: string;
  hasta: string;
  /** El CTR de la primera mitad de la serie, en porcentaje. `null` sin impresiones suficientes. */
  ctrTemprano: number | null;
  ctrTardio: number | null;
  /**
   * La caída relativa, de 0 a 1. Negativa cuando el CTR SUBIÓ.
   *
   * Viaja aunque no alcance el umbral: es un hecho, y el umbral es una opinión.
   */
  caida: number | null;
  /**
   * El veredicto. `null` = **no se puede decir**, que no es lo mismo que «no está fatigada».
   *
   * Es `null` cuando la serie es corta o cuando alguna mitad no llega al piso de impresiones.
   */
  fatigado: boolean | null;
  /**
   * Por qué no se pudo decir, **en clave**. `null` cuando sí se pudo.
   *
   * La clave y no sólo la frase, porque el aviso agrupa las piezas sin veredicto por motivo. Si
   * agrupara leyendo `porque` con una expresión regular, «por qué no hay veredicto» estaría escrito
   * dos veces —la frase y el patrón que la reconoce— y cambiar una redacción rompería el agrupado
   * en silencio: las piezas caerían cada una en su propio grupo y el aviso enumeraría veintiún
   * motivos distintos en vez de tres.
   */
  motivo: 'pocos-dias' | 'piso-de-impresiones' | 'sin-clics' | null;
  /** La misma cosa en prosa, para dibujar. Sale del `motivo`, no al revés. */
  porque: string | null;
}

export interface FatigaDeLosCreativos {
  dias: number;
  filas: FatigaDeUnCreativo[];
  /** Cuántas piezas tienen serie suficiente, sobre cuántas entregaron. Los dos términos, siempre. */
  conSerie: { con: number; sobre: number };
  aviso: string | null;
}

function redondear(v: number, decimales: number): number {
  const f = 10 ** decimales;
  return Math.round(v * f) / f;
}

/**
 * La caída del CTR por pieza, en la ventana.
 *
 * Se corre dentro de `conOrganizacion(`.
 */
export async function fatigaDelCreativo(dias = DIAS_DE_LA_TASA): Promise<FatigaDeLosCreativos> {
  /* ── LA CONSULTA VA CRUDA, Y ES LA ÚNICA FORMA ──────────────────────────
   *
   * `ntile(2) over (partition by … order by fecha)` es una función de ventana sobre una subconsulta
   * agrupada, y el constructor de Kysely no la expresa. Escrita a mano se lee de una pasada; armada
   * con envoltorios sería más larga y menos clara.
   *
   * Se agrupa primero por (pieza, día) y recién después se parte en mitades: sin eso, los varios
   * anuncios de la misma pieza contarían como días distintos y una pieza que corre en seis anuncios
   * parecería tener seis veces más serie de la que tiene. Es el mismo grano que el resto del
   * departamento.
   *
   * Y sólo entran los días CON entrega: un día sin impresiones no dice nada sobre si la pieza cansó
   * a alguien, porque no se mostró. */
  const filas = await datos()
    .selectFrom(sql`(
      with porDia as (
        select ${llaveDelCreativo('a.nombre')} as creativo, m.fecha as fecha,
               sum(m.impresiones) as impresiones, sum(m.clics) as clics
          from negocio.metricas_de_anuncio m
          join negocio.anuncios a
            on a.org_id = m.org_id and a.meta_anuncio_id = m.meta_anuncio_id
         where ${ventanaDeMetricas('m', dias)}
           and m.impresiones > 0
           and ${llaveDelCreativo('a.nombre')} <> ''
         group by 1, 2
      ), mitades as (
        select creativo, fecha, impresiones, clics,
               ntile(2) over (partition by creativo order by fecha) as mitad
          from porDia
      )
      select creativo,
             count(*) as dias,
             min(fecha)::text as desde,
             max(fecha)::text as hasta,
             sum(impresiones) filter (where mitad = 1) as imp1,
             sum(clics)       filter (where mitad = 1) as clics1,
             sum(impresiones) filter (where mitad = 2) as imp2,
             sum(clics)       filter (where mitad = 2) as clics2
        from mitades
       group by creativo
    )`.as('f'))
    .selectAll()
    .execute();

  const salida: FatigaDeUnCreativo[] = (filas as unknown as Record<string, unknown>[])
    .map((f) => leerUnaFila(f))
    .sort((a, b) => (b.caida ?? -Infinity) - (a.caida ?? -Infinity));

  const conSerie = salida.filter((f) => f.fatigado !== null).length;

  return {
    dias,
    filas: salida,
    conSerie: { con: conSerie, sobre: salida.length },
    aviso: avisoDe(salida, conSerie),
  };
}

function leerUnaFila(f: Record<string, unknown>): FatigaDeUnCreativo {
  const dias = Number(f.dias ?? 0);
  const imp1 = Number(f.imp1 ?? 0);
  const imp2 = Number(f.imp2 ?? 0);
  const clics1 = Number(f.clics1 ?? 0);
  const clics2 = Number(f.clics2 ?? 0);

  const base = {
    creativo: String(f.creativo),
    dias,
    desde: String(f.desde),
    hasta: String(f.hasta),
  };

  /* Sin serie suficiente NO se dice nada, y el motivo viaja. `fatigado: false` acá sería una
     afirmación —«esta pieza no está cansando»— hecha sobre cuatro días, y la pantalla no tendría
     cómo distinguirla de una medida sobre veintiséis. */
  if (dias < DIAS_MINIMOS_DE_SERIE) {
    return {
      ...base,
      ctrTemprano: null,
      ctrTardio: null,
      caida: null,
      fatigado: null,
      motivo: 'pocos-dias',
      porque: `sólo ${dias} día(s) con entrega; hacen falta ${DIAS_MINIMOS_DE_SERIE}`,
    };
  }

  /* Y con serie pero sin volumen tampoco: un CTR sobre doscientas impresiones se mueve medio punto
     con un clic, así que la comparación entre las dos mitades sería ruido contra ruido. */
  if (imp1 < PISO_DE_IMPRESIONES || imp2 < PISO_DE_IMPRESIONES) {
    return {
      ...base,
      ctrTemprano: null,
      ctrTardio: null,
      caida: null,
      fatigado: null,
      motivo: 'piso-de-impresiones',
      porque: `alguna mitad de la serie no llega a ${PISO_DE_IMPRESIONES} impresiones`,
    };
  }

  const ctrTemprano = redondear((clics1 / imp1) * 100, 3);
  const ctrTardio = redondear((clics2 / imp2) * 100, 3);
  /* La caída RELATIVA. En puntos, una pieza de CTR alto parecería caer mucho más que una de CTR
     bajo por el mismo deterioro proporcional. */
  const caida = ctrTemprano === 0 ? null : redondear((ctrTemprano - ctrTardio) / ctrTemprano, 3);

  return {
    ...base,
    ctrTemprano,
    ctrTardio,
    caida,
    fatigado: caida === null ? null : caida >= CAIDA_QUE_PREOCUPA,
    motivo: caida === null ? 'sin-clics' : null,
    porque: caida === null ? 'la primera mitad no tuvo ningún clic' : null,
  };
}

/** **`null` ⟹ la pantalla no dibuja nada.** */
function avisoDe(filas: FatigaDeUnCreativo[], conSerie: number): string | null {
  const partes: string[] = [];

  /* ── ESTE AVISO DECÍA DOS COSAS Y LAS DOS ERAN FALSAS ──────────────────────
   *
   * Decía: *«N de M pieza(s) no tienen serie suficiente para un veredicto: **se muestra su conteo
   * de días** y no su tendencia»*.
   *
   *   · **«se muestra su conteo de días»** — no se muestra. `PanelDeCreative.jsx` dibuja sólo las
   *     filas con `fatigado !== null`; las otras no aparecen en ninguna parte de la pantalla. El
   *     aviso prometía un listado que no existe, y medido el 2026-09-19 eran 21 de 26 piezas las
   *     que el lector iba a buscar y no iba a encontrar.
   *   · **«no tienen serie suficiente»** — `conSerie` cuenta las que tienen VEREDICTO, y para no
   *     tenerlo hay TRES motivos distintos, cada uno con su `porque` en la fila: pocos días, una
   *     mitad por debajo del piso de impresiones, o la primera mitad sin ningún clic. El aviso se
   *     los atribuía todos al primero, o sea que acusaba de serie corta a piezas con serie larga.
   *
   * Ahora dice cuántas son, que NO se listan, y agrupa por `motivo`, que es una clave y no una
   * frase. El `porque` de cada fila sigue viajando: el día que la pantalla dibuje esas filas, ya lo
   * tiene. */
  if (filas.length > 0 && conSerie < filas.length) {
    const EN_PROSA = {
      'pocos-dias': 'les faltan días de serie',
      'piso-de-impresiones': 'alguna mitad de su serie no llega al piso de impresiones',
      'sin-clics': 'su primera mitad no tuvo ningún clic',
    } as const;

    const motivos = new Map<string, number>();
    for (const f of filas) {
      if (f.fatigado !== null) continue;
      const clave = f.motivo === null ? 'sin motivo declarado' : EN_PROSA[f.motivo];
      motivos.set(clave, (motivos.get(clave) ?? 0) + 1);
    }
    const detalle = [...motivos.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([m, n]) => `${n} ${m}`)
      .join('; ');

    partes.push(
      `${filas.length - conSerie} de ${filas.length} pieza(s) no tienen veredicto y no se listan ` +
        `acá: ${detalle}.`,
    );
  }

  /* El umbral, declarado. Sólo cuando hay algún veredicto que declarar: sin ninguno, decirlo sería
     un aviso sobre algo que la pantalla no está afirmando. */
  if (filas.some((f) => f.fatigado !== null)) {
    partes.push(
      `El umbral de fatiga —una caída del ${Math.round(CAIDA_QUE_PREOCUPA * 100)} % del CTR entre ` +
        /* Sin asteriscos: la pantalla dibuja este texto tal cual, dentro de un `<p>` y de un
           `title=`. Un `**provisional**` no se pone en negrita en ninguno de los dos — se lee con
           los asteriscos puestos, y el aviso que existe para dar confianza en la cifra termina
           pareciendo un error de la aplicación. */
        'las dos mitades de la serie— es provisional: el documento funcional lo declara ' +
        'pendiente y no está calibrado contra nada.',
    );
    /* Y la mitad que falta. Sin esto, «fatiga» se lee como el indicador completo del § 18.12 y no
       como la mitad que se puede construir. */
    partes.push(
      'Se mide sobre el CTR y no sobre la frecuencia: la frecuencia no se puede agregar a lo largo ' +
        'de días ni de anuncios.',
    );
  }

  return partes.length === 0 ? null : partes.join(' ');
}
