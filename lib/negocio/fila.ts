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
// La primera respuesta fue **por territorio**: un closer veía todos los contactos con
// `territorio = 'closer'`, la etiqueta `zona_closer` de GoHighLevel. El motivo escrito era
// *«no por responsable asignado, porque GHL no da asignación — da zona»*.
//
// ── Y ESA PREMISA RESULTÓ FALSA, MEDIDA ──────────────────────────────────────
//
// El 2026-09-01, contra la subcuenta real y con la MISMA llamada que la aplicación ya hacía:
// `POST /contacts/search` devuelve `assignedTo`, y de los **152 contactos de `zona_closer`, 135
// lo traen poblado** (en `zona_setter`, 3 de 100 — la señal es del closer).
//
// Así que la pregunta recibió su segunda respuesta —**por asignación**— cuando se pidieron
// varios closers. Lo que NO cambió es la parte del `11` § 8 que sigue valiendo: esto es un
// filtro de negocio, vive en la consulta, y no toca el modelo de permisos ni una línea. El
// territorio sigue siendo el primer corte; la asignación es el segundo, y **solo se aplica
// cuando quien mira es un closer vinculado** — ver `lib/negocio/alcanceDelCloser.ts`.
//
// Y el aislamiento por organización NO está acá: lo pone la política de fila, con el
// `org_id` que `conOrganizacion(` dejó en la transacción. Este archivo no nombra `org_id` ni
// una vez, y eso es la propiedad que se busca.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { noCancelada } from './citas.ts';
import { armarPildora, type Pildora } from './pildora.ts';
import type { AlcanceDelCloser } from './alcanceDelCloser.ts';
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
  /**
   * 📹 Reuniones que YA TUVO: citas cuyo inicio ya pasó. `null` = **no hay de dónde medirlo**.
   *
   * ── ERA `number` A SECAS, Y ESO HACÍA INALCANZABLE EL «NO MEDIDO» ────────
   *
   * El tipo decía `number` y el mapeo hacía `Number(… ?? 0)`, así que las dos ramas del encabezado
   * de arriba —el `0` medido y el `null` sin medir— colapsaban en la primera. Una empresa cuyo
   * calendario nunca se leyó veía «cero reuniones» en los 238 contactos, que es una afirmación
   * sobre el pasado de cada uno de ellos, y falsa.
   *
   * La distinción es **por empresa y no por contacto**, y esa es la parte que importa: si
   * `negocio.citas` tiene alguna fila de esta organización, entonces el calendario se leyó y un cero
   * es un cero medido —ese contacto no tuvo reuniones—. Si no tiene ninguna, no hay nada que medir
   * y el ícono se apaga del todo.
   */
  reunionesTenidas: number | null;
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
  /**
   * 📞 Llamadas de agente IA **CONTESTADAS**. No las hechas — ver el encabezado.
   *
   * `null` = no hay de dónde medirlo, y hoy es el caso de **todas** las empresas: `negocio.llamadas`
   * no tiene ni un escritor fuera de las pruebas. Su propia migración lo dijo desde el primer día
   * (`011` § 4): *«nacen vacías y se llenan cuando esa integración exista; la pantalla tiene que
   * mostrar eso como "no hay datos", no como "cero llamadas"»*. La pantalla mostraba «cero
   * llamadas» — el mapeo hacía `Number(… ?? 0)` y borraba la diferencia que este comentario pide.
   *
   * Y se resuelve por empresa, no con una constante en el código: el día que el webhook de la
   * plataforma de voz escriba la primera fila de una organización, sus ceros pasan solos a ser ceros
   * medidos, sin que haya que acordarse de cambiar una bandera.
   */
  llamadasContestadas: number | null;
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
  /**
   * El identificador del contacto EN EL CRM.
   *
   * Viaja porque el encabezado de la ficha tiene un botón «Ver en GoHighLevel», y sin esto la
   * pantalla no tendría con qué armar el enlace. No es un secreto: es el mismo identificador
   * que se ve en la barra de direcciones del CRM.
   *
   * **Puede ser nulo**, y no por descuido: la fila huérfana —un resultado cuyo contacto ya no
   * está en la caché— no sabe cuál era. Ahí el botón «Ver en GoHighLevel» **no se dibuja**,
   * que es distinto de dibujarlo apuntando a una dirección inventada.
   */
  ghlContactId: string | null;
  nombre: string;
  telefono: string | null;
  /** Para el grupo «Detalles» del Perfil. La lista no lo dibuja. */
  email: string | null;
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
   * `true` = **congelado**: no está en ningún territorio.
   *
   * Viaja en la fila y no se deduce en la pantalla por lo mismo que los seis íconos: es un hecho del
   * contacto, y si dos vitrinas lo derivaran por su cuenta una de las dos quedaría vieja.
   *
   * Y la definición es «no está en NINGÚN territorio», no «perdió el mío». La diferencia ya costó
   * caro una vez, y está escrita en `lib/negocio/sincronizar.ts`: con la segunda definición **todo
   * contacto del setter nace congelado** —nunca tuvo `zona_closer`, la gana al agendar— y ese módulo
   * queda inerte sin que nada falle.
   */
  congelado: boolean;
  /**
   * En qué territorio está. `null` = congelado, y es la misma verdad que `congelado` dice en corto.
   *
   * ── VIAJA ADEMÁS DEL DERIVADO, Y NO ES REDUNDANCIA ────────────────────────
   *
   * `congelado` contesta «¿se puede operar sobre él?». Esto contesta **«¿con qué vocabulario?»**, y
   * son dos preguntas distintas: el closer y el setter tienen catálogos de salidas propios, con una
   * salida `seguimiento` en cada uno que pide cosas distintas.
   *
   * Sin este campo la ficha no tiene con qué elegir, y dibujaría las seis tarjetas del closer sobre
   * un contacto del setter — que el servidor después rechaza, pero recién al apretar.
   *
   * La autoridad sigue siendo el servidor: esto es **para dibujar**. Si la pantalla y la base
   * discrepan, gana la base y la petición se rechaza, que es el lado correcto del que fallar.
   */
  territorio: Territorio | null;
  /**
   * La SITUACIÓN de la píldora. El § 7.1: *"la situación real, nunca una condición
   * temporal"*. "Estancado" y "vencido" NO salen de acá — son color de fila y microtexto,
   * que se calculan en el cliente con las fechas de arriba.
   */
  situacion: Situacion;
  /**
   * El texto y el color de la píldora, ya armados. `null` = sin resultado registrado, y entonces
   * **no se dibuja ninguna** — no es un estado, es que nadie midió todavía.
   *
   * Viaja armada y no en piezas para que la fila y la ficha no puedan formatearla distinto. Ver
   * `lib/negocio/pildora.ts`.
   */
  pildora: Pildora | null;
  /**
   * Las etiquetas CRUDAS del CRM, tal como vinieron.
   *
   * Viajan con la fila porque de ellas salen las cinco colas de Mi Día y las siete columnas del
   * Pipeline, y el `01` es explícito sobre por qué se cargan una sola vez: *"los seis íconos se
   * cargan una sola vez para todos, y viajan con cada contacto en cada cola. Por eso se ven
   * iguales en Mi Día, en el Pipeline y en la ficha: **es el mismo dato, no tres cálculos que
   * coinciden**"*.
   *
   * Y sirven para lo que nada más sirve: diagnosticar por qué un contacto cayó donde cayó, que
   * es la primera pregunta cuando alguien dice "éste no va acá".
   */
  etiquetas: string[];
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

