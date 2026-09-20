// El embudo del formulario de la landing, contra la base de verdad. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE ARCHIVO PROTEGE ES UNA CIFRA QUE EL DOCUMENTO FUNCIONAL PIDE POR SU NOMBRE
//
// `CC_Arquitectura_Funcional.md:1425` es la ÚNICA frase que el documento pone en boca de Conversion
// en 1.651 líneas: *«La finalización del formulario es baja.»* Este módulo la contesta, así que un
// defecto acá no es una columna torcida: es la pantalla entera diciendo otra cosa.
//
// ── LOS CUATRO SILENCIOS, QUE SON LO QUE MÁS SE PRUEBA ─────────────────────
//
//  1 · **El campo no existe en el CRM** ⟹ el bloque se apaga y lo DICE. No publica ceros: que el CRM
//      no tenga el campo no significa que nadie abandone el formulario.
//  2 · **Nadie llegó al formulario en la ventana** ⟹ lo dice, y dice desde cuándo. Medido: ningún
//      contacto creado desde el 2026-08-31 lo trae, y el campo **sigue existiendo en el CRM** — no
//      lo borró nadie, dejó de haber quien lo llenara.
//  3 · **Un valor fuera del vocabulario** ⟹ se cuenta y se informa, NO se fuerza a una rama. Es lo
//      mismo que `consumoDelPrecall.ts:74-85` hace con `-20%` y `Clic a link`.
//  4 · **Menos contactos que el piso** ⟹ se muestran los conteos y no la tasa.
//
// ── Y LA CONTRADICCIÓN QUE TIENE QUE SER VISIBLE ───────────────────────────
//
// El campo dice `Agendado` **121** veces y las citas alcanzables de esos contactos son **47**.
// Publicar el campo como fuente de agendamiento crearía la tercera cifra de agendamiento del
// producto. Medido después: a 30 días las dos coinciden (27 y 27) y sólo divergen en el histórico,
// o sea que **el campo no miente: las citas viejas se congelaron**. Por eso el aviso dice «una cita
// que el CRM siga devolviendo» y no «el campo se equivoca».
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { embudoDelFormulario } from '../../lib/negocio/embudoDelFormulario.ts';
import { CAMPO_DEL_FORMULARIO } from '../../lib/negocio/recorrido.ts';
import { PISO_DE_UNA_TASA } from '../../lib/negocio/indicadoresDeCitas.ts';

let esc: Escenario;

const CONTACTO = 'embudo-';
const CAMPO = 'campo-form-prueba';
const CARPETA = 'carpeta-form-prueba';

async function limpiar(): Promise<void> {
  await esc.admin.query(
    'delete from negocio.citas where contacto_id in (select id from negocio.contactos where ghl_contact_id like $1)',
    [`${CONTACTO}%`],
  );
  await esc.admin.query('delete from negocio.contactos where ghl_contact_id like $1', [`${CONTACTO}%`]);
  await esc.admin.query('delete from negocio.campos_del_crm where campo_id = $1', [CAMPO]);
  await esc.admin.query('delete from negocio.carpetas_del_crm where carpeta_id = $1', [CARPETA]);
}

/** El campo en el catálogo. Sin él, `campoPorNombre` devuelve nulo y el bloque se apaga. */
async function sembrarElCampo(): Promise<void> {
  await esc.admin.query(
    `insert into negocio.carpetas_del_crm (org_id, carpeta_id, nombre, visto_el)
       values ($1, $2, 'Prueba', now()) on conflict do nothing`,
    [esc.org, CARPETA],
  );
  await esc.admin.query(
    `insert into negocio.campos_del_crm (org_id, campo_id, nombre, carpeta_id, tipo, posicion, visto_el)
       values ($1, $2, $3, $4, 'SINGLE_OPTIONS', 1, now()) on conflict do nothing`,
    [esc.org, CAMPO, CAMPO_DEL_FORMULARIO, CARPETA],
  );
}

