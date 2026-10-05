// LAS HERRAMIENTAS DEL CEREBRO SOBRE LA BASE SEMBRADA: LAS CLAVES EXACTAS Y LA CIFRA DE LA PANTALLA. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `lib/agentes/executive/adaptadores/` (AG5 y AG6), sobre la empresa con datos de
// `db/sembrado/casos-de-los-agentes.ts`:
//
//   · AG-45: cada herramienta del catálogo devuelve EXACTAMENTE las claves que declara. Con una lista negra,
//     una columna nueva aparecería sola en lo que viaja al modelo; con ésta, una clave nueva hace fallar
//     esta prueba y alguien decide. Y ningún resultado lleva un correo, el teléfono sembrado ni una clave de
//     contacto, aunque las filas de donde salen los tengan: los leads del scraper, el análisis del Espía y
//     el ICP se siembran CON correos y teléfonos.
//   · AG-101: la misma cifra que la ruta de su pantalla, con el mismo período, para las de AG5. Las de AG6, en
//     las cuatro ventanas, están en la 215.
//
// Las tres tablas de `public` que leen `leads_del_scraper`, `espia` y `fundaciones` no existen en la base
// local: las crea `pruebas/apoyo/tablas-de-public.ts` para esta prueba, y las quita al terminar.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar } from '../apoyo/conexiones.ts';
import { crearTablasDePublic, quitarTablasDePublic } from '../apoyo/tablas-de-public.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { hashDeToken } from '../../lib/autorizacion/sesion.ts';
import { DOMINIO, leerRespuesta, pedirComo, sesionDe } from '../apoyo/closer.ts';
import {
  ZONA_DE_LOS_CASOS,
  quitarEmpresasDeLosAgentes,
  sembrarCasosDeLosAgentes,
  type EmpresasDeLosAgentes,
} from '../../db/sembrado/casos-de-los-agentes.ts';
import { HERRAMIENTAS, ejecutarHerramienta, herramientasPara, type DatosDeLaRuta } from '../../lib/agentes/executive/herramientas.ts';
import { LARGO_DEL_EXTRACTO } from '../../lib/agentes/executive/adaptadores/fundaciones.ts';
import { GET as acquisition } from '../../app/api/acquisition/route.ts';
import { POST as preguntarAlCerebro } from '../../app/api/executive/route.ts';
import { cifrar } from '../../lib/credenciales/cifrado.ts';
import { instalarModeloFalso, pideHerramienta, respuestaDelModelo, respuestaMinima } from '../apoyo/cerebro.ts';
import { GET as sales } from '../../app/api/sales/route.ts';
import { GET as leadsPortal } from '../../app/api/leads-portal/route.ts';

const PREFIJO = 'agentes-213-';
let admin: Client;
let e: EmpresasDeLosAgentes;
let token: string;
let creadas: string[] = [];

/** Un teléfono que se siembra en los leads, en el análisis y en el ICP, y que no puede salir. */
const TELEFONO_SEMBRADO = '51987654321';
/** El primer análisis del Espía que siembra `casos-de-los-agentes.ts`. */
const TRABAJO_CON_ANALISIS = '00000000-0000-4000-8000-000000000001';
const LEADS_DEL_SCRAPER = [
  { source: 'maps', name: 'Clínica sintética uno', email: 'clinica-uno@leads-213.test', phone: '+51 987 654 321', website: 'https://uno.test' },
  { source: 'maps', name: 'Clínica sintética dos', email: 'clinica-dos@leads-213.test', phone: null, website: null },
  { source: 'linkedin', name: 'Persona sintética', email: null, phone: null, website: null },
];

