// EL DETECTOR DE CREATIVE PUBLICA SÓLO LO QUE ES DE LA PIEZA, Y SU PLAN HABLA CON EL VERBO DE LA MEDICIÓN. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `lib/agentes/detectores/creative.ts` y `lib/agentes/plan/creative.ts` (AG10 de los agentes;
// `docs/OTROS/agentes/fichas/F06-CREATIVE-INSIGHTS.md`; `docs/creative/06` y `11`):
//
//   · el grano: sólo piezas y anuncios, nunca campañas ni conjuntos, que son de Acquisition (C11-04);
//   · la caída del CTR sólo con veredicto de la fatiga y desde el 25 %, no desde el 20 % de la pantalla;
//   · la concentración con tres piezas o más, y sólo a validación ejecutiva;
//   · la frecuencia sólo en 7 días, con su piso de mil impresiones;
//   · el ICP se compara dentro de la etapa y nunca entre etapas (C3-06), y una pieza en dos etapas es una señal;
//   · sin la lectura de anuncios al día o sin el campo de ICP, la regla va a «sin medición»;
//   · el plan: sus grupos en el orden de C6-02, sin «Ideas para producir», y frases con el verbo de la medición.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { CRE, detectarEnCreative, REGLAS_DE_CREATIVE, type MedidaDeCreative } from '../../lib/agentes/detectores/creative.ts';
import { armarPlanDeCreative, GRUPOS_DEL_PLAN_DE_CREATIVE } from '../../lib/agentes/plan/creative.ts';
import { CATALOGO_DE_REGLAS, umbralVigente } from '../../lib/agentes/senales/umbrales.ts';
import type { FilaDeCreativo } from '../../lib/negocio/calidadDelCreativo.ts';
import type { FilaDeRendimiento } from '../../lib/negocio/rendimientoDelCreativo.ts';
import type { FatigaDeUnCreativo } from '../../lib/negocio/fatigaDelCreativo.ts';
import type { Deteccion } from '../../lib/agentes/senales/tipos.ts';

const pieza = (creativo: string, gasto: number, impresiones = 5000) => ({ creativo, gasto, impresiones }) as FilaDeRendimiento;
const fatiga = (creativo: string, caida: number | null, fatigado: boolean | null = caida === null ? null : caida >= 0.2) =>
  ({ creativo, dias: 20, desde: '2026-09-10', hasta: '2026-10-04', ctrTemprano: 2.76, ctrTardio: 1.98, caida, fatigado, motivo: null, porque: null }) as FatigaDeUnCreativo;
const calidad = (creativo: string | null, etapa: FilaDeCreativo['etapa'], icpPromedio: number | null, conPuntaje = 20) =>
  ({ creativo, etapa, icpPromedio, conPuntaje, contactos: conPuntaje }) as FilaDeCreativo;

function medida(e: Partial<{
  ventana: '7d' | '30d';
  rendimiento: FilaDeRendimiento[];
  fatiga: FatigaDeUnCreativo[];
  calidad: FilaDeCreativo[];
  campoDeIcp: string | null;
  frecuencias: [string, number, number][];
  anunciosAlDia: boolean;
}>): MedidaDeCreative {
  const ventana = e.ventana ?? '30d';
  return {
    ventana,
    periodo: { desde: '2026-09-06', hasta: '2026-10-05' },
    calidad: { filas: e.calidad ?? [], campoDeIcp: e.campoDeIcp === undefined ? 'campo-icp' : e.campoDeIcp },
    rendimiento: { filas: e.rendimiento ?? [] },
    fatiga: { filas: e.fatiga ?? [] },
    frecuencias: ventana === '7d' ? new Map((e.frecuencias ?? []).map(([id, frecuencia, impresiones]) => [id, { frecuencia, impresiones, creativo: 'pieza' }])) : null,
    anunciosAlDia: e.anunciosAlDia ?? true,
  };
}

const provisional = (firmados: [string, number][] = []) => (codigo: string) =>
  umbralVigente(CATALOGO_DE_REGLAS.find((r) => r.codigo === codigo)!, new Map(firmados));
const detectar = (m: MedidaDeCreative, firmados?: [string, number][]) => detectarEnCreative(m, provisional(firmados));
const de = (r: ReturnType<typeof detectar>, regla: string) => r.detecciones.filter((d) => d.regla === regla);

