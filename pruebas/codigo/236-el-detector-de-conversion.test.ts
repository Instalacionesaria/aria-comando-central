// EL DETECTOR DE CONVERSION Y SU PLAN: LAS TRES PRIMERAS FUGAS, «NO TOCAR» Y A QUIÉN LE TOCA. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `lib/agentes/detectores/conversion.ts` y `lib/agentes/plan/conversion.ts` (AG14 de los agentes;
// `fichas/F04-CONVERSION.md`, la especificación validada; CV6-02 a CV6-08):
//
//   · una familia que agenda 15 puntos menos que la cohorte es una fuga, con su pérdida medida y a quién le
//     toca; con menos de 10 contactos se cuenta bajo el piso;
//   · las familias circulares y «sin rastro» no compiten;
//   · las que agendan igual o mejor van a «No tocar», que no es una señal;
//   · el cambio de ruta pide validación ejecutiva y piso en las dos ventanas;
//   · el formulario: sin datos, abandono, y «sin medición» sin su campo; sin contactos al día, tampoco el recorrido;
//   · el plan: sólo las tres fugas con más pérdida, cuántas quedaron afuera, y ningún nombre de persona.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { CNV, NO_TOCAR, detectarEnConversion, type MedidaDeConversion } from '../../lib/agentes/detectores/conversion.ts';
import { armarPlanDeConversion, PRIMERAS } from '../../lib/agentes/plan/conversion.ts';
import { CATALOGO_DE_REGLAS, umbralVigente } from '../../lib/agentes/senales/umbrales.ts';
import type { Familia } from '../../lib/negocio/recorrido.ts';

type Fila = MedidaDeConversion['recorrido']['filas'][number];
const fila = (familia: Familia, contactos: number, agendaron: number, capturadaAlReservar = 0) =>
  ({ familia, titulo: familia, contactos, porcion: 0, agendaron, capturadaAlReservar }) as Fila;

function medida(filas: Fila[], extra: Partial<MedidaDeConversion> = {}): MedidaDeConversion {
  const cohorte = filas.reduce((s, f) => s + f.contactos, 0);
  return {
    ventana: '30d',
    recorrido: { filas, cohorte, desde: '2026-09-07', hasta: '2026-10-06' },
    // Por omisión, la anterior es igual a la actual: sin cambio de ruta.
    anterior: { filas: filas.map((f) => ({ familia: f.familia, contactos: f.contactos })), cohorte },
    formulario: { cobertura: { con: 0, sobre: 0 }, finalizacion: null, campoDelFormulario: 'campo' },
    contactosAlDia: true,
    periodo: { desde: '2026-09-07', hasta: '2026-10-06' },
    ...extra,
  };
}
const detectar = (m: MedidaDeConversion) => detectarEnConversion(m, (c) => umbralVigente(CATALOGO_DE_REGLAS.find((r) => r.codigo === c)!, new Map()));
const de = (r: ReturnType<typeof detectar>, regla: string) => r.detecciones.filter((d) => d.regla === regla);

// Cohorte: 100 contactos, 50 agendaron (50 %).
const COHORTE = [
  fila('landing', 20, 4), // 20 %: 30 puntos abajo, le toca a Conversion
  fila('meta-navegador', 20, 6), // 30 %: 20 puntos abajo, le toca a Acquisition
  fila('widget', 30, 24), // 80 %: no tocar
  fila('otra', 12, 12, 12), // circular: no compite
  fila('sin-rastro', 10, 2), // no es un recorrido
  fila('precall', 8, 2), // 25 %, bajo el piso de 10
];

test('una fuga: 15 puntos bajo la cohorte, con su pérdida medida y a quién le toca', () => {
  const r = detectar(medida(COHORTE));
  const fugas = de(r, CNV.familiaQueNoAgenda);
  assert.deepEqual(
    fugas.map((d) => [d.entidad.id, d.valorActual, d.lineaBase, d.perdidaContactos, d.destino, d.muestra]),
    [
      ['landing', 0.2, 0.5, 16, null, 20],
      ['meta-navegador', 0.3, 0.5, 14, 'acquisition', 20],
    ],
  );
  assert.deepEqual(r.debajoDelPiso, [{ regla: CNV.familiaQueNoAgenda, entidad: { tipo: 'familia_de_entrada', id: 'precall' }, muestra: 8 }]);
});

test('las circulares y «sin rastro» no compiten; las que agendan igual o mejor van a «No tocar», que no es señal', () => {
  const r = detectar(medida(COHORTE));
  const ids = r.detecciones.map((d) => d.entidad.id);
  assert.ok(!ids.includes('otra') && !ids.includes('sin-rastro'));
  assert.deepEqual(r.informativas.map((d) => [d.regla, d.entidad.id]), [[NO_TOCAR, 'widget']]);
});

