// Las fronteras de los cuatro roles, del lado del código. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE ARCHIVO VIGILA
//
// `pruebas/base/22-los-cuatro-roles.test.ts` mide el reparto contra la base: qué capacidades tiene
// cada rol y qué pantallas le habilitan. Eso es la mitad.
//
// La otra mitad es de forma, y son las tres maneras concretas en que esta frontera se rompe sin que
// nada falle:
//
//   1 · Una pestaña que pregunta por la capacidad EQUIVOCADA. Ya pasó: Usuarios preguntaba por
//       `organizaciones.listar` mientras su sección declaraba `usuarios.ver`.
//   2 · Un control que DEDUCE un permiso en vez de preguntárselo al servidor. Cuando las dos
//       mitades calculan lo mismo por caminos distintos, un día dejan de coincidir y la pantalla
//       ofrece algo que va a ser rechazado.
//   3 · Un borrado que pierde su filtro por organización. Es el único fallo irreversible de todo
//       lo que se agregó, y depende de por cuál dominio corre la consulta.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { archivosFuente } from '../apoyo/fuente.ts';
import { SECCIONES } from '../../lib/autorizacion/secciones.ts';

function fuente(ruta: string): string {
  const a = archivosFuente(['app', 'components', 'lib']).find((x) => x.ruta === ruta);
  assert.ok(a, `no se encontró ${ruta}`);
  return a.limpio;
}

test('cada pestaña de Ajustes pregunta por SU sección, no por la de al lado', () => {
  const v = fuente('components/views/AjustesView.jsx');

  // El bloque de las pestañas, para no contar menciones de los comentarios ni de otros lugares.
  const bloque = v.slice(v.indexOf('const PESTANAS'), v.indexOf('.filter((p) => p.visible)'));
  assert.ok(bloque.length > 0, 'no se encontró la lista de pestañas');

  for (const clave of ['credenciales', 'empresas', 'usuarios']) {
    // Cada pestaña se declara con su clave y se decide con `puede('<esa misma clave>')`. El defecto
    // que esto atrapa es exactamente el que había: `clave: 'usuarios'` decidido por
    // `puede('empresas')`.
    const re = new RegExp(`clave: '${clave}'[^}]*?puede\\('${clave}'\\)`);
    assert.match(
      bloque,
      re,
      `la pestaña «${clave}» no se decide por su propia sección: es el defecto que tenía Usuarios, ` +
        'y no falla — habilita o esconde con el criterio de otra pantalla',
    );
  }

  // Y las tres claves existen como secciones de verdad, cada una con su capacidad. Sin esto, un
  // `puede('usuarios')` sobre una sección que nadie declara sería siempre falso: la pestaña
  // desaparecería para todo el mundo y no habría ningún error.
  for (const clave of ['credenciales', 'empresas', 'usuarios']) {
    const s = SECCIONES.find((x) => x.clave === clave);
    assert.ok(s, `la sección «${clave}» no existe en secciones.ts`);
    assert.ok(s.capacidadRequerida, `la sección «${clave}» no declara capacidad`);
  }
});

test('el selector de empresa del alta PREGUNTA el permiso, no lo deduce', () => {
  const u = fuente('components/ajustes/Usuarios.jsx');

  // La respuesta del servidor, que es la misma condición que comprueba la ruta antes de aceptar un
  // `orgId` ajeno. Deducirla acá —por ejemplo mirando si la lista de empresas tiene más de una—
  // daría un selector que ofrece empresas para las que la petición va a devolver 404.
  assert.match(
    u,
    /sesion\?\.puedeCambiarDeEmpresa/,
    'el selector de empresa dejó de preguntarle el permiso al servidor',
  );
  // Y no se compara ningún nombre de rol. `ADR-0302` lo prohíbe y el guardia de
  // `30-portero.test.ts` ya cubre los cuatro; esto lo afirma en el archivo que más tentado estaría.
  assert.doesNotMatch(u, /superadministrador|'administrador'/, 'compara un nombre de rol');
});

test('el servidor acota la empresa elegida con la MISMA condición que el conmutador', () => {
  // Las dos mitades tienen que decir lo mismo. Si el alta aceptara un `orgId` ajeno con una
  // condición más laxa que la del conmutador, habría un camino para escribir en otra empresa que no
  // pasa por la regla que gobierna todo lo demás.
  const alta = fuente('app/api/admin/usuarios/route.ts');
  const conmutador = fuente('app/api/auth/sesion/route.ts');

  const condicion = /esRolDePlataforma[\s\S]{0,120}?permisos\.has\('organizaciones\.listar'\)/;
  assert.match(alta, condicion, 'el alta acepta una empresa ajena sin la condición del conmutador');
  assert.match(conmutador, /esRolDePlataforma/, 'el conmutador dejó de exigir el rol de plataforma');
});

