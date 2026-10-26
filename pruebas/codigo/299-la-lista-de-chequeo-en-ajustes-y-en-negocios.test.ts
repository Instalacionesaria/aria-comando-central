// LA LISTA DE CHEQUEO: META EN SU GOHIGHLEVEL, LO QUE DIBUJAN AJUSTES Y NEGOCIOS, Y EL ALTA DESDE NEGOCIOS. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, C6 · D5)
//
// Lo de la lista de chequeo que no necesita base; la base la mira la 298. Cada afirmación dice la mutación que la
// pone en rojo:
//
//   · Meta en el GoHighLevel de un cliente sale del sello de su pasada del gasto —también cuando el motivo junta otras
//     causas con «; »—, el sello gana sobre la serie, y sin ninguno de los dos no se sabe — mutaciones: comparar el
//     motivo entero, la serie antes que el sello, «no se sabe» como «no»;
//   · `meta_leido` es requerido, y lo no medido no se acusa ni se da por bueno — mutación: el paso recomendado;
//   · la lista viaja en el orden de `PASOS_DEL_CLIENTE`, y un cliente en pausa no está configurado aunque tenga todo
//     — mutación: sin el estado;
//   · el tablero lee lo medido de la foto, y la fila de una empresa que no se pudo medir no acusa nada — mutaciones:
//     sin la columna de la foto, la fila sin medir como medida;
//   · cada clave de la lista tiene su nombre en Negocios y su «qué hacer» en Ajustes — mutación: un paso sin frase;
//   · Ajustes › Clientes dibuja la lista de cada fila y la relee al cerrar la ventana de un cliente; Negocios ofrece
//     «Agregar cliente» con la capacidad de alta, con el `orgId` de esa empresa y el catálogo de su lista — mutaciones:
//     sin la capacidad, sin el `orgId`;
//   · el aviso del alta desde Negocios nombra a los closers sin vincular que trae la respuesta, con el texto de Ajustes
//     — mutaciones: el alta de Negocios sin los closers, sin leerlos de la respuesta;
//   · los textos hablan de tú.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';
import { VOSEO } from '../apoyo/voseo.ts';
import type { ConfiguracionDeUnCliente, ConfiguracionDeUnaEmpresa } from '../../lib/cartera/configuracion.ts';
import { CONTRATO_DE_LA_FOTO } from '../../lib/cartera/contrato.ts';
import { filasDeUnaEmpresa } from '../../lib/cartera/foto.ts';
import type { FilaDeLaFotoDeUnCliente, FilaDeLaFotoDeUnaEmpresa, FotoDeLosNegocios } from '../../lib/cartera/lectura.ts';
import { MEDIDA_SIN_FILAS, metaLeidoDe, type MedidaDeUnaEmpresa } from '../../lib/cartera/medicion.ts';
import {
  PASOS_DE_LA_EMPRESA,
  PASOS_DEL_CLIENTE,
  configurado,
  faltan,
  listaDeChequeoDelCliente,
  pasosDelCliente,
} from '../../lib/cartera/pasos.ts';
import { armarElTablero } from '../../lib/cartera/tablero.ts';
import { MOTIVO_META_RECHAZADA } from '../../lib/negocio/faltaDeLosClientes.ts';
import { motivoDeLoIncompleto } from '../../lib/negocio/barrido.ts';

const leer = (ruta: string) => sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8'));

const AHORA = Date.parse('2026-10-20T15:00:00Z');
const HACE_UNA_HORA = new Date(AHORA - 3600_000);
const LISTO = { crmConectado: true, calendario: true, meta: true, aviso: true, zonaHoraria: 'America/Lima', nichoConfirmado: true };

test('las campañas leídas de Meta: el sello de su pasada de anuncios, después su gasto, y si no, no se sabe', () => {
  const corrio = (motivo: string | null) => ({ estado: 'corrio', motivo });
  assert.equal(metaLeidoDe(corrio(null), false), true, 'la pasada corrió');
  assert.equal(metaLeidoDe(corrio(MOTIVO_META_RECHAZADA), true), false, 'el gasto viejo ganó al sello de hoy');
  // El motivo que de verdad escribe el barrido, también juntado con otras causas.
  const rechazada = motivoDeLoIncompleto({
    modo: 'diario',
    cuentas: [
      { act: 'act_1', falla: 'token', ilegibles: 0 },
      { act: 'act_2', falla: 'cupo', ilegibles: 3 },
    ],
  });
  assert.ok(rechazada?.includes('; '), 'el barrido ya no junta las causas: revisar cómo se lee el motivo');
  assert.equal(metaLeidoDe(corrio(rechazada), false), false, 'con otra causa al lado, no se vio la conexión rechazada');
  const sinRechazo = motivoDeLoIncompleto({ modo: 'diario', cuentas: [{ act: 'act_1', falla: 'cupo', ilegibles: 0 }] });
  assert.equal(metaLeidoDe(corrio(sinRechazo), false), true, 'el cupo se leyó como la conexión caída');
  // Saltada (sin Meta conectado, o con la conexión caída) y fallo dicen que no se lee, aunque haya gasto viejo.
  for (const estado of ['saltada', 'fallo']) assert.equal(metaLeidoDe({ estado, motivo: null }, true), false, estado);
  // Frenada y sin tiempo no dicen nada: manda el gasto, y sin él no se sabe.
  for (const estado of ['frenada', 'sin_tiempo']) {
    assert.equal(metaLeidoDe({ estado, motivo: null }, true), true, `${estado} con gasto`);
    assert.equal(metaLeidoDe({ estado, motivo: null }, false), null, `${estado} sin gasto se dio por sabido`);
  }
  assert.equal(metaLeidoDe(undefined, true), true);
  assert.equal(metaLeidoDe(undefined, false), null, '«no se sabe» se dijo «no»');
});

