// LA PANTALLA DEL TÉCNICO, contra la base. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA ASIMETRÍA QUE ESTE ARCHIVO DEFIENDE, Y QUE EL PRODUCTO YA PAGÓ UNA VEZ
//
// **Los contadores cuentan auditables; la lista muestra todo.** Son dos filtros distintos sobre la
// misma tabla, y cada uno tiene su motivo:
//
//   · Meter las no auditables en los contadores haría que el porcentaje de verdes bajara cada vez que
//     entra una conversación de dos mensajes — y el técnico leería *«el agente empeoró»* sobre un
//     agente que no cambió.
//   · Sacarlas de la lista haría que *«no se auditó»* y *«no existe»* volvieran a verse iguales, que
//     es el defecto que este módulo entero viene arreglando en otras cuatro formas.
//
// Y el otro defecto que solo se ve contra la base: **contar sobre un `join`**. Un análisis con dos
// hallazgos contaría dos veces en las cinco cuentas, no falla, y devuelve números plausibles.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { limpiar, montar, unContacto, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { laPantallaDelTecnico, TOPE_DE_CONVERSACIONES } from '../../lib/auditor/pantalla.ts';
import { guardarPromptDelAgente } from '../../lib/auditor/prompts.ts';
import { AGENTES } from '../../lib/auditor/veredicto.ts';
import { agruparPorPatron } from '../../lib/auditor/vista.ts';

let esc: Escenario;

before(async () => {
  esc = await montar('Pantalla');
});
after(async () => {
  await limpio();
  await esc.admin.query('delete from negocio.prompts_del_agente');
  await cerrarTodo();
  await cerrarClientes();
});

async function limpio(): Promise<void> {
  const marca = `${esc.marca.toLowerCase()}-%`;
  const dentro = `select id from negocio.contactos where ghl_contact_id like $1`;
  await esc.admin.query(`delete from negocio.hallazgos where contacto_id in (${dentro})`, [marca]);
  await esc.admin.query(
    `delete from negocio.analisis_del_agente where contacto_id in (${dentro})`,
    [marca],
  );
  await esc.admin.query('delete from negocio.prompts_del_agente');
  await limpiar(esc);
}

/** Un análisis, con lo que no está bajo prueba puesto por omisión. */
async function unAnalisis(o: {
  agente?: string;
  auditable?: boolean;
  nivel?: string | null;
  intervencion?: boolean;
  resueltoEl?: Date | null;
  analizadoEl?: Date;
  nombre?: string;
} = {}): Promise<{ analisisId: string; contactoId: string }> {
  const k = await unContacto(esc, {
    territorio: 'closer',
    nombre: o.nombre ?? `${esc.marca} contacto`,
  });
  const auditable = o.auditable !== false;
  const { rows } = await esc.admin.query<{ id: string }>(
    `insert into negocio.analisis_del_agente
       (org_id, contacto_id, agente, auditable, no_auditable_motivo, intervencion, motivo, nivel,
        resumen, disparo, mensajes_del_agente, resuelto_el, analizado_el)
     values ($1, $2, $3, $4, $5, $6, $7, $8, 'Un resumen.', 'debounce', 6, $9, $10)
     returning id`,
    [
      esc.org,
      k.id,
      o.agente ?? 'chat_post_agenda',
      auditable,
      auditable ? null : 'No hay ninguna línea del agente.',
      o.intervencion === true,
      o.intervencion === true ? 'Una frase concreta.' : null,
      auditable ? (o.nivel ?? 'verde') : null,
      o.resueltoEl ?? null,
      o.analizadoEl ?? new Date(),
    ],
  );
  return { analisisId: rows[0]!.id, contactoId: k.id };
}

/** Un hallazgo colgado de un análisis. */
async function unHallazgo(
  analisisId: string,
  contactoId: string,
  o: { patron?: string; severidad?: string; agente?: string; promptHash?: string | null; titulo?: string } = {},
): Promise<void> {
  await esc.admin.query(
    `insert into negocio.hallazgos
       (org_id, contacto_id, analisis_id, agente, titulo, patron, correccion, evidencia_agente,
        severidad, diagnostico, prompt_hash)
     values ($1, $2, $3, $4, $5, $6, 'Agregar la sección de precios.', 'Una línea del agente.',
             $7, 'Un diagnóstico.', $8)`,
    [
      esc.org,
      contactoId,
      analisisId,
      o.agente ?? 'chat_post_agenda',
      o.titulo ?? 'Promete descuentos',
      o.patron ?? 'promete_descuento',
      o.severidad ?? 'amarillo',
      o.promptHash ?? null,
    ],
  );
}

