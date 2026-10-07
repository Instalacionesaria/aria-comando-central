// Qué pide el colector de anuncios, qué da por completo, y qué hace cuando una campaña se pudre. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA FUGA QUE ESTE ARCHIVO EXISTE PARA QUE NO VUELVA (`076`)
//
// El 2026-10-07 la app decía 0 de inversión en 7 días y el Administrador de anuncios de la misma cuenta
// 200,19. El colector pedía sólo las campañas de nuestra atribución (13 de 61), una campaña de mensajes no
// podía entrar nunca, y «completo» quería decir «el día tiene filas»: las filas nulas de las pausadas tapaban
// a la única que gastó. Ninguna prueba lo vio porque todas inyectaban la lista de campañas.
//
// Ahora se prueba lo que decide: el universo (la cuenta, no la atribución), la referencia (un día está completo
// cuando cuadra con la cuenta), lo pendiente por (campaña, día) y no por empresa, y que un fallo nunca se
// guarde como un cero. Cada prueba nombra la mutación que la pone en rojo.
//
// Y siguen las de antes que todavía valen: una campaña que devuelve 500 no aborta la pasada, se reintenta una
// vez, y lo que falla dos veces queda anotado.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIAS_DE_LA_SERIE_QUE_SE_RELEEN,
  DIAS_DE_RELLENO,
  DIAS_QUE_SE_RELEEN,
  PRESUPUESTO_MS,
  recolectarAnuncios,
  type PlanDelDia,
} from '../../lib/negocio/recolectarAnuncios.ts';
import { FIN_DEL_RELLENO_MS, rellenarAnuncios, type FotoDelRelleno } from '../../lib/negocio/rellenarAnuncios.ts';
import {
  consultasIniciales,
  cuadra,
  estadoDelDia,
  finSeguro,
  lecturaFinal,
  ordenar,
  paresDelTramoFijo,
  partirRango,
  sumarDias,
  TOLERANCIA_DEL_CUADRE,
  type Consulta,
  type DiaDeLaSerie,
  type LecturaDeGasto,
} from '../../lib/negocio/gastoDeLaCuenta.ts';
import type { MetricaDeAnuncio } from '../../lib/ghl/anuncios.ts';

/** Un instante fijo, para que la suite dé lo mismo en las tres zonas. */
const AHORA = Date.parse('2026-10-07T06:17:00Z');
const HOY = '2026-10-07';
/** El acceso no se usa: el proveedor se reemplaza en todas. */
const ACCESO = { token: 'no-se-usa', locationId: 'no-se-usa' };
/* Un uuid cualquiera, y tiene que SER un uuid: los escritores corren dentro de `conOrganizacion`, que valida la
   forma antes de abrir contexto. No se conecta a nada porque todos los escritores están inyectados. */
const ORG = '00000000-0000-4000-8000-000000000000';

const VINCULO_OK = async () => ({
  tipo: 'datos' as const,
  datos: { estado: 'connected', cuentaId: 'act_1349863156073553', paginas: 1 },
});
const SIN_CAMPANAS = async () => ({ tipo: 'datos' as const, datos: [], corto: false, paginas: 1 });
const SERIE_VACIA = async () => ({ tipo: 'datos' as const, datos: [], llamadas: 1 });
const FALLA = { tipo: 'fallo' as const, fallo: { tipo: 'rechazado' as const, estado: 500, codigo: 'sin_codigo' } };

/** Un plan de la pasada diaria: las candidatas son las activas más las que gastaron hace poco. */
function plan(activas: string[], conGastoReciente: string[] = [], inicio: string | null = '2026-08-18'): PlanDelDia {
  return { inicio, activas, conGastoReciente };
}

/** Las piezas de una pasada diaria sin red ni base. Cada prueba pisa lo que mira. */
function piezas(extra: Parameters<typeof recolectarAnuncios>[2] = {}): Parameters<typeof recolectarAnuncios>[2] {
  return {
    ahora: AHORA,
    reloj: () => 0,
    vinculo: VINCULO_OK,
    listarCampanas: SIN_CAMPANAS,
    serie: SERIE_VACIA,
    escribirSerie: async () => {},
    pedir: async () => ({ tipo: 'datos', datos: [] }),
    escribir: async () => {},
    plan: plan([]),
    ...extra,
  };
}

/** Una métrica cualquiera, con el `adId` y el gasto que se pidan. */
function metrica(anuncioId: string, gasto: number | null = 12.5): MetricaDeAnuncio {
  return {
    anuncioId,
    adSetId: '120249633901560467',
    campanaId: '120249633901590467',
    nombre: 'un anuncio',
    objetivo: 'OUTCOME_LEADS',
    gasto,
    impresiones: 100,
    clics: 3,
    ctr: 3,
    cpc: 4.16,
    alcance: 90,
    frecuencia: 1.11,
    leadsDelCrm: 1,
    acciones: { videoView: 40, linkClick: 2 },
  };
}

// ─── Las fotos del gasto, para las decisiones puras y el relleno ──────────────

/** Una lectura final: leída mucho después del día. */
const LEIDA = Date.parse('2026-10-07T06:17:00Z');
const lectura = (gasto: number, leidoEl = LEIDA, porRango = false): LecturaDeGasto => ({ gasto, leidoEl, porRango });
const diaDeLaSerie = (gasto: number | null, extra: Partial<DiaDeLaSerie> = {}): DiaDeLaSerie => ({
  gasto,
  leidoEl: LEIDA,
  cambioEl: null,
  redescubiertoEl: null,
  residuoEl: null,
  ...extra,
});

