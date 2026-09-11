-- Lo que el CRM dice de una cita y esta base tiraba al guardarla.
-- ============================================================================
--
-- `lib/ghl/calendarios.ts` LEE tres cosas que `lib/negocio/citas.ts` no escribe: el usuario que el
-- CRM le asignó a la cita (`assignedUserId` → `usuarioAsignadoId`, línea 243) y cuándo la
-- reagendaron (`rescheduledAt` → `reagendadaEl`, línea 245). Llegan en cada barrido, se recorren,
-- se normalizan a un tipo… y mueren en el objeto `valores` de `guardar()`.
--
-- Es el mismo caso que `ghl_calendario_id` antes de la `038`, y su comentario en `citas.ts` lo dice
-- con todas las letras: *«Ya se leía de la respuesta del CRM y se tiraba acá»*.
--
-- ── LA TERCERA COLUMNA NO VIENE DEL CRM, Y ES LA QUE ARREGLA UN DEFECTO ─────
--
-- `inicio_anterior_el` es NUESTRA. El `do update` de `guardar()` hace que reagendar funcione —la
-- misma cita vuelve con otra hora y la fila se mueve— y ese mismo `update` **borra la hora anterior
-- sin dejar rastro**. Las dos cosas son ciertas a la vez, y la segunda nunca se escribió.
--
-- Con esta columna, el `do update` guarda la hora que está pisando **en la misma sentencia que la
-- pisa**: en un `on conflict do update`, toda referencia a `citas.x` es la fila VIEJA, sin importar
-- el orden de las asignaciones. No hace falta un `select` de más.
--
-- Su límite, dicho acá para que no se lea como más de lo que es: guarda **el último salto que
-- vimos**, no el historial. El barrido corre una vez por hora, así que dos movimientos entre dos
-- barridos se ven como uno; y si la primera vez que vemos una cita ya venía movida, esto queda nulo
-- y parece que nunca se movió. Una tabla de movimientos no arreglaría eso: el techo no lo pone
-- nuestro almacenamiento sino que el CRM manda **un solo** `rescheduledAt` y nosotros miramos una
-- vez por hora.
--
-- ── LAS TRES NULABLES Y SIN VALOR POR OMISIÓN ──────────────────────────────
--
-- No es preferencia, son tres hechos:
--
--   1. Las citas que ya están guardadas **no se pueden rellenar desde acá**. La regla la dejó
--      escrita la `040`: una migración puede cambiar la FORMA de `negocio.*`, nunca su contenido —
--      con RLS forzada el migrador ve cero filas, y un `update` informaría éxito sin tocar nada.
--      Así que un `not null` sin valor por omisión haría fallar este `alter` en el acto, y un
--      `not null default …` le pondría a 1052 citas históricas un valor que nadie midió.
--   2. `reagendada_el` tiene un nulo legítimo para siempre: una cita que nunca se movió. Convive
--      con el otro nulo —«se sincronizó antes de que existiera la columna»— y quien los distingue
--      ya existe: `sincronizado_el`. Es el criterio que la `039` dejó escrito: *«dos formas de decir
--      "no sé" en la misma fila es una de más»*.
--   3. Seis armadores de citas de prueba insertan con `as never`, o sea que el tipo no los protege.
--      Un `not null` los rompería a los seis a la vez, en ejecución, con un `23502` que nombra una
--      columna que ninguno escribió.
--
-- ── Y LA QUE NO ESTÁ: `reservada_el` ───────────────────────────────────────
--
-- Falta la más valiosa —cuándo se RESERVÓ la cita, que es lo que permitiría dar cualquier tasa del
-- embudo por período en vez de acumulada—. No está porque **no está medida**: `createdAt` no
-- aparece ni una vez en este repositorio, y en las dos familias vecinas de la misma API el sello de
-- creación se llama `dateAdded` (contactos y mensajes). El encabezado de `lib/ghl/calendarios.ts`
-- declara que TODO lo que ese archivo afirma salió de medir la subcuenta real, y no hay ninguna
-- respuesta cruda grabada de `GET /calendars/events` en el árbol.
--
-- Escribirla adivinando el nombre del campo sería la primera línea del repositorio que afirma algo
-- del CRM sin haberlo medido. Y una columna que nace nula y nunca se llena es peor que no tenerla:
-- una consulta por período la usaría, devolvería cero, y ese cero se leería como «no hubo reservas».
-- Se agrega cuando se mida, con su censo en el comentario como el resto de ese archivo.

alter table negocio.citas
  add column if not exists reagendada_el      timestamptz,
  add column if not exists crm_asignado_a     text,
  add column if not exists inicio_anterior_el timestamptz;

comment on column negocio.citas.reagendada_el is
  'Cuándo el CRM dice que se reagendó (`rescheduledAt`). Nulo = nunca se movió, o se sincronizó '
  'antes de que existiera la columna: los distingue `sincronizado_el`. Es un escalar, así que con '
  'tres reagendamientos guarda el último.';

comment on column negocio.citas.crm_asignado_a is
  'El `assignedUserId` de la cita, crudo. MISMO nombre que `contactos.crm_asignado_a` porque es el '
  'mismo dato y se resuelve con el mismo vínculo (`closer_asignado.crm_usuario_id`). NO decide en '
  'qué agenda aparece la cita: eso sale del contacto, en un solo lugar (`lib/negocio/agenda.ts`).';

comment on column negocio.citas.inicio_anterior_el is
  'La hora que la cita tenía antes del último movimiento que VIMOS. Nuestra, no del CRM. Guarda el '
  'último salto, no el historial: el barrido mira una vez por hora, así que dos movimientos '
  'seguidos se ven como uno, y una cita que ya venía movida la primera vez que la vimos queda '
  'nula.';
