// El alta de los Clientes High Ticket: de una cuenta del hub a una organización propia.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ HACE, Y POR QUÉ ES UN SCRIPT Y NO UN ENDPOINT
//
// ARIA acompaña a menos de diez Clientes High Ticket para que se vuelvan agencias de IA. Cada uno
// entra hoy a ARIA-brain con una cuenta de `aria_brain_clientes`, y a partir de ahora tiene que
// entrar a Comando Central como **administrador de SU PROPIA organización**.
//
// Por cada uno se crean cuatro cosas:
//
//   1. `identidad.organizaciones`          — su empresa
//   2. `identidad.usuarios`                — su correo y su contraseña
//   3. `identidad.usuarios_roles`          — el rol `administrador`
//   4. `organizaciones_credenciales`       — el vínculo con su cuenta del hub
//
// Es un script y no una ruta HTTP por el mismo motivo que `scripts/arranque.mjs`: crea
// organizaciones y usuarios, o sea que corre SIN contexto de organización. `EJECUCION` § 3 lo cerró
// para el primer administrador —*"script contra la base, no endpoint HTTP"*— y acá vale igual:
// nunca está expuesto, corre una vez, y se puede leer entero antes de correrlo.
//
// ── IDEMPOTENTE, Y LO DEMUESTRA ──────────────────────────────────────────────
//
// Correrlo dos veces no duplica nada: cada paso comprueba antes de escribir. Eso importa porque el
// alta va a fallar a medias alguna vez —una contraseña ausente, un correo repetido— y la salida
// correcta es arreglar el dato y volver a correrlo, no limpiar a mano.
//
// ── POR OMISIÓN NO ESCRIBE ───────────────────────────────────────────────────
//
//   node --env-file=.env.supabase scripts/altas-high-ticket.mjs              # muestra el plan
//   node --env-file=.env.supabase scripts/altas-high-ticket.mjs --aplicar    # lo ejecuta
//
// Escribir en la base de producción sin que nadie lo pida es la clase de comodidad que después
// nadie recuerda haber aceptado. Mismo criterio que `scripts/credenciales.mjs`.
// ═══════════════════════════════════════════════════════════════════════════════

import { conIdentidad, cerrarClientes } from '../lib/datos/capa.ts';
import { hashear } from '../lib/datos/hash.ts';
import { pedirExterno } from '../lib/http/cliente.ts';

const APLICAR = process.argv.includes('--aplicar');

// ── La lista explícita, y por qué no se deduce ───────────────────────────────
//
// El hub tiene quince cuentas activas, y NO todas son Clientes High Ticket: hay cuentas de prueba
// (`Cuenta de prueba (R. Salas)`, `jq`) y de gente de ARIA. Crear una organización por cada una
// llenaría el sistema de inquilinos que nadie va a usar, y un inquilino de más no molesta hasta el
// día que alguien cuenta cuántos clientes hay y le sale el número equivocado.
//
// Se pasa a mano, con `--solo`, y eso es deliberado: no hay ninguna columna en el hub que separe
// "cliente real" de "cuenta de prueba", así que cualquier regla que yo inventara acá —descartar los
// que dicen "prueba", quedarme con los de un dominio— sería una adivinanza que funciona hoy y falla
// en el próximo alta, en silencio.
//
//   node … scripts/altas-high-ticket.mjs --solo=uno@x.com,dos@y.com --aplicar
//
// Sin `--solo` el plan muestra TODAS las aptas, para poder elegir. Pero `--aplicar` sin `--solo`
// se niega: aplicar sobre "todas" es justo la decisión que nadie quiso tomar.
const SOLO = (() => {
  const arg = process.argv.find((a) => a.startsWith('--solo='));
  if (!arg) return null;
  const correos = arg
    .slice('--solo='.length)
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c.length > 0);
  return correos.length > 0 ? new Set(correos) : null;
})();

// ── El rol que recibe cada Cliente High Ticket ───────────────────────────────
//
// `administrador`, no un rol nuevo, y no es pereza: **él ES el administrador de su cuenta**. Tiene
// 19 de las 22 capacidades —todas menos las tres de `organizaciones.*`, que son de plataforma—, así
// que manda dentro de su organización y no puede ver ni tocar la de otro.
//
// Y `configuracion.editar` viene incluida ahí, que es la que le va a permitir ponerle el nombre
// real a su empresa desde Ajustes.
const ROL = 'administrador';

