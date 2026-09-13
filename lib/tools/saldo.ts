// El saldo de leads de la organización, como lo ve la empresa.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL HUECO QUE ESTO CIERRA
//
// Kevin, logueado como Allpa (2026-09-13): *«quisiera saber si las empresas tienen dónde ver cuántos
// leads les queda para scrapear, cuántos leads les habíamos regalado»*. No tenían. El monedero
// existía desde la 006 y solo lo veía Monitoreo; la empresa se enteraba de su saldo cuando el
// backend le rechazaba una corrida. Le regalamos 500, Research le descuenta hasta 200 por mirada,
// y no había un número en pantalla.
//
// ── EL DESGLOSE SALE DEL MONEDERO, Y DE NADA MÁS ─────────────────────────────
//
// La tabla guarda lo que QUEDA (gratuitos, pagados), lo que se USÓ (histórico) y lo que se REGALÓ
// (`leads_regalados`, migración 018). Con eso el desglose es aritmética, y la misma acá y en la
// tarjeta del Research. Se consume primero lo gratis, así que lo usado de lo comprado es lo que el
// histórico excede al regalo consumido.
// ═══════════════════════════════════════════════════════════════════════════════

import { pedir } from '../http/cliente.ts';
import { MINIMO_LEADS_MAPS } from './scrapers.ts';

/** Una fila del monedero, con los nombres de la tabla. */
export interface FilaDeMonedero {
  numero_leads_scrapeados: number;
  leads_base_gratuitos: number;
  leads_adicionales_pagados: number;
  leads_disponibles_en_total: number;
  leads_regalados: number;
  sin_limite: boolean;
}

export interface SaldoDeLeads {
  /** Lo que se puede gastar ahora. */
  disponibles: number;
  /** Cuánto se regaló en total. Es la cifra «de regalo». */
  regalados: number;
  /** Cuánto se scrapeó en total, de lo que fuera. */
  usados: number;
  /** Cuánto se compró en total: lo que queda de pagados más lo pagado que ya se consumió. */
  comprados: number;
  /** Cómo está: para la franja. `bajo` = no alcanza para una búsqueda de Maps. */
  estado: 'normal' | 'bajo' | 'agotado' | 'sin_limite';
}

/** El desglose. Aritmética pura, para que la franja y la tarjeta digan lo mismo. */
export function desglosarSaldo(m: FilaDeMonedero): SaldoDeLeads {
  const usados = Math.max(0, Number(m.numero_leads_scrapeados) || 0);
  const gratuitos = Math.max(0, Number(m.leads_base_gratuitos) || 0);
  const pagados = Math.max(0, Number(m.leads_adicionales_pagados) || 0);
  const regalados = Math.max(gratuitos, Number(m.leads_regalados) || 0);
  const disponibles = Math.max(0, Number(m.leads_disponibles_en_total) || gratuitos + pagados);
  // Lo gratis se consume primero: lo consumido de lo comprado es lo que sobra del histórico.
  const regaloConsumido = regalados - gratuitos;
  const compradosConsumidos = Math.max(0, usados - regaloConsumido);
  const estado: SaldoDeLeads['estado'] = m.sin_limite
    ? 'sin_limite'
    : disponibles <= 0
      ? 'agotado'
      : disponibles < MINIMO_LEADS_MAPS
        ? 'bajo'
        : 'normal';
  return { disponibles, regalados, usados, comprados: pagados + compradosConsumidos, estado };
}

export type ResultadoDeSaldo =
  | { tipo: 'datos'; saldo: SaldoDeLeads }
  /** La organización todavía no abrió su monedero: se abre en el primer scraping. No es un error. */
  | { tipo: 'sin_monedero' }
  | { tipo: 'fallo'; mensaje: string };

/** El saldo de la organización de la sesión, desde la ruta de Tools. */
export async function leerSaldo(): Promise<ResultadoDeSaldo> {
  const r = await pedir<{ saldo: SaldoDeLeads | null }>('/api/tools/saldo');
  if (r.tipo === 'datos') return r.datos.saldo ? { tipo: 'datos', saldo: r.datos.saldo } : { tipo: 'sin_monedero' };
  if (r.tipo === 'rechazado') return { tipo: 'fallo', mensaje: r.detalle ?? 'No se pudo leer el saldo.' };
  return { tipo: 'fallo', mensaje: 'No se pudo leer el saldo.' };
}
