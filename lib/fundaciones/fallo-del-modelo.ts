// Un fallo del modelo, nombrado: QUÉ pasó, A QUIÉN le toca, y una referencia para encontrarlo.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ EXISTE
//
// Hasta el 2026-10-01 todos los fallos del modelo llegaban a la pantalla con el mismo párrafo
// —«El modelo no respondió… si dice que el saldo… si nombra un límite… cualquier otra cosa…»— y un
// paréntesis técnico en inglés. Quien lo leía no sabía si le tocaba a él (recargar saldo), a nadie
// (Anthropic saturado: esperar) o a nosotros, así que la única salida era escribirle a Kevin
// «falló otra vez». Y Kevin, con la captura en la mano, tenía que ir a buscar a los registros.
//
// Ahora el servidor CLASIFICA el fallo en una situación (`IA-SATURADO`, `IA-SIN-SALDO`…), le pone una
// referencia corta y deja UNA línea de registro con las dos. La pantalla muestra la frase de esa
// situación —que termina diciendo a quién le toca— y debajo el código y la referencia. Con la
// captura alcanza: el código dice qué fue, y la referencia encuentra la línea exacta en Vercel.
//
// Eran cuatro lugares que armaban este rechazo cada uno a su modo (la generación, la conversación,
// el relleno y el Espía). Ahora pasan todos por acá, que es también donde se registrará el
// incidente para el panel cuando exista.
//
// ── EL FORMATO DEL DETALLE ES UN CONTRATO CON LA PANTALLA ────────────────────
//
//     IA-SATURADO · ref 7K3QX9 · overloaded_error
//
// `lib/fundaciones/mensajes.ts` lo lee con `leerFalloDelModelo`. El código sigue siendo
// `modelo_no_disponible` (502), así que ningún consumidor que no conozca este formato se rompe:
// muestra el texto de siempre con el detalle entre paréntesis.
// ═══════════════════════════════════════════════════════════════════════════════

import { rechazo } from '../autorizacion/respuesta.ts';

/** Las situaciones. Cada una lleva a una acción distinta de una persona distinta. */
export type SituacionDelModelo =
  | 'IA-CONEXION'
  | 'IA-TIEMPO'
  | 'IA-SIN-SALDO'
  | 'IA-LLAVE'
  | 'IA-PERMISO'
  | 'IA-LIMITE'
  | 'IA-SATURADO'
  | 'IA-MODELO'
  | 'IA-PETICION'
  | 'IA-GRANDE'
  | 'IA-VACIO'
  | 'IA-TRUNCADO'
  | 'IA-DECLINO'
  | 'IA-ESTRUCTURA'
  | 'IA-OTRO';

/** Todo lo que los cuatro caminos pueden devolver cuando el modelo no sirvió. */
export type FalloDelModelo =
  | { tipo: 'rechazado'; estado: number; codigo: string; motivo: string | null }
  | { tipo: 'sin_respuesta'; causa?: string }
  | { tipo: 'sin_texto' }
  | { tipo: 'truncado' }
  | { tipo: 'declino' }
  | { tipo: 'sin_estructura' };

/** Dónde pasó. Va al registro, no a la pantalla: la pantalla ya sabe dónde está. */
export interface DondeFallo {
  /** `generar`, `conversar`, `rellenar`, `espia`… */
  origen: string;
  orgId?: string;
  /** La herramienta o el paso, en palabras: «Research paso 1». */
  donde?: string;
}

/** Decide la situación. Solo mira campos que el proveedor manda de verdad. */
export function clasificarFallo(fallo: FalloDelModelo): SituacionDelModelo {
  switch (fallo.tipo) {
    case 'sin_texto':
      return 'IA-VACIO';
    case 'truncado':
      return 'IA-TRUNCADO';
    case 'declino':
      return 'IA-DECLINO';
    case 'sin_estructura':
      return 'IA-ESTRUCTURA';
    case 'sin_respuesta': {
      const causa = fallo.causa ?? '';
      // El tope NUESTRO: `pedirExterno` lo nombra con esta frase exacta.
      if (causa.startsWith('se agotó el tiempo de espera')) return 'IA-TIEMPO';
      // Un `error` a mitad del flujo trae el tipo del proveedor (ver `mensajeDelFlujo`).
      if (/overloaded_error|api_error/.test(causa)) return 'IA-SATURADO';
      return 'IA-CONEXION';
    }
    case 'rechazado': {
      const { estado, codigo, motivo } = fallo;
      // Antes que el 400: la falta de saldo LLEGA como `invalid_request_error`, y es otra persona.
      if (motivo !== null && /credit balance/i.test(motivo)) return 'IA-SIN-SALDO';
      if (estado === 401 || codigo === 'authentication_error') return 'IA-LLAVE';
      if (estado === 403 || codigo === 'permission_error') return 'IA-PERMISO';
      if (estado === 404 || codigo === 'not_found_error') return 'IA-MODELO';
      if (estado === 413 || codigo === 'request_too_large') return 'IA-GRANDE';
      if (estado === 429 || codigo === 'rate_limit_error') return 'IA-LIMITE';
      if (estado >= 500 || codigo === 'overloaded_error' || codigo === 'api_error') return 'IA-SATURADO';
      if (estado === 400 || codigo === 'invalid_request_error') return 'IA-PETICION';
      return 'IA-OTRO';
    }
  }
}

/** Lo técnico, tal como lo dijo el proveedor o la red. Es lo que se lee en el registro. */
function tecnico(fallo: FalloDelModelo): string {
  switch (fallo.tipo) {
    case 'rechazado':
      return fallo.motivo === null ? `${fallo.estado} ${fallo.codigo}` : `${fallo.estado} ${fallo.codigo}: ${fallo.motivo}`;
    case 'sin_respuesta':
      return fallo.causa ? `sin respuesta: ${fallo.causa}` : 'sin respuesta';
    case 'sin_texto':
      return 'respuesta sin texto';
    case 'truncado':
      return 'respuesta truncada';
    case 'declino':
      return 'el modelo declinó';
    case 'sin_estructura':
      return 'respuesta sin estructura';
  }
}

/** Sin 0/O ni 1/I/L: se dicta por teléfono y se copia de una captura. */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Una referencia corta. No es un secreto ni un identificador único global: es para buscarla. */
export function nuevaReferencia(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('');
}

/**
 * El rechazo de un fallo del modelo, con su línea de registro.
 *
 * La línea empieza con `incidente` y lleva la referencia, así que `vercel logs -q <ref>` la encuentra
 * sola. `ADR-0407` prohíbe registrar cuerpos; un código, un número y el motivo del proveedor no lo son.
 */
export function rechazoDelModelo(fallo: FalloDelModelo, dondeFallo: DondeFallo): Response {
  const situacion = clasificarFallo(fallo);
  const ref = nuevaReferencia();
  const detalle = tecnico(fallo);
  console.error(
    `incidente ${situacion} · ref ${ref} · ${dondeFallo.origen}` +
      (dondeFallo.donde ? ` · ${dondeFallo.donde}` : '') +
      (dondeFallo.orgId ? ` · org ${dondeFallo.orgId}` : '') +
      ` · ${detalle}`,
  );
  return rechazo('modelo_no_disponible', `${situacion} · ref ${ref} · ${detalle}`);
}

/** Las situaciones que se arreglan solas: vale la pena un segundo intento antes de mostrarlas. */
export function esPasajero(fallo: FalloDelModelo): boolean {
  const s = clasificarFallo(fallo);
  return s === 'IA-SATURADO' || s === 'IA-CONEXION';
}
