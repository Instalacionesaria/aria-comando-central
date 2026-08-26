// El chat de la ficha: leer y mandar.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LEER NO CUESTA NADA, Y ES UNA PROPIEDAD DEL DISEÑO
//
// El `GET` lee de la caché: **cero llamadas al CRM**. El `03` § 1 lo pone como propiedad y no como
// optimización — los mensajes los mantienen el aviso del CRM y la ingesta periódica, y el chat solo
// los lee. Todo el presupuesto se gasta en TRAER los datos cuando cambian; mostrarlos es gratis.
//
// Por eso el reloj de cinco segundos de la ficha puede existir sin negociar con nadie.
//
// ── LOS MENSAJES Y LA VENTANA VIAJAN JUNTOS, Y NO ES POR AHORRAR UN VIAJE ───
//
// Son **el mismo hecho**: la ventana de 24 horas se calcula desde el último mensaje del contacto.
// En dos respuestas separadas pueden contradecirse —llega una respuesta, el chat la muestra, y el
// compositor sigue deshabilitado hasta el pedido siguiente— y esa contradicción se ve como un
// defecto aunque las dos respuestas sean correctas por separado.
//
// ── EL `POST` NO PROMETE ENTREGA, Y ESO ESTÁ EN TODAS PARTES ───────────────
//
// Un `201` acá significa **el CRM lo aceptó**. El defecto que originó todo este bloque es
// exactamente ése: la llamada devolvió éxito y el canal rechazó el mensaje minutos después. Así que
// la fila nace `en_curso`, nunca «entregado», y la tercera pasada va a buscar el estado real.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../../../lib/autorizacion/respuesta.ts';
import { conIdentidad } from '../../../../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../../../../lib/datos/contexto.ts';
import { resolverAccesoAGhl, TEXTO_DE_FALTA_GHL } from '../../../../../lib/credenciales/resolver.ts';
import { enviarMensaje, type CanalDeEnvio } from '../../../../../lib/ghl/conversaciones.ts';
import { mensajesDeLaFicha } from '../../../../../lib/negocio/ficha.ts';
import { ventanaDeRespuesta } from '../../../../../lib/negocio/ventana.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El tope del cuerpo. El canal corta bastante antes; esto solo evita mandar un disparate. */
const TOPE = 4000;

const MOTIVOS = {
  cuerpo_invalido: 'El cuerpo de la petición no es JSON válido.',
  falta_texto: 'El mensaje está vacío.',
  demasiado_largo: `El mensaje no puede pasar de ${TOPE} caracteres.`,
  sin_crm:
    'Este contacto no tiene identificador de GoHighLevel, así que no hay a dónde mandar el ' +
    'mensaje. Volvé a sincronizar los contactos.',
} as const;

