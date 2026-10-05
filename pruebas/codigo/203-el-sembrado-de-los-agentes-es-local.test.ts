// EL SEMBRADO DE LOS AGENTES SE NIEGA FUERA DE LA BASE LOCAL. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ DEFIENDE ESTE ARCHIVO
//
// `db/sembrado/casos-de-los-agentes.ts` (AG4) escribe personas con la contraseña de desarrollo y BORRA todo
// lo de las empresas de su prefijo, como `postgres`. Contra producción sería una pérdida de datos. Sembrar y
// quitar se niegan antes de abrir una sola conexión si cualquiera de las dos cadenas —la de identidad, por
// la que escribe, y la de administración, por la que borra— no apunta a un anfitrión local.
//
// Sin base: la guarda corre antes de conectar, y la prueba lo afirma con un anfitrión que no existe.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { quitarEmpresasDeLosAgentes, sembrarCasosDeLosAgentes } from '../../db/sembrado/casos-de-los-agentes.ts';

const REMOTA = 'postgresql://alguien:clave@proyecto-de-prueba.supabase.co:5432/postgres';
const LOCAL = 'postgresql://alguien:clave@127.0.0.1:55432/aria';

/** Corre `trabajo` con las dos cadenas puestas, sin escotilla, y devuelve todo como estaba. */
async function con<T>(cadenas: { identidad: string; admin: string }, trabajo: () => Promise<T>): Promise<T> {
  const antes = {
    identidad: process.env.DATABASE_URL_IDENTIDAD,
    admin: process.env.DATABASE_URL_ADMIN,
    escotilla: process.env.ARIA_SEMBRADO_FORZADO,
  };
  process.env.DATABASE_URL_IDENTIDAD = cadenas.identidad;
  process.env.DATABASE_URL_ADMIN = cadenas.admin;
  delete process.env.ARIA_SEMBRADO_FORZADO;
  try {
    return await trabajo();
  } finally {
    for (const [variable, valor] of [
      ['DATABASE_URL_IDENTIDAD', antes.identidad],
      ['DATABASE_URL_ADMIN', antes.admin],
      ['ARIA_SEMBRADO_FORZADO', antes.escotilla],
    ] as const) {
      if (valor === undefined) delete process.env[variable];
      else process.env[variable] = valor;
    }
  }
}

const LA_GUARDA = /el sembrado de los agentes se niega a correr contra "proyecto-de-prueba\.supabase\.co"/;

test('sembrar se niega con la base de identidad remota', async () => {
  await con({ identidad: REMOTA, admin: LOCAL }, async () => {
    await assert.rejects(sembrarCasosDeLosAgentes('agentes-203-'), LA_GUARDA);
  });
});

test('sembrar se niega con la de administración remota, aunque la de identidad sea local', async () => {
  await con({ identidad: LOCAL, admin: REMOTA }, async () => {
    await assert.rejects(sembrarCasosDeLosAgentes('agentes-203-'), LA_GUARDA);
  });
});

test('quitar se niega igual: es el que borra', async () => {
  await con({ identidad: REMOTA, admin: REMOTA }, async () => {
    await assert.rejects(quitarEmpresasDeLosAgentes('agentes-203-'), LA_GUARDA);
  });
});
