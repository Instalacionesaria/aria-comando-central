// Lo que la memoria de lecturas puede ROMPER, y no rompe. Tipo: Código.
//
// ══════════════════════════════════════════════════════════════════════════════
// ESTE ARCHIVO SALIÓ DE UNA REVISIÓN, NO DE UN DISEÑO
//
// `lib/lecturas.ts` y `lib/usarLectura.ts` se escribieron con 19 mutaciones muertas y toda la
// suite en verde, y aun así tenían cuatro defectos que ninguna prueba veía. Los cuatro comparten
// una forma: **solo se ven ejecutando**, y ninguno rompe nada visible.
//
//   1. Una cadena de peticiones al API que no para sola, por una dependencia inestable.
//   2. Un refresco fallido INVISIBLE: el tablero viejo con cara de actual.
//   3. Un pulso fallido que vaciaba la lista de contactos y cerraba la ficha abierta.
//   4. Volver a Contactos recortando la lista de sesenta filas a veinte.
//
// Ninguno lo habría encontrado una mutación de las que se hicieron, porque las mutaciones
// comprueban lo que las pruebas afirman y **esto no lo afirmaba nadie**. De ahí este archivo.
// ══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');

/** Sin comentarios: la lección de `110`, `120`, `123`, `127`, `128`, `129` y `130`. */
const codigo = (r: string): string =>
  leer(r)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/{\/\*[\s\S]*?\*\/}/g, '');

const HOOK = 'lib/usarLectura.ts';
const LISTA = 'components/negocio/ListaDeContactos.jsx';
const AVISO = 'components/negocio/AvisoDesactualizado.jsx';

/** Las cuatro pantallas que viven de la memoria de lecturas. */
const PANTALLAS = [
  'components/closer/Pipeline.jsx',
  'components/closer/Agenda.jsx',
  'components/ajustes/Empresas.jsx',
  LISTA,
];

// ══════════════════════════════════════════════════════════════════════════════
// 1 · LA CADENA DE PETICIONES QUE NO PARABA SOLA
// ══════════════════════════════════════════════════════════════════════════════

test('ninguna OPCIÓN entra en las dependencias de `traer` ni de `refrescar`', () => {
  /* ────────────────────────── EL DEFECTO, TAL COMO PASÓ ──────────────────────────
   *
   * `motivos = {}` es un valor por omisión de desestructuración: cuando el llamador no lo pasa —y el
   * Pipeline y la Agenda no lo pasaban— ese `{}` es un objeto NUEVO en cada render. Estaba en las
   * dependencias de `traer`, así que `traer` cambiaba de identidad en cada render, y con él
   * `refrescar`.
   *
   * Y `refrescar` es lo que las pantallas ponen en las dependencias de SUS efectos, así que el
   * efecto del pulso corría en cada render en vez de cuando cambia el pulso: render → efecto →
   * petición → `setDatos` con un objeto nuevo de `respuesta.json()` → render. Sin fin, contra el
   * API de producción, y borrando su propia entrada en cada vuelta porque `refrescar` empieza con
   * `olvidar`.
   *
   * Lo que decide si hay que volver a pedir son el `camino` y la `clave`, y las dos son CADENAS —
   * se comparan por valor. Todo lo demás es ajuste y va por un ref. */
  const fuente = codigo(HOOK);

  const deTraer = fuente.match(/}, \[camino, clave\]\);/);
  assert.ok(
    deTraer,
    'las dependencias de `traer` dejaron de ser exactamente `[camino, clave]`: si entró algo que se ' +
      'compara por identidad, `refrescar` cambia en cada render y el efecto del pulso pide sin parar',
  );

  /* Y NINGUNA lista de dependencias del archivo nombra una opción. Escrito solo como la afirmación
     de arriba, agregar una opción nueva a OTRO `useCallback` estrenaría el mismo defecto. */
  for (const deps of fuente.match(/}, \[[^\]]*\];/g) ?? []) {
    for (const opcion of ['motivos', 'sinRespuesta', 'frescura', 'opciones']) {
      assert.ok(
        !new RegExp(`\\b${opcion}\\b`).test(deps),
        `\`${opcion}\` entró en unas dependencias (${deps}): las opciones se comparan por ` +
          'identidad y disparan una cadena de peticiones que no para sola',
      );
    }
  }

  // El ref existe y se actualiza en cada render, que es lo que reemplazó a las dependencias.
  assert.match(fuente, /const ajustes = useRef\({ sinRespuesta, frescura, motivos }\);/);
  assert.match(fuente, /ajustes\.current = { sinRespuesta, frescura, motivos };/);
});

// ══════════════════════════════════════════════════════════════════════════════
// 2 · UN REFRESCO FALLIDO TIENE QUE VERSE
// ══════════════════════════════════════════════════════════════════════════════

