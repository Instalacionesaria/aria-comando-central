// La categoría de cada objeción de una llamada de venta analizada (AG11 de los agentes; `T-18`;
// `docs/OTROS/agentes/fichas/F14-LLAMADAS-DE-VENTA.md`). El único escritor de `negocio.objeciones_clasificadas`
// (migración 073).
//
// ═══════════════════════════════════════════════════════════════════════════════
// UNA VEZ, EN LA TAREA, Y POR RECONCILIACIÓN
//
// El análisis HT guarda cada objeción como texto libre. Contar texto libre no dice nada —«me preocupa el
// precio» y «es caro» serían dos objeciones distintas—, así que Haiku le pone una categoría de un juego
// cerrado, una vez, en la tarea del analizador. Clasifica lo que falta: la objeción sin fila, o con una fila de
// otra huella (la llamada se volvió a analizar y el texto cambió). Lo que falló o no entró en el tiempo de la
// corrida se clasifica en la siguiente, sin una cola aparte.
//
// Una pedida por llamada, con todas sus objeciones juntas: son pocas por llamada y comparten el contexto.
//
// ── LO QUE SE VALIDA DE LA RESPUESTA ────────────────────────────────────────
//
// El formato estricto ya cierra la categoría al juego; además se descarta un índice que no se pidió y el
// segundo de un mismo índice. Lo que el modelo no devolvió queda sin categoría y se pide otra vez.
//
// Las filas de una objeción que ya no existe (la llamada se volvió a analizar con menos) no se borran: quien
// lee junta por índice **y** huella con el análisis vigente, así que una fila vieja no cuenta.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { llamarAlModelo, leerJson } from '../agentes/llamada.ts';
import { MODELO_DE_LAS_OBJECIONES } from '../agentes/modelos.ts';
import { enOrganizacion } from './datos.ts';
import { MARGEN_MS, type QuienPide, type Reloj } from './pipeline.ts';

import { CATEGORIAS_DE_OBJECION, type CategoriaDeObjecion } from './categorias.ts';

export { CATEGORIAS_DE_OBJECION, type CategoriaDeObjecion };

/** La espera de una clasificación: unas pocas frases y una respuesta corta. */
export const ESPERA_DE_LA_CLASIFICACION_MS = 30_000;
/** `max_tokens`: una categoría y un índice por objeción. */
const TECHO_DE_LA_CLASIFICACION = 1024;

export interface ObjecionSinClasificar {
  indice: number;
  huella: string;
  texto: string;
}

export interface LlamadaConObjeciones {
  llamadaId: string;
  objeciones: ObjecionSinClasificar[];
}

/**
 * Las llamadas de venta analizadas con alguna objeción sin categoría vigente, de la más vieja a la más nueva,
 * con sólo esas objeciones. `limite` cuenta llamadas, no objeciones.
 */
export async function objecionesSinClasificar(orgId: string, limite: number): Promise<LlamadaConObjeciones[]> {
  const filas = await enOrganizacion(orgId, async () =>
    (
      await sql<{ llamada_id: string; indice: number; huella: string; texto: string }>`
        with pendientes as (
          select l.id as llamada_id, l.creado_el, o.indice, md5(o.texto) as huella, o.texto
            from negocio.analizador_llamadas l
            join negocio.analizador_analisis a on a.org_id = l.org_id and a.llamada_id = l.id
           cross join lateral (
             select (x.orden - 1)::int as indice, x.e->>'objection' as texto
               from jsonb_array_elements(
                      case when jsonb_typeof(a.analisis->'seller'->'objections') = 'array'
                           then a.analisis->'seller'->'objections' else '[]'::jsonb end
                    ) with ordinality as x(e, orden)
           ) o
           where l.tipo = 'HT' and l.estado = 'DONE' and a.coincide
             and o.texto is not null and btrim(o.texto) <> ''
             and not exists (
               select 1 from negocio.objeciones_clasificadas c
                where c.org_id = l.org_id and c.llamada_id = l.id and c.indice = o.indice and c.huella = md5(o.texto)
             )
        ),
        llamadas as (
          select llamada_id, min(creado_el) as creado_el from pendientes group by llamada_id order by 2, 1 limit ${limite}
        )
        select p.llamada_id, p.indice, p.huella, p.texto
          from pendientes p join llamadas using (llamada_id)
         order by llamadas.creado_el, p.llamada_id, p.indice`.execute(datos())
    ).rows,
  );
  const porLlamada = new Map<string, ObjecionSinClasificar[]>();
  for (const f of filas) porLlamada.set(f.llamada_id, [...(porLlamada.get(f.llamada_id) ?? []), { indice: f.indice, huella: f.huella, texto: f.texto }]);
  return [...porLlamada].map(([llamadaId, objeciones]) => ({ llamadaId, objeciones }));
}

export const INSTRUCCIONES_DE_LAS_OBJECIONES = `Clasificas objeciones que un prospecto puso en una llamada de venta. Cada objeción va a UNA de estas categorías:

- precio: el costo, la inversión, el dinero, que es caro o no le alcanza.
- momento: no es el momento, quiere esperar, no tiene tiempo ahora.
- decisor: tiene que consultarlo o decidirlo con otra persona.
- confianza: duda de que funcione, de los resultados prometidos o de la empresa.
- encaje: no es para su negocio, su nicho o su situación.
- otra: ninguna de las anteriores.

Devuelve una categoría por objeción, con el mismo índice que trae. No agregues índices.`;

