// La tasa de respuesta de Lead Flow. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL INDICADOR QUE PARECÍA BLOQUEADO Y NO LO ESTABA
//
// Lead Flow estaba dado por imposible hasta que `mensajes.fuente` acumulara historia, porque la
// atribución no distingue al agente de un flujo del CRM — medido, el 71,5 % de lo sellado con el
// identificador del agente es `workflow`.
//
// Esa objeción no alcanza a ESTE indicador: el denominador es «tiene un saliente» y el numerador
// «tiene un entrante», y ninguno necesita saber quién escribió de nuestro lado. Lo que sigue
// esperando es la pregunta más fina —«de lo que escribió el AGENTE, cuánto se contestó»—.
//
// Y las dos cifras medidas que le dan forma a esto, el 2026-09-14 sobre zona setter:
//
//     alta hace más de 14 días   129 escritos   36 contestaron   27,9 %
//     alta en los últimos 14     119 escritos   81 contestaron   68,1 %
//
// Cuarenta puntos, y NO es un agujero de datos: 93 de esos 129 viejos recibieron mensajes y nunca
// contestaron. Es un hecho del negocio, y por eso la cohorte se acota.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { DIAS_DE_LA_TASA } from '../../lib/negocio/indicadoresDeCitas.ts';
import { respuestaDelLead } from '../../lib/negocio/respuestaDelLead.ts';

let admin: Client;
let alfa: string;

const MARCA = 'resp-lead';

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
    await datos().deleteFrom('mensajes').execute();
    await datos().deleteFrom('contactos').where('ghl_contact_id', 'like', `${MARCA}%`).execute();
  });
}

/**
 * Un contacto con sus mensajes. `salientes` y `entrantes` son cuántos de cada uno — varios a
 * propósito, para que la prueba distinga «contactos» de «mensajes».
 */
async function contacto(opciones: {
  zona?: 'setter' | 'closer' | null;
  altaHaceDias?: number;
  salientes?: number;
  entrantes?: number;
}): Promise<void> {
  const { zona = 'setter', altaHaceDias = 1, salientes = 1, entrantes = 0 } = opciones;
  await conOrganizacion(alfa, async () => {
    const c = await datos()
      .insertInto('contactos')
      .values({
        ghl_contact_id: `${MARCA}-${randomUUID().slice(0, 8)}`,
        nombre: 'Lead de prueba',
        territorio: zona,
      } as never)
      .returning('id')
      .executeTakeFirstOrThrow();

    /* `creado_el` tiene `default now()`, así que para envejecer el contacto hay que escribirla a
       mano después. Es la única forma de ejercitar la cohorte sin esperar catorce días. */
    await datos()
      .updateTable('contactos')
      .set(sqlDeFecha(altaHaceDias))
      .where('id', '=', c.id)
      .execute();

    const filasDeMensajes = [
      ...Array.from({ length: salientes }, () => ({ direccion: 'saliente' as const })),
      ...Array.from({ length: entrantes }, () => ({ direccion: 'entrante' as const })),
    ].map((m) => ({
      ghl_mensaje_id: `${MARCA}-${randomUUID().slice(0, 10)}`,
      contacto_id: c.id,
      direccion: m.direccion,
      cuerpo: 'algo',
      autor: m.direccion === 'entrante' ? 'contacto' : 'agente',
      enviado_el: new Date(),
      estado_entrega_familia: 'entregado',
      origen: 'ingesta',
    }));
    if (filasDeMensajes.length > 0) {
      await datos().insertInto('mensajes').values(filasDeMensajes as never).execute();
    }
  });
}

/** El `set` de la fecha de alta, apartado para que el fixture de arriba se lea. */
function sqlDeFecha(haceDias: number): Record<string, unknown> {
  return { creado_el: new Date(Date.now() - haceDias * 86_400_000) };
}

const leer = () => conOrganizacion(alfa, () => respuestaDelLead());

// ─── La tasa ────────────────────────────────────────────────────────────────

test('la tasa es de CONTACTOS que contestaron, no de mensajes', async () => {
  /* La diferencia que un `join` con `distinct` se come: un contacto con veinte salientes y una
     respuesta cuenta UNA vez, no veinte. Sin eso, el contacto más conversado domina la cifra. */
  await limpiar();
  await contacto({ salientes: 20, entrantes: 1 });
  await contacto({ salientes: 1, entrantes: 0 });

  const r = await leer();
  assert.equal(r.escritos, 2, 'el denominador cuenta mensajes en vez de contactos');
  assert.equal(r.respondieron, 1);
  assert.equal(r.tasa, 50);
});

