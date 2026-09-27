// La búsqueda, el filtro de tramo y el de etapa de la rejilla de Leads Portal. En el navegador.
//
// ═══════════════════════════════════════════════════════════════════════════════
// SE FILTRA EN LA PANTALLA PORQUE LA PANTALLA TIENE TODO
//
// La cohorte viaja entera —286 personas a 30 días y 569 en «Completo», medido el 2026-09-27—, así que
// buscar cuesta cero llamadas, que es el razonamiento de `buscarLead.ts`. Y tiene la misma condición:
// filtrar acá sólo es honesto si acá está todo. Cuando la lista llega recortada (`truncado`), un
// «ningún contacto coincide» pasaría a significar «no está entre los que llegaron», y el contador y
// el vacío lo tienen que decir.
//
// ── LOS PREDICADOS SON LOS DE LA RESPUESTA, NO NUEVOS ───────────────────────
//
// «Agendados» es `cita === 'agendo'`, que el servidor calculó con `tieneCitaAlcanzable`: la misma
// cifra que la tarjeta. Si la etapa usara otra definición —por ejemplo, «tiene alguna cita»—, la
// tarjeta diría 142 y el filtro mostraría otra cantidad de personas, y las dos se verían bien.
//
// ── SIN IMPORTS QUE TOQUEN LA BASE ──────────────────────────────────────────
//
// Lo usa el panel, que es `'use client'`. `buscarLead.ts` y `tramosDelIcp.ts` no importan nada, y los
// tipos de `leadsDelPortal.ts` entran con `import type`, que se borra al compilar.
// ═══════════════════════════════════════════════════════════════════════════════

import { normalizar } from './buscarLead.ts';
import { type ClaveDeTramo, rotuloDelTramo } from './tramosDelIcp.ts';
import type { LeadDelPortal } from './leadsDelPortal.ts';

export type Etapa = 'todas' | 'agendados' | 'asistieron' | 'vendidos';

/** Los botones de etapa, en orden. Tres predicados independientes, no una cadena. */
export const ETAPAS: readonly { clave: Etapa; rotulo: string }[] = [
  { clave: 'todas', rotulo: 'Todas' },
  { clave: 'agendados', rotulo: 'Agendados' },
  { clave: 'asistieron', rotulo: 'Asistieron' },
  { clave: 'vendidos', rotulo: 'Vendidos' },
];

/**
 * Cuántas tarjetas se dibujan de a una vez.
 *
 * Sesenta porque la cohorte de 30 días son casi trescientas: dibujarlas todas de golpe hace pesada la
 * primera pintura, y una lista que se corta sin decirlo esconde a la persona 61. «Mostrar más» agrega
 * sesenta, y el contador dice cuántas se están mostrando.
 */
export const DE_A = 60;

/** Lo que el filtro necesita de una fila. Un subconjunto, para probarlo sin la fila entera. */
export type FilaFiltrable = Pick<
  LeadDelPortal,
  'nombre' | 'campana' | 'creativo' | 'tramo' | 'cita' | 'asistencia' | 'vendio'
>;

export interface Filtros {
  /** Lo que se escribió, SIN normalizar. */
  consulta: string;
  /** `null` = todos los tramos. */
  tramo: ClaveDeTramo | null;
  etapa: Etapa;
}

export const SIN_FILTROS: Filtros = { consulta: '', tramo: null, etapa: 'todas' };

/**
 * Si la fila coincide con lo escrito: nombre, campaña o creativo, sin tildes y sin mayúsculas.
 *
 * **La fuente no**, por lo que `buscarLead.ts` ya escribió: la mitad de la cartera comparte fuente, y
 * escribir «meta» devolvería casi todo pareciendo que filtró. **El teléfono y el correo tampoco**:
 * no viajan en la lista. Por eso se reutiliza `normalizar` y no `coincide`, que mira los dos.
 */
export function coincideConLaConsulta(fila: FilaFiltrable, consulta: string): boolean {
  const q = normalizar(consulta);
  if (q === '') return true;
  return [fila.nombre, fila.campana, fila.creativo].some(
    (campo) => campo !== null && campo !== undefined && normalizar(campo).includes(q),
  );
}

