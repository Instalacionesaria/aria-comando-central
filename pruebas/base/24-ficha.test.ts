// La ficha del contacto, contra la base. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LOS CUATRO HECHOS QUE ESTE ARCHIVO MIDE
//
// **1 · Pedir UN contacto trae lo mismo que pedir la lista.** El `01` lo pone como propiedad:
// *"los seis íconos se cargan una sola vez para todos, y viajan con cada contacto en cada cola. Por
// eso se ven iguales en Mi Día, en el Pipeline y en la ficha: es el mismo dato, no tres cálculos
// que coinciden"*. Se comprueba comparando las dos lecturas del mismo contacto.
//
// **2 · El tope de 200 mensajes se queda con los NUEVOS.** El `03` § 1 llama a este error *"una
// línea que no falla nunca y rompe la pantalla en cuanto una conversación crece"*: con
// `ascendente + limit 200` se guardan los 200 más viejos, o sea el arranque de la conversación,
// escondiendo justo lo que alguien abrió a mirar. Es el defecto más fácil de introducir de toda la
// ficha y el que menos se ve mirando.
//
// **3 · La píldora sale del ÚLTIMO resultado, no de la última venta.** Son filas distintas, y
// confundirlas pondría el monto de una venta vieja en la píldora de un no-show.
//
// **4 · Nada de esto cruza organizaciones.** La ficha se abre por identificador, y un identificador
// es adivinable: si `filaDeContacto` no respetara el aislamiento, la ficha sería el agujero más
// grande del sistema.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { conectar, cerrarTodo, filas } from '../apoyo/conexiones.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { filaDeContacto, filasDeTerritorio } from '../../lib/negocio/fila.ts';
import {
  historialDeLaFicha,
  llamadasDeLaFicha,
  mensajesDeLaFicha,
  notasDeLaFicha,
  perfilDeLaFicha,
} from '../../lib/negocio/ficha.ts';

let admin: Client;
let alfa: string;
let beta: string;