test('una familia apenas bajo la cohorte no es fuga ni «No tocar»', () => {
  // Cohorte 50 %: «widget» agenda el 45 %, cinco puntos abajo.
  const r = detectar(medida([fila('landing', 20, 11), fila('widget', 20, 9)]));
  assert.deepEqual([de(r, CNV.familiaQueNoAgenda).length, r.informativas.map((d) => d.entidad.id)], [0, ['landing']]);
});

test('el cambio de ruta pide validación ejecutiva, y piso en las dos ventanas', () => {
  const anterior = { filas: [{ familia: 'landing' as Familia, contactos: 50 }, { familia: 'widget' as Familia, contactos: 30 }], cohorte: 100 };
  const r = detectar(medida(COHORTE, { anterior }));
  const ruta = de(r, CNV.cambioDeRuta);
  // landing: del 50 % al 20 %; meta-navegador: del 0 % al 20 %. widget: igual.
  assert.deepEqual(ruta.map((d) => [d.entidad.id, d.lineaBase, d.valorActual, d.requiereValidacionEjecutiva, d.gravedad]), [
    ['landing', 0.5, 0.2, true, 'info'],
    ['meta-navegador', 0, 0.2, true, 'info'],
  ]);
  assert.equal(de(detectar(medida(COHORTE, { anterior: { ...anterior, cohorte: 9 } })), CNV.cambioDeRuta).length, 0);
});

test('el formulario: sin datos, abandono, y «sin medición» sin su campo', () => {
  const sinDatos = detectar(medida(COHORTE, { formulario: { cobertura: { con: 9, sobre: 100 }, finalizacion: null, campoDelFormulario: 'campo' } }));
  assert.deepEqual(de(sinDatos, CNV.formularioSinDatos).map((d) => d.valorActual), [0.09]);
  // Con la cohorte bajo el piso de 10, no se dice nada del formulario.
  const chica = detectar(medida([fila('landing', 9, 4)], { formulario: { cobertura: { con: 0, sobre: 9 }, finalizacion: null, campoDelFormulario: 'campo' } }));
  assert.equal(de(chica, CNV.formularioSinDatos).length, 0);
  const abandono = detectar(medida(COHORTE, { formulario: { cobertura: { con: 40, sobre: 100 }, finalizacion: 45, campoDelFormulario: 'campo' } }));
  assert.deepEqual(de(abandono, CNV.formularioAbandono).map((d) => [d.valorActual, d.perdidaContactos]), [[0.45, 22]]);
  assert.equal(de(abandono, CNV.formularioSinDatos).length, 0);
  const sinCampo = detectar(medida(COHORTE, { formulario: { cobertura: { con: 0, sobre: 100 }, finalizacion: null, campoDelFormulario: null } }));
  assert.deepEqual(sinCampo.sinMedicion, [CNV.formularioAbandono, CNV.formularioSinDatos]);
});

test('sin la lectura de contactos al día, el recorrido no se publica', () => {
  const r = detectar(medida(COHORTE, { contactosAlDia: false }));
  assert.deepEqual([de(r, CNV.familiaQueNoAgenda).length, r.informativas.length], [0, 0]);
  assert.deepEqual(r.sinMedicion, [CNV.familiaQueNoAgenda, CNV.cambioDeRuta]);
});

test('el plan: sólo las tres fugas con más pérdida, cuántas quedaron afuera, «No tocar», y ningún nombre de persona', () => {
  const filas = [
    fila('landing', 40, 4), // pierde 36
    fila('meta-navegador', 30, 3), // pierde 27
    fila('sin-pagina', 20, 2), // pierde 18
    fila('widget', 15, 1), // pierde 14: la cuarta, queda afuera
    fila('otra', 60, 60), // no tocar
  ];
  const r = detectar(medida(filas));
  assert.equal(de(r, CNV.familiaQueNoAgenda).length, 4);
  const p = armarPlanDeConversion({ ventana: '30d', dia: '2026-10-06', periodo: { desde: '2026-09-07', hasta: '2026-10-06' }, ...r, vigentes: r.detecciones });
  const primero = p.grupos.find((g) => g.clave === 'primero')!;
  assert.equal(primero.renglones.length, PRIMERAS);
  assert.deepEqual(primero.renglones.map((x) => x.entidad.id), ['landing', 'meta-navegador', 'sin-pagina']);
  assert.equal(p.fueraDelTope, 1);
  assert.match(primero.titulo, /las 3 que más gente pierden/);
  assert.deepEqual(p.grupos.find((g) => g.clave === 'no_tocar')!.renglones.map((x) => x.entidad.id), ['otra']);
  assert.equal(
    primero.renglones[1]!.texto,
    '«Meta, navegador interno» agenda el 10 % de sus 30 contactos, 32 puntos por debajo de la cohorte (42 % de 165). Le toca a Acquisition.',
  );
  // Las entidades son familias y el formulario: ni un nombre de contacto en el plan.
  assert.ok(p.grupos.flatMap((g) => g.renglones).every((x) => ['familia_de_entrada', 'funnel'].includes(x.entidad.tipo)));
});
