// El Attribution Monitor del § 18.14: cuánto valen las cifras por anuncio, medido.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ES EL COMPONENTE QUE DICE CUÁNTO VALEN LOS OTROS CINCO
//
// El § 18.15 lo pone en la vista de gerencia y en ninguna de las otras dos, y eso no es un detalle
// de permisos: de las siete cosas que gerencia ve, es la única que no es de dinero ni de estado.
// Está ahí porque **es lo que dice cuánto valen las otras seis**.
//
// El formato de salida lo fija el propio § 18.14 con su ejemplo:
//
//   «El 37 % de los contactos creados esta semana no conserva `meta_ad_id`; las conclusiones por
//    anuncio son incompletas.»
//
// O sea: una cifra, y **qué deja de valer por culpa de esa cifra**. Un porcentaje solo no es un
// monitor de atribución, es una estadística.
//
// ── SIETE PUNTOS, Y ACÁ ESTÁN CINCO. LOS DOS QUE FALTAN NO SON TRABAJO PENDIENTE ──
//
//   4 · «Diferencia entre leads de Meta y GHL» — **no se puede medir por esta vía, y no es que no
//       esté hecho.** El `leads` que devuelve el Ad Manager de GoHighLevel ES nuestro conteo de
//       contactos: medido el 2026-09-16 sobre cuatro anuncios en cuatro días, 16 de 16
//       coincidencias exactas. Hacen falta dos poblaciones y hay una sola, así que la diferencia es
//       cero por construcción. Publicarla sería publicar un cero que parece una buena noticia.
//
//   6 · «First-touch sobrescrito» — la `048` guarda `atribucion_primera` Y `atribucion_ultima`, así
//       que el dato está. Lo que no hay es HISTORIA: las dos columnas se reescriben en cada pasada
//       del cron, y detectar que el primer toque cambió exige haber guardado el anterior. Es una
//       tabla de cambios como la de la `047`, y es trabajo de verdad.
//
// Los otros cinco se miden contra `negocio.contactos`, que ya tiene los datos.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { DIAS_DE_LA_TASA, PISO_DE_UNA_TASA } from './indicadoresDeCitas.ts';

/**
 * Un punto del monitor.
 *
 * ── `proporcion` PUEDE SER NULA Y ES LA MITAD DEL DISEÑO ───────────────────
 *
 * Cinco contactos de los cuales uno trae anuncio dan «20 %», y con un contacto más dan 16,7 % o
 * 33,3 %. Eso no es una proporción: es un número que se mueve trece puntos por fila. Bajo
 * `PISO_DE_UNA_TASA` viaja nula, y `cuantos`/`sobre` viajan igual — el conteo es un hecho aunque la
 * proporción no lo sea.
 */
export interface PuntoDeAtribucion {
  clave: 'leads_con_anuncio' | 'citas_con_anuncio' | 'ventas_con_anuncio' | 'utm_incompletas' | 'sin_campana';
  /** Qué se está contando, en una línea y para una persona. */
  titulo: string;
  cuantos: number;
  sobre: number;
  /** `null` bajo el piso. **No es cero**: es que no se puede decir. */
  proporcion: number | null;
  /**
   * Qué deja de valer por culpa de esta cifra. Es la segunda mitad del formato del § 18.14.
   *
   * `null` cuando no hay nada que advertir — y entonces la pantalla no dibuja nada, que es la regla
   * del silencio. Un monitor que siempre tiene algo que decir es un monitor que nadie lee.
   */
  consecuencia: string | null;
}

export interface CalidadDeLaAtribucion {
  dias: number;
  puntos: PuntoDeAtribucion[];
  /** Los dos del § 18.14 que NO se pueden medir, con el motivo. Viajan para que nadie los rehaga. */
  fueraDeAlcance: { punto: string; porque: string }[];
  aviso: string | null;
}

/**
 * Debajo de este umbral, una cobertura incompleta se declara.
 *
 * **No está medido contra nada**: es el criterio de que una atribución que pierde más de uno de
 * cada diez ya no permite decir «este anuncio trae más». Se pone acá y no dentro de cada punto
 * porque los cinco responden la misma pregunta y tienen que responderla con el mismo criterio.
 */
export const COBERTURA_SUFICIENTE = 0.9;

/**
 * Las cinco UTM que el § 18.5 pide conservar, en el nombre con que GoHighLevel las manda.
 *
 * Están en una constante y no repetidas en el SQL porque el punto de UTM las cuenta **dos veces**:
 * una para saber cuántas sesiones están incompletas, y otra para saber CUÁL falta. La segunda
 * pregunta apareció midiendo, y es la que vuelve accionable a la primera.
 */
export const LAS_CINCO_UTM = ['utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm'] as const;

