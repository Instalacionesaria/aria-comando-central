// LAS BURBUJAS DEL CEREBRO: LA EVIDENCIA ADENTRO, LA MASCOTA EN LA PRIMERA, Y LO QUE DICE CADA ESTADO. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// La pantalla del cerebro (AG7 de los agentes; `docs/OTROS/agentes/03-EL-CEREBRO.md`, AG-48, AG-52, AG-55 y
// AG-57):
//
//   · la evidencia es un desplegable DENTRO de la primera burbuja de la respuesta, no un panel aparte
//     (`D-28`);
//   · la mascota va sólo en la primera burbuja de cada respuesta, con el estado que decidió el servidor, y
//     sigue el cursor sólo la del turno actual —cada instancia que sigue lleva su bucle por cuadro—;
//   · ningún componente del cerebro estrena los ids del panel del prototipo (`156`) ni un id propio;
//   · los turnos de un hilo guardado salen de lo que guardó el servidor, y una pregunta fallida lo dice;
//   · cada estado del cerebro dice lo de la tabla de AG-52, y un rechazo del modelo no le muestra a la
//     persona lo técnico;
//   · el traspaso se toma una sola vez, y el período anunciado es el último de esa pantalla.
//
// Los componentes se leen del fuente: no hay un renderizador de React en las pruebas. Las funciones puras
// se ejecutan.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import { puedeIrAAjustes, textoDelEstado, textoDelRechazo } from '../../lib/agentes/pantalla.ts';
import { turnosDeUnHilo } from '../../lib/agentes/usarCerebro.ts';
import { anunciarPeriodo, periodoAnunciado } from '../../lib/agentes/periodos.ts';

const fuente = (r: string): string => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (t: string): string =>
  t.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

test('la evidencia es un desplegable dentro de la primera burbuja, no un panel aparte', () => {
  const r = sinComentarios(fuente('components/cerebro/Respuesta.jsx'));
  const primera = r.indexOf('<div className="cb-burbuja">');
  // La primera burbuja no tiene otro `div` adentro: el primer cierre después de abrirla es el suyo.
  const cierre = r.indexOf('</div>', primera);
  assert.ok(primera > 0, 'la respuesta perdió su primera burbuja');
  assert.ok(
    r.indexOf('<Evidencia evidencia={evidencia} />', primera) > primera && r.indexOf('<Evidencia evidencia={evidencia} />', primera) < cierre,
    'la evidencia no está dentro de la primera burbuja',
  );
  const e = sinComentarios(fuente('components/cerebro/Evidencia.jsx'));
  assert.match(e, /<details className="cb-evidencia">/, 'la evidencia dejó de ser un desplegable');
  // Las filas reales, con «mostrando X de N» cuando el adaptador cortó.
  assert.match(e, /Mostrando \{filas\.length\} de \{total\}/);
  // Ningún panel lateral ni ventana para la evidencia.
  assert.doesNotMatch(r + e, /<Ventana|className="[^"]*\b(side|drawer|cw|lg)\b/, 'la evidencia se abre en un panel aparte');
});

test('la mascota va sólo en la primera burbuja, con el estado del servidor, y sigue el cursor sólo en el turno actual', () => {
  const r = sinComentarios(fuente('components/cerebro/Respuesta.jsx'));
  assert.equal((r.match(/<Mascota\b/g) ?? []).length, 1, 'la respuesta dibuja más de una mascota');
  const mascota = r.indexOf('<Mascota');
  assert.ok(mascota < r.indexOf('<div className="cb-burbujas">'), 'la mascota no va antes de las burbujas, en su avatar');
  assert.match(r, /<Mascota diametro=\{28\} estado=\{mascota\} sigue=\{actual\} \/>/, 'la mascota no lleva el estado del servidor, o sigue el cursor en un turno viejo');
  const c = sinComentarios(fuente('components/cerebro/Conversacion.jsx'));
  assert.match(c, /const ultimo = pendiente === null \? turnos\.findLastIndex\(\(t\) => t\.tipo === 'cerebro'\) : -1;/);
  assert.match(c, /actual=\{aLaVista && i === ultimo\}/, 'más de un turno, o uno fuera de la vista, sigue el cursor');
  // Mientras se espera, `pensando`: el único estado que pone el navegador, porque es el de no tener respuesta.
  assert.match(c, /<Mascota diametro=\{28\} estado="pensando" sigue=\{aLaVista\} viva=\{aLaVista\} \/>/);
});

