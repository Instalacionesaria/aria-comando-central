// Lo que el cliente contestó en el formulario de Walter, leído para «Tu ficha de negocio».
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DEFECTO QUE ESTE ARCHIVO CIERRA
//
// Walter guarda el onboarding completo —teléfono, sitio, el chat entero y una ficha en HTML con la
// síntesis por secciones— en `public.aria_cc_icp_oferta`, ya vinculada por `org_id`. Medido el
// 2026-09-10: de nueve capturas, ocho tienen su HTML, y el de «Innat8 Technologies» trae las cinco
// secciones del formulario completas y bien redactadas.
//
// Y **nada de Comando Central lo leía**. El alumno entraba a «Tu ficha», el agente lo saludaba con
// *«¿Cómo se llama tu negocio?»*, y su respuesta estaba en la base desde el minuto en que se
// registró. Kevin, con la captura de Walter: *«los datos que puso el cliente a través del formulario
// ya deberían estar en Tu ficha»*.
//
// ── DE DÓNDE LO LEE, Y POR QUÉ NO DE LA TABLA DE WALTER ─────────────────────
//
// De `aria_cc_foundations.intake`, la columna que la migración 004 creó para esto el 2026-08-26 y
// que nadie llenaba. La copia la hace un disparador en la base
// (`migraciones/014_onboarding_a_la_ficha.sql`), en el mismo commit del `insert` de Walter.
//
// La alternativa era que la aplicación consultara `aria_cc_icp_oferta` directamente, y cuesta más de
// lo que parece: esa tabla tiene RLS activada SIN políticas —la 001 lo decidió así, «solo el
// servidor con la service role key entra»— y su `org_id` admite nulos, así que no puede recibir
// `negocio.aplicar_aislamiento`. Habría que escribirle una política a mano y darle permisos nuevos
// al rol del inquilino. Con el disparador, la aplicación lee la fila que ya sabe leer y no estrena
// ni un permiso.
//
// ── POR QUÉ EL HTML Y NO EL `chat_history` ──────────────────────────────────
//
// El chat crudo son 9.300 caracteres con los botones del formulario incrustados (`[BOTONES:UNICA]`)
// y las respuestas sueltas. El HTML trae lo MISMO ya sintetizado en prosa por el pipeline, en cinco
// secciones de unos 400 caracteres. Es la misma información, redactada, y entra al prompt sin
// gastar una llamada al modelo para resumirla.
//
// ── Y POR QUÉ SE PUEDE PARSEAR SIN MIEDO ────────────────────────────────────
//
// Porque la estructura es la del propio pipeline y es estable: cada sección es
// `<div class="card"><h3><span class="ico">EMOJI</span> Título</h3><p>texto</p></div>`. Aun así este
// lector es TOLERANTE por principio: si el HTML cambia de forma, devuelve lo que reconoce, y si no
// reconoce nada devuelve `null` — que la pantalla trata como «este alumno no tiene onboarding», que
// es el caso normal de las cuentas creadas a mano. Nunca lanza: un cambio de plantilla del lado de
// Walter no puede dejar a nadie sin abrir su ficha.
// ═══════════════════════════════════════════════════════════════════════════════

/** Una sección de la síntesis: su título tal como lo escribió el pipeline, y su texto. */
export interface SeccionDeOnboarding {
  titulo: string;
  texto: string;
}

/** El onboarding de una organización, ya leído. */
export interface Onboarding {
  /** El nombre del negocio, del encabezado de la ficha. Es la respuesta a `t1-biz`. */
  nombreDelNegocio: string | null;
  /** Las secciones con contenido real. Las que dicen «sin dato» quedan afuera. */
  secciones: readonly SeccionDeOnboarding[];
  telefono: string | null;
  paisCiudad: string | null;
  website: string | null;
  /** Cuándo llenó el formulario, ISO. Es lo que la ficha muestra: «llenado el 10 de septiembre». */
  capturadoEl: string | null;
  /**
   * Las preguntas del formulario con lo que la persona contestó, textual y en orden. Salen del
   * `chat_history` de Walter, limpias de los botones del formulario. Kevin (2026-09-12): *«¿el
   * agente de Tu ficha toma conciencia de esas preguntas y respuestas?»*. La síntesis del HTML es
   * una interpretación del pipeline; esto es lo que la persona eligió, opción por opción.
   */
  respuestas: readonly ParDeOnboarding[];
}

