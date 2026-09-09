// El NÚCLEO de las colas de Mi Día: las cuatro que los dos módulos comparten de verdad.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ EXISTE, Y CUÁL ES EXACTAMENTE LA LÍNEA
//
// El Closer tiene cinco colas y el Setter seis, con dos propias y una que acá no existe. Son dos
// composiciones distintas, y por eso son dos funciones: un tipo con `agenda?` opcional haría que una
// pantalla que se olvide de dibujar `estancadas` no muestre nada y **no falle nada**.
//
// Pero cuatro de esas colas son **la misma acción sobre el mismo dato**, y duplicarlas es garantizar
// que un día divergen. En particular el buzón: sus seis condiciones no tienen una sola línea de
// negocio de ningún rol —«una IA activa nunca genera tarea humana», «un contacto cerrado no necesita
// manos»— y su condición 6 es la **negación exacta** de la que arma «Completadas hoy». Por eso las
// dos colas no pueden contradecirse: **las decide la misma función**. Con dos copias, el día que una
// se toque el mismo contacto va a estar en las dos listas o en ninguna.
//
// ── LO QUE NO ENTRA ACÁ ─────────────────────────────────────────────────────
//
// La agenda (solo del closer), las estancadas y las oportunidades chicas (solo del setter), y **el
// contador**. El contador se suma explícito en cada composición y no se deriva de las colas: un
// `Object.values(colas).flat().length` haría que agregar una cola cambie el número sin que nadie lo
// decida — que es justo lo que `miDia.ts` ya argumenta para no sumar `.length` en los seguimientos.
//
// ═══════════════════════════════════════════════════════════════════════════════
// Y EL ORDEN DE ESTE ARCHIVO ES LA PRECEDENCIA DE LAS COLAS
//
// «Un contacto, una cola» se cumple con **un conjunto que crece** mientras las colas se arman, en
// el orden en que están escritas: Urgentes → Agenda de hoy → Seguimientos → Buzón. Cada una saltea
// a los que ya tienen cola.
//
// Eso significa que **mover un bloque de lugar en este archivo cambia el comportamiento**, y hay
// que decirlo porque no se ve: el bug que lo enseñó fue exactamente ese. Los seguimientos estaban
// escritos DEBAJO del buzón, así que cuando el buzón se armaba la lista de seguimientos todavía no
// existía y no había nada que excluir. Un contacto con un seguimiento de hoy que además había
// escrito aparecía en las dos listas, y el contador de tareas pendientes lo sumaba dos veces.
//
// La agenda del closer es la excepción y por eso entra por parámetro (`yaEnUnaColaPropia`): se
// construye en `miDia.ts`, así que su lugar en el orden lo tiene que traer resuelto quien llama.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import type { Territorio } from '../datos/esquema.ts';
import { estadoDelAgente } from '../ghl/contrato.ts';
import type { AlcanceDelCloser } from './alcanceDelCloser.ts';
import { estaCerrado, filasDeTerritorio, type Fila } from './fila.ts';
import { definicionDe } from './salidas.ts';

