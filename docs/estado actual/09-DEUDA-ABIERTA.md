# Deuda abierta

**Fecha de corte: 2026-09-15.** Cada punto lleva la consulta que lo midió, para que dentro de un mes
se pueda volver a correr y ver si creció, se arregló solo, o dejó de importar.

**Y algunas cifras llevan además la hora, que no es un floreo.** Tres lecturas del mismo día
encontraron 478, 479 y 478 mensajes en curso, y 430, 432 y 435 fallidos; el denominador de la
tarjeta de citas pasó de 127 a 128 sin que entrara un dato, sólo porque una cita programada cruzó la
hora actual. Donde una cifra se mueve así está escrita **con su instante de medición** y no en
presente absoluto, porque en presente absoluto la lectura siguiente la desmiente y el documento
entero pierde crédito por un número que nunca estuvo mal.

Esto NO es una lista de deseos. Es lo que está roto o incompleto **hoy**, con su consecuencia
concreta. Lo que sería lindo tener vive en los informes de cada departamento.

**Las consultas de acá abajo van a treinta días y no a catorce.** La pantalla dejó de tener una sola
ventana: son cuatro botones —hoy, 7 días, 30 días, completo— y la que se dibuja al abrirla es la de
treinta (`lib/negocio/periodo.ts:109`). Eso no es un detalle de presentación: una ventana más ancha
no es una muestra más grande, y dos de los puntos de acá abajo cambiaron de tamaño **sin que cambiara
un solo dato**, sólo porque se corrió el borde.

Y conviene decir lo que no pasó, porque una lista que se acorta sola es lo primero que uno busca:
**ninguno de estos puntos se cerró.** El rediseño de Conversation no tocó ni el barrido de contactos,
ni el de citas, ni las dos tablas de prompts —cada punto de abajo trae el archivo y la línea donde se
comprueba—. Lo que sí hizo fue **mover el borde de la ventana**, y eso agrandó dos de los agujeros
sin tocarlos.

**Y agregó uno.** El § 5 es de código publicado hoy: el campo `desde`, que se escribió justamente
para impedir que «Completo» se lea como historia, produce esa lectura en Lead Flow. Una lista de
deuda que sólo hereda es una lista que no está mirando lo último que se hizo.

---

## 1 · Dos agujeros de integridad del barrido

Son los dos más caros porque **no fallan**: producen cifras plausibles sobre datos viejos.

### 1.1 · Veinticinco contactos congelados que no vuelven solos

`lib/negocio/sincronizar.ts:296` → `congelarLosQueYaNoEstan` pone `territorio = null` cuando un
contacto pierde sus dos etiquetas de zona —es un `.set({ territorio: null })` y nada más—, y **no
toca `sincronizado_el`**. Como la búsqueda del barrido es POR ETIQUETA, `guardar()` no vuelve a
correr sobre esa fila nunca más.

Tres consecuencias, las tres medidas:

- Su `sincronizado_el` **afirma una frescura que es de hace entre 3,9 y 21,8 días** (al 2026-09-15
  18:17 UTC; son edades, así que crecen un día por día que pase sin que nada cambie). La columna miente.
- Nunca recibieron las cinco columnas de la migración `048`: los 25 tienen `atribucion_primera = '{}'`
  (el valor por omisión, nunca escrito), 24 de 25 tienen `campos_del_crm` vacío, y los 25 tienen
  `zona_horaria_del_lead` nula.
- **Son invisibles para todas las cohortes de Lead Flow y de atribución**, porque esas cohortes se
  arman con `alta_en_el_crm >= …` y un nulo no satisface un `>=`. Nada lo dice en pantalla.

Y crece: 5 la semana del 24-ago, 18 la del 31-ago, 2 la del 7-sep. Al más reciente se lo dejó de
mirar hace 3,9 días — y esa es la fecha que hay, no la del congelamiento, porque la columna que la
diría es justamente la que no se escribe. Que la cuenta esté quieta desde entonces no es una
corrección: nada cambió en el código, y que aparezca el número 26 depende sólo de que alguien le
saque una etiqueta de zona a alguien.

```sql
select count(*) total,
       count(*) filter (where territorio is null) congelados,
       count(*) filter (where alta_en_el_crm is null) sin_alta,
       count(*) filter (where territorio is not null and alta_en_el_crm is null) activos_sin_alta
from negocio.contactos;
-- 2026-09-15: 584 · 25 · 25 · 0   ← los congelados y los sin alta son EXACTAMENTE los mismos

select round(min(extract(epoch from (now() - sincronizado_el)) / 86400)::numeric, 1) mas_fresco,
       round(max(extract(epoch from (now() - sincronizado_el)) / 86400)::numeric, 1) mas_viejo
from negocio.contactos where territorio is null;
-- 2026-09-15 18:17 UTC: 3,9 · 21,8 días
```

**Sólo se descongelan por dos vías, y ninguna es el paso del tiempo:** que la etiqueta de zona
reaparezca en el CRM, o que alguien abra su ficha — pero un congelado no aparece en ninguna cola, así
que nadie navega hasta él.

Lo mínimo que haría falta: que `congelarLosQueYaNoEstan` escriba `sincronizado_el`, para que la fila
al menos diga cuándo dejó de mirarse. Lo correcto: pedirlos por identificador cada tanto con
`contactoPorId`, que ya existe y lo usa `refrescarUnContacto`.

