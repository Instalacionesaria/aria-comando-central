// Las cifras de Lead Flow, y la cohorte que las sostiene a las cuatro. Tipo: Base.
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
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE CAMBIÓ, Y POR QUÉ LAS PRUEBAS DE LA ZONA SE DIERON VUELTA
//
// La cohorte pasó de `creado_el` + `territorio = 'setter'` a `alta_en_el_crm` sin filtro de zona.
// Las dos pruebas que afirmaban que el closer NO cuenta ahora afirman lo contrario, y **eso no es
// aflojar una prueba: es corregir la cohorte que medía**.
//
// El territorio es CONSECUENCIA de agendar. Un contacto que agenda se va a zona closer, así que
// `territorio = 'setter'` son los que todavía no agendaron más los que nunca lo harán — y sobre esa
// población el KPI principal de Lead Flow da 2 de 280. La prueba vieja protegía una cohorte que
// hacía imposible la cifra que la pestaña existe para mostrar.
//
// Lo que sigue intacto —y es lo que de verdad cuidaban— es que la cifra sea de CONTACTOS y no de
// mensajes, y que una cita congelada no cuente como agendamiento.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { DIAS_DE_LA_TASA } from '../../lib/negocio/indicadoresDeCitas.ts';
import { indicadoresDelLead } from '../../lib/negocio/indicadoresDelLead.ts';

let admin: Client;
let alfa: string;

const MARCA = 'ind-lead';

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

/**
 * Un contacto con sus mensajes. `salientes` y `entrantes` son cuántos de cada uno — varios a
 * propósito, para que la prueba distinga «contactos» de «mensajes».
 */
async function contacto(opciones: {
  zona?: 'setter' | 'closer' | null;
  altaHaceDias?: number;
  salientes?: number;
  entrantes?: number;
  /** Una cita del contacto. `'congelada'` la deja sin calendario: el barrido ya no la alcanza. */
  cita?: 'viva' | 'congelada' | 'futura';
  /** Minutos entre el alta y el primer saliente, para ejercitar las latencias. */
  minutosAlPrimerIntento?: number;
  /** Minutos entre el primer saliente y el primer entrante. */
  minutosALaRespuesta?: number;
}): Promise<void> {
  const {
    zona = 'setter',
    altaHaceDias = 1,
    salientes = 1,
    entrantes = 0,
    cita,
    minutosAlPrimerIntento = 10,
    minutosALaRespuesta = 10,
  } = opciones;
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

    /* La cohorte es `alta_en_el_crm` y no `creado_el`. Se escribe a mano porque es la única forma
       de ejercitarla sin esperar catorce días — y se escriben LAS DOS, con `creado_el` siempre
       reciente, para que ninguna prueba pase por accidente si alguien devolviera la cohorte a la
       columna vieja. Ése es el punto: las dos fechas tienen que diferir en el fixture. */
    const alta = new Date(Date.now() - altaHaceDias * 86_400_000);
    await datos()
      .updateTable('contactos')
      .set({ alta_en_el_crm: alta, creado_el: new Date() } as never)
      .where('id', '=', c.id)
      .execute();

    const primerSaliente = new Date(alta.getTime() + minutosAlPrimerIntento * 60_000);
    const primerEntrante = new Date(primerSaliente.getTime() + minutosALaRespuesta * 60_000);

    const filasDeMensajes = [
      ...Array.from({ length: salientes }, (_, i) => ({
        direccion: 'saliente' as const,
        /* El primero a la latencia pedida y los demás DESPUÉS: si todos llevaran el mismo
           instante, `min()` daría lo mismo y la prueba de latencia pasaría sin medir nada. */
        enviado_el: new Date(primerSaliente.getTime() + i * 60_000),
      })),
      ...Array.from({ length: entrantes }, (_, i) => ({
        direccion: 'entrante' as const,
        enviado_el: new Date(primerEntrante.getTime() + i * 60_000),
      })),
    ].map((m) => ({
      ghl_mensaje_id: `${MARCA}-${randomUUID().slice(0, 10)}`,
      contacto_id: c.id,
      direccion: m.direccion,
      cuerpo: 'algo',
      autor: m.direccion === 'entrante' ? 'contacto' : 'agente',
      enviado_el: m.enviado_el,
      estado_entrega_familia: 'entregado',
      origen: 'ingesta',
    }));
    if (filasDeMensajes.length > 0) {
      await datos().insertInto('mensajes').values(filasDeMensajes as never).execute();
    }

    if (cita !== undefined) {
      const inicio =
        cita === 'futura'
          ? new Date(Date.now() + 2 * 86_400_000)
          : new Date(alta.getTime() + 3_600_000);
      await datos()
        .insertInto('citas')
        .values({
          ghl_evento_id: `${MARCA}-${randomUUID().slice(0, 10)}`,
          contacto_id: c.id,
          inicio_el: inicio,
          estado_ghl: 'confirmed',
          ghl_calendario_id: cita === 'congelada' ? null : 'cal1',
        } as never)
        .execute();
    }
  });
}

