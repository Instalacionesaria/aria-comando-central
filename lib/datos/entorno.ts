// Lectura del entorno para la capa de datos.
//
// VALIDA PEREZOSAMENTE, en el primer uso, NUNCA al importarse. No es estilo: este
// repositorio está conectado a Vercel y cada push a `main` despliega a producción.
// Si este módulo validara en la carga —o desde `instrumentation.ts register()`,
// que además corre durante el build— el próximo push tumbaría producción por
// variables que todavía no existen en Vercel.
//
// La Etapa 0 no agrega ningún manejador de ruta, así que nada en tiempo de
// ejecución llega hasta acá. Es deliberado, y esta forma es lo que lo mantiene
// cierto.

export type RolBase = 'admin' | 'migrador' | 'inquilino' | 'identidad';

const VARIABLE: Readonly<Record<RolBase, string>> = {
  // Superusuario del clúster. Solo el arranque de roles y la compuerta del
  // controlador. NO va al entorno de la aplicación.
  admin: 'DATABASE_URL_ADMIN',
  // Propietario de las tablas. Solo las migraciones. Su contraseña NO está en el
  // entorno de la aplicación desplegada (09 § 2, 10 § 4).
  migrador: 'DATABASE_URL_MIGRADOR',
  // Los dos dominios de la aplicación.
  inquilino: 'DATABASE_URL_INQUILINO',
  identidad: 'DATABASE_URL_IDENTIDAD',
};

export function nombreDeVariable(rol: RolBase): string {
  return VARIABLE[rol];
}

export function urlDe(rol: RolBase): string {
  const nombre = VARIABLE[rol];
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(
      `${nombre} no está definida. Para el entorno local: ` +
        '`node scripts/credenciales.mjs --escribir` y después `npm run db:reset`.',
    );
  }
  return valor;
}

// Los tres roles de la aplicación y las migraciones. `admin` queda afuera a
// propósito: es del clúster, no del diseño.
export const ROLES_DEL_DISENO: readonly RolBase[] = ['migrador', 'inquilino', 'identidad'];

// El nombre del rol de base, tal como lo ve PostgreSQL. Lo usan las pruebas de
// catálogo y las afirmaciones de `current_user`.
export const NOMBRE_EN_LA_BASE: Readonly<Record<Exclude<RolBase, 'admin'>, string>> = {
  migrador: 'migrador',
  inquilino: 'app_inquilino',
  identidad: 'app_identidad',
};
