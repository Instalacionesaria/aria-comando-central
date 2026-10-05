// LAS SEÑALES DE ACQUISITION EN SU PANTALLA: LEER, MARCAR, RESOLVER, VALIDAR Y FIRMAR. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `app/api/acquisition/route.ts` (las señales del GET), `app/api/acquisition/senales/route.ts` y
// `app/api/acquisition/umbrales/route.ts` (AG9 de los agentes; `docs/OTROS/agentes/02-EL-CONTRATO-DE-SENALES.md`,
// AG-24, AG-25 y AG-33; `05`, AG-80 y AG-82), con la regla 31: una ruta nueva nace con su prueba de base.
//
//   · El GET trae las señales vivas de la ventana elegida, con el nombre de la campaña resuelto; con «hoy» no
//     hay ventana. Y dice qué puede hacer la sesión.
//   · «Vista» la marca la primera persona; resolver y descartar piden motivo, y una cerrada no se vuelve a
//     cerrar. El id de una señal de otro departamento da 404.
//   · Lo que requiere validación ejecutiva no lo cierra un `usuario`; sí el administrador.
//   · Firmar un umbral: el Admin, con su auditoría; el `usuario`, no; una regla ajena o un valor raro, 400.
//   · Bajo delegación no se marca, no se resuelve y no se firma.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes, conIdentidad } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { hashDeToken } from '../../lib/autorizacion/sesion.ts';
import { leerRespuesta, montar, pedirComo, sesionDe, type Escenario } from '../apoyo/closer.ts';
import { GET as leerAcquisition } from '../../app/api/acquisition/route.ts';
import { POST as decidir } from '../../app/api/acquisition/senales/route.ts';
import { PUT as firmar } from '../../app/api/acquisition/umbrales/route.ts';
import { reconciliarSenales } from '../../lib/agentes/senales/escritura.ts';
import type { Deteccion } from '../../lib/agentes/senales/tipos.ts';
import { ACQ } from '../../lib/agentes/detectores/acquisition.ts';

const CAMPANA = '120299990000000224';
const NOMBRE_DE_PERSONA = 'Persona de la 224';
let esc: Escenario;
const sesionesPropias: string[] = [];

async function limpiar(): Promise<void> {
  await esc.admin.query('delete from negocio.senales where org_id = $1', [esc.org]);
  await esc.admin.query('delete from negocio.planes_de_accion where org_id = $1', [esc.org]);
  await esc.admin.query('delete from negocio.umbrales where org_id = $1', [esc.org]);
  await esc.admin.query('delete from negocio.campanas where org_id = $1 and meta_campana_id = $2', [esc.org, CAMPANA]);
  await esc.admin.query('delete from identidad.usuarios where nombre = $1', [NOMBRE_DE_PERSONA]);
  for (const t of sesionesPropias.splice(0)) await esc.admin.query('delete from identidad.sesiones where token_hash = $1', [hashDeToken(t)]);
}

before(async () => {
  esc = await montar('Senales224');
});
beforeEach(limpiar);
after(async () => {
  await limpiar();
  await cerrarClientes();
  await cerrarTodo();
});

function deteccion(regla: string, entidad: Deteccion['entidad'], cambios: Partial<Deteccion> = {}): Deteccion {
  return {
    regla,
    entidad,
    metrica: 'costo_por_contacto',
    lineaBase: 50,
    valorActual: 70,
    cambioPct: 0.4,
    muestra: 14,
    periodo: { desde: '2026-09-05', hasta: '2026-10-04' },
    datosDesde: null,
    gravedad: 'media',
    causasPosibles: ['puede deberse a la fatiga del creativo'],
    revisionRecomendada: 'Revisa la campaña.',
    perdidaContactos: 4,
    destino: null,
    requiereValidacionEjecutiva: false,
    umbral: { valor: 0.3, provisional: true },
    evidencia: { campana: CAMPANA },
    ...cambios,
  };
}

