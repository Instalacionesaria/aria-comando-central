'use client';

// ¿Qué pantalla está a la vista? — para React.
//
// ════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTE ARCHIVO EXISTE
//
// El cambio de pantalla es puro DOM —`lib/aios/shell.js`, el port del prototipo— y React no se
// entera. La consecuencia estaba medida: el reloj de 10 segundos del Closer, que dispara la ingesta
// contra GoHighLevel, se registraba para **cualquiera que tuviera la sección Closer en su menú**,
// aunque pasara la tarde en Ajustes. 360 llamadas al CRM por hora y por empresa, sin mirar el Closer.
//
// El almacén vive en `shell.js`, que es el único lugar que decide qué pantalla se abre. Acá está
// solo el puente a React, separado para que el port del prototipo no tenga que importar React.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { alCambiarDeVista, vistaActiva } from './aios/shell.js';

/**
 * ¿Esta pantalla es la que se está mostrando?
 *
 * Devuelve `false` en el primer render y en el servidor, y se corrige en el efecto. Es un render de
 * atraso y está bien en esta dirección: lo que se decide con esto es si ARRANCAR un reloj que gasta
 * llamadas al CRM, y el valor de reserva prudente es «no». Al revés —arrancar y después apagar— cada
 * carga de la aplicación pagaría un ciclo de todas las pantallas con reloj.
 *
 * @param clave la clave de la pantalla, la misma del `data-view` del menú.
 */
export function estaALaVista(clave: string): boolean {
  const [abierta, setAbierta] = useState<string | null>(null);

  useEffect(() => {
    const leer = () => setAbierta(vistaActiva());
    leer();
    return alCambiarDeVista(leer);
  }, []);

  return abierta === clave;
}
