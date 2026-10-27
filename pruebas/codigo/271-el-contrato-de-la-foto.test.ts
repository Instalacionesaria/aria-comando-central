// EL CONTRATO DE LA FOTO DE LOS NEGOCIOS: SUS COLUMNAS, SU ESCRITOR Y LO QUE NO GUARDA. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, Paso 8)
//
// La foto la va a leer un agente que saca conclusiones, y un agente no pregunta qué quiso decir una columna:
//
//   · las columnas del contrato son las de la `089` y las que suman las que la amplían (la `099`), y cada una tiene su
//     comentario, que es el diccionario del agente — mutación: una columna sin `comment on`;
//   · el diccionario dice la lista de hoy: el último comentario de `faltan` nombra exactamente las claves de
//     `PASOS_DEL_CLIENTE`, y el de `contrato` llega hasta `CONTRATO_DE_LA_FOTO`; cambiar la lista sin subir el contrato
//     lo delata la foto fija de la lista — mutaciones: un paso de más, el contrato en 1 (C6 · D5);
//   · ninguna columna nombra a una persona, ni a un contacto, ni a un id del CRM;
//   · un solo escritor, `lib/cartera/foto.ts` — mutación: un segundo `insertInto('foto_de_las_…')`;
//   · la configuración lee PRESENCIAS de identidad: cada cifrado o hash que nombra es un `is not null`, y no toca el
//     resolvedor de credenciales — mutación: leer `crm_token_cifrado` como valor;
//   · el horario que sólo trae tareas de la plataforma no descifra credenciales;
//   · la lista de chequeo, el nicho de la empresa y el día de la foto, que son puros.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ConfiguracionDeUnaEmpresa, ConfiguracionDeUnCliente } from '../../lib/cartera/configuracion.ts';
import { COLUMNAS_DE_LAS_CUENTAS, COLUMNAS_DE_LAS_EMPRESAS, CONTRATO_DE_LA_FOTO } from '../../lib/cartera/contrato.ts';
import { diaDeLaFoto, filasDeUnaEmpresa, nichoDeLaEmpresa } from '../../lib/cartera/foto.ts';
import { MEDIDA_SIN_FILAS } from '../../lib/cartera/medicion.ts';
import { PASOS_DEL_CLIENTE, configurado, faltan, pasosDelCliente } from '../../lib/cartera/pasos.ts';
import { HORARIOS, TAREAS_DE_LA_PLATAFORMA } from '../../lib/negocio/barrido.ts';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8').replace(/\r\n/g, '\n');
const MIGRACION = leer('db/migraciones/089_la_foto_de_los_negocios.sql');
/**
 * Las que la amplían, en su orden: la 099 suma `meta_en_el_crm` y reescribe los comentarios que cambiaron (contrato 2);
 * la 103 suma `meta_leido`, deja `meta_en_el_crm` en desuso y vuelve a escribir los comentarios (contrato 3, Meta
 * directo).
 */
const AMPLIACIONES = [
  leer('db/migraciones/099_meta_en_el_crm_de_cada_cliente.sql'),
  leer('db/migraciones/103_meta_conectado_en_la_foto.sql'),
];
const TODAS = [MIGRACION, ...AMPLIACIONES];

/** Las columnas de un `create table` de la 089, en su orden, y después las que suman las ampliaciones. */
function columnasDe(tabla: string): string[] {
  const m = new RegExp(`create table if not exists negocio\\.${tabla} \\(([\\s\\S]*?)\\n\\);`).exec(MIGRACION);
  assert.ok(m, `no encontré la tabla ${tabla} en la 089`);
  const creadas = m[1]!
    .split('\n')
    .map((l) => /^\s{2}([a-z_0-9]+)\s/.exec(l)?.[1])
    .filter((c): c is string => c !== undefined && c !== 'primary' && c !== 'check');
  let columnas = [...creadas];
  for (const sql of AMPLIACIONES) {
    columnas.push(...[...sql.matchAll(new RegExp(`^alter table negocio\\.${tabla} add column if not exists ([a-z_0-9]+) `, 'gm'))].map((x) => x[1]!));
    // Un renombre (la 103) deja la columna en su lugar, con el nombre nuevo.
    for (const x of sql.matchAll(new RegExp(`alter table negocio\\.${tabla} rename column ([a-z_0-9]+) to ([a-z_0-9]+)`, 'g'))) {
      columnas = columnas.map((c) => (c === x[1] ? x[2]! : c));
    }
  }
  return columnas;
}

