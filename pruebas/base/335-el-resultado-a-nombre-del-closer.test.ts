// El resultado a nombre del closer (la `107`, la fase 2 del selector de closer). Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE ARCHIVO CUIDA
//
// Medido en producción el 2026-10-29: de los tres closers sólo entra el administrador, que además es closer. Las
// ventas de los otros dos, si alguien las registra, las registra él, y hasta la `107` quedaban a SU nombre: su
// comisión subía y la de ellos quedaba en cero, sin que nada fallara. Ahora quien supervisa (`credenciales.editar`)
// registra a nombre del closer elegido, y las métricas leen `coalesce(closer_id, registrado_por)`.
//
// Las dos formas de romperlo, y ninguna da error:
//   · **de más** — un closer `usuario` manda `aNombreDe` a mano y se acredita a otro (o se lo quita a sí mismo);
//   · **de menos** — se escribe `closer_id` y una métrica sigue leyendo `registrado_por`: la venta vuelve a quien la
//     cargó en esa pantalla, y en las otras no.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import {
  leerRespuesta,
  limpiar as limpiarContactos,
  montar,
  pedirComo,
  sesionDe,
  unContacto,
  type Escenario,
} from '../apoyo/closer.ts';
import { asignarCloser } from '../../lib/negocio/closer.ts';
import { comisionDelMes } from '../../lib/negocio/comision.ts';
import { dineroDelMes } from '../../lib/negocio/dineroDelMes.ts';
import { cierrePorCloser } from '../../lib/negocio/cierrePorCloser.ts';
import { motivosDeNoVenta } from '../../lib/negocio/motivosDeNoVenta.ts';
import { closersDeLaEmpresa } from '../../lib/negocio/alcanceDelCloser.ts';
import { aNombreDeQuien, closerDeLaAsignacion } from '../../lib/negocio/aNombreDelCloser.ts';
import { POST as avanzar } from '../../app/api/contactos/[id]/avanzar/route.ts';
import { GET as verContacto } from '../../app/api/contactos/[id]/route.ts';
import { GET as verMiDia } from '../../app/api/closer/mi-dia/route.ts';

let esc: Escenario;

const CRM_DOS = 'crmANombreDos';
const CRM_K = 'crmANombreK';

