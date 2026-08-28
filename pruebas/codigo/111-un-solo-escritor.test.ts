// UN SOLO escritor de `negocio.mensajes`, y las dos cosas que solo se ven leyendo. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTAS DOS GUARDAS SON DE CÓDIGO Y NO DE COMPORTAMIENTO
//
// El comportamiento de la regla del gemelo lo prueba `pruebas/base/33-gemelos.test.ts` contra la base,
// con ocho casos y sus mutaciones. Quedan dos cosas que **ninguna prueba de comportamiento puede
// atrapar**, y las dos sobrevivieron a la mutación — que es como se descubrieron:
//
// **1 · QUIÉN pasa `fijarPiso`.** `escribirMensajes` recibe la opción y la respeta; eso está probado.
// Lo que no se puede probar ejecutando es que el `POST` del chat pase `false`: mutar ese argumento a
// `true` dejó las ocho pruebas del gemelo en verde, porque ellas llaman a la función directamente y
// nunca pasan por la ruta.
//
// Y el defecto que eso deja es de los que no se pueden corregir después:
// `contactos.mensajes_desde_el` se escribe con `coalesce` —una vez y para siempre— y significa *«desde
// acá hacia adelante la conversación está completa»*. Con el chat fijándolo, un contacto al que le
// mandamos un mensaje sin haber leído nunca su conversación afirma tener una historia que no tiene, y
// el `coalesce` no vuelve a escribir jamás.
//
// **2 · EL ORDEN entre el `insert` del real y el `delete` del fabricado.** Su único síntoma es que el
// proceso se corte entre las dos operaciones, y eso no se provoca en una prueba. Pero la diferencia
// entre los dos órdenes es enorme:
//
//   · insert → delete: queda una fila repetida. Visible, molesta, y **recuperable**: la próxima
//     relectura de la conversación la limpia.
//   · delete → insert: **el mensaje desaparece de la conversación y no vuelve nunca**, porque el
//     fabricado ya no está y el real no se insertó.
//
// Un duplicado se arregla. Un mensaje perdido no se sabe que faltó. Así que el orden es la guarda, y
// se lee.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { archivosFuente } from '../apoyo/fuente.ts';

function limpio(ruta: string): string {
  const a = archivosFuente(['app', 'lib']).find((x) => x.ruta === ruta);
  assert.ok(a, `no se encontró ${ruta}`);
  return a.limpio;
}

const ESCRITOR = 'lib/negocio/mensajes.ts';

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · NADIE MÁS INSERTA EN `negocio.mensajes`
// ═══════════════════════════════════════════════════════════════════════════════

