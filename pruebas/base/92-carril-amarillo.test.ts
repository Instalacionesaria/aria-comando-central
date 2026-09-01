// EL CARRIL AMARILLO: el tope, el descarte y la elección. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE ARCHIVO DEFIENDE
//
// Este carril corre **todos los días y por empresa**, en frío, y gasta una inferencia cada vez. Sus
// defectos no fallan: gastan, o se callan.
//
//   · **El tope contado por severidad en vez de por criterio.** El carril rojo también produce
//     amarillos, así que un día con tres hallazgos suyos dejaría a éste sin correr — y el síntoma
//     sería «el carril amarillo no anda» sobre un carril que hace exactamente lo que se le pidió.
//     Le pasó al origen en su primer ensayo.
//
//   · **El descarte sin la versión del prompt.** Un patrón arreglado quedaría silenciado **para
//     siempre**: alguien corrige el prompt, el agente sigue fallando bajo el mismo código, y este
//     carril no lo vuelve a levantar nunca.
//
//   · **La elección sin orden.** Una por día es poquísimo, así que el orden decide si en un mes se
//     miraron treinta conversaciones o la misma treinta veces.
//
//   · **No escribir el análisis cuando no hay hallazgo.** Como el peldaño que se reporta es el raro,
//     la mayoría de los días no hay hallazgo — y sin la fila que dice «este carril ya miró acá», el
//     mismo contacto gana la elección todos los días, para siempre.
//
// La llamada al modelo se inyecta: sin esa costura, probar este camino exigiría gastar plata de la
// cuenta de la empresa en cada corrida de la suite.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { limpiar, montar, unContacto, unMensaje, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import {
  CRITERIO_DE_LA_MEJORA,
  DISPARO_DE_LA_MEJORA,
  MINIMO_DE_MENSAJES,
  PELDANOS,
  TOPE_POR_DIA,
  aQuienMirar,
  antesDeMirar,
  claveDelDescarte,
  mejoraEnSeco,
} from '../../lib/auditor/mejora.ts';
import { buscarUnaMejora } from '../../lib/auditor/buscarMejora.ts';
import { guardarPromptDelAgente } from '../../lib/auditor/prompts.ts';
import type { pedirVeredicto } from '../../lib/auditor/modelo.ts';

let esc: Escenario;

const AGENTE_CRM = '0peGoq7VvFqnDGA7gxtX';
const ZONA = 'America/Lima';
const AHORA = new Date('2026-08-31T15:00:00.000Z');
const hace = (min: number): Date => new Date(AHORA.getTime() - min * 60_000);

const EMPRESA = () => ({
  orgId: esc.org,
  zona: ZONA,
  claveIa: 'una-clave-que-nunca-se-usa',
  idDelAgente: AGENTE_CRM,
});