/**
 * Las situaciones que CIERRAN un contacto: no queda trabajo pendiente sobre él.
 *
 * ══ PARA QUÉ EXISTE: UN CONTACTO CERRADO NO GENERA TAREA EN NINGUNA COLA ════
 *
 * Lo reportó alguien mirando su propia pantalla: descalificó a un contacto y **siguió apareciendo en
 * «Intervenciones urgentes»**, tachado y con su píldora `NO LE INTERESA` al lado. O sea que la fila
 * probaba que el sistema sabía que estaba cerrado, y la cola lo listaba igual.
 *
 * El motivo era que esa cola solo mira tres etiquetas del CRM —las que dicen «el bot se apagó porque
 * falló»— y **registrar un resultado nunca quita una etiqueta**: `etiquetasDelResultado` en
 * `lib/ghl/contrato.ts` solo AGREGA. Así que la etiqueta se queda para siempre y la cola también.
 *
 * No es solo ruido: esas filas suman al contador de «tareas de hoy», o sea que el número miente. Y el
 * propio Mi Día ya tiene escrito adónde lleva eso — *«a la tercera vez deja de creerle al contador»*.
 *
 * ── QUÉ ESTÁ ADENTRO Y QUÉ NO, CON EL MOTIVO DE CADA UNO ─────────────────
 *
 * Adentro van los desenlaces de los que **no se vuelve**:
 *
 *   · `venta` y `venta_chica` — se cobró;
 *   · `no_interesa` y `no_califica` — cerrado en negativo por una decisión humana.
 *
 * Y afuera quedan cuatro que PARECEN cerrados y no lo son, que es donde está el filo:
 *
 *   · `acuerdo_sin_pago` — hay plata comprometida y sin cobrar. Es el contacto que MÁS trabajo pide.
 *   · `nurture` — `lib/negocio/etapas.ts` lo describe como *«frío, pero explícitamente reversible
 *     («no es ahora»)»*. Un «no es ahora» no es un «no».
 *   · `no_show` — *«un hecho operativo, no una resolución: el contacto sigue vivo»*.
 *   · `seguimiento` — el estado de trabajo activo por definición.
 *
 * Tampoco entra `agendo`: agendar ABRE trabajo, no lo cierra.
 */
