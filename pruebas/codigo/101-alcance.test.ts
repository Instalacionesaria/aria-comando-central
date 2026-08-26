// El formulario de permisos: que no copie listas ni compare nombres de rol. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LAS DOS FORMAS DE QUE ESTO SE PUDRA CON EL TIEMPO
//
//   1 · **Copiar los nombres de las secciones al JSX.** Serían la quinta copia de las trece claves, y
//       `lib/autorizacion/secciones.ts` existe justamente porque una de esas copias divergió en un
//       nombre —`leads` contra `contacts`— con dos pruebas en verde.
//   2 · **Decidir por nombre de rol.** `const RESTRINGIDOS = ['usuario']` funciona hoy y miente el
//       día que exista un segundo rol restringido. `ADR-0302` lo prohíbe, y hay que decir algo
//       incómodo: el guardia que ya existe solo atrapa `===`, `!==` y `case`, así que una lista o un
//       objeto de búsqueda pasan. Esta prueba cubre esas formas.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SECCIONES,
  alcanceOfrecible,
  clavesDeSeccion,
  menuVisible,
  seccionesConAlcance,
} from '../../lib/autorizacion/secciones.ts';

const RAIZ = new URL('../../', import.meta.url);
const leer = (r: string) => readFileSync(new URL(r, RAIZ), 'utf8');

const FORMULARIO = 'components/ajustes/Usuarios.jsx';

test('el formulario NO trae ningún nombre de sección escrito a mano', () => {
  const fuente = leer(FORMULARIO);
  const colados = SECCIONES.filter(
    (s) => fuente.includes(`'${s.clave}'`) || fuente.includes(`"${s.nombre}"`),
  ).map((s) => s.clave);
  assert.deepEqual(
    colados,
    [],
    'el formulario escribe claves o nombres de sección: tienen que venir del catálogo del servidor',
  );
});

test('el formulario NO decide por nombre de rol', () => {
  // Cuatro formas: comparación directa, lista, objeto de búsqueda y `includes`. El guardia general
  // solo ve la primera, así que las otras tres se cubren acá.
  const fuente = leer(FORMULARIO);
  for (const c of ['usuario', 'administrador', 'superadministrador']) {
    for (const patron of [
      new RegExp(`===\\s*['"\`]${c}['"\`]`),
      new RegExp(`\\[\\s*['"\`]${c}['"\`]\\s*[,\\]]`),
      new RegExp(`['"\`]${c}['"\`]\\s*:`),
      new RegExp(`includes\\(\\s*['"\`]${c}['"\`]`),
    ]) {
      assert.doesNotMatch(
        fuente,
        patron,
        `el formulario nombra el rol «${c}»: tiene que preguntar la propiedad, no la clave`,
      );
    }
  }
  // Y lo que SÍ tiene que hacer: preguntar la propiedad que el servidor manda.
  assert.match(fuente, /restringePorSeccion/, 'el formulario no pregunta si el rol restringe');
});

test('`alcanceOfrecible` es TOTAL: ninguna sección alcanzable se cae', () => {
  // `usuarios` y `empresas` no tienen `menu` —son pestañas dentro de Ajustes— así que un agrupado por
  // `s.menu.grupo` las descarta en silencio. Serían secciones que el portero puede negar y que la
  // interfaz no puede conceder: nadie podría restringirlas nunca.
  const todas = new Set(SECCIONES.map((s) => s.capacidadRequerida));
  const ofrecidas = alcanceOfrecible(todas).flatMap((g) => g.secciones.map((s) => s.clave));
  assert.deepEqual([...ofrecidas].sort(), [...clavesDeSeccion()].sort());
  assert.equal(new Set(ofrecidas).size, ofrecidas.length, 'una sección aparece en dos grupos');
});

test('`alcanceOfrecible` no devuelve grupos vacíos', () => {
  // La misma regla que el menú: un título con nada adentro le dice a alguien que ahí hay algo que no
  // puede ver, cuando lo que corresponde es que no sepa que existe.
  for (const g of alcanceOfrecible(new Set(['closer.ver']))) {
    assert.ok(g.secciones.length > 0, `el grupo «${g.grupo.clave}» vino vacío`);
  }
  assert.deepEqual(alcanceOfrecible(new Set()), []);
});

test('el corte del alcance se aplica ANTES de agrupar el menú', () => {
  // Aplicado afuera, sobre el menú ya agrupado, quedarían grupos con título y nada adentro.
  const todas = new Set(SECCIONES.map((s) => s.capacidadRequerida));
  const menu = menuVisible(todas, { restringido: true, concedidas: new Set(['executive']) });
  assert.equal(menu.length, 1, 'quedaron grupos vacíos al aplicar el alcance');
  assert.deepEqual(
    menu[0]?.secciones.map((s) => s.clave),
    ['executive'],
  );
});

test('el alcance es una INTERSECCIÓN, nunca una unión', () => {
  // Es la propiedad de la que depende todo el argumento de por qué esto no es un «permiso negativo»:
  // no habilita nada que el rol no habilite. Si alguna vez sumara, habría que volver a discutir la
  // regla de la migración 003 en vez de explicar por qué no aplica.
  const soloCloser = new Set(['closer.ver']);
  const efectivas = seccionesConAlcance(soloCloser, {
    restringido: true,
    concedidas: new Set(clavesDeSeccion()),
  });
  assert.deepEqual(
    efectivas.map((s) => s.clave),
    ['closer'],
    'conceder todas las secciones le dio al rol pestañas que su capacidad no habilita',
  );
});

test('el Paso 6 del portero se comprueba DESPUÉS del Paso 4', () => {
  // El orden es lo que impide que una errata del alcance encierre a alguien sin poder cambiar su
  // contraseña temporal. Se comprueba por posición porque el efecto no es local: es el `return`
  // temprano del Paso 4 el que protege las cuatro salidas de los estados restringidos.
  const fuente = leer('lib/autorizacion/portero.ts');
  const paso4 = fuente.indexOf('capacidadesRequeridas === NINGUNA');
  const paso6 = fuente.indexOf('contexto.alcance.restringido');
  assert.ok(paso4 > 0 && paso6 > 0, 'no se encontraron los dos pasos');
  assert.ok(
    paso4 < paso6,
    'el rechazo por sección quedó ANTES del `return` de `NINGUNA`: eso puede encerrar a alguien en ' +
      'el cambio de su contraseña temporal',
  );
});
