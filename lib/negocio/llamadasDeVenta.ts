// Lo que dicen las llamadas de venta analizadas, sumado (AG11 de los agentes;
// `docs/OTROS/agentes/fichas/F14-LLAMADAS-DE-VENTA.md`). Sin modelo: cuenta lo que los Analizadores ya
// guardaron y la categoría que `lib/analizadores/objeciones.ts` le puso a cada objeción. Corre dentro de
// `conOrganizacion(`. La pantalla de las llamadas no lo usa: lo leen el cerebro y, después, la Reunión y el
// Brief.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LAS REGLAS
//
//   · **La ventana** es la del período (`lib/negocio/periodo.ts`), sobre el momento de la reunión: 24 horas por
//     día, como el resto de las pantallas. La anterior es la de igual largo justo antes; con «completo» no hay.
//   · **La cobertura viaja**: cuántas objeciones tienen categoría sobre cuántas hay. Una que todavía no se
//     clasificó no está en ninguna categoría, y sin la cobertura el conteo parecería completo.
//   · **«Crece» sólo con piso** (AG-F14-1): la ventana anterior con 10 llamadas analizadas o más, y la
//     categoría con la mitad más de veces que antes. Sin piso, `crece` es nulo y se publica el conteo.
//   · **El puntaje por closer, con su piso**: el promedio sólo con 10 llamadas o más; debajo, el conteo. El
//     closer es quien organizó la reunión, por su nombre: el correo no viaja (`D-17`).
//   · **Las frases citables** —la frase, el minuto, el enlace a la grabación y si la llamada se ganó— sólo si
//     quien pide las puede ver (`conFrases`, que es tener `analizadores.ver`, `D-20`). La transcripción nunca.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { PISO_DE_UNA_TASA } from './indicadoresDeCitas.ts';
import type { Periodo } from './periodo.ts';
import { CATEGORIAS_DE_OBJECION, type CategoriaDeObjecion } from '../analizadores/categorias.ts';
import { contarVinculos, vinculosDe, type CuentaDeVinculos } from './vinculoDeLlamadas.ts';

/** Cuánto más tiene que aparecer una categoría para decir que «crece»: la mitad más (AG-F14-1). */
export const CRECIMIENTO_QUE_SE_DICE = 0.5;
/** Cuántas frases citables por categoría, de las más recientes. */
export const FRASES_POR_CATEGORIA = 3;

export interface ObjecionesDeUnaCategoria {
  categoria: CategoriaDeObjecion;
  ahora: number;
  /** En la ventana anterior. `null` con «completo». */
  antes: number | null;
  /** `null` sin piso en la ventana anterior: entonces vale el conteo. */
  crece: boolean | null;
}

export interface PuntajeDeCloser {
  /** El nombre de quien organizó la reunión, o `null` si no vino. */
  closer: string | null;
  llamadas: number;
  /** `null` debajo del piso de 10 llamadas. */
  puntajePromedio: number | null;
}

export interface FraseCitable {
  categoria: CategoriaDeObjecion;
  frase: string;
  /** El minuto de la grabación en que empieza. `null` si el análisis no lo trae. */
  minuto: number | null;
  enlace: string | null;
  /** Si la llamada se cerró, según su análisis. */
  ganada: boolean;
}

export interface LlamadasDeVenta {
  dias: number;
  /** Las llamadas analizadas de la ventana, con su vínculo. */
  llamadas: CuentaDeVinculos;
  /** Cuántas analizadas tuvo la ventana anterior: el piso de «crece». `null` con «completo». */
  llamadasAntes: number | null;
  objeciones: { total: number; clasificadas: number; porCategoria: ObjecionesDeUnaCategoria[] };
  closers: PuntajeDeCloser[];
  /** `null` si quien pide no puede ver frases. */
  frases: FraseCitable[] | null;
}

interface FilaDeLlamada {
  id: string;
  actual: boolean;
  closer: string | null;
  closer_clave: string | null;
  puntaje: number | null;
  ganada: boolean;
  enlace: string | null;
}

interface FilaDeObjecion {
  llamada_id: string;
  actual: boolean;
  categoria: CategoriaDeObjecion | null;
  frase: string | null;
  inicio: number | null;
  momento: Date;
}

