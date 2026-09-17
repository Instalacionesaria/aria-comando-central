// ADR-0206 — Con la organización A no se ve ni una fila de la B. INNEGOCIABLE.
// Tipo: Base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// UN 500 QUE OCURRIÓ EN PRODUCCIÓN, Y QUE NINGUNA PRUEBA PODÍA VER
//
// El 2026-09-17, sobre la subcuenta `innat8`: cargar la clave de IA desde una cuenta **de la propia
// subcuenta** funciona; hacerlo desde un **superadministrador de la organización principal** da
// `Rechazado (500)`. Reproducido por quien lo reportó con las dos cuentas.
//
// La causa no está en la clave ni en la pantalla. Dieciséis tablas atan su columna de «quién lo
// tocó» con una foránea COMPUESTA:
//
//     foreign key (org_id, actualizado_por) references identidad.usuarios (org_id, id)
//
// Un rol de plataforma trabajando sobre otra organización tiene `orgEfectiva` de la subcuenta y
// `usuarioId` de la principal. Ese par **no existe**, PostgreSQL rechaza con `23503`, nadie lo
// atrapa, y sale un 500 sin diagnóstico.
//
// ── POR QUÉ NINGUNA PRUEBA LO ATRAPABA ────────────────────────────────────
//
// Porque todas las que escriben credenciales lo hacen **con un usuario de la organización de
// destino**, que es el caso que siempre funcionó. La delegación se probaba en el portero —quién ve
// qué— y la escritura se probaba con el dueño. Nadie cruzó las dos, y el defecto vive justo en el
// cruce.
//
// Por eso este archivo no prueba el ayudante en aislamiento: **llama a la ruta de verdad**, con una
// sesión de rol de plataforma y `org_activa` puesta. Un `autorDelCambio(contexto)` que devolviera
// lo correcto y una ruta que no lo usara dejarían la suite en verde sobre el mismo 500.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { sql } from 'kysely';
import type { Client } from 'pg';
import { conectar, cerrarTodo } from '../apoyo/conexiones.ts';
import { conIdentidad, cerrarClientes } from '../../lib/datos/capa.ts';
import { hashDeToken, COOKIE_SESION } from '../../lib/autorizacion/sesion.ts';
import { autorDelCambio } from '../../lib/autorizacion/sesion.ts';
import { PUT as guardarCredenciales } from '../../app/api/admin/credenciales/route.ts';

const DOMINIO = 'ejemplo.test';

let admin: Client;
let fundadora: { id: string; org: string };
let orgBeta: string;

before(async () => {
  process.env.DOMINIO_ESPERADO = DOMINIO;
  admin = await conectar('admin');

  const filas = await admin.query<{ id: string; org_id: string; slug: string }>(
    `select u.id, u.org_id, o.slug
       from identidad.usuarios u join identidad.organizaciones o on o.id = u.org_id
      where o.slug in ('principal', 'beta')`,
  );
  const f = filas.rows.find((x) => x.slug === 'principal');
  const b = filas.rows.find((x) => x.slug === 'beta');
  assert.ok(f && b, 'falta el sembrado: corré `npm run db:reset`');
  fundadora = { id: f.id, org: f.org_id };
  orgBeta = b.org_id;

  await limpiar();
});

after(async () => {
  await limpiar();
  await cerrarTodo();
  await cerrarClientes();
});

async function limpiar(): Promise<void> {
  await admin.query('delete from identidad.organizaciones_credenciales where org_id = $1', [orgBeta]);
}

