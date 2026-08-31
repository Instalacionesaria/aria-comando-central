// EL CAMINO COMPLETO del auditor, y EL MOTIVO EN LA COLA ROJA. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL CIERRE DE LA ETAPA, EN UNA FRASE
//
// **Un análisis rojo hace que la cola de urgentes muestre su frase concreta en vez del texto de
// reserva, en los dos territorios, sin tocar ni una línea de las vistas.**
//
// Hasta acá `lib/negocio/colas.ts` decía siempre lo mismo —*«Requiere intervención: revisar la
// conversación»*— y su comentario explicaba por qué: la tabla de hallazgos existía **sin un lector ni
// un escritor**, así que el texto de reserva era el 100 % de los casos.
//
// ── LA COSTURA DEL MODELO ES LO QUE HACE POSIBLE ESTE ARCHIVO ───────────────
//
// `auditarEmpresa` recibe la llamada al modelo como parámetro. Sin eso, probar este camino exigiría
// gastar plata de la cuenta de la empresa en cada corrida de la suite — o sea que no habría prueba, y
// el camino que decide todo el gasto del módulo sería el único sin cubrir.
//
// Y la costura mide algo más que el camino feliz: **cuántas veces se llamó**. Es lo que convierte «el
// antirrebote funciona» en una afirmación con un número.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { limpiar, montar, unContacto, unMensaje, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { auditarEmpresa, TOPE_DE_FALLOS, type PedirVeredicto } from '../../lib/auditor/analisis.ts';
import { guardarPromptDelAgente } from '../../lib/auditor/prompts.ts';
import type { VeredictoDelModelo } from '../../lib/auditor/esquema.ts';
import { nucleoDeColas, SIN_MOTIVO } from '../../lib/negocio/colas.ts';
import { UMBRAL_DEL_DEBOUNCE } from '../../lib/auditor/portones.ts';

let esc: Escenario;

/** El identificador del agente en el CRM, con la forma real de GoHighLevel. */
const AGENTE_CRM = '0peGoq7VvFqnDGA7gxtX';
const AHORA = new Date('2026-08-31T15:00:00.000Z');
const hace = (min: number): Date => new Date(AHORA.getTime() - min * 60_000);

/** La empresa, resuelta. */
const EMPRESA = () => ({
  orgId: esc.org,
  zona: 'America/Lima',
  auditorActivo: true,
  claveIa: 'una-clave-que-nunca-se-usa',
  idDelAgente: AGENTE_CRM,
  /* Sin token: estas pruebas no llaman al CRM. Marcar una intervención sale como `sin_token_de_crm`,
     que es el caso real de cuatro de las cinco empresas de producción. */
  tokenDelCrm: null,
});

before(async () => {
  esc = await montar('Camino');
});
after(async () => {
  await limpio();
  await esc.admin.query('delete from negocio.prompts_del_agente');
  await cerrarTodo();
  await cerrarClientes();
});

async function limpio(): Promise<void> {
  const marca = `${esc.marca.toLowerCase()}-%`;
  const dentro = `select id from negocio.contactos where ghl_contact_id like $1`;
  await esc.admin.query(`delete from negocio.hallazgos where contacto_id in (${dentro})`, [marca]);
  await esc.admin.query(
    `delete from negocio.analisis_del_agente where contacto_id in (${dentro})`,
    [marca],
  );
  await esc.admin.query(`delete from negocio.ingesta_pulso where clave = 'auditoria'`);
  await limpiar(esc);
}

