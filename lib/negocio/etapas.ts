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
import type { SalidaResultado } from '../datos/esquema.ts';

/** Las siete columnas, en orden de recorrido: de la entrada al desenlace. */
export const ETAPAS = [
  { clave: 'agendado', nombre: 'Agendado' },
  { clave: 'seguimiento', nombre: 'Seguimiento' },
  { clave: 'cierre', nombre: 'Cierre en curso' },
  { clave: 'ganado', nombre: 'Ganado' },
  { clave: 'no_show', nombre: 'No-show' },
  { clave: 'nurture', nombre: 'Nurture' },
  { clave: 'descalificado', nombre: 'Descalificado' },
] as const;

export type Etapa = (typeof ETAPAS)[number]['clave'];

const CLAVES: readonly Etapa[] = ETAPAS.map((e) => e.clave);

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
export const ETAPA_DE_ENTRADA: Etapa = 'agendado';

/** A qué columna lleva cada salida de Avanzar. */
export const ETAPA_DE_LA_SALIDA: Readonly<Record<SalidaResultado, Etapa>> = {
  venta: 'ganado',
  // Hay plata comprometida y no cobrada: más que cualquier estado pendiente, menos que la venta.
  acuerdo_sin_pago: 'cierre',
  seguimiento: 'seguimiento',
  no_interesa: 'descalificado',
  no_califica: 'descalificado',
  no_show: 'no_show',
  nurture: 'nurture',
  // ── LAS DOS DEL SETTER, y no son del Pipeline del closer ──────────────────
  //
  // `agendo` es el traspaso: el contacto pasa a ser del closer y entra por la puerta. `venta_chica`
  // es un desenlace del setter que el closer nunca ve, porque ese contacto ya no está en su
  // territorio.
  //
  // Se mapean igual, y **sin ningún casteo**: el `Record<SalidaResultado, Etapa>` obliga a que
  // estén las nueve. Es lo que hace que agregar una salida al tipo **no compile** hasta que alguien
  // decida a qué columna va — en vez de caer en `undefined` y desaparecer de la pantalla.
  agendo: 'agendado',
  venta_chica: 'ganado',
};

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
export const PRECEDENCIA: readonly SalidaResultado[] = [
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
  salida: SalidaResultado;
  /** La etiqueta literal que se encontró. Es lo que permite responder «¿por qué está acá?». */
  etiqueta: string;
  etapa: Etapa;
}

/** El desenlace de más peso entre las etiquetas de un contacto, o `null` si no hay ninguno. */
export function desenlaceDeLasEtiquetas(etiquetas: readonly string[]): Desenlace | null {
  const presentes = new Set(etiquetas.map(normalizar));

  for (const salida of PRECEDENCIA) {
    const def = RESULTADOS.find((r) => r.salida === salida);
    if (!def) continue;
    if (presentes.has(normalizar(def.etiqueta))) {
      return { salida, etiqueta: def.etiqueta, etapa: ETAPA_DE_LA_SALIDA[salida] };
    }
  }
  return null;
}

/**
 * La etapa de un contacto. **Las tres vías del encabezado, en orden.**
 *
 * Las etiquetas que no conoce se ignoran a propósito: la subcuenta tiene decenas —de campañas, de
 * origen, de estado— y ninguna dice en qué terminó la llamada.
 */
export function etapaDelContacto(c: {
  etapa: string | null;
  etiquetas: readonly string[];
}): Etapa {
  // 1 · Lo que escribió una persona con Avanzar. Se valida contra las siete: un valor que ya no
  // existe —una etapa retirada— no puede mandar a un contacto a una columna que no se dibuja,
  // donde desaparecería de la pantalla sin que nada falle.
  if (c.etapa !== null && (CLAVES as readonly string[]).includes(c.etapa)) return c.etapa as Etapa;

  // 2 · Y si no, la etiqueta de más peso. 3 · Y si tampoco, la entrada.
  return desenlaceDeLasEtiquetas(c.etiquetas)?.etapa ?? ETAPA_DE_ENTRADA;
}

/** Contador con las SIETE claves siempre presentes, incluidas las que dan cero. */
export function contarPorEtapa(etapas: readonly Etapa[]): Record<Etapa, number> {
  const conteo = Object.fromEntries(CLAVES.map((e) => [e, 0])) as Record<Etapa, number>;
  for (const e of etapas) conteo[e] += 1;
  return conteo;
}
