// El indicador de atraso del barrido automático. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTE ARCHIVO EXISTE
//
// Porque **el modo de fallar de un cron es el silencio**, y hasta ahora el sistema estaba construido
// para no verlo: los dos lugares que leen el pulso de la ingesta tienen tres ramas cada uno y ninguna
// compara la última corrida contra ahora. Un pulso de hace seis semanas se leía igual que uno de hace
// un minuto.
//
// Y no es teórico: medido el 2026-08-26, el cron quedó registrado apuntando a una URL que responde
// 302 al muro de SSO. Puede estar corriendo o no, y la única evidencia era una consulta a mano.
//
// Las cuatro cosas que se pueden romper acá, y las cuatro dan la misma cara —una pantalla que se ve
// bien—:
//
//   1 · **Colapsar «nunca corrió» con «corrió hace mucho».** Mandan a investigar cosas distintas: la
//       primera es la configuración del despliegue, la segunda es por qué se cortó.
//   2 · **Comparar con `=== null` en vez de contra el umbral.** Es exactamente lo que hacen los dos
//       lectores viejos, y es la razón de ser de este archivo.
//   3 · **Avisar cuando está al día.** Un aviso que aparece siempre se aprende a ignorar, y entonces
//       el día que importa tampoco se lee.
//   4 · **Meterlo en `falta`.** Ahí solo se dibuja con la lista vacía, así que el atraso sería
//       invisible justo cuando hay datos — el caso donde la pantalla se ve completa y no lo está.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { frescuraDe } from '../../lib/negocio/frescura.ts';
import { HORARIOS, type Tarea } from '../../lib/negocio/barrido.ts';
import { agendaDelCloser } from '../../lib/negocio/agenda.ts';
import { mensajesDeLaFicha } from '../../lib/negocio/ficha.ts';

const ZONA = 'America/Lima';

let admin: Client;
let alfa: string;

before(async () => {
  admin = await conectar('admin');
  const a = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug='alfa'`);
  assert.ok(a);
  alfa = a.id;
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

async function limpiar(): Promise<void> {
  await admin.query('delete from negocio.tareas_programadas');
  await admin.query('delete from negocio.ingesta_pulso');
  await admin.query('delete from negocio.contactos');
}

/** Un sello de hace N minutos. Se escribe con el reloj de la BASE, que es el que la lectura usa. */
async function sello(tarea: Tarea, haceMinutos: number, estado = 'corrio'): Promise<void> {
  await admin.query(
    `insert into negocio.tareas_programadas (org_id, tarea, ultima_corrida_el, ultimo_estado)
     values ($1, $2, now() - ($3 || ' minutes')::interval, $4)
     on conflict (org_id, tarea) do update
        set ultima_corrida_el = excluded.ultima_corrida_el, ultimo_estado = excluded.ultimo_estado`,
    [alfa, tarea, String(haceMinutos), estado],
  );
}

const leer = (tarea: Tarea) => conOrganizacion(alfa, () => frescuraDe(tarea));

/** El umbral que el mapa de horarios declara para una tarea. Se lee del mapa, no se escribe acá. */
function umbral(tarea: Tarea): number {
  return Math.max(
    ...Object.values(HORARIOS)
      .filter((h) => (h.tareas as readonly Tarea[]).includes(tarea))
      .map((h) => h.umbralMinutos),
  );
}

// ─── 1 · Los tres estados, y son tres ──────────────────────────────────────

test('SIN sello: «nunca corrió», y es distinto de «corrió hace mucho»', async () => {
  await limpiar();
  const f = await leer('mensajes');
  assert.equal(f.estado, 'nunca');
  assert.equal(f.minutos, null, 'sin sello no hay «hace cuánto»: inventarlo sería un 1970');
  assert.ok(f.aviso);
  assert.match(f.aviso, /nunca corrió/i);
  // Y NO dice «hace X»: no hay X.
  assert.doesNotMatch(f.aviso, /hace \d/i);
});

test('con el sello RECIÉN puesto: al día, y NO avisa nada', async () => {
  // La mitad que falta en casi todas las pruebas de este tipo. Sin ella, una implementación que
  // avisa siempre pasa las otras dos.
  await limpiar();
  await sello('mensajes', 0);
  const f = await leer('mensajes');
  assert.equal(f.estado, 'al_dia');
  assert.equal(f.aviso, null, 'avisó estando al día: un aviso que aparece siempre se ignora');
});

test('con el sello VIEJO: atrasada, y dice hace cuánto', async () => {
  await limpiar();
  const u = umbral('mensajes');
  await sello('mensajes', u + 120);
  const f = await leer('mensajes');
  assert.equal(f.estado, 'atrasada');
  assert.ok(f.minutos !== null && f.minutos >= u + 119, `minutos=${f.minutos}`);
  assert.ok(f.aviso);
  assert.match(f.aviso, /hace/i);
  assert.doesNotMatch(f.aviso, /nunca/i, 'lo confundió con «nunca corrió»');
});

test('EL BORDE: justo en el umbral está al día; un minuto más, atrasada', async () => {
  // Es la comparación que decide todo, y la mutación que la rompe —`>=` por `>`— no se ve leyendo.
  await limpiar();
  const u = umbral('citas');

  await sello('citas', u - 1);
  assert.equal((await leer('citas')).estado, 'al_dia', 'un minuto antes del umbral ya avisaba');

  await sello('citas', u + 5);
  assert.equal((await leer('citas')).estado, 'atrasada', 'cinco minutos pasado el umbral no avisó');
});

test('el umbral viaja en la respuesta, y es el del mapa de horarios', async () => {
  // Sin esto la pantalla tendría que saber cada cuánto corre cada tarea — o sea, una segunda copia
  // del mapa, que es como las dos se separan.
  await limpiar();
  await sello('mensajes', 5);
  const f = await leer('mensajes');
  assert.equal(f.umbralMinutos, umbral('mensajes'));
});

test('el sello de una tarea NO afecta a la otra', async () => {
  // Comparten tabla y se distinguen por una columna. Sin el `where tarea`, un barrido de citas
  // fresco haría creer que los mensajes están al día.
  await limpiar();
  await sello('citas', 0);
  assert.equal((await leer('citas')).estado, 'al_dia');
  assert.equal((await leer('mensajes')).estado, 'nunca', 'el sello de citas tapó el de mensajes');
});

test('un sello de OTRA empresa no cuenta como propio', async () => {
  // La política aísla por organización, y se comprueba igual: si fallara, una empresa vería el
  // barrido de otra como si fuera el suyo — y el aviso desaparecería sin que nada corriera acá.
  await limpiar();
  const beta = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug='beta'`);
  assert.ok(beta);
  await admin.query(
    `insert into negocio.tareas_programadas (org_id, tarea, ultima_corrida_el, ultimo_estado)
     values ($1, 'mensajes', now(), 'corrio')`,
    [beta.id],
  );
  assert.equal((await leer('mensajes')).estado, 'nunca');
});

