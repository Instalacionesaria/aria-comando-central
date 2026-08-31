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
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import type { Territorio } from '../datos/esquema.ts';
import { estadoDelAgente } from '../ghl/contrato.ts';
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
  cita?: { inicioEl: Date | null; estado: string | null; salaUrl: string | null; vencida: boolean };
  /** Buzón: los primeros 80 caracteres de lo que escribió, para decidir sin abrir la ficha. */
  fragmento?: string;
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
  buzon: EnLaCola[];
  seguimientos: EnLaCola[];
  completadas: EnLaCola[];
}

/**
 * Las cuatro colas compartidas, ya armadas. **Corre dentro de `conOrganizacion(`.**
 *
 * Cero llamadas al CRM: todo sale de la caché propia.
 */
export async function nucleoDeColas(rol: Territorio, zonaHoraria: string): Promise<NucleoDeColas> {
  /* Sin `conCongelados`: un contacto sin territorio no es trabajo de nadie, y las colas son
     trabajo. El Pipeline sí los trae, porque ahí es información. */
  const { filas, hayMas } = await filasDeTerritorio(rol, { todas: true });
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

  // ── URGENTES ──────────────────────────────────────────────────────────────
  const urgentes: EnLaCola[] = [];
  const enUrgentes = new Set<string>();
  for (const fila of filas) {
    if (!tiene(fila.etiquetas, FALLOS_DEL_AUDITOR[rol])) continue;
    /* Un contacto CERRADO no entra, por más que el bot haya fallado. Las etiquetas viven en el CRM y
       **nadie las quita**: registrar un resultado solo agrega. Sin esta línea, un contacto
       descalificado se queda en la cola roja para siempre, tachado y con su píldora al lado, mientras
       la fila dice «revisar la conversación» sobre alguien que ya se revisó y se cerró. */
    if (estaCerrado(fila.situacion)) continue;
    enUrgentes.add(fila.id);
    /* El motivo lo escribiría el auditor en `negocio.hallazgos`. Esa tabla existe completa y **no
       tiene ni un lector ni un escritor**, así que hoy este texto de reserva es el 100 % de los
       casos. Es honesto —dice «revisar la conversación» y no inventa un diagnóstico— pero se lee
       como si el auditor hubiera encontrado algo y no lo hubiera dicho. */
    urgentes.push({ fila, motivo: SIN_MOTIVO });
  }

  // ── BUZÓN ─────────────────────────────────────────────────────────────────
  //
  // La regla, en una línea: **el último mensaje es de ellos y no nuestro.**
  //
  //   escribe                    → entrante > saliente → entra
  //   se le responde             → saliente > entrante → sale
  //   vuelve a escribir          → entrante > saliente → entra de nuevo, solo
  //
  // Y cubre las dos vías de responder: el envío desde esta plataforma y la respuesta hecha en el
  // CRM, que entra por la ingesta. Las dos mueven `ultimo_saliente_el`.
  const buzon: EnLaCola[] = [];
  for (const fila of filas) {
    // 1 · no congelado → garantizado por el territorio de la consulta.
    // 2 · no está ya en Urgentes → gana la cola más específica.
    if (enUrgentes.has(fila.id)) continue;
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

    buzon.push({ fila, fragmento: (fila.ultimoEntranteTexto ?? '').slice(0, 80) });
  }
  // El mensaje MÁS RECIENTE primero.
  buzon.sort(
    (a, b) =>
      new Date(b.fila.ultimoEntranteEl ?? 0).getTime() -
      new Date(a.fila.ultimoEntranteEl ?? 0).getTime(),
  );

  // ── SEGUIMIENTOS DE HOY ───────────────────────────────────────────────────
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
    const vencida = new Date(t.vence_el).getTime() < medianocheDeHoy;
    seguimientos.push({ fila, caso: vencida ? 'manual_vencido' : 'manual_de_hoy', pideManos: true });
  }

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
    buzon,
    seguimientos,
    completadas,
  };
}