### 1.2 · Las citas no tienen resta, y el accidente que lo tapaba dejó de tapar

`lib/negocio/citas.ts` no tiene equivalente de `congelarLosQueYaNoEstan` —436 líneas, cero
apariciones de `congelar` y cero de `deleteFrom`—. Una cita que el CRM deja de listar —borrada, o
movida a un calendario que no listamos— **conserva su último `estado_ghl` para siempre y sigue
contando** en todas las cifras.

A catorce días esto casi no se veía: 12 citas sin refrescar, y 11 de las 12 anteriores a la migración
`038` —la que agregó `ghl_calendario_id`, del 2026-09-07—. Sin esa columna el filtro `alcanzable` las
tapaba. Una sola estaba adentro.

**A treinta días son 37, y las 37 están adentro.** Todas tienen calendario, ninguna es de contacto
descartado, así que **las 37 caen dentro de las 128 citas que la tarjeta de Appointment Flow
titula**. No hizo falta que llegara una cita nueva para que el accidente dejara de protegernos:
alcanzó con que la ventana por omisión pasara de catorce días a treinta.

Ese denominador lleva hora y no sólo fecha, y no por prudencia: el módulo cierra la ventana con
`inicio_el < now()` (`lib/negocio/indicadoresDeCitas.ts:392`), así que **sube solo cada vez que una
cita programada cruza la hora actual, sin que entre un dato nuevo**. Medido a las **18:17 UTC del
2026-09-15: 128**; unas horas antes, 127.

Y llega hasta la cifra publicada: **19 de las 52 canceladas que producen el 40,6 % de cancelación no
se vuelven a leer desde hace más de tres días**, la más vieja hace 7,6. No se afirma que esas 19
estén mal. Se afirma que **no hay forma de saber si lo están**, que es otra cosa. (La tasa también
se mueve sola con el denominador: las mismas 52 canceladas daban 40,9 % sobre 127.)

35 de las 37 son de contactos vivos, sincronizados en las últimas 24 horas: el contacto se refresca y
su cita no, en la misma fila de la misma pantalla.

```sql
select v.dias,
       count(*) filter (where c.sincronizado_el < now() - interval '3 days') sin_refrescar,
       count(*) filter (where c.sincronizado_el < now() - interval '3 days'
                          and c.ghl_calendario_id is null) tapadas_por_el_filtro,
       count(*) filter (where c.sincronizado_el < now() - interval '3 days'
                          and c.ghl_calendario_id is not null) dentro_del_denominador
from (values (14), (30), (3650)) v(dias)
join negocio.citas c on c.inicio_el >= now() - make_interval(days => v.dias)
                    and c.inicio_el <  now()
group by v.dias order by v.dias;
-- 2026-09-15:  14d → 12 · 11 · 1   |   30d → 114 · 77 · 37   |   completo → 138 · 101 · 37
```

Y las tres cifras del párrafo anterior —el denominador, la tasa de cancelación con sus 19 sin
refrescar, y los 35 de contacto vivo— con su consulta, que es lo que permite volver a correrlas:

```sql
-- El denominador de la tarjeta y la cancelación, con el mismo filtro que el módulo.
select to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI') medido_utc,
       count(*) citas,
       count(*) filter (where lower(coalesce(c.estado_ghl, '')) = 'cancelled') canceladas,
       round(100.0 * count(*) filter (where lower(coalesce(c.estado_ghl, '')) = 'cancelled')
             / nullif(count(*), 0), 1) tasa,
       count(*) filter (where lower(coalesce(c.estado_ghl, '')) = 'cancelled'
                          and c.sincronizado_el < now() - interval '3 days') canceladas_sin_refrescar,
       round(max(extract(epoch from (now() - c.sincronizado_el)) / 86400)
             filter (where lower(coalesce(c.estado_ghl, '')) = 'cancelled'
                       and c.sincronizado_el < now() - interval '3 days')::numeric, 1) peor_dias
from negocio.citas c
where c.inicio_el >= now() - interval '30 days' and c.inicio_el < now()
  and c.ghl_calendario_id is not null
  and not exists (select 1 from negocio.contactos ct, unnest(ct.etiquetas) e
                  where ct.org_id = c.org_id and ct.id = c.contacto_id
                    and lower(e) = any (array['icp_rechazado', 'rechazado', 'rechazado_positivo',
                                              'rechazado_negativo', 'no calificado', 'descalificado']));
-- 2026-09-15 18:17 UTC: 128 · 52 · 40,6 · 19 · 7,6

-- Las 37 de la ventana de treinta días: cuántas son de contacto descartado y cuántas de contacto
-- refrescado en las últimas 24 horas. El descarte va acá y no en la consulta de arriba a propósito:
-- lo que se quiere saber es si alguna de las 37 se cae por esa puerta.
select count(*) sin_refrescar,
       count(*) filter (where ct.sincronizado_el > now() - interval '24 hours') contacto_fresco,
       count(*) filter (where exists (select 1 from unnest(ct.etiquetas) e
                                      where lower(e) = any (array['icp_rechazado', 'rechazado',
                                            'rechazado_positivo', 'rechazado_negativo',
                                            'no calificado', 'descalificado']))) de_descartado
from negocio.citas c
join negocio.contactos ct on ct.org_id = c.org_id and ct.id = c.contacto_id
where c.inicio_el >= now() - interval '30 days' and c.inicio_el < now()
  and c.sincronizado_el < now() - interval '3 days' and c.ghl_calendario_id is not null;
-- 2026-09-15: 37 · 35 · 0
```

