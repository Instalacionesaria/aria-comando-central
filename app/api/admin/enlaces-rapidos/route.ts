// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
//
// Agregar y sacar links rápidos. **La lectura NO está acá**: es `GET /api/enlaces-rapidos`, que pide
// `contactos.ver` porque la usa también el menú de la ficha.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ `PANTALLA = 'credenciales'` Y NO `'closer'` NI `'setter'`
//
// Es el mismo caso que `app/api/admin/closer/route.ts`, que ya lo tiene escrito, y acá tiene una
// vuelta más: las tablas que usan estas operaciones viven DENTRO de Closer → Inicio **y** de
// Setter → Inicio. Con `PANTALLA = 'closer'`, `ADR-0304` exigiría `closer.ver` y el panel del setter
// recibiría un 403 en su propia pantalla; con `'setter'`, al revés.
//
// Configurar la empresa no es de ninguna de las dos pestañas: es de quien administra.
// `credenciales.editar`, la misma puerta que designa closers y que fija porcentajes de comisión.
//
// ═══════════════════════════════════════════════════════════════════════════════
// SE AUDITA, Y NO ES CELO: ES EL PEOR CAMINO DE ESTA FUNCIÓN
//
// Un link de cobro cambiado es dinero que entra en otra cuenta. Alguien con acceso de
// administrador —o una sesión suya tomada— reemplaza el link de $4.000 por el suyo, y a partir de
// ahí **todos los closers de la empresa se lo mandan a los leads sin notar nada**: el menú se ve
// igual, el mensaje sale igual, el lead paga igual.
//
// Nada de eso lo puede impedir esta ruta: quien tiene la capacidad, la tiene. Lo que sí se puede es
// que el cambio deje rastro de quién y cuándo, con la dirección escrita en la fila. Por eso
// `detalle.enlace` lleva el link: sin él el registro diría «alguien tocó los links» y no cuál, que
// es justo lo que habría que reconstruir.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion, datos } from '../../../../lib/datos/contexto.ts';
import {
  borrarEnlace,
  crearEnlace,
  listarEnlaces,
  TOPE_DE_ENLACES,
  urlDePagoValida,
} from '../../../../lib/negocio/enlacesRapidos.ts';
import { auditarAdministracion } from '../../../../lib/autenticacion/auditoria.ts';

export const PANTALLA = 'credenciales';

/**
 * Las zonas que aceptan links.
 *
 * Es el mismo vocabulario que `negocio.contactos.territorio` y que el `check` de la migración 036, y
 * se escribe acá para poder devolver un motivo legible: sin esta comprobación, una zona inventada
 * saldría como un `23514` que nombra una restricción.
 */
const ZONAS = ['closer', 'setter'] as const;

/**
 * Los topes de cada campo.
 *
 * Salen de dónde se dibuja cada uno y no de un gusto: el nombre y el monto son dos columnas de una
 * fila de menú, y si no entran en un renglón el menú deja de poder leerse de un vistazo — que es
 * todo lo que este botón vino a dar. La dirección es larga porque los enlaces de Stripe con
 * parámetros lo son.
 */
const TOPES = { nombre: 60, monto: 24, descripcion: 120, url: 500 } as const;

const MOTIVOS = {
  cuerpo_invalido: 'El cuerpo de la petición no es JSON válido.',
  zona_invalida: 'Ese link tiene que ser de la zona del closer o de la del setter.',
  falta_nombre: 'El link necesita un nombre.',
  falta_url: 'El link necesita una dirección.',
  url_invalida:
    'La dirección tiene que ser un enlace https:// completo. Por http:// el pago viaja en claro, ' +
    'así que no se acepta.',
  largo: 'Alguno de los campos es demasiado largo.',
  tope: `No se pueden cargar más de ${TOPE_DE_ENLACES} links por zona.`,
  url_repetida: 'Ya hay un link cargado con esa misma dirección en esta zona.',
  falta_id: 'No se dijo qué link sacar.',
  no_estaba: 'Ese link ya no está en la lista.',
} as const;

/** Texto opcional del formulario: vacío y ausente significan lo mismo, y los dos son `null`. */
function opcional(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const limpio = v.trim();
  return limpio === '' ? null : limpio;
}

/**
 * Agrega un link.
 *
 * ── LA DIRECCIÓN SE VALIDA ACÁ **Y** EN LA BASE, Y NO SOBRA ────────────────
 *
 * El `check` de la migración 035 es `like 'https://%'`, que es lo más que se puede escribir en un
 * `check` y deja pasar `https://` a secas. Acá se parsea de verdad con `urlDePagoValida`, que
 * además devuelve un motivo legible en el formulario en vez de un `23514` que nombra una
 * restricción.
 *
 * Y al revés: el `check` es lo único que también cubre una escritura que no pase por esta ruta.
 */
