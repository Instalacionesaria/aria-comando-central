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
  diasQuePedir,
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

/** El paso 0, falso y vinculado. Sin esto cada prueba saldría a la red del proveedor de verdad. */
const VINCULO_OK = async () => ({
  tipo: 'datos' as const,
  datos: { estado: 'connected', cuentaId: 'act_1349863156073553', paginas: 1 },
});
/* Un uuid cualquiera, y tiene que SER un uuid: el escritor corre dentro de `conOrganizacion`, que
   valida la forma antes de abrir contexto. No se conecta a nada porque el escritor está inyectado. */
const ORG = '00000000-0000-4000-8000-000000000000';

/**
 * Los días de la ventana que ya tienen filas, contando hacia atrás desde hoy.
 *
 * Reemplaza al viejo `ultimoDia`, y el cambio no es de forma: una marca de agua no puede describir
 * un conjunto con agujeros, y los agujeros son el caso normal. Ver `diasQuePedir`.
 */
function guardadosHasta(dia: string | null): Set<string> {
  const g = new Set<string>();
  if (dia === null) return g;
  const tope = Date.parse(`${dia}T00:00:00Z`);
  for (let i = 0; i < MAXIMO_DE_DIAS_POR_PASADA + 5; i += 1) {
    g.add(new Date(tope - i * 86_400_000).toISOString().slice(0, 10));
  }
  return g;
}

/** Todo guardado menos los días que se nombren: así se siembra un agujero. */
function guardadosSalvo(...huecos: string[]): Set<string> {
  const g = guardadosHasta(HOY);
  for (const h of huecos) g.delete(h);
  return g;
}

// ─── 1 · La ventana de días ───────────────────────────────────

test('la tabla vacía pide la ventana entera, y el PRIMERO es HOY', () => {
  const dias = diasQuePedir(new Set(), AHORA);

  assert.equal(dias.length, MAXIMO_DE_DIAS_POR_PASADA, 'sin nada guardado se piden todos los días de la ventana');
  assert.equal(dias[0], HOY, 'la lista va del más nuevo al más viejo');
  assert.equal(dias[dias.length - 1], '2026-08-18', 'treinta días contando hoy arrancan el 18 de agosto');
});

test('HOY se pide SIEMPRE y va PRIMERO, esté guardado o no', () => {
  /* ══ LA PRUEBA QUE FALTABA, Y SU AUSENCIA COSTÓ UN DEFECTO EN PRODUCCIÓN ══
   *
   * Que hoy ESTÉ en la lista no alcanza: estaba, y el colector igual no llegaba nunca. Lo que
   * importa es que vaya PRIMERO, porque el guardia de `PRESUPUESTO_MS` corta por el final.
   *
   * Medido el 2026-09-18 con el cron corriendo solo: la tarea decía `corrio` con 39 llamadas
   * reales y `max(fecha)` llevaba dos días sin moverse. */
  for (const guardados of [new Set<string>(), guardadosHasta(HOY), guardadosHasta('2026-09-15'), guardadosSalvo('2026-09-01')]) {
    assert.equal(diasQuePedir(guardados, AHORA)[0], HOY, 'el PRIMERO tiene que ser hoy');
  }
});

test('hoy y las relecturas se piden AUNQUE estén guardados', () => {
  // Meta corrige hacia atrás: una lectura vieja no es definitiva. Si el tramo fijo se filtrara por
  // «lo que falta», una corrección del proveedor no entraría nunca.
  const dias = diasQuePedir(guardadosHasta(HOY), AHORA);

  assert.equal(dias.length, DIAS_QUE_SE_RELEEN + 1, 'con todo guardado sólo queda el tramo fijo');
  assert.deepEqual(dias, ['2026-09-16', '2026-09-15', '2026-09-14']);
});

