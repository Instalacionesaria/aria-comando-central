// ADR-0003 — "Hay dos organizaciones con datos distintos en desarrollo."
// Tipo: Base. INNEGOCIABLE (⛔), y el innegociable nº 7: "el más barato de la lista
// y el que más defectos va a encontrar."
//
// PRUEBAS lo justifica así: "con una sola organización en desarrollo, NINGUNO de los
// defectos de esta familia se manifiesta. Todos se ven perfectos. El filtro que
// falta devuelve lo correcto porque hay un solo dueño posible."
//
// Todo corre conectando como `app_identidad`, el rol REAL de la aplicación. Con el
// propietario "casi nada de esto se manifiesta y todo se ve perfecto" (09 § 1).

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { conectar, cerrarTodo, unaFila, filas } from '../apoyo/conexiones.ts';
import { verificar } from '../../lib/datos/hash.ts';
import { CLAVE_DESARROLLO, SLUG_PRINCIPAL, SLUGS_CLIENTE } from '../../db/sembrado/organizaciones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';

let ident: Client;

before(async () => {
  ident = await conectar('identidad');
});

after(async () => {
  await cerrarTodo();
  await cerrarClientes();
});

test('hay tres organizaciones: la principal y las DOS sembradas', async () => {
  const orgs = await filas<{ slug: string; es_principal: boolean }>(
    ident,
    'select slug, es_principal from identidad.organizaciones order by slug',
  );
  assert.equal(orgs.length, 3, 'una principal más las dos organizaciones cliente');

  const principal = orgs.filter((o) => o.es_principal);
  assert.equal(principal.length, 1, 'tiene que haber EXACTAMENTE una organización principal');
  assert.equal(principal[0]?.slug, SLUG_PRINCIPAL);

  // "Las dos organizaciones sembradas" del criterio de cierre son éstas. Existen
  // como clientes, no como la plataforma, porque las pruebas de aislamiento de la
  // Etapa 2 tienen que comparar CLIENTE contra CLIENTE: el usuario de la principal
  // es el superadministrador con `orgEfectiva` conmutable, el peor fixture posible
  // para la prueba más importante del proyecto.
  const clientes = orgs.filter((o) => !o.es_principal).map((o) => o.slug);
  assert.deepEqual(clientes.sort(), [...SLUGS_CLIENTE].sort());
});

test('los datos son DISTINTOS entre organizaciones, no dos copias', async () => {
  const orgs = await filas<{ slug: string; nombre: string; zona_horaria: string }>(
    ident,
    'select slug, nombre, zona_horaria from identidad.organizaciones',
  );
  const distintos = (xs: string[]) => new Set(xs).size === xs.length;

  assert.ok(distintos(orgs.map((o) => o.slug)), 'los slugs tienen que ser distintos');
  assert.ok(distintos(orgs.map((o) => o.nombre)), 'los nombres tienen que ser distintos');
  // La zona horaria distinta es a propósito: si el producto tiene la noción de
  // "hoy", la frontera del día la calcula la base con la zona de la organización.
  // Con todas en UTC, los defectos de frontera de día del 08 § 12.2 no aparecen
  // hasta que un cliente en otra zona compare totales con sus propios informes.
  assert.ok(distintos(orgs.map((o) => o.zona_horaria)), 'las zonas horarias tienen que ser distintas');
});

test('hay un usuario en cada organización', async () => {
  const total = await unaFila<{ n: number }>(ident, 'select count(*)::int as n from identidad.usuarios');
  assert.equal(total?.n, 3);

  const porOrg = await filas<{ org_id: string; n: number }>(
    ident,
    'select org_id, count(*)::int as n from identidad.usuarios group by org_id',
  );
  assert.equal(porOrg.length, 3, 'tres organizaciones con usuarios');
  for (const g of porOrg) {
    assert.equal(g.n, 1, `la organización ${g.org_id} tiene ${g.n} usuarios, se esperaba 1`);
  }

  // Y cada usuario pertenece a una organización que existe. La clave foránea ya lo
  // garantiza; esto lo afirma para que se lea.
  const huerfanos = await filas<{ id: string }>(
    ident,
    `select u.id from identidad.usuarios u
       left join identidad.organizaciones o on o.id = u.org_id
      where o.id is null`,
  );
  assert.deepEqual(huerfanos, []);
});

test('los emails son distintos y hay exactamente un administrador fundador', async () => {
  const us = await filas<{ email: string | null; es_admin_principal: boolean }>(
    ident,
    'select email, es_admin_principal from identidad.usuarios',
  );
  const emails = us.map((u) => (u.email ?? '').toLowerCase());
  assert.equal(new Set(emails).size, emails.length, 'los emails tienen que ser distintos');
  assert.ok(!emails.includes(''), 'los usuarios sembrados llevan email');

  // El índice único parcial `usuarios_un_admin_principal` no deja que haya dos.
  // Existe uno porque el cierre de la Etapa 1 necesita probar que NO se puede
  // borrar, desactivar ni degradar — y sin un fundador esas tres pruebas no tienen
  // sujeto.
  assert.equal(us.filter((u) => u.es_admin_principal).length, 1);
});

test('el hash guardado VERIFICA, y declara sus propios parámetros', async () => {
  const us = await filas<{ email: string | null; password_hash: string | null }>(
    ident,
    'select email, password_hash from identidad.usuarios',
  );

  for (const u of us) {
    // La restricción `usuarios_credenciales_completas` exige que email y hash vayan
    // juntos o no vayan.
    assert.ok(u.password_hash, `${u.email} no tiene password_hash`);

    // Los parámetros van DENTRO del string. Es lo que permite subir el costo sin
    // invalidar las contraseñas viejas: cada hash se verifica con los parámetros
    // con los que nació (02 § 1).
    assert.match(
      u.password_hash,
      /^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/,
      `el hash de ${u.email} no declara sus parámetros`,
    );

    // Y verifica de verdad. Una columna no nula con un hash inservible sería
    // exactamente un éxito reportado que no ocurrió.
    assert.equal(verificar(CLAVE_DESARROLLO, u.password_hash), true, `el hash de ${u.email} no verifica`);
    assert.equal(
      verificar(CLAVE_DESARROLLO + 'x', u.password_hash),
      false,
      'una contraseña incorrecta no puede verificar',
    );
  }

  // Nacen debiendo cambiarla, que es lo que hace un alta real.
  const pendientes = await unaFila<{ n: number }>(
    ident,
    'select count(*)::int as n from identidad.usuarios where debe_cambiar_password',
  );
  assert.equal(pendientes?.n, 3);
});

test('el propietario de las tablas NO ve una sola fila', async () => {
  // La demostración POSITIVA de que `force row level security` está haciendo su
  // trabajo, y de que el sembrado NO PUDO haber sido una migración.
  //
  // Esta afirmación es la que convierte la resolución del conflicto de secuencia en
  // algo que falla si alguien "arregla" el sembrado moviéndolo a una migración con
  // una política de mantenimiento para `migrador`.
  const mig = await conectar('migrador');
  const orgs = await unaFila<{ n: number }>(mig, 'select count(*)::int as n from identidad.organizaciones');
  const usuarios = await unaFila<{ n: number }>(mig, 'select count(*)::int as n from identidad.usuarios');
  assert.equal(orgs?.n, 0, 'migrador ve organizaciones: el forzado de RLS no está puesto');
  assert.equal(usuarios?.n, 0, 'migrador ve usuarios: el forzado de RLS no está puesto');
});
