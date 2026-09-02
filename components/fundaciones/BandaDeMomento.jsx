'use client';

/* La banda que aparece al terminar un entregable: qué se desbloqueó y cómo seguir.
   ==========================================================================
   Puerto de `ARIA-brain/app-next/components/MomentumBand.tsx`.

   ── POR QUÉ ESTO EXISTE, Y QUÉ NO HACE ────────────────────────────────────

   Llegó como un reclamo de Jorge: *«los pasos del 2 al 7 se ejecutaban solos»*. En el hub no se
   ejecuta nada solo —se revisó entero— pero sí está esta banda, con un botón que lleva el rótulo de
   EJECUCIÓN de la herramienta siguiente («✨ Redactar mi VSL») aunque solo navegue. Con todo el
   contexto heredándose solo, llegar y apretar generar se siente como que siguió andando.

   Así que esto **navega y no genera**, igual que allá. Generar cuesta tokens de la llave de la
   organización, y una cadena que se dispara sola gastaría nueve generaciones porque alguien terminó
   la primera. Lo que se devuelve es la guía: qué sigue, qué va a heredar, y un clic para llegar.

   ── EL RÓTULO ES EL DEL BOTÓN DE LA HERRAMIENTA SIGUIENTE ─────────────────

   `etiquetaBoton` sale del catálogo, así que dice «Crear mi perfil de cliente», «Redactar mi VSL» o
   lo que esa herramienta diga de sí misma. No se escribe acá: un texto propio quedaría desfasado
   del botón real el día que alguien lo corrija, y prometería una cosa distinta de la que se
   encuentra al llegar. */

import { FUENTES_POR_HERRAMIENTA, fuentes } from '@/lib/fundaciones/herencia';
import { TRAVESIA, siguienteDeLaTravesia } from '@/lib/fundaciones/travesia';

export default function BandaDeMomento({ herramienta, estado, onIr }) {
  const siguiente = siguienteDeLaTravesia(herramienta.id);

  // Prospección y el Espía no están en la travesía: no encadenan con nada y no se dibuja nada.
  if (siguiente.tipo === 'fuera') return null;

  if (siguiente.tipo === 'final') {
    return (
      <div className="fd-momento final">
        <span className="fd-momento-tic">✓</span>
        <span>
          <b>{herramienta.titulo} listo.</b> Con esto cerrás los {TRAVESIA.length} pasos del método:
          ya tenés tu fundamento completo, del perfil a la página.
        </span>
      </div>
    );
  }

  const proxima = siguiente.herramienta;
  const todas = fuentes(estado);
  const hereda = (FUENTES_POR_HERRAMIENTA[proxima.id] || []).map((clave) => todas[clave].etiqueta);

  return (
    <div className="fd-momento">
      <span className="fd-momento-tic">✓</span>
      <span className="fd-momento-texto">
        <b>
          {herramienta.titulo} listo — paso {siguiente.posicion} de {TRAVESIA.length}: {proxima.titulo}
        </b>
        {hereda.length > 0 ? (
          <span className="fd-momento-hereda"> Va a heredar: {hereda.join(' · ')}</span>
        ) : null}
      </span>
      <button type="button" className="fd-btn" onClick={() => onIr(siguiente)}>
        {proxima.etiquetaBoton} →
      </button>
    </div>
  );
}
