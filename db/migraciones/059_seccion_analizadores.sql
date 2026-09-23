-- ═══════════════════════════════════════════════════════════════════════════════
-- 059 · LA SECCIÓN `analizadores` EN EL ALCANCE POR PERSONA
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- `identidad.usuarios_secciones` guarda qué pestañas se le concedieron a cada persona, y su columna
-- `seccion` tiene un CHECK con la lista cerrada de las que existen. Sin esta migración la casilla
-- «Analizadores» aparece en la pantalla de permisos —la deriva `alcanceOfrecible` de `SECCIONES`— y
-- al marcarla la base la rechaza: un control que se ve y no puede cumplir. Mismo patrón que la `041`.
--
-- Reaplicable: se suelta la restricción antes de reponerla (regla de la `024`).

alter table identidad.usuarios_secciones
  drop constraint if exists usuarios_secciones_seccion_check;
alter table identidad.usuarios_secciones
  add constraint usuarios_secciones_seccion_check check (seccion in (
    'usuarios', 'empresas', 'credenciales',
    'executive', 'contacts', 'icp',
    'acquisition', 'creative', 'conversion', 'conversation', 'sales',
    'setter', 'closer', 'analizadores', 'tools', 'monitoreo'
  ));
