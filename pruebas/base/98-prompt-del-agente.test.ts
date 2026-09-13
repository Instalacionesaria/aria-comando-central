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
  /* El historial PRIMERO. Si se borrara después, el `delete` de los prompts dispararía el archivador
     de la `046` y cada prueba empezaría con las versiones que dejó la anterior. */
  await esc.admin.query('delete from negocio.versiones_del_prompt');
  await esc.admin.query('delete from negocio.prompts_del_agente');
  await esc.admin.query('delete from negocio.versiones_del_prompt');
}

/** Lo que quedó archivado de un agente, de lo más viejo a lo más nuevo. */
async function elHistorial(agente = 'chat_pre_agenda'): Promise<Record<string, unknown>[]> {
  const r = await esc.admin.query(
    `select texto, prompt_hash, vigente_desde, reemplazada_el, puesta_por, sacada_por, que_siguio
       from negocio.versiones_del_prompt where agente = $1 order by reemplazada_el`,
    [agente],
  );
  return r.rows as Record<string, unknown>[];
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

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · EL HISTORIAL: LO QUE DECÍA EL PROMPT ANTES (migración 046)
// ═══════════════════════════════════════════════════════════════════════════════

test('pisar un prompt ARCHIVA el texto anterior, con su tramo y sus dos actores', async () => {
  /* El defecto que esto cierra: el auditor sella `prompt_hash` en cada hallazgo y la pantalla avisa
     «el prompt cambió desde que se diagnosticó esto» — mandando a mirar un texto que ya no existía en
     ninguna parte. El hash son 16 hex de sha256 y no se invierte: recuperable, cero. */
  await sinPrompts();
  const vieja = 'VERSIÓN VIEJA: hablá del pimentón antes del minuto tres.';
  const nueva = 'VERSIÓN NUEVA: no hables del pimentón nunca.';

  await conOrganizacion(esc.org, () => guardarPromptDelAgente('chat_pre_agenda', vieja, esc.quien));
  const antes = await conOrganizacion(esc.org, () => leerPromptDelAgente('chat_pre_agenda'));
  assert.equal(await elHistorial().then((h) => h.length), 0, 'el primer guardado no archiva nada');

  await conOrganizacion(esc.org, () => guardarPromptDelAgente('chat_pre_agenda', nueva, esc.quien));

  const h = await elHistorial();
  assert.equal(h.length, 1, 'pisar el prompt no archivó la versión que salía');
  assert.equal(h[0]?.texto, vieja, 'se archivó un texto que no es el que se pisó');
  assert.equal(h[0]?.que_siguio, 'otra_version');
  assert.equal(h[0]?.puesta_por, esc.quien, 'se perdió quién había dejado esa versión');
  assert.equal(h[0]?.sacada_por, esc.quien, 'se perdió quién la reemplazó');

  /* ── LA COSTURA, QUE ES LA MITAD DEL DISEÑO ──────────────────────────────
   *
   * `vigente_desde` de la versión archivada tiene que ser EXACTAMENTE el `actualizado_el` que tenía
   * la fila viva. Si no lo fuera, la línea de tiempo tendría un hueco o un solapamiento en cada
   * costura, y «¿qué prompt corría el martes a las 15?» devolvería dos filas o ninguna. */
  assert.equal(
    (h[0]?.vigente_desde as Date)?.getTime(),
    antes?.actualizadoEl?.getTime(),
    'el tramo archivado no empieza donde la versión realmente empezó a regir',
  );

  // Y el vigente sigue siendo el nuevo: archivar no es mover.
  const ahora = await conOrganizacion(esc.org, () => leerPromptDelAgente('chat_pre_agenda'));
  assert.equal(ahora?.texto, nueva);
});

test('LA PRUEBA QUE NINGÚN HISTORIAL EN TYPESCRIPT PODRÍA PASAR: un `update` crudo también archiva', async () => {
  /* Es el argumento entero del disparador, vuelto comprobación. Este `update` NO pasa por
     `guardarPromptDelAgente`: es una sentencia a mano, como la que alguien correría un domingo o como
     la que escribiría un segundo camino de escritura dentro de seis meses.
     Un historial escrito en el módulo de TypeScript se quedaría MUDO acá, y nada fallaría. */
  await sinPrompts();
  await conOrganizacion(esc.org, () =>
    guardarPromptDelAgente('chat_pre_agenda', 'La que estaba antes del domingo.', esc.quien),
  );

  await esc.admin.query(
    `update negocio.prompts_del_agente set texto = $1 where agente = 'chat_pre_agenda'`,
    ['La que alguien puso a mano, sin pasar por la aplicación.'],
  );

  const h = await elHistorial();
  assert.equal(h.length, 1, 'una escritura que no pasa por la aplicación no dejó rastro');
  assert.equal(h[0]?.texto, 'La que estaba antes del domingo.');
});

test('vaciar el prompt archiva la versión Y dice que no siguió ninguna', async () => {
  /* Distinguir «se editó» de «se apagó el prompt de referencia» es lo que hace legible la línea de
     tiempo: la segunda explica por qué los análisis de esa semana salieron con `prompt_hash` nulo. */
  await sinPrompts();
  await conOrganizacion(esc.org, () =>
    guardarPromptDelAgente('chat_pre_agenda', 'La última antes del vacío.', esc.quien),
  );

  const que = await conOrganizacion(esc.org, () =>
    guardarPromptDelAgente('chat_pre_agenda', '   ', esc.quien),
  );
  assert.equal(que, 'borrado');

  const h = await elHistorial();
  assert.equal(h.length, 1, 'borrar el prompt no archivó nada: el texto se fue con la fila');
  assert.equal(h[0]?.texto, 'La última antes del vacío.');
  assert.equal(h[0]?.que_siguio, 'nada', 'un borrado se ve igual que una edición');
  assert.equal(
    h[0]?.sacada_por,
    esc.quien,
    'se perdió quién vació el prompt: la variable de transacción no llegó al disparador',
  );
});

test('reguardar el MISMO texto no archiva nada y NO mueve la fecha', async () => {
  /* ── EL DEFECTO QUE ESTE `where` IMPIDE, Y SE ALCANZA CON UNA TECLA ───────
   *
   * Sin él, un reguardado idéntico mueve `actualizado_el`; y entonces, cuando esa versión se archive
   * de verdad más adelante, va a nacer afirmando que empezó a regir el día del reguardado en vez del
   * día real. Es exactamente la mentira que el historial viene a impedir, fabricada por el propio
   * arreglo.
   *
   * Y no es teórico: el botón de guardar del editor compara `texto !== (p.texto ?? '')` SIN recortar,
   * mientras el servidor recorta — así que un salto de línea al final lo habilita y manda el mismo
   * texto. Por eso el fixture reguarda con espacios alrededor: es el caso real, no uno inventado. */
  await sinPrompts();
  const texto = 'La única versión que va a existir.';

  await conOrganizacion(esc.org, () => guardarPromptDelAgente('chat_pre_agenda', texto, esc.quien));
  const primero = await conOrganizacion(esc.org, () => leerPromptDelAgente('chat_pre_agenda'));

  // El mismo texto, con un salto de línea al final: lo que el editor deja mandar.
  await conOrganizacion(esc.org, () =>
    guardarPromptDelAgente('chat_pre_agenda', `${texto}\n`, esc.quien),
  );

  assert.equal(await elHistorial().then((h) => h.length), 0, 'un reguardado idéntico inventó una versión');
  const despues = await conOrganizacion(esc.org, () => leerPromptDelAgente('chat_pre_agenda'));
  assert.equal(
    despues?.actualizadoEl?.getTime(),
    primero?.actualizadoEl?.getTime(),
    'la fecha se movió sin que el texto cambiara: la versión que se archive después va a mentir',
  );
});

test('con la columna del hash TORCIDA, el archivo guarda el hash del texto igual', async () => {
  /* ── ESTA PRUEBA EXISTE PORQUE LA DE ABAJO NO ALCANZABA ───────────────────
   *
   * Medido con el arnés de mutación: cambiar `negocio.hash_del_prompt(old.texto)` por
   * `old.prompt_hash` en el archivador dejaba la prueba siguiente EN VERDE. Y con razón — en el
   * camino feliz la columna ya contiene el hash del texto, así que copiar y calcular dan lo mismo y
   * la prueba no podía distinguirlos. Medía el valor correcto sin medir la propiedad.
   *
   * La propiedad que de verdad se quiere es la que el encabezado de `prompts.ts` viene defendiendo
   * desde el principio: **el hash es función del texto y no se le cree a la columna**. Se ejercita
   * torciendo la columna a mano —cualquier escritura futura que se olvide de actualizarla hace
   * exactamente esto— y comprobando que lo archivado sigue reproduciendo el texto.
   *
   * Lo que está en juego si se copiara: el lector recalcula el hash al resolver y descarta la fila
   * que no lo reproduce, así que una versión que SÍ está guardada se volvería irrecuperable. La
   * degradación de calcularlo es la segura; la de copiarlo, no. */
  await sinPrompts();
  const vieja = 'El texto verdadero, con un hash de columna que va a estar mal.';
  await conOrganizacion(esc.org, () => guardarPromptDelAgente('chat_pre_agenda', vieja, esc.quien));

  /* Se tuerce SOLO el hash. No dispara el archivador —su `when` mira el texto— así que esto deja la
     fila viva en el estado exacto que el encabezado de `prompts.ts` describe como posible. */
  await esc.admin.query(
    `update negocio.prompts_del_agente set prompt_hash = $1 where agente = 'chat_pre_agenda'`,
    ['0000000000000000'],
  );

  await conOrganizacion(esc.org, () =>
    guardarPromptDelAgente('chat_pre_agenda', 'La que la reemplaza.', esc.quien),
  );

  const h = await elHistorial();
  assert.equal(h.length, 1);
  assert.equal(
    h[0]?.prompt_hash,
    hashDelPrompt(vieja),
    'el archivador COPIÓ la columna torcida en vez de calcular el hash del texto: esa versión ya no ' +
      'se puede encontrar por hash, y el lector la va a descartar como si no estuviera guardada',
  );
  assert.notEqual(h[0]?.prompt_hash, '0000000000000000', 'se archivó el hash falso tal cual');
});

test('el hash archivado es función del TEXTO archivado, y resuelve el de un hallazgo', async () => {
  /* Para qué existe todo esto: dado el `prompt_hash` que un hallazgo viejo tiene sellado, poder
     recuperar el texto que corría. El hash lo calcula la BASE del texto de la fila archivada, no se
     copia de la columna vieja — copiarla propagaría un hash que ya podía estar torcido, y el lector,
     que verifica, convertiría una versión guardada en un «no se encontró». */
  await sinPrompts();
  const vieja = 'El texto por el que un hallazgo va a preguntar.';
  await conOrganizacion(esc.org, () => guardarPromptDelAgente('chat_pre_agenda', vieja, esc.quien));
  await conOrganizacion(esc.org, () =>
    guardarPromptDelAgente('chat_pre_agenda', 'Otra cosa completamente distinta.', esc.quien),
  );

  const h = await elHistorial();
  assert.equal(
    h[0]?.prompt_hash,
    hashDelPrompt(vieja),
    'el hash archivado no reproduce el del texto archivado: un hallazgo viejo no lo va a encontrar',
  );
});
