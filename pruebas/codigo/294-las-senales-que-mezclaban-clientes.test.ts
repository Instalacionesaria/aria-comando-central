// LAS SEÑALES QUE MEZCLABAN CLIENTES: CADA UNO CONTRA LO SUYO, SIN BASE. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, C6 · D3)
//
// Con dos clientes, tres detectores comparaban la campaña, el funnel, el patrón o la familia de un cliente contra los
// de toda la empresa, y un cliente atrasado callaba a todos. Lo que no necesita base, con dos clientes de ids con forma
// de uuid; la base lo mira la 295. Cada afirmación dice la mutación que la pone en rojo:
//
//   · el identificador: el de siempre para el principal, con el cliente adelante para otro —mutación: el prefijo
//     siempre—, y el de una pieza nunca pasa el tope de la tabla —mutación: el detector de Creative sin cortarlo—;
//   · el ICP contra SU funnel EN SU cliente —mutación: contra el de la empresa—; la fuga entre los funnels de SU cliente
//     —mutación: sumarlos todos—, con ids distintos —mutación: sin prefijo—;
//   · el monitor de cada cliente —mutación: el de la empresa—, y un cliente sin denominador no lo frena —mutación:
//     «alguno con sobre 0»—;
//   · el conjunto con el freno de Meta y su anterior —mutaciones: el freno de los costos, la anterior de la pantalla—;
//   · Conversation por (cliente, agente, patrón), con su `issue_source` —mutación: agrupar sin el cliente—, y un
//     cliente atrasado no calla a los demás —mutación: callar todo—;
//   · Conversion contra la cohorte de cada cliente —mutación: la de la empresa—, el formulario de cada CRM —mutación:
//     el cliente sin campo frena—, y el cliente atrasado no publica —mutación: sin su freno—;
//   · las frases dicen «de su cliente» sólo con él, y nunca el uuid —mutación: el título de `entidad.id`—; el paso de una
//     señal sin el prefijo —mutación: comparar el id entero—; el plan nombra al cliente que no se midió —mutación:
//     ignorar `sinMedicionDeClientes`— y de qué cliente falta el gasto, con la frase de la pantalla;
//   · la fuente: el componente nombra la fuga y el cajón de Conversion con el cliente, con el módulo puro.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';
import { campana, medida as medidaDeAcquisition } from '../apoyo/medida-de-acquisition.ts';
import {
  idConCliente,
  idDeLaPiezaEnUnaSenal,
  nombreDeLaPieza,
  partirIdConCliente,
  partirIdDeLaPieza,
  TOPE_DE_LA_ENTIDAD,
} from '../../lib/negocio/idDeLaPieza.ts';
import { ACQ, detectarEnAcquisition } from '../../lib/agentes/detectores/acquisition.ts';
import { CONV, detectarEnConversation, type MedidaDeConversation } from '../../lib/agentes/detectores/conversation.ts';
import { CNV, NO_TOCAR, detectarEnConversion, type MedidaDeConversion } from '../../lib/agentes/detectores/conversion.ts';
import { CRE, detectarEnCreative, type MedidaDeCreative } from '../../lib/agentes/detectores/creative.ts';
import { FRASE_DE_LA_FALTA, porQueFaltaElGasto, textoDe, armarPlanDeAcquisition } from '../../lib/agentes/plan/acquisition.ts';
import { armarPlanDeConversation } from '../../lib/agentes/plan/conversation.ts';
import { armarPlanDeConversion, textoDeConversion } from '../../lib/agentes/plan/conversion.ts';
import { pasoDeLaSenal } from '../../lib/negocio/pasosDeConversion.ts';
import { CATALOGO_DE_REGLAS, umbralVigente } from '../../lib/agentes/senales/umbrales.ts';
import { huellaDe, type Deteccion } from '../../lib/agentes/senales/tipos.ts';
import type { Familia } from '../../lib/negocio/recorrido.ts';
import type { FatigaDeUnCreativo } from '../../lib/negocio/fatigaDelCreativo.ts';

const P = '11111111-1111-4111-8111-111111111111';
const Y = '22222222-2222-4222-8222-222222222222';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
const umbral = (codigo: string) => umbralVigente(CATALOGO_DE_REGLAS.find((r) => r.codigo === codigo)!, new Map());
const leer = (ruta: string) => sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8'));
const cliente = (d: Deteccion) => (d.evidencia as { cliente?: string }).cliente;

