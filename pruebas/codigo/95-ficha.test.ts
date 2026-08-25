// La ficha del contacto. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LOS TRES DEFECTOS QUE ESTE ARCHIVO IMPIDE, Y LOS TRES OCURRIERON
//
// **1 · Tres fichas mostrando tres cosas del mismo contacto.** El `02` regla 2 pide un solo
// componente y explica por qué: *"si hubiera tres, mostrarían tres cosas distintas del mismo
// contacto, y las tres parecerían correctas"*.
//
// **2 · Los seis íconos dibujados en cinco lugares con lógica distinta.** Medido en la
// implementación de referencia: el mismo contacto se veía «sin bot» en las listas y «IA activa» en
// la ficha. Uno contaba `count(*)` y el otro `count(*) where contestada`.
//
// **3 · La píldora concatenada a mano en seis puntos.** Los datos de ejemplo producían
// `Seguimiento · Dudando` y el registro real `SEGUIMIENTO · DUDANDO` **para el mismo estado**.
//
// Los tres tienen la misma forma: **dos lugares que calculan lo mismo**. Y los tres son invisibles
// mirando la pantalla, porque cada vitrina por separado parece correcta.
//
// Y una cuarta, que es de este repositorio: **un control que parece funcionar y no hace nada.** El
// panel de la ficha estuvo en producción con cinco pestañas sin manejador y un botón «Avanzar →»
// inerte. Ya se quitaron dos controles por esto —el «Reportar un problema» y cuatro botones del
// menú de cuenta— con el criterio escrito: es peor que su ausencia.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { archivosFuente } from '../apoyo/fuente.ts';
import { armarPildora } from '../../lib/negocio/pildora.ts';

function fuente(ruta: string): string {
  const a = archivosFuente(['app', 'components', 'lib']).find((x) => x.ruta === ruta);
  assert.ok(a, `no se encontró ${ruta}`);
  return a.limpio;
}

// ─── La píldora, que es una función pura ────────────────────────────────────

test('la píldora se arma en un solo lugar, y no inventa lo que no sabe', () => {
  // El formato del `02` § 2: `CATEGORÍA · SUBCATEGORÍA`, todo en mayúsculas.
  assert.equal(
    armarPildora({ situacion: 'seguimiento', detalle: 'Muy interesado' })?.texto,
    'SEGUIMIENTO · MUY INTERESADO',
  );
  // La venta lleva TRES piezas, y las dos últimas son opcionales por separado.
  assert.equal(
    armarPildora({ situacion: 'venta', formaPago: 'Contado', monto: '100' })?.texto,
    'VENTA · CONTADO · $100',
  );
  assert.equal(armarPildora({ situacion: 'venta', monto: '5000' })?.texto, 'VENTA · $5000');
  assert.equal(armarPildora({ situacion: 'venta', formaPago: 'Cuotas' })?.texto, 'VENTA · CUOTAS');

  // SIN SUBCATEGORÍA NO SE INVENTA UNA: queda solo la categoría. Rellenarla con un valor de
  // reserva sería afirmar algo que nadie registró.
  assert.equal(armarPildora({ situacion: 'nurture' })?.texto, 'NURTURE');
  assert.equal(armarPildora({ situacion: 'seguimiento', detalle: '   ' })?.texto, 'SEGUIMIENTO');

  // SIN RESULTADO NO HAY PÍLDORA. Es el `11` § 9 regla 1: no está «en ningún estado», está sin
  // medir, y la pantalla no dibuja nada.
  assert.equal(armarPildora({ situacion: 'sin_resultado' }), null);

  // Un monto ilegible NO se muestra, en vez de aparecer como `$NaN` sobre un contacto real.
  assert.equal(armarPildora({ situacion: 'acuerdo_sin_pago', monto: 'ochomil' })?.texto, 'ACORDÓ COMPRAR');

  // Y la decisión de vocabulario que se tomó a mano: gana el nombre del botón que se aprieta.
  assert.equal(armarPildora({ situacion: 'no_interesa' })?.texto, 'NO LE INTERESA');
});

test('el acuerdo lleva el monto y NO la forma de pago', () => {
  // La plata de un acuerdo es una promesa, no un pago, así que todavía no hay forma de pago que
  // registrar. Si esta rama tomara `formaPago`, la píldora afirmaría un cobro que no ocurrió.
  const p = armarPildora({ situacion: 'acuerdo_sin_pago', monto: '5000', formaPago: 'Contado' });
  assert.equal(p?.texto, 'ACORDÓ COMPRAR · $5000');
  assert.doesNotMatch(String(p?.texto), /CONTADO/);
});

// ─── Un solo lugar por cosa ─────────────────────────────────────────────────