test('Meta conectado es requerido; las campañas leídas, recomendadas; lo no medido ni se acusa ni se da por bueno', () => {
  const con = (meta: boolean, metaLeido: boolean | null) => pasosDelCliente({ ...LISTO, meta }, { ultimaIngestaEl: HACE_UNA_HORA, metaLeido }, AHORA);
  assert.deepEqual([configurado(con(true, true), PASOS_DEL_CLIENTE), faltan(con(true, true), PASOS_DEL_CLIENTE)], [true, []]);
  assert.deepEqual(
    [configurado(con(false, true), PASOS_DEL_CLIENTE), faltan(con(false, true), PASOS_DEL_CLIENTE)],
    [false, ['meta']],
    'sin Meta conectado quedó configurado',
  );
  // Conectado y con las campañas sin leer: configurado (es recomendado), pero se dice.
  assert.deepEqual([configurado(con(true, false), PASOS_DEL_CLIENTE), faltan(con(true, false), PASOS_DEL_CLIENTE)], [true, ['meta_leido']]);
  assert.equal(con(true, null).meta_leido, 'sin_medir');
  // Sin medida (la empresa no se pudo medir), lo medido queda sin medir; lo conectado se lee de la configuración.
  const sinMedida = pasosDelCliente(LISTO, undefined, AHORA);
  assert.deepEqual([sinMedida.datos, sinMedida.meta_leido, sinMedida.meta], ['sin_medir', 'sin_medir', 'ok']);
  assert.deepEqual(
    PASOS_DEL_CLIENTE.filter((p) => p.clave === 'meta' || p.clave === 'meta_leido').map((p) => [p.clave, p.nombre, p.requerido]),
    [
      ['meta', 'Meta conectado', true],
      ['meta_leido', 'Campañas leídas de Meta', false],
    ],
  );
});

test('la lista viaja en su orden, con lo justo, y un cliente en pausa no está configurado', () => {
  const medido = { ultimaIngestaEl: HACE_UNA_HORA, metaLeido: false };
  const l = listaDeChequeoDelCliente({ ...LISTO, estado: 'activa' }, medido, AHORA);
  assert.deepEqual(
    l.pasos.map((p) => [p.clave, p.nombre, p.requerido]),
    PASOS_DEL_CLIENTE.map((p) => [p.clave, p.nombre, p.requerido]),
  );
  assert.ok(l.pasos.every((p) => Object.keys(p).sort().join() === 'clave,estado,nombre,requerido'));
  // Las campañas que no se leen son recomendadas: el cliente sigue configurado, y se dice.
  assert.deepEqual([l.configurado, l.pasos.find((p) => p.clave === 'meta_leido')?.estado], [true, 'falta']);
  const todo = { ultimaIngestaEl: HACE_UNA_HORA, metaLeido: true };
  assert.equal(listaDeChequeoDelCliente({ ...LISTO, estado: 'activa' }, todo, AHORA).configurado, true);
  assert.equal(listaDeChequeoDelCliente({ ...LISTO, estado: 'pausada' }, todo, AHORA).configurado, false, 'uno en pausa quedó configurado');
});

function cliente(id: string, extra: Partial<ConfiguracionDeUnCliente> = {}): ConfiguracionDeUnCliente {
  return {
    id,
    nombre: `Cliente ${id}`,
    estado: 'activa',
    esPrueba: false,
    esPorOmision: false,
    nicho: 'salud',
    nichoConfirmado: true,
    modeloDeNegocio: null,
    pais: 'PE',
    moneda: 'PEN',
    zonaHoraria: 'America/Lima',
    altaEl: new Date(AHORA),
    crmVinculado: true,
    crmConectado: true,
    calendario: true,
    meta: true,
    aviso: true,
    ...extra,
  };
}