/** Lo que el backend de Python escribiría en `public`, con datos de contacto adentro. */
async function sembrarPublic(org: string): Promise<void> {
  const trabajos = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];
  for (const [i, t] of trabajos.entries()) {
    await admin.query(
      `insert into public.aria_cc_scraper_trabajos (org_id, id, fuente, status, business_type, location, results_data)
         values ($1, $2, 'ad-spy', 'COMPLETED', $3, 'PE', $4)`,
      [org, t, `competidor sintético ${i + 1}`, JSON.stringify({ data: [{}, {}, {}] })],
    );
  }
  for (const l of LEADS_DEL_SCRAPER) {
    await admin.query(
      `insert into public.aria_cc_scraper_leads (org_id, trabajo_id, source, name, email, phone, website) values ($1, $2, $3, $4, $5, $6, $7)`,
      [org, trabajos[0], l.source, l.name, l.email, l.phone, l.website],
    );
  }
  // El análisis del Espía con lo que un anuncio ajeno puede traer: un correo, un teléfono, una fecha y un precio.
  await admin.query(`update negocio.analisis_del_espia set texto = $3 where org_id = $1 and trabajo_id = $2`, [
    org,
    TRABAJO_CON_ANALISIS,
    '## Hooks\n\n- Escríbenos a ventas@competidor-213.test o al +51 987 654 321.\n- Oferta hasta el 2026-10-04 por S/ 1.500.000.',
  ]);
  // Fundaciones: la ficha llena (con el teléfono de quien la llenó) y un ICP largo con un correo adentro.
  const icp = `# Tu cliente ideal\n\nContacto del dueño: dueno@clinica-213.test, ${TELEFONO_SEMBRADO}.\n\n${'Dueños de clínicas que quieren llenar su agenda. '.repeat(60)}`;
  await admin.query(`insert into public.aria_cc_foundations (org_id, profile, history) values ($1, $2, $3)`, [
    org,
    JSON.stringify({ 0: { nombre: 'Clínica sintética', telefono: TELEFONO_SEMBRADO } }),
    JSON.stringify({ 3: [{ date: '2026-10-01', output: icp }] }),
  ]);

  // Una cita de mañana, del closer vinculado: el sembrado sólo tiene citas pasadas, y la agenda mira adelante.
  await admin.query(
    `insert into negocio.citas (org_id, contacto_id, ghl_evento_id, ghl_calendario_id, inicio_el, fin_el, estado_ghl, crm_asignado_a)
     select org_id, id, $2, 'calendario-213', now() + interval '1 day', now() + interval '1 day 45 minutes', 'confirmed', crm_asignado_a
       from negocio.contactos where org_id = $1 and crm_asignado_a is not null and territorio = 'closer' order by alta_en_el_crm desc limit 1`,
    [org, `${PREFIJO}cita-futura`],
  );
}

before(async () => {
  // Lo que `montar` fija: sin él, el portero rechaza toda mutación por el origen.
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  e = await sembrarCasosDeLosAgentes(PREFIJO);
  creadas = await crearTablasDePublic(admin);
  await sembrarPublic(e.conDatos);
  token = await sesionDe(e.personas.admin);
});
after(async () => {
  await admin.query('delete from identidad.sesiones where token_hash = $1', [hashDeToken(token)]);
  await quitarTablasDePublic(admin, creadas);
  await quitarEmpresasDeLosAgentes(PREFIJO);
  await cerrarClientes();
  await cerrarTodo();
});

/** Todas las secciones con herramientas, y las integraciones: el catálogo entero. */
const SECCIONES_DE_TODO = ['acquisition', 'creative', 'conversion', 'conversation', 'sales', 'contacts', 'setter', 'closer', 'analizadores', 'tools', 'icp'];
const TODAS = herramientasPara(SECCIONES_DE_TODO, null, true);
const DE_LA_RUTA: DatosDeLaRuta = {
  noAudita: 'sin_clave_ia',
  integraciones: {
    crm: { cargado: true, estado: 'activa' },
    ia: { cargado: false, estado: 'ausente' },
    pagos: { cargado: false, estado: 'ausente' },
    tldv: { cargado: true, estado: 'vencida' },
    meta: { cargado: true, estado: 'ilegible' },
  },
};
async function correr(nombre: string, argumentos: Record<string, unknown> = { periodo: '30d' }): Promise<Record<string, unknown>> {
  const contexto = { zona: ZONA_DE_LOS_CASOS, usuarioId: e.personas.admin, secciones: SECCIONES_DE_TODO, deLaRuta: DE_LA_RUTA };
  const r = await conOrganizacion(e.conDatos, () => ejecutarHerramienta(nombre, argumentos, TODAS, contexto));
  assert.equal(r.tipo, 'datos', `${nombre} no devolvió datos`);
  return (r as { datos: Record<string, unknown> }).datos;
}

