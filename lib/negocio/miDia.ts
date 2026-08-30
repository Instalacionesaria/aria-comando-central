// Las cinco colas de Mi Día. UNA llamada, CERO al CRM.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA REGLA QUE GOBIERNA LAS CINCO
//
// El `01` la pone como la decisión más importante de la pantalla:
//
//   **"Ninguna cola es un campo guardado. Las cinco son consultas."**
//
// No existe una columna «está en el buzón» ni un `es_urgente`. Cada cola se calcula en el
// momento a partir de datos que ya están ahí por otro motivo, y da dos cosas gratis:
//
//   1. **Un estado guardado se desincroniza; una consulta no puede.** Con una bandera, cada
//      mensaje entrante habría que acordarse de encenderla y cada respuesta de apagarla. El día
//      que un camino se olvide, el contacto queda en la cola para siempre o no entra nunca.
//   2. **A medianoche se vacía sola.** «Completadas hoy» y «Agenda de hoy» filtran por fecha:
//      cuando cambia el día, la lista cambia sin que nadie corra nada.
//
// ── CERO LLAMADAS AL CRM, Y POR ESO PUEDE CORRER CADA 10 SEGUNDOS ───────────
//
// Todo sale de la base propia. El `04` § 8 lo pone en su tabla de presupuesto: *"Mi Día,
// Pipeline, Agenda, Inicio, Chat → 0 llamadas — todo sale de la caché"*. Las cuatro pantallas
// que el closer mira todo el día no gastan nada; el presupuesto se gasta en TRAER los datos,
// una vez, cuando cambian.
//
// ── UN CONTACTO EN UNA SOLA COLA ────────────────────────────────────────────
//
// Urgentes gana sobre Buzón. El `01`: *"dos colas para la misma persona hacen que atender una
// no cierre la otra, y el closer termina trabajando el mismo caso dos veces sin saberlo"*.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { noCancelada } from './citas.ts';
import { estaCerrado, filasDeTerritorio, type Fila } from './fila.ts';
/* `SEGUIMIENTO_AUTOMATICO` ya no se importa: la cola de seguimientos dejo de leer esa etiqueta
   cuando los automaticos salieron de Mi Dia. Sigue viva en `lib/negocio/fila.ts`, que es la que
   enciende el icono de la fila, y eso es lo correcto: la serie automatica es un HECHO del contacto,
   no una tarea de nadie. */
import { estadoDelAgente } from '../ghl/contrato.ts';
import { definicionDe } from './salidas.ts';

/**
 * Los tres tags de FALLO DEL AUDITOR. Son los únicos que meten a alguien en Urgentes.
 *
 * ── OJO CON `bot_desactivado_postcall`, QUE NO ESTÁ ACÁ ─────────────────────
 *
 * El contrato lo advierte explícitamente: *"no armes el workflow con un filtro «contiene
 * `bot_desactivado`». `bot_desactivado_postcall` ya existe y significa lo CONTRARIO — «esta
 * persona ya pasó por la llamada», no «el bot falló»"*.
 *
 * Un filtro por prefijo metería a Urgentes a todos los que tuvieron su llamada de cierre. Con
 * los datos reales de hoy eso es 32 contactos en una cola roja que dice «la IA falló».
 */
const FALLOS_DEL_AUDITOR = [
  'bot_desactivado_appflow',
  'bot_desactivado_leadflow',
  // LEGADO: era el tag único antes de separarlos. Se sigue leyendo porque quedaron contactos
  // con él puesto.
  'bot_pausado_fallo',
] as const;

/** El texto de reserva de Urgentes. **Ninguna fila queda vacía.** */
const SIN_MOTIVO = 'Requiere intervención: revisar la conversación.';

