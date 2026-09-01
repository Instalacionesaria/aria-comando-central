-- La sección `auditoria` entra al alcance por persona.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- ES LA TERCERA VEZ QUE UNA PESTAÑA CUESTA UNA MIGRACIÓN, Y SIGUE SIENDO CORRECTO
--
-- La 017 creó `identidad.usuarios_secciones` y dejó el costo escrito: *«una pestaña nueva pide una
-- migración. Es deliberado y conviene tenerlo escrito para cuando moleste»*. La 023 lo pagó con
-- `monitoreo` y ésta lo paga con `auditoria`.
--
-- La alternativa —una tabla de catálogo— sale más cara en este proyecto: desde que una tabla de
-- identidad tiene `force row level security` sin política para `migrador`, **una migración no puede
-- insertarle una fila**. Agregar una pestaña exigiría tocar `db/arranque/`, un `grant` nuevo y un paso
-- más por la Management API. El DDL, en cambio, no está bloqueado.
--
-- Y lo que el `check` compra no es contención sino DIAGNÓSTICO: una clave que no está no concede nada
-- —falla cerrado— pero sin el `check` nadie se enteraría de que hay una pestaña que no se puede
-- conceder. La prueba *«toda clave de SECCIONES es aceptada por el check de la base»* se pone roja
-- hasta que este archivo corre.
--
-- ── QUIÉN ES «EL TÉCNICO», Y POR QUÉ NO ES UN ROL ──────────────────────────
--
-- Fue una decisión del producto: **es una persona más con esta pestaña concedida**. La maquinaria ya
-- existe —`identidad.usuarios_secciones` reparte secciones persona por persona— y por eso esta
-- migración es todo lo que hace falta del lado de la base.
--
-- Y como el reparto de capacidades por rol es **por exclusión de prefijos**, `auditor.%` cae sola en
-- `administrador` y en `usuario`: no hay que agregar ningún `not like`, que es lo que se pidió.
--
-- ── LO QUE ESTA MIGRACIÓN NO HACE, Y HAY QUE CORRERLO APARTE ────────────────
--
-- No carga `auditor.ver` ni `auditor.editar` en `identidad.permisos`: eso vive en
-- `db/arranque/001_catalogo.sql` y **no se puede hacer desde una migración**, por la misma RLS forzada
-- de arriba — el `insert` afectaría cero filas informando éxito. Se corre por la Management API:
--
--   node --env-file=.env.supabase scripts/supabase.mjs correr --archivo db/arranque/001_catalogo.sql
--
-- Esa corrida trae además `contactos.resolver`, de la etapa 5.
--
-- El orden entre los dos NO importa para la corrección, y conviene decir por qué: sin la capacidad, la
-- sección existe y nadie la ve (falla cerrado); sin el `check`, la capacidad existe y la pestaña se ve
-- pero no se puede conceder como alcance a una persona restringida. Ninguno de los dos estados
-- intermedios abre nada.
-- ═════════════════════════════════════════════════════════════════════════════

alter table identidad.usuarios_secciones
  drop constraint usuarios_secciones_seccion_check;

alter table identidad.usuarios_secciones
  add constraint usuarios_secciones_seccion_check check (seccion in (
    'usuarios', 'empresas', 'credenciales',
    'executive', 'contacts', 'icp',
    'acquisition', 'creative', 'conversion', 'conversation', 'sales',
    'setter', 'closer',
    'tools',
    'monitoreo',
    -- La nueva. A diferencia de `monitoreo`, ésta SÍ se concede por esta vía: el «técnico» es una
    -- persona con el rol `usuario` —el único restringido— y `auditor.ver` le llega por el reparto de
    -- prefijos. O sea que acá la clave no está solo para ser expresable: está para ser concedida.
    'auditoria'
  ));
