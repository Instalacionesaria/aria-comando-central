// La ficha de una persona en Leads Portal, contra la base de verdad. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE ARCHIVO PROTEGE
//
// La ficha es la única respuesta de la pestaña que trae el teléfono y el correo, y la que lee la
// atribución cruda. Tres cosas no pueden pasar, y ninguna falla por sí sola:
//
//   · **Que muestre a alguien de otra empresa**, o que ante un id que no encuentra rellene con otro
//     contacto —la maqueta copiaba la ficha del primero y le cambiaba el nombre—.
//   · **Que escriba.** La ficha del closer refresca contra el CRM al abrirse; ésta no, y si lo hiciera
//     gastaría presupuesto del proveedor y podría mover el territorio de alguien por mirarlo.
//   · **Que diga algo distinto que su fila.** El estado de la cita, la asistencia y el tramo salen de
//     los mismos fragmentos que la rejilla; si la tarjeta dice «sin registrar», la ficha también.
//
// Siembra con el prefijo `ficha-portal-` sobre la organización `alfa`, y limpia lo suyo.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { fichaDelLeadDelPortal } from '../../lib/negocio/fichaDelLeadDelPortal.ts';
import { leadsDelPortal } from '../../lib/negocio/leadsDelPortal.ts';
import { CAMPO_DEL_PUNTAJE } from '../../lib/ghl/contrato.ts';
import { CAMPO_DEL_PRECALL } from '../../lib/negocio/consumoDelPrecall.ts';

let esc: Escenario;

const PREFIJO = 'ficha-portal-';
const CORREO = '@ficha-portal.ejemplo';
const CARPETA_CALIFICACION = 'ficha-portal-cal';
const CARPETA_SIN_GRUPO = 'ficha-portal-sin';
const CARPETA_INTERACCIONES = 'ficha-portal-int';
const CAMPO_PREGUNTA = 'ficha-portal-q1';
const CAMPO_SIN_GRUPO = 'ficha-portal-q2';
const CAMPO_PRECALL = 'ficha-portal-pre';
/** Un JWT de ejemplo. Nunca fue un token de nadie. */
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwcnVlYmEifQ.firmaQueNoValeNada';

async function limpiar(): Promise<void> {
  const mios = 'select id from negocio.contactos where ghl_contact_id like $1';
  await esc.admin.query(`delete from negocio.resultados where contacto_id in (${mios})`, [`${PREFIJO}%`]);
  await esc.admin.query(`delete from negocio.citas where contacto_id in (${mios})`, [`${PREFIJO}%`]);
  await esc.admin.query('delete from negocio.contactos where ghl_contact_id like $1', [`${PREFIJO}%`]);
  /* Por CARPETA y no por id: el campo del puntaje se siembra con su id real (`CAMPO_DEL_PUNTAJE`),
     que no lleva el prefijo, y un borrado por id lo dejaría en el catálogo de `alfa` para la prueba
     siguiente. */
  await esc.admin.query('delete from negocio.campos_del_crm where carpeta_id like $1', [`${PREFIJO}%`]);
  await esc.admin.query('delete from negocio.carpetas_del_crm where carpeta_id like $1', [`${PREFIJO}%`]);
  await esc.admin.query(
    `delete from negocio.closer_asignado where usuario_id in
       (select id from identidad.usuarios where email like $1)`,
    [`%${CORREO}`],
  );
  await esc.admin.query('delete from identidad.usuarios where email like $1', [`%${CORREO}`]);
}

/** El catálogo: una carpeta de calificación, una sin grupo y la de interacciones con el precall. */
async function elCatalogo(): Promise<void> {
  for (const [carpeta, nombre, grupo] of [
    [CARPETA_CALIFICACION, 'Score | ICP Nuevo', 'calificacion'],
    [CARPETA_SIN_GRUPO, 'OLD FIELDS', null],
    [CARPETA_INTERACCIONES, 'Interacciones', 'interacciones'],
  ] as const) {
    await esc.admin.query(
      `insert into negocio.carpetas_del_crm (org_id, carpeta_id, nombre, grupo) values ($1, $2, $3, $4)
       on conflict do nothing`,
      [esc.org, carpeta, nombre, grupo],
    );
  }
  for (const [campo, nombre, carpeta] of [
    [CAMPO_PREGUNTA, 'Objetivo de facturación', CARPETA_CALIFICACION],
    /* El campo del puntaje, EN la carpeta de calificación, que es donde vive en producción. */
    [CAMPO_DEL_PUNTAJE, 'Puntaje | ICP', CARPETA_CALIFICACION],
    [CAMPO_SIN_GRUPO, 'Campo viejo', CARPETA_SIN_GRUPO],
    [CAMPO_PRECALL, CAMPO_DEL_PRECALL, CARPETA_INTERACCIONES],
  ] as const) {
    await esc.admin.query(
      `insert into negocio.campos_del_crm (org_id, campo_id, nombre, carpeta_id, tipo, posicion)
       values ($1, $2, $3, $4, 'TEXT', 1) on conflict do nothing`,
      [esc.org, campo, nombre, carpeta],
    );
  }
}

