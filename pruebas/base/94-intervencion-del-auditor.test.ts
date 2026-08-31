// MARCAR y RESOLVER una intervención, contra la base. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL CIERRE DE LA ETAPA
//
// **Resolver saca al contacto de las dos colas, deja el rastro, y reporta «se hizo» separado de
// «salió bien».**
//
// La última mitad es la que más se equivoca: una resolución que cerró el aviso y **no pudo quitar la
// etiqueta no devuelve un error**. La resolución ya ocurrió. Devolver un fallo haría que el vendedor
// apretara el botón otra vez sobre algo que ya está hecho.
//
// ── EL ENGANCHE QUE ESTE ARCHIVO DEFIENDE ──────────────────────────────────
//
// La cola roja **entra por la etiqueta** y la etiqueta vive en el CRM, así que acá se lee de una
// caché que el barrido refresca cada diez minutos. Con eso solo, resolver dejaba dos agujeros:
//
//   · diez minutos en los que alguien ya atendió el caso y la pantalla lo sigue pidiendo;
//   · y uno permanente, porque **un rojo puede no traer ningún hallazgo** —son dos salidas
//     independientes— y entonces no había nada que marcar como resuelto.
//
// Por eso la resolución se anota en el ANÁLISIS, y la cola mira las dos cosas.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { limpiar, montar, unContacto, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import {
  etiquetaQueMarca,
  marcarLaIntervencion,
  PREFIJO_DE_LA_NOTA,
  resolverLaIntervencion,
} from '../../lib/auditor/intervencion.ts';
import { candidatosDecididos } from '../../lib/auditor/candidatos.ts';
import { FALLOS_DEL_AUDITOR, nucleoDeColas, SIN_MOTIVO } from '../../lib/negocio/colas.ts';
import { notasDeLaFicha } from '../../lib/negocio/ficha.ts';
import { sePuedeMandar } from '../../lib/ghl/contrato.ts';

let esc: Escenario;
const AHORA = new Date('2026-08-31T15:00:00.000Z');

/** El token es falso: ninguna prueba de este archivo llega a hablar con el CRM. */
const ACCESO = { token: 'token-que-el-CRM-va-a-rechazar' };

