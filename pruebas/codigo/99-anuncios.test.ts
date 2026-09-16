// Qué días pide el colector de anuncios, y qué hace cuando una campaña se pudre. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LOS DOS DEFECTOS QUE ESTE ARCHIVO EXISTE PARA ATRAPAR, Y NINGUNO FALLA SOLO
//
// **1 · Un día que se deja de pedir no vuelve.** `diasQueFaltan` decide la ventana de cada pasada.
// Si se equivoca por un día —el clásico `<` donde iba `<=`— el sistema queda con un agujero
// permanente en el calendario de gasto: la pasada siguiente arranca del último día guardado, que
// nunca incluyó al que faltó. Y no falla nada: la pantalla muestra una serie con un hueco, que se
// lee como «ese día no se gastó».
//
// **2 · Una campaña podrida que aborta la pasada.** No es una hipótesis: `atribucion_primera` tiene
// un `888888` que alguien dejó, y pedirle métricas devuelve **HTTP 500**. Si un 500 tumbara la
// pasada, ese único contacto bloquearía el costo de las otras doce campañas para siempre — y el
// síntoma sería «Acquisition no tiene datos», sin nada que mirar.
//
// Los dos son de los que no fallan solos: producen una pantalla que se dibuja bien y miente.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  diasQueFaltan,
  DIAS_QUE_SE_RELEEN,
  DIAS_DE_RELLENO,
  MAXIMO_DE_DIAS_POR_PASADA,
  PRESUPUESTO_MS,
  recolectarAnuncios,
} from '../../lib/negocio/recolectarAnuncios.ts';
import type { MetricaDeAnuncio } from '../../lib/ghl/anuncios.ts';

/** Un instante fijo, para que la suite dé lo mismo en las tres zonas. */
const AHORA = Date.parse('2026-09-16T11:30:00Z');
const HOY = '2026-09-16';
/** El acceso no se usa: las cuatro pruebas de abajo reemplazan al proveedor. */
const ACCESO = { token: 'no-se-usa', locationId: 'no-se-usa' };
/* Un uuid cualquiera, y tiene que SER un uuid: el escritor corre dentro de `conOrganizacion`, que
   valida la forma antes de abrir contexto. No se conecta a nada porque el escritor está inyectado. */
const ORG = '00000000-0000-4000-8000-000000000000';

// ─── 1 · La ventana de días ─────────────────────────────────────────────────

test('la tabla vacía pide el relleno inicial, y el último día es HOY', () => {
  const dias = diasQueFaltan(null, AHORA);

  assert.equal(dias.length, DIAS_DE_RELLENO, `el relleno inicial son ${DIAS_DE_RELLENO} días`);
  assert.equal(dias[dias.length - 1], HOY, 'el último día pedido tiene que ser hoy');
  assert.equal(dias[0], '2026-08-18', 'treinta días contando hoy arrancan el 18 de agosto');
});

test('HOY se pide SIEMPRE, aunque esté incompleto', () => {
  // Es la decisión que `DIAS_QUE_SE_RELEEN` compensa: hoy entra parcial y las dos pasadas
  // siguientes lo corrigen. Dejarlo afuera daría una pantalla que nunca muestra el día en curso.
  for (const ultimo of [null, HOY, '2026-09-15', '2026-01-01']) {
    const dias = diasQueFaltan(ultimo, AHORA);
    assert.equal(dias[dias.length - 1], HOY, `con último=${ultimo} el final tiene que ser hoy`);
  }
});

test('con datos de ayer se releen los tres días anteriores, no sólo hoy', () => {
  // Meta corrige hacia atrás. Pedir sólo los días nuevos congelaría la primera lectura, que es la
  // que menos datos tiene. El primero pedido es `ayer - DIAS_QUE_SE_RELEEN`.
  const dias = diasQueFaltan('2026-09-15', AHORA);

  assert.equal(dias[0], '2026-09-12', `tres días antes del 15, con DIAS_QUE_SE_RELEEN=${DIAS_QUE_SE_RELEEN}`);
  assert.deepEqual(dias, ['2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16']);
});

