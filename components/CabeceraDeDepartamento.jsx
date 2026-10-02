'use client';

/* La cabecera de un departamento (`docs/OTROS/nueva-estructura/01-LA-ESTRUCTURA.md`, `NE-17`), del
 * lienzo «Departamentos por dentro»: la ceja, el nombre de la entrada abierta y la fila de pestañas con
 * las entradas del departamento. Debajo va la pantalla de siempre.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * DÓNDE VIVE, Y POR QUÉ AHÍ
 *
 * En su propia área de la rejilla del armazón (`app/armazon.css`), fuera de `.main`: las pantallas de
 * operación se estiran sobre el relleno de `.main` con márgenes negativos, y una cabecera adentro les
 * cortaría el pie (`docs/OTROS/nueva-estructura/07-LO-QUE-SE-ROMPE-EN-SILENCIO.md`).
 *
 * Y ANTES de `<main>` en el árbol (`components/CommandCenter.jsx`), por el orden de lectura y del
 * tabulador: el nombre de la pantalla y sus pestañas se leen antes que el contenido, como se ven. El
 * aviso de la pestaña dibujada no depende de ese orden: `usarPestanaDibujada` vuelve a leer al
 * suscribirse, así que lo recibe también quien escucha después de que la pantalla anunció.
 *
 * Es una región con nombre —el de la entrada abierta—, porque el `h1` quedó fuera de `<main>`: sin eso,
 * quien salta por regiones se saltea el nombre de la pantalla.
 *
 * ── LEE DE LA SESIÓN `navegacion` Y `arranque`, Y NADA MÁS ──────────────────
 *
 * La misma cuenta que la barra lateral (`components/Nav.jsx`): la pantalla a la vista —la de arranque en
 * el primer dibujo—, la pestaña que dibuja y `entradaAbierta`. La ceja viaja en la navegación
 * (`DEPARTAMENTOS`), las pestañas son las entradas que la persona ve, y quién ve qué ya lo decidió el
 * servidor. Sin entrada abierta —el Inicio, lo del engranaje— no dibuja nada, y los títulos propios de
 * las pantallas vuelven solos: la regla que los oculta pregunta si hay cabecera (`app/departamentos.css`).
 *
 * ── LO QUE NO SE DIBUJA, Y POR QUÉ ──────────────────────────────────────────
 *
 *   · el comentario del cerebro de la derecha, con la mascota (`NE-17`.3): el cerebro no existe, y un
 *     comentario escrito a mano sería una cifra inventada con otra forma;
 *   · la fila de pestañas de un departamento con UNA sola entrada —un closer que sólo ve Sales ›
 *     Closer—: una sola pestaña no es una pestaña, como en Ajustes.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useLayoutEffect, useRef } from 'react';
import { useSesion } from '../app/sesion-contexto.tsx';
import { irALaVista } from '../lib/aios/shell.js';
import { usarPestanaDibujada, usarUbicacion } from '../lib/vista.ts';
import { entradaAbierta } from '../lib/autorizacion/departamentos.ts';

const SIN_NAVEGACION = { inicio: null, departamentos: [], engranaje: [] };

/** Trae una pestaña a la vista DENTRO de la fila, sin mover la página. En el teléfono la fila se
 * desliza, y ni la abierta llega sola a la vista ni el navegador trae una con el foco que se ve a medias. */
function traerALaVista(fila, pestana) {
  if (!fila || !pestana) return;
  const f = fila.getBoundingClientRect();
  const p = pestana.getBoundingClientRect();
  if (p.left < f.left) fila.scrollLeft -= f.left - p.left + 16;
  else if (p.right > f.right) fila.scrollLeft += p.right - f.right + 16;
}

export default function CabeceraDeDepartamento() {
  const sesion = useSesion();
  const navegacion = sesion?.navegacion ?? SIN_NAVEGACION;
  const vista = usarUbicacion() ?? sesion?.arranque?.seccion.clave ?? null;
  const pestana = usarPestanaDibujada(vista);
  const abierta = entradaAbierta(navegacion, vista, pestana);
  const departamento = abierta ? navegacion.departamentos.find((d) => d.clave === abierta.departamento) : null;

  // Cada vez que cambia la entrada abierta, su pestaña a la vista.
  const fila = useRef(null);
  const nombreAbierto = abierta?.nombre ?? null;
  useLayoutEffect(() => {
    traerALaVista(fila.current, fila.current?.querySelector('.cd-pestana.on'));
  }, [nombreAbierto]);

  if (!abierta || !departamento) return null;

  const conPestanas = departamento.entradas.length > 1;
  return (
    <section className={conPestanas ? 'cd' : 'cd sin-pestanas'} aria-labelledby="cdNombre">
      <div className="cd-titulo">
        <span className="cd-ceja">{departamento.ceja}</span>
        <h1 className="cd-nombre" id="cdNombre">
          {abierta.nombre}
        </h1>
      </div>
      {conPestanas ? (
        <nav className="cd-pestanas" ref={fila} aria-label={`Pestañas de ${departamento.nombre}`}>
          {departamento.entradas.map((e) => {
            if (e.proximamente) {
              /* «Próximamente» (`NE-13`): no es un botón, no navega y lleva la palabra, como en la
                 barra lateral: el tono no alcanza, porque una pestaña en reposo ya es el piso del texto. */
              return (
                <span className="cd-pestana cd-proxima" key={e.nombre}>
                  <span className="cd-n">{e.nombre}</span>
                  <span className="nb-proximamente">Próximamente</span>
                </span>
              );
            }
            const marcada = abierta.nombre === e.nombre;
            return (
              <button
                type="button"
                className={marcada ? 'cd-pestana on' : 'cd-pestana'}
                key={e.nombre}
                aria-current={marcada ? 'page' : undefined}
                onClick={() => irALaVista(e.seccion, { pestana: e.pestana })}
                onFocus={(ev) => traerALaVista(fila.current, ev.currentTarget)}
              >
                {e.nombre}
              </button>
            );
          })}
        </nav>
      ) : null}
    </section>
  );
}
