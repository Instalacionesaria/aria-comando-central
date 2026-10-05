// Traducir «la base no me deja borrar esto» a algo que se pueda leer.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL PROBLEMA, Y POR QUÉ NO ALCANZA CON DEJAR SUBIR EL ERROR
//
// Las claves foráneas del negocio hacia `identidad.usuarios` y `identidad.organizaciones` que importan
// acá son las `no action` (otras cascadean o quedan en nulo). Con ellas la base **rechaza** el borrado en
// cuanto hay historial, que es exactamente lo que se quiere: borrar a quien registró una venta
// destruiría la trazabilidad de esa venta.
//
// Pero el rechazo llega como un `23503` cuyo mensaje dice, literalmente, algo del estilo *«update
// or delete on table "usuarios" violates foreign key constraint "notas_org_id_autor_id_fkey" on
// table "notas"»*. Devolverlo tiene dos problemas:
//
//   1 · `ADR-0704` lo prohíbe: nombra tablas y columnas, o sea la forma interna del sistema.
//   2 · No le sirve a nadie. Quien aprieta «Eliminar» necesita saber **qué** lo impide y **qué**
//       puede hacer en su lugar, no el nombre de una restricción.
//
// ── POR QUÉ SE MAPEA LA RESTRICCIÓN Y NO SE CUENTA ANTES ────────────────────
//
// La alternativa era contar, antes de intentar, en las ocho tablas que pueden referenciar a una
// persona. Son ocho consultas que casi siempre devuelven cero, para adornar un error que casi
// nunca ocurre — y dos de esas tablas ni siquiera son legibles desde el dominio del inquilino.
//
// El nombre de la restricción ya dice qué fila estorba, y llega gratis en el error. Así que se
// traduce: un diccionario de nombre de restricción a **palabras del negocio**. La consulta de más
// se paga solo cuando el borrado ya falló.
//
// Y si aparece una restricción que no está en el diccionario, se dice que hay historial sin
// inventar cuál. Un `?? 'algo'` que se hiciera pasar por preciso sería peor que la vaguedad.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * De nombre de restricción a lo que significa para quien mira la pantalla.
 *
 * Las claves son los nombres reales, medidos contra la base con `pg_constraint`, no supuestos. Hay
 * una prueba que los cruza contra el catálogo: si una migración renombra una restricción, esta
 * traducción dejaría de aplicar y el mensaje volvería a ser el genérico **sin que nada falle**.
 */
