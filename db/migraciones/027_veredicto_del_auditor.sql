-- El VEREDICTO del auditor: su tabla padre, y las columnas que le faltaban a `hallazgos`.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- POR QUÉ HACEN FALTA DOS TABLAS Y NO UNA
--
-- Porque el auditor tiene **dos salidas independientes en las dos direcciones**, y confundirlas es el
-- defecto original que este módulo existe para arreglar:
--
--   · **La intervención** — hay daño en curso: un humano tiene que tomar ESTA conversación ahora.
--   · **El hallazgo** — algo que se puede corregir en el PROMPT del agente.
--
-- Puede haber hallazgos sin intervención —el daño ya ocurrió y el contacto se fue tranquilo— y puede
-- haber intervención sin ningún hallazgo —el contacto está enojado con el precio y el agente lo manejó
-- bien, pero alguien tiene que llamarlo—.
--
-- Que fueran una sola cosa hacía que un *«podría ser más breve»* le apagara el agente a una persona
-- real. Así que el veredicto es una fila y los hallazgos son cero o más filas hijas.
--
-- ── `negocio.hallazgos` YA EXISTÍA, VACÍA Y SIN UN SOLO `check` ─────────────
--
-- La creó la migración 011 diciendo *«los escribe un analizador que este sistema todavía no tiene»*.
-- Tiene diez columnas, aislamiento aplicado, y su índice parcial de abiertos. Lo que le falta es la
-- mitad que el veredicto necesita, y **cero restricciones**: `categoria` y `severidad` son `text`
-- libre, que es una anomalía respecto del resto del esquema —`mensajes.direccion`, `mensajes.autor` y
-- `notas.origen` sí las tienen—.
-- ═════════════════════════════════════════════════════════════════════════════


-- ═════════════════════════════════════════════════════════════════════════════
-- 1 · negocio.analisis_del_agente — el veredicto
-- ═════════════════════════════════════════════════════════════════════════════

