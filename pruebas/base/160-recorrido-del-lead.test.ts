// Por dónde entró cada persona, contra la base de verdad. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LOS CUATRO DEFECTOS QUE ESTE ARCHIVO EXISTE PARA IMPEDIR, Y NINGUNO FALLA
//
//  1 · **Leer el PRIMER toque en vez del último.** `atribucion_primera` dice de qué anuncio vino y
//      `atribucion_ultima` por dónde volvió a entrar. Medido en producción: `Trigger Link` vale 29
//      de 584 en la última y **0 de 584 en la primera**. Un módulo que mirara la primera mediría
//      cero para siempre y lo reportaría como «no se usan».
//
//  2 · **Sumar familias.** Los recorridos son caminos ALTERNATIVOS, no etapas. Sumar `landing +
//      widget` afirma un paso que el 87 % de la gente no da. El defecto no falla: da un número más
//      grande y creíble.
//
//  3 · **Clasificar por `sessionSource`.** Medido: `Paid Social` son 193 contactos y **105 SÍ traen
//      URL**. Lo que identifica al que llegó sin abrir página es la AUSENCIA de la dirección; el
//      origen sólo le pone nombre. Poner el origen primero manda a «sin página» a los 105 que sí
//      abrieron la landing.
//
//  4 · **Perder gente por el camino.** Las filas tienen que sumar la cohorte EXACTA. Una familia que
//      se descarta en silencio hace que la cobertura de arriba deje de cuadrar con la tabla de
//      abajo, y nadie puede notarlo mirando una sola de las dos.
//
// ── Y EL QUINTO, QUE SE DESCUBRIÓ MIDIENDO ────────────────────────────────
//
// La primera versión publicaba `agendaron / contactos` por familia. Es **circular**: para 124 de 590
// contactos la última dirección se captura AL RESERVAR (`medium = calendar`), así que la tasa divide
// «agendó» por un denominador definido en parte por haber agendado. Por eso viajan conteos y
// `capturadaAlReservar`, que es la medida de cuánto de cada fila es circular.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { recorridoDelLead } from '../../lib/negocio/recorridoDelLead.ts';
import { PISO_DE_UNA_TASA } from '../../lib/negocio/indicadoresDeCitas.ts';

let esc: Escenario;

const CONTACTO = 'recorr-';

async function limpiar(): Promise<void> {
  await esc.admin.query(
    'delete from negocio.citas where contacto_id in (select id from negocio.contactos where ghl_contact_id like $1)',
    [`${CONTACTO}%`],
  );
  await esc.admin.query('delete from negocio.contactos where ghl_contact_id like $1', [`${CONTACTO}%`]);
}

/**
 * Un contacto con su última atribución.
 *
 * `ultima` y `primera` se siembran por separado a propósito: la prueba del defecto 1 necesita
 * poderlas poner en desacuerdo.
 */
async function unContacto(o: {
  ultima?: Record<string, string>;
  primera?: Record<string, string>;
  cita?: boolean;
  congelada?: boolean;
  hace?: number;
}): Promise<void> {
  const ghl = `${CONTACTO}${randomUUID().slice(0, 8)}`;
  const r = await esc.admin.query<{ id: string }>(
    `insert into negocio.contactos
       (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, atribucion_primera, atribucion_ultima)
     values ($1, $2, 'Lead de prueba', 'setter', now() - make_interval(days => $3::int), $4::jsonb, $5::jsonb)
     returning id`,
    [esc.org, ghl, o.hace ?? 1, JSON.stringify(o.primera ?? {}), JSON.stringify(o.ultima ?? {})],
  );
  const id = r.rows[0]?.id;

  if (o.cita || o.congelada) {
    await esc.admin.query(
      `insert into negocio.citas (org_id, contacto_id, ghl_evento_id, ghl_calendario_id, inicio_el, fin_el, estado_ghl)
         values ($1, $2, $3, $4, now() - interval '2 hours', now() - interval '1 hour', 'confirmed')`,
      [esc.org, id, `cita-${ghl}`, o.congelada ? null : 'cal-recorr'],
    );
  }
}

const leer = (dias = 30) => conOrganizacion(esc.org, () => recorridoDelLead(dias));
const fila = async (familia: string, dias = 30) =>
  (await leer(dias)).filas.find((f) => f.familia === familia);

