-- Etapa 13 · lo que hace falta para que el chat exista.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- LA RESTRICCIÓN CENTRAL, MEDIDA CONTRA LA CUENTA REAL
--
-- `011` ya dejó escrito que la búsqueda de conversaciones de GoHighLevel **ignora el filtro por
-- etiqueta**. Medido el 2026-08-25 contra la subcuenta de producción: `GET /conversations/search`
-- responde `total: 15808`. Nuestros contactos son 239.
--
-- Así que espejar conversaciones es inviable, y el diseño no las filtra: **las ordena**.
--
--   GET /conversations/search?sortBy=last_message_date&sort=asc&startAfterDate=<marca>
--
-- Las tres piezas se midieron una por una, porque de las tres depende todo:
--
--   · `sort=asc` sobre `last_message_date` **funciona**: las fechas vuelven ascendentes.
--   · `startAfterDate` **se respeta**, y es **exclusivo** (`>`, no `>=`).
--   · La respuesta trae `id`, `contactId`, `lastMessageDate`, `lastMessageBody` y
--     `lastMessageDirection` — o sea que el último mensaje de cada conversación viene **en la
--     búsqueda**, sin pagar una llamada por conversación.
--
-- ── POR QUÉ `asc` Y NO `desc`, QUE ES LO INTUITIVO ──────────────────────────
--
-- Con `desc` («lo más nuevo primero») la marca de agua **no se puede mantener**. Si la página de
-- 100 se llena sin llegar a la marca, se ingirieron las 100 más nuevas y quedó un hueco entre la
-- marca y la más vieja de la página — y ese hueco **ya no es alcanzable** con una consulta
-- descendente: está por debajo del top 100. La marca no puede avanzar (se relee lo mismo cada
-- ciclo, para siempre) ni saltar (se pierden mensajes).
--
-- Con `asc` desde la marca, **la paginación ES la marca**: solo avanza sobre trabajo terminado, y
-- truncar es gratis porque la próxima vuelta sigue donde quedó. No hay hueco posible.
-- ═════════════════════════════════════════════════════════════════════════════


-- ═════════════════════════════════════════════════════════════════════════════
-- 1 · Las columnas de `mensajes`
-- ═════════════════════════════════════════════════════════════════════════════

-- El identificador de la conversación en el CRM. Sin él no hay a qué preguntarle por el estado de
-- entrega de un saliente, que es toda la razón de la tercera pasada.
--
-- Y NO se crea una tabla `conversaciones`: no tiene ni un dato propio que guardar —el id, el
-- contacto y la fecha del último mensaje ya viven en `mensajes` y en `contactos`— y espejarla es
-- exactamente lo que la medición de arriba declara inviable.
alter table negocio.mensajes add column ghl_conversacion_id text;

-- ── EL ESTADO DE ENTREGA VA SIN `check`, Y LA CLASIFICACIÓN CON `check` ─────
--
-- La asimetría es la decisión, no un descuido.
--
-- `estado_entrega` guarda **el valor tal como lo da el CRM**. Medido en 65 mensajes reales de
-- cuatro conversaciones: `delivered` (43), ausente (12), `read` (9), `completed` (2), `sent` (1).
-- Es vocabulario del CRM y del canal, **no nuestro**.
--
-- Una lista cerrada sobre vocabulario ajeno convierte un valor nuevo —`carrier_rejected`, lo que
-- Meta agregue el mes que viene— en un `23514`, y ese error **aborta la transacción y con ella el
-- ciclo entero de ingesta**. O sea que un valor nuevo del proveedor sería una caída de nuestro
-- sistema. Lo que se pierde no es una fila: es la pasada completa.
--
-- Y nulo es el caso NORMAL, no una excepción: 12 de 65. Un mensaje sin estado no es un mensaje
-- fallido — es uno del que el canal no dijo nada.
alter table negocio.mensajes add column estado_entrega text;

-- `estado_entrega_familia` es NUESTRA clasificación, y ahí el `check` es la garantía de que la
-- clasificación existe. No puede fallar: el mapeo de `lib/ghl/entrega.ts` es TOTAL — todo lo que
-- no conoce cae en `'desconocido'`, que es un valor válido de esta lista.
--
-- Con las dos juntas: la verdad cruda del CRM se guarda sin adulterar, las consultas y los
-- disparadores leen UNA columna con cuatro valores, y el vocabulario no está duplicado entre el
-- SQL y el código.
alter table negocio.mensajes
  add column estado_entrega_familia text not null default 'en_curso'
    check (estado_entrega_familia in ('en_curso', 'entregado', 'fallido', 'desconocido'));

