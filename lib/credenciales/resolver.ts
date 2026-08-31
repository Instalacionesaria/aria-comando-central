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

/**
 * Lo que devuelve la función única.
 *
 * ── POR QUÉ TRES CREDENCIALES Y NO UNA ──────────────────────────────────────
 *
 * Hasta la Etapa 11 esto devolvía solo `crm`, y las otras dos columnas de la tabla
 * —`ia_clave_cifrada`, `pagos_clave_cifrada`— existían desde la migración 006 sin que nada
 * las leyera. Que existieran sin leerse tenía una consecuencia concreta: **no había forma de
 * cargar la llave de IA de una organización**, así que la pantalla `icp` respondía
 * `sin_llave_de_ia` para siempre y el único arreglo aparente era una variable de entorno
 * global — que es exactamente la fuga que el encabezado de este archivo describe.
 *
 * Cada una tiene su propio estado. Tener uno solo haría que "no cargó GHL" y "no cargó la
 * llave de IA" fueran el mismo hecho, y son dos: una organización puede operar el pipeline
 * sin generar documentos, y al revés.
 *
 * ── Y LOS IDENTIFICADORES PÚBLICOS VAN COMPLETOS, NO ENMASCARADOS ───────────
 *
 * `crm_cuenta_id`, `pagos_comercio_id` y `fundaciones_cliente_id` **no son secretos**: son el
 * identificador de esta organización en una cuenta ajena. Enmascararlos daría la impresión
 * contraria —que son lo que protege algo— y volvería imposible la única cosa que hace falta
 * hacer con ellos: mirarlos para comprobar que apuntan a la subcuenta correcta.
 */
export interface Credenciales {
  orgId: string;
  activa: boolean;
  /** El token de GoHighLevel. La integración del pipeline. */
  crm: CredencialVisible;
  /** La llave de la API de Anthropic **de esta organización**. Ver el encabezado. */
  ia: CredencialVisible;
  /** La clave de la pasarela de pagos. */
  pagos: CredencialVisible;
  /** La subcuenta de GoHighLevel. NO es secreto: va completo. */
  crmCuentaId: string | null;
  /**
   * El calendario de agendamiento. **No es un secreto y no es un filtro**: ver la migración 016.
   *
   * Va en la misma clase que `crmCuentaId` —identificador de una cuenta ajena, viaja completo— y no
   * en la de los tokens.
   */
  crmCalendarioId: string | null;
  /** El comercio de la pasarela. NO es secreto: va completo. */
  pagosComercioId: string | null;
  /** El alumno del hub para Fundaciones. NO es secreto: va completo. */
  fundacionesClienteId: string | null;
  /**
   * ¿Hay secreto del aviso configurado? **Un booleano, nunca el valor ni el hash.**
   *
   * ── POR QUÉ NI SIQUIERA EL HASH ─────────────────────────────────────
   *
   * El hash no sirve para autenticarse —la ruta compara el hash de lo que le presentan— así que
   * mandarlo parecería inocuo. No lo es: es sha256 sin sal de un valor que nosotros generamos, y
   * publicarlo en una respuesta de la aplicación lo convierte en algo que se puede atacar sin límite
   * de intentos y fuera de nuestros registros. Un booleano responde la única pregunta que la pantalla
   * necesita: «¿hay que generarlo o ya está?».
   *
   * El valor completo se muestra **una sola vez**, en la respuesta del `POST` que lo genera.
   */
  avisoSecretoConfigurado: boolean;
  /** Cuándo se tocó por última vez esta configuración. `null` = nunca hubo fila. */
  actualizadoEl: Date | null;
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
    .select([
      'crm_token_cifrado',
      'crm_estado',
      'ia_clave_cifrada',
      'pagos_clave_cifrada',
      'crm_cuenta_id',
      'crm_calendario_id',
      'aviso_secreto_hash',
      'pagos_comercio_id',
      'fundaciones_cliente_id',
      'actualizado_el',
    ])
    .where('org_id', '=', orgId)
    .executeTakeFirst();

  const crm = verCredencial(fila?.crm_token_cifrado ?? null, fila?.crm_estado ?? 'ausente');

