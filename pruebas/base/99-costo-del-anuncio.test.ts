// El costo por anuncio y el monitor de atribución, contra la base de verdad. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO MÁS CARO DE ESTE MÓDULO NO FALLA: DEVUELVE UN NÚMERO MÁS GRANDE
//
// `costoDelAnuncio` cruza dos hechos de GRANO DISTINTO: el gasto vive por (anuncio, día) y los
// leads viven por contacto. Unirlos en una sola consulta —que es lo natural, y lo que hace
// cualquiera que mire los dos `select` y piense «esto es un join»— multiplica las filas: cada día
// con métricas aparece una vez por cada lead, y **la suma del gasto queda multiplicada por la
// cantidad de leads**.
//
// No lanza, no avisa y no se ve. Un anuncio con 44 leads y 45 de gasto publicaría 1.980, que es una
// cifra perfectamente creíble para una cuenta que gasta 1.746 en treinta días.
//
// Por eso la primera prueba de este archivo siembra **dos días de gasto y tres leads** sobre el
// mismo anuncio: son los dos multiplicadores a la vez, y el producto (6 × el gasto diario) no se
// parece a la suma correcta (2 ×).
//
// ── Y LA SEGUNDA COSA QUE ESTE ARCHIVO PROTEGE ────────────────────────────
//
// Las tres derivadas —CPM, CPC y CTR— se calculan **sobre las sumas** y no promediando lo que el
// proveedor mandó por día. Promediar le da el mismo peso a un día de cien impresiones y a uno de
// cien mil, y el resultado no es el CPM de la ventana: es el promedio de N números. La diferencia
// se ve con dos días desparejos, que es como están sembrados acá.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { costoDelAnuncio } from '../../lib/negocio/costoDelAnuncio.ts';
import { calidadDeLaAtribucion } from '../../lib/negocio/calidadDeLaAtribucion.ts';
import { PISO_DE_UNA_TASA } from '../../lib/negocio/indicadoresDeCitas.ts';

let esc: Escenario;

/** El prefijo de todo lo sembrado acá. Es lo que borra `limpiar`. */
const MARCA = '88888800';
const CONTACTO = 'costoads-';

async function limpiar(): Promise<void> {
  await esc.admin.query(
    'delete from negocio.citas where contacto_id in (select id from negocio.contactos where ghl_contact_id like $1)',
    [`${CONTACTO}%`],
  );
  await esc.admin.query('delete from negocio.contactos where ghl_contact_id like $1', [`${CONTACTO}%`]);
  await esc.admin.query('delete from negocio.metricas_de_anuncio where meta_anuncio_id like $1', [`${MARCA}%`]);
  await esc.admin.query('delete from negocio.anuncios where meta_anuncio_id like $1', [`${MARCA}%`]);
}

