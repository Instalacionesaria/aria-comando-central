// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
//
// Los links rápidos de la empresa. **La lectura, para las TRES pantallas que los muestran.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// PIDE `contactos.ver` Y NO `credenciales.ver`, Y ESO NO ABRE NADA
//
// Los leen el menú del botón `+` del compositor, que vive en la ficha; y las dos tablas de
// configuración, la de Closer → Inicio y la de Setter → Inicio, que son de quien administra. Tres
// pantallas, un solo `GET`.
//
// La capacidad que se pide es la de la ficha, `contactos.ver`, por dos motivos que se sostienen
// juntos:
//
//   · **Es la que exige `ADR-0304`.** Las cinco pestañas de la ficha piden `contactos.ver`; una
//     sexta lectura de la misma pantalla pidiendo otra cosa dejaría el menú vacío para alguien que
//     ve las cinco, sin ningún error a la vista. Ése es el defecto que esa regla previene.
//
//   · **Y quien administra la tiene garantizada.** No es una suposición: `db/arranque/001_catalogo.sql`
//     comprueba con un `raise` que `administrador` sea EXACTAMENTE `usuario` + `credenciales.%`. O
//     sea que todo el que puede editar los links puede leerlos por esta puerta, y no hace falta un
//     segundo `GET` con la consulta duplicada.
//
// Lo que se abre con esto es la lista de links a quien ya puede abrir una ficha y mandarle mensajes
// a un contacto. Es exactamente el conjunto de gente que los usa.
//
// ── VIENEN LAS DOS ZONAS, Y FILTRA QUIEN MIRA ──────────────────────────────
//
// La respuesta trae los links de las DOS zonas, cada uno con la suya. La ficha se queda con los de
// la zona del contacto; cada tabla de configuración, con los de la suya.
//
// Es a propósito, y no por ahorrar un parámetro: con una consulta por pantalla, el día que alguien
// cambie el orden o agregue un filtro en una de ellas, las otras siguen igual y nadie lo nota. Son
// unas pocas decenas de filas de texto corto — filtrarlas en el navegador cuesta menos que una
// petición más.
//
// ── VA EN `SIN_PANTALLA`, COMO EL RESTO DE LA FICHA ────────────────────────
//
// La ficha se abre desde el closer, desde el setter y desde la auditoría. Declarar
// `PANTALLA = 'closer'` afirmaría que es de una pestaña y le daría un 403 a un setter mirando un
// contacto suyo — que con esta función ya no es hipotético: el setter tiene su propio menú.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../lib/autorizacion/portero.ts';
import { SIN_SECCION } from '../../../lib/autorizacion/secciones.ts';
import { ok } from '../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../lib/datos/contexto.ts';
import { listarEnlaces } from '../../../lib/negocio/enlacesRapidos.ts';

export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['contactos.ver'], SIN_SECCION);
  if (contexto instanceof Response) return contexto;

  const enlaces = await conOrganizacion(contexto.orgEfectiva, listarEnlaces);

  /* La lista viaja aunque esté vacía, y cada pantalla lo distingue: sin links de su zona, el botón
     `+` no se dibuja. Un botón que abre un menú vacío es un control muerto para siempre en toda
     empresa que no trabaje así — y para la que sí, el lugar donde se cargan está en el Inicio de su
     pestaña. */
  return ok({ enlaces });
}
