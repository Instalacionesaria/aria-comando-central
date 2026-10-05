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

/** Publicar los hilos: el chat del Inicio, cada vez que los vuelve a leer. */
export function usarPublicarHilos(): (hilos: readonly HiloDeLaBarra[]) => void {
  const clave = usarClaveDeLectura(CAMINO);
  return useCallback(
    (hilos: readonly HiloDeLaBarra[]) => {
      if (clave === null) return;
      guardar(clave, hilos);
      for (const fn of oyentes) fn();
    },
    [clave],
  );
}

/** Los hilos publicados para la empresa de la sesión, o `null` si todavía no se leyeron. */
export function usarHilosDeLaBarra(): readonly HiloDeLaBarra[] | null {
  const clave = usarClaveDeLectura(CAMINO);
  return useSyncExternalStore(
    suscribir,
    () => (clave === null ? null : (leerGuardado<readonly HiloDeLaBarra[]>(clave)?.valor ?? null)),
    () => null,
  );
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
