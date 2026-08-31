// Avanzar contra la base, y el Pipeline que sale de él. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LOS CUATRO HECHOS QUE ESTE ARCHIVO MIDE
//
// **1 · Las cuatro escrituras van JUNTAS.** El resultado, la etapa, la nota y la tarea describen un
// solo hecho: cómo terminó esta conversación. La que falle sola deja a las otras tres afirmando algo
// incompleto — y el caso concreto está documentado: *"una nota que no se guardó y una operación que
// responde éxito es exactamente un éxito que no ocurrió"*.
//
// **2 · La etapa se mueve.** Sin eso el resultado queda registrado y el contacto sigue en la misma
// columna: el síntoma sería «registré y no se movió».
//
// **3 · Los números de Inicio dejan de decir `—`.** Es la mitad visible de todo el bloque: de acá
// salen «cobrado», «ventas» y «acuerdos», que hoy no tienen fuente.
//
// **4 · Y la distinción entre un cero MEDIDO y un cero NO medido se mantiene.** Con un resultado
// registrado y ninguna venta, cero es un hecho. Sin ningún resultado, no lo es.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { conectar, cerrarTodo, filas } from '../apoyo/conexiones.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import type { SalidaDelCloser } from '../../lib/negocio/salidas.ts';
import { registrarResultado } from '../../lib/negocio/avanzar.ts';
import { pipelineDe } from '../../lib/negocio/pipeline.ts';
import { cockpitDelMes } from '../../lib/negocio/inicio.ts';

let admin: Client;
let alfa: string;
let beta: string;
let quien: string;

