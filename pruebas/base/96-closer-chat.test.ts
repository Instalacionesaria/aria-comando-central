// El chat de la ficha, invocando los DOS manejadores de verdad. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTE ARCHIVO, Y POR QUÉ NO ALCANZABAN LOS GUARDIAS
//
// `GET` y `POST /api/contactos/[id]/mensajes` estaban cubiertos únicamente por los guardias de
// arquitectura, que **leen el archivo** y no lo ejecutan. Un `exigir` con la capacidad correcta y una
// consulta que devuelve la organización equivocada pasan los dos guardias sin una queja: el guardia
// ve el `exigir(['contactos.ver'])` y el `conOrganizacion(`, y con eso se declara satisfecho.
//
// Lo que se ejecuta acá es el contrato entero de la pantalla, y cada pieza tiene su modo de fallar
// silencioso:
//
//   1 · **Los mensajes y la ventana viajan JUNTOS.** Separados pueden contradecirse: llega una
//       respuesta del contacto, el chat la dibuja, y el compositor sigue deshabilitado hasta el
//       pedido siguiente. Las dos respuestas serían correctas por separado y la pantalla estaría mal.
//   2 · **Los DOS motivos de ventana cerrada son dos.** «Nunca escribió» manda a mandar una
//       plantilla; «pasó el plazo» manda a esperar. Colapsarlos deja al closer sin saber qué hacer, y
//       ninguna prueba de «abierta/cerrada» lo nota.
//   3 · **Un rechazo que igual escribe es el peor resultado posible.** Un `409` con la fila guardada
//       deja un mensaje en el chat que nadie recibió — el defecto original de la Etapa 13, otra vez y
//       al revés. Por eso cada rechazo se comprueba DOS veces: el estado, y que la tabla no creció.
//   4 · **`ADR-0501`**: un contacto de otra empresa **no existe**. Un 403 confirma el identificador.
//   5 · **La frescura.** El modo de fallar de un cron es el silencio, y un chat con lo de anteayer se
//       ve completo.
//   6 · **Un mensaje sin cuerpo no se descarta.** Un audio o una imagen llegan con `cuerpo` nulo, y
//       descartarlos hacía que para un auditor ese turno no hubiera ocurrido.
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
  unContacto,
  unMensaje,
  type Escenario,
} from '../apoyo/closer.ts';
import { GET as verChat, POST as mandarMensaje } from '../../app/api/contactos/[id]/mensajes/route.ts';
import { VENTANA_MS } from '../../lib/negocio/ventana.ts';

const HORA = 3_600_000;

/** Lo que el `GET` promete. Se escribe acá a mano: es el contrato que la pantalla consume. */
interface CuerpoDelChat {
  mensajes: Array<{
    id: string;
    direccion: 'entrante' | 'saliente';
    cuerpo: string | null;
    enviadoEl: string;
    entrega: string;
  }>;
  falta: string | null;
  frescura: { estado: string; minutos: number | null; umbralMinutos: number; aviso: string | null };
  ventana: { abierta: boolean; venceEl: string | null; restanteMs: number | null; motivo: string | null };
}

interface CuerpoDeRechazo {
  codigo: string;
  detalle?: string;
}

let esc: Escenario;

/**
 * El sello del barrido de mensajes de esta empresa **como estaba antes de que este archivo lo toque**.
 *
 * Es el único dato compartido que estas pruebas necesitan mover: la frescura se mide sobre
 * `negocio.tareas_programadas`, que es por empresa y no por contacto, así que no se puede marcar. Se
 * guarda y se restituye para que un archivo que corra cerca no encuentre un sello que este archivo
 * inventó — el síntoma de eso es una prueba de frescura ajena que falla sola y pasa aislada.
 */
let selloOriginal: { corridaEl: Date; estado: string } | null = null;

before(async () => {
  esc = await montar('Chat');
  const previo = await esc.admin.query<{ ultima_corrida_el: Date; ultimo_estado: string }>(
    `select ultima_corrida_el, ultimo_estado from negocio.tareas_programadas
      where org_id = $1 and tarea = 'mensajes'`,
    [esc.org],
  );
  const fila = previo.rows[0];
  selloOriginal = fila ? { corridaEl: fila.ultima_corrida_el, estado: fila.ultimo_estado } : null;
});

