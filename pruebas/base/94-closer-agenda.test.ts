// `GET /api/closer/agenda` — el MANEJADOR, invocado de verdad. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTE ARCHIVO, HABIENDO YA UN `27-agenda.test.ts`
//
// El `27` prueba `agendaDelCloser(` llamándola directo, y eso deja fuera **todo lo que la ruta
// decide por sí sola**: leer `?dias`, acotarlo con el tope, elegir el territorio `closer`, y pasar
// `canceladas` a la capa de negocio. Nada de eso lo ejercita una llamada a la función.
//
// Lo que los guardias de arquitectura sí cubren es que la ruta llame a `exigir` con la capacidad
// correcta. Eso no dice nada de la ventana: un `Math.min` invertido, un `dias` que se lee de otro
// parámetro, o un territorio pasado como `'setter'` pasan los dos guardias sin una queja, y **la
// pantalla resultante sigue dibujándose**: una agenda plausible, con las citas de otro.
//
// ── EL HILO QUE UNE LAS NUEVE PRUEBAS: LA VENTANA TIENE QUE SER DECIBLE ────
//
// La pantalla dibuja un mes y la respuesta cubre quince días. Los otros quince no son «días sin
// citas»: son días que nadie leyó. `hoy` y `hasta` son lo único que permite distinguirlos, así que
// si cualquiera de los dos miente, la pantalla pinta como vacío un día que no se miró — y el `11`
// § 9 regla 1 es exactamente eso: un cero medido y un cero sin medir no son el mismo hecho.
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
  unContacto,
  type Escenario,
} from '../apoyo/closer.ts';
import { GET as verAgenda } from '../../app/api/closer/agenda/route.ts';
import { DIAS_DE_LA_AGENDA } from '../../lib/negocio/agenda.ts';
import { DIAS_ADELANTE } from '../../lib/negocio/citas.ts';

/**
 * La forma de la respuesta **tal como sale por el cable**, que no es la de `Agenda`.
 *
 * Se escribe a mano y no se importa el tipo de `lib/negocio/agenda.ts` a propósito: `inicioEl` es un
 * `Date` en el servidor y una CADENA después de `JSON.stringify`. Importar el tipo dejaría que una
 * comparación contra un `Date` compilara y fallara en ejecución por el motivo equivocado.
 */
interface CitaEnJson {
  id: string;
  contactoId: string;
  nombre: string;
  telefono: string | null;
  inicioEl: string;
  titulo: string | null;
  estado: string | null;
  salaUrl: string | null;
  vencida: boolean;
  cancelada: boolean;
}

interface AgendaEnJson {
  dias: { dia: string; citas: CitaEnJson[] }[];
  hoy: string;
  hasta: string;
  total: number;
  zonaHoraria: string;
  avisoDeZona: string | null;
  frescura: { estado: string; minutos: number | null; aviso: string | null };
  falta: string | null;
}

let esc: Escenario;
/** La zona de la ORGANIZACIÓN, que es la que corta los días. `alfa` la tiene configurada. */
let zona: string;

before(async () => {
  esc = await montar('Agenda');
  const r = await esc.admin.query<{ z: string }>(
    'select zona_horaria as z from identidad.organizaciones where id = $1',
    [esc.org],
  );
  zona = r.rows[0]?.z ?? 'UTC';
});

after(async () => {
  await limpiar(esc);
  await cerrarTodo();
  await cerrarClientes();
});

// ── HERRAMIENTAS ───────────────────────────────────────────────────────────

/** El manejador, invocado. Devuelve el cuerpo ya tipado como lo que viaja por el cable. */
async function pedirAgenda(consulta = ''): Promise<{ estado: number; cuerpo: AgendaEnJson }> {
  return leerRespuesta<AgendaEnJson>(await verAgenda(pedirComo(`/api/closer/agenda${consulta}`, esc.token)));
}

/**
 * Aritmética de días de CALENDARIO sobre `YYYY-MM-DD`, sin zonas.
 *
 * `hoy` y `hasta` son dos fechas de la misma zona, así que la distancia entre ellas es un número
 * entero de días y se puede comprobar sin volver a elegir una zona. Hacerlo con `Date` y horas
 * locales sería reintroducir el segundo reloj que `agenda.ts` acaba de sacar.
 */