before(async () => {
  admin = await conectar('admin');
  const orgs = await filas<{ id: string; slug: string }>(
    admin,
    `select id, slug from identidad.organizaciones where slug in ('alfa','beta') order by slug`,
  );
  assert.equal(orgs.length, 2, 'hacen falta las dos organizaciones cliente del sembrado');
  alfa = orgs[0]!.id;
  beta = orgs[1]!.id;

  // Quien registra. Se toma del sembrado y no se inventa: `registrado_por` tiene clave foránea.
  const u = await filas<{ id: string }>(
    admin,
    `select id from identidad.usuarios where org_id = $1 limit 1`,
    [alfa],
  );
  assert.ok(u[0], 'la organización alfa no tiene usuarios: ¿corrió el sembrado?');
  quien = u[0]!.id;
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

async function limpiar(): Promise<void> {
  for (const org of [alfa, beta]) {
    await conOrganizacion(org, async () => {
      await datos().deleteFrom('resultados').execute();
      await datos().deleteFrom('notas').execute();
      await datos().deleteFrom('tareas').execute();
      await datos().deleteFrom('contactos').execute();
    });
  }
}

/** Un contacto por el camino real. `org_id` NO se escribe: lo inyecta la capa fina. */
async function contactoEn(org: string, extra: Record<string, unknown> = {}): Promise<string> {
  return conOrganizacion(org, async () => {
    const c = await datos()
      .insertInto('contactos')
      .values({
        ghl_contact_id: `ghl-${randomUUID()}`,
        nombre: 'Contacto de Avanzar',
        territorio: 'closer',
        ...extra,
      } as never)
      .returning('id')
      .executeTakeFirstOrThrow();
    return c.id;
  });
}

/* El par (rol, salida) viaja ANIDADO en `que`, así que no está en `BASE`: cada prueba arma el suyo
   con `del(salida)`. Sueltos, TypeScript ensancha el esparcido de la unión y `{ rol: 'closer',
   salida: 'agendo' }` volvería a compilar. */
const BASE = {
  detalle: null,
  formaPago: null,
  monto: null,
  nota: null,
  volverEl: null,
  /* `null` = la salida no admite modos, que es el caso de cinco de las seis. La única que los tiene
     es `seguimiento`, y las pruebas que la usan lo pasan explícito. */
  modo: null,
};

/** El par de un resultado del closer, que es el rol de todas las pruebas de este archivo. */
const del = (salida: SalidaDelCloser) => ({ rol: 'closer' as const, salida });

// ═══ 1 · Las cuatro escrituras ══════════════════════════════════════════════

test('una VENTA escribe el resultado, mueve la etapa, y deja el monto en su columna', async () => {
  await limpiar();
  const id = await contactoEn(alfa);

  const r = await conOrganizacion(alfa, () =>
    registrarResultado(id, {
      ...BASE,
      que: del('venta'),
      detalle: 'Contado',
      formaPago: 'Contado',
      monto: '1500.00',
      quien,
    }),
  );

  assert.equal(r.etapa, 'ganado');
  const guardado = await conOrganizacion(alfa, async () =>
    datos()
      .selectFrom('resultados')
      .select(['salida', 'monto', 'forma_pago', 'detalle', 'registrado_por'])
      .where('id', '=', r.resultadoId)
      .executeTakeFirst(),
  );
  assert.equal(guardado?.salida, 'venta');
  assert.equal(guardado?.forma_pago, 'Contado');
  // El monto llega como TEXTO desde el controlador: la columna es `numeric(12,2)` y pasarlo por un
  // `double` es exactamente cómo se pierden centavos.
  assert.equal(Number(guardado?.monto), 1500);
  assert.equal(guardado?.registrado_por, quien, 'el resultado quedó sin autor');

  // LA ETAPA, que es lo que mueve el Pipeline. Sin esta línea el resultado queda registrado y el
  // contacto sigue en la misma columna.
  const contacto = await conOrganizacion(alfa, async () =>
    datos().selectFrom('contactos').select('etapa').where('id', '=', id).executeTakeFirst(),
  );
  assert.equal(contacto?.etapa, 'ganado');
});

test('la nota va a la MISMA tabla que la pestaña Notas, y con su autor', async () => {
  // El `04` § 4 llama a esto «el defecto que costó más caro de toda la ficha»: la nota se escribía
  // en otra tabla según por qué camino se registrara, así que aparecía en un lado y no en el otro.
  // De trece resultados con nota, solo dos llegaron a la tabla.
  await limpiar();
  const id = await contactoEn(alfa);

  const r = await conOrganizacion(alfa, () =>
    registrarResultado(id, { ...BASE, que: del('seguimiento'), nota: 'Pidió llamar el lunes', quien }),
  );
  assert.equal(r.nota, true);

  const notas = await conOrganizacion(alfa, async () =>
    datos().selectFrom('notas').select(['cuerpo', 'autor_id', 'origen']).execute(),
  );
  assert.equal(notas.length, 1, 'la nota no llegó a `negocio.notas`');
  assert.equal(notas[0]?.cuerpo, 'Pidió llamar el lunes');
  // `null` en esta columna significa «la importó el sistema», así que dejarla vacía haría pasar la
  // nota de una persona por una importación.
  assert.equal(notas[0]?.autor_id, quien);

  // Y TAMBIÉN queda junto al resultado. No es duplicación por descuido: `resultados.nota` es lo que
  // se dijo AL registrar y viaja con él para siempre; borrar la de `notas` no puede cambiarlo.
  const res = await conOrganizacion(alfa, async () =>
    datos().selectFrom('resultados').select('nota').where('id', '=', r.resultadoId).executeTakeFirst(),
  );
  assert.equal(res?.nota, 'Pidió llamar el lunes');
});

test('sin nota NO se escribe ninguna, y la respuesta lo dice', async () => {
  // `nota: false` no es un detalle: es la diferencia entre «no se pidió» y «se pidió y no se pudo».
  await limpiar();
  const id = await contactoEn(alfa);
  const r = await conOrganizacion(alfa, () =>
    registrarResultado(id, { ...BASE, que: del('nurture'), quien }),
  );
  assert.equal(r.nota, false);
  const n = await conOrganizacion(alfa, async () =>
    datos().selectFrom('notas').selectAll().execute(),
  );
  assert.deepEqual(n, []);
});

test('el seguimiento crea una tarea MANUAL, que es la que cuenta en Mi Día', async () => {
  // Mi Día *"cuenta lo que necesita una persona, no las series automáticas"*. Una tarea creada
  // desde Avanzar marcada como automática no aparecería en su contador.
  await limpiar();
  const id = await contactoEn(alfa);

  const r = await conOrganizacion(alfa, () =>
    registrarResultado(id, { ...BASE, que: del('seguimiento'), volverEl: '2026-12-01', quien }),
  );
  assert.equal(r.tarea, true);

  const tareas = await conOrganizacion(alfa, async () =>
    datos().selectFrom('tareas').select(['vence_el', 'modo', 'situacion', 'creada_por']).execute(),
  );
  assert.equal(tareas.length, 1);
  assert.equal(tareas[0]?.modo, 'manual');
  assert.equal(tareas[0]?.creada_por, quien);
  assert.equal(tareas[0]?.situacion, 'seguimiento');
});

test('EL DÍA DE LA TAREA NO SE CORRE, y por eso viaja como texto', async () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // MEDIDO, Y ERA UN DEFECTO
  //
  // `tareas.vence_el` es una columna `date`. Pasando un `Date`, PostgreSQL lo convierte usando la
  // zona del servidor: un `2026-12-01T12:00:00Z` volvía como `2026-12-01T05:00:00Z`, y con una hora
  // cercana a la medianoche **el día habría cambiado**. Una tarea que aparece vencida el día que se
  // creó, sin que nada falle.
  //
  // Se afirma sobre el DÍA que la base guardó, leído en UTC, porque es lo único que la columna
  // contiene. Y se prueban los dos bordes del mes, que es donde un corrimiento de un día se ve.
  // ═══════════════════════════════════════════════════════════════════════════
  for (const dia of ['2026-12-01', '2026-12-31', '2027-01-01']) {
    await limpiar();
    const id = await contactoEn(alfa);
    await conOrganizacion(alfa, () =>
      registrarResultado(id, { ...BASE, que: del('seguimiento'), volverEl: dia, quien }),
    );
    const guardado = await filas<{ dia: string }>(
      admin,
      `select to_char(vence_el, 'YYYY-MM-DD') as dia from negocio.tareas`,
    );
    assert.equal(guardado[0]?.dia, dia, `el día se corrió: se pidió ${dia}`);
  }
});

test('LAS CUATRO ESCRITURAS SON ATÓMICAS: si una falla, no queda ninguna', async () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // ES EL HECHO MÁS IMPORTANTE DE ESTE ARCHIVO
  //
  // Describen un solo hecho. Sueltas, la que falle deja a las otras afirmando algo que no pasó: un
  // resultado registrado con la etapa vieja, o una etapa movida sin resultado que la explique.
  //
  // Se provoca con una fecha imposible en la tarea —la última de las cuatro—: si la transacción no
  // envolviera todo, el resultado, la etapa y la nota ya estarían escritos cuando la cuarta falla.
  // ═══════════════════════════════════════════════════════════════════════════
  await limpiar();
  const id = await contactoEn(alfa);

  await assert.rejects(
    conOrganizacion(alfa, () =>
      registrarResultado(id, {
        ...BASE,
        que: del('seguimiento'),
        nota: 'esta nota no debería quedar',
        // Un 31 de febrero. Tiene la forma correcta —el endpoint lo rechaza antes de llegar acá—
        // así que sirve justo para lo que se quiere medir: **que la base sea la última línea**. La
        // tarea es la CUARTA escritura, así que sin transacción las tres anteriores ya estarían.
        volverEl: '2026-02-31',
        quien,
      }),
    ),
  );

  const quedo = await conOrganizacion(alfa, async () => ({
    resultados: await datos().selectFrom('resultados').selectAll().execute(),
    notas: await datos().selectFrom('notas').selectAll().execute(),
    tareas: await datos().selectFrom('tareas').selectAll().execute(),
    contacto: await datos()
      .selectFrom('contactos')
      .select('etapa')
      .where('id', '=', id)
      .executeTakeFirst(),
  }));

  assert.deepEqual(quedo.resultados, [], 'quedó el resultado de una transacción que falló');
  assert.deepEqual(quedo.notas, [], 'quedó la nota de una transacción que falló');
  assert.deepEqual(quedo.tareas, []);
  assert.equal(quedo.contacto?.etapa, null, 'la etapa se movió en una transacción que falló');
});