before(async () => {
  esc = await montar('Mejora');
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
  await esc.admin.query('delete from negocio.prompts_del_agente');
  await limpiar(esc);
}

/** Una conversación con mensajes atribuibles al agente. */
async function unaConversacion(o: { cuantos?: number; nombre?: string; territorio?: string } = {}) {
  const k = await unContacto(esc, {
    territorio: o.territorio ?? 'closer',
    nombre: o.nombre ?? `${esc.marca} conversación`,
  });
  await unMensaje(esc, k.id, { direccion: 'entrante', autor: 'contacto', enviadoEl: hace(90) });
  for (let i = 0; i < (o.cuantos ?? MINIMO_DE_MENSAJES); i++) {
    await esc.admin.query('update negocio.mensajes set autor_ghl_usuario_id = $2 where id = $1', [
      await unMensaje(esc, k.id, { direccion: 'saliente', autor: 'agente', enviadoEl: hace(70 - i) }),
      AGENTE_CRM,
    ]);
  }
  return k.id;
}

/** Un modelo de mentira que cuenta las llamadas y devuelve lo que se le diga. */
function unModelo(m: {
  peldano?: string;
  patron?: string;
  titulo?: string;
} = {}): { pedir: typeof pedirVeredicto; llamadas: () => number; vistos: string[] } {
  let n = 0;
  const vistos: string[] = [];
  const pedir: typeof pedirVeredicto = async (o) => {
    n += 1;
    vistos.push(o.instrucciones);
    return {
      tipo: 'datos',
      datos: {
        veredicto: {
          peldano: m.peldano ?? 'no_leyo',
          patron: m.patron ?? 'no_leyo_el_contexto',
          titulo: m.titulo ?? 'No leyó el contexto',
          diagnostico: 'El agente respondió con el guion.',
          correccion: 'Agregar: antes de responder, repetí lo que el contacto dijo.',
          evidencia_agente: 'Te cuento de qué se trata el programa…',
          evidencia_contacto: 'Ya me lo explicaste tres veces.',
        } as never,
        milisegundos: 10,
        tokens: 500,
        modelo: 'claude-sonnet-5',
      },
    };
  };
  return { pedir, llamadas: () => n, vistos };
}

/** Un hallazgo sembrado, para el tope y el descarte. */
async function unHallazgoSembrado(o: {
  contactoId: string;
  criterio?: string | null;
  patron?: string;
  promptHash?: string | null;
  detectadoEl?: string;
  agente?: string;
}): Promise<void> {
  const { rows } = await esc.admin.query<{ id: string }>(
    `insert into negocio.analisis_del_agente
       (org_id, contacto_id, agente, auditable, intervencion, nivel, resumen, disparo,
        mensajes_del_agente)
     values ($1, $2, $3, true, false, 'amarillo', 'Sembrado.', 'debounce', 3)
     returning id`,
    [esc.org, o.contactoId, o.agente ?? 'chat_post_agenda'],
  );
  await esc.admin.query(
    `insert into negocio.hallazgos
       (org_id, contacto_id, analisis_id, agente, titulo, patron, criterio, correccion,
        evidencia_agente, severidad, prompt_hash, detectado_el)
     values ($1, $2, $3, $4, 'Sembrado', $5, $6, 'Corregir.', 'Una línea.', 'amarillo', $7,
             coalesce($8::timestamptz, now()))`,
    [
      esc.org,
      o.contactoId,
      rows[0]!.id,
      o.agente ?? 'chat_post_agenda',
      o.patron ?? 'un_patron',
      o.criterio === undefined ? CRITERIO_DE_LA_MEJORA : o.criterio,
      o.promptHash ?? null,
      o.detectadoEl ?? null,
    ],
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · EL TOPE
// ═══════════════════════════════════════════════════════════════════════════════

test('el tope se cuenta POR CRITERIO, no por severidad', async () => {
  await limpio();
  /* ══════════════════════════════════════════════════════════════════════════
     EL DEFECTO QUE EL ORIGEN PAGÓ EN SU PRIMER ENSAYO

     El carril rojo también produce hallazgos amarillos. Contando por severidad, un día con tres de
     ellos deja a este carril sin correr — y el síntoma es «el carril amarillo no anda» sobre un carril
     que está haciendo exactamente lo que se le pidió.

     Se siembran tres amarillos del carril ROJO (criterio de la rúbrica) y el techo tiene que seguir
     abierto.
     ══════════════════════════════════════════════════════════════════════════ */
  const k = await unaConversacion();
  for (const patron of ['uno_rojo', 'dos_rojo', 'tres_rojo']) {
    await unHallazgoSembrado({ contactoId: k, criterio: 'promesa_incorrecta', patron });
  }

  const antes = await conOrganizacion(esc.org, () => antesDeMirar(ZONA));
  assert.equal(antes.hoy, 0, 'los amarillos del carril rojo no cuentan acá');
  assert.equal(antes.techoAlcanzado, false);
});

test('el tope SÍ cuenta los de este carril, y corta', async () => {
  await limpio();
  const k = await unaConversacion();
  for (let i = 0; i < TOPE_POR_DIA; i++) {
    await unHallazgoSembrado({ contactoId: k, patron: `del_carril_${i}` });
  }

  const antes = await conOrganizacion(esc.org, () => antesDeMirar(ZONA));
  assert.equal(antes.hoy, TOPE_POR_DIA);
  assert.equal(antes.techoAlcanzado, true);
});

test('el tope se corta ANTES de llamar al modelo', async () => {
  await limpio();
  /* Si el techo está alcanzado, todo lo demás es trabajo que no se va a poder escribir: elegir, cargar,
     atribuir y pagar una inferencia para tirar la respuesta. */
  const k = await unaConversacion();
  await unHallazgoSembrado({ contactoId: k, patron: 'ya_esta_hecho' });

  const m = unModelo();
  const r = await buscarUnaMejora(EMPRESA(), AHORA, m.pedir);
  assert.equal(r.porQueNo, 'techo_del_dia');
  assert.equal(m.llamadas(), 0, 'gastó con el techo alcanzado');
});

test('el tope mira el día DE LA EMPRESA, no el del servidor', async () => {
  await limpio();
  /* Con UTC, una empresa en Lima tendría su tope reiniciado a las 19:00 y podría escribir dos mejoras
     en su propio día. Se siembra un hallazgo de hace 30 horas: es ayer en las dos zonas, así que el
     techo tiene que estar abierto — y uno de hace 1 hora, que es hoy en las dos. */
  const k = await unaConversacion();
  await unHallazgoSembrado({
    contactoId: k,
    patron: 'de_anteayer',
    detectadoEl: new Date(Date.now() - 30 * 3_600_000).toISOString(),
  });
  const viejo = await conOrganizacion(esc.org, () => antesDeMirar(ZONA));
  assert.equal(viejo.hoy, 0, 'un hallazgo de hace 30 horas no es de hoy en ninguna zona');

  await unHallazgoSembrado({ contactoId: k, patron: 'de_hoy' });
  const nuevo = await conOrganizacion(esc.org, () => antesDeMirar(ZONA));
  assert.equal(nuevo.hoy, 1);
});

test('EL BORDE DEL DÍA es el de la empresa, y se mide sin depender de la hora', async () => {
  await limpio();
  /* ══════════════════════════════════════════════════════════════════════════
     CÓMO SE PRUEBA UN BORDE DE DÍA SIN QUE LA PRUEBA DEPENDA DE LA HORA

     La forma ingenua —sembrar «hace dos horas» y esperar que UTC y Lima difieran— sólo funciona
     durante las cinco horas en que difieren, y pasa por coincidencia el resto del día. Es
     exactamente el defecto que la prueba del mes del cockpit tenía y que se acaba de arreglar.

     Acá el borde se construye: la zona la elige la prueba —`Pacific/Kiritimati`, UTC+14— y el
     hallazgo se siembra **un minuto después del comienzo del día DE ESA ZONA**, calculado por la
     misma base. Ese instante es, siempre y por definición:

       · HOY en la zona de la empresa  → el tope tiene que contarlo;
       · y AYER en UTC, porque el día de una zona UTC+14 empieza catorce horas antes.

     Así la afirmación vale a cualquier hora, y la mutación que mide el día en UTC devuelve cero.
     ══════════════════════════════════════════════════════════════════════════ */
  const LEJOS = 'Pacific/Kiritimati';
  const k = await unaConversacion();
  const { rows } = await esc.admin.query<{ inicio: Date }>(
    `select (date_trunc('day', timezone($1, now())) at time zone $1) + interval '1 minute' as inicio`,
    [LEJOS],
  );
  await unHallazgoSembrado({
    contactoId: k,
    patron: 'al_filo_del_dia',
    detectadoEl: rows[0]!.inicio.toISOString(),
  });

  const conLaZona = await conOrganizacion(esc.org, () => antesDeMirar(LEJOS));
  assert.equal(conLaZona.hoy, 1, 'un minuto después del comienzo del día de la empresa ES hoy');
  assert.equal(conLaZona.techoAlcanzado, true);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · EL DESCARTE
// ═══════════════════════════════════════════════════════════════════════════════

test('EL DESCARTE lleva la versión del prompt, o un patrón arreglado se silencia para siempre', async () => {
  await limpio();
  /* ══════════════════════════════════════════════════════════════════════════
     Sin la versión, el descarte sería por `(patrón, agente)` y alcanzaría con haberlo reportado una
     vez para no volver a levantarlo NUNCA — ni después de corregir el prompt, que es justo cuando hay
     que volver a mirar si el arreglo sirvió.

     Se siembra el mismo patrón con un hash viejo, y la clave con el hash de hoy tiene que NO estar.
     ══════════════════════════════════════════════════════════════════════════ */
  const k = await unaConversacion();
  await unHallazgoSembrado({ contactoId: k, patron: 'el_mismo', promptHash: 'hashviejo0000000' });

  const antes = await conOrganizacion(esc.org, () => antesDeMirar(ZONA));
  assert.ok(
    antes.yaAbiertos.has(claveDelDescarte('el_mismo', 'chat_post_agenda', 'hashviejo0000000')),
    'el patrón sobre SU versión sí está descartado',
  );
  assert.ok(
    !antes.yaAbiertos.has(claveDelDescarte('el_mismo', 'chat_post_agenda', 'hashnuevo0000000')),
    'sobre una versión nueva del prompt se puede volver a reportar',
  );
  // Y el agente también es parte de la clave: el mismo código en el otro agente es otro trabajo.
  assert.ok(
    !antes.yaAbiertos.has(claveDelDescarte('el_mismo', 'chat_pre_agenda', 'hashviejo0000000')),
  );
});

test('el descarte cuenta los hallazgos del carril ROJO también', async () => {
  await limpio();
  /* Son la misma lista para el técnico: reportar el mismo patrón dos veces con dos códigos distintos
     sería una fila duplicada en la única pantalla donde esto se mira. */
  const k = await unaConversacion();
  await unHallazgoSembrado({
    contactoId: k,
    criterio: 'promesa_incorrecta',
    patron: 'del_carril_rojo',
    promptHash: null,
  });

  const antes = await conOrganizacion(esc.org, () => antesDeMirar(ZONA));
  assert.ok(antes.yaAbiertos.has(claveDelDescarte('del_carril_rojo', 'chat_post_agenda', null)));
});

test('los hallazgos RESUELTOS dejan de descartar', async () => {
  await limpio();
  /* Un patrón resuelto ya no está abierto, y si el agente vuelve a caer en él hay que volver a
     levantarlo. Descartar por historia y no por estado haría que un problema que vuelve nunca se
     reporte de nuevo. */
  const k = await unaConversacion();
  await unHallazgoSembrado({ contactoId: k, patron: 'ya_cerrado', promptHash: null });
  await esc.admin.query('update negocio.hallazgos set resuelto_el = now() where contacto_id = $1', [k]);

  const antes = await conOrganizacion(esc.org, () => antesDeMirar(ZONA));
  assert.ok(!antes.yaAbiertos.has(claveDelDescarte('ya_cerrado', 'chat_post_agenda', null)));
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · A QUIÉN MIRAR
// ═══════════════════════════════════════════════════════════════════════════════

test('elige al que hace MÁS TIEMPO que este carril no mira', async () => {
  await limpio();
  /* ── EL ORDEN ES LO ÚNICO QUE HACE QUE ESTO RECORRA LA CUENTA ──────────────
   *
   * Una por día es poquísimo. Sin `nulls first`, el carril miraría siempre al mismo contacto y en un
   * mes habría treinta análisis de una sola conversación. */
  const yaMirado = await unaConversacion({ cuantos: 20, nombre: `${esc.marca} ya mirado` });
  await esc.admin.query(
    `insert into negocio.analisis_del_agente
       (org_id, contacto_id, agente, auditable, intervencion, nivel, resumen, disparo,
        mensajes_del_agente)
     values ($1, $2, 'chat_post_agenda', true, false, 'verde', 'Ya lo miré.', $3, 20)`,
    [esc.org, yaMirado, DISPARO_DE_LA_MEJORA],
  );
  /* Y un tercero que el CARRIL ROJO acaba de auditar. Para este carril **sigue sin mirarse**: la
     fecha de la elección sale de los análisis con `disparo = 'mejora'` y no de cualquiera.

     Sin ese filtro, un contacto recién auditado por el carril rojo se vería como «ya mirado» acá — y
     como el carril rojo mira los que se mueven, este carril quedaría empujado siempre hacia las
     conversaciones muertas, que es lo contrario de recorrer la cuenta. Se le ponen MÁS mensajes que
     al otro para que gane el desempate si el filtro no está. */
  const delCarrilRojo = await unaConversacion({
    cuantos: 30,
    nombre: `${esc.marca} recién auditado`,
  });
  await esc.admin.query(
    `insert into negocio.analisis_del_agente
       (org_id, contacto_id, agente, auditable, intervencion, nivel, resumen, disparo,
        mensajes_del_agente)
     values ($1, $2, 'chat_post_agenda', true, false, 'verde', 'Del carril rojo.', 'debounce', 30)`,
    [esc.org, delCarrilRojo],
  );
  const nunca = await unaConversacion({ cuantos: 40, nombre: `${esc.marca} nunca mirado` });

  const elegido = await conOrganizacion(esc.org, () => aQuienMirar());
  assert.equal(
    elegido?.contactoId,
    nunca,
    'eligió al que ya había mirado, teniendo uno sin mirar',
  );
  assert.equal(elegido?.ultimaMejoraEl, null);

  /* Y el del carril rojo sigue disponible para mañana: se le borra al elegido de hoy su turno y
     tiene que ganar él, por encima del que este carril YA miró. */
  await esc.admin.query('delete from negocio.contactos where id = $1', [nunca]);
  const manana = await conOrganizacion(esc.org, () => aQuienMirar());
  assert.equal(
    manana?.contactoId,
    delCarrilRojo,
    'un análisis del carril rojo lo dejó fuera de la elección de este carril',
  );
});

test('entre dos sin mirar, gana el que tiene MÁS material', async () => {
  await limpio();
  /* Una conversación de tres mensajes y una de treinta no dan la misma información por el mismo
     precio, y este carril paga lo mismo por las dos. */
  await unaConversacion({ cuantos: 3, nombre: `${esc.marca} corta` });
  const larga = await unaConversacion({ cuantos: 12, nombre: `${esc.marca} larga` });

  const elegido = await conOrganizacion(esc.org, () => aQuienMirar());
  assert.equal(elegido?.contactoId, larga);
  assert.equal(elegido?.mensajesDelAgente, 12);
});

test('no elige a quien no tiene material suficiente', async () => {
  await limpio();
  /* Sin el mínimo, el orden por «nunca mirado» haría ganar casi siempre a un contacto con cero
     mensajes del agente — o sea que este carril gastaría todos los días en conversaciones donde no
     hay nada que leer. */
  await unaConversacion({ cuantos: MINIMO_DE_MENSAJES - 1, nombre: `${esc.marca} muy corta` });
  const elegido = await conOrganizacion(esc.org, () => aQuienMirar());
  assert.equal(elegido, null);
});

test('el agente sale del TERRITORIO, con el mismo `Record` que el carril rojo', async () => {
  await limpio();
  await unaConversacion({ territorio: 'setter', nombre: `${esc.marca} del setter` });
  const elegido = await conOrganizacion(esc.org, () => aQuienMirar());
  assert.equal(elegido?.agente, 'chat_pre_agenda');
});

test('ADR-0206 · no elige contactos de otra empresa', async () => {
  await limpio();
  await unaConversacion({ nombre: `${esc.marca} de alfa` });
  const desdeLaOtra = await conOrganizacion(esc.otraOrg, () => aQuienMirar());
  assert.equal(desdeLaOtra, null);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4 · EL CAMINO COMPLETO
// ═══════════════════════════════════════════════════════════════════════════════

test('el peldaño de abajo escribe un amarillo con su criterio propio', async () => {
  await limpio();
  const k = await unaConversacion();
  const m = unModelo({ peldano: 'no_leyo', patron: 'sigue_el_guion' });
  const r = await buscarUnaMejora(EMPRESA(), AHORA, m.pedir);

  assert.equal(m.llamadas(), 1);
  assert.equal(r.porQueNo, null);
  assert.equal(r.patron, 'sigue_el_guion');

  const { rows } = await esc.admin.query<{
    nivel: string;
    disparo: string;
    criterio: string;
    intervencion: boolean;
    severidad: string;
  }>(
    `select a.nivel, a.disparo, h.criterio, a.intervencion, h.severidad
       from negocio.analisis_del_agente a join negocio.hallazgos h on h.analisis_id = a.id
      where a.contacto_id = $1`,
    [k],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.nivel, 'amarillo');
  assert.equal(rows[0]?.disparo, DISPARO_DE_LA_MEJORA);
  assert.equal(rows[0]?.criterio, CRITERIO_DE_LA_MEJORA);
  assert.equal(rows[0]?.severidad, 'amarillo', 'este carril NO produce rojos');
  assert.equal(rows[0]?.intervencion, false, 'no interrumpe a nadie');

  /* ── LA LÍNEA BASE DEL OTRO CARRIL, ESCRITA CON LO QUE HAY ─────────────────
   *
   * `mensajes_del_agente` es la línea base del antirrebote del carril ROJO, y este carril escribe
   * una fila en la misma tabla. Poniéndola en cero, el rojo restaría contra cero en su próxima
   * corrida, vería un delta enorme y **volvería a auditar la misma conversación al día siguiente** —
   * una inferencia de más por cada mejora escrita, y ninguna de las dos se vería mal. */
  const base = await esc.admin.query<{ mensajes_del_agente: number }>(
    `select mensajes_del_agente from negocio.analisis_del_agente where contacto_id = $1`,
    [k],
  );
  assert.equal(base.rows[0]?.mensajes_del_agente, MINIMO_DE_MENSAJES);
});

test('los otros dos peldaños NO escriben hallazgo, y sí escriben el análisis', async () => {
  await limpio();
  /* ══════════════════════════════════════════════════════════════════════════
     LA FILA SIN HALLAZGO ES LO QUE HACE QUE EL CARRIL AVANCE

     `aQuienMirar` ordena por «hace cuánto que este carril no mira acá», y esa fecha sale del análisis.
     Como el peldaño que se reporta es el raro, la mayoría de los días no hay hallazgo — y sin la fila,
     el mismo contacto ganaría la elección todos los días, para siempre.
     ══════════════════════════════════════════════════════════════════════════ */
  for (const peldano of ['leyo_a_medias', 'leyo_y_respondio'] as const) {
    await limpio();
    const k = await unaConversacion();
    const m = unModelo({ peldano });
    const r = await buscarUnaMejora(EMPRESA(), AHORA, m.pedir);

    assert.equal(r.porQueNo, 'no_es_para_reportar', `${peldano} reportó`);
    const analisis = await esc.admin.query<{ n: string }>(
      `select count(*)::text as n from negocio.analisis_del_agente where contacto_id = $1`,
      [k],
    );
    const hallazgos = await esc.admin.query<{ n: string }>(
      `select count(*)::text as n from negocio.hallazgos where contacto_id = $1`,
      [k],
    );
    assert.equal(analisis.rows[0]?.n, '1', 'el análisis se escribe igual: es lo que mueve la fecha');
    assert.equal(hallazgos.rows[0]?.n, '0');
  }
});

test('un patrón YA ABIERTO sobre esta versión del prompt no se escribe de nuevo', async () => {
  await limpio();
  await conOrganizacion(esc.org, () =>
    guardarPromptDelAgente('chat_post_agenda', 'El prompt de hoy.', null),
  );
  const { hashDelPrompt } = await import('../../lib/auditor/prompts.ts');
  const k = await unaConversacion();
  /* El hallazgo es de AYER, y eso es parte de lo que la prueba mide: uno de hoy dispararía el TOPE
     antes que el descarte, y entonces esto estaría comprobando el tope otra vez. El caso real del
     descarte es justamente éste — un patrón abierto hace días que sigue sin resolverse. */
  await unHallazgoSembrado({
    contactoId: k,
    patron: 'repetido',
    promptHash: hashDelPrompt('El prompt de hoy.'),
    detectadoEl: new Date(Date.now() - 30 * 3_600_000).toISOString(),
  });
  const antes = await conOrganizacion(esc.org, () => antesDeMirar(ZONA));
  assert.equal(antes.techoAlcanzado, false, 'el techo tiene que estar abierto para medir el descarte');

  const m = unModelo({ patron: 'repetido' });
  const r = await buscarUnaMejora(EMPRESA(), AHORA, m.pedir);
  assert.equal(r.porQueNo, 'ya_estaba_abierto');

  /* Sigue habiendo UNO: el sembrado. Contar cero sería contar mal — lo que se afirma es que no se
     agregó uno nuevo, no que no haya ninguno. */
  const hallazgos = await esc.admin.query<{ n: string }>(
    `select count(*)::text as n from negocio.hallazgos
      where contacto_id = $1 and criterio = $2`,
    [k, CRITERIO_DE_LA_MEJORA],
  );
  assert.equal(hallazgos.rows[0]?.n, '1', 'escribió un duplicado del patrón ya abierto');

  // Y el análisis SÍ se escribió: es lo que mueve la fecha para que mañana toque otra conversación.
  const analisis = await esc.admin.query<{ n: string }>(
    `select count(*)::text as n from negocio.analisis_del_agente
      where contacto_id = $1 and disparo = $2`,
    [k, DISPARO_DE_LA_MEJORA],
  );
  assert.equal(analisis.rows[0]?.n, '1');
});

test('un patrón con formato roto se descarta, y el análisis entra igual', async () => {
  await limpio();
  const k = await unaConversacion();
  const m = unModelo({ patron: '¡¡!!' });
  const r = await buscarUnaMejora(EMPRESA(), AHORA, m.pedir);

  assert.equal(r.porQueNo, 'patron_invalido');
  const analisis = await esc.admin.query<{ n: string }>(
    `select count(*)::text as n from negocio.analisis_del_agente where contacto_id = $1`,
    [k],
  );
  assert.equal(analisis.rows[0]?.n, '1');
});

test('DOS corridas el mismo día producen UNA sola mejora', async () => {
  await limpio();
  /* El cierre de la etapa, medido. La segunda corrida encuentra el techo alcanzado y no llama al
     modelo — que es lo que hace que este carril cueste una inferencia por día y no una por corrida. */
  await unaConversacion({ nombre: `${esc.marca} uno` });
  await unaConversacion({ nombre: `${esc.marca} dos` });

  const primera = unModelo({ patron: 'primera_mejora' });
  await buscarUnaMejora(EMPRESA(), AHORA, primera.pedir);
  const segunda = unModelo({ patron: 'segunda_mejora' });
  const r = await buscarUnaMejora(EMPRESA(), AHORA, segunda.pedir);

  assert.equal(primera.llamadas(), 1);
  assert.equal(segunda.llamadas(), 0, 'la segunda corrida del día gastó');
  assert.equal(r.porQueNo, 'techo_del_dia');

  const { rows } = await esc.admin.query<{ n: string }>(
    `select count(*)::text as n from negocio.hallazgos
      where criterio = $1 and contacto_id in
        (select id from negocio.contactos where ghl_contact_id like $2)`,
    [CRITERIO_DE_LA_MEJORA, `${esc.marca.toLowerCase()}-%`],
  );
  assert.equal(rows[0]?.n, '1', 'dos corridas el mismo día produjeron más de una mejora');
});

test('el prompt del agente llega VERBATIM a las instrucciones', async () => {
  await limpio();
  const frase = 'REGLA 7: jamás menciones el pimentón dulce de La Vera antes del minuto tres.';
  await conOrganizacion(esc.org, () => guardarPromptDelAgente('chat_post_agenda', frase, null));
  await unaConversacion();

  const m = unModelo({ peldano: 'leyo_y_respondio' });
  await buscarUnaMejora(EMPRESA(), AHORA, m.pedir);
  assert.ok(m.vistos[0]?.includes(frase));
});

test('las instrucciones llevan LA REGLA DE IMPUTACIÓN, la misma que el carril rojo', async () => {
  await limpio();
  /* Es la única que no puede divergir entre los dos carriles: es la que decide a quién se le imputa
     una línea. Duplicada, un carril diría «el agente» y el otro «el agente o una automatización», y el
     segundo produciría mejoras correctas sobre el culpable equivocado. */
  const { REGLA_DE_IMPUTACION } = await import('../../lib/auditor/rubrica.ts');
  await unaConversacion();
  const m = unModelo({ peldano: 'leyo_y_respondio' });
  await buscarUnaMejora(EMPRESA(), AHORA, m.pedir);
  assert.ok(m.vistos[0]?.includes(REGLA_DE_IMPUTACION));
});

test('las instrucciones nombran los TRES peldaños y mandan al del medio ante la duda', async () => {
  await limpio();
  await unaConversacion();
  const m = unModelo({ peldano: 'leyo_y_respondio' });
  await buscarUnaMejora(EMPRESA(), AHORA, m.pedir);
  for (const p of PELDANOS) assert.ok(m.vistos[0]?.includes(p), `falta el peldaño ${p}`);
  assert.match(String(m.vistos[0]), /ANTE LA DUDA, `leyo_a_medias`/);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5 · LA CORRIDA EN SECO
// ═══════════════════════════════════════════════════════════════════════════════

test('la corrida en seco dice a quién, con qué agente, y cuántos códigos hay abiertos', async () => {
  await limpio();
  const k = await unaConversacion({ cuantos: 7, nombre: `${esc.marca} el elegido` });
  await unHallazgoSembrado({
    contactoId: k,
    criterio: 'promesa_incorrecta',
    patron: 'ya_abierto_uno',
    promptHash: null,
  });

  const seco = await conOrganizacion(esc.org, () => mejoraEnSeco(ZONA));
  assert.equal(seco.porQueNo, null);
  assert.equal(seco.elegido?.contactoId, k);
  assert.equal(seco.elegido?.agente, 'chat_post_agenda');
  assert.equal(seco.yaAbiertos, 1, 'tiene que decir cuántos códigos ya están abiertos');
  assert.equal(seco.hoy, 0);
});

test('la corrida en seco con el techo alcanzado no elige a nadie', async () => {
  await limpio();
  const k = await unaConversacion();
  await unHallazgoSembrado({ contactoId: k, patron: 'la_de_hoy' });

  const seco = await conOrganizacion(esc.org, () => mejoraEnSeco(ZONA));
  assert.equal(seco.porQueNo, 'techo_del_dia');
  assert.equal(seco.elegido, null, 'elegir con el techo alcanzado pone un nombre que nadie va a mirar');
});

test('la corrida en seco NO escribe ni llama al modelo', async () => {
  await limpio();
  await unaConversacion();
  await conOrganizacion(esc.org, () => mejoraEnSeco(ZONA));

  const { rows } = await esc.admin.query<{ n: string }>(
    `select count(*)::text as n from negocio.analisis_del_agente where contacto_id in
      (select id from negocio.contactos where ghl_contact_id like $1)`,
    [`${esc.marca.toLowerCase()}-%`],
  );
  assert.equal(rows[0]?.n, '0');
});