const pantalla = () => conOrganizacion(esc.org, () => laPantallaDelTecnico(null));

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · LAS TARJETAS
// ═══════════════════════════════════════════════════════════════════════════════

test('hay UNA tarjeta por agente, y salen de `AGENTES`', async () => {
  await limpio();
  /* Dos y no cuatro: los de voz están fuera de alcance por medición. Y salen de la lista y no de un
     número escrito acá — es el defecto `4.1` del origen, *«la causa es una lista escrita a mano»*,
     que declaraba a dos auditores como «sin auditor» cuando ya lo tenían. */
  const p = await pantalla();
  assert.deepEqual(
    p.tarjetas.map((t) => t.agente).sort(),
    [...AGENTES].sort(),
  );
});

test('sin análisis, la tarjeta va en CERO y la pantalla lo puede dibujar como «sin datos»', async () => {
  await limpio();
  /* El estado 2. Lo que la pantalla NO puede hacer es mostrar `0 %` o un tilde verde: un cero medido y
     un cero por falta de datos se ven iguales en un número, y el segundo hace tomar decisiones sobre
     nada. Acá se afirma el dato —`analizadas: 0`— que es lo que le permite al componente distinguirlo. */
  const p = await pantalla();
  for (const t of p.tarjetas) {
    assert.equal(t.analizadas, 0);
    assert.equal(t.auditables, 0);
    assert.equal(t.ultimoEl, null, '`null` es lo que distingue «nunca» de «hace mucho»');
    assert.equal(t.tienePrompt, false);
  }
});

test('LOS CONTADORES cuentan auditables; la LISTA muestra todo', async () => {
  await limpio();
  /* ══════════════════════════════════════════════════════════════════════════
     LA ASIMETRÍA, MEDIDA

     Tres análisis: dos auditables (un verde y un amarillo) y uno no auditable. Los contadores tienen
     que decir 2; la lista tiene que traer los 3.

     Con un solo filtro para los dos, una de las dos cosas se rompe — y las dos se rompen en silencio.
     ══════════════════════════════════════════════════════════════════════════ */
  await unAnalisis({ nivel: 'verde' });
  await unAnalisis({ nivel: 'amarillo' });
  await unAnalisis({ auditable: false });

  const p = await pantalla();
  const t = p.tarjetas.find((x) => x.agente === 'chat_post_agenda')!;

  assert.equal(t.analizadas, 3, 'las miradas son tres');
  assert.equal(t.auditables, 2, 'las juzgables son dos');
  assert.equal(t.verdes, 1);
  assert.equal(t.amarillos, 1);
  assert.equal(t.rojos, 0);

  assert.equal(p.conversaciones.length, 3, 'la lista INCLUYE la no auditable');
  const noAuditable = p.conversaciones.find((c) => !c.auditable);
  assert.ok(noAuditable, 'la no auditable tiene que estar en la lista');
  assert.equal(noAuditable.nivel, null, 'sin auditar no hay veredicto');
  assert.match(String(noAuditable.noAuditableMotivo), /línea del agente/);
});

test('un análisis con DOS hallazgos no se cuenta dos veces', async () => {
  await limpio();
  /* ── EL DEFECTO QUE SOLO SE VE CONTRA LA BASE ──────────────────────────────
   *
   * Con los hallazgos traídos por un `join`, cada análisis con dos hallazgos cuenta dos veces en las
   * cinco cuentas. Es el error clásico de sumar sobre un producto cartesiano: **no falla y devuelve
   * números plausibles**, así que la tarjeta diría «4 conversaciones miradas» habiendo tres. */
  const a = await unAnalisis({ nivel: 'amarillo' });
  await unHallazgo(a.analisisId, a.contactoId, { patron: 'uno' });
  await unHallazgo(a.analisisId, a.contactoId, { patron: 'otro' });

  const p = await pantalla();
  const t = p.tarjetas.find((x) => x.agente === 'chat_post_agenda')!;
  assert.equal(t.analizadas, 1);
  assert.equal(t.amarillos, 1);
  assert.equal(t.hallazgosAbiertos, 2, 'los hallazgos sí son dos');
});

