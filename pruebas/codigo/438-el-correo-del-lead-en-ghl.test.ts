// EL CORREO DEL LEAD EN GHL. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `contactoPorCorreo` (lib/ghl/cliente.ts) busca en GHL al lead de una llamada de Fathom cuando su correo no está en
// nuestra base (la 123). Un error acá trae al contacto equivocado y le guarda la transcripción a otro. Lo que se cuida:
//
//   · el pedido: `eq` sobre `email`, con la location, el correo en minúsculas;
//   · la respuesta: sólo vale un contacto con EXACTAMENTE ese correo, aunque GHL mande otros;
//   · un correo sin «@» no se pregunta, y un fallo de GHL vuelve como fallo (no como «no está»).
//
// Sin red: `globalThis.fetch` se reemplaza.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { contactoPorCorreo } from '../../lib/ghl/cliente.ts';
import { textoDelFallo } from '../../lib/fathom/ghl.ts';

const fetchOriginal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

const ACCESO = { token: 'pit-de-prueba', locationId: 'loc-438' };

function responder(estado: number, cuerpo: unknown, pedidos: { url: string; cuerpo: unknown }[] = []): void {
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    pedidos.push({ url: String(url), cuerpo: init?.body ? JSON.parse(String(init.body)) : null });
    return new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

test('pide la búsqueda con eq sobre email, la location y el correo en minúsculas', async () => {
  const pedidos: { url: string; cuerpo: unknown }[] = [];
  responder(200, { contacts: [] }, pedidos);
  await contactoPorCorreo(ACCESO, '  Lead@Ejemplo.COM ');
  assert.equal(pedidos.length, 1);
  assert.match(pedidos[0]!.url, /\/contacts\/search$/);
  const cuerpo = pedidos[0]!.cuerpo as { locationId: string; filters: unknown[] };
  assert.equal(cuerpo.locationId, 'loc-438');
  assert.deepEqual(cuerpo.filters, [{ field: 'email', operator: 'eq', value: 'lead@ejemplo.com' }]);
});

test('sólo devuelve el contacto que tiene exactamente ese correo', async () => {
  responder(200, {
    contacts: [
      { id: 'otro', email: 'juan.lead@ejemplo.com' },
      { id: 'bueno', email: ' LEAD@ejemplo.com' },
    ],
  });
  const r = await contactoPorCorreo(ACCESO, 'lead@ejemplo.com');
  assert.equal(r.tipo, 'datos');
  assert.equal(r.tipo === 'datos' ? r.datos?.id : null, 'bueno');
});

test('si GHL no tiene ese correo, devuelve null (no es un fallo)', async () => {
  responder(200, { contacts: [{ id: 'x', email: 'otro@ejemplo.com' }] });
  const r = await contactoPorCorreo(ACCESO, 'lead@ejemplo.com');
  assert.deepEqual(r, { tipo: 'datos', datos: null });
});

test('un correo sin @ no se pregunta', async () => {
  const pedidos: { url: string; cuerpo: unknown }[] = [];
  responder(200, { contacts: [] }, pedidos);
  assert.deepEqual(await contactoPorCorreo(ACCESO, 'sin-arroba'), { tipo: 'datos', datos: null });
  assert.equal(pedidos.length, 0);
});

test('un fallo de GHL vuelve como fallo, y su texto no lleva el token', async () => {
  responder(401, { message: 'Invalid JWT' });
  const r = await contactoPorCorreo(ACCESO, 'lead@ejemplo.com');
  assert.equal(r.tipo, 'fallo');
  if (r.tipo === 'fallo') {
    assert.equal(r.fallo.tipo, 'no_autorizado');
    assert.doesNotMatch(textoDelFallo(r.fallo), /pit-de-prueba/);
  }
});
