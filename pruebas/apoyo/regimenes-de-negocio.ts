// De quién es cada tabla de `negocio`: de una cuenta, de una cuenta o de la organización, o sólo de la organización.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ UNA LISTA ESCRITA A MANO
//
// El modelo de datos multiempresa (Fase 0, 2026-10-16) suma una segunda llave de aislamiento, `cuenta_id`: la
// subcuenta de GoHighLevel dentro de su agencia. Cada tabla de `negocio` cae en uno de tres regímenes, y el régimen
// decide su columna y su política:
//
//   · DE UNA CUENTA: `cuenta_id not null`. El lead, su conversación, su agenda, sus ventas, la publicidad.
//   · DE UNA CUENTA O DE LA ORGANIZACIÓN: `cuenta_id` nulable. Una llamada de la propia agencia, o lo que producen los
//     agentes para la organización entera.
//   · DE LA ORGANIZACIÓN: sin `cuenta_id`, con la política de sólo organización. El chat del cerebro, sus topes, las
//     herramientas, los prompts, los umbrales, la sonda de aislamiento.
//
// La lista es a mano a propósito: el régimen es una DECISIÓN, y quien agrega una tabla tiene que tomarla. La prueba
// `pruebas/base/257-el-modelo-fase-0.test.ts` pone la suite en rojo si una tabla de la base no está en ninguna lista,
// o está en dos, o si una de la lista ya no existe. Es la que habría avisado que la `078` (`activos_de_anuncio`)
// nació después de diseñado el modelo.
// ═══════════════════════════════════════════════════════════════════════════════

/** Siempre de una subcuenta: `cuenta_id not null`. */
export const DE_UNA_CUENTA = [
  'contactos', 'citas', 'mensajes', 'notas', 'tareas', 'resultados', 'comisiones', 'closer_asignado',
  'briefs_del_closer', 'cambios_de_territorio', 'miniaturas_del_contacto', 'llamadas',
  'analisis_del_agente', 'hallazgos',
  'campos_del_crm', 'carpetas_del_crm', 'avisos_del_crm', 'ingesta_pulso',
  'campanas', 'anuncios', 'metricas_de_anuncio', 'gasto_de_la_cuenta', 'lecturas_de_gasto',
  'funnels_de_campana', 'enlaces_de_pieza', 'activos_de_anuncio',
] as const;

/** De una subcuenta o de la organización entera: `cuenta_id` nulable. */
export const DE_UNA_CUENTA_O_DE_LA_ORGANIZACION = [
  'analizador_llamadas', 'analizador_transcripciones', 'analizador_analisis', 'analizador_fichas',
  'analizador_prospectos', 'analizador_lapidas', 'objeciones_clasificadas',
  'senales', 'planes_de_accion', 'reuniones_del_dia', 'tareas_programadas', 'uso_de_ia', 'incidentes',
] as const;

/** Sólo de la organización: sin `cuenta_id`. */
export const DE_LA_ORGANIZACION = [
  'conversaciones_del_executive', 'mensajes_del_executive', 'preguntas_del_executive', 'topes_del_executive',
  'analisis_del_espia', 'enlaces_rapidos', 'prompts_del_agente', 'versiones_del_prompt', 'umbrales',
  'control_aislamiento',
] as const;
