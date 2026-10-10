/* Lo que usa el tablero de Conversation para escribir: la lista cerrada de frases, los rótulos y los formatos
 * (docs/conversation/01-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md, CN-3). Vive aparte del panel, como en Sales, para
 * que la prueba lea la lista sin el marcado alrededor. */

/* ── LA LISTA CERRADA DE FRASES (CN1-02) ───────────────────────────────────
   Una frase nueva entra primero en el documento. Los rótulos —«Les escribimos», «{N} por resolver»— no son frases
   de un hueco: son rótulos. */
export const FRASE = {
  guion: '—',
  sinAsistencia: 'Nadie marca la asistencia.',
  bajoElPiso: 'Pocos casos para una tasa.',
  pocosParaMediana: 'Pocos casos para una mediana.',
  sinEnlace: 'Sin enlace con seguimiento.',
  sinLlamadas: 'Sin llamadas registradas.',
  sinAnalisis: 'Sin análisis en esta ventana.',
  noAudita: 'La empresa no audita sus agentes.',
  sinCampo: 'El CRM no lo registra.',
  sinAgendados: 'Nadie agendó en esta ventana.',
  sinEscritos: 'Sin mensajes en esta ventana.',
  sinRespuestas: 'Nadie respondió en esta ventana.',
  sinContactos: 'Sin contactos en este período',
  sinCitas: 'Sin citas en esta ventana.',
  cargando: 'Cargando…',
  fallo: 'No se pudo leer. Reintenta.',
};

/** La frase de cada motivo por el que una cifra no tiene valor (`MotivoDeLaCifra` de `lecturaDeConversation.ts`). */
export const FRASE_DEL_MOTIVO = {
  sin_contactos: FRASE.sinContactos,
  sin_citas: FRASE.sinCitas,
  sin_asistencia: FRASE.sinAsistencia,
  bajo_el_piso: FRASE.bajoElPiso,
  sin_enlace: FRASE.sinEnlace,
  sin_llamadas: FRASE.sinLlamadas,
  sin_analisis: FRASE.sinAnalisis,
  no_audita: FRASE.noAudita,
  sin_campo: FRASE.sinCampo,
  sin_agendados: FRASE.sinAgendados,
  sin_escritos: FRASE.sinEscritos,
  sin_respuestas: FRASE.sinRespuestas,
};

/* Los pasos de las cadenas y los conteos de las tarjetas de agente, con su rótulo (CN1-09 a CN1-11). La clave es
   la que manda el servidor. */
export const PASO = {
  entraron: 'Entraron',
  escritos: 'Les escribimos',
  respondieron: 'Respondieron',
  abrieron: 'Abrieron la landing',
  agendaron: 'Agendaron',
  citas: 'Citas',
  confirmaron: 'Confirmaron',
  asistieron: 'Asistieron',
  reprogramaron: 'Reprogramaron',
  cancelaron: 'Cancelaron',
};

/** Los tramos de ICP de `lib/negocio/tramosDelIcp.ts`, en el orden del servidor. */
export const TRAMO = {
  alto: 'Alto',
  medio: 'Medio',
  bajo: 'Bajo',
  sin_calificar: 'Sin calificar',
};

/* Las cuatro tarjetas de agente del prototipo, con su rol en una línea y el rótulo de la cifra grande. Las de
   texto llevan cifras del flujo, no del agente (CN1-11): el rótulo dice qué cifra es. */
export const AGENTE = {
  leadflow_texto: { flujo: 'Lead Flow', canal: 'txt', rol: 'Conversa con el contacto nuevo y lo lleva a agendar.', cifra: 'de respuesta' },
  leadflow_voz: { flujo: 'Lead Flow', canal: 'voz', rol: 'Llama al contacto que no respondió los mensajes de texto.', cifra: null },
  appflow_texto: { flujo: 'Appointment Flow', canal: 'txt', rol: 'Recuerda, confirma y sostiene la cita hasta la llamada.', cifra: 'de confirmación' },
  appflow_voz: { flujo: 'Appointment Flow', canal: 'voz', rol: 'Llama antes de la cita: dos preguntas y la confirmación.', cifra: null },
};

// ─── Los formatos. El guion es «no se sabe» o «bajo el piso», NUNCA un cero. ──

/** Lo único que multiplica por 100: todo viaja de 0 a 1 (CN1-15). */
export const cien = (v) => Math.round(v * 100);

/** Un conteo entero, como lo escribe el prototipo: «1,240». */
export const miles = (n) => n.toLocaleString('es-PE');
export const pf = (v) => `${cien(v)}%`;
export const o = (v, formato) => (v === null || v === undefined ? FRASE.guion : formato(v));

/**
 * La fecha desde la que hay datos, en la zona de quien mira: se compara con el calendario de quien mira («desde el
 * lunes pasado»), y en UTC quien está en Lima vería un día menos cada vez que el primer registro cayó después de las
 * 19 h. Con «Completo», es lo que impide leer tres semanas como toda la historia. Con el año cuando no es el de
 * hoy: «desde el 8 de agosto» de otro año se leería como el de éste.
 */
export const fechaCorta = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const otroAno = d.getFullYear() !== new Date().getFullYear();
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', ...(otroAno ? { year: 'numeric' } : {}) }).format(d);
};

/**
 * Unos minutos, en la unidad que se lee: la mediana de la primera respuesta va de segundos a días según la
 * empresa, y «371 min» obliga a dividir de cabeza. Bajo diez minutos, con un decimal: «0 min» se leería instantáneo.
 */
export const minutos = (m) => {
  if (m < 10) return `${(Math.round(m * 10) / 10).toLocaleString('es-PE')} min`;
  if (m < 90) return `${Math.round(m)} min`;
  if (m < 60 * 48) return `${(Math.round(m / 6) / 10).toLocaleString('es-PE')} h`;
  return `${(Math.round(m / 144) / 10).toLocaleString('es-PE')} d`;
};
