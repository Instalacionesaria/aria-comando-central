// LAS SEÑALES DE CREATIVE EN SU PANTALLA: LEER, MARCAR, RESOLVER, VALIDAR Y FIRMAR. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `app/api/creative/route.ts` (las señales del GET), `app/api/creative/senales/route.ts` y
// `app/api/creative/umbrales/route.ts` (AG10 de los agentes), con la regla 31: una ruta nueva nace con su prueba
// de base. Son las gemelas de las de Acquisition (la 224 las prueba a fondo); acá, lo que cambia entre las dos:
//
//   · el GET de Creative trae sólo las señales de Creative, con la frase de su plan y el nombre de la pieza;
//   · el id de una señal de Acquisition, por la ruta de Creative, da 404;
//   · la concentración del gasto en una pieza requiere validación: un `usuario` de Creative no la cierra;
//   · se firman las reglas de Creative y no las de Acquisition;
//   · bajo delegación no se escribe nada.
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
import { GET as leerCreative } from '../../app/api/creative/route.ts';
import { POST as decidir } from '../../app/api/creative/senales/route.ts';
import { PUT as firmar } from '../../app/api/creative/umbrales/route.ts';
import { reconciliarSenales } from '../../lib/agentes/senales/escritura.ts';
import type { Deteccion } from '../../lib/agentes/senales/tipos.ts';
import { CRE } from '../../lib/agentes/detectores/creative.ts';
import { ACQ } from '../../lib/agentes/detectores/acquisition.ts';

const NOMBRE_DE_PERSONA = 'Persona de la 228';
let esc: Escenario;
const sesionesPropias: string[] = [];

async function limpiar(): Promise<void> {
  await esc.admin.query('delete from negocio.senales where org_id = $1', [esc.org]);
  await esc.admin.query('delete from negocio.planes_de_accion where org_id = $1', [esc.org]);
  await esc.admin.query('delete from negocio.umbrales where org_id = $1', [esc.org]);
  await esc.admin.query('delete from identidad.usuarios where nombre = $1', [NOMBRE_DE_PERSONA]);
  for (const t of sesionesPropias.splice(0)) await esc.admin.query('delete from identidad.sesiones where token_hash = $1', [hashDeToken(t)]);
}

before(async () => {
  esc = await montar('Senales228');
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
    metrica: 'icp_promedio',
    lineaBase: 52.3,
    valorActual: 35,
    cambioPct: null,
    muestra: 20,
    periodo: { desde: '2026-09-06', hasta: '2026-10-05' },
    datosDesde: null,
    gravedad: 'media',
    causasPosibles: ['puede deberse al mensaje de la pieza'],
    revisionRecomendada: 'Revisa a quién le habla la pieza.',
    perdidaContactos: null,
    destino: null,
    requiereValidacionEjecutiva: false,
    umbral: { valor: 15, provisional: true },
    evidencia: { etapa: 'TOFU' },
    ...cambios,
  };
}

/** Dos señales de Creative en 30 días —una local y una de validación ejecutiva— y una de Acquisition. */
async function sembrar(): Promise<{ local: string; ejecutiva: string; deAcquisition: string }> {
  await conOrganizacion(esc.org, async () => {
    await reconciliarSenales({
      departamento: 'creative',
      detector: 'creative',
      ventana: '30d',
      detecciones: [
        deteccion(CRE.icpPorPieza, { tipo: 'pieza', id: 'pieza baja' }),
        deteccion(CRE.concentracion, { tipo: 'pieza', id: 'pieza grande' }, { requiereValidacionEjecutiva: true, muestra: null, lineaBase: null, valorActual: 0.6, evidencia: { piezas: [1, 2, 3] } }),
      ],
      sinMedicion: [],
    });
    await reconciliarSenales({
      departamento: 'acquisition',
      detector: 'acquisition',
      ventana: '30d',
      detecciones: [deteccion(ACQ.cplSostenido, { tipo: 'campana', id: 'c1' })],
      sinMedicion: [],
    });
  });
  const id = async (regla: string) =>
    (await esc.admin.query<{ id: string }>('select id from negocio.senales where org_id = $1 and regla = $2', [esc.org, regla])).rows[0]!.id;
  return { local: await id(CRE.icpPorPieza), ejecutiva: await id(CRE.concentracion), deAcquisition: await id(ACQ.cplSostenido) };
}

const accion = (cuerpo: unknown, token = esc.token) => decidir(pedirComo('/api/creative/senales', token, { metodo: 'POST', cuerpo }));
const firma = (cuerpo: unknown, token = esc.token) => firmar(pedirComo('/api/creative/umbrales', token, { metodo: 'PUT', cuerpo }));
const estado = async (id: string) => (await esc.admin.query<{ estado: string }>('select estado from negocio.senales where id = $1', [id])).rows[0]!.estado;

