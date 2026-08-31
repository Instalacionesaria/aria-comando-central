// Las cinco salidas de Avanzar del SETTER. **Isomorfo: sin base, sin React, sin red.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ES OTRO ARCHIVO Y NO UN CAMPO `rol` EN EL CATÁLOGO DEL CLOSER
//
// Porque **la clave colisiona**: `seguimiento` y `nurture` existen en los dos negocios con
// definiciones distintas —otras opciones, otros modos, otras series—. Con un arreglo plano y un
// campo `rol`, `definicionDe('seguimiento')` devuelve la PRIMERA coincidencia —la del closer— para
// un contacto del setter, **sin fallar**: la pantalla del setter dibujaría «Nivel de interés» y los
// modos del closer, y el servidor los aceptaría.
//
// Cualquier diseño que no ponga el rol en la CLAVE está roto de origen. Por eso son dos catálogos y
// un índice, y por eso las funciones de `salidas.ts` piden el rol sin valor por omisión.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA DIFERENCIA DE FONDO CON EL CLOSER, Y NO ES UN PARÁMETRO
//
// El Closer **apaga el agente de IA en seis de sus siete salidas**, porque cualquier resultado suyo
// demuestra que el contacto ya tuvo su llamada de venta.
//
// **El Setter es pre-agenda por definición: ninguna de estas cinco prueba que hubo una llamada.**
//
// Aplicar ese apagado desde acá mataría el agente de un lead que todavía se está calificando — y
// peor en `seguimiento`, que es justamente la salida que lo deja en manos del agente durante días.
//
// Por eso el apagado no es un campo en `false` que alguien pueda cambiar: el catálogo de etiquetas
// del setter en `lib/ghl/contrato.ts` **no tiene la propiedad**, así que el apagado es inexpresable.
// ═══════════════════════════════════════════════════════════════════════════════

import type { DefinicionDeSalida } from './salidas.ts';

/**
 * Las cinco salidas del setter.
 *
 * ── TRES DE LAS CINCO NO ESCRIBEN EL CAMPO DEL CRM, Y ESO ES LO CORRECTO ────
 *
 * Los vocabularios de abajo **no están en las listas desplegables de la subcuenta**, medidos campo
 * por campo:
 *
 *   · forma de pago chica  → acá: Transferencia · Tarjeta · Efectivo · Otro
 *                            allá: Contado · Splitwise · Pago diferido · Cuotas
 *   · no califica          → acá: Sin capital · Sin urgencia · No es el perfil · Datos falsos
 *                            allá: Precio · No es el momento · Competencia · No califica · Otro
 *
 * Ninguno de los dos conjuntos es subconjunto del otro, **así que no hay traducción honesta**. Y
 * escribir un valor que no está en la lista es el peor caso posible: el CRM responde **éxito** y
 * descarta el valor — o sea reportar un éxito que no ocurrió.
 *
 * El dato no se pierde: viaja en `resultados.detalle`, en nuestra base, y se muestra en la píldora.
 * Lo que no se hace es fingir que llegó al CRM. Se destraba del lado del CRM —agregando esas
 * opciones a las listas, o creando campos propios del setter— y hasta entonces queda declarado, no
 * olvidado.
 */
