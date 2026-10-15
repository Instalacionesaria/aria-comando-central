// Traer de Meta la miniatura y el post de cada anuncio, y guardarlos en `negocio.activos_de_anuncio` (078).
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA TAREA `activos`, CADA HORA (`lib/negocio/barrido.ts`, `HORARIOS`)
//
// Es reconciliación, como el colector de anuncios: cada pasada mira qué falta y lo pide. Falta un anuncio si:
//   · nunca se leyó;
//   · se leyó hace más de un día (un anuncio puede cambiar de creativo);
//   · su miniatura vence en las próximas seis horas: la firma `oe` del CDN de Meta caduca, y una miniatura vencida no
//     se dibuja. Pedirla antes de que venza es lo que hace que la pantalla nunca muestre una imagen rota.
// Primero los que entregaron hace menos, que son los que la pantalla muestra.
//
// Sin token de Meta la tarea queda `saltada` con su texto, sin llamar a nadie: es el estado de toda empresa que todavía
// no lo cargó. Este archivo es el ÚNICO que escribe la tabla (la prueba 256).
// ═══════════════════════════════════════════════════════════════════════════════
import { sql } from 'kysely';
import { conOrganizacion, datos } from '../datos/contexto.ts';
import { leerCreativos, type CreativoDeMeta } from '../meta/anuncios.ts';
import { llaveOSinCreativo } from './creativo.ts';
import type { FallaDeMeta } from '../meta/graph.ts';
import { enlaceDePublicacion, LARGO_MAXIMO_DE_MINIATURA, LARGO_MAXIMO_DE_URL, medioPermitido } from './urlExterna.ts';

/** Cuántos anuncios por pasada: con lotes de 50, son ocho pedidos a Meta en el caso normal. */
export const TOPE_DE_ANUNCIOS_POR_PASADA = 200;

/** Cuánto tiempo puede tomar la pasada de una empresa. El presupuesto de la corrida entera es de 240 s. */
export const PRESUPUESTO_DE_ACTIVOS_MS = 90_000;

/** Con cuánta anticipación se vuelve a pedir una miniatura que va a vencer. */
const ANTICIPACION_HORAS = 6;

/** Cuánto vale una lectura sin firma `oe`: un día, y después se vuelve a pedir. */
const VIGENCIA_SIN_FIRMA_MS = 24 * 3600_000;

/** La fila que se guarda. */
export interface FilaDeActivo {
  meta_anuncio_id: string;
  meta_creativo_id: string | null;
  tipo_de_objeto: string | null;
  miniatura_url: string | null;
  miniatura_caduca_el: Date | null;
  publicacion_url: string | null;
  motivo: 'sin_creativo' | 'cuenta_ajena' | 'no_existe' | 'sin_miniatura' | null;
}

/**
 * Cuándo vence una URL firmada del CDN de Meta: el parámetro `oe`, en hexadecimal, son los segundos Unix del
 * vencimiento. Sin `oe` legible, `ahora` + un día.
 */
export function vencimientoDeLaFirma(url: string, ahora: number): Date {
  try {
    const oe = new URL(url).searchParams.get('oe');
    if (oe && /^[0-9a-f]{6,12}$/i.test(oe)) return new Date(parseInt(oe, 16) * 1000);
  } catch {
    /* una URL que no se puede leer no llega acá: la filtró `medioPermitido` */
  }
  return new Date(ahora + VIGENCIA_SIN_FIRMA_MS);
}

/** El post del anuncio: el permalink de Instagram, o el post de la Página en Facebook. Sólo hosts permitidos. */
export function publicacionDelCreativo(c: CreativoDeMeta): string | null {
  const instagram = c.instagram === null ? null : enlaceDePublicacion(c.instagram, LARGO_MAXIMO_DE_URL);
  if (instagram) return instagram.url;
  const historia = c.historia?.match(/^(\d{3,25})_(\d{3,25})$/);
  if (historia) {
    const facebook = enlaceDePublicacion(`https://www.facebook.com/${historia[1]}/posts/${historia[2]}`, LARGO_MAXIMO_DE_URL);
    if (facebook) return facebook.url;
  }
  return null;
}

