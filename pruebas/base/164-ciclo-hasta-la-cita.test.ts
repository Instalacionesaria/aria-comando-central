// El ciclo del alta a la primera cita, contra la base de verdad. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA MEDIA ES PEOR QUE EL p90, Y ESO SE MIDIÓ
//
// Medido contra producción el 2026-09-21 sobre los 197 contactos con primera cita:
//
//     mediana (p50)      2,86 días
//     p90               10,62 días
//     promedio          16,47 días   ← MÁS ALTO QUE EL p90
//
// **El promedio está por encima de nueve de cada diez casos.** Lo arrastran 14 contactos de más de
// un mes, uno de 290 días. Así que la mediana no es una preferencia de estilo: el promedio describe
// a catorce de ciento noventa y siete.
//
// ── LOS DOS SESGOS QUE ESTE ARCHIVO PROTEGE ────────────────────────────────
//
//  1 · **La censura.** 369 de 566 contactos nunca agendaron. Un `coalesce(primera_cita, now())` los
//      mete como «esperando» y mueve la mediana sin que nada falle.
//  2 · **El techo de la ventana.** Con «7 días» la mediana no puede pasar de 7, así que ese botón
//      produce siempre un ciclo excelente. Medido: a 30 días el p90 da 6,2 y sobre la base entera
//      10,6 — la ventana recorta un 40 % y nada lo indica.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { cicloHastaLaCita } from '../../lib/negocio/cicloHastaLaCita.ts';
import { PISO_DE_UNA_TASA } from '../../lib/negocio/indicadoresDeCitas.ts';

let esc: Escenario;

const CONTACTO = 'ciclo-';

async function limpiar(): Promise<void> {
  await esc.admin.query(
    'delete from negocio.citas where contacto_id in (select id from negocio.contactos where ghl_contact_id like $1)',
    [`${CONTACTO}%`],
  );
  await esc.admin.query('delete from negocio.contactos where ghl_contact_id like $1', [`${CONTACTO}%`]);
}

/**
 * Un contacto con alta hace `altaHaceDias` y, opcionalmente, citas.
 *
 * `citasHaceDias` son negativas para el futuro. El ciclo de cada cita es
 * `altaHaceDias - citaHaceDias`, y el módulo tiene que quedarse con el MENOR.
 */
async function unContacto(o: {
  altaHaceDias: number;
  citasHaceDias?: number[];
  congelada?: boolean;
}): Promise<void> {
  const ghl = `${CONTACTO}${randomUUID().slice(0, 8)}`;
  const r = await esc.admin.query<{ id: string }>(
    `insert into negocio.contactos (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm)
       values ($1, $2, 'Lead de prueba', 'closer', now() - make_interval(secs => $3::float8))
     returning id`,
    [esc.org, ghl, o.altaHaceDias * 86_400],
  );
  for (const [i, hace] of (o.citasHaceDias ?? []).entries()) {
    await esc.admin.query(
      `insert into negocio.citas
         (org_id, contacto_id, ghl_evento_id, ghl_calendario_id, inicio_el, fin_el, estado_ghl)
       values ($1, $2, $3, $4,
               now() - make_interval(secs => $5::float8),
               now() - make_interval(secs => $5::float8) + interval '1 hour', 'confirmed')`,
      [esc.org, r.rows[0]!.id, `cita-${ghl}-${i}`, o.congelada ? null : 'cal-ciclo', hace * 86_400],
    );
  }
}

const leer = (dias = 30) => conOrganizacion(esc.org, () => cicloHastaLaCita(dias));