const claves = (o: unknown) => Object.keys(o as object).sort();

/**
 * Las claves exactas de cada herramienta, arriba y en sus filas. La lista se escribe acá, no se deriva. Las
 * filas son las de `{ filas, total }` o las de una lista. `argumentos` cuando no es `{ periodo: '30d' }`.
 */
const ESPERADAS: Record<string, { arriba: string[]; filas?: [string, string[]][]; argumentos?: Record<string, unknown> }> = {
  embudos_de_acquisition: {
    arriba: ['anterior', 'campanas', 'cobertura', 'funnels', 'periodo', 'sinComparacion', 'sinCostos', 'sinFunnel', 'total', 'ventana'],
    filas: [['campanas', ['campana', 'cifras', 'estado', 'funnel', 'nombre']]],
  },
  calidad_de_piezas: {
    arriba: ['aviso', 'campoDeIcp', 'congeladas', 'desde', 'dias', 'hasta', 'piezas', 'puente'],
    filas: [['piezas', ['agendaron', 'anunciosDeMeta', 'conPuntaje', 'contactos', 'creativo', 'etapa', 'icpPromedio', 'tasaDeAgenda']]],
  },
  rendimiento_de_piezas: {
    arriba: ['aviso', 'desde', 'desdeElDesglose', 'dias', 'fueraDeAlcance', 'gastoTotal', 'hasta', 'piezas'],
    filas: [
      [
        'piezas',
        ['anuncios', 'clickToLanding', 'clics', 'cpc', 'cpm', 'creativo', 'ctr', 'diasConEntrega', 'gasto', 'hookRate', 'impresiones', 'interaccion', 'landingPageViewRate', 'linkCtr'],
      ],
    ],
  },
  fatiga_de_piezas: {
    arriba: ['aviso', 'conVeredicto', 'dias', 'nota', 'piezas', 'umbralDeCaida'],
    filas: [['piezas', ['caida', 'creativo', 'ctrTardio', 'ctrTemprano', 'desde', 'dias', 'fatigado', 'hasta', 'motivo', 'porque']]],
  },
  recorrido_de_los_leads: {
    arriba: ['aviso', 'cobertura', 'cohorte', 'corte', 'desde', 'dias', 'familias', 'hasta'],
    filas: [['familias', ['agendaron', 'capturadaAlReservar', 'contactos', 'familia', 'porcion', 'titulo']]],
  },
  formulario_de_la_landing: {
    arriba: [
      'agendadoSegunLasCitas', 'aviso', 'campoDelFormulario', 'cobertura', 'corte', 'desde', 'dias', 'estados', 'finalizacion', 'fueraDeAlcance',
      'fueraDelVocabulario', 'hasta',
    ],
  },
  auditoria_de_agentes: {
    arriba: ['casosPorPatron', 'casosTruncados', 'hayMas', 'noAudita', 'tarjetas'],
    filas: [
      ['tarjetas', ['agente', 'amarillos', 'analizadas', 'auditables', 'hallazgosAbiertos', 'intervencionesAbiertas', 'rojos', 'tienePrompt', 'ultimoEl', 'verdes']],
      ['casosPorPatron', ['agente', 'casos', 'patron']],
    ],
    argumentos: {},
  },
  lead_flow: {
    arriba: [
      'agendaron', 'agendaronSinResponder', 'agendaronSoloCongeladas', 'agendaronTrasResponder', 'aviso', 'avisoDeLaVentana', 'avisoDeLatencias',
      'avisoDelBooking', 'bookingRate', 'cohorte', 'desde', 'dias', 'escritos', 'escritosSinContestar', 'hastaElPrimerIntento',
      'hastaLaPrimeraRespuesta', 'mitad', 'respondieron', 'sinNingunMensaje', 'tasa',
    ],
  },
  atribucion_del_lead: {
    arriba: ['aviso', 'dias', 'fueraDeHorario', 'porCampana', 'porFuente'],
    filas: [
      ['porFuente', ['agendaron', 'cohorte', 'esElResto', 'etiqueta', 'tasa']],
      ['porCampana', ['agendaron', 'cohorte', 'esElResto', 'etiqueta', 'tasa']],
    ],
  },
  consumo_del_precall: {
    arriba: ['aviso', 'completo', 'conCampo', 'detalleSePublica', 'dias', 'parcial', 'registraron', 'sinRama', 'sobre', 'tasa'],
  },
  sentimiento_por_flujo: { arriba: ['appflow', 'leadflow'] },
  dinero_del_mes: { arriba: ['acuerdos', 'cobrado', 'mes', 'nota', 'ventas'], argumentos: {} },
  economia_del_negocio: {
    arriba: ['aviso', 'cobrado', 'costoPorVenta', 'desde', 'gastoEntero', 'gastoHasta', 'hasta', 'inversion', 'mes', 'nota', 'retorno', 'ventas', 'ventasSinMonto'],
    argumentos: {},
  },
  cadena_de_cierre: {
    arriba: ['aviso', 'cohorte', 'coberturaDeLaCohorte', 'congeladas', 'descartadas', 'desde', 'dias', 'eslabones', 'hasta', 'intentosSinCita', 'piso'],
  },
  ciclo_hasta_la_cita: {
    arriba: ['aviso', 'avisoDelTecho', 'cobertura', 'cohorte', 'dias', 'p50', 'p90', 'piso', 'sinCitaTodavia', 'techoDeLaVentana'],
  },
  cierre_por_closer: {
    arriba: ['aviso', 'bajoElPiso', 'closers', 'coberturaDeLaTabla', 'concentracion', 'dias', 'fueraDeLasFilas', 'piso'],
    filas: [
      [
        'closers',
        ['aviso', 'canceladas', 'citas', 'conAsistencia', 'contactos', 'intentos', 'nombre', 'porSalida', 'sePresentaron', 'tasaDeAsistencia', 'tasaDeCancelacion', 'tasaDeCierre', 'usuarioId', 'ventas'],
      ],
    ],
  },
  cancelacion_de_citas: {
    arriba: [
      'aviso', 'avisoDeAsistencia', 'avisoDeConfirmacion', 'avisoDeLaVentana', 'canceladas', 'citas', 'conAsistencia', 'conConfirmacion',
      'confirmaron', 'congeladas', 'descartados', 'dias', 'horasHastaLaCita', 'noShowReportado', 'reagendadas', 'sePresentaron', 'tasa',
      'tasaDeAsistencia', 'tasaDeConfirmacion', 'tasaDeReagendamiento',
    ],
  },
  cohorte_de_leads: {
    arriba: ['aviso', 'cohorte', 'dias', 'hayVentasRegistradas', 'leads', 'piso', 'sinCalificar', 'todos', 'tramos', 'truncado'],
    filas: [['leads', ['altaEl', 'asistencia', 'campana', 'cita', 'creativo', 'descartado', 'id', 'monto', 'nombre', 'planton', 'puntaje', 'territorio', 'tramo', 'vendio']]],
  },
  colas_del_setter: { arriba: ['colas', 'tareasPendientes', 'truncado'], argumentos: {} },
  inicio_del_setter: {
    arriba: ['aNurture', 'agendas', 'agendasDelAgente', 'comision', 'descalificados', 'mes', 'tareasPendientes', 'tasaDeAsistencia', 'vendidoChico', 'ventasChicas'],
    argumentos: {},
  },
  pipeline_del_setter: { arriba: ['cartera', 'clasificados', 'columnas', 'hayMas', 'total'], filas: [['columnas', ['clave', 'cuantos', 'nombre']]], argumentos: {} },
  mi_dia_del_closer: { arriba: ['colas', 'de', 'tareasPendientes', 'truncado'], argumentos: {} },
  inicio_del_closer: {
    arriba: ['acuerdos', 'cobrado', 'comision', 'conCitaAgendada', 'de', 'mes', 'noShows', 'nota', 'tareasPendientes', 'tasaDeAsistencia', 'ventas'],
    argumentos: {},
  },
  agenda_del_closer: {
    arriba: ['avisoDeZona', 'de', 'dias', 'frescura', 'hasta', 'hoy', 'total', 'zonaHoraria'],
    filas: [['dias', ['citas', 'dia']]],
    argumentos: {},
  },
  pipeline_del_closer: {
    arriba: ['cartera', 'clasificados', 'columnas', 'de', 'hayMas', 'total'],
    filas: [['columnas', ['clave', 'cuantos', 'nombre']]],
    argumentos: {},
  },
  leads_del_scraper: {
    arriba: ['desde', 'dias', 'enviadosAlCrm', 'hasta', 'porFuente', 'porQueNoHayEnviados', 'total'],
    filas: [['porFuente', ['busquedas', 'conCorreo', 'conSitio', 'conTelefono', 'fuente', 'leads', 'sinContacto']]],
  },
  espia: {
    arriba: ['busquedas'],
    filas: [['busquedas', ['anuncios', 'consulta', 'creadoEl', 'id', 'pais', 'status', 'tieneAnalisis']]],
    argumentos: { trabajo: null },
  },
  fundaciones: {
    arriba: ['extractos', 'pasos', 'researchHechos', 'siguiente'],
    filas: [['pasos', ['clave', 'completo', 'id', 'paso', 'ultimaEl', 'versiones']]],
    argumentos: {},
  },
  frescura: { arriba: ['tareas'], argumentos: {} },
  estado_de_integraciones: { arriba: ['integraciones'], argumentos: {} },
};

