// El identificador de una pieza de Creative: su cliente y su nombre (el nivel 3). **Puro**: lo importan el servidor y
// el navegador, que nombra una pieza sin su uuid.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA PIEZA ES (CLIENTE, NOMBRE)
//
// Un nombre de anuncio no identifica una pieza fuera de su cuenta de Meta: los clientes de una empresa comparten la
// convención de nombres, y «hook 1» de un cliente no es «hook 1» de otro. `llaveDelCreativo` (`./creativo.ts`) sigue
// siendo la única normalización del NOMBRE; acá se le suma el cliente, de dos maneras que no se mezclan:
//
//   · `idDeLaPieza` es el identificador que sale hacia afuera —la `clave` de la pantalla, el `entidad.id` de una señal,
//     la llave de las miniaturas y de los activos—: el NOMBRE si la pieza es del principal, `<cuentaId>:<nombre>` si es
//     de otro. Con un solo cliente no cambia nada, y las huellas de las señales ya guardadas siguen vivas.
//   · `llaveInterna` es la de quien agrupa sin saber cuál es el principal (la calidad, el rendimiento, la entrega).
//     Lleva siempre el cliente, y con otro separador: buscar con una en un mapa armado con la otra no encuentra nada,
//     ni siquiera por casualidad con el principal.
//
// Lo que se DIBUJA y lo que lee el cerebro nunca es el identificador: es el rótulo, «nombre» o «nombre · cliente».
// ═══════════════════════════════════════════════════════════════════════════════

/** Los clientes que Creative tiene a la vista: el principal y el nombre de cada uno (`clientesDeCreative`). */
export interface ClientesDeCreative {
  /** El id del cliente por omisión, o `null` si la lectura no lo ve (el foco en otro cliente). */
  principal: string | null;
  nombres: ReadonlyMap<string, string>;
}

/** Lo que antecede al nombre en la pieza de otro cliente: su id de `identidad.cuentas` y dos puntos. */
const PREFIJO = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):/;

/**
 * El identificador de una pieza: el nombre si es del principal, `<cuentaId>:<nombre>` si es de otro. Con `principal`
 * nulo —la lectura no lo ve— lleva siempre el cliente.
 */
export function idDeLaPieza(cuentaId: string, nombre: string, principal: string | null): string {
  return cuentaId === principal ? nombre : `${cuentaId}:${nombre}`;
}

/** Lo inverso, para una señal guardada: sin prefijo, la pieza es del principal (`cuentaId: null`). */
export function partirIdDeLaPieza(id: string): { cuentaId: string | null; nombre: string } {
  const m = PREFIJO.exec(id);
  return m ? { cuentaId: m[1]!, nombre: id.slice(m[0].length) } : { cuentaId: null, nombre: id };
}

/** El nombre de una pieza desde su identificador, sin el cliente: lo que se dibuja cuando no hay otro rótulo. */
export function nombreDeLaPieza(id: string): string {
  return partirIdDeLaPieza(id).nombre;
}

/** La llave de quien agrupa por pieza sin saber cuál es el principal. No sale del módulo que la arma. */
export function llaveInterna(cuentaId: string, nombre: string): string {
  return `${cuentaId}·${nombre}`;
}

/** «nombre» o «nombre · cliente»: lo que se dice de una pieza, en la pantalla, en una señal y en el cerebro. */
export function rotuloDeLaPieza(nombre: string, cliente: string | null): string {
  return cliente === null ? nombre : `${nombre} · ${cliente}`;
}
