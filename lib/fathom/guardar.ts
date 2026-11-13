// EL ESCRITOR DE FATHOM · una grabación del webhook → su recepción y, si es una venta con lead, su llamada y su
// transcripción en la familia única (`negocio.llamadas` + `negocio.transcripciones`).
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUIÉN LO LLAMA Y DÓNDE CORRE
//
// Sólo la ruta `app/api/fathom/webhook`, DENTRO de `conOrganizacion(` con el ámbito de la subcuenta de ARIA: todo lo de
// acá usa `datos()`, que es la transacción de ese contexto, y por eso la recepción, la llamada y la transcripción
// quedan juntas o no queda ninguna. Las inserciones van con `insertInto` (el plugin pone `org_id`; un `sql` crudo no lo
// recibe y la RLS lo rechazaría) y con `cuenta_id` explícito. No emite eventos (la 332) ni toca el analizador de tl;dv.
//
// ═══════════════════════════════════════════════════════════════════════════════
// CÓMO SE ENCUENTRA AL LEAD (decisiones del usuario, 2026-11-13)
//
//   1. POR CORREO: cada candidato (un invitado con correo que no es del equipo; primero los externos) contra
//      `contactos.email` de la subcuenta, sin mayúsculas ni espacios, sin los que el CRM dio de baja (108). Si casa
//      algún externo, sólo cuentan los externos.
//        · uno → ése;
//        · varios (el correo no es único en `contactos`, o el lead vino con su socio) → si exactamente uno tiene una
//          cita a ±12 h, ése; si no, el de alta más reciente, marcado `ambiguo`.
//   2. POR CITA, si ningún correo casó: si exactamente UN contacto de la subcuenta tiene una cita a ±12 h de la
//      llamada, ése (es la misma regla que `lib/negocio/vinculoDeLlamadas.ts`). Cubre el caso de que el calendario no
//      traiga al lead como invitado.
//   3. Si no: `sin_lead` (había un correo y no casó) o `sin_correo_externo` (no había ninguno).
//
// Las citas que cuentan son las vigentes: ni dadas de baja en el CRM ni canceladas.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LOS REINTENTOS
//
// Fathom reintenta lo que no recibe un 2xx, con el mismo `webhook-id`. La recepción es única por grabación: un envío
// repetido no hace nada («ya estaba»). La excepción es una recepción que quedó en `error` (la escribe
// `registrarErrorDeFathom` en otra transacción): ésa se reprocesa entera.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql, type Insertable } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { HORAS_DEL_VINCULO_POR_CITA } from '../negocio/vinculoDeLlamadas.ts';
import { cancelada } from '../negocio/citasAlcanzables.ts';
import type { FathomMeeting } from '../analizadores/nucleo/fathom.ts';
import type { TablaRecepcionesDeFathom } from '../datos/esquema.ts';
import { esVentaPorTitulo } from './clasificar.ts';
import { correoComparable, participantesDe, type Participante } from './participantes.ts';
import { duracionDe, transcripcionDe } from './transcripcion.ts';

export type EstadoDeFathom = 'guardada' | 'no_es_venta' | 'sin_correo_externo' | 'sin_lead' | 'sin_transcripcion' | 'error';

/** Los usuarios de la organización: su correo y su id. Los lee la ruta en identidad. */
export interface MiembroDelEquipo {
  id: string;
  email: string;
}

export interface EntradaDeFathom {
  /** La subcuenta de ARIA: la cuenta por omisión de la organización principal. */
  cuentaId: string;
  reunion: FathomMeeting;
  webhookId: string | null;
  equipo: readonly MiembroDelEquipo[];
}

export interface ResultadoDeFathom {
  estado: EstadoDeFathom;
  /** El envío ya se había procesado: no se hizo nada. */
  yaEstaba: boolean;
  recepcionId: string | null;
  llamadaId: string | null;
}

interface Vinculo {
  contactoId: string | null;
  citaId: string | null;
  por: 'correo' | 'cita' | null;
  ambiguo: boolean;
  correo: string | null;
  motivo: string | null;
}

/** El id de la grabación como texto, o `null` si no es un entero positivo seguro. */
export function idDeLaGrabacion(reunion: { recording_id?: unknown }): string | null {
  const v = reunion.recording_id;
  return typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? String(v) : null;
}

/** Cuándo fue la llamada: el inicio de la grabación, o la hora agendada, o la de creación. */
function fechaDe(reunion: FathomMeeting): Date | null {
  const v = reunion.recording_start_time ?? reunion.scheduled_start_time ?? reunion.created_at;
  if (!v) return null;
  const f = new Date(v);
  return Number.isNaN(f.getTime()) ? null : f;
}

