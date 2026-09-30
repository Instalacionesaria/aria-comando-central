-- A qué funnel pertenece cada campaña: la decisión que alguien toma a mano en Acquisition.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- EL PROTOTIPO TIENE TRES FUNNELS, Y NINGÚN DATO DICE CUÁL ES CUÁL
--
-- El front que vuelve el 2026-09-30 (`docs/acquisition/14-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`,
-- A14-03) reparte las campañas en tres funnels —Lead form ads, Profile funnel y Booking directo—, cada
-- uno con su cadena de etapas. Ninguna fuente automática los separa, y está medido:
--
--   · el objetivo de Meta SÍ llega (`negocio.anuncios.objetivo`, desde la `050`), pero no alcanza:
--     medido en producción el 2026-09-30, de las 12 campañas 11 son `OUTCOME_LEADS` y 1 es
--     `OUTCOME_ENGAGEMENT`. Un formulario nativo y un agendamiento por landing son los dos
--     `OUTCOME_LEADS`, así que Lead form ads y Booking directo salen iguales;
--   · `mediumId` parte una misma campaña en dos (P-04 de `docs/acquisition/01-LOS-TRES-EMBUDOS.md`);
--   · el nombre de la campaña no sigue ninguna convención.
--
-- Así que lo decide una persona, y el usuario lo eligió así el 2026-09-30: quien lanza las campañas
-- sabe a qué funnel va cada una, y son pocas. Esta tabla guarda esa decisión, con quién la tomó.
--
-- ── UNA CAMPAÑA, UN FUNNEL ─────────────────────────────────────────────────
--
-- La clave es la campaña: asignar otra vez reemplaza, no suma. Que una campaña pueda estar en dos
-- funnels es una pregunta abierta (`A14-P01`); hasta que alguien la conteste, no puede, y la clave
-- primaria es lo que lo hace cumplir.
--
-- ── LA CAMPAÑA TIENE QUE EXISTIR, Y SI SE BORRA SE LLEVA SU FUNNEL ─────────
--
-- La clave foránea va a `negocio.campanas` (`065`), no a la atribución de los contactos: sólo se asigna
-- lo que GoHighLevel listó como campaña de la cuenta. `888888` y `{{campaign.id}}` —los dos
-- identificadores falsos de la atribución (cabecera de la `050`)— no tienen fila allá, así que acá
-- tampoco pueden tenerla. `on delete cascade` porque un funnel de una campaña que ya no existe no
-- describe nada.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists negocio.funnels_de_campana (
  -- Sin `on delete cascade` hacia la organización, como `negocio.campanas` (`065`) y
  -- `negocio.enlaces_de_pieza` (`063`): borrar una empresa se frena, con la frase de `QUE_LO_IMPIDE`.
  -- No es la regla de todo `negocio`: las tablas de contabilidad derivada, como la de la `013`, sí
  -- cascadean hacia la organización.
  org_id uuid not null references identidad.organizaciones(id),

  meta_campana_id text not null,

  -- `leadform` · `profile` · `booking`: las claves del prototipo (`aios-command-center_1.html`,
  -- `FUNNELS`). CON `check`, al revés que `campanas.estado`: este vocabulario es NUESTRO —lo escribe
  -- una ruta nuestra—, y una palabra fuera de la lista es un defecto nuestro que conviene frenar.
  funnel text not null,

  actualizado_el   timestamptz not null default now(),
  -- `null` cuando lo asignó un rol de plataforma mirando otra organización: la foránea compuesta exige
  -- un usuario de ESTA organización (`autorDelCambio`, `lib/autorizacion/sesion.ts`). Igual que en la
  -- `063`.
  actualizado_por  uuid,

  primary key (org_id, meta_campana_id),

  -- Las dos foráneas llevan `org_id` de los dos lados (ADR-0212): una fila propia no puede apuntar a
  -- la campaña ni al usuario de otra empresa.
  foreign key (org_id, meta_campana_id) references negocio.campanas (org_id, meta_campana_id) on delete cascade,
  foreign key (org_id, actualizado_por) references identidad.usuarios (org_id, id)
);

alter table negocio.funnels_de_campana drop constraint if exists funnels_de_campana_funnel_conocido;
alter table negocio.funnels_de_campana add constraint funnels_de_campana_funnel_conocido
  check (funnel in ('leadform', 'profile', 'booking'));

comment on table negocio.funnels_de_campana is
  'A que funnel del front de Acquisition pertenece cada campana: leadform, profile o booking. Lo asigna una persona con credenciales.editar; el unico escritor es lib/negocio/funnelDeLaCampana.ts.';

-- Reaplicable, como toda migración desde la `024`: `create policy` no tiene `if not exists`.
drop policy if exists aislamiento on negocio.funnels_de_campana;
select negocio.aplicar_aislamiento('negocio.funnels_de_campana');