export const SALIDAS_DEL_SETTER = [
  {
    salida: 'agendo',
    nombre: 'Agendó',
    detalle: 'Reservó su llamada. Pasa al closer.',
    clase: 'win',
    icono: '✓',
    /**
     * ── NO PIDE HORARIO, Y LA REFERENCIA SÍ LO PEDÍA ────────────────────────
     *
     * El diseño anterior mostraba un selector de horarios acá. **Esta aplicación no crea citas**: el
     * contacto reserva por su propio enlace y la pantalla de Agenda solo lee. Un selector cuya hora
     * no se escribe en ninguna parte es un control que miente sobre lo que hace.
     *
     * La cita real llega por el aviso del CRM y por el ciclo de respaldo, con su hora de verdad.
     */
    etiquetaDelCampo: null,
    opciones: [],
    pideMonto: false,
  },
  {
    salida: 'venta_chica',
    nombre: 'Venta chica',
    detalle: 'Le vendió el producto chico.',
    clase: 'money',
    icono: '◈',
    // La subcategoría de una venta es CÓMO pagó, igual que en el closer. El vocabulario es otro y
    // por eso no se escribe al CRM — ver el encabezado de la constante.
    etiquetaDelCampo: 'Forma de pago',
    opciones: ['Transferencia', 'Tarjeta', 'Efectivo', 'Otro'],
    pideMonto: true,
  },
  {
    salida: 'seguimiento',
    nombre: 'Seguimiento',
    detalle: 'Sigue vivo, hay que volver.',
    clase: 'next',
    icono: '↻',
    etiquetaDelCampo: 'En qué está',
    opciones: ['Pidió pensarlo', 'No contesta', 'Falta un dato', 'Otro'],
    pideMonto: false,
    /**
     * ── TRES MODOS, Y EL MANUAL ES EL QUE HACE QUE LA COLA EXISTA ───────────
     *
     * Las dos series son del CRM: `exigeFecha: false` significa que **no se escribe fila en
     * `negocio.tareas`**, porque la persecución la hace la secuencia de la subcuenta. Y esa tabla es
     * la única fuente de la cola «Seguimientos de hoy».
     *
     * O sea que con SOLO las dos series, esa cola del Mi Día del setter **nace vacía para siempre**:
     * una sección que se dibuja y nunca tiene nada, que es exactamente la rama de interfaz muerta
     * que `miDia.ts` ya retiró una vez.
     *
     * El modo manual es el que la llena, y hace lo mismo que en el closer: le dice al CRM que **no
     * persiga** a este contacto, porque lo retoma una persona.
     *
     * ── Y LAS DOS SERIES SON DEL SETTER, DISTINTAS DE LA DEL CLOSER ─────────
     *
     * Persiguen otra cosa: acá se persigue una **cita**, allá un **cierre**. Por eso son 5 y 3 días
     * contra los 7 del closer, y por eso no se comparten.
     */
    modos: [
      {
        modo: 'manual',
        nombre: 'Lo retomo yo',
        detalle: 'Aparece en Mi Día el día que elijas. El CRM no lo persigue.',
        etiqueta: 'seguimiento_manual',
        exigeFecha: true,
      },
      {
        modo: 'para_agendar',
        nombre: 'Que lo persiga para agendar',
        detalle: 'Serie del CRM: 3 toques en 5 días. No te aparece como tarea.',
        etiqueta: 'seguimiento_para_agendar',
        exigeFecha: false,
      },
      {
        modo: 'decision_chica',
        nombre: 'Que lo persiga por la oferta chica',
        detalle: 'Serie del CRM: 2 toques en 3 días. No te aparece como tarea.',
        etiqueta: 'seguimiento_decision_lt',
        exigeFecha: false,
      },
    ],
  },
  {
    salida: 'no_califica',
    nombre: 'No califica',
    detalle: 'No es para el producto grande.',
    clase: 'lost',
    icono: '✕',
    etiquetaDelCampo: 'Razón',
    opciones: ['Sin capital', 'Sin urgencia', 'No es el perfil', 'Datos falsos'],
    pideMonto: false,
  },
  {
    salida: 'nurture',
    nombre: 'Nurture',
    detalle: 'No es ahora, pero puede volver.',
    clase: 'next',
    icono: '◍',
    etiquetaDelCampo: 'De dónde viene',
    opciones: ['Pidió tiempo', 'Se enfrió'],
    pideMonto: false,
  },
] as const satisfies readonly DefinicionDeSalida[];

/**
 * A qué etapa manda cada salida del setter.
 *
 * ── POR QUÉ ESTE MAPA NO ES EL DEL CLOSER ───────────────────────────────────
 *
 * Los dos embudos tienen siete columnas y **ninguna es la misma**. El mapa único que había mandaba
 * `venta_chica` a `ganado` —la columna de una venta del closer— con un comentario que admitía que
 * estaba mal. Una venta chica de $497 dibujada en la misma columna que un cierre de $12.000 no es
 * un detalle de presentación: son dos negocios distintos sumados en un número.
 *
 * `vendido` es propia y **no existe en el embudo del closer**. Y no se colapsa con `oferta_chica`,
 * que significa *ofrecida*: una venta cobrada y una oferta sin respuesta no pueden verse iguales,
 * porque una tiene trabajo pendiente y la otra no.
 *
 * `agendado`, `nurture` y `descalificado` **comparten clave a propósito** con las del closer:
 * significan lo mismo en los dos negocios. Y en el caso de `agendado` la coincidencia es el punto —
 * es el traspaso: el setter la escribe y el closer la lee como su etapa de entrada.
 */
export const ETAPA_DE_LA_SALIDA_DEL_SETTER = {
  agendo: 'agendado',
  venta_chica: 'vendido',
  seguimiento: 'en_calificacion',
  no_califica: 'descalificado',
  nurture: 'nurture',
} as const satisfies Readonly<Record<(typeof SALIDAS_DEL_SETTER)[number]['salida'], string>>;