// ═══ 2 · Los números de Inicio ══════════════════════════════════════════════

test('los números de Inicio dejan de decir `—` en cuanto hay un resultado', async () => {
  await limpiar();
  const a = await contactoEn(alfa);
  const b = await contactoEn(alfa);

  // Antes: sin ningún resultado, «cobrado» NO es cero — es que nadie registró nada.
  const antes = await conOrganizacion(alfa, () => cockpitDelMes('UTC', 0, quien));
  assert.equal(antes.cobrado.valor, null, 'sin resultados, cobrado tiene que ser un cero NO medido');
  assert.ok(antes.cobrado.falta, 'y tiene que decir por qué');

  await conOrganizacion(alfa, () =>
    registrarResultado(a, { ...BASE, que: del('venta'), monto: '1000.00', formaPago: 'Contado', quien }),
  );
  await conOrganizacion(alfa, () =>
    registrarResultado(b, { ...BASE, que: del('acuerdo_sin_pago'), monto: '500.00', quien }),
  );

  const despues = await conOrganizacion(alfa, () => cockpitDelMes('UTC', 0, quien));
  assert.equal(despues.cobrado.valor, 1000, 'el cobrado no cuenta la venta');
  assert.equal(despues.ventas.valor, 1);
  assert.equal(despues.acuerdos.valor, 1);
  // Y ya no hace falta explicar nada: el número es un hecho.
  assert.equal(despues.cobrado.falta, undefined);
});