// ─── El identificador ───────────────────────────────────────────────────────

test('el identificador con cliente: el de siempre para el principal y la empresa, con el cliente adelante para otro', () => {
  assert.equal(idConCliente(P, 'landing', P), 'landing', 'la señal del principal cambió de huella al sumar un cliente');
  assert.equal(idConCliente(null, 'landing', P), 'landing');
  assert.equal(idConCliente(Y, 'landing', P), `${Y}:landing`);
  assert.equal(idConCliente(P, 'landing', null), `${P}:landing`, 'sin el principal a la vista, todo lleva su cliente');
  assert.deepEqual(partirIdConCliente(`${Y}:chat_pre_agenda:precio`), { cuentaId: Y, resto: 'chat_pre_agenda:precio' });
  assert.deepEqual(partirIdConCliente('leadform:contactos>agendados'), { cuentaId: null, resto: 'leadform:contactos>agendados' });
  // El más largo de los nuevos —un patrón de 48 letras de otro cliente— entra holgado en la tabla.
  assert.ok(idConCliente(Y, `chat_post_agenda:${'p'.repeat(48)}`, P).length <= TOPE_DE_LA_ENTIDAD);
});

test('una pieza con un nombre largo no pasa el tope de la tabla: se corta, estable y distinta', () => {
  const largo = 'x'.repeat(170);
  const id = idDeLaPiezaEnUnaSenal(Y, largo, P);
  assert.ok(id.length <= TOPE_DE_LA_ENTIDAD, `${id.length} caracteres: la pasada de Creative fallaría entera`);
  assert.equal(id, idDeLaPiezaEnUnaSenal(Y, largo, P), 'el mismo nombre cambió de identificador');
  assert.notEqual(id, idDeLaPiezaEnUnaSenal(Y, `${largo}y`, P), 'dos nombres largos con el mismo comienzo son una sola señal');
  assert.equal(partirIdDeLaPieza(id).cuentaId, Y);
  assert.match(nombreDeLaPieza(id), /^x+…$/, 'se dibuja la huella del corte');
  // Debajo del tope, la de siempre; también la del principal, que no lleva prefijo.
  assert.equal(idDeLaPiezaEnUnaSenal(Y, 'hook', P), `${Y}:hook`);
  assert.equal(idDeLaPiezaEnUnaSenal(P, 'hook', P), 'hook');
  assert.ok(idDeLaPiezaEnUnaSenal(P, 'y'.repeat(250), P).length <= TOPE_DE_LA_ENTIDAD);
  // Por letras enteras: un emoji no se parte por la mitad.
  const conEmoji = idDeLaPiezaEnUnaSenal(Y, '🎬'.repeat(120), P);
  assert.ok(conEmoji.length <= TOPE_DE_LA_ENTIDAD);
  assert.doesNotMatch(conEmoji, /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/, 'quedó media letra');

  // El detector de Creative usa el cortado.
  const fatiga = { cuentaId: Y, creativo: largo, dias: 20, desde: '2026-09-10', hasta: '2026-10-04', ctrTemprano: 3, ctrTardio: 2, caida: 0.4, fatigado: true, motivo: null, porque: null } as FatigaDeUnCreativo;
  const m: MedidaDeCreative = {
    ventana: '30d',
    periodo: { desde: '2026-09-21', hasta: '2026-10-20' },
    calidad: { filas: [], campoDeIcp: 'campo' },
    rendimiento: { filas: [] },
    fatiga: { filas: [fatiga] },
    principal: P,
    frecuencias: null,
    anunciosAlDia: true,
    gastoCuadra: true,
  };
  const caidas = detectarEnCreative(m, umbral).detecciones.filter((d) => d.regla === CRE.caidaDeCtr);
  assert.equal(caidas.length, 1);
  assert.ok(caidas[0]!.entidad.id.length <= TOPE_DE_LA_ENTIDAD, 'el detector de Creative no corta el nombre largo');
});

// ─── Acquisition ────────────────────────────────────────────────────────────