test('las intervenciones abiertas no cuentan las RESUELTAS', async () => {
  await limpio();
  /* Es el número que le dice al técnico cuántas conversaciones tiene un vendedor en su cola AHORA.
     Contando las resueltas, ese número solo sube — y un número que solo sube deja de mirarse. */
  await unAnalisis({ nivel: 'rojo', intervencion: true });
  await unAnalisis({ nivel: 'rojo', intervencion: true, resueltoEl: new Date() });

  const p = await pantalla();
  const t = p.tarjetas.find((x) => x.agente === 'chat_post_agenda')!;
  assert.equal(t.rojos, 2, 'los dos son rojos');
  assert.equal(t.intervencionesAbiertas, 1, 'pero solo uno sigue abierto');
});

test('las cuentas son POR AGENTE, no de la empresa', async () => {
  await limpio();
  /* Sin agrupar, las dos tarjetas mostrarían el mismo total y el técnico no podría saber cuál de los
     dos agentes falla — que es la única pregunta para la que la pantalla existe. */
  await unAnalisis({ agente: 'chat_post_agenda', nivel: 'verde' });
  await unAnalisis({ agente: 'chat_pre_agenda', nivel: 'rojo', intervencion: true });

  const p = await pantalla();
  const post = p.tarjetas.find((x) => x.agente === 'chat_post_agenda')!;
  const pre = p.tarjetas.find((x) => x.agente === 'chat_pre_agenda')!;
  assert.equal(post.verdes, 1);
  assert.equal(post.rojos, 0);
  assert.equal(pre.rojos, 1);
  assert.equal(pre.verdes, 0);
});

