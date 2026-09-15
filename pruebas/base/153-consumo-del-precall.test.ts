// Cuánto del video precall consumieron los que llegaron a la llamada. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA TRAMPA QUE ESTE ARCHIVO EXISTE PARA IMPEDIR
//
// `Nada` y `Sin abrir (0%)` son el ESTADO INICIAL que el CRM escribe al agendar, no una medición de
// que alguien no vio el video. La evidencia medida el 2026-09-14 no admite otra lectura: de las
// **13 citas futuras** de la subcuenta, las 13 ya tienen el campo escrito y **11 ya dicen «sin
// reproducción»** — su llamada todavía no ocurrió.
//
// Por eso la población excluye las citas que no pasaron y las canceladas, y por eso la rama se
// llama «el CRM no registró reproducción» y no «no vio el video». Las dos pruebas de población son
// las que de verdad cuidan la cifra; las del vocabulario cuidan que no se invente.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { PISO_DE_UNA_TASA } from '../../lib/negocio/indicadoresDeCitas.ts';
import { CAMPO_DEL_PRECALL, consumoDelPrecall } from '../../lib/negocio/consumoDelPrecall.ts';

let admin: Client;
let alfa: string;

const MARCA = 'precall';
const CAMPO = 'cf-precall';

before(async () => {
  admin = await conectar('admin');
  const o = await filas<{ id: string }>(admin, `select id from identidad.organizaciones where slug='alfa'`);
  assert.equal(o.length, 1, 'falta la organización cliente del sembrado');
  alfa = o[0]!.id;
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

async function limpiar(): Promise<void> {
  await conOrganizacion(alfa, async () => {
    await datos().deleteFrom('citas').execute();
    await datos().deleteFrom('contactos').where('ghl_contact_id', 'like', `${MARCA}%`).execute();
    await datos().deleteFrom('campos_del_crm').where('nombre', '=', CAMPO_DEL_PRECALL).execute();
    await datos().deleteFrom('carpetas_del_crm').where('carpeta_id', '=', 'fo-pre').execute();
  });
}

/** El campo en el catálogo. Su carpeta va SIN grupo: es el estado real de producción. */
async function elCampo(): Promise<void> {
  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('carpetas_del_crm')
      .values({ carpeta_id: 'fo-pre', nombre: 'Interacciones', grupo: null } as never)
      .onConflict((oc) => oc.doNothing())
      .execute();
    await datos()
      .insertInto('campos_del_crm')
      .values({
        campo_id: CAMPO,
        nombre: CAMPO_DEL_PRECALL,
        carpeta_id: 'fo-pre',
        tipo: 'RADIO',
        posicion: 1,
      } as never)
      .onConflict((oc) => oc.doNothing())
      .execute();
  });
}

/** Un contacto con su valor del campo y una cita. */
async function conCita(
  valor: string | null,
  cita: { cuando?: 'pasada' | 'futura'; estado?: string; calendario?: string | null } = {},
): Promise<void> {
  const { cuando = 'pasada', estado = 'confirmed', calendario = 'cal1' } = cita;
  await conOrganizacion(alfa, async () => {
    const c = await datos()
      .insertInto('contactos')
      .values({
        ghl_contact_id: `${MARCA}-${randomUUID().slice(0, 8)}`,
        nombre: 'Contacto con precall',
        territorio: 'closer',
        campos_del_crm: valor === null ? '{}' : JSON.stringify({ [CAMPO]: valor }),
      } as never)
      .returning('id')
      .executeTakeFirstOrThrow();

    await datos()
      .insertInto('citas')
      .values({
        ghl_evento_id: `${MARCA}-${randomUUID().slice(0, 8)}`,
        contacto_id: c.id,
        inicio_el:
          cuando === 'futura'
            ? new Date(Date.now() + 2 * 86_400_000)
            : new Date(Date.now() - 86_400_000),
        estado_ghl: estado,
        ghl_calendario_id: calendario,
      } as never)
      .execute();
  });
}

const leer = () => conOrganizacion(alfa, () => consumoDelPrecall());

// ─── La población ───────────────────────────────────────────────────────────

test('EL DEFECTO: una cita FUTURA no entra, porque su valor inicial diría que no lo vio', async () => {
  /* ═══════════════════════════════════════════════════════════════════════════
   * Medido en producción: de las 13 citas futuras de la subcuenta, las 13 ya tienen el campo y 11
   * dicen «sin reproducción». Su llamada no ocurrió: el valor es el que el CRM escribe AL AGENDAR.
   *
   * Sin este filtro, cada cita agendada para la semana que viene entraría como un lead que ignoró
   * el video — y la cifra empeoraría cuanto MÁS se agende, que es exactamente al revés.
   * ═══════════════════════════════════════════════════════════════════════════ */
  await limpiar();
  await elCampo();
  await conCita('76–100%');
  for (let i = 0; i < 5; i++) await conCita('Nada', { cuando: 'futura' });

  const r = await leer();
  assert.equal(r.sobre, 1, 'entraron citas que todavía no ocurrieron');
  assert.equal(r.completo, 1);
});