/**
 * Los tres tags de FALLO DEL AUDITOR, **por territorio**.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PARTIRLOS ARREGLA UN DEFECTO QUE YA ESTABA EN PRODUCCIÓN
 *
 * La lista era una sola y tenía los tres, así que la cola roja del CLOSER incluía
 * `bot_desactivado_leadflow` — que es el fallo del agente de **pre-agenda**, o sea el del setter.
 *
 * No es hipotético: el contrato mide que hay contactos con las dos zonas a la vez, y durante el
 * traspaso conviven `zona_closer` con el agente de pre-agenda. Un closer veía en su cola de
 * intervenciones urgentes el fallo de un agente que no es el suyo, con el texto «revisar la
 * conversación» sobre trabajo de otra persona.
 *
 * Y el espejo tenía el defecto simétrico y peor: copiar la lista tal cual al setter le habría
 * llenado la cola de `bot_desactivado_appflow`, el fallo del agente post-agenda, que es trabajo del
 * closer sobre contactos que el setter ya traspasó.
 *
 * ── EL LEGADO VA EN LOS DOS, Y ESO SÍ ES CORRECTO ──────────────────────────
 *
 * `bot_pausado_fallo` era el tag ÚNICO antes de separarlos, así que un contacto que lo tenga puesto
 * puede ser de cualquiera de los dos agentes: no hay forma de saberlo. Dejarlo en los dos es el lado
 * correcto del que fallar — una intervención de más se descarta mirando; una de menos no se ve.
 *
 * Y `bot_desactivado_postcall` NO está en ninguna de las dos: significa lo CONTRARIO —«esta persona
 * ya pasó por la llamada»— y un filtro por prefijo `bot_desactivado` metería a la cola roja a todos
 * los que tuvieron su llamada de cierre.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const FALLOS_DEL_AUDITOR: Readonly<Record<Territorio, readonly string[]>> = {
  closer: ['bot_desactivado_appflow', 'bot_pausado_fallo'],
  setter: ['bot_desactivado_leadflow', 'bot_pausado_fallo'],
};

/** El texto de reserva de Urgentes. **Ninguna fila queda vacía.** */
export const SIN_MOTIVO = 'Requiere intervención: revisar la conversación.';

/** Los DOS sabores de un seguimiento del día. Ver el encabezado de `miDia.ts`. */
export type CasoDeSeguimiento = 'manual_de_hoy' | 'manual_vencido';

/** Una fila de una cola: el contacto con sus seis íconos, más lo propio de la cola. */
export interface EnLaCola {
  fila: Fila;
  /** Urgentes: qué encontró el auditor. Nunca vacío — ver `SIN_MOTIVO`. */
  motivo?: string;
  /** Agenda: la hora, el estado y la sala. Solo la usa el Closer. */
  cita?: {
    inicioEl: Date | null;
    estado: string | null;
    salaUrl: string | null;
    /** `inicio < ahora`: ya empezó. Baja la fila en la lista y la marca. */
    vencida: boolean;
    /** `fin < ahora`: ya terminó. Es la que decide si el botón de unirse sigue sirviendo. */
    termino: boolean;
  };
  /* Acá vivía `fragmento`: los primeros 80 caracteres de lo que escribió el contacto, «para
     decidir sin abrir la ficha». Se fue con la simplificación de la fila (`components/closer/
     MiDia.jsx` lo dibujaba en cursiva debajo de la fila del Buzón) y el motivo es el que lo
     condena: **duplicaba** el microtexto que la fila ya mostraba entero, así que el mismo mensaje
     se leía dos veces.
     Se quita el campo y no solo su dibujo, porque un campo que el servidor calcula y nadie lee es
     el que vuelve mal el día que alguien lo encuentra y lo cree vigente. */
  /** Seguimientos: cuál de los dos casos, y si pide manos. */
  caso?: CasoDeSeguimiento;
  pideManos?: boolean;
  /** Completadas: qué la completó. */
  completadaPor?: string;
  /** Estancadas: hace cuántos días que no hay un mensaje. `null` = no se pudo medir. */
  diasSinMover?: number | null;
}

/** ¿Le respondimos? El último mensaje es NUESTRO. */
export function leRespondieron(fila: {
  ultimoEntranteEl: Date | null;
  ultimoSalienteEl: Date | null;
}): boolean {
  if (!fila.ultimoSalienteEl) return false;
  if (!fila.ultimoEntranteEl) return true;
  return new Date(fila.ultimoSalienteEl).getTime() >= new Date(fila.ultimoEntranteEl).getTime();
}

/** ¿Tiene alguno de estos tags? Lectura TOLERANTE — ver el `02` regla 5. */
export function tiene(etiquetas: readonly string[], buscadas: readonly string[]): boolean {
  const puestas = new Set(etiquetas.map((e) => e.trim().toLowerCase()));
  return buscadas.some((b) => puestas.has(b));
}

