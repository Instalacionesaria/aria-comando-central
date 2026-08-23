// La organización principal. **Script contra la base, y solo la primera vez.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO NO ESTÁ EN NINGUNA MIGRACIÓN NI EN EL ARRANQUE
//
// `scripts/arranque.mjs` la EXIGE y no la crea, con un motivo escrito: *"decidir cuál es la
// principal es una decisión de despliegue y no de un argumento de línea de comandos"*. Y una
// migración no puede insertarla: el encabezado de `db/sembrado/organizaciones.ts` enumera la
// cadena completa de por qué —`migrador` no tiene política sobre `identidad.organizaciones`,
// darle una está prohibida por `EJECUCION` § 3, y quitar el forzado a mitad de una migración
// está explícitamente descartado.
//
// Y el sembrado, que sí sabe crearla, **se niega a correr contra un anfitrión remoto**: escribe
// usuarios con una contraseña de desarrollo conocida.
//
// Así que quedaba un hueco entre "las migraciones corrieron" y "el arranque puede correr", y
// este archivo es ese paso. Es la sexta opción del encabezado del sembrado: un programa aparte
// que escribe por `conIdentidad()`.
//
//   node --env-file=.env.supabase scripts/organizacion-principal.mjs "ARIA" aria
//
// ── SE NIEGA A CORRER DOS VECES ──────────────────────────────────────────────
//
// Hay UNA organización principal y lo hace cumplir un índice único de la migración 002. Si ya
// existe, este guion lo dice y sale con código 1 en vez de tropezarse con la restricción: un
// mensaje que explica es mejor que un `23505`.
// ═══════════════════════════════════════════════════════════════════════════════

import { conIdentidad, cerrarClientes } from '../lib/datos/capa.ts';

const [nombre, slug, zona] = process.argv.slice(2);

if (!nombre || !slug) {
  console.error(
    'uso: node --env-file=.env.supabase scripts/organizacion-principal.mjs "Nombre" slug [zona_horaria]',
  );
  process.exit(2);
}

// El slug viaja a URLs y se compara en consultas. Se valida acá y no se "corrige" en silencio:
// un slug distinto del que alguien escribió es una organización que no encuentra.
if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
  console.error(`el slug "${slug}" tiene que ser minúsculas, dígitos y guiones, sin empezar ni terminar con guion.`);
  process.exit(2);
}

try {
  const resultado = await conIdentidad(async (db) => {
    const yaHay = await db
      .selectFrom('organizaciones')
      .select(['slug', 'nombre'])
      .where('es_principal', '=', true)
      .executeTakeFirst();
    if (yaHay) return { creada: false, motivo: `ya existe la principal: "${yaHay.nombre}" (${yaHay.slug})` };

    const mismoSlug = await db
      .selectFrom('organizaciones')
      .select('slug')
      .where('slug', '=', slug)
      .executeTakeFirst();
    if (mismoSlug) return { creada: false, motivo: `ya existe una organización con el slug "${slug}"` };

    const o = await db
      .insertInto('organizaciones')
      .values({
        nombre,
        slug,
        es_principal: true,
        // La zona horaria NO se deja por omisión sin decirlo: si el producto tiene la noción de
        // "hoy", esa frontera la calcula la base con la zona de la organización. Con todo en UTC,
        // los defectos de frontera de día no aparecen hasta que alguien compara totales.
        ...(zona ? { zona_horaria: zona } : {}),
      })
      .returning(['id', 'slug', 'zona_horaria'])
      .executeTakeFirstOrThrow();
    return { creada: true, ...o };
  });

  if (!resultado.creada) {
    console.error(`organizacion-principal: ${resultado.motivo}`);
    process.exit(1);
  }

  console.log(`organización principal creada: "${nombre}" (${resultado.slug})`);
  console.log(`  id:            ${resultado.id}`);
  console.log(`  zona horaria:  ${resultado.zona_horaria}`);
  console.log('');
  console.log('Ahora el primer administrador:');
  console.log('  node --env-file=.env.supabase scripts/arranque.mjs "Tu Nombre" tu@correo');
} finally {
  await cerrarClientes();
}
