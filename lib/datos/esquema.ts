// Los tipos de las tablas, para el constructor de consultas.
//
// Escritos a mano contra el SQL de `db/migraciones/`, no generados: el SQL es la
// fuente de verdad y tiene que quedar diffeable línea por línea contra el
// 01 § 2–§ 3 y el 09 § 2 (EJECUCION § 6: "no se inventa… se usa ESE").
//
// Las claves son los nombres SIN CALIFICAR, porque así los escribe el código de
// la aplicación: para eso está la ruta de búsqueda por rol (09 § 2 — "con esto, el
// código de la aplicación escribe `pedidos` y no `negocio.pedidos`"). Las
// migraciones, al contrario, califican todo.

import type { ColumnType, Generated } from 'kysely';

export interface TablaOrganizaciones {
  id: Generated<string>;
  nombre: string;
  slug: string;
  activa: Generated<boolean>;
  es_principal: Generated<boolean>;
  zona_horaria: Generated<string>;
  creada_el: Generated<Date>;
  actualizada_el: Generated<Date>;
}

export interface TablaUsuarios {
  id: Generated<string>;
  org_id: string;
  nombre: string;
  // Van juntas o no van: la restricción `usuarios_credenciales_completas` exige
  // que email y hash sean los dos nulos o los dos no nulos. Existe porque en un
  // sistema así suele haber usuarios SIN acceso, que solo sirven para atribuir
  // trabajo (01 § 3).
  email: string | null;
  password_hash: string | null;
  activo: Generated<boolean>;
  es_admin_principal: Generated<boolean>;
  debe_cambiar_password: Generated<boolean>;
  intentos_fallidos: Generated<number>;
  bloqueado_hasta: Date | null;
  ultimo_acceso_el: Date | null;
  creado_por: string | null;
  creado_el: Generated<Date>;
  /**
   * La preferencia de tema de esta persona: `'oscuro'` o `'claro'`.
   *
   * Vive acá y no en el navegador porque tiene que sobrevivir a cerrar sesión y a cambiar de
   * máquina. `Generated` porque la migración 019 le pone `default 'oscuro'`, que es lo que la
   * aplicación era antes de que el claro existiera.
   */
  tema: Generated<'oscuro' | 'claro'>;
}

export interface TablaPermisos {
  clave: string;
  descripcion: string;
}

export interface TablaRoles {
  id: Generated<string>;
  clave: string;
  /** Nulo = plantilla global de la plataforma. Con valor = rol privado de esa organización. */
  org_id: string | null;
  nombre: string;
  descripcion: string | null;
  es_sistema: Generated<boolean>;
  /** Solo puede existir en la organización principal. Lo hace cumplir un disparador. */
  solo_principal: Generated<boolean>;
  exige_segundo_factor: Generated<boolean>;
  /**
   * `true` = quien tenga este rol ve **solo** las secciones que tenga concedidas, y cero concedidas
   * son cero pestañas.
   *
   * Es lo que expresa «el administrador está desbloqueado» sin que ningún `if` nombre un rol
   * (`ADR-0302`), igual que `solo_principal` expresa la barrera entre inquilinos. Ver la migración 017.
   */
  secciones_restringidas: Generated<boolean>;
  creado_el: Generated<Date>;
}

export interface TablaRolesPermisos {
  rol_id: string;
  permiso: string;
}

/**
 * El alcance por persona: qué secciones ve. **Solo cuenta si su rol está marcado.**
 *
 * Cero filas con un rol restringido son cero pestañas —falla cerrado— y cero filas con un rol no
 * restringido no significan nada, porque las filas se ignoran. Ver la migración 017.
 */
export interface TablaUsuariosSecciones {
  usuario_id: string;
  /** Una clave de `SECCIONES`. La base la valida con un `check`, para que un renombre sea ruidoso. */
  seccion: string;
  concedida_el: Generated<Date>;
  concedida_por: string | null;
}

export interface TablaUsuariosRoles {
  usuario_id: string;
  rol_id: string;
  asignado_el: Generated<Date>;
  asignado_por: string | null;
}

/** Los cuatro estados de una sesión. La base los restringe con un CHECK. */
export type EstadoSesion = 'activa' | 'pendiente_2fo' | 'debe_cambiar_password' | 'debe_configurar_2fo';