/**
 * Los DOS sabores de un seguimiento del día. Eran cuatro declarados y dos producidos.
 *
 * ── POR QUÉ SE FUERON DOS, Y NO ES LIMPIEZA COSMÉTICA ─────────────────────
 *
 * `automatico_en_curso` salió **por pedido explícito**: *«el automático solo pone la etiqueta
 * correspondiente para que se dispare una automatización preparada en GHL y entre en ese flujo»*.
 * O sea que un seguimiento automático no es trabajo de nadie en esta pantalla — lo hace el CRM — y
 * Mi Día contesta «qué tengo que hacer ahora». La señal de que la serie corre no se pierde: sigue
 * encendiendo el ícono ⏱ de la fila, que es donde corresponde que esté un hecho y no una tarea.
 *
 * `serie_agotada` salió porque **nunca se produjo**. Significaba «la serie automática se acabó sin
 * respuesta, ahora hace falta una persona», y su marca candidata —`seguimiento_terminado`— figura en
 * `lib/ghl/contrato.ts` con `confianza: 'sin_confirmar'` y la nota *«existe en la subcuenta y nadie
 * confirmó qué significa»*. Un sabor declarado que nada produce es una rama de interfaz muerta que
 * se lee como si funcionara; queda anotado en `docs/DESPLIEGUE.md` como lo que falta averiguar.
 */
export type CasoDeSeguimiento = 'manual_de_hoy' | 'manual_vencido';

/** Una fila de una cola: el contacto con sus seis íconos, más lo propio de la cola. */
export interface EnLaCola {
  fila: Fila;
  /** Urgentes: qué encontró el auditor. Nunca vacío — ver `SIN_MOTIVO`. */
  motivo?: string;
  /** Agenda: la hora, el estado y la sala. */
  cita?: { inicioEl: Date | null; estado: string | null; salaUrl: string | null; vencida: boolean };
  /** Buzón: los primeros 80 caracteres de lo que escribió, para decidir sin abrir la ficha. */
  fragmento?: string;
  /** Seguimientos: cuál de los cuatro casos, y si pide manos. */
  caso?: CasoDeSeguimiento;
  pideManos?: boolean;
  /** Completadas: qué la completó. */
  completadaPor?: string;
}

export interface MiDia {
  urgentes: EnLaCola[];
  agenda: EnLaCola[];
  buzon: EnLaCola[];
  seguimientos: EnLaCola[];
  completadas: EnLaCola[];
  /**
   * El contador de tareas pendientes.
   *
   * ── EL DETALLE QUE «CASI SIEMPRE SE IMPLEMENTA MAL» ───────────────────────
   *
   * Cuenta los seguimientos que PIDEN MANOS, no todos los de la lista. Los
   * `automatico_en_curso` **se muestran** —el closer quiere ver que la serie está corriendo—
   * pero **no suman**.
   *
   * El `01` explica el costo de sumarlos: *"haría que el badge diga «12 tareas pendientes»
   * cuando nueve de esas doce las está haciendo un robot. El closer abre la pantalla, ve nueve
   * filas que no requieren nada, y a la tercera vez deja de creerle al contador"*.
   *
   * Y la Agenda tampoco suma: una cita no es una tarea pendiente, es un evento.
   */
  tareasPendientes: number;
  /** `true` si el territorio no cupo entero. Ver `TOPE_SIN_PAGINAR`. */
  truncado: boolean;
}

/* ── POR QUÉ YA NO VIAJA UN «POR QUÉ ESTÁ VACÍA» ─────────────────────────────
 *
 * Había un campo `faltantes` con una frase por cola explicando que el cero venía de una fuente
 * sin conectar: *"los seguimientos manuales los crea Avanzar, que todavía no existe"*, *"la
 * búsqueda de GoHighLevel no devuelve la fecha del último entrante"*.
 *
 * Dos motivos para sacarlo, y el segundo es el que decide:
 *
 *   1. **Esos textos los lee un cliente.** Nombran endpoints, etiquetas y permisos de un CRM
 *      que no es suyo, y no le dicen nada que pueda hacer. Un vacío que se explica con jerga
 *      interna se lee como un producto roto.
 *   2. **Envejecen sin que nada falle.** El de los seguimientos afirmaba que Avanzar no existía
 *      cuando ya existía completo —interfaz, ruta y escritura— así que la pantalla mentía sobre
 *      su propio sistema. Es el mismo defecto que este archivo ya había corregido una vez en el
 *      mensaje de la agenda, con el comentario *"un mensaje de falta que sobrevive a lo que
 *      describe es peor que no tenerlo: enseña a no creerle a los demás"*.
 *
 * Un cero se muestra como un cero, con la frase neutra de su cola. Y el diagnóstico de por qué
 * una fuente no trae datos vive donde corresponde: en la pantalla de estado de las conexiones,
 * que la mira quien puede arreglarlo. */

