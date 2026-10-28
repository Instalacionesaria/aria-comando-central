// El link manual de cada pieza de Creative. **El único escritor de `negocio.enlaces_de_pieza`.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// PARA QUÉ, Y LO QUE NO ES
//
// Es el respaldo del video (docs/2-departamentos/creative/15, C15-06): para la pieza cuyo video Meta no entregue,
// alguien pega el link del post o del reel y la pantalla lo ofrece como «Ver en Facebook /
// Instagram». **Es un enlace y nada más**: no se reproduce, no se embebe, no se descarga.
//
// ── LA PIEZA SE BUSCA CON LA LLAVE DE LA BASE, NO CON LA DE JAVASCRIPT ─────
//
// La pieza que llega es la que la pantalla recibió de `rendimientoDelCreativo`, que ya viene
// normalizada por la base. Acá NO se vuelve a normalizar con `.trim().toLowerCase()`: sería una
// segunda definición de «la misma pieza», y `creativo.ts` explica por qué no son equivalentes. Se
// compara contra `llaveDelCreativo('nombre')` de `negocio.anuncios` —la única definición—, y una
// pieza que no casa con ningún anuncio de la empresa es una pieza que no existe.
//
// Y la base lo hace cumplir por su lado: el `check` de la 063 rechaza una pieza sin normalizar.
//
// ── LA PIEZA ES (CLIENTE, NOMBRE) (el nivel 3) ─────────────────────────────
//
// Dos clientes de una empresa pueden tener una pieza con el mismo nombre, y son dos piezas con dos links. El link se
// escribe con su cliente, la pieza existe si un anuncio DE ESE CLIENTE lleva su nombre, y la `095` lo hace cumplir en
// la clave: (org_id, cuenta_id, pieza).
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';

import { datos } from '../datos/contexto.ts';
import { llaveDelCreativo } from './creativo.ts';
import { enlaceDePublicacion, type Red } from './urlExterna.ts';

/** Un link manual, tal como lo dibuja la pantalla. */
export interface EnlaceDePieza {
  /** El cliente de la pieza (el nivel 3). */
  cuentaId: string;
  pieza: string;
  url: string;
  red: Red;
  /** Cuándo se cargó por última vez, en ISO. El link manual no vence, pero sí envejece. */
  actualizadoEl: string;
}

/**
 * Si la pieza existe: al menos un anuncio DE ESE CLIENTE lleva ese nombre, normalizado. Un nombre que sólo tiene otro
 * cliente de la empresa es una pieza que no existe.
 */
export async function existeLaPieza(cuentaId: string, pieza: string): Promise<boolean> {
  const fila = await datos()
    .selectFrom('anuncios')
    .select(sql<number>`1`.as('hay'))
    .where('cuenta_id', '=', cuentaId)
    .where(sql<boolean>`${llaveDelCreativo('nombre')} = ${pieza}`)
    .limit(1)
    .executeTakeFirst();
  return fila !== undefined;
}

/**
 * Los links de la empresa, por pieza y su cliente.
 *
 * Un link guardado que HOY no pasa la validación —porque la lista de hosts cambió, o porque alguien
 * lo escribió a mano en la base saltándose la ruta— **no viaja**. Dibujarlo sería ofrecer un «Ver en
 * Facebook» que lleva a otro lado, que es justo lo que la validación existe para impedir.
 */
export async function enlacesDeLasPiezas(): Promise<EnlaceDePieza[]> {
  const filas = await datos()
    .selectFrom('enlaces_de_pieza')
    .select(['cuenta_id', 'pieza', 'url', 'actualizado_el'])
    .orderBy('pieza')
    .orderBy('cuenta_id')
    .execute();

  const salida: EnlaceDePieza[] = [];
  for (const f of filas) {
    const valido = enlaceDePublicacion(f.url);
    if (valido === null) continue;
    salida.push({
      cuentaId: f.cuenta_id,
      pieza: f.pieza,
      url: valido.url,
      red: valido.red,
      actualizadoEl: new Date(f.actualizado_el).toISOString(),
    });
  }
  return salida;
}

/**
 * Carga o reemplaza el link de una pieza. Una pieza tiene UN link: el segundo reemplaza al primero.
 *
 * La URL tiene que llegar ya validada por la ruta con `enlaceDePublicacion`; acá se vuelve a mirar
 * igual, porque este archivo es el único escritor y no puede depender de que todos los que lo llamen
 * se acuerden.
 *
 * @returns `null` si se guardó, o por qué no.
 */
export async function guardarEnlace(
  /** `cuentaId`: el cliente de la pieza, ya comprobado por la ruta contra los que ve la sesión. */
  enlace: { cuentaId: string; pieza: string; url: string },
  /** `null` cuando lo carga un rol de plataforma sobre otra organización (`autorDelCambio`). */
  actor: string | null,
): Promise<'sin_pieza' | 'url_invalida' | null> {
  const valido = enlaceDePublicacion(enlace.url);
  if (valido === null) return 'url_invalida';
  if (!(await existeLaPieza(enlace.cuentaId, enlace.pieza))) return 'sin_pieza';

  const ahora = new Date();
  await datos()
    .insertInto('enlaces_de_pieza')
    .values({ cuenta_id: enlace.cuentaId, pieza: enlace.pieza, url: valido.url, actualizado_el: ahora, actualizado_por: actor } as never)
    /* La clave de la `095`. El cliente de una fila no se actualiza nunca —el puente, `completar_cuenta`, lo impide— y
       el link de otro cliente es otra fila. */
    .onConflict((oc) =>
      oc.columns(['org_id', 'cuenta_id', 'pieza']).doUpdateSet({
        url: valido.url,
        actualizado_el: ahora,
        actualizado_por: actor,
      } as never),
    )
    .execute();
  return null;
}

/**
 * Saca el link de una pieza.
 *
 * Una sola sentencia con `returning`, y no un `select` seguido de un `delete`: con dos, dos borrados
 * simultáneos auditaban los dos, y un borrado junto a un reemplazo auditaba el link de antes del
 * reemplazo. Es el mismo defecto que la revisión de AQ-2 encontró en `quitarFunnel`, que copió este
 * molde.
 *
 * @returns el link que se sacó —para que la auditoría diga CUÁL—, o `null` si no había ninguno.
 */
export async function borrarEnlace(enlace: { cuentaId: string; pieza: string }): Promise<string | null> {
  const borrada = await datos()
    .deleteFrom('enlaces_de_pieza')
    .where('cuenta_id', '=', enlace.cuentaId)
    .where('pieza', '=', enlace.pieza)
    .returning('url')
    .executeTakeFirst();
  return borrada?.url ?? null;
}
