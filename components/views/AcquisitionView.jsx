/* ═══════════════════════════════════════════════════════════════════════════════
 * ERA UNA MAQUETA CON 58 LITERALES INVENTADOS, Y AHORA MIDE
 *
 * Lo que había acá venía portado de `aios-command-center_1.html` (líneas 2680-2744): el encabezado,
 * un segmentado de período, un selector de rango, cuatro contenedores vacíos que llenaba
 * `lib/aios/acquisition.js` desde el navegador, y **dos señales escritas a mano** —«Cae la afinidad
 * ICP en Prospecting B», «Fuga entre formulario y landing VSL»— con sus cifras inventadas dentro
 * del texto.
 *
 * Se van las cuatro cosas. El motivo no es de estilo: mientras existieran, alguien podía leer
 * «54 % de afinidad» como una medición, y la carpeta `docs/acquisition/` ya dejó escrito que ese
 * módulo era *«lo que tiene que haber en el futuro»*, no lo que hay.
 *
 * ── LO QUE SE CONSERVA DEL PROTOTIPO, Y POR QUÉ ────────────────────────────
 *
 * El encabezado invertido de la estética de operación —rótulo en versalitas arriba, titular
 * debajo—, que es el de las cinco pantallas de Inteligencia y no una decisión de esta.
 *
 * Lo que NO se conserva, y está anotado para que no vuelva por inercia:
 *
 *   · **El botón «Plan de acción».** El § 18.19 punto 9 deja los umbrales como pendiente explícito,
 *     y los del prototipo estaban elegidos a ojo. Un botón que abre recomendaciones con umbrales
 *     inventados es peor que no tenerlo.
 *   · **El selector de rango personalizado.** El período cerrado de `lib/negocio/periodo.ts` es el
 *     vocabulario de todo el sistema; un rango libre acá daría ventanas que ninguna otra pantalla
 *     puede reproducir.
 *   · **El segmentado «Paso a paso / Acumulada».** Es de los tres embudos, que no existen todavía.
 *   · **Las dos señales.** El § 18.13 pide una alerta de catorce campos, con `baseline`,
 *     `confidence` y `possible_causes` en plural. Dos párrafos escritos a mano no son eso.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import PanelDeAcquisition from '../acquisition/PanelDeAcquisition.jsx';

export default function AcquisitionView({ activa }) {
  return (
    <section className={activa ? 'view on estetica-op' : 'view estetica-op'} id="v-acquisition">
      <div className="view-scroll cre-scroll">
        {/* La estética de operación INVIERTE el encabezado: el `h2` pasa a rótulo de 9,5 px en
            mayúsculas y la bajada a titular de 24 px. `.stack` y `.ch-title` son las que lo apilan,
            y `.cl-page` da el `gap: 18px` del cuerpo — sin ella, el `gap: 24px` del scroller se
            aplica entre TODOS los bloques. */}
        <div className="cre-head">
          <div className="ch-l stack">
            <div className="ch-title">
              <h2>Acquisition</h2>
              {/* La bajada cambió con la pantalla. Decía «De dónde vienen los leads, y cuáles
                  sirven» — y «cuáles sirven» es exactamente la conclusión que el § 18.1 le prohíbe
                  a este departamento: requiere cruzar ICP, agendamientos, ventas y revenue. */}
              <span className="cre-desc">Qué costó cada anuncio, y cuánto vale esa cifra</span>
            </div>
          </div>
        </div>
        <div className="cl-page">
          <PanelDeAcquisition />
        </div>
      </div>
    </section>
  );
}
