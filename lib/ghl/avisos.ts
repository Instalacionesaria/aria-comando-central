// EL catálogo de los eventos del aviso del CRM. Una sola lista, y de ella sale todo lo demás.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ES UNA LISTA Y NO TRES
//
// El archivo equivalente de la plataforma anterior abre explicando el defecto que este archivo
// evita, y vale copiarlo entero porque ya se pagó allá:
//
//   *«Acá vivían DOS copias de los 8 strings —el tipo y el array— sin nada que las comparara, y el
//   panel de Ajustes › Webhooks necesitaba una tercera para mostrar las URLs completas.»*
//
// Tres listas del mismo hecho divergen en silencio: alguien agrega un evento al `switch` y no al
// panel, y la URL nunca se configura; o al panel y no al `switch`, y el panel ofrece una URL que
// responde 200 y no hace nada. Los dos síntomas son «el webhook no funciona» sin nada que mirar.
//
// Acá `EVENTOS_DEL_AVISO` es la única lista. El tipo, el guard y las URLs se DERIVAN de ella.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL EVENTO VIAJA EN LA URL, Y NO ES UNA PREFERENCIA
//
// La acción **Webhook estándar** de GoHighLevel —la gratuita, la que se usa— manda su payload nativo
// y **no permite editar el cuerpo JSON**. La URL sí se puede editar. Así que cada workflow se
// distingue por su parámetro:
//
//     https://<nuestro dominio>/api/avisos/crm?evento=mensaje.entrante
//
// Lo que SÍ se puede editar son las cabeceras, y de ahí sale la autenticación: `X-Webhook-Secret`.
// Está medido y fechado en la plataforma anterior (2026-08-07) y confirmado por la captura del
// workflow real que se usó para escribir esto.
//
// ── LA TRAMPA, y es el único error silencioso que la referencia documentó ────
//
// Si alguien pega la URL **sin** el `?evento=`, GoHighLevel entrega, nosotros guardamos el cuerpo,
// respondemos 200, y el aviso queda sin interpretar para siempre. No hay error, no hay reintento, y
// la pantalla no dibuja nada. Por eso el panel **nunca ofrece la URL base** y el monitor de frescura
// tiene un estado propio para «llega y no se procesa».
//
// ═══════════════════════════════════════════════════════════════════════════════
// NUEVE EVENTOS: LOS SIETE DE LA REFERENCIA MENOS DOS, MÁS LOS DOS DE LA OPORTUNIDAD
//
// Quedan afuera `serie.toque` y `serie.agotada`: piden el módulo de seguimientos automáticos, que acá
// está a medias —la etiqueta se escribe, la serie la corre el CRM y nosotros no la seguimos paso a
// paso—. Ofrecer sus URLs sería ofrecer dos puertas que guardan y no interpretan.
//
// Y entran `oportunidad.etapa` y `oportunidad.salida` (2026-10-27, el 8.º aviso del SOP): la etapa del
// Pipeline Maestro y su Salida las mueve GoHighLevel en la oportunidad del lead, y Comando Central las
// REGISTRA con su hora (`lib/negocio/etapaDelCrm.ts`). Es la única puerta por la que llegan: ni la
// búsqueda de contactos ni `GET /contacts/{id}` traen la oportunidad.
//
// Cuando el módulo de series exista, se agregan a esta lista y la prueba de paridad exige su `case`.
// ═══════════════════════════════════════════════════════════════════════════════

/** Una clave del idioma común con su nombre, para el panel. */
export interface ClaveConNombre {
  readonly clave: string;
  readonly nombre: string;
}

/**
 * Las 7 etapas del Pipeline Maestro, en orden. Son las de `catalogo.etapas` (la `079`): la prueba 332 las compara con
 * la semilla y la 330 con la base, así que no hay una segunda lista que pueda divergir en silencio. Viven acá, y no se leen de la base, porque el
 * panel de Ajustes las necesita en el navegador para armar una URL por etapa.
 */