-- El texto del error del canal, SIN TRADUCIR. Es lo que hay que poder reconocer el día que el
-- canal cambie la redacción o la regla; traducido, ese día nadie entiende qué pasó.
alter table negocio.mensajes add column fallo_del_canal text;

-- DOS fechas y no una, y son hechos distintos:
--   · `estado_entrega_el`        — cuándo el CRM nos dijo esto.
--   · `estado_entrega_revisado_el` — cuándo le preguntamos.
--
-- Sin la segunda no se puede escribir el orden de la tercera pasada (`nulls first`), y sin ese
-- orden los dos mensajes más nuevos se revisan en cada ciclo y **el tercero nunca**. Es inanición,
-- y no falla: simplemente hay un mensaje fallido que nadie va a ver.
alter table negocio.mensajes add column estado_entrega_el timestamptz;
alter table negocio.mensajes add column estado_entrega_revisado_el timestamptz;

-- ── EL IDENTIFICADOR FABRICADO ──────────────────────────────────────────────
--
-- Cuando el canal no manda identificador, el aviso del CRM inventa uno. Esos **no existen del lado
-- de GoHighLevel**, así que la tercera pasada tiene que excluirlos: sin eso la consulta nunca se
-- vacía, cuesta dos llamadas por ciclo para siempre, y no resuelve nada. Es el tipo de defecto que
-- no rompe nada y gasta presupuesto indefinidamente.
--
-- Columna booleana **además** del prefijo `fab:` del identificador. Un `like 'fab:%'` en la consulta
-- sería un prefijo haciendo de tipo, y el día que un identificador real empiece con esas cuatro
-- letras la exclusión se rompe en silencio.
alter table negocio.mensajes add column id_fabricado boolean not null default false;

-- El identificador de quien lo escribió EN EL CRM. Es otro espacio de nombres: `autor_usuario_id`
-- referencia `identidad.usuarios (org_id, id)`, y el `userId` de GoHighLevel no es uno de nuestros
-- usuarios. Sin esta columna, «lo escribió una persona» y «cuál persona» se colapsan.
--
-- Medido: viene como cadena VACÍA cuando no hay persona, no como nulo. La lectura lo normaliza.
alter table negocio.mensajes add column autor_ghl_usuario_id text;

-- Por qué vía entró. Vocabulario propio, así que `check` cerrado.
--
-- Responde una pregunta que hoy no tiene dónde mirarse: **¿el aviso del CRM está llegando?** Con
-- las tres pasadas escribiendo en la misma tabla, un aviso mal configurado es invisible — la pasada
-- periódica tapa el agujero con diez segundos de retraso y nadie se enteraría nunca.
alter table negocio.mensajes
  add column origen text not null default 'ingesta'
    check (origen in ('aviso', 'ingesta', 'revision', 'apertura', 'propio'));

-- El índice de la TERCERA pasada. Parcial, porque la consulta siempre lleva las dos condiciones:
-- solo salientes, y solo identificadores reales.
create index mensajes_entrega_sin_resolver
    on negocio.mensajes (org_id, estado_entrega_revisado_el nulls first)
 where direccion = 'saliente' and id_fabricado = false;


-- ═════════════════════════════════════════════════════════════════════════════
-- 2 · La marca por contacto
--
-- «De este contacto tenemos los mensajes desde acá.» Nula = no se leyó su historia.
--
-- Sin esta columna, un contacto con la conversación vacía y otro cuya lectura falló **se ven
-- idénticos**, y la ficha diría «nunca escribió» de los dos. Es el `11` § 9 regla 1 aplicado al
-- tiempo: un vacío antes de una fecha que nadie leyó no es un vacío medido.
-- ═════════════════════════════════════════════════════════════════════════════

alter table negocio.contactos add column mensajes_desde_el timestamptz;