// ── Lo que NO se pone, y encontrarlo evitó que el alta fallara ───────────────
//
// `es_admin_principal` queda en FALSO. La tentación es ponerlo en verdadero —"es el administrador
// de su cuenta"— y el segundo alta habría fallado con un error de índice único.
//
// El motivo: `usuarios_un_admin_principal` es único sobre `(es_admin_principal) where
// es_admin_principal`, **sin particionar por organización**. O sea que en TODA la base hay un solo
// `es_admin_principal`, y la migración 002 lo dice en una línea: *"El administrador fundador. Hay
// UNO y es inmutable en lo que importa."* No es "el admin de esta empresa": es el fundador de la
// plataforma, el que `ADR-0101` protege de ser borrado, desactivado o degradado.
//
// Las capacidades de administrar su organización vienen del ROL, no de esta bandera.
const ES_ADMIN_PRINCIPAL = false;

/** Las dos variables del almacén del hub. Sin ellas no hay de dónde leer las cuentas. */
function conexionAlHub() {
  const url = process.env.ALMACEN_HUB_URL;
  const llave = process.env.ALMACEN_HUB_LLAVE_SERVICIO;
  if (!url || !llave) {
    throw new Error(
      'Faltan ALMACEN_HUB_URL y ALMACEN_HUB_LLAVE_SERVICIO. Son las del Supabase de ARIA-brain: ' +
        'de ahí se leen las cuentas de los Clientes High Ticket.',
    );
  }
  return { url, cabeceras: { apikey: llave, authorization: `Bearer ${llave}` } };
}

/**
 * El slug de una organización, derivado del correo. **Estable para siempre.**
 *
 * Del correo y no del nombre del negocio, y la diferencia importa: el nombre lo va a cambiar el
 * Cliente High Ticket desde Ajustes, y si el slug se derivara de él, cambiaría con cada edición y
 * rompería cualquier cosa que lo referencie. El correo no cambia.
 */
function slugDesdeCorreo(correo) {
  const local = correo.split('@')[0] ?? correo;
  const limpio = local
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return limpio.length > 0 ? limpio : 'sin-nombre';
}

/**
 * El nombre provisional de la organización.
 *
 * Se usa `nombre_negocio` del hub cuando existe, porque es el nombre REAL de la empresa y así la
 * mayoría no va a tener que editar nada. El correo es el respaldo, no la primera opción: una
 * pantalla que arranca diciendo «giglesias» cuando la base ya sabía «Apex Estudio» es trabajo que
 * se le pasa a la persona sin motivo.
 *
 * Nunca queda vacío: `organizaciones.nombre` es `not null`, y además ese texto es el que el diseño
 * muestra arriba a la izquierda — una organización sin nombre ahí se lee como un error de la app.
 */
function nombreProvisional(cliente) {
  const negocio = (cliente.nombre_negocio ?? '').trim();
  if (negocio.length > 0) return negocio;
  return slugDesdeCorreo(cliente.email);
}

/**
 * Las cuentas del hub que pueden entrar.
 *
 * Se descartan, con motivo dicho: las inactivas (ya no son clientes) y las que no tienen
 * contraseña (nunca completaron el formulario de Jorge, así que no hay con qué entrar).
 */
async function clientesDelHub() {
  const { url, cabeceras } = conexionAlHub();
  const r = await pedirExterno(
    `${url}/rest/v1/aria_brain_clientes?select=id,email,password,nombre_negocio,activo&order=email`,
    { cabeceras },
  );
  if (r.tipo === 'rechazado') {
    throw new Error(`El hub rechazó la lectura (HTTP ${r.estado}). Revisá la llave del almacén.`);
  }
  if (r.tipo === 'sin_respuesta') {
    throw new Error(`No se pudo leer el hub: ${r.causa}`);
  }

  const todos = Array.isArray(r.datos) ? r.datos : [];
  const aptos = [];
  const descartados = [];
  for (const c of todos) {
    if (!c.email) {
      descartados.push({ email: '(sin correo)', motivo: 'la fila no tiene correo' });
      continue;
    }
    if (c.activo === false) {
      descartados.push({ email: c.email, motivo: 'la cuenta está inactiva en el hub' });
      continue;
    }
    if (!c.password) {
      descartados.push({ email: c.email, motivo: 'no tiene contraseña: no hay con qué entrar' });
      continue;
    }
    aptos.push(c);
  }
  return { aptos, descartados, total: todos.length };
}

