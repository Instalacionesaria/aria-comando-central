// Las dos rutas de Leads Portal, POR EL MANEJADOR DE VERDAD. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTAS RUTAS CUIDAN, EN ORDEN DE GRAVEDAD
//
//   1 · **Quién ve.** La lista trae 593 personas reales a quien tenga la pestaña. Sin `tablero.ver`,
//       403; con el rol restringido y sin la sección concedida, `seccion_no_concedida`.
//   2 · **Qué viaja en la lista.** Ni teléfono, ni correo, ni la atribución cruda, ni los campos del
//       CRM. La ficha sí trae teléfono y correo: es la única respuesta que los trae.
//   3 · **Que no contradiga a Sales.** La cohorte y «agendó» son la misma expresión y el mismo
//       predicado que la cadena de cierre. Si dos pestañas publican cuántas personas entraron y
//       cuántas agendaron en la misma ventana y no coinciden, ninguna falla por separado.
//   4 · **La bandera.** La sección perdió `sinOperacionesTodavia` en el mismo commit que nació esta
//       ruta, porque `30-portero` da por rojo tener las dos cosas a la vez (`ADR-0304`).
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, pedirComo, sesionDe, type Escenario } from '../apoyo/closer.ts';
import { GET as lista, PANTALLA } from '../../app/api/leads-portal/route.ts';
import { GET as detalle, PANTALLA as PANTALLA_DEL_DETALLE } from '../../app/api/leads-portal/[id]/route.ts';
import { SECCIONES } from '../../lib/autorizacion/secciones.ts';
import { CLAVES_DE_LA_FILA, coherenciaConSales } from '../../lib/negocio/leadsDelPortal.ts';
import { cadenaDeCierre } from '../../lib/negocio/cadenaDeCierre.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { PERIODOS } from '../../lib/negocio/periodo.ts';

let esc: Escenario;

const PREFIJO = 'ruta-portal-';
const NOMBRE_DE_PERSONA = 'Persona de la ruta del portal';

async function limpiar(): Promise<void> {
  const mios = 'select id from negocio.contactos where ghl_contact_id like $1';
  await esc.admin.query(`delete from negocio.citas where contacto_id in (${mios})`, [`${PREFIJO}%`]);
  await esc.admin.query('delete from negocio.contactos where ghl_contact_id like $1', [`${PREFIJO}%`]);
  await esc.admin.query('delete from identidad.usuarios where nombre = $1', [NOMBRE_DE_PERSONA]);
}

async function unContacto(o: { org?: string; cita?: boolean; altaHaceDias?: number } = {}): Promise<string> {
  const org = o.org ?? esc.org;
  const r = await esc.admin.query<{ id: string }>(
    `insert into negocio.contactos
       (org_id, ghl_contact_id, nombre, telefono, email, territorio, alta_en_el_crm, score,
        atribucion_primera, campos_del_crm)
     values ($1, $2, 'Persona de la ruta', '+51 999 000 222', 'ruta@ejemplo.test', 'closer',
             now() - make_interval(days => $3::int), 80,
             '{"ip":"203.0.113.9","utmSource":"facebook"}'::jsonb, '{"campo-x":"respuesta-secreta-de-la-ruta"}'::jsonb)
     returning id`,
    [org, `${PREFIJO}${randomUUID().slice(0, 8)}`, o.altaHaceDias ?? 2],
  );
  const id = r.rows[0]!.id;
  if (o.cita) {
    await esc.admin.query(
      `insert into negocio.citas (org_id, contacto_id, ghl_evento_id, ghl_calendario_id, inicio_el, fin_el, estado_ghl)
       values ($1, $2, $3, 'cal-ruta', now() - interval '3 hours', now() - interval '2 hours', 'confirmed')`,
      [org, id, `cita-${id}`],
    );
  }
  return id;
}

/** Una persona de `alfa` con un rol del catálogo y, si se pide, secciones concedidas. */
async function unaPersona(rol: string | null, secciones: readonly string[] = []): Promise<string> {
  const r = await esc.admin.query<{ id: string }>(
    `insert into identidad.usuarios (org_id, nombre, email, password_hash)
       values ($1, $2, $3, 'scrypt$16384$8$1$aaaa$bbbb') returning id`,
    [esc.org, NOMBRE_DE_PERSONA, `ruta-portal-${randomUUID().slice(0, 8)}@alfa.ejemplo`],
  );
  const id = r.rows[0]!.id;
  if (rol) {
    await esc.admin.query(
      `insert into identidad.usuarios_roles (usuario_id, rol_id)
         select $1, id from identidad.roles where clave = $2 and org_id is null`,
      [id, rol],
    );
  }
  for (const s of secciones) {
    await esc.admin.query('insert into identidad.usuarios_secciones (usuario_id, seccion) values ($1, $2)', [id, s]);
  }
  return sesionDe(id);
}

const pedirLista = (periodo?: string, token = esc.token) =>
  lista(pedirComo(periodo === undefined ? '/api/leads-portal' : `/api/leads-portal?periodo=${periodo}`, token));
