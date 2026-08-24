// ADR-0305 — Un rechazo por permiso no se muestra como "no hay datos".
//
// La fila y sus seis íconos (`11` § 7.1 y § 7.2). **UN SOLO archivo para las dos pestañas.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO ES UN MÓDULO Y NO DOS CONSULTAS
//
// El `11` § 7 abre diciendo *"estos componentes se construyen una sola vez. Si se construyen
// por pantalla, divergen"*, y el § 9 regla 3 lo dice como regla: *"si dos pantallas muestran
// el mismo número, comparten la función que lo calcula. Dos implementaciones divergen en
// silencio y las dos parecen bien"*.
//
// La divergencia acá tiene una forma concreta y silenciosa: el tercer ícono cuenta llamadas
// **contestadas**, no llamadas hechas. Dos consultas escritas por separado casi seguro
// terminan con una contando `count(*)` y la otra `count(*) where contestada` — y las dos
// muestran un número plausible. El closer y el setter reportarían números distintos del mismo
// contacto y nadie sabría cuál creer.
//
// Así que la única diferencia entre las dos pestañas es el argumento `territorio`. Todo lo
// demás es literalmente el mismo código.
//
// ── EL FILTRO POR TERRITORIO ES DE NEGOCIO, NO UN PERMISO ────────────────────
//
// El `11` § 8 se hace la pregunta y la contesta: *"¿un closer ve solo sus contactos o los de
// toda la organización? Sea cual sea la respuesta, **no es un permiso**: es un filtro de
// negocio que vive en la consulta. Si fuera una capacidad, haría falta un rol nuevo por cada
// variante y el modelo de permisos se llenaría de casos particulares."*
//
// La respuesta que se eligió: **por territorio**. Un closer ve los contactos con
// `territorio = 'closer'`, que es la etiqueta `zona_closer` de GoHighLevel. No por
// responsable asignado, porque GHL no da asignación — da zona.
//
// Y el aislamiento por organización NO está acá: lo pone la política de fila, con el
// `org_id` que `conOrganizacion(` dejó en la transacción. Este archivo no nombra `org_id` ni
// una vez, y eso es la propiedad que se busca.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import type { Territorio } from '../datos/esquema.ts';
import {
  CITA_AGENDADA,
  ESTANCADO,
  SEGUIMIENTO_AUTOMATICO,
  estadoDelAgente,
  type EstadoDelAgente,
} from '../ghl/contrato.ts';

/**
 * Los seis íconos de una fila, en el orden del `11` § 7.2. **Siempre los seis.**
 *
 * ── `null` Y `0` NO SON LO MISMO, Y DE ESO DEPENDE TODO ─────────────────────
 *
 * El § 9 regla 1: *"un cero medido y un cero no medido no son el mismo hecho"*. Acá se
 * codifica en el tipo, no en un comentario:
 *
 *   · `0`    → se midió y es cero. El ícono se ATENÚA. Nunca dibuja un "0" (§ 7.2).
 *   · `null` → **no hay de dónde medirlo**. El ícono no se dibuja.
 *
 * Un `0` donde nadie cargó datos afirma un hecho falso, y es el que nadie reporta porque el
 * panel simplemente parece vacío.
 */
