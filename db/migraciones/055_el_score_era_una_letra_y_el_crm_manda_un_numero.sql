-- El score era una letra y el CRM manda un número
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- DOS COSAS DISTINTAS CON EL MISMO NOMBRE, Y LA COLUMNA NO PODÍA GUARDAR NINGUNA
--
-- La `011` declaró `contactos.score char(1) check (score in ('A','B','C','D'))` y lo llamó *«la
-- letra de calificación»*, con el motivo escrito: *«nula porque nada la calcula todavía»*.
--
-- El 2026-09-21, al buscar de dónde sacarla, apareció que **el CRM sí calcula un score — y no es una
-- letra**. Es «Puntaje | ICP», un campo `NUMERICAL` de GoHighLevel:
--
--     471 de 590 contactos (80 %)   ·   enteros, 0 a 100   ·   mediana 54
--     ninguno con decimales · ninguno fuera de rango · largo máximo 3 caracteres
--
-- Así que había dos cosas con un nombre: una LETRA que nadie calcula y un PUNTAJE que llega desde
-- hace un año, guardado en `campos_del_crm` desde la `039` y sin nada que lo derivara a su columna.
--
-- ── EL DEFECTO QUE ESTO EVITÓ, Y ESTUVO A UN COMMIT ────────────────────────
--
-- La primera versión del arreglo derivaba el puntaje a la columna sin mirar su tipo. El compilador
-- no lo vio —`esquema.ts` declara `string | null`, que es cierto de `char(1)` también— y **lo
-- encontró una prueba nueva** con `value too long for type character(1)`.
--
-- Si eso hubiera llegado a producción, **la sincronización se rompía**: cualquier puntaje de dos
-- dígitos revienta el `insert`, la tarea de contactos corre cada diez minutos, y con ella caen los
-- mensajes y la auditoría del mismo horario. Es la clase de error que sólo se ve corriendo.
--
-- ── POR QUÉ LA COLUMNA PASA A SER EL NÚMERO, Y NO SE AGREGA OTRA ───────────
--
-- Porque de las dos, sólo una tiene fuente. Mantener la letra habría dejado una columna vacía al
-- lado de una llena, con el mismo nombre conceptual, y alguien habría intentado completarla — el
-- mismo argumento con el que la `054` borró `responsable_id`.
--
-- Y traducir 0–100 a A/B/C/D se descartó a propósito: **habría que inventar los cortes.** Nadie
-- decidió si un 87 es A o B, y el proyecto no inventa umbrales para que una columna vieja siga
-- teniendo razón.
--
-- Se comprobó que nadie espera la letra: **ningún archivo del repositorio compara `score` contra
-- `'A'`, `'B'`, `'C'` ni `'D'`.** `lib/negocio/ficha.ts:495` lo dibuja crudo bajo el rótulo
-- «Calificación», y un número se dibuja igual de bien.
--
-- ── `smallint` Y NO `numeric`, Y EL `check` SE QUEDA ───────────────────────
--
-- `smallint` porque los 471 son enteros y ninguno pasa de 100 — `numeric` sería precisión que nadie
-- necesita y abriría la puerta a un `54.5` que el CRM no manda.
--
-- Y el `check between 0 and 100` se queda porque el rango es parte del significado: un 140 no es un
-- puntaje alto, es un dato roto, y prefiero que el `insert` lo rechace a que una pantalla dibuje una
-- barra que se sale de la caja. **La aplicación lo valida antes**, en `sincronizar.ts`, y manda
-- `null` en vez del valor: sin eso, un valor raro del proveedor rompería la corrida entera del cron
-- en vez de perderse un contacto.
--
-- ── EL `using` ES UNA FORMALIDAD, Y ESO SE MIDIÓ ───────────────────────────
--
-- La columna está **vacía en las 590 filas**, así que no hay nada que convertir. El `using` va igual
-- porque PostgreSQL lo exige para pasar de `char` a `smallint`, y `nullif(btrim(...),'')` está
-- escrito para el caso que no ocurre: si alguna fila tuviera una letra guardada, el cast fallaría y
-- la migración se detendría — que es lo correcto. No se convierte una letra en un número a la
-- fuerza.
--
-- ── REAPLICABILIDAD ───────────────────────────────────────────────────────
--
-- `drop constraint if exists` para el `check` viejo; el `alter type` es idempotente en efecto —
-- reaplicado sobre una columna que ya es `smallint`, el `using` es un cast de `smallint` a
-- `smallint`—; y el `check` nuevo se borra antes de crearse. No se toca ninguna política.
-- ═══════════════════════════════════════════════════════════════════════════════

alter table negocio.contactos drop constraint if exists contactos_score_check;

alter table negocio.contactos
  alter column score type smallint
  using nullif(btrim(score::text), '')::smallint;

alter table negocio.contactos drop constraint if exists contactos_score_rango;
alter table negocio.contactos
  add constraint contactos_score_rango check (score between 0 and 100);

comment on column negocio.contactos.score is
  'El puntaje que el CRM calcula para el lead: «Puntaje | ICP», 0 a 100. Lo deriva '
  'lib/negocio/sincronizar.ts de campos_del_crm y se PISA en cada corrida. NULL = el CRM no lo '
  'trae para ese contacto (119 de 590, medido el 2026-09-21); 0 es un cero medido, no una ausencia.';
