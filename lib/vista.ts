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
import { alCambiarDeVista, pedidoDeVista, vistaActiva } from './aios/shell.js';

/**
 * La clave de la pantalla que se está mostrando, o `null` antes del primer efecto.
 *
 * La lee la barra para marcar la fila abierta (`components/Nav.jsx`), que hasta la etapa E9 marcaba
 * `shell.js` tocando el DOM. Guarda un TEXTO y no un objeto: así sólo vuelve a dibujar a quien la usa
 * cuando la pantalla cambia de verdad.
 */
export function usarUbicacion(): string | null {
  const [abierta, setAbierta] = useState<string | null>(null);

  useEffect(() => {
    const leer = () => setAbierta(vistaActiva());
    leer();
    return alCambiarDeVista(leer);
  }, []);

  return abierta;
}

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
  return usarUbicacion() === clave;
}

/** Lo que una pantalla recibe de `irALaVista`: la pestaña pedida y el número del pedido. */
export interface PedidoDeVista {
  pestana: string | null;
  secuencia: number;
}

/**
 * Qué guarda `usarPedidoDeVista` después de un aviso. Separada del hook para poder ejecutarla en una
 * prueba (`pruebas/codigo/192-la-navegacion-pide-la-pestana.test.ts`).
 *
 * Un pedido nuevo PARA ESTA PANTALLA —otra `clave` no cuenta— con un número que todavía no guardó:
 * se guarda, aunque la pestaña sea la misma de antes, porque entre los dos pudo haber un clic a mano
 * en la barra propia. Cualquier otra cosa devuelve el MISMO objeto de antes, y React no vuelve a
 * dibujar la pantalla.
 */
export function siguientePedido(
  antes: PedidoDeVista | null,
  ultimo: { clave: string; pestana: string | null; secuencia: number } | null,
  clave: string | null,
): PedidoDeVista | null {
  if (clave === null || !ultimo || ultimo.clave !== clave) return antes;
  if (antes?.secuencia === ultimo.secuencia) return antes;
  return { pestana: ultimo.pestana, secuencia: ultimo.secuencia };
}

/**
 * El último pedido de navegación hecho a ESTA pantalla (`NE-19`), o `null`.
 *
 * Los pedidos a otras pantallas no la vuelven a dibujar. Quien lo usa lo atiende una vez por
 * `secuencia`: ver «EL PEDIDO» en `lib/aios/shell.js`. Con `null` no escucha nada, para que una
 * pantalla que no reparte pestañas (ICP & Oferta) pueda llamarlo sin condiciones, como pide React.
 */
export function usarPedidoDeVista(clave: string | null): PedidoDeVista | null {
  const [visto, setVisto] = useState<PedidoDeVista | null>(null);

  useEffect(() => {
    if (clave === null) return;
    const leer = () => setVisto((antes) => siguientePedido(antes, pedidoDeVista(), clave));
    leer();
    return alCambiarDeVista(leer);
  }, [clave]);

  return visto;
}
