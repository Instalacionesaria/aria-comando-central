-- La comisión de cada persona: su porcentaje y su meta del mes.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ POR PERSONA Y NO POR EMPRESA, Y ES UN DEFECTO QUE ESTABA A PUNTO DE OCURRIR
--
-- El anillo del cockpit dice hoy *"Cargá tu porcentaje y tu meta"* y no hay dónde cargarlos. Lo
-- fácil habría sido un porcentaje por empresa multiplicado por el «cobrado» que el cockpit ya
-- calcula. Medido: **ese `cobrado` es de TODA la organización** — `cockpitDelMes` no recibe
-- `usuarioId` y la consulta filtra solo por fecha.
--
-- Multiplicar el cobrado de la empresa por un porcentaje personal es correcto con un closer y
-- **falso desde el segundo**. Y no falla: da un número plausible **y más alto**. Con dos
-- administradores en producción hoy, los dos verían la comisión del cobrado total.
--
-- Así que las dos mitades son de la misma persona: el porcentaje es suyo y la base también
-- —`resultados.registrado_por = usuario`—. Dos mitades de dueños distintos son una mentira
-- aritmética, no una aproximación.
--
-- «Suya» quiere decir **quien apretó el botón de Avanzar**, y no hay alternativa: `responsable_id`
-- es nulo por diseño declarado (GoHighLevel no da asignación) y `sello_setter_id` no lo escribe
-- ninguna línea de la aplicación. Eso va en el rótulo de la pantalla, que dice «sobre las ventas que
-- registraste vos» en vez de «tus ventas».
--
-- ── Y POR QUÉ EN `negocio` Y NO EN `identidad` ──────────────────────────────
--
-- Porque `aplicar_aislamiento` da el aislamiento por organización gratis y verificado. Una tabla en
-- identidad exigiría permisos por columna, dos políticas escritas a mano y una entrada en la lista
-- blanca de `conIdentidad`. Es una tabla de datos de trabajo, no de identidad.
-- ═════════════════════════════════════════════════════════════════════════════

create table negocio.comisiones (
  org_id uuid not null references identidad.organizaciones(id) on delete cascade,
  usuario_id uuid not null,

  -- El tramo. Hoy solo `closer`, y la columna está en la CLAVE PRIMARIA igual.
  --
  -- No es adivinar el futuro: es que agregar un tramo después sea relajar un `check` en vez de migrar
  -- una clave primaria sobre datos de sueldos. Y hay un tramo que ya se sabe que va a hacer falta —el
  -- del setter— que hoy no se puede configurar porque su base es estructuralmente vacía: `venta_chica`
  -- está en el `check` de `resultados` pero no en `SALIDAS`, así que no hay forma de registrar una
  -- venta de setter. Configurar un porcentaje sobre una base que no puede tener filas produce un cero
  -- que parece medido para siempre.
  tipo text not null check (tipo in ('closer')),

  -- ── EL PORCENTAJE: NULO, Y SIN VALOR POR OMISIÓN ──────────────────────────
  --
  -- Es la línea más importante de la tabla. **Una comisión sin cargar es `null`, no `0`.** Un 0 %
  -- afirma que esa persona no cobra comisión, y eso es un hecho completamente distinto de «todavía
  -- nadie lo configuró».
  --
  -- Un `default 0` acá —o un `?? 0` en el endpoint, o en el formulario, o en la lectura— borra la
  -- distinción entera y la pantalla pasa a afirmar algo que nadie midió. Son cuatro capas y basta con
  -- que una se equivoque.
  porcentaje numeric(5, 2) check (porcentaje >= 0 and porcentaje <= 100),

  -- ── LA META: NULA O MAYOR QUE CERO. EL CERO NO SE ADMITE ─────────────────
  --
  -- Esto vuelve **estructuralmente inexpresable** un defecto concreto de la implementación de
  -- referencia: allá la condición de «meta superada» no mira la meta, así que con la meta en 0 la
  -- pantalla dibuja el anillo vacío y el cartel de felicitación **a la vez**.
  --
  -- Se podría arreglar con una condición en la pantalla, y se escribe igual en la pantalla — pero
  -- ponerlo en la base es más barato que confiar en que nadie borre esa condición: una meta de cero
  -- no significa nada («mi objetivo del mes es no vender») y no tiene por qué poder guardarse.
  meta_mensual numeric(12, 2) check (meta_mensual > 0),

  actualizado_el timestamptz not null default now(),
  -- Quién lo cambió por última vez. En el porcentaje es otra persona —lo fija quien administra— y en
  -- la meta es la misma.
  --
  -- ── `on delete set null`, Y LO PIDIÓ UN GUARDIA ───────────────────────────
  --
  -- La primera versión no lo tenía, y la prueba de `QUE_LO_IMPIDE` disparó con razón: esta clave
  -- foránea **bloquearía el borrado de un usuario** y no hay frase honesta que la explique. Las ocho
  -- tablas de negocio que bloquean lo hacen porque son datos que alguien puso, y cada una tiene su
  -- frase con una acción detrás: *«tiene contactos cargados»*. Acá la frase sería «le fijó el
  -- porcentaje a otra persona», y **no hay ninguna acción que resuelva eso**: la persona quedaría
  -- imborrable para siempre.
  --
  -- Y no se pierde el rastro, que es lo que haría inaceptable el `set null`: quién cambió qué vive en
  -- `identidad.auditoria_accesos`, con la acción `comision_configurada`, y esa fila **sobrevive a la
  -- fila borrada** — es lo que su propio encabezado dice que es su razón de ser. Esta columna es una
  -- comodidad para mostrar «lo cambió tal, tal día», no el registro.
  actualizado_por uuid,

  primary key (org_id, usuario_id, tipo),

  -- ── LAS DOS CLAVES FORÁNEAS COMPUESTAS ────────────────────────────────────
  --
  -- Con `references identidad.usuarios(id)` a secas, nada impediría que la comisión de la empresa A
  -- apuntara a un usuario de la B. Es la misma forma que las ocho tablas de negocio que apuntan a una
  -- persona, y hay que decir algo que sorprende: **`aplicar_aislamiento` NO exige esto** —solo revisa
  -- las claves foráneas hacia el esquema `negocio`— así que una clave simple pasaría el aislamiento
  -- sin una palabra. Lo exige la prueba de forma de las tablas.
  foreign key (org_id, usuario_id) references identidad.usuarios (org_id, id) on delete cascade,
  -- ── `set null (actualizado_por)`, CON LA LISTA DE COLUMNAS, Y HAY QUE DECIR POR QUÉ ──
  --
  -- Sin la lista, `on delete set null` sobre una clave foránea compuesta **anula LAS DOS columnas**:
  -- `actualizado_por` y también `org_id`. Y `org_id` es `not null`, así que borrar a la persona que
  -- alguna vez fijó un porcentaje reventaba con
  -- *«null value in column "org_id" violates not-null constraint»* — un borrado de usuario que falla
  -- por una tabla de comisiones, con un mensaje que no menciona ni las comisiones.
  --
  -- Lo encontró la prueba de este archivo, no la lectura del SQL. La lista de columnas existe desde
  -- PostgreSQL 15; acá corre 17 en local y 17 en producción, medido.
  foreign key (org_id, actualizado_por) references identidad.usuarios (org_id, id)
    on delete set null (actualizado_por)
);

select negocio.aplicar_aislamiento('negocio.comisiones');
