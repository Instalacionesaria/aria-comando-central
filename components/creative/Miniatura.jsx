'use client';

import { useEffect, useState } from 'react';
import { FRASE } from './comun.jsx';

/**
 * La miniatura de la pieza (CF1-12), en la tarjeta y en la ficha: la imagen del anuncio sobre el fondo del
 * prototipo. Sin imagen, el fondo con su frase; si la imagen no carga —la de Facebook puede caducar o pedir sesión—,
 * el fondo solo, sin romper la tarjeta. Sin `referrer`: Facebook no tiene por qué saber desde dónde se mira.
 */
export default function Miniatura({ url, clase, children }) {
  const [fallo, setFallo] = useState(false);
  useEffect(() => setFallo(false), [url]);
  return (
    <div className={`${clase} cr-fondo`}>
      {url && !fallo ? (
        <img className="cr-imagen" src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFallo(true)} />
      ) : url ? null : (
        <span className="cr-sin-imagen">{FRASE.sinMiniatura}</span>
      )}
      {children}
    </div>
  );
}
