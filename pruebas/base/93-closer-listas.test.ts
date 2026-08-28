// Las TRES listas del territorio del closer, invocadas de verdad. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ CUBRE ESTE ARCHIVO Y POR QUÉ HACÍA FALTA
//
// `GET /api/closer/pipeline`, `GET /api/closer/mi-dia` y `GET /api/closer/contactos` estaban
// cubiertas nada más por los guardias de arquitectura, que LEEN el archivo de ruta y no lo
// ejecutan: comprueban que declara `PANTALLA`, que llama a `exigir` y que pide `closer.ver`. Un
// `exigir` impecable sobre una consulta que devuelve el territorio equivocado —o la organización
// equivocada— pasa los dos guardias sin una queja.
//
// Las tres comparten `filasDeTerritorio('closer', …)`, así que comparten sus modos de falla. Los
// cinco que se prueban acá son los que ya ocurrieron en este repositorio o están señalados como
// «casi siempre se implementa mal»:
//
//   1. Una columna vacía que DESAPARECE. «Ganado 0» es una afirmación; un Ganado ausente es una
//      pregunta que nadie se hace.
//   2. El filtro de territorio que no filtra. Ya pasó en la Agenda: devolvía las citas de
//      cualquier contacto de la empresa, y no fallaba nada.
//   3. La organización que se cruza. Se rompe cambiando `orgEfectiva` por otra cosa, y el
//      síntoma es una lista plausible con los datos de otro cliente.
//   4. El conteo y la lista que salen de dos lados. «La tarjeta anunciaba seis llamadas que no
//      existían.»
//   5. La clasificación por etapa, con sus dos precedencias: la etapa escrita gana sobre la
//      etiqueta, y entre etiquetas gana la venta. Sin precedencia declarada, el mismo contacto
//      cae en una columna u otra según cómo vino ordenada la respuesta del CRM.
//
// ── POR QUÉ CASI NINGUNA ASERCIÓN USA NÚMEROS ABSOLUTOS ─────────────────────
//
// Las tres listas son del TERRITORIO COMPLETO de la organización, y varias pruebas siembran en
// `alfa` a la vez. Una aserción como «el pipeline tiene 9 contactos» falla sola y pasa aislada,
// que es el peor tipo de prueba que se puede tener. Así que todo lo que se afirma acá es o de lo
// SEMBRADO POR ESTA MARCA (buscado por su `id`) o una identidad interna de la respuesta —
// `cuantos === filas.length`, `clasificados` suma `total`— que es cierta con cualquier vecino.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import {
  leerRespuesta,
  limpiar,
  montar,
  pedirComo,
  unaCita,
  unaTarea,
  unContacto,
  type Escenario,
} from '../apoyo/closer.ts';
import { GET as verPipeline } from '../../app/api/closer/pipeline/route.ts';
import { GET as verMiDia } from '../../app/api/closer/mi-dia/route.ts';
import { GET as verContactos } from '../../app/api/closer/contactos/route.ts';

// ── LA FORMA DE LO QUE VIAJA, escrita a mano ────────────────────────────────
//
// No se importan `Pipeline` ni `MiDia` de `lib/negocio/`: del otro lado del `JSON.stringify` una
// `Date` es una cadena, y tipar la respuesta con el tipo del servidor haría que el compilador
// avale un `.getTime()` que en tiempo de ejecución no existe. Acá sólo se declara lo que estas
// pruebas leen.

interface IconosJson {
  reunionesTenidas: number;
  citaFutura: boolean;
  llamadasContestadas: number;
  estadoAgente: string;
  seguimientoAbierto: boolean;
  montoVenta: string | null;
}

interface FilaJson {
  id: string;
  nombre: string;
  etapa: string | null;
  etiquetas: string[];
  iconos: IconosJson;
  /** `true` = no está en ningún territorio. Lo trae el Pipeline; Mi Día no lo trae nunca. */
  congelado: boolean;
}

interface ColumnaJson {
  clave: string;
  nombre: string;
  cuantos: number;
  filas: FilaJson[];
}

interface PipelineJson {
  columnas: ColumnaJson[];
  total: number;
  hayMas: boolean;
  clasificados: { porResultado: number; porEtiqueta: number; sinNada: number };
  /** El desglose de la cartera: `activos + congelados === total`. */
  cartera: { activos: number; congelados: number };
}

interface EnLaColaJson {
  fila: FilaJson;
  caso?: string;
  pideManos?: boolean;
}

interface MiDiaJson {
  cockpit: { tareasPendientes: { valor: number | null; falta?: string } };
  colas: {
    urgentes: EnLaColaJson[];
    agenda: EnLaColaJson[];
    buzon: EnLaColaJson[];
    seguimientos: EnLaColaJson[];
    completadas: EnLaColaJson[];
    tareasPendientes: number;
    truncado: boolean;
  };
  zonaHoraria: string;
  mirandoOtraOrganizacion: boolean;
}

interface ListaJson {
  filas: FilaJson[];
  pagina: number;
  hayMas: boolean;
}

/**
 * LAS SIETE CLAVES, ESCRITAS A MANO Y NO IMPORTADAS DE `etapas.ts`.
 *
 * A propósito. Con `ETAPAS.map((e) => e.clave)` como valor esperado, borrar una etapa del arreglo
 * de producción cambiaría los dos lados de la comparación y la prueba seguiría verde: quedaría
 * comprobando que el Pipeline devuelve lo que devuelve. Escritas acá, retirar «Ganado» rompe algo.
 */
const LAS_SIETE = [
  'agendado',
  'seguimiento',
  'cierre',
  'ganado',
  'no_show',
  'nurture',
  'descalificado',
] as const;

let esc: Escenario;