test('las reglas de Creative están en el catálogo, con su departamento', () => {
  for (const r of REGLAS_DE_CREATIVE) {
    assert.ok(CATALOGO_DE_REGLAS.includes(r), r.codigo);
    assert.equal(r.departamento, 'creative');
    assert.match(r.codigo, /^CRE-/);
  }
  assert.deepEqual(REGLAS_DE_CREATIVE.map((r) => r.codigo).sort(), Object.values(CRE).sort());
});

test('el grano: sólo piezas y anuncios, nunca campañas ni conjuntos (C11-04)', () => {
  const r = detectar(
    medida({
      ventana: '7d',
      rendimiento: [pieza('a', 600), pieza('b', 200), pieza('c', 200)],
      fatiga: [fatiga('a', 0.4)],
      calidad: [calidad('a', 'TOFU', 30), calidad('b', 'TOFU', 60), calidad('c', 'TOFU', 62)],
      frecuencias: [['ad-1', 4, 2000]],
    }),
  );
  assert.deepEqual(new Set(r.detecciones.map((d) => d.regla)), new Set(Object.values(CRE)));
  for (const d of r.detecciones) assert.ok(['pieza', 'anuncio'].includes(d.entidad.tipo), `${d.regla}: ${d.entidad.tipo}`);
});

test('la caída del CTR: sólo con veredicto, y desde el 25 % y no desde el 20 % de la pantalla', () => {
  const r = detectar(medida({ rendimiento: [pieza('cae', 10, 7000)], fatiga: [fatiga('cae', 0.3), fatiga('poco', 0.22), fatiga('sin-veredicto', 0.5, null), fatiga('sin-serie', null)] }));
  const caidas = de(r, CRE.caidaDeCtr);
  assert.deepEqual(caidas.map((d) => d.entidad), [{ tipo: 'pieza', id: 'cae' }]);
  assert.deepEqual([caidas[0]!.lineaBase, caidas[0]!.valorActual, caidas[0]!.cambioPct, caidas[0]!.muestra], [2.76, 1.98, -0.3, 7000]);
  // Firmado más bajo, la de 22 % entra.
  assert.equal(de(detectar(medida({ fatiga: [fatiga('poco', 0.22)] }), [[CRE.caidaDeCtr, 0.2]]), CRE.caidaDeCtr).length, 1);
});

test('la concentración: tres piezas con gasto o más, y sólo a validación ejecutiva', () => {
  assert.equal(de(detectar(medida({ rendimiento: [pieza('a', 900), pieza('b', 100)] })), CRE.concentracion).length, 0);
  const r = detectar(medida({ rendimiento: [pieza('a', 350), pieza('b', 350), pieza('c', 300), pieza('sin-gasto', 0)] }));
  const c = de(r, CRE.concentracion);
  // 35 % justo entra; la pieza sin gasto no cuenta como una de las tres.
  assert.deepEqual(c.map((d) => [d.entidad.id, d.valorActual, d.requiereValidacionEjecutiva]), [['a', 0.35, true], ['b', 0.35, true]]);
  assert.equal((c[0]!.evidencia as { piezas: unknown[] }).piezas.length, 3);
});

test('la frecuencia: sólo en 7 días, con su piso de mil impresiones', () => {
  const r = detectar(medida({ ventana: '7d', frecuencias: [['alta', 3.2, 1500], ['chica', 3.5, 800], ['normal', 2.9, 9000]] }));
  assert.deepEqual(de(r, CRE.frecuenciaAlta).map((d) => [d.entidad, d.valorActual, d.muestra]), [[{ tipo: 'anuncio', id: 'alta' }, 3.2, 1500]]);
  assert.deepEqual(r.debajoDelPiso, [{ regla: CRE.frecuenciaAlta, entidad: { tipo: 'anuncio', id: 'chica' }, muestra: 800 }]);
  // En 30 días la regla no existe: ni señal ni «sin medición».
  const treinta = detectar(medida({ ventana: '30d', anunciosAlDia: false }));
  assert.ok(!treinta.sinMedicion.includes(CRE.frecuenciaAlta));
});

