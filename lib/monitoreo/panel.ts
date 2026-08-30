// El lado del navegador del Panel de Monitoreo: pedir la foto y bajarla como CSV.

import { pedir } from '../http/cliente.ts';
import { FUENTES, NOMBRE_DE_FUENTE, type FilaDelPanel } from './fuentes.ts';

const RUTA = '/api/monitoreo';

export type ResultadoDelPanel =
  | { tipo: 'datos'; empresas: readonly FilaDelPanel[] }
  | { tipo: 'fallo'; mensaje: string };

/** La foto entera: todas las empresas con su consumo. */
export async function leerPanel(): Promise<ResultadoDelPanel> {
  const r = await pedir<{ empresas: FilaDelPanel[] }>(RUTA);
  if (r.tipo === 'datos') return { tipo: 'datos', empresas: r.datos.empresas };
  if (r.tipo === 'rechazado') {
    return { tipo: 'fallo', mensaje: r.detalle || 'No se pudo leer el Panel de Monitoreo.' };
  }
  return { tipo: 'fallo', mensaje: 'No se pudo conectar para leer el Panel de Monitoreo.' };
}

/** Los totales de la tabla, calculados una vez para el encabezado y el pie. */
export function totales(empresas: readonly FilaDelPanel[]) {
  const porFuente: Record<string, number> = Object.fromEntries(FUENTES.map((f) => [f, 0]));
  let scrapeos = 0;
  let leads = 0;
  for (const e of empresas) {
    scrapeos += e.scrapeos;
    leads += e.leads;
    for (const f of FUENTES) porFuente[f] = (porFuente[f] ?? 0) + (e.porFuente[f] ?? 0);
  }
  return {
    empresas: empresas.length,
    /* Las que scrapearon alguna vez. Es el número que dice si la herramienta se está usando —
       «diez empresas» y «tres empresas que scrapearon» son dos hechos distintos, y el segundo es
       el que hace falta para decidir a quién llamar. */
    activas: empresas.filter((e) => e.scrapeos > 0).length,
    /* Las que no se pudieron leer. Si es mayor que cero, ninguno de los otros números de arriba
       es un total: le faltan esas empresas. La pantalla lo dice en vez de mostrarlos a secas. */
    ilegibles: empresas.filter((e) => e.ilegible).length,
    scrapeos,
    leads,
    porFuente,
  };
}

/** Un número como se lee en Perú, o un guion cuando no hay dato. */
export function num(n: number | null | undefined): string {
  return typeof n === 'number' ? n.toLocaleString('es-PE') : '—';
}

/**
 * La tabla como CSV.
 *
 * Cada campo va entre comillas SIEMPRE y las comillas internas se duplican, por el mismo motivo
 * que en `lib/tools/leads.ts`: un nombre de empresa con una coma parte la fila en dos columnas y
 * desplaza todo el resto de la línea.
 *
 * Una empresa `ilegible` NO sale con ceros: sale con la palabra «sin leer» en cada número. Un CSV
 * es justo donde el cero silencioso hace más daño — se abre en una hoja de cálculo, se suma, y el
 * total afirma algo que nadie midió.
 */
export function aCsv(empresas: readonly FilaDelPanel[]): string {
  const escapar = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const cabecera = [
    'Empresa',
    'Identificador',
    'Activa',
    'Scrapeos',
    'Completados',
    ...FUENTES.map((f) => NOMBRE_DE_FUENTE[f] ?? f),
    'Leads guardados',
    'Leads disponibles',
  ];
  const cuerpo = empresas.map((e) => {
    const dato = (n: number | null) => escapar(e.ilegible ? 'sin leer' : (n ?? '—'));
    return [
      escapar(e.nombre),
      escapar(e.slug),
      escapar(e.activa ? 'sí' : 'no'),
      dato(e.scrapeos),
      dato(e.completados),
      ...FUENTES.map((f) => dato(e.porFuente[f] ?? 0)),
      dato(e.leads),
      dato(e.saldo?.disponibles ?? null),
    ].join(',');
  });
  return [cabecera.map(escapar).join(','), ...cuerpo].join('\n');
}
