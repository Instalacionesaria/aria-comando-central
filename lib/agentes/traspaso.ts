'use client';

// Los traspasos del cerebro en el navegador (`docs/OTROS/agentes/03-EL-CEREBRO.md`, AG-49 y AG-51): qué hilo
// tiene que abrir el chat del Inicio cuando se lo pide otra parte de la pantalla —una fila de
// CONVERSACIONES en la barra, «Nueva conversación»—.
//
// Con el molde de `lib/tools/del-espia-al-scraper.ts`: el pedido va por `sessionStorage` y por un evento,
// porque quien lo atiende puede estar montado o montarse después de navegar; se lee una sola vez, y quien
// lo toma lo borra.

const CLAVE = 'aria:hilo-para-el-inicio';
const EVENTO = 'aria:abrir-hilo-en-el-inicio';

/** El pedido: un hilo propio, o `null` para empezar una conversación nueva. */
export interface PedidoDeHilo {
  hilo: string | null;
}

const EVENTO_DE_BORRAR = 'aria:borrar-hilo-en-el-inicio';

/** Pide al chat del Inicio que abra ese hilo (o uno nuevo, con `null`). No navega: eso lo hace quien llama. */
export function pedirHiloDelInicio(hilo: string | null): void {
  const pedido: PedidoDeHilo = { hilo };
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(pedido));
  } catch {
    /* Sin almacenamiento (ventana privada estricta): el evento alcanza, porque el Inicio está montado. */
  }
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: pedido }));
}

/** Toma el pedido pendiente, si hay, y lo borra. */
export function tomarHiloDelInicio(): PedidoDeHilo | null {
  try {
    const v = sessionStorage.getItem(CLAVE);
    if (v === null) return null;
    sessionStorage.removeItem(CLAVE);
    const p = JSON.parse(v) as Partial<PedidoDeHilo>;
    return { hilo: typeof p.hilo === 'string' ? p.hilo : null };
  } catch {
    return null;
  }
}

/**
 * Escucha pedidos mientras el Inicio está montado. Devuelve la baja. El oyente recibe el pedido del evento,
 * y quien escucha igual toma el de `sessionStorage` para borrarlo: sin almacenamiento, el del evento es el
 * único que hay (la primera versión lo ignoraba, y sin almacenamiento no se abría nada).
 */
export function alPedirHiloDelInicio(oyente: (pedido: PedidoDeHilo) => void): () => void {
  const manejar = (e: Event) => oyente((e as CustomEvent<PedidoDeHilo>).detail);
  window.addEventListener(EVENTO, manejar);
  return () => window.removeEventListener(EVENTO, manejar);
}

/**
 * Pide al chat del Inicio que borre ese hilo: la barra no le pide nada al servidor (`pruebas/codigo/193-*`), y
 * el Inicio es quien borra —con su `borrar`, que avisa a las cajas y vuelve a publicar la lista—. Sólo por el
 * evento, sin `sessionStorage`: la barra lista hilos únicamente después de que el Inicio los publicó, o sea con el
 * Inicio montado (`NE-35`), y un borrado guardado para después podría ejecutarse sin que nadie lo vea.
 */
export function pedirBorrarHiloDelInicio(hilo: string): void {
  window.dispatchEvent(new CustomEvent(EVENTO_DE_BORRAR, { detail: { hilo } }));
}

/** Escucha pedidos de borrar mientras el Inicio está montado. Devuelve la baja. */
export function alPedirBorrarHiloDelInicio(oyente: (hilo: string) => void): () => void {
  const manejar = (e: Event) => {
    const hilo = (e as CustomEvent<{ hilo?: unknown }>).detail?.hilo;
    if (typeof hilo === 'string') oyente(hilo);
  };
  window.addEventListener(EVENTO_DE_BORRAR, manejar);
  return () => window.removeEventListener(EVENTO_DE_BORRAR, manejar);
}
