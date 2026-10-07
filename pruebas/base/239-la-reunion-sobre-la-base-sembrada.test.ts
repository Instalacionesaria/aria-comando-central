// LA REUNIÓN DE HOY SOBRE LA BASE SEMBRADA: LOS TEMAS EXACTOS, UNA VEZ POR DÍA. Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// AG15 de los agentes (`docs/OTROS/agentes/04-LA-REUNION-Y-LA-CABECERA.md`, AG-70 y AG-71): la pasada diaria,
// después de los detectores, mide la Reunión y guarda todos sus temas en `negocio.reuniones_del_dia`, sobre
// `db/sembrado/casos-de-los-agentes.ts`:
//
//   · los cinco temas exactos, con su etiqueta, su sección y su texto, en el orden de las reglas;
//   · la entrada de la semana se cuenta en días de la empresa, igual que un conteo directo por rango de horas;
//   · con llave, el modelo —falso— la ordena y la redacta, y se guarda lo que pasó la validación, con su uso;
//     un tema que el modelo no nombró queda al final con su plantilla;
//   · el mismo día no vuelve a medirla; sin la fila, la hora siguiente la rehace sin volver a medir los
//     departamentos.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { cerrarTodo, conectar, filas } from '../apoyo/conexiones.ts';
import { cerrarClientes } from '../../lib/datos/capa.ts';
import { conOrganizacion } from '../../lib/datos/contexto.ts';
import { ZONA_DE_LOS_CASOS, quitarEmpresasDeLosAgentes, sembrarCasosDeLosAgentes, type EmpresasDeLosAgentes } from '../../db/sembrado/casos-de-los-agentes.ts';
import { correrLaPasada } from '../../lib/agentes/detectores/correr.ts';
import { medirLaReunion, REU } from '../../lib/agentes/reunion/temas.ts';
import { temasEnSuOrden, ultimaReunion } from '../../lib/agentes/reunion/guardar.ts';
import { diaEnZona } from '../../lib/negocio/tiempo.ts';

const PREFIJO = 'agentes-239-';
const TOKIO = 'Asia/Tokyo';
let admin: Client;
let e: EmpresasDeLosAgentes;

before(async () => {
  admin = await conectar('admin');
  e = await sembrarCasosDeLosAgentes(PREFIJO);
});
after(async () => {
  await quitarEmpresasDeLosAgentes(PREFIJO);
  await cerrarClientes();
  await cerrarTodo();
});

const org = () => ({ id: e.conDatos, zonaHoraria: ZONA_DE_LOS_CASOS });
const hoy = () => diaEnZona(new Date(), ZONA_DE_LOS_CASOS);
const reuniones = () =>
  filas<{ dia: string; temas: { regla: string; etiqueta: string; seccion: string; gravedad: string; texto: string }[] }>(
    admin,
    `select to_char(dia, 'YYYY-MM-DD') as dia, temas from negocio.reuniones_del_dia where org_id = $1`,
    [e.conDatos],
  );

test('la pasada guarda los cinco temas de la base sembrada, en el orden de las reglas', async () => {
  // Las 12:00 de hoy en la zona de los casos: le toca, y el sembrado es relativo a hoy.
  const r = await correrLaPasada(org(), { ahora: new Date(`${hoy()}T17:00:00Z`) });
  assert.ok(r.tocaba);
  // Sin llave, el orden de las reglas y las plantillas: no se llama al modelo.
  assert.deepEqual(r.reunion, { estado: 'corrio', temas: 5, redaccion: 'sin_llave' });
  const [g, ...otras] = await reuniones();
  assert.deepEqual(otras, []);
  assert.equal(g!.dia, hoy());
  assert.deepEqual(
    g!.temas.map((t) => [t.regla, t.etiqueta, t.seccion, t.gravedad, t.texto]),
    [
      // La pauta parada: crítica, de Acquisition, la de 7 días.
      [REU.sinEntrega, 'SIN DATOS NUEVOS', 'acquisition', 'critica', 'Ninguna de las 2 campañas activas que entregaban en los últimos 60 días entrega desde hace 15 días cerrados.'],
      // La concentración de Webinar, que pide validación ejecutiva.
      ['ACQ-CONCENTRACION', 'CADENA', 'acquisition', 'media', 'Webinar - agenda: Se lleva el 67 % del gasto de la ventana, entre 3 campañas con gasto. Sobre los últimos 30 días; requiere validación ejecutiva.'],
      [REU.citasSinRegistrar, 'SIN REGISTRAR', 'closer', 'media', '43 de 46 contactos tuvieron una cita que ya ocurrió y nadie registró si se presentaron.'],
      [REU.llamadasSinVinculo, 'SIN LECTOR', 'analizadores', 'media', '10 de 38 llamadas de venta analizadas en 30 días no se pueden vincular a un contacto: su análisis no se usa.'],
      [REU.objecionFrecuente, 'PATRÓN', 'analizadores', 'media', 'La objeción «precio» crece: 9 en 14 días, contra 3 antes.'],
    ],
  );
});