test('el ICP de una campaña se compara con SU funnel EN SU cliente', () => {
  /* X: 90, 90 y 65 (promedio 81,7): la de 65 está 16,7 abajo. Y: 40 y 40. Juntas, el funnel promedia 65: la de X
     quedaba tapada y las dos de Y salían por estar 25 abajo de un público que no es el suyo. */
  const icp = (suma: number) => ({ sumaDePuntajes: suma, conPuntaje: 10, calificados: 10 });
  const r = detectarEnAcquisition(
    medidaDeAcquisition({
      campanas: ['x1', 'x2', 'x3', 'y1', 'y2'].map((c) => campana(c, 'leadform')),
      actual: [['x1', icp(900)], ['x2', icp(900)], ['x3', icp(650)], ['y1', icp(400)], ['y2', icp(400)]],
      previa: [],
      clienteDe: [['x1', P], ['x2', P], ['x3', P], ['y1', Y], ['y2', Y]],
      principal: P,
    }),
    umbral,
  );
  const i = r.detecciones.filter((d) => d.regla === ACQ.icpEntreCampanas);
  assert.deepEqual(i.map((d) => [d.entidad.id, d.lineaBase, d.valorActual, cliente(d)]), [['x3', 81.7, 65, P]]);
  assert.equal(
    textoDe(i[0]!, '30d'),
    'Su ICP promedio está 16,7 puntos por debajo del de su funnel en su cliente: 65 contra 81,7, sobre 10 calificados con puntaje.',
  );
});

test('la fuga se mide entre los funnels de SU cliente, con el identificador de cada uno', () => {
  const r = detectarEnAcquisition(
    medidaDeAcquisition({
      campanas: [campana('xl', 'leadform'), campana('xp', 'profile'), campana('yl', 'leadform'), campana('yp', 'profile')],
      actual: [['xl', { contactos: 100, agendados: 50 }], ['xp', { contactos: 100, agendados: 10 }], ['yl', { contactos: 100, agendados: 90 }], ['yp', { contactos: 100, agendados: 50 }]],
      previa: [],
      clienteDe: [['xl', P], ['xp', P], ['yl', Y], ['yp', Y]],
      principal: P,
    }),
    umbral,
  );
  const f = r.detecciones.filter((d) => d.regla === ACQ.fugaEntreEtapas);
  assert.deepEqual(f.map((d) => [d.entidad.id, d.lineaBase, d.valorActual, cliente(d)]), [
    ['profile:contactos>agendados', 0.5, 0.1, P],
    [`${Y}:profile:contactos>agendados`, 0.9, 0.5, Y],
  ]);
  assert.equal(new Set(f.map((d) => huellaDe('acquisition', d, '30d'))).size, 2, 'dos clientes dan la misma huella: la pasada fallaría');
  assert.equal(
    textoDe(f[1]!, '30d'),
    'El paso de contacto a agendado está 40 puntos por debajo del de los otros funnels de su cliente: 50 % contra 90 %, sobre 100 contactos.',
  );
});

test('el monitor es de cada cliente: el chico no queda tapado, y uno sin denominador no frena a los demás', () => {
  /* X: 190 de 200 con anuncio; Y: 10 de 20. Juntos, 200 de 220 (0,909): la empresa no avisaba. Las ventas: X 5 de 10, Y
     ninguna en la ventana. */
  const base = { campanas: [campana('x', 'leadform'), campana('y', 'leadform')], actual: [], previa: [], clienteDe: [['x', P], ['y', Y]] as [string, string][], principal: P };
  const r = detectarEnAcquisition(
    medidaDeAcquisition({
      ...base,
      atribucionPorCliente: [
        [P, { leads_con_anuncio: [190, 200], ventas_con_anuncio: [5, 10] }],
        [Y, { leads_con_anuncio: [10, 20], ventas_con_anuncio: [0, 0] }],
      ],
    }),
    umbral,
  );
  const de = (regla: string) => r.detecciones.filter((d) => d.regla === regla).map((d) => [d.entidad.tipo, d.entidad.id, d.valorActual, d.muestra]);
  assert.deepEqual(de(ACQ.atribucionContactos), [['cliente', Y, 0.5, 20]]);
  assert.deepEqual(de(ACQ.atribucionVentas), [['cliente', P, 0.5, 10]]);
  assert.ok(!r.sinMedicion.includes(ACQ.atribucionVentas), 'un cliente sin ventas en la ventana dejó la regla sin medición para todos');
  const contactos = r.detecciones.find((d) => d.regla === ACQ.atribucionContactos)!;
  assert.equal(cliente(contactos), Y);
  assert.equal(textoDe(contactos, '30d'), 'Título de leads_con_anuncio en este cliente: 50 %, 10 de 20; consecuencia de leads_con_anuncio');
  // Ninguno con ventas: la regla no se puede medir, como la de la empresa.
  const ninguno = detectarEnAcquisition(
    medidaDeAcquisition({ ...base, atribucionPorCliente: [[P, { ventas_con_anuncio: [0, 0] }], [Y, { ventas_con_anuncio: [0, 0] }]] }),
    umbral,
  );
  assert.ok(ninguno.sinMedicion.includes(ACQ.atribucionVentas));
});

