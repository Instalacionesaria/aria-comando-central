// Las cuentas de los tres funnels de Acquisition, sin base. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE SE AFIRMA, Y LA MUTACIÓN QUE CADA COSA TIENE QUE PONER EN ROJO
//
// El front del prototipo (docs/acquisition/14) dibuja lo que este módulo arma: no calcula nada. Acá se
// prueba la mitad PURA —A14-05 (sin tasa), A14-08 (el piso del promedio), A14-09, A14-11, A14-14 y el
// orden de A14-18—. Lo que vive en el SQL —A14-07, los días de A14-10, los clics nulos de A14-05, los
// cortes del ICP— se prueba contra la base en `pruebas/base/181-embudos-de-acquisition.test.ts`.
//
//   · una tasa bajo el piso es `null` — mutación: `<` por `<=` en el piso;
//   · un costo sin inversión es `null` y no «$0» — mutación: sacar la guarda de la inversión;
//   · la variación con la anterior en cero, o sin anterior, no compara; una caída a cero sí — mutación:
//     volver al `!actual` del prototipo;
//   · la Inversión se lee neutra — mutación: `mas_es_mejor` en la Inversión;
//   · `clics` no lleva tasa, la tasa se salta a los clics, y su costo usa sólo el gasto con desglose —
//     mutaciones: medir contra los clics, y dividir la inversión entera;
//   · en «Hoy» no hay costos — mutación: ignorar `conCostos`;
//   · los grupos suman agendados, calificados y el ICP de sus campañas — mutación: no sumar un campo;
//   · Booking tiene su etapa de formulario, sin dato — mutación: sacarla de `ETAPAS`;
//   · el ICP promedia sólo con diez puntajes — mutación: sin piso;
//   · las campañas se ordenan por inversión, después contactos, después id — mutación: por nombre;
//   · el total suma TODAS, con o sin funnel — mutación: sumar sólo las que tienen funnel.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  armarEmbudos,
  armarGrupo,
  CIFRAS_VACIAS,
  costo,
  ETAPAS,
  sumar,
  tasa,
  variacion,
  type Cifras,
} from '../../lib/negocio/embudosDeAcquisition.ts';
import { PISO_DE_UNA_TASA } from '../../lib/negocio/indicadoresDeCitas.ts';
import { archivosFuente } from '../apoyo/fuente.ts';

/**
 * Unas cifras con lo que se nombre y el resto en cero. Por omisión la campaña trae contactos atribuidos: toda su
 * inversión paga los costos de personas (A14-19).
 */
function cifras(c: Partial<Cifras>): Cifras {
  return { ...CIFRAS_VACIAS, inversionConContactos: c.inversion ?? 0, ...c };
}

// ─── 1 · Las cuentas sueltas ────────────────────────────────────────────────

test('una tasa bajo el piso es nula, y en el piso ya se publica', () => {
  assert.equal(tasa(3, PISO_DE_UNA_TASA - 1), null, 'publicó una tasa con nueve casos');
  assert.equal(tasa(5, PISO_DE_UNA_TASA), 5 / PISO_DE_UNA_TASA);
  assert.equal(tasa(null, 50), null);
  assert.equal(tasa(5, null), null);
});

test('un costo sin inversión, o sin etapa, es nulo y no «$0»', () => {
  /* Con la pauta parada llegan contactos de lo que se gastó antes. «$0 por contacto» diría que
     salieron gratis. */
  assert.equal(costo(0, 12), null, 'con inversión cero el costo tiene que ser nulo');
  assert.equal(costo(120, 0), null);
  assert.equal(costo(120, null), null);
  assert.equal(costo(120, 12), 10);
});

