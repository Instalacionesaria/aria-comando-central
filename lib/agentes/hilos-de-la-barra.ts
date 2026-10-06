'use client';

// Los hilos del cerebro que lista CONVERSACIONES en la barra (`docs/OTROS/agentes/03-EL-CEREBRO.md`, AG-51;
// `fichas/F19-CONVERSACIONES.md`).
//
// La barra no le pide nada al servidor (`pruebas/codigo/193-*`): los hilos los trae el chat del Inicio, que
// está montado aunque no esté a la vista (`NE-35`), y los PUBLICA acá cada vez que los vuelve a leer —al
// cargar, después de preguntar o borrar en el Inicio, y cuando la caja del pie de una sección avisa que
// preguntó o borró (`avisarQueCambiaronLosHilos`)—. La barra los lee y vuelve a dibujarse con cada
// publicación. Sin el aviso, lo que se pregunta al pie no aparecía en la barra en toda la sesión, y lo que
// se borra ahí seguía listado (lo encontró la revisión de AG7).
//
// Se guardan en la memoria de lecturas con la clave de `usarClaveDeLectura`, que lleva la empresa
// (ADR-0703): un superadministrador que pasa de una empresa a otra no ve los hilos de la anterior.
//
// Por el mismo camino viaja el contador de la Reunión de hoy (AG15, `04`, AG-75): cuántos temas de hoy ve la
// persona, que el Inicio publica cada vez que lee su panel.

import { useCallback, useSyncExternalStore } from 'react';
import { guardar, leerGuardado } from '../lecturas.ts';
import { usarClaveDeLectura } from '../usarLectura.ts';

/** Lo que la barra muestra de un hilo. La forma de `HiloListado` (`lib/agentes/executive/conversaciones.ts`). */
export interface HiloDeLaBarra {
  id: string;
  titulo: string;
  origen: string;
  seccion: string | null;
  actualizadaEl: string;
}

/** El camino con que se arma la clave: no es una ruta del API, es el nombre de esta entrada en la memoria. */
const CAMINO = 'cerebro/hilos-de-la-barra';

const oyentes = new Set<() => void>();

function suscribir(fn: () => void): () => void {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
}

/** El contador de la Reunión: otra entrada de la memoria, con el mismo aviso. */
const CAMINO_DE_LA_REUNION = 'cerebro/reunion-de-la-barra';

function usarPublicar<T>(camino: string): (valor: T) => void {
  const clave = usarClaveDeLectura(camino);
  return useCallback(
    (valor: T) => {
      if (clave === null) return;
      guardar(clave, valor);
      for (const fn of oyentes) fn();
    },
    [clave],
  );
}

function usarPublicado<T>(camino: string): T | null {
  const clave = usarClaveDeLectura(camino);
  return useSyncExternalStore(
    suscribir,
    () => (clave === null ? null : (leerGuardado<T>(clave)?.valor ?? null)),
    () => null,
  );
}

/** Publicar los hilos: el chat del Inicio, cada vez que los vuelve a leer. */
export function usarPublicarHilos(): (hilos: readonly HiloDeLaBarra[]) => void {
  return usarPublicar<readonly HiloDeLaBarra[]>(CAMINO);
}

/** Los hilos publicados para la empresa de la sesión, o `null` si todavía no se leyeron. */
export function usarHilosDeLaBarra(): readonly HiloDeLaBarra[] | null {
  return usarPublicado<readonly HiloDeLaBarra[]>(CAMINO);
}

/** Publicar cuántos temas de HOY ve la persona: el Inicio, cada vez que lee su panel. Cero si no hay de hoy. */
export function usarPublicarTemasDeHoy(): (temas: number) => void {
  return usarPublicar<number>(CAMINO_DE_LA_REUNION);
}

/** Cuántos temas de hoy ve la persona, o `null` si el Inicio todavía no los leyó. */
export function usarTemasDeHoy(): number | null {
  return usarPublicado<number>(CAMINO_DE_LA_REUNION);
}

const EVENTO = 'aria:cambiaron-los-hilos-del-cerebro';

/** Una caja del cerebro preguntó o borró: el Inicio vuelve a leer los hilos, y la barra con él. */
export function avisarQueCambiaronLosHilos(): void {
  window.dispatchEvent(new Event(EVENTO));
}

/** Escucha ese aviso. Devuelve la baja. */
export function alCambiarLosHilos(oyente: () => void): () => void {
  window.addEventListener(EVENTO, oyente);
  return () => window.removeEventListener(EVENTO, oyente);
}