before(async () => {
  admin = await conectar('admin');
  // Las dos organizaciones CLIENTE del sembrado, por el mismo motivo que en `90-negocio`: la
  // principal tiene al superadministrador con organización conmutable, el peor punto de partida
  // para medir aislamiento.
  const orgs = await filas<{ id: string; slug: string }>(
    admin,
    `select id, slug from identidad.organizaciones where slug in ('alfa','beta') order by slug`,
  );
  assert.equal(orgs.length, 2, 'hacen falta las dos organizaciones cliente del sembrado');
  alfa = orgs[0]!.id;
  beta = orgs[1]!.id;
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

/** Se borra por el camino del INQUILINO: si hiciera falta el propietario, los permisos estarían mal. */
async function limpiar(): Promise<void> {
  for (const org of [alfa, beta]) {
    await conOrganizacion(org, async () => {
      // Las hijas primero: las claves foráneas son `on delete cascade` desde `contactos`, pero
      // borrar explícito deja el motivo a la vista si algún día una deja de cascadear.
      await datos().deleteFrom('mensajes').execute();
      await datos().deleteFrom('notas').execute();
      await datos().deleteFrom('resultados').execute();
      await datos().deleteFrom('llamadas').execute();
      await datos().deleteFrom('contactos').execute();
      // Y EL PULSO, que no es una tabla más en esta lista: de él sale la respuesta a «¿por qué no
      // hay mensajes?». Dejando una fila de otra prueba, un cero NO MEDIDO se leería como medido,
      // que es exactamente la confusión que este archivo existe para impedir.
      await datos().deleteFrom('ingesta_pulso').execute();
    });
  }
}

/** Un contacto por el camino real. `org_id` NO se escribe: lo inyecta la capa fina. */
async function contactoEn(
  org: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  return conOrganizacion(org, async () => {
    const c = await datos()
      .insertInto('contactos')
      .values({
        ghl_contact_id: `ghl-${randomUUID()}`,
        nombre: 'Contacto de la ficha',
        territorio: 'closer',
        ...extra,
      } as never)
      .returning('id')
      .executeTakeFirstOrThrow();
    return c.id;
  });
}

// ─── 1 · Un contacto trae lo mismo que la lista ──────────────────────────────

test('pedir UN contacto devuelve exactamente lo que devuelve la lista', async () => {
  await limpiar();
  /* OTRO CONTACTO, INSERTADO PRIMERO, y las dos cosas importan.
   *
   * Con un solo contacto esta prueba pasaba **sin el filtro por identificador**: una mutacion que
   * borraba el `where` de `filaDeContacto` quedaba en verde, porque `executeTakeFirst()` devolvia
   * el unico que habia y acertaba por casualidad.
   *
   * Y con dos tampoco alcanzaba si el objetivo iba primero: sin `where` ni `order by`, PostgreSQL
   * devuelve la fila mas vieja, o sea justo la que se estaba pidiendo. Acertaba de nuevo.
   *
   * Insertando el senuelo ANTES, «la primera fila» y «la pedida» dejan de coincidir, y recien ahi
   * la asercion mide el filtro. */
  const otro = await contactoEn(alfa, { nombre: 'Otro contacto', email: 'otro@ejemplo.test' });
  const id = await contactoEn(alfa, { telefono: '+51 999', email: 'uno@ejemplo.test' });
  assert.notEqual(otro, id);

  const [uno, lista] = await conOrganizacion(alfa, async () => [
    await filaDeContacto(id),
    await filasDeTerritorio('closer', { todas: true }),
  ]);

  assert.ok(uno, 'la ficha no encontró el contacto');
  assert.equal(
    uno.id,
    id,
    'la ficha devolvió OTRO contacto: la lectura no filtra por el identificador que se le pidió',
  );
  const deLaLista = lista.filas.find((f) => f.id === id);
  assert.ok(deLaLista, 'la lista no trajo el contacto');

  // Comparación COMPLETA, no campo por campo. Es lo que hace que esta prueba detecte una
  // divergencia futura: si mañana la ficha agrega un cálculo propio, esto se pone rojo aunque el
  // campo nuevo no esté nombrado acá.
  assert.deepEqual(uno, deLaLista, 'la ficha y la lista devuelven cosas distintas del mismo contacto');

  // Y trae lo que el encabezado necesita y la lista no dibuja.
  assert.ok(uno.ghlContactId, 'no viaja el identificador del CRM: el enlace no se puede armar');
  assert.equal(uno.email, 'uno@ejemplo.test');
});

test('ADR-0206 · la ficha de un contacto de OTRA organización no existe', async () => {
  await limpiar();
  const enBeta = await contactoEn(beta);

  // Desde alfa, con el identificador exacto de un contacto de beta.
  const desdeAlfa = await conOrganizacion(alfa, () => filaDeContacto(enBeta));
  assert.equal(
    desdeAlfa,
    undefined,
    'la ficha devolvió un contacto de otra organización. Es el peor agujero posible: se abre por ' +
      'identificador, y un identificador se puede adivinar',
  );

  // Y desde beta sí. Sin esta mitad, una función que devolviera `undefined` siempre pasaría arriba.
  const desdeBeta = await conOrganizacion(beta, () => filaDeContacto(enBeta));
  assert.ok(desdeBeta, 'la ficha no encuentra su propio contacto');
});

// ─── 2 · El tope de 200 ─────────────────────────────────────────────────────

test('el chat se queda con los 200 mensajes MÁS NUEVOS, en orden ascendente', async () => {
  await limpiar();
  const id = await contactoEn(alfa);

  // 250 mensajes, uno por minuto. El número 250 es a propósito mayor que el tope: con 200 o menos
  // esta prueba pasaría con la consulta ascendente equivocada.
  const base = new Date('2026-01-01T00:00:00Z').getTime();
  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('mensajes')
      .values(
        Array.from({ length: 250 }, (_, i) => ({
          ghl_mensaje_id: `m-${i}`,
          contacto_id: id,
          direccion: i % 2 === 0 ? 'entrante' : 'saliente',
          autor: i % 2 === 0 ? 'contacto' : 'persona',
          cuerpo: `mensaje ${i}`,
          enviado_el: new Date(base + i * 60_000),
        })) as never,
      )
      .execute();
  });

  const r = await conOrganizacion(alfa, () => mensajesDeLaFicha(id));

  assert.equal(r.filas.length, 200, 'el tope de 200 no se respeta');
  // LOS NUEVOS: del 50 al 249. Con `ascendente + limit` habrían venido del 0 al 199.
  assert.equal(r.filas[0]?.cuerpo, 'mensaje 50', 'el chat se quedó con los mensajes VIEJOS');
  assert.equal(r.filas[199]?.cuerpo, 'mensaje 249', 'el último no es el más nuevo');
  // Y ASCENDENTE: el más nuevo abajo, porque la vista abre en el último y nadie abre un chat para
  // leer el principio.
  for (let i = 1; i < r.filas.length; i += 1) {
    assert.ok(
      r.filas[i]!.enviadoEl.getTime() >= r.filas[i - 1]!.enviadoEl.getTime(),
      `el mensaje ${i} está fuera de orden: la conversación se leería al revés`,
    );
  }
  // Con mensajes, `falta` es nulo: el vacío dejó de ser una posibilidad y decirlo sería mentir.
  assert.equal(r.falta, null);
});

