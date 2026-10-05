// La forma de la respuesta del cerebro y su validación contra lo que leyó.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ SE VALIDA LO QUE YA PIDE UN ESQUEMA
//
// `responder` sale con `strict: true`: el proveedor garantiza la FORMA. No garantiza que lo que dice sea
// cierto. Un modelo puede escribir un número plausible y falso con la forma perfecta, y eso es lo peor que
// le puede pasar a una pantalla de cifras (`docs/OTROS/agentes/03-EL-CEREBRO.md`, AG-47). Así que cada cifra
// dice de qué evidencia sale (`ev`), y el servidor comprueba que esa evidencia exista y que el número
// aparezca en ella. **La que no pasa se quita**, y la respuesta lo dice. Es el patrón de la ficha del
// prospecto (`lib/analizadores/nucleo/prospect-card.ts`): lo detectado sin cita se degrada.
//
// Cada cifra cita además el CAMPO de la evidencia de donde sale, y se compara contra ese valor y no contra
// cualquier número de la evidencia. El texto libre también se mira: un número de la conclusión o de una
// recomendación tiene que estar entre las cifras respaldadas. La recomendación que no cumple se quita; la
// conclusión no se puede quitar, así que se dice y la confianza baja.
//
// Lo mismo para las recomendaciones (cada una cita al menos una evidencia), las áreas y los siguientes
// pasos (sólo secciones que la persona ve), y las acciones: la v1 lee y navega (`D-03`), y una acción se
// rechaza aunque el esquema la dejara pasar (`AG-12` de `01`).
//
// La evidencia la arma el adaptador de cada herramienta, no el modelo: es lo que la herramienta devolvió.
// ═══════════════════════════════════════════════════════════════════════════════

import type { HerramientaDelModelo } from '../llamada.ts';

/** Lo que devolvió una herramienta, con el identificador que el modelo cita. */
export interface Evidencia {
  /** `ev-1`, `ev-2`… en el orden en que se leyeron. */
  id: string;
  herramienta: string;
  argumentos: Record<string, unknown>;
  /** La proyección por lista blanca del adaptador (`AG-45`). */
  datos: unknown;
}

export interface CifraDelCerebro {
  valor: number;
  que_es: string;
  muestra: string;
  periodo: string;
  fuente: string;
  ev: string;
  /** La ruta del número dentro de la evidencia: `total.inversion`, `eslabones[1].contactos`. */
  campo: string;
}

export interface RespuestaDelCerebro {
  conclusion: string;
  cifras: CifraDelCerebro[];
  confianza: { nivel: 'alta' | 'media' | 'baja'; porque: string };
  areas: string[];
  recomendaciones: { texto: string; requiere_validacion_ejecutiva: boolean; ev: string[] }[];
  no_hay_dato: { falta: string; donde_se_carga: string }[];
  siguientes: { tipo: 'abrir'; seccion: string; pestana: string | null; contexto: string | null }[];
}

/** La respuesta que pasó la validación, con lo que se le quitó dicho en `avisos`. */
export interface RespuestaValidada extends RespuestaDelCerebro {
  avisos: string[];
}

export const NOMBRE_DE_RESPONDER = 'responder';

/* Los esquemas no llevan `minLength`, `maxLength`, `minimum`, `maximum` ni restricciones de arreglos: el
   modo estricto no las admite y el proveedor contesta 400 (ver el encabezado de `../llamada.ts`). Cada
   objeto lleva `additionalProperties: false` y todas sus claves en `required`; lo opcional es `null`. */
const TEXTO = { type: 'string' } as const;
// Lo que puede faltar va como `anyOf` con `null`: el modo estricto lo documenta así, y un arreglo de tipos
// no está en su lista.
const TEXTO_O_NULO = { anyOf: [{ type: 'string' }, { type: 'null' }] } as const;