test('el conjunto lee Meta: lo frena el freno de Meta, con su anterior, y no un cliente sin Meta', () => {
  const conjuntos: [string, { gasto: number; contactos: number; gastoAntes: number; contactosAntes: number }][] = [
    ['70', { gasto: 160, contactos: 20, gastoAntes: 100, contactosAntes: 10 }],
  ];
  const deMeta = { desde: '2026-08-20', hasta: '2026-08-26' };
  // La pantalla no compara ni publica costos —un cliente pautó sin Meta—, y los días de Meta están enteros.
  const m = {
    ...medidaDeAcquisition({ ventana: '7d', campanas: [], actual: [], previa: [], conjuntos, sinComparacion: 'faltan_dias', sinCostos: 'gasto_incompleto', faltanDiasDeMeta: false, clienteDelConjunto: [['70', P]] }),
    anteriorDeMeta: deMeta,
  };
  const r = detectarEnAcquisition(m, umbral);
  assert.ok(!r.sinMedicion.includes(ACQ.cambioBruscoConjunto), 'un cliente sin Meta frenó el conjunto de los demás');
  const c = r.detecciones.filter((d) => d.regla === ACQ.cambioBruscoConjunto);
  assert.deepEqual(c.map((d) => [d.entidad.id, (d.evidencia as { anterior: unknown }).anterior, cliente(d)]), [['70', deMeta, P]]);
  // Con días de Meta sin leer, no.
  assert.ok(detectarEnAcquisition({ ...m, faltanDiasDeMeta: true }, umbral).sinMedicion.includes(ACQ.cambioBruscoConjunto));
});

// ─── Conversation ───────────────────────────────────────────────────────────

const AHORA = new Date('2026-10-06T15:00:00Z');
type Caso = MedidaDeConversation['casos'][number];
let n = 0;
const caso = (cuentaId: string, cambios: Partial<Caso> = {}): Caso => ({
  hallazgoId: `h${(n += 1)}`,
  patron: 'promete_descuento',
  agente: 'chat_post_agenda',
  contactoId: `k${n}`,
  titulo: 'Promete descuentos',
  severidad: 'amarillo',
  categoria: 'comportamiento',
  detectadoEl: new Date(AHORA.getTime() - 86_400_000),
  fragmentoPrompt: null,
  promptSeccion: null,
  cuentaId,
  ...cambios,
});
const conversation = (casos: Caso[], extra: Partial<MedidaDeConversation> = {}): MedidaDeConversation => ({
  ventana: '7d',
  periodo: { desde: '2026-09-30', hasta: '2026-10-06' },
  casos,
  auditorAlDia: true,
  ahora: AHORA,
  variosClientes: true,
  principal: P,
  atrasados: [],
  ...extra,
});

test('Conversation: el mismo patrón en dos clientes son dos señales, cada una con el fragmento de su cliente', () => {
  const casos = [caso(P, { fragmentoPrompt: 'Si duda, ofrece 10 %.', promptSeccion: 'Precios' }), caso(Y)];
  const r = detectarEnConversation(conversation(casos), umbral);
  assert.deepEqual(r.detecciones.map((d) => [d.entidad.id, d.issueSource, cliente(d)]), [
    ['chat_post_agenda:promete_descuento', 'prompt_design', P],
    [`${Y}:chat_post_agenda:promete_descuento`, 'agent_execution', Y],
  ]);
  assert.equal(r.detecciones[0]!.revisionRecomendada, 'Revisa el prompt del agente de este cliente en «Precios»: el auditor propone una corrección, y la publica una persona.');
  assert.equal(r.sinMedicionDeClientes, undefined);
  // El identificador no depende de la bandera: con los hallazgos de un solo cliente, el suyo, sin nombrarlo.
  const uno = detectarEnConversation(conversation([caso(Y)], { variosClientes: undefined }), umbral);
  assert.deepEqual(uno.detecciones.map((d) => [d.entidad.id, cliente(d)]), [[`${Y}:chat_post_agenda:promete_descuento`, undefined]]);
});

