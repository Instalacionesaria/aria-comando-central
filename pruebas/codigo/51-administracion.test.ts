// ADR-0501 — Un administrador no opera sobre usuarios de otra organización. INNEGOCIABLE.
// ADR-0504 — Un administrador no puede otorgar el rol de plataforma.
// Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE HACE INOLVIDABLE EL FILTRO
//
// El 404 de las tres operaciones de identidad sale de **una** función,
// `usuarioObjetivo()`, que es el único `where('org_id', …)` de ese dominio. La política de
// `identidad.usuarios` para `app_identidad` es `using (true)`: ahí no hay red abajo.
//
// Estas comprobaciones son lo que impide que la operación número seis consulte `usuarios` por su
// cuenta y se olvide la línea. El `07` § 1 lo dice de la versión de organización: *"lo único que lo
// agarra es una prueba que lea el código fuente de cada operación"*.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { archivosFuente, RAIZ } from '../apoyo/fuente.ts';
import { ARCHIVOS_AUTORIZADOS } from '../apoyo/autorizados.ts';

function rutasDeAdministracion(): string[] {
  const dir = join(RAIZ, 'app', 'api', 'admin');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /^route\.(ts|js|tsx|jsx)$/.test(e.name))
    .map((e) => relative(RAIZ, join(e.parentPath, e.name)).split(sep).join('/'))
    .sort();
}

function fuenteDe(ruta: string): string {
  const a = archivosFuente(['app']).find((x) => x.ruta === ruta);
  assert.ok(a, `no se pudo leer ${ruta}`);
  return a.limpio;
}

test('ADR-0501 · ninguna ruta de administración consulta `usuarios` por su cuenta', () => {
  const rutas = rutasDeAdministracion();
  assert.ok(rutas.length > 0, 'no hay rutas de administración: la prueba pasaría en vacío');

  const malas: string[] = [];
  for (const ruta of rutas) {
    const limpio = fuenteDe(ruta);
    // `selectFrom('usuarios')` en una ruta de administración es el lugar exacto donde se olvida el
    // `where org_id`. La consulta va por `usuarioObjetivo()`, que lo lleva siempre.
    if (/selectFrom\s*\(\s*['"]usuarios['"]/.test(limpio)) malas.push(`${ruta} (selectFrom)`);
  }
  assert.deepEqual(
    malas,
    [],
    'la consulta del usuario objetivo va por `usuarioObjetivo()`, que es el único lugar del ' +
      'dominio de identidad donde vive el filtro por organización',
  );
});

test('ADR-0501 · las tres operaciones de identidad SÍ usan `usuarioObjetivo(`', () => {
  // La comprobación de entrada muerta: sin ésta, la de arriba pasaría si nadie consultara nada.
  //
  // El alta no está: no tiene usuario objetivo. Su 404 sale de comparar el `orgId` del cuerpo
  // contra `contexto.orgEfectiva`, y eso está declarado en su propio encabezado.
  const deIdentidad = [
    'app/api/admin/usuarios/[id]/restablecer-password/route.ts',
    'app/api/admin/usuarios/[id]/roles/route.ts',
  ];
  for (const ruta of deIdentidad) {
    assert.match(
      fuenteDe(ruta),
      /\busuarioObjetivo\s*\(/,
      `${ruta} no filtra por organización con la única función que lo hace`,
    );
  }
});

test('ADR-0501 · editar y desactivar van por el DOMINIO DEL INQUILINO', () => {
  // El `09` § 7.16: *"editar y desactivar usuarios **desde el dominio del inquilino**, con su
  // política."* Es lo que les da la red de la base: la consulta no lleva `where org_id` porque lo
  // pone la política, y el 404 sale de que se tocan cero filas.
  //
  // Si alguien las moviera a `conIdentidad()` "para que sea todo igual", perderían esa red y el
  // filtro pasaría a depender de una línea que se puede borrar.
  const delInquilino = [
    'app/api/admin/usuarios/[id]/route.ts',
    'app/api/admin/usuarios/[id]/desactivar/route.ts',
  ];
  for (const ruta of delInquilino) {
    const limpio = fuenteDe(ruta);
    assert.match(limpio, /\bconOrganizacion\s*\(/, `${ruta} no abre el contexto de organización`);
    // Y NO están en la lista de autorizados: la escritura no pasa por la escotilla.
    assert.ok(
      !ARCHIVOS_AUTORIZADOS.includes(ruta) || /\bconIdentidad\s*\(/.test(limpio),
      `${ruta} está autorizado a la escotilla y no la usa: sacalo de la lista`,
    );
    // La comprobación que de verdad importa: la actualización NO lleva `where org_id`.
    assert.doesNotMatch(
      limpio,
      /updateTable\s*\(\s*['"]usuarios['"][\s\S]{0,400}?where\s*\(\s*['"]org_id['"]/,
      `${ruta} filtra por organización a mano: eso reemplaza la red de la política por una línea`,
    );
  }
});

test('ADR-0504 · la barrera del rol de plataforma es una CAPACIDAD, no un nombre de rol', () => {
  const limpio = fuenteDe('app/api/admin/usuarios/[id]/roles/route.ts');
  // La bandera de la base, no la clave del rol.
  assert.match(limpio, /solo_principal/, 'no consulta la bandera `solo_principal`');
  // Y la capacidad. `roles.administrar` NO sirve, y la prueba de base lo demostró: el rol
  // `administrador` la tiene, porque la migración 003 le da todo lo que no empieza con
  // `organizaciones.`. La barrera es `organizaciones.listar`.
  assert.match(
    limpio,
    /permisos\.has\s*\(\s*['"]organizaciones\.listar['"]\s*\)/,
    'la barrera tiene que ser `organizaciones.listar`: el administrador tiene `roles.administrar`',
  );
});

test('ADR-0506 · ninguna ruta de administración registra nada', () => {
  // La misma regla que las rutas de autenticación, por el mismo motivo: un `console.log(cuerpo)`
  // de una noche de depuración escribe la contraseña temporal en un panel que se conserva. Acá el
  // alta y el restablecimiento la tienen en una variable local.
  const conRegistro = rutasDeAdministracion().filter((r) =>
    /\bconsole\s*\.\s*(log|info|debug|warn|error|dir|table|trace)\s*\(/.test(fuenteDe(r)),
  );
  assert.deepEqual(
    conRegistro,
    [],
    'una ruta que tiene la contraseña temporal en una variable no puede tener registro',
  );
});

test('ADR-0502 · las cuatro operaciones sobre un objetivo comprueban el propio identificador', () => {
  // El `05` § 4 pone dos escenarios: *"el administrador se borra a sí mismo"* y *"el administrador
  // se quita su propio rol"*. Editarse el nombre es inofensivo; desactivarse, degradarse y
  // restablecerse la contraseña, no.
  //
  // El restablecimiento está por un motivo que el documento no nombra: para eso existe
  // `POST /api/auth/sesion`, que pide la contraseña ACTUAL. Dejarlo pasar acá sería un camino para
  // cambiarse la contraseña sin saber la vieja, desde una sesión robada.
  const conObjetivo = [
    'app/api/admin/usuarios/[id]/desactivar/route.ts',
    'app/api/admin/usuarios/[id]/roles/route.ts',
    'app/api/admin/usuarios/[id]/restablecer-password/route.ts',
  ];
  for (const ruta of conObjetivo) {
    assert.match(
      fuenteDe(ruta),
      /id\s*===\s*contexto\.usuarioId/,
      `${ruta} no comprueba que el objetivo no sea quien pide`,
    );
  }
});