/** El ÚLTIMO comentario de una columna, el que queda en la base y lee el agente. */
function comentarioDe(tabla: string, columna: string): string | undefined {
  const patron = new RegExp(`^comment on column negocio\\.${tabla}\\.${columna} is\\s+'((?:[^']|'')*)'`, 'gm');
  return TODAS.flatMap((sql) => [...sql.matchAll(patron)].map((x) => x[1]!)).at(-1);
}

function archivos(dir: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(join(RAIZ, dir))) {
    const ruta = join(dir, nombre);
    if (statSync(join(RAIZ, ruta)).isDirectory()) salida.push(...archivos(ruta));
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(nombre)) salida.push(ruta.split(sep).join('/'));
  }
  return salida;
}

test('las columnas del contrato son las de la 089 y sus ampliaciones, y cada una tiene su comentario', () => {
  for (const [tabla, contrato] of [
    ['foto_de_las_empresas', COLUMNAS_DE_LAS_EMPRESAS],
    ['foto_de_las_cuentas', COLUMNAS_DE_LAS_CUENTAS],
  ] as const) {
    assert.deepEqual(columnasDe(tabla), [...contrato], `${tabla}: la migración y el contrato no dicen lo mismo`);
    assert.match(MIGRACION, new RegExp(`^comment on table negocio\\.${tabla} is`, 'm'), `${tabla} no tiene su comentario`);
    const sin = contrato.filter((c) => comentarioDe(tabla, c) === undefined);
    assert.deepEqual(sin, [], `${tabla}: columnas sin comentario, que el agente leería sin saber qué son`);
  }
});

test('el diccionario de la foto dice la lista de chequeo de hoy, y el contrato que la nombra', () => {
  // La foto fija de la lista: cambiarla cambia lo que significan `configurada` y `faltan`. Quien la cambie tiene que
  // subir `CONTRATO_DE_LA_FOTO`, escribir su versión en el comentario de `contrato` y el de `faltan` en una migración
  // nueva, y recién ahí cambiar esta línea.
  assert.deepEqual(
    PASOS_DEL_CLIENTE.map((p) => `${p.clave}${p.requerido ? '' : '?'}`),
    ['crm', 'calendario', 'zona', 'nicho', 'datos', 'meta', 'meta_leido?', 'aviso?'],
    'la lista de chequeo cambió: sube CONTRATO_DE_LA_FOTO y los comentarios de faltan y contrato',
  );
  assert.equal(CONTRATO_DE_LA_FOTO, 3);

  const deFaltan = comentarioDe('foto_de_las_cuentas', 'faltan');
  const claves = /\(([a-z_, ]+)\)/.exec(deFaltan ?? '')?.[1]?.split(', ');
  assert.deepEqual(claves, PASOS_DEL_CLIENTE.map((p) => p.clave), 'el comentario de `faltan` no nombra las claves de la lista');
  assert.match(String(comentarioDe('foto_de_las_cuentas', 'configurada')), /Meta vinculado en su GoHighLevel/);

  // El comentario de `contrato` dice cada versión hasta la de hoy, y ninguna más.
  for (const tabla of ['foto_de_las_empresas', 'foto_de_las_cuentas']) {
    const versiones = [...String(comentarioDe(tabla, 'contrato')).matchAll(/(?:^|\. )(\d+): /g)].map((x) => Number(x[1]));
    assert.equal(Math.max(...versiones), CONTRATO_DE_LA_FOTO, `${tabla}: el comentario de contrato no llega a la versión de hoy`);
  }
});

test('ninguna columna de la foto nombra a una persona, a un contacto o a un id del CRM', () => {
  const PROHIBIDAS = /nombre|email|correo|telefono|whatsapp|direccion|contacto_id|ghl_|crm_cuenta_id|location/;
  for (const c of [...COLUMNAS_DE_LAS_EMPRESAS, ...COLUMNAS_DE_LAS_CUENTAS]) {
    assert.doesNotMatch(c, PROHIBIDAS, `la columna «${c}» guarda un dato que no es de la foto`);
  }
  // Y el cliente medido va en `cuenta_ref`: una `cuenta_id` en negocio es la llave de aislamiento por cuenta.
  assert.ok(!(COLUMNAS_DE_LAS_CUENTAS as readonly string[]).includes('cuenta_id'));
});