export const SITUACIONES_CERRADAS: readonly Situacion[] = [
  'venta',
  'venta_chica',
  'no_interesa',
  'no_califica',
];

/** Si sobre este contacto ya no queda trabajo. Ver `SITUACIONES_CERRADAS`. */
export function estaCerrado(situacion: Situacion): boolean {
  return SITUACIONES_CERRADAS.includes(situacion);
}

/** El tope de filas por página. */
const POR_PAGINA = 100;

/**
 * El tope cuando se piden TODAS (Mi Día y el Pipeline).
 *
 * 5.000 y no infinito. Con la subcuenta real —124 contactos de closer— sobra por mucho, y a la
 * vez impide que una organización grande traiga todo a memoria y a la respuesta HTTP de una
 * sola vez.
 *
 * Si se alcanza, `hayMas` queda en `true` y **quien llama tiene que decirlo**. Un corte
 * silencioso acá sería peor que en la lista paginada: en el Pipeline haría que el contador y
 * las columnas discrepen, que es exactamente el defecto que el `02` regla 2 describe.
 */
const TOPE_SIN_PAGINAR = 5000;

/**
 * De la fila cruda de la consulta a la `Fila` que ve el cliente.
 *
 * Está nombrada por el mismo motivo que `conLosSeisIconos`: la usan las dos lecturas —el
 * territorio y el contacto suelto— y **el mapeo es donde vive la mitad de las decisiones**. El
 * `Number()` de los conteos, el `Boolean()` de los `exists`, y las dos fuentes que se combinan
 * en dos de los íconos son todas reglas que tenían que quedar en un solo lugar.
 *
 * Escrita a mano y no con un tipo derivado: los nombres cambian de `snake_case` a `camelCase`
 * a propósito — la base y el cliente son dos vocabularios, y traducir en un solo punto es lo
 * que permite renombrar una columna sin tocar la pantalla.
 */