function cumpleLaEtapa(fila: FilaFiltrable, etapa: Etapa): boolean {
  if (etapa === 'agendados') return fila.cita === 'agendo';
  if (etapa === 'asistieron') return fila.asistencia === 'asistio';
  if (etapa === 'vendidos') return fila.vendio;
  return true;
}

/**
 * Las filas que cumplen los tres filtros a la vez: la búsqueda, el tramo y la etapa.
 *
 * El tramo compara la CLAVE que mandó el servidor, así que «Sin calificar» incluye a los que valen 0
 * sin que la pantalla lo decida de nuevo: el 0 ya llegó con `tramo: 'sin_calificar'`.
 */
export function filtrar<F extends FilaFiltrable>(filas: readonly F[], f: Filtros): F[] {
  return filas.filter(
    (fila) =>
      (f.tramo === null || fila.tramo === f.tramo) &&
      cumpleLaEtapa(fila, f.etapa) &&
      coincideConLaConsulta(fila, f.consulta),
  );
}

/**
 * «N de M contactos», con los filtros por su rótulo y el recorte cuando lo hay.
 *
 * N es lo que queda después de filtrar y M la cohorte del período, no las filas que llegaron: con la
 * lista recortada, M sigue siendo el total y el texto dice que la lista está incompleta.
 */
export function contador(o: {
  vistas: number;
  mostradas: number;
  cohorte: number;
  filtros: Filtros;
  truncado: boolean;
}): string {
  const partes = [`${o.vistas} de ${o.cohorte} contactos`];
  if (o.filtros.tramo !== null) partes.push(rotuloDelTramo(o.filtros.tramo));
  if (o.filtros.etapa !== 'todas') {
    partes.push(ETAPAS.find((e) => e.clave === o.filtros.etapa)?.rotulo ?? o.filtros.etapa);
  }
  if (normalizar(o.filtros.consulta) !== '') partes.push(`«${o.filtros.consulta.trim()}»`);
  if (o.mostradas < o.vistas) partes.push(`mostrando ${o.mostradas}`);
  if (o.truncado) partes.push('la lista llegó incompleta');
  return partes.join(' · ');
}

/**
 * Por qué la rejilla quedó vacía. **No es un texto solo: son tres.**
 *
 * «Asistieron» vacío porque nadie registró asistencia no es «ninguno coincide», y «Vendidos» vacío
 * sin ninguna venta en la empresa tampoco: son datos que no existen, y dibujarlos como una búsqueda
 * sin resultados diría que la gente no fue o no compró. Una búsqueda o un tramo sin coincidencias sí
 * lleva el texto genérico.
 */
export function porQueVacia(o: {
  filtros: Filtros;
  /** Personas del período con asistencia registrada, en cualquier sentido. */
  asistenciasRegistradas: number;
  /** Personas del período con una cita que ya debería haber ocurrido y sin registro. */
  sinRegistrar: number;
  hayVentasRegistradas: boolean;
  truncado: boolean;
}): string {
  if (o.filtros.etapa === 'asistieron' && o.asistenciasRegistradas === 0) {
    return (
      'Nadie registró asistencia en este período' +
      (o.sinRegistrar > 0 ? `: ${o.sinRegistrar} persona(s) tienen una cita que ya ocurrió sin registro. ` : '. ') +
      'Un vacío acá no dice que no fue nadie. Los plantones que marcó el calendario van aparte, en cada tarjeta.'
    );
  }
  if (o.filtros.etapa === 'vendidos' && !o.hayVentasRegistradas) {
    return (
      'No hay ninguna venta registrada en la empresa. No es que nadie haya comprado: nadie registró ' +
      'una venta, y la pantalla no tiene de dónde sacarla.'
    );
  }
  return o.truncado
    ? 'Ningún contacto coincide entre los que llegaron: la lista está incompleta, así que puede estar entre los que no.'
    : 'Ningún contacto coincide con estos filtros.';
}