after(async () => {
  await sinSello();
  if (selloOriginal) {
    await esc.admin.query(
      `insert into negocio.tareas_programadas (org_id, tarea, ultima_corrida_el, ultimo_estado)
         values ($1, 'mensajes', $2, $3)`,
      [esc.org, selloOriginal.corridaEl, selloOriginal.estado],
    );
  }
  await limpiar(esc);
  await cerrarTodo();
  await cerrarClientes();
});

// ── Los atajos de este archivo ─────────────────────────────────────────────

/** El `GET` del chat de un contacto, con el contexto de camino que Next le pasa. */
function leerChat(id: string): Promise<Response> {
  return verChat(pedirComo(`/api/contactos/${id}/mensajes`, esc.token), {
    params: Promise.resolve({ id }),
  });
}

/** El `POST` del chat. `texto` viaja como lo manda el compositor. */
function escribirChat(id: string, texto: unknown): Promise<Response> {
  return mandarMensaje(
    pedirComo(`/api/contactos/${id}/mensajes`, esc.token, { metodo: 'POST', cuerpo: { texto } }),
    { params: Promise.resolve({ id }) },
  );
}

/** Cuántas filas hay en `mensajes` para ese contacto. Se cuenta con el cliente administrador para
 *  que el conteo no dependa de la política de aislamiento que la ruta usa. */
async function cuantosMensajes(contactoId: string): Promise<number> {
  const r = await esc.admin.query<{ n: string }>(
    'select count(*)::text as n from negocio.mensajes where contacto_id = $1',
    [contactoId],
  );
  return Number(r.rows[0]?.n ?? '-1');
}

/** Deja a esta empresa SIN sello de barrido de mensajes: el estado `nunca`. */
async function sinSello(): Promise<void> {
  await esc.admin.query(
    `delete from negocio.tareas_programadas where org_id = $1 and tarea = 'mensajes'`,
    [esc.org],
  );
}

