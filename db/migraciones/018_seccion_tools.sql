-- La sección `tools` entra al alcance por persona.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- ESTA MIGRACIÓN EXISTE PORQUE EL `check` HIZO SU TRABAJO
--
-- `identidad.usuarios_secciones.seccion` lleva un `check` con las claves de sección, y la 017 explica
-- que **no está ahí para contener sino para diagnosticar**: una clave que no está no concede nada
-- —falla cerrado— pero sin el `check` nadie se enteraría de que hay una pestaña que no se puede
-- conceder.
--
-- El caso llegó a la hora de escribirlo: alguien agregó la pestaña `tools` en otra rama, y al
-- integrar, la prueba *«toda clave de SECCIONES es aceptada por el check de la base»* se puso roja.
-- Sin ella, `tools` habría aparecido como casilla en el formulario, se habría podido tildar, y el
-- alta habría fallado con un error de la base que nombra una restricción — o peor, se habría
-- guardado en un entorno sin el `check` y no habría concedido nada.
--
-- **El costo de esta decisión es exactamente esto: una pestaña nueva pide una migración.** Es
-- deliberado y conviene tenerlo escrito para cuando moleste: la alternativa —una tabla de catálogo—
-- costaría más, porque desde que una tabla de identidad tiene `force row level security` sin política
-- para `migrador`, **una migración no puede insertarle una fila**; agregar una pestaña exigiría tocar
-- `db/arranque/`, un `grant` nuevo y un paso más por la Management API.
-- ═════════════════════════════════════════════════════════════════════════════

alter table identidad.usuarios_secciones
  drop constraint usuarios_secciones_seccion_check;

alter table identidad.usuarios_secciones
  add constraint usuarios_secciones_seccion_check check (seccion in (
    'usuarios', 'empresas', 'credenciales',
    'executive', 'contacts', 'icp',
    'acquisition', 'creative', 'conversion', 'conversation', 'sales',
    'setter', 'closer',
    -- La nueva. Nació compartiendo `tablero.ver` con las siete del tablero, y **para cuando esta
    -- migración se aplicó en producción ya tenía `tools.ver` propia**: la primera herramienta le dio
    -- operaciones de servidor el mismo día. Se deja escrito porque el cambio refuerza el motivo por
    -- el que el alcance se lleva por SECCIÓN y no por capacidad — la capacidad de una pestaña puede
    -- cambiar debajo, y una fila de alcance que nombrara `tablero.ver` habría empezado a conceder
    -- otra cosa sin que nadie la tocara.
    'tools'
  ));