/** Un contacto con `cuantos` mensajes ATRIBUIBLES al agente, y uno del contacto. */
async function unaConversacion(campos: {
  cuantos?: number;
  territorio?: string;
  etiquetas?: string[];
  nombre?: string;
  /** Cuando es `true`, los salientes van SIN el id del agente: son automatizaciones. */
  comoAutomatizacion?: boolean;
} = {}): Promise<string> {
  const k = await unContacto(esc, {
    territorio: campos.territorio ?? 'closer',
    etiquetas: campos.etiquetas ?? ['bot_activado_appflow'],
    nombre: campos.nombre ?? `${esc.marca} conversación`,
  });
  const cuantos = campos.cuantos ?? UMBRAL_DEL_DEBOUNCE + 1;
  // Dos entrantes: la precondición exige al menos dos intercambios reales.
  await unMensaje(esc, k.id, { direccion: 'entrante', autor: 'contacto', enviadoEl: hace(90) });
  await unMensaje(esc, k.id, { direccion: 'entrante', autor: 'contacto', enviadoEl: hace(80) });
  for (let i = 0; i < cuantos; i++) {
    await esc.admin.query(
      `update negocio.mensajes set autor_ghl_usuario_id = $2 where id = $1`,
      [
        await unMensaje(esc, k.id, {
          direccion: 'saliente',
          autor: 'agente',
          enviadoEl: hace(70 - i),
        }),
        campos.comoAutomatizacion === true ? null : AGENTE_CRM,
      ],
    );
  }
  return k.id;
}

/** Un veredicto rojo, con su frase concreta. */
function rojo(motivo: string): VeredictoDelModelo {
  return {
    auditable: true,
    no_auditable_motivo: null,
    resumen: 'El contacto pidió hablar con una persona y el agente siguió el guion.',
    intervencion: { requerida: true, motivo },
    nivel: 'rojo',
    criterio: 'insiste_sin_entender',
    destacado: null,
    evidencia: null,
    sentimiento: 'molesto',
    observaciones: [],
    hallazgos: [],
  };
}

/** Un veredicto verde, prolijo. */
function verde(): VeredictoDelModelo {
  return {
    auditable: true,
    no_auditable_motivo: null,
    resumen: 'El agente confirmó la cita y respondió las dudas.',
    intervencion: { requerida: false, motivo: null },
    nivel: 'verde',
    criterio: 'ninguno',
    destacado: 'Confirmó la hora exacta.',
    evidencia: 'Te confirmo el martes a las 15:00.',
    sentimiento: 'positivo',
    observaciones: [],
    hallazgos: [],
  };
}

/** Un modelo de mentira que cuenta cuántas veces lo llamaron y qué recibió. */
function unModelo(
  respuesta: (n: number) => Awaited<ReturnType<PedirVeredicto>>,
): {
  pedir: PedirVeredicto;
  llamadas: () => number;
  vistos: { instrucciones: string; patrones: readonly string[]; conversacion: string }[];
} {
  let n = 0;
  const vistos: { instrucciones: string; patrones: readonly string[]; conversacion: string }[] = [];
  const pedir: PedirVeredicto = async (o) => {
    vistos.push({ instrucciones: o.instrucciones, patrones: o.patrones, conversacion: o.conversacion });
    n += 1;
    return respuesta(n);
  };
  return { pedir, llamadas: () => n, vistos };
}

/** Un modelo que siempre devuelve el mismo veredicto. */
const siempre = (v: VeredictoDelModelo) =>
  unModelo(() => ({
    tipo: 'datos',
    datos: { veredicto: v, tokens: 1000, milisegundos: 10, modelo: 'claude-sonnet-5' },
  }));

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · EL PORTÓN 0, ANTES DE TODO
// ═══════════════════════════════════════════════════════════════════════════════