test('la entrada de la semana se cuenta en días de la empresa', async () => {
  // Medida en Tokio, para que la frontera no coincida con la de la sesión de la base (UTC o Lima): dos contactos
  // a las 00:30 de Tokio, que en UTC y en Lima todavía son del día anterior. El de hace 7 días es de esta semana;
  // el de hace 14, de la anterior.
  await admin.query(
    `with hoy as (select (now() at time zone $2)::date as d)
     insert into negocio.contactos (org_id, ghl_contact_id, nombre, territorio, alta_en_el_crm)
     select $1, 'reunion-239-' || n, 'Lead de prueba', 'setter', ((hoy.d - n)::timestamp + interval '30 minutes') at time zone $2
       from hoy, unnest(array[7, 14]) as n`,
    [e.conDatos, TOKIO],
  );
  try {
    const m = await conOrganizacion(e.conDatos, () => medirLaReunion(TOKIO));
    // El mismo corte, por rango de horas: desde la medianoche local de hace N días hasta la de hace M.
    const contar = async (desde: number, hasta: number) =>
      Number(
        (
          await filas<{ n: string }>(
            admin,
            `with hoy as (select (now() at time zone $2)::date as d)
             select count(*)::text as n from negocio.contactos, hoy
              where org_id = $1
                and alta_en_el_crm >= ((hoy.d - $3::int)::timestamp at time zone $2)
                and alta_en_el_crm < ((hoy.d - $4::int)::timestamp at time zone $2)`,
            [e.conDatos, TOKIO, desde, hasta],
          )
        )[0]!.n,
      );
    assert.deepEqual(m.entrada, { semana: await contar(7, 0), anterior: await contar(14, 7) });
  } finally {
    await admin.query(`delete from negocio.contactos where org_id = $1 and ghl_contact_id like 'reunion-239-%'`, [e.conDatos]);
  }
});

test('el mismo día no vuelve a medirla; sin la fila, la rehace sin volver a medir los departamentos', async () => {
  // Sin el sello de la tarea (lo pone el cron, no la pasada) entra, pero no mide ni guarda nada.
  const otra = await correrLaPasada(org(), { ahora: new Date(`${hoy()}T18:00:00Z`) });
  assert.ok(otra.tocaba);
  assert.deepEqual(otra.departamentos.map((d) => d.estado), ['ya_corrio', 'ya_corrio', 'ya_corrio', 'ya_corrio']);
  assert.deepEqual(otra.reunion, { estado: 'ya_corrio' });
  // Con el sello de hoy, ni entra.
  await admin.query(
    `insert into negocio.tareas_programadas (org_id, tarea, ultima_corrida_el, ultimo_estado) values ($1, 'senales', now(), 'corrio')
     on conflict (org_id, tarea) do update set ultima_corrida_el = now(), ultimo_estado = 'corrio'`,
    [e.conDatos],
  );
  assert.deepEqual(await correrLaPasada(org(), { ahora: new Date(`${hoy()}T18:00:00Z`) }), { tocaba: false, porque: 'ya corrió hoy' });

  // Sin la fila de hoy, sellada y todo, entra por la Reunión.
  await admin.query('delete from negocio.reuniones_del_dia where org_id = $1', [e.conDatos]);
  const planesAntes = await filas<{ n: string }>(admin, 'select count(*)::text as n from negocio.planes_de_accion where org_id = $1', [e.conDatos]);
  const rehecha = await correrLaPasada(org(), { ahora: new Date(`${hoy()}T19:00:00Z`) });
  assert.ok(rehecha.tocaba);
  assert.deepEqual(rehecha.departamentos.map((d) => d.estado), ['ya_corrio', 'ya_corrio', 'ya_corrio', 'ya_corrio']);
  assert.deepEqual(rehecha.reunion, { estado: 'corrio', temas: 5, redaccion: 'sin_llave' });
  assert.deepEqual(await filas(admin, 'select count(*)::text as n from negocio.planes_de_accion where org_id = $1', [e.conDatos]), planesAntes);
  assert.equal((await reuniones()).length, 1);
});