test('los días son CONSECUTIVOS y no se repite ninguno', () => {
  // Un salto acá es el agujero permanente del encabezado; un repetido es una llamada pagada dos
  // veces por la misma fila.
  const dias = diasQueFaltan('2026-09-10', AHORA);
  const unicos = new Set(dias);

  assert.equal(unicos.size, dias.length, 'hay días repetidos');
  for (let i = 1; i < dias.length; i += 1) {
    const anterior = Date.parse(`${dias[i - 1]}T00:00:00Z`);
    const actual = Date.parse(`${dias[i]}T00:00:00Z`);
    assert.equal(actual - anterior, 86_400_000, `salto entre ${dias[i - 1]} y ${dias[i]}`);
  }
});

test('una organización muy atrasada avanza por el tope, no de una vez', () => {
  // Sin el tope, ocho meses de atraso serían 13 × 240 = 3.120 llamadas en una función de 300
  // segundos. Con él, la pasada hace treinta días y la siguiente sigue.
  const dias = diasQueFaltan('2025-12-01', AHORA);

  assert.equal(dias.length, MAXIMO_DE_DIAS_POR_PASADA);
  assert.equal(dias[dias.length - 1], HOY, 'el tope recorta por el principio, no por el final');
});

test('el tope NO recorta la ventana normal', () => {
  // La comprobación que hace útil a la anterior: si el tope se aplicara siempre, cada pasada
  // pediría treinta días y el relleno de treinta se volvería permanente.
  assert.equal(diasQueFaltan(HOY, AHORA).length, DIAS_QUE_SE_RELEEN + 1);
});

test('el tope NO puede ser menor que el relleno inicial', () => {
  /* ── ESTA PRUEBA SALIÓ DE UN MUTANTE EQUIVALENTE, Y POR ESO ESTÁ ACÁ ──────
   *
   * Al verificar por mutación, cambiar el relleno de `DIAS_DE_RELLENO - 1` a `DIAS_DE_RELLENO`
   * dejó la suite en verde. No es un hueco de las pruebas: el tope de 30 recortaba el relleno
   * mutado de 31 de vuelta a 30, o sea que las dos versiones hacen lo mismo.
   *
   * Pero eso deja a la vista una trampa de verdad: **hoy el tope gobierna al relleno**. Subir
   * `DIAS_DE_RELLENO` a 60 no pediría sesenta días — pediría treinta, en silencio, y la primera
   * pasada de una empresa nueva guardaría la mitad de lo que alguien creyó configurar.
   *
   * Así que lo que se afirma no es el valor, es la relación. */
  assert.ok(
    DIAS_DE_RELLENO <= MAXIMO_DE_DIAS_POR_PASADA,
    `el relleno (${DIAS_DE_RELLENO}) no puede pasar del tope (${MAXIMO_DE_DIAS_POR_PASADA}): el tope lo recortaría sin decir nada`,
  );
});

// ─── 2 · Lo que pasa cuando una campaña se pudre ────────────────────────────

/** Una métrica cualquiera, con el `adId` que se le pida. */
function metrica(anuncioId: string): MetricaDeAnuncio {
  return {
    anuncioId,
    adSetId: '120249633901560467',
    campanaId: '120249633901590467',
    nombre: 'un anuncio',
    objetivo: 'OUTCOME_LEADS',
    gasto: 12.5,
    impresiones: 100,
    clics: 3,
    ctr: 3,
    cpc: 4.16,
    alcance: 90,
    frecuencia: 1.11,
    leadsDeMeta: 1,
    resultadosDeMeta: 1,
  };
}

test('una campaña que devuelve 500 NO aborta la pasada, y se informa UNA vez', async () => {
  const pedidas: string[] = [];
  const r = await recolectarAnuncios(ORG, ACCESO, {
    ahora: AHORA,
    async pedir(_acceso, campana) {
      pedidas.push(campana);
      // La podrida falla siempre; la buena nunca devuelve filas, así que no se toca la base.
      return campana === '888888'
        ? { tipo: 'fallo', fallo: { tipo: 'rechazado', estado: 500, codigo: 'sin_codigo' } }
        : { tipo: 'datos', datos: [] };
    },
    // Las piezas se inyectan para que esta prueba no necesite base. Ver `PiezasDelColector`.
    campanas: ['888888', '120249633901590467'],
    ultimoDia: '2026-09-15',
  });

  assert.equal(r.corrio, true, 'la pasada tiene que completar');
  assert.deepEqual(
    r.resultado.fallidas,
    [{ campana: '888888', porque: 'rechazado' }],
    'una campaña que falla los cinco días se informa UNA vez, no cinco',
  );
  // Y la buena se pidió los cinco días igual, o sea que el fallo no cortó el bucle.
  assert.equal(
    pedidas.filter((c) => c === '120249633901590467').length,
    DIAS_QUE_SE_RELEEN + 1 + 1,
    'la campaña buena tiene que pedirse todos los días de la ventana',
  );
});

