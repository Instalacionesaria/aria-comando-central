// EL RELLENO DEL CUADRANTE, lo que se ve sin base. Tipo: Código.
//
// La parte que corre contra la base (quién entra, la escritura, la historia de la `109`, el deshacer, el seco del guion)
// está en `pruebas/base/337-el-relleno-del-cuadrante.test.ts`. Acá:
//
//   · `escribirCampoDelContacto`: un PUT a `/contacts/{id}` con SÓLO `customFields` —nunca `tags`, que en un PUT
//     reemplazan la lista entera—, únicamente con las cuatro palabras o el vacío, y los rechazos traducidos como en el
//     resto del cliente — mutaciones: tags en el cuerpo, sin la validación, sin traducir el rechazo;
//   · el valor por el puntaje viejo, con los bordes con decimales: 74,99 → Valida, 75 → Prioriza, 49,99 y nulo →
//     Descarta — mutaciones: `>` en vez de `>=`, el nulo a otro valor;
//   · nadie más escribe campos del CRM: el único PUT de contactos es éste y sólo lo usa el relleno, que sólo usa el
//     guion; el relleno reutiliza los predicados de `citasAlcanzables.ts` y no copia literales;
//   · la `109` es reaplicable y documentada; la guía de producción existe (local).

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, archivosFuente } from '../apoyo/fuente.ts';
import { escribirCampoDelContacto } from '../../lib/ghl/cliente.ts';
import { corteDe, valorPorPuntaje } from '../../lib/negocio/rellenoDelCuadrante.ts';

const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8');
const SIN_DOCS = existsSync(join(RAIZ, 'docs')) ? false : 'docs/ es local y no está en este clon';
const GHL = 'https://services.leadconnectorhq.com';

/** Corre `trabajo` con un fetch falso que contesta `estado` y anota los pedidos. */
async function conFetch<T>(estado: number, trabajo: () => Promise<T>): Promise<{ r: T; pedidos: { url: string; init: RequestInit | undefined }[] }> {
  const original = globalThis.fetch;
  const pedidos: { url: string; init: RequestInit | undefined }[] = [];
  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    pedidos.push({ url: String(entrada), init });
    return new Response(JSON.stringify(estado === 200 ? { succeded: true } : { message: 'x' }), { status: estado, headers: { 'content-type': 'application/json' } });
  }) as typeof globalThis.fetch;
  try {
    return { r: await trabajo(), pedidos };
  } finally {
    globalThis.fetch = original;
  }
}

test('escribirCampoDelContacto: un PUT con sólo el campo, nunca tags', async () => {
  const { r, pedidos } = await conFetch(200, () => escribirCampoDelContacto({ token: 'tk' }, 'c/1', 'campo-1', 'Prioriza'));
  assert.deepEqual(r, { tipo: 'datos', datos: { escrito: 'Prioriza' } });
  assert.equal(pedidos.length, 1);
  const p = pedidos[0]!;
  assert.equal(p.url, `${GHL}/contacts/c%2F1`);
  assert.equal(p.init?.method, 'PUT');
  const h = new Headers(p.init?.headers);
  assert.equal(h.get('Version'), '2021-07-28');
  assert.equal(h.get('Authorization'), 'Bearer tk');
  assert.deepEqual(JSON.parse(String(p.init?.body)), { customFields: [{ id: 'campo-1', field_value: 'Prioriza' }] });
  assert.doesNotMatch(String(p.init?.body), /tags/i);

  // El vacío deshace.
  const vacio = await conFetch(200, () => escribirCampoDelContacto({ token: 'tk' }, 'c1', 'campo-1', ''));
  assert.deepEqual(JSON.parse(String(vacio.pedidos[0]!.init?.body)), { customFields: [{ id: 'campo-1', field_value: '' }] });
});

test('escribirCampoDelContacto: sólo las cuatro palabras o el vacío, y sin llamar si no', async () => {
  for (const malo of ['Prioridad', 'prioriza', 'Válida', 'Prioriza ', 'Descartar', 'Educar', undefined, null, 75]) {
    const { pedidos } = await conFetch(200, async () => {
      await assert.rejects(escribirCampoDelContacto({ token: 'tk' }, 'c1', 'campo-1', malo as never), /no es una opción del cuadrante/);
    });
    assert.equal(pedidos.length, 0, `llamó al CRM con ${JSON.stringify(malo)}`);
  }
  for (const bueno of ['Prioriza', 'Valida', 'Financia', 'Descarta', ''] as const) {
    const { r } = await conFetch(200, () => escribirCampoDelContacto({ token: 'tk' }, 'c1', 'campo-1', bueno));
    assert.equal(r.tipo, 'datos', bueno);
  }
  await assert.rejects(escribirCampoDelContacto({ token: 'tk' }, '', 'campo-1', 'Valida'), /falta el contacto/);
  await assert.rejects(escribirCampoDelContacto({ token: 'tk' }, 'c1', ' ', 'Valida'), /falta el campo/);
});

