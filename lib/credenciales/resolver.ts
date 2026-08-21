// ADR-0604 — Sin credencial, la organización no opera y lo dice.
// ADR-0606 — Un estado ausente y uno vencido no se muestran igual.
//
// `resolverCredenciales(` — la función única, y los cuatro estados.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE ESTE ARCHIVO EXISTE PARA IMPEDIR, Y YA SE PAGÓ
//
// El `07` § 1 lo cuenta entero. La regla era *"una organización sin credencial no opera y lo
// dice"*. El código decía:
//
//     crmToken: () => credencialesActivas()?.token ?? entorno("CRM_TOKEN")
//
// *"Ese `??` convertía **'esta organización no tiene token'** en **'usá el de la principal'**, para
// todas. La regla estaba escrita, documentada y con pruebas; **dos caracteres al final de una
// línea la desactivaban.**"*
//
// Y el `05` § 2 cuenta el resultado: la organización nueva **escribía en la cuenta externa de otra
// empresa**. *"Nada falló — el token era válido, la API respondía 200."*
//
// El `08` § 9 lo repite con más peso: *"la regla que ya valía y acá vale doble: nunca un valor por
// defecto que use la credencial de otra organización."*
//
// ── LA DECISIÓN QUE TOMÉ: NO HAY RESPALDO, NI SIQUIERA EXPLÍCITO ─────────────
//
// El `06` § 6 describe un respaldo *"explícito, nombrado y acotado"* a las variables de entorno de
// la organización principal, y lo presenta como condicional: *"es habitual que la organización
// principal… tenga sus credenciales en variables de entorno desde antes"*.
//
// **Acá no hay ninguna de esas variables**, `EJECUCION` no lo menciona en ningún lado, y nadie lo
// pidió. Implementar el mecanismo que `ADR-0604` existe para vigilar, "por si acaso", es agregar
// exactamente el camino que ya costó una fuga entre clientes. Si algún día hace falta, se agrega
// con su nombre y con su prueba — que es lo que el `06` § 6 quiere decir con *"explícito"*.
//
// Por eso `origen` es siempre `'organizacion'`: el tipo tiene un solo valor a propósito, y el día
// que aparezca un segundo va a ser un cambio que alguien revisa.
// ═══════════════════════════════════════════════════════════════════════════════

import { descifrar } from './cifrado.ts';
import type { Trx } from '../datos/capa.ts';

/**
 * Los cuatro estados del `08` § 9, con su texto de interfaz **literal**.
 *
 * *"Cuatro estados, no dos. La distinción entre `ausente` ('nunca se cargó') y `vencida` ('se cargó
 * y dejó de servir') y `revocada` ('el cliente cortó el acceso desde su panel') es exactamente la
 * clase de distinción que un buen diseño de datos exige en todas partes: **un valor significa una
 * sola cosa**."*
 */
export const ESTADOS_DE_CREDENCIAL = {
  ausente: 'Falta conectar esta integración',
  activa: null,
  vencida: 'La conexión venció. Hay que volver a autorizarla',
  revocada: 'El acceso fue revocado desde el panel del servicio',
} as const;

export type EstadoCredencial = keyof typeof ESTADOS_DE_CREDENCIAL;

/**
 * Un quinto estado que la especificación NO tiene, y que hace falta.
 *
 * El `05` § 7 nombra la acción de auditoría `credencial_ilegible` —*"en la función que descifra
 * credenciales"*— pero el `check` de la columna solo admite cuatro valores y el JSON del `06` § 7
 * no tiene rama para *"hay algo cargado y no lo puedo descifrar"*.
 *
 * Ese caso existe y es frecuente: pasa cada vez que se restaura una copia de la base en otro
 * entorno, donde la clave maestra es otra. No se persiste —la columna no lo admite— pero **sí se
 * informa**, porque el texto que corresponde no es ninguno de los cuatro: no es que falte conectar
 * ni que haya vencido, es que el servidor no puede leer lo que tiene guardado.
 */
export const ILEGIBLE = 'ilegible' as const;
export const TEXTO_ILEGIBLE =
  'La credencial está cargada pero el servidor no puede leerla. Hay que volver a cargarla.';