export const ETAPAS_DEL_MAESTRO: readonly ClaveConNombre[] = [
  { clave: 'lead', nombre: 'Lead' },
  { clave: 'conversacion', nombre: 'Conversación' },
  { clave: 'calificado', nombre: 'Calificado' },
  { clave: 'agendado', nombre: 'Agendado' },
  { clave: 'asistio', nombre: 'Asistió' },
  { clave: 'venta', nombre: 'Venta' },
  { clave: 'onboarding', nombre: 'Onboarding' },
];

/** Las 8 Salidas de la oportunidad, en orden. Son las de `catalogo.salidas`; las pruebas 332 y 330 las comparan. */
export const SALIDAS_DE_LA_OPORTUNIDAD: readonly ClaveConNombre[] = [
  { clave: 'descarta', nombre: 'Descarta' },
  { clave: 'no_show', nombre: 'No-show' },
  { clave: 'seguimiento', nombre: 'Seguimiento' },
  { clave: 'adelanto', nombre: 'Adelanto' },
  { clave: 'nurture', nombre: 'Nurture' },
  { clave: 'descalificado', nombre: 'Descalificado' },
  { clave: 'nutricion', nombre: 'Nutrición' },
  { clave: 'no_rotundo', nombre: 'NO rotundo' },
];

/** El valor de `&salida=` que VACÍA la Salida (además de `&salida=` sin nada). */
export const SALIDA_VACIA = 'ninguna';

/** Un parámetro fijo que una rama de un workflow agrega a la URL: `&etapa=agendado`, `&salida=descarta`. */
export interface ParametroDelAviso {
  /** El nombre del parámetro en la URL. */
  readonly nombre: 'etapa' | 'salida';
  /** Las claves que acepta, con su nombre. */
  readonly valores: readonly ClaveConNombre[];
}

/** Un evento del aviso, con lo que el panel necesita para explicarlo. */
export interface EventoDelAviso {
  /** El valor del `?evento=`. Es NUESTRO vocabulario, no de GoHighLevel. */
  readonly evento: string;
  /** Cómo se llama para una persona que está configurando el workflow. */
  readonly titulo: string;
  /** Qué workflow de GoHighLevel le corresponde, y qué hace de nuestro lado. */
  readonly descripcion: string;
  /**
   * El parámetro fijo que cada rama puede agregar. Con él el panel ofrece, además de la URL del evento, una por clave:
   * la constante GANA sobre lo que diga el cuerpo, si es una clave válida.
   */
  readonly parametro?: ParametroDelAviso;
}

/**
 * LA lista. Todo lo demás de este archivo se deriva de acá.
 *
 * Los nombres son los de la plataforma anterior, a propósito: los workflows de la subcuenta real ya
 * apuntan a URLs con estos valores, así que cambiarlos obligaría a reconfigurar a mano cada workflow
 * de cada empresa — y el síntoma de olvidarse uno es un evento que se guarda y no se interpreta.
 */