/**
 * Una foto: la serie de la cuenta por día, el detalle por anuncio por día, y las lecturas por campaña.
 * `lecturas` va como `{ campaña: { día: lectura } }` para que cada prueba se lea de un vistazo.
 */
function foto(
  universo: string[],
  serie: Record<string, DiaDeLaSerie>,
  detalle: Record<string, number>,
  lecturas: Record<string, Record<string, LecturaDeGasto>> = {},
): FotoDelRelleno {
  const dias = Object.keys(serie).sort();
  return {
    inicio: dias[0] ?? null,
    universo,
    serie: new Map(Object.entries(serie)),
    detalle: new Map(Object.entries(detalle)),
    lecturas: new Map(Object.entries(lecturas).map(([c, m]) => [c, new Map(Object.entries(m))])),
  };
}

// ─── 1 · Qué cuadra y qué es final ───────────────────────────────────────────

test('un día cuadra con la diferencia JUSTO en la tolerancia, y no un centavo más', () => {
  // Mutación: `<` en lugar de `<=`, o la tolerancia en dólares comparada contra centavos.
  assert.equal(cuadra(200.19, 200.19 - TOLERANCIA_DEL_CUADRE), true);
  assert.equal(cuadra(200.19, 200.19 + TOLERANCIA_DEL_CUADRE), true, 'el detalle por encima también cuadra');
  assert.equal(cuadra(200.19, 200.19 - TOLERANCIA_DEL_CUADRE - 0.01), false);
  // El caso que motivó todo: la cuenta gastó y el detalle de las campañas pedidas dio cero.
  assert.equal(cuadra(200.19, 0), false, 'la cuenta dice 200,19 y por campaña se leyó cero: eso no cuadra');
  assert.equal(cuadra(null, 0), false, 'sin total de la cuenta no hay contra qué cuadrar');
});

test('una lectura es final desde las 00:00 UTC de dos días después, y no antes', () => {
  // El día de la cuenta termina, en el peor huso, a esa hora. Mutación: `+ 1` día en `finSeguro`.
  const dia = '2026-10-01';
  assert.equal(finSeguro(dia), Date.parse('2026-10-03T00:00:00Z'));
  assert.equal(lecturaFinal(lectura(5, Date.parse('2026-10-02T23:59:00Z')), dia, undefined), false);
  assert.equal(lecturaFinal(lectura(5, Date.parse('2026-10-03T00:00:00Z')), dia, undefined), true);
});

test('una corrección de Meta vuelve a pedir lo que GASTÓ, y deja los ceros', () => {
  // Mutación: ignorar `cambio_el`, o volver a pedir también los ceros (cientos de llamadas por corrección).
  const dia = '2026-10-01';
  const serie = diaDeLaSerie(100, { cambioEl: Date.parse('2026-10-06T06:17:00Z') });
  assert.equal(lecturaFinal(lectura(40, Date.parse('2026-10-05T06:17:00Z')), dia, serie), false);
  assert.equal(lecturaFinal(lectura(40, Date.parse('2026-10-06T07:00:00Z')), dia, serie), true);
  assert.equal(lecturaFinal(lectura(0, Date.parse('2026-10-05T06:17:00Z')), dia, serie), true);
});

test('un día que cuadra prueba el cero de las campañas que no se leyeron, sin llamar', () => {
  /* La cuenta dice 50 y la única campaña leída dio 50: las otras sesenta no gastaron, y no hace falta
     preguntarles. Mutación: pedir las campañas no leídas de un día que cuadra. */
  const f = foto(['a', 'b', 'c'], { '2026-10-01': diaDeLaSerie(50) }, { '2026-10-01': 50 }, { a: { '2026-10-01': lectura(50) } });
  assert.equal(estadoDelDia(f, '2026-10-01'), 'cuadra');
  assert.deepEqual(consultasIniciales(f, []), []);
});

test('los estados de un día que no cuadra', () => {
  const dia = '2026-10-01';
  const todas = { a: { [dia]: lectura(30) }, b: { [dia]: lectura(0, LEIDA, true) } };
  // Sin total, o con un total leído antes de que el día terminara.
  assert.equal(estadoDelDia(foto(['a'], {}, {}), dia), 'sin_serie');
  assert.equal(
    estadoDelDia(foto(['a'], { [dia]: diaDeLaSerie(50, { leidoEl: Date.parse('2026-10-02T06:17:00Z') }) }, {}), dia),
    'sin_serie',
  );
  // A alguna campaña le falta su lectura.
  assert.equal(estadoDelDia(foto(['a', 'b'], { [dia]: diaDeLaSerie(50) }, { [dia]: 30 }, { a: todas.a }), dia), 'pendiente');
  // Todas leídas y no cuadra: primero se redescubre, después es residuo, y el declarado se queda.
  assert.equal(estadoDelDia(foto(['a', 'b'], { [dia]: diaDeLaSerie(50) }, { [dia]: 30 }, todas), dia), 'por_redescubrir');
  assert.equal(
    estadoDelDia(foto(['a', 'b'], { [dia]: diaDeLaSerie(50, { redescubiertoEl: LEIDA }) }, { [dia]: 30 }, todas), dia),
    'nuevo_residuo',
  );
  assert.equal(
    estadoDelDia(foto(['a', 'b'], { [dia]: diaDeLaSerie(50, { residuoEl: LEIDA }) }, { [dia]: 30 }, todas), dia),
    'residuo',
  );
});

// ─── 2 · Qué consultas hacen falta ───────────────────────────────────────────

