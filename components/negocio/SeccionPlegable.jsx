'use client';

/* Una sección de lista con su encabezado, su conteo y el botón de replegar.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * UN COMPONENTE PARA LOS CUATRO TABLEROS
 *
 * `.md-sec` + `.md-h` + su conteo es el molde de Mi Día, y el Pipeline lo copió cuando pasó de
 * columnas a secciones apiladas. Las dos pantallas las dibujan las DOS pestañas —Closer y Setter
 * montan los mismos dos componentes con distinto camino de API—, así que son cuatro tableros con
 * el mismo encabezado.
 *
 * El botón de replegar entra en UN lugar. Copiado en dos, la primera divergencia es silenciosa: se
 * arregla el `aria-expanded` en uno, el otro queda sin él, y las dos pantallas se ven idénticas.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ABIERTA POR OMISIÓN, Y NO SE RECUERDA — CON LO QUE ESO SIGNIFICA, MEDIDO
 *
 * Se pidió abierta por omisión, y el estado vive acá y no se guarda en ninguna parte. Hasta dónde
 * llega eso **está medido en el navegador**, porque la primera versión de este comentario lo dijo
 * al revés:
 *
 *   · **Sobrevive abrir y cerrar una ficha.** La ficha es un panel superpuesto y no desmonta el
 *     tablero, así que se pliega una etapa, se abre un contacto, se cierra, y sigue plegada. Es el
 *     recorrido normal de esta pantalla.
 *   · **NO sobrevive cambiar de sub-pestaña.** `CloserView` y `SetterView` dibujan solo la
 *     sub-pestaña activa —`if (sub === 'pipeline') return <Pipeline …>`— así que ir al Pipeline y
 *     volver a Mi Día DESMONTA y el estado se va con el componente. Medido: se pliega «Nuevo», se
 *     va a Mi Día, se vuelve, y está abierta otra vez.
 *
 * Se deja así a propósito. Plegar acá es un gesto del momento —«esta lista es larga, la cierro
 * para ver la de abajo»—, no una preferencia que alguien fije una vez; y guardarla en algún lado
 * abre la pregunta de dónde, que para un pliegue de lista no vale una columna ni una ruta.
 *
 * Si algún día molesta, el arreglo NO es un `localStorage` acá adentro: los títulos se repiten
 * entre tableros —«Seguimientos de hoy» está en el Mi Día del closer y en el del setter— así que
 * haría falta primero un nombre de tablero para no acoplarlos.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * EL CONTEO NO SE PLIEGA, Y ESO ES LA MITAD QUE IMPORTA
 *
 * El encabezado se queda: replegada, la sección sigue diciendo «Ganado 12». Es la regla que las
 * dos pantallas ya tenían escrita —*«el conteo va SIEMPRE, incluido el cero»*— y plegar el número
 * con la lista la habría roto: una sección plegada sin conteo no dice si adentro hay doce o
 * ninguno, y entonces nadie la pliega.
 *
 * ── LOS HIJOS NO VAN ENVUELTOS ────────────────────────────────────────────
 *
 * `{abierta ? children : null}` y no `<div>{children}</div>`, y no es estilo: `app/closer.css`
 * tiene DOS reglas que dependen de que las filas sean hijas DIRECTAS de `.md-sec` —el aire del
 * vacío de una etapa y el borde de la primera fila—. Un envoltorio las rompe sin que nada falle:
 * el vacío pierde su margen y la primera fila queda con doble línea.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useState } from 'react';

/**
 * @param titulo    El nombre de la sección. Va también en la etiqueta del botón.
 * @param cuantos   El conteo. Se dibuja SIEMPRE, plegada o no — ver el encabezado.
 * @param tono      `crit` / `warn` / `done`, el modificador de `.md-sec`. Lo usa Mi Día.
 * @param etapa     La clave de la etapa, para `data-etapa`. La usa el Pipeline, que saca su
 *                  canto de color de ahí.
 * @param extra     Lo que va en el encabezado DESPUÉS del conteo, antes del botón.
 */
export default function SeccionPlegable({
  titulo,
  cuantos,
  tono = null,
  etapa = null,
  extra = null,
  children,
}) {
  const [abierta, setAbierta] = useState(true);

  return (
    <div
      className={`md-sec${tono ? ` ${tono}` : ''}${abierta ? '' : ' plegada'}`}
      /* `data-etapa` solo cuando hay etapa. Puesto siempre, un `data-etapa="null"` en Mi Día
         sería un atributo que el CSS podría llegar a usar por error. */
      {...(etapa ? { 'data-etapa': etapa } : {})}
    >
      <div className="md-h">
        {titulo} <span className="b">{cuantos}</span>
        {extra}
        {/* ── EL BOTÓN, TODO A LA DERECHA ──────────────────────────────────────

            `margin-left:auto` en un `.md-h` que ya es flex: se va al borde sin tocar la
            posición del título ni del conteo.

            Es un `<button>` de verdad y no un `<div>` con `onClick`: se alcanza con el tabulador,
            responde a Enter y a la barra espaciadora sin una línea de código, y `aria-expanded`
            le dice a un lector de pantalla si la lista está abierta. La flecha sola no lo dice.

            El glifo NO cambia: es el mismo ▾ girado por CSS. Con dos glifos distintos habría dos
            fuentes de verdad para el mismo estado, y el día que una se olvide, la flecha apunta
            para donde la lista no está. */}
        <button
          type="button"
          className="sec-plegar"
          aria-expanded={abierta}
          onClick={() => setAbierta((v) => !v)}
          title={abierta ? 'Replegar la lista' : 'Abrir la lista'}
          aria-label={`${abierta ? 'Replegar' : 'Abrir'} ${titulo}`}
        >
          ▾
        </button>
      </div>

      {abierta ? children : null}
    </div>
  );
}
