-- El cliente final lee sólo los closers de SUS clientes; la empresa, con o sin foco, los lee todos.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (el nivel 3, C6, 2026-10-20)
--
-- La `093` sumó a `negocio.closer_asignado` una política de lectura sin condición de cuenta: toda fila de la
-- organización se lee desde cualquier ámbito de ella. Hacía falta para la EMPRESA enfocada en un cliente —la designación
-- es de la empresa, y con el foco en otro cliente que el principal su Sales salía «no hay closers configurados»—, pero
-- alcanzaba también al CLIENTE FINAL (`app.toda_la_organizacion = 'no'`): desde el ámbito de su cliente leía las filas
-- de todos los demás, con el usuario del CRM de cada closer en la subcuenta de cada uno. La aplicación publica sólo los
-- vínculos a la vista (`vinculosALaVista`), pero la base no lo cerraba, y la doctrina es fallar cerrado.
--
-- Desde la `096` una persona tiene una fila por cliente en el que está vinculada (o designada), así que el cliente final
-- ya tiene en la política de la tabla (`aislamiento`, la de una cuenta) las filas que le tocan: las de SUS clientes. Esta
-- migración deja la política de la `093` sólo para quien ve la organización entera (`'si'`): la empresa, con todos sus
-- clientes o enfocada en uno, sigue leyendo todas las filas, como hasta acá; el cliente final, sólo las de su lista.
--
-- Lo que cambia para el cliente final: un closer designado en otro cliente y no en el suyo deja de aparecer en su Sales,
-- y con él, lo que haya registrado sobre sus contactos (el eje propio cuenta lo de los closers de la lista). Quien
-- trabaja un cliente se vincula en él, y su fila es de ese cliente.
--
-- Sólo de lectura, como la de la `093`: escribir sigue siendo de quien ve la organización entera. Reaplicable.
-- ═════════════════════════════════════════════════════════════════════════════

drop policy if exists closers_de_la_organizacion on negocio.closer_asignado;
create policy closers_de_la_organizacion on negocio.closer_asignado for select to app_inquilino
  using (org_id = (select nullif(btrim(current_setting('app.org_id', true)), '')::uuid)
         and (select current_setting('app.toda_la_organizacion', true)) = 'si');

comment on policy closers_de_la_organizacion on negocio.closer_asignado is
  'Los closers son de la empresa: quien ve la organización entera los lee todos, también enfocado en un cliente. El cliente final lee sólo los de sus clientes, por la política de la tabla (el nivel 3, 100).';
