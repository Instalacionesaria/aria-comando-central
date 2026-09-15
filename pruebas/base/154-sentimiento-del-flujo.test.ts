// Cómo estaba el contacto en las conversaciones juzgadas. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE ARCHIVO CUIDA: EL DENOMINADOR, QUE TIENE TRES POBLACIONES ADENTRO
//
// `analisis_del_agente.sentimiento is null` significa tres cosas distintas. Censo completo el
// 2026-09-14:
//
//     auditable, disparo <> mejora    20 filas   ← las ÚNICAS que producen sentimiento
//     auditable, disparo = mejora     14 filas   ← el carril de mejora escribe null a propósito
//     no auditable                    12 filas   ← nunca se llamó al modelo
//
// Sobre las 46 la distribución diría «43 % sin dato», que suena a un problema de las conversaciones
// y es una descripción de los carriles del propio auditor. Las dos primeras pruebas son las que
// impiden ese denominador.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { PISO_DE_UNA_TASA } from '../../lib/negocio/indicadoresDeCitas.ts';
import { sentimientoDelFlujo } from '../../lib/auditor/sentimiento.ts';

let admin: Client;
let alfa: string;
let contacto: string;

const MARCA = 'sent-flujo';
const POST = 'chat_post_agenda';
const PRE = 'chat_pre_agenda';

before(async () => {
  admin = await conectar('admin');
  const o = await filas<{ id: string }>(admin, `select id from identidad.organizaciones where slug='alfa'`);
  assert.equal(o.length, 1, 'falta la organización cliente del sembrado');
  alfa = o[0]!.id;
  await limpiarTodo();
  contacto = await conOrganizacion(alfa, async () => {
    const c = await datos()
      .insertInto('contactos')
      .values({ ghl_contact_id: `${MARCA}-c`, nombre: 'Contacto juzgado', territorio: 'closer' } as never)
      .returning('id')
      .executeTakeFirstOrThrow();
    return c.id;
  });
});

after(async () => {
  await limpiarTodo();
  await cerrarTodo();
  await cerrarClientes();
});

const limpiar = () =>
  conOrganizacion(alfa, () => datos().deleteFrom('analisis_del_agente').execute());

async function limpiarTodo(): Promise<void> {
  await conOrganizacion(alfa, async () => {
    await datos().deleteFrom('analisis_del_agente').execute();
    await datos().deleteFrom('contactos').where('ghl_contact_id', 'like', `${MARCA}%`).execute();
  });
}

/** Un análisis. Los valores por omisión son los del carril que SÍ produce sentimiento. */
async function analisis(o: {
  sentimiento?: string | null;
  auditable?: boolean;
  disparo?: string;
  agente?: string;
  haceDias?: number;
}): Promise<void> {
  const {
    sentimiento = 'neutral',
    auditable = true,
    disparo = 'debounce',
    agente = POST,
    haceDias = 1,
  } = o;
  await conOrganizacion(alfa, () =>
    datos()
      .insertInto('analisis_del_agente')
      .values({
        contacto_id: contacto,
        agente,
        auditable,
        disparo,
        sentimiento,
        /* La base exige el motivo cuando `auditable` es falso —`analisis_motivo_de_no_auditable`—
           y tiene razón: una fila que dice «no se pudo auditar» y no dice por qué es exactamente el
           cero indistinguible que este proyecto persigue. El fixture lo respeta en vez de esquivarlo. */
        no_auditable_motivo: auditable ? null : 'sin_lineas_del_agente',
        analizado_el: new Date(Date.now() - haceDias * 86_400_000),
        /* `mensajes_del_agente` es el antirrebote y es obligatorio: sin él el `insert` falla, y su
           valor no importa acá porque esta cifra no lo mira. */
        mensajes_del_agente: 2,
        /* ── LA FILA NO AUDITABLE TIENE OTRA FORMA, Y LA BASE LA HACE CUMPLIR ──
         *
         * `analisis_no_auditable_sin_nivel` exige `nivel is null` cuando no se auditó, y
         * `analisis_motivo_de_no_auditable` exige el motivo. Son dos `check` bien puestos: una fila
         * que dice «no se pudo auditar» y trae un veredicto verde afirma dos cosas incompatibles.
         *
         * El fixture los respeta en vez de esquivarlos — sembrar una fila que la base no aceptaría
         * haría que la prueba midiera sobre un estado que en producción no existe. */
        intervencion: false,
        nivel: auditable ? 'verde' : null,
        resumen: 'Un análisis sembrado.',
      } as never)
      .execute(),
  );
}

const leer = (agente = POST) => conOrganizacion(alfa, () => sentimientoDelFlujo(agente as never));

// ─── El denominador ─────────────────────────────────────────────────────────

test('EL DENOMINADOR: el carril de MEJORA no entra, aunque sea auditable', async () => {
  /* Escribe `sentimiento: null` a propósito —analiza para reescribir un prompt, no para juzgar una
     conversación— y son 14 de las 34 filas auditables. Con `auditable` sola como filtro, el 41 % de
     la muestra serían análisis a los que nunca se les preguntó esto. */
  await limpiar();
  for (let i = 0; i < PISO_DE_UNA_TASA; i++) await analisis({ sentimiento: 'neutral' });
  for (let i = 0; i < 8; i++) await analisis({ sentimiento: null, disparo: 'mejora' });

  const r = await leer();
  assert.equal(r.juzgadas, PISO_DE_UNA_TASA, 'entraron análisis del carril de mejora');
  assert.equal(r.porValor.neutral, PISO_DE_UNA_TASA);
});