/** Una sesión activa, con `org_activa` puesta si se pide. Devuelve el token en claro. */
async function sesionNueva(orgActiva: string | null): Promise<{ token: string; id: string }> {
  const token = randomBytes(32).toString('base64url');
  const id = await conIdentidad(async (db) => {
    const f = await db
      .insertInto('sesiones')
      .values({
        usuario_id: fundadora.id,
        token_hash: hashDeToken(token),
        estado: 'activa',
        org_activa: orgActiva,
        expira_el: sql<Date>`now() + interval '7 days'`,
        expira_absoluto: sql<Date>`now() + interval '30 days'`,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return f.id;
  });
  return { token, id };
}

function peticion(token: string, cuerpo: unknown): Request {
  return new Request(`https://${DOMINIO}/api/admin/credenciales`, {
    method: 'PUT',
    headers: {
      origin: `https://${DOMINIO}`,
      host: DOMINIO,
      'content-type': 'application/json',
      cookie: `${COOKIE_SESION}=${token}`,
    },
    body: JSON.stringify(cuerpo),
  });
}

async function filaDe(org: string) {
  const r = await admin.query<{ actualizado_por: string | null; ia_clave_cifrada: string | null }>(
    'select actualizado_por, ia_clave_cifrada from identidad.organizaciones_credenciales where org_id = $1',
    [org],
  );
  return r.rows[0] ?? null;
}

// ─── EL 500, REPRODUCIDO ────────────────────────────────────────────────────

test('un rol de plataforma guarda credenciales de OTRA organización sin reventar', async () => {
  const s = await sesionNueva(orgBeta);
  try {
    const r = await guardarCredenciales(peticion(s.token, { iaClave: 'sk-ant-de-prueba-0001' }));

    // La aserción que reproduce el defecto. Antes del arreglo esto era 500 — y el 500 es lo peor
    // que puede devolver esta ruta, porque no dice nada: quien lo ve mira su clave, la ve bien, y
    // no tiene forma de saber que el problema es nuestro.
    assert.notEqual(r.status, 500, 'la escritura reventó: la foránea compuesta volvió a rechazar');
    assert.equal(r.status, 200, `se esperaba 200 y vino ${r.status}`);

    const fila = await filaDe(orgBeta);
    assert.ok(fila, 'no se escribió ninguna fila');
    assert.ok(fila.ia_clave_cifrada, 'la clave no quedó guardada');
    // Y el nulo es el punto, no un efecto colateral: la principal no tiene usuarios en beta, así
    // que cualquier otro valor acá sería el `23503` de vuelta.
    assert.equal(
      fila.actualizado_por,
      null,
      'se guardó un usuario de la organización principal en una fila de beta',
    );
  } finally {
    await admin.query('delete from identidad.sesiones where id = $1', [s.id]);
  }
});

test('trabajando en SU PROPIA organización, el autor SÍ se guarda', async () => {
  /* La otra mitad, y sin ella el arreglo sería una pérdida de datos disfrazada: un
     `actualizado_por: null` fijo pasaría la prueba de arriba y borraría el rastro de TODAS las
     cargas normales, que son la enorme mayoría. */
  const s = await sesionNueva(null);
  try {
    const r = await guardarCredenciales(peticion(s.token, { iaClave: 'sk-ant-de-prueba-0002' }));
    assert.equal(r.status, 200, `se esperaba 200 y vino ${r.status}`);

    const fila = await filaDe(fundadora.org);
    assert.ok(fila, 'no se escribió ninguna fila');
    assert.equal(
      fila.actualizado_por,
      fundadora.id,
      'se perdió el autor de una carga hecha dentro de la propia organización',
    );
  } finally {
    await admin.query('delete from identidad.sesiones where id = $1', [s.id]);
    // La fila de la principal viene del sembrado: se restaura su estado sin autor inventado.
    await admin.query(
      'update identidad.organizaciones_credenciales set ia_clave_cifrada = null where org_id = $1',
      [fundadora.org],
    );
  }
});

// ─── EL AYUDANTE, EN AISLAMIENTO ────────────────────────────────────────────

test('`autorDelCambio` decide por la organización, no por el rol', async () => {
  /* Es la distinción que importa y es fácil de escribir mal: lo que rompe la foránea NO es tener
     rol de plataforma, es estar escribiendo en una organización que no es la propia. Un rol de
     plataforma trabajando en la suya tiene que firmar con su nombre como cualquiera. */
  const base = { usuarioId: 'u-1', esRolDePlataforma: true } as never;

  assert.equal(
    autorDelCambio({ ...(base as object), mirandoOtraOrganizacion: false } as never),
    'u-1',
    'un rol de plataforma en SU organización perdió su firma',
  );
  assert.equal(
    autorDelCambio({ ...(base as object), mirandoOtraOrganizacion: true } as never),
    null,
    'mirando otra organización, la firma tiene que ser nula o la foránea revienta',
  );
});