  // La llave de IA y la de pagos NO tienen columna de estado propia, y eso NO se resuelve
  // reusando `crm_estado`: diría "vencida" de una llave de Anthropic porque venció el token de
  // GoHighLevel. Se derivan de la presencia, que es lo único que la tabla sabe de ellas.
  //
  // Las dos siguen distinguiendo `ausente` de `ilegible`, que es la distinción que importa: una
  // llave que está cargada y no se puede descifrar necesita que alguien la vuelva a cargar, y
  // decirle "falta conectar" manda a reconectar algo que ya está conectado.
  const ia = verCredencial(fila?.ia_clave_cifrada ?? null, 'activa');
  const pagos = verCredencial(fila?.pagos_clave_cifrada ?? null, 'activa');

  // ADR-0809 · Se EMITE `credencial_ilegible`, en la función única que descifra.
  //
  // El `10` § 1 lo pone en su tabla: *"`credencial_ilegible` → en la función única que descifra
  // credenciales"*. Es la señal 2, de cadencia **diaria**: no interrumpe, se consulta.
  //
  // Va en la MISMA transacción que la lectura. Si fuera aparte, existiría el caso "la credencial no
  // se pudo leer y nadie lo registró", que es el cero indistinguible de "nadie cableó el punto de
  // emisión" que `ADR-0809` existe para impedir.
  //
  // Y cubre las TRES, no solo el CRM. Una llave de IA ilegible tiene la misma causa —la clave
  // maestra cambió— y el mismo síntoma para quien la sufre: la pantalla dice que no puede
  // generar y nadie sabe por qué. Emitir solo por una de las tres dejaría dos tercios de la
  // señal sin cablear, que es el cero indistinguible que `ADR-0809` existe para impedir.
  if (crm.estado === ILEGIBLE || ia.estado === ILEGIBLE || pagos.estado === ILEGIBLE) {
    await auditar(db, { accion: 'credencial_ilegible', orgId: org.id });
  }

  return {
    orgId: org.id,
    activa: org.activa,
    crm,
    ia,
    pagos,
    crmCuentaId: fila?.crm_cuenta_id ?? null,
    crmCalendarioId: fila?.crm_calendario_id ?? null,
    // Un booleano y NO el hash. Ver el campo.
    avisoSecretoConfigurado: (fila?.aviso_secreto_hash ?? null) !== null,
    pagosComercioId: fila?.pagos_comercio_id ?? null,
    fundacionesClienteId: fila?.fundaciones_cliente_id ?? null,
    actualizadoEl: fila?.actualizado_el ?? null,
  };
}

/**
 * El estado visible de UNA credencial cifrada.
 *
 * Toma el blob y su estado por separado —y no la fila entera— porque desde la Etapa 11 hay
 * tres credenciales en la misma fila. Con la firma anterior, la llave de IA habría tenido que
 * pasar por acá disfrazada de `crm_token_cifrado`, y el nombre habría dejado de decir la
 * verdad justo en la función que decide qué se muestra de un secreto.
 */