test('EL DENOMINADOR: los NO AUDITABLES tampoco, porque nunca se llamó al modelo', async () => {
  /* Un análisis no auditable no tiene veredicto que dar: no hay líneas del agente, o hay menos de
     dos intercambios. Contarlo como «sin sentimiento» afirmaría algo sobre esa conversación. */
  await limpiar();
  for (let i = 0; i < PISO_DE_UNA_TASA; i++) await analisis({ sentimiento: 'molesto' });
  for (let i = 0; i < 7; i++) await analisis({ sentimiento: null, auditable: false });

  const r = await leer();
  assert.equal(r.juzgadas, PISO_DE_UNA_TASA, 'entraron análisis no auditables');
  assert.equal(r.molestos, 100);
});

test('cada agente cuenta lo SUYO: son dos conversaciones distintas', async () => {
  /* Mezclarlas daría un promedio que no describe a ninguna. Y hoy el caso es extremo: medido, los
     20 veredictos son de post-agenda y pre-agenda no tiene ni uno. */
  await limpiar();
  for (let i = 0; i < PISO_DE_UNA_TASA; i++) await analisis({ sentimiento: 'molesto', agente: POST });
  for (let i = 0; i < PISO_DE_UNA_TASA; i++) await analisis({ sentimiento: 'positivo', agente: PRE });

  assert.equal((await leer(POST)).molestos, 100, 'se mezclaron los dos agentes');
  assert.equal((await leer(PRE)).molestos, 0);
});

test('la ventana acota: un análisis de hace 40 días no cuenta', async () => {
  await limpiar();
  for (let i = 0; i < PISO_DE_UNA_TASA; i++) await analisis({ sentimiento: 'neutral' });
  await analisis({ sentimiento: 'molesto', haceDias: 40 });

  const r = await leer();
  assert.equal(r.juzgadas, PISO_DE_UNA_TASA, 'entró un análisis fuera de la ventana');
  assert.equal(r.molestos, 0);
});

// ─── La regla del silencio ──────────────────────────────────────────────────

test('SIN CONVERSACIONES JUZGADAS el aviso lo dice, en vez de dibujar «0 % molestos»', async () => {
  /* Es el caso real de `chat_pre_agenda` hoy: 5 análisis, los 5 no auditables. Una tarjeta vacía se
     lee como que ningún contacto está molesto, y la razón verdadera —no hubo intercambios suyos que
     auditar— es lo contrario de una buena noticia. */
  await limpiar();
  for (let i = 0; i < 5; i++) await analisis({ sentimiento: null, auditable: false, agente: PRE });

  const r = await leer(PRE);
  assert.equal(r.juzgadas, 0);
  assert.equal(r.molestos, null, 'con cero conversaciones se devolvió una proporción');
  assert.match(String(r.aviso), /no es que los contactos estén conformes/i);
});

test('por debajo del piso CALLA, y el aviso explica que el ritmo es de un veredicto por día', async () => {
  /* Medido: ~1,3 veredictos/día, y el pico fue la siembra del 2026-09-01 con 10. Cuando ese día
     salga de la ventana el denominador cae de 20 a ~11: esta cifra va a cruzar el piso hacia abajo
     sola, y sin el aviso se va a leer como que el auditor dejó de funcionar. */
  await limpiar();
  for (let i = 0; i < 4; i++) await analisis({ sentimiento: 'molesto' });

  const r = await leer();
  assert.equal(r.juzgadas, 4);
  assert.equal(r.molestos, null, 'se publicó una proporción sobre cuatro conversaciones');
  assert.match(String(r.aviso), /un veredicto por día/);
});

test('UN SENTIMIENTO FUERA DEL VOCABULARIO no entra al denominador, y se avisa', async () => {
  /* Los otros dos nulos ya quedaron afuera por los dos `where`, así que el que llegue hasta acá
     sólo puede ser el cuarto caso: el modelo contestó algo que no está en la lista y `deLaLista` lo
     guardó en null. Hoy son cero filas, y ése sí sería un defecto.

     Sumarlo al denominador bajaría las tres proporciones sin que nadie sepa por qué; ignorarlo lo
     haría invisible justo el día que el modelo empiece a contestar otra cosa. */
  await limpiar();
  for (let i = 0; i < PISO_DE_UNA_TASA; i++) await analisis({ sentimiento: 'molesto' });
  for (let i = 0; i < 2; i++) await analisis({ sentimiento: null });

  const r = await leer();
  assert.equal(r.juzgadas, PISO_DE_UNA_TASA + 2, 'las filas raras no se contaron');
  assert.equal(r.molestos, 100, 'las filas sin vocabulario entraron al denominador y bajaron la cifra');
  assert.match(String(r.aviso), /no debería pasar/);
});

test('las tres claves están SIEMPRE, aunque un valor no aparezca', async () => {
  /* Sin esto, la pantalla tendría que distinguir «cero molestos» de «la clave no vino», y las dos
     se ven igual en un objeto. Es el mismo criterio que `enCero()` en la atribución del auditor. */
  await limpiar();
  for (let i = 0; i < PISO_DE_UNA_TASA; i++) await analisis({ sentimiento: 'neutral' });

  const r = await leer();
  assert.deepEqual(Object.keys(r.porValor).sort(), ['molesto', 'neutral', 'positivo']);
  assert.equal(r.porValor.molesto, 0);
  assert.equal(r.molestos, 0, 'cero molestos sobre diez juzgadas SÍ es una cifra: es un cero medido');
});