function texto(v: unknown, tope: number): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim().slice(0, tope) : null;
}

/** Las citas vigentes de la subcuenta a ±12 h de la llamada: contacto → sus citas. */
async function citasCercanas(cuentaId: string, fecha: Date | null): Promise<Map<string, string[]>> {
  const porContacto = new Map<string, string[]>();
  if (!fecha) return porContacto;
  const filas = (
    await sql<{ id: string; contacto_id: string }>`
      select ci.id, ci.contacto_id
        from negocio.citas ci
       where ci.cuenta_id = ${cuentaId}
         and ci.baja_en_el_crm is null
         and not ${cancelada('ci')}
         and ci.inicio_el between ${fecha}::timestamptz - make_interval(hours => ${HORAS_DEL_VINCULO_POR_CITA})
                              and ${fecha}::timestamptz + make_interval(hours => ${HORAS_DEL_VINCULO_POR_CITA})
       order by ci.inicio_el, ci.id`.execute(datos())
  ).rows;
  for (const f of filas) porContacto.set(f.contacto_id, [...(porContacto.get(f.contacto_id) ?? []), f.id]);
  return porContacto;
}

/** La cita de un contacto, sólo si es UNA en la ventana. */
function citaUnica(citas: Map<string, string[]>, contactoId: string): string | null {
  const suyas = citas.get(contactoId) ?? [];
  return suyas.length === 1 ? (suyas[0] ?? null) : null;
}

async function buscarLead(cuentaId: string, candidatos: string[], externos: string[], fecha: Date | null): Promise<Vinculo> {
  const citas = await citasCercanas(cuentaId, fecha);

  const todosPorCorreo =
    candidatos.length === 0
      ? []
      : (
          await sql<{ id: string; email: string }>`
            select k.id, lower(btrim(k.email)) as email
              from negocio.contactos k
             where k.cuenta_id = ${cuentaId}
               and k.baja_en_el_crm is null
               and lower(btrim(k.email)) = any(${candidatos}::text[])
             order by k.alta_en_el_crm desc nulls last, k.id`.execute(datos())
        ).rows;
  // Si casó algún invitado externo, el lead está entre ellos: un interno que también es contacto no compite.
  const deExternos = todosPorCorreo.filter((k) => externos.includes(k.email));
  const porCorreo = deExternos.length > 0 ? deExternos : todosPorCorreo;

  const primero = porCorreo[0];
  if (porCorreo.length === 1 && primero) {
    const k = primero;
    return { contactoId: k.id, citaId: citaUnica(citas, k.id), por: 'correo', ambiguo: false, correo: k.email, motivo: null };
  }
  if (porCorreo.length > 1 && primero) {
    const conCita = porCorreo.filter((k) => citas.has(k.id));
    const unico = conCita[0];
    if (conCita.length === 1 && unico) {
      const k = unico;
      return {
        contactoId: k.id,
        citaId: citaUnica(citas, k.id),
        por: 'correo',
        ambiguo: false,
        correo: k.email,
        motivo: `${porCorreo.length} contactos con esos correos; desempató la cita.`,
      };
    }
    // Ya vienen por alta más reciente.
    const k = primero;
    return {
      contactoId: k.id,
      citaId: citaUnica(citas, k.id),
      por: 'correo',
      ambiguo: true,
      correo: k.email,
      motivo: `${porCorreo.length} contactos con esos correos y ninguna cita única: se eligió el de alta más reciente.`,
    };
  }

  // Ningún correo casó: la cita, si es de UN solo contacto.
  const citados = [...citas.keys()];
  const contactoId = citados[0];
  if (citados.length === 1 && contactoId) {
    return {
      contactoId,
      citaId: citaUnica(citas, contactoId),
      por: 'cita',
      ambiguo: false,
      correo: candidatos[0] ?? null,
      motivo: candidatos.length > 0 ? 'Ningún correo casó; lo encontró la única cita a ±12 h.' : 'Sin correo de invitados; lo encontró la única cita a ±12 h.',
    };
  }
  const deCitas = citados.length > 1 ? ` ${citados.length} contactos con cita a ±12 h: no se elige.` : ' Ninguna cita a ±12 h.';
  return {
    contactoId: null,
    citaId: null,
    por: null,
    ambiguo: false,
    correo: candidatos[0] ?? null,
    motivo:
      candidatos.length > 0
        ? `Ningún contacto de la subcuenta con ${candidatos.length === 1 ? 'el correo' : 'los correos'} ${candidatos.join(', ')}.${deCitas}`
        : `Sin invitados con correo fuera del equipo.${deCitas}`,
  };
}

