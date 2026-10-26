'use client';

// Lo que pasó en el viaje a Meta, de la página de retorno a Ajustes (Meta directo, M2).
//
// Meta vuelve a `/meta/retorno`, que canjea el código y navega a la aplicación. La aplicación no tiene una URL por
// pantalla (la navegación vive en memoria, `lib/aios/shell.js`), así que el resultado viaja por `sessionStorage`, con
// el molde de `lib/agentes/traspaso.ts`: se escribe una vez, y quien lo toma (Ajustes) lo borra.

const CLAVE = 'aria:meta-al-volver';

/** El resultado que ve quien volvió de Meta. `pestana` es la de Ajustes desde la que se conectó. */
export interface ResultadoDeMeta {
  ok: boolean;
  texto: string;
  pestana: 'credenciales' | 'clientes';
}

export function dejarResultadoDeMeta(r: ResultadoDeMeta): void {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(r));
  } catch {
    /* Sin almacenamiento (ventana privada estricta): Ajustes igual muestra las conexiones al día. */
  }
}

/** Toma el resultado pendiente, si hay, y lo borra. */
export function tomarResultadoDeMeta(): ResultadoDeMeta | null {
  try {
    const v = sessionStorage.getItem(CLAVE);
    if (v === null) return null;
    sessionStorage.removeItem(CLAVE);
    const p = JSON.parse(v) as Partial<ResultadoDeMeta>;
    if (typeof p.ok !== 'boolean' || typeof p.texto !== 'string') return null;
    return { ok: p.ok, texto: p.texto.slice(0, 400), pestana: p.pestana === 'clientes' ? 'clientes' : 'credenciales' };
  } catch {
    return null;
  }
}

/** ¿Hay un resultado esperando? Sin borrarlo: lo usa la aplicación para abrir Ajustes al cargar. */
export function hayResultadoDeMeta(): ResultadoDeMeta['pestana'] | null {
  try {
    const v = sessionStorage.getItem(CLAVE);
    if (v === null) return null;
    return (JSON.parse(v) as Partial<ResultadoDeMeta>).pestana === 'clientes' ? 'clientes' : 'credenciales';
  } catch {
    return null;
  }
}

/** De qué pestaña salió el viaje: se anota al irse, porque Meta no la devuelve. */
const CLAVE_DE_LA_PESTANA = 'aria:meta-desde';

export function anotarDesdeDondeSeConecta(pestana: ResultadoDeMeta['pestana']): void {
  try {
    sessionStorage.setItem(CLAVE_DE_LA_PESTANA, pestana);
  } catch {
    /* Sin almacenamiento: se vuelve a Credenciales. */
  }
}

export function desdeDondeSeConecto(): ResultadoDeMeta['pestana'] {
  try {
    const v = sessionStorage.getItem(CLAVE_DE_LA_PESTANA);
    sessionStorage.removeItem(CLAVE_DE_LA_PESTANA);
    return v === 'clientes' ? 'clientes' : 'credenciales';
  } catch {
    return 'credenciales';
  }
}
