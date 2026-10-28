// El ICP y las agendas por pieza, contra la base de verdad. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LOS TRES DEFECTOS QUE ESTE ARCHIVO EXISTE PARA IMPEDIR, Y NINGUNO FALLA
//
//   1 · **Agrupar por `adId` en vez de por el nombre de la pieza.** Medido en producción: los 79
//       anuncios son 32 piezas y 21 corren en más de un `adId`, hasta seis. Agrupando por anuncio,
//       una pieza aparece seis veces con un sexto de su gente cada vez, y ninguna llega al piso —
//       así que la tabla sale entera en `null` y parece que no hay datos.
//
//   2 · **Mezclar TOFU con BOFU.** Un creativo de BOFU le habla a gente que ya conoce la oferta;
//       uno de TOFU, a desconocidos. Medido: `evoluciona native` (BOFU) agenda al 78 % y las piezas
//       TOFU que traen el 65 % del volumen quedan debajo del promedio. Una pantalla que las compare
//       recomienda pausar lo que alimenta el embudo.
//
//   3 · **Contar CITAS donde hay que contar CONTACTOS.** Verificado en
//       `docs/1-plataforma/02-CREATIVE.md:445-448@63b8cd1`: un `count(*)` sobre el `left join` inflaba
//       «agendamiento - yaping» de 109 a 112. No lanza: devuelve un número más grande.
//
// Y el cuarto, que es de otra clase: **contar el ICP con otra regla que la de las demás pantallas**. Desde la `105`
// el ICP es el cuadrante que manda el CRM, ya normalizado en `contactos.cuadrante`: los calificados son Prioriza,
// Valida o Financia, y la porción de Descarta es sobre los clasificados. Leer el campo crudo acá haría que la misma
// pieza calificara distinto en Creative que en Acquisition.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cerrarTodo } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { montar, type Escenario } from '../apoyo/closer.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { calidadDelCreativo } from '../../lib/negocio/calidadDelCreativo.ts';
import { CLAVE_DEL_CUADRANTE } from '../../lib/ghl/contrato.ts';
import { PISO_DE_UNA_TASA } from '../../lib/negocio/indicadoresDeCitas.ts';

let esc: Escenario;

const MARCA = '77777700';
const CONTACTO = 'calcrea-';
const CAMPO = 'campo-cuadrante-prueba';
const CARPETA = 'carpeta-cuadrante-prueba';

async function limpiar(): Promise<void> {
  await esc.admin.query(
    'delete from negocio.citas where contacto_id in (select id from negocio.contactos where ghl_contact_id like $1)',
    [`${CONTACTO}%`],
  );
  await esc.admin.query('delete from negocio.contactos where ghl_contact_id like $1', [`${CONTACTO}%`]);
  await esc.admin.query('delete from negocio.anuncios where meta_anuncio_id like $1', [`${MARCA}%`]);
  await esc.admin.query('delete from negocio.campos_del_crm where campo_id = $1', [CAMPO]);
  await esc.admin.query('delete from negocio.carpetas_del_crm where carpeta_id = $1', [CARPETA]);
}

/** El campo del cuadrante en el catálogo, con su clave. Sin él, `camposDelCuadrante` sale vacío y la columna se apaga. */
async function sembrarElCampoDelCuadrante(): Promise<void> {
  await esc.admin.query(
    `insert into negocio.carpetas_del_crm (org_id, carpeta_id, nombre, visto_el)
       values ($1, $2, 'Prueba', now()) on conflict do nothing`,
    [esc.org, CARPETA],
  );
  await esc.admin.query(
    `insert into negocio.campos_del_crm (org_id, campo_id, nombre, carpeta_id, tipo, posicion, clave, visto_el)
       values ($1, $2, 'Cuadrante de Clasificacion', $3, 'RADIO', '1', $4, now()) on conflict do nothing`,
    [esc.org, CAMPO, CARPETA, CLAVE_DEL_CUADRANTE],
  );
}