type ValoresDeRecepcion = Omit<Insertable<TablaRecepcionesDeFathom>, 'org_id' | 'intentos'>;

/** Lo que va igual en la recepción, sea cual sea el estado. */
function columnasDeLaRecepcion(
  e: EntradaDeFathom,
  recordingId: string,
  participantes: Participante[],
): Omit<ValoresDeRecepcion, 'estado'> {
  const r = e.reunion;
  return {
    cuenta_id: e.cuentaId,
    recording_id: recordingId,
    webhook_id: texto(e.webhookId, 300),
    procesado_el: new Date(),
    titulo: texto(r.title, 1000),
    titulo_del_calendario: texto(r.meeting_title, 1000),
    tipo_de_reunion_fathom: texto(r.meeting_type, 300),
    fecha_de_la_reunion: fechaDe(r),
    duracion_seg: duracionDe(r),
    url_de_la_grabacion: texto(r.share_url, 2000) ?? texto(r.url, 2000),
    idioma: texto(r.transcript_language, 20),
    grabado_por_email: texto(correoComparable(r.recorded_by?.email), 320),
    grabado_por_nombre: texto(r.recorded_by?.name, 300),
    participantes: JSON.stringify(participantes),
  };
}

/**
 * Inserta la recepción. Si ya estaba en `error`, la borra y la vuelve a crear con un intento más; si ya estaba en otro
 * estado, devuelve `null` (ya estaba). Un envío simultáneo lo resuelve el `unique`: el segundo no inserta nada.
 */
async function insertarRecepcion(valores: ValoresDeRecepcion): Promise<string | null> {
  const previa = await datos()
    .selectFrom('recepciones_de_fathom')
    .select(['id', 'estado', 'intentos'])
    .where('recording_id', '=', String(valores.recording_id))
    .forUpdate()
    .executeTakeFirst();
  let intentos = 1;
  if (previa) {
    if (previa.estado !== 'error') return null;
    intentos = previa.intentos + 1;
    await datos().deleteFrom('recepciones_de_fathom').where('id', '=', previa.id).execute();
  }
  const fila = await datos()
    .insertInto('recepciones_de_fathom')
    .values({ ...valores, intentos })
    .onConflict((oc) => oc.columns(['org_id', 'recording_id']).doNothing())
    .returning('id')
    .executeTakeFirst();
  return fila?.id ?? null;
}

/**
 * Procesa una grabación. Corre dentro de `conOrganizacion(` con el ámbito de la subcuenta de ARIA. Lanza si la base
 * falla: la ruta decide si es para reintentar o para registrar el error.
 */
