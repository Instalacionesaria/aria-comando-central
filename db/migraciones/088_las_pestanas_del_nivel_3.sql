-- Las dos pestañas del nivel 3, para que se puedan conceder: Ajustes › Clientes y el tablero de Negocios.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (el nivel 3, Paso 6, 2026-10-18)
--
-- `identidad.usuarios_secciones` sólo acepta las claves de pestaña que su `check` nombra. Una sección nueva que se
-- puede conceder y que el `check` no conoce no se puede guardar en el alcance de nadie (la prueba 31 lo cruza con el
-- catálogo de `lib/autorizacion/secciones.ts`). Las dos van juntas porque las dos nacen con el nivel 3:
--
--   · `clientes`: Ajustes › Clientes, donde una empresa da de alta y edita a sus clientes (capacidad `cuentas.ver`);
--   · `negocios`: el tablero del nivel 1, sólo desde la principal (capacidad `negocios.ver`).
--
-- Concederlas no da nada que el rol no dé: el alcance es una intersección con las capacidades.
-- ═════════════════════════════════════════════════════════════════════════════

alter table identidad.usuarios_secciones
  drop constraint if exists usuarios_secciones_seccion_check;

alter table identidad.usuarios_secciones
  add constraint usuarios_secciones_seccion_check check (seccion in (
    'usuarios', 'empresas', 'credenciales',
    'executive', 'contacts', 'icp',
    'acquisition', 'creative', 'conversion', 'conversation', 'sales',
    'setter', 'closer', 'analizadores', 'tools', 'monitoreo',
    'incidentes',
    'clientes', 'negocios'
  ));
