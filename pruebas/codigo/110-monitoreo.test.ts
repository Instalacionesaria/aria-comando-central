// El Panel de Monitoreo: que siga haciendo falta ser de ARIA para verlo. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA AUTORIZACIÓN DE ESTA PANTALLA SON DOS MITADES, Y LA SEGUNDA NO LA SOSTIENE NADA MÁS
//
// La primera mitad —la capacidad `monitoreo.ver`— la cuidan las pruebas que ya existen: el cruce
// entre `CAPACIDADES` y `identidad.permisos`, y `ADR-0303`. Si desapareciera, la suite se pone
// roja sola.
//
// La segunda —**ser de la organización principal**— no tiene ese respaldo. Es la red debajo de un
// error de UNA fila: la capacidad la lleva el rol `monitoreo`, que se asigna persona por persona
// desde la pantalla de Usuarios, y dárselo a alguien de una empresa cliente es un clic. Si esta
// regla se cae:
//
//   · esa persona ve el consumo de todas las demás empresas, incluidas sus competidoras,
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
import { margen, totales, usd } from '../../lib/monitoreo/panel.ts';

const RAIZ = new URL('../../', import.meta.url);
const leer = (r: string) => readFileSync(new URL(r, RAIZ), 'utf8');

const SIN_ALCANCE = { restringido: false } as const;
/** Alguien con el rol `monitoreo` encima de su rol de puesto. Los roles SUMAN: es la unión. */
const CON_EL_ROL_MONITOREO = new Set(['monitoreo.ver', 'credenciales.ver', 'tablero.ver']);

// ─── La sección ─────────────────────────────────────────────────────────────

test('la sección `monitoreo` existe, pide su capacidad y es de la principal', () => {
  const s = SECCIONES.find((x) => x.clave === 'monitoreo');
  assert.ok(s, '`monitoreo` no está en SECCIONES');
  assert.equal(s.capacidadRequerida, 'monitoreo.ver');
  assert.equal(s.nombre, 'Panel de Monitoreo');
  assert.equal(
    s.soloDesdeLaPrincipal,
    true,
    'sin esta bandera, un rol `monitoreo` mal asignado muestra el consumo de todas las empresas',
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
    menuVisible(CON_EL_ROL_MONITOREO, SIN_ALCANCE, desdeLaPrincipal).flatMap((g) =>
      g.secciones.map((s) => s.clave),
    );

  assert.ok(claves(true).includes('monitoreo'), 'quien tiene el rol, en ARIA, no ve su panel');
  assert.ok(
    !claves(false).includes('monitoreo'),
    'alguien de una empresa cliente con el rol `monitoreo` ve la entrada del menú: teniendo la ' +
      'capacidad, la única cosa que se lo impide es esta bandera',
  );
});

test('la lista `secciones` de la sesión se corta con el MISMO criterio que el menú', () => {
  // Las dos mitades salen de la misma respuesta y las lee gente distinta —`menu` lo lee `Nav` y
  // `secciones` las lee `AjustesView`—. Cortar una sola deja media interfaz sin restringir, y eso
  // ya pasó una vez con el alcance por persona.
  const claves = (desdeLaPrincipal: boolean) =>
    seccionesConAlcance(CON_EL_ROL_MONITOREO, SIN_ALCANCE, desdeLaPrincipal).map((s) => s.clave);

  assert.ok(claves(true).includes('monitoreo'));
  assert.ok(!claves(false).includes('monitoreo'));
});

test('sin la capacidad no hay panel, esté quien esté en la principal', () => {
  // La primera mitad, para que no se pueda "arreglar" la segunda borrando la primera: alguien de
  // ARIA sin el rol `monitoreo` —un administrador cualquiera de la casa— tampoco lo ve.
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
    'la ruta dejó de comprobar la organización principal: sin eso, el rol `monitoreo` asignado ' +
      'por error a alguien de una empresa cliente le muestra el consumo de todas, y nada más en ' +
      'la suite lo detecta',
  );
  // Y que el rechazo esté ANTES de leer nada. Un `return` después de la primera consulta seguiría
  // negando la respuesta y ya habría cruzado las organizaciones.
  assert.ok(
    ruta.indexOf('esDeLaPrincipal(contexto)') < ruta.indexOf('conIdentidad('),
    'la comprobación de la principal quedó DESPUÉS de leer las organizaciones',
  );
});