before(async () => {
  esc = await montar('CalidadCreativo');
  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

/** Un anuncio en la dimensión, con el nombre de la pieza. */
async function unAnuncio(id: string, nombre: string): Promise<void> {
  await esc.admin.query(
    `insert into negocio.anuncios (org_id, meta_anuncio_id, meta_conjunto_id, meta_campana_id, nombre, objetivo)
       values ($1, $2, '7700', '8800', $3, 'OUTCOME_LEADS')`,
    [esc.org, id, nombre],
  );
}

/**
 * Un contacto atribuido a una pieza.
 *
 * `citas` en número y no booleano: es lo que permite comprobar que dos citas del mismo contacto no
 * cuentan dos veces. `congelada` es una cita sin calendario, o sea una que el CRM ya no devuelve.
 */
async function unLead(o: {
  creativo: string | null;
  campana?: string | null;
  /** El cuadrante ya guardado, como lo deja la sincronización. */
  cuadrante?: string | null;
  citas?: number;
  congeladas?: number;
}): Promise<void> {
  const ghl = `${CONTACTO}${randomUUID().slice(0, 8)}`;
  const atribucion: Record<string, string> = { sessionSource: 'Paid Social' };
  if (o.creativo !== null) atribucion.utmContent = o.creativo;
  if (o.campana != null) atribucion.campaign = o.campana;

  const r = await esc.admin.query<{ id: string }>(
    `insert into negocio.contactos
       (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm, atribucion_primera, cuadrante)
     values ($1, $2, 'Lead de prueba', 'setter', now() - interval '1 day', $3::jsonb, $4)
     returning id`,
    [esc.org, ghl, JSON.stringify(atribucion), o.cuadrante ?? null],
  );
  const id = r.rows[0]?.id;

  for (let i = 0; i < (o.citas ?? 0); i += 1) {
    await esc.admin.query(
      `insert into negocio.citas (org_id, contacto_id, ghl_evento_id, ghl_calendario_id, inicio_el, fin_el, estado_ghl)
         values ($1, $2, $3, 'cal-calcrea', now() - interval '2 hours', now() - interval '1 hour', 'confirmed')`,
      [esc.org, id, `cita-${ghl}-${i}`],
    );
  }
  for (let i = 0; i < (o.congeladas ?? 0); i += 1) {
    await esc.admin.query(
      `insert into negocio.citas (org_id, contacto_id, ghl_evento_id, ghl_calendario_id, inicio_el, fin_el, estado_ghl)
         values ($1, $2, $3, null, now() - interval '2 hours', now() - interval '1 hour', 'confirmed')`,
      [esc.org, id, `fria-${ghl}-${i}`],
    );
  }
}

const leer = (dias = 30) => conOrganizacion(esc.org, () => calidadDelCreativo(dias));

const TOFU = 'NUEVA ERA | TOFU | LEADS | LATAM+USA | 01-09-26';
const BOFU = 'NUEVA ERA | BOFU | AGENDAS | LATAM+USA | 28-08-26';

// ─── LA UNIDAD ──────────────────────────────────────────────────────────────

test('dos anuncios con el mismo nombre son UNA pieza, y la caja no la parte', async () => {
  /* El defecto 1 del encabezado, y la normalización que lo impide. `Evoluciona Native` y
     `evoluciona native ` son la misma pieza: sin `lower(btrim(...))` salen como dos filas de la
     mitad de la gente cada una, ninguna llega al piso, y la tabla entera sale en `null`. */
  await limpiar();
  await unAnuncio(`${MARCA}01`, 'Evoluciona Native');
  await unAnuncio(`${MARCA}02`, 'evoluciona native');
  for (let i = 0; i < 6; i += 1) await unLead({ creativo: 'Evoluciona Native', campana: TOFU });
  for (let i = 0; i < 6; i += 1) await unLead({ creativo: ' evoluciona native ', campana: TOFU });

  const r = await leer();
  const filas = r.filas.filter((f) => f.creativo === 'evoluciona native');

  assert.equal(filas.length, 1, 'la misma pieza salió partida en varias filas');
  assert.equal(filas[0]?.contactos, 12);
  assert.equal(filas[0]?.anunciosDeMeta, 2, 'no contó los dos anuncios que comparten el nombre');
});

test('TOFU y BOFU de la misma pieza son DOS filas, y cada una con su etapa', async () => {
  /* El defecto 2. No es una preferencia de maquetado: son dos poblaciones y la regla 3 prohíbe
     compararlas. Si salieran fundidas, el 100 % del BOFU levantaría la tasa de la pieza entera. */
  await limpiar();
  for (let i = 0; i < 11; i += 1) await unLead({ creativo: 'la pieza', campana: TOFU, citas: 0 });
  for (let i = 0; i < 11; i += 1) await unLead({ creativo: 'la pieza', campana: BOFU, citas: 1 });

  const r = await leer();
  const filas = r.filas.filter((f) => f.creativo === 'la pieza');

  assert.equal(filas.length, 2, 'las dos etapas se fundieron en una sola fila');
  assert.equal(filas.find((f) => f.etapa === 'TOFU')?.tasaDeAgenda, 0);
  assert.equal(filas.find((f) => f.etapa === 'BOFU')?.tasaDeAgenda, 1);
});

test('una variante del nombre de campaña NO parte la etapa', async () => {
  /* Medido en producción: `LATAM+USA` y `LATAM USA` son la misma campaña y partían 45 contactos en
     43 + 2. Leer el nombre entero los separa; leer el SEGMENTO de etapa no. Y normalizar mayúsculas
     tampoco alcanza, porque el `+` no es una mayúscula. */
  await limpiar();
  for (let i = 0; i < 6; i += 1) await unLead({ creativo: 'p', campana: 'NUEVA ERA | BOFU | AGENDAS | LATAM+USA | 28-08-26' });
  for (let i = 0; i < 6; i += 1) await unLead({ creativo: 'p', campana: 'Nueva Era | bofu | agendas | LATAM USA | 28-08-26' });

  const r = await leer();
  const filas = r.filas.filter((f) => f.creativo === 'p');

  assert.equal(filas.length, 1, 'dos escrituras de la misma campaña partieron la pieza');
  assert.equal(filas[0]?.etapa, 'BOFU', 'la etapa no se leyó en minúsculas');
  assert.equal(filas[0]?.contactos, 12);
});

test('el segmento de etapa es EXACTO: contener la palabra no alcanza', async () => {
  /* La diferencia entre `in ('TOFU','BOFU','MOFU')` y un `like '%BOFU%'`, y no es teórica: la
     convención de nombres de esta cuenta mete descripciones en los segmentos, así que
     «BOFU RETARGETING» o «TOFU-BOFU HIBRIDO» son nombres plausibles. Con `like`, el primero se
     clasificaría bien por casualidad y el segundo tomaría la etapa que aparezca primero — o sea que
     una campaña híbrida se contaría entera como una de las dos.
     *
     * Esta prueba nació porque la mutación que cambiaba `in` por `like` SOBREVIVIÓ: la prueba de
     * arriba comprobaba la caja, no la exactitud. */
  await limpiar();
  for (let i = 0; i < 5; i += 1) await unLead({ creativo: 'z', campana: 'NUEVA ERA | BOFU RETARGETING | LATAM' });
  for (let i = 0; i < 4; i += 1) await unLead({ creativo: 'z', campana: 'NUEVA ERA | TOFU-BOFU HIBRIDO | LATAM' });

  const filas = (await leer()).filas.filter((f) => f.creativo === 'z');

  assert.equal(filas.length, 1, 'se les asignó etapa a segmentos que no son la etapa');
  assert.equal(
    filas[0]?.etapa,
    null,
    'un segmento que CONTIENE la palabra se tomó como la etapa; con «TOFU-BOFU» eso elige una de dos al azar',
  );
  assert.equal(filas[0]?.contactos, 9);
});

test('lo que no trae etapa NO se fuerza a ninguna, y se cuenta aparte', async () => {
  await limpiar();
  for (let i = 0; i < 3; i += 1) await unLead({ creativo: 'q', campana: '{{CAMPAIGN.NAME}}' });
  for (let i = 0; i < 2; i += 1) await unLead({ creativo: 'q', campana: null });

  const r = await leer();
  const filas = r.filas.filter((f) => f.creativo === 'q');

  assert.equal(filas.length, 1, 'la plantilla sin expandir y la ausencia son el mismo grupo: sin etapa');
  assert.equal(filas[0]?.etapa, null, 'se le inventó una etapa a lo que no la trae');
  assert.equal(filas[0]?.contactos, 5);
});

test('«sin creativo» es una fila, y la suma da la cohorte entera', async () => {
  // Regla 8. Filtrarlos haría que la tabla no sume la cohorte, y nadie lo notaría.
  await limpiar();
  for (let i = 0; i < 4; i += 1) await unLead({ creativo: 'con nombre', campana: TOFU });
  for (let i = 0; i < 3; i += 1) await unLead({ creativo: null, campana: TOFU });

  const r = await leer();
  const sin = r.filas.find((f) => f.creativo === null);

  assert.ok(sin, '«sin creativo» se descartó en vez de ser un grupo');
  assert.equal(sin?.contactos, 3);
  assert.equal(r.filas.reduce((s, f) => s + f.contactos, 0), 7, 'la tabla no suma la cohorte');
});

// ─── EL PISO, Y LOS DOS DENOMINADORES ───────────────────────────────────────

test('el piso es del DENOMINADOR de cada cifra, y son dos distintos', async () => {
  /* La tasa de agenda se calcula sobre TODOS los contactos de la pieza; la porción de Descarta, sólo sobre los
     clasificados. Son dos denominadores y cada uno responde por el suyo: con doce contactos de los cuales cuatro están
     clasificados, la tasa se publica y la porción no. Usar el mismo denominador para las dos publica una porción de
     cuatro como si fuera de doce. */
  await limpiar();
  await sembrarElCampoDelCuadrante();
  for (let i = 0; i < 4; i += 1) await unLead({ creativo: 'r', campana: TOFU, cuadrante: 'descarta', citas: 1 });
  for (let i = 0; i < 8; i += 1) await unLead({ creativo: 'r', campana: TOFU, citas: 1 });

  const f = (await leer()).filas.find((x) => x.creativo === 'r');

  assert.equal(f?.contactos, 12);
  assert.equal(f?.clasificados, 4, 'el conteo de los clasificados no viaja');
  assert.equal(f?.descarta, 4);
  assert.equal(f?.tasaDeAgenda, 1, 'la tasa tenía denominador suficiente y salió nula');
  assert.equal(f?.porcionDeDescarta, null, `la porción se publicó con ${4} clasificados, bajo el piso de ${PISO_DE_UNA_TASA}`);
});

test('bajo el piso se conserva el CONTEO y se pierde la TASA', async () => {
  await limpiar();
  for (let i = 0; i < 4; i += 1) await unLead({ creativo: 's', campana: TOFU, citas: 1 });

  const f = (await leer()).filas.find((x) => x.creativo === 's');

  assert.equal(f?.contactos, 4);
  assert.equal(f?.agendaron, 4, 'el conteo se perdió junto con la tasa');
  assert.equal(f?.tasaDeAgenda, null, 'una tasa sobre cuatro contactos se publicó como si fuera una tasa');
});

// ─── EL GRANO DE LAS CITAS ──────────────────────────────────────────────────

test('la tasa de agenda cuenta CONTACTOS, no citas', async () => {
  /* El defecto 3, verificado en producción: un `count(*)` sobre el `join` inflaba
     «agendamiento - yaping» de 109 a 112. Acá diez contactos con dos citas cada uno darían 20 de 10,
     o sea 200 %, que es una tasa imposible y perfectamente creíble como número. */
  await limpiar();
  for (let i = 0; i < 10; i += 1) await unLead({ creativo: 't', campana: TOFU, citas: 2 });

  const f = (await leer()).filas.find((x) => x.creativo === 't');

  assert.equal(f?.agendaron, 10, 'se contaron citas y no contactos');
  assert.equal(f?.tasaDeAgenda, 1);
});

test('una cita CONGELADA no cuenta como agenda, y se informa aparte', async () => {
  /* Una cita sin calendario es una que el CRM ya no devuelve: su estado quedó fijo en la foto del
     día que se cortó la sincronización. Contarla como agenda mezcla lo que pasó con lo que no se
     puede saber. */
  await limpiar();
  for (let i = 0; i < 10; i += 1) await unLead({ creativo: 'u', campana: TOFU, congeladas: 1 });

  const r = await leer();
  const f = r.filas.find((x) => x.creativo === 'u');

  assert.equal(f?.agendaron, 0, 'una cita congelada se contó como agenda');
  assert.equal(r.congeladas, 10, 'las congeladas no viajan en la respuesta');
  assert.match(String(r.aviso), /congelad/, 'el aviso no las nombra');
});

test('sin congeladas, el aviso NO las menciona', async () => {
  // La otra mitad: un aviso que aparece siempre es uno que nadie lee, incluido el que importa.
  await limpiar();
  for (let i = 0; i < 12; i += 1) await unLead({ creativo: 'v', campana: TOFU, citas: 1 });

  const r = await leer();

  assert.equal(r.congeladas, 0);
  assert.doesNotMatch(String(r.aviso ?? ''), /congelad/, 'el aviso habla de congeladas cuando no hay');
});

// ─── EL CUADRANTE ───────────────────────────────────────────────────────────

test('los calificados son Prioriza, Valida y Financia, hayan agendado o no; Descarta y sin clasificar no', async () => {
  await limpiar();
  await sembrarElCampoDelCuadrante();
  for (const cuadrante of ['prioriza', 'valida', 'financia', 'descarta', null]) {
    await unLead({ creativo: 'w', campana: TOFU, cuadrante });
    await unLead({ creativo: 'w', campana: TOFU, cuadrante, citas: 1 });
  }

  const f = (await leer()).filas.find((x) => x.creativo === 'w');

  assert.equal(f?.contactos, 10, 'la consulta perdió filas');
  assert.equal(f?.calificados, 6, 'los calificados no son los tres cuadrantes, con y sin cita');
  assert.equal(f?.clasificados, 8, 'el sin clasificar entró entre los clasificados');
  assert.equal(f?.descarta, 2);
});

test('si el campo del cuadrante no está en el catálogo, la columna se APAGA y lo dice', async () => {
  /* El campo se reconoce por su clave: si el CRM de la empresa no lo tiene, lo honesto es apagar la columna —publicar
     ceros afirmaría que nadie califica—. */
  await limpiar(); // se lleva el campo sembrado
  for (let i = 0; i < 12; i += 1) await unLead({ creativo: 'x', campana: TOFU });

  const r = await leer();
  const f = r.filas.find((x) => x.creativo === 'x');

  assert.equal(r.campoDelCuadrante, null);
  assert.equal(f?.porcionDeDescarta, null, 'se publicó una porción con un campo que no existe');
  assert.equal(f?.clasificados, 0);
  assert.match(String(r.aviso), /contact\.cuadrante_de_clasificacion/, 'el aviso no nombra el campo');
  // Con un solo cliente, el aviso de siempre: ni su nombre, ni «no se leyó su catálogo» (aquí no se leyó).
  assert.ok(String(r.aviso).startsWith('El CRM de esta empresa no tiene el campo del cuadrante'), String(r.aviso));
  assert.doesNotMatch(String(r.aviso), /Todavía no se leyó|El CRM de «/, 'con un solo cliente el aviso habló de clientes');
});

// ─── EL PUENTE ──────────────────────────────────────────────────────────────

test('el puente separa las TRES poblaciones, y el denominador son todos los contactos', async () => {
  /* ── EL DENOMINADOR ERA MÁS CHICO QUE EL RÓTULO ────────────────────────────
   *
   * `sobre` contaba sólo los contactos que traen `utmContent`, y la pantalla lo rotulaba
   * «**Contactos** que se pudieron asociar a una pieza». Medido el 2026-09-19 sobre 30 días de
   * producción: **307 de 321 da 95,6 % y 307 de 347 da 88,5 %** — siete puntos de más en la cifra
   * que la pantalla usa para decir cuánto vale todo lo demás que dibuja.
   *
   * Peor: la nota explicaba que los que no cruzan *«son tráfico que no viene de un anuncio de
   * Meta»*, describiendo a los que el denominador ya había dejado afuera.
   *
   * El escenario de acá tiene las tres poblaciones y las tres se afirman por separado, porque
   * mandan a hacer cosas distintas: los que cruzan, el que no trae nombre (no hay nada que
   * arreglar) y los que traen un nombre que no existe (puede ser un renombre en Meta). Sumar las
   * dos últimas esconde la única investigable. */
  await limpiar();
  await unAnuncio(`${MARCA}03`, 'una pieza real');
  for (let i = 0; i < 3; i += 1) await unLead({ creativo: 'una pieza real', campana: TOFU });
  for (let i = 0; i < 2; i += 1) await unLead({ creativo: 'link_in_bio', campana: TOFU });
  await unLead({ creativo: null, campana: TOFU });

  const r = await leer();

  assert.equal(r.puente.sobre, 6, 'el denominador tiene que ser TODOS los contactos de la ventana');
  assert.equal(r.puente.con, 3, 'el numerador no son los que cruzan contra un anuncio real');
  assert.equal(r.puente.sinNombre, 1, 'el contacto sin `utmContent` no se contó aparte');
  /* Y la resta tiene que cerrar: los dos `link_in_bio` son la tercera población, y si alguna de las
     tres se moviera sin las otras esto lo diría. */
  assert.equal(r.puente.sobre - r.puente.con - r.puente.sinNombre, 2);
});

test('la porción de Descarta es sobre los clasificados, no sobre todos los contactos', async () => {
  /* Diez clasificados —tres en Descarta— y cinco sin clasificar: la porción es 3 de 10, no 3 de 15. Dividir por los
     contactos la achicaría justo en las piezas donde el CRM clasificó menos. */
  await limpiar();
  await sembrarElCampoDelCuadrante();
  await unAnuncio(`${MARCA}40`, 'pieza de descarta');
  for (let i = 0; i < 3; i += 1) await unLead({ creativo: 'pieza de descarta', campana: TOFU, cuadrante: 'descarta' });
  for (let i = 0; i < 7; i += 1) await unLead({ creativo: 'pieza de descarta', campana: TOFU, cuadrante: 'valida' });
  for (let i = 0; i < 5; i += 1) await unLead({ creativo: 'pieza de descarta', campana: TOFU });

  const f = (await leer()).filas.find((x) => x.creativo === 'pieza de descarta');

  assert.equal(f?.clasificados, 10, 'el piso necesita diez clasificados: sin eso la porción sale nula');
  assert.equal(f?.porcionDeDescarta, 0.3, `salió ${f?.porcionDeDescarta}: 3 de 10 clasificados, no 3 de 15 contactos`);
});
