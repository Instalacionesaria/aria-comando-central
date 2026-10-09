// LAS SEÑALES DE CONVERSION: LA VENTANA ANTERIOR, Y LAS RUTAS DE SU PANTALLA. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// AG14 de los agentes: `medirConversion` y las rutas `app/api/conversion/route.ts` (sus señales),
// `app/api/conversion/senales` y `…/umbrales` (la regla 31: una ruta nueva nace con su prueba de base):
//
//   · el detector mide los días cerrados de la pantalla (`bordesDelPeriodo`), y su anterior son exactamente los días
//     anteriores, contados igual que la cohorte;
//   · el GET trae las señales de Conversion, con la frase de su plan; con «hoy», ninguna;
//   · el cambio de ruta pide validación: un `usuario` no lo cierra, el administrador sí; la señal de otro
//     departamento no existe para esta ruta; se firman sólo las reglas de Conversion.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { hashDeToken } from '../../lib/autorizacion/sesion.ts';
import { leerRespuesta, montar, pedirComo, sesionDe, type Escenario } from '../apoyo/closer.ts';
import { quitarEmpresasDeLosAgentes, sembrarCasosDeLosAgentes } from '../../db/sembrado/casos-de-los-agentes.ts';
import { CNV, medirConversion } from '../../lib/agentes/detectores/conversion.ts';
import { bordesDelPeriodo } from '../../lib/negocio/diasCerrados.ts';
import { periodoDe } from '../../lib/negocio/periodo.ts';
import { reconciliarSenales } from '../../lib/agentes/senales/escritura.ts';
import type { Deteccion } from '../../lib/agentes/senales/tipos.ts';
import { GET as laPantalla } from '../../app/api/conversion/route.ts';
import { POST as decidir } from '../../app/api/conversion/senales/route.ts';
import { PUT as firmar } from '../../app/api/conversion/umbrales/route.ts';

const NOMBRE_DE_PERSONA = 'Persona de la 237';
let esc: Escenario;
const sesionesPropias: string[] = [];

async function limpiar(): Promise<void> {
  await esc.admin.query('delete from negocio.senales where org_id = $1', [esc.org]);
  await esc.admin.query('delete from negocio.umbrales where org_id = $1', [esc.org]);
  await esc.admin.query('delete from identidad.usuarios where nombre = $1', [NOMBRE_DE_PERSONA]);
  for (const t of sesionesPropias.splice(0)) await esc.admin.query('delete from identidad.sesiones where token_hash = $1', [hashDeToken(t)]);
}

before(async () => {
  esc = await montar('Senales237');
});
beforeEach(limpiar);
after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

const deteccion = (regla: string, id: string, cambios: Partial<Deteccion> = {}): Deteccion => ({
  regla,
  entidad: { tipo: 'familia_de_entrada', id },
  metrica: 'tasa_de_agenda',
  lineaBase: 0.5,
  valorActual: 0.2,
  cambioPct: null,
  muestra: 20,
  periodo: { desde: '2026-09-07', hasta: '2026-10-06' },
  datosDesde: null,
  gravedad: 'media',
  causasPosibles: [],
  revisionRecomendada: 'Revisa ese recorrido.',
  perdidaContactos: 16,
  destino: null,
  requiereValidacionEjecutiva: false,
  umbral: { valor: 0.15, provisional: true },
  evidencia: { contactos: 20, agendaron: 4, cohorte: 100, agendaronEnLaCohorte: 50 },
  ...cambios,
});

