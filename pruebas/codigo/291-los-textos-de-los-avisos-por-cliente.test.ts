// LOS AVISOS DICEN DE QUÉ CLIENTE Y QUÉ HACER: LOS TEXTOS Y LAS REGLAS PURAS, SIN BASE. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, C6 · D1)
//
// Lo de `lib/negocio/faltaDeLosClientes.ts` que no necesita base, y lo que las pantallas dibujan; la base la mira la
// 290. Cada afirmación dice la mutación que la pone en rojo:
//
//   · el aviso nombra al cliente, tiene un prefijo NEUTRO —«no está lista», nunca «le falta», porque un token ilegible
//     no falta— y termina con el texto de SU código: el de la empresa para el principal, el del cliente para los demás;
//     al cliente final, sin Ajustes — mutaciones: el texto de la empresa para todos, «le falta», Ajustes al cliente final;
//   · el principal se nombra sólo con más de un cliente activo — mutación: nombrarlo siempre;
//   · los closers sin vínculo en un cliente son los vinculados en otro, no los que ven todo — mutación: incluir a los
//     designados sin ningún vínculo;
//   · el texto de Meta es el MISMO que sella el barrido, y `TAREAS_DEL_CRM` son justo las que su guardia deja
//     `saltada` por la credencial — mutaciones: cambiar una letra del texto, quitar o sumar una tarea;
//   · el módulo no importa el barrido en tiempo de ejecución (el ciclo) — mutación: una importación de valor;
//   · los textos nuevos hablan de tú, con su forma exacta: la 258 no mira los archivos que todavía vosean, y su lista
//     no trae «vinculalo» — mutación: el voseo de vuelta;
//   · las pantallas dibujan lo que el servidor dice: la Agenda, el chat, Leads, Acquisition y Conversion, cada frase
//     después de «Faltan días de gasto.» — mutación: no dibujarlo;
//   · los nombres de los closers sólo viajan a quien ve la pantalla del vínculo, sobre su propia empresa — mutaciones:
//     sin `credenciales.ver`, con la empresa de otro.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';
import { VOSEO } from '../apoyo/voseo.ts';
import {
  LO_RESUELVE_LA_EMPRESA,
  MOTIVO_SIN_META_EN_GHL,
  TAREAS_DEL_CRM,
  avisoSinConexion,
  delAlcance,
  seNombra,
} from '../../lib/negocio/faltaDeLosClientes.ts';
import { TEXTO_DE_FALTA_GHL, TEXTO_DE_FALTA_GHL_DEL_CLIENTE, type FaltaParaGhl } from '../../lib/credenciales/resolver.ts';
import { closersSinVinculoEn, type CloserConfigurado } from '../../lib/negocio/alcanceDelCloser.ts';
import { TAREAS_DEL_CLIENTE, motivoDeLoIncompleto } from '../../lib/negocio/barrido.ts';
import { diceLosClosersSinVincular } from '../../lib/administracion/cuentas.ts';

const leer = (ruta: string) => sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8'));
const CODIGOS = Object.keys(TEXTO_DE_FALTA_GHL) as FaltaParaGhl[];

/** Las formas de voseo que estos textos podrían traer y que `VOSEO` no lista. */
const VOSEO_DE_ESTOS_TEXTOS = /(?<!\p{L})(vinculalo|vinculalos|vinculá|cargala|cargalo|cargá|elegí|tenés|podés|andá|apretá)(?!\p{L})/iu;