/** La herramienta con la que el cerebro contesta. Se ofrece con las demás; el prompt pide usarla al final. */
export const RESPONDER: HerramientaDelModelo = {
  nombre: NOMBRE_DE_RESPONDER,
  descripcion:
    'Entrega la respuesta final a la persona. Úsala UNA vez, al final, cuando ya leíste lo que necesitabas. ' +
    'Cada cifra cita la evidencia (ev-1, ev-2…) y el campo exacto de donde sale; una cifra que no está en ese ' +
    'campo se quita. Todo número de la conclusión y de las recomendaciones tiene que estar entre las cifras.',
  // La única estricta del cerebro: el proveedor garantiza la forma, y la validación de abajo, el contenido.
  estricta: true,
  esquema: {
    type: 'object',
    additionalProperties: false,
    required: ['conclusion', 'cifras', 'confianza', 'areas', 'recomendaciones', 'no_hay_dato', 'siguientes'],
    properties: {
      conclusion: { ...TEXTO, description: 'Una o dos frases: la respuesta primero.' },
      cifras: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['valor', 'que_es', 'muestra', 'periodo', 'fuente', 'ev', 'campo'],
          properties: {
            valor: { type: 'number', description: 'El número tal como está en la evidencia.' },
            que_es: TEXTO,
            muestra: { ...TEXTO, description: 'Sobre cuántos: «46 citas pasadas».' },
            periodo: TEXTO,
            fuente: { ...TEXTO, description: 'La pantalla de donde sale.' },
            ev: { ...TEXTO, description: 'El identificador de la evidencia: ev-1, ev-2…' },
            campo: {
              ...TEXTO,
              description: 'La ruta del número dentro de esa evidencia, como total.inversion o eslabones[1].contactos.',
            },
          },
        },
      },
      confianza: {
        type: 'object',
        additionalProperties: false,
        required: ['nivel', 'porque'],
        properties: { nivel: { type: 'string', enum: ['alta', 'media', 'baja'] }, porque: TEXTO },
      },
      areas: { type: 'array', items: { ...TEXTO, description: 'La clave de una sección de donde salió.' } },
      recomendaciones: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['texto', 'requiere_validacion_ejecutiva', 'ev'],
          properties: {
            texto: TEXTO,
            requiere_validacion_ejecutiva: {
              type: 'boolean',
              description: 'true si toca presupuesto o algo que decide la dirección.',
            },
            ev: { type: 'array', items: TEXTO },
          },
        },
      },
      no_hay_dato: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['falta', 'donde_se_carga'],
          properties: { falta: TEXTO, donde_se_carga: TEXTO },
        },
      },
      siguientes: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['tipo', 'seccion', 'pestana', 'contexto'],
          properties: {
            tipo: { type: 'string', enum: ['abrir'] },
            seccion: { ...TEXTO, description: 'La clave de la sección que conviene abrir.' },
            pestana: TEXTO_O_NULO,
            contexto: TEXTO_O_NULO,
          },
        },
      },
    },
  },
};

// ─── La validación ──────────────────────────────────────────────────────────

/**
 * El valor en esa ruta de la evidencia: `total.inversion`, `eslabones[1].contactos`,
 * `campanas.filas[0].cifras.inversion`. `undefined` si la ruta no existe.
 */
export function valorEn(datos: unknown, campo: string): unknown {
  const partes = campo.replace(/\[(\d+)\]/g, '.$1').split('.').filter((p) => p !== '');
  let v: unknown = datos;
  for (const p of partes) {
    if (v === null || typeof v !== 'object') return undefined;
    v = (v as Record<string, unknown>)[p];
  }
  return v;
}

/**
 * El campo que la cifra cita, como ruta dentro de `datos`. Al modelo cada resultado le llega envuelto,
 * `{ev, datos: {...}}` (`preguntar.ts`), así que escribir `datos.total.inversion` es tan natural como
 * `total.inversion`: en la segunda evaluación real (2026-10-05) casi todas las cifras quitadas eran
 * correctas y venían con ese prefijo. Primero la ruta tal cual —por si la evidencia tiene su propio `datos`—
 * y, si no existe, sin el prefijo. Nada más se perdona: la cifra sigue comparándose con UN campo.
 */
