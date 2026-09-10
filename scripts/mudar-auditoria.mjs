// Mueve el alcance `auditoria` a `conversation`. **Script contra la base, y una sola vez.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO NO ES UNA MIGRACIÓN
//
// La sección «Auditoría de agentes» se retiró: su pantalla pasó a ser dos pestañas de
// `conversation`. La migración `041` saca `'auditoria'` del `check` de
// `identidad.usuarios_secciones`, y **ahí está el problema**: si alguien tiene la sección
// concedida, esa fila viola el `check` nuevo y el `alter` falla.
//
// Mover las filas desde la migración es imposible, y no por comodidad: `identidad.*` tiene
// `force row level security` sin política para `migrador`, así que un `update` desde una
// migración **ve cero filas, informa éxito y no toca nada**. Es la misma regla que la `040` dejó
// escrita — una migración puede cambiar la FORMA de una tabla, nunca su contenido — y es el
// motivo por el que `scripts/organizacion-principal.mjs` existe con el mismo argumento.
//
// Así que esto escribe por `conIdentidad()`, que es el rol que sí ve sus filas.
//
//   node --env-file=.env.supabase scripts/mudar-auditoria.mjs --seco
//   node --env-file=.env.supabase scripts/mudar-auditoria.mjs
//
// ── EL ORDEN IMPORTA, Y ES LO ÚNICO QUE HAY QUE RECORDAR ────────────────────
//
// **Esto corre ANTES de desplegar el código y la migración**, no después. Medido en producción al
// escribirlo: cuatro personas tenían `auditoria` y una de ellas —`mruiz@ariaia.com`— **no** tenía
// `conversation`. Si el código se despliega primero, el panel de Usuarios deja de ofrecer
// «Auditoría de agentes», esas cuatro filas se vuelven invisibles desde la interfaz, y esa persona
// se queda sin la pantalla sin que nada falle.
//
// ── QUÉ HACE, EN DOS PASOS Y EN UNA TRANSACCIÓN ─────────────────────────────
//
//   1 · a quien tenga `auditoria` y NO tenga `conversation`, se le concede `conversation`;
//   2 · se borran las filas de `auditoria`.
//
// El orden es ése y no el inverso: al revés, entre el borrado y la concesión hay un instante en
// que esa persona no tiene ninguna de las dos. Con una transacción no se ve desde afuera, pero
// escribirlo al derecho es lo que hace que siga siendo correcto el día que alguien lo parta.
//
// Es idempotente: corrido dos veces, la segunda no encuentra filas y lo dice.
// ═══════════════════════════════════════════════════════════════════════════════

import { conIdentidad, cerrarClientes } from '../lib/datos/capa.ts';
import { sql } from 'kysely';

const SECO = process.argv.includes('--seco');

async function main() {
  const resumen = await conIdentidad(async (db) => {
    /* Quién tiene la sección que se retira, y si ya tiene la que la reemplaza. Se lee ANTES de
       tocar nada para poder imprimirlo: un script que solo dice «listo» no deja comprobar qué
       hizo. */
    const afectados = await db
      .selectFrom('usuarios_secciones as s')
      .innerJoin('usuarios as u', 'u.id', 's.usuario_id')
      .where('s.seccion', '=', 'auditoria')
      .select((eb) => [
        'u.email',
        's.usuario_id',
        eb
          .exists(
            eb
              .selectFrom('usuarios_secciones as c')
              .whereRef('c.usuario_id', '=', 's.usuario_id')
              .where('c.seccion', '=', 'conversation')
              .select(sql`1`.as('x')),
          )
          .as('ya_tiene_conversation'),
      ])
      .orderBy('u.email')
      .execute();

    if (afectados.length === 0) return { afectados, concedidas: 0, borradas: 0 };
    if (SECO) return { afectados, concedidas: null, borradas: null };

    /* 1 · La concesión, solo a quien le falta. `on conflict do nothing` en vez de comprobar antes:
       entre la lectura de arriba y esta escritura puede haber pasado cualquier cosa. */
    const concedidas = await db
      .insertInto('usuarios_secciones')
      .columns(['usuario_id', 'seccion'])
      .expression(
        db
          .selectFrom('usuarios_secciones as s')
          .where('s.seccion', '=', 'auditoria')
          .select(['s.usuario_id', sql.lit('conversation').as('seccion')]),
      )
      .onConflict((oc) => oc.columns(['usuario_id', 'seccion']).doNothing())
      .executeTakeFirst();

    // 2 · Y recién ahora se retira la vieja.
    const borradas = await db
      .deleteFrom('usuarios_secciones')
      .where('seccion', '=', 'auditoria')
      .executeTakeFirst();

    return {
      afectados,
      concedidas: Number(concedidas.numInsertedOrUpdatedRows ?? 0),
      borradas: Number(borradas.numDeletedRows ?? 0),
    };
  });

  if (resumen.afectados.length === 0) {
    console.log('No hay ninguna persona con la sección `auditoria` concedida. Nada que mudar.');
    return;
  }

  console.log(`Personas con \`auditoria\` concedida: ${resumen.afectados.length}`);
  for (const a of resumen.afectados) {
    const nota = a.ya_tiene_conversation ? 'ya tenía conversation' : '**se le concede conversation**';
    console.log(`  · ${a.email} — ${nota}`);
  }

  if (SECO) {
    console.log('\nCorrida en SECO: no se escribió nada. Volvé a correrlo sin `--seco` para aplicar.');
    return;
  }
  console.log(`\nconversation concedidas: ${resumen.concedidas}`);
  console.log(`auditoria retiradas:     ${resumen.borradas}`);
  console.log('\nListo. Ahora sí se pueden desplegar el código y la migración 041.');
}

try {
  await main();
} finally {
  await cerrarClientes();
}