export const EVENTOS_DEL_AVISO: readonly EventoDelAviso[] = [
  {
    evento: 'mensaje.entrante',
    titulo: 'El cliente escribió',
    descripcion:
      'Workflow con el disparador «El cliente ha respondido». Es el más importante: mueve el ' +
      'contacto al Buzón de Mi Día en segundos, en vez de esperar el próximo ciclo.',
  },
  {
    evento: 'mensaje.saliente',
    titulo: 'Se le escribió al cliente',
    descripcion:
      'Cuando el agente o alguien del equipo responde desde el CRM. Es lo que saca al contacto del ' +
      'Buzón sin esperar el ciclo: el Buzón es «el último mensaje es de ellos».',
  },
  {
    evento: 'contacto.zona_closer',
    titulo: 'Pasó a la zona del closer',
    descripcion:
      'Workflow que dispara al ponerle la etiqueta de zona del closer. Relee sus etiquetas y lo ' +
      'mueve de territorio.',
  },
  {
    evento: 'contacto.zona_setter',
    titulo: 'Pasó a la zona del setter',
    descripcion: 'Lo mismo, para la etiqueta de zona del setter.',
  },
  {
    evento: 'contacto.actualizado',
    titulo: 'Cambió algo del contacto',
    descripcion:
      'Cualquier cambio de etiquetas o de datos. Relee el contacto y recalcula su territorio, así ' +
      'que también cubre el caso de que PIERDA sus dos etiquetas de zona.',
  },
  {
    evento: 'cita.agendada',
    titulo: 'Agendó una cita',
    descripcion: 'Trae la cita a la Agenda y enciende el ícono de cita de la fila.',
  },
  {
    evento: 'cita.cancelada',
    titulo: 'Canceló la cita',
    descripcion:
      'Apaga el ícono de cita. Importa tanto como agendarla: el ícono es lo que alguien mira ' +
      'ANTES de llamar, y una cita cancelada que sigue encendida hace que no llame.',
  },
  {
    evento: 'oportunidad.etapa',
    titulo: 'Cambió la etapa del Pipeline Maestro',
    descripcion:
      'Workflow PM-04 · Aviso, con el disparador «Pipeline Stage Changed» filtrado al Pipeline Maestro; o cada rama ' +
      'de PM-02/PM-03 con la etapa fija en la URL. Registra el cambio con su hora: la etapa sólo avanza, y avanzar ' +
      'vacía la Salida.',
    parametro: { nombre: 'etapa', valores: ETAPAS_DEL_MAESTRO },
  },
  {
    evento: 'oportunidad.salida',
    titulo: 'Se marcó la Salida de la oportunidad',
    descripcion:
      'Cada rama que llena el campo Salida de la oportunidad, con la Salida fija en la URL (o «ninguna» para ' +
      'vaciarla). No cambia la etapa.',
    parametro: { nombre: 'salida', valores: SALIDAS_DE_LA_OPORTUNIDAD },
  },
] as const;

/** Los valores válidos del `?evento=`, derivados de la lista. */
export const EVENTOS_CONOCIDOS: readonly string[] = EVENTOS_DEL_AVISO.map((e) => e.evento);

/** El tipo, derivado también: no hay una segunda lista literal que pueda divergir. */
export type EventoDelCrm = (typeof EVENTOS_DEL_AVISO)[number]['evento'];

/**
 * ¿Este `?evento=` es uno de los nuestros?
 *
 * Es un PREDICADO DE TIPO (`valor is string`) y no un `boolean`, y no es cosmética: sin eso, quien lo
 * use sigue viendo `string | null` después del guard y termina poniendo un `as string` o un `?? ''`
 * para callar al compilador — que es exactamente el lugar donde un nulo se cuela sin que nadie lo
 * note. Acá el compilador hace el trabajo.
 */
export function esEventoConocido(valor: string | null | undefined): valor is string {
  return typeof valor === 'string' && EVENTOS_CONOCIDOS.includes(valor);
}

/**
 * La URL completa que hay que pegar en el workflow de GoHighLevel.
 *
 * `encodeURIComponent` sobre el evento aunque los siete valores sean seguros: el día que alguien
 * agregue uno con un carácter raro, la URL sigue siendo válida en vez de romperse de una forma que
 * solo se ve del lado del proveedor.
 */
export function urlDelEvento(base: string, evento: string, fijo?: { nombre: string; clave: string }): string {
  const limpia = base.replace(/\/+$/, '');
  const url = `${limpia}/api/avisos/crm?evento=${encodeURIComponent(evento)}`;
  // La constante de la rama (`&etapa=agendado`) va DESPUÉS del evento: así el panel nunca arma una URL sin `?evento=`.
  return fijo ? `${url}&${encodeURIComponent(fijo.nombre)}=${encodeURIComponent(fijo.clave)}` : url;
}

/**
 * La clave del idioma común que corresponde a un texto del CRM: minúsculas, sin tildes, y espacios y guiones a `_`.
 * «Asistió» → `asistio`, «No-show» → `no_show`, «NO rotundo» → `no_rotundo`, « Conversación » → `conversacion`.
 * `null` si no hay texto. Es pura y no decide si la clave EXISTE: eso lo hace `lib/negocio/idiomaComun.ts` contra la
 * base.
 */
export function claveDelIdiomaComun(crudo: unknown): string | null {
  if (typeof crudo !== 'string') return null;
  const clave = crudo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return clave === '' ? null : clave;
}

