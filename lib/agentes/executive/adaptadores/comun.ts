// Lo que comparten los adaptadores del cerebro: el contexto, la forma de una herramienta y las piezas de
// las proyecciones. Aparte de `../herramientas.ts` para que los adaptadores no importen el catálogo que los
// importa a ellos.

import type { PorQueNoAudita } from '../../../auditor/pantalla.ts';
import type { CredencialVisible } from '../../../credenciales/resolver.ts';
import { PERIODOS, periodoDe } from '../../../negocio/periodo.ts';

/** El estado de cada integración, sin valores: lo que `resolverCredenciales` dice de cada una. */
export type EstadoDeLasIntegraciones = Record<'crm' | 'ia' | 'pagos' | 'tldv' | 'meta', Pick<CredencialVisible, 'cargado' | 'estado'>>;

/**
 * Lo que la ruta resolvió en identidad y viaja como dato (`T-03`): nada bajo `lib/agentes/` abre esa
 * conexión. Cada campo se resuelve sólo si hace falta, y su ausencia se escribe como `null`.
 */
export interface DatosDeLaRuta {
  /**
   * Por qué el auditor no audita, como lo ve su pantalla (`app/api/auditoria/route.ts`). `null` = audita,
   * o quien pregunta no ve Conversation (y entonces la herramienta que lo usa no se le ofrece).
   */
  noAudita: PorQueNoAudita | null;
  /** El estado de las integraciones. `null` = quien pregunta no tiene `credenciales.ver`. */
  integraciones: EstadoDeLasIntegraciones | null;
}

/** Sin nada resuelto: lo que recibe quien no ve Conversation ni tiene `credenciales.ver`. */
export const SIN_DATOS_DE_LA_RUTA: DatosDeLaRuta = { noAudita: null, integraciones: null };

/** Lo que una herramienta necesita saber de quién pregunta. Nada de identidad: eso se resolvió en la ruta. */
export interface ContextoDeHerramienta {
  /** La zona de la empresa: cuándo termina su día. */
  zona: string;
  usuarioId: string;
  /** Las claves de las secciones que ve: `frescura` sólo habla de lo que alimenta a esas. */
  secciones: readonly string[];
  deLaRuta: DatosDeLaRuta;
}

export interface DefinicionDeHerramienta {
  nombre: string;
  descripcion: string;
  /** Las secciones que la habilitan: con cualquiera de ellas, o con todas si `todas`. */
  secciones: readonly string[];
  todas?: boolean;
  /**
   * Lo que además tiene que haber resuelto la ruta. `integraciones` no es de ninguna sección: se ofrece
   * sólo a quien tiene `credenciales.ver`, que es cuando la ruta lo resuelve.
   */
  requiere?: 'integraciones';
  /** JSON Schema estricto de los argumentos. */
  esquema: Record<string, unknown>;
  /** Corre dentro de la `conOrganizacion` que abre quien llama. Devuelve la proyección. */
  ejecutar: (argumentos: Record<string, unknown>, contexto: ContextoDeHerramienta) => Promise<unknown>;
}

/** El argumento `periodo` de las herramientas que lo usan: las cuatro claves, nada más. */
export const ARGUMENTO_PERIODO = {
  type: 'object',
  additionalProperties: false,
  required: ['periodo'],
  properties: {
    periodo: {
      type: 'string',
      enum: PERIODOS.map((p) => p.clave),
      description: 'hoy (las últimas 24 horas), 7d o 30d (días cerrados), completo (toda la historia).',
    },
  },
} as const;

/** Sin argumentos: un objeto vacío, que el modo estricto exige igual. */
export const SIN_ARGUMENTOS = { type: 'object', additionalProperties: false, required: [], properties: {} } as const;

/** El período pedido, o `null` si no es una de las cuatro claves. */
export function periodoPedido(argumentos: Record<string, unknown>) {
  return typeof argumentos.periodo === 'string' ? periodoDe(argumentos.periodo) : null;
}

/** Las primeras `n` filas de una lista, con cuántas había. «Mostrando X de N» (A7-29). */
export function primeras<T>(lista: readonly T[], n = 20): { filas: T[]; total: number } {
  return { filas: lista.slice(0, n), total: lista.length };
}