/**
 * Da de alta a un Cliente High Ticket. Devuelve qué se creó y qué ya estaba.
 *
 * Todo dentro de UNA transacción de identidad: si el rol falla, no queda un usuario sin rol —que es
 * un usuario que entra y no ve nada, el peor estado a medias posible.
 */
async function alta(cliente) {
  const correo = cliente.email.trim().toLowerCase();
  const slug = slugDesdeCorreo(correo);
  const nombre = nombreProvisional(cliente);
  const hecho = [];
  const yaEstaba = [];

  await conIdentidad(async (db) => {
    // 1 · La organización, por slug (que es lo único estable).
    let org = await db
      .selectFrom('organizaciones')
      .select(['id', 'nombre'])
      .where('slug', '=', slug)
      .executeTakeFirst();

    if (org) {
      yaEstaba.push(`organización (${org.nombre})`);
    } else {
      org = await db
        .insertInto('organizaciones')
        .values({ nombre, slug })
        .returning(['id', 'nombre'])
        .executeTakeFirstOrThrow();
      hecho.push(`organización «${nombre}» (slug ${slug})`);
    }

    // 2 · El usuario. Se busca por `lower(email)` porque así es el índice único, y buscar por la
    //     columna cruda funcionaría solo mientras todos los caminos guarden en minúsculas.
    const existente = await db
      .selectFrom('usuarios')
      .select(['id', 'org_id'])
      .where((eb) => eb(eb.fn('lower', ['email']), '=', correo))
      .executeTakeFirst();

    let usuarioId;
    if (existente) {
      // Un correo que ya existe EN OTRA organización no se toca ni se mueve: mover a alguien de
      // organización es "cambiarle el dueño a todo lo que hizo", y eso necesita su propia decisión.
      if (existente.org_id !== org.id) {
        throw new Error(
          `${correo} ya existe en OTRA organización. No se mueve solo: decidilo a mano.`,
        );
      }
      usuarioId = existente.id;
      yaEstaba.push('usuario');
    } else {
      // La contraseña del hub está en TEXTO PLANO y acá se guarda con `scrypt`. Nunca se escribe a
      // disco ni se muestra: pasa de la respuesta del hub a `hashear()` y se descarta.
      const creado = await db
        .insertInto('usuarios')
        .values({
          org_id: org.id,
          nombre: nombre,
          email: correo,
          password_hash: hashear(String(cliente.password)),
          es_admin_principal: ES_ADMIN_PRINCIPAL,
          // Entra con la contraseña que ya conoce del hub, y la pantalla le pide una nueva antes de
          // dejarlo pasar. Eso CORTA el vínculo con la contraseña que quedó en claro en el hub, que
          // es el único motivo por el que vale el paso extra.
          debe_cambiar_password: true,
        })
        .returning(['id'])
        .executeTakeFirstOrThrow();
      usuarioId = creado.id;
      hecho.push('usuario con cambio de contraseña obligatorio');
    }

    // 3 · El rol.
    const rol = await db
      .selectFrom('roles')
      .select(['id'])
      .where('clave', '=', ROL)
      .where('org_id', 'is', null)
      .executeTakeFirstOrThrow();

    const tieneRol = await db
      .selectFrom('usuarios_roles')
      .select(['usuario_id'])
      .where('usuario_id', '=', usuarioId)
      .where('rol_id', '=', rol.id)
      .executeTakeFirst();

    if (tieneRol) {
      yaEstaba.push(`rol ${ROL}`);
    } else {
      await db.insertInto('usuarios_roles').values({ usuario_id: usuarioId, rol_id: rol.id }).execute();
      hecho.push(`rol ${ROL}`);
    }

    // 4 · El vínculo con su cuenta del hub. `org_id` es la clave primaria, así que `on conflict`
    //     alcanza — y se ACTUALIZA a propósito: si alguien vinculó mal la organización, correr esto
    //     otra vez lo corrige en vez de dejar el valor viejo en silencio.
    const credenciales = await db
      .selectFrom('organizaciones_credenciales')
      .select(['fundaciones_cliente_id'])
      .where('org_id', '=', org.id)
      .executeTakeFirst();

    if (credenciales?.fundaciones_cliente_id === cliente.id) {
      yaEstaba.push('vínculo con el hub');
    } else {
      await db
        .insertInto('organizaciones_credenciales')
        .values({ org_id: org.id, fundaciones_cliente_id: cliente.id })
        .onConflict((oc) =>
          oc.column('org_id').doUpdateSet({ fundaciones_cliente_id: cliente.id }),
        )
        .execute();
      hecho.push(`vínculo con el hub (${cliente.id})`);
    }
  });

  return { correo, slug, nombre, hecho, yaEstaba };
}

