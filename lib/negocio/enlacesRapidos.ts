// Los links rápidos de la empresa, POR ZONA: leerlos, agregarlos y sacarlos.
//
// ═══════════════════════════════════════════════════════════════════════════════
// DOS MENÚS, PORQUE SON DOS TRABAJOS
//
// El closer cobra: sus links son de Stripe y de WHOP. El setter agenda: los suyos son el
// calendario, un video, una página de casos. Meterlos en un solo menú le pondría al setter diez
// links de cobro delante para encontrar el suyo — y elegir mal es justo lo que este botón vino a
// evitar.
//
// La zona usa **el mismo vocabulario que `negocio.contactos.territorio`** y no uno nuevo. Es lo que
// hace que el menú de la ficha se resuelva sin traducir: el contacto ya dice de qué zona es.
//
// ── UNA SOLA LECTURA PARA LOS TRES LUGARES QUE LOS MUESTRAN ────────────────
//
// El menú del botón `+` en la ficha, la tabla de Closer → Inicio y la de Setter → Inicio salen de
// `listarEnlaces`, que devuelve **todos** con su zona adentro y deja que cada pantalla filtre.
//
// No es economía de líneas: con una consulta por pantalla, el día que alguien cambie el `order by` o
// agregue un filtro en una de ellas, las otras siguen igual y nadie lo nota — el menú muestra siete
// links donde la pantalla que los administra muestra ocho, las dos «bien» por separado.
//
// Y son catorce filas de texto corto: filtrarlas en el navegador cuesta menos que una petición más.
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
import type { Territorio } from '../datos/esquema.ts';

/**
 * El tope de links **por zona**.
 *
 * ── ES UN NÚMERO DE PANTALLA, NO DE BASE ───────────────────────────────────
 *
 * Salen todos juntos en un menú desplegable: pasadas unas veinte entradas hay que buscar con scroll
 * dentro de un menú, y elegir mal el link es exactamente lo que este botón vino a evitar. Veinte son
 * el doble de los diez que tiene el closer hoy.
 *
 * Por ZONA y no por empresa, porque el tope existe para que un MENÚ se pueda leer, y hay uno por
 * zona. Contarlos juntos haría que cargar links de setter le fuera comiendo lugar al closer sin que
 * nadie entienda por qué.
 *
 * Vive acá y no como un `check` en la base por el mismo criterio que `TOPE_DE_CLOSERS`: es un número
 * provisorio, y subirlo tiene que ser una línea y no una migración.
 */
export const TOPE_DE_ENLACES = 20;

/** Un link tal como lo ven las pantallas. `orden` no viaja: ya está aplicado en la lista. */
export interface EnlaceRapido {
  id: string;
  territorio: Territorio;
  nombre: string;
  monto: string | null;
  descripcion: string | null;
  url: string;
}

/**
 * ¿Es una dirección a la que se puede mandar a alguien?
 *
 * ── NO ALCANZA CON QUE EMPIECE CON `https://` ──────────────────────────────
 *
 * La base lo comprueba con `like 'https://%'`, que es lo más que se puede escribir en un `check` y
 * deja pasar `https://` a secas —sin dominio—: un link que no lleva a ninguna parte, guardado sin
 * que nada falle, y descubierto por el lead que lo recibe.
 *
 * Acá se parsea de verdad. `URL` rechaza además lo que ni siquiera es una dirección, y el chequeo
 * del protocolo tapa el caso feo: `javascript:` pegado en el campo de un link que alguien va a
 * mandar.
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
 * Los links de la empresa —**de las dos zonas**—, en el orden en que se cargaron.
 *
 * La zona va PRIMERO en el orden para que las dos listas salgan agrupadas: la ficha las dibuja tal
 * como vienen cuando un contacto sin zona hace que aparezcan las dos juntas, y sin esto quedarían
 * intercaladas por `orden`.
 *
 * `nombre` desempata para que el orden sea TOTAL: con `orden` repetido —dos filas sembradas juntas, o
 * un `orden` puesto a mano— sin desempate la base puede devolverlas distinto en cada llamada, y un
 * menú que se reordena solo entre dos aperturas hace que se elija mal.
 */
export async function listarEnlaces(): Promise<EnlaceRapido[]> {
  const filas = await datos()
    .selectFrom('enlaces_rapidos')
    .select(['id', 'territorio', 'nombre', 'monto', 'descripcion', 'url'])
    .orderBy('territorio')
    .orderBy('orden')
    .orderBy('nombre')
    .execute();

  return filas.map((f) => ({
    id: String(f.id),
    territorio: f.territorio as Territorio,
    nombre: f.nombre,
    monto: f.monto,
    descripcion: f.descripcion,
    url: f.url,
  }));
}

/** Lo que se pide para dar de alta un link. Ya normalizado por la ruta. */
export interface EnlaceNuevo {
  territorio: Territorio;
  nombre: string;
  monto: string | null;
  descripcion: string | null;
  url: string;
}

/** Por qué no se guardó. `null` = se guardó. */
export type PorqueNoSeGuardo = 'tope' | 'url_repetida';

/**
 * Agrega un link al final de la lista **de su zona**.
 *
 * ── LOS DOS RECHAZOS ───────────────────────────────────────────────────────
 *
 *   · `tope` — se cuenta antes de insertar, dentro de la transacción del inquilino, y **solo la zona
 *     que se está tocando**. Dos altas simultáneas que pasen el conteo dejarían un link de más, y eso
 *     se borra desde la misma pantalla; no vale una migración.
 *   · `url_repetida` — **esto SÍ lo hace cumplir la base**, con `enlaces_rapidos_url_unica`. Dos
 *     entradas del mismo menú al mismo lado se ven distintas y hacen lo mismo, y quien elige no puede
 *     notarlo. Acá se comprueba antes solo para devolver un motivo legible en vez de un `23505` que
 *     nombra un índice.
 *
 * Los dos se miden DENTRO de la zona, igual que la restricción de la base: el mismo link de
 * calendario ofrecido en las dos zonas es legítimo, y prohibirlo sería inventar una regla que nadie
 * pidió.
 */
export async function crearEnlace(
  enlace: EnlaceNuevo,
  actor: string,
): Promise<PorqueNoSeGuardo | null> {
  const yaHay = (
    await datos().selectFrom('enlaces_rapidos').select(['territorio', 'url', 'orden']).execute()
  ).filter((e) => e.territorio === enlace.territorio);

  if (yaHay.length >= TOPE_DE_ENLACES) return 'tope';
  if (yaHay.some((e) => e.url === enlace.url)) return 'url_repetida';

  /* Al final de SU lista. Se calcula del máximo y no de la cantidad: con un borrado en el medio,
     contar daría un `orden` que ya existe y el link nuevo aparecería intercalado. */
  const ultimo = yaHay.reduce((mayor, e) => Math.max(mayor, Number(e.orden)), 0);

  await datos()
    .insertInto('enlaces_rapidos')
    .values({
      territorio: enlace.territorio,
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
 * llevaría **los cuarenta**, y la política de aislamiento no lo impediría — acota por organización,
 * que es justo lo que este borrado ya tiene.
 *
 * Devuelve si borró algo. Un identificador que no existe no es un error del servidor —puede ser un
 * segundo clic, o la pantalla de otro que ya lo borró— pero la ruta tiene que poder distinguirlo
 * para no decir «borrado» cuando no había nada.
 */
export async function borrarEnlace(id: string): Promise<boolean> {
  const r = await datos().deleteFrom('enlaces_rapidos').where('id', '=', id).executeTakeFirst();
  return Number(r?.numDeletedRows ?? 0) > 0;
}