test('Conversation: un cliente atrasado no calla a los demás; lo suyo queda sin medición y el plan lo nombra', () => {
  const r = detectarEnConversation(conversation([caso(P), caso(Y)], { atrasados: [{ id: Y, nombre: 'Ye' }] }), umbral);
  assert.deepEqual(r.detecciones.map((d) => d.entidad.id), ['chat_post_agenda:promete_descuento'], 'el atrasado publicó, o calló a los demás');
  assert.deepEqual(r.sinMedicion, []);
  assert.deepEqual(r.sinMedicionDeClientes, [{ regla: CONV.patronAbierto, cuentaId: Y, cliente: 'Ye' }]);
  const plan = armarPlanDeConversation({ ...r, ventana: '7d', dia: '2026-10-06', vigentes: r.detecciones });
  assert.deepEqual(plan.sinMedicion, ['en «Ye», los patrones del auditor: la tarea del auditor no está al día']);
  assert.equal(plan.grupos.flatMap((g) => g.renglones)[0]!.cliente, P, 'el renglón no dice de qué cliente es');
});

// ─── Conversion ─────────────────────────────────────────────────────────────

type Fila = MedidaDeConversion['recorrido']['filas'][number];
const fila = (familia: Familia, contactos: number, agendaron: number) => ({ familia, titulo: familia, contactos, porcion: 0, agendaron, capturadaAlReservar: 0 }) as Fila;
const recorrido = (filas: Fila[]) => ({ filas, cohorte: filas.reduce((s, f) => s + f.contactos, 0), desde: '2026-09-07', hasta: '2026-10-06' });
const igual = (filas: Fila[]) => ({ filas: filas.map((f) => ({ familia: f.familia, contactos: f.contactos })), cohorte: filas.reduce((s, f) => s + f.contactos, 0) });
const DE_X = [fila('landing', 20, 4), fila('widget', 30, 24)];
const DE_Y = [fila('landing', 50, 40), fila('widget', 50, 10)];
const conCampo = (con: number, sobre: number) => ({ cobertura: { con, sobre }, finalizacion: null, campoDelFormulario: 'campo' });
const sinCampo = { cobertura: { con: 0, sobre: 0 }, finalizacion: null, campoDelFormulario: null };

function conversion(extra: Partial<MedidaDeConversion> = {}): MedidaDeConversion {
  const todas = [fila('landing', 70, 44), fila('widget', 80, 34)];
  return {
    ventana: '30d',
    recorrido: recorrido(todas),
    anterior: igual(todas),
    formulario: conCampo(2, 150),
    contactosAlDia: true,
    periodo: { desde: '2026-09-07', hasta: '2026-10-06' },
    porCliente: [
      { cuentaId: P, nombre: 'Pe', recorrido: recorrido(DE_X), anterior: igual(DE_X), formulario: conCampo(2, 50) },
      { cuentaId: Y, nombre: 'Ye', recorrido: recorrido(DE_Y), anterior: null, formulario: sinCampo },
    ],
    principal: P,
    atrasados: [],
    ...extra,
  };
}
const detectarConversion = (m: MedidaDeConversion) => detectarEnConversion(m, umbral);

