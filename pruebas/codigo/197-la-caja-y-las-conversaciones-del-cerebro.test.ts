// La caja del cerebro al pie y CONVERSACIONES hablan con el cerebro, y no con otra cosa. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTO CUIDA (docs/OTROS/agentes/03-EL-CEREBRO.md, AG-40, AG-44, AG-51 y AG-57; NE-50)
//
// La segunda edición devolvió como «Próximamente» dos piezas del cerebro: la caja «Pregúntale al cerebro
// sobre …» al pie de cada pantalla de un departamento (`components/ConsultaAlCerebro.jsx`) y
// CONVERSACIONES en la barra (`components/Nav.jsx`). Desde AG7 de los agentes funcionan, y cinco formas de
// romperlas no fallan:
//
//   · que la caja pregunte a otra ruta que la de su sección, le pida algo al servidor por su cuenta o se
//     habilite sin el estado `listo`: una pregunta que el servidor rechaza, o que llega a otra caja;
//   · que no lleve el período que mira la pantalla (AG-44), o que una pantalla con períodos no lo anuncie;
//   · que nombre a mano la pantalla sobre la que se pregunta: una segunda tabla de lugares;
//   · que vaya dentro de `.main` —les taparía el pie a las pantallas de operación—, antes del cuerpo o en
//     el teléfono (`NE-18`, AG-58), o que se dibuje en el Inicio, que tiene la suya;
//   · que CONVERSACIONES le pida algo al servidor (la barra no pide nada: `193`), la vea quien no ve el
//     Inicio, o abra otra cosa que el Inicio con ese hilo.
//
// El componente y la barra se leen del fuente: no hay un renderizador de React en las pruebas. Que cada
// ruta de `lib/agentes/pantalla.ts` exista y sea de su sección se mira contra los archivos de ruta.
//
// Las mutaciones que la ponen en rojo: preguntar a otra ruta, o a una escrita a mano; un `pedir(` o un
// `fetch(` en la caja; quitarle el `disabled` al campo o al botón; no mandar el período; una pantalla
// que deja de anunciarlo; una ruta del mapa que no existe o es de otra sección; el nombre de una entrada
// escrito a mano; dibujarla sin entrada abierta; montarla dentro de `.main` o antes; sin su área; visible
// en el teléfono; y CONVERSACIONES con un `pedir(`, fuera de `{inicio ? `, o que abra el hilo sin pedírselo
// al Inicio.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';
import { DEPARTAMENTOS, ENTRADAS } from '../../lib/autorizacion/departamentos.ts';
import { SECCIONES } from '../../lib/autorizacion/secciones.ts';
import { RUTA_DE_LA_CAJA, rutaDeLaCaja } from '../../lib/agentes/pantalla.ts';

const fuente = (r: string): string => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (t: string): string =>
  t.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const sinComentariosCss = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, ' ');
const CAJA = () => sinComentarios(fuente('components/ConsultaAlCerebro.jsx'));

/** Las etiquetas de apertura de un elemento: recorre las llaves, así el `>` de un `=>` no la cierra. */
function etiquetas(codigo: string, nombre: string): string[] {
  const salida: string[] = [];
  for (const m of codigo.matchAll(new RegExp(`<${nombre}\\b`, 'g'))) {
    let nivel = 0;
    for (let i = m.index!; i < codigo.length; i += 1) {
      if (codigo[i] === '{') nivel += 1;
      else if (codigo[i] === '}') nivel -= 1;
      else if (codigo[i] === '>' && nivel === 0) {
        salida.push(codigo.slice(m.index!, i + 1));
        break;
      }
    }
  }
  return salida;
}

test('cada ruta del mapa de la pantalla existe y es de su sección', () => {
  /* El navegador no le pregunta al servidor a dónde preguntar: lo dice `RUTA_DE_LA_CAJA`. Una ruta mal
     escrita sería un 404 en cada pregunta de esa sección; una de otra sección, una pregunta que se guarda
     en la caja equivocada, con las herramientas de la otra pantalla primero. */
  assert.ok(Object.keys(RUTA_DE_LA_CAJA).length >= 11, 'el mapa perdió secciones');
  for (const [seccion, ruta] of Object.entries(RUTA_DE_LA_CAJA)) {
    const archivo = `app${ruta}/route.ts`;
    assert.ok(existsSync(join(RAIZ, archivo)), `la caja de «${seccion}» pregunta a ${ruta}, que no existe`);
    assert.match(sinComentarios(fuente(archivo)), new RegExp(`export const PANTALLA = '${seccion}';`), `${ruta} no es de la sección «${seccion}»`);
    assert.ok(SECCIONES.some((s) => s.clave === seccion), `«${seccion}» no es una sección`);
  }
  assert.equal(rutaDeLaCaja('executive'), null, 'el Inicio no tiene caja al pie: tiene su chat');
  assert.equal(rutaDeLaCaja('constructor'), null);
});