test('la variación no compara sin anterior ni con la anterior en cero; una caída a cero sí', () => {
  assert.deepEqual(variacion(10, null, 'mas_es_mejor'), { tipo: 'sin_comparacion' });
  assert.deepEqual(variacion(10, undefined, 'mas_es_mejor'), { tipo: 'sin_comparacion' });
  assert.deepEqual(variacion(null, 10, 'mas_es_mejor'), { tipo: 'sin_comparacion' });
  // El guardado va contra el DENOMINADOR: de 0 a 10 no hay porcentaje que decir.
  assert.deepEqual(variacion(10, 0, 'mas_es_mejor'), { tipo: 'sin_comparacion' });
  // Y de 10 a 0 sí: es una caída del 100 %, y el `!cur` del prototipo la dejaba sin flecha.
  assert.deepEqual(variacion(0, 10, 'mas_es_mejor'), { tipo: 'baja', porcentaje: 1, lectura: 'mala' });
  assert.deepEqual(variacion(12, 10, 'mas_es_mejor'), { tipo: 'sube', porcentaje: 0.2, lectura: 'buena' });
  // Bajo 0,5 % es «=» (`aios-command-center_1.html:5469`); en 0,5 % ya se dibuja la flecha.
  assert.deepEqual(variacion(1004, 1000, 'mas_es_mejor'), { tipo: 'igual' });
  assert.equal(variacion(1005, 1000, 'mas_es_mejor').tipo, 'sube');
});

test('la Inversión sube y baja sin color: gastar más no es bueno ni malo', () => {
  assert.deepEqual(variacion(200, 100, 'neutro'), { tipo: 'sube', porcentaje: 1, lectura: 'neutra' });
  assert.deepEqual(variacion(50, 100, 'neutro'), { tipo: 'baja', porcentaje: 0.5, lectura: 'neutra' });
  // Y la del grupo se pide así: una mutación a `mas_es_mejor` la pinta de verde.
  const g = armarGrupo('total', ETAPAS.total, cifras({ inversion: 200 }), cifras({ inversion: 100 }), 1);
  assert.equal(g.variacionDeInversion.tipo === 'sube' && g.variacionDeInversion.lectura, 'neutra');
});

test('sumar: los clics siguen nulos sólo si los dos lo son', () => {
  assert.equal(sumar(cifras({}), cifras({})).clics, null);
  assert.equal(sumar(cifras({ clics: null }), cifras({ clics: 3 })).clics, 3);
  assert.equal(sumar(cifras({ contactos: 2, sumaDePuntajes: 150 }), cifras({ contactos: 3, sumaDePuntajes: 50 })).contactos, 5);
});

test('un funnel suma los agendados, los calificados y el ICP de sus campañas', () => {
  /* Dos campañas del mismo funnel, cada una con seis puntajes: ninguna llega sola al piso del
     promedio, y el funnel sí. Si `sumar` perdiera un campo, la tarjeta dibujaría cero o «—». */
  const una = cifras({
    inversion: 60,
    inversionConDesglose: 60,
    clics: 30,
    contactos: 20,
    agendados: 8,
    calificados: 7,
    alto: 3,
    medio: 2,
    bajo: 1,
    sinCalificar: 1,
    sumaDePuntajes: 420,
    conPuntaje: 6,
  });
  const otra = cifras({
    inversion: 40,
    inversionConDesglose: 20,
    clics: 10,
    contactos: 10,
    agendados: 4,
    calificados: 6,
    alto: 1,
    medio: 2,
    bajo: 3,
    sinCalificar: 0,
    sumaDePuntajes: 300,
    conPuntaje: 6,
  });
  const p = armarEmbudos({
    ventana: { desde: '2026-09-23', hasta: '2026-09-29' },
    anterior: null,
    sinComparacion: 'periodo',
    campanas: [
      { campana: '1', nombre: 'a', estado: null, conocida: true, conContactos: true, funnel: 'profile' },
      { campana: '2', nombre: 'b', estado: null, conocida: true, conContactos: true, funnel: 'profile' },
    ],
    actual: new Map([
      ['1', una],
      ['2', otra],
    ]),
    previa: null,
    cobertura: { conCampana: 30, sobre: 30 },
    sinCostos: null,
  });
  const g = p.funnels.profile;
  assert.deepEqual(
    g.etapas.map((e) => e.valor),
    [30, 40, 12],
    'el funnel no sumó los contactos, los clics o los agendados',
  );
  assert.equal(g.etapas[1]?.costo, 80 / 40, 'el funnel no sumó el gasto con desglose');
  assert.equal(g.calificados.valor, 13);
  assert.deepEqual(
    [g.calificados.icp.alto, g.calificados.icp.medio, g.calificados.icp.bajo, g.calificados.icp.sinCalificar],
    [4, 4, 4, 1],
  );
  assert.equal(g.calificados.icp.promedio, 720 / 12, 'el promedio no salió de sumar los doce puntajes');
  // Y cada campaña sola, con seis, no lo publica.
  assert.ok(p.campanas.every((c) => c.cifras.calificados.icp.promedio === null));
});