/** Lo que se muestra de una credencial. **Nunca el valor.** */
export interface CredencialVisible {
  cargado: boolean;
  estado: EstadoCredencial | typeof ILEGIBLE;
  /** El texto de interfaz, o `null` cuando está activa y no hay nada que decir. */
  texto: string | null;
  /** Los últimos cuatro caracteres, o `null`. Ver `enmascarar()`. */
  vistaPrevia: string | null;
  /** Siempre `'organizacion'`. Ver el encabezado. */
  origen: 'organizacion';
}

/**
 * Enmascara un valor para mostrarlo. **Se calcula en el SERVIDOR.**
 *
 * Que se calcule acá y no en el navegador es la diferencia entre un enmascarado y un adorno: si el
 * valor completo viajara para enmascararlo del otro lado, el secreto ya salió y el asterisco es
 * decoración sobre un dato que está en las herramientas de desarrollo.
 *
 * Un valor corto no se enmascara parcialmente: se enmascara **entero**. Mostrar dos de cuatro
 * caracteres de un secreto corto es mostrar medio secreto.
 */
export function enmascarar(valor: string): string {
  if (valor.length < 8) return '••••';
  return '••••' + valor.slice(-4);
}

/** Lo que devuelve la función única. */
export interface Credenciales {
  orgId: string;
  activa: boolean;
  crm: CredencialVisible;
}

/**
 * La función ÚNICA por la que se resuelven las credenciales de una organización.
 *
 * El `06` § 5 da tres razones para que sea una sola, y la tercera es la que importa acá: con un
 * solo lugar, el respaldo implícito tiene un solo lugar donde poder aparecer — y por lo tanto un
 * solo lugar donde vigilarlo.
 *
 * **El caso más frecuente del sistema es el que el pseudocódigo del `06` § 5 no cubre:** una
 * organización recién creada **no tiene fila** en `organizaciones_credenciales`, porque el `05` § 2
 * dice que junto con la organización no se crea *"nada más"*. El pseudocódigo desreferencia
 * `fila.crm_token_cifrado` sin rama para eso. Acá la ausencia de fila es `ausente`, que es
 * exactamente lo que significa.
 */
export async function resolverCredenciales(db: Trx, orgId: string): Promise<Credenciales> {
  const org = await db
    .selectFrom('organizaciones')
    .select(['id', 'activa'])
    .where('id', '=', orgId)
    .executeTakeFirstOrThrow();

  const fila = await db
    .selectFrom('organizaciones_credenciales')
    .select(['crm_token_cifrado', 'crm_estado'])
    .where('org_id', '=', orgId)
    .executeTakeFirst();

  return { orgId: org.id, activa: org.activa, crm: verCredencial(fila) };
}

function verCredencial(
  fila: { crm_token_cifrado: string | null; crm_estado: EstadoCredencial } | undefined,
): CredencialVisible {
  // Sin fila y con fila vacía significan lo mismo hacia afuera —nunca se cargó— y las dos son
  // `ausente`. Lo que NO pueden significar es lo mismo que `vencida`: eso es la fila `ADR-0606`.
  if (!fila || !fila.crm_token_cifrado) {
    return {
      cargado: false,
      estado: 'ausente',
      texto: ESTADOS_DE_CREDENCIAL.ausente,
      vistaPrevia: null,
      origen: 'organizacion',
    };
  }

  let vistaPrevia: string | null;
  try {
    vistaPrevia = enmascarar(descifrar(fila.crm_token_cifrado));
  } catch {
    // Hay algo guardado y no se puede leer. **No es `ausente`**: decir "falta conectar" mandaría a
    // reconectar una integración que está conectada, y el problema real —la clave maestra— quedaría
    // sin diagnosticar. Ver `ILEGIBLE` arriba.
    return {
      cargado: true,
      estado: ILEGIBLE,
      texto: TEXTO_ILEGIBLE,
      vistaPrevia: null,
      origen: 'organizacion',
    };
  }

  return {
    cargado: true,
    estado: fila.crm_estado,
    texto: ESTADOS_DE_CREDENCIAL[fila.crm_estado],
    vistaPrevia,
    origen: 'organizacion',
  };
}
