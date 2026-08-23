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
import { exigirAnfitrionLocal } from '../../lib/datos/anfitrion.ts';

const abiertos: pg.Client[] = [];

/**
 * Un cliente conectado con el rol pedido. Se cierra con `cerrarTodo()`.
 *
 * ── EL GUARD DE ANFITRIÓN, Y POR QUÉ ESTÁ ACÁ ────────────────────────────────
 *
 * Este es el único punto por donde se conecta toda prueba de base, así que es el
 * único lugar donde el guard tiene que estar para cubrirlas a las 158.
 *
 * Y hace falta de verdad, no por prolijidad: la suite BORRA. `limpiarTodo()` se
 * lleva todo usuario que no sea uno de los tres del sembrado y reactiva a los
 * desactivados; `60-credenciales.test.ts` vacía `organizaciones_credenciales` en el
 * `before` y en el `after`, y eso es IRREVERSIBLE porque está cifrado con
 * `CLAVE_MAESTRA`. Con `.env.local` apuntando a un proveedor administrado, un
 * `npm test` es una pérdida de datos de producción.
 *
 * Se comprueba en cada llamada y no una vez al importar: el costo es una
 * comparación en un `Set` frente a un viaje de red, y así una prueba que conecte
 * con dos roles queda cubierta en los dos.
 */
export async function conectar(rol: RolBase): Promise<pg.Client> {
  const url = urlDe(rol);
  exigirAnfitrionLocal(url, {
    quien: `la suite de pruebas (rol \`${rol}\`)`,
    porque:
      'la suite borra usuarios, sesiones y credenciales cifradas — y las credenciales ' +
      'no se recuperan.',
    escotilla: 'ARIA_PRUEBAS_FORZADAS',
  });
  const cliente = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
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