test('sin mensajes se dice QUÉ falta, no «no hay nada»', async () => {
  await limpiar();
  const id = await contactoEn(alfa);
  const r = await conOrganizacion(alfa, () => mensajesDeLaFicha(id));

  assert.deepEqual(r.filas, []);
  // El `11` § 9 regla 1. Una lista vacía sin motivo afirma «este contacto nunca habló», y eso hace
  // que alguien llame a un cliente creyendo que no contestó.
  assert.ok(r.falta, 'una lista vacía sin `falta` afirma que el contacto nunca escribió');
  assert.match(String(r.falta), /ingesta|GoHighLevel/i, '`falta` no dice qué pieza no existe');
});

test('un cero MEDIDO no lleva `falta`, y quien lo decide es el pulso de la ingesta', async () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // TRES ESTADOS Y NO DOS, Y EL DEL MEDIO ES EL QUE MÁS DURA
  //
  // «Sin mensajes» puede significar tres cosas distintas, y las tres mandan a hacer algo distinto:
  //
  //   · **nunca corrió la ingesta** → no se sabe nada de este contacto;
  //   · **está a mitad de camino** → puede tener mensajes que aún no se copiaron;
  //   · **dio una vuelta entera** → no tiene mensajes, y eso es un hecho.
  //
  // El contacto no puede responder eso: quien lo sabe es el pulso de la organización, porque la
  // ingesta camina la cuenta **en orden y sin saltos**. Sin esta prueba, el tercer caso seguiría
  // diciendo «todavía no se trajeron los mensajes» para siempre, y esa frase envejece hasta que
  // nadie la lee.
  // ═══════════════════════════════════════════════════════════════════════════
  await limpiar();
  const id = await contactoEn(alfa);

  const conPulso = async (marca: Date | null, atrasado: boolean) =>
    conOrganizacion(alfa, async () => {
      await datos().deleteFrom('ingesta_pulso').execute();
      await datos()
        .insertInto('ingesta_pulso')
        .values({ clave: 'mensajes', marca_el: marca, atrasado } as never)
        .execute();
      return mensajesDeLaFicha(id);
    });

  // Corrió pero quedó trabajo sin hacer: NO se puede afirmar el cero.
  const aMedias = await conPulso(new Date('2026-01-01T00:00:00Z'), true);
  assert.ok(aMedias.falta, 'con la ingesta atrasada, el cero todavía no está medido');
  assert.match(String(aMedias.falta), /recorriendo|aún no se copiaron/i);

  // Una vuelta completa: el cero es un hecho y no hay nada que aclarar.
  const completo = await conPulso(new Date('2026-01-01T00:00:00Z'), false);
  assert.equal(completo.falta, null, 'con la cuenta recorrida entera, el cero SÍ está medido');

  // Y una fila de pulso sin marca es lo mismo que no haber corrido nunca.
  const sinMarca = await conPulso(null, false);
  assert.ok(sinMarca.falta, 'una fila de pulso sin marca no mide nada');
  assert.match(String(sinMarca.falta), /ingesta|GoHighLevel/i);
});