// ─── 2 · Un grupo ───────────────────────────────────────────────────────────

test('Lead form ads: la entrada no tiene tasa, los clics tampoco, y la tasa se los salta', () => {
  const g = armarGrupo(
    'leadform',
    ETAPAS.leadform,
    cifras({ inversion: 300, inversionConDesglose: 180, contactos: 40, clics: 900, agendados: 12, calificados: 10 }),
    null,
    2,
  );
  assert.deepEqual(g.etapas.map((e) => e.etapa), ['contactos', 'clics', 'agendados']);
  const [entrada, clics, agendados] = g.etapas;
  assert.equal(entrada?.tasa, null, 'la entrada no tiene tasa');
  assert.equal(entrada?.costo, 300 / 40, 'se perdió el costo por lead');
  // Los clics son de Meta: no son personas, y una tasa «desde leads» pasaría del 100 %.
  assert.equal(clics?.deMeta, true);
  assert.equal(clics?.tasa, null, 'los clics llevan tasa');
  // Y se pagan con el gasto de las filas que los cuentan, no con la inversión entera.
  assert.equal(clics?.costo, 180 / 900, 'el costo por clic dividió gasto de filas sin desglose');
  // La tasa de los agendados es contra los CONTACTOS, no contra los clics.
  assert.equal(agendados?.tasa, 12 / 40, 'la tasa se midió contra los clics');
  assert.equal(agendados?.costo, 25);
  // Calificados sobre agendados, con el piso: doce agendados alcanzan.
  assert.equal(g.calificados.tasa, 10 / 12);
  assert.equal(g.calificados.costo, 30);
  assert.equal(g.campanas, 2);
});

test('Booking directo tiene su etapa de formulario, sin dato, y no corta la cadena', () => {
  const g = armarGrupo('booking', ETAPAS.booking, cifras({ inversion: 100, contactos: 20, clics: 50, agendados: 10 }), null, 1);
  assert.deepEqual(g.etapas.map((e) => e.etapa), ['contactos', 'forms', 'clics', 'agendados']);
  const forms = g.etapas[1];
  assert.deepEqual([forms?.valor, forms?.tasa, forms?.costo], [null, null, null], 'el formulario inventó un dato');
  // El hueco del formulario no cambia contra qué se mide el agendado: sigue siendo la entrada.
  assert.equal(g.etapas[3]?.tasa, 10 / 20);
});

test('en «Hoy» no hay costos: el gasto de hoy es una foto de la madrugada', () => {
  const g = armarGrupo(
    'total',
    ETAPAS.total,
    cifras({ inversion: 5, inversionConDesglose: 5, contactos: 15, clics: 30, agendados: 12, calificados: 10 }),
    null,
    1,
    false,
  );
  assert.ok(g.etapas.every((e) => e.costo === null), 'publicó un costo por etapa en «Hoy»');
  assert.equal(g.calificados.costo, null, 'publicó el costo por calificado en «Hoy»');
  // Las tasas sí: no dependen del gasto.
  assert.equal(g.etapas[2]?.tasa, 12 / 15);
});

