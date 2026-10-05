// LA PASADA DE LOS DETECTORES: A CADA EMPRESA SU MAÑANA, UNA VEZ POR DÍA Y POR DEPARTAMENTO. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `lib/agentes/detectores/correr.ts` y la tarea `senales` de `lib/negocio/barrido.ts` (AG8 de los agentes;
// `docs/OTROS/agentes/02-EL-CONTRATO-DE-SENALES.md`, AG-35):
//
//   · le toca a la empresa que ya pasó las 6:00 de SU zona: a las 10:23 UTC, a Tokio sí y a Lima no;
//   · a la que no le toca no se la sella —un sello cada hora haría parecer al día una tarea diaria—, y la
//     que ya corrió hoy no se vuelve a sellar;
//   · «ya corrió» es por departamento: el que falla no deja plan y se reintenta la hora siguiente, sin volver
//     a correr al que terminó; al día siguiente corren todos;
//   · el plan se guarda también vacío, con lo que quedó debajo del piso.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas, unaFila } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { barrerTodo, type EmpresaParaBarrer } from '../../lib/negocio/barrido.ts';
import { correrLaPasada, type Detector } from '../../lib/agentes/detectores/correr.ts';
import type { OrganizacionListada } from '../../lib/administracion/organizaciones.ts';
import type { Deteccion } from '../../lib/agentes/senales/tipos.ts';
import { diaEnZona } from '../../lib/negocio/tiempo.ts';

let admin: Client;
let alfa: string;
let beta: string;

async function limpiar(): Promise<void> {
  for (const org of [alfa, beta]) {
    await admin.query('delete from negocio.senales where org_id = $1', [org]);
    await admin.query('delete from negocio.planes_de_accion where org_id = $1', [org]);
    await admin.query(`delete from negocio.tareas_programadas where org_id = $1 and tarea = 'senales'`, [org]);
  }
}

