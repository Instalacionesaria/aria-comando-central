// Los LINKS DE COBRO: la vuelta completa contra la base y las dos rutas. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE SE PERSIGUE ACÁ ES DINERO QUE ENTRA EN LA CUENTA EQUIVOCADA
//
// Un link de cobro es la única cosa de esta plataforma que, mal guardada, hace que alguien pague
// **a otro**. Y ninguno de sus modos de falla se ve:
//
//   · Un link de la empresa A visible desde la B es su lista de precios completa — y una cuenta de
//     cobro ajena que un closer le podría mandar a un lead sin notarlo.
//   · Dos filas con la MISMA dirección se ven como dos opciones distintas del menú y cobran lo
//     mismo.
//   · Un `http://` guardado manda el pago en claro, y la pantalla lo dibuja igual que los demás.
//   · Alguien sin permiso de configurar que pueda cargar un link redirige el cobro de toda la
//     empresa, y el menú se sigue viendo igual.
//
// Las cuatro se comprueban acá, y las cuatro contra la BASE y no contra la intención del código.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { leerRespuesta, montar, pedirComo, sesionDe, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import {
  borrarEnlace,
  crearEnlace,
  listarEnlaces,
  TOPE_DE_ENLACES,
  urlDePagoValida,
} from '../../lib/negocio/enlacesDePago.ts';
import { GET as verEnlaces } from '../../app/api/enlaces-de-pago/route.ts';
import {
  DELETE as sacarEnlace,
  POST as cargarEnlace,
} from '../../app/api/admin/enlaces-de-pago/route.ts';

let esc: Escenario;

before(async () => {
  esc = await montar('Enlaces');
});
after(async () => {
  await esc.admin.query('delete from negocio.enlaces_de_pago');
  /* Y la persona que este archivo crea. Sin esto queda en el sembrado y **rompe pruebas de otros
     archivos**: `08-sembrado` afirma que hay UN usuario por organización y que el hash de cada uno
     verifica, y el de acá es un texto inventado. Medido: nueve pruebas en rojo en tres archivos,
     ninguna de ellas de esta función. */
  await esc.admin.query(`delete from identidad.usuarios where email = 'comun@enlaces.ejemplo'`);
  await cerrarTodo();
  await cerrarClientes();
});

/** Las dos empresas sin links, para que cada prueba empiece del mismo estado. */
async function sinEnlaces(): Promise<void> {
  await esc.admin.query('delete from negocio.enlaces_de_pago');
}

/** Un link cargado por la vía normal, con la comprobación de que se guardó. */
async function unEnlace(nombre: string, url: string, monto: string | null = null): Promise<void> {
  const porque = await conOrganizacion(esc.org, () =>
    crearEnlace({ nombre, monto, descripcion: null, url }, esc.quien),
  );
  assert.equal(porque, null, `no se pudo sembrar ${nombre}: ${porque}`);
}

