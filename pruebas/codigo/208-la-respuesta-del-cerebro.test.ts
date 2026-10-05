// LA RESPUESTA DEL CEREBRO SE VALIDA CONTRA LO QUE LEYÓ. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `lib/agentes/executive/respuesta.ts` y `herramientas.ts` (AG5; `docs/OTROS/agentes/03-EL-CEREBRO.md`,
// AG-47): el esquema estricto garantiza la forma, no que lo dicho sea cierto.
//
//   · Una cifra sin evidencia, con una evidencia que no existe, o cuyo valor no es el del CAMPO que cita, se
//     quita, y la respuesta lo dice. Con la tolerancia de redondeo: «29,3 %» de un 0,2927 pasa; un número que
//     está en otra parte de la evidencia (los días, el piso) no.
//   · Una recomendación que no cita lo leído, o con un número que no está entre las cifras, se quita; una
//     conclusión con un número así se marca y baja la confianza.
//   · Una acción se rechaza (`D-03`: la v1 lee y navega), y un paso a una sección que no se ve, también.
//   · Un nombre de herramienta inventado, o uno que esta persona no tiene, no se corre.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { numerosDelTexto, respaldada, validarRespuesta, valorEn, type Evidencia } from '../../lib/agentes/executive/respuesta.ts';
import { ejecutarHerramienta, herramientasPara } from '../../lib/agentes/executive/herramientas.ts';
import { SIN_DATOS_DE_LA_RUTA } from '../../lib/agentes/executive/adaptadores/comun.ts';

const EVIDENCIA: Evidencia[] = [
  { id: 'ev-1', herramienta: 'cadena_de_cierre', argumentos: { periodo: '30d' }, datos: { cohorte: 120, eslabones: [{ contactos: 46 }], tasa: 0.2927 } },
];
const base = (extra: Record<string, unknown> = {}) => ({
  conclusion: 'Una conclusión.',
  cifras: [],
  confianza: { nivel: 'alta', porque: 'Medido.' },
  areas: [],
  recomendaciones: [],
  no_hay_dato: [],
  siguientes: [],
  ...extra,
});
const cifra = (valor: number, campo = 'eslabones[0].contactos', ev = 'ev-1') => ({ valor, que_es: 'x', muestra: 'x', periodo: '30d', fuente: 'Sales', ev, campo });
const validar = (entrada: unknown, secciones = ['sales', 'acquisition']) => {
  const v = validarRespuesta(entrada, EVIDENCIA, secciones);
  assert.equal(v.tipo, 'valida');
  return (v as Extract<typeof v, { tipo: 'valida' }>).respuesta;
};

test('una cifra que es la de su campo queda; las demás se quitan y se dice', () => {
  const r = validar(
    base({ cifras: [cifra(46), cifra(47), cifra(46, 'eslabones[0].contactos', 'ev-9'), cifra(120, 'cohorte'), cifra(46, 'cohorte'), cifra(29.3, 'tasa')] }),
  );
  assert.deepEqual(r.cifras.map((c) => c.valor), [46, 120, 29.3]);
  assert.deepEqual(r.avisos, ['Se quitaron 3 cifras que no estaban en lo que leyó el cerebro.']);
  // Con una cifra quitada, la confianza no puede quedar alta.
  assert.equal(r.confianza.nivel, 'media');
});

test('una cifra sin `ev` válido se quita aunque el número exista en otra parte', () => {
  const r = validar(base({ cifras: [{ ...cifra(46), ev: '' }, { valor: 46, que_es: 'x' }] }));
  assert.deepEqual(r.cifras, []);
  assert.equal(r.avisos.length, 1);
});

test('la tolerancia es de redondeo y nada más, contra el valor del campo', () => {
  assert.ok(respaldada(29.27, 0.2927));
  assert.ok(respaldada(29.3, 0.2927));
  assert.ok(respaldada(29, 0.2927));
  assert.ok(respaldada(41, 41.0101));
  assert.ok(!respaldada(30, 0.2927), 'un número cerca pero distinto pasó');
  assert.ok(!respaldada(47, 46));
  // El porcentaje sólo de una proporción: un 30 de «días» no se vuelve 3.000.
  assert.ok(!respaldada(3000, 30));
  assert.ok(!respaldada(46, { contactos: 46 }), 'un objeto no es un número');
  assert.equal(valorEn({ a: [{ b: 3 }] }, 'a[0].b'), 3);
  assert.equal(valorEn({ a: 1 }, 'a.b.c'), undefined);
});

test('los números del texto se leen en español, sin fechas ni horas', () => {
  assert.deepEqual(numerosDelTexto('Invertiste 4.060 en 30 días, un 29,3 % menos.'), [4060, 30, 29.3]);
  assert.deepEqual(numerosDelTexto('Desde el 2026-10-04 a las 10:30.'), []);
});

