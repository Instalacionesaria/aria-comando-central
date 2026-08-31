// El Inicio del Setter: su cockpit y sus DOS comisiones, POR EL MANEJADOR DE RUTA. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA PRUEBA QUE DETECTA UN TABLERO INVENTADO ES UNA SOLA, Y ES LA PRIMERA
//
// **Registrar una venta chica tiene que CAMBIAR el tablero.** Un panel que muestra números
// plausibles y no se mueve cuando ocurre el hecho que dice medir es exactamente el defecto que la
// plataforma anterior tenía: la comisión vivía en el navegador y el tablero mostraba una base fija.
//
// Comprobar la forma de la respuesta no lo atrapa —una constante tiene la misma forma— así que cada
// número de acá se mide dos veces: antes del hecho y después.
//
// ── LOS CUATRO ESTADOS, Y EL QUINTO QUE ES PROPIO DEL DIFERIDO ──────────────
//
// El tramo directo tiene los cuatro estados que `lib/negocio/comision.ts` documenta. El **diferido**
// agrega el problema que ninguna otra comisión de este sistema tiene: **la venta la registró otra
// persona**, así que su testigo de «hubo datos» no puede ser lo que registró quien mira.
//
// Con el testigo equivocado —el del closer— un setter con cuarenta agendas y ningún resultado propio
// leería *«no registraste nada»* cuando la verdad es «tu closer todavía no vendió sobre tus leads», y
// uno que registró un `nurture` leería `$0` como cero medido sin tener un solo lead atribuido. Son
// los dos hechos que este archivo separa.
//
// ── Y `negocio.comisiones` SE BARRE ─────────────────────────────────────────
//
// Es la única tabla de este archivo que `limpiar` no toca: no tiene `contacto_id`, así que su barrido
// por marca no la alcanza. Se borra entera al empezar y al terminar, igual que hace
// `29-comision.test.ts` — y por el mismo motivo: la persona sembrada es la misma en los dos archivos,
// y una fila que sobrevive convierte el estado «nadie cargó el porcentaje» en un número.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { limpiar, montar, pedirComo, unContacto, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { sellarSiEsDelSetter } from '../../lib/negocio/sello.ts';
import {
  TIPO_SETTER_DIFERIDO,
  TIPO_SETTER_DIRECTO,
} from '../../lib/negocio/comisionDelSetter.ts';
import { GET as miDia } from '../../app/api/setter/mi-dia/route.ts';

let esc: Escenario;
before(async () => {
  esc = await montar('SetterInicio');
  await esc.admin.query('delete from negocio.comisiones');
});
after(async () => {
  await esc.admin.query('delete from negocio.comisiones');
  await limpiar(esc);
  await cerrarTodo();
  await cerrarClientes();
});

// ── LA FORMA DE LA RESPUESTA, tal como la escribe la ruta ──────────────────────

interface Indicador {
  valor: number | null;
  falta?: string;
}
interface Tramo {
  porcentaje: number | null;
  meta: number | null;
  valor: number | null;
  falta?: string;
  ventas: number | null;
  base: number | null;
}
interface CuerpoDelSetter {
  cockpit: {
    mes: string;
    vendidoChico: Indicador;
    ventasChicas: Indicador;
    agendas: Indicador;
    agendasDelAgente: Indicador;
    descalificados: Indicador;
    aNurture: Indicador;
    tasaDeAsistencia: Indicador;
    tareasPendientes: Indicador;
  };
  comision: { directo: Tramo; diferido: Tramo; leadsAtribuidos: number };
  colas: { tareasPendientes: number };
  mirandoOtraOrganizacion: boolean;
}

/** El tablero, leído por la ruta de verdad. */
async function tablero(): Promise<CuerpoDelSetter> {
  const r = await miDia(pedirComo('/api/setter/mi-dia', esc.token));
  assert.equal(r.status, 200, await r.clone().text());
  return (await r.clone().json()) as CuerpoDelSetter;
}