/** El Pipeline Maestro, normalizado como `claveDelIdiomaComun`. Es el único pipeline cuya etapa se acepta tal cual. */
export const PIPELINE_MAESTRO = 'pipeline_maestro';

/**
 * ¿La oportunidad es del Pipeline Maestro? Sin nombre de pipeline en el cuerpo se ACEPTA: el workflow PM-04 ya filtra
 * por el Pipeline Maestro, y la constante de la URL sólo la ponen sus ramas. Con un nombre, tiene que ser ése: «No-show»,
 * «Nutrición», «Venta» o «Descalificado» también son etapas de OTROS pipelines (citas, seguimiento comercial), y
 * tomarlas por las del Maestro movería la etapa de un lead con una oportunidad que no es la suya.
 */
export function esDelPipelineMaestro(pipeline: string | null): boolean {
  if (pipeline === null) return true;
  const clave = claveDelIdiomaComun(pipeline);
  return clave === PIPELINE_MAESTRO || clave === 'maestro';
}

/** Un texto de un cuerpo: cadena o número, recortado; un objeto con `name` da su nombre. Vacío = `null`. */
function texto(valor: unknown, tope = 300): string | null {
  const v =
    valor !== null && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, unknown>).name : valor;
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const t = String(v).trim();
  return t === '' ? null : t.slice(0, tope);
}

/** El primero de los candidatos que es texto. */
function primero(candidatos: unknown[], tope?: number): string | null {
  for (const c of candidatos) {
    const t = texto(c, tope);
    if (t !== null) return t;
  }
  return null;
}

/** Lo que el cuerpo de un aviso de oportunidad PUEDE traer. Todo nulo es posible: el cuerpo nativo no está medido. */
export interface OportunidadDelCuerpo {
  /** El id de la oportunidad en GoHighLevel. */
  readonly oportunidadId: string | null;
  /** El NOMBRE de la etapa (nunca su id: el `pipelineStageId` cambia de subcuenta en subcuenta). */
  readonly etapa: string | null;
  /** El nombre del pipeline. */
  readonly pipeline: string | null;
  /** El id del pipeline. */
  readonly pipelineId: string | null;
  /** El valor del campo Salida, si el cuerpo lo trae. */
  readonly salida: string | null;
}

/**
 * La oportunidad en un cuerpo de GoHighLevel, en sus formas POSIBLES.
 *
 * ── NINGUNA DE ESTAS FORMAS ESTÁ MEDIDA, Y POR ESO SON VARIAS ────────────────
 *
 * Hoy sólo llega `mensaje.entrante` (346 de 346 avisos). Qué trae el Webhook estándar con el disparador «Pipeline
 * Stage Changed» no se capturó nunca (`historia-dia-1`, paso 0), así que se aceptan las formas de la documentación y
 * de la comunidad: plana con guion bajo (`pipeline_stage`, y `pipleline_stage`, con la errata que GoHighLevel publica),
 * en camello (`pipelineStage`, `stageName`), anidada en `opportunity`, y en `customData` (los pares clave-valor que el
 * workflow agrega). Por eso la constante de la URL (`&etapa=`) GANA cuando es una clave válida: es lo único que no
 * depende de una forma sin medir.
 *
 * No se lee `id` suelto: en los cuerpos de contacto es el id de la persona, y tomarlo por el de la oportunidad pegaría
 * la oportunidad de un lead a otro.
 */