test('la tarjeta dice si ese agente tiene prompt cargado', async () => {
  await limpio();
  /* La ausencia es un estado normal —los cuatro espacios del origen estaban vacíos— pero tiene que
     verse: sin prompt, las correcciones salen como instrucciones para agregar en vez de reemplazos
     citados, y eso explica por qué la pantalla se ve distinta. */
  await conOrganizacion(esc.org, () =>
    guardarPromptDelAgente('chat_post_agenda', 'Un prompt cargado.', null),
  );
  const p = await pantalla();
  assert.equal(p.tarjetas.find((x) => x.agente === 'chat_post_agenda')?.tienePrompt, true);
  assert.equal(p.tarjetas.find((x) => x.agente === 'chat_pre_agenda')?.tienePrompt, false);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · LOS PATRONES
// ═══════════════════════════════════════════════════════════════════════════════

test('los casos traen el texto del hallazgo MÁS RECIENTE de su patrón', async () => {
  await limpio();
  /* ── EL SERVIDOR ELIGE QUÉ TEXTO GANA ──────────────────────────────────────
   *
   * El diagnóstico y la corrección son DEL PATRÓN, no del caso, y quince casos traen quince
   * redacciones de lo mismo. Dejar que el cliente elija serían quince criterios; tomar el primero que
   * devuelva el planificador sería ninguno. */
  const viejo = await unAnalisis({ nivel: 'amarillo', analizadoEl: new Date(Date.now() - 86_400_000) });
  const nuevo = await unAnalisis({ nivel: 'amarillo' });
  await esc.admin.query(
    `insert into negocio.hallazgos
       (org_id, contacto_id, analisis_id, agente, titulo, patron, correccion, evidencia_agente,
        diagnostico, detectado_el)
     values ($1, $2, $3, 'chat_post_agenda', 'Viejo', 'mismo_patron', 'LA CORRECCIÓN VIEJA',
             'Una línea.', 'El diagnóstico viejo.', now() - interval '2 days')`,
    [esc.org, viejo.contactoId, viejo.analisisId],
  );
  await esc.admin.query(
    `insert into negocio.hallazgos
       (org_id, contacto_id, analisis_id, agente, titulo, patron, correccion, evidencia_agente,
        diagnostico, detectado_el)
     values ($1, $2, $3, 'chat_post_agenda', 'Nuevo', 'mismo_patron', 'LA CORRECCIÓN NUEVA',
             'Otra línea.', 'El diagnóstico nuevo.', now())`,
    [esc.org, nuevo.contactoId, nuevo.analisisId],
  );

  /* ── Y UN SEGUNDO PATRÓN, QUE ES LO QUE MIDE LA PARTICIÓN ─────────────────
   *
   * Con un solo patrón, una ventana **sin** `partition by` da exactamente el mismo resultado que una
   * con él: hay una sola partición. O sea que la prueba pasaría igual con la partición borrada.
   *
   * Y borrarla es el defecto más caro de esta pantalla: **todos los patrones mostrarían la corrección
   * del hallazgo más reciente de la empresa**, sea del patrón que sea. Quince patrones distintos con
   * el mismo texto de arreglo, cada uno perfectamente plausible. */
  const otro = await unAnalisis({ nivel: 'amarillo', nombre: `${esc.marca} otro patrón` });
  await esc.admin.query(
    `insert into negocio.hallazgos
       (org_id, contacto_id, analisis_id, agente, titulo, patron, correccion, evidencia_agente,
        diagnostico, detectado_el)
     values ($1, $2, $3, 'chat_post_agenda', 'Otro', 'otro_patron', 'LA CORRECCIÓN DEL OTRO',
             'Otra línea más.', 'El diagnóstico del otro.', now() - interval '1 day')`,
    [esc.org, otro.contactoId, otro.analisisId],
  );

  const p = await pantalla();
  const delMismo = p.casos.filter((c) => c.patron === 'mismo_patron');
  assert.equal(delMismo.length, 2, 'son dos CASOS del mismo patrón');
  // Los dos del mismo patrón llevan el texto del más reciente DE SU PATRÓN.
  for (const c of delMismo) {
    assert.equal(c.correccion, 'LA CORRECCIÓN NUEVA');
    assert.equal(c.diagnostico, 'El diagnóstico nuevo.');
  }
  // Y el otro patrón conserva EL SUYO, aunque sea más viejo que el de arriba.
  const delOtro = p.casos.find((c) => c.patron === 'otro_patron');
  assert.equal(delOtro?.correccion, 'LA CORRECCIÓN DEL OTRO');
  assert.equal(delOtro?.diagnostico, 'El diagnóstico del otro.');
});

test('EL CONTADOR de casos es la longitud de la lista, no un número aparte', async () => {
  await limpio();
  /* Con un contador calculado en el servidor y la lista traída aparte, un tope o un filtro de más
     harían que la pantalla dijera «×15 casos» mostrando tres. Agrupando en el cliente, el número **no
     puede** dejar de coincidir con lo que se ve. */
  for (let i = 0; i < 4; i++) {
    const a = await unAnalisis({ nivel: 'amarillo', nombre: `${esc.marca} caso ${i}` });
    await unHallazgo(a.analisisId, a.contactoId, { patron: 'el_mismo' });
  }
  const solo = await unAnalisis({ nivel: 'amarillo', nombre: `${esc.marca} solo` });
  await unHallazgo(solo.analisisId, solo.contactoId, { patron: 'otro_distinto' });

  const p = await pantalla();
  const patrones = agruparPorPatron(p.casos);

  // El de más casos primero: es lo que hace que agrupar sirva de algo.
  assert.equal(patrones[0]?.patron, 'el_mismo');
  assert.equal(patrones[0]?.casos.length, 4);
  assert.equal(patrones[1]?.patron, 'otro_distinto');
  assert.equal(patrones[1]?.casos.length, 1);
});

test('un patrón con UN caso rojo es un patrón ROJO', async () => {
  await limpio();
  /* La severidad del patrón es la más grave de sus casos, no la del primero. Lo que decide si el
     técnico lo mira hoy es el peor caso, no el más común. */
  /* ── EL ROJO TIENE QUE LLEGAR SEGUNDO, O LA PRUEBA NO MIDE NADA ───────────
   *
   * Los casos llegan ordenados por fecha descendente, así que el rojo se siembra **más viejo**: así
   * el amarillo entra primero al agrupador y el rojo tiene que ELEVAR la severidad.
   *
   * Con el rojo primero, el patrón nace rojo y la línea que lo eleva se puede borrar sin que nada
   * falle — que es exactamente lo que una mutación demostró. */
  const rojoViejo = await unAnalisis({ nivel: 'amarillo', nombre: `${esc.marca} rojo viejo` });
  await esc.admin.query(
    `insert into negocio.hallazgos
       (org_id, contacto_id, analisis_id, agente, titulo, patron, correccion, evidencia_agente,
        severidad, detectado_el)
     values ($1, $2, $3, 'chat_post_agenda', 'El rojo', 'mixto', 'Corregir.', 'Una línea.',
             'rojo', now() - interval '2 days')`,
    [esc.org, rojoViejo.contactoId, rojoViejo.analisisId],
  );
  const amarilloNuevo = await unAnalisis({
    nivel: 'amarillo',
    nombre: `${esc.marca} amarillo nuevo`,
  });
  await unHallazgo(amarilloNuevo.analisisId, amarilloNuevo.contactoId, {
    patron: 'mixto',
    severidad: 'amarillo',
  });

  const p = await pantalla();
  const patrones = agruparPorPatron(p.casos);
  assert.equal(patrones.length, 1, 'los dos casos son del mismo patrón');
  assert.equal(patrones[0]?.casos[0]?.severidad, 'amarillo', 'el primero es el amarillo');
  assert.equal(patrones[0]?.severidad, 'rojo', 'la severidad del patrón es la del PEOR caso');
});

test('los hallazgos RESUELTOS no aparecen en los casos', async () => {
  await limpio();
  /* La pantalla del técnico es la lista de lo que hay que corregir. Un hallazgo resuelto ya no lo es,
     y dejarlo hace que la lista solo crezca — y una lista que solo crece deja de mirarse. */
  const a = await unAnalisis({ nivel: 'amarillo' });
  await unHallazgo(a.analisisId, a.contactoId, { patron: 'ya_resuelto' });
  await esc.admin.query('update negocio.hallazgos set resuelto_el = now() where contacto_id = $1', [
    a.contactoId,
  ]);

  const p = await pantalla();
  assert.equal(p.casos.length, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · EL AVISO DE QUE EL PROMPT CAMBIÓ
// ═══════════════════════════════════════════════════════════════════════════════

test('avisa cuando el prompt CAMBIÓ desde que se diagnosticó', async () => {
  await limpio();
  /* Sin este aviso, el técnico pega un reemplazo cuyo fragmento original ya no existe, no encuentra
     qué reemplazar, y desconfía de la pantalla entera. */
  await conOrganizacion(esc.org, () =>
    guardarPromptDelAgente('chat_post_agenda', 'El prompt de HOY.', null),
  );
  const a = await unAnalisis({ nivel: 'amarillo' });
  await unHallazgo(a.analisisId, a.contactoId, { promptHash: 'unhashviejo000' });

  const p = await pantalla();
  assert.equal(p.casos[0]?.elPromptCambio, true);
});

test('NO avisa cuando el hash coincide, ni cuando no hay con qué comparar', async () => {
  await limpio();
  /* ── LOS DOS CASOS QUE NO SON UN CAMBIO ────────────────────────────────────
   *
   * Sin hash, el auditor no vio ningún prompt. Sin prompt hoy, no hay algo que haya cambiado — hay
   * algo que no está, y eso ya lo dice la tarjeta. Avisar en los dos sería un aviso que aparece
   * siempre, y un aviso que aparece siempre se ignora. */
  const texto = 'El prompt de HOY.';
  await conOrganizacion(esc.org, () =>
    guardarPromptDelAgente('chat_post_agenda', texto, null),
  );
  const { hashDelPrompt } = await import('../../lib/auditor/prompts.ts');

  const igual = await unAnalisis({ nivel: 'amarillo', nombre: `${esc.marca} igual` });
  await unHallazgo(igual.analisisId, igual.contactoId, {
    patron: 'con_hash_igual',
    promptHash: hashDelPrompt(texto),
  });
  const sinHash = await unAnalisis({ nivel: 'amarillo', nombre: `${esc.marca} sin hash` });
  await unHallazgo(sinHash.analisisId, sinHash.contactoId, {
    patron: 'sin_hash',
    promptHash: null,
  });

  const p = await pantalla();
  const porPatron = new Map(p.casos.map((c) => [c.patron, c]));
  assert.equal(porPatron.get('con_hash_igual')?.elPromptCambio, false);
  assert.equal(porPatron.get('sin_hash')?.elPromptCambio, false);

  // Y sin prompt cargado tampoco avisa, aunque el hallazgo tenga hash.
  await esc.admin.query('delete from negocio.prompts_del_agente');
  const sinPrompt = await pantalla();
  for (const c of sinPrompt.casos) assert.equal(c.elPromptCambio, false);
});

test('los hallazgos ABIERTOS de la tarjeta no cuentan los resueltos', async () => {
  await limpio();
  /* Es el número que le dice al técnico cuánto le queda por corregir. Contando los resueltos solo
     sube, y un número que solo sube deja de mirarse — la misma razón por la que las intervenciones
     abiertas tampoco los cuentan. */
  const a = await unAnalisis({ nivel: 'amarillo' });
  await unHallazgo(a.analisisId, a.contactoId, { patron: 'sigue_abierto' });
  const b = await unAnalisis({ nivel: 'amarillo', nombre: `${esc.marca} resuelto` });
  await unHallazgo(b.analisisId, b.contactoId, { patron: 'ya_cerrado' });
  await esc.admin.query(
    'update negocio.hallazgos set resuelto_el = now() where contacto_id = $1',
    [b.contactoId],
  );

  const p = await pantalla();
  assert.equal(
    p.tarjetas.find((t) => t.agente === 'chat_post_agenda')?.hallazgosAbiertos,
    1,
    'contó también el resuelto',
  );
});

test('el hash de hoy se RECALCULA del texto, no se lee de la columna', async () => {
  await limpio();
  /* ── EL MISMO DEFECTO QUE `prompts.ts` YA CIERRA, EN SU SEGUNDO LECTOR ─────
   *
   * `prompts_del_agente.prompt_hash` dice qué hash TENÍA al guardarse. Leyéndolo acá, cualquier
   * escritura futura que se olvide de actualizarla dejaría el aviso de «el prompt cambió» apagado
   * **para siempre**: la comparación daría igual contra un hash congelado.
   *
   * Se pisa la columna a mano, imitando exactamente eso, y el aviso tiene que salir igual. */
  await conOrganizacion(esc.org, () =>
    guardarPromptDelAgente('chat_post_agenda', 'El prompt de HOY.', null),
  );
  const a = await unAnalisis({ nivel: 'amarillo' });
  await unHallazgo(a.analisisId, a.contactoId, { promptHash: 'unhashviejo000' });
  await esc.admin.query(
    `update negocio.prompts_del_agente set prompt_hash = 'unhashviejo000'
      where agente = 'chat_post_agenda'`,
  );

  const p = await pantalla();
  assert.equal(
    p.casos[0]?.elPromptCambio,
    true,
    'leyó la columna: el aviso se apagó porque los dos hashes coinciden ahí',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · LA LISTA Y SU TOPE
// ═══════════════════════════════════════════════════════════════════════════════

test('la lista viene de la MÁS RECIENTE a la más vieja', async () => {
  await limpio();
  const vieja = await unAnalisis({
    nombre: `${esc.marca} vieja`,
    analizadoEl: new Date(Date.now() - 86_400_000),
  });
  const nueva = await unAnalisis({ nombre: `${esc.marca} nueva` });

  const p = await pantalla();
  assert.equal(p.conversaciones[0]?.analisisId, nueva.analisisId);
  assert.equal(p.conversaciones[1]?.analisisId, vieja.analisisId);
});

test('el tope corta y LO DICE', async () => {
  await limpio();
  /* Un tope silencioso hace que «50» se lea como «había 50». Se siembra uno más que el tope para que
     el corte ocurra de verdad. */
  for (let i = 0; i < TOPE_DE_CONVERSACIONES + 1; i++) {
    await unAnalisis({ nombre: `${esc.marca} n${i}` });
  }
  const p = await pantalla();
  assert.equal(p.conversaciones.length, TOPE_DE_CONVERSACIONES);
  assert.equal(p.hayMas, true);
});

test('ADR-0206 · la pantalla de una empresa no se ve desde la otra', async () => {
  await limpio();
  await unAnalisis({ nivel: 'rojo', intervencion: true });
  const desdeLaOtra = await conOrganizacion(esc.otraOrg, () => laPantallaDelTecnico(null));
  assert.equal(desdeLaOtra.conversaciones.length, 0);
  assert.equal(desdeLaOtra.casos.length, 0);
  for (const t of desdeLaOtra.tarjetas) assert.equal(t.analizadas, 0);
});

test('el freno de la empresa viaja, y NO vacía la pantalla', async () => {
  await limpio();
  /* Si la empresa auditó antes y alguien apagó el interruptor, los análisis siguen ahí y el técnico
     tiene que poder verlos. Devolver la pantalla vacía con el motivo arriba borraría el historial de
     la vista justo cuando alguien está averiguando qué pasó. */
  await unAnalisis({ nivel: 'verde' });
  const p = await conOrganizacion(esc.org, () => laPantallaDelTecnico('auditor_apagado'));
  assert.equal(p.noAudita, 'auditor_apagado');
  assert.equal(p.conversaciones.length, 1, 'el historial se sigue viendo');
  assert.equal(p.tarjetas.find((t) => t.agente === 'chat_post_agenda')?.verdes, 1);
});