const leer = () => conOrganizacion(alfa, () => indicadoresDelLead());

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

test('LA ZONA YA NO FILTRA, y es una corrección y no una concesión', async () => {
  /* ═══════════════════════════════════════════════════════════════════════════
   * Esta prueba afirmaba lo CONTRARIO —«la zona del closer no cuenta»— y darla vuelta no es
   * aflojarla: es corregir la cohorte que medía.
   *
   * El territorio es CONSECUENCIA de agendar. Un contacto que agenda pierde `zona_setter` y gana
   * `zona_closer`, así que filtrar por setter deja adentro a los que todavía no agendaron y a los
   * que nunca lo harán, y deja afuera exactamente a los que convirtieron. Medido en producción: de
   * 280 contactos en zona setter sólo **2** tienen cita.
   *
   * Sobre esa cohorte el KPI principal de Lead Flow —cuántos agendan— daría 0,7 % para siempre, y
   * no porque el negocio sea malo sino porque la pregunta está mal hecha.
   * ═══════════════════════════════════════════════════════════════════════════ */
  await limpiar();
  await contacto({ zona: 'setter', salientes: 1, entrantes: 0 });
  await contacto({ zona: 'closer', salientes: 1, entrantes: 1, cita: 'viva' });

  const r = await leer();
  assert.equal(r.cohorte, 2, 'la cohorte volvió a filtrar por territorio');
  assert.equal(r.respondieron, 1, 'el contacto de zona closer no entró al numerador');
  assert.equal(
    r.agendaron,
    1,
    'el único que agendó quedó afuera por haberse mudado de zona: es el defecto entero',
  );
  assert.equal(r.bookingRate, 50);
});

test('un contacto sin NINGÚN territorio sigue contando: entró al CRM igual', async () => {
  /* Territorio nulo es un contacto que perdió las dos etiquetas de zona en el CRM. Antes quedaba
     fuera de toda cifra de Lead Flow por el filtro de zona, y era un agujero silencioso: el lead
     existe, le escribimos, y no aparecía en ningún denominador.

     Lo que sí sigue sin contar es su CITA si está congelada — ver la prueba de abajo. Son dos
     exclusiones distintas y sólo una era correcta. */
  await limpiar();
  await contacto({ zona: 'setter', salientes: 1, entrantes: 1 });
  await contacto({ zona: null, salientes: 1, entrantes: 0 });

  const r = await leer();
  assert.equal(r.cohorte, 2, 'el contacto sin territorio volvió a quedar afuera');
  assert.equal(r.escritos, 2);
  assert.equal(r.tasa, 50);
});

test('una cita CONGELADA no cuenta como agendamiento', async () => {
  /* El mismo filtro que todas las cifras de citas: `ghl_calendario_id is null` son las anteriores a
     la `038`, que el CRM ya no devuelve. Contarlas mezclaría una foto vieja con el dato de hoy.

     Va acá y no en el archivo de citas porque el booking rate se calcula sobre `contactos`, así que
     el filtro está escrito una segunda vez — y una regla escrita dos veces es una que un día
     difiere. */
  await limpiar();
  await contacto({ cita: 'viva' });
  await contacto({ cita: 'congelada' });

  const r = await leer();
  assert.equal(r.cohorte, 2);
  assert.equal(r.agendaron, 1, 'una cita que el barrido ya no alcanza contó como agendamiento');
  assert.equal(r.bookingRate, 50);
});

test('UNA CITA FUTURA SÍ CUENTA: agendar es el evento, no la llamada', async () => {
  /* La trampa más fácil de este archivo, y está medida: copiar el `inicio_el < now()` de
     `tasaDeCancelacion` borraría a los contactos que ya agendaron para los próximos días y bajaría
     el booking rate de 52,5 % a 48,7 %.

     Son dos preguntas distintas. La cancelación necesita que la cita haya pasado —una cita futura
     todavía puede cancelarse—. El agendamiento ya ocurrió en el momento en que se reservó. */
  await limpiar();
  await contacto({ cita: 'futura' });
  await contacto({ salientes: 1 });

  const r = await leer();
  assert.equal(r.agendaron, 1, 'una cita futura dejó de contar como agendamiento');
  assert.equal(r.bookingRate, 50);
});

