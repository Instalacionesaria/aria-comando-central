// En qué paso quedó «Construir el método», y qué mostrar al volver a ICP & Oferta.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ SE GUARDA
//
// La cadena corre en la pantalla: un bucle que abre cada paso, lo genera y sigue, con pausas después
// del ICP y de la Oferta. Hasta el 2026-10-03 todo eso vivía solo en la memoria del componente, así
// que salir de ICP & Oferta con la cadena en pausa —o detenida en el diagnóstico de Categoría— la
// perdía: al volver no había nada que retomar, y «Construir» quedaba bloqueado hasta recargar.
//
// Ahora el bucle escribe su estado en cada transición (`negocio.cadena_del_metodo`, una fila por
// organización), y al volver la pantalla lo RECONCILIA con lo que de verdad pasó: si estaba
// generando un documento, mira si el documento está (terminó) o si pasó el tope de una generación
// sin que esté (falló). Nunca muestra «generando» para siempre.
//
// Este módulo es puro —lo importa la pantalla—; leer y escribir la fila está en `cadena-almacen.ts`.
// ═══════════════════════════════════════════════════════════════════════════════

import type { EstadoDeFundaciones } from './estado.ts';

/** Por qué se detuvo una cadena. `salio`: se salió de la pantalla antes de que el paso generara. */
export type MotivoDeDetencion = 'cambiar' | 'pregunta' | 'fallo' | 'salio';

/** Lo que se guarda. Los índices son posiciones en los eslabones del método (después del Research). */
export interface RegistroDeCadena {
  fase: 'generando' | 'pausa' | 'detenida';
  indice: number;
  /** El id del hub de la herramienta de ese paso, para nombrarla y para contar sus versiones. */
  herramienta: number;
  /** Cuántas versiones tenía esa herramienta al empezar a generarla (o al detenerse). */
  versiones: number;
  /** Desde qué índice se retoma. */
  reanudar: number;
  /** Solo con `fase: 'detenida'`. */
  motivo?: MotivoDeDetencion;
}

/**
 * Cuánto puede tardar una generación antes de darla por fallida. La ruta corta a los 580 s
 * (`IA-TIEMPO`, «más de 9 minutos»); con margen para la recarga y el guardado, once minutos.
 */
export const TOPE_DE_UNA_GENERACION_MS = 11 * 60_000;

const MOTIVOS: readonly MotivoDeDetencion[] = ['cambiar', 'pregunta', 'fallo', 'salio'];

const entero = (x: unknown): number | null =>
  typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < 100 ? x : null;

/**
 * Un registro válido, o `null`. Lector tolerante: lo que no tiene la forma se trata como «no hay
 * cadena» —que es recuperable: se aprieta «Construir» de nuevo—, nunca como una pantalla rota. Lo
 * usa también el servidor para no escribir algo que después no se pueda leer.
 */
export function leerRegistro(x: unknown): RegistroDeCadena | null {
  if (x === null || typeof x !== 'object' || Array.isArray(x)) return null;
  const r = x as Record<string, unknown>;
  const fase = r['fase'];
  if (fase !== 'generando' && fase !== 'pausa' && fase !== 'detenida') return null;
  const indice = entero(r['indice']);
  const herramienta = entero(r['herramienta']);
  const versiones = entero(r['versiones']);
  const reanudar = entero(r['reanudar']);
  if (indice === null || herramienta === null || versiones === null || reanudar === null) return null;
  const registro: RegistroDeCadena = { fase, indice, herramienta, versiones, reanudar };
  if (fase === 'detenida') {
    const motivo = r['motivo'];
    if (typeof motivo !== 'string' || !MOTIVOS.includes(motivo as MotivoDeDetencion)) return null;
    registro.motivo = motivo as MotivoDeDetencion;
  }
  return registro;
}

/** Lo que la pantalla muestra al volver. */
export type CadenaAlVolver =
  | { tipo: 'nada' }
  /** Sigue generándose de verdad (todavía dentro del tope): la pantalla lo dice y vuelve a mirar. */
  | { tipo: 'generando'; indice: number; herramienta: number }
  | {
      tipo: 'detenida';
      indice: number;
      herramienta: number;
      /** `pausa` y `terminado` se retoman desde el paso siguiente; el resto, según `reanudar`. */
      motivo: MotivoDeDetencion | 'pausa' | 'terminado';
      reanudar: number;
      versiones: number;
    };

/**
 * Reconciliar lo guardado con lo que pasó. `edadMs` es cuánto hace que se escribió el registro,
 * medido en el SERVIDOR (no con el reloj del navegador, que puede estar corrido).
 */
export function cadenaAlVolver(
  registro: RegistroDeCadena | null,
  edadMs: number,
  estado: EstadoDeFundaciones,
): CadenaAlVolver {
  if (!registro) return { tipo: 'nada' };
  const { indice, herramienta } = registro;

  if (registro.fase === 'pausa') {
    return { tipo: 'detenida', indice, herramienta, motivo: 'pausa', reanudar: registro.reanudar, versiones: registro.versiones };
  }
  if (registro.fase === 'detenida') {
    return {
      tipo: 'detenida',
      indice,
      herramienta,
      motivo: registro.motivo ?? 'salio',
      reanudar: registro.reanudar,
      versiones: registro.versiones,
    };
  }

  // Estaba generando cuando se salió (o se cerró el navegador). ¿Qué pasó de verdad?
  const actuales = (estado.historial[herramienta] ?? []).length;
  if (actuales > registro.versiones) {
    return { tipo: 'detenida', indice, herramienta, motivo: 'terminado', reanudar: indice + 1, versiones: actuales };
  }
  if (edadMs > TOPE_DE_UNA_GENERACION_MS) {
    return { tipo: 'detenida', indice, herramienta, motivo: 'fallo', reanudar: indice, versiones: actuales };
  }
  return { tipo: 'generando', indice, herramienta };
}
