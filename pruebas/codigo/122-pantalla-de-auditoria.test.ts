// La pantalla del técnico: dos modos, dos agentes, y el nombre atado al CRM. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ SE PIDIÓ, Y CUÁL DE ESAS COSAS ERA UN DEFECTO
//
// *«Para colocar los prompts debe ser una pestaña dentro de auditoría… entonces habría una pestaña
// de inicio donde están los análisis, separados en leadflow (el chatbot que atiende el zona_setter) y
// appflow (el chat que atiende el zona_closer)… y en el auditor donde dice rojo tiene un color
// blanco.»*
//
// Lo último era un defecto de verdad y tiene su propia prueba en `121-tokens-de-css`: la hoja usaba
// `var(--danger)`, un token que no existe, y una `var()` inválida en `color` **hereda** — el chip
// «rojo» salía casi blanco.
//
// Lo demás es estructura, y es lo que este archivo cuida:
//
//   1 · DOS PESTAÑAS. Los cuadros de prompt vivían en el medio de la misma página y empujaban las
//       conversaciones auditadas debajo del borde de la pantalla.
//   2 · LOS ANÁLISIS SEPARADOS POR AGENTE. Son dos trabajos con dos prompts distintos: un patrón de
//       LeadFlow no se arregla tocando el prompt de AppFlow.
//   3 · EL NOMBRE QUE USA LA GENTE. `chat_pre_agenda` es un buen nombre interno y nadie lo dice en
//       voz alta; en el CRM son `leadflow` y `appflow`.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import { ETIQUETAS_DEL_AGENTE } from '../../lib/ghl/contrato.ts';
import { ATIENDE_EL_AGENTE } from '../../lib/auditor/portones.ts';
import { AGENTE_DEL_TERRITORIO, AGENTES } from '../../lib/auditor/veredicto.ts';
import {
  NOMBRE_DEL_AGENTE,
  ORDEN_DE_LOS_AGENTES,
  QUE_HACE_EL_AGENTE,
  ZONA_DEL_AGENTE,
} from '../../lib/auditor/vista.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');
const PANEL = 'components/auditoria/PanelDeAuditoria.jsx';
/* El envoltorio: los cuatro modos y la carga. El panel quedó con lo que dibuja las dos caras del
   supervisor. Ver el encabezado de los dos archivos. */
const CONVERSATION = 'components/conversation/PanelDeConversation.jsx';

// ═══════════════════════════════════════════════════════════════════════════════
// EL NOMBRE, ATADO AL CONTRATO DEL CRM
// ═══════════════════════════════════════════════════════════════════════════════

test('«LeadFlow» y «AppFlow» son los que el CONTRATO del CRM dice que son', () => {
  /* ══════════════════════════════════════════════════════════════════════════
     LA PRUEBA QUE IMPIDE EL CRUCE, Y EL CRUCE SERÍA INVISIBLE

     Se pidió que se llamen como en GoHighLevel, y el mapeo se puede escribir al revés sin que nada
     falle: la pantalla diría «LeadFlow · Zona Closer» sobre los análisis del agente de post-agenda,
     el técnico corregiría el prompt equivocado, y el patrón seguiría apareciendo.

     Así que no se compara contra dos cadenas escritas acá: se recorre la CADENA REAL, eslabón por
     eslabón, desde la etiqueta del CRM hasta el nombre de la pantalla.

         bot_activado_leadflow  ──(lib/ghl/contrato.ts)──▶  atendiendo_pre_agenda
                                ──(lib/auditor/portones.ts)──▶  territorio setter
                                ──(lib/auditor/veredicto.ts)──▶  chat_pre_agenda
                                ──(lib/auditor/vista.ts)──▶  «LeadFlow» · «Zona Setter»

     Cambiar cualquiera de los cuatro archivos sin cambiar los otros pone esto rojo.
     ══════════════════════════════════════════════════════════════════════════ */
  const cadena = (marca: string) => {
    const fila = ETIQUETAS_DEL_AGENTE.find((e) => e.etiqueta === `bot_activado_${marca}`);
    assert.ok(fila, `el contrato del CRM no tiene \`bot_activado_${marca}\``);

    /* De qué TERRITORIO es ese estado. Se busca en `ATIENDE_EL_AGENTE`, que es la tabla que el
       portón 2 consulta — así esto mide el sistema y no una copia. Se excluye `atendiendo`, que es
       el estado genérico y está en los dos. */
    const territorios = Object.entries(ATIENDE_EL_AGENTE)
      .filter(([, estados]) => estados.includes(fila.estado) && fila.estado !== 'atendiendo')
      .map(([t]) => t);
    assert.equal(
      territorios.length,
      1,
      `el estado \`${fila.estado}\` cae en ${territorios.length} territorios y tiene que caer en uno`,
    );

    const territorio = territorios[0] as keyof typeof AGENTE_DEL_TERRITORIO;
    const agente = AGENTE_DEL_TERRITORIO[territorio];
    return { estado: fila.estado, territorio, agente, nombre: NOMBRE_DEL_AGENTE[agente] };
  };

  const lead = cadena('leadflow');
  assert.deepEqual(
    { estado: lead.estado, territorio: lead.territorio, agente: lead.agente, nombre: lead.nombre },
    {
      estado: 'atendiendo_pre_agenda',
      territorio: 'setter',
      agente: 'chat_pre_agenda',
      nombre: 'LeadFlow',
    },
    'la cadena de LeadFlow se rompió: la pantalla puede estar nombrando al agente equivocado',
  );

  const app = cadena('appflow');
  assert.deepEqual(
    { estado: app.estado, territorio: app.territorio, agente: app.agente, nombre: app.nombre },
    {
      estado: 'atendiendo_post_agenda',
      territorio: 'closer',
      agente: 'chat_post_agenda',
      nombre: 'AppFlow',
    },
    'la cadena de AppFlow se rompió: la pantalla puede estar nombrando al agente equivocado',
  );

  /* Y la ZONA que se dibuja al lado del nombre sale del mismo territorio. Sin esto, «LeadFlow · Zona
     Closer» pasaría todo lo de arriba: el nombre estaría bien y la píldora de al lado, al revés. */
  assert.match(ZONA_DEL_AGENTE[lead.agente], /Setter/);
  assert.match(ZONA_DEL_AGENTE[app.agente], /Closer/);
});