-- ═════════════════════════════════════════════════════════════════════════════
-- 3 · El pulso: el candado y las dos marcas de agua
--
-- ── LAS DOS PIEZAS QUE `CloserView.jsx` DECLARÓ COMO REQUISITO PREVIO ───────
--
-- Ese archivo dice, con estas palabras, que el reloj de diez segundos no se pone antes de tener
-- **un candado del lado del servidor** (para que N pestañas cuesten como una) y **una marca de
-- agua** (para que el coste sea proporcional a la actividad y no al tamaño de la cuenta). Ésta es
-- la tabla de las dos.
--
-- ── POR QUÉ `clave` Y NO SOLO `org_id` ──────────────────────────────────────
--
-- Para que el día que se ingieran citas o llamadas su candado sea OTRA fila. Con la organización
-- como clave única, la ingesta del calendario **serializaría contra la de mensajes** y una tardanza
-- en una congelaría la otra. Hoy hay un solo valor, `'mensajes'`.
--
-- ── Y POR QUÉ EN `negocio` Y NO EN LAS CREDENCIALES ─────────────────────────
--
-- Poner esto en `identidad.organizaciones_credenciales` sería más cómodo —ya hay una fila por
-- organización y ya es el precedente de `.forUpdate()`— y obligaría a que la ingesta abriera la
-- escotilla sin filtro para su operación NORMAL. `pruebas/apoyo/autorizados.ts` existe justamente
-- para que esa lista no crezca por comodidad. Acá el filtro lo pone la política.
-- ═════════════════════════════════════════════════════════════════════════════

create table negocio.ingesta_pulso (
  -- ── `on delete cascade`, Y ES LA ÚNICA TABLA DE NEGOCIO QUE LO LLEVA ──────
  --
  -- Las otras ocho bloquean el borrado de una empresa a propósito, y cada una tiene su frase en
  -- `lib/administracion/borrado.ts`: *"tiene contactos cargados"*, *"tiene notas escritas"*. Son
  -- datos que alguien puso, y la frase manda a hacer algo con ellos.
  --
  -- Esto no. Es **contabilidad derivada**: una marca de agua y unos contadores que nadie escribió y
  -- que nadie puede vaciar desde ninguna pantalla. Bloqueando, la frase honesta sería *"tiene
  -- marcas de ingestión"* y no habría **ninguna acción** que la resuelva: la empresa quedaría
  -- imborrable para siempre, que es la definición de un estado sin salida del `03` § 5.
  --
  -- Y no se pierde nada: el borrado real solo procede cuando no queda nada colgando, así que
  -- cuando esto se arrastra ya no hay mensajes de los que la marca hable.
  org_id uuid not null references identidad.organizaciones(id) on delete cascade,
  -- Qué se está ingiriendo. Ver arriba: hoy solo `'mensajes'`.
  clave text not null,

  -- ── LAS DOS MARCAS ──
  --
  -- `marca_el` afirma UNA cosa, y toda la corrección depende de leerla así:
  --
  --   **toda conversación cuya última actividad es anterior o igual a `marca_el` ya fue ingerida.**
  --
  -- No es «la última vez que corrimos» ni «el mensaje más nuevo que tenemos». Esas dos avanzan con
  -- el reloj y **se saltean lo que falló en el medio**.
  marca_el timestamptz,
  -- El PISO. Se escribe una vez y no se mueve. Una conversación vacía antes de esta fecha no es una
  -- conversación sin mensajes: es una que no se leyó.
  marca_desde_el timestamptz,

  -- ── LA CONTABILIDAD DEL COSTE, que es lo que vuelve el presupuesto una afirmación ──
  --
  -- Sin estas columnas, «cuesta una llamada por ciclo» es una intención. Con ellas es una medición
  -- que se puede consultar en producción.
  ultima_corrida_el timestamptz,
  ultima_corrida_llamadas integer,
  llamadas_acumuladas bigint not null default 0,
  corridas bigint not null default 0,
  -- `true` = se agotó un tope y quedó trabajo sin hacer. Quien mira una cola tiene que poder saber
  -- que está incompleta, igual que `hayMas` en las listas.
  atrasado boolean not null default false,
  ultimo_fallo text,
  ultimo_fallo_el timestamptz,

  creado_el timestamptz not null default now(),

  -- `org_id` PRIMERO en la clave primaria: lo exige `aplicar_aislamiento`, y no hace falta una
  -- columna `id` propia — la regla pide `org_id` al frente, no un uuid.
  primary key (org_id, clave)
);