/** Las filas de un campo: las de `{ filas, total }`, o la lista misma. */
const filasDe = (x: unknown): unknown[] => (Array.isArray(x) ? x : (x as { filas: unknown[] }).filas);

/** Lo que no puede viajar: un correo, el teléfono sembrado o una clave de contacto. */
function sinContacto(nombre: string, datos: unknown): void {
  const texto = JSON.stringify(datos);
  assert.doesNotMatch(texto, /@/, `${nombre} devolvió un correo`);
  assert.ok(!texto.replace(/\D/g, '').includes(TELEFONO_SEMBRADO), `${nombre} devolvió un teléfono`);
  assert.doesNotMatch(texto, /"(email|telefono|correo|phone|salaUrl|contactoId)"/, `${nombre} devolvió una clave de contacto`);
}

test('cada herramienta del catálogo tiene su juego de claves escrito acá', () => {
  assert.deepEqual(HERRAMIENTAS.map((h) => h.nombre).sort(), Object.keys(ESPERADAS).sort());
});

for (const [nombre, esperado] of Object.entries(ESPERADAS)) {
  test(`\`${nombre}\`: exactamente sus claves, y ningún correo ni teléfono`, async () => {
    const datos = await correr(nombre, esperado.argumentos ?? { periodo: '30d' });
    assert.deepEqual(claves(datos), [...esperado.arriba].sort());
    for (const [donde, deLaFila] of esperado.filas ?? []) {
      const filas = filasDe(datos[donde]);
      assert.ok(filas.length > 0, `${nombre}: la base sembrada no dio filas en ${donde}, y la prueba no miraría nada`);
      for (const f of filas) assert.deepEqual(claves(f), [...deLaFila].sort());
    }
    /* Las colas viajan como conteos. En la base sembrada están vacías, así que la negativa de abajo no
       vería un contacto que se colara: lo que se mira es que cada cola sea un número. */
    if ('colas' in datos) {
      for (const [cola, n] of Object.entries(datos.colas as object)) assert.equal(typeof n, 'number', `${nombre}: la cola ${cola} no es un conteo`);
    }
    sinContacto(nombre, datos);
  });
}

