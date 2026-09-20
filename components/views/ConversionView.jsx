/* ═══════════════════════════════════════════════════════════════════════════════
 * ERA UNA MAQUETA CON 530 LITERALES INVENTADOS, Y AHORA MIDE
 *
 * Lo que había acá venía portado de `aios-command-center_1.html` (líneas 2807-2862): el encabezado
 * con dos chips de «fuente conectada», un botón «Plan de acción», un segmentado de período, un
 * selector de rango, un filtro por dispositivo y **cinco contenedores vacíos** que llenaba
 * `lib/aios/conversion.js` desde el navegador — cinco pasos de embudo con su banda de «lo esperado»,
 * once fricciones con su pérdida en personas y un plan de tres acciones con su porcentaje de
 * recuperación.
 *
 * Se van todos. El motivo no es de estilo: mientras existieran, alguien podía leer «el 34 % abandona
 * el VSL en el segundo 47» como una medición.
 *
 * ── LO QUE SE CONSERVA DEL PROTOTIPO ──────────────────────────────────────
 *
 * El encabezado invertido de la estética de operación —rótulo en versalitas arriba, titular debajo—,
 * que es el de las cinco pantallas de Inteligencia y no una decisión de ésta.
 *
 * Lo que NO se conserva, anotado para que no vuelva por inercia:
 *
 *   · **Los chips «Clarity» y «VTurb».** Se dibujaban con el punto de «fuente conectada» al lado del
 *     título, y **las dos son cadenas de texto en este archivo y nada más**: no hay integración, ni
 *     credencial, ni variable de entorno, ni tabla. Medido el 2026-09-20. De las dos, la de vTurb es
 *     la peor: su campo del CRM se escribió 79 veces y **las 79 dicen `0`**, así que el punto verde
 *     afirmaba que había una fuente conectada justo sobre el instrumento que está roto.
 *   · **El filtro por dispositivo (Todos / Móvil / Escritorio).** No existe ninguna tabla de
 *     sesiones ni de eventos de página, y `visitor_id` y `session_id` no aparecen en una sola línea
 *     del repositorio. El dispositivo del prototipo salía de dieciocho literales multiplicados por
 *     un factor de período. El requisito no se borra: vuelve el día que haya sesiones.
 *   · **El recorrido dibujado como CADENA.** Es lo único de esta pantalla que se borra en vez de
 *     postergarse, y el motivo está medido: `Landing → VSL → Formulario → Agenda` no es por donde
 *     pasa la gente desde el 2026-08-31 —la landing cayó del 58 % al 13 % y el widget de reserva
 *     directo subió del 24 % al 44 %—. Landing y widget no son dos pasos: son dos caminos. Lo que
 *     entra en su lugar es un REPARTO, que es la misma pregunta contestada sin afirmar un orden que
 *     no existe.
 *   · **El selector de rango personalizado.** El período cerrado de `lib/negocio/periodo.ts` es el
 *     vocabulario de todo el sistema; un rango libre daría ventanas que ninguna otra pantalla puede
 *     reproducir, y cada piso y cada aviso habría que volver a razonarlos.
 *   · **El botón «Plan de acción» y las once fricciones.** Las 47 frases que abría no tienen fuente:
 *     dependen de la retención del VSL, del abandono campo por campo y del mapa de calor, y los tres
 *     están medidos como inexistentes. El requisito no se borra; hoy no tiene de dónde salir.
 *   · **Las siete puertas al panel de catorce personas inventadas** de `lib/aios/leads-group.js`. La
 *     forma es un requisito real —el § 2.6 pide que cada cifra se pueda abrir en su población— pero
 *     los nombres no: son María López, Pablo Herrera y doce más, con montos de venta.
 *
 * Lo que la pantalla nueva NO puede medir se dibuja **en la pantalla**, con su motivo y su fecha:
 * ver `Huecos` en `components/conversion/PanelDeConversion.jsx`. La diferencia entre un hueco
 * declarado y una regresión es ese bloque.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import PanelDeConversion from '../conversion/PanelDeConversion.jsx';

export default function ConversionView({ activa }) {
  return (
    <section className={activa ? 'view on estetica-op' : 'view estetica-op'} id="v-conversion">
      <div className="view-scroll cre-scroll">
        {/* La estética de operación INVIERTE el encabezado: el `h2` pasa a rótulo de 9,5 px en
            mayúsculas y la bajada a titular de 24 px. `.stack` y `.ch-title` lo apilan, y
            `.cl-page` da el `gap: 18px` del cuerpo. Sin `.cv-wrap`, que era un flex de más entre
            los dos y sólo lo emitía este archivo. */}
        <div className="cre-head">
          <div className="ch-l stack">
            <div className="ch-title">
              <h2>Conversion</h2>
              {/* La bajada cambió con la pantalla. Decía «Dónde se pierde la gente entre el click y
                  la cita» — y eso es un embudo, que es justo lo que la medición dice que ya no
                  existe como camino único. Lo que la pantalla puede decir hoy es por dónde entra la
                  gente y cuántos abandonan el formulario de los que llegan a verlo. */}
              <span className="cre-desc">Por dónde entra la gente, y quién abandona el formulario</span>
            </div>
          </div>
        </div>
        <div className="cl-page">
          <PanelDeConversion />
        </div>
      </div>
    </section>
  );
}