/** Dos señales de Acquisition en 30 días —una local y una de validación ejecutiva— y una de Creative. */
async function sembrar(): Promise<{ local: string; ejecutiva: string; deCreative: string }> {
  await esc.admin.query(`insert into negocio.campanas (org_id, meta_campana_id, nombre, estado) values ($1, $2, 'Campaña de la 224', 'ACTIVE')`, [esc.org, CAMPANA]);
  await conOrganizacion(esc.org, async () => {
    await reconciliarSenales({
      departamento: 'acquisition',
      detector: 'acquisition',
      ventana: '30d',
      detecciones: [
        deteccion(ACQ.cplSostenido, { tipo: 'campana', id: CAMPANA }),
        deteccion(ACQ.concentracion, { tipo: 'campana', id: 'otra' }, { requiereValidacionEjecutiva: true, muestra: null, valorActual: 0.7, perdidaContactos: null }),
      ],
      sinMedicion: [],
    });
    await reconciliarSenales({
      departamento: 'creative',
      detector: 'creative',
      ventana: '30d',
      detecciones: [deteccion('CRE-PRUEBA-224', { tipo: 'pieza', id: 'p1' })],
      sinMedicion: [],
    });
  });
  const id = async (regla: string) =>
    (await esc.admin.query<{ id: string }>('select id from negocio.senales where org_id = $1 and regla = $2', [esc.org, regla])).rows[0]!.id;
  return { local: await id(ACQ.cplSostenido), ejecutiva: await id(ACQ.concentracion), deCreative: await id('CRE-PRUEBA-224') };
}

const accion = (cuerpo: unknown, token = esc.token) => decidir(pedirComo('/api/acquisition/senales', token, { metodo: 'POST', cuerpo }));
const fila = async (id: string) =>
  (await esc.admin.query<{ estado: string; vista_por: string | null; cerrada_por: string | null; motivo_cierre: string | null }>(
    'select estado, vista_por, cerrada_por, motivo_cierre from negocio.senales where id = $1',
    [id],
  )).rows[0]!;

/** Una persona de `alfa` con el rol `usuario` y la pestaña de Acquisition. */
async function usuarioComun(): Promise<string> {
  const r = await esc.admin.query<{ id: string }>(
    `insert into identidad.usuarios (org_id, nombre, email, password_hash) values ($1, $2, $3, 'scrypt$16384$8$1$aaaa$bbbb') returning id`,
    [esc.org, NOMBRE_DE_PERSONA, `senales-224-${randomUUID().slice(0, 8)}@alfa.ejemplo`],
  );
  const id = r.rows[0]!.id;
  await esc.admin.query(`insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = 'usuario' and org_id is null`, [id]);
  await esc.admin.query(`insert into identidad.usuarios_secciones (usuario_id, seccion) values ($1, 'acquisition')`, [id]);
  const token = await sesionDe(id);
  sesionesPropias.push(token);
  return token;
}

/** La fundadora de ARIA mirando `alfa`: bajo delegación. */
async function bajoDelegacion(): Promise<string> {
  const fundadora = (await esc.admin.query<{ id: string }>(`select id from identidad.usuarios where email = 'fundadora@principal.ejemplo'`)).rows[0]!.id;
  const token = randomBytes(32).toString('base64url');
  sesionesPropias.push(token);
  await conIdentidad(async (db) => {
    await db
      .insertInto('sesiones')
      .values({
        usuario_id: fundadora,
        token_hash: hashDeToken(token),
        estado: 'activa',
        org_activa: esc.org,
        expira_el: sql<Date>`now() + interval '7 days'`,
        expira_absoluto: sql<Date>`now() + interval '30 days'`,
      })
      .execute();
  });
  return token;
}

