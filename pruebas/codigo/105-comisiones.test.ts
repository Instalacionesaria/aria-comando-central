// Comisiones: se fue de Ajustes al cockpit, y la autorización NO se movió con ella. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// MOVER UN BOTÓN ES LA FORMA MÁS BARATA DE ENSANCHAR UN PERMISO SIN QUERER
//
// Los porcentajes de comisión eran la cuarta pestaña de Ajustes y ahora son una ventana en
// Closer → Inicio. El riesgo del cambio no es visual: es que la operación **cambie de dueño**.
//
// El camino tentador era poner `PANTALLA = 'closer'` en el endpoint, porque ahí vive el botón ahora.
// Eso obliga —por `ADR-0304`, que compara los GET de una misma pantalla— a que su `GET` pida
// `closer.ver` como los otros cinco. Y ese `GET` devuelve **cuánto cobra cada persona del equipo**:
// con `closer.ver` cualquier closer vería el porcentaje de todos sus compañeros.
//
// Así que la pantalla del endpoint sigue siendo `credenciales`, y estas pruebas son lo que impide
// que alguien «acomode» ese marcador para que la ruta combine con el lugar del botón.
//
// La otra mitad: un botón que se ve y da 403 es el `07` § 4. La visibilidad la decide el SERVIDOR con
// la condición exacta del endpoint, no un `if` por nombre de rol — que es lo que `ADR-0302` prohíbe.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const RAIZ = new URL('../../', import.meta.url);
const leer = (r: string) => readFileSync(new URL(r, RAIZ), 'utf8');
const hay = (r: string) => existsSync(new URL(r, RAIZ));