---

## 2 · Lo que está bloqueado por falta de datos

Ninguno de estos es un problema de código. Los cuatro tienen su medición, y hasta que el número
cambie no hay nada que construir.

| Qué | Por qué está bloqueado | Medición |
|---|---|---|
| `issue_source` (§11.4) — si falló el agente o el prompt | `negocio.prompts_del_agente` tiene **0 filas**, así que el auditor no recibe el prompt vigente contra el cual distinguir un fallo de ejecución de uno de diseño | `select count(*) from negocio.prompts_del_agente` → 0 |
| Medición de impacto (§14) | `negocio.versiones_del_prompt` tiene **0 filas**: no hay línea base ni «después» que comparar | `select count(*) from negocio.versiones_del_prompt` → 0 |
| El embudo del formulario de la landing (§9.7) | El campo `Form Landing VSL` existe en `campos_del_crm` y está **congelado desde el 2026-08-31 00:57**. La ventana de catorce días no alcanza ni un contacto con el campo; la de treinta alcanza 137 de 409 a las 18:17 UTC del 2026-09-15, porque llega hasta antes del congelamiento. **Esa cobertura no crece: se achica sola** a medida que el borde avanza — y se pudo ver en el día: horas antes eran 140 de 412, y el 2026-09-30 vuelve a ser cero | `select count(*) filter (where campos_del_crm ? 'XqOfGEWle6fay7hPuvWp') con_campo, count(*) cohorte from negocio.contactos where alta_en_el_crm >= now() - interval '30 days'` → **137 de 409** a las 18:17 UTC (a 14 días: 0 de 229) |
| Trigger link: enviado y abierto (§9.5) | No tenemos señal propia. **Pero hay una pista que conviene seguir antes de construir un redirector**: `sessionSource` vale literalmente `Trigger Link` en 32 de las 206 citas alcanzables de la ventana de treinta días (18:17 UTC; el denominador sube solo, ver § 1.2), o sea que GoHighLevel ya los usa y no le estamos pidiendo sus eventos. Con una corrección que importa: **vive en `atribucion_ultima`, y la pantalla lee `atribucion_primera`** (`lib/negocio/atribucionDelLead.ts:124`), donde `Trigger Link` no aparece ni una vez en las 584 filas. La atribución que se dibuja no lo ve | Por contacto: `select atribucion_ultima->>'sessionSource', count(*) from negocio.contactos group by 1` → Trigger Link **29**, las 29 con cita. Por cita, uniendo `negocio.citas` alcanzables de 30 días con su contacto → **32 de 206** a las 18:17 UTC. En `atribucion_primera`, las 584 filas se reparten en Paid Social 360, Social media 158, Direct traffic 24, CRM UI 2 y 40 sin fuente: **cero** |

---

## 3 · El show rate: el KPI principal del §10.3 está vacío, y no por falta de código

Va aparte y no en la tabla de arriba por dos razones: es el **KPI principal** de una de las dos
pestañas, y no está bloqueado por nada que haya que construir. La columna existe, la pantalla que la
escribe existe y está probada, la pantalla que la lee ya la dibuja. Lo que falta es que alguien la
use.

El §10.3 pide la tasa de asistencia. Las tres vías por las que podría venir están en cero, sobre las
317 citas de la tabla entera:

| Vía | Dónde | Cuántas |
|---|---|---|
| `citas.asistio is not null` — alguien cerró el intento | migración `049`, la escribe `lib/negocio/avanzar.ts:248` | **0 de 317** |
| `citas.asistio is true` — y dijo que sí vino | idem | **0 de 317** |
| `estado_ghl = 'showed'` — lo dijo el CRM | lo trae el barrido de citas | **0 de 317** |

`asistio is false` también es 0, así que **ni siquiera hay un «no vino» registrado por un closer**: no
es que la tasa dé bajo, es que no hay denominador. Lo que existe en la base sobre si alguien apareció
son 10 citas con `estado_ghl = 'noshow'` (2026-09-15 18:52 UTC) y 2 resultados con
`salida = 'no_show'`, y los dos son el plantón: nadie dejó escrito ni una vez que un contacto SÍ se
presentó.

```sql
select count(*) resultados, count(*) filter (where salida = 'no_show') no_show
from negocio.resultados;
-- 2026-09-15: 7 · 2

select count(*) citas,
       count(*) filter (where asistio is not null) asistio_no_nulo,
       count(*) filter (where asistio is true)     asistio_true,
       count(*) filter (where asistio is false)    asistio_false,
       count(*) filter (where lower(coalesce(estado_ghl, '')) = 'showed') showed,
       count(*) filter (where lower(coalesce(estado_ghl, '')) = 'noshow') noshow
from negocio.citas;
-- 2026-09-15 18:52 UTC: 317 · 0 · 0 · 0 · 0 · 10
```