function aFila(f: {
  id: string;
  ghl_contact_id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  score: string | null;
  fuente: string;
  etapa: string | null;
  ultimo_entrante_el: Date | null;
  ultimo_entrante_texto: string | null;
  ultimo_saliente_el: Date | null;
  /** `null` = congelado: no está en ningún territorio. Ver `Fila.congelado`. */
  /* `Territorio` y no `string`: la columna tiene un `check` con esos dos valores, y el tipo lo dice
     acá para que la fila no tenga que castear al armarse. */
  territorio: Territorio | null;
  etiquetas: string[] | null;
  reuniones_tenidas: string | null;
  hay_citas: boolean | number;
  hay_llamadas: boolean | number;
  cita_futura: unknown;
  llamadas_contestadas: string | null;
  seguimiento_abierto: unknown;
  monto_venta: string | null;
  ultima_salida: string | null;
  ultimo_detalle: string | null;
  ultima_forma_pago: string | null;
  ultimo_monto: string | null;
}): Fila {
  return {
    id: f.id,
    ghlContactId: f.ghl_contact_id,
    nombre: f.nombre,
    telefono: f.telefono,
    email: f.email,
    score: f.score,
    fuente: f.fuente,
    etapa: f.etapa,
    ultimoEntranteEl: f.ultimo_entrante_el,
    ultimoEntranteTexto: f.ultimo_entrante_texto,
    ultimoSalienteEl: f.ultimo_saliente_el,
    congelado: f.territorio === null,
    territorio: f.territorio,
    situacion: (f.ultima_salida ?? 'sin_resultado') as Situacion,
    // LA PÍLDORA LA CALCULA EL SERVIDOR, igual que los seis íconos, y por el mismo motivo: así la
    // fila y la ficha reciben **el mismo objeto**, y el espejo que el `02` exige es cierto por
    // construcción en vez de por coincidencia entre dos diccionarios.
    pildora: armarPildora({
      situacion: (f.ultima_salida ?? 'sin_resultado') as Situacion,
      detalle: f.ultimo_detalle,
      formaPago: f.ultima_forma_pago,
      monto: f.ultimo_monto,
    }),
    etiquetas: f.etiquetas ?? [],
    estancado: (f.etiquetas ?? []).includes(ESTANCADO),
    iconos: {
      // `count(*)` de PostgreSQL vuelve como `bigint`, y el controlador lo entrega en
      // texto para no perder precisión. Un `Number()` acá es seguro —no hay contacto con
      // 2^53 reuniones— pero pasarlo tal cual haría que el cliente reciba `"3"` y que
      // `n > 0` sea cierto para `"0"`.
      /* `null` cuando la empresa no tiene NI UNA cita leída: ahí el cero no se midió, y dibujarlo
         como cero afirma que este contacto no tuvo reuniones. Con al menos una fila en la
         organización, el calendario se leyó y el cero de este contacto sí es un hecho. */
      reunionesTenidas: Boolean(f.hay_citas) ? Number(f.reuniones_tenidas ?? 0) : null,
      // `Boolean(` y no el valor tal cual: kysely tipa `exists` como `SqlBool`, que admite
      // `0`/`1` además de booleanos porque otros motores devuelven eso. PostgreSQL devuelve
      // un booleano de verdad, pero dejar pasar el tipo ancho haría que el cliente pudiera
      // recibir un `0` —que en JSON es falso al evaluarlo, y verdadero si alguien compara
      // con `!== false`.
      // La tabla O la etiqueta. Ver los comentarios de los campos.
      citaFutura: Boolean(f.cita_futura) || (f.etiquetas ?? []).includes(CITA_AGENDADA),
      // Lo mismo, y hoy siempre `null`: `negocio.llamadas` no tiene escritor. Ver el campo.
      llamadasContestadas: Boolean(f.hay_llamadas) ? Number(f.llamadas_contestadas ?? 0) : null,
      estadoAgente: estadoDelAgente(f.etiquetas ?? []),
      seguimientoAbierto:
        Boolean(f.seguimiento_abierto) || (f.etiquetas ?? []).includes(SEGUIMIENTO_AUTOMATICO),
      montoVenta: f.monto_venta,
    },
  };
}

/**
 * La consulta con los seis íconos, SIN filtro y SIN orden.
 *
 * ── POR QUÉ ESTO SALIÓ A UNA FUNCIÓN ────────────────────────────────
 *
 * La ficha necesita los seis íconos de UN contacto, y `filasDeTerritorio` solo sabe traer un
 * territorio entero. Las dos salidas fáciles eran malas:
 *
 *   · **Reescribir las subconsultas** para el caso de uno. Serían dos implementaciones de los
 *     mismos seis agregados, y el encabezado de este archivo ya cuenta lo que pasó la última
 *     vez que hubo dos: `count(*)` en un lado y `count(*) where contestada` en el otro, y el
 *     mismo contacto decía dos cosas distintas según dónde se lo mirara.
 *   · **Pasarle la fila que el cliente ya tiene.** Funciona hasta que la ficha se abre desde
 *     algo que no la tiene —el Pipeline, una pantalla de auditoría— y entonces abre vacía.
 *
 * Así que el `select` se nombra una vez y los dos lo usan. Los constructores de kysely son
 * inmutables, así que agregarle `where` y `orderBy` después no toca esta definición.
 */
