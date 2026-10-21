// EL PUNTAJE Y EL PERFIL DE CADA CLIENTE, ELEGIDOS EN AJUSTES › CLIENTES. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO (el nivel 3, C6 · D4, la `098`)
//
// Una empresa propia con P (el principal, con la fila de `CAMPO_DEL_PUNTAJE` como la subcuenta de ARIA), Y (su
// «Puntaje | ICP» y otro numérico, «Score del cliente»), W (catálogo sin puntaje), Z (sin catálogo) y R (un catálogo
// chico para la ruta), más uno de baja y uno en pausa:
//
//   · sin nada elegido, cada subcuenta resuelve lo de antes, id por id: la unión de la constante y el primero por su
//     nombre, también con la constante renombrada y otro «Puntaje | ICP» al lado — mutaciones: sin el respaldo por
//     nombre, sin la constante, la cascada exclusiva;
//   · el elegido de Y gana sobre su «Puntaje | ICP» y no toca a P, y los congelados se recalculan al elegir —
//     mutaciones: no excluir el nombre, no recalcular;
//   · elegir otro campo en el principal saca la constante — mutación: anteponerla siempre;
//   · uno por cliente: el índice, la carrera de dos elecciones que sale 409, y cambiar de un elegido a otro sin
//     carrera — mutaciones: el índice sin `where` o sin `unique`, no capturar el 23505, prender antes de apagar;
//   · el refresco no pisa lo elegido, y una carpeta sin nombre ni grupo toma el suyo cuando el nombre llega tarde;
//   · UNA validación del puntaje: la sincronización y el SQL dicen lo mismo de cada valor, y Creative cuenta eso;
//   · Creative promedia el elegido de cada cliente, nombra al que no tiene campo (con catálogo o sin él) y no le da un
//     «Calificados: 0» falso; también cuando ninguno a la vista tiene campo, con varios o con el foco en uno que no es
//     el principal (con un solo cliente, el aviso de siempre: lo exige la 157);
//   · el Perfil sin carpetas que se muestren lo dice sin culpar al contacto, y una carpeta del contrato sí se muestra;
//   · la ficha del portal saca del cuestionario el elegido;
//   · la ruta: capacidades, 400 (todo se valida antes de escribir), 404, el principal y el pausado, la marca de lo que
//     ya no está, y la auditoría.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { DOMINIO, leerRespuesta, pedirComo, sesionDe } from '../apoyo/closer.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { hashDeToken } from '../../lib/autorizacion/sesion.ts';
import { ambitoDeUnCliente } from '../../lib/negocio/ambitoDelCliente.ts';
import {
  GRUPOS_DEL_PERFIL,
  campoDelPuntaje,
  campoPorNombre,
  camposDelPuntaje,
  puntajeDeUnValor,
  puntajeUsable,
  refrescarCatalogoDeCampos,
} from '../../lib/negocio/camposDelCrm.ts';
import { sincronizarContactos } from '../../lib/negocio/sincronizar.ts';
import { perfilDeLaFicha } from '../../lib/negocio/ficha.ts';
import { fichaDelLeadDelPortal } from '../../lib/negocio/fichaDelLeadDelPortal.ts';
import { CAMPO_DE_ICP, calidadDelCreativo } from '../../lib/negocio/calidadDelCreativo.ts';
import { seNombranLosClientes } from '../../lib/negocio/faltaDeLosClientes.ts';
import { lecturaDeCreative } from '../../lib/negocio/lecturaDeCreative.ts';
import { CAMPO_DEL_PUNTAJE, NOMBRE_DEL_PUNTAJE } from '../../lib/ghl/contrato.ts';
import { GET as verCampos, PUT as elegirCampos } from '../../app/api/admin/cuentas/[id]/campos/route.ts';
import { PATCH as vincular } from '../../app/api/admin/cuentas/[id]/vinculo/route.ts';

const SLUG = 'gamma-296';
/** Los ids de Y: V ordena ANTES que X por `campo_id`, así un orden que no excluya el nombre toma V y se ve. */
const V = 'a296v';
const X = 'b296x';
const Z = 'z296p';

let admin: Client;
let org: string;
let deBeta: string;
let p: string;
let y: string;
let w: string;
let z: string;
let r: string;
let deBaja: string;
let pausada: string;
let tokenAdmin: string;
let tokenMirada: string;
let tokenAria: string;
const fetchOriginal = globalThis.fetch;

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const foco = (cuenta: string) => ({ orgId: org, todaLaOrganizacion: true, cuentas: [cuenta] }) as const;
const ruta = (cuenta: string) => `/api/admin/cuentas/${cuenta}/campos`;

interface Catalogo {
  catalogo: { leido: boolean };
  puntaje: { origen: string; campoId: string | null; yaNoEsNumerico: boolean; noVistoEnLaUltimaLectura: boolean };
  opciones: { campoId: string; tipo: string; yaNoEsNumerico: boolean; conValor: number; usables: number }[];
  carpetas: { carpetaId: string; grupo: string | null; elegida: boolean; campos: number }[];
  grupos: { clave: string; titulo: string }[];
  puedeEditar: boolean;
  codigo?: string;
  detalle?: string;
}

const ver = async (cuenta: string, token = tokenAdmin) => leerRespuesta<Catalogo>(await verCampos(pedirComo(ruta(cuenta), token), ctx(cuenta)));
const elegir = async (cuenta: string, cuerpo: unknown, token = tokenAdmin) =>
  leerRespuesta<Catalogo>(await elegirCampos(pedirComo(ruta(cuenta), token, { metodo: 'PUT', cuerpo }), ctx(cuenta)));