export interface SeisIconos {
  /** 📹 Reuniones que YA TUVO: citas cuyo inicio ya pasó. */
  reunionesTenidas: number;
  /**
   * 📅 ¿Tiene una cita?
   *
   * DOS fuentes, y la etiqueta manda. `negocio.citas` sabe CUÁNDO es —lo que hace falta para la
   * Agenda— pero está vacía mientras no se lea el calendario. La etiqueta `cita_agendada`, que
   * pone el detector post-call del CRM, dice que la hay aunque no diga cuándo.
   *
   * Se combinan en vez de elegir una: con solo la tabla, el ícono está apagado para los 238
   * contactos reales; con solo la etiqueta, se pierde la cita que ya se leyó del calendario.
   */
  citaFutura: boolean;
  /** 📞 Llamadas de agente IA **CONTESTADAS**. No las hechas — ver el encabezado. */
  llamadasContestadas: number;
  /**
   * 🤖 Estado del agente.
   *
   * ── ESTO ERA `null` SIEMPRE, Y ESTABA MAL ─────────────────────────────────
   *
   * La primera versión decía *"no hay de dónde sacarlo"* y devolvía `null`. Era falso, y el
   * documento `LISTA-TAGS` de la subcuenta lo mostró: el estado del agente sale de **diez
   * etiquetas** —la familia `bot_*`— que ya venían en cada contacto y que ya se guardaban en
   * la columna `etiquetas`. El dato estaba en la base y la fila no lo miraba.
   *
   * Se calcula AL LEER y no se guarda, por el `11` § 9 regla 4: *"lo que se calcula al leer no
   * se queda viejo; lo que se guarda calculado, sí"*. Una columna `estado_agente` quedaría
   * vieja en cuanto el CRM cambie una etiqueta entre dos sincronizaciones.
   *
   * `'sin_agente'` NO es lo mismo que no saber: significa que las etiquetas se leyeron y
   * ninguna es del agente. Es un cero medido.
   */
  estadoAgente: EstadoDelAgente;
  /**
   * ⏱ ¿Tiene un seguimiento corriendo?
   *
   * Dos fuentes, por el mismo motivo que la cita. `seguimiento_recupero` es —literal del
   * contrato— *"lo que enciende el ícono ⏱"*: significa que hay una serie automática corriendo
   * del lado del CRM. `negocio.tareas` son los seguimientos que se registran acá.
   *
   * `seguimiento_manual` NO cuenta, y es deliberado: el contrato dice que **no dispara nada**,
   * su punto es decirle al CRM que no persiga a este contacto porque lo retoma una persona.
   * Contarlo encendería el ícono de "hay algo corriendo" cuando lo que hay es lo contrario.
   */
  seguimientoAbierto: boolean;
  /**
   * 💰 El monto de la venta, o `null`.
   *
   * `null` = no hay venta registrada, o hay venta sin monto cargado. Las dos se dibujan
   * igual —sin el ícono— y es correcto: el § 4 dice que hoy *"ningún contacto tiene monto
   * cargado"*, y un `$0` ahí afirmaría "no vendiste nada".
   */
  montoVenta: string | null;
}

/** Una fila de la lista, con todo lo que el `11` § 7.1 pide dibujar. */
export interface Fila {
  id: string;
  nombre: string;
  telefono: string | null;
  /** La letra de calificación. `null` → la fila dibuja `—`. Nada la calcula todavía. */
  score: string | null;
  /**
   * El chip de fuente. **Nunca nulo**: el § 7.1 exige *"ninguna fila sin fuente: si no se
   * sabe, va un valor de reserva visible"*. La reserva la pone la base
   * (`default 'desconocida'`), no esta consulta, así que no hay forma de que llegue vacía.
   */
  fuente: string;
  /** La etapa del pipeline. `null` = sin etapa asignada — el § 4 dice que es lo normal hoy. */
  etapa: string | null;
  /** Cuándo escribió el contacto por última vez, y qué. Es el microtexto del § 7.1. */
  ultimoEntranteEl: Date | null;
  ultimoEntranteTexto: string | null;
  /** Cuándo se le escribió por última vez. */
  ultimoSalienteEl: Date | null;
  /**
   * La SITUACIÓN de la píldora. El § 7.1: *"la situación real, nunca una condición
   * temporal"*. "Estancado" y "vencido" NO salen de acá — son color de fila y microtexto,
   * que se calculan en el cliente con las fechas de arriba.
   */
  situacion: Situacion;
  /**
   * ¿El CRM lo marcó como estancado?
   *
   * NO va en la píldora. El `11` § 7.1 es explícito: *"la situación real, nunca una condición
   * temporal. «Estancado» y «vencido» se comunican con el color de la fila y el microtexto,
   * jamás con la píldora"*. Va como bandera para que la fila lo pinte.
   */
  estancado: boolean;
  iconos: SeisIconos;
}

