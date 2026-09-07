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
 * ABIERTA POR OMISIÓN, Y SE RECUERDA POR TABLERO
 *
 * Se pidió abierta por omisión, y eso no cambió: lo que se guarda es solo la lista de las
 * REPLEGADAS, así que una sección nueva —una cola que se agregue, una etapa del embudo— nace
 * abierta sin que nadie tenga que acordarse de nada.
 *
 * Lo que sí cambió es cuánto dura, y hasta dónde llegaba **estaba medido en el navegador**:
 *
 *   · **Sobrevivía abrir y cerrar una ficha.** La ficha es un panel superpuesto y no desmonta el
 *     tablero, así que se pliega una etapa, se abre un contacto, se cierra, y sigue plegada.
 *   · **NO sobrevivía cambiar de sub-pestaña.** `CloserView` y `SetterView` dibujan solo la
 *     sub-pestaña activa, así que ir al Pipeline y volver a Mi Día DESMONTA y el estado se iba
 *     con el componente. Medido: se plegaba «Nuevo», se iba a Mi Día, se volvía, y estaba abierta.
 *
 * Esa segunda mitad es la que `lib/usarMemoriaDeVista.ts` cierra, y llega en el mismo paso que hizo
 * que el DATO sobreviva al desmontaje: sin eso, volver ya costaba un «Cargando» y el pliegue era
 * el menor de los problemas. Con el dato ya instantáneo, la lista aparece completa y **desarma
 * sola** lo que uno había dejado armado, que se nota más que antes.
 *
 * ── POR QUÉ HACE FALTA UN `tablero`, Y NO ALCANZA EL TÍTULO ────────────────
 *
 * Este mismo comentario ya lo había dicho: los títulos se repiten entre tableros —«Seguimientos
 * de hoy» está en el Mi Día del closer y en el del setter— así que sin un nombre de tablero
 * adelante, replegar uno replegaría el otro. Los cuatro nombres los pasan las vistas.
 *
 * Y no se guarda en `localStorage`, que era el otro camino: un pliegue es un gesto del momento
 * —«esta lista es larga, la cierro para ver la de abajo»—, no una preferencia que alguien fije
 * una vez. Vive en memoria y muere al recargar, igual que la memoria de lecturas.
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

import { usarPliegue } from '../../lib/usarMemoriaDeVista.ts';

/**
 * @param titulo    El nombre de la sección. Va también en la etiqueta del botón.
 * @param cuantos   El conteo. Se dibuja SIEMPRE, plegada o no — ver el encabezado.
 * @param cola      La clave de la cola, para `data-cola`. La usa Mi Día, y de ahí sale su color.
 *
 *                  Reemplazó a un `tono` de tres valores que hacía tres cosas distintas —uno
 *                  teñía el encabezado, otro solo la píldora, el tercero apagaba el título— y
 *                  dejaba dos de las cinco colas sin ninguno. Con `data-cola`, las colas usan el
 *                  MISMO mecanismo que las etapas del Pipeline y heredan su trato entero.
 * @param etapa     La clave de la etapa, para `data-etapa`. La usa el Pipeline, que saca su
 *                  canto de color de ahí.
 * @param extra     Lo que va en el encabezado DESPUÉS del conteo, antes del botón.
 * @param tablero   `closer/dia`, `closer/pipeline`, `setter/dia` o `setter/pipeline`. Es dónde se
 *                  recuerda el pliegue. Sin él la sección funciona y no recuerda nada — y eso es
 *                  mejor que recordar cruzado con otro tablero, que es lo que pasaría usando solo
 *                  el título.
 */
export default function SeccionPlegable({
  titulo,
  cuantos,
  cola = null,
  etapa = null,
  extra = null,
  tablero = null,
  children,
}) {
  /* Invertido a propósito: lo guardado lista las REPLEGADAS, y acá se pregunta por `abierta`
     porque es lo que usan las tres líneas de abajo. */
  const [plegada, alternar] = usarPliegue(tablero, titulo);
  const abierta = !plegada;

  return (
    <div
      className={`md-sec${abierta ? '' : ' plegada'}`}
      /* Cada uno SOLO cuando lo hay. Puesto siempre, un `data-etapa="null"` sería un atributo
         que el CSS podría llegar a usar por error — y los selectores de color son
         `[data-etapa]` y `[data-cola]` a secas, o sea que un nulo escrito los activaría con
         `--etapa` sin definir: canto y banda transparentes, que se ve como un defecto. */
      {...(etapa ? { 'data-etapa': etapa } : {})}
      {...(cola ? { 'data-cola': cola } : {})}
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
          onClick={alternar}
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
