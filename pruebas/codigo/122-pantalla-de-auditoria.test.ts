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
// LAS DOS PESTAÑAS
// ═══════════════════════════════════════════════════════════════════════════════

test('la pantalla tiene DOS sub-pestañas, abre en Inicio, y los prompts están solo en la otra', () => {
  const jsx = leer(PANEL);

  const bloque = jsx.slice(jsx.indexOf('const SUB = ['), jsx.indexOf('];', jsx.indexOf('const SUB = [')));
  const orden = [...bloque.matchAll(/clave: '(\w+)'/g)].map((m) => m[1]!);
  assert.deepEqual(orden, ['inicio', 'prompts'], 'las sub-pestañas no son Inicio y después Prompts');

  /* Abre en la PRIMERA. Abrir en la segunda deja la pestaña de la izquierda sin usar y eso se lee
     como que no responde — es la misma regla que el Closer y el Setter. */
  assert.match(
    jsx,
    /useState\('inicio'\)/,
    'la pantalla no abre en Inicio: la pestaña de la izquierda queda sin usar',
  );

  /* ── LOS PROMPTS, SOLO EN SU PESTAÑA ────────────────────────────────────
   *
   * Es el pedido literal, y lo que hay que impedir es que el cuadro quede en las dos: dos `textarea`
   * en Inicio son los que empujaban las conversaciones fuera de la pantalla. Se comprueba que el
   * componente `Prompts` se monte UNA sola vez y detrás de la condición de la pestaña. */
  assert.equal(
    (jsx.match(/<Prompts\s/g) ?? []).length,
    1,
    'el bloque de prompts se dibuja más de una vez',
  );
  assert.match(
    jsx,
    /sub === 'prompts'\) return <Prompts /,
    'el bloque de prompts no está detrás de su pestaña',
  );
});

test('la barra de pestañas se dibuja también mientras carga y con error', () => {
  /* Si la barra viviera después de los `return` de carga y de error, aparecería junto con los datos
     —la pantalla salta— y quien entra con un error de red se queda sin ninguna pestaña que apretar.
     Se comprueba por POSICIÓN: la barra tiene que estar antes del componente que decide los estados. */
  const jsx = leer(PANEL);
  const barra = jsx.indexOf('className="cl-sub aud-sub"');
  const cuerpo = jsx.indexOf('function Cuerpo(');
  const cargando = jsx.indexOf("if (cargando) return");

  assert.ok(barra > 0, 'no está la barra de sub-pestañas');
  assert.ok(barra < cuerpo, 'la barra se dibuja dentro del cuerpo, así que desaparece con un error');
  assert.ok(barra < cargando, 'la barra se dibuja después del estado de carga');

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