test('el aviso nombra al cliente, con un prefijo neutro y el texto de su código; al cliente final, sin Ajustes', () => {
  assert.equal(CODIGOS.length, 5, 'cambió la lista de faltas de GoHighLevel: revisar el prefijo con cada una');
  for (const que of CODIGOS) {
    for (const esPorOmision of [true, false]) {
      const t = avisoSinConexion([{ nombre: 'Clínica Sur', esPorOmision, que }], 'calendario');
      assert.ok(t, 'sin aviso');
      assert.ok(t.startsWith('La conexión de «Clínica Sur» con GoHighLevel no está lista, así que '), `no nombra al cliente: ${t}`);
      const texto = (esPorOmision ? TEXTO_DE_FALTA_GHL : TEXTO_DE_FALTA_GHL_DEL_CLIENTE)[que];
      assert.ok(t.endsWith(` ${texto}`), `con ${que} (${esPorOmision ? 'principal' : 'otro'}) no termina con el texto de su código`);
      // «Le falta» no: con `token_ilegible` el token está cargado (`lib/credenciales/resolver.ts:894`).
      assert.doesNotMatch(t.slice(0, t.indexOf(texto)), /le falta|falta su/i, 'el prefijo dice «falta» sobre una credencial que puede estar cargada');
      assert.equal(VOSEO.exec(t), null, `vosea: ${t}`);
      assert.equal(VOSEO_DE_ESTOS_TEXTOS.exec(t), null, `vosea: ${t}`);

      const final = avisoSinConexion([{ nombre: 'Clínica Sur', esPorOmision, que }], 'datos', true);
      assert.ok(final?.endsWith(LO_RESUELVE_LA_EMPRESA), 'al cliente final no se le dice quién lo resuelve');
      assert.doesNotMatch(final ?? '', /Ajustes/, 'al cliente final se lo manda a Ajustes, que no ve');
    }
  }
  // La subcuenta de otro cliente la vincula la plataforma: lo dice su texto, que es el que termina el aviso.
  assert.match(avisoSinConexion([{ nombre: 'X', esPorOmision: false, que: 'sin_subcuenta' }], 'mensajes') ?? '', /La vincula la plataforma/);
  // Las tres pantallas, cada una con lo suyo; varios clientes, una frase cada uno; ninguno, nada.
  assert.match(avisoSinConexion([{ nombre: 'X', esPorOmision: false, que: 'sin_token' }], 'calendario') ?? '', /su calendario no se está leyendo\./);
  assert.match(avisoSinConexion([{ nombre: 'X', esPorOmision: false, que: 'sin_token' }], 'mensajes') ?? '', /sus mensajes no se están trayendo\./);
  assert.match(avisoSinConexion([{ nombre: 'X', esPorOmision: false, que: 'sin_token' }], 'datos') ?? '', /sus contactos y sus citas no se están trayendo\./);
  const dos = avisoSinConexion(
    [
      { nombre: 'A', esPorOmision: false, que: 'sin_token' },
      { nombre: 'B', esPorOmision: false, que: 'token_vencido' },
    ],
    'calendario',
  );
  assert.equal((dos?.match(/La conexión de «/g) ?? []).length, 2);
  assert.equal(avisoSinConexion([], 'calendario'), null);
  assert.equal(LO_RESUELVE_LA_EMPRESA, 'Lo resuelve la empresa que te da acceso.');
});

test('el principal se nombra sólo con más de un cliente activo; los demás, siempre', () => {
  assert.equal(seNombra({ esPorOmision: true }, 1), false, 'con un solo cliente el aviso cambió');
  assert.equal(seNombra({ esPorOmision: true }, 2), true);
  assert.equal(seNombra({ esPorOmision: false }, 1), true, 'con el foco en otro cliente, no se lo nombra');
  // El alcance del closer: sólo los clientes de sus vínculos; quien ve todo, todos.
  const lista = [{ id: 'p' }, { id: 'y' }];
  assert.deepEqual(delAlcance(lista, { tipo: 'todo' }), lista);
  assert.deepEqual(delAlcance(lista, undefined), lista);
  assert.deepEqual(delAlcance(lista, { tipo: 'mio', usuarioId: 'u', vinculos: [{ cuentaId: 'p', crmUsuarioId: 'c' }] }), [{ id: 'p' }]);
});

