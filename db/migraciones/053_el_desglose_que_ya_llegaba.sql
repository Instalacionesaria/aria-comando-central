-- El desglose de acciones que el proveedor ya mandaba y el cliente tiraba
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- LO QUE ESTA MIGRACIÓN CORRIGE, Y QUE ESTA MISMA SERIE HABÍA DECLARADO IMPOSIBLE
--
-- La `050`, en su bloque «LO QUE NO VIENE POR ESTA VÍA», escribió:
--
--     «Ninguna métrica de video: reproducciones, cuartiles 25/50/75/100, tiempo medio visto,
--      retención de tres y de seis segundos. Tampoco link clicks, link CTR ni landing page views…
--      con ellas caen el analizador de creativos del § 18.12 y la vista entera del responsable
--      creativo del § 18.15.»
--
-- **De esas ocho cosas, cuatro llegaban ya entonces.** Medido el 2026-09-18 contra la subcuenta
-- real: `/ad-publishing/facebook/reporting/list?listType=ads` devuelve, por anuncio y por día, un
-- campo `results` con el desglose de acciones de Meta.
--
--     "results": {"videoView":"328","linkClick":"18","landingPageView":"16",
--                 "postEngagement":"354","postReaction":"4","lead":"1", …}
--
-- Cobertura sobre 96 llamadas (8 días × 12 campañas) y 31 filas anuncio-día con entrega:
--
--     videoView         28 de 31   90 %     → hook rate (§ 18.7 «three-second view rate»)
--     postEngagement    28 de 31   90 %     → tasa de interacción
--     linkClick         23 de 31   74 %     → link CTR (§ 18.7 «interacción»)
--     landingPageView   20 de 31   65 %     → landing page view rate y click-to-landing
--     lead              15 de 31   48 %     → posiblemente el punto 4 del § 18.14
--
-- El error de la `050` no fue descuido: la conclusión salió de mirar las columnas de primer nivel de
-- la respuesta y extenderla, sin comprobar, a un campo ANIDADO. `lib/ghl/anuncios.ts` hacía
-- `numero(o.results)` sobre un objeto, y `numero()` devuelve nulo para todo lo que no sea número o
-- cadena: el desglose entero se parseaba a nulo y se tiraba, en todas las llamadas, desde el primer
-- día.
--
-- **No cuesta ninguna llamada nueva.** El colector ya pide ese endpoint una vez por campaña y por
-- día, en la tarea `anuncios` del cron de las 17:06 UTC. El desglose viene en esa misma respuesta.
--
-- Lo que la `050` dijo bien y sigue en pie, remedido uno por uno: los cuartiles, el tiempo medio
-- visto y la retención de seis segundos NO se pueden pedir —`fields` es un enum cerrado de once
-- valores y todo lo demás da 422—, el placement tampoco —`groupBy` sólo acepta day/week/month— y el
-- activo creativo tampoco —`/entity?entityType=AD` devuelve cuatro campos y `/creatives` da 404—.
-- Para ésos la única fuente sigue siendo Meta directo. El detalle con el código de error de cada
-- intento está en `docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md`.
--
-- **La `050` no se edita.** Una migración aplicada es registro histórico, y reescribir su
-- razonamiento borraría la prueba de cómo se llegó a una conclusión equivocada. La corrección vive
-- acá.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ═══ 1 · UNA COLUMNA EN LA FILA QUE YA EXISTE, Y NO UNA TABLA HIJA ═══════════
--
-- La alternativa natural era `negocio.acciones_de_anuncio (org_id, meta_anuncio_id, fecha, tipo,
-- cantidad)`. Se descartó por dos razones, y la primera es la que decide.
--
-- **Multiplica el grano.** La consulta de la pantalla divide una acción por impresiones. Las
-- impresiones son UNA fila por (anuncio, día); las acciones serían quince a veinticinco. Unirlas
-- multiplica el denominador y el hook rate sale unas veinte veces más chico y perfectamente
-- creíble. `lib/negocio/costoDelAnuncio.ts:157-164` documenta ese defecto para ESTE MISMO par de
-- tablas: «Es el defecto clásico de unir dos hechos de distinto grano, y no falla: devuelve un
-- número más grande.»
--
-- **Y no cabe en el presupuesto del colector.** Medido: 4,55 s por llamada al Ad Manager, doce
-- campañas por día son 54,6 s, y el tramo fijo de tres días ya consume ~164 s contra un presupuesto
-- de 120 s. Veinte inserciones más por anuncio-día encenderían `atrasado` en todas las pasadas, y
-- un aviso que aparece siempre es uno que nadie lee — que es exactamente el defecto que bajó
-- `DIAS_QUE_SE_RELEEN` de 3 a 2.
--
-- Columnas por tipo tampoco: son ~45 tipos observados con cobertura del 90 % al 3 %, el catálogo es
-- de Meta y crece sin avisar. Cada tipo nuevo sería una migración y, mientras no la hubiera, **se
-- descartaría en silencio** — que es el defecto que este archivo viene a arreglar. Es el mismo
-- argumento con el que la `050` dejó `objetivo` sin `check` («un catálogo ajeno no puede ser lo que
-- frena la ingesta») y con el que la `048` eligió `jsonb` para `atribucion_primera` («serían ocho
-- columnas casi siempre nulas, y cada campo nuevo que GoHighLevel agregue sería otra migración»).
--
-- ── LOS DOS CEROS SE CONSERVAN CON LA PRESENCIA DE LA CLAVE ──────────────────
--
-- El argumento a favor de la tabla hija era que sólo la existencia de una fila distingue «Meta no
-- reportó ese tipo» de «reportó cero». Es falso: `acciones ? 'videoView'` hace lo mismo, y ese
-- operador ya está en producción en cinco lugares (`costoDelAnuncio.ts:346` y `:367`,
-- `calidadDeLaAtribucion.ts:96`, `:114` y `:126`).
--
-- Y desaparece la parte más frágil de aquel diseño: con filas hijas había que borrar el sobrante
-- cuando un tipo deja de venir —Meta corrige hacia atrás— y las tres respuestas posibles eran
-- malas. Con una columna, la reescritura sustituye el objeto entero, atómica, en la sentencia que
-- ya existe.

