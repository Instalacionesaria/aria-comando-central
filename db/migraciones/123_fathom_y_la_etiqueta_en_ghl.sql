-- 123 · Fathom y GoHighLevel: qué pasó en GHL con cada grabación recibida (la etiqueta «asistio» y el lead traído).
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (decisiones del usuario del 2026-11-24)
--
-- Cuando el webhook de Fathom guarda la transcripción de una llamada de venta en el lead (la 116), ahora además:
--
--   · le pone al contacto, en GHL, la etiqueta «asistio»: así el equipo sabe, desde GHL, que ese lead tiene su
--     transcripción en Supabase. Es la etapa estándar «Asistió» de la 079, que ya decía «tag asistio, desde la
--     grabación». Sólo cuando la transcripción quedó guardada;
--   · si el correo del lead todavía no está en nuestra base, lo busca en GHL por correo (los externos primero) y, si
--     existe, lo trae a negocio.contactos antes de guardar la llamada. Si tampoco está en GHL, se descarta como antes.
--
-- Lo que pasó en GHL queda en la recepción, en una sola columna de texto, porque son pocos casos y sirven para mirar:
-- una falla de GHL nunca tumba el webhook (la transcripción ya está guardada), y sin esta columna no se vería.
--
-- Reaplicable.
-- ═════════════════════════════════════════════════════════════════════════════

alter table negocio.recepciones_de_fathom add column if not exists resultado_en_ghl text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recepciones_de_fathom_resultado_en_ghl_acotado') then
    alter table negocio.recepciones_de_fathom add constraint recepciones_de_fathom_resultado_en_ghl_acotado
      check (resultado_en_ghl is null or length(resultado_en_ghl) <= 1000);
  end if;
end $$;
comment on column negocio.recepciones_de_fathom.resultado_en_ghl is
  'Qué pasó en GoHighLevel con esta grabación (123): «traido_de_ghl: …» si el lead no estaba en la base y se trajo de GHL por su correo, «no_esta_en_ghl» si tampoco estaba allí, «etiqueta_puesta: asistio» o «etiqueta_fallo: …» al etiquetar el contacto, «sin_acceso: …» si no hay token de GHL. Nula = no hizo falta ir a GHL.';
