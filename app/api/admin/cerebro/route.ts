// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
//
// Los topes del cerebro en Ajustes (`docs/OTROS/agentes/06-MODELOS-USO-TOPES-E-INCIDENTES.md`, AG-96 y
// AG-97): cuántas preguntas por día admite, por persona y por empresa, y lo usado hoy contra eso.
//
// Es de Ajustes como las demás rutas de `app/api/admin/`: el GET pide `credenciales.ver` y el PUT
// `credenciales.editar`, así que los fija el Admin (el rol `usuario` no tiene `credenciales.%`). Bajo
// delegación se pueden fijar, con autor nulo (`autorDelCambio`): quien mira desde otra empresa no es una
// persona de ésta, y la columna apunta a una (`05`, AG-82).

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { autorDelCambio } from '../../../../lib/autorizacion/sesion.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../../lib/datos/contexto.ts';
import { fijarTopes, loUsadoHoy, TOPE_MAXIMO, TOPES_POR_OMISION, topesDeLaEmpresa } from '../../../../lib/agentes/executive/topes.ts';

export const PANTALLA = 'credenciales';

const MOTIVO =
  `Los dos topes tienen que ser números enteros entre 1 y ${TOPE_MAXIMO}, y el de una persona no puede ` +
  'pasar al de la empresa: nadie podría usarlo entero.';

/** Los topes, cuándo se cambiaron, y lo usado hoy por la empresa. */
export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  const { topes, usado } = await conOrganizacion(contexto.orgEfectiva, async () => ({
    topes: await topesDeLaEmpresa(),
    usado: await loUsadoHoy(contexto.usuarioId, contexto.organizacion.zonaHoraria),
  }));
  return ok({
    porPersona: topes.porPersona,
    porEmpresa: topes.porEmpresa,
    porOmision: TOPES_POR_OMISION,
    maximo: TOPE_MAXIMO,
    actualizadoEl: topes.actualizadoEl?.toISOString() ?? null,
    usadasPorEmpresa: usado.usadasPorEmpresa,
    renuevaEl: usado.renuevaEl.toISOString(),
  });
}

/** Fija los dos topes: `{ porPersona, porEmpresa }`. Los dos siempre: uno solo dejaría el otro a adivinar. */
export async function PUT(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  let cuerpo: { porPersona?: unknown; porEmpresa?: unknown } | null;
  try {
    cuerpo = (await peticion.json()) as typeof cuerpo;
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo no es JSON.');
  }
  const valido = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= TOPE_MAXIMO;
  const porPersona = cuerpo?.porPersona;
  const porEmpresa = cuerpo?.porEmpresa;
  if (!valido(porPersona) || !valido(porEmpresa) || porPersona > porEmpresa) return rechazo('peticion_invalida', MOTIVO);

  await conOrganizacion(contexto.orgEfectiva, () => fijarTopes(porPersona, porEmpresa, autorDelCambio(contexto)));
  return ok({ porPersona, porEmpresa });
}
