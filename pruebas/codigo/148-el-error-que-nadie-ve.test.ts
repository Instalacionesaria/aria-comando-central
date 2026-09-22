// Un paso que falla tiene que MOSTRAR por qué. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE ESTE ARCHIVO EXISTE PARA IMPEDIR, Y QUE YA OCURRIÓ
//
// `PanelResearch` guarda el fallo de cada paso en `error[paso]` y lo dibuja **dentro del acordeón
// de ese paso**. El acordeón nace cerrado cuando todavía no salió ninguno:
//
//     const [abierto, setAbierto] = useState(() => {
//       const hechos = estado.researchSalidas.filter((s) => !!s).length;
//       return hechos > 0 ? hechos - 1 : null;   // ← null en la primera corrida
//     });
//
// El camino del ÉXITO llamaba a `setAbierto(paso)`. El del FALLO no. Así que en la primera corrida
// —la única que importa, porque es cuando alguien estrena la herramienta— el error se escribía en el
// estado y no se dibujaba en ninguna parte.
//
// Lo que la persona veía: el botón gira, vuelve a su texto, el paso sigue diciendo «pendiente», y no
// hay ningún error. **Indistinguible de «no pasó nada».**
//
// ── Y ASÍ SE PERDIÓ UN DIAGNÓSTICO, MEDIDO ──────────────────────────────────
//
// El 2026-09-22, una organización real: criterios guardados, cinco herramientas generadas bien los
// días anteriores, `market_research.outputs` vacío, y el chat del agente repitiendo *«sí, ya arrancó
// el research»* tres veces seguidas mientras no había arrancado nada.
//
// Desde la base **no se puede saber** si el paso 1 falló o si nunca se llamó. Y no se puede
// justamente por esto: el fallo no dejaba rastro ni en la pantalla ni en el almacén, así que las dos
// hipótesis producen exactamente el mismo estado observable.
//
// ── LO QUE SE AFIRMA ────────────────────────────────────────────────────────
//
// Que el manejador que escribe un error también lo haga VISIBLE. No se comprueba el texto ni el
// estilo —eso no lo puede ver una prueba de código— sino que el error no quede detrás de un panel
// que nadie abrió.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../apoyo/fuente.ts';

const PANEL = 'components/fundaciones/PanelResearch.jsx';

const fuente = (): string => readFileSync(join(RAIZ, PANEL), 'utf8');

/** El cuerpo de `correrPaso`, sin comentarios: es donde vive la decisión. */
function correrPaso(): string {
  const t = fuente().replace(/\/\*[\s\S]*?\*\//g, ' ');
  const i = t.indexOf('const correrPaso');
  assert.ok(i > 0, 'cambió el nombre de `correrPaso`: actualizá esta prueba');
  const j = t.indexOf('const correrTodo', i);
  assert.ok(j > i, 'cambió la forma del panel: no se pudo acotar `correrPaso`');
  return t.slice(i, j);
}

test('el acordeón arranca CERRADO sin ningún paso hecho: es lo que hace posible el defecto', () => {
  /* La mitad que explica por qué la de abajo hace falta. Si algún día el acordeón abriera el paso 0
     por omisión, el error se vería igual y esta prueba quedaría protegiendo algo que ya no puede
     pasar — y habría que decirlo, no borrarla en silencio. */
  const t = fuente();
  assert.match(
    t,
    /const \[abierto, setAbierto\] = useState\(\(\) => \{[\s\S]*?hechos > 0 \? hechos - 1 : null/,
    'cambió cómo arranca el acordeón: revisá si el error de un paso fallado sigue necesitando abrirlo',
  );
});

test('el paso que FALLA se abre, para que su error se vea', () => {
  /* El error se dibuja dentro de `{abiertoEste ? …}`. Escribirlo en el estado sin abrir el paso es
     escribirlo en un cajón cerrado: la persona ve el botón girar y volver, y nada más. */
  const cuerpo = correrPaso();
  const i = cuerpo.indexOf("if (r.tipo !== 'datos')");
  assert.ok(i > 0, 'cambió la forma del fallo en `correrPaso`');
  const rama = cuerpo.slice(i, cuerpo.indexOf('return false', i));

  assert.match(rama, /setError\(/, 'el fallo dejó de registrar el error');
  assert.match(
    rama,
    /setAbierto\(paso\)/,
    'el fallo escribe `error[paso]` y NO abre el paso: el aviso queda detrás de un acordeón ' +
      'cerrado y la pantalla se ve igual que si no hubiera pasado nada',
  );
});

test('el ÉXITO sigue abriendo su paso: la simetría es lo que hace legible la regla', () => {
  const cuerpo = correrPaso();
  const desde = cuerpo.indexOf('setSalidas(');
  assert.ok(desde > 0, 'cambió la rama del éxito en `correrPaso`');
  assert.match(cuerpo.slice(desde), /setAbierto\(paso\)/, 'el éxito dejó de abrir su paso');
});