function conLosSeisIconos() {
  return datos()
    .selectFrom('contactos as c')
    .select((eb) => [
      'c.id',
      // El identificador del CRM, para el enlace del encabezado de la ficha.
      'c.ghl_contact_id',
      'c.nombre',
      'c.telefono',
      'c.email',
      'c.score',
      'c.fuente',
      'c.etapa',
      'c.ultimo_entrante_el',
      'c.ultimo_entrante_texto',
      'c.ultimo_saliente_el',
      /* El territorio, del que sale una sola cosa en la fila: si está CONGELADO.
         No es para filtrar —eso lo hace el `where` de quien llama— sino para poder DECIRLO. Sin esta
         columna, un congelado traído a propósito llegaría indistinguible de uno activo, y la pantalla
         lo dibujaría como si fuera trabajo de este closer. */
      'c.territorio',
      // Las etiquetas crudas. De acá salen tres de los seis íconos y la marca de estancado.
      'c.etiquetas',

      /* 📹 Reuniones que YA TUVO. `inicio_el < now()`, y las que no tienen fecha de inicio
         no cuentan: una cita sin inicio no es una reunión que ocurrió.

         ── Y SIN LAS CANCELADAS, que es un arreglo y no un detalle ──
         El primer barrido real lo dejó a la vista: **411 de 1052 citas están canceladas, el 39 %**.
         Contarlas acá hacía que este ícono —el que el closer mira ANTES de llamar, para saber si ya
         habló con esta persona— dijera que hubo reuniones que nadie tuvo. Y no había forma de
         notarlo: el número se veía plausible.

         El filtro es `noCancelada()`, la MISMA definición que usa la cola de Mi Día. */
      eb
        .selectFrom('citas')
        .whereRef('citas.contacto_id', '=', 'c.id')
        .where('citas.inicio_el', '<', sql<Date>`now()`)
        .where(noCancelada('citas.estado_ghl'))
        .select(({ fn }) => fn.countAll<string>().as('n'))
        .as('reuniones_tenidas'),

      // 📅 ¿Cita futura? `exists`, no un conteo: el ícono dice sí o no. Sin canceladas por lo
      // mismo, y acá el efecto es peor: una cita cancelada encendía el ícono de «tiene cita
      // agendada», que es justo el motivo por el que alguien decide NO llamar.
      eb
        .exists(
          eb
            .selectFrom('citas')
            .whereRef('citas.contacto_id', '=', 'c.id')
            .where('citas.inicio_el', '>=', sql<Date>`now()`)
            .where(noCancelada('citas.estado_ghl'))
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

      /* ── ¿HAY DE DÓNDE MEDIR? DOS BANDERAS POR EMPRESA ───────────────────
       *
       * Los dos conteos de arriba devuelven `0` cuando el contacto no tiene filas, y eso es
       * ambiguo: puede ser «este contacto no tuvo reuniones» o «nadie leyó nunca el calendario».
       * El § 9 regla 1 exige separarlas, y el `011` § 4 lo pide literal para las llamadas.
       *
       * Se resuelve con la existencia de CUALQUIER fila de la organización. Son subconsultas **sin
       * correlación** —no mencionan `c.id`— así que PostgreSQL las evalúa una vez por sentencia
       * (`InitPlan`) y no una vez por fila: el costo es de dos `exists` en total, no de dos por
       * contacto.
       *
       * Y quedan confinadas a la empresa sin escribirlo: las dos tablas son de `negocio.*` y tienen
       * el aislamiento puesto por `aplicar_aislamiento`, así que «cualquier fila» ya significa
       * «cualquier fila de esta organización». */
      eb.exists(eb.selectFrom('citas').select(sql`1`.as('x'))).as('hay_citas'),
      eb.exists(eb.selectFrom('llamadas').select(sql`1`.as('x'))).as('hay_llamadas'),

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

      // Y las TRES piezas de la subcategoría de la píldora, del MISMO resultado que la línea de
      // arriba: las cuatro subconsultas tienen el mismo `where`, el mismo orden y el mismo
      // `limit 1`, así que resuelven a la misma fila.
      //
      // Cuatro subconsultas y no una unión lateral, que sería más corta: el índice
      // `resultados_por_contacto (org_id, contacto_id, creado_el desc)` las convierte en cuatro
      // búsquedas de una fila cada una, y la forma repetida es la del resto del archivo. Una
      // lateral acá sería la única construcción distinta en el archivo, y el `08` § 2 pide
      // consistencia por encima de brevedad cuando el coste es el mismo.
      //
      // No se reusa `monto_venta` para esto: ése es «el monto de la última VENTA», que puede ser
      // una fila distinta del último resultado. Confundirlos pondría el monto de una venta vieja
      // en la píldora de un no-show.
      eb
        .selectFrom('resultados')
        .whereRef('resultados.contacto_id', '=', 'c.id')
        .orderBy('resultados.creado_el', 'desc')
        .limit(1)
        .select('resultados.detalle')
        .as('ultimo_detalle'),
      eb
        .selectFrom('resultados')
        .whereRef('resultados.contacto_id', '=', 'c.id')
        .orderBy('resultados.creado_el', 'desc')
        .limit(1)
        .select('resultados.forma_pago')
        .as('ultima_forma_pago'),
      eb
        .selectFrom('resultados')
        .whereRef('resultados.contacto_id', '=', 'c.id')
        .orderBy('resultados.creado_el', 'desc')
        .limit(1)
        .select('resultados.monto')
        .as('ultimo_monto'),
    ]);
}

/**
 * UN contacto con sus seis íconos, para la ficha.
 *
 * Sin filtro de territorio, y es deliberado: la ficha se abre desde las tres pantallas del
 * closer, desde las del setter y desde la auditoría, y el mismo contacto **cambia de
 * territorio** cuando agenda. Filtrar acá haría que la ficha de un contacto que acaba de pasar
 * a `closer` abriera vacía para el setter que lo agendó — y sin ningún error.
 *
 * La barrera es la capacidad `contactos.ver`, que tienen los dos roles, más el aislamiento por
 * fila: `undefined` significa «no existe en ESTA organización», que es lo que corresponde.
 */
export async function filaDeContacto(contactoId: string): Promise<Fila | undefined> {
  const cruda = await conLosSeisIconos().where('c.id', '=', contactoId).executeTakeFirst();
  return cruda ? aFila(cruda) : undefined;
}

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
  /**
   * `alcance` va OPCIONAL y su ausencia significa **todo el territorio**, que es lo que esta
   * función hacía antes de que existieran varios closers.
   *
   * Opcional y no obligatorio a propósito, al revés que el `alcance` de `seccionesConAlcance`:
   * allá el valor por omisión peligroso es «muestra de más» y acá es «muestra de menos». Un
   * llamador nuevo que se lo olvide muestra el territorio entero —visible, y alguien lo dice— en
   * vez de esconderle a un closer los leads que sí son suyos, que no se ve nunca.
   *
   * Los cinco llamadores del Setter no lo pasan y no deben: la asignación es una señal del
   * closer (3 de cada 100 en `zona_setter`), y acotar allá dejaría a los setters sin trabajo.
   */
  opciones: {
    pagina?: number;
    todas?: boolean;
    conCongelados?: boolean;
    alcance?: AlcanceDelCloser;
  } = {},
): Promise<{ filas: Fila[]; hayMas: boolean }> {
  const pagina = Math.max(0, Math.trunc(opciones.pagina ?? 0));

  /* `todas` trae el territorio COMPLETO sin paginar, y existe para Mi Día y el Pipeline.
   *
   * El `01` § "Cómo se arma todo esto" lo pide así: *"los seis íconos se cargan una sola vez
   * para todos, y viajan con cada contacto en cada cola. Por eso se ven iguales en Mi Día, en
   * el Pipeline y en la ficha: **es el mismo dato, no tres cálculos que coinciden**"*.
   *
   * Y el `02` es más terminante: *"el Pipeline son TODOS los contactos del territorio... Si un
   * contacto del territorio no aparece en ninguna columna, hay un defecto"*. Con páginas, un
   * contacto de la página 2 no aparecería en ninguna columna — y el contador lo contaría.
   *
   * El tope sigue existiendo, más alto: `TOPE_SIN_PAGINAR`. No es una paginación disfrazada; es
   * un freno para que una organización con decenas de miles de contactos no traiga todo a
   * memoria de una vez. Si se alcanza, `hayMas` queda en `true` y quien llama tiene que
   * decirlo, igual que en la paginación normal.
   */

  // Se piden UNA MÁS que las que caben. Es cómo se sabe si hay más página sin pagar un
  // `count(*)` sobre toda la tabla — que con RLS encima es la consulta más cara de la lista.
  /* ── `conCongelados`, Y POR QUÉ NO ES EL COMPORTAMIENTO POR OMISIÓN ────────
   *
   * Un contacto **congelado** es el que no está en NINGÚN territorio: perdió su etiqueta de zona y
   * no ganó la otra. `lib/negocio/sincronizar.ts` afirma de él que *«sigue visible y atenuado, sigue
   * siendo movible, no se borra»* — y nada de eso existía: con el `where` de abajo a secas,
   * `territorio is null` queda afuera y el contacto **desaparece de la aplicación sin rastro y sin
   * contador que lo cuente**. El closer ve bajar su cartera y no tiene dónde mirar por qué.
   *
   * Se pide explícitamente y NO es el valor por omisión, porque los dos usos son opuestos:
   *
   *   · el **Pipeline** es la base de datos de la cartera, y ahí un congelado tiene que verse: es
   *     información sobre alguien que estuvo;
   *   · **Mi Día** son las colas de trabajo, y ahí NO va: no es trabajo de este closer, y los
   *     documentos lo dicen dos veces — *«los congelados no entran ni a Urgentes ni al Buzón»*.
   *
   * Con el valor por omisión al revés, agregar una cola nueva a Mi Día la llenaría de congelados sin
   * que nadie lo pidiera, y el síntoma sería una cola con gente que no es de nadie. */
  const crudas = await conLosSeisIconos()
    .where((eb) =>
      opciones.conCongelados
        ? eb.or([eb('c.territorio', '=', territorio), eb('c.territorio', 'is', null)])
        : eb('c.territorio', '=', territorio),
    )
    /* ── EL SEGUNDO CORTE: DE QUIÉN SON ESTOS LEADS ─────────────────────────
     *
     * Va como `$if` y no como un `where` condicional suelto porque tiene que poder NO estar: sin
     * alcance, o con alcance `todo`, la consulta sale exactamente como salía antes.
     *
     * Se compara contra `crm_asignado_a`, el identificador del usuario del CRM guardado crudo, y
     * no contra `responsable_id`. El motivo está en la migración 034: resolver el vínculo al
     * escribir obligaría a re-sincronizar todos los contactos cada vez que se corrige a qué
     * persona corresponde un usuario del CRM.
     *
     * Los SIN asignar quedan afuera, y es la decisión de producto: los ve quien no es closer, con
     * un contador para que alguien los asigne en el CRM. Un `or … is null` acá se los daría a los
     * tres closers a la vez, y dos closers llamarían al mismo contacto sin saberlo. */
    .$if(opciones.alcance?.tipo === 'mio', (q) =>
      q.where('c.crm_asignado_a', '=', (opciones.alcance as { crmUsuarioId: string }).crmUsuarioId),
    )
    // Por actividad entrante, y los que nunca escribieron al final. `nulls last` explícito:
    // en PostgreSQL `desc` pone los nulos PRIMERO por omisión, así que sin esto la lista
    // arranca con los contactos que nunca dijeron nada.
    .orderBy('c.ultimo_entrante_el', sql`desc nulls last`)
    // Y un desempate estable. Sin él, dos contactos con la misma fecha —o los muchos con
    // `null`— pueden salir en orden distinto en cada pedido, y la paginación repite o se
    // saltea filas sin que nada falle.
    .orderBy('c.id', 'asc')
    .limit((opciones.todas ? TOPE_SIN_PAGINAR : POR_PAGINA) + 1)
    .offset(opciones.todas ? 0 : pagina * POR_PAGINA)
    .execute();

  const cabe = opciones.todas ? TOPE_SIN_PAGINAR : POR_PAGINA;
  const hayMas = crudas.length > cabe;

  return { hayMas, filas: crudas.slice(0, cabe).map(aFila) };
}