create table negocio.analisis_del_agente (
  org_id  uuid not null references identidad.organizaciones(id),
  id      uuid not null default gen_random_uuid(),

  contacto_id  uuid not null,

  -- ── QUÉ AUDITOR LO PRODUJO ────────────────────────────────────────────────
  --
  -- Los DOS de chat, y la lista se amplía con una migración el día que exista otro.
  --
  -- Tienta admitir ya los cuatro —los dos de chat y los dos de voz— para no migrar después. **No se
  -- hace, y el motivo es un defecto medido de la plataforma anterior:** su base aceptaba los cuatro y
  -- el código que registraba un ajuste validaba contra una lista escrita a mano con los dos de chat,
  -- así que un patrón de voz devolvía «agente inválido» y su reincidencia no se podía calcular nunca.
  -- Dos listas del mismo hecho divergen en silencio.
  --
  -- Con la lista acá y una sola derivación en el código, agregar un auditor es un acto deliberado que
  -- aparece en un diff. Es la misma decisión que la 023 escribió para las pestañas.
  agente  text not null check (agente in ('chat_post_agenda', 'chat_pre_agenda')),

  -- ── LA PRECONDICIÓN: ¿esta conversación se puede juzgar? ───────────────────
  --
  -- Corta ANTES de evaluar nada. Sin ninguna línea del agente no hay nada que auditar, y **bajo
  -- ninguna circunstancia eso es una falla del agente: es la ausencia de un agente**.
  auditable  boolean not null,
  -- Por qué no. Solo cuando `auditable` es falso; lo garantiza el `check` de abajo.
  no_auditable_motivo  text,

  -- ── SALIDA 1 · LA INTERVENCIÓN ────────────────────────────────────────────
  intervencion  boolean not null default false,
  -- El motivo es **una frase concreta de ESTA conversación**, no «requiere revisión»: la va a leer el
  -- vendedor en su cola de urgencias y tiene que saber qué pasó sin abrir el chat.
  motivo    text,
  -- Qué criterio disparó. Se valida contra la lista de la rúbrica DEL TERRITORIO en el código, no acá:
  -- son dos listas de siete y meter las catorce en un `check` dejaría pasar el cruce que este módulo
  -- vino a evitar — medido en los datos de la plataforma anterior, donde apareció un criterio de
  -- pre-agenda en análisis de agentes de post-agenda.
  criterio  text,

  -- ── SALIDA 2 · EL VEREDICTO DE TRES NIVELES ───────────────────────────────
  --
  -- `null` es **la ausencia de veredicto, no un cuarto nivel**. Lo producen tres casos: una
  -- conversación no auditable, una siembra de línea base, y los análisis anteriores a que los niveles
  -- existieran.
  nivel  text check (nivel in ('verde', 'amarillo', 'rojo')),

  -- El resumen SE ESCRIBE SIEMPRE, incluso cuando la conversación no es auditable. Ahí es lo único
  -- que se puede decir, y es exactamente lo que hay que decir: *«la llamada duró 19 segundos: el
  -- agente saludó, el contacto respondió una palabra y se cortó»*. Un verde que solo dice «verde» no
  -- le sirve a nadie.
  resumen  text not null,

  -- ── EL VERDE SE SOSTIENE, O NO ES UN VERDE ────────────────────────────────
  --
  -- Un verde MEDIDO y una conversación SIN AUDITAR se veían iguales, y distinguirlos fue toda la razón
  -- del cambio. Así que el verde tiene una obligación simétrica a la del amarillo: qué hizo bien, y la
  -- línea exacta del agente que lo demuestra.
  --
  -- **Van juntos o no van**, y lo hace cumplir el `check`. Un mérito afirmado sin la línea que lo
  -- respalda es la misma clase de dato que un hallazgo sin cita — **y es peor, porque nadie audita un
  -- elogio**.
  destacado  text,
  evidencia  text,

  -- ── LAS OBSERVACIONES: describen, no imputan ──────────────────────────────
  --
  -- Y sus tres estados, que es la regla que atraviesa el producto:
  --
  --     null  →  NO se pidieron (conversación no auditable, o una fila del carril amarillo)
  --     []    →  se pidieron y no hubo ninguna. **Un hecho medido**
  --     [ … ] →  las que hubo
  --
  -- Escribir `[]` siempre borraría la diferencia. Un hallazgo IMPUTA; una observación DESCRIBE, no
  -- tiene código de patrón, no tiene corrección, y **no mueve el nivel**.
  observaciones  jsonb,

  -- Del CONTACTO, no del agente, e independiente de todo lo demás.
  sentimiento  text check (sentimiento in ('positivo', 'neutral', 'molesto')),

  -- ── TRAZABILIDAD: cómo se llegó a gastar esta inferencia ──────────────────
  --
  -- `siembra` no es un análisis: es la marca de dónde arrancar a contar, para un contacto que ya
  -- tenía conversación cuando se encendió el auditor. Va sin nivel, sin resumen del modelo y sin
  -- observaciones, y **las vitrinas la excluyen**: inventarle un resumen llenaría la pantalla de
  -- filas que dicen algo sobre nada.
  disparo  text not null check (disparo in ('debounce', 'alarma', 'manual', 'siembra')),

  -- Cuál de las cinco señales adelantó el análisis. **`null` cuando salió por el debounce normal, y
  -- no una lista vacía:** «nadie miró alarmas» y «se miraron y no había» no son el mismo hecho.
  --
  -- Se guarda desde el primer día para poder medir cuál sirve: una señal que dispara seguido y NUNCA
  -- termina en rojo es gasto puro, y sin este dato no hay forma de saber cuál sacar.
  alarmas  text[],

  -- El modelo REAL con el que se juzgó. Si mañana cambia, los análisis viejos siguen diciendo con qué
  -- se produjeron. Nulo solo en la siembra, que no llama al modelo.
  modelo  text,
  -- Qué versión del prompt del agente vio el auditor. Es lo que después permite avisar que **el
  -- fragmento citado puede ya no existir**. Nulo = esa empresa no tenía prompt cargado.
  prompt_hash  text,

  -- ── LA LÍNEA BASE DEL DEBOUNCE ────────────────────────────────────────────
  --
  -- Cuántos mensajes del agente había cuando se analizó. El próximo análisis **resta** contra este
  -- número en vez de leer un contador que alguien tenga que acordarse de incrementar.
  --
  -- La resta se auto-cura: las dos puntas salen de la misma fuente, así que si aparecen o desaparecen
  -- mensajes —una carga masiva de históricos, el borrado de duplicados que hace la ingesta— **se
  -- mueven juntas**. Una columna incremental se desincroniza con las dos cosas.
  mensajes_del_agente  integer not null,

  analizado_el  timestamptz not null default now(),

  primary key (org_id, id),
  foreign key (org_id, contacto_id) references negocio.contactos (org_id, id) on delete cascade,

  -- ═══════════════════════════════════════════════════════════════════════════
  -- LAS CUATRO INVARIANTES, Y POR QUÉ LAS HACE CUMPLIR LA BASE
  --
  -- El nivel **se deriva en código** y no se le cree al modelo. Estas restricciones son la otra mitad:
  -- vuelven el estado inválido **inescribible**, en vez de depender de la disciplina de quien escriba
  -- el próximo `insert`.
  --
  -- Y hay un costo que conviene saber: cada restricción es una forma de **perder una inferencia ya
  -- pagada**. Por eso son cuatro y no doce — solo las que la documentación del módulo nombra como
  -- invariantes, no las convenciones del escritor.
  -- ═══════════════════════════════════════════════════════════════════════════

  -- 1 · `rojo ⟺ pide intervención`. Es la definición de rojo.
  --
  -- El `coalesce` es lo que la hace correcta con el nivel nulo: sin él, `null = true` da `null`, y un
  -- `check` que devuelve nulo **pasa** — o sea que un análisis sin veredicto podría pedir una
  -- intervención. Con el `coalesce`, ese estado queda rechazado.
  --
  -- Se cumplió perfecto en los 59 análisis reales de la plataforma anterior: los 2 rojos fueron los 2
  -- únicos con intervención. Vale hacerla inescribible.
  constraint analisis_rojo_es_intervencion
    check ((coalesce(nivel, '') = 'rojo') = intervencion),

  -- 2 · Una conversación no auditable **no tiene veredicto**. Y de esta más la 1 sale gratis que
  --     tampoco pueda pedir intervención, que es lo que la precondición exige.
  constraint analisis_no_auditable_sin_nivel
    check (auditable or nivel is null),

  -- 3 · No se pueden guardar observaciones sobre un análisis no auditable. **Observar algo de una
  --     conversación que el propio auditor declaró imposible de juzgar es juzgarla.**
  constraint analisis_no_auditable_sin_observaciones
    check (auditable or observaciones is null),

  -- 4 · El destacado y su evidencia van juntos o no van. Ver el bloque de arriba.
  constraint analisis_destacado_con_evidencia
    check ((destacado is null) = (evidencia is null)),

  -- Y el motivo es el de la intervención: sin intervención no hay motivo que dar.
  constraint analisis_motivo_solo_con_intervencion
    check (intervencion or motivo is null),

  -- El motivo de no-auditable, al revés: solo cuando no es auditable.
  constraint analisis_motivo_de_no_auditable
    check (auditable = (no_auditable_motivo is null))
);