export function campoCitado(datos: unknown, campo: string): string {
  if (valorEn(datos, campo) !== undefined || !campo.startsWith('datos.')) return campo;
  return campo.slice('datos.'.length);
}

/** Las formas en que se puede escribir un número: tal cual, redondeado, y como porcentaje si es una proporción. */
function formas(x: number): number[] {
  const redondeos = (y: number) => [y, Math.round(y), Math.round(y * 10) / 10, Math.round(y * 100) / 100];
  return Math.abs(x) <= 1 ? [...redondeos(x), ...redondeos(x * 100)] : redondeos(x);
}

const igual = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));

/**
 * ¿El número es el que está en ese campo de la evidencia? Tal cual, redondeado a entero, a un decimal o a
 * dos, y —sólo si el campo es una proporción— como porcentaje: «29,3 %» de un 0,2927, «41» de un 41,01.
 *
 * Contra el CAMPO que la cifra cita y no contra cualquier número de la evidencia: la primera versión
 * buscaba en toda la evidencia, que siempre trae `dias`, `piso`, totales y puntajes de 0 a 100, y casi
 * cualquier número inventado encontraba con quién coincidir (lo encontró la revisión de AG5).
 */
export function respaldada(valor: number, enElCampo: unknown): boolean {
  if (!Number.isFinite(valor) || typeof enElCampo !== 'number' || !Number.isFinite(enElCampo)) return false;
  return formas(enElCampo).some((f) => igual(valor, f));
}

/**
 * Las fechas escritas con el mes: «4 oct», «21–27 sep», «5 de octubre». La segunda evaluación real
 * (2026-10-05) marcó como dudosa una conclusión por «la semana anterior (21–27 sep)»: los días no son cifras.
 */
// El mes entero o su abreviatura y nada más: con un prefijo suelto, «3 marcas» o «10 mayores» dejarían de
// contarse como cifras.
const FECHA_CON_MES =
  /\d{1,2}(?:\s*[–-]\s*\d{1,2})?\s+(?:de\s+)?(?:ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sept?(?:iembre)?|set(?:iembre)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?)(?![a-záéíóúñ])\.?/gi;

/**
 * Los números de un texto escrito en español: «4.060» es cuatro mil sesenta, «29,3» es veintinueve coma
 * tres. Las fechas (`2026-10-04`, «4 oct») y las horas no cuentan como cifras.
 */
export function numerosDelTexto(texto: string): number[] {
  const sinFechas = texto.replace(/\d{4}-\d{2}-\d{2}/g, ' ').replace(FECHA_CON_MES, ' ').replace(/\d{1,2}:\d{2}/g, ' ');
  const salida: number[] = [];
  for (const m of sinFechas.matchAll(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?/g)) {
    const crudo = m[0];
    const n = /^\d{1,3}(\.\d{3})+/.test(crudo) ? Number(crudo.replace(/\./g, '').replace(',', '.')) : Number(crudo.replace(',', '.'));
    if (Number.isFinite(n)) salida.push(n);
  }
  return salida;
}

/** Los largos de ventana que se nombran en texto («los últimos 30 días») y los años: no son cifras del negocio. */
const NUMEROS_QUE_NO_SON_CIFRAS: readonly number[] = [1, 7, 14, 30, 60, 90];
const esAnio = (n: number) => Number.isInteger(n) && n >= 1900 && n <= 2100;

const esTexto = (v: unknown): v is string => typeof v === 'string';
const esArreglo = (v: unknown): v is unknown[] => Array.isArray(v);
const esObjeto = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Lo que la validación quitó o no pudo respaldar, tal como lo escribió el modelo, con lo que había en el campo
 * que citó. No se guarda ni va a la pantalla —la pantalla ya lo dice en los avisos—: es para la evaluación
 * (`scripts/evaluar-agentes.mjs`), que sin esto sólo sabría cuántas se quitaron y no por qué.
 */
