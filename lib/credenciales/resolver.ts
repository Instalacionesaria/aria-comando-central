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
import { auditar } from '../autenticacion/auditoria.ts';

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

  const crm = verCredencial(fila);

  // ADR-0809 · Se EMITE `credencial_ilegible`, en la función única que descifra.
  //
  // El `10` § 1 lo pone en su tabla: *"`credencial_ilegible` → en la función única que descifra
  // credenciales"*. Es la señal 2, de cadencia **diaria**: no interrumpe, se consulta.
  //
  // Va en la MISMA transacción que la lectura. Si fuera aparte, existiría el caso "la credencial no
  // se pudo leer y nadie lo registró", que es el cero indistinguible de "nadie cableó el punto de
  // emisión" que `ADR-0809` existe para impedir.
  if (crm.estado === ILEGIBLE) {
    await auditar(db, { accion: 'credencial_ilegible', orgId: org.id });
  }

  return { orgId: org.id, activa: org.activa, crm };
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

// ═══════════════════════════════════════════════════════════════════════════════
// ETAPA 9 · LAS DOS COSAS QUE FUNDACIONES NECESITA DE ESTA TABLA
//
// La pantalla `icp` (ICP & Oferta) genera documentos con un modelo de lenguaje y guarda el estado
// del alumno en el almacén del hub. Para eso necesita dos valores POR ORGANIZACIÓN, y los dos ya
// tenían columna en `organizaciones_credenciales`:
//
//   · `ia_clave_cifrada` — la llave de la API de Anthropic **de esta organización**. La columna
//     existía desde la migración 006 y hasta ahora nadie la leía.
//   · `fundaciones_cliente_id` — a qué alumno del hub corresponde esta organización. La agrega la
//     migración 009, junto a `crm_cuenta_id` y `pagos_comercio_id`, que son de la misma clase:
//     identificadores de cuenta ajena, NO secretos.
//
// ── POR QUÉ NO HAY RESPALDO AL ENTORNO, OTRA VEZ ─────────────────────────────
//
// La tentación acá es enorme y concreta: una sola `ANTHROPIC_API_KEY` en Vercel y listo. Sería
// exactamente el `??` del `07` § 1 con la peor consecuencia de esta etapa: **el consumo de tokens
// de todas las organizaciones facturado a una**, y sin que nada falle — la API responde 200 y el
// documento sale bien. Es el mismo defecto que ARIA-brain ya pagó y quitó en agosto de 2026 (ver
// `lib/accountKeys.ts` en ese repositorio: *"el fallback hacía que el consumo de cualquier cuenta
// lo pagara ARIA"*).
//
// Sin llave propia, la organización no genera y lo dice. `ADR-0604`, sin excepción.
// ═══════════════════════════════════════════════════════════════════════════════

/** Por qué una organización no puede generar. Cada valor significa una sola cosa. */
export type FaltaParaGenerar = 'sin_llave_de_ia' | 'llave_de_ia_ilegible' | 'sin_alumno_vinculado';

/**
 * Quién es el alumno del hub de esta organización.
 *
 * Está separado de la llave de IA a propósito, y no es una duplicación: **leer no necesita la
 * llave**. Una organización a la que todavía no le cargaron la llave de IA tiene que poder ABRIR la
 * pantalla y ver los siete documentos que ya generó en el hub. Si las dos cosas se resolvieran
 * juntas, esa organización recibiría "falta la llave de IA" al intentar leer, y la respuesta
 * honesta —"acá está tu trabajo, y para generar de nuevo falta la llave"— sería imposible de dar.
 */
export type AlumnoDeFundaciones =
  | { tipo: 'listo'; clienteId: string }
  | { tipo: 'falta'; que: 'sin_alumno_vinculado' };

export async function resolverAlumnoDeFundaciones(
  db: Trx,
  orgId: string,
): Promise<AlumnoDeFundaciones> {
  const fila = await db
    .selectFrom('organizaciones_credenciales')
    .select(['fundaciones_cliente_id'])
    .where('org_id', '=', orgId)
    .executeTakeFirst();

  if (!fila || !fila.fundaciones_cliente_id) return { tipo: 'falta', que: 'sin_alumno_vinculado' };
  return { tipo: 'listo', clienteId: fila.fundaciones_cliente_id };
}

/** Lo que hace falta para GENERAR: el alumno y la llave. */
export type AccesoAFundaciones =
  | { tipo: 'listo'; claveIa: string; clienteId: string }
  | { tipo: 'falta'; que: FaltaParaGenerar };

/**
 * La llave de IA y el alumno del hub de esta organización, o **qué falta**.
 *
 * Los tres faltantes son tres y no uno. "No cargaron la llave", "la llave está cargada y no la
 * puedo descifrar" (pasa al restaurar una copia de la base con otra clave maestra — ver `ILEGIBLE`
 * arriba) y "esta organización no está vinculada a ningún alumno del hub" llevan a tres acciones
 * distintas —cargar la llave, revisar la clave maestra del servidor, vincular la cuenta— y
 * colapsarlas en *"no se pudo generar"* manda a las tres personas al lugar equivocado.
 */
export async function resolverAccesoAFundaciones(
  db: Trx,
  orgId: string,
): Promise<AccesoAFundaciones> {
  const fila = await db
    .selectFrom('organizaciones_credenciales')
    .select(['ia_clave_cifrada', 'fundaciones_cliente_id'])
    .where('org_id', '=', orgId)
    .executeTakeFirst();

  if (!fila || !fila.fundaciones_cliente_id) return { tipo: 'falta', que: 'sin_alumno_vinculado' };
  if (!fila.ia_clave_cifrada) return { tipo: 'falta', que: 'sin_llave_de_ia' };

  let claveIa: string;
  try {
    claveIa = descifrar(fila.ia_clave_cifrada);
  } catch {
    // ADR-0809 · el mismo punto de emisión que `resolverCredenciales`, y en la misma transacción:
    // un descifrado que falla y no queda registrado es el cero indistinguible de "nadie cableó la
    // señal".
    await auditar(db, { accion: 'credencial_ilegible', orgId });
    return { tipo: 'falta', que: 'llave_de_ia_ilegible' };
  }

  return { tipo: 'listo', claveIa, clienteId: fila.fundaciones_cliente_id };
}

/** El texto que se le muestra a quien no puede generar. Uno por faltante. */
export const TEXTO_DE_FALTA: Readonly<Record<FaltaParaGenerar, string>> = {
  sin_llave_de_ia:
    'Esta organización todavía no tiene su llave de IA. Se carga en Integraciones, y sin ella no se puede generar.',
  llave_de_ia_ilegible:
    'La llave de IA está cargada pero el servidor no puede leerla. Hay que volver a cargarla.',
  sin_alumno_vinculado:
    'Esta organización no está vinculada a una cuenta del hub, así que no hay dónde leer ni guardar el trabajo de Fundaciones.',
};
