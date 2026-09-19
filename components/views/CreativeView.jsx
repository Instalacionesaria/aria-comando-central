/* ═══════════════════════════════════════════════════════════════════════════════
 * ERA UNA MAQUETA CON 201 LITERALES INVENTADOS, Y AHORA MIDE
 *
 * Lo que había acá venía portado de `aios-command-center_1.html` (líneas 2747-2804): el encabezado,
 * un botón «Plan de acción», un segmentado de período, un selector de rango, y **seis contenedores
 * vacíos** que llenaba `lib/aios/creative.js` desde el navegador — ocho piezas inventadas con su
 * formato, su ángulo, su dolor, su curva de retención y su guion.
 *
 * Se van todos. El motivo no es de estilo: mientras existieran, alguien podía leer «hook rate 64 %»
 * o una línea del guion marcada en rojo como una medición.
 *
 * ── LO QUE SE CONSERVA DEL PROTOTIPO ──────────────────────────────────────
 *
 * El encabezado invertido de la estética de operación —rótulo en versalitas arriba, titular
 * debajo—, que es el de las cinco pantallas de Inteligencia y no una decisión de ésta.
 *
 * Lo que NO se conserva, anotado para que no vuelva por inercia:
 *
 *   · **El botón «Plan de acción».** De las doce frases que abría, **diez no tienen fuente**: nueve
 *     dependen del formato, el ángulo, la duración o la retención, y esos cuatro campos están
 *     medidos como inexistentes en `docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md`. Un botón que
 *     promete un plan y abre un modal casi vacío es peor que no tenerlo. El requisito no se borra:
 *     el día que haya tres o cuatro frases medidas, el bloque vuelve con su criterio y su ventana.
 *   · **El selector de rango personalizado.** El período cerrado de `lib/negocio/periodo.ts` es el
 *     vocabulario de todo el sistema; un rango libre daría ventanas que ninguna otra pantalla puede
 *     reproducir, y cada piso y cada aviso habría que volver a razonarlos.
 *   · **La curva de retención y el guion marcado en rojo.** Es lo único de esta carpeta que se borra
 *     en vez de postergarse, y el motivo está en `docs/creative/00-MAPA.md`: la curva es andamiaje
 *     en sus valores **y en su forma**. Sus siete puntos se interpolan entre dos literales con los
 *     mismos coeficientes para las ocho piezas, así que las ocho tienen la misma curva. Y lo que
 *     Meta entrega el día que se conecte son **cuatro cuartiles, no una curva continua**: cuatro
 *     puntos no señalan un segundo del guion. Lo que sobrevive es el requisito —decir dónde se cae
 *     la atención— y hoy no tiene fuente por ninguna vía.
 *   · **La partición «Funciona / No funciona» por el promedio.** Medido: mezclando etapas, el 78 %
 *     de agenda de la pieza BOFU levanta el promedio y manda a «pausar o iterar» a las de TOFU que
 *     traen el 65 % del volumen. Lo que queda es el corte DENTRO de cada etapa, que es lo que la
 *     regla 3 obliga.
 *   · **Las 18 puertas al panel de catorce personas inventadas** de `lib/aios/leads-group.js`. La
 *     forma es un requisito real —el § 2.6 pide que cada cifra se pueda abrir en su población— pero
 *     los nombres no: son María López, Pablo Herrera y doce más, con montos de venta.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import PanelDeCreative from '../creative/PanelDeCreative.jsx';

export default function CreativeView({ activa }) {
  return (
    <section className={activa ? 'view on estetica-op' : 'view estetica-op'} id="v-creative">
      <div className="view-scroll cre-scroll">
        {/* La estética de operación INVIERTE el encabezado: el `h2` pasa a rótulo de 9,5 px en
            mayúsculas y la bajada a titular de 24 px. `.stack` y `.ch-title` lo apilan, y
            `.cl-page` da el `gap: 18px` del cuerpo. */}
        <div className="cre-head">
          <div className="ch-l stack">
            <div className="ch-title">
              <h2>Creative</h2>
              {/* La bajada cambió con la pantalla. Decía «Qué funciona, qué no, y por qué» — y el
                  «por qué» es justamente la mitad que el § 18.12 le reserva a Creative Intelligence
                  y que hoy no se puede construir: exige leer la pieza, y ni el video, ni el copy, ni
                  el guion están guardados en ninguna tabla. */}
              <span className="cre-desc">Qué pieza trae mejor gente, y sobre cuántos datos</span>
            </div>
          </div>
        </div>
        <div className="cl-page">
          <PanelDeCreative />
        </div>
      </div>
    </section>
  );
}
