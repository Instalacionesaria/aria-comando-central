// La pantalla del técnico: dos pestañas, dos agentes, y el nombre atado al CRM. Tipo: Código.
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
/* El envoltorio: las cuatro pestañas, la carga y los contadores. El panel quedó con lo que dibuja
   las dos caras del supervisor. Ver el encabezado de los dos archivos. */
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
// LAS PESTAÑAS, QUE AHORA SON CUATRO Y SON DE CONVERSATION
// ═══════════════════════════════════════════════════════════════════════════════

test('el supervisor son DOS de las cuatro pestañas de Conversation, y abre en la primera', () => {
  /* ── ESTA PANTALLA ERA PROPIA Y AHORA VIVE ADENTRO DE OTRA ─────────────────
   *
   * «Auditoría de agentes» tenía su barra con dos pestañas —Inicio y Prompts— y colgaba del grupo
   * «Operación». Audita `chat_pre_agenda` y `chat_post_agenda`, que son **exactamente** Lead Flow y
   * Appointment Flow: los dos módulos que la arquitectura funcional pone dentro de Conversation
   * Intelligence. Se archivó donde correspondía.
   *
   * Las dos pestañas subieron al primer nivel en vez de anidarse, y eso es lo que se afirma: la
   * estética de operación dibuja UNA barra por pantalla, así que anidarlas habría puesto dos
   * encimadas con la misma forma y distinto contenido. */
  const jsx = leer(CONVERSATION);

  const bloque = jsx.slice(jsx.indexOf('const SUB = ['), jsx.indexOf('];', jsx.indexOf('const SUB = [')));
  const orden = [...bloque.matchAll(/clave: '(\w+)'/g)].map((m) => m[1]!);
  assert.deepEqual(
    orden,
    ['leadflow', 'appflow', 'auditoria', 'prompts'],
    'las cuatro pestañas de Conversation no son los dos flujos y después el supervisor',
  );

  /* Abre en la PRIMERA. Abrir en otra deja la pestaña de la izquierda sin usar y eso se lee como
     que no responde — es la misma regla que el Closer y el Setter. Y se afirma derivado de `SUB`,
     no contra la cadena `'leadflow'`: reordenar las pestañas no tiene que romper esto. */
  assert.match(
    jsx,
    /useState\(SUB\[0\]\.clave\)/,
    'la pantalla no abre en su primera pestaña, o la fija a mano en vez de derivarla de `SUB`',
  );

  /* ── LOS PROMPTS, SOLO EN SU PESTAÑA ────────────────────────────────────
   *
   * Lo que hay que impedir es que el cuadro quede en las dos: dos `textarea` en la pestaña de los
   * análisis son los que empujaban las conversaciones fuera de la pantalla. Sigue detrás de su
   * condición, ahora dentro del panel, que entiende dos caras. */
  const panel = leer(PANEL);
  assert.equal(
    (panel.match(/<Prompts\s/g) ?? []).length,
    1,
    'el bloque de prompts se dibuja más de una vez',
  );
  assert.match(
    panel,
    /sub === 'prompts'\) return <Prompts /,
    'el bloque de prompts no está detrás de su pestaña',
  );
});

