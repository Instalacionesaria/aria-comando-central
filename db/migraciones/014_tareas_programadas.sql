-- El sello de las tareas programadas: qué hizo el cron, por empresa y por tarea.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ ESTA TABLA EXISTE, Y NO ALCANZA CON `negocio.ingesta_pulso`
--
-- Sin esto, el cron es **inauditable**: no hay ninguna forma de contestar «¿corrió?». Y no es una
-- suposición, está medido sobre el código que ya existe:
--
--   1 · **Nada mide el atraso.** Los dos únicos lectores de `ingesta_pulso` —`porQueNoHayMensajes`
--       (lib/negocio/ficha.ts) y `faltaDelBarrido` (lib/negocio/agenda.ts)— tienen tres ramas cada
--       uno y **ninguna** compara `ultima_corrida_el` contra `now()`. Un pulso de hace seis semanas
--       se lee igual que uno de hace un minuto.
--
--   2 · **`ingesta_pulso` no dice QUIÉN corrió**, y hoy quien más gana el candado es el reloj del
--       navegador cada 10 segundos (`CADENCIA.operacion`). O sea que «la última corrida es de hace
--       tres minutos» **no distingue** «el cron se disparó» de «alguien tenía la pestaña abierta».
--       Con el cron desplegado esa ambigüedad deja de ser teórica: es la pregunta principal.
--
--   3 · **`ingesta_pulso` solo se escribe cuando el trabajo CORRE.** La empresa sin token no deja
--       rastro, y por eso «esta empresa no tiene credencial» es indistinguible de «el cron nunca
--       pasó por acá». Son los dos ceros del `11` § 9 regla 1, otra vez.
--
-- ── LA REGLA QUE MANDA EN ESTA TABLA ────────────────────────────────────────
--
-- **Se escribe SIEMPRE, también cuando la tarea no corrió.** `saltada`, `frenada`, `sin_tiempo` y
-- `fallo` son filas igual de importantes que `corrio` — más, incluso: son las que explican un cero.
--
-- ── Y POR QUÉ NADA DE CONTADORES ────────────────────────────────────────────
--
-- Medido en la documentación de Vercel: el disparador de los cron **admite corridas perdidas y
-- corridas duplicadas**, y no reintenta nunca. Un `+1` acá contaría de más con una entrega doble y
-- de menos con una perdida, y nadie podría saber cuál de las dos pasó. Todo se escribe con
-- `on conflict do update set`, o sea que dos corridas idénticas dejan la fila idéntica. Es el mismo
-- razonamiento que ya está escrito en `ingesta.ts` para el `on conflict` de los mensajes.
--
-- `ingesta_pulso` NO se toca: sigue siendo el candado y la marca de agua, y sus contadores
-- acumulados siguen sirviendo para lo que fueron hechos —el coste— que es una pregunta distinta de
-- «¿corrió la tarea?».
-- ═════════════════════════════════════════════════════════════════════════════

create table negocio.tareas_programadas (
  -- `on delete cascade`, por el MISMO motivo que `ingesta_pulso`: es contabilidad derivada que
  -- nadie escribió a mano y que ninguna pantalla puede vaciar. Bloqueando el borrado, la frase
  -- honesta sería «tiene sellos de tareas programadas» y no habría ninguna acción que la resuelva:
  -- la empresa quedaría imborrable para siempre.
  org_id uuid not null references identidad.organizaciones(id) on delete cascade,

  -- Qué tarea. Lista CERRADA, al contrario de `ingesta_pulso.clave`, y la asimetría es a propósito:
  -- allá la clave la elige el código de la ingesta y una lista cerrada convertiría una clave nueva
  -- en un `23514` que aborta la transacción del ciclo; acá los valores los escribe UN solo archivo
  -- —`lib/negocio/barrido.ts`— y un valor que no está en la lista es un error de programación que
  -- conviene que reviente en la primera corrida.
  tarea text not null check (tarea in ('mensajes', 'citas', 'sonda')),

  -- ── EL SELLO Y SU ESTADO ──
  --
  -- `ultima_corrida_el` es «cuándo pasó el cron por acá», no «cuándo hizo trabajo». Las dos cosas
  -- se distinguen con `ultimo_estado`, y hacen falta las dos: sin el sello no se puede medir el
  -- atraso, y sin el estado un sello fresco no dice si la tarea trabajó o se salteó.
  ultima_corrida_el timestamptz not null,

  --   corrio      · hizo el trabajo
  --   saltada     · no había con qué (típico: la empresa no tiene token cargado). CERO llamadas.
  --   frenada     · el candado o el antirrebote dijeron que no le tocaba. **No es un error.**
  --   sin_tiempo  · se agotó el presupuesto de la corrida antes de llegar a esta empresa
  --   fallo       · lo intentó y no pudo
  --
  -- `frenada` y `saltada` son estados NORMALES, y separarlos de `fallo` es lo que impide que alguien
  -- mire el sello y crea que el cron está roto cuando está funcionando exactamente como debe.
  ultimo_estado text not null check (ultimo_estado in ('corrio', 'saltada', 'frenada', 'sin_tiempo', 'fallo')),

  -- El motivo, cuando el estado no es `corrio`. Nulo cuando corrió: un motivo inventado para el
  -- caso bueno haría que el campo dejara de significar algo.
  --
  -- Y para `saltada` guarda **cuál** de las cinco faltas de credencial fue: `sin_token` no es lo
  -- mismo que `token_ilegible`. Cinco empresas con `token_ilegible` a la vez significa que cambió la
  -- clave maestra del servidor, no que cinco clientes desconectaron su CRM.
  ultimo_motivo text,

  -- Cuántas llamadas al proveedor costó ESTA corrida. Nulo cuando no hubo trabajo.
  ultimas_llamadas integer,

  creado_el timestamptz not null default now(),

  -- `org_id` PRIMERO: lo exige `aplicar_aislamiento`.
  primary key (org_id, tarea)
);

select negocio.aplicar_aislamiento('negocio.tareas_programadas');
