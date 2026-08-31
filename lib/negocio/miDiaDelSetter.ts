// Mi Día del SETTER: las SEIS colas. Contesta «¿qué tengo que hacer ahora?».
//
// ═══════════════════════════════════════════════════════════════════════════════
// SEIS Y NO CINCO, Y NO ES EL MISMO TABLERO CON UNA MÁS
//
// Dos colas propias que el closer no tiene —**estancadas** y **oportunidades chicas**— y una del
// closer que acá **no existe**: la agenda.
//
// La agenda no falta: el setter trabaja **por definición antes de que haya cita**. Ponerle una
// sección de citas sería una sección permanentemente vacía, y una sección que nunca tiene nada es
// una que se aprende a no mirar.
//
// ── POR QUÉ ES OTRA FUNCIÓN Y NO `colasDelDia(rol)` ─────────────────────────
//
// Porque el tipo de retorno es otro, y ahí está el argumento: un `MiDia` con `agenda?` y
// `estancadas?` opcionales haría que una pantalla que se olvide de dibujar una cola **no muestre
// nada y no falle nada**. Con dos tipos, olvidarse no compila.
//
// Lo que sí se comparte —las otras cuatro colas— sale del núcleo, porque son la misma acción sobre
// el mismo dato. La línea está trazada en `lib/negocio/colas.ts`.
//
// ── CERO LLAMADAS AL CRM ────────────────────────────────────────────────────
//
// Todo sale de la caché propia, igual que en el closer. Es lo que hace barato que esta pantalla
// tenga reloj: poner los diez segundos multiplica consultas a nuestra base, no al proveedor.
// ═══════════════════════════════════════════════════════════════════════════════

import { DERIVADO_LT } from '../ghl/contrato.ts';
import { estaCerrado } from './fila.ts';
import { nucleoDeColas, tiene, type EnLaCola } from './colas.ts';

/**
 * El orden de precedencia entre las colas. **Declarado en un solo lugar.**
 *
 * ── POR QUÉ HACE FALTA DECLARARLO, Y POR QUÉ ESTE ORDEN ────────────────────
 *
 * «Un contacto en una sola cola» es la regla, y el motivo está medido en el closer: *«dos colas para
 * la misma persona hacen que atender una no cierre la otra, y el closer termina trabajando el mismo
 * caso dos veces sin saberlo»*. Con dos colas alcanzaba un `Set`; con cuatro que pueden solaparse
 * hace falta un orden escrito.
 *
 *   1 · **Urgentes** — el agente falló. Es el hecho más específico: alguien tiene que mirar la
 *       conversación antes que nada.
 *   2 · **Buzón** — escribió y nadie le contestó. Es la única cola con **una contraparte esperando
 *       del otro lado**, y por eso va antes que las dos pasivas. Un lead que rompe treinta días de
 *       silencio para escribir es el que más urge, y con las estancadas arriba quedaría escondido
 *       justo en el momento en que dejó de estar estancado.
 *   3 · **Oportunidades chicas** — hay una oferta concreta que hacer.
 *   4 · **Estancadas** — se apagó. Es la ausencia de lo que el buzón mide.
 *
 * Es una decisión de producto y se puede cambiar: es este arreglo.
 */
const PRECEDENCIA_DE_LAS_COLAS = ['urgentes', 'buzon', 'oportunidades', 'estancadas'] as const;

export interface MiDiaDelSetter {
  urgentes: EnLaCola[];
  /** Propia. Leads que se apagaron: la etiqueta la pone el CRM y acá **solo se lee**. */
  estancadas: EnLaCola[];
  /** Propia. El agente los derivó al producto chico: hay una oferta que hacer. */
  oportunidades: EnLaCola[];
  buzon: EnLaCola[];
  seguimientos: EnLaCola[];
  completadas: EnLaCola[];
  /**
   * El contador de tareas pendientes: **CINCO categorías**, no las tres del closer.
   *
   * Suma urgentes, estancadas, oportunidades, buzón y los seguimientos que piden manos. No suman
   * las completadas —ya no son tarea— y no hay agenda que excluir.
   *
   * Y como en el closer, **una sola función alimenta las tres vitrinas** donde aparece el número:
   * la marca del menú, el título de Inicio y el encabezado de Mi Día. Con tres fórmulas salen tres
   * números distintos para lo mismo.
   */
  tareasPendientes: number;
  /** `true` si el territorio no cupo entero. */
  truncado: boolean;
}