test('el cockpit es del closer DESIGNADO: las ventas de otro no entran', async () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // ES EL DEFECTO QUE LA MIGRACION 015 MIDIO Y NO PUDO CERRAR SOLA
  //
  // Su encabezado lo dejo escrito: *"ese `cobrado` es de TODA la organizacion — `cockpitDelMes` no
  // recibe `usuarioId` y la consulta filtra solo por fecha"*. Con la comisión guardada por persona,
  // la pantalla multiplicaba un porcentaje personal por una base de la empresa: *"correcto con un
  // closer y falso desde el segundo. Y no falla: da un número plausible **y más alto**"*.
  //
  // Ahora el cockpit recibe de quien son los números. Esta prueba es la que lo mantiene: registra una
  // venta de OTRA persona y exige que no aparezca.
  //
  // Sin el `where registrado_por`, `cobrado` daria 1500 en vez de 1000 y las dos aserciones de abajo
  // pasarian igual si solo mirasen "hay un número".
  // ═══════════════════════════════════════════════════════════════════════════
  await limpiar();

  /* ── EL SEGUNDO USUARIO SE CREA ACA, Y LA PRIMERA VERSION NO LO HACIA ─────
   *
   * Buscaba un segundo usuario en el sembrado y afirmaba `assert.ok(otros[0])`. El sembrado tiene
   * UNO, así que la prueba falló — y eso estuvo bien: fallar es lo correcto cuando no se puede
   * comprobar lo que la prueba dice comprobar. La alternativa habría sido un `if (!otro) return`,
   * que la deja verde sin haber medido nada y es peor que no tenerla.
   *
   * Se crea con `email` y `password_hash` NULOS, que la 002 admite con un `check` de «los dos nulos
   * o los dos no nulos»: es un usuario que solo sirve para atribuir trabajo, que es exactamente lo
   * que hace falta acá — un destino valido para la clave foranea de `registrado_por`. */
  const nuevo = await filas<{ id: string }>(
    admin,
    `insert into identidad.usuarios (org_id, nombre) values ($1, $2) returning id`,
    [alfa, 'Otro que registra'],
  );
  assert.ok(nuevo[0], 'no se pudo crear el segundo usuario');
  const otro = nuevo[0]!.id;

  const mio = await contactoEn(alfa);
  const ajeno = await contactoEn(alfa);

  await conOrganizacion(alfa, () =>
    registrarResultado(mio, { ...BASE, que: del('venta'), monto: '1000.00', formaPago: 'Contado', quien }),
  );
  await conOrganizacion(alfa, () =>
    registrarResultado(ajeno, {
      ...BASE,
      que: del('venta'),
      monto: '500.00',
      formaPago: 'Contado',
      quien: otro,
    }),
  );

  const ck = await conOrganizacion(alfa, () => cockpitDelMes('UTC', 0, quien));
  assert.equal(
    ck.cobrado.valor,
    1000,
    'el cobrado del cockpit incluye ventas de otra persona: es la base de la comisión, así que ' +
      'infla lo que cobra el closer designado',
  );
  assert.equal(ck.ventas.valor, 1, 'la cuenta de ventas incluye las de otra persona');

  // Y el del OTRO ve las suyas, que es la otra mitad: el filtro filtra, no esconde.
  const suyo = await conOrganizacion(alfa, () => cockpitDelMes('UTC', 0, otro));
  assert.equal(suyo.cobrado.valor, 500);

  /* Se borra el usuario creado, y EN ESTE ORDEN: primero los resultados, porque
     `resultados.registrado_por` tiene clave foranea sin cascade y el borrado del usuario fallaria.
     `limpiar()` ya borra resultados, así que se lo llama antes en vez de repetir su cuerpo. */
  await limpiar();
  await admin.query('delete from identidad.usuarios where id = $1', [otro]);
});

