// El identificador de una pieza de Creative: su cliente y su nombre (el nivel 3). Y, con la misma convención, el de todo
// lo que una señal mide dentro de un cliente (C6 · D3). **Puro**: lo importan el servidor y el navegador, que nombra una
// pieza o una entidad sin su uuid.
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
// ── LO QUE UNA SEÑAL MIDE DENTRO DE UN CLIENTE (C6 · D3) ───────────────────────
//
// La fuga de un funnel, un patrón del auditor, una familia de entrada y el formulario se miden con varios clientes
// dentro de cada uno, y dos clientes con la misma familia darían la misma huella: la pasada del departamento entero
// falla con «detectó dos veces la misma huella». `idConCliente` es la convención de la pieza para todos: el de siempre
// para el principal —al sumar un cliente no se cierra ni renace ninguna señal suya, ni pierde su bloqueo la que alguien
// descartó—, `<cuentaId>:<id>` para otro. El id no depende de ninguna bandera de datos: sólo de quién es.
//
// Lo que se DIBUJA y lo que lee el cerebro nunca es el identificador: es el rótulo, «nombre» o «nombre · cliente».
// ═══════════════════════════════════════════════════════════════════════════════

/** Los clientes que Creative tiene a la vista: el principal y el nombre de cada uno (`clientesDeCreative`). */
export interface ClientesDeCreative {
  /** El id del cliente por omisión, o `null` si la lectura no lo ve (el foco en otro cliente). */
  principal: string | null;
  nombres: ReadonlyMap<string, string>;
}

/** Lo que antecede al resto en lo de otro cliente: su id de `identidad.cuentas` y dos puntos. */
const PREFIJO = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):/;

/**
 * El identificador de algo medido dentro de un cliente: el de siempre si es del principal —o de la empresa entera,
 * `cuentaId` nulo—, `<cuentaId>:<id>` si es de otro. Con `principal` nulo —la lectura no lo ve— lleva siempre el cliente.
 */
export function idConCliente(cuentaId: string | null, id: string, principal: string | null): string {
  return cuentaId === null || cuentaId === principal ? id : `${cuentaId}:${id}`;
}

/** Lo inverso, para una señal guardada: sin prefijo, es del principal o de la empresa (`cuentaId: null`). */
export function partirIdConCliente(id: string): { cuentaId: string | null; resto: string } {
  const m = PREFIJO.exec(id);
  return m ? { cuentaId: m[1]!, resto: id.slice(m[0].length) } : { cuentaId: null, resto: id };
}

/**
 * El identificador de una pieza: el nombre si es del principal, `<cuentaId>:<nombre>` si es de otro. Con `principal`
 * nulo —la lectura no lo ve— lleva siempre el cliente.
 */
export function idDeLaPieza(cuentaId: string, nombre: string, principal: string | null): string {
  return idConCliente(cuentaId, nombre, principal);
}

/** Lo inverso, para una señal guardada: sin prefijo, la pieza es del principal (`cuentaId: null`). */
export function partirIdDeLaPieza(id: string): { cuentaId: string | null; nombre: string } {
  const { cuentaId, resto } = partirIdConCliente(id);
  return { cuentaId, nombre: resto };
}

// ─── En una señal: el tope de la tabla ─────────────────────────────────────

/** El tope de `negocio.senales.entidad_id` (`072`): con uno más largo, la pasada del departamento entero falla. */
export const TOPE_DE_LA_ENTIDAD = 200;

/** Lo que cierra un nombre cortado: «…» y ocho cifras hexadecimales del nombre entero. */
const MARCA_DEL_CORTE = /…[0-9a-f]{8}$/;

/** Una huella corta y estable de un texto (FNV-1a de 32 bits), en ocho cifras hexadecimales. */
function huellaCorta(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * El identificador de una pieza en una SEÑAL (C6 · D3): `idDeLaPieza`, mientras entre en la tabla. El nombre de un
 * anuncio no tiene tope en Meta, y el de una pieza de otro cliente suma 37 caracteres de su prefijo: con un nombre largo
 * el `check` de la `072` rechazaba la fila y la pasada de Creative fallaba entera, cada hora, sin publicar nada.
 * Pasado el tope, el nombre conserva su comienzo y cierra con «…» y una huella corta del nombre entero: dos nombres
 * largos con el mismo comienzo siguen siendo dos señales, y el mismo nombre da el mismo identificador cada mañana. Se
 * corta por letras enteras, nunca por la mitad de una, y se mide en unidades de JavaScript, que nunca son menos que
 * las letras que cuenta la base. Debajo del tope —todo nombre de hoy— es `idDeLaPieza`, letra por letra.
 */
export function idDeLaPiezaEnUnaSenal(cuentaId: string, nombre: string, principal: string | null): string {
  const id = idDeLaPieza(cuentaId, nombre, principal);
  if (id.length <= TOPE_DE_LA_ENTIDAD) return id;
  const prefijo = id.slice(0, id.length - nombre.length);
  const marca = `…${huellaCorta(nombre)}`;
  const cabe = TOPE_DE_LA_ENTIDAD - prefijo.length - marca.length;
  let corto = '';
  for (const letra of nombre) {
    if (corto.length + letra.length > cabe) break;
    corto += letra;
  }
  return `${prefijo}${corto}${marca}`;
}

/** El nombre de una pieza desde su identificador, sin el cliente: lo que se dibuja cuando no hay otro rótulo. */
export function nombreDeLaPieza(id: string): string {
  // Cortado por el tope de una señal, se dibuja con «…» y sin la huella: es un identificador, no se lee.
  return partirIdConCliente(id).resto.replace(MARCA_DEL_CORTE, '…');
}

/** La llave de quien agrupa por pieza sin saber cuál es el principal. No sale del módulo que la arma. */
export function llaveInterna(cuentaId: string, nombre: string): string {
  return `${cuentaId}·${nombre}`;
}

/** «nombre» o «nombre · cliente»: lo que se dice de una pieza, en la pantalla, en una señal y en el cerebro. */
export function rotuloDeLaPieza(nombre: string, cliente: string | null): string {
  return cliente === null ? nombre : `${nombre} · ${cliente}`;
}
