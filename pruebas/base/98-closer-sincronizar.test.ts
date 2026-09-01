// Traer del CRM: el contrato de la ruta, y las dos funciones de `lib/negocio/sincronizar.ts`.
// Más `lib/negocio/zonas.ts`, que decide qué zona horaria se puede guardar. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTE ARCHIVO, Y QUÉ NO CUBRÍA NADIE
//
// `lib/negocio/sincronizar.ts` y `lib/negocio/zonas.ts` eran los dos únicos módulos de
// `lib/negocio/` sin una sola prueba. Los guardias de `pruebas/codigo/` **leen** el archivo: ven
// que dice `exigir(`, que dice `conOrganizacion(` y que no nombra `org_id`. Ninguno lo ejecuta, así
// que ninguno puede ver que el territorio se decidió al revés, que un contacto sin nombre entró
// como «Sin nombre», o que el catálogo de etiquetas se pregunta siempre y cuesta una llamada de más
// en cada sincronización.
//
// ── CÓMO SE PRUEBA UN MÓDULO QUE HABLA CON UN SERVICIO AJENO ───────────────
//
// Se intercepta `globalThis.fetch`, que es la ÚNICA salida del proyecto —`ADR-0305` lo afirma y el
// guardia de `pruebas/codigo/30-portero.test.ts` lo comprueba: `fetch(` aparece en tres archivos y
// `lib/http/cliente.ts` es el que usa esta cadena—. Interceptarlo ahí cubre las cuatro llamadas de
// GoHighLevel de una vez y **no** obliga a inyectar un cliente falso por parámetro, que habría
// cambiado la firma de producción para que la prueba pudiera entrar.
//
// Lo que se gana con eso es lo que importa: la sincronización se ejercita **contra la base de
// verdad**, con la política de fila puesta. El `on conflict (org_id, ghl_contact_id)`, el
// `do update` que no pisa `etapa` ni `score`, y el aislamiento entre organizaciones no se pueden
// comprobar de otra forma — son propiedades de PostgreSQL, no de este código.
//
// ── EL CANDADO DEL PULSO NO SE PRUEBA ACÁ, Y ES A PROPÓSITO ────────────────
//
// `negocio.ingesta_pulso` con `skipLocked` ya tiene su prueba en `25-ingesta.test.ts`, que provoca
// el `ocupado` de verdad sosteniendo un `for update` desde otro cliente. Repetirlo acá sería peor
// que redundante: ese archivo hace `deleteFrom('ingesta_pulso')` sin filtro, así que dos corridas
// cercanas se borrarían la fila mutuamente y el síntoma sería una prueba que falla sola y pasa
// aislada.
//
// Lo que sí se prueba acá, y es lo que faltaba, es que **por el camino de la ruta el candado no se
// alcanza sin credenciales**: `POST /api/closer/agenda/refrescar` resuelve el acceso ANTES de
// llamar a `barrerCitas`, así que en pruebas —donde ninguna organización tiene token— no llega a
// `conElPulso` nunca. Ver la prueba del final.
//
// ── EL ARNÉS DE MUTACIÓN, Y QUÉ MATÓ CADA ASERCIÓN ─────────────────────────
//
// Cada prueba de este archivo se comprobó rompiendo a mano el código que pretende cubrir y
// verificando que se pone ROJA. Diecinueve mutaciones, todas cazadas:
//
//   · invertir el orden de `ETIQUETAS`; sacar el `vistos`; `nombreDe(c) ?? 'Sin nombre'`; sacar
//     `resumen.truncado = true`; preguntar el catálogo siempre; `continue` en vez de `return` sobre
//     el fallo de una etiqueta; `?? 'setter'` en vez de `?? null` para el congelado; meter `etapa`
//     en el `do update`; sacar `nombre` y `email` del `do update`; el `on conflict` sólo por
//     `ghl_contact_id`.
//   · en `lib/ghl/cliente.ts`: `[]` en vez de `null` cuando el catálogo de etiquetas no se pudo
//     leer; el 404 de `contactoPorId` tratado como fallo.
//   · en la ruta: `SIN_SECCION` cambiado por `'closer'`; `['contactos.ver']` por `NINGUNA`; la
//     falta de credencial devuelta como `ok({ sincronizado: true })`.
//   · en `agenda/refrescar`: `PANTALLA` cambiada por `'sin_seccion'`.
//   · en `lib/negocio/zonas.ts`: sacar la comprobación contra `ZONAS`; un error de tipeo en una
//     entrada del catálogo (`America/Lima_Peru`), que sólo la mitad de `Intl` puede cazar.
//   · en el portero: `verificarOrigen` sin efecto.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cerrarTodo, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import {
  DOMINIO,
  leerRespuesta,
  limpiar,
  montar,
  pedirComo,
  sesionDe,
  unContacto,
  type Escenario,
} from '../apoyo/closer.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { COOKIE_SESION } from '../../lib/autorizacion/sesion.ts';
import { TEXTO_DE_FALTA_GHL } from '../../lib/credenciales/resolver.ts';
import type { ContactoDeGhl } from '../../lib/ghl/cliente.ts';
import {
  ETIQUETAS,
  refrescarUnContacto,
  sincronizarContactos,
} from '../../lib/negocio/sincronizar.ts';
import { esZonaValida, ZONAS } from '../../lib/negocio/zonas.ts';
import { POST as sincronizarRuta } from '../../app/api/contactos/sincronizar/route.ts';
import { POST as refrescarAgendaRuta } from '../../app/api/closer/agenda/refrescar/route.ts';

let esc: Escenario;

/** Un acceso cualquiera: el `fetch` interceptado no lo mira, y así queda claro que no es real. */
const ACCESO = { token: 'token-de-prueba', locationId: 'loc-de-prueba' };

/** El anfitrión de la API v2 de GoHighLevel, para separar sus llamadas de cualquier otra. */
const GHL = 'https://services.leadconnectorhq.com';

// ── LA INTERCEPCIÓN ────────────────────────────────────────────────────────

interface PeticionSaliente {
  url: string;
  metodo: string;
  cuerpo: { filters?: { value?: string }[]; page?: number } | undefined;
}

interface RespuestaFalsa {
  estado: number;
  cuerpo: unknown;
}

/** Todo lo que salió del proceso desde el último `preparar`. Es lo que prueba que NO se llamó. */
let salientes: PeticionSaliente[] = [];

/** Qué contesta el doble. Cada prueba pone el suyo con `preparar`. */
let contestar: (p: PeticionSaliente) => RespuestaFalsa = () => ({ estado: 200, cuerpo: {} });

function preparar(respuesta: (p: PeticionSaliente) => RespuestaFalsa): void {
  salientes = [];
  contestar = respuesta;
}