async function unContacto(o: {
  org?: string;
  score?: number | null;
  etiquetas?: string[];
  territorio?: 'closer' | 'setter' | null;
  atribucion?: Record<string, string>;
  campos?: Record<string, string>;
  asignadoA?: string | null;
  historiaLeida?: boolean;
  citas?: { haceHoras: number; estado?: string; congelada?: boolean }[];
  resultados?: { salida: string; monto?: number | null }[];
}): Promise<string> {
  const org = o.org ?? esc.org;
  const r = await esc.admin.query<{ id: string }>(
    `insert into negocio.contactos
       (org_id, ghl_contact_id, nombre, telefono, email, pais, territorio, alta_en_el_crm,
        sincronizado_el, score, etiquetas, atribucion_primera, campos_del_crm, crm_asignado_a,
        mensajes_desde_el)
     values ($1, $2, 'Persona de prueba', '+51 999 000 111', 'persona@ejemplo.test', 'PE', $3,
             now() - interval '3 days', now() - interval '1 day', $4, $5::text[], $6::jsonb,
             $7::jsonb, $8, $9)
     returning id`,
    [
      org,
      `${PREFIJO}${randomUUID().slice(0, 8)}`,
      o.territorio === undefined ? 'closer' : o.territorio,
      o.score === undefined ? 70 : o.score,
      o.etiquetas ?? [],
      JSON.stringify(o.atribucion ?? {}),
      JSON.stringify(o.campos ?? {}),
      o.asignadoA ?? null,
      o.historiaLeida ? new Date(Date.now() - 10 * 86_400_000) : null,
    ],
  );
  const id = r.rows[0]!.id;
  for (const [i, c] of (o.citas ?? []).entries()) {
    const inicio = new Date(Date.now() + c.haceHoras * 3600_000);
    await esc.admin.query(
      `insert into negocio.citas (org_id, contacto_id, ghl_evento_id, ghl_calendario_id, inicio_el, fin_el, estado_ghl)
       values ($1, $2, $3, $4, $5::timestamptz, $5::timestamptz + interval '1 hour', $6)`,
      [org, id, `cita-${id}-${i}`, c.congelada ? null : 'cal-ficha', inicio, c.estado ?? 'confirmed'],
    );
  }
  for (const res of o.resultados ?? []) {
    await esc.admin.query(
      `insert into negocio.resultados (org_id, contacto_id, salida, rol, registrado_por, monto)
       values ($1, $2, $3, 'closer', $4, $5)`,
      [org, id, res.salida, org === esc.org ? esc.quien : null, res.monto ?? null],
    );
  }
  return id;
}

const ficha = (id: string) => conOrganizacion(esc.org, () => fichaDelLeadDelPortal(id));

