// LA SIEMBRA LOCAL DEL NIVEL 3: UNA EMPRESA CON TRES CLIENTES PARA MIRAR EN EL NAVEGADOR, Y REAPLICABLE. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, P7 y C6)
//
// `node scripts/db.mjs sembrar-nivel-3` deja la empresa `gamma` para la verificación en el navegador. Esta prueba la
// siembra con su propio slug, DOS veces, y mira lo que quedó:
//
//   · una empresa, sus tres clientes —el principal, el segundo con su Conexión de prueba y uno de prueba— y las dos
//     personas, con los mismos ids las dos veces — mutación: crear el cliente sin buscarlo antes;
//   · las personas como las del sembrado: la contraseña de desarrollo, debiendo cambiarla, con su rol; el cliente final
//     limitado al segundo, con Leads y Sales — mutación: sin su fila de `usuarios_cuentas`;
//   · los contactos, las citas y los resultados de los dos primeros, cada uno en SU cliente, sin duplicarse —
//     mutaciones: sin borrar lo de la corrida anterior, y los del segundo escritos en el ámbito del principal;
//   · el cliente final entra y ve en Leads los contactos del segundo, y en Sales a su closer con un rótulo;
//     fuera de sus pantallas, 403, y el rechazo queda en la auditoría;
//   · la fase está en `scripts/db.mjs` y fuera de `reset` (la 11 exige exactamente el sembrado de desarrollo);
//   · quitarla se lleva la empresa entera, y por su slug exacto, aunque alguien la haya mirado: la auditoría es de
//     sólo inserción y sus filas quedan — mutación: borrar también la auditoría.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { DOMINIO, leerRespuesta, pedirComo, sesionDe } from '../apoyo/closer.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { verificar } from '../../lib/datos/hash.ts';
import { CLAVE_DESARROLLO } from '../../db/sembrado/organizaciones.ts';
import {
  DATOS_DEL_NIVEL_3,
  quitarElNivel3,
  sembrarElNivel3,
  type NivelTresSembrado,
} from '../../db/sembrado/nivel-3.ts';
import { GET as leads } from '../../app/api/leads-portal/route.ts';
import { GET as sales } from '../../app/api/sales/route.ts';
import { GET as control } from '../../app/api/control/route.ts';

const SLUG = 'gamma-300';
const RAIZ = join(import.meta.dirname, '..', '..');

let admin: Client;
let primera: NivelTresSembrado;
let segunda: NivelTresSembrado;

const sinCreadas = (s: NivelTresSembrado) => ({ org: s.org, clientes: s.clientes, personas: s.personas });

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  await quitarElNivel3({ slug: SLUG });
  primera = await sembrarElNivel3({ slug: SLUG });
  segunda = await sembrarElNivel3({ slug: SLUG });
});