test('cada agente tiene nombre, zona y una línea de qué hace', () => {
  /* Los tres son `Record` sobre el enumerado, así que un agente nuevo sin entrada NO COMPILA. Esto
     comprueba la otra mitad, que el tipo no ve: que ninguno esté vacío. Una cadena vacía compila y
     deja la tarjeta con un hueco donde iba el nombre. */
  for (const agente of AGENTES) {
    for (const [que, tabla] of [
      ['nombre', NOMBRE_DEL_AGENTE],
      ['zona', ZONA_DEL_AGENTE],
      ['qué hace', QUE_HACE_EL_AGENTE],
    ] as const) {
      assert.ok(tabla[agente]?.trim(), `el agente \`${agente}\` no tiene ${que}`);
    }
  }

  // Y los nombres son DISTINTOS entre sí, o los dos bloques se ven iguales.
  const nombres = AGENTES.map((a) => NOMBRE_DEL_AGENTE[a]);
  assert.equal(new Set(nombres).size, nombres.length, 'dos agentes se llaman igual en la pantalla');
});

test('el ORDEN de los agentes es el del embudo, y no deja a ninguno afuera', () => {
  /* ── LA MITAD QUE IMPORTA ES LA SEGUNDA ────────────────────────────────────
   *
   * El orden —primero el que consigue la cita, después el que la acompaña— es una decisión de
   * producto y se afirma. Pero lo que esta prueba impide de verdad es el defecto `4.1` del origen:
   * *«la causa es una lista escrita a mano»*. Con el arreglo escrito a mano, un agente nuevo en
   * `AGENTES` **no aparecería en esta pantalla** y sus análisis existirían sin que nadie los vea.
   *
   * Por eso se compara contra `AGENTES` como CONJUNTO: la lista tiene que contener exactamente los
   * mismos, ni uno menos. */
  assert.deepEqual(
    [...ORDEN_DE_LOS_AGENTES].sort(),
    [...AGENTES].sort(),
    'el orden de la pantalla no cubre exactamente los agentes del enumerado: hay uno que no se dibuja',
  );

  assert.deepEqual(
    ORDEN_DE_LOS_AGENTES.map((a) => NOMBRE_DEL_AGENTE[a]),
    ['LeadFlow', 'AppFlow'],
    'el orden dejó de ser el del embudo: primero el que consigue la cita',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// LOS MODOS DE CONVERSATION: EL SUPERVISOR SON LOS DOS ÚLTIMOS
// ═══════════════════════════════════════════════════════════════════════════════

test('el supervisor son DOS de los cuatro modos de Conversation, al final, y abre en el primero', () => {
  /* ── ESTA PANTALLA ERA PROPIA Y AHORA VIVE ADENTRO DE OTRA ─────────────────
   *
   * «Auditoría de agentes» tenía su barra con dos pestañas —Inicio y Prompts— y colgaba del grupo
   * «Operación». Audita `chat_pre_agenda` y `chat_post_agenda`, que son **exactamente** Lead Flow y
   * Appointment Flow: los dos módulos que la arquitectura funcional pone dentro de Conversation
   * Intelligence. Se archivó donde correspondía.
   *
   * Desde el 2026-10-10 (CN-3) las dos son los dos últimos modos del selector del prototipo, después de
   * Estado y Agentes, y dibujan lo mismo que antes (docs/2-departamentos/conversation/01, CN1-13). */
  const jsx = leer(CONVERSATION);

  const bloque = jsx.slice(jsx.indexOf('const MODOS = ['), jsx.indexOf('];', jsx.indexOf('const MODOS = [')));
  const orden = [...bloque.matchAll(/clave: '(\w+)'/g)].map((m) => m[1]!);
  assert.deepEqual(
    orden,
    ['estado', 'agentes', 'auditoria', 'prompts'],
    'los cuatro modos de Conversation no son los dos del prototipo y después el supervisor',
  );

  /* Abre en el PRIMERO. Se afirma derivado de `MODOS`, no contra la cadena `'estado'`: reordenar los modos no
     tiene que romper esto. */
  assert.match(
    jsx,
    /useState\(MODOS\[0\]\.clave\)/,
    'la pantalla no abre en su primer modo, o lo fija a mano en vez de derivarlo de `MODOS`',
  );

  /* ── LOS PROMPTS, SOLO EN SU MODO ───────────────────────────────────────
   *
   * Lo que hay que impedir es que el cuadro quede en los dos: dos `textarea` en el modo de los análisis
   * son los que empujaban las conversaciones fuera de la pantalla. */
  const panel = leer(PANEL);
  assert.equal(
    (panel.match(/<Prompts\s/g) ?? []).length,
    1,
    'el bloque de prompts se dibuja más de una vez',
  );
  assert.match(
    panel,
    /sub === 'prompts'\) return <Prompts /,
    'el bloque de prompts no está detrás de su modo',
  );
  assert.match(jsx, /sub=\{modo === 'prompts' \? 'prompts' : 'inicio'\}/, 'el modo Prompts no abre la cara de los prompts');
});

test('el selector de modos se dibuja también mientras carga y con error', () => {
  /* Si el selector viviera después de los `return` de carga y de error, aparecería junto con los datos
     —la pantalla salta— y quien entra con un error de red se queda sin ningún modo que apretar. */
  const jsx = leer(CONVERSATION);
  const selector = jsx.indexOf('<Modos valor={modo}');
  assert.ok(selector > 0, 'no está el selector de modos');
  assert.ok(
    selector < jsx.indexOf('<Supervisor') && selector < jsx.indexOf('{error ?'),
    'el selector se dibuja después del cuerpo, así que desaparece con un error',
  );
  assert.match(jsx, /<div className="mode-seg" role="group" aria-label="Modo">/, 'el selector no es el `.mode-seg` del prototipo');
  assert.ok(
    !/if \(cargando\) return/.test(jsx),
    'el envoltorio volvió a decidir los estados de carga con un `return`: el selector tiene que quedar por ' +
      'encima de los dos',
  );
  /* Y el panel del supervisor sigue devolviendo temprano en sus estados, que es lo que hace que valga la pena
     que el selector esté afuera. */
  assert.match(leer(PANEL), /if \(cargando\) return/);
});

// ═══════════════════════════════════════════════════════════════════════════════
// LOS ANÁLISIS, SEPARADOS POR AGENTE
// ═══════════════════════════════════════════════════════════════════════════════

test('los patrones y las conversaciones se filtran POR AGENTE', () => {
  /* ── EL PEDIDO, Y CÓMO SE ROMPE SIN QUE NADA FALLE ─────────────────────────
   *
   * *«los análisis, separados en leadflow y appflow»*. Si el filtro se cayera, cada bloque mostraría
   * TODO: los mismos tres patrones repetidos bajo los dos agentes. No falla nada —las filas existen,
   * los textos son correctos— y el técnico corrige el prompt equivocado.
   *
   * Se comprueba que el filtro exista y que compare contra el agente del bloque, no contra una
   * constante: `c.agente === agente`, con `agente` viniendo del recorrido. */
  const jsx = leer(PANEL);

  assert.match(
    jsx,
    /patrones=\{patrones\.filter\(\(p\) => p\.casos\[0\]\?\.agente === agente\)\}/,
    'los patrones no se filtran por el agente del bloque',
  );
  assert.match(
    jsx,
    /conversaciones=\{pantalla\.conversaciones\.filter\(\(c\) => c\.agente === agente\)\}/,
    'las conversaciones no se filtran por el agente del bloque',
  );

  // Y el recorrido sale del orden derivado, no de la lista de tarjetas que llegó del servidor: así
  // un agente sin tarjeta igual se dibuja, y ninguno depende de que el servidor lo mande.
  assert.match(jsx, /ORDEN_DE_LOS_AGENTES\.map\(\(agente\) => \(/);
});

test('la pantalla DICE que solo audita chats, y no llamadas', () => {
  /* Se pidió recordarlo —*«por ahora solo estamos auditando full chatbots y no agentes de
     llamadas»*— y decirlo en la pantalla no es un comentario: quien sabe que su cuenta tiene agentes
     de voz lee esta pantalla como incompleta, o peor, como que sus llamadas salieron todas bien.
     El motivo es medido: `negocio.llamadas` no tiene columna de transcripción. */
  const jsx = leer(PANEL);
  const i = jsx.indexOf('className="aud-alcance"');
  assert.ok(i > 0, 'se fue la nota de alcance');
  const nota = jsx.slice(i, i + 400);
  assert.match(nota, /llamada/i, 'la nota no menciona los agentes de llamada');
  /* El POR QUÉ tiene que ser el hecho medido, no una fórmula. La primera versión aceptaba
     «…así que no hay qué leer», que es circular: dice la consecuencia, no la causa. Una mutación
     que borraba la causa y dejaba esa cola pasaba en verde. Se exige la palabra que nombra el
     hecho: `negocio.llamadas` no tiene columna de transcripción. */
  assert.match(nota, /transcripci[óo]n/i, 'la nota no dice POR QUÉ: falta el hecho medido');
});

test('un nivel en CERO no se dibuja del color de su nivel', () => {
  /* Se vio en pantalla: «0 rojo» con borde y letra rojos llama la atención sobre lo que NO pasó, y
     ensucia el único color que tenía que significar algo. El cero no se esconde —es información— se
     dibuja neutro. */
  const jsx = leer(PANEL);
  assert.match(
    jsx,
    /n === 0 \? ' aud-chip-cero' : ''/,
    'un nivel en cero vuelve a pintarse del color de su nivel',
  );

  const css = leer('app/auditoria.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const i = css.indexOf('.aud-chip-cero');
  assert.ok(i > 0, 'no está la regla del chip en cero');
  const regla = css.slice(i, css.indexOf('}', i));
  assert.match(regla, /color:\s*var\(--txt-faint\)/);

  /* Y va DESPUÉS de los tres niveles en el archivo: con la misma especificidad gana el último, así
     que puesta antes no anularía nada y el cero seguiría rojo. */
  assert.ok(i > css.indexOf('.aud-chip-rojo'), 'la regla del cero está antes de la del rojo');
});

test('los niveles concuerdan en número: «2 verdes», no «2 verde»', () => {
  const jsx = leer(PANEL);
  assert.match(jsx, /n === 1 \? nivel : `\$\{nivel\}s`/, 'los chips del semáforo no pluralizan');
});

// ═══════════════════════════════════════════════════════════════════════════════
// EL FRENO LLEGA AL TABLERO, NO SOLO A AUDITORÍA
// ═══════════════════════════════════════════════════════════════════════════════

test('el tablero NO promete hallazgos cuando la empresa no audita', () => {
  /* ── EL DEFECTO, Y ERA FALSO PARA CASI TODA LA FLOTA ──────────────────────
   *
   * La pestaña de un flujo afirmaba sin condición que «sus hallazgos ya se ven en la pestaña Auditoría».
   * Medido el 2026-09-14 contra producción: de las **12 empresas activas, sólo 4 tienen llave de IA y sólo 1
   * tiene el identificador del agente en el CRM**. En las demás esa pestaña está vacía, y la línea mandaba a
   * mirarla como si hubiera algo.
   *
   * Desde el 2026-10-10 (CN-3) lo que manda a Auditoría es «Qué corregir · {N} por resolver», sobre las tarjetas
   * de agente. Con la empresa sin auditar, en vez del número dice su frase: un «0 por resolver» se leería como
   * que no hay nada que corregir, y lo que pasa es que nadie lo mira.
   *
   * Se lee el FUENTE y no el resultado porque el freno depende de datos de la empresa, y una prueba que montara
   * la pantalla con una empresa sin freno pasaría sin tocar esto. */
  const jsx = leer(CONVERSATION);
  assert.match(jsx, /<QueCorregir c=\{porCorregir\} alCorregir=\{alCorregir\} \/>/, 'el freno no le llega a «Qué corregir»');
  assert.match(
    jsx,
    /\{c\.valor === null \? \(\s*<span className="gn">\{FRASE_DEL_MOTIVO\[c\.motivo\] \?\? FRASE\.guion\}<\/span>\s*\) : \(\s*<button type="button" className="gn cs-ir" onClick=\{alCorregir\}>/,
    'la línea que manda a Auditoría sigue siendo incondicional',
  );
  /* Y el servidor no cuenta patrones sin auditoría: la cifra viaja en «—» con su motivo, y el sentimiento también. */
  assert.match(leer('lib/negocio/lecturaDeConversation.ts'), /porCorregir: e\.audita \? conValor\(e\.porCorregir\) : sinValor\('no_audita'\),/);
});

test('el motivo del freno sale de UN solo sitio, y Auditoría lo importa', () => {
  /* El texto largo del motivo —por qué esta empresa no audita— lo dibuja el modo Auditoría, importado de un solo
     mapa. El tablero no lo copia: dice la frase corta de su lista cerrada (CN1-02). */
  assert.match(
    leer(PANEL),
    /import \{[^}]*POR_QUE_NO_AUDITA/s,
    'Auditoría no importa el mapa de motivos: si lo copió, va a divergir',
  );
  const conv = leer(CONVERSATION);
  assert.ok(!conv.includes('Esta empresa todavía no audita'), 'el tablero copió el aviso de Auditoría en vez de usar su frase');
});

test('la pantalla NO afirma en ningún caso que no se puede calcular nada', () => {
  /* El defecto que esta prueba persigue: la pestaña mostraba un número Y decía tres centímetros más abajo que
     «sus indicadores todavía no se pueden calcular». Las dos cosas en la misma pantalla se desmienten, y la que
     pierde credibilidad es la cifra. Desde CN-3 la pantalla no dibuja ningún párrafo (CN1-05): lo que falta para
     medir lo demás está en `docs/5-pendiente/lo-que-conversation-no-mide.md`, y cada «—» dice su porqué en una
     línea. */
  const jsx = leer(CONVERSATION);
  /* La guarda dentro de una cadena, no en un comentario: un `indexOf` de la frase suelta encontraría una
     explicación en vez del texto que se dibuja. */
  assert.ok(
    !/['"`][^'"`]*indicadores todavía no se pueden calcular/.test(jsx),
    'volvió el aviso que afirma que no se puede calcular nada mientras la pantalla muestra cifras',
  );
});

test('las advertencias que el panel ya no dibuja las dice el cerebro', () => {
  /* Antes iban debajo de cada cifra: que la respuesta mide si el CONTACTO contestó —el sistema todavía no distingue
     un mensaje del agente de uno de un flujo del CRM; medido, el 71,5 % de lo sellado con el identificador del
     agente es `workflow`— y que el no-show son eventos que reporta el closer, no una tasa. El tablero ya no tiene
     párrafos (CN1-05), y sin estas dos líneas el agente leería la tasa como el rendimiento del agente. */
  const conversation = leer('lib/agentes/executive/adaptadores/conversation.ts');
  const leadFlow = conversation.slice(conversation.indexOf("nombre: 'lead_flow'"), conversation.indexOf("nombre: 'atribucion_del_lead'"));
  assert.match(leadFlow, /CONTACTO contestó/, 'el cerebro no advierte que la respuesta es del contacto');
  assert.match(leadFlow, /flujo del CRM/, 'no se nombra el motivo: sin él la advertencia se lee como una fórmula');
  const sales = leer('lib/agentes/executive/adaptadores/sales.ts');
  const citas = sales.slice(sales.indexOf("nombre: 'cancelacion_de_citas'"), sales.indexOf('secciones:', sales.indexOf("nombre: 'cancelacion_de_citas'")));
  assert.match(citas, /reporta el closer/, 'no se dice quién reporta el no-show, y el CRM no lo sabe');
  assert.match(citas, /no una tasa/, 'el no-show se puede leer como una tasa');
});
