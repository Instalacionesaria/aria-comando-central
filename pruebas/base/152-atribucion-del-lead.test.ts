// De dónde vinieron los leads que agendaron. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA PROPIEDAD QUE ESTE ARCHIVO CUIDA, Y POR QUÉ ES LA CARA
//
// Agrupar es fácil. Lo difícil es no publicar una tasa sobre seis contactos — y acá la tentación no
// es teórica: medido el 2026-09-14 en producción, las dos fuentes con la tasa **más alta** de la
// pantalla tienen ocho y seis leads:
//
//     Paid Social      113 de 222   50,9 %
//     Direct traffic     7 de   8   87,5 %
//     Social media       4 de   6   66,7 %
//
// Dibujadas como tres barras iguales, la conclusión que alguien saca es «lo pago es lo que peor
// convierte», que es una decisión de presupuesto tomada sobre catorce contactos. Con un lead más,
// «Direct traffic» salta a 88,9 % o cae a 77,8 %.
//
// Por eso lo que no llega al piso se junta en una fila **con conteo y sin tasa**. Las pruebas de
// abajo ejercitan las dos mitades: que se junte, y que la fila juntada NO traiga porcentaje.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { PISO_DE_UNA_TASA } from '../../lib/negocio/indicadoresDeCitas.ts';
import {
  atribucionDelLead,
  type FilaDeAtribucion,
} from '../../lib/negocio/atribucionDelLead.ts';

let admin: Client;
let alfa: string;

const MARCA = 'atrib-lead';

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
    await datos().deleteFrom('mensajes').execute();
    await datos().deleteFrom('contactos').where('ghl_contact_id', 'like', `${MARCA}%`).execute();
  });
}

/** Un contacto con su atribución, y opcionalmente su cita y su primer mensaje. */
async function lead(opciones: {
  fuente?: string | null;
  campana?: string | null;
  zona?: string | null;
  agendo?: boolean;
  /** Hora UTC del primer saliente. Sin esto no hay mensaje. */
  horaUtc?: number;
  altaHaceDias?: number;
}): Promise<void> {
  const { fuente = 'Paid Social', campana = null, zona = null, agendo = false, horaUtc, altaHaceDias = 1 } = opciones;
  await conOrganizacion(alfa, async () => {
    const atribucion: Record<string, string> = {};
    if (fuente !== null) atribucion.sessionSource = fuente;
    if (campana !== null) atribucion.campaign = campana;

    const c = await datos()
      .insertInto('contactos')
      .values({
        ghl_contact_id: `${MARCA}-${randomUUID().slice(0, 8)}`,
        nombre: 'Lead con atribución',
        territorio: 'setter',
        atribucion_primera: JSON.stringify(atribucion),
        zona_horaria_del_lead: zona,
      } as never)
      .returning('id')
      .executeTakeFirstOrThrow();

    const alta = new Date(Date.now() - altaHaceDias * 86_400_000);
    await datos()
      .updateTable('contactos')
      .set({ alta_en_el_crm: alta } as never)
      .where('id', '=', c.id)
      .execute();

    if (horaUtc !== undefined) {
      /* El instante se arma en UTC a propósito: la prueba compara contra la zona del LEAD, y si el
         fixture usara la hora local de la máquina, la misma prueba daría distinto en Lima y en
         Tokio. La suite corre en las tres. */
      const d = new Date(alta);
      d.setUTCHours(horaUtc, 0, 0, 0);
      await datos()
        .insertInto('mensajes')
        .values({
          ghl_mensaje_id: `${MARCA}-${randomUUID().slice(0, 10)}`,
          contacto_id: c.id,
          direccion: 'saliente',
          cuerpo: 'hola',
          autor: 'agente',
          enviado_el: d,
          estado_entrega_familia: 'entregado',
          origen: 'ingesta',
        } as never)
        .execute();
    }

    if (agendo) {
      await datos()
        .insertInto('citas')
        .values({
          ghl_evento_id: `${MARCA}-${randomUUID().slice(0, 10)}`,
          contacto_id: c.id,
          inicio_el: new Date(alta.getTime() + 3_600_000),
          estado_ghl: 'confirmed',
          ghl_calendario_id: 'cal1',
        } as never)
        .execute();
    }
  });
}

const leer = () => conOrganizacion(alfa, () => atribucionDelLead());
const fila = (f: FilaDeAtribucion[], nombre: string) => f.find((x) => x.etiqueta === nombre);