/** Un porcentaje configurado para un tramo. `null` = configurado en cero no, en NULO. */
async function porcentaje(tipo: string, valor: number | null): Promise<void> {
  await esc.admin.query(
    `insert into negocio.comisiones (org_id, usuario_id, tipo, porcentaje)
       values ($1, $2, $3, $4)
     on conflict (org_id, usuario_id, tipo) do update set porcentaje = $4`,
    [esc.org, esc.quien, tipo, valor],
  );
}

/**
 * Deja el escenario **en cero**: sin contactos, sin resultados y sin porcentajes.
 *
 * Hace falta porque las bases de este archivo son ACUMULATIVAS —son «todo lo que esta persona
 * registró este mes»— así que una prueba que afirme un valor absoluto lee también lo que dejó la
 * anterior. Las primeras miden diferencias; éstas necesitan el cero.
 *
 * ── Y BORRAR EL CONTACTO ES LA ÚNICA FORMA DE QUITAR UN SELLO ────────────────
 *
 * Un `update contactos set sello_setter_id = null` **no lo borra**: el disparador
 * `proteger_sello_setter()` restituye el original en silencio, y eso incluye volver atrás una
 * limpieza. Está medido acá: la primera versión de la prueba de «sin leads atribuidos» hacía ese
 * `update` y seguía contando uno.
 *
 * Es exactamente lo que el disparador promete —el sello se pone una vez y no se corrige— y conviene
 * que esté escrito en una prueba: es la razón por la que sellar por error no tiene arreglo.
 */
async function desdeCero(): Promise<void> {
  await limpiar(esc);
  await esc.admin.query('delete from negocio.comisiones');
}