test('con llave, el modelo la ordena y la redacta; lo que no pasa la validación queda con su plantilla', async () => {
  await admin.query('delete from negocio.reuniones_del_dia where org_id = $1', [e.conDatos]);
  await admin.query(`delete from negocio.uso_de_ia where org_id = $1 and agente = 'reunion'`, [e.conDatos]);
  /* El modelo falso invierte el orden y deja afuera el primero de ese orden invertido; repite cada texto con «Hoy:» adelante, salvo
     uno, al que le agrega el nombre de otra área: ése se quita. Cualquier otro pedido lanza. */
  const original = globalThis.fetch;
  let llamadas = 0;
  let clavesDeLosTemas: string[] = [];
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url) !== 'https://api.anthropic.com/v1/messages') throw new Error(`la prueba no esperaba un pedido a ${String(url)}`);
    llamadas += 1;
    const cuerpo = JSON.parse(String(init?.body)) as { messages: { content: string }[] };
    const { temas } = JSON.parse(cuerpo.messages[0]!.content) as { temas: { clave: string; texto: string; origen: string }[] };
    clavesDeLosTemas = [...new Set(temas.flatMap((t) => Object.keys(t)))].sort();
    const orden = temas.map((t) => t.clave).reverse().slice(1);
    const frases = temas.map((t) => ({ clave: t.clave, frase: t.origen === 'Sales · Closer' ? `${t.texto} Mira también Acquisition.` : `Hoy: ${t.texto}` }));
    return new Response(
      JSON.stringify({
        content: [{ type: 'text', text: JSON.stringify({ orden, temas: frases }) }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 700, output_tokens: 300, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof globalThis.fetch;
  try {
    const r = await correrLaPasada(org(), { ahora: new Date(`${hoy()}T20:00:00Z`), llave: 'sk-de-prueba-239' });
    assert.ok(r.tocaba);
    assert.deepEqual(r.reunion, { estado: 'corrio', temas: 5, redaccion: 'redactada' });
    assert.equal(llamadas, 1, 'la Reunión se redacta en un solo pedido');
    // La etiqueta no viaja: el modelo la tomaba por el problema (`07`, la evaluación del 2026-10-06).
    assert.deepEqual(clavesDeLosTemas, ['clave', 'gravedad', 'origen', 'texto']);
  } finally {
    globalThis.fetch = original;
  }
  const g = await conOrganizacion(e.conDatos, () => ultimaReunion());
  assert.deepEqual(g!.redaccion!.quitadas, { cifra: 0, superlativo: 0, cruzada: 1, otras: 0 });
  assert.deepEqual(
    temasEnSuOrden(g!).map((t) => [t.regla, t.texto.startsWith('Hoy: ')]),
    [
      // El orden del modelo: los cuatro que nombró, al revés.
      [REU.llamadasSinVinculo, true],
      // La frase que nombró otra área se quitó: queda la plantilla.
      [REU.citasSinRegistrar, false],
      ['ACQ-CONCENTRACION', true],
      [REU.sinEntrega, true],
      // El que no nombró, al final, con la frase que redactó.
      [REU.objecionFrecuente, true],
    ],
  );
  const uso = await filas<{ n: string }>(admin, `select count(*)::text as n from negocio.uso_de_ia where org_id = $1 and agente = 'reunion'`, [e.conDatos]);
  assert.equal(uso[0]!.n, '1');
});

