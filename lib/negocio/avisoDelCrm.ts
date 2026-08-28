// Interpretar un aviso de GoHighLevel, ya autenticado y ya guardado crudo.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE ARCHIVO TIENE QUE RESOLVER, Y ES LO QUE SE PIDIÓ
//
// *«que cuando llegue, el sistema sepa que este contacto que tiene mensaje entrante esté en qué parte
// del pipeline, o sea que llegue de forma adecuada, y lo principal es si va a setter o si va a closer,
// o si ni siquiera aparece en ninguno, con las etiquetas»*.
//
// La buena noticia es que eso **ya está resuelto y compartido**: `refrescarUnContacto` pregunta el
// contacto a GoHighLevel, lee sus etiquetas y decide el territorio recorriendo `ETIQUETAS`, que es la
// MISMA lista y el MISMO orden de precedencia que usa la sincronización completa. Devuelve
// `'closer'`, `'setter'` o `null` — y ese `null` es exactamente «no aparece en ninguno».
//
// Este archivo no reimplementa nada de eso. Si lo hiciera, habría dos lugares decidiendo el
// territorio, y el síntoma de que divergieran sería un contacto que aparece en las dos pestañas o en
// ninguna. El comentario que lo dice está en `lib/negocio/sincronizar.ts`, y es la razón por la que
// acá solo se llama.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL MENSAJE ENTRA COMO FABRICADO, Y POR ESO LA REGLA DEL GEMELO SE HIZO PRIMERO
//
// La acción Webhook estándar de GoHighLevel **no manda el identificador del mensaje** (medido en la
// plataforma anterior). Así que el aviso escribe su fila con un identificador FABRICADO y marcado
// `id_fabricado: true`.
//
// Sin la regla del gemelo, cuando el sondeo trajera después ese mismo mensaje con su identificador
// real quedarían **dos filas para un mensaje** — el mismo defecto que el chat ya tenía con los
// mensajes propios, multiplicado por cada mensaje entrante. Con la regla, el real reemplaza al
// fabricado y hereda su atribución. Ver `lib/negocio/mensajes.ts`.
//
// El identificador fabricado es DETERMINÍSTICO —un hash del contacto, la hora y el texto— y no
// aleatorio: GoHighLevel admite entregas duplicadas, y con un valor aleatorio dos entregas del mismo
// evento serían dos filas. Con el determinístico, el `unique (org_id, ghl_mensaje_id)` las une.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE NO HACE, Y CONVIENE QUE ESTÉ ESCRITO
//
//   · **No toca la marca de agua** ni pasa por `conElPulso`. Las dos cosas serían un error concreto:
//     el antirrebote significa «no correr», y para un aviso eso es descartar un cuerpo que YA llegó;
//     y `marca_el` se escribe con `greatest(...)`, así que empujarla declararía ingerido todo lo
//     anterior y saltearía en silencio las conversaciones que el sondeo no alcanzó.
//   · **No fija `mensajes_desde_el`** (`fijarPiso: false`). Trae UN mensaje, así que afirmar «desde
//     acá la conversación está completa» sería falso, y esa columna se escribe una vez y para siempre.
//   · **De las citas solo refresca las etiquetas**, no la hora. El ícono 📅 de la fila sale de la
//     etiqueta `cita_agendada`, así que se actualiza en segundos; la hora exacta de la Agenda la
//     sigue trayendo el barrido del calendario, cada hora. Traer la cita desde el cuerpo del webhook
//     sería un segundo escritor de `negocio.citas` con su propio criterio de cancelación, y ese
//     criterio ya existe en un solo lugar.
// ═══════════════════════════════════════════════════════════════════════════════

import { createHash } from 'node:crypto';
import type { AccesoAGhl } from '../credenciales/resolver.ts';
import { contactIdDelCuerpo, esEventoConocido, textoDelMensaje } from '../ghl/avisos.ts';
import { conOrganizacion, datos } from '../datos/contexto.ts';
import { escribirMensajes } from './mensajes.ts';
import { refrescarUnContacto } from './sincronizar.ts';

/** Lo que pasó con un aviso. Viaja a la respuesta y al registro, nunca al cliente con detalle. */
export type Interpretado =
  /** Se interpretó. `territorio` es dónde quedó el contacto: `null` = en ninguna pestaña. */
  | { tipo: 'listo'; evento: string; territorio: 'closer' | 'setter' | null; mensaje: boolean }
  /** El `?evento=` no es de los nuestros, o falta. Se guardó y NO se interpretó. */
  | { tipo: 'desconocido'; evento: string | null }
  /** El cuerpo no trae contacto en ninguna de sus tres formas. */
  | { tipo: 'sin_contacto' }
  /** GoHighLevel no devolvió ese contacto: puede estar borrado allá. */
  | { tipo: 'no_esta_en_el_crm' };