/** Escribe DIRECTO contra la base, saltándose la ruta: es lo que prueba a los `check`. */
async function crudo(orgId: string, nombre: string, url: string): Promise<void> {
  await esc.admin.query(
    'insert into negocio.enlaces_de_pago (org_id, nombre, url) values ($1, $2, $3)',
    [orgId, nombre, url],
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · EL AISLAMIENTO
// ═══════════════════════════════════════════════════════════════════════════════

test('los links de una empresa NO se ven desde la otra', async () => {
  /* El peor de los cuatro modos de falla. No es solo ver la lista de precios de otro: es tener a
     mano, en el menú del chat, una cuenta de cobro ajena — y mandarla es un clic. */
  await sinEnlaces();
  await unEnlace('Stripe', 'https://buy.stripe.com/propio');
  await crudo(esc.otraOrg, 'Ajeno', 'https://buy.stripe.com/de-la-otra-empresa');

  const mios = await conOrganizacion(esc.org, listarEnlaces);
  assert.deepEqual(
    mios.map((e) => e.url),
    ['https://buy.stripe.com/propio'],
    'se ve un link de cobro de otra empresa',
  );

  // Y la otra mitad: la otra empresa ve el suyo. Sin esto, un `where` que no devuelva nada nunca
  // pasaría esta prueba igual, y el aislamiento se vería perfecto porque no funciona nada.
  const suyos = await conOrganizacion(esc.otraOrg, listarEnlaces);
  assert.deepEqual(
    suyos.map((e) => e.url),
    ['https://buy.stripe.com/de-la-otra-empresa'],
  );
});

test('la MISMA dirección puede estar en las dos empresas: la unicidad es por inquilino', async () => {
  /* Dos empresas nuestras pueden usar el mismo procesador y hasta el mismo link —una agencia y su
     cliente, por ejemplo—. Un índice único global lo impediría con un error que nombra un índice, y
     nadie entendería por qué su link "ya existe" si su empresa no lo tiene. */
  await sinEnlaces();
  const mismo = 'https://whop.com/checkout/compartido';
  await unEnlace('WHOP', mismo);
  await crudo(esc.otraOrg, 'WHOP', mismo);

  assert.equal((await conOrganizacion(esc.org, listarEnlaces)).length, 1);
  assert.equal((await conOrganizacion(esc.otraOrg, listarEnlaces)).length, 1);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · LO QUE LA BASE NO ACEPTA
// ═══════════════════════════════════════════════════════════════════════════════

test('la base RECHAZA una dirección que no sea `https://`, aunque no pase por la ruta', async () => {
  /* La ruta ya lo valida. Este `check` es lo único que también cubre una escritura a mano, un
     script, o una ruta futura que se olvide — y es la clase de escritura que existe justamente
     cuando alguien está apurado arreglando algo. */
  await sinEnlaces();
  for (const mala of ['http://buy.stripe.com/x', 'javascript:alert(1)', 'buy.stripe.com/x']) {
    await assert.rejects(
      () => crudo(esc.org, 'Malo', mala),
      (e: { code?: string }) => e.code === '23514',
      `la base aceptó ${mala}`,
    );
  }
  // Y acepta la buena: sin esto, un `check` imposible de satisfacer pasaría igual.
  await crudo(esc.org, 'Bueno', 'https://buy.stripe.com/x');
});

test('la base RECHAZA dos links con la misma dirección en la misma empresa', async () => {
  /* El duplicado que hace daño: dos entradas del menú que se ven distintas y cobran lo mismo. Quien
     elige no tiene forma de notarlo. */
  await sinEnlaces();
  const url = 'https://buy.stripe.com/repetido';
  await crudo(esc.org, 'Uno', url);
  await assert.rejects(
    () => crudo(esc.org, 'Dos', url),
    (e: { code?: string }) => e.code === '23505',
    'se cargaron dos links a la misma dirección',
  );

  // Los NOMBRES repetidos, en cambio, son legítimos: los cinco de Stripe se llaman «Stripe».
  await crudo(esc.org, 'Uno', 'https://buy.stripe.com/otro');
});

test('un texto en blanco no es un valor: nombre, monto y descripción vacíos se rechazan', async () => {
  /* Un `monto` de cero caracteres se dibuja como un hueco en el menú, y un hueco no se distingue de
     un defecto de la pantalla. Es la misma disciplina que `prompts_del_agente` escribió para su
     texto. */
  await sinEnlaces();
  await assert.rejects(
    () => crudo(esc.org, '   ', 'https://buy.stripe.com/sin-nombre'),
    (e: { code?: string }) => e.code === '23514',
  );
  await assert.rejects(
    () =>
      esc.admin.query(
        'insert into negocio.enlaces_de_pago (org_id, nombre, monto, url) values ($1, $2, $3, $4)',
        [esc.org, 'Stripe', '  ', 'https://buy.stripe.com/monto-vacio'],
      ),
    (e: { code?: string }) => e.code === '23514',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · EL TOPE Y EL ORDEN
// ═══════════════════════════════════════════════════════════════════════════════

test('el link número ' + String(TOPE_DE_ENLACES + 1) + ' se rechaza, y lo DICE', async () => {
  await sinEnlaces();
  for (let i = 0; i < TOPE_DE_ENLACES; i += 1) {
    await unEnlace('Stripe', `https://buy.stripe.com/n${i}`);
  }
  const porque = await conOrganizacion(esc.org, () =>
    crearEnlace(
      { nombre: 'Uno más', monto: null, descripcion: null, url: 'https://buy.stripe.com/extra' },
      esc.quien,
    ),
  );
  assert.equal(porque, 'tope');
  assert.equal((await conOrganizacion(esc.org, listarEnlaces)).length, TOPE_DE_ENLACES);
});

test('los links salen en el orden en que se cargaron, y uno nuevo va AL FINAL', async () => {
  /* Ordenar por monto sería tentador y saldría mal: los montos se repiten entre Stripe y WHOP, así
     que los dos proveedores quedarían intercalados. Acá se comprueba que el orden es el de carga, que
     es lo que hace que el menú se vea como la lista que alguien escribió. */
  await sinEnlaces();
  await unEnlace('Stripe', 'https://buy.stripe.com/a', '$4.000');
  await unEnlace('Stripe', 'https://buy.stripe.com/b', '$250');
  await unEnlace('WHOP', 'https://whop.com/checkout/c', '$8.000');

  assert.deepEqual(
    (await conOrganizacion(esc.org, listarEnlaces)).map((e) => e.monto),
    ['$4.000', '$250', '$8.000'],
    'el menú no respeta el orden de carga',
  );
});

test('borrar en el MEDIO no hace que el próximo se intercale', async () => {
  /* El defecto que evita calcular el orden con el máximo y no con la cantidad: con tres links, uno
     borrado y `orden = cantidad + 1`, el nuevo nace con un `orden` que ya existe y aparece en el
     medio de la lista. No falla nada; el menú simplemente queda en otro orden que el que se ve en la
     pantalla de configuración. */
  await sinEnlaces();
  await unEnlace('Uno', 'https://buy.stripe.com/1');
  await unEnlace('Dos', 'https://buy.stripe.com/2');
  await unEnlace('Tres', 'https://buy.stripe.com/3');

  const dos = (await conOrganizacion(esc.org, listarEnlaces))[1]!;
  assert.equal(await conOrganizacion(esc.org, () => borrarEnlace(dos.id)), true);
  await unEnlace('Cuatro', 'https://buy.stripe.com/4');

  assert.deepEqual(
    (await conOrganizacion(esc.org, listarEnlaces)).map((e) => e.nombre),
    ['Uno', 'Tres', 'Cuatro'],
    'el link nuevo no fue al final',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · LA DIRECCIÓN: LO QUE EL `check` DE LA BASE NO PUEDE VER
// ═══════════════════════════════════════════════════════════════════════════════

test('`https://` a secas pasa el `check` de la base y NO pasa la validación de la ruta', async () => {
  /* Ésta es la prueba que justifica que la validación esté en los dos lados. El `check` es
     `like 'https://%'`, que es lo más que se puede escribir ahí — y deja pasar una dirección sin
     dominio: un link que no lleva a ninguna parte, guardado sin que nada falle, y descubierto por el
     lead que lo recibe. */
  await sinEnlaces();
  await crudo(esc.org, 'Sin dominio', 'https://');
  assert.equal((await conOrganizacion(esc.org, listarEnlaces)).length, 1, 'la base lo rechazó');

  assert.equal(urlDePagoValida('https://'), false, 'la ruta acepta una dirección sin dominio');
  assert.equal(urlDePagoValida('http://buy.stripe.com/x'), false);
  assert.equal(urlDePagoValida('javascript:alert(1)'), false);
  assert.equal(urlDePagoValida('buy.stripe.com/x'), false);
  assert.equal(urlDePagoValida('https://buy.stripe.com/3cI9AUg2xeMc1bD1I97N60c'), true);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · LAS DOS PUERTAS
// ═══════════════════════════════════════════════════════════════════════════════

/** Alguien con el rol `usuario`: ve fichas y manda mensajes, NO configura la empresa. */
async function unaPersonaComun(): Promise<string> {
  // Se borra antes de crear: cada prueba que la pida arranca del mismo estado, y el correo es
  // único por empresa.
  await esc.admin.query(`delete from identidad.usuarios where email = 'comun@enlaces.ejemplo'`);
  const { rows } = await esc.admin.query<{ id: string }>(
    `insert into identidad.usuarios (org_id, nombre, email, password_hash, creado_por)
     values ($1, $2, $3, 'scrypt$16384$8$1$c2FsCg==$aGFzaAo=', null)
     returning id`,
    [esc.org, `${esc.marca} Comun`, 'comun@enlaces.ejemplo'],
  );
  const id = rows[0]!.id;
  await esc.admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id)
     select $1, r.id from identidad.roles r where r.clave = 'usuario' and r.org_id is null
     on conflict do nothing`,
    [id],
  );
  /* ── Y SE LE CONCEDE LA SECCIÓN `credenciales` ────────────────────────────
   *
   * Sin esto, la prueba de abajo no probaba lo que dice. El rol `usuario` es el único con
   * `secciones_restringidas`, así que el 403 del `POST` salía del control de SECCIÓN —no tiene esa
   * pestaña— y la capacidad ni se llegaba a mirar.
   *
   * Medido con una mutación: cambiar la capacidad del `POST` de `credenciales.editar` a
   * `contactos.ver` **no ponía nada rojo**. O sea que la prueba habría dejado pasar exactamente el
   * defecto que existe para impedir.
   *
   * Con la sección concedida, la única barrera que queda es la capacidad, que es la que se afirma.
   * Y no es un caso inventado: sección y rol son ejes independientes, así que «tiene la pestaña de
   * Ajustes y no puede editar credenciales» es una configuración que alguien puede armar. */
  await esc.admin.query(
    `insert into identidad.usuarios_secciones (usuario_id, seccion, concedida_por)
     values ($1, 'credenciales', $2) on conflict do nothing`,
    [id, esc.quien],
  );
  return sesionDe(id);
}

test('quien puede abrir una ficha VE los links; configurarlos es de quien administra', async () => {
  /* ── LAS DOS MITADES SE ROMPEN AL REVÉS ─────────────────────────────────
   *
   * Si la lectura pidiera `credenciales.ver`, el menú del botón `+` quedaría **vacío para todos los
   * closers** y lleno solo para quien administra — sin ningún error, y en la pantalla donde se usa.
   *
   * Si la escritura pidiera `contactos.ver`, cualquiera que abra una ficha podría cambiar la
   * dirección de cobro de la empresa entera.
   *
   * La persona de esta prueba tiene la SECCIÓN `credenciales` concedida a propósito —ver
   * `unaPersonaComun`—, así que el 403 de abajo prueba la capacidad y no la pestaña. */
  await sinEnlaces();
  await unEnlace('Stripe', 'https://buy.stripe.com/visible', '$2.000');
  const comun = await unaPersonaComun();

  const vista = await leerRespuesta<{ enlaces: { url: string }[] }>(
    await verEnlaces(pedirComo('/api/enlaces-de-pago', comun)),
  );
  assert.equal(vista.estado, 200, 'quien puede abrir una ficha no ve los links');
  assert.deepEqual(vista.cuerpo.enlaces.map((e) => e.url), ['https://buy.stripe.com/visible']);

  const intento = await cargarEnlace(
    pedirComo('/api/admin/enlaces-de-pago', comun, {
      metodo: 'POST',
      cuerpo: { nombre: 'Mío', url: 'https://buy.stripe.com/del-atacante' },
    }),
  );
  assert.equal(intento.status, 403, 'alguien sin `credenciales.editar` cargó un link de cobro');
  assert.equal(
    (await conOrganizacion(esc.org, listarEnlaces)).length,
    1,
    'el rechazo devolvió 403 y guardó igual',
  );
});

test('la ruta rechaza las direcciones malas con un motivo, y no guarda nada', async () => {
  await sinEnlaces();
  for (const mala of ['http://buy.stripe.com/x', 'javascript:alert(1)', 'https://', 'nada']) {
    const r = await leerRespuesta<{ detalle?: string }>(
      await cargarEnlace(
        pedirComo('/api/admin/enlaces-de-pago', esc.token, {
          metodo: 'POST',
          cuerpo: { nombre: 'Stripe', url: mala },
        }),
      ),
    );
    assert.equal(r.estado, 400, `la ruta aceptó ${mala}`);
    // El motivo dice QUÉ hacer. Un 400 con «petición inválida» a secas manda a adivinar cuál de los
    // cuatro campos está mal.
    assert.match(String(r.cuerpo.detalle), /https/);
  }
  assert.equal((await conOrganizacion(esc.org, listarEnlaces)).length, 0);
});

test('cargar y sacar dejan rastro en la auditoría, CON la dirección', async () => {
  /* El peor camino de esta función: alguien reemplaza un link por el suyo y toda la empresa se lo
     manda a los leads sin notar nada. Esta ruta no lo puede impedir —quien tiene la capacidad, la
     tiene— y lo único que queda es el rastro. Sin la dirección en la fila, ese rastro diría «alguien
     tocó los links» y no serviría para reconstruir nada. */
  await sinEnlaces();
  /* ── POR QUÉ LA DIRECCIÓN LLEVA LA HORA ─────────────────────────────────

     El registro es de SOLO INSERCIÓN —`identidad.evitar_mutacion()` lo hace cumplir— así que no se
     puede limpiar antes de medir, y sus filas sobreviven a la suite. Con una dirección fija, la
     SEGUNDA corrida encuentra cuatro filas donde espera dos y la prueba se pone roja sin que nada
     esté mal — que es como una prueba se vuelve un obstáculo y termina desactivada.

     Con la hora adentro, cada corrida mide **sus** dos filas. */
  const url = `https://buy.stripe.com/auditado-${Date.now()}`;

  const alta = await leerRespuesta<{ enlaces: { id: string }[] }>(
    await cargarEnlace(
      pedirComo('/api/admin/enlaces-de-pago', esc.token, {
        metodo: 'POST',
        cuerpo: { nombre: 'Stripe', monto: '$4.000', descripcion: 'Pago único', url },
      }),
    ),
  );
  assert.equal(alta.estado, 200);
  const id = alta.cuerpo.enlaces[0]!.id;

  const baja = await sacarEnlace(
    pedirComo(`/api/admin/enlaces-de-pago?id=${id}`, esc.token, { metodo: 'DELETE' }),
  );
  assert.equal(baja.status, 200);

  const { rows } = await esc.admin.query<{ accion: string; enlace: string }>(
    `select accion, detalle->>'enlace' as enlace from identidad.auditoria_accesos
      where accion like 'enlace_de_pago%' and detalle->>'enlace' = $1
      order by creado_el, id`,
    [url],
  );
  assert.deepEqual(
    rows.map((f) => f.accion),
    ['enlace_de_pago_creado', 'enlace_de_pago_borrado'],
  );
  assert.deepEqual(rows.map((f) => f.enlace), [url, url], 'la fila no dice CUÁL link');
});

test('`borrarEnlace` de un identificador que no existe devuelve `false`', async () => {
  /* Lo dice la función y no lo veía nadie: la ruta lee el link ANTES de borrarlo para poder
     escribir en la auditoría cuál sacó, así que su 404 sale de esa lectura y no de acá. Devolver
     `true` a ciegas pasaba las dos pruebas de la ruta.

     Lo que este valor cierra es la CARRERA: dos personas borrando el mismo link a la vez. La que
     llega segunda encuentra la fila en su lectura, no borra nada, y sin este `false` escribiría
     una fila de auditoría diciendo que sacó algo que ya no estaba. */
  await sinEnlaces();
  await unEnlace('Stripe', 'https://buy.stripe.com/sigue-ahi');
  const inventado = '00000000-0000-4000-8000-000000000000';

  assert.equal(await conOrganizacion(esc.org, () => borrarEnlace(inventado)), false);
  assert.equal(
    (await conOrganizacion(esc.org, listarEnlaces)).length,
    1,
    'un identificador inventado se llevó una fila',
  );
});

test('la dirección repetida vuelve como 409 con su motivo, no como un error del servidor', async () => {
  /* La base ya lo impide con `enlaces_de_pago_url_unica`. La comprobación previa de `crearEnlace` no
     está para eso: está para que el formulario reciba **una frase que se pueda leer** en vez de un 500
     con un `23505` que nombra un índice.

     Es un 409 y no un 400 porque la petición está impecable: lo que no admite el caso es el estado del
     servidor. Un 400 mandaría a revisar los campos. */
  await sinEnlaces();
  const url = 'https://buy.stripe.com/una-sola-vez';
  const uno = await cargarEnlace(
    pedirComo('/api/admin/enlaces-de-pago', esc.token, {
      metodo: 'POST',
      cuerpo: { nombre: 'Stripe', url },
    }),
  );
  assert.equal(uno.status, 200);

  const dos = await leerRespuesta<{ detalle?: string }>(
    await cargarEnlace(
      pedirComo('/api/admin/enlaces-de-pago', esc.token, {
        metodo: 'POST',
        cuerpo: { nombre: 'Stripe otra vez', url },
      }),
    ),
  );
  assert.equal(dos.estado, 409, 'una dirección repetida no salió como 409');
  assert.match(String(dos.cuerpo.detalle), /misma dirección/);
  assert.equal((await conOrganizacion(esc.org, listarEnlaces)).length, 1);
});

test('sacar un link que ya no está NO dice «borrado»', async () => {
  /* Puede ser un segundo clic, o la pantalla de otra persona que lo borró primero. No es un error
     del servidor, pero contestar 200 le diría a quien apretó que acaba de sacar algo — y en una lista
     de links de cobro, creer que sacaste uno que sigue ahí es exactamente lo que no puede pasar. */
  await sinEnlaces();
  const inventado = '00000000-0000-4000-8000-000000000000';
  const r = await sacarEnlace(
    pedirComo(`/api/admin/enlaces-de-pago?id=${inventado}`, esc.token, { metodo: 'DELETE' }),
  );
  assert.equal(r.status, 404);
});
