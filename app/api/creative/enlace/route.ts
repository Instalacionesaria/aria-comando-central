// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
//
// Cargar y sacar el link manual de una pieza de Creative (docs/creative/15, C15-06). **La lectura no
// está acá**: los links viajan con la respuesta de `GET /api/creative`, que pide `tablero.ver`.
//
// ═══════════════════════════════════════════════════════════════════════════════
// `PANTALLA = 'creative'` Y `credenciales.editar`: LAS DOS COSAS A PROPÓSITO
//
// La pantalla es Creative porque es ahí donde se carga el link, y así el portero mira también el
// alcance por sección: una persona sin la pestaña Creative no carga links de Creative.
//
// La capacidad NO es la de la pantalla, y `ADR-0304` lo permite para las mutaciones: una escritura
// que se conformara con `tablero.ver` dejaría cargar links a todo el que mira el tablero. Es
// `credenciales.editar`, la misma puerta que carga los links de pago y designa closers: la tiene
// quien administra la empresa y **no** el rol `usuario` (decidido el 2026-09-29, `C12-07`).
//
// ── SE AUDITA ────────────────────────────────────────────────────────────────
//
// Un «Ver en Facebook» que lleva a otro lado se ve igual que el bueno. Cada carga y cada borrado
// dejan fila en `identidad.auditoria_accesos`, en la MISMA transacción, con el link, la pieza y su cliente.
//
// ── LA PIEZA ES DE UN CLIENTE (el nivel 3) ───────────────────────────────────
//
// El pedido dice de qué cliente es la pieza (`cuentaId`), y tiene que ser uno de los que la sesión ve, como el foco
// (`app/api/auth/cliente/route.ts`). Sin decirlo, el principal: lo de antes del nivel 3, y lo que manda un navegador
// con el código de antes. La ruta sigue abriendo la empresa entera: Creative es de la empresa, y el cliente viaja en
// la fila, no en el ámbito.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { autorDelCambio } from '../../../../lib/autorizacion/sesion.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion, datos } from '../../../../lib/datos/contexto.ts';
import type { Contexto } from '../../../../lib/autorizacion/sesion.ts';
import { auditarAdministracion } from '../../../../lib/autenticacion/auditoria.ts';
import { borrarEnlace, enlacesDeLasPiezas, guardarEnlace } from '../../../../lib/negocio/enlaceDeLaPieza.ts';
import { LARGO_MAXIMO_DE_URL } from '../../../../lib/negocio/urlExterna.ts';

export const PANTALLA = 'creative';

/** El largo de un nombre de anuncio razonable. Una pieza más larga no es un nombre: es un error. */
const LARGO_MAXIMO_DE_PIEZA = 300;

const MOTIVOS = {
  cuerpo_invalido: 'El cuerpo de la petición no es JSON válido.',
  falta_pieza: 'No se dijo de qué pieza es el link.',
  falta_url: 'El link necesita una dirección.',
  url_invalida:
    'El link tiene que ser una dirección https:// de Facebook o de Instagram —un post, un reel o la ' +
    'vista previa que comparte el Administrador de anuncios—.',
  largo: 'La pieza o el link son demasiado largos.',
  sin_pieza: 'Esa pieza no corresponde a ningún anuncio de la empresa.',
  // El de un pedido que dijo el cliente cuando la sesión ve dos o más (el nivel 3): con uno solo, el de arriba.
  sin_pieza_del_cliente: 'Esa pieza no corresponde a ningún anuncio de ese cliente.',
  no_estaba: 'Esa pieza no tenía link.',
} as const;

/** La pieza del cuerpo o de la URL: texto no vacío y de largo razonable. No se normaliza acá. */
function piezaDe(v: unknown): string | null {
  if (typeof v !== 'string' || v === '' || v.length > LARGO_MAXIMO_DE_PIEZA) return null;
  return v;
}

/**
 * El cliente de la pieza: el del pedido, si la sesión lo ve; sin decirlo, el principal. `null` es un 404, la misma
 * respuesta que una pieza que no existe (`ADR-0501`): uno de otra empresa o de baja no se distingue.
 */
function clienteDe(contexto: Contexto, pedido: unknown): string | null {
  if (pedido === undefined || pedido === null || pedido === '') return contexto.cuentas.visibles.find((c) => c.esPorOmision)?.id ?? null;
  return typeof pedido === 'string' && contexto.cuentas.visibles.some((c) => c.id === pedido) ? pedido : null;
}