/**
 * Lo leído de un anuncio, traducido a la fila. Pura. `cuentaId` es la cuenta cargada (`act_…`): un anuncio de otra
 * cuenta que el token alcance a ver se descarta (`C15-11`), no se muestra en esta empresa.
 */
export function filaDelActivo(anuncio: string, leido: CreativoDeMeta | 'no_existe', cuentaId: string, ahora: number): FilaDeActivo {
  const vacia = { meta_anuncio_id: anuncio, meta_creativo_id: null, tipo_de_objeto: null, miniatura_url: null, miniatura_caduca_el: null, publicacion_url: null };
  if (leido === 'no_existe') return { ...vacia, motivo: 'no_existe' };
  if (leido.cuenta !== null && `act_${leido.cuenta}` !== cuentaId) return { ...vacia, motivo: 'cuenta_ajena' };
  if (leido.creativo === null) return { ...vacia, motivo: 'sin_creativo' };
  // La imagen entera primero (los anuncios de foto), y si no, la miniatura del video. Sólo del CDN de Meta.
  const miniatura = [leido.imagen, leido.miniatura].find((u) => u !== null && medioPermitido(u, LARGO_MAXIMO_DE_MINIATURA)) ?? null;
  return {
    meta_anuncio_id: anuncio,
    meta_creativo_id: leido.creativo,
    tipo_de_objeto: leido.tipo,
    miniatura_url: miniatura,
    miniatura_caduca_el: miniatura === null ? null : vencimientoDeLaFirma(miniatura, ahora),
    publicacion_url: publicacionDelCreativo(leido),
    motivo: miniatura === null ? 'sin_miniatura' : null,
  };
}

/** Los anuncios que hay que pedir, primero los que entregaron hace menos. Corre dentro de `conOrganizacion`. */
export async function anunciosPorLeer(tope = TOPE_DE_ANUNCIOS_POR_PASADA): Promise<string[]> {
  const filas = await datos()
    .selectFrom('anuncios as a')
    .leftJoin('activos_de_anuncio as x', (j) =>
      j.onRef('x.org_id', '=', 'a.org_id').onRef('x.meta_anuncio_id', '=', 'a.meta_anuncio_id'),
    )
    .select('a.meta_anuncio_id')
    .where(sql<boolean>`(
      x.meta_anuncio_id is null
      or x.leido_el < now() - interval '1 day'
      or (x.miniatura_caduca_el is not null and x.miniatura_caduca_el < now() + make_interval(hours => ${ANTICIPACION_HORAS}))
    )`)
    .orderBy(sql`(select max(m.fecha) from negocio.metricas_de_anuncio m
                   where m.org_id = a.org_id and m.meta_anuncio_id = a.meta_anuncio_id) desc nulls last`)
    .orderBy('a.meta_anuncio_id')
    .limit(tope)
    .execute();
  return filas.map((f) => f.meta_anuncio_id);
}

/** Guarda lo leído, reescribiendo lo que había. Corre dentro de `conOrganizacion`. */
export async function guardarActivos(filas: readonly FilaDeActivo[]): Promise<void> {
  if (filas.length === 0) return;
  await datos()
    .insertInto('activos_de_anuncio')
    .values(filas.map((f) => ({ ...f, leido_el: sql`now()` })) as never)
    .onConflict((oc) =>
      oc.columns(['org_id', 'meta_anuncio_id']).doUpdateSet({
        meta_creativo_id: sql`excluded.meta_creativo_id`,
        tipo_de_objeto: sql`excluded.tipo_de_objeto`,
        miniatura_url: sql`excluded.miniatura_url`,
        miniatura_caduca_el: sql`excluded.miniatura_caduca_el`,
        publicacion_url: sql`excluded.publicacion_url`,
        motivo: sql`excluded.motivo`,
        leido_el: sql`excluded.leido_el`,
      } as never),
    )
    .execute();
}