export interface TablaSesiones {
  id: Generated<string>;
  usuario_id: string;
  /** El HASH del token, nunca el token. */
  token_hash: string;
  org_activa: string | null;
  estado: Generated<EstadoSesion>;
  /** Deslizante: se extiende al usar la sesión. */
  expira_el: Date;
  /** Techo duro. La renovación deslizante NUNCA lo toca. */
  expira_absoluto: Generated<Date>;
  ip: string | null;
  user_agent: string | null;
  creada_el: Generated<Date>;
}

export interface TablaAuditoriaAccesos {
  id: Generated<number>;
  /** Nulificable a propósito: un intento con un email inexistente no tiene usuario. */
  usuario_id: string | null;
  org_id: string | null;
  accion: string;
  detalle: unknown | null;
  ip: string | null;
  creado_el: Generated<Date>;
}

export interface TablaUsuariosSegundoFactor {
  usuario_id: string;
  secreto_cifrado: string;
  /** Nulo = alta empezada y no terminada. */
  confirmado_el: Date | null;
  respaldos_hash: Generated<string[]>;
  creado_el: Generated<Date>;
}

/** Los cuatro estados de una credencial. Un valor significa una sola cosa. */
export type EstadoCredencial = 'ausente' | 'activa' | 'vencida' | 'revocada';

export interface TablaOrganizacionesCredenciales {
  org_id: string;
  crm_token_cifrado: string | null;
  pagos_clave_cifrada: string | null;
  ia_clave_cifrada: string | null;
  crm_cuenta_id: string | null;
  /**
   * El calendario donde se agendan las llamadas. **No es un filtro del barrido.**
   *
   * El barrido lee TODOS los calendarios de la subcuenta; usar éste para acotarlo perdería las citas
   * de los demás — medido: 27 de 376. Ver la migración 016.
   */
  crm_calendario_id: string | null;
  /**
   * sha256 hex del secreto que GoHighLevel presenta en `X-Webhook-Secret` (migración 022).
   *
   * HASH y no `_cifrado` como sus vecinos, y la diferencia es de uso: el token del CRM hay que
   * DESCIFRARLO para llamar al proveedor; este secreto solo hay que COMPARARLO, porque lo presenta
   * quien llama. Nunca hay que leerlo, así que un volcado de la base no entrega un secreto usable.
   * Mismo motivo que `identidad.sesiones.token_hash`.
   *
   * Y es la llave de ATRIBUCIÓN: la empresa de un aviso sale de acá y no del cuerpo del webhook.
   */
  aviso_secreto_hash: string | null;
  pagos_comercio_id: string | null;
  crm_refresh_cifrado: string | null;
  crm_expira_el: Date | null;
  crm_estado: Generated<EstadoCredencial>;
  /**
   * A qué alumno del hub (ARIA-brain) corresponde esta organización. Migración 009.
   *
   * **No es un secreto**, y por eso no está cifrada: es un identificador de cuenta ajena, de la
   * misma clase que `crm_cuenta_id` y `pagos_comercio_id`, que tampoco lo están. Lo que protege el
   * trabajo del alumno no es que este número sea difícil de adivinar —es un UUID en la base de otro
   * sistema— sino que la llave de servicio del almacén nunca sale del servidor.
   *
   * Nulo significa *"esta organización no tiene Fundaciones"*, y Fundaciones responde
   * `sin_alumno_vinculado`. No hay valor por omisión: uno cualquiera dejaría a una organización
   * leyendo y ESCRIBIENDO el trabajo de otro alumno.
   */
  fundaciones_cliente_id: string | null;
  actualizado_el: Generated<Date>;
  actualizado_por: string | null;
}

/** La vista de permisos efectivos. Solo la alcanza `app_identidad`. */
export interface VistaUsuariosPermisos {
  usuario_id: string;
  permiso: string;
}

/**
 * La tabla de control del aislamiento, en el esquema `negocio`.
 *
 * Existe para que el aislamiento sea comprobable —"con la organización A no se ve ni
 * una fila de la B"— y para la sonda horaria del `10` § 1. Para nada más: ninguna
 * métrica ni informe de negocio la cuenta.
 */
