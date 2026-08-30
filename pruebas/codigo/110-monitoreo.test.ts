// El Panel de Monitoreo: que siga haciendo falta ser de ARIA para verlo. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA AUTORIZACIÓN DE ESTA PANTALLA SON DOS MITADES, Y LA SEGUNDA NO LA SOSTIENE NADA MÁS
//
// La primera mitad —la capacidad `monitoreo.ver`— la cuidan las pruebas que ya existen: el cruce
// entre `CAPACIDADES` y `identidad.permisos`, y `ADR-0303`. Si desapareciera, la suite se pone
// roja sola.
//
// La segunda —**ser de la organización principal**— no tiene ese respaldo, y es la que importa
// más. El reparto de `db/arranque/001_catalogo.sql` le da `monitoreo.ver` al rol `administrador`,
// y un administrador existe en CADA empresa cliente. O sea que si esta regla se cae:
//
//   · el administrador de un cliente High Ticket ve el consumo de los otros nueve,
//   · la pantalla funciona perfecto,
//   · ninguna otra prueba de este repositorio se pone roja.
//
// Es la forma exacta de defecto que el `07` § 0 llama *"un éxito reportado que no ocurrió"*, con
// la agravante de que acá el éxito sería una fuga entre clientes. Este archivo existe para eso.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CAPACIDADES } from '../../lib/autorizacion/capacidades.ts';
import {
  SECCIONES,
  esDeLaPrincipal,
  menuVisible,
  seccionesConAlcance,
} from '../../lib/autorizacion/secciones.ts';

const RAIZ = new URL('../../', import.meta.url);
const leer = (r: string) => readFileSync(new URL(r, RAIZ), 'utf8');

const SIN_ALCANCE = { restringido: false } as const;
/** Las capacidades de un administrador en lo que a esta pantalla respecta. */
const DE_UN_ADMINISTRADOR = new Set(['monitoreo.ver', 'credenciales.ver', 'tablero.ver']);

// ─── La sección ─────────────────────────────────────────────────────────────

test('la sección `monitoreo` existe, pide su capacidad y es de la principal', () => {
  const s = SECCIONES.find((x) => x.clave === 'monitoreo');
  assert.ok(s, '`monitoreo` no está en SECCIONES');
  assert.equal(s.capacidadRequerida, 'monitoreo.ver');
  assert.equal(s.nombre, 'Panel de Monitoreo');
  assert.equal(
    s.soloDesdeLaPrincipal,
    true,
    'sin esta bandera, el administrador de cada empresa cliente ve el consumo de las demás',
  );
  // Y NO lleva `sinOperacionesTodavia`: tiene su `GET`. La bandera puesta acá eximiría a la
  // pantalla de `ADR-0304`, que es la que compara los conjuntos de capacidades de sus rutas.
  assert.equal(s.sinOperacionesTodavia, undefined);
  assert.ok(CAPACIDADES.includes('monitoreo.ver'), '`monitoreo.ver` no está en el catálogo');
});

test('es la ÚNICA sección con `soloDesdeLaPrincipal`, y eso hay que decidirlo a propósito', () => {
  // No es una regla de estilo: la bandera cambia quién ve una pantalla, y una segunda sección que
  // la lleve tiene que llegar con su propia justificación y su propia prueba. Que esto se ponga
  // rojo al agregarla es el punto.
  assert.deepEqual(
    SECCIONES.filter((s) => s.soloDesdeLaPrincipal).map((s) => s.clave),
    ['monitoreo'],
  );
});

// ─── `esDeLaPrincipal`, las tres ramas ──────────────────────────────────────

test('`esDeLaPrincipal` mira la organización PROPIA, no la que se está mirando', () => {
  // El superadministrador conmutado a una empresa cliente: `organizacion` describe la efectiva,
  // que NO es la principal — y sigue siendo de la casa. La bandera `solo_principal` del rol, que
  // un disparador de la base hace cumplir, garantiza que su organización propia sí lo es.
  //
  // Sin esta rama, conmutarse le apagaría el panel: el encierro exacto que ya se pagó con la
  // pestaña Empresas.
  assert.equal(
    esDeLaPrincipal({ esRolDePlataforma: true, organizacion: { esPrincipal: false } }),
    true,
    'un superadministrador conmutado a un cliente perdería el panel',
  );

  // Un administrador de ARIA: no es rol de plataforma, así que su efectiva ES su propia.
  assert.equal(
    esDeLaPrincipal({ esRolDePlataforma: false, organizacion: { esPrincipal: true } }),
    true,
  );

  // Y el caso que esta pantalla existe para negar.
  assert.equal(
    esDeLaPrincipal({ esRolDePlataforma: false, organizacion: { esPrincipal: false } }),
    false,
    'el administrador de una empresa cliente NO puede ser de la principal',
  );
});

// ─── Lo que se ve, que es lo que importa ────────────────────────────────────

test('el menú esconde el Panel de Monitoreo a quien no es de la principal', () => {
  const claves = (desdeLaPrincipal: boolean) =>
    menuVisible(DE_UN_ADMINISTRADOR, SIN_ALCANCE, desdeLaPrincipal).flatMap((g) =>
      g.secciones.map((s) => s.clave),
    );

  assert.ok(claves(true).includes('monitoreo'), 'un administrador de ARIA no ve su propio panel');
  assert.ok(
    !claves(false).includes('monitoreo'),
    'el administrador de una empresa cliente ve la entrada del menú: teniendo la capacidad, ' +
      'la única cosa que se lo impide es esta bandera',
  );
});