/**
 * La situación real de un contacto, que es lo que dibuja la píldora.
 *
 * Sale del ÚLTIMO resultado registrado, no de la etapa: la etapa la mueve un workflow de GHL
 * y hoy casi nadie la tiene (`11` § 4). El resultado lo registra una persona con Avanzar, así
 * que cuando existe es un hecho, no una inferencia.
 *
 * `sin_resultado` no es "ninguno": es "todavía nadie registró uno", que es distinto y se
 * dibuja distinto.
 */
export type Situacion =
  | 'sin_resultado'
  | 'venta'
  | 'acuerdo_sin_pago'
  | 'seguimiento'
  | 'no_interesa'
  | 'no_show'
  | 'nurture'
  | 'agendo'
  | 'venta_chica'
  | 'no_califica';

/** El tope de filas por página. */
const POR_PAGINA = 100;

/**
 * Las filas de una pestaña, con sus seis íconos.
 *
 * ── UNA CONSULTA, NO N+1 ────────────────────────────────────────────────────
 *
 * Los seis íconos son seis agregados sobre cinco tablas distintas. Escrito como "traigo los
 * contactos y después por cada uno cuento sus citas" son 6·N consultas, y con 100 filas eso
 * son 600 viajes dentro de una transacción — el tipo de cosa que funciona con datos de prueba
 * y se cae con datos reales.
 *
 * Van como subconsultas correlacionadas en la misma sentencia. Y hay una razón de corrección
 * además de la de velocidad: **todo pasa por la misma transacción, así que todo ve el mismo
 * `app.org_id`**. Seis consultas sueltas son seis oportunidades de que una se escape del
 * contexto, y una que se escape no falla: devuelve cero filas.
 *
 * @param territorio  `'closer'` o `'setter'`. El filtro de negocio del § 8.
 */