export async function guardarReunionDeFathom(e: EntradaDeFathom): Promise<ResultadoDeFathom> {
  const recordingId = idDeLaGrabacion(e.reunion);
  if (!recordingId) throw new Error('guardarReunionDeFathom: la grabación no trae un recording_id válido');

  const r = e.reunion;
  const clasificacion = esVentaPorTitulo(r.meeting_title, r.title);
  const { participantes, candidatos, externos } = participantesDe(r, e.equipo.map((m) => m.email));
  const vinculo = await buscarLead(e.cuentaId, candidatos, externos, fechaDe(r));
  const transcripcion = transcripcionDe(r);

  let estado: EstadoDeFathom;
  let motivo: string | null = vinculo.motivo;
  if (!clasificacion.esVenta) {
    estado = 'no_es_venta';
    motivo = `Ningún título empieza con HT (calendario: ${JSON.stringify(r.meeting_title ?? null)}, grabación: ${JSON.stringify(r.title ?? null)}).`;
  } else if (!vinculo.contactoId) {
    estado = candidatos.length > 0 ? 'sin_lead' : 'sin_correo_externo';
  } else if (!transcripcion) {
    estado = 'sin_transcripcion';
    motivo = 'Fathom mandó la grabación sin transcripción.';
  } else {
    estado = 'guardada';
    if (transcripcion.recortada) motivo = [motivo, 'La transcripción pasaba el tope y se recortó.'].filter(Boolean).join(' ');
  }

  const recepcionId = await insertarRecepcion({
    ...columnasDeLaRecepcion(e, recordingId, participantes),
    correo_del_lead: vinculo.correo,
    contacto_id: vinculo.contactoId,
    cita_id: vinculo.citaId,
    vinculada_por: vinculo.por,
    ambiguo: vinculo.ambiguo,
    estado,
    motivo: motivo ? motivo.slice(0, 2000) : null,
  });
  if (!recepcionId) return { estado, yaEstaba: true, recepcionId: null, llamadaId: null };
  if (estado !== 'guardada' || !vinculo.contactoId || !transcripcion) {
    return { estado, yaEstaba: false, recepcionId, llamadaId: null };
  }

  // ── La llamada y su transcripción ──
  const grabo = correoComparable(r.recorded_by?.email);
  const persona = e.equipo.find((m) => correoComparable(m.email) === grabo && grabo !== '');
  const externaId = `fathom:${recordingId}`;
  const insertada = await datos()
    .insertInto('llamadas')
    .values({
      cuenta_id: e.cuentaId,
      externa_id: externaId,
      contacto_id: vinculo.contactoId,
      contestada: true,
      inicio_el: fechaDe(r),
      duracion_segundos: duracionDe(r),
      tipo: 'venta',
      proveedor: 'fathom',
      cita_id: vinculo.citaId,
      persona_id: persona?.id ?? null,
      url_de_la_grabacion: texto(r.share_url, 2000) ?? texto(r.url, 2000),
      estado_de_transcripcion: 'lista',
      vinculada_por: vinculo.por,
      titulo: clasificacion.porTitulo === 'grabacion' ? texto(r.title, 1000) : (texto(r.meeting_title, 1000) ?? texto(r.title, 1000)),
      participantes: JSON.stringify(participantes),
    })
    .onConflict((oc) => oc.columns(['org_id', 'externa_id']).doNothing())
    .returning('id')
    .executeTakeFirst();
  const llamadaId =
    insertada?.id ??
    (await datos().selectFrom('llamadas').select('id').where('externa_id', '=', externaId).executeTakeFirstOrThrow()).id;

  // De sólo agregar (111): si la llamada ya tenía su transcripción, no se agrega otra.
  const yaTiene = await datos()
    .selectFrom('transcripciones')
    .select('id')
    .where('llamada_id', '=', llamadaId)
    .orderBy('creada_el', 'desc')
    .limit(1)
    .executeTakeFirst();
  if (!yaTiene) {
    await datos()
      .insertInto('transcripciones')
      .values({
        cuenta_id: e.cuentaId,
        llamada_id: llamadaId,
        contacto_id: vinculo.contactoId,
        texto: transcripcion.texto,
        segmentos: JSON.stringify(transcripcion.segmentos),
        idioma: transcripcion.idioma,
        proveedor: 'fathom',
      })
      .execute();
  }

  await datos().updateTable('recepciones_de_fathom').set({ llamada_id: llamadaId }).where('id', '=', recepcionId).execute();
  return { estado, yaEstaba: false, recepcionId, llamadaId };
}

/**
 * Deja constancia de un envío que falló por algo que no es la conexión (un CHECK, un dato que no se esperaba). Corre en
 * su PROPIA transacción, después de que la del proceso se revirtió. Si ya había una recepción en otro estado, no la
 * toca. El mensaje nunca lleva la transcripción.
 */
export async function registrarErrorDeFathom(e: EntradaDeFathom, mensaje: string): Promise<void> {
  const recordingId = idDeLaGrabacion(e.reunion);
  if (!recordingId) return;
  const { participantes } = participantesDe(e.reunion, e.equipo.map((m) => m.email));
  const previa = await datos()
    .selectFrom('recepciones_de_fathom')
    .select(['id', 'estado', 'intentos'])
    .where('recording_id', '=', recordingId)
    .forUpdate()
    .executeTakeFirst();
  if (previa && previa.estado !== 'error') return;
  if (previa) {
    await datos()
      .updateTable('recepciones_de_fathom')
      .set({ intentos: previa.intentos + 1, procesado_el: new Date(), motivo: mensaje.slice(0, 2000) })
      .where('id', '=', previa.id)
      .execute();
    return;
  }
  await datos()
    .insertInto('recepciones_de_fathom')
    .values({ ...columnasDeLaRecepcion(e, recordingId, participantes), estado: 'error', motivo: mensaje.slice(0, 2000) })
    .onConflict((oc) => oc.columns(['org_id', 'recording_id']).doNothing())
    .execute();
}

/**
 * ¿El error es de que NUESTRA base no está (conexión, recursos, apagado), y no de los datos? Sólo ése merece un 503
 * para que Fathom reintente: uno de los datos se repetiría igual en cada reintento, y Fathom terminaría desactivando el
 * webhook. Las clases de SQLSTATE: 08 (conexión), 53 (recursos), 57P (apagado); y los errores de red de Node.
 */
export function esFallaDeLaBase(e: unknown): boolean {
  const codigo = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
  if (/^(08|53|57P)/.test(codigo)) return true;
  if (['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EPIPE', 'EAI_AGAIN'].includes(codigo)) return true;
  const mensaje = e instanceof Error ? e.message : '';
  return /Connection terminated|timeout exceeded when trying to connect|connect ECONNREFUSED/i.test(mensaje);
}