async function limpiar(): Promise<void> {
  const o = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = $1`, [SLUG]);
  if (!o) return;
  for (const t of ['contactos', 'campos_del_crm', 'carpetas_del_crm', 'ingesta_pulso']) {
    await admin.query(`delete from negocio.${t} where org_id = $1`, [o.id]);
  }
  await admin.query(`delete from identidad.sesiones where usuario_id in (select id from identidad.usuarios where org_id = $1)`, [o.id]);
  await admin.query(`delete from identidad.usuarios_roles where usuario_id in (select id from identidad.usuarios where org_id = $1)`, [o.id]);
  await admin.query(`delete from identidad.roles where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.cuentas where org_id = $1 and not es_por_omision`, [o.id]);
  await admin.query(`delete from identidad.usuarios where org_id = $1`, [o.id]);
  await admin.query(`delete from identidad.organizaciones where id = $1`, [o.id]);
}

async function cliente(nombre: string, slug: string, estado = 'activa'): Promise<string> {
  const c = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.cuentas (org_id, nombre, slug, estado, baja_el)
     values ($1, $2, $3, $4, case when $4 = 'baja' then now() end) returning id`,
    [org, nombre, slug, estado],
  );
  assert.ok(c);
  return c.id;
}

async function persona(nombre: string, rolId: string): Promise<string> {
  const u = await unaFila<{ id: string }>(admin, `insert into identidad.usuarios (org_id, nombre) values ($1, $2) returning id`, [org, nombre]);
  assert.ok(u);
  await admin.query(`insert into identidad.usuarios_roles (usuario_id, rol_id) values ($1, $2)`, [u.id, rolId]);
  return u.id;
}

async function carpeta(cuenta: string, id: string, nombre: string | null, grupo: string | null): Promise<void> {
  await admin.query(
    `insert into negocio.carpetas_del_crm (org_id, cuenta_id, carpeta_id, nombre, grupo) values ($1, $2, $3, $4, $5)`,
    [org, cuenta, id, nombre, grupo],
  );
}

async function campo(cuenta: string, id: string, nombre: string, carpetaId: string, tipo: string): Promise<void> {
  await admin.query(
    `insert into negocio.campos_del_crm (org_id, cuenta_id, campo_id, nombre, carpeta_id, tipo, visto_el)
     values ($1, $2, $3, $4, $5, $6, now())`,
    [org, cuenta, id, nombre, carpetaId, tipo],
  );
}

/** Un contacto con sus campos ya guardados, como los deja la sincronización. `territorio` nulo = congelado. */
async function contacto(
  cuenta: string,
  ghl: string,
  campos: Record<string, string>,
  o: { score?: number | null; territorio?: string | null; pieza?: string } = {},
): Promise<string> {
  const c = await unaFila<{ id: string }>(
    admin,
    `insert into negocio.contactos (org_id, cuenta_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, campos_del_crm, score, atribucion_primera)
     values ($1, $2, $3, 'Contacto 296', $4, now(), $5::jsonb, $6, $7::jsonb) returning id`,
    [
      org,
      cuenta,
      ghl,
      o.territorio === undefined ? 'closer' : o.territorio,
      JSON.stringify(campos),
      o.score ?? null,
      JSON.stringify(o.pieza ? { utmContent: o.pieza } : {}),
    ],
  );
  assert.ok(c);
  return c.id;
}

const scoreDe = async (ghl: string) =>
  (await unaFila<{ score: number | null }>(admin, `select score from negocio.contactos where org_id = $1 and ghl_contact_id = $2`, [org, ghl]))
    ?.score;

