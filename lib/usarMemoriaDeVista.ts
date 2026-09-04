'use client';

// Los hooks de la memoria de vista. La parte pura —y el motivo de que estén separados— vive en
// `lib/memoriaDeVista.ts`.
//
// ══════════════════════════════════════════════════════════════════════════════
// POR QUÉ HACE FALTA, DESPUÉS DE LA MEMORIA DE LECTURAS
//
// `lib/lecturas.ts` hizo que volver a una sub-pestaña ya no cueste un «Cargando»: el DATO
// sobrevive al desmontaje. Lo que no sobrevivía es lo que uno HIZO con la pantalla — se repliegan
// cuatro etapas del Pipeline para ver las dos que importan, se va a Mi Día, se vuelve, y las siete
// están abiertas otra vez.
//
// Y llega en el mismo paso a propósito: con el «Cargando» de antes, el pliegue era el menor de los
// problemas. Con el dato ya instantáneo, la lista aparece completa y **desarma sola** lo que uno
// había dejado armado, que se nota más que antes.
//
// ══════════════════════════════════════════════════════════════════════════════
// NO TIENE `Map` PROPIO, Y ESO NO ES UN DETALLE DE IMPLEMENTACIÓN
//
// Guarda con la primitiva de `lib/lecturas.ts`. Podría tener su propio `Map` —es otro tipo de
// dato— y sería peor por una razón concreta: **`ADR-0703` es una fila INNEGOCIABLE** y su guardia
// en `pruebas/codigo/70-publicacion.test.ts` audita las memorizaciones del navegador una por una.
// Una segunda estructura con su propia clave es una segunda cosa que auditar, y la primera vez que
// alguien se olvide de ponerle la empresa no va a fallar nada.
//
// Con la clave saliendo de `usarClaveDeLectura`, la empresa entra sola. Y hace falta que entre: el
// nombre de una etapa es el mismo en dos empresas, así que sin ella un superadmin que visita una
// cuenta vería los pliegues que hizo en la otra. No es grave —es un pliegue— pero es la misma
// clase de cruce, y la regla no distingue por gravedad.
//
// ────────────────────────── LOS NOMBRES SON, LITERALMENTE, EL PATH QUE VIENE ──────────────────────────
//
// `closer/pipeline`, `setter/dia`. Se eligió esa forma a propósito: el día que cada pestaña sea
// una ruta de verdad, ese nombre sale de `usePathname()` y no cambia nada más.
//
// Y hace falta un nombre porque **los títulos se repiten entre tableros**: «Seguimientos de hoy»
// está en el Mi Día del closer y en el del setter, así que sin el tablero adelante replegar uno
// replegaría el otro.
// ══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { guardar, leerGuardado } from './lecturas.ts';
import { usarClaveDeLectura } from './usarLectura.ts';
import {
  conPliegue,
  conScroll,
  estaPlegada,
  scrollDe,
  type Pliegues,
  type Scrolls,
} from './memoriaDeVista.ts';

/**
 * El pliegue de UNA sección, recordado por tablero.
 *
 * @param tablero `closer/pipeline` y compañía. Sin él no se recuerda nada, y eso es deliberado:
 *                dos tableros con títulos iguales se pisarían, así que es mejor no recordar que
 *                recordar cruzado.
 * @param titulo  el nombre de la sección. Es la clave dentro del tablero.
 */
export function usarPliegue(tablero: string | null, titulo: string): readonly [boolean, () => void] {
  /* ────────────────────────── EL HOOK SE LLAMA SIEMPRE, Y EL TERNARIO VIENE DESPUÉS ──────────────────────────

     Parece trabajo al vacío cuando no hay tablero, y no lo es: `usarClaveDeLectura` lee el
     contexto de sesión, o sea que es un hook. Llamarlo dentro de un ternario —que es como estaba
     escrito primero— cambia la CANTIDAD de hooks entre dos renders del mismo componente, y React
     tira «rendered fewer hooks than expected» el día que alguien pase un tablero condicional. No
     hoy: hoy los cuatro son constantes, y por eso no fallaría acá.

     `pliegues/` adelante para que no pueda chocar con la lectura de un camino del API: ninguno
     empieza así. */
  const claveDelTablero = usarClaveDeLectura(`pliegues/${tablero ?? 'sin-tablero'}`);
  const clave = tablero === null ? null : claveDelTablero;

  const leer = (): Pliegues | null =>
    clave === null ? null : (leerGuardado<Pliegues>(clave)?.valor ?? null);

  /* El estado inicial sale de lo guardado en el PRIMER render. En un efecto, la sección se
     dibujaría abierta y se cerraría sola un instante después — un salto que se ve peor que no
     recordar nada. */
  const [plegada, setPlegada] = useState<boolean>(() => estaPlegada(leer(), titulo));

  const alternar = useCallback(() => {
    const ahora = !plegada;
    setPlegada(ahora);
    /* Se escribe ACÁ y no dentro del actualizador de estado: React puede llamar un actualizador
       más de una vez, y guardar es un efecto — hacerlo ahí adentro es pedir que se ejecute dos
       veces por un clic. */
    if (clave !== null) guardar(clave, conPliegue(leer(), titulo, ahora));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `leer` se recrea en cada render a
    // propósito: lee el `Map` en el momento de escribir, no una copia del render anterior.
  }, [plegada, clave, titulo]);

  return [plegada, alternar];
}