test('si fallan TODAS las campañas, la tarea LANZA', async () => {
  // Es la distinción que hace útil a la tolerancia anterior: una campaña podrida es un dato malo y
  // la pasada sigue; todas fallando es un token rechazado o el proveedor caído, y devolver eso como
  // éxito dejaría el sello en verde sobre una pasada que no escribió nada.
  await assert.rejects(
    () =>
      recolectarAnuncios(ORG, ACCESO, {
        ahora: AHORA,
        pedir: async () => ({ tipo: 'fallo', fallo: { tipo: 'rechazado', estado: 401, codigo: 'sin_codigo' } }),
        campanas: ['888888', '120249633901590467'],
        ultimoDia: '2026-09-15',
      }),
    /rechazó las 2 campañas/,
  );
});

test('sin campañas en la atribución no se pide NADA', async () => {
  // Una organización que todavía no recibió ningún contacto por anuncio no tiene nada que pedir, y
  // pedir las 61 campañas de la cuenta serían 1.830 llamadas para guardar el costo de anuncios que
  // no se pueden cruzar con nadie.
  let llamadas = 0;
  const r = await recolectarAnuncios(ORG, ACCESO, {
    ahora: AHORA,
    pedir: async () => {
      llamadas += 1;
      return { tipo: 'datos', datos: [] };
    },
    campanas: [],
    ultimoDia: '2026-09-15',
  });

  assert.equal(llamadas, 0, 'no se puede llamar al proveedor sin campañas que pedir');
  assert.equal(r.resultado.llamadas, 0);
  assert.equal(r.resultado.campanas, 0);
});

test('el resumen cuenta ANUNCIOS DISTINTOS, no filas', async () => {
  // Cinco días del mismo anuncio son cinco filas de métrica y UN anuncio. Contar filas acá diría
  // «75 anuncios» de una cuenta que tiene 15, y esa cifra es la que va al registro del barrido.
  const r = await recolectarAnuncios(ORG, ACCESO, {
    ahora: AHORA,
    pedir: async () => ({ tipo: 'datos', datos: [metrica('120249633901580467')] }),
    campanas: ['120249633901590467'],
    ultimoDia: '2026-09-15',
    // El escritor también se inyecta: acá se comprueba el CONTEO, no la escritura.
    escribir: async () => {},
  });

  assert.equal(r.resultado.anuncios, 1, 'el mismo anuncio cinco días es UN anuncio');
  assert.equal(r.resultado.metricas, DIAS_QUE_SE_RELEEN + 1 + 1, 'y son cinco filas de métrica');
});

// ─── 3 · El presupuesto de tiempo y el reintento ───────────────────────────
//
// Los dos salieron del relleno inicial contra producción, y ninguno estaba en el diseño.

