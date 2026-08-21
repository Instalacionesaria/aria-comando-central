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
  creado_el: Generated<Date>;
}

export interface TablaRolesPermisos {
  rol_id: string;
  permiso: string;
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
  pagos_comercio_id: string | null;
  crm_refresh_cifrado: string | null;
  crm_expira_el: Date | null;
  crm_estado: Generated<EstadoCredencial>;
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

/** Las diez tablas de identidad, la vista de permisos efectivos, y las de negocio. */
export interface BaseDeDatos {
  control_aislamiento: TablaControlAislamiento;
  organizaciones: TablaOrganizaciones;
  usuarios: TablaUsuarios;
  permisos: TablaPermisos;
  roles: TablaRoles;
  roles_permisos: TablaRolesPermisos;
  usuarios_roles: TablaUsuariosRoles;
  sesiones: TablaSesiones;
  auditoria_accesos: TablaAuditoriaAccesos;
  usuarios_segundo_factor: TablaUsuariosSegundoFactor;
  organizaciones_credenciales: TablaOrganizacionesCredenciales;
  usuarios_permisos: VistaUsuariosPermisos;
}