export async function calidadDeLaAtribucion(dias = DIAS_DE_LA_TASA): Promise<CalidadDeLaAtribucion> {
  const filas = await datos()
    .selectFrom('contactos as c')
    .select([
      sql<number>`count(*)`.as('contactos'),
      sql<number>`count(*) filter (where c.atribucion_primera ? 'adId')`.as('con_anuncio'),
      sql<number>`count(*) filter (where c.atribucion_primera ? 'campaignId')`.as('con_campana'),
      /* Las cinco UTM que el § 18.5 pide conservar. «Incompleta» es traer ALGUNA y no las cinco:
         un contacto sin ninguna no tiene UTM rotas, tiene otra procedencia — y contarlo acá diría
         que el enlace está mal armado cuando el lead entró por otro lado. */
      sql<number>`count(*) filter (
        where (c.atribucion_primera ?| array['utmSource','utmMedium','utmCampaign','utmContent','utmTerm'])
          and not (c.atribucion_primera ?& array['utmSource','utmMedium','utmCampaign','utmContent','utmTerm']))`.as(
        'utm_parciales',
      ),
      sql<number>`count(*) filter (
        where c.atribucion_primera ?| array['utmSource','utmMedium','utmCampaign','utmContent','utmTerm'])`.as(
        'con_alguna_utm',
      ),
      /* Una columna por UTM. Es lo que convierte «360 de 360 incompletas» —que alarma y no dice qué
         hacer— en «utmCampaign no llega en ninguna», que sí. Medido el 2026-09-16 sobre 384
         contactos: source 359, medium 358, campaign **0**, content 356, term 140. El cero es la
         razón de que NINGUNA sesión tenga las cinco, y sin este desglose no se puede ver. */
      ...LAS_CINCO_UTM.map((k) => sql<number>`count(*) filter (where c.atribucion_primera ? ${k})`.as(k)),
    ])
    .where(sql<boolean>`c.alta_en_el_crm >= now() - make_interval(days => ${dias})`)
    .executeTakeFirst();

  const citas = await datos()
    .selectFrom('citas as ci')
    .innerJoin('contactos as c', (j) =>
      j.onRef('c.org_id', '=', 'ci.org_id').onRef('c.id', '=', 'ci.contacto_id'),
    )
    .select([
      sql<number>`count(*)`.as('citas'),
      sql<number>`count(*) filter (where c.atribucion_primera ? 'adId')`.as('con_anuncio'),
    ])
    /* Por `inicio_el` y no por `alta_en_el_crm`: una cita se ubica por CUÁNDO ES, que es la misma
       regla que `atribucionDelLead` aplica al historial de la ficha. */
    .where(sql<boolean>`ci.inicio_el >= now() - make_interval(days => ${dias})`)
    .executeTakeFirst();

  const ventas = await datos()
    .selectFrom('resultados as r')
    .innerJoin('contactos as c', (j) =>
      j.onRef('c.org_id', '=', 'r.org_id').onRef('c.id', '=', 'r.contacto_id'),
    )
    .select([
      sql<number>`count(*)`.as('ventas'),
      sql<number>`count(*) filter (where c.atribucion_primera ? 'adId')`.as('con_anuncio'),
    ])
    .where(sql<boolean>`r.creado_el >= now() - make_interval(days => ${dias})`)
    /* `salida = 'venta'` y no una columna booleana: el vocabulario de `resultados` lo fija el
       `check` de la migración 011, y es el mismo corte que usa `comision.ts` para contar ventas.
       Dos formas distintas de contar la misma cosa es cómo dos pantallas terminan discrepando. */
    .where('r.salida', '=', 'venta')
    .executeTakeFirst();

  const n = (v: unknown) => Number(v ?? 0);

  const puntos: PuntoDeAtribucion[] = [
    punto(
      'leads_con_anuncio',
      'Contactos que conservan el anuncio',
      n(filas?.con_anuncio),
      n(filas?.contactos),
      'las conclusiones por anuncio hablan solo de una parte, y esa parte NO es al azar: el anuncio ' +
        'llega cuando el lead entra por Facebook o Instagram, y no cuando entra por formulario o por ' +
        'el calendario.',
    ),
    punto(
      'citas_con_anuncio',
      'Citas cuyo contacto conserva el anuncio',
      n(citas?.con_anuncio),
      n(citas?.citas),
      'no se puede decir qué anuncio trae más citas sin decir de cuántas habla.',
    ),
    punto(
      'ventas_con_anuncio',
      'Ventas cuyo contacto conserva el anuncio',
      n(ventas?.con_anuncio),
      n(ventas?.ventas),
      'el costo por venta por anuncio no se puede calcular con esta cobertura. Y el § 18.6 ya dice ' +
        'que ese cálculo es de Business Intelligence, no de acá.',
    ),
    punto(
      'sin_campana',
      'Contactos que conservan la campaña',
      n(filas?.con_campana),
      n(filas?.contactos),
      'el corte por campaña deja fuera a los que no la traen, y su fila «Otras» los junta con los ' +
        'que sí la traen pero no llegan al piso.',
    ),
    /* Éste va AL REVÉS que los otros cuatro: los demás cuentan lo que SÍ está y avisan cuando falta;
       éste cuenta lo que está ROTO. Por eso su `cuantos` son las incompletas y no las completas, y
       por eso su consecuencia se dispara cuando el número SUBE. Mezclarlos en la misma dirección
       habría hecho que un 100 % significara «todo bien» en cuatro y «todo roto» en uno. */
    alReves(
      'utm_incompletas',
      'Sesiones con UTM incompletas',
      n(filas?.utm_parciales),
      n(filas?.con_alguna_utm),
      utmQueFalta(filas as Record<string, unknown> | undefined, n(filas?.con_alguna_utm)),
    ),
  ];

  return {
    dias,
    puntos,
    fueraDeAlcance: [
      {
        punto: 'Diferencia entre leads de Meta y los de la base',
        porque:
          'el `leads` que devuelve GoHighLevel ES nuestro conteo de contactos — 16 de 16 ' +
          'coincidencias exactas, medido el 2026-09-16. Hacen falta dos poblaciones y hay una.',
      },
      {
        punto: 'First-touch sobrescrito',
        porque:
          'las dos columnas de atribución se reescriben en cada pasada del cron. Detectar que el ' +
          'primer toque cambió exige guardar el anterior, y eso es una tabla de cambios que no está.',
      },
    ],
    aviso: avisoDe(puntos),
  };
}

