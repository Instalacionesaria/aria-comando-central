-- Los closers son de la empresa: cualquier ámbito de la organización los lee, también el de un cliente.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (el nivel 3, la revisión del Bloque C, 2026-10-18)
--
-- `negocio.closer_asignado` dice qué personas de la empresa son closers y con qué usuario del CRM. Es configuración
-- de la EMPRESA, pero la `083` la hizo de un cliente: el puente le pone la cuenta por omisión al designar, y la
-- política por cuenta la esconde de cualquier ámbito de otro cliente. Sales y Leads son pantallas de un cliente
-- (`paraLaCuenta`): con el foco en un cliente que no es el principal, o con su cliente final, la lista de closers
-- salía vacía, el dinero «—» y «no hay closers configurados», aunque el cliente tuviera ventas.
--
-- Una política aparte, SÓLO DE LECTURA, que se suma a la de la tabla —como `sellos_de_la_organizacion` de la `086`—:
-- toda fila de la organización se lee desde cualquier ámbito de ella. Escribir sigue siendo de quien ve la
-- organización entera. Lo que expone son ids de personas de la empresa, su usuario del CRM y la fecha: el cliente
-- final no ve a las personas (`usuarios_del_inquilino` exige la organización entera), así que para él cada closer
-- sigue siendo un rótulo (`closersDeLaEmpresa`).
-- ═════════════════════════════════════════════════════════════════════════════

drop policy if exists closers_de_la_organizacion on negocio.closer_asignado;
create policy closers_de_la_organizacion on negocio.closer_asignado for select to app_inquilino
  using (org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid));

comment on policy closers_de_la_organizacion on negocio.closer_asignado is
  'Los closers son de la empresa: cualquier ámbito de la organización los lee, también el de un cliente (el nivel 3).';