/** Las llamadas que fueron a GoHighLevel, sin contar ninguna otra salida del proceso. */
function llamadasAGhl(): PeticionSaliente[] {
  return salientes.filter((p) => p.url.startsWith(GHL));
}

/** Una página de `POST /contacts/search`, con la forma exacta que devuelve el proveedor. */
function pagina(contactos: ContactoDeGhl[]): RespuestaFalsa {
  return { estado: 200, cuerpo: { contacts: contactos, total: contactos.length } };
}

/** La etiqueta que pide una búsqueda. Es el filtro `eq` que arma `contactosPorEtiqueta`. */
function etiquetaPedida(p: PeticionSaliente): string | undefined {
  return p.cuerpo?.filters?.[0]?.value;
}

/** Un identificador de contacto con la MARCA adelante: es lo único que `limpiar` sabe borrar. */
function idDeGhl(): string {
  return `sincro-${randomUUID()}`;
}

/**
 * El doble contesta lo que el proveedor contestaría a cada etiqueta, y nada a lo demás.
 *
 * Devolver una página vacía para las etiquetas que la prueba no nombra no es un detalle: la
 * sincronización recorre SIEMPRE las dos, y un doble que lanzara sobre la segunda haría que cada
 * prueba midiera el orden del bucle en vez de lo que quiere medir.
 */
function porEtiqueta(mapa: Record<string, ContactoDeGhl[]>): (p: PeticionSaliente) => RespuestaFalsa {
  return (p) => {
    if (p.url.startsWith(`${GHL}/contacts/search`)) {
      const e = etiquetaPedida(p);
      return pagina(e && mapa[e] ? mapa[e] : []);
    }
    // El catálogo de etiquetas, cuando se pregunta.
    if (/\/locations\/.*\/tags$/.test(p.url)) return { estado: 200, cuerpo: { tags: [] } };
    return { estado: 200, cuerpo: {} };
  };
}

/** La fila de un contacto, leída con el contexto de la organización que se le pase. */
async function filaDe(org: string, ghlId: string) {
  return conOrganizacion(org, async () =>
    datos()
      .selectFrom('contactos')
      .select([
        'nombre',
        'territorio',
        'etapa',
        'score',
        'etiquetas',
        'telefono',
        'email',
        'fuente',
        // El asignado del CRM: lo que la conciliación NO tiene que tocar al congelar.
        'crm_asignado_a',
      ])
      .where('ghl_contact_id', '=', ghlId)
      .executeTakeFirst(),
  );
}

// ── LAS PERSONAS QUE HACEN FALTA PARA PROBAR EL PORTERO ────────────────────

/**
 * El nombre con el que se siembra toda persona de este archivo. Es lo que borra `limpiarPersonas`.
 *
 * Va por nombre y no por correo porque el correo lleva un sufijo aleatorio para no chocar con el
 * único de la tabla: filtrar por él obligaría a recordar cuáles se crearon, y una prueba que falla
 * a la mitad dejaría filas sin dueño.
 */
const NOMBRE_DE_PERSONA = 'Sincro persona';

async function unaPersona(
  rol: string | null,
  secciones: readonly string[] = [],
): Promise<{ id: string; token: string }> {
  const r = await esc.admin.query<{ id: string }>(
    `insert into identidad.usuarios (org_id, nombre, email, password_hash)
       values ($1, $2, $3, 'scrypt$16384$8$1$aaaa$bbbb') returning id`,
    [esc.org, NOMBRE_DE_PERSONA, `sincro-${randomUUID().slice(0, 8)}@alfa.ejemplo`],
  );
  const id = r.rows[0]?.id;
  assert.ok(id, 'no se pudo sembrar la persona');
  if (rol) {
    await esc.admin.query(
      `insert into identidad.usuarios_roles (usuario_id, rol_id)
         select $1, id from identidad.roles where clave = $2 and org_id is null`,
      [id, rol],
    );
  }
  for (const s of secciones) {
    await esc.admin.query(
      'insert into identidad.usuarios_secciones (usuario_id, seccion) values ($1, $2)',
      [id, s],
    );
  }
  return { id, token: await sesionDe(id) };
}

/** Borra SÓLO las personas de este archivo. Nunca las tres del sembrado. */
async function limpiarPersonas(): Promise<void> {
  await esc.admin.query('delete from identidad.usuarios where nombre = $1', [NOMBRE_DE_PERSONA]);
}