test('la empresa frenada no llama al modelo ni una vez', async () => {
  await limpio();
  await unaConversacion();

  for (const [cambio, esperado] of [
    [{ auditorActivo: false }, 'auditor_apagado'],
    [{ claveIa: null }, 'sin_clave_ia'],
    [{ idDelAgente: null }, 'sin_id_del_agente'],
  ] as const) {
    const m = siempre(verde());
    const r = await auditarEmpresa({ ...EMPRESA(), ...cambio }, { ahora: AHORA, pedir: m.pedir });
    assert.equal(r.frenoDeLaEmpresa, esperado);
    assert.equal(m.llamadas(), 0, `${esperado} llamó al modelo`);
    assert.equal(r.candidatos, 0);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · EL CAMINO COMPLETO, Y EL MOTIVO EN LA COLA
// ═══════════════════════════════════════════════════════════════════════════════

test('EL CIERRE · un rojo pone su FRASE CONCRETA en la cola de urgentes', async () => {
  await limpio();
  /* ══════════════════════════════════════════════════════════════════════════
     LA PRUEBA DE LA ETAPA

     La cola de urgentes entra por la ETIQUETA del CRM, y el motivo sale del análisis. Son dos fuentes
     independientes y las dos tienen que estar: sin la etiqueta el contacto no entra, y sin el análisis
     entra con el texto de reserva.

     Y las vistas no se tocan: `EnLaCola.motivo` ya viajaba y ya se dibujaba desde la Etapa 11.
     ══════════════════════════════════════════════════════════════════════════ */
  const frase = 'Pidió hablar con una persona tres veces y el agente le repitió el mismo enlace.';
  // La etiqueta de fallo va puesta: es lo que mete al contacto en la cola roja.
  const id = await unaConversacion({
    etiquetas: ['bot_activado_appflow', 'bot_desactivado_appflow'],
    nombre: `${esc.marca} urgente`,
  });

  const m = siempre(rojo(frase));
  const r = await auditarEmpresa(EMPRESA(), { ahora: AHORA, pedir: m.pedir });

  /* El contacto tiene la etiqueta de fallo puesta, así que el portón 2 lo frena: el agente está
     pausado y no hay nada nuevo que juzgar. Se escribe el análisis a mano para separar las dos cosas
     que esta prueba mide — que el escritor guarda la frase, y que la cola la lee. */
  assert.equal(r.candidatos, 1);
  assert.equal(m.llamadas(), 0, 'un agente pausado no se audita');

  await esc.admin.query(
    `insert into negocio.analisis_del_agente
       (org_id, contacto_id, agente, auditable, intervencion, motivo, nivel, resumen, disparo,
        mensajes_del_agente)
     values ($1, $2, 'chat_post_agenda', true, true, $3, 'rojo', 'Sembrado.', 'manual', 6)`,
    [esc.org, id, frase],
  );

  const colas = await conOrganizacion(esc.org, () => nucleoDeColas('closer', 'America/Lima'));
  const enLaCola = colas.urgentes.find((u) => u.fila.id === id);
  assert.ok(enLaCola, 'el contacto con la etiqueta de fallo tiene que estar en urgentes');
  assert.equal(enLaCola.motivo, frase, 'la cola sigue mostrando el texto de reserva');
  assert.notEqual(enLaCola.motivo, SIN_MOTIVO);
});

test('el texto de reserva SIGUE cubriendo al que tiene la etiqueta y no tiene análisis', async () => {
  await limpio();
  /* No se borra, y es deliberado: son dos fuentes independientes. La etiqueta la pone el CRM y la
     escribe también la plataforma anterior; el análisis lo escribe este módulo, que empezó a correr un
     día concreto. Todo lo marcado antes de ese día entra a la cola sin motivo nuestro, y esa fila no
     puede quedar vacía. */
  const id = await unaConversacion({
    etiquetas: ['bot_desactivado_appflow'],
    nombre: `${esc.marca} sin análisis`,
  });
  const colas = await conOrganizacion(esc.org, () => nucleoDeColas('closer', 'America/Lima'));
  assert.equal(colas.urgentes.find((u) => u.fila.id === id)?.motivo, SIN_MOTIVO);
});

test('el motivo es DEL CONTACTO, no del primero que la consulta devuelva', async () => {
  await limpio();
  /* Sin `distinct on (contacto_id)` correlacionado, los dos contactos mostrarían la misma frase — y la
     cola diría de uno lo que pasó con el otro, que es peor que no decir nada. */
  const uno = await unaConversacion({
    etiquetas: ['bot_desactivado_appflow'],
    nombre: `${esc.marca} uno`,
  });
  const otro = await unaConversacion({
    etiquetas: ['bot_desactivado_appflow'],
    nombre: `${esc.marca} otro`,
  });
  for (const [id, frase] of [
    [uno, 'La primera frase, del contacto uno.'],
    [otro, 'La segunda frase, del contacto otro.'],
  ] as const) {
    await esc.admin.query(
      `insert into negocio.analisis_del_agente
         (org_id, contacto_id, agente, auditable, intervencion, motivo, nivel, resumen, disparo,
          mensajes_del_agente)
       values ($1, $2, 'chat_post_agenda', true, true, $3, 'rojo', 'Sembrado.', 'manual', 6)`,
      [esc.org, id, frase],
    );
  }

  const colas = await conOrganizacion(esc.org, () => nucleoDeColas('closer', 'America/Lima'));
  assert.equal(
    colas.urgentes.find((u) => u.fila.id === uno)?.motivo,
    'La primera frase, del contacto uno.',
  );
  assert.equal(
    colas.urgentes.find((u) => u.fila.id === otro)?.motivo,
    'La segunda frase, del contacto otro.',
  );
});

test('el motivo es el del análisis MÁS RECIENTE con intervención', async () => {
  await limpio();
  const id = await unaConversacion({
    etiquetas: ['bot_desactivado_appflow'],
    nombre: `${esc.marca} dos análisis`,
  });
  for (const [frase, cuando] of [
    ['La vieja, de hace tres días.', hace(4320)],
    ['La nueva, de hace una hora.', hace(60)],
  ] as const) {
    await esc.admin.query(
      `insert into negocio.analisis_del_agente
         (org_id, contacto_id, agente, auditable, intervencion, motivo, nivel, resumen, disparo,
          mensajes_del_agente, analizado_el)
       values ($1, $2, 'chat_post_agenda', true, true, $3, 'rojo', 'Sembrado.', 'manual', 6, $4)`,
      [esc.org, id, frase, cuando],
    );
  }
  const colas = await conOrganizacion(esc.org, () => nucleoDeColas('closer', 'America/Lima'));
  assert.equal(
    colas.urgentes.find((u) => u.fila.id === id)?.motivo,
    'La nueva, de hace una hora.',
  );
});

test('un veredicto verde POSTERIOR no borra el motivo del rojo que lo marcó', async () => {
  await limpio();
  /* ── POR QUÉ SE FILTRA POR `intervencion = true` Y NO SE TOMA EL ÚLTIMO ────
   *
   * Pasa de verdad: el agente falla, se lo marca, alguien corrige el prompt, y el contacto se vuelve
   * a auditar con un veredicto verde. **La etiqueta sigue puesta** —quitarla es resolver, y eso lo
   * hace una persona— así que el contacto sigue en la cola roja.
   *
   * Tomando el análisis más reciente sin filtrar, el motivo sería nulo y la fila caería al texto de
   * reserva: la cola diría «revisar la conversación» sobre un caso del que **sí sabemos qué pasó**.
   * Lo que el vendedor necesita leer es por qué se marcó, y eso está en el rojo. */
  const id = await unaConversacion({
    etiquetas: ['bot_desactivado_appflow'],
    nombre: `${esc.marca} marcado y después verde`,
  });
  const frase = 'Prometió un descuento del 40 % que no existe.';
  await esc.admin.query(
    `insert into negocio.analisis_del_agente
       (org_id, contacto_id, agente, auditable, intervencion, motivo, nivel, resumen, disparo,
        mensajes_del_agente, analizado_el)
     values ($1, $2, 'chat_post_agenda', true, true, $3, 'rojo', 'El rojo.', 'manual', 6, $4)`,
    [esc.org, id, frase, hace(300)],
  );
  await esc.admin.query(
    `insert into negocio.analisis_del_agente
       (org_id, contacto_id, agente, auditable, intervencion, motivo, nivel, resumen, disparo,
        mensajes_del_agente, analizado_el)
     values ($1, $2, 'chat_post_agenda', true, false, null, 'verde', 'El verde.', 'manual', 12, $3)`,
    [esc.org, id, hace(10)],
  );

  const colas = await conOrganizacion(esc.org, () => nucleoDeColas('closer', 'America/Lima'));
  const enLaCola = colas.urgentes.find((u) => u.fila.id === id);
  assert.equal(enLaCola?.motivo, frase);
  assert.notEqual(enLaCola?.motivo, SIN_MOTIVO);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · EL ANTIRREBOTE, MEDIDO EN LLAMADAS
// ═══════════════════════════════════════════════════════════════════════════════

test('la SEGUNDA corrida seguida no llama al modelo ni una vez', async () => {
  await limpio();
  /* ── LA AFIRMACIÓN QUE PROTEGE EL DINERO ───────────────────────────────────
   *
   * El candado frena las corridas simultáneas, y su antirrebote son diez segundos contra un cron de
   * diez minutos: una entrega duplicada **pasa el candado**. Lo que hace que no cueste nada es la
   * LÍNEA BASE que la primera corrida escribió.
   *
   * Y se mide en llamadas, no en filas: una segunda corrida que escriba una fila más pero no llame al
   * modelo sería aceptable; una que llame sería una factura que se duplica. */
  await unaConversacion();

  const primera = siempre(verde());
  const r1 = await auditarEmpresa(EMPRESA(), { ahora: AHORA, pedir: primera.pedir });
  assert.equal(primera.llamadas(), 1);
  assert.equal(r1.renglones[0]?.final, 'analizado');
  assert.equal(r1.renglones[0]?.nivel, 'verde');

  /* El candado tiene un antirrebote de diez segundos, así que la segunda corrida se frena ahí. Se
     borra el pulso para probar lo que importa: que la RESTA frena, no el candado. */
  await esc.admin.query(`delete from negocio.ingesta_pulso where clave = 'auditoria'`);

  const segunda = siempre(verde());
  const r2 = await auditarEmpresa(EMPRESA(), { ahora: AHORA, pedir: segunda.pedir });
  assert.equal(segunda.llamadas(), 0, 'la segunda corrida gastó de nuevo');
  assert.equal(r2.candidatos, 1, 'el contacto sigue siendo candidato: lo frena el antirrebote');
});

test('el CANDADO frena la segunda corrida inmediata, y no es un error', async () => {
  await limpio();
  await unaConversacion();

  const m = siempre(verde());
  await auditarEmpresa(EMPRESA(), { ahora: AHORA, pedir: m.pedir });
  const r = await auditarEmpresa(EMPRESA(), { ahora: AHORA, pedir: m.pedir });

  assert.equal(r.frenoDeLaEmpresa, null, 'el freno del candado no es un freno de la empresa');
  assert.ok(r.frenado !== undefined, 'el candado tiene que decir que frenó');
  assert.equal(m.llamadas(), 1);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · EL PORTÓN 5: LOS HECHOS, NO LAS ETIQUETAS
// ═══════════════════════════════════════════════════════════════════════════════

test('cinco AUTOMATIZACIONES pasan el antirrebote y NO llegan al modelo', async () => {
  await limpio();
  /* ══════════════════════════════════════════════════════════════════════════
     EL PORTÓN 5, QUE ES EL QUE JUSTIFICA TODA LA ATRIBUCIÓN

     El antirrebote cuenta `autor = 'agente'`, que la ingesta pone en todo saliente que no sea nuestro:
     ahí adentro hay automatizaciones del CRM. Cinco plantillas de un flujo **pasan el portón 4**.

     El portón 5 cuenta las líneas que la atribución le imputa al AGENTE IA, y son cero. Sin él, el
     criterio «dejó de responder» se cumpliría siempre que no hay agente: le imputaría al agente su
     propia ausencia, con un veredicto que se ve igual que uno bueno.

     Y se escribe la fila de todos modos, con su motivo: es lo que mueve la línea base y lo que hace
     que la pantalla del técnico pueda decir «esta conversación no la atendió el agente».
     ══════════════════════════════════════════════════════════════════════════ */
  await unaConversacion({ comoAutomatizacion: true, nombre: `${esc.marca} automatizada` });

  const m = siempre(verde());
  const r = await auditarEmpresa(EMPRESA(), { ahora: AHORA, pedir: m.pedir });

  assert.equal(r.candidatos, 1, 'pasó el filtro grueso y el antirrebote');
  assert.equal(m.llamadas(), 0, 'NO se gastó: no hay una línea del agente');
  assert.equal(r.renglones[0]?.final, 'no_auditable');
  assert.equal(r.renglones[0]?.porque, 'sin_lineas_del_agente');

  // Y la fila quedó escrita, con la línea base movida.
  const { rows } = await esc.admin.query<{ auditable: boolean; mensajes_del_agente: number }>(
    `select auditable, mensajes_del_agente from negocio.analisis_del_agente
      where contacto_id in (select id from negocio.contactos where ghl_contact_id like $1)`,
    [`${esc.marca.toLowerCase()}-%`],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.auditable, false);
  assert.equal(rows[0]?.mensajes_del_agente, UMBRAL_DEL_DEBOUNCE + 1);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · EL PROMPT DE LA EMPRESA LLEGA AL MODELO
// ═══════════════════════════════════════════════════════════════════════════════

test('el prompt guardado llega VERBATIM a las instrucciones que recibe el modelo', async () => {
  await limpio();
  /* La otra mitad del cierre de la etapa 2, la que sí se puede medir: la frase inconfundible viaja
     desde la base hasta el texto que el modelo lee, por el camino real y no por una llamada directa. */
  const frase = 'REGLA 7: jamás menciones el pimentón dulce de La Vera antes del minuto tres.';
  await conOrganizacion(esc.org, () => guardarPromptDelAgente('chat_post_agenda', frase, null));
  await unaConversacion();

  const m = siempre(verde());
  await auditarEmpresa(EMPRESA(), { ahora: AHORA, pedir: m.pedir });

  assert.equal(m.llamadas(), 1);
  assert.ok(m.vistos[0]?.instrucciones.includes(frase), 'el prompt no llegó al modelo');
  await esc.admin.query('delete from negocio.prompts_del_agente');
});

test('los patrones ya detectados llegan al modelo, y son los DE SU AGENTE', async () => {
  await limpio();
  /* Ofrecerle al auditor de post-agenda los códigos de pre-agenda invita al mismo cruce que el esquema
     y la rúbrica vienen cerrando. Y el sentido de reusar un código es agrupar **la misma falla del
     mismo agente**: sin eso, la pantalla del técnico muestra quince problemas sueltos en vez de
     «×15 casos». */
  /* Los hallazgos van en OTRO contacto, y no es un detalle del montaje: colgados del contacto que se
     va a auditar, el portón 3 lo frenaría por tener un aviso abierto y esta prueba mediría ese portón
     en vez de los patrones. Y así se parece más a lo real: los patrones son la historia de la empresa. */
  const id = await unaConversacion({ nombre: `${esc.marca} a auditar` });
  const conHistoria = await unaConversacion({ nombre: `${esc.marca} con historia` });
  const analisisId = (
    await esc.admin.query<{ id: string }>(
      `insert into negocio.analisis_del_agente
         (org_id, contacto_id, agente, auditable, intervencion, nivel, resumen, disparo,
          mensajes_del_agente, analizado_el)
       values ($1, $2, 'chat_post_agenda', true, false, 'amarillo', 'Sembrado.', 'manual', 999, $3)
       returning id`,
      [esc.org, conHistoria, hace(500)],
    )
  ).rows[0]!.id;

  for (const [agente, patron] of [
    ['chat_post_agenda', 'patron_de_post_agenda'],
    ['chat_pre_agenda', 'patron_de_pre_agenda'],
  ] as const) {
    await esc.admin.query(
      `insert into negocio.hallazgos
         (org_id, contacto_id, analisis_id, agente, titulo, patron, correccion, evidencia_agente)
       values ($1, $2, $3, $4, 'Algo', $5, 'Agregar algo.', 'Una línea del agente.')`,
      [esc.org, conHistoria, analisisId, agente, patron],
    );
  }

  const m = siempre(verde());
  await auditarEmpresa(EMPRESA(), { ahora: AHORA, pedir: m.pedir });

  /* Una sola llamada: el de la historia tiene un aviso abierto y lo frena el portón 3, que es
     justamente lo que se quiere — alguien ya lo está mirando. */
  assert.equal(m.llamadas(), 1);
  assert.deepEqual(m.vistos[0]?.patrones, ['patron_de_post_agenda']);
});

test('el transcript llega en orden CRONOLÓGICO, del más viejo al más nuevo', async () => {
  await limpio();
  /* ══════════════════════════════════════════════════════════════════════════
     UNA CONVERSACIÓN AL REVÉS SE LEE BIEN Y ES OTRA CONVERSACIÓN

     Los mensajes se piden DESCENDENTES —para quedarse con los últimos y no con los primeros, que es
     el error que `lib/negocio/ficha.ts` ya documenta— y se invierten en memoria. Olvidarse de la
     inversión, o pedirlos ascendentes con límite, deja el transcript **al revés**.

     Y no falla nada: el modelo recibe una conversación coherente donde el agente responde ANTES de
     que el contacto pregunte, la juzga, y devuelve un veredicto que se ve igual de bien que uno
     bueno. «Dejó de responder» y «no entendió la objeción» se vuelven ciertos casi siempre.
     ══════════════════════════════════════════════════════════════════════════ */
  const k = await unContacto(esc, {
    territorio: 'closer',
    etiquetas: ['bot_activado_appflow'],
    nombre: `${esc.marca} en orden`,
  });
  // Frases inconfundibles y en orden conocido: la primera es la más vieja.
  const dichos = ['PRIMERO hola', 'SEGUNDO una pregunta', 'TERCERO otra cosa'];
  for (let i = 0; i < dichos.length; i++) {
    await unMensaje(esc, k.id, {
      direccion: 'entrante',
      autor: 'contacto',
      cuerpo: dichos[i],
      enviadoEl: hace(90 - i * 10),
    });
  }
  for (let i = 0; i < UMBRAL_DEL_DEBOUNCE + 1; i++) {
    await esc.admin.query(`update negocio.mensajes set autor_ghl_usuario_id = $2 where id = $1`, [
      await unMensaje(esc, k.id, { direccion: 'saliente', autor: 'agente', enviadoEl: hace(50 - i) }),
      AGENTE_CRM,
    ]);
  }

  const m = siempre(verde());
  await auditarEmpresa(EMPRESA(), { ahora: AHORA, pedir: m.pedir });
  assert.equal(m.llamadas(), 1);

  const texto = String(m.vistos[0]?.conversacion);
  const posiciones = dichos.map((d) => texto.indexOf(d));
  for (const p of posiciones) assert.ok(p >= 0, 'falta una línea en el transcript');
  assert.deepEqual(
    posiciones,
    [...posiciones].sort((x, y) => x - y),
    'el transcript llegó al revés: el modelo vería al agente respondiendo antes de la pregunta',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6 · EL CORTA-CIRCUITO Y EL PRESUPUESTO
// ═══════════════════════════════════════════════════════════════════════════════

test('el CORTA-CIRCUITO abandona la empresa después de tres fallos, y lo dice', async () => {
  await limpio();
  /* ── EL ÚNICO GUARDIA CONTRA UN FALLO DETERMINISTA ─────────────────────────
   *
   * Un truncado vuelve a truncar sobre la misma conversación, y un declino vuelve a declinar. Ninguno
   * escribe fila, así que la línea base no se mueve y la corrida siguiente lo reintenta: veinte
   * llamadas pagadas cada diez minutos, para siempre.
   *
   * Con el corta-circuito son tres por corrida, y los que quedan salen como `abandonado` — que es lo
   * que hace que el reporte del cron muestre que algo está mal en vez de solo costar. */
  for (let i = 0; i < TOPE_DE_FALLOS + 2; i++) {
    await unaConversacion({ nombre: `${esc.marca} fallo ${i}` });
  }

  const m = unModelo(() => ({ tipo: 'truncado' }));
  const r = await auditarEmpresa(EMPRESA(), { ahora: AHORA, pedir: m.pedir });

  assert.equal(m.llamadas(), TOPE_DE_FALLOS, 'llamó más veces que el tope de fallos');
  assert.equal(r.cortoCircuito, true);
  const abandonados = r.renglones.filter((x) => x.final === 'abandonado');
  assert.equal(abandonados.length, 2);
  // Y el motivo del fallo se reporta por su nombre: un truncado manda a subir el techo de tokens.
  assert.equal(r.renglones.find((x) => x.final === 'fallo_del_modelo')?.porque, 'truncado');
});

test('los cinco finales de fallo se reportan DISTINTO, no colapsados', async () => {
  await limpio();
  /* Colapsarlos mandaría a la investigación equivocada: un truncado manda a subir el techo, una
     estructura inválida a revisar el esquema, y un rechazo del proveedor a mirar la clave. */
  const casos = [
    [{ tipo: 'truncado' as const }, 'truncado'],
    [{ tipo: 'declino' as const }, 'declino'],
    [{ tipo: 'sin_estructura' as const }, 'sin_estructura'],
    [{ tipo: 'sin_respuesta' as const, causa: 'tiempo agotado' }, /sin respuesta: tiempo agotado/],
    [
      { tipo: 'rechazado' as const, estado: 401, codigo: 'authentication_error', motivo: 'invalid x-api-key' },
      /rechazado \(401 authentication_error\): invalid x-api-key/,
    ],
  ] as const;

  for (const [fallo, esperado] of casos) {
    await limpio();
    await unaConversacion();
    const m = unModelo(() => fallo);
    const r = await auditarEmpresa(EMPRESA(), { ahora: AHORA, pedir: m.pedir });
    const porque = String(r.renglones[0]?.porque);
    if (typeof esperado === 'string') assert.equal(porque, esperado);
    else assert.match(porque, esperado);
    assert.equal(r.renglones[0]?.final, 'fallo_del_modelo');
  }
});

test('con el PRESUPUESTO agotado no se llama al modelo, y el renglón dice `sin_tiempo`', async () => {
  await limpio();
  /* ── EL GUARDIA QUE `barrido.ts` NO PODÍA DAR ──────────────────────────────
   *
   * El presupuesto del barrido comprueba el reloj ANTES de empezar cada empresa, y para las otras
   * cuatro tareas alcanza. Ésta puede hacer veinte llamadas al modelo, que pasan los 300 segundos de
   * `maxDuration` — y la plataforma **no reintenta**, así que lo que se corta se pierde y la llamada en
   * vuelo se paga igual.
   *
   * Y el renglón dice `sin_tiempo` y no `abandonado`: el primero se arregla solo en la corrida
   * siguiente, el segundo manda a investigar. Colapsarlos escondería esa diferencia. */
  await unaConversacion();
  const m = siempre(verde());
  const r = await auditarEmpresa(EMPRESA(), {
    ahora: AHORA,
    pedir: m.pedir,
    hasta: 1000,
    reloj: () => 5000,
  });

  assert.equal(m.llamadas(), 0);
  assert.equal(r.renglones[0]?.final, 'sin_tiempo');
  assert.equal(r.hayMas, true, 'quedó trabajo sin hacer y hay que decirlo');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7 · LOS DOS TERRITORIOS
// ═══════════════════════════════════════════════════════════════════════════════

test('el auditor que se usa sale del TERRITORIO, y llega al modelo', async () => {
  await limpio();
  await unaConversacion({
    territorio: 'setter',
    etiquetas: ['bot_activado_leadflow'],
    nombre: `${esc.marca} del setter`,
  });

  const m = siempre(verde());
  const r = await auditarEmpresa(EMPRESA(), { ahora: AHORA, pedir: m.pedir });

  assert.equal(m.llamadas(), 1);
  assert.equal(r.renglones[0]?.agente, 'chat_pre_agenda');
  /* Y las instrucciones que recibió son las de pre-agenda: su misión y sus criterios. Sin esto, el
     agente del renglón podría ser el correcto y el prompt el del otro territorio. */
  assert.match(String(m.vistos[0]?.instrucciones), /TODAVÍA NO AGENDÓ/);
  assert.match(String(m.vistos[0]?.instrucciones), /calificacion_saltada/);
});

test('el motivo también llega a la cola del SETTER, con su propia etiqueta de fallo', async () => {
  await limpio();
  /* `FALLOS_DEL_AUDITOR` no se fusiona: un closer viendo el fallo del agente del setter estuvo en
     producción. Así que el motivo tiene que funcionar en las dos colas, cada una con su etiqueta. */
  const id = await unaConversacion({
    territorio: 'setter',
    etiquetas: ['bot_desactivado_leadflow'],
    nombre: `${esc.marca} urgente del setter`,
  });
  const frase = 'Le insistió con la cita después de que dijo que no tiene presupuesto.';
  await esc.admin.query(
    `insert into negocio.analisis_del_agente
       (org_id, contacto_id, agente, auditable, intervencion, motivo, nivel, resumen, disparo,
        mensajes_del_agente)
     values ($1, $2, 'chat_pre_agenda', true, true, $3, 'rojo', 'Sembrado.', 'manual', 6)`,
    [esc.org, id, frase],
  );

  const colas = await conOrganizacion(esc.org, () => nucleoDeColas('setter', 'America/Lima'));
  assert.equal(colas.urgentes.find((u) => u.fila.id === id)?.motivo, frase);
});
