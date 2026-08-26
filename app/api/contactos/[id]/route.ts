// El contacto de la ficha: su encabezado, su píldora y sus seis íconos.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ PIDE `contactos.ver` Y NO LA CAPACIDAD DE UNA PESTAÑA
//
// La ficha se abre desde las tres pantallas del closer, desde las del setter y desde la auditoría.
// Es **un solo componente para toda la aplicación** (`02` regla 2), y el motivo está escrito en el
// documento: *"si hubiera tres, mostrarían tres cosas distintas del mismo contacto, y las tres
// parecerían correctas"*.
//
// Si esta ruta pidiera `closer.ver`, un setter abriría la ficha de un contacto que él agendó y
// recibiría 403 — que la interfaz se traga y se ve como «este contacto no tiene nada».
//
// `contactos.ver` está catalogada desde la Etapa 11 con exactamente este comentario: *"La ficha del
// contacto. De las DOS pestañas, así que no puede pedir la de una sola."* Ésta es la primera ruta
// que la usa.
//
// Y por eso va en `SIN_PANTALLA`: declarar `PANTALLA = 'closer'` afirmaría que pertenece a una
// pestaña, y `ADR-0304` cruzaría su capacidad contra las de esa pantalla y no coincidirían.
//
// ── ABRIR LA FICHA CUESTA UNA LLAMADA, Y UN FALLO NO IMPIDE ABRIRLA ─────────
//
// Se refresca el contacto contra el CRM al abrir: 1 llamada, por acción explícita de una persona.
// Es lo que hace que el estado del agente y la cita agendada sean de ahora y no de la última
// sincronización manual — y el estado del agente es justo lo que alguien mira antes de escribir.
//
// **Pero el refresco no es la fuente de la respuesta.** La ficha se arma de la caché, y si el
// refresco falla se devuelve lo que había con el motivo al lado. Es la regla general del `05` § 8:
// *"un dato que no se pudo traer y un dato que dice cero no son el mismo hecho"*. Una ficha que se
// niega a abrir porque el CRM está caído es una ficha inútil justo cuando hay que trabajar sin él.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../lib/autorizacion/portero.ts';
import { SIN_SECCION } from '../../../../lib/autorizacion/secciones.ts';
import { ok, rechazo } from '../../../../lib/autorizacion/respuesta.ts';
import { conOrganizacion } from '../../../../lib/datos/contexto.ts';
import { conIdentidad } from '../../../../lib/datos/capa.ts';
import {
  resolverAccesoAGhl,
  resolverCredenciales,
  TEXTO_DE_FALTA_GHL,
} from '../../../../lib/credenciales/resolver.ts';
import { enlaceDeAgendamiento } from '../../../../lib/ghl/agendar.ts';
import { filaDeContacto } from '../../../../lib/negocio/fila.ts';
import { refrescarUnContacto } from '../../../../lib/negocio/sincronizar.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Qué pasó con el refresco, dicho con palabras.
 *
 * Se devuelve SIEMPRE, incluso cuando salió bien, y no es simetría por gusto: la pantalla necesita
 * poder decir «datos de hace un momento» y distinguirlo de «no se pudo actualizar». Sin este campo
 * las dos situaciones se ven idénticas, que es el defecto que el `05` § 8 nombra.
 */
const REFRESCO = {
  listo: null,
  no_esta_en_el_crm:
    'Este contacto ya no está en GoHighLevel. Lo que se muestra es lo último que se sincronizó, ' +
    'y no se borró nada.',
  salteado: 'El CRM devolvió el contacto incompleto, así que no se actualizó nada.',
  fallo: 'No se pudo consultar GoHighLevel. Lo que se muestra es lo último que se sincronizó.',
  sin_credencial:
    'Esta empresa todavía no tiene su conexión de GoHighLevel cargada, así que no hay con qué ' +
    'actualizar.',
  sin_id: 'No se conoce el identificador de este contacto en el CRM, así que no se puede actualizar.',
} as const;

