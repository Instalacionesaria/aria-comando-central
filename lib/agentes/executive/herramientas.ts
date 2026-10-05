// Las herramientas del cerebro: qué hay, a quién se le ofrece cada una, y cómo se corre.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LAS REGLAS DE TODAS
//
// `docs/OTROS/agentes/03-EL-CEREBRO.md`, AG-41, AG-42 y AG-45:
//
//   · **Consume, no recalcula.** Cada herramienta llama a la misma función, con los mismos argumentos, que
//     la ruta de su pantalla. Lo que el cerebro dice es lo que la pantalla muestra.
//   · **Sólo se ofrece lo de las pestañas que la persona ve.** Una herramienta que no se ofrece no existe
//     para el modelo. La que sirve a dos secciones se ofrece con cualquiera; la que necesita dos, sólo con
//     las dos. La de las integraciones no es de ninguna sección: se ofrece cuando la ruta resolvió su dato,
//     que es sólo para quien tiene `credenciales.ver`.
//   · **Proyección por lista blanca.** Cada adaptador declara exactamente qué claves devuelve: con una lista
//     negra, una columna nueva aparecería sola en lo que viaja al modelo. Hasta 20 filas, con el total.
//   · **El período es una de las cuatro claves de la pantalla**, como `enum`; otra se rechaza.
//
// Cada herramienta corre dentro de una `conOrganizacion` CORTA que abre quien la llama, en serie: el bucle
// del modelo no tiene ninguna transacción abierta mientras espera (`01`, AG-05).
// ═══════════════════════════════════════════════════════════════════════════════

import type { HerramientaDelModelo } from '../llamada.ts';
import { HERRAMIENTAS_DE_ACQUISITION } from './adaptadores/acquisition.ts';
import { HERRAMIENTAS_DE_CREATIVE } from './adaptadores/creative.ts';
import { HERRAMIENTAS_DE_CONVERSION } from './adaptadores/conversion.ts';
import { HERRAMIENTAS_DE_CONVERSATION } from './adaptadores/conversation.ts';
import { HERRAMIENTAS_DE_SALES } from './adaptadores/sales.ts';
import { HERRAMIENTAS_DE_LEADS } from './adaptadores/leads.ts';
import { HERRAMIENTAS_DEL_SETTER } from './adaptadores/setter.ts';
import { HERRAMIENTAS_DEL_CLOSER } from './adaptadores/closer.ts';
import { HERRAMIENTAS_DE_TOOLS } from './adaptadores/tools.ts';
import { HERRAMIENTAS_DE_FUNDACIONES } from './adaptadores/fundaciones.ts';
import { HERRAMIENTAS_DE_LA_PLATAFORMA } from './adaptadores/plataforma.ts';
import { type ContextoDeHerramienta, type DefinicionDeHerramienta, periodoPedido } from './adaptadores/comun.ts';

export type { ContextoDeHerramienta, DatosDeLaRuta, DefinicionDeHerramienta } from './adaptadores/comun.ts';

/**
 * El catálogo entero. Las llamadas de venta y de onboarding (Analizadores) llegan en AG11, y las señales
 * abiertas con los detectores (AG8).
 */
export const HERRAMIENTAS: readonly DefinicionDeHerramienta[] = [
  ...HERRAMIENTAS_DE_ACQUISITION,
  ...HERRAMIENTAS_DE_CREATIVE,
  ...HERRAMIENTAS_DE_CONVERSION,
  ...HERRAMIENTAS_DE_CONVERSATION,
  ...HERRAMIENTAS_DE_SALES,
  ...HERRAMIENTAS_DE_LEADS,
  ...HERRAMIENTAS_DEL_SETTER,
  ...HERRAMIENTAS_DEL_CLOSER,
  ...HERRAMIENTAS_DE_TOOLS,
  ...HERRAMIENTAS_DE_FUNDACIONES,
  ...HERRAMIENTAS_DE_LA_PLATAFORMA,
];

/**
 * Las herramientas que se le ofrecen a quien ve esas secciones. Con la caja del pie, las de la sección
 * abierta van primero. `conIntegraciones`: si la ruta resolvió el estado de las integraciones, o sea si
 * quien pregunta tiene `credenciales.ver`.
 */
export function herramientasPara(
  seccionesVisibles: readonly string[],
  seccionAbierta: string | null = null,
  conIntegraciones = false,
): DefinicionDeHerramienta[] {
  const visibles = new Set(seccionesVisibles);
  const ofrecidas = HERRAMIENTAS.filter((h) =>
    h.requiere === 'integraciones'
      ? conIntegraciones
      : h.todas
        ? h.secciones.every((s) => visibles.has(s))
        : h.secciones.some((s) => visibles.has(s)),
  );
  if (seccionAbierta === null) return ofrecidas;
  const deLaAbierta = (h: DefinicionDeHerramienta) => (h.secciones.includes(seccionAbierta) ? 0 : 1);
  return [...ofrecidas].sort((a, b) => deLaAbierta(a) - deLaAbierta(b));
}

/** Lo que viaja al modelo de cada herramienta ofrecida. */
export function paraElModelo(h: DefinicionDeHerramienta): HerramientaDelModelo {
  return { nombre: h.nombre, descripcion: h.descripcion, esquema: h.esquema };
}

export type ResultadoDeHerramienta = { tipo: 'datos'; datos: unknown } | { tipo: 'error'; mensaje: string };

/**
 * Corre una herramienta pedida por el modelo, si se le ofreció. Un nombre inventado o uno que esta persona
 * no tiene se rechaza con un error que el modelo lee: no existe para él.
 */
export async function ejecutarHerramienta(
  nombre: string,
  argumentos: unknown,
  ofrecidas: readonly DefinicionDeHerramienta[],
  contexto: ContextoDeHerramienta,
): Promise<ResultadoDeHerramienta> {
  const h = ofrecidas.find((o) => o.nombre === nombre);
  if (!h) return { tipo: 'error', mensaje: `No hay ninguna herramienta «${nombre}». Usa sólo las que se te ofrecieron.` };
  const args = argumentos !== null && typeof argumentos === 'object' && !Array.isArray(argumentos) ? (argumentos as Record<string, unknown>) : {};
  if ('periodo' in (h.esquema.properties as object) && periodoPedido(args) === null) {
    return { tipo: 'error', mensaje: 'Ese período no existe: usa hoy, 7d, 30d o completo.' };
  }
  return { tipo: 'datos', datos: await h.ejecutar(args, contexto) };
}