function empresa(id: string, clientes: ConfiguracionDeUnCliente[]): ConfiguracionDeUnaEmpresa {
  return {
    id,
    slug: id,
    nombre: `Empresa ${id}`,
    activa: true,
    esPrincipal: false,
    pais: 'PE',
    nichoPrincipal: null,
    precioMensual: null,
    zonaHoraria: 'America/Lima',
    altaEl: new Date(AHORA),
    llaveDeIa: true,
    usuarios: 1,
    usuariosLimitados: 0,
    clientes,
  };
}

function fotoDe(medidas: [ConfiguracionDeUnaEmpresa, MedidaDeUnaEmpresa | null][]): FotoDeLosNegocios {
  const filas = medidas.map(([e, m]) => filasDeUnaEmpresa(e, m, m ? null : 'no se pudo medir', 'aria', '2026-10-20', AHORA));
  return {
    dia: '2026-10-20',
    tomadaEl: HACE_UNA_HORA,
    contrato: CONTRATO_DE_LA_FOTO,
    empresas: filas.map((f) => ({ ...f.empresa, tomada_el: HACE_UNA_HORA }) as FilaDeLaFotoDeUnaEmpresa),
    cuentas: filas.flatMap((f) => f.clientes.map((c) => ({ ...c, tomada_el: HACE_UNA_HORA }) as FilaDeLaFotoDeUnCliente)),
  };
}

test('el tablero lee lo medido de la foto, y la fila de una empresa sin medir no acusa nada', () => {
  // «sin»: sin Meta conectado (requerido) y con sus campañas sin leer (recomendado).
  const uno = empresa('uno', [cliente('con'), cliente('sin', { meta: false })]);
  const medida: MedidaDeUnaEmpresa = {
    porCliente: new Map([
      ['con', { ...MEDIDA_SIN_FILAS, ultimaIngestaEl: HACE_UNA_HORA, metaLeido: true }],
      ['sin', { ...MEDIDA_SIN_FILAS, ultimaIngestaEl: HACE_UNA_HORA, metaLeido: false }],
    ]),
    iaLlamadas30d: 0,
    incidentes30d: 0,
    senalesAbiertas: 0,
  };
  const foto = fotoDe([[uno, medida]]);
  assert.deepEqual(
    foto.cuentas.map((c) => [c.cuenta_ref, c.meta_leido, c.configurada]),
    [
      ['con', true, true],
      ['sin', false, false],
    ],
  );
  const t = armarElTablero(foto, { principal: { id: 'aria', zonaHoraria: 'America/Lima' }, empresas: [uno] }, AHORA);
  const [con, sin] = t.empresas[0]!.detalle;
  assert.deepEqual([con!.configurado, con!.faltan], [true, []]);
  assert.deepEqual([sin!.configurado, sin!.faltan], [false, ['meta', 'meta_leido']], 'el tablero no leyó de la foto lo de Meta');
  assert.equal(t.empresas[0]!.clientes.configurados, 1);

  // La empresa no se pudo medir: su fila está, sin medir, y el tablero no acusa los datos ni Meta.
  const sinMedir = armarElTablero(fotoDe([[uno, null]]), { principal: { id: 'aria', zonaHoraria: 'America/Lima' }, empresas: [uno] }, AHORA);
  for (const c of sinMedir.empresas[0]!.detalle) {
    assert.ok(c.cifras && !c.cifras.medida, 'la fila no quedó sin medir');
    // Lo MEDIDO (datos, campañas leídas) no se acusa; lo que dice la configuración en vivo (Meta conectado), sí.
    assert.equal(c.configurado, false);
    assert.deepEqual(
      c.faltan.filter((f) => f === 'datos' || f === 'meta_leido'),
      [],
      'a un cliente de una empresa sin medir se le acusó lo que no se midió',
    );
  }
});

/** Las claves de un objeto literal de un archivo: `const NOMBRE = {` hasta su `};`. */
function clavesDe(fuente: string, inicio: string): string[] {
  const desde = fuente.indexOf(inicio);
  assert.ok(desde >= 0, `no se encontró «${inicio}»`);
  const cuerpo = fuente.slice(desde + inicio.length, fuente.indexOf('\n};', desde));
  return [...cuerpo.matchAll(/^ {2}([a-z_]+):/gm)].map((x) => x[1]!);
}

