'use client';

/* El rótulo del foco en la cabecera (el nivel 3): de qué cliente son los números de esta pantalla, o «Toda la empresa».
 *
 * Con un cliente enfocado, Leads y Sales muestran sólo ese cliente y las demás pantallas siguen siendo de la empresa
 * entera. Sin este rótulo, un número de una pantalla que no filtra parece del cliente y es de la empresa. La regla
 * es `rotuloDelFoco` (`lib/foco.ts`); acá sólo se dibuja. Es un componente aparte para que la cabecera siga leyendo
 * de la sesión sólo su navegación (la 194). */

import { useSesion } from '../app/sesion-contexto.tsx';
import { rotuloDelFoco } from '../lib/foco.ts';

export default function RotuloDelFoco({ vista }) {
  const sesion = useSesion();
  const foco = sesion?.cuentas ? rotuloDelFoco(sesion.cuentas, vista, sesion.pantallasDelCliente ?? []) : null;
  if (!foco) return null;
  return (
    <span className={foco.deUnCliente ? 'cd-foco de-un-cliente' : 'cd-foco'}>
      <span className="para-lectores">{foco.deUnCliente ? 'Mostrando el cliente: ' : 'Mostrando: '}</span>
      {foco.texto}
    </span>
  );
}