-- Las vitrinas de la pantalla leen por agente y por ventana de tiempo.
create index analisis_por_agente
  on negocio.analisis_del_agente (org_id, agente, analizado_el desc);

-- Y el debounce lee el ÚLTIMO análisis de un contacto para restar contra su línea base. Es la consulta
-- más frecuente del módulo: corre una vez por candidato en cada ciclo del barrido.
create index analisis_por_contacto
  on negocio.analisis_del_agente (org_id, contacto_id, analizado_el desc);

select negocio.aplicar_aislamiento('negocio.analisis_del_agente');


-- ═════════════════════════════════════════════════════════════════════════════
-- 2 · negocio.hallazgos — lo que le faltaba
-- ═════════════════════════════════════════════════════════════════════════════

alter table negocio.hallazgos
  -- El veredicto padre. **`not null`**: un hallazgo sin el análisis que lo produjo no tiene contexto —
  -- ni el transcript que lo prueba, ni el prompt contra el que se juzgó, ni de qué agente es.
  --
  -- Se puede poner `not null` de entrada porque la tabla está **vacía en las dos bases**, medido el
  -- 2026-08-31: 0 filas en local y 0 en producción.
  add column if not exists analisis_id  uuid not null,

  -- Qué auditor lo encontró. Se repite acá y no se lee del padre a propósito: la pantalla del técnico
  -- agrupa por `(agente, patrón)` y esa consulta corre sobre esta tabla.
  add column if not exists agente  text not null,

  -- ── EL CÓDIGO DE PATRÓN, que es lo que hace útil la pantalla ──────────────
  --
  -- **Agrupa casos iguales bajo un mismo nombre, así el técnico ve «×15 casos» en vez de quince
  -- problemas sueltos.** Por eso la lista de patrones ya detectados viaja en el contexto del modelo,
  -- con la orden de reusar el código exacto aunque él lo hubiera nombrado distinto.
  --
  -- El formato **lo valida la base** y lo normaliza el código, y eso es deliberado: el esquema de
  -- salida del modelo NO lleva patrones de texto ni largos mínimos. Un código que no sobreviva la
  -- normalización **descarta el hallazgo, no el análisis** — tirar el hallazgo es mejor que tirar la
  -- inferencia entera.
  --
  -- Describe LA FALLA, no la conversación: `promete_financiamiento_inexistente` sí,
  -- `caso_juan_perez` no.
  add column if not exists patron  text not null,

  -- Qué criterio de la rúbrica disparó. Como en el padre, se valida contra la lista del territorio en
  -- el código.
  add column if not exists criterio  text,

  -- ── LA CORRECCIÓN AL PROMPT, y su discriminante ESTRUCTURAL ───────────────
  --
  -- Las dos ramas:
  --
  --   · **Con prompt cargado** → cita el texto exacto y literal que causa la falla, y la corrección es
  --     un reemplazo listo para pegar, en el mismo idioma y formato que el resto del prompt.
  --   · **Sin prompt cargado** → el fragmento queda vacío y la corrección es una instrucción autónoma
  --     que empieza indicando a qué sección debería ir.
  --
  -- **Y NO hay una columna que diga cuál de las dos es.** Que haya fragmento citado significa que el
  -- auditor tenía el prompt; que no lo haya significa que la corrección es una instrucción para
  -- agregar. El dato ya lo dice.
  --
  -- La plataforma anterior tenía esa columna —`correccion_tipo`— y su propia documentación la
  -- desautoriza: *«nunca un campo "es nuevo"»*. Un discriminante duplicado se desincroniza del dato
  -- que describe, y entonces la pantalla dibuja «reemplazo» sobre un fragmento vacío.
  add column if not exists fragmento_prompt  text,
  add column if not exists prompt_seccion    text,
  add column if not exists correccion        text not null,

  -- Qué versión del prompt vio el auditor cuando encontró esto. Sostiene dos cosas: el aviso de que
  -- **el fragmento citado puede ya no existir**, y el descarte de duplicados del carril amarillo.
  add column if not exists prompt_hash  text,

  -- ── LAS DOS CITAS ─────────────────────────────────────────────────────────
  --
  -- La del agente es **obligatoria**: *«cada hallazgo exige una cita textual. Si no se puede copiar la
  -- línea exacta que lo prueba, el hallazgo no existe y no se reporta.»* Es la línea imputable, y sin
  -- ella la recomendación no se puede verificar ni discutir.
  --
  -- La del contacto es opcional acá y **obligatoria por código en el carril amarillo**, cuya pregunta
  -- es justamente si el agente leyó la señal del lead: sin las dos citas no hay nada que comparar.
  add column if not exists evidencia_agente    text not null,
  add column if not exists evidencia_contacto  text;

