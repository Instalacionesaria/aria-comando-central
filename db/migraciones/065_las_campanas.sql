-- Los nombres de las campañas de Meta: para que Acquisition dibuje sus tablas por campaña.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- EL PROTOTIPO AGRUPA POR CAMPAÑA, Y LA BASE SÓLO TENÍA SU IDENTIFICADOR
--
-- El front que vuelve el 2026-09-30 (`docs/acquisition/14-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`,
-- A14-13) lista campañas: una fila por campaña, con su nombre y su estado. Hasta acá la base tenía
-- `negocio.anuncios.meta_campana_id` —el identificador de dieciocho dígitos— y ningún lugar donde
-- ese número tuviera nombre. El único nombre de campaña del sistema era la UTM `campaign` que cada
-- contacto trae en `atribucion_primera`, y ése es el nombre que tenía la campaña EL DÍA QUE ESE
-- CONTACTO ENTRÓ: dos contactos de la misma campaña pueden traer dos nombres, y una campaña
-- renombrada no se corrige nunca.
--
-- ── DE DÓNDE SALE: `/entity?entityType=CAMPAIGN`, UNA LLAMADA ──────────────
--
-- `lib/ghl/anuncios.ts` ya tenía `estructuraDeAnuncios`, paginada y probada, y nadie la llamaba en
-- producción. En el nivel `CAMPAIGN` devuelve el `campaignId`, el `name` y el `status` de cada
-- campaña de la cuenta: 61 campañas el 2026-09-16, en una sola página de las de 100. La lee el
-- colector de anuncios al final de cada pasada que tiene alguna campaña que pedir
-- (`lib/negocio/recolectarAnuncios.ts`), después de las métricas. Una empresa sin ninguna campaña
-- en su atribución no llama al proveedor, tampoco por los nombres.
--
-- Se guardan TODAS las que la cuenta lista, no sólo las de nuestra atribución. La llamada las trae
-- todas igual, así que filtrar no ahorra nada; y un contacto que llegue mañana de una campaña que
-- hoy no tiene ninguno encuentra su nombre ya guardado, siempre que la empresa tuviera alguna otra
-- campaña con contactos (si no, la pasada no pidió nada: ver arriba).
--
-- ── EL IDENTIFICADOR ES EL MISMO DE LOS DOS LADOS ──────────────────────────
--
-- Medido el 2026-09-16 (cabecera de la `050`): el `campaignId` de `/entity` cruza con el de
-- `atribucion_primera` en 12 de 14, y los dos que no cruzan no son campañas —`{{campaign.id}}`, una
-- plantilla sin expandir, y `888888`, un valor de prueba—. Esas dos no van a tener fila acá, y eso
-- es lo correcto: no tienen nombre porque no existen.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists negocio.campanas (
  -- Sin `on delete cascade` hacia la organización, como `negocio.anuncios` (`050`): borrar una
  -- empresa se frena antes, con la frase de `QUE_LO_IMPIDE`.
  org_id uuid not null references identidad.organizaciones(id),

  -- `text` y no `bigint`, por lo mismo que `negocio.anuncios.meta_anuncio_id`: el identificador de
  -- Meta es opaco, y así es como ya está guardado del otro lado del cruce.
  meta_campana_id text not null,

  -- NULABLE, y a propósito. El proveedor puede omitir `name`; una campaña sin nombre se dibuja con
  -- su identificador. La alternativa —guardar «(sin nombre)», como hacía el cliente hasta hoy— es
  -- un nombre inventado que en la pantalla se lee como el nombre de verdad.
  nombre text,

  -- `ACTIVE`, `PAUSED`, … Sin `check` de vocabulario por el mismo motivo que `anuncios.objetivo`:
  -- el catálogo es de Meta, y el día que agreguen un estado un `check` abortaría la pasada del cron
  -- entera en vez de guardar una palabra nueva.
  --
  -- Es la foto de la última lectura: se reescribe plano, sin `coalesce`. El nombre describe QUÉ ES
  -- la campaña y acumula lo que se sabe; el estado describe CÓMO ESTÁ HOY, y un estado viejo junto
  -- a un sello nuevo diría que se confirmó algo que nadie confirmó.
  estado text,

  -- La última pasada que la vio. Una campaña que deja de aparecer NO se borra: sus anuncios y sus
  -- métricas históricas siguen necesitando el nombre, igual que en `negocio.anuncios`.
  sincronizado_el timestamptz not null default now(),

  -- Llave natural, sin uuid propio: ya es única y ya empieza por `org_id`, que es lo que la `008`
  -- exige. Es también la llave a la que va a apuntar el funnel asignado a mano (la `066`).
  primary key (org_id, meta_campana_id)
);

comment on table negocio.campanas is
  'Que campana de Meta es cada meta_campana_id: nombre y estado, para las tablas de Acquisition. Se llena desde /ad-publishing/facebook/entity?entityType=CAMPAIGN de GoHighLevel, al final de cada pasada del colector de anuncios que tiene campanas que pedir.';

comment on column negocio.campanas.nombre is
  'NULL cuando el proveedor no mando nombre. No se inventa uno: la pantalla dibuja el identificador.';

comment on column negocio.campanas.estado is
  'La foto de la ultima lectura (status de Meta). Se reescribe plano, sin conservar el anterior.';

-- Reaplicable, como toda migración desde la `024`: `create policy` no tiene `if not exists`.
drop policy if exists aislamiento on negocio.campanas;
select negocio.aplicar_aislamiento('negocio.campanas');
