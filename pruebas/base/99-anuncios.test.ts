// Lo que el colector de anuncios ESCRIBE, contra la base de verdad. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA ÚNICA AFIRMACIÓN QUE NO SE PUEDE COMPROBAR SIN BASE, Y ES LA MÁS IMPORTANTE
//
// `pruebas/codigo/99-anuncios.test.ts` cubre la ventana de días y la tolerancia al fallo de una
// campaña, y las ocho mutaciones que le corresponden mueren. **Una sobrevivió**: cambiar
// `gasto: m.gasto` por `gasto: m.gasto ?? 0` deja toda esa suite en verde.
//
// Y ése es el defecto más caro que este módulo puede tener. Medido el 2026-09-16 contra la
// subcuenta real: cuando un anuncio NO entregó ese día, GoHighLevel **omite las siete claves
// enteras** —ni `spend`, ni `impressions`, ni `clicks`, ni `ctr`, ni `cpc`, ni `reach`, ni
// `frequency`—. O sea que el proveedor ya distingue los dos ceros, y un `?? 0` en el escritor
// destruye esa distinción en la única capa que puede conservarla.
//
// Lo que se pierde con eso no es un matiz: «no entregó» no va en el denominador de ningún promedio
// y «entregó y costó cero» sí. Con ceros escritos, un CPM divide por impresiones que nunca
// existieron y una tabla de anuncios ordenada por gasto pone arriba a los que no corrieron.
//
// ── Y POR QUÉ ACÁ Y NO EN LA SUITE DE CÓDIGO ──────────────────────────────
//
// Porque el escritor real corre dentro de `conOrganizacion`, y esa función abre el cliente de la
// base apenas se la llama. Una prueba de código que quisiera cubrirlo tendría que reemplazar al
// escritor — o sea, tendría que reemplazar exactamente lo que pretende comprobar.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, type Escenario } from '../apoyo/closer.ts';
import { recolectarAnuncios } from '../../lib/negocio/recolectarAnuncios.ts';
import type { MetricaDeAnuncio } from '../../lib/ghl/anuncios.ts';

let esc: Escenario;

/** El prefijo de todo anuncio sembrado acá. Es lo que borra `limpiar`. */
const MARCA = '99999900';
const ACCESO = { token: 'no-se-usa', locationId: 'no-se-usa' };
const AHORA = Date.parse('2026-09-16T11:30:00Z');
/** El día más nuevo de la ventana con ese reloj: el primero que pide el colector. */
const HOY_DE_LA_PRUEBA = '2026-09-16';

async function limpiar(): Promise<void> {
  // Primero el hecho y después la dimensión: la foránea es `on delete cascade`, pero borrar en este
  // orden deja la prueba correcta aunque alguien cambie la cascada.
  await esc.admin.query('delete from negocio.metricas_de_anuncio where meta_anuncio_id like $1', [`${MARCA}%`]);
  await esc.admin.query('delete from negocio.anuncios where meta_anuncio_id like $1', [`${MARCA}%`]);
  await esc.admin.query('delete from negocio.campanas where meta_campana_id like $1', [`${MARCA}%`]);
  // Las dos de la `076`: las escribe el colector de esta empresa en cada pasada, y ninguna otra prueba las deja.
  await esc.admin.query('delete from negocio.lecturas_de_gasto where org_id = $1', [esc.org]);
  await esc.admin.query('delete from negocio.gasto_de_la_cuenta where org_id = $1', [esc.org]);
}