after(async () => {
  try {
    await quitarElNivel3({ slug: SLUG });
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('una empresa, sus tres clientes y sus dos personas, los mismos aunque se siembre dos veces', async () => {
  assert.deepEqual(sinCreadas(segunda), sinCreadas(primera), 'la segunda siembra creó otra empresa, otro cliente u otra persona');
  assert.ok(primera.creadas.length > 0);
  assert.deepEqual(segunda.creadas, [], 'la segunda siembra volvió a crear algo');
  const orgs = await filas<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  assert.deepEqual(orgs.map((o) => o.id), [primera.org]);

  const clientes = await filas<{ id: string; slug: string; estado: string; por_omision: boolean; prueba: boolean; crm: string | null; nicho: string | null }>(
    admin,
    `select id, slug, estado, es_por_omision as por_omision, es_prueba as prueba, crm_cuenta_id as crm, nicho
       from identidad.cuentas where org_id = $1 order by es_por_omision desc, slug`,
    [primera.org],
  );
  const { principal, segundo, dePrueba } = primera.clientes;
  assert.deepEqual(
    clientes.map((c) => [c.id, c.estado, c.por_omision, c.prueba, c.crm, c.nicho]),
    [
      [principal, 'activa', true, false, null, 'odontologia'],
      [dePrueba, 'activa', false, true, null, null],
      [segundo, 'activa', false, false, `${SLUG}-subcuenta-de-prueba`, 'medicina_estetica'],
    ],
  );
});

test('la Conexión de prueba es sólo del segundo', async () => {
  const conexiones = await filas<{ cuenta: string; token: boolean; estado: string; calendario: string | null }>(
    admin,
    `select cuenta_id as cuenta, crm_token_cifrado is not null as token, crm_estado as estado, crm_calendario_id as calendario
       from identidad.cuentas_credenciales where org_id = $1`,
    [primera.org],
  );
  assert.deepEqual(conexiones, [{ cuenta: primera.clientes.segundo, token: true, estado: 'activa', calendario: `${SLUG}-calendario` }]);
});

test('las dos personas, como las del sembrado; el cliente final, limitado al segundo y con Leads y Sales', async () => {
  const personas = await filas<{ id: string; email: string; hash: string; debe: boolean; limitado: boolean; rol: string }>(
    admin,
    `select u.id, u.email, u.password_hash as hash, u.debe_cambiar_password as debe, u.limitado_a_cuentas as limitado, r.clave as rol
       from identidad.usuarios u join identidad.usuarios_roles ur on ur.usuario_id = u.id join identidad.roles r on r.id = ur.rol_id
      where u.org_id = $1 order by u.email`,
    [primera.org],
  );
  assert.deepEqual(
    personas.map((p) => [p.id, p.email, p.debe, p.limitado, p.rol]),
    [
      [primera.personas.admin, `admin@${SLUG}.test`, true, false, 'administrador'],
      [primera.personas.cliente, `cliente@${SLUG}.test`, true, true, 'usuario'],
    ],
  );
  for (const p of personas) assert.equal(verificar(CLAVE_DESARROLLO, p.hash), true, `el hash de ${p.email} no verifica`);
  const cuentas = await filas<{ cuenta: string }>(admin, `select cuenta_id as cuenta from identidad.usuarios_cuentas where usuario_id = $1`, [
    primera.personas.cliente,
  ]);
  assert.deepEqual(cuentas.map((c) => c.cuenta), [primera.clientes.segundo], 'el cliente final no quedó limitado al segundo');
  const secciones = await filas<{ seccion: string }>(
    admin,
    `select seccion from identidad.usuarios_secciones where usuario_id = $1 order by seccion`,
    [primera.personas.cliente],
  );
  assert.deepEqual(secciones.map((s) => s.seccion), ['contacts', 'sales']);
});

test('los contactos, las citas y los resultados de los dos primeros quedan en SU cliente, sin duplicarse', async () => {
  const conteo = await filas<{ cuenta: string; contactos: number; citas: number; resultados: number; ventas: number }>(
    admin,
    `select c.id as cuenta,
            (select count(*)::int from negocio.contactos x where x.org_id = c.org_id and x.cuenta_id = c.id) as contactos,
            (select count(*)::int from negocio.citas x where x.org_id = c.org_id and x.cuenta_id = c.id) as citas,
            (select count(*)::int from negocio.resultados x where x.org_id = c.org_id and x.cuenta_id = c.id) as resultados,
            (select count(*)::int from negocio.resultados x where x.org_id = c.org_id and x.cuenta_id = c.id and x.salida = 'venta') as ventas
       from identidad.cuentas c where c.org_id = $1`,
    [primera.org],
  );
  const de = (cuenta: string) => conteo.find((c) => c.cuenta === cuenta);
  const { principal, segundo, dePrueba } = primera.clientes;
  for (const [cuenta, cual] of [[principal, 'principal'], [segundo, 'segundo']] as const) {
    const d = DATOS_DEL_NIVEL_3[cual];
    assert.deepEqual(
      de(cuenta),
      { cuenta, contactos: d.contactos, citas: d.citas, resultados: d.resultados.length, ventas: 1 },
      `los datos del ${cual} no son los sembrados (o se duplicaron, o quedaron en otro cliente)`,
    );
  }
  assert.deepEqual(de(dePrueba), { cuenta: dePrueba, contactos: 0, citas: 0, resultados: 0, ventas: 0 });
  const closers = await filas<{ cuenta: string; usuario: string }>(
    admin,
    `select cuenta_id as cuenta, usuario_id as usuario from negocio.closer_asignado where org_id = $1 order by cuenta_id = $2 desc`,
    [primera.org, principal],
  );
  assert.deepEqual(closers, [
    { cuenta: principal, usuario: primera.personas.admin },
    { cuenta: segundo, usuario: primera.personas.admin },
  ]);
});

test('el cliente final entra: ve en Leads los contactos del segundo, y en Sales a su closer con un rótulo; nada más', async () => {
  const token = await sesionDe(primera.personas.cliente);
  const l = await leerRespuesta<{ cohorte: { universo: number } }>(await leads(pedirComo('/api/leads-portal?periodo=completo', token)));
  assert.equal(l.estado, 200, JSON.stringify(l.cuerpo));
  assert.equal(l.cuerpo.cohorte.universo, DATOS_DEL_NIVEL_3.segundo.contactos);
  const s = await leerRespuesta<{ pantalla: { closers: { filas: { usuarioId: string; nombre: string }[] } } }>(
    await sales(pedirComo('/api/sales?periodo=30d', token)),
  );
  assert.equal(s.estado, 200, JSON.stringify(s.cuerpo));
  assert.deepEqual(s.cuerpo.pantalla.closers.filas.map((f) => [f.usuarioId, f.nombre]), [['closer-1', 'Closer 1']]);
  // Fuera de sus pantallas, el portero lo rechaza y lo audita: es lo que deja quien mira la siembra en el navegador.
  const c = await leerRespuesta<{ codigo: string }>(await control(pedirComo('/api/control', token)));
  assert.deepEqual({ estado: c.estado, codigo: c.cuerpo.codigo }, { estado: 403, codigo: 'fuera_de_su_cuenta' });
});

test('la fase está en scripts/db.mjs, y fuera de reset', () => {
  const texto = readFileSync(join(RAIZ, 'scripts', 'db.mjs'), 'utf8');
  const fases = /const FASES = \{([\s\S]*?)\};/.exec(texto)?.[1] ?? '';
  assert.match(fases, /'sembrar-nivel-3': sembrarNivel3/);
  assert.match(fases, /'quitar-nivel-3': quitarNivel3/);
  const reset = /const RESET = \[([\s\S]*?)\];/.exec(texto)?.[1] ?? '';
  assert.ok(reset.includes("'sembrar'"), 'no se encontró la lista de reset');
  assert.ok(!reset.includes('nivel-3'), 'la siembra del nivel 3 entró en reset: la prueba 11 exige exactamente el sembrado de desarrollo');
});

test('quitarla se lleva la empresa entera, y sólo ésa, aunque alguien la haya mirado', async () => {
  const auditada = await unaFila<{ n: number }>(admin, `select count(*)::int as n from identidad.auditoria_accesos where org_id = $1`, [primera.org]);
  assert.ok((auditada?.n ?? 0) > 0, 'la empresa no tiene ninguna fila de auditoría: la prueba no mira lo que dice');
  const otra = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Prefijo 300', $1, 'UTC') returning id`,
    [`${SLUG}-otra`],
  );
  assert.ok(otra);
  try {
    assert.equal(await quitarElNivel3({ slug: SLUG }), 1);
    const quedan = await filas<{ slug: string }>(admin, `select slug from identidad.organizaciones where slug like $1 order by slug`, [`${SLUG}%`]);
    assert.deepEqual(quedan.map((o) => o.slug), [`${SLUG}-otra`], 'quitar no fue por el slug exacto');
    const restos = await unaFila<{ n: number }>(
      admin,
      `select (select count(*) from identidad.usuarios where org_id = $1) + (select count(*) from negocio.contactos where org_id = $1)
            + (select count(*) from identidad.cuentas where org_id = $1) as n`,
      [primera.org],
    );
    assert.equal(Number(restos?.n), 0);
  } finally {
    await admin.query(`delete from identidad.organizaciones where id = $1`, [otra.id]);
  }
});
