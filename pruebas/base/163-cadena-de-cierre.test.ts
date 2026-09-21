// La cadena de cierre de Sales, contra la base de verdad. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE ARCHIVO PROTEGE ES UN EMBUDO QUE NO SE PUEDE ENSANCHAR
//
// La cadena tiene cinco eslabones y **la unidad es el contacto en los cinco**. Dos defectos la
// rompen sin que nada falle, y los dos dan un número más grande y creíble:
//
//   1 · **Mezclar unidades.** Medido el 2026-09-21: 222 citas alcanzables son 197 contactos. Un
//       eslabón que cuente citas al lado de cuatro que cuentan contactos dibuja una caída que no
//       existe —o la esconde—, y las dos cifras están bien calculadas por separado.
//   2 · **Suponer la monotonía.** `resultados.cita_id` es nulo en las 7 filas de la base y el esquema
//       permite un resultado sobre un contacto sin ninguna cita. Contado suelto, el cuarto eslabón
//       puede salir MAYOR que el tercero y la pantalla dibuja un embudo que se ensancha.
//
// Y un tercero que no es de la cadena sino de su denominador: **24 de 590 contactos no tienen fecha
// de alta**, así que no entran en ninguna ventana —ni con «Completo»— y hasta hoy ninguna pantalla
// lo declaraba.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { cadenaDeCierre, ESLABONES } from '../../lib/negocio/cadenaDeCierre.ts';

let esc: Escenario;

const CONTACTO = 'cadena-';

async function limpiar(): Promise<void> {
  await esc.admin.query(
    'delete from negocio.resultados where contacto_id in (select id from negocio.contactos where ghl_contact_id like $1)',
    [`${CONTACTO}%`],
  );
  await esc.admin.query(
    'delete from negocio.citas where contacto_id in (select id from negocio.contactos where ghl_contact_id like $1)',
    [`${CONTACTO}%`],
  );
  await esc.admin.query('delete from negocio.contactos where ghl_contact_id like $1', [`${CONTACTO}%`]);
}

/**
 * Un contacto con, opcionalmente, una cita y un resultado.
 *
 * `haceHoras` de la cita es NEGATIVO para el pasado. Se siembra en horas y no en días porque los tres
 * predicados del tercer eslabón miran `inicio_el < now()`, y un día entero de margen esconde los
 * bordes.
 */
async function unContacto(o: {
  sinAlta?: boolean;
  cita?: { haceHoras: number; estado?: string; congelada?: boolean; descartado?: boolean };
  resultado?: { salida: string; despuesDeLaCita?: boolean };
}): Promise<void> {
  const ghl = `${CONTACTO}${randomUUID().slice(0, 8)}`;
  /* ── LA ETIQUETA TIENE QUE SER UNA DE LA LISTA DE VERDAD ──────────────────
   *
   * Decía `array['descartado']`, y **`'descartado'` no está en `ETIQUETAS_DE_DESCARTE`**
   * (`lib/ghl/contrato.ts:231-238`): la lista es `icp_rechazado · rechazado · rechazado_positivo ·
   * rechazado_negativo · no calificado · descalificado`, censada sobre la subcuenta real. Sembrar
   * una etiqueta que no está en la lista deja el parámetro sin efecto, así que cualquier prueba que
   * lo usara habría pasado sin ejercitar el filtro — verde sobre nada.
   *
   * Lo encontró `165-cierre-por-closer` al necesitar el mismo caso. */
  const etiquetas = o.cita?.descartado ? "array['rechazado']" : "array[]::text[]";
  const r = await esc.admin.query<{ id: string }>(
    `insert into negocio.contactos
       (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, etiquetas)
     values ($1, $2, 'Lead de prueba', 'closer', ${o.sinAlta ? 'null' : "now() - interval '2 days'"}, ${etiquetas})
     returning id`,
    [esc.org, ghl],
  );
  const id = r.rows[0]!.id;

  let inicio: Date | null = null;
  if (o.cita) {
    inicio = new Date(Date.now() + o.cita.haceHoras * 3600_000);
    await esc.admin.query(
      `insert into negocio.citas
         (org_id, contacto_id, ghl_evento_id, ghl_calendario_id, inicio_el, fin_el, estado_ghl)
       values ($1, $2, $3, $4, $5::timestamptz, $5::timestamptz + interval '1 hour', $6)`,
      [esc.org, id, `cita-${ghl}`, o.cita.congelada ? null : 'cal-cadena', inicio, o.cita.estado ?? 'confirmed'],
    );
  }

  if (o.resultado) {
    /* Después de la cita por omisión: el cuarto eslabón exige `creado_el >= ci.inicio_el`, y un
       resultado anterior a la reunión no dice qué pasó EN ella. */
    const cuando =
      o.resultado.despuesDeLaCita === false || inicio === null
        ? new Date(Date.now() - 10 * 86_400_000)
        : new Date(inicio.getTime() + 600_000);
    await esc.admin.query(
      `insert into negocio.resultados (org_id, contacto_id, salida, rol, registrado_por, creado_el)
         values ($1, $2, $3, 'closer', $4, $5)`,
      [esc.org, id, o.resultado.salida, esc.quien, cuando],
    );
  }
}