test('escribirCampoDelContacto: 401 y 403 son el token, 429 es esperar, 404 y 500 son rechazos', async () => {
  const casos: [number, unknown][] = [
    [401, { tipo: 'no_autorizado', estado: 401 }],
    [403, { tipo: 'no_autorizado', estado: 403 }],
    [429, { tipo: 'demasiadas_peticiones', estado: 429 }],
  ];
  for (const [estado, fallo] of casos) {
    const { r } = await conFetch(estado, () => escribirCampoDelContacto({ token: 'tk' }, 'c1', 'campo-1', 'Valida'));
    assert.deepEqual(r, { tipo: 'fallo', fallo }, String(estado));
  }
  for (const estado of [404, 500]) {
    const { r } = await conFetch(estado, () => escribirCampoDelContacto({ token: 'tk' }, 'c1', 'campo-1', 'Valida'));
    assert.equal(r.tipo, 'fallo');
    assert.equal(r.tipo === 'fallo' && r.fallo.tipo, 'rechazado', String(estado));
    assert.equal(r.tipo === 'fallo' && r.fallo.tipo === 'rechazado' && r.fallo.estado, estado);
  }
});

test('el valor por el puntaje viejo: 75 o más Prioriza, 50 a menos de 75 Valida, el resto y sin puntaje Descarta', () => {
  const casos: [number | null | undefined, string][] = [
    [100, 'Prioriza'],
    [75, 'Prioriza'],
    [74.99, 'Valida'],
    [50, 'Valida'],
    [49.99, 'Descarta'],
    [0, 'Descarta'],
    [null, 'Descarta'],
    [undefined, 'Descarta'],
    [Number.NaN, 'Descarta'],
  ];
  for (const [score, valor] of casos) assert.equal(valorPorPuntaje(score), valor, String(score));
  assert.equal(corteDe('2026-10-26').toISOString(), '2026-10-26T00:00:00.000Z');
  for (const malo of ['2026-10-32', '26/10/2026', '2026-1-26', '']) assert.throws(() => corteDe(malo), String(malo));
});