export interface TablaControlAislamiento {
  id: Generated<string>;
  /**
   * La columna del inquilino.
   *
   * `ColumnType<lectura, inserción, actualización>` y NO `Generated<string>`, y la
   * diferencia cierra un agujero real:
   *
   *   · al LEER es un `string` — siempre está;
   *   · al INSERTAR es opcional, porque la capa fina la inyecta y el código de negocio
   *     no la escribe;
   *   · al ACTUALIZAR es `never`, así que `updateTable('…').set({ org_id: … })` es un
   *     ERROR DE COMPILACIÓN.
   *
   * Ese tercer parámetro es el que importa. Con `Generated<string>` la actualización
   * queda permitida por los tipos y solo la detiene el `with check` de la política en
   * tiempo de ejecución — y hay un camino que ni eso cubre bien: un
   * `onConflict(...).doUpdateSet({ org_id: <ajena> })` compila, sale, y depende
   * enteramente de la política. Mover la columna del inquilino de una fila existente no
   * es una operación que este sistema quiera tener disponible: es "cambiarle el dueño a
   * todo lo que hizo", que el 05 § 3 dice que necesita su propia operación, su propia
   * capacidad y su propio registro de auditoría.
   */
  org_id: ColumnType<string, string | undefined, never>;
  marca: string;
  creado_el: Generated<Date>;
}


// ═══════════════════════════════════════════════════════════════════════════════
// LAS OCHO TABLAS DE NEGOCIO DE LAS PESTAÑAS CLOSER Y SETTER (`11` § 2)
//
// Las ocho llevan `org_id` con el MISMO tipo que `control_aislamiento`:
// `ColumnType<string, string | undefined, never>`. El tercer parámetro es el que importa —
// hace que `updateTable('contactos').set({ org_id: … })` sea un error de COMPILACIÓN, no
// algo que solo detenga la política en tiempo de ejecución. Mover un contacto de una
// organización a otra no es una operación que este sistema quiera tener disponible.
//
// Y las columnas que la fuente no tiene van como `| null`, no como obligatorias. El
// motivo está en el encabezado de la migración 011 y es el `11` § 9 regla 1: un cero
// medido y un cero no medido no son el mismo hecho.
// ═══════════════════════════════════════════════════════════════════════════════

/** La columna del inquilino, igual en las ocho. Ver `TablaControlAislamiento.org_id`. */
type ColumnaInquilino = ColumnType<string, string | undefined, never>;

/** El territorio: de qué pestaña es el contacto. `null` = en ninguno ("congelado"). */
export type Territorio = 'closer' | 'setter';

/** Las salidas de Avanzar. Las seis del closer más las tres propias del setter. */
export type SalidaResultado =
  | 'venta'
  | 'acuerdo_sin_pago'
  | 'seguimiento'
  | 'no_interesa'
  | 'no_show'
  | 'nurture'
  | 'agendo'
  | 'venta_chica'
  | 'no_califica';

/**
 * La entidad central.
 *
 * `etapa`, `score`, `responsable_id` y `territorio` admiten nulos porque **GoHighLevel no
 * los da**: no hay campo de etapa que leer —la mueve un workflow disparado por una
 * etiqueta—, nada calcula el score, y las etiquetas dicen territorio, no asignación.
 */
export interface TablaContactos {
  id: Generated<string>;
  org_id: ColumnaInquilino;
  ghl_contact_id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  etiquetas: Generated<string[]>;
  territorio: Territorio | null;
  fuente: Generated<string>;
  etapa: string | null;
  score: string | null;
  responsable_id: string | null;
  responsable_rol: Territorio | null;
  /**
   * El sello de atribución del setter. La ÚNICA excepción a "lo calculado no se guarda"
   * (`11` § 2 regla 4), y un disparador impide sobreescribirlo o apagarlo.
   *
   * El tipo NO lo refleja a propósito: un `never` de actualización haría imposible
   * ENCENDERLO, que es la operación legítima. La invariante vive en la base, donde un
   * `update` no la puede esquivar.
   */
  sello_setter_id: string | null;
  sello_setter_el: Date | null;
  ultimo_entrante_el: Date | null;
  ultimo_entrante_texto: string | null;
  ultimo_saliente_el: Date | null;
  sincronizado_el: Date | null;
  /**
   * Desde cuándo tenemos los mensajes de este contacto. **Nula = no se leyó su historia.**
   *
   * Sin esta columna, una conversación vacía y una que nadie leyó se ven idénticas, y la ficha
   * diría «nunca escribió» de las dos.
   */
  mensajes_desde_el: Date | null;
  creado_el: Generated<Date>;
}

