// Firmar el umbral de una regla de Conversation: pasa de provisional a firme, con quién y cuándo (AG13 de los
// agentes; `D-11`; `docs/OTROS/agentes/02-EL-CONTRATO-DE-SENALES.md`, AG-33; `05`, AG-80 y AG-82). Gemela
// de `app/api/acquisition/umbrales/route.ts`, por lo mismo que la de las señales.
//
// La firma es del Admin DE LA EMPRESA: `umbrales.firmar` la tienen administrador y superadministrador, y bajo
// delegación se rechaza. Las señales ya guardadas conservan en foto el umbral con que se calcularon; la firma
// rige desde la próxima pasada.

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion, datos } from '../../../../lib/datos/contexto.ts';
import { auditarAdministracion } from '../../../../lib/autenticacion/auditoria.ts';
import { reglasDelDepartamento } from '../../../../lib/agentes/senales/lectura.ts';
import { CATALOGO_DE_REGLAS, firmarUmbral } from '../../../../lib/agentes/senales/umbrales.ts';

export const PANTALLA = 'conversation';

const MOTIVOS = {
  cuerpo_invalido: 'El cuerpo de la petición no es JSON válido.',
  regla: 'Esa regla no es una de Conversation.',
  valor: 'El umbral tiene que ser un número mayor que cero.',
  delegacion: 'Estás mirando otra empresa: los umbrales los firma quien administra la empresa.',
} as const;

/** `PUT` y no `POST`: una regla tiene un solo umbral firme, así que firmar dos veces lo mismo deja lo mismo. */
export async function PUT(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['umbrales.firmar'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  if (contexto.mirandoOtraOrganizacion) return rechazo('senales_bajo_delegacion', MOTIVOS.delegacion);

  let cuerpo: { regla?: unknown; valor?: unknown } | null;
  try {
    cuerpo = (await peticion.json()) as typeof cuerpo;
  } catch {
    return rechazo('peticion_invalida', MOTIVOS.cuerpo_invalido);
  }
  const regla = CATALOGO_DE_REGLAS.find((r) => r.codigo === cuerpo?.regla && r.departamento === 'conversation');
  if (!regla) return rechazo('peticion_invalida', MOTIVOS.regla);
  const valor = cuerpo?.valor;
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) return rechazo('peticion_invalida', MOTIVOS.valor);

  const reglas = await conOrganizacion(contexto.orgEfectiva, async () => {
    await firmarUmbral(regla.codigo, valor, contexto.usuarioId);
    await auditarAdministracion(datos(), {
      accion: 'umbral_firmado',
      actor: contexto.usuarioId,
      objetivo: contexto.orgEfectiva,
      orgId: contexto.orgEfectiva,
      detalle: { regla: regla.codigo, valor, provisional: regla.valor },
    });
    return reglasDelDepartamento('conversation');
  });
  return ok({ reglas });
}
