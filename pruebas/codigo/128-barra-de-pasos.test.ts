// La barra del método: paso anterior, progreso y «Continuar al paso N». Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// DE DÓNDE SALE
//
// Reportado por Kevin: se terminan los cinco pasos del Research y no hay ningún «Continuar al paso
// 3». En ARIA-brain esa barra (`StepNav`) acompaña a todas las herramientas del método y este port
// se la había dejado.
//
// Lo que se persigue acá:
//
//   · Que la barra NAVEGUE y no genere. Cada generación gasta la llave de IA de la organización:
//     una cadena que se dispara sola gastaría nueve porque alguien terminó la primera.
//   · Que el orden sea el del MÉTODO. No es el de los identificadores ni el de las pestañas, y
//     equivocarlo manda al alumno a construir sobre algo que todavía no existe.
//   · Que no ofrezca un botón que no puede cumplir. El VSL y la Landing viven en `tools`: desde
//     «ICP & Oferta» no se los puede abrir con un cambio de subpestaña, así que la barra lo DICE en
//     vez de llevar a la pantalla equivocada.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import { join } from 'node:path';

import { RAIZ } from '../apoyo/fuente.ts';
import { FUNDACIONES, TOOLS, TODAS, tieneAgente } from '../../lib/fundaciones/herramientas.ts';
import {
  TRAVESIA,
  pantallaDe,
  pasoAnterior,
  pasoSiguiente,
  posicionEnLaTravesia,
} from '../../lib/fundaciones/travesia.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');
const codigo = (r: string): string =>
  leer(r).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('la travesía es el orden del MÉTODO, y son los nueve pasos', () => {
  assert.deepEqual(
    TRAVESIA,
    [0, 1, 3, 2, 4, 10, 26, 5, 6],
    'Perfil → Research → ICP → Categoría → Oferta → Pricing → Mapa → VSL → Landing',
  );
});

test('ninguna herramienta del método queda fuera de la travesía, ni al revés', () => {
  /* La comprobación que impide que una mudanza rompa la barra en silencio. Toda herramienta que
     produce un entregable del método tiene que ser un paso, y todo paso tiene que existir. */
  const conEntregable = [...FUNDACIONES, ...TOOLS].filter(tieneAgente).map((h) => h.id).sort();
  assert.deepEqual([...TRAVESIA].sort(), conEntregable);
  for (const id of TRAVESIA) {
    assert.ok(TODAS.some((h) => h.id === id), `la travesía nombra ${id}, que no existe`);
  }
});

test('después del Research viene el ICP, y es el paso 3', () => {
  /* El caso del reporte, literal: los cinco pasos del Research terminados y el botón que faltaba. */
  assert.equal(posicionEnLaTravesia(1), 2, 'el Research es el paso 2 del método');

  const siguiente = pasoSiguiente(1);
  assert.ok(siguiente);
  assert.equal(siguiente.herramienta.id, 3, 'después del Research viene el ICP');
  assert.equal(siguiente.posicion, 3, 'el botón dice «Continuar al paso 3»');
  // Y está en la MISMA pantalla, así que el botón se puede dibujar de verdad.
  assert.equal(siguiente.pantalla, 'icp');

  const anterior = pasoAnterior(1);
  assert.equal(anterior?.herramienta.id, 0, 'antes del Research está Tu ficha');
});

test('los extremos no ofrecen lo que no hay', () => {
  assert.equal(pasoAnterior(0), null, 'el primer paso ofrece un «anterior»');
  assert.equal(pasoSiguiente(6), null, 'el último paso ofrece un «siguiente»');
  // Prospección y el Espía no son pasos del método: la barra no se dibuja para ellos.
  assert.equal(posicionEnLaTravesia(20), 0);
  assert.equal(pasoSiguiente(20), null);
});

test('la pantalla de cada paso se DERIVA del catálogo', () => {
  for (const h of FUNDACIONES) assert.equal(pantallaDe(h.id), 'icp');
  for (const h of TOOLS) assert.equal(pantallaDe(h.id), 'tools');
  // Y el cruce que la barra no puede resolver con un cambio de subpestaña: Mapa(26) → VSL(5).
  assert.equal(pasoSiguiente(26)?.pantalla, 'tools');
});

