// Los incidentes de una tarea del cron, agrupados: UNO por corrida, por situación y por paso.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ NO UNO POR LLAMADA
//
// Una ruta anota cada fallo: lo vio una persona, y la referencia es lo que va a dictar. Una tarea del
// cron no tiene a nadie mirando y llama al modelo muchas veces por corrida —el auditor, hasta veinte
// conversaciones cada diez minutos; los Analizadores, todas las llamadas pendientes—. Con el proveedor
// caído, una fila por llamada llenaría el Panel de Incidentes con el mismo hecho repetido
// (`docs/OTROS/agentes/06-MODELOS-USO-TOPES-E-INCIDENTES.md`, AG-98). Lo mismo vale para el botón que
// sincroniza los Analizadores: lo aprieta una persona, pero clasifica hasta cuarenta reuniones de una vez.
//
// ── EL PRIMERO SE ESCRIBE EN EL ACTO ─────────────────────────────────────────
//
// La primera versión juntaba todo en memoria y escribía al terminar. Pero una corrida puede no terminar:
// el auditor espera al modelo hasta 240 s dentro de una función de 300, y con el proveedor colgado la
// plataforma la corta antes del `finally`. Justo en el caso para el que existe el grupo, el panel quedaba
// vacío. Así que el PRIMER fallo de cada situación se anota en el momento, con su referencia, su línea de
// registro y su fila (`anotarIncidente`); los siguientes sólo se cuentan, y `volcar` le escribe a esa fila
// cuántas llamadas fallaron así. Si la corrida se corta, queda el incidente con «una llamada»: menos de
// lo que pasó, nunca nada.
//
// ── EL PASO VA EN LA CLAVE ───────────────────────────────────────────────────
//
// En los Analizadores fallan tres pasos distintos —clasificar, analizar, la ficha— y el panel muestra el
// `donde` como título. Juntar los tres bajo «3 llamadas de esta corrida» no diría cuál falló.
//
// El grupo vive en la corrida, no en el módulo: un `Map` en el nivel superior de un módulo del servidor
// se compartiría entre peticiones de empresas distintas (`ADR-0703`).
// ═══════════════════════════════════════════════════════════════════════════════

import { type FalloDelModelo, anotarIncidente, clasificarFallo } from '../fundaciones/fallo-del-modelo.ts';
import { recontarIncidente } from './registro.ts';

export interface IncidentesAgrupados {
  /**
   * Anota un fallo. El primero de su situación (y de su paso, si lo hay) se escribe en el acto; los
   * siguientes sólo se cuentan. No lanza: `anotarIncidente` tampoco.
   */
  anotar(fallo: FalloDelModelo, paso?: string): Promise<void>;
  /** Escribe en cada incidente cuántas llamadas fallaron así, si fueron más de una. No lanza. */
  volcar(): Promise<void>;
}

/** El `donde` de un incidente agrupado: el paso, si lo hay, y cuántas llamadas de la corrida. */
function dondeDe(paso: string | undefined, veces: number): string {
  const cuantas = veces === 1 ? 'una llamada de esta corrida' : `${veces} llamadas de esta corrida`;
  return paso ? `${paso} · ${cuantas}` : cuantas;
}

/**
 * Un grupo nuevo para UNA corrida de UNA empresa.
 *
 * @param origen `auditor`, `analizador`…: el `origen` de cada incidente que se anote.
 * @param usuarioId Quién lo vio, si la corrida la lanzó una persona desde su pantalla. `null` en el cron.
 */
export function agruparIncidentes(origen: string, orgId: string, usuarioId: string | null = null): IncidentesAgrupados {
  const vistos = new Map<string, { ref: string | null; paso: string | undefined; veces: number }>();
  return {
    async anotar(fallo, paso) {
      const clave = `${clasificarFallo(fallo)}|${paso ?? ''}`;
      const visto = vistos.get(clave);
      if (visto) {
        visto.veces += 1;
        return;
      }
      // Se guarda ANTES de esperar: dos fallos seguidos de la misma clave no escriben dos filas.
      const nuevo = { ref: null as string | null, paso, veces: 1 };
      vistos.set(clave, nuevo);
      nuevo.ref = (await anotarIncidente(fallo, { origen, orgId, usuarioId, donde: dondeDe(paso, 1) })).ref;
    },
    async volcar() {
      for (const { ref, paso, veces } of vistos.values()) {
        if (veces > 1 && ref !== null) await recontarIncidente(orgId, ref, origen, dondeDe(paso, veces));
      }
      vistos.clear();
    },
  };
}
