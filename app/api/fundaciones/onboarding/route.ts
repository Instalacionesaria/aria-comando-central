// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0202 — Toda consulta de negocio corre dentro del contexto de su organización.
//
// «Traer del onboarding»: vuelve a copiar el formulario de Walter a «Tu ficha», a pedido.
//
// ═══════════════════════════════════════════════════════════════════════════════
// Es el plan B del disparador de la migración 014. Ése corre solo en el `insert` de Walter y traga
// sus errores a propósito; si algún día falla, falla en silencio. Kevin pidió *«una opción B para no
// depender de que se extraiga solito»*, y es esto: un botón en la ficha que rehace la copia para la
// empresa de la sesión.
//
// La copia la hace `public.aria_cc_traer_onboarding()` (migración 015), una función de la base que
// lee la tabla de Walter con los permisos que la aplicación NO tiene ni debe tener. No recibe la
// organización por parámetro: la toma de `app.org_id`, que `conOrganizacion(` fija desde la sesión.
// Quien aprieta el botón se trae su propio onboarding, y ningún otro.
//
// Pide `fundaciones.editar` y no `.ver`: escribe en la ficha, aunque no gaste tokens.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion, datos } from '../../../../lib/datos/contexto.ts';

export const PANTALLA = 'icp';

interface Traido {
  encontrado: boolean;
  capturado_el?: string;
  con_html?: boolean;
}

export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['fundaciones.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  let traido: Traido;
  try {
    traido = await conOrganizacion(contexto.orgEfectiva, async () => {
      const r = await sql<{ r: Traido }>`select public.aria_cc_traer_onboarding() as r`.execute(datos());
      return r.rows[0]?.r ?? { encontrado: false };
    });
  } catch (e) {
    /* La función se niega sin organización en la sesión, y `app_inquilino` puede no tener permiso si
       la 015 no se corrió. Las dos son de despliegue, no de la persona: el código lo dice y el
       detalle queda en el registro del servidor. */
    console.error('[fundaciones/onboarding] no se pudo traer el onboarding:', e);
    return rechazo('almacen_no_disponible', 'No se pudo copiar el formulario a la ficha');
  }

  return ok({
    encontrado: traido.encontrado,
    capturadoEl: traido.capturado_el ?? null,
    conHtml: traido.con_html ?? false,
  });
}