test('Conversion: cada cliente contra SU cohorte, su anterior y el formulario de SU CRM', () => {
  /* X: la landing agenda 20 % contra 56 %. Y: el widget 20 % contra 50 %. Juntas, la landing agenda MÁS que la cohorte
     (63 % contra 52 %) y el widget queda 9,5 puntos abajo: la empresa no decía nada de ninguna. */
  const r = detectarConversion(conversion());
  const de = (regla: string) => r.detecciones.filter((d) => d.regla === regla).map((d) => [d.entidad.id, cliente(d)]);
  assert.deepEqual(de(CNV.familiaQueNoAgenda), [['landing', P], [`${Y}:widget`, Y]]);
  assert.deepEqual(r.informativas.map((d) => [d.regla, d.entidad.id]), [[NO_TOCAR, 'widget'], [NO_TOCAR, `${Y}:landing`]]);
  // El formulario: el de X, con SU cohorte (2 de 50); Y no tiene el campo, y no frena a nadie.
  assert.deepEqual(de(CNV.formularioSinDatos), [['formulario', P]]);
  assert.deepEqual(r.sinMedicion, [], 'un cliente sin el campo, o sin anterior, dejó la regla sin medición para todos');
  // Sin anterior que SU lectura compare, el cambio de ruta de Y no se mide; el de X, sí.
  assert.deepEqual(r.sinMedicionDeClientes, [{ regla: CNV.cambioDeRuta, cuentaId: Y, cliente: 'Ye' }]);
  // Ninguno con el campo: como siempre.
  const ningunCampo = detectarConversion(conversion({ porCliente: conversion().porCliente!.map((c) => ({ ...c, formulario: sinCampo })) }));
  assert.ok(ningunCampo.sinMedicion.includes(CNV.formularioAbandono) && ningunCampo.sinMedicion.includes(CNV.formularioSinDatos));
  // La frase dice «de su cliente» y nunca el uuid.
  const widget = r.detecciones.find((d) => d.entidad.id === `${Y}:widget`)!;
  assert.equal(
    textoDeConversion(widget, '30d'),
    '«Widget de reserva» agenda el 20 % de sus 50 contactos, 30 puntos por debajo de la cohorte de su cliente (50 % de 100). Le toca a Conversion.',
  );
  assert.equal(widget.revisionRecomendada, 'Revisa ese recorrido: agenda bastante menos que el resto de la cohorte de su cliente.');
  for (const d of [...r.detecciones, ...r.informativas]) assert.doesNotMatch(textoDeConversion(d, '30d'), UUID, d.entidad.id);
});

test('Conversion: un cliente atrasado no publica sus familias, y lo de los demás sí', () => {
  const r = detectarConversion(conversion({ atrasados: [{ id: Y, nombre: 'Ye' }] }));
  assert.deepEqual(r.detecciones.filter((d) => d.regla === CNV.familiaQueNoAgenda).map((d) => d.entidad.id), ['landing']);
  assert.deepEqual(r.sinMedicion, []);
  assert.deepEqual((r.sinMedicionDeClientes ?? []).map((x) => [x.regla, x.cuentaId]), [
    [CNV.familiaQueNoAgenda, Y],
    [CNV.cambioDeRuta, Y],
  ]);
  const plan = armarPlanDeConversion({ ...r, ventana: '30d', dia: '2026-10-06', vigentes: r.detecciones });
  assert.ok(plan.sinMedicion.includes('en «Ye», cuánto agenda cada recorrido: la lectura de contactos no está al día'), plan.sinMedicion.join(' | '));
  // El renglón informativo de «No tocar» dice de qué cliente es.
  assert.deepEqual(plan.grupos.find((g) => g.clave === 'no_tocar')!.renglones.map((x) => x.cliente), [P]);
});

test('Conversion con los contactos de un solo cliente: la cohorte de siempre, con el identificador de ese cliente', () => {
  const uno = (deUnCliente: string) =>
    detectarConversion(conversion({ porCliente: undefined, deUnCliente, recorrido: recorrido(DE_X), anterior: igual(DE_X), formulario: conCampo(2, 50) }));
  // El principal: las huellas y la evidencia de siempre, sin nombrar a nadie.
  const delPrincipal = uno(P);
  assert.deepEqual([...delPrincipal.detecciones, ...delPrincipal.informativas].map((d) => [d.entidad.id, cliente(d)]), [
    ['landing', undefined],
    ['formulario', undefined],
    ['widget', undefined],
  ]);
  // Otro cliente: con su id adelante desde el primer día, para que no cambie el día que llega el segundo.
  assert.deepEqual(uno(Y).detecciones.map((d) => d.entidad.id), [`${Y}:landing`, `${Y}:formulario`]);
});

test('el paso de una señal de Conversion se lee sin el cliente de su id', () => {
  assert.equal(pasoDeLaSenal({ tipo: 'funnel', id: `${Y}:formulario` }), 'form');
  assert.equal(pasoDeLaSenal({ tipo: 'funnel', id: 'formulario' }), 'form');
  assert.equal(pasoDeLaSenal({ tipo: 'familia_de_entrada', id: `${Y}:landing` }), 'sesiones');
});

// ─── El plan y la pantalla ──────────────────────────────────────────────────