**Y ese 10 es de hoy: el calendario empezó a mandar asistencia mientras se escribía esto.** Eran 3
hasta las 18:04 UTC. El único cambio de estado que `estado_cambiado_el` registró en toda su historia
es `confirmed` → `noshow`, y empezó a las 18:04:07 UTC del 2026-09-15: antes de ese día la columna
estaba vacía.

**Esto no habilita el show rate, y conviene decirlo antes de que alguien lo intente.** `asistio` sigue
en 0 de 317 y `estado_ghl = 'showed'` también, así que `noshow` es el complemento de un dato que no
existe, y diez casos no sostienen una tasa sobre un denominador que nadie definió todavía. Lo que hay
que hacer es volver a medirlo en una semana:

```sql
select lower(coalesce(estado_anterior_ghl, '(nulo)')) venia_de, lower(estado_ghl) esta_en,
       count(*), min(estado_cambiado_el) primero, max(estado_cambiado_el) ultimo
from negocio.citas where estado_cambiado_el is not null group by 1, 2 order by 3 desc;
-- Un solo par en toda la tabla —confirmed → noshow—, desde las 18:04:07 UTC del 2026-09-15.
-- El conteo crece: es justamente lo que hay que volver a mirar.

select lower(coalesce(estado_ghl, '(nulo)')) estado, count(*) from negocio.citas group by 1;
-- 2026-09-15 18:52 UTC: cancelled 160 · confirmed 147 · noshow 10
```

**Y es cero en las cuatro ventanas del selector**, así que no hay botón que lo rescate: el
denominador de la tarjeta va 2 (hoy), 29 (7d), 128 (30d), 128 (completo) —medido a las 18:17 UTC;
ver § 1.2 sobre por qué ese número sube solo— y `con_asistencia` es 0 en las cuatro.

```sql
-- El mismo denominador que la tarjeta: alcanzable (con calendario) y sin contactos descartados.
select v.dias, count(*) citas,
       count(*) filter (where c.asistio is not null) con_asistencia,
       count(*) filter (where lower(coalesce(c.estado_ghl, '')) = 'showed') showed
from (values (1), (7), (30), (3650)) v(dias)
join negocio.citas c
  on c.inicio_el >= now() - make_interval(days => v.dias)
 and c.inicio_el <  now()
 and c.ghl_calendario_id is not null
 and not exists (select 1 from negocio.contactos ct, unnest(ct.etiquetas) e
                 where ct.org_id = c.org_id and ct.id = c.contacto_id
                   and lower(e) = any (array['icp_rechazado', 'rechazado', 'rechazado_positivo',
                                             'rechazado_negativo', 'no calificado', 'descalificado']))
group by v.dias order by v.dias;
-- 2026-09-15 18:17 UTC:  hoy 2 · 0 · 0 | 7d 29 · 0 · 0 | 30d 128 · 0 · 0 | completo 128 · 0 · 0
```

**La pantalla ya lo dibuja como el hueco que es, y eso está bien: es un guion, no un cero.** El
titular de Appointment Flow es `—` con «asistencia · 0 de 128 cerradas» al lado
(`components/conversation/PanelDeConversation.jsx:607-612`), el eslabón «Se presentaron» existe en la
cadena sin barra y con el pie «nadie lo registró» (`:627-633`), y el aviso que explica por qué queda
**visible y no escondido detrás de un ícono** (`:662`). El servidor aplica el mismo criterio:
`tasaDeAsistencia` es `null` por debajo del piso de 10 (`lib/negocio/indicadoresDeCitas.ts:448-451`)
y el denominador filtra `asistio is not null` (`:353`) — sin ese filtro la tasa sería 0 % sobre 128 y
diría, plausible y falsamente, que no se presenta nadie.

**Lo que haría falta para que deje de estar vacío no es código: son closers cerrando intentos.** El
control existe y está cableado de punta a punta, y son **dos preguntas y no una**: el selector de
cita aparece cada vez que el contacto tiene al menos una
(`components/negocio/Avanzar.jsx:138`, `seEligeLaCita = citas.length > 0`), pero la de asistencia
sólo cuando la salida elegida no la contestó ya
(`:139`, `sePreguntaSiVino = seEligeLaCita && !laSalidaYaLoDice`). Cuando sí se pregunta, el rótulo
«¿Se presentó a la cita?» se dibuja en `:324` y una cita elegida sin respuesta no se deja mandar
(`:168`) porque se guardaría como «nadie sabe», que es el estado del que esa pantalla existe para
salir. La ruta exige un booleano (`app/api/contactos/[id]/avanzar/route.ts:186`) y `avanzar.ts:248`
lo escribe.

Y la excepción importa para esta cifra, no es un detalle de formulario: **con la salida `no_show` la
pregunta no se dibuja y `asistio` se guarda igual, en `false`** (`:128` y `:129`,
`respuesta = laSalidaYaLoDice ? false : asistio`), y el mismo rótulo se bifurca a «¿A qué cita no se
presentó?» (`:324`) — se sigue preguntando de cuál cita se habla, y no si vino. O sea que la primera
fila de `asistio` puede entrar **sin que nadie conteste nada**: alcanza con que un closer registre
un plantón.