test('un contacto al que NO se le escribió no entra al denominador', async () => {
  /* No pudo contestar, así que meterlo bajaría la tasa sin que nadie hiciera nada mal. Y si son
     varios se dice, porque la cifra habla de menos contactos de los que la zona tiene. */
  await limpiar();
  await contacto({ salientes: 1, entrantes: 1 });
  await contacto({ salientes: 0 });
  await contacto({ salientes: 0 });

  const r = await leer();
  assert.equal(r.cohorte, 3);
  assert.equal(r.escritos, 1, 'entró al denominador alguien a quien no se le escribió');
  assert.equal(r.tasa, 100);
  assert.ok(r.aviso, 'se excluyeron dos contactos y no se dijo');
  assert.match(r.aviso, /no se les? escribió/i);
});

test('la zona del CLOSER no cuenta: Lead Flow es del setter', async () => {
  /* Y hay un motivo más fuerte que el alcance: los contactos que agendan SE VAN a zona closer, así
     que incluirlos metería en la cohorte justo a los que ya convirtieron. Medido: de 280 contactos en
     zona setter sólo 2 tienen cita, porque los demás se mudaron. */
  await limpiar();
  await contacto({ zona: 'setter', salientes: 1, entrantes: 0 });
  await contacto({ zona: 'closer', salientes: 1, entrantes: 1 });

  const r = await leer();
  assert.equal(r.cohorte, 1, 'entró un contacto de la zona del closer');
  assert.equal(r.tasa, 0);
});

test('un contacto CONGELADO tampoco cuenta', async () => {
  // Territorio nulo: perdió las dos etiquetas. No está en la zona de nadie.
  await limpiar();
  await contacto({ zona: 'setter', salientes: 1, entrantes: 1 });
  await contacto({ zona: null, salientes: 1, entrantes: 0 });

  assert.equal((await leer()).cohorte, 1, 'entró un contacto congelado');
});

// ─── La cohorte ─────────────────────────────────────────────────────────────

test('LA COHORTE: un contacto viejo no entra, y por eso la cifra no se diluye', async () => {
  /* ── LA MEDICIÓN QUE OBLIGA A ESTO ────────────────────────────────────────
   *
   * Sobre zona setter el 2026-09-14: los dados de alta hace más de catorce días contestan el 27,9 %
   * y los recientes el 68,1 %. Cuarenta puntos.
   *
   * Y no es un agujero de datos —se comprobó que los viejos tienen mensajes guardados, y que 93 de
   * 129 recibieron mensajes y nunca contestaron— así que mezclarlos daría un promedio que no
   * describe a ninguno de los dos grupos. */
  await limpiar();
  await contacto({ altaHaceDias: 1, salientes: 1, entrantes: 1 });
  await contacto({ altaHaceDias: DIAS_DE_LA_TASA + 2, salientes: 1, entrantes: 0 });

  const r = await leer();
  assert.equal(r.cohorte, 1, 'entró un contacto de fuera de la cohorte');
  assert.equal(r.tasa, 100, 'un contacto viejo sin respuesta arrastró la tasa hacia abajo');
});

// ─── Los dos ceros ──────────────────────────────────────────────────────────

test('sin contactos nuevos la tasa es NULA, y el aviso dice que faltan CONTACTOS', async () => {
  await limpiar();
  const r = await leer();
  assert.equal(r.cohorte, 0);
  assert.equal(r.tasa, null, 'con cero contactos se devolvió una tasa');
  assert.match(r.aviso ?? '', /No entraron contactos/i);
});

test('con contactos pero sin escribirle a NINGUNO, el aviso dice que faltan MENSAJES', async () => {
  /* Los dos ceros de esta pantalla, y significan cosas opuestas: «nadie contesta» y «nadie
     preguntó». Sin el aviso se ven igual — un guion. */
  await limpiar();
  await contacto({ salientes: 0 });
  await contacto({ salientes: 0 });

  const r = await leer();
  assert.equal(r.cohorte, 2);
  assert.equal(r.escritos, 0);
  assert.equal(r.tasa, null);
  assert.match(r.aviso ?? '', /no se le escribió a ninguno/i);
  assert.doesNotMatch(r.aviso ?? '', /No entraron contactos/i);
});

test('con todo respondido y nadie excluido, NO avisa nada', async () => {
  /* La mitad que falta en casi toda prueba de avisos: sin ella, una implementación que avisa siempre
     pasa las demás. Y un aviso que aparece siempre se aprende a ignorar. */
  await limpiar();
  await contacto({ salientes: 1, entrantes: 1 });
  await contacto({ salientes: 1, entrantes: 1 });

  const r = await leer();
  assert.equal(r.tasa, 100);
  assert.equal(r.aviso, null, 'avisó sin tener nada que advertir');
});
