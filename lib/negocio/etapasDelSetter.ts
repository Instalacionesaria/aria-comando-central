// Las columnas del Pipeline del SETTER. **Isomorfo: sin base, sin React, sin red.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// SON OTRO EMBUDO, NO UNA VARIANTE DEL DEL CLOSER
//
// El closer tiene siete columnas y **ninguna de las suyas significa lo mismo**: allá se recorre de
// la cita a la venta, acá de la entrada del lead a la cita. Por eso son dos catálogos y no una lista
// con un campo `rol`.
//
// ── LO QUE PASA CUANDO UN CONTACTO CRUZA DE TERRITORIO, Y SE RESUELVE SOLO ──
//
// `contactos.etapa` es UNA columna de texto sin restricción, y el traspaso no la limpia. Así que un
// contacto que pasa del setter al closer llega con una etapa del setter escrita.
//
// No hace falta ninguna defensa nueva: **cada pipeline valida contra sus propias claves**. Una etapa
// del setter no es una de las del closer, así que cae a la derivación por etiquetas y de ahí a la
// etapa de entrada del closer — que es la respuesta correcta, porque ningún closer registró nada
// todavía. Y al revés, igual.
//
// Es lo que hace que la regla «cada uno valida contra las suyas» valga más que una lista compartida.
// ═══════════════════════════════════════════════════════════════════════════════

import type { SalidaDelSetter } from './salidas.ts';

/**
 * Las OCHO columnas, en orden de recorrido: de la entrada al desenlace.
 *
 * ── POR QUÉ OCHO Y NO LAS SIETE DE LA REFERENCIA ───────────────────────────
 *
 * La documentación de la plataforma anterior lista siete y no tiene ninguna para una venta chica
 * **cobrada**: «Oferta chica» significa *ofrecida* —es la etiqueta de derivación, un ruteo— y meter
 * ahí a quien ya pagó hace que una venta y una oferta sin respuesta se vean iguales. Una tiene
 * trabajo pendiente y la otra no, así que son dos columnas.
 *
 * Sin `vendido`, el tablero de Inicio diría «3 ventas chicas» y el Pipeline no tendría dónde
 * mostrarlas: el número y la pantalla se contradirían sobre el mismo hecho.
 *
 * ── Y LAS TRES CLAVES QUE COINCIDEN CON LAS DEL CLOSER SON A PROPÓSITO ─────
 *
 * `agendado`, `nurture` y `descalificado` significan lo mismo en los dos negocios. En el caso de
 * `agendado` la coincidencia **es el punto**: es el traspaso. El setter la escribe al registrar que
 * agendó, y el closer la lee como su etapa de entrada — la misma columna vista desde los dos lados.
 */
export const ETAPAS_DEL_SETTER = [
  { clave: 'nuevo', nombre: 'Nuevo' },
  { clave: 'en_calificacion', nombre: 'En calificación' },
  // La columna caliente: califica y todavía no agendó. Es donde el setter gana o pierde el día.
  { clave: 'calificado', nombre: 'Calificado sin agendar' },
  { clave: 'oferta_chica', nombre: 'Oferta chica' },
  { clave: 'vendido', nombre: 'Vendido' },
  // Terminal para el setter, y de ENTRADA para el closer. Ver el encabezado.
  { clave: 'agendado', nombre: 'Agendado' },
  { clave: 'nurture', nombre: 'Nurture' },
  { clave: 'descalificado', nombre: 'Descalificado' },
] as const;

export type EtapaDelSetter = (typeof ETAPAS_DEL_SETTER)[number]['clave'];

/**
 * LA ETAPA DE ENTRADA DEL SETTER, y **no puede ser la del closer**.
 *
 * Allá es `agendado`, con su motivo escrito: un contacto del territorio del closer sin ningún
 * desenlace es alguien que **ya agendó**, porque el traspaso lo hace el CRM justo al agendar.
 *
 * Acá ese razonamiento se invierte. Un contacto del setter sin ningún resultado es alguien que
 * **acaba de entrar y nadie tocó**. Si el Pipeline del setter reusara la constante del closer, el
 * 100 % de su cartera abriría en `agendado` —la columna terminal— porque hoy no hay ni un resultado
 * registrado: el setter abriría su tablero y vería toda su base en la columna que significa «ya
 * está, no hay nada que hacer».
 *
 * Por eso la entrada es del rol y no del sistema.
 */
export const ETAPA_DE_ENTRADA_DEL_SETTER: EtapaDelSetter = 'nuevo';

/**
 * A qué columna lleva cada salida del setter.
 *
 * El `Record<SalidaDelSetter, EtapaDelSetter>` obliga a las cinco: agregar una salida al catálogo
 * **no compila** hasta que alguien decida su columna, en vez de caer en `undefined` y desaparecer
 * de la pantalla. Es la misma garantía que ya tenía el mapa del closer, y ahora dentro de cada
 * negocio en vez de mezclados.
 */
export const ETAPA_DE_LA_SALIDA_DEL_SETTER: Readonly<Record<SalidaDelSetter, EtapaDelSetter>> = {
  agendo: 'agendado',
  // Y NO `oferta_chica`: ésa es la oferta hecha, ésta es la cobrada. Ver el encabezado de las ocho.
  venta_chica: 'vendido',
  seguimiento: 'en_calificacion',
  no_califica: 'descalificado',
  nurture: 'nurture',
};