test('el DETALLE pide exactamente lo mismo que la tabla, y comprueba lo mismo', () => {
  // ── ADR-0304 LLEVADO A SU CASO MÁS FEO ────────────────────────────────────
  //
  // Las dos rutas llenan la MISMA pantalla, así que tienen que pedir el mismo conjunto. Si el
  // detalle pidiera algo distinto, el defecto no sería una pantalla en blanco: la tabla cargaría
  // bien y **hacer clic en una empresa daría 403**, sin que nada en la interfaz explique por qué
  // una mitad de la pantalla funciona y la otra no.
  const detalle = leer('app/api/monitoreo/[orgId]/route.ts');
  const tabla = leer('app/api/monitoreo/route.ts');

  for (const [nombre, fuente] of [['la tabla', tabla], ['el detalle', detalle]] as const) {
    assert.match(fuente, /export const PANTALLA = 'monitoreo'/, `${nombre} no declara la pantalla`);
    assert.match(
      fuente,
      /exigir\(peticion, \['monitoreo\.ver'\], PANTALLA\)/,
      `${nombre} no pide \`monitoreo.ver\``,
    );
    // ── Y LA SEGUNDA MITAD, COPIADA A PROPÓSITO ─────────────────────────────
    //
    // Una ruta que confía en que «la otra ya validó» es una ruta sin validación: nadie está
    // obligado a pedir la tabla antes de pedir el detalle. Este `GET` se puede llamar solo.
    assert.match(
      fuente,
      /if \(!esDeLaPrincipal\(contexto\)\)/,
      `${nombre} no comprueba la organización principal`,
    );
  }
});

test('el detalle valida el identificador ANTES de abrir ningún contexto', () => {
  // `conOrganizacion` LANZA sobre algo que no es un uuid, y ese error saldría como 500 desde el
  // fondo de la capa de datos en vez de como el rechazo que es. Un 500 en un panel de
  // administración se reporta como «se rompió», no como «ese identificador no existe».
  const ruta = leer('app/api/monitoreo/[orgId]/route.ts');
  /* SIN COMENTARIOS para la comparación de posiciones: el encabezado de la ruta EXPLICA que abre
     `conOrganizacion(orgId, …)`, así que la prosa que documenta la decisión aparecía antes que el
     código y hacía fallar la prueba que la protege. Un guardia que se dispara con su propia
     documentación se termina desactivando. */
  const codigo = ruta.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(
    codigo.indexOf('UUID.test(orgId)') < codigo.indexOf('conOrganizacion('),
    'la validación del identificador quedó después de abrir el contexto',
  );

  // Y la empresa se resuelve con `listarOrganizaciones`, que es la MISMA función que dibuja la
  // tabla. No es comodidad: esa función deja afuera `control-a` y `control-b`, las dos
  // organizaciones de la sonda de aislamiento. Con una consulta propia por `id`, un identificador
  // escrito a mano abriría el detalle de una de ellas — y dos listas que tienen que coincidir son
  // dos listas que se desincronizan.
  assert.match(ruta, /listarOrganizaciones\(db\)/);
});