const leer = (dias = 30) => conOrganizacion(esc.org, () => cadenaDeCierre(dias));
const eslabon = async (clave: string, dias = 30) =>
  (await leer(dias)).eslabones.find((e) => e.clave === clave);

before(async () => {
  esc = await montar('CadenaDeCierre');
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

// ─── LA UNIDAD ────────────────────────────────────────────────────────────────

test('la unidad es el CONTACTO en los cinco: tres citas de una persona cuentan una vez', async () => {
  /* Medido en producción: 222 citas alcanzables son 197 contactos. La diferencia es exactamente
     ésta, y si el eslabón contara citas la caída de arriba se dibujaría más chica de lo que es.
     *
     * Las DOS mitades van juntas: el conteo de citas tiene que seguir viajando al lado, o el defecto
     * se «arregla» borrando el dato en vez de poniéndolo en su lugar. */
  await limpiar();
  const ghl = `${CONTACTO}${randomUUID().slice(0, 8)}`;
  const r = await esc.admin.query<{ id: string }>(
    `insert into negocio.contactos (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm)
       values ($1, $2, 'Con tres citas', 'closer', now() - interval '2 days') returning id`,
    [esc.org, ghl],
  );
  for (let i = 0; i < 3; i += 1) {
    await esc.admin.query(
      `insert into negocio.citas (org_id, contacto_id, ghl_evento_id, ghl_calendario_id, inicio_el, fin_el, estado_ghl)
         values ($1, $2, $3, 'cal-cadena', now() - interval '3 hours', now() - interval '2 hours', 'confirmed')`,
      [esc.org, r.rows[0]!.id, `cita-${ghl}-${i}`],
    );
  }

  const e = await eslabon('con_cita');
  assert.equal(e?.contactos, 1, 'el eslabón contó citas y no contactos');
  assert.equal(e?.citas, 3, 'el conteo de citas dejó de viajar al lado');
});

// ─── LA MONOTONÍA ─────────────────────────────────────────────────────────────

test('un resultado SIN cita cerrable no engorda el cuarto eslabón: va aparte', async () => {
  /* El embudo que se ensancha. `resultados.cita_id` es nulo en las 7 filas de producción y el esquema
     permite un resultado sobre un contacto que nunca tuvo cita, así que esto no es hipotético. */
  await limpiar();
  await unContacto({ resultado: { salida: 'seguimiento' } });
  await unContacto({ cita: { haceHoras: -3 }, resultado: { salida: 'seguimiento' } });

  const r = await leer();

  assert.equal(r.eslabones.find((e) => e.clave === 'cerrable')?.contactos, 1);
  assert.equal(
    r.eslabones.find((e) => e.clave === 'con_intento')?.contactos,
    1,
    'el intento sin cita entró en la cadena y la ensanchó',
  );
  assert.equal(r.intentosSinCita, 1, 'el que rompe la monotonía no se contó aparte');
});

test('la cadena nunca crece: cada eslabón es menor o igual que el anterior', async () => {
  /* La invariante, comprobada sobre una siembra variada en vez de sobre un caso. Un mutante que
     cuente un eslabón suelto puede pasar el caso de arriba y fallar acá. */
  await limpiar();
  await unContacto({});
  await unContacto({ cita: { haceHoras: +48 } });
  await unContacto({ cita: { haceHoras: -3 } });
  await unContacto({ cita: { haceHoras: -3 }, resultado: { salida: 'no_show' } });
  await unContacto({ cita: { haceHoras: -3 }, resultado: { salida: 'venta' } });
  await unContacto({ resultado: { salida: 'venta' } });

  const r = await leer();

  for (let i = 1; i < ESLABONES.length; i += 1) {
    const antes = r.eslabones[i - 1]!;
    const ahora = r.eslabones[i]!;
    assert.ok(
      ahora.contactos <= antes.contactos,
      `«${ahora.titulo}» (${ahora.contactos}) es mayor que «${antes.titulo}» (${antes.contactos}): el embudo se ensancha`,
    );
  }
  /* Y la venta del contacto sin cita NO llega al último eslabón, aunque sea una venta de verdad. */
  assert.equal(r.eslabones.find((e) => e.clave === 'con_venta')?.contactos, 1);
});

// ─── EL TERCER ESLABÓN, Y SUS TRES CONDICIONES ────────────────────────────────

test('una cita que todavía no ocurrió no es cerrable', async () => {
  /* Preguntar por una cita de mañana es pedir un pronóstico, y la respuesta quedaría guardada como
     un hecho medido. Es la condición 1 de `citasParaCerrar.ts:17-18`. */
  await limpiar();
  await unContacto({ cita: { haceHoras: +48 } });

  const r = await leer();
  assert.equal(r.eslabones.find((e) => e.clave === 'con_cita')?.contactos, 1, 'agendó, eso sí cuenta');
  assert.equal(r.eslabones.find((e) => e.clave === 'cerrable')?.contactos, 0, 'una cita futura se contó como ocurrida');
});

test('una cita CANCELADA no es cerrable: nadie faltó a algo que no ocurrió', async () => {
  await limpiar();
  await unContacto({ cita: { haceHoras: -3, estado: 'cancelled' } });

  const r = await leer();
  assert.equal(r.eslabones.find((e) => e.clave === 'con_cita')?.contactos, 1);
  assert.equal(r.eslabones.find((e) => e.clave === 'cerrable')?.contactos, 0, 'una cancelada entró como ocurrida');
});

test('una cita CONGELADA no entra en ningún eslabón, y se declara aparte', async () => {
  /* Su estado no va a cambiar nunca más: contarla es contar una foto vieja como si fuera de hoy. */
  await limpiar();
  await unContacto({ cita: { haceHoras: -3, congelada: true } });

  const r = await leer();
  assert.equal(r.eslabones.find((e) => e.clave === 'con_cita')?.contactos, 0, 'una congelada entró en la cadena');
  /* Y el TERCERO también, que es la mitad que faltaba. El segundo lo protege
     `tieneCitaAlcanzable`, pero el tercero arma su predicado aparte: sin esta línea, quitarle el
     `alcanzable` a `cerrable` dejaba la prueba en verde — y la cadena quedaba con 0 contactos que
     agendaron y 1 cuya cita «ya ocurrió», que es un embudo creciendo desde cero. Lo encontró la
     mutación. */
  assert.equal(
    r.eslabones.find((e) => e.clave === 'cerrable')?.contactos,
    0,
    'una congelada se contó como cita ocurrida: el tercer eslabón no exige que sea alcanzable',
  );
  assert.equal(r.congeladas, 1, 'la congelada no se declaró aparte');
  assert.match(String(r.aviso), /congelad/i, 'el aviso no la menciona');
});

test('la cita de un contacto DESCARTADO se declara aparte, y no como una pérdida', async () => {
  /* El parámetro `descartado` del sembrador existía y **ninguna prueba lo usaba**, así que
     `r.descartadas` no tenía una sola afirmación encima: quitarle el `descartado('ci')` a esa cifra
     dejaba todo en verde. Es el agujero que abrió el arreglo de la etiqueta de más arriba.
     *
     Y el hecho que protege está medido: los descartados cancelan el 94,4 % contra el 33,3 % del
     resto (`lib/ghl/contrato.ts:200-212`). Eso no es una pérdida del negocio, es la automatización
     de la casa cancelando lo que ya había rechazado — y por eso va en su propio número. */
  await limpiar();
  await unContacto({ cita: { haceHoras: -3, descartado: true, estado: 'cancelled' } });
  /* La segunda cita, de alguien que NO está descartado, es lo que hace que la afirmación signifique
     algo: con la del descartado sola, quitarle el filtro a la cifra sigue dando 1 y el mutante
     sobrevive. La primera versión de esta prueba lo tenía y la mutación lo encontró. */
  await unContacto({ cita: { haceHoras: -4, estado: 'cancelled' } });

  const r = await leer();
  assert.equal(r.descartadas, 1, 'la cifra de descartadas no filtra por descartado: cuenta las dos');
  assert.equal(r.congeladas, 0, 'se contó como congelada, que es otro hecho');
  /* Y el descartado NO se resta de la cadena: `cerrable` no lo excluye —a propósito, los eslabones
     cuentan quién llegó a cada etapa— así que los dos contactos están en el segundo eslabón. Fijarlo
     acá es lo que impide que alguien «arregle» la cadena restándolos y desalinee los dos números. */
  assert.equal(r.eslabones.find((e) => e.clave === 'con_cita')?.contactos, 2);
});

// ─── EL CUARTO ESLABÓN ────────────────────────────────────────────────────────

test('un resultado ANTERIOR a la cita no cuenta como haberla registrado', async () => {
  /* Lo que el eslabón afirma es «alguien registró qué pasó EN esa reunión». Un resultado de la semana
     pasada no dice nada de una cita de ayer, y contarlo daría por registrada una reunión que nadie
     cerró — que es justo la cifra que esta pantalla existe para mostrar. */
  await limpiar();
  await unContacto({ cita: { haceHoras: -3 }, resultado: { salida: 'seguimiento', despuesDeLaCita: false } });

  const r = await leer();
  assert.equal(r.eslabones.find((e) => e.clave === 'cerrable')?.contactos, 1);
  assert.equal(
    r.eslabones.find((e) => e.clave === 'con_intento')?.contactos,
    0,
    'un resultado anterior a la cita se contó como el registro de esa cita',
  );
});

test('el aviso dice cuántas citas ocurrieron sin que nadie registrara nada', async () => {
  /* Es la cifra que le habla al problema real —medido, 71 de 75 en producción— y por eso va en el
     aviso y no escondida en una columna. */
  await limpiar();
  for (let i = 0; i < 4; i += 1) await unContacto({ cita: { haceHoras: -3 } });
  await unContacto({ cita: { haceHoras: -3 }, resultado: { salida: 'no_show' } });

  const r = await leer();
  assert.match(String(r.aviso), /4 de 5 contacto/, 'el aviso no dice cuántas quedaron sin registrar');
});

// ─── EL ÚLTIMO ESLABÓN ────────────────────────────────────────────────────────

test('un `acuerdo_sin_pago` NO es una venta', async () => {
  /* Plata comprometida y no cobrada. Es la regla 2 del departamento, y el mutante que las junta da
     un número más grande y perfectamente creíble. */
  await limpiar();
  await unContacto({ cita: { haceHoras: -3 }, resultado: { salida: 'acuerdo_sin_pago' } });
  await unContacto({ cita: { haceHoras: -3 }, resultado: { salida: 'venta' } });

  const r = await leer();
  assert.equal(r.eslabones.find((e) => e.clave === 'con_intento')?.contactos, 2, 'los dos registraron algo');
  assert.equal(r.eslabones.find((e) => e.clave === 'con_venta')?.contactos, 1, 'el acuerdo se contó como venta');
});

test('una `venta_chica` del setter NO cuenta como venta del closer', async () => {
  /* La regla 1: son dos negocios de tamaños distintos y no se suman, nunca
     (`lib/negocio/etapas.ts:86-94`). El mutante `salida like '%venta%'` las junta. */
  await limpiar();
  const ghl = `${CONTACTO}${randomUUID().slice(0, 8)}`;
  const c = await esc.admin.query<{ id: string }>(
    `insert into negocio.contactos (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm)
       values ($1, $2, 'Del setter', 'closer', now() - interval '2 days') returning id`,
    [esc.org, ghl],
  );
  await esc.admin.query(
    `insert into negocio.citas (org_id, contacto_id, ghl_evento_id, ghl_calendario_id, inicio_el, fin_el, estado_ghl)
       values ($1, $2, $3, 'cal-cadena', now() - interval '3 hours', now() - interval '2 hours', 'confirmed')`,
    [esc.org, c.rows[0]!.id, `cita-${ghl}`],
  );
  await esc.admin.query(
    `insert into negocio.resultados (org_id, contacto_id, salida, rol, registrado_por, creado_el)
       values ($1, $2, 'venta_chica', 'setter', $3, now())`,
    [esc.org, c.rows[0]!.id, esc.quien],
  );

  const r = await leer();
  assert.equal(r.eslabones.find((e) => e.clave === 'con_intento')?.contactos, 1, 'registró algo, eso sí');
  assert.equal(
    r.eslabones.find((e) => e.clave === 'con_venta')?.contactos,
    0,
    'una venta chica del setter se contó en la cadena de cierre del closer',
  );
});

// ─── EL DENOMINADOR ───────────────────────────────────────────────────────────

test('los contactos SIN fecha de alta no entran, y la cobertura lo dice', async () => {
  /* Medido: 24 de 590 en producción. No es lo mismo que «quedó fuera de la ventana» —eso se arregla
     ampliándola— y ninguna pantalla lo declaraba hasta ahora. */
  await limpiar();
  await unContacto({});
  await unContacto({ sinAlta: true });

  const r = await leer();

  assert.equal(r.cohorte, 1, 'un contacto sin fecha de alta entró en la cohorte');
  assert.ok(r.coberturaDeLaCohorte.sobre > r.coberturaDeLaCohorte.con, 'la cobertura no vio al que falta');
  assert.match(String(r.aviso), /no tienen fecha de alta/i, 'el aviso no lo declara');
});

test('con cohorte cero las porciones son `null`, y se dice que no hubo gente', async () => {
  /* «No hubo tráfico» y «falta el dato» son dos afirmaciones distintas. Un 0 % sobre nadie afirma
     que nadie avanzó, y lo que pasa es que no hubo de quién decirlo. */
  await limpiar();

  const r = await leer();

  assert.equal(r.cohorte, 0);
  for (const e of r.eslabones) {
    assert.equal(e.porcionDeLaCohorte, null, `«${e.titulo}» publicó una porción sobre cohorte cero`);
  }
  assert.match(String(r.aviso), /no hubo gente/i);
});

// ─── LAS DOS TRANSVERSALES ────────────────────────────────────────────────────

test('los rótulos viajan en la respuesta, no se importan', async () => {
  /* El panel es `'use client'` y este módulo abre la base: importarlo arrastra `pg` al paquete y el
     build falla. Esa mitad la vigila el build. Lo que el build NO vigila es que alguien borre
     `rotulos` y reescriba los cinco títulos a mano en el JSX. */
  await limpiar();
  await unContacto({ cita: { haceHoras: -3 } });

  const r = await leer();

  for (const clave of ESLABONES) {
    assert.ok(r.rotulos[clave]?.titulo?.trim(), `falta el título de ${clave}`);
    assert.ok(r.rotulos[clave]?.que?.trim().length > 40, `${clave} no explica qué mide`);
  }
  assert.equal(r.piso > 0, true, 'el piso no viaja, y la pantalla tendría que importarlo');
});

test('ningún aviso ni rótulo lleva Markdown: la pantalla los dibuja crudos', async () => {
  await limpiar();
  await unContacto({ cita: { haceHoras: -3, congelada: true } });

  const r = await leer();

  assert.doesNotMatch(String(r.aviso ?? ''), /\*\*|__|\[.+\]\(/, 'el aviso lleva Markdown crudo');
  for (const clave of ESLABONES) {
    assert.doesNotMatch(r.rotulos[clave].que, /\*\*|__/, `el rótulo de ${clave} lleva Markdown crudo`);
  }
});
