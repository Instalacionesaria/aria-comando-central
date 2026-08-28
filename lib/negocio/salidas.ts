// Las seis salidas de Avanzar. **Isomorfo: sin base, sin React, sin red.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTÁ SEPARADO DEL ESCRITOR, Y SE APRENDIÓ AL COMPILAR
//
// El catálogo lo necesitan las DOS mitades: el navegador para dibujar las seis tarjetas y sus
// preguntas, y el servidor para validar lo que llega. Cuando vivía junto a `registrarResultado`,
// importarlo desde el componente arrastró `lib/datos/contexto.ts` —y con él `pg`— al paquete del
// navegador, y la construcción falló con `Can't resolve 'dns'`, `'fs'`, `'net'`.
//
// El error fue ruidoso y por eso se arregló en el momento. Lo que importa es la regla que deja: **un
// catálogo que las dos mitades comparten no puede vivir en el mismo archivo que una consulta.** Es
// la misma razón por la que `pildora.ts`, `ventana.ts` y `chat.ts` son isomorfos.
//
// Y hay una segunda razón, independiente de la construcción: que las dos mitades lean **la misma
// tabla** es lo que hace que la pantalla no pueda ofrecer una opción que el servidor va a rechazar.
// Con dos listas, la que se quede vieja ofrece un control que da 400.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Las seis salidas del closer, con lo que cada una pide.
 *
 * ── LAS OPCIONES SON LITERALES DEL CRM, Y SU CONFIANZA ESTÁ DECLARADA ──────
 *
 * Se guardan en `resultados.detalle` —nuestra base— y **hoy no se escriben al campo
 * personalizado del CRM**. El motivo está medido: de las 17 claves curadas que traía la
 * referencia, **7 ya no existen en la subcuenta**, y escribir un campo que no existe se responde
 * con un 200 y no hace nada. El catálogo de campos es del bloque siguiente; hasta entonces el
 * detalle vive donde sí sirve.
 *
 * `pideMonto` es la única validación que el servidor impone sobre la subcategoría: una venta sin
 * monto no es una venta a la que se le pueda poner un número en Inicio.
 */