test('los closers sin vínculo en un cliente son los vinculados en otro, no los que ven todo', () => {
  const closer = (usuarioId: string, cuentas: string[]): CloserConfigurado => ({
    usuarioId,
    nombre: usuarioId,
    vinculos: cuentas.map((cuentaId) => ({ cuentaId, crmUsuarioId: `crm-${usuarioId}` })),
    vinculosALaVista: [],
    actualizadoEl: new Date(0),
  });
  const closers = [closer('soloP', ['p']), closer('sinVinculo', []), closer('enLosDos', ['p', 'y'])];
  assert.deepEqual(closersSinVinculoEn('y', closers).map((c) => c.usuarioId), ['soloP']);
  assert.deepEqual(closersSinVinculoEn('nuevo', closers).map((c) => c.usuarioId), ['soloP', 'enLosDos'], 'el designado sin vínculos ve todo, y se lo nombró');
  assert.deepEqual(closersSinVinculoEn('p', closers), []);
});

test('el texto de Meta es el que sella el barrido, y las tareas del CRM son las de su guardia', () => {
  assert.equal(motivoDeLoIncompleto({ vinculo: { estado: 'disconnected' } }), MOTIVO_SIN_META_EN_GHL, 'el barrido sella otro texto: el aviso de Acquisition nunca lo encontraría');
  for (const t of TAREAS_DEL_CRM) assert.ok(TAREAS_DEL_CLIENTE.includes(t), `${t} no es una tarea de un cliente`);
  /* El guardia: las tareas que NO pasan por la credencial del CRM están escritas como `tarea !== '…'` antes de
     `acceso.tipo !== 'listo'`. Las de un cliente que quedan son las que sellan `saltada` con un código de la falta. */
  const barrido = leer('lib/negocio/barrido.ts');
  const fin = barrido.indexOf("acceso.tipo !== 'listo'\n");
  const inicio = barrido.lastIndexOf('if (', fin);
  assert.ok(inicio !== -1 && fin > inicio, 'no se encontró el guardia de la credencial del CRM');
  const exentas = [...barrido.slice(inicio, fin).matchAll(/tarea !== '(\w+)'/g)].map((m) => m[1]!);
  assert.ok(exentas.length >= 5, 'no se leyeron las tareas exentas del guardia');
  assert.deepEqual(
    [...TAREAS_DEL_CRM].sort(),
    TAREAS_DEL_CLIENTE.filter((t) => !exentas.includes(t)).sort(),
    'el guardia y la lista no coinciden: el aviso miraría una tarea que no se salta, o no miraría una que sí',
  );
});