test('la lista `secciones` de la sesión se corta con el MISMO criterio que el menú', () => {
  // Las dos mitades salen de la misma respuesta y las lee gente distinta —`menu` lo lee `Nav` y
  // `secciones` las lee `AjustesView`—. Cortar una sola deja media interfaz sin restringir, y eso
  // ya pasó una vez con el alcance por persona.
  const claves = (desdeLaPrincipal: boolean) =>
    seccionesConAlcance(DE_UN_ADMINISTRADOR, SIN_ALCANCE, desdeLaPrincipal).map((s) => s.clave);

  assert.ok(claves(true).includes('monitoreo'));
  assert.ok(!claves(false).includes('monitoreo'));
});

test('sin la capacidad no hay panel, esté quien esté en la principal', () => {
  // La primera mitad, para que no se pueda "arreglar" la segunda borrando la primera: alguien de
  // ARIA con el rol `usuario` tampoco lo ve.
  const deUnUsuario = new Set(['tablero.ver', 'closer.ver']);
  assert.ok(
    !menuVisible(deUnUsuario, SIN_ALCANCE, true)
      .flatMap((g) => g.secciones.map((s) => s.clave))
      .includes('monitoreo'),
  );
});

// ─── El servidor, que es la barrera de verdad ───────────────────────────────

test('la ruta declara su pantalla y comprueba las DOS mitades', () => {
  // Se lee el fuente en vez de invocar el manejador porque lo que hay que impedir es que alguien
  // BORRE la comprobación, y un manejador que ya no la tiene pasa cualquier prueba que no la
  // busque. Es la misma técnica que usa `ADR-0304` para leer los `exigir(` del repositorio.
  const ruta = leer('app/api/monitoreo/route.ts');

  assert.match(ruta, /export const PANTALLA = 'monitoreo'/);
  assert.match(
    ruta,
    /exigir\(peticion, \['monitoreo\.ver'\], PANTALLA\)/,
    'la ruta dejó de pedir `monitoreo.ver`',
  );
  assert.match(
    ruta,
    /if \(!esDeLaPrincipal\(contexto\)\)/,
    'la ruta dejó de comprobar la organización principal: la capacidad sola le da este panel al ' +
      'administrador de cada empresa cliente, y nada más en la suite lo detecta',
  );
  // Y que el rechazo esté ANTES de leer nada. Un `return` después de la primera consulta seguiría
  // negando la respuesta y ya habría cruzado las organizaciones.
  assert.ok(
    ruta.indexOf('esDeLaPrincipal(contexto)') < ruta.indexOf('conIdentidad('),
    'la comprobación de la principal quedó DESPUÉS de leer las organizaciones',
  );
});

test('la ruta lee de a una organización, y NO con una consulta que las cruce', () => {
  // La propiedad que hace segura a esta pantalla: cada lectura pasa por la política de RLS de su
  // organización. Un `group by org_id` acá exigiría un camino que omita RLS, y ese camino no
  // existe hoy — pero el día que exista, esta pantalla es la primera candidata a usarlo.
  const ruta = leer('app/api/monitoreo/route.ts');
  assert.match(ruta, /conOrganizacion\(o\.id,/);

  /* SIN COMENTARIOS, y no es un detalle: el encabezado de `consumo.ts` explica por qué un
     `group by org_id` no funciona acá, así que la prosa que documenta la decisión hacía fallar
     la prueba que la protege. Un guardia que se dispara con su propia documentación se termina
     desactivando — es la misma lección que dejó escrita `91-closer-y-setter`. */
  const consulta = leer('lib/monitoreo/consumo.ts')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.ok(
    !/group\s*by\s*\(?['"`]?org_id/i.test(consulta) && !consulta.includes(".groupBy('org_id'"),
    'la consulta del consumo agrupa por org_id: eso solo puede funcionar sin RLS',
  );
});

// ─── El catálogo y el reparto ───────────────────────────────────────────────

test('el catálogo carga `monitoreo.ver` y se la NIEGA al rol `usuario`', () => {
  const catalogo = leer('db/arranque/001_catalogo.sql');

  assert.ok(
    catalogo.includes("('monitoreo.ver',"),
    'la capacidad no se carga en `identidad.permisos`: el portero rechazaría a todo el mundo',
  );

  // ── LA LÍNEA QUE NO SE DERIVA ────────────────────────────────────────────
  //
  // El reparto deriva por exclusión de prefijos, así que una familia nueva cae SOLA en los tres
  // roles. Sin este `not like`, cualquier persona de cualquier empresa cliente tendría la
  // capacidad — y con ella, sólo la regla de la organización principal separándola del panel.
  // Las dos mitades tienen que estar.
  const usuario = catalogo.slice(catalogo.indexOf("('usuario', (select"));
  const finDelUsuario = usuario.indexOf('))'),
    bloque = usuario.slice(0, finDelUsuario);
  assert.ok(
    bloque.includes("clave not like 'monitoreo.%'"),
    'el reparto del rol `usuario` dejó de excluir `monitoreo.%`',
  );
});

test('la migración deja conceder `monitoreo` como alcance por persona', () => {
  // El `check` de `identidad.usuarios_secciones` no contiene: DIAGNOSTICA. Una clave que no está
  // no concede nada —falla cerrado— pero deja una pestaña que nadie puede conceder, y el síntoma
  // es un error de la base que nombra una restricción.
  const migracion = leer('db/migraciones/023_seccion_monitoreo.sql');
  assert.match(migracion, /'monitoreo'/);
  assert.match(migracion, /usuarios_secciones_seccion_check/);
});