test('la ruta lee de a una organización, y NO con una consulta que las cruce', () => {
  // La propiedad que hace segura a esta pantalla: cada lectura pasa por la política de RLS de su
  // organización. Un `group by org_id` acá exigiría un camino que omita RLS, y ese camino no
  // existe hoy — pero el día que exista, esta pantalla es la primera candidata a usarlo.
  const ruta = leer('app/api/monitoreo/route.ts');
  assert.match(leer('app/api/monitoreo/route.ts'), /conOrganizacion\(o\.id,/);
  assert.match(leer('app/api/monitoreo/[orgId]/route.ts'), /conOrganizacion\(orgId,/);

  /* SIN COMENTARIOS, y no es un detalle: el encabezado de `consumo.ts` explica por qué un
     `group by org_id` no funciona acá, así que la prosa que documenta la decisión hacía fallar
     la prueba que la protege. Un guardia que se dispara con su propia documentación se termina
     desactivando — es la misma lección que dejó escrita `91-closer-y-setter`. */
  for (const archivo of ['lib/monitoreo/consumo.ts', 'lib/monitoreo/detalle.ts']) {
    const consulta = leer(archivo)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    assert.ok(
      !/group\s*by\s*\(?['"`]?org_id/i.test(consulta) && !consulta.includes(".groupBy('org_id'"),
      `${archivo} agrupa por org_id: eso solo puede funcionar sin RLS`,
    );
    // Y tampoco un `where org_id`. Acá el aislamiento lo pone `conOrganizacion(`, no la consulta:
    // un `where` daría la impresión de que el filtro es ése, y el día que alguien lo quitara para
    // "simplificar" no se notaría que la protección era otra.
    assert.ok(
      !consulta.includes(".where('org_id'"),
      `${archivo} filtra por org_id a mano: el filtro lo pone RLS, no la consulta`,
    );
  }
});

// ─── La plata: ingreso, costo y margen ──────────────────────────────────────
//
// LO QUE ESTAS PRUEBAS PROTEGEN es UNA regla, aplicada en tres lugares: **la ausencia de un dato
// no se dibuja ni se suma como un cero**. Es la regla más fácil de romper «simplificando», y la
// que más caro sale: en un tablero de rentabilidad, un cero inventado no se ve como un error — se
// ve como una conclusión.

test('el margen es `null` si falta CUALQUIERA de los dos lados', () => {
  // Rellenar el lado que falta con cero da un número con forma de margen que no describe a nadie,
  // y **siempre en la dirección peligrosa**: sin costo medido, toda empresa se ve rentable.
  assert.equal(margen({ precioMensual: 1500, costoUsd: null }), null, 'inventó un costo de cero');
  assert.equal(margen({ precioMensual: null, costoUsd: 12 }), null, 'inventó un ingreso de cero');
  assert.equal(margen({ precioMensual: null, costoUsd: null }), null);
  // Y con los dos, resta de verdad. Incluido el cero MEDIDO, que sí es un número.
  assert.equal(margen({ precioMensual: 1500, costoUsd: 12 }), 1488);
  assert.equal(margen({ precioMensual: 0, costoUsd: 12 }), -12);
});

test('los totales ignoran los nulos, y DICEN cuántos ignoraron', () => {
  // La segunda mitad es la que hace honesto al total: sin `empresasSinPrecio` y `scrapeosSinCosto`,
  // un total parcial es indistinguible de uno completo — «$1.500» se lee como el ingreso de todas
  // cuando puede ser el de una de cuatro.
  const fila = (precioMensual: number | null, costoUsd: number | null, scrapeosSinCosto = 0) => ({
    orgId: 'x', nombre: 'x', slug: 'x', activa: true, esPrincipal: false, ilegible: false,
    scrapeos: 0, completados: 0, porFuente: {}, leads: 0, saldo: null,
    precioMensual, costoUsd, scrapeosSinCosto,
  });

  const t = totales([fila(1500, 10), fila(null, null, 3), fila(0, 2)]);
  assert.equal(t.ingreso, 1500, 'el nulo se contó como cero');
  assert.equal(t.empresasSinPrecio, 1);
  assert.equal(t.costo, 12);
  assert.equal(t.scrapeosSinCosto, 3);

  // Y si NADIE tiene el dato, el total es `null` y no `0`. Un cero acá diría «no cuesta nada».
  const vacio = totales([fila(null, null), fila(null, null)]);
  assert.equal(vacio.ingreso, null);
  assert.equal(vacio.costo, null);
});

test('`usd` no dibuja un nulo como $0, y no redondea los centavos a cero', () => {
  assert.equal(usd(null), '—');
  assert.equal(usd(undefined), '—');
  // Una corrida de Apify cuesta centavos: con dos decimales fijos, TODA la columna de costos sería
  // `$0.00` — un número que se ve medido y no dice nada.
  assert.ok(usd(0.0123).includes('0.0123'), 'redondeó el costo de una corrida a cero');
  // Y el cero MEDIDO sí se dibuja, porque es un hecho.
  assert.equal(usd(0), '$0.00');
});

test('el costo NO se estima, y este proyecto NO lo consulta', () => {
  // ── DOS REGLAS EN UNA PRUEBA, Y LAS DOS SE ROMPEN «SIMPLIFICANDO» ─────────
  //
  // 1 · El costo se MIDE. La alternativa descartada era una tarifa por lead configurable: produce
  //     un número que se ve medido y no lo es, y en un tablero que existe para decidir si un
  //     cliente deja plata eso es peor que no tener la columna.
  //
  // 2 · Y lo mide **el backend de scraping**, no este proyecto. Hubo una versión que le preguntaba
  //     a Apify desde acá y se revirtió por dos motivos, escritos en
  //     `COSTO-DE-APIFY-EN-EL-BACKEND.md`: creaba una segunda copia del token de Apify —una
  //     credencial que hoy vive en un solo sistema— y medía DE MENOS, porque el
  //     `apify_actor_run_id` que guardamos es el del PRIMER actor y Google Maps encadena un
  //     segundo cuyo identificador no se guarda en ningún lado.
  //
  // Si alguien vuelve a traer la consulta acá, que sea con esos dos problemas resueltos y no por
  // parecer más directo.
  const fuentes = ['lib/monitoreo/consumo.ts', 'app/api/monitoreo/route.ts'].map((r) =>
    leer(r).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''),
  );

  for (const codigo of fuentes) {
    assert.doesNotMatch(
      codigo,
      /tarifa|porLead|COSTO_POR_LEAD/i,
      'apareció una tarifa por lead: el costo se mide, no se estima',
    );
    assert.doesNotMatch(
      codigo,
      /apify\.com|APIFY_API_TOKEN/i,
      'este proyecto volvió a consultarle a Apify: eso lo hace el backend de scraping',
    );
  }

  // Y la columna se sigue LEYENDO, que es lo que el panel hace con ella.
  assert.match(leer('lib/monitoreo/consumo.ts'), /costo_usd/);
});

// ─── El catálogo y el reparto ───────────────────────────────────────────────

test('el catálogo carga `monitoreo.ver` y NO se la da a ningún rol de puesto', () => {
  const catalogo = leer('db/arranque/001_catalogo.sql');

  assert.ok(
    catalogo.includes("('monitoreo.ver',"),
    'la capacidad no se carga en `identidad.permisos`: el portero rechazaría a todo el mundo',
  );

  // ── LAS DOS LÍNEAS QUE NO SE DERIVAN ─────────────────────────────────────
  //
  // El reparto deriva por EXCLUSIÓN de prefijos, así que una familia nueva cae SOLA en los tres
  // roles de puesto. Cada `not like` que falte tiene una víctima distinta y ninguna de las dos
  // falla:
  //
  //   · sin el de `usuario`      → cualquier persona de cualquier empresa cliente,
  //   · sin el de `administrador`→ el administrador de cada empresa cliente **y el
  //     administrador número cuatro de ARIA**, que es el que la regla de la organización
  //     principal deja pasar y que es justamente lo que se pidió evitar.
  const bloqueDe = (rol: string) => {
    const desde = catalogo.indexOf(`('${rol}', (select`);
    assert.ok(desde > 0, `no se encontró el reparto del rol \`${rol}\``);
    return catalogo.slice(desde, catalogo.indexOf('))', desde));
  };

  for (const rol of ['usuario', 'administrador']) {
    assert.ok(
      bloqueDe(rol).includes("clave not like 'monitoreo.%'"),
      `el reparto del rol \`${rol}\` dejó de excluir \`monitoreo.%\``,
    );
  }
});

test('existe el rol `monitoreo`, con esa capacidad y NADA más', () => {
  // ── POR QUÉ UN ROL Y NO UNA CAPACIDAD DE `administrador` ─────────────────
  //
  // Se pidió que el panel lo vean TRES PERSONAS de ARIA, y ningún rol de puesto puede expresar
  // eso: `administrador` es el mismo rol en ARIA y en cada empresa cliente, y el mismo para
  // todos los administradores de ARIA. Es la salida que la migración 003 escribe como regla —
  // *"si hace falta que alguien tenga CASI un rol, la respuesta es un rol nuevo"*— y lo que la
  // hace viable es que los roles SUMAN: `administrador` + `monitoreo` da la unión.
  const catalogo = leer('db/arranque/001_catalogo.sql');

  // Enumerado, no derivado. Un `select … from identidad.permisos` acá le daría al rol más de lo
  // que su nombre dice, y encima crecería solo con cada capacidad nueva.
  assert.match(
    catalogo,
    /\('monitoreo',\s*array\['monitoreo\.ver'\]\)/,
    'el rol `monitoreo` no reparte exactamente `monitoreo.ver`',
  );

  // ── LAS DOS BANDERAS QUE NO PUEDEN CAMBIAR ───────────────────────────────
  //
  // `solo_principal` en `true` sería la tentación —el disparador de la base obligaría a que
  // quien tenga el rol viva en la organización principal, justo lo que el panel quiere— y sería
  // una ESCALADA: `resolverSesion` calcula `esRolDePlataforma` con `bool_or(solo_principal)`, y
  // ese booleano es lo único que decide si se respeta `sesiones.org_activa`. Marcarlo dejaría a
  // estas tres personas conmutar su sesión a cualquier empresa cliente.
  //
  // `secciones_restringidas` en `true` no restringiría a nadie que además sea `administrador`
  // —el alcance se combina con `bool_and`— y sí dejaría sin ninguna pestaña a quien tuviera solo
  // este rol.
  assert.match(
    catalogo,
    /\('monitoreo', 'Panel de Monitoreo', true, false, false, false\)/,
    'las banderas del rol `monitoreo` cambiaron: revisá `solo_principal` antes que nada',
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