test('cada paso tiene su nombre en Negocios y su «qué hacer» en Ajustes', () => {
  const claves = PASOS_DEL_CLIENTE.map((p) => p.clave);
  const deAjustes = leer('components/ajustes/ListaDeChequeo.jsx');
  assert.deepEqual(clavesDe(deAjustes, 'export const QUE_HACER = {'), claves, 'un paso de la lista sin su «qué hacer» en Ajustes');
  // Lo que se mide puede quedar sin medir, y eso se explica.
  assert.deepEqual(clavesDe(deAjustes, 'export const SIN_MEDIR = {'), ['datos', 'meta_leido']);
  const deNegocios = leer('components/cartera/PanelDeNegocios.jsx');
  assert.deepEqual(
    clavesDe(deNegocios, 'const PASO = {').sort(),
    [...new Set([...claves, ...PASOS_DE_LA_EMPRESA.map((p) => p.clave)])].sort(),
    'un paso sin su nombre en Negocios',
  );
  // Los nombres de los pasos vienen del servidor: Ajustes no tiene una segunda copia que se desincronice.
  for (const p of PASOS_DEL_CLIENTE) assert.ok(!deAjustes.includes(`'${p.nombre}'`), `Ajustes copia el nombre «${p.nombre}»`);
});

test('Ajustes › Clientes dibuja la lista de cada fila y la relee al cerrar la ventana de un cliente', () => {
  const clientes = leer('components/ajustes/Clientes.jsx');
  assert.match(clientes, /import ListaDeChequeo, \{ ResumenDeLaLista \} from '\.\/ListaDeChequeo\.jsx';/);
  assert.match(clientes, /<ResumenDeLaLista cliente=\{c\} \/>/);
  assert.match(clientes, /\{abiertas\.has\(c\.id\) \? \(\s*<div className="aj-fila-entera">\s*<ListaDeChequeo cliente=\{c\} \/>/);
  assert.match(clientes, /setCabeceraVisible\(false\);\s*void refrescar\(\);\s*\}\}/, 'al cerrar la ventana la lista no se relee');
  const lista = leer('components/ajustes/ListaDeChequeo.jsx');
  assert.equal([...lista.matchAll(/const lista = cliente\.listaDeChequeo;/g)].length, 2, 'la píldora o la lista no son las que manda el servidor');
});

test('Negocios ofrece «Agregar cliente» con la capacidad de alta, el orgId de esa empresa y el catálogo de su lista', () => {
  const panel = leer('components/cartera/PanelDeNegocios.jsx');
  assert.match(panel, /\{sesion\?\.puedeCrearClientes && e\.activa \? \(\s*<button type="button" className="fd-btn-menor" onClick=\{\(\) => void abrirElAlta\(e\)\}>\s*Agregar cliente/);
  assert.match(panel, /pedir\('\/api\/admin\/cuentas', \{ metodo: 'POST', cuerpo: \{ \.\.\.cuerpoDe\(valores\), orgId: empresa\.id \} \}\)/);
  assert.match(panel, /pedir\(`\/api\/admin\/cuentas\?orgId=\$\{encodeURIComponent\(e\.id\)\}`\)/, 'el catálogo no es el de la lista de esa empresa');
  assert.match(panel, /<FormularioDeCliente valores=\{valores\} alCambiar=\{setValores\} catalogo=\{alta\.catalogo\}/);
  // Después del alta, el tablero se relee: el cliente nuevo aparece con lo que le falta.
  assert.match(panel, /setAlta\(null\);\s*setAviso\(\{[\s\S]{0,300}\}\);\s*await refrescar\(\);/);
});

test('el aviso del alta desde Negocios nombra a los closers que no van a ver al cliente, con el texto de Ajustes', () => {
  const panel = leer('components/cartera/PanelDeNegocios.jsx');
  // Un solo texto: el de Ajustes › Clientes, que la 291 mira.
  assert.match(leer('components/ajustes/Clientes.jsx'), /^export function closersSinVincular\(nombres, cliente\) \{/m);
  assert.match(panel, /^import \{ closersSinVincular \} from '\.\.\/ajustes\/Clientes\.jsx';$/m);
  assert.match(panel, /const sin = closersSinVincular\(r\.datos\.closersSinVincular, nombre\);/, 'el alta no lee los closers de la respuesta');
  assert.match(
    panel,
    /setAviso\(\{\s*mal: false,\s*texto:[\s\S]{0,200}?`a la empresa, en Ajustes › Clientes\.\$\{sin \? ` \$\{sin\}` : ''\}`,\s*\}\);/,
    'el aviso del alta desde Negocios no nombra a los closers sin vincular',
  );
});

test('los textos de la lista y del alta hablan de tú', () => {
  for (const ruta of ['components/ajustes/ListaDeChequeo.jsx', 'components/cartera/PanelDeNegocios.jsx', 'components/ajustes/Clientes.jsx']) {
    assert.equal(VOSEO.exec(leer(ruta)), null, `${ruta} vosea`);
  }
  assert.match(leer('components/ajustes/ListaDeChequeo.jsx'), /Conecta Meta en \$\{dondeSeCarga\(c\)\} y asígnale su cuenta publicitaria: de ahí salen sus costos/);
});
