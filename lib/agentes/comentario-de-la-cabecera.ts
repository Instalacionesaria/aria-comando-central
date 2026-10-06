'use client';

// El comentario de la cabecera, del panel a la cabecera (AG15 de los agentes;
// `docs/OTROS/agentes/04-LA-REUNION-Y-LA-CABECERA.md`, AG-78).
//
// Lo sirve el GET de la pantalla abierta (`lib/agentes/cabecera.ts`), y lo recibe el panel de esa pantalla. La
// cabecera vive fuera de `<main>` y no le pide nada al servidor: el panel lo PUBLICA acá cada vez que lee su
// pantalla, por la sección, y la cabecera lee el de la sección a la vista. Es el mismo camino que los hilos de
// CONVERSACIONES (`./hilos-de-la-barra.ts`), con la clave de `usarClaveDeLectura`, que lleva la empresa
// (ADR-0703): pasar a otra empresa no deja el comentario de la anterior.

import { useEffect, useSyncExternalStore } from 'react';
import { guardar, leerGuardado } from '../lecturas.ts';
import { usarClaveDeLectura } from '../usarLectura.ts';

/** La forma de `ComentarioDeLaCabecera` (`./cabecera.ts`). */
export interface ComentarioEnPantalla {
  texto: string;
  fuente: 'configurar' | 'senal' | 'regla';
}

const camino = (seccion: string) => `cerebro/comentario/${seccion}`;

const oyentes = new Set<() => void>();
function suscribir(fn: () => void): () => void {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
}

/**
 * Publica el comentario de una sección: el panel, con lo que trajo su GET. `undefined` es «todavía no se leyó»
 * y no publica nada; `null` es la regla del silencio y sí se publica, para que se borre el anterior.
 */
export function usarPublicarComentario(seccion: string, comentario: ComentarioEnPantalla | null | undefined): void {
  const clave = usarClaveDeLectura(camino(seccion));
  const texto = comentario === undefined ? undefined : (comentario?.texto ?? null);
  const fuente = comentario?.fuente ?? null;
  useEffect(() => {
    if (clave === null || texto === undefined) return;
    guardar(clave, texto === null || fuente === null ? null : { texto, fuente });
    for (const fn of oyentes) fn();
  }, [clave, texto, fuente]);
}

/** El comentario publicado para la sección a la vista, o `null`. */
export function usarComentario(seccion: string | null): ComentarioEnPantalla | null {
  const clave = usarClaveDeLectura(camino(seccion ?? ''));
  return useSyncExternalStore(
    suscribir,
    () => (seccion === null || clave === null ? null : (leerGuardado<ComentarioEnPantalla | null>(clave)?.valor ?? null)),
    () => null,
  );
}