export interface LoQuitado {
  cifras: { valor: unknown; ev: unknown; campo: unknown; enElCampo: unknown }[];
  /** Los números de la conclusión que no son cifras respaldadas. */
  enLaConclusion: number[];
}

export type ResultadoDeLaValidacion =
  | { tipo: 'valida'; respuesta: RespuestaValidada; quitado: LoQuitado }
  | { tipo: 'invalida'; motivo: string };

/**
 * Valida lo que el modelo mandó en `responder` contra la evidencia de esta pregunta y las secciones que la
 * persona ve. Lo que no se sostiene se quita y se dice; lo que no tiene la forma, invalida la respuesta
 * entera (`IA-ESTRUCTURA`).
 */
export function validarRespuesta(
  entrada: unknown,
  evidencias: readonly Evidencia[],
  seccionesVisibles: readonly string[],
): ResultadoDeLaValidacion {
  if (!esObjeto(entrada)) return { tipo: 'invalida', motivo: 'la respuesta no es un objeto' };
  const { conclusion, cifras, confianza, areas, recomendaciones, no_hay_dato, siguientes } = entrada;
  if (!esTexto(conclusion) || conclusion.trim() === '') return { tipo: 'invalida', motivo: 'sin conclusión' };
  if (![cifras, areas, recomendaciones, no_hay_dato, siguientes].every(esArreglo)) {
    return { tipo: 'invalida', motivo: 'falta una lista' };
  }
  const porId = new Map(evidencias.map((e) => [e.id, e]));
  const avisos: string[] = [];

  // ── Las cifras: cada una contra el campo que cita ──────────────────────────
  const cifrasValidas: CifraDelCerebro[] = [];
  const quitado: LoQuitado = { cifras: [], enLaConclusion: [] };
  let sinRespaldo = 0;
  for (const c of cifras as unknown[]) {
    const ev = esObjeto(c) && esTexto(c.ev) ? porId.get(c.ev) : undefined;
    const campo = ev && esObjeto(c) && esTexto(c.campo) ? campoCitado(ev.datos, c.campo) : undefined;
    if (!esObjeto(c) || typeof c.valor !== 'number' || !ev || campo === undefined || !respaldada(c.valor, valorEn(ev.datos, campo))) {
      sinRespaldo += 1;
      quitado.cifras.push(
        esObjeto(c)
          ? { valor: c.valor, ev: c.ev, campo: c.campo, enElCampo: ev && campo !== undefined ? valorEn(ev.datos, campo) : undefined }
          : { valor: c, ev: undefined, campo: undefined, enElCampo: undefined },
      );
      continue;
    }
    cifrasValidas.push({
      valor: c.valor,
      que_es: esTexto(c.que_es) ? c.que_es : '',
      muestra: esTexto(c.muestra) ? c.muestra : '',
      periodo: esTexto(c.periodo) ? c.periodo : '',
      fuente: esTexto(c.fuente) ? c.fuente : '',
      ev: ev.id,
      // Se guarda la ruta que se comprobó, sin el prefijo: la que existe en la evidencia guardada.
      campo,
    });
  }
  if (sinRespaldo > 0) {
    avisos.push(
      sinRespaldo === 1
        ? 'Se quitó una cifra que no estaba en lo que leyó el cerebro.'
        : `Se quitaron ${sinRespaldo} cifras que no estaban en lo que leyó el cerebro.`,
    );
  }

  /** Los números de este texto que no son cifras respaldadas (ni largos de ventana, ni años). */
  const sinRespaldoEn = (texto: string) =>
    numerosDelTexto(texto).filter(
      (n) => !(NUMEROS_QUE_NO_SON_CIFRAS.includes(n) || esAnio(n) || cifrasValidas.some((c) => formas(c.valor).some((f) => igual(n, f)))),
    );
  const respaldados = (texto: string) => sinRespaldoEn(texto).length === 0;

  // ── Las recomendaciones: citan lo leído, y sus números son cifras respaldadas ──
  const recomendacionesValidas: RespuestaDelCerebro['recomendaciones'] = [];
  let recomendacionesQuitadas = 0;
  for (const r of recomendaciones as unknown[]) {
    const evs = esObjeto(r) && esArreglo(r.ev) ? r.ev.filter((e): e is string => esTexto(e) && porId.has(e)) : [];
    if (!esObjeto(r) || !esTexto(r.texto) || evs.length === 0 || !respaldados(r.texto)) {
      recomendacionesQuitadas += 1;
      continue;
    }
    recomendacionesValidas.push({ texto: r.texto, requiere_validacion_ejecutiva: r.requiere_validacion_ejecutiva === true, ev: evs });
  }
  if (recomendacionesQuitadas > 0) {
    avisos.push(
      recomendacionesQuitadas === 1
        ? 'Se quitó una recomendación que no se sostenía en lo que leyó el cerebro.'
        : `Se quitaron ${recomendacionesQuitadas} recomendaciones que no se sostenían en lo que leyó el cerebro.`,
    );
  }

  // ── La conclusión: no se puede quitar, pero se dice y baja la confianza ──────
  quitado.enLaConclusion = sinRespaldoEn(conclusion);
  const conclusionRespaldada = quitado.enLaConclusion.length === 0;
  if (!conclusionRespaldada) avisos.push('La conclusión menciona un número que no está entre las cifras respaldadas: tómala con cuidado.');

  const visibles = new Set(seccionesVisibles);
  const siguientesValidos: RespuestaDelCerebro['siguientes'] = [];
  for (const p of siguientes as unknown[]) {
    if (!esObjeto(p)) continue;
    // `D-03`: la v1 lee y navega. Una acción no se ofrece aunque llegue con la forma correcta.
    if (p.tipo === 'accion') {
      avisos.push('El cerebro propuso una acción: todavía sólo lee y te lleva a la pantalla donde se hace.');
      continue;
    }
    if (p.tipo !== 'abrir' || !esTexto(p.seccion) || !visibles.has(p.seccion)) continue;
    siguientesValidos.push({
      tipo: 'abrir',
      seccion: p.seccion,
      pestana: esTexto(p.pestana) ? p.pestana : null,
      contexto: esTexto(p.contexto) ? p.contexto : null,
    });
  }

  const nivel = esObjeto(confianza) && ['alta', 'media', 'baja'].includes(confianza.nivel as string) ? (confianza.nivel as 'alta' | 'media' | 'baja') : 'baja';
  // Con algo quitado, la confianza no puede seguir siendo alta; con la conclusión sin respaldo, es baja.
  const nivelFinal = !conclusionRespaldada ? 'baja' : (sinRespaldo > 0 || recomendacionesQuitadas > 0) && nivel === 'alta' ? 'media' : nivel;
  return {
    tipo: 'valida',
    respuesta: {
      conclusion: conclusion.trim(),
      cifras: cifrasValidas,
      confianza: { nivel: nivelFinal, porque: esObjeto(confianza) && esTexto(confianza.porque) ? confianza.porque : '' },
      areas: (areas as unknown[]).filter((a): a is string => esTexto(a) && visibles.has(a)),
      recomendaciones: recomendacionesValidas,
      no_hay_dato: (no_hay_dato as unknown[])
        .filter(esObjeto)
        .filter((n) => esTexto(n.falta))
        .map((n) => ({ falta: n.falta as string, donde_se_carga: esTexto(n.donde_se_carga) ? n.donde_se_carga : '' })),
      siguientes: siguientesValidos,
      avisos,
    },
    quitado,
  };
}