Que igual siga en cero es coherente con el punto 4: **los 7 resultados que existen son todos
anteriores a la `049`** —los 2 de `salida = 'no_show'` incluidos, por eso tampoco escribieron
`asistio`—, así que nadie cerró un intento desde que la pregunta existe. El primero que se cierre
escribe la primera fila de las dos columnas a la vez.

Y hay una vía que **no** hay que abrir, dicha acá para que nadie la abra buscando llenar la cifra
rápido: `asistio` está deliberadamente fuera del `do update` del barrido, y el módulo lo deja escrito
en el lugar donde alguien la agregaría (`lib/negocio/citas.ts:417`). Si entrara, cada pasada horaria
la pondría en nulo sobre todas las citas y **nada fallaría**: el closer registraría, la cifra
subiría, y una hora después volvería a cero sin un solo error en ninguna parte.

---

## 4 · Columnas que se escriben y nadie lee

`resultados.cita_id` (migración `049`) **tiene 0 filas con dato**: la columna es del 2026-09-14 y los
7 resultados que existen son anteriores —el último es del 2026-09-09—. No hay nada que conectar hasta
que se registren intentos nuevos, y con 7 filas totales cualquier tasa violaría el piso de 10. Es la
otra mitad del punto 3: las dos columnas salen del mismo objeto en la misma transacción —`cita_id` en
`lib/negocio/avanzar.ts:193`, `asistio` en `:248`—, así que están en cero por el mismo motivo y se
llenan con el mismo primer cierre.

```sql
select count(*) resultados, count(cita_id) con_cita,
       min(creado_el)::date desde, max(creado_el)::date hasta
from negocio.resultados;
-- 2026-09-15: 7 · 0 · 2026-08-30 · 2026-09-09
```

Otras que el auditor de columnas encontró y que **no** afectan a ninguna cifra publicada hoy, pero
que conviene conocer antes de agregar una:

- **`mensajes.estado_entrega_familia` se congela.** Sólo se refresca dentro de una ventana de una
  hora desde el envío (`VENTANA_MS` en `lib/negocio/entregas.ts:55`) y a dos mensajes por ciclo
  (`POR_CICLO` en `:52`), sobre la cola que arma `pendientesDeRevision` (`:134`, con sus filtros en
  `:140`, `:141` y `:142`). Medido **el 2026-09-15 a las 18:17 UTC: 478 mensajes en `en_curso` y
  ninguno de ellos dentro de la ventana que esa cola mira**. Ese 478 no es «en tránsito»: es «nunca
  se supo».
- **`fallo_del_canal` casi no se escribe.** En la misma lectura, **435 mensajes con familia
  `fallido` y sólo 3 con motivo**: la ingesta guarda el estado y descarta el texto del canal. El
  auditor arma la marca `[NO ENTREGADO: …]` con una frase genérica en 432 de 435 casos, y el motivo
  es lo único que separa «se dio de baja» de «el número no existe».
- **`citas.inicio_anterior_el`, `estado_anterior_ghl` y `estado_cambiado_el`** no las lee ningún
  archivo de `lib/`, `app/` ni `components/`: se escriben en `lib/negocio/citas.ts:388`, `:408` y
  `:412`. El 2026-09-15 dejaron de estar vacías, y quien las lee es el § 3 de este documento, no una
  pantalla.

**Las dos primeras llevan hora y no sólo fecha, y eso es un hecho medido y no una precaución.** El
mismo 2026-09-15, tres lecturas del mismo par de columnas dieron **478 · 430 · 3**, después
**479 · 432 · 3**, y **478 · 435 · 3** a las 18:17 UTC. Son mensajes del propio día entrando a la
tabla, no un error de lectura — pero escritas en presente absoluto, la lectura siguiente las
desmiente sin que nada se haya roto. Y una afirmación que este documento traía resultó ser de las que
se dan vuelta: «los 478 están todos fuera de la ventana» es cierta a las 18:17 y **era falsa unas
horas antes**, cuando había uno adentro. Lo que no cambia es el punto: la ventana es de una hora y la
cola avanza de a dos, así que lo que no se revisa en esos sesenta minutos no se revisa nunca.

```sql
select to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI') medido_utc,
       count(*) filter (where estado_entrega_familia = 'en_curso') en_curso,
       count(*) filter (where estado_entrega_familia = 'en_curso' and direccion = 'saliente'
                          and id_fabricado = false
                          and enviado_el > now() - interval '1 hour') en_cola,
       count(*) filter (where estado_entrega_familia = 'fallido') fallidos,
       count(*) filter (where estado_entrega_familia = 'fallido'
                          and fallo_del_canal is not null) con_motivo
from negocio.mensajes;
-- 2026-09-15 18:17 UTC: 478 · 0 · 435 · 3
```

---

## 5 · `desde` es exacto en una pestaña y engaña en la otra

Éste no es un agujero heredado: es un defecto del código que se publicó **hoy**. El campo `desde` se
agregó junto con el selector de período, y su comentario dice para qué
(`lib/negocio/indicadoresDelLead.ts:267-269`): *«es lo que impide que “completo” se lea como historia
cuando son tres semanas»*. **En Lead Flow produce exactamente esa lectura.**

En Appointment Flow el campo es `min(inicio_el)` de la población que se está contando —alcanzable y
no descartada— (`lib/negocio/indicadoresDeCitas.ts:378`). Con «Completo» vale **2026-08-24**, y las
128 citas del conteo caen entre esa fecha y hoy: **22 días, sin cola**. La fecha describe el dato.

