-- Quién es el AGENTE DE IA en el CRM de esta empresa. El cimiento de la auditoría.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- SIN ESTA COLUMNA, LA REGLA DE ATRIBUCIÓN DEL AUDITOR ES UNA MENTIRA
--
-- El auditor de agentes tiene una regla que su propia documentación llama innegociable: **solo se le
-- puede imputar al agente lo que dice una línea del agente**. Si el problema lo causó una
-- automatización del CRM o un asesor humano, no es una falla del agente y no se corrige su prompt por
-- eso.
--
-- Y sobre el dato que hay hoy, esa regla **no se puede escribir**. `negocio.mensajes.autor` tiene tres
-- valores —`contacto`, `agente`, `persona`— y `agente` es un cajón de sastre: lo pone
-- `lib/negocio/ingesta.ts` para **todo** saliente cuya fuente no sea `app`, así que ahí adentro caben
-- el agente de IA, cualquier flujo automático del CRM y cualquier envío por un canal que no informe
-- su origen.
--
-- Auditar sobre eso no da un resultado peor: da uno **convincente y falso**. Le imputa al agente el
-- enojo que provocó una plantilla automática, y propone corregir un prompt que no escribió esa línea.
--
-- ── LO QUE SÍ HAY, Y ALCANZA ────────────────────────────────────────────────
--
-- `negocio.mensajes.autor_ghl_usuario_id` guarda el identificador del usuario del CRM que mandó el
-- mensaje. Medido en producción el 2026-08-31, sobre 2.737 salientes:
--
--     0peGoq7VvFqnDGA7gxtX   1.756 mensajes   closer + setter + congelado   18/03 → 31/08
--     BXLdWecnxd2ztBcNmXRL      37 mensajes   closer                        12/03 → 25/07
--     JJxGem987J7MRKced71Z      16 mensajes   closer + setter               15/08 → 31/08
--     (cinco ids más)          1-4 mensajes cada uno
--     (sin identificador)      919 mensajes
--
-- El primero es el agente: dos órdenes de magnitud por encima del resto, activo hasta hoy, y en los
-- dos territorios. Los que le siguen son personas. Los 919 sin identificador son los flujos
-- automáticos, que es exactamente lo que el auditor **no** debe imputarle a nadie.
--
-- ── UN SOLO IDENTIFICADOR PARA LOS DOS AGENTES, Y ESTÁ MEDIDO ──────────────
--
-- Tienta poner dos columnas, una por agente —el de pre-agenda y el de post-agenda—. **No hace falta,
-- y la medición lo dice:** ese identificador aparece en contactos de los dos territorios. Es una sola
-- integración del CRM mandando por los dos.
--
-- Y **cuál** de los dos agentes atendía no sale del mensaje: sale del **territorio del contacto**, que
-- es de donde el auditor ya elige su rúbrica. Un mensaje de hace tres semanas no sabe qué agente lo
-- escribió si las etiquetas cambiaron desde entonces, y pretender lo contrario sería inventar el dato.
--
-- ── POR QUÉ ACÁ, JUNTO A `crm_cuenta_id` Y `crm_calendario_id` ─────────────
--
-- Porque es **exactamente la misma clase de cosa**: el identificador de un objeto que vive en el CRM
-- de esa empresa, que no se puede deducir y que se administra en la misma pantalla. La 016 ya escribió
-- este argumento para el calendario: *«no es un secreto: es el identificador de un objeto ajeno, viaja
-- completo y se muestra entero»*.
--
-- **No es un secreto y no se cifra.** Un identificador de usuario del CRM no abre ninguna puerta: sin
-- el token no sirve para nada, y el token sí está cifrado.
--
-- ── Y LA AUSENCIA ES UN ESTADO NORMAL, CON UNA CONSECUENCIA QUE HAY QUE DECIR ──
--
-- Nulo = **nadie lo configuró**. El auditor no puede inventar quién es el agente, así que sin esta
-- columna **no audita** esa empresa, y lo dice con su nombre. Es la misma decisión que la llave de IA:
-- auditar con una atribución adivinada es peor que no auditar.
--
-- Lo que **no** se hace es elegir el identificador más frecuente por cuenta propia. Es una heurística
-- que cambia sola con el uso —hoy acierta, y el día que un asesor mande más mensajes que el bot,
-- falla— y el modo de fallar es el peor: le imputa al agente el trabajo de una persona.
-- ═════════════════════════════════════════════════════════════════════════════

alter table identidad.organizaciones_credenciales
  add column if not exists crm_agente_usuario_id text;

comment on column identidad.organizaciones_credenciales.crm_agente_usuario_id is
  'El identificador del usuario del CRM con el que manda mensajes el AGENTE DE IA. Es el cimiento de '
  'la regla de atribución del auditor: sin él, `mensajes.autor = ''agente''` mezcla al agente con las '
  'automatizaciones del CRM y el veredicto le imputa al agente lo que escribió un flujo. UNO alcanza '
  'para los dos agentes —medido: el mismo identificador aparece en los dos territorios— y cuál de los '
  'dos atendía sale del territorio del contacto. Nulo = nadie lo configuró, y entonces esa empresa no '
  'se audita: adivinar la atribución es peor que no auditar. NO es un secreto y no se cifra.';