/**
 * El motivo de una pieza que no está: nombra al cliente sólo si el pedido lo dijo Y la sesión ve más de uno. El
 * navegador manda el cliente siempre, también en una empresa de un solo cliente: con mirar sólo el pedido, ahí el
 * «…de la empresa.» de siempre se volvía «…de ese cliente.» (la revisión de G1).
 */
function motivoSinPieza(contexto: Contexto, pedido: unknown): string {
  const dijoElCliente = pedido !== undefined && pedido !== null && pedido !== '';
  return MOTIVOS[dijoElCliente && contexto.cuentas.visibles.length > 1 ? 'sin_pieza_del_cliente' : 'sin_pieza'];
}

/**
 * Carga o reemplaza el link de una pieza. Cuerpo: `{ cuentaId?, pieza, url }`.
 *
 * `PUT` y no `POST`: una pieza tiene un solo link, así que mandar dos veces lo mismo deja lo mismo.
 */
export async function PUT(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return rechazo('peticion_invalida', MOTIVOS['cuerpo_invalido']);
  }
  const c = cuerpo as { cuentaId?: unknown; pieza?: unknown; url?: unknown } | null;
  const pieza = piezaDe(c?.pieza);
  if (pieza === null) return rechazo('peticion_invalida', MOTIVOS['falta_pieza']);
  const url = typeof c?.url === 'string' ? c.url.trim() : '';
  if (url === '') return rechazo('peticion_invalida', MOTIVOS['falta_url']);
  if (url.length > LARGO_MAXIMO_DE_URL) return rechazo('peticion_invalida', MOTIVOS['largo']);
  const sinPieza = motivoSinPieza(contexto, c?.cuentaId);
  const cuentaId = clienteDe(contexto, c?.cuentaId);
  if (cuentaId === null) return rechazo('no_encontrado', sinPieza);

  const porque = await conOrganizacion(contexto.orgEfectiva, async () => {
    const porque = await guardarEnlace({ cuentaId, pieza, url }, autorDelCambio(contexto));
    // Si no se guardó, no se audita: una fila que describe algo que no pasó es ruido.
    if (porque !== null) return porque;
    await auditarAdministracion(datos(), {
      accion: 'enlace_de_pieza_cargado',
      actor: contexto.usuarioId,
      objetivo: contexto.orgEfectiva,
      orgId: contexto.orgEfectiva,
      detalle: { enlace: url, pieza, cuenta: cuentaId },
    });
    return null;
  });

  if (porque === 'url_invalida') return rechazo('peticion_invalida', MOTIVOS['url_invalida']);
  /* 404 y no 400: la petición está bien formada, y lo que no existe es la pieza —de otra empresa, de
     otro cliente o de un nombre que ya no corre—. Es la misma respuesta para todo a propósito
     (`ADR-0501`): distinguirlas diría qué piezas tiene otra empresa. */
  if (porque === 'sin_pieza') return rechazo('no_encontrado', sinPieza);

  // La lista completa: quien guardó tiene que ver lo que quedó.
  return ok({ enlaces: await conOrganizacion(contexto.orgEfectiva, enlacesDeLasPiezas) });
}

/** Saca el link de una pieza: `DELETE /api/creative/enlace?pieza=…&cuentaId=…` (sin el cliente, el principal). */
export async function DELETE(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const parametros = new URL(peticion.url).searchParams;
  const pieza = piezaDe(parametros.get('pieza'));
  if (pieza === null) return rechazo('peticion_invalida', MOTIVOS['falta_pieza']);
  const cuentaId = clienteDe(contexto, parametros.get('cuentaId'));
  if (cuentaId === null) return rechazo('no_encontrado', MOTIVOS['no_estaba']);

  const sacado = await conOrganizacion(contexto.orgEfectiva, async () => {
    const url = await borrarEnlace({ cuentaId, pieza });
    if (url === null) return false;
    /* Se audita el link que se SACÓ: después de borrarlo, la fila de auditoría es lo único que
       queda para reconstruir cuál era. */
    await auditarAdministracion(datos(), {
      accion: 'enlace_de_pieza_borrado',
      actor: contexto.usuarioId,
      objetivo: contexto.orgEfectiva,
      orgId: contexto.orgEfectiva,
      detalle: { enlace: url, pieza, cuenta: cuentaId },
    });
    return true;
  });

  if (!sacado) return rechazo('no_encontrado', MOTIVOS['no_estaba']);
  return ok({ enlaces: await conOrganizacion(contexto.orgEfectiva, enlacesDeLasPiezas) });
}
