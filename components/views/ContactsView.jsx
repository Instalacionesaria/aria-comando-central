/* ═══════════════════════════════════════════════════════════════════════════════
 * ERA UNA MAQUETA CON QUINCE PERSONAS INVENTADAS, Y UNA DE ELLAS VENDÍA CON UN CLOSER REAL
 *
 * Lo que había acá venía portado de `aios-command-center_1.html` (la vista, líneas 3024-3072) y lo
 * llenaba `lib/aios/leads-portal.js` (líneas 4584-4904 del original): quince personas con teléfono,
 * correo, puntaje, recorrido y ventas escritos a mano, dibujadas con `innerHTML`, sin un solo
 * `fetch`. Dos de sus ventas se las atribuía al nombre de un closer real, y la base no tiene
 * ninguna venta registrada (medido el 2026-09-27).
 *
 * ── LO QUE SE FUE, Y POR QUÉ CADA COSA ────────────────────────────────────
 *
 *   · **`lib/aios/leads-portal.js`, entero.** Calculaba los tramos, las tasas y el cierre en el
 *     navegador sobre datos inventados, y publicaba `window.AIOSLeadCard`, que abría la ficha por
 *     NOMBRE y, si no lo encontraba, copiaba la del primer contacto con otro nombre. La ficha nueva
 *     se abre por id y un id que no existe da 404.
 *   · **El botón «Plan de acción» (`lpPlanBtn`).** Cuatro frases escritas a mano —«el ICP alto es
 *     el 22 % del volumen pero produce el 61 % de las ventas»— y ninguna sostenible: con cero
 *     ventas, la segunda mitad no se puede calcular, y la primera, medida, da 18 %.
 *   · **La píldora «Personalizado» (`data-datepick`).** Abría el calendario para no filtrar nada.
 *     Un rango libre daría ventanas que ninguna otra pantalla puede reproducir.
 *   · **El segmentado de tres botones.** El tercero mandaba `data-p="mes"`, que no es ninguna de las
 *     cuatro claves de `lib/negocio/periodo.ts`, y se abría en «7 días», que hoy son tres personas.
 *   · **`data-leads` en las tarjetas.** Abría el cajón «Grupo de contactos» con otra lista inventada.
 *     La lista de cada cifra ya está en esta misma pantalla: tocar la tarjeta la filtra.
 *
 * ── LO QUE SE CONSERVA ────────────────────────────────────────────────────
 *
 * La forma: el encabezado, las cinco tarjetas, la barra con el buscador y los dos segmentados, la
 * rejilla y la ficha en un cajón. Las clases son las de la maqueta. Lo que la pantalla no puede
 * medir se dibuja en la pantalla, con su fecha: ver `components/leads-portal/`.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import PanelDeLeadsPortal from '../leads-portal/PanelDeLeadsPortal.jsx';

export default function ContactsView({ activa }) {
  return (
    <section className={activa ? 'view on' : 'view'} id="v-contacts">
      <div className="view-scroll cre-scroll">
        <div className="lp-wrap">
          <PanelDeLeadsPortal />
        </div>
      </div>
    </section>
  );
}