test('el módulo no importa el barrido en tiempo de ejecución', () => {
  const t = leer('lib/negocio/faltaDeLosClientes.ts');
  const delBarrido = [...t.matchAll(/^import\s+(type\s+)?[^;]*from '\.\/barrido\.ts';/gm)];
  assert.ok(delBarrido.length > 0, 'no se leyó la importación del tipo');
  assert.ok(delBarrido.every((m) => m[1] !== undefined), 'importa valores de barrido.ts: cierra el ciclo embudos → barrido → detectores → embudos');
  assert.doesNotMatch(t, /import\(['"]\.\/barrido/, 'una importación dinámica del barrido');
});

test('los textos nuevos hablan de tú, con su forma exacta', () => {
  const panelDeAcquisition = leer('components/acquisition/PanelDeAcquisition.jsx');
  const comun = leer('components/conversion/comun.jsx');
  for (const fuente of [panelDeAcquisition, comun]) {
    assert.ok(fuente.includes("metaSinVincular: 'El GoHighLevel de {cliente} no tiene Meta vinculado: vincúlalo en GoHighLevel.'"));
    assert.ok(fuente.includes("sinConexion: 'La conexión de {cliente} con GoHighLevel no está lista. {detalle}'"));
    assert.ok(fuente.includes("noActivo: '{cliente} ya no está activo: su gasto no se lee.'"));
  }
  const clientes = leer('components/ajustes/Clientes.jsx');
  assert.ok(clientes.includes("${uno ? 'Vincúlalo' : 'Vincúlalos'} en Closer › Inicio › Closers eligiendo"), 'el alta no dice dónde vincular, o vosea');
  const quien = leer('components/closer/QuienEsElCloser.jsx');
  assert.ok(quien.includes("'hasta que elijas su usuario de GoHighLevel abajo.'"), 'el aviso del vínculo vosea, o cambió');
  for (const [ruta, fuente] of [
    ['components/ajustes/Clientes.jsx', clientes],
    ['lib/negocio/faltaDeLosClientes.ts', leer('lib/negocio/faltaDeLosClientes.ts')],
  ] as const) {
    assert.equal(VOSEO_DE_ESTOS_TEXTOS.exec(fuente), null, `${ruta} vosea`);
  }
  const avisoDelVinculo = quien.slice(quien.indexOf('{sinVincularAqui.length > 0 ? ('), quien.indexOf('{closers.length === 0 ? ('));
  assert.ok(avisoDelVinculo.length > 0, 'no se encontró el aviso del vínculo');
  assert.equal(VOSEO.exec(avisoDelVinculo), null);
  assert.equal(VOSEO_DE_ESTOS_TEXTOS.exec(avisoDelVinculo), null);
});

test('las pantallas dibujan lo que el servidor dice, cada frase después de «Faltan días de gasto.»', () => {
  const funcion = (t: string, nombre: string) => t.slice(t.indexOf(`function ${nombre}(`), t.indexOf('\n}\n', t.indexOf(`function ${nombre}(`)));
  const notaAcq = funcion(leer('components/acquisition/PanelDeAcquisition.jsx'), 'Nota');
  assert.match(
    notaAcq,
    /motivos\.push\(FRASE\.faltanDias\);[\s\S]{0,200}for \(const f of e\.gasto\?\.faltaPorCliente \?\? \[\]\)[\s\S]{0,120}motivos\.push\(poner\(frase, f\)\)/,
    'Acquisition no dice de qué cliente faltan los días',
  );
  const notaCv = funcion(leer('components/conversion/PanelDeConversion.jsx'), 'Nota');
  assert.match(
    notaCv,
    /motivos\.push\(FRASE_DE_LAS_VISTAS\[c\.vistas\.motivo\]\);\s*for \(const f of c\.vistas\.faltaPorCliente \?\? \[\]\) if \(FRASE_DE_LA_FALTA\[f\.falta\]\) motivos\.push\(poner\(FRASE_DE_LA_FALTA\[f\.falta\], f\)\);/,
    'Conversion no dice de qué cliente falta el gasto',
  );
  assert.match(leer('components/closer/Agenda.jsx'), /\{datos\.sinConexion \? \([\s\S]{0,160}<span>\{datos\.sinConexion\}<\/span>/, 'la Agenda no dibuja el cliente sin conexión');
  const ficha = leer('components/negocio/Ficha.jsx');
  assert.match(ficha, /sinConexion: r\.datos\.sinConexion \?\? null/, 'el chat no guarda el cliente sin conexión');
  assert.match(ficha, /\{atraso\}\s*\{sinConexion\}\s*\{avisoDelCrm\}/, 'el chat con mensajes no lo dibuja');
  assert.match(leer('components/leads-portal/PanelDeLeadsPortal.jsx'), /\[\.\.\.frescura, p\.conexion, /, 'Leads no lo dibuja');
});

test('los nombres de los closers viajan sólo con `credenciales.ver`, y sobre la empresa de la sesión', () => {
  const con = { permisos: new Set(['cuentas.crear', 'credenciales.ver']), orgEfectiva: 'org' };
  const sin = { permisos: new Set(['cuentas.crear']), orgEfectiva: 'org' };
  assert.equal(diceLosClosersSinVincular(con, 'org'), true);
  assert.equal(diceLosClosersSinVincular(sin, 'org'), false, 'sin la capacidad de la pantalla del vínculo, recibe los nombres');
  assert.equal(diceLosClosersSinVincular(con, 'otra'), false, 'la plataforma operando sobre otra empresa recibe los nombres de sus closers');
  // Las tres respuestas lo preguntan: el alta, la activación y la lista.
  const alta = leer('app/api/admin/cuentas/route.ts');
  assert.equal([...alta.matchAll(/diceLosClosersSinVincular\(contexto, destino\)/g)].length, 2);
  assert.match(leer('app/api/admin/cuentas/[id]/route.ts'), /cambios\.estado === 'activa' && diceLosClosersSinVincular\(contexto, destino\)/);
});