async function unContacto(o: { estado?: string | null; cita?: boolean; hace?: number }): Promise<void> {
  const ghl = `${CONTACTO}${randomUUID().slice(0, 8)}`;
  const r = await esc.admin.query<{ id: string }>(
    `insert into negocio.contactos
       (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, campos_del_crm)
     values ($1, $2, 'Lead de prueba', 'setter', now() - make_interval(days => $3::int), $4::jsonb)
     returning id`,
    [esc.org, ghl, o.hace ?? 1, JSON.stringify(o.estado == null ? {} : { [CAMPO]: o.estado })],
  );
  if (o.cita) {
    await esc.admin.query(
      `insert into negocio.citas (org_id, contacto_id, ghl_evento_id, ghl_calendario_id, inicio_el, fin_el, estado_ghl)
         values ($1, $2, $3, 'cal-embudo', now() - interval '2 hours', now() - interval '1 hour', 'confirmed')`,
      [esc.org, r.rows[0]?.id, `cita-${ghl}`],
    );
  }
}

const leer = (dias = 30) => conOrganizacion(esc.org, () => embudoDelFormulario(dias));
const estado = async (e: string, dias = 30) =>
  (await leer(dias)).filas.find((f) => f.estado === e)?.contactos;

before(async () => {
  esc = await montar('EmbudoDelFormulario');
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

// ─── LA CIFRA QUE EL DOCUMENTO PIDE ───────────────────────────────────────────

test('la finalización cuenta a los que COMPLETARON, agendaran o no', async () => {
  /* Los dos estados que cuentan como completado son `Agendado` y `Form completo sin agendar`: quien
     llenó el formulario y no reservó **sí lo completó**, y meterlo entre los abandonos confundiría
     dos problemas distintos —uno de formulario y otro de oferta—.
     *
     * Los conteos van desparejos a propósito: 5 + 3 de 10 da 80 %, que no coincide con ninguna otra
     * combinación plausible. Contar sólo `Agendado` daría 50 %, y contarlos todos daría 100 %. */
  await limpiar();
  await sembrarElCampo();
  for (let i = 0; i < 5; i += 1) await unContacto({ estado: 'Agendado' });
  for (let i = 0; i < 3; i += 1) await unContacto({ estado: 'Form completo sin agendar' });
  for (let i = 0; i < 2; i += 1) await unContacto({ estado: 'Form incompleto sin agendar' });

  const r = await leer();

  assert.equal(r.cobertura.con, 10);
  assert.equal(r.finalizacion, 80, `salió ${r.finalizacion}: 50 sería contar sólo los agendados`);
  assert.equal(await estado('Form incompleto sin agendar'), 2);
});

test('la cobertura dice cuántos llegaron al formulario, sobre la cohorte ENTERA', async () => {
  /* «El 80 % completa el formulario» y «el 80 % de los 10 que llegaron a verlo, que son 10 de 30»
     son dos afirmaciones distintas, y sólo la segunda se puede usar para decidir. */
  await limpiar();
  await sembrarElCampo();
  for (let i = 0; i < 10; i += 1) await unContacto({ estado: 'Agendado' });
  for (let i = 0; i < 20; i += 1) await unContacto({ estado: null });

  const r = await leer();

  assert.equal(r.cobertura.con, 10);
  assert.equal(r.cobertura.sobre, 30, 'el denominador son los que traen el campo, no la cohorte');
});

// ─── LOS CUATRO SILENCIOS ─────────────────────────────────────────────────────

test('sin el campo en el CRM, el bloque se apaga y lo DICE', async () => {
  /* El silencio 1. Publicar ceros acá afirmaría que nadie completa el formulario, que es una
     afirmación sobre el negocio hecha con cero datos. */
  await limpiar();
  for (let i = 0; i < 5; i += 1) await unContacto({ estado: 'Agendado' });

  const r = await leer();

  assert.equal(r.campoDelFormulario, null);
  assert.equal(r.finalizacion, null, 'publicó una tasa sin el campo que la define');
  assert.match(String(r.aviso), /no tiene un campo/i);
  assert.match(String(r.aviso), /no es que nadie/i, 'no descarta la lectura equivocada');
});

test('con el campo pero sin nadie que lo traiga, dice desde cuándo y que el campo sigue existiendo', async () => {
  /* El silencio 2, y es el caso REAL de septiembre: 335 contactos en la ventana y 63 con el campo,
     cero desde el 2026-08-31. La frase «el campo sigue existiendo en el CRM» es la que evita que
     alguien salga a buscar un campo borrado que nadie borró. */
  await limpiar();
  await sembrarElCampo();
  await unContacto({ estado: 'Agendado', hace: 200 });
  for (let i = 0; i < 5; i += 1) await unContacto({ estado: null, hace: 1 });

  const r = await leer(30);

  assert.equal(r.cobertura.con, 0);
  assert.equal(r.cobertura.sobre, 5);
  assert.match(String(r.aviso), /el último fue el/i, 'no dice desde cuándo');
  assert.match(String(r.aviso), /sigue existiendo/i, 'manda a buscar un campo que nadie borró');
});

test('un valor fuera del vocabulario se cuenta y se informa, NO se fuerza a una rama', async () => {
  /* El silencio 3. `negocio.campos_del_crm` no guarda las opciones declaradas de un campo, así que
     contar los huérfanos es la ÚNICA forma de enterarse de que el CRM agregó un cuarto valor.
     *
     * Y las dos mitades van juntas: si el huérfano se forzara a «incompleto», el conteo de esa rama
     * sería 2 en vez de 1 y la finalización bajaría de 50 % a 33 % — una cifra plausible y falsa. */
  await limpiar();
  await sembrarElCampo();
  await unContacto({ estado: 'Agendado' });
  await unContacto({ estado: 'Form incompleto sin agendar' });
  await unContacto({ estado: 'Form a medio llenar con reintento' });

  const r = await leer();

  assert.equal(r.fueraDelVocabulario, 1);
  assert.equal(await estado('Form incompleto sin agendar'), 1, 'forzó el huérfano a una rama conocida');
  assert.match(String(r.aviso), /no se fuerzan/i, 'no avisa del valor desconocido');
  /* El huérfano SÍ cuenta en la cobertura: llegó al formulario, sea cual sea su estado. */
  assert.equal(r.cobertura.con, 3);
});

test('bajo el piso se muestran los conteos y no la tasa', async () => {
  /* El silencio 4. Con cuatro contactos, «el 75 % completa» se lee igual que un 75 % sobre
     doscientos, y el próximo caso lo mueve veinticinco puntos. */
  await limpiar();
  await sembrarElCampo();
  for (let i = 0; i < PISO_DE_UNA_TASA - 1; i += 1) await unContacto({ estado: 'Agendado' });

  const r = await leer();

  assert.equal(r.cobertura.con, PISO_DE_UNA_TASA - 1);
  assert.equal(r.finalizacion, null, 'publicó una tasa bajo el piso');
  assert.equal(await estado('Agendado'), PISO_DE_UNA_TASA - 1, 'el conteo se perdió con la tasa');
  assert.match(String(r.aviso), new RegExp(`${PISO_DE_UNA_TASA} contactos`));
});

// ─── LA CONTRADICCIÓN CON LAS CITAS ───────────────────────────────────────────

test('el campo dice «Agendado» y las citas mandan: la diferencia viaja y se dice', async () => {
  /* Medido: el campo dice 121 y las citas alcanzables son 47. Si esta pantalla publicara el campo
     como agendamiento, diría 121 donde Acquisition y Conversation dicen 47, y nadie tendría cómo
     saber cuál de las tres está mal.
     *
     * Las dos mitades: el conteo del campo y el de las citas viajan por separado —colapsarlos
     * escondería la contradicción— y el aviso la nombra. */
  await limpiar();
  await sembrarElCampo();
  for (let i = 0; i < 3; i += 1) await unContacto({ estado: 'Agendado', cita: true });
  for (let i = 0; i < 2; i += 1) await unContacto({ estado: 'Agendado', cita: false });

  const r = await leer();

  assert.equal(r.agendadoSegunLasCitas.segunElCampo, 5);
  assert.equal(r.agendadoSegunLasCitas.conCitaAlcanzable, 3, 'contó como cita a quien no la tiene');
  assert.match(String(r.aviso), /siga devolviendo/i, 'no dice que las dos cifras difieren');
  /* Y no acusa al campo de mentir: medido a 30 días las dos coinciden, y sólo divergen en el
     histórico porque las citas viejas se congelan. */
  assert.doesNotMatch(String(r.aviso), /el campo (miente|se equivoca)/i);
});

test('cuando las dos cifras coinciden, el aviso NO habla de ellas', async () => {
  /* La otra mitad del silencio: un aviso que aparece siempre es uno que nadie lee. */
  await limpiar();
  await sembrarElCampo();
  for (let i = 0; i < 12; i += 1) await unContacto({ estado: 'Agendado', cita: true });

  const r = await leer();

  assert.equal(r.agendadoSegunLasCitas.segunElCampo, r.agendadoSegunLasCitas.conCitaAlcanzable);
  assert.doesNotMatch(String(r.aviso ?? ''), /siga devolviendo/i, 'avisó de una diferencia que no hay');
});

// ─── LOS HUECOS DECLARADOS ────────────────────────────────────────────────────

test('los cinco huecos viajan con su motivo, incluido el del VSL', async () => {
  /* La decisión del 2026-09-20 fue declarar el VSL como hueco en pantalla. El prototipo dibujaba
     una curva de retención con 89 literales y dos caídas marcadas al segundo exacto: quien conozca
     esa pantalla la va a buscar, y un hueco que se omite no se distingue de una regresión.
     *
     * Muere si la lista se vacía, si un motivo queda corto, y si se cae el del VSL —que es el que
     * un cero publicado convertiría en «0 % de visionado», técnicamente cierto y completamente
     * engañoso—. */
  await limpiar();
  await sembrarElCampo();
  await unContacto({ estado: 'Agendado' });

  const r = await leer();

  assert.ok(r.fueraDeAlcance.length >= 5, `llegaron ${r.fueraDeAlcance.length} huecos, se esperaban 5`);
  for (const h of r.fueraDeAlcance) {
    assert.ok(h.punto.trim().length > 0, 'un hueco sin nombre');
    assert.ok(h.porque.trim().length > 40, `«${h.punto}» no dice por qué no se puede`);
  }
  assert.ok(
    r.fueraDeAlcance.some((h) => /VSL/i.test(h.punto) && /cero/i.test(h.porque)),
    'se perdió el hueco del VSL, que es el que un cero publicado volvería engañoso',
  );
});

test('ni los avisos ni los huecos llevan Markdown: la pantalla los dibuja crudos', async () => {
  /* Un `**` se lee con los asteriscos puestos dentro de un `<p>`. Ya pasó en el aviso de fatiga de
     Creative, y los textos de los huecos se dibujan igual que un aviso. */
  await limpiar();
  await sembrarElCampo();
  await unContacto({ estado: 'Form a medio llenar' });

  const r = await leer();

  assert.doesNotMatch(String(r.aviso ?? ''), /\*\*|__|\[.+\]\(/, 'el aviso lleva Markdown crudo');
  for (const h of r.fueraDeAlcance) {
    assert.doesNotMatch(h.porque, /\*\*|__/, `el hueco «${h.punto}» lleva Markdown crudo`);
  }
});

// ─── EL CORTE DE ÉPOCA ────────────────────────────────────────────────────────

test('el corte se detecta del dato y dice si la ventana lo cruza, en las dos direcciones', async () => {
  /* El corte NO se escribe como literal: es el último día con el campo escrito. Un `'2026-08-31'`
     en el código sería una cifra medida que envejece sin que nada avise.
     *
     * Las dos mitades van juntas: con sólo la primera, un `laVentanaLoCruza: true` constante
     * dejaría la prueba en verde y el aviso aparecería siempre, que es un aviso que nadie lee. */
  await limpiar();
  await sembrarElCampo();
  await unContacto({ estado: 'Agendado', hace: 100 });
  await unContacto({ estado: null, hace: 1 });

  const ancha = await leer(3650);
  assert.ok(ancha.corte.fecha, 'no detectó el corte');
  assert.equal(ancha.corte.laVentanaLoCruza, true, 'una ventana que abarca el corte dice que no lo cruza');

  const angosta = await leer(7);
  assert.equal(angosta.corte.fecha, ancha.corte.fecha, 'el corte cambió con la ventana');
  assert.equal(angosta.corte.laVentanaLoCruza, false, 'una ventana posterior al corte dice que lo cruza');
});