test('el ICP se compara dentro de la etapa, nunca entre etapas (C3-06)', () => {
  const r = detectar(
    medida({
      calidad: [
        // TOFU: promedio por pieza (35 + 60 + 62) / 3 = 52,33; «baja» está 17,3 por debajo.
        calidad('baja', 'TOFU', 35),
        calidad('b', 'TOFU', 60),
        calidad('c', 'TOFU', 62),
        // Sola en su etapa: con 20 puntos no compite con nadie, aunque esté lejos del TOFU.
        calidad('sola', 'BOFU', 20),
        // Sin etapa y sin creativo: no entran en ningún promedio.
        calidad('sin-etapa', null, 0),
        calidad(null, 'TOFU', 0),
      ],
    }),
  );
  const icp = de(r, CRE.icpPorPieza);
  assert.deepEqual(icp.map((d) => [d.entidad.id, d.lineaBase, d.valorActual, d.muestra]), [['baja', 52.3, 35, 20]]);
  assert.equal((icp[0]!.evidencia as { etapa: string }).etapa, 'TOFU');
});

test('una pieza que está baja en dos etapas es una sola señal: la de la caída más grande', () => {
  const r = detectar(
    medida({
      calidad: [calidad('doble', 'TOFU', 40), calidad('x', 'TOFU', 70), calidad('doble', 'MOFU', 10), calidad('y', 'MOFU', 80)],
    }),
  );
  const icp = de(r, CRE.icpPorPieza);
  assert.equal(icp.length, 1);
  assert.equal((icp[0]!.evidencia as { etapa: string }).etapa, 'MOFU');
});

test('sin la lectura de anuncios al día o sin el campo de ICP, la regla va a «sin medición»', () => {
  const r = detectar(medida({ ventana: '7d', anunciosAlDia: false, campoDeIcp: null, rendimiento: [pieza('a', 900), pieza('b', 50), pieza('c', 50)], fatiga: [fatiga('a', 0.5)], frecuencias: [['ad', 9, 9000]] }));
  assert.deepEqual(r.detecciones, []);
  assert.deepEqual(new Set(r.sinMedicion), new Set(Object.values(CRE)));
});

// ─── El plan ────────────────────────────────────────────────────────────────

const plan = (vigentes: Deteccion[]) =>
  armarPlanDeCreative({ ventana: '30d', dia: '2026-10-05', periodo: { desde: '2026-09-06', hasta: '2026-10-05' }, detecciones: vigentes, vigentes, sinMedicion: [CRE.icpPorPieza], debajoDelPiso: [] });

test('el plan: los grupos de C6-02 en su orden, sin «Ideas para producir»', () => {
  const p = plan([]);
  assert.deepEqual(p.grupos.map((g) => g.titulo), ['Lo que dice la data', 'Haz más de esto', 'Ajusta o pausa esto', 'Requiere validación ejecutiva']);
  assert.deepEqual(GRUPOS_DEL_PLAN_DE_CREATIVE.map((g) => g.clave), p.grupos.map((g) => g.clave));
  assert.equal(p.departamento, 'creative');
  assert.deepEqual(p.sinMedicion, ['el ICP por pieza: el campo de ICP no está en el CRM']);
});

test('cada regla a su grupo, con el verbo de la medición y el CTR sin multiplicar', () => {
  const r = detectar(
    medida({
      ventana: '7d',
      rendimiento: [pieza('a', 600, 7000), pieza('b', 200), pieza('c', 200)],
      fatiga: [fatiga('a', 0.2826)],
      calidad: [calidad('baja', 'TOFU', 35), calidad('b', 'TOFU', 60), calidad('c', 'TOFU', 62)],
      frecuencias: [['ad-1', 3.25, 1500]],
    }),
  );
  const p = plan(r.detecciones);
  const donde = Object.fromEntries(p.grupos.flatMap((g) => g.renglones.map((x) => [x.regla, g.clave])));
  assert.deepEqual(donde, { [CRE.icpPorPieza]: 'data', [CRE.caidaDeCtr]: 'ajusta', [CRE.frecuenciaAlta]: 'ajusta', [CRE.concentracion]: 'validacion' });
  const textos = p.grupos.flatMap((g) => g.renglones.map((x) => x.texto));
  for (const t of [
    'Su CTR bajó 28 % entre la primera y la segunda mitad de sus 20 días con entrega: de 2,76 % a 1,98 %, sobre 7.000 impresiones.',
    'Su ICP promedio está 17,3 puntos por debajo del promedio de las piezas de su etapa (TOFU): 35 contra 52,3, sobre 20 calificados con puntaje.',
    'El anuncio se mostró 3,25 veces por persona en promedio en la semana, sobre 1.500 impresiones.',
    'Se lleva el 60 % del gasto de la ventana, entre 3 piezas con gasto.',
  ]) assert.ok(textos.includes(t), `${t}\n--\n${textos.join('\n')}`);
});
