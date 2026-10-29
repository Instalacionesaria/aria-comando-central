// El resultado a nombre del closer (la `107`): lo que se puede ver leyendo el código. Tipo: Código.
//
// La base (`pruebas/base/335`) mide que la venta registrada a nombre de un closer le llega en la comisión, el cobrado,
// la tabla de Sales y los motivos. Esto cuida lo que esa prueba no recorre: que NINGÚN lector del eje del closer se
// quede con `registrado_por` suelto (el día que aparezca uno nuevo, o que alguien «simplifique» el coalesce), que la
// pantalla diga y mande a nombre de quién, y que la migración sea reaplicable.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');
/** Sin comentarios: una mención en un comentario no es una consulta. */
const codigo = (r: string) =>
  leer(r)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Los lectores de resultados que acreditan a un CLOSER. Los del setter (`comisionDelSetter`, `inicioDelSetter`) no: ahí
 *  `closer_id` es siempre nulo y `registrado_por` es el setter. */
const LECTORES = [
  'lib/negocio/comision.ts',
  'lib/negocio/dineroDelMes.ts',
  'lib/negocio/cierrePorCloser.ts',
  'lib/negocio/economiaDelNegocio.ts',
  'lib/negocio/motivosDeNoVenta.ts',
];

test('cada lector del eje del closer acredita con `closerDelResultado`, y ninguno con `registrado_por` suelto', () => {
  for (const r of LECTORES) {
    const c = codigo(r);
    assert.match(c, /closerDelResultado\(\)/, `${r} no usa \`closerDelResultado\`: lo registrado a nombre de un closer no le llega`);
    assert.doesNotMatch(c, /'registrado_por'/, `${r} todavía corta, agrupa o elige por \`registrado_por\` suelto`);
    assert.doesNotMatch(c, /\.registrado_por\b/, `${r} todavía compara contra \`registrado_por\``);
  }
  // Y el eje es el coalesce, en un solo lugar.
  assert.match(
    codigo('lib/negocio/aNombreDelCloser.ts'),
    /coalesce\(\$\{columna\('closer_id'\)\}, \$\{columna\('registrado_por'\)\}\)/,
    '`closerDelResultado` dejó de ser `coalesce(closer_id, registrado_por)`: las filas viejas pierden a su closer',
  );
});

test('la ruta de Avanzar decide con la sesión, rechaza ANTES de leer la base, y audita lo escrito', () => {
  const ruta = codigo('app/api/contactos/[id]/avanzar/route.ts');
  assert.match(ruta, /const supervisa = puedeSupervisarClosers\(contexto\.permisos\);/, 'quién supervisa no sale de la sesión');
  const rechazo = ruta.indexOf("return rechazo('sin_permiso', MOTIVOS.a_nombre_sin_permiso)");
  const base = ruta.indexOf('await conOrganizacion(contexto.orgEfectiva');
  assert.ok(rechazo > 0 && rechazo < base, 'el 403 de «a nombre de» no va antes de leer la base: depende de que el contacto exista');
  assert.match(ruta, /accion: 'resultado_registrado'/);
  assert.match(ruta, /if \(!r\.yaEstaba\) \{\s*await auditar\(datos\(\),/, 'la auditoría no está en la transacción, o audita los reintentos');
  assert.match(
    codigo('lib/negocio/avanzar.ts'),
    /closer_id: \(\{ closer: lo\.aNombreDe \?\? null, setter: null \} satisfies Record<Territorio, string \| null>\)\[lo\.que\.rol\],/,
    'el resultado no guarda a nombre de quién, o un resultado del setter se acredita a un closer',
  );
});

test('Avanzar dice a nombre de quién y lo manda; el Closer le pasa lo que aplicó el servidor', () => {
  const avanzar = codigo('components/negocio/Avanzar.jsx');
  assert.match(avanzar, /useContext\(RegistroDelCloser\)/, 'Avanzar no lee a quién está mirando el Closer');
  assert.match(avanzar, /aNombreDe: aNombre\.aNombreDe/, 'Avanzar no manda el closer elegido');
  assert.match(avanzar, /\{aNombre\.texto\}/, 'Avanzar no dice a nombre de quién se registra');
  assert.match(codigo('components/negocio/Ficha.jsx'), /closerAsignado=\{closerAsignado\}/);

  const vista = codigo('components/views/CloserView.jsx');
  assert.match(vista, /<RegistroDelCloser\.Provider value=\{registro\}>/);
  assert.match(vista, /datos\?\.puedeRegistrarANombre/, 'el Closer ofrece registrar a nombre con otra regla que la de la ruta');
  /* Lo aplicado por el servidor vale sólo si se pidió con la elección VIGENTE: recién elegido otro closer (o con esa
     carga fallida), los datos de antes nombrarían al closer anterior y la venta se registraría a SU nombre. */
  assert.match(vista, /setDatos\(\{ \.\.\.r\.datos, pedidoCon: verComo \}\);/, 'los datos de Mi Día no dicen con qué elección se pidieron');
  assert.match(
    vista,
    /eleccion: datos\.pedidoCon === verComo \? datos\.eleccion : null,/,
    'Avanzar registra a nombre del closer de la carga anterior mientras llega la del closer recién elegido',
  );

  const selector = codigo('components/closer/SelectorDeCloser.jsx');
  assert.match(selector, /`Se registra a nombre de \$\{k\.nombre\}\.`/);
  assert.match(selector, /if \(!registro\?\.supervisa \|\| !SE_ACREDITA_A_UN_CLOSER\[territorio\]\) return null;/);
  assert.match(selector, /const SE_ACREDITA_A_UN_CLOSER = \{ closer: true, setter: false \};/);
  assert.match(codigo('app/api/closer/mi-dia/route.ts'), /puedeRegistrarANombre: supervisa,/);
});

test('la 107 es aditiva, reaplicable y documentada', () => {
  const m = leer('db/migraciones/107_el_resultado_a_nombre_del_closer.sql');
  assert.match(m, /add column if not exists closer_id uuid/);
  assert.match(m, /drop constraint if exists resultados_org_id_closer_id_fkey;[\s\S]*add constraint resultados_org_id_closer_id_fkey\s+foreign key \(org_id, closer_id\) references identidad\.usuarios \(org_id, id\)/);
  assert.match(m, /comment on column negocio\.resultados\.closer_id is/);
  assert.match(leer('lib/administracion/borrado.ts'), /resultados_org_id_closer_id_fkey: '/);
});