/** Una pregunta del formulario de Walter y la respuesta que eligió la persona. */
export interface ParDeOnboarding {
  pregunta: string;
  respuesta: string;
}

/**
 * Cuánto texto del onboarding entra al prompt.
 *
 * Las cinco secciones del formulario suman unos 1.500 caracteres, así que el tope no recorta nada
 * hoy. Existe para el día que el pipeline agregue el análisis de la llamada: ahí el documento crece
 * y el contexto de UNA herramienta no puede comerse el presupuesto de la generación.
 */
export const CARACTERES_DE_ONBOARDING = 9_000;

/**
 * Los pares pregunta/respuesta del `chat_history` de Walter.
 *
 * El chat es `{messages: [{role: 'ARIA' | 'Cliente', content}]}`, y cada turno de ARIA trae la
 * pregunta MÁS los botones del formulario en marcas propias (`[BOTONES:UNICA] … [/BOTONES]`,
 * `[BLOQUE: 1]`, `[ONBOARDING_COMPLETO]`). Se quitan las marcas y se empareja cada pregunta con la
 * respuesta que la sigue. Medido sobre la captura de Innat8 (2026-09-12): 55 turnos → 27 pares,
 * 4.300 caracteres. Se aceptan también `assistant`/`user` por si el pipeline cambia de nombres.
 *
 * Los pares cuya respuesta es «listo» son los de transición («escribí listo y seguimos») y no dicen
 * nada del negocio: quedan afuera.
 */
export function paresDelChat(crudo: unknown): ParDeOnboarding[] {
  const o = crudo !== null && typeof crudo === 'object' && !Array.isArray(crudo) ? (crudo as Record<string, unknown>) : {};
  const lista: unknown[] = Array.isArray(crudo) ? crudo : Array.isArray(o['messages']) ? (o['messages'] as unknown[]) : [];
  const limpiar = (s: unknown): string =>
    String(s ?? '')
      .replace(/\[BOTONES[^\]]*\][\s\S]*?\[\/BOTONES\]/g, ' ')
      .replace(/\[[A-Z_]+(?::[^\]]*)?\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const esAgente = (r: unknown) => r === 'ARIA' || r === 'assistant';
  const esPersona = (r: unknown) => r === 'Cliente' || r === 'user';

  const pares: ParDeOnboarding[] = [];
  for (let i = 0; i < lista.length - 1; i += 1) {
    const m = lista[i] as Record<string, unknown> | null;
    const sig = lista[i + 1] as Record<string, unknown> | null;
    if (!m || !sig || !esAgente(m['role']) || !esPersona(sig['role'])) continue;
    const pregunta = limpiar(m['content']);
    const respuesta = limpiar(sig['content']);
    if (pregunta === '' || respuesta === '' || /^listo$/i.test(respuesta)) continue;
    pares.push({ pregunta, respuesta });
  }
  return pares;
}

/** Un valor de texto con contenido, o `null`. Trata «sin dato» como ausencia, igual que el pipeline. */
function texto(x: unknown): string | null {
  if (typeof x !== 'string') return null;
  const limpio = x.trim();
  if (limpio === '') return null;
  return /^sin dato\b/i.test(limpio) ? null : limpio;
}