before(async () => {
  esc = await montar('CostoAds');
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

/** Un anuncio en la dimensión. */
async function unAnuncio(id: string, nombre: string): Promise<void> {
  await esc.admin.query(
    `insert into negocio.anuncios (org_id, meta_anuncio_id, meta_conjunto_id, meta_campana_id, nombre, objetivo)
       values ($1, $2, '7700', '8800', $3, 'OUTCOME_LEADS')`,
    [esc.org, id, nombre],
  );
}

/** Un día de métricas. `null` en las siete = el anuncio no entregó ese día. */
async function unDia(
  id: string,
  hace: number,
  m: { gasto: number; impresiones: number; clics: number } | null,
): Promise<void> {
  await esc.admin.query(
    `insert into negocio.metricas_de_anuncio
       (org_id, meta_anuncio_id, fecha, gasto, impresiones, clics, alcance, ctr, cpc, frecuencia)
     values ($1, $2, current_date - $3::int, $4, $5, $6, null, null, null, null)`,
    [esc.org, id, hace, m?.gasto ?? null, m?.impresiones ?? null, m?.clics ?? null],
  );
}

/**
 * Un contacto con UTM INCOMPLETAS: trae tres de las cinco que el § 18.5 pide conservar.
 *
 * Existe porque sin él el punto invertido del monitor no se puede distinguir del normal: con cero
 * sesiones con UTM los dos callan, y una mutación que los alinee deja la suite en verde. Medido.
 */
async function unLeadConUtmRotas(): Promise<void> {
  await esc.admin.query(
    `insert into negocio.contactos (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, atribucion_primera)
       values ($1, $2, 'Lead con UTM rotas', 'setter', now() - interval '1 day', $3::jsonb)`,
    [
      esc.org,
      `${CONTACTO}${randomUUID().slice(0, 8)}`,
      JSON.stringify({ sessionSource: 'Paid Social', utmSource: 'fb', utmMedium: 'cpc', utmCampaign: 'x' }),
    ],
  );
}

/** Y uno con las CINCO, que es lo que hace que el conteo de rotas no sea el total. */
async function unLeadConUtmCompletas(): Promise<void> {
  await esc.admin.query(
    `insert into negocio.contactos (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, atribucion_primera)
       values ($1, $2, 'Lead con UTM completas', 'setter', now() - interval '1 day', $3::jsonb)`,
    [
      esc.org,
      `${CONTACTO}${randomUUID().slice(0, 8)}`,
      JSON.stringify({
        sessionSource: 'Paid Social',
        utmSource: 'fb',
        utmMedium: 'cpc',
        utmCampaign: 'x',
        utmContent: 'creativo-1',
        utmTerm: '7700',
      }),
    ],
  );
}

/** Un contacto atribuido a un anuncio, con o sin cita. */
async function unLead(anuncioId: string | null, conCita: boolean, medium = 'facebook'): Promise<void> {
  const ghl = `${CONTACTO}${randomUUID().slice(0, 8)}`;
  const atribucion =
    anuncioId === null
      ? JSON.stringify({ sessionSource: 'Paid Social', medium })
      : JSON.stringify({ sessionSource: 'Paid Social', medium, adId: anuncioId, campaignId: '8800' });

  const r = await esc.admin.query<{ id: string }>(
    `insert into negocio.contactos (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, atribucion_primera)
       values ($1, $2, 'Lead de prueba', 'setter', now() - interval '1 day', $3::jsonb) returning id`,
    [esc.org, ghl, atribucion],
  );
  if (!conCita) return;

  await esc.admin.query(
    `insert into negocio.citas (org_id, contacto_id, ghl_evento_id, ghl_calendario_id, inicio_el, fin_el, estado_ghl)
       values ($1, $2, $3, 'cal-costoads', now() - interval '2 hours', now() - interval '1 hour', 'confirmed')`,
    [esc.org, r.rows[0]?.id, `cita-${ghl}`],
  );
}

const leer = (dias = 30) => conOrganizacion(esc.org, () => costoDelAnuncio(dias));

// ─── EL GRANO ───────────────────────────────────────────────────────────────

test('el gasto NO se multiplica por la cantidad de leads', async () => {
  const id = `${MARCA}01`;
  await unAnuncio(id, 'El de los dos granos');
  // Dos días de gasto y TRES leads: los dos multiplicadores a la vez.
  await unDia(id, 1, { gasto: 10, impresiones: 1000, clics: 20 });
  await unDia(id, 2, { gasto: 15, impresiones: 2000, clics: 10 });
  for (let i = 0; i < 3; i += 1) await unLead(id, false);

  const fila = (await leer()).filas.find((f) => f.anuncioId === id);
  assert.ok(fila, 'el anuncio no apareció');

  assert.equal(fila.gasto, 25, 'la suma correcta es 10 + 15; un join de dos granos daría 75');
  // Y la comprobación que hace que la de arriba no sea una coincidencia: el producto sería 75, que
  // es un número perfectamente creíble. Se nombra para que la aserción diga qué está descartando.
  assert.notEqual(fila.gasto, 25 * fila.leads, 'el gasto quedó multiplicado por la cantidad de leads');
  assert.equal(fila.impresiones, 3000);
  assert.equal(fila.clics, 30);
  assert.equal(fila.leads, 3);
});

// ─── LAS DERIVADAS ──────────────────────────────────────────────────────────

test('CPM, CPC y CTR se calculan sobre las SUMAS, no promediando los días', async () => {
  // Los dos días de arriba son deliberadamente desparejos:
  //   día 1  →  CPM 10,00 · CTR 2,0 %
  //   día 2  →  CPM  7,50 · CTR 0,5 %
  // El promedio de los CPM diarios da 8,75 y el de la ventana da 8,33. El de los CTR da 1,25 % y el
  // de la ventana da 1,0 %. Los dos pares son distintos, que es lo que hace útil a esta prueba.
  const fila = (await leer()).filas.find((f) => f.anuncioId === `${MARCA}01`);
  assert.ok(fila);

  assert.equal(fila.cpm, 8.33, '25 / 3000 × 1000 = 8,33 — el promedio de los días daría 8,75');
  assert.equal(fila.cpc, 0.8333, '25 / 30');
  assert.equal(fila.ctr, 1, '30 / 3000 — el promedio de los días daría 1,25');
});

// ─── LOS DOS CEROS, OTRA VEZ, PERO EN EL AGREGADO ──────────────────────────

test('un anuncio que no entregó NINGÚN día tiene gasto NULO, no cero', async () => {
  // `sum()` de puros nulos devuelve NULL, y eso es exactamente lo que hace falta: la fila tiene que
  // poder decir «no entregó» y no «gastó cero». Un `coalesce(sum(...), 0)` en la consulta —que es lo
  // que alguien agrega para «limpiar» el resultado— rompe la distinción y además lo pone arriba en
  // cualquier orden ascendente por gasto.
  const id = `${MARCA}02`;
  await unAnuncio(id, 'El que no corrió');
  await unDia(id, 1, null);
  await unDia(id, 2, null);

  const fila = (await leer()).filas.find((f) => f.anuncioId === id);
  assert.ok(fila);
  assert.equal(fila.gasto, null, 'gastó cero y no entregó son dos hechos distintos');
  assert.equal(fila.cpm, null, 'sin gasto no hay CPM que calcular');
  assert.equal(fila.diasConEntrega, 0, 'dos días guardados y cero con entrega');
});

test('`diasConEntrega` cuenta los días con gasto, no los días guardados', async () => {
  // Es el denominador honesto de cualquier promedio diario. Contar filas diría que un anuncio que
  // corrió un día de siete «promedió» su gasto en siete, y su gasto diario saldría siete veces menor.
  const id = `${MARCA}03`;
  await unAnuncio(id, 'El intermitente');
  await unDia(id, 1, { gasto: 30, impresiones: 3000, clics: 60 });
  await unDia(id, 2, null);
  await unDia(id, 3, null);

  const fila = (await leer()).filas.find((f) => f.anuncioId === id);
  assert.ok(fila);
  assert.equal(fila.diasConEntrega, 1, 'tres días guardados, uno con entrega');
  assert.equal(fila.gasto, 30, 'los días sin entrega no suman cero: no participan');
});

// ─── EL PISO, Y LA EXCEPCIÓN DEL CPL ───────────────────────────────────────

test('la tasa de agenda respeta el piso; el CPL se publica con UN lead', async () => {
  /* Las dos mitades son la misma decisión mirada de los dos lados.
   *
   * `tasaDeAgenda` es una PROPORCIÓN: con un lead vale 0 % o 100 %, y con el segundo salta a 50 %.
   * No es una tasa, es un número que se mueve cincuenta puntos por fila.
   *
   * `cpl` NO es una proporción: «gastamos 30 y entró uno» es un hecho exacto sobre lo que ya pasó.
   * Lo que sí sería malo es leerlo como predicción, y eso lo resuelve `leads` viajando al lado. */
  const id = `${MARCA}03`;
  await unLead(id, true);

  const fila = (await leer()).filas.find((f) => f.anuncioId === id);
  assert.ok(fila);
  assert.equal(fila.leads, 1);
  assert.ok(fila.leads < PISO_DE_UNA_TASA, 'la prueba pierde sentido si el piso baja a 1');
  assert.equal(fila.tasaDeAgenda, null, 'una proporción sobre un lead no se publica');
  assert.equal(fila.cpl, 30, 'el CPL sí: es un hecho, no una estimación');
});

// ─── LO QUE NO SE PUEDE ESCONDER ───────────────────────────────────────────

test('un anuncio que trajo leads y NO tiene gasto guardado aparece igual', async () => {
  // Omitirlo daría una tabla donde la suma de leads no llega al total de la cobertura, y el lector
  // no tendría cómo notarlo: no hay ninguna fila que diga «acá falta algo».
  const id = `${MARCA}04`;
  await unAnuncio(id, 'El sin métricas');
  await unLead(id, false);

  const r = await leer();
  const fila = r.filas.find((f) => f.anuncioId === id);
  assert.ok(fila, 'el anuncio con leads y sin gasto desapareció de la tabla');
  assert.equal(fila.gasto, null);
  assert.equal(fila.leads, 1);
});

test('la cobertura viaja con sus DOS términos, y cuenta a los que no traen anuncio', async () => {
  // Una proporción sola se lee como precisión. El par dice de cuántos habla — y es la única forma de
  // cumplir el § 18.5, que pide publicar la cobertura al lado de la conclusión y no en una nota.
  await unLead(null, false, 'External Form');
  await unLead(null, true, 'calendar');

  const r = await leer();
  assert.ok(r.cobertura.sobre >= r.cobertura.con, 'la cobertura no puede pasar del total');
  assert.ok(r.cobertura.sobre > r.cobertura.con, 'los dos leads sin anuncio tienen que contar en el total');
  assert.match(String(r.aviso), /no traen anuncio|falta el gasto/, 'con cobertura incompleta el aviso no puede callar');
});

// ─── EL MONITOR DE ATRIBUCIÓN ──────────────────────────────────────────────

test('el monitor cuenta las UTM incompletas AL REVÉS que los otros cuatro puntos', async () => {
  /* ══ POR QUÉ ESTA PRUEBA TIENE DOS FASES, Y LA PRIMERA ES LA QUE IMPORTA ═══
   *
   * Cuatro puntos cuentan lo que SÍ está y hablan cuando falta; éste cuenta lo que está ROTO y habla
   * cuando hay algo. Si los cinco fueran en la misma dirección, un 100 % significaría «todo bien» en
   * cuatro y «todo roto» en uno, y la misma barra en pantalla diría dos cosas opuestas.
   *
   * ── Y LA FORMA DE MEDIRLO NO ES LA OBVIA ──────────────────────────────────
   *
   * El primer intento sembró UNA sesión rota de once y afirmó que el punto hablaba. **La mutación
   * sobrevivió**, y con razón: una rota sobre once es el 9 %, y la lógica normal pregunta «¿está por
   * debajo del 90 %?» — o sea que también habla. Las dos direcciones dicen lo mismo en ese punto.
   *
   * Lo que las separa es el SILENCIO. Con cero rotas, el punto invertido calla y el normal grita
   * «0 % de cobertura». Por eso la fase 1 siembra once sesiones sanas y afirma que no hay nada que
   * decir — que es además la regla del silencio de este proyecto aplicada a un monitor.
   *
   * La fase 2 es el control: con diez rotas de doce, la cobertura es del 17 % y el punto habla. Sin
   * ella, un monitor que nunca hablara pasaría la fase 1. ════════════════════════════ */

  // ── Fase 1 · nada roto ⟹ NADA que decir ─────────────────────────────────
  for (let i = 0; i < 11; i += 1) await unLeadConUtmCompletas();

  const sano = await conOrganizacion(esc.org, () => calidadDeLaAtribucion(30));
  const utmSano = sano.puntos.find((p) => p.clave === 'utm_incompletas');
  assert.ok(utmSano);
  assert.equal(utmSano.cuantos, 0, 'la siembra tenía que dejar cero UTM rotas');
  assert.equal(utmSano.sobre, 11, 'once sesiones con alguna UTM');
  assert.equal(utmSano.proporcion, 0, 'cero rotas sobre once ES cero, y se mide: no es «no se sabe»');
  assert.equal(
    utmSano.consecuencia,
    null,
    'con cero UTM rotas el punto tiene que callar; la lógica de los otros cuatro gritaría «0 % de cobertura»',
  );

  // ── Fase 2 · el control, para que callar siempre no alcance ──────────────
  for (let i = 0; i < 10; i += 1) await unLeadConUtmRotas();

  const roto = await conOrganizacion(esc.org, () => calidadDeLaAtribucion(30));
  const utmRoto = roto.puntos.find((p) => p.clave === 'utm_incompletas');
  const leads = roto.puntos.find((p) => p.clave === 'leads_con_anuncio');
  assert.ok(utmRoto && leads);

  assert.equal(utmRoto.cuantos, 10);
  assert.equal(utmRoto.sobre, 21);
  assert.ok(utmRoto.consecuencia !== null, 'con diez UTM rotas el punto tiene que hablar');

  // Y el punto NORMAL sigue la cobertura, que es la dirección contraria.
  assert.ok(leads.sobre > 0, 'no hay contactos en la ventana: la prueba no mide nada');
  assert.equal(
    leads.consecuencia !== null,
    leads.proporcion !== null && leads.cuantos / leads.sobre < 0.9,
    'la consecuencia del punto normal tiene que seguir a la cobertura',
  );
});

test('la consecuencia NOMBRA la UTM que falta, no dice sólo que falta alguna', async () => {
  /* ══ ESTA PRUEBA SALIÓ DE MIRAR LA CIFRA REAL ═══════════════════════════════
   *
   * Contra producción el punto daba **360 de 360**, o sea que ni un contacto trae las cinco UTM. Un
   * 100 % alarma y no dice qué hacer, así que había que ir a ver: medido el 2026-09-16 sobre 384
   * contactos, `utmSource` llega en 359, `utmMedium` en 358, `utmContent` en 356, `utmTerm` en 140
   * y **`utmCampaign` en CERO**.
   *
   * Ése es el hallazgo: no están «incompletas», falta UNA y falta siempre. Y la diferencia entre las
   * dos frases es la diferencia entre un número que asusta y algo que alguien puede arreglar.
   *
   * Acá se siembran sesiones a las que les falta `utmTerm` y sólo ésa, para que la frase tenga que
   * elegir la correcta entre cinco candidatas. ═════════════════════════════════ */
  for (let i = 0; i < 12; i += 1) {
    await esc.admin.query(
      `insert into negocio.contactos (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, atribucion_primera)
         values ($1, $2, 'Lead sin utmTerm', 'setter', now() - interval '1 day', $3::jsonb)`,
      [
        esc.org,
        `${CONTACTO}${randomUUID().slice(0, 8)}`,
        JSON.stringify({
          sessionSource: 'Paid Social',
          utmSource: 'fb',
          utmMedium: 'cpc',
          utmCampaign: 'x',
          utmContent: 'creativo-1',
        }),
      ],
    );
  }

  const r = await conOrganizacion(esc.org, () => calidadDeLaAtribucion(30));
  const utm = r.puntos.find((p) => p.clave === 'utm_incompletas');
  assert.ok(utm?.consecuencia, 'con UTM faltantes el punto tiene que hablar');

  assert.match(utm.consecuencia, /utmTerm/, 'la consecuencia no nombra la UTM que falta');
  assert.doesNotMatch(
    utm.consecuencia,
    /utmSource|utmMedium|utmContent/,
    'nombró una UTM que sí llega: la frase tiene que señalar la que MENOS llega, no cualquiera',
  );
});

test('los dos puntos que NO se pueden medir viajan con su motivo', async () => {
  // Es lo que impide que alguien los vuelva a investigar dentro de seis meses. Los dos tienen un
  // motivo concreto y medido, no un «pendiente».
  const r = await conOrganizacion(esc.org, () => calidadDeLaAtribucion(30));

  assert.equal(r.fueraDeAlcance.length, 2);
  assert.match(r.fueraDeAlcance[0]?.porque ?? '', /nuestro conteo de contactos/);
  assert.match(r.fueraDeAlcance[1]?.porque ?? '', /se reescriben en cada pasada/);
});

test('una proporción bajo el piso viaja NULA, con sus conteos intactos', async () => {
  // El conteo es un hecho aunque la proporción no lo sea. Devolver `0` en vez de `null` diría que se
  // midió y dio cero, que es la confusión que este proyecto persigue en todas partes.
  const r = await conOrganizacion(esc.org, () => calidadDeLaAtribucion(30));

  for (const p of r.puntos) {
    if (p.sobre < PISO_DE_UNA_TASA) {
      assert.equal(p.proporcion, null, `${p.clave} publicó una proporción sobre ${p.sobre}`);
    } else {
      assert.ok(typeof p.proporcion === 'number', `${p.clave} escondió una proporción que sí se puede dar`);
    }
  }
});