test('ningún componente del cerebro usa los ids del prototipo ni uno propio', () => {
  const PROHIBIDOS = ['askPanel', 'askScrim', 'askTrigger', 'drawer', 'scrim', 'lgPanel', 'lgScrim'];
  const carpeta = join(RAIZ, 'components/cerebro');
  const archivos = readdirSync(carpeta).filter((n) => n.endsWith('.jsx'));
  assert.ok(archivos.length >= 5, 'no se encontraron los componentes del cerebro');
  for (const n of archivos) {
    const c = sinComentarios(fuente(`components/cerebro/${n}`));
    for (const id of PROHIBIDOS) assert.ok(!c.includes(`"${id}"`) && !c.includes(`'${id}'`), `${n} usa el id «${id}» del prototipo`);
    assert.doesNotMatch(c, /\sid=/, `${n} estrena un id: el panel es una \`Ventana\` y no necesita ninguno`);
  }
  // El panel que sube es una `Ventana`, con su foco, su Escape y su fondo.
  assert.match(sinComentarios(fuente('components/cerebro/PanelDelCerebro.jsx')), /<Ventana titulo="El cerebro" subtitulo=\{sobre\} clase="vt-panel" alCerrar=\{alCerrar\}>/);
});

test('los turnos de un hilo guardado salen de lo que guardó el servidor, y una pregunta fallida lo dice', () => {
  const respuesta = {
    conclusion: 'Sin ventas este mes.',
    cifras: [{ valor: 0, que_es: 'ventas', muestra: 'sobre 3 resultados', periodo: 'mes', fuente: 'sales', ev: 'ev-1', campo: 'ventas.valor' }],
    confianza: { nivel: 'alta', porque: 'cuenta directa' },
    areas: ['sales'],
    recomendaciones: [],
    no_hay_dato: [],
    siguientes: [],
    avisos: [],
  };
  /* Dos preguntas seguidas y sus respuestas en otro orden: cada una va debajo de la que cita en `respondeA`,
     no de la que sigue (AG-51). Y una tercera reservada que nadie cerró dice que no tiene respuesta. */
  const otra = { ...respuesta, conclusion: 'Tres citas esta semana.', cifras: [] };
  const turnos = turnosDeUnHilo([
    { id: 'p1', rol: 'persona', texto: '¿Cuántas ventas?', estado: 'respondida', respuesta: null, evidencia: null, respondeA: null, situacion: null, ref: null },
    { id: 'p2', rol: 'persona', texto: '¿Y las citas?', estado: 'respondida', respuesta: null, evidencia: null, respondeA: null, situacion: null, ref: null },
    { id: 'c2', rol: 'cerebro', texto: 'Tres citas.', estado: null, respuesta: otra, evidencia: [], respondeA: 'p2', situacion: null, ref: null },
    { id: 'c1', rol: 'cerebro', texto: 'Sin ventas.', estado: null, respuesta, evidencia: [{ id: 'ev-1', herramienta: 'dinero_del_mes', argumentos: {}, datos: {} }], respondeA: 'p1', situacion: null, ref: null },
    { id: 'p3', rol: 'persona', texto: '¿Y la semana?', estado: 'fallida', respuesta: null, evidencia: null, respondeA: null, situacion: 'IA-TIEMPO', ref: 'R-1' },
    { id: 'p4', rol: 'persona', texto: '¿Y hoy?', estado: 'reservada', respuesta: null, evidencia: null, respondeA: null, situacion: null, ref: null },
  ]);
  assert.deepEqual(turnos.map((t) => t.tipo), ['persona', 'cerebro', 'persona', 'cerebro', 'persona', 'fallo', 'persona', 'fallo']);
  const cerebro = turnos[1]!;
  assert.ok(cerebro.tipo === 'cerebro');
  assert.equal(cerebro.respuesta, respuesta, 'la respuesta no va debajo de la pregunta que contesta');
  assert.equal(cerebro.mascota, 'hallazgo');
  assert.equal(cerebro.evidencia.length, 1);
  assert.equal((turnos[3] as { respuesta: unknown }).respuesta, otra);
  assert.equal((turnos[5] as { texto: string }).texto, 'Esta pregunta no se pudo responder (IA-TIEMPO, R-1).');
  assert.equal((turnos[7] as { texto: string }).texto, 'Esta pregunta todavía no tiene respuesta.');
});

