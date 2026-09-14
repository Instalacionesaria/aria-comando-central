-- Si el contacto se presentó a la cita. El CRM nunca lo supo, así que lo registra quien estuvo.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ NO SE PUEDE LEER DEL CRM, Y POR QUÉ HOY NI SIQUIERA SE PUEDE CONTAR
--
-- El show rate es de los KPI que más se piden y es el que este sistema no podía dar. Dos medidas,
-- las dos contra la subcuenta real:
--
--   · el campo de asistencia del CRM está poblado en **3 de 1 052** citas (`lib/ghl/calendarios.ts`)
--   · sus campos personalizados de asistencia, en **0 de 316** (`lib/negocio/indicadoresDeCitas.ts`)
--
-- Un año de operación con el campo vacío no es un problema de sincronización: es que nadie lo llena.
-- Así que el dato no se trae, se registra — y se registra donde ya hay alguien contando cómo fue la
-- llamada, que es el panel de Avanzar.
--
-- ── Y LO QUE HABÍA HOY ERA UN CONTEO, NO UNA TASA ──────────────────────────
--
-- `indicadoresDeCitas.ts` ya cuenta los `no_show` que reporta una persona, y dice a propósito que
-- **es un conteo y no una tasa**: *«su denominador tampoco sería el de las citas: un resultado es un
-- intento del closer, que no es lo mismo»*. Esa frase es el diagnóstico exacto de lo que falta acá:
-- `negocio.resultados` no tiene a qué cita se refiere, así que no hay denominador que construir.
--
-- ── EL AGUJERO DE LA INFERENCIA, MEDIDO EN EL CATÁLOGO ─────────────────────
--
-- La alternativa barata era deducirla: el Closer apaga el bot en seis de sus siete salidas *«porque
-- cualquier resultado suyo demuestra que el contacto ya tuvo su llamada de venta»*
-- (`lib/ghl/contrato.ts`), así que «salida de closer distinta de `no_show` ⟹ apareció».
--
-- No cierra. La salida `nurture` del closer tiene entre sus opciones de detalle justamente
-- **`'No-show'`** (`lib/negocio/salidas.ts`). Un plantón real puede estar registrado como `nurture`,
-- y contarlo como asistencia infla la tasa sin que nada falle. Este archivo le da un lugar propio a
-- la pregunta, y esa opción de detalle se saca en el mismo commit: con dos formas de decirlo, el día
-- que discrepen gana la que nadie mira.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1 · LA ASISTENCIA VIVE EN LA CITA ──────────────────────────────────────
--
-- Y no en el resultado, aunque la registre el mismo panel. Un contacto puede tener dos citas y un
-- solo resultado: con la columna en `resultados` no habría forma de saber a cuál se refiere, y la
-- tasa se calcularía sobre un denominador que no es el suyo — el mismo defecto que este archivo
-- viene a cerrar.
--
-- **Nulo = nadie lo dijo todavía**, y es el caso normal, no una excepción: ninguna cita anterior a
-- hoy lo va a tener nunca, y las nuevas sólo cuando alguien cierre el intento. El `11` § 0 regla 2
-- vale entero acá: un nulo significa una sola cosa. «No se presentó» es `false`, y son distintos.
alter table negocio.citas
  add column if not exists asistio boolean;

comment on column negocio.citas.asistio is
  'Si el contacto se presento. Lo registra una persona en Avanzar: el CRM lo tiene en 3 de 1052. Nulo = nadie lo dijo, distinto de false.';

-- ── 2 · Y EL RESULTADO DICE A QUÉ CITA CORRESPONDE ─────────────────────────
--
-- Nulable, y los dos motivos son reales y frecuentes: un resultado del **setter** es pre-agenda por
-- definición —ninguna de sus cinco salidas prueba que hubo cita—, y un resultado del closer sobre un
-- contacto sin cita en la ventana tampoco tiene a qué apuntar.
--
-- La clave foránea lleva `org_id` adentro. No es prolijidad: `31-forma-de-las-tablas` lo verifica
-- para toda tabla de `negocio` (`fk_sin_org`), porque una foránea sin la organización permite que
-- una fila apunte a la de otro inquilino — y la política de fila no la alcanzaría para desmentirlo.
--
-- `on delete set null` y no `cascade`: una cita se borra cuando desaparece del calendario del CRM, y
-- llevarse el resultado del closer por delante sería perder el trabajo registrado por culpa de un
-- barrido. El resultado sobrevive sin cita, que es exactamente lo que pasa hoy con todos.
alter table negocio.resultados
  add column if not exists cita_id uuid;

-- `add constraint` no tiene `if not exists` en PostgreSQL, y un `42710` revierte TODAS las
-- migraciones pendientes de la corrida. El `drop` previo es lo que hace REAPLICABLE este archivo, y
-- es lo que verifica `10-migraciones.test.ts` desde la `024`.
alter table negocio.resultados
  drop constraint if exists resultados_cita_fk;

alter table negocio.resultados
  add constraint resultados_cita_fk
  foreign key (org_id, cita_id) references negocio.citas (org_id, id) on delete set null;

comment on column negocio.resultados.cita_id is
  'A que cita corresponde este resultado. Nulo: el setter es pre-agenda, y un resultado puede no tener cita. No protege contra el doble registro: eso es clave_de_intento.';

-- ── 3 · EL ÍNDICE QUE SÍ TIENE CONSULTA ────────────────────────────────────
--
-- `tasaDeAsistencia` filtra por organización, por ventana sobre `inicio_el`, y por `asistio is not
-- null`. Ése es el índice y no otro.
--
-- El orden importa: `org_id` primero porque es lo que la `31` exige de toda forma de esta base, y
-- `inicio_el` antes que `asistio` porque la ventana es lo que recorta, y `asistio` sólo desempata
-- dentro de ella.
create index if not exists citas_por_asistencia
  on negocio.citas (org_id, inicio_el, asistio);

-- ── 4 · LO QUE ESTE ARCHIVO **NO** PUEDE HACER ─────────────────────────────
--
-- Rellenar. Con RLS forzada el migrador ve cero filas y un `update` reporta éxito sin tocar nada
-- (regla de la `040`), y aunque pudiera, no hay de dónde: nadie registró nunca esta respuesta. Así
-- que el show rate arranca vacío y se llena a medida que los closers cierran intentos — y hasta que
-- haya suficientes, la cifra tiene que decir que no sabe en vez de dar un número que se mueve
-- cincuenta puntos con el próximo registro.
