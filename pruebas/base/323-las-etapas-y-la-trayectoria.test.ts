// LAS ETAPAS Y LA TRAYECTORIA DEL LEAD: la vista etapas_del_lead, el embudo por día y la función de la IA. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (la `106`)
//
//   · negocio.etapas_del_lead lee SÓLO etapa_cambiada: la primera vez en cada etapa, y un retroceso no la adelanta;
//     un cita_agendada (cuya etapa_que_marca es agendado) no aparece — mutaciones: sumar los tipos con
//     etapa_que_marca, `max` en vez de `min`;
//   · negocio.embudo_por_dia cuenta a cada lead una vez por etapa, en el día LOCAL de la cuenta — mutación: el día en
//     UTC;
//   · negocio.trayectoria_del_lead trae etapas, Salida, cuadrantes, respuestas (con el nombre del campo del CRM),
//     toques, citas, resultados y llamadas analizadas, y NUNCA el teléfono, el correo, el nombre ni el texto de un
//     mensaje, tampoco escondidos en una respuesta: un campo de nombre, otro teléfono (con o sin el del lead), el del
//     lead escrito sin el código de país, el nombre entero, una parte o el primer nombre, un campo sin catalogar; y
//     los montos (con puntos, o en un campo numérico) y el nombre del negocio SÍ salen — mutaciones: devolver el
//     contacto entero, sacar cada regla de negocio.es_dato_de_contacto, dejar pasar los campos sin catalogar;
//   · sus «etapas» son TODOS los etapa_cambiada por hora, con el retroceso y la etapa de antes — mutación: volver a la
//     vista etapas_del_lead (sólo la primera entrada);
//   · sus «eventos» son, por hora, los de los tipos con catalogo.tipos_de_evento.para_la_trayectoria (las etiquetas,
//     la cita, el cuadrante), no los demás, y sus datos pasan sin nada de contacto; marcar otro tipo en el catálogo lo
//     suma — mutaciones: sin el filtro del catálogo, los datos sin negocio.datos_para_la_trayectoria;
//   · corre bajo la RLS de quien la llama: otra organización no ve nada (security invoker).
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import type { Client } from 'pg';
import { cerrarTodo, conectar, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { ambitoDeUnCliente } from '../../lib/negocio/ambitoDelCliente.ts';

const SLUG = 'trayectoria-323';
const TELEFONO = '+51 987 654 321';
const CORREO = 'lead323@ejemplo.test';
const NOMBRE = 'Persona Trescientos Veintitres';
const MENSAJE = 'texto privado del mensaje 323';

let admin: Client;
let org: string;
let cuenta: string;
let lead: string;

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  for (const t of ['resultados', 'contactos', 'campos_del_crm', 'carpetas_del_crm']) {
    await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  }
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

/** Un evento etapa_cambiada, como lo escribe el aviso del CRM (el inquilino, con insertInto). */
async function etapa(contactoId: string, etapa_: string, ocurrio: string, retrocede = false, anterior: string | null = null): Promise<void> {
  await conOrganizacion(ambitoDeUnCliente(org, cuenta), () =>
    datos()
      .insertInto('eventos')
      .values({
        org_id: org,
        cuenta_id: cuenta,
        ocurrio_el: new Date(ocurrio),
        tipo: 'etapa_cambiada',
        contacto_id: contactoId,
        actor_tipo: 'sistema',
        fuente: 'ghl',
        id_externo: `prueba-323:${contactoId}:${etapa_}:${ocurrio}`,
        datos: JSON.stringify({ etapa: etapa_, etapa_anterior: anterior, via: 'aviso', retrocede }),
      })
      .execute(),
  );
}

before(async () => {
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Trayectoria 323', $1, 'America/Lima') returning id`,
    [SLUG],
  );
  assert.ok(o);
  org = o.id;
  cuenta = (await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [org]))!.id;
  await admin.query(`update identidad.cuentas set zona_horaria = 'America/Lima' where id = $1`, [cuenta]);
  await admin.query(
    `insert into negocio.carpetas_del_crm (org_id, cuenta_id, carpeta_id, nombre, grupo) values ($1, $2, 'cp323', 'Contact', 'calificacion')`,
    [org, cuenta],
  );
  // Un campo con nombre (para la respuesta) y uno de teléfono (que no puede salir).
  await admin.query(
    `insert into negocio.campos_del_crm (org_id, cuenta_id, campo_id, nombre, carpeta_id, tipo, visto_el) values
       ($1, $2, 'cf323neg', 'Tipo de negocio', 'cp323', 'TEXT', now()),
       ($1, $2, 'cf323tel', 'Teléfono alterno', 'cp323', 'PHONE', now()),
       ($1, $2, 'cf323otro', 'Notas', 'cp323', 'TEXT', now()),
       ($1, $2, 'cf323nom', 'Nombre y apellido', 'cp323', 'TEXT', now()),
       ($1, $2, 'cf323alt', 'Número alterno', 'cp323', 'TEXT', now()),
       ($1, $2, 'cf323puntos', 'Mi dato', 'cp323', 'TEXT', now()),
       ($1, $2, 'cf323parte', 'Contacto', 'cp323', 'TEXT', now()),
       ($1, $2, 'cf323pila', 'Quién decide', 'cp323', 'TEXT', now()),
       ($1, $2, 'cf323monto', 'Facturación', 'cp323', 'NUMERICAL', now()),
       ($1, $2, 'cf323texto', 'Facturación en texto', 'cp323', 'TEXT', now()),
       ($1, $2, 'cf323negocio', 'Nombre del negocio', 'cp323', 'TEXT', now())`,
    [org, cuenta],
  );
  lead = (
    await unaFila<{ id: string }>(
      admin,
      `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, telefono, email, cuadrante, salida, palabra_clave,
                                      ultimo_entrante_texto, campos_del_crm, atribucion_primera)
       values ($1, $2, 'lead323', $3, $4, $5, 'prioriza', 'seguimiento', 'quiero', $6, $7::jsonb, $8::jsonb) returning id`,
      [
        org, cuenta, NOMBRE, TELEFONO, CORREO, MENSAJE,
        JSON.stringify({
          cf323neg: 'Clínica',
          cf323tel: '+51 999 111 222',
          cf323otro: `escríbeme a ${CORREO}`,
          // Un campo de nombre, otro teléfono, el del lead sin código de país (con puntos, que la secuencia no ve),
          // una parte del nombre, el primer nombre en una frase y un campo sin catalogar: cada uno lo ve UNA regla.
          cf323nom: 'P. T. Veintitrés',
          cf323alt: '+51 944 555 666',
          cf323puntos: '987.654.321',
          cf323parte: 'Trescientos Veintitrés',
          cf323pila: 'decide persona, la dueña',
          cfdesconocido323: 'algo sin catalogar',
          // Y lo que sí sale: montos y el nombre del negocio.
          cf323monto: '15000000',
          cf323texto: 'Facturo 5.000.000 al mes',
          cf323negocio: 'Clínica Sonrisas',
        }),
        JSON.stringify({ adId: '323001', utmSource: 'facebook', fbclid: 'IwAR323', url: 'https://landing.example/?email=x' }),
      ],
    )
  )!.id;
  await admin.query(
    `insert into negocio.mensajes (org_id, cuenta_id, contacto_id, ghl_mensaje_id, direccion, autor, canal, cuerpo, enviado_el)
     values ($1, $2, $3, 'msg323', 'entrante', 'contacto', 'TYPE_WHATSAPP', $4, now())`,
    [org, cuenta, lead, MENSAJE],
  );
  await admin.query(
    `insert into negocio.citas (org_id, cuenta_id, ghl_evento_id, contacto_id, inicio_el, titulo, estado_ghl)
     values ($1, $2, 'cita323', $3, now() + interval '1 day', $4, 'confirmed')`,
    [org, cuenta, lead, `Llamada con ${NOMBRE}`],
  );
});

