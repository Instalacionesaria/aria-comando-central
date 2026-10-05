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
