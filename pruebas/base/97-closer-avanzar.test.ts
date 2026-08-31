// Avanzar y las Notas, POR EL MANEJADOR DE RUTA. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ HACE FALTA OTRO ARCHIVO SI YA EXISTE `26-avanzar.test.ts`
//
// El `26` mide `registrarResultado` —la función— llamándola directo. Eso cubre la mitad de abajo y
// deja fuera TODO lo que decide el manejador: la validación del cuerpo, el 404 de `ADR-0501`, la
// forma exacta de la respuesta y el aviso al CRM. Esa mitad estaba cubierta nada más por los
// guardias de arquitectura, que LEEN el archivo y no lo ejecutan: un `exigir` con la capacidad
// correcta y una consulta que devuelve la organización equivocada pasan los dos sin una queja.
//
// Acá se invoca `POST /api/contactos/[id]/avanzar` y las dos mitades de
// `/api/contactos/[id]/notas`, y se mira la base después.
//
// ── LOS CUATRO HECHOS QUE ESTE ARCHIVO MIDE ─────────────────────────────────
//
// **1 · Cada salida deja al contacto en SU etapa.** De `contactos.etapa` salen las siete columnas
// del Pipeline. Un mapeo cruzado —`nurture` cayendo en `descalificado`— no falla en ningún lado: el
// contacto simplemente aparece en la columna de al lado, y nadie lo nota hasta que alguien lo busca
// donde lo dejó.
//
// **2 · Lo que se rechaza no escribe.** Una venta sin monto que igual registre el resultado suma una
// venta a Inicio con `null` en el monto, y el «cobrado» del mes queda por debajo sin que nada falle.
//
// **3 · Un contacto de otra empresa NO EXISTE.** `ADR-0501`: 404 y nunca 403, porque un 403 confirma
// que ese identificador existe. Y `ADR-0305`: el rechazo no puede parecerse a una lista vacía.
//
// **4 · La nota vuelve con su identificador y su autor de verdad.** Es el `04` § 3: atribuirle a
// alguien una nota que no escribió —o atribuir a un automatismo lo que escribió una persona— es lo
// que vuelve inservible el historial.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import {
  DOMINIO,
  leerRespuesta,
  limpiar,
  montar,
  pedirComo,
  unaNota,
  unContacto,
  type Escenario,
} from '../apoyo/closer.ts';
import { COOKIE_SESION } from '../../lib/autorizacion/sesion.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { pipelineDe } from '../../lib/negocio/pipeline.ts';
import { sellarSiEsDelSetter } from '../../lib/negocio/sello.ts';
import { GET as pipelineDelSetter } from '../../app/api/setter/pipeline/route.ts';
import { ETAPA_DE_ENTRADA_DEL_SETTER } from '../../lib/negocio/etapasDelSetter.ts';
import { RESULTADOS } from '../../lib/ghl/contrato.ts';
import { SALIDAS_DEL_CLOSER, modoDe, modosDe } from '../../lib/negocio/salidas.ts';
import { etiquetasDelResultado } from '../../lib/ghl/contrato.ts';
import { ETAPA_DE_LA_SALIDA } from '../../lib/negocio/etapas.ts';
import { POST as avanzar } from '../../app/api/contactos/[id]/avanzar/route.ts';
import {
  GET as verNotas,
  POST as escribirNota,
} from '../../app/api/contactos/[id]/notas/route.ts';

let esc: Escenario;
before(async () => {
  esc = await montar('Avanzar');
});
after(async () => {
  await limpiar(esc);
  await cerrarTodo();
  await cerrarClientes();
});

// ── LA FORMA DE LAS DOS RESPUESTAS, tal como la escriben las rutas ─────────────

interface RespuestaAvanzar {
  registrado?: boolean;
  salida?: string;
  etapa?: string;
  /** `true` = se guardó la nota. Ver el bloque 5: `false` significa «no se pidió». */
  nota?: boolean;
  tarea?: boolean;
  crm?: { avisado: boolean; etiquetas: string[]; porque: string | null };
  codigo?: string;
  detalle?: string;
}

interface RespuestaNotas {
  notas?: { id: string; cuerpo: string; autor: string | null; origen: string; creadoEl: string }[];
  falta?: string | null;
  creada?: boolean;
  id?: string;
  creadoEl?: string;
  autor?: string;
  codigo?: string;
  detalle?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El contexto del parámetro de camino. Las dos rutas leen `id` de acá y no de la URL. */
const ctxDe = (id: string) => ({ params: Promise.resolve({ id }) });

/** Lo que quedó en la base para ESE contacto. Todo lo que las aserciones de «no escribió» miran. */
async function loEscrito(org: string, contactoId: string) {
  return conOrganizacion(org, async () => {
    const contacto = await datos()
      .selectFrom('contactos')
      .select('etapa')
      .where('id', '=', contactoId)
      .executeTakeFirst();
    const resultados = await datos()
      .selectFrom('resultados')
      .select(['salida', 'monto', 'forma_pago', 'detalle', 'rol', 'nota', 'registrado_por'])
      .where('contacto_id', '=', contactoId)
      .execute();
    const notas = await datos()
      .selectFrom('notas')
      .select(['id', 'cuerpo', 'autor_id', 'origen'])
      .where('contacto_id', '=', contactoId)
      .execute();
    const tareas = await datos()
      .selectFrom('tareas')
      .select(['situacion', 'modo', 'nota', 'creada_por'])
      .where('contacto_id', '=', contactoId)
      .execute();
    return { etapa: contacto?.etapa ?? null, resultados, notas, tareas };
  });
}

/** El día de mañana, en `YYYY-MM-DD`. Calculado y no escrito a mano: una fecha fija se vence. */
const MANANA = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);

/**
 * Una nota que el MANEJADOR acepta y la BASE no.
 *
 * `U+0000` es un carácter válido en una cadena de JavaScript y `text` de PostgreSQL no lo admite
 * (`22021`). Es la palanca para medir la atomicidad sin tocar código de producción: la validación de
 * la ruta mira el largo, no los bytes, así que esto pasa las cuatro comprobaciones y revienta en el
 * `insert` de `notas` — que es el TERCERO de los cuatro, con el resultado y la etapa ya escritos.
 *
 * Va como escape y no como el carácter literal a propósito: un NUL crudo en el archivo fuente lo
 * vuelve binario para `grep` y para media herramienta del repositorio.
 */
const NOTA_CON_NUL = 'con un nul \u0000 adentro';

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · CADA SALIDA A SU ETAPA — es lo que hace que el Pipeline no mienta
// ═══════════════════════════════════════════════════════════════════════════════

test('cada salida del catálogo deja al contacto en la etapa que dice `ETAPA_DE_LA_SALIDA`', async () => {
  // Se RECORRE `SALIDAS` en vez de repetir las seis acá. Con la lista repetida, agregar una salida
  // al catálogo dejaría a la nueva sin medir y la prueba seguiría verde — que es exactamente el
  // defecto de las dos listas que `salidas.ts` existe para cerrar.
  //
  // Y se comprueba en `contactos.etapa` y no solo en la respuesta: la respuesta puede devolver la
  // etapa correcta calculada en memoria mientras el `update` no corre. El síntoma de eso es
  // «registré y no se movió», sin ningún error.
  for (const s of SALIDAS_DEL_CLOSER) {
    const k = await unContacto(esc, { nombre: `Avanzar etapa ${s.salida}` });
    const cuerpo: Record<string, unknown> = { salida: s.salida };
    if (s.pideMonto) cuerpo.monto = 1000;

    /* ── EL MODO TAMBIÉN SALE DEL CATÁLOGO, Y POR EL MISMO MOTIVO ─────────────
     *
     * Escribir `if (s.salida === 'seguimiento') cuerpo.modo = 'manual'` habría vuelto a partir la
     * lista en dos: el día que otra salida gane modos, esta prueba la mandaría sin modo y el 400 se
     * leería como «la etapa no se movió», que es un síntoma que no tiene nada que ver.
     *
     * Se elige el primero que NO exija fecha, para no tener que inventar un día; si todos la
     * exigen, se manda. Así la barrida sigue siendo total sin saber nada de quién tiene modos. */
    const modos = modosDe('closer', s.salida);
    if (modos.length > 0) {
      const m = modos.find((x) => !x.exigeFecha) ?? modos[0]!;
      cuerpo.modo = m.modo;
      if (m.exigeFecha) cuerpo.volverEl = MANANA;
    }

    const r = await avanzar(
      pedirComo(`/api/contactos/${k.id}/avanzar`, esc.token, { metodo: 'POST', cuerpo }),
      ctxDe(k.id),
    );
    const { estado, cuerpo: resp } = await leerRespuesta<RespuestaAvanzar>(r);
    assert.equal(estado, 201, `${s.salida}: ${JSON.stringify(resp)}`);

    const esperada = ETAPA_DE_LA_SALIDA[s.salida];
    assert.equal(resp.etapa, esperada, `${s.salida}: la respuesta dice otra etapa`);

    const escrito = await loEscrito(esc.org, k.id);
    assert.equal(
      escrito.etapa,
      esperada,
      `${s.salida}: el resultado se registró y el contacto NO se movió de columna`,
    );
    assert.equal(escrito.resultados.length, 1, `${s.salida}: falta la fila de \`resultados\``);
  }
});

test('las seis salidas NO se aplastan en la misma etapa', async () => {
  // La mitad complementaria de la de arriba, y no es redundante: un mapeo que devolviera siempre
  // `'agendado'` la pasaría entera si `ETAPA_DE_LA_SALIDA` también dijera `'agendado'` en las seis.
  // Esto fija los destinos que importan y que están decididos por escrito en `etapas.ts`.
  const destinos = SALIDAS_DEL_CLOSER.map((s) => ETAPA_DE_LA_SALIDA[s.salida]);
  assert.deepEqual(destinos, ['ganado', 'cierre', 'seguimiento', 'descalificado', 'no_show', 'nurture']);
  assert.equal(new Set(destinos).size, 6, 'dos salidas caen en la misma columna del Pipeline');
});