test('el análisis del Espía y el extracto del ICP viajan recortados y sin datos de contacto', async () => {
  const conAnalisis = await correr('espia', { trabajo: TRABAJO_CON_ANALISIS });
  assert.deepEqual(claves(conAnalisis.analisis), ['creadoEl', 'recortado', 'texto']);
  const texto = (conAnalisis.analisis as { texto: string }).texto;
  assert.match(texto, /\[correo\]/);
  assert.match(texto, /\[teléfono\]/);
  // Lo que no es un contacto se queda: una fecha y un precio con sus miles.
  assert.match(texto, /2026-10-04/);
  assert.match(texto, /1\.500\.000/);
  sinContacto('espia', conAnalisis);

  const f = await correr('fundaciones', {});
  const extractos = f.extractos as Record<string, { texto: string; recortado: boolean } | null>;
  assert.deepEqual(Object.keys(extractos).sort(), ['icp', 'oferta']);
  assert.equal(extractos.oferta, null, 'la oferta no se generó: su extracto es null');
  assert.ok(extractos.icp!.recortado, 'el ICP sembrado es más largo que el extracto');
  assert.ok(extractos.icp!.texto.length <= LARGO_DEL_EXTRACTO + 1);
  sinContacto('fundaciones', f);
  assert.deepEqual(f.siguiente, { clave: 'research', paso: 'Research' });

  // Los leads del scraper con correo y teléfono se cuentan; ninguno viaja.
  const l = await correr('leads_del_scraper');
  assert.equal(l.total, LEADS_DEL_SCRAPER.length);
  assert.deepEqual(
    (l.porFuente as { fuente: string; conCorreo: number; conTelefono: number; sinContacto: number }[]).map((x) => [x.fuente, x.conCorreo, x.conTelefono, x.sinContacto]),
    [['maps', 2, 1, 0], ['linkedin', 0, 0, 1]],
  );
  assert.equal(l.enviadosAlCrm, null);
});

