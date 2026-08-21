// El arranque del primer administrador. **Script contra la base, no endpoint HTTP.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ UN SCRIPT Y NO UN ENDPOINT
//
// `EJECUCION` § 3 lo cerró: *"Arranque del primer administrador: **script contra la base**, no
// endpoint HTTP."*
//
// El motivo es de superficie: un endpoint de arranque es una ruta pública que crea un usuario con
// todos los permisos. Tiene que estar abierta antes del primer arranque y cerrada después, y ese
// "después" es un estado que alguien tiene que recordar. Un script no está expuesto nunca.
//
// `PRUEBAS.md` § Etapa 3 nombra "arranque" entre las rutas públicas, y ahí gana `EJECUCION`: por eso
// `RUTAS_PUBLICAS` tiene **dos** entradas y no tres, y el `03` § 6 coincide (*"login, salud"*).
//
// ── SE NIEGA A CORRER DOS VECES ──────────────────────────────────────────────
//
// No es idempotente y no debería serlo: correrlo dos veces significa que alguien no sabe en qué
// estado está la base, y la respuesta correcta a eso es parar, no adivinar. Si ya hay un
// administrador fundador, sale con código 1 y lo dice.
//
//   node --env-file=.env.local scripts/arranque.mjs "Nombre Apellido" correo@dominio
//
// Imprime la contraseña temporal UNA vez, en la salida estándar. No queda en la base en claro, no
// se registra en la auditoría, y no hay forma de volver a verla: para eso está el restablecimiento.
// ═══════════════════════════════════════════════════════════════════════════════

import { conIdentidad, cerrarClientes } from '../lib/datos/capa.ts';
import { hashear } from '../lib/datos/hash.ts';
import { contrasenaTemporal } from '../lib/autenticacion/temporal.ts';

const [nombre, email] = process.argv.slice(2);

if (!nombre || !email) {
  console.error('uso: node --env-file=.env.local scripts/arranque.mjs "Nombre" correo@dominio');
  process.exit(2);
}

const temporal = contrasenaTemporal();

try {
  const resultado = await conIdentidad(async (db) => {
    // ── La comprobación que hace que esto no se pueda correr dos veces ────────
    const yaHay = await db
      .selectFrom('usuarios')
      .select('email')
      .where('es_admin_principal', '=', true)
      .executeTakeFirst();
    if (yaHay) return { creado: false, motivo: `ya existe el administrador fundador (${yaHay.email})` };

    // La organización principal tiene que existir. La crea la migración o el sembrado; este script
    // NO la crea, porque decidir cuál es la principal es una decisión de despliegue y no de un
    // argumento de línea de comandos.
    const principal = await db
      .selectFrom('organizaciones')
      .select(['id', 'slug'])
      .where('es_principal', '=', true)
      .executeTakeFirst();
    if (!principal) return { creado: false, motivo: 'no existe la organización principal' };

    const u = await db
      .insertInto('usuarios')
      .values({
        org_id: principal.id,
        nombre,
        email,
        password_hash: hashear(temporal),
        es_admin_principal: true,
        debe_cambiar_password: true,
        // `creado_por` queda nulo, y es el ÚNICO caso legítimo en todo el sistema: no hay nadie
        // antes que lo haya creado. En cualquier otro camino es obligatorio (07 § 1).
        creado_por: null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // Y el rol de plataforma. El disparador `usuarios_roles_plataforma_acotado` solo lo deja
    // porque este usuario es de la organización principal.
    const rol = await db
      .selectFrom('roles')
      .select('id')
      .where('clave', '=', 'superadministrador')
      .executeTakeFirstOrThrow();
    await db
      .insertInto('usuarios_roles')
      .values({ usuario_id: u.id, rol_id: rol.id, asignado_por: null })
      .execute();

    return { creado: true, id: u.id, slug: principal.slug };
  });

  if (!resultado.creado) {
    console.error(`arranque: ${resultado.motivo}`);
    console.error('Si de verdad hay que reemplazarlo, usá el restablecimiento de contraseña.');
    process.exit(1);
  }

  console.log(`administrador fundador creado en la organización "${resultado.slug}"`);
  console.log(`  correo:     ${email}`);
  console.log(`  temporal:   ${temporal}`);
  console.log('');
  console.log('Se muestra UNA vez. Nace con la marca de "debe cambiar la contraseña" y con el rol');
  console.log('de plataforma, que EXIGE segundo factor: el primer login va a pedir configurarlo.');
} finally {
  await cerrarClientes();
}