test('las variaciones de cada etapa salen de la ventana anterior; los calificados no comparan', () => {
  const g = armarGrupo(
    'profile',
    ETAPAS.profile,
    cifras({ inversion: 100, contactos: 30, clics: 60, agendados: 12, calificados: 6 }),
    cifras({ inversion: 100, contactos: 20, clics: null, agendados: 12, calificados: 8 }),
    1,
  );
  assert.deepEqual(g.etapas.map((e) => e.variacion.tipo), ['sube', 'sin_comparacion', 'igual']);
  /* Los calificados NO comparan, ni con anterior: el descarte no tiene fecha y la anterior tuvo más
     tiempo para recibirlo, así que la flecha subiría siempre. */
  assert.deepEqual(g.calificados.variacion, { tipo: 'sin_comparacion' }, 'los calificados compararon');
  assert.deepEqual(g.variacionDeInversion, { tipo: 'igual' });
  // Y sin anterior, ninguna compara.
  const sin = armarGrupo('profile', ETAPAS.profile, cifras({ contactos: 30 }), null, 1);
  assert.ok(sin.etapas.every((e) => e.variacion.tipo === 'sin_comparacion'));
  assert.equal(sin.calificados.variacion.tipo, 'sin_comparacion');
});

test('el ICP promedia sólo los puntajes mayores que cero, y sólo desde diez', () => {
  const con = armarGrupo(
    'total',
    ETAPAS.total,
    cifras({ calificados: 12, alto: 5, medio: 4, bajo: 1, sinCalificar: 2, sumaDePuntajes: 700, conPuntaje: 10 }),
    null,
    1,
  );
  assert.equal(con.calificados.icp.promedio, 70);
  assert.deepEqual(
    [con.calificados.icp.alto, con.calificados.icp.medio, con.calificados.icp.bajo, con.calificados.icp.sinCalificar],
    [5, 4, 1, 2],
  );
  const pocos = armarGrupo('total', ETAPAS.total, cifras({ calificados: 9, sumaDePuntajes: 630, conPuntaje: 9 }), null, 1);
  assert.equal(pocos.calificados.icp.promedio, null, 'promedió nueve puntajes');
});

// ─── 3 · La pantalla ────────────────────────────────────────────────────────

const VENTANA = { desde: '2026-09-24', hasta: '2026-09-30' };

function pantalla(previa: Map<string, Cifras> | null) {
  return armarEmbudos({
    ventana: VENTANA,
    anterior: previa === null ? null : { desde: '2026-09-17', hasta: '2026-09-23' },
    sinComparacion: previa === null ? 'periodo' : null,
    campanas: [
      { campana: '300', nombre: 'bofu', estado: 'ACTIVE', conocida: true, conContactos: true, funnel: 'leadform' },
      { campana: '100', nombre: 'tofu', estado: 'ACTIVE', conocida: true, conContactos: true, funnel: 'booking' },
      { campana: '200', nombre: 'a mano', estado: null, conocida: true, conContactos: true, funnel: null },
      { campana: '400', nombre: null, estado: null, conocida: false, conContactos: true, funnel: null },
      { campana: '500', nombre: 'otra bofu', estado: 'PAUSED', conocida: true, conContactos: true, funnel: 'leadform' },
    ],
    actual: new Map([
      ['300', cifras({ inversion: 50, contactos: 9 })],
      ['100', cifras({ inversion: 80, contactos: 2 })],
      ['200', cifras({ inversion: 50, contactos: 5, agendados: 3 })],
      ['400', cifras({ contactos: 1 })],
    ]),
    previa,
    cobertura: { conCampana: 17, sobre: 20 },
    sinCostos: null,
  });
}

test('las campañas van por inversión, después por contactos, después por id — nunca por nombre', () => {
  /* 100 (80) · 300 (50, 9 contactos) · 200 (50, 5) · 400 (0, 1) · 500 (0, 0). 300 va ANTES que 200
     aunque su id sea mayor: si el desempate por contactos se perdiera, el id los daría al revés. */
  assert.deepEqual(pantalla(null).campanas.map((c) => c.campana), ['100', '300', '200', '400', '500']);
});