before(async () => {
  esc = await montar('CicloHastaLaCita');
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

// ─── LA MEDIANA Y NO EL PROMEDIO ──────────────────────────────────────────────

test('publica la MEDIANA, no el promedio: una cola larga no mueve la cifra', async () => {
  /* Nueve contactos que agendaron en 2 días y uno que tardó 290. La mediana da 2; el promedio da
     **30,8**. Son quince veces, y el mutante que devuelve `avg` da un número perfectamente creíble.
     *
     * Es la misma forma del defecto que se midió en producción, donde el promedio (16,47) queda por
     * encima del p90 (10,62). */
  await limpiar();
  for (let i = 0; i < 9; i += 1) await unContacto({ altaHaceDias: 300, citasHaceDias: [298] });
  await unContacto({ altaHaceDias: 300, citasHaceDias: [10] });

  const r = await leer(3650);

  assert.equal(r.cobertura.con, 10);
  assert.equal(r.p50, 2, `salió ${r.p50}: el promedio de esta siembra da 30,8`);
});

test('el promedio NO VIAJA en la respuesta', async () => {
  /* Prueba de forma, y existe por un motivo concreto: si el campo no está en el tipo, no se puede
     dibujar por descuido. Mata «agregar `promedio` por si acaso», que es cómo el defecto vuelve
     después de arreglado. */
  await limpiar();
  for (let i = 0; i < PISO_DE_UNA_TASA; i += 1) await unContacto({ altaHaceDias: 10, citasHaceDias: [8] });

  const r = await leer();

  for (const prohibido of ['promedio', 'media', 'avg', 'mean']) {
    assert.equal(
      prohibido in (r as unknown as Record<string, unknown>),
      false,
      `la respuesta trae \`${prohibido}\`: alguien puede dibujarlo sin querer`,
    );
  }
});

test('el p90 viaja al lado del p50: solo los dos juntos dicen la verdad', async () => {
  /* Es el precedente de `indicadoresDelLead.ts:52-68`. Medido en producción, el p90 es 3,7 veces el
     p50: publicar sólo la mediana diría «agendan en tres días» de un negocio donde uno de cada diez
     tarda más de diez.
     *
     * La siembra lo exagera a propósito para que los dos no puedan coincidir por casualidad. */
  await limpiar();
  for (let i = 0; i < 9; i += 1) await unContacto({ altaHaceDias: 100, citasHaceDias: [98] });
  for (let i = 0; i < 1; i += 1) await unContacto({ altaHaceDias: 100, citasHaceDias: [60] });

  const r = await leer(3650);

  assert.equal(r.p50, 2);
  assert.ok(r.p90 !== null && r.p90 > r.p50!, `el p90 (${r.p90}) no es mayor que el p50 (${r.p50})`);
});

// ─── LA CENSURA ───────────────────────────────────────────────────────────────

test('los que no agendaron NO entran como cero ni como espera: se cuentan aparte', async () => {
  /* El sesgo más grande y el más fácil de esconder. Cinco que agendaron en 3 días y cien que no
     agendaron: la mediana sigue en 3 y los cien se declaran.
     *
     * El mutante `coalesce(primera_cita, now())` los mete como esperas largas y la mediana se va a
     * los cientos de días. */
  await limpiar();
  for (let i = 0; i < PISO_DE_UNA_TASA; i += 1) await unContacto({ altaHaceDias: 10, citasHaceDias: [7] });
  for (let i = 0; i < 100; i += 1) await unContacto({ altaHaceDias: 200 });

  const r = await leer(3650);

  assert.equal(r.p50, 3, `salió ${r.p50}: los que no agendaron entraron en la cifra`);
  assert.equal(r.sinCitaTodavia, 100, 'los censurados no se contaron');
  assert.equal(r.cobertura.con, PISO_DE_UNA_TASA);
  assert.equal(r.cobertura.sobre, PISO_DE_UNA_TASA + 100, 'la cobertura perdió su segundo término');
  assert.match(String(r.aviso), /todavía no agendaron/i, 'el aviso no declara la censura');
});

// ─── CUÁL ES LA PRIMERA CITA ──────────────────────────────────────────────────

test('la primera cita es la PRIMERA, no la última', async () => {
  /* Un contacto con citas a 2 y a 40 días tardó dos en agendar, no cuarenta. El mutante `max` da un
     ciclo veinte veces más largo. */
  await limpiar();
  for (let i = 0; i < PISO_DE_UNA_TASA; i += 1) {
    await unContacto({ altaHaceDias: 100, citasHaceDias: [98, 60] });
  }

  const r = await leer(3650);
  assert.equal(r.p50, 2, `salió ${r.p50}: tomó la última cita y no la primera`);
});

test('una cita CONGELADA no cuenta como primera cita', async () => {
  /* Si contara, el ciclo mediría sobre una población que `cadenaDeCierre` no cuenta —su segundo
     eslabón las excluye— y las dos cifras de la misma pantalla hablarían de dos grupos distintos.
     *
     * Las DOS mitades: el congelado no entra, y el que sí tiene una alcanzable sí. */
  await limpiar();
  for (let i = 0; i < PISO_DE_UNA_TASA; i += 1) {
    await unContacto({ altaHaceDias: 100, citasHaceDias: [95], congelada: true });
  }
  for (let i = 0; i < PISO_DE_UNA_TASA; i += 1) {
    await unContacto({ altaHaceDias: 100, citasHaceDias: [98] });
  }

  const r = await leer(3650);

  assert.equal(r.cobertura.con, PISO_DE_UNA_TASA, 'una cita congelada se contó como primera cita');
  assert.equal(r.p50, 2, `salió ${r.p50}: el ciclo de 5 días del congelado entró`);
  assert.equal(r.sinCitaTodavia, PISO_DE_UNA_TASA, 'el del congelado no se contó como sin cita');
});

test('una cita ANTERIOR al alta no entra: un ciclo negativo no es un ciclo', async () => {
  /* Medido: cero contactos tienen su primera cita antes del alta, así que esto es por construcción y
     no por datos corruptos. El día que aparezca una, no puede entrar como cero y bajar la mediana.
     *
     * Se siembra con la cita DESPUÉS de ahora y el alta antes, o sea ciclo negativo respecto del
     * alta: `citasHaceDias` mayor que `altaHaceDias`. */
  await limpiar();
  for (let i = 0; i < PISO_DE_UNA_TASA; i += 1) await unContacto({ altaHaceDias: 10, citasHaceDias: [8] });
  await unContacto({ altaHaceDias: 10, citasHaceDias: [20] });

  const r = await leer(3650);

  assert.equal(r.p50, 2, `salió ${r.p50}: el ciclo negativo entró y bajó la mediana`);
  assert.equal(r.cobertura.con, PISO_DE_UNA_TASA, 'el del ciclo negativo se contó como medido');
});

// ─── EL PISO ──────────────────────────────────────────────────────────────────

test('bajo el piso hay conteo y no mediana', async () => {
  /* Con cuatro observaciones, «agendan en dos días» se lee igual que sobre doscientas y la próxima
     cita mueve la cifra un día entero. */
  await limpiar();
  for (let i = 0; i < PISO_DE_UNA_TASA - 1; i += 1) {
    await unContacto({ altaHaceDias: 10, citasHaceDias: [8] });
  }

  const r = await leer(3650);

  assert.equal(r.p50, null, 'publicó una mediana bajo el piso');
  assert.equal(r.p90, null, 'publicó un p90 bajo el piso');
  assert.equal(r.cobertura.con, PISO_DE_UNA_TASA - 1, 'el conteo se perdió con la cifra');
  assert.match(String(r.aviso), new RegExp(`${PISO_DE_UNA_TASA} para que una mediana`));
});

test('el piso es de los MEDIDOS, no de la cohorte: cohorte grande con pocas citas no publica', async () => {
  /* Éste es el caso que el comentario del módulo describe —*«con 400 contactos y tres citas, la
     mediana sale de tres observaciones aunque la cohorte sea grande»*— y que la prueba de arriba NO
     cubre: ahí los nueve sembrados agendaron todos, así que la cohorte y los medidos coinciden y
     aplicar el piso a una o a otra da lo mismo.
     *
     * Lo encontró la mutación. Acá la cohorte supera el piso y los medidos no, que es la única forma
     * de distinguir los dos denominadores. */
  await limpiar();
  for (let i = 0; i < PISO_DE_UNA_TASA - 1; i += 1) {
    await unContacto({ altaHaceDias: 10, citasHaceDias: [8] });
  }
  for (let i = 0; i < 6; i += 1) await unContacto({ altaHaceDias: 10 });

  const r = await leer(3650);

  assert.ok(r.cohorte >= PISO_DE_UNA_TASA, `la cohorte (${r.cohorte}) tiene que superar el piso`);
  assert.equal(r.cobertura.con, PISO_DE_UNA_TASA - 1, 'los medidos tienen que quedar bajo el piso');
  assert.equal(
    r.p50,
    null,
    'publicó una mediana sacada de 9 observaciones porque la COHORTE superaba el piso',
  );
});

// ─── EL TECHO DE LA VENTANA ───────────────────────────────────────────────────

test('el aviso del techo se enciende cuando la ventana recorta, y se APAGA cuando no', async () => {
  /* Las dos mitades, o un aviso siempre encendido deja la prueba en verde y nadie lo lee.
     *
     * Se siembran diez ciclos de 6 días. Con la ventana de 7, el p90 queda contra el borde y la
     * cifra está describiendo el recorte; con «completo» los mismos datos no tocan ningún techo. */
  await limpiar();
  for (let i = 0; i < PISO_DE_UNA_TASA; i += 1) {
    await unContacto({ altaHaceDias: 6.5, citasHaceDias: [0.5] });
  }

  const corta = await leer(7);
  assert.equal(corta.techoDeLaVentana, 7);
  assert.ok(corta.p90 !== null, 'la siembra no llegó al piso en la ventana corta');
  assert.ok(corta.avisoDelTecho, `con el p90 en ${corta.p90} de 7 días el aviso del techo no se encendió`);
  assert.match(String(corta.avisoDelTecho), /ventana más larga/i, 'el aviso no dice qué hacer');

  const larga = await leer(3650);
  assert.equal(
    larga.avisoDelTecho,
    null,
    'el aviso del techo está encendido con una ventana de diez años: aparece siempre y nadie lo lee',
  );
  assert.equal(larga.p50, corta.p50, 'los mismos datos dieron dos medianas distintas');
});

// ─── LOS SILENCIOS Y LAS TRANSVERSALES ────────────────────────────────────────

test('con cohorte cero dice que no hubo gente, y no publica cifras', async () => {
  await limpiar();

  const r = await leer();

  assert.equal(r.cohorte, 0);
  assert.equal(r.p50, null);
  assert.equal(r.sinCitaTodavia, 0, 'inventó censurados sobre una cohorte vacía');
  assert.match(String(r.aviso), /no hubo gente/i);
});

test('el aviso dice que mide hasta la CITA y no hasta la venta', async () => {
  /* Sin esa frase, «ciclo» se lee como «hasta la venta» — que es justo el eslabón que no existe: cero
     ventas en toda la base. */
  await limpiar();
  for (let i = 0; i < PISO_DE_UNA_TASA; i += 1) await unContacto({ altaHaceDias: 10, citasHaceDias: [8] });

  const r = await leer(3650);
  assert.match(String(r.aviso), /a la PRIMERA cita, no a la venta/i);
});

test('ni el aviso ni el del techo llevan Markdown, y el piso viaja', async () => {
  await limpiar();
  for (let i = 0; i < PISO_DE_UNA_TASA; i += 1) {
    await unContacto({ altaHaceDias: 6.5, citasHaceDias: [0.5] });
  }

  const r = await leer(7);

  assert.doesNotMatch(String(r.aviso ?? ''), /\*\*|__|\[.+\]\(/, 'el aviso lleva Markdown crudo');
  assert.doesNotMatch(String(r.avisoDelTecho ?? ''), /\*\*|__/, 'el aviso del techo lleva Markdown crudo');
  assert.equal(r.piso, PISO_DE_UNA_TASA, 'el piso no viaja, y la pantalla tendría que importarlo');
});
