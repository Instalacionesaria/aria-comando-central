// El Pipeline del closer: las siete columnas.
//
// ═══════════════════════════════════════════════════════════════════════════════
// SON TODOS LOS CONTACTOS DEL TERRITORIO, CLASIFICADOS. NO UNA SELECCIÓN.
//
// El `02` es terminante: *"el Pipeline son TODOS los contactos del territorio"*. No es una cola de
// trabajo como Mi Día —que muestra lo de hoy— sino el estado completo, y de ahí sale una regla que
// vale la pena escribir: **una columna vacía se dibuja igual, con su cero**.
//
// El motivo es el mismo que gobierna todo este repositorio: una columna que desaparece cuando está
// vacía hace que nadie note que está vacía. Un `Ganado 0` es una afirmación; un Ganado ausente es
// una pregunta que nadie se hace.
//
// ── NO HAY NINGUNA CONSULTA NUEVA ACÁ, Y ES A PROPÓSITO ─────────────────────
//
// Se reusa `filasDeTerritorio('closer', { todas: true })`, la MISMA que llena Mi Día y la lista. El
// `01` lo pide con nombre y apellido: *"los seis íconos se cargan una sola vez para todos, y viajan
// con cada contacto en cada cola. Por eso se ven iguales en Mi Día, en el Pipeline y en la ficha:
// **es el mismo dato, no tres cálculos que coinciden**"*.
//
// Una consulta propia para el Pipeline sería más directa y traería el defecto que esa frase evita:
// el mismo contacto con una píldora distinta según la pantalla, y las dos pareciendo correctas.
// ═══════════════════════════════════════════════════════════════════════════════

import { filasDeTerritorio, type Fila } from './fila.ts';
import { contarPorEtapa, ETAPAS, etapaDelContacto, type Etapa } from './etapas.ts';

export interface ColumnaDelPipeline {
  clave: Etapa;
  nombre: string;
  /** Cuántos hay. **Se dibuja aunque sea cero.** Ver el encabezado. */
  cuantos: number;
  filas: Fila[];
}

export interface Pipeline {
  columnas: ColumnaDelPipeline[];
  total: number;
  /**
   * `true` = se cortó por el tope del territorio y el Pipeline está INCOMPLETO.
   *
   * Viaja porque un tablero que muestra una parte y parece mostrar el todo es el peor resultado
   * posible de una lista con tope: los conteos por columna se leerían como los reales.
   */
  hayMas: boolean;
  /**
   * Cuántos están clasificados por un Avanzar de verdad, y cuántos por sus etiquetas.
   *
   * No es una estadística de adorno: mientras la segunda cifra sea la mayoría, las columnas
   * describen lo que el CRM etiquetó, no lo que alguien registró. La pantalla lo dice, y así el
   * número deja de necesitar una explicación aparte.
   */
  clasificados: { porResultado: number; porEtiqueta: number; sinNada: number };
}

/**
 * El Pipeline completo. **Corre dentro de `conOrganizacion(`.**
 */
export async function pipelineDelCloser(): Promise<Pipeline> {
  const { filas, hayMas } = await filasDeTerritorio('closer', { todas: true });

  const porEtapa = new Map<Etapa, Fila[]>(ETAPAS.map((e) => [e.clave, []]));
  const etapas: Etapa[] = [];
  let porResultado = 0;
  let porEtiqueta = 0;
  let sinNada = 0;

  for (const f of filas) {
    const etapa = etapaDelContacto({ etapa: f.etapa, etiquetas: f.etiquetas });
    etapas.push(etapa);
    porEtapa.get(etapa)?.push(f);

    // De dónde salió la clasificación. Se cuenta acá y no se recalcula después: repetir el
    // criterio en dos lugares es tener dos criterios que se van a separar.
    if (f.etapa !== null) porResultado++;
    else if (f.etiquetas.length > 0 && etapa !== 'agendado') porEtiqueta++;
    else sinNada++;
  }

  const conteo = contarPorEtapa(etapas);

  return {
    columnas: ETAPAS.map((e) => ({
      clave: e.clave,
      nombre: e.nombre,
      cuantos: conteo[e.clave],
      filas: porEtapa.get(e.clave) ?? [],
    })),
    total: filas.length,
    hayMas,
    clasificados: { porResultado, porEtiqueta, sinNada },
  };
}