const FORMATO = {
  type: 'object',
  additionalProperties: false,
  required: ['categorias'],
  properties: {
    categorias: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['indice', 'categoria'],
        properties: { indice: { type: 'integer' }, categoria: { type: 'string', enum: [...CATEGORIAS_DE_OBJECION] } },
      },
    },
  },
};

/** Lo que vale de la respuesta: un índice pedido, una categoría del juego, el primero de cada índice. */
export function validarCategorias(pedidas: readonly ObjecionSinClasificar[], respuesta: unknown): Map<number, CategoriaDeObjecion> {
  const salida = new Map<number, CategoriaDeObjecion>();
  const lista = (respuesta as { categorias?: unknown } | null)?.categorias;
  if (!Array.isArray(lista)) return salida;
  const indices = new Set(pedidas.map((o) => o.indice));
  for (const c of lista) {
    const indice = (c as { indice?: unknown })?.indice;
    const categoria = (c as { categoria?: unknown })?.categoria;
    if (typeof indice !== 'number' || !indices.has(indice) || salida.has(indice)) continue;
    if (!(CATEGORIAS_DE_OBJECION as readonly unknown[]).includes(categoria)) continue;
    salida.set(indice, categoria as CategoriaDeObjecion);
  }
  return salida;
}

export interface ResultadoDeLasObjeciones {
  /** Cuántas veces se le habló al modelo. */
  pedidas: number;
  /** Las objeciones que quedaron con categoría. */
  clasificadas: number;
  /** Las llamadas cuya pedida falló: se piden otra vez en la corrida siguiente. */
  fallidas: number;
  /** Las llamadas que quedaron sin pedir porque no alcanzó el tiempo. */
  sinTiempo: number;
  llaveRechazada: boolean;
  saturado: boolean;
}

/** Cuántas llamadas se miran por corrida. Más de las que caben: el reloj es el que corta. */
const LLAMADAS_POR_CORRIDA = 10;

/** Clasifica lo que falta de UNA empresa, mientras quepa una pedida entera. */
export async function clasificarObjeciones(orgId: string, llave: string, reloj: Reloj, quien: QuienPide = {}): Promise<ResultadoDeLasObjeciones> {
  const out: ResultadoDeLasObjeciones = { pedidas: 0, clasificadas: 0, fallidas: 0, sinTiempo: 0, llaveRechazada: false, saturado: false };
  const pendientes = await objecionesSinClasificar(orgId, LLAMADAS_POR_CORRIDA);
  for (const [i, l] of pendientes.entries()) {
    if (reloj.fin - reloj.ahora() < ESPERA_DE_LA_CLASIFICACION_MS + MARGEN_MS) {
      out.sinTiempo = pendientes.length - i;
      break;
    }
    out.pedidas++;
    const r = await llamarAlModelo({
      agente: 'objeciones',
      modelo: MODELO_DE_LAS_OBJECIONES,
      llave,
      orgId,
      usuarioId: quien.usuarioId ?? null,
      ref: l.llamadaId,
      donde: 'la categoría de las objeciones de una llamada',
      techo: TECHO_DE_LA_CLASIFICACION,
      instrucciones: INSTRUCCIONES_DE_LAS_OBJECIONES,
      mensajes: [{ role: 'user', content: JSON.stringify({ objeciones: l.objeciones.map((o) => ({ indice: o.indice, texto: o.texto })) }) }],
      formato: FORMATO,
      espera: ESPERA_DE_LA_CLASIFICACION_MS,
      // En la tarea, los fallos de la corrida van al grupo de incidentes de la tarea: uno por situación.
      incidentes: quien.incidentes ? 'los_agrega_quien_llama' : 'cada_llamada',
      leer: leerJson,
    });
    if (r.tipo === 'fallo') {
      if (quien.incidentes) await quien.incidentes.anotar(r.fallo, 'la categoría de las objeciones');
      // Con la llave rechazada o el proveedor saturado, cada pedida siguiente repetiría el fallo.
      if (r.situacion === 'IA-LLAVE') {
        out.llaveRechazada = true;
        break;
      }
      if (r.situacion === 'IA-SATURADO') {
        out.saturado = true;
        break;
      }
      out.fallidas++;
      continue;
    }
    const categorias = validarCategorias(l.objeciones, r.datos);
    if (categorias.size === 0) continue;
    await enOrganizacion(orgId, async () => {
      for (const o of l.objeciones) {
        const categoria = categorias.get(o.indice);
        if (!categoria) continue;
        const columnas = { huella: o.huella, categoria, modelo: r.modelo, clasificada_el: new Date() };
        await datos()
          .insertInto('objeciones_clasificadas')
          .values({ llamada_id: l.llamadaId, indice: o.indice, ...columnas })
          .onConflict((oc) => oc.columns(['org_id', 'llamada_id', 'indice']).doUpdateSet(columnas))
          .execute();
      }
    });
    out.clasificadas += categorias.size;
  }
  return out;
}
