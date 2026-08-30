-- La sección `monitoreo` entra al alcance por persona.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ UNA PESTAÑA NUEVA CUESTA UNA MIGRACIÓN
--
-- Está escrito en la 017, que creó `identidad.usuarios_secciones`, y se repite acá porque es
-- justo el momento en que el costo se paga: *"el costo de esta decisión es exactamente esto:
-- una pestaña nueva pide una migración. Es deliberado y conviene tenerlo escrito para cuando
-- moleste"*.
--
-- La alternativa —una tabla de catálogo— sale más cara en este proyecto: desde que una tabla de
-- identidad tiene `force row level security` sin política para `migrador`, **una migración no
-- puede insertarle una fila**. Agregar una pestaña exigiría tocar `db/arranque/`, un `grant`
-- nuevo y un paso más por la Management API. El DDL, en cambio, no está bloqueado.
--
-- Y lo que el `check` compra no es contención sino DIAGNÓSTICO: una clave que no está no
-- concede nada —falla cerrado— pero sin el `check` nadie se enteraría de que hay una pestaña
-- que no se puede conceder. La prueba *«toda clave de SECCIONES es aceptada por el check de la
-- base»* se pone roja hasta que este archivo corre.
--
-- ── LO QUE ESTA MIGRACIÓN NO HACE, Y HAY QUE CORRERLO APARTE ────────────────
--
-- No carga la capacidad `monitoreo.ver` en `identidad.permisos` ni la reparte a los roles: eso
-- vive en `db/arranque/001_catalogo.sql`, y **no se puede hacer desde una migración** por la
-- misma RLS forzada de arriba — el `insert` afectaría cero filas informando éxito. Se corre por
-- la Management API, como está documentado en `docs/DESPLIEGUE.md`:
--
--   node --env-file=.env.supabase scripts/supabase.mjs correr --archivo db/arranque/001_catalogo.sql
--
-- El orden entre los dos NO importa para la corrección, y conviene decir por qué: sin la
-- capacidad, la sección existe y nadie la ve (falla cerrado); sin el `check`, la capacidad
-- existe y la pestaña se ve pero no se puede conceder como alcance a una persona restringida.
-- Ninguno de los dos estados intermedios abre nada.
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
    -- La nueva. Conceder `monitoreo` como alcance a una persona **no le da el panel**: el
    -- alcance es una intersección, nunca una unión (ver el encabezado de la 017), y el rol
    -- `usuario` —el único restringido— no tiene `monitoreo.ver`. La clave está acá para que la
    -- sección sea expresable, no para que sea concedible por esta vía.
    'monitoreo'
  ));