const params = (id: string) => ({ params: Promise.resolve({ id }) }) as never;
const pedirFicha = (id: string, token = esc.token) => detalle(pedirComo(`/api/leads-portal/${id}`, token), params(id));

before(async () => {
  esc = await montar('RutaDelLeadsPortal');
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · LA BANDERA Y LA PANTALLA
// ═══════════════════════════════════════════════════════════════════════════════

test('la sección `contacts` ya no dice que no tiene operaciones, y las dos rutas la declaran', () => {
  /* `30-portero` lo verifica sobre todas las secciones; esto lo dice al lado de las rutas, para que
     quien borre una encuentre acá qué se movió con ella. */
  const seccion = SECCIONES.find((s) => s.clave === PANTALLA);
  assert.ok(seccion, 'la sección `contacts` no existe');
  assert.equal(seccion.sinOperacionesTodavia, undefined, 'la bandera sigue puesta y la ruta existe');
  assert.equal(seccion.capacidadRequerida, 'tablero.ver');
  assert.equal(PANTALLA_DEL_DETALLE, PANTALLA, 'la ficha declara otra pantalla que la lista');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · QUIÉN VE
// ═══════════════════════════════════════════════════════════════════════════════

test('sin `tablero.ver`, las dos rutas responden 403', async () => {
  const token = await unaPersona(null);
  const id = await unContacto();
  assert.equal((await pedirLista('30d', token)).status, 403);
  assert.equal((await pedirFicha(id, token)).status, 403, 'la ficha abrió lo que la lista niega');
});

test('con el rol restringido y sin la sección, `seccion_no_concedida`; con la sección, pasa', async () => {
  const sin = await unaPersona('usuario');
  const r = await pedirLista('30d', sin);
  assert.equal(r.status, 403);
  assert.equal(((await r.json()) as { codigo: string }).codigo, 'seccion_no_concedida');

  const con = await unaPersona('usuario', ['contacts']);
  assert.equal((await pedirLista('30d', con)).status, 200, 'con la pestaña concedida, la lista no abrió');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · EL PERÍODO
// ═══════════════════════════════════════════════════════════════════════════════

test('un período que no existe se rechaza con 400; sin período, treinta días', async () => {
  assert.equal((await pedirLista('90d')).status, 400, 'un período inventado se atendió como si existiera');
  assert.equal((await pedirLista('mes')).status, 400, 'la clave del tercer botón de la maqueta se atendió');
  const r = await pedirLista();
  assert.equal(r.status, 200);
  const cuerpo = (await r.json()) as { periodo: string; dias: number };
  assert.equal(cuerpo.periodo, '30d');
  assert.equal(cuerpo.dias, 30, 'el período por omisión no llegó a la cohorte');
});

test('el período gobierna la cohorte: con «Hoy» no entra un alta de hace cinco días', async () => {
  await limpiar();
  const id = await unContacto({ altaHaceDias: 5 });
  const hoy = (await (await pedirLista('hoy')).json()) as { leads: { id: string }[]; dias: number };
  const mes = (await (await pedirLista('30d')).json()) as { leads: { id: string }[] };
  assert.equal(hoy.dias, 1);
  assert.ok(!hoy.leads.some((l) => l.id === id), 'con «Hoy» entró un alta de hace cinco días');
  assert.ok(mes.leads.some((l) => l.id === id));
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · QUÉ VIAJA
// ═══════════════════════════════════════════════════════════════════════════════

test('la lista no trae teléfono, ni correo, ni la atribución cruda, ni los campos del CRM', async () => {
  await limpiar();
  await unContacto({ cita: true });
  const r = await pedirLista('30d');
  assert.equal(r.status, 200);
  const texto = await r.clone().text();
  const cuerpo = (await r.json()) as { leads: Record<string, unknown>[] };
  for (const prohibido of ['999 000 222', 'ruta@ejemplo.test', '203.0.113.9', 'respuesta-secreta-de-la-ruta', 'campos_del_crm', 'atribucion']) {
    assert.ok(!texto.includes(prohibido), `«${prohibido}» viajó en la lista`);
  }
  for (const fila of cuerpo.leads) {
    assert.deepEqual(Object.keys(fila).sort(), [...CLAVES_DE_LA_FILA].sort());
  }
  assert.equal(r.headers.get('cache-control')?.includes('no-store'), true, 'la lista se puede guardar en un caché');
});

test('la ficha trae el teléfono y el correo, y la IP tampoco viaja ahí', async () => {
  const id = await unContacto();
  const r = await pedirFicha(id);
  assert.equal(r.status, 200);
  const texto = await r.clone().text();
  const { ficha } = (await r.json()) as { ficha: { telefono: string; email: string } };
  assert.equal(ficha.telefono, '+51 999 000 222');
  assert.equal(ficha.email, 'ruta@ejemplo.test');
  assert.ok(!texto.includes('203.0.113.9'), 'la IP de la atribución viajó en la ficha');
});

test('la ficha de otra empresa, la de un id que no existe y la de un id mal formado dan el mismo 404', async () => {
  const ajeno = await unContacto({ org: esc.otraOrg });
  for (const id of [ajeno, randomUUID(), 'no-es-un-uuid']) {
    const r = await pedirFicha(id);
    assert.equal(r.status, 404, `«${id}» no dio 404`);
    assert.equal(((await r.json()) as { codigo: string }).codigo, 'no_encontrado');
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · LA COHERENCIA CON SALES
// ═══════════════════════════════════════════════════════════════════════════════

test('el total y los agendados coinciden con la cadena de Sales en la misma ventana', async () => {
  /* Una siembra con de todo: con cita, sin cita, con alta vieja. Si cualquiera de las dos pestañas
     cambia su cohorte o su «agendó», esto deja de coincidir. */
  await limpiar();
  await unContacto({ cita: true });
  await unContacto({});
  await unContacto({ altaHaceDias: 40 });
  for (const periodo of ['7d', '30d', 'completo']) {
    const c = (await (await pedirLista(periodo)).json()) as {
      cohorte: { total: number };
      todos: { agendados: number };
      coherenciaConSales: { cohorte: number; agendados: number; coincide: boolean };
    };
    /* Contra la cadena llamada DIRECTAMENTE, no contra lo que la ruta dice de ella: si la ruta copiara
       sus propias cifras en `coherenciaConSales`, compararla consigo misma daría verde siempre. */
    const dias = PERIODOS.find((p) => p.clave === periodo)!.dias;
    const cadena = await conOrganizacion(esc.org, () => cadenaDeCierre(dias));
    const agendadosDeSales = cadena.eslabones.find((e) => e.clave === 'con_cita')!.contactos;
    assert.equal(c.cohorte.total, cadena.cohorte, `${periodo}: la cohorte no es la de Sales`);
    assert.equal(c.todos.agendados, agendadosDeSales, `${periodo}: «agendó» no es el de Sales`);
    assert.deepEqual(
      c.coherenciaConSales,
      { cohorte: cadena.cohorte, agendados: agendadosDeSales, coincide: true },
      `${periodo}: la ruta no publica la cadena de Sales tal como es`,
    );
  }
});

test('los huecos de la venta vienen de Sales, con su fecha, y son los tres que esta pantalla comparte', async () => {
  const c = (await (await pedirLista('30d')).json()) as { huecos: { medidoEl: string; lista: { punto: string }[] } };
  assert.ok(c.huecos.medidoEl);
  assert.deepEqual(
    c.huecos.lista.map((h) => h.punto),
    ['La venta', 'El revenue y la tasa de cierre', 'El pago verificado'],
    'Sales renombró un hueco y esta pantalla dejó de mostrarlo sin avisar',
  );
});

test('la respuesta trae la frescura de contactos y citas al lado, nunca dentro del dato', async () => {
  const c = (await (await pedirLista('30d')).json()) as { frescura: Record<string, { estado: string }> };
  assert.deepEqual(Object.keys(c.frescura).sort(), ['citas', 'contactos']);
  for (const f of Object.values(c.frescura)) assert.ok(['nunca', 'atrasada', 'fallando', 'al_dia'].includes(f.estado));
});

test('si la pestaña y Sales no coinciden, las dos cifras viajan y el aviso lo dice', () => {
  /* Con el código correcto nunca divergen, así que la ruta sola no puede probar que la alarma sigue
     encendida: una ruta que copiara sus propias cifras en la coherencia pasaría todo lo de arriba. */
  const portal = { cohorte: { total: 10 }, todos: { agendados: 4 }, aviso: 'Otro aviso.' } as never;
  const cadena = (cohorte: number, agendados: number) =>
    ({ cohorte, eslabones: [{ clave: 'con_cita', contactos: agendados }] }) as never;

  const distinta = coherenciaConSales(portal, cadena(11, 4));
  assert.deepEqual(distinta.coherencia, { cohorte: 11, agendados: 4, coincide: false });
  assert.match(String(distinta.aviso), /no cuentan lo mismo/);
  assert.match(String(distinta.aviso), /Otro aviso\./, 'la alarma se comió el aviso de la cohorte');
  assert.equal(coherenciaConSales(portal, cadena(10, 5)).coherencia.coincide, false, 'sólo miró la cohorte');

  const igual = coherenciaConSales(portal, cadena(10, 4));
  assert.deepEqual(igual, { coherencia: { cohorte: 10, agendados: 4, coincide: true }, aviso: 'Otro aviso.' });
});

test('la ruta compara con Sales a través de `coherenciaConSales`, y no por su cuenta', () => {
  /* La prueba de arriba cubre la función; ésta, que la ruta la use. Una ruta que armara la coherencia
     con sus propias cifras pasaría la prueba de la coherencia —con el código correcto las dos dan lo
     mismo— y la alarma quedaría apagada sin que nada lo mostrara. */
  const ruta = readFileSync(join(RAIZ, 'app/api/leads-portal/route.ts'), 'utf8');
  assert.match(ruta, /coherenciaConSales\(portal, cadena\)/);
  assert.match(ruta, /coherenciaConSales: coherencia/);
});