before(async () => {
  esc = await montar('Anuncios');
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

/** Una métrica con las siete en nulo: es lo que el proveedor manda cuando el anuncio no entregó. */
function sinEntrega(anuncioId: string): MetricaDeAnuncio {
  return {
    anuncioId,
    adSetId: '120249633901560467',
    campanaId: '120249633901590467',
    nombre: 'bofu - agendamiento - yaping - 23/07',
    objetivo: 'OUTCOME_LEADS',
    gasto: null,
    impresiones: null,
    clics: null,
    ctr: null,
    cpc: null,
    alcance: null,
    frecuencia: null,
    leadsDelCrm: 0,
    /* Sin entrega el proveedor tampoco manda `results`, y eso es `null` y no `{}`. */
    acciones: null,
  };
}

/** Y una que sí entregó, con las cifras reales del 2026-09-10. */
function conEntrega(anuncioId: string): MetricaDeAnuncio {
  return {
    ...sinEntrega(anuncioId),
    gasto: 69.59,
    impresiones: 12197,
    clics: 400,
    ctr: 3.279495,
    cpc: 0.500075,
    alcance: 7533,
    frecuencia: 1.619142,
  };
}

/**
 * El vínculo y los nombres de las campañas, falsos. **Sin esto la pasada salía a la red**: el
 * vínculo se preguntaba a GoHighLevel de verdad con `no-se-usa` como token, y desde la `065`
 * también los nombres. Una prueba de la base no tiene por qué depender de que haya conexión.
 */
const SIN_RED = {
  vinculo: async () => ({ tipo: 'datos' as const, datos: { estado: 'connected', cuentaId: null, paginas: 1 } }),
  listarCampanas: async () => ({ tipo: 'datos' as const, datos: [], corto: false, paginas: 1 }),
  // Y la serie de la cuenta (`076`), vacía: las pruebas de la serie escriben con su escritor, más abajo.
  serie: async () => ({ tipo: 'datos' as const, datos: [], llamadas: 1 }),
};

/** El plan de una pasada que pide sólo esta campaña: la que el proveedor falso contesta. */
const SOLO_ESTA = { plan: { inicio: '2026-09-14', activas: ['120249633901590467'], conGastoReciente: [] } };

/** El único día en que el proveedor falso devuelve algo. Ver `unaPasada`. */
const DIA = '2026-09-14';

/**
 * Corre una pasada que escribe **UNA sola vez**.
 *
 * ── POR QUÉ UN SOLO DÍA, Y NO ES DETALLE DE ARMADO ──────────────────────
 *
 * La ventana pide varios días, así que un proveedor falso que devuelva la misma fila en todos la
 * escribe varias veces: **una inserción y el resto correcciones**. Y entonces un defecto que viva
 * SÓLO en el camino de inserción queda tapado por la corrección que viene detrás.
 *
 * No es hipotético: se midió por mutación. Poner `meta_conjunto_id: null` en el `insert` dejaba esta
 * suite entera en verde, porque el `on conflict` del día siguiente reponía el valor correcto.
 */
async function unaPasada(metricas: readonly MetricaDeAnuncio[]) {
  return recolectarAnuncios(esc.org, ACCESO, {
    ...SIN_RED,
    ...SOLO_ESTA,
    ahora: AHORA,
    pedir: async (_acceso, _campana, dia) => ({
      tipo: 'datos',
      datos: dia === DIA ? [...metricas] : [],
    }),
  });
}

async function metricasDe(anuncioId: string) {
  const r = await esc.admin.query<{
    fecha: Date;
    gasto: string | null;
    impresiones: string | null;
    clics: string | null;
    alcance: string | null;
    ctr: string | null;
    cpc: string | null;
    frecuencia: string | null;
    acciones: Record<string, number> | null;
  }>(
    `select fecha, gasto, impresiones, clics, alcance, ctr, cpc, frecuencia, acciones
       from negocio.metricas_de_anuncio where meta_anuncio_id = $1 order by fecha`,
    [anuncioId],
  );
  return r.rows;
}

// ─── LA REGLA DE LOS DOS CEROS ──────────────────────────────────────────────

test('un anuncio que NO entregó se guarda con las siete en NULO, no en cero', async () => {
  const id = `${MARCA}01`;
  await unaPasada([sinEntrega(id)]);

  const filas = await metricasDe(id);
  assert.ok(filas.length > 0, 'no se escribió ninguna fila');

  for (const f of filas) {
    // Se afirma `null` ESTRICTO y no «falsy»: un `0` es falsy y pasaría la comprobación laxa, que
    // es exactamente el defecto que esta prueba existe para atrapar.
    assert.equal(f.gasto, null, `gasto quedó en ${f.gasto} el ${f.fecha.toISOString().slice(0, 10)}`);
    assert.equal(f.impresiones, null, `impresiones quedó en ${f.impresiones}`);
    assert.equal(f.clics, null, `clics quedó en ${f.clics}`);
    assert.equal(f.alcance, null, `alcance quedó en ${f.alcance}`);
    assert.equal(f.ctr, null, `ctr quedó en ${f.ctr}`);
    assert.equal(f.cpc, null, `cpc quedó en ${f.cpc}`);
    assert.equal(f.frecuencia, null, `frecuencia quedó en ${f.frecuencia}`);
  }
});

test('un anuncio que SÍ entregó guarda sus cifras, con los decimales enteros', async () => {
  // La comprobación que hace útil a la anterior: si el escritor guardara nulos siempre, la prueba
  // de arriba pasaría y este módulo no serviría para nada.
  //
  // Y los decimales importan: `numeric(14,4)` y no `double precision` porque el gasto suma cientos
  // de filas por ventana, y el error de coma flotante aparece como centavos que no cierran contra
  // el total de la cuenta publicitaria.
  const id = `${MARCA}02`;
  await unaPasada([conEntrega(id)]);

  const fila = (await metricasDe(id))[0];
  assert.ok(fila, 'no se escribió ninguna fila');
  assert.equal(Number(fila.gasto), 69.59);
  assert.equal(Number(fila.impresiones), 12197);
  assert.equal(Number(fila.clics), 400);
  assert.equal(Number(fila.alcance), 7533);
  assert.equal(Number(fila.ctr), 3.279495, 'el CTR perdió decimales');
  assert.equal(Number(fila.cpc), 0.500075, 'el CPC perdió decimales');
  assert.equal(Number(fila.frecuencia), 1.619142, 'la frecuencia perdió decimales');
});

// ─── LA REESCRITURA, QUE ES LO QUE PERMITE QUE META CORRIJA ─────────────────

test('una segunda lectura del mismo día REESCRIBE la fila, no la duplica ni la ignora', async () => {
  // Las dos mitades importan y por motivos distintos. **Duplicar** es imposible por la clave
  // primaria, así que lo que se comprueba ahí es que la clave esté nombrada entera en el
  // `on conflict`: con sólo `meta_anuncio_id` PostgreSQL no encuentra el índice y falla con `42P10`.
  //
  // **Ignorar** sí sería posible con un `doNothing`, y es el defecto real: Meta corrige cifras hacia
  // atrás, así que congelar la primera lectura guarda para siempre la versión con menos datos.
  const id = `${MARCA}03`;

  await unaPasada([sinEntrega(id)]);
  const antes = await metricasDe(id);
  assert.equal(antes[0]?.gasto, null, 'la primera lectura tenía que ser sin entrega');

  await unaPasada([conEntrega(id)]);
  const despues = await metricasDe(id);

  assert.equal(antes.length, 1, 'una pasada tiene que escribir exactamente una fila');
  assert.equal(despues.length, antes.length, 'la segunda lectura duplicó filas');
  assert.equal(Number(despues[0]?.gasto), 69.59, 'la corrección de Meta no se escribió');
});

test('el desglose de acciones se guarda, y un tipo ausente no aparece como cero', async () => {
  /* La columna que la `053` agregó. Lo que se comprueba no es que el JSON viaje —eso lo hace el
     controlador— sino que la AUSENCIA sobreviva al viaje: una pieza estática no tiene `videoView`
     nunca, y si la base devolviera un cero ahí, su hook rate entraría en el promedio arrastrándolo. */
  const id = `${MARCA}07`;
  await unaPasada([{ ...conEntrega(id), acciones: { videoView: 328, linkClick: 18 } }]);

  const filas = await metricasDe(id);
  assert.deepEqual(filas[0]?.acciones, { videoView: 328, linkClick: 18 });
  assert.equal('landingPageView' in (filas[0]?.acciones ?? {}), false, 'la base inventó un tipo en cero');
});

test('sin desglose la columna queda en NULO, que no es un objeto vacío', async () => {
  /* Los dos ceros llegando hasta la base. El proveedor omite `results` cuando el anuncio no
     entregó, y eso es «no se leyó». Un `default '{}'` en la columna —que es lo que la `048` sí pudo
     hacer para `atribucion_primera`— haría que las ~2.500 filas anteriores a esta migración
     afirmaran «el proveedor mandó el desglose y estaba vacío», que es una mentira sobre 2.500
     filas. El motivo largo está en la § 2 de la `053`. */
  const id = `${MARCA}08`;
  await unaPasada([sinEntrega(id)]);

  const filas = await metricasDe(id);
  assert.equal(filas[0]?.acciones, null, 'la ausencia de desglose se guardó como objeto vacío');
});

test('el desglose se REESCRIBE plano: no conserva un tipo que dejó de venir', async () => {
  /* Acá el hecho hace lo CONTRARIO que la dimensión de al lado, y es a propósito. `meta_conjunto_id`
     se protege con `coalesce` porque describe qué ES un anuncio y acumula lo que se va sabiendo.
     `acciones` describe UN DÍA tal como el proveedor lo cuenta hoy.
     *
     * Con `coalesce`, una relectura en la que Meta ya no reporta `videoView` dejaría el valor viejo
     * junto a las impresiones nuevas, y el hook rate saldría con el numerador de una lectura y el
     * denominador de otra. Meta corrige hacia atrás, así que la relectura no es hipotética: es lo
     * que el colector hace los tres primeros días de cada ventana. */
  const id = `${MARCA}09`;

  await unaPasada([{ ...conEntrega(id), acciones: { videoView: 328, linkClick: 18 } }]);
  await unaPasada([{ ...conEntrega(id), acciones: { linkClick: 20 } }]);

  const filas = await metricasDe(id);
  assert.equal(filas.length, 1, 'la segunda lectura duplicó filas');
  assert.deepEqual(
    filas[0]?.acciones,
    { linkClick: 20 },
    'el tipo que dejó de venir sobrevivió a la reescritura',
  );
});

test('una relectura SIN desglose borra el que había, y no lo conserva', async () => {
  // La otra mitad de la anterior: el paso de objeto a nulo también tiene que viajar.
  const id = `${MARCA}10`;

  await unaPasada([{ ...conEntrega(id), acciones: { videoView: 328 } }]);
  await unaPasada([{ ...conEntrega(id), acciones: null }]);

  const filas = await metricasDe(id);
  assert.equal(filas[0]?.acciones, null, 'el desglose viejo sobrevivió a una lectura que no lo trajo');
});

test('el anuncio queda NOMBRADO en la dimensión, que es para lo único que existe', async () => {
  const id = `${MARCA}04`;
  await unaPasada([conEntrega(id)]);

  const r = await esc.admin.query<{ nombre: string; meta_conjunto_id: string | null; objetivo: string | null }>(
    'select nombre, meta_conjunto_id, objetivo from negocio.anuncios where meta_anuncio_id = $1',
    [id],
  );

  assert.equal(r.rows.length, 1, 'el anuncio no quedó en la dimensión');
  assert.equal(r.rows[0]?.nombre, 'bofu - agendamiento - yaping - 23/07');
  // El conjunto es lo que la migración 050 dice que es el mismo valor que `utmTerm`. Sin esta
  // columna escrita, el cruce con la atribución del lead no se puede hacer por conjunto.
  assert.equal(r.rows[0]?.meta_conjunto_id, '120249633901560467');
  assert.equal(r.rows[0]?.objetivo, 'OUTCOME_LEADS');
});

test('un día SIN entrega no borra el conjunto de anuncios que ya se sabía', async () => {
  /* ══ EL DEFECTO QUE ESTO CIERRA VACIÓ EL 97 % DE UNA COLUMNA EN PRODUCCIÓN ══
   *
   * Medido el 2026-09-18: **77 de 79 anuncios tenían `meta_conjunto_id` en NULL**, justo la columna
   * que la migración `050` presenta como la llave del cruce por conjunto.
   *
   * La causa es la misma asimetría que gobierna las métricas: cuando el anuncio no entregó ese día,
   * el proveedor **omite `adsetId`** —pero sí manda `campaignId` y `objective`—. Como el colector
   * pide varios días y reescribe en cada uno, bastaba UN día sin entrega posterior al bueno para
   * borrar el conjunto. Eso explica que `meta_campana_id` estuviera completo y el conjunto vacío:
   * los dos salen de la misma fila y sólo uno se omite.
   *
   * Acá se siembra exactamente esa secuencia: primero el día bueno, después uno sin conjunto. */
  const id = `${MARCA}06`;

  await recolectarAnuncios(esc.org, ACCESO, {
    ...SIN_RED,
    ...SOLO_ESTA,
    ahora: AHORA,
    pedir: async (_a, _c, dia) => ({
      tipo: 'datos',
      /* El día más nuevo SÍ trae el conjunto y los siguientes NO, y ese orden es la prueba: el
         colector pide del más nuevo al más viejo, así que el bueno INSERTA y los de atrás pasan
         por el `on conflict`. Sembrado al revés, la última escritura repone el valor sola y la
         mutación sobrevive — medido. */
      datos: [dia === HOY_DE_LA_PRUEBA ? conEntrega(id) : { ...conEntrega(id), adSetId: null, objetivo: null }],
    }),
  });

  const r = await esc.admin.query<{ meta_conjunto_id: string | null; objetivo: string | null }>(
    'select meta_conjunto_id, objetivo from negocio.anuncios where meta_anuncio_id = $1',
    [id],
  );
  assert.equal(r.rows.length, 1, 'el anuncio no quedó en la dimensión');
  assert.equal(
    r.rows[0]?.meta_conjunto_id,
    '120249633901560467',
    'un día sin entrega borró el conjunto que ya se sabía',
  );
  assert.equal(r.rows[0]?.objetivo, 'OUTCOME_LEADS', 'un día sin entrega borró el objetivo');
});

// ─── LOS NOMBRES DE LAS CAMPAÑAS (`065`) ─────────────────────────────────────
//
// El escritor real, `guardarCampanas`, corre dentro de `conOrganizacion`; por eso esto va acá y no
// en la suite de código, por el mismo motivo que la regla de los dos ceros.

/** Una pasada que no escribe métricas y lee estas campañas. */
async function pasadaConCampanas(lista: readonly { id: string; nombre: string | null; estado: string | null }[]) {
  return recolectarAnuncios(esc.org, ACCESO, {
    ...SIN_RED,
    ...SOLO_ESTA,
    ahora: AHORA,
    pedir: async () => ({ tipo: 'datos', datos: [] }),
    listarCampanas: async () => ({
      tipo: 'datos',
      datos: lista.map((c) => ({ ...c, cuentaId: null })),
      corto: false,
      paginas: 1,
    }),
  });
}

async function campanaGuardada(id: string) {
  const r = await esc.admin.query<{ nombre: string | null; estado: string | null }>(
    'select nombre, estado from negocio.campanas where meta_campana_id = $1',
    [id],
  );
  return r.rows;
}

test('la campaña queda NOMBRADA, y una segunda lectura reescribe el nombre, el estado y el sello', async () => {
  const id = `${MARCA}c1`;
  await pasadaConCampanas([{ id, nombre: 'bofu - agendamiento', estado: 'ACTIVE' }]);
  assert.deepEqual(await campanaGuardada(id), [{ nombre: 'bofu - agendamiento', estado: 'ACTIVE' }]);

  /* El sello dice cuándo se la vio por última vez: una campaña que deja de aparecer no se borra, y
     este sello es lo único que la distingue de una vista hoy. Se lo envejece a mano para ver que la
     segunda lectura lo renueva. */
  await esc.admin.query(
    "update negocio.campanas set sincronizado_el = '2000-01-01' where meta_campana_id = $1",
    [id],
  );

  // Renombrada y pausada en Meta: la segunda lectura tiene que decir lo de hoy, no conservar lo de ayer.
  await pasadaConCampanas([{ id, nombre: 'bofu - agendamiento v2', estado: 'PAUSED' }]);
  assert.deepEqual(
    await campanaGuardada(id),
    [{ nombre: 'bofu - agendamiento v2', estado: 'PAUSED' }],
    'la segunda lectura no reescribió la campaña, o la duplicó',
  );
  const sello = await esc.admin.query<{ renovado: boolean }>(
    "select sincronizado_el > '2000-01-01' as renovado from negocio.campanas where meta_campana_id = $1",
    [id],
  );
  assert.equal(sello.rows[0]?.renovado, true, 'la segunda lectura no renovó el sello');
});

test('una lista con VARIAS campañas las guarda todas', async () => {
  // La cuenta lista 61: un escritor que guardara sólo la primera dejaría 60 sin nombre.
  const ids = [`${MARCA}m1`, `${MARCA}m2`, `${MARCA}m3`];
  await pasadaConCampanas(ids.map((id, i) => ({ id, nombre: `campaña ${i + 1}`, estado: 'ACTIVE' })));

  const r = await esc.admin.query<{ meta_campana_id: string; nombre: string | null }>(
    'select meta_campana_id, nombre from negocio.campanas where meta_campana_id = any($1) order by meta_campana_id',
    [ids],
  );
  assert.deepEqual(
    r.rows,
    ids.map((id, i) => ({ meta_campana_id: id, nombre: `campaña ${i + 1}` })),
    'no quedaron guardadas todas las campañas de la lista',
  );
});

test('una lectura SIN nombre no borra el que ya se sabía, y el estado se reescribe plano', async () => {
  /* La asimetría de la `065`: el nombre dice QUÉ ES la campaña y acumula; el estado dice CÓMO ESTÁ
     HOY, y uno viejo al lado de un sello nuevo afirmaría algo que nadie confirmó. Las dos mitades
     se comprueban en la misma prueba para que ninguna de las dos mutaciones sobreviva. */
  const id = `${MARCA}c2`;
  await pasadaConCampanas([{ id, nombre: 'tofu - reels', estado: 'ACTIVE' }]);
  await pasadaConCampanas([{ id, nombre: null, estado: null }]);

  assert.deepEqual(
    await campanaGuardada(id),
    [{ nombre: 'tofu - reels', estado: null }],
    'el nombre se borró con una lectura que no lo trajo, o el estado viejo sobrevivió',
  );
});

test('una campaña que nunca tuvo nombre se guarda con el nombre NULO, no con uno inventado', async () => {
  const id = `${MARCA}c3`;
  await pasadaConCampanas([{ id, nombre: null, estado: 'ACTIVE' }]);
  assert.deepEqual(await campanaGuardada(id), [{ nombre: null, estado: 'ACTIVE' }]);
});

// ─── EL AISLAMIENTO, QUE ES LO QUE `aplicar_aislamiento` PROMETE ────────────

test('las dos tablas nuevas respetan la organización activa', async () => {
  // `ADR-0206`: con la organización A no se ve ni una fila de la B. Las tablas se crearon con
  // `negocio.aplicar_aislamiento`, así que esto tendría que salir gratis — y por eso se comprueba:
  // una tabla de negocio a la que alguien olvide aplicarle el aislamiento se ve exactamente igual
  // hasta el día que un cliente lee los anuncios de otro.
  const id = `${MARCA}05`;
  await unaPasada([conEntrega(id)]);

  const { conOrganizacion, datos } = await import('../../lib/datos/contexto.ts');

  const propias = await conOrganizacion(esc.org, async () =>
    datos().selectFrom('anuncios').select('meta_anuncio_id').where('meta_anuncio_id', '=', id).execute(),
  );
  const ajenas = await conOrganizacion(esc.otraOrg, async () =>
    datos().selectFrom('anuncios').select('meta_anuncio_id').where('meta_anuncio_id', '=', id).execute(),
  );

  assert.equal(propias.length, 1, 'la organización dueña no ve su propio anuncio');
  assert.equal(ajenas.length, 0, 'la OTRA organización vio un anuncio que no es suyo');
});

test('las campañas también respetan la organización activa', async () => {
  // La tercera tabla del colector (`065`), con la misma comprobación que las dos de arriba.
  const id = `${MARCA}c4`;
  await pasadaConCampanas([{ id, nombre: 'mofu - casos', estado: 'ACTIVE' }]);

  const { conOrganizacion, datos } = await import('../../lib/datos/contexto.ts');

  const propias = await conOrganizacion(esc.org, async () =>
    datos().selectFrom('campanas').select('meta_campana_id').where('meta_campana_id', '=', id).execute(),
  );
  const ajenas = await conOrganizacion(esc.otraOrg, async () =>
    datos().selectFrom('campanas').select('meta_campana_id').where('meta_campana_id', '=', id).execute(),
  );

  assert.equal(propias.length, 1, 'la organización dueña no ve su propia campaña');
  assert.equal(ajenas.length, 0, 'la OTRA organización vio una campaña que no es suya');
});

// ─── EL GASTO DE TODA LA CUENTA (`076`) ──────────────────────────────────────
//
// Los escritores corren dentro de `conOrganizacion`; por eso van acá, por el mismo motivo que los dos ceros.

const CAMPANA = '120249633901590467';

async function enLaEmpresa<T>(f: () => Promise<T>): Promise<T> {
  const { conOrganizacion } = await import('../../lib/datos/contexto.ts');
  return conOrganizacion(esc.org, f);
}

async function filaDeLaCuenta(fecha: string) {
  const r = await esc.admin.query<{ gasto: string | null; cambio_el: Date | null; redescubierto_el: Date | null; residuo_el: Date | null }>(
    'select gasto, cambio_el, redescubierto_el, residuo_el from negocio.gasto_de_la_cuenta where org_id = $1 and fecha = $2',
    [esc.org, fecha],
  );
  return r.rows;
}

async function lecturaDe(campana: string, fecha: string) {
  const r = await esc.admin.query<{ gasto: string; por_rango: boolean }>(
    'select gasto, por_rango from negocio.lecturas_de_gasto where org_id = $1 and meta_campana_id = $2 and fecha = $3',
    [esc.org, campana, fecha],
  );
  return r.rows;
}

const diaDeLaCuenta = (dia: string, gasto: number | null) => ({
  dia,
  gasto,
  impresiones: 100,
  clics: 3,
  cpc: null,
  cpm: null,
  alcance: 90,
  frecuencia: null,
});

test('la serie de la cuenta se REESCRIBE, y `cambio_el` se marca sólo si el total se movió', async () => {
  /* Meta corrige hacia atrás: la lectura nueva es la buena. Un centavo de redondeo no es una corrección, y
     marcarla haría volver a pedir todo lo que gastó ese día. Mutación: `on conflict do nothing`, o marcar
     `cambio_el` en cada lectura. */
  const { guardarSerie } = await import('../../lib/negocio/recolectarAnuncios.ts');
  await enLaEmpresa(() => guardarSerie([diaDeLaCuenta('2026-10-01', 200.19)]));
  assert.deepEqual((await filaDeLaCuenta('2026-10-01')).map((f) => [f.gasto, f.cambio_el]), [['200.1900', null]]);

  await enLaEmpresa(() => guardarSerie([diaDeLaCuenta('2026-10-01', 200.25)]));
  const quieto = await filaDeLaCuenta('2026-10-01');
  assert.equal(quieto[0]?.gasto, '200.2500', 'la relectura no reescribió el total');
  assert.equal(quieto[0]?.cambio_el, null, 'seis centavos de redondeo se tomaron como una corrección');

  await esc.admin.query(
    `update negocio.gasto_de_la_cuenta set redescubierto_el = now(), residuo_el = now() where org_id = $1 and fecha = '2026-10-01'`,
    [esc.org],
  );
  await enLaEmpresa(() => guardarSerie([diaDeLaCuenta('2026-10-01', 236.86)]));
  const movido = await filaDeLaCuenta('2026-10-01');
  assert.ok(movido[0]?.cambio_el instanceof Date, 'una corrección de Meta no quedó marcada');
  assert.equal(movido[0]?.redescubierto_el, null, 'con otro total, el día merece otra vuelta');
  assert.equal(movido[0]?.residuo_el, null);
});

test('un cero de RANGO no pisa una lectura del día, y una lectura del día sí pisa un rango', async () => {
  // Mutación: el rango con `do update`. La lectura del día tiene sus métricas detrás y vale más que un total.
  const { guardar, guardarCeros } = await import('../../lib/negocio/recolectarAnuncios.ts');
  await enLaEmpresa(() => guardar(CAMPANA, '2026-10-02', [conEntrega(`${MARCA}20`)]));
  await enLaEmpresa(() => guardarCeros(CAMPANA, ['2026-10-02', '2026-10-03']));
  assert.deepEqual(await lecturaDe(CAMPANA, '2026-10-02'), [{ gasto: '69.5900', por_rango: false }]);
  assert.deepEqual(await lecturaDe(CAMPANA, '2026-10-03'), [{ gasto: '0.0000', por_rango: true }]);

  await enLaEmpresa(() => guardar(CAMPANA, '2026-10-03', [conEntrega(`${MARCA}21`)]));
  assert.deepEqual(await lecturaDe(CAMPANA, '2026-10-03'), [{ gasto: '69.5900', por_rango: false }]);
});

test('una lectura del día que vuelve VACÍA deja su cero: la campaña no queda pendiente', async () => {
  const { guardar } = await import('../../lib/negocio/recolectarAnuncios.ts');
  await enLaEmpresa(() => guardar(CAMPANA, '2026-10-04', []));
  assert.deepEqual(await lecturaDe(CAMPANA, '2026-10-04'), [{ gasto: '0.0000', por_rango: false }]);
});

test('redescubrir borra los CEROS del día, deja lo que gastó, y anota cuándo', async () => {
  // Mutación: borrar también lo que gastó (tiene métricas detrás), o no anotar (giraría cada hora).
  const { guardar, guardarCeros, guardarSerie, redescubrir } = await import('../../lib/negocio/recolectarAnuncios.ts');
  await enLaEmpresa(async () => {
    await guardarSerie([diaDeLaCuenta('2026-10-05', 100)]);
    await guardar(CAMPANA, '2026-10-05', [conEntrega(`${MARCA}22`)]);
    await guardarCeros('99999901', ['2026-10-05']);
    await guardar('99999902', '2026-10-05', []);
    await redescubrir('2026-10-05');
  });
  assert.equal((await lecturaDe(CAMPANA, '2026-10-05')).length, 1, 'se borró una lectura que gastó');
  assert.equal((await lecturaDe('99999901', '2026-10-05')).length, 0, 'el cero de rango no se borró');
  assert.equal((await lecturaDe('99999902', '2026-10-05')).length, 0, 'el cero del día no se borró');
  assert.ok((await filaDeLaCuenta('2026-10-05'))[0]?.redescubierto_el instanceof Date);

  // Y si después sigue sin cuadrar, se declara residuo: el día deja de buscarse.
  const { declararResiduo } = await import('../../lib/negocio/recolectarAnuncios.ts');
  await enLaEmpresa(() => declararResiduo('2026-10-05'));
  assert.ok((await filaDeLaCuenta('2026-10-05'))[0]?.residuo_el instanceof Date, 'el residuo no quedó anotado');
});

/** Una métrica del colector viejo, en un día fuera del tramo fijo de `AHORA`, sin su lectura. */
const VIEJO = '2026-08-20';
async function metricaVieja(): Promise<void> {
  const { guardar } = await import('../../lib/negocio/recolectarAnuncios.ts');
  await enLaEmpresa(() => guardar(CAMPANA, VIEJO, [conEntrega(`${MARCA}24`)]));
  await esc.admin.query('delete from negocio.lecturas_de_gasto where org_id = $1', [esc.org]);
}

test('la primera pasada pasa a lecturas los pares que el colector viejo ya leyó, una sola vez', async () => {
  /* La migración no puede hacerlo: con RLS el migrador ve cero filas. Mutación: no sembrar (los ~600 pares
     viejos se volverían a pedir), o sembrar en cada pasada (un redescubrimiento se desharía solo). Y sin el plan
     inyectado: con él la siembra no corría, y un `insert` sin `org_id` que la RLS rechazaba pasó sin verse. */
  await metricaVieja();
  await recolectarAnuncios(esc.org, ACCESO, { ...SIN_RED, ahora: AHORA, pedir: async () => ({ tipo: 'datos', datos: [] }) });
  assert.deepEqual(await lecturaDe(CAMPANA, VIEJO), [{ gasto: '69.5900', por_rango: false }]);

  await esc.admin.query(`delete from negocio.lecturas_de_gasto where org_id = $1 and fecha = $2`, [esc.org, VIEJO]);
  await recolectarAnuncios(esc.org, ACCESO, {
    ...SIN_RED,
    ahora: AHORA,
    pedir: async () => ({ tipo: 'datos', datos: [] }),
  });
  assert.equal((await lecturaDe(CAMPANA, VIEJO)).length, 0, 'se volvieron a sembrar lecturas con la empresa ya sembrada');
});

test('el relleno también siembra las lecturas viejas antes de buscar: si corre primero, no repide lo leído', async () => {
  /* Después del despliegue el relleno puede correr antes que la pasada diaria. Sin la siembra buscaría con rangos
     —y releería de a un día— los pares que el colector viejo ya leyó. Mutación: leer la foto sin sembrar. */
  await metricaVieja();
  const { rellenarAnuncios } = await import('../../lib/negocio/rellenarAnuncios.ts');
  const nada = async () => {};
  await rellenarAnuncios(esc.org, ACCESO, Date.now(), Date.now, {
    vinculo: SIN_RED.vinculo,
    serie: SIN_RED.serie,
    escribirSerie: nada,
    pedir: async () => ({ tipo: 'datos', datos: [] }),
    escribir: nada,
    total: async () => ({ tipo: 'datos', datos: { gasto: 0, anuncios: 0 } }),
    escribirCeros: nada,
    redescubrir: nada,
    declararResiduo: nada,
  });
  assert.deepEqual(await lecturaDe(CAMPANA, VIEJO), [{ gasto: '69.5900', por_rango: false }], 'el relleno no sembró las lecturas del colector viejo');
});

test('el plan de la pasada: las campañas ACTIVE y las que gastaron en la última semana, no las demás', async () => {
  /* La campaña de mensajes no tenía anuncios ni contactos: con el universo de la atribución no se pedía nunca.
     Mutación: armar las candidatas desde la atribución, o sacar las que gastaron hace poco. */
  const activa = '99999931';
  const pausadaAyer = '99999932';
  const pausadaVieja = '99999933';
  await esc.admin.query(
    `insert into negocio.campanas (org_id, meta_campana_id, nombre, estado)
     values ($1, $2, 'activa', 'ACTIVE'), ($1, $3, 'pausada ayer', 'PAUSED'), ($1, $4, 'pausada vieja', 'PAUSED')`,
    [esc.org, activa, pausadaAyer, pausadaVieja],
  );
  try {
    const { guardarCeros } = await import('../../lib/negocio/recolectarAnuncios.ts');
    // Una lectura cualquiera, para que la siembra de las viejas no corra; y el gasto de ayer.
    await enLaEmpresa(() => guardarCeros(pausadaVieja, ['2026-09-01']));
    await esc.admin.query(
      `insert into negocio.lecturas_de_gasto (org_id, meta_campana_id, fecha, gasto, por_rango) values ($1, $2, '2026-09-15', 12, false)`,
      [esc.org, pausadaAyer],
    );
    const pedidas = new Set<string>();
    await recolectarAnuncios(esc.org, ACCESO, {
      ...SIN_RED,
      ahora: AHORA,
      pedir: async (_a, campana) => {
        pedidas.add(campana);
        return { tipo: 'datos', datos: [] };
      },
    });
    assert.ok(pedidas.has(activa), 'no se pidió la campaña ACTIVE');
    assert.ok(pedidas.has(pausadaAyer), 'no se pidió la que gastó ayer');
    assert.ok(!pedidas.has(pausadaVieja), 'se pidió una pausada que no gasta hace más de una semana');
  } finally {
    await esc.admin.query('delete from negocio.campanas where meta_campana_id in ($1, $2, $3)', [activa, pausadaAyer, pausadaVieja]);
  }
});

test('el gasto de la cuenta y las lecturas respetan la organización activa', async () => {
  // Las dos tablas de la `076`, con la misma comprobación que las de arriba.
  const { guardarCeros, guardarSerie } = await import('../../lib/negocio/recolectarAnuncios.ts');
  await enLaEmpresa(async () => {
    await guardarSerie([diaDeLaCuenta('2026-09-30', 50)]);
    await guardarCeros(CAMPANA, ['2026-09-30']);
  });
  const { conOrganizacion, datos } = await import('../../lib/datos/contexto.ts');
  const ver = (org: string) =>
    conOrganizacion(org, async () => ({
      cuenta: (await datos().selectFrom('gasto_de_la_cuenta').select('fecha').where('fecha', '=', '2026-09-30' as never).execute()).length,
      lecturas: (await datos().selectFrom('lecturas_de_gasto').select('fecha').where('fecha', '=', '2026-09-30' as never).execute()).length,
    }));
  assert.deepEqual(await ver(esc.org), { cuenta: 1, lecturas: 1 }, 'la empresa dueña no ve lo suyo');
  assert.deepEqual(await ver(esc.otraOrg), { cuenta: 0, lecturas: 0 }, 'la OTRA empresa vio el gasto de esta');
});

test('la foto del relleno lee las fechas como texto y los montos como números', async () => {
  /* Un `date` que pasa por un `Date` de JavaScript se corre un día al este de Greenwich: con la suite en
     Asia/Tokyo, la foto pondría cada lectura en el día anterior. Mutación: leer `fecha` sin `to_char`. */
  const { guardarCeros, guardarSerie } = await import('../../lib/negocio/recolectarAnuncios.ts');
  const { fotoDelRelleno } = await import('../../lib/negocio/rellenarAnuncios.ts');
  await enLaEmpresa(async () => {
    await guardarSerie([diaDeLaCuenta('2026-09-28', 12.5), diaDeLaCuenta('2026-09-29', 0)]);
    await guardarCeros(CAMPANA, ['2026-09-29']);
  });
  const f = await enLaEmpresa(() => fotoDelRelleno('2026-09-29'));
  // El primer día es el más viejo de la serie o de las métricas: las pruebas de arriba dejaron métricas antes.
  const primero = await esc.admin.query<{ d: string }>(
    `select to_char(least((select min(fecha) from negocio.gasto_de_la_cuenta where org_id = $1),
                          (select min(fecha) from negocio.metricas_de_anuncio where org_id = $1)), 'YYYY-MM-DD') as d`,
    [esc.org],
  );
  assert.equal(f.inicio, primero.rows[0]!.d);
  assert.ok(f.inicio! <= '2026-09-28', 'el primer día no miró las métricas');
  assert.equal(f.serie.get('2026-09-28')?.gasto, 12.5);
  assert.equal(f.lecturas.get(CAMPANA)?.get('2026-09-29')?.gasto, 0);
  assert.equal(f.lecturas.get(CAMPANA)?.get('2026-09-29')?.porRango, true);
});