export const SALIDAS = [
  {
    salida: 'venta',
    nombre: 'Venta',
    detalle: 'Cerró y pagó.',
    clase: 'win',
    icono: '✓',
    // La subcategoría de una venta es CÓMO pagó, y va en su propia columna: `forma_pago`. El
    // encabezado de `pildora.ts` explica por qué una venta tiene tres piezas y no dos.
    etiquetaDelCampo: 'Forma de pago',
    opciones: ['Contado', 'Splitwise', 'Buy Now Pay Later', 'Cuotas'],
    pideMonto: true,
  },
  {
    salida: 'acuerdo_sin_pago',
    nombre: 'Acordó comprar',
    detalle: 'Se comprometió, todavía no pagó.',
    clase: 'money',
    icono: '◈',
    // La única salida SIN subcategoría: lo que la describe es el monto.
    etiquetaDelCampo: null,
    opciones: [],
    pideMonto: true,
  },
  {
    salida: 'seguimiento',
    nombre: 'Seguimiento',
    detalle: 'Sigue vivo, hay que volver.',
    clase: 'next',
    icono: '↻',
    etiquetaDelCampo: 'Nivel de interés',
    opciones: ['Próximo a pagar', 'Muy interesado', 'Dudando', 'Enfriándose', 'Otro'],
    pideMonto: false,
    /**
     * ── LOS DOS MODOS, Y LA ÚNICA SALIDA QUE LOS TIENE ──────────────────────
     *
     * Se pidió así: *«en el botón de avanzar tenemos 2 opciones. La primera sería que ponga
     * seguimiento automático y eso lo que hace es enviar la etiqueta correspondiente a GHL con ese
     * contacto pues ahí se activa una secuencia de correos. Acá en este caso solo aparece si pone
     * seguimiento manual y pone tal día»*.
     *
     * O sea que los dos modos hacen cosas **disjuntas**, y por eso no alcanzaba con una casilla:
     *
     *   · `automatico` → manda `seguimiento_recupero` al CRM y **no escribe nada nuestro**. La
     *     persecución la hace la secuencia de correos de la subcuenta. No aparece en Mi Día porque
     *     no hay nada que nadie tenga que hacer.
     *   · `manual` → manda `seguimiento_manual` —que le dice al CRM **que NO persiga**— y escribe la
     *     fila en `negocio.tareas` con su fecha. Ése sí aparece en Mi Día el día que toca.
     *
     * ── POR QUÉ ESTÁ EN EL CATÁLOGO Y NO EN EL COMPONENTE ───────────────────
     *
     * Por lo mismo que el resto de este archivo: las dos mitades leen esta tabla, así que la
     * pantalla no puede ofrecer un modo que el servidor rechace. Antes no existía ninguno —el
     * escritor cableaba `modo: 'manual'`— y `seguimiento_recupero` **solo se leía**: el ícono ⏱ se
     * encendía con una etiqueta que ninguna línea del sistema escribía.
     *
     * `exigeFecha` no es decorativo: es lo que hace que el servidor pueda rechazar la combinación
     * imposible sin una lista de casos aparte.
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
        modo: 'automatico',
        nombre: 'Que lo persiga la secuencia',
        detalle: 'Dispara la serie de correos del CRM. No te aparece como tarea.',
        etiqueta: 'seguimiento_recupero',
        exigeFecha: false,
      },
    ],
  },
  {
    salida: 'no_interesa',
    nombre: 'No le interesa',
    detalle: 'Dijo que no.',
    clase: 'lost',
    icono: '✕',
    etiquetaDelCampo: 'Motivo',
    opciones: ['Precio', 'No es el momento', 'Competencia', 'No califica', 'Otro'],
    pideMonto: false,
  },
  {
    salida: 'no_show',
    nombre: 'No-show',
    detalle: 'No apareció a la cita.',
    clase: 'lost',
    icono: '◌',
    etiquetaDelCampo: 'Qué pasó',
    opciones: ['Avisó quiere reagendar', 'Plantón sin aviso', 'Falla técnica', 'Datos incorrectos'],
    pideMonto: false,
  },
  {
    salida: 'nurture',
    nombre: 'Nurture',
    detalle: 'No es ahora, pero puede volver.',
    clase: 'next',
    icono: '◍',
    etiquetaDelCampo: 'De dónde viene',
    opciones: ['No-show', 'Pidió tiempo', 'Se enfrió'],
    pideMonto: false,
  },
] as const;

export type SalidaDelCloser = (typeof SALIDAS)[number]['salida'];

/**
 * ¿Es una salida que el closer puede registrar?
 *
 * Se busca en el catálogo con `some` y no con `in` ni con una propiedad: `'toString' in OBJETO`
 * recorre la cadena de prototipos, y un cuerpo con `salida: 'constructor'` pasaría la validación
 * para después no encontrar nada. Es un defecto real que la referencia dejó anotado.
 */
export function esSalidaDelCloser(v: unknown): v is SalidaDelCloser {
  return typeof v === 'string' && SALIDAS.some((s) => s.salida === v);
}

/** La definición de una salida, o `undefined` si no es del closer. */
/**
 * Un modo de una salida. Hoy solo `seguimiento` los tiene, y el tipo se deriva del catálogo en vez
 * de escribirse aparte: así agregar un modo es tocar una tabla y no dos.
 */
export type Modo = (typeof SALIDAS)[number] extends infer S
  ? S extends { modos: readonly (infer M)[] }
    ? M
    : never
  : never;

/** Los modos que admite una salida. Vacío = no tiene modos, que es el caso de cinco de las seis. */
export function modosDe(salida: string): readonly Modo[] {
  const def = definicionDe(salida);
  return def && 'modos' in def ? def.modos : [];
}

/** El modo pedido, si esa salida lo admite. `undefined` = no existe, y eso se rechaza. */
export function modoDe(salida: string, modo: string): Modo | undefined {
  return modosDe(salida).find((m) => m.modo === modo);
}

export function definicionDe(salida: string) {
  return SALIDAS.find((s) => s.salida === salida);
}