// ─── La cohorte ─────────────────────────────────────────────────────────────

test('LA COHORTE ES `alta_en_el_crm` Y NO `creado_el`, y el fixture los separa', async () => {
  /* ═══════════════════════════════════════════════════════════════════════════
   * El fixture escribe `creado_el` SIEMPRE reciente y `alta_en_el_crm` con la edad pedida. Así que
   * un contacto con alta vieja tiene `creado_el` de hoy: si alguien devolviera la cohorte a
   * `creado_el`, este contacto entraría y la prueba se cae.
   *
   * Por qué importa, medido en producción: la carga inicial fue el 2026-08-24 y **239 contactos
   * comparten esa marca de `creado_el`**. En cuanto la ventana de catorce días la toque, la cohorte
   * salta de 260 a 499 de golpe sin que entre un solo lead, y las cuatro cifras se mueven el mismo
   * día por el calendario del barrido.
   * ═══════════════════════════════════════════════════════════════════════════ */
  await limpiar();
  await contacto({ altaHaceDias: 40, salientes: 1, entrantes: 1 });
  await contacto({ altaHaceDias: 1, salientes: 1, entrantes: 0 });

  const r = await leer();
  assert.equal(r.cohorte, 1, 'la cohorte volvió a armarse con `creado_el`');
  assert.equal(r.respondieron, 0, 'entró el contacto viejo, que sí había contestado');
  assert.equal(r.tasa, 0);
});

