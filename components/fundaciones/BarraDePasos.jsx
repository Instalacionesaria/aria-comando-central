'use client';

/* La barra del pie del método: dónde estás, de dónde venís y a dónde seguís.
   ==========================================================================
   Puerto de `ARIA-brain/app-next/components/StepNav.tsx`.

   Reportado por Kevin: se terminaban los cinco pasos del Research y no había ningún «Continuar al
   paso 3». En el hub esa barra acompaña a TODAS las herramientas del método —«← Paso anterior», el
   indicador segmentado, «Continuar al paso N →»— y este port se la había dejado.

   ── NAVEGA, NO GENERA ─────────────────────────────────────────────────────

   Allá tampoco genera: `StepNav` no toca la lógica de las herramientas. Acá pesa más, porque cada
   generación gasta la llave de IA de la organización — una cadena que se dispara sola gastaría nueve
   porque alguien terminó la primera. El botón lleva a la herramienta siguiente; generar lo sigue
   apretando una persona.

   ── EL PASO QUE VIVE EN LA OTRA PANTALLA ──────────────────────────────────

   El VSL y la Landing se mudaron a `tools`, así que los pasos 8 y 9 están del otro lado. Cuando el
   siguiente cae ahí, la barra lo DICE en vez de ofrecer un botón que no puede cumplir: cambiar de
   pantalla desde acá es trabajo del armazón y todavía no está resuelto. Decir dónde está es más útil
   que un botón que lleva a la pantalla equivocada, y es honesto sobre lo que falta. */

import { pasoAnterior, pasoSiguiente, TRAVESIA, posicionEnLaTravesia } from '@/lib/fundaciones/travesia';
import { pasoCompleto } from '@/lib/fundaciones/estado';

export default function BarraDePasos({ herramienta, estado, pantalla, onIr }) {
  const posicion = posicionEnLaTravesia(herramienta.id);
  // Prospección y el Espía no son pasos del método: no se dibuja nada.
  if (posicion === 0) return null;

  const anterior = pasoAnterior(herramienta.id);
  const siguiente = pasoSiguiente(herramienta.id);

  const puedeIr = (vecino) => !!vecino && vecino.pantalla === pantalla;

  return (
    <div className="fd-barra-pasos">
      <button
        type="button"
        className="fd-btn sec"
        disabled={!puedeIr(anterior)}
        onClick={() => (puedeIr(anterior) ? onIr(anterior.herramienta.id) : null)}
        title={anterior ? anterior.herramienta.titulo : 'Es el primer paso del método'}
      >
        ← Paso anterior
      </button>

      {/* Un segmento por paso: los hechos en verde, el actual marcado. Es el mismo indicador del
          hub y dice de un vistazo cuánto del método está construido. */}
      <div
        className="fd-segmentos"
        role="progressbar"
        aria-valuenow={posicion}
        aria-valuemin={1}
        aria-valuemax={TRAVESIA.length}
        aria-label={`Paso ${posicion} de ${TRAVESIA.length}`}
      >
        {TRAVESIA.map((id) => (
          <span
            key={id}
            className={`fd-segmento${pasoCompleto(estado, id) ? ' hecho' : ''}${id === herramienta.id ? ' aqui' : ''}`}
          />
        ))}
      </div>

      {/* `rellenar: true` en el botón de continuar: seguir por el método significa llegar con el
          formulario completo. Es lo que distingue este botón de la pestaña de arriba —que solo
          abre— y es lo que se pidió de él: que haga su trabajo, no que lleve a una pantalla en
          blanco. */}
      {siguiente === null ? (
        <span className="fd-paso-nota">Es el último paso del método.</span>
      ) : puedeIr(siguiente) ? (
        <button
          type="button"
          className="fd-btn"
          onClick={() => onIr(siguiente.herramienta.id, { rellenar: true })}
        >
          Continuar al paso {siguiente.posicion} →
        </button>
      ) : (
        <span className="fd-paso-nota">
          El paso {siguiente.posicion} es <b>{siguiente.herramienta.titulo}</b>, y vive en{' '}
          <b>Tools</b>.
        </span>
      )}
    </div>
  );
}
