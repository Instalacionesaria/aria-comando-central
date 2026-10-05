// LAS SEÑALES DE ACQUISITION SOBRE LA BASE SEMBRADA, EXACTAS. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// La pasada diaria con el detector de Acquisition de verdad (AG9 de los agentes;
// `docs/OTROS/agentes/fichas/F03-ACQUISITION.md`), sobre `db/sembrado/casos-de-los-agentes.ts`
// (`docs/OTROS/agentes/07-LA-EVALUACION.md`, AG-100): la pauta parada hace 15 días, Webinar con dos tercios
// del gasto de 30 días, y Remarketing sin ninguna agenda.
//
//   · en 7 días, la crítica de «sin entrega», de la empresa —las dos campañas activas paradas, y la pausada
//     no cuenta—, y el monitor: la mitad de los contactos sin anuncio y las UTM siempre incompletas
//     (`utmCampaign` no llega nunca);
//   · en 30 días, además, la concentración de Webinar —a validación ejecutiva— y la fuga de Remarketing;
//   · las ventas no se miden: no hay ninguna reportada;
//   · los dos planes guardados, con cada señal en su grupo.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import {
  CASOS,
  ZONA_DE_LOS_CASOS,
  quitarEmpresasDeLosAgentes,
  sembrarCasosDeLosAgentes,
  type EmpresasDeLosAgentes,
} from '../../db/sembrado/casos-de-los-agentes.ts';
import { correrLaPasada } from '../../lib/agentes/detectores/correr.ts';
import { diaEnZona } from '../../lib/negocio/tiempo.ts';

const PREFIJO = 'agentes-223-';
let admin: Client;
let e: EmpresasDeLosAgentes;

before(async () => {
  admin = await conectar('admin');
  e = await sembrarCasosDeLosAgentes(PREFIJO);
});
after(async () => {
  await quitarEmpresasDeLosAgentes(PREFIJO);
  await cerrarClientes();
  await cerrarTodo();
});

const id = (nombre: string) => CASOS.campanas.find((c) => c.nombre === nombre)!.id;

test('la pasada de Acquisition escribe exactamente las señales esperadas, y sus planes', async () => {
  // Las 12:00 de hoy en la zona de los casos: le toca, y el sembrado es relativo a hoy.
  const hoy = diaEnZona(new Date(), ZONA_DE_LOS_CASOS);
  const r = await correrLaPasada({ id: e.conDatos, zonaHoraria: ZONA_DE_LOS_CASOS }, { ahora: new Date(`${hoy}T17:00:00Z`) });
  assert.ok(r.tocaba);
  assert.deepEqual(r.departamentos.map((d) => [d.departamento, d.estado]), [['acquisition', 'corrio']]);

  const senales = await filas<{ ventana: string; regla: string; entidad_tipo: string; entidad_id: string; gravedad: string; valor_actual: string; muestra: number | null; requiere_validacion_ejecutiva: boolean; estado: string }>(
    admin,
    `select ventana, regla, entidad_tipo, entidad_id, gravedad, valor_actual, muestra, requiere_validacion_ejecutiva, estado
       from negocio.senales where org_id = $1 order by ventana collate "C", regla collate "C", entidad_id collate "C"`,
    [e.conDatos],
  );
  assert.deepEqual(
    senales.map((s) => [s.ventana, s.regla, s.entidad_tipo, s.entidad_id, s.gravedad, Number(s.valor_actual), s.muestra, s.requiere_validacion_ejecutiva, s.estado]),
    [
      // 30 días: 99 de 119 contactos con anuncio y con campaña; ninguna sesión con las cinco UTM; Webinar se
      // lleva 2.730 de 4.060; Remarketing, 0 de 19 agendados; la pauta, 15 días parada.
      ['30d', 'ACQ-ATRIBUCION-CONTACTOS', 'empresa', 'empresa', 'media', 0.8319, 119, false, 'abierta'],
      ['30d', 'ACQ-ATRIBUCION-SIN-CAMPANA', 'empresa', 'empresa', 'media', 0.8319, 119, false, 'abierta'],
      ['30d', 'ACQ-ATRIBUCION-UTM', 'empresa', 'empresa', 'media', 0, 99, false, 'abierta'],
      ['30d', 'ACQ-CONCENTRACION', 'campana', id('Webinar - agenda'), 'media', 0.6724, null, true, 'abierta'],
      ['30d', 'ACQ-FUGA-ENTRE-ETAPAS', 'par_de_etapas', 'profile:contactos>agendados', 'media', 0, 19, false, 'abierta'],
      ['30d', 'ACQ-SIN-ENTREGA', 'empresa', 'empresa', 'critica', 15, null, false, 'abierta'],
      // 7 días: «sin entrega» y el monitor. Sin gasto en la ventana, nada que compare costos.
      ['7d', 'ACQ-ATRIBUCION-CONTACTOS', 'empresa', 'empresa', 'media', 0.5, 26, false, 'abierta'],
      ['7d', 'ACQ-ATRIBUCION-SIN-CAMPANA', 'empresa', 'empresa', 'media', 0.5, 26, false, 'abierta'],
      ['7d', 'ACQ-ATRIBUCION-UTM', 'empresa', 'empresa', 'media', 0, 13, false, 'abierta'],
      ['7d', 'ACQ-SIN-ENTREGA', 'empresa', 'empresa', 'critica', 15, null, false, 'abierta'],
    ],
  );

  const planes = await filas<{ ventana: string; plan: { grupos: { clave: string; renglones: { regla: string }[] }[]; sinMedicion: string[] } }>(
    admin,
    'select ventana, plan from negocio.planes_de_accion where org_id = $1 order by ventana',
    [e.conDatos],
  );
  const reglasPorGrupo = (p: (typeof planes)[number]['plan']) =>
    Object.fromEntries(p.grupos.filter((g) => g.renglones.length > 0).map((g) => [g.clave, g.renglones.map((x) => x.regla)]));
  // Primero lo que pierde gente (la fuga, 11); después, sin pérdida calculable, lo más grave.
  assert.deepEqual(reglasPorGrupo(planes.find((p) => p.ventana === '30d')!.plan), {
    data: ['ACQ-FUGA-ENTRE-ETAPAS', 'ACQ-SIN-ENTREGA', 'ACQ-ATRIBUCION-CONTACTOS', 'ACQ-ATRIBUCION-UTM', 'ACQ-ATRIBUCION-SIN-CAMPANA'],
    validacion: ['ACQ-CONCENTRACION'],
  });
  const de7 = planes.find((p) => p.ventana === '7d')!.plan;
  assert.deepEqual(reglasPorGrupo(de7), { data: ['ACQ-SIN-ENTREGA', 'ACQ-ATRIBUCION-CONTACTOS', 'ACQ-ATRIBUCION-UTM', 'ACQ-ATRIBUCION-SIN-CAMPANA'] });
  // Lo que no se pudo medir se dice en vez de callarlo: en 7 días, el costo por calificado (sin gasto), las
  // citas (ninguna) y las ventas (ninguna reportada).
  assert.equal(de7.sinMedicion.length, 3);
});