test('una campaña que entra TARDE pide todos sus días pendientes, no sólo los tres fijos', () => {
  /* El defecto viejo: los días «ya guardados» se contaban por empresa, así que una campaña nueva en una cuenta
     con filas de otras sólo recibía hoy y los dos anteriores. Acá la campaña `nueva` no tiene ninguna lectura
     en treinta días que no cuadran: su rango tiene que cubrirlos todos.
     Mutación: volver al conjunto de días por organización (un día con lecturas de otra campaña se da por leído). */
  const dias = Array.from({ length: 30 }, (_, i) => sumarDias('2026-09-05', i));
  const serie = Object.fromEntries(dias.map((d) => [d, diaDeLaSerie(80)]));
  const detalle = Object.fromEntries(dias.map((d) => [d, 30]));
  const vieja = { vieja: Object.fromEntries(dias.map((d) => [d, lectura(30)])) };
  const cola = consultasIniciales(foto(['vieja', 'nueva'], serie, detalle, vieja), dias);
  assert.deepEqual(cola, [{ tipo: 'rango', campana: 'nueva', desde: dias[0], hasta: dias[29], dias, conocido: 0 }]);
});

test('una lectura vieja que GASTÓ se pide por día; una sin gasto entra en el rango', () => {
  const d = '2026-10-01';
  const vieja = Date.parse('2026-10-01T06:17:00Z'); // leída antes de que el día terminara
  const f = foto(['a', 'b'], { [d]: diaDeLaSerie(80) }, { [d]: 30 }, { a: { [d]: lectura(30, vieja) }, b: { [d]: lectura(0, vieja) } });
  assert.deepEqual(consultasIniciales(f, [d]), [
    { tipo: 'dia', campana: 'a', dia: d },
    { tipo: 'rango', campana: 'b', desde: d, hasta: d, dias: [d], conocido: 0 },
  ]);
});

test('un rango que no gastó deja CEROS en sus días sin leer; descuenta lo ya leído', () => {
  // Mutación: comparar el total sin restar lo conocido (un día ya leído con gasto haría partir el rango).
  const f = foto(['a'], {}, {});
  const c = { tipo: 'rango' as const, campana: 'a', desde: '2026-09-01', hasta: '2026-09-30', dias: ['2026-09-02', '2026-09-20'], conocido: 75.4 };
  assert.deepEqual(partirRango(f, c, 75.4), { ceros: ['2026-09-02', '2026-09-20'] });
  assert.deepEqual(partirRango(f, c, 75.4 + TOLERANCIA_DEL_CUADRE), { ceros: ['2026-09-02', '2026-09-20'] });
  assert.ok('siguientes' in partirRango(f, c, 75.4 + TOLERANCIA_DEL_CUADRE + 0.01), 'gastó más de lo conocido: hay que bajar');
});

test('un rango que gastó se parte en SEMANAS desde el final, y una semana en días', () => {
  /* Mutación: partir en mitades, o desde el principio (lo más nuevo quedaría para el final), o pedir días de
     una semana sin días pendientes. */
  const f = foto(['a'], {}, {});
  const dias = ['2026-09-01', '2026-09-10', '2026-09-29'];
  const largo = partirRango(f, { tipo: 'rango', campana: 'a', desde: '2026-09-01', hasta: '2026-09-30', dias, conocido: 0 }, 20);
  assert.ok('siguientes' in largo);
  assert.deepEqual(
    largo.siguientes.map((c) => (c.tipo === 'rango' ? `${c.desde}..${c.hasta}:${c.dias.join(',')}` : c.dia)),
    ['2026-09-24..2026-09-30:2026-09-29', '2026-09-10..2026-09-16:2026-09-10', '2026-09-01..2026-09-02:2026-09-01'],
  );
  const semana = partirRango(f, { tipo: 'rango', campana: 'a', desde: '2026-09-24', hasta: '2026-09-30', dias: ['2026-09-25', '2026-09-29'], conocido: 0 }, 20);
  assert.deepEqual(semana, {
    siguientes: [
      { tipo: 'dia', campana: 'a', dia: '2026-09-29' },
      { tipo: 'dia', campana: 'a', dia: '2026-09-25' },
    ],
  });
});

test('la cola va de lo más NUEVO a lo más viejo, y en el mismo final, lo más largo primero', () => {
  // Mutación: invertir el orden. «7 días» se completaría después que agosto.
  const cola: Consulta[] = [
    { tipo: 'dia', campana: 'a', dia: '2026-09-01' },
    { tipo: 'dia', campana: 'b', dia: '2026-10-05' },
    { tipo: 'rango', campana: 'c', desde: '2026-09-01', hasta: '2026-10-05', dias: [], conocido: 0 },
  ];
  assert.deepEqual(
    ordenar(cola).map((c) => c.campana),
    ['c', 'b', 'a'],
  );
});

test('el tramo fijo: hoy primero, los tres días, y sólo las candidatas', () => {
  // Mutación: del más viejo al más nuevo (anteayer lo cubre también el relleno; hoy, sólo esta pasada).
  assert.deepEqual(paresDelTramoFijo(HOY, ['x', 'y']), [
    { campana: 'x', dia: '2026-10-07' },
    { campana: 'y', dia: '2026-10-07' },
    { campana: 'x', dia: '2026-10-06' },
    { campana: 'y', dia: '2026-10-06' },
    { campana: 'x', dia: '2026-10-05' },
    { campana: 'y', dia: '2026-10-05' },
  ]);
  assert.equal(DIAS_QUE_SE_RELEEN, 2);
});