/**
 * La hora del MENSAJE, o la de llegada del aviso.
 *
 * ── `date_created` ES UNA TRAMPA, Y ESTÁ MEDIDA ─────────────────────────────
 *
 * En el payload del webhook estándar de GoHighLevel ese campo es la fecha en que se creó **el
 * contacto**, no el mensaje. Encontrado con webhooks reales el 2026-08-04 en la plataforma anterior:
 * llegaba idéntico en los tres webhooks de la prueba, **fechando mensajes de hoy veinte horas en el
 * pasado** y desordenando el chat.
 *
 * Y no da ningún error: el mensaje entra, se guarda, y aparece más arriba de lo que debería. Por eso
 * este archivo NO lo lee, y por eso este comentario existe — para que nadie lo agregue «porque parece
 * la fecha».
 *
 * `ocurridoEl` y `timestamp` sí son de contrato: los mandaría un workflow con cuerpo JSON editable.
 * Sin ellos, la hora de llegada es una aproximación honesta — el aviso llega segundos después.
 */
function horaDelMensaje(cuerpo: Record<string, unknown>, ahora: Date): Date {
  const declarada = cuerpo.ocurridoEl ?? cuerpo.timestamp;
  if (typeof declarada !== 'string' && typeof declarada !== 'number') return ahora;
  const ms = Date.parse(String(declarada));
  return Number.isNaN(ms) ? ahora : new Date(ms);
}

/**
 * Un identificador de mensaje DETERMINÍSTICO, para cuando el proveedor no manda el suyo.
 *
 * Determinístico y no aleatorio porque GoHighLevel admite entregas duplicadas: con un valor al azar,
 * dos entregas del mismo evento serían dos filas en el chat. Con esto, la segunda choca contra
 * `unique (org_id, ghl_mensaje_id)` y no entra.
 *
 * El prefijo `aviso:` no se usa para decidir nada —para eso está `id_fabricado`— pero hace que una
 * fila se pueda ubicar de un vistazo cuando alguien mira la tabla a mano.
 */
function idDelMensaje(contactId: string, cuando: Date, texto: string): string {
  const huella = createHash('sha256')
    .update(`${contactId}|${cuando.toISOString()}|${texto}`)
    .digest('hex')
    .slice(0, 32);
  return `aviso:${huella}`;
}

/**
 * Interpretar el aviso. **Corre fuera de un contexto de organización: lo abren las funciones que llama.**
 *
 * @param cuerpo El cuerpo ya parseado. Si no era JSON, quien llama no debe llegar acá: guarda la fila
 *   con `atribucion: 'ilegible'` y no interpreta, porque un cuerpo ilegible es la única evidencia de
 *   que el proveedor cambió de forma y descartarlo la pierde.
 */
/**
 * El lector del contacto, INYECTABLE.
 *
 * ── POR QUÉ ES UNA COSTURA Y NO UNA LLAMADA DIRECTA ────────────────────
 *
 * `refrescarUnContacto` habla con GoHighLevel. Sin esta costura, **la parte que importa de este
 * archivo no se puede probar**: en una base de pruebas no hay token del CRM, así que toda llamada
 * falla y el camino de interpretación —el territorio, el mensaje, el gemelo— nunca se ejecuta.
 *
 * Y eso ya pasó acá: las primeras pruebas de la ruta pasaban en verde **por el motivo equivocado**,
 * porque `procesado` era siempre falso por falta de credencial y no porque la validación funcionara.
 * Una prueba que pasa por la razón equivocada es peor que ninguna.
 *
 * Es el mismo patrón que `barrerCitas` ya usa con sus `lectores`, y por el mismo motivo.
 */
export type LectorDeContacto = typeof refrescarUnContacto;