/**
 * ¿Ya le respondimos? **`true` si el último mensaje del hilo es nuestro.**
 *
 * Sin saliente, no: nadie le contestó nunca. Con saliente y sin entrante no se llega acá —la
 * condición anterior ya cortó— pero el orden de las comparaciones lo deja igual bien.
 *
 * El `>=` y no el `>` es deliberado, y cubre un caso real: los dos sellos los escribe el mismo
 * disparador desde la misma fila de `negocio.mensajes`, y dos mensajes pueden compartir el instante
 * al milisegundo cuando entran en la misma pasada de la ingesta. Con `>` estricto, un empate dejaría
 * al contacto en el buzón; con `>=`, un empate se resuelve a favor de «ya está atendido», que es el
 * lado seguro: el error es que desaparezca una fila que alguien iba a mirar, no que quede una fila
 * fantasma sumando al contador para siempre.
 */
function leRespondieron(fila: { ultimoEntranteEl: Date | null; ultimoSalienteEl: Date | null }): boolean {
  if (!fila.ultimoSalienteEl) return false;
  if (!fila.ultimoEntranteEl) return true;
  return new Date(fila.ultimoSalienteEl).getTime() >= new Date(fila.ultimoEntranteEl).getTime();
}

/** ¿Tiene alguno de estos tags? Lectura TOLERANTE — ver el `02` regla 5. */
function tiene(etiquetas: readonly string[], buscadas: readonly string[]): boolean {
  const puestas = new Set(etiquetas.map((e) => e.trim().toLowerCase()));
  return buscadas.some((b) => puestas.has(b));
}

/**
 * Las cinco colas del día.
 *
 * ── CÓMO SE ARMA, Y POR QUÉ ES BARATO ──────────────────────────────────────
 *
 * Una consulta trae el territorio COMPLETO con sus seis indicadores —la misma que usa la lista
 * y el Pipeline, así que los íconos son el mismo dato y no tres cálculos que coinciden— y
 * después una consulta por cola para lo específico: las citas de hoy, los seguimientos, lo
 * completado.
 *
 * @param zonaHoraria La de la ORGANIZACIÓN, no la del navegador. El `01`: las citas de hoy son
 *   *"entre el inicio y el fin del día en la zona horaria de la organización"*. Un closer que
 *   viaja no ve su agenda corrida.
 */