test('toda pantalla que use la memoria dibuja el aviso de desactualizado', () => {
  /* ────────────────────────── EL DEFECTO, TAL COMO PASÓ ──────────────────────────
   *
   * El hook mantiene `situacion` en `'listo'` cuando una recarga falla teniendo datos —esa es la
   * regla que impide vaciar la pantalla— y deja el motivo en `causa`. Su documentación prometía la
   * otra mitad: *«Lo que sí se hace es decirlo»*.
   *
   * No se decía. Las cuatro pantallas dibujaban `causa` únicamente dentro de
   * `if (situacion !== 'listo')`, o sea que en ese caso **no se dibujaba en ninguna parte**: el
   * tablero seguía mostrando lo de hace diez minutos sin un solo síntoma. Eso es peor que el
   * «Cargando» que toda esta función vino a sacar — un «Cargando» se ve; un tablero viejo dado por
   * bueno se usa para decidir a quién llamar.
   *
   * Se afirma sobre TODAS, no sobre las de hoy: una quinta pantalla que use la memoria y se olvide
   * del aviso estrena el defecto sin que falle nada. */
  for (const p of PANTALLAS) {
    assert.match(
      codigo(p),
      /<AvisoDesactualizado causa={causa} alReintentar={/,
      `${p} usa la memoria y no dibuja el aviso: una recarga fallida es invisible ahí, y lo viejo ` +
        'se muestra como actual',
    );
  }
});

test('el aviso no se dibuja cuando no hay causa, que es el caso normal', () => {
  /* Sin esto, las cuatro pantallas llevarían un cartel permanente. Y con un cartel permanente
     encima, nadie miraría el que SÍ importa. */
  assert.match(codigo(AVISO), /if \(!causa\) return null;/, 'el aviso se dibuja sin causa');
});

test('el aviso dice que lo de abajo SIRVE, y no que la pantalla está rota', () => {
  /* La clase decide cómo se lee. En `mal` —el rojo de error— la pantalla entera parece rota y
     nadie usa los números que SÍ están, que es justo lo contrario de lo que este aviso existe para
     conseguir: que se sigan usando, sabiendo de cuándo son. */
  const fuente = codigo(AVISO);
  assert.match(fuente, /className="fd-aviso falta"/, 'el aviso se pinta como un error');
  assert.match(fuente, /role="status"/, 'el aviso no se anuncia a un lector de pantalla');
});

// ══════════════════════════════════════════════════════════════════════════════
// 3 · UN PULSO FALLIDO NO VACÍA LA LISTA NI CIERRA LA FICHA
// ══════════════════════════════════════════════════════════════════════════════

test('las ramas de fallo de la lista respetan la regla de no vaciar', () => {
  /* ────────────────────────── EL DEFECTO, TAL COMO PASÓ ──────────────────────────
   *
   * La carga aplicaba la regla en UNA de sus tres ramas: la de arriba usaba
   * `setSituacion((antes) => (antes === 'listo' ? antes : 'cargando'))`, y las dos de fallo escribían
   * la situación a secas.
   *
   * Con eso, el pulso del reloj de la vista —cada diez segundos— cambiaba la pantalla entera por un
   * cartel de error TENIENDO LAS FILAS EN LA MANO. Y como el cartel sale por un `return` de más
   * arriba, se llevaba puesta la ficha abierta: se estaba leyendo un contacto, se caía la red dos
   * segundos, y la ficha se cerraba sola. */
  const fuente = codigo(LISTA);

  assert.match(
    fuente,
    /setSituacion\(\(antes\) => \(antes === 'listo' \? antes : r\.tipo\)\);/,
    'las ramas de fallo de la lista vuelven a vaciar la pantalla teniendo filas, y con eso cierran ' +
      'la ficha que alguien tuviera abierta',
  );

  /* Y NO queda ninguna escritura de situación a secas hacia un fallo, que es la forma exacta que
     tenía el defecto. */
  assert.doesNotMatch(
    fuente,
    /setSituacion\('(sin_respuesta|rechazado)'\)/,
    'volvió un `setSituacion` directo a un estado de fallo: eso vacía la pantalla sin mirar si hay algo',
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// 4 · VOLVER A CONTACTOS NO RECORTA LA LISTA
// ══════════════════════════════════════════════════════════════════════════════

test('una lista EXPANDIDA no se recarga sola, ni al montar ni con el pulso', () => {
  /* ────────────────────────── EL DEFECTO, TAL COMO PASÓ ──────────────────────────
   *
   * La carga trae la página 0 y REEMPLAZA. Sobre una lista a la que alguien le dio «Ver más» tres
   * veces, eso la encoge a la vista: sesenta filas pasan a veinte, sin que nadie toque nada.
   *
   * Y es peor que el atraso que esa recarga vendría a arreglar, porque una lista que se acorta sola
   * se lee como que se perdieron contactos — y nadie reporta filas que no sabe que faltan.
   *
   * Los dos caminos automáticos se afirman por separado: el montaje y el pulso. Arreglar uno solo
   * deja el defecto entero, porque el pulso llega a los diez segundos igual. */
  const fuente = codigo(LISTA);

  assert.match(
    fuente,
    /if \(g && \(g\.valor\.pagina \?\? 0\) > 0\) return;/,
    'el montaje vuelve a recortar una lista expandida a la primera página',
  );
  assert.match(
    fuente,
    /if \(pulso > 0 && !expandida\.current\) void cargar\(\);/,
    'el pulso vuelve a recortar una lista expandida, cada diez segundos',
  );

  /* El ref y no `pagina` en el cuerpo del efecto: en las dependencias, el efecto se dispararía al
     cambiar de página y pediría de más; fuera de ellas, se leería el valor de otro render. */
  assert.match(fuente, /expandida\.current = pagina > 0;/, 'el ref de expandida dejó de actualizarse');
});