export async function llamadasDeVenta(periodo: Pick<Periodo, 'clave' | 'dias'>, opciones: { conFrases: boolean }): Promise<LlamadasDeVenta> {
  const conAnterior = periodo.clave !== 'completo';
  const alcance = conAnterior ? periodo.dias * 2 : periodo.dias;
  const momento = sql`coalesce(l.fecha_de_la_reunion, l.creado_el)`;
  const esActual = sql<boolean>`${momento} > now() - make_interval(days => ${periodo.dias})`;

  const llamadas = (
    await sql<FilaDeLlamada>`
      select l.id, ${esActual} as actual, l.organizador_nombre as closer, lower(btrim(l.organizador_email)) as closer_clave,
             a.puntaje, coalesce(a.resultado = 'CERRADA', false) as ganada, l.url_de_la_grabacion as enlace
        from negocio.analizador_llamadas l
        join negocio.analizador_analisis a on a.org_id = l.org_id and a.llamada_id = l.id
       where l.tipo = 'HT' and l.estado = 'DONE' and a.coincide
         and ${momento} > now() - make_interval(days => ${alcance})`.execute(datos())
  ).rows;

  /* Cada objeción con su categoría, si tiene una VIGENTE: por posición y por la huella de su texto. Una fila de
     una objeción que cambió con un nuevo análisis no casa, y la objeción cuenta como sin clasificar. */
  const objeciones = (
    await sql<FilaDeObjecion>`
      select l.id as llamada_id, ${esActual} as actual, c.categoria,
             o.e->'evidence'->>'quote' as frase,
             case when jsonb_typeof(o.e->'evidence'->'startSec') = 'number' then (o.e->'evidence'->>'startSec')::numeric end as inicio,
             ${momento} as momento
        from negocio.analizador_llamadas l
        join negocio.analizador_analisis a on a.org_id = l.org_id and a.llamada_id = l.id
       cross join lateral jsonb_array_elements(
               case when jsonb_typeof(a.analisis->'seller'->'objections') = 'array'
                    then a.analisis->'seller'->'objections' else '[]'::jsonb end
             ) with ordinality as o(e, orden)
        left join negocio.objeciones_clasificadas c
          on c.org_id = l.org_id and c.llamada_id = l.id and c.indice = o.orden - 1 and c.huella = md5(o.e->>'objection')
       where l.tipo = 'HT' and l.estado = 'DONE' and a.coincide
         and ${momento} > now() - make_interval(days => ${alcance})
         and coalesce(btrim(o.e->>'objection'), '') <> ''`.execute(datos())
  ).rows;

  const actuales = llamadas.filter((l) => l.actual);
  const vinculos = await vinculosDe(actuales.map((l) => l.id));
  const llamadasAntes = conAnterior ? llamadas.length - actuales.length : null;

  // ── Las objeciones por categoría ──
  const deAhora = objeciones.filter((o) => o.actual);
  const cuenta = (filas: FilaDeObjecion[], c: CategoriaDeObjecion) => filas.filter((o) => o.categoria === c).length;
  const deAntes = objeciones.filter((o) => !o.actual);
  const porCategoria = CATEGORIAS_DE_OBJECION.map((categoria): ObjecionesDeUnaCategoria => {
    const ahora = cuenta(deAhora, categoria);
    const antes = conAnterior ? cuenta(deAntes, categoria) : null;
    const conPiso = antes !== null && (llamadasAntes ?? 0) >= PISO_DE_UNA_TASA;
    return { categoria, ahora, antes, crece: conPiso ? ahora > antes! && ahora >= antes! * (1 + CRECIMIENTO_QUE_SE_DICE) : null };
  })
    .filter((c) => c.ahora > 0 || (c.antes ?? 0) > 0)
    .sort((a, b) => b.ahora - a.ahora || CATEGORIAS_DE_OBJECION.indexOf(a.categoria) - CATEGORIAS_DE_OBJECION.indexOf(b.categoria));

  // ── El puntaje por closer ──
  const porCloser = new Map<string, { closer: string | null; puntajes: number[]; llamadas: number }>();
  for (const l of actuales) {
    const clave = l.closer_clave ?? '';
    const c = porCloser.get(clave) ?? { closer: l.closer, puntajes: [], llamadas: 0 };
    c.llamadas++;
    if (l.puntaje !== null) c.puntajes.push(l.puntaje);
    porCloser.set(clave, c);
  }
  const closers = [...porCloser.values()]
    .map((c): PuntajeDeCloser => ({
      closer: c.closer,
      llamadas: c.llamadas,
      puntajePromedio: c.puntajes.length >= PISO_DE_UNA_TASA ? Math.round((c.puntajes.reduce((s, x) => s + x, 0) / c.puntajes.length) * 10) / 10 : null,
    }))
    .sort((a, b) => b.llamadas - a.llamadas || (a.closer ?? '').localeCompare(b.closer ?? ''));

  // ── Las frases citables, sólo para quien las puede ver ──
  let frases: FraseCitable[] | null = null;
  if (opciones.conFrases) {
    const porLlamada = new Map(actuales.map((l) => [l.id, l]));
    frases = [];
    for (const categoria of CATEGORIAS_DE_OBJECION) {
      const deEsta = deAhora
        .filter((o) => o.categoria === categoria && (o.frase ?? '').trim() !== '')
        .sort((a, b) => b.momento.getTime() - a.momento.getTime())
        .slice(0, FRASES_POR_CATEGORIA);
      for (const o of deEsta) {
        const l = porLlamada.get(o.llamada_id)!;
        frases.push({
          categoria,
          frase: o.frase!.trim(),
          minuto: o.inicio === null ? null : Math.floor(Number(o.inicio) / 60),
          enlace: l.enlace,
          ganada: l.ganada,
        });
      }
    }
  }

  return {
    dias: periodo.dias,
    llamadas: contarVinculos(vinculos.values()),
    llamadasAntes,
    objeciones: { total: deAhora.length, clasificadas: deAhora.filter((o) => o.categoria !== null).length, porCategoria },
    closers,
    frases,
  };
}