function verCredencial(cifrado: string | null, estado: EstadoCredencial): CredencialVisible {
  // Sin fila y con fila vacía significan lo mismo hacia afuera —nunca se cargó— y las dos son
  // `ausente`. Lo que NO pueden significar es lo mismo que `vencida`: eso es la fila `ADR-0606`.
  if (!cifrado) {
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
    vistaPrevia = enmascarar(descifrar(cifrado));
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
    estado,
    texto: ESTADOS_DE_CREDENCIAL[estado],
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

/**
 * Lo que le falta a una empresa para poder auditar. **Cuatro, y ninguno es un error.**
 *
 * ── POR QUÉ NO SE REUSA `resolverAccesoAFundaciones`, QUE YA LEE LA MISMA LLAVE ──
 *
 * Porque esa función exige además `fundaciones_cliente_id`, y **el auditor no lo necesita**: es el
 * identificador del alumno en el hub, que no tiene nada que ver con auditar agentes. Reusarla haría
 * que una empresa sin Fundaciones —perfectamente capaz de auditar— saliera como
 * `sin_alumno_vinculado`, y alguien iría a vincular una cuenta del hub para arreglar el auditor.
 *
 * Y las cuatro faltas se distinguen porque llevan a cuatro acciones distintas: cargar la llave,
 * revisar la clave maestra del servidor, escribir el identificador del agente en el CRM, y encender
 * el interruptor. Colapsarlas en «no se puede auditar» manda a las cuatro personas al lugar
 * equivocado — es la misma lección que el comentario de `FaltaParaGenerar` de más arriba.
 */
export type FaltaParaAuditar =
  | 'auditor_apagado'
  | 'sin_llave_de_ia'
  | 'llave_de_ia_ilegible'
  | 'sin_id_del_agente';

export type AccesoAlAuditor =
  | { tipo: 'listo'; claveIa: string; idDelAgente: string }
  | { tipo: 'falta'; que: FaltaParaAuditar };

export const TEXTO_DE_FALTA_AUDITOR: Readonly<Record<FaltaParaAuditar, string>> = {
  auditor_apagado: 'El auditor de IA está apagado para esta empresa.',
  sin_llave_de_ia:
    'Esta empresa no tiene su llave de IA cargada. Se carga en Integraciones, y sin ella no se puede ' +
    'auditar.',
  llave_de_ia_ilegible:
    'La llave de IA está cargada pero el servidor no puede leerla. Hay que volver a cargarla.',
  sin_id_del_agente:
    'Falta el identificador del agente de IA en el CRM. Sin él no se puede saber qué líneas de la ' +
    'conversación escribió el agente, así que no se audita.',
};

/**
 * La llave de IA, el identificador del agente y el interruptor. O **qué falta**.
 *
 * ── EL ORDEN DE LAS COMPROBACIONES ES EL DEL PORTÓN 0 ──────────────────────
 *
 * El interruptor primero, y por el mismo motivo que en `lib/auditor/portones.ts`: es el único de los
 * cuatro que alguien apretó a propósito. Con el orden al revés, una empresa apagada Y sin llave
 * saldría reportada como «sin llave», y quien la apagó iría a arreglar algo que no está roto.
 *
 * Y **corta antes de descifrar**: descifrar una llave que no se va a usar es trabajo criptográfico
 * por cada empresa apagada en cada corrida del cron.
 */
export async function resolverAccesoAlAuditor(db: Trx, orgId: string): Promise<AccesoAlAuditor> {
  const fila = await db
    .selectFrom('organizaciones_credenciales')
    .select(['auditor_activo', 'ia_clave_cifrada', 'crm_agente_usuario_id'])
    .where('org_id', '=', orgId)
    .executeTakeFirst();

  /* Sin fila de credenciales, la falta que corresponde es la de la llave y no «apagado»: el
     interruptor nace ENCENDIDO (`default true`), así que una empresa sin fila no tiene el auditor
     apagado — tiene todo por cargar. Decir «apagado» mandaría a buscar un interruptor que nadie tocó. */
  if (!fila) return { tipo: 'falta', que: 'sin_llave_de_ia' };
  if (fila.auditor_activo === false) return { tipo: 'falta', que: 'auditor_apagado' };
  if (!fila.ia_clave_cifrada) return { tipo: 'falta', que: 'sin_llave_de_ia' };

  const idDelAgente = (fila.crm_agente_usuario_id ?? '').trim();
  /* Se comprueba ANTES de descifrar. Es el orden barato, y además el que evita el caso peor: con el
     identificador vacío, el atribuidor no encontraría ni una línea del agente y cada conversación se
     auditaría para producir un «no auditable» — gasto puro con apariencia de funcionar. */
  if (idDelAgente === '') return { tipo: 'falta', que: 'sin_id_del_agente' };

  let claveIa: string;
  try {
    claveIa = descifrar(fila.ia_clave_cifrada);
  } catch {
    // `ADR-0809` · el mismo punto de emisión y la misma transacción que los otros dos resolvedores:
    // un descifrado que falla y no queda registrado es el cero indistinguible de «nadie cableó la señal».
    await auditar(db, { accion: 'credencial_ilegible', orgId });
    return { tipo: 'falta', que: 'llave_de_ia_ilegible' };
  }

  return { tipo: 'listo', claveIa, idDelAgente };
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

// ═══════════════════════════════════════════════════════════════════════════════
// ETAPA 11 · LO QUE LAS PESTAÑAS CLOSER Y SETTER NECESITAN DE ESTA TABLA
//
// Dos valores por organización, y los dos ya tenían columna desde la migración 006:
//
//   · `crm_token_cifrado` — el Private Integration Token de la subcuenta de GoHighLevel.
//   · `crm_cuenta_id`     — el Location ID de esa subcuenta. NO es secreto: es el
//     identificador de la cuenta, va y viene completo.
//
// Y hacen falta LOS DOS. Un token sin Location ID no sirve: cada llamada a la API v2 de GHL
// lleva el `locationId`, y un token que abarca varias subcuentas sin decir cuál devolvería los
// contactos de otra empresa del mismo cliente. Eso no fallaría — devolvería 200 con datos de
// alguien más.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Por qué una organización no puede sincronizar con GoHighLevel.
 *
 * CINCO razones y no una, con el mismo criterio que el resto de este archivo: cada una lleva a
 * una acción distinta, y colapsarlas en *"no se pudo conectar"* manda a cinco personas al lugar
 * equivocado.
 *
 *   · `sin_token`       → nunca se cargó. Se carga en Ajustes.
 *   · `token_ilegible`  → está cargado y el servidor no lo puede descifrar. **No es que falte**:
 *     decir "falta conectar" mandaría a reconectar algo conectado, y el problema real —la clave
 *     maestra del servidor— quedaría sin diagnosticar. Pasa al restaurar una copia de la base.
 *   · `token_vencido`   → se cargó y dejó de servir. Hay que volver a autorizarlo.
 *   · `token_revocado`  → lo cortaron desde el panel de GoHighLevel. Lo arregla el cliente, no
 *     nosotros, y decirle "está vencido" lo mandaría a esperar una renovación que no va a venir.
 *   · `sin_subcuenta`   → hay token y falta el Location ID. Ver el encabezado: sin él, un token
 *     de varias subcuentas traería los contactos de otra empresa **sin fallar**.
 */
export type FaltaParaGhl =
  | 'sin_token'
  | 'token_ilegible'
  | 'token_vencido'
  | 'token_revocado'
  | 'sin_subcuenta';

/** El texto de cada faltante. Uno por razón, ninguno genérico. */
export const TEXTO_DE_FALTA_GHL: Readonly<Record<FaltaParaGhl, string>> = {
  sin_token:
    'Falta el token de GoHighLevel de esta organización. Se carga en Ajustes.',
  token_ilegible:
    'El token está cargado y el servidor no puede leerlo. Hay que volver a cargarlo en Ajustes.',
  token_vencido:
    'La conexión con GoHighLevel venció. Hay que volver a autorizarla en Ajustes.',
  token_revocado:
    'El acceso fue revocado desde el panel de GoHighLevel. Hay que volver a autorizarlo ahí y cargar el token nuevo.',
  sin_subcuenta:
    'Falta el Location ID de tu subcuenta de GoHighLevel. Sin él no se sabe de qué cuenta traer los contactos.',
};

/** Lo que hace falta para hablar con GoHighLevel. */
export type AccesoAGhl =
  | { tipo: 'listo'; token: string; locationId: string }
  | { tipo: 'falta'; que: FaltaParaGhl };

/**
 * El token y la subcuenta de GoHighLevel de esta organización, o **qué falta**.
 *
 * ── EL ORDEN DE LAS COMPROBACIONES IMPORTA ──────────────────────────────────
 *
 * Primero la presencia, después el estado, y al final el descifrado. Si el estado se mirara
 * antes que la presencia, una organización sin fila —que es el caso normal de una organización
 * recién creada— recibiría el estado por omisión `ausente` traducido a un texto de conexión
 * rota, en vez de "falta cargarlo".
 *
 * Y `sin_subcuenta` se comprueba con el token YA descifrado, no antes: si se mirara primero,
 * alguien con el Location ID puesto y el token ilegible recibiría "falta la subcuenta" y se
 * pondría a buscar un dato que ya tiene.
 */
export async function resolverAccesoAGhl(db: Trx, orgId: string): Promise<AccesoAGhl> {
  const fila = await db
    .selectFrom('organizaciones_credenciales')
    .select(['crm_token_cifrado', 'crm_estado', 'crm_cuenta_id'])
    .where('org_id', '=', orgId)
    .executeTakeFirst();

  if (!fila || !fila.crm_token_cifrado) return { tipo: 'falta', que: 'sin_token' };
  if (fila.crm_estado === 'vencida') return { tipo: 'falta', que: 'token_vencido' };
  if (fila.crm_estado === 'revocada') return { tipo: 'falta', que: 'token_revocado' };

  let token: string;
  try {
    token = descifrar(fila.crm_token_cifrado);
  } catch {
    // ADR-0809 · el mismo punto de emisión que las otras dos funciones de este archivo, y en la
    // misma transacción: un descifrado que falla y no queda registrado es el cero
    // indistinguible de "nadie cableó la señal".
    await auditar(db, { accion: 'credencial_ilegible', orgId });
    return { tipo: 'falta', que: 'token_ilegible' };
  }

  if (!fila.crm_cuenta_id) return { tipo: 'falta', que: 'sin_subcuenta' };

  return { tipo: 'listo', token, locationId: fila.crm_cuenta_id };
}
