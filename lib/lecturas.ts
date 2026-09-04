'use client';

// LA ÚNICA memorización del navegador: lo ya traído sobrevive al desmontaje.
//
// ── ESTE ARCHIVO NO IMPORTA REACT, Y ES A PROPÓSITO ───────────────────────────
//
// Acá vive solo la parte pura —el `Map`, la clave y la frescura— y los hooks viven en
// `lib/usarLectura.ts`. Se partió por una razón concreta y medida: la sesión llega por
// `app/sesion-contexto.tsx`, que es un `.tsx`, y Node no sabe importar JSX. Con todo en un archivo
// **la primitiva no se podía comprobar de verdad** — solo leyendo su código fuente.
//
// Partido, `pruebas/codigo/129-lecturas.test.ts` prueba el comportamiento: que la clave de dos
// empresas no se cruza se afirma GUARDANDO y LEYENDO, no mirando una expresión.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE ESTE ARCHIVO EXISTE PARA ARREGLAR, MEDIDO EN EL CÓDIGO
//
// Llegó como queja: *«todo el rato se queda cargando cuando entro a cada pestaña»*. Y no es lo
// que parece — las pestañas de arriba NO recargan: `components/CommandCenter.jsx` monta todas las
// vistas a la vez y cambiar de pantalla es puro CSS.
//
// Las que recargan son las SUB-pestañas. `CloserView` y `SetterView` dibujan
// `{sub === 'x' ? <C/> : null}`, así que ir al Pipeline y volver **desmonta** el componente; el
// que vuelve es otro, nace sin datos, y pide de nuevo. Seis pantallas hacían eso:
//
//   Pipeline (closer y setter) · Agenda · Contactos · Credenciales · Usuarios · Empresas
//
// Y la regla que lo arregla ya estaba escrita en `CloserView`: *«la pantalla solo se vacía cuando
// no hay nada que mostrar»*. No las alcanzaba porque al remontar no tenían nada. Lo que faltaba
// no era la regla: era que el dato sobreviviera.
//
// ═══════════════════════════════════════════════════════════════════════════════
// `ADR-0703` — TODA MEMORIZACIÓN INCLUYE LA ORGANIZACIÓN EFECTIVA. INNEGOCIABLE.
//
// Este archivo es **la primera memorización del proyecto**, así que la fila deja de cumplirse por
// ausencia y pasa a cumplirse por construcción. Dos cosas la sostienen:
//
//   1 · **La clave lleva el id de la empresa.** Siempre, y no como cinturón de seguridad: es la
//       fila entera.
//   2 · **El módulo lleva `'use client'`.** `pruebas/codigo/70-publicacion.test.ts` prohíbe una
//       estructura mutable arriba de un módulo del SERVIDOR —*«las instancias se reutilizan entre
//       peticiones de organizaciones distintas»*— y exime por directiva a los del navegador:
//       *«su estado es de UNA pestaña de UNA persona»*. `lib/reloj.ts` ya vive de esa exención.
//
// ── Y NO ALCANZA CON QUE HOY SE RECARGUE LA PÁGINA ─────────────────────────
//
// Cambiar de empresa hace `window.location.reload()` (`components/SelectorDeEmpresa.jsx`), así que
// esta caché muere con el cambio y la fila se cumpliría igual sin la clave. Se pone de todos modos,
// porque así se cumpliría **por un efecto secundario de otro componente**: el día que alguien haga
// que el selector no recargue —una optimización obvia— un superadmin empezaría a ver los datos de
// la empresa anterior y **no fallaría nada en ninguna parte**.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE NO ES: UNA CACHÉ DE PROTOCOLO
//
// `pedir()` sigue mandando `cache: 'no-store'` y las respuestas siguen saliendo con `no-store`.
// `EJECUCION` § 2 prohíbe las primitivas de caché del framework y del HTTP, y eso no se toca: nada
// de acá viaja a un caché intermedio ni sobrevive a recargar la página.
// ═══════════════════════════════════════════════════════════════════════════════

import { CADENCIA } from './cadencia.ts';

/** Lo guardado, con CUÁNDO se guardó: sin eso no se puede decidir si sigue sirviendo. */
interface Guardado {
  valor: unknown;
  cuando: number;
}

/**
 * La caché. Un `Map` en el nivel superior de un módulo del navegador — la misma forma que
 * `lib/reloj.ts`, y por el mismo motivo escrito en su exención.
 */
const guardadas = new Map<string, Guardado>();

/**
 * La clave. **La empresa va primero y nunca es opcional** — ver `ADR-0703` en el encabezado.
 *
 * El separador es un salto de línea porque no puede aparecer ni en un uuid ni en un camino, así
 * que `(a, 'b/c')` y `(a + '\nb', 'c')` no pueden colisionar. Con `:` o `/` sí podrían.
 */
export function claveDeLectura(empresaId: string, camino: string): string {
  return `${empresaId}\n${camino}`;
}

/** Lo guardado bajo esa clave, o `null` si no hay. */
export function leerGuardado<T>(clave: string): { valor: T; cuando: number } | null {
  const g = guardadas.get(clave);
  return g ? { valor: g.valor as T, cuando: g.cuando } : null;
}

/** Guarda, con la hora de ahora. */
export function guardar(clave: string, valor: unknown): void {
  guardadas.set(clave, { valor, cuando: Date.now() });
}

/** Lo tira. Para después de escribir algo que cambia lo que otra pantalla muestra. */
export function olvidar(clave: string): void {
  guardadas.delete(clave);
}

/** ¿Sigue sirviendo sin volver a preguntar? */
export function estaFresco(cuando: number, frescura: number = CADENCIA.lecturas): boolean {
  return Date.now() - cuando < frescura;
}