test('`negocio.mensajes` tiene UN solo escritor, y es el que dice serlo', () => {
  /* La afirmación que este trabajo vino a volver verdadera. `lib/negocio/ingesta.ts` abría diciendo
     *«EL único escritor de `negocio.mensajes`»* mientras el `POST` del chat insertaba directo — dos
     escritores, y uno de los dos afirmaba ser el único.

     Se busca la FORMA del insert y no una convención: cualquier archivo de `app/` o `lib/` que haga
     `insertInto('mensajes')` es un escritor, se llame como se llame. */
  const culpables = archivosFuente(['app', 'lib'])
    .filter((a) => a.ruta !== ESCRITOR)
    .filter((a) => /insertInto\(\s*['"`]mensajes['"`]\s*\)/.test(a.limpio))
    .map((a) => a.ruta);

  assert.deepEqual(
    culpables,
    [],
    'volvió a haber más de un escritor de `negocio.mensajes`. Un segundo escritor no puede aplicar la ' +
      'regla del gemelo, y el síntoma es un mensaje repetido en el chat sin ningún error: el ' +
      'identificador fabricado del chat NO puede colisionar con el real, así que el `unique` no salta',
  );

  // Y el que sí escribe, escribe: si el `insert` se fuera de ahí, la aserción de arriba pasaría en
  // vacío con CERO escritores y la aplicación no guardaría un solo mensaje.
  assert.match(
    limpio(ESCRITOR),
    /insertInto\(\s*['"`]mensajes['"`]\s*\)/,
    'el escritor único dejó de insertar: la aserción de arriba estaría pasando en vacío',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · QUIÉN PUEDE AFIRMAR LA FRONTERA DE COBERTURA
// ═══════════════════════════════════════════════════════════════════════════════

test('solo la ingesta pasa `fijarPiso: true`; el chat pasa `false`', () => {
  // Mutar el argumento del chat a `true` dejó las ocho pruebas del gemelo en verde. Por eso esto.
  const chat = limpio('app/api/contactos/[id]/mensajes/route.ts');
  assert.match(chat, /escribirMensajes\(/, 'el chat dejó de usar el escritor compartido');
  assert.match(
    chat,
    /\{\s*fijarPiso:\s*false\s*\}/,
    'el `POST` del chat pasa `fijarPiso: true`: manda UN mensaje, así que fijaría la frontera de ' +
      'cobertura con él y la ficha afirmaría tener una historia que no tiene. Y `mensajes_desde_el` ' +
      'se escribe con `coalesce`, o sea que no hay forma de corregirlo después',
  );
  assert.doesNotMatch(chat, /\{\s*fijarPiso:\s*true\s*\}/, 'el chat pasa `fijarPiso: true` en algún lugar');

  // Y la ingesta SÍ lo pasa: caminó la conversación entera hacia atrás, así que lo puede afirmar.
  assert.match(
    limpio('lib/negocio/ingesta.ts'),
    /\{\s*fijarPiso:\s*true\s*\}/,
    'la ingesta dejó de fijar la frontera: sin ella, una ficha sin mensajes no se distingue de una ' +
      'que nadie leyó, y las dos dirían «nunca escribió»',
  );

  /* Y NINGÚN otro llamador pasa `true`. Es la mitad que sobrevive a que aparezca un tercer escritor
     —el receptor del aviso del CRM es el siguiente— que copie el argumento del vecino equivocado. */
  const conPisoVerdadero = archivosFuente(['app', 'lib'])
    .filter((a) => a.ruta !== 'lib/negocio/ingesta.ts' && a.ruta !== ESCRITOR)
    .filter((a) => /\{\s*fijarPiso:\s*true\s*\}/.test(a.limpio))
    .map((a) => a.ruta);
  assert.deepEqual(
    conPisoVerdadero,
    [],
    'un llamador que no es la ingesta afirma que la conversación está completa desde su mensaje',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · EL ORDEN QUE SOLO SE VE SI EL PROCESO SE CORTA
// ═══════════════════════════════════════════════════════════════════════════════

test('el `insert` del real va ANTES del `delete` del fabricado', () => {
  /* Los dos órdenes funcionan igual mientras nada se corte, así que ninguna prueba de comportamiento
     los distingue. La diferencia aparece solo si el proceso muere en el medio, y ahí uno deja un
     duplicado recuperable y el otro **pierde el mensaje para siempre**.

     Se comprueba sobre la fuente sin comentarios: el encabezado de `mensajes.ts` explica esto mismo y
     nombra las dos operaciones, así que sobre el archivo crudo la prueba pasaría por el párrafo. */
  const src = limpio(ESCRITOR);

  const iInsert = src.indexOf("insertInto('mensajes')");
  const iDelete = src.indexOf("deleteFrom('mensajes')");
  assert.ok(iInsert >= 0, 'no hay `insert` en el escritor');
  assert.ok(iDelete >= 0, 'no hay `delete` del gemelo: la regla del fabricado→real desapareció');
  assert.ok(
    iInsert < iDelete,
    'el `delete` del fabricado quedó ANTES del `insert` del real. Si el proceso se corta entre los ' +
      'dos, el mensaje desaparece de la conversación y no vuelve nunca — mientras que con el orden ' +
      'correcto queda un duplicado, que la próxima relectura limpia',
  );

  /* Y la HERENCIA va antes del `delete`, por un motivo trivial y suficiente: después del `delete` el
     dato ya no está. Sin esto, el mensaje que escribió una persona pasa a decir que lo mandó el
     agente de IA — y eso no es una fila repetida, es una atribución falsa en el historial de una
     conversación con un cliente. */
  const iHerencia = src.indexOf('origen: viejo.origen');
  assert.ok(iHerencia >= 0, 'se fue la herencia de la atribución al reemplazar el gemelo');
  assert.ok(iHerencia < iDelete, 'la herencia quedó después del `delete`: el dato ya no existe ahí');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · EL VALOR `aviso` DEL `check` SIGUE SIN ESCRITOR, Y ESO SE DECLARA
// ═══════════════════════════════════════════════════════════════════════════════

test('`origen: aviso` lo escribe EXACTAMENTE un archivo, y es el receptor del CRM', () => {
  /* ════════════════════════════════════════════════════════════════════
     ESTA PRUEBA SE PUSO ROJA Y ERA LO QUE TENÍA QUE PASAR

     Su versión anterior se llamaba *«todavía NO lo escribe nadie»* y exigía una lista vacía, con este
     motivo escrito: *«si alguien lo escribe antes de que exista el receptor, esta prueba se pone roja
     y hay que venir a explicar por qué»*.

     El receptor existe. `origen: 'aviso'` estuvo en el `check` de `db/migraciones/013:113-115` desde
     el primer día **sin un solo escritor**, y ahora lo escribe `lib/negocio/avisoDelCrm.ts`.

     Lo que la prueba fija ahora es más fuerte que antes: que sea **exactamente uno**. Con dos, la
     columna `origen` deja de medir de dónde vino el mensaje y pasa a medir qué archivo lo escribió,
     que no es lo mismo y no sirve para nada.
     ════════════════════════════════════════════════════════════════════ */
  assert.match(
    limpio(ESCRITOR),
    /'ingesta'\s*\|\s*'propio'\s*\|\s*'aviso'/,
    'el tipo de `origen` dejó de admitir `aviso`: el receptor del CRM tendría que insertar por fuera',
  );

  const escriben = archivosFuente(['app', 'lib'])
    .filter((a) => /origen:\s*['"`]aviso['"`]/.test(a.limpio))
    .map((a) => a.ruta);
  assert.deepEqual(
    escriben,
    ['lib/negocio/avisoDelCrm.ts'],
    'cambió quién escribe el origen del aviso. Si son dos, la columna deja de medir de dónde vino el ' +
      'mensaje; si son cero, el receptor del aviso dejó de marcar sus filas y no hay forma de saber ' +
      'qué llegó por el webhook y qué por el sondeo',
  );

  /* Y ese archivo escribe por el escritor ÚNICO, no por su cuenta. Es lo que hace que la regla del
     gemelo se aplique a los mensajes del aviso — sin eso, cada mensaje entrante que llegue por
     webhook se duplica cuando el sondeo trae el mismo con su identificador real. */
  const receptor = limpio('lib/negocio/avisoDelCrm.ts');
  assert.match(receptor, /escribirMensajes\(/, 'el receptor del aviso no usa el escritor único');
  assert.doesNotMatch(
    receptor,
    /insertInto\(\s*['"`]mensajes['"`]\s*\)/,
    'el receptor del aviso inserta directo: es el tercer escritor, y no aplica la regla del gemelo',
  );

  /* Y NO toca la marca de agua ni el candado. Los dos serían errores concretos: el antirrebote
     significa «no correr», y para un aviso eso es descartar un cuerpo que YA llegó; y `marca_el` se
     escribe con `greatest(...)`, así que empujarla declararía ingerido todo lo anterior y saltearía en
     silencio las conversaciones que el sondeo no alcanzó. */
  assert.doesNotMatch(receptor, /conElPulso/, 'el receptor del aviso pasa por el candado de la ingesta');
  assert.doesNotMatch(receptor, /marca_el/, 'el receptor del aviso toca la marca de agua');
  assert.match(
    receptor,
    /fijarPiso:\s*false/,
    'el receptor fija la frontera de cobertura con UN mensaje: la ficha afirmaría una historia que no tiene',
  );
});