En Lead Flow el campo es `min(alta_en_el_crm)` **desnudo**, sin el `filter` que lo ate a la población
que se cuenta (`lib/negocio/indicadoresDelLead.ts:270`). Con «Completo» vale **2025-08-08** — y
detrás de esa fecha no hay trece meses de operación, hay **un solo contacto**. La distribución
mensual es una cola finísima y después un acantilado: uno en ago-2025, nada hasta dic-2025, unos
pocos por mes hasta jul-2026, y **casi todo el padrón en agosto y septiembre de 2026**.

Así que la pantalla dibuja, con «Completo» apretado: *«Cada barra es sobre los {cohorte} que
entraron · desde el 8 de agosto»* (`components/conversation/PanelDeConversation.jsx:488-489`). Las
dos mitades son ciertas por separado y juntas afirman algo falso: que hay trece meses de captación
detrás de esas barras. Un `booking rate` sobre trece meses y uno sobre seis semanas no son la misma
cifra —el primero promedia una etapa en la que no había operación— y la pantalla no da con qué
distinguirlos.

Y hay un segundo filo que lo vuelve incomprobable en pantalla: **la fecha se dibuja sin año.**
`fechaCorta` formatea con `day` y `month` y nada más (`:390`, el formato en `:394`), así que el
2025-08-08 de Lead Flow sale «8 de agosto» y el 2026-08-24 de Appointment Flow sale «24 de agosto».
Dos fechas separadas por **381 días** se leen como del mismo mes, una al lado de la otra, en el mismo
tablero. Quien mire no tiene forma de notar el problema: la lectura equivocada —«desde el 8 de
agosto», hace cinco semanas— es además la más plausible.

```sql
-- De dónde sale la fecha que dibuja «Completo», y qué hay realmente detrás de ella.
-- El corte va por fecha fija y no por `now() - interval`, para que el borde sea el mismo dentro de
-- un mes: con una ventana móvil las cifras cambian solas cada vez que un contacto lo cruza.
select min(alta_en_el_crm)::date desde_completo,
       count(*) cohorte,
       count(*) filter (where alta_en_el_crm >= '2026-08-01') desde_agosto,
       round(100.0 * count(*) filter (where alta_en_el_crm >= '2026-08-01')
             / count(*), 1) pct,
       count(*) filter (where alta_en_el_crm <  '2026-08-01') cola
from negocio.contactos
where alta_en_el_crm is not null;
-- 2026-09-16 13:49 UTC: 2025-08-08 · 560 · 531 · 94,8 · 29   ← la cohorte crece, el corte no

-- La cola, mes a mes: es lo que convierte «trece meses» en «un contacto y después nada».
select to_char(alta_en_el_crm, 'YYYY-MM') mes, count(*)
from negocio.contactos where alta_en_el_crm is not null
group by 1 order by 1;
-- 2026-09-16 13:49 UTC: 2025-08 → 1 · 2025-12 → 5 · 2026-01 → 4 · 2026-02 → 4 · 2026-03 → 2
--                       2026-04 → 1 · 2026-05 → 4 · 2026-06 → 2 · 2026-07 → 6 · 2026-08 → 295
--                       2026-09 → 236

-- El mismo campo en Appointment Flow, donde sí describe al dato que acompaña.
select min(inicio_el)::date desde, count(*) citas
from negocio.citas c
where c.inicio_el >= now() - make_interval(days => 3650) and c.inicio_el < now()
  and c.ghl_calendario_id is not null
  and not exists (select 1 from negocio.contactos ct, unnest(ct.etiquetas) e
                  where ct.org_id = c.org_id and ct.id = c.contacto_id
                    and lower(e) = any (array['icp_rechazado', 'rechazado', 'rechazado_positivo',
                                              'rechazado_negativo', 'no calificado', 'descalificado']));
-- 2026-09-15 18:17 UTC: 2026-08-24 · 128
```

**Qué haría falta.** No es sacar el campo: sin él «Completo» vuelve a ser la palabra que se lee como
toda la historia, que es peor. Es **que la fecha no viaje sola**. Lo mínimo, y en el mismo subtítulo:
publicar junto al `desde` cuántos del total caen en la ventana reciente, que es la cifra que desarma
la lectura falsa sin pedirle al lector que sepa nada. Y **el año**, que hoy `fechaCorta` tira: cuesta
una línea y es lo que hace que el defecto se pueda ver desde la pantalla en vez de desde la base.

---

## 6 · Una propiedad del dato que conviene decir antes de discutirla

**El descarte no tiene fecha.** La partición entre «citas de contactos descartados» y el resto se lee
de las etiquetas **actuales** del contacto, y `negocio.contactos` no guarda cuándo se aplicó cada
etiqueta.

Consecuencia: una etiqueta puesta mañana reclasifica retroactivamente citas de la semana pasada, así
que **dos lecturas de la misma ventana en días distintos pueden dar tasas distintas sin que haya
entrado una cita**. No es un error del módulo — es la forma del dato que manda GoHighLevel — pero lo
que se publica es «cómo se clasifican HOY las citas de la ventana elegida», no «cómo estaban
clasificadas entonces».

