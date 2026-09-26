/* Aplicar el tema, y evitar el destello.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * EL PROBLEMA QUE ESTE ARCHIVO RESUELVE, Y NO ES «GUARDAR UNA PREFERENCIA»
 *
 * La preferencia vive en la base (`identidad.usuarios.tema`, migración 019) porque tiene que
 * sobrevivir a cerrar sesión y a cambiar de máquina. Pero la base está a una petición de distancia,
 * y `app/guardia.tsx` recién la pregunta cuando el navegador ya pintó algo.
 *
 * O sea: quien elige tema claro vería, en CADA carga, un cuadro oscuro durante unas décimas y
 * después el claro. Y quien elige oscuro lo vería al revés si el valor por omisión fuera claro. Ese
 * parpadeo es el defecto clásico de los temas y no se arregla del lado del servidor mientras la
 * sesión se resuelva con un `fetch`.
 *
 * ── LA CACHÉ NO ES LA VERDAD, Y ESA DISTINCIÓN ES TODO ─────────────────────
 *
 * `localStorage` guarda una COPIA de lo último que se supo, y sirve para una sola cosa: pintar el
 * primer cuadro. En cuanto llega la respuesta de la sesión, manda la base — aunque contradiga a la
 * copia. Es lo que hace que cambiar el tema en otra máquina se vea acá al entrar, en vez de quedar
 * pegado a lo que este navegador recuerda.
 *
 * Y por eso `aplicar` es idempotente y se puede llamar dos veces sin que se note: la primera desde
 * el script de arranque con la copia, la segunda desde la guarda con la verdad.
 *
 * ── TODO ACCESO A `localStorage` VA EN `try` ────────────────────────────────
 *
 * No es prolijidad defensiva: en una ventana privada de Safari, y en cualquier navegador con los
 * datos de sitio bloqueados, **leer lanza**. Sin el `try`, ese lanzamiento ocurre en el script de
 * arranque —antes de React— y la aplicación no se dibuja. Cambiar un tema no puede ser capaz de
 * dejar a alguien afuera.
 */

export type Tema = 'oscuro' | 'claro';

/** La clave de la copia local. Lleva prefijo para no chocar con nada más del origen. */
export const CLAVE_TEMA = 'aios:tema';

/** El que la aplicación tuvo siempre. Ver el comentario del `default` en la migración 019. */
export const TEMA_POR_OMISION: Tema = 'oscuro';

/**
 * El mismo tema, con los nombres que usa el brandbook.
 *
 * El sistema de marca v2 (`brand/BRAND.md`) declara sus tokens bajo `[data-theme="dark"|"light"]`,
 * que son los nombres del brandbook y no los de esta aplicación. En vez de clavar `data-theme="dark"`
 * en el `<html>` —que agregaría un SEGUNDO sistema de temas que el primero desconoce, y le rompería
 * el tema claro a quien lo eligió— se escriben los dos atributos en sincronía desde acá, que sigue
 * siendo el único lugar que los toca.
 */
export function temaCss(tema: Tema): 'dark' | 'light' {
  return tema === 'claro' ? 'light' : 'dark';
}

/** Un valor cualquiera reducido a uno de los dos. Nunca devuelve otra cosa. */
export function temaValido(valor: unknown): Tema {
  return valor === 'claro' ? 'claro' : TEMA_POR_OMISION;
}

/**
 * Pone el tema en el `<html>`.
 *
 * Es el ÚNICO lugar que toca el atributo. Con dos —el script de arranque y el botón, por ejemplo—
 * habría dos formas de escribir el mismo nombre y una podría quedar vieja.
 */
export function aplicar(tema: Tema): void {
  document.documentElement.dataset.tema = tema;
  /* El nombre del brandbook, en sincronía. Ver `temaCss`. */
  document.documentElement.dataset.theme = temaCss(tema);
  /* Y se le dice al navegador de qué color es el lienzo, para que los controles nativos —barras de
     desplazamiento, campos, el fondo del sobredesplazamiento— acompañen. Sin esto, en tema claro la
     barra de desplazamiento sigue siendo oscura y se ve como un resto del tema anterior. */
  document.documentElement.style.colorScheme = tema === 'claro' ? 'light' : 'dark';
}

/** Guarda la copia local. Silencioso si el navegador no deja escribir. */
export function recordar(tema: Tema): void {
  try {
    window.localStorage.setItem(CLAVE_TEMA, tema);
  } catch {
    /* Sin copia local el tema sigue funcionando: sólo vuelve el destello del primer cuadro. */
  }
}

/**
 * El script que corre ANTES de que React pinte nada.
 *
 * Va como cadena y se inyecta con `dangerouslySetInnerHTML` en el `<head>` porque ése es el único
 * momento en el que se puede ganar el primer cuadro: cualquier código de React ya llega tarde.
 *
 * Se escribe con `var` y sin funciones flecha a propósito — es un script suelto, sin transpilar, y
 * tiene que correr en cuanto el analizador lo encuentre.
 */
export const GUION_DE_ARRANQUE = `(function(){try{
var t=window.localStorage.getItem('${CLAVE_TEMA}')==='claro'?'claro':'${TEMA_POR_OMISION}';
document.documentElement.dataset.tema=t;
document.documentElement.dataset.theme=t==='claro'?'light':'dark';
document.documentElement.style.colorScheme=t==='claro'?'light':'dark';
}catch(e){document.documentElement.dataset.tema='${TEMA_POR_OMISION}';document.documentElement.dataset.theme='dark';}})()`;