test('el tramo fijo ENTRA en el presupuesto con las campañas activas de régimen', () => {
  /* La cuenta: el vínculo, una página de campañas y tres llamadas de la serie (sesenta días en tramos de
     veinte) son 5; más tres por candidata. A 4,55 s por llamada —medido el 2026-09-16—, siete candidatas
     caben en 118 s. La cuenta tiene entre una y tres activas. Si no entrara, `atrasado` quedaría encendido
     siempre, y un aviso que aparece siempre es uno que nadie lee. */
  const FIJAS = 5;
  const MS_POR_LLAMADA = 4550;
  assert.equal(Math.ceil(DIAS_DE_LA_SERIE_QUE_SE_RELEEN / 20), 3);
  assert.ok((FIJAS + 3 * 7) * MS_POR_LLAMADA <= PRESUPUESTO_MS, 'siete candidatas ya no entran en el presupuesto');
});

// ─── 3 · La pasada diaria ────────────────────────────────────────────────────

test('se piden las campañas ACTIVE y las que gastaron hace poco, aunque no traigan contactos', async () => {
  /* La campaña de mensajes no tenía anuncios guardados ni contactos con su `campaignId`: con la atribución
     como universo no se pedía nunca. Mutación: volver a armar las candidatas desde la atribución, o sacar
     las que gastaron hace poco (una pausada ayer gastó ayer). */
  const pedidas = new Set<string>();
  const r = await recolectarAnuncios(
    ORG,
    ACCESO,
    piezas({
      plan: plan(['mensajes'], ['pausada-ayer']),
      pedir: async (_a, campana) => {
        pedidas.add(campana);
        return { tipo: 'datos', datos: [] };
      },
    }),
  );
  assert.deepEqual([...pedidas].sort(), ['mensajes', 'pausada-ayer']);
  assert.equal(r.resultado.campanas, 2);
  assert.equal(r.resultado.desde, '2026-10-05');
  assert.equal(r.resultado.hasta, HOY);
});

test('sin Meta vinculado no se pide ni se escribe NADA', async () => {
  /* Sin vínculo el proveedor devuelve vacío sin fallar, y con los ceros probados un vacío guardado sería
     permanente. Mutación: sacar la compuerta. */
  let despues = 0;
  const r = await recolectarAnuncios(
    ORG,
    ACCESO,
    piezas({
      vinculo: async () => ({ tipo: 'datos' as const, datos: { estado: 'disconnected', cuentaId: null, paginas: 0 } }),
      listarCampanas: async () => {
        despues += 1;
        return { tipo: 'datos', datos: [], corto: false, paginas: 1 };
      },
      serie: async () => {
        despues += 1;
        return { tipo: 'datos', datos: [], llamadas: 1 };
      },
      plan: plan(['a']),
      pedir: async () => {
        despues += 1;
        return { tipo: 'datos', datos: [] };
      },
    }),
  );
  assert.equal(despues, 0, 'se llamó al proveedor sin vínculo');
  assert.equal(r.resultado.vinculo?.estado, 'disconnected');
  assert.equal(r.resultado.llamadas, 1);
});

test('si no se puede preguntar por el vínculo, la tarea FALLA', async () => {
  // Es el token o el proveedor: devolver éxito dejaría el sello en verde sobre una pasada que no hizo nada.
  await assert.rejects(() => recolectarAnuncios(ORG, ACCESO, piezas({ vinculo: async () => FALLA })), /vínculo con Meta/);
});

test('la serie de la cuenta se pide desde el primer día guardado, y como mucho sesenta días', async () => {
  // Mutación: pedir sólo los últimos días (las correcciones de Meta no se verían), o desde el principio siempre.
  const pedidas: string[] = [];
  const serie = async (_a: unknown, desde: string, hasta: string) => {
    pedidas.push(`${desde}..${hasta}`);
    return { tipo: 'datos' as const, datos: [], llamadas: 3 };
  };
  await recolectarAnuncios(ORG, ACCESO, piezas({ serie, plan: plan([], [], '2026-08-18') }));
  await recolectarAnuncios(ORG, ACCESO, piezas({ serie, plan: plan([], [], '2026-01-01') }));
  await recolectarAnuncios(ORG, ACCESO, piezas({ serie, plan: plan([], [], null) }));
  assert.deepEqual(pedidas, [
    `2026-08-18..${HOY}`,
    `${sumarDias(HOY, -(DIAS_DE_LA_SERIE_QUE_SE_RELEEN - 1))}..${HOY}`,
    `${sumarDias(HOY, -(DIAS_DE_RELLENO - 1))}..${HOY}`,
  ]);
});

test('una serie que falla se anota y la pasada sigue con las campañas', async () => {
  let escrita = false;
  const r = await recolectarAnuncios(
    ORG,
    ACCESO,
    piezas({
      serie: async () => ({ ...FALLA, llamadas: 1 }),
      escribirSerie: async () => {
        escrita = true;
      },
      plan: plan(['a']),
    }),
  );
  assert.equal(escrita, false, 'se escribió una serie que no llegó');
  assert.deepEqual(r.resultado.cuenta, { tipo: 'fallo', porque: 'rechazado' });
  assert.equal(r.corrio, true);
});

test('una lectura que FALLA nunca se escribe; una que vuelve vacía, sí (es un cero leído)', async () => {
  /* Mutación: tratar el fallo como una lectura vacía. El escritor guarda el par, y un par con cero es un cero
     probado: el relleno daría por leída una campaña que nadie pudo leer. */
  const escritas: string[] = [];
  await recolectarAnuncios(
    ORG,
    ACCESO,
    piezas({
      plan: plan(['rota', 'vacia']),
      pedir: async (_a, campana) => (campana === 'rota' ? FALLA : { tipo: 'datos', datos: [] }),
      escribir: async (campana, dia) => {
        escritas.push(`${campana}|${dia}`);
      },
    }),
  );
  assert.ok(escritas.every((e) => e.startsWith('vacia|')), `se escribió una lectura que falló: ${escritas.join(', ')}`);
  assert.equal(escritas.length, DIAS_QUE_SE_RELEEN + 1, 'la lectura vacía no se escribió: la campaña quedaría pendiente');
});

