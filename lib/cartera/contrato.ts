// El contrato de la foto de los negocios: qué columnas tiene y qué significa cada una.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ UN CONTRATO, Y POR QUÉ CON NÚMERO
//
// La foto (`negocio.foto_de_las_empresas` y `negocio.foto_de_las_cuentas`, migración 089) la lee el tablero de
// Negocios hoy y un agente después, para sacar conclusiones sobre los clientes de ARIA y los clientes de sus clientes.
// Un agente que lee una columna cuyo significado cambió sin aviso saca una conclusión falsa con toda confianza. Por
// eso cada fila lleva `contrato`: si una columna cambia de significado, el número sube y quien lee lo sabe.
//
// Las listas de columnas son las de la base, exactas: la 271 las compara con la 089 y las que la amplían (la 099), y
// exige que ninguna nombre a una persona; la 270 las compara con la base.
//
// Las versiones, y lo que cambió en cada una (el comentario de `contrato` en la base las dice igual):
//   · 1 (2026-10-18, la 089): la foto tal como nació;
//   · 2 (2026-10-20, la 099, C6 · D5): `configurada` exige Meta vinculado en el GoHighLevel del cliente —de donde salen
//     sus costos—, medido en la columna nueva `meta_en_el_crm`, y `faltan` suma esa clave. `meta` sigue siendo la
//     conexión directa con Meta (las miniaturas), recomendada. Con eso cambian también `cuentas_configuradas` y
//     `configurada` de la empresa, que cuentan a los clientes configurados;
//   · 3 (2026-10-26, la 103, Meta directo): los costos salen de la conexión con Meta de cada cliente. `meta` pasa a ser
//     «Meta conectado», REQUERIDO; `meta_en_el_crm` se renombra `meta_leido` («Campañas leídas de Meta», recomendado y
//     medido). Cambian `configurada`, `faltan`, `cuentas_configuradas` y `configurada` de la empresa.
// ═══════════════════════════════════════════════════════════════════════════════

/** La versión del contrato. Sube cuando una columna cambia de significado, no cuando se agrega una. */
export const CONTRATO_DE_LA_FOTO = 3;

export const COLUMNAS_DE_LAS_EMPRESAS = [
  'org_id', 'dia', 'organizacion_ref', 'contrato', 'tomada_el', 'es_principal', 'activa', 'pais', 'nicho', 'nicho_origen',
  'precio_mensual', 'zona_horaria', 'alta_el', 'usuarios', 'usuarios_limitados', 'cuentas_activas',
  'cuentas_pausadas', 'cuentas_de_baja', 'cuentas_de_prueba', 'cuentas_configuradas', 'llave_de_ia', 'configurada',
  'faltan', 'medida', 'motivo_sin_medir', 'contactos', 'contactos_nuevos_30d', 'ventas_30d', 'ia_llamadas_30d',
  'incidentes_30d', 'senales_abiertas',
] as const;

export const COLUMNAS_DE_LAS_CUENTAS = [
  'org_id', 'dia', 'cuenta_ref', 'organizacion_ref', 'contrato', 'tomada_el', 'estado', 'es_prueba', 'es_por_omision',
  'nicho', 'nicho_confirmado', 'modelo_de_negocio', 'pais', 'moneda', 'zona_horaria', 'alta_el', 'crm_vinculado',
  'crm_conectado', 'calendario', 'meta', 'aviso_del_crm', 'configurada', 'faltan', 'medida', 'motivo_sin_medir',
  'contactos', 'contactos_nuevos_30d', 'contactos_nuevos_30d_previos', 'agendaron_30d', 'calificados_30d',
  'ventas_30d', 'ventas_30d_previas', 'monto_30d', 'compradores', 'gasto_30d', 'ultima_ingesta_el', 'ultima_alta_el',
  // La 099 (contrato 2), renombrada en la 103 (contrato 3).
  'meta_leido',
] as const;

/** Cuántos días mira la foto hacia atrás en cada cifra «de 30 días», y la ventana anterior para comparar. */
export const VENTANA_DIAS = 30;
