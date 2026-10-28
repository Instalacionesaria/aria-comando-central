// Conversation dibuja el front del prototipo, con sus clases y sin capas encima. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (docs/2-departamentos/conversation/01-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md, CN-3)
//
// El 2026-10-10 la pestaña volvió al marcado de `aios-command-center_1.html:2865-2929`, con la estética al 100 %,
// y se llena con `lecturaDeConversation`. Volver atrás es fácil sin darse cuenta: pegar `estetica-op` en la sección,
// cambiar un rótulo, escribir un cero donde va «—», calcular una tasa en el navegador, dibujar otra vez un párrafo o
// cambiar una frase de la lista cerrada sin pasar por el documento. Cada prueba dice cuál de esas cosas mira, y la
// mutación que la pone en rojo:
//
//   · la sección no lleva `estetica-op` y su envoltorio es el del prototipo; Auditoría y Prompts sí, dentro de su
//     contenedor — mutación: volver a ponerla en la sección, o sacarla del contenedor;
//   · el encabezado es el del prototipo, con los cuatro modos, el plan real y el segmentado sólo en los dos del
//     tablero — mutación: cambiar la bajada, o dejar el segmentado en Auditoría;
//   · los paneles, las tarjetas y los bloques llevan los rótulos del prototipo, con los desvíos declarados —
//     mutación: cambiar uno;
//   · cada cifra sale del lugar que le toca en `pantalla` — mutación: intercambiar dos;
//   · las frases son las de CN1-02, en las dos direcciones, y cada motivo del servidor tiene la suya — mutación:
//     cambiar una, o intercambiar dos;
//   · los pasos, los cuadrantes y los agentes son los del servidor, cada uno con su rótulo — mutación: sacar uno;
//   · no vuelven «Personalizado», la clave `mes`, las flechas, los nombres de la maqueta ni los cajones;
//   · la carga: la última lectura gana, la recarga no pisa a la primera y la primera se apaga — mutación: borrar
//     una de las tres guardas (CN-4);
//   · se multiplica por 100 en un solo lugar, y el panel no divide — mutación: un segundo `* 100`;
//   · sin párrafos: el panel no dibuja avisos del servidor ni lo que falta para medir — mutación: volver a dibujar
//     un aviso;
//   · lo nuevo vive en `app/conversation.css`, acotado, y la estética de Inteligencia no alcanza a la vista.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { existsSync as hayCarpeta } from 'node:fs';
/* `docs/` es local desde el 2026-10-28 (`.gitignore`): en un clon sin la carpeta, lo que se compara con un documento se
   saltea en vez de fallar. */
const SIN_DOCS = hayCarpeta(join(import.meta.dirname, '..', '..', 'docs')) ? false : 'docs/ es local y no está en este clon';
import { RAIZ } from '../apoyo/fuente.ts';
import { CUADRANTES } from '../../lib/negocio/cuadrantesDelIcp.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');
const sinComentarios = (t: string): string =>
  t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\{\s*\}/g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const VISTA = 'components/views/ConversationView.jsx';
const PANEL = 'components/conversation/PanelDeConversation.jsx';
const COMUN = 'components/conversation/comun.jsx';
const panel = () => sinComentarios(leer(PANEL));
const comun = () => sinComentarios(leer(COMUN));

/** El cuerpo de una función de un archivo, hasta la próxima función de primer nivel. */
function funcion(fuente: string, nombre: string): string {
  const i = fuente.search(new RegExp(`\\nfunction ${nombre}\\(|\\nexport (default )?function ${nombre}\\(`));
  assert.notEqual(i, -1, `no está la función ${nombre}`);
  const j = fuente.slice(i + 1).search(/\n(export (default )?)?function \w+\(/);
  return j === -1 ? fuente.slice(i) : fuente.slice(i, i + 1 + j);
}

/** El marcado de Conversation en el prototipo, y su JS. */
function prototipo(): { html: string; js: string } {
  const todo = leer('aios-command-center_1.html');
  const i = todo.indexOf('<section class="view" id="v-conversation">');
  assert.notEqual(i, -1, 'no está la sección de Conversation en el prototipo');
  const j = todo.indexOf('/* ===================== CONVERSATION ===================== */');
  assert.notEqual(j, -1, 'no está el JS de Conversation en el prototipo');
  return { html: todo.slice(i, todo.indexOf('</section>\n', todo.indexOf('id="csAgentes"'))), js: todo.slice(j, j + 30000) };
}

/** Las claves de un objeto exportado de `comun.jsx`. */
function claves(nombre: string): string[] {
  const c = comun();
  const i = c.indexOf(`export const ${nombre} = {`);
  assert.notEqual(i, -1, `no está ${nombre}`);
  return [...c.slice(i, c.indexOf('\n};', i)).matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]!);
}

