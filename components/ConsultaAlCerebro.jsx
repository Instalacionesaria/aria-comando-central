'use client';

/* La caja «Pregúntale al cerebro sobre …» al pie de cada pantalla de un departamento
 * (`docs/OTROS/nueva-estructura/09-LA-SEGUNDA-EDICION.md`, `NE-50`; `docs/OTROS/agentes/03-EL-CEREBRO.md`,
 * AG-40, AG-44 y AG-57).
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * QUÉ HACE
 *
 * Pregunta a la ruta de la caja de la sección abierta (`app/api/<carpeta>/cerebro/route.ts`, que sale de
 * `lib/agentes/pantalla.ts`) con el período que está mirando la pantalla —lo anuncia cada panel con
 * `lib/agentes/periodos.ts`—, y la respuesta se lee en el panel que sube (`components/cerebro/PanelDelCerebro.jsx`),
 * donde sigue la conversación y están los hilos propios de esta sección. Hasta AG7 estuvo deshabilitada,
 * diciendo que el cerebro llegaba en una próxima etapa.
 *
 * La caja se habilita sólo con el estado `listo` de esa ruta; con otro, dice por qué, con el mismo texto
 * que el Inicio (AG-52). Sin permiso para preguntar, no se dibuja.
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
 * que preguntar. En el teléfono no se dibuja (`NE-18`, AG-58): la rejilla del teléfono no tiene su área.
 *
 * ── LEE DE LA SESIÓN `navegacion`, `arranque` Y `secciones` ──────────────────
 *
 * Las dos primeras, la misma cuenta que la cabecera y la barra: la pantalla a la vista, la pestaña que
 * dibuja y `entradaAbierta`. El nombre sobre el que se pregunta es el de la entrada que nombra la cabecera;
 * no se escribe. `secciones`, para nombrar los pasos que propone una respuesta.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSesion } from '../app/sesion-contexto.tsx';
import { usarPestanaDibujada, usarUbicacion } from '../lib/vista.ts';
import { entradaAbierta } from '../lib/autorizacion/departamentos.ts';
import { irALaVista } from '../lib/aios/shell.js';
import { puedeIrAAjustes, rutaDeLaCaja, textoDelEstado } from '../lib/agentes/pantalla.ts';
import { avisarQueCambiaronLosHilos } from '../lib/agentes/hilos-de-la-barra.ts';
import { usarPeriodoAnunciado } from '../lib/agentes/periodos.ts';
import { usarCerebro } from '../lib/agentes/usarCerebro.ts';
import PanelDelCerebro from './cerebro/PanelDelCerebro.jsx';

const SIN_NAVEGACION = { inicio: null, departamentos: [], engranaje: [] };

export default function ConsultaAlCerebro() {
  const sesion = useSesion();
  const navegacion = sesion?.navegacion ?? SIN_NAVEGACION;
  const vista = usarUbicacion() ?? sesion?.arranque?.seccion.clave ?? null;
  const pestana = usarPestanaDibujada(vista);
  const abierta = entradaAbierta(navegacion, vista, pestana);
  const periodo = usarPeriodoAnunciado(vista);
  const secciones = sesion?.secciones;
  const nombres = useCallback((clave) => secciones?.find((s) => s.clave === clave)?.nombre ?? clave, [secciones]);

  // Lo que se pregunta o se borra acá también tiene que aparecer en CONVERSACIONES, que lee lo del Inicio.
  const cerebro = usarCerebro(abierta ? rutaDeLaCaja(vista) : null, undefined, avisarQueCambiaronLosHilos);
  const [texto, setTexto] = useState('');
  const [abiertoElPanel, setAbiertoElPanel] = useState(false);
  const campo = useRef(null);
  /* Otra pantalla, otro panel: el de la anterior no queda abierto encima —con el fondo sin desplazamiento—
     ni se vuelve a abrir solo en el próximo departamento. */
  useEffect(() => {
    setAbiertoElPanel(false);
  }, [vista]);

  /* Sin ruta, no hay caja (`RUTA_DE_LA_CAJA`): Client OS es una herramienta ajena en un `iframe`, y el cerebro
     no tiene nada que leer de ella. Dibujar la caja igual era ofrecer una pregunta que nadie contesta. */
  if (!abierta || rutaDeLaCaja(vista) === null) return null;
  const estado = cerebro.panel?.estado ?? null;
  if (estado?.tipo === 'sin_permiso') return null;

  const sobre = `Pregúntale al cerebro sobre ${abierta.nombre}`;
  const listo = estado?.tipo === 'listo';
  const motivo = estado ? textoDelEstado(estado, sesion?.organizacion.zonaHoraria ?? 'UTC', nombres('credenciales')) : cerebro.causa;
  const hilos = cerebro.panel?.hilos ?? [];
  const preguntar = (t) => cerebro.preguntar(t, periodo);
  const enCamino = cerebro.pendiente !== null;
  const aviso = cerebro.error ?? motivo;

  const enviar = async () => {
    const limpio = texto.trim();
    if (limpio === '' || !listo || enCamino) return;
    setTexto('');
    /* El foco, en el campo antes de abrir: si se envió con el ratón, el botón queda deshabilitado y el foco
       caería al `body`, que es a donde la ventana lo devolvería al cerrarse. */
    campo.current?.focus();
    setAbiertoElPanel(true);
    // Si no llegó una respuesta, la pregunta vuelve al campo, como en el Inicio.
    if (!(await preguntar(limpio))) setTexto(limpio);
  };

  return (
    <section className="cc-consulta" aria-label="Pregúntale al cerebro">
      <form
        className="cc-caja"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
      >
        {/* Un campo de un renglón y no un `textarea`: el texto de muestra de un campo se corta con puntos
            suspensivos, y a 768 px el de un `textarea` partía el nombre de la entrada a la mitad. */}
        <input
          ref={campo}
          type="text"
          className="cc-campo"
          value={texto}
          disabled={!listo}
          placeholder={`${sobre}…`}
          aria-label={sobre}
          aria-describedby={aviso ? 'consultaEstado' : undefined}
          onChange={(e) => setTexto(e.target.value)}
        />
        {aviso ? (
          <span className={cerebro.error ? 'cc-motivo mal' : 'cc-motivo'} id="consultaEstado" title={aviso}>
            {aviso}
          </span>
        ) : null}
        {estado && puedeIrAAjustes(estado) ? (
          <button type="button" className="cc-hilos" onClick={() => irALaVista('credenciales', { pestana: 'credenciales' })}>
            Ir a {nombres('credenciales')}
          </button>
        ) : null}
        {hilos.length > 0 || cerebro.turnos.length > 0 ? (
          <button type="button" className="cc-hilos" onClick={() => setAbiertoElPanel(true)}>
            Conversaciones
          </button>
        ) : null}
        <button type="submit" className="cc-enviar" disabled={!listo || enCamino || texto.trim() === ''} aria-label="Enviar">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </form>
      {abiertoElPanel ? (
        <PanelDelCerebro
          sobre={abierta.nombre}
          cerebro={cerebro}
          listo={listo}
          motivo={motivo}
          nombres={nombres}
          alPreguntar={preguntar}
          alIrAAjustes={estado && puedeIrAAjustes(estado) ? () => irALaVista('credenciales', { pestana: 'credenciales' }) : null}
          alCerrar={() => setAbiertoElPanel(false)}
        />
      ) : null}
    </section>
  );
}
