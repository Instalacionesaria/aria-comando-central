'use client';

// Del Espía al Scraper de Facebook: «Sacar contactos de estos anunciantes →».
//
// El Espía deja el identificador de la búsqueda y navega a Radar › Scraper; el Scraper lo toma, abre
// la pestaña Facebook y elige esa búsqueda. Va por `sessionStorage` y no por una variable del módulo
// porque el Scraper puede montarse DESPUÉS de navegar —las vistas se dibujan al abrirse—, y
// además se avisa con un evento por si ya estaba montado. Se lee una sola vez: quien lo toma lo borra.

const CLAVE = 'aria:busqueda-del-espia-para-el-scraper';
const EVENTO = 'aria:abrir-en-el-scraper';

export function mandarAlScraper(trabajo: string): void {
  try {
    sessionStorage.setItem(CLAVE, trabajo);
  } catch {
    /* Sin almacenamiento (ventana privada estricta): el evento de abajo alcanza si ya está montado. */
  }
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: trabajo }));
}

/** ¿Hay un pedido pendiente? Sin tomarlo: lo usa el Scraper para arrancar en la pestaña Facebook. */
export function hayPedido(): boolean {
  try {
    return sessionStorage.getItem(CLAVE) !== null;
  } catch {
    return false;
  }
}

/** Toma el pedido pendiente, si hay, y lo borra. */
export function tomarPedido(): string | null {
  try {
    const v = sessionStorage.getItem(CLAVE);
    if (v) sessionStorage.removeItem(CLAVE);
    return v;
  } catch {
    return null;
  }
}

/**
 * Escucha pedidos mientras el Scraper está montado. Devuelve la baja. NO toma el pedido: lo toma quien
 * lo atiende (el formulario de Facebook), que puede montarse recién después de este aviso.
 */
export function alPedirScraper(oyente: (trabajo: string) => void): () => void {
  const manejar = (e: Event) => oyente((e as CustomEvent<string>).detail);
  window.addEventListener(EVENTO, manejar);
  return () => window.removeEventListener(EVENTO, manejar);
}