async function sembrar(): Promise<{ fuga: string; ruta: string; ajena: string; formulario: string; sinPaso: string }> {
  await conOrganizacion(esc.org, async () => {
    await reconciliarSenales({
      departamento: 'conversion',
      detector: 'conversion',
      ventana: '30d',
      detecciones: [
        deteccion(CNV.familiaQueNoAgenda, 'landing'),
        deteccion(CNV.cambioDeRuta, 'widget', { gravedad: 'info', requiereValidacionEjecutiva: true, perdidaContactos: null, muestra: 100 }),
        // Una del formulario, que va a su paso, y una de una entidad que no es de ningún paso.
        deteccion(CNV.formularioAbandono, 'formulario', { entidad: { tipo: 'funnel', id: 'formulario' }, metrica: 'finalizacion_del_formulario', valorActual: 0.45, evidencia: { empezaron: 40, finalizacion: 45 } }),
        deteccion(CNV.formularioSinDatos, 'otro', { entidad: { tipo: 'funnel', id: 'otro' }, metrica: 'cobertura_del_formulario', valorActual: 0.05, evidencia: { con: 5, sobre: 100 } }),
      ],
      sinMedicion: [],
    });
    await reconciliarSenales({ departamento: 'creative', detector: 'creative', ventana: '30d', detecciones: [deteccion('CRE-ICP-POR-PIEZA', 'p1', { entidad: { tipo: 'pieza', id: 'p1' } })], sinMedicion: [] });
  });
  const id = async (regla: string) => (await esc.admin.query<{ id: string }>('select id from negocio.senales where org_id = $1 and regla = $2', [esc.org, regla])).rows[0]!.id;
  return {
    fuga: await id(CNV.familiaQueNoAgenda),
    ruta: await id(CNV.cambioDeRuta),
    ajena: await id('CRE-ICP-POR-PIEZA'),
    formulario: await id(CNV.formularioAbandono),
    sinPaso: await id(CNV.formularioSinDatos),
  };
}

const accion = (cuerpo: unknown, token = esc.token) => decidir(pedirComo('/api/conversion/senales', token, { metodo: 'POST', cuerpo }));

test('el detector mide los días cerrados de la pantalla, y la anterior son exactamente los días anteriores', async () => {
  /* Desde CV-3 el detector lee `lecturaDeConversion`, la de la pantalla (CV15-23): los días cerrados de
     `bordesDelPeriodo` y no los de calendario hasta hoy, como pide AG-28. Mutación: volver a los días hasta hoy. */
  const PREFIJO = 'agentes-237-';
  const e = await sembrarCasosDeLosAgentes(PREFIJO);
  try {
    // Las lecturas al día: sin ellas la lectura no compara y no hay anterior que mirar.
    for (const tarea of ['contactos', 'citas']) {
      await esc.admin.query(
        `insert into negocio.tareas_programadas (org_id, tarea, ultima_corrida_el, ultimo_estado) values ($1, $2, now(), 'corrio')
         on conflict (org_id, tarea) do update set ultima_corrida_el = now(), ultimo_estado = 'corrio'`,
        [e.conDatos, tarea],
      );
    }
    const zona = (await esc.admin.query<{ z: string }>('select zona_horaria as z from identidad.organizaciones where id = $1', [e.conDatos])).rows[0]!.z;
    const m = await conOrganizacion(e.conDatos, () => medirConversion('30d', zona));
    const b = await conOrganizacion(e.conDatos, () => bordesDelPeriodo(periodoDe('30d')!, zona, null));
    const contar = async (v: { desde: string; hasta: string }) =>
      Number(
        (
          await esc.admin.query<{ n: string }>(
            `select count(*)::text as n from negocio.contactos where org_id = $1
               and alta_en_el_crm >= $2::date and alta_en_el_crm < ($3::date + 1)`,
            [e.conDatos, v.desde, v.hasta],
          )
        ).rows[0]!.n,
      );
    assert.deepEqual(m.periodo, b.ventana, 'el detector no midió los días cerrados de la pantalla');
    assert.equal(m.recorrido.cohorte, await contar(b.ventana));
    assert.ok(m.anterior, 'con las lecturas al día y la historia sembrada, la lectura no comparó');
    assert.equal(m.anterior.cohorte, await contar(b.anteriorCandidata));
    assert.ok(m.anterior.cohorte > 0, 'la base sembrada no tiene contactos en la ventana anterior, y la prueba no miraría nada');
  } finally {
    await quitarEmpresasDeLosAgentes(PREFIJO);
  }
});