/** Un resultado escrito directo, para poder elegir el autor y la fecha. */
async function unResultado(campos: {
  contactoId: string;
  salida: string;
  rol: string;
  monto?: number | null;
  autor?: string | null;
  creadoEl?: Date;
}): Promise<void> {
  await esc.admin.query(
    `insert into negocio.resultados (org_id, contacto_id, salida, rol, monto, registrado_por, creado_el)
       values ($1, $2, $3, $4, $5, $6, coalesce($7, now()))`,
    [
      esc.org,
      campos.contactoId,
      campos.salida,
      campos.rol,
      campos.monto ?? null,
      campos.autor === undefined ? esc.quien : campos.autor,
      campos.creadoEl ?? null,
    ],
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · REGISTRAR UNA VENTA CHICA **CAMBIA** EL TABLERO
// ═══════════════════════════════════════════════════════════════════════════════

test('una venta chica mueve el cockpit Y la base del tramo directo, medido antes y después', async () => {
  const k = await unContacto(esc, { territorio: 'setter', nombre: 'Venta chica' });

  // ── ANTES: nada registrado, así que NO es cero. Es `null` con motivo.
  const antes = await tablero();
  assert.equal(
    antes.cockpit.vendidoChico.valor,
    null,
    'sin ningún resultado, el vendido salió en CERO: eso afirma «no vendiste nada» cuando lo cierto ' +
      'es que nadie registró nada todavía',
  );
  assert.match(antes.cockpit.vendidoChico.falta ?? '', /Avanzar/, 'el motivo no dice dónde se resuelve');
  assert.equal(antes.cockpit.ventasChicas.valor, null);

  await porcentaje(TIPO_SETTER_DIRECTO, 10);
  await unResultado({ contactoId: k.id, salida: 'venta_chica', rol: 'setter', monto: 1500 });

  // ── DESPUÉS: los tres números se movieron, y el de la comisión es el 10 % del otro.
  const despues = await tablero();
  assert.equal(despues.cockpit.vendidoChico.valor, 1500, 'el cockpit no se movió con la venta');
  assert.equal(despues.cockpit.ventasChicas.valor, 1);
  assert.equal(despues.comision.directo.base, 1500, 'la base del tramo directo no se movió');
  assert.equal(despues.comision.directo.valor, 150, 'la comisión no es el 10 % de la base');

  // Y una SEGUNDA venta se suma: un tablero que se mueve una vez y se queda podría ser una constante
  // escrita después del primer hecho.
  await unResultado({ contactoId: k.id, salida: 'venta_chica', rol: 'setter', monto: 500 });
  const otraVez = await tablero();
  assert.equal(otraVez.cockpit.vendidoChico.valor, 2000);
  assert.equal(otraVez.cockpit.ventasChicas.valor, 2);
  assert.equal(otraVez.comision.directo.valor, 200);
});

test('las agendas y los descalificados son otros números, y no se contaminan entre sí', async () => {
  /* Cinco `filterWhere` sobre la misma consulta es donde un `salida` copiado y pegado hace que dos
     indicadores muestren lo mismo. Se registran cantidades DISTINTAS de cada uno a propósito: con
     uno de cada, dos contadores cruzados dan el mismo número y la prueba pasa. */
  const k = await unContacto(esc, { territorio: 'setter', nombre: 'Cinco salidas' });
  const partida = await tablero();

  await unResultado({ contactoId: k.id, salida: 'agendo', rol: 'setter' });
  await unResultado({ contactoId: k.id, salida: 'agendo', rol: 'setter' });
  await unResultado({ contactoId: k.id, salida: 'agendo', rol: 'setter' });
  await unResultado({ contactoId: k.id, salida: 'no_califica', rol: 'setter' });
  await unResultado({ contactoId: k.id, salida: 'no_califica', rol: 'setter' });
  await unResultado({ contactoId: k.id, salida: 'nurture', rol: 'setter' });

  const t = await tablero();
  assert.equal(t.cockpit.agendas.valor, (partida.cockpit.agendas.valor ?? 0) + 3);
  assert.equal(t.cockpit.descalificados.valor, (partida.cockpit.descalificados.valor ?? 0) + 2);
  assert.equal(t.cockpit.aNurture.valor, (partida.cockpit.aNurture.valor ?? 0) + 1);

  /* Y la venta chica no se movió con ninguna de las seis. Es la mitad que falta: un `filterWhere`
     borrado hace que «vendido» cuente TODO, y sin esta línea el número sube y nadie lo nota. */
  assert.equal(
    t.cockpit.vendidoChico.valor,
    partida.cockpit.vendidoChico.valor,
    'seis resultados sin monto movieron el vendido: el filtro por `venta_chica` no está filtrando',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · LA BASE ES DE LA PERSONA, Y DEL MES
// ═══════════════════════════════════════════════════════════════════════════════

test('una venta chica de OTRO autor y una del mes pasado NO entran en la base', async () => {
  /* Las dos mitades del `where`, y las dos fallan igual de callado: la política de RLS aísla por
     ORGANIZACIÓN y no por persona ni por fecha, así que cada `where` que falte devuelve filas de más
     sin un solo error. El síntoma es un número plausible y más alto — el peor que puede tener un
     tablero de sueldos.

     El «otro autor» es el SISTEMA (`registrado_por = null`), y no una segunda persona: la
     organización sembrada tiene una sola, y una fila con autor nulo prueba lo mismo sin dejar un
     usuario de más en la base. */
  const k = await unContacto(esc, { territorio: 'setter', nombre: 'Base ajena' });
  await porcentaje(TIPO_SETTER_DIRECTO, 10);
  await unResultado({ contactoId: k.id, salida: 'venta_chica', rol: 'setter', monto: 100 });
  const inicial = await tablero();
  const partida = inicial.comision.directo.base;
  const partidaCockpit = inicial.cockpit.vendidoChico.valor;

  // De otro autor. Se miran LAS DOS consultas: la de la comisión y la del cockpit tienen cada una su
  // propio `where registrado_por`, y son dos lugares donde falta por separado.
  await unResultado({ contactoId: k.id, salida: 'venta_chica', rol: 'setter', monto: 7000, autor: null });
  const conAjena = await tablero();
  assert.equal(
    conAjena.comision.directo.base,
    partida,
    'una venta chica que registró otro entró en la base de esta persona',
  );
  assert.equal(
    conAjena.cockpit.vendidoChico.valor,
    partidaCockpit,
    'una venta chica que registró otro entró en el COCKPIT de esta persona: es un `where` distinto ' +
      'del de la comisión, y falta por separado',
  );

  // Del mes pasado. Se elige el día 2 para que la resta no caiga en el mes anterior al anterior.
  const mesPasado = new Date();
  mesPasado.setDate(2);
  mesPasado.setMonth(mesPasado.getMonth() - 1);
  await unResultado({
    contactoId: k.id,
    salida: 'venta_chica',
    rol: 'setter',
    monto: 9000,
    creadoEl: mesPasado,
  });
  const conVieja = await tablero();
  assert.equal(
    conVieja.comision.directo.base,
    partida,
    'una venta chica del mes pasado entró en el mes corriente',
  );
  assert.equal(
    conVieja.cockpit.vendidoChico.valor,
    partidaCockpit,
    'una venta chica del mes pasado entró en el cockpit del mes corriente',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · EL TRAMO DIFERIDO: LA VENTA LA REGISTRÓ OTRO
// ═══════════════════════════════════════════════════════════════════════════════

test('el diferido cuenta la venta del CLOSER sobre un contacto sellado, y no la registró el setter', async () => {
  /* ── EL CAMINO REAL, PASO POR PASO ─────────────────────────────────────────
   *
   * 1 · El setter trabaja el lead → se enciende `sello_setter_id`.
   * 2 · El CRM hace el traspaso cuando se crea la cita → el contacto pasa a territorio del closer.
   * 3 · El closer vende → `resultados.salida = 'venta'`, registrado por OTRA persona.
   *
   * El paso 3 se escribe con autor NULO justamente para probar el punto: este tramo **no mira quién
   * registró la venta**. Si mirara `registrado_por` como el tramo directo, la base saldría en cero y
   * el setter no cobraría nunca — que es el defecto que hace que la comisión diferida no exista. */
  await desdeCero();
  const k = await unContacto(esc, { territorio: 'setter', nombre: 'Lead originado' });
  await porcentaje(TIPO_SETTER_DIFERIDO, 5);

  const sellado = await conOrganizacion(esc.org, () => sellarSiEsDelSetter(k.id, esc.quien));
  assert.equal(sellado, true, 'el sello no se puso: sin él este tramo no tiene base');

  // El traspaso, tal como lo hace el CRM: cambia el territorio y el sello queda.
  await esc.admin.query(`update negocio.contactos set territorio = 'closer' where id = $1`, [k.id]);

  const antes = await tablero();
  assert.equal(antes.comision.leadsAtribuidos, 1, 'el lead atribuido no se contó');
  assert.equal(
    antes.comision.diferido.base,
    0,
    'con leads atribuidos y sin ventas, la base es un CERO MEDIDO: `null` diría que no hay nada que ' +
      'medir, y hay — el closer todavía no vendió',
  );
  assert.equal(antes.comision.diferido.valor, 0);

  // La venta del closer, registrada por otro.
  await unResultado({ contactoId: k.id, salida: 'venta', rol: 'closer', monto: 20000, autor: null });

  const despues = await tablero();
  assert.equal(despues.comision.diferido.base, 20000, 'la venta del closer no entró en el diferido');
  assert.equal(despues.comision.diferido.ventas, 1);
  assert.equal(despues.comision.diferido.valor, 1000, 'el diferido no es el 5 % de la venta grande');

  /* ── Y LOS DOS TESTIGOS SON INDEPENDIENTES, QUE ES EL PUNTO ────────────────
   *
   * Acá el setter no registró **nada** este mes —la venta la escribió otro— así que su tramo DIRECTO
   * no está medido: `null` con motivo. Y el DIFERIDO sí lo está, y vale mil.
   *
   * Esa asimetría es exactamente lo que se venía a construir. Con un testigo compartido —el del
   * closer, «¿registró algo esta persona?»— este setter leería *«no registraste nada»* en los dos
   * tramos y **no cobraría la comisión que le corresponde**, con el lead sellado a su nombre y la
   * venta cobrada.
   *
   * Y de paso: la venta grande no se coló en la base de las chicas. Los dos tramos leen la misma
   * tabla con dos salidas distintas, y un `venta`/`venta_chica` cruzado haría que una venta de
   * $20.000 pague el porcentaje de las ventas chicas. */
  assert.equal(
    despues.comision.directo.base,
    null,
    'la venta GRANDE del closer entró en la base de las ventas chicas del setter, o el tramo directo ' +
      'se dio por medido sin que esta persona registre nada',
  );
  assert.ok(despues.comision.directo.falta, 'el tramo directo no dice qué le falta');

  /* ── Y UNA VENTA GRANDE SOBRE UN CONTACTO **SIN SELLO** NO PAGA NADA ───────
   *
   * Es la otra mitad del tramo, y la que decide si la atribución significa algo: sin el
   * `where sello_setter_id`, el diferido pasa a ser un porcentaje sobre TODAS las ventas del closer.
   * Cada setter de la empresa cobraría sobre los leads de los demás, y el número sale más alto — no
   * hay forma de que alguien lo reporte. */
  const ajeno = await unContacto(esc, { territorio: 'closer', nombre: 'Lead de nadie' });
  await unResultado({ contactoId: ajeno.id, salida: 'venta', rol: 'closer', monto: 50000, autor: null });

  const conAjeno = await tablero();
  assert.equal(
    conAjeno.comision.diferido.base,
    20000,
    'una venta del closer sobre un contacto que este setter NO originó entró en su comisión diferida',
  );
  assert.equal(conAjeno.comision.leadsAtribuidos, 1, 'se contó como atribuido un lead sin sello');
});

test('sin leads atribuidos el diferido es NULO, y su motivo NO es el del directo', async () => {
  /* El estado que la revisión adversarial marcó como el más fácil de arruinar: con el testigo del
     closer —«¿registró algo esta persona?»— este tramo diría «no registraste nada» a quien tiene
     doce leads y un closer que no vendió, y diría «$0 medido» a quien no tiene ninguno.

     Se comprueba en una organización cuyo setter no tiene NINGÚN sello. Y se comparan los dos
     textos: si son iguales, uno de los dos manda a la persona a hacer lo que no corresponde. */
  await desdeCero();
  await porcentaje(TIPO_SETTER_DIRECTO, 10);
  await porcentaje(TIPO_SETTER_DIFERIDO, 5);

  const t = await tablero();
  assert.equal(t.comision.leadsAtribuidos, 0, 'quedó algún sello: este caso mide el cero');
  assert.equal(
    t.comision.diferido.valor,
    null,
    'sin ningún lead atribuido el diferido salió en cero: eso afirma que el closer no vendió sobre ' +
      'sus leads, cuando no tiene leads',
  );
  assert.equal(t.comision.diferido.base, null);
  assert.ok(t.comision.diferido.falta);

  /* Y desde cero el directo TAMBIÉN falta, así que se pueden comparar los dos textos. Es la mitad
     que importa: si son iguales, uno de los dos manda a la persona a hacer lo que no corresponde. */
  assert.ok(t.comision.directo.falta, 'desde cero el directo tendría que faltar también');
  assert.notEqual(
    t.comision.directo.falta,
    t.comision.diferido.falta,
    'los dos tramos dicen lo mismo cuando falta la base, y no es lo mismo: uno se resuelve ' +
      'registrando un resultado y el otro no se resuelve trabajando',
  );
  assert.match(
    t.comision.diferido.falta ?? '',
    /sello|atribuid/i,
    'el motivo del diferido no menciona la atribución: sin eso la persona no sabe qué le falta',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · SIN PORCENTAJE NO HAY NÚMERO, Y UN PORCENTAJE EN CERO SÍ ES UN NÚMERO
// ═══════════════════════════════════════════════════════════════════════════════

test('sin porcentaje cargado los dos tramos son NULOS con motivo, nunca $0', async () => {
  await desdeCero();
  const k = await unContacto(esc, { territorio: 'setter', nombre: 'Sin porcentaje' });
  await unResultado({ contactoId: k.id, salida: 'venta_chica', rol: 'setter', monto: 800 });

  const t = await tablero();
  for (const [nombre, tramo] of [
    ['directo', t.comision.directo],
    ['diferido', t.comision.diferido],
  ] as const) {
    assert.equal(
      tramo.porcentaje,
      null,
      `el porcentaje del tramo ${nombre} vino en 0 sin que nadie lo cargue: 0 % afirma que esta ` +
        'persona no cobra comisión, y eso es un hecho distinto de «todavía nadie lo configuró»',
    );
    assert.equal(tramo.valor, null, `el tramo ${nombre} calculó una comisión sin porcentaje`);
    assert.ok(tramo.falta, `el tramo ${nombre} no dice qué falta`);
    assert.match(
      tramo.falta ?? '',
      /administra/i,
      `el motivo del tramo ${nombre} no dice QUIÉN lo carga: mandar a la persona a cargar algo que ` +
        'no puede cargar es peor que no decir nada',
    );
  }

  /* Y la base SÍ está medida: son dos ausencias independientes. Colapsarlas haría que quien no tiene
     porcentaje tampoco vea cuánto vendió. */
  assert.equal(t.comision.directo.base, 800, 'sin porcentaje se borró también la base');
});

test('un porcentaje en CERO da una comisión de cero MEDIDA, con su base', async () => {
  await desdeCero();
  const k = await unContacto(esc, { territorio: 'setter', nombre: 'Cero medido' });
  await unResultado({ contactoId: k.id, salida: 'venta_chica', rol: 'setter', monto: 800 });
  await porcentaje(TIPO_SETTER_DIRECTO, 0);

  const t = await tablero();
  assert.equal(t.comision.directo.porcentaje, 0, 'un 0 % configurado se leyó como «sin configurar»');
  assert.equal(
    t.comision.directo.valor,
    0,
    'con el porcentaje en cero a propósito, la comisión es CERO y no «falta algo»: alguien lo decidió',
  );
  assert.equal(t.comision.directo.falta, undefined, 'un cero decidido vino con un texto de ausencia');
  assert.equal(t.comision.directo.base, 800);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · LO QUE NO SE PUEDE MEDIR, Y LO QUE NO SE MIDE DOS VECES
// ═══════════════════════════════════════════════════════════════════════════════

test('los dos indicadores imposibles viajan NULOS con motivos DISTINTOS', async () => {
  /* Un cero acá diría que el agente no agendó nada y que nadie asistió a ninguna cita. Los dos son
     falsos, y los dos son de los que nadie reporta porque el panel simplemente parece vacío.

     Y los textos tienen que ser distintos: son dos huecos distintos —uno es el registro de citas que
     no guarda el autor, el otro es la asistencia que nadie marca— y un texto único haría que
     resolver uno no explique por qué el otro sigue vacío. */
  const t = await tablero();
  assert.equal(t.cockpit.agendasDelAgente.valor, null, 'las agendas del agente vinieron en cero');
  assert.equal(t.cockpit.tasaDeAsistencia.valor, null, 'la asistencia vino en cero');
  assert.ok(t.cockpit.agendasDelAgente.falta);
  assert.ok(t.cockpit.tasaDeAsistencia.falta);
  assert.notEqual(
    t.cockpit.agendasDelAgente.falta,
    t.cockpit.tasaDeAsistencia.falta,
    'los dos huecos dicen lo mismo, y son dos cosas distintas que se resuelven distinto',
  );
});

test('el contador de tareas del cockpit es EL MISMO que el de las colas, no otro', async () => {
  /* El motivo por el que el cockpit y Mi Día viajan en una sola llamada. Con dos endpoints habría
     dos implementaciones del mismo número, y el `01` es terminante sobre eso. Acá el cockpit RECIBE
     el que Mi Día calculó, así que no puede discrepar — y esta prueba es lo que impide que alguien
     lo recalcule «para no pasarlo». */
  const t = await tablero();
  assert.equal(
    t.cockpit.tareasPendientes.valor,
    t.colas.tareasPendientes,
    'el número de tareas del cockpit y el de las colas no coinciden: son el mismo hecho y hay dos ' +
      'fórmulas',
  );
});

test('el mes del cockpit sale de la zona de la EMPRESA, y viene escrito', async () => {
  // No es decoración: es lo único que le dice a quien mira a qué período pertenecen los números.
  // Un tablero sin mes no se puede desmentir.
  const t = await tablero();
  assert.ok(t.cockpit.mes.length > 0, 'el cockpit no dice de qué mes son los números');
  const esperado = new Intl.DateTimeFormat('es', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date());
  assert.equal(t.cockpit.mes, esperado);
});
