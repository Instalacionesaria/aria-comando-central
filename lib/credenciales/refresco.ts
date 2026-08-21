// ADR-0605 — Dos refrescos simultáneos no se invalidan.
//
// `tokenVigente(` — el refresco con candado de base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO ES INTERMITENTE, APARECE CON CARGA, Y NO SE REPRODUCE LOCALMENTE
//
// El `08` § 9 lo explica en dos frases, y la segunda es la que decide el diseño:
//
//   "**Varias plataformas invalidan el token de refresco al usarlo.** Dos peticiones simultáneas
//    que detectan el token vencido y refrescan a la vez **se invalidan entre sí**, y la
//    organización queda desconectada."
//
// O sea: el camino feliz funciona, el camino de dos peticiones funciona *casi siempre*, y el día
// que coinciden el cliente se desconecta sin que nadie haya tocado nada.
//
// ── EL CANDADO ES DE LA BASE, Y NO ES NEGOCIABLE ─────────────────────────────
//
// El `08` § 9: *"el candado es de la base, no del proceso. Un candado en memoria no sirve: hay
// varias instancias."* En funciones sin servidor eso es literal — cada petición puede caer en un
// proceso distinto, y un `Map` de módulo no ve nada.
//
// `select … for update` sobre la fila de la organización. El comentario del propio documento dice
// *"por organización y servicio"* pero el SQL de la línea siguiente bloquea **la fila**, y la fila
// es por organización (`org_id` es la clave primaria). Gana el SQL: dos refrescos de servicios
// distintos de la misma organización se serializan igual. Es más grueso de lo que el comentario
// promete y a esta escala no cuesta nada — pero alguien que lea solo el comentario podría intentar
// afinarlo y perder la garantía.
//
// ── Y LA FILA QUE NO EXISTE ──────────────────────────────────────────────────
//
// `for update` sobre una fila que no está no bloquea nada, y dos peticiones simultáneas contra una
// organización sin credenciales pasarían las dos. No importa —no hay nada que refrescar y las dos
// devuelven `no_operativa`— pero conviene saber por qué el caso no rompe: se corta antes, en
// `ausente`.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { cifrar, descifrar } from './cifrado.ts';
import { ESTADOS_DE_CREDENCIAL } from './resolver.ts';
import type { Trx } from '../datos/capa.ts';

/**
 * El margen. El `08` § 9 dice *"unos minutos"* y no da número: **cinco**.
 *
 * *"Evita usar un token que vence mientras la petición viaja."* Un token que vence en treinta
 * segundos es un token que va a fallar en el servicio externo, y ese fallo llega como un error de
 * autenticación que no dice nada.
 */
export const MARGEN_MINUTOS = 5;

/** Lo que devuelve el servicio externo al renovar. Se inyecta para poder probar el candado. */
export interface TokenNuevo {
  revocado?: boolean;
  token?: string;
  /** Algunas plataformas rotan también el de refresco. Si vino, se guarda. */
  refresco?: string;
  duracionSegundos?: number;
}

export type PedirTokenNuevo = (refresco: string) => Promise<TokenNuevo>;

/**
 * El resultado. **Dos ramas, y ninguna es una excepción.**
 *
 * La primera versión de esta función LANZABA cuando la organización no podía operar, y la prueba
 * `ADR-0604` la puso en rojo por un motivo que no había previsto: marcar el estado (`vencida`,
 * `revocada`) y después lanzar **dentro de la misma transacción** hace que el `rollback` se lleve
 * la marca. El estado quedaba en `activa` para siempre, la interfaz seguía diciendo que la conexión
 * andaba, y el diagnóstico correcto —"venció, hay que volver a autorizarla"— no llegaba nunca.
 *
 * Es la familia del `07` § 0 dada vuelta: un **fracaso registrado que no se registró**.
 *
 * Con un valor de retorno, la transacción **confirma** —la marca persiste— y quien llama decide qué
 * responder. Es la misma forma que `lib/http/cliente.ts`: tres cosas distintas, tres valores
 * distintos, ninguno nulo.
 */
