-- La foto de los negocios: cada día, una fila por empresa y una por cliente, con su configuración y sus cifras.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ (el nivel 3, Paso 8, 2026-10-18)
--
-- ARIA (el nivel 1) quiere ver, en un tablero simple, cómo van sus clientes (las empresas, el nivel 2) y los clientes
-- de sus clientes (las cuentas, el nivel 3): si están configurados, su nicho, cuántos clientes tiene cada uno, cuántos
-- contactos y ventas mueven. Y quiere que un agente lea lo mismo después, para sacar conclusiones. Medirlo en vivo
-- cada vez es recorrer todas las empresas; una foto por día lo hace una sola vez, deja historia para comparar, y le
-- da al agente una tabla con un contrato fijo.
--
-- Dónde vive, y por qué así:
--   · bajo la organización PRINCIPAL (`org_id` = ARIA), en el régimen «de la organización»: la escribe y la lee sólo
--     ARIA, y ninguna empresa cliente la ve (la política de `aplicar_aislamiento` filtra por organización, y un
--     disparador exige que la fila sea de la principal);
--   · sin nombres ni ningún dato de una persona: ids, nicho, configuración y conteos. Los nombres de las empresas y de
--     sus clientes se leen en vivo al dibujar (un consultorio se llama como su dueño);
--   · la empresa y el cliente medidos van en `organizacion_ref` y `cuenta_ref`: son el DATO de la fila, no su
--     aislamiento. Por eso `_ref` y no `_id`: una columna `cuenta_id` en negocio es la llave de aislamiento por cuenta
--     (la 257 lo exige), y `org_id` es la de la organización, que acá es la principal;
--   · nulo es «sin medir», nunca cero: una empresa que no se pudo medir queda con `medida = false` y su motivo.
--
-- Un solo escritor: `lib/cartera/foto.ts`, que corre en la tarea `foto` del cron (`lib/negocio/barrido.ts`).
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── Por empresa (el nivel 2) ───────────────────────────────────────────────────

create table if not exists negocio.foto_de_las_empresas (
  org_id                uuid not null references identidad.organizaciones (id),
  dia                   date not null,
  organizacion_ref      uuid not null references identidad.organizaciones (id) on delete cascade,
  contrato              smallint not null,
  tomada_el             timestamptz not null default now(),
  es_principal          boolean not null,
  activa                boolean not null,
  pais                  char(2),
  nicho                 text,
  nicho_origen          text check (nicho_origen in ('fijado', 'calculado')),
  precio_mensual        numeric(12, 2),
  zona_horaria          text not null,
  alta_el               timestamptz not null,
  usuarios              integer not null check (usuarios >= 0),
  usuarios_limitados    integer not null check (usuarios_limitados >= 0),
  cuentas_activas       integer not null check (cuentas_activas >= 0),
  cuentas_pausadas      integer not null check (cuentas_pausadas >= 0),
  cuentas_de_baja       integer not null check (cuentas_de_baja >= 0),
  cuentas_de_prueba     integer not null check (cuentas_de_prueba >= 0),
  cuentas_configuradas  integer not null check (cuentas_configuradas >= 0),
  llave_de_ia           boolean not null,
  configurada           boolean not null,
  faltan                text[] not null default '{}',
  medida                boolean not null,
  motivo_sin_medir      text,
  contactos             integer,
  contactos_nuevos_30d  integer,
  ventas_30d            integer,
  ia_llamadas_30d       integer,
  incidentes_30d        integer,
  senales_abiertas      integer,
  primary key (org_id, dia, organizacion_ref),
  check (medida or motivo_sin_medir is not null)
);

-- ─── Por cliente (el nivel 3) ───────────────────────────────────────────────────

create table if not exists negocio.foto_de_las_cuentas (
  org_id                       uuid not null references identidad.organizaciones (id),
  dia                          date not null,
  cuenta_ref                   uuid not null references identidad.cuentas (id) on delete cascade,
  organizacion_ref             uuid not null references identidad.organizaciones (id) on delete cascade,
  contrato                     smallint not null,
  tomada_el                    timestamptz not null default now(),
  estado                       text not null check (estado in ('activa', 'pausada', 'baja')),
  es_prueba                    boolean not null,
  es_por_omision               boolean not null,
  nicho                        text,
  nicho_confirmado             boolean not null,
  modelo_de_negocio            text,
  pais                         char(2),
  moneda                       char(3),
  zona_horaria                 text not null,
  alta_el                      timestamptz not null,
  crm_vinculado                boolean not null,
  crm_conectado                boolean not null,
  calendario                   boolean not null,
  meta                         boolean not null,
  aviso_del_crm                boolean not null,
  configurada                  boolean not null,
  faltan                       text[] not null default '{}',
  medida                       boolean not null,
  motivo_sin_medir             text,
  contactos                    integer,
  contactos_nuevos_30d         integer,
  contactos_nuevos_30d_previos integer,
  agendaron_30d                integer,
  calificados_30d              integer,
  ventas_30d                   integer,
  ventas_30d_previas           integer,
  monto_30d                    numeric(14, 2),
  compradores                  integer,
  gasto_30d                    numeric(14, 2),
  ultima_ingesta_el            timestamptz,
  ultima_alta_el               timestamptz,
  primary key (org_id, dia, cuenta_ref),
  check (medida or motivo_sin_medir is not null)
);