export async function filasDeTerritorio(
  territorio: Territorio,
  opciones: { pagina?: number } = {},
): Promise<{ filas: Fila[]; hayMas: boolean }> {
  const pagina = Math.max(0, Math.trunc(opciones.pagina ?? 0));

  // Se piden UNA MÁS que las que caben. Es cómo se sabe si hay más página sin pagar un
  // `count(*)` sobre toda la tabla — que con RLS encima es la consulta más cara de la lista.
  const crudas = await datos()
    .selectFrom('contactos as c')
    .where('c.territorio', '=', territorio)
    .select((eb) => [
      'c.id',
      'c.nombre',
      'c.telefono',
      'c.score',
      'c.fuente',
      'c.etapa',
      'c.ultimo_entrante_el',
      'c.ultimo_entrante_texto',
      'c.ultimo_saliente_el',
      // Las etiquetas crudas. De acá salen tres de los seis íconos y la marca de estancado.
      'c.etiquetas',

      // 📹 Reuniones que YA TUVO. `inicio_el < now()`, y las que no tienen fecha de inicio
      // no cuentan: una cita sin inicio no es una reunión que ocurrió.
      eb
        .selectFrom('citas')
        .whereRef('citas.contacto_id', '=', 'c.id')
        .where('citas.inicio_el', '<', sql<Date>`now()`)
        .select(({ fn }) => fn.countAll<string>().as('n'))
        .as('reuniones_tenidas'),

      // 📅 ¿Cita futura? `exists`, no un conteo: el ícono dice sí o no.
      eb
        .exists(
          eb
            .selectFrom('citas')
            .whereRef('citas.contacto_id', '=', 'c.id')
            .where('citas.inicio_el', '>=', sql<Date>`now()`)
            .select(sql`1`.as('x')),
        )
        .as('cita_futura'),

      // 📞 CONTESTADAS. El `where` de esta línea es el que divergiría si hubiera dos
      // implementaciones — ver el encabezado.
      eb
        .selectFrom('llamadas')
        .whereRef('llamadas.contacto_id', '=', 'c.id')
        .where('llamadas.contestada', '=', true)
        .select(({ fn }) => fn.countAll<string>().as('n'))
        .as('llamadas_contestadas'),

      // ⏱ Seguimiento corriendo: una tarea sin completar. `completada_el is null` y no una
      // bandera, para que la cola no dependa de que alguien apague nada.
      eb
        .exists(
          eb
            .selectFrom('tareas')
            .whereRef('tareas.contacto_id', '=', 'c.id')
            .where('tareas.completada_el', 'is', null)
            .select(sql`1`.as('x')),
        )
        .as('seguimiento_abierto'),

      // 💰 El monto de la venta. El MÁS RECIENTE, no la suma: la fila muestra "la venta",
      // y sumar dos ventas de un mismo contacto daría un número que no corresponde a
      // ninguna. `monto` puede ser nulo con `salida = 'venta'` — el § 4 dice que hoy es el
      // caso normal— y entonces el ícono tampoco se dibuja.
      eb
        .selectFrom('resultados')
        .whereRef('resultados.contacto_id', '=', 'c.id')
        .where('resultados.salida', '=', 'venta')
        .where('resultados.monto', 'is not', null)
        .orderBy('resultados.creado_el', 'desc')
        .limit(1)
        .select('resultados.monto')
        .as('monto_venta'),

      // La SITUACIÓN: el último resultado registrado. Ver el comentario de `Situacion`.
      eb
        .selectFrom('resultados')
        .whereRef('resultados.contacto_id', '=', 'c.id')
        .orderBy('resultados.creado_el', 'desc')
        .limit(1)
        .select('resultados.salida')
        .as('ultima_salida'),
    ])
    // Por actividad entrante, y los que nunca escribieron al final. `nulls last` explícito:
    // en PostgreSQL `desc` pone los nulos PRIMERO por omisión, así que sin esto la lista
    // arranca con los contactos que nunca dijeron nada.
    .orderBy('c.ultimo_entrante_el', sql`desc nulls last`)
    // Y un desempate estable. Sin él, dos contactos con la misma fecha —o los muchos con
    // `null`— pueden salir en orden distinto en cada pedido, y la paginación repite o se
    // saltea filas sin que nada falle.
    .orderBy('c.id', 'asc')
    .limit(POR_PAGINA + 1)
    .offset(pagina * POR_PAGINA)
    .execute();

  const hayMas = crudas.length > POR_PAGINA;

  return {
    hayMas,
    filas: crudas.slice(0, POR_PAGINA).map((f) => ({
      id: f.id,
      nombre: f.nombre,
      telefono: f.telefono,
      score: f.score,
      fuente: f.fuente,
      etapa: f.etapa,
      ultimoEntranteEl: f.ultimo_entrante_el,
      ultimoEntranteTexto: f.ultimo_entrante_texto,
      ultimoSalienteEl: f.ultimo_saliente_el,
      situacion: (f.ultima_salida ?? 'sin_resultado') as Situacion,
      estancado: (f.etiquetas ?? []).includes(ESTANCADO),
      iconos: {
        // `count(*)` de PostgreSQL vuelve como `bigint`, y el controlador lo entrega en
        // texto para no perder precisión. Un `Number()` acá es seguro —no hay contacto con
        // 2^53 reuniones— pero pasarlo tal cual haría que el cliente reciba `"3"` y que
        // `n > 0` sea cierto para `"0"`.
        reunionesTenidas: Number(f.reuniones_tenidas ?? 0),
        // `Boolean(` y no el valor tal cual: kysely tipa `exists` como `SqlBool`, que admite
        // `0`/`1` además de booleanos porque otros motores devuelven eso. PostgreSQL devuelve
        // un booleano de verdad, pero dejar pasar el tipo ancho haría que el cliente pudiera
        // recibir un `0` —que en JSON es falso al evaluarlo, y verdadero si alguien compara
        // con `!== false`.
        // La tabla O la etiqueta. Ver los comentarios de los campos.
        citaFutura: Boolean(f.cita_futura) || (f.etiquetas ?? []).includes(CITA_AGENDADA),
        llamadasContestadas: Number(f.llamadas_contestadas ?? 0),
        estadoAgente: estadoDelAgente(f.etiquetas ?? []),
        seguimientoAbierto:
          Boolean(f.seguimiento_abierto) || (f.etiquetas ?? []).includes(SEGUIMIENTO_AUTOMATICO),
        montoVenta: f.monto_venta,
      },
    })),
  };
}