test('ningún componente tiene su propio diccionario de situaciones', () => {
  // El defecto 3 del encabezado. Se busca la FORMA del diccionario —una clave de salida seguida de
  // un texto— y no la palabra: lo que hay que impedir es que alguien vuelva a escribir el mapeo,
  // no que mencione una salida.
  const malos: string[] = [];
  for (const a of archivosFuente(['components'])) {
    if (/\bno_interesa\s*:\s*\{/.test(a.limpio) || /\bacuerdo_sin_pago\s*:\s*\{/.test(a.limpio)) {
      malos.push(a.ruta);
    }
  }
  assert.deepEqual(
    malos,
    [],
    'volvió un diccionario de situaciones a un componente. La píldora la arma el servidor y viaja ' +
      'en `fila.pildora`: con dos lugares que formatean, la fila y la ficha dicen cosas distintas ' +
      'del mismo estado y las dos parecen correctas',
  );

  // Y la comprobación de entrada muerta: el diccionario tiene que existir EN UN lugar. Sin esto,
  // borrar `pildora.ts` entero dejaría la prueba de arriba en verde.
  assert.match(
    fuente('lib/negocio/pildora.ts'),
    /no_interesa:\s*\{/,
    'el catálogo de categorías de la píldora no está donde debería',
  );
});

test('la ficha y la fila dibujan los seis íconos con el MISMO componente', () => {
  const ficha = fuente('components/negocio/Ficha.jsx');
  // Lo importa, no lo redefine.
  assert.match(ficha, /import\s*\{\s*SeisIconos\s*\}\s*from\s*'\.\/Fila\.jsx'/, 'la ficha no importa `SeisIconos`');
  assert.match(ficha, /<SeisIconos\b/, 'la ficha no dibuja los seis íconos');

  // Y NO tiene su propia lista de iconos ni su propio mapa de colores del agente: son las dos
  // piezas que divergirian primero, y su duplicacion es el defecto 2 del encabezado.
  //
  // Se busca `reunionesTenidas`, que es la clave del PRIMER icono y no aparece en ningun otro
  // contexto. La primera version de esta linea buscaba `glifo:` y era un falso positivo: las cinco
  // pestanas de la ficha tambien tienen glifo, legitimamente. Una prueba que falla sobre codigo
  // correcto es una prueba que se termina borrando.
  assert.doesNotMatch(
    ficha,
    /reunionesTenidas|llamadasContestadas/,
    'la ficha tiene su propia lista de los seis iconos',
  );
  assert.doesNotMatch(
    ficha,
    /atendiendo_pre_agenda/,
    'la ficha tiene su propio mapa de estados del agente',
  );

  // Y `SeisIconos` está exportado en un solo archivo.
  const donde = archivosFuente(['components'])
    .filter((a) => /export function SeisIconos/.test(a.limpio))
    .map((a) => a.ruta);
  assert.deepEqual(donde, ['components/negocio/Fila.jsx'], 'hay más de una implementación de los seis íconos');
});

test('la píldora del encabezado es la MISMA que la de la fila', () => {
  // El espejo del `02` § 2, y acá se puede afirmar de verdad: las dos leen el mismo campo del
  // mismo objeto. Si una lo derivara, esta prueba no lo vería — por eso además se prohíbe el
  // diccionario en la prueba de arriba.
  for (const ruta of ['components/negocio/Fila.jsx', 'components/negocio/Ficha.jsx']) {
    assert.match(
      fuente(ruta),
      /\.pildora\b/,
      `${ruta} no lee la píldora armada: si la calcula, puede decir algo distinto del otro lado`,
    );
  }
});

// ─── La ficha, como panel ───────────────────────────────────────────────────

test('la ficha NUNCA navega', () => {
  // El `02` § 1 regla 1: es un panel que se superpone, no una pantalla. *"Si navegara, atender diez
  // contactos de una cola serían veinte navegaciones y diez pérdidas de scroll."*
  const ficha = fuente('components/negocio/Ficha.jsx');
  assert.doesNotMatch(ficha, /location\.href\s*=/, 'la ficha navega asignando `location.href`');
  assert.doesNotMatch(ficha, /location\.assign|location\.replace/, 'la ficha navega');
  assert.doesNotMatch(ficha, /useRouter|router\.push/, 'la ficha navega con el enrutador');
  // `window.open` sí está permitido: abre el CRM en OTRA pestaña, y eso no es navegar — la ficha
  // sigue abierta detrás.
  assert.match(ficha, /window\.open\(/, 'desapareció el enlace al CRM');
});

test('ningún control de la ficha está inerte', () => {
  // La cuarta forma del encabezado, y la que este repositorio ya pagó dos veces. Todo `<button` de
  // la ficha tiene que llevar un manejador; si no lo lleva, es un control que se puede apretar y no
  // cumple — peor que su ausencia.
  const ficha = fuente('components/negocio/Ficha.jsx');
  const botones = [...ficha.matchAll(/<button[\s\S]*?>/g)].map((m) => m[0]);
  assert.ok(botones.length > 0, 'la ficha no tiene ningún botón: ¿se dibuja algo?');
  const inertes = botones.filter((b) => !/onClick=/.test(b));
  assert.deepEqual(
    inertes.map((b) => b.replace(/\s+/g, ' ').slice(0, 70)),
    [],
    'hay un botón sin manejador en la ficha. El panel del prototipo estuvo en producción con cinco ' +
      'pestañas sin listener y un «Avanzar →» que no hacía nada',
  );
});

test('el cascarón inerte del prototipo no volvió', () => {
  // `Overlays.jsx` tenía el panel entero portado y sin JavaScript. Dos elementos `.cw` en el árbol
  // —uno inerte y otro real— con ids duplicados harían que un `getElementById` eligiera el
  // equivocado, y nadie sabría cuál manda.
  const overlays = fuente('components/Overlays.jsx');
  for (const id of ['cwPanel', 'cwBody', 'cwTabs', 'cwScrim', 'cwAdvance']) {
    assert.doesNotMatch(overlays, new RegExp(`id="${id}"`), `volvió \`#${id}\` a Overlays.jsx`);
  }
  // Y la ficha real usa las clases del prototipo, que es lo que permite no escribir CSS nuevo.
  const ficha = fuente('components/negocio/Ficha.jsx');
  for (const clase of ['cw on', 'cw-h', 'cw-tabs', 'cw-body', 'cw-meta']) {
    assert.ok(ficha.includes(clase), `la ficha dejó de usar la clase \`${clase}\` del prototipo`);
  }
});

// ─── Las cinco pestañas ─────────────────────────────────────────────────────

test('las cinco pestañas piden la MISMA capacidad, y es la de la ficha', () => {
  // `ADR-0304`: son UNA pantalla. Si una pidiera algo distinto, esa pestaña se vería vacía para
  // alguien que ve las otras cuatro, y no habría forma de darse cuenta mirando.
  for (const camino of ['mensajes', 'llamadas', 'perfil', 'historial', 'notas']) {
    assert.match(
      fuente(`app/api/contactos/[id]/${camino}/route.ts`),
      /exigir\(peticion, \['contactos\.ver'\]\)/,
      `la pestaña ${camino} no pide \`contactos.ver\``,
    );
  }
  // Y la ficha misma.
  assert.match(fuente('app/api/contactos/[id]/route.ts'), /exigir\(peticion, \['contactos\.ver'\]\)/);

  // Escribir una nota es OTRA capacidad, y eso no rompe la regla: el defecto que `ADR-0304`
  // previene es de lecturas —*"una sección con datos y cuatro en blanco"*—, y un botón que no está
  // no es un panel vacío.
  assert.match(
    fuente('app/api/contactos/[id]/notas/route.ts'),
    /exigir\(peticion, \['contactos\.comentar'\]\)/,
    'escribir una nota no pide `contactos.comentar`',
  );
});

test('cada pestaña se pide al ABRIRLA, no al abrir la ficha', () => {
  // El `02` § 4: traer las cinco de una serían cuatro llamadas para pantallas que nadie va a
  // mirar. La forma comprobable es que el efecto que pide dependa de la pestaña activa.
  const ficha = fuente('components/negocio/Ficha.jsx');
  assert.match(
    ficha,
    /\}, \[activa, contactoId, pestanas, situacion\]\)/,
    'el pedido de la pestaña dejó de depender de cuál está activa: o se piden las cinco al abrir, ' +
      'o se pide siempre la misma',
  );
  // Y una vez pedida se queda: el `04` § 5 dice que ninguna de las otras cuatro tiene reloj.
  assert.match(
    ficha,
    /if \(pestanas\[activa\] !== undefined\) return undefined;/,
    'la pestaña se vuelve a pedir cada vez que se la abre',
  );
});

test('un fallo de una pestaña no se muestra como «no hay nada»', () => {
  // El `05` § 8: *"un dato que no se pudo traer y un dato que dice cero no son el mismo hecho, y no
  // pueden verse igual"*. Una lista que se vacía al fallar hace creer que se borró la conversación.
  const ficha = fuente('components/negocio/Ficha.jsx');
  assert.match(ficha, /error:/, 'la ficha no distingue un fallo de una lista vacía');
  assert.match(ficha, /if \(p\.error\)/, 'la ficha no dibuja el fallo aparte del vacío');

  // Y del lado del servidor, lo mismo con `falta`: una lista vacía viene acompañada de POR QUÉ.
  const ficha_ts = fuente('lib/negocio/ficha.ts');
  assert.match(ficha_ts, /falta: string \| null/, 'las pestañas no dicen qué falta medir');
});

test('el chat pide los 200 mensajes DESCENDENTES y los da vuelta', () => {
  // El `03` § 1 nombra este error y lo llama *"una línea que no falla nunca y rompe la pantalla en
  // cuanto una conversación crece"*: con `ascendente + limit 200` se guardan los 200 más VIEJOS, o
  // sea el arranque de la conversación, escondiendo lo reciente — que es lo que alguien abrió a ver.
  const t = fuente('lib/negocio/ficha.ts');
  const bloque = t.slice(t.indexOf('mensajesDeLaFicha'), t.indexOf('llamadasDeLaFicha'));
  assert.match(bloque, /orderBy\('enviado_el', 'desc'\)/, 'el chat pide los mensajes ascendentes');
  assert.match(bloque, /\.reverse\(\)/, 'el chat no da vuelta la lista: mostraría lo más nuevo arriba');
});
