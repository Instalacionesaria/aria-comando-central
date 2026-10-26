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
  // Las que nacen con el modelo (`084`), ya con su cuenta: no necesitan relleno.
  'eventos', 'mapeos_de_cuenta', 'valores_sin_mapear',
  // Las de Meta directo (`102`): los conjuntos, el gasto de cada cuenta publicitaria y los desgloses. De un cliente.
  'conjuntos_de_anuncios', 'gasto_por_cuenta_publicitaria', 'metricas_por_desglose',
] as const;

/**
 * Las de una cuenta que NACIERON con cuenta_id (`084` en adelante). No están en las listas de la `082` ni de la fase
 * `cuenta-en-negocio`, que son las de las 39 tablas que existían antes del modelo y hubo que rellenar.
 */
export const NACIERON_CON_CUENTA = [
  'eventos',
  'mapeos_de_cuenta',
  'valores_sin_mapear',
  'conjuntos_de_anuncios',
  'gasto_por_cuenta_publicitaria',
  'metricas_por_desglose',
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
  // La foto de los negocios (089): de la principal. El cliente medido va en `cuenta_ref`, no en `cuenta_id`.
  'foto_de_las_empresas', 'foto_de_las_cuentas',
] as const;

/** Las de la organización que nacieron DESPUÉS de la `086`, que rehízo la política de las que existían. */
export const NACIERON_DESPUES_DE_LA_086 = ['foto_de_las_empresas', 'foto_de_las_cuentas'] as const;

/** Las de una cuenta que nacieron DESPUÉS de la `086` (Meta directo, `102`): nacen con su política de cuenta. */
export const DE_UNA_CUENTA_DESPUES_DE_LA_086 = ['conjuntos_de_anuncios', 'gasto_por_cuenta_publicitaria', 'metricas_por_desglose'] as const;
