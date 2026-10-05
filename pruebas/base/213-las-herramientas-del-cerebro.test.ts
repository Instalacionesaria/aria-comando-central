// LAS HERRAMIENTAS DEL CEREBRO SOBRE LA BASE SEMBRADA: LAS CLAVES EXACTAS Y LA CIFRA DE LA PANTALLA. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `lib/agentes/executive/adaptadores/` (AG5), sobre la empresa con datos de
// `db/sembrado/casos-de-los-agentes.ts`:
//
//   · AG-45: cada herramienta devuelve EXACTAMENTE las claves que declara. Con una lista negra, una columna
//     nueva aparecería sola en lo que viaja al modelo; con ésta, una clave nueva hace fallar esta prueba y
//     alguien decide. Y ningún resultado lleva un correo ni las claves `email` o `telefono`.
//   · AG-101: cada herramienta da la misma cifra que la ruta de su pantalla, con el mismo período —«consume,
//     no recalcula»—. Se compara contra la ruta de verdad, con la sesión del admin sintético.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar } from '../apoyo/conexiones.ts';
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
import { HERRAMIENTAS, ejecutarHerramienta, herramientasPara } from '../../lib/agentes/executive/herramientas.ts';
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

before(async () => {
  // Lo que `montar` fija: sin él, el portero rechaza toda mutación por el origen.
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');
  e = await sembrarCasosDeLosAgentes(PREFIJO);
  token = await sesionDe(e.personas.admin);
});
after(async () => {
  await admin.query('delete from identidad.sesiones where token_hash = $1', [hashDeToken(token)]);
  await quitarEmpresasDeLosAgentes(PREFIJO);
  await cerrarClientes();
  await cerrarTodo();
});

const TODAS = herramientasPara(['acquisition', 'sales', 'contacts', 'conversation']);
async function correr(nombre: string, argumentos: Record<string, unknown> = { periodo: '30d' }): Promise<Record<string, unknown>> {
  const r = await conOrganizacion(e.conDatos, () => ejecutarHerramienta(nombre, argumentos, TODAS, { zona: ZONA_DE_LOS_CASOS, usuarioId: e.personas.admin }));
  assert.equal(r.tipo, 'datos', `${nombre} no devolvió datos`);
  return (r as { datos: Record<string, unknown> }).datos;
}

const claves = (o: unknown) => Object.keys(o as object).sort();

/** Las claves exactas de cada herramienta, arriba y en sus filas. La lista se escribe acá, no se deriva. */
const ESPERADAS: Record<string, { arriba: string[]; filas?: [string, string[]] }> = {
  embudos_de_acquisition: {
    arriba: ['anterior', 'campanas', 'cobertura', 'funnels', 'periodo', 'sinComparacion', 'sinCostos', 'sinFunnel', 'total', 'ventana'],
    filas: ['campanas', ['campana', 'cifras', 'estado', 'funnel', 'nombre']],
  },
  dinero_del_mes: { arriba: ['acuerdos', 'cobrado', 'mes', 'nota', 'ventas'] },
  cadena_de_cierre: {
    arriba: ['aviso', 'cohorte', 'coberturaDeLaCohorte', 'congeladas', 'descartadas', 'desde', 'dias', 'eslabones', 'hasta', 'intentosSinCita', 'piso'],
  },
  ciclo_hasta_la_cita: {
    arriba: ['aviso', 'avisoDelTecho', 'cobertura', 'cohorte', 'dias', 'p50', 'p90', 'piso', 'sinCitaTodavia', 'techoDeLaVentana'],
  },
  cierre_por_closer: {
    arriba: ['aviso', 'bajoElPiso', 'closers', 'coberturaDeLaTabla', 'concentracion', 'dias', 'fueraDeLasFilas', 'piso'],
    filas: [
      'closers',
      ['aviso', 'canceladas', 'citas', 'conAsistencia', 'contactos', 'intentos', 'nombre', 'porSalida', 'sePresentaron', 'tasaDeAsistencia', 'tasaDeCancelacion', 'tasaDeCierre', 'usuarioId', 'ventas'],
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
    filas: ['leads', ['altaEl', 'asistencia', 'campana', 'cita', 'creativo', 'descartado', 'id', 'monto', 'nombre', 'planton', 'puntaje', 'territorio', 'tramo', 'vendio']],
  },
};

test('cada herramienta del catálogo tiene su juego de claves escrito acá', () => {
  assert.deepEqual(HERRAMIENTAS.map((h) => h.nombre).sort(), Object.keys(ESPERADAS).sort());
});

for (const [nombre, esperado] of Object.entries(ESPERADAS)) {
  test(`\`${nombre}\`: exactamente sus claves, y ningún correo ni teléfono`, async () => {
    const datos = await correr(nombre, nombre === 'dinero_del_mes' ? {} : { periodo: '30d' });
    assert.deepEqual(claves(datos), [...esperado.arriba].sort());
    if (esperado.filas) {
      const [donde, deLaFila] = esperado.filas;
      const filas = (datos[donde] as { filas: unknown[]; total: number }).filas;
      assert.ok(filas.length > 0, `${nombre}: la base sembrada no dio filas en ${donde}, y la prueba no miraría nada`);
      for (const f of filas) assert.deepEqual(claves(f), [...deLaFila].sort());
    }
    const texto = JSON.stringify(datos);
    assert.doesNotMatch(texto, /@/, `${nombre} devolvió un correo`);
    assert.doesNotMatch(texto, /"(email|telefono|correo|phone)"/, `${nombre} devolvió una clave de contacto`);
  });
}

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