/**
 * Una fila para un resultado cuyo contacto ya no está en la caché.
 *
 * Todo en nulo o en cero MEDIDO, y el nombre dice lo que es. No se inventa un nombre ni se apagan
 * los íconos como si fueran ceros: van como **no medidos**, porque es exactamente eso.
 */
export function filaHuerfana(id: string): Fila {
  return {
    id,
    ghlContactId: null,
    nombre: 'Contacto que ya no está en el pipeline',
    telefono: null,
    email: null,
    score: null,
    fuente: '—',
    etapa: null,
    ultimoEntranteEl: null,
    ultimoEntranteTexto: null,
    ultimoSalienteEl: null,
    congelado: false,
    /* `null` por el mismo motivo que `congelado: false`: de este contacto **no se sabe nada**, y
       afirmarle un territorio sería inventarle un dato. */
    territorio: null,
    situacion: 'sin_resultado',
    pildora: null,
    etiquetas: [],
    estancado: false,
    iconos: {
      reunionesTenidas: 0,
      citaFutura: false,
      llamadasContestadas: 0,
      estadoAgente: 'sin_agente',
      seguimientoAbierto: false,
      montoVenta: null,
    },
  };
}

/** Lo que las dos composiciones necesitan para armar sus propias colas encima. */
export interface NucleoDeColas {
  filas: Fila[];
  porId: Map<string, Fila>;
  /** `true` si el territorio no cupo entero. */
  truncado: boolean;
  /** La medianoche de HOY en la zona de la organización, en milisegundos. */
  medianocheDeHoy: number;
  urgentes: EnLaCola[];
  /** Quiénes están en Urgentes: gana la cola más específica. */
  enUrgentes: Set<string>;
  /**
   * Quiénes ya tienen ALGUNA de las colas que arma esta función, más las que llegaron por
   * `yaEnUnaColaPropia`. Es la regla «un contacto, una cola» hecha un dato.
   *
   * Viaja para que una composición pueda seguir la cadena con sus colas de MENOS precedencia — hoy
   * las dos del setter, que van debajo del buzón. Antes el setter armaba su propio `Set` a partir
   * de `enUrgentes` y del buzón, y esa copia era el segundo lugar donde estaba escrito el orden.
   */
  yaTieneCola: Set<string>;
  buzon: EnLaCola[];
  seguimientos: EnLaCola[];
  completadas: EnLaCola[];
}

/**
 * Las cuatro colas compartidas, ya armadas. **Corre dentro de `conOrganizacion(`.**
 *
 * Cero llamadas al CRM: todo sale de la caché propia.
 */
