// Los links de cobro de la empresa: leerlos, agregarlos y sacarlos.
//
// ═══════════════════════════════════════════════════════════════════════════════
// UNA SOLA LECTURA PARA LOS DOS LUGARES QUE LOS MUESTRAN
//
// Los links se dibujan en dos pantallas distintas: el menú del botón `+` en el compositor de la
// ficha, y la tabla de configuración en Closer → Inicio. La lista sale de `listarEnlaces` en los
// dos casos, y eso no es economía de líneas — es lo que hace **imposible** que el menú y la tabla
// discrepen sobre el orden o sobre el contenido.
//
// Con dos consultas, el día que alguien agregue un filtro o cambie el `order by` en una de ellas,
// la otra sigue igual y nadie lo nota: el menú muestra siete links y la pantalla que los administra
// muestra ocho, las dos «bien» por separado.
//
// ═══════════════════════════════════════════════════════════════════════════════
// SE AGREGA Y SE BORRA. NO SE EDITA, Y ES UNA DECISIÓN.
//
// Corregir un monto es borrar y volver a cargar. Cuesta un renglón más de tipeo y ahorra un `PUT`
// entero con su validación, su ruta y sus pruebas — para un dato que una empresa toca cuando cambia
// su lista de precios, o sea casi nunca.
//
// El día que se pida editar, el molde está: es este archivo con una función más.
// ═══════════════════════════════════════════════════════════════════════════════

import { datos } from '../datos/contexto.ts';

/**
 * El tope de links por empresa.
 *
 * ── ES UN NÚMERO DE PANTALLA, NO DE BASE ───────────────────────────────────
 *
 * Salen todos juntos en un menú desplegable: pasadas unas veinte entradas hay que buscar con
 * scroll dentro de un menú, y elegir mal el link de cobro es exactamente lo que este botón vino a
 * evitar. Veinte son el doble de los diez que hay hoy.
 *
 * Vive acá y no como un `check` en la base por el mismo criterio que `TOPE_DE_CLOSERS`: es un
 * número provisorio, y subirlo tiene que ser una línea y no una migración.
 */
export const TOPE_DE_ENLACES = 20;

/** Un link tal como lo ven las dos pantallas. `orden` no viaja: ya está aplicado en la lista. */
export interface EnlaceDePago {
  id: string;
  nombre: string;
  monto: string | null;
  descripcion: string | null;
  url: string;
}

/**
 * ¿Es una dirección a la que se puede mandar a alguien a pagar?
 *
 * ── NO ALCANZA CON QUE EMPIECE CON `https://` ──────────────────────────────
 *
 * La base lo comprueba con `like 'https://%'`, que es lo más que se puede escribir en un `check` y
 * deja pasar `https://` a secas —sin dominio—: un link que no lleva a ninguna parte, guardado sin
 * que nada falle, y descubierto por el lead que lo recibe.
 *
 * Acá se parsea de verdad. `URL` rechaza además lo que ni siquiera es una dirección, y el chequeo
 * del protocolo tapa el caso feo: `javascript:` pegado en el campo de un link de cobro.
 */
export function urlDePagoValida(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  return u.protocol === 'https:' && u.hostname.length > 0;
}

/**
 * Los links de la empresa, en el orden en que se cargaron.
 *
 * `nombre` desempata para que el orden sea TOTAL: con `orden` repetido —dos filas sembradas
 * juntas, o un `orden` puesto a mano— sin desempate la base puede devolverlos en un orden distinto
 * en cada llamada, y un menú que se reordena solo entre dos aperturas hace que se elija mal.
 */
export async function listarEnlaces(): Promise<EnlaceDePago[]> {
  const filas = await datos()
    .selectFrom('enlaces_de_pago')
    .select(['id', 'nombre', 'monto', 'descripcion', 'url'])
    .orderBy('orden')
    .orderBy('nombre')
    .execute();

  return filas.map((f) => ({
    id: String(f.id),
    nombre: f.nombre,
    monto: f.monto,
    descripcion: f.descripcion,
    url: f.url,
  }));
}

/** Lo que se pide para dar de alta un link. Ya normalizado por la ruta. */
export interface EnlaceNuevo {
  nombre: string;
  monto: string | null;
  descripcion: string | null;
  url: string;
}

/** Por qué no se guardó. `null` = se guardó. */
export type PorqueNoSeGuardo = 'tope' | 'url_repetida';

/**
 * Agrega un link al final de la lista.
 *
 * ── LOS DOS RECHAZOS ───────────────────────────────────────────────────────
 *
 *   · `tope` — se cuenta antes de insertar, dentro de la transacción del inquilino. Dos altas
 *     simultáneas que pasen el conteo dejarían un link de más, y eso se borra desde la misma
 *     pantalla; no vale una migración.
 *   · `url_repetida` — **esto SÍ lo hace cumplir la base**, con `enlaces_de_pago_url_unica`. Dos
 *     entradas al mismo checkout se ven distintas y cobran lo mismo, y quien elige no puede
 *     notarlo. Acá se comprueba antes solo para devolver un motivo legible en vez de un `23505`
 *     que nombra un índice.
 */
export async function crearEnlace(
  enlace: EnlaceNuevo,
  actor: string,
): Promise<PorqueNoSeGuardo | null> {
  const yaHay = await datos().selectFrom('enlaces_de_pago').select(['url', 'orden']).execute();

  if (yaHay.length >= TOPE_DE_ENLACES) return 'tope';
  if (yaHay.some((e) => e.url === enlace.url)) return 'url_repetida';

  /* Al final de la lista. Se calcula del máximo y no de la cantidad: con un borrado en el medio,
     contar daría un `orden` que ya existe y el link nuevo aparecería intercalado. */
  const ultimo = yaHay.reduce((mayor, e) => Math.max(mayor, Number(e.orden)), 0);

  await datos()
    .insertInto('enlaces_de_pago')
    .values({
      nombre: enlace.nombre,
      monto: enlace.monto,
      descripcion: enlace.descripcion,
      url: enlace.url,
      orden: ultimo + 1,
      actualizado_el: new Date(),
      actualizado_por: actor,
    } as never)
    .execute();
  return null;
}

/**
 * Saca un link de la lista.
 *
 * El identificador es obligatorio y no tiene valor por omisión: un `deleteFrom` sin `where` se
 * llevaría **los veinte**, y la política de aislamiento no lo impediría — acota por organización,
 * que es justo lo que este borrado ya tiene.
 *
 * Devuelve si borró algo. Un identificador que no existe no es un error del servidor —puede ser un
 * segundo clic, o la pantalla de otro que ya lo borró— pero la ruta tiene que poder distinguirlo
 * para no decir «borrado» cuando no había nada.
 */
export async function borrarEnlace(id: string): Promise<boolean> {
  const r = await datos().deleteFrom('enlaces_de_pago').where('id', '=', id).executeTakeFirst();
  return Number(r?.numDeletedRows ?? 0) > 0;
}