test('la sección no lleva la estética de operación; Auditoría y Prompts sí, dentro de su contenedor', () => {
  const vista = sinComentarios(leer(VISTA));
  assert.match(vista, /id="v-conversation"/);
  assert.doesNotMatch(vista, /estetica-op/, 'volvió `estetica-op` a la sección: es la capa que había cambiado el look (CN1-01)');
  assert.match(vista, /className=\{activa \? 'view on' : 'view'\}/);
  assert.match(vista, /className="view-scroll cre-scroll">\s*<PanelDeConversation \/>/, 'el envoltorio del prototipo es `view-scroll cre-scroll`');
  // El supervisor, como era: `Cuerpo` de Auditoría dentro de un contenedor con la estética que lo viste (CN1-13).
  const p = funcion(panel(), 'PanelDeConversation');
  assert.match(p, /<div className="estetica-op cs-supervisor">\s*<div className="cl-page">\s*<Supervisor\s/, 'Auditoría y Prompts perdieron la estética que los viste');
  assert.match(p, /sub=\{modo === 'prompts' \? 'prompts' : 'inicio'\}/, 'Prompts no abre la cara de los prompts');
  assert.equal([...panel().matchAll(/estetica-op/g)].length, 1, 'la estética de operación alcanza algo más que el supervisor');
});

