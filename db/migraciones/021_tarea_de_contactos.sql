-- La tercera tarea del cron: releer las etiquetas de los contactos.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- ESTO NO ES UNA MEJORA DE FRESCURA: CIERRA UNA PÉRDIDA DE DATOS
--
-- El cron corría `sonda`, `mensajes` y `citas`. **Nada releía las etiquetas de los contactos.** La
-- única forma de traer un contacto nuevo era un botón que hoy vive únicamente en la pestaña Setter, y
-- que alguien tiene que apretar.
--
-- Y lo que pasa mientras no lo aprieta no es «el contacto aparece tarde». Es peor, y está en
-- `lib/negocio/ingesta.ts`:
--
--     const contacto = conv.contactId ? conocidos.get(conv.contactId) : undefined;
--     if (!contacto) {
--       // No es nuestra: ya está terminada, no hay nada que traer. La marca avanza igual…
--       marca = conv.ultimaEl ?? marca;
--       continue;
--     }
--
-- Un contacto que no está en `negocio.contactos` **no existe para la ingesta**, así que sus
-- conversaciones se cuentan como ajenas y la marca de agua pasa por encima. Cuando el contacto por
-- fin se sincroniza, la marca ya está más adelante: **sus mensajes quedan por debajo y no se
-- recuperan nunca**, salvo retrocediendo la marca a mano.
--
-- Y no falla nada. El contacto aparece en el Pipeline con su nombre y su chat vacío, y se lee como
-- «todavía no escribió» — que es exactamente lo contrario de lo que pasó.
--
-- ── POR QUÉ HACE FALTA UNA MIGRACIÓN PARA AGREGAR UNA TAREA ──────────────────
--
-- Porque la `014` cerró la lista a propósito, y ese comentario sigue siendo correcto:
--
--     tarea text not null check (tarea in ('mensajes', 'citas', 'sonda')),
--
--     -- Lista CERRADA, al contrario de `ingesta_pulso.clave`, y la asimetría es a propósito: […]
--     -- acá los valores los escribe UN solo archivo —`lib/negocio/barrido.ts`— y un valor que no
--     -- está en la lista es un error de programación que conviene que reviente en la primera corrida.
--
-- Y reventó, que es lo que se esperaba de ella: sin esta migración, el primer sello de `contactos`
-- aborta con un `23514`. La restricción hizo su trabajo — se amplía la lista, no se abre.
--
-- ── EL ORDEN IMPORTA, Y NO ESTÁ EN ESTE ARCHIVO ──────────────────────────────
--
-- `contactos` tiene que correr **antes** de `mensajes` en la misma corrida, por lo de arriba: si la
-- ingesta pasa primero, el contacto nuevo todavía no existe y la marca ya se le adelantó. Eso lo
-- garantiza el orden de la lista en `HORARIOS` de `lib/negocio/barrido.ts`, con su prueba — la base
-- no puede expresar «esta tarea antes que esa».
-- ═════════════════════════════════════════════════════════════════════════════

-- Se reemplaza la restricción en vez de agregar otra: dos `check` sobre la misma columna se cumplen
-- los dos, así que dejar el viejo puesto haría que `contactos` siguiera siendo rechazado y el
-- síntoma sería una migración aplicada que no cambió nada.
alter table negocio.tareas_programadas
  drop constraint tareas_programadas_tarea_check;

alter table negocio.tareas_programadas
  add constraint tareas_programadas_tarea_check
  check (tarea in ('mensajes', 'citas', 'sonda', 'contactos'));

comment on column negocio.tareas_programadas.tarea is
  'Qué tarea del cron. Lista cerrada, ampliada en la 021 con `contactos` — releer las etiquetas, que '
  'es lo que hace que un contacto nuevo exista para la ingesta antes de que la marca de agua le pase '
  'por encima. Los valores los escribe un solo archivo: `lib/negocio/barrido.ts`.';
