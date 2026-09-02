// Los LINKS RÁPIDOS: la vuelta completa contra la base y las dos rutas. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE SE PERSIGUE ACÁ ES DINERO QUE ENTRA EN LA CUENTA EQUIVOCADA
//
// Un link de cobro es la única cosa de esta plataforma que, mal guardada, hace que alguien pague
// **a otro**. Y ninguno de sus modos de falla se ve:
//
//   · Un link de la empresa A visible desde la B es su lista de precios completa — y una cuenta de
//     cobro ajena que un closer le podría mandar a un lead sin notarlo.
//   · Dos filas con la MISMA dirección en el mismo menú se ven como dos opciones distintas y hacen
//     lo mismo.
//   · Un `http://` guardado manda el pago en claro, y la pantalla lo dibuja igual que los demás.
//   · Alguien sin permiso de configurar que pueda cargar un link redirige el cobro de toda la
//     empresa, y el menú se sigue viendo igual.
//
// ── Y DESDE LA 036, UN QUINTO: LA ZONA EQUIVOCADA ─────────────────────────
//
// Cada zona tiene su menú: el closer cobra, el setter agenda. Un link que cae en la zona que no es
// **no falla en ninguna parte** — aparece en el menú de gente que no lo pidió, y en el peor caso le
// pone a un setter un checkout de $4.000 al lado del calendario.
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
} from '../../lib/negocio/enlacesRapidos.ts';
import type { Territorio } from '../../lib/datos/esquema.ts';
import { GET as verEnlaces } from '../../app/api/enlaces-rapidos/route.ts';
import {
  DELETE as sacarEnlace,
  POST as cargarEnlace,
} from '../../app/api/admin/enlaces-rapidos/route.ts';

let esc: Escenario;