/** Un archivo sin comentarios: los comentarios CUENTAN la historia y nombran lo que ya no existe. */
function codigo(fuente: string): string {
  return fuente
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

test('Ajustes tiene EXACTAMENTE tres pestañas, y ninguna es Comisiones', () => {
  // Lo que se pidió, y el criterio que lo sostiene: Ajustes configura la EMPRESA —sus credenciales,
  // sus empresas, su gente—. Los porcentajes configuran a las personas de un equipo, así que se
  // fueron con el equipo.
  const vista = leer('components/views/AjustesView.jsx');
  const claves = [...codigo(vista).matchAll(/\{\s*clave:\s*'([a-z]+)'/g)].map((m) => m[1]!);
  assert.deepEqual(claves, ['credenciales', 'empresas', 'usuarios'], 'las pestañas de Ajustes cambiaron');
  assert.ok(!codigo(vista).includes('Comisiones'), 'Ajustes volvió a dibujar Comisiones');
});

test('el componente de porcentajes vive en el Closer y no queda una copia en Ajustes', () => {
  // Dos archivos con el mismo formulario es la forma de que uno quede viejo y nadie sepa cuál manda.
  assert.ok(
    !hay('components/ajustes/Comisiones.jsx'),
    'quedó el componente viejo en `components/ajustes/`: se movió, no se copió',
  );
  assert.ok(hay('components/closer/PorcentajesDelEquipo.jsx'), 'falta el componente en el Closer');

  // Y nadie lo importa desde la ruta vieja.
  for (const archivo of ['components/views/AjustesView.jsx', 'components/closer/Comision.jsx']) {
    assert.ok(
      !codigo(leer(archivo)).includes("ajustes/Comisiones"),
      `${archivo} importa el componente desde su ruta vieja`,
    );
  }
});

test('las dos opciones se abren en VENTANA, que es lo que se pidió', () => {
  const comision = leer('components/closer/Comision.jsx');
  const c = codigo(comision);
  assert.match(c, /import Ventana from '\.\.\/Ventana\.jsx'/, 'no usa el modal del proyecto');
  // Dos ventanas: la meta propia y los porcentajes del equipo.
  assert.equal(
    [...c.matchAll(/<Ventana\b/g)].length,
    2,
    'tendrían que ser dos ventanas: la meta propia y los porcentajes del equipo',
  );
  assert.match(c, /<PorcentajesDelEquipo\s*\/>/, 'la ventana de porcentajes no dibuja el componente');

  // Y EL COMENTARIO VIEJO NO PUEDE SEGUIR AHÍ. Decía «en línea y no un modal», o sea lo contrario de
  // lo que el archivo hace ahora. Un comentario que afirma lo opuesto al código es peor que ninguno:
  // se lee con confianza. El encabezado explica que la decisión se revirtió, y eso sí puede estar.
  assert.ok(
    !/En línea y no un modal: el cockpit/.test(comision),
    'quedó el comentario que defiende lo contrario de lo que el archivo hace',
  );
});

test('mover el botón NO movió la autorización', () => {
  // El corazón del asunto. Ver el encabezado: con `PANTALLA = 'closer'`, `ADR-0304` obligaría a que
  // el GET pida `closer.ver`, y ese GET trae lo que cobra cada persona del equipo.
  const ruta = leer('app/api/admin/comisiones/route.ts');
  assert.match(ruta, /export const PANTALLA = 'credenciales';/, 'el endpoint cambió de pantalla');
  assert.match(ruta, /exigir\(peticion, \['credenciales\.ver'\], PANTALLA\)/, 'el GET cambió de capacidad');
  assert.match(ruta, /exigir\(peticion, \['credenciales\.editar'\], PANTALLA\)/, 'el PUT cambió de capacidad');
});

test('la visibilidad del botón la decide el SERVIDOR, no un nombre de rol', () => {
  // `ADR-0302`: nunca un `if` por nombre de rol. Y `07` § 4: no mostrar un control que no puede
  // cumplir. Las dos cosas se resuelven igual — el servidor responde el booleano con la condición
  // EXACTA del endpoint, que es el mismo patrón que `puedeCambiarDeEmpresa`.
  const sesion = leer('app/api/auth/sesion/route.ts');
  assert.match(
    sesion,
    /puedeConfigurarComisiones: contexto\.permisos\.has\('credenciales\.editar'\)/,
    'la sesión no responde quién puede configurar, o lo responde con otra condición que el endpoint',
  );

  const comision = codigo(leer('components/closer/Comision.jsx'));
  assert.match(comision, /puedeConfigurarPorcentajes \?/, 'el botón no depende de lo que dice el servidor');
  // Y NO por nombre de rol, en ninguna de sus formas.
  for (const rol of ['administrador', 'superadministrador', 'usuario']) {
    for (const patron of [
      new RegExp(`===\\s*['"\`]${rol}['"\`]`),
      new RegExp(`\\[\\s*['"\`]${rol}['"\`]`),
      new RegExp(`includes\\(\\s*['"\`]${rol}['"\`]`),
    ]) {
      assert.doesNotMatch(comision, patron, `el anillo decide por el nombre del rol «${rol}»`);
    }
  }
});

test('cerrar la ventana de porcentajes RECARGA, y no borra la comisión', () => {
  // Las dos devoluciones hacen cosas distintas y por eso son dos. `alGuardar` PISA la comisión con
  // lo que recibe —sirve para la meta, que devuelve el objeto nuevo— así que llamarla con `null` al
  // cerrar habría borrado el número de la pantalla en vez de refrescarlo.
  const c = codigo(leer('components/closer/Comision.jsx'));
  assert.match(c, /alRecargar\?\.\(\)/, 'cerrar la ventana de porcentajes no recarga nada');
  assert.ok(
    !/alGuardar\?\.\(null\)/.test(c),
    'se recarga llamando `alGuardar(null)`: esa devolución PISA la comisión, así que la borraría',
  );

  // Y la recarga tiene que llegar de verdad desde arriba.
  const vista = codigo(leer('components/views/CloserView.jsx'));
  assert.match(vista, /alRecargar=\{\(\) => void cargar\(\)\}/, 'CloserView no pasa la recarga');
  assert.match(
    vista,
    /puedeConfigurarComisiones=\{sesion\?\.puedeConfigurarComisiones \?\? false\}/,
    'CloserView no pasa el permiso, o lo pasa con otro valor por omisión que `false`',
  );
});