/** Una persona de `alfa` con el rol `usuario` y la pestaña de Creative. */
async function usuarioComun(): Promise<string> {
  const r = await esc.admin.query<{ id: string }>(
    `insert into identidad.usuarios (org_id, nombre, email, password_hash) values ($1, $2, $3, 'scrypt$16384$8$1$aaaa$bbbb') returning id`,
    [esc.org, NOMBRE_DE_PERSONA, `senales-228-${randomUUID().slice(0, 8)}@alfa.ejemplo`],
  );
  const id = r.rows[0]!.id;
  await esc.admin.query(`insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = 'usuario' and org_id is null`, [id]);
  await esc.admin.query(`insert into identidad.usuarios_secciones (usuario_id, seccion) values ($1, 'creative')`, [id]);
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

test('el GET de Creative trae sólo sus señales, con la frase de su plan y el nombre de la pieza', async () => {
  await sembrar();
  const r = await leerRespuesta<{
    senales: { ventana: string | null; lista: { regla: string; nombre: string | null; texto: string }[]; reglas: { codigo: string; unidad: string }[] };
    puedeConSenales: Record<string, boolean>;
  }>(await leerCreative(pedirComo('/api/creative?periodo=30d', esc.token)));
  assert.equal(r.estado, 200);
  assert.equal(r.cuerpo.senales.ventana, '30d');
  assert.deepEqual(r.cuerpo.senales.lista.map((s) => [s.regla, s.nombre]).sort(), [[CRE.concentracion, 'pieza grande'], [CRE.icpPorPieza, 'pieza baja']]);
  assert.equal(
    r.cuerpo.senales.lista.find((s) => s.regla === CRE.icpPorPieza)!.texto,
    'Su ICP promedio está 17,3 puntos por debajo del promedio de las piezas de su etapa (TOFU): 35 contra 52,3, sobre 20 calificados con puntaje.',
  );
  assert.deepEqual(r.cuerpo.senales.reglas.map((x) => x.codigo).sort(), Object.values(CRE).sort());
  assert.equal(r.cuerpo.senales.reglas.find((x) => x.codigo === CRE.frecuenciaAlta)!.unidad, 'veces');
  assert.deepEqual(r.cuerpo.puedeConSenales, { resolver: true, validar: true, firmar: true });

  const hoy = await leerRespuesta<{ senales: { ventana: string | null; lista: unknown[] } }>(await leerCreative(pedirComo('/api/creative?periodo=hoy', esc.token)));
  assert.deepEqual([hoy.cuerpo.senales.ventana, hoy.cuerpo.senales.lista], [null, []]);
});

test('marcar y resolver una de Creative; la de Acquisition, por esta ruta, no existe', async () => {
  const { local, deAcquisition } = await sembrar();
  assert.equal((await accion({ id: local, accion: 'vista' })).status, 200);
  assert.equal(await estado(local), 'vista');
  assert.equal((await accion({ id: local, accion: 'resolver', motivo: 'Cambiamos la audiencia.' })).status, 200);
  assert.equal(await estado(local), 'resuelta');
  assert.equal((await accion({ id: deAcquisition, accion: 'descartar', motivo: 'x' })).status, 404);
  assert.equal(await estado(deAcquisition), 'abierta');
});

test('la concentración del gasto requiere validación: un `usuario` de Creative no la cierra', async () => {
  const { local, ejecutiva } = await sembrar();
  const comun = await usuarioComun();
  const negada = await leerRespuesta<{ codigo: string }>(await accion({ id: ejecutiva, accion: 'descartar', motivo: 'No aplica.' }, comun));
  assert.deepEqual([negada.estado, negada.cuerpo.codigo], [403, 'sin_permiso']);
  assert.equal(await estado(ejecutiva), 'abierta');
  assert.equal((await accion({ id: local, accion: 'descartar', motivo: 'Ya lo sabemos.' }, comun)).status, 200);
  const r = await leerRespuesta<{ puedeConSenales: Record<string, boolean> }>(await leerCreative(pedirComo('/api/creative?periodo=30d', comun)));
  assert.deepEqual(r.cuerpo.puedeConSenales, { resolver: true, validar: false, firmar: false });
});

test('se firman las reglas de Creative y no las de Acquisition', async () => {
  const r = await leerRespuesta<{ reglas: { codigo: string; valor: number; provisional: boolean }[] }>(await firma({ regla: CRE.frecuenciaAlta, valor: 4 }));
  assert.equal(r.estado, 200);
  const firmada = r.cuerpo.reglas.find((x) => x.codigo === CRE.frecuenciaAlta)!;
  assert.deepEqual([firmada.valor, firmada.provisional], [4, false]);
  assert.ok(r.cuerpo.reglas.every((x) => x.codigo.startsWith('CRE-')));
  assert.equal((await firma({ regla: ACQ.cplSostenido, valor: 0.2 })).status, 400);
  assert.equal((await firma({ regla: CRE.frecuenciaAlta, valor: 3 }, await usuarioComun())).status, 403);
});

test('bajo delegación no se marca, no se resuelve y no se firma', async () => {
  const { local } = await sembrar();
  const token = await bajoDelegacion();
  const vista = await leerRespuesta<{ codigo: string }>(await accion({ id: local, accion: 'vista' }, token));
  assert.deepEqual([vista.estado, vista.cuerpo.codigo], [409, 'senales_bajo_delegacion']);
  assert.equal((await firma({ regla: CRE.frecuenciaAlta, valor: 4 }, token)).status, 409);
  assert.equal(await estado(local), 'abierta');
});
