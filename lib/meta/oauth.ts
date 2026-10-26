// «Conectar con Meta»: el viaje por Facebook Login for Business (Meta directo, M2).
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL FLUJO, EN TRES PASOS PARA QUIEN CONECTA
//
//   1. aprieta «Conectar con Meta» → `urlDelDialogo` arma la URL del diálogo de Meta con la configuración de la app de
//      ARIA (`config_id`: token del usuario del sistema de la integración y `ads_read`);
//   2. en Meta elige su portfolio y sus cuentas publicitarias, y acepta;
//   3. Meta vuelve a `/meta/retorno` con un `code`, y el servidor lo canjea (`canjearCodigo`) por el token del negocio,
//      averigua de qué negocio es (`negocioDelToken`) y lista las cuentas que se le dieron (`cuentasDelToken`).
//
// El token del usuario del sistema de la integración (BISU) es del NEGOCIO que conectó, no de una persona: no vence
// mientras el negocio no quite la integración, y si quien conectó se va, sigue funcionando.
//
// ── LO QUE NUNCA PASA ─────────────────────────────────────────────────────────────
//
//   · el secreto de la app no viaja en una URL: el canje es un `POST` con cuerpo de formulario;
//   · el token no viaja en una URL: va en la cabecera (`pedirAMeta`), con su `appsecret_proof`;
//   · el mensaje de Meta (en inglés, puede nombrar ids) no llega al navegador: se traduce a `FallaDeMeta`.
// ═══════════════════════════════════════════════════════════════════════════════
import { pedirExterno } from '../http/cliente.ts';
import { appDeMeta, urlDeRetorno } from './app.ts';
import { ESPERA_DE_META_MS, fallaDeMeta, pedirAMeta, RAIZ_DE_GRAPH, VERSION_DE_GRAPH, type FallaDeMeta } from './graph.ts';

/** La URL del diálogo de Meta. `state` es el valor en claro, de un solo uso (su hash queda en la base). */
export function urlDelDialogo(state: string): string {
  const app = appDeMeta();
  const consulta = new URLSearchParams({
    client_id: app.appId,
    config_id: app.configId,
    redirect_uri: urlDeRetorno(),
    state,
    response_type: 'code',
    override_default_response_type: 'true',
  });
  return `https://www.facebook.com/${VERSION_DE_GRAPH}/dialog/oauth?${consulta.toString()}`;
}

export type Canje = { tipo: 'listo'; token: string } | { tipo: 'falla'; motivo: FallaDeMeta };

/** Canjea el `code` del retorno por el token del negocio. El secreto va en el cuerpo, nunca en la URL. */
export async function canjearCodigo(code: string): Promise<Canje> {
  const app = appDeMeta();
  const r = await pedirExterno<{ access_token?: string }>(`${RAIZ_DE_GRAPH}/oauth/access_token`, {
    metodo: 'POST',
    formulario: { client_id: app.appId, client_secret: app.secreto, redirect_uri: urlDeRetorno(), code },
    espera: ESPERA_DE_META_MS,
  });
  if (r.tipo !== 'datos') return { tipo: 'falla', motivo: fallaDeMeta(r) };
  const token = r.datos.access_token;
  return typeof token === 'string' && token.length > 0 ? { tipo: 'listo', token } : { tipo: 'falla', motivo: 'otro' };
}

/**
 * De qué negocio es el token: el `client_business_id` del portfolio que conectó. Con un token de usuario (si la
 * configuración no fuera la del usuario del sistema) no viene, y queda nulo.
 */
export async function negocioDelToken(
  token: string,
): Promise<{ tipo: 'listo'; negocio: string | null; usuario: string | null } | { tipo: 'falla'; motivo: FallaDeMeta }> {
  const r = await pedirAMeta<{ id?: string; client_business_id?: string }>('me', token, { fields: 'id,client_business_id' }, { conPrueba: true });
  if (r.tipo !== 'datos') return { tipo: 'falla', motivo: fallaDeMeta(r) };
  const negocio = r.datos.client_business_id;
  const usuario = r.datos.id;
  // El id en la app del dueño del token (`104`): con él se encuentran sus conexiones cuando Meta avisa que quitaron la
  // app o que piden borrar sus datos.
  const id = (v: unknown) => (typeof v === 'string' && /^\d{1,30}$/.test(v) ? v : null);
  return { tipo: 'listo', negocio: id(negocio), usuario: id(usuario) };
}

/** Una cuenta publicitaria tal como la devuelve Meta, ya validada. */
export interface CuentaQueDioMeta {
  act: string;
  nombre: string | null;
  moneda: string | null;
  zonaHoraria: string | null;
  estado: number | null;
}

/** Cuántas páginas de 100 se leen como mucho: 2.000 cuentas, más de las que tiene una agencia real. */
const PAGINAS_DE_CUENTAS = 20;

/**
 * Las cuentas publicitarias que el negocio le dio a la app (las que marcó en el diálogo), con su moneda, zona y estado.
 * `me/adaccounts` del usuario del sistema de la integración devuelve exactamente las asignadas. Pagina con el cursor de
 * Meta; una cuenta sin forma de `act_` se descarta.
 */
export async function cuentasDelToken(token: string): Promise<{ tipo: 'listo'; cuentas: CuentaQueDioMeta[] } | { tipo: 'falla'; motivo: FallaDeMeta }> {
  type Pagina = {
    data?: { id?: string; name?: string; currency?: string; timezone_name?: string; account_status?: number }[];
    paging?: { cursors?: { after?: string }; next?: string };
  };
  const cuentas: CuentaQueDioMeta[] = [];
  let despues: string | undefined;
  for (let i = 0; i < PAGINAS_DE_CUENTAS; i += 1) {
    const parametros: Record<string, string> = { fields: 'id,name,currency,timezone_name,account_status', limit: '100' };
    if (despues) parametros.after = despues;
    const r = await pedirAMeta<Pagina>('me/adaccounts', token, parametros, { conPrueba: true });
    if (r.tipo !== 'datos') return { tipo: 'falla', motivo: fallaDeMeta(r) };
    for (const c of r.datos.data ?? []) {
      const act = typeof c.id === 'string' && /^act_\d{1,30}$/.test(c.id) ? c.id : null;
      if (!act) continue;
      cuentas.push({
        act,
        nombre: typeof c.name === 'string' ? c.name.slice(0, 200) : null,
        moneda: typeof c.currency === 'string' && /^[A-Z]{3}$/.test(c.currency) ? c.currency : null,
        zonaHoraria: typeof c.timezone_name === 'string' ? c.timezone_name.slice(0, 64) : null,
        estado: typeof c.account_status === 'number' ? c.account_status : null,
      });
    }
    despues = r.datos.paging?.next ? r.datos.paging.cursors?.after : undefined;
    if (!despues) break;
  }
  return { tipo: 'listo', cuentas };
}