test('cada estado del cerebro dice lo de la tabla de AG-52, y Ajustes se ofrece sólo a quien puede cargar la llave', () => {
  const t = (e: Parameters<typeof textoDelEstado>[0]) => textoDelEstado(e, 'America/Lima', 'Ajustes');
  assert.equal(t({ tipo: 'listo' }), null);
  assert.equal(t({ tipo: 'delegacion' }), 'Estás mirando otra empresa: el cerebro no responde aquí.');
  assert.match(t({ tipo: 'sin_llave', puedeCargarla: true })!, /Se carga en Ajustes\./);
  assert.match(t({ tipo: 'sin_llave', puedeCargarla: false })!, /Pídesela a quien administra\./);
  assert.match(t({ tipo: 'llave_ilegible', puedeCargarla: true })!, /no se puede leer/);
  assert.match(t({ tipo: 'sin_datos' })!, /no hay datos que el cerebro pueda leer/);
  // El tope dice el número y la hora a la que se renueva, en la zona de la empresa.
  const tope = t({ tipo: 'tope', tope: 50, de: 'persona', renuevaEl: '2026-10-06T05:00:00.000Z' })!;
  assert.match(tope, /^Llegaste al tope de hoy \(50 preguntas\)\. Se renueva a las 00:00\.$/);
  assert.match(t({ tipo: 'tope', tope: 300, de: 'empresa', renuevaEl: '2026-10-06T05:00:00.000Z' })!, /^Tu empresa llegó al tope de hoy \(300 preguntas\)/);
  assert.equal(puedeIrAAjustes({ tipo: 'sin_llave', puedeCargarla: true }), true);
  assert.equal(puedeIrAAjustes({ tipo: 'sin_llave', puedeCargarla: false }), false);
  assert.equal(puedeIrAAjustes({ tipo: 'tope', tope: 1, de: 'persona', renuevaEl: '2026-10-06T05:00:00.000Z' }), false);
});

test('un rechazo del modelo dice la situación y la referencia, y no lo técnico', () => {
  const texto = textoDelRechazo('modelo_no_disponible', 'IA-SATURADO · ref R-9 · overloaded_error: 529 del proveedor');
  assert.equal(texto, 'El cerebro no pudo responder ahora (IA-SATURADO, ref R-9). Vuelve a intentarlo en un momento.');
  assert.doesNotMatch(texto, /overloaded|529/);
  // El detalle que ya escribió el servidor para la persona, tal cual.
  assert.equal(textoDelRechazo('tope_del_cerebro', 'Llegaste al tope de hoy (50 preguntas).'), 'Llegaste al tope de hoy (50 preguntas).');
  assert.equal(textoDelRechazo('no_encontrado', undefined), 'Esa conversación ya no está.');
});

test('el período anunciado es el último de esa pantalla, y no se mezcla con otra', () => {
  anunciarPeriodo('sales', '7d');
  anunciarPeriodo('sales', '30d');
  anunciarPeriodo('creative', 'hoy');
  assert.equal(periodoAnunciado('sales'), '30d');
  assert.equal(periodoAnunciado('creative'), 'hoy');
  assert.equal(periodoAnunciado('tools'), null, 'una pantalla sin períodos pregunta sin período');
  assert.equal(periodoAnunciado(null), null);
});