/** Lo de Meta que la pantalla muestra de una pieza. Cada uno puede faltar por separado. */
export interface ActivoDeLaPieza {
  /** La miniatura vigente: una vencida no viaja, porque el CDN ya no la entrega y la tarjeta mostraría un hueco. */
  miniatura: string | null;
  /** El post del anuncio en Instagram o Facebook. */
  publicacion: string | null;
}

/**
 * Lo leído de Meta, por pieza (`llaveDelCreativo` del nombre del anuncio, la llave de toda la pantalla). Una pieza
 * junta varios anuncios: gana el que más impresiones tuvo en toda su historia, por separado para la miniatura y para
 * el post —el anuncio más visto puede no tener post y otro sí—; empate, el id menor. Sin ventana, como la miniatura
 * de los contactos: la imagen de la pieza no depende del período. Corre dentro de `conOrganizacion`.
 */
export async function activosDeLasPiezas(): Promise<Map<string, ActivoDeLaPieza>> {
  const pieza = llaveOSinCreativo('a.nombre');
  const filas = await datos()
    .selectFrom('activos_de_anuncio as x')
    .innerJoin('anuncios as a', (j) => j.onRef('a.org_id', '=', 'x.org_id').onRef('a.meta_anuncio_id', '=', 'x.meta_anuncio_id'))
    .select([
      pieza.as('pieza'),
      sql<string | null>`case when x.miniatura_caduca_el > now() then x.miniatura_url end`.as('miniatura'),
      'x.publicacion_url as publicacion',
    ])
    .where(sql<boolean>`${pieza} is not null`)
    .where(sql<boolean>`(x.miniatura_caduca_el > now() or x.publicacion_url is not null)`)
    .orderBy(sql`(select sum(m.impresiones) from negocio.metricas_de_anuncio m
                   where m.org_id = x.org_id and m.meta_anuncio_id = x.meta_anuncio_id) desc nulls last`)
    .orderBy('x.meta_anuncio_id')
    .execute();
  const salida = new Map<string, ActivoDeLaPieza>();
  for (const f of filas) {
    if (f.pieza === null) continue; // ya filtrado en la consulta; acá sólo lo sabe el tipo
    const ya = salida.get(f.pieza) ?? { miniatura: null, publicacion: null };
    salida.set(f.pieza, { miniatura: ya.miniatura ?? f.miniatura, publicacion: ya.publicacion ?? f.publicacion });
  }
  return salida;
}

export interface ResultadoDeActivos {
  pedidos: number;
  guardados: number;
  conMiniatura: number;
  /** Por qué se cortó la pasada, si se cortó: lo que Meta rechazó, o el tiempo. */
  corte: FallaDeMeta | 'tiempo' | null;
}

/** Una pasada para una empresa con su acceso a Meta ya resuelto (`resolverAccesoAMeta` = `listo`). */
export async function recolectarActivos(
  orgId: string,
  meta: { token: string; cuentaId: string },
  ahora: () => number = Date.now,
): Promise<{ corrio: true; resultado: ResultadoDeActivos; llamadas: number }> {
  const hasta = ahora() + PRESUPUESTO_DE_ACTIVOS_MS;
  const ids = await conOrganizacion(orgId, () => anunciosPorLeer());
  if (ids.length === 0) {
    return { corrio: true, resultado: { pedidos: 0, guardados: 0, conMiniatura: 0, corte: null }, llamadas: 0 };
  }
  const lectura = await leerCreativos(meta.token, ids, hasta, ahora);
  if (lectura.tipo === 'falla') {
    return { corrio: true, resultado: { pedidos: ids.length, guardados: 0, conMiniatura: 0, corte: lectura.motivo }, llamadas: lectura.llamadas };
  }
  const momento = ahora();
  const filas = [...lectura.anuncios].map(([anuncio, leido]) => filaDelActivo(anuncio, leido, meta.cuentaId, momento));
  await conOrganizacion(orgId, () => guardarActivos(filas));
  return {
    corrio: true,
    resultado: {
      pedidos: ids.length,
      guardados: filas.length,
      conMiniatura: filas.filter((f) => f.miniatura_url !== null).length,
      corte: lectura.incompleto ? 'tiempo' : null,
    },
    llamadas: lectura.llamadas,
  };
}