test('la pasada CORTA cuando se le acaba el tiempo, y lo DICE', async () => {
  /* Medido el 2026-09-16: 390 llamadas en 1.775 segundos, o sea 4,55 s por llamada. La pasada diaria
   * son 52 llamadas y 237 segundos, contra un `maxDuration` de 300 para la función ENTERA del cron.
   * Sin este corte, una empresa que entra con 100 segundos gastados sale a los 337 — con la función
   * cortada a la mitad, y la plataforma no reintenta.
   *
   * El reloj sube 5 segundos por llamada, que es el ritmo medido redondeado hacia arriba. */
  let t = 0;
  let pedidas = 0;
  const r = await recolectarAnuncios(ORG, ACCESO, {
    ahora: AHORA,
    reloj: () => t,
    pedir: async () => {
      pedidas += 1;
      t += 5_000;
      return { tipo: 'datos', datos: [] };
    },
    campanas: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'],
    ultimoDia: null, // 30 días × 13 campañas = 390 llamadas = 1.950 s, muy por encima del tope
  });

  assert.equal(r.resultado.atrasado, true, 'se pasó del presupuesto y no lo dijo');
  assert.ok(pedidas < 390, `pidió las ${pedidas} llamadas enteras: el guardia no cortó`);
  // Y cortó donde tenía que cortar: el tope son 120 s a 5 s la llamada, o sea 24 llamadas, y el
  // corte es entre DÍAS — así que se completan los días enteros que entren.
  assert.equal(pedidas % 13, 0, 'cortó a mitad de un día: ese día queda incompleto y nadie vuelve por él');
  assert.ok(pedidas * 5_000 <= PRESUPUESTO_MS + 13 * 5_000, 'se pasó más de un día entero del tope');
});

test('una pasada que ENTRA en el presupuesto no se declara atrasada', async () => {
  // La comprobación que hace útil a la anterior: un `atrasado: true` fijo la dejaría en verde, y
  // entonces la pantalla avisaría de un atraso todos los días — que es un aviso que nadie lee.
  const r = await recolectarAnuncios(ORG, ACCESO, {
    ahora: AHORA,
    reloj: () => 0,
    pedir: async () => ({ tipo: 'datos', datos: [] }),
    campanas: ['1'],
    ultimoDia: '2026-09-15',
  });

  assert.equal(r.resultado.atrasado, false);
  assert.deepEqual(r.resultado.huecos, []);
});

test('un par (campaña, día) que falla se REINTENTA una vez, y sólo una', async () => {
  /* El caso que lo motivó es real: en el relleno inicial la campaña `120249590301010467` falló UN
   * día de treinta y quedó con 290 filas de 300. Ese día no vuelve solo — `diasQueFaltan` arranca del
   * último día guardado, y ese día ya quedó atrás.
   *
   * Acá el proveedor falla la primera vez que le preguntan por el 09-14 y funciona la segunda. */
  const vistas = new Map<string, number>();
  const r = await recolectarAnuncios(ORG, ACCESO, {
    ahora: AHORA,
    reloj: () => 0,
    pedir: async (_a, campana, dia) => {
      const clave = `${campana}|${dia}`;
      const veces = (vistas.get(clave) ?? 0) + 1;
      vistas.set(clave, veces);
      return dia === '2026-09-14' && veces === 1
        ? { tipo: 'fallo', fallo: { tipo: 'rechazado', estado: 500, codigo: 'sin_codigo' } }
        : { tipo: 'datos', datos: [] };
    },
    campanas: ['120249590301010467'],
    ultimoDia: '2026-09-16',
  });

  assert.equal(vistas.get('120249590301010467|2026-09-14'), 2, 'el día que falló no se reintentó');
  assert.equal(vistas.get('120249590301010467|2026-09-15'), 1, 'se reintentó un día que NO había fallado');
  assert.deepEqual(r.resultado.huecos, [], 'el reintento anduvo: no tendría que quedar hueco');
});

test('lo que falla DOS veces queda anotado como hueco, no se reintenta para siempre', async () => {
  // Es la otra mitad: un identificador podrido —el `888888` que hay en producción— falla siempre, y
  // reintentarlo en bucle gastaría el presupuesto entero en una campaña que no existe.
  let llamadas = 0;
  const r = await recolectarAnuncios(ORG, ACCESO, {
    ahora: AHORA,
    reloj: () => 0,
    pedir: async (_a, campana) => {
      llamadas += 1;
      return campana === '888888'
        ? { tipo: 'fallo', fallo: { tipo: 'rechazado', estado: 500, codigo: 'sin_codigo' } }
        : { tipo: 'datos', datos: [] };
    },
    campanas: ['888888', '120249633901590467'],
    ultimoDia: '2026-09-15',
  });

  const dias = DIAS_QUE_SE_RELEEN + 2;
  assert.equal(r.resultado.huecos.length, dias, 'cada día de la podrida tiene que quedar como hueco');
  assert.equal(llamadas, dias * 2 + dias, `${dias} días × 2 campañas, más ${dias} reintentos de la podrida`);
});