test('un HUECO viejo vuelve a la lista, y va DETRÁS del tramo fijo', () => {
  /* ══ ESTO ES LO QUE RESTITUYE LA RECONCILIACIÓN ════════════════════
   *
   * La versión anterior derivaba la ventana de `max(fecha)`, así que un día que el presupuesto
   * sacrificaba quedaba perdido POR CONSTRUCCIÓN: la marca de agua avanzaba igual y ese día no
   * volvía a entrar en ninguna ventana. Con la tabla vacía, el relleno de treinta guardaba tres y
   * los otros veintisiete no se pedían nunca más.
   *
   * Acá el hueco se deriva de la AUSENCIA de filas, así que sigue apareciendo hasta que se llene. */
  const dias = diasQuePedir(guardadosSalvo('2026-09-01', '2026-08-25'), AHORA);

  assert.ok(dias.includes('2026-09-01'), 'el hueco no volvió a la lista');
  assert.ok(dias.includes('2026-08-25'), 'el segundo hueco tampoco');
  // Y detrás del tramo fijo: lo que el presupuesto sacrifica son los huecos, nunca hoy.
  assert.ok(
    dias.indexOf('2026-09-01') >= DIAS_QUE_SE_RELEEN + 1,
    'un hueco se coló delante del tramo fijo: el presupuesto sacrificaría una relectura en su lugar',
  );
  // Del más nuevo al más viejo también entre huecos.
  assert.ok(dias.indexOf('2026-09-01') < dias.indexOf('2026-08-25'), 'los huecos no van del más nuevo al más viejo');
});

test('el presupuesto sacrifica HUECOS, nunca el día de hoy', () => {
  // La misma propiedad dicha como la usa el colector: tome los N días que tome, hoy está entre
  // ellos. Es lo que hace que la pantalla nunca se quede sin el día en curso.
  const dias = diasQuePedir(new Set(), AHORA);
  for (let entran = 1; entran <= dias.length; entran += 1) {
    assert.ok(dias.slice(0, entran).includes(HOY), `con presupuesto para ${entran} día(s), hoy quedó afuera`);
  }
});

test('los días no se repiten, y el tramo fijo va en orden descendente', () => {
  const dias = diasQuePedir(guardadosSalvo('2026-09-05'), AHORA);
  assert.equal(new Set(dias).size, dias.length, 'hay días repetidos: se pagarían dos veces');

  const fijo = dias.slice(0, DIAS_QUE_SE_RELEEN + 1);
  for (let i = 1; i < fijo.length; i += 1) {
    const anterior = Date.parse(`${fijo[i - 1]}T00:00:00Z`);
    const actual = Date.parse(`${fijo[i]}T00:00:00Z`);
    assert.equal(anterior - actual, 86_400_000, `salto o inversión entre ${fijo[i - 1]} y ${fijo[i]}`);
  }
});

test('la ventana nunca pasa del tope, aunque falte todo', () => {
  // Sin el tope, una tabla vacía de un año serían miles de llamadas en una función de 300 segundos.
  assert.equal(diasQuePedir(new Set(), AHORA).length, MAXIMO_DE_DIAS_POR_PASADA);
});