export interface TablaCitas {
  id: Generated<string>;
  org_id: ColumnaInquilino;
  ghl_evento_id: string;
  contacto_id: string;
  inicio_el: Date;
  fin_el: Date | null;
  titulo: string | null;
  /** El estado tal como lo devuelve GHL. Texto y no enumerado: los valores son de ellos. */
  estado_ghl: string | null;
  /** La sala. `null` es un caso con tratamiento propio en la interfaz (`11` § 5.4). */
  sala_url: string | null;
  sincronizado_el: Date | null;
  creado_el: Generated<Date>;
}

export interface TablaMensajes {
  id: Generated<string>;
  org_id: ColumnaInquilino;
  ghl_mensaje_id: string;
  /** De qué conversación del CRM salió. Es lo que permite pedir el resto sin buscarla de nuevo. */
  ghl_conversacion_id: string | null;
  contacto_id: string;
  canal: string | null;
  direccion: 'entrante' | 'saliente';
  cuerpo: string | null;
  /** Tres estados y no dos: el bot y una persona ausente no son lo mismo. */
  autor: 'contacto' | 'agente' | 'persona';
  autor_usuario_id: string | null;
  /** Quién lo mandó según el CRM, cuando no es alguien nuestro. Texto libre: es un id ajeno. */
  autor_ghl_usuario_id: string | null;
  enviado_el: Date;

  /**
   * El estado CRUDO del canal, **sin `check`**. El vocabulario es ajeno: una lista cerrada
   * convertiría un valor nuevo en un error que aborta la transacción y con ella el ciclo entero.
   */
  estado_entrega: string | null;
  /** Nuestra clasificación, **con `check`**. La calcula `familiaDeEntrega()`, que es total. */
  estado_entrega_familia: Generated<'en_curso' | 'entregado' | 'fallido' | 'desconocido'>;
  /** El texto del canal cuando rechazó. Es lo único que explica por qué no llegó. */
  fallo_del_canal: string | null;
  estado_entrega_el: Date | null;
  /** Cuándo lo miró la tercera pasada. `null` = nunca, y por eso el índice ordena `nulls first`. */
  estado_entrega_revisado_el: Date | null;
  /**
   * `true` = el identificador lo inventamos nosotros porque el CRM no devolvió uno.
   * La pasada de entregas los EXCLUYE: preguntar por un id que no existe cuesta dos llamadas por
   * ciclo para siempre y la cola no se vacía nunca.
   */
  id_fabricado: Generated<boolean>;
  /** Por qué camino entró: `aviso`, `ingesta`, `revision`, `apertura` o `propio`. */
  origen: Generated<'aviso' | 'ingesta' | 'revision' | 'apertura' | 'propio'>;

  creado_el: Generated<Date>;
}

/**
 * El pulso de la ingesta: el candado, las marcas y la contabilidad del coste.
 *
 * Una fila por organización y por cosa que se ingiere. Hoy la única clave es `'mensajes'`.
 */
/**
 * El sello de las tareas programadas. La escribe UN solo archivo, `lib/negocio/barrido.ts`.
 *
 * Es una tabla distinta de `ingesta_pulso` y no una columna más, porque contesta una pregunta que
 * esa no puede: **¿pasó el cron por acá?**. `ingesta_pulso` solo se escribe cuando el trabajo corre,
 * y quien más gana su candado hoy es el reloj del navegador cada 10 segundos — así que un pulso
 * fresco no distingue «el cron se disparó» de «alguien tenía la pestaña abierta».
 */
/**
 * La comisión de una persona: su porcentaje y su meta.
 *
 * Los dos son **nulables y sin valor por omisión**, y es la decisión central de la tabla: una
 * comisión sin cargar es `null`, no `0`. Un 0 % afirma que esa persona no cobra comisión, que es un
 * hecho distinto de «todavía nadie lo configuró». Ver la migración 015.
 */