test('una campaña que devuelve 500 NO aborta la pasada, y se informa UNA vez', async () => {
  const pedidas: string[] = [];
  const r = await recolectarAnuncios(
    ORG,
    ACCESO,
    piezas({
      plan: plan(['podrida', 'buena']),
      pedir: async (_a, campana) => {
        pedidas.push(campana);
        return campana === 'podrida' ? FALLA : { tipo: 'datos', datos: [] };
      },
    }),
  );
  assert.deepEqual(r.resultado.fallidas, [{ campana: 'podrida', porque: 'rechazado' }]);
  assert.equal(pedidas.filter((c) => c === 'buena').length, DIAS_QUE_SE_RELEEN + 1);
});

test('si no anda NADA —ni la serie ni ningún par—, la tarea LANZA', async () => {
  await assert.rejects(
    () =>
      recolectarAnuncios(ORG, ACCESO, piezas({ serie: async () => ({ ...FALLA, llamadas: 1 }), plan: plan(['a', 'b']), pedir: async () => FALLA })),
    /no devolvió la serie de la cuenta ni ninguna de las 2 campañas/,
  );
});

test('con la serie leída, que fallen todos los pares no tumba la tarea: quedan huecos', async () => {
  // La serie es lo que dice si falta gasto; lo que no se pudo leer lo busca el relleno.
  const r = await recolectarAnuncios(ORG, ACCESO, piezas({ plan: plan(['a']), pedir: async () => FALLA }));
  assert.equal(r.resultado.huecos.length, DIAS_QUE_SE_RELEEN + 1);
});

test('la pasada CORTA entre pares cuando se le acaba el tiempo, y lo DICE', async () => {
  /* El guardia va antes de CADA llamada: la pasada vieja lo miraba entre días, porque un día a medias se daba
     por completo. Ahora lo pendiente se lleva por par. Mutación: volver al control entre días (la prueba
     cuenta las llamadas: con el control por día se completaría el día en curso). */
  let t = 0;
  let pedidas = 0;
  const candidatas = Array.from({ length: 13 }, (_, i) => `c${i}`);
  const r = await recolectarAnuncios(
    ORG,
    ACCESO,
    piezas({
      plan: plan(candidatas),
      reloj: () => t,
      pedir: async () => {
        pedidas += 1;
        t += 5_000;
        return { tipo: 'datos', datos: [] };
      },
    }),
  );
  assert.equal(r.resultado.atrasado, true, 'se pasó del presupuesto y no lo dijo');
  assert.equal(pedidas, PRESUPUESTO_MS / 5_000 + 1, 'el corte no fue en el primer par pasado el presupuesto');
});

test('una pasada que ENTRA en el presupuesto no se declara atrasada', async () => {
  const r = await recolectarAnuncios(ORG, ACCESO, piezas({ plan: plan(['a']) }));
  assert.equal(r.resultado.atrasado, false);
  assert.deepEqual(r.resultado.huecos, []);
});

test('un par que falla se REINTENTA una vez; lo que falla dos veces queda como hueco', async () => {
  const vistas = new Map<string, number>();
  const r = await recolectarAnuncios(
    ORG,
    ACCESO,
    piezas({
      plan: plan(['transitoria', 'podrida']),
      pedir: async (_a, campana, dia) => {
        const clave = `${campana}|${dia}`;
        const veces = (vistas.get(clave) ?? 0) + 1;
        vistas.set(clave, veces);
        if (campana === 'podrida') return FALLA;
        return dia === '2026-10-06' && veces === 1 ? FALLA : { tipo: 'datos', datos: [] };
      },
    }),
  );
  assert.equal(vistas.get('transitoria|2026-10-06'), 2, 'el par que falló no se reintentó');
  assert.equal(vistas.get('transitoria|2026-10-07'), 1, 'se reintentó un par que NO había fallado');
  assert.ok(r.resultado.huecos.every((h) => h.campana === 'podrida'));
  assert.equal(r.resultado.huecos.length, DIAS_QUE_SE_RELEEN + 1);
  assert.deepEqual(r.resultado.fallidas, [{ campana: 'podrida', porque: 'rechazado' }], 'la que se recuperó sigue acusada');
});

test('un reintento que no entra en el presupuesto NO enciende `atrasado`', async () => {
  // `atrasado` es «quedaron pares sin pedir»; un reintento que no entra es un hueco con nombre y fecha.
  let t = 0;
  let pedidas = 0;
  const r = await recolectarAnuncios(
    ORG,
    ACCESO,
    piezas({
      plan: plan(['podrida', 'buena']),
      reloj: () => t,
      pedir: async (_a, campana) => {
        pedidas += 1;
        if (pedidas === (DIAS_QUE_SE_RELEEN + 1) * 2) t = PRESUPUESTO_MS + 1;
        return campana === 'podrida' ? FALLA : { tipo: 'datos', datos: [] };
      },
    }),
  );
  assert.equal(r.resultado.atrasado, false);
  assert.equal(r.resultado.huecos.length, DIAS_QUE_SE_RELEEN + 1);
});

