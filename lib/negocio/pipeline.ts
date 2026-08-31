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
import {
  contarPorEtapa,
  esEtapaDe,
  etapaDeEntrada,
  etapaDelContacto,
  etapasDe,
  type Etapa,
} from './etapas.ts';
import type { Territorio } from '../datos/esquema.ts';

export interface ColumnaDelPipeline {
  /* `string` y no `Etapa`: la columna viaja a una pantalla que la dibuja, y las claves de los dos
     embudos son un conjunto abierto desde el punto de vista de esta interfaz. La garantía de que
     solo salgan claves reales la da `etapasDe(rol)`, que es de dónde se arman. */
  clave: string;
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
  /**
   * El desglose de la cartera: cuántos están **activos** y cuántos **congelados**.
   *
   * Los documentos lo piden con esa forma —*«el contador de la base total desglosa: N activos · M
   * congelados»*— y el motivo es que sin el desglose los números de esta pantalla no cierran con los
   * de ninguna otra: `total` incluye a los dos, y las colas de Mi Día a ninguno de los congelados.
   *
   * Un congelado es el que **no está en ningún territorio**. Antes no se traían, así que no había
   * nada que desglosar: desaparecían de la aplicación sin rastro.
   */
  cartera: { activos: number; congelados: number };
}

/**
 * El Pipeline completo. **Corre dentro de `conOrganizacion(`.**
 */
export async function pipelineDe(
  rol: Territorio,
  opciones: { conCongelados: boolean },
): Promise<Pipeline> {
  /* ── `conCongelados` NO ES UNA PERILLA DE GUSTO: DECIDE DE QUIÉN ES UN CONGELADO ──
   *
   * `sincronizar.ts` afirma del congelado que *«sigue visible y atenuado, sigue siendo movible, no
   * se borra»*. Lo único que era cierto es que no se borra: sin esta opción, `filasDeTerritorio`
   * filtra por territorio y un contacto que pierde su zona **desaparece de la aplicación sin rastro
   * y sin contador que lo cuente**.
   *
   * Y con dos pipelines el argumento cambia de forma: un congelado **no está en ningún territorio**,
   * así que si los dos lo pidieran aparecería en las dos carteras y se contaría dos veces — en
   * contradicción directa con que los territorios sean excluyentes.
   *
   * Se elige un dueño y se dice: hoy es el Closer, que es donde ya se veía. El costo, que hay que
   * saber: un contacto que era del setter y perdió su zona deja de verse donde se trabajaba. La
   * alternativa —guardar cuál fue su último territorio— es una columna que hoy no existe.
   *
   * Mi Día NO lo pide en ninguno de los dos, y eso es correcto: sus colas son trabajo, y un
   * congelado no es trabajo de nadie. El Pipeline es la cartera, y ahí un congelado es información. */
  const { filas, hayMas } = await filasDeTerritorio(rol, {
    todas: true,
    conCongelados: opciones.conCongelados,
  });

  const columnas = etapasDe(rol);
  const porEtapa = new Map<string, Fila[]>(columnas.map((e) => [e.clave, []]));
  const etapas: Etapa[] = [];
  let porResultado = 0;
  let porEtiqueta = 0;
  let sinNada = 0;
  let congelados = 0;

  for (const f of filas) {
    const etapa = etapaDelContacto(rol, { etapa: f.etapa, etiquetas: f.etiquetas });
    etapas.push(etapa);
    porEtapa.get(etapa)?.push(f);
    if (f.congelado) congelados++;

    /* De dónde salió la clasificación. Se cuenta acá y no se recalcula después: repetir el
       criterio en dos lugares es tener dos criterios que se van a separar.

       ── Y `esUnaDeLasSiete` NO ES `!== null`, QUE ERA EL DEFECTO ────────────

       La condición era `f.etapa !== null`, y `contactos.etapa` es `text` **sin restricción** en la
       base. Así que un contacto con una etapa RETIRADA —una clave que ya no está en `ETAPAS`— se
       dibujaba en `agendado` por el respaldo de `etapaDelContacto` y se contaba acá como
       «registrado por una persona».
       Las dos cosas a la vez son la contradicción: la columna dice «nadie lo tocó» y el contador
       dice «alguien lo registró», sobre el mismo contacto. Ahora la condición es la misma que usa
       `etapaDelContacto` para decidir si le cree a la columna. */
    if (esEtapaDe(rol, f.etapa)) porResultado++;
    /* Y la comparación es contra la ENTRADA DE ESTE EMBUDO, no contra `'agendado'` cableado. Con el
       literal, la heurística del setter contaría mal: su entrada es `nuevo`, así que todo contacto
       con alguna etiqueta habría contado como «clasificado por etiqueta» aunque no lo estuviera. */
    else if (f.etiquetas.length > 0 && etapa !== etapaDeEntrada(rol)) porEtiqueta++;
    else sinNada++;
  }

  const conteo = contarPorEtapa(rol, etapas);

  return {
    columnas: columnas.map((e) => ({
      clave: e.clave,
      nombre: e.nombre,
      cuantos: conteo[e.clave] ?? 0,
      filas: porEtapa.get(e.clave) ?? [],
    })),
    total: filas.length,
    hayMas,
    clasificados: { porResultado, porEtiqueta, sinNada },
    cartera: { activos: filas.length - congelados, congelados },
  };
}