/** Los `id` de todo lo sembrado. Se siembra UNA vez: las tres listas sólo leen. */
const s = {
  /** Etapa escrita `seguimiento` — vía 1 de la clasificación. */
  etapaEscrita: '',
  /** Sin etapa y con `venta_ganada` — vía 2, por la etiqueta. */
  porEtiqueta: '',
  /** Sin etapa y sin etiquetas — vía 3, la etapa de entrada. */
  sinNada: '',
  /** Sin etapa, con `seguimiento` Y `venta_ganada` — la precedencia entre etiquetas. */
  dosEtiquetas: '',
  /** Etapa `seguimiento` Y etiqueta `venta_ganada` — la precedencia de la etapa escrita. */
  etapaContraEtiqueta: '',
  /** Etapa que ya no existe entre las siete. Ver el DEFECTO DOCUMENTADO. */
  etapaRetirada: '',
  /** Con `seguimiento_recupero`: entra a Seguimientos y **no pide manos**. */
  automatico: '',
  /** Con una TAREA manual vencida hoy: entra a Seguimientos y **sí pide manos**. */
  conTarea: '',
  /** Con `bot_activado_leadflow`: el único sembrado cuyo `estadoAgente` no es el valor de reserva. */
  conAgente: '',
  /** Con último entrante: entra al Buzón, y es el que lleva las citas. */
  enBuzon: '',
  /** `territorio = 'setter'`. NO es de ninguna lista del closer. */
  delSetter: '',
  /** `territorio = null` — el congelado. Tampoco. */
  congelado: '',
  /** Closer, pero de `otraOrg`. */
  deLaOtraOrg: '',
};

before(async () => {
  esc = await montar('Listas');

  const ahora = Date.now();
  /* Tres horas de margen a cada lado del ahora. Las citas se comparan contra `now()` de la BASE,
     que es otro reloj: con minutos de diferencia, un desfase de relojes entre la aplicación y
     PostgreSQL haría que la cita «pasada» cuente como futura y la prueba fallara sola. */
  const haceTresHoras = new Date(ahora - 3 * 3600_000);
  const enTresHoras = new Date(ahora + 3 * 3600_000);
  const haceCincoMinutos = new Date(ahora - 5 * 60_000);

  s.etapaEscrita = (await unContacto(esc, { nombre: 'Listas etapa escrita', etapa: 'seguimiento' })).id;
  s.porEtiqueta = (
    await unContacto(esc, { nombre: 'Listas por etiqueta', etiquetas: ['venta_ganada'] })
  ).id;
  s.sinNada = (await unContacto(esc, { nombre: 'Listas sin nada' })).id;
  s.dosEtiquetas = (
    await unContacto(esc, {
      nombre: 'Listas dos etiquetas',
      // El orden es el ADVERSO a propósito: `seguimiento` primero. Si la clasificación tomara «la
      // primera que aparezca» en vez de la precedencia declarada, este contacto caería en
      // Seguimiento y la prueba de la precedencia se pondría roja.
      etiquetas: ['seguimiento', 'venta_ganada'],
    })
  ).id;
  s.etapaContraEtiqueta = (
    await unContacto(esc, {
      nombre: 'Listas etapa contra etiqueta',
      etapa: 'seguimiento',
      etiquetas: ['venta_ganada'],
    })
  ).id;
  s.etapaRetirada = (
    await unContacto(esc, { nombre: 'Listas etapa retirada', etapa: 'etapa_que_ya_no_existe' })
  ).id;
  s.automatico = (
    await unContacto(esc, { nombre: 'Listas automatico', etiquetas: ['seguimiento_recupero'] })
  ).id;

  /* EL SEGUIMIENTO QUE SÍ PIDE MANOS, y es el sumando que faltaba.
   *
   * Sin una fila en `negocio.tareas`, el término `seguimientos.filter(pideManos)` de la identidad
   * del contador vale CERO siempre, y entonces `pideManos: true` se puede cambiar a `false` en
   * `miDia.ts` sin que nada se ponga rojo: el contador y la suma esperada bajan juntos. Se comprobó
   * mutándolo — pasaba verde acá y en el `92`—, y la consecuencia es que el badge dejaría de contar
   * todos los seguimientos manuales del día, que es exactamente lo que el badge existe para contar.
   *
   * El día se calcula en la ZONA DE LA EMPRESA y con el reloj de la base: la cola corta en
   * «mañana en Lima», así que un día armado con `new Date()` del proceso dejaría la fila fuera de
   * la cola alrededor de la medianoche y la prueba fallaría sola. */
  const hoyLocal = await esc.admin.query<{ dia: string }>(
    `select (date_trunc('day', timezone(o.zona_horaria, now())))::date::text as dia
       from identidad.organizaciones o where o.id = $1`,
    [esc.org],
  );
  const diaDeHoy = hoyLocal.rows[0]?.dia;
  assert.ok(diaDeHoy, 'la base no devolvió el día de hoy en la zona de la empresa');
  s.conTarea = (await unContacto(esc, { nombre: 'Listas con tarea' })).id;
  await unaTarea(esc, s.conTarea, { venceEl: diaDeHoy });

  /* El agente ENCENDIDO. `bot_activado_leadflow` está en el contrato como
     `atendiendo_pre_agenda`, y ése es el único sembrado de este archivo cuyo `estadoAgente` no es
     el valor de reserva: sin él, el ícono se puede fijar en una constante y las tres listas
     seguirían coincidiendo entre sí, que es lo único que el `deepEqual` mira. */
  s.conAgente = (
    await unContacto(esc, { nombre: 'Listas con agente', etiquetas: ['bot_activado_leadflow'] })
  ).id;
  s.enBuzon = (
    await unContacto(esc, {
      nombre: 'Listas en buzon',
      ultimoEntranteEl: haceCincoMinutos,
      ultimoEntranteTexto: 'Quiero saber el precio',
    })
  ).id;

  /* Las tres citas del contacto del Buzón. Son lo que hace que sus seis íconos NO sean todos cero,
     y por eso sirven para comparar el dato entre las tres listas: dos objetos de ceros son
     idénticos aunque los calcule código distinto. */
  await unaCita(esc, s.enBuzon, { inicioEl: haceTresHoras });
  await unaCita(esc, s.enBuzon, { inicioEl: new Date(ahora - 2 * 3600_000), estado: 'cancelled' });
  await unaCita(esc, s.enBuzon, { inicioEl: enTresHoras });

  /* Los tres que NO tienen que aparecer, y los tres con último entrante RECIENTE.
     Es deliberado: si el filtro por territorio o el aislamiento por organización se rompieran,
     estos tres entrarían al Buzón —cuya única condición es haber escrito— y quedarían además
     arriba en la lista paginada, que ordena por `ultimo_entrante_el desc`. Sin esa fecha,
     «no aparece» podría significar nada más «cayó en la página 2». */
  s.delSetter = (
    await unContacto(esc, {
      nombre: 'Listas del setter',
      territorio: 'setter',
      ultimoEntranteEl: haceCincoMinutos,
      ultimoEntranteTexto: 'soy del otro territorio',
    })
  ).id;
  s.congelado = (
    await unContacto(esc, {
      nombre: 'Listas congelado',
      territorio: null,
      ultimoEntranteEl: haceCincoMinutos,
      ultimoEntranteTexto: 'no estoy en ningún territorio',
    })
  ).id;
  s.deLaOtraOrg = (
    await unContacto(esc, {
      nombre: 'Listas de la otra org',
      org: esc.otraOrg,
      ultimoEntranteEl: haceCincoMinutos,
      ultimoEntranteTexto: 'soy de beta',
    })
  ).id;
});