export interface TablaComisiones {
  org_id: ColumnaInquilino;
  usuario_id: string;
  /** Hoy solo `closer`. Está en la clave primaria para que agregar un tramo no sea migrarla. */
  tipo: string;
  /** `null` = nadie lo cargó. **Nunca `0` por omisión.** */
  porcentaje: string | null;
  /** `null` = sin meta. Nunca `0`: lo prohíbe un `check` de la base. */
  meta_mensual: string | null;
  actualizado_el: Generated<Date>;
  actualizado_por: string | null;
}

/**
 * Quién es EL closer de la organización. **Una fila por empresa, y `org_id` es la clave primaria
 * entera** — así «uno solo» no es una convención del código sino una fila que la base no acepta.
 *
 * Sin fila = nadie designó a nadie, que NO es lo mismo que «designó a nadie». La pantalla muestra
 * `—` y un aviso, nunca `0`. Ver la migración 020.
 */
export interface TablaCloserAsignado {
  org_id: ColumnaInquilino;
  usuario_id: string;
  actualizado_el: Generated<Date>;
  actualizado_por: string | null;
}

export interface TablaTareasProgramadas {
  org_id: ColumnaInquilino;
  tarea: string;
  /** Cuándo PASÓ el cron, no cuándo hizo trabajo. Lo segundo lo dice `ultimo_estado`. */
  ultima_corrida_el: Date;
  /** `corrio` | `saltada` | `frenada` | `sin_tiempo` | `fallo`. Los tres del medio son normales. */
  ultimo_estado: string;
  /** Cuál de las cinco faltas de credencial, o por qué frenó. Nulo solo cuando corrió. */
  ultimo_motivo: string | null;
  ultimas_llamadas: number | null;
  creado_el: Generated<Date>;
}

/**
 * La cuarentena de avisos de GoHighLevel (migración 022).
 *
 * Todo cuerpo entra CRUDO acá antes de interpretarse, y se responde 200 enseguida. Si el mapeo falla,
 * el evento no se perdió: queda la fila con su `error` para reprocesar.
 */
export interface TablaAvisosDelCrm {
  org_id: ColumnaInquilino;
  id: Generated<string>;
  /** sha256 hex del cuerpo crudo. Es la idempotencia ante entregas duplicadas del proveedor. */
  huella: string;
  /**
   * Del `?evento=` de la URL. **Nulo es la trampa**: si alguien pega la URL base sin el parámetro, el
   * aviso se guarda, responde 200 y no se interpreta nunca. Por eso `procesado_el` tiene lector.
   */
  evento: string | null;
  /** El cuerpo crudo. `text` y no `jsonb`: la huella es sobre estos bytes exactos. */
  cuerpo: string;
  bytes: number;
  /** `coincide` | `ausente` | `discordante` | `ilegible`. Se COMPARA; no rutea. */
  atribucion: string;
  repeticiones: Generated<number>;
  recibido_el: Generated<Date>;
  visto_ultimo_el: Generated<Date>;
  /** Cuándo se INTERPRETÓ. Nulo = llegó y no se pudo mapear, que no es lo mismo que «no llegó». */
  procesado_el: Date | null;
  error: string | null;
}

export interface TablaIngestaPulso {
  org_id: ColumnaInquilino;
  clave: string;
  /**
   * **Toda conversación cuya última actividad es anterior o igual a esto ya fue ingerida.**
   * No es «la última vez que corrimos»: eso avanza con el reloj y se saltea lo que falló.
   */
  marca_el: Date | null;
  /** El piso. Antes de esta fecha, «vacío» significa «no se leyó», no «nunca escribió». */
  marca_desde_el: Date | null;
  ultima_corrida_el: Date | null;
  ultima_corrida_llamadas: number | null;
  llamadas_acumuladas: Generated<string>;
  corridas: Generated<string>;
  /** `true` = se agotó un tope y quedó trabajo sin hacer. Una cola incompleta tiene que decirlo. */
  atrasado: Generated<boolean>;
  ultimo_fallo: string | null;
  ultimo_fallo_el: Date | null;
  creado_el: Generated<Date>;
}

export interface TablaLlamadas {
  id: Generated<string>;
  org_id: ColumnaInquilino;
  externa_id: string;
  contacto_id: string;
  agente: string | null;
  /** CONTESTADAS, no hechas. El tercer ícono de la fila cuenta esto (`11` § 7.2). */
  contestada: Generated<boolean>;
  /** Admite nulos: 42 % de las llamadas de origen no tienen hora de inicio (no se establecieron). */
  inicio_el: Date | null;
  duracion_segundos: number | null;
  resumen: string | null;
  creado_el: Generated<Date>;
}