test('el tramo fijo ENTRA en el presupuesto, o `atrasado` sería permanente', () => {
  /* ══ LA CUENTA QUE ATA LAS TRES CONSTANTES ══════════════════════════
   *
   * Medido el 2026-09-18 contra producción: 13 campañas y 4,55 s por llamada, o sea ~59 s por cada
   * día pedido. En régimen —sin huecos— la ventana es exactamente el tramo fijo.
   *
   * Si ese tramo no entrara en `PRESUPUESTO_MS`, el guardia cortaría TODAS las pasadas y `atrasado`
   * quedaría encendido para siempre — un aviso que aparece siempre es uno que nadie lee. Con
   * `DIAS_QUE_SE_RELEEN = 3` eran 4 días y 237 s contra 120 s: no entraba.
   *
   * El guardia se comprueba ANTES de cada día, así que el último puede arrancar con el presupuesto
   * casi agotado y completarse igual. Por eso la condición es sobre los días ANTERIORES al último. */
  const CAMPANAS_MEDIDAS = 13;
  const MS_POR_LLAMADA = 4550;
  const dias = diasQuePedir(guardadosHasta(HOY), AHORA);

  assert.equal(dias.length, DIAS_QUE_SE_RELEEN + 1, 'en régimen la ventana es el tramo fijo');
  assert.ok(
    (dias.length - 1) * CAMPANAS_MEDIDAS * MS_POR_LLAMADA <= PRESUPUESTO_MS,
    `la ventana de ${dias.length} días no entra en ${PRESUPUESTO_MS / 1000} s: el guardia cortaría siempre`,
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
    vinculo: VINCULO_OK,
    async pedir(_acceso, campana) {
      pedidas.push(campana);
      // La podrida falla siempre; la buena nunca devuelve filas, así que no se toca la base.
      return campana === '888888'
        ? { tipo: 'fallo', fallo: { tipo: 'rechazado', estado: 500, codigo: 'sin_codigo' } }
        : { tipo: 'datos', datos: [] };
    },
    // Las piezas se inyectan para que esta prueba no necesite base. Ver `PiezasDelColector`.
    campanas: ['888888', '120249633901590467'],
    guardados: guardadosHasta('2026-09-15'),
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
    DIAS_QUE_SE_RELEEN + 1,
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
    vinculo: VINCULO_OK,
        pedir: async () => ({ tipo: 'fallo', fallo: { tipo: 'rechazado', estado: 401, codigo: 'sin_codigo' } }),
        campanas: ['888888', '120249633901590467'],
        guardados: guardadosHasta('2026-09-15'),
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
    vinculo: VINCULO_OK,
    pedir: async () => {
      llamadas += 1;
      return { tipo: 'datos', datos: [] };
    },
    campanas: [],
    guardados: guardadosHasta('2026-09-15'),
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
    vinculo: VINCULO_OK,
    pedir: async () => ({ tipo: 'datos', datos: [metrica('120249633901580467')] }),
    campanas: ['120249633901590467'],
    guardados: guardadosHasta('2026-09-15'),
    // El escritor también se inyecta: acá se comprueba el CONTEO, no la escritura.
    escribir: async () => {},
  });

  assert.equal(r.resultado.anuncios, 1, 'el mismo anuncio cinco días es UN anuncio');
  assert.equal(r.resultado.metricas, DIAS_QUE_SE_RELEEN + 1, 'una fila de métrica por día del tramo fijo');
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
    vinculo: VINCULO_OK,
    reloj: () => t,
    pedir: async () => {
      pedidas += 1;
      t += 5_000;
      return { tipo: 'datos', datos: [] };
    },
    campanas: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'],
    guardados: new Set<string>(), // 30 días × 13 campañas = 390 llamadas = 1.950 s, muy por encima del tope
  });

  assert.equal(r.resultado.atrasado, true, 'se pasó del presupuesto y no lo dijo');
  assert.ok(pedidas < 390, `pidió las ${pedidas} llamadas enteras: el guardia no cortó`);
  // Y cortó donde tenía que cortar: el tope son 120 s a 5 s la llamada, o sea 24 llamadas, y el
  // corte es entre DÍAS — así que se completan los días enteros que entren.
  assert.equal(pedidas % 13, 0, 'cortó a mitad de un día: ese día queda incompleto y nadie vuelve por él');
  assert.ok(pedidas * 5_000 <= PRESUPUESTO_MS + 13 * 5_000, 'se pasó más de un día entero del tope');
});