before(async () => {
  esc = await montar('Sincro');
  await limpiarPersonas();
  globalThis.fetch = (async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    const p: PeticionSaliente = {
      url: typeof entrada === 'string' ? entrada : String((entrada as Request).url ?? entrada),
      metodo: opciones?.method ?? 'GET',
      cuerpo:
        typeof opciones?.body === 'string'
          ? (JSON.parse(opciones.body) as PeticionSaliente['cuerpo'])
          : undefined,
    };
    salientes.push(p);
    const r = contestar(p);
    return new Response(JSON.stringify(r.cuerpo), {
      status: r.estado,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof globalThis.fetch;
});

after(async () => {
  await limpiarPersonas();
  await limpiar(esc);
  await cerrarTodo();
  await cerrarClientes();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · EL TERRITORIO: LA DECISIÓN QUE NINGÚN GUARDIA PUEDE VER
// ═══════════════════════════════════════════════════════════════════════════════

test('con LAS DOS etiquetas gana el closer, y una sola fila queda escrita', async () => {
  const id = idDeGhl();
  // El caso real que el encabezado del módulo describe: el workflow WF 04.1 suma `zona_closer` al
  // agendar y puede no sacar `zona_setter`. El proveedor filtra por `eq`, así que el MISMO contacto
  // vuelve en las dos búsquedas — que es justo lo que hay que resolver acá y no en GoHighLevel.
  const conLasDos: ContactoDeGhl = {
    id,
    contactName: 'Sincro Dos Etiquetas',
    tags: ['zona_setter', 'zona_closer'],
  };
  preparar(porEtiqueta({ zona_closer: [conLasDos], zona_setter: [conLasDos] }));

  const r = await conOrganizacion(esc.org, async () => sincronizarContactos(ACCESO));
  assert.equal(r.tipo, 'listo');
  if (r.tipo !== 'listo') return;

  // Si la precedencia se invirtiera —o si desapareciera el `vistos` que la sostiene— este contacto
  // se guardaría dos veces y la SEGUNDA escritura ganaría: quedaría en la bandeja del setter un
  // lead que ya está en la agenda del closer, y dos personas lo trabajarían sin saberlo.
  assert.equal(r.resumen.guardados.closer, 1);
  assert.equal(r.resumen.guardados.setter, 0);

  const fila = await filaDe(esc.org, id);
  assert.equal(fila?.territorio, 'closer');
  // Las etiquetas se guardan COMPLETAS, las dos: son lo único con que se contesta «por qué éste
  // cayó acá». Guardar sólo la que ganó dejaría la pregunta sin respuesta posible.
  assert.deepEqual([...(fila?.etiquetas ?? [])].sort(), ['zona_closer', 'zona_setter']);

  // `traidos` cuenta lo que VINO, no lo que se guardó, y las dos etiquetas informan 1. Contando
  // sólo lo guardado, un contacto duplicado entre etiquetas se leería como «la etiqueta del setter
  // está vacía» — un cero inventado sobre un dato que sí se midió.
  assert.equal(r.resumen.traidos['zona_closer'], 1);
  assert.equal(r.resumen.traidos['zona_setter'], 1);
  assert.deepEqual(r.resumen.salteados, []);
});

test('el orden de ETIQUETAS ES la precedencia, y está declarado', () => {
  // La precedencia no vive en un `if`: vive en el orden de esta lista, y `refrescarUnContacto` la
  // relee de acá en vez de escribir su propia comparación. Fijarla es lo que impide que alguien
  // reordene la lista por prolijidad alfabética y mueva todos los leads agendados al setter.
  assert.deepEqual(
    ETIQUETAS.map((e) => [e.etiqueta, e.territorio]),
    [
      ['zona_closer', 'closer'],
      ['zona_setter', 'setter'],
    ],
  );
});

test('sin ninguna etiqueta de territorio el contacto queda CONGELADO, no borrado', async () => {
  const sembrado = await unContacto(esc, { nombre: 'Sincro Congelado' });
  // Lo que el `01` § 2 define: perdió las dos etiquetas. NO es «no existe» y NO es «del setter».
  preparar((p) => {
    if (p.url.startsWith(`${GHL}/contacts/`) && p.metodo === 'GET') {
      return { estado: 200, cuerpo: { contact: { id: sembrado.ghlId, contactName: 'Sincro Congelado', tags: ['cliente'] } } };
    }
    return { estado: 200, cuerpo: {} };
  });

  const r = await conOrganizacion(esc.org, async () => refrescarUnContacto(ACCESO, sembrado.ghlId));
  assert.deepEqual(r, { tipo: 'listo', territorio: null });

  const fila = await filaDe(esc.org, sembrado.ghlId);
  // Sigue estando. Si el congelado se hubiera implementado como un borrado, se irían en cascada sus
  // mensajes, sus notas y sus resultados — el historial de un trabajo que sí ocurrió.
  assert.ok(fila, 'el contacto congelado desapareció de la base');
  assert.equal(fila.territorio, null);
});

test('refrescar recalcula el territorio y NO pisa `etapa` ni `score`', async () => {
  // Datos NUESTROS, no de GoHighLevel: el proveedor no expone etapa ni score y nada allá los
  // calcula. Si entraran al `do update`, cada apertura de ficha borraría el trabajo hecho acá.
  const sembrado = await unContacto(esc, {
    nombre: 'Sincro Antes',
    territorio: 'setter',
    etapa: 'agendado',
    score: 'A',
  });
  preparar((p) => {
    if (p.url.startsWith(`${GHL}/contacts/`) && p.metodo === 'GET') {
      return {
        estado: 200,
        cuerpo: {
          contact: {
            id: sembrado.ghlId,
            contactName: 'Sincro Después',
            phone: '+51999111222',
            email: 'sincro@ejemplo.test',
            tags: ['zona_closer'],
          },
        },
      };
    }
    return { estado: 200, cuerpo: {} };
  });

  const r = await conOrganizacion(esc.org, async () => refrescarUnContacto(ACCESO, sembrado.ghlId));
  // El mismo contacto cambiando de dueño: agendó, así que pasa del setter al closer.
  assert.deepEqual(r, { tipo: 'listo', territorio: 'closer' });

  const fila = await filaDe(esc.org, sembrado.ghlId);
  assert.equal(fila?.territorio, 'closer');
  // Lo que el CRM manda sí se actualiza.
  assert.equal(fila?.nombre, 'Sincro Después');
  assert.equal(fila?.telefono, '+51999111222');
  // Lo nuestro NO se toca. Con `etapa` o `score` en el `do update`, esto quedaría en nulo y la fila
  // volvería al principio del pipeline sin que nada fallara.
  assert.equal(fila?.etapa, 'agendado');
  assert.equal(fila?.score, 'A');
});

test('un contacto borrado en el CRM no se borra acá: es un hecho, no un fallo', async () => {
  const sembrado = await unContacto(esc, { nombre: 'Sincro Borrado En El CRM', etapa: 'venta' });
  preparar((p) => {
    if (p.url.startsWith(`${GHL}/contacts/`) && p.metodo === 'GET') {
      return { estado: 404, cuerpo: { message: 'not found' } };
    }
    return { estado: 200, cuerpo: {} };
  });

  const r = await conOrganizacion(esc.org, async () => refrescarUnContacto(ACCESO, sembrado.ghlId));
  // `no_esta_en_el_crm` y NO `fallo`: la ficha tiene que poder decir «lo borraron allá» en vez de
  // «no se pudo consultar», que manda a revisar la conexión.
  assert.deepEqual(r, { tipo: 'no_esta_en_el_crm' });

  const fila = await filaDe(esc.org, sembrado.ghlId);
  assert.ok(fila, 'un 404 del CRM borró la fila y con ella el historial');
  assert.equal(fila.etapa, 'venta');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · LO QUE NO SE GUARDA SE DICE, Y CON MOTIVO
// ═══════════════════════════════════════════════════════════════════════════════

test('un contacto sin nombre se saltea CON MOTIVO y no entra como «Sin nombre»', async () => {
  const bueno = idDeGhl();
  const mudo = idDeGhl();
  preparar(
    porEtiqueta({
      zona_closer: [
        { id: bueno, contactName: 'Sincro Con Nombre', tags: ['zona_closer'] },
        // Ni `contactName`, ni `name`, ni `firstName`, ni las variantes en minúscula.
        { id: mudo, phone: '+51900000000', tags: ['zona_closer'] },
      ],
    }),
  );

  const r = await conOrganizacion(esc.org, async () => sincronizarContactos(ACCESO));
  assert.equal(r.tipo, 'listo');
  if (r.tipo !== 'listo') return;

  assert.equal(r.resumen.guardados.closer, 1);
  // Uno por uno, con el identificador y el motivo. Un salteo silencioso deja la lista corta y con
  // aspecto de completa: el reporte que llega es «faltan contactos» y no hay nada que mirar.
  assert.equal(r.resumen.salteados.length, 1);
  assert.equal(r.resumen.salteados[0]?.id, mudo);
  assert.match(r.resumen.salteados[0]?.porque ?? '', /nombre/);

  // Y no entró con una etiqueta inventada. Si `guardar` cayera a `'Sin nombre'`, existiría una fila
  // cuyo nombre no es el nombre de nadie, y la lista del closer la mostraría como un dato.
  assert.equal(await filaDe(esc.org, mudo), undefined);
  assert.equal((await filaDe(esc.org, bueno))?.nombre, 'Sincro Con Nombre');
});

// ═══════════════════════════════════════════════════════════════════════════════
// LA CONCILIACIÓN: LO QUE **YA NO** VINO
//
// La búsqueda es por etiqueta, así que un contacto que PIERDE las dos zonas deja de aparecer en
// cualquier respuesta y nadie vuelve a leerlo. Su fila se quedaba con el territorio viejo para
// siempre, y el estado «congelado» que el módulo describe no se alcanzaba nunca.
//
// Medido en producción el 2026-09-01: 157 contactos con `territorio = 'closer'` en nuestra base
// contra 152 con la etiqueta en GoHighLevel. Cinco leads en el Pipeline de un closer que el CRM ya
// había sacado de su zona.
//
// Lo que se afirma acá son las DOS mitades, y la segunda importa más:
//
//   · que congele cuando corresponde, sin una llamada más;
//   · que **NO congele** cuando la traída no fue completa. Sin esas guardas, esta función deja a la
//     empresa entera sin territorios y sin un solo error: la lista de trabajo de todos, vacía.
// ═══════════════════════════════════════════════════════════════════════════════

test('el que PIERDE las dos etiquetas queda congelado en la sincronización, sin llamadas de más', async () => {
  /* El caso de producción, montado: un contacto que estaba en el territorio del closer y que la
     búsqueda ya no devuelve. Antes se quedaba con `territorio = 'closer'` para siempre. */
  /* La base limpia ANTES de sembrar: la resta mira TODA la organización, así que los contactos
     que dejaron las pruebas de arriba también se congelan —correctamente— y la cuenta exacta
     dejaría de medir lo que dice. */
  await limpiar(esc);
  const salido = await unContacto(esc, { nombre: 'Sincro Salido', territorio: 'closer' });
  const sigue = idDeGhl();

  preparar(porEtiqueta({
    zona_closer: [{ id: sigue, contactName: 'Sincro Sigue', tags: ['zona_closer'] }],
    zona_setter: [],
  }));

  const r = await conOrganizacion(esc.org, async () => sincronizarContactos(ACCESO));
  assert.equal(r.tipo, 'listo');
  if (r.tipo !== 'listo') return;

  assert.equal(r.resumen.congelados, 1, 'el que perdió las etiquetas no se congeló');

  const fila = await filaDe(esc.org, salido.ghlId);
  assert.ok(fila, 'el contacto congelado desapareció de la base');
  assert.equal(fila.territorio, null, 'sigue con el territorio viejo');

  // Y el que SÍ vino no se tocó. Sin esta mitad, un `not in` mal escrito congelaría a todos y la
  // afirmación de arriba pasaría igual.
  assert.equal((await filaDe(esc.org, sigue))?.territorio, 'closer');

  /* ── CERO LLAMADAS MÁS, QUE ERA LA CONDICIÓN ────────────────────────────
   *
   * Se pidió así: *«no haciendo más llamadas sino aprovechando las que ya hacemos»*. La
   * conciliación es un `update` sobre nuestra base y no toca GoHighLevel, así que el costo tiene
   * que ser exactamente el de las dos búsquedas: una página por etiqueta.
   *
   * Se cuentan las peticiones REALES al proveedor, no el contador del resumen: el contador es lo
   * que este archivo también podría equivocarse. */
  const aGhl = llamadasAGhl().filter((p) => p.url.startsWith(`${GHL}/contacts/search`));
  assert.equal(aGhl.length, 2, 'la conciliación agregó llamadas a GoHighLevel');
});

test('con la traída TRUNCADA no se congela nada, y se dice que no se pudo', async () => {
  /* ══════════════════════════════════════════════════════════════════════════
     LA GUARDA QUE EVITA EL DESASTRE

     La conciliación afirma *«todo lo que no vino, ya no está»*, y eso es cierto SOLO si la traída
     fue completa. Con la lista cortada por el tope de páginas, los que no entraron se ven
     exactamente igual que los que perdieron la etiqueta — y congelarlos deja a la empresa sin
     territorios, sin un solo error en ninguna parte.

     Se devuelve `null` y no `0`: un cero afirmaría que se miró y no había ninguno.
     ══════════════════════════════════════════════════════════════════════════ */
  /* La base limpia ANTES de sembrar: la resta mira TODA la organización, así que los contactos
     que dejaron las pruebas de arriba también se congelan —correctamente— y la cuenta exacta
     dejaría de medir lo que dice. */
  await limpiar(esc);
  const salido = await unContacto(esc, { nombre: 'Sincro No Congelar', territorio: 'closer' });
  const unico = idDeGhl();
  const cien = Array.from({ length: 100 }, () => ({
    id: unico,
    contactName: 'Sincro Lleno',
    tags: ['zona_closer'],
  }));
  preparar((p) => {
    if (p.url.startsWith(`${GHL}/contacts/search`)) {
      return pagina(etiquetaPedida(p) === 'zona_closer' ? cien : []);
    }
    return { estado: 200, cuerpo: { tags: [] } };
  });

  const r = await conOrganizacion(esc.org, async () => sincronizarContactos(ACCESO));
  assert.equal(r.tipo, 'listo');
  if (r.tipo !== 'listo') return;

  assert.equal(r.resumen.truncado, true);
  assert.equal(r.resumen.congelados, null, 'se concilió sobre una lista incompleta');
  assert.equal(
    (await filaDe(esc.org, salido.ghlId))?.territorio,
    'closer',
    'una traída truncada congeló un contacto que sí puede tener la etiqueta',
  );
});

test('sin NINGÚN contacto no se congela nada: el conjunto vacío no significa «no hay»', async () => {
  /* La otra guarda, y el peor caso de los dos. `vistos` vacío no significa «esta empresa no tiene
     contactos»: es también lo que devuelve una etiqueta mal escrita, un token recién rotado o una
     subcuenta que todavía no cargó nada. Restar contra el conjunto vacío congela TODO.

     Es el mismo cero indistinguible que este archivo persigue en otras cuatro formas, con la
     diferencia de que acá el cero no se muestra: se ejecuta. */
  /* La base limpia ANTES de sembrar: la resta mira TODA la organización, así que los contactos
     que dejaron las pruebas de arriba también se congelan —correctamente— y la cuenta exacta
     dejaría de medir lo que dice. */
  await limpiar(esc);
  const salido = await unContacto(esc, { nombre: 'Sincro Vacio', territorio: 'closer' });
  preparar(porEtiqueta({ zona_closer: [], zona_setter: [] }));

  const r = await conOrganizacion(esc.org, async () => sincronizarContactos(ACCESO));
  assert.equal(r.tipo, 'listo');
  if (r.tipo !== 'listo') return;

  assert.equal(r.resumen.congelados, null, 'se concilió contra un conjunto vacío');
  assert.equal(
    (await filaDe(esc.org, salido.ghlId))?.territorio,
    'closer',
    'una respuesta vacía congeló la cartera entera',
  );
});

test('congelar toca SOLO el territorio, y la segunda corrida no vuelve a contarlos', async () => {
  /* Dos afirmaciones que se rompen distinto:

     · Las etiquetas y el asignado del CRM se conservan. Las etiquetas son la última foto real que
       tuvimos y son lo único con que se contesta «por qué éste cayó acá»; borrarlas al congelar
       dejaría la pregunta sin respuesta posible.
     · Sin el `where territorio is not null`, cada corrida reescribiría las filas ya congeladas: el
       mismo resultado en la base, y un contador que dice «congelé uno» todas las veces. La pantalla
       avisaría de una salida que ocurrió hace semanas. */
  /* La base limpia ANTES de sembrar: la resta mira TODA la organización, así que los contactos
     que dejaron las pruebas de arriba también se congelan —correctamente— y la cuenta exacta
     dejaría de medir lo que dice. */
  await limpiar(esc);
  const salido = await unContacto(esc, {
    nombre: 'Sincro Solo Territorio',
    territorio: 'closer',
    etiquetas: ['zona_closer', 'cliente'],
    crmAsignadoA: 'usuarioDelCrmQueSeQueda',
  });
  const sigue = idDeGhl();
  preparar(porEtiqueta({
    zona_closer: [{ id: sigue, contactName: 'Sincro Otro', tags: ['zona_closer'] }],
    zona_setter: [],
  }));

  const primera = await conOrganizacion(esc.org, async () => sincronizarContactos(ACCESO));
  assert.equal(primera.tipo, 'listo');
  if (primera.tipo !== 'listo') return;
  assert.equal(primera.resumen.congelados, 1);

  const fila = await filaDe(esc.org, salido.ghlId);
  assert.equal(fila?.territorio, null);
  assert.deepEqual([...(fila?.etiquetas ?? [])].sort(), ['cliente', 'zona_closer']);
  assert.equal(fila?.crm_asignado_a, 'usuarioDelCrmQueSeQueda');

  const segunda = await conOrganizacion(esc.org, async () => sincronizarContactos(ACCESO));
  assert.equal(segunda.tipo, 'listo');
  if (segunda.tipo !== 'listo') return;
  assert.equal(segunda.resumen.congelados, 0, 'la segunda corrida volvió a contar al mismo');
});

test('el que vuelve a ganar la etiqueta se DESCONGELA solo', async () => {
  /* La otra mitad de «congelar y no borrar»: el módulo afirma que *«se descongela solo si una
     etiqueta de territorio reaparece»*, y eso no necesita código nuevo — la búsqueda lo devuelve y
     `guardar` le repone el territorio. Se comprueba igual, porque es la afirmación que hace que
     congelar sea reversible y no una pérdida. */
  /* La base limpia ANTES de sembrar: la resta mira TODA la organización, así que los contactos
     que dejaron las pruebas de arriba también se congelan —correctamente— y la cuenta exacta
     dejaría de medir lo que dice. */
  await limpiar(esc);
  const vuelve = await unContacto(esc, { nombre: 'Sincro Vuelve', territorio: null });
  preparar(porEtiqueta({
    zona_closer: [{ id: vuelve.ghlId, contactName: 'Sincro Vuelve', tags: ['zona_closer'] }],
    zona_setter: [],
  }));

  const r = await conOrganizacion(esc.org, async () => sincronizarContactos(ACCESO));
  assert.equal(r.tipo, 'listo');
  if (r.tipo !== 'listo') return;

  assert.equal((await filaDe(esc.org, vuelve.ghlId))?.territorio, 'closer');
  assert.equal(r.resumen.congelados, 0);
});

test('el tope de páginas se INFORMA en vez de devolver lo traído como si fuera todo', async () => {
  // `todosLosContactosPorEtiqueta` corta en 100 páginas porque la paginación por `page` no puede
  // pasar de 10.000 registros. El doble devuelve páginas LLENAS para siempre, que es exactamente
  // la forma que tiene una etiqueta con más contactos de los que se pueden pedir.
  //
  // Los cien de cada página son el MISMO contacto a propósito: así se mide el aviso de truncado sin
  // escribir diez mil filas, y de paso se comprueba que `vistos` deduplica dentro de una etiqueta y
  // no sólo entre las dos.
  const unico = idDeGhl();
  const cien = Array.from({ length: 100 }, () => ({
    id: unico,
    contactName: 'Sincro Truncado',
    tags: ['zona_closer'],
  }));
  preparar((p) => {
    if (p.url.startsWith(`${GHL}/contacts/search`)) {
      return pagina(etiquetaPedida(p) === 'zona_closer' ? cien : []);
    }
    return { estado: 200, cuerpo: { tags: [] } };
  });

  const r = await conOrganizacion(esc.org, async () => sincronizarContactos(ACCESO));
  assert.equal(r.tipo, 'listo');
  if (r.tipo !== 'listo') return;

  // Sin este `true`, una sincronización cortada a la mitad se ve idéntica a una completa y el
  // síntoma que llega es «faltan contactos», que se diagnostica como un problema de etiquetas.
  assert.equal(r.resumen.truncado, true);
  assert.equal(r.resumen.traidos['zona_closer'], 10_000);
  assert.equal(r.resumen.guardados.closer, 1);
});

test('el catálogo de etiquetas se pregunta SÓLO cuando no vino ningún contacto', async () => {
  // Cuando no vino nada, la pregunta siguiente siempre es la misma: ¿estarán mal los nombres de las
  // etiquetas? Se contesta antes de que alguien la haga.
  preparar((p) => {
    if (p.url.startsWith(`${GHL}/contacts/search`)) return pagina([]);
    return { estado: 200, cuerpo: { tags: [{ name: 'Zona Closer' }, { name: 'cliente' }] } };
  });

  const vacia = await conOrganizacion(esc.org, async () => sincronizarContactos(ACCESO));
  assert.equal(vacia.tipo, 'listo');
  if (vacia.tipo !== 'listo') return;
  // El diagnóstico completo: «busqué `zona_closer` y tu cuenta tiene `Zona Closer`».
  assert.deepEqual(vacia.resumen.etiquetasDeLaCuenta, ['Zona Closer', 'cliente']);
  assert.equal(llamadasAGhl().filter((p) => /\/tags$/.test(p.url)).length, 1);

  // Y cuando SÍ vinieron contactos, el catálogo no aporta nada: preguntarlo sería una llamada más
  // contra un límite de tasa ajeno en cada sincronización de una cuenta que funciona.
  const id = idDeGhl();
  preparar(porEtiqueta({ zona_closer: [{ id, contactName: 'Sincro Hubo', tags: ['zona_closer'] }] }));
  const conDatos = await conOrganizacion(esc.org, async () => sincronizarContactos(ACCESO));
  assert.equal(conDatos.tipo, 'listo');
  if (conDatos.tipo !== 'listo') return;
  // `null` = **no se preguntó**. No es `[]`, que afirmaría que la subcuenta no tiene etiquetas.
  assert.equal(conDatos.resumen.etiquetasDeLaCuenta, null);
  assert.deepEqual(llamadasAGhl().filter((p) => /\/tags$/.test(p.url)), []);
});

test('un token sin permiso de leer etiquetas devuelve `null`, y `null` no es «no tiene ninguna»', async () => {
  // Leer etiquetas necesita `locations/tags.readonly`, que es un alcance DISTINTO del que usa la
  // búsqueda. Un token que trae contactos puede no servir para esto.
  preparar((p) => {
    if (p.url.startsWith(`${GHL}/contacts/search`)) return pagina([]);
    return { estado: 401, cuerpo: { message: 'no autorizado' } };
  });

  const r = await conOrganizacion(esc.org, async () => sincronizarContactos(ACCESO));
  assert.equal(r.tipo, 'listo');
  if (r.tipo !== 'listo') return;
  // Con `[]` acá, la pantalla diría «tu subcuenta no tiene ninguna etiqueta» de una cuenta que las
  // tiene todas, y mandaría a crear etiquetas en vez de a revisar el alcance del token.
  assert.equal(r.resumen.etiquetasDeLaCuenta, null);
  // Y el fallo del catálogo NO rompe la sincronización: es informativo.
  assert.equal(r.resumen.truncado, false);
  assert.deepEqual(r.resumen.salteados, []);
});

test('ADR-0305 · un token rechazado es un FALLO, no una sincronización de cero contactos', async () => {
  preparar(() => ({ estado: 401, cuerpo: { message: 'token invalido' } }));

  const r = await conOrganizacion(esc.org, async () => sincronizarContactos(ACCESO));
  // La rama que este proyecto ya pagó una vez: si el fallo se devolviera como un resumen vacío,
  // quien aprieta el botón vería «0 contactos» y creería que su cuenta está vacía. Nadie reporta un
  // defecto de algo que «simplemente no tiene datos».
  assert.equal(r.tipo, 'fallo');
  if (r.tipo !== 'fallo') return;
  assert.equal(r.fallo.tipo, 'no_autorizado');
  // Y se corta en la PRIMERA etiqueta: no se sigue preguntando con un token que ya se sabe malo.
  assert.equal(llamadasAGhl().length, 1);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · EL AISLAMIENTO, QUE ES LA PROPIEDAD QUE EL MÓDULO AFIRMA DE SÍ MISMO
// ═══════════════════════════════════════════════════════════════════════════════

test('sincronizar escribe SÓLO en la organización del contexto', async () => {
  const id = idDeGhl();
  preparar(porEtiqueta({ zona_closer: [{ id, contactName: 'Sincro De Beta', tags: ['zona_closer'] }] }));

  // El módulo no recibe `orgId` y no nombra `org_id` ni una vez: lo inyecta la capa fina y la
  // política de fila hace el resto. Ésa es la afirmación, y sólo se puede comprobar ejecutándola.
  const r = await conOrganizacion(esc.otraOrg, async () => sincronizarContactos(ACCESO));
  assert.equal(r.tipo, 'listo');

  assert.ok(await filaDe(esc.otraOrg, id), 'el contacto no quedó en la organización del contexto');
  // Y desde la otra no existe. Un `org_id` escrito a mano en este módulo —o una política de fila
  // que no cubriera el `insert`— dejaría la fila visible desde las dos, y eso no lanza: la consulta
  // anda, devuelve filas, y son de otro cliente.
  assert.equal(await filaDe(esc.org, id), undefined);
});

test('el mismo identificador del CRM en dos organizaciones son dos contactos, y no chocan', async () => {
  // El único es `(org_id, ghl_contact_id)` y no `ghl_contact_id` a secas. Con un único global, el
  // `insert` de una organización chocaría con la fila INVISIBLE de otra y devolvería `23505` — un
  // error que además confirma que ese contacto existe en otro cliente.
  const id = idDeGhl();
  preparar(porEtiqueta({ zona_closer: [{ id, contactName: 'Sincro Compartido', tags: ['zona_closer'] }] }));

  const enAlfa = await conOrganizacion(esc.org, async () => sincronizarContactos(ACCESO));
  const enBeta = await conOrganizacion(esc.otraOrg, async () => sincronizarContactos(ACCESO));
  assert.equal(enAlfa.tipo, 'listo');
  assert.equal(enBeta.tipo, 'listo');
  if (enAlfa.tipo !== 'listo' || enBeta.tipo !== 'listo') return;
  assert.equal(enAlfa.resumen.guardados.closer, 1);
  assert.equal(enBeta.resumen.guardados.closer, 1);

  assert.ok(await filaDe(esc.org, id));
  assert.ok(await filaDe(esc.otraOrg, id));
});

test('traer de nuevo es idempotente: la segunda vez actualiza, no duplica ni falla', async () => {
  const id = idDeGhl();
  preparar(porEtiqueta({ zona_closer: [{ id, contactName: 'Sincro Primera', tags: ['zona_closer'] }] }));
  await conOrganizacion(esc.org, async () => sincronizarContactos(ACCESO));

  preparar(
    porEtiqueta({
      zona_closer: [{ id, contactName: 'Sincro Segunda', email: 'nuevo@ejemplo.test', tags: ['zona_closer'] }],
    }),
  );
  const r = await conOrganizacion(esc.org, async () => sincronizarContactos(ACCESO));
  assert.equal(r.tipo, 'listo');

  const cuantas = await conOrganizacion(esc.org, async () =>
    datos()
      .selectFrom('contactos')
      .select(datos().fn.countAll<string>().as('n'))
      .where('ghl_contact_id', '=', id)
      .executeTakeFirstOrThrow(),
  );
  // Sin el `on conflict` por las DOS columnas, esto sería un `23505` o una fila duplicada — y la
  // duplicada es peor: la lista muestra el mismo lead dos veces y nada falla.
  assert.equal(Number(cuantas.n), 1);
  const fila = await filaDe(esc.org, id);
  assert.equal(fila?.nombre, 'Sincro Segunda');
  assert.equal(fila?.email, 'nuevo@ejemplo.test');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · EL CONTRATO DE `POST /api/contactos/sincronizar`
// ═══════════════════════════════════════════════════════════════════════════════

test('sin credenciales del CRM la ruta rechaza 409 con el motivo exacto, y NO da 500', async () => {
  preparar(porEtiqueta({}));
  const r = await sincronizarRuta(
    pedirComo('/api/contactos/sincronizar', esc.token, { metodo: 'POST' }),
  );
  const { estado, cuerpo } = await leerRespuesta<{ codigo: string; detalle: string }>(r);

  // 409 y no 403: quien la recibe TIENE el permiso. Lo que falta es una configuración de la
  // organización, y un 403 lo mandaría a pedirle un permiso a alguien que no se lo puede dar.
  assert.equal(estado, 409);
  assert.equal(cuerpo.codigo, 'credenciales_incompletas');
  // El texto es el de `sin_token` y no un «no se pudo conectar» genérico: `ADR-0604` pide que la
  // organización que no opera DIGA por qué, y los cinco faltantes llevan a cinco acciones distintas.
  assert.equal(cuerpo.detalle, TEXTO_DE_FALTA_GHL['sin_token']);
  // Y no se salió a la red con un token que no existe.
  assert.deepEqual(llamadasAGhl(), []);
});

test('la ruta pide `contactos.ver`: sin esa capacidad es 403 `sin_permiso`, no una respuesta vacía', async () => {
  // Una persona sin ningún rol: cero capacidades. Es el caso que el Paso 5 del portero existe para
  // cortar, y el guardia de arquitectura no lo puede ver — lee que el archivo dice `exigir(` y
  // acepta cualquier lista de capacidades adentro.
  const nadie = await unaPersona(null);
  preparar(porEtiqueta({}));
  const r = await sincronizarRuta(
    pedirComo('/api/contactos/sincronizar', nadie.token, { metodo: 'POST' }),
  );
  const { estado, cuerpo } = await leerRespuesta<{ codigo: string; sincronizado?: boolean }>(r);

  assert.equal(estado, 403);
  assert.equal(cuerpo.codigo, 'sin_permiso');
  // `ADR-0305`: el rechazo NO viaja como un éxito de cero contactos. Con `sincronizado: true` acá,
  // la pantalla diría «listo» sobre una operación que nunca ocurrió.
  assert.equal(cuerpo.sincronizado, undefined);
  assert.deepEqual(llamadasAGhl(), []);
});

test('`SIN_SECCION` es una decisión: una persona restringida sin ninguna sección SÍ puede traer', async () => {
  // La ruta la llaman LAS DOS pestañas, así que no puede declarar `closer` ni `setter` sin mentir
  // sobre una de las dos. Ésta es la consecuencia comprobable de esa decisión: el Paso 6 del portero
  // no se aplica, y quien tiene la capacidad pasa aunque no tenga concedida ninguna pestaña.
  const restringida = await unaPersona('usuario');
  preparar(porEtiqueta({}));
  const r = await sincronizarRuta(
    pedirComo('/api/contactos/sincronizar', restringida.token, { metodo: 'POST' }),
  );
  const { estado, cuerpo } = await leerRespuesta<{ codigo: string }>(r);

  // Llegó hasta las credenciales: o sea, atravesó los seis pasos. Declarando una pantalla, esto
  // sería `403 seccion_no_concedida` y la pestaña del setter no podría traer sus propios contactos.
  assert.equal(estado, 409);
  assert.equal(cuerpo.codigo, 'credenciales_incompletas');
});

test('ADR-0306 · sin `origin` la ruta rechaza ANTES de tocar la base y la red', async () => {
  preparar(porEtiqueta({}));
  // Igual que la petición buena, menos el `origin`. Es la forma que tiene una petición falsificada
  // desde otro sitio, y `SameSite=Lax` no alcanza: es una defensa del navegador.
  const sinOrigen = new Request(`https://${DOMINIO}/api/contactos/sincronizar`, {
    method: 'POST',
    headers: { cookie: `${COOKIE_SESION}=${esc.token}` },
  });
  const { estado, cuerpo } = await leerRespuesta<{ codigo: string }>(await sincronizarRuta(sinOrigen));

  assert.equal(estado, 403);
  assert.equal(cuerpo.codigo, 'origen_no_permitido');
  assert.deepEqual(llamadasAGhl(), []);
});

test('sin sesión la ruta responde 401 `sin_sesion`, distinto de los cinco 403', async () => {
  preparar(porEtiqueta({}));
  const sinCookie = new Request(`https://${DOMINIO}/api/contactos/sincronizar`, {
    method: 'POST',
    headers: { origin: `https://${DOMINIO}` },
  });
  const { estado, cuerpo } = await leerRespuesta<{ codigo: string }>(await sincronizarRuta(sinCookie));

  // `hayQueVolverAEntrar()` del cliente HTTP mira el CÓDIGO, no el estado: con cualquier otro acá,
  // una sesión vencida dejaría la pantalla como si nada en vez de mandar al login.
  assert.equal(estado, 401);
  assert.equal(cuerpo.codigo, 'sin_sesion');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · `POST /api/closer/agenda/refrescar` — Y DÓNDE QUEDA EL CANDADO DEL PULSO
// ═══════════════════════════════════════════════════════════════════════════════

test('el barrido de la agenda resuelve credenciales ANTES del candado del pulso', async () => {
  preparar(porEtiqueta({}));
  const r = await refrescarAgendaRuta(
    pedirComo('/api/closer/agenda/refrescar', esc.token, { metodo: 'POST' }),
  );
  const { estado, cuerpo } = await leerRespuesta<{ codigo: string; detalle: string }>(r);

  assert.equal(estado, 409);
  assert.equal(cuerpo.codigo, 'credenciales_incompletas');
  assert.equal(cuerpo.detalle, TEXTO_DE_FALTA_GHL['sin_token']);

  // Ésta es la parte que importa, y es el motivo por el que el candado del pulso NO se puede probar
  // por el camino de esta ruta: `barrerCitas` —que es quien abre `conElPulso`— nunca se llama, así
  // que no hay reclamo, no se estampa `ultima_corrida_el`, y `corrio: false` es inalcanzable desde
  // acá sin cargar un token cifrado válido en `identidad.organizaciones_credenciales`.
  //
  // Haría falta eso: una credencial de verdad para esta organización. Y no se hace en este archivo
  // porque `60-credenciales.test.ts` vacía esa tabla SIN FILTRO en su `before` y en su `after`, así
  // que la fila desaparecería a mitad de camino y la prueba fallaría sola y pasaría aislada. El
  // candado ya está cubierto donde corresponde: `25-ingesta.test.ts` lo provoca de verdad
  // sosteniendo un `for update` sobre `negocio.ingesta_pulso` desde otro cliente.
  assert.deepEqual(llamadasAGhl(), []);
});

test('el barrido SÍ declara pantalla: la misma persona que puede traer no puede barrer', async () => {
  // El contraste con la prueba de `SIN_SECCION`: misma persona, mismas capacidades, dos rutas, dos
  // respuestas. Es lo que convierte «esta ruta no declara pantalla» en una decisión medida en vez de
  // un descuido, y lo que fallaría si alguien le pusiera `SIN_SECCION` a esta otra por simetría.
  const restringida = await unaPersona('usuario');
  preparar(porEtiqueta({}));

  const traer = await sincronizarRuta(
    pedirComo('/api/contactos/sincronizar', restringida.token, { metodo: 'POST' }),
  );
  const barrer = await refrescarAgendaRuta(
    pedirComo('/api/closer/agenda/refrescar', restringida.token, { metodo: 'POST' }),
  );

  assert.equal((await leerRespuesta<{ codigo: string }>(traer)).cuerpo.codigo, 'credenciales_incompletas');
  const rB = await leerRespuesta<{ codigo: string }>(barrer);
  assert.equal(rB.estado, 403);
  // Código PROPIO y no `sin_permiso`: significa «tu rol la tiene y a vos no te dieron esta pestaña»,
  // y se arregla en la ficha de esa persona y no en el catálogo de roles.
  assert.equal(rB.cuerpo.codigo, 'seccion_no_concedida');

  // La comprobación de entrada muerta: con la sección `closer` concedida, la MISMA persona con el
  // MISMO rol atraviesa el Paso 6 y llega a las credenciales. Sin esto, el 403 de arriba pasaría
  // igual si el rechazo viniera de otra parte —una capacidad que falta, un estado de sesión— y la
  // prueba mediría cualquier cosa menos el alcance por sección.
  const conPestaña = await unaPersona('usuario', ['closer']);
  const barrerOk = await refrescarAgendaRuta(
    pedirComo('/api/closer/agenda/refrescar', conPestaña.token, { metodo: 'POST' }),
  );
  const rC = await leerRespuesta<{ codigo: string }>(barrerOk);
  assert.equal(rC.estado, 409);
  assert.equal(rC.cuerpo.codigo, 'credenciales_incompletas');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6 · `lib/negocio/zonas.ts` — QUÉ ZONA SE PUEDE GUARDAR
// ═══════════════════════════════════════════════════════════════════════════════

test('el catálogo entero es válido: un error de tipeo acá es una pantalla que lanza', () => {
  // La segunda mitad de `esZonaValida` valida contra `Intl` y no contra el catálogo, y hace falta
  // porque el catálogo lo escribe una persona. Esta prueba es la que ejercita esa mitad: si alguien
  // agrega `America/Lima_Peru` de más, se ve acá y no en la Agenda de un cliente.
  assert.ok(ZONAS.length > 0, 'el catálogo quedó vacío');
  for (const z of ZONAS) {
    assert.equal(esZonaValida(z.valor), true, `el catálogo trae una zona que Intl no conoce: ${z.valor}`);
    assert.ok(z.nombre.trim().length > 0, `la zona ${z.valor} no tiene nombre para mostrar`);
  }
});

test('los cuatro que una persona escribiría a mano se rechazan, y también las no-cadenas', () => {
  // Los cuatro que el encabezado del módulo nombra, y ninguno de los cuatro funciona: `Intl` lanza
  // con una zona que no conoce, y PostgreSQL con `timezone('Perú', now())` también. Un campo de
  // texto libre los aceptaría y el error saldría al dibujar una hora, no al guardar.
  for (const malo of ['Lima', 'GMT-5', 'America/lima', 'Perú']) {
    assert.equal(esZonaValida(malo), false, `se aceptó ${malo}`);
  }
  for (const nada of ['', '   ', undefined, null, 5, {}, ['America/Lima']]) {
    assert.equal(esZonaValida(nada), false, `se aceptó ${JSON.stringify(nada) ?? 'undefined'}`);
  }
  // Se recorta antes de comparar: un espacio pegado al pegar desde otra pantalla no tiene que
  // convertirse en «zona inválida».
  assert.equal(esZonaValida('  America/Lima  '), true);
});

test('una zona IANA REAL que no está en el catálogo se rechaza: la lista acota, no adorna', () => {
  // `Intl` conoce las dos, así que la única razón por la que éstas se rechazan es la comprobación
  // contra `ZONAS`. Sin esa mitad, el campo volvería a ser texto libre con un barniz de validación:
  // se guardaría cualquier zona del mundo y el desplegable dejaría de decir qué se ofrece.
  for (const fuera of ['Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney']) {
    assert.equal(esZonaValida(fuera), false, `se aceptó ${fuera}, que no está en el catálogo`);
  }
  // La comprobación de entrada muerta: `Intl` sí las conoce, o esta prueba pasaría por el motivo
  // equivocado y seguiría verde con la comprobación del catálogo borrada.
  for (const fuera of ['Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney']) {
    assert.doesNotThrow(() => new Intl.DateTimeFormat('es', { timeZone: fuera }));
  }
});

test('DEFECTO DOCUMENTADO · «UTC elegida» y «nadie la eligió» se guardan igual', async () => {
  // `identidad.organizaciones.zona_horaria` es `not null default 'UTC'`, y `UTC` está en el catálogo
  // como opción legítima. Las dos cosas juntas hacen que el valor guardado no distinga:
  //
  //   · la empresa que eligió UTC a propósito —un equipo remoto, un cliente que lo pidió—, y
  //   · la empresa donde nadie tocó el campo nunca.
  //
  // El repositorio pide lo contrario en todos lados: un cero MEDIDO y un cero SIN MEDIR no son el
  // mismo hecho, y los indicadores viajan como `{ valor, falta }` justo para eso. Acá no hay tal
  // distinción, y la consecuencia es visible: `components/ajustes/Empresas.jsx` dibuja la etiqueta
  // «Sin zona horaria» con `o.zonaHoraria === 'UTC'`, así que la empresa que la eligió a propósito
  // recibe para siempre un aviso de configuración faltante sobre algo que ya configuró.
  //
  // NO se arregla acá: se deja fijado el comportamiento real. El arreglo sería una columna que
  // separe los dos hechos (`zona_horaria` nula = nadie lo dijo), y es una migración.
  assert.equal(esZonaValida('UTC'), true);
  assert.ok(
    ZONAS.some((z) => z.valor === 'UTC'),
    'UTC salió del catálogo: revisá el aviso de Empresas.jsx',
  );

  // Y el valor por omisión de la columna es el mismo texto. Se lee de la base y no se afirma de
  // memoria: si la migración cambiara ese valor por omisión, el defecto se cerraría y esta prueba
  // tiene que ser la que avise.
  const omision = await unaFila<{ omision: string | null }>(
    esc.admin,
    `select column_default as omision from information_schema.columns
      where table_schema = 'identidad' and table_name = 'organizaciones'
        and column_name = 'zona_horaria'`,
  );
  assert.match(omision?.omision ?? '', /UTC/);
});