after(async () => {
  await limpiar(esc);
  await cerrarTodo();
  await cerrarClientes();
});

// ── LECTURAS ───────────────────────────────────────────────────────────────

async function pipeline(): Promise<PipelineJson> {
  const { estado, cuerpo } = await leerRespuesta<PipelineJson>(
    await verPipeline(pedirComo('/api/closer/pipeline', esc.token)),
  );
  // 200 y no 403: `ADR-0305` al revés. Si el portero rechazara a la administradora de `alfa`, todo
  // lo de abajo sería «no aparece» por el motivo equivocado y no se notaría.
  assert.equal(estado, 200);
  return cuerpo;
}

async function miDia(): Promise<MiDiaJson> {
  const { estado, cuerpo } = await leerRespuesta<MiDiaJson>(
    await verMiDia(pedirComo('/api/closer/mi-dia', esc.token)),
  );
  assert.equal(estado, 200);
  return cuerpo;
}

async function contactos(consulta = ''): Promise<ListaJson> {
  const { estado, cuerpo } = await leerRespuesta<ListaJson>(
    await verContactos(pedirComo(`/api/closer/contactos${consulta}`, esc.token)),
  );
  assert.equal(estado, 200);
  return cuerpo;
}

/** Todas las filas del Pipeline, sin importar en qué columna cayeron. */
const filasDelPipeline = (p: PipelineJson): FilaJson[] => p.columnas.flatMap((c) => c.filas);

/** Todas las filas de las cinco colas de Mi Día. */
const filasDeMiDia = (m: MiDiaJson): FilaJson[] =>
  [
    ...m.colas.urgentes,
    ...m.colas.agenda,
    ...m.colas.buzon,
    ...m.colas.seguimientos,
    ...m.colas.completadas,
  ].map((e) => e.fila);

const hay = (filas: readonly FilaJson[], id: string): boolean => filas.some((f) => f.id === id);

function columna(p: PipelineJson, clave: string): ColumnaJson {
  const c = p.columnas.find((x) => x.clave === clave);
  assert.ok(c, `el Pipeline no trajo la columna \`${clave}\``);
  return c;
}

