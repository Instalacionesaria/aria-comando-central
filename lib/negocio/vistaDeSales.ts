// La LECTURA de la pantalla de Sales desde el navegador.
//
// ═══════════════════════════════════════════════════════════════════════════════
// NO CALCULA NADA, Y ACÁ ESO NO ES LO PRINCIPAL: LO PRINCIPAL ES QUE NO INVENTA
//
// Las otras tres pantallas de Inteligencia tenían un módulo en `lib/aios/` que calculaba en el
// navegador —450 líneas en Creative, 655 en Conversion—. **Sales no tuvo módulo que borrar**: su
// maqueta eran 231 líneas de marcado estático con **23 literales**, sin un `fetch`, sin estado y sin
// una sola interpolación, aritméticamente coherentes entre sí y por eso engañosas.
//
// Acá el cliente pide y dibuja. Cada cifra llega con su piso aplicado, su nulo donde no se puede
// decir —con el motivo— y su aviso escrito. Desde el 2026-10-09 lo que dibuja el front del prototipo
// llega armado en `pantalla` (`docs/sales/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`, S15-13).
//
// ── EL TIPO ES EL CONTRATO, Y SE ESCRIBE UNA SOLA VEZ ───────────────────────
//
// Los bloques se importan de sus módulos con `import type`. Redeclararlos acá daría dos
// definiciones que compilan mientras coincidan y **dejan de coincidir sin que nada falle** — el
// mismo motivo por el que `inicio.ts:34-38` re-exporta sus tipos en vez de copiarlos.
//
// Y el `import type` no arrastra nada al navegador: se borra al compilar. Un `import` normal de
// `cierrePorCloser.ts` metería `datos()` y la capa de base en el paquete del cliente.
// ═══════════════════════════════════════════════════════════════════════════════

import { pedir } from '../http/cliente.ts';
import type { ClaveDePeriodo } from './periodo.ts';
import type { DineroDelMes } from './dineroDelMes.ts';
import type { Cancelacion } from './indicadoresDeCitas.ts';
import type { CadenaDeCierre } from './cadenaDeCierre.ts';
import type { CicloHastaLaCita } from './cicloHastaLaCita.ts';
import type { CierreDeLosClosers } from './cierrePorCloser.ts';
import type { VENTANAS } from './ventanasDeSales.ts';
import type { PantallaDeSalesArmada } from './lecturaDeSales.ts';

const RUTA = '/api/sales';

export interface PantallaDeSales {
  periodo: ClaveDePeriodo;
  /**
   * Qué POBLACIÓN mide cada ventana de esta pantalla.
   *
   * Viaja porque son tres y dos de ellas dicen lo mismo describiendo cosas distintas: «quiénes
   * entraron» contra «qué reuniones hubo». Desde el 2026-10-09 la pantalla no lo dibuja —es un tablero
   * de cifras (S15-18)—: queda en la respuesta para quien la explique. El `import type` no arrastra
   * nada al paquete del navegador: se borra al compilar.
   */
  ventanas: typeof VENTANAS;
  /** Cobrado, ventas y acuerdos. **Del mes calendario**, no del período de arriba. */
  dinero: DineroDelMes;
  /** La cancelación, de 0 a 100. Se CONSUME de `tasaDeCancelacion`: Sales es su segundo consumidor. */
  cancelacion: Cancelacion;
  /** Los cinco eslabones, con el contacto como unidad en los cinco. */
  cadena: CadenaDeCierre;
  /** Del alta a la primera CITA, no a la venta. p50 y p90, nunca un promedio. */
  ciclo: CicloHastaLaCita;
  /** Una fila por closer configurado, en orden de designación. */
  closers: CierreDeLosClosers;
  /**
   * Lo que el front arma: las cuatro cifras, la tabla, los motivos y lo de la tarjeta de abajo que se calcula, de 0 a
   * 1. Los eslabones y el dinero los lee de los bloques de arriba.
   */
  pantalla: PantallaDeSalesArmada;
}

export type ResultadoDeSales =
  | { tipo: 'datos'; pantalla: PantallaDeSales }
  | { tipo: 'fallo'; mensaje: string };

export async function leerSales(periodo: ClaveDePeriodo): Promise<ResultadoDeSales> {
  /* El período es OBLIGATORIO acá aunque el servidor tenga uno por omisión: con un argumento
     opcional, una llamada que se olvide de pasarlo compila, pide treinta días y enciende el botón
     que diga el estado local. Los dos se ven bien y no coinciden.
     *
     Acá tiene un filo extra: el segmentado del prototipo tenía un botón que mandaba `data-p="mes"`,
     que no es ninguna de las cuatro claves. Con el tipo obligatorio, esa
     clave no compila; sin él, viajaría y el servidor la rechazaría con un 400 que la pantalla
     dibujaría como «no se pudo leer». */
  const r = await pedir<PantallaDeSales>(`${RUTA}?periodo=${encodeURIComponent(periodo)}`);
  if (r.tipo === 'datos') return { tipo: 'datos', pantalla: r.datos };
  /* Los dos fallos se distinguen: «el servidor dijo que no» y «no se pudo llegar al servidor»
     mandan a mirar dos cosas distintas. */
  if (r.tipo === 'rechazado') {
    return { tipo: 'fallo', mensaje: r.detalle || 'No se pudo leer la cadena comercial.' };
  }
  return { tipo: 'fallo', mensaje: 'No se pudo conectar para leer la cadena comercial.' };
}