export async function GET(
  peticion: Request,
  ctx: RouteContext<'/api/contactos/[id]/mensajes'>,
): Promise<Response> {
  // `contactos.ver`, la capacidad de la ficha. Las cinco pestañas piden la MISMA: son una sola
  // pantalla, y `ADR-0304` lo exige — si una pidiera algo distinto, esa pestaña se vería vacía
  // para alguien que ve las otras cuatro, y no habría forma de darse cuenta mirando.
  const contexto = await exigir(peticion, ['contactos.ver']);
  if (contexto instanceof Response) return contexto;

  const { id } = await ctx.params;
  if (!UUID.test(id)) return rechazo('no_encontrado');

  const r = await conOrganizacion(contexto.orgEfectiva, async () => {
    const contacto = await datos()
      .selectFrom('contactos')
      .select(['ultimo_entrante_el'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!contacto) return null;
    return { pestana: await mensajesDeLaFicha(id), ultimoEntranteEl: contacto.ultimo_entrante_el };
  });
  if (!r) return rechazo('no_encontrado');

  return ok({
    mensajes: r.pestana.filas,
    falta: r.pestana.falta,
    /* Hace cuánto que el barrido automático no trae mensajes. Viaja SIEMPRE, no solo con la lista
       vacía: un chat con lo de anteayer se ve completo, y el mensaje de ayer es el que falta. */
    frescura: r.pestana.frescura,
    // La ventana la calcula el SERVIDOR con su reloj. Dejársela al navegador haría que un reloj
    // atrasado abriera un compositor que el canal va a rechazar — y la decisión de gastar o no la
    // llamada la toma el servidor.
    ventana: ventanaDeRespuesta(r.ultimoEntranteEl),
  });
}

export async function POST(
  peticion: Request,
  ctx: RouteContext<'/api/contactos/[id]/mensajes'>,
): Promise<Response> {
  // Escribir pide otra capacidad, y NO rompe `ADR-0304`: la regla previene pantallas con secciones
  // vacías por lecturas desparejas. Un compositor deshabilitado no es un panel vacío — se ve que el
  // chat se puede leer y no escribir.
  const contexto = await exigir(peticion, ['conversaciones.responder']);
  if (contexto instanceof Response) return contexto;

  const { id } = await ctx.params;
  if (!UUID.test(id)) return rechazo('no_encontrado');

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return rechazo('peticion_invalida', MOTIVOS.cuerpo_invalido);
  }
  const texto = (cuerpo as { texto?: unknown } | null)?.texto;
  if (typeof texto !== 'string' || texto.trim().length === 0) {
    return rechazo('peticion_invalida', MOTIVOS.falta_texto);
  }
  if (texto.length > TOPE) return rechazo('peticion_invalida', MOTIVOS.demasiado_largo);

  // ── PASO 1 · ¿existe, y se le puede escribir? Sin gastar ninguna llamada. ──
  const previo = await conOrganizacion(contexto.orgEfectiva, async () =>
    datos()
      .selectFrom('contactos')
      .select(['ghl_contact_id', 'ultimo_entrante_el'])
      .where('id', '=', id)
      .executeTakeFirst(),
  );
  if (!previo) return rechazo('no_encontrado');
  if (!previo.ghl_contact_id) return rechazo('peticion_invalida', MOTIVOS.sin_crm);

  const ventana = ventanaDeRespuesta(previo.ultimo_entrante_el);
  if (!ventana.abierta) {
    // **Se corta ANTES de gastar la llamada**, y se dice el motivo. Es la mitad preventiva del
    // arreglo; la otra mitad es la tercera pasada, que atrapa todo lo demás que el canal rechaza.
    //
    // Va la ventana entera en el cuerpo para que el compositor pueda mostrar cuánto hace que
    // venció sin tener que pedirla de nuevo.
    return rechazo('ventana_cerrada', String(ventana.motivo));
  }

  const acceso = await conIdentidad(async (db) => resolverAccesoAGhl(db, contexto.orgEfectiva));
  if (acceso.tipo === 'falta') {
    return rechazo('credenciales_incompletas', TEXTO_DE_FALTA_GHL[acceso.que]);
  }

  // ── PASO 2 · mandar. ──────────────────────────────────────────────────────
  const CANAL: CanalDeEnvio = 'WhatsApp';
  const enviado = await enviarMensaje(
    { token: acceso.token },
    { contactId: previo.ghl_contact_id, texto: texto.trim(), canal: CANAL },
  );
  if (enviado.tipo === 'fallo') {
    const f = enviado.fallo;
    if (f.tipo === 'no_autorizado') {
      return rechazo(
        'credencial_rechazada',
        'GoHighLevel rechazó el token. Esta operación necesita el permiso `conversations/message.write`.',
      );
    }
    if (f.tipo === 'demasiadas_peticiones') {
      return rechazo(
        'servicio_externo_saturado',
        'GoHighLevel está limitando las peticiones. Esperá un minuto y probá de nuevo.',
      );
    }
    if (f.tipo === 'sin_respuesta') {
      // NO se dice "se mandó". No llegó la pregunta, así que no se sabe si salió.
      return rechazo(
        'servicio_externo_no_disponible',
        'No se pudo contactar a GoHighLevel. El mensaje no se dio por enviado.',
      );
    }
    return rechazo(
      'servicio_externo_no_disponible',
      `GoHighLevel respondió ${f.estado}. El mensaje no se dio por enviado.`,
    );
  }

  // ── PASO 3 · guardar la fila, EN CURSO. ───────────────────────────────────
  //
  // El identificador puede no venir. Cuando falta se fabrica uno y se marca: sin `id_fabricado`,
  // la tercera pasada preguntaría por un identificador que el CRM no conoce —dos llamadas por
  // ciclo, para siempre— y la cola no se vaciaría nunca. Medido: un identificador inventado
  // devuelve 400, así que ni siquiera se distingue de un error transitorio.
  const fabricado = enviado.datos.mensajeId === null;
  const ahora = new Date();
  const guardado = await conOrganizacion(contexto.orgEfectiva, async () =>
    datos()
      .insertInto('mensajes')
      .values({
        ghl_mensaje_id: enviado.datos.mensajeId ?? `propio:${id}:${ahora.getTime()}`,
        ghl_conversacion_id: enviado.datos.conversacionId,
        contacto_id: id,
        canal: CANAL,
        direccion: 'saliente',
        cuerpo: texto.trim(),
        // Lo escribió una PERSONA, y acá sí se sabe con certeza: hay una sesión detrás.
        autor: 'persona',
        autor_usuario_id: contexto.usuarioId,
        enviado_el: ahora,
        // Nace SIN estado y `en_curso`. Poner «entregado» acá es literalmente el defecto original.
        estado_entrega: null,
        estado_entrega_familia: 'en_curso',
        // Nunca revisado: es lo que lo pone al frente de la cola de la tercera pasada.
        estado_entrega_revisado_el: null,
        id_fabricado: fabricado,
        origen: 'propio',
      } as never)
      .returning(['id', 'enviado_el'])
      .executeTakeFirst(),
  );

  return ok(
    {
      enviado: true,
      id: guardado?.id ?? null,
      enviadoEl: guardado?.enviado_el ?? ahora,
      entrega: 'en_curso',
      // Se avisa cuando el CRM no devolvió identificador: ese mensaje **no va a poder confirmarse
      // nunca**, y quien mira el chat tiene derecho a saber que el visto bueno no va a llegar.
      sinSeguimiento: fabricado,
    },
    201,
  );
}