export const QUE_LO_IMPIDE: Readonly<Record<string, string>> = {
  // ── Lo que puede referenciar a una PERSONA ─────────────────────────────────
  /* Acá estaba `contactos_org_id_responsable_id_fkey: 'tiene contactos a su nombre'`, y **se fue con
     su columna** en la migración `054`. La encontró la comprobación de entradas muertas de la prueba
     de esta lista, que es para lo que existe.
     *
     ── LA CONSECUENCIA QUE NO ES OBVIA, Y NO ES UNA PÉRDIDA ─────────────────
     *
     Esa clave foránea era lo único que impedía borrar a una persona «porque tiene contactos». Al
     irse, esa protección desaparece — pero **nunca protegió nada**: `responsable_id` estuvo nula en
     las 590 filas desde que existe, así que la restricción no bloqueó un solo borrado.
     *
     Y lo que hoy dice de quién es un contacto es `crm_asignado_a`, que **no tiene clave foránea a
     propósito**: guarda el identificador del usuario del CRM crudo, no el nuestro (`034`). O sea que
     «tiene contactos asignados en el CRM» nunca fue un motivo para frenar un borrado acá, y seguir
     traduciendo una restricción inexistente habría hecho creer que sí. */
  contactos_org_id_sello_setter_id_fkey: 'agendó contactos que siguen en el sistema',
  notas_org_id_autor_id_fkey: 'escribió notas en fichas de contactos',
  resultados_org_id_registrado_por_fkey: 'registró resultados de ventas',
  mensajes_org_id_autor_usuario_id_fkey: 'envió mensajes a contactos',
  tareas_org_id_creada_por_fkey: 'creó tareas',
  tareas_org_id_completada_por_fkey: 'completó tareas',
  hallazgos_org_id_resuelto_por_fkey: 'resolvió avisos del sistema',
  analisis_resuelto_por_fk: 'resolvió intervenciones del auditor de IA',
  usuarios_creado_por_fkey: 'dio de alta a otras personas',
  // Ésta faltaba, y la encontró la comprobación de entradas muertas de la prueba: recorre las
  // claves foráneas `no action` que apuntan a usuarios y exige traducción para cada una. Sin ella,
  // borrar a quien alguna vez le asignó un rol a otro daba el mensaje genérico.
  usuarios_roles_asignado_por_fkey: 'asignó roles a otras personas',
  // La misma clase que la de arriba, y por eso la frase es simétrica: quien definió las pestañas de
  // otra persona deja de ser borrable, igual que quien le asignó un rol. La otra clave de esa tabla
  // —la de la persona dueña del alcance— cascadea, así que no llega acá: el alcance de alguien que ya
  // no está no significa nada.
  usuarios_secciones_concedida_por_fkey: 'definió las pestañas de otras personas',
  organizaciones_credenciales_org_id_actualizado_por_fkey: 'cargó credenciales de la empresa',
  prompts_del_agente_org_id_actualizado_por_fkey: 'editó el prompt de un agente de IA',
  enlaces_rapidos_org_id_actualizado_por_fkey: 'cargó links rápidos de la empresa',
  enlaces_de_pieza_org_id_actualizado_por_fkey: 'cargó links de piezas de Creative',
  funnels_de_campana_org_id_actualizado_por_fkey: 'asignó campañas a funnels en Acquisition',
  /* Los incidentes de la IA (`067`): quien lo dio por revisado frena el borrado. Quien tuvo el fallo ya
     no: desde la `070` esa clave es `on delete set null`, y el incidente queda sin quién lo vio. */
  incidentes_revisado_por_fkey: 'revisó incidentes en el Panel de Incidentes',

  // ── Lo que puede referenciar a una EMPRESA ─────────────────────────────────
  usuarios_org_id_fkey: 'todavía tiene personas dadas de alta',
  contactos_org_id_fkey: 'tiene contactos cargados',
  /* La historia de zona de los contactos. En la práctica NUNCA bloquea sola: su otra clave —la que
     apunta al contacto— cascadea, así que estas filas se van con el contacto, y `contactos` frena el
     borrado antes. Esta traducción es el tirante, y está porque la prueba de esta misma lista lo
     exige para TODA clave que pueda bloquear: sin ella el rechazo diría «tiene historial» sin decir
     cuál, que es justo el mensaje genérico que esta lista existe para evitar. */
  cambios_de_territorio_org_id_fkey: 'tiene historial de zonas de sus contactos',
  citas_org_id_fkey: 'tiene citas registradas',
  llamadas_org_id_fkey: 'tiene llamadas registradas',
  mensajes_org_id_fkey: 'tiene conversaciones registradas',
  notas_org_id_fkey: 'tiene notas escritas',
  resultados_org_id_fkey: 'tiene resultados de ventas registrados',
  tareas_org_id_fkey: 'tiene tareas pendientes o hechas',
  hallazgos_org_id_fkey: 'tiene avisos del sistema registrados',
  /* El veredicto del auditor. Dice «auditoría» y no «avisos» —como su tabla hija de arriba— porque
     son dos cosas distintas para quien lee el rechazo: un hallazgo es una falla del agente, y un
     análisis es el veredicto completo de una conversación, verde incluido. Y la frase tiene detrás
     una acción posible, que es lo que esta lista exige: se borran los análisis de esa empresa. */
  analisis_del_agente_org_id_fkey: 'tiene análisis de auditoría registrados',
  enlaces_rapidos_org_id_fkey: 'tiene links rápidos cargados',
  /* El catálogo de campos personalizados de su CRM, en dos tablas. Se nombran las dos por separado
     aunque la frase sea parecida: la que llega es la restricción que efectivamente bloqueó, y decir
     «campos» cuando lo que quedó fueron las carpetas mandaría a vaciar la tabla equivocada.

     Las dos las escribe la sincronización sola, así que la acción es la misma y es fácil: se borran
     y se vuelven a leer del CRM. Eso es lo que esta lista exige de cada frase — que detrás haya algo
     que alguien pueda hacer. */
  campos_del_crm_org_id_fkey: 'tiene el catálogo de campos de su CRM cargado',
  carpetas_del_crm_org_id_fkey: 'tiene las carpetas de campos de su CRM cargadas',
  /* El costo de los anuncios, en sus dos tablas. Se nombran las dos por separado por el mismo motivo
     que las dos de arriba: la que llega es la restricción que efectivamente bloqueó, y decir
     «métricas» cuando lo que quedó fue la dimensión mandaría a vaciar la tabla equivocada.

     En la práctica la que bloquea primero es la dimensión —`metricas_de_anuncio` cascadea hacia ella
     y por eso se va sola cuando el anuncio se borra—, pero la otra clave de cada tabla apunta a la
     ORGANIZACIÓN y ésa no cascadea. Así que las dos pueden llegar acá.

     Las dos las escribe el colector solo, una vez por día, así que la acción es la misma y es fácil:
     se borran y se vuelven a leer de GoHighLevel. Eso es lo que esta lista exige de cada frase — que
     detrás haya algo que alguien pueda hacer. */
  anuncios_org_id_fkey: 'tiene anuncios de Meta cargados',
  metricas_de_anuncio_org_id_fkey: 'tiene el costo diario de sus anuncios cargado',
  /* Y los nombres de sus campañas (`065`), que escribe el mismo colector en la misma pasada. Los
     nombres se vuelven a leer de GoHighLevel, pero **borrarlos no es gratis**: el funnel asignado a
     mano a cada campaña (`066`) cascadea desde acá, y ése no se vuelve a leer de ningún lado. */
  campanas_org_id_fkey: 'tiene las campañas de Meta cargadas',
  /* El funnel de cada campaña (`066`). A diferencia de las de arriba, esto lo decide una persona:
     borrarlo pierde una decisión, no un dato que se vuelve a leer.

     En la práctica esta frase casi no aparece sola: toda fila de funnel exige su campaña, así que al
     borrar una empresa suele frenar antes `campanas_org_id_fkey`. Está igual, porque la restricción
     existe y la lista tiene que traducirlas todas. */
  funnels_de_campana_org_id_fkey: 'tiene campañas asignadas a funnels en Acquisition',
  enlaces_de_pieza_org_id_fkey: 'tiene links cargados en las piezas de Creative',
  /* Los Analizadores, en sus seis tablas (`056`). Seis frases y no una por el mismo motivo que las de
     arriba: la que llega es la restricción que bloqueó, y cada una manda a vaciar una tabla distinta.

     En la práctica la que frena primero es `analizador_llamadas`: transcripciones, análisis y fichas
     cascadean desde la llamada, así que se van con ella. Pero las seis apuntan también a la
     ORGANIZACIÓN, y ésa no cascadea — así que las seis pueden llegar acá. A diferencia del CRM, esto
     NO se vuelve a leer solo: los análisis se pagaron, y borrarlos es perderlos. */
  analizador_llamadas_org_id_fkey: 'tiene llamadas en los Analizadores',
  analizador_transcripciones_org_id_fkey: 'tiene transcripciones de llamadas analizadas',
  analizador_analisis_org_id_fkey: 'tiene análisis de llamadas HT u OB',
  analizador_fichas_org_id_fkey: 'tiene fichas de prospectos de los Analizadores',
  analizador_prospectos_org_id_fkey: 'tiene prospectos de los Analizadores',
  analizador_lapidas_org_id_fkey: 'tiene el registro de las reuniones de tl;dv que se borraron',
  /* Los incidentes de la IA de la empresa (`067`). Lo que hay detrás es el registro de cada fallo, que
     no se vuelve a generar: borrarlo es perder la historia de lo que le falló a esa cuenta. */
  incidentes_org_id_fkey: 'tiene incidentes de la IA registrados',
  /* El análisis con IA de las búsquedas del Espía (`068`). Se pagó con la llave de la empresa y no se
     vuelve a generar sin volver a pagarlo. La de la persona no está: es `on delete set null`. */
  analisis_del_espia_org_id_fkey: 'tiene análisis del Espía a tus competidores guardados',
  /* El consumo de IA de la empresa (`069`): una fila por llamada al modelo, con sus tokens. Es lo que
     dice cuánto gastó esa cuenta con su llave, y no se vuelve a medir. La de la persona no está: es
     `on delete set null`. */
  uso_de_ia_org_id_fkey: 'tiene el consumo de la IA registrado',
  /* Lo del cerebro (`071`): los hilos de la empresa y sus mensajes, y sus topes. Los hilos caen con su
     autor, pero la empresa no se borra con hilos adentro: son lo que su gente le preguntó. */
  conversaciones_del_executive_org_id_fkey: 'tiene conversaciones con el cerebro',
  mensajes_del_executive_org_id_fkey: 'tiene mensajes del cerebro',
  topes_del_executive_org_id_fkey: 'tiene los topes del cerebro configurados',
  preguntas_del_executive_org_id_fkey: 'tiene preguntas al cerebro registradas',
  /* Lo de los detectores (`072`): las señales con su ciclo de vida —quién las vio, quién las resolvió y por
     qué—, los planes de cada día y los umbrales que firmó el Admin. Es historia de decisiones que no se
     vuelve a generar. */
  senales_org_id_fkey: 'tiene señales de los detectores',
  planes_de_accion_org_id_fkey: 'tiene planes de acción guardados',
  umbrales_org_id_fkey: 'tiene umbrales firmados',
  control_aislamiento_org_id_fkey: 'participa en la comprobación de aislamiento',
};