create index if not exists foto_de_las_empresas_por_empresa on negocio.foto_de_las_empresas (org_id, organizacion_ref, dia desc);
create index if not exists foto_de_las_cuentas_por_cuenta on negocio.foto_de_las_cuentas (org_id, cuenta_ref, dia desc);

-- ─── Sólo de la principal ───────────────────────────────────────────────────────

-- Corre como quien escribe (app_inquilino, con su organización puesta), que ve la fila de SU organización: si no es
-- la principal, rechaza. La política ya impide escribir en otra organización; esto impide que una empresa cliente
-- escriba una foto propia que el tablero leería como de ARIA.
create or replace function negocio.foto_solo_de_la_principal() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from identidad.organizaciones o where o.id = new.org_id and o.es_principal) then
    raise exception '%: la foto de los negocios es sólo de la organización principal.', tg_table_name;
  end if;
  return new;
end $$;

drop trigger if exists foto_de_las_empresas_principal on negocio.foto_de_las_empresas;
create trigger foto_de_las_empresas_principal before insert or update on negocio.foto_de_las_empresas
  for each row execute function negocio.foto_solo_de_la_principal();
drop trigger if exists foto_de_las_cuentas_principal on negocio.foto_de_las_cuentas;
create trigger foto_de_las_cuentas_principal before insert or update on negocio.foto_de_las_cuentas
  for each row execute function negocio.foto_solo_de_la_principal();

select negocio.aplicar_aislamiento('negocio.foto_de_las_empresas');
select negocio.aplicar_aislamiento('negocio.foto_de_las_cuentas');

-- ─── El diccionario: lo que el agente lee para entender cada columna ─────────────

comment on table negocio.foto_de_las_empresas is
  'Una fila por empresa (nivel 2) y por día, bajo la organización principal. Configuración y cifras, sin datos de personas. La escribe la tarea foto del cron. Nulo = sin medir, nunca cero.';