function masDias(dia: string, n: number): string {
  const [a, m, d] = dia.split('-').map(Number);
  assert.ok(a !== undefined && m !== undefined && d !== undefined, `día ilegible: ${dia}`);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * Un instante concreto, calculado por la BASE en la zona de la empresa.
 *
 * No se arma con `new Date()` en el proceso de la prueba: la ventana de la ruta se calcula con
 * `now()` de la base, y sembrar con el reloj de acá haría que la prueba fallara sola alrededor de la
 * medianoche de Lima — que es el peor tipo de prueba, porque el defecto que reporta no existe.
 *
 * @param offsetDias 0 = hoy, -1 = ayer, 5 = dentro de cinco días.
 * @param horas Hora local dentro de ese día. 12 para quedar lejos de los dos bordes.
 */
async function instante(offsetDias: number, horas = 12): Promise<Date> {
  const r = await esc.admin.query<{ i: Date }>(
    `select (date_trunc('day', timezone($1, now()))
              + ($2 || ' days')::interval
              + ($3 || ' hours')::interval) at time zone $1 as i`,
    [zona, String(offsetDias), String(horas)],
  );
  const i = r.rows[0]?.i;
  assert.ok(i instanceof Date, 'la base no devolvió un instante');
  return i;
}

/** Todas las citas de la respuesta, en una sola lista. */
function todas(a: AgendaEnJson): CitaEnJson[] {
  return a.dias.flatMap((d) => d.citas);
}

/** `true` si esa cita vino en la respuesta. Se busca POR ID y nunca por posición o por conteo. */
function trae(a: AgendaEnJson, citaId: string): boolean {
  return todas(a).some((c) => c.id === citaId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · EL VACÍO CON MOTIVO — va PRIMERO, y el orden importa
// ═══════════════════════════════════════════════════════════════════════════════

test('la agenda vacía trae `falta` con un motivo, y no un nulo', async () => {
  // Un cero sin motivo afirma «no tenés citas». Si esa afirmación es falsa —el barrido nunca corrió,
  // o quedó a medias— alguien no se prepara para una llamada que sí existe, y **no hay ningún otro
  // canal donde eso se note**: la respuesta es un 200 con una lista vacía, sin error en ningún
  // registro. Por eso el motivo es parte del contrato y no un adorno de la interfaz.
  //
  // Va primero en el archivo porque es la única prueba que mira el TOTAL de la organización en vez
  // de sus propias citas por id: cualquier cosa que este mismo archivo siembre después la rompería.
  await limpiar(esc);

  const { estado, cuerpo } = await pedirAgenda();
  assert.equal(estado, 200);
  assert.deepEqual(cuerpo.dias, [], 'sin citas sembradas la ventana tiene que venir vacía');
  assert.equal(
    cuerpo.total,
    0,
    'la ventana de `alfa` no está vacía: si otra prueba está sembrando citas de closer en la misma' +
      ' base al mismo tiempo, esta aserción no puede medir lo que quiere medir',
  );

  assert.notEqual(cuerpo.falta, null, 'un cero sin motivo afirma «no tenés citas»');
  assert.equal(typeof cuerpo.falta, 'string');
  assert.ok((cuerpo.falta ?? '').length > 20, '`falta` tiene que ser una frase, no una etiqueta');
  /* Los tres estados del vacío que `agenda.ts` distingue —nunca se barrió, se barrió a medias, se
     barrió completo— dicen los tres qué pasó con el CALENDARIO. Se comprueba eso y no el texto de
     uno de ellos porque cuál toca depende de `ingesta_pulso`, que es estado compartido de la base:
     fijar un texto acá haría fallar la prueba según qué corrió antes, sin que nada esté roto. */
  assert.match(cuerpo.falta ?? '', /calendario/i, '`falta` tiene que decir qué pasó con la lectura');

  // Y la ventana se sigue nombrando aunque esté vacía: sin `hoy` y `hasta`, un mes dibujado sobre
  // una respuesta vacía no tiene forma de separar «no hay citas» de «no se miró».
  assert.match(cuerpo.hoy, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(cuerpo.hasta, /^\d{4}-\d{2}-\d{2}$/);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · `hasta`: EL ÚLTIMO DÍA QUE LA RESPUESTA CUBRE
// ═══════════════════════════════════════════════════════════════════════════════

test('`hasta` es el último día CUBIERTO, y `?dias=N` lo corre', async () => {
  /* La aritmética exacta es lo que se prueba: `hasta = hoy + (dias - 1)`, porque la ventana INCLUYE
   * hoy. El error de un día es el que no se ve mirando la pantalla —quince casillas dibujadas, la
   * última con o sin citas, y nadie las cuenta— y su consecuencia es de las dos peores:
   *
   *   · `hoy + dias` promete un día que la consulta NO miró, y ese día se pinta como vacío.
   *   · `hoy + dias - 2` esconde un día que sí se miró, y ahí se pierde una cita real.
   *
   * `dias=1` es el caso del widget de Mi Día, y es el que hace de esto una aserción y no una
   * fórmula: con una ventana de un solo día, `hasta` TIENE que ser `hoy`. */
  await limpiar(esc);

  const porOmision = await pedirAgenda();
  assert.equal(porOmision.estado, 200);
  assert.equal(
    porOmision.cuerpo.hasta,
    masDias(porOmision.cuerpo.hoy, DIAS_DE_LA_AGENDA - 1),
    'sin `?dias` la ventana son los quince días que pide el documento, hoy incluido',
  );

  for (const dias of [1, 3, 15, 30]) {
    const r = await pedirAgenda(`?dias=${dias}`);
    assert.equal(r.estado, 200);
    assert.equal(
      r.cuerpo.hasta,
      masDias(r.cuerpo.hoy, dias - 1),
      `con ?dias=${dias}, \`hasta\` tiene que ser el día ${dias} de la ventana contando hoy`,
    );
  }

  const unSoloDia = await pedirAgenda('?dias=1');
  assert.equal(
    unSoloDia.cuerpo.hasta,
    unSoloDia.cuerpo.hoy,
    'una ventana de un día empieza y termina hoy; si `hasta` se adelanta, el widget de Mi Día ' +
      'promete un mañana que no leyó',
  );

  /* Un `?dias` ILEGIBLE vuelve al valor por omisión: `Number('abc')` no es finito y la rama existe
     para eso. Es lo correcto — una ventana de quince días es mejor respuesta a un parámetro roto que
     un 400 que deja la pantalla sin agenda. */
  const ilegible = await pedirAgenda('?dias=abc');
  assert.equal(
    ilegible.cuerpo.hasta,
    masDias(ilegible.cuerpo.hoy, DIAS_DE_LA_AGENDA - 1),
    'un `?dias` ilegible tiene que caer en los quince días por omisión',
  );

  /* Y `?dias=` VACÍO **no** cae en el valor por omisión, y esto documenta el comportamiento REAL, no
     el deseable: `get('dias')` devuelve `''`, el `??` no lo reemplaza porque no es nulo, `Number('')`
     es 0, el 0 es finito, y `Math.max(1, 0)` lo deja en UNO. O sea que un frontend que arme la URL
     con un estado sin inicializar recibe la agenda de un solo día en vez de la de quince, sin
     ningún aviso.
     Lo que impide que eso se vuelva un cero sin medir es justamente `hasta`: dice honestamente que
     la respuesta cubre un día, así que el resto del mes no se puede pintar como vacío. Por eso queda
     como aserción y no como reporte: si mañana se decide que `?dias=` valga lo mismo que su
     ausencia, ésta es la línea que hay que cambiar a mano, y el cambio queda dicho. */
  const vacio = await pedirAgenda('?dias=');
  assert.equal(
    vacio.cuerpo.hasta,
    vacio.cuerpo.hoy,
    '`?dias=` vacío da hoy una ventana de un solo día; si esto falla, alguien cambió esa regla',
  );
});

test('el TOPE acota la ventana: `?dias=100000` no abre una consulta sin fin', async () => {
  /* Dos cosas a la vez, y las dos importan:
   *
   *   1. Sin tope, `dias=100000` es una consulta sin acotar sobre `citas` — y el parámetro viene de
   *      la URL, así que basta escribirla a mano.
   *   2. El tope es `DIAS_ADELANTE`, **el mismo número que el barrido le pide al CRM**. Estuvo en 90
   *      mientras el barrido traía 45: los días 46 a 90 volvían vacíos porque nunca se le
   *      preguntaron a nadie, y `falta` no se encendía porque sólo corre si la ventana ENTERA está
   *      vacía. O sea la ruta prometía cubrir hasta el día 90 y devolvía ceros sin medir para la
   *      mitad de ellos, que es la regla 1 del `11` § 9 rota por la propia constante que la acota.
   *
   * Se importa `DIAS_ADELANTE` en vez de escribir 45: con el número a mano, el día que el barrido
   * mire más lejos esta prueba fallaría sobre código correcto, y con la constante lo sigue solo.
   * Lo que se afirma es la RELACIÓN, no el valor. */
  await limpiar(esc);

  const r = await pedirAgenda('?dias=100000');
  assert.equal(r.estado, 200);
  assert.equal(
    r.cuerpo.hasta,
    masDias(r.cuerpo.hoy, DIAS_ADELANTE - 1),
    'el tope tiene que ser el horizonte del barrido: más allá, la respuesta prometería días que ' +
      'nadie le preguntó al CRM',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · `hoy` SIEMPRE ESTÁ EN LA VENTANA
// ═══════════════════════════════════════════════════════════════════════════════

test('`hoy` cae dentro de la ventana, y la cita del mediodía de hoy aparece en ese día', async () => {
  /* El defecto es de medianoche. `hoy` se calculaba con `new Date()` —el reloj de la aplicación— y
   * la ventana con `now()` —el de la base—: dos relojes que parecen el mismo instante. Basta un
   * desfase de segundos, o que la petición cruce la medianoche local, para que `hoy` nombre un día
   * que no está en `dias[]`.
   *
   * El síntoma es una pantalla que se contradice sola: ninguna cabecera dice «HOY», o lo dice sobre
   * un día vacío mientras las citas de hoy están más abajo. Y no se reproduce en horario de oficina,
   * así que un reporte de esto no se puede seguir.
   *
   * Se prueban las dos mitades: que la cita de hoy caiga en el día que `hoy` NOMBRA, y que ningún
   * día de la respuesta se salga de `[hoy, hasta]`. La segunda es la que atrapa el caso simétrico
   * —una ventana que arranca antes de `hoy`— donde la primera pasaría igual. */
  await limpiar(esc);
  const k = await unContacto(esc);
  const cita = await unaCita(esc, k.id, { inicioEl: await instante(0) });

  const { estado, cuerpo } = await pedirAgenda();
  assert.equal(estado, 200);
  assert.ok(trae(cuerpo, cita), 'una cita del mediodía de hoy tiene que venir en la agenda');

  const diaDeLaCita = cuerpo.dias.find((d) => d.citas.some((c) => c.id === cita));
  assert.ok(diaDeLaCita);
  assert.equal(
    diaDeLaCita.dia,
    cuerpo.hoy,
    '`hoy` nombra un día distinto del que agrupa la cita de hoy: son dos relojes otra vez',
  );

  for (const d of cuerpo.dias) {
    assert.ok(
      d.dia >= cuerpo.hoy && d.dia <= cuerpo.hasta,
      `el día ${d.dia} está fuera de [${cuerpo.hoy}, ${cuerpo.hasta}]: la respuesta trae citas de ` +
        'días que ella misma dice no cubrir',
    );
  }

  // Y la zona con la que se calculó todo viaja, para que la pantalla no elija otra: sin este dato,
  // el navegador reagrupa por SU zona y una cita de las 22:00 en Lima se dibuja mañana.
  assert.equal(cuerpo.zonaHoraria, zona);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · LOS DOS BORDES DE LA VENTANA
// ═══════════════════════════════════════════════════════════════════════════════

test('la cita de AYER no viene, la de dentro de N días sí, y la del día N+1 tampoco', async () => {
  /* Los dos bordes en una sola prueba porque un solo borde no distingue nada: una consulta que
   * devuelve TODO pasa la mitad de «la de adelante viene», y una que devuelve NADA pasa la mitad de
   * «la de ayer no viene». Juntas, sólo pasa la ventana correcta.
   *
   * Y el borde de arriba es el que decide si `hasta` dice la verdad: con `?dias=10`, la cita del día
   * 9 tiene que estar y la del día 10 —que es `hasta + 1`— no. Si esa última apareciera, `hasta`
   * estaría nombrando un día menos de lo que la respuesta realmente cubre, y la pantalla escondería
   * una cita real detrás de un límite inventado. */
  await limpiar(esc);
  const k = await unContacto(esc);
  const ayer = await unaCita(esc, k.id, { inicioEl: await instante(-1) });
  const dentro = await unaCita(esc, k.id, { inicioEl: await instante(9) });
  const fuera = await unaCita(esc, k.id, { inicioEl: await instante(10) });

  const { estado, cuerpo } = await pedirAgenda('?dias=10');
  assert.equal(estado, 200);

  assert.equal(
    trae(cuerpo, ayer),
    false,
    'vino una cita de ayer: la ventana de la Agenda arranca hoy, y una llamada que ya pasó ocupa ' +
      'el lugar de una que hay que atender',
  );
  assert.equal(trae(cuerpo, dentro), true, 'la cita del día 9 de una ventana de 10 tiene que venir');
  assert.equal(
    trae(cuerpo, fuera),
    false,
    `vino una cita del día 10, y \`hasta\` dice ${cuerpo.hasta}: la respuesta cubre más de lo que dice`,
  );

  // El último día de la respuesta no puede pasarse de `hasta`, que es la misma afirmación mirada
  // desde el dato que la pantalla usa para pintar el resto del mes.
  const ultimo = cuerpo.dias.at(-1);
  assert.ok(ultimo);
  assert.ok(ultimo.dia <= cuerpo.hasta);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · EL TERRITORIO, QUE ES LO QUE FALTABA
// ═══════════════════════════════════════════════════════════════════════════════

test('el territorio FILTRA: las citas del setter y de los congelados no entran', async () => {
  /* Esta consulta no filtraba por territorio: devolvía las citas de CUALQUIER contacto de la
   * empresa, con su nombre, su teléfono y su identificador. Y ninguna de las dos barreras del
   * proyecto lo detiene — `closer.ver` habilita la PANTALLA, y el aislamiento por fila no aplica
   * porque son contactos de la MISMA organización.
   *
   * El territorio nulo va en la misma prueba y no aparte: es el caso de los contactos congelados,
   * que no aparecen en ninguna pantalla, y un filtro escrito como `!= 'setter'` lo dejaría pasar
   * mientras pasa la mitad de arriba. Con los dos, sólo pasa `= 'closer'`.
   *
   * Y va sembrada una cita de closer al lado, porque sin ella una consulta que devuelve vacío por
   * cualquier motivo pasaría esta prueba entera sin haber filtrado nada. */
  await limpiar(esc);
  const delCloser = await unContacto(esc);
  const delSetter = await unContacto(esc, { territorio: 'setter' });
  const congelado = await unContacto(esc, { territorio: null });

  const mia = await unaCita(esc, delCloser.id, { inicioEl: await instante(0) });
  const ajena = await unaCita(esc, delSetter.id, { inicioEl: await instante(0) });
  const invisible = await unaCita(esc, congelado.id, { inicioEl: await instante(0) });

  const { cuerpo } = await pedirAgenda();
  assert.equal(trae(cuerpo, mia), true, 'la cita del closer tiene que venir: si no, esto no mide nada');
  assert.equal(trae(cuerpo, ajena), false, 'la Agenda del closer trajo una cita del SETTER');
  assert.equal(
    trae(cuerpo, invisible),
    false,
    'trajo la cita de un contacto congelado: no aparece en ninguna pantalla y acá sí',
  );
});

test('una cita de OTRA organización no existe para esta agenda', async () => {
  // El aislamiento por fila, comprobado por el camino real y no por inspección. El modo de falla es
  // silencioso y grave a la vez: la agenda se dibuja completa, con el nombre y el teléfono de un
  // contacto de otra empresa, y nada en la respuesta dice que eso pasó.
  await limpiar(esc);
  const ajeno = await unContacto(esc, { org: esc.otraOrg });
  const suya = await unaCita(esc, ajeno.id, { org: esc.otraOrg, inicioEl: await instante(0) });

  /* Antes de afirmar que NO viene, se comprueba que EXISTE. Sin esto la prueba pasaría igual con un
     sembrado que falló en silencio —un territorio nulo, una organización mal pasada— y sería una de
     esas aserciones que no miden nada: «no apareció» es cierto también cuando nunca hubo fila. */
  const enBeta = await esc.admin.query<{ org: string; territorio: string | null }>(
    `select c.org_id as org, k.territorio
       from negocio.citas c join negocio.contactos k on k.id = c.contacto_id and k.org_id = c.org_id
      where c.id = $1`,
    [suya],
  );
  assert.equal(enBeta.rows.length, 1, 'el sembrado de la otra organización no dejó fila');
  assert.equal(enBeta.rows[0]?.org, esc.otraOrg);
  assert.equal(enBeta.rows[0]?.territorio, 'closer', 'tiene que ser del MISMO territorio: si no, la' +
    ' que la esconde podría ser la cláusula de territorio y no el aislamiento');

  const { cuerpo } = await pedirAgenda();
  assert.equal(trae(cuerpo, suya), false, 'se filtró una cita de otra organización');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6 · LAS CANCELADAS
// ═══════════════════════════════════════════════════════════════════════════════

test('las canceladas se OCULTAN por omisión, y `?canceladas=si` las trae marcadas', async () => {
  /* Medido contra la cuenta real: el 39 % de las citas que devuelve el CRM están canceladas. Sin
   * este filtro, cuatro de cada diez filas de la agenda son llamadas que no van a ocurrir, y la
   * pantalla que las muestra es indistinguible de una agenda llena.
   *
   * Las dos mitades tienen que estar. Con sólo la primera, una consulta que perdiera esa fila por
   * cualquier motivo —un `join` mal escrito, un estado que no se guardó— pasaría la prueba, y el
   * filtro quedaría sin comprobar. La segunda mitad es la que demuestra que la fila EXISTE y que lo
   * que la esconde es la decisión de esconderla.
   *
   * Y `Cancelled` con mayúscula a propósito: los valores son del proveedor y `noCancelada()` compara
   * en minúsculas. Un filtro sensible a la caja dejaría pasar exactamente los estados que el CRM
   * manda con otra grafía, que es el caso que no se ve probando con `cancelled` a secas. */
  await limpiar(esc);
  const k = await unContacto(esc);
  const viva = await unaCita(esc, k.id, { inicioEl: await instante(0) });
  const muerta = await unaCita(esc, k.id, { inicioEl: await instante(0, 13), estado: 'Cancelled' });

  const porOmision = await pedirAgenda();
  assert.equal(trae(porOmision.cuerpo, viva), true, 'la cita en pie tiene que venir');
  assert.equal(
    trae(porOmision.cuerpo, muerta),
    false,
    'una cita cancelada vino sin pedirla: son el 39 % de lo que el CRM devuelve',
  );

  const conCanceladas = await pedirAgenda('?canceladas=si');
  assert.equal(
    trae(conCanceladas.cuerpo, muerta),
    true,
    '`?canceladas=si` no la trajo: se ocultan, no se borran — la fila está en la tabla',
  );
  const traida = todas(conCanceladas.cuerpo).find((c) => c.id === muerta);
  assert.ok(traida);
  assert.equal(
    traida.cancelada,
    true,
    'vino sin marcar: una cancelada mezclada sin distintivo entre las vivas es peor que esconderla',
  );
  // Y la que está en pie NO se marca, o el distintivo no distingue nada.
  const enPie = todas(conCanceladas.cuerpo).find((c) => c.id === viva);
  assert.ok(enPie);
  assert.equal(enPie.cancelada, false);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7 · EL TOTAL Y LA LISTA SALEN DEL MISMO DATO
// ═══════════════════════════════════════════════════════════════════════════════

test('`total` es la suma de las citas de todos los días, y las canceladas no lo inflan', async () => {
  /* «Próximos días» muestra cuántas citas tiene cada día, y ese número no se consulta aparte. El
   * defecto que eso cierra está medido: cuando eran dos fuentes distintas, hubo un caso en que la
   * tarjeta anunciaba SEIS llamadas que no existían — el conteo venía de un lado y la lista del
   * otro, y quien la miró se preparó para un día que no tenía.
   *
   * La igualdad se afirma sobre la respuesta entera y no sobre las tres citas sembradas: el total
   * cuenta todo el territorio de la organización, así que un número fijo acá dependería de lo que
   * otra prueba esté sembrando en la misma base. La suma, en cambio, es una propiedad interna de la
   * respuesta y se sostiene sola.
   *
   * La cancelada está sembrada porque es el modo de falla concreto: un `total` que saliera de un
   * `count` sin el filtro de canceladas anunciaría llamadas que no van a ocurrir, y con el 39 %
   * medido eso no es un caso raro. */
  await limpiar(esc);
  const k = await unContacto(esc);
  await unaCita(esc, k.id, { inicioEl: await instante(0, 9) });
  await unaCita(esc, k.id, { inicioEl: await instante(0, 16) });
  await unaCita(esc, k.id, { inicioEl: await instante(2, 11) });
  await unaCita(esc, k.id, { inicioEl: await instante(1, 11), estado: 'cancelled' });

  const { cuerpo } = await pedirAgenda();
  const sumadas = cuerpo.dias.reduce((n, d) => n + d.citas.length, 0);
  assert.equal(
    cuerpo.total,
    sumadas,
    `\`total\` dice ${cuerpo.total} y los días suman ${sumadas}: el número y la lista que lo ` +
      'justifica salieron de dos fuentes distintas',
  );

  /* Y las MÍAS, contadas aparte por `contactoId`. Es lo que hace que la igualdad de arriba sea sobre
     algo: con la respuesta vacía, `0 === 0` pasaría igual. Se filtra por contacto y no se compara
     contra `cuerpo.total` porque el total es de todo el territorio de la empresa, y atarlo a un
     número fijo haría que esta prueba dependiera de lo que otro archivo esté sembrando. */
  const mios = cuerpo.dias
    .map((d) => ({ dia: d.dia, citas: d.citas.filter((c) => c.contactoId === k.id) }))
    .filter((d) => d.citas.length > 0);
  assert.equal(
    mios.reduce((n, d) => n + d.citas.length, 0),
    3,
    'sembré tres citas en pie y una cancelada: si vienen cuatro, el filtro de canceladas no corrió',
  );
  assert.equal(mios.length, 2, 'dos citas del mismo día tienen que agruparse en UN día, no en dos');
  const hoyMio = mios[0];
  assert.ok(hoyMio);
  assert.equal(hoyMio.dia, cuerpo.hoy, 'las dos primeras las sembré hoy');
  assert.equal(hoyMio.citas.length, 2, 'las dos de hoy van juntas');
  // Ordenadas por hora dentro del día: una agenda desordenada se lee como si la próxima llamada
  // fuera otra.
  assert.ok(
    (hoyMio.citas[0]?.inicioEl ?? '') < (hoyMio.citas[1]?.inicioEl ?? ''),
    'las citas de un día tienen que venir de la más temprana a la más tarde',
  );

  // Con citas presentes, `falta` calla: es sólo para el vacío, y un motivo al lado de tres citas
  // diría que faltan datos cuando están.
  assert.equal(cuerpo.falta, null, '`falta` habló con la agenda llena');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8 · LA RUTA PASA POR EL PORTERO DE VERDAD
// ═══════════════════════════════════════════════════════════════════════════════

test('sin sesión válida la agenda responde 401 `sin_sesion` y no trae ni la ventana', async () => {
  /* Las ocho pruebas de arriba mandan la sesión de la administradora de `alfa`, así que ninguna llega
   * a la rama de RECHAZO del portero. Se comprobó mutándolo —cambiando el código de `sin_sesion` en
   * `portero.ts`— y las nueve seguían verdes: una ruta que perdiera su `exigir` pasaría este archivo
   * entero, y el guardia de arquitectura sólo puede ver la línea escrita, no ejecutarla.
   *
   * Y acá el rechazo no puede traer `hoy` ni `hasta`: son los dos datos con los que la pantalla
   * decide qué días pinta como vacíos. Un 401 que igual los devolviera dejaría a un mes entero
   * dibujado como «ningún día tiene citas» sobre una respuesta que nadie autorizó. */
  const { estado, cuerpo } = await leerRespuesta<AgendaEnJson & { codigo?: string }>(
    await verAgenda(pedirComo('/api/closer/agenda', 'esta-sesion-no-existe')),
  );
  assert.equal(estado, 401, `la agenda contestó ${estado} sin sesión`);
  assert.equal(cuerpo.codigo, 'sin_sesion', 'el código es lo que manda al login, no el número');
  assert.equal(cuerpo.dias, undefined, 'el rechazo trae la lista de días: `ADR-0305`');
  assert.equal(cuerpo.hoy, undefined, 'el rechazo nombra una ventana que nadie autorizó a leer');
  assert.equal(cuerpo.hasta, undefined);
});