/** Un sello recién puesto: el estado `al_dia`, el que NO tiene que avisar nada. */
async function selloReciente(): Promise<void> {
  await esc.admin.query(
    `insert into negocio.tareas_programadas (org_id, tarea, ultima_corrida_el, ultimo_estado)
       values ($1, 'mensajes', now(), 'corrio')
     on conflict (org_id, tarea) do update
        set ultima_corrida_el = excluded.ultima_corrida_el, ultimo_estado = excluded.ultimo_estado`,
    [esc.org],
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · LOS MENSAJES Y LA VENTANA, EN LA MISMA RESPUESTA Y COHERENTES
// ═══════════════════════════════════════════════════════════════════════════════

test('el GET trae los mensajes EN ORDEN y la VENTANA en la misma respuesta, calculada sobre ellos', async () => {
  // Que vengan juntos es la propiedad, y la coherencia es lo que la hace valer: acá no se comprueba
  // sólo que la clave `ventana` exista, se comprueba que **venza 24 horas después del último
  // entrante de la lista que viaja al lado**. Sin eso, una ventana calculada sobre otra columna
  // —`ultimo_saliente_el`, o el `creado_el` del contacto— pasaría igual, y el compositor quedaría
  // habilitado o deshabilitado por un dato que la pantalla no muestra.
  //
  // Y el ORDEN: se siembran del más nuevo al más viejo a propósito. Si la consulta perdiera su
  // `order by`, la lista saldría en el orden de inserción y el chat mostraría la conversación al
  // revés — que se ve, pero sólo si alguien mira.
  const ahora = Date.now();
  const k = await unContacto(esc, { ultimoEntranteEl: new Date(ahora - 2 * HORA) });

  await unMensaje(esc, k.id, {
    direccion: 'saliente',
    cuerpo: 'tercero',
    enviadoEl: new Date(ahora - 1 * HORA),
  });
  await unMensaje(esc, k.id, {
    direccion: 'entrante',
    cuerpo: 'segundo',
    enviadoEl: new Date(ahora - 2 * HORA),
  });
  await unMensaje(esc, k.id, {
    direccion: 'entrante',
    cuerpo: 'primero',
    enviadoEl: new Date(ahora - 3 * HORA),
  });

  const { estado, cuerpo } = await leerRespuesta<CuerpoDelChat>(await leerChat(k.id));
  assert.equal(estado, 200);

  assert.deepEqual(
    cuerpo.mensajes.map((m) => m.cuerpo),
    ['primero', 'segundo', 'tercero'],
    'el chat no viene del más viejo al más nuevo: la conversación se lee al revés',
  );

  // Las dos cosas, en UNA respuesta. Que la clave exista es la mitad barata.
  assert.ok(cuerpo.ventana, 'la ventana no viajó con los mensajes: son el mismo hecho');
  assert.equal(cuerpo.ventana.abierta, true);

  /* Y la mitad que importa: la ventana coincide con el último entrante de ESTA lista.
   *
   * El camino no es que la ruta recorra la lista —lee `contactos.ultimo_entrante_el`, una sola
   * columna— sino que el disparador de la migración `013` hace avanzar esa columna con cada entrante
   * que se inserta. Lo que la aserción fija es que los dos datos que viajan juntos digan lo mismo, y
   * eso se rompe leyendo otra columna: `ultimo_saliente_el` daría una ventana que arranca cuando
   * escribimos nosotros —o sea siempre abierta— y `creado_el` una que vence 24 h después de haber
   * importado el contacto. Las dos versiones devuelven una fecha plausible. */
  const ultimoEntrante = [...cuerpo.mensajes].reverse().find((m) => m.direccion === 'entrante');
  assert.ok(ultimoEntrante, 'el sembrado tiene que dejar al menos un entrante');
  assert.ok(cuerpo.ventana.venceEl);
  assert.equal(
    Date.parse(cuerpo.ventana.venceEl) - VENTANA_MS,
    Date.parse(ultimoEntrante.enviadoEl),
    'la ventana no vence 24 h después del último entrante que viaja al lado: está mirando otra ' +
      'columna, y el compositor se habilita o se bloquea por un dato que la pantalla no muestra',
  );

  // Con mensajes a la vista no hay nada que faltar: `falta` contesta «por qué no hay ninguno».
  assert.equal(cuerpo.falta, null, 'con tres mensajes cargados apareció un texto de «falta»');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · LA VENTANA DE 24 HORAS, Y SUS **DOS** MOTIVOS DE CIERRE
// ═══════════════════════════════════════════════════════════════════════════════

test('un entrante de hace 2 horas deja la ventana ABIERTA, y SIN motivo', async () => {
  // La mitad complementaria de las dos de abajo. Sin ella, una implementación que cierra siempre
  // —el `return { abierta: false }` que alguien deja mientras depura— pasaría las otras dos y
  // dejaría el compositor deshabilitado para toda la empresa. Nadie reporta un botón gris.
  const k = await unContacto(esc, { ultimoEntranteEl: new Date(Date.now() - 2 * HORA) });
  const { cuerpo } = await leerRespuesta<CuerpoDelChat>(await leerChat(k.id));

  assert.equal(cuerpo.ventana.abierta, true, 'dos horas después de que el contacto escribió está abierta');
  assert.equal(
    cuerpo.ventana.motivo,
    null,
    'una ventana abierta con motivo hace que el compositor dibuje una advertencia sobre un envío ' +
      'que sí se puede hacer',
  );
  assert.ok(
    cuerpo.ventana.restanteMs !== null && cuerpo.ventana.restanteMs > 0,
    `restanteMs=${cuerpo.ventana.restanteMs}: abierta tiene que ser tiempo POSITIVO`,
  );
});

test('un entrante de hace 30 horas la deja CERRADA, con motivo, y el restante NEGATIVO', async () => {
  // 30 h > 24 h. El borde no se prueba acá —lo hace el módulo puro— lo que se fija es que la RUTA
  // devuelva el cierre en vez de un `abierta: true` optimista: es la mitad preventiva del defecto
  // original, donde el CRM aceptaba el mensaje y el canal lo rechazaba minutos después.
  const k = await unContacto(esc, { ultimoEntranteEl: new Date(Date.now() - 30 * HORA) });
  const { cuerpo } = await leerRespuesta<CuerpoDelChat>(await leerChat(k.id));

  assert.equal(cuerpo.ventana.abierta, false, 'a las 30 horas la ventana del canal ya cerró');
  assert.ok(
    cuerpo.ventana.motivo,
    'una ventana cerrada sin motivo deja al closer con un compositor gris y ninguna explicación',
  );
  assert.ok(
    cuerpo.ventana.restanteMs !== null && cuerpo.ventana.restanteMs < 0,
    `restanteMs=${cuerpo.ventana.restanteMs}: cerrada por plazo tiene que decir hace CUÁNTO venció`,
  );
});

test('SIN ningún entrante también está cerrada, y el motivo es OTRO', async () => {
  // La prueba que los dos casos de arriba no pueden dar: **los dos motivos son dos**.
  //
  // «Nunca escribió» y «pasó el plazo» llevan a acciones distintas —mandar una plantilla aprobada
  // contra esperar a que escriba— y un solo texto para los dos manda al closer a hacer lo que no
  // corresponde la mitad de las veces. Con `abierta: false` en los dos casos, colapsar los motivos
  // no rompe ninguna prueba de «abierta/cerrada»: hay que compararlos entre sí.
  const nunca = await unContacto(esc, { ultimoEntranteEl: null });
  // Y con un SALIENTE a la vista, para que el caso no sea «el chat está vacío»: se le escribió, él
  // no contestó nunca. Es el caso real de una prospección.
  await unMensaje(esc, nunca.id, { direccion: 'saliente', cuerpo: 'hola, ¿te llamo?' });
  const vencida = await unContacto(esc, { ultimoEntranteEl: new Date(Date.now() - 30 * HORA) });

  const sinEscribir = (await leerRespuesta<CuerpoDelChat>(await leerChat(nunca.id))).cuerpo.ventana;
  const pasoElPlazo = (await leerRespuesta<CuerpoDelChat>(await leerChat(vencida.id))).cuerpo.ventana;

  assert.equal(sinEscribir.abierta, false, 'un contacto que nunca escribió no tiene ventana abierta');
  assert.ok(sinEscribir.motivo);
  assert.ok(pasoElPlazo.motivo);
  assert.notEqual(
    sinEscribir.motivo,
    pasoElPlazo.motivo,
    'los dos cierres dicen lo mismo: «nunca escribió» manda a mandar una plantilla y «pasó el ' +
      'plazo» manda a esperar, y con un texto único el closer no puede saber cuál de las dos es',
  );

  // Y sin fecha no hay «hace cuánto»: inventarlo sería un vencimiento en 1970.
  assert.equal(sinEscribir.venceEl, null, 'un contacto que nunca escribió no tiene fecha de vencimiento');
  assert.equal(sinEscribir.restanteMs, null);
  assert.ok(pasoElPlazo.venceEl, 'el cierre por plazo sí tiene fecha: es la que explica el motivo');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · EL `POST`: TODO RECHAZO SE COMPRUEBA DOS VECES
// ═══════════════════════════════════════════════════════════════════════════════

test('el POST con la ventana CERRADA se rechaza Y NO ESCRIBE NINGÚN MENSAJE', async () => {
  // Las DOS mitades, y la segunda es la que importa: un rechazo que igual guarda la fila deja en el
  // chat una burbuja de un mensaje que el contacto no recibió, y encima la deja `en_curso`, o sea
  // que la tercera pasada va a preguntar por ella para siempre. Es el defecto original de la Etapa
  // 13 dado vuelta, y con el estado de la respuesta solo no se ve.
  const k = await unContacto(esc, { ultimoEntranteEl: new Date(Date.now() - 30 * HORA) });
  const antes = await cuantosMensajes(k.id);

  const r = await escribirChat(k.id, 'te escribo fuera de la ventana');
  const { estado, cuerpo } = await leerRespuesta<CuerpoDeRechazo>(r);

  assert.equal(estado, 409, `el rechazo por ventana cerrada tiene que ser 409: vino ${estado}`);
  assert.equal(
    cuerpo.codigo,
    'ventana_cerrada',
    'el código tiene que ser propio: la petición está BIEN, es el momento el que no sirve, y el ' +
      'compositor tiene que poder distinguir «arreglá el texto» de «esperá a que te escriba»',
  );
  assert.ok(cuerpo.detalle, 'el rechazo viaja sin el motivo de la ventana: el compositor no tiene qué mostrar');

  assert.equal(
    await cuantosMensajes(k.id),
    antes,
    'el rechazo por ventana cerrada IGUAL escribió la fila: queda una burbuja de un mensaje que ' +
      'nadie recibió, en curso para siempre',
  );
});

test('el POST con el texto VACÍO se rechaza como petición inválida, y tampoco escribe', async () => {
  // Y con la ventana ABIERTA, que es lo que hace la prueba: si el orden de las comprobaciones se
  // invirtiera, un texto vacío sobre una ventana cerrada respondería `ventana_cerrada` y el
  // compositor mandaría a esperar cuando lo que falta es escribir algo.
  const k = await unContacto(esc, { ultimoEntranteEl: new Date(Date.now() - 1 * HORA) });
  const antes = await cuantosMensajes(k.id);

  const { estado, cuerpo } = await leerRespuesta<CuerpoDeRechazo>(await escribirChat(k.id, '   '));
  assert.equal(estado, 400, `un texto de sólo espacios tiene que ser 400: vino ${estado}`);
  assert.equal(cuerpo.codigo, 'peticion_invalida');
  assert.equal(await cuantosMensajes(k.id), antes, 'un texto vacío llegó a guardarse');
});

test('el POST con la ventana ABIERTA y SIN credencial rechaza LEGIBLE, no con un 500, y no escribe', async () => {
  // El contrato que la falta de credencial fija, y vale escribirlo: en pruebas no hay token de
  // GoHighLevel cargado, así que este camino es el que corre siempre acá.
  //
  // Lo que se comprueba es que el servidor **no se cuelgue el error ajeno encima**: un 500 manda a
  // alguien a revisar este código cuando lo que falta es un token que se carga en Ajustes, y ése es
  // el desvío que cuesta la tarde. El 409 con su código propio manda a la pantalla correcta.
  //
  // Y la tabla otra vez: se rechaza ANTES de guardar. Una fila guardada sin haber llamado a nadie
  // sería un mensaje que la pantalla muestra como enviado y que no salió de acá.
  const k = await unContacto(esc, { ultimoEntranteEl: new Date(Date.now() - 1 * HORA) });
  const antes = await cuantosMensajes(k.id);

  const r = await escribirChat(k.id, 'ventana abierta, sin token');
  const { estado, cuerpo } = await leerRespuesta<CuerpoDeRechazo>(r);

  assert.notEqual(estado, 500, 'la falta de una credencial nuestra salió como error del servidor');
  assert.notEqual(estado, 201, 'se dio por enviado un mensaje sin ninguna credencial cargada');
  assert.equal(estado, 409, `sin token cargado el rechazo es 409: vino ${estado}`);
  assert.equal(
    cuerpo.codigo,
    'credenciales_incompletas',
    'sin token, el código tiene que decir que falta cargar algo y no que lo cargado dejó de servir',
  );
  assert.match(
    cuerpo.detalle ?? '',
    /Ajustes/,
    'el detalle no dice DÓNDE se arregla: un texto sin la pantalla obliga a preguntar',
  );

  assert.equal(
    await cuantosMensajes(k.id),
    antes,
    'se guardó la fila sin haber conseguido credencial: el chat mostraría como enviado un mensaje ' +
      'que nunca se intentó mandar',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · ADR-0501 · UN CONTACTO DE OTRA EMPRESA **NO EXISTE**
// ═══════════════════════════════════════════════════════════════════════════════

test('ADR-0501: un contacto de OTRA organización da 404 en el GET y en el POST, nunca 403', async () => {
  // El identificador es real y la sesión tiene las dos capacidades: lo único que falla es la
  // empresa. Un 403 acá **confirma que ese identificador existe** —el oráculo que `ADR-0501` cierra—
  // y un 200 con lista vacía sería peor: `ADR-0305`, un rechazo dibujado como «no hay datos».
  //
  // Se prueban los DOS verbos porque son dos consultas distintas en el archivo, y arreglar una sin
  // la otra es exactamente lo que pasa cuando sólo el GET tiene prueba.
  const ajeno = await unContacto(esc, { org: esc.otraOrg });
  // Con un mensaje adentro: así, si la consulta se saliera del aislamiento, la lista vendría con
  // contenido y la diferencia entre 404 y «200 vacío» sería visible.
  await unMensaje(esc, ajeno.id, { org: esc.otraOrg, direccion: 'entrante', cuerpo: 'esto es de beta' });

  const leido = await leerRespuesta<CuerpoDeRechazo & { mensajes?: unknown[] }>(await leerChat(ajeno.id));
  assert.equal(leido.estado, 404, `el GET sobre un contacto de otra empresa dio ${leido.estado}`);
  assert.equal(leido.cuerpo.codigo, 'no_encontrado');
  assert.equal(leido.cuerpo.mensajes, undefined, 'se filtró la conversación de la otra organización');

  const escrito = await leerRespuesta<CuerpoDeRechazo>(await escribirChat(ajeno.id, 'hola beta'));
  assert.equal(escrito.estado, 404, `el POST sobre un contacto de otra empresa dio ${escrito.estado}`);
  assert.equal(escrito.cuerpo.codigo, 'no_encontrado');
  assert.equal(
    await cuantosMensajes(ajeno.id),
    1,
    'el POST escribió sobre un contacto de otra organización: es la fuga entre inquilinos',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · LA FRESCURA VIAJA, Y DISTINGUE «NUNCA SE BARRIÓ» DE «AL DÍA»
// ═══════════════════════════════════════════════════════════════════════════════

test('la frescura viaja en la respuesta del chat, y su aviso distingue «nunca se barrió» de «al día»', async () => {
  // El modo de fallar de un cron es el silencio. Sin este campo, un chat con lo de anteayer **se ve
  // completo**: los mensajes están, el orden está, y el de ayer —el que decide si hay que llamar—
  // simplemente no está y nada lo dice.
  //
  // Los dos estados se piden en la MISMA prueba porque el defecto que hay que atrapar es el de
  // avisar siempre o no avisar nunca, y ninguno de los dos se ve con un solo estado a la vista.
  //
  // Y se comprueba con mensajes CARGADOS a propósito: `falta` sólo se calcula con la lista vacía, así
  // que un atraso metido dentro de `falta` sería invisible justo en el caso engañoso.
  const k = await unContacto(esc, { ultimoEntranteEl: new Date(Date.now() - 1 * HORA) });
  await unMensaje(esc, k.id, { direccion: 'entrante', cuerpo: 'lo de anteayer' });

  await sinSello();
  const jamas = (await leerRespuesta<CuerpoDelChat>(await leerChat(k.id))).cuerpo;
  assert.equal(jamas.frescura.estado, 'nunca', 'sin ningún sello, el barrido nunca corrió acá');
  assert.ok(
    jamas.frescura.aviso,
    'el barrido no corrió nunca y la pantalla no dice nada: es exactamente el silencio del cron',
  );
  assert.match(jamas.frescura.aviso, /nunca/i);
  assert.equal(
    jamas.frescura.minutos,
    null,
    'sin sello no hay «hace cuánto»: un número acá sería un 1970 disfrazado de medición',
  );
  // Y el atraso NO se cuela dentro de `falta`: ahí sólo se dibuja con la lista vacía.
  assert.equal(jamas.falta, null, 'el aviso del barrido se metió en `falta`, donde con mensajes no se ve');

  await selloReciente();
  const alDia = (await leerRespuesta<CuerpoDelChat>(await leerChat(k.id))).cuerpo;
  assert.equal(alDia.frescura.estado, 'al_dia', 'con el sello recién puesto el barrido está al día');
  assert.equal(
    alDia.frescura.aviso,
    null,
    'avisó estando al día: un aviso que aparece siempre se aprende a ignorar, y el día que importa ' +
      'tampoco se lee',
  );
  assert.ok(
    alDia.frescura.umbralMinutos > 0,
    'el umbral viaja para que la pantalla no lo invente: sin él sería una segunda copia del mapa ' +
      'de horarios',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6 · UN MENSAJE SIN CUERPO NO SE DESCARTA
// ═══════════════════════════════════════════════════════════════════════════════

test('un mensaje con `cuerpo` NULO —un audio, una imagen— sigue viniendo en la lista', async () => {
  // Un audio y una imagen llegan del canal sin texto. Descartarlos es la línea inofensiva que
  // cualquiera escribe —`.where('cuerpo', 'is not', null)`, o un `.filter(m => m.cuerpo)`— y su
  // consecuencia es que **para un auditor ese turno no ocurrió**: el mensaje anterior queda como si
  // nadie lo hubiera contestado, y el chat se lee coherente.
  //
  // La lista se compara ENTERA, no por longitud: con `length === 2` una implementación que devuelve
  // el nulo dos veces pasaría igual.
  const k = await unContacto(esc, { ultimoEntranteEl: new Date(Date.now() - 2 * HORA) });
  const ahora = Date.now();
  await unMensaje(esc, k.id, {
    direccion: 'entrante',
    cuerpo: '¿me escuchás?',
    enviadoEl: new Date(ahora - 3 * HORA),
  });
  await unMensaje(esc, k.id, {
    direccion: 'entrante',
    cuerpo: null,
    enviadoEl: new Date(ahora - 2 * HORA),
  });
  await unMensaje(esc, k.id, {
    direccion: 'saliente',
    cuerpo: 'sí, te escucho',
    enviadoEl: new Date(ahora - 1 * HORA),
  });

  const { cuerpo } = await leerRespuesta<CuerpoDelChat>(await leerChat(k.id));
  assert.deepEqual(
    cuerpo.mensajes.map((m) => m.cuerpo),
    ['¿me escuchás?', null, 'sí, te escucho'],
    'el mensaje sin cuerpo desapareció de la lista, o cambió de lugar: el turno del medio no ' +
      'ocurrió para quien lee el chat',
  );
  // Y viene como NULO, no como cadena vacía: un `?? ''` acá haría que el audio se dibuje como un
  // mensaje de texto en blanco, que es indistinguible de un mensaje mal guardado.
  assert.equal(
    cuerpo.mensajes[1]?.cuerpo,
    null,
    'el cuerpo nulo llegó convertido en algo: un audio se dibujaría como un texto vacío',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7 · LOS DOS VERBOS PASAN POR EL PORTERO DE VERDAD
// ═══════════════════════════════════════════════════════════════════════════════

test('sin sesión válida el GET y el POST responden 401 `sin_sesion`, y el POST no escribe', async () => {
  /* Las nueve pruebas de arriba mandan la sesión de la administradora de `alfa`, así que ninguna
   * llega a la rama de RECHAZO del portero. Se comprobó mutándolo —cambiando el código de
   * `sin_sesion` en `portero.ts`— y las diez seguían verdes: la ruta podría perder su `exigir` y este
   * archivo no lo notaría. El guardia de `pruebas/codigo/` ve el `exigir(` escrito y no lo ejecuta,
   * que es la premisa del encabezado dada vuelta.
   *
   * El POST es el que hace que esto no sea una formalidad: sin puerta, cualquiera manda un WhatsApp
   * desde el número de la empresa a un contacto que eligió por su uuid. Así que se comprueban las dos
   * mitades de siempre —el código, y que la tabla no creció—. */
  const k = await unContacto(esc, { ultimoEntranteEl: new Date(Date.now() - 1 * HORA) });
  const antes = await cuantosMensajes(k.id);
  const sinSesion = 'esta-sesion-no-existe';

  const leido = await leerRespuesta<CuerpoDeRechazo & { mensajes?: unknown[]; ventana?: unknown }>(
    await verChat(pedirComo(`/api/contactos/${k.id}/mensajes`, sinSesion), {
      params: Promise.resolve({ id: k.id }),
    }),
  );
  assert.equal(leido.estado, 401, `el GET contestó ${leido.estado} sin sesión`);
  assert.equal(leido.cuerpo.codigo, 'sin_sesion', 'el código es lo que manda al login');
  assert.equal(leido.cuerpo.mensajes, undefined, 'el rechazo trae la conversación');
  assert.equal(leido.cuerpo.ventana, undefined, 'el rechazo dice si se puede escribir');

  const escrito = await leerRespuesta<CuerpoDeRechazo>(
    await mandarMensaje(
      pedirComo(`/api/contactos/${k.id}/mensajes`, sinSesion, {
        metodo: 'POST',
        cuerpo: { texto: 'hola desde ninguna sesión' },
      }),
      { params: Promise.resolve({ id: k.id }) },
    ),
  );
  assert.equal(escrito.estado, 401, `el POST contestó ${escrito.estado} sin sesión`);
  assert.equal(escrito.cuerpo.codigo, 'sin_sesion');
  assert.equal(
    await cuantosMensajes(k.id),
    antes,
    'un POST sin sesión dejó la fila: es un mensaje mandado por nadie desde el número de la empresa',
  );
});
