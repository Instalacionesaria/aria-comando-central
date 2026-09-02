'use client';

/* Los dos caminos de una herramienta: el formulario y el agente.
   ==========================================================================
   Vive en su propio archivo porque lo usan los DOS paneles —el genérico y el del Research—, y
   duplicarlo en cada uno sería la lista paralela con forma de botones: la pantalla en la que
   alguien corrija el texto, el orden o el estado deshabilitado quedaría distinta de la otra sin
   que nada falle.

   Es un `tablist` de verdad y no dos botones sueltos: son dos vistas excluyentes de lo mismo, y
   quien navega con teclado o con lector de pantalla tiene que escuchar «pestaña 1 de 2», no dos
   botones sin relación entre sí. */

export const MODO_FORMULARIO = 'formulario';
export const MODO_AGENTE = 'agente';

export default function SelectorDeModo({ modo, onElegir, bloqueado, queHaceElAgente }) {
  return (
    <div className="fd-modos" role="tablist" aria-label="Cómo llenar el formulario">
      <button
        type="button"
        role="tab"
        aria-selected={modo === MODO_FORMULARIO}
        className={modo === MODO_FORMULARIO ? 'on' : ''}
        disabled={bloqueado}
        onClick={() => onElegir(MODO_FORMULARIO)}
      >
        <b>Opción 1</b> Formulario
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={modo === MODO_AGENTE}
        className={modo === MODO_AGENTE ? 'on' : ''}
        disabled={bloqueado}
        onClick={() => onElegir(MODO_AGENTE)}
      >
        <b>Opción 2</b> Agente conversacional
      </button>
      <span className="fd-modos-nota">
        {modo === MODO_FORMULARIO ? 'Llenás los campos y apretás el botón.' : queHaceElAgente}
      </span>
    </div>
  );
}