/** Quita etiquetas y entidades, y colapsa los espacios. */
function sinEtiquetas(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * El título de una tarjeta, sin el emoji del icono.
 *
 * El emoji vive en su propio `<span class="ico">`, así que se va con las etiquetas. Lo que queda
 * puede empezar con un emoji suelto si la plantilla cambia, y ese `replace` lo cubre.
 */
function tituloDeTarjeta(crudo: string): string {
  return sinEtiquetas(crudo)
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .trim();
}

/** Las tarjetas de la ficha: título y texto, en el orden del documento. */
function seccionesDelHtml(html: string): SeccionDeOnboarding[] {
  const salida: SeccionDeOnboarding[] = [];
  const tarjetas = html.matchAll(
    /<div\s+class="card[^"]*">([\s\S]*?)<\/div>/g,
  );
  for (const tarjeta of tarjetas) {
    const cuerpo = tarjeta[1] ?? '';
    const titulo = tituloDeTarjeta(/<h3[^>]*>([\s\S]*?)<\/h3>/.exec(cuerpo)?.[1] ?? '');
    const parrafos = [...cuerpo.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
      .map((p) => sinEtiquetas(p[1] ?? ''))
      .filter(Boolean)
      .join(' ');
    const contenido = texto(parrafos);
    if (titulo === '' || contenido === null) continue;
    salida.push({ titulo, texto: contenido });
  }
  return salida;
}

/**
 * El onboarding guardado en la columna `intake`, o `null` si no hay nada aprovechable.
 *
 * `null` significa «esta organización no tiene onboarding», que es un dato y no un error: las
 * cuentas creadas a mano desde Ajustes nunca pasan por el formulario de Walter, y su ficha se
 * trabaja conversando, como hasta ahora.
 */
export function leerOnboarding(crudo: unknown): Onboarding | null {
  if (crudo === null || typeof crudo !== 'object' || Array.isArray(crudo)) return null;
  const o = crudo as Record<string, unknown>;

  const html = typeof o['html'] === 'string' ? o['html'] : '';
  const secciones = html === '' ? [] : seccionesDelHtml(html);
  const nombre =
    texto(sinEtiquetas(/<div\s+class="clientname"[^>]*>([\s\S]*?)<\/div>/.exec(html)?.[1] ?? '')) ??
    texto(o['nombre_del_negocio']);

  const onboarding: Onboarding = {
    nombreDelNegocio: nombre,
    secciones,
    telefono: texto(o['telefono']),
    paisCiudad: texto(o['pais_ciudad']),
    website: texto(o['website']),
    capturadoEl: typeof o['capturado_el'] === 'string' && o['capturado_el'] !== '' ? o['capturado_el'] : null,
    respuestas: paresDelChat(o['chat_history']),
  };

  /* Hace falta una sección, el nombre del negocio, o las respuestas del chat. El teléfono, el sitio y la ciudad NO alcanzan
     solos, y eso está medido: de las nueve capturas de producción al 2026-09-10, una tiene solo el
     teléfono —una conversación que se cortó antes de la síntesis—. Aceptarla haría que el agente
     abriera diciendo «esto es lo que tengo de tu onboarding: teléfono», que es peor que no decir
     nada: promete datos precargados y no hay ninguno de los siete campos. */
  const hayAlgo =
    onboarding.secciones.length > 0 || !!onboarding.nombreDelNegocio || onboarding.respuestas.length > 0;
  return hayAlgo ? onboarding : null;
}

/**
 * El onboarding como texto para el prompt y para el agente.
 *
 * Dice de dónde salió cada cosa —«su propio formulario»— porque el agente tiene que poder citarlo
 * cuando la persona le pregunte por sus datos, que es la mitad del pedido de Kevin: *«el usuario
 * podría consultar al chat sobre sus datos, que obviamente son los que él llenó en el formulario»*.
 */
export function contextoDeOnboarding(onboarding: Onboarding | null): string | null {
  if (!onboarding) return null;
  const partes: string[] = [];

  const datos: string[] = [];
  if (onboarding.nombreDelNegocio) datos.push(`Negocio: ${onboarding.nombreDelNegocio}`);
  if (onboarding.website) datos.push(`Sitio: ${onboarding.website}`);
  if (onboarding.paisCiudad) datos.push(`País o ciudad: ${onboarding.paisCiudad}`);
  if (onboarding.telefono) datos.push(`Teléfono: ${onboarding.telefono}`);
  if (datos.length > 0) partes.push(datos.join(' · '));

  for (const s of onboarding.secciones) partes.push(`${s.titulo}: ${s.texto}`);

  /* Las respuestas textuales van DESPUÉS de la síntesis: si el tope recorta, se pierde el final del
     cuestionario (las metas), no el resumen del negocio. Son lo que la persona eligió, opción por
     opción, y el agente puede citarlas cuando le pregunten «¿qué puse en el formulario?». */
  if (onboarding.respuestas.length > 0) {
    partes.push('PREGUNTAS DEL FORMULARIO Y LO QUE CONTESTÓ, TEXTUAL:');
    for (const p of onboarding.respuestas) partes.push(`- ${p.pregunta}\n  → ${p.respuesta}`);
  }

  return (
    'LO QUE ESTA PERSONA CONTESTÓ EN SU FORMULARIO DE ONBOARDING (lo escribió ella misma al ' +
    'inscribirse; es la base de esta ficha y podés citarlo si te pregunta por sus datos):\n' +
    partes.join('\n')
  ).slice(0, CARACTERES_DE_ONBOARDING);
}
