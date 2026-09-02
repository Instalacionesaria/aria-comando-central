// Cómo se llaman los links de cada zona, en la pantalla.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EN UN ARCHIVO Y NO EN CADA COMPONENTE
//
// Los mismos dos rótulos los dibujan tres pantallas: el menú del botón `+` de la ficha, la tabla de
// Closer → Inicio y la de Setter → Inicio. Escritos tres veces, el día que uno cambie las otras dos
// se quedan con el viejo y nadie lo nota — es la misma pantalla llamando a la misma cosa de dos
// formas.
//
// ── NO SE IMPORTA `enlacesRapidos.ts`, Y ESO ES A PROPÓSITO ────────────────
//
// Ese módulo trae `datos()`, o sea la capa de base. Un componente del navegador que lo importara
// para leer dos cadenas se llevaría el cliente de PostgreSQL al paquete. Acá solo entra un `import
// type`, que TypeScript borra al compilar.
//
// ── POR QUÉ EL CLOSER NO DICE «LINKS RÁPIDOS» ──────────────────────────────
//
// Los suyos son de cobro: Stripe y WHOP, con un monto cada uno. «Links de pago» es lo que son y lo
// que ya dice su pantalla. El setter agenda, así que los suyos son el calendario, un video, una
// página de casos — ahí «de pago» sería falso.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Territorio } from './datos/esquema.ts';

/** El título del menú y del panel, por zona. */
export const TITULO_DE_LOS_ENLACES: Readonly<Record<Territorio, string>> = {
  closer: 'Links de pago',
  setter: 'Links rápidos',
};

/**
 * El nombre de la zona, para cuando el menú muestra las DOS juntas.
 *
 * Pasa con un contacto que perdió su territorio en el CRM: no se sabe cuál de los dos menús le
 * corresponde, así que se muestran los dos y hace falta decir cuál es cuál. Sin este rótulo se
 * verían catorce links seguidos y el de Stripe al lado del calendario.
 */
export const NOMBRE_DE_LA_ZONA: Readonly<Record<Territorio, string>> = {
  closer: 'Zona del closer',
  setter: 'Zona del setter',
};