test('EL VIEJO: un contacto de hace 40 días no entra, y por eso la cifra no se diluye', async () => {
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
  /* Y el booking rate también: un 0 % con cero contactos afirma que nadie agenda, que es una
     afirmación sobre el negocio hecha sin un solo dato. Es el mismo cero indistinguible de siempre. */
  assert.equal(r.bookingRate, null, 'con cero contactos se devolvió un booking rate');
  assert.match(r.aviso ?? '', /No entró ningún contacto/i);
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

// ─── Las latencias (§9.7) ───────────────────────────────────────────────────

test('la latencia se mide de `alta_en_el_crm` al PRIMER saliente, no al último', async () => {
  /* Con `max()` en vez de `min()` la cifra mediría «cuándo dejamos de insistir», que es otra
     pregunta y da un número mucho más grande — y plausible. El fixture manda tres salientes
     separados un minuto cada uno justamente para que las dos formas den distinto. */
  await limpiar();
  await contacto({ salientes: 3, minutosAlPrimerIntento: 10 });

  const r = await leer();
  assert.equal(r.hastaElPrimerIntento?.sobre, 1);
  assert.equal(r.hastaElPrimerIntento?.p50, 10, 'se midió contra un saliente que no es el primero');
});

test('la respuesta se mide del primer SALIENTE al primer entrante, no desde el alta', async () => {
  /* Medir desde el alta sumaría el tiempo que tardamos NOSOTROS en escribir, y la cifra diría que
     el contacto tarda más de lo que tarda. El fixture separa las dos latencias —10 minutos hasta
     escribir, 25 hasta que contesta— para que una implementación que las sume dé 35 y se caiga. */
  await limpiar();
  await contacto({
    salientes: 1,
    entrantes: 1,
    minutosAlPrimerIntento: 10,
    minutosALaRespuesta: 25,
  });

  const r = await leer();
  assert.equal(r.hastaLaPrimeraRespuesta?.p50, 25, 'la respuesta se midió desde el alta');
  assert.equal(r.hastaElPrimerIntento?.p50, 10);
});

test('EL CENSURADO: quien no contestó no entra a la mediana, ni como cero ni como infinito', async () => {
  /* ═══════════════════════════════════════════════════════════════════════════
   * Es la trampa más cara de esta familia. Un contacto escrito que todavía no contestó no tiene
   * latencia: tiene una observación incompleta. Meterlo como cero hunde la mediana; meterlo como
   * «el tiempo transcurrido hasta hoy» la convierte en una función de cuándo se abre la pantalla.
   *
   * Y el grupo que falta NO es una muestra al azar del que está: medido en producción, los que
   * nunca contestaron reciben MÁS intentos que los que sí (mediana 3 contra 1).
   * ═══════════════════════════════════════════════════════════════════════════ */
  await limpiar();
  await contacto({ salientes: 1, entrantes: 1, minutosALaRespuesta: 30 });
  await contacto({ salientes: 5, entrantes: 0 });
  await contacto({ salientes: 5, entrantes: 0 });

  const r = await leer();
  assert.equal(r.hastaLaPrimeraRespuesta?.sobre, 1, 'los que no contestaron entraron a la mediana');
  assert.equal(r.hastaLaPrimeraRespuesta?.p50, 30, 'la mediana se movió con los censurados');
  assert.equal(r.escritosSinContestar, 2);
  /* Y se dice, porque la cifra habla de uno y la pantalla muestra tres contactos. */
  assert.match(String(r.avisoDeLatencias), /todavía no contestaron/);
});

test('sin nadie que haya contestado, la latencia es NULA y no cero', async () => {
  /* Un cero acá diría «contestan al instante», que es la afirmación opuesta a la verdadera. Es el
     mismo criterio que `horasHastaLaCita` en las cifras de citas. */
  await limpiar();
  await contacto({ salientes: 2, entrantes: 0 });

  const r = await leer();
  assert.equal(r.hastaLaPrimeraRespuesta, null, 'sin respuestas se devolvió una latencia');
  assert.ok(r.hastaElPrimerIntento !== null, 'sí hubo un saliente: esa latencia sí existe');
});

test('un saliente ANTERIOR al alta no entra: sería una latencia negativa', async () => {
  /* En la ventana de catorce días hay cero de éstos, pero fuera de ella hay uno de −103,9 días: un
     contacto que existía antes en otro lado. Sin la guarda, el día que alguien ensanche la ventana
     esa sola fila arrastra la cifra y el número que sale sigue pareciendo razonable. */
  await limpiar();
  await contacto({ salientes: 1, minutosAlPrimerIntento: -600 });
  await contacto({ salientes: 1, minutosAlPrimerIntento: 20 });

  const r = await leer();
  assert.equal(r.hastaElPrimerIntento?.sobre, 1, 'entró un contacto con latencia negativa');
  assert.equal(r.hastaElPrimerIntento?.p50, 20);
});

test('los dos percentiles se devuelven, porque la mediana sola miente', async () => {
  /* Medido en producción: en el tiempo hasta la primera respuesta el p90 es SESENTA Y UNA VECES el
     p50 (6 minutos contra 6,2 horas). Publicar sólo la mediana diría «contestan en seis minutos»
     de un negocio donde uno de cada diez tarda más de seis horas. */
  await limpiar();
  for (const m of [1, 1, 1, 1, 1, 1, 1, 1, 1, 600]) {
    await contacto({ salientes: 1, entrantes: 1, minutosALaRespuesta: m });
  }

  const r = await leer();
  assert.equal(r.hastaLaPrimeraRespuesta?.sobre, 10);
  assert.equal(r.hastaLaPrimeraRespuesta?.p50, 1, 'la mediana se corrió con la cola');
  /* La propiedad y no un número: el p90 tiene que ser un ORDEN DE MAGNITUD mayor que el p50, que
     es lo que hace que las dos cifras juntas digan algo que ninguna dice sola. Con estos diez
     datos `percentile_cont` interpola y da 60,9 — no 600, porque interpola entre el noveno y el
     décimo. Fijar «60,9» acá ataría la prueba al método de interpolación de PostgreSQL. */
  const { p50 = 0, p90 = 0 } = r.hastaLaPrimeraRespuesta ?? {};
  assert.ok(
    p90 >= p50 * 10,
    `el p90 (${p90}) no refleja la cola larga frente al p50 (${p50}): con un solo número la cifra miente`,
  );
});

// ─── Los dos conteos, que NO son tasas ──────────────────────────────────────

test('«sin ningún mensaje» es un CONTEO, y no excluye a quien ya agendó', async () => {
  /* Medido: 6 de 236 contactos no recibieron ningún mensaje, y 5 de esos 6 YA TIENEN CITA — se
     autoagendaron desde un anuncio y nadie les escribió después. Titular esto «leads sin atender»
     sería falso para cinco de cada seis.

     Y va como conteo y no como tasa por lo mismo que `noShowReportado`: 6 sobre 236 es 2,5 %, y
     pasar a 10 se leería como un deterioro del 68 % cuando son cuatro contactos. */
  await limpiar();
  await contacto({ salientes: 0, cita: 'viva' });
  await contacto({ salientes: 0 });
  await contacto({ salientes: 1, entrantes: 1 });

  const r = await leer();
  assert.equal(r.sinNingunMensaje, 2);
  assert.equal(r.cohorte, 3);
  /* El que se autoagendó sin que le escribiéramos SÍ cuenta como agendamiento: la cita existe. */
  assert.equal(r.agendaron, 1, 'un contacto que agendó sin mensajes quedó fuera del booking rate');
  /* Pero NO entra al denominador de la tasa de respuesta: no pudo contestar lo que nadie preguntó. */
  assert.equal(r.escritos, 1);
  assert.equal(r.tasa, 100);
});