test('el GET trae las señales de Conversion con la frase de su plan; con «hoy», ninguna', async () => {
  const { fuga, ruta, formulario } = await sembrar();
  const r = await leerRespuesta<{
    senales: { ventana: string | null; lista: { regla: string; texto: string; nombre: string | null }[]; reglas: { codigo: string }[]; porPaso: Record<string, string[]> };
    puedeConSenales: Record<string, boolean>;
  }>(await laPantalla(pedirComo('/api/conversion?periodo=30d', esc.token)));
  assert.equal(r.estado, 200);
  /* Repartidas por paso según su entidad (CV15-19): las de una familia de entrada van a Landing, donde vive el reparto;
     la del formulario, a Formulario; y la de una entidad que no es de ningún paso no va a ninguno —sigue en la lista—.
     Mutaciones: mandar todo a un paso, o meter la que no tiene paso en alguno. */
  assert.deepEqual(
    Object.fromEntries(Object.entries(r.cuerpo.senales.porPaso).map(([p, ids]) => [p, [...ids].sort()])),
    { sesiones: [fuga, ruta].sort(), vsl: [], form: [formulario], agenda: [], gracias: [] },
    'las señales no se repartieron por el paso de su entidad',
  );
  assert.deepEqual(
    r.cuerpo.senales.lista.map((x) => x.regla).sort(),
    [CNV.cambioDeRuta, CNV.familiaQueNoAgenda, CNV.formularioAbandono, CNV.formularioSinDatos].sort(),
  );
  // La familia por su rótulo de pantalla, no por su clave.
  assert.deepEqual(
    r.cuerpo.senales.lista.filter((x) => x.regla === CNV.familiaQueNoAgenda || x.regla === CNV.cambioDeRuta).map((x) => x.nombre).sort(),
    ['Landing con VSL', 'Widget de reserva'],
  );
  assert.equal(
    r.cuerpo.senales.lista.find((x) => x.regla === CNV.familiaQueNoAgenda)!.texto,
    '«Landing con VSL» agenda el 20 % de sus 20 contactos, 30 puntos por debajo de la cohorte (50 % de 100). Le toca a Conversion.',
  );
  assert.deepEqual(r.cuerpo.senales.reglas.map((x) => x.codigo).sort(), Object.values(CNV).sort());
  assert.deepEqual(r.cuerpo.puedeConSenales, { resolver: true, validar: true, firmar: true });
  const hoy = await leerRespuesta<{ senales: { ventana: string | null; lista: unknown[] } }>(await laPantalla(pedirComo('/api/conversion?periodo=hoy', esc.token)));
  assert.deepEqual([hoy.cuerpo.senales.ventana, hoy.cuerpo.senales.lista], [null, []]);
});

test('el cambio de ruta pide validación; la de otro departamento no existe; se firman sólo las de Conversion', async () => {
  const { fuga, ruta, ajena } = await sembrar();
  const r = await esc.admin.query<{ id: string }>(
    `insert into identidad.usuarios (org_id, nombre, email, password_hash) values ($1, $2, $3, 'scrypt$16384$8$1$aaaa$bbbb') returning id`,
    [esc.org, NOMBRE_DE_PERSONA, `senales-237-${randomUUID().slice(0, 8)}@alfa.ejemplo`],
  );
  const usuario = r.rows[0]!.id;
  await esc.admin.query(`insert into identidad.usuarios_roles (usuario_id, rol_id) select $1, id from identidad.roles where clave = 'usuario' and org_id is null`, [usuario]);
  await esc.admin.query(`insert into identidad.usuarios_secciones (usuario_id, seccion) values ($1, 'conversion')`, [usuario]);
  const comun = await sesionDe(usuario);
  sesionesPropias.push(comun);

  const negada = await leerRespuesta<{ codigo: string }>(await accion({ id: ruta, accion: 'descartar', motivo: 'No aplica.' }, comun));
  assert.deepEqual([negada.estado, negada.cuerpo.codigo], [403, 'sin_permiso']);
  assert.equal((await accion({ id: fuga, accion: 'resolver', motivo: 'Cambiamos la landing.' }, comun)).status, 200);
  assert.equal((await accion({ id: ruta, accion: 'resolver', motivo: 'Lo decidió la dirección.' })).status, 200);
  assert.equal((await accion({ id: ajena, accion: 'descartar', motivo: 'x' })).status, 404);

  const firma = (cuerpo: unknown) => firmar(pedirComo('/api/conversion/umbrales', esc.token, { metodo: 'PUT', cuerpo }));
  assert.equal((await firma({ regla: CNV.formularioAbandono, valor: 0.6 })).status, 200);
  assert.equal((await firma({ regla: 'CRE-ICP-POR-PIEZA', valor: 10 })).status, 400);
});