test('el resumen reporta la ventana AL DERECHO, no la lista al revés', async () => {
  /* `dias` va del más nuevo al más viejo, así que el primero es `hasta` y el último `desde`.
   * Tomarlos en el orden de la lista da un resumen con la ventana invertida — y ese resumen es lo
   * que queda en el registro del cron, o sea el único sitio donde alguien mira qué hizo la pasada.
   *
   * Una ventana invertida ahí no falla: dice "del 18 al 16", que se lee como un error de tipeo
   * hasta que alguien intenta usarla para diagnosticar un hueco. */
  const r = await recolectarAnuncios(ORG, ACCESO, {
    ahora: AHORA,
    vinculo: VINCULO_OK,
    reloj: () => 0,
    pedir: async () => ({ tipo: 'datos', datos: [] }),
    campanas: ['1'],
    guardados: guardadosHasta('2026-09-15'),
  });

  assert.equal(r.resultado.desde, '2026-09-14', 'el `desde` tiene que ser el día más VIEJO de la ventana');
  assert.equal(r.resultado.hasta, HOY, 'el `hasta` tiene que ser el día más NUEVO, que es hoy');
  assert.ok(
    String(r.resultado.desde) <= String(r.resultado.hasta),
    `la ventana quedó invertida: ${r.resultado.desde} → ${r.resultado.hasta}`,
  );
});

test('una pasada que ENTRA en el presupuesto no se declara atrasada', async () => {
  // La comprobación que hace útil a la anterior: un `atrasado: true` fijo la dejaría en verde, y
  // entonces la pantalla avisaría de un atraso todos los días — que es un aviso que nadie lee.
  const r = await recolectarAnuncios(ORG, ACCESO, {
    ahora: AHORA,
    vinculo: VINCULO_OK,
    reloj: () => 0,
    pedir: async () => ({ tipo: 'datos', datos: [] }),
    campanas: ['1'],
    guardados: guardadosHasta('2026-09-15'),
  });

  assert.equal(r.resultado.atrasado, false);
  assert.deepEqual(r.resultado.huecos, []);
});

test('el resumen DICE si Meta sigue vinculado, y cuenta las filas que no pudo leer', async () => {
  /* ══ DOS FALLOS QUE NO LANZAN Y DEJAN LA PANTALLA EN CERO ═══════════════
   *
   * **Sin vínculo con Meta, el proveedor devuelve vacío sin fallar.** La pasada sella `corrio`,
   * escribe cero filas, y la pantalla dibuja un cero que se lee como «no se invirtió nada» en vez
   * de «está desconectado». El cliente tenía la comprobación desde el primer día —su comentario la
   * llama «el paso 0 de todo lo demás»— y **no la llamaba nadie**.
   *
   * **Y una fila sin `adId` se descartaba en silencio.** Si el proveedor renombra esa clave, se
   * caen TODAS las filas y la pasada sigue reportando éxito. No es abstracto: esta misma API ya
   * cambió dos formas bajo nuestros pies (el arreglo pelado de la respuesta, el cursor `next`). */
  const r = await recolectarAnuncios(ORG, ACCESO, {
    ahora: AHORA,
    reloj: () => 0,
    vinculo: async () => ({ tipo: 'datos' as const, datos: { estado: 'disconnected', cuentaId: null, paginas: 0 } }),
    pedir: async () => ({ tipo: 'datos' as const, datos: [], ilegibles: 3 }),
    campanas: ['120249633901590467'],
    guardados: guardadosHasta(HOY),
  });

  assert.equal(r.resultado.vinculo?.estado, 'disconnected', 'el estado del vínculo no llegó al resumen');
  assert.equal(
    r.resultado.ilegibles,
    3 * (DIAS_QUE_SE_RELEEN + 1),
    'las filas ilegibles se descartaron sin contarlas: un cambio de clave del proveedor sería invisible',
  );
});

test('si no se puede preguntar por el vínculo, el resumen dice NULO y la pasada sigue', async () => {
  // Un fallo del paso 0 no puede impedir recolectar lo que sí se pueda: son dos cosas distintas, y
  // `null` dice «no se pudo preguntar», que no es lo mismo que «está desconectado».
  const r = await recolectarAnuncios(ORG, ACCESO, {
    ahora: AHORA,
    reloj: () => 0,
    vinculo: async () => ({ tipo: 'fallo' as const, fallo: { tipo: 'rechazado' as const, estado: 500, codigo: 'sin_codigo' } }),
    pedir: async () => ({ tipo: 'datos' as const, datos: [] }),
    campanas: ['120249633901590467'],
    guardados: guardadosHasta(HOY),
  });

  assert.equal(r.resultado.vinculo, null, '«no se pudo preguntar» tiene que ser nulo, no un estado inventado');
  assert.equal(r.corrio, true, 'un fallo del paso 0 tumbó la pasada entera');
});

