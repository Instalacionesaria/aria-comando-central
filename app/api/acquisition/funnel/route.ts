// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
//
// Asignar y quitar el funnel de una campaña en Acquisition (docs/acquisition/14, A14-03). **La lectura
// no está acá**: las asignaciones van a viajar con la respuesta de `GET /api/acquisition` (AQ-3), que
// pide `tablero.ver`.
//
// ═══════════════════════════════════════════════════════════════════════════════
// `PANTALLA = 'acquisition'` Y `credenciales.editar`: LAS DOS COSAS A PROPÓSITO
//
// La pantalla es Acquisition porque es ahí donde se asigna, y así el portero mira también el alcance
// por sección: una persona sin la pestaña Acquisition no reparte campañas.
//
// La capacidad NO es la de la pantalla, y `ADR-0304` lo permite para las mutaciones: con `tablero.ver`
// cualquiera que mira el tablero podría mover una campaña de funnel y cambiar las tres tarjetas. Es
// `credenciales.editar`, la misma puerta que el link manual de Creative y los links de pago: la tiene
// quien administra la empresa y **no** el rol `usuario` (`A14-P02`).
//
// ── SE AUDITA ────────────────────────────────────────────────────────────────
//
// Una campaña en el funnel equivocado se ve igual de bien que en el bueno. Cada asignación y cada
// quita dejan fila en `identidad.auditoria_accesos`, en la MISMA transacción, con la campaña y el
// funnel.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { autorDelCambio } from '../../../../lib/autorizacion/sesion.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion, datos } from '../../../../lib/datos/contexto.ts';
import { auditarAdministracion } from '../../../../lib/autenticacion/auditoria.ts';
import {
  asignarFunnel,
  funnelValido,
  funnelsDeLasCampanas,
  quitarFunnel,
} from '../../../../lib/negocio/funnelDeLaCampana.ts';

export const PANTALLA = 'acquisition';

/**
 * El largo de un identificador de campaña razonable. Los de Meta tienen dieciocho dígitos; uno de más
 * de sesenta y cuatro ya no es un identificador, es un error.
 */
const LARGO_MAXIMO_DE_CAMPANA = 64;

const MOTIVOS = {
  cuerpo_invalido: 'El cuerpo de la petición no es JSON válido.',
  falta_campana: 'No se dijo qué campaña.',
  largo: 'El identificador de la campaña es demasiado largo.',
  funnel_invalido:
    'El funnel tiene que ser uno de los tres: leadform (Lead form ads), profile (Profile funnel) o ' +
    'booking (Booking directo).',
  /* Verdadero en los tres casos que caen acá, y por eso no dice «no es de la empresa»: una campaña de
     otra empresa, una que no existe, y una de la empresa que GoHighLevel todavía no listó —la tabla
     de campañas se llena en la pasada diaria del cron—. Una sola respuesta para los tres (`ADR-0501`). */
  sin_campana: 'Esa campaña no está entre las que GoHighLevel listó para la empresa.',
  no_estaba: 'Esa campaña no tenía funnel.',
} as const;

/**
 * La campaña del cuerpo o de la URL: texto no vacío y de largo razonable. No se normaliza acá.
 *
 * Devuelve el motivo del rechazo y no un `null`, para que «no se dijo» y «demasiado larga» no digan
 * lo mismo.
 */
function campanaDe(v: unknown): { campana: string } | { motivo: 'falta_campana' | 'largo' } {
  if (typeof v !== 'string' || v === '') return { motivo: 'falta_campana' };
  if (v.length > LARGO_MAXIMO_DE_CAMPANA) return { motivo: 'largo' };
  return { campana: v };
}

/**
 * Asigna o reemplaza el funnel de una campaña. Cuerpo: `{ campana, funnel }`.
 *
 * `PUT` y no `POST`: una campaña tiene un solo funnel, así que mandar dos veces lo mismo deja lo mismo.
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
  const c = cuerpo as { campana?: unknown; funnel?: unknown } | null;
  const leida = campanaDe(c?.campana);
  if ('motivo' in leida) return rechazo('peticion_invalida', MOTIVOS[leida.motivo]);
  const { campana } = leida;
  const funnel = funnelValido(c?.funnel);
  if (funnel === null) return rechazo('peticion_invalida', MOTIVOS['funnel_invalido']);

  const porque = await conOrganizacion(contexto.orgEfectiva, async () => {
    const porque = await asignarFunnel({ campana, funnel }, autorDelCambio(contexto));
    // Si no se guardó, no se audita: una fila que describe algo que no pasó es ruido.
    if (porque !== null) return porque;
    await auditarAdministracion(datos(), {
      accion: 'funnel_de_campana_asignado',
      actor: contexto.usuarioId,
      objetivo: contexto.orgEfectiva,
      orgId: contexto.orgEfectiva,
      detalle: { campana, funnel },
    });
    return null;
  });

  // La ruta ya validó el funnel, así que el escritor sólo puede decir `sin_campana`; el otro motivo
  // se traduce igual, para que una validación que se aflojara acá no termine en un 200.
  if (porque === 'funnel_invalido') return rechazo('peticion_invalida', MOTIVOS['funnel_invalido']);
  /* 404 y no 400: la petición está bien formada, y lo que no existe es la campaña —de otra empresa,
     o una que GoHighLevel todavía no listó—. Es la misma respuesta para las dos cosas a propósito
     (`ADR-0501`): distinguirlas diría qué campañas tiene otra empresa. */
  if (porque === 'sin_campana') return rechazo('no_encontrado', MOTIVOS['sin_campana']);

  // La lista completa: quien asignó tiene que ver lo que quedó.
  return ok({ funnels: await conOrganizacion(contexto.orgEfectiva, funnelsDeLasCampanas) });
}

/** Quita el funnel de una campaña: `DELETE /api/acquisition/funnel?campana=…`. Vuelve a «Sin funnel». */
export async function DELETE(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const leida = campanaDe(new URL(peticion.url).searchParams.get('campana'));
  if ('motivo' in leida) return rechazo('peticion_invalida', MOTIVOS[leida.motivo]);
  const { campana } = leida;

  const quitado = await conOrganizacion(contexto.orgEfectiva, async () => {
    const funnel = await quitarFunnel(campana);
    if (funnel === null) return false;
    /* Se audita el funnel que se QUITÓ: después de borrarlo, la fila de auditoría es lo único que
       queda para reconstruir en cuál estaba. */
    await auditarAdministracion(datos(), {
      accion: 'funnel_de_campana_quitado',
      actor: contexto.usuarioId,
      objetivo: contexto.orgEfectiva,
      orgId: contexto.orgEfectiva,
      detalle: { campana, funnel },
    });
    return true;
  });

  if (!quitado) return rechazo('no_encontrado', MOTIVOS['no_estaba']);
  return ok({ funnels: await conOrganizacion(contexto.orgEfectiva, funnelsDeLasCampanas) });
}