export function oportunidadDelCuerpo(cuerpo: unknown): OportunidadDelCuerpo {
  if (cuerpo === null || typeof cuerpo !== 'object') {
    return { oportunidadId: null, etapa: null, pipeline: null, pipelineId: null, salida: null };
  }
  const o = cuerpo as Record<string, unknown>;
  const opp = (o.opportunity !== null && typeof o.opportunity === 'object' ? o.opportunity : {}) as Record<string, unknown>;
  const extra = (o.customData !== null && typeof o.customData === 'object' ? o.customData : {}) as Record<string, unknown>;
  const pipelineObjeto = (o.pipeline !== null && typeof o.pipeline === 'object' ? o.pipeline : {}) as Record<string, unknown>;
  return {
    oportunidadId: primero([o.opportunityId, o.opportunity_id, opp.id, extra.oportunidadId, extra.oportunidad_id]),
    etapa: primero(
      [
        extra.etapa,
        o.pipeline_stage,
        o.pipleline_stage,
        o.pipelineStage,
        o.pipelineStageName,
        o.stageName,
        o.stage_name,
        opp.pipelineStageName,
        opp.stageName,
        opp.pipeline_stage,
        opp.stage,
      ],
      100,
    ),
    pipeline: primero([extra.pipeline, o.pipeline_name, o.pipelineName, pipelineObjeto.name, opp.pipelineName, opp.pipeline_name], 200),
    pipelineId: primero([o.pipeline_id, o.pipelineId, pipelineObjeto.id, opp.pipelineId, opp.pipeline_id], 100),
    salida: primero([extra.salida, o.salida, o.Salida, opp.salida, opp.Salida], 100),
  };
}

/** Un valor que el aviso dice, y de dónde salió. */
export interface ValorDelAviso<T> {
  readonly valor: T;
  /** `true` = la constante de la URL; `false` = el cuerpo. */
  readonly deLaUrl: boolean;
}

/** Lo que dice un aviso de oportunidad, ya con la precedencia aplicada. */
export interface LoQueDiceLaOportunidad {
  /** La etapa, o `null` si no vino por ningún lado. */
  readonly etapa: ValorDelAviso<string> | null;
  /** La Salida (`valor: null` = vaciarla), o `null` si no vino por ningún lado. */
  readonly salida: ValorDelAviso<string | null> | null;
  readonly oportunidadId: string | null;
  readonly pipeline: string | null;
  readonly pipelineId: string | null;
}

/**
 * La etapa y la Salida de un aviso de oportunidad: la constante de la URL GANA si es una clave válida; si no, el cuerpo;
 * y si el cuerpo no dice nada, la constante inválida igual se devuelve, para que la traducción la anote en
 * `valores_sin_mapear` (un `&etapa=agendó` mal escrito tiene que verse, no perderse).
 *
 * `&salida=` vacío o `&salida=ninguna` VACÍA la Salida (`valor: null`).
 */
export function loQueDiceLaOportunidad(parametros: URLSearchParams, cuerpo: unknown): LoQueDiceLaOportunidad {
  const delCuerpo = oportunidadDelCuerpo(cuerpo);

  const etapaUrl = parametros.get('etapa');
  const etapaUrlValida = claveDelIdiomaComun(etapaUrl);
  const etapa: ValorDelAviso<string> | null =
    etapaUrlValida !== null && ETAPAS_DEL_MAESTRO.some((e) => e.clave === etapaUrlValida)
      ? { valor: etapaUrlValida, deLaUrl: true }
      : delCuerpo.etapa !== null
        ? { valor: delCuerpo.etapa, deLaUrl: false }
        : etapaUrl !== null && etapaUrl.trim() !== ''
          ? { valor: etapaUrl.trim().slice(0, 100), deLaUrl: true }
          : null;

  const salidaUrl = parametros.get('salida');
  const salidaUrlClave = claveDelIdiomaComun(salidaUrl);
  const salida: ValorDelAviso<string | null> | null =
    salidaUrl !== null && (salidaUrlClave === null || salidaUrlClave === SALIDA_VACIA)
      ? { valor: null, deLaUrl: true }
      : salidaUrlClave !== null && SALIDAS_DE_LA_OPORTUNIDAD.some((s) => s.clave === salidaUrlClave)
        ? { valor: salidaUrlClave, deLaUrl: true }
        : delCuerpo.salida !== null
          ? { valor: delCuerpo.salida, deLaUrl: false }
          : salidaUrl !== null
            ? { valor: salidaUrl.trim().slice(0, 100), deLaUrl: true }
            : null;

  return {
    etapa,
    salida,
    oportunidadId: delCuerpo.oportunidadId,
    pipeline: delCuerpo.pipeline,
    pipelineId: delCuerpo.pipelineId,
  };
}

