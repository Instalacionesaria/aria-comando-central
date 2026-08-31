// Las siete etapas del Pipeline, y de dónde sale la de cada contacto.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA FUENTE DE VERDAD ES NUESTRA BASE, NUNCA EL CRM
//
// El `contrato` § D.3 lo cierra así, y de ahí sale todo este archivo: **la etapa la escribe
// Avanzar en `contactos.etapa`**. La etiqueta que se le manda al CRM es un aviso para que dispare
// sus automatismos, no el lugar donde vive el estado.
//
// Y eso tiene una consecuencia práctica que conviene decir: **las columnas del Pipeline funcionan
// desde el día uno**, sin esperar que el CRM devuelva nada. El día que se enciendan las etiquetas
// que hoy están pendientes, no cambia nada de acá.
//
// ── PERO HAY CONTACTOS QUE NUNCA RECIBIERON UN AVANZAR ──────────────────────
//
// Y son casi todos: 239 contactos y cero resultados registrados. Para ésos la etapa se **deduce de
// las etiquetas**, que es lo único que hay. Las dos vías conviven y el orden importa:
//
//   1. `contactos.etapa` si está escrita — la puso una persona con Avanzar, es un hecho.
//   2. Si no, la etiqueta de desenlace de más peso.
//   3. Si tampoco, la **etapa de entrada**.
//
// El criterio de la vía 1 sobre la 2 es el mismo que `lib/negocio/fila.ts` ya defiende para la
// píldora: *"el resultado lo registra una persona con Avanzar, así que cuando existe es un hecho,
// no una inferencia"*.
// ═══════════════════════════════════════════════════════════════════════════════

import { RESULTADOS } from '../ghl/contrato.ts';
import type { Territorio } from '../datos/esquema.ts';
import type { SalidaDelCloser } from './salidas.ts';
import {
  ETAPAS_DEL_SETTER,
  ETAPA_DE_ENTRADA_DEL_SETTER,
  ETAPA_DE_LA_SALIDA_DEL_SETTER,
  type EtapaDelSetter,
} from './etapasDelSetter.ts';

/** Las siete columnas del CLOSER, en orden de recorrido: de la entrada al desenlace. */
export const ETAPAS = [
  { clave: 'agendado', nombre: 'Agendado' },
  { clave: 'seguimiento', nombre: 'Seguimiento' },
  { clave: 'cierre', nombre: 'Cierre en curso' },
  { clave: 'ganado', nombre: 'Ganado' },
  { clave: 'no_show', nombre: 'No-show' },
  { clave: 'nurture', nombre: 'Nurture' },
  { clave: 'descalificado', nombre: 'Descalificado' },
] as const;

export type EtapaDelCloser = (typeof ETAPAS)[number]['clave'];

/**
 * Una etapa de cualquiera de los dos embudos.
 *
 * La unión y no una lista compartida: cada pipeline valida contra **las suyas**, y eso es lo que
 * hace que un contacto que cruzó de territorio caiga a la etapa de entrada del nuevo en vez de
 * quedarse en una columna que allá no se dibuja. Ver el encabezado de `etapasDelSetter.ts`.
 */
export type Etapa = EtapaDelCloser | EtapaDelSetter;

const CLAVES: readonly EtapaDelCloser[] = ETAPAS.map((e) => e.clave);
const CLAVES_DEL_SETTER: readonly EtapaDelSetter[] = ETAPAS_DEL_SETTER.map((e) => e.clave);

/**
 * LA ETAPA DE ENTRADA — un respaldo con nombre, no un valor por omisión escondido.
 *
 * Un contacto del territorio del closer sin ningún desenlace es alguien que **ya agendó** —el
 * traspaso de zona lo hace el CRM justo al agendar— y que todavía no recibió ningún Avanzar. Eso es
 * exactamente `agendado`: la entrada del Pipeline, no un «no sé dónde ponerlo».
 *
 * Por eso es una constante y no un `?? 'agendado'` al final de una función: es una regla de
 * negocio, y escondida en un operador se lee como un descuido.
 */
export const ETAPA_DE_ENTRADA: EtapaDelCloser = 'agendado';

/** A qué columna del CLOSER lleva cada una de sus seis salidas. */
export const ETAPA_DE_LA_SALIDA: Readonly<Record<SalidaDelCloser, EtapaDelCloser>> = {
  venta: 'ganado',
  // Hay plata comprometida y no cobrada: más que cualquier estado pendiente, menos que la venta.
  acuerdo_sin_pago: 'cierre',
  seguimiento: 'seguimiento',
  no_interesa: 'descalificado',
  no_show: 'no_show',
  nurture: 'nurture',
};