alter table negocio.metricas_de_anuncio
  add column if not exists acciones jsonb;


-- ═══ 2 · NULABLE, Y SIN `default '{}'` — LA DIFERENCIA IMPORTA ═══════════════
--
-- La `048` pudo poner `not null default '{}'` en `atribucion_primera` porque ahí «un contacto sin
-- atribución y uno que nunca se sincronizó se distinguen por `sincronizado_el`».
--
-- **Acá ese discriminador no sirve**, y es medible por qué: `diasQuePedir`
-- (`lib/negocio/recolectarAnuncios.ts:220`) sólo vuelve a pedir hoy, los dos días anteriores, y los
-- días que no tienen NINGUNA fila. Las ~2.500 filas ya guardadas tienen fila, así que no se releen
-- nunca y su `sincronizado_el` va a seguir diciendo lo mismo que hoy. Con `default '{}'`, esas
-- 2.500 filas afirmarían «el proveedor mandó el desglose y estaba vacío» — una mentira sobre 2.500
-- filas, escrita por una decisión de conveniencia.
--
-- Son TRES estados y los tres mandan a hacer cosas distintas:
--
--     null                    no se leyó (fila anterior a esta columna, o el proveedor omitió
--                             `results` porque el anuncio no entregó)
--     {}                      se leyó y el proveedor mandó el desglose vacío
--     {"videoView": 0}        el proveedor dijo cero
--     clave ausente adentro   ese tipo no ocurrió — y NO es cero: una pieza estática no tiene
--                             `videoView` nunca, así que no entra en ningún denominador

comment on column negocio.metricas_de_anuncio.acciones is
  'El desglose por tipo de accion que el proveedor manda en `results`, normalizado a numeros por el colector. NULABLE con TRES estados: null = no se leyo; {} = el proveedor lo mando vacio; {"videoView":0} = dijo cero. Una clave AUSENTE dentro del objeto significa que ese tipo no ocurrio, que NO es cero y no entra en ningun denominador. Sin check de vocabulario: el catalogo es de Meta, ~45 valores observados el 2026-09-18 y puede crecer. Todos los valores son numericos por construccion, para que un cast en la consulta no pueda lanzar 22P02.';


-- ═══ 3 · NINGÚN ÍNDICE, Y EL MOTIVO ══════════════════════════════════════════
--
-- La consulta de la pantalla filtra por `(org_id, fecha)` y agrega después; eso ya lo sirve
-- `metricas_de_anuncio_por_ventana`, que la `050` creó. Un índice GIN sobre el `jsonb` sería peso
-- en cada escritura del cron a cambio de una consulta que no existe — el argumento que la `052`
-- dejó escrito, al revés: allá el índice se agregó el día que aparecieron sus cinco consumidores.
--
-- El día que haga falta buscar POR tipo de acción —«qué piezas tienen `videoView`»— hará falta un
-- GIN, y ese día se agrega con la consulta que lo justifica al lado.


-- ═══ 4 · LO QUE ESTE ARCHIVO NO PUEDE HACER ══════════════════════════════════
--
-- **No rellena.** Con RLS forzada el migrador ve cero filas, así que un `update` sobre
-- `negocio.metricas_de_anuncio` reportaría éxito sin escribir nada. Es la regla que la `050` § 3 ya
-- había dejado escrita.
--
-- Y hay algo peor que eso, que conviene decir acá porque es donde alguien lo va a buscar: **el
-- histórico no se puede rellenar tampoco desde el cron.** `diasQuePedir` sólo repide los días sin
-- ninguna fila, y cambiar la señal a «días sin desglose» no alcanza: el tramo fijo de tres días ya
-- consume el presupuesto entero, así que ningún día de hueco correría nunca. El relleno es una
-- pasada deliberada y única, fuera del cron, con `piezas.guardados` vacío. Son ~390 llamadas,
-- una sola vez, igual que el relleno original de la `050`.
--
-- Mientras tanto, la pantalla tiene DOS fechas de inicio y las dos se publican: el gasto arranca el
-- 2026-08-18 y el desglose arranca el día de esta migración. Decir «30 días» mientras el hook rate
-- habla de tres es una afirmación falsa sobre el alcance de la cifra.


-- ═══ 5 · SIN RLS NUEVA, Y POR QUÉ NO HACE FALTA ══════════════════════════════
--
-- Este archivo no crea ninguna tabla: `negocio.metricas_de_anuncio` ya pasó por
-- `negocio.aplicar_aislamiento` en la `050`, y su política, sus permisos y su `force row level
-- security` siguen puestos. Las cinco comprobaciones de la `008` son sobre la forma de la tabla
-- —`org_id` primero en la clave, índices únicos que la contengan, foráneas con `org_id` de los dos
-- lados— y agregar una columna nulable no toca ninguna.
--
-- Y por lo mismo no hace falta el `drop policy if exists` de la regla de reaplicabilidad: no se
-- crea ninguna política. El `add column if not exists` hace este archivo reaplicable por sí solo.