after(async () => {
  try {
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('etapas_del_lead lee sólo etapa_cambiada: la primera vez en cada etapa, y un retroceso no la adelanta', async () => {
  // El lead ya tiene una cita (un cita_agendada, cuya etapa_que_marca es agendado): no cuenta, porque la etapa la
  // registra sólo etapa_cambiada.
  await etapa(lead, 'lead', '2026-10-01T15:00:00Z');
  await etapa(lead, 'conversacion', '2026-10-02T15:00:00Z');
  await etapa(lead, 'lead', '2026-10-04T15:00:00Z', true, 'conversacion');
  const vista = await conOrganizacion(ambitoDeUnCliente(org, cuenta), () =>
    datos().selectFrom('etapas_del_lead').select(['etapa', 'orden', 'entro_el']).where('contacto_id', '=', lead).orderBy('orden').execute(),
  );
  assert.deepEqual(
    vista.map((v) => [v.etapa, v.orden, v.entro_el.toISOString()]),
    [
      ['lead', 1, '2026-10-01T15:00:00.000Z'],
      ['conversacion', 2, '2026-10-02T15:00:00.000Z'],
    ],
    'la vista mezcló otro tipo de evento, o el retroceso movió la primera fecha',
  );
});

test('el embudo cuenta a cada lead una vez por etapa, en el día local de la cuenta', async () => {
  // 03:00 UTC del 6 es todavía el 5 en Lima.
  const otro = (
    await unaFila<{ id: string }>(admin, `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre) values ($1, $2, 'otro323', 'Otro') returning id`, [org, cuenta])
  )!.id;
  await etapa(otro, 'lead', '2026-10-06T03:00:00Z');
  const filas_ = await conOrganizacion(ambitoDeUnCliente(org, cuenta), async () =>
    (
      await sql<{ dia: string; etapa: string; leads: number }>`
        select to_char(dia, 'YYYY-MM-DD') as dia, etapa, leads from negocio.embudo_por_dia
         where cuenta_id = ${cuenta} and etapa = 'lead' order by dia`.execute(datos())
    ).rows,
  );
  assert.deepEqual(filas_, [
    { dia: '2026-10-01', etapa: 'lead', leads: 1 },
    { dia: '2026-10-05', etapa: 'lead', leads: 1 },
  ]);
  const conversacion = await conOrganizacion(ambitoDeUnCliente(org, cuenta), async () =>
    (await sql<{ n: number }>`select sum(leads)::int as n from negocio.embudo_por_dia where cuenta_id = ${cuenta} and etapa = 'conversacion'`.execute(datos())).rows[0]!.n,
  );
  assert.equal(conversacion, 1);
  const lead_ = await conOrganizacion(ambitoDeUnCliente(org, cuenta), async () =>
    (await sql<{ n: number }>`select sum(leads)::int as n from negocio.embudo_por_dia where cuenta_id = ${cuenta} and etapa = 'lead'`.execute(datos())).rows[0]!.n,
  );
  assert.equal(lead_, 2, 'el lead que volvió a lead se contó dos veces');
});

test('la trayectoria trae todo lo del lead y NUNCA su teléfono, su correo, su nombre ni el texto de un mensaje', async () => {
  await admin.query(
    `insert into negocio.resultados (org_id, cuenta_id, contacto_id, salida, rol, nota, detalle)
     values ($1, $2, $3, 'seguimiento', 'closer', $4, $4)`,
    [org, cuenta, lead, `nota con ${TELEFONO}`],
  );
  const t = await conOrganizacion(ambitoDeUnCliente(org, cuenta), async () =>
    (await sql<{ t: Record<string, unknown> }>`select negocio.trayectoria_del_lead(${lead}::uuid) as t`.execute(datos())).rows[0]!.t,
  );
  assert.ok(t, 'la trayectoria vino vacía');
  assert.equal(t.cuadrante, 'prioriza');
  assert.equal(t.salida, 'seguimiento');
  assert.equal(t.palabra_clave, 'quiero');
  // TODOS los cambios de etapa, por hora: también el retroceso, con la etapa de antes (la vista da sólo la primera).
  assert.deepEqual(
    (t.etapas as { etapa: string; retrocede: boolean; etapa_anterior: string | null }[]).map((e) => [e.etapa, e.retrocede, e.etapa_anterior]),
    [['lead', false, null], ['conversacion', false, null], ['lead', true, 'conversacion']],
    'la trayectoria escondió el retroceso',
  );
  assert.deepEqual((t.cuadrantes as { cuadrante: string }[]).map((c) => c.cuadrante), ['prioriza']);
  assert.equal((t.toques as unknown[]).length, 1);
  assert.equal((t.citas as unknown[]).length, 1);
  assert.deepEqual((t.resultados as { salida: string }[]).map((r) => r.salida), ['seguimiento']);
  // La respuesta lleva el nombre del campo del CRM cuando no tiene pregunta; la de teléfono y la que esconde el correo
  // o el teléfono del lead, no salen.
  const respuestas = t.respuestas as { dato: string; valor: string }[];
  assert.deepEqual(
    respuestas.map((r) => [r.dato, r.valor]).sort(),
    [
      ['Facturación en texto', 'Facturo 5.000.000 al mes'],
      ['Facturación', '15000000'],
      ['Nombre del negocio', 'Clínica Sonrisas'],
      ['Tipo de negocio', 'Clínica'],
    ],
  );

  const texto = JSON.stringify(t);
  for (const prohibido of [
    TELEFONO, '987654321', '987.654.321', '999111222', '+51 999 111 222', '944 555 666', CORREO, NOMBRE, 'Trescientos', 'persona',
    'P. T.', 'algo sin catalogar', MENSAJE, 'IwAR323', 'landing.example',
  ]) {
    assert.ok(!texto.includes(prohibido), `la trayectoria trae «${prohibido}»`);
  }
});

test('un lead sin teléfono y de primer nombre corto: ni un número ni su nombre en una frase salen', async () => {
  const sinTelefono = (
    await unaFila<{ id: string }>(
      admin,
      `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, campos_del_crm)
       values ($1, $2, 'sintel323', 'Ana Prueba', $3::jsonb) returning id`,
      [org, cuenta, JSON.stringify({ cf323otro: 'mi cel 988776655', cf323pila: 'firma: ana prueba, gerente', cf323neg: 'Taller' })],
    )
  )!.id;
  const t = await conOrganizacion(ambitoDeUnCliente(org, cuenta), async () =>
    (await sql<{ t: { respuestas: { dato: string; valor: string }[] } }>`select negocio.trayectoria_del_lead(${sinTelefono}::uuid) as t`.execute(datos())).rows[0]!.t,
  );
  assert.deepEqual(t.respuestas.map((r) => [r.dato, r.valor]), [['Tipo de negocio', 'Taller']], 'salió un teléfono o el nombre del lead');
});

test('la trayectoria trae por hora los eventos que el catálogo marca para la IA, sin datos de contacto; otro tipo es un UPDATE', async () => {
  // En una transacción del admin que se deshace: las etiquetas del lead y el catálogo vuelven como estaban.
  await admin.query('begin');
  try {
    // Las etiquetas (hoy la única huella de asistió y de onboarding), una con el teléfono del lead adentro.
    await admin.query(`update negocio.contactos set etiquetas = array['asistio', 'llamar al 987 654 321'] where id = $1`, [lead]);
    // Un tipo que el catálogo NO marca para la IA.
    await admin.query(
      `insert into negocio.eventos (org_id, cuenta_id, ocurrio_el, tipo, contacto_id, actor_tipo, fuente, id_externo, datos)
       values ($1, $2, now(), 'visitante_unido_a_contacto', $3, 'sistema', 'landing', 'visitante-323', $4)`,
      [org, cuenta, lead, JSON.stringify({ visitante_id: '6f1c2d3e-4a5b-4c6d-8e7f-901234567890' })],
    );
    const leer = async () =>
      (
        await unaFila<{ t: { eventos: { tipo: string; ocurrio_el: string; fuente: string; actor_tipo: string; datos: Record<string, unknown> }[] } }>(
          admin,
          `select negocio.trayectoria_del_lead($1) as t`,
          [lead],
        )
      )!.t.eventos;

    const ev = await leer();
    const tipos = ev.map((e) => e.tipo);
    for (const k of ['cita_agendada', 'cuadrante_cambiado', 'etiqueta_agregada']) assert.ok(tipos.includes(k), `la trayectoria no trae ${k}`);
    // Los de etapa y Salida ya van enteros en sus secciones; el técnico no es para la IA.
    for (const k of ['etapa_cambiada', 'visitante_unido_a_contacto']) assert.ok(!tipos.includes(k), `la trayectoria trae ${k}`);
    const horas = ev.map((e) => Date.parse(e.ocurrio_el));
    assert.deepEqual(horas, [...horas].sort((a, b) => a - b), 'los eventos no vienen por hora');
    const cita_ = ev.find((e) => e.tipo === 'cita_agendada')!;
    assert.deepEqual([cita_.fuente, cita_.actor_tipo, typeof cita_.datos.cita_id, typeof cita_.datos.para_el], ['ghl', 'sistema', 'string', 'string']);
    // La etiqueta que esconde el teléfono pierde su texto; la otra sale.
    assert.deepEqual(
      ev.filter((e) => e.tipo === 'etiqueta_agregada').map((e) => e.datos.etiqueta ?? null).sort(),
      ['asistio', null],
    );
    assert.ok(!JSON.stringify(ev).includes('987 654 321'), 'un evento trajo el teléfono del lead');

    // Que la IA vea un tipo más es una fila de catálogo, no otra función.
    await admin.query(`update catalogo.tipos_de_evento set para_la_trayectoria = true where clave = 'visitante_unido_a_contacto'`);
    assert.ok((await leer()).some((e) => e.tipo === 'visitante_unido_a_contacto'), 'marcar el tipo en el catálogo no lo sumó');
  } finally {
    await admin.query('rollback');
  }
});

test('la trayectoria corre bajo la RLS de quien la llama: otra organización no ve nada', async () => {
  const beta = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = 'beta'`);
  assert.ok(beta, 'falta el sembrado');
  const t = await conOrganizacion(beta.id, async () =>
    (await sql<{ t: unknown }>`select negocio.trayectoria_del_lead(${lead}::uuid) as t`.execute(datos())).rows[0]!.t,
  );
  assert.equal(t, null, 'otra organización leyó la trayectoria de un lead ajeno');
  const etapas = await conOrganizacion(beta.id, () => datos().selectFrom('etapas_del_lead').select('etapa').where('contacto_id', '=', lead).execute());
  assert.deepEqual(etapas, []);
});