// ─── El corte ───────────────────────────────────────────────────────────────

test('la cohorte se parte por fuente, y cada fila tiene su propia tasa', async () => {
  await limpiar();
  for (let i = 0; i < PISO_DE_UNA_TASA; i++) await lead({ fuente: 'Paid Social', agendo: i < 5 });
  for (let i = 0; i < PISO_DE_UNA_TASA; i++) await lead({ fuente: 'Referral', agendo: i < 9 });

  const r = await leer();
  assert.equal(fila(r.porFuente, 'Paid Social')?.tasa, 50);
  assert.equal(fila(r.porFuente, 'Referral')?.tasa, 90);
});

test('LA CARA: una fuente por debajo del piso NO recibe una tasa propia', async () => {
  /* La prueba central del archivo. En producción las dos fuentes chicas tienen las tasas más altas
     de la pantalla: dibujarlas al lado de la grande invierte la lectura del negocio. */
  await limpiar();
  for (let i = 0; i < PISO_DE_UNA_TASA; i++) await lead({ fuente: 'Paid Social', agendo: i < 5 });
  // Tres leads de una fuente chica, los tres agendaron: sería un 100 % sobre tres contactos.
  for (let i = 0; i < 3; i++) await lead({ fuente: 'Direct traffic', agendo: true });

  const r = await leer();
  assert.equal(
    fila(r.porFuente, 'Direct traffic'),
    undefined,
    'una fuente de tres contactos recibió su propia fila con tasa',
  );
  const otras = fila(r.porFuente, 'Otras');
  assert.ok(otras, 'los leads de la fuente chica desaparecieron en vez de juntarse');
  assert.equal(otras.cohorte, 3, 'el conteo de los chicos se perdió');
  assert.equal(otras.agendaron, 3);
  assert.equal(otras.tasa, null, 'la fila «Otras» trae una tasa: es lo que no puede pasar');
  assert.equal(otras.esElResto, true);
});

test('LAS FILAS SUMAN LA COHORTE: un lead sin fuente no desaparece', async () => {
  /* Si un contacto sin la clave se cayera del corte, la tabla mostraría menos leads que la tarjeta
     de al lado y nadie tendría cómo detectar cuál de las dos está mal. Va a «Otras», no a una fila
     llamada «null» — que en pantalla se lee como una categoría con ese nombre. */
  await limpiar();
  for (let i = 0; i < PISO_DE_UNA_TASA; i++) await lead({ fuente: 'Paid Social' });
  await lead({ fuente: null });
  await lead({ fuente: null });

  const r = await leer();
  const total = r.porFuente.reduce((n, f) => n + f.cohorte, 0);
  assert.equal(total, PISO_DE_UNA_TASA + 2, 'las filas no suman la cohorte: se perdió alguien');
  assert.equal(fila(r.porFuente, 'Otras')?.cohorte, 2);
});

test('el corte por campaña usa el NOMBRE, no el identificador', async () => {
  /* Medido: 7 campañas distintas, 222 de 236 contactos con nombre, máximo 51 caracteres y ninguna
     con una URL adentro. Son los nombres que puso quien armó la campaña, en la base de su propia
     empresa: se pueden dibujar. Los identificadores no — nadie puede leer `6rT9x…` y decidir algo. */
  await limpiar();
  for (let i = 0; i < PISO_DE_UNA_TASA; i++) {
    await lead({ campana: 'Lanzamiento setiembre', agendo: i < 4 });
  }

  const r = await leer();
  assert.equal(fila(r.porCampana, 'Lanzamiento setiembre')?.tasa, 40);
});

test('la cita CONGELADA no cuenta acá tampoco, igual que en el booking rate', async () => {
  /* Las filas de este corte tienen que sumar la cifra grande de al lado. Con un filtro distinto,
     la tabla y la tarjeta dirían números que no cuadran y las dos se verían bien por separado. */
  await limpiar();
  for (let i = 0; i < PISO_DE_UNA_TASA; i++) await lead({ fuente: 'Paid Social', agendo: i < 3 });
  await conOrganizacion(alfa, () =>
    datos().updateTable('citas').set({ ghl_calendario_id: null } as never).execute(),
  );

  const r = await leer();
  assert.equal(fila(r.porFuente, 'Paid Social')?.agendaron, 0, 'una cita congelada contó');
});

// ─── El horario del lead ────────────────────────────────────────────────────