test('borrar una PERSONA va por el dominio del inquilino; borrar una EMPRESA, por identidad', () => {
  // Es la decisión de la migración 012, y la que decide si el peor fallo posible es alcanzable.
  //
  // Personas: la política del inquilino filtra por organización, así que borrar a alguien de otra
  // empresa es imposible — la fila no se ve y el `delete` toca cero. Si esto se moviera a
  // `conIdentidad()`, el único freno pasaría a ser un `where org_id` que se puede borrar.
  const persona = fuente('app/api/admin/usuarios/[id]/route.ts');
  assert.match(persona, /export async function DELETE/, 'no existe el borrado de personas');
  assert.match(persona, /conOrganizacion\s*\(/, 'el borrado de personas no abre el contexto del inquilino');
  assert.doesNotMatch(
    persona,
    /conIdentidad\s*\(/,
    'el borrado de personas se movió al dominio de identidad: pierde la red de la política',
  );
  // Y su `delete` NO lleva filtro a mano: lo pone la política. Un `where org_id` acá reemplazaría
  // la red por una línea, que es lo contrario de lo que se buscaba.
  assert.doesNotMatch(
    persona,
    /deleteFrom\s*\(\s*['"]usuarios['"][\s\S]{0,200}?where\s*\(\s*['"]org_id['"]/,
    'el borrado filtra por organización a mano en vez de dejárselo a la política',
  );

  // Empresas: al revés, y por el motivo simétrico. La política del inquilino solo alcanza la
  // organización PROPIA (`id = app.org_id`), y esto es una operación sobre una que no es la propia.
  const empresa = fuente('app/api/admin/organizaciones/[id]/route.ts');
  assert.match(empresa, /export async function DELETE/, 'no existe el borrado de empresas');
  assert.match(empresa, /conIdentidad\s*\(/, 'el borrado de empresas no usa el dominio de identidad');
});

test('las capacidades de borrar son PROPIAS, no las de editar ni las de desactivar', () => {
  // Desactivar es reversible y borrar no. Reusar la capacidad de una para la otra convertiría
  // «puede sacar a alguien de circulación» en «puede hacer desaparecer su rastro» sin que nadie
  // otorgue nada nuevo.
  const persona = fuente('app/api/admin/usuarios/[id]/route.ts');
  assert.match(persona, /exigir\(peticion, \['usuarios\.borrar'\],/, 'el borrado de personas no exige `usuarios.borrar`');

  const empresa = fuente('app/api/admin/organizaciones/[id]/route.ts');
  assert.match(
    empresa,
    /exigir\(peticion, \['organizaciones\.borrar'\],/,
    'el borrado de empresas no exige `organizaciones.borrar`',
  );
  assert.match(
    empresa,
    /exigir\(peticion, \['organizaciones\.editar'\],/,
    'editar una empresa no exige `organizaciones.editar`',
  );
});

test('ninguna ruta comprueba `es_principal` a mano: eso es de la base', () => {
  // El criterio de `007_invariantes.sql`: *"un condicional se saltea con un script, una consola de
  // administración, un endpoint nuevo o una sentencia a mano un domingo. Un disparador no."*
  //
  // Y hay una razón adicional para que la aplicación NO lo repita: con dos definiciones de la misma
  // regla, la que se olvida de actualizar es siempre la de arriba — y entonces la pantalla deja
  // pasar algo que la base rechaza, o al revés, prohíbe algo que sí se puede.
  for (const ruta of [
    'app/api/admin/organizaciones/[id]/route.ts',
    'app/api/admin/usuarios/[id]/route.ts',
    'app/api/admin/usuarios/[id]/desactivar/route.ts',
  ]) {
    const t = fuente(ruta);
    assert.doesNotMatch(
      t,
      /(if|&&|\|\|)[^\n]*\bes_principal\b|\bes_admin_principal\b\s*(===?|!==?)/,
      `${ruta} comprueba a mano lo que ya garantiza un disparador: dos definiciones de la ` +
        'misma regla, y la de acá es la que se va a quedar vieja',
    );
  }
});
