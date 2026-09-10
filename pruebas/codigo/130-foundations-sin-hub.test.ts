// El almacén de Fundaciones vive en la base propia, por organización. **Sin ARIA-brain.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE PASÓ, Y POR QUÉ HAY UNA PRUEBA
//
// Hasta el 2026-09-07 el estado de ICP & Oferta y Tools vivía en `aria_brain_client_state`, la tabla
// de ARIA-brain, indexada por el alumno del hub. Para que una organización abriera la pantalla había
// que pegarle en Ajustes el `cliente_id` de su cuenta en el hub — y un cliente nacido en Comando
// Central NO tiene cuenta en el hub. Jorge se registró como cliente y no pudo entrar. Kevin: *«no
// quiero que dependa de ARIA-brain… el cliente solo debería preocuparse por poner su API Key de
// Anthropic para empezar a usar el ICP & Oferta»*.
//
// Esta prueba custodia el corte en las tres capas donde podría volver: el almacén, el resolver y la
// pantalla de Ajustes.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, archivosQueContienen, sinComentarios } from '../apoyo/fuente.ts';

const codigo = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

test('el almacén lee y escribe en `public.aria_cc_foundations` por organización, dentro del aislamiento', () => {
  const almacen = sinComentarios(codigo('lib/fundaciones/almacen.ts'));
  assert.match(almacen, /const TABLA = 'public\.aria_cc_foundations' as const;/);
  // Va por la capa de datos del proyecto —transacción con `app.org_id`—, no por PostgREST con una
  // llave de servicio ajena.
  assert.match(almacen, /conOrganizacion\(orgId, \(\) => trabajo\(datos\(\)\)\)/);
  assert.ok(!/ALMACEN_HUB|aria_brain_client_state|pedirExterno|cliente_id/.test(almacen), 'el almacén volvió a hablar con el hub');
  // Si ya hay contexto abierto, tiene que ser el de ESTA organización. Un contexto ajeno se rechaza.
  assert.match(almacen, /if \(abierta !== orgId\) \{\s*throw new Error/);
  // Escribir es un upsert por `org_id`: la fila se crea la primera vez y se actualiza después.
  assert.match(almacen, /oc\.column\('org_id'\)\.doUpdateSet/);
});

test('nadie más habla con el almacén de ARIA-brain, y `sin_alumno_vinculado` no existe', () => {
  // Ni la aplicación ni la interfaz. `scripts/altas-high-ticket.mjs` es la única excepción: lee las
  // CUENTAS del hub para dar de alta, y eso no es el estado de Fundaciones.
  const hablan = archivosQueContienen(/ALMACEN_HUB_URL|aria_brain_client_state/, ['app', 'components', 'lib']);
  assert.deepEqual(hablan, [], 'algo volvió a apuntar al almacén de ARIA-brain');

  const enCodigo = archivosQueContienen(/sin_alumno_vinculado/, ['app', 'components', 'lib']).filter((r) =>
    /sin_alumno_vinculado/.test(sinComentarios(codigo(r))),
  );
  assert.deepEqual(enCodigo, [], 'el código `sin_alumno_vinculado` volvió a existir fuera de un comentario');
});

test('para generar hace falta la llave de IA y nada más', () => {
  const resolver = sinComentarios(codigo('lib/credenciales/resolver.ts'));
  assert.match(resolver, /export type FaltaParaGenerar = 'sin_llave_de_ia' \| 'llave_de_ia_ilegible';/);
  // El acceso a Fundaciones ES la llave más el `org_id` del portero. No lee ninguna otra columna.
  const i = resolver.indexOf('export async function resolverAccesoAFundaciones');
  const cuerpo = resolver.slice(i, resolver.indexOf('\n}\n', i));
  assert.match(cuerpo, /resolverLlaveDeIa\(db, orgId\)/);
  assert.ok(!/fundaciones_cliente_id/.test(cuerpo), 'el acceso a Fundaciones volvió a exigir el alumno del hub');
  assert.ok(!/resolverAlumnoDeFundaciones/.test(resolver), 'el resolver del alumno del hub volvió');

  // Y el tipo que viaja por las ocho rutas lleva la organización, no el alumno.
  const operaciones = sinComentarios(codigo('lib/fundaciones/operaciones.ts'));
  assert.match(operaciones, /export interface Alumno \{\s*orgId: string;\s*\}/);
  assert.ok(!/clienteId/.test(operaciones));
});

test('las rutas de estado abren el contexto de su organización, y las que gastan solo leen la llave', () => {
  for (const ruta of ['app/api/fundaciones/estado/route.ts', 'app/api/tools/estado/route.ts']) {
    const fuente = sinComentarios(codigo(ruta));
    assert.match(fuente, /const alumno = \{ orgId: contexto\.orgEfectiva \};/, `${ruta} no toma la organización del portero`);
    assert.match(fuente, /conOrganizacion\(contexto\.orgEfectiva, \(\) => leerElEstado\(alumno\)\)/, ruta);
    assert.ok(!/conIdentidad/.test(fuente), `${ruta} sigue usando la escotilla para leer el estado`);
  }
  for (const ruta of [
    'app/api/fundaciones/generar/route.ts',
    'app/api/fundaciones/conversar/route.ts',
    'app/api/fundaciones/rellenar/route.ts',
    'app/api/tools/generar/route.ts',
    'app/api/tools/conversar/route.ts',
    'app/api/tools/rellenar/route.ts',
  ]) {
    const fuente = sinComentarios(codigo(ruta));
    assert.match(fuente, /resolverAccesoAFundaciones\(db, contexto\.orgEfectiva\)/, ruta);
    // NO abren `conOrganizacion(` en la ruta: una transacción abierta durante los minutos que tarda
    // el modelo retiene una conexión por nada. El almacén abre una corta por operación.
    assert.ok(!/conOrganizacion\s*\(/.test(fuente), `${ruta} abre una transacción alrededor de la llamada al modelo`);
  }
});

test('Ajustes ya no le pide al cliente el identificador de su cuenta en el hub', () => {
  assert.ok(!/fundacionesClienteId|Alumno de Fundaciones/.test(codigo('components/ajustes/Credenciales.jsx')));
  assert.ok(!/fundacionesClienteId/.test(sinComentarios(codigo('app/api/admin/credenciales/route.ts'))));
  assert.ok(!/fundacionesClienteId/.test(sinComentarios(codigo('lib/credenciales/resolver.ts'))));
  // El texto que ve la persona tampoco lo nombra.
  assert.ok(!/sin_alumno_vinculado|cuenta del hub/.test(codigo('lib/fundaciones/mensajes.ts')));
});

test('la tabla está declarada en el esquema con la columna de los chats', () => {
  const esquema = sinComentarios(codigo('lib/datos/esquema.ts'));
  assert.match(esquema, /'public\.aria_cc_foundations': TablaFoundations;/);
  for (const col of ['profile', 'history', 'market_research', 'deep_research', 'cat_chat', 'intake', 'tool_chats']) {
    assert.match(esquema, new RegExp(`\\b${col}: unknown;`), `falta la columna ${col} en TablaFoundations`);
  }
});

test('este repositorio NO migra `public.aria_cc_foundations`: la tabla es de otro dueño', async () => {
  /* ── ACÁ HABÍA UNA AFIRMACIÓN QUE NO PODÍA PASAR EN NINGUNA MÁQUINA ────────
   *
   * Leía `<raíz>/../migraciones/011_foundations_sin_hub.sql` —un directorio HERMANO de este
   * repositorio— y comprobaba cuatro líneas de su SQL. Ese archivo no está en el repositorio, no
   * está en el disco de nadie y nunca estuvo versionado acá: comprobado con `git log --all`. O sea
   * que la prueba venía ROJA desde que se escribió, en local y en la integración continua.
   *
   * Y un rojo permanente no se arregla, se ignora — y con él se ignoran los demás. Es el mismo
   * argumento que este proyecto usa cinco veces en `scripts/paridad.mjs` para sacar una vista de
   * la comparación. Vale igual para una prueba.
   *
   * ── POR QUÉ EL ARCHIVO ESTÁ AFUERA, QUE NO ES UN DESCUIDO ─────────────────
   *
   * `esquema.ts` lo dice: el esquema `public` **se comparte con la plataforma anterior**
   * (`public.closer_*`), así que sus migraciones viven en `/migraciones`, en la raíz del proyecto,
   * y no en `db/migraciones/`, que es lo que este repositorio aplica. Traer el archivo acá sería
   * peor que no tenerlo: dos repositorios migrando el mismo esquema compartido.
   *
   * ── Y LO QUE SÍ SE PUEDE AFIRMAR DESDE ACÁ ────────────────────────────────
   *
   * Justamente eso: que la frontera se respete en la dirección que este repositorio controla.
   * Ninguna migración de `db/migraciones/` puede crear ni alterar esa tabla. El defecto que impide
   * es el que traer el archivo habría causado — dos dueños para una tabla compartida, y el orden
   * en que se apliquen decidiendo quién gana.
   *
   * Lo que se pierde, dicho de frente: nadie comprueba automáticamente el CONTENIDO de esa
   * migración. Se pierde poco —una migración ya aplicada no cambia— y lo que de verdad falta es
   * otra cosa, que queda anotada: `public.aria_cc_foundations` **no existe en la base local**, así
   * que ICP & Oferta y Tools no pueden guardar nada en una máquina de desarrollo. Eso no es una
   * prueba que falte: es una pieza del arranque local que falta. */
  const { readdirSync } = await import('node:fs');
  const migraciones = readdirSync(join(RAIZ, 'db/migraciones')).filter((f) => f.endsWith('.sql'));
  assert.ok(migraciones.length > 30, `solo ${migraciones.length} migraciones: la lista cambió de sitio`);

  const invasoras = migraciones.filter((f) =>
    /(create|alter|drop)\s+table[^;]*aria_cc_foundations/i.test(
      sinComentarios(codigo(join('db/migraciones', f))),
    ),
  );
  assert.deepEqual(
    invasoras,
    [],
    'una migración de este repositorio toca `public.aria_cc_foundations`, que la comparte con la ' +
      'plataforma anterior y se migra desde `/migraciones`: quedan dos dueños para una misma tabla',
  );
});