// ─── 3 · La píldora sale del último resultado ───────────────────────────────

test('la píldora es del ÚLTIMO resultado, no de la última venta', async () => {
  await limpiar();
  const id = await contactoEn(alfa);

  await conOrganizacion(alfa, async () => {
    // Primero una venta cobrada, con monto y forma de pago.
    await datos()
      .insertInto('resultados')
      .values({
        contacto_id: id,
        salida: 'venta',
        rol: 'closer',
        monto: '5000',
        forma_pago: 'Contado',
        creado_el: new Date('2026-01-01T10:00:00Z'),
      } as never)
      .execute();
    // Y DESPUÉS un no-show, que es el estado real de ahora.
    await datos()
      .insertInto('resultados')
      .values({
        contacto_id: id,
        salida: 'no_show',
        rol: 'closer',
        detalle: 'No contestó',
        creado_el: new Date('2026-02-01T10:00:00Z'),
      } as never)
      .execute();
  });

  const f = await conOrganizacion(alfa, () => filaDeContacto(id));

  assert.equal(f?.situacion, 'no_show');
  assert.equal(
    f?.pildora?.texto,
    'NO-SHOW · NO CONTESTÓ',
    'la píldora tomó el resultado equivocado: mostraría el monto de una venta vieja sobre un no-show',
  );
  // El ícono del dinero SÍ sigue encendido, y eso es correcto: la venta ocurrió. Son dos hechos
  // distintos —«hubo una venta» y «en qué estado está ahora»— y cada uno tiene su vitrina.
  assert.equal(f?.iconos.montoVenta, '5000.00');

  /* Y EL CASO QUE DE VERDAD LO DEMUESTRA.
   *
   * Lo de arriba no alcanzaba, y lo enseñó una mutación: cambiando la píldora para que tomara
   * `monto_venta` —el de la última VENTA— en vez del monto del último resultado, la prueba seguía
   * en verde. El motivo es que un `no_show` **ignora el monto**, así que el texto salía igual con
   * el dato correcto y con el equivocado.
   *
   * Acá el último resultado es un acuerdo SIN monto, y el acuerdo sí muestra el monto. Con el
   * dato correcto la píldora dice «ACORDÓ COMPRAR» a secas; tomando el de la venta vieja diría
   * «ACORDÓ COMPRAR · $5000», o sea afirmaría una plata que nadie prometió en ese acuerdo. */
  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('resultados')
      .values({
        contacto_id: id,
        salida: 'acuerdo_sin_pago',
        rol: 'closer',
        creado_el: new Date('2026-03-01T10:00:00Z'),
      } as never)
      .execute();
  });

  const conAcuerdo = await conOrganizacion(alfa, () => filaDeContacto(id));
  assert.equal(
    conAcuerdo?.pildora?.texto,
    'ACORDÓ COMPRAR',
    'la píldora tomó el monto de la venta vieja: afirma una plata que este acuerdo no tiene',
  );
});

// ─── 4 · Las notas: la única pestaña que se escribe desde acá ────────────────

