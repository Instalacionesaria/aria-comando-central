// Los motivos de no venta de la pantalla de Sales: por qué no se cerraron las llamadas de venta analizadas.
//
// ═══════════════════════════════════════════════════════════════════════════════
// DE DÓNDE SALEN (docs/sales/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md, S15-19)
//
// De los Analizadores, no del registro del closer: el 2026-10-09 el usuario pidió que la tarjeta se llene sola con
// lo que ya hay, y lo que hay son las llamadas HT analizadas. Cada una trae su resultado, que el modelo lee en la
// transcripción (`lib/analizadores/nucleo/ht.ts:59`), y sus objeciones, que la tarea clasifica en seis categorías
// (`lib/analizadores/categorias.ts:6`, en `negocio.objeciones_clasificadas`). La tarjeta cuenta, de las llamadas
// que terminaron sin cierre, cuántas tuvieron una objeción de cada categoría.
//
//   · **La población**: HT, terminadas, con su análisis vigente y resultado `NO_CERRADA`, en la ventana por el
//     momento de la reunión —la misma de `lib/negocio/llamadasDeVenta.ts:95-96`—. Son de toda la empresa: una
//     llamada no está atada a un closer configurado.
//   · **Una llamada por categoría, no una objeción**: tres objeciones de precio en una llamada son una llamada con
//     el precio como motivo. Una llamada con dos categorías cuenta en las dos, así que las filas pueden sumar más
//     que el total.
//   · **La categoría vigente**: la de la objeción con la misma posición y la misma huella de su texto, como la
//     cuenta `llamadasDeVenta`. Si el análisis cambió, la objeción vieja no casa.
//   · **Lo que no tiene categoría va aparte**: la llamada sin cierre sin ninguna objeción clasificada —porque no la
//     tuvo o porque la clasificación no corrió— no se reparte entre las categorías.
//
// Ni la frase de la objeción ni quién organizó la reunión salen de acá: sólo conteos.
//
// Lo que el closer registra en Avanzar —los «No le interesa» con su motivo del catálogo— sigue en
// `lib/negocio/motivosDeNoVenta.ts`, y lo da el agente de Sales (S15-22).
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';

import { datos } from '../datos/contexto.ts';
import { CATEGORIAS_DE_OBJECION, type CategoriaDeObjecion } from '../analizadores/categorias.ts';

export interface FilaDeMotivoDeLlamada {
  categoria: CategoriaDeObjecion;
  /** Las llamadas sin cierre con al menos una objeción de esta categoría. */
  llamadas: number;
  /** Sobre las llamadas sin cierre de la ventana, de 0 a 1. */
  porcion: number;
}

export interface MotivosDeLasLlamadas {
  dias: number;
  /** Las llamadas HT analizadas de la ventana que terminaron sin cierre: el `hint` «{N} llamadas sin cierre». */
  sinCierre: number;
  /** Una por categoría con al menos una llamada, de más a menos; a igual conteo, en el orden del catálogo. */
  filas: FilaDeMotivoDeLlamada[];
  /** Las llamadas sin cierre sin ninguna objeción clasificada. */
  sinObjecion: number;
  /** Su porción sobre las llamadas sin cierre. `null` sin ninguna. */
  porcionSinObjecion: number | null;
}

/** Ordena y reparte los conteos. Puro: la prueba lo arma con números a mano. */
export function repartirLasLlamadas(
  dias: number,
  sinCierre: number,
  conteos: readonly { categoria: CategoriaDeObjecion; n: number }[],
  sinObjecion: number,
): MotivosDeLasLlamadas {
  const porCategoria = new Map<CategoriaDeObjecion, number>();
  for (const c of conteos) porCategoria.set(c.categoria, (porCategoria.get(c.categoria) ?? 0) + c.n);
  const filas = CATEGORIAS_DE_OBJECION.filter((c) => (porCategoria.get(c) ?? 0) > 0)
    .map((categoria) => ({ categoria, llamadas: porCategoria.get(categoria)!, porcion: porCategoria.get(categoria)! / sinCierre }))
    .sort((a, b) => b.llamadas - a.llamadas || CATEGORIAS_DE_OBJECION.indexOf(a.categoria) - CATEGORIAS_DE_OBJECION.indexOf(b.categoria));
  return {
    dias,
    sinCierre,
    filas,
    sinObjecion,
    porcionSinObjecion: sinObjecion === 0 ? null : sinObjecion / sinCierre,
  };
}

/** Los motivos de las llamadas sin cierre de la ventana. Corre dentro de `conOrganizacion`. */
export async function motivosDeLasLlamadas(dias: number): Promise<MotivosDeLasLlamadas> {
  const llamadas = sql`(
    select l.id, l.org_id
      from negocio.analizador_llamadas l
      join negocio.analizador_analisis a on a.org_id = l.org_id and a.llamada_id = l.id
     where l.tipo = 'HT' and l.estado = 'DONE' and a.coincide and a.resultado = 'NO_CERRADA'
       and coalesce(l.fecha_de_la_reunion, l.creado_el) > now() - make_interval(days => ${dias})
  )`;
  /* Cada llamada con cada categoría que tuvo, una vez: la categoría vigente de cada objeción, por su posición y
     por la huella de su texto, como en `lib/negocio/llamadasDeVenta.ts:110-127`. */
  const categorias = sql`(
    select distinct s.id, c.categoria
      from ${llamadas} s
      join negocio.analizador_analisis a on a.org_id = s.org_id and a.llamada_id = s.id
     cross join lateral jsonb_array_elements(
             case when jsonb_typeof(a.analisis->'seller'->'objections') = 'array'
                  then a.analisis->'seller'->'objections' else '[]'::jsonb end
           ) with ordinality as o(e, orden)
      join negocio.objeciones_clasificadas c
        on c.org_id = s.org_id and c.llamada_id = s.id and c.indice = o.orden - 1 and c.huella = md5(o.e->>'objection')
     where coalesce(btrim(o.e->>'objection'), '') <> ''
  )`;
  const totales = (
    await sql<{ sin_cierre: string; sin_objecion: string }>`
      select (select count(*) from ${llamadas} s) as sin_cierre,
             (select count(*) from ${llamadas} s where not exists (select 1 from ${categorias} k where k.id = s.id)) as sin_objecion`.execute(datos())
  ).rows[0];
  const conteos = (
    await sql<{ categoria: CategoriaDeObjecion; n: string }>`
      select k.categoria, count(*) as n from ${categorias} k group by k.categoria`.execute(datos())
  ).rows;
  return repartirLasLlamadas(
    dias,
    Number(totales?.sin_cierre ?? 0),
    conteos.map((c) => ({ categoria: c.categoria, n: Number(c.n) })),
    Number(totales?.sin_objecion ?? 0),
  );
}