test('el ROL del resultado es el TERRITORIO del contacto, no el rol de quien registra', async () => {
  // De esta columna dependen las DOS comisiones, que se calculan distinto. Quien administra puede
  // registrar sobre un contacto de cualquiera de los dos territorios, así que escribir su propio rol
  // acá le pagaría la comisión de closer a una venta de un setter — y el número sale igual de
  // plausible, que es lo que lo hace caro.
  /* ── LA SALIDA ES DEL SETTER, Y ANTES ERA `venta` ─────────────────────────
   *
   * Esta prueba mandaba `venta` —una salida del CLOSER— sobre un contacto del setter y esperaba un
   * 201. Eso funcionaba mientras hubiera un solo catálogo, y **hoy se rechaza**: cada territorio
   * tiene sus salidas, y registrar `venta` con `rol = 'setter'` le pagaría a un setter el tramo de
   * comisión de una venta grande que no es suya.
   *
   * Lo que la prueba afirma no cambió —el rol sale del CONTACTO, no de quien aprieta el botón— y
   * ahora lo afirma con una salida que ese contacto admite. Quien registra sigue siendo la persona
   * administradora del sembrado, o sea alguien de rol distinto del territorio del contacto: si el
   * rol saliera de quien registra, esto diría `closer`. */
  const delSetter = await unContacto(esc, { territorio: 'setter', nombre: 'Avanzar territorio' });
  const r = await avanzar(
    pedirComo(`/api/contactos/${delSetter.id}/avanzar`, esc.token, {
      metodo: 'POST',
      cuerpo: { salida: 'venta_chica', detalle: 'Transferencia', monto: 500 },
    }),
    ctxDe(delSetter.id),
  );
  assert.equal(r.status, 201, await r.clone().text());

  const escrito = await loEscrito(esc.org, delSetter.id);
  assert.equal(escrito.resultados[0]?.rol, 'setter', 'el rol se tomó de quien registra, no del contacto');
  assert.equal(escrito.resultados[0]?.salida, 'venta_chica');

  /* Y LA OTRA MITAD, que es la que la guarda agrega: una salida del CLOSER sobre ese mismo contacto
     se rechaza. Sin esto, la prueba de arriba pasaría igual con la guarda apagada. */
  const conLaDelOtro = await avanzar(
    pedirComo(`/api/contactos/${delSetter.id}/avanzar`, esc.token, {
      metodo: 'POST',
      cuerpo: { salida: 'venta', monto: 500 },
    }),
    ctxDe(delSetter.id),
  );
  assert.equal(
    conLaDelOtro.status,
    400,
    'una salida del closer se registró sobre un contacto del setter: eso le paga el tramo de ' +
      'comisión equivocado, con un número igual de plausible',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
test('un contacto CONGELADO no tiene con qué vocabulario registrarse, y se dice', async () => {
  /* ══ ACÁ HABÍA UN `?? 'closer'` QUE ELEGÍA UN NEGOCIO EN SILENCIO ════════
   *
   * El rol de un resultado sale del territorio del contacto. Un congelado —sin ninguna etiqueta de
   * zona— no tiene territorio, y la ruta tenía un respaldo: `contacto.territorio ?? 'closer'`.
   *
   * Con un solo catálogo eso era una etiqueta en una columna. Con dos vocabularios **elige un
   * negocio**: un contacto que era del setter y perdió su zona quedaría registrado con el rol del
   * closer, y esa columna es de la que dependen las dos comisiones. El síntoma sería un número
   * plausible en el tablero equivocado.
   *
   * Se rechaza y se dice por qué. No es un error del usuario: es un estado del contacto, y el texto
   * cuenta cómo sale de él. */
  const congelado = await unContacto(esc, { territorio: null, nombre: 'Avanzar congelado' });
  const r = await avanzar(
    pedirComo(`/api/contactos/${congelado.id}/avanzar`, esc.token, {
      metodo: 'POST',
      cuerpo: { salida: 'venta', monto: 500 },
    }),
    ctxDe(congelado.id),
  );

  const { estado, cuerpo } = await leerRespuesta<RespuestaAvanzar>(r);
  assert.equal(estado, 400, JSON.stringify(cuerpo));
  assert.match(
    cuerpo.detalle ?? '',
    /ningún territorio/i,
    'el rechazo no dice que el problema es el territorio, así que se lee como un error del cuerpo',
  );

  // Y NO ESCRIBIÓ NADA. Un rechazo que ya movió la etapa es peor que uno que no rechaza.
  const escrito = await loEscrito(esc.org, congelado.id);
  assert.equal(escrito.resultados.length, 0, 'el congelado dejó un resultado escrito');
  assert.equal(escrito.etapa, null, 'el congelado se quedó con la etapa movida');
});

test('el embudo del SETTER es otro, y el traspaso se resuelve solo', async () => {
  /* ══ UNA COLUMNA POR EMBUDO, Y EL CRUCE NO NECESITA CÓDIGO EXTRA ════════
   *
   * `contactos.etapa` es UNA columna de texto sin restricción, y el traspaso de territorio no la
   * limpia. Así que un contacto que cruza llega con la etapa del otro embudo escrita.
   *
   * La regla que lo resuelve es «cada pipeline valida contra las suyas»: una etapa del setter no es
   * ninguna de las siete del closer, así que cae a la derivación por etiquetas y de ahí a la etapa
   * de ENTRADA del closer — que es la respuesta correcta, porque ningún closer registró nada
   * todavía. Sin esa regla el contacto se quedaría en una columna que allá no se dibuja: presente
   * en el total y ausente de todas las columnas, con la suma sin cerrar. */
  const enSetter = await unContacto(esc, { territorio: 'setter', nombre: 'Embudo setter' });

  // Una venta chica NO va a la columna del cierre grande: va a la suya.
  const r = await avanzar(
    pedirComo(`/api/contactos/${enSetter.id}/avanzar`, esc.token, {
      metodo: 'POST',
      cuerpo: { salida: 'venta_chica', detalle: 'Efectivo', monto: 497 },
    }),
    ctxDe(enSetter.id),
  );
  assert.equal(r.status, 201, await r.clone().text());

  const escrito = await loEscrito(esc.org, enSetter.id);
  assert.equal(
    escrito.etapa,
    'vendido',
    'la venta chica cayó en otra columna. Si cae en `ganado`, se dibuja junto a los cierres del ' +
      'closer y dos negocios distintos quedan sumados en un número; si cae en `oferta_chica`, una ' +
      'venta cobrada y una oferta sin respuesta se ven iguales',
  );

  /* Y AHORA EL CRUCE: ese contacto pasa al territorio del closer con su etapa del setter puesta.
     El pipeline del closer no puede dejarlo fuera de todas sus columnas. */
  await conOrganizacion(esc.org, async () => {
    await datos()
      .updateTable('contactos')
      .set({ territorio: 'closer' })
      .where('id', '=', enSetter.id)
      .execute();
  });

  const p = await conOrganizacion(esc.org, () => pipelineDe('closer', { conCongelados: true }));
  const suColumna = p.columnas.find((c) => c.filas.some((f) => f.id === enSetter.id));
  assert.ok(
    suColumna,
    'un contacto que cruzó de territorio no cayó en NINGUNA columna del closer: está en el total y ' +
      'no en la suma, y desaparecer no da error',
  );
  assert.equal(
    suColumna.clave,
    'agendado',
    'no cayó en la etapa de ENTRADA del closer, que es la respuesta correcta: ningún closer ' +
      'registró nada sobre él todavía',
  );

  // Y la suma cierra: es la invariante que un contacto perdido rompe sin avisar.
  const enColumnas = p.columnas.reduce((n, c) => n + c.filas.length, 0);
  assert.equal(enColumnas, p.total, 'la suma de las columnas no cierra con el total');
});

test('el congelado tiene UN dueño: está en la cartera del closer y no en la del setter', async () => {
  /* Un congelado **no está en ningún territorio**. Si las dos carteras lo trajeran, aparecería en
     las dos y se contaría dos veces — en contradicción directa con que los territorios sean
     excluyentes, y con un total que suma más contactos de los que hay.

     Se eligió el Closer, que es donde ya se veía. El costo, que se acepta sabiéndolo: un contacto
     que era del setter y perdió su zona deja de verse donde se trabajaba. */
  const congelado = await unContacto(esc, { territorio: null, nombre: 'Cartera congelado' });

  const delCloser = await conOrganizacion(esc.org, () =>
    pipelineDe('closer', { conCongelados: true }),
  );
  /* Por LA RUTA y no por la función: la decisión de quién se lleva los congelados vive ahí, en el
     argumento que la ruta pasa. Llamando a la función con el argumento a mano, esta prueba pasaría
     verde con la ruta pidiendo lo contrario — que es exactamente lo que hay que impedir. */
  const respuesta = await pipelineDelSetter(
    pedirComo('/api/setter/pipeline', esc.token, { metodo: 'GET' }),
  );
  const delSetter = (await leerRespuesta<{
    columnas: { filas: { id: string }[] }[];
    cartera: { congelados: number };
  }>(respuesta)).cuerpo;

  const estaEn = (p: { columnas: { filas: { id: string }[] }[] }) =>
    p.columnas.some((c) => c.filas.some((f) => f.id === congelado.id));

  assert.equal(estaEn(delCloser), true, 'el congelado desapareció de la única cartera que lo mostraba');
  assert.equal(
    estaEn(delSetter),
    false,
    'el congelado aparece en las DOS carteras: el mismo contacto contado dos veces, y los ' +
      'territorios se suponían excluyentes',
  );
  assert.equal(delSetter.cartera.congelados, 0, 'la cartera del setter cuenta congelados que no trae');
});

test('la heurística de «clasificado por etiqueta» usa la entrada DE SU embudo', async () => {
  /* `clasificados` reparte la cartera en tres: registrado por una persona, deducido de una
     etiqueta, y sin nada. La tercera rama compara contra la etapa de ENTRADA — porque caer en la
     entrada significa justamente que no se dedujo nada.

     Con `'agendado'` cableado, esa comparación es la del closer. Para el setter, cuya entrada es
     `nuevo`, un contacto sin resultado y con etiquetas de campaña contaría como «deducido de una
     etiqueta» sin que ninguna etiqueta lo haya clasificado. El número sale plausible y está mal. */
  await unContacto(esc, {
    territorio: 'setter',
    nombre: 'Clasificado setter',
    // Etiquetas REALES de la subcuenta que no son ningún desenlace: no clasifican nada.
    etiquetas: ['zona_setter', 'bot_activado_leadflow'],
  });

  const p = await conOrganizacion(esc.org, () => pipelineDe('setter', { conCongelados: false }));
  assert.equal(
    p.clasificados.porEtiqueta,
    0,
    'un contacto sin desenlace contó como «clasificado por etiqueta»: la comparación se está ' +
      'haciendo contra la entrada del OTRO embudo',
  );
  assert.ok(p.clasificados.sinNada >= 1, 'no cayó en «sin nada», que es lo que de verdad es');
});

/** El sello de un contacto, leído en crudo. */
async function selloDe(contactoId: string): Promise<{ id: string | null; el: Date | null }> {
  const f = await esc.admin.query(
    'select sello_setter_id, sello_setter_el from negocio.contactos where id = $1',
    [contactoId],
  );
  const r = f.rows[0] as { sello_setter_id: string | null; sello_setter_el: Date | null } | undefined;
  return { id: r?.sello_setter_id ?? null, el: r?.sello_setter_el ?? null };
}

test('el SELLO DE ATRIBUCIÓN se enciende al registrar, y no se reescribe', async () => {
  /* ══ LA COLUMNA EXISTÍA DESDE LA MIGRACIÓN 011 Y NO TENÍA ESCRITOR ══════
   *
   * De este sello depende la **comisión diferida** del setter: el tramo que se paga sobre las
   * ventas grandes que cierra el closer sobre leads que él originó. Sin sello no hay de dónde
   * sacarlo, y en la plataforma anterior vivía en el navegador —se escribía en seis lugares y no se
   * leía en ninguno— así que moría al refrescar.
   *
   * El disparador de la base ya estaba probado. Lo que falta probar es el ESCRITOR, y son casos
   * distintos: el disparador deja pasar cualquier `update`, y la restricción de a QUIÉN se le pone
   * es de este lado. */
  const delSetter = await unContacto(esc, { territorio: 'setter', nombre: 'Sello setter' });
  assert.equal((await selloDe(delSetter.id)).id, null, 'nació con sello');

  // 1 · Se enciende con quien registra, y LA FECHA LA PONE LA BASE.
  const r = await avanzar(
    pedirComo(`/api/contactos/${delSetter.id}/avanzar`, esc.token, {
      metodo: 'POST',
      cuerpo: { salida: 'agendo' },
    }),
    ctxDe(delSetter.id),
  );
  assert.equal(r.status, 201, await r.clone().text());

  const primero = await selloDe(delSetter.id);
  assert.equal(primero.id, esc.quien, 'el sello no se encendió con quien registró');
  assert.notEqual(
    primero.el,
    null,
    'la fecha del sello quedó nula: la pone el disparador, y sin ella no se sabe cuándo se originó',
  );

  /* 2 · EL SELLADOR NO INTENTA PISAR UN SELLO YA PUESTO.
   *
   * Que el segundo setter no le robe al primero lo garantiza el DISPARADOR, y eso ya está probado en
   * `pruebas/base/90-negocio-closer-setter.test.ts`. Lo que le toca al ESCRITOR es no intentarlo: su
   * `where sello_setter_id is null` hace que la segunda llamada afecte CERO filas.
   *
   * Y no es prolijidad: con un reloj de diez segundos, un `update` por cada acción sobre cada
   * contacto ya sellado se paga en cada ciclo. */
  const otraVez = await conOrganizacion(esc.org, () =>
    sellarSiEsDelSetter(delSetter.id, esc.quien),
  );
  assert.equal(
    otraVez,
    false,
    'el sellador intentó escribir sobre un sello ya puesto: el disparador lo salva, pero es un ' +
      '`update` por acción y por contacto que nadie necesita',
  );

  const despues = await selloDe(delSetter.id);
  assert.equal(despues.id, esc.quien, 'el sello se movió de dueño');
  assert.equal(
    despues.el?.getTime(),
    primero.el?.getTime(),
    'la fecha del sello se movió: entonces «cuándo se originó» dejaría de ser cierto',
  );
});

test('el sello NO se enciende fuera del territorio del setter', async () => {
  /* Este caso el disparador **no lo puede dar**: deja pasar cualquier `update`, así que la
     restricción es del escritor. Y es la que impide que un closer se lleve la atribución de un
     lead — esa columna paga la comisión DEL SETTER. */
  const delCloser = await unContacto(esc, { territorio: 'closer', nombre: 'Sello closer' });
  const r = await avanzar(
    pedirComo(`/api/contactos/${delCloser.id}/avanzar`, esc.token, {
      metodo: 'POST',
      cuerpo: { salida: 'venta', detalle: 'Contado', monto: 1000 },
    }),
    ctxDe(delCloser.id),
  );
  assert.equal(r.status, 201, await r.clone().text());
  assert.equal(
    (await selloDe(delCloser.id)).id,
    null,
    'un contacto del CLOSER quedó con sello de setter: le paga a alguien el tramo de otro',
  );

  /* Y un CONGELADO tampoco. Acá se llama al sellador DIRECTO y no por la ruta, a propósito: la ruta
     rechaza a un congelado antes de llegar al sello, así que pasar por ella no mediría nada de este
     lado. Un contacto sin territorio no tiene a quién atribuirle el lead, y `territorio = 'setter'`
     en SQL **no** iguala a `null`. */
  const congelado = await unContacto(esc, { territorio: null, nombre: 'Sello congelado' });
  const sello = await conOrganizacion(esc.org, () =>
    sellarSiEsDelSetter(congelado.id, esc.quien),
  );
  assert.equal(sello, false, 'el sellador dijo que selló un contacto sin territorio');
  assert.equal((await selloDe(congelado.id)).id, null, 'un congelado quedó sellado');
});


test('una etapa que viene de una ETIQUETA no puede sacar al contacto de todas las columnas', async () => {
  /* ══ EL DEFECTO, Y POR QUÉ NO TENÍA SÍNTOMA ════════════════════════
   *
   * `etapaDelContacto` tiene tres vías: la etapa escrita, la etiqueta de más peso, y la entrada del
   * embudo. La primera **se validaba** contra el embudo del rol y la segunda **no**.
   *
   * Y `desenlaceDeLasEtiquetas` deriva con `ETAPA_DE_LA_SALIDA`, que es el mapa **del closer**. Así
   * que sobre un contacto del SETTER la vía 2 devolvía siempre una etapa del closer — una que el
   * Pipeline del setter no dibuja.
   *
   * Las dos mitades del síntoma estaban calladas, y ahí está todo el problema:
   *
   *   · `pipeline.ts` reparte con `porEtapa.get(etapa)?.push(f)` — el `?.` **descarta la fila**.
   *   · `contarPorEtapa` la salta con su `if (e in conteo)`.
   *   · Y `total` sale de `filas.length`, así que la sigue contando.
   *
   * Resultado: un Pipeline que dice «N contactos» y dibuja N−1. Sin error, sin aviso, y sin nada que
   * lo delate salvo sumar las columnas a mano.
   *
   * ── POR QUÉ ESTA PRUEBA VA POR LA RUTA Y NO LLAMA A `pipelineDe` ────────────
   *
   * Porque el rol es lo único que decide el defecto, y la ruta es la que lo escribe en el servidor.
   * Llamando a la función directo, la prueba elegiría el rol — y una mutación del argumento de la
   * ruta pasaría entera. */
  /* La etiqueta se DERIVA del catálogo del closer y no se escribe a mano: es la que
     `desenlaceDeLasEtiquetas` reconoce, y si ese catálogo cambia la prueba tiene que seguirlo en vez
     de quedarse midiendo una etiqueta que ya no clasifica nada. */
  const deSeguimiento = RESULTADOS.find((r) => r.salida === 'seguimiento');
  assert.ok(deSeguimiento?.etiqueta, 'el catálogo del closer dejó de declarar la de seguimiento');
  const etiquetaQueElCloserReconoce = deSeguimiento.etiqueta;

  interface CuerpoDelPipeline {
    columnas: { clave: string; cuantos: number; filas: { id: string }[] }[];
    total: number;
  }

  const antes = await pipelineDelSetter(pedirComo('/api/setter/pipeline', esc.token));
  assert.equal(antes.status, 200, await antes.clone().text());
  const partida = (await antes.clone().json()) as CuerpoDelPipeline;

  /* Un contacto del setter SIN etapa escrita y CON una etiqueta de desenlace del closer. Es el caso
     real: el CRM aplica sus etiquetas sobre contactos de los dos territorios, y esta aplicación no
     controla cuándo. Se usa `seguimiento` porque es la etiqueta del desenlace de menos peso, o sea
     la más fácil de que aparezca sola. */
  const k = await unContacto(esc, {
    territorio: 'setter',
    nombre: 'Etapa de la otra mitad',
    etapa: null,
    etiquetas: [etiquetaQueElCloserReconoce],
  });

  const r = await pipelineDelSetter(pedirComo('/api/setter/pipeline', esc.token));
  assert.equal(r.status, 200, await r.clone().text());
  const cuerpo = (await r.clone().json()) as CuerpoDelPipeline;

  // 1 · El contacto ESTÁ en alguna columna. Antes no estaba en ninguna.
  const columnaConEl = cuerpo.columnas.find((c) =>
    c.filas.some((f) => f.id === k.id),
  );
  assert.ok(
    columnaConEl,
    'el contacto no aparece en NINGUNA columna del Pipeline del setter: su etapa se derivó de una ' +
      'etiqueta del closer y ninguna columna de este embudo la dibuja',
  );

  /* 2 · Y cayó en la etapa de ENTRADA, que es la respuesta honesta: nadie registró un resultado de
     setter sobre él, así que está al principio del embudo. Cualquier otra columna sería inventarle un
     avance que no tuvo. */
  assert.equal(
    columnaConEl.clave,
    ETAPA_DE_ENTRADA_DEL_SETTER,
    'la etiqueta del closer lo mandó a una columna que no le corresponde',
  );

  /* 3 · LA MITAD QUE NINGUNA OTRA ASERCIÓN DA: la suma de las columnas cierra con el total.
     Es lo único que detecta una fila descartada en silencio — la aserción 1 solo mira a ESTE contacto,
     y el defecto puede volver por otro camino sobre otro.

     ══ Y UNA MUTACIÓN DE ESTA LÍNEA **SOBREVIVE**, A PROPÓSITO ══════════════

     Medido: cambiar `total: filas.length` por la suma de las columnas deja esta aserción en verde,
     porque con la guarda de `etapaDelContacto` puesta **nada se descarta** y las dos definiciones de
     `total` coinciden. Es un mutante que no cambia el comportamiento mientras el otro guardia esté.

     Lo que SÍ muere son **las dos juntas** — quitar la validación de la vía 2 y hacer que el total
     salga de la suma —, y la mata la aserción 1. Es la defensa en profundidad que este repositorio ya
     documenta: el mutante de un guardia sobrevive solo, y el par muere.

     Queda escrito para que nadie lo redescubra y lo tome por una prueba vacua. */
  const sumaDeColumnas = cuerpo.columnas.reduce((n, c) => n + c.filas.length, 0);
  assert.equal(
    sumaDeColumnas,
    cuerpo.total,
    `las columnas suman ${sumaDeColumnas} y el total dice ${cuerpo.total}: hay ` +
      `${cuerpo.total - sumaDeColumnas} contacto(s) que el Pipeline cuenta y no dibuja`,
  );

  // Y el total se movió en uno, para que la aserción de arriba no pase con un Pipeline vacío.
  assert.equal(
    cuerpo.total,
    partida.total + 1,
    'el total no contó al contacto nuevo, así que la suma cerraba por no tener nada que contar',
  );
})

// 2 · LO QUE SE RECHAZA NO ESCRIBE
// ═══════════════════════════════════════════════════════════════════════════════

test('la salida que PIDE MONTO se rechaza sin monto, y no deja ninguna fila', async () => {
  // La pantalla ya deshabilita el botón sin monto, y eso no alcanza: cualquiera llama a esto con una
  // herramienta de línea de comandos. Una venta sin monto pasaría como venta y el «cobrado» de
  // Inicio sumaría uno menos, sin que nada falle.
  //
  // Se recorre `pideMonto` del catálogo: son dos hoy —`venta` y `acuerdo_sin_pago`— y si mañana una
  // tercera lo pide, queda medida sin tocar esta prueba.
  const conMonto = SALIDAS_DEL_CLOSER.filter((s) => s.pideMonto);
  assert.ok(conMonto.length >= 2, 'el catálogo dejó de tener salidas con monto: revisar la prueba');

  for (const s of conMonto) {
    const k = await unContacto(esc, { nombre: `Avanzar sin monto ${s.salida}` });
    const r = await avanzar(
      pedirComo(`/api/contactos/${k.id}/avanzar`, esc.token, {
        metodo: 'POST',
        cuerpo: { salida: s.salida, nota: 'esta nota tampoco tiene que quedar' },
      }),
      ctxDe(k.id),
    );
    const { estado, cuerpo } = await leerRespuesta<RespuestaAvanzar>(r);
    assert.equal(estado, 400, `${s.salida}: ${JSON.stringify(cuerpo)}`);
    assert.equal(cuerpo.codigo, 'peticion_invalida');
    assert.match(cuerpo.detalle ?? '', /monto/i, `${s.salida}: el motivo no nombra el monto`);

    // Y LO QUE IMPORTA: que la tabla no creció. Un rechazo que igual escribe es peor que no validar,
    // porque deja una fila que nadie va a ir a buscar.
    const escrito = await loEscrito(esc.org, k.id);
    assert.deepEqual(escrito.resultados, [], `${s.salida}: el rechazo igual escribió el resultado`);
    assert.deepEqual(escrito.notas, [], `${s.salida}: el rechazo igual escribió la nota`);
    assert.equal(escrito.etapa, null, `${s.salida}: el rechazo igual movió la etapa`);
  }
});

test('un monto que no es un número, o negativo, se rechaza — y CERO se acepta', async () => {
  // Cero es un monto MEDIDO: una venta de cero pesos es raro y es un hecho, y confundirlo con «no
  // vino monto» es la misma confusión que la regla de `{ valor, falta }` persigue en los
  // indicadores. Por eso la validación es `n < 0` y no `!n`, que dejaría afuera al cero.
  for (const malo of ['no es un numero', -1, {}]) {
    const k = await unContacto(esc, { nombre: 'Avanzar monto malo' });
    const r = await avanzar(
      pedirComo(`/api/contactos/${k.id}/avanzar`, esc.token, {
        metodo: 'POST',
        cuerpo: { salida: 'venta', monto: malo },
      }),
      ctxDe(k.id),
    );
    const { estado, cuerpo } = await leerRespuesta<RespuestaAvanzar>(r);
    assert.equal(estado, 400, `monto ${JSON.stringify(malo)}: ${JSON.stringify(cuerpo)}`);
    assert.deepEqual((await loEscrito(esc.org, k.id)).resultados, []);
  }

  const cero = await unContacto(esc, { nombre: 'Avanzar monto cero' });
  const r = await avanzar(
    pedirComo(`/api/contactos/${cero.id}/avanzar`, esc.token, {
      metodo: 'POST',
      cuerpo: { salida: 'venta', monto: 0 },
    }),
    ctxDe(cero.id),
  );
  assert.equal(r.status, 201, await r.clone().text());
  const escrito = await loEscrito(esc.org, cero.id);
  // Y queda como CERO, no como `null`. Ésa es la diferencia entera: `null` en esta columna significa
  // «esta salida no pide monto», así que un cero convertido en nulo haría desaparecer una venta de
  // cero pesos del «cobrado» de Inicio en vez de sumarle cero.
  //
  // No se compara contra `'0.00'`: la columna es `numeric(12,2)` y devuelve dos decimales sea lo que
  // sea que se le mandó, así que esa comparación pasaría igual con el formateo roto — mide el tipo de
  // la columna, no el código. Lo que acá se mide es que el cero LLEGÓ.
  assert.notEqual(escrito.resultados[0]?.monto, null, 'un cero medido se guardó como «sin monto»');
  assert.equal(Number(escrito.resultados[0]?.monto), 0);
});

test('una salida INVENTADA se rechaza con un motivo legible, sin nombrar la base', async () => {
  // `ADR-0704`: ningún cuerpo de error lleva nombres de tablas ni de restricciones. Sin la
  // validación del catálogo, `'inventada'` llegaría al `insert` y el rechazo vendría del `check` de
  // `resultados.salida` — un `23514` que nombra la restricción y la tabla, y que quien lo recibe no
  // puede accionar.
  //
  // `'constructor'` está en la lista a propósito: es el defecto que `esSalidaDelCloser` documenta.
  // Con `salida in OBJETO` en vez de `some`, recorrer la cadena de prototipos lo dejaría pasar la
  // validación para después no encontrar ninguna definición.
  //
  // Y `'no_califica'` y `'agendo'` son salidas REALES del tipo `SalidaResultado` —están en
  // `ETAPA_DE_LA_SALIDA`— que NO son del closer. Validar contra el mapeo de etapas en vez de contra
  // `SALIDAS` las dejaría entrar: `agendo` mandaría al contacto a `agendado` y borraría el desenlace
  // que ya tenía.
  for (const mala of ['inventada', 'constructor', 'toString', 'no_califica', 'agendo', '', 42, null]) {
    const k = await unContacto(esc, { nombre: 'Avanzar salida mala' });
    const r = await avanzar(
      pedirComo(`/api/contactos/${k.id}/avanzar`, esc.token, {
        metodo: 'POST',
        cuerpo: { salida: mala, monto: 100 },
      }),
      ctxDe(k.id),
    );
    const { estado, cuerpo } = await leerRespuesta<RespuestaAvanzar>(r);
    assert.equal(estado, 400, `salida ${JSON.stringify(mala)}: ${JSON.stringify(cuerpo)}`);
    assert.equal(cuerpo.codigo, 'peticion_invalida', `salida ${JSON.stringify(mala)}`);

    /* ── DOS RECHAZOS DISTINTOS, Y SEPARARLOS ES EL PUNTO ──────────────────
     *
     * «eso no existe» y «eso existe pero no es de este contacto» mandan a mirar dos cosas distintas.
     * Colapsarlos haría que quien lee revise el nombre de la salida cuando el problema es el
     * territorio — y al revés.
     *
     * `no_califica` y `agendo` son salidas REALES: del setter. El contacto de esta prueba es del
     * closer, así que caen por territorio. Las otras seis no existen en ningún catálogo. */
    const detalle = cuerpo.detalle ?? '';
    const esDelSetter = mala === 'no_califica' || mala === 'agendo';
    assert.match(
      detalle,
      esDelSetter ? /no es de este contacto/i : /no es una salida de Avanzar/i,
      `salida ${JSON.stringify(mala)}: el motivo no distingue «no existe» de «no es de acá»`,
    );
    assert.doesNotMatch(
      detalle,
      /relation|column|constraint|violates|check|negocio\.|resultados_/i,
      'el motivo filtró estructura de la base: `ADR-0704`',
    );
    assert.deepEqual((await loEscrito(esc.org, k.id)).resultados, []);
  }
});

test('una fecha para volver imposible o pasada se rechaza, y no deja tarea ni resultado', async () => {
  // `2026-02-31` pasa la expresión `\d{4}-\d{2}-\d{2}` y `new Date` no lanza en todos los motores:
  // sin la comprobación de ida y vuelta, la tarea vencería en un día que no existe. Y una fecha ya
  // pasada crea un seguimiento que aparece vencido el día que se creó.
  for (const [dia, motivo] of [
    ['2026-02-31', /no se pudo leer/i],
    ['no-es-fecha', /no se pudo leer/i],
    ['2020-01-01', /ya pas/i],
  ] as const) {
    const k = await unContacto(esc, { nombre: 'Avanzar fecha mala' });
    const r = await avanzar(
      pedirComo(`/api/contactos/${k.id}/avanzar`, esc.token, {
        metodo: 'POST',
        // `manual` es el modo que USA la fecha. Con `automatico` el servidor la rechaza, y
        // tiene razon: la secuencia del CRM pone su propio calendario.
        cuerpo: { salida: 'seguimiento', modo: 'manual', volverEl: dia },
      }),
      ctxDe(k.id),
    );
    const { estado, cuerpo } = await leerRespuesta<RespuestaAvanzar>(r);
    assert.equal(estado, 400, `${dia}: ${JSON.stringify(cuerpo)}`);
    assert.match(cuerpo.detalle ?? '', motivo, `${dia}: el motivo no distingue la causa`);

    const escrito = await loEscrito(esc.org, k.id);
    assert.deepEqual(escrito.tareas, [], `${dia}: se creó la tarea igual`);
    assert.deepEqual(escrito.resultados, [], `${dia}: se registró el resultado igual`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · EL DÍA DEL SEGUIMIENTO NO SE CORRE
// ═══════════════════════════════════════════════════════════════════════════════

test('el día elegido llega a `tareas.vence_el` TAL CUAL, sin pasar por ninguna zona', async () => {
  // Está medido en `avanzar.ts`: pasando un `Date`, el controlador manda un instante con zona y
  // PostgreSQL lo convierte a día con la zona del servidor — un `2026-12-01T12:00:00Z` volvió como
  // `T05:00:00Z`, y con una hora cerca de la medianoche el DÍA cambia. El síntoma es una tarea que
  // aparece vencida el día que se creó, y nada falla.
  //
  // Se lee con un `::text` desde el cliente administrador a propósito: leerlo por el controlador lo
  // devolvería como `Date` y la conversión que se está midiendo volvería a esconderse.
  const k = await unContacto(esc, { nombre: 'Avanzar dia exacto' });
  const r = await avanzar(
    pedirComo(`/api/contactos/${k.id}/avanzar`, esc.token, {
      metodo: 'POST',
      cuerpo: { salida: 'seguimiento', modo: 'manual', volverEl: MANANA, nota: 'volver mañana' },
    }),
    ctxDe(k.id),
  );
  const { estado, cuerpo } = await leerRespuesta<RespuestaAvanzar>(r);
  assert.equal(estado, 201, JSON.stringify(cuerpo));
  assert.equal(cuerpo.tarea, true, 'la respuesta dice que no creó la tarea');

  const guardado = await esc.admin.query<{ dia: string; modo: string; situacion: string }>(
    'select vence_el::text as dia, modo, situacion from negocio.tareas where contacto_id = $1',
    [k.id],
  );
  assert.equal(guardado.rows.length, 1);
  assert.equal(guardado.rows[0]?.dia, MANANA, 'el día se corrió al guardarlo');
  // `manual` y no `automatico`: de esa distinción depende el contador de Mi Día, que cuenta lo que
  // necesita una persona y no las series automáticas.
  assert.equal(guardado.rows[0]?.modo, 'manual');
  assert.equal(guardado.rows[0]?.situacion, 'seguimiento');
});

test('una subcategoría que NO está en las opciones de esa salida se descarta, no se guarda', async () => {
  // `pildora.ts` muestra el detalle TAL CUAL viene. Un valor libre aceptado acá entra a la píldora
  // de un contacto real, así que la ruta lo baja a `null` en vez de guardarlo.
  const libre = await unContacto(esc, { nombre: 'Avanzar detalle libre' });
  await avanzar(
    pedirComo(`/api/contactos/${libre.id}/avanzar`, esc.token, {
      metodo: 'POST',
      cuerpo: { salida: 'venta', monto: 10, detalle: 'Trueque por dos vacas' },
    }),
    ctxDe(libre.id),
  );
  const conLibre = await loEscrito(esc.org, libre.id);
  assert.equal(conLibre.resultados[0]?.detalle, null, 'entró una subcategoría inventada');
  assert.equal(conLibre.resultados[0]?.forma_pago, null);

  // Y la del catálogo sí, y en las DOS columnas: la forma de pago es la subcategoría de la venta y
  // tiene columna propia porque una venta tiene tres piezas, no dos.
  const valida = await unContacto(esc, { nombre: 'Avanzar detalle valido' });
  await avanzar(
    pedirComo(`/api/contactos/${valida.id}/avanzar`, esc.token, {
      metodo: 'POST',
      cuerpo: { salida: 'venta', monto: 10, detalle: 'Cuotas' },
    }),
    ctxDe(valida.id),
  );
  const conValida = await loEscrito(esc.org, valida.id);
  assert.equal(conValida.resultados[0]?.detalle, 'Cuotas');
  assert.equal(conValida.resultados[0]?.forma_pago, 'Cuotas', 'la forma de pago no llegó a su columna');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · LA TRANSACCIÓN ES UNA
// ═══════════════════════════════════════════════════════════════════════════════

test('si la NOTA falla, no queda ni el resultado ni la etapa ni la tarea', async () => {
  // Las cuatro escrituras describen UN hecho: cómo terminó esta conversación. La que falle sola deja
  // a las otras tres afirmando algo incompleto — «una nota que no se guardó con una operación que
  // responde éxito es exactamente un éxito que no ocurrió».
  //
  // El fallo se provoca con un cuerpo que la ruta ACEPTA y la base no: un NUL (`U+0000`) es un
  // carácter válido en una cadena de JavaScript y `text` de PostgreSQL no lo admite —`22021`—. Es el
  // caso realista de esta clase: la validación del manejador mira el largo, no los bytes.
  //
  // El resultado y el `update` de la etapa corren ANTES de la nota, así que sin la transacción
  // quedarían escritos y el contacto se habría movido de columna por una operación que falló.
  const k = await unContacto(esc, { nombre: 'Avanzar nota imposible' });
  await assert.rejects(
    () =>
      avanzar(
        pedirComo(`/api/contactos/${k.id}/avanzar`, esc.token, {
          metodo: 'POST',
          cuerpo: { salida: 'venta', monto: 900, nota: NOTA_CON_NUL, volverEl: MANANA },
        }),
        ctxDe(k.id),
      ),
    /0x00|22021|invalid byte sequence/i,
    // DEFECTO DOCUMENTADO, no arreglado acá: el encabezado de la ruta de notas promete que «si la
    // escritura falla, la respuesta lo dice», y en este camino NO hay respuesta — el manejador
    // lanza. Lo que sale es un 500 sin `codigo`, que `ADR-0305` y `ADR-0704` no contemplan. La
    // atomicidad —lo que esta prueba mide— sí se cumple.
    'el manejador tendría que llegar a lanzar: sin fallo no hay atomicidad que medir',
  );

  const escrito = await loEscrito(esc.org, k.id);
  assert.deepEqual(escrito.resultados, [], 'el resultado sobrevivió al fallo de la nota');
  assert.deepEqual(escrito.notas, []);
  assert.deepEqual(escrito.tareas, [], 'la tarea sobrevivió al fallo de la nota');
  assert.equal(escrito.etapa, null, 'la etapa se movió por una operación que falló');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · EL CONTRATO DE LA RESPUESTA, y el CRM dicho APARTE
// ═══════════════════════════════════════════════════════════════════════════════

test('la respuesta trae `registrado`, la etapa, si hubo nota y tarea, y el aviso al CRM aparte', async () => {
  // El aviso al CRM NO se colapsa en el éxito general, y no es un detalle de implementación:
  // mientras la etiqueta no llegue, el CRM no disparó sus automatismos —el flujo de recuperación de
  // un no-show, por ejemplo— y quien registró tiene que poder saberlo. Colapsarlo sería reportar un
  // éxito a medias como completo.
  //
  // En esta base no hay credenciales de GoHighLevel cargadas, así que `crm.avisado` es `false` con su
  // motivo. Ése es justamente el caso que importa: **la operación igual devuelve 201**, porque el
  // orden es primero la base y después el CRM, y un fallo del segundo no invalida el primero. Si
  // esto respondiera 5xx, una organización sin CRM conectado no podría registrar nada.
  const k = await unContacto(esc, { nombre: 'Avanzar contrato' });
  const r = await avanzar(
    pedirComo(`/api/contactos/${k.id}/avanzar`, esc.token, {
      metodo: 'POST',
      cuerpo: { salida: 'no_show', detalle: 'Plantón sin aviso', nota: 'no apareció', volverEl: MANANA },
    }),
    ctxDe(k.id),
  );
  const { estado, cuerpo } = await leerRespuesta<RespuestaAvanzar>(r);
  assert.equal(estado, 201, JSON.stringify(cuerpo));
  assert.equal(cuerpo.registrado, true);
  assert.equal(cuerpo.salida, 'no_show');
  assert.equal(cuerpo.etapa, 'no_show');
  assert.equal(cuerpo.nota, true, '`nota: true` tiene que significar que la fila está');
  assert.equal(cuerpo.tarea, true);

  assert.ok(cuerpo.crm, 'el aviso al CRM no viaja en la respuesta: quien registró no puede saberlo');
  assert.equal(cuerpo.crm.avisado, false);
  assert.deepEqual(cuerpo.crm.etiquetas, [], 'dice que no avisó y a la vez lista etiquetas mandadas');
  assert.ok(
    (cuerpo.crm.porque ?? '').length > 0,
    '`avisado: false` sin motivo es un fallo que no se puede accionar',
  );

  // Y `nota: true` no puede ser una intención: la fila tiene que estar, con su autor.
  const escrito = await loEscrito(esc.org, k.id);
  assert.equal(escrito.notas.length, 1, '`nota: true` y la nota no está');
  assert.equal(escrito.notas[0]?.autor_id, esc.quien);
  // La nota viaja TAMBIÉN con el resultado: `resultados.nota` es lo que se dijo al registrar y
  // borrar la de `notas` no puede cambiarlo.
  assert.equal(escrito.resultados[0]?.nota, 'no apareció');
});

test('sin nota y sin fecha, `nota` y `tarea` vienen en `false` y no se escribe nada de eso', async () => {
  // OJO con el contrato: el comentario de `Registrado.nota` dice que `false` significa «se pidió y NO
  // se pudo». Medido, `false` significa **no se pidió** — cuando la escritura falla no hay respuesta
  // en absoluto, porque la transacción revierte y el manejador lanza (ver el bloque 4). Esta
  // aserción fija el comportamiento REAL, que es el que un cliente puede usar.
  const k = await unContacto(esc, { nombre: 'Avanzar sin extras' });
  const r = await avanzar(
    pedirComo(`/api/contactos/${k.id}/avanzar`, esc.token, {
      metodo: 'POST',
      cuerpo: { salida: 'nurture' },
    }),
    ctxDe(k.id),
  );
  const { estado, cuerpo } = await leerRespuesta<RespuestaAvanzar>(r);
  assert.equal(estado, 201, JSON.stringify(cuerpo));
  assert.equal(cuerpo.nota, false);
  assert.equal(cuerpo.tarea, false);

  const escrito = await loEscrito(esc.org, k.id);
  assert.deepEqual(escrito.notas, []);
  assert.deepEqual(escrito.tareas, []);
  assert.equal(escrito.resultados[0]?.nota, null);
});

test('un cuerpo que no es JSON se rechaza con su propio motivo, no con un 500', async () => {
  // Sin el `try` alrededor del `json()`, un cuerpo roto sale como error del motor y se lee como «el
  // servidor está mal» en vez de «lo que mandaste está mal».
  const k = await unContacto(esc, { nombre: 'Avanzar json roto' });
  // La petición se arma a mano y no con `pedirComo`: ése serializa el cuerpo con `JSON.stringify`, o
  // sea que por su camino es IMPOSIBLE mandar un cuerpo roto. Es el único caso del archivo que lo
  // necesita.
  const peticion = new Request(`https://${DOMINIO}/api/contactos/${k.id}/avanzar`, {
    method: 'POST',
    headers: {
      origin: `https://${DOMINIO}`,
      'content-type': 'application/json',
      cookie: `${COOKIE_SESION}=${esc.token}`,
    },
    body: '{ esto no es json',
  });
  const { estado, cuerpo } = await leerRespuesta<RespuestaAvanzar>(await avanzar(peticion, ctxDe(k.id)));
  assert.equal(estado, 400, JSON.stringify(cuerpo));
  assert.equal(cuerpo.codigo, 'peticion_invalida');
  assert.match(cuerpo.detalle ?? '', /JSON/i);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6 · ADR-0501 · UN CONTACTO DE OTRA EMPRESA NO EXISTE
// ═══════════════════════════════════════════════════════════════════════════════

test('las DOS rutas que ESCRIBEN responden 404 —nunca 403— sobre un contacto de otra empresa', async () => {
  // `ADR-0501`, la fila innegociable: 404 y no 403, porque **un 403 confirma que ese identificador
  // existe**. Es lo que el guardián que lee el archivo no puede cubrir: un `exigir` con la capacidad
  // correcta pasa igual, y lo que decide es que la consulta corra bajo la organización de la sesión.
  //
  // El GET de notas queda fuera de esta prueba a propósito: NO responde 404, y la prueba de acá abajo
  // documenta lo que hace de verdad.
  const ajeno = await unContacto(esc, { org: esc.otraOrg, nombre: 'Avanzar de beta' });

  // Que exista DE VERDAD en la otra organización. Sin esta comprobación, la prueba pasaría igual con
  // un identificador inventado y no mediría el aislamiento: mediría el 404 de siempre.
  const existe = await esc.admin.query('select 1 from negocio.contactos where id = $1', [ajeno.id]);
  assert.equal(existe.rowCount, 1, 'el contacto de la otra organización no se sembró');

  const casos: [string, Response][] = [
    [
      'avanzar',
      await avanzar(
        pedirComo(`/api/contactos/${ajeno.id}/avanzar`, esc.token, {
          metodo: 'POST',
          cuerpo: { salida: 'venta', monto: 999 },
        }),
        ctxDe(ajeno.id),
      ),
    ],
    [
      'notas POST',
      await escribirNota(
        pedirComo(`/api/contactos/${ajeno.id}/notas`, esc.token, {
          metodo: 'POST',
          cuerpo: { cuerpo: 'una nota en la empresa de otro' },
        }),
        ctxDe(ajeno.id),
      ),
    ],
  ];

  for (const [nombre, r] of casos) {
    const { estado, cuerpo } = await leerRespuesta<RespuestaNotas>(r);
    assert.equal(estado, 404, `${nombre}: ${JSON.stringify(cuerpo)}`);
    assert.equal(cuerpo.codigo, 'no_encontrado', `${nombre}`);
    // `ADR-0305`: un rechazo NO es una lista vacía. Un `{ notas: [] }` junto al 404 dejaría que la
    // pantalla dibujara «este contacto no tiene notas» sobre un rechazo.
    assert.equal(cuerpo.notas, undefined, `${nombre}: el rechazo trae una lista`);
  }

  // Y NADA se escribió del otro lado. El 404 podría venir de la comprobación previa mientras el
  // `insert` igual corrió: es la mitad que no se ve desde la respuesta.
  const enBeta = await loEscrito(esc.otraOrg, ajeno.id);
  assert.deepEqual(enBeta.resultados, [], 'se registró un resultado en la organización ajena');
  assert.deepEqual(enBeta.notas, [], 'se escribió una nota en la organización ajena');
  assert.equal(enBeta.etapa, null, 'se movió la etapa de un contacto de otra organización');
});

test('el GET de notas de un contacto ajeno responde 404, igual que un identificador inventado', async () => {
  // ══════════════════════════════════════════════════════════════════════
  // ESTA PRUEBA ERA UN DEFECTO MEDIDO, Y SE ARREGLÓ
  //
  // Su versión anterior se llamaba *«DEFECTO: … responde 200 con una lista VACÍA»* y pedía
  // `estado === 200` con esta nota al lado: *«si esto pasa a 404, el defecto se arregló y hay que
  // borrar esta prueba»*. No se borra — se da vuelta, que conserva el motivo escrito.
  //
  // El defecto era que el `POST` comprobaba que el contacto existiera en esta organización y el
  // `GET` no: llamaba derecho a `notasDeLaFicha(id)`, el aislamiento por fila devolvía cero notas, y
  // la ruta contestaba `200` con `{ notas: [], falta: null }`. Rompía dos reglas a la vez:
  //
  //   · `ADR-0501` — un recurso de otra organización **no existe**, y «no existe» es 404. El 404
  //     salía solo cuando el identificador estaba MAL FORMADO, o sea que la ruta distinguía «no es un
  //     uuid» de «no es tuyo» justo al revés de como hace falta.
  //   · `ADR-0305` y la regla del cero — `falta: null` afirma que el cero está MEDIDO: «este contacto
  //     no tiene ninguna nota». Sobre un contacto ajeno es una afirmación sobre datos que quien
  //     pregunta no puede ver, indistinguible de la verdadera.
  //
  // La cura es `existeElContacto` en `lib/negocio/ficha.ts`, compartida por las cuatro pestañas de
  // lectura — no una comprobación por ruta, que serían cuatro oportunidades de que una se quede sin
  // el `where`.
  // ══════════════════════════════════════════════════════════════════════
  const ajeno = await unContacto(esc, { org: esc.otraOrg, nombre: 'Avanzar de beta para leer' });
  // `autorId: null` no es un detalle: `notas` tiene clave foránea compuesta `(org_id, autor_id)`, y
  // quien mira es de `alfa`. Poner a esa persona como autora de una nota de `beta` es una fila que la
  // base rechaza — o sea que el sembrado por sí solo ya prueba que las dos empresas no se cruzan.
  await unaNota(esc, ajeno.id, {
    org: esc.otraOrg,
    autorId: null,
    origen: 'importada',
    cuerpo: 'nota que no tiene que verse',
  });

  const deAjeno = await leerRespuesta<RespuestaNotas>(
    await verNotas(pedirComo(`/api/contactos/${ajeno.id}/notas`, esc.token), ctxDe(ajeno.id)),
  );
  assert.equal(
    deAjeno.estado,
    404,
    'un contacto de otra organización volvió a responder 200: un cuerpo vacío con `falta: null` ' +
      'afirma que el cero está medido sobre datos que quien pregunta no puede ver',
  );
  assert.notEqual(deAjeno.estado, 403, 'un 403 confirma que el contacto existe');

  // Un uuid bien formado que no es de nadie responde LO MISMO. Es lo que impide que la ruta sea un
  // oráculo de existencia: si las dos respuestas se separaran, preguntar sería averiguar.
  const inventado = '11111111-2222-3333-4444-555555555555';
  const deInventado = await leerRespuesta<RespuestaNotas>(
    await verNotas(pedirComo(`/api/contactos/${inventado}/notas`, esc.token), ctxDe(inventado)),
  );
  assert.deepEqual(
    { estado: deAjeno.estado, cuerpo: deAjeno.cuerpo },
    { estado: deInventado.estado, cuerpo: deInventado.cuerpo },
    'un contacto ajeno y uno inexistente tienen que responder EXACTAMENTE lo mismo',
  );

  // Y lo que nunca pudo pasar y sigue sin poder: la nota ajena no viaja.
  assert.equal(
    JSON.stringify(deAjeno.cuerpo).includes('nota que no tiene que verse'),
    false,
    'la nota de la otra organización se devolvió',
  );
});

test('un identificador mal formado sí es 404, no 400', async () => {
  // Distinguirlo sería un oráculo más débil y es gratis de cerrar: con un 400 acá, quien prueba
  // identificadores aprende cuáles tienen forma válida. Es el único 404 que el GET de notas da hoy —
  // ver el defecto de arriba.
  for (const malo of ['no-es-uuid', '123', '00000000-0000-0000-0000-00000000000']) {
    for (const [nombre, r] of [
      ['notas GET', await verNotas(pedirComo(`/api/contactos/${malo}/notas`, esc.token), ctxDe(malo))],
      [
        'avanzar',
        await avanzar(
          pedirComo(`/api/contactos/${malo}/avanzar`, esc.token, {
            metodo: 'POST',
            cuerpo: { salida: 'venta', monto: 1 },
          }),
          ctxDe(malo),
        ),
      ],
    ] as const) {
      assert.equal(r.status, 404, `${nombre} con "${malo}"`);
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7 · LAS NOTAS — la fila real, con su identificador y su autor
// ═══════════════════════════════════════════════════════════════════════════════

test('el POST devuelve la fila REAL —identificador, fecha y autor— y el GET la trae', async () => {
  // Los tres defectos apilados del `04` § 4, y el que la verificación en el navegador encontró
  // después: sin el identificador de verdad, la nota optimista y la guardada no se pueden atar y la
  // recarga siguiente la duplica o la borra; y sin `autor`, la nota recién escrita apareció firmada
  // por **`Sistema`**, porque el cliente no tenía con qué llenar el autor y `null` significa «la
  // importó el sistema».
  //
  // El autor lo manda el SERVIDOR y no lo pone la pantalla desde su sesión: el autor de la fila es
  // el que se guardó, y que las dos cosas coincidan no puede depender de que el cliente elija bien.
  const k = await unContacto(esc, { nombre: 'Avanzar notas ida y vuelta' });

  const r = await escribirNota(
    pedirComo(`/api/contactos/${k.id}/notas`, esc.token, {
      metodo: 'POST',
      cuerpo: { cuerpo: '  Pidió que lo llamemos el lunes  ' },
    }),
    ctxDe(k.id),
  );
  const { estado, cuerpo } = await leerRespuesta<RespuestaNotas>(r);
  assert.equal(estado, 201, JSON.stringify(cuerpo));
  assert.equal(cuerpo.creada, true);
  assert.match(cuerpo.id ?? '', UUID, 'sin identificador real el cliente no puede fusionar');
  assert.ok(cuerpo.creadoEl, 'falta la fecha de la base');
  assert.ok(
    typeof cuerpo.autor === 'string' && cuerpo.autor.length > 0,
    'sin `autor` la nota recién escrita se dibuja firmada por Sistema',
  );

  // El identificador devuelto es el de la FILA, no uno inventado para el cliente.
  const escrito = await loEscrito(esc.org, k.id);
  assert.equal(escrito.notas.length, 1);
  assert.equal(escrito.notas[0]?.id, cuerpo.id, 'el identificador devuelto no es el de la fila');
  assert.equal(escrito.notas[0]?.cuerpo, 'Pidió que lo llamemos el lunes', 'el cuerpo no se recortó');
  assert.equal(escrito.notas[0]?.autor_id, esc.quien);
  assert.equal(escrito.notas[0]?.origen, 'plataforma', 'una nota escrita acá no es «importada»');

  // Y EL GET LA TRAE. Es el defecto del `04` § 4: la nota se escribía por un camino y se leía por
  // otro, así que aparecía en un lado y no en el otro.
  const leida = await leerRespuesta<RespuestaNotas>(
    await verNotas(pedirComo(`/api/contactos/${k.id}/notas`, esc.token), ctxDe(k.id)),
  );
  assert.equal(leida.estado, 200);
  const suya = leida.cuerpo.notas?.find((n) => n.id === cuerpo.id);
  assert.ok(suya, 'la nota escrita por el POST no la devuelve el GET');
  assert.equal(suya.cuerpo, 'Pidió que lo llamemos el lunes');
  assert.equal(
    suya.autor,
    cuerpo.autor,
    'el autor que devolvió el POST y el que devuelve el GET no coinciden: uno de los dos miente',
  );
});

test('una nota con `autorId: null` se lee como del SISTEMA, no como de quien mira', async () => {
  // Es el `04` § 3: atribuirle a alguien algo que no hizo es lo que vuelve inútil el historial. El
  // endpoint de notas de GoHighLevel devuelve cuerpo y fecha, **no autor**, así que rellenarlo con
  // quien está mirando convertiría «no sabemos quién la escribió» en «la escribió Ana».
  //
  // Y hay un segundo modo de falla que esto atrapa: con un `join` interno en vez de externo la nota
  // importada **desaparece de la lista**, sin error. Por eso se cuentan las dos.
  const k = await unContacto(esc, { nombre: 'Avanzar notas del sistema' });
  const delSistema = await unaNota(esc, k.id, {
    cuerpo: 'Importada del CRM',
    autorId: null,
    origen: 'importada',
  });
  const deAna = await unaNota(esc, k.id, { cuerpo: 'Escrita acá' });

  const { estado, cuerpo } = await leerRespuesta<RespuestaNotas>(
    await verNotas(pedirComo(`/api/contactos/${k.id}/notas`, esc.token), ctxDe(k.id)),
  );
  assert.equal(estado, 200);
  assert.equal(cuerpo.notas?.length, 2, 'la nota sin autor desapareció: el `join` tiene que ser externo');

  const importada = cuerpo.notas?.find((n) => n.id === delSistema);
  const propia = cuerpo.notas?.find((n) => n.id === deAna);
  assert.ok(importada && propia);
  assert.equal(importada.autor, null, 'se le atribuyó una nota importada a una persona');
  assert.equal(importada.origen, 'importada', 'sin `origen`, un autor nulo tendría dos significados');
  assert.ok(
    typeof propia.autor === 'string' && propia.autor.length > 0,
    'la nota que SÍ tiene autor se quedó sin nombre',
  );
  assert.notEqual(importada.autor, propia.autor);
});

test('cero notas es un cero MEDIDO: lista vacía y `falta: null`', async () => {
  // La única de las cinco pestañas donde el vacío es un hecho: la tabla la puebla esta misma
  // aplicación. Un `falta` con texto acá haría que la ficha dijera «no hay datos» sobre un contacto
  // que de verdad no tiene ninguna nota — que es el error espejo del que `{ valor, falta }` persigue.
  const k = await unContacto(esc, { nombre: 'Avanzar notas vacias' });
  const { estado, cuerpo } = await leerRespuesta<RespuestaNotas>(
    await verNotas(pedirComo(`/api/contactos/${k.id}/notas`, esc.token), ctxDe(k.id)),
  );
  assert.equal(estado, 200);
  assert.deepEqual(cuerpo.notas, []);
  assert.equal(cuerpo.falta, null, 'cero notas medidas no es una pieza que falte');
});

test('el GET devuelve las notas de la MÁS NUEVA a la más vieja', async () => {
  // Es el orden con el que se lee un hilo: lo último que pasó, arriba. Al revés, la nota que alguien
  // acaba de escribir queda al final de una lista larga y parece que no se guardó.
  //
  // Las fechas se fijan a mano porque tres inserciones seguidas caen en el mismo instante con la
  // resolución que importa, y entonces el orden lo decidiría el desempate y no la fecha.
  const k = await unContacto(esc, { nombre: 'Avanzar notas orden' });
  const dias = [
    ['vieja', '2026-01-01T10:00:00Z'],
    ['nueva', '2026-03-01T10:00:00Z'],
    ['media', '2026-02-01T10:00:00Z'],
  ] as const;
  for (const [texto, cuando] of dias) {
    const id = await unaNota(esc, k.id, { cuerpo: texto });
    await esc.admin.query('update negocio.notas set creado_el = $2 where id = $1', [id, cuando]);
  }

  const { cuerpo } = await leerRespuesta<RespuestaNotas>(
    await verNotas(pedirComo(`/api/contactos/${k.id}/notas`, esc.token), ctxDe(k.id)),
  );
  assert.deepEqual(cuerpo.notas?.map((n) => n.cuerpo), ['nueva', 'media', 'vieja']);
});

test('una nota vacía o demasiado larga se rechaza, y no escribe nada', async () => {
  // Una nota en blanco no es una nota: guardarla mete una fila que no dice nada en el único hilo del
  // contacto. Y el tope es el MISMO que el de Avanzar —4000— porque es la misma tabla: dos topes
  // distintos harían que la nota de Avanzar entrara y la de la pestaña no.
  const k = await unContacto(esc, { nombre: 'Avanzar notas invalidas' });

  for (const [texto, motivo] of [
    ['', /vac[íi]a/i],
    ['     ', /vac[íi]a/i],
    ['x'.repeat(4001), /4000|no puede pasar/i],
  ] as const) {
    const { estado, cuerpo } = await leerRespuesta<RespuestaNotas>(
      await escribirNota(
        pedirComo(`/api/contactos/${k.id}/notas`, esc.token, { metodo: 'POST', cuerpo: { cuerpo: texto } }),
        ctxDe(k.id),
      ),
    );
    assert.equal(estado, 400, JSON.stringify(cuerpo));
    assert.equal(cuerpo.codigo, 'peticion_invalida');
    assert.match(cuerpo.detalle ?? '', motivo);
  }

  // Y el cuerpo que no es texto en absoluto, que es el que un cliente equivocado manda.
  for (const raro of [42, null, { cuerpo: 'anidado' }, ['una', 'lista']]) {
    const { estado } = await leerRespuesta<RespuestaNotas>(
      await escribirNota(
        pedirComo(`/api/contactos/${k.id}/notas`, esc.token, { metodo: 'POST', cuerpo: { cuerpo: raro } }),
        ctxDe(k.id),
      ),
    );
    assert.equal(estado, 400, `cuerpo ${JSON.stringify(raro)}`);
  }

  assert.deepEqual((await loEscrito(esc.org, k.id)).notas, [], 'un rechazo escribió la nota igual');
});

test('la nota de AVANZAR se lee por la pestaña Notas: una tabla, un camino', async () => {
  // El `04` § 4 lo llama «el defecto que costó más caro de toda la ficha»: la nota se escribía en
  // otra tabla según por qué camino se registrara, así que aparecía en un lado y no en el otro. De
  // trece resultados con nota, solo dos llegaron a la tabla.
  //
  // Ésta es la aserción que ata los dos endpoints: se escribe por Avanzar y se lee por Notas. Cada
  // uno probado por su lado pasaría igual con dos tablas distintas.
  const k = await unContacto(esc, { nombre: 'Avanzar nota compartida' });
  await avanzar(
    pedirComo(`/api/contactos/${k.id}/avanzar`, esc.token, {
      metodo: 'POST',
      // Sin fecha, asi que el modo es `automatico`: lo persigue la secuencia del CRM. `manual`
      // sin dia se rechaza, porque no habria dia que poner en Mi Dia.
      cuerpo: {
        salida: 'seguimiento',
        modo: 'automatico',
        nota: 'Dijo que lo consulta con la socia',
      },
    }),
    ctxDe(k.id),
  );

  const { cuerpo } = await leerRespuesta<RespuestaNotas>(
    await verNotas(pedirComo(`/api/contactos/${k.id}/notas`, esc.token), ctxDe(k.id)),
  );
  const suya = cuerpo.notas?.find((n) => n.cuerpo === 'Dijo que lo consulta con la socia');
  assert.ok(suya, 'la nota de Avanzar no se ve en la pestaña Notas');
  assert.ok(suya.autor, 'la nota de Avanzar se ve como importada por el sistema');
  assert.equal(suya.origen, 'plataforma');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8 · LAS TRES OPERACIONES PASAN POR EL PORTERO DE VERDAD
// ═══════════════════════════════════════════════════════════════════════════════

test('sin sesión válida Avanzar y las Notas responden 401 `sin_sesion`, y no escriben nada', async () => {
  /* Las veintiuna pruebas de arriba mandan la sesión de la administradora de `alfa`: ninguna llega a
   * la rama de RECHAZO del portero. Se comprobó mutándolo —cambiando el código de `sin_sesion` en
   * `portero.ts`— y las veintidós seguían verdes, igual que en el `93`, el `94`, el `95` y el `96`.
   * O sea: estas rutas podrían perder su `exigir` y este archivo no lo notaría. El guardia de
   * `pruebas/codigo/` ve la línea escrita y no la ejecuta, que es la premisa del encabezado.
   *
   * Y son las dos rutas que ESCRIBEN. Sin puerta, un Avanzar anónimo registra una venta con su monto
   * a nombre de nadie, mueve al contacto de columna y le crea un seguimiento — y las tres cosas se
   * ven exactamente igual que si las hubiera hecho una persona. Por eso se comprueban las dos
   * mitades: el código y la base. */
  const k = await unContacto(esc, { nombre: 'Avanzar sin sesion' });
  const sinSesion = 'esta-sesion-no-existe';

  const avanzado = await leerRespuesta<RespuestaAvanzar>(
    await avanzar(
      pedirComo(`/api/contactos/${k.id}/avanzar`, sinSesion, {
        metodo: 'POST',
        cuerpo: { salida: 'venta', monto: 5000, nota: 'una venta de nadie', volverEl: MANANA },
      }),
      ctxDe(k.id),
    ),
  );
  assert.equal(avanzado.estado, 401, `Avanzar contestó ${avanzado.estado} sin sesión`);
  assert.equal(avanzado.cuerpo.codigo, 'sin_sesion', 'el código es lo que manda al login');
  assert.equal(avanzado.cuerpo.registrado, undefined, 'el rechazo dice que registró algo');

  const leidas = await leerRespuesta<RespuestaNotas>(
    await verNotas(pedirComo(`/api/contactos/${k.id}/notas`, sinSesion), ctxDe(k.id)),
  );
  assert.equal(leidas.estado, 401, `el GET de notas contestó ${leidas.estado} sin sesión`);
  assert.equal(leidas.cuerpo.codigo, 'sin_sesion');
  // `ADR-0305`: el rechazo NO es una lista vacía. Y acá importa doble, porque el GET de notas ya
  // devuelve `{ notas: [] }` con 200 para un contacto ajeno (ver el DEFECTO de más arriba): si
  // también lo hiciera sin sesión, «no hay notas» y «no tenés permiso» serían la misma pantalla.
  assert.equal(leidas.cuerpo.notas, undefined, 'el rechazo trae una lista de notas');

  const escrita = await leerRespuesta<RespuestaNotas>(
    await escribirNota(
      pedirComo(`/api/contactos/${k.id}/notas`, sinSesion, {
        metodo: 'POST',
        cuerpo: { cuerpo: 'una nota de nadie' },
      }),
      ctxDe(k.id),
    ),
  );
  assert.equal(escrita.estado, 401, `el POST de notas contestó ${escrita.estado} sin sesión`);
  assert.equal(escrita.cuerpo.codigo, 'sin_sesion');

  const nada = await loEscrito(esc.org, k.id);
  assert.deepEqual(nada.resultados, [], 'se registró un resultado sin ninguna sesión');
  assert.deepEqual(nada.notas, [], 'se escribió una nota sin ninguna sesión');
  assert.deepEqual(nada.tareas, [], 'se creó un seguimiento sin ninguna sesión');
  assert.equal(nada.etapa, null, 'se movió la etapa sin ninguna sesión');
});

test('ADR-0306 · sin `origin`, Avanzar rechaza y no escribe: es la operación que más cuesta', async () => {
  /* El otro paso del portero que este archivo no ejercitaba. `SameSite=Lax` es una defensa del
   * NAVEGADOR, no del servidor, y sin la comprobación de origen un formulario en otro sitio con la
   * cookie de la sesión adentro registra una venta con su monto a nombre de quien esté conectado.
   *
   * La petición se arma a mano porque `pedirComo` siempre pone el `origin` — el mismo motivo por el
   * que la prueba del JSON roto también lo hace: por su camino el caso es imposible de construir. */
  const k = await unContacto(esc, { nombre: 'Avanzar sin origen' });
  const sinOrigen = new Request(`https://${DOMINIO}/api/contactos/${k.id}/avanzar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `${COOKIE_SESION}=${esc.token}` },
    body: JSON.stringify({ salida: 'venta', monto: 7000 }),
  });

  const { estado, cuerpo } = await leerRespuesta<RespuestaAvanzar>(await avanzar(sinOrigen, ctxDe(k.id)));
  assert.equal(estado, 403, `sin \`origin\` contestó ${estado}`);
  assert.equal(
    cuerpo.codigo,
    'origen_no_permitido',
    'el código tiene que ser propio: no es un permiso que falta, es una petición que no vino de acá',
  );
  const nada = await loEscrito(esc.org, k.id);
  assert.deepEqual(nada.resultados, [], 'una petición de otro sitio registró la venta igual');
  assert.equal(nada.etapa, null);
});


// ═══════════════════════════════════════════════════════════════════════════════
// LOS DOS MODOS DE UN SEGUIMIENTO — y antes no existía ninguno
// ═══════════════════════════════════════════════════════════════════════════════

test('el modo AUTOMÁTICO manda la etiqueta al CRM y NO escribe ninguna tarea', async () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // ESTO NO EXISTÍA, Y EL ÍCONO ⏱ DEPENDÍA DE UNA ETIQUETA QUE NADIE ESCRIBÍA
  //
  // `Avanzar` no tenía ningún selector de modo: el escritor cableaba `modo: 'manual'`. Y
  // `seguimiento_recupero` —la etiqueta que dispara la secuencia de correos de la subcuenta y que
  // enciende el ícono ⏱ de la fila— figuraba en el contrato como `confirmado` y **solo se leía**.
  // Cero escritores en todo el repositorio.
  //
  // O sea que el ícono se encendía por una etiqueta que solo podía llegar de afuera, y el modo que
  // se pidió —*«enviar la etiqueta correspondiente a GHL con ese contacto pues ahí se activa una
  // secuencia de correos»*— no se podía elegir.
  // ═══════════════════════════════════════════════════════════════════════════
  const k = await unContacto(esc, { nombre: 'Seguimiento automatico' });

  const r = await avanzar(
    pedirComo(`/api/contactos/${k.id}/avanzar`, esc.token, {
      metodo: 'POST',
      cuerpo: { salida: 'seguimiento', modo: 'automatico', detalle: 'Muy interesado' },
    }),
    ctxDe(k.id),
  );
  const { estado, cuerpo } = await leerRespuesta<RespuestaAvanzar>(r);
  assert.equal(estado, 201, JSON.stringify(cuerpo));

  // 1 · NO se escribió tarea. Es la mitad que hace que no aparezca en Mi Día.
  assert.equal(
    cuerpo.tarea,
    false,
    'el modo automático escribió una tarea: el contacto va a aparecer en Mi Día como algo que una ' +
      'persona tiene que hacer, cuando lo persigue la secuencia del CRM',
  );
  const tareas = await esc.admin.query(
    'select count(*)::int as n from negocio.tareas where contacto_id = $1',
    [k.id],
  );
  assert.equal(tareas.rows[0]?.n, 0, 'quedó una fila en `negocio.tareas`');

  /* 2 · Y la etiqueta del modo está entre las que le corresponden a este resultado.
   *
   * Se pregunta a `etiquetasDelResultado` y NO a `cuerpo.crm.etiquetas`, y el motivo es que en esta
   * base no hay credenciales de GoHighLevel: `avisarAlCrm` corta al resolverlas y devuelve la lista
   * vacía **antes de llegar a decidir nada**. Afirmar sobre esa lista vacía sería una prueba que
   * pasa cuando la decisión está mal.
   *
   * Por eso la decisión vive en una función pura del contrato, que es lo que se interroga acá. */
  /* La etiqueta se LEE DEL CATÁLOGO, no se repite acá. Escrita a mano, una mutación del catálogo
     —ponerle al modo manual la etiqueta de la serie automática— sobrevivía: la prueba seguía
     preguntando por el literal correcto y pasaba. Lo que se quiere probar es el catálogo. */
  const elAutomatico = modoDe('closer', 'seguimiento', 'automatico');
  assert.equal(
    elAutomatico?.etiqueta,
    'seguimiento_recupero',
    'el modo automático cambió de etiqueta: es la que dispara la secuencia de correos de la subcuenta',
  );
  const delAutomatico = etiquetasDelResultado('seguimiento', elAutomatico?.etiqueta);
  assert.ok(
    delAutomatico.includes('seguimiento_recupero'),
    `las etiquetas de este resultado son ${JSON.stringify(delAutomatico)}: falta la que dispara la ` +
      'secuencia, así que el CRM no persigue a nadie y la aplicación tampoco',
  );
  assert.ok(delAutomatico.includes('seguimiento'), 'falta la etiqueta de la salida');
  // Y la ruta dice por qué no avisó, en vez de callarse: no hay token en esta base.
  assert.equal(cuerpo.crm?.avisado, false);
  assert.ok((cuerpo.crm?.porque ?? '').length > 0, 'no avisó y no dice por qué');
});

test('el modo MANUAL escribe la tarea y le dice al CRM que NO persiga', async () => {
  // La otra mitad, y la etiqueta importa tanto como la tarea: `seguimiento_manual` significa
  // *«ninguna serie: lo retoma un humano»* según el contrato. Tampoco la escribía nadie, así que un
  // seguimiento que una persona se asignaba dejaba al CRM libre de perseguir a ese contacto igual.
  const k = await unContacto(esc, { nombre: 'Seguimiento manual' });

  const r = await avanzar(
    pedirComo(`/api/contactos/${k.id}/avanzar`, esc.token, {
      metodo: 'POST',
      cuerpo: { salida: 'seguimiento', modo: 'manual', volverEl: MANANA, detalle: 'Dudando' },
    }),
    ctxDe(k.id),
  );
  const { estado, cuerpo } = await leerRespuesta<RespuestaAvanzar>(r);
  assert.equal(estado, 201, JSON.stringify(cuerpo));

  assert.equal(cuerpo.tarea, true, 'el modo manual no escribió la tarea');
  const tareas = await esc.admin.query<{ modo: string; dia: string }>(
    `select modo, to_char(vence_el, 'YYYY-MM-DD') as dia
       from negocio.tareas where contacto_id = $1`,
    [k.id],
  );
  assert.equal(tareas.rows.length, 1);
  assert.equal(tareas.rows[0]?.modo, 'manual');
  assert.equal(tareas.rows[0]?.dia, MANANA, 'el día se corrió al guardarlo');

  // Igual que arriba: la decisión se interroga en la función pura, y la etiqueta sale del catálogo.
  const elManual = modoDe('closer', 'seguimiento', 'manual');
  assert.equal(
    elManual?.etiqueta,
    'seguimiento_manual',
    'el modo manual cambió de etiqueta: la suya le dice al CRM que NO persiga',
  );
  assert.notEqual(
    elManual?.etiqueta,
    modoDe('closer', 'seguimiento', 'automatico')?.etiqueta,
    'los dos modos mandan la MISMA etiqueta, y son opuestos: uno pide que el CRM persiga y el otro ' +
      'que no. Con la misma, elegir «Lo retomo yo» le pediría al CRM que persiga igual',
  );
  const delManual = etiquetasDelResultado('seguimiento', elManual?.etiqueta);
  assert.ok(
    delManual.includes('seguimiento_manual'),
    `las etiquetas de este resultado son ${JSON.stringify(delManual)}: sin \`seguimiento_manual\` el ` +
      'CRM queda libre de perseguir a alguien que una persona ya se asignó',
  );
  // Y los dos modos NO mandan lo mismo, que es el punto de que haya dos.
  assert.ok(
    !delManual.includes('seguimiento_recupero'),
    'el modo manual manda la etiqueta de la serie automática: le pide al CRM que persiga a alguien ' +
      'que una persona se acaba de asignar',
  );
});

test('las tres combinaciones imposibles se RECHAZAN, y ninguna se acepta en silencio', async () => {
  // Aceptar y no hacer nada es la clase de defecto que este endpoint persigue en las etiquetas
  // —*«escribir una etiqueta que no existe se responde con éxito y no hace nada»*— y valdría igual
  // acá: un cuerpo que pide algo imposible tiene que enterarse.
  const k = await unContacto(esc, { nombre: 'Seguimiento imposible' });
  const llamar = (cuerpo: Record<string, unknown>) =>
    avanzar(
      pedirComo(`/api/contactos/${k.id}/avanzar`, esc.token, { metodo: 'POST', cuerpo }),
      ctxDe(k.id),
    );

  // 1 · Una salida CON modos que no manda ninguno. No hay valor por omisión posible: los dos hacen
  //     cosas disjuntas, y elegir por quien registra sería decidir si a esa persona la persigue un
  //     robot.
  const sinModo = await leerRespuesta(await llamar({ salida: 'seguimiento' }));
  assert.equal(sinModo.estado, 400, 'un seguimiento sin modo se aceptó');

  // 2 · Un modo que no existe.
  const inventado = await leerRespuesta(await llamar({ salida: 'seguimiento', modo: 'telepatia' }));
  assert.equal(inventado.estado, 400, 'un modo inventado se aceptó');

  // 3 · La combinación imposible, en las DOS direcciones.
  const manualSinDia = await leerRespuesta(await llamar({ salida: 'seguimiento', modo: 'manual' }));
  assert.equal(manualSinDia.estado, 400, '`manual` sin fecha se aceptó: no hay día que poner en Mi Día');

  const autoConDia = await leerRespuesta(
    await llamar({ salida: 'seguimiento', modo: 'automatico', volverEl: MANANA }),
  );
  assert.equal(
    autoConDia.estado,
    400,
    '`automatico` CON fecha se aceptó: se guardaría un día que nadie va a usar, que es exactamente ' +
      'el «se guardó y no hizo nada» que este endpoint evita en las etiquetas',
  );

  // Y NADA quedó escrito por ninguno de los cuatro rechazos.
  const quedo = await esc.admin.query(
    `select (select count(*) from negocio.resultados where contacto_id = $1)::int as r,
            (select count(*) from negocio.tareas     where contacto_id = $1)::int as t`,
    [k.id],
  );
  assert.deepEqual({ r: quedo.rows[0]?.r, t: quedo.rows[0]?.t }, { r: 0, t: 0 });
});

test('una salida SIN modos que manda uno también se rechaza', async () => {
  // La simetría del punto 2, y no es lo mismo que ignorarlo: un cliente que manda un modo cree que
  // eligió algo. Cinco de las seis salidas no tienen modos, y aceptar un campo que no hace nada es
  // dejar que alguien crea que configuró algo.
  const k = await unContacto(esc, { nombre: 'No-show con modo' });
  const r = await avanzar(
    pedirComo(`/api/contactos/${k.id}/avanzar`, esc.token, {
      metodo: 'POST',
      cuerpo: { salida: 'no_show', modo: 'automatico' },
    }),
    ctxDe(k.id),
  );
  const { estado } = await leerRespuesta(r);
  assert.equal(estado, 400, 'un no-show con modo se aceptó, y el modo no habría hecho nada');
});
