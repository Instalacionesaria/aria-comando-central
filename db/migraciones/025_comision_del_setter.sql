-- Los dos tramos de la comisión del setter. **Relajar un `check`, y nada más.**
--
-- ═════════════════════════════════════════════════════════════════════════════
-- LA MIGRACIÓN 015 DEJÓ ESTO PREPARADO, Y DIJO POR QUÉ NO LO ABRÍA
--
-- `negocio.comisiones` tiene `tipo` **dentro de la clave primaria** desde el primer día, con el
-- motivo escrito: *«no es adivinar el futuro: es que agregar un tramo después sea relajar un `check`
-- en vez de migrar una clave primaria sobre datos de sueldos»*. Éste es ese después, y por eso esta
-- migración son tres líneas de SQL: la clave ya admite los tres tramos.
--
-- Y dio el motivo exacto de no abrirlo entonces, que era medido y ya no es cierto:
--
--   > *«hay un tramo que ya se sabe que va a hacer falta —el del setter— que hoy no se puede
--   > configurar porque su base es estructuralmente vacía: `venta_chica` está en el `check` de
--   > `resultados` pero no en `SALIDAS`, así que no hay forma de registrar una venta de setter.
--   > Configurar un porcentaje sobre una base que no puede tener filas produce un cero que parece
--   > medido para siempre.»*
--
-- Las dos condiciones cambiaron, y las dos se pueden comprobar en el código:
--
--   · `venta_chica` es una de las cinco salidas de `lib/negocio/salidasDelSetter.ts`, y
--     `POST /api/contactos/:id/avanzar` la acepta sobre un contacto del setter.
--   · `contactos.sello_setter_id` **tiene escritor**: `lib/negocio/sello.ts`. La 015 anotaba que
--     *«no lo escribe ninguna línea de la aplicación»*, y era verdad — es lo que obligaba a que el
--     rótulo de la pantalla dijera «sobre las ventas que registraste vos». Ya no.
--
-- Las dos bases existen. Recién ahora un porcentaje configurado acá puede dar un número que sea
-- cierto, y no un cero que parece medido.
--
-- ── POR QUÉ DOS TRAMOS Y NO UN PORCENTAJE ÚNICO ─────────────────────────────
--
-- Porque el setter cobra por dos hechos distintos y con porcentajes distintos:
--
--   · **`setter_directo`** — sus ventas chicas. Las cobró él, de punta a punta.
--   · **`setter_diferido`** — el tramo sobre las ventas GRANDES que cerró el closer sobre leads que
--     él originó. No las registró él: la base es `contactos.sello_setter_id`.
--
-- Un solo porcentaje para los dos obligaría a elegir cuál de los dos negocios es el verdadero. Y la
-- clave primaria `(org_id, usuario_id, tipo)` los deja convivir sin una tabla nueva: la misma
-- persona tiene una fila por tramo, cada una con su porcentaje y su meta.
--
-- ── QUÉ **NO** HACE ESTA MIGRACIÓN ──────────────────────────────────────────
--
-- No toca la clave primaria, no agrega columnas, no crea tablas. Así que **no vuelve a llamar a
-- `negocio.aplicar_aislamiento`**: la tabla ya lo tiene desde la 015, y las políticas no dependen
-- del `check`. Un `aplicar_aislamiento` de más acá sería ruido que hace dudar de si la tabla estaba
-- aislada antes.
--
-- Tampoco pone ninguna fila. Un porcentaje sembrado es un porcentaje que nadie decidió, y
-- `porcentaje numeric(5,2)` sin `default` está escrito exactamente para que no exista esa
-- posibilidad: sin fila, nadie lo configuró.
-- ═════════════════════════════════════════════════════════════════════════════

alter table negocio.comisiones drop constraint comisiones_tipo_check;

alter table negocio.comisiones
  add constraint comisiones_tipo_check
  check (tipo in ('closer', 'setter_directo', 'setter_diferido'));

-- ── Y EL `check` SIGUE SIENDO UNA LISTA CERRADA, A PROPÓSITO ────────────────
--
-- Se podría haber quitado la restricción y dejar `tipo text not null` a secas. Sería más cómodo y
-- peor: un `tipo` mal escrito —`'setter-directo'`, `'setter'`— entraría sin una queja, y la fila
-- quedaría guardada con un porcentaje que **ninguna consulta lee**. El síntoma sería «cargué mi
-- comisión y la pantalla sigue diciendo que nadie la cargó», con la fila ahí, en la tabla.
--
-- Con la lista cerrada eso es un error de la base en el momento de guardar, en la pantalla de quien
-- lo está configurando.
comment on column negocio.comisiones.tipo is
  'El tramo. `closer`, `setter_directo` (sus ventas chicas) o `setter_diferido` (sobre las ventas '
  'del closer en leads que él originó, por `contactos.sello_setter_id`). Lista cerrada: un tipo mal '
  'escrito guardaría un porcentaje que ninguna consulta lee.';