test('cada funnel suma sus campañas, «Sin funnel» las que no tienen, y el total suma TODAS', () => {
  const p = pantalla(null);
  assert.deepEqual([p.funnels.leadform.campanas, p.funnels.leadform.inversion], [2, 50]);
  assert.deepEqual([p.funnels.booking.campanas, p.funnels.booking.inversion], [1, 80]);
  assert.deepEqual([p.funnels.profile.campanas, p.funnels.profile.inversion], [0, 0]);
  // La desconocida (400) va con las no asignadas: no se puede asignar, pero sus contactos cuentan.
  assert.deepEqual([p.sinFunnel.campanas, p.sinFunnel.etapas[0]?.valor], [2, 6]);
  assert.deepEqual([p.total.campanas, p.total.inversion, p.total.etapas[0]?.valor], [5, 180, 17]);
  assert.deepEqual(p.cobertura, { conCampana: 17, sobre: 20 });
  // Cada fila de campaña lleva las etapas de SU funnel: la de Booking tiene el formulario.
  assert.equal(p.campanas.find((c) => c.campana === '100')?.cifras.etapas.length, 4);
  assert.equal(p.campanas.find((c) => c.campana === '200')?.cifras.etapas.length, 3);
});

test('sin ventana anterior nada compara; con ella, una campaña que no aparece tuvo cero', () => {
  const sin = pantalla(null);
  assert.equal(sin.total.etapas[0]?.variacion.tipo, 'sin_comparacion');
  assert.equal(sin.sinComparacion, 'periodo');

  const con = pantalla(new Map([['300', cifras({ inversion: 25, contactos: 10 })]]));
  // 300 bajó de 10 a 9 contactos; 100 no estaba, así que su anterior es cero y no compara.
  const de = (c: string) => con.campanas.find((x) => x.campana === c)?.cifras.etapas[0]?.variacion;
  assert.deepEqual(de('300'), { tipo: 'baja', porcentaje: 0.1, lectura: 'mala' });
  assert.deepEqual(de('100'), { tipo: 'sin_comparacion' });
  // El total compara contra la suma de la anterior: de 10 a 17.
  assert.deepEqual(con.total.etapas[0]?.variacion, { tipo: 'sube', porcentaje: 0.7, lectura: 'buena' });
});

// ─── 4 · La inversión de la cuenta y la inversión con contactos (A14-19, `076`) ──

/** La pantalla de 7 días con una campaña de leads y una de mensajes, que nunca trajo contactos atribuidos. */
function conMensajes(gasto?: { deLaCuenta: number | null; deLaCuentaAnterior: number | null; motivo: null }, previa: Map<string, Cifras> | null = null) {
  return armarEmbudos({
    ventana: VENTANA,
    anterior: previa === null ? null : { desde: '2026-09-17', hasta: '2026-09-23' },
    sinComparacion: previa === null ? 'periodo' : null,
    campanas: [
      { campana: '10', nombre: 'leads', estado: 'PAUSED', conocida: true, conContactos: true, funnel: 'leadform' },
      { campana: '20', nombre: 'mensajes', estado: 'ACTIVE', conocida: true, conContactos: false, funnel: null },
    ],
    actual: new Map([
      ['10', cifras({ inversion: 100, contactos: 10, agendados: 4, calificados: 2 })],
      ['20', cifras({ inversion: 200.19, inversionConContactos: 0, clics: 30, inversionConDesglose: 200.19 })],
    ]),
    previa,
    cobertura: { conCampana: 10, sobre: 12 },
    sinCostos: null,
    gasto,
  });
}