/** El `SQLSTATE` de una violación de clave foránea. */
const VIOLACION_DE_CLAVE_FORANEA = '23503';

/**
 * Qué impide borrar, en palabras, o `null` si el error no era de integridad referencial.
 *
 * Se discrimina por **SQLSTATE y no por el texto**, igual que `mensajeDeDisparador()`: el texto
 * cambia con la versión y con el idioma del servidor, y el código no.
 *
 * @returns La frase para la persona, o `null` si este error no es «hay algo que lo referencia».
 */
export function loQueImpideBorrar(e: unknown, queEs: 'persona' | 'empresa'): string | null {
  const error = e as { code?: unknown; constraint?: unknown };
  if (error?.code !== VIOLACION_DE_CLAVE_FORANEA) return null;

  const restriccion = typeof error.constraint === 'string' ? error.constraint : '';
  const porque = QUE_LO_IMPIDE[restriccion];
  const sujeto = queEs === 'persona' ? 'Esta persona' : 'Esta empresa';
  const enVezDe =
    queEs === 'persona'
      ? 'Se puede desactivar, que le quita el acceso y conserva lo que hizo.'
      : 'Se puede desactivar, que la deja sin operar y conserva sus datos.';

  return porque
    ? `${sujeto} no se puede eliminar porque ${porque}. ${enVezDe}`
    : // Sin traducción no se inventa una: se dice lo que sí se sabe.
      `${sujeto} no se puede eliminar porque tiene historial en el sistema. ${enVezDe}`;
}