before(async () => {
  esc = await montar('RecorridoDelLead');
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

// ─── LA FUENTE ────────────────────────────────────────────────────────────────

test('la familia sale del ÚLTIMO toque, no del primero', async () => {
  /* El escenario mínimo que los separa: un contacto cuya primera atribución dice landing y cuya
     última dice widget. Si el módulo leyera la primera, este contacto caería en «landing» y la
     prueba de abajo vería una fila que no tiene que existir.
     *
     * Y hay que sembrar las DOS, porque un módulo que leyera la primera con la última vacía
     * devolvería «sin rastro» y eso se confundiría con un error de siembra. */
  await limpiar();
  await unContacto({
    primera: { url: 'https://accelerator.ariaia.com/?utm_source=fb' },
    ultima: { url: 'https://calls.ariaia.com/widget/booking/abc' },
  });

  const r = await leer();

  assert.equal(r.filas.find((f) => f.familia === 'widget')?.contactos, 1, 'no leyó el último toque');
  assert.equal(r.filas.find((f) => f.familia === 'landing'), undefined, 'leyó el PRIMER toque');
});

// ─── LAS FAMILIAS ─────────────────────────────────────────────────────────────

test('landing y widget son dos filas y NO se suman', async () => {
  /* Los conteos se eligen desparejos —3 y 5— para que el mutante se equivoque de forma observable:
     si alguien los colapsara en una sola familia, el total sería 8, que no es ninguno de los dos. */
  await limpiar();
  for (let i = 0; i < 3; i += 1) {
    await unContacto({ ultima: { url: 'https://accelerator.ariaia.com/' } });
  }
  for (let i = 0; i < 5; i += 1) {
    await unContacto({ ultima: { url: 'https://calls.ariaia.com/r/2/xyz' } });
  }

  const r = await leer();

  assert.equal(r.filas.find((f) => f.familia === 'landing')?.contactos, 3);
  assert.equal(r.filas.find((f) => f.familia === 'widget')?.contactos, 5);
  assert.equal(r.filas.length, 2, 'apareció una familia que no se sembró');
});

test('el navegador de Facebook y el reclutamiento NO cuentan como landing', async () => {
  /* Los dos son direcciones que NO son la página de venta: `fbsbx.com` es el navegador interno de
     Facebook —no es una página nuestra— y el sitio de reclutamiento no es del embudo comercial.
     Meterlos en «landing» daría una landing de tres cuando es una, y las otras dos filas
     desaparecerían: el mutante da un número más grande y creíble. */
  await limpiar();
  await unContacto({ ultima: { url: 'https://accelerator.ariaia.com/' } });
  await unContacto({ ultima: { url: 'https://www.fbsbx.com/' } });
  await unContacto({ ultima: { url: 'https://trabaja-con-nosotros.ariaia.com/' } });

  const r = await leer();

  assert.equal(r.filas.find((f) => f.familia === 'landing')?.contactos, 1, 'contó como landing algo que no lo es');
  assert.equal(r.filas.find((f) => f.familia === 'meta-navegador')?.contactos, 1);
  assert.equal(r.filas.find((f) => f.familia === 'otra')?.contactos, 1, 'el host desconocido se descartó');
});

test('la ausencia de dirección NO es un hueco: es su propia familia, y se distingue de no tener nada', async () => {
  /* Medido en producción el 2026-09-20: de los 115 sin `url`, **89 traen atribución completa** y 88
     de ésos vienen de Meta sin pisar página. Tratarlos como «sin rastro» perdería el 25 % del
     tráfico de septiembre en una fila que dice «no sabemos».
     *
     * Las dos mitades van juntas: sin la segunda, clasificar TODO lo que no trae URL como
     * «sin-pagina» dejaría la primera en verde. */
  await limpiar();
  await unContacto({ ultima: { sessionSource: 'Paid Social', medium: 'facebook' } });
  await unContacto({ ultima: {} });

  const r = await leer();

  assert.equal(r.filas.find((f) => f.familia === 'sin-pagina')?.contactos, 1);
  assert.equal(r.filas.find((f) => f.familia === 'sin-rastro')?.contactos, 1);
});

test('el que trae URL y origen cae por la URL, no por el origen', async () => {
  /* El defecto 3, con su escenario exacto. Medido: `Paid Social` son 193 contactos y **105 traen
     URL**. Un `case` que mirara el origen primero mandaría a esos 105 a «sin página» — o sea que la
     landing perdería más de la mitad de su gente y nadie lo notaría, porque «sin página» es una
     fila legítima que crecería sin llamar la atención. */
  await limpiar();
  await unContacto({
    ultima: { url: 'https://accelerator.ariaia.com/', sessionSource: 'Paid Social', medium: 'facebook' },
  });

  const r = await leer();

  assert.equal(r.filas.find((f) => f.familia === 'landing')?.contactos, 1, 'el origen le ganó a la URL');
  assert.equal(r.filas.find((f) => f.familia === 'sin-pagina'), undefined);
});

// ─── LA COHORTE ───────────────────────────────────────────────────────────────

test('las filas suman la cohorte EXACTA, sin descartar a nadie', async () => {
  /* El defecto 4. Se siembra una de cada familia, con un host desconocido incluido: si alguna se
     descartara en silencio, la suma sería menor que la cohorte y la cobertura de arriba dejaría de
     cuadrar con la tabla de abajo. */
  await limpiar();
  await unContacto({ ultima: { url: 'https://accelerator.ariaia.com/' } });
  await unContacto({ ultima: { url: 'https://calls.ariaia.com/' } });
  await unContacto({ ultima: { url: 'https://precall.ariaia.com/' } });
  await unContacto({ ultima: { url: 'https://www.fbsbx.com/' } });
  await unContacto({ ultima: { url: 'https://un-host-que-nadie-conoce.example/' } });
  await unContacto({ ultima: { sessionSource: 'Social media' } });
  await unContacto({ ultima: {} });

  const r = await leer();
  const suma = r.filas.reduce((s, f) => s + f.contactos, 0);

  assert.equal(r.cohorte, 7);
  assert.equal(suma, 7, 'las filas no suman la cohorte: alguien se descartó por el camino');
  assert.equal(r.filas.length, 7, 'dos familias distintas cayeron en la misma fila');
  /* Y la porción suma uno. Sin esto, una familia con la porción calculada sobre otro denominador
     pasaría desapercibida: cada fila se vería plausible por separado. */
  const porciones = r.filas.reduce((s, f) => s + f.porcion, 0);
  assert.ok(Math.abs(porciones - 1) < 1e-9, `las porciones suman ${porciones}`);
});

test('la cobertura se mide sobre la cohorte ENTERA, no sobre los que traen dirección', async () => {
  /* Con el denominador chico la cifra sale más alta y se ve igual de creíble. Es el mismo defecto
     que `calidadDelCreativo` corrigió en el puente de Creative, donde eran siete puntos. */
  await limpiar();
  for (let i = 0; i < 3; i += 1) await unContacto({ ultima: { url: 'https://calls.ariaia.com/' } });
  await unContacto({ ultima: {} });

  const r = await leer();

  assert.equal(r.cobertura.con, 3);
  assert.equal(r.cobertura.sobre, 4, 'el denominador son los que traen dirección, no la cohorte');
});

// ─── LO QUE SE PUBLICA Y LO QUE NO ────────────────────────────────────────────

test('el agendamiento sale de las citas, y una cita CONGELADA no cuenta', async () => {
  /* El mismo `exists` con `ghl_calendario_id is not null` que usan otros cuatro módulos. Una cita
     congelada existe pero el CRM ya no devuelve sus eventos: contarla haría que esta pantalla
     dijera otra cifra de agendamiento que las demás. */
  await limpiar();
  await unContacto({ ultima: { url: 'https://calls.ariaia.com/' }, cita: true });
  await unContacto({ ultima: { url: 'https://calls.ariaia.com/' }, congelada: true });
  await unContacto({ ultima: { url: 'https://calls.ariaia.com/' } });

  const f = await fila('widget');

  assert.equal(f?.contactos, 3);
  assert.equal(f?.agendaron, 1, 'contó una cita congelada como agendamiento');
});

test('`capturadaAlReservar` distingue la fila circular de la que no lo es', async () => {
  /* El quinto defecto, el que se descubrió midiendo. Las dos filas tienen los MISMOS contactos y
     los MISMOS agendados: lo único que las separa es cuándo se capturó la dirección. Si el módulo
     no lo distinguiera, las dos se verían idénticas y la de arriba diría que ese camino convierte
     al 100 % cuando lo único que dice es que quien llegó ahí ya había reservado. */
  await limpiar();
  for (let i = 0; i < 2; i += 1) {
    await unContacto({ ultima: { url: 'https://calls.ariaia.com/', medium: 'calendar' }, cita: true });
  }
  for (let i = 0; i < 2; i += 1) {
    await unContacto({ ultima: { url: 'https://accelerator.ariaia.com/', medium: 'External Form' }, cita: true });
  }

  const widget = await fila('widget');
  const landing = await fila('landing');

  assert.equal(widget?.contactos, 2);
  assert.equal(widget?.agendaron, 2);
  assert.equal(widget?.capturadaAlReservar, 2, 'no vio que la dirección se capturó al reservar');

  assert.equal(landing?.contactos, 2);
  assert.equal(landing?.agendaron, 2);
  assert.equal(landing?.capturadaAlReservar, 0, 'marcó como circular una fila que no lo es');
});

test('«no hay tráfico» y «no hay dato» se dicen distinto', async () => {
  /* Con la pauta apagada la cohorte es cero, y no porque falte un campo. Una pantalla que diga «no
     hay dato» sobre una ventana sin gente manda a buscar un defecto que no existe. */
  await limpiar();

  const r = await leer();

  assert.equal(r.cohorte, 0);
  assert.match(String(r.aviso), /no hubo gente/i, 'confundió la ausencia de tráfico con la de dato');
  /* Y lo NIEGA explícitamente, que es la mitad que importa: «no hubo gente» a secas todavía deja a
     quien lee preguntándose si el dato se rompió. La frase tiene que cerrar esa puerta. */
  assert.match(String(r.aviso), /no es que falte el dato/i, 'no descarta la lectura equivocada');
  /* Y el resto del aviso se calla: con cero contactos, hablar del corte de época o de los pisos es
     ruido sobre una tabla vacía. */
  assert.doesNotMatch(String(r.aviso), /corte|piso|recorrido\(s\)/i, 'habla de más sobre una tabla vacía');
});

test('ningún aviso lleva Markdown: la pantalla lo dibuja crudo', async () => {
  /* Un `**provisional**` se lee con los asteriscos puestos dentro de un `<p>`, y la frase que
     existe para dar confianza en la cifra termina pareciendo una falla de la aplicación. Ya pasó en
     el aviso de fatiga de Creative. */
  await limpiar();
  for (let i = 0; i < PISO_DE_UNA_TASA + 1; i += 1) {
    await unContacto({ ultima: { url: 'https://calls.ariaia.com/', medium: 'calendar' }, cita: true });
  }

  const r = await leer();

  assert.ok(r.aviso, 'con una fila circular el aviso no puede callar');
  assert.doesNotMatch(String(r.aviso), /\*\*|__|\[.+\]\(/, 'el aviso lleva Markdown crudo');
});

test('con TRES familias circulares el aviso las enumera en castellano, no las encadena con «y»', async () => {
  /* ── ESTE DEFECTO SÓLO SE VE CON TRES, Y EN PRODUCCIÓN HAY DOS ─────────────
   *
   * El aviso listaba las familias circulares con `join(' y ')`. Con dos elementos se lee perfecto
   * —«A y B»— y las familias circulares medidas el 2026-09-20 sobre treinta días son exactamente
   * dos: «Meta, navegador interno» y «Precall». Con tres da **«A y B y C»**.
   *
   * O sea que la ventana que el botón abre por omisión nunca lo muestra, y la corrección de rumbo
   * de un solo cliente —una familia más que cruce el 90 %— lo saca a la pantalla. Apareció al mirar
   * el panel en el navegador con datos sembrados, no en ninguna prueba.
   *
   * Las DOS mitades van juntas: sin la primera aserción, un `join(', ')` pelado —«A, B, C»— pasaría
   * la segunda y seguiría sin ser castellano. */
  await limpiar();
  const CIRCULARES = [
    'https://calls.ariaia.com/r',
    'https://precall.ariaia.com/b',
    'https://www.fbsbx.com/x',
  ];
  for (const url of CIRCULARES) {
    for (let i = 0; i < PISO_DE_UNA_TASA + 1; i += 1) {
      await unContacto({ ultima: { url, medium: 'calendar' }, cita: true });
    }
  }

  const r = await leer();

  assert.match(String(r.aviso), /» y «/, 'la última no se une con «y»: la lista no cierra en castellano');
  assert.doesNotMatch(String(r.aviso), /» y «[^»]+» y «/, 'encadenó tres con «y»: «A y B y C» no es castellano');
  /* Y las tres están nombradas: una lista bien puntuada que perdió un elemento es peor que una mal
     puntuada que los trae todos. */
  for (const t of ['Widget de reserva', 'Precall', 'Meta, navegador interno']) {
    assert.ok(String(r.aviso).includes(`«${t}»`), `el aviso no nombra «${t}»`);
  }
});

test('los rótulos viajan en la respuesta, no se importan', async () => {
  /* La pantalla es `'use client'` y este módulo abre la base: importar sus constantes desde el
     navegador arrastra `pg` al paquete y el build falla con «Can't resolve 'dns'». Esa mitad la
     vigila el build. Lo que el build NO vigila es que alguien borre `rotulos` de la respuesta y
     reescriba los siete títulos a mano en el JSX: compila, se ve igual, y la definición de cada
     familia queda escrita en dos lugares. */
  await limpiar();
  await unContacto({ ultima: { url: 'https://accelerator.ariaia.com/' } });

  const r = await leer();

  for (const f of ['landing', 'sin-pagina', 'widget', 'sin-rastro'] as const) {
    assert.ok(r.rotulos[f]?.titulo?.trim(), `falta el título de ${f}`);
    assert.ok(r.rotulos[f]?.que?.trim().length > 30, `${f} no explica qué es`);
  }
  /* Y el de «sin página» NO puede llamarse «de Meta»: medido, 88 de 89 lo son y uno es Instagram
     orgánico. La familia se nombra por lo que la define, que es la ausencia de página. */
  assert.doesNotMatch(r.rotulos['sin-pagina'].titulo, /meta|facebook/i);
});
