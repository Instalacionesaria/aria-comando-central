// LO QUE SE LE OFRECE AL CEREBRO: EXACTAMENTE LAS HERRAMIENTAS DE LAS SECCIONES QUE SE VEN. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `lib/agentes/executive/herramientas.ts`, `herramientasPara` (AG6; `docs/OTROS/agentes/03-EL-CEREBRO.md`,
// AG-41): una herramienta que no se ofrece no existe para el modelo, así que lo que se ofrece ES el permiso.
//
//   · Cada sección, sola, recibe exactamente su juego, escrito acá y no derivado del catálogo: un closer no
//     recibe cifras de Acquisition.
//   · La que sirve a dos (`cancelacion_de_citas`) se ofrece con cualquiera; la que cruza dos
//     (`economia_del_negocio`) sólo con las dos.
//   · `estado_de_integraciones` no es de ninguna sección: sólo cuando la ruta resolvió el dato, que es con
//     `credenciales.ver`.
//   · Con la caja del pie, las de la sección abierta van primero.
//
// Y `sinDatosDeContacto`, el filtro de los dos textos libres que viajan (el análisis del Espía y los
// extractos de ICP & Oferta): saca correos y teléfonos, y deja fechas y montos.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { HERRAMIENTAS, herramientasPara } from '../../lib/agentes/executive/herramientas.ts';
import { sinDatosDeContacto } from '../../lib/agentes/executive/adaptadores/comun.ts';

const nombres = (secciones: string[], conIntegraciones = false) =>
  herramientasPara(secciones, null, conIntegraciones)
    .map((h) => h.nombre)
    .sort();

/** Lo que recibe quien ve UNA sección. Escrito a mano: es la decisión, no una consecuencia del catálogo. */
const POR_SECCION: Record<string, string[]> = {
  executive: [],
  acquisition: ['embudos_de_acquisition', 'frescura'],
  creative: ['calidad_de_piezas', 'fatiga_de_piezas', 'frescura', 'rendimiento_de_piezas'],
  conversion: ['formulario_de_la_landing', 'frescura', 'pasos_de_conversion', 'recorrido_de_los_leads'],
  conversation: [
    'atribucion_del_lead', 'auditoria_de_agentes', 'cancelacion_de_citas', 'consumo_del_precall', 'frescura', 'lead_flow', 'sentimiento_por_flujo',
  ],
  sales: ['cadena_de_cierre', 'cancelacion_de_citas', 'ciclo_hasta_la_cita', 'cierre_por_closer', 'dinero_del_mes', 'frescura'],
  contacts: ['cohorte_de_leads', 'frescura'],
  setter: ['colas_del_setter', 'frescura', 'inicio_del_setter', 'pipeline_del_setter'],
  closer: ['agenda_del_closer', 'frescura', 'inicio_del_closer', 'mi_dia_del_closer', 'pipeline_del_closer'],
  analizadores: ['frescura', 'llamadas_de_onboarding', 'llamadas_de_venta'],
  tools: ['espia', 'leads_del_scraper'],
  icp: ['fundaciones'],
  credenciales: [],
  monitoreo: [],
};

for (const [seccion, esperadas] of Object.entries(POR_SECCION)) {
  test(`quien sólo ve «${seccion}» recibe exactamente sus herramientas`, () => {
    assert.deepEqual(nombres([seccion]), [...esperadas].sort());
  });
}

test('cada herramienta del catálogo se le ofrece a alguna sección de la tabla, o a quien tiene `credenciales.ver`', () => {
  const alguna = new Set([...Object.values(POR_SECCION).flat(), 'economia_del_negocio', 'estado_de_integraciones']);
  assert.deepEqual(HERRAMIENTAS.map((h) => h.nombre).filter((n) => !alguna.has(n)), []);
});

test('la que cruza Sales y Acquisition, sólo con las dos; la de dos secciones, con cualquiera', () => {
  assert.ok(!nombres(['sales']).includes('economia_del_negocio'));
  assert.ok(!nombres(['acquisition']).includes('economia_del_negocio'));
  assert.ok(nombres(['sales', 'acquisition']).includes('economia_del_negocio'));
  assert.ok(nombres(['conversation']).includes('cancelacion_de_citas'));
  assert.ok(nombres(['sales']).includes('cancelacion_de_citas'));
});

test('el estado de las integraciones, sólo cuando la ruta lo resolvió', () => {
  assert.ok(!nombres(['acquisition', 'sales', 'tools']).includes('estado_de_integraciones'));
  assert.deepEqual(nombres([], true), ['estado_de_integraciones']);
  assert.ok(nombres(['sales'], true).includes('estado_de_integraciones'));
});

test('con la caja del pie, las de la sección abierta van primero', () => {
  const abierta = herramientasPara(['acquisition', 'closer', 'tools'], 'tools').map((h) => h.nombre);
  assert.deepEqual(abierta.slice(0, 2).sort(), ['espia', 'leads_del_scraper']);
  const otra = herramientasPara(['acquisition', 'closer', 'tools'], 'closer').map((h) => h.nombre);
  assert.equal(otra[0], 'mi_dia_del_closer');
});

test('`sinDatosDeContacto` saca correos, usuarios y teléfonos, y deja fechas, rangos y montos que se leen sin dudas', () => {
  const t = (x: string) => sinDatosDeContacto(x, 10_000).texto;
  // Lo que se borra.
  assert.equal(t('Escribe a ventas@competidor.test hoy.'), 'Escribe a [correo] hoy.');
  assert.equal(t('Síguenos en @competidor.oficial'), 'Síguenos en [usuario]');
  assert.equal(t('Llama al +51 987 654 321.'), 'Llama al [teléfono].');
  assert.equal(t('Llama al (01) 234-5678 o al 987654321.'), 'Llama al [teléfono] o al [teléfono].');
  assert.equal(t('WhatsApp 987.654.321 o 612.345.678'), 'WhatsApp [teléfono] o [teléfono]');
  assert.equal(t('Marca 987 - 654 - 321'), 'Marca [teléfono]');
  // Ante la duda, también: un número de siete cifras o más sin moneda ni forma conocida.
  assert.equal(t('12345678 visitas'), '[teléfono] visitas');
  // Lo que se queda.
  assert.equal(t('Hasta el 2026-10-04 por S/ 1.500.000.'), 'Hasta el 2026-10-04 por S/ 1.500.000.');
  assert.equal(t('Del 04-10-2026 al 04.11.2026, de 2019-2024.'), 'Del 04-10-2026 al 04.11.2026, de 2019-2024.');
  assert.equal(t('Entre 1.500.000 - 2.000.000 o 1.500.000-2.000.000 al año.'), 'Entre 1.500.000 - 2.000.000 o 1.500.000-2.000.000 al año.');
  assert.equal(t('Cuesta $ 1 500 000 o 15.000.000 en 30 días.'), 'Cuesta $ 1 500 000 o 15.000.000 en 30 días.');
  const largo = sinDatosDeContacto('a'.repeat(50), 10);
  assert.deepEqual(largo, { texto: `${'a'.repeat(10)}…`, recortado: true });
});