test('la barra NAVEGA y no genera', () => {
  /* La afirmación central. Lo que faltaba era la guía, no el gasto. */
  const barra = codigo('components/fundaciones/BarraDePasos.jsx');
  assert.ok(!/pedir\(/.test(barra), 'la barra hace una petición: está generando');
  assert.ok(!/rutaGenerar|correrTodo|generar\(/.test(barra), 'la barra dispara una generación');
  assert.match(barra, /onIr\(siguiente\.herramienta\.id, \{ rellenar: true \}\)/);
});

test('no se dibuja un botón que no puede cumplir', () => {
  /* El `07` § 4. Cuando el paso siguiente vive en la otra pantalla, la barra dice dónde está en vez
     de ofrecer un botón que abriría la herramienta equivocada. */
  const barra = codigo('components/fundaciones/BarraDePasos.jsx');
  assert.match(barra, /const puedeIr = \(vecino\) => !!vecino && vecino\.pantalla === pantalla;/);
  assert.match(barra, /puedeIr\(siguiente\) \?/);
});

test('la barra está en los dos paneles del método', () => {
  /* En el del Research —que es donde se reportó— y en el genérico, que sirve a las otras ocho. Una
     barra que existiera en una sola dejaría la travesía cortada en la primera herramienta que no la
     tenga, sin que nada falle. */
  for (const panel of [
    'components/fundaciones/PanelResearch.jsx',
    'components/fundaciones/PanelHerramienta.jsx',
  ]) {
    const fuente = codigo(panel);
    assert.match(fuente, /<BarraDePasos/, `${panel} no dibuja la barra del método`);
    assert.match(fuente, /pantalla=\{pantalla\}/, `${panel} no le pasa su pantalla`);
  }

  // Y el armazón le pasa a cada panel su pantalla, que es lo que decide si el botón se puede dibujar.
  const armazon = codigo('components/fundaciones/Fundaciones.jsx');
  assert.match(armazon, /pantalla: 'icp'/);
  assert.match(codigo('components/views/ToolsView.jsx'), /pantalla: 'tools'/);
});

test('recargar el estado DEVUELVE la promesa: sin eso, esperar la recarga es mentira', () => {
  /* ═══════════════════════════════════════════════════════════════════════════
   * REPORTADO EN VIVO: «le doy click a Continuar al paso 3 pero el formulario del ICP sigue vacío».
   *
   * El puente guardaba bien el segmento. Lo que fallaba era el `await`: `recargar` estaba escrito
   * como `() => { cargar(); }` —con llaves— así que TRAGABA la promesa. `await onEstadoCambiado()`
   * resolvía al instante, se navegaba al paso 3, y el panel se montaba leyendo el estado ANTERIOR.
   *
   * Y no se corregía solo cuando la recarga terminaba: `PanelHerramienta` lee sus valores en un
   * inicializador de `useState` y su `key` no cambia, así que el dato recién guardado aparecía
   * recién a la próxima visita a la pestaña.
   *
   * Es un defecto de UNA llave, invisible en el tipo y en el build: una función que devuelve
   * `undefined` se puede esperar igual, y `await undefined` no falla.
   * ═══════════════════════════════════════════════════════════════════════════ */
  const armazon = codigo('components/fundaciones/Fundaciones.jsx');
  assert.match(
    armazon,
    /const recargar = useCallback\(\(\) => cargar\(\), \[cargar\]\);/,
    '`recargar` volvió a tragarse la promesa: quien la espere va a seguir con el estado viejo',
  );
});

// ─── Rellenar el formulario con lo que ya se generó ────────────────────────

test('«ICP & Oferta» se trabaja solo por chat, y Tools conserva las dos opciones', () => {
  /* Pedido de Kevin (2026-09-03): «ya no habrá formularios, solo los chats», con alcance explícito:
     las siete de ICP & Oferta. Tools no se toca. Lo declara el catálogo de cada pantalla, en un solo
     lugar, y los dos paneles lo obedecen: sin selector, abren en el agente. */
  const armazon = codigo('components/fundaciones/Fundaciones.jsx');
  assert.match(armazon, /pantalla: 'icp',[\s\S]*?soloChat: true,/);
  assert.ok(!/soloChat: true/.test(codigo('components/views/ToolsView.jsx')), 'Tools perdió sus formularios');

  for (const panel of ['components/fundaciones/PanelHerramienta.jsx', 'components/fundaciones/PanelResearch.jsx']) {
    const fuente = codigo(panel);
    assert.match(fuente, /useState\(soloChat \? MODO_AGENTE : MODO_FORMULARIO\)/, `${panel} no abre en el agente`);
    assert.match(fuente, /!soloChat \?/, `${panel} sigue mostrando el selector sin formulario`);
  }

  // Y los inputs se siguen guardando igual: el chat escribe donde escribía el formulario.
  const operaciones = codigo('lib/fundaciones/operaciones.ts');
  assert.match(operaciones, /await abrir\(h, estado\.datos, acceso\.claveIa, chat\.answers\)/);
  assert.match(operaciones, /proponerRespuestas\(\{ claveIa, herramienta: h, estado \}\)/);
  // Si proponer falla, el chat abre igual, preguntando.
  assert.match(operaciones, /if \(p\.tipo === 'datos'\) propuestas = p\.valores;/);
});

test('una herramienta sin entregable SIEMPRE abre proponiendo, y reabrir conserva lo contestado', () => {
  /* Reportado dos veces: el chat mostraba una conversación vieja y muerta, sin ninguna señal de que el
     paso se estuviera preparando. La primera regla reabría solo llegando por «Continuar»; entrando
     por la pestaña —que es lo que uno hace— no pasaba nada, y el log lo confirmó: ni un POST al
     servidor. Ahora sin entregable se reabre siempre, y el servidor conserva lo que la conversación
     anterior había anotado, así que reabrir no cuesta trabajo. Con entregable, se respeta. */
  const operaciones = codigo('lib/fundaciones/operaciones.ts');
  assert.match(operaciones, /await abrir\(h, estado\.datos, acceso\.claveIa, chat\.answers\)/);
  assert.match(operaciones, /previas: Record<string, string> = \{\},/);
  const chat = codigo('components/fundaciones/ChatDeHerramienta.jsx');
  assert.match(chat, /if \(mensajes\.length > 0 && !reiniciarAlAbrir && !anticuada\) return;/);

  /* ── Y LAS CONVERSACIONES DE UNA VERSIÓN ANTERIOR SE REABREN UNA VEZ ──────────
     Kevin, con captura: «me preguntó de todo». Esa conversación venía del agente viejo —cuestionario
     ciego, y turnos suyos diciendo «eso todavía no existe»— y el modelo se los creía. Cada chat guarda
     con qué versión nació; una anterior se reabre conservando lo contestado, y la nueva nace sellada. */
  assert.match(chat, /\(inicial\.agent_version \?\? 0\) < VERSION_DEL_AGENTE/);
  const operacionesV = codigo('lib/fundaciones/operaciones.ts');
  assert.match(operacionesV, /const anticuada = chat\.messages\.length > 0 && \(chat\.agent_version \?\? 0\) < VERSION_DEL_AGENTE;/);
  assert.match(operacionesV, /const recienAbierta = reiniciar \|\| chat\.messages\.length === 0 \|\| anticuada;/);
  const conversacion = codigo('lib/fundaciones/conversacion.ts');
  assert.match(conversacion, /agent_version: VERSION_DEL_AGENTE/, 'la conversación nueva no nace sellada con su versión');
  // Con entregable ya generado, la reapertura no propone: ofrece responder sobre él o cambiarlo.
  assert.match(operacionesV, /mensajeDeAperturaConEntregable\(h, fecha\)/);
  assert.match(chat, /hablar\(reiniciarAlAbrir \? \{ reiniciar: true, generar: generarAlAbrir \} : \{\}\)/);
  // Y se ve que está trabajando: la apertura lee, no «escribe».
  assert.match(chat, /Leyendo tu ficha y tu research para proponerte las respuestas/);

  const generica = codigo('components/fundaciones/PanelHerramienta.jsx');
  assert.match(generica, /reiniciarAlAbrir=\{!!soloChat && versionesGuardadas\.length === 0\}/);
  const research = codigo('components/fundaciones/PanelResearch.jsx');
  assert.match(research, /reiniciarAlAbrir=\{!!soloChat && hechos === 0\}/);
});

test('«Continuar al paso N» ARMA el paso: reabre, propone y genera si alcanza, sin esperar un «sí»', () => {
  /* Pedido con todas las letras: «el botón Continuar al paso 3 debe armar el ICP con los datos de Tu
     ficha y de Research». Proponer y esperar la confirmación era quedarse a un paso. Ahora la
     llegada por el método pide `generar`; el servidor arranca si no falta ninguna obligatoria —la
     misma regla de `arranca`— y la pantalla genera. Si falta algo, propone y pregunta. */
  const chat = codigo('components/fundaciones/ChatDeHerramienta.jsx');
  assert.match(chat, /\{ reiniciar: true, generar: generarAlAbrir \}/);

  const generica = codigo('components/fundaciones/PanelHerramienta.jsx');
  assert.match(generica, /generarAlAbrir=\{!!rellenarAlLlegar && !!soloChat && versionesGuardadas\.length === 0\}/);
  const research = codigo('components/fundaciones/PanelResearch.jsx');
  assert.match(research, /generarAlAbrir=\{!!rellenarAlLlegar && !!soloChat && hechos === 0\}/);

  const operaciones = codigo('lib/fundaciones/operaciones.ts');
  assert.match(operaciones, /const arrancaSolo = recienAbierta && generar && !faltanObligatorias\(h, chat\.answers\);/);
  assert.match(operaciones, /listo: arrancaSolo/);
  // Sin `generar`, la apertura sigue proponiendo y esperando: entrar por la pestaña no gasta una generación.
  assert.ok(!/listo: true/.test(operaciones), 'la apertura genera aunque nadie haya venido por el método');
});

test('mientras se genera, hay un cartel que dice QUÉ se está construyendo', () => {
  /* Kevin: «tiene que haber algo que me diga que el ICP está siendo construido, no sé, una burbuja
     cargando o un mensaje». La línea con el esqueleto debajo del chat no bastaba. */
  const generica = codigo('components/fundaciones/PanelHerramienta.jsx');
  assert.match(generica, /\{generando \? \(\s*<div className="fd-construyendo"/);
  assert.match(generica, /Construyendo tu \{herramienta\.etiquetaSalida\}/);
  const research = codigo('components/fundaciones/PanelResearch.jsx');
  assert.match(research, /\{corriendo !== null \? \(\s*<div className="fd-construyendo"/);
  assert.match(research, /Construyendo tu Market Research/);
});

test('el relleno usa EL MISMO esquema que el agente conversacional', async () => {
  /* Son dos caminos que llenan los mismos campos del mismo formulario. Con dos esquemas, uno
     aceptaría un campo que el otro rechaza, y el defecto se vería como «por el chat sí y por el
     relleno no» — sin que nada falle en ninguno de los dos. */
  const { esquemaDeCampos, esquemaDeRespuestas } = await import('../../lib/fundaciones/conversacion.ts');
  const { herramienta } = await import('../../lib/fundaciones/herramientas.ts');
  const icp = herramienta(3)!;

  const suelto = esquemaDeCampos(icp);
  const dentroDelChat = (esquemaDeRespuestas(icp)['properties'] as Record<string, unknown>)['respuestas'];
  assert.deepEqual(dentroDelChat, suelto, 'el chat y el relleno dejaron de compartir el esquema');
});

test('el relleno lee EXACTAMENTE lo que el prompt de la herramienta va a leer', async () => {
  /* La primera versión leía los chips de «Hereda de», que para el ICP dicen solo `marketResearch`.
     Pero el prompt del ICP lee además la ficha de negocio, así que el relleno completaba el nicho y
     los dolores y dejaba vacío lo que estaba en la ficha. Ahora sale del mismo constructor que arma
     el prompt: no puede haber una fuente que una mitad use y la otra no. */
  const relleno = codigo('lib/fundaciones/relleno.ts');
  assert.match(relleno, /datosDe\(h\.id, \{\}, estado\)/);
  assert.ok(!/FUENTES_POR_HERRAMIENTA/.test(relleno), 'volvió a leer la lista de los chips, que es más corta que el prompt');

  // Y se comprueba contra el ICP real: con ficha y research presentes, los dos llegan al relleno.
  const { contextoHeredado } = await import('../../lib/fundaciones/relleno.ts');
  const { herramienta } = await import('../../lib/fundaciones/herramientas.ts');
  const { estadoVacio } = await import('../../lib/fundaciones/estado.ts');
  const e = estadoVacio();
  e.perfil = { 0: { biz: 'ARIA IA', niche: 'agencias', service: 'sistemas de IA', price: '$3k', pain: 'leads', result: '15 llamadas', before: 'ads' } };
  e.researchSalidas = ['s1', 'DOLORES DEL MERCADO', 's3', 's4', 'SEGMENTO GANADOR: agencias PPC'];
  const ctx = contextoHeredado(herramienta(3)!, e);
  assert.ok(ctx.includes('SEGMENTO GANADOR'), 'el research no llega al relleno del ICP');
  assert.ok(ctx.includes('ARIA IA'), 'la ficha no llega al relleno del ICP: el dominó se corta en el paso 1');
  assert.ok(ctx.includes('DOLORES DEL MERCADO'), 'los dolores del paso 2 no llegan');
});

test('sin contexto no se llama al modelo', () => {
  /* El prompt saldría con la sección vacía y el modelo llenaría los campos con lo típico del rubro
     —justo lo que sus reglas le prohíben— con la inferencia pagada igual. */
  const relleno = codigo('lib/fundaciones/relleno.ts');
  const corte = relleno.indexOf("if (contexto.trim() === '')");
  const llamada = relleno.indexOf('pedirExterno<RespuestaDeAnthropic>');
  assert.ok(corte > 0 && llamada > corte, 'se llama al modelo antes de comprobar que haya contexto');
});

test('el relleno PROPONE: no guarda ni genera', () => {
  /* Un dato que no se vio antes de guardarse es indistinguible de uno que la persona escribió, y de
     estos campos heredan las ocho herramientas siguientes. */
  const relleno = codigo('lib/fundaciones/relleno.ts');
  assert.ok(!/guardarInputs|guardarVersion|guardarResearch/.test(relleno), 'el relleno escribe en el almacén');

  const panel = codigo('components/fundaciones/PanelHerramienta.jsx');
  const cuerpo = panel.slice(panel.indexOf('const rellenar = async'), panel.indexOf('const generar = async'));
  assert.ok(!/pedir\(rutaEstado/.test(cuerpo), 'el botón de rellenar guarda sin que nadie lo pida');
  assert.ok(!/pedir\(rutaGenerar/.test(cuerpo), 'el botón de rellenar genera');
  // Solo completa los VACÍOS, y devuelve el resultado para que la llegada pueda seguir generando
  // con los valores en la mano y no con un estado que llega un render después.
  assert.match(cuerpo, /if \(vacio && v && v\.trim\(\) !== ''\) proximo\[campo\.id\] = v;/);
  assert.match(cuerpo, /return proximo;/);
});

test('los criterios del Research entran al relleno, y las reglas dejan deducir lo que se sostiene', async () => {
  /* «Muy mecánico»: la primera versión prohibía deducir y edad, país y ocupación quedaban vacíos
     aunque el research describiera al dueño de una agencia PPC en LATAM. Y los criterios con los
     que se hizo el research —el trasfondo suele decir a quién se le vende y dónde— no viajaban en
     ningún `_…Context`, porque los prompts leen las salidas del research, no sus entradas. */
  const relleno = codigo('lib/fundaciones/relleno.ts');
  assert.match(relleno, /CRITERIOS CON LOS QUE SE HIZO EL RESEARCH/);
  assert.match(relleno, /Completá TODOS los campos que el contexto sostenga/);
  assert.match(relleno, /No inventes cifras ni nombres propios/);

  const { contextoHeredado } = await import('../../lib/fundaciones/relleno.ts');
  const { herramienta } = await import('../../lib/fundaciones/herramientas.ts');
  const { estadoVacio } = await import('../../lib/fundaciones/estado.ts');
  const e = estadoVacio();
  e.researchInputs = { niche: 'Agencias de Marketing', experience: 'consultor para agencias en Perú', contract: '(no especificado)' };
  e.researchSalidas = ['s1', 's2', 's3', 's4', 'SEGMENTO GANADOR: agencias PPC'];
  const ctx = contextoHeredado(herramienta(3)!, e);
  assert.ok(ctx.includes('consultor para agencias en Perú'), 'el trasfondo del research no llega al relleno');
  assert.ok(!ctx.includes('(no especificado)'), 'los huecos del almacén llegaron como criterios');
});

test('un valor inventado en un desplegable se descarta, también acá', () => {
  /* Misma defensa que en el chat: el `SKILL.md` del VSL deriva booleanos del principio del valor, y
     uno inventado apaga la rama sin que nada falle. */
  const relleno = codigo('lib/fundaciones/relleno.ts');
  assert.match(relleno, /campo\.opciones\.some\(\(o\) => o\.valor === texto\) \? texto : ''/);
});

// ─── Llegar por el método significa llegar con el formulario completo ─────────

test('«Continuar al paso N» pide el relleno, y la pestaña de arriba no', () => {
  /* Reportado tres veces: «Continuar al paso 3 no me completa el formulario del ICP». En ARIA-brain
     ese botón solo navega y el research se ve como chips arriba del formulario; acá se decidió que
     llegar por el método signifique llegar con los campos completos. Lo que distingue este botón de
     la pestaña de arriba —que solo abre— es exactamente ese pedido. */
  const barra = codigo('components/fundaciones/BarraDePasos.jsx');
  assert.match(barra, /onIr\(siguiente\.herramienta\.id, \{ rellenar: true \}\)/);

  const armazon = codigo('components/fundaciones/Fundaciones.jsx');
  // El pedido se guarda POR herramienta y se entrega solo a la que se pidió.
  assert.match(armazon, /setRellenarAlLlegar\(opciones && opciones\.rellenar \? id : null\)/);
  assert.match(armazon, /rellenarAlLlegar=\{rellenarAlLlegar === herramienta\.id\}/);
  // Y las pestañas de arriba siguen abriendo sin pedir nada: `setActiva` a secas.
  assert.match(armazon, /onClick=\{\(\) => setActiva\(h\.id\)\}/);
});

test('el relleno al llegar corre UNA vez, con contexto, y mientras quede algo por llenar', () => {
  /* Tres condiciones y un guard, cada uno contra un gasto o una pérdida concreta:
       · el `ref`, contra el doble disparo del modo estricto — dos inferencias por una llegada;
       · el contexto presente, contra un rechazo rojo en una pantalla a la que se acaba de llegar;
       · que quede algo vacío, contra pagar una inferencia que no puede escribir nada.
     La regla anterior exigía el formulario ENTERO en blanco y se cayó en el primer uso: cuatro
     campos guardados por el primer relleno bastaron para que el botón no hiciera nada la segunda
     vez. Lo escrito lo protege el relleno al no pisar, no la condición de entrada. */
  const panel = codigo('components/fundaciones/PanelHerramienta.jsx');
  const efecto = panel.slice(panel.indexOf('const yaRellenoAlLlegar = useRef(false);'), panel.indexOf('const generar = async'));

  assert.match(efecto, /if \(!rellenarAlLlegar \|\| yaRellenoAlLlegar\.current\) return;/);
  assert.match(efecto, /yaRellenoAlLlegar\.current = true;/);
  assert.match(efecto, /const hayContexto = heredadas\.length > 0 && criticasQueFaltan\.length < heredadas\.length;/);
  assert.match(efecto, /const faltaAlgo = camposDe\(herramienta\)\.some\(/);
  assert.ok(!/const enBlanco = camposDe\(herramienta\)\.every\(/.test(efecto), 'volvió la regla del formulario entero en blanco');
  assert.match(efecto, /if \(!rutaRellenar \|\| !puedeEditar \|\| !hayContexto\) return;/);

  /* Y después de rellenar, GENERA — pero solo si todavía no hay entregable. Una generación son hasta
     16.000 tokens; regenerar cada vez que alguien pasa por el paso pisaría un documento que quizás
     se quería conservar. Los valores van por argumento, nunca por el estado. */
  assert.match(efecto, /const v = faltaAlgo \? await rellenar\(\) : valores;/);
  assert.match(efecto, /if \(v && versionesGuardadas\.length === 0\) await generar\(null, v\);/);
  // El pedido se consume al llegar, se rellene o no: si quedara puesto, la próxima visita manual
  // a esa pestaña dispararía una inferencia que nadie pidió.
  assert.match(efecto, /if \(onRellenadoAlLlegar\) onRellenadoAlLlegar\(\);/);
  // Y corre al montar, con dependencias vacías: no es un bucle, es una fotografía de la llegada.
  assert.match(efecto, /\}, \[\]\);/);
});

test('el puente con expresión regular se fue, y no volvió por otro nombre', () => {
  /* Sobre un research real devolvió media oración del medio de un párrafo —«comunicación
     automatizada, portales de reporte… es decir, la cura exacta para»— y la guardó como nicho. Un
     extractor de texto no sabe qué es un segmento; el relleno con el modelo lo reemplaza entero. */
  const { existsSync } = require('node:fs');
  assert.ok(!existsSync(join(RAIZ, 'lib/fundaciones/segmento.ts')), 'el extractor por regex sigue en el repo');
  const research = codigo('components/fundaciones/PanelResearch.jsx');
  assert.ok(!/nombreDelSegmento|pasarElSegmentoAlIcp|alSalir/.test(research), 'el Research sigue copiando el nicho a mano');
});