/**
 * El scroll de cada sub-pestaña de una vista.
 *
 * Devuelve la `caja` —que va en el `ref` del `.view-scroll`— y `anotarScroll`, que hay que llamar
 * ANTES de cambiar de sub-pestaña.
 *
 * ────────────────────────── QUÉ SE PIERDE HOY, Y POR QUÉ NO ES UN DESMONTAJE ──────────────────────────
 *
 * Acá no se desmonta nada: `.view-scroll` es de la VISTA y vive mientras la aplicación viva. Lo
 * que pasa es que la sub-pestaña nueva mete contenido más corto, el navegador **recorta** el
 * `scrollTop` a la altura que queda, y al volver el número ya no está. O sea que el valor hay que
 * anotarlo mientras el contenido viejo TODAVÍA está en el DOM.
 *
 * Por eso no hay un `onScroll`, que era el camino obvio: el recorte del navegador **también**
 * dispara un evento de scroll, así que un `onScroll` que anota pisaría el 800 del usuario con el 0
 * del recorte, y encima en un momento que no se puede distinguir del scroll de una persona.
 * Anotando en el gesto que cambia de sub-pestaña, el número que se guarda es siempre el real.
 *
 * ────────────────────────── ESTA MITAD FUNCIONA PORQUE EXISTE LA OTRA ──────────────────────────
 *
 * Restaurar el scroll exige que el contenido ya tenga su ALTURA: puesto sobre un «Cargando…», el
 * navegador recorta el 800 a 0 y la restauración no hace nada. Funciona porque `lib/lecturas.ts`
 * hace que volver pinte la lista completa en el primer render. Y donde no hay dato guardado
 * tampoco hay scroll guardado — una recarga de página vacía las dos memorias a la vez.
 *
 * @param pestana `closer` o `setter`. Con la empresa la pone `usarClaveDeLectura`.
 * @param sub     la sub-pestaña activa. Es la clave dentro de la vista.
 */
export function usarScrollDeSubPestana(
  pestana: string,
  sub: string,
): { caja: RefObject<HTMLDivElement | null>; anotarScroll: () => void } {
  const caja = useRef<HTMLDivElement | null>(null);
  const clave = usarClaveDeLectura(`scroll/${pestana}`);

  const leer = (): Scrolls | null =>
    clave === null ? null : (leerGuardado<Scrolls>(clave)?.valor ?? null);

  /* ────────────────────────── ES UN EFECTO DE DISEÑO, NO UN `useEffect` ──────────────────────────

     `useEffect` corre DESPUÉS de pintar: la lista aparecería arriba y saltaría a los 800 un cuadro
     después. Un salto visible es peor que no restaurar, porque se lee como que la página se movió
     sola. `useLayoutEffect` corre entre la mutación del DOM y el pintado, así que no hay cuadro
     intermedio que ver.

     Y el cambio según el entorno no es un hook condicional: `useLayoutEffect` en el servidor avisa
     «does nothing on the server» en cada render, y estas vistas SÍ se renderizan ahí
     —`lib/vista.ts` lo dice con todas las letras—. La identidad se resuelve una vez por entorno,
     nunca entre dos renders del mismo componente, que es lo que las reglas de los hooks prohíben. */
  const usarEfectoDeDiseno = typeof window === 'undefined' ? useEffect : useLayoutEffect;

  usarEfectoDeDiseno(() => {
    const el = caja.current;
    if (el === null) return;
    /* Sin nada guardado se pone en 0 A PROPÓSITO, en vez de dejar lo que haya. Lo que hay es el
       recorte del contenido anterior, o sea un número de otra lista: entrar por primera vez a una
       sub-pestaña empieza arriba. */
    el.scrollTop = scrollDe(leer(), sub);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `leer` se recrea en cada render a
    // propósito; lo que dispara esto es cambiar de sub-pestaña.
  }, [clave, sub]);

  const anotarScroll = useCallback(() => {
    const el = caja.current;
    if (el === null || clave === null) return;
    guardar(clave, conScroll(leer(), sub, el.scrollTop));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- igual que arriba.
  }, [clave, sub]);

  return { caja, anotarScroll };
}