select negocio.aplicar_aislamiento('negocio.ingesta_pulso');


-- ═════════════════════════════════════════════════════════════════════════════
-- 4 · Los dos disparadores que mantienen la actividad del contacto
--
-- Van en la base y no en el código por el motivo que la `011` ya escribió para el sello del setter:
-- *un `update` que lo pise no falla*. Y acá pesa más todavía: **escriben tres pasadas distintas**
-- —el aviso del CRM, la periódica y la de revisión— y una regla en el código habría que acordarse
-- de ponerla en las tres.
--
-- De `ultimo_entrante_el` dependen TRES cosas: la ventana de respuesta de 24 horas, el Buzón, y la
-- reapertura de una tarea completada. Si retrocediera, las tres se romperían **al mismo tiempo y
-- sin ningún error**: se reabriría una ventana cerrada, un contacto atendido volvería al Buzón, y
-- una tarea cerrada se reabriría sola.
-- ═════════════════════════════════════════════════════════════════════════════

create function negocio.marcar_actividad_del_contacto() returns trigger as $$
begin
  if new.direccion = 'entrante' then
    -- La fecha y el texto se mueven JUNTOS, que es lo que el disparador `entrante_solo_avanza` de
    -- la 011 exige. El `where … <` de acá es el cinturón; ese disparador es el tirante. Los dos,
    -- porque la ingesta desordenada es NORMAL en este diseño: la tercera pasada relee
    -- conversaciones viejas todo el tiempo.
    update negocio.contactos
       set ultimo_entrante_el = new.enviado_el,
           ultimo_entrante_texto = new.cuerpo
     where org_id = new.org_id
       and id = new.contacto_id
       and (ultimo_entrante_el is null or ultimo_entrante_el < new.enviado_el);

  -- Un saliente que el canal RECHAZÓ no cuenta como respuesta, y ésa es la decisión con motivo: la
  -- columna que significa «lo intentamos» es exactamente la que hace que un mensaje rechazado
  -- parezca una respuesta atendida. La verdad cruda no se pierde — está en `mensajes`, fila por
  -- fila, con su `estado_entrega` y su `fallo_del_canal`.
  elsif new.estado_entrega_familia <> 'fallido' then
    update negocio.contactos
       set ultimo_saliente_el = greatest(coalesce(ultimo_saliente_el, new.enviado_el), new.enviado_el)
     where org_id = new.org_id and id = new.contacto_id;
  end if;

  -- `after` con `return null`: no modifica la fila que se está insertando.
  return null;
end
$$ language plpgsql;

create trigger mensajes_marcan_actividad
  after insert on negocio.mensajes
  for each row execute function negocio.marcar_actividad_del_contacto();


-- Y el que hace que la TERCERA pasada sirva para algo.
--
-- Sin esto, averiguar que un mensaje falló sería un dato que queda en una columna y no cambia
-- ninguna cola: el contacto seguiría contando como «respondido» con un mensaje que nunca llegó.
create function negocio.recomputar_saliente() returns trigger as $$
begin
  update negocio.contactos c
     set ultimo_saliente_el = (
           select max(m.enviado_el)
             from negocio.mensajes m
            where m.org_id = new.org_id
              and m.contacto_id = new.contacto_id
              and m.direccion = 'saliente'
              and m.estado_entrega_familia <> 'fallido')
   where c.org_id = new.org_id and c.id = new.contacto_id;
  return null;
end
$$ language plpgsql;

-- Nótese que `ultimo_entrante_el` NO se toca acá: solo avanza, siempre, y ninguna de estas dos
-- funciones la hace retroceder.
create trigger mensajes_reabren_por_entrega
  after update of estado_entrega_familia on negocio.mensajes
  for each row
  when (old.estado_entrega_familia is distinct from new.estado_entrega_familia)
  execute function negocio.recomputar_saliente();

-- Ninguna de las dos necesita `security definer`: `aplicar_aislamiento` otorga las cuatro
-- operaciones sobre las tablas de negocio a `app_inquilino`, el `update` es a la MISMA
-- organización, y la política pasa.
revoke all on function negocio.marcar_actividad_del_contacto() from public;
revoke all on function negocio.recomputar_saliente() from public;
