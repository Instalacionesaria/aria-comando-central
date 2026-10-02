'use client';

/* La mascota de la marca en React (`docs/OTROS/nueva-estructura/03-LA-MARCA.md`, `NE-28`).
 *
 * Envuelve `<aria-mascot>` (`public/brand/mascota/aria-mascot.js`), que `app/layout.js` registra con
 * `defer`. Este archivo no escribe colores: el orbe, los ojos y el halo los dibuja el elemento en su
 * SVG, y son los del brandbook.
 *
 * ── POR QUÉ ESPERA A QUE EL ELEMENTO ESTÉ DEFINIDO ──────────────────────────
 *
 * Un `<aria-mascot>` que se conecta antes del `define` se «mejora» después, y en esa mejora el
 * elemento arma su mirada dos veces y suelta una: su `connectedCallback` no desarma lo anterior, así
 * que queda un bucle de cada cuadro y tres oyentes del documento huérfanos para toda la vida de la
 * página. Esperar a `customElements.whenDefined` lo evita sin tocar el elemento. Y
 * `useSyncExternalStore` devuelve `false` en el servidor, así que React nunca tiene que reconciliar
 * el SVG que escribe el elemento.
 *
 * ── `diametro` ES EL DEL ORBE ───────────────────────────────────────────────
 *
 * Como lo mide el lienzo del Inicio. El elemento dibuja el orbe en 116 de las 200 unidades de su
 * `size` (el resto es el halo), así que `size` = diámetro × 200 / 116: un orbe de 88 es un `size` de
 * 152. La caja que ocupa en la página mide el diámetro, y el halo sobresale sin empujar a nadie.
 *
 * ── `viva` ──────────────────────────────────────────────────────────────────
 *
 * Si la pantalla está a la vista. Fuera de ella el elemento se desmonta, y su `disconnectedCallback`
 * corta el bucle de cada cuadro y los oyentes del documento: todas las vistas siguen montadas a la
 * vez (`NE-35`), y sin esto la mascota del Inicio miraría el cursor toda la tarde desde una pantalla
 * escondida. */
import { useSyncExternalStore } from 'react';

const ETIQUETA = 'aria-mascot';
const ORBE = 116 / 200;

function suscribir(avisar) {
  let vigente = true;
  customElements.whenDefined(ETIQUETA).then(() => {
    if (vigente) avisar();
  });
  return () => {
    vigente = false;
  };
}
const definida = () => customElements.get(ETIQUETA) !== undefined;
const enElServidor = () => false;

export default function Mascota({ diametro, estado = 'neutral', sigue = false, viva = true, className }) {
  const lista = useSyncExternalStore(suscribir, definida, enElServidor);
  const size = Math.round(diametro / ORBE);
  return (
    /* Decorativa: el sentido de la pantalla lo lleva su titular. */
    <span
      className={className}
      aria-hidden="true"
      /* Centrada en su caja, y hacen falta las dos: el SVG mide `size` y la caja el diámetro, así que la
         pista de la rejilla crece hasta el SVG. `placeItems` centra el elemento en su pista, y
         `placeContent` centra la pista en la caja; sin éste la pista arranca en la esquina y el orbe cae
         32 px a la derecha y 32 abajo, encima del saludo (medido en Chrome en la revisión de E7). */
      style={{ display: 'inline-grid', placeItems: 'center', placeContent: 'center', width: diametro, height: diametro }}
    >
      {lista && viva ? <aria-mascot size={size} state={estado} follow={sigue} /> : null}
    </span>
  );
}