test('`frescura` habla sólo de las fuentes de las secciones que se ven', async () => {
  const deLas = async (secciones: string[]) => {
    const contexto = { zona: ZONA_DE_LOS_CASOS, usuarioId: e.personas.admin, secciones, deLaRuta: DE_LA_RUTA };
    const r = await conOrganizacion(e.conDatos, () => ejecutarHerramienta('frescura', {}, herramientasPara(secciones), contexto));
    return Object.keys((r as { datos: { tareas: object } }).datos.tareas).sort();
  };
  assert.deepEqual(await deLas(['acquisition']), ['anuncios', 'contactos']);
  assert.deepEqual(await deLas(['conversion']), ['contactos']);
  assert.deepEqual(await deLas(['closer', 'creative']), ['anuncios', 'citas', 'contactos', 'mensajes']);
  assert.deepEqual(await deLas(['analizadores']), ['analizadores', 'reintentos']);
  // La sonda es de la plataforma: no viaja a nadie.
  assert.ok(!(await deLas(SECCIONES_DE_TODO)).includes('sonda'));
});

test('la misma cifra que la pantalla: Acquisition, Sales y Leads › De GHL con 30 días', async () => {
  const pantalla = async (ruta: (r: Request) => Promise<Response>, camino: string) =>
    (await leerRespuesta<Record<string, unknown>>(await ruta(pedirComo(camino, token)))).cuerpo;

  const acq = await pantalla(acquisition, '/api/acquisition?periodo=30d');
  const embudos = await correr('embudos_de_acquisition');
  const deLaPantalla = acq.embudos as { total: { inversion: number }; cobertura: unknown };
  assert.equal((embudos.total as { inversion: number }).inversion, deLaPantalla.total.inversion);
  assert.equal(deLaPantalla.total.inversion, 4060, 'la base sembrada cambió: la comparación dejó de mirar la cifra de 07');
  assert.deepEqual(embudos.cobertura, deLaPantalla.cobertura);

  const sal = await pantalla(sales, '/api/sales?periodo=30d');
  const cadena = await correr('cadena_de_cierre');
  const cadenaDeLaPantalla = sal.cadena as { cohorte: number; eslabones: { clave: string; contactos: number }[] };
  assert.equal(cadena.cohorte, cadenaDeLaPantalla.cohorte);
  assert.deepEqual(
    (cadena.eslabones as { clave: string; contactos: number }[]).map((x) => [x.clave, x.contactos]),
    cadenaDeLaPantalla.eslabones.map((x) => [x.clave, x.contactos]),
  );
  assert.deepEqual(await correr('dinero_del_mes', {}).then((d) => d.ventas), (sal.dinero as { ventas: unknown }).ventas);
  const cierre = await correr('cierre_por_closer');
  assert.deepEqual(
    (cierre.closers as { filas: { usuarioId: string; citas: number | null }[] }).filas.map((f) => [f.usuarioId, f.citas]),
    (sal.closers as { filas: { usuarioId: string; citas: number | null }[] }).filas.map((f) => [f.usuarioId, f.citas]),
  );

  const portal = await pantalla(leadsPortal, '/api/leads-portal?periodo=30d');
  const cohorte = await correr('cohorte_de_leads');
  assert.deepEqual(cohorte.cohorte, portal.cohorte);
  assert.deepEqual(cohorte.todos, portal.todos);
});