test('el resumen cuenta ANUNCIOS DISTINTOS, no filas', async () => {
  const r = await recolectarAnuncios(
    ORG,
    ACCESO,
    piezas({ plan: plan(['a']), pedir: async () => ({ tipo: 'datos', datos: [metrica('120249633901580467')] }) }),
  );
  assert.equal(r.resultado.anuncios, 1);
  assert.equal(r.resultado.metricas, DIAS_QUE_SE_RELEEN + 1);
});

test('el resumen cuenta las filas que el proveedor mandó y no se pudieron leer', async () => {
  const r = await recolectarAnuncios(ORG, ACCESO, piezas({ plan: plan(['a']), pedir: async () => ({ tipo: 'datos', datos: [], ilegibles: 3 }) }));
  assert.equal(r.resultado.ilegibles, 3 * (DIAS_QUE_SE_RELEEN + 1));
});

// ─── 4 · Las campañas de la cuenta (`065`), al principio ─────────────────────

const DOS_CAMPANAS = [
  { id: '120249633901590467', nombre: 'bofu - agendamiento', estado: 'ACTIVE', cuentaId: 'act_1349863156073553' },
  { id: '120249254209020467', nombre: null, estado: 'PAUSED', cuentaId: 'act_1349863156073553' },
];

test('las campañas se leen y se escriben ANTES de pedir nada más: son el universo', async () => {
  // Mutación: leerlas al final (una campaña nueva no entraría en las candidatas de su primer día).
  const orden: string[] = [];
  const r = await recolectarAnuncios(
    ORG,
    ACCESO,
    piezas({
      listarCampanas: async () => {
        orden.push('campanas');
        return { tipo: 'datos', datos: DOS_CAMPANAS, corto: false, paginas: 1 };
      },
      escribirCampanas: async () => {
        orden.push('escritas');
      },
      serie: async () => {
        orden.push('serie');
        return { tipo: 'datos', datos: [], llamadas: 3 };
      },
      plan: plan(['a']),
      pedir: async () => {
        orden.push('par');
        return { tipo: 'datos', datos: [] };
      },
    }),
  );
  assert.deepEqual(orden.slice(0, 3), ['campanas', 'escritas', 'serie']);
  assert.deepEqual(r.resultado.nombres, { tipo: 'leidas', campanas: 2, corto: false });
  // El vínculo, una página, tres de la serie y los tres días de la candidata.
  assert.equal(r.resultado.llamadas, 1 + 1 + 3 + (DIAS_QUE_SE_RELEEN + 1));
});

test('una lista de campañas vacía no llama al escritor; una recortada lo dice', async () => {
  let escritas = 0;
  const vacia = await recolectarAnuncios(ORG, ACCESO, piezas({ escribirCampanas: async () => void (escritas += 1) }));
  assert.equal(escritas, 0);
  assert.deepEqual(vacia.resultado.nombres, { tipo: 'leidas', campanas: 0, corto: false });
  const recortada = await recolectarAnuncios(
    ORG,
    ACCESO,
    piezas({ listarCampanas: async () => ({ tipo: 'datos', datos: DOS_CAMPANAS, corto: true, paginas: 20 }), escribirCampanas: async () => {} }),
  );
  assert.deepEqual(recortada.resultado.nombres, { tipo: 'leidas', campanas: 2, corto: true });
});

test('si las campañas FALLAN, la pasada sigue y cuenta las páginas pedidas', async () => {
  const r = await recolectarAnuncios(
    ORG,
    ACCESO,
    piezas({
      listarCampanas: async () => ({ ...FALLA, paginas: 3 }),
      escribirCampanas: async () => {
        throw new Error('no se escribe lo que no llegó');
      },
      plan: plan(['a']),
    }),
  );
  assert.deepEqual(r.resultado.nombres, { tipo: 'fallo', porque: 'rechazado' });
  assert.equal(r.resultado.llamadas, 1 + 3 + 1 + (DIAS_QUE_SE_RELEEN + 1));
});

test('un fallo al ESCRIBIR las campañas NO se atrapa: es un defecto nuestro', async () => {
  await assert.rejects(
    () =>
      recolectarAnuncios(
        ORG,
        ACCESO,
        piezas({
          listarCampanas: async () => ({ tipo: 'datos', datos: DOS_CAMPANAS, corto: false, paginas: 1 }),
          escribirCampanas: async () => {
            throw new Error('la base rechazó la escritura de campañas');
          },
        }),
      ),
    /la base rechazó la escritura de campañas/,
  );
});

// ─── 5 · El relleno ──────────────────────────────────────────────────────────

/** Las piezas del relleno sin red ni base. Cuenta las llamadas al proveedor en `llamadas`. */
function piezasDelRelleno(f: FotoDelRelleno | (() => FotoDelRelleno), extra: Parameters<typeof rellenarAnuncios>[4] = {}) {
  const registro = { llamadas: [] as string[], ceros: [] as string[], escritas: [] as string[], redescubiertos: [] as string[], residuos: [] as string[] };
  const p: Parameters<typeof rellenarAnuncios>[4] = {
    ahora: AHORA,
    reloj: () => 0,
    foto: async () => (typeof f === 'function' ? f() : f),
    vinculo: async () => {
      registro.llamadas.push('vinculo');
      return VINCULO_OK();
    },
    serie: async (_a, desde, hasta) => {
      registro.llamadas.push(`serie ${desde}..${hasta}`);
      return { tipo: 'datos', datos: [], llamadas: 1 };
    },
    escribirSerie: async () => {},
    pedir: async (_a, campana, dia) => {
      registro.llamadas.push(`dia ${campana} ${dia}`);
      return { tipo: 'datos', datos: [] };
    },
    escribir: async (campana, dia) => {
      registro.escritas.push(`${campana} ${dia}`);
    },
    total: async (_a, campana, desde, hasta) => {
      registro.llamadas.push(`rango ${campana} ${desde}..${hasta}`);
      return { tipo: 'datos', datos: { gasto: 0, anuncios: 0 } };
    },
    escribirCeros: async (campana, dias) => {
      for (const d of dias) registro.ceros.push(`${campana} ${d}`);
    },
    redescubrir: async (d) => void registro.redescubiertos.push(d),
    declararResiduo: async (d) => void registro.residuos.push(d),
    ...extra,
  };
  return { p, registro };
}

