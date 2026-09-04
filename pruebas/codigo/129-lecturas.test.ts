// La memoria de lo ya traído: la clave, la frescura, y quién puede usarla. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE SE PERSIGUE ACÁ ES QUE UNA EMPRESA VEA LOS DATOS DE OTRA
//
// `lib/lecturas.ts` es **la primera memorización del proyecto**, y `ADR-0703` es una fila
// INNEGOCIABLE: *toda memorización incluye la organización efectiva*. Hasta ahora esa fila se
// cumplía por ausencia — no había nada que auditar.
//
// El modo de falla no se ve en ninguna pantalla: la caché funcionaría igual, con datos de otra
// empresa adentro. Nada falla, nada avisa, y lo que se ve es plausible.
//
// ── POR QUÉ ESTO SE PRUEBA GUARDANDO Y LEYENDO, Y NO MIRANDO EL CÓDIGO ─────
//
// `pruebas/codigo/70-publicacion.test.ts` afirma sobre la FUENTE que la clave lleva la empresa, y
// hace falta —cubre que nadie arme una clave por su cuenta—. Pero una expresión correcta y una
// función que la ignore se ven igual desde afuera.
//
// Por eso este archivo importa el módulo y lo usa. Se pudo hacer porque la primitiva **no importa
// React**: los hooks viven aparte, en `lib/usarLectura.ts`, y ésa fue la razón de partirlo — Node
// no sabe importar el `.tsx` de la sesión, así que con todo junto no había forma de comprobar
// nada de verdad.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import {
  claveDeLectura,
  estaFresco,
  guardar,
  leerGuardado,
  olvidar,
} from '../../lib/lecturas.ts';
import { CADENCIA } from '../../lib/cadencia.ts';

const UNA = '11111111-1111-4111-8111-111111111111';
const OTRA = '22222222-2222-4222-8222-222222222222';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');

/** Sin comentarios: la lección de `110`, `120`, `123`, `127` y `128`, ya pagada cinco veces. */
const codigo = (r: string): string =>
  leer(r)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/{\/\*[\s\S]*?\*\/}/g, '');

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · EL AISLAMIENTO ENTRE EMPRESAS, GUARDANDO Y LEYENDO
// ═══════════════════════════════════════════════════════════════════════════════

test('lo guardado por una empresa NO se lee desde la otra', async () => {
  /* `ADR-0703`, comprobada por comportamiento. El mismo camino y dos empresas: si la clave no
     llevara la empresa, la segunda leería el tablero de la primera — y en un superadmin visitando
     la cuenta de un cliente eso son los datos de otra empresa en pantalla. */
  const camino = '/api/closer/pipeline';
  guardar(claveDeLectura(UNA, camino), { columnas: ['de la primera'] });

  assert.deepEqual(leerGuardado(claveDeLectura(UNA, camino))?.valor, {
    columnas: ['de la primera'],
  });
  assert.equal(
    leerGuardado(claveDeLectura(OTRA, camino)),
    null,
    'la otra empresa lee lo guardado por la primera',
  );

  // Y al revés: guardar en la segunda no pisa la primera.
  guardar(claveDeLectura(OTRA, camino), { columnas: ['de la segunda'] });
  assert.deepEqual(leerGuardado(claveDeLectura(UNA, camino))?.valor, {
    columnas: ['de la primera'],
  });

  olvidar(claveDeLectura(UNA, camino));
  olvidar(claveDeLectura(OTRA, camino));
});