before(async () => {
  esc = await montar('Intervencion');
});
after(async () => {
  await limpio();
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
  await limpiar(esc);
}

/** Un contacto marcado por el auditor: con su etiqueta de fallo. */
async function unMarcado(campos: { territorio?: string; etiquetas?: string[] } = {}) {
  return unContacto(esc, {
    territorio: campos.territorio ?? 'closer',
    etiquetas: campos.etiquetas ?? ['bot_desactivado_appflow'],
    nombre: `${esc.marca} marcado`,
  });
}

/** Un análisis con intervención, y opcionalmente un hallazgo colgado. */
async function unaIntervencion(
  contactoId: string,
  o: { motivo?: string | null; conHallazgo?: boolean; agente?: string } = {},
): Promise<string> {
  const { rows } = await esc.admin.query<{ id: string }>(
    `insert into negocio.analisis_del_agente
       (org_id, contacto_id, agente, auditable, intervencion, motivo, nivel, resumen, disparo,
        mensajes_del_agente)
     values ($1, $2, $3, true, true, $4, 'rojo', 'Sembrado.', 'debounce', 6)
     returning id`,
    [esc.org, contactoId, o.agente ?? 'chat_post_agenda', o.motivo ?? 'El agente prometió un descuento inexistente.'],
  );
  const analisisId = rows[0]!.id;
  if (o.conHallazgo === true) {
    await esc.admin.query(
      `insert into negocio.hallazgos
         (org_id, contacto_id, analisis_id, agente, titulo, patron, correccion, evidencia_agente)
       values ($1, $2, $3, $4, 'Promete descuentos', 'promete_descuento', 'Agregar algo.', 'Una línea.')`,
      [esc.org, contactoId, analisisId, o.agente ?? 'chat_post_agenda'],
    );
  }
  return analisisId;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · MARCAR
// ═══════════════════════════════════════════════════════════════════════════════

test('la etiqueta que marca es la ESPECÍFICA del territorio, nunca la legada', async () => {
  /* `FALLOS_DEL_AUDITOR` tiene dos por territorio y la segunda es legado: era el tag único antes de
     separarlos. Se LEEN las dos y se ESCRIBE una — escribir la legada haría que un contacto marcado
     hoy fuera indistinguible de uno marcado por la plataforma anterior, y ya no habría forma de saber
     cuál agente falló. */
  assert.equal(etiquetaQueMarca('chat_post_agenda'), 'bot_desactivado_appflow');
  assert.equal(etiquetaQueMarca('chat_pre_agenda'), 'bot_desactivado_leadflow');
  // Y las dos están confirmadas en el contrato, que es lo que permite mandarlas.
  assert.ok(sePuedeMandar(etiquetaQueMarca('chat_post_agenda')));
  assert.ok(sePuedeMandar(etiquetaQueMarca('chat_pre_agenda')));
});

test('la NOTA se escribe con origen `auditor` y SIN autor', async () => {
  await limpio();
  /* ── LOS DOS JUNTOS, Y NINGUNO ALCANZA SOLO ────────────────────────────────
   *
   * `autor_id` nulo significa «no se sabe quién la escribió», que es lo que pasa con las importadas
   * del CRM. Con solo eso, la nota del auditor se leería como traída del CRM — y el día que alguien
   * mire por qué el CRM tiene notas que no puso, la respuesta va a estar mal.
   *
   * El tercer valor de `origen` es lo que hace que ese nulo no mienta. */
  const k = await unMarcado();
  const r = await marcarLaIntervencion({
    orgId: esc.org,
    contactoId: k.id,
    ghlContactId: k.ghlId,
    agente: 'chat_post_agenda',
    motivo: 'Le prometió doce cuotas sin interés.',
    acceso: ACCESO,
  });

  assert.equal(r.nota, true);
  const notas = await conOrganizacion(esc.org, () => notasDeLaFicha(k.id));
  assert.equal(notas.filas.length, 1);
  assert.equal(notas.filas[0]?.origen, 'auditor');
  assert.equal(notas.filas[0]?.autor, null, 'la nota no la escribió una persona');
  assert.equal(notas.filas[0]?.cuerpo, `${PREFIJO_DE_LA_NOTA} Le prometió doce cuotas sin interés.`);
});

test('sin motivo NO se escribe una nota vacía', async () => {
  await limpio();
  /* Una nota que dice «[IA]» y nada más es peor que ninguna: ocupa el lugar del motivo en la ficha —
     donde alguien la va a buscar— y no dice nada. Pasa cuando el modelo pide intervención y no deja
     la frase; el escritor guarda `null` en vez de una fila muda, justamente para esto. */
  const k = await unMarcado();
  for (const vacio of [null, '', '   ']) {
    const r = await marcarLaIntervencion({
      orgId: esc.org,
      contactoId: k.id,
      ghlContactId: k.ghlId,
      agente: 'chat_post_agenda',
      motivo: vacio,
      acceso: ACCESO,
    });
    assert.equal(r.nota, false, `escribió una nota con ${JSON.stringify(vacio)}`);
  }
  const notas = await conOrganizacion(esc.org, () => notasDeLaFicha(k.id));
  assert.equal(notas.filas.length, 0);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · RESOLVER
// ═══════════════════════════════════════════════════════════════════════════════

test('EL CIERRE · resolver saca al contacto de la cola y deja el rastro', async () => {
  await limpio();
  const k = await unMarcado();
  await unaIntervencion(k.id, { conHallazgo: true });

  // Antes: está en la cola, con su motivo.
  const antes = await conOrganizacion(esc.org, () => nucleoDeColas('closer', 'America/Lima'));
  assert.ok(antes.urgentes.some((u) => u.fila.id === k.id));

  const r = await resolverLaIntervencion({
    orgId: esc.org,
    contactoId: k.id,
    ghlContactId: k.ghlId,
    quien: esc.quien,
    acceso: ACCESO,
  });

  assert.equal(r.resuelto, true);
  assert.equal(r.intervenciones, 1);
  assert.equal(r.hallazgos, 1);

  /* ── SALE DE LA COLA AUNQUE LA ETIQUETA SIGA PUESTA ────────────────────────
   *
   * La etiqueta vive en el CRM y acá se lee de la caché, que el barrido refresca cada diez minutos.
   * Sin mirar la resolución, el contacto se quedaría en la cola durante ese rato —o para siempre, si
   * el CRM rechazó el borrado— con alguien ya atendiéndolo. */
  const despues = await conOrganizacion(esc.org, () => nucleoDeColas('closer', 'America/Lima'));
  assert.ok(!despues.urgentes.some((u) => u.fila.id === k.id), 'sigue en la cola después de resolver');

  // Y el rastro: quién y cuándo, en las dos tablas.
  const { rows } = await esc.admin.query<{ resuelto_por: string; resuelto_el: Date }>(
    `select resuelto_por, resuelto_el from negocio.analisis_del_agente where contacto_id = $1`,
    [k.id],
  );
  assert.equal(rows[0]?.resuelto_por, esc.quien);
  assert.ok(rows[0]?.resuelto_el instanceof Date);
});

test('un ROJO SIN HALLAZGOS también se resuelve, y ése es el agujero permanente', async () => {
  await limpio();
  /* ══════════════════════════════════════════════════════════════════════════
     POR QUÉ LA RESOLUCIÓN VA EN EL ANÁLISIS Y NO SOLO EN LOS HALLAZGOS

     La intervención y el hallazgo son **dos salidas independientes** — es la separación que este
     módulo entero vino a hacer. Un veredicto rojo puede no traer ningún hallazgo: hay daño en curso y
     no hay nada que corregir en el prompt.

     Cerrando solo los hallazgos, ese contacto **no sale de la cola nunca**: no hay ninguna fila que
     marcar. Y es justo el caso más urgente de todos.
     ══════════════════════════════════════════════════════════════════════════ */
  const k = await unMarcado();
  await unaIntervencion(k.id, { conHallazgo: false });

  const r = await resolverLaIntervencion({
    orgId: esc.org,
    contactoId: k.id,
    ghlContactId: k.ghlId,
    quien: esc.quien,
    acceso: ACCESO,
  });

  assert.equal(r.hallazgos, 0);
  assert.equal(r.intervenciones, 1);
  assert.equal(r.resuelto, true, 'un rojo sin hallazgos tiene que poder resolverse');

  const despues = await conOrganizacion(esc.org, () => nucleoDeColas('closer', 'America/Lima'));
  assert.ok(!despues.urgentes.some((u) => u.fila.id === k.id));
});

test('«se hizo» y «salió bien» se reportan SEPARADOS', async () => {
  await limpio();
  /* El token es falso, así que el CRM va a rechazar. La resolución **ya ocurrió** y la respuesta lo
     dice: `resuelto: true` con `etiquetasQuitadas: false` significa «tu parte está hecha, y el bot
     sigue apagado». Devolver un error haría que el vendedor apretara el botón otra vez sobre algo que
     ya está hecho, y a la tercera dejaría de leer la respuesta. */
  const k = await unMarcado();
  await unaIntervencion(k.id, { conHallazgo: true });

  const r = await resolverLaIntervencion({
    orgId: esc.org,
    contactoId: k.id,
    ghlContactId: k.ghlId,
    quien: esc.quien,
    acceso: ACCESO,
  });

  assert.equal(r.resuelto, true);
  assert.equal(r.etiquetasQuitadas, false);
  assert.ok(r.porque !== undefined, 'un fallo del CRM tiene que decir cuál');
});

test('resolver DOS veces no vuelve a cerrar nada, y no es un error', async () => {
  await limpio();
  /* La segunda resolución encuentra todo cerrado: `resuelto: false` con cero de cada uno. No es un
     fallo — es la respuesta correcta a «esto ya estaba hecho». Y el `where resuelto_el is null` es lo
     que impide que la segunda pise el rastro de quién lo tomó de verdad. */
  const k = await unMarcado();
  await unaIntervencion(k.id, { conHallazgo: true });
  const opciones = {
    orgId: esc.org,
    contactoId: k.id,
    ghlContactId: k.ghlId,
    quien: esc.quien,
    acceso: ACCESO,
  };

  await resolverLaIntervencion(opciones);
  const primera = await esc.admin.query<{ resuelto_el: Date }>(
    `select resuelto_el from negocio.analisis_del_agente where contacto_id = $1`,
    [k.id],
  );

  const segunda = await resolverLaIntervencion(opciones);
  assert.equal(segunda.resuelto, false);
  assert.equal(segunda.intervenciones, 0);
  assert.equal(segunda.hallazgos, 0);

  const despues = await esc.admin.query<{ resuelto_el: Date }>(
    `select resuelto_el from negocio.analisis_del_agente where contacto_id = $1`,
    [k.id],
  );
  assert.deepEqual(
    despues.rows[0]?.resuelto_el,
    primera.rows[0]?.resuelto_el,
    'la segunda resolución pisó el rastro de la primera',
  );
});

test('un contacto con la ETIQUETA y SIN análisis nuestro igual se puede resolver', async () => {
  await limpio();
  /* ── EL CASO QUE LA CONDICIÓN AL REVÉS DEJARÍA AFUERA ──────────────────────
   *
   * Lo marcó la plataforma anterior, o el CRM. Entra a la cola por la etiqueta y con el texto de
   * reserva, y es **justo el que más necesita que el botón funcione**: no hay nada nuestro que
   * explique por qué está ahí.
   *
   * Con las etiquetas condicionadas a haber cerrado algo, sería el único al que resolver no le hace
   * nada — y se quedaría en la cola para siempre. */
  const k = await unMarcado();

  const r = await resolverLaIntervencion({
    orgId: esc.org,
    contactoId: k.id,
    ghlContactId: k.ghlId,
    quien: esc.quien,
    acceso: ACCESO,
  });

  assert.equal(r.resuelto, false, 'no había nada nuestro que cerrar');
  /* Y se INTENTÓ quitar las etiquetas igual: es lo único que puede sacarlo de la cola. Acá el CRM
     rechaza porque el token es falso, pero la petición salió. */
  assert.equal(r.etiquetasQuitadas, false);
  assert.ok(r.porque !== undefined);
});

test('resolver NO toca la intervención de otro contacto', async () => {
  await limpio();
  const uno = await unMarcado();
  const otro = await unMarcado();
  await unaIntervencion(uno.id, { conHallazgo: true });
  await unaIntervencion(otro.id, { conHallazgo: true });

  await resolverLaIntervencion({
    orgId: esc.org,
    contactoId: uno.id,
    ghlContactId: uno.ghlId,
    quien: esc.quien,
    acceso: ACCESO,
  });

  const colas = await conOrganizacion(esc.org, () => nucleoDeColas('closer', 'America/Lima'));
  assert.ok(!colas.urgentes.some((u) => u.fila.id === uno.id));
  assert.ok(colas.urgentes.some((u) => u.fila.id === otro.id), 'se llevó puesto al otro contacto');
});

test('se le piden al CRM LAS TRES etiquetas, no la del territorio', async () => {
  await limpio();
  /* ══════════════════════════════════════════════════════════════════════════
     UNA ETIQUETA DE MENOS NO SE VE

     `FALLOS_DEL_AUDITOR` es la lista de lo que mete a un contacto en la cola roja, y son tres
     códigos: el del closer, el del setter, y el legado que era el único antes de separarlos.
     **Dejar una puesta lo deja adentro.**

     Y el daño de quitar de menos es del lado que no se nota: el contacto sale de NUESTRA cola —la
     resolución es nuestra— y en el CRM se queda con su etiqueta, o sea con el agente pausado y sin
     nadie que vuelva a mirarlo.

     La lista se afirma contra `FALLOS_DEL_AUDITOR` y no escrita a mano: son las MISMAS que hacen
     entrar, y dos listas del mismo hecho divergen.
     ══════════════════════════════════════════════════════════════════════════ */
  const k = await unMarcado();
  await unaIntervencion(k.id, { conHallazgo: true });

  let pedidas: readonly string[] = [];
  await resolverLaIntervencion(
    {
      orgId: esc.org,
      contactoId: k.id,
      ghlContactId: k.ghlId,
      quien: esc.quien,
      acceso: ACCESO,
    },
    async (_acceso, _ghlId, etiquetas) => {
      pedidas = etiquetas;
      return { tipo: 'datos', datos: { quitadas: etiquetas.length } };
    },
  );

  const esperadas = [...new Set([...FALLOS_DEL_AUDITOR.closer, ...FALLOS_DEL_AUDITOR.setter])];
  assert.deepEqual([...pedidas].sort(), esperadas.sort());
  assert.equal(pedidas.length, 3, 'las dos específicas y la legada');
});

test('un veredicto VERDE del mismo contacto no se marca como resuelto', async () => {
  await limpio();
  /* Resolver cierra intervenciones, no análisis. Sin el filtro por `intervencion`, un verde del
     mismo contacto quedaría con fecha de resolución — y entonces «cuánto tarda alguien en tomar una
     urgencia» se mediría sobre filas que nunca fueron urgencias. No rompe la cola ni el portón, que
     ya filtran por su cuenta: rompe el dato. */
  const k = await unMarcado();
  await unaIntervencion(k.id, { conHallazgo: false });
  const { rows } = await esc.admin.query<{ id: string }>(
    `insert into negocio.analisis_del_agente
       (org_id, contacto_id, agente, auditable, intervencion, nivel, resumen, disparo,
        mensajes_del_agente)
     values ($1, $2, 'chat_post_agenda', true, false, 'verde', 'Todo bien.', 'debounce', 9)
     returning id`,
    [esc.org, k.id],
  );
  const verdeId = rows[0]!.id;

  await resolverLaIntervencion({
    orgId: esc.org,
    contactoId: k.id,
    ghlContactId: k.ghlId,
    quien: esc.quien,
    acceso: ACCESO,
  });

  const verde = await esc.admin.query<{ resuelto_el: Date | null }>(
    `select resuelto_el from negocio.analisis_del_agente where id = $1`,
    [verdeId],
  );
  assert.equal(verde.rows[0]?.resuelto_el, null, 'el verde quedó marcado como resuelto');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · EL PORTÓN 3 Y LA RESOLUCIÓN
// ═══════════════════════════════════════════════════════════════════════════════

test('una intervención SIN RESOLVER frena el portón 3, aunque no haya hallazgos', async () => {
  await limpio();
  /* ── EL AGUJERO QUE CERRAR ESTO TAPÓ ───────────────────────────────────────
   *
   * El portón 3 miraba solo los hallazgos abiertos. Un rojo sin hallazgos no frenaba nada, así que el
   * contacto se volvía a auditar en cuanto el antirrebote se cumpliera — **una inferencia pagada
   * sobre una conversación que un vendedor ya tiene en su cola**.
   *
   * Y después de resolver, el portón deja pasar: es el estado correcto, porque el caso está cerrado y
   * lo que venga después es trabajo nuevo. */
  const k = await unContacto(esc, {
    territorio: 'closer',
    etiquetas: ['bot_activado_appflow'],
    nombre: `${esc.marca} con intervención abierta`,
  });
  await unaIntervencion(k.id, { conHallazgo: false });

  const conAbierta = await conOrganizacion(esc.org, () => candidatosDecididos(AHORA));
  const antes = conAbierta.decididos.find((d) => d.candidato.contactoId === k.id);
  assert.equal(antes?.candidato.tieneAvisoAbierto, true);
  assert.equal(antes?.decision.audita === false && antes.decision.porton, 'ya_marcado');

  await esc.admin.query(
    `update negocio.analisis_del_agente set resuelto_el = now(), resuelto_por = $2
      where contacto_id = $1`,
    [k.id, esc.quien],
  );

  const conCerrada = await conOrganizacion(esc.org, () => candidatosDecididos(AHORA));
  const despues = conCerrada.decididos.find((d) => d.candidato.contactoId === k.id);
  assert.equal(despues?.candidato.tieneAvisoAbierto, false);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · LOS DOS TERRITORIOS
// ═══════════════════════════════════════════════════════════════════════════════

test('resolver saca al contacto de la cola del SETTER también', async () => {
  await limpio();
  /* `FALLOS_DEL_AUDITOR` no se fusiona —un closer viendo el fallo del agente del setter estuvo en
     producción— así que la resolución tiene que funcionar en las dos colas. */
  const k = await unMarcado({ territorio: 'setter', etiquetas: ['bot_desactivado_leadflow'] });
  await unaIntervencion(k.id, { agente: 'chat_pre_agenda', conHallazgo: true });

  const antes = await conOrganizacion(esc.org, () => nucleoDeColas('setter', 'America/Lima'));
  assert.ok(antes.urgentes.some((u) => u.fila.id === k.id));

  await resolverLaIntervencion({
    orgId: esc.org,
    contactoId: k.id,
    ghlContactId: k.ghlId,
    quien: esc.quien,
    acceso: ACCESO,
  });

  const despues = await conOrganizacion(esc.org, () => nucleoDeColas('setter', 'America/Lima'));
  assert.ok(!despues.urgentes.some((u) => u.fila.id === k.id));
});

test('el texto de reserva sigue cubriendo al marcado SIN análisis', async () => {
  await limpio();
  /* No se borra, y es deliberado: son dos fuentes independientes. Y con la resolución en el medio hay
     que comprobar que ese contacto **sigue entrando** — excluir por «no tiene análisis resuelto» y
     excluir por «tiene análisis resuelto» son dos condiciones distintas, y confundirlas vaciaría la
     cola de todos los marcados por la plataforma anterior. */
  const k = await unMarcado();
  const colas = await conOrganizacion(esc.org, () => nucleoDeColas('closer', 'America/Lima'));
  assert.equal(colas.urgentes.find((u) => u.fila.id === k.id)?.motivo, SIN_MOTIVO);
});