test('el plan de Acquisition dice de qué cliente falta el gasto, con la frase de la pantalla', () => {
  const falta = [{ cliente: 'Beta', falta: 'meta_sin_conectar' as const }];
  assert.deepEqual(porQueFaltaElGasto([ACQ.cplSostenido], falta), ['Beta no tiene Meta conectado: conéctalo en Ajustes']);
  assert.deepEqual(porQueFaltaElGasto([ACQ.sinEntrega], falta), [], 'el gasto de un cliente no frena lo que sólo lee Meta');
  assert.deepEqual(porQueFaltaElGasto([ACQ.cplSostenido], []), []);
  const plan = armarPlanDeAcquisition({
    detecciones: [],
    sinMedicion: [ACQ.cplSostenido],
    debajoDelPiso: [],
    porQueNoSeMidio: porQueFaltaElGasto([ACQ.cplSostenido], falta),
    ventana: '7d',
    dia: '2026-10-06',
    vigentes: [],
  });
  assert.deepEqual(plan.sinMedicion, [
    'el costo por contacto contra la ventana anterior: falta el gasto de algún día cerrado',
    'Beta no tiene Meta conectado: conéctalo en Ajustes',
  ]);
  // La misma frase que la nota de la pantalla, en minúscula y sin el punto.
  const panel = readFileSync(join(RAIZ, 'components/acquisition/PanelDeAcquisition.jsx'), 'utf8');
  for (const [clave, enLaPantalla] of [['meta_sin_conectar', 'metaSinConectar'], ['meta_caida', 'metaCaida'], ['no_activo', 'noActivo']] as const) {
    const frase = new RegExp(`${enLaPantalla}: '([^']+)'`).exec(panel)?.[1];
    assert.ok(frase, enLaPantalla);
    assert.equal(FRASE_DE_LA_FALTA[clave], (frase[0]!.toLowerCase() + frase.slice(1)).replace(/\.$/, ''), clave);
  }
});

test('las frases de siempre, sin cliente, no cambian', () => {
  const r = detectarEnAcquisition(
    medidaDeAcquisition({
      campanas: [campana('xl', 'leadform'), campana('xp', 'profile')],
      actual: [['xl', { contactos: 100, agendados: 50 }], ['xp', { contactos: 100, agendados: 10 }]],
      previa: [],
    }),
    umbral,
  );
  const f = r.detecciones.find((d) => d.regla === ACQ.fugaEntreEtapas)!;
  assert.equal(f.entidad.id, 'profile:contactos>agendados');
  assert.equal(cliente(f), undefined);
  assert.equal(textoDe(f, '30d'), 'El paso de contacto a agendado está 40 puntos por debajo del de los otros funnels: 10 % contra 50 %, sobre 100 contactos.');
});

test('la pantalla nombra la fuga y los cajones de Conversion con su cliente, con el módulo puro', () => {
  const senales = leer('components/senales/SenalesDelDepartamento.jsx');
  assert.match(senales, /import \{ nombreDeLaPieza, partirIdConCliente \} from '@\/lib\/negocio\/idDeLaPieza';/);
  // La fuga, antes del nombre del servidor y sin el uuid de su id.
  assert.match(
    senales,
    /if \(entidad\.tipo === 'par_de_etapas'\) \{\s*const resto = partirIdConCliente\(entidad\.id\)\.resto;\s*const funnel = funnels\[resto\.split\(':'\)\[0\]\]\?\.nombre \?\? resto;\s*return cliente \? `\$\{funnel\} \(\$\{cliente\}\)` : funnel;\s*\}\s*if \(delServidor\) return delServidor;/,
  );
  assert.doesNotMatch(senales, /entidad\.id\.split\(':'\)/, 'el componente lee el id entero, con el uuid de otro cliente');
  assert.match(senales, /nombre=\{nombreDe\(s\.entidad, nombres, funnels, s\.nombre, s\.cliente \?\? null\)\}/);
  assert.match(senales, /const nombre = nombreDe\(r\.entidad, nombres, funnels, null, clienteDe\(r\)\);/);
  const cajon = leer('components/conversion/CajonDelPaso.jsx');
  assert.match(cajon, /<div className="obs-t">\{conSuCliente\(s\.cliente, s\.texto\)\}<\/div>/);
  assert.match(cajon, /<div className="obs-t">\{conSuCliente\(delPlan\(r\), r\.texto\)\}<\/div>/);
});