/** Exactamente esas claves del objeto, y ninguna otra. La lista blanca de `AG-45`. */
export function tomar<T extends object, K extends keyof T>(objeto: T, claves: readonly K[]): Pick<T, K> {
  const salida = {} as Pick<T, K>;
  for (const k of claves) salida[k] = objeto[k];
  return salida;
}

/** Cuántas filas tiene cada cola, sin las filas: las filas llevan nombres, teléfonos y mensajes. */
export function cuantos<T extends object>(colas: T, claves: readonly (keyof T)[]): Record<string, number> {
  return Object.fromEntries(claves.map((k) => [k, (colas[k] as readonly unknown[]).length]));
}

/**
 * Un texto libre recortado y sin datos de contacto. Para los pocos textos que viajan (el análisis del Espía,
 * los extractos de ICP & Oferta), que escribió un modelo o una persona y pueden traer un contacto copiado de
 * un anuncio o de una ficha.
 *
 *   · Un correo se vuelve «[correo]», y un usuario de una red (`@algo`) se vuelve «[usuario]» entero: la
 *     primera versión cambiaba sólo el símbolo, y el usuario viajaba (lo encontró la revisión de AG6).
 *   · Toda tira de siete dígitos o más se toma por teléfono, salvo las que se leen sin dudas como otra cosa
 *     (`esOtraCosa`). Ante la duda, se borra: perder un número de un análisis cuesta menos que mandar un
 *     teléfono al modelo. Por eso «12345678 visitas» o «1 500 000» sin moneda también se borran.
 */
export function sinDatosDeContacto(texto: string, largo: number): { texto: string; recortado: boolean } {
  const limpio = texto
    .replace(/[^\s@<>()[\]{}"']+@[^\s@<>()[\]{}"']+\.[a-z]{2,}/gi, '[correo]')
    .replace(/@[\p{L}\p{N}_.]+/gu, '[usuario]')
    .replace(/@/g, '')
    .replace(/\+?\(?\d[\d\s().-]{5,}\d/g, (tira, desde: number, todo: string) => {
      const antes = todo.slice(Math.max(0, desde - 6), desde);
      // Un rango («1.500.000 - 2.000.000», «2019-2024») se mira por partes, pero sólo si TODAS sus partes son
      // un año o un monto con miles: «(01) 234-5678» partido son dos pedazos cortos, y junto es un teléfono.
      const partes = tira.split(/(\s*-\s*)/);
      if (partes.length > 1 && partes.every((p, i) => i % 2 === 1 || esUnaParteDeRango(p))) return tira;
      return digitos(tira) >= 7 && !esOtraCosa(tira, antes) ? '[teléfono]' : tira;
    });
  return limpio.length > largo ? { texto: `${limpio.slice(0, largo)}…`, recortado: true } : { texto: limpio, recortado: false };
}

const digitos = (t: string) => t.replace(/\D/g, '').length;

/** Una moneda justo antes de la tira: lo que la convierte en un monto aunque tenga forma de teléfono. */
const MONEDA = /(S\/|US\$|\$|USD|PEN|EUR|€|soles|dólares)\s*$/i;

/**
 * ¿Esta tira es, sin dudas, otra cosa que un teléfono? Una fecha (`2026-10-04`, `04-10-2026`, `04.10.2026`),
 * un año suelto o un número de menos de siete dígitos, un monto con moneda delante (`S/ 1.500.000`,
 * `$ 1 500 000`), o uno con los miles separados por puntos y el primer grupo de una o dos cifras
 * (`1.500.000`, `15.000.000`). `987.654.321`, con el primer grupo de tres, es la forma de un móvil, y se borra.
 */
function esOtraCosa(tira: string, antes: string): boolean {
  const t = tira.trim();
  if (digitos(t) < 7) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t) || /^\d{2}[-.]\d{2}[-.]\d{4}$/.test(t)) return true;
  if (MONEDA.test(antes) && /^\d{1,3}([. ]\d{3})+$|^\d+$/.test(t)) return true;
  return /^\d{1,2}(\.\d{3})+$/.test(t);
}

/** Un pedazo de un rango que se lee sin dudas: un año (`2019`) o un monto con miles (`1.500.000`). */
const esUnaParteDeRango = (p: string) => /^(19|20)\d{2}$/.test(p.trim()) || /^\d{1,2}(\.\d{3})+$/.test(p.trim());