test('un reintento que no entra en el presupuesto NO enciende `atrasado`', async () => {
  /* ══ DOS HECHOS DISTINTOS QUE ESTABAN COLAPSADOS EN UNA SOLA SEÑAL ════════
   *
   * `atrasado` significa **quedaron días de la ventana sin pedir**, o sea falta gasto. Que un
   * REINTENTO no entre en el presupuesto no deja ningún día sin pedir: deja un par (campaña, día)
   * sin corregir, y eso se dice con nombre y fecha en `huecos`.
   *
   * Medido el 2026-09-18 en producción: la ventana de tres días entra completa en 144 s y los
   * reintentos arrancan con el presupuesto ya gastado, así que el aviso se encendía TODOS los días
   * — por no reintentar `888888`, una campaña de prueba que devuelve 500 desde siempre.
   *
   * Un aviso que aparece siempre es uno que nadie lee, y con él se pierde el caso que sí importa.
   *
   * Acá el reloj se queda quieto durante los días y salta pasado el presupuesto justo antes de los
   * reintentos: la ventana se completa entera y lo único que no entra es la segunda vuelta. */
  let t = 0;
  let pedidas = 0;
  const r = await recolectarAnuncios(ORG, ACCESO, {
    ahora: AHORA,
    vinculo: VINCULO_OK,
    reloj: () => t,
    pedir: async (_a, campana) => {
      pedidas += 1;
      // Los días no consumen tiempo; el salto ocurre cuando ya se pidieron todos.
      if (pedidas === (DIAS_QUE_SE_RELEEN + 1) * 2) t = PRESUPUESTO_MS + 1;
      return campana === '888888'
        ? { tipo: 'fallo', fallo: { tipo: 'rechazado', estado: 500, codigo: 'sin_codigo' } }
        : { tipo: 'datos', datos: [] };
    },
    campanas: ['888888', '120249633901590467'],
    guardados: guardadosHasta(HOY),
  });

  const dias = DIAS_QUE_SE_RELEEN + 1;
  assert.equal(r.resultado.dias, dias, 'la ventana en régimen');
  assert.equal(
    r.resultado.atrasado,
    false,
    'se encendió `atrasado` sin que faltara ningún día: el aviso quedaría puesto todas las pasadas',
  );
  // Y lo que SÍ hay que reportar está, con su nombre y su fecha.
  assert.equal(r.resultado.huecos.length, dias, 'cada día de la campaña podrida tiene que quedar como hueco');
  assert.ok(
    r.resultado.huecos.every((h) => h.campana === '888888'),
    'se anotó como hueco una campaña que no falló',
  );
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
    vinculo: VINCULO_OK,
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
    guardados: guardadosHasta('2026-09-16'),
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
    vinculo: VINCULO_OK,
    reloj: () => 0,
    pedir: async (_a, campana) => {
      llamadas += 1;
      return campana === '888888'
        ? { tipo: 'fallo', fallo: { tipo: 'rechazado', estado: 500, codigo: 'sin_codigo' } }
        : { tipo: 'datos', datos: [] };
    },
    campanas: ['888888', '120249633901590467'],
    guardados: guardadosHasta('2026-09-15'),
  });

  const dias = DIAS_QUE_SE_RELEEN + 1;
  assert.equal(r.resultado.huecos.length, dias, 'cada día de la podrida tiene que quedar como hueco');
  assert.equal(llamadas, dias * 2 + dias, `${dias} días × 2 campañas, más ${dias} reintentos de la podrida`);
});