test('sin closer designado el cockpit dice que FALTA, y no cero', async () => {
  // La regla de todo este archivo, aplicada al caso nuevo. Con `closerId` nulo no hay a quien medir,
  // y eso NO es «no vendio nada»: es que nadie eligió de quien son los números.
  //
  // El `?? 0` que esta prueba impide es tentador de verdad, porque la pantalla ya sabe dibujar un
  // cero y el nulo obliga a un camino más.
  await limpiar();
  const id = await contactoEn(alfa);
  await conOrganizacion(alfa, () =>
    registrarResultado(id, { ...BASE, que: del('venta'), monto: '2000.00', formaPago: 'Contado', quien }),
  );

  const ck = await conOrganizacion(alfa, () => cockpitDelMes('UTC', 0, null));
  assert.equal(
    ck.cobrado.valor,
    null,
    'sin closer designado el cockpit devolvio un número: son las ventas de la empresa mostradas ' +
      'como si fueran de un closer que nadie eligió',
  );
  assert.match(
    ck.cobrado.falta ?? '',
    /closer asignado/i,
    'el texto de falta no dice que lo que falta es designar al closer, así que manda a cargar un ' +
      'resultado que ya existe',
  );
});

test('un acuerdo sin pago NO suma al cobrado: es plata comprometida, no cobrada', async () => {
  // Confundirlos infla el número del que dependen las comisiones.
  await limpiar();
  const id = await contactoEn(alfa);
  await conOrganizacion(alfa, () =>
    registrarResultado(id, { ...BASE, que: del('acuerdo_sin_pago'), monto: '900.00', quien }),
  );

  const c = await conOrganizacion(alfa, () => cockpitDelMes('UTC', 0, quien));
  assert.equal(c.cobrado.valor, 0, 'un acuerdo sin pago entró al cobrado');
  assert.equal(c.acuerdos.valor, 1);
  // Y el cero de arriba es MEDIDO: hubo un resultado, no hubo ventas. Sin `falta`.
  assert.equal(c.cobrado.falta, undefined);
});

// ═══ 3 · El Pipeline ════════════════════════════════════════════════════════

test('el Pipeline devuelve las SIETE columnas, con las vacías en cero', async () => {
  await limpiar();
  const id = await contactoEn(alfa);
  await conOrganizacion(alfa, () =>
    registrarResultado(id, { ...BASE, que: del('no_show'), quien }),
  );

  const p = await conOrganizacion(alfa, () => pipelineDe('closer', { conCongelados: true }));
  assert.equal(p.columnas.length, 7);
  assert.equal(p.total, 1);
  const noShow = p.columnas.find((c) => c.clave === 'no_show');
  assert.equal(noShow?.cuantos, 1);
  assert.equal(noShow?.filas.length, 1);
  // Las vacías se dibujan igual: una columna que desaparece hace que nadie note que está vacía.
  for (const c of p.columnas) {
    assert.equal(typeof c.cuantos, 'number', `${c.clave} sin conteo`);
    assert.ok(c.nombre.length > 0);
  }
  assert.equal(p.columnas.find((c) => c.clave === 'ganado')?.cuantos, 0);
});

