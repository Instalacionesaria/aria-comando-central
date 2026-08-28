// Las cinco pestañas de la ficha, cada una con su lectura.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA REGLA QUE GOBIERNA TODO ESTE ARCHIVO
//
// Cinco de estas seis tablas están **vacías** en producción hoy: `mensajes`, `llamadas`, `citas`,
// `resultados` y `tareas` tienen cero filas, y `notas` también. Los 239 contactos son reales; su
// historia todavía no se trajo.
//
// Así que cada lectura devuelve DOS cosas: lo que hay, y `falta` — una frase que dice **por qué no
// hay más**. Es el `11` § 9 regla 1, que este repositorio ya aplica en `lib/negocio/inicio.ts`:
//
//   *"un cero medido y un cero no medido no son el mismo hecho."*
//
// Una lista vacía sin `falta` afirma «este contacto nunca habló». Con `falta` dice «todavía no
// trajimos sus mensajes», que es lo cierto. La diferencia importa porque la primera hace que alguien
// llame a un cliente creyendo que nunca contestó.
//
// Y `falta` es `null` cuando la fuente SÍ está poblada y el resultado es genuinamente cero. Ese
// caso también hay que poder distinguirlo, y es el que va a ir apareciendo bloque por bloque.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { frescuraDe, type Frescura } from './frescura.ts';
import { definicionDe, modoDe } from './salidas.ts';
import { fechaDelDia } from './tiempo.ts';

/**
 * El día de una columna `date`, como `YYYY-MM-DD`.
 *
 * ── ESTO PARECE DE MÁS Y NO LO ES ───────────────────────────────────────────
 *
 * El controlador devuelve una columna `date` como un `Date` de JavaScript puesto en la **medianoche
 * LOCAL del proceso**. Medido: `'2027-03-15'::date` llega como `2027-03-15T05:00:00.000Z` corriendo
 * en `America/Lima`.
 *
 * Así que las dos salidas cortas están mal, cada una a su manera:
 *
 *   · `String(d).slice(0, 10)` da **«Mon Mar 15»** — en inglés, y sin año. Es lo que había, y no se
 *     ve leyendo el código porque diez es justo el largo de una fecha ISO.
 *   · `d.toISOString().slice(0, 10)` parece el arreglo obvio y es **otro error de zona**: en una
 *     zona por delante de UTC —Madrid, digamos— la medianoche local es el día ANTERIOR en UTC, así
 *     que devolvería el 14. Hoy no se notaría porque el servidor corre en UTC; se notaría el día
 *     que alguien corra esto en otra zona, que es la peor forma de enterarse.
 *
 * Los captadores LOCALES son los únicos que leen el día donde el controlador lo puso.
 */