test('el GET trae las señales vivas de la ventana, con el nombre resuelto; con «hoy», ninguna', async () => {
  await sembrar();
  const r = await leerRespuesta<{
    senales: { ventana: string | null; estado: string; lista: { regla: string; nombre: string | null; texto: string; umbral: { provisional: boolean } }[]; reglas: { codigo: string }[] };
    puedeConSenales: Record<string, boolean>;
  }>(await leerAcquisition(pedirComo('/api/acquisition?periodo=30d', esc.token)));
  assert.equal(r.estado, 200);
  assert.equal(r.cuerpo.senales.ventana, '30d');
  // Sólo Acquisition: la de Creative no viaja. Primero la que pierde gente.
  assert.deepEqual(r.cuerpo.senales.lista.map((s) => [s.regla, s.nombre]), [[ACQ.cplSostenido, 'Campaña de la 224'], [ACQ.concentracion, null]]);
  assert.equal(r.cuerpo.senales.lista[0]!.texto, 'El costo por contacto subió 40 % contra los 30 días anteriores: de 50 a 70, sobre 14 contactos.');
  assert.equal(r.cuerpo.senales.lista[0]!.umbral.provisional, true);
  assert.equal(r.cuerpo.senales.estado, 'warn');
  assert.ok(r.cuerpo.senales.reglas.some((x) => x.codigo === ACQ.sinEntrega));
  assert.deepEqual(r.cuerpo.puedeConSenales, { resolver: true, validar: true, firmar: true });

  const hoy = await leerRespuesta<{ senales: { ventana: string | null; lista: unknown[] } }>(await leerAcquisition(pedirComo('/api/acquisition?periodo=hoy', esc.token)));
  assert.deepEqual([hoy.cuerpo.senales.ventana, hoy.cuerpo.senales.lista], [null, []]);
});

test('«vista» la marca la primera persona; resolver pide motivo, y una cerrada no se vuelve a cerrar', async () => {
  const { local, deCreative } = await sembrar();
  assert.equal((await accion({ id: local, accion: 'vista' })).status, 200);
  assert.deepEqual([(await fila(local)).estado, (await fila(local)).vista_por], ['vista', esc.quien]);
  // Otra vez: no cambia nada y no falla.
  assert.equal((await accion({ id: local, accion: 'vista' })).status, 200);

  assert.equal((await accion({ id: local, accion: 'resolver' })).status, 400, 'se resolvió sin motivo');
  assert.equal((await accion({ id: local, accion: 'resolver', motivo: '  ' })).status, 400);
  assert.equal((await accion({ id: local, accion: 'resolver', motivo: 'Pausamos la campaña.' })).status, 200);
  const cerrada = await fila(local);
  assert.deepEqual([cerrada.estado, cerrada.cerrada_por, cerrada.motivo_cierre], ['resuelta', esc.quien, 'Pausamos la campaña.']);
  const otraVez = await leerRespuesta<{ codigo: string }>(await accion({ id: local, accion: 'descartar', motivo: 'Ya no.' }));
  assert.deepEqual([otraVez.estado, otraVez.cuerpo.codigo], [409, 'senal_cerrada']);

  // El id de una señal de Creative, por la ruta de Acquisition: no existe para ella.
  assert.equal((await accion({ id: deCreative, accion: 'descartar', motivo: 'x' })).status, 404);
  assert.equal((await fila(deCreative)).estado, 'abierta');
  assert.equal((await accion({ id: randomUUID(), accion: 'vista' })).status, 404);
  assert.equal((await accion({ id: local, accion: 'borrar' })).status, 400);
});

