// Con qué pantalla se abre la aplicación, y los nombres de sección escritos a mano. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ESTO EXISTE PORQUE LA MIGA DE PAN MINTIÓ, Y NADIE LO HABRÍA VISTO SIN EL ALCANCE
//
// La regla «la primera pantalla visible arranca activa» estaba escrita dos veces —`Nav.jsx` y
// `CommandCenter.jsx`—, cada una con un comentario diciendo que la otra hacía lo mismo. Eso es una
// lista paralela sostenida por prosa.
//
// El tercer lugar no tenía ni comentario ni regla: `TopBar.jsx` traía `Executive` escrito a mano
// del prototipo, y `AskBar.jsx` también. Mientras todo el mundo veía las diez pestañas el literal
// acertaba —todos abrían en Executive—, así que **el defecto era invisible por construcción**.
//
// Medido en el navegador con alguien restringido a Closer y Tools: menú correcto, vista abierta
// Closer, y arriba «AIOS / Executive». La miga nombraba una pantalla que esa persona no puede ver y
// que además no era la abierta.
//
// Las tres pruebas de abajo cubren las tres formas de que vuelva: que la regla se duplique, que un
// nombre se escriba a mano, y que reaparezca un mapa de nombres sin nadie que lo cruce.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SECCIONES,
  clavesDeSeccion,
  menuVisible,
  seccionDeArranque,
} from '../../lib/autorizacion/secciones.ts';

const RAIZ = new URL('../../', import.meta.url);
const leer = (r: string) => readFileSync(new URL(r, RAIZ), 'utf8');

const TODAS = new Set(SECCIONES.map((s) => s.capacidadRequerida));

/* Desde la organización principal. Es el valor que hace que estas pruebas sigan midiendo lo que
   medían: sin él, las secciones `soloDesdeLaPrincipal` desaparecerían de todos los conjuntos de
   abajo y las afirmaciones pasarían por una razón distinta de la que dicen. La regla en sí tiene
   su propia prueba — no se comprueba de refilón acá. */
const DESDE_LA_PRINCIPAL = true;


test('sin restricción arranca en Executive, que es lo que el prototipo daba por sentado', () => {
  // La comprobación de que esto NO cambió el caso de siempre. El literal viejo acertaba acá, y por
  // eso el defecto duró: hay que ver los dos casos juntos para que el segundo signifique algo.
  const inicio = seccionDeArranque(menuVisible(TODAS, { restringido: false }, DESDE_LA_PRINCIPAL));
  assert.equal(inicio?.seccion.clave, 'executive');
  assert.equal(inicio?.grupo, 'AIOS');
});

test('EL CASO QUE ROMPIÓ: restringido a Closer, arranca en Closer y NO en Executive', () => {
  const inicio = seccionDeArranque(
    menuVisible(TODAS, { restringido: true, concedidas: new Set(['closer', 'tools']) }, DESDE_LA_PRINCIPAL),
  );
  assert.equal(inicio?.seccion.clave, 'closer');
  assert.equal(inicio?.seccion.nombre, 'Closer');
  assert.equal(inicio?.grupo, 'Operación');
});

test('el CUERPO antes que el pie, aunque el pie venga primero en el catálogo', () => {
  // Alguien con pestañas de trabajo no puede abrir en la configuración. Se arma un menú con el
  // grupo del pie ADELANTE para que la prueba dependa de la regla y no del orden de la lista: con
  // un `[0]` a secas, esto abriría en Credenciales.
  const menu = menuVisible(TODAS, {
    restringido: true,
    concedidas: new Set(['credenciales', 'closer']),
  }, DESDE_LA_PRINCIPAL);
  const alReves = [...menu].reverse();
  assert.equal(seccionDeArranque(alReves)?.seccion.clave, 'closer');
  // Y al revés sí: si lo único que tiene es el pie, abre ahí.
  const soloPie = menuVisible(TODAS, { restringido: true, concedidas: new Set(['credenciales']) }, DESDE_LA_PRINCIPAL);
  assert.equal(seccionDeArranque(soloPie)?.seccion.clave, 'credenciales');
});

test('sin ninguna sección devuelve `null`, y no inventa una pantalla', () => {
  // Es un estado alcanzable —un rol restringido sin secciones concedidas— y hoy no tiene pantalla
  // propia. Devolver `'executive'` acá sería exactamente el defecto que esto vino a cerrar, con la
  // diferencia de que lo escribiría el servidor.
  assert.equal(seccionDeArranque(menuVisible(TODAS, { restringido: true, concedidas: new Set() }, DESDE_LA_PRINCIPAL)), null);
  assert.equal(seccionDeArranque([]), null);
});

test('el armazón NO escribe ningún nombre de sección a mano', () => {
  // `TopBar` y `AskBar` los traían del prototipo. `Overlays` tenía el tercero, invisible porque
  // `refreshScope()` lo pisa al abrir el panel — y por eso mismo es el que más fácil vuelve.
  const nombres = SECCIONES.map((s) => s.nombre);
  for (const archivo of ['components/TopBar.jsx', 'components/AskBar.jsx', 'components/Overlays.jsx']) {
    const fuente = leer(archivo);
    // Solo el JSX, no los comentarios: éstos CUENTAN la historia y nombran «Executive» a propósito.
    const sinComentarios = fuente
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    for (const nombre of nombres) {
      assert.ok(
        !new RegExp(`>\\s*${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*<`).test(sinComentarios),
        `${archivo} escribe «${nombre}» en el marcado: tiene que venir del dato de arranque`,
      );
    }
  }
});

test('el chat del armazón no vuelve a tener su propia lista de nombres de sección', () => {
  // Había un `NAMES` con diez de las catorce claves y ya estaba vencido: le faltaba `tools`, y el
  // fallback `|| 'Executive'` hacía que el panel dijera «respondiendo con datos de Executive»
  // estando abierto en Tools. Era la copia sin prueba que la cruzara — `GROUP`, en `shell.js`, sí
  // tiene una, y por eso a `GROUP` no le faltó `tools`.
  const fuente = leer('lib/aios/executive-chat.js');
  const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const clave of clavesDeSeccion()) {
    assert.doesNotMatch(
      codigo,
      new RegExp(`${clave}\\s*:\\s*['"\`]`),
      `\`executive-chat.js\` volvió a mapear la sección «${clave}» a un nombre propio`,
    );
  }
  // Lo que SÍ tiene que hacer: leerlo del DOM de la fila, que es de donde `irALaVista` lo saca.
  assert.match(codigo, /querySelector\('\.n'\)/, 'el nombre ya no se lee de la fila del menú');
});
