-- El aviso del CRM por cliente: el secreto de cada cliente es único, como el de cada empresa.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (el nivel 3, Bloque C, Paso C3, 2026-10-18)
--
-- El aviso del CRM (`app/api/avisos/crm`) sabe de quién es por el hash de su secreto. Hasta el nivel 3 el secreto era de
-- la empresa (`organizaciones_credenciales.aviso_secreto_hash`, único desde la 022). Ahora un cliente con su propia
-- subcuenta tiene su propio workflow en el CRM y su propio secreto, en `cuentas_credenciales.aviso_secreto_hash`: el
-- aviso busca primero en la empresa (que es el cliente por omisión) y, si no, en los demás clientes.
--
-- Sin un índice único, dos clientes con el mismo hash harían que el aviso de uno entrara en el otro sin ningún error.
-- La fila del cliente por omisión puede tener una copia vieja del secreto de la empresa (la fase `cuentas` la copió);
-- el aviso no la lee —busca el por omisión en la empresa—, pero cuenta para el único, que es lo que se quiere: un
-- secreto nunca se repite.
-- ═════════════════════════════════════════════════════════════════════════════

create unique index if not exists cuentas_credenciales_aviso_secreto_unico
  on identidad.cuentas_credenciales (aviso_secreto_hash) where aviso_secreto_hash is not null;
comment on index identidad.cuentas_credenciales_aviso_secreto_unico is
  'El secreto del aviso del CRM de un cliente no se repite: el aviso entra al cliente cuyo hash coincide.';