before(async () => {
  esc = await montar('FichaDelLeadDelPortal');
  await limpiar();
  await elCatalogo();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

// ─── QUIÉN ────────────────────────────────────────────────────────────────────

test('el contacto de otra empresa no tiene ficha, y un id que no existe tampoco: nunca hay relleno', async () => {
  const ajeno = await unContacto({ org: esc.otraOrg });
  await unContacto({});
  assert.equal(await ficha(ajeno), null, 'la ficha mostró a alguien de otra empresa');
  assert.equal(await ficha(randomUUID()), null, 'un id que no existe devolvió una ficha');
});

test('la ficha trae el teléfono y el correo: es la única respuesta de la pestaña que los trae', async () => {
  const id = await unContacto({});
  const f = (await ficha(id))!;
  assert.equal(f.telefono, '+51 999 000 111');
  assert.equal(f.email, 'persona@ejemplo.test');
  assert.equal(f.pais, 'PE');
});

// ─── NO ESCRIBE ───────────────────────────────────────────────────────────────

test('la ficha no escribe: el contacto queda idéntico, y no aparece ni una fila nueva', async () => {
  /* La ficha del closer refresca contra el CRM; ésta no. Se compara la fila ENTERA —`to_jsonb`— y no
     un par de columnas: un refresco que tocara sólo `sincronizado_el` o sólo el territorio tiene que
     verse igual. */
  const id = await unContacto({ citas: [{ haceHoras: -3 }] });
  const foto = async () => {
    const r = await esc.admin.query<{ fila: unknown; n: string }>(
      `select to_jsonb(c) as fila,
              (select count(*) from negocio.contactos) + (select count(*) from negocio.citas)
              + (select count(*) from negocio.resultados) + (select count(*) from negocio.mensajes) as n
         from negocio.contactos c where c.id = $1`,
      [id],
    );
    return r.rows[0];
  };
  const antes = await foto();
  await ficha(id);
  assert.deepEqual(await foto(), antes, 'abrir la ficha cambió algo en la base');
});

// ─── EL PUNTAJE ───────────────────────────────────────────────────────────────

test('el 0 viaja como 0, en «Sin calificar», y con su motivo', async () => {
  const cero = (await ficha(await unContacto({ score: 0 })))!;
  assert.equal(cero.puntaje.valor, 0, 'el 0 se volvió nulo: la ficha no puede decir «0, se cuenta como sin calificar»');
  assert.equal(cero.puntaje.tramo, 'sin_calificar');
  assert.equal(cero.puntaje.motivo, 'en_cero');

  const nulo = (await ficha(await unContacto({ score: null })))!;
  assert.equal(nulo.puntaje.motivo, 'sin_puntaje');

  const alto = (await ficha(await unContacto({ score: 82 })))!;
  assert.equal(alto.puntaje.rotulo, 'ICP alto');
  assert.equal(alto.puntaje.motivo, null);
});

// ─── LO MISMO QUE SU FILA ─────────────────────────────────────────────────────

test('la ficha dice lo mismo que su fila de la rejilla: cita, asistencia, plantón y tramo', async () => {
  const casos = [
    await unContacto({ citas: [{ haceHoras: -3 }] }),
    await unContacto({ citas: [{ haceHoras: -3, estado: 'noshow' }] }),
    await unContacto({ citas: [{ haceHoras: +30 }] }),
    await unContacto({ citas: [{ haceHoras: -3, congelada: true }] }),
    await unContacto({ score: 0 }),
  ];
  const cohorte = await conOrganizacion(esc.org, () => leadsDelPortal(30));
  for (const id of casos) {
    const fila = cohorte.leads.find((l) => l.id === id)!;
    const f = (await ficha(id))!;
    assert.equal(f.recorrido.agendo.estado, fila.cita, 'la ficha y la fila no coinciden en la cita');
    assert.equal(f.recorrido.asistio.asistencia, fila.asistencia, 'la ficha y la fila no coinciden en la asistencia');
    assert.equal(f.recorrido.asistio.planton, fila.planton);
    assert.equal(f.puntaje.tramo, fila.tramo);
  }
});

test('«agendó y canceló»: todas sus citas alcanzables están canceladas', async () => {
  const cancelo = (await ficha(await unContacto({ citas: [{ haceHoras: -3, estado: 'cancelled' }] })))!;
  assert.equal(cancelo.recorrido.agendo.estado, 'agendo');
  assert.equal(cancelo.recorrido.agendo.todasCanceladas, true);
  assert.ok(cancelo.recorrido.agendo.primeraCitaEl);

  const mixta = (await ficha(
    await unContacto({ citas: [{ haceHoras: -3, estado: 'cancelled' }, { haceHoras: +20 }] }),
  ))!;
  assert.equal(mixta.recorrido.agendo.todasCanceladas, false, 'una cita viva no puede decir «agendó y canceló»');
});

test('un acuerdo sin pago se dice como tal, y no como compra ni como monto reportado', async () => {
  const f = (await ficha(await unContacto({ resultados: [{ salida: 'acuerdo_sin_pago', monto: 900 }] })))!;
  assert.equal(f.recorrido.compro.vendio, false);
  assert.equal(f.recorrido.compro.acuerdoSinPago, true);
  assert.equal(f.recorrido.compro.monto, null, 'el monto de un acuerdo sin pago se mostró como reportado');
  assert.equal(f.resultados[0]?.nombre, 'Acordó comprar');
  assert.equal(f.resultados[0]?.monto, null);
});

// ─── EL CUESTIONARIO ─────────────────────────────────────────────────────────

test('el cuestionario trae el grupo de calificación, sin el puntaje y sin los campos sin grupo', async () => {
  const f = (await ficha(
    await unContacto({
      score: 70,
      campos: {
        [CAMPO_PREGUNTA]: 'Más de 10 mil',
        [CAMPO_DEL_PUNTAJE]: '70',
        [CAMPO_SIN_GRUPO]: 'Esto no se muestra',
        [CAMPO_PRECALL]: 'Nada',
      },
    }),
  ))!;
  assert.deepEqual(f.cuestionario, [{ etiqueta: 'Objetivo de facturación', valor: 'Más de 10 mil' }]);
  assert.ok(!JSON.stringify(f).includes('Esto no se muestra'), 'un campo sin grupo apareció en la ficha');
});

test('el precall se muestra como el texto del CRM, y «Nada» se lee como que no se registró reproducción', async () => {
  const f = (await ficha(await unContacto({ campos: { [CAMPO_PRECALL]: 'Nada' } })))!;
  assert.equal(f.precall.valor, 'Nada');
  assert.equal(f.precall.sinReproduccionRegistrada, true);
  const vio = (await ficha(await unContacto({ campos: { [CAMPO_PRECALL]: '76–100%' } })))!;
  assert.equal(vio.precall.sinReproduccionRegistrada, false);
});

// ─── EL VSL Y LOS HUECOS ─────────────────────────────────────────────────────

test('el VSL es siempre un hueco declarado, con su fecha, y ninguna ficha lo trae como dato', async () => {
  const f = (await ficha(await unContacto({})))!;
  assert.ok(f.huecos.medidoEl, 'los huecos viajan sin fecha: se leerían como un hecho permanente');
  assert.ok(f.huecos.lista.some((h) => h.donde === 'vsl'), 'el VSL no está entre los huecos');
  assert.ok(f.huecos.lista.some((h) => h.donde === 'calificacion'), 'fit e intent no están entre los huecos');
});

// ─── LA PUBLICIDAD ───────────────────────────────────────────────────────────

test('de la dirección de entrada viaja sólo el sitio, sacado por la base; la IP y el JWT no viajan', async () => {
  const f = (await ficha(
    await unContacto({
      atribucion: {
        utmSource: 'facebook',
        url: `https://Accelerator.AriaIA.com:443/vsl?token=${JWT}`,
        referrer: `https://l.facebook.com/l.php?h=${JWT}`,
        ip: '203.0.113.9',
        userAgent: 'NavegadorDePrueba/1.0',
      },
    }),
  ))!;
  const texto = JSON.stringify(f);
  assert.equal(f.publicidad.find((p) => p.clave === 'url')?.valor, 'accelerator.ariaia.com');
  assert.equal(f.publicidad.find((p) => p.clave === 'referrer')?.valor, 'l.facebook.com');
  assert.ok(!texto.includes('eyJhbGci'), 'el JWT de la dirección viajó en la ficha');
  assert.ok(!texto.includes('203.0.113.9'), 'la IP viajó en la ficha');
  assert.ok(!texto.includes('NavegadorDePrueba'), 'el navegador viajó en la ficha');
});

// ─── EL CONTACTO ─────────────────────────────────────────────────────────────

test('el closer asignado se dice por su nombre, y el id del CRM no viaja nunca', async () => {
  const persona = await esc.admin.query<{ id: string }>(
    `insert into identidad.usuarios (org_id, nombre, email, password_hash, creado_por)
     values ($1, 'Closer de Prueba', $2, 'scrypt$16384$8$1$c2FsCg==$aGFzaAo=', null) returning id`,
    [esc.org, `${randomUUID().slice(0, 8)}${CORREO}`],
  );
  await esc.admin.query(
    `insert into negocio.closer_asignado (org_id, usuario_id, crm_usuario_id) values ($1, $2, 'crm-ficha-portal-1')`,
    [esc.org, persona.rows[0]!.id],
  );

  const suyo = (await ficha(await unContacto({ asignadoA: 'crm-ficha-portal-1' })))!;
  assert.deepEqual(suyo.closer, { estado: 'asignado', nombre: 'Closer de Prueba' });

  const ajeno = (await ficha(await unContacto({ asignadoA: 'crm-de-otro-usuario' })))!;
  assert.deepEqual(ajeno.closer, { estado: 'no_configurado' });
  assert.ok(!JSON.stringify(ajeno).includes('crm-de-otro-usuario'), 'el id crudo del CRM viajó en la ficha');

  const nadie = (await ficha(await unContacto({ asignadoA: null })))!;
  assert.deepEqual(nadie.closer, { estado: 'sin_asignar' });
});

test('de las etiquetas viajan sólo las de descarte; y sin la historia leída no hay conteo de mensajes', async () => {
  const f = (await ficha(await unContacto({ etiquetas: ['ICP_Rechazado', 'etiqueta-interna-vip'] })))!;
  assert.deepEqual(f.descarte, ['ICP_Rechazado']);
  assert.ok(!JSON.stringify(f).includes('etiqueta-interna-vip'), 'una etiqueta cruda que no es de descarte viajó');
  assert.equal(f.mensajes.historiaLeida, false);
  assert.equal(f.mensajes.entrantes, null, 'sin la historia leída, un 0 diría «nunca escribió»');

  const leida = (await ficha(await unContacto({ historiaLeida: true })))!;
  assert.equal(leida.mensajes.entrantes, 0);
});

test('un congelado se dice congelado, con la fecha de su última sincronización', async () => {
  const f = (await ficha(await unContacto({ territorio: null })))!;
  assert.equal(f.territorio, 'congelado');
  assert.ok(f.sincronizadoEl, 'la ficha de un congelado tiene que decir de cuándo es la foto');
});