export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return rechazo('peticion_invalida', MOTIVOS['cuerpo_invalido']);
  }
  const c = cuerpo as {
    territorio?: unknown;
    nombre?: unknown;
    monto?: unknown;
    descripcion?: unknown;
    url?: unknown;
  };

  /* La zona NO tiene valor por omisión, y es deliberado: con uno, una pantalla que se olvide de
     mandarla cargaría el link en la zona equivocada **en silencio**, y ahí aparecería en el menú de
     gente que no lo pidió. Es el mismo motivo por el que la migración 036 le quita el `default` a la
     columna después de rellenar las filas viejas. */
  const territorio = ZONAS.find((z) => z === c?.territorio);
  if (!territorio) return rechazo('peticion_invalida', MOTIVOS['zona_invalida']);

  const nombre = typeof c?.nombre === 'string' ? c.nombre.trim() : '';
  const url = typeof c?.url === 'string' ? c.url.trim() : '';
  const monto = opcional(c?.monto);
  const descripcion = opcional(c?.descripcion);

  if (nombre === '') return rechazo('peticion_invalida', MOTIVOS['falta_nombre']);
  if (url === '') return rechazo('peticion_invalida', MOTIVOS['falta_url']);
  if (!urlDePagoValida(url)) return rechazo('peticion_invalida', MOTIVOS['url_invalida']);
  if (
    nombre.length > TOPES.nombre ||
    url.length > TOPES.url ||
    (monto?.length ?? 0) > TOPES.monto ||
    (descripcion?.length ?? 0) > TOPES.descripcion
  ) {
    return rechazo('peticion_invalida', MOTIVOS['largo']);
  }

  const porque = await conOrganizacion(contexto.orgEfectiva, async () => {
    const porque = await crearEnlace(
      { territorio, nombre, monto, descripcion, url },
      contexto.usuarioId,
    );
    // Si no se guardó, no se audita: el registro se lee para reconstruir cambios, y una fila que
    // describe algo que no pasó es ruido que hace desconfiar del resto.
    if (porque !== null) return porque;
    /* En la MISMA transacción y por la misma conexión del inquilino: así no existe el estado «se
       cargó el link y no quedó registrado quién». El motivo largo está en el `PUT` de comisiones. */
    await auditarAdministracion(datos(), {
      accion: 'enlace_rapido_creado',
      actor: contexto.usuarioId,
      // La empresa, igual que en `credenciales_cargadas`: lo que se tocó es su configuración.
      objetivo: contexto.orgEfectiva,
      orgId: contexto.orgEfectiva,
      detalle: { enlace: url },
    });
    return null;
  });

  /* 409 y no 400: la petición está bien formada y es el estado del servidor el que no la admite —ya
     hay veinte links en esa zona, o esa dirección ya está cargada ahí—. Un 400 mandaría a revisar el
     cuerpo, que está impecable. */
  if (porque !== null) return rechazo('rechazo_de_la_base', MOTIVOS[porque]);

  // Se devuelve la lista completa y no un `{ ok: true }`: quien guardó tiene que ver lo que quedó.
  return ok({ enlaces: await conOrganizacion(contexto.orgEfectiva, listarEnlaces) });
}

/**
 * Saca un link de la lista.
 *
 * Editar es sacarlo y volver a cargarlo — el motivo está en `lib/negocio/enlacesRapidos.ts`.
 *
 * No recibe la zona, y no le hace falta: el identificador ya nombra una fila, y esa fila sabe de qué
 * zona es. Pedirla además abriría la puerta a que no coincidan.
 */
export async function DELETE(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['credenciales.editar'], PANTALLA);
  if (contexto instanceof Response) return contexto;

  const id = new URL(peticion.url).searchParams.get('id');
  if (!id) return rechazo('peticion_invalida', MOTIVOS['falta_id']);

  const borrado = await conOrganizacion(contexto.orgEfectiva, async () => {
    /* Se lee ANTES de borrar para poder escribir en la auditoría CUÁL link se sacó. Después ya no
       está, y la fila de auditoría sobrevive a la fila borrada: es lo único que queda para
       reconstruir un cambio de dirección de cobro. */
    const antes = (await listarEnlaces()).find((e) => e.id === id);
    if (!antes) return false;
    if (!(await borrarEnlace(id))) return false;
    await auditarAdministracion(datos(), {
      accion: 'enlace_rapido_borrado',
      actor: contexto.usuarioId,
      objetivo: contexto.orgEfectiva,
      orgId: contexto.orgEfectiva,
      detalle: { enlace: antes.url },
    });
    return true;
  });

  /* Un identificador que ya no está NO es un error del servidor —puede ser un segundo clic, o la
     pantalla de otra persona que lo borró primero— pero tampoco se contesta «borrado»: sale un 404
     con su motivo, y la pantalla se refresca con la lista que ya tiene. */
  if (!borrado) return rechazo('no_encontrado', MOTIVOS['no_estaba']);

  return ok({ enlaces: await conOrganizacion(contexto.orgEfectiva, listarEnlaces) });
}