// ── El recorrido ─────────────────────────────────────────────────────────────

const { aptos: todasLasAptas, descartados, total } = await clientesDelHub();

// El filtro se aplica DESPUÉS de leer, para poder avisar si un correo pedido no existe. Pedir un
// alta para un correo mal tipeado tiene que fallar ruidosamente, no crear catorce y omitir una.
const aptos = SOLO ? todasLasAptas.filter((c) => SOLO.has(c.email.trim().toLowerCase())) : todasLasAptas;

if (SOLO) {
  const encontrados = new Set(aptos.map((c) => c.email.trim().toLowerCase()));
  const ausentes = [...SOLO].filter((c) => !encontrados.has(c));
  if (ausentes.length > 0) {
    console.error(`\nEstos correos de --solo no están entre las cuentas aptas del hub:`);
    for (const a of ausentes) console.error(`  · ${a}`);
    console.error('Revisá si están mal escritos, inactivos, o sin contraseña.');
    await cerrarClientes();
    process.exit(1);
  }
}

if (APLICAR && !SOLO) {
  console.error('\n--aplicar necesita --solo: aplicar sobre TODAS las cuentas del hub crearía');
  console.error('organizaciones para las cuentas de prueba y para la gente de ARIA. Corré sin');
  console.error('--aplicar para ver la lista, elegí, y pasá los correos en --solo.');
  await cerrarClientes();
  process.exit(1);
}

console.log(`\nCuentas en el hub: ${total} · aptas: ${todasLasAptas.length} · descartadas: ${descartados.length}`);
if (SOLO) console.log(`Filtradas por --solo: ${aptos.length}`);

if (descartados.length > 0) {
  console.log('\nDescartadas, con el motivo:');
  for (const d of descartados) console.log(`  · ${d.email} — ${d.motivo}`);
}

console.log(`\nAltas ${APLICAR ? 'A APLICAR' : '(SOLO PLAN, no se escribe nada)'}:`);
for (const c of aptos) {
  console.log(`  · ${c.email}`);
  console.log(`      organización: «${nombreProvisional(c)}»   slug: ${slugDesdeCorreo(c.email)}`);
  console.log(`      alumno del hub: ${c.id}`);
}

if (!APLICAR) {
  console.log('\nNada se escribió. Para aplicarlo: agregá --aplicar');
  await cerrarClientes();
  process.exit(0);
}

console.log('\nAplicando…');
const fallos = [];
for (const c of aptos) {
  try {
    const r = await alta(c);
    const creado = r.hecho.length > 0 ? `creó ${r.hecho.join(', ')}` : 'nada nuevo';
    const previo = r.yaEstaba.length > 0 ? ` · ya estaba: ${r.yaEstaba.join(', ')}` : '';
    console.log(`  ✓ ${r.correo} — ${creado}${previo}`);
  } catch (e) {
    // Un fallo NO corta el recorrido: con diez cuentas, que una mal cargada impida las otras nueve
    // es peor que seguir y reportar. Se listan al final para que ninguna quede tapada por el ruido.
    fallos.push({ correo: c.email, error: e instanceof Error ? e.message : String(e) });
    console.log(`  ✗ ${c.email} — ${e instanceof Error ? e.message : String(e)}`);
  }
}

await cerrarClientes();

if (fallos.length > 0) {
  console.error(`\n${fallos.length} de ${aptos.length} fallaron:`);
  for (const f of fallos) console.error(`  · ${f.correo}: ${f.error}`);
  // Sale con 1: un alta a medias tiene que romper la integración o el despliegue que la invocó.
  process.exit(1);
}

console.log(`\n${aptos.length} de ${aptos.length} listos.`);
console.log('Cada uno entra con la contraseña que ya usa en el hub, y la pantalla le va a pedir');
console.log('una nueva antes de dejarlo pasar. Después: nombre de su empresa y su clave de');
console.log('Anthropic en Ajustes.');
