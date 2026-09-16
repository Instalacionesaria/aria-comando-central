-- La séptima tarea del cron: traer lo que costó cada anuncio.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- LA CUARTA VEZ QUE ESTA LISTA CERRADA SE AMPLÍA, Y SIGUE VALIENDO LA PENA
--
-- `tareas_programadas.tarea` es una lista cerrada a propósito, y revienta con un `23514` en la
-- primera corrida si este archivo no está. Es exactamente lo que se espera de ella: la lista se
-- **amplía**, no se abre. Ya pasó con la `021` (`contactos`), la `030` (`auditoria`) y la `033`
-- (`mejora`).
--
-- Va en su propio archivo y no dentro de la `050` por el mismo motivo por el que aquellas tres son
-- archivos propios: el esquema de una tabla nueva y el vocabulario de una tabla vieja son dos
-- cambios distintos, y si el segundo hay que revertirlo, revertir el primero se llevaría datos.
-- ═════════════════════════════════════════════════════════════════════════════

-- Se REEMPLAZA la restricción en vez de agregar otra: dos `check` sobre la misma columna se cumplen
-- los dos, así que dejar el viejo puesto haría que `anuncios` siguiera siendo rechazada y el
-- síntoma sería una migración aplicada que no cambió nada. Es la misma nota de la 021, la 030 y la
-- 033.
--
-- Y el `drop` es lo que hace REAPLICABLE este archivo: PostgreSQL no tiene
-- `add constraint if not exists`, y un `42710` revierte TODAS las migraciones pendientes de la
-- corrida. Lo exige `10-migraciones.test.ts` desde la `024`.
alter table negocio.tareas_programadas
  drop constraint if exists tareas_programadas_tarea_check;

alter table negocio.tareas_programadas
  add constraint tareas_programadas_tarea_check
  check (tarea in ('mensajes', 'citas', 'sonda', 'contactos', 'auditoria', 'mejora', 'anuncios'));

-- ── POR QUÉ **NO** SE AMPLÍA `ingesta_pulso` ────────────────────────────────
--
-- El candado de `conElPulso` existe para las tareas que dispara el reloj del navegador cada diez
-- segundos: sin él, N pestañas abiertas son N veces el tráfico contra el proveedor. Esta tarea la
-- dispara sólo el cron, una vez por día, igual que `contactos` y `mejora` — y ninguna de las dos
-- está en `ClaveDePulso`.
--
-- El día que alguien le ponga un botón en una pantalla, el candado es lo primero que hay que
-- agregarle. Queda dicho acá para que esa decisión sea deliberada y no un olvido.