test('un solo escritor de la foto: `lib/cartera/foto.ts`', () => {
  const ESCRIBE = /(insertInto|updateTable|deleteFrom|mergeInto)\(\s*'foto_de_las_|(insert\s+into|update|delete\s+from)\s+negocio\.foto_de_las_/i;
  const escritores = ['app', 'lib', 'scripts', 'components']
    .flatMap(archivos)
    .filter((f) => ESCRIBE.test(readFileSync(join(RAIZ, f), 'utf8')));
  assert.deepEqual(escritores, ['lib/cartera/foto.ts']);
});

test('la configuración lee presencias: cada cifrado o hash es un `is not null`, y no descifra nada', () => {
  const fuente = leer('lib/cartera/configuracion.ts');
  const menciones = [...fuente.matchAll(/\b(?:\w+\.)?\w+_(?:cifrado|cifrada|hash)\b/g)];
  assert.ok(menciones.length >= 4, 'la configuración dejó de mirar las credenciales');
  for (const m of menciones) {
    const despues = fuente.slice(m.index! + m[0].length, m.index! + m[0].length + 14);
    assert.match(despues, /^\s+is not null/, `«${m[0]}» se lee como valor, no como presencia`);
  }
  // Sobre el código, sin los comentarios: el encabezado nombra lo que prohíbe.
  const codigo = fuente.replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(codigo, /select\s+\*/i, 'un `select *` en identidad trae columnas que nadie eligió');
  assert.doesNotMatch(codigo, /credenciales\/|descifrar|resolver[A-Z]/, 'la configuración usa el resolvedor, que descifra');
});

test('el horario de la foto es de la plataforma, y la ruta no descifra credenciales para él', () => {
  assert.deepEqual([...TAREAS_DE_LA_PLATAFORMA].sort(), ['foto', 'sonda']);
  assert.deepEqual([...HORARIOS['29 11 * * *'].tareas], ['foto']);
  const ruta = leer('app/api/cron/route.ts');
  assert.match(ruta, /tareas\.every\(\(t\) => TAREAS_DE_LA_PLATAFORMA\.includes\(t\)\)/);
  assert.match(ruta, /soloDeLaPlataforma \? \[\] : await conIdentidad\(/, 'el horario de la foto descifra las credenciales de todas');
});

// ─── Lo puro ─────────────────────────────────────────────────────────────────

const AHORA = Date.parse('2026-10-18T12:00:00Z');
const LISTO = { crmConectado: true, calendario: true, meta: true, aviso: false, zonaHoraria: 'America/Lima', nichoConfirmado: true };
/** Lo medido de un cliente con sus campañas leídas de Meta, con la marca de su ingesta. */
const medido = (ultimaIngestaEl: Date | null) => ({ ultimaIngestaEl, metaLeido: true });

test('la lista de chequeo: UTC no es una zona elegida, lo no medido no se acusa, y lo recomendado no cuenta', () => {
  const al_dia = pasosDelCliente(LISTO, medido(new Date(AHORA - 3600_000)), AHORA);
  assert.equal(configurado(al_dia, PASOS_DEL_CLIENTE), true, 'sin el aviso, que es recomendado, igual está configurado');
  assert.deepEqual(faltan(al_dia, PASOS_DEL_CLIENTE), ['aviso']);

  assert.equal(pasosDelCliente({ ...LISTO, zonaHoraria: 'UTC' }, medido(new Date(AHORA)), AHORA).zona, 'falta');
  assert.equal(pasosDelCliente(LISTO, medido(new Date(AHORA - 25 * 3600_000)), AHORA).datos, 'falta', 'datos de ayer cuentan como al día');
  assert.equal(pasosDelCliente(LISTO, medido(null), AHORA).datos, 'falta');

  const sinMedir = pasosDelCliente(LISTO, undefined, AHORA);
  assert.equal(sinMedir.datos, 'sin_medir');
  assert.ok(!faltan(sinMedir, PASOS_DEL_CLIENTE).includes('datos'), 'se acusó de algo que no se midió');
  assert.equal(configurado(sinMedir, PASOS_DEL_CLIENTE), false, 'lo no medido se dio por bueno');
});

function cliente(id: string, extra: Partial<ConfiguracionDeUnCliente> = {}): ConfiguracionDeUnCliente {
  return {
    id,
    nombre: `Cliente ${id}`,
    estado: 'activa',
    esPrueba: false,
    esPorOmision: false,
    nicho: null,
    nichoConfirmado: false,
    modeloDeNegocio: null,
    pais: null,
    moneda: null,
    zonaHoraria: 'America/Lima',
    altaEl: new Date(AHORA),
    crmVinculado: true,
    crmConectado: true,
    calendario: true,
    meta: false,
    aviso: false,
    ...extra,
  };
}

function empresa(clientes: ConfiguracionDeUnCliente[], extra: Partial<ConfiguracionDeUnaEmpresa> = {}): ConfiguracionDeUnaEmpresa {
  return {
    id: 'e1',
    slug: 'e1',
    nombre: 'Empresa 1',
    activa: true,
    esPrincipal: false,
    pais: null,
    nichoPrincipal: null,
    precioMensual: null,
    zonaHoraria: 'America/Lima',
    altaEl: new Date(AHORA),
    llaveDeIa: true,
    usuarios: 2,
    usuariosLimitados: 0,
    clientes,
    ...extra,
  };
}

test('el nicho de la empresa: el fijado gana; si no, el más común entre los confirmados reales', () => {
  const clientes = [
    cliente('a', { nicho: 'salud', nichoConfirmado: true }),
    cliente('b', { nicho: 'legal', nichoConfirmado: true }),
    cliente('c', { nicho: 'legal', nichoConfirmado: true, esPrueba: true }),
    cliente('d', { nicho: 'legal', nichoConfirmado: false }),
    cliente('e', { nicho: 'legal', nichoConfirmado: true, estado: 'baja' }),
  ];
  // Un confirmado de cada uno: empate, y gana el menor. Los de prueba, los sin confirmar y las bajas no votan.
  assert.deepEqual(nichoDeLaEmpresa(empresa(clientes)), { nicho: 'legal', origen: 'calculado' });
  assert.deepEqual(nichoDeLaEmpresa(empresa([...clientes, cliente('f', { nicho: 'salud', nichoConfirmado: true })])), {
    nicho: 'salud',
    origen: 'calculado',
  });
  assert.deepEqual(nichoDeLaEmpresa(empresa(clientes, { nichoPrincipal: 'educacion' })), { nicho: 'educacion', origen: 'fijado' });
  assert.deepEqual(nichoDeLaEmpresa(empresa([])), { nicho: null, origen: null });
});

test('una empresa sin medir: sus cifras y las de sus clientes son nulas, con el motivo, y nada se acusa por eso', () => {
  const { empresa: e, clientes } = filasDeUnaEmpresa(empresa([cliente('a')]), null, 'no se pudo medir', 'p', '2026-10-18', AHORA);
  assert.deepEqual([e.medida, e.motivo_sin_medir, e.contactos, e.ventas_30d], [false, 'no se pudo medir', null, null]);
  assert.deepEqual([clientes[0]!.medida, clientes[0]!.contactos, clientes[0]!.gasto_30d], [false, null, null]);
  assert.ok(!clientes[0]!.faltan.includes('datos'), 'se acusó de datos viejos a un cliente que no se midió');
  // Medida pero sin filas: ceros medidos, y lo que no existe sigue nulo.
  const medida = { porCliente: new Map(), iaLlamadas30d: 0, incidentes30d: 0, senalesAbiertas: 0 };
  const conMedida = filasDeUnaEmpresa(empresa([cliente('a')]), medida, null, 'p', '2026-10-18', AHORA);
  assert.deepEqual([conMedida.clientes[0]!.contactos, conMedida.clientes[0]!.gasto_30d], [0, null]);
  assert.equal(MEDIDA_SIN_FILAS.gasto30d, null, 'la medida vacía dice que hay gasto cero');
});

test('el día de la foto es el de la zona de la principal', () => {
  assert.equal(diaDeLaFoto('America/Lima', Date.parse('2026-10-18T03:00:00Z')), '2026-10-17');
  assert.equal(diaDeLaFoto('UTC', Date.parse('2026-10-18T03:00:00Z')), '2026-10-18');
});
