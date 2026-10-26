// `POST /api/admin/meta/conectar` — el primer paso de «Conectar con Meta»: la URL del diálogo de Meta.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ UN POST QUE DEVUELVE UNA URL, Y NO UN GET QUE REDIRIGE
//
// Crear el `state` escribe (su hash queda en `identidad.estados_de_oauth`), y lo que escribe pide `credenciales.editar`
// y pasa por `verificarOrigen`; un GET de esta pantalla sólo puede pedir `credenciales.ver` (la prueba 30). La pantalla
// recibe la URL y navega a ella.
//
// El `state` es de un solo uso, vence a los 10 minutos y queda atado a la sesión, la persona, la organización y el
// cliente: el canje rechaza un retorno que no venga de este mismo viaje (el ataque de «conectar la cuenta de otro»).
// Sólo se guarda su sha256; el valor viaja únicamente en la URL de Meta.
// ═══════════════════════════════════════════════════════════════════════════════
import { createHash, randomBytes } from 'node:crypto';
import { exigir } from '../../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../../lib/datos/capa.ts';
import { faltaDeLaAppDeMeta } from '../../../../../lib/meta/app.ts';
import { urlDelDialogo } from '../../../../../lib/meta/oauth.ts';

export const PANTALLA = 'credenciales';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Cuánto vale un viaje a Meta. Elegir el portfolio y las cuentas toma uno o dos minutos. */
export const VIGENCIA_DEL_VIAJE_MS = 10 * 60_000;

const SIN_LA_APP =
  'La conexión con Meta todavía no está configurada en el servidor. Avisa a quien administra Comando Central.';

export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  if (faltaDeLaAppDeMeta().length > 0) return rechazo('meta_sin_configurar', SIN_LA_APP);

  let cuerpo: unknown = {};
  try {
    const texto = await peticion.text();
    if (texto.trim()) cuerpo = JSON.parse(texto);
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo de la petición no es JSON válido.');
  }
  const pedido = (cuerpo ?? {}) as { cuentaId?: unknown };
  const cuentaId = pedido.cuentaId ?? null;
  if (cuentaId !== null && (typeof cuentaId !== 'string' || !UUID.test(cuentaId))) {
    return rechazo('peticion_invalida', 'El cliente va como su id, o null para conectar como empresa.');
  }

  const state = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(state).digest('hex');

  const resultado = await conIdentidad(async (db) => {
    if (cuentaId !== null) {
      const cliente = await db
        .selectFrom('cuentas')
        .select(['id', 'es_por_omision'])
        .where('org_id', '=', contexto.orgEfectiva)
        .where('id', '=', cuentaId)
        .where('estado', '<>', 'baja')
        .executeTakeFirst();
      if (!cliente) return rechazo('no_encontrado');
      // El principal conecta como empresa (Ajustes › Credenciales), como todas sus credenciales.
      if (cliente.es_por_omision) {
        return rechazo('cliente_principal', 'El cliente principal se conecta como la empresa: en Ajustes › Credenciales.');
      }
    }
    // Los viajes vencidos se van con cada viaje nuevo: la tabla no crece.
    await db.deleteFrom('estados_de_oauth').where('vence_el', '<', new Date()).execute();
    await db
      .insertInto('estados_de_oauth')
      .values({
        hash,
        org_id: contexto.orgEfectiva,
        sesion_id: contexto.sesionId,
        usuario_id: contexto.usuarioId,
        cuenta_id: cuentaId,
        vence_el: new Date(Date.now() + VIGENCIA_DEL_VIAJE_MS),
      })
      .execute();
    return null;
  });
  if (resultado instanceof Response) return resultado;

  return ok({ url: urlDelDialogo(state) });
}