/** En qué columna cayó un contacto sembrado. Falla si no cayó en ninguna. */
function columnaDe(p: PipelineJson, id: string): string {
  const c = p.columnas.find((x) => x.filas.some((f) => f.id === id));
  assert.ok(
    c,
    `el contacto ${id} es del territorio del closer y no está en NINGUNA columna. El \`02\` lo ` +
      'llama defecto con esas palabras: "si un contacto del territorio no aparece en ninguna ' +
      'columna, hay un defecto".',
  );
  return c.clave;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · LAS SIETE COLUMNAS
// ═══════════════════════════════════════════════════════════════════════════════

test('las SIETE columnas vienen siempre, en orden, y las vacías traen su cero y su lista', async () => {
  const p = await pipeline();

  /* La aserción que carga con todo el peso.
   *
   * El defecto que atrapa es el que parece una mejora: dibujar sólo las columnas que tienen algo.
   * Con esa versión, `alfa` —que hoy no tiene ni un Descalificado ni un No-show sembrado por nadie—
   * devolvería cuatro o cinco columnas y esta comparación se pondría roja. Sin ella, el Pipeline
   * podría dejar de nombrar «Ganado» cuando no hay ninguna venta, y la pantalla pasaría de decir
   * «Ganado 0» —una afirmación— a no decir nada, que es una pregunta que nadie se hace.
   *
   * Va el orden y no un conjunto: las columnas son el recorrido de la entrada al desenlace, y una
   * lista con las mismas siete en otro orden es un tablero que se lee al revés. */
  assert.deepEqual(
    p.columnas.map((c) => c.clave),
    [...LAS_SIETE],
  );

  for (const c of p.columnas) {
    // Un nombre vacío dibujaría una columna sin encabezado: siete columnas anónimas no son siete
    // columnas.
    assert.ok(c.nombre.length > 0, `la columna \`${c.clave}\` vino sin nombre`);
    /* `filas` tiene que ser un arreglo incluso en cero. Si viniera `undefined` —el resultado
       natural de un `Map.get()` sin respaldo— la pantalla haría `.map` sobre nada y la columna
       vacía se convertiría en una pantalla en blanco. */
    assert.ok(Array.isArray(c.filas), `la columna \`${c.clave}\` vino sin \`filas\``);
    if (c.cuantos === 0) assert.deepEqual(c.filas, []);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · LA CLASIFICACIÓN Y SUS DOS PRECEDENCIAS
// ═══════════════════════════════════════════════════════════════════════════════

test('la clasificación: la etapa escrita, la etiqueta de desenlace, y la etapa de entrada', async () => {
  const p = await pipeline();

  // Vía 1. Lo escribió una persona con Avanzar, así que es un hecho y manda.
  assert.equal(columnaDe(p, s.etapaEscrita), 'seguimiento');

  /* Vía 2. Es el caso NORMAL hoy —239 contactos y cero resultados registrados—, así que si esta
     vía se rompiera el Pipeline entero se apilaría en «Agendado» y seguiría pareciendo correcto:
     una columna de entrada llena es exactamente lo que se espera ver al principio. */
  assert.equal(columnaDe(p, s.porEtiqueta), 'ganado');

  /* Vía 3. `agendado` es una regla de negocio con nombre —el traspaso de zona lo hace el CRM justo
     al agendar—, no un «no sé dónde ponerlo». El defecto que se atrapa acá es que un contacto sin
     etapa y sin etiquetas conocidas DESAPAREZCA de las siete columnas. */
  assert.equal(columnaDe(p, s.sinNada), 'agendado');
});

test('PRECEDENCIA: entre etiquetas gana la venta, y la etapa escrita le gana a la etiqueta', async () => {
  const p = await pipeline();

  /* `seguimiento` + `venta_ganada`, sembradas en ese orden. Gana la venta.
   *
   * Las etiquetas se ACUMULAN —registrar un resultado nuevo no borra el anterior— y la lista que
   * devuelve el CRM no trae fechas, así que sin una precedencia declarada este contacto caería en
   * una columna u otra según cómo vino ordenado el arreglo. El costo concreto de que gane
   * `seguimiento`: alguien que ya cobró seguiría apareciendo en la columna de trabajo activo. */
  assert.equal(columnaDe(p, s.dosEtiquetas), 'ganado');

  /* Etapa `seguimiento` escrita CONTRA la etiqueta `venta_ganada`. Gana la etapa.
   *
   * Es la vía 1 sobre la vía 2, y no es una preferencia estética: la etiqueta la pone un
   * automatismo del CRM y la etapa la escribió una persona. Si ganara la etiqueta, un Avanzar
   * registrado a mano quedaría pisado por lo que el CRM dejó puesto de antes — y el contacto se
   * movería solo de columna sin que nadie hiciera nada. */
  assert.equal(columnaDe(p, s.etapaContraEtiqueta), 'seguimiento');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · EL CONTEO Y LA LISTA, QUE TIENEN QUE SALIR DEL MISMO LADO
// ═══════════════════════════════════════════════════════════════════════════════

test('cada columna: `cuantos` es el largo de `filas`, y `total` es la suma de las siete', async () => {
  const p = await pipeline();

  /* El defecto que esto atrapa está documentado con su síntoma: «la tarjeta anunciaba seis
     llamadas que no existían: el conteo venía de un lado y la lista del otro». Acá el conteo sale
     de `contarPorEtapa()` y la lista de un `Map`, o sea de DOS recorridos sobre el mismo arreglo —
     y dos recorridos se separan. Con el encabezado diciendo «Ganado 6» sobre cuatro tarjetas,
     nadie sabe cuál de los dos números creer. */
  for (const c of p.columnas) {
    assert.equal(
      c.cuantos,
      c.filas.length,
      `la columna \`${c.clave}\` anuncia ${c.cuantos} y trae ${c.filas.length} filas`,
    );
  }

  const filas = filasDelPipeline(p);
  // Y el total tampoco es un tercer cálculo. Si `total` fuera mayor que la suma de las columnas,
  // habría contactos contados y no dibujados: los que el `02` dice que no pueden existir.
  assert.equal(
    p.columnas.reduce((n, c) => n + c.cuantos, 0),
    p.total,
  );
  assert.equal(filas.length, p.total);

  // Y ningún contacto en dos columnas: `total` sería correcto y las columnas sumarían de más.
  assert.equal(new Set(filas.map((f) => f.id)).size, filas.length);

  // El tope del territorio no se alcanzó, así que los conteos de arriba son los reales y no una
  // parte que parece el todo.
  assert.equal(p.hayMas, false);
});

test('`clasificados` suma `total`: ningún contacto queda fuera de los tres cajones', async () => {
  const p = await pipeline();
  const { porResultado, porEtiqueta, sinNada } = p.clasificados;

  /* Los tres cajones dicen de dónde salió cada columna, y mientras el segundo sea la mayoría el
     tablero describe lo que el CRM etiquetó y no lo que alguien registró. Ese es el punto de la
     cifra, y por eso tiene que cerrar: un contacto que no cae en ninguno de los tres —una cadena
     de `if` con un hueco— hace que la pantalla diga «12 por etiqueta de 15» y que los tres
     restantes no existan para nadie. */
  assert.equal(porResultado + porEtiqueta + sinNada, p.total);

  /* Y LOS TRES CAJONES SON TRES, que es la mitad que la suma sola no puede dar.
   *
   * La suma cierra igual si un cajón se vacía en otro: borrando la rama de `porEtiqueta` en
   * `pipeline.ts`, esos contactos caen en `sinNada`, el total sigue cuadrando y la única aserción que
   * había acá —`n >= 0` sobre tres contadores que arrancan en 0 y sólo se incrementan— pasaba
   * siempre. Se comprobó mutándolo: las doce pruebas de este archivo seguían verdes.
   *
   * Lo que se pierde con eso no es un número de adorno. `porEtiqueta` es la cifra que dice «esto lo
   * clasificó el CRM, no una persona»: reportarla en cero mientras `sinNada` la absorbe convierte
   * «el tablero refleja etiquetas del CRM» en «el tablero no sabe de dónde salió nada», y las dos
   * lecturas llevan a decisiones distintas sobre si hay que confiar en las columnas.
   *
   * Los tres son estrictamente positivos porque este archivo siembra al menos uno de cada uno
   * —tres con etapa escrita, dos con etiqueta de desenlace y sin etapa, dos pelados— y lo que
   * siembren otros archivos sólo puede sumar. */
  assert.ok(
    porResultado > 0,
    'sembré tres contactos con `etapa` escrita y el cajón «por resultado» vino en cero',
  );
  assert.ok(
    porEtiqueta > 0,
    'sembré dos contactos sin etapa y con etiqueta de desenlace, y el cajón «por etiqueta» vino en ' +
      'cero: la clasificación por etiqueta se está contando como «sin nada»',
  );
  assert.ok(
    sinNada > 0,
    'sembré dos contactos sin etapa y sin etiquetas y el cajón «sin nada» vino en cero',
  );
});

test('una etapa retirada cae por el respaldo Y NO cuenta como «por resultado»', async () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // ESTA PRUEBA ERA UN DEFECTO DOCUMENTADO, Y SE PUSO ROJA AL ARREGLARLO
  //
  // Su versión anterior decía: *«No se arregla acá — se reporta. Si algún día se arregla, esta línea
  // se pone roja y hay que cambiarla, que es exactamente el aviso que se quiere»*. Y así fue.
  //
  // El defecto: `clasificados.porResultado` usaba `etapa !== null`, no «la etapa es una de las
  // siete». Con una etapa retirada —`contactos.etapa` es `text` sin restricción en la base— el
  // contacto se dibujaba en «Agendado» por el respaldo Y se contaba como «registrado por una
  // persona». Dos afirmaciones contradictorias sobre el mismo contacto, y la cifra que la pantalla
  // usa para decir «esto lo registró alguien» incluía a quien nadie registró.
  //
  // La cura fue una sola definición: `esUnaDeLasSiete` en `lib/negocio/etapas.ts`, que es la misma
  // que usa `etapaDelContacto` para decidir si le cree a la columna. Antes existía dos veces, con
  // dos condiciones distintas.
  // ═══════════════════════════════════════════════════════════════════════════
  const p = await pipeline();

  // Lo que ya estaba bien: cae por el respaldo, no a una columna que no se dibuja.
  assert.equal(columnaDe(p, s.etapaRetirada), 'agendado');
  const retirado = filasDelPipeline(p).find((f) => f.id === s.etapaRetirada);
  assert.equal(retirado?.etapa, 'etapa_que_ya_no_existe');

  // Y lo que se arregló: NO se cuenta entre los que tienen un resultado registrado.
  assert.equal(
    p.clasificados.porResultado,
    filasDelPipeline(p).filter((f) => f.etapa !== null && f.etapa !== 'etapa_que_ya_no_existe').length,
    'una etapa retirada volvió a contarse como «registrado por una persona», y a la vez se dibuja ' +
      'en la columna de entrada: las dos cosas no pueden ser ciertas del mismo contacto',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · EL TERRITORIO, EN LAS TRES LISTAS
// ═══════════════════════════════════════════════════════════════════════════════

test('el territorio filtra de verdad: ni el del setter ni el congelado entran a las tres listas', async () => {
  const [p, m, l] = [await pipeline(), await miDia(), await contactos()];

  const enLasTres: [string, FilaJson[]][] = [
    ['el Pipeline', filasDelPipeline(p)],
    ['Mi Día', filasDeMiDia(m)],
    ['la lista de contactos', l.filas],
  ];

  /* EL CONTROL POSITIVO, y sin él las tres aserciones de abajo no valen nada: una lista que
     devuelve cero filas por cualquier motivo —una consulta rota, un contexto de organización que
     no se puso— cumple «no trae los de otro territorio» sin haber filtrado nada. */
  for (const [donde, filas] of enLasTres) {
    assert.ok(hay(filas, s.enBuzon), `${donde} no trae un contacto del closer que sí es suyo`);
  }

  /* Y ahora sí: el del setter NO está en ninguna de las tres.
   *
   * Este defecto ya ocurrió en este repositorio, en la Agenda: devolvía las citas de cualquier
   * contacto de la empresa. No falla ni se ve raro — el closer trabaja contactos que no son suyos
   * y el setter descubre que otro ya los llamó. El sembrado tiene último entrante reciente, así que
   * si el `where territorio` se cayera entraría al Buzón y arriba en la lista paginada. */
  for (const [donde, filas] of enLasTres) {
    assert.equal(hay(filas, s.delSetter), false, `${donde} trae un contacto del SETTER`);
  }

  /* ── EL CONGELADO CAMBIÓ DE LADO, Y NO EN LAS TRES LISTAS ─────────────────
   *
   * Antes esta prueba exigía que NO estuviera en ninguna. Era la mitad correcta y la mitad
   * equivocada, porque las tres listas no responden la misma pregunta:
   *
   *   · el **Pipeline** es la CARTERA, y `sincronizar.ts` afirma del congelado que *«sigue visible y
   *     atenuado, sigue siendo movible, no se borra»*. Nada de eso existía: un contacto que perdía
   *     su zona desaparecía de la aplicación sin rastro, y el closer veía bajar su cartera sin
   *     ninguna explicación disponible;
   *   · **Mi Día** son las COLAS DE TRABAJO, y ahí no va: no es trabajo de este closer. Los
   *     documentos lo dicen dos veces — *«los congelados no entran ni a Urgentes ni al Buzón»*;
   *   · la **lista paginada** es del territorio, y tampoco.
   *
   * Así que la aserción se parte en dos, y la del Pipeline es positiva. */
  assert.ok(
    hay(filasDelPipeline(p), s.congelado),
    'el Pipeline no trae al congelado: un contacto que pierde su zona desaparece de la aplicación ' +
      'sin rastro, y no hay dónde mirar por qué bajó la cartera',
  );
  // Y viene MARCADO, que es lo que impide que se lea como trabajo de esta pestaña.
  assert.equal(
    filasDelPipeline(p).find((f) => f.id === s.congelado)?.congelado,
    true,
    'el congelado viene sin marcar: la pantalla lo dibuja igual que uno activo',
  );
  // Y sus datos NO se resumen: los seis íconos siguen ahí, como en una fila completada.
  assert.ok(
    filasDelPipeline(p).find((f) => f.id === s.congelado)?.iconos !== undefined,
    'al congelado se le sacaron los íconos: es justo lo que permite decidir si hay que volver a él',
  );

  for (const [donde, filas] of [
    ['Mi Día', filasDeMiDia(m)],
    ['la lista de contactos', l.filas],
  ] as [string, FilaJson[]][]) {
    assert.equal(
      hay(filas, s.congelado),
      false,
      `${donde} trae un contacto CONGELADO, y ahí no va: no es trabajo de este closer`,
    );
  }
});

test('la otra organización no se cruza en ninguna de las tres listas', async () => {
  const [p, m, l] = [await pipeline(), await miDia(), await contactos()];

  /* El contacto de `beta` es del territorio del closer y escribió hace cinco minutos: cumple todas
     las condiciones de las tres listas menos la organización. Es el único filtro que lo deja
     afuera, y no lo pone ninguna de estas consultas —lo pone la política de fila con el `org_id`
     que `conOrganizacion(orgEfectiva)` dejó en la transacción—.
     El modo de falla es una ruta que usa `orgPropia` en vez de `orgEfectiva`, o que arma el
     contexto una sola vez: la respuesta sigue siendo una lista plausible, con los datos de otro
     cliente adentro. */
  assert.equal(hay(filasDelPipeline(p), s.deLaOtraOrg), false, 'el Pipeline trae a beta');
  assert.equal(hay(filasDeMiDia(m), s.deLaOtraOrg), false, 'Mi Día trae a beta');
  assert.equal(hay(l.filas, s.deLaOtraOrg), false, 'la lista de contactos trae a beta');

  // Y `alfa` sí ve lo suyo: si no, lo de arriba se cumpliría con las tres listas vacías.
  assert.ok(hay(filasDelPipeline(p), s.enBuzon));
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · MI DÍA: EL CONTADOR Y LA LISTA
// ═══════════════════════════════════════════════════════════════════════════════

test('Mi Día: el contador cuenta las colas que PIDEN MANOS, y el cockpit recibe ese mismo número', async () => {
  const m = await miDia();

  // La forma del contrato. Cinco colas, siempre las cinco: una cola que falta se dibuja igual que
  // una cola vacía, y no significan lo mismo.
  for (const cola of ['urgentes', 'agenda', 'buzon', 'seguimientos', 'completadas'] as const) {
    assert.ok(Array.isArray(m.colas[cola]), `Mi Día vino sin la cola \`${cola}\``);
  }
  // La zona de la ORGANIZACIÓN —`alfa` es Lima—, no la del servidor ni la del navegador. De esto
  // depende qué es «hoy»: con la del servidor, un closer en Lima ve la agenda corrida.
  assert.equal(m.zonaHoraria, 'America/Lima');
  assert.equal(m.mirandoOtraOrganizacion, false);
  assert.equal(m.colas.truncado, false);

  /* El contacto con `seguimiento_recupero` **NO está en la cola**, y eso cambió por pedido: el
     automático lo corre la secuencia del CRM, así que no es trabajo de esta pantalla. Antes esta
     aserción exigía lo contrario —que estuviera con `pideManos: false`—.

     Y hay una consecuencia para la identidad del contador que se comprueba más abajo: al no haber
     ninguna fila con `pideManos: false`, sumar la cola entera y sumar solo las que piden manos dan
     el mismo número. O sea que esa mutación dejó de ser detectable ACÁ — la cubre el `92`, con su
     prueba de que el automático no entra y su ícono sigue encendido. */
  assert.ok(
    !m.colas.seguimientos.some((x) => x.fila.id === s.automatico),
    'el contacto con `seguimiento_recupero` volvió a Seguimientos: el automático no se dibuja acá',
  );

  /* Y EL OTRO LADO: el seguimiento MANUAL que sí pide manos.
   *
   * Sin esta fila la identidad de abajo tiene su tercer término en cero, y `pideManos: true` se
   * puede volver `false` en `miDia.ts` sin romper nada —el contador y la suma esperada bajan
   * juntos—. Con la fila, el término vale al menos uno y esa mutación deja el badge por debajo de
   * las tareas que hay: el closer abre la pantalla, ve un seguimiento vencido en la cola, y el
   * contador dice que no le queda nada por hacer.
   *
   * El `caso` se afirma como «uno de los manuales» y no como uno en particular: cuál corresponde en
   * el borde del día es asunto del `92`, que lo prueba con su propio caso. Ese borde ESTABA MAL y se
   * arregló: `vence_el` es un `date`, o sea medianoche, y compararlo contra `now()` daba siempre «ya
   * pasó» — así que `manual_de_hoy` era inalcanzable y la pantalla decía «Vencido» en rojo sobre un
   * seguimiento que tocaba justamente hoy. Ahora se compara el día con el día. */
  const manual = m.colas.seguimientos.find((x) => x.fila.id === s.conTarea);
  assert.ok(manual, 'la tarea sembrada para hoy no puso a su contacto en Seguimientos');
  assert.equal(manual.pideManos, true, 'un seguimiento manual pendiente TIENE que pedir manos');
  assert.match(manual.caso ?? '', /^manual_/, 'una tarea de `negocio.tareas` no es un automático');

  // Y el del Buzón está en el Buzón: es el sumando que hace que el contador no sea cero.
  assert.ok(m.colas.buzon.some((x) => x.fila.id === s.enBuzon), 'el del Buzón no está en el Buzón');

  /* LA IDENTIDAD.
   *
   * El badge dice «N tareas pendientes» y las colas son las tareas. Sumar los automáticos haría
   * que diga «12» cuando nueve las está haciendo un robot: el closer abre la pantalla, ve nueve
   * filas que no requieren nada, y a la tercera vez deja de creerle al contador. Y la Agenda no
   * suma nada: una cita es un evento, no una tarea. */
  assert.equal(
    m.colas.tareasPendientes,
    m.colas.urgentes.length +
      m.colas.buzon.length +
      m.colas.seguimientos.filter((x) => x.pideManos).length,
  );

  /* Y el cockpit recibe EL MISMO número, no uno propio. Es el único endpoint que devuelve los dos,
     justamente para que no puedan discrepar; si el cockpit recalculara, la tarjeta de Inicio y el
     badge de Mi Día dirían dos cosas distintas del mismo día y las dos parecerían bien. */
  assert.equal(m.cockpit.tareasPendientes.valor, m.colas.tareasPendientes);
  // Y viaja como un cero MEDIDO, no como un `null` con motivo: el contador siempre se sabe.
  assert.equal(m.cockpit.tareasPendientes.falta, undefined);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6 · LA LISTA PAGINADA
// ═══════════════════════════════════════════════════════════════════════════════

test('la lista de contactos: responde 200 con su forma, y un `pagina` basura no la rompe', async () => {
  const primera = await contactos();
  assert.equal(primera.pagina, 0);
  assert.equal(primera.hayMas, false);
  assert.ok(hay(primera.filas, s.enBuzon));

  /* `pagina=abc` da `NaN` en `parseInt`, y un `NaN` en el `offset` de PostgreSQL es un error de
     tipo: sin el `|| 0` esto es un 500. Y un 500 acá se ve en la pantalla como «no se pudo cargar»
     para una lista que existe y está bien. */
  const basura = await contactos('?pagina=abc');
  assert.equal(basura.pagina, 0);
  assert.deepEqual(
    basura.filas.map((f) => f.id),
    primera.filas.map((f) => f.id),
  );

  // Una página muy alta trae vacío, y `hayMas` en falso. Vacío NO es un rechazo: `ADR-0305` pide
  // que el frontend pueda distinguir «no hay datos» de «no pude averiguarlo», y para eso el estado
  // tiene que ser 200 con lista vacía y no un 4xx.
  const lejana = await contactos('?pagina=500');
  assert.equal(lejana.pagina, 500);
  assert.deepEqual(lejana.filas, []);
  assert.equal(lejana.hayMas, false);
});

test('DEFECTO DOCUMENTADO: con `pagina` negativa la respuesta dice una página y trae otra', async () => {
  const negativa = await contactos('?pagina=-3');
  const primera = await contactos();

  /* El contenido es el de la página 0 —`filasDeTerritorio` hace `Math.max(0, …)`— pero la
     respuesta ECHA el `-3` que llegó, porque la ruta no clampa lo que devuelve. O sea: el cuerpo
     afirma ser la página -3 y es la 0.
     Hoy no rompe nada porque el frontend manda el número que él mismo lleva. Rompe el día que algo
     confíe en el `pagina` de la respuesta para saber dónde está —un «página siguiente» calculado
     sobre lo que vino— y entonces navega desde un lugar que no es donde estaba.
     Se documenta y se reporta, no se arregla acá. */
  assert.equal(negativa.pagina, -3);
  assert.deepEqual(
    negativa.filas.map((f) => f.id),
    primera.filas.map((f) => f.id),
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7 · EL MISMO DATO EN LAS TRES LISTAS
// ═══════════════════════════════════════════════════════════════════════════════

test('los seis íconos son EL MISMO dato en las tres listas, y no cuentan las canceladas', async () => {
  const [p, m, l] = [await pipeline(), await miDia(), await contactos()];

  const delPipeline = filasDelPipeline(p).find((f) => f.id === s.enBuzon);
  const deMiDia = m.colas.buzon.find((x) => x.fila.id === s.enBuzon)?.fila;
  const deLaLista = l.filas.find((f) => f.id === s.enBuzon);
  assert.ok(delPipeline && deMiDia && deLaLista, 'el contacto no llegó a las tres listas');

  /* Sembradas tres citas: una pasada, una pasada CANCELADA y una futura.
   *
   * `reunionesTenidas` tiene que ser 1 y no 2. El primer barrido real midió que el 39 % de las
   * citas están canceladas (411 de 1052): contarlas hacía que el ícono que el closer mira ANTES de
   * llamar —«¿ya hablé con esta persona?»— dijera que hubo reuniones que nadie tuvo. Y el número
   * se veía plausible, que es por lo que estuvo mal sin que nadie lo notara. */
  assert.equal(delPipeline.iconos.reunionesTenidas, 1);
  assert.equal(delPipeline.iconos.citaFutura, true);
  /* Cero MEDIDO, no nulo: las llamadas se leyeron y no hay ninguna. `null` significaría «no hay de
     dónde medirlo» y el ícono no se dibujaría; son dos hechos distintos. */
  assert.equal(delPipeline.iconos.llamadasContestadas, 0);
  // Y sin monto: hay cita y no hay venta. Un `0` acá afirmaría «no vendiste nada».
  assert.equal(delPipeline.iconos.montoVenta, null);
  /* Los otros dos íconos, en su valor de reserva. Este contacto no tiene ninguna etiqueta de
     agente ni serie de seguimiento, y `sin_agente` es un cero MEDIDO: sus etiquetas se leyeron y
     ninguna es del agente. No es «no sabemos». */
  assert.equal(delPipeline.iconos.estadoAgente, 'sin_agente');
  assert.equal(delPipeline.iconos.seguimientoAbierto, false);

  /* LOS DOS ÍCONOS QUE EL `deepEqual` DE ABAJO NO PUEDE MEDIR.
   *
   * `estadoAgente` y `seguimientoAbierto` salen de las etiquetas y no de una tabla, así que fijarlos
   * en una constante deja las tres listas coincidiendo entre sí y el `deepEqual` verde. Se comprobó
   * mutándolo —`estadoAgente: 'apagado'` y `seguimientoAbierto: true` fijos en `fila.ts`— y las doce
   * pruebas de este archivo pasaban.
   *
   * Los dos deciden si el closer llama o espera: ⏱ encendido significa «hay una serie automática
   * corriendo, no lo toques», y el estado del agente significa «el bot está atendiendo esta
   * conversación ahora mismo». Un valor fijo hace que las dos decisiones se tomen sobre lo mismo
   * para todos los contactos, y la pantalla se ve idéntica a una que funciona. */
  const conAgente = filasDelPipeline(p).find((f) => f.id === s.conAgente);
  assert.ok(conAgente, 'el contacto con `bot_activado_leadflow` no llegó al Pipeline');
  assert.equal(
    conAgente.iconos.estadoAgente,
    'atendiendo_pre_agenda',
    '`bot_activado_leadflow` dice CUÁL agente atiende: colapsarlo en un «atendiendo» genérico le ' +
      'imputa el fallo al agente equivocado',
  );
  const conSerie = filasDelPipeline(p).find((f) => f.id === s.automatico);
  assert.ok(conSerie, 'el contacto con `seguimiento_recupero` no llegó al Pipeline');
  assert.equal(
    conSerie.iconos.seguimientoAbierto,
    true,
    '`seguimiento_recupero` es lo que ENCIENDE el ícono ⏱: apagado, el closer llama encima de una ' +
      'serie automática que está corriendo',
  );
  assert.equal(conSerie.iconos.estadoAgente, 'sin_agente', 'una serie no es un agente puesto');

  /* Y ahora lo que sostiene toda la arquitectura de estos tres endpoints: es el MISMO objeto, no
     tres cálculos que coinciden. Los seis íconos son seis agregados sobre cinco tablas; escritos
     por pantalla, el caso conocido es que uno cuente `count(*)` y otro `count(*) where contestada`
     — y el mismo contacto reporte dos números distintos según dónde se lo mire, los dos plausibles.
     Con un `deepEqual` de los tres, esa divergencia no se puede introducir en silencio. */
  assert.deepEqual(delPipeline.iconos, deMiDia.iconos);
  assert.deepEqual(delPipeline.iconos, deLaLista.iconos);
  // La etapa y las etiquetas crudas también viajan igual: de ellas salen las colas y las columnas,
  // así que si difirieran, dos pantallas clasificarían al mismo contacto distinto.
  assert.deepEqual(
    [delPipeline.etapa, delPipeline.etiquetas],
    [deLaLista.etapa, deLaLista.etiquetas],
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8 · LAS TRES RUTAS PASAN POR EL PORTERO DE VERDAD
// ═══════════════════════════════════════════════════════════════════════════════

test('sin sesión válida las tres listas responden 401 `sin_sesion` y NINGUNA trae datos', async () => {
  /* LA PRUEBA QUE FALTABA, Y ES LA QUE JUSTIFICA EL ARCHIVO ENTERO.
   *
   * Todas las demás pruebas de acá mandan la sesión de la administradora de `alfa`, así que ninguna
   * llega nunca a la rama de RECHAZO del portero. Se comprobó mutándolo —cambiando
   * `rechazo('sin_sesion')` por otro código en `portero.ts`— y las doce pruebas seguían verdes; lo
   * mismo en el `94`, el `95`, el `96` y el `97`. O sea que una ruta que perdiera su línea de
   * `exigir` seguiría pasando todo este archivo: el guardia de arquitectura la ve escrita y estas
   * pruebas nunca la ejercitan, que es exactamente el hueco que el encabezado dice venir a cerrar.
   *
   * Y el CÓDIGO importa tanto como el estado: `hayQueVolverAEntrar()` del cliente HTTP mira el
   * código, no el número. Con cualquier otro, una sesión vencida deja la pantalla como si nada en
   * vez de mandar al login — y el closer ve tres listas vacías donde hay 239 contactos, que es
   * `ADR-0305` con la peor cara posible.
   *
   * El token es sintácticamente plausible y no existe en `identidad.sesiones`: es la forma que tiene
   * una cookie vieja, que es el caso real. */
  const manejadores: [string, (p: Request) => Promise<Response>, string][] = [
    ['el Pipeline', verPipeline, '/api/closer/pipeline'],
    ['Mi Día', verMiDia, '/api/closer/mi-dia'],
    ['la lista de contactos', verContactos, '/api/closer/contactos'],
  ];

  for (const [donde, manejador, camino] of manejadores) {
    const { estado, cuerpo } = await leerRespuesta<Record<string, unknown>>(
      await manejador(pedirComo(camino, 'esta-sesion-no-existe')),
    );
    assert.equal(estado, 401, `${donde} contestó ${estado} sin sesión`);
    assert.equal(cuerpo['codigo'], 'sin_sesion', `${donde}: el código manda al login o no manda`);
    // Y el rechazo NO se disfraza de respuesta vacía: ni `columnas`, ni `colas`, ni `filas`.
    for (const clave of ['columnas', 'colas', 'filas', 'total']) {
      assert.equal(cuerpo[clave], undefined, `${donde} devolvió \`${clave}\` en un rechazo`);
    }
  }
});

test('el contador de la cartera DESGLOSA: activos y fuera de zona', async () => {
  // Los documentos lo piden con esa forma —*«el contador de la base total desglosa: N activos · M
  // congelados»*— y el motivo es aritmético: `total` incluye a los dos y las colas de Mi Día a
  // ninguno de los congelados. Sin el desglose, los números de esta pantalla no cierran con los de
  // ninguna otra y hay que adivinar la diferencia.
  const p = await pipeline();

  assert.ok(p.cartera, 'el Pipeline no devuelve el desglose de la cartera');
  assert.equal(
    p.cartera.activos + p.cartera.congelados,
    p.total,
    `el desglose no suma el total: ${p.cartera.activos} + ${p.cartera.congelados} ≠ ${p.total}. Un ` +
      'total que no cierra con sus partes es peor que no tener partes',
  );
  assert.ok(
    p.cartera.congelados >= 1,
    'el sembrado tiene un congelado y el desglose cuenta cero: la prueba no está midiendo nada',
  );
  // Y el desglose coincide con las filas, no con otra consulta: dos fuentes para el mismo número es
  // exactamente el defecto que este archivo persigue en todas sus aserciones.
  assert.equal(
    p.cartera.congelados,
    filasDelPipeline(p).filter((f) => f.congelado).length,
    'el conteo de congelados no coincide con las filas que vienen marcadas',
  );
});