test('nadie más escribe campos del CRM: un solo PUT de contactos, usado sólo por el relleno, usado sólo por el guion', () => {
  const fuentes = archivosFuente(['app', 'components', 'lib', 'scripts']);
  // Un PUT hacia afuera (las rutas propias usan `pedir`, no `pedirExterno`).
  const PUT_EXTERNO = /pedirExterno(?:<[^>]*>)?\([^;]*?metodo:\s*'PUT'/g;
  const conPut = fuentes.filter((a) => new RegExp(PUT_EXTERNO.source).test(a.limpio)).map((a) => a.ruta);
  assert.deepEqual(conPut, ['lib/ghl/cliente.ts']);
  assert.equal((fuentes.find((a) => a.ruta === 'lib/ghl/cliente.ts')!.limpio.match(PUT_EXTERNO) ?? []).length, 1);
  // El cuerpo se arma adentro, con una sola clave.
  const cliente = fuentes.find((a) => a.ruta === 'lib/ghl/cliente.ts')!.limpio;
  const cuerpo = cliente.slice(cliente.indexOf('export async function escribirCampoDelContacto'));
  assert.match(cuerpo, /cuerpo: \{ customFields: \[\{ id: campoId, field_value: valor \}\] \},/);
  assert.doesNotMatch(cuerpo, /tags/);

  const usan = (nombre: string) => fuentes.filter((a) => new RegExp(`\\b${nombre}\\b`).test(a.limpio)).map((a) => a.ruta).sort();
  assert.deepEqual(usan('escribirCampoDelContacto'), ['lib/ghl/cliente.ts', 'lib/negocio/rellenoDelCuadrante.ts']);
  assert.deepEqual(
    fuentes.filter((a) => /rellenoDelCuadrante\.ts/.test(a.limpio)).map((a) => a.ruta),
    ['scripts/clasificar-calificados-viejos.mjs'],
    'el relleno lo llama algo más que el guion (una ruta, una tarea)',
  );
});

test('el relleno reutiliza los predicados de citasAlcanzables y no copia literales', () => {
  const relleno = archivosFuente(['lib']).find((a) => a.ruta === 'lib/negocio/rellenoDelCuadrante.ts')!.limpio;
  for (const p of ['tieneCitaAlcanzable', 'contactoDescartado', 'todasSusCitasCanceladas', 'alcanzable']) {
    assert.match(relleno, new RegExp(`\\$\\{${p}\\('`), `no usa ${p}`);
  }
  assert.doesNotMatch(relleno, /ghl_calendario_id|estado_ghl|'cancel|'canceled'|'cancelada'|unnest\(|icp_rechazado|'rechazado'/, 'copió un literal de los predicados');
  // La primera reserva es la MENOR de sus citas alcanzables, con la reserva antes que el inicio.
  assert.match(relleno, /min\(coalesce\(pr\.reservada_el, pr\.inicio_el\)\)/);
  // La relectura de lo escrito va como persona, dentro de la transacción.
  assert.match(relleno, /conOrganizacion\(ambito, \(\) =>\s*comoPersona\(campoId, async \(\) => \{\s*const r = await refrescarUnContacto\(acceso, ghlContactId\);/);

  const guion = archivosFuente(['scripts']).find((a) => a.ruta === 'scripts/clasificar-calificados-viejos.mjs')!.limpio;
  assert.doesNotMatch(guion, /negocio\.|selectFrom\('contactos'\)|pedirExterno|(?<!org)\.nombre\b/, 'el guion consulta por su cuenta o puede imprimir nombres de contactos');
  // En seco por omisión: escribe sólo con --escribir, y las credenciales se resuelven sólo para escribir.
  assert.match(guion, /const escribe = b\.escribir;/);
  assert.match(guion, /acceso: escribe \? await resolverAccesoAGhl\(db, org\.id, cuenta\) : null/);
  // El tope es de la corrida: cada cliente recibe lo que queda y lo descuenta (con dos clientes, `--tope 25` no son 50).
  assert.doesNotMatch(guion, /tope: b\.tope/, 'cada cliente recibe el tope entero');
  assert.equal((guion.match(/tope: restante,/g) ?? []).length, 2);
  assert.equal((guion.match(/restante -= t\.escritos;/g) ?? []).length, 2);
  // El deshacer vacía el campo del cuadrante del cliente, no el que diga el diario.
  assert.match(guion, /correrElDeshacer\(\{ ambito, acceso, campoId: campo,/);
});

test('la 109 es reaplicable y documentada, y lee las variables con su valor de antes por omisión', () => {
  const m = leer('db/migraciones/109_quien_clasifico.sql');
  const sinComentarios = m.replace(/--[^\n]*/g, '');
  for (const f of ['registrar_cambio_de_cuadrante', 'registrar_respuestas_del_crm']) {
    assert.match(sinComentarios, new RegExp(`create or replace function negocio\\.${f}\\(\\) returns trigger`));
    assert.match(sinComentarios, new RegExp(`comment on function negocio\\.${f}\\(\\) is`));
  }
  assert.match(sinComentarios, /coalesce\(nullif\(btrim\(current_setting\('negocio\.origen_de_clasificacion', true\)\), ''\), 'crm'\)/);
  assert.match(sinComentarios, /coalesce\(nullif\(btrim\(current_setting\('negocio\.obtenida_por', true\)\), ''\), 'crm'\)/);
  assert.match(sinComentarios, /nullif\(btrim\(current_setting\('negocio\.obtenida_por_campo', true\)\), ''\)/);
  assert.match(sinComentarios, /insert into catalogo\.vias_de_obtencion \(clave, nombre, descripcion\) values\s+\('persona',[^;]*on conflict do nothing;/);
  // Sin tocar tablas ni disparadores: sólo las funciones y una fila de catálogo.
  assert.doesNotMatch(sinComentarios, /\bdrop\b|\bdelete\b|\balter\b|create trigger|\btruncate\b/i);
  // Y el comparador de la vía de la persona: sólo para el campo nombrado, o para todos si no hay ninguno.
  assert.match(sinComentarios, /case when v_campo is null or x\.campo = v_campo then v_via else 'crm' end/);
});

test('la guía de producción del relleno existe, con el seco, el de a uno, el deshacer y las tandas', { skip: SIN_DOCS }, () => {
  const g = leer('docs/4-produccion/RELLENO-DEL-CUADRANTE.md');
  for (const c of [
    /scripts\/clasificar-calificados-viejos\.mjs --org aria\n/,
    /--org aria --muestra 5/,
    /--org aria --solo <ID> --escribir/,
    /--org aria --deshacer <DIARIO> --solo <ID> --escribir/,
    /--org aria --escribir --tope 25/,
    /workflows?/i,
  ]) {
    assert.match(g, c);
  }
});