test('la clave no se puede falsificar desde el camino', () => {
  /* El separador es un salto de línea porque no puede aparecer ni en un uuid ni en una URL. Con
     `:` o `/`, un camino que lo contuviera podría producir la clave de OTRA empresa: la de
     `(A, 'x')` y la de `(A + separador + 'x', '')` serían la misma cadena.

     No es paranoia gratuita: los caminos de esta aplicación se arman con plantillas —`?verComo=`,
     `?dias=`, `?pagina=`— y el día que uno lleve un valor que venga del servidor, el separador es
     lo único que separa. */
  assert.notEqual(claveDeLectura(UNA, '/x'), claveDeLectura(OTRA, '/x'));
  assert.notEqual(claveDeLectura(`${UNA}/y`, '/x'), claveDeLectura(UNA, '/y/x'));
  assert.notEqual(claveDeLectura(`${UNA}:y`, '/x'), claveDeLectura(UNA, ':y/x'));
  // Y la empresa está adentro, que es la fila.
  assert.ok(claveDeLectura(UNA, '/x').includes(UNA));
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · LA PRIMITIVA
// ═══════════════════════════════════════════════════════════════════════════════

test('leer algo que no se guardó devuelve `null`, no un valor vacío', () => {
  /* Es la distinción que este repositorio persigue en todas sus pantallas: un cero medido y un cero
     no medido no son el mismo hecho. Con `{}` o `[]` de reserva, la pantalla no podría distinguir
     «no hay nada guardado, hay que pedir» de «se pidió y vino vacío» — y se quedaría sin pedir. */
  assert.equal(leerGuardado(claveDeLectura(UNA, '/nunca-guardado')), null);
});

test('olvidar lo saca, y volver a leerlo devuelve `null`', () => {
  /* `olvidar` es lo que corre después de escribir. Si dejara el valor, la pantalla mostraría el
     tablero de antes del Avanzar: una escritura que no invalida es la única forma en que esta caché
     miente. */
  const c = claveDeLectura(UNA, '/para-olvidar');
  guardar(c, { a: 1 });
  assert.ok(leerGuardado(c));
  olvidar(c);
  assert.equal(leerGuardado(c), null, 'olvidar no borró nada');
});

test('lo guardado trae CUÁNDO, y la frescura se mide con eso', () => {
  /* Sin la hora no se puede decidir si sirve, y entonces la caché o no refresca nunca o refresca
     siempre — los dos extremos que la ventana existe para evitar. */
  const c = claveDeLectura(UNA, '/con-hora');
  const antes = Date.now();
  guardar(c, { a: 1 });
  const g = leerGuardado(c);
  assert.ok(g);
  assert.ok(g.cuando >= antes, 'la hora guardada es anterior a haber guardado');

  assert.equal(estaFresco(g.cuando), true, 'lo que se acaba de guardar no está fresco');
  // Un segundo antes del borde: fresco. Un segundo después: no.
  assert.equal(estaFresco(Date.now() - (CADENCIA.lecturas - 1_000)), true);
  assert.equal(estaFresco(Date.now() - (CADENCIA.lecturas + 1_000)), false);
  olvidar(c);
});

test('la ventana por omisión es la cadencia de operación, y se puede acotar', () => {
  /* Diez segundos no es un número elegido: es `CADENCIA.operacion`, así que volver a una pestaña
     **nunca muestra algo más viejo de lo que esa pantalla ya mostraba** entre dos tics de su reloj.
     Se afirma la igualdad y no el 10.000 para que mover una mueva la otra. */
  assert.equal(CADENCIA.lecturas, CADENCIA.operacion);
  // Y una ventana propia se respeta: con cero, nada está fresco.
  assert.equal(estaFresco(Date.now(), 0), false);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · LAS PANTALLAS: QUE LA USEN, Y QUE INVALIDEN AL ESCRIBIR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Las pantallas que se desmontan al cambiar de sub-pestaña y ya tienen memoria.
 *
 * `Credenciales` y `Usuarios` **faltan a propósito**, y el motivo está en el mensaje de abajo.
 */
const CON_MEMORIA: readonly string[] = [
  'components/closer/Pipeline.jsx',
  'components/closer/Agenda.jsx',
  'components/negocio/ListaDeContactos.jsx',
  'components/ajustes/Empresas.jsx',
];

test('las pantallas que se remontan usan la memoria, y ninguna se quedó con su `yaPedido`', () => {
  /* Las dos mitades. Que la usen, y que **no les haya quedado el mecanismo viejo**: un `yaPedido`
     sobreviviente junto al hook significa dos fuentes de verdad sobre si ya se pidió, y ahí se
     esconde una petición doble en cada montaje.

     `ListaDeContactos` es la excepción y conserva el suyo: acumula páginas, así que guarda su
     estado con la primitiva en vez del hook, y ese `ref` sigue siendo lo que evita pedir dos veces.
     Está dicho en su propio comentario. */
  for (const archivo of CON_MEMORIA) {
    const fuente = codigo(archivo);
    assert.match(
      fuente,
      /from '(\.\.\/)+lib\/(usarLectura|lecturas)\.ts'/,
      `${archivo} no usa la memoria de lecturas: va a volver a pedir en cada montaje`,
    );
  }

  // El `yaPedido` sobreviviente, salvo en la que lo necesita.
  const conRef = CON_MEMORIA.filter((a) => /yaPedido/.test(codigo(a)));
  assert.deepEqual(
    conRef,
    ['components/negocio/ListaDeContactos.jsx'],
    'una pantalla se quedó con su `yaPedido` al lado del hook: son dos fuentes de verdad sobre si ' +
      'ya se pidió',
  );
});

test('el hook lee la caché en el PRIMER render, no en un efecto', () => {
  /* Ésta es la línea que decide si el arreglo sirve. En un efecto habría un render con «Cargando»
     en el medio, o sea **el parpadeo que todo esto vino a sacar** — y no fallaría ninguna prueba de
     comportamiento, porque el dato final es el mismo.

     Se afirma que el estado inicial sale de lo guardado. */
  const hooks = codigo('lib/usarLectura.ts');
  assert.match(
    hooks,
    /const guardadoAlMontar = clave === null \? null : leerGuardado<T>\(clave\);/,
    'el hook dejó de leer lo guardado en el primer render',
  );
  assert.match(
    hooks,
    /useState<T \| null>\(guardadoAlMontar\?\.valor \?\? null\)/,
    'el estado inicial ya no sale de lo guardado',
  );
  assert.match(
    hooks,
    /guardadoAlMontar \? 'listo' : 'cargando'/,
    'con algo guardado el hook sigue arrancando en «cargando»: el parpadeo vuelve',
  );
});

test('el hook GUARDA lo que trae, y antes de mirar si sigue montado', () => {
  /* ── EL HUECO QUE UNA MUTACIÓN ENCONTRÓ ──────────────────────────────────
   *
   * Se comprobaba que el hook LEE lo guardado y no que lo ESCRIBA. Borrar el `guardar(…)`
   * sobrevivía: la caché queda vacía para siempre, cada entrada vuelve a pedir, y **la función
   * entera deja de hacer nada** sin que falle una sola prueba ni se vea distinto de antes.
   *
   * ── Y GUARDA ANTES DE MIRAR SI SIGUE VIVO ───────────────────────────────
   *
   * Ése es el caso que esta caché existe para aprovechar: se entra al Pipeline, se cambia de
   * sub-pestaña antes de que llegue la respuesta, y el dato llega igual. Guardándolo después del
   * `if (!vivo)` se tiraría justo la lectura que la próxima visita iba a usar. */
  const hooks = codigo('lib/usarLectura.ts');
  const guarda = hooks.indexOf('guardar(clave, r.datos)');
  const vivo = hooks.indexOf('if (!vivo.current) return;');

  assert.ok(guarda > 0, 'el hook no guarda lo que trae: la caché queda vacía y todo esto no hace nada');
  assert.ok(vivo > 0, 'se fue la guarda de desmontaje');
  assert.ok(
    guarda < vivo,
    'el hook guarda DESPUÉS de mirar si sigue montado: se tira la lectura que llega tarde, que es ' +
      'justo la que la próxima visita iba a usar',
  );
});

test('teniendo datos, la pantalla NO se vacía — ni cuando la recarga falla', () => {
  /* La regla que `CloserView` aprendió midiendo: poner «cargando» en una recarga reemplaza el
     cuerpo entero y **se lleva puesta la ficha abierta**, así que volver a la pestaña la cerraba. Y
     `Credenciales` la aprendió peor: la pantalla se vaciaba, desmontaba el aviso del CRM, y el
     secreto recién rotado se perdía para siempre.

     Vive en el hook para que las cuatro pantallas la tengan sin copiarla. */
  const hooks = codigo('lib/usarLectura.ts');
  assert.match(
    hooks,
    /setSituacion\(\(antes\) => \(antes === 'listo' \? antes : r\.tipo\)\);/,
    'el hook vacía la pantalla cuando falla una recarga',
  );
});

test('lo que se escribe invalida: cada recarga después de escribir pasa por `refrescar`', () => {
  /* **Una escritura que no invalida es la única forma en que esta caché miente.** Cerrar la ficha
     después de un Avanzar, traer citas del calendario, crear una empresa: los tres cambian justo lo
     que la pantalla de atrás muestra, y con la ventana de frescura respetada se vería el estado de
     antes hasta diez segundos.

     `refrescar` tira lo guardado ANTES de pedir, y eso es lo que se afirma. */
  assert.match(
    codigo('lib/usarLectura.ts'),
    /const refrescar = useCallback\(async \(\) => {\s*if \(clave !== null\) olvidar\(clave\);/,
    '`refrescar` dejó de invalidar antes de pedir: respetaría la ventana y mostraría lo viejo',
  );

  /* Y ninguna de las pantallas del hook conserva una recarga que NO invalide. Se busca `cargar(`,
     que es el nombre que tenía el mecanismo viejo: si sobrevive junto al hook, hay un camino que
     recarga sin tirar lo guardado. */
  /* Se busca la DECLARACIÓN y no la llamada. Buscando `void cargar()`, una mutación que dejara un
     `const cargar = …` sin llamarlo pasaba por delante — y un `cargar` declarado es un camino de
     recarga que alguien va a usar, aunque hoy no lo use nadie. */
  for (const archivo of ['components/closer/Pipeline.jsx', 'components/ajustes/Empresas.jsx']) {
    assert.doesNotMatch(
      codigo(archivo),
      /(const|let|function)\s+cargar\b/,
      `${archivo} conserva una recarga propia al lado del hook: es un camino que no invalida la ` +
        'caché, y son dos fuentes de verdad sobre cómo se recarga esa pantalla',
    );
  }
});

test('la lista de contactos guarda las PÁGINAS ACUMULADAS, no solo la primera', () => {
  /* ── EL OTRO HUECO QUE UNA MUTACIÓN ENCONTRÓ ─────────────────────────────
   *
   * Esta pantalla acumula: lo que muestra es la página 0 más las que se pidieron con «Ver más». Si
   * solo se guardara la carga inicial, volver a la pestaña **recortaría la lista** — y eso es peor
   * que el «Cargando» que todo esto vino a sacar, porque se ve como una lista completa que se
   * acortó sola. Nadie reporta filas que no sabe que faltan.
   *
   * Se afirman los DOS guardados y lo que lleva cada uno: la carga inicial **reinicia** la
   * acumulación —`pagina: 0`, o al volver habría filas repetidas— y la paginación guarda la lista
   * junta con su número de página. */
  const lista = codigo('components/negocio/ListaDeContactos.jsx');

  assert.match(
    lista,
    /guardar\(clave, { filas: traidas, hayMas: mas, pagina: 0 }\)/,
    'la carga inicial no guarda, o no reinicia la página: volver mostraría filas repetidas',
  );
  assert.match(
    lista,
    /guardar\(clave, { filas: juntas, hayMas: mas, pagina: siguiente }\)/,
    '«Ver más» no guarda las páginas acumuladas: volver a la pestaña recortaría la lista a la ' +
      'primera página',
  );
});

test('las dos pantallas de Ajustes que faltan están dichas, no olvidadas', () => {
  /* `Credenciales` y `Usuarios` se desmontan igual y muestran el mismo «Cargando», y no se
     migraron. El motivo, para que sea una decisión y no un olvido:

       · **`Credenciales` ya tiene la regla** de no vaciar la pantalla, con su propio `yaHayDatos`,
         así que lo único que ganaría es el parpadeo al entrar — en una pantalla que se abre de vez
         en cuando. Y su `cargar` es la función que aprendió el defecto más caro del repositorio:
         vaciar la pantalla **destruía el secreto del aviso del CRM** recién rotado. Tocarla por una
         mejora cosmética es un mal cambio.
       · **`Usuarios` carga dos cosas** —las personas y las empresas— y relee después de escribir.
         El hook memoriza UNA respuesta.

     Lo que esta prueba fija es que sigan teniendo la regla que sí tienen, para que migrarlas después
     sea una mejora y no un arreglo. */
  assert.match(
    codigo('components/ajustes/Credenciales.jsx'),
    /if \(!yaHayDatos\.current\) setSituacion\('cargando'\);/,
    '`Credenciales` perdió la regla de no vaciar la pantalla, que es la que protege el secreto',
  );
});