before(async () => {
  esc = await montar('Enlaces');
});
after(async () => {
  await esc.admin.query('delete from negocio.enlaces_rapidos');
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
  await esc.admin.query('delete from negocio.enlaces_rapidos');
}

/** Un link cargado por la vía normal, con la comprobación de que se guardó. */
async function unEnlace(
  nombre: string,
  url: string,
  monto: string | null = null,
  territorio: Territorio = 'closer',
): Promise<void> {
  const porque = await conOrganizacion(esc.org, () =>
    crearEnlace({ territorio, nombre, monto, descripcion: null, url }, esc.quien),
  );
  assert.equal(porque, null, `no se pudo sembrar ${nombre}: ${porque}`);
}

/** Escribe DIRECTO contra la base, saltándose la ruta: es lo que prueba a los `check`. */
async function crudo(
  orgId: string,
  nombre: string,
  url: string,
  territorio: string = 'closer',
): Promise<void> {
  await esc.admin.query(
    'insert into negocio.enlaces_rapidos (org_id, territorio, nombre, url) values ($1, $2, $3, $4)',
    [orgId, territorio, nombre, url],
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · EL AISLAMIENTO
// ═══════════════════════════════════════════════════════════════════════════════

test('los links de una empresa NO se ven desde la otra', async () => {
  /* El peor de los modos de falla. No es solo ver la lista de precios de otro: es tener a mano, en
     el menú del chat, una cuenta de cobro ajena — y mandarla es un clic. */
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
// 2 · LAS DOS ZONAS
// ═══════════════════════════════════════════════════════════════════════════════

test('la MISMA dirección puede estar en las DOS zonas de una empresa', async () => {
  /* Es el arreglo que trajo la 036, y no un permiso de más. El link del calendario ofrecido tanto
     al que todavía no agendó como al que ya agendó es legítimo y va a pasar; con el `unique
     (org_id, url)` de la 035 el segundo se rechazaba con un error que nombra un índice, y nadie
     entendería por qué su propio link «ya existe» si en su menú no está. */
  await sinEnlaces();
  const calendario = 'https://cal.com/aria/llamada';
  await unEnlace('Calendario', calendario, null, 'closer');
  await unEnlace('Calendario', calendario, null, 'setter');

  const todos = await conOrganizacion(esc.org, listarEnlaces);
  assert.deepEqual(
    todos.map((e) => e.territorio).sort(),
    ['closer', 'setter'],
    'la misma dirección no se pudo ofrecer en las dos zonas',
  );
});

test('la base RECHAZA dos links con la misma dirección DENTRO de una zona', async () => {
  /* El duplicado que sí hace daño: dos entradas del MISMO menú que se ven distintas y hacen lo
     mismo. Quien elige no tiene forma de notarlo. */
  await sinEnlaces();
  const url = 'https://buy.stripe.com/repetido';
  await crudo(esc.org, 'Uno', url, 'setter');
  await assert.rejects(
    () => crudo(esc.org, 'Dos', url, 'setter'),
    (e: { code?: string }) => e.code === '23505',
    'se cargaron dos links a la misma dirección en la misma zona',
  );

  // Los NOMBRES repetidos, en cambio, son legítimos: los cinco de Stripe se llaman «Stripe».
  await crudo(esc.org, 'Uno', 'https://buy.stripe.com/otro', 'setter');
});

test('la base solo acepta las DOS zonas que existen', async () => {
  /* El vocabulario lo hace cumplir la base y no una lista en el código, por lo mismo que la 027 lo
     escribió para los agentes del auditor: dos listas del mismo hecho divergen en silencio, y una
     zona inventada dejaría un link que ningún menú dibuja y que nadie puede encontrar. */
  await sinEnlaces();
  await assert.rejects(
    () => crudo(esc.org, 'De ninguna parte', 'https://buy.stripe.com/x', 'gerencia'),
    (e: { code?: string }) => e.code === '23514',
  );
});

test('el tope es POR ZONA: llenar la del closer no le come lugar al setter', async () => {
  /* El tope existe para que un MENÚ se pueda leer, y hay uno por zona. Contarlos juntos haría que
     cargar links de setter fuera dejando sin lugar al closer, con un mensaje que habla de un tope
     que en su propia lista no se alcanzó. */
  await sinEnlaces();
  for (let i = 0; i < TOPE_DE_ENLACES; i += 1) {
    await unEnlace('Stripe', `https://buy.stripe.com/n${i}`, null, 'closer');
  }

  const lleno = await conOrganizacion(esc.org, () =>
    crearEnlace(
      {
        territorio: 'closer',
        nombre: 'Uno más',
        monto: null,
        descripcion: null,
        url: 'https://buy.stripe.com/extra',
      },
      esc.quien,
    ),
  );
  assert.equal(lleno, 'tope');

  // Y la otra zona sigue vacía y acepta.
  const otra = await conOrganizacion(esc.org, () =>
    crearEnlace(
      {
        territorio: 'setter',
        nombre: 'Calendario',
        monto: null,
        descripcion: null,
        url: 'https://cal.com/aria/primera',
      },
      esc.quien,
    ),
  );
  assert.equal(otra, null, 'el tope del closer bloqueó la zona del setter');
});

test('el orden agrupa por zona, y dentro de cada una respeta la carga', async () => {
  /* Las dos mitades importan. La zona primero, porque un contacto sin territorio ve las DOS listas
     en un mismo menú y sin agrupar quedarían intercaladas por `orden` — el checkout de $4.000 al
     lado del calendario.

     Y dentro de cada zona, el orden de carga: ordenar por monto sería tentador y saldría mal, porque
     los montos se repiten entre proveedores. */
  await sinEnlaces();
  await unEnlace('Calendario', 'https://cal.com/a', null, 'setter');
  await unEnlace('Stripe', 'https://buy.stripe.com/a', '$4.000', 'closer');
  await unEnlace('Video', 'https://youtu.be/b', null, 'setter');
  await unEnlace('Stripe', 'https://buy.stripe.com/b', '$250', 'closer');

  assert.deepEqual(
    (await conOrganizacion(esc.org, listarEnlaces)).map((e) => `${e.territorio}:${e.nombre}`),
    ['closer:Stripe', 'closer:Stripe', 'setter:Calendario', 'setter:Video'],
    'la lista no sale agrupada por zona y en orden de carga',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · LO QUE LA BASE NO ACEPTA
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
        `insert into negocio.enlaces_rapidos (org_id, territorio, nombre, monto, url)
         values ($1, 'closer', $2, $3, $4)`,
        [esc.org, 'Stripe', '  ', 'https://buy.stripe.com/monto-vacio'],
      ),
    (e: { code?: string }) => e.code === '23514',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · EL ORDEN AL AGREGAR
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · LA DIRECCIÓN: LO QUE EL `check` DE LA BASE NO PUEDE VER
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
// 6 · LAS DOS PUERTAS
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
   * closers y todos los setters** y lleno solo para quien administra — sin ningún error, y en la
   * pantalla donde se usa.
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
    await verEnlaces(pedirComo('/api/enlaces-rapidos', comun)),
  );
  assert.equal(vista.estado, 200, 'quien puede abrir una ficha no ve los links');
  assert.deepEqual(vista.cuerpo.enlaces.map((e) => e.url), ['https://buy.stripe.com/visible']);

  const intento = await cargarEnlace(
    pedirComo('/api/admin/enlaces-rapidos', comun, {
      metodo: 'POST',
      cuerpo: { territorio: 'closer', nombre: 'Mío', url: 'https://buy.stripe.com/del-atacante' },
    }),
  );
  assert.equal(intento.status, 403, 'alguien sin `credenciales.editar` cargó un link de cobro');
  assert.equal(
    (await conOrganizacion(esc.org, listarEnlaces)).length,
    1,
    'el rechazo devolvió 403 y guardó igual',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7 · LA RUTA
// ═══════════════════════════════════════════════════════════════════════════════

test('la ruta EXIGE la zona, y no tiene una por omisión', async () => {
  /* Con un valor por omisión, una pantalla que se olvide de mandar la zona cargaría el link en la
     otra **en silencio** — y ahí aparecería en el menú de gente que no lo pidió, sin que nada falle.
     Es el mismo motivo por el que la migración 036 le quita el `default` a la columna después de
     rellenar las filas viejas. */
  await sinEnlaces();
  for (const zona of [undefined, '', 'gerencia', 'CLOSER']) {
    const r = await leerRespuesta<{ detalle?: string }>(
      await cargarEnlace(
        pedirComo('/api/admin/enlaces-rapidos', esc.token, {
          metodo: 'POST',
          cuerpo: { territorio: zona, nombre: 'Stripe', url: 'https://buy.stripe.com/x' },
        }),
      ),
    );
    assert.equal(r.estado, 400, `la ruta aceptó la zona ${JSON.stringify(zona)}`);
    assert.match(String(r.cuerpo.detalle), /zona/);
  }
  assert.equal((await conOrganizacion(esc.org, listarEnlaces)).length, 0);
});

test('la ruta rechaza las direcciones malas con un motivo, y no guarda nada', async () => {
  await sinEnlaces();
  for (const mala of ['http://buy.stripe.com/x', 'javascript:alert(1)', 'https://', 'nada']) {
    const r = await leerRespuesta<{ detalle?: string }>(
      await cargarEnlace(
        pedirComo('/api/admin/enlaces-rapidos', esc.token, {
          metodo: 'POST',
          cuerpo: { territorio: 'setter', nombre: 'Stripe', url: mala },
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

test('la ruta guarda el link EN LA ZONA QUE SE LE PIDIÓ', async () => {
  /* La mitad positiva de la prueba de arriba. Sin ella, una ruta que rechazara toda zona la pasaría
     igual — y una que las aceptara todas guardándolas siempre en la del closer, también. */
  await sinEnlaces();
  const r = await leerRespuesta<{ enlaces: { territorio: string; nombre: string }[] }>(
    await cargarEnlace(
      pedirComo('/api/admin/enlaces-rapidos', esc.token, {
        metodo: 'POST',
        cuerpo: {
          territorio: 'setter',
          nombre: 'Calendario',
          descripcion: 'Para agendar la llamada',
          url: 'https://cal.com/aria/llamada',
        },
      }),
    ),
  );
  assert.equal(r.estado, 200);
  assert.deepEqual(
    r.cuerpo.enlaces.map((e) => `${e.territorio}:${e.nombre}`),
    ['setter:Calendario'],
    'el link no quedó en la zona que se pidió',
  );
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
      pedirComo('/api/admin/enlaces-rapidos', esc.token, {
        metodo: 'POST',
        cuerpo: {
          territorio: 'closer',
          nombre: 'Stripe',
          monto: '$4.000',
          descripcion: 'Pago único',
          url,
        },
      }),
    ),
  );
  assert.equal(alta.estado, 200);
  const id = alta.cuerpo.enlaces[0]!.id;

  const baja = await sacarEnlace(
    pedirComo(`/api/admin/enlaces-rapidos?id=${id}`, esc.token, { metodo: 'DELETE' }),
  );
  assert.equal(baja.status, 200);

  const { rows } = await esc.admin.query<{ accion: string; enlace: string }>(
    `select accion, detalle->>'enlace' as enlace from identidad.auditoria_accesos
      where accion like 'enlace_rapido%' and detalle->>'enlace' = $1
      order by creado_el, id`,
    [url],
  );
  assert.deepEqual(
    rows.map((f) => f.accion),
    ['enlace_rapido_creado', 'enlace_rapido_borrado'],
  );
  assert.deepEqual(rows.map((f) => f.enlace), [url, url], 'la fila no dice CUÁL link');
});

test('la dirección repetida vuelve como 409 con su motivo, no como un error del servidor', async () => {
  /* La base ya lo impide con `enlaces_rapidos_url_unica`. La comprobación previa de `crearEnlace` no
     está para eso: está para que el formulario reciba **una frase que se pueda leer** en vez de un 500
     con un `23505` que nombra un índice.

     Es un 409 y no un 400 porque la petición está impecable: lo que no admite el caso es el estado del
     servidor. Un 400 mandaría a revisar los campos. */
  await sinEnlaces();
  const url = 'https://buy.stripe.com/una-sola-vez';
  const uno = await cargarEnlace(
    pedirComo('/api/admin/enlaces-rapidos', esc.token, {
      metodo: 'POST',
      cuerpo: { territorio: 'closer', nombre: 'Stripe', url },
    }),
  );
  assert.equal(uno.status, 200);

  const dos = await leerRespuesta<{ detalle?: string }>(
    await cargarEnlace(
      pedirComo('/api/admin/enlaces-rapidos', esc.token, {
        metodo: 'POST',
        cuerpo: { territorio: 'closer', nombre: 'Stripe otra vez', url },
      }),
    ),
  );
  assert.equal(dos.estado, 409, 'una dirección repetida no salió como 409');
  assert.match(String(dos.cuerpo.detalle), /misma dirección/);
  assert.equal((await conOrganizacion(esc.org, listarEnlaces)).length, 1);

  // Y en la OTRA zona el mismo link entra: la unicidad es por menú, no por empresa.
  const enLaOtra = await cargarEnlace(
    pedirComo('/api/admin/enlaces-rapidos', esc.token, {
      metodo: 'POST',
      cuerpo: { territorio: 'setter', nombre: 'Stripe', url },
    }),
  );
  assert.equal(enLaOtra.status, 200, 'la unicidad se está midiendo por empresa y no por menú');
});

test('sacar un link que ya no está NO dice «borrado»', async () => {
  /* Puede ser un segundo clic, o la pantalla de otra persona que lo borró primero. No es un error
     del servidor, pero contestar 200 le diría a quien apretó que acaba de sacar algo — y en una lista
     de links de cobro, creer que sacaste uno que sigue ahí es exactamente lo que no puede pasar. */
  await sinEnlaces();
  const inventado = '00000000-0000-4000-8000-000000000000';
  const r = await sacarEnlace(
    pedirComo(`/api/admin/enlaces-rapidos?id=${inventado}`, esc.token, { metodo: 'DELETE' }),
  );
  assert.equal(r.status, 404);
});