test('la caja pregunta a la ruta de su sección, con el período de la pantalla, y sólo con el estado `listo`', () => {
  const c = CAJA();
  assert.doesNotMatch(c, /\bpedir\(|\bfetch\(/, 'la caja le pide algo al servidor por su cuenta: pregunta por `usarCerebro`');
  assert.match(c, /const cerebro = usarCerebro\(abierta \? rutaDeLaCaja\(vista\) : null, undefined, avisarQueCambiaronLosHilos\);/, 'la caja no pregunta a la ruta de su sección, o no avisa a CONVERSACIONES lo que cambió');
  assert.match(c, /const periodo = usarPeriodoAnunciado\(vista\);/, 'la caja no lee el período que mira la pantalla');
  assert.match(c, /const preguntar = \(t\) => cerebro\.preguntar\(t, periodo\);/, 'la caja pregunta sin el período');
  assert.match(c, /const listo = estado\?\.tipo === 'listo';/);
  // Un campo de un renglón: el texto de muestra de un `textarea` no se corta con puntos suspensivos.
  const campos = etiquetas(c, 'input');
  assert.equal(campos.length, 1, 'la caja perdió su campo, o tiene otro');
  assert.equal(etiquetas(c, 'textarea').length, 0, 'la caja volvió a un `textarea`: a 768 px parte el nombre de la entrada');
  assert.match(campos[0]!, /\sdisabled=\{!listo\}/, 'el campo se puede usar sin el estado `listo`');
  const enviar = etiquetas(c, 'button').find((t) => /className="cc-enviar"/.test(t));
  assert.ok(enviar, 'la caja perdió el botón de enviar');
  assert.match(enviar, /\sdisabled=\{!listo \|\| enCamino \|\| texto\.trim\(\) === ''\}/, 'el botón de enviar se puede usar sin el estado `listo` o con una pregunta en camino');
  // Si no llega una respuesta, la pregunta vuelve al campo, como en el Inicio.
  assert.match(c, /if \(!\(await preguntar\(limpio\)\)\) setTexto\(limpio\);/, 'la caja pierde la pregunta si falla');
  // Sin permiso para preguntar, no se dibuja (AG-52).
  assert.match(c, /if \(estado\?\.tipo === 'sin_permiso'\) return null;/);
});

test('las pantallas con períodos anuncian el que miran', () => {
  const PANELES: Record<string, string> = {
    'components/acquisition/PanelDeAcquisition.jsx': 'acquisition',
    'components/conversation/PanelDeConversation.jsx': 'conversation',
    'components/conversion/PanelDeConversion.jsx': 'conversion',
    'components/creative/PanelDeCreative.jsx': 'creative',
    'components/leads-portal/PanelDeLeadsPortal.jsx': 'contacts',
    'components/sales/PanelDeSales.jsx': 'sales',
  };
  for (const [archivo, seccion] of Object.entries(PANELES)) {
    assert.match(
      sinComentarios(fuente(archivo)),
      new RegExp(`useEffect\\(\\(\\) => anunciarPeriodo\\('${seccion}', periodo\\), \\[periodo\\]\\);`),
      `${archivo} no anuncia su período: su caja pregunta sin él`,
    );
  }
});

test('la caja nombra la entrada abierta con el dato, y sólo con un departamento abierto', () => {
  const c = CAJA();
  assert.match(c, /const navegacion = sesion\?\.navegacion \?\? SIN_NAVEGACION;/);
  const leidos = new Set([...c.matchAll(/\bsesion\??\.(\w+)/g)].map((m) => m[1]));
  assert.deepEqual([...leidos].sort(), ['arranque', 'navegacion', 'organizacion', 'secciones'], 'la caja lee otra cosa de la sesión');
  assert.match(c, /const vista = usarUbicacion\(\) \?\? sesion\?\.arranque\?\.seccion\.clave \?\? null;\s*const pestana = usarPestanaDibujada\(vista\);\s*const abierta = entradaAbierta\(navegacion, vista, pestana\);/, 'la caja no sale de la misma cuenta que la cabecera');
  // Sin entrada abierta —el Inicio, lo del engranaje— no hay caja, y nada se dibuja antes de saberlo.
  const desde = c.indexOf('export default function ConsultaAlCerebro');
  const guarda = c.indexOf('if (!abierta) return null;');
  assert.ok(desde > 0 && guarda > desde, 'la caja se dibuja sin un departamento abierto');
  assert.doesNotMatch(c.slice(desde, guarda), /\breturn\b/);
  assert.match(c, /const sobre = `Pregúntale al cerebro sobre \$\{abierta\.nombre\}`;/, 'la caja no pregunta sobre la entrada abierta');
  assert.match(c, /placeholder=\{`\$\{sobre\}…`\}/);
  // Ningún nombre de la navegación escrito a mano.
  const nombres = [
    ...DEPARTAMENTOS.flatMap((d) => [d.nombre, d.ceja]),
    ...ENTRADAS.flatMap((e) => [e.nombre, e.grupo].filter((n): n is string => Boolean(n))),
    ...SECCIONES.map((s) => s.nombre),
  ];
  for (const n of nombres) {
    for (const forma of [`>${n}<`, `'${n}'`, `"${n}"`, `\`${n}\``, `sobre ${n}`]) assert.ok(!c.includes(forma), `la caja escribe a mano «${n}»`);
  }
});

test('la caja va en su área, después de `<main>`, y no en el teléfono', () => {
  const centro = sinComentarios(fuente('components/CommandCenter.jsx'));
  assert.match(centro, /<\/main>\s*<ConsultaAlCerebro \/>\s*<\/div>/, 'la caja no va justo después de `<main>`, hija directa de `.app`: dentro les tapa el pie a las pantallas de operación, y antes se lee antes del contenido');
  assert.equal((centro.match(/<ConsultaAlCerebro \/>/g) ?? []).length, 1);
  const hoja = sinComentariosCss(fuente('app/departamentos.css'));
  const regla = (sel: string, css: string) => new RegExp(`(?:^|[{}])\\s*${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  assert.match(regla('.cc-consulta', hoja.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, ' ')), /grid-area:\s*consulta;/, 'la caja no ocupa su área');
  /* En el teléfono no se dibuja (AG-58), y con ella el panel que sube, que vive adentro: la rejilla del
     teléfono no tiene su área. */
  const telefono = /@media \(max-width: 760px\) \{([\s\S]*)\}\s*$/.exec(hoja)?.[1] ?? '';
  assert.match(regla('.cc-consulta', telefono), /display:\s*none;/, 'la caja se dibuja en el teléfono, donde la rejilla no tiene su área');
  assert.match(CAJA(), /<PanelDelCerebro[\s\S]*?\/>\s*\) : null\}\s*<\/section>/, 'el panel que sube no va dentro de la caja: en el teléfono quedaría a la vista');
  // El nombre de la entrada se corta con puntos suspensivos y no a la mitad de una palabra.
  assert.match(regla('.cc-campo', hoja), /text-overflow:\s*ellipsis;/, 'el nombre de la entrada se corta a la mitad de una palabra');
  // Y no se llama como la barra de la maqueta (`162` prohíbe `.ask`).
  assert.doesNotMatch(CAJA(), /className="[^"]*\bask\b/, 'la caja se llama como la barra de la maqueta');
});

test('CONVERSACIONES lista los hilos que publica el Inicio, sin pedirle nada al servidor, y los abre en el Inicio', () => {
  const nav = sinComentarios(fuente('components/Nav.jsx'));
  assert.match(nav, /\{inicio \? <ConversacionesDeLaBarra inicio=\{inicio\} \/> : null\}/, 'CONVERSACIONES se dibuja aunque la persona no vea el Inicio');
  const i = nav.indexOf('<ConversacionesDeLaBarra');
  // Debajo de los departamentos y antes del pie, como en el diseño.
  assert.ok(nav.indexOf('nb-departamentos') < i && i < nav.indexOf('className="nav-foot"'), 'CONVERSACIONES no va entre los departamentos y el pie');
  const lista = sinComentarios(fuente('components/cerebro/ConversacionesDeLaBarra.jsx'));
  assert.doesNotMatch(lista, /\bpedir\(|\bfetch\(|usarCerebro\(/, 'CONVERSACIONES le pide algo al servidor: la barra lee lo que publica el Inicio');
  assert.match(lista, /const hilos = usarHilosDeLaBarra\(\);/);
  assert.match(lista, /pedirHiloDelInicio\(h\.id\);\s*irALaVista\(inicio\.seccion\);/, 'tocar un hilo no lo abre en el Inicio');
  // Y el Inicio es quien publica, y toma el pedido aunque lo hayan hecho antes de montarse.
  const inicio = sinComentarios(fuente('components/views/ExecutiveView.jsx'));
  assert.match(inicio, /const publicar = usarPublicarHilos\(\);\s*const cerebro = usarCerebro\(RUTA_DEL_INICIO, publicar\);/);
  assert.match(inicio, /atender\(\);\s*return alPedirHiloDelInicio\(atender\);/, 'el Inicio no atiende el pedido hecho antes de montarse');
  // Y vuelve a leer los hilos cuando una caja del pie pregunta o borra: si no, la barra queda vieja.
  assert.match(inicio, /useEffect\(\(\) => alCambiarLosHilos\(\(\) => void recargar\(\)\), \[recargar\]\);/, 'lo que se pregunta al pie no llega a CONVERSACIONES');
  // «Nueva conversación» de la barra empieza una de verdad, aunque el Inicio tenga un hilo abierto.
  assert.match(nav, /pedirHiloDelInicio\(null\);\s*irALaVista\(inicio\.seccion\);/, '«Nueva conversación» vuelve al hilo que estaba abierto');
});