/* ── LAS TRES DEL SETTER YA NO ESTÁN ACÁ, Y ES UNA CORRECCIÓN ────────────────
 *
 * Este mapa tenía las nueve salidas y mandaba `venta_chica` a `ganado` —la columna de una venta del
 * closer— con un comentario que **admitía que estaban mal**: «no son del Pipeline del closer». Una
 * venta chica de $497 dibujada en la misma columna que un cierre de $12.000 no es un detalle de
 * presentación: son dos negocios sumados en un número.
 *
 * Ahora cada catálogo mapea SUS salidas a SUS etapas, y la garantía de exhaustividad no se pierde:
 * sigue siendo un `Record` completo dentro de cada negocio. Se gana exactitud sin perder nada. */

/** El índice rol → embudo. Existe una sola vez, como el de las salidas. */
const EMBUDOS = {
  closer: {
    etapas: ETAPAS as readonly { clave: string; nombre: string }[],
    claves: CLAVES as readonly string[],
    entrada: ETAPA_DE_ENTRADA as Etapa,
    deLaSalida: ETAPA_DE_LA_SALIDA as Readonly<Record<string, Etapa>>,
  },
  setter: {
    etapas: ETAPAS_DEL_SETTER as readonly { clave: string; nombre: string }[],
    claves: CLAVES_DEL_SETTER as readonly string[],
    entrada: ETAPA_DE_ENTRADA_DEL_SETTER as Etapa,
    deLaSalida: ETAPA_DE_LA_SALIDA_DEL_SETTER as Readonly<Record<string, Etapa>>,
  },
} as const satisfies Record<Territorio, unknown>;

/** Las columnas de ese embudo, en orden. */
export function etapasDe(rol: Territorio): readonly { clave: string; nombre: string }[] {
  return EMBUDOS[rol].etapas;
}

/** La etapa de entrada de ese embudo. Ver por qué NO es una sola para los dos. */
export function etapaDeEntrada(rol: Territorio): Etapa {
  return EMBUDOS[rol].entrada;
}

/** A qué columna de ESE embudo lleva una salida suya. */
export function etapaDeLaSalida(rol: Territorio, salida: string): Etapa | undefined {
  return EMBUDOS[rol].deLaSalida[salida];
}

/**
 * LA PRECEDENCIA, para cuando hay varias etiquetas de desenlace a la vez.
 *
 * ── POR QUÉ HACE FALTA, Y NO ALCANZA CON «LA PRIMERA QUE APAREZCA» ──────────
 *
 * Las etiquetas **se acumulan**: registrar un resultado nuevo no borra los anteriores, y la lista
 * que devuelve el CRM **no trae fechas**. Así que un contacto puede llegar con `seguimiento` y
 * `venta_ganada` a la vez, y el orden en que vengan es arbitrario. Sin una precedencia declarada,
 * la misma persona caería en una columna u otra según cómo vino ordenada la respuesta.
 *
 * ── EL CRITERIO: CUÁL DE LAS PRESENTES DESCRIBE MEJOR EL PRESENTE ───────────
 *
 * Las etiquetas no envejecen igual. Los cinco desenlaces exclusivos se limpian entre sí, así que
 * si uno está puesto es el último de ese grupo. **`seguimiento` no lo quita nadie** —sirve antes y
 * después de la llamada—, así que una vez puesto se arrastra para siempre: prueba que el contacto
 * ESTUVO en seguimiento, nunca que ESTÁ. Por eso es la señal más débil y gana solo cuando está sola.
 *
 * El orden entre los exclusivos va de lo más definitivo a lo menos:
 *
 *   1. `venta` — se cobró. Terminal, nada lo supera.
 *   2. `acuerdo_sin_pago` — hay plata comprometida.
 *   3. `no_interesa` — cerrado en negativo, y es una decisión humana tomada.
 *   4. `nurture` — también frío, pero explícitamente reversible («no es ahora»).
 *   5. `no_show` — un hecho operativo, no una resolución: el contacto sigue vivo.
 *   6. `seguimiento` — el más pegajoso, y por eso el último.
 *
 * La secuencia más común de todas —seguimiento durante semanas y después «no le interesa»— deja al
 * contacto con las dos etiquetas. Con `seguimiento` arriba seguiría apareciendo en la columna de
 * trabajo activo de alguien que ya lo dio por perdido.
 */
