// El PROMPT DE CADA AGENTE: la vuelta completa contra la base. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA PRUEBA QUE EL DISEÑO DE ORIGEN NO TUVO, Y QUE ES LA QUE HABRÍA IMPORTADO
//
// Su propia documentación la prescribe y explica por qué: **guardar un prompt con una frase
// inconfundible y comprobar que el próximo veredicto la cite**. Si nunca la cita, la lectura no lee lo
// que la escritura escribió.
//
// Y la medición dice que ese defecto era invisible allá: sus cuatro espacios de prompt estaban
// **VACÍOS** en las dos organizaciones, así que sus 59 análisis salieron **sin prompt de referencia** y
// nadie podía notar la diferencia entre «la lectura está rota» y «no hay nada cargado». Las dos se ven
// idénticas.
//
// Acá se comprueba **toda la vuelta menos el último salto**: la frase se guarda, se lee, y llega
// VERBATIM al bloque de instrucciones que el modelo recibe. El último salto —que el modelo la cite—
// exige una inferencia real y no se puede medir sin gastar plata de la cuenta de la empresa; lo que sí
// se puede es garantizar que la frase esté delante de sus ojos, que es la mitad que se rompe sola.
//
// ── LO QUE MÁS SE PRUEBA ACÁ ES EL BORRADO ──────────────────────────────────
//
// «Vaciar significa borrar» es al revés que en una credencial, y por eso es donde alguien va a
// equivocarse: la base tiene un `check` que hace inescribible la fila en blanco, y sin él el auditor
// entraría a la rama «con prompt» a buscar fragmentos en cero caracteres.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import {
  guardarPromptDelAgente,
  hashDelPrompt,
  leerLosPrompts,
  leerPromptDelAgente,
} from '../../lib/auditor/prompts.ts';
import { instruccionesDelAuditor } from '../../lib/auditor/rubrica.ts';
import { AGENTES } from '../../lib/auditor/veredicto.ts';

let esc: Escenario;

before(async () => {
  esc = await montar('Prompt');
});
after(async () => {
  await esc.admin.query('delete from negocio.prompts_del_agente');
  await cerrarTodo();
  await cerrarClientes();
});

