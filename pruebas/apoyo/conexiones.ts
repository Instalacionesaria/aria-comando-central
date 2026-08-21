// Conexiones para las pruebas, una por rol de base.
//
// Vive bajo `pruebas/` a propósito, y no en `lib/datos/`, por dos razones:
//
//   1. `lib/datos/capa.ts` es el ÚNICO archivo del proyecto que puede contener
//      `crearCliente(`, y la prueba de la Etapa 2 lo va a afirmar recorriendo el
//      código fuente. Ese recorrido tiene que EXCLUIR `pruebas/**`, o falla sobre
//      código correcto — y con ella hace falta la afirmación complementaria: que
//      nada bajo `app/` ni `lib/` importe de `pruebas/`.
//   2. Las pruebas de base y de catálogo necesitan conectarse como un rol concreto
//      y afirmar que una operación FALLA. Eso no es acceso a datos de la
//      aplicación, es inspección.
//
// Se usa `pg` desnudo y no el constructor de consultas: acá se consulta
// `pg_catalog`, se comprueban permisos y se esperan errores. Es SQL de inspección,
// no de negocio.

import pg from 'pg';
import { urlDe, type RolBase } from '../../lib/datos/entorno.ts';

const abiertos: pg.Client[] = [];

/** Un cliente conectado con el rol pedido. Se cierra con `cerrarTodo()`. */
export async function conectar(rol: RolBase): Promise<pg.Client> {
  const cliente = new pg.Client({ connectionString: urlDe(rol), connectionTimeoutMillis: 10_000 });
  await cliente.connect();
  abiertos.push(cliente);
  return cliente;
}

/**
 * Cierra todo lo abierto.
 *
 * Hace falta de verdad: con el corredor de Node, una conexión sin cerrar deja el
 * proceso colgado y la suite nunca termina — y un proceso que no termina en
 * integración continua se lee como una prueba lenta, no como un error.
 */
export async function cerrarTodo(): Promise<void> {
  const copia = abiertos.splice(0, abiertos.length);
  await Promise.all(copia.map((c) => c.end().catch(() => undefined)));
}

/** Una fila, o `undefined`. Evita el ruido de `rows[0]` con noUncheckedIndexedAccess. */
export async function unaFila<T extends pg.QueryResultRow>(
  cliente: pg.Client,
  texto: string,
  valores: unknown[] = [],
): Promise<T | undefined> {
  const r = await cliente.query<T>(texto, valores);
  return r.rows[0];
}

export async function filas<T extends pg.QueryResultRow>(
  cliente: pg.Client,
  texto: string,
  valores: unknown[] = [],
): Promise<T[]> {
  const r = await cliente.query<T>(texto, valores);
  return r.rows;
}