export const PRECEDENCIA: readonly SalidaDelCloser[] = [
  'venta',
  'acuerdo_sin_pago',
  'no_interesa',
  'nurture',
  'no_show',
  'seguimiento',
];

/**
 * Lectura tolerante a mayúsculas y espacios.
 *
 * En la ESCRITURA la coincidencia tiene que ser exacta —una etiqueta con una letra distinta se
 * acepta con un 200 y no hace nada—, pero acá solo se está leyendo para clasificar: si la
 * subcuenta guardó `Venta_Ganada`, reconocerlo no puede romper nada, e ignorarlo mandaría a un
 * contacto vendido a la columna equivocada.
 */
const normalizar = (t: string) => t.trim().toLowerCase();

export interface Desenlace {
  salida: SalidaDelCloser;
  /** La etiqueta literal que se encontró. Es lo que permite responder «¿por qué está acá?». */
  etiqueta: string;
  etapa: Etapa;
}

/** El desenlace de más peso entre las etiquetas de un contacto, o `null` si no hay ninguno. */
export function desenlaceDeLasEtiquetas(etiquetas: readonly string[]): Desenlace | null {
  const presentes = new Set(etiquetas.map(normalizar));

  for (const salida of PRECEDENCIA) {
    const def = RESULTADOS.find((r) => r.salida === salida);
    /* Una salida sin etiqueta declarada NO clasifica por etiquetas, y no es un caso hipotético: hay
       salidas que a propósito no avisan a nadie. Sin esta guarda, `normalizar(null)` reventaría. */
    if (!def || def.etiqueta === null) continue;
    const etiqueta = def.etiqueta;
    if (presentes.has(normalizar(etiqueta))) {
      return { salida, etiqueta, etapa: ETAPA_DE_LA_SALIDA[salida] };
    }
  }
  return null;
}

/**
 * ¿La etapa escrita en la base es una de las SIETE?
 *
 * `contactos.etapa` es `text` **sin restricción** en la base —a propósito: el `check` habría que
 * migrarlo cada vez que cambia la lista— así que la validación vive en TypeScript y tiene que vivir
 * en **un solo lugar**.
 *
 * Antes existía dos veces: acá abajo, dentro de `etapaDelContacto`, y en `lib/negocio/pipeline.ts`
 * escrita como `f.etapa !== null`, que es una condición **distinta**. La consecuencia era una
 * contradicción visible sobre el mismo contacto: con una etapa retirada, la columna lo dibujaba en
 * «Agendado» —por el respaldo— y el contador lo contaba como «registrado por una persona».
 */
export function esEtapaDe(rol: Territorio, etapa: string | null): boolean {
  return etapa !== null && EMBUDOS[rol].claves.includes(etapa);
}

/**
 * La etapa de un contacto. **Las tres vías del encabezado, en orden.**
 *
 * Las etiquetas que no conoce se ignoran a propósito: la subcuenta tiene decenas —de campañas, de
 * origen, de estado— y ninguna dice en qué terminó la llamada.
 */
export function etapaDelContacto(
  rol: Territorio,
  c: { etapa: string | null; etiquetas: readonly string[] },
): Etapa {
  /* 1 · Lo que escribió una persona con Avanzar. Se valida contra las de ESTE embudo: un valor que
     acá no existe —una etapa retirada, o una del otro territorio en un contacto que cruzó— no puede
     mandar a nadie a una columna que no se dibuja, donde desaparecería sin que nada falle.

     Y es lo que hace que el traspaso se resuelva solo: la etapa del setter no es una de las siete
     del closer, así que cae a las vías 2 y 3 y termina en la entrada del closer. */
  if (esEtapaDe(rol, c.etapa)) return c.etapa as Etapa;

  // 2 · Y si no, la etiqueta de más peso. 3 · Y si tampoco, la entrada DE ESTE embudo.
  return desenlaceDeLasEtiquetas(c.etiquetas)?.etapa ?? etapaDeEntrada(rol);
}

/** Contador con TODAS las claves de ese embudo presentes, incluidas las que dan cero. */
export function contarPorEtapa(rol: Territorio, etapas: readonly Etapa[]): Record<string, number> {
  const conteo: Record<string, number> = Object.fromEntries(EMBUDOS[rol].claves.map((e) => [e, 0]));
  for (const e of etapas) {
    // Una etapa que no es de este embudo no se cuenta: `etapaDelContacto` ya garantiza que no llegue,
    // y sumarla crearía una clave que ninguna columna dibuja — un total que no cierra con la suma.
    if (e in conteo) conteo[e] = (conteo[e] ?? 0) + 1;
  }
  return conteo;
}