/** Del `desde` al `hasta`, todos con la misma fila de la serie y el mismo detalle. */
function dias(desde: string, hasta: string): string[] {
  const salida: string[] = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) salida.push(d);
  return salida;
}

test('sin serie todavía, el relleno no hace NINGUNA llamada', async () => {
  // Una empresa sin Meta: preguntar por el vínculo cada hora serían 24 llamadas por día para nada.
  const { p, registro } = piezasDelRelleno(foto(['a'], {}, {}));
  const r = await rellenarAnuncios(ORG, ACCESO, 0, () => 0, p);
  assert.deepEqual(registro.llamadas, []);
  assert.equal(r.llamadas, 0);
});

test('con gasto del colector viejo y sin serie, el relleno pide la serie desde el primer día de métricas', async () => {
  /* La transición de la `076`: sin esto, desde el despliegue hasta la pasada de las 06:17 UTC Acquisition diría
     que el colector está atrasado. Mutación: tomar el primer día sólo de la serie. */
  const { p, registro } = piezasDelRelleno({ ...foto(['a'], {}, {}), inicio: '2026-09-20' });
  await rellenarAnuncios(ORG, ACCESO, 0, () => 0, p);
  assert.deepEqual(registro.llamadas, ['vinculo', 'serie 2026-09-20..2026-10-05']);
});

test('con todo cuadrado, el relleno no hace NINGUNA llamada', async () => {
  const todos = dias('2026-09-01', '2026-10-05');
  const f = foto(['a', 'b'], Object.fromEntries(todos.map((d) => [d, diaDeLaSerie(10)])), Object.fromEntries(todos.map((d) => [d, 10])));
  const { p, registro } = piezasDelRelleno(f);
  await rellenarAnuncios(ORG, ACCESO, 0, () => 0, p);
  assert.deepEqual(registro.llamadas, []);
});

for (const [hora, hoyUtc] of [
  ['23:53', '2026-10-07'],
  ['00:53', '2026-10-08'],
] as const) {
  test(`el relleno nunca pide un día más nuevo que hoy−2 en UTC (a las ${hora} UTC)`, async () => {
    /* Hasta las 00:00 UTC de dos días después el día de la cuenta puede no haber terminado en su huso, y un
       cero leído a medias sería un cero falso. Mutación: `hoy − 1`. */
    const instante = Date.parse(`${hoyUtc}T${hora}:00Z`);
    const todos = dias('2026-09-28', hoyUtc);
    const f = foto(['a'], Object.fromEntries(todos.map((d) => [d, diaDeLaSerie(10, { leidoEl: instante })])), {});
    const { p, registro } = piezasDelRelleno(f, { ahora: instante });
    await rellenarAnuncios(ORG, ACCESO, 0, () => 0, p);
    const tope = sumarDias(hoyUtc, -2);
    const pedidos = registro.llamadas.filter((l) => l.startsWith('rango')).map((l) => l.split('..')[1]!);
    assert.ok(pedidos.length > 0, 'el armado de la prueba no pidió nada');
    assert.ok(pedidos.every((h) => h <= tope), `se pidió hasta ${pedidos.join(', ')} con tope ${tope}`);
  });
}

test('un rango en cero deja ceros, y NUNCA se escribe como métrica diaria', async () => {
  // Mutación: llamar al escritor de métricas con el resultado de un rango.
  const todos = dias('2026-09-20', '2026-10-05');
  const f = foto(['a', 'b'], Object.fromEntries(todos.map((d) => [d, diaDeLaSerie(10)])), {}, {});
  const { p, registro } = piezasDelRelleno(f, {
    total: async (_a, campana, desde, hasta) => {
      registro.llamadas.push(`rango ${campana} ${desde}..${hasta}`);
      return { tipo: 'datos', datos: { gasto: campana === 'a' ? 0 : 160, anuncios: 2 } };
    },
  });
  await rellenarAnuncios(ORG, ACCESO, 0, () => 0, p);
  assert.equal(registro.ceros.filter((c) => c.startsWith('a ')).length, todos.length, 'la que no gastó no quedó en cero');
  assert.ok(!registro.ceros.some((c) => c.startsWith('b ')), 'se anotó un cero a una campaña que gastó');
  assert.ok(registro.escritas.every((e) => e.startsWith('b ')), 'un rango se escribió como métrica');
});

