'use client';

/* La cabecera de un departamento (`docs/OTROS/nueva-estructura/01-LA-ESTRUCTURA.md`, `NE-17`), del
 * lienzo «Departamentos por dentro»: la ceja, el nombre de la entrada abierta y la fila de pestañas con
 * las entradas del departamento. Si la entrada abierta es un grupo —Radar, Funnel, Leads—, debajo de la
 * línea va una segunda fila con sus sub-pestañas, como las píldoras del diseño de la segunda edición
 * (`docs/OTROS/nueva-estructura/09-LA-SEGUNDA-EDICION.md`, `NE-45`). Debajo va la pantalla de siempre.
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
 * servidor. En el Inicio no dibuja nada, y su título propio vuelve solo: la regla que oculta los títulos
 * pregunta si hay cabecera (`app/departamentos.css`).
 *
 * ── LO DEL ENGRANAJE (`NE-49`, segunda edición) ─────────────────────────────
 *
 * Ajustes, el Panel de Monitoreo e Incidentes no son de ningún departamento —`entradaAbierta` da
 * `null`—, pero llevan la misma cabecera: la ceja de la cuenta y el nombre del destino, que viajan en
 * `navegacion.engranaje`, y ninguna fila. De esas pantallas se oculta sólo el `h2`: la bajada de Ajustes
 * dice de qué empresa es la configuración, y quien administra puede estar mirando otra.
 *
 * ── LO QUE NO SE DIBUJA, Y POR QUÉ ──────────────────────────────────────────
 *
 *   · el comentario del cerebro de la derecha, con la mascota (`NE-17`.3): el cerebro no existe, y un
 *     comentario escrito a mano sería una cifra inventada con otra forma;
 *   · la fila de pestañas de un departamento con UNA sola entrada —un closer que sólo ve Sales ›
 *     Closer—: una sola pestaña no es una pestaña, como en Ajustes;
 *   · la segunda fila de una entrada que no es un grupo.
 *
 * Las dos filas navegan con la misma función, `abrir`: una sub-pestaña de Leads puede estar en otra
 * pantalla que la abierta —«De GHL» es el Leads Portal, «De Radar» una pestaña de Tools (`NE-46`)—, y
 * se abre igual que una entrada de la barra.
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
  const delEngranaje = abierta ? null : (navegacion.engranaje.find((e) => e.seccion === vista) ?? null);

  // Cada vez que cambia la entrada abierta, su pestaña a la vista, y su sub-pestaña en la suya.
  const fila = useRef(null);
  const filaDelGrupo = useRef(null);
  const nombreAbierto = abierta?.nombre ?? null;
  const subAbierta = abierta?.sub ?? null;
  useLayoutEffect(() => {
    traerALaVista(fila.current, fila.current?.querySelector('.cd-pestana.on'));
    traerALaVista(filaDelGrupo.current, filaDelGrupo.current?.querySelector('.cd-sub.on'));
  }, [nombreAbierto, subAbierta]);

  if (!(abierta && departamento) && !delEngranaje) return null;

  const abrir = (e) => irALaVista(e.seccion, { pestana: e.pestana });
  const ceja = departamento?.ceja ?? delEngranaje.ceja;
  const nombre = departamento ? abierta.nombre : delEngranaje.nombre;
  const conPestanas = departamento ? departamento.entradas.length > 1 : false;
  // Las sub-pestañas del grupo abierto, o `null` si la entrada abierta no es un grupo.
  const subs = !departamento || abierta.sub === null ? null : (departamento.entradas.find((e) => e.nombre === abierta.nombre)?.subs ?? null);
  return (
    <section className={`cd${conPestanas ? '' : ' sin-pestanas'}${delEngranaje ? ' cd-engranaje' : ''}`} aria-labelledby="cdNombre">
      <div className="cd-arriba">
        <div className="cd-titulo">
          <span className="cd-ceja">{ceja}</span>
          <h1 className="cd-nombre" id="cdNombre">
            {nombre}
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
                  onClick={() => abrir(e)}
                  onFocus={(ev) => traerALaVista(fila.current, ev.currentTarget)}
                >
                  {e.nombre}
                </button>
              );
            })}
          </nav>
        ) : null}
      </div>
      {subs ? (
        <nav className="cd-subs" ref={filaDelGrupo} aria-label={`Pestañas de ${abierta.nombre}`}>
          {subs.map((s) => {
            if (s.proximamente) {
              // Como la de la fila: sin botón, y con la palabra («Todos», `NE-38`).
              return (
                <span className="cd-sub cd-sub-proxima" key={s.nombre}>
                  {s.nombre}
                  <span className="nb-proximamente">Próximamente</span>
                </span>
              );
            }
            const marcada = abierta.sub === s.nombre;
            return (
              <button
                type="button"
                className={marcada ? 'cd-sub on' : 'cd-sub'}
                key={s.nombre}
                aria-current={marcada ? 'page' : undefined}
                onClick={() => abrir(s)}
                onFocus={(ev) => traerALaVista(filaDelGrupo.current, ev.currentTarget)}
              >
                {s.nombre}
              </button>
            );
          })}
        </nav>
      ) : null}
    </section>
  );
}