-- ── Y LAS RESTRICCIONES QUE ESTA TABLA NO TENÍA ────────────────────────────
--
-- Tenía `categoria text` y `severidad text` libres desde 2011. Ahora son vocabularios cerrados, por
-- lo mismo que `mensajes.autor` y `notas.origen`: un valor mal escrito guardaría una fila que ninguna
-- consulta lee, y el síntoma sería «el auditor no encontró nada» con la fila ahí.

-- Y las cinco se sueltan antes de reponerlas. **PostgreSQL no tiene `add constraint if not exists`**,
-- así que si alguien aplica este SQL a mano —como pasó con la 023 y la 024 en producción— el corredor
-- muere con **42710** y, como Kysely mete todas las pendientes en UNA transacción, se lleva puestas a
-- las demás. La regla está fijada desde la 024 y hay una prueba que corre el SQL para comprobarla:
-- fue esa prueba la que atrapó esta migración antes de que existiera este bloque.
alter table negocio.hallazgos
  drop constraint if exists hallazgos_severidad_check,
  drop constraint if exists hallazgos_categoria_check,
  drop constraint if exists hallazgos_agente_check,
  drop constraint if exists hallazgos_patron_check,
  drop constraint if exists hallazgos_analisis_fk;

alter table negocio.hallazgos
  -- `rojo` le cuesta clientes o le da información falsa a la gente. `amarillo` le baja la conversión
  -- o la calidad, **sin daño directo**.
  --
  -- Y hay que decirlo porque se confunde: **un hallazgo puede ser rojo sin que la conversación
  -- requiera intervención** —el daño ya ocurrió y el contacto se fue tranquilo— y puede haber
  -- intervención con hallazgos solo amarillos. Severidad ≠ intervención.
  add constraint hallazgos_severidad_check
    check (severidad in ('rojo', 'amarillo')),

  add constraint hallazgos_categoria_check
    check (categoria in ('comportamiento', 'base_conocimiento', 'informacion_adicional')),

  add constraint hallazgos_agente_check
    check (agente in ('chat_post_agenda', 'chat_pre_agenda')),

  -- El formato del código de patrón. Minúsculas, dígitos y guiones bajos; 3 a 48 caracteres. Sin
  -- acentos y sin espacios, para que sea una clave de agrupamiento y no una frase.
  add constraint hallazgos_patron_check
    check (patron ~ '^[a-z0-9_]{3,48}$'),

  add constraint hallazgos_analisis_fk
    foreign key (org_id, analisis_id)
    references negocio.analisis_del_agente (org_id, id) on delete cascade;

-- La consulta de la cola de urgentes: los hallazgos ABIERTOS de un contacto, para poner el motivo
-- real en vez del texto de reserva. El índice que había —`hallazgos_abiertos`— ordena por fecha sobre
-- toda la empresa y no sirve para buscar por contacto.
create index if not exists hallazgos_por_contacto
  on negocio.hallazgos (org_id, contacto_id, detectado_el desc);