export interface TablaTareas {
  id: Generated<string>;
  org_id: ColumnaInquilino;
  contacto_id: string;
  /** Vence UN DÍA, no a una hora: la frontera la calcula la consulta con la zona. */
  vence_el: Date;
  situacion: string | null;
  modo: string | null;
  nota: string | null;
  /** Fecha y no booleano: así "Completadas hoy" se vacía sola a medianoche. */
  completada_el: Date | null;
  completada_por: string | null;
  /** `null` = lo registró el Sistema (`11` § 9 regla 5). */
  creada_por: string | null;
  creado_el: Generated<Date>;
}

export interface TablaResultados {
  id: Generated<string>;
  org_id: ColumnaInquilino;
  contacto_id: string;
  salida: SalidaResultado;
  /** El rol que lo registró: las dos comisiones se calculan distinto. */
  rol: Territorio;
  /** `null` cuando la salida no pide monto. **No cero**: cero es un monto medido. */
  monto: string | null;
  forma_pago: string | null;
  detalle: string | null;
  nota: string | null;
  registrado_por: string | null;
  creado_el: Generated<Date>;
}

/**
 * UNA tabla para los dos roles (`11` § 7.4).
 *
 * *"No hay endpoint de notas por rol y no debería haberlo: es el mismo dato sobre el mismo
 * lead. Cuando pasó, las notas del setter vivían solo en memoria y se perdían al recargar
 * la página, sin que nada fallara."*
 */
export interface TablaNotas {
  id: Generated<string>;
  org_id: ColumnaInquilino;
  contacto_id: string;
  cuerpo: string;
  /** `null` solo para las importadas: el endpoint de notas de GHL no devuelve autor. */
  autor_id: string | null;
  /** Y esto distingue "importada sin autor" de "escrita acá". Sin él, el nulo miente. */
  origen: Generated<'plataforma' | 'importada'>;
  creado_el: Generated<Date>;
}

export interface TablaHallazgos {
  id: Generated<string>;
  org_id: ColumnaInquilino;
  contacto_id: string;
  titulo: string;
  categoria: string | null;
  severidad: string | null;
  diagnostico: string | null;
  /** Abierto = sin fecha. Así la cola no depende de que alguien apague una bandera. */
  resuelto_el: Date | null;
  resuelto_por: string | null;
  detectado_el: Generated<Date>;
}

/** Las diez tablas de identidad, la vista de permisos efectivos, y las de negocio. */
export interface BaseDeDatos {
  control_aislamiento: TablaControlAislamiento;
  organizaciones: TablaOrganizaciones;
  usuarios: TablaUsuarios;
  permisos: TablaPermisos;
  roles: TablaRoles;
  roles_permisos: TablaRolesPermisos;
  usuarios_roles: TablaUsuariosRoles;
  usuarios_secciones: TablaUsuariosSecciones;
  sesiones: TablaSesiones;
  auditoria_accesos: TablaAuditoriaAccesos;
  usuarios_segundo_factor: TablaUsuariosSegundoFactor;
  organizaciones_credenciales: TablaOrganizacionesCredenciales;
  usuarios_permisos: VistaUsuariosPermisos;

  // Las DOCE de negocio. Sin calificar, como las demas: la ruta de busqueda por rol las
  // resuelve en `negocio`, y `public` no esta en la ruta de ningun rol nuestro.
  //
  // El comentario decía «ocho» y ya listaba once: un conteo escrito a mano envejece con cada
  // tabla nueva y nada falla. Se corrige al agregar la doceava.
  contactos: TablaContactos;
  citas: TablaCitas;
  mensajes: TablaMensajes;
  ingesta_pulso: TablaIngestaPulso;
  tareas_programadas: TablaTareasProgramadas;
  avisos_del_crm: TablaAvisosDelCrm;
  comisiones: TablaComisiones;
  closer_asignado: TablaCloserAsignado;
  llamadas: TablaLlamadas;
  tareas: TablaTareas;
  resultados: TablaResultados;
  notas: TablaNotas;
  hallazgos: TablaHallazgos;
}