/** Deja las dos empresas sin ningún prompt, para que cada prueba empiece del mismo estado. */
async function sinPrompts(): Promise<void> {
  await esc.admin.query('delete from negocio.prompts_del_agente');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · LA VUELTA COMPLETA
// ═══════════════════════════════════════════════════════════════════════════════

test('una frase inconfundible sobrevive la vuelta y llega al prompt del modelo', async () => {
  await sinPrompts();
  /* La prueba que el origen prescribe. La frase es deliberadamente absurda: si apareciera por
     casualidad en el molde o en la rúbrica, la comprobación pasaría sin medir nada. */
  const frase = 'REGLA 7: jamás menciones el pimentón dulce de La Vera antes del minuto tres.';

  const que = await conOrganizacion(esc.org, () =>
    guardarPromptDelAgente('chat_pre_agenda', frase, esc.quien),
  );
  assert.equal(que, 'guardado');

  const leido = await conOrganizacion(esc.org, () => leerPromptDelAgente('chat_pre_agenda'));
  assert.equal(leido?.texto, frase);

  // Y el último tramo comprobable: la frase llega al texto que el modelo lee, sin reescribirse.
  const instrucciones = instruccionesDelAuditor({
    agente: 'chat_pre_agenda',
    promptDelAgente: leido?.texto ?? null,
  });
  assert.ok(instrucciones.includes(frase));
});

test('el prompt de un agente NO se lee desde el otro agente', async () => {
  await sinPrompts();
  /* La clave es `(org_id, agente)`. Sin el agente en el `where`, el auditor de post-agenda juzgaría
     contra el prompt del de pre-agenda: dos misiones distintas, un solo texto, y hallazgos
     convincentes sobre reglas que ese agente no tiene. */
  await conOrganizacion(esc.org, () =>
    guardarPromptDelAgente('chat_pre_agenda', 'Solo del pre-agenda.', null),
  );

  const post = await conOrganizacion(esc.org, () => leerPromptDelAgente('chat_post_agenda'));
  assert.equal(post, null);
});

test('ADR-0206 · el prompt de una empresa no se ve desde la otra', async () => {
  await sinPrompts();
  /* Un prompt es la voz de la empresa delante de sus clientes: leerlo desde otra cuenta es leerle la
     estrategia comercial completa. Lo impide la política de aislamiento, no un `where` del código. */
  await conOrganizacion(esc.org, () =>
    guardarPromptDelAgente('chat_post_agenda', 'El prompt de alfa.', null),
  );

  const desdeLaOtra = await conOrganizacion(esc.otraOrg, () =>
    leerPromptDelAgente('chat_post_agenda'),
  );
  assert.equal(desdeLaOtra, null);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · GUARDAR DOS VECES, Y LA FECHA
// ═══════════════════════════════════════════════════════════════════════════════

test('guardar dos veces deja UNA fila, y mueve la fecha', async () => {
  await sinPrompts();
  /* `on conflict` sobre la restricción única. Con un `select` previo en vez de esto, dos guardados
     simultáneos verían los dos «no hay fila» y quedarían dos: la lectura se llevaría la que el
     planificador devuelva primero, o sea que el auditor juzgaría contra un prompt distinto en cada
     corrida sin que nada fallara nunca.

     Y la fecha: `default now()` **solo se aplica al insertar**, así que el camino del conflicto tiene
     que escribirla a mano o un prompt editado hoy se vería como de hace meses. */
  await conOrganizacion(esc.org, () =>
    guardarPromptDelAgente('chat_post_agenda', 'Primera versión.', null),
  );
  const primera = await conOrganizacion(esc.org, () => leerPromptDelAgente('chat_post_agenda'));

  await conOrganizacion(esc.org, () =>
    guardarPromptDelAgente('chat_post_agenda', 'Segunda versión, distinta.', esc.quien),
  );
  const segunda = await conOrganizacion(esc.org, () => leerPromptDelAgente('chat_post_agenda'));

  const { rows } = await esc.admin.query<{ n: string }>(
    `select count(*)::text as n from negocio.prompts_del_agente
      where org_id = $1 and agente = 'chat_post_agenda'`,
    [esc.org],
  );
  assert.equal(rows[0]?.n, '1');

  assert.equal(segunda?.texto, 'Segunda versión, distinta.');
  assert.ok(primera && segunda);
  assert.notEqual(primera.hash, segunda.hash);

  /* ── LA FECHA SE MIDE CONTRA UN PASADO PUESTO A MANO ───────────────────────
   *
   * La comparación obvia —«la segunda fecha es mayor o igual que la primera»— **pasa igual si la
   * fecha no se movió**, que es justo el defecto: `default now()` solo se aplica al insertar, así que
   * el camino del conflicto tiene que escribirla a mano o un prompt editado hoy se ve como de hace
   * meses en la pantalla del técnico.
   *
   * Así que se retrocede la fila a una fecha inconfundible y se vuelve a guardar: si el camino del
   * conflicto no toca la columna, la fecha sigue en 2020. */
  const enElPasado = new Date('2020-01-01T00:00:00.000Z');
  await esc.admin.query(
    `update negocio.prompts_del_agente set actualizado_el = $2
      where org_id = $1 and agente = 'chat_post_agenda'`,
    [esc.org, enElPasado],
  );
  await conOrganizacion(esc.org, () =>
    guardarPromptDelAgente('chat_post_agenda', 'Tercera versión.', null),
  );
  const tercera = await conOrganizacion(esc.org, () => leerPromptDelAgente('chat_post_agenda'));
  assert.ok(
    (tercera?.actualizadoEl.getTime() ?? 0) > enElPasado.getTime(),
    'el camino del conflicto no movió la fecha',
  );
});

test('el hash es del CONTENIDO, no de los espacios que lo rodean', () => {
  /* Una propiedad de la función, comprobada sobre la función. Su valor no está en el camino de la
     base —ahí el escritor ya recorta— sino en el otro: quien compare el hash guardado de un hallazgo
     contra el texto de un cuadro de edición no tiene que acordarse de recortarlo, y un salto de línea
     de más no dispara un aviso de «el prompt cambió» que sería falso. */
  assert.equal(hashDelPrompt('Un prompt.'), hashDelPrompt('  Un prompt.\n\n'));
  // Y sigue distinguiendo dos textos distintos, que es lo que un hash tiene que hacer.
  assert.notEqual(hashDelPrompt('Un prompt.'), hashDelPrompt('Otro prompt.'));
});

test('borrar el prompt de un agente NO borra el del otro', async () => {
  await sinPrompts();
  /* ── EL DEFECTO QUE ESTO CIERRA ────────────────────────────────────────────
   *
   * El borrado tiene que filtrar por agente. Sin ese `where`, vaciar el cuadro de texto del
   * post-agenda **le borra también el prompt al pre-agenda**: dos agentes, un gesto, y el segundo
   * vuelve a auditar sin prompt de referencia sin que nadie lo haya pedido.
   *
   * Y es de la clase que no se nota: la pantalla que se estaba mirando queda correcta —el prompt que
   * se vació está vacío— y el que desapareció es el de la otra pestaña. */
  await conOrganizacion(esc.org, async () => {
    await guardarPromptDelAgente('chat_post_agenda', 'El del post-agenda.', null);
    await guardarPromptDelAgente('chat_pre_agenda', 'El del pre-agenda.', null);
  });

  await conOrganizacion(esc.org, () => guardarPromptDelAgente('chat_post_agenda', '', null));

  const quedan = await conOrganizacion(esc.org, () => leerLosPrompts());
  assert.equal(quedan.chat_post_agenda, null);
  assert.equal(quedan.chat_pre_agenda?.texto, 'El del pre-agenda.');
});

test('el hash se recalcula DEL TEXTO, no se lee de la columna', async () => {
  await sinPrompts();
  /* ── EL DEFECTO QUE ESTO CIERRA ────────────────────────────────────────────
   *
   * La columna se pisa a mano con un hash inventado, imitando exactamente lo que produciría una
   * escritura futura que se olvide de actualizarla. La lectura tiene que ignorarla.
   *
   * Si la leyera, esos hallazgos viejos pasarían por vigentes **para siempre**: la pantalla del
   * técnico compara el hash del hallazgo con el del prompt para avisar que el prompt cambió, y con la
   * columna desactualizada ese aviso no vuelve a salir nunca. Sin un error, sin una fila rara. */
  const texto = 'Un prompt cualquiera, con su texto.';
  await conOrganizacion(esc.org, () => guardarPromptDelAgente('chat_pre_agenda', texto, null));

  await esc.admin.query(
    `update negocio.prompts_del_agente set prompt_hash = 'mentira0mentira0'
      where org_id = $1 and agente = 'chat_pre_agenda'`,
    [esc.org],
  );

  const leido = await conOrganizacion(esc.org, () => leerPromptDelAgente('chat_pre_agenda'));
  assert.equal(leido?.hash, hashDelPrompt(texto));
  assert.notEqual(leido?.hash, 'mentira0mentira0');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · VACIAR ES BORRAR
// ═══════════════════════════════════════════════════════════════════════════════

test('vaciar el texto BORRA el prompt, y en blanco cuenta como vacío', async () => {
  /* Es al revés que en una credencial —donde un campo vacío no toca el secreto guardado— y tiene que
     serlo: vaciar es el ÚNICO gesto disponible para decir «este agente vuelve a no tener prompt». Sin
     él la única salida sería dejar cargado un prompt que la empresa ya no quiere.

     Y el blanco cuenta: sin el `trim`, guardar tres espacios dejaría una fila que la base rechaza por
     el `check` —o peor, si el `check` no estuviera, una fila que el auditor lee como prompt cargado de
     cero caracteres y sale a buscarle fragmentos. */
  for (const vacio of ['', '   ', '\n\n\t']) {
    await sinPrompts();
    await conOrganizacion(esc.org, () =>
      guardarPromptDelAgente('chat_post_agenda', 'Algo cargado.', null),
    );

    const que = await conOrganizacion(esc.org, () =>
      guardarPromptDelAgente('chat_post_agenda', vacio, null),
    );
    assert.equal(que, 'borrado', `no borró con ${JSON.stringify(vacio)}`);

    const leido = await conOrganizacion(esc.org, () => leerPromptDelAgente('chat_post_agenda'));
    assert.equal(leido, null);
  }
});

test('vaciar lo que ya estaba vacío NO es un error', async () => {
  await sinPrompts();
  /* Quien vacía un campo que ya estaba vacío consiguió lo que quería. Devolver un fallo ahí obligaría
     a la interfaz a mostrar un error rojo por una operación que salió bien — y así es como la gente
     aprende a ignorar los errores de una pantalla. */
  const que = await conOrganizacion(esc.org, () =>
    guardarPromptDelAgente('chat_post_agenda', '', null),
  );
  assert.equal(que, 'no_habia_nada');
});

test('LA BASE rechaza una fila con el texto en blanco', async () => {
  await sinPrompts();
  /* El cinturón debajo del `trim` del escritor. Se intenta por debajo del código, como lo haría una
     corrección a mano o una migración de datos: el estado «hay fila y no hay prompt» tiene que ser
     inescribible, no solo improbable. */
  await assert.rejects(
    () =>
      esc.admin.query(
        `insert into negocio.prompts_del_agente (org_id, agente, texto, prompt_hash)
          values ($1, 'chat_post_agenda', '   ', 'x')`,
        [esc.org],
      ),
    /prompts_del_agente_texto_no_vacio/,
  );
});

test('LA BASE rechaza un agente que no existe', async () => {
  await sinPrompts();
  /* La misma lista cerrada que `analisis_del_agente`, y por el mismo motivo que la 027 dejó escrito:
     encender un auditor que gasta plata tiene que aparecer en un diff que alguien mire. */
  await assert.rejects(
    () =>
      esc.admin.query(
        `insert into negocio.prompts_del_agente (org_id, agente, texto, prompt_hash)
          values ($1, 'voz_post_agenda', 'algo', 'x')`,
        [esc.org],
      ),
    /prompts_del_agente_agente_check/,
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · LA LISTA PARA LA PANTALLA
// ═══════════════════════════════════════════════════════════════════════════════

test('la lista trae UNA entrada por agente, con `null` en los que no tienen', async () => {
  await sinPrompts();
  /* ── EL DEFECTO 4.1 DEL ORIGEN, LLEGANDO POR LA INTERFAZ ───────────────────
   *
   * Devolver solo las filas que hay dejaría a la pantalla sin poder distinguir «este agente no tiene
   * prompt» de «este agente no existe». Es exactamente el defecto que allá declaraba a los dos
   * auditores de voz como «sin auditor» cuando ya lo tenían — el esquema por fila lo cerró de un lado,
   * y esto lo cierra del otro. */
  await conOrganizacion(esc.org, () =>
    guardarPromptDelAgente('chat_pre_agenda', 'Solo uno cargado.', null),
  );

  const todos = await conOrganizacion(esc.org, () => leerLosPrompts());

  assert.deepEqual(Object.keys(todos).sort(), [...AGENTES].sort());
  assert.equal(todos.chat_pre_agenda?.texto, 'Solo uno cargado.');
  assert.equal(todos.chat_post_agenda, null);
});

test('sin ningún prompt, la lista sigue nombrando a los dos agentes', async () => {
  await sinPrompts();
  /* El estado con el que nace toda empresa, y el que corrió en los 59 análisis del origen. Una lista
     vacía acá haría que la pantalla del técnico no dibujara ninguna tarjeta y se leyera como un fallo
     de carga. */
  const todos = await conOrganizacion(esc.org, () => leerLosPrompts());
  assert.deepEqual(Object.keys(todos).sort(), [...AGENTES].sort());
  for (const agente of AGENTES) assert.equal(todos[agente], null);
});
