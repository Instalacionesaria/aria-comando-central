/* ═══════════════════════════════════════════════════════════════════════════════
 * ERA MARCADO ESTÁTICO CON 23 LITERALES, Y UNO ESTABA AL LADO DE UN NOMBRE REAL
 *
 * Lo que había acá venía portado de `aios-command-center_1.html` (líneas 2932-2995): 231 líneas
 * **sin un `fetch`, sin estado y sin una sola interpolación**. No había módulo de `lib/aios/` que lo
 * llenara —a diferencia de Creative y Conversion— porque el dato estaba escrito en el JSX.
 *
 * Y era aritméticamente coherente: 31+43=74, 10+8=18, 18/74≈24 %, $31.000+$24.200=$55.200, 74−18=56,
 * y los cuatro anchos de barra eran cada conteo sobre 56. **Pasaba cualquier lectura de
 * plausibilidad, y por eso engañaba.**
 *
 * ── LO QUE SE VA, Y POR QUÉ CADA COSA ─────────────────────────────────────
 *
 *   · **Las cuatro tarjetas de arriba** —Asistencias 74, Tasa de cierre 24 %, Ventas 18, Revenue
 *     reportado $55.200—. Medido el 2026-09-21: `citas.asistio` es nulo en las 327 filas de la base,
 *     `negocio.resultados` tiene 7 filas con **cero ventas y cero montos**. Las cuatro cifras
 *     describían un negocio que no existe en ninguna tabla.
 *
 *   · **La tabla de dos closers, con un NOMBRE REAL.** Decía «Jorge Veramendi · ICP alto asignado ·
 *     44 agendadas · 31 asistieron · 10 ventas · 32 % · $31.000». Jorge Veramendi es un closer
 *     configurado de verdad en esta organización, y once usuarios veían esa fila. Ninguno de esos
 *     seis números sale de ninguna parte, y «ICP alto asignado» **no es una regla que exista** en el
 *     sistema: no hay reparto de leads por ICP en ninguna tabla ni en ningún código.
 *
 *   · **Los cuatro motivos de no venta** —Precio 21, No es quien decide 13, Sin necesidad clara 12,
 *     Pidió tiempo 10—. El catálogo real de `no_interesa` es *Precio · No es el momento ·
 *     Competencia · No califica · Otro* (`lib/negocio/salidas.ts:165`): **sólo «Precio» coincide**.
 *     Y «Pidió tiempo» es opción de `nurture`, no de `no_interesa`, así que el gráfico mezclaba dos
 *     salidas en una sola torta. En toda la base hay **1 fila**, con el detalle «Otro».
 *
 *   · **El botón «Plan de acción» (`slPlanBtn`).** No tenía ni una frase detrás: ni las 12 de
 *     Creative ni las 47 de Conversion. Era un botón que no hacía nada.
 *
 *   · **El segmentado de tres botones (`slPeriod`).** Su tercer botón mandaba `data-p="mes"`, que no
 *     es ninguna de las cuatro claves de `lib/negocio/periodo.ts`. Lo reemplaza el segmentado del
 *     panel, que manda claves que el servidor acepta y **enciende el botón que el servidor
 *     contestó**, no el que se pidió.
 *
 *   · **La píldora «Personalizado» (`slPill`).** Abría el calendario para no hacer nada, y de paso
 *     apagaba el resaltado del segmentado. Un rango libre daría ventanas que ninguna otra pantalla
 *     puede reproducir, y cada piso y cada aviso habría que volver a razonarlos.
 *
 * ── LO QUE SE CONSERVA ────────────────────────────────────────────────────
 *
 * El encabezado invertido de la estética de operación —rótulo en versalitas arriba, titular debajo—,
 * que es el de las cinco pantallas de Inteligencia y no una decisión de ésta.
 *
 * Lo que la pantalla nueva NO puede medir se dibuja **en la pantalla**, con su medición y su fecha:
 * ver `Huecos` en `components/sales/PanelDeSales.jsx`. La diferencia entre un hueco declarado y una
 * regresión es ese bloque — y acá pesa más que en las otras, porque la maqueta dibujaba justo esas
 * cosas con números inventados.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import PanelDeSales from '../sales/PanelDeSales.jsx';

export default function SalesView({ activa }) {
  return (
    <section className={activa ? 'view on estetica-op' : 'view estetica-op'} id="v-sales">
      <div className="view-scroll cre-scroll">
        {/* La estética de operación INVIERTE el encabezado: el `h2` pasa a rótulo de 9,5 px en
            mayúsculas y la bajada a titular de 24 px. `.stack` y `.ch-title` lo apilan, y `.cl-page`
            da el `gap: 18px` del cuerpo — sin ella, el `gap: 24px` del scroller se aplica entre
            TODOS los bloques. */}
        <div className="cre-head">
          <div className="ch-l stack">
            <div className="ch-title">
              <h2>Sales</h2>
              {/* La bajada cambió con la pantalla. Decía «Cierre, closers y motivos de pérdida», y
                  de esas tres cosas el cierre no existe —cero ventas registradas— y los motivos son
                  una sola fila. Lo que la pantalla sí puede decir es hasta dónde llega la cadena y
                  cuánto tarda la gente en agendar. */}
              <span className="cre-desc">Hasta dónde llega la cadena, y dónde se corta</span>
            </div>
          </div>
        </div>
        <div className="cl-page">
          <PanelDeSales />
        </div>
      </div>
    </section>
  );
}
