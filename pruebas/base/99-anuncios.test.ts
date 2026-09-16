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

async function limpiar(): Promise<void> {
  // Primero el hecho y después la dimensión: la foránea es `on delete cascade`, pero borrar en este
  // orden deja la prueba correcta aunque alguien cambie la cascada.
  await esc.admin.query('delete from negocio.metricas_de_anuncio where meta_anuncio_id like $1', [`${MARCA}%`]);
  await esc.admin.query('delete from negocio.anuncios where meta_anuncio_id like $1', [`${MARCA}%`]);
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
    leadsDeMeta: 0,
    resultadosDeMeta: 0,
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

/** El único día en que el proveedor falso devuelve algo. Ver `unaPasada`. */
const DIA = '2026-09-14';

/**
 * Corre una pasada que escribe **UNA sola vez**.
 *
 * ── POR QUÉ UN SOLO DÍA, Y NO ES DETALLE DE ARMADO ────────────────────────
 *
 * La ventana normal son cuatro días (hoy más `DIAS_QUE_SE_RELEEN`), así que un proveedor falso que
 * devuelva la misma fila todos los días la escribe cuatro veces: **una inserción y tres
 * correcciones**. Y entonces un defecto que viva SÓLO en el camino de inserción queda tapado por la
 * corrección que viene detrás.
 *
 * No es hipotético: se midió por mutación. Poner `meta_conjunto_id: null` en el `insert` dejaba esta
 * suite entera en verde, porque el `on conflict` del día siguiente reponía el valor correcto.
 */
async function unaPasada(metricas: readonly MetricaDeAnuncio[]) {
  return recolectarAnuncios(esc.org, ACCESO, {
    ahora: AHORA,
    campanas: ['120249633901590467'],
    ultimoDia: '2026-09-16',
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
  }>(
    `select fecha, gasto, impresiones, clics, alcance, ctr, cpc, frecuencia
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
