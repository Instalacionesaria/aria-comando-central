-- Los links de pago de cada empresa, para mandarlos desde el chat sin salir de la pantalla.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ ES UNA TABLA Y NO UNA LISTA EN EL CÓDIGO
--
-- Se pidió un botón en el compositor de la ficha que despliegue los links de cobro. Los diez que
-- existen hoy son de ARIA —cinco de Stripe y cinco de WHOP— y tenerlos escritos en el archivo
-- habría sido más rápido de hacer y **un defecto de dinero**: esta plataforma tiene varias
-- empresas, y con la lista en el código el closer de otra empresa le mandaría a su lead
-- **una cuenta de Stripe que no es la suya**. El cobro entra en la cuenta equivocada y nada falla
-- en ninguna pantalla.
--
-- El segundo motivo es más aburrido y pega antes: un precio cambia, un link de Stripe se archiva, y
-- con la lista en el código eso es un despliegue. Acá es un formulario.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- EL MONTO ES TEXTO, Y NO ES PEREZA
--
-- Tienta guardarlo como número. No se hace, por dos hechos de los datos reales:
--
--   · **«Monto libre» es uno de los cinco links de Stripe** — el cliente escribe cuánto paga. Con
--     una columna numérica habría que representarlo con `null`, y entonces `null` querría decir dos
--     cosas a la vez: «el cliente elige» y «no le puse monto». Indistinguibles, y la primera es un
--     link perfectamente válido que hay que dibujar.
--   · Un número obliga a una columna de **moneda** el día que un cliente cobre en soles o en euros,
--     y a decidir el formato de todos por él.
--
-- Acá el monto **solo se dibuja**: nadie suma con él, nadie ordena por él, nadie lo compara. Es la
-- etiqueta que hace que un menú de diez entradas parecidas se pueda leer de un vistazo. Guardarlo
-- como el texto que la empresa escribió es exactamente lo que se necesita, y ni un campo más.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- LA UNICIDAD ES POR URL, Y NO POR NOMBRE
--
-- El duplicado que hace daño son **dos entradas del menú que apuntan al mismo checkout**: se ven
-- distintas, cobran lo mismo, y quien elige no tiene forma de notarlo.
--
-- Los nombres repetidos, en cambio, son **legítimos y esperables**: los cinco de Stripe se llaman
-- «Stripe» y se distinguen por el monto. Un `unique (org_id, nombre)` habría obligado a nombres
-- artificiales del tipo «Stripe 4k» para satisfacer a la base y no a quien lee.
-- ═════════════════════════════════════════════════════════════════════════════

create table negocio.enlaces_de_pago (
  org_id  uuid not null references identidad.organizaciones(id),
  id      uuid not null default gen_random_uuid(),

  -- Qué es. Por dónde se cobra, normalmente: «Stripe», «WHOP».
  nombre  text not null,

  -- Cuánto. Texto a propósito — ver el encabezado. `null` es un link sin monto que mostrar.
  monto  text,

  -- La nota corta que termina de distinguirlo: «Pago único», «En cuotas».
  descripcion  text,

  url  text not null,

  -- ── EL ORDEN DEL MENÚ, EXPLÍCITO ──────────────────────────────────────────
  --
  -- Ordenar por monto sería tentador y saldría mal: los montos se repiten entre proveedores, así
  -- que Stripe y WHOP quedarían intercalados y elegir «el de cuotas» exigiría leer las diez.
  -- Además «Monto libre» no tiene dónde caer en un orden numérico.
  --
  -- Con una columna, el menú sale en el orden en que la empresa cargó sus links y un link nuevo va
  -- al final. No hay pantalla para reordenar: es deliberado, y se puede agregar el día que alguien
  -- la pida.
  orden  integer not null default 0,

  creado_el        timestamptz not null default now(),
  actualizado_el   timestamptz not null default now(),
  actualizado_por  uuid,

  primary key (org_id, id),

  -- ── DOS ENTRADAS AL MISMO CHECKOUT NO SE PUEDEN DISTINGUIR ────────────────
  --
  -- Ver el encabezado: es la unicidad que importa, y la que un `unique (nombre)` no habría dado.
  constraint enlaces_de_pago_url_unica unique (org_id, url),

  -- ── `https://` OBLIGATORIO, Y ACÁ ADEMÁS DE EN LA RUTA ────────────────────
  --
  -- Es un link por el que alguien va a pagar. Por `http://` viaja en claro y es interceptable; un
  -- `javascript:` pegado en este campo sería peor todavía.
  --
  -- La ruta lo valida y devuelve un motivo legible, que es lo que necesita quien carga el formulario.
  -- Esto de acá es lo único que también cubre una escritura que **no pase por la ruta** — un script,
  -- una corrección a mano, la siembra de los diez de ARIA.
  constraint enlaces_de_pago_https
    check (url like 'https://%'),

  -- Un texto en blanco no es un valor: es la misma disciplina que `prompts_del_agente` escribió para
  -- su texto. Sin esto, un `monto` de cero caracteres se dibujaría como un hueco en el menú y nadie
  -- sabría si es un defecto o si el link no tiene monto.
  constraint enlaces_de_pago_nombre_no_vacio
    check (btrim(nombre) <> ''),
  constraint enlaces_de_pago_monto_no_vacio
    check (monto is null or btrim(monto) <> ''),
  constraint enlaces_de_pago_descripcion_no_vacia
    check (descripcion is null or btrim(descripcion) <> ''),
  constraint enlaces_de_pago_url_no_vacia
    check (btrim(url) <> ''),

  foreign key (org_id, actualizado_por) references identidad.usuarios (org_id, id)
);

-- El aislamiento por empresa, igual que el resto de `negocio`. Acá pesa más que en otras tablas: un
-- link de cobro visible desde otra cuenta es la lista de precios completa de la empresa, y —peor—
-- una cuenta de cobro que se le podría mandar a un lead ajeno.
select negocio.aplicar_aislamiento('negocio.enlaces_de_pago');