test('EL HORARIO SE MIDE EN LA ZONA DEL LEAD, no en la de la empresa', async () => {
  /* ═══════════════════════════════════════════════════════════════════════════
   * Es lo único que `zona_horaria_del_lead` habilita, y no existía: la única zona que este sistema
   * conocía era la de la empresa, así que un «primer contacto a las 9» podía estar saliendo a las
   * 3 de la madrugada del lead sin que nada lo advirtiera.
   *
   * Medido el 2026-09-14: **51 de 130** primeros mensajes salieron fuera de las 8–21 del lead.
   * ═══════════════════════════════════════════════════════════════════════════ */
  await limpiar();
  // 12:00 UTC. En Lima (−5) son las 7 de la mañana: FUERA. En Madrid (+2) las 14: dentro.
  await lead({ zona: 'America/Lima', horaUtc: 12 });
  await lead({ zona: 'Europe/Madrid', horaUtc: 12 });

  const r = await leer();
  assert.equal(r.fueraDeHorario?.sobre, 2);
  assert.equal(
    r.fueraDeHorario?.contactos,
    1,
    'el horario se midió contra una sola zona: los dos mensajes salieron en el mismo instante',
  );
});

test('un lead SIN zona horaria no entra al denominador del horario', async () => {
  /* 100 de los 230 contactos escritos no traen zona. Meterlos como «dentro de hora» diría que casi
     nunca pasa; meterlos como «fuera» diría lo contrario. No se sabe, y el par (contactos, sobre)
     obliga a la pantalla a decir sobre cuántos habla. */
  await limpiar();
  await lead({ zona: 'America/Lima', horaUtc: 12 });
  await lead({ zona: null, horaUtc: 12 });

  assert.equal((await leer()).fueraDeHorario?.sobre, 1, 'entró un contacto sin zona horaria');
});

test('sin ninguna zona horaria el horario es NULO, no «cero fuera de hora»', async () => {
  await limpiar();
  await lead({ zona: null, horaUtc: 3 });

  assert.equal(
    (await leer()).fueraDeHorario,
    null,
    'sin datos de zona se devolvió un cero, que se lee como «nunca pasa»',
  );
});

test('LA MISMA CAMPAÑA EN OTRA CAJA es UNA fila, no dos', async () => {
  /* ═══════════════════════════════════════════════════════════════════════════
   * Estaba ocurriendo en producción. Medido el 2026-09-15: en la ventana hay **7 valores distintos
   * de campaña tal cual vienen y 6 normalizados** — la misma campaña escrita de dos formas, una con
   * 32 contactos y otra con 8.
   *
   * El costo no era cosmético: los 8 quedaban debajo del piso y se iban a «Otras» sin tasa, aunque
   * su campaña real tiene 40 contactos. Y proyectado a siete días la mitad grande también toca el
   * piso, con lo que la campaña DESAPARECE entera de la tabla teniendo catorce contactos.
   *
   * GoHighLevel no garantiza la caja de nada que escriba una persona — es la misma lección que el
   * descarte ya tenía aprendida.
   * ═══════════════════════════════════════════════════════════════════════════ */
  await limpiar();
  for (let i = 0; i < 6; i++) await lead({ campana: 'Lanzamiento Setiembre', agendo: i < 3 });
  for (let i = 0; i < 6; i++) await lead({ campana: 'LANZAMIENTO SETIEMBRE', agendo: i < 3 });

  const r = await leer();
  assert.equal(r.porCampana.length, 1, 'la misma campaña quedó partida en dos filas por la caja');
  const f = r.porCampana[0];
  assert.equal(f?.cohorte, 12, 'las dos mitades no se juntaron');
  assert.equal(f?.tasa, 50, 'juntas pasan el piso; partidas las dos se iban a «Otras» sin tasa');
});

test('la etiqueta se MUESTRA como la escribieron, no en minúsculas forzadas', async () => {
  /* Agrupar en minúscula es correcto; dibujarla así no. «lanzamiento setiembre» en la pantalla se
     lee como un error de la aplicación, no como el nombre que alguien le puso a su campaña. */
  await limpiar();
  for (let i = 0; i < PISO_DE_UNA_TASA; i++) await lead({ campana: 'Lanzamiento Setiembre' });

  const r = await leer();
  assert.equal(
    r.porCampana[0]?.etiqueta,
    'Lanzamiento Setiembre',
    'la etiqueta se dibujó normalizada en vez de como vino del CRM',
  );
});