export async function colasDelDia(zonaHoraria: string): Promise<MiDia> {
  const { filas, hayMas } = await filasDeTerritorio('closer', { todas: true });

  const resultado: MiDia = {
    urgentes: [],
    agenda: [],
    buzon: [],
    seguimientos: [],
    completadas: [],
    tareasPendientes: 0,
    truncado: hayMas,
  };

  const porId = new Map(filas.map((f) => [f.id, f]));

  /* ── LOS AVANCES DE HOY SE LEEN ACÁ ARRIBA, Y EL ORDEN NO ES CAPRICHO ──────
   *
   * Alimentan la cola 5, que va última en la pantalla. Pero el BUZÓN —cola 3— necesita saber quién
   * ya se cerró hoy para no ponerlo en dos colas a la vez, así que la consulta tiene que estar
   * resuelta antes de ese bucle.
   *
   * Se lee una vez y se usa dos. La alternativa era consultarla dos veces, y entonces las dos colas
   * podrían discrepar: la misma tabla leída en dos instantes distintos de la misma petición. */
  const avances = await datos()
    .selectFrom('resultados')
    .select(['contacto_id', 'salida', 'creado_el'])
    .where('creado_el', '>=', sql<Date>`date_trunc('day', timezone(${zonaHoraria}, now())) at time zone ${zonaHoraria}`)
    /* ── EL FILTRO POR ROL, QUE NO ESTABA ──────────────────────────────────
     *
     * Sin él, un resultado del SETTER de hoy —`agendo`, `venta_chica`— caía en las «Completadas
     * hoy» del closer. Y como su contacto vive en territorio setter, no está en `porId`: salía como
     * fila huérfana, o sea la línea «Contacto que ya no está en el pipeline» sobre alguien que
     * está perfectamente en el pipeline del otro módulo. Dos afirmaciones falsas en una fila.
     *
     * Se filtra por `rol` y **no** por `registrado_por = <el closer designado>`, y la diferencia
     * importa: las otras cuatro colas de esta pantalla son de TODO el territorio, no de una
     * persona. «Completadas hoy» tiene que leerse igual — lo que se cerró en esta zona hoy — o
     * sería la única sección con un sujeto distinto del resto de la pantalla. El cockpit SÍ es del
     * designado, y eso es otra cosa: ahí se calcula plata. */
    .where('rol', '=', 'closer')
    .orderBy('creado_el', 'desc')
    .execute();

  /** Quiénes ya se cerraron hoy. Lo usan la cola 5 (para dibujarlos) y la 3 (para no repetirlos). */
  const completadasDeHoy = new Set(avances.map((a) => a.contacto_id));

  /* La medianoche de HOY en la zona de la organización, del mismo reloj que las consultas: `now()`
     devuelve el instante en que empezó la TRANSACCIÓN, y `conOrganizacion()` envuelve todo esto en
     una sola, así que es literalmente el mismo instante que ya usaron las de arriba. Comparar contra
     el `Date.now()` del proceso sería otro reloj, y la misma fila podría caer de un lado en una cola
     y del otro en la siguiente.

     La usan DOS colas —seguimientos, para el borde del día, y completadas, para saber qué se atendió
     hoy— así que se lee una vez acá arriba. */
  const hoy = await datos()
    .selectNoFrom(
      sql<Date>`date_trunc('day', timezone(${zonaHoraria}, now())) at time zone ${zonaHoraria}`.as('dia'),
    )
    .executeTakeFirstOrThrow();
  const medianocheDeHoy = hoy.dia.getTime();

  // ── Cola 1 · URGENTES ─────────────────────────────────────────────────────
  //
  // Solo los tres tags de fallo. Y los CONGELADOS no entran: un contacto sin territorio no es
  // trabajo de este closer. Acá no hace falta filtrarlos porque `filasDeTerritorio('closer')`
  // ya pide `territorio = 'closer'`, o sea que un congelado —`territorio is null`— nunca llega.
  const enUrgentes = new Set<string>();
  for (const fila of filas) {
    if (!tiene(fila.etiquetas, FALLOS_DEL_AUDITOR)) continue;
    /* ── Y UN CONTACTO CERRADO NO ENTRA, POR MÁS QUE EL BOT HAYA FALLADO ─────
     *
     * Las tres etiquetas de arriba viven en el CRM y **nadie las quita**: registrar un resultado
     * solo AGREGA etiquetas (`etiquetasDelResultado`). Así que sin esta línea un contacto
     * descalificado se queda en la cola roja para siempre, tachado y con su píldora
     * `NO LE INTERESA` al lado, mientras la fila dice «revisar la conversación» sobre alguien que
     * ya se revisó y se cerró. Pasó, y así se encontró.
     *
     * La cola contesta «qué necesita mis manos ahora». Un contacto cerrado no necesita manos. */
    if (estaCerrado(fila.situacion)) continue;
    enUrgentes.add(fila.id);
    resultado.urgentes.push({
      fila,
      /* ── EL MOTIVO ES SIEMPRE EL MISMO TEXTO, Y CONVIENE SABER POR QUÉ ────
       *
       * Se supone que lo escribe el auditor en `negocio.hallazgos`. Esa tabla **existe completa**
       * —con `titulo`, `categoria`, `severidad`, `diagnostico`, su índice parcial de abiertos y su
       * política de aislamiento, migración 011— y **no tiene ni un lector ni un escritor en todo el
       * repositorio**. Se verificó: cero `insertInto('hallazgos')`, cero `selectFrom('hallazgos')`.
       *
       * Así que hoy este texto de reserva es el 100 % de los casos, y la pantalla lo pinta en rojo
       * debajo de cada fila urgente. Es honesto —dice «revisar la conversación» y no inventa un
       * diagnóstico— pero se lee como si el auditor hubiera encontrado algo y no lo hubiera dicho.
       *
       * Y por eso la cola está vacía: las tres etiquetas que la alimentan las pone el auditor, que
       * no existe. No es un defecto de esta función; es una fuente que falta, y está anotada en
       * `docs/DESPLIEGUE.md`. */
      motivo: SIN_MOTIVO,
    });
  }
  resultado.tareasPendientes += resultado.urgentes.length;

  // ── Cola 2 · AGENDA DE HOY ────────────────────────────────────────────────
  //
  // Las citas de hoy en la zona de la ORGANIZACIÓN, sin las canceladas.
  //
  // Y las VENCIDAS SÍ VAN, que es lo que sorprende: *"una cita cuya hora ya pasó y que nadie
  // cerró con Avanzar sigue en la lista, marcada como vencida y ordenada abajo. NO desaparece.
  // Si desapareciera, el closer perdería de vista exactamente la cita que tiene pendiente de
  // registrar"*.
  const citas = await datos()
    .selectFrom('citas')
    .select(['contacto_id', 'inicio_el', 'estado_ghl', 'sala_url'])
    // El día en la zona de la organización. `timezone(zona, now())` da el ahora local, y
    // `date_trunc('day', …)` su medianoche. Comparar contra `current_date` usaría la zona del
    // SERVIDOR, que no es la de nadie.
    .where('inicio_el', '>=', sql<Date>`date_trunc('day', timezone(${zonaHoraria}, now())) at time zone ${zonaHoraria}`)
    .where('inicio_el', '<', sql<Date>`(date_trunc('day', timezone(${zonaHoraria}, now())) + interval '1 day') at time zone ${zonaHoraria}`)
    /* Las canceladas se excluyen en la CONSULTA, y el filtro es `noCancelada()` —la misma
       definición que usan los íconos 📹 y 📅 de la fila—. Antes esta lista estaba escrita a mano acá
       y en ningún lado allá: los íconos contaban las canceladas y esta cola no, así que la misma
       cita estaba y no estaba según dónde se la mirara. */
    .where(noCancelada('estado_ghl'))
    .orderBy('inicio_el', 'asc')
    .execute();

  /* ── EL MISMO RELOJ QUE LA CONSULTA, Y ANTES ERAN DOS ──────────────────────
   *
   * Esto era `Date.now()`, el reloj de la aplicación, mientras la ventana de arriba y los íconos de
   * `fila.ts` usan `now()`, el de la base. Son dos procesos distintos y no están sincronizados: la
   * misma cita podía estar vencida acá y pendiente en su ícono.
   *
   * Se trae de la base y funciona por una propiedad que conviene nombrar: **`now()` devuelve el
   * instante en que empezó la TRANSACCIÓN**, no el de cada sentencia. Como `conOrganizacion()`
   * envuelve todo esto en una, es literalmente el mismo instante que ya usó la consulta. */
  const reloj = await datos().selectNoFrom(sql<Date>`now()`.as('ahora')).executeTakeFirstOrThrow();
  const ahora = reloj.ahora.getTime();
  for (const c of citas) {
    const fila = porId.get(c.contacto_id);
    // Sin el contacto en la caché no hay fila que dibujar. No se inventa una: el `03` pide
    // "ninguna fila sin nombre", y una fila con el nombre de la cita es trabajo de la Agenda,
    // no de esta cola.
    if (!fila) continue;
    resultado.agenda.push({
      fila,
      cita: {
        inicioEl: c.inicio_el,
        estado: c.estado_ghl,
        salaUrl: c.sala_url,
        vencida: c.inicio_el !== null && new Date(c.inicio_el).getTime() < ahora,
      },
    });
  }
  // Las vencidas ABAJO, no fuera. El orden dentro de cada grupo sigue siendo por hora.
  resultado.agenda.sort((a, b) => Number(a.cita?.vencida) - Number(b.cita?.vencida));

  // ── Cola 3 · BUZÓN ────────────────────────────────────────────────────────
  //
  // Contactos que escribieron y a los que **nadie les respondió todavía**.
  //
  // ── LA QUINTA CONDICIÓN, QUE ANTES NO EXISTÍA Y ERA EL DEFECTO CENTRAL ────
  //
  // Este encabezado describía un mecanismo de dos fechas —el último entrante contra una «última
  // resolución»— y el código de abajo tenía tres `continue` y ninguna fecha. La cuenta la dejaba
  // escrita el propio comentario que estaba acá: *«`resueltoEl` todavía no existe como columna …
  // así que hoy la condición se reduce a "escribió"»*.
  //
  // O sea que el buzón era ACUMULATIVO. Un contacto que escribió una vez se quedaba **para
  // siempre** y sumaba al contador en cada ciclo de diez segundos, aunque se le hubiera respondido
  // desde esta plataforma, desde el CRM, o registrando un Avanzar. No fallaba nada: el badge de
  // «tareas pendientes» simplemente crecía y crecía hasta dejar de significar algo.
  //
  // ── Y LA CURA NO NECESITÓ NINGUNA COLUMNA NUEVA ───────────────────────────
  //
  // La pieza estaba puesta y nadie la leía: `contactos.ultimo_saliente_el`, que la migración 013
  // mantiene con un disparador y que ya viajaba en esta misma `Fila` (`ultimoSalienteEl`).
  //
  // La regla es la que se pidió con estas palabras: *«solo debe estar cuando el último mensaje es
  // de ellos y no nuestro»*. O sea **el último mensaje es ENTRANTE**:
  //
  //   escribe                    → entrante > saliente → entra
  //   se le responde             → saliente > entrante → sale
  //   vuelve a escribir          → entrante > saliente → entra de nuevo, solo
  //
  // Y cubre lo que un «sello de resolución» NO habría cubierto, que es la mitad del pedido:
  // *«respondidos por nuestra parte, o de nuestra plataforma y/o de cualquier lado»*. Las dos vías
  // escriben en `negocio.mensajes` con su dirección —el envío propio en
  // `app/api/contactos/[id]/mensajes/route.ts` y la respuesta hecha en el CRM, que entra por
  // `lib/negocio/ingesta.ts`— así que las dos mueven `ultimo_saliente_el`. Un sello que escribiera
  // solo esta plataforma habría dejado en el buzón a todo el que se atendió desde el CRM.
  for (const fila of filas) {
    // 1 · no congelado → garantizado por el territorio de la consulta.
    // 2 · no está ya en Urgentes → gana la cola más específica.
    if (enUrgentes.has(fila.id)) continue;
    // 3 · tampoco si YA SE CERRÓ HOY. Ver el comentario de `completadasDeHoy` más abajo: sin esto,
    //     registrar un resultado deja al contacto en el buzón Y en «Completadas hoy» a la vez, que
    //     es exactamente lo que la regla de «un contacto, una cola» venía a evitar.
    if (completadasDeHoy.has(fila.id)) continue;
    // 4 · el bot está APAGADO. **La regla de fondo: una IA activa nunca genera tarea humana.**
    const agente = estadoDelAgente(fila.etiquetas);
    if (agente === 'atendiendo' || agente === 'atendiendo_pre_agenda' || agente === 'atendiendo_post_agenda') {
      continue;
    }
    /* 5 · y NO ESTÁ CERRADO. Va junto a la condición 3 y no la reemplaza: aquella mira lo que se
     *     cerró HOY, y un contacto descalificado hace trece días que escribió y no fue respondido
     *     entra igual. Sin esto, arreglar Urgentes lo único que hacía era MUDARLO acá — el mismo
     *     contacto en otra lista, que no es arreglarlo. */
    if (estaCerrado(fila.situacion)) continue;
    // 6 · escribió, y **el suyo es el último mensaje**.
    if (!fila.ultimoEntranteEl) continue;
    if (leRespondieron(fila)) continue;

    resultado.buzon.push({
      fila,
      // Los primeros 80 caracteres, para decidir sin abrir la ficha.
      fragmento: (fila.ultimoEntranteTexto ?? '').slice(0, 80),
    });
  }
  // El mensaje MÁS RECIENTE primero.
  resultado.buzon.sort(
    (a, b) =>
      new Date(b.fila.ultimoEntranteEl ?? 0).getTime() - new Date(a.fila.ultimoEntranteEl ?? 0).getTime(),
  );
  resultado.tareasPendientes += resultado.buzon.length;

  // ── Cola 4 · SEGUIMIENTOS DE HOY ──────────────────────────────────────────
  //
  // **Solo los MANUALES**, que son los que pide una persona. Los automáticos los hace el CRM con su
  // secuencia y no se dibujan acá; ver el comentario de `CasoDeSeguimiento`.
  //
  // ── EL DÍA SE COMPARA POR DÍA, Y ANTES SE COMPARABA POR INSTANTE ──────────
  //
  // `tareas.vence_el` es una columna `date`, así que su valor es **medianoche** de ese día. La
  // condición de arriba admite `vence_el < mañana`, o sea que toda tarea admitida tiene una
  // medianoche que ya pasó — y comparándola contra `now()` **todas salían `manual_vencido`**.
  // `manual_de_hoy` era inalcanzable, y la pantalla ponía «Vencido» en rojo sobre un seguimiento que
  // tocaba justamente hoy. Una prueba lo dejaba escrito como defecto conocido.
  //
  // La cura es comparar el DÍA con el día, no el instante con el instante: la base devuelve la
  // medianoche de hoy en la zona de la organización y se compara contra ella.
  const tareas = await datos()
    .selectFrom('tareas')
    .select(['contacto_id', 'vence_el'])
    .where('completada_el', 'is', null)
    .where('vence_el', '<', sql<Date>`(date_trunc('day', timezone(${zonaHoraria}, now())) + interval '1 day') at time zone ${zonaHoraria}`)
    .orderBy('vence_el', 'asc')
    .execute();

  for (const t of tareas) {
    const fila = porId.get(t.contacto_id);
    if (!fila) continue;
    const vencida = new Date(t.vence_el).getTime() < medianocheDeHoy;
    const caso: CasoDeSeguimiento = vencida ? 'manual_vencido' : 'manual_de_hoy';
    resultado.seguimientos.push({ fila, caso, pideManos: true });
  }

  /* Todos piden manos, así que el contador suma la cola entera. El filtro `pideManos` se conserva
     —en vez de sumar `.length`— porque el campo sigue viajando a la pantalla y un día podría volver
     a haber una fila que no pida nada. Sumar el largo haría que agregar ese caso cambiara el
     contador sin que nadie toque esta línea. */
  resultado.tareasPendientes += resultado.seguimientos.filter((s) => s.pideManos).length;

  // ── Cola 5 · COMPLETADAS HOY ──────────────────────────────────────────────
  //
  // **SIEMPRE se dibuja, vacía o no**: es el ancla de la pantalla y lo único que le dice al
  // closer "esto ya lo hiciste". Y como filtra por fecha, se vacía sola a medianoche — que es
  // exactamente lo que se pidió: *«a medianoche se va solo»*, sin autorresolver nada por
  // inactividad. Un contacto que nadie atendió NO entra acá: se queda en el buzón, porque decir
  // «completado» de algo que nadie tocó es afirmar un trabajo que no ocurrió.
  //
  // La consulta vive más arriba: el buzón la necesita antes. Ver su comentario.
  //
  // ── DOS ORÍGENES, Y EL SEGUNDO SE AGREGÓ POR PEDIDO ──────────────────────
  //
  //   1 · un RESULTADO de Avanzar, registrado hoy;
  //   2 · haberle RESPONDIDO hoy a alguien que estaba en el buzón.
  //
  // El segundo es esto: *«cuando se envía el mensaje de aquí, se pasa directamente a la casilla de
  // completadas hoy»*. Antes no existía, así que responder sacaba al contacto del buzón y no lo
  // dejaba en ninguna parte: el closer atendía a alguien y la pantalla no mostraba ni rastro de que
  // lo hubiera hecho.
  const yaEnCompletadas = new Set<string>();
  for (const a of avances) {
    const fila = porId.get(a.contacto_id);
    // ── LA FILA HUÉRFANA, QUE HAY QUE DEJAR ENTRAR ──
    //
    // Si el contacto ya no está en la caché —lo sacaron del pipeline después— la fila SIGUE
    // apareciendo, sin nombre y sin íconos, pero apareciendo. El trabajo se hizo y tiene que
    // constar. Lo que NO se hace es inventarle datos.
    yaEnCompletadas.add(a.contacto_id);
    resultado.completadas.push({
      fila: fila ?? filaHuerfana(a.contacto_id),
      /* EL NOMBRE HUMANO, y antes acá viajaba el enum crudo. La pantalla lo imprimía tal cual, así
         que decía «registrado como **acuerdo_sin_pago**». Es la misma clase de defecto que el commit
         «Un cero se muestra como un cero, y no con jerga del CRM»: vocabulario interno delante de un
         cliente.
         El nombre sale de `SALIDAS`, que es el catálogo que ya usan Avanzar y el servidor para
         validar — no una segunda tabla de traducción que quedaría vieja. Si la salida no está en el
         catálogo se manda la clave: es preferible una jerga visible a inventar un nombre. */
      completadaPor: definicionDe(a.salida)?.nombre ?? a.salida,
    });
  }

  /* ── EL SEGUNDO ORIGEN: A QUIÉN LE RESPONDIMOS HOY ─────────────────────────
   *
   * Tres condiciones, y las tres hacen falta:
   *
   *   1 · **escribió alguna vez** (`ultimoEntranteEl`). Sin esto entraría todo contacto al que se le
   *       mandó un mensaje proactivo, y eso no es «completar» nada: nunca estuvo en el buzón. Es la
   *       condición que acota el pedido a lo que el pedido decía — *«el mensaje de AQUÍ»*.
   *   2 · **el último mensaje es nuestro** (`leRespondieron`). Es exactamente la negación de la
   *       condición del buzón, y por eso las dos colas no pueden contradecirse: la misma función las
   *       decide. Si escribió después de nuestra respuesta, volvió al buzón y no está atendido.
   *   3 · **respondimos HOY**. Es lo que hace que la sección se vacíe sola a medianoche, que es lo
   *       que se pidió: *«a medianoche se va solo»*. Sin esta condición, «Completadas hoy» acumularía
   *       para siempre a todo el que alguna vez se atendió — el mismo defecto que tenía el buzón.
   *
   * Y NO se autorresuelve nada por inactividad, también por pedido. Un contacto al que nadie
   * respondió se queda en el buzón: decir «completado» de algo que nadie tocó es afirmar un trabajo
   * que no ocurrió. */
  const atendidos = filas
    .filter((fila) => {
      if (yaEnCompletadas.has(fila.id)) return false;
      if (!fila.ultimoEntranteEl) return false;
      if (!leRespondieron(fila)) return false;
      if (!fila.ultimoSalienteEl) return false;
      return new Date(fila.ultimoSalienteEl).getTime() >= medianocheDeHoy;
    })
    // El más reciente primero, entre ellos.
    .sort(
      (a, b) =>
        new Date(b.ultimoSalienteEl ?? 0).getTime() - new Date(a.ultimoSalienteEl ?? 0).getTime(),
    );

  /* ── LOS DOS ORÍGENES VAN EN BLOQUES, Y NO INTERCALADOS ────────────────────
   *
   * Se intentó ordenar los dos juntos por hora y no se puede sin mentir: `EnLaCola` no lleva el
   * instante en que se completó la fila, y el de un resultado vive en `resultados.creado_el`, que no
   * viaja. Cualquier orden mezclado tendría que inventar una fecha para una de las dos mitades.
   *
   * Así que van en dos bloques, y el de los resultados primero a propósito: registrar una salida es
   * más específico que contestar un mensaje. Dentro de cada bloque el orden sí es por hora
   * descendente. */
  for (const fila of atendidos) {
    resultado.completadas.push({
      fila,
      /* Y no dice la salida, porque no hubo ninguna: dice que se contestó. Un resultado de Avanzar y
         una respuesta cierran la fila por motivos distintos, y quien lee la columna quiere saber
         cuál de los dos fue. */
      completadaPor: 'Respondido',
    });
  }

  return resultado;
}