test('una cita CANCELADA no entra: quien canceló no tenía motivo para ver el precall', async () => {
  /* Y hay un segundo motivo, medido: la cobertura del campo es del 94,3 % entre las `confirmed` y
     del 48,9 % entre las `cancelled`, así que «tener el campo» es consecuencia de no haber
     cancelado. Incluirlas haría que el grupo «sin dato» fuera un espejo de las cancelaciones. */
  await limpiar();
  await elCampo();
  await conCita('76–100%');
  for (let i = 0; i < 4; i++) await conCita('Nada', { estado: 'cancelled' });

  assert.equal((await leer()).sobre, 1, 'entraron citas canceladas');
});

test('una cita CONGELADA tampoco entra, igual que en todas las demás cifras', async () => {
  await limpiar();
  await elCampo();
  await conCita('76–100%');
  await conCita('Nada', { calendario: null });

  assert.equal((await leer()).sobre, 1, 'entró una cita que el barrido ya no alcanza');
});

// ─── El vocabulario ─────────────────────────────────────────────────────────

test('`Nada` y `Sin abrir (0%)` van a la MISMA rama: es el mismo valor renombrado', async () => {
  /* Medido: `Sin abrir (0%)` deja de escribirse de golpe el 2026-09-08 y `Nada` ocupa su lugar, sin
     transición. Nadie dejó de no-abrir videos un martes. Si fueran a ramas distintas, cualquier
     serie temporal mostraría un derrumbe fantasma ese día. */
  await limpiar();
  await elCampo();
  for (let i = 0; i < 5; i++) await conCita('Nada');
  for (let i = 0; i < 5; i++) await conCita('Sin abrir (0%)');

  const r = await leer();
  assert.equal(r.conCampo, 10);
  assert.equal(r.registraron, 0, 'uno de los dos valores se contó como reproducción');
  assert.equal(r.tasa, 0, 'los diez son del mismo lado: la tasa tiene que ser cero, no nula');
});

test('LOS QUE NO SE PUEDEN CLASIFICAR se cuentan aparte, no se fuerzan a una rama', async () => {
  /* Hoy son 7 en producción, **más que los 3 que completaron el video**. Forzarlos movería la cifra
     con casos que nadie entendió, y en la dirección que eligiera quien los forzó. */
  await limpiar();
  await elCampo();
  for (let i = 0; i < 5; i++) await conCita('Nada');
  for (let i = 0; i < 5; i++) await conCita('76–100%');
  for (const raro of ['-20%', 'Clic a link', 'Accede: sin reproducir']) await conCita(raro);

  const r = await leer();
  assert.equal(r.sinRama, 3, 'los valores raros se colaron en alguna rama');
  assert.equal(r.conCampo, 13);
  /* Y NO entran al denominador: meterlos del lado de «no registró» afirmaría que no reprodujeron,
     que es justamente lo que no se sabe de ellos. */
  assert.equal(r.tasa, 50, 'los no clasificados entraron al denominador de la tasa');
  assert.match(String(r.aviso), /no se puede clasificar/);
});

test('las DOS escalas de porcentaje caen las dos en «vio parte»', async () => {
  /* `1–25%` usa guion largo y `40-60%` guion corto: son dos escalas distintas conviviendo en el
     mismo campo. Como RAMA caen igual, así que mapearlas no inventa nada — lo que no se puede es
     convertirlas a número, y por eso esta cifra devuelve ramas y no un porcentaje medio. */
  await limpiar();
  await elCampo();
  await conCita('1–25%');
  await conCita('40-60%');

  const r = await leer();
  assert.equal(r.parcial, 2, 'una de las dos escalas quedó sin clasificar');
  assert.equal(r.sinRama, 0);
});

// ─── La regla del silencio ──────────────────────────────────────────────────

test('el desglose fino NO se publica mientras una de sus dos ramas esté bajo el piso', async () => {
  /* Hoy lo está: «vio parte» son 6 y «lo completó» 3. Publicarlos juntos invita a compararlos, y el
     chico se mueve treinta puntos con cada contacto nuevo. Lo binario sí va: su denominador es el
     mismo y sus dos lados suman los clasificados. */
  await limpiar();
  await elCampo();
  for (let i = 0; i < 8; i++) await conCita('Nada');
  for (let i = 0; i < 2; i++) await conCita('76–100%');

  const r = await leer();
  assert.equal(r.detalleSePublica, false, 'se publicó un desglose sobre dos contactos');
  assert.equal(r.tasa, 20, 'lo binario también se ocultó: su denominador sí alcanza');
  assert.match(String(r.aviso), /desglose fino no se muestra/);
});

test('sin el campo en el catálogo se dice que MIREN EL CRM, no que nadie ve el video', async () => {
  await limpiar();
  await conCita('Nada');

  const r = await leer();
  assert.equal(r.tasa, null);
  assert.match(String(r.aviso), /no tiene un campo/);
  assert.match(String(r.aviso), /no es que nadie vea el video/);
});

test('con pocos clasificados la tasa CALLA y el aviso dice cuántos son', async () => {
  await limpiar();
  await elCampo();
  for (let i = 0; i < 3; i++) await conCita('Nada');

  const r = await leer();
  assert.ok(3 < PISO_DE_UNA_TASA, 'la prueba asume que tres está bajo el piso');
  assert.equal(r.tasa, null, 'se publicó una tasa sobre tres contactos');
  assert.match(String(r.aviso), /Con 3 clasificados/);
});