test('el hilo guardado no guarda los nombres que trajo la evidencia; la respuesta del momento sí los muestra', async () => {
  /* La cohorte trae el nombre de cada lead, y el modelo puede repetirlo en lo que escribe. Lo que vuelve a
     la persona en el momento lo lleva; lo que queda en el hilo, no (AG-48). */
  await admin.query('insert into identidad.organizaciones_credenciales (org_id, ia_clave_cifrada) values ($1, $2)', [e.conDatos, cifrar('sk-de-prueba-213')]);
  const cohorte = await correr('cohorte_de_leads');
  const nombre = (cohorte.leads as { filas: { nombre: string }[] }).filas[0]!.nombre;
  const modelo = instalarModeloFalso([
    respuestaDelModelo([pideHerramienta('cohorte_de_leads', { periodo: '30d' })]),
    respuestaDelModelo([pideHerramienta('responder', respuestaMinima(`El lead más reciente es ${nombre}.`))]),
  ]);
  try {
    const r = await leerRespuesta<{ respuesta: { conclusion: string } }>(
      await preguntarAlCerebro(pedirComo('/api/executive', token, { metodo: 'POST', cuerpo: { pregunta: '¿Quién entró último?' } })),
    );
    assert.equal(r.estado, 200);
    assert.match(r.cuerpo.respuesta.conclusion, new RegExp(nombre));
  } finally {
    modelo.quitar();
  }
  const guardado = await admin.query<{ texto: string; respuesta: unknown; evidencia: unknown }>(
    `select texto, respuesta, evidencia from negocio.mensajes_del_executive where org_id = $1 and rol = 'cerebro'`,
    [e.conDatos],
  );
  assert.equal(guardado.rowCount, 1);
  const todo = JSON.stringify(guardado.rows[0]);
  assert.ok(!todo.includes(nombre), 'el hilo guardado conserva el nombre de una persona');
  assert.equal(guardado.rows[0]!.texto, 'El lead más reciente es [persona].');
});