before(async () => {
  esc = await montar('ANombre');
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

/* Los resultados de los contactos marcados primero (los sostienen las dos claves foráneas a las personas), después
   las designaciones y por último las personas. La auditoría no se borra: es de sólo inserción, y no tiene clave
   foránea a la persona. */
async function limpiar(): Promise<void> {
  await limpiarContactos(esc);
  await esc.admin.query('delete from negocio.closer_asignado where org_id = $1', [esc.org]);
  await esc.admin.query("delete from identidad.usuarios where email like '%@anombre.ejemplo'");
}

/** Una persona real de `alfa` (la clave foránea compuesta de `closer_asignado` y de `closer_id` lo exige). */
async function unaPersona(nombre: string): Promise<string> {
  const { rows } = await esc.admin.query<{ id: string }>(
    `insert into identidad.usuarios (org_id, nombre, email, password_hash, creado_por)
     values ($1, $2, $3, 'scrypt$16384$8$1$c2FsCg==$aGFzaAo=', null) returning id`,
    [esc.org, `${esc.marca} ${nombre}`, `${nombre.toLowerCase()}@anombre.ejemplo`],
  );
  return rows[0]!.id;
}

/** Un closer `usuario` de verdad: rol `usuario`, la sección `closer` y una sesión. Como los dos de producción. */
async function unCloserUsuario(nombre: string): Promise<{ id: string; token: string }> {
  const id = await unaPersona(nombre);
  await esc.admin.query(
    `insert into identidad.usuarios_roles (usuario_id, rol_id, asignado_por)
     select $1, id, null from identidad.roles where clave = 'usuario'`,
    [id],
  );
  await esc.admin.query(
    `insert into identidad.usuarios_secciones (usuario_id, seccion, concedida_por) values ($1, 'closer', null)`,
    [id],
  );
  return { id, token: await sesionDe(id) };
}

/** El escenario: ana supervisa (administradora, no closer); `dos` es closer vinculado; `k` es closer `usuario`. */
async function escenario(): Promise<{ dos: string; k: { id: string; token: string } }> {
  await limpiar();
  const dos = await unaPersona('Dos');
  const k = await unCloserUsuario('Kappa');
  await conOrganizacion(esc.org, async () => {
    await asignarCloser(dos, CRM_DOS, esc.quien, esc.principal);
    await asignarCloser(k.id, CRM_K, esc.quien, esc.principal);
  });
  return { dos, k };
}

const ctxDe = (id: string) => ({ params: Promise.resolve({ id }) });

interface Respuesta {
  registrado?: boolean;
  aNombreDe?: string | null;
  yaEstaba?: boolean;
  codigo?: string;
  detalle?: string;
}

async function registrar(
  token: string,
  contactoId: string,
  cuerpo: Record<string, unknown>,
): Promise<{ estado: number; cuerpo: Respuesta }> {
  const r = await avanzar(
    pedirComo(`/api/contactos/${contactoId}/avanzar`, token, {
      metodo: 'POST',
      cuerpo: { claveDeIntento: randomUUID(), salida: 'venta', monto: 1500, ...cuerpo },
    }),
    ctxDe(contactoId),
  );
  return leerRespuesta<Respuesta>(r);
}

/** Lo escrito para un contacto: las filas de `resultados` con sus dos personas. */
async function filasDe(contactoId: string) {
  return conOrganizacion(esc.org, () =>
    datos()
      .selectFrom('resultados')
      .select(['registrado_por', 'closer_id', 'salida', 'monto'])
      .where('contacto_id', '=', contactoId)
      .execute(),
  );
}

/** Las filas de auditoría `resultado_registrado` de un contacto. */
async function auditoriaDe(contactoId: string) {
  const { rows } = await esc.admin.query<{ usuario_id: string; org_id: string; detalle: Record<string, unknown> }>(
    `select usuario_id, org_id, detalle from identidad.auditoria_accesos
      where accion = 'resultado_registrado' and detalle->>'contacto' = $1`,
    [contactoId],
  );
  return rows;
}

// ═══════════════════════════════════════════════════════════════════════════════

test('quien supervisa registra A NOMBRE del closer elegido: closer_id, la auditoría y las cifras van al closer', async () => {
  const { dos, k } = await escenario();
  // Un contacto del OTRO closer: lo elegido manda, no el dueño del contacto.
  const contacto = await unContacto(esc, { nombre: 'ANombre venta', crmAsignadoA: CRM_K });

  const r = await registrar(esc.token, contacto.id, { aNombreDe: dos });
  assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
  assert.equal(r.cuerpo.aNombreDe, dos, 'la respuesta no dice a nombre de quién quedó');

  const filas = await filasDe(contacto.id);
  assert.equal(filas.length, 1);
  assert.equal(filas[0]!.closer_id, dos, '`closer_id` no es el closer elegido');
  assert.equal(filas[0]!.registrado_por, esc.quien, '`registrado_por` dejó de ser quien registró de verdad');

  const audit = await auditoriaDe(contacto.id);
  assert.equal(audit.length, 1, 'registrar a nombre de otro no dejó su fila de auditoría');
  assert.equal(audit[0]!.usuario_id, esc.quien, 'la auditoría no dice quién lo registró');
  assert.equal(audit[0]!.org_id, esc.org);
  assert.equal(audit[0]!.detalle.closer, dos, 'la auditoría no dice a nombre de quién');
  assert.equal(Number(audit[0]!.detalle.monto), 1500);
  assert.equal(audit[0]!.detalle.salida, 'venta');

  // Las cifras: la comisión, el cobrado de Inicio y la tabla de Sales son de `dos`, y de nadie más.
  const [deDos, deAna, deK, dinero, cierre] = await conOrganizacion(esc.org, async () => {
    const closers = await closersDeLaEmpresa();
    const vinculosDeDos = closers.find((c) => c.usuarioId === dos)!.vinculos;
    return [
      await comisionDelMes(dos, 'UTC'),
      await comisionDelMes(esc.quien, 'UTC'),
      await comisionDelMes(k.id, 'UTC'),
      await dineroDelMes('UTC', { tipo: 'persona', usuarioId: dos, vinculos: vinculosDeDos }),
      await cierrePorCloser(14, closers),
    ] as const;
  });
  assert.equal(deDos.base, 1500, 'la comisión del closer elegido no cuenta la venta registrada a su nombre');
  assert.equal(deDos.ventas, 1);
  assert.equal(deAna.base, null, 'la venta registrada a nombre de otro sigue sumando en la comisión de quien la cargó');
  assert.equal(deK.base, null, 'la venta fue al dueño del contacto y no al closer elegido');
  assert.equal(dinero.cobrado.valor, 1500, 'el cobrado de Inicio del closer elegido no cuenta su venta');
  const filaDeDos = cierre.filas.find((f) => f.usuarioId === dos)!;
  assert.equal(filaDeDos.ventas, 1, 'la tabla de closers de Sales no le acredita la venta al closer elegido');
  assert.equal(filaDeDos.montoDeVentas, 1500);
  assert.equal(cierre.filas.find((f) => f.usuarioId === k.id)!.ventas, 0);
});

test('los motivos de no venta también son del closer elegido, no de quien supervisa', async () => {
  const { dos } = await escenario();
  const contacto = await unContacto(esc, { nombre: 'ANombre no interesa', crmAsignadoA: CRM_DOS });
  const r = await registrar(esc.token, contacto.id, { salida: 'no_interesa', monto: undefined, aNombreDe: dos });
  assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
  // `ana` no es closer: con el eje viejo (`registrado_por`) la fila no sería de ningún closer y no contaría.
  const motivos = await conOrganizacion(esc.org, async () => motivosDeNoVenta(14, await closersDeLaEmpresa()));
  assert.equal(motivos.total, 1, 'un «no le interesa» registrado a nombre de un closer no cuenta en sus motivos');
});

test('reintentar con la misma clave no escribe otra fila, ni otra auditoría, ni cambia a nombre de quién', async () => {
  const { dos, k } = await escenario();
  const contacto = await unContacto(esc, { nombre: 'ANombre reintento', crmAsignadoA: CRM_DOS });
  const clave = randomUUID();

  const primero = await registrar(esc.token, contacto.id, { claveDeIntento: clave, aNombreDe: dos });
  assert.equal(primero.estado, 201, JSON.stringify(primero.cuerpo));
  // El reintento llega pidiendo OTRO closer: la fila que ya estaba manda.
  const segundo = await registrar(esc.token, contacto.id, { claveDeIntento: clave, aNombreDe: k.id });
  assert.equal(segundo.estado, 200, JSON.stringify(segundo.cuerpo));
  assert.equal(segundo.cuerpo.yaEstaba, true);
  assert.equal(segundo.cuerpo.aNombreDe, dos, 'el reintento dice otro closer que el que quedó en la fila');

  const filas = await filasDe(contacto.id);
  assert.equal(filas.length, 1, 'el reintento escribió un segundo resultado');
  assert.equal(filas[0]!.closer_id, dos, 'el reintento cambió a nombre de quién quedó');
  assert.equal((await auditoriaDe(contacto.id)).length, 1, 'el reintento dejó una segunda fila de auditoría');
});

test('un closer `usuario` registra a SU nombre y no puede registrar a nombre de otro (403, sin escribir nada)', async () => {
  const { dos, k } = await escenario();
  const contacto = await unContacto(esc, { nombre: 'ANombre de kappa', crmAsignadoA: CRM_K });

  const ajeno = await registrar(k.token, contacto.id, { aNombreDe: dos });
  assert.equal(ajeno.estado, 403, JSON.stringify(ajeno.cuerpo));
  assert.equal(ajeno.cuerpo.codigo, 'sin_permiso');
  assert.match(ajeno.cuerpo.detalle ?? '', /supervisa/, 'el 403 no es el de «a nombre de»: puede ser que le falte la capacidad de Avanzar');
  assert.equal((await filasDe(contacto.id)).length, 0, 'el rechazo escribió el resultado igual');
  assert.equal((await auditoriaDe(contacto.id)).length, 0);

  // Sin pedir nada, a su nombre; y pedirse a sí mismo es lo mismo.
  const propio = await registrar(k.token, contacto.id, {});
  assert.equal(propio.estado, 201, JSON.stringify(propio.cuerpo));
  const otro = await unContacto(esc, { nombre: 'ANombre de kappa dos', crmAsignadoA: CRM_K });
  assert.equal((await registrar(k.token, otro.id, { aNombreDe: k.id })).estado, 201);
  assert.equal((await filasDe(contacto.id))[0]!.closer_id, k.id, 'el closer `usuario` no quedó como el acreditado de lo suyo');
  assert.equal((await filasDe(otro.id))[0]!.closer_id, k.id);
});

test('a nombre de alguien que no es closer vinculado de esta empresa: 400 y nada escrito', async () => {
  const { dos } = await escenario();
  const contacto = await unContacto(esc, { nombre: 'ANombre ajeno', crmAsignadoA: CRM_DOS });

  // Un closer real de `beta`, vinculado allá: existe y es closer, pero no de esta empresa.
  const deBeta = await esc.admin.query<{ id: string; cuenta: string }>(
    `select u.id, (select c.id from identidad.cuentas c where c.org_id = u.org_id and c.es_por_omision) as cuenta
       from identidad.usuarios u where u.org_id = $1 order by u.creado_el limit 1`,
    [esc.otraOrg],
  );
  const beta = deBeta.rows[0]!;
  assert.ok(beta?.id && beta.cuenta, 'el sembrado no tiene una persona y un cliente en `beta`');
  await conOrganizacion(esc.otraOrg, () => asignarCloser(beta.id, CRM_DOS, beta.id, beta.cuenta));
  // Una persona de `alfa` que no es closer, y un closer designado SIN vincular.
  const noCloser = await unaPersona('Nadie');
  const sinVinculo = await unaPersona('Suelto');
  await conOrganizacion(esc.org, () => asignarCloser(sinVinculo, null, esc.quien, esc.principal));
  try {
    for (const [pedido, quien] of [
      [beta.id, 'un closer de otra empresa'],
      [noCloser, 'alguien que no es closer'],
      [sinVinculo, 'un closer sin vincular'],
      [randomUUID(), 'un identificador que no existe'],
    ] as const) {
      const r = await registrar(esc.token, contacto.id, { aNombreDe: pedido });
      assert.equal(r.estado, 400, `se registró a nombre de ${quien}: ${JSON.stringify(r.cuerpo)}`);
      assert.match(r.cuerpo.detalle ?? '', /closer vinculado de esta empresa/);
    }
    assert.equal((await registrar(esc.token, contacto.id, { aNombreDe: 'no-es-un-uuid' })).estado, 400);
    assert.equal((await filasDe(contacto.id)).length, 0, 'un rechazo escribió el resultado igual');
    assert.equal((await auditoriaDe(contacto.id)).length, 0);
    // Y el bueno sí pasa: el 400 era por la persona, no por el contacto.
    assert.equal((await registrar(esc.token, contacto.id, { aNombreDe: dos })).estado, 201);
  } finally {
    await esc.admin.query('delete from negocio.closer_asignado where org_id = $1 and usuario_id = $2', [esc.otraOrg, beta.id]);
  }
});

test('quien supervisa sin elegir: al closer asignado al contacto, y sin closer, a quien registra', async () => {
  const { dos } = await escenario();
  const deDos = await unContacto(esc, { nombre: 'ANombre de dos', crmAsignadoA: CRM_DOS });
  const sinAsignar = await unContacto(esc, { nombre: 'ANombre sin asignar', crmAsignadoA: null });

  const a = await registrar(esc.token, deDos.id, {});
  assert.equal(a.estado, 201, JSON.stringify(a.cuerpo));
  assert.equal((await filasDe(deDos.id))[0]!.closer_id, dos, 'sin elegir, la venta no fue al closer del contacto');

  const b = await registrar(esc.token, sinAsignar.id, { monto: 700 });
  assert.equal(b.estado, 201, JSON.stringify(b.cuerpo));
  assert.equal((await filasDe(sinAsignar.id))[0]!.closer_id, null);
  assert.equal(b.cuerpo.aNombreDe, null);
  // Sin closer, cuenta para quien registra: `coalesce(closer_id, registrado_por)`, como antes de la 107.
  const deAna = await conOrganizacion(esc.org, () => comisionDelMes(esc.quien, 'UTC'));
  assert.equal(deAna.base, 700, 'una fila sin closer dejó de acreditarse a quien la registró');

  // La ficha dice lo mismo que la ruta va a hacer: el closer del contacto, o nadie.
  const ficha = async (id: string) =>
    (await leerRespuesta<{ closerAsignado: { usuarioId: string; nombre: string } | null }>(
      await verContacto(pedirComo(`/api/contactos/${id}`, esc.token), ctxDe(id)),
    )).cuerpo.closerAsignado;
  assert.deepEqual(await ficha(deDos.id), { usuarioId: dos, nombre: `${esc.marca} Dos` });
  assert.equal(await ficha(sinAsignar.id), null);
});

test('un contacto del setter no se acredita a ningún closer', async () => {
  const { dos } = await escenario();
  const delSetter = await unContacto(esc, { nombre: 'ANombre setter', territorio: 'setter', crmAsignadoA: CRM_DOS });
  const r = await registrar(esc.token, delSetter.id, { salida: 'nurture', monto: undefined, aNombreDe: dos });
  assert.equal(r.estado, 400, JSON.stringify(r.cuerpo));
  assert.match(r.cuerpo.detalle ?? '', /setter/);
  const sin = await registrar(esc.token, delSetter.id, { salida: 'nurture', monto: undefined });
  assert.equal(sin.estado, 201, JSON.stringify(sin.cuerpo));
  assert.equal((await filasDe(delSetter.id))[0]!.closer_id, null, 'un resultado del setter quedó acreditado a un closer');
});

test('Mi Día le dice a la pantalla quién puede registrar a nombre de otro: la misma regla que la ruta', async () => {
  const { k } = await escenario();
  const de = async (token: string) =>
    (await leerRespuesta<{ puedeRegistrarANombre: boolean }>(await verMiDia(pedirComo('/api/closer/mi-dia', token)))).cuerpo
      .puedeRegistrarANombre;
  assert.equal(await de(esc.token), true, 'a quien supervisa no se le ofrece registrar a nombre del closer');
  assert.equal(await de(k.token), false, 'a un closer `usuario` se le ofrece registrar a nombre de otro');
});

test('la regla, pura: a su nombre siempre; otro sólo supervisando y con vínculo a la vista', () => {
  const v = [{ cuentaId: 'c', crmUsuarioId: 'u' }];
  const dos = { usuarioId: 'dos', nombre: 'Dos', vinculos: v, vinculosALaVista: v, actualizadoEl: new Date() };
  const fuera = { ...dos, usuarioId: 'fuera', vinculosALaVista: [] };
  const base = { registrador: 'ana', closers: [dos, fuera], delContacto: null };
  assert.deepEqual(aNombreDeQuien({ ...base, supervisa: false, pedido: null }), { tipo: 'listo', closerId: 'ana' });
  assert.deepEqual(aNombreDeQuien({ ...base, supervisa: false, pedido: 'dos' }), { tipo: 'sin_permiso' });
  assert.deepEqual(aNombreDeQuien({ ...base, supervisa: true, pedido: 'ana' }), { tipo: 'listo', closerId: 'ana' });
  assert.deepEqual(aNombreDeQuien({ ...base, supervisa: true, pedido: 'dos' }), { tipo: 'listo', closerId: 'dos' });
  assert.deepEqual(aNombreDeQuien({ ...base, supervisa: true, pedido: 'fuera' }), { tipo: 'closer_ajeno' });
  assert.deepEqual(aNombreDeQuien({ ...base, supervisa: true, pedido: null }), { tipo: 'listo', closerId: null });
  assert.deepEqual(aNombreDeQuien({ ...base, supervisa: true, pedido: null, delContacto: dos }), { tipo: 'listo', closerId: 'dos' });
});

test('el closer del contacto sale del PAR (cliente, usuario del CRM), no del usuario del CRM solo', () => {
  /* El mismo usuario del CRM en dos clientes —un usuario de la agencia— puede ser de dos closers (el nivel 3). Con
     el usuario del CRM solo, la venta de un contacto del cliente B se acreditaba al closer de A, sin ningún error. */
  const deA = { cuentaId: 'A', crmUsuarioId: 'agencia' };
  const deB = { cuentaId: 'B', crmUsuarioId: 'agencia' };
  const uno = { usuarioId: 'uno', nombre: 'Uno', vinculos: [deA], vinculosALaVista: [deA], actualizadoEl: new Date() };
  const otro = { usuarioId: 'otro', nombre: 'Otro', vinculos: [deB], vinculosALaVista: [deB], actualizadoEl: new Date() };
  assert.equal(closerDeLaAsignacion('B', 'agencia', [uno, otro])?.usuarioId, 'otro', 'se acreditó al closer del otro cliente');
  assert.equal(closerDeLaAsignacion('A', 'agencia', [uno, otro])?.usuarioId, 'uno');
  assert.equal(closerDeLaAsignacion('C', 'agencia', [uno, otro]), null, 'un cliente sin vínculo tomó el closer de otro');
  assert.equal(closerDeLaAsignacion('A', null, [uno, otro]), null);
});