test('lo que requiere validación ejecutiva no lo cierra un `usuario`; sí el administrador', async () => {
  const { local, ejecutiva } = await sembrar();
  const comun = await usuarioComun();
  const negada = await leerRespuesta<{ codigo: string }>(await accion({ id: ejecutiva, accion: 'descartar', motivo: 'No aplica.' }, comun));
  assert.deepEqual([negada.estado, negada.cuerpo.codigo], [403, 'sin_permiso']);
  assert.equal((await fila(ejecutiva)).estado, 'abierta');
  // La local, sí, y marcarla vista también.
  assert.equal((await accion({ id: local, accion: 'vista' }, comun)).status, 200);
  assert.equal((await accion({ id: local, accion: 'descartar', motivo: 'Ya lo sabemos.' }, comun)).status, 200);
  // El administrador valida.
  assert.equal((await accion({ id: ejecutiva, accion: 'resolver', motivo: 'Lo decidió la dirección.' })).status, 200);
  assert.equal((await fila(ejecutiva)).estado, 'resuelta');
  // Y el GET le dice al `usuario` lo que puede.
  const r = await leerRespuesta<{ puedeConSenales: Record<string, boolean> }>(await leerAcquisition(pedirComo('/api/acquisition?periodo=30d', comun)));
  assert.deepEqual(r.cuerpo.puedeConSenales, { resolver: true, validar: false, firmar: false });
});

test('firmar un umbral: el Admin, con su auditoría; el `usuario`, no; una regla ajena o un valor raro, 400', async () => {
  const firma = (cuerpo: unknown, token = esc.token) => firmar(pedirComo('/api/acquisition/umbrales', token, { metodo: 'PUT', cuerpo }));
  // La auditoría es de sólo inserción: se cuenta la diferencia, no las filas.
  const firmasAuditadas = async () =>
    Number(
      (await esc.admin.query<{ n: string }>(
        `select count(*)::text as n from identidad.auditoria_accesos where accion = 'umbral_firmado' and detalle->>'regla' = $1 and detalle->>'objetivo' = $2`,
        [ACQ.cplSostenido, esc.org],
      )).rows[0]!.n,
    );
  const antes = await firmasAuditadas();
  const r = await leerRespuesta<{ reglas: { codigo: string; valor: number; provisional: boolean }[] }>(await firma({ regla: ACQ.cplSostenido, valor: 0.25 }));
  assert.equal(r.estado, 200);
  assert.deepEqual(r.cuerpo.reglas.find((x) => x.codigo === ACQ.cplSostenido), {
    ...r.cuerpo.reglas.find((x) => x.codigo === ACQ.cplSostenido),
    valor: 0.25,
    provisional: false,
  });
  const guardada = (await esc.admin.query<{ valor: string; firmado_por: string }>('select valor, firmado_por from negocio.umbrales where org_id = $1', [esc.org])).rows;
  assert.deepEqual(guardada.map((g) => [Number(g.valor), g.firmado_por]), [[0.25, esc.quien]]);
  assert.equal(await firmasAuditadas(), antes + 1);

  assert.equal((await firma({ regla: ACQ.cplSostenido, valor: 0.2 }, await usuarioComun())).status, 403);
  assert.equal((await firma({ regla: 'CRE-ALGO', valor: 0.2 })).status, 400);
  assert.equal((await firma({ regla: ACQ.cplSostenido, valor: 0 })).status, 400);
  assert.equal((await firma({ regla: ACQ.cplSostenido, valor: '0.2' })).status, 400);
});

test('bajo delegación no se marca, no se resuelve y no se firma', async () => {
  const { local } = await sembrar();
  const token = await bajoDelegacion();
  const vista = await leerRespuesta<{ codigo: string }>(await accion({ id: local, accion: 'vista' }, token));
  assert.deepEqual([vista.estado, vista.cuerpo.codigo], [409, 'senales_bajo_delegacion']);
  assert.equal((await accion({ id: local, accion: 'resolver', motivo: 'x' }, token)).status, 409);
  assert.equal((await firmar(pedirComo('/api/acquisition/umbrales', token, { metodo: 'PUT', cuerpo: { regla: ACQ.cplSostenido, valor: 0.2 } }))).status, 409);
  assert.equal((await fila(local)).estado, 'abierta');
  // Leer, sí; y el GET dice que no puede.
  const r = await leerRespuesta<{ puedeConSenales: Record<string, boolean> }>(await leerAcquisition(pedirComo('/api/acquisition?periodo=30d', token)));
  assert.deepEqual(r.cuerpo.puedeConSenales, { resolver: false, validar: false, firmar: false });
});
