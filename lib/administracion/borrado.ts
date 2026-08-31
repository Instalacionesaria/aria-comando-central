// Traducir «la base no me deja borrar esto» a algo que se pueda leer.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL PROBLEMA, Y POR QUÉ NO ALCANZA CON DEJAR SUBIR EL ERROR
//
// Todas las claves foráneas del negocio hacia `identidad.usuarios` y hacia
// `identidad.organizaciones` son `no action`. Eso significa que la base **rechaza** el borrado en
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
  contactos_org_id_responsable_id_fkey: 'tiene contactos a su nombre',
  contactos_org_id_sello_setter_id_fkey: 'agendó contactos que siguen en el sistema',
  notas_org_id_autor_id_fkey: 'escribió notas en fichas de contactos',
  resultados_org_id_registrado_por_fkey: 'registró resultados de ventas',
  mensajes_org_id_autor_usuario_id_fkey: 'envió mensajes a contactos',
  tareas_org_id_creada_por_fkey: 'creó tareas',
  tareas_org_id_completada_por_fkey: 'completó tareas',
  hallazgos_org_id_resuelto_por_fkey: 'resolvió avisos del sistema',
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

  // ── Lo que puede referenciar a una EMPRESA ─────────────────────────────────
  usuarios_org_id_fkey: 'todavía tiene personas dadas de alta',
  contactos_org_id_fkey: 'tiene contactos cargados',
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