test('el traspaso al Inicio se toma una sola vez', async () => {
  const guardado = new Map<string, string>();
  const g = globalThis as Record<string, unknown>;
  const antes = { window: g.window, sessionStorage: g.sessionStorage };
  g.window = new EventTarget();
  g.sessionStorage = {
    getItem: (k: string) => guardado.get(k) ?? null,
    setItem: (k: string, v: string) => void guardado.set(k, v),
    removeItem: (k: string) => void guardado.delete(k),
  };
  try {
    const { alPedirHiloDelInicio, pedirHiloDelInicio, tomarHiloDelInicio } = await import('../../lib/agentes/traspaso.ts');
    let avisos = 0;
    const baja = alPedirHiloDelInicio(() => (avisos += 1));
    pedirHiloDelInicio('h-1');
    assert.equal(avisos, 1, 'el Inicio montado no se entera');
    assert.deepEqual(tomarHiloDelInicio(), { hilo: 'h-1' });
    assert.equal(tomarHiloDelInicio(), null, 'el pedido se toma dos veces');
    pedirHiloDelInicio(null);
    assert.deepEqual(tomarHiloDelInicio(), { hilo: null }, '«Nueva conversación» no llega como tal');
    baja();
    pedirHiloDelInicio('h-2');
    assert.equal(avisos, 2, 'la baja no da de baja');
  } finally {
    g.window = antes.window;
    g.sessionStorage = antes.sessionStorage;
  }
});

test('lo que llega tarde no se mezcla: cada pedido recuerda su generación, y cambiar de ruta, de hilo o empezar otro la sube', () => {
  /* La caja del pie es UNA y pasa de una sección a otra: la respuesta de Sales llegaba a la conversación de
     Creative, y abrir otro hilo mientras se esperaba mezclaba los dos (la revisión de AG7). */
  const u = sinComentarios(fuente('lib/agentes/usarCerebro.ts'));
  const cuerpo = (nombre: string) => {
    const i = u.indexOf(`const ${nombre} = useCallback(`);
    assert.ok(i > 0, `no está \`${nombre}\``);
    return u.slice(i, u.indexOf('\n  );\n', i));
  };
  /* Justo después de la respuesta, antes de tocar nada: un `match` más laxo casaba con la comprobación del
     camino del fallo, más abajo, y dejaba pasar una respuesta vieja. */
  assert.match(cuerpo('preguntar'), /const de = generacion\.current;[\s\S]*?espera: ESPERA_DE_RUTA_LARGA_MS,\s*\}\);\s*if \(!vigente\(de\)\) return true;\s*setPendiente\(null\);/, 'una respuesta vieja se aplica a la conversación de ahora');
  assert.match(cuerpo('leerPanel'), /const de = generacion\.current;[\s\S]*?await pedir[\s\S]*?if \(!vigente\(de\)\) return null;/, 'un panel viejo pisa al de ahora');
  assert.match(cuerpo('abrir'), /generacion\.current \+= 1;/, 'abrir otro hilo no invalida la pregunta en camino');
  assert.match(cuerpo('nueva'), /generacion\.current \+= 1;/, 'empezar otra conversación no invalida la pregunta en camino');
  assert.match(u, /useEffect\(\(\) => \{\s*generacion\.current \+= 1;[\s\S]*?setPendiente\(null\);[\s\S]*?\}, \[ruta\]\);/, 'cambiar de sección no invalida lo que está en camino');
  // Y la caja cierra su panel al cambiar de pantalla, y un paso «abrir» del panel también.
  const caja = sinComentarios(fuente('components/ConsultaAlCerebro.jsx'));
  assert.match(caja, /useEffect\(\(\) => \{\s*setAbiertoElPanel\(false\);\s*\}, \[vista\]\);/, 'el panel queda abierto encima de otra pantalla');
  assert.match(sinComentarios(fuente('components/cerebro/Respuesta.jsx')), /const abrir = \(paso\) => \{\s*alNavegar\?\.\(\);/, 'un paso «abrir» deja el panel encima de la pantalla que abre');
});