export async function nucleoDeColas(
  rol: Territorio,
  zonaHoraria: string,
  /** De quién son los leads. Ausente = todo el territorio, que es lo que hace el Setter. */
  alcance?: AlcanceDelCloser,
  /**
   * Los que la composición YA puso en una cola propia de más precedencia que los seguimientos.
   *
   * Hoy es una sola: la **Agenda de hoy** del closer. Entra por parámetro y no se calcula acá
   * porque las citas son del closer y este archivo es el núcleo compartido — deducirlo sería meter
   * un concepto de una pantalla en la función que sirve a las dos.
   *
   * Va por parámetro y no como un `Set` que el llamador rellene después, y esa es la parte que
   * importa: **el buzón se arma acá adentro**, así que si la exclusión llegara tarde el buzón ya
   * estaría hecho. Es lo que pasaba con los seguimientos antes de este arreglo.
   */
  yaEnUnaColaPropia: ReadonlySet<string> = new Set(),
): Promise<NucleoDeColas> {
  /* Sin `conCongelados`: un contacto sin territorio no es trabajo de nadie, y las colas son
     trabajo. El Pipeline sí los trae, porque ahí es información. */
  const { filas, hayMas } = await filasDeTerritorio(rol, { todas: true, alcance });
  const porId = new Map(filas.map((f) => [f.id, f]));

  /* ── LOS AVANCES DE HOY SE LEEN ACÁ ARRIBA, Y EL ORDEN NO ES CAPRICHO ──────
   *
   * Alimentan «Completadas hoy», que va última en la pantalla. Pero el BUZÓN necesita saber quién ya
   * se cerró hoy para no ponerlo en dos colas a la vez, así que la consulta tiene que estar resuelta
   * antes de ese bucle.
   *
   * Se lee una vez y se usa dos. La alternativa era consultarla dos veces, y entonces las dos colas
   * podrían discrepar: la misma tabla leída en dos instantes distintos de la misma petición. */
  const avances = await datos()
    .selectFrom('resultados')
    .select(['contacto_id', 'salida', 'creado_el'])
    .where(
      'creado_el',
      '>=',
      sql<Date>`date_trunc('day', timezone(${zonaHoraria}, now())) at time zone ${zonaHoraria}`,
    )
    /* EL FILTRO POR ROL. Sin él, un resultado del SETTER de hoy —`agendo`, `venta_chica`— caía en
       las «Completadas hoy» del closer, y como su contacto vive en el otro territorio no está en
       `porId`: salía como fila huérfana, o sea la línea «Contacto que ya no está en el pipeline»
       sobre alguien que está perfectamente en el pipeline del otro módulo. Dos afirmaciones falsas
       en una fila.

       Y va junto con el territorio de `filasDeTerritorio` de arriba: separarlos es cómo se llega a
       las colas de un territorio con los avances del otro. */
    .where('rol', '=', rol)
    .orderBy('creado_el', 'desc')
    .execute();

  const completadasDeHoy = new Set(avances.map((a) => a.contacto_id));

  /* ── EL MOTIVO REAL DE CADA URGENCIA ──────────────────────────────────────
   *
   * Hasta acá esta cola decía siempre lo mismo: *«Requiere intervención: revisar la conversación»*.
   * Era honesto —no inventaba un diagnóstico— y se leía mal: como si el auditor hubiera encontrado
   * algo y no lo hubiera dicho. La causa era que el auditor **no existía**, y ahora existe.
   *
   * Se lee del análisis con intervención MÁS RECIENTE de cada contacto. `distinct on` y no un
   * `group by` con subconsulta: es una sola pasada por el índice `analisis_por_contacto`, y sobre
   * todo dice lo que se quiere sin que haya que leerlo dos veces.
   *
   * ── Y SE CONSULTA PARA TODOS, NO SOLO PARA LOS QUE ENTRAN A LA COLA ──────
   *
   * Porque quién entra se decide **después**, en el bucle de abajo, y para decidirlo hace falta el
   * territorio y la situación de cada fila. Filtrar acá exigiría adelantar esa decisión o hacer dos
   * consultas: una lista con las intervenciones abiertas de la empresa es más chica que cualquiera
   * de las dos alternativas —son las conversaciones que un humano tiene que tomar ahora, no un
   * histórico— y se paga una sola vez. */
  const conIntervencion = await datos()
    .selectFrom('analisis_del_agente')
    .select(['contacto_id', 'motivo', 'resuelto_el'])
    .distinctOn('contacto_id')
    .where('intervencion', '=', true)
    .orderBy('contacto_id')
    .orderBy('analizado_el', 'desc')
    .execute();
  const intervencionDe = new Map(conIntervencion.map((a) => [a.contacto_id, a]));

  /* La medianoche de HOY en la zona de la organización, del mismo reloj que las consultas: `now()`
     devuelve el instante en que empezó la TRANSACCIÓN, así que es literalmente el mismo instante que
     usaron las de arriba. Comparar contra el `Date.now()` del proceso sería otro reloj, y la misma
     fila podría caer de un lado en una cola y del otro en la siguiente. */
  const hoy = await datos()
    .selectNoFrom(
      sql<Date>`date_trunc('day', timezone(${zonaHoraria}, now())) at time zone ${zonaHoraria}`.as(
        'dia',
      ),
    )
    .executeTakeFirstOrThrow();
  const medianocheDeHoy = hoy.dia.getTime();

  /* ══════════════════════════════════════════════════════════════════════════
   * UN CONTACTO, UNA COLA — Y ACÁ ESTÁ EL ORDEN, ESCRITO
   *
   * La regla ya estaba escrita, en `miDiaDelSetter.ts`, con su motivo medido: *«dos colas para la
   * misma persona hacen que atender una no cierre la otra, y el closer termina trabajando el mismo
   * caso dos veces sin saberlo»*. Y tenía DOS agujeros, los dos porque el orden del archivo no era
   * el orden de la precedencia:
   *
   *   · **Los seguimientos se armaban DESPUÉS del buzón**, así que el buzón no los podía excluir.
   *   · **La agenda del closer se arma en otra función**, después de que ésta devuelve.
   *
   * No era hipotético. Medido en producción el 2026-09-09, antes de tocar nada: 1 contacto en
   * `buzón ∩ seguimientos` —el que lo reportó— y 1 en `urgentes ∩ seguimientos`. Y una consecuencia
   * que nadie había mirado: `tareasPendientes` suma `urgentes + buzón + seguimientos`, así que los
   * dos se contaban **dos veces** y el número del menú, del título de Inicio y del encabezado de Mi
   * Día estaba inflado en 2.
   *
   * El orden, de más específico a más general:
   *
   *   1 · **Urgentes** — el agente falló. Alguien tiene que mirar la conversación antes que nada.
   *   2 · **Agenda de hoy** — hay una reunión a una hora concreta. Llega por `yaEnUnaColaPropia`.
   *   3 · **Seguimientos** — hay un compromiso con fecha, puesto a mano.
   *   4 · **Buzón** — escribió y nadie contestó. Es el general: *«lo que no cayó en ninguna otra»*.
   *
   * Las dos colas propias del setter —oportunidades y estancadas— siguen DEBAJO del buzón, con el
   * argumento que ya está escrito allá: el buzón es la única cola con una contraparte esperando del
   * otro lado, y las otras dos son pasivas.
   *
   * Se hace con UN conjunto que crece, y no con una cadena de `continue` por cola: con la cadena
   * hay que leer las cuatro colas enteras para saber el orden, y agregar una quinta obliga a
   * acordarse de tocar las cuatro.
   * ══════════════════════════════════════════════════════════════════════════ */
  const yaTieneCola = new Set<string>();

  // ── 1 · URGENTES ──────────────────────────────────────────────────────────
  const urgentes: EnLaCola[] = [];
  const enUrgentes = new Set<string>();
  for (const fila of filas) {
    if (!tiene(fila.etiquetas, FALLOS_DEL_AUDITOR[rol])) continue;
    /* ── EL ENGANCHE: LA COLA MIRA LAS DOS COSAS ───────────────────────────
     *
     * Entrar es por la ETIQUETA, y salir tiene que poder ser por LA RESOLUCIÓN. Con la etiqueta
     * sola quedaban dos agujeros, uno temporal y uno permanente:
     *
     *   · Las etiquetas viven en el CRM y acá se leen de la caché, que se refresca cuando el
     *     barrido relee los contactos. Entre resolver y ese barrido pasan **hasta diez minutos** en
     *     los que alguien ya atendió el caso y la pantalla sigue pidiendo que lo atiendan.
     *
     *   · Y si el CRM rechaza el borrado —es otro sistema y puede fallar— la etiqueta **no se va
     *     nunca**: el contacto se queda en la cola roja para siempre, resuelto.
     *
     * La resolución es nuestra y es inmediata, así que es la que manda. Lo que el CRM no haya
     * aceptado se reporta aparte —«se hizo» y «salió bien» son dos hechos— y el agente sigue
     * pausado hasta que alguien saque la etiqueta a mano. */
    if (intervencionDe.get(fila.id)?.resuelto_el != null) continue;
    /* Un contacto CERRADO no entra, por más que el bot haya fallado. Las etiquetas viven en el CRM y
       **nadie las quita**: registrar un resultado solo agrega. Sin esta línea, un contacto
       descalificado se queda en la cola roja para siempre, tachado y con su píldora al lado, mientras
       la fila dice «revisar la conversación» sobre alguien que ya se revisó y se cerró. */
    if (estaCerrado(fila.situacion)) continue;
    enUrgentes.add(fila.id);
    /* ── EL TEXTO DE RESERVA NO SE BORRA, Y ES DELIBERADO ──────────────────
     *
     * Un contacto puede tener la etiqueta **sin** análisis con intervención, y no es un error: son
     * dos fuentes independientes. La etiqueta la pone el CRM y la escribe también la plataforma
     * anterior; el análisis lo escribe este módulo, que empezó a correr un día concreto. Todo lo
     * marcado antes de ese día entra a la cola sin motivo nuestro.
     *
     * Y `?? SIN_MOTIVO` cubre además el caso en que el modelo pidió intervención y **no dejó una
     * frase**: el escritor guarda `null` en vez de una fila muda, justamente para que el respaldo
     * de acá haga su trabajo. Ninguna fila de esta cola queda vacía. */
    urgentes.push({ fila, motivo: intervencionDe.get(fila.id)?.motivo ?? SIN_MOTIVO });
  }
  for (const x of enUrgentes) yaTieneCola.add(x);

  /* ── 2 · LA AGENDA DE HOY, QUE NO SE ARMA ACÁ ──────────────────────────────
   *
   * Es la única cola de la precedencia que esta función no construye: las citas son del closer.
   * Llega ya resuelta por parámetro, y se anota acá —en su lugar del orden— para que las dos colas
   * de abajo la excluyan.
   *
   * Va DESPUÉS de urgentes, así que un contacto con cita hoy y con el bot fallado queda en
   * Urgentes: `miDia.ts` saltea a los de `enUrgentes` al armar sus filas de agenda, para que la
   * exclusión sea de verdad y no solo en un sentido. */
  for (const x of yaEnUnaColaPropia) yaTieneCola.add(x);

  // ── 3 · SEGUIMIENTOS DE HOY ───────────────────────────────────────────────
  //
  // ── ESTE BLOQUE ESTABA DEBAJO DEL BUZÓN, Y ESO ERA EL DEFECTO ─────────────
  //
  // Se armaba después, así que el buzón no lo podía excluir: un contacto con un seguimiento de hoy
  // que además había escrito aparecía en las DOS listas. Es el bug que se reportó, con la captura.
  //
  // Subirlo es todo el arreglo del lado del buzón. Y no alcanzaba con excluirlo desde el buzón
  // «leyendo los seguimientos»: el buzón se arma en este mismo recorrido, así que la lista tenía
  // que existir antes. El orden del archivo ES la precedencia.
  //
  // **Solo los MANUALES**: los automáticos los hace el CRM con su secuencia y no escriben tarea.
  //
  // El DÍA se compara con el DÍA y no el instante con el instante. `tareas.vence_el` es una columna
  // `date`, así que su valor es medianoche de ese día: comparándolo contra `now()` **todo** salía
  // vencido, y la pantalla ponía «Vencido» en rojo sobre un seguimiento que tocaba justamente hoy.
  const tareas = await datos()
    .selectFrom('tareas')
    .select(['contacto_id', 'vence_el'])
    .where('completada_el', 'is', null)
    .where(
      'vence_el',
      '<',
      sql<Date>`(date_trunc('day', timezone(${zonaHoraria}, now())) + interval '1 day') at time zone ${zonaHoraria}`,
    )
    .orderBy('vence_el', 'asc')
    .execute();

  const seguimientos: EnLaCola[] = [];
  for (const t of tareas) {
    /* El cruce contra `porId` es lo que acota los seguimientos AL TERRITORIO: `negocio.tareas` no
       tiene columna de rol, así que sin este cruce un setter vería los seguimientos del closer. Y no
       falla: simplemente ve tareas que no son suyas. */
    const fila = porId.get(t.contacto_id);
    if (!fila) continue;
    /* Y la precedencia: los de Urgentes y los de la Agenda de hoy ya tienen cola. Medido en
       producción, `urgentes ∩ seguimientos` era 1 — un contacto en las dos listas, contado dos
       veces en el número de tareas pendientes. */
    if (yaTieneCola.has(fila.id)) continue;
    /* ── Y «COMPLETADAS HOY» **NO** EXCLUYE ACÁ, QUE ES LO CONTRARIO DEL BUZÓN ──
     *
     * Puse la exclusión por analogía con el buzón —que sí la tiene, con el motivo *«registrar un
     * resultado deja al contacto en el buzón Y en Completadas hoy a la vez»*— y la analogía era
     * FALSA. Lo dijo `pruebas/base/92-mi-dia`: «un Avanzar CON fecha nueva no cierra la tarea que
     * acaba de crear» se puso roja al instante.
     *
     * El motivo, que es el que hay que conservar escrito: **`seguimiento` es una salida de
     * Avanzar**, y registrarla es lo que CREA la tarea. O sea que todo seguimiento manual nace con
     * su contacto dentro de `completadasDeHoy`, y con la exclusión desaparecía en el mismo momento
     * de crearse. El síntoma habría sido «puse una fecha y el seguimiento no aparece», sin ningún
     * error — el defecto que esa prueba ya vigilaba por otro camino.
     *
     * Y mirado de frente, no es un solapamiento: «hoy avancé este contacto poniéndole un
     * seguimiento» y «ese seguimiento está pendiente» son las dos ciertas. **Completadas hoy no es
     * una cola de trabajo, es el registro de lo que se hizo** — por eso tampoco suma al contador de
     * tareas pendientes. La regla «un contacto, una cola» habla de las colas de trabajo.
     *
     * Lo había medido en producción y daba cero casos, así que la medición no me protegió: era un
     * cero de los datos de hoy, no una propiedad. La prueba sí. */
    const vencida = new Date(t.vence_el).getTime() < medianocheDeHoy;
    seguimientos.push({ fila, caso: vencida ? 'manual_vencido' : 'manual_de_hoy', pideManos: true });
    yaTieneCola.add(fila.id);
  }

  // ── 4 · BUZÓN, QUE ES EL GENERAL ──────────────────────────────────────────
  //
  // La regla, en una línea: **el último mensaje es de ellos y no nuestro.**
  //
  //   escribe                    → entrante > saliente → entra
  //   se le responde             → saliente > entrante → sale
  //   vuelve a escribir          → entrante > saliente → entra de nuevo, solo
  //
  // Y cubre las dos vías de responder: el envío desde esta plataforma y la respuesta hecha en el
  // CRM, que entra por la ingesta. Las dos mueven `ultimo_saliente_el`.
  //
  // ── Y ES EL ÚLTIMO DE LA PRECEDENCIA, QUE ES LO QUE SIGNIFICA «GENERAL» ───
  //
  // Se pidió con estas palabras: *«como dice su nombre, buzón general es de forma general, que no
  // estén en seguimiento o intervenciones urgentes o agenda de hoy»*. O sea: no es una cola más, es
  // **el resto**. Por eso la condición 2 dejó de ser «no está en Urgentes» y pasa a ser «no tiene
  // ninguna cola»: con la lista de colas nombrada una por una, agregar una quinta obliga a
  // acordarse de venir a agregarla acá — y olvidarse no falla, duplica.
  const buzon: EnLaCola[] = [];
  for (const fila of filas) {
    // 1 · no congelado → garantizado por el territorio de la consulta.
    // 2 · no tiene ya una cola: Urgentes, Agenda de hoy o Seguimientos. Gana la más específica.
    if (yaTieneCola.has(fila.id)) continue;
    // 3 · tampoco si YA SE CERRÓ HOY: sin esto, registrar un resultado deja al contacto en el buzón
    //     Y en «Completadas hoy» a la vez.
    if (completadasDeHoy.has(fila.id)) continue;
    // 4 · el bot está APAGADO. **La regla de fondo: una IA activa nunca genera tarea humana.**
    const agente = estadoDelAgente(fila.etiquetas);
    if (
      agente === 'atendiendo' ||
      agente === 'atendiendo_pre_agenda' ||
      agente === 'atendiendo_post_agenda'
    ) {
      continue;
    }
    /* 5 · y NO ESTÁ CERRADO. Va junto a la condición 3 y no la reemplaza: aquella mira lo que se
     *     cerró HOY, y un contacto descalificado hace trece días que escribió y no fue respondido
     *     entra igual. */
    if (estaCerrado(fila.situacion)) continue;
    // 6 · escribió, y **el suyo es el último mensaje**.
    if (!fila.ultimoEntranteEl) continue;
    if (leRespondieron(fila)) continue;

    buzon.push({ fila });
    /* Y se anota, para que las colas propias del setter —que van debajo— lo excluyan. Antes eso lo
       hacía `miDiaDelSetter` con un `Set` propio que rellenaba después; ahora la cadena es una y
       vive donde vive el orden. */
    yaTieneCola.add(fila.id);
  }
  // El mensaje MÁS RECIENTE primero.
  buzon.sort(
    (a, b) =>
      new Date(b.fila.ultimoEntranteEl ?? 0).getTime() -
      new Date(a.fila.ultimoEntranteEl ?? 0).getTime(),
  );

  // ── COMPLETADAS HOY ───────────────────────────────────────────────────────
  //
  // **SIEMPRE se dibuja, vacía o no.** Dos orígenes: un resultado de Avanzar registrado hoy, y
  // haberle respondido hoy a alguien que estaba en el buzón.
  const completadas: EnLaCola[] = [];
  const yaEnCompletadas = new Set<string>();
  for (const a of avances) {
    const fila = porId.get(a.contacto_id);
    yaEnCompletadas.add(a.contacto_id);
    completadas.push({
      // La fila HUÉRFANA entra igual: el trabajo se hizo y tiene que constar. Lo que no se hace es
      // inventarle datos.
      fila: fila ?? filaHuerfana(a.contacto_id),
      // El nombre HUMANO, del catálogo de ESTE rol. Con el del otro, la mitad de las salidas se
      // mostraría con su clave cruda delante de un cliente.
      completadaPor: definicionDe(rol, a.salida)?.nombre ?? a.salida,
    });
  }

  /* El segundo origen. Tres condiciones, y las tres hacen falta:
       1 · escribió alguna vez — si no, nunca estuvo en el buzón y no se «completó» nada;
       2 · el último mensaje es nuestro — la NEGACIÓN exacta de la condición del buzón, y por eso las
           dos colas no pueden contradecirse: la misma función las decide;
       3 · respondimos HOY — es lo que hace que la sección se vacíe sola a medianoche. */
  const atendidos = filas
    .filter((fila) => {
      if (yaEnCompletadas.has(fila.id)) return false;
      if (!fila.ultimoEntranteEl) return false;
      if (!leRespondieron(fila)) return false;
      if (!fila.ultimoSalienteEl) return false;
      return new Date(fila.ultimoSalienteEl).getTime() >= medianocheDeHoy;
    })
    .sort(
      (a, b) =>
        new Date(b.ultimoSalienteEl ?? 0).getTime() - new Date(a.ultimoSalienteEl ?? 0).getTime(),
    );

  /* Los dos orígenes van en BLOQUES y no intercalados: `EnLaCola` no lleva el instante en que se
     completó, así que cualquier orden mezclado tendría que inventar una fecha para una de las dos
     mitades. Los resultados primero, porque registrar una salida es más específico que contestar. */
  for (const fila of atendidos) {
    completadas.push({ fila, completadaPor: 'Respondido' });
  }

  return {
    filas,
    porId,
    truncado: hayMas,
    medianocheDeHoy,
    urgentes,
    enUrgentes,
    yaTieneCola,
    buzon,
    seguimientos,
    completadas,
  };
}