El selector de período agranda el alcance de esto, y conviene decirlo antes de que alguien compare
dos botones: **la misma cita se clasifica igual en las cuatro ventanas y con las etiquetas de hoy**,
así que cuanta más historia se pide, más pasado reescribe una etiqueta puesta esta mañana. La ventana
que se ensancha es la del dato; la de la clasificación sigue siendo un solo instante, el de la
consulta. Hoy el techo es chico —la cita más vieja de la tabla es del 2026-08-12, así que «completo»
son 34 días— pero crece todos los días, y este defecto crece con él.

```sql
select min(inicio_el)::date primera, max(inicio_el)::date ultima, count(*) citas
from negocio.citas;
-- 2026-09-15: 2026-08-12 · 2026-09-19 · 317   ← la última es futura: hay citas ya agendadas
```

---

## 7 · Lo que va a cambiar solo —y lo que ya no—, para que no se lea como una falla

- **El sentimiento cruza el piso el 1 de octubre, y en un botón ya lo cruzó.** Con la ventana por
  omisión el denominador —`conVocabulario`, que hoy es igual a las juzgadas porque no hay ninguna
  fuera del vocabulario— es 20; el 2026-10-01 la siembra del 2026-09-01 —10 de los 20 análisis, todos
  entre la 01:32 y la 05:21— sale de los treinta días y quedan 10, que es exactamente el piso y la
  cifra sobrevive. El 2026-10-06 quedan 9 y se vuelve `null` (`lib/auditor/sentimiento.ts:127`). Y no
  hace falta esperar a octubre para verlo: **con el botón de 7 días son 5 juzgadas y la cifra ya no
  está**, así que hoy la misma pantalla muestra 25,0 % o un hueco según qué ventana se apriete. Las
  dos son correctas, y quien no sepa que el piso existe va a pensar que el auditor se rompió.
- **El aviso de citas congeladas no se apaga solo, y depende de qué botón esté apretado.** La cita
  congelada más nueva es del 2026-09-10, así que en la ventana por omisión de treinta días el aviso
  sigue encendido hasta el 2026-10-10; con siete días son 3 congeladas y también está encendido; y
  **en «completo» no se apaga nunca**, porque las 101 entran siempre. Es el contraste que vale la
  pena mirar: ese aviso sale de una consulta, así que dice un número distinto y verdadero en cada
  ventana. Una cifra escrita a mano habría dicho la misma en las cuatro, y en tres de ellas habría
  estado mal.
- **La pestaña Auditoría está vacía para 11 de las 12 empresas activas.** Medido por el motivo que
  devolvería `resolverAccesoAlAuditor` (`lib/credenciales/resolver.ts:450-458`): **8 no tienen fila
  de credenciales** —que se reporta como falta de llave, no como «apagado», porque el interruptor
  nace encendido—, **3 tienen llave y no tienen `crm_agente_usuario_id`**, y **una sola audita**.
  Ninguna está apagada a propósito. No es un defecto del módulo: es configuración que nadie cargó.

```sql
-- Las dos cifras del aviso de congeladas: hasta cuándo sigue encendido, y cuántas ve cada botón.
select max(inicio_el)::date congelada_mas_nueva
from negocio.citas where ghl_calendario_id is null;
-- 2026-09-15: 2026-09-10

select v.dias, count(*) filter (where c.ghl_calendario_id is null) congeladas
from (values (1), (7), (30), (3650)) v(dias)
join negocio.citas c on c.inicio_el >= now() - make_interval(days => v.dias)
                    and c.inicio_el <  now()
group by v.dias order by v.dias;
-- 2026-09-15: hoy 0 · 7d 3 · 30d 77 · completo 101

select analizado_el::date dia, count(*)
from negocio.analisis_del_agente
where agente = 'chat_post_agenda' and auditable and disparo <> 'mejora'
group by 1 order by 1;
-- 2026-09-15: 09-01 → 10 · 09-06 → 1 · 09-07 → 1 · 09-08 → 3 · 09-10 → 2 · 09-11 → 1 · 09-12 → 2
--             de ahí salen las dos fechas: 20 hasta el 1-oct, 10 hasta el 6-oct, 9 después

select count(*) activas,
       count(*) filter (where cr.org_id is null) sin_fila,
       count(*) filter (where cr.auditor_activo = false) apagado,
       count(*) filter (where cr.ia_clave_cifrada is not null
                          and coalesce(trim(cr.crm_agente_usuario_id), '') = '') sin_id_del_agente
from identidad.organizaciones o
left join identidad.organizaciones_credenciales cr on cr.org_id = o.id
where o.activa;
-- 2026-09-15: 12 · 8 · 0 · 3
```

---

## 8 · Verificación pendiente, y es mía

**Estas pantallas se miraron, y hay que decir con precisión hasta dónde**, porque lo que falta no es
«mirarlas» a secas: es una cosa concreta que ni las pruebas ni la mirada que ya se hizo pueden
juzgar.

**Lo verificado: la forma.** El marcado real se montó sobre las hojas reales, en los dos temas y a
1280, 880 y 400 px. No fue trámite — encontró cuatro defectos que ni el compilador ni la suite
habrían visto, y los cuatro están arreglados:

- `periodo.ts` metía el cliente de PostgreSQL en el paquete del navegador. `DIAS_DE_TODO` vivía en
  `indicadoresDeCitas.ts`, y como el componente del cliente importa ese vocabulario, arrastraba la
  capa de datos entera. Hoy hay una prueba que exige que ese archivo no importe nada que toque la
  base (`pruebas/codigo/155-el-periodo-de-conversation.test.ts:231`).
- La columna del nombre medía **397 px a 1280**: «Entraron al CRM» arrancaba en x=22 y su «231» caía
  en x=431. Los dos legibles, y dejando de leerse como una sola cosa. Va acotada en píxeles
  (`app/inteligencia-estetica.css:255`).
- A 400 px el panel seguía en dos columnas: el corte de 900 usa `:is(.pn-b.q3, .pn-b.q4)` y pesa más
  que `.pn-b` a secas, así que la regla de una columna escrita después no ganaba. La especificidad
  manda sobre el orden (`app/inteligencia-estetica.css:541`).
- El precall decía el mismo número dos veces, en el encabezado y en una celda.

**Lo que sigue sin verificar: la pantalla con sesión iniciada y datos reales.** Iniciar sesión no lo
hago yo. Y no es lo mismo que lo anterior: el marcado se montó con valores puestos a mano, así que lo
que está comprobado es que la forma aguanta, no que los números que hoy manda la base entren en ella.

**Y dentro de eso, lo que ninguna de las dos verificaciones puede juzgar: dónde quedó la línea entre
aviso visible y nota escondida.** La regla está escrita —el porqué de una cifra se va a un ícono; que
un dato NO EXISTA se queda a la vista, porque detrás de un ícono un dato inexistente se vuelve un
dato con asterisco— y el canal lo decide un solo componente: `Nota` (`PanelDeConversation.jsx:337`)
devuelve `<p className="cs-grave">` cuando la nota es grave (`:340`) y el botón con ícono
`cs-nota` cuando no (`:343`). La mayoría de los usos son graves, y quién lo es lo decidió una persona,
uso por uso.

- **Ninguna prueba mira ese reparto, y eso es deuda, no un matiz.** No hay una sola aserción sobre
  `Nota`, `cs-grave` ni `cs-nota` en todo el árbol de pruebas: `grep -rn "cs-grave\|cs-nota" pruebas/`
  da **cero**, y `grep -rn "cs-" pruebas/` da **un** resultado, `pruebas/codigo/122-pantalla-de-auditoria.test.ts:433`,
  que es sobre `cs-falta-caja` —la caja plegable de «lo que falta»— y no sobre un canal de aviso. La
  única prueba que se acerca dice en su comentario lo contrario de lo que a este documento le
  convendría: *«Lo que se comprueba sigue siendo la advertencia, no su envoltorio»*
  (`122-pantalla-de-auditoria.test.ts:486-488`, sobre la aserción de `:489`). Lo que las pruebas sí
  cubren es otra cosa, y conviene no confundirla: el **texto** que produce la capa de datos
  (`pruebas/base/149-tasa-de-cancelacion.test.ts:126`, `:200`, `:360` y `:372`) y que cierta frase
  esté presente en el JSX como cadena (`122-pantalla-de-auditoria.test.ts:489`). **Nunca por qué
  canal sale.** O sea que mover un `grave` de un aviso a otro —o perderlo en una refactorización— no
  rompe nada: la suite entera pasa igual, y el dato inexistente se convierte en un dato con
  asterisco sin que nadie se entere.
- Cubrirlo tiene su propia trampa, y por eso está acá y no arreglado: la prueba obvia es escribir a
  mano la lista de cuáles avisos son graves, y **una lista escrita a mano no se apaga sola**, que es
  el defecto que este repositorio persigue. Y la razón de fondo es que hoy **la gravedad no viaja
  con el aviso**: la capa de datos manda `string | null` y nada más —`aviso`
  (`lib/negocio/indicadoresDeCitas.ts:63`), `avisoDeAsistencia` (`:129`), `avisoDeConfirmacion`
  (`:146`), y `grep -rn "grave" lib/negocio/` da **cero**—, así que quién es grave lo elige el JSX
  en cada uso, uno por uno. Mientras sea así no hay nada que una prueba de la capa de
  datos pueda exigir. Que la severidad salga del mismo lugar que el texto es lo que convertiría esto
  en comprobable, y es el arreglo, no la prueba.
- La verificación visual comprobó que el ícono se abre al pasar y al tocar, y que el panel entra a
  400 px. **No puede comprobar si esconder ese porqué en particular fue buena idea**, porque con
  datos de prueba todos los avisos parecen igual de importantes.

Con lo que hay hoy la pregunta es concreta y se contesta en una sentada. En la ventana por omisión,
la tarjeta de citas de Appointment Flow enciende **dos avisos graves, uno debajo del otro**: el de
asistencia (0 registradas de 128) y el de citas congeladas (77 fuera del conteo). Los dos dicen que
falta un dato, los dos por eso se quedan a la vista, y los dos están en el mismo pie de la misma
tarjeta (`PanelDeConversation.jsx:672` y `:663`). Hay que mirar si ahí adentro se siguen leyendo como
dos cosas distintas, o si volvieron a ser el párrafo que el rediseño existió para sacar.
