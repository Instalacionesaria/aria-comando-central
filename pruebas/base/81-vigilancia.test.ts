// ADR-0803, ADR-0804, ADR-0805, ADR-0806 — Las consultas de vigilancia.
// Tipo: las filas son de **Producción**; esto verifica la mitad que sí se puede verificar.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTA PRUEBA VERIFICA, Y LO QUE NO — DICHO DE FRENTE
//
// Estas cuatro filas de `PRUEBAS.md` son de tipo **Producción**, y su encabezado lo aclara:
// *"estas no son pruebas del proyecto: son pruebas del sistema andando"*. `EJECUCION` § 4 y § 5
// dejan el `10` fuera de alcance salvo dos cosas, y ninguna es ésta.
//
// **Verifica:** que las cuatro consultas de `db/vigilancia/senales.sql` son SQL válido, que corren
// con el rol real de la aplicación, y que devuelven las columnas que la señal necesita.
//
// **NO verifica:** que alguien las corra con su cadencia, ni que alguien las lea. Esas dos son
// decisiones de operación y están en `docs/ETAPA-8.md` como pendientes con nombre.
//
// Por qué vale escribirla igual: una consulta que nunca se ejecutó es una consulta que puede tener
// una errata. El día que alguien la programe, va a descubrir el error a las tres de la mañana —o
// peor, va a ver cero filas y pensar que no está pasando nada.
// ═══════════════════════════════════════════════════════════════════════════════

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Client } from 'pg';
import { conectar, cerrarTodo } from '../apoyo/conexiones.ts';
import { RAIZ } from '../apoyo/fuente.ts';

let ident: Client;

before(async () => {
  // El rol REAL de la aplicación, no el propietario. `app_identidad` es el único que ve la
  // auditoría completa, y correr esto como superusuario probaría los permisos de otro.
  ident = await conectar('identidad');
});

after(async () => {
  await cerrarTodo();
});

/** Las sentencias del archivo, sin comentarios. */
function consultas(): string[] {
  const texto = readFileSync(join(RAIZ, 'db', 'vigilancia', 'senales.sql'), 'utf8');
  return texto
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

test('las cuatro consultas de vigilancia son SQL válido y corren con el rol real', async () => {
  const sentencias = consultas();

  // La guarda contra el falso verde: si el archivo se vaciara o el separador cambiara, un bucle
  // sobre cero sentencias pasaría. Son cuatro: las señales 2, 3, 4 y 5. Las señales 1 y 6 no tienen
  // consulta —avisan— y eso está escrito en el propio archivo.
  assert.equal(
    sentencias.length,
    4,
    `se esperaban cuatro consultas y hay ${sentencias.length}: ${sentencias.map((s) => s.slice(0, 40)).join(' | ')}`,
  );

  for (const sentencia of sentencias) {
    // Correr de verdad, no `explain`: un `explain` valida la sintaxis y el plan, pero no los
    // permisos de columna ni las políticas. Y acá los permisos son la mitad del asunto.
    await assert.doesNotReject(
      () => ident.query(sentencia),
      `esta consulta de vigilancia no corre:\n${sentencia}`,
    );
  }
});

test('cada señal devuelve las columnas que necesita', async () => {
  const sentencias = consultas();
  // El orden del archivo es el de las señales 2 a 5, y las columnas son las que el `10` § 1
  // escribe. Si alguien renombra una columna, la consulta sigue corriendo y la vigilancia deja de
  // decir lo que decía — que es la clase de cambio que no falla.
  const esperadas: string[][] = [
    ['org_id', 'veces'],
    ['org_id', 'capacidad', 'veces'],
    ['ip', 'intentos', 'emails_probados'],
    ['usuario_id', 'cambios', 'organizaciones'],
  ];

  for (const [i, sentencia] of sentencias.entries()) {
    const r = await ident.query(sentencia);
    const columnas = r.fields.map((f) => f.name);
    assert.deepEqual(
      columnas,
      esperadas[i],
      `la señal ${i + 2} cambió de columnas:\n${sentencia}`,
    );
  }
});

test('la señal 4 cuenta EMAILS DISTINTOS, no solo intentos', async () => {
  // Es la mitad que el `10` § 1 subraya, y la que distingue un olvido de un ataque: *"veinte
  // intentos contra UNA cuenta es alguien que se olvidó la contraseña; veinte contra veinte cuentas
  // es un barrido."*
  //
  // Sin el campo `email` en el detalle de `login_fallido`, esta columna devuelve cero y un cero por
  // falta de datos se lee como "no hay ataque" (07 § 0, regla 3). El login lo escribe desde la
  // Etapa 4; esto lo afirma desde el lado de la consulta.
  const senal4 = consultas()[2];
  assert.ok(senal4);
  assert.match(senal4, /count\(distinct detalle->>'email'\)/);

  // Y el campo existe de verdad en las filas que el login escribe. Se comprueba sobre la auditoría
  // real: si `login_fallido` dejara de poner el correo, esto lo dice.
  const r = await ident.query(
    `select count(*) filter (where detalle ? 'email')::int as con_email,
            count(*)::int as total
       from identidad.auditoria_accesos where accion = 'login_fallido'`,
  );
  const { con_email, total } = r.rows[0] as { con_email: number; total: number };
  if (total > 0) {
    assert.equal(con_email, total, 'hay filas de login_fallido sin el correo en el detalle');
  }
});