/** GoHighLevel falso para la sincronización: estos contactos en `zona_closer`, nada más; lo demás responde vacío. */
async function sincronizar(cuenta: string, contactos: { id: string; campos: Record<string, unknown> }[]): Promise<void> {
  globalThis.fetch = (async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    const url = typeof entrada === 'string' ? entrada : String(entrada);
    const cuerpo = typeof opciones?.body === 'string' ? (JSON.parse(opciones.body) as { filters?: { value?: string }[] }) : {};
    if (url.includes('/contacts/search')) {
      const lista =
        cuerpo.filters?.[0]?.value === 'zona_closer'
          ? contactos.map((c) => ({
              id: c.id,
              contactName: `Contacto ${c.id}`,
              tags: ['zona_closer'],
              customFields: Object.entries(c.campos).map(([id, value]) => ({ id, value })),
            }))
          : [];
      return new Response(JSON.stringify({ contacts: lista, total: lista.length }), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  }) as typeof globalThis.fetch;
  try {
    const s = await conOrganizacion(ambitoDeUnCliente(org, cuenta), () => sincronizarContactos({ token: 't296', locationId: `loc296-${cuenta}` }));
    assert.equal(s.tipo, 'listo');
  } finally {
    globalThis.fetch = fetchOriginal;
  }
}

/** Lo de antes de la `098`: la constante de ARIA y el primero por su nombre, en ese orden. */
const deAntes = async () => [...new Set([CAMPO_DEL_PUNTAJE, ...((await campoPorNombre(NOMBRE_DEL_PUNTAJE)) ?? [])])];

async function esperarBloqueadas(cuantas: number, tabla: string): Promise<void> {
  for (let i = 0; i < 200; i += 1) {
    const f = await unaFila<{ n: number }>(
      admin,
      `select count(*)::int as n from pg_stat_activity where wait_event_type = 'Lock' and query ilike $1`,
      [`%${tabla}%`],
    );
    if ((f?.n ?? 0) >= cuantas) return;
    await new Promise((listo) => setTimeout(listo, 25));
  }
  assert.fail(`no llegaron ${cuantas} transacciones a esperar el candado de ${tabla}`);
}

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  await limpiar();
  const o = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.organizaciones (nombre, slug, zona_horaria) values ('Gamma 296', $1, 'America/Lima') returning id`,
    [SLUG],
  );
  const b = await unaFila<{ cuenta: string }>(
    admin,
    `select c.id as cuenta from identidad.organizaciones o join identidad.cuentas c on c.org_id = o.id where o.slug = 'beta' limit 1`,
  );
  const aria = await unaFila<{ id: string }>(admin, `select id from identidad.usuarios where email = 'fundadora@principal.ejemplo'`);
  assert.ok(o && b && aria, 'falta el sembrado');
  org = o.id;
  deBeta = b.cuenta;
  const principal = await unaFila<{ id: string }>(admin, `select id from identidad.cuentas where org_id = $1 and es_por_omision`, [org]);
  assert.ok(principal);
  p = principal.id;
  y = await cliente('Segunda 296', 'segunda-296');
  w = await cliente('Tercera 296', 'tercera-296');
  z = await cliente('Cuarta 296', 'cuarta-296');
  r = await cliente('Quinta 296', 'quinta-296');
  deBaja = await cliente('De baja 296', 'baja-296', 'baja');
  pausada = await cliente('Pausada 296', 'pausada-296', 'pausada');

  const deAdmin = await unaFila<{ id: string }>(admin, `select id from identidad.roles where clave = 'administrador' and org_id is null`);
  // Un rol propio que VE las credenciales y no las edita: ninguno de los del sistema es así.
  const mirada = await unaFila<{ id: string }>(
    admin,
    `insert into identidad.roles (clave, nombre, org_id) values ('mirada_296', 'Mirada 296', $1) returning id`,
    [org],
  );
  assert.ok(deAdmin && mirada);
  await admin.query(`insert into identidad.roles_permisos (rol_id, permiso) values ($1, 'credenciales.ver')`, [mirada.id]);
  tokenAdmin = await sesionDe(await persona('Admin 296', deAdmin.id));
  tokenMirada = await sesionDe(await persona('Mirada 296', mirada.id));
  tokenAria = await sesionDe(aria.id);

  // P, como la subcuenta de ARIA: la constante con su nombre, otro numérico y un texto, en una carpeta del contrato.
  await carpeta(p, 'cp296p', 'Contact', 'calificacion');
  await campo(p, CAMPO_DEL_PUNTAJE, NOMBRE_DEL_PUNTAJE, 'cp296p', 'NUMERICAL');
  await campo(p, Z, 'Score propio', 'cp296p', 'NUMERICAL');
  await campo(p, 'txt296p', 'Notas', 'cp296p', 'TEXT');
  // Y, del mismo snapshot con otros ids, y una carpeta que NO se muestra.
  await carpeta(y, 'cp296y', 'Contact Y', null);
  await campo(y, V, NOMBRE_DEL_PUNTAJE, 'cp296y', 'NUMERICAL');
  await campo(y, X, 'Score del cliente', 'cp296y', 'NUMERICAL');
  await campo(y, 'txt296y', 'Respuesta', 'cp296y', 'TEXT');
  // W: un catálogo sin ningún puntaje.
  await carpeta(w, 'cp296w', 'Otra', null);
  await campo(w, 'txt296w', 'Algo', 'cp296w', 'TEXT');
  // R: el de la ruta.
  await carpeta(r, 'cp296r', 'Formulario R', null);
  await campo(r, 'r296n', 'Puntaje R', 'cp296r', 'NUMERICAL');
  await campo(r, 'r296t', 'Texto R', 'cp296r', 'TEXT');
});

after(async () => {
  globalThis.fetch = fetchOriginal;
  try {
    if (tokenAria) await admin.query(`delete from identidad.sesiones where token_hash = $1`, [hashDeToken(tokenAria)]);
    await limpiar();
  } finally {
    await cerrarTodo();
    await cerrarClientes();
  }
});

test('sin nada elegido, cada subcuenta resuelve lo de antes, id por id', async () => {
  assert.equal(CAMPO_DE_ICP, NOMBRE_DEL_PUNTAJE, 'Creative y la sincronización buscan dos nombres distintos');
  for (const donde of [org, foco(p), foco(y), foco(w), foco(z)]) {
    const [ahora, antes] = await conOrganizacion(donde, async () => [await camposDelPuntaje(), await deAntes()]);
    assert.deepEqual(ahora, antes, 'sin nada elegido, la sincronización cambió de campos');
    const [creative, porNombre] = await conOrganizacion(donde, async () => [await campoDelPuntaje(), await campoPorNombre(NOMBRE_DEL_PUNTAJE)]);
    assert.deepEqual(creative, porNombre, 'sin nada elegido, Creative cambió de campo');
  }
  assert.deepEqual(await conOrganizacion(foco(z), () => camposDelPuntaje()), [CAMPO_DEL_PUNTAJE], 'sin catálogo va la constante sola');
  assert.deepEqual(await conOrganizacion(foco(y), () => camposDelPuntaje()), [CAMPO_DEL_PUNTAJE, V]);

  // La constante renombrada en GoHighLevel y otro «Puntaje | ICP» al lado, en la misma subcuenta: sigue la unión.
  await admin.query(`update negocio.campos_del_crm set nombre = 'Puntaje | ICP (viejo)' where org_id = $1 and campo_id = $2`, [org, CAMPO_DEL_PUNTAJE]);
  await campo(p, 'c296n', NOMBRE_DEL_PUNTAJE, 'cp296p', 'NUMERICAL');
  try {
    const [ahora, antes] = await conOrganizacion(foco(p), async () => [await camposDelPuntaje(), await deAntes()]);
    assert.deepEqual(ahora, antes);
    assert.deepEqual(ahora, [CAMPO_DEL_PUNTAJE, 'c296n']);
    assert.deepEqual(await conOrganizacion(foco(p), () => campoDelPuntaje()), ['c296n'], 'Creative dejó el de su nombre por la constante');
    await sincronizar(p, [
      { id: 'c296n-solo', campos: { c296n: 55 } },
      { id: 'c296n-los-dos', campos: { [CAMPO_DEL_PUNTAJE]: 50, c296n: 55 } },
    ]);
    assert.equal(await scoreDe('c296n-solo'), 55, 'un contacto con sólo el campo nuevo quedó sin puntaje: la unión se rompió');
    assert.equal(await scoreDe('c296n-los-dos'), 50, 'con los dos, la constante dejó de ir primero');
  } finally {
    await admin.query(`delete from negocio.contactos where org_id = $1 and ghl_contact_id like 'c296n-%'`, [org]);
    await admin.query(`delete from negocio.campos_del_crm where org_id = $1 and campo_id = 'c296n'`, [org]);
    await admin.query(`update negocio.campos_del_crm set nombre = $3 where org_id = $1 and campo_id = $2`, [org, CAMPO_DEL_PUNTAJE, NOMBRE_DEL_PUNTAJE]);
  }
});

test('el Perfil sin carpetas que se muestren lo dice sin culpar al contacto; una carpeta del contrato sí se muestra', async () => {
  const deY = await contacto(y, 'c296perfil-y', {});
  const deP = await contacto(p, 'c296perfil-p', {});
  const deZ = await contacto(z, 'c296perfil-z', {});
  const [fy, fp, fz] = await conOrganizacion(org, async () => [await perfilDeLaFicha(deY), await perfilDeLaFicha(deP), await perfilDeLaFicha(deZ)]);
  assert.match(fy.falta ?? '', /Ajustes › Clientes/, 'Y tiene catálogo y ninguna carpeta que se muestre, y el Perfil no lo dijo');
  assert.doesNotMatch(fy.falta ?? '', /formulario/, 'el Perfil culpó al contacto de una elección de la empresa');
  // P: su carpeta tiene el grupo del contrato y nadie la eligió (`grupo_elegido_el` nulo): se muestra.
  assert.match(fp.falta ?? '', /formulario/, 'una carpeta con el grupo del contrato contó como «ninguna se muestra»');
  assert.match(fz.falta ?? '', /catálogo/);
  await admin.query(`delete from negocio.contactos where org_id = $1 and ghl_contact_id like 'c296perfil-%'`, [org]);
});

test('el elegido de Y gana sobre su «Puntaje | ICP», no toca a P, y los congelados se recalculan al elegir', async () => {
  await contacto(y, 'c296congelado', { [V]: '20', [X]: '70' }, { score: 20, territorio: null });
  await contacto(p, 'c296p50', { [CAMPO_DEL_PUNTAJE]: '50' }, { score: 50 });

  const e = await elegir(y, { puntaje: X });
  assert.equal(e.estado, 200, JSON.stringify(e.cuerpo));
  assert.deepEqual([e.cuerpo.puntaje.origen, e.cuerpo.puntaje.campoId], ['elegido', X]);
  assert.equal(await scoreDe('c296congelado'), 70, 'el congelado se quedó con el puntaje del campo anterior');
  assert.equal(await scoreDe('c296p50'), 50, 'elegir en Y recalculó a los contactos de P');

  await sincronizar(y, [
    { id: 'c296-los-dos', campos: { [V]: 40, [X]: 80 } },
    { id: 'c296-solo-v', campos: { [V]: 40 } },
  ]);
  assert.equal(await scoreDe('c296-los-dos'), 80, 'con un campo elegido, el «Puntaje | ICP» de Y siguió contando');
  assert.equal(await scoreDe('c296-solo-v'), null, 'el «Puntaje | ICP» de Y dio puntaje aunque Y eligió otro');
  assert.equal(await scoreDe('c296p50'), 50);
});

test('elegir otro campo en el principal saca la constante de ARIA', async () => {
  await contacto(p, 'c296pz', { [CAMPO_DEL_PUNTAJE]: '50', [Z]: '90' }, { score: 50 });
  const e = await elegir(p, { puntaje: Z });
  assert.equal(e.estado, 200, 'el principal no se pudo configurar: su catálogo es suyo aunque sus credenciales sean de la empresa');
  assert.equal(await scoreDe('c296pz'), 90, 'la constante siguió ganando sobre el elegido del principal');
  assert.equal(await scoreDe('c296p50'), null, 'un contacto con sólo la constante conservó su puntaje');
  await sincronizar(p, [
    { id: 'c296p-los-dos', campos: { [CAMPO_DEL_PUNTAJE]: 50, [Z]: 90 } },
    { id: 'c296p-solo-constante', campos: { [CAMPO_DEL_PUNTAJE]: 50 } },
  ]);
  assert.equal(await scoreDe('c296p-los-dos'), 90);
  assert.equal(await scoreDe('c296p-solo-constante'), null);
  assert.ok(!(await conOrganizacion(foco(p), () => camposDelPuntaje())).includes(CAMPO_DEL_PUNTAJE));
});

test('uno por cliente: el índice, y dos elecciones al mismo tiempo dan una sola', async () => {
  await assert.rejects(
    admin.query(`update negocio.campos_del_crm set es_el_puntaje = true where org_id = $1 and campo_id = $2`, [org, V]),
    (e: { code?: string }) => e.code === '23505',
    'dos campos elegidos en el mismo cliente',
  );
  const elegidos = await filas<{ cuenta_id: string }>(admin, `select cuenta_id from negocio.campos_del_crm where org_id = $1 and es_el_puntaje`, [org]);
  assert.deepEqual(elegidos.map((f) => f.cuenta_id).sort(), [p, y].sort(), 'uno en P y otro en Y no conviven');
  const indice = await unaFila<{ unico: boolean; predicado: string | null; columnas: string[] }>(
    admin,
    `select i.indisunique as unico, pg_get_expr(i.indpred, i.indrelid) as predicado,
            array(select a.attname::text from unnest(i.indkey::int2[]) with ordinality k(n, o)
                    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.n order by k.o) as columnas
       from pg_index i where i.indexrelid = 'negocio.campos_del_crm_un_puntaje_por_cliente'::regclass`,
  );
  assert.deepEqual(indice, { unico: true, predicado: 'es_el_puntaje', columnas: ['org_id', 'cuenta_id'] });

  // La carrera, de verdad: las dos peticiones esperan el candado de sus filas y se sueltan juntas.
  assert.equal((await elegir(y, { puntaje: null })).estado, 200);
  const candado = await conectar('admin');
  try {
    await candado.query('begin');
    await candado.query(`select campo_id from negocio.campos_del_crm where org_id = $1 and campo_id in ($2, $3) for update`, [org, V, X]);
    const dos = [elegir(y, { puntaje: V }), elegir(y, { puntaje: X })];
    try {
      await esperarBloqueadas(2, 'campos_del_crm');
    } finally {
      await candado.query('commit');
    }
    const [a, b] = await Promise.all(dos);
    assert.deepEqual([a!.estado, b!.estado].sort(), [200, 409], 'dos elecciones simultáneas dieron las dos por buenas, o ninguna');
    const perdio = a!.estado === 409 ? a! : b!;
    assert.equal(perdio.cuerpo.codigo, 'rechazo_de_la_base');
    assert.match(perdio.cuerpo.detalle ?? '', /al mismo tiempo/);
  } finally {
    await candado.end();
  }
  assert.equal((await elegir(y, { puntaje: X })).estado, 200);

  // De un elegido a otro, sin carrera: el anterior se apaga antes de prender el nuevo, o el índice choca consigo mismo.
  const cambio = await elegir(y, { puntaje: V });
  assert.deepEqual([cambio.estado, cambio.cuerpo.puntaje?.origen, cambio.cuerpo.puntaje?.campoId], [200, 'elegido', V], JSON.stringify(cambio.cuerpo));
  const deY = await filas<{ campo_id: string }>(admin, `select campo_id from negocio.campos_del_crm where org_id = $1 and cuenta_id = $2 and es_el_puntaje`, [org, y]);
  assert.deepEqual(deY.map((f) => f.campo_id), [V], 'cambiar de elegido dejó dos, o ninguno');
  assert.equal((await elegir(y, { puntaje: X })).estado, 200);
});

test('el refresco no pisa lo elegido, y una carpeta sin nombre toma su grupo cuando el nombre llega tarde', async () => {
  // Una carpeta que el contrato mostraría por su nombre, escondida a mano; y dos sin nombre ni grupo, una elegida.
  await carpeta(y, 'cp296y-escondida', '📁 Score | ICP Nuevo', 'calificacion');
  assert.equal((await elegir(y, { carpetas: [{ carpetaId: 'cp296y-escondida', grupo: null }] })).estado, 200);
  await carpeta(y, 'tarde296', null, null);
  await carpeta(y, 'tarde296-elegida', null, null);
  await admin.query(`update negocio.carpetas_del_crm set grupo_elegido_el = now() where org_id = $1 and carpeta_id = 'tarde296-elegida'`, [org]);
  await admin.query(`update negocio.campos_del_crm set visto_el = now() - interval '2 days' where org_id = $1 and cuenta_id = $2`, [org, y]);

  const definicion = (id: string, nombre: string, carpetaId: string, dataType: string) => ({ id, name: nombre, parentId: carpetaId, dataType, position: 1, documentType: 'field' });
  globalThis.fetch = (async (entrada: RequestInfo | URL) => {
    const url = typeof entrada === 'string' ? entrada : String(entrada);
    const m = /\/customFields\/([^/?]+)$/.exec(url);
    if (m) return new Response(JSON.stringify({ customField: { name: '📁 Score | ICP Nuevo' } }), { status: 200 });
    if (/\/customFields$/.test(url)) {
      return new Response(
        JSON.stringify({
          customFields: [
            definicion(V, NOMBRE_DEL_PUNTAJE, 'cp296y', 'NUMERICAL'),
            definicion(X, 'Score del cliente', 'cp296y', 'NUMERICAL'),
            definicion('txt296y', 'Respuesta', 'cp296y', 'TEXT'),
            definicion('e296', 'Escondido', 'cp296y-escondida', 'TEXT'),
            definicion('t296', 'Tardío', 'tarde296', 'TEXT'),
            definicion('t296e', 'Tardío elegido', 'tarde296-elegida', 'TEXT'),
          ],
        }),
        { status: 200 },
      );
    }
    return new Response('{}', { status: 200 });
  }) as typeof globalThis.fetch;
  try {
    const leido = await conOrganizacion(ambitoDeUnCliente(org, y), () => refrescarCatalogoDeCampos({ token: 't296', locationId: 'loc296y' }));
    assert.equal(leido?.saltado, false);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
  const x = await unaFila<{ elegido: boolean; reciente: boolean }>(
    admin,
    `select es_el_puntaje as elegido, visto_el > now() - interval '1 hour' as reciente from negocio.campos_del_crm where org_id = $1 and campo_id = $2`,
    [org, X],
  );
  assert.deepEqual(x, { elegido: true, reciente: true }, 'el refresco borró el campo elegido, o no lo leyó');
  const grupos = Object.fromEntries(
    (await filas<{ carpeta_id: string; grupo: string | null }>(admin, `select carpeta_id, grupo from negocio.carpetas_del_crm where org_id = $1 and cuenta_id = $2`, [org, y])).map(
      (f) => [f.carpeta_id, f.grupo],
    ),
  );
  assert.equal(grupos['cp296y-escondida'], null, 'el refresco volvió a mostrar una carpeta escondida a mano');
  assert.equal(grupos['tarde296'], 'calificacion', 'la carpeta cuyo nombre llegó tarde no tomó su grupo');
  assert.equal(grupos['tarde296-elegida'], null, 'el nombre que llegó tarde pisó una elección');
});

test('una sola validación del puntaje: la sincronización y el SQL dicen lo mismo de cada valor', async () => {
  const valores = ['50', '50.5', '140', '0', '100', '101', ' 50', '1e1', '007', '0050', '-5', 'Alto'];
  const enSql = await conOrganizacion(org, async () =>
    Promise.all(valores.map(async (v) => (await sql<{ n: number | null }>`select ${puntajeUsable(sql`${v}::text`)} as n`.execute(datos())).rows[0]!.n)),
  );
  assert.deepEqual(enSql, valores.map((v) => puntajeDeUnValor(v)), 'el SQL y la sincronización validan distinto');
  assert.deepEqual(valores.map((v) => puntajeDeUnValor(v)), [50, null, null, 0, 100, null, null, null, 7, null, null, null]);

  // Por las dos rutas de verdad: la sincronización (en Y, que eligió X) y el SQL sobre lo que guardó.
  await sincronizar(y, valores.map((v, i) => ({ id: `c296valor-${i}`, campos: { [X]: v } })));
  const guardados = await filas<{ score: number | null; crudo: string }>(
    admin,
    `select score, campos_del_crm ->> $2 as crudo from negocio.contactos where org_id = $1 and ghl_contact_id like 'c296valor-%'`,
    [org, X],
  );
  assert.equal(guardados.length, valores.length);
  for (const g of guardados) assert.equal(g.score, puntajeDeUnValor(g.crudo), `«${g.crudo}» se guardó con otro puntaje`);
  await admin.query(`delete from negocio.contactos where org_id = $1 and ghl_contact_id like 'c296valor-%'`, [org]);
});

test('Creative promedia el elegido de cada cliente y nombra al que no tiene campo, sin un «Calificados: 0» falso', async () => {
  for (let i = 0; i < 10; i += 1) {
    await contacto(p, `c296cre-p${i}`, { [Z]: '80' }, { pieza: 'pieza296p' });
    await contacto(y, `c296cre-y${i}`, { [X]: i % 2 === 0 ? '80' : '90', [V]: '10' }, { pieza: 'pieza296y' });
    await contacto(w, `c296cre-w${i}`, {}, { pieza: 'pieza296w' });
  }
  for (let i = 0; i < 3; i += 1) await contacto(z, `c296cre-z${i}`, {}, { pieza: 'pieza296z' });
  // Los valores que la validación vieja de Creative contaba —decimales, más de 100— y la de la sincronización no.
  for (const [i, v] of ['50', '50.5', '140', '0', ' 50', '1e1', '007', '100', '101'].entries()) {
    await contacto(y, `c296cre-rara${i}`, { [X]: v }, { pieza: 'rara296' });
  }

  const lectura = await conOrganizacion(org, () => lecturaDeCreative(30));
  const fila = (cuenta: string, pieza: string) => lectura.calidad.filas.find((f) => f.cuentaId === cuenta && f.creativo === pieza);
  assert.equal(fila(y, 'pieza296y')?.icpPromedio, 85, 'el encaje de Y no salió de su campo elegido');
  assert.equal(fila(p, 'pieza296p')?.icpPromedio, 80);
  assert.equal(fila(y, 'rara296')?.conPuntaje, 4, 'Creative contó puntajes que la sincronización descarta');
  assert.deepEqual([...lectura.calidad.cuentasSinPuntaje].sort(), [w, z].sort());
  assert.match(lectura.calidad.aviso ?? '', /«Tercera 296» no tiene campo del puntaje[^.]*\. Quien administra la empresa lo elige en Ajustes › Clientes/);
  assert.match(lectura.calidad.aviso ?? '', /Todavía no se leyó el catálogo de campos de «Cuarta 296»/, 'sin catálogo se dijo que no hay campo');
  assert.doesNotMatch(lectura.calidad.aviso ?? '', /«Cuarta 296» no tiene campo/);
  const pieza = (cuenta: string, nombre: string) => lectura.pantalla.piezas.find((x) => x.cuentaId === cuenta && x.nombre === nombre);
  assert.deepEqual(pieza(w, 'pieza296w')?.cifras.calificados, { valor: null, motivo: 'sin_puntaje' }, 'el cliente sin campo recibió un cero de calificados');
  assert.deepEqual(pieza(y, 'pieza296y')?.cifras.calificados, { valor: 10, motivo: null });
  // P 10, Y 10 y la pieza rara 1 (el `100`): la tira suma a los clientes con campo.
  assert.equal(lectura.pantalla.cifras.calificados.valor, 10 + 10 + 1, 'la tira no sumó los calificados de los clientes con campo');

  // Con el foco en un cliente con campo, nada de esto: el aviso de siempre (aquí, sólo el de las piezas chicas).
  const deP = await conOrganizacion(foco(p), () => calidadDelCreativo(30));
  assert.doesNotMatch(deP.aviso ?? '', /puntaje|catálogo/i, 'con un solo cliente con campo, el aviso habló de clientes');
  assert.deepEqual(deP.cuentasSinPuntaje, []);

  // Con ninguno a la vista con campo pero con el foco en uno que no es el principal, o con varios, tampoco el texto de
  // la empresa: «el CRM de esta empresa» no es el suyo, y diría «no tiene campo» de uno cuyo catálogo ni se leyó.
  const deW = await conOrganizacion(foco(w), () => calidadDelCreativo(30));
  const deZ = await conOrganizacion(foco(z), () => calidadDelCreativo(30));
  // Varios a la vista, con la lista de un cliente final: con la organización entera, el foco es uno.
  const deLosDos = await conOrganizacion({ orgId: org, todaLaOrganizacion: false, cuentas: [w, z] }, () => calidadDelCreativo(30));
  assert.deepEqual([deW.campoDeIcp, deZ.campoDeIcp, deLosDos.campoDeIcp], [null, null, null]);
  for (const a of [deW.aviso, deZ.aviso, deLosDos.aviso]) {
    assert.doesNotMatch(a ?? '', /El CRM de esta empresa/, 'con otro cliente a la vista y ninguno con campo, el aviso habló de la empresa');
  }
  assert.match(deW.aviso ?? '', /«Tercera 296» no tiene campo del puntaje[^.]*\. Quien administra la empresa lo elige en Ajustes › Clientes/);
  assert.match(deZ.aviso ?? '', /Todavía no se leyó el catálogo de campos de «Cuarta 296»/, 'sin catálogo se dijo que no hay campo');
  assert.match(deLosDos.aviso ?? '', /Todavía no se leyó el catálogo de campos de «Cuarta 296».*«Tercera 296» no tiene campo del puntaje/);
  // Quién cuenta como «un solo cliente»: el principal solo, también con uno de baja al lado; uno en pausa sí se nombra.
  const nombra = (cuentas: string[]) => conOrganizacion({ orgId: org, todaLaOrganizacion: false, cuentas }, () => seNombranLosClientes());
  assert.deepEqual(
    [await nombra([p]), await nombra([p, deBaja]), await nombra([p, pausada]), await conOrganizacion(foco(w), () => seNombranLosClientes()), await conOrganizacion(org, () => seNombranLosClientes())],
    [false, false, true, true, true],
    'el principal solo, con uno de baja, con uno en pausa, el foco en otro y la empresa entera',
  );
  await admin.query(`delete from negocio.contactos where org_id = $1 and ghl_contact_id like 'c296cre-%'`, [org]);
});

test('la ficha del portal saca del cuestionario el campo elegido, no el «Puntaje | ICP» de al lado', async () => {
  assert.equal((await elegir(y, { carpetas: [{ carpetaId: 'cp296y', grupo: 'calificacion' }] })).estado, 200);
  const id = await contacto(y, 'c296portal', { [X]: '80', [V]: '40', txt296y: 'Sí' });
  const f = await conOrganizacion(org, () => fichaDelLeadDelPortal(id));
  const etiquetas = (f?.cuestionario ?? []).map((c) => c.etiqueta).sort();
  assert.deepEqual(etiquetas, [NOMBRE_DEL_PUNTAJE, 'Respuesta'].sort(), 'el campo elegido apareció como una respuesta del cuestionario');
});

test('la ruta: lee quien ve, elige quien edita, y sólo lo de ese cliente', async () => {
  for (const [i, v] of [['1', '50'], ['2', '140'], ['3', '7']] as const) await contacto(r, `c296r${i}`, { r296n: v });
  await contacto(r, 'c296r4', { r296t: 'x' });

  const visto = await ver(r, tokenMirada);
  assert.equal(visto.estado, 200);
  assert.equal(visto.cuerpo.puedeEditar, false, 'quien sólo ve recibe botones que van a dar 403');
  assert.deepEqual(
    visto.cuerpo.opciones.map((o) => ({ campoId: o.campoId, conValor: o.conValor, usables: o.usables })),
    [{ campoId: 'r296n', conValor: 3, usables: 2 }],
    'las opciones no son los numéricos del cliente con sus conteos',
  );
  assert.deepEqual(visto.cuerpo.carpetas, [{ carpetaId: 'cp296r', nombre: 'Formulario R', grupo: null, elegida: false, campos: 2 }]);
  assert.equal(visto.cuerpo.puntaje.origen, 'ninguno');
  assert.deepEqual(visto.cuerpo.grupos, GRUPOS_DEL_PERFIL);
  const check = await unaFila<{ def: string }>(admin, `select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'carpetas_del_crm_grupo'`);
  assert.deepEqual([...(check?.def.matchAll(/'([a-z]+)'/g) ?? [])].map((m) => m[1]).sort(), GRUPOS_DEL_PERFIL.map((g) => g.clave).sort());

  const sinPermiso = await elegir(r, { puntaje: 'r296n' }, tokenMirada);
  assert.deepEqual([sinPermiso.estado, sinPermiso.cuerpo.codigo], [403, 'sin_permiso'], 'quien sólo ve eligió el puntaje');

  for (const [cuerpo, porque] of [
    [{ puntaje: 'r296t' }, /Texto R.*TEXT/],
    [{ puntaje: Z }, /no está en el catálogo/],
    [{ carpetas: [{ carpetaId: 'cp296y', grupo: null }] }, /no está en el catálogo/],
    [{}, /Nada se guardó/],
    [{ carpetas: [{ carpetaId: 'cp296r', grupo: 'otro' }] }, /grupo/],
  ] as const) {
    const m = await elegir(r, cuerpo);
    assert.deepEqual([m.estado, m.cuerpo.codigo], [400, 'peticion_invalida'], JSON.stringify(cuerpo));
    assert.match(m.cuerpo.detalle ?? '', porque);
  }
  // Todo se valida antes de escribir: un puntaje bueno con una carpeta ajena no deja el puntaje elegido, ni recalculado,
  // ni auditado (el rechazo se devuelve dentro de la transacción: una escritura anterior se commitearía).
  const auditoriaAntes = (await filas(admin, `select 1 from identidad.auditoria_accesos where org_id = $1`, [org])).length;
  const mezcla = await elegir(r, { puntaje: 'r296n', carpetas: [{ carpetaId: 'cp296y', grupo: null }] });
  assert.deepEqual([mezcla.estado, mezcla.cuerpo.codigo], [400, 'peticion_invalida']);
  assert.match(mezcla.cuerpo.detalle ?? '', /«cp296y» no está en el catálogo/);
  const quedo = await unaFila<{ elegidos: number; puntuados: number }>(
    admin,
    `select (select count(*)::int from negocio.campos_del_crm where org_id = $1 and cuenta_id = $2 and es_el_puntaje) as elegidos,
            (select count(*)::int from negocio.contactos where org_id = $1 and cuenta_id = $2 and score is not null) as puntuados`,
    [org, r],
  );
  assert.deepEqual(quedo, { elegidos: 0, puntuados: 0 }, 'una carpeta ajena dejó elegido y recalculado el puntaje que venía con ella');
  assert.equal((await filas(admin, `select 1 from identidad.auditoria_accesos where org_id = $1`, [org])).length, auditoriaAntes, 'se auditó una elección que dio 400');
  for (const id of [deBeta, deBaja, 'no-es-un-id']) {
    assert.equal((await ver(id)).estado, 404, `${id}: un cliente que la sesión no ve`);
    assert.equal((await elegir(id, { puntaje: null })).estado, 404);
  }
  assert.equal((await ver(pausada)).estado, 200, 'un cliente en pausa se sigue configurando');
  assert.equal((await ver(p)).estado, 200, 'el principal dio 409 como en la Conexión');

  const antes = (await filas(admin, `select 1 from identidad.auditoria_accesos where org_id = $1`, [org])).length;
  const e = await elegir(r, { puntaje: 'r296n' });
  assert.deepEqual([e.estado, e.cuerpo.puntaje.origen, e.cuerpo.puntaje.campoId, e.cuerpo.puedeEditar], [200, 'elegido', 'r296n', true]);
  assert.equal((await elegir(r, { puntaje: 'r296n' })).estado, 200);
  const c = await elegir(r, { carpetas: [{ carpetaId: 'cp296r', grupo: 'detalles' }] });
  assert.deepEqual(c.cuerpo.carpetas[0], { carpetaId: 'cp296r', nombre: 'Formulario R', grupo: 'detalles', elegida: true, campos: 2 });
  const vuelta = await elegir(y, { puntaje: null });
  assert.deepEqual([vuelta.cuerpo.puntaje.origen, vuelta.cuerpo.puntaje.campoId], ['por_omision', V], '«sin elegir» no volvió al de su nombre');
  const auditadas = await filas<{ accion: string; detalle: Record<string, unknown> }>(
    admin,
    `select accion, detalle from identidad.auditoria_accesos where org_id = $1 order by id offset $2`,
    [org, antes],
  );
  assert.deepEqual(
    auditadas.map((f) => [f.accion, f.detalle]),
    [
      ['puntaje_elegido', { cuenta: r, campo: 'r296n', objetivo: r }],
      ['carpeta_del_perfil_elegida', { cuenta: r, carpeta: 'cp296r', grupo: 'detalles', objetivo: r }],
      ['puntaje_por_su_nombre', { cuenta: y, objetivo: y }],
    ],
    'la auditoría no tiene cada cambio una vez —el que no cambió nada no cuenta—, o lleva el cuerpo',
  );

  // Lo que dejó de estar: el elegido que no vino en la última lectura, y el que dejó de ser numérico.
  await admin.query(`update negocio.campos_del_crm set visto_el = now() - interval '2 days' where org_id = $1 and campo_id = 'r296n'`, [org]);
  assert.equal((await ver(r)).cuerpo.puntaje.noVistoEnLaUltimaLectura, true, 'el campo elegido que ya no está en el CRM no se avisó');
  await admin.query(`update negocio.campos_del_crm set tipo = 'TEXT', visto_el = now() where org_id = $1 and campo_id = 'r296n'`, [org]);
  const cambiado = await ver(r);
  assert.deepEqual(
    [cambiado.cuerpo.puntaje.yaNoEsNumerico, cambiado.cuerpo.puntaje.noVistoEnLaUltimaLectura],
    [true, false],
  );
  assert.deepEqual(
    cambiado.cuerpo.opciones.map((o) => [o.campoId, o.yaNoEsNumerico]),
    [['r296n', true]],
    'el elegido que dejó de ser numérico no está entre las opciones: el selector lo mostraría «Sin elegir»',
  );

  // Al cambiar la subcuenta, la respuesta lo recuerda: lo elegido era de la anterior.
  const v = await leerRespuesta<{ aviso?: string }>(
    await vincular(pedirComo(`/api/admin/cuentas/${r}/vinculo`, tokenAria, { metodo: 'PATCH', cuerpo: { orgId: org, crmCuentaId: 'loc296r' } }), ctx(r)),
  );
  assert.equal(v.estado, 200);
  assert.match(v.cuerpo.aviso ?? '', /subcuenta anterior/, 'el vínculo nuevo no dijo nada de lo elegido para la anterior');
});