test('el encabezado es el del prototipo: el título, la bajada, los cuatro modos, el plan y el segmentado', () => {
  const { html } = prototipo();
  const bajada = /<span class="cre-desc">([^<]+)<\/span>/.exec(html)?.[1];
  assert.equal(bajada, 'Dos misiones, cuatro agentes · agendar y hacer que asistan', 'cambió la bajada del prototipo');
  const cabeza = funcion(panel(), 'PanelDeConversation');
  assert.match(cabeza, /<div className="cre-head">\s*<div className="ch-l stack">\s*<div className="ch-title">\s*<h2>Conversation<\/h2>\s*<span className="cre-desc">([^<]+)<\/span>/);
  assert.equal(/<span className="cre-desc">([^<]+)<\/span>/.exec(cabeza)?.[1], bajada, 'la bajada no es la del prototipo (CN1-03)');
  assert.match(cabeza, /<\/div>\s*<Modos valor=\{modo\} alElegir=\{setModo\} \/>/, 'los modos no van bajo el título, como en el prototipo');
  // Los dos modos del prototipo, con sus iconos, y los dos del supervisor después (CN1-03).
  const delPrototipo = [...html.slice(html.indexOf('id="csMode"')).matchAll(/data-m="(\w+)"[^>]*><svg viewBox="0 0 16 16"><use href="(#[\w-]+)"\/><\/svg>(\w+)</g)]
    .slice(0, 2)
    .map((m) => [m[1]!, m[3]!, m[2]!]);
  assert.equal(delPrototipo.length, 2, 'no se leyeron los dos modos del prototipo');
  const modos = [...panel().slice(panel().indexOf('const MODOS = ['), panel().indexOf('];', panel().indexOf('const MODOS = ['))).matchAll(/\{ clave: '(\w+)', nombre: '([^']+)', icono: '([^']+)' \}/g)].map((m) => [m[1]!, m[2]!, m[3]!]);
  assert.deepEqual(modos.slice(0, 2), delPrototipo, 'Estado y Agentes no son los del prototipo');
  assert.deepEqual(modos.slice(2).map((m) => m[1]), ['Auditoría', 'Prompts'], 'los modos del supervisor no van al final');
  assert.match(cabeza, /useState\(MODOS\[0\]\.clave\)/, 'la pantalla no abre en su primer modo');
  // A la derecha, el plan real y el segmentado sólo en los dos modos del tablero (CN1-03, CN1-14).
  const derecha = cabeza.slice(cabeza.indexOf('<div className="ch-r">'), cabeza.indexOf('{tablero ? (\n        <>'));
  assert.match(derecha, /<BotonDelPlan departamento="conversation" senales=\{pantalla\.senales\} \/>/, 'el plan no es el real del detector');
  assert.match(derecha, /\{tablero \? \(\s*<div className="ch-period">[\s\S]*<Periodos /, 'el segmentado no está acotado a Estado y Agentes');
  assert.match(panel(), /const DEL_TABLERO = new Set\(\['estado', 'agentes'\]\);/);
  assert.match(funcion(panel(), 'Periodos'), /title=\{p\.matiz \?\? undefined\}/);
  // El encabezado va siempre, antes de la carga y del error: sin él no queda ningún modo que apretar.
  assert.ok(cabeza.indexOf('className="cre-head"') < cabeza.indexOf('{error ?'), 'el encabezado se dibuja después del error');
});

test('los paneles llevan los rótulos del prototipo, con los desvíos declarados', () => {
  const { js } = prototipo();
  // Lead Flow y Appointment Flow: los rótulos del `pair` del prototipo, con «Contactos» por «Contactos sin cita».
  for (const rotulo of ['Agendó', 'Citas totales', 'Asistieron']) assert.ok(js.includes(`pair('${rotulo}'`), `«${rotulo}» no está en el prototipo`);
  assert.ok(js.includes("pair('Contactos sin cita'"));
  const lf = funcion(panel(), 'PanelDeLeadFlow');
  assert.match(lf, /<Par rotulo="Contactos" valor=\{miles\(c\.contactos\.valor\)\}/, '«Contactos» no dibuja la cohorte (CN1-06)');
  assert.match(lf, /<Par\s+rotulo="Agendó"\s+valor=\{o\(c\.agendaron\.valor, miles\)\}\s+tasa=\{c\.bookingRate\.valor === null \? null : pf\(c\.bookingRate\.valor\)\}/);
  const af = funcion(panel(), 'PanelDeAppointmentFlow');
  assert.match(af, /<div className="pn hi">/, 'Appointment Flow perdió el panel resaltado del prototipo');
  assert.match(af, /<Par rotulo="Citas totales" valor=\{miles\(c\.citas\.valor\)\}/);
  assert.match(af, /<Par\s+rotulo="Asistieron"\s+valor=\{o\(c\.asistieron\.valor, miles\)\}\s+tasa=\{kpi\.valor === null \? null : pf\(kpi\.valor\)\}/);
  // El tercero: «el grupo que agendó», por decisión del usuario (CN1-08), con los cuatro cuadrantes del CRM (la `105`).
  assert.ok(js.includes('De qué está hecho el grupo que asistió'));
  const icp = funcion(panel(), 'PanelDelIcp');
  assert.match(icp, /De qué está hecho el grupo que agendó/);
  assert.match(icp, /<div className="pn-b q5">\s*<Par rotulo="Agendaron" valor=\{miles\(icp\.agendaron\)\}/);
  assert.match(icp, /\['prioriza', 'valida', 'financia', 'descarta'\]\.map/, 'los cuatro cuadrantes no van en su orden');
  assert.match(icp, /`\$\{miles\(sinClasificar\)\} sin clasificar`/, 'los sin calificar no van aparte');
  // Las tarjetas de flujo, con sus misiones y el rótulo de su cifra clave (CN1-09, CN1-10).
  for (const [fn, t, m, k] of [
    ['TarjetaDeLeadFlow', 'Lead Flow', 'Que agende quien no lo hizo solo', 'contacto a agenda'],
    ['TarjetaDeAppointmentFlow', 'Appointment Flow', 'Que asista · todas las citas, vengan de donde vengan', 'agenda a asistencia'],
  ] as const) {
    assert.ok(js.includes(`<div class="csf-t">${t}</div>`) && js.includes(`<div class="csf-m">${m}</div>`) && js.includes(`<span>${k}</span>`), `«${t}» no está así en el prototipo`);
    const f = funcion(panel(), fn);
    assert.match(f, new RegExp(`<div className="csf-t">${t}</div>\\s*<div className="csf-m">${m}</div>`));
    assert.match(f, new RegExp(`<Clave c=\\{f\\.kpi\\} rotulo="${k}" />`));
  }
  const ap = funcion(panel(), 'TarjetaDeAppointmentFlow');
  const bloques = ['Salidas antes de la llamada', '<Calidad filas={f.calidad} />', 'De dónde viene la cita'].map((x) => ap.indexOf(x));
  assert.ok(bloques.every((x) => x !== -1), 'falta un bloque de Appointment Flow');
  assert.deepEqual([...bloques].sort((a, b) => a - b), bloques, 'los bloques no van en el orden del prototipo');
  assert.match(ap, /<Fila rotulo="Conversaron antes" paso=\{f\.origen\.conversaronAntes\} \/>\s*<Fila rotulo="Se agendaron solos" paso=\{f\.origen\.solos\} \/>/, 'el origen no es el declarado en CN1-02');
  assert.match(funcion(panel(), 'Calidad'), /Tasa de asistencia por calidad <em>· de cada nivel agendado<\/em>/);
});

test('cada bloque sale del lugar que le toca en `pantalla`, y en el orden del prototipo', () => {
  const t = funcion(panel(), 'Tablero');
  assert.match(t, /const \{ paneles, leadFlow, appointmentFlow, agentes, porCorregir, cifras \} = p\.pantalla;/);
  assert.match(
    t,
    /<section className="cs-panels">\s*<PanelDeLeadFlow c=\{paneles\.leadFlow\} desde=\{fechaCorta\(p\.respuesta\.desde\)\} \/>\s*<PanelDeAppointmentFlow c=\{paneles\.appointmentFlow\} kpi=\{appointmentFlow\.kpi\} desde=\{fechaCorta\(p\.cancelacion\.desde\)\} \/>\s*<PanelDelIcp icp=\{paneles\.icp\} \/>/,
    'los tres paneles no van en el orden del prototipo, o leen otro lugar',
  );
  assert.match(t, /<TarjetaDeLeadFlow f=\{leadFlow\} \/>\s*<TarjetaDeAppointmentFlow f=\{appointmentFlow\} \/>/);
  assert.match(t, /\{modo === 'estado' \? \(\s*<div className="cs-view">\s*<div className="ghead">\s*<span className="gdot cs-gdot-flujos" \/>/, 'Estado no dibuja los flujos');
  assert.match(t, /agentes\.map[\s\S]*<\/div>\s*<QueCorregir c=\{porCorregir\} alCorregir=\{alCorregir\} \/>/, '«Qué corregir» no va debajo de las tarjetas, como en el prototipo');
  assert.match(funcion(panel(), 'PanelDeConversation'), /<Periodos valor=\{pantalla\?\.periodo \?\? periodo\} /, 'el segmentado enciende lo pedido y no lo contestado');
  assert.match(t, /agentes\.map\(\(a\) => \(\s*<TarjetaDeAgente key=\{a\.clave\} a=\{a\} \/>/);
  assert.match(t, /<LoDemas c=\{cifras\} \/>/);
  // «Qué corregir» lleva al modo Auditoría (CN1-11).
  assert.match(funcion(panel(), 'PanelDeConversation'), /alCorregir=\{\(\) => setModo\('auditoria'\)\}/);
  // La fila de abajo, con sus cuatro cifras y su formato (CN1-12).
  const d = funcion(panel(), 'LoDemas');
  for (const [rotulo, clave, formato] of [
    ['Primera respuesta', 'respuesta', 'minutos'],
    ['Primer mensaje fuera de horario', 'fueraDeHorario', 'pf'],
    ['Precall registrado', 'precall', 'pf'],
    ['Molestos', 'molestos', 'pf'],
  ]) {
    assert.match(d, new RegExp(`<Par rotulo="${rotulo}" valor=\\{o\\(c\\.${clave}\\.valor, ${formato}\\)\\}`), `«${rotulo}» no dibuja \`cifras.${clave}\` con \`${formato}\``);
  }
});

test('las frases son las de CN1-02, ni una más ni una menos', { skip: SIN_DOCS }, () => {
  const c = comun();
  const bloque = c.slice(c.indexOf('export const FRASE = {'), c.indexOf('};', c.indexOf('export const FRASE = {')));
  const delPanel = [...bloque.matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]!).sort();
  assert.ok(delPanel.length >= 10, 'no se leyeron las frases del panel');
  const doc = leer('docs/2-departamentos/conversation/01-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md');
  const seccion = doc.slice(doc.indexOf('### CN1-02'), doc.indexOf('**Los desvíos de rótulo'));
  const delDoc = [...seccion.matchAll(/^\|[^|]+\|\s*«([^»]+)»\s*\|\r?$/gm)].map((m) => m[1]!).sort();
  assert.deepEqual(delPanel, delDoc, 'la lista del panel y la de CN1-02 no coinciden: una frase nueva entra primero al documento');
});

test('cada motivo de una cifra sin valor tiene SU frase, y son los del servidor', () => {
  const tipo = /export type MotivoDeLaCifra =([^;]+);/.exec(leer('lib/negocio/lecturaDeConversation.ts'))?.[1] ?? '';
  const delServidor = [...tipo.matchAll(/'(\w+)'/g)].map((m) => m[1]!).sort();
  assert.equal(delServidor.length, 12, 'no se leyeron los motivos del servidor');
  const c = comun();
  const frases = c.slice(c.indexOf('export const FRASE = {'), c.indexOf('};', c.indexOf('export const FRASE = {')));
  const texto = Object.fromEntries([...frases.matchAll(/(\w+): '([^']+)'/g)].map((m) => [m[1], m[2]]));
  const bloque = c.slice(c.indexOf('export const FRASE_DEL_MOTIVO = {'), c.indexOf('};', c.indexOf('export const FRASE_DEL_MOTIVO = {')));
  const mapa = Object.fromEntries([...bloque.matchAll(/(\w+): FRASE\.(\w+)/g)].map((m) => [m[1], texto[m[2]!]]));
  assert.deepEqual(Object.keys(mapa).sort(), delServidor);
  /* Y cada uno con la frase de su situación en CN1-02: dos intercambiadas pasarían una comparación de conjuntos. */
  assert.deepEqual(mapa, {
    sin_contactos: 'Sin contactos en este período',
    sin_citas: 'Sin citas en esta ventana.',
    sin_asistencia: 'Nadie marca la asistencia.',
    bajo_el_piso: 'Pocos casos para una tasa.',
    sin_enlace: 'Sin enlace con seguimiento.',
    sin_llamadas: 'Sin llamadas registradas.',
    sin_analisis: 'Sin análisis en esta ventana.',
    no_audita: 'La empresa no audita sus agentes.',
    sin_campo: 'El CRM no lo registra.',
    sin_agendados: 'Nadie agendó en esta ventana.',
    sin_escritos: 'Sin mensajes en esta ventana.',
    sin_respuestas: 'Nadie respondió en esta ventana.',
  });
  assert.match(panel(), /const motivo = \(c\) => \(c\.valor === null \? \(FRASE_DEL_MOTIVO\[c\.motivo\] \?\? null\) : null\);/);
  // La mediana bajo el piso no es «una tasa» (CN1-02).
  assert.match(funcion(panel(), 'LoDemas'), /c\.respuesta\.valor === null && c\.respuesta\.motivo === 'bajo_el_piso' \? FRASE\.pocosParaMediana : motivo\(c\.respuesta\)/);
  // Un paso sin conteo dice su frase en el lugar de la barra (la landing, la asistencia).
  assert.match(funcion(panel(), 'Eslabon'), /\{sinValor \? \(\s*<span className="cs-motivo" title=\{sinValor\}>\s*\{sinValor\}\s*<\/span>/);
  // Sin auditoría, «Qué corregir» lo dice con su frase y no con un cero.
  assert.match(funcion(panel(), 'QueCorregir'), /\{c\.valor === null \? \(\s*<span className="gn">\{FRASE_DEL_MOTIVO\[c\.motivo\] \?\? FRASE\.guion\}<\/span>/);
  // Cada «—» de un panel dice el porqué de su conteo o, si no, el de su tasa; el paso, en su `title`.
  assert.match(funcion(panel(), 'PanelDeLeadFlow'), /debajo=\{motivo\(c\.agendaron\) \?\? motivo\(c\.bookingRate\)\}/);
  assert.match(funcion(panel(), 'PanelDeAppointmentFlow'), /debajo=\{motivo\(c\.asistieron\) \?\? motivo\(kpi\)\}/);
  assert.match(funcion(panel(), 'PanelDelIcp'), /debajo=\{icp\.motivo === null \? null : \(FRASE_DEL_MOTIVO\[icp\.motivo\] \?\? null\)\}/);
  assert.match(funcion(panel(), 'Eslabon'), /<span className="csr-p" title=\{sinPorcion \?\? undefined\}>/);
  assert.match(funcion(panel(), 'Eslabon'), /<span className="cs-motivo" title=\{sinValor\}>/);
  // La calidad junta las frases sólo si todos los cuadrantes están en «—» por el mismo motivo.
  assert.match(funcion(panel(), 'Calidad'), /motivos\.size === 1 && !motivos\.has\('con_valor'\)/);
});

test('los pasos, los cuadrantes y los agentes son los del servidor, cada uno con su rótulo', () => {
  const lectura = leer('lib/negocio/lecturaDeConversation.ts');
  const delServidor = new Set([...lectura.matchAll(/paso\('(\w+)'|clave: '(\w+)', valor: sinValor|\{ clave: '(\w+)', n: /g)].map((m) => m[1] ?? m[2] ?? m[3]));
  for (const clave of ['asistieron', 'reprogramaron', 'cancelaron']) delServidor.add(clave);
  delServidor.delete('conversaron_antes');
  delServidor.delete('solos');
  assert.deepEqual(claves('PASO').sort(), [...delServidor].sort(), 'un paso del servidor no tiene rótulo, o sobra uno');
  /* Y lo que dice cada rótulo: dos intercambiados pasarían por las claves. Son los de CN1-09 a CN1-11. */
  const c = comun();
  for (const par of [
    "entraron: 'Entraron'", "escritos: 'Les escribimos'", "respondieron: 'Respondieron'", "abrieron: 'Abrieron la landing'",
    "agendaron: 'Agendaron'", "citas: 'Citas'", "confirmaron: 'Confirmaron'", "asistieron: 'Asistieron'",
    "reprogramaron: 'Reprogramaron'", "cancelaron: 'Cancelaron'",
    "prioriza: 'Prioriza'", "valida: 'Valida'", "financia: 'Financia'", "descarta: 'Descarta'", "sin_clasificar: 'Sin clasificar'",
  ]) {
    assert.ok(c.includes(par), `cambió el rótulo \`${par}\``);
  }
  assert.match(c, /leadflow_texto: \{ flujo: 'Lead Flow', canal: 'txt',[^}]*cifra: 'de respuesta' \}/);
  assert.match(c, /appflow_texto: \{ flujo: 'Appointment Flow', canal: 'txt',[^}]*cifra: 'de confirmación' \}/);
  assert.match(c, /leadflow_voz: \{ flujo: 'Lead Flow', canal: 'voz',[^}]*cifra: null \}/);
  assert.match(c, /appflow_voz: \{ flujo: 'Appointment Flow', canal: 'voz',[^}]*cifra: null \}/);
  assert.match(lectura, /\{ clave: 'asistieron', valor: asistieron, porcion: tasaDeAsistencia \}/);
  // Los cuadrantes: los del módulo que el servidor usa para ordenarlos, todos con su rótulo.
  assert.deepEqual(claves('CUADRANTE').sort(), CUADRANTES.map((x) => x.clave).sort(), 'un cuadrante del servidor no tiene rótulo');
  const tipo = /clave: ('leadflow_texto'[^;]+);/.exec(lectura)?.[1] ?? '';
  assert.deepEqual(claves('AGENTE'), [...tipo.matchAll(/'(\w+)'/g)].map((m) => m[1]!), 'un agente del servidor no tiene tarjeta, o cambiaron de orden');
  // El molesto es el molesto, y cada parte de la barra la suya.
  const tarjeta = funcion(panel(), 'TarjetaDeAgente');
  assert.match(tarjeta, /`\$\{pf\(a\.sentimiento\.molesto\)\} molesto`/);
  assert.match(
    tarjeta,
    /<i className="p" style=\{\{ width: pf\(a\.sentimiento\.positivo\) \}\} \/>\s*<i className="n" style=\{\{ width: pf\(a\.sentimiento\.neutral\) \}\} \/>\s*<i className="g" style=\{\{ width: pf\(a\.sentimiento\.molesto\) \}\} \/>/,
  );
  // Las de voz en «—», y su frase no se repite en el sentimiento.
  assert.match(funcion(panel(), 'TarjetaDeAgente'), /a\.motivoDelSentimiento === 'sin_llamadas' \? null :/);
  assert.match(funcion(panel(), 'TarjetaDeAgente'), /<span>\{a\.cifra\.valor === null \? motivo\(a\.cifra\) : d\.cifra\}<\/span>/);
});

test('no vuelven «Personalizado», la clave `mes`, las flechas, los nombres de la maqueta ni los cajones', () => {
  const fuente = sinComentarios(leer(VISTA)) + panel() + comun();
  for (const [pieza, motivo] of [
    ['Personalizado', '«Personalizado» abría un rango que ninguna otra pantalla reproduce (CN1-03)'],
    ['data-datepick', '«Personalizado» (CN1-03)'],
    ["'mes'", 'la clave `mes` no es un período (CN1-04)'],
    ['vs los 7 días previos', 'sin comparación (CN1-04)'],
    ['dlt', 'sin flechas (CN1-04)'],
    ['data-leads', 'abría un cajón con personas inventadas (CN1-17)'],
    ['data-ag', 'abría el cajón de un agente (CN1-11)'],
    ['iss-bar', 'la lista de correcciones del prototipo; el detalle vive en Auditoría (CN1-11)'],
    ['csf-foot', 'el párrafo del pie de la tarjeta (CN1-05)'],
    ['PISO_DE_UNA_TASA', 'el navegador no calcula tasas: llegan del servidor (CN1-15)'],
    ['cl-sub', 'la barra de pestañas se fue: son modos del prototipo (CN1-03)'],
  ] as const) {
    assert.ok(!fuente.includes(pieza), `volvió \`${pieza}\`: ${motivo}`);
  }
  /* Los nombres de persona de la maqueta y las iniciales del cliente se leen del prototipo, sin copiarlos acá: el
     repositorio es público (CN1-17). */
  const { js } = prototipo();
  const nombres = [...js.matchAll(/n:'([^'·]+?) · /g)].map((m) => m[1]!.trim());
  const iniciales = [...js.matchAll(/landing ([A-Z]{2,})/g)].map((m) => m[1]!);
  assert.ok(nombres.length > 0 && iniciales.length > 0, 'no se leyeron los nombres de la maqueta');
  for (const pieza of [...nombres, ...iniciales]) assert.ok(!fuente.includes(pieza), 'volvió un nombre o unas iniciales de la maqueta (CN1-17)');
});

test('la carga: la última lectura gana, la recarga no pisa a la primera, y la primera se apaga', () => {
  const p = funcion(panel(), 'PanelDeConversation');
  assert.match(p, /if \(esRecarga && primeraEnVuelo\.current\) return;/, 'una recarga del reloj deja sin efecto a la carga primera');
  assert.match(p, /const esta = \+\+ultima\.current;[\s\S]*const r = await leerLaPantalla\(periodo\);\s*if \(esta !== ultima\.current\) return;/, 'una respuesta tardía pisa a la nueva');
  assert.match(p, /if \(!esRecarga\) primeraEnVuelo\.current = false;/, 'la primera carga nunca se apaga: el reloj deja de recargar');
  // «Reintentar» y «Guardar» van como carga primera: el evento del clic no es una recarga.
  assert.match(p, /alRecargar=\{\(\) => cargar\(\)\}/);
});

test('el navegador no calcula: se multiplica por 100 en un solo lugar, y el panel no divide', () => {
  const todo = panel() + comun();
  assert.equal([...todo.matchAll(/\*\s*100\b/g)].length, 1, 'hay otra multiplicación por 100: todo viaja de 0 a 1 y se convierte una vez (CN1-15)');
  assert.match(comun(), /export const cien = \(v\) => Math\.round\(v \* 100\);/);
  const sinImports = panel().replace(/^import .*$/gm, '');
  assert.doesNotMatch(sinImports, /[\w)\]]\s*\/\s*[\w(]/, 'el panel divide: una porción se calculó en el navegador');
  assert.doesNotMatch(panel(), /\.(sort|toSorted|reverse|toReversed|slice|splice)\(/, 'el panel reordena o recorta lo que llega');
});

test('sin párrafos: el panel no dibuja avisos del servidor ni lo que falta para medir (CN1-05)', () => {
  const t = panel();
  assert.doesNotMatch(t, /\.aviso\b|avisoDe|\.falta\b|FLUJOS|<details|\.p90\b|hastaElPrimerIntento|porFuente|porCampana/, 'el panel volvió a dibujar un aviso, lo que falta, el p90 o la atribución');
  // Debajo de una cifra de panel, una sola línea.
  assert.match(funcion(t, 'Par'), /<div className="pn-d">\{debajo \? <span className="cs-motivo">\{debajo\}<\/span> : null\}<\/div>/);
  assert.equal([...funcion(t, 'Par').matchAll(/cs-motivo/g)].length, 1, 'una cifra lleva más de una línea debajo');
  // Ningún dato de una persona: el panel no lee los casos ni las conversaciones fuera del supervisor.
  const tablero = ['Tablero', 'TarjetaDeAgente', 'QueCorregir', 'LoDemas'].map((f) => funcion(t, f)).join('');
  assert.doesNotMatch(tablero, /\.(casos|conversaciones|nombre)\b/, 'el tablero lee algo de una persona (CN1-17)');
});

/** Las partes de un selector agrupado, partiendo sólo en las comas de afuera de los paréntesis. */
function partes(selector: string): string[] {
  const salida: string[] = [];
  let hondo = 0;
  let actual = '';
  for (const ch of selector) {
    if (ch === '(') hondo += 1;
    if (ch === ')') hondo -= 1;
    if (ch === ',' && hondo === 0) {
      salida.push(actual.trim());
      actual = '';
    } else actual += ch;
  }
  return [...salida, actual.trim()];
}

test('lo nuevo vive en `app/conversation.css`, acotado; la estética de Inteligencia no alcanza a la vista', () => {
  assert.match(leer('app/globals.css'), /@import "\.\/conversation\.css" layer\(components\);/, 'la hoja no está importada en la capa `components`');
  const propia = sinComentarios(leer('app/conversation.css'));
  const selectores = [...propia.matchAll(/([^{}@]+)\{/g)]
    .map((m) => m[1]!.trim())
    .filter((s) => s && !s.startsWith('media') && !/^\(max-width/.test(s));
  assert.ok(selectores.length > 10, 'no se leyeron los selectores de la hoja');
  for (const s of selectores) {
    for (const parte of partes(s)) assert.match(parte, /^#v-conversation /, `\`${parte}\` no está acotado a #v-conversation`);
  }
  assert.doesNotMatch(panel(), /style=\{\{ (color|background)/, 'un color en línea: va por una clase de `app/conversation.css`');

  /* La estética de Inteligencia la repintaba, y desde el 2026-10-11 esa hoja no existe: el barrido de abajo vigila que
     ninguna otra la alcance. La de operación conserva sólo lo que viste al supervisor (`aud-*`), y la de las señales,
     su tarjeta y su plan. */
  const op = sinComentarios(leer('app/operacion-estetica.css'));
  for (const m of op.matchAll(/#v-conversation ([^{,]+)/g)) {
    assert.match(m[1]!, /^\.aud-/, `app/operacion-estetica.css tiene una regla para #v-conversation que no es del supervisor: ${m[0]}`);
  }
  for (const nombre of readdirSync(join(RAIZ, 'app')).filter((n) => n.endsWith('.css'))) {
    if (['aios.css', 'conversation.css', 'operacion-estetica.css', 'senales.css'].includes(nombre)) continue;
    assert.doesNotMatch(sinComentarios(leer(`app/${nombre}`)), /#v-conversation\b/, `app/${nombre} tiene una regla para #v-conversation`);
  }
});
