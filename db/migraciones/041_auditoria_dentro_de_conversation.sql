-- La sección `auditoria` se retira: el supervisor pasó a ser dos pestañas de `conversation`.
-- ============================================================================
--
-- «Auditoría de agentes» era una pantalla del grupo «Operación». Audita `chat_pre_agenda` y
-- `chat_post_agenda` —que el CRM llama `bot_activado_leadflow` y `bot_activado_appflow`—, o sea
-- exactamente los dos módulos que la arquitectura funcional pone dentro de Conversation
-- Intelligence: Lead Flow y Appointment Flow. Estaba archivada en otro grupo por historia.
--
-- No se borra nada del auditor. `negocio.analisis_del_agente`, `negocio.hallazgos` y
-- `negocio.prompts_del_agente` quedan intactas, y sus dos rutas siguen exigiendo `auditor.ver` y
-- `auditor.editar`. Lo único que cambia es **qué sección hay que tener concedida para llegar**:
-- las rutas declaran `PANTALLA = 'conversation'`.
--
-- ── POR QUÉ ESTA MIGRACIÓN EXISTE, Y NO ES LIMPIEZA ─────────────────────────
--
-- La `017` explica por qué `usuarios_secciones.seccion` lleva un `check` en vez de una tabla de
-- catálogo, y su motivo es exactamente este momento:
--
--   «lo que el `check` da NO es contención —una clave inválida no concede nada, falla cerrado—
--    sino DIAGNÓSTICO: con él, renombrar una sección **obliga** a escribir la migración que mueve
--    las filas; sin él, el renombre deja filas huérfanas que nadie nota.»
--
-- Dejar `'auditoria'` en el `check` después de retirar la sección deja aceptable una clave que ya
-- no existe: el panel de Usuarios no la ofrecería, pero la base seguiría admitiéndola, y una fila
-- escrita por cualquier otro camino no concedería nada y no fallaría. Es el estado que ese
-- comentario existe para impedir.
--
-- ── LO QUE ESTA MIGRACIÓN **NO** PUEDE HACER ────────────────────────────────
--
-- Mover las filas. `identidad.usuarios_secciones` tiene `force row level security` sin política
-- para `migrador`, así que **desde acá se ven cero filas**: un `update … set seccion =
-- 'conversation'` correría, informaría éxito y no tocaría nada. Es la misma regla que la `040`
-- dejó escrita —una migración puede cambiar la FORMA, nunca el contenido— y por eso este archivo
-- solo cambia el `check`.
--
-- La consecuencia práctica: si alguna persona tuviera la sección concedida, **el `alter` de abajo
-- falla** al validar las filas existentes. Eso es lo correcto: falla ruidosamente en vez de dejar
-- a esa persona sin pestaña en silencio. El arreglo es concederle «Conversation» desde el panel de
-- Usuarios y volver a aplicar.

alter table identidad.usuarios_secciones
  drop constraint usuarios_secciones_seccion_check;

alter table identidad.usuarios_secciones
  add constraint usuarios_secciones_seccion_check check (seccion in (
    'usuarios', 'empresas', 'credenciales',
    'executive', 'contacts', 'icp',
    'acquisition', 'creative', 'conversion', 'conversation', 'sales',
    'setter', 'closer', 'tools', 'monitoreo'
  ));