test('un contacto SIN Avanzar cae en la entrada, y el Pipeline dice de dónde salió cada uno', async () => {
  // Mientras la mayoría esté clasificada por etiquetas, las columnas describen lo que el CRM
  // etiquetó y no lo que alguien registró. La pantalla lo puede decir porque esto lo cuenta.
  await limpiar();
  await contactoEn(alfa);
  const conEtiqueta = await contactoEn(alfa, { etiquetas: ['noshow'] });
  const conResultado = await contactoEn(alfa);
  await conOrganizacion(alfa, () =>
    registrarResultado(conResultado, { ...BASE, que: del('venta'), monto: '1.00', quien }),
  );

  const p = await conOrganizacion(alfa, () => pipelineDe('closer', { conCongelados: true }));
  assert.equal(p.total, 3);
  assert.equal(p.clasificados.porResultado, 1);
  assert.equal(p.clasificados.porEtiqueta, 1);
  assert.equal(p.clasificados.sinNada, 1);
  assert.equal(p.columnas.find((c) => c.clave === 'agendado')?.cuantos, 1);
  assert.equal(p.columnas.find((c) => c.clave === 'no_show')?.cuantos, 1);
  assert.equal(p.columnas.find((c) => c.clave === 'ganado')?.cuantos, 1);
  assert.ok(
    p.columnas.find((c) => c.clave === 'no_show')?.filas.some((f) => f.id === conEtiqueta),
  );
});

test('el Pipeline de una empresa no ve los contactos de la otra', async () => {
  await limpiar();
  await contactoEn(beta);
  const p = await conOrganizacion(alfa, () => pipelineDe('closer', { conCongelados: true }));
  assert.equal(p.total, 0);
  const q = await conOrganizacion(beta, () => pipelineDe('closer', { conCongelados: true }));
  assert.equal(q.total, 1);
});

test('el escritor NO crea tarea con el modo automatico, aunque le llegue una fecha', async () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // POR QUÉ ESTA PRUEBA EXISTE, Y POR QUÉ ESTÁ ACÁ Y NO EN LA RUTA
  //
  // La ruta rechaza `automatico` + fecha, así que por ese camino la combinación no llega nunca. Una
  // mutación que borrara el guardia del ESCRITOR sobrevivía entera: las pruebas de la ruta no la
  // veían porque la ruta cortaba antes.
  //
  // Pero `registrarResultado` no es privado de la ruta —otras pruebas lo llaman directo, y el día que
  // exista un segundo camino de registro también— y su regla es suya: **si al contacto lo persigue el
  // CRM, no se escribe un recordatorio nuestro**. Escribirlo pondría al contacto en Mi Día como algo
  // que una persona tiene que hacer, cuando no hay nada que hacer.
  // ═══════════════════════════════════════════════════════════════════════════
  await limpiar();
  const id = await contactoEn(alfa);
  const dia = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  const r = await conOrganizacion(alfa, () =>
    registrarResultado(id, {
      ...BASE,
      que: del('seguimiento'),
      modo: 'automatico',
      // La fecha llega, y el escritor la tiene que ignorar por su cuenta.
      volverEl: dia,
      quien,
    }),
  );

  assert.equal(
    r.tarea,
    false,
    'el escritor creó la tarea con el modo automático: el contacto va a aparecer en Mi Día como ' +
      'trabajo de una persona, cuando lo persigue la secuencia del CRM',
  );
  const quedo = await conOrganizacion(alfa, async () =>
    datos().selectFrom('tareas').select('id').where('contacto_id', '=', id).execute(),
  );
  assert.deepEqual(quedo, [], 'quedó una fila en `negocio.tareas`');

  // Y la otra mitad, para que la prueba no pase por un escritor que nunca escribe tareas.
  const manual = await conOrganizacion(alfa, () =>
    registrarResultado(id, { ...BASE, que: del('seguimiento'), modo: 'manual', volverEl: dia, quien }),
  );
  assert.equal(manual.tarea, true, 'con el modo manual tampoco escribe: el guardia agarra de más');
});