comment on column negocio.foto_de_las_empresas.organizacion_ref is 'La empresa medida (no es la llave de aislamiento: ésa es org_id, la principal).';
comment on column negocio.foto_de_las_empresas.contrato is 'La versión del contrato de esta foto (lib/cartera/contrato.ts). Sube cuando cambia el significado de una columna.';
comment on column negocio.foto_de_las_empresas.nicho is 'El nicho de la empresa (catalogo.nichos): el fijado a mano, o el más común entre sus clientes confirmados.';
comment on column negocio.foto_de_las_empresas.nicho_origen is 'fijado = organizaciones.nicho_principal; calculado = la moda de los nichos confirmados de sus clientes.';
comment on column negocio.foto_de_las_empresas.cuentas_configuradas is 'Clientes activos, no de prueba, con toda la lista de chequeo en verde (lib/cartera/pasos.ts).';
comment on column negocio.foto_de_las_empresas.configurada is 'La empresa tiene la llave de IA, una zona horaria que no es UTC y al menos un cliente configurado.';
comment on column negocio.foto_de_las_empresas.faltan is 'Los pasos de la lista de chequeo de la empresa que faltan, por clave.';
comment on column negocio.foto_de_las_empresas.medida is 'false = no se pudieron medir sus cifras hoy; motivo_sin_medir dice por qué y las cifras quedan nulas.';
comment on column negocio.foto_de_las_empresas.contactos is 'Contactos de la empresa, de todos sus clientes que no son de prueba.';
comment on column negocio.foto_de_las_empresas.contactos_nuevos_30d is 'Contactos con alta en el CRM en los últimos 30 días, de sus clientes que no son de prueba.';
comment on column negocio.foto_de_las_empresas.ventas_30d is 'Resultados de venta registrados en los últimos 30 días, de sus clientes que no son de prueba.';
comment on column negocio.foto_de_las_empresas.ia_llamadas_30d is 'Llamadas al modelo de IA en los últimos 30 días (negocio.uso_de_ia).';
comment on column negocio.foto_de_las_empresas.incidentes_30d is 'Incidentes del modelo de IA en los últimos 30 días.';
comment on column negocio.foto_de_las_empresas.senales_abiertas is 'Señales de los detectores abiertas o vistas, sin cerrar.';
comment on column negocio.foto_de_las_empresas.org_id is 'La organización principal, dueña de la foto: la llave de aislamiento. No es la empresa medida (ésa es organizacion_ref).';
comment on column negocio.foto_de_las_empresas.dia is 'El día de la foto, en la zona horaria de la principal. Una fila por empresa y por día.';
comment on column negocio.foto_de_las_empresas.tomada_el is 'Cuándo se escribió esta fila. Dos corridas el mismo día dejan la última.';
comment on column negocio.foto_de_las_empresas.es_principal is 'La empresa es ARIA misma (el nivel 1). Las comparaciones entre clientes la dejan fuera.';
comment on column negocio.foto_de_las_empresas.activa is 'La empresa está activa. Una desactivada no se mide: medida = false.';
comment on column negocio.foto_de_las_empresas.pais is 'El país de la empresa (ISO 3166-1, dos letras), si se cargó.';
comment on column negocio.foto_de_las_empresas.precio_mensual is 'Lo que la empresa le paga a ARIA por mes, si se cargó.';
comment on column negocio.foto_de_las_empresas.zona_horaria is 'La zona horaria de la empresa. UTC quiere decir que nadie la eligió.';
comment on column negocio.foto_de_las_empresas.alta_el is 'Cuándo se dio de alta la empresa en ARIA.';
comment on column negocio.foto_de_las_empresas.usuarios is 'Personas activas de la empresa que entran a ARIA, incluidos sus clientes finales.';
comment on column negocio.foto_de_las_empresas.usuarios_limitados is 'De esas, cuántas son clientes finales: sólo ven las cuentas que tienen asignadas.';
comment on column negocio.foto_de_las_empresas.cuentas_activas is 'Clientes (nivel 3) activos, sin contar los de prueba.';
comment on column negocio.foto_de_las_empresas.cuentas_pausadas is 'Clientes pausados, sin contar los de prueba.';
comment on column negocio.foto_de_las_empresas.cuentas_de_baja is 'Clientes dados de baja, sin contar los de prueba.';
comment on column negocio.foto_de_las_empresas.cuentas_de_prueba is 'Clientes marcados de prueba, en cualquier estado. No entran en ninguna otra cifra.';
comment on column negocio.foto_de_las_empresas.llave_de_ia is 'La empresa tiene cargada su llave de IA (sólo la presencia, nunca el valor).';
comment on column negocio.foto_de_las_empresas.motivo_sin_medir is 'Por qué no se midió, cuando medida = false. Nulo cuando se midió.';

comment on table negocio.foto_de_las_cuentas is
  'Una fila por cliente (nivel 3, una cuenta) y por día, bajo la organización principal. Configuración y cifras, sin datos de personas. La escribe la tarea foto del cron. Nulo = sin medir, nunca cero.';
