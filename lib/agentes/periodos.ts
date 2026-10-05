'use client';

// El período que está mirando cada pantalla, para la caja del cerebro de su pie
// (`docs/OTROS/agentes/03-EL-CEREBRO.md`, AG-44): «¿cómo va esto?» desde una pantalla en «7 días» se contesta
// con siete días si la pregunta no dice otra cosa.
//
// El período vive en el estado de cada pantalla (`useState(PERIODO_POR_OMISION)` en cada panel) y la caja
// está afuera, en su área de la rejilla, así que cada pantalla lo ANUNCIA y la caja lo lee. Es el molde de
// `anunciarPestana` (`lib/aios/shell.js`): un almacén aparte, que anunciar lo mismo dos veces no avisa. Una
// pantalla sin períodos no anuncia nada, y la caja pregunta sin período.
//
// No es una caché de datos: guarda una clave de período por pantalla, de UNA pestaña de UNA persona.

import { useSyncExternalStore } from 'react';

const anunciados = new Map<string, string>();
const oyentes = new Set<() => void>();

/** La pantalla `seccion` dice qué período está mirando. */
export function anunciarPeriodo(seccion: string, periodo: string): void {
  if (anunciados.get(seccion) === periodo) return;
  anunciados.set(seccion, periodo);
  for (const fn of oyentes) fn();
}

/** El período que anunció esa pantalla, o `null`. Fuera de React, para las pruebas. */
export function periodoAnunciado(seccion: string | null): string | null {
  return seccion === null ? null : (anunciados.get(seccion) ?? null);
}

function suscribir(fn: () => void): () => void {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
}

/** El período que está mirando esa pantalla, y vuelve a dibujar cuando cambia. */
export function usarPeriodoAnunciado(seccion: string | null): string | null {
  return useSyncExternalStore(
    suscribir,
    () => periodoAnunciado(seccion),
    () => null,
  );
}