export async function GET(
  peticion: Request,
  ctx: RouteContext<'/api/contactos/[id]'>,
): Promise<Response> {
  const contexto = await exigir(peticion, ['contactos.ver'], SIN_SECCION);
  if (contexto instanceof Response) return contexto;

  const { id } = await ctx.params;
  // Un identificador mal formado se responde como no encontrado, no como 400: sin esta guarda la
  // consulta lanza `invalid input syntax for type uuid` y el 500 que sale dice más que un 404.
  if (!UUID.test(id)) return rechazo('no_encontrado');

  const orgId = contexto.orgEfectiva;

  // 1 · La caché, PRIMERO. Es la fuente de la respuesta, y además es de donde sale el
  //     identificador del CRM que el refresco necesita.
  const antes = await conOrganizacion(orgId, () => filaDeContacto(id));
  // Cero filas es 404, y cubre los dos casos con la misma respuesta: no existe, o es de otra
  // organización. Que sean indistinguibles ES el requisito (`ADR-0501`).
  if (!antes) return rechazo('no_encontrado');

  // 2 · El refresco. Cruza los dos dominios —la credencial es de identidad, la escritura del
  //     inquilino— y por eso esta ruta está en `CRUZAN_LOS_DOS_DOMINIOS`. Lo que queda a medias si
  //     falla la segunda mitad es nada: la primera solo LEE.
  let porque: string | null = REFRESCO.listo;
  /**
   * El enlace al contacto EN el CRM, armado por el servidor.
   *
   * Se arma acá y no en la pantalla porque hacen falta **dos** piezas: el identificador del
   * contacto, que viaja en la fila, y el de la subcuenta, que vive en la credencial — una tabla de
   * identidad que el navegador no ve ni debe ver.
   *
   * El prototipo resolvía esto abriendo `https://app.gohighlevel.com/` a secas, o sea la portada:
   * un botón que dice «Ver en GHL» y lleva a buscar el contacto a mano. Con las dos piezas se
   * llega a la ficha del contacto, y sin alguna de las dos el botón **no se dibuja**.
   */
  let enlaceCrm: string | null = null;
  if (!antes.ghlContactId) {
    porque = REFRESCO.sin_id;
  } else {
    const acceso = await conIdentidad((db) => resolverAccesoAGhl(db, orgId));
    if (acceso.tipo !== 'listo') {
      // Se dice cuál falta, con el texto que ya existe para eso. Un «no se pudo» sin decir que la
      // empresa no tiene token manda a alguien a revisar la red.
      porque = `${REFRESCO.sin_credencial} ${TEXTO_DE_FALTA_GHL[acceso.que]}`;
    } else {
      enlaceCrm =
        `https://app.gohighlevel.com/v2/location/${encodeURIComponent(acceso.locationId)}` +
        `/contacts/detail/${encodeURIComponent(antes.ghlContactId)}`;
      const r = await conOrganizacion(orgId, () =>
        refrescarUnContacto(acceso, antes.ghlContactId as string),
      );
      porque = r.tipo === 'listo' ? REFRESCO.listo : REFRESCO[r.tipo];
    }
  }

  // 3 · Y se vuelve a leer, porque el refresco pudo cambiar las etiquetas —y con ellas tres de los
  //     seis íconos y el territorio—. Devolver `antes` mostraría el estado viejo justo después de
  //     haber pagado la llamada para actualizarlo.
  //
  //     Si la segunda lectura no encuentra nada, gana la primera: el contacto no desapareció, y un
  //     404 acá sería un error inventado por nuestra propia consulta.
  const despues = (await conOrganizacion(orgId, () => filaDeContacto(id))) ?? antes;

  /* ── EL ENLACE PARA AGENDAR ────────────────────────────────────────────────
   *
   * Sale del calendario configurado en Ajustes → Credenciales, y **no** de los calendarios que la
   * API devuelve: la subcuenta real tiene nueve y cinco son `round_robin`, así que nada en la API
   * dice cuál es «el de la empresa». Elegir el que tiene más citas es una heurística que cambia sola
   * con el uso.
   *
   * Va como URL ya armada o `null`, nunca como identificador: la forma de la URL está medida y vive
   * en un solo archivo. Ver `lib/ghl/agendar.ts`.
   */
  /* Es una lectura APARTE de la del token, y no por descuido: el enlace para agendar es de la
   * EMPRESA, no de este contacto. Colgarlo de `resolverAccesoAGhl` —que se resuelve solo cuando el
   * contacto tiene identificador en el CRM— haría que el botón desapareciera para los contactos que
   * todavía no están sincronizados, que no tiene nada que ver. */
  const credenciales = await conIdentidad((db) => resolverCredenciales(db, orgId));
  const enlaceAgendar = enlaceDeAgendamiento(credenciales.crmCalendarioId);

  return ok({
    contacto: despues,
    refresco: { actualizado: porque === null, porque, enlaceCrm },
    enlaceAgendar,
  });
}
