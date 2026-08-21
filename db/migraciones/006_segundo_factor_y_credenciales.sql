-- ADR-0106 — Las referencias dentro del inquilino no cruzan organizaciones.
--
-- Las dos últimas de las diez tablas de identidad.
--
-- `usuarios_segundo_factor`: 08-ENDURECIMIENTO § 10.
-- `organizaciones_credenciales`: 06-CREDENCIALES § 2, con las columnas de refresco
--   del 08 § 9 ya dentro del `create table`.
-- Permisos y políticas: 09-ESCOTILLA-Y-ESTADOS § 2, bloques 9 y 10.

-- ═════════════════════════════════════════════════════════════════════════════
-- 1 · La clave única sobre el PAR, prerrequisito de las foráneas compuestas
-- ═════════════════════════════════════════════════════════════════════════════

-- Hay un error sutil que esto cierra, y ya ocurrió en producción en el sistema del
-- que salen estas notas: si una referencia apunta a `usuarios(id)` A SECAS, NADA
-- IMPIDE que una fila de la organización A apunte a un usuario de la B. La base lo
-- acepta: el id existe.
--
-- Ahí, una función firmaba registros con el identificador de una persona de OTRA
-- organización, y nunca falló nada. Con la foránea compuesta, ese error no compila en
-- la base (01 § 8).
alter table identidad.usuarios add constraint usuarios_org_id_unico unique (org_id, id);

-- ═════════════════════════════════════════════════════════════════════════════
-- 2 · Segundo factor
--
-- Se consulta DURANTE el login, antes de haber probado nada. Solo identidad.
-- ═════════════════════════════════════════════════════════════════════════════

create table identidad.usuarios_segundo_factor (
  usuario_id      uuid primary key references identidad.usuarios(id) on delete cascade,
  -- Cifrado con la clave maestra, como cualquier otro secreto. No en claro.
  secreto_cifrado text not null,
  -- Nulo = alta empezada y no terminada. La distinción importa: el login pregunta si
  -- el segundo factor está CONFIRMADO, no si existe la fila.
  confirmado_el   timestamptz,
  -- Códigos de un solo uso, hasheados. Sin ellos, un teléfono perdido es una cuenta
  -- perdida.
  respaldos_hash  text[] not null default '{}',
  creado_el       timestamptz not null default now()
);

alter table identidad.usuarios_segundo_factor enable row level security;
alter table identidad.usuarios_segundo_factor force  row level security;
revoke all on identidad.usuarios_segundo_factor from public;

-- El permiso Y la política, o la tabla queda ilegible para todos y el login no puede
-- ni averiguar si esta persona tiene segundo factor. Con la seguridad activada y sin
-- política aplicable, la consulta devuelve CERO FILAS SIN ERROR: el login concluiría
-- que nadie tiene segundo factor configurado (08 § 10).
grant select, insert, update, delete on identidad.usuarios_segundo_factor to app_identidad;

create policy segundo_factor_identidad on identidad.usuarios_segundo_factor
  for all to app_identidad using (true) with check (true);

-- ═════════════════════════════════════════════════════════════════════════════
-- 3 · Credenciales por organización
--
-- POR QUÉ VAN EN `identidad` Y NO EN `negocio`, aunque tengan columna de
-- organización: así el dominio del inquilino NO PUEDE LEERLAS EN ABSOLUTO. Una
-- inyección en una consulta de negocio no alcanza los secretos de ningún cliente.
--
-- El precio es que la función única que resuelve credenciales corre en el dominio de
-- identidad, lo cual es una razón más para que sea UNA SOLA función y esté en la
-- lista de archivos autorizados.
--
-- Y el contrapeso honesto: el rol de identidad puede leer las credenciales cifradas
-- de todos los clientes. Cifradas — la clave maestra vive en el entorno de la
-- aplicación, no en la base, así que el acceso a la base por sí solo no da texto
-- claro. Pero es una razón más para que ese rol tenga la superficie más chica posible.
--
-- LOS NOMBRES DE LAS COLUMNAS DE INTEGRACIÓN SON LOS DEL DOCUMENTO (06 § 2), que los
-- da como conjunto ilustrativo. Todavía no está decidido qué integraciones conecta
-- cada organización en este producto; reconciliar en la Etapa 6, que es cuando la
-- función única y el enmascarado se escriben. Agregar o renombrar una columna
-- nullable después es una migración de una línea; inventar el conjunto ahora sería
-- inventar (EJECUCION § 6).
-- ═════════════════════════════════════════════════════════════════════════════

create table identidad.organizaciones_credenciales (
  org_id            uuid primary key references identidad.organizaciones(id) on delete cascade,

  -- Cifradas. EL SUFIJO `_cifrado` EN EL NOMBRE ES UNA DEFENSA REAL, no cosmética:
  -- hace que `select crm_token_cifrado` en un lugar equivocado se lea como lo que es,
  -- y que nadie lo pase a una llamada HTTP creyendo que es el token.
  crm_token_cifrado        text,
  pagos_clave_cifrada      text,
  ia_clave_cifrada         text,

  -- No secretos: identificadores públicos de la cuenta externa. Éstos sí se devuelven
  -- completos por la API.
  crm_cuenta_id            text,
  pagos_comercio_id        text,

  -- Vencimiento y refresco (08 § 9). Los tokens de la mayoría de las plataformas
  -- externas son OAuth: vencen, y se renuevan con un token de refresco. Y varias
  -- INVALIDAN el token de refresco al usarlo, así que dos peticiones simultáneas que
  -- detectan el token vencido y refrescan a la vez SE INVALIDAN ENTRE SÍ y la
  -- organización queda desconectada. Lo resuelve un candado de base en la Etapa 6.
  crm_refresh_cifrado      text,
  crm_expira_el            timestamptz,
  -- CUATRO estados, no dos. La distinción entre `ausente` ("nunca se cargó"),
  -- `vencida` ("se cargó y dejó de servir") y `revocada` ("el cliente cortó el acceso
  -- desde su panel") es exactamente la clase de distinción que este diseño exige en
  -- todas partes: UN VALOR SIGNIFICA UNA SOLA COSA. Y cada uno pide un texto distinto
  -- en la interfaz.
  crm_estado               text not null default 'ausente'
    check (crm_estado in ('ausente', 'activa', 'vencida', 'revocada')),

  actualizado_el    timestamptz not null default now(),
  -- Foránea COMPUESTA, no simple. Con `references usuarios(id)` a secas, nada impide
  -- que la fila de la organización A quede firmada por un usuario de la B: el
  -- identificador existe y la base lo acepta.
  actualizado_por   uuid,
  foreign key (org_id, actualizado_por) references identidad.usuarios (org_id, id)
);

alter table identidad.organizaciones_credenciales enable row level security;
alter table identidad.organizaciones_credenciales force  row level security;
revoke all on identidad.organizaciones_credenciales from public;

-- Con la seguridad activada y SIN política ni permisos, esta tabla queda ilegible
-- para todos y la aplicación falla al resolver credenciales. Hay que otorgarla
-- explícitamente, y solo al rol de identidad.
grant select, insert, update, delete on identidad.organizaciones_credenciales to app_identidad;

create policy credenciales_identidad on identidad.organizaciones_credenciales
  for all to app_identidad using (true) with check (true);
