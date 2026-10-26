'use client';

/* Lo que pasó al conectar Meta desde la Conexión de un cliente (Meta directo, M4).
 *
 * Meta vuelve a `/meta/retorno`, que deja el resultado y abre Ajustes en la pestaña desde la que se conectó. Desde
 * Credenciales lo muestra `ConectarConMeta`; desde Clientes, la ventana del cliente ya no está abierta, así que el
 * resultado se dice acá, arriba de la lista, y se toma una sola vez (`lib/meta/retorno.ts`). */

import { useState } from 'react';
import { tomarResultadoDeMeta } from '../../lib/meta/retorno.ts';

export default function ResultadoDeMeta() {
  const [resultado] = useState(() => tomarResultadoDeMeta());
  if (!resultado) return null;
  return (
    <div className={`fd-aviso ${resultado.ok ? 'bien' : 'mal'}`} role="status">
      {resultado.texto}
    </div>
  );
}