test('un número de la conclusión que no está entre las cifras se marca, y la confianza baja', () => {
  const sin = validar(base({ conclusion: 'Cerraste 47 ventas en los últimos 30 días.', cifras: [cifra(46)] }));
  assert.equal(sin.confianza.nivel, 'baja');
  assert.match(sin.avisos.join(' '), /conclusión menciona un número/);
  const con = validar(base({ conclusion: 'Agendaron 46 de 120 en los últimos 30 días.', cifras: [cifra(46), cifra(120, 'cohorte')] }));
  assert.equal(con.confianza.nivel, 'alta');
  assert.deepEqual(con.avisos, []);
});

test('una recomendación que no cita lo leído se quita', () => {
  const r = validar(
    base({
      recomendaciones: [
        { texto: 'Registrar los resultados.', requiere_validacion_ejecutiva: false, ev: ['ev-1'] },
        { texto: 'Subir el presupuesto.', requiere_validacion_ejecutiva: true, ev: ['ev-7'] },
        { texto: 'Sin cita.', requiere_validacion_ejecutiva: false, ev: [] },
        { texto: 'Duplicar a 92 citas.', requiere_validacion_ejecutiva: false, ev: ['ev-1'] },
      ],
    }),
  );
  assert.deepEqual(r.recomendaciones.map((x) => x.texto), ['Registrar los resultados.']);
  assert.match(r.avisos.join(' '), /Se quitaron 3 recomendaciones/);
  assert.equal(r.confianza.nivel, 'media');
});

test('una acción se rechaza, y un paso a una sección que no se ve también', () => {
  const r = validar(
    base({
      siguientes: [
        { tipo: 'abrir', seccion: 'sales', pestana: null, contexto: null },
        { tipo: 'accion', accion: 'recordar_al_closer', parametros: {}, permiso: 'resultados.registrar' },
        { tipo: 'abrir', seccion: 'credenciales', pestana: null, contexto: null },
      ],
      areas: ['sales', 'credenciales'],
    }),
  );
  assert.deepEqual(r.siguientes, [{ tipo: 'abrir', seccion: 'sales', pestana: null, contexto: null }]);
  assert.deepEqual(r.areas, ['sales']);
  assert.match(r.avisos.join(' '), /acción/);
});

test('sin conclusión o sin las listas, la respuesta entera no sirve', () => {
  assert.equal(validarRespuesta(base({ conclusion: '' }), EVIDENCIA, []).tipo, 'invalida');
  assert.equal(validarRespuesta({ conclusion: 'x' }, EVIDENCIA, []).tipo, 'invalida');
  assert.equal(validarRespuesta('no', EVIDENCIA, []).tipo, 'invalida');
});

test('un nombre de herramienta inventado, o uno que no se ofreció, no se corre', async () => {
  const contexto = { zona: 'America/Lima', usuarioId: '00000000-0000-4000-8000-000000000000', secciones: ['sales'], deLaRuta: SIN_DATOS_DE_LA_RUTA };
  const deSales = herramientasPara(['sales']);
  assert.ok(deSales.some((h) => h.nombre === 'cadena_de_cierre'));
  assert.ok(!deSales.some((h) => h.nombre === 'embudos_de_acquisition'), 'se ofreció una herramienta de una sección que no se ve');
  const inventada = await ejecutarHerramienta('borrar_todo', {}, deSales, contexto);
  assert.equal(inventada.tipo, 'error');
  const ajena = await ejecutarHerramienta('embudos_de_acquisition', { periodo: '30d' }, deSales, contexto);
  assert.equal(ajena.tipo, 'error');
  const periodo = await ejecutarHerramienta('cadena_de_cierre', { periodo: 'mes' }, deSales, contexto);
  assert.deepEqual(periodo, { tipo: 'error', mensaje: 'Ese período no existe: usa hoy, 7d, 30d o completo.' });
});

test('la que sirve a dos secciones se ofrece con cualquiera; las de la sección abierta, primero', () => {
  assert.ok(herramientasPara(['conversation']).some((h) => h.nombre === 'cancelacion_de_citas'));
  assert.ok(herramientasPara(['sales']).some((h) => h.nombre === 'cancelacion_de_citas'));
  assert.deepEqual(herramientasPara(['contacts']).map((h) => h.nombre), ['cohorte_de_leads', 'frescura']);
  const conLaAbierta = herramientasPara(['acquisition', 'contacts'], 'contacts').map((h) => h.nombre);
  assert.equal(conLaAbierta[0], 'cohorte_de_leads');
});