/**
 * El identificador de la SUBCUENTA en un cuerpo de GoHighLevel, en sus tres formas.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * LAS TRES FORMAS ESTÁN MEDIDAS, NO ADIVINADAS
 *
 * Contadas sobre los cuerpos reales del buzón de la plataforma anterior (1.192 filas, muestra de
 * 1.000, el 2026-08-28):
 *
 *   · **`location.id` ANIDADO** en 720 de 720 eventos de contacto y 104 de 104 de cita. **Nunca
 *     plano.** Es la forma normal, y es la que uno NO escribiría por analogía con `contactId`.
 *   · **`location_id` plano, con guion bajo** en los eventos de la plataforma de voz.
 *   · `locationId` plano se acepta porque es la forma documentada, aunque en la muestra no apareció.
 *
 * **Un lector que busque solo `payload.locationId` no encuentra el identificador en NINGUNA de las
 * tres formas.** Ése es el error concreto que esta función evita.
 *
 * ── Y NO HAY RESPALDO A `contact.id` ────────────────────────────────────────
 *
 * La plataforma anterior lo tuvo en su primera versión y lo quitó con este motivo: *«ese es el id de
 * la persona, no el de la subcuenta. Buscar una empresa por él no encuentra nada hoy, pero es la
 * clase de coincidencia que un día encuentra la empresa equivocada»*.
 *
 * ── PARA QUÉ SE USA ACÁ, QUE ES DISTINTO DE ALLÁ ────────────────────────────
 *
 * Allá esto RUTEABA: decidía de qué empresa era el evento. Acá **solo se compara**. La empresa la
 * pone el secreto de la cabecera, así que el aislamiento no depende de que el cuerpo diga la verdad;
 * este valor sirve para darse cuenta de un workflow apuntando a la URL equivocada.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
export function locationIdDelCuerpo(cuerpo: unknown): string | null {
  if (cuerpo === null || typeof cuerpo !== 'object') return null;
  const o = cuerpo as Record<string, unknown>;
  const anidado = (o.location as Record<string, unknown> | undefined)?.id;
  const crudo = o.locationId ?? o.location_id ?? anidado;
  const valor = typeof crudo === 'string' || typeof crudo === 'number' ? String(crudo).trim() : '';
  return valor === '' ? null : valor;
}

/**
 * El identificador del CONTACTO, en sus formas.
 *
 * Tres, y las tres se vieron: `contactId`, `contact_id` y `contact.id`. La plataforma anterior las
 * acepta las tres con este motivo escrito: *«el día que GHL cambie de payload —ya pasó con
 * `contactId`— no quiero que se corte la ingesta entera»*.
 */
export function contactIdDelCuerpo(cuerpo: unknown): string | null {
  if (cuerpo === null || typeof cuerpo !== 'object') return null;
  const o = cuerpo as Record<string, unknown>;
  const anidado = (o.contact as Record<string, unknown> | undefined)?.id;
  const crudo = o.contactId ?? o.contact_id ?? anidado;
  const valor = typeof crudo === 'string' || typeof crudo === 'number' ? String(crudo).trim() : '';
  return valor === '' ? null : valor;
}

/**
 * El texto del mensaje, con los respaldos del payload NATIVO.
 *
 * `message` viene **objeto `{id, body}` o cadena suelta** — las dos formas se vieron, y está en el
 * manejador de la referencia con ese comentario exacto. Sin los dos respaldos, la mitad de los
 * mensajes entra con el cuerpo vacío y el chat muestra burbujas en blanco.
 *
 * El tope de 500 caracteres es el de la referencia. No es por espacio: un mensaje de WhatsApp más
 * largo que eso es una pegada de texto, y el chat lo dibuja completo desde la ingesta igual.
 */
export function textoDelMensaje(cuerpo: unknown): string {
  if (cuerpo === null || typeof cuerpo !== 'object') return '';
  const o = cuerpo as Record<string, unknown>;
  const nativo = o.message;
  const candidatos = [
    o.mensaje,
    o.body,
    typeof nativo === 'string' ? nativo : (nativo as Record<string, unknown> | undefined)?.body,
  ];
  const texto = candidatos.find((c) => typeof c === 'string' && c.trim() !== '');
  return typeof texto === 'string' ? texto.slice(0, 500) : '';
}