test('una campaña que gastó baja del rango a las semanas y de las semanas a los días', async () => {
  // La de mensajes: gastó del 30-sep al 5-oct. Sólo esos días se piden de a uno.
  const todos = dias('2026-09-08', '2026-10-05');
  const gastaEn = new Set(dias('2026-09-30', '2026-10-05'));
  const f = foto(['mensajes'], Object.fromEntries(todos.map((d) => [d, diaDeLaSerie(gastaEn.has(d) ? 30 : 0)])), {});
  const { p, registro } = piezasDelRelleno(f, {
    total: async (_a, campana, desde, hasta) => {
      registro.llamadas.push(`rango ${campana} ${desde}..${hasta}`);
      const gasto = dias(desde, hasta).filter((d) => gastaEn.has(d)).length * 30;
      return { tipo: 'datos', datos: { gasto, anuncios: 3 } };
    },
    pedir: async (_a, campana, dia) => {
      registro.llamadas.push(`dia ${campana} ${dia}`);
      return { tipo: 'datos', datos: [metrica('anuncio', 30)] };
    },
  });
  const r = await rellenarAnuncios(ORG, ACCESO, 0, () => 0, p);
  const pedidosPorDia = registro.llamadas.filter((l) => l.startsWith('dia')).map((l) => l.split(' ')[2]!).sort();
  // Los días de la semana que gastó que no gastaron también se piden: la semana sólo dice que gastó algo.
  assert.ok([...gastaEn].every((d) => pedidosPorDia.includes(d)), 'faltó pedir un día que gastó');
  assert.ok(pedidosPorDia.every((d) => d >= '2026-09-29'), `se pidió de a un día fuera de las semanas que gastaron: ${pedidosPorDia}`);
  assert.equal(r.resultado.atrasado, false);
});

test('un rango que FALLA no deja ceros: los días siguen pendientes', async () => {
  // Mutación: tratar el fallo como un total en cero.
  const todos = dias('2026-09-20', '2026-10-05');
  const f = foto(['a'], Object.fromEntries(todos.map((d) => [d, diaDeLaSerie(10)])), {});
  const { p, registro } = piezasDelRelleno(f, {
    total: async (_a, campana, desde, hasta) => {
      registro.llamadas.push(`rango ${campana} ${desde}..${hasta}`);
      return FALLA;
    },
  });
  await assert.rejects(() => rellenarAnuncios(ORG, ACCESO, 0, () => 0, p), /rechazó/);
  assert.deepEqual(registro.ceros, []);
});

test('sin Meta vinculado, el relleno no busca nada', async () => {
  const todos = dias('2026-09-20', '2026-10-05');
  const f = foto(['a'], Object.fromEntries(todos.map((d) => [d, diaDeLaSerie(10)])), {});
  const { p, registro } = piezasDelRelleno(f, {
    vinculo: async () => {
      registro.llamadas.push('vinculo');
      return { tipo: 'datos' as const, datos: { estado: 'disconnected', cuentaId: null, paginas: 0 } };
    },
  });
  await rellenarAnuncios(ORG, ACCESO, 0, () => 0, p);
  assert.deepEqual(registro.llamadas, ['vinculo']);
  assert.deepEqual(registro.ceros, []);
});

test('los días sin total de la cuenta se piden primero, en una sola serie', async () => {
  const todos = dias('2026-09-20', '2026-10-05');
  const serie = Object.fromEntries(todos.map((d) => [d, diaDeLaSerie(10)]));
  delete serie['2026-09-25'];
  delete serie['2026-09-27'];
  const { p, registro } = piezasDelRelleno(foto(['a'], serie, Object.fromEntries(todos.map((d) => [d, 10]))));
  await rellenarAnuncios(ORG, ACCESO, 0, () => 0, p);
  assert.deepEqual(registro.llamadas, ['vinculo', 'serie 2026-09-25..2026-09-27']);
});

test('un día con todo leído que no cuadra se REDESCUBRE una vez, y después es residuo', async () => {
  // Mutación: no borrar nunca los ceros (un silencio del proveedor quedaría como cero para siempre), o
  // borrarlos siempre (el relleno giraría sobre el mismo día cada hora).
  const d = '2026-10-01';
  const lecturas = { a: { [d]: lectura(30) }, b: { [d]: lectura(0, LEIDA, true) } };
  // Los días siguientes, hasta hoy−2, sin gasto y cuadrados: el único que no cuadra es `d`.
  const resto = Object.fromEntries(dias('2026-10-02', '2026-10-05').map((x) => [x, diaDeLaSerie(0)]));
  const primera = piezasDelRelleno(foto(['a', 'b'], { [d]: diaDeLaSerie(50), ...resto }, { [d]: 30 }, lecturas));
  await rellenarAnuncios(ORG, ACCESO, 0, () => 0, primera.p);
  assert.deepEqual(primera.registro.redescubiertos, [d]);
  assert.deepEqual(primera.registro.residuos, []);

  const segunda = piezasDelRelleno(
    foto(['a', 'b'], { [d]: diaDeLaSerie(50, { redescubiertoEl: LEIDA }), ...resto }, { [d]: 30 }, lecturas),
  );
  await rellenarAnuncios(ORG, ACCESO, 0, () => 0, segunda.p);
  assert.deepEqual(segunda.registro.redescubiertos, []);
  assert.deepEqual(segunda.registro.residuos, [d]);
  assert.deepEqual(segunda.registro.llamadas, [], 'un residuo no se busca');
});

test('el relleno corta cuando se le acaba el tiempo, y lo DICE', async () => {
  const todos = dias('2026-09-20', '2026-10-05');
  const f = foto(['a', 'b', 'c'], Object.fromEntries(todos.map((d) => [d, diaDeLaSerie(10)])), {});
  let t = 0;
  const { p, registro } = piezasDelRelleno(f, {
    reloj: () => t,
    total: async (_a, campana, desde, hasta) => {
      registro.llamadas.push(`rango ${campana} ${desde}..${hasta}`);
      t = FIN_DEL_RELLENO_MS + 1;
      return { tipo: 'datos', datos: { gasto: 0, anuncios: 0 } };
    },
  });
  const r = await rellenarAnuncios(ORG, ACCESO, 0, () => t, p);
  assert.equal(r.resultado.atrasado, true);
  assert.equal(registro.llamadas.filter((l) => l.startsWith('rango')).length, 1, 'siguió llamando pasado el fin');
});