before(async () => {
  admin = await conectar('admin');
  const a = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = 'alfa'`);
  const b = await unaFila<{ id: string }>(admin, `select id from identidad.organizaciones where slug = 'beta'`);
  assert.ok(a && b, 'falta el sembrado: corré `npm run db:reset`');
  alfa = a.id;
  beta = b.id;
});
beforeEach(limpiar);
after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

function empresa(id: string, slug: string, zonaHoraria: string): EmpresaParaBarrer {
  const org: OrganizacionListada = {
    id,
    slug,
    nombre: `Empresa ${slug}`,
    activa: true,
    esPrincipal: false,
    tieneCredencialDeCrm: false,
    precioMensual: null,
    usuarios: 1,
    zonaHoraria,
    creadaEl: new Date(),
  };
  // Sin ninguna credencial: la pasada no pide ninguna.
  return {
    org,
    acceso: { tipo: 'falta', que: 'sin_token' },
    auditor: { tipo: 'falta', que: 'sin_llave_de_ia' },
    analizador: { tipo: 'falta', que: 'sin_llave_de_tldv' },
  };
}

const a = (iso: string) => () => Date.parse(iso);

/* El día de hoy en Lima, y no una fecha fija: «ya corrió hoy» compara el día local de la pasada con el del
   sello, y `sellar` escribe la hora de verdad, no la del reloj de la prueba. Con una fecha fija, la prueba
   sólo pasaría el día en que se escribió. Las horas UTC de abajo caen en este mismo día en Lima y en Tokio. */
const HOY = diaEnZona(new Date(), 'America/Lima');

const sello = async (org: string) =>
  unaFila<{ ultimo_estado: string; ultima_corrida_el: Date }>(
    admin,
    `select ultimo_estado, ultima_corrida_el from negocio.tareas_programadas where org_id = $1 and tarea = 'senales'`,
    [org],
  );

test('a las 10:23 UTC le toca a Tokio y no a Lima; la que no le toca no se sella', async () => {
  const lima = empresa(alfa, 'alfa', 'America/Lima');
  const tokio = empresa(beta, 'beta', 'Asia/Tokyo');
  // 10:23 UTC: 5:23 en Lima, 19:23 en Tokio.
  const r = await barrerTodo('23 * * * *', [lima, tokio], a(`${HOY}T10:23:00Z`));
  const porSlug = new Map(r.renglones.map((x) => [x.slug, x]));
  assert.equal(porSlug.get('alfa')?.estado, 'frenada');
  assert.match(String(porSlug.get('alfa')?.porque), /6:00 en America\/Lima/);
  assert.equal(await sello(alfa), undefined, 'se selló a una empresa a la que no le tocaba');
  assert.equal(porSlug.get('beta')?.estado, 'corrio');
  assert.equal((await sello(beta))?.ultimo_estado, 'corrio');

  // 11:23 UTC, las 6:23 de Lima: ahora sí.
  const despues = await barrerTodo('23 * * * *', [lima], a(`${HOY}T11:23:00Z`));
  assert.equal(despues.renglones[0]?.estado, 'corrio');
  const primero = await sello(alfa);
  assert.equal(primero?.ultimo_estado, 'corrio');

  // Y a las 12:23 ya corrió hoy: se reporta y el sello no se toca.
  const otra = await barrerTodo('23 * * * *', [lima], a(`${HOY}T12:23:00Z`));
  assert.equal(otra.renglones[0]?.estado, 'frenada');
  assert.equal(otra.renglones[0]?.porque, 'ya corrió hoy');
  assert.deepEqual((await sello(alfa))?.ultima_corrida_el, primero?.ultima_corrida_el);
});

/** Un detector de prueba que cuenta sus pasadas y puede fallar las primeras `fallas`. */
function detectorDe(departamento: Detector['departamento'], fallas = 0, debajo = false): Detector & { pasadas: number } {
  const d = {
    departamento,
    nombre: departamento,
    pasadas: 0,
    async detectar(c: Parameters<Detector['detectar']>[0]) {
      d.pasadas += 1;
      if (d.pasadas <= fallas) throw new Error('la medición de prueba falló');
      const det: Deteccion = {
        regla: 'ACQ-PRUEBA-220',
        entidad: { tipo: 'campana', id: 'c1' },
        metrica: 'contactos',
        lineaBase: 20,
        valorActual: 10,
        cambioPct: -0.5,
        muestra: 20,
        periodo: { desde: null, hasta: c.dia },
        datosDesde: null,
        gravedad: 'media',
        causasPosibles: [],
        revisionRecomendada: 'Revisa la campaña.',
        perdidaContactos: 10,
        destino: null,
        requiereValidacionEjecutiva: false,
        umbral: { valor: 0.3, provisional: true },
        evidencia: { ventana: c.ventana },
      };
      return {
        detecciones: departamento === 'acquisition' ? [det] : [],
        sinMedicion: [],
        debajoDelPiso: debajo ? [{ regla: 'ACQ-PRUEBA-220', entidad: { tipo: 'campana' as const, id: 'c2' }, muestra: 4 }] : [],
      };
    },
    armarPlan: (p: Parameters<Detector['armarPlan']>[0]) => ({ vigentes: p.vigentes.length }),
  };
  return d;
}

test('el departamento que falla no deja plan y se reintenta; el que terminó no vuelve a correr', async () => {
  const org = { id: alfa, zonaHoraria: 'America/Lima' };
  const acquisition = detectorDe('acquisition', 0, true);
  const creative = detectorDe('creative', 1);
  const detectores = [acquisition, creative];

  const primera = await correrLaPasada(org, { ahora: new Date('2026-10-05T11:23:00Z'), detectores });
  assert.ok(primera.tocaba);
  assert.deepEqual(primera.departamentos.map((d) => [d.departamento, d.estado]), [['acquisition', 'corrio'], ['creative', 'fallo']]);
  assert.equal(primera.departamentosQueFallaron, 1);
  const planes = await filas<{ departamento: string; ventana: string; bajo_el_piso: number }>(
    admin,
    'select departamento, ventana, bajo_el_piso from negocio.planes_de_accion where org_id = $1 order by departamento, ventana',
    [alfa],
  );
  // Las dos ventanas de Acquisition, con lo de debajo del piso; ninguna de Creative.
  assert.deepEqual(planes.map((p) => [p.departamento, p.ventana, p.bajo_el_piso]), [['acquisition', '30d', 1], ['acquisition', '7d', 1]]);
  const senales = await unaFila<{ n: string }>(admin, 'select count(*)::text as n from negocio.senales where org_id = $1', [alfa]);
  assert.equal(senales?.n, '2', 'una señal por ventana');

  // La hora siguiente: Creative se reintenta y Acquisition no vuelve a medir.
  const segunda = await correrLaPasada(org, { ahora: new Date('2026-10-05T12:23:00Z'), detectores });
  assert.ok(segunda.tocaba);
  assert.deepEqual(segunda.departamentos.map((d) => [d.departamento, d.estado]), [['acquisition', 'ya_corrio'], ['creative', 'corrio']]);
  assert.equal(acquisition.pasadas, 2, 'Acquisition volvió a medir el mismo día');
  // El plan vacío también se guarda: dice que se miró y no hubo nada.
  const deCreative = await unaFila<{ n: string }>(
    admin,
    `select count(*)::text as n from negocio.planes_de_accion where org_id = $1 and departamento = 'creative'`,
    [alfa],
  );
  assert.equal(deCreative?.n, '2');

  // Alguien descarta la señal de los 30 días con su motivo.
  await admin.query(
    `update negocio.senales set estado = 'descartada', cerrada_el = now(), motivo_cierre = 'ya se sabe'
      where org_id = $1 and ventana = '30d'`,
    [alfa],
  );

  // Al día siguiente corren todos otra vez.
  const manana = await correrLaPasada(org, { ahora: new Date('2026-10-06T11:23:00Z'), detectores });
  assert.ok(manana.tocaba);
  assert.deepEqual(manana.departamentos.map((d) => d.estado), ['corrio', 'corrio']);
  // Y lo descartado no vuelve al plan como recomendación (A6-20): sigue detectándose, pero alguien ya lo decidió.
  const vigentes = await filas<{ ventana: string; plan: { vigentes: number } }>(
    admin,
    `select ventana, plan from negocio.planes_de_accion where org_id = $1 and departamento = 'acquisition' and dia = '2026-10-06' order by ventana`,
    [alfa],
  );
  assert.deepEqual(vigentes.map((p) => [p.ventana, p.plan.vigentes]), [['30d', 0], ['7d', 1]]);
});