/**
 * Una fila para un resultado cuyo contacto ya no está en la caché.
 *
 * Todo en nulo o en cero MEDIDO, y el nombre dice lo que es. No se inventa un nombre ni se
 * apagan los íconos como si fueran ceros: van como **no medidos**, porque es exactamente eso.
 */
function filaHuerfana(id: string): Fila {
  return {
    id,
    // No se sabe cuál era su identificador en el CRM: el contacto ya no está en la caché. Nulo
    // para que la ficha NO dibuje el enlace, en vez de armar uno que lleva a ninguna parte.
    ghlContactId: null,
    email: null,
    nombre: 'Contacto que ya no está en el pipeline',
    telefono: null,
    score: null,
    fuente: 'desconocida',
    etapa: null,
    etiquetas: [],
    ultimoEntranteEl: null,
    ultimoEntranteTexto: null,
    ultimoSalienteEl: null,
    situacion: 'sin_resultado',
    // Sin resultado no hay pildora, y esa es la respuesta correcta para una fila huerfana: el
    // contacto ya no esta en la cache, asi que no se sabe en que estado quedo.
    pildora: null,
    estancado: false,
    /* `false` y no `true`: de este contacto no se sabe NADA —ni siquiera si tiene territorio—,
       así que afirmar que está congelado sería inventarle un dato, que es lo único que esta fila
       tiene prohibido. Ver el comentario de arriba. */
    congelado: false,
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
