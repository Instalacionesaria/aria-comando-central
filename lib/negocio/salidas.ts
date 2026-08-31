// La FORMA de una salida de Avanzar, el índice por rol y sus funciones. **Isomorfo.**
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
//
// ── SON DOS CATÁLOGOS, Y EL ROL VA EN LA CLAVE ──────────────────────────────
//
// El setter tiene sus cinco salidas y **`seguimiento` y `nurture` existen en los dos negocios con
// definiciones distintas**. Con un arreglo plano y un campo `rol`, buscar por nombre devuelve la
// primera coincidencia —la del closer— para un contacto del setter, sin fallar.
//
// Por eso las funciones de abajo piden el rol **sin valor por omisión**. Un `rol` opcional dejaría
// compilar a los cinco llamadores de hoy devolviéndoles la definición equivocada; obligatorio rompe
// la compilación en cada uno, que es exactamente el resultado buscado.
//
// Y por eso el nombre `SALIDAS` a secas dejó de existir: mientras existiera, un consumidor nuevo
// heredaba el catálogo del closer por descuido y dibujaba sus seis tarjetas sobre un contacto del
// setter sin que nada fallara.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Territorio } from '../datos/esquema.ts';
import { SALIDAS_DEL_SETTER } from './salidasDelSetter.ts';

/* Se reexporta para que el resto del proyecto entre por una sola puerta: quien pide un catálogo
   pide `salidasDe(rol)`, y quien necesita la constante la encuentra donde está la del closer. */
export { SALIDAS_DEL_SETTER };

/** Un modo de una salida. Hoy los tienen las dos de `seguimiento`, una por rol. */
export interface ModoDeSalida {
  readonly modo: string;
  readonly nombre: string;
  readonly detalle: string;
  /** La etiqueta que se le manda al CRM. Lo que decide si el CRM persigue o no. */
  readonly etiqueta: string;
  /** `true` = escribe una tarea nuestra con su fecha; `false` = lo persigue una serie del CRM. */
  readonly exigeFecha: boolean;
}

/**
 * La forma de una salida. Los dos catálogos la cumplen, y eso es lo que permite que las funciones de
 * abajo sean UNA sola por operación: la acción es la misma, lo que difiere son los datos.
 */
export interface DefinicionDeSalida {
  readonly salida: string;
  readonly nombre: string;
  readonly detalle: string;
  readonly clase: 'win' | 'money' | 'next' | 'lost';
  readonly icono: string;
  readonly etiquetaDelCampo: string | null;
  readonly opciones: readonly string[];
  readonly pideMonto: boolean;
  readonly modos?: readonly ModoDeSalida[];
}

/**
 * Las seis salidas del CLOSER, con lo que cada una pide.
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
export const SALIDAS_DEL_CLOSER = [
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
] as const satisfies readonly DefinicionDeSalida[];

export type SalidaDelCloser = (typeof SALIDAS_DEL_CLOSER)[number]['salida'];
export type SalidaDelSetter = (typeof SALIDAS_DEL_SETTER)[number]['salida'];

/**
 * El índice rol → catálogo. **Existe exactamente una vez, y ése es su punto.**
 *
 * La alternativa era que cada función recibiera el catálogo (`definicionDe(catalogo, salida)`), y
 * eso mueve la decisión «qué catálogo va con qué rol» a cada llamador — donde elegir mal no falla.
 *
 * Y el `Record<Territorio, …>` no compila si mañana aparece un tercer territorio hasta que alguien
 * escriba su catálogo. Es el mismo mecanismo de exhaustividad que ya usa `ETAPA_DE_LA_SALIDA`.
 */
export const SALIDAS_POR_ROL: Readonly<Record<Territorio, readonly DefinicionDeSalida[]>> = {
  closer: SALIDAS_DEL_CLOSER,
  setter: SALIDAS_DEL_SETTER,
};

/** Las salidas que ese rol puede registrar. */
export function salidasDe(rol: Territorio): readonly DefinicionDeSalida[] {
  return SALIDAS_POR_ROL[rol];
}

/**
 * ¿Es una salida que ESE rol puede registrar?
 *
 * Se busca con `some` y no con `in` ni con una propiedad: `'toString' in OBJETO` recorre la cadena
 * de prototipos, y un cuerpo con `salida: 'constructor'` pasaría la validación para después no
 * encontrar nada. Es un defecto real que la referencia dejó anotado.
 */
export function esSalidaDe(rol: Territorio, v: unknown): boolean {
  return typeof v === 'string' && SALIDAS_POR_ROL[rol].some((s) => s.salida === v);
}

/**
 * ¿Es una salida del closer?
 *
 * **Se conserva, y sigue devolviendo `false` para las del setter.** Eso no es una limitación
 * heredada: es la afirmación de que los dos catálogos no se filtran uno en el otro, y hay una prueba
 * que la fija. Un `esSalidaDe` genérico que aceptara cualquiera de las nueve dejaría a un closer
 * registrar `agendo` sobre su propio contacto, que **borra el desenlace que ya tenía**.
 */