export async function interpretarAviso(
  orgId: string,
  acceso: AccesoAGhl & { tipo: 'listo' },
  evento: string | null,
  cuerpo: Record<string, unknown>,
  leerContacto: LectorDeContacto = refrescarUnContacto,
): Promise<Interpretado> {
  /* Un evento que no conocemos NO es un error: es un workflow nuevo, o la trampa de la URL sin
     `?evento=`. La fila queda guardada y sin procesar, y el monitor la cuenta — que es lo que
     distingue «no llega nada» de «llega y se descarta», dos investigaciones distintas. */
  if (!esEventoConocido(evento)) return { tipo: 'desconocido', evento };

  const contactId = contactIdDelCuerpo(cuerpo);
  if (contactId === null) return { tipo: 'sin_contacto' };

  /* ── EL CONTACTO Y SU TERRITORIO, QUE ES EL CORAZÓN DE ESTO ───────────────
   *
   * Se refresca cuando NO está en la caché, y ahí está la decisión de costo.
   *
   * La plataforma anterior llamaba a `asegurarContacto` en **todos** los eventos de mensaje, o sea
   * una llamada al CRM por mensaje. Acá el caso normal —un contacto que ya conocemos— cuesta **cero
   * llamadas**: el cuerpo del aviso trae el texto, y el territorio ya lo sabemos porque el cron lo
   * releyó hace como mucho diez minutos.
   *
   * Y para un contacto NUEVO sí se llama, que es el caso que importa: es la «red de seguridad del
   * alta» de la referencia. Sin ella, un lead que escribe antes de que el cron lo traiga entra al
   * sistema sin territorio, no aparece en ninguna pestaña, y su mensaje se pierde porque la marca de
   * agua pasa sobre las conversaciones de contactos desconocidos.
   *
   * Los eventos de CONTACTO y de CITA siempre refrescan: su único punto es que las etiquetas
   * cambiaron, así que leer la caché sería leer justo lo viejo. */
  const esDeMensaje = evento === 'mensaje.entrante' || evento === 'mensaje.saliente';
  const yaEsta = await conOrganizacion(orgId, async () =>
    datos()
      .selectFrom('contactos')
      .select(['id', 'territorio'])
      .where('ghl_contact_id', '=', contactId)
      .executeTakeFirst(),
  );

  let territorio: 'closer' | 'setter' | null = (yaEsta?.territorio ?? null) as
    | 'closer'
    | 'setter'
    | null;
  let contactoId = yaEsta?.id ?? null;

  if (!esDeMensaje || contactoId === null) {
    const r = await conOrganizacion(orgId, () => leerContacto(acceso, contactId));
    if (r.tipo === 'no_esta_en_el_crm') return { tipo: 'no_esta_en_el_crm' };
    if (r.tipo === 'fallo') throw new Error(`el CRM respondió ${r.fallo.tipo}`);
    if (r.tipo === 'salteado') throw new Error(`el contacto se salteó: ${r.motivo}`);
    territorio = r.territorio;

    // Y se vuelve a leer para tener su identificador nuestro: `refrescarUnContacto` lo crea si no
    // estaba, y sin el identificador no se le puede colgar el mensaje.
    const ahora = await conOrganizacion(orgId, async () =>
      datos()
        .selectFrom('contactos')
        .select('id')
        .where('ghl_contact_id', '=', contactId)
        .executeTakeFirst(),
    );
    contactoId = ahora?.id ?? null;
    if (contactoId === null) return { tipo: 'no_esta_en_el_crm' };
  }

  if (!esDeMensaje) return { tipo: 'listo', evento, territorio, mensaje: false };

  /* ── EL MENSAJE ────────────────────────────────────────────────────────────
   *
   * Entra por `escribirMensajes`, que es EL único escritor, con `id_fabricado: true` porque el
   * proveedor no manda su identificador. Cuando el sondeo traiga el mismo mensaje con el real, la
   * regla del gemelo reemplaza esta fila en vez de duplicarla. */
  const ahora = new Date();
  const cuando = horaDelMensaje(cuerpo, ahora);
  const texto = textoDelMensaje(cuerpo);
  const entrante = evento === 'mensaje.entrante';

  await escribirMensajes(
    orgId,
    [
      {
        ghl_mensaje_id: idDelMensaje(contactId, cuando, texto),
        // El aviso no trae identificador de conversación de forma fiable, y el campo admite nulo. La
        // ingesta lo completa cuando trae el mensaje real.
        ghl_conversacion_id:
          typeof cuerpo.conversationId === 'string' ? cuerpo.conversationId : null,
        contacto_id: contactoId,
        // El canal no viene en el payload nativo de forma fiable. Nulo y no `'WhatsApp'` inventado:
        // el disparador del workflow filtra por canal, pero eso lo sabe GoHighLevel, no nosotros.
        canal: null,
        direccion: entrante ? 'entrante' : 'saliente',
        cuerpo: texto,
        /* Un ENTRANTE es del contacto y no hay ambigüedad: es el único autor que el aviso puede
           afirmar sin depender de campos que su payload no manda.
           Un SALIENTE se atribuye al agente, que es la misma regla asimétrica de la ingesta y por el
           mismo motivo: si lo hubiera escrito una persona de esta plataforma, la fila ya existe con
           su nombre — y la regla del gemelo hace que este aviso la respete en vez de pisarla. */
        autor: entrante ? 'contacto' : 'agente',
        enviado_el: cuando,
        // Nace sin estado de entrega. El aviso no lo trae, y ponerle «entregado» sería el defecto
        // original que el chat ya pagó una vez.
        estado_entrega: null,
        estado_entrega_familia: 'en_curso',
        estado_entrega_revisado_el: null,
        estado_entrega_el: null,
        // FABRICADO. Es lo que le dice a la regla del gemelo que esta fila cede ante la real.
        id_fabricado: true,
        // Primera vez que este valor del `check` de `013:113-115` se escribe. Estuvo declarado desde
        // el primer día sin un solo escritor.
        origen: 'aviso',
      },
    ],
    { fijarPiso: false },
  );

  return { tipo: 'listo', evento, territorio, mensaje: true };
}