test('una campaña sin contactos atribuidos suma inversión y NO paga el costo por contacto de las demás', () => {
  /* La de mensajes: sus contactos llegan sin `campaignId`. Con la inversión entera en el numerador, el costo por
     contacto del total pasaría de 10 a 30. Mutación: los costos de personas con `inversion`. */
  const p = conMensajes();
  const total = p.total;
  assert.equal(total.inversion, 300.19);
  assert.equal(total.conGasto, 2);
  assert.equal(total.inversionSinContactos, 200.19);
  assert.equal(total.etapas.find((e) => e.etapa === 'contactos')?.costo, 10, 'el costo por contacto lo pagó la campaña de mensajes');
  assert.equal(total.calificados.costo, 50);
  // El costo por clic sigue siendo de Meta: todo el gasto con desglose sobre todos los clics.
  assert.equal(total.etapas.find((e) => e.etapa === 'clics')?.costo, 200.19 / 30);
  // Y la campaña de mensajes no tiene costos de personas: no se sabe cuánta gente trajo.
  const mensajes = p.campanas.find((c) => c.campana === '20')!;
  assert.equal(mensajes.conContactos, false);
  assert.equal(mensajes.cifras.etapas.find((e) => e.etapa === 'contactos')?.costo, null);
  assert.equal(mensajes.cifras.inversionSinContactos, 200.19);
});

test('la inversión del TOTAL es la de la cuenta cuando la serie cubre la ventana', () => {
  /* El Administrador de anuncios dice 2.234,55 aunque el relleno no haya encontrado todavía todas las campañas.
     Mutación: el total con la suma por campaña. */
  const p = conMensajes({ deLaCuenta: 2234.55, deLaCuentaAnterior: null, motivo: null });
  assert.equal(p.total.inversion, 2234.55);
  assert.equal(p.total.inversionSinContactos, 2134.55, 'lo que la cuenta cobró sin campaña leída no paga costos de personas');
  assert.equal(p.total.etapas.find((e) => e.etapa === 'contactos')?.costo, 10, 'la diferencia de la cuenta entró en el costo por contacto');
  assert.deepEqual(p.gasto, { deLaCuenta: 2234.55, motivo: null });
  // Sin la serie, el total es la suma de las campañas.
  assert.equal(conMensajes({ deLaCuenta: null, deLaCuentaAnterior: null, motivo: null }).total.inversion, 300.19);
});

test('la flecha de la Inversión del total compara la cuenta contra la cuenta', () => {
  // Mutación: comparar la cuenta de ahora contra la suma por campaña de antes.
  const previa = new Map([['10', cifras({ inversion: 100, contactos: 10 })]]);
  const p = conMensajes({ deLaCuenta: 300, deLaCuentaAnterior: 200, motivo: null }, previa);
  assert.deepEqual(p.total.variacionDeInversion, { tipo: 'sube', porcentaje: 0.5, lectura: 'neutra' });
});

test('dos campañas empatadas en inversión y contactos van por identificador, no por cómo llegan', () => {
  /* Con la pauta parada, los empates en 0/0 son lo común, y la lectura de la base no trae orden: sin
     este desempate, las filas cambiarían de lugar entre una lectura y la siguiente. */
  const armar = (orden: string[]) =>
    armarEmbudos({
      ventana: VENTANA,
      anterior: null,
      sinComparacion: 'periodo',
      campanas: orden.map((campana) => ({ campana, nombre: null, estado: null, conocida: true, conContactos: true, funnel: null })),
      actual: new Map(),
      previa: null,
      cobertura: { conCampana: 0, sobre: 0 },
      sinCostos: null,
    }).campanas.map((c) => c.campana);
  assert.deepEqual(armar(['900', '700', '800']), ['700', '800', '900']);
  assert.deepEqual(armar(['700', '900', '800']), ['700', '800', '900']);
});

test('la ruta le pasa al cálculo la zona de la EMPRESA que se está mirando', () => {
  /* El día de gasto cierra a la medianoche de la empresa. Con la zona de otro lado —o `UTC` fija—, una
     empresa en Lima daría ayer por cerrado cinco horas antes de que termine. La prueba de base no lo
     puede ver de forma estable: depende de la hora a la que corre. */
  const ruta = archivosFuente(['app']).find((a) => a.ruta === 'app/api/acquisition/route.ts');
  assert.ok(ruta, 'no se encontró la ruta de Acquisition');
  assert.match(
    ruta.limpio,
    /embudosDeAcquisition\(periodo,\s*contexto\.organizacion\.zonaHoraria\)/,
    'la ruta no le pasa al cálculo la zona de la empresa',
  );
});