export function esSalidaDelCloser(v: unknown): v is SalidaDelCloser {
  return esSalidaDe('closer', v);
}

/** La gemela. Existe para que ninguna de las dos se lea como «la» validación. */
export function esSalidaDelSetter(v: unknown): v is SalidaDelSetter {
  return esSalidaDe('setter', v);
}

/**
 * El par (territorio, salida): lo único que identifica un resultado.
 *
 * Es una unión discriminada, así que `{ rol: 'closer', salida: 'agendo' }` **no existe como valor**.
 * Viaja junto y no como dos campos sueltos por eso: separados, ese par pasa el compilador y llega a
 * escribir una fila con el rol de un negocio y la salida del otro — que después alimenta la comisión
 * equivocada, con un número igual de plausible.
 */
export type ParDeResultado =
  | { rol: 'closer'; salida: SalidaDelCloser }
  | { rol: 'setter'; salida: SalidaDelSetter };

/**
 * El par, o `null` si esa salida no es de ese territorio. **Es LA guarda del sistema.**
 *
 * ── ES LO ÚNICO QUE IMPIDE QUE UN `agendo` BORRE UNA VENTA ─────────────────
 *
 * La ruta de Avanzar pide `contactos.avanzar` sin pantalla, y las dos pestañas tienen esa capacidad.
 * Sin esta guarda, cualquiera abre la ficha de un contacto vendido, registra `agendo`, y la etapa
 * pasa de `ganado` a `agendado`: la píldora deja de decir la venta y el contacto vuelve al buzón.
 * **No se puede deshacer** — `contactos.etapa` no guarda historial.
 *
 * ── Y EL CASTEO ES DELIBERADO, CON SU ALTERNATIVA DESCARTADA ───────────────
 *
 * Estrechar el par de verdad pide `if (rol === 'closer')`, y `ADR-0302` prohíbe comparar contra un
 * nombre de rol en `app/`, `components/` y `lib/` — con razón: `closer` y `setter` **fueron roles**,
 * y una comparación así reintroducida es invisible.
 *
 * Acá `rol` no es un rol: es `contactos.territorio`, un hecho del contacto. Pero la prueba no puede
 * distinguirlos por el texto, y **tiene razón en no intentarlo**: la excepción se pediría siempre y
 * siempre con un argumento razonable.
 *
 * Así que la exhaustividad la da el tipo y no una comparación: `SALIDAS_POR_ROL` es un
 * `Record<Territorio, …>` que **no compila** si aparece un tercer territorio sin catálogo, y
 * `definicionDe` de la línea de arriba es la comprobación en ejecución que este casteo afirma. Un
 * casteo con su verificación inmediatamente encima, en un solo lugar del sistema.
 */
export function parDeSalida(rol: Territorio, salida: string): ParDeResultado | null {
  return definicionDe(rol, salida) === undefined ? null : ({ rol, salida } as ParDeResultado);
}

/**
 * ¿Es una salida de ALGÚN rol?
 *
 * ── PARA QUÉ SIRVE, Y PARA QUÉ NO ──────────────────────────────────────────
 *
 * **No es una validación de permiso.** Sirve para una sola cosa: rechazar basura —`42`, `null`,
 * `'constructor'`, una cadena vacía— **antes de tocar la base**, que es lo que hoy hace el 400 sin
 * consulta de la ruta de Avanzar.
 *
 * La validación que importa —¿es una salida de ESTE territorio?— no se puede hacer acá, porque el
 * territorio sale del contacto y el contacto hay que leerlo. Usar ésta como si fuera aquélla es
 * exactamente el defecto que la separación en dos fases evita: dejaría a un closer registrar
 * `agendo` sobre su propio contacto, **borrando el desenlace que ya tenía**.
 */
export function esAlgunaSalida(v: unknown): v is string {
  return esSalidaDe('closer', v) || esSalidaDe('setter', v);
}

/** La definición de una salida de ese rol, o `undefined` si no es suya. */
export function definicionDe(rol: Territorio, salida: string): DefinicionDeSalida | undefined {
  return SALIDAS_POR_ROL[rol].find((s) => s.salida === salida);
}

/** Los modos que admite una salida. Vacío = no tiene modos. */
export function modosDe(rol: Territorio, salida: string): readonly ModoDeSalida[] {
  return definicionDe(rol, salida)?.modos ?? [];
}

/** El modo pedido, si esa salida lo admite. `undefined` = no existe, y eso se rechaza. */
export function modoDe(rol: Territorio, salida: string, modo: string): ModoDeSalida | undefined {
  return modosDe(rol, salida).find((m) => m.modo === modo);
}

