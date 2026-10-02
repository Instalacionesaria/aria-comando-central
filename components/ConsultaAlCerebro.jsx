'use client';

/* La caja «Pregúntale al cerebro sobre …» al pie de cada pantalla de un departamento, como
 * «Próximamente» (`docs/OTROS/nueva-estructura/09-LA-SEGUNDA-EDICION.md`, `NE-50`).
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * POR QUÉ ESTÁ, SI NO RESPONDE
 *
 * El diseño de la segunda edición la pone al pie de cada pantalla, y el usuario decidió dibujarla como lo
 * que es hoy: una caja que todavía no tiene a quién preguntarle. Está deshabilitada, no manda nada y dice
 * por qué, igual que la del Inicio (`components/views/ExecutiveView.jsx`). El día que llegue el cerebro
 * (`docs/OTROS/futuro/el-cerebro.md`), es la puerta.
 *
 * ── DÓNDE VA ────────────────────────────────────────────────────────────────
 *
 * En su propia área de la rejilla, `consulta`, debajo del cuerpo (`app/armazon.css`): dentro de `.main`
 * les taparía el pie a las pantallas de operación, por lo mismo que la cabecera va en la suya. Y DESPUÉS
 * de `<main>` en el árbol, por el orden de lectura: se pregunta sobre lo que se acaba de ver. No se llama
 * como la barra «Pregúntale a Executive» que se fue con la maqueta (`NE-09`), para que la prueba que
 * impide que ésa vuelva (`pruebas/codigo/162-el-armazon-en-un-telefono.test.ts`) siga valiendo.
 *
 * Sólo con un departamento abierto: el Inicio tiene la suya, y lo del engranaje no es un lugar sobre el
 * que preguntar. En el teléfono no se dibuja (`NE-18`: no se diseña nada más para el teléfono).
 *
 * ── LEE DE LA SESIÓN `navegacion` Y `arranque`, Y NADA MÁS ──────────────────
 *
 * La misma cuenta que la cabecera y la barra: la pantalla a la vista, la pestaña que dibuja y
 * `entradaAbierta`. El nombre sobre el que se pregunta es el de la entrada que nombra la cabecera; no
 * se escribe.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useSesion } from '../app/sesion-contexto.tsx';
import { usarPestanaDibujada, usarUbicacion } from '../lib/vista.ts';
import { entradaAbierta } from '../lib/autorizacion/departamentos.ts';

const SIN_NAVEGACION = { inicio: null, departamentos: [], engranaje: [] };

export default function ConsultaAlCerebro() {
  const sesion = useSesion();
  const navegacion = sesion?.navegacion ?? SIN_NAVEGACION;
  const vista = usarUbicacion() ?? sesion?.arranque?.seccion.clave ?? null;
  const pestana = usarPestanaDibujada(vista);
  const abierta = entradaAbierta(navegacion, vista, pestana);

  if (!abierta) return null;

  const sobre = `Pregúntale al cerebro sobre ${abierta.nombre}`;
  return (
    <section className="cc-consulta" aria-label="Pregúntale al cerebro">
      <div className="cc-caja">
        {/* Un campo de un renglón y no un `textarea`: el texto de muestra de un campo se corta con puntos
            suspensivos, y a 768 px el de un `textarea` partía el nombre de la entrada a la mitad. */}
        <input
          type="text"
          className="cc-campo"
          disabled
          placeholder={`${sobre}…`}
          aria-label={sobre}
          aria-describedby="consultaEnCamino"
        />
        {/* La palabra a la vista; el porqué entero, al lector, en la descripción de los dos controles. */}
        <span className="nb-proximamente" aria-hidden="true">
          Próximamente
        </span>
        <button type="button" className="cc-enviar" disabled aria-label="Enviar" aria-describedby="consultaEnCamino">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
      <span className="para-lectores" id="consultaEnCamino">
        El cerebro llega en una próxima etapa: todavía no hay quien te responda acá.
      </span>
    </section>
  );
}