function diaDeLaColumna(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** Lo que devuelve cada pestaña: lo medido, y por qué no hay más. */
/**
 * ¿Existe este contacto **en la organización del contexto**?
 *
 * ════════════════════════════════════════════════════════════════════════════
 * EL DEFECTO QUE ESTO CIERRA, Y ESTABA DOCUMENTADO SIN ARREGLAR
 *
 * Las cuatro pestañas —perfil, historial, llamadas, notas— iban derecho a su consulta. El
 * aislamiento por fila hace que un contacto de otra empresa no exista para esa consulta, así que la
 * respuesta era **`200` con la lista vacía**: nada se filtraba, y eso es lo único que estaba bien.
 *
 * Lo que estaba mal son dos cosas, y ninguna es teórica:
 *
 *   · **`ADR-0501`.** Un contacto de otra organización tiene que ser indistinguible de uno que no
 *     existe, y «no existe» es `404`. Un `200` vacío es una tercera respuesta: dice «existe y no
 *     tiene nada». El `POST` de las notas sí comprobaba —con este mismo argumento escrito al
 *     lado— así que la misma pantalla daba dos respuestas distintas al mismo hecho.
 *   · **La regla del cero medido.** «Este contacto no tiene notas» y «este contacto no es tuyo» se
 *     veían igual: una ficha abierta con las cuatro pestañas en blanco. Y el `falta` de cada
 *     pestaña explicaba la ausencia con un motivo inventado —*«todavía no hay notas»*— sobre un
 *     contacto que quizás tiene veinte.
 *
 * Es UNA consulta más por pedido, y es el precio de la distinción. `mensajes` no la usa porque ya
 * lee la fila del contacto para `ultimo_entrante_el`: ahí la comprobación sale gratis, y hace
 * exactamente lo mismo.
 * ════════════════════════════════════════════════════════════════════════════
 */
export async function existeElContacto(contactoId: string): Promise<boolean> {
  const fila = await datos()
    .selectFrom('contactos')
    .select('id')
    .where('id', '=', contactoId)
    .executeTakeFirst();
  return fila !== undefined;
}

export interface Pestana<T> {
  filas: T[];
  /** `null` = la fuente está poblada y esto es todo lo que hay. Si no, qué falta para que haya. */
  falta: string | null;
}

/* Las frases de `falta`, en un solo lugar. Cada una nombra **la pieza que no existe todavía**, no
   un «no hay datos» genérico: quien lea esto tiene que poder saber si es un problema suyo o una
   parte del sistema que no está construida. */
const FALTA = {
  mensajes:
    'Todavía no se trajeron los mensajes de GoHighLevel. Esta conversación puede existir en el ' +
    'CRM: lo que falta es la ingesta que la copia acá.',
  mensajesAMedias:
    'La ingesta todavía está recorriendo la cuenta hacia atrás. Esta conversación puede tener ' +
    'mensajes que aún no se copiaron.',
  llamadas:
    'Todavía no se conectó la plataforma de voz, así que no hay ninguna llamada registrada. Las ' +
    'llamadas llegan por aviso de Assistable, no se consultan.',
  /* ── ESTE TEXTO DESCRIBÍA UN SISTEMA QUE YA NO ES ESTE ──────────────────
     Decía *«hoy solo hay notas: el resto todavía no tiene de dónde venir»*, y era falso desde hacía
     varias etapas: los resultados, los seguimientos y las citas tienen escritor y aparecen. Un
     texto de «falta» que miente sobre lo que falta es peor que ninguno, porque lo lee alguien que
     está tratando de entender por qué una pantalla está vacía.
     Lo que SÍ falta, y ahora es lo único que dice: los eventos de sistema. No hay tabla ni escritor
     para «se apagó el bot», «cambió una etiqueta» ni «se envió un mensaje» — son cambios de estado
     que se pisan, y sin una tabla que los guarde no hay cómo saber cuándo ocurrieron. */
  historial:
    'Este contacto no tiene todavía ningún resultado, seguimiento, cita ni nota. Los eventos de ' +
    'sistema —cuando se apaga el bot o cambia una etiqueta— no se registran todavía, así que ' +
    'tampoco aparecen acá.',
  perfil:
    'Los campos del formulario y de calificación viven en GoHighLevel y todavía no se leen. Lo ' +
    'que se muestra son los datos que sí se sincronizan.',
} as const;

// ─── Chat ───────────────────────────────────────────────────────────────────

export interface MensajeDeFicha {
  id: string;
  direccion: 'entrante' | 'saliente';
  autor: 'contacto' | 'agente' | 'persona';
  canal: string | null;
  cuerpo: string | null;
  enviadoEl: Date;
  /**
   * En qué estado quedó la entrega. **Va en la respuesta y se dibuja**, y es la mitad visible del
   * arreglo del defecto original: la otra mitad —la ventana de 24 horas— evita gastar la llamada,
   * y ésta hace visible todo lo demás que el canal puede rechazar.
   */
  entrega: 'en_curso' | 'entregado' | 'fallido' | 'desconocido';
  /** Lo que dijo el canal al rechazarlo. Es lo único que explica POR QUÉ no llegó. */
  falloDelCanal: string | null;
}

/** El tope del `03` § 1: los ÚLTIMOS 200. */
const TOPE_DE_MENSAJES = 200;

/**
 * Los mensajes del contacto, del más viejo al más nuevo.
 *
 * ── EL TOPE SE PIDE DESCENDENTE Y SE DA VUELTA ──────────────────────────────
 *
 * El `03` § 1 nombra este error y lo llama «una línea que no falla nunca y rompe la pantalla en
 * cuanto una conversación crece»: con `ascendente + limit 200` se guardan los 200 **más viejos**.
 * Pasada esa cantidad, el chat mostraría el arranque de la conversación y **esconde lo reciente**,
 * que es exactamente lo que alguien abrió a mirar.
 *
 * Así que se ordena `desc`, se corta, y se invierte en memoria. El índice
 * `mensajes_por_contacto (org_id, contacto_id, enviado_el desc)` está hecho para este orden.
 */
/**
 * El chat, y **lo único de las seis pestañas que lleva `frescura`**.
 *
 * No va en `Pestana<T>`: de las seis pestañas, solo dos tienen un barrido automático detrás. Ponerlo
 * en el tipo compartido obligaría a las otras cuatro a devolver un dato que no significa nada para
 * ellas —el perfil se lee en vivo, las notas las escribe esta aplicación— y un campo que siempre
 * dice lo mismo se vuelve invisible.
 */
export async function mensajesDeLaFicha(
  contactoId: string,
): Promise<Pestana<MensajeDeFicha> & { frescura: Frescura }> {
  const crudos = await datos()
    .selectFrom('mensajes')
    .select([
      'id',
      'direccion',
      'autor',
      'canal',
      'cuerpo',
      'enviado_el',
      'estado_entrega_familia',
      'fallo_del_canal',
    ])
    .where('contacto_id', '=', contactoId)
    .orderBy('enviado_el', 'desc')
    // Desempate estable: dos mensajes con el mismo instante —pasa con los importados— saldrían en
    // orden distinto en cada pedido, y el reloj del chat los vería como mensajes nuevos.
    .orderBy('id', 'desc')
    .limit(TOPE_DE_MENSAJES)
    .execute();

  return {
    filas: crudos
      .map((m) => ({
        id: m.id,
        direccion: m.direccion,
        autor: m.autor,
        canal: m.canal,
        cuerpo: m.cuerpo,
        enviadoEl: m.enviado_el,
        entrega: m.estado_entrega_familia,
        falloDelCanal: m.fallo_del_canal,
      }))
      .reverse(),
    falta: crudos.length > 0 ? null : await porQueNoHayMensajes(),
    /* ── LA FRESCURA SE CALCULA SIEMPRE, HAYA O NO MENSAJES ──────────────────
     *
     * `falta` de arriba está condicionado a `crudos.length > 0`, y con razón: contesta «¿por qué no
     * hay ninguno?». El atraso es otra pregunta y no se puede condicionar igual — un chat con
     * mensajes de hace tres días **se ve completo** y es el caso que importa: la persona escribió
     * ayer y su mensaje no está acá.
     *
     * Por eso es un campo hermano y no una rama más de `falta`. */
    frescura: await frescuraDe('mensajes'),
  };
}

/**
 * Un cero de mensajes, explicado. **Un cero medido y un cero no medido no son el mismo hecho**
 * (`11` § 9 regla 1), y acá la diferencia manda a alguien a llamar a un cliente creyendo que nunca
 * contestó.
 *
 * Quien sabe cuál de los dos es no es este contacto: es el pulso de la organización. La ingesta
 * camina la cuenta **en orden y sin saltos**, así que una vez que terminó una vuelta completa sin
 * quedar atrasada, un contacto sin mensajes no tiene mensajes de verdad.
 *
 * Y son TRES estados y no dos, porque el del medio es el que dura más al principio: nunca corrió,
 * está a mitad de camino, o terminó.
 */
async function porQueNoHayMensajes(): Promise<string | null> {
  const pulso = await datos()
    .selectFrom('ingesta_pulso')
    .select(['marca_el', 'atrasado'])
    .where('clave', '=', 'mensajes')
    .executeTakeFirst();

  if (!pulso || pulso.marca_el === null) return FALTA.mensajes;
  if (pulso.atrasado) return FALTA.mensajesAMedias;
  // Terminó una vuelta completa: el cero es medido y no hay nada que aclarar.
  return null;
}

// ─── Llamada ────────────────────────────────────────────────────────────────

export interface LlamadaDeFicha {
  id: string;
  agente: string | null;
  contestada: boolean;
  inicioEl: Date | null;
  duracionSegundos: number | null;
  resumen: string | null;
}

/**
 * Las llamadas, la más reciente primero. **Nunca se borra ninguna** (`04` § 1).
 *
 * `nulls last` en el orden: el 42 % de las llamadas de origen no traen hora de inicio, y sin esto
 * la ficha abriría mostrando los intentos sin fecha arriba. El índice
 * `llamadas_por_contacto (org_id, contacto_id, inicio_el desc nulls last)` ya está declarado así.
 */
export async function llamadasDeLaFicha(contactoId: string): Promise<Pestana<LlamadaDeFicha>> {
  const crudas = await datos()
    .selectFrom('llamadas')
    .select(['id', 'agente', 'contestada', 'inicio_el', 'duracion_segundos', 'resumen'])
    .where('contacto_id', '=', contactoId)
    .orderBy('inicio_el', sql`desc nulls last`)
    .orderBy('id', 'desc')
    .execute();

  return {
    filas: crudas.map((l) => ({
      id: l.id,
      agente: l.agente,
      contestada: l.contestada,
      inicioEl: l.inicio_el,
      duracionSegundos: l.duracion_segundos,
      resumen: l.resumen,
    })),
    falta: crudas.length === 0 ? FALTA.llamadas : null,
  };
}

// ─── Notas ──────────────────────────────────────────────────────────────────

export interface NotaDeFicha {
  id: string;
  cuerpo: string;
  /** El nombre de quien la escribió, o `null` = la importó el sistema desde el CRM. */
  autor: string | null;
  origen: 'plataforma' | 'importada';
  creadoEl: Date;
}

/**
 * Las notas del contacto, la más reciente primero.
 *
 * ── UNA SOLA TABLA PARA LOS DOS ROLES, Y ESO ES LA MITAD DEL PUNTO ──────────
 *
 * El `04` § 4 cuenta el defecto que costó más caro de toda la ficha, y eran **tres apilados**: la
 * nota se escribía en otra tabla según por qué camino se registrara, un módulo no le hablaba al
 * endpoint por ninguna vía —sus notas vivían en memoria y **se perdían al recargar**—, y al
 * recargar la lista se reconstruía con las notas vacías, **borrando la que se acababa de crear**.
 *
 * De la medición: *"de 13 resultados registrados con nota, solo 2 llegaron a la tabla"*.
 *
 * `negocio.notas` es una sola tabla y esta función es la única lectura. La migración 011 ya lo
 * declaraba así en su encabezado.
 *
 * El nombre del autor sale de `identidad.usuarios`, que el rol del inquilino puede leer por columna
 * (`grant select (id, org_id, nombre, email, activo)`). Se une por las DOS columnas porque la clave
 * foránea es compuesta.
 */
export async function notasDeLaFicha(contactoId: string): Promise<Pestana<NotaDeFicha>> {
  const crudas = await datos()
    .selectFrom('notas as n')
    .leftJoin('usuarios as u', (j) =>
      j.onRef('u.id', '=', 'n.autor_id').onRef('u.org_id', '=', 'n.org_id'),
    )
    .select(['n.id', 'n.cuerpo', 'n.origen', 'n.creado_el', 'u.nombre as autor'])
    .where('n.contacto_id', '=', contactoId)
    .orderBy('n.creado_el', 'desc')
    .orderBy('n.id', 'desc')
    .execute();

  return {
    filas: crudas.map((n) => ({
      id: n.id,
      cuerpo: n.cuerpo,
      autor: n.autor,
      origen: n.origen,
      creadoEl: n.creado_el,
    })),
    // Las notas NO llevan `falta`: la tabla está poblada por esta misma aplicación, así que cero
    // notas es un cero medido — este contacto no tiene ninguna. Es la única de las cinco pestañas
    // donde el vacío es un hecho y no una pieza que no existe.
    falta: null,
  };
}

// ─── Perfil ─────────────────────────────────────────────────────────────────

export interface CampoDePerfil {
  /** La etiqueta CORTA (`04` § 2): «Objetivo de facturación», no la pregunta entera. */
  etiqueta: string;
  valor: string;
  /** A qué grupo pertenece por su SIGNIFICADO, no por el formulario del que salió. */
  grupo: 'detalles' | 'origen' | 'calificacion' | 'interacciones';
}

/**
 * El perfil, con lo que hoy se sabe de verdad.
 *
 * ── AGRUPADO POR SIGNIFICADO, NO POR FORMULARIO ─────────────────────────────
 *
 * El `04` § 2 lo pide así y explica por qué no es obvio: **la misma pregunta existe en dos
 * formularios con dos claves distintas**, y el lead pudo entrar por cualquiera. Medido contra la
 * cuenta real: hay 160 campos personalizados, y «objetivo de facturación» aparece con clave
 * acentuada y sin acentuar, **las dos existiendo a la vez**. Agrupando por formulario, ese dato
 * aparecería dos veces con dos nombres y nadie sabría cuál mirar.
 *
 * ── LO QUE HOY SE PUEDE MOSTRAR, Y NADA MÁS ─────────────────────────────────
 *
 * Solo las columnas que la sincronización trae de verdad. Los 160 campos personalizados —la
 * calificación entera— viven en GoHighLevel y todavía no se leen; el `falta` lo dice. Inventar los
 * grupos de Calificación e Interacciones con etiquetas vacías sería la forma exacta del defecto que
 * `components/negocio/Fila.jsx` documenta: datos que solo existían en el ejemplo, en producción,
 * mostrando cifras que no eran de nadie.
 *
 * **Los grupos sin campos no se dibujan** (`04` § 2), y eso lo decide la pantalla contando lo que
 * llega — no hace falta mandar grupos vacíos para que los descarte.
 */
export async function perfilDeLaFicha(contactoId: string): Promise<Pestana<CampoDePerfil>> {
  const c = await datos()
    .selectFrom('contactos')
    .select(['nombre', 'telefono', 'email', 'fuente', 'etiquetas', 'score', 'sincronizado_el'])
    .where('id', '=', contactoId)
    .executeTakeFirst();

  if (!c) return { filas: [], falta: FALTA.perfil };

  const campos: CampoDePerfil[] = [];
  const poner = (etiqueta: string, valor: string | null, grupo: CampoDePerfil['grupo']) => {
    // Un campo sin valor NO se manda. El `04` § 2: *"un campo vacío afirma algo falso"*, y un
    // «Correo: —» se lee como «no tiene correo» cuando lo cierto es que no lo trajimos.
    if (valor !== null && valor !== undefined && String(valor).trim() !== '') {
      campos.push({ etiqueta, valor: String(valor), grupo });
    }
  };

  poner('Nombre', c.nombre, 'detalles');
  poner('Teléfono', c.telefono, 'detalles');
  poner('Correo', c.email, 'detalles');
  poner('Fuente', c.fuente, 'origen');
  // La calificación es una letra y hoy **nada la calcula**. Va igual cuando existe: el día que se
  // calcule, aparece sin tocar esto.
  poner('Calificación', c.score, 'calificacion');
  // Las etiquetas crudas del CRM. Van en «Origen» porque es de donde salió el contacto, y sirven
  // para la primera pregunta cuando alguien dice «éste no va acá».
  poner('Etiquetas', (c.etiquetas ?? []).join(', '), 'origen');

  return { filas: campos, falta: FALTA.perfil };
}

// ─── Historial ──────────────────────────────────────────────────────────────

export interface EventoDeHistorial {
  id: string;
  cuando: Date;
  /** Qué pasó, en una línea. */
  titulo: string;
  /** El detalle, si hay. */
  detalle: string | null;
  /** El nombre de quien lo hizo, o `Sistema` si fue un automatismo. */
  autor: string;
}

/**
 * La línea de tiempo del contacto. **Inmutable**: no se edita ni se borra (`04` § 3).
 *
 * ── EL AUTOR ES REAL, SIEMPRE ───────────────────────────────────────────────
 *
 * Un nombre si lo hizo una persona, `Sistema` si lo hizo un automatismo. El `04` § 3 dice que esa
 * distinción es la que sostiene el historial entero: *"atribuirle a alguien una decisión que no
 * tomó convierte el historial en algo que no se puede usar para entender qué pasó"*.
 *
 * Y por eso `Sistema` es el valor de reserva y no el nombre de quien está mirando: una fila sin
 * autor registrado la hizo un automatismo, no la persona que la está leyendo.
 *
 * ── UNA CONSULTA POR ORIGEN, UNIDAS EN MEMORIA ──────────────────────────────
 *
 * Cuatro consultas chicas y un `sort`, en vez de un `union all` en SQL. Las cuatro tablas tienen su
 * índice por contacto, las cuatro devuelven pocas filas, y en memoria se puede dar a cada origen su
 * propio texto sin escribir cuatro `case` dentro de una sentencia. El día que esto tenga que
 * paginar, el `union all` se justifica; hoy sería complejidad sin usar.
 *
 * Los mensajes NO entran: son cientos por contacto y tienen su propia pestaña. Un historial que se
 * inunda de mensajes deja de servir para ver qué pasó.
 */
export async function historialDeLaFicha(contactoId: string): Promise<Pestana<EventoDeHistorial>> {
  const nombreDe = (n: string | null) => n ?? 'Sistema';

  const [resultados, tareas, citas, notas] = await Promise.all([
    datos()
      .selectFrom('resultados as r')
      .leftJoin('usuarios as u', (j) =>
        j.onRef('u.id', '=', 'r.registrado_por').onRef('u.org_id', '=', 'r.org_id'),
      )
      .select(['r.id', 'r.creado_el', 'r.salida', 'r.detalle', 'r.nota', 'u.nombre as autor'])
      .where('r.contacto_id', '=', contactoId)
      .execute(),
    datos()
      .selectFrom('tareas as t')
      .leftJoin('usuarios as u', (j) =>
        j.onRef('u.id', '=', 't.creada_por').onRef('u.org_id', '=', 't.org_id'),
      )
      .select([
        't.id',
        't.creado_el',
        't.vence_el',
        't.modo',
        // `completada_el` da un SEGUNDO evento en la línea de tiempo. Ver abajo.
        't.completada_el',
        'u.nombre as autor',
      ])
      .where('t.contacto_id', '=', contactoId)
      .execute(),
    datos()
      .selectFrom('citas')
      .select(['id', 'creado_el', 'inicio_el', 'titulo', 'estado_ghl'])
      .where('contacto_id', '=', contactoId)
      .execute(),
    datos()
      .selectFrom('notas as n')
      .leftJoin('usuarios as u', (j) =>
        j.onRef('u.id', '=', 'n.autor_id').onRef('u.org_id', '=', 'n.org_id'),
      )
      .select(['n.id', 'n.creado_el', 'n.cuerpo', 'u.nombre as autor'])
      .where('n.contacto_id', '=', contactoId)
      .execute(),
  ]);

  const eventos: EventoDeHistorial[] = [
    /* ════════════════════════════════════════════════════════════════════════
       LA NOTA APARECÍA TRES VECES, Y ERAN TRES FILAS DEL MISMO TEXTO

       Un solo Avanzar con nota escribe ese texto en TRES tablas, y a propósito —está justificado en
       `lib/negocio/avanzar.ts`: `resultados.nota` es lo que se dijo al registrar y viaja con el
       resultado para siempre, `notas` es el hilo donde la persona la va a buscar, y `tareas.nota` es
       el recordatorio del día que toca—.

       Lo que estaba mal es que el historial las LEÍA todas como detalle, y con `?? ` de reserva:

           «Se registró «seguimiento»»        → Muy interesado
           «Seguimiento para el 3 de marzo»    → Muy interesado
           «Nota»                              → Muy interesado

       Tres líneas seguidas con el mismo texto, en la pantalla cuyo punto es *entender qué pasó*. Y
       no es cosmético: un historial que repite hace dudar de si hubo tres cosas o una.

       La cura no es borrar ninguna columna —las tres tienen su motivo— sino que cada fila muestre
       **solo lo suyo**: el resultado, lo que se eligió en su campo; el seguimiento, su modo; y la
       nota, el texto. La nota queda una sola vez, y sigue estando.
       ════════════════════════════════════════════════════════════════════════ */
    ...resultados.map((r) => ({
      id: `resultado:${r.id}`,
      cuando: r.creado_el,
      // El NOMBRE humano de la salida y no su clave: `definicionDe` es el mismo catálogo que usa la
      // pantalla, y «Se registró «acuerdo_sin_pago»» es jerga de la base en la cara de quien mira.
      titulo: `Se registró «${definicionDe(r.salida)?.nombre ?? r.salida}»`,
      // `r.detalle` y NO `?? r.nota`: la nota tiene su propia fila, del mismo segundo.
      detalle: r.detalle,
      autor: nombreDe(r.autor),
    })),
    ...tareas.map((t) => ({
      id: `tarea:${t.id}`,
      cuando: t.creado_el,
      /* En español y con el año. Antes decía «Seguimiento para el Mon Mar 15» — ver
         `diaDeLaColumna` para las dos formas de equivocarse acá. */
      titulo: `Seguimiento para el ${fechaDelDia(diaDeLaColumna(t.vence_el))}`,
      /* El MODO, en palabras, y no la nota. «Lo retomo yo» y «Que lo persiga la secuencia» son dos
         cosas distintas y es el único dato que esta fila aporta que ninguna otra tiene.
         Solo `seguimiento` tiene modos, así que la salida se puede dar por sabida; si el modo no
         está en el catálogo se muestra crudo, que es preferible a ocultarlo. */
      detalle: t.modo === null ? null : (modoDe('seguimiento', t.modo)?.nombre ?? t.modo),
      autor: nombreDe(t.autor),
    })),
    /* ── Y EL CIERRE DEL SEGUIMIENTO, QUE ES UN EVENTO Y NO SE VEÍA ──────────
     *
     * `tareas.completada_el` tenía dos lectores y **cero escritores** hasta hace poco: un seguimiento
     * no se podía cerrar nunca. Ahora se cierra al responderle al contacto y al registrar un Avanzar
     * nuevo, así que hay un instante que contar, y es de los importantes: sin él el historial muestra
     * «Seguimiento para el 3 de marzo» y nada más, y no hay forma de saber si se atendió.
     *
     * El autor es `Sistema` y no se adivina: la tabla no tiene columna de quién cerró. Puede haber
     * sido una respuesta o un Avanzar de una persona, y atribuirlo a `t.creada_por` —que es quien lo
     * CREÓ— sería justo lo que el encabezado de esta función prohíbe: *«atribuirle a alguien una
     * decisión que no tomó convierte el historial en algo que no se puede usar para entender qué
     * pasó»*. */
    ...tareas
      .filter((t) => t.completada_el !== null)
      .map((t) => ({
        id: `tarea-cerrada:${t.id}`,
        cuando: t.completada_el as Date,
        titulo: 'Se cerró el seguimiento',
        detalle: null,
        autor: 'Sistema',
      })),
    ...citas.map((c) => ({
      id: `cita:${c.id}`,
      /* LA HORA DE LA CITA, no la de la copia.
         Era `creado_el`, que es cuándo el barrido la trajo — y el barrido trae todo junto: las 43
         filas del primer barrido real quedaron con el mismo `creado_el` al minuto. El historial
         ordenaba por el orden en que copiamos, que no es un hecho del contacto sino de nuestro
         proceso, y con eso una cita de hace dos semanas aparecía arriba de una nota de ayer. */
      cuando: c.inicio_el,
      titulo: c.titulo ?? 'Cita agendada',
      // El estado viene crudo del CRM y se muestra crudo: es el vocabulario de ellos, y
      // traducirlo haría que el día que cambie nadie entienda qué pasó.
      detalle: c.estado_ghl,
      // Las citas las agenda un automatismo del CRM, no una persona de esta aplicación.
      autor: 'Sistema',
    })),
    ...notas.map((n) => ({
      id: `nota:${n.id}`,
      cuando: n.creado_el,
      titulo: 'Nota',
      detalle: n.cuerpo,
      autor: nombreDe(n.autor),
    })),
  ].sort((a, b) => b.cuando.getTime() - a.cuando.getTime());

  return {
    filas: eventos,
    // Con notas ya hay historial de verdad, aunque parcial. `falta` solo cuando no hay NADA, y
    // dice qué orígenes todavía no existen en vez de un «sin datos» que no orienta.
    falta: eventos.length === 0 ? FALTA.historial : null,
  };
}