test('la barra de pestañas se dibuja también mientras carga y con error', () => {
  /* Si la barra viviera después de los `return` de carga y de error, aparecería junto con los datos
     —la pantalla salta— y quien entra con un error de red se queda sin ninguna pestaña que apretar.
     Se comprueba por POSICIÓN: la barra tiene que estar antes de todo lo que puede volver temprano.
     Con la mudanza son dos archivos: la barra vive en el envoltorio y los `return` en el panel, y
     eso **por construcción** ya la deja afuera. Se afirma igual, porque lo que protege es que no
     vuelva a meterse adentro. */
  const jsx = leer(CONVERSATION);
  const barra = jsx.indexOf('className="cl-sub"');
  assert.ok(barra > 0, 'no está la barra de sub-pestañas');
  assert.ok(
    barra < jsx.indexOf('<Cuerpo'),
    'la barra se dibuja después del cuerpo, así que desaparece con un error',
  );
  assert.ok(
    !/if \(cargando\) return/.test(jsx),
    'el envoltorio volvió a decidir los estados de carga: eso vive en el panel, y la barra tiene ' +
      'que quedar por encima de los dos',
  );
  /* Y el panel sigue devolviendo temprano en sus cuatro estados, que es lo que hace que valga la
     pena que la barra esté afuera. */
  assert.match(leer(PANEL), /if \(cargando\) return/);

  // Y usa la MISMA barra que el Closer y el Setter, no un tercer estilo.
  assert.match(leer('components/views/CloserView.jsx'), /className="cl-sub"/);
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
// EL FRENO LLEGA A LAS TRES PESTAÑAS, NO SOLO A AUDITORÍA
// ═══════════════════════════════════════════════════════════════════════════════

test('las pestañas de flujo NO prometen hallazgos cuando la empresa no audita', () => {
  /* ── EL DEFECTO, Y ERA FALSO PARA CASI TODA LA FLOTA ──────────────────────
   *
   * `Flujo` afirmaba sin condición que «sus hallazgos ya se ven en la pestaña Auditoría». Medido el
   * 2026-09-14 contra producción: de las **12 empresas activas, sólo 4 tienen llave de IA y sólo 1
   * tiene el identificador del agente en el CRM**. En las demás esa pestaña está vacía, y la línea
   * mandaba a mirarla como si hubiera algo.
   *
   * Es el mismo defecto que esta aplicación persigue en las cifras —prometer un dato que no está— y
   * el freno que lo dice bien ya existía en `pantalla.noAudita`; sólo lo leía Auditoría.
   *
   * Se lee el FUENTE y no el resultado porque el freno depende de datos de la empresa, y una prueba
   * que montara la pantalla con una empresa sin freno pasaría sin tocar esto. */
  const jsx = leer(CONVERSATION);

  // 1 · El componente recibe el freno. Sin esto no puede decidir nada.
  /* La lista de parámetros NO se fija entera a propósito: la primera versión de esta prueba exigía
     `{ flujo, noAudita }` exacto y se rompió sola al agregar un tercero, sin que nada estuviera mal.
     Lo que hay que afirmar es que el freno LLEGA, no cuántos vecinos tiene. */
  assert.match(
    jsx,
    /function Flujo\(\{[^}]*noAudita[^}]*\}\)/,
    'el flujo no recibe el freno: no puede saber si la empresa audita',
  );
  assert.match(
    jsx,
    /<Flujo[^>]*noAudita=\{pantalla\?\.noAudita/,
    'el freno no se le pasa al flujo desde la pantalla',
  );

  // 2 · La promesa es CONDICIONAL. Es la mitad que de verdad arregla el defecto.
  const i = jsx.indexOf('pestaña <b>Auditoría</b>');
  assert.ok(i > 0, 'se fue la línea que manda a Auditoría');
  const alrededor = jsx.slice(Math.max(0, i - 400), i);
  assert.match(
    alrededor,
    /noAudita\s*\?/,
    'la promesa «sus hallazgos ya se ven en Auditoría» sigue siendo incondicional, y es falsa en 11 ' +
      'de las 12 empresas activas',
  );

  // 3 · Y cuando frena, lo dice con el MISMO texto que la otra pestaña: dos redacciones del mismo
  //     hecho se leen como dos problemas distintos.
  assert.match(jsx, /POR_QUE_NO_AUDITA\[noAudita\]/, 'el flujo no reusa el motivo ya escrito');
  assert.match(jsx, /Esta empresa todavía no audita/, 'el flujo no dice el freno con el texto de la casa');
});

test('el motivo del freno sale de UN solo sitio, y las dos pantallas lo importan', () => {
  /* La comprobación de entrada muerta de la de arriba: si alguien copiara el texto del motivo en vez
     de importarlo, la prueba anterior seguiría pasando y las dos pantallas podrían divergir en el
     siguiente cambio. */
  const conv = leer(CONVERSATION);
  const aud = leer(PANEL);
  const pantallas: [string, string][] = [
    ['Conversation', conv],
    ['Auditoría', aud],
  ];
  for (const [nombre, jsx] of pantallas) {
    assert.match(
      jsx,
      /import \{[^}]*POR_QUE_NO_AUDITA/s,
      `${nombre} no importa el mapa de motivos: si lo copió, las dos pantallas van a divergir`,
    );
  }
});

test('la cifra medida va ARRIBA de lo que falta, y sólo en Appointment Flow', () => {
  /* Dos cosas que se rompen distinto.
   *
   * 1 · EL ORDEN. Lo que sí se sabe va primero. Al revés, la pestaña se lee como vacía y nadie llega
   *     al número: el «qué falta» son tres párrafos.
   * 2 · EL ALCANCE. La cancelación es de citas, o sea de Appointment Flow. Dibujarla también en Lead
   *     Flow pondría una cifra correcta bajo un título que no la explica, que es peor que no
   *     mostrarla — nadie sabría de qué población habla. */
  const jsx = leer(CONVERSATION);

  assert.match(
    jsx,
    /cancelacion=\{sub === 'appflow'/,
    'la cifra no está acotada a Appointment Flow: la cancelación es de citas',
  );

  const cifra = jsx.indexOf('<Cancelacion c={cancelacion}');
  const falta = jsx.indexOf('flujo.falta.map');
  assert.ok(cifra > 0 && falta > 0, 'falta la cifra o la lista');
  assert.ok(cifra < falta, 'la lista de lo que falta quedó ANTES de la cifra medida');
});

test('con la cifra presente, el aviso deja de decir que NO se puede calcular nada', () => {
  /* El defecto más fino de este cambio: la pestaña pasa a mostrar un número Y a decir tres
     centímetros más abajo que «sus indicadores todavía no se pueden calcular». Las dos cosas en la
     misma pantalla se desmienten, y la que pierde credibilidad es la cifra. */
  const jsx = leer(CONVERSATION);
  /* El literal ENTRECOMILLADO y no la frase suelta: el archivo explica este mismo aviso en un
     comentario de arriba, y un `indexOf` de la frase encuentra la explicación antes que el texto
     que se dibuja. La prueba entonces compara la guarda contra la posición de un comentario, que
     es una posición sin significado. */
  const i = jsx.search(/'Sus (demás )?indicadores todavía no se pueden calcular/);
  assert.ok(i > 0, 'se fue el aviso de lo que falta, o dejó de ser un literal');

  /* ── SE MIRA LA GUARDA, NO UNA VENTANA DE CARACTERES ──────────────────────
   *
   * Esto buscaba `cancelacion ?` en los 300 caracteres anteriores al aviso, y se rompió al agregar
   * la tercera cifra: el JSX que hay en el medio creció y empujó la guarda fuera de la ventana. La
   * prueba fallaba sobre un archivo correcto, que es la clase de falso positivo que enseña a apagar
   * una prueba.
   *
   * La propiedad real no es la distancia: es que el aviso **esté adentro de un condicional que
   * nombre las cifras**, y que ese condicional aparezca antes. Así agregar una cuarta cifra obliga
   * a sumarla a la guarda —que es lo correcto— en vez de a mover un número acá. */
  const guarda = jsx.search(/\{cancelacion\s*\|\|/);
  assert.ok(guarda > 0, 'el aviso dejó de estar guardado por las cifras que ya se calculan');
  assert.ok(guarda < i, 'la guarda quedó DESPUÉS del aviso que tiene que condicionar');
  assert.match(jsx, /Sus demás indicadores/, 'falta la variante que reconoce la cifra que ya hay');
});

test('cada cifra dice SOBRE QUÉ se calculó, y el no-show no se dibuja como tasa', () => {
  /* Dos defectos que se ven igual de bien en pantalla y significan cosas falsas.
   *
   * 1 · Las cuatro cifras NO comparten población: «se reserva con» sale de las citas que tienen
   *     fecha de reserva, que son menos. Sin decirlo, alguien lee las cuatro como si hablaran de las
   *     mismas filas y saca conclusiones cruzadas que no se sostienen.
   * 2 · El no-show son DOS eventos en catorce días. Dibujarlo con un `%` al lado de tres
   *     porcentajes reales lo vuelve indistinguible de ellos, y una tasa sobre dos eventos se mueve
   *     cincuenta puntos con el próximo registro. */
  const jsx = leer(CONVERSATION);

  assert.match(
    jsx,
    /detalle=\{`sobre \$\{c\.conFechaDeReserva\} de \$\{c\.citas\}`\}/,
    'la mediana no dice sobre cuántas citas se calculó: se lee con el denominador de las otras',
  );
  assert.match(jsx, /detalle="reportados"/, 'el no-show no dice que es un conteo reportado');
  assert.ok(
    !/noShowReportado\}\s*%/.test(jsx) && !/\$\{c\.noShowReportado\} %/.test(jsx),
    'el no-show se dibuja como porcentaje: con dos eventos eso no es una tasa',
  );
  assert.match(
    jsx,
    /reporta el closer/,
    'no se dice quién reporta el no-show, y el CRM no lo sabe',
  );
});

test('la cifra de Lead Flow DICE que no sabe a quién se le contestó', () => {
  /* Es la advertencia que la vuelve honesta. La tasa mide si el CONTACTO contestó, y el sistema
     todavía no distingue un mensaje del agente de uno de un flujo del CRM —medido: el 71,5 % de lo
     sellado con el identificador del agente es `workflow`—. Sin esta línea, alguien la lee como el
     rendimiento del agente y decide con ella.
     Y va acotada a Lead Flow, como la de citas a Appointment Flow: son de poblaciones distintas. */
  const jsx = leer(CONVERSATION);

  assert.match(
    jsx,
    /respuesta=\{sub === 'leadflow'/,
    'la cifra de respuesta no está acotada a Lead Flow',
  );
  assert.match(jsx, /no a qui[ée]n<\/b>/i, 'la cifra no advierte que no sabe quién escribió');
  assert.match(
    jsx,
    /flujo del CRM/,
    'no se nombra el motivo: sin él la advertencia se lee como una fórmula',
  );
});