export type Vigencia =
  | { readonly tipo: 'token'; readonly token: string }
  | {
      readonly tipo: 'no_operativa';
      readonly estado: 'ausente' | 'vencida' | 'revocada';
      readonly texto: string;
    };

/**
 * El token vigente de una organización, renovándolo si hace falta.
 *
 * **No lanza cuando la organización no puede operar**: devuelve `no_operativa` con su estado y su
 * texto. Ver `Vigencia` arriba — lanzar revertía la marca del estado.
 *
 * Se llama DENTRO de una transacción de identidad ya abierta: el candado tiene que vivir en la
 * misma transacción que la escritura, o no sirve de nada.
 */
export async function tokenVigente(
  db: Trx,
  orgId: string,
  pedirTokenNuevo: PedirTokenNuevo,
): Promise<Vigencia> {
  // EL CANDADO. Todo lo que sigue corre con la fila bloqueada: la segunda petición espera acá, y
  // cuando entra encuentra el token ya renovado y **no refresca de nuevo**.
  const cred = await db
    .selectFrom('organizaciones_credenciales')
    .select(['crm_token_cifrado', 'crm_refresh_cifrado', 'crm_expira_el', 'crm_estado'])
    .where('org_id', '=', orgId)
    .forUpdate()
    .executeTakeFirst();

  if (!cred || !cred.crm_token_cifrado) {
    // `ausente`. No hay respaldo a la credencial de otra organización, y ésta es la línea donde
    // ese respaldo aparecería si alguien lo agregara.
    return { tipo: 'no_operativa', estado: 'ausente', texto: ESTADOS_DE_CREDENCIAL.ausente };
  }
  if (cred.crm_estado === 'revocada') {
    return { tipo: 'no_operativa', estado: 'revocada', texto: ESTADOS_DE_CREDENCIAL.revocada };
  }

  // ¿Sigue vigente con margen? Ésta es la rama por la que sale la SEGUNDA petición.
  const umbral = new Date(Date.now() + MARGEN_MINUTOS * 60_000);
  if (cred.crm_expira_el && cred.crm_expira_el > umbral) {
    return { tipo: 'token', token: descifrar(cred.crm_token_cifrado) };
  }

  if (!cred.crm_refresh_cifrado) {
    // Vencido y sin token de refresco: no hay forma de renovarlo. Se marca `vencida` para que la
    // interfaz diga *"la conexión venció, hay que volver a autorizarla"* en vez de *"falta
    // conectar"*, que mandaría a hacer algo distinto.
    await db
      .updateTable('organizaciones_credenciales')
      .set({ crm_estado: 'vencida' })
      .where('org_id', '=', orgId)
      .execute();
    return { tipo: 'no_operativa', estado: 'vencida', texto: ESTADOS_DE_CREDENCIAL.vencida };
  }

  const refrescoPlano = descifrar(cred.crm_refresh_cifrado);
  const resultado = await pedirTokenNuevo(refrescoPlano);

  if (resultado.revocado || !resultado.token) {
    await db
      .updateTable('organizaciones_credenciales')
      .set({ crm_estado: 'revocada' })
      .where('org_id', '=', orgId)
      .execute();
    return { tipo: 'no_operativa', estado: 'revocada', texto: ESTADOS_DE_CREDENCIAL.revocada };
  }

  await db
    .updateTable('organizaciones_credenciales')
    .set({
      crm_token_cifrado: cifrar(resultado.token),
      // *"El token de refresco nuevo se guarda SI VINO; algunas plataformas rotan también el de
      // refresco, y perderlo desconecta al cliente sin aviso."* El `??` de acá es legítimo y es lo
      // contrario del que el `07` § 1 prohíbe: cae al valor **de esta misma organización**, no al
      // de otra.
      crm_refresh_cifrado: cifrar(resultado.refresco ?? refrescoPlano),
      crm_expira_el: sql<Date>`now() + make_interval(secs => ${resultado.duracionSegundos ?? 3600})`,
      crm_estado: 'activa',
    })
    .where('org_id', '=', orgId)
    .execute();

  return { tipo: 'token', token: resultado.token };
}