comment on column negocio.foto_de_las_cuentas.cuenta_ref is 'El cliente medido (identidad.cuentas). No es una llave de aislamiento: ésa es org_id, la principal.';
comment on column negocio.foto_de_las_cuentas.es_prueba is 'Cliente de prueba: no entra a ningún agregado ni comparación.';
comment on column negocio.foto_de_las_cuentas.nicho_confirmado is 'Una persona confirmó el nicho. Sin confirmar, no entra a las comparaciones por nicho.';
comment on column negocio.foto_de_las_cuentas.crm_conectado is 'Tiene token del CRM en estado activo.';
comment on column negocio.foto_de_las_cuentas.configurada is 'Toda la lista de chequeo requerida en verde: CRM conectado, calendario, zona no UTC, nicho confirmado y datos de las últimas 24 horas.';
comment on column negocio.foto_de_las_cuentas.faltan is 'Los pasos de la lista de chequeo que faltan, por clave (crm, calendario, zona, nicho, datos, meta, aviso).';
comment on column negocio.foto_de_las_cuentas.contactos_nuevos_30d is 'Contactos con alta en el CRM en los últimos 30 días.';
comment on column negocio.foto_de_las_cuentas.contactos_nuevos_30d_previos is 'Los mismos, en los 30 días anteriores: para comparar.';
comment on column negocio.foto_de_las_cuentas.agendaron_30d is 'De los contactos nuevos de 30 días, cuántos tienen una cita alcanzable (lib/negocio/citasAlcanzables.ts).';
comment on column negocio.foto_de_las_cuentas.calificados_30d is 'De los contactos nuevos de 30 días, cuántos agendaron y no están descartados.';
comment on column negocio.foto_de_las_cuentas.ventas_30d is 'Resultados de venta registrados en los últimos 30 días.';
comment on column negocio.foto_de_las_cuentas.ventas_30d_previas is 'Los mismos, en los 30 días anteriores.';
comment on column negocio.foto_de_las_cuentas.monto_30d is 'La suma de los montos de esas ventas, en la moneda del cliente. Nulo si ninguna trae monto.';
comment on column negocio.foto_de_las_cuentas.compradores is 'Contactos con al menos una venta, desde siempre: cuántos clientes tiene este negocio.';
comment on column negocio.foto_de_las_cuentas.gasto_30d is 'Gasto publicitario de los últimos 30 días. Nulo = no hay serie de gasto, no «gastó cero».';
comment on column negocio.foto_de_las_cuentas.ultima_ingesta_el is 'La marca de agua más reciente de la ingesta del CRM: qué tan frescos son sus datos.';
comment on column negocio.foto_de_las_cuentas.ultima_alta_el is 'El alta en el CRM del contacto más reciente.';
comment on column negocio.foto_de_las_cuentas.org_id is 'La organización principal, dueña de la foto: la llave de aislamiento. No es la empresa del cliente (ésa es organizacion_ref).';
comment on column negocio.foto_de_las_cuentas.dia is 'El día de la foto, en la zona horaria de la principal. Una fila por cliente y por día.';
comment on column negocio.foto_de_las_cuentas.organizacion_ref is 'La empresa (nivel 2) a la que pertenece el cliente.';
comment on column negocio.foto_de_las_cuentas.contrato is 'La versión del contrato de esta foto (lib/cartera/contrato.ts). Sube cuando cambia el significado de una columna.';
comment on column negocio.foto_de_las_cuentas.tomada_el is 'Cuándo se escribió esta fila. Dos corridas el mismo día dejan la última.';
comment on column negocio.foto_de_las_cuentas.estado is 'activa, pausada o baja: el estado del cliente en su empresa.';
comment on column negocio.foto_de_las_cuentas.es_por_omision is 'Es el cliente principal de su empresa: el que recibe lo que entra con las credenciales de la empresa.';
comment on column negocio.foto_de_las_cuentas.nicho is 'El nicho del cliente (catalogo.nichos). Sólo cuenta para comparar si nicho_confirmado.';
comment on column negocio.foto_de_las_cuentas.modelo_de_negocio is 'Cómo vende el cliente (catalogo.modelos_de_negocio), si se cargó.';
comment on column negocio.foto_de_las_cuentas.pais is 'El país del cliente (ISO 3166-1, dos letras), si se cargó.';
comment on column negocio.foto_de_las_cuentas.moneda is 'La moneda del cliente (ISO 4217). monto_30d y gasto_30d van en ella: no se suman entre monedas.';
comment on column negocio.foto_de_las_cuentas.zona_horaria is 'La zona horaria del cliente. UTC quiere decir que nadie la eligió.';
comment on column negocio.foto_de_las_cuentas.alta_el is 'Cuándo se dio de alta el cliente en ARIA.';
comment on column negocio.foto_de_las_cuentas.crm_vinculado is 'Tiene una subcuenta del CRM asociada.';
comment on column negocio.foto_de_las_cuentas.calendario is 'Tiene un calendario del CRM elegido para leer sus citas.';
comment on column negocio.foto_de_las_cuentas.meta is 'Tiene conectada su cuenta publicitaria de Meta (recomendado, no requerido).';
comment on column negocio.foto_de_las_cuentas.aviso_del_crm is 'Tiene configurado el aviso del CRM, que trae los mensajes al instante (recomendado, no requerido).';
comment on column negocio.foto_de_las_cuentas.medida is 'false = no se pudieron medir sus cifras hoy; motivo_sin_medir dice por qué y las cifras quedan nulas.';
comment on column negocio.foto_de_las_cuentas.motivo_sin_medir is 'Por qué no se midió, cuando medida = false. Nulo cuando se midió.';
comment on column negocio.foto_de_las_cuentas.contactos is 'Contactos del cliente, desde siempre.';

-- La tarea nueva del cron, en el `check` de los sellos (molde de la 078).
alter table negocio.tareas_programadas drop constraint if exists tareas_programadas_tarea_check;
alter table negocio.tareas_programadas add constraint tareas_programadas_tarea_check
  check (tarea in ('mensajes', 'citas', 'sonda', 'contactos', 'auditoria', 'mejora', 'anuncios', 'analizadores', 'reintentos', 'senales', 'anuncios_relleno', 'activos', 'foto'));