test('una nota se guarda con su autor y se lee en la ficha', async () => {
  await limpiar();
  const id = await contactoEn(alfa);
  const autor = await filas<{ id: string; nombre: string }>(
    admin,
    `select u.id, u.nombre from identidad.usuarios u
      join identidad.organizaciones o on o.id = u.org_id where o.slug = 'alfa' limit 1`,
  );
  assert.ok(autor[0], 'hace falta un usuario de alfa en el sembrado');

  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('notas')
      .values({ contacto_id: id, cuerpo: 'Pidió llamar después de las 14:00', autor_id: autor[0]!.id } as never)
      .execute();
  });

  const r = await conOrganizacion(alfa, () => notasDeLaFicha(id));
  assert.equal(r.filas.length, 1);
  assert.equal(r.filas[0]?.cuerpo, 'Pidió llamar después de las 14:00');
  // El AUTOR REAL, resuelto contra identidad. Sin esto la nota diría `Sistema` y el `04` § 3 dice
  // que atribuirle a un automatismo lo que hizo una persona vuelve inútil el historial.
  assert.equal(r.filas[0]?.autor, autor[0]!.nombre);
  assert.equal(r.filas[0]?.origen, 'plataforma');
  // Las notas NO llevan `falta`: esta tabla la escribe esta misma aplicación, así que cero notas es
  // un cero MEDIDO. Es la única de las cinco pestañas donde el vacío es un hecho.
  assert.equal(r.falta, null);
});

test('sin notas el vacío es un hecho medido, no una pieza que falta', async () => {
  await limpiar();
  const id = await contactoEn(alfa);
  const r = await conOrganizacion(alfa, () => notasDeLaFicha(id));
  assert.deepEqual(r.filas, []);
  assert.equal(
    r.falta,
    null,
    'las notas dicen que «falta» algo. La tabla la escribe esta aplicación: cero notas significa ' +
      'que este contacto no tiene ninguna, y decir que falta una pieza sería mentir al revés',
  );
});

// ─── 5 · Las otras tres pestañas, y el historial que sí tiene algo ───────────

test('las pestañas sin fuente dicen qué falta; el historial se arma con lo que hay', async () => {
  await limpiar();
  const id = await contactoEn(alfa);

  const [llamadas, perfil, vacio] = await conOrganizacion(alfa, async () => [
    await llamadasDeLaFicha(id),
    await perfilDeLaFicha(id),
    await historialDeLaFicha(id),
  ]);

  assert.deepEqual(llamadas.filas, []);
  assert.match(String(llamadas.falta), /voz|Assistable/i, 'las llamadas no dicen de dónde vendrían');

  // El perfil SÍ tiene datos hoy —los que la sincronización trae— y además dice que falta el resto.
  assert.ok(
    perfil.filas.some((c) => c.etiqueta === 'Nombre'),
    'el perfil no muestra ni los datos que sí se sincronizan',
  );
  assert.ok(perfil.falta, 'el perfil no dice que los campos de calificación todavía no se leen');
  // Y NO inventa los grupos que no puede llenar. Un encabezado «Interacciones» con nada abajo
  // afirma que se midió y no hay.
  assert.equal(
    perfil.filas.some((c) => c.grupo === 'interacciones'),
    false,
    'el perfil inventó un campo del grupo Interacciones, que todavía no tiene fuente',
  );

  assert.deepEqual(vacio.filas, []);
  assert.ok(vacio.falta, 'el historial vacío no dice qué orígenes faltan');

  // Con una nota, el historial deja de estar vacío Y deja de decir que falta: ya es una línea de
  // tiempo de verdad, aunque parcial.
  await conOrganizacion(alfa, async () => {
    await datos()
      .insertInto('notas')
      .values({ contacto_id: id, cuerpo: 'Una nota' } as never)
      .execute();
  });
  const conAlgo = await conOrganizacion(alfa, () => historialDeLaFicha(id));
  assert.equal(conAlgo.filas.length, 1);
  assert.equal(conAlgo.falta, null);
  // Una nota sin autor la importó el sistema, y se dice así — no con el nombre de quien mira.
  assert.equal(conAlgo.filas[0]?.autor, 'Sistema');
});