/**
 * Qué UTM falta, nombrada. Es la segunda mitad del formato del § 18.14 aplicada a este punto.
 *
 * Se nombra la que MENOS llega y no todas: una lista de cinco con sus cinco conteos es un informe, y
 * lo que hace falta es la frase que dice qué revisar. Las demás quedan en el conteo del punto.
 */
function utmQueFalta(filas: Record<string, unknown> | undefined, sobre: number): string {
  const cierre =
    'un enlace que manda algunas UTM y no las cinco pierde el corte por creativo, que es el que el ' +
    '§ 18.12 necesita.';
  if (filas === undefined || sobre === 0) return cierre;

  const conteos = LAS_CINCO_UTM.map((k) => ({ clave: k, cuantas: Number(filas[k] ?? 0) }));
  const peor = conteos.reduce((a, b) => (b.cuantas < a.cuantas ? b : a));

  return peor.cuantas === 0
    ? `\`${peor.clave}\` no llega en NINGUNA de las ${sobre} sesiones, así que ninguna puede tener las cinco: ${cierre}`
    : `la que menos llega es \`${peor.clave}\`, en ${peor.cuantas} de ${sobre}: ${cierre}`;
}

/** Un punto donde MÁS es mejor: se cuenta lo que está, y la consecuencia aparece si falta. */
function punto(
  clave: PuntoDeAtribucion['clave'],
  titulo: string,
  cuantos: number,
  sobre: number,
  consecuencia: string,
): PuntoDeAtribucion {
  const proporcion = sobre >= PISO_DE_UNA_TASA ? Math.round((cuantos / sobre) * 1000) / 10 : null;
  return {
    clave,
    titulo,
    cuantos,
    sobre,
    proporcion,
    // Sin proporción no hay consecuencia: no se puede afirmar que la cobertura es mala sobre nueve
    // filas. El conteo viaja igual y la pantalla lo puede mostrar sin conclusión.
    consecuencia: proporcion !== null && cuantos / sobre < COBERTURA_SUFICIENTE ? consecuencia : null,
  };
}

/** Un punto donde MENOS es mejor: se cuenta lo roto, y la consecuencia aparece si hay algo roto. */
function alReves(
  clave: PuntoDeAtribucion['clave'],
  titulo: string,
  cuantos: number,
  sobre: number,
  consecuencia: string,
): PuntoDeAtribucion {
  const proporcion = sobre >= PISO_DE_UNA_TASA ? Math.round((cuantos / sobre) * 1000) / 10 : null;
  return {
    clave,
    titulo,
    cuantos,
    sobre,
    proporcion,
    consecuencia: cuantos > 0 ? consecuencia : null,
  };
}

/**
 * El aviso de cabecera. **`null` ⟹ la pantalla no dibuja nada.**
 *
 * Se elige el punto con PEOR cobertura entre los que tienen consecuencia, y se escribe con el
 * formato del § 18.14: la cifra, y qué deja de valer.
 */
function avisoDe(puntos: readonly PuntoDeAtribucion[]): string | null {
  const conProblema = puntos.filter((p) => p.consecuencia !== null && p.proporcion !== null);
  if (conProblema.length === 0) return null;

  const peor = conProblema.reduce((a, b) => {
    const da = a.clave === 'utm_incompletas' ? 100 - (a.proporcion ?? 0) : (a.proporcion ?? 0);
    const db = b.clave === 'utm_incompletas' ? 100 - (b.proporcion ?? 0) : (b.proporcion ?? 0);
    return db < da ? b : a;
  });

  const faltan = peor.sobre - peor.cuantos;
  return peor.clave === 'utm_incompletas'
    ? `${peor.cuantos} de ${peor.sobre} sesiones con UTM traen algunas y no las cinco; ${peor.consecuencia}`
    : `${faltan} de ${peor.sobre} no conservan el anuncio; ${peor.consecuencia}`;
}