/** Las seis colas del setter. **Corre dentro de `conOrganizacion(`.** */
export async function colasDelSetter(zonaHoraria: string): Promise<MiDiaDelSetter> {
  const nucleo = await nucleoDeColas('setter', zonaHoraria);

  /* Quiénes ya tienen cola, en el orden declarado arriba. Se va llenando a medida que se arman, y
     cada cola siguiente saltea lo que ya está: es la regla «un contacto, una cola» hecha explícita
     en vez de una cadena de `continue` que hay que leer entera para saber el orden. */
  const yaTieneCola = new Set(nucleo.enUrgentes);

  /* El BUZÓN va segundo, y el núcleo ya lo armó excluyendo a los de Urgentes. Se toma tal cual y se
     anota a los suyos. */
  const buzon = nucleo.buzon;
  for (const x of buzon) yaTieneCola.add(x.fila.id);

  // ── Cola propia · OPORTUNIDADES CHICAS ────────────────────────────────────
  //
  // Contactos que el agente derivó porque no califican para el producto grande pero sí pueden
  // comprar algo chico. Hay una **oferta concreta que hacer**, así que es trabajo.
  //
  // La etiqueta significa exactamente eso —*derivado*— y es distinto del uso que tendría en el
  // registro de resultados, donde significaría una venta. Ahí NO se usa: derivado ≠ vendido, y
  // usarla como etiqueta de venta marcaría como venta a todo el que recibió la oferta.
  const oportunidades: EnLaCola[] = [];
  for (const fila of nucleo.filas) {
    if (yaTieneCola.has(fila.id)) continue;
    if (!tiene(fila.etiquetas, [DERIVADO_LT])) continue;
    // Un contacto cerrado no necesita manos, por más que siga teniendo la etiqueta: nadie las quita.
    if (estaCerrado(fila.situacion)) continue;
    oportunidades.push({ fila });
    yaTieneCola.add(fila.id);
  }

  // ── Cola propia · CONVERSACIONES ESTANCADAS ───────────────────────────────
  //
  // ── QUIÉN DECIDE QUE ESTÁ ESTANCADO, Y NO SOMOS NOSOTROS ──────────────────
  //
  // **La etiqueta la aplica un barrido del CRM contra su propia ventana de inactividad.** Acá solo
  // se lee. Medir el estancamiento por nuestra cuenta sería una segunda fuente para el mismo hecho,
  // y dos fuentes divergen.
  //
  // ── Y EL CICLO DE RESCATES NO ESTÁ ────────────────────────────────────────
  //
  // El diseño de producto define un contador («2º rescate») y un tope de tres tras el cual el
  // sistema mueve el contacto solo a nurture. **Eso no se construyó**, y no es un olvido: la
  // documentación de la plataforma anterior avisa que tampoco estaba allá — la cola era «tiene la
  // etiqueta», sin contador y sin tope. Es trabajo a escribir, no a copiar, y necesita estado nuevo.
  //
  // Así que esto es una LISTA, no un flujo: un contacto se queda hasta que el CRM le quite la
  // etiqueta o alguien registre un resultado.
  const estancadas: EnLaCola[] = [];
  for (const fila of nucleo.filas) {
    if (yaTieneCola.has(fila.id)) continue;
    /* Se lee `fila.estancado`, que ya viene calculado con la misma etiqueta y por el mismo lugar que
       enciende el tinte ámbar de la fila. Leerla de nuevo acá sería una segunda derivación del mismo
       hecho — y el tinte y la cola podrían discrepar sobre el mismo contacto. */
    if (!fila.estancado) continue;
    if (estaCerrado(fila.situacion)) continue;
    estancadas.push({ fila });
    yaTieneCola.add(fila.id);
  }

  /* ── EL CONTADOR: CINCO CATEGORÍAS, SUMADAS EXPLÍCITO ──────────────────────
   *
   * No se deriva de las colas. Un `Object.values(colas).flat().length` haría que agregar una cola
   * cambie el número sin que nadie lo decida, y que las completadas —que no son trabajo pendiente—
   * entren solas. */
  const tareasPendientes =
    nucleo.urgentes.length +
    estancadas.length +
    oportunidades.length +
    buzon.length +
    nucleo.seguimientos.filter((s) => s.pideManos).length;

  return {
    urgentes: nucleo.urgentes,
    estancadas,
    oportunidades,
    buzon,
    seguimientos: nucleo.seguimientos,
    completadas: nucleo.completadas,
    tareasPendientes,
    truncado: nucleo.truncado,
  };
}

/** El orden declarado, para que una prueba pueda afirmarlo sin releer el cuerpo. */
export { PRECEDENCIA_DE_LAS_COLAS };
