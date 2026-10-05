// Marcar vista, resolver y descartar una señal de Acquisition (AG9 de los agentes;
// `docs/OTROS/agentes/02-EL-CONTRATO-DE-SENALES.md`, AG-24 y AG-25; `05`, AG-80 y AG-82).
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUIÉN Y CÓMO
//
//   · `senales.resolver` para las tres acciones; resolver o descartar una que requiere validación ejecutiva
//     pide además `senales.validar`: un `usuario` de Acquisition no se salta la validación que pide la
//     arquitectura (A12-03).
//   · Resolver y descartar, siempre con motivo; el autor y la fecha los pone el servidor.
//   · «Vista» es un POST explícito, el de «Ver evidencia»: un GET nunca escribe (AG-24).
//   · Bajo delegación no se escribe nada: un autor de la principal dentro de un cliente da `23503`
//     (`docs/OTROS/estado actual/09-DEUDA-ABIERTA.md:871-906`), y decidir por la empresa no es de ARIA.
//   · Sólo señales de Acquisition: el escritor filtra por departamento, así que el id de una de Creative da
//     404 aunque exista.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion, datos } from '../../../../lib/datos/contexto.ts';
import { cerrarSenal, marcarVista } from '../../../../lib/agentes/senales/escritura.ts';

export const PANTALLA = 'acquisition';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LARGO_MAXIMO_DEL_MOTIVO = 500;

const MOTIVOS = {
  cuerpo_invalido: 'El cuerpo de la petición no es JSON válido.',
  sin_id: 'No se dijo qué señal.',
  accion: 'La acción tiene que ser vista, resolver o descartar.',
  sin_motivo: `Resolver o descartar una señal pide un motivo, de hasta ${LARGO_MAXIMO_DEL_MOTIVO} caracteres.`,
  no_encontrada: 'Esa señal no está entre las de Acquisition de la empresa.',
  cerrada: 'Esa señal ya está cerrada: no hay nada que resolver.',
  validacion: 'Esta señal requiere validación ejecutiva: la resuelve o la descarta quien administra la empresa.',
  delegacion: 'Estás mirando otra empresa: las señales se deciden desde la empresa.',
} as const;

export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['senales.resolver'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  if (contexto.mirandoOtraOrganizacion) return rechazo('senales_bajo_delegacion', MOTIVOS.delegacion);

  let cuerpo: { id?: unknown; accion?: unknown; motivo?: unknown } | null;
  try {
    cuerpo = (await peticion.json()) as typeof cuerpo;
  } catch {
    return rechazo('peticion_invalida', MOTIVOS.cuerpo_invalido);
  }
  const id = cuerpo?.id;
  if (typeof id !== 'string' || !UUID.test(id)) return rechazo('peticion_invalida', MOTIVOS.sin_id);
  const accion = cuerpo?.accion;
  if (accion !== 'vista' && accion !== 'resolver' && accion !== 'descartar') return rechazo('peticion_invalida', MOTIVOS.accion);
  const motivo = typeof cuerpo?.motivo === 'string' ? cuerpo.motivo.trim() : '';
  if (accion !== 'vista' && (motivo === '' || motivo.length > LARGO_MAXIMO_DEL_MOTIVO)) {
    return rechazo('peticion_invalida', MOTIVOS.sin_motivo);
  }

  return conOrganizacion(contexto.orgEfectiva, async () => {
    if (accion === 'vista') {
      const r = await marcarVista('acquisition', id, contexto.usuarioId);
      return r === 'no_encontrada' ? rechazo('no_encontrado', MOTIVOS.no_encontrada) : ok({ id, accion });
    }
    const senal = await datos()
      .selectFrom('senales')
      .select(['requiere_validacion_ejecutiva'])
      .where('id', '=', id)
      .where('departamento', '=', 'acquisition')
      .executeTakeFirst();
    if (!senal) return rechazo('no_encontrado', MOTIVOS.no_encontrada);
    if (senal.requiere_validacion_ejecutiva && !contexto.permisos.has('senales.validar')) {
      return rechazo('sin_permiso', MOTIVOS.validacion);
    }
    const r = await cerrarSenal('acquisition', id, accion === 'resolver' ? 'resuelta' : 'descartada', motivo, contexto.usuarioId);
    if (r === 'no_encontrada') return rechazo('no_encontrado', MOTIVOS.no_encontrada);
    if (r === 'cerrada') return rechazo('senal_cerrada', MOTIVOS.cerrada);
    return ok({ id, accion });
  });
}
