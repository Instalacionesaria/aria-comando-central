// Abrir un tema de la Reunión de hoy como conversación (AG15 de los agentes;
// `docs/OTROS/agentes/04-LA-REUNION-Y-LA-CABECERA.md`, AG-74).
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUIÉN Y CÓMO
//
//   · `cerebro.usar`, como preguntar y borrar en el Inicio: abrir un tema escribe un hilo del cerebro a nombre
//     de quien lo toca (`D-14`). Sin esa capacidad las tarjetas se ven, pero no se abren.
//   · No llama al modelo ni pide la llave, y no cuenta para el tope: el primer intercambio lo arma el servidor
//     con lo que guardó la pasada (`lib/agentes/reunion/leer.ts`).
//   · Sólo un tema de una sección que la persona ve: el de otra da 404, como uno que no existe.
//   · Bajo delegación no se escribe nada (`D-17`): el cerebro se apaga, y un hilo de la principal dentro de un
//     cliente no tiene dueño posible.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../../lib/datos/contexto.ts';
import { seccionesVisibles } from '../../../../lib/agentes/executive/caja.ts';
import { abrirTema } from '../../../../lib/agentes/reunion/leer.ts';

export const PANTALLA = 'executive';

/** `{ tema }`: la clave de un tema de la última Reunión. Devuelve `{ hilo }`. */
export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['cerebro.usar'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  if (contexto.mirandoOtraOrganizacion) {
    return rechazo('cerebro_bajo_delegacion', 'Estás mirando otra empresa: los temas de la Reunión se abren desde la empresa.');
  }
  let cuerpo: { tema?: unknown } | null;
  try {
    cuerpo = (await peticion.json()) as typeof cuerpo;
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo no es JSON.');
  }
  const tema = cuerpo?.tema;
  if (typeof tema !== 'string' || tema === '' || tema.length > 300) return rechazo('peticion_invalida', 'No se dijo qué tema.');

  const visibles = seccionesVisibles(contexto).map((s) => s.clave);
  const hilo = await conOrganizacion(contexto.orgEfectiva, () => abrirTema(contexto.usuarioId, tema, visibles));
  if (hilo === null) return rechazo('no_encontrado');
  return ok({ hilo });
}