test('un sello de una tarea que NO corrió igual cuenta como paso del cron', async () => {
  // `saltada` significa «el cron pasó y esta empresa no tiene credencial». No es un atraso: el
  // barrido está corriendo. Tratarlo como atraso mandaría a revisar la tarea programada cuando lo
  // que falta es un token.
  await limpiar();
  await sello('mensajes', 1, 'saltada');
  const f = await leer('mensajes');
  assert.equal(f.estado, 'al_dia');
  assert.equal(f.aviso, null);
});

// ─── 2 · Que llegue a las dos pantallas, y no dentro de `falta` ─────────────

test('la AGENDA lleva la frescura, y NO la mete en `falta`', async () => {
  await limpiar();
  await sello('citas', umbral('citas') + 200);
  // Se marca el pulso como corrido para que `falta` de la agenda sea el texto del cero medido: así
  // se puede comprobar que las dos cosas conviven en vez de pisarse.
  await admin.query(
    `insert into negocio.ingesta_pulso (org_id, clave, ultima_corrida_el) values ($1,'citas',now())
     on conflict (org_id, clave) do update set ultima_corrida_el = now()`,
    [alfa],
  );

  const a = await conOrganizacion(alfa, () => agendaDelCloser(ZONA, { dias: 3 }));
  assert.equal(a.frescura.estado, 'atrasada');
  assert.ok(a.frescura.aviso);
  // Y `falta` sigue hablando de lo suyo: por qué no hay citas, no de cuándo corrió el barrido.
  assert.ok(a.falta);
  assert.doesNotMatch(a.falta, /hace \d+ (minutos|horas|días)/, 'el atraso se metió dentro de `falta`');
});

test('el CHAT lleva la frescura HAYA o no mensajes', async () => {
  // La regla que hace útil todo esto. `falta` solo se calcula con la lista vacía; el atraso tiene
  // que verse igual con mensajes a la vista, porque ése es el caso engañoso.
  await limpiar();
  await sello('mensajes', umbral('mensajes') + 300);

  const contactoId = await conOrganizacion(alfa, async () => {
    const c = await datos()
      .insertInto('contactos')
      .values({ ghl_contact_id: `f-${randomUUID()}`, nombre: 'Con mensajes', territorio: 'closer' } as never)
      .returning('id')
      .executeTakeFirstOrThrow();
    return c.id;
  });

  // Sin mensajes: hay `falta` Y hay frescura.
  const vacio = await conOrganizacion(alfa, () => mensajesDeLaFicha(contactoId));
  assert.equal(vacio.filas.length, 0);
  assert.ok(vacio.falta, 'un cero de mensajes sin motivo afirma que nadie escribió');
  assert.equal(vacio.frescura.estado, 'atrasada');

  // Con un mensaje: `falta` se apaga y la frescura SIGUE.
  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('mensajes')
      .values({
        contacto_id: contactoId,
        ghl_mensaje_id: `m-${randomUUID()}`,
        direccion: 'entrante',
        autor: 'contacto',
        cuerpo: 'hola',
        enviado_el: new Date(),
      } as never)
      .execute();
  });

  const conUno = await conOrganizacion(alfa, () => mensajesDeLaFicha(contactoId));
  assert.equal(conUno.filas.length, 1);
  assert.equal(conUno.falta, null, 'con mensajes no hay nada que faltar');
  assert.equal(
    conUno.frescura.estado,
    'atrasada',
    'la frescura se apagó al haber mensajes: es justo el caso donde hace falta',
  );
  assert.ok(conUno.frescura.aviso);
});
