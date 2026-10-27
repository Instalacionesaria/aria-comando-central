// `POST /api/admin/meta/canje` — el último paso de «Conectar con Meta»: el código del retorno se canjea por el token.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL ORDEN
//
//   1. El `state` tiene que ser de ESTE viaje: existe, no venció, y es de la misma sesión, persona y organización que
//      pide el canje. Se borra antes de seguir (un solo uso), aunque después algo falle.
//   2. El `code` se canjea con Meta (el secreto va en el cuerpo, nunca en una URL), y con el token se pide de qué
//      negocio es y qué cuentas publicitarias dio.
//   3. Todo se guarda en una transacción: la conexión cifrada y sus cuentas, con su asignación (`guardarConexionDeMeta`).
//      Una cuenta con algo leído de Meta en OTRO cliente no se mueve (M10): queda en el suyo y la respuesta la nombra en
//      `cuentasRetenidas`. Lo leído se mira en negocio con las filas de las cuentas bloqueadas.
//
// Las llamadas a Meta van FUERA de la transacción, como «Probar conexión»: una transacción abierta mientras se espera a
// un tercero retiene una conexión de identidad, que es del login de todos.
// ═══════════════════════════════════════════════════════════════════════════════
import { createHash } from 'node:crypto';
import { exigir } from '../../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../../lib/autorizacion/respuesta.ts';
import { auditarAdministracion } from '../../../../../lib/autenticacion/auditoria.ts';
import { conIdentidad } from '../../../../../lib/datos/capa.ts';
import { conOrganizacion } from '../../../../../lib/datos/contexto.ts';
import { cifrar } from '../../../../../lib/credenciales/cifrado.ts';
import { faltaDeLaAppDeMeta } from '../../../../../lib/meta/app.ts';
import { guardarConexionDeMeta, vistaDeMeta } from '../../../../../lib/meta/conexiones.ts';
import { clientesConLoLeidoDeMeta } from '../../../../../lib/meta/loLeidoDeMeta.ts';
import { TEXTO_DE_FALLA_DE_META, type FallaDeMeta } from '../../../../../lib/meta/graph.ts';
import { canjearCodigo, cuentasDelToken, negocioDelToken } from '../../../../../lib/meta/oauth.ts';

export const PANTALLA = 'credenciales';
// Tres pedidos a Meta, de hasta 20 s cada uno (`ESPERA_DE_META_MS`), más las páginas de cuentas.
export const maxDuration = 90;

const VIAJE_VENCIDO = 'Este intento de conectar Meta ya no vale (venció o es de otra sesión). Vuelve a apretar «Conectar con Meta».';

/** Una falla de Meta, con su código de situación. */
function rechazoDeMeta(motivo: FallaDeMeta): Response {
  if (motivo === 'cupo') return rechazo('servicio_externo_saturado', TEXTO_DE_FALLA_DE_META.cupo);
  if (motivo === 'sin_respuesta') return rechazo('servicio_externo_no_disponible', TEXTO_DE_FALLA_DE_META.sin_respuesta);
  return rechazo('credencial_rechazada', TEXTO_DE_FALLA_DE_META[motivo]);
}

export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  if (faltaDeLaAppDeMeta().length > 0) return rechazo('meta_sin_configurar', 'La conexión con Meta no está configurada en el servidor.');

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo de la petición no es JSON válido.');
  }
  const { code, state } = (cuerpo ?? {}) as { code?: unknown; state?: unknown };
  if (typeof code !== 'string' || code.length === 0 || code.length > 2048 || typeof state !== 'string' || state.length > 200) {
    return rechazo('peticion_invalida', 'Faltan el código o el estado que devolvió Meta.');
  }

  // 1 · El viaje: de esta sesión, persona y organización, sin vencer. Se consume ya.
  const hash = createHash('sha256').update(state).digest('hex');
  const viaje = await conIdentidad(async (db) =>
    db
      .deleteFrom('estados_de_oauth')
      .where('hash', '=', hash)
      .returning(['org_id', 'sesion_id', 'usuario_id', 'cuenta_id', 'vence_el'])
      .executeTakeFirst(),
  );
  if (
    !viaje ||
    viaje.vence_el.getTime() < Date.now() ||
    viaje.sesion_id !== contexto.sesionId ||
    viaje.usuario_id !== contexto.usuarioId ||
    viaje.org_id !== contexto.orgEfectiva
  ) {
    return rechazo('viaje_a_meta_vencido', VIAJE_VENCIDO);
  }

  // 2 · Meta: el token, su negocio y sus cuentas. Afuera de toda transacción.
  const canje = await canjearCodigo(code);
  if (canje.tipo !== 'listo') return rechazoDeMeta(canje.motivo);
  const negocio = await negocioDelToken(canje.token);
  if (negocio.tipo !== 'listo') return rechazoDeMeta(negocio.motivo);
  const cuentas = await cuentasDelToken(canje.token);
  if (cuentas.tipo !== 'listo') return rechazoDeMeta(cuentas.motivo);

  // 3 · Todo junto: la conexión, sus cuentas y la auditoría.
  return conIdentidad(async (db) => {
    /* Lo leído de Meta de estas cuentas, en negocio (otro agrupador), con sus filas ya bloqueadas en identidad. Sólo
       se LEE: si falla, la transacción de identidad se revierte con el error y no queda nada a medias. */
    const { conexionId, retenidas } = await guardarConexionDeMeta(
      db,
      {
        orgId: contexto.orgEfectiva,
        cuentaId: viaje.cuenta_id,
        tokenCifrado: cifrar(canje.token),
        negocio: negocio.negocio,
        usuarioDeMeta: negocio.usuario,
        usuarioId: contexto.usuarioId,
        cuentas: cuentas.cuentas,
      },
      (acts) => conOrganizacion(contexto.orgEfectiva, () => clientesConLoLeidoDeMeta(acts)),
    );
    await auditarAdministracion(db, {
      accion: 'meta_conectada',
      actor: contexto.usuarioId,
      objetivo: viaje.cuenta_id ?? contexto.orgEfectiva,
      orgId: contexto.orgEfectiva,
    });
    return ok({
      conexionId,
      cuentasConectadas: cuentas.cuentas.length,
      // Las que tienen campañas o gasto leídos en otro cliente: quedaron donde estaban (M10).
      cuentasRetenidas: retenidas,
      ...(await vistaDeMeta(db, contexto.orgEfectiva)),
    });
  });
}
