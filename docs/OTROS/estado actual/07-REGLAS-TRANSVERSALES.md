# Las reglas transversales: lo que hay que saber antes de escribir una cifra nueva
> Corte: **2026-10-18**. Producción corre el commit **`972972e`** (migraciones hasta la `078`); las citas son al árbol
> de `dc84cb2`, que suma ocho commits locales del modelo de datos sin subir (sección «Construido en local»). Las cifras
> de producción se midieron el 2026-10-18 entre las **15:38 y las 15:40 UTC** con `scripts/supabase.mjs leer`, sólo
> conteos y agregados y con el OK del usuario: de la base no salió un nombre, un correo ni un teléfono. Lo que no se
> volvió a medir lleva su fecha; lo que no se pudo verificar está dicho como pendiente. Ver [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md).

> **Desde el corte del 2026-09-28** (137 commits, `ceec000..dc84cb2`)
>
> - **2026-09-29/30 · `7a7eb17`..`ecfbc26`, `8ff8d9d`..`43ce5ac`** — Creative CR-0 a CR-3 (`063`, `064`) y Acquisition
>   AQ-0 a AQ-5 (`065`, `066`): nace un escritor único por tabla de Acquisition (regla 46).
> - **2026-10-01 · `c936b24`, `46c5556`, `33e0a76`** — el fallo del modelo con su referencia y el Panel de Incidentes (`067`).
> - **2026-10-01/02 · `3c07cc7`..`8ee595d`, `e5499d9`..`522c9bc`** — la nueva estructura (E0 a E13) y su segunda edición:
>   la marca en dos capas, sólo oscuro, Geist, la paleta, el menú por departamentos y la sesión entera (reglas 49 y 50).
> - **2026-10-03 · `97fc905`** — las funciones de Vercel en São Paulo, al lado de la base.
> - **2026-10-04 a 07 · `db6bc34`..`75228c5`, `5b8b236`, `d0e711c`, `2f12fad`** — los agentes de IA (AG0 a AG16, `068` a
>   `075`): el transporte único, `negocio.uso_de_ia` sin texto, el cerebro con herramientas, las señales y los planes, el
>   voseo prohibido en Tools (reglas 42 a 45 y 48; desde `65669f4`, del 2026-10-18, en toda la aplicación). Desde AG6 el `aviso` de Lead Flow tiene lector: el cerebro (§ 1).
> - **2026-10-07 · `22ec755`, `ae30048`, `d17e029`** — el gasto de toda la cuenta de Meta (`076`), la 205 deja de
>   depender de la hora, y «el día de la empresa» diagnosticado y dejado para después (regla 47).
> - **2026-10-08 a 11 · `210ac73`..`253cc79`** — Conversion, Sales, Conversation y Creative vuelven al front del
>   prototipo (`077`): una lectura por pantalla, el piso en toda tasa, sin párrafos, y los días cerrados (reglas 47 y 51).
> - **2026-10-08 · `82ba9e7`** — Client OS: la única sección que hoy lleva `sinOperacionesTodavia` (regla 31).
> - **2026-10-15 · `66d88de`, `cce2d56`, `972972e`** — Meta directo, listo y dormido (`078`). Es lo que corre producción.
> - **2026-10-16 · `693a383`..`dc84cb2`** — el modelo de datos multiempresa, Fase 0 (`079` a `084`): construido en local,
>   sin subir, pendiente de la aprobación de un ingeniero. Cambia la regla 23 y la 7 (sección «Construido en local»).
> - **2026-10-18 · `21556cd`..`18f61d6`** — el nivel 3, los clientes de nuestros clientes (`085` a `089`), y la pestaña
>   Negocios: construido en local encima de la Fase 0, sin subir. La regla 23 gana otra mitad (sección «el nivel 3»).
> - **2026-10-18 · `00ccfee`..`ca5fcdc`** — el Bloque C del nivel 3: la ingesta, las credenciales y el cron por cliente
>   (`090` a `093`), en local y sin subir (sección «el nivel 3»).
> - **2026-10-19 · C5 · G4** — las rutas manuales (la Agenda, el tic de la ingesta y «Traer de GoHighLevel») traen a
>   cada cliente activo con lo suyo, sin migración, en local y sin subir (sección «el nivel 3»).
> - Las cifras: la cancelación del negocio a treinta días pasa de 32,0 % a **35,0 %** (14 de 40, § 9); las congeladas
>   salieron de la ventana de treinta días (**0**, § 4); entraron **25 contactos** en treinta días (§ 5).
> - **Lo que la foto anterior dejó abierto, re-verificado el 2026-10-18:** el `aviso` de Lead Flow ya tiene lector —el
>   cerebro, desde `13723a0`—; la cadena visible sin fecha y el comentario «la fila más vieja es de 2026» siguen; los
>   contactos con territorio nulo pasaron de 25 a **36** (sección final).

Comando Central tiene un cuerpo de reglas que no pertenecen a ningún departamento: valen para todos.
No son estilo ni gusto — cada una cerró un defecto concreto, y casi todas están escritas en el encabezado del archivo
que las paga. Este informe las reúne, las ordena y verifica sus cifras contra producción (2026-10-18, 15:38 a 15:40
UTC). Hay once reglas centrales —el silencio, el piso de 10, los dos ceros, las citas congeladas, la cohorte contra el
territorio, la ventana y su lista cerrada, la RLS forzada, la migración antes del push, el descarte propio, un solo
escritor por tabla y **la cadena que no es un embudo**—, dieciocho menores (12 a 29), doce del 16 al 28 de septiembre
(30 a 41) y **once nuevas o recién reunidas, del 29 de septiembre al 16 de octubre (42 a 52)**, que van después de los errores de método
para no correr las líneas que otros documentos citan. Y los errores de método: siete veces se concluyó que un dato no
existía y existía; tres veces se empujó código antes de aplicar su migración; y más de una vez una prueba verde no
estaba mirando nada.

---

## Cómo leer esto, y de dónde salen las reglas

Ninguna de estas reglas se inventó para este informe: estaban en el encabezado de un módulo de `lib/negocio/`, en el
comentario de una migración de `db/migraciones/` o convertidas en una prueba de `pruebas/`, con su defecto al lado.

**Tres cosas sobre el método de este documento, porque son las mismas que las reglas exigen:**

1. **Se mide, no se supone.** Cada cifra lleva su archivo:línea o la consulta que la produjo. Las
   consultas se corrieron en modo lectura contra producción con
   `node --env-file=.env.supabase scripts/supabase.mjs leer`, juntando varias cifras por consulta.
2. **Un `grep` sobre nuestro código prueba qué pedimos, nunca qué manda el proveedor.** Donde la
   afirmación es sobre el dato, la evidencia es una consulta a la base, no una búsqueda en el
   repositorio.
3. **Lo histórico se cita como historia.** Los incidentes de despliegue y las mediciones que quedaron
   en los mensajes de commit no se pueden volver a medir: se citan con su commit y se marcan como tales.
   Lo que no se volvió a medir dice su fecha («del 2026-09-28, no re-medida»).
4. **La suite no se corrió para este corte**: comparte una sola base local (regla 37). Sí se corrió la prueba
   `101`, la auditoría de citas, que mira esta carpeta.

**El reloj de las mediciones.** `now()` en producción devolvió `2026-10-18 15:38:44 UTC` en la primera consulta y
`15:39:06` en la última: «30 días» empieza el 2026-09-18 a esa hora, y toda cifra de ventana es de ese instante. La
ventana rueda sola: la foto anterior (2026-09-28 22:06 UTC) y [04-CONVERSATION.md](04-CONVERSATION.md) (2026-10-10)
midieron otras poblaciones y las tres son correctas a su hora. La cancelación a catorce días es hoy **37,5 %** sobre 16.
La tabla trae una cita que no ocurrió (empieza el 2026-10-20): las cifras de citas no la cuentan, porque cierran en
`inicio_el < now()` (`lib/negocio/indicadoresDeCitas.ts:417`); el booking rate de Lead Flow sí, porque agendar es el evento (§ 4).

**El mapa del producto, para ubicarse.** `lib/autorizacion/secciones.ts:169-175` sigue definiendo los grupos que
filtra `menuVisible()` —AIOS, Inteligencia, Operación, Administración y el pie—, pero desde la nueva estructura
(`4742d74`, 2026-10-01) la barra lateral dibuja el reparto de `lib/autorizacion/departamentos.ts:50-56`: el Inicio,
Research, Systems, Marketing, Sales y Client Success, con Credenciales, Monitoreo e Incidentes en el engranaje (`:125-128`).
Ninguna sección de trabajo sigue sin operaciones: el Inicio (`executive`) bajó la bandera con el cerebro el 2026-10-04
(`lib/autorizacion/secciones.ts:239`) y la única que la lleva es Client OS (`:474`). Estas reglas nacieron casi todas en
Operación, se ejercieron primero en Conversation y desde el 16 de septiembre las comparten todas las pantallas.

---

## 1 · La regla del silencio: `aviso: string | null`, y qué significa el null

**La regla.** Toda cifra que puede necesitar una advertencia viaja con un campo `aviso` de tipo
`string | null`. Cuando no hay nada que decir, el valor es `null` **y la pantalla no dibuja nada**. El
silencio es el caso normal, y es lo que hace que la aparición del cartel signifique algo.

Está enunciada en `lib/negocio/indicadoresDeCitas.ts:56-62`:

> «`aviso` es `null` cuando no hay nada que decir, y entonces **la pantalla no dibuja nada**. […] un
> cartel que aparece siempre se aprende a ignorar.»

**El defecto que cierra.** Un aviso permanentemente encendido no informa: entrena a no leer los
avisos, y se lleva puestos a los que sí eran ciertos. El argumento está en
`lib/negocio/indicadoresDeCitas.ts:147-155`, donde explica por qué `avisoDeAsistencia` es un campo
**propio** y no parte de `aviso`: la asistencia va a estar bajo el piso durante semanas, así que un
aviso compartido estaría siempre encendido, «incluido el de las citas congeladas».

**La forma canónica son tres estados, no dos** (`lib/negocio/indicadoresDeCitas.ts:526-538`):

| Estado | Qué dice | Qué manda a hacer |
| --- | --- | --- |
| Sin base | «no hay cifra, y por qué» | esperar, o revisar el flujo |
| Con base incompleta | «la cifra vale, y sobre cuántas NO se contó» | leer la cifra sabiendo su recorte |
| Todo lo demás | **`null`** — nada en pantalla | nada |

Y el tercero se apaga solo: «el día que dejen de caer en la ventana […] el aviso desaparece solo».
**Ya pasó en las tres ventanas cortas:** medido el 2026-10-18, ninguna cita congelada cae en los últimos
siete, catorce ni treinta días (§ 4): la más nueva de las 101 es del 2026-09-10, y desde el 2026-10-10 el
aviso de congeladas calla también en la ventana con la que abren las pantallas, sin que nadie lo tocara.
Sólo queda en «Completo», donde no se apaga nunca.

**Dónde está implementada.** Con `grep` del patrón `aviso…: string | null` sobre `lib/` del árbol de este corte
son **38 campos en 21 archivos** (el mismo `grep` da 30 en 18 en `861b5f0`). Los de Conversation, re-verificados; **la columna de
la derecha es historia**: desde CN-3 (2026-10-10) la pantalla ya no dibuja ninguno (ver abajo):

| Archivo:línea | Campo | Quién lo dibujaba hasta el 2026-10-10 |
| --- | --- | --- |
| `lib/negocio/indicadoresDeCitas.ts:72` | `aviso` (cancelación) | `components/conversation/PanelDeConversation.jsx:686@6f3bdb5` |
| `lib/negocio/indicadoresDeCitas.ts:100` | `avisoDeLaVentana` | `components/conversation/PanelDeConversation.jsx:618@6f3bdb5` |
| `lib/negocio/indicadoresDeCitas.ts:155` | `avisoDeAsistencia` | `components/conversation/PanelDeConversation.jsx:685@6f3bdb5` |
| `lib/negocio/indicadoresDeCitas.ts:172` | `avisoDeConfirmacion` | `components/conversation/PanelDeConversation.jsx:974@6f3bdb5` |
| `lib/negocio/indicadoresDelLead.ts:106` | `avisoDeLaVentana` | `components/conversation/PanelDeConversation.jsx:505@6f3bdb5` |
| `lib/negocio/indicadoresDelLead.ts:126` | `avisoDelBooking` | `components/conversation/PanelDeConversation.jsx:516@6f3bdb5` |
| `lib/negocio/indicadoresDelLead.ts:183` | `aviso` (Lead Flow) | **nadie**; desde AG6, el cerebro (ver abajo) |
| `lib/negocio/indicadoresDelLead.ts:185` | `avisoDeLatencias` | `components/conversation/PanelDeConversation.jsx:933@6f3bdb5` |
| `lib/negocio/atribucionDelLead.ts:69` | `aviso` | `components/conversation/PanelDeConversation.jsx:727@6f3bdb5` |
| `lib/negocio/consumoDelPrecall.ts:140` | `aviso` | `components/conversation/PanelDeConversation.jsx:803@6f3bdb5` |
| `lib/auditor/sentimiento.ts:65` | `aviso` | `components/conversation/PanelDeConversation.jsx:827@6f3bdb5` y `:835@6f3bdb5` |
| `lib/negocio/frescura.ts:58` y `:221` | `aviso` (frescura del barrido) | no re-verificado |

Los otros 25 campos (38 menos los 13 de la tabla) no se auditaron uno por uno contra su lector: **no
verificado** que todos tengan uno.

**El otro modo de romper esta regla: un aviso que nadie lee.** El de la cohorte de Lead Flow se declara en
`lib/negocio/indicadoresDelLead.ts:183`, se arma en `:323` con `avisoDe` (`:407-423`), y hasta el 2026-10-05 no lo
leía nadie: ni el panel ni otro módulo —en una ventana sin altas se perdía justo el que explica el tablero, *«No entró
ningún contacto nuevo al CRM en N días»* (`lib/negocio/indicadoresDelLead.ts:409`), mientras la pestaña dibujaba
«Cada barra es sobre los 0 que entraron» (`components/conversation/PanelDeConversation.jsx:497@6f3bdb5`)—. **Desde
AG6 (`13723a0`) lo lee el cerebro**: la herramienta `lead_flow` lo pasa entero, junto con los demás avisos del módulo
(`lib/agentes/executive/adaptadores/conversation.ts:74-77`). Y desde CN-3 la pantalla no dibuja ningún aviso «sin
párrafos»: viajan en la respuesta (`app/api/auditoria/route.ts:105-107`) y los da el agente cuando se le pregunta
(`components/conversation/PanelDeConversation.jsx:30-31`). **El riesgo cambió de forma:** un aviso que sólo lee el
cerebro se lee sólo si alguien pregunta. Un aviso sin lector es peor que uno siempre encendido —al segundo se lo
aprende a ignorar, al primero no hay forma de notarlo—, y uno que espera la pregunta queda a mitad de camino.

**Un corolario fuera de las cifras.** `lib/auditor/rubrica.ts:559` usa el mismo argumento dentro del
prompt del modelo: un renglón «Mensajes no entregados: 0» en cada análisis enseña a saltearlo, «y
cuando aparezca un 1 va a saltearlo igual».

---

## 2 · El piso de una tasa: `PISO_DE_UNA_TASA = 10`

**La regla.** Ninguna tasa de este sistema se publica con menos de diez eventos en el
**denominador**. Por debajo del piso el valor es `null`, se dibuja el conteo, y el aviso explica por
qué.

La constante vive en `lib/negocio/indicadoresDeCitas.ts:329`, con su justificación en `:313-328`.

**Por qué diez, y no es gusto.** El no-show reportado se declara como **conteo y no como tasa** porque
medía 2 eventos en catorce días —«una tasa sobre dos eventos no es una tasa»
(`lib/negocio/indicadoresDeCitas.ts:121-127`)—. Con diez, un registro mueve diez puntos: sigue siendo
mucho, y ya no es absurdo.

**El piso es del DENOMINADOR, no del total.** Dicho en `lib/negocio/indicadoresDeCitas.ts:325-327`:
«con 151 citas y 3 respuestas la muestra son 3, y quien contestó esas tres no es una muestra al azar
de las 151».

**Por qué se renombró.** Se llamaba `PISO_DE_ASISTENCIA`; el commit `1fce636` lo cambió porque
«nombrar una constante compartida por la primera que la necesitó invita a que la quinta se escriba su
propio piso», y el motivo sigue escrito en `lib/negocio/indicadoresDeCitas.ts:316-318`.

**Quién lo usa hoy.** Con `grep` sobre el árbol de este corte, **21 archivos de `lib/` nombran la constante** (15 el
2026-09-28), y desde CN-1 las lecturas lo aplican a toda tasa (regla 51). Los de Conversation, re-verificados: la asistencia
(`lib/negocio/indicadoresDeCitas.ts:473-476`), la confirmación (`:482-485`), los descartados
(`:492-495`), las filas de atribución (`lib/negocio/atribucionDelLead.ts:174`), el consumo del precall
y su desglose fino con las dos ramas sobre el piso (`lib/negocio/consumoDelPrecall.ts:242` y `:239`),
y la proporción de molestos (`lib/auditor/sentimiento.ts:127`). Entre los nuevos, el commit `7d1bc8b`
dejó escrita la variante que hay que evitar: el click-to-landing de Creative **no tenía piso** y el
comentario de arriba afirmaba que sí —8 de 24 piezas tenían menos de diez clics, y la menor, con uno,
publicaba 100 %— y se arregló con `PISO_DE_UNA_TASA`, «no uno nuevo».

**El piso funcionando, y la parte que no protege.** La atribución por fuente del primer toque, medida el 2026-10-18
con el predicado de «agendó» del módulo (`tieneCitaAlcanzable`, `lib/negocio/atribucionDelLead.ts:151`) y agrupada
por el valor crudo de `sessionSource`:

| Fuente | Cohorte 30 d | Agendaron | Tasa 30 d | Cohorte completo | Tasa completo |
| --- | --- | --- | --- | --- | --- |
| Paid Social | 5 | 2 | — (a «Otras») | 365 | 42,2 % (154) |
| Social media | **13** | 11 | **84,6 %** | 178 | 21,3 % (38) |
| Direct traffic | 5 | 5 | — (a «Otras») | 33 | **54,5 %** (18) |
| sin fuente | 1 | 1 | — (a «Otras») | 20 | — (a «Otras»: sin etiqueta) |
| Referral | 1 | 0 | — (a «Otras») | 1 | — (a «Otras») |
| CRM UI | 0 | 0 | — | 3 | — (a «Otras») |

El encabezado del módulo (`lib/negocio/atribucionDelLead.ts:22-38`, medido el 2026-09-14) advierte este dibujo: con
8 y 6 leads, las fuentes chicas tenían las tasas más altas y «dicen que lo pago es lo que peor convierte». El
2026-09-28 Direct traffic pasaba el piso con 13 (92,3 %) al lado de Paid Social con 252 (48,0 %). **Hoy la pauta casi
no aparece a treinta días** —5 de 25 contactos— y la única barra es la de Social media, 84,6 % sobre trece; en
«Completo» la trampa sigue entera: Direct traffic al 54,5 % sobre 33 al lado de Paid Social al 42,2 % sobre 365.
**El piso protege de una muestra chica, no de una comparación mal hecha.** A catorce días la cohorte son 9 contactos
(§ 5): ninguna fila pasa el piso y todo va a «Otras».

**Apartar no es esconder.** La fila «Otras» lleva su conteo y las filas suman la cohorte exacta —13 + 12 = 25 a
treinta días, medido el 2026-10-18 (252 + 13 + 10 + 1 = 276 el 2026-09-28)—, así que si faltara un pedazo se vería.
Lo que no recibe es una barra que invite a compararla con una que sí tiene datos.

---

## 3 · Los dos ceros: «no hay dato» contra «el dato dice cero»

**La regla.** Dos hechos distintos no pueden colapsar en el mismo valor. «Nadie lo cargó» y «vale
cero» mandan a hacer cosas distintas, así que se representan distinto: `null` para la ausencia, `0`
para el hecho medido — y donde hace falta, un aviso que diga cuál de los dos es.

**Los enunciados canónicos:**

- `lib/datos/esquema.ts:28` — «**`null` no es cero.** `null` = nadie lo cargó; `0` = esta empresa no
  paga, que es un hecho.»
- `lib/negocio/indicadoresDeCitas.ts:446-448` — «Sin citas NO hay tasa. Un `0 %` con cero citas se lee
  como *no se cancela ninguna*».
- `db/migraciones/048_de_donde_vino_el_lead.sql:67` y `db/migraciones/049_si_se_presento_a_la_cita.sql:44-45`
  — «un nulo significa una sola cosa. *No se presentó* es `false`».

**Los casos vivos, medidos el 2026-10-18:**

| Caso | Medición | Qué significa el vacío |
| --- | --- | --- |
| `citas.asistio` | **0 de 368** citas (0 de 333 el 2026-09-28) | Nadie cerró el intento. **No** «no se presentó nadie» |
| `resultados.cita_id` | **0 de 7** resultados, los mismos 7 (el más nuevo es del 2026-09-09) | No se registró ningún intento nuevo desde la `049` |
| `estado_ghl = 'noshow'` y `'showed'` | **20** y **3** de 368 citas (15 y 0 el 2026-09-28) | El calendario ya dice las dos cosas: las 3 `showed` pasaron de `confirmed`, la última el 2026-10-08 |
| Campo `Confirmación Agendamiento` | **190 de 624** contactos (184 de 594 el 2026-09-28) | Sin el campo en el catálogo no hay cifra, y no es «nadie confirmó» (abajo) |

La tercera fila es una regla: `citasAlcanzables.ts` publica los plantones del calendario con su propio nombre y
prohíbe sumarlos con `asistio` —«son dos fuentes de la misma pregunta y sólo una es nuestra»—
(`lib/negocio/citasAlcanzables.ts:87-113`). Un «0 asistencias» y un «20 plantones» conviven sin contradecirse. El
lado positivo, `ESTADO_ASISTIO` (`lib/ghl/calendarios.ts:195`), ya tiene 3 citas y ningún lector (error C).

El caso de la asistencia es el que mejor muestra por qué la regla importa:
`lib/negocio/indicadoresDeCitas.ts:385-390` dice que sin el filtro `asistio is not null` en el
denominador, como el nulo es el caso normal, «la tasa diría que no se presenta casi nadie. Sería una
cifra plausible, alarmante y falsa».

**El tercer cero: el campo puede no existir.** `confirmacionEnLaVentana`
(`lib/negocio/indicadoresDeCitas.ts:245-254`) distingue tres estados, y el primero lo dice con todas
las letras en `:297-299`: si el campo no está en el catálogo, «no es que nadie confirme». El commit
`10fde57` lo resume: «*Nadie respondió* se arregla esperando o revisando el flujo del CRM. *El campo no
existe* se arregla mirando el CRM».

**Y el cuarto, en el sentimiento del auditor.** `lib/auditor/sentimiento.ts:11-26` censa poblaciones
que se ven idénticas en `sentimiento is null`. Re-medido el 2026-10-18 sobre las 102 filas de
`negocio.analisis_del_agente` (70 el 2026-09-28):

| Población | Filas | Con sentimiento |
| --- | --- | --- |
| auditable, disparo `debounce` | 24 | 24 |
| auditable, disparo `alarma` | 2 | 2 |
| auditable, disparo `mejora` | 48 | **0** (el carril escribe null a propósito) |
| no auditable | 28 | **0** (nunca se llamó al modelo) |

Sobre las 102 filas la distribución diría «75 % sin dato», que describe los carriles del propio auditor
y no las conversaciones. **El denominador son las 26**, y viaja al lado.

---

## 4 · Las citas congeladas: `ghl_calendario_id is null`

**La regla, y la mitad que le faltaba.** Toda cifra que pregunte por el **ESTADO** de una cita se
cuenta únicamente sobre las que el barrido todavía puede refrescar —`ghl_calendario_id is not null`— y
lo congelado se declara aparte, nunca se suma en silencio. **Toda cifra que pregunte por la
EXISTENCIA de la cita las cuenta a todas:** una cita congelada tiene el estado detenido; no deja de
haber sido agendada.

**Dónde vive el predicado, y eso cambió.** La foto anterior lo citaba como constante local de
`indicadoresDeCitas.ts`. Desde el 2026-09-21 (`1164984`) es una función compartida,
`alcanzable(alias)` en `lib/negocio/citasAlcanzables.ts:54-56`, y el motivo de no repetirlo, que antes
era una advertencia, se volvió un hecho medido: el predicado **ya estaba copiado nueve veces**
(`lib/negocio/citasAlcanzables.ts:11-14`; ver la regla 30).

**Qué son las congeladas.** Citas anteriores a la migración `038`, que no traen identificador de
calendario. El CRM ya no devuelve sus eventos, así que su estado quedó fijo en el que tenían el día que
dejaron de sincronizarse (`lib/negocio/citasAlcanzables.ts:48-50`).

**Medido el 2026-10-18 contra producción:**

| | 2026-10-18 | 2026-09-28 |
| --- | --- | --- |
| Citas totales | **368** | 333 |
| Alcanzables (`ghl_calendario_id is not null`) | **267** | 232 |
| Congeladas (`is null`) | **101** | 101 |
| Última sincronización de las congeladas | 2026-09-06 04:03 UTC | la misma |
| Rango de `inicio_el` de las congeladas | 2026-08-12 a 2026-09-10 | el mismo |
| Congeladas dentro de la ventana de 14 días | **0** | 0 |
| Congeladas dentro de la de 30 días —la que la pantalla abre— | **0** | 14 |

Las congeladas no se mueven y la ventana sí: el problema se fue solo por el borde trasero de las tres ventanas
cortas, como la foto anterior anticipó. Queda en «Completo», que las cuenta a todas (§ 6).

**Por qué esto es una regla y no un detalle.** El sesgo que produjeron está medido en
`lib/negocio/indicadoresDeCitas.ts:6-18` y en
`db/migraciones/045_cuando_cambio_el_estado_de_la_cita.sql:19-34`: el 2026-09-14, las citas con
calendario cancelaban al **60,3 %** (120 de 199) y las congeladas al **30,7 %** (31 de 101). Mezclarlas
daba «un número más bajo, estable y falso», y el sesgo **parecía una tendencia**: 61,9 % a siete días,
60,1 % a catorce, 52,9 % a treinta, 50,6 % en total.

**Y la exclusión tiene además un motivo de producto** (`lib/negocio/indicadoresDeCitas.ts:26-29`):
sólo cuentan las citas agendadas desde que Comando Central existe. Excluirlas no es una pérdida que
haya que compensar algún día: es el alcance.

**El filtro llegó a estar donde no correspondía, y se sacó el 2026-09-16.** Lead Flow lo copiaba para
el booking rate «por consistencia, no por la pregunta» (`lib/negocio/indicadoresDelLead.ts:209-236`,
commit `bddb516`): a catorce días no descartaba a nadie; a treinta, la ventana por omisión, hundía la
cifra cinco puntos y medio (44,8 % contra 50,4 %, medido el 2026-09-16). Hoy el booking rate cuenta
**cualquier** cita (`:237-239`), y `agendaronSoloCongeladas` con `avisoDelBooking` declaran cuántos
descansan en una congelada (`:124-126`), porque la cancelación de al lado no los cuenta. Medido el
2026-10-18: **0** a treinta días y **79** en «Completo», los mismos que el 2026-09-28.

**Y eso dejó dos definiciones de «agendó» en el producto.** El booking rate de Lead Flow cuenta
cualquier cita; la atribución de la misma pantalla y Acquisition, Creative, Conversion, Sales y Leads
Portal usan `tieneCitaAlcanzable`, que excluye a quien sólo tiene congeladas
(`lib/negocio/citasAlcanzables.ts:115-145`). A 7, 14 y 30 días coinciden porque no queda nadie así;
en «Completo» Lead Flow dice **303** agendados y las filas de la atribución suman **224** (2026-10-18; 279 y 200
el 2026-09-28: la diferencia son los mismos 79). Y el comentario que
debería impedirlo afirma lo contrario: «el mismo filtro de cita alcanzable que el booking rate»
(`lib/negocio/atribucionDelLead.ts:148-150`). Es la regla 12 incumplida entre dos tarjetas vecinas.

---

## 5 · La cohorte no es el territorio

**La regla.** Una cohorte se arma con un hecho de **entrada** (cuándo entró el lead), nunca con un
estado que es **consecuencia** de lo que se quiere medir. Filtrar por `territorio` rompe cualquier
tasa de conversión, por construcción.

Enunciada en `lib/negocio/indicadoresDelLead.ts:29-31`: «**El territorio es consecuencia de agendar,
no una cohorte.** […] sobre esa población un booking rate da 2 de 280, que es una tautología».

**La medición, reproducida el 2026-10-18** (cita alcanzable = `tieneCitaAlcanzable`):

| Territorio | Contactos | Con cita alcanzable | Proporción | 2026-09-28 |
| --- | --- | --- | --- | --- |
| `setter` | 282 | **1** | 0,4 % | 2 de 282 |
| `closer` | 306 | 216 | 70,6 % | 197 de 287 |
| `null` (congelados) | 36 | 11 | — | 5 de 25 |

Sobre la población de zona setter el booking rate daría **0,4 % para siempre**, y no por el negocio
sino porque la pregunta está mal hecha. La proporción no se movió en tres semanas.

**La segunda cohorte rota, `creado_el`, sigue fuera** (`91e4e07`): la columna dice cuándo *nuestro
barrido* vio al contacto, y la carga inicial le puso la misma marca a 239. La cohorte es
`alta_en_el_crm` (migración `048`); medido el 2026-10-18, **600 de 624 contactos la tienen** (570 de 594
el 2026-09-28). Leads Portal nació con la misma regla escrita en su encabezado
(`lib/negocio/leadsDelPortal.ts:22-27`): el alta y no `creado_el`, de cualquier territorio.

**El precio se dice en voz alta, y esa también es la regla.** `lib/negocio/indicadoresDelLead.ts:33-36`:
la tasa de respuesta bajó de 68,1 % a 60,9 % al sacar el filtro de territorio, porque la cohorte dejó
de excluir a los que agendaron sin escribirnos nunca.

**Una sola cohorte para todas las cifras de la pantalla** (`lib/negocio/indicadoresDelLead.ts:38-43`):
con cohortes distintas, «60,9 % contesta» y «52,5 % agenda» no permitirían preguntarse cuántos hicieron
las dos.

**Medido el 2026-10-18 en la ventana con la que la pantalla abre:** 25 contactos entraron al CRM en
los últimos treinta días, **19 agendaron (76,0 %)** y a 20 se les escribió al menos una vez (el
2026-09-28 eran 276, 139 y 269). **La ventana de catorce días, la de los comentarios del módulo, tiene
9 contactos**, y la de siete, uno: desde el 2026-09-14 entraron 29. El comentario de
`lib/negocio/indicadoresDelLead.ts:134-140` —«entraron 231, se le escribió a 225, contestaron 138,
agendaron 121»— era cierto cuando se escribió y hoy no se reproduce ni de lejos. La ventana es móvil;
los comentarios, no. Por eso van fechados y por eso la pantalla dibuja `desde`.

**El mismo defecto con otro disfraz.** `lib/negocio/consumoDelPrecall.ts:37-41` lo reconoce en su
población: la cobertura del campo de video es del 94,3 % entre las citas `confirmed` y del 48,9 % entre
las `cancelled`, así que «tener el campo» es consecuencia de no haber cancelado — «el mismo defecto que
la cohorte por territorio, con otro disfraz».

---

## 6 · La ventana: una lista cerrada de cuatro, y lo que no está se rechaza

**La regla, que son dos.** La vieja: **una ventana más vieja no es una muestra más grande.** Y la que
hizo falta el día que la ventana se volvió elegible: **el parámetro se valida contra una lista
cerrada, y lo que no está se rechaza — nunca se corrige al valor por omisión.**

La primera sigue enunciada donde nació, `lib/negocio/indicadoresDeCitas.ts:331-339` («**Catorce y no
treinta** […] Pedir una ventana más larga no trae más señal: trae más citas que el sistema dejó de
mirar»), elevada a regla de proyecto en `:20-24` y repetida en
`db/migraciones/045_cuando_cambio_el_estado_de_la_cita.sql:36-37`. Medido el 2026-10-18, con las tres
poblaciones dichas por su nombre porque no son la misma:

| Ventana | Alcanzables ya ocurridas | Las que la tarjeta publica (alcanzables **menos** descartados) | Congeladas |
| --- | --- | --- | --- |
| hoy | 1 | 1 | 0 |
| 7 días | 4 | 4 | 0 |
| 14 días | 18 | 16 | 0 |
| 30 días | **46** | **40** | **0** |
| completo | **266** | **173** | **101** |

La columna del medio es el campo `citas` de `tasaDeCancelacion`
(`lib/negocio/indicadoresDeCitas.ts:359`, `filter (where ${alcanzable} and not ${descartado})`). **La
foto del 2026-09-15 decía que el cuarto botón no agregaba ni una cita alcanzable sobre el tercero** (205
contra 205); el 2026-09-28 agregaba 40 publicables y 87 congeladas, y hoy, con la ventana en el 2026-09-18, agrega
**133** publicables y las **101** congeladas. La conclusión se dio vuelta en trece días sin que nadie tocara el código,
que es exactamente por qué un comentario que describe la lectura de una ventana envejece.

**Qué cambió de `DIAS_DE_LA_TASA`.** Sigue en 14 (`lib/negocio/indicadoresDeCitas.ts:339`) y, medido
con `grep` sobre el árbol de este corte, es el valor por omisión de **19 funciones** en 18 archivos de `lib/` —las de
Conversation más las de Acquisition, Creative, Conversion, Sales y Leads Portal—. Las rutas les pasan siempre el período
elegido, así que ese 14 sólo actúa donde nadie pide ventana; el caso conocido sigue siendo
`citasParaCerrar` (`lib/negocio/citasParaCerrar.ts:60`), de Avanzar. **No verificado** que ninguna otra
llamada de las 19 dependa del 14.

**Las cuatro ventanas son una lista cerrada, en un archivo propio** (`lib/negocio/periodo.ts:83-96`):
`hoy` = 1 día, `7d`, `30d` y `completo` = `DIAS_DE_TODO` = 3650 (`:52`). La pantalla abre en **30 días**
(`PERIODO_POR_OMISION`, `:109`) porque catorce no es ninguno de los cuatro botones. **Entre el
2026-09-16 y el 2026-09-26 pasó de una ruta a seis**: Acquisition, Conversation, Creative, Conversion,
Sales y Leads Portal validan con `periodoDe` (`app/api/acquisition/route.ts:58`, `app/api/auditoria/route.ts:63`,
`app/api/creative/route.ts:62`, `app/api/conversion/route.ts:63`, `app/api/sales/route.ts:89`,
`app/api/leads-portal/route.ts:54`).

**El defecto que cierra la lista cerrada** está enunciado en `lib/negocio/periodo.ts:6-17` y convertido
en prueba en `pruebas/codigo/155-el-periodo-de-conversation.test.ts:59`. Leer `?dias=` como número abre
tres agujeros, **y los tres se ven bien en pantalla**:

| Lo que llega | Qué pasa si no se valida | Qué se ve |
| --- | --- | --- |
| `?dias=abc` | `NaN` cae al valor por omisión | El botón dice una ventana y las cifras son de otra |
| `?dias=90` | Se atiende como si existiera | Números correctos de una ventana que nadie decidió |
| `?dias=-5` | `now() - interval '-5 days'`: una ventana **en el FUTURO** | Cero filas, dibujadas como «no pasó nada» |

Por eso `periodoDe()` (`lib/negocio/periodo.ts:188`) devuelve `null` ante cualquier clave desconocida y
**`null` significa rechazar**: `app/api/auditoria/route.ts:64` lo convierte en un 400. La prueba exige
el rechazo con `=== null` y prohíbe el `??` (`pruebas/codigo/155-el-periodo-de-conversation.test.ts:127`),
porque `periodoDe(x) ?? POR_OMISION` compila, se lee razonable y es exactamente el defecto. La única
ausencia que cae en el valor por omisión es la real, la primera carga sin parámetro (`:80`).

**Y la lista viaja entera hacia los dos lados.** La clave elegida vuelve en la respuesta
(`app/api/auditoria/route.ts:124`) para que el botón encendido describa lo que el servidor contestó;
los botones salen de `PERIODOS` (`pruebas/codigo/155-el-periodo-de-conversation.test.ts:192`); y la
lectura del navegador exige el período, sin valor por omisión propio (`lib/auditor/vista.ts:47`,
forzado por `pruebas/codigo/155-el-periodo-de-conversation.test.ts:174`).

**Y «completo» no puede leerse como historia.** Por eso las cifras traen `desde`, que es `min()` sobre
las filas alcanzadas y no `now() - dias` (`lib/negocio/indicadoresDelLead.ts:268`,
`lib/negocio/indicadoresDeCitas.ts:400-403`). Medido el 2026-10-18: en Lead Flow «Completo» arranca el
**2025-08-08** (el alta más vieja); en las citas, el **2026-08-24 13:00 UTC** contra el **2026-09-18 16:00**
de «30 días». Desde CN-3 la pantalla dibuja el año cuando no es el de hoy (`components/conversation/comun.jsx:91-96`). Y
`desde` solo también miente cuando describe a un caso suelto: para eso está `avisoDeLaCola`
(`lib/negocio/periodo.ts:111-147` y `:158`), que hoy usan los dos módulos de Conversation y Leads
Portal (el error D).

**La ventana se mide con `inicio_el`, no con `reservada_el`** (`lib/negocio/indicadoresDeCitas.ts:31-37`):
la cobertura de `reservada_el` es parcial y crece sola. Medido el 2026-10-18: **236 de 368** citas la
tienen (201 de 333 el 2026-09-28); `inicio_el` es `not null` por esquema.

**La ventana la calcula la BASE, no la aplicación** (`lib/negocio/indicadoresDeCitas.ts:414-416`): «es
la única forma de que el “ahora” sea el mismo reloj que escribió las filas». **Con dos excepciones
declaradas:** el gasto de anuncios vive en una columna `date`, así que `lib/negocio/costoDelAnuncio.ts:37-45`
cuenta días de calendario y no 24 horas (regla 41); y desde CV-1 los «7 días» y «30 días» de Acquisition y
Conversion son días CERRADOS en la zona de la empresa (`lib/negocio/diasCerrados.ts:16`, `:82-88`; regla 47).

**Una cifra que cruza el piso hacia abajo sola, y ya pasó.** El sentimiento del auditor: medido el
2026-10-18, `chat_post_agenda` tiene **6** conversaciones juzgadas a treinta días y **1** a siete (23 y 0 el
2026-09-28), así que la cifra es `null` en las dos. Cada ventana es un denominador nuevo, y el piso se evalúa en cada una.

---

## 7 · RLS forzada: lo que una migración NO puede hacer

**La regla, en una línea** (`db/migraciones/040_canal_del_mensaje.sql:80-81`):

> «**Una migración solo puede cambiar la FORMA de `negocio.*`, nunca su contenido.** Los datos los
> mueve código que corra como `app_inquilino`.»

**El mecanismo, medido y no supuesto** (`db/migraciones/039_campos_del_crm.sql:207-220`): las tablas
tienen `force row level security`, el migrador es el dueño y `force` también lo alcanza, así que **sin
política propia ve cero filas**. Medido el 2026-09-07; no re-medido.

**El error silencioso que produce.** Un `insert` o un `update` del migrador **recorre cero filas e
informa éxito**. Pasó dos veces antes del 2026-09-15: la `039` sembró cero carpetas del perfil y la
`040` se aplicó a producción etiquetando cero mensajes, sin error.

**La misma trampa, del lado de quien mide.** El migrador y el inquilino devuelven **cero filas sin
error** también al LEER producción; el único camino que ve filas es `scripts/supabase.mjs leer`, que es
el que usa este informe (memoria del proyecto, 2026-09-16). Una consulta de auditoría corrida por el
camino equivocado devuelve «0» y parece una medición.

**La consecuencia práctica para quien construye una cifra nueva.** Toda columna que agrega una
migración nace vacía y se llena hacia adelante (`db/migraciones/048_de_donde_vino_el_lead.sql:47-55`:
«toda pantalla que la use tiene que decir desde cuándo mide»), y su corolario en
`db/migraciones/045_cuando_cambio_el_estado_de_la_cita.sql:56`: «El nulo es *no se sabe cuándo*, nunca
*no cambió*».

**Dónde se resuelve entonces.** El dato se arregla **al leer**, no al migrar: la `040` infiere el canal en
`lib/negocio/ficha.ts:186` (`CANAL_EFECTIVO`) sin tocar una fila. Y cuando hay que escribir, una fase de
`scripts/db.mjs` que corre con el rol que sí ve las filas (sección «Construido en local», 2026-10-16).

---

## 8 · La migración va antes del push, y las tres veces que se rompió

**La regla.** **La migración se aplica ANTES de empujar el código que la necesita. Si eso no se puede,
el código no se empuja.** Es una regla de **orden, no de memoria**.

**El contexto que la hace necesaria.** `docs/OTROS/produccion/DESPLIEGUE.md:395-396`: «Vercel despliega
por push, no por chequeo»; un commit rojo se publica igual, y la protección de rama en `main` con
`verificar` requerido, pendiente según ese documento y `docs/OTROS/capa-base/ETAPA-8.md:170`, **sigue
sin estar**: el 2026-10-18 `gh api …/branches/main` da `protected: false` ([17-LA-PLATAFORMA.md](17-LA-PLATAFORMA.md) § 5.2).

**Las tres veces que se rompió** (documentadas en `git log` antes del 2026-09-15; no re-medibles):

| Fecha | Qué se empujó sin migrar | Consecuencia |
| --- | --- | --- |
| 2026-08-28 | — | La regla se escribe por primera vez |
| 2026-08-31 | Código que consultaba `negocio.analisis_del_agente` y `auditor_activo` | Closer y Setter en 500 (`42P01`) y **el cron caído 69 minutos**, en silencio |
| 2026-09-11 | La `043` (`reservada_el`), empujada después del código | `42703`; una corrida del barrido perdida |

**La corrección que dejó la tercera.** No alcanza con preguntar qué LEE el arranque: hay que preguntar
**qué TOCA la columna nueva, en cualquier sentido** —un `insert` que la nombra rompe igual que un
`select`— y en qué horario corre la tarea (`HORARIOS`, `lib/negocio/barrido.ts:168`; el barrido de
citas va a la hora y tres, `lib/negocio/barrido.ts:252`).

**La comprobación de treinta segundos, antes de cada `git push`:**

```
node --env-file=.env.supabase scripts/supabase.mjs leer \
  "select name from migraciones.migraciones_aplicadas order by name desc limit 1"
ls db/migraciones | tail -1
```

**Cómo se aplica** (pagado el 2026-09-14): `node --env-file=.env.supabase scripts/db.mjs migrar`, no
`scripts/supabase.mjs correr` —la Management API conecta como `postgres`, que no es dueño de nuestras
tablas— y sólo con `.env.supabase`, porque `npm run db:migrar` puede apuntar a la base local.

**Estado el 2026-10-18.** Entraron dieciséis migraciones (`063` a `078`, del 2026-09-30 al 2026-10-15) y **producción
está en la `078`**. La memoria del proyecto registra «migrar y después empujar» en la `063` a la `066`, la `069` a la
`075`, la `077` y la `078`; en la `067`, la `068` y la `076` **no lo verifiqué**, y ningún commit desde el corte nombra un
`42P01` ni un `42703`. **La comprobación hoy da distinto a propósito**: el árbol local llega a la `084` y los ocho commits
del modelo de datos no se empujan sin la aprobación de un ingeniero (sección «Construido en local»).

---

## 9 · El descarte propio: por qué la cancelación se parte en dos poblaciones

**La regla.** Una cita que se cancela porque el lead se arrepintió y una que se cancela porque
**nosotros decidimos que no calificaba** son hechos opuestos. Sumadas dan un número que no describe a
ninguna de las dos.

El vocabulario vive en `lib/ghl/contrato.ts:231` (`ETIQUETAS_DE_DESCARTE`), con su censo en
`:193-230`, y el predicado que lo aplica en `descartado()` de `lib/negocio/citasAlcanzables.ts:68-85`.

**Medido el 2026-10-18, en las tres ventanas que importan:**

| Población | Citas 30 d | Canceladas | Tasa 30 d | Tasa 14 d | Tasa completo |
| --- | --- | --- | --- | --- | --- |
| De contactos descartados | 6 | 5 | — (bajo el piso) | — (2) | 89,2 % (93) |
| El resto | 40 | 14 | **35,0 %** | 37,5 % (16) | 37,6 % (173) |
| **Las dos juntas** | **46** | **19** | **41,3 %** | 38,9 % (18) | 55,6 % (266) |

**El 2026-09-28 casi la mitad de las citas del período (88 de 191) eran de contactos que la empresa MISMA
había rechazado; hoy son 6 de 46**, y en «Completo» siguen siendo 93 de 266, que cancelan al 89,2 % porque su flujo
de descarte las cancela. «Publicar 62,7 % como *tasa de cancelación* le atribuía al negocio la mitad del trabajo de
su propio filtro» (`lib/negocio/indicadoresDeCitas.ts:186-188`, con la medición del 2026-09-14 en `:179-184`).

**Y la cifra que abre la pantalla cambió otra vez sin que nadie la tocara.** El comentario del módulo
publica **33,3 %** (`lib/negocio/indicadoresDeCitas.ts:183`, del 2026-09-14, a catorce días); el 2026-09-15 era
40,9 % a treinta días; el 2026-09-28 a las 22:06 UTC, 32,0 % (33 de 103); el 2026-10-18 a las 15:38 UTC, **35,0 %**
(14 de 40). Con 6 citas de descartados a treinta días, su tasa ya no se publica: está bajo el piso (regla 2).

**Apartar no es esconder** (`lib/negocio/indicadoresDeCitas.ts:190-191`): las descartadas van con su
conteo y su tasa, y las dos poblaciones suman exactamente el total (6 + 40 = 46, medido el 2026-10-18).

**Dónde se trazó la línea, y por qué da igual.** Medido el 2026-09-14 (`lib/ghl/contrato.ts:218-222`):
con las dos etiquetas grandes o con las seis, la cifra del resto daba 33,3 %. Que la conclusión no
dependa del corte se midió antes de elegir; no re-medido hoy.

**Tres detalles que son reglas en sí mismos:**

1. **Todas las cifras de la tarjeta cortan igual**, o las demás hablarían de otra población.
2. **`exists` sobre `unnest` y no `&&` de arreglos** (`lib/negocio/citasAlcanzables.ts:71-73`): las
   etiquetas se guardan crudas y GoHighLevel no garantiza la caja.
3. **Todo en la misma pasada** (`lib/negocio/indicadoresDeCitas.ts:363-365`): dos consultas podrían ver
   estados distintos de la tabla, «y entonces las dos poblaciones de la misma tarjeta no sumarían el
   total, sin que nada falle».

**Una propiedad del dato que hay que decir:** el descarte se lee de las etiquetas **actuales** del
contacto, sin fecha. Una etiqueta puesta mañana reclasifica citas de la semana pasada.

---

## 10 · Un solo escritor por tabla

**La regla.** Cada tabla tiene **un** escritor, declarado en la primera línea de ese archivo, y una
prueba de código lo hace cumplir.

| Tabla | Escritor | Prueba que lo fuerza |
| --- | --- | --- |
| `negocio.mensajes` | `lib/negocio/mensajes.ts:1` — «EL único escritor de `negocio.mensajes`. Ahora sí.» | `pruebas/codigo/111-un-solo-escritor.test.ts` |
| `negocio.citas` | `lib/negocio/citas.ts` (el barrido) | `pruebas/codigo/147-un-solo-escritor-de-citas.test.ts` |
| `negocio.resultados` | `lib/negocio/avanzar.ts:1` — «Avanzar: el ÚNICO lugar donde se registra un resultado» | `pruebas/codigo/132-avanzar-sin-respuesta.test.ts` |
| El sello del setter | — | `pruebas/codigo/112-sello-del-setter.test.ts` |
| Las cuatro de Acquisition (2026-09-30) | `lib/negocio/recolectarAnuncios.ts` y `lib/negocio/funnelDeLaCampana.ts` | `pruebas/codigo/180-un-solo-escritor-de-acquisition.test.ts:50` |
| `negocio.enlaces_de_pieza` (2026-09-29) | el link manual de Creative | `pruebas/codigo/179-url-externa.test.ts:86` |
| `negocio.uso_de_ia` y las tablas de los agentes (2026-10-04) | `lib/agentes/uso.ts` y uno por tabla | `pruebas/codigo/198-el-transporte-de-los-agentes.test.ts:484` |
| `negocio.hallazgos` (sigue siendo del auditor) | `lib/auditor/` | `pruebas/codigo/234-conversation-en-la-tabla-comun.test.ts:132` |

**Por qué existe: el caso de `negocio.mensajes`.** `lib/negocio/ingesta.ts` decía ser «EL único escritor» y era
falso: el chat insertaba directo, con un identificador fabricado, y cada mensaje propio quedaba dos veces. «Y no falla
nada» (`lib/negocio/mensajes.ts:4-24`). La prueba busca la FORMA: todo `insertInto('mensajes')` es un escritor, «se
llame como se llame» (`pruebas/codigo/111-un-solo-escritor.test.ts:55-56`).

**Por qué importa para las cifras** (`pruebas/codigo/147-un-solo-escritor-de-citas.test.ts:14-26`): `inicio_anterior_el`
sólo es correcta si la escribe el `do update` que lee la fila vieja, y un escritor del webhook pondría como fecha de
reserva la hora del aviso, «que se parece tanto a la buena que nadie lo notaría».

**La excepción, y por qué no afloja la regla.** `citas.asistio` tiene un segundo escritor (`avanzar.ts`) porque **el
CRM no la tiene** —3 de 1052 citas, medido en septiembre de 2026—, y el barrido la deja fuera de su `do update`. «No
hay dos escritores de una misma columna: hay dos columnas con un escritor cada una.» La prueba se **afinó**.

**Un corolario para toda prueba de código.** Las pruebas de escritor único leen el archivo **sin comentarios**: «una
prueba que leyera el texto crudo [...] se pondría roja por documentar bien» (`pruebas/codigo/147-un-solo-escritor-de-citas.test.ts:28-32`).

---

## 11 · Una cadena que no es monótona no es un embudo

**La regla.** Una flecha entre dos escalones afirma que el segundo es **subconjunto** del primero. Si
no lo es, la flecha miente aunque los dos números sean correctos — y entonces la cadena se corta ahí y
lo que sigue es una **bifurcación**, con los dos sumandos sumando el total.

**El defecto concreto, re-medido el 2026-10-18** en la ventana con la que abre Lead Flow: entraron **25**, se les
escribió a **20**, respondieron **12**, agendaron **19**. De los 19, **12** habían contestado alguna vez. Una barra de
12 a 19 afirmaría que convirtieron el **158 %**; lo real es 12 de 12. El 2026-09-28 eran 276, 269, 161 y 139, y la
barra habría dicho 86,3 % donde lo real era 45,3 %: casi el doble, con los cuatro números correctos.

| Ventana | Lo que afirmaría el embudo | Lo que es verdad | 2026-09-28 |
| --- | --- | --- | --- |
| 7 días | 100 % (1 de 1) | 100 % (1 de 1) | 200 % contra 100 % |
| 14 días | **120 %** (6 de 5) | 100 % (5 de 5) | 175 % contra 100 % |
| 30 días (la que abre) | **158 %** (19 de 12) | 100 % (12 de 12) | 86,3 % contra 45,3 % |
| completo | 98,4 % (303 de 308) | 59,1 % (182 de 308) | 95,2 % contra 56,7 % |

**Con pocas altas el defecto se ve sin disfraz:** a treinta días agendaron más de los que respondieron, y un
«embudo» dibujado ahí **se ensancharía**, la prueba más directa de que «agendaron» no es un escalón de
«respondieron». (Las cohortes de 7, 14 y 30 días están debajo o cerca del piso: se citan como ilustración.) Desde
CN-3 el front dibuja «Conversaron antes» como parte de los que agendaron, que sí es subconjunto (`lib/negocio/lecturaDeConversation.ts:261`).

**Por qué es cara: no falla.** Los cuatro valores se pueden auditar uno por uno y están bien. Lo único
falso es la flecha, que no es un dato sino un dibujo.

**La forma honesta, y por qué es una regla y no una decisión de diseño.**

1. **La cadena se corta donde deja de ser monótona.** En Lead Flow, en «respondieron»
   (`components/conversation/PanelDeConversation.jsx:522-550@6f3bdb5`), y el pie lo dice
   (`components/conversation/PanelDeConversation.jsx:581-585@6f3bdb5`): «agendar no exige haber contestado».
2. **Lo que sigue es una bifurcación, no un cuarto eslabón**
   (`components/conversation/PanelDeConversation.jsx:552-579@6f3bdb5`).
3. **Los dos sumandos salen de la MISMA pasada que su total** (`lib/negocio/indicadoresDelLead.ts:257-262`),
   y el complemento se calcula en el módulo (`lib/negocio/indicadoresDelLead.ts:315`), no en la pantalla.
4. **Hay una prueba que exige la suma** (`pruebas/base/150-indicadores-del-lead.test.ts:558`) y otra
   que impide confundirla con la tasa de respuesta (`pruebas/base/150-indicadores-del-lead.test.ts:601`).

**Medido el 2026-10-18: la suma cierra, descuadre 0.** 12 + 7 = 19 a treinta días (de los 7, 3 nunca recibieron un
mensaje); 182 + 121 = 303 en «Completo» (19 sin mensaje). El 2026-09-28: 73 + 66 = 139 y 166 + 113 = 279.

**La regla ya se aplicó fuera de Conversation, por construcción.** La cadena de Sales nace monótona
porque cada eslabón exige al anterior, y los intentos que no encajan viajan aparte en `intentosSinCita`
(`docs/sales/14-LOS-CINCO-ESLABONES.md:54` la cita así); y Conversion encontró que su recorrido no pasa
por el mismo sitio para todos —el 44 % agenda sin pisar la landing
(`docs/conversion/03-EL-RECORRIDO.md:62`)— y lo dibuja como dos recorridos y no como un embudo
(`docs/conversion/01-LOS-DOS-RECORRIDOS.md:101`).

**Cómo saber si una cadena nueva es un embudo, antes de dibujarla.** Preguntar si el escalón N+1
**exige** el N. Si se puede llegar al segundo sin pasar por el primero, no hay flecha: hay dos
poblaciones que se cruzan.

---

## Las otras reglas transversales, que no estaban en la lista

Salieron de leer los encabezados de `lib/negocio/*.ts`, `db/migraciones/*.sql` y `pruebas/codigo/*.ts`.
Todas tienen un defecto pagado escrito al lado. Las citas se re-verificaron el 2026-10-18.

**12 · Un solo predicado por concepto.** Dos cifras de la misma pantalla no pueden tener cada una su
definición de «cancelada». El commit `a0e1eb5` encontró `consumoDelPrecall` con `not like 'cancel%'` e
`indicadoresDeCitas` con la lista cerrada `ESTADOS_CANCELADOS` (`lib/ghl/calendarios.ts:192`). **Desde
entonces pasó tres veces más, y las tres con factura:** la llave de la pieza de Creative estaba escrita
cinco veces y dos no eran la misma función (`f9998b6`); «días de la ventana» eran dos predicados y dos
granos dibujados en la misma frase, con un 12,7 % de diferencia (`7d1bc8b`); y una sonda de Sales con un
filtro apenas distinto publicó 26 puntos de brecha entre dos closers que con el predicado compartido
son 14, y 5 en la ventana por omisión (`371c0c5`, `lib/negocio/cierrePorCloser.ts:28`). La regla 30 es
la respuesta estructural. **Y el riesgo del vocabulario sigue vivo:** el 2026-09-15 había 3 citas
`noshow`; 15 el 2026-09-28 y **20** el 2026-10-18, y no están en `ESTADOS_CANCELADOS` a propósito —se cuentan
aparte como plantones (§ 3)—.

**13 · El denominador se elige, y `exists` no es `join`.** Cuando el campo vive en el contacto y la
cifra habla de citas, el denominador son CONTACTOS (`lib/negocio/indicadoresDeCitas.ts:162-164`). Y
siempre `exists`, nunca `join` (`lib/negocio/indicadoresDeCitas.ts:263-264`,
`lib/negocio/indicadoresDelLead.ts:199-200`). Creative midió lo que cuesta: un `join` infló una pieza de
109 a 112 (`lib/negocio/citasAlcanzables.ts:122-124`).

**14 · Mediana y percentiles, nunca promedio.** `lib/negocio/indicadoresDelLead.ts:52-63`: en el tiempo
hasta el primer intento el promedio era 30,6 veces la mediana, y el p90 de la primera respuesta 61
veces el p50 (del 2026-09-15, no re-medida). **Sales encontró el caso extremo** (`fd273a1`,
`lib/negocio/cicloHastaLaCita.ts:17-21`): en el ciclo hasta la cita el promedio (16,47 días) es **más
alto que el p90** (10,62), así que el promedio no viaja en el tipo: «si no está, no se puede dibujar
por descuido».

**15 · Lo que no se puede clasificar se cuenta aparte.** `lib/negocio/consumoDelPrecall.ts:74-85`:
`-20%`, `Clic a link` y `Accede: sin reproducir` no se fuerzan a ninguna rama; son más que los que
completaron el video, y «la bolsa de los no clasificados es más grande que la rama que decidiría».

**16 · Dos regímenes de vocabulario van a la misma rama.** `lib/negocio/consumoDelPrecall.ts:44-50`:
`Sin abrir (0%)` deja de escribirse el 2026-09-08 y `Nada` ocupa su lugar. Si fueran a ramas distintas,
cualquier serie mostraría un derrumbe fantasma el 8 de septiembre.

**17 · El rótulo es parte de la cifra.** `lib/negocio/consumoDelPrecall.ts:22-32`: `Nada` y `Sin abrir`
son el estado inicial que el CRM escribe al agendar, así que la rama se llama «el CRM no registró
reproducción» y no «no vio el video».

**18 · Una cifra medida que llega a una cadena VISIBLE va fechada.** Del commit `a0e1eb5`. Cumplida en
`components/conversation/PanelDeConversation.jsx:131@6f3bdb5` («medido en septiembre de 2026, 3 citas de 1052») y
`:969@6f3bdb5` («las 316 citas que había al medirlo»), el panel de antes de CN-3. **Y su versión para el código:** un comentario con
una cifra medida envejece cada vez que corre el colector, y nada avisa; `7d1bc8b` sacó tres cifras
escritas a mano del encabezado del panel y de la ruta de Creative («5 de 26», que ya era 11 de 26) para
que las calcule la pantalla. Lo que no se puede calcular viaja con su fecha (regla 39).

**19 · Lo que la pantalla mide no puede estar en su lista de «lo que falta».**
`pruebas/codigo/151-lo-que-se-mide-no-se-declara-faltante.test.ts`. Un cartel que se contradice con la
pantalla enseña a no leer los carteles. Es la regla del silencio con otro traje.

**20 · Teniendo datos, la pantalla no se vacía nunca.** `lib/usarLectura.ts`, forzada por
`pruebas/codigo/123-relojes.test.ts` y `pruebas/codigo/131-avisos-desactualizado.test.ts`. El aviso de
una recarga fallida va **al lado** del dato, no en su lugar.

**21 · Todo sondeo repetido pasa por `lib/reloj.ts`.** `pruebas/codigo/123-relojes.test.ts`: pestaña
oculta = cero intervalos. Las cadencias viven en `lib/cadencia.ts`, con `inteligencia` en 60 s
(`lib/cadencia.ts:91`); el comentario de `lib/cadencia.ts:82-85` sigue hablando de catorce días, y el
argumento no depende del número.

**22 · Ninguna ruta autenticada se cachea.** `ADR-0701`, forzado por `pruebas/codigo/70-publicacion.test.ts`
y por `pruebas/codigo/10-arquitectura.test.ts:308`, `:360` y `:403`.

**23 · Toda operación abre el contexto de su organización.** `ADR-0202`, forzado por
`pruebas/codigo/10-arquitectura.test.ts:238`: «olvidarse NO FALLA» (`:10-11`), y en el sistema del que
salen estas notas catorce operaciones ya estaban escritas así (`:17`).

**24 · Toda fecha que una persona lee se formatea en la zona de la ORGANIZACIÓN.** `lib/negocio/tiempo.ts:1-24`
(la regla en `:17`): cuando cada pantalla la calculaba por su cuenta, «dos vitrinas mostraban horas
distintas para la misma cita». La excepción declarada es la frase que arma el servidor, que va en UTC
(`lib/negocio/periodo.ts:166-168`).

**25 · Todos los literales del CRM en un archivo.** `lib/ghl/contrato.ts:1-26`: «un tag mal escrito no
da error. No hace nada» (`:13`).

**26 · Un dato de configuración disfrazado de constante se declara como tal.** `CAMPO_DE_CONFIRMACION`
(`lib/negocio/indicadoresDeCitas.ts:197-208`) y `ETIQUETAS_DE_DESCARTE` (`lib/ghl/contrato.ts:224-226`)
dicen cuándo se mudan a una columna de la organización.

**27 · Leer el catálogo no cambia lo que se muestra.** `campoPorNombre`
(`lib/negocio/camposDelCrm.ts:315`) existe para que agregar un indicador no cambie lo que el closer ve.

**28 · Un módulo que comparten el servidor y el navegador no puede importar nada que toque la base.**
`lib/negocio/periodo.ts:25-34`, forzado por `pruebas/codigo/155-el-periodo-de-conversation.test.ts:244`.
El defecto: `DIAS_DE_TODO` vivía en `indicadoresDeCitas.ts` y arrastró el cliente de PostgreSQL al
paquete del navegador; `next build` lo rechazó. **Desde el 2026-09-26 son dos módulos:**
`lib/negocio/tramosDelIcp.ts:27-32` («Por lo mismo que `periodo.ts`», `b04fb6c`), forzado por
`pruebas/codigo/175-tramos-del-icp.test.ts:111`, que cuenta también los reexportes; y los filtros de
Leads Portal sólo pueden importar dos módulos puros (`pruebas/codigo/177-filtros-del-portal.test.ts:108`).
El corolario: lo que el panel `'use client'` necesita explicar y no puede importar, **viaja en la
respuesta** —las ventanas de Sales con su texto (`c109ebd`), el título de Creative (`7d1bc8b`)—.

**29 · En CSS la especificidad manda sobre el orden.** `app/inteligencia-estetica.css:588-592@a39a732`: el corte
de 640 px tiene que nombrar `:is(.pn-b, .pn-b.q3, .pn-b.q4)` porque el de 900 px pesa más, y sin eso a
400 px el panel queda en dos columnas de 170 px. «Visto en el navegador, no deducido.» La hoja se borró en
CF-3 (`2415e25`, 2026-10-11), cuando la última pantalla de Inteligencia volvió al front del prototipo: la regla queda.

---

## Las reglas que aparecieron entre el 2026-09-16 y el 2026-09-28

Nacieron al construir Acquisition, Creative, Conversion, Sales, Analizadores y Leads Portal. Cada una
con el defecto concreto que cerró y el commit donde quedó.

**30 · Los predicados de las citas viven en UN solo archivo.** `lib/negocio/citasAlcanzables.ts:1-38`
(`1164984`, 2026-09-21). El defecto: la advertencia de no repetirlos ya estaba escrita, y aun así,
medido el 2026-09-21, `ghl_calendario_id is not null` aparecía **once veces en nueve módulos**; cada
cifra nueva de tres departamentos había agregado una copia (`:11-14`). El defecto fino es confundir dos
preguntas: `alcanzable` es de una cita y `tieneCitaAlcanzable` es de una persona, y escribir una como
la otra da «226 citas alcanzables» con el rótulo de «201 contactos» (`:19-30`). Son funciones con alias
y no constantes porque una constante se ata a un nombre de tabla (`:32-37`). Y la mutación mostró por
qué compartir sirve: aceptar las congeladas en el módulo compartido rompe 7 pruebas de tres archivos,
cuando antes mutar el predicado de un módulo dejaba a los otros ocho intactos (mensaje de `1164984`).
**Lo que no quedó en un solo lugar, re-verificado el 2026-10-18:** dos consultas de Conversation
siguen escribiendo el predicado a mano —la confirmación (`lib/negocio/indicadoresDeCitas.ts:270`) y el
precall (`lib/negocio/consumoDelPrecall.ts:201`, que además reescribe `cancelada` como
`<> all(ESTADOS_CANCELADOS)` en `:204`)—, y «agendó» tiene dos definiciones en el producto (§ 4).

**31 · La bandera `sinOperacionesTodavia` y la primera ruta de una pantalla se mueven en el mismo
commit.** La bandera es un cable trampa editado a mano (`lib/autorizacion/secciones.ts:80-91`): la
prueba `ADR-0304` que empieza en `pruebas/codigo/30-portero.test.ts:354` da rojo en las dos
direcciones —una sección con la bandera que sí tiene ruta (`pruebas/codigo/30-portero.test.ts:446-456`),
o una sin la bandera que no tiene ninguna ruta con su `PANTALLA` (`:458-461`)—; `ADR-0303` (`:325`)
vigila que ninguna de las marcadas reciba una operación sin entrar al modelo de permisos; y la lista literal de
`pruebas/codigo/90-fundaciones.test.ts:1266` (hoy `['clientos']`) obliga a decidir en vez de derivar. Sales movió la
cuenta de 3 a 2 en `c109ebd`, Leads Portal de 2 a 1 en `3c361a1` (`app/api/leads-portal/route.ts:3-8`) y el Inicio
de 1 a 0 con el cerebro (`ce8ff6e`, 2026-10-04, `lib/autorizacion/secciones.ts:239`), con pruebas de base que lo exigen
(`pruebas/base/166-la-ruta-de-sales.test.ts:87`, `pruebas/base/177-la-ruta-del-leads-portal.test.ts:115`). El
2026-10-08 entró Client OS con la bandera (`lib/autorizacion/secciones.ts:494`): es una herramienta externa en un
`iframe`, sin operaciones nuestras. El comentario de `pruebas/codigo/30-portero.test.ts:348-350` decía que la lista está vacía; dice `clientos` desde `65669f4`.

**32 · El GET de una pantalla pide exactamente la capacidad que declara su sección.**
`pruebas/codigo/30-portero.test.ts:280` (`c109ebd`). El agujero lo encontró una mutación: `ADR-0304`
comparaba las capacidades de las rutas de una pantalla **entre sí** y nunca contra la sección, así que
cambiar la de Sales a `closer.ver` dejaba la suite entera en verde — y el resultado sería una entrada de
menú que aparece y devuelve 403. Medido sobre las 73 rutas, había una así: Conversation. Se resolvió en
`8dcb619` alineando la **sección** a la ruta (`auditor.ver`, `lib/autorizacion/secciones.ts:333-335`),
no al revés, porque igualarlas por la ruta habría ampliado el acceso a lo más sensible de las dos. Y no
era latente: la pestaña de permisos le ofrecía la casilla de Conversation a un rol con sólo
`tablero.ver`. La lista de excepciones queda declarada y vacía (`pruebas/apoyo/autorizados.ts:862`).

**33 · Lo que viaja al navegador se decide por LISTA BLANCA, y tiene prueba de forma negativa.** Tres
casos, los tres del 2026-09-21 al 26:

- La atribución cruda trae IP, navegador, `fbclid` y direcciones con un token: medido el 2026-09-27
  sobre 593 contactos, `ip` en 331 y 286 direcciones con token (`lib/negocio/atribucionVisible.ts:6-10`).
  Pasan ocho claves de una lista blanca (`lib/negocio/atribucionVisible.ts:51`) y de las direcciones
  sólo el host (`db120a1`); una clave nueva del CRM no aparece sola
  (`pruebas/codigo/176-atribucion-visible.test.ts:59`).
- La fila de Leads Portal tiene **exactamente catorce claves**, sin teléfono ni correo
  (`pruebas/base/175-leads-del-portal.test.ts:431`, `d97848e`).
- Del cockpit de Sales viajan cuatro campos, y los otros cuatro se buscan por nombre en la respuesta
  serializada (`pruebas/base/166-la-ruta-de-sales.test.ts:105`, `c109ebd`): `return ok({ cockpit })`
  los traería con la forma correcta y sin que nada fallara.

Lista blanca y no negra porque con una negra lo nuevo aparece solo (`lib/negocio/atribucionVisible.ts:12-14`).

**34 · Toda prueba nueva se ve roja con su mutación antes de quedar.** Escrita como regla de etapa en
`docs/OTROS/analizadores/ANALIZADORES.md:102` y nombrada en más de la mitad de los commits del
período (39 de 67 commits del 09-15 al 09-28 la nombran; del 09-29 al 10-16, 66 de 137 en `git log 861b5f0..HEAD`).
El defecto que cierra: **en verde no se distingue una prueba que protege de una que no mira nada.**
Tres pruebas de Creative sobrevivían a su mutación (`e9ca19a`): una sembraba diez valores iguales, así
que el promedio, el máximo y el mínimo daban lo mismo; otra no distinguía `null` de `false`; la tercera
probaba un solo lado del borde del piso de días. Una prueba de permisos nació afirmando una cobertura
que no tenía (`8dcb619`), y el agujero de la regla 32 sólo apareció mutando. Los casos están en el error I.

**35 · Las citas `archivo:línea` de los documentos se auditan con una prueba.**
`pruebas/codigo/101-las-citas-de-los-documentos.test.ts` (`371c0c5`, 2026-09-21). El defecto: extraer
`dineroDelMes` acortó `inicio.ts` de 268 a 177 líneas y **trece citas de `docs/sales/` quedaron
apuntando al vacío** en ese mismo commit (`pruebas/codigo/101-las-citas-de-los-documentos.test.ts:10-13`).
La prueba exige que el archivo exista, que la línea esté en rango y que el sufijo no sea ambiguo
(`:176`, `:184`, `:202`). Auditaba `docs/sales`; `docs/leads-portal` entró el día que nació, **esta carpeta el
2026-09-28** (`:39-41`, con el patrón que admite corchetes y el espacio de `estado actual/`, `:77-84`; los dos en
`861b5f0`), y desde entonces cada plan nuevo (`:55-65`). **Lo que no atrapa, y lo dice:** la cita que sigue en rango
y ya apunta a otra cosa (`:17-19`). Es el error J. **Y lo que no mira:** el resto de `docs/conversion/` y de
`docs/acquisition/`, y los comentarios del código. La defensa es fijar la cita a su commit: el 2026-10-18 el árbol de
trabajo tiene las citas que llegan a esta carpeta fijadas a `972972e` (`lib/negocio/cadenaDeCierre.ts:36`, cambio sin
commit), y este corte además no movió ninguna línea citada: § 11 sigue en la 625 y lo nuevo va después del error D.
Una línea corrida en un archivo que la 101 no mira no se pone roja nunca.

**36 · La suite corre en tres zonas horarias.** `America/Lima`, `UTC` y `Asia/Tokyo`, «justamente porque
una cifra que cambia según dónde esté el servidor es indistinguible de una cifra correcta»
(`lib/negocio/periodo.ts:74-77`); una prueba de Mi Día recorre además las tres zonas dentro del mismo
archivo (`pruebas/base/92-mi-dia.test.ts:818`). No es nueva —ya se practicaba el 2026-09-10
(`d4d6ecf`)— pero no estaba en esta lista; 32 de los 67 commits del 09-15 al 09-28 la nombran.
**Su límite, medido en `1164984`:** pruebas de agenda que fallan cerca de la medianoche de Lima, porque la zona de la
organización está fijada en el archivo. La 205 fallaba además toda la mañana y se arregló el 2026-10-07 (`ae30048`); la
27 y la 92 siguen fallando cerca de la medianoche de Lima (memoria del proyecto, 2026-10-06). La CI de `main` está en
verde desde la corrida siguiente a `d0e711c` (2026-10-07), la última roja (`gh run list`, 2026-10-16).

**37 · Antes de la suite, una construcción fresca; y mientras corre, nada más.** Dos pruebas leen la
construcción: `ADR-0601` exige que el paquete sea más nuevo que el código
(`pruebas/construccion/60-el-paquete.test.ts:107`) y `ADR-0701` lee el manifiesto de prerrenderizado
(`pruebas/codigo/70-publicacion.test.ts:62`). Un `.next` viejo las pone en rojo sin que el código tenga
nada, y lo dejan viejo dos cosas que no parecen tocarlo: un script de mutaciones (reescribe archivos con
fecha nueva) y el servidor de desarrollo del preview, que pisa `.next` (medido el 2026-09-26, memoria
del proyecto). Y la suite comparte **una sola base local**: correr otro archivo de prueba durante la
corrida dio 104 fallos fantasma de 1887, y editar un `.ts` importado, 1057 de 1939 (medido el
2026-09-20, misma fuente; `d8b542e` documenta un caso). Es la razón por la que este informe no corrió la
suite.

**38 · Un rojo permanente no se arregla: se ignora, y con él se ignoran los demás.**
`scripts/paridad.mjs:47-50`. Es anterior al corte (`aa4da8e`, 2026-08-23), y siguió decidiendo: las
cinco vistas de Inteligencia **salieron de la comparación con el prototipo** el 2026-09-09, al entrar a
la estética (`833fc51`), en vez de quedar en rojo; con Creative se fueron los pasos que abrían el plan
(`3287f74`); y el 2026-09-26 salió `contacts` con Leads Portal y la lista `VISTAS` quedó vacía
(`aed4f27`, `scripts/paridad.mjs:153`). El mismo archivo dice lo que eso significa de verdad: la
compuerta no está en `.github/workflows/verificar.yml` y hace tiempo que no corre
(`scripts/paridad.mjs:141-146`), así que sacar vistas de ella «es registrar una pérdida que ya había
ocurrido». **No verificado** cuándo corrió por última vez; las comparaciones con el prototipo de CV-5, SA-5, CN-5 y CF-5 (09 a 11 de octubre) se midieron en el navegador, fuera de ella.

**39 · Los huecos se declaran, viajan con su fecha y no se escriben en el JSX.** El defecto
(`0c93853`, 2026-09-19): la decisión era «sólo GHL, y el hueco se declara», y el back de Creative no
publicaba los huecos ni la pantalla los dibujaba — donde la maqueta tenía números inventados, «un hueco
que se omite no se distingue de una regresión». El patrón es `fueraDeAlcance`
(`lib/negocio/calidadDeLaAtribucion.ts:68-69`), y Sales y Leads Portal le agregaron la fecha:
`MEDIDO_EL` viaja con la lista (`lib/negocio/huecosDeSales.ts:46-53`, `app/api/sales/route.ts:101@a39a732`;
`lib/negocio/huecosDelLeadsPortal.ts:37`) porque sin ella «no hay ventas registradas» se lee como un
hecho permanente del producto. **La deuda que trae:** `MEDIDO_EL` es un literal escrito a mano, y envejece
como cualquier cifra de comentario: el 2026-10-18 siguen diciendo el 21 y el 27 de septiembre ([05-SALES.md](05-SALES.md)).

**40 · La cohorte y su resumen salen de UNA sentencia.** `lib/negocio/leadsDelPortal.ts:6-13` (`d97848e`):
la pantalla publica «ICP alto 51» y, debajo, las 51 tarjetas; con dos consultas, un barrido entre una y
otra deja la tarjeta diciendo 51 sobre una rejilla de 52, «y ninguna de las dos está mal». Una CTE arma
una fila por persona y de ella salen la lista y el resumen, que agrupa sin volver a clasificar. Y cuando
dos pantallas publican la misma cifra, la ruta las compara y lo dice en el aviso en vez de elegir una
(`coherenciaConSales`, `lib/negocio/leadsDelPortal.ts:610`, `app/api/leads-portal/route.ts:69-70`). Es la
regla de «todo en la misma pasada» (§ 9) llevada de una tarjeta a una pantalla entera.

**41 · «Los últimos 30 días» pueden ser tres poblaciones: cada una viaja con su nombre y su grano.** En
Sales conviven el mes calendario del dinero, los contactos dados de alta en N días y las citas que
ocurrieron en N días, y **las dos últimas dicen «30 días» y describen poblaciones distintas**
(`app/api/sales/route.ts:23-35`, `c109ebd`); por eso las ventanas viajan descritas en la respuesta
(`lib/negocio/ventanasDeSales.ts`). En Creative, «días de la ventana» sumaba días de gasto por anuncio
contra un denominador de días con impresiones —otro predicado y otro grano, 12,7 % de diferencia— y se
arregló poniendo el grano en el nombre, `anuncioDiasConLaClave / anuncioDiasConEntrega` (`7d1bc8b`),
«porque el comentario no alcanzó». Y el gasto de anuncios cuenta días de calendario y no 24 horas, y lo
declara (`lib/negocio/costoDelAnuncio.ts:37-45`).

---

## Los errores de método que este proyecto ya cometió

Los del A al H son de la foto del 2026-09-15; del I al M, del 16 al 28 de septiembre. Los casos del 29 de
septiembre al 16 de octubre entran en sus letras (C, I y M); ninguno pidió una letra nueva.

## A · Buscar un nombre de columna, no encontrarlo, y concluir que el dato no existe

**Ocurrió tres veces hasta el 2026-09-15, y cuatro más en la semana siguiente.** Las siete, el dato
venía de GoHighLevel y ya estaba al alcance:

| # | Lo que se dio por inexistente | Dónde venía en realidad | Commit |
| --- | --- | --- | --- |
| 1 | `meta_ad_id` | Dentro de `attributionSource`, como `adId` | `54d7ad0` |
| 2 | Las UTM | Ídem, como `utmSource` y compañía | `54d7ad0`, `7e38ddc` |
| 3 | El porcentaje de video visto | Dentro del vocabulario de un campo RADIO | `03fd9a6` |
| 4 | Las métricas de Meta, «sin credencial» | El Ad Manager de Meta, detrás del mismo token del CRM | `3d96e8c` (2026-09-16) |
| 5 | El identificador del conjunto de anuncios | Como `utmTerm`: 9 de 9 cruzan | `c8494e6` (2026-09-16) |
| 6 | Video, clics y vistas de landing | En un campo ANIDADO, `results`, que `numero()` convertía en nulo | `7660d2a` (2026-09-19) |
| 7 | El puntaje ICP, «nada calcula el score» | En `campos_del_crm` desde la `039`, en 471 de 590 contactos | `e350a47` (2026-09-21) |

El cuarto es el más caro: `docs/acquisition/13-EL-CONTRASTE.md` cerraba la carpeta diciendo que faltaba
«una credencial que nadie cargó», y veintiún KPI colgaban de esa frase. El sexto tiene el mecanismo
escrito en su commit: la conclusión salió de mirar las columnas de primer nivel de la respuesta y
extenderla a un campo anidado sin comprobar. El séptimo además escondía una columna que no podía
guardar el dato —`score` era una letra— y lo encontró una prueba nueva, no `tsc`.

**Verificado el 2026-10-18 contra la base:** la atribución trae `sessionSource` en **580 de 624**
contactos, `utmSource` en 516 y `adId` en 215 (553, 511 y 213 de 594 el 2026-09-28); `score` está en
**477 de 624**. La tabla de campos del video (`Video Pre-Call` en 213 de 584; los dos NUMERICAL en 0) es
del 2026-09-15, no re-medida.

**La regla que sale de ahí:** *«Cierto como nombre de campo, engañoso como conclusión.»* Un `grep` sobre
nuestro código prueba qué pedimos, nunca qué manda el proveedor. Antes de escribir «este dato no
existe», hay que medirlo contra la base o contra la respuesta cruda del proveedor, **incluidos sus
campos anidados**.

## B · Escribir el pendiente y creer que es aplicarlo

Detallado en § 8. Tres incidentes, uno silencioso (69 minutos de cron caído). La regla que funciona es
de orden, no de memoria, y hay que preguntar qué **toca** la columna, en cualquier sentido.

## C · Columnas con escritor y sin lector

Un patrón propio. El dato estaba guardado, completo, y ninguna línea del sistema lo consultaba:

| Dato | Cuánto llevaba guardado | Commit que lo conectó |
| --- | --- | --- |
| `atribucion_primera` / `atribucion_ultima` | 4 commits, 544 contactos | `1fce636` |
| `alta_en_el_crm` | 3 commits, 559 contactos | `91e4e07` |
| `analisis_del_agente.sentimiento` | desde que existe el módulo | `ae600f2` |
| `Confirmación Agendamiento` | desde la `039`, 178 contactos (184 medido el 2026-09-28) | `10fde57` |
| `mensajes.fuente`, la entrega, `resultados.salida` | ya poblados | `4f752f7` |
| `ESTADO_NO_APARECIO` (`noshow`) | declarada desde la `038`, 15 citas | `371c0c5` (`lib/negocio/citasAlcanzables.ts:102-103`) |

El coste no es sólo la cifra que falta: es que **se propusieron integraciones externas para conseguir
datos que ya estaban en la base**.

**Estado el 2026-10-18, verificado:** `resultados.cita_id` sigue en **0 de 7**. Y un caso nuevo, abierto: el CRM ya
marca `showed` en 3 citas y `ESTADO_ASISTIO` (`lib/ghl/calendarios.ts:195`) no lo lee ningún archivo de `lib/`.

**Y el patrón volvió por otra puerta: un CAMPO CALCULADO sin lector.** El `aviso` de Lead Flow
(`lib/negocio/indicadoresDelLead.ts:183`) no lo leía nadie hasta AG6 (`13723a0`, 2026-10-05), que se lo pasa al cerebro (§ 1).
Y el período agregó dos casos del mismo tipo, cerrados en `7d1bc8b`: `coberturaMedida` se escribía y
ningún archivo la leía, y el click-to-landing de Creative «se calculaba, se probaba, viajaba y no se
dibujaba». Ninguna búsqueda de columnas lo habría visto: **el escritor y el lector de un campo calculado
están los dos en el código, y la distancia entre ellos es la misma.** Se detecta preguntándole al campo
quién lo consume, no al módulo si lo produce.

## D · Concluir una tendencia de un sesgo

La tasa de cancelación subía hacia el presente —61,9 % a siete días, 60,1 % a catorce, 52,9 % a
treinta, 50,6 % en total— «y eso se parece a una tendencia. No lo era»
(`lib/negocio/indicadoresDeCitas.ts:6-9`). Era la proporción creciente de citas congeladas en las
ventanas más largas. **Antes de leer una serie por período, hay que preguntarse si la cobertura del
dato es constante en el tiempo.**

**Y volvió a pasar con el mismo mecanismo y una diferencia que lo empeoraba:** el booking rate de Lead
Flow caía de 50,0 % a 44,8 % a 34,1 % al ensanchar la ventana, y la caída era el filtro de congeladas
(§ 4). Entonces había que escribir una consulta para producir el sesgo; acá **había cuatro botones que lo
producían en un clic**. Las dos veces el culpable fue el mismo: **la cobertura del dato no es constante
en el tiempo, y el control no lo decía.** Lo general: un control que ofrece ventanas donde la cobertura
cambia tiene que declarar ese cambio en cada una.

**Lo que se construyó para eso, desde el 2026-09-16:** `avisoDeLaCola` compara dónde cae la mitad de
las filas con la fecha que promete `desde` y avisa cuando `desde` describe a un caso suelto
(`lib/negocio/periodo.ts:111-147`); lo usan los dos módulos de Conversation y Leads Portal. Acquisition
lo tomó como requisito —cada período declara la cobertura del dato en ese período— en su § A5-23. **Y la
lectura de hoy trae un sesgo que ningún aviso declara:** desde el 2026-09-14 entraron 29 contactos, así que la
ventana de treinta días (25 contactos) describe sólo al negocio de después de la caída de altas, y «Completo» (600)
casi sólo al de antes; y la pauta casi desapareció de la cohorte —5 de 25 vienen de Paid Social, contra 252 de 276 el
2026-09-28 (§ 2)—. Comparar las dos ventanas compara dos negocios. No es un defecto de cálculo; es la pregunta que
hay que hacerse antes de leer una caída.

## E · Aflojar una prueba en vez de corregir la cohorte que medía

Al corregir la cohorte de Lead Flow, dos pruebas que afirmaban que el closer NO cuenta pasaron a
afirmar lo contrario. El commit `91e4e07` lo argumenta: «no es aflojar una prueba, es corregir la
cohorte que medía». La distinción tiene que quedar escrita, o el próximo cambio de prueba se justifica
solo.

## F · Pruebas que fallan sobre un archivo correcto

Dos casos en `1fce636`: una buscaba una guarda en una ventana de 300 caracteres y otra anclaba en una
frase que también aparece en un comentario. «Una prueba que falla cuando todo está bien es una prueba que
alguien apaga» (`pruebas/codigo/151-lo-que-se-mide-no-se-declara-faltante.test.ts:26-27@6f3bdb5`). Se
reescribieron para afirmar **la propiedad** y no **la distancia**. Es la otra cara del error I.

## G · Nombrar un agente a mano

La tarjeta de sentimiento escribía `'chat_pre_agenda'` en la ruta y
`pruebas/codigo/114-derivacion-del-nivel.test.ts` la rechazó. **Las listas salen de una constante, no
del teclado.** Los agentes de IA lo llevaron a los modelos: cada agente nombra su modelo con una constante de
`lib/agentes/modelos.ts`, y `pruebas/codigo/199-los-modelos-de-los-agentes.test.ts:19` exige que sea uno válido.

## H · Creer que revisar el código alcanza para revisar una pantalla

El rediseño de Conversation dejó cuatro defectos y **tres aparecieron mirando**; el cuarto lo cazó
`next build`, que es el caso feliz de la regla 28.

| Qué estaba mal | Dónde quedó escrito | Cómo apareció |
| --- | --- | --- |
| El vocabulario de períodos metía el cliente de PostgreSQL en el paquete del navegador | `lib/negocio/periodo.ts:25-34` | Lo rechazó `next build` |
| La columna del nombre medía **397 px** a 1280 y el rótulo quedaba a 400 px de su número | `app/inteligencia-estetica.css:310-313@1971ab2` | Mirándola |
| A 400 px el panel seguía en dos columnas: la especificidad le ganaba al orden | `app/inteligencia-estetica.css:588-592@a39a732` | Mirándola a 400 px |
| El precall decía el mismo número dos veces | `components/conversation/PanelDeConversation.jsx:774-776@6f3bdb5` | Mirándola |

**Y se repitió en el período, más grande.** A 375 px la barra lateral no colapsaba y al cuerpo le
quedaban **75 píxeles** en las doce pantallas, «y no lo veía ninguna prueba porque no hay nada que
falle» (`1020412`, 2026-09-20); al arreglarlo, tres pantallas seguían desbordando de costado
(`0810498`). Y abrir Conversion «en los dos temas y los tres anchos» encontró tres defectos que no eran
cifras —la frase, la alineación y el ancho—, uno de ellos un «A y B y C» que sólo aparece con tres
familias (`00e251d`). Del 09 al 11 de octubre, Conversion, Sales, Conversation y Creative cerraron su vuelta al
prototipo con una comparación medida en el navegador (CV-5, SA-5, CN-5 y CF-5). **Medir antes de arreglar vale también
para lo que se ve.**

**Lo que sigue pendiente, dicho como corresponde:** esas verificaciones se hicieron en el preview local, con la base
sembrada o con una respuesta sintética. **No verificado** que alguien haya abierto Conversation, Sales, Creative o
Acquisition con sesión y datos reales de producción: las revisiones del usuario figuran como pendientes en la memoria
del proyecto, y la prueba de humo de Leads Portal también ([10-LEADS-PORTAL.md](10-LEADS-PORTAL.md)).

## I · Una prueba en verde que no mira nada

El defecto que la regla 34 existe para atrapar, con los casos del período:

- **El fixture que no distingue** (`e9ca19a`): diez leads con `icp: '50'` hacen que promedio, máximo y
  mínimo den 50, así que cambiar `avg` por `max` dejaba la suite en verde. Ahora son nueve dieces y un
  cien.
- **El comentario que promete más de lo que la prueba cubre** (`8dcb619`): «la pestaña de permisos no
  ofrece una casilla que daría 403» seguía verde con la causa mutada; se quedó, con el comentario
  reescrito para decir qué protege y qué no. «El comentario anterior le atribuía una cobertura que no
  tiene, y eso es el defecto, no la prueba.»
- **El cable que no casaba nunca** (`c109ebd`): insertado con un script, el `\b` de la expresión se
  convirtió en un carácter BACKSPACE invisible en el editor y en `grep`, y el cable pasó todas sus
  mutaciones sin mirar nada. Costó ocho turnos encontrarlo.
- **La ventana que nadie probaba** (`7d1bc8b`): poner `ventanaDeMetricas` en 999 días dejaba la suite
  entera en verde.
- **La prueba que pasó a mirar nada sin que cambiara una línea suya** (2026-10-08): `30-portero` exige que las
  secciones marcadas no tengan operaciones; desde el cerebro (`ce8ff6e`) la lista quedó vacía y la aserción no
  miraba nada, y su comentario lo dice (`pruebas/codigo/30-portero.test.ts:348-350`). Con Client OS volvió a tener
  una, y el comentario quedó viejo (regla 31) hasta el 2026-10-18 (`65669f4`), que lo corrigió.

La lección: una prueba se da por buena cuando se la vio roja por la razón correcta, no cuando está
verde.

## J · Una cita `archivo:línea` que sigue resolviendo y muestra otra cosa

Borrar la maqueta de Acquisition dejó **374 citas** apuntando a un archivo que ya no está, y **11
seguían resolviendo y mostraban otra cosa**: «una línea corrida no falla» (`c8494e6`, 2026-09-16). Se
repitió con las trece citas de `docs/sales/` que motivaron la regla 35 (`371c0c5`) y con cinco citas
corridas en Creative, entre ellas dos citas de la `053` que señalaban un ternario y un `leftJoin`
(`7d1bc8b`). Y se repitió en esta carpeta: al rehacer este corte, de las 524 citas que traían este documento y
[09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md), 25 resolvían y mostraban otra cosa —una ruta que pasó de la línea
61 a la 62, una prueba de la 82 a la 87, una lista de la 811 a la 825— sin que la 101 dijera nada. Lo que no se pudo
reapuntar al mismo contenido se fijó a su commit (`archivo:N@sha`). La prueba de la regla 35 atrapa la mitad cruda;
la otra mitad sólo la atrapa releer la línea citada.

## K · Medir con una sonda propia en vez de con el predicado compartido

La tabla por closer de Sales se justificaba con «69,1 % de cancelación contra 42,6 %, veintiséis
puntos». La sonda contaba citas de descartados y metía los `noshow` entre los cancelados; con el
predicado de `citasAlcanzables.ts` son 14 puntos, y en la ventana por omisión 5, con uno de los dos
closers a una cancelación de caer bajo el piso (`371c0c5`). La cifra estaba en seis documentos. **Una
cifra de un documento se mide con el mismo predicado que la pantalla, o describe otra pantalla.** Las consultas
de este corte copian los predicados de `lib/negocio/citasAlcanzables.ts` (sección final).

## L · Creer que un sello de éxito prueba que algo avanzó

El colector de anuncios estuvo atascado en producción: el sello decía `corrio`, las 39 llamadas eran
reales, y la fecha más nueva guardada no se movía, porque la ventana iba en orden cronológico y el
presupuesto cortaba por el final. **Y el primer arreglo introdujo el defecto contrario**: invertir el
orden hacía que lo que el presupuesto sacrificaba quedara perdido por construcción. Lo encontró una
revisión adversarial con dos escépticos por hallazgo, que ejecutaron la función real (`be7ef03`,
2026-09-18): «una marca de agua no puede describir un conjunto con agujeros». La ventana ahora sale de
lo que FALTA. **Y volvió con el gasto**: el colector pedía 13 de las 61 campañas de la cuenta, el sello decía `corrio`
y una campaña de mensajes no entraba nunca; la `076` (`22ec755`, 2026-10-07) lee la serie de toda la cuenta y el
sello dice cuándo Meta no está vinculado (`lib/negocio/barrido.ts:1110-1113`).

## M · Un comentario que afirma sin medir

Un comentario falso es un defecto de primera clase, porque es lo que alguien lee antes de tocar el
código. Casos, todos medidos después de escritos:

- `esquema.ts` decía que «nada calcula el score», y de ahí salió la decisión de protegerlo como dato
  nuestro (`e350a47`); el CRM lo calculaba (error A, fila 7).
- El comentario del click-to-landing afirmaba un piso que no existía (`7d1bc8b`).
- `lib/negocio/atribucionDelLead.ts:148-150` afirma usar «el mismo filtro de cita alcanzable que el
  booking rate», y desde el 2026-09-16 no es el mismo (§ 4). **Sigue abierto el 2026-10-18.**
- `lib/negocio/periodo.ts:48` y `pruebas/codigo/155-el-periodo-de-conversation.test.ts:98` dicen que la
  fila más vieja del CRM es de 2026; `min(alta_en_el_crm)` es **2025-08-08** (medido otra vez el 2026-10-18).
  **Sigue abierto** (sección final).
- `lib/negocio/periodo.ts:76-77` decía que todas las ventanas del sistema son móviles; desde CV-1 (2026-10-08) los «7
  días» y «30 días» de Acquisition y Conversion son días cerrados (regla 47). **Cerrado el 2026-10-18 (`65669f4`)**:
  hoy dice que las ventanas eran móviles y que Acquisition, Creative y Conversion pasaron a días cerrados.
- `pruebas/codigo/30-portero.test.ts:348-350` decía que la lista de secciones sin operaciones está vacía; desde el
  2026-10-08 tiene a Client OS (regla 31). **Cerrado el 2026-10-18 (`65669f4`)**: hoy dice que sólo queda `clientos`.
- Los demás que encontró esta foto —la 053 y `costoDelAnuncio.ts` en Acquisition, `conexion.ts` y
  `recolectarActivos.ts` en Meta, `barrido.ts`, `secciones.ts`, `citasAlcanzables.ts` y `Credenciales.jsx`— se
  cerraron en el mismo commit, sin mover ninguna línea (cada uno en el archivo de su sección, y
  [09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md) § 14).

---

## Las reglas que aparecieron entre el 2026-09-29 y el 2026-10-16

Van acá, después de los errores, y no detrás de la regla 41, para no correr las líneas de este documento que otros
archivos citan (regla 35). Nacieron con Acquisition, la nueva estructura, los agentes de IA y la vuelta de las
pantallas al front del prototipo; la 52 es vieja y no estaba en la lista.

**42 · Un solo camino hacia afuera, y uno solo hacia el modelo.** `fetch(` aparece en exactamente tres archivos
(`lib/http/cliente.ts:235-236`), forzado por `pruebas/codigo/30-portero.test.ts:546` (`ADR-0305`): todo pedido del
servidor a un tercero sale por `pedirExterno` (`lib/http/cliente.ts:348`), porque un segundo cliente traería el manejo
de errores opuesto. Los agentes nuevos llegan a Anthropic sólo por `llamarAlModelo`, que sale por `pedirExterno` con
la dirección de `lib/agentes/proveedor.ts` (`lib/agentes/llamada.ts:9-10`, `d75f3be`, 2026-10-04); un reintento y sólo
si el fallo es pasajero; nunca dentro de una transacción abierta (`:40-41`); y nunca una herramienta forzada, porque
`claude-sonnet-5-5` la rechaza con un 400 (`:45-52`). Lo fuerza `pruebas/codigo/198-el-transporte-de-los-agentes.test.ts:159`,
y nadie más escribe la dirección de la API (`pruebas/codigo/171-transporte-del-analizador.test.ts:198`).

**43 · El uso de la IA se cuenta sin guardar ningún texto, y un fallo se nombra.** `negocio.uso_de_ia` (`069`) guarda
una fila por llamada —agente, modelo, cuatro contadores de tokens, duración y resultado— y «ningún texto»: ni el
prompt ni la respuesta, y `ref` acotada para que no se vuelva uno (`db/migraciones/069_el_uso_de_la_ia.sql:26-29`,
`:71-72`). Una columna nueva ahí es una decisión: la forma la fija `pruebas/base/200-el-uso-de-la-ia.test.ts:272`. Y
un fallo del modelo dice qué pasó, a quién le toca y una referencia que es la misma en la pantalla, en el registro y en
`negocio.incidentes` (`pruebas/codigo/183-fallo-del-modelo.test.ts:1`, `:38`; `c936b24`, 2026-10-01). Y el error de
un análisis ya no guarda el comienzo de la respuesta del modelo, que empezaba por los datos del cliente
(`pruebas/codigo/201-el-error-del-analisis.test.ts:66`). Medido el 2026-10-18: **208 filas** de
uso desde el 2026-10-05 y **1** incidente.

**44 · El cerebro lee lo mismo que la pantalla, fuera de toda transacción, y sólo lo que se le ofrece.** Cada sección
tiene su `app/api/<carpeta>/cerebro/route.ts` (`ce8ff6e` a `854a3da`, 2026-10-04 y 05). Tres reglas con su prueba: el
modelo no se espera dentro de `conOrganizacion(` (`pruebas/codigo/207-el-cerebro-fuera-de-las-transacciones.test.ts:56`);
lo que se ofrece es el permiso —quien ve una sección recibe exactamente sus herramientas
(`pruebas/codigo/214-lo-que-se-ofrece-al-cerebro.test.ts:57`)—; y una cifra de la respuesta sin evidencia válida se
quita y se dice (`pruebas/codigo/208-la-respuesta-del-cerebro.test.ts:47`). El tope del proveedor, 20 herramientas
estrictas (`lib/agentes/llamada.ts:121-125`), lo encontró la primera evaluación real: al administrador se le ofrecían 31
y cada pregunta daba 400 (`b6eed36`); lo vigila `pruebas/codigo/212-los-esquemas-del-cerebro-son-estrictos.test.ts:59`.

**45 · Una señal nombra un identificador, nunca a una persona, y no existe bajo el piso.** `negocio.senales` (`072`,
`d715b2a`, 2026-10-05) es una tabla común para los cuatro departamentos: la huella —departamento, regla, entidad,
ventana— impide que una señal descartada renazca mientras su condición siga, la entidad es un id y no un nombre, y no
hay texto libre de personas (`db/migraciones/072_las_senales.sql:15-26`); con menos de 10 no hay señal
(`db/migraciones/072_las_senales.sql:58`). Los detectores corren a la hora y veintitrés (`lib/negocio/barrido.ts:364-370`),
y lo fuerzan `pruebas/codigo/221-el-detector-de-acquisition.test.ts:141` y
`pruebas/codigo/234-conversation-en-la-tabla-comun.test.ts:101`. **Y las dos excepciones con datos de personas tienen
su regla:** el Brief del closer es el agente que manda al modelo datos de una persona (`lib/agentes/brief/entrada.ts:14`),
sin teléfono ni correo (`pruebas/codigo/232-el-brief-cada-dato-con-su-fuente.test.ts:96`); y ninguna evaluación real
corre sin `--confirmo N` con el número exacto de pedidos (`scripts/evaluar-agentes.mjs:9-13`,
`pruebas/codigo/204-el-guion-de-evaluacion-pide-el-numero.test.ts:40`), ni el sembrado de los agentes contra una base
remota (`pruebas/codigo/203-el-sembrado-de-los-agentes-es-local.test.ts:47`). Medido el 2026-10-18: 30 señales y
**1.152 planes** en 11 organizaciones, aunque sólo una tiene datos (el plan vacío es la marca de «ya corrió hoy»).

**46 · Cada tabla de Acquisition tiene un escritor, y quien asigna un funnel lo audita.** `campanas`,
`gasto_de_la_cuenta` y `lecturas_de_gasto` las escribe el colector y `funnels_de_campana` su módulo
(`pruebas/codigo/180-un-solo-escritor-de-acquisition.test.ts:50`, `e77d31f`, 2026-09-30). Es la regla 10 aplicada a un
departamento entero. Medido el 2026-10-18: `negocio.funnels_de_campana` tiene **0 filas** —ninguna campaña asignada—.

**47 · Dos regímenes de ventana, y el día es el de la empresa.** Las ventanas de `lib/negocio/periodo.ts` son móviles
(`now() - make_interval`); desde CV-1 (`71c71b8`, 2026-10-08) los «7 días» y «30 días» de Acquisition y Conversion son
días CERRADOS en la zona de la empresa —el comentario de `lib/negocio/periodo.ts:76-77` lo dice así desde `65669f4`— (`lib/negocio/diasCerrados.ts:16`, `:82-88`), y Conversion arma su cohorte con
la misma expresión que Acquisition (`pruebas/base/246-pasos-de-conversion.test.ts:226`). Lo que no se arregló está
diagnosticado y dejado para después (`d17e029`): las ventanas ancladas a `current_date` usan el día UTC de la base y no
el de la empresa (`docs/OTROS/futuro/el-dia-de-la-empresa.md:8-13`). Medido el 2026-10-18: **9 de las 11 empresas
activas** tienen la zona `UTC`; la que tiene datos tiene la suya.

**48 · Las pantallas hablan de tú, nunca de vos.** `pruebas/apoyo/voseo.ts:8-9` es una lista de formas vistas en
pantalla, no una regla gramatical (`:3`), y `pruebas/codigo/202-tools-no-vosea.test.ts:39` la pasa por
`components/tools`, `lib/tools` y `app/api/tools` (`:40-44`, `5d60371`, 2026-10-04). Mira sólo Tools, y al corte los
textos de la conexión con Meta (`lib/meta/graph.ts:68`, `:74`; `components/ajustes/ConexionConMeta.jsx:36`) voseaban
sin que nada fallara. **Desde el 2026-10-18 (`65669f4`)** esos textos hablan de tú y la regla la vigila también
`pruebas/codigo/258-la-aplicacion-no-vosea.test.ts:79-89` en `components/`, `lib/` y `app/` enteros, sin comentarios y
fuera de Fundaciones, que es de la rama `feature/icp-oferta-v2` (`:16`). No exige todavía que toda la aplicación hable de tú: exige
que nada vosee fuera de `TODAVIA_VOSEAN` (`:27-66`), los 38 archivos que vosean hoy, y que la lista no tenga entradas muertas
(`:92-96`), así que sólo puede achicarse. El voseo del resto de la aplicación quedó contado y vigilado, no corregido
([09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md), sección de lo nuevo).

**49 · La marca se pinta en capas, y una sola paleta.** La capa de la marca va debajo de la aplicación y la de su
alcance encima (`app/globals.css:22`, `pruebas/codigo/184-la-marca-en-dos-capas.test.ts:33`); la aplicación es sólo
oscura (`app/tema.ts:33`, `pruebas/codigo/186-solo-oscuro.test.ts:32`), con Geist cargada por `next/font`
(`pruebas/codigo/187-la-letra-de-la-marca.test.ts:35`) y un solo acento con contraste de 4,5 a 1
(`pruebas/codigo/188-la-paleta-de-la-marca.test.ts:244`, `:275`). El defecto, en su encabezado: «un recolor se rompe
en verde». Todo de E1 a E5 de la nueva estructura (`6d32f91` a `7ab823d`, 2026-10-01).

**50 · El menú reparte lo que el portero ya dejó pasar, y la sesión llega entera.** `lib/autorizacion/departamentos.ts`
«reparte lo que el menú ya dejó pasar» (`:1-37`, `4742d74`): ninguna regla de acceso vive ahí, y toda sección del menú
cae en un solo lugar (`pruebas/codigo/191-los-departamentos.test.ts:92`); la barra lee la navegación de la sesión y
nada más (`pruebas/codigo/193-la-barra-lateral.test.ts:121`). Y toda clave que la ruta de sesión manda llega al
contexto, salvo las declaradas (`pruebas/codigo/185-la-sesion-llega-entera.test.ts:100`): «Eliminar» no aparecía para
nadie porque `app/guardia.tsx` no copiaba una clave (`34e966c`, 2026-10-01).

**51 · Una lectura por pantalla, con el piso en toda tasa y sin párrafos.** Desde la vuelta al front del prototipo
(2026-10-08 a 11), la ruta, el cerebro y el detector leen la misma lectura: `lib/negocio/lecturaDeConversation.ts:12`,
`lib/negocio/lecturaDeCreative.ts:13`, `lib/negocio/lecturaDeSales.ts:1-15` y, para Conversion,
`lib/agentes/detectores/conversion.ts:5-12` (`b2dcdf5`), con la prueba que compara la cifra del cerebro con la de la
pantalla (`pruebas/base/215-la-cifra-del-cerebro-es-la-de-la-pantalla.test.ts:118`). Toda tasa lleva el piso de 10
sobre su denominador (`lib/negocio/lecturaDeConversation.ts:18`, `pruebas/codigo/250-lectura-de-conversation.test.ts:72`),
cada «—» viaja con su motivo, y la pantalla es un tablero sin párrafos: los avisos viajan y los da el agente
(`components/conversation/PanelDeConversation.jsx:30-31`). Es la regla 40 llevada a todas las pantallas.

**52 · Toda ruta declara su `PANTALLA`, o dice por qué no.** Una operación nueva nace cerrada: cada manejador exporta
`PANTALLA` o está en `SIN_PANTALLA` (`lib/autorizacion/secciones.ts:522`), y `pruebas/codigo/30-portero.test.ts:363-373`
lo exige (`433ca86`, 2026-08-21). Es lo que ata una ruta a la capacidad de su sección (reglas 31 y 32). Contado el
2026-10-18: 111 archivos `route.ts` bajo `app/api/`, 82 con `PANTALLA` y 29 en la lista.

---

## Construido en local, sin subir: el modelo de datos multiempresa (pendiente de aprobación)

**Estado.** Ocho commits del 2026-10-16, `693a383..dc84cb2`, con las migraciones `079` a `084`, están en el árbol y
**no en producción**: esperan la aprobación de un ingeniero, y se suben en el orden de
`docs/modelo de datos/20-PLAN-DE-SUBIDA-FASE-0.md` (carpeta local, fuera de git). Nada de lo que sigue vale todavía
para la base de producción; sí para el código del árbol y para la suite local.

- **La segunda llave de aislamiento.** Además de `org_id`, las 39 tablas de negocio de una cuenta llevan `cuenta_id`
  —la subcuenta de GoHighLevel— y una política que exige `app.cuentas`: `'*'` ve todas las cuentas de la
  organización y **sin la variable no se ve nada** (`lib/datos/contexto.ts:49-60`). La pone `conOrganizacion()` y sólo
  ella (`:146-147`, verificada en `:160`; `pruebas/codigo/10-arquitectura.test.ts:443`), así que la regla 23 gana una
  mitad: abrir el contexto de la organización ahora también abre el de sus cuentas.
- **Los regímenes de negocio.** Cada tabla es de una cuenta, de una cuenta o de la organización, o sólo de la
  organización, y la lista es a mano porque el régimen es una decisión (`pruebas/apoyo/regimenes-de-negocio.ts:1-19`);
  `pruebas/base/257-el-modelo-fase-0.test.ts:79` pone la suite en rojo si una tabla no tiene régimen o tiene dos.
- **El revisor del migrador.** Sigue prohibiendo `no force row level security` (`lib/datos/migrador.ts:131`), suma
  los esquemas `catalogo`, `sistema` e `ingesta` (`:70`), no le pide `org_id` a una partición (`:177`) y acepta
  `aplicar_aislamiento_de_cuenta` como aislamiento (`:208`).
- **Las fases de relleno.** Como el migrador no ve filas (regla 7), las filas que ya existen reciben su cuenta con dos
  fases de `scripts/db.mjs`: `cuentas`, como `app_identidad` (`scripts/db.mjs:478`), y `cuenta-en-negocio`, como
  `app_inquilino` dentro de `conOrganizacion` (`:514`). La cuenta en negocio va en tres pasos: la `082` la agrega nula
  con un puente, la fase rellena y la `083` la vuelve obligatoria con la política por cuenta
  (`db/migraciones/082_la_cuenta_en_negocio_expandir.sql:4-21`).
- **Lo demás.** El idioma común compartido sin `org_id` (`079`), las cuentas (`080`), la bandeja de lo crudo con una
  sola puerta (`081`) y los eventos de sólo agregar, con particiones que nacen cerradas (`084`,
  `pruebas/base/257-el-modelo-fase-0.test.ts:654`).

## Construido en local, sin subir: el nivel 3 (los clientes de nuestros clientes)

**Estado.** Los commits del 2026-10-18, `21556cd..18f61d6` y el Bloque C `00ccfee..ca5fcdc`, con las migraciones
`085` a `093`, están encima de la Fase 0 y, como ella, **no en producción**: suben después de su aprobación, en el orden del plan de subida local. Los niveles
son tres: ARIA (la organización principal), las empresas (`identidad.organizaciones`) y los clientes de cada empresa
(`identidad.cuentas`). En pantalla se dice «Empresa» y «Cliente»; la palabra «cuenta» no aparece.

- **El ámbito y la tercera variable.** `conOrganizacion` recibe la organización o un ámbito
  (`lib/datos/contexto.ts:86`, `lib/datos/contexto.ts:156`) y pone tres variables: `app.org_id`, `app.cuentas` y
  `app.toda_la_organizacion`. `'*'` sólo vale con `'si'` (`lib/datos/contexto.ts:98`), así que la regla 23 gana otra
  mitad. Con `'no'` —el cliente final— la base le cierra lo de la organización, las filas sin cuenta y las personas
  (`db/migraciones/086_la_organizacion_entera.sql:63`, `db/migraciones/086_la_organizacion_entera.sql:248`); la
  excepción son los sellos del cron sin cuenta, que sólo lee, para saber si sus pantallas están al día
  (`db/migraciones/086_la_organizacion_entera.sql:240`). Las pantallas del
  cliente —Leads y Sales, con sus cajas del cerebro— abren su ámbito con `ambitoDe` (`lib/autorizacion/ambito.ts:22`):
  con un cliente enfocado, la pantalla y el cerebro dan la misma cifra (regla 51). Lo exige
  `pruebas/codigo/265-las-rutas-del-cliente-abren-su-ambito.test.ts:24`.
- **La cuenta por omisión.** Una por empresa (`db/migraciones/085_la_cuenta_por_omision.sql:31`): recibe lo que entra
  con las credenciales de la empresa, y el puente cae en ella cuando la empresa tiene dos o más clientes
  (`db/migraciones/085_la_cuenta_por_omision.sql:59`). Dar de alta un segundo cliente no corta la ingesta.
- **El cliente final.** `usuarios.limitado_a_cuentas` (`db/migraciones/087_el_cliente_final.sql:23`): sin filas en
  `usuarios_cuentas` no ve **ninguna** cuenta, no todas. Sólo tiene roles restringidos y nada de la plataforma, y la
  base lo mira en cada fila, no al confirmar (`db/migraciones/087_el_cliente_final.sql:87`). El portero lo deja sólo en
  sus pantallas (`lib/autorizacion/portero.ts:227`, `lib/autorizacion/cliente.ts:23`).
- **La foto de los negocios, con un solo escritor.** `negocio.foto_de_las_empresas` y `negocio.foto_de_las_cuentas`
  viven bajo la principal, que un disparador exige (`db/migraciones/089_la_foto_de_los_negocios.sql:126`); no guardan
  nombres, y nulo es «sin medir». Las escribe sólo `tomarLaFoto` (`lib/cartera/foto.ts:159`), en la tarea `foto` del
  cron, que es de la plataforma como la sonda (`lib/negocio/barrido.ts:120`, horario en `lib/negocio/barrido.ts:382`).
  Lo exige `pruebas/codigo/271-el-contrato-de-la-foto.test.ts:76`.
- **El tablero de Negocios.** La primera entrada de Client Success, sólo del superadministrador y desde la principal
  (`app/api/negocios/route.ts:33`): la configuración en vivo, leída de identidad como presencias
  (`lib/cartera/configuracion.ts:70`), y las cifras de la foto (`lib/cartera/tablero.ts:296`). Las cifras de arriba no
  cuentan a ARIA ni a los clientes de prueba, y nunca suman monedas distintas.
- **La ingesta es de UN cliente (Bloque C).** Todo lo que entra del CRM o de Meta se escribe en el ámbito de su
  cliente, con un tipo que lo exige (`AmbitoDeUnCliente`, `lib/negocio/ambitoDelCliente.ts:26`): con la empresa entera
  y dos clientes, el puente lo dejaba en el principal. Las rutas manuales traen a cada cliente (G4, más abajo); el
  principal solo lo abre el barrido de una empresa sin su lista de clientes (`lib/negocio/ambitoDelCliente.ts:48`).
  Las claves de `ingesta_pulso`, `gasto_de_la_cuenta`, `avisos_del_crm` y
  `tareas_programadas` llevan el cliente (`db/migraciones/090_las_claves_con_cuenta.sql`, cerradas en la `092`).
- **Cada credencial dice de qué cliente es.** Los resolvedores del CRM y de Meta piden el cliente, sin opcional
  (`lib/credenciales/resolver.ts:58`): el principal lee las de la empresa; los demás, las suyas, siempre por
  (organización, cliente) (`lib/credenciales/resolver.ts:66`), y sin las suyas FALTAN, nunca caen a las de la empresa.
  Quien quiere la de la empresa lo escribe (`'la_de_la_empresa'`). El aviso del CRM entra al cliente de su secreto
  (`app/api/avisos/crm/route.ts:150`). Lo exige `pruebas/codigo/277-cada-credencial-dice-de-que-cliente-es.test.ts:72`.
- **El cron barre por cliente.** Las tareas de un cliente (`lib/negocio/barrido.ts:131`) corren una vez por cliente
  activo, con sus credenciales, que la ruta resuelve por cliente (`app/api/cron/route.ts:230`); las de la empresa, una
  vez. Todas en un orden global por su propio sello (`lib/negocio/barrido.ts:656`), con el presupuesto mirado antes de
  cada una (`lib/negocio/barrido.ts:695`), y cada sello con su cliente. La frescura de una pantalla es la de su
  cliente, o la del peor activo a la vista (`lib/negocio/frescura.ts:200`).
- **Las rutas manuales traen a cada cliente (C5 · G4).** «Traer del calendario», el tic de la ingesta y «Traer de
  GoHighLevel» traen a los clientes ACTIVOS que su pantalla lee (`lib/autorizacion/ambito.ts:70`): las tres leen la
  empresa entera, así que el foco no cambia a quién traen, y el cliente final no llega a ninguna (paso 3b). Cada
  cliente en serie, con las credenciales de SU subcuenta y en SU ámbito, con el presupuesto mirado antes de cada uno
  salvo el primero (`lib/negocio/traerDeLosClientes.ts:92`); el calendario y la ingesta rotan por el sello del pulso,
  sin prioridad al atrasado, para que uno lento no deje sin traer a los demás (`lib/negocio/traerDeLosClientes.ts:145`).
  Con un cliente, la respuesta de siempre; con varios, las cifras sumadas y `clientes`, con el nombre delante
  (`lib/negocio/traerDeLosClientes.ts:168`). Al cliente sin credenciales se le dice dónde se cargan las suyas
  (`lib/credenciales/resolver.ts:919`). Lo exigen `pruebas/base/282-las-rutas-manuales-traen-a-cada-cliente.test.ts:327`
  y `pruebas/codigo/283-las-rutas-manuales-son-por-cliente.test.ts:65`.
- **Lo que todavía supone una subcuenta** (encontrado por la revisión del 2026-10-18, no arreglado): el vínculo de un
  closer con su usuario del CRM es uno por persona y se elige entre los usuarios del principal; Creative junta en una
  pieza los anuncios de dos clientes que se llaman igual (la pieza, su fatiga, su enlace manual y el puente
  nombre ↔ anuncio van sin cliente); la atribución por campaña de Conversation agrupa por el nombre de la campaña; las
  reglas de los detectores que miran el gasto (sin entrega, concentración) suman las cuentas de Meta de todos los
  clientes; la cobertura de la ventana de Acquisition se decide por empresa; asignar el funnel de una campaña de otro
  cliente la guarda en el principal; las etiquetas cortas de los campos
  y el puntaje y las carpetas de otra subcuenta se reconocen por su NOMBRE, porque nacen del mismo snapshot (una
  subcuenta con otros nombres no se reconoce); mandar un lead desde Tools usa las credenciales de la empresa
  (`app/api/tools/leads/enviar/route.ts:113`); los guiones de medición, salvo `scripts/medir-mensaje.mjs`, miden sólo
  al principal. Y uno que no es de una subcuenta sino de su ausencia: un cliente ACTIVO sin credenciales del CRM deja
  el aviso de la Agenda de la empresa prendido para siempre («Todavía no se leyó el calendario»: nunca tiene pulso), y
  el botón sólo puede decir por qué. Hasta el primer cliente con subcuenta propia, ninguna de estas tiene efecto; con
  él, se mira su pantalla antes de activarlo, con su Conexión cargada.

---

## Lo que NO pude verificar, y lo que encontré de paso

Dicho como pendiente, que es la regla.

**No verificado — lo histórico.** Los incidentes de despliegue (§ 8), los códigos `42P01`, `42703` y
`42501`, los 69 minutos de cron caído, las mediciones que sólo están en mensajes de commit (el 14 contra
26 de Sales, los 75 píxeles, el colector atascado, las 31 herramientas estrictas) y las de la memoria del proyecto (los
fallos fantasma de la suite, el `.next` viejo, el orden de las migraciones). Son hechos documentados en su momento.

**No verificado — la suite.** Las reglas 34 a 37 hablan de la suite, y este informe no la corrió (regla 37). Los
números que se citan en los commits del período (por ejemplo, 3053 pruebas en `972972e`, según la memoria del
proyecto) son de los mensajes, no de una corrida mía. Sí se corrió la `101` sobre esta carpeta.

**Verificado, y ausente — la protección de rama.** `docs/OTROS/produccion/DESPLIEGUE.md:396` la declara
pendiente, y el 2026-10-18 `gh api …/branches/main` da `protected: false`: **la regla de § 8 es lo único
que separa un commit rojo de producción** ([17-LA-PLATAFORMA.md](17-LA-PLATAFORMA.md) § 5.2).

**No verificado — los 25 avisos de las otras pantallas** (§ 1) y las 19 llamadas con el 14 por omisión
(§ 6): se contaron con `grep`, no se siguieron uno por uno hasta su lector o su llamador.

**No verificado — lo que no se re-midió:** las latencias de la regla 14, el censo de etiquetas de
descarte y la tabla de campos del video del error A. Van con su fecha del 2026-09-15 o anterior.

**Encontrado de paso — la cadena visible sin fecha, que la foto anterior ya había señalado.**
`lib/negocio/indicadoresDeCitas.ts:514-516` arma un aviso que termina en presente: «el CRM tiene ese campo en 3 de 1052
citas». Hasta CN-3 se dibujaba (`components/conversation/PanelDeConversation.jsx:685@6f3bdb5`); hoy viaja en la
respuesta (`app/api/auditoria/route.ts:105-107`). **Sigue igual el 2026-10-18.**

**Encontrado de paso — el comentario de las ventanas que afirma sin medir.** `lib/negocio/periodo.ts:48`
dice que la fila más vieja es de 2026, y `pruebas/codigo/155-el-periodo-de-conversation.test.ts:98` lo
repite. Medido el 2026-10-18: `min(alta_en_el_crm)` es **2025-08-08**. La conclusión («la ventana no recorta nada») es
cierta; el hecho con el que se justifica, no. **Sigue igual.**

**Encontrado de paso — dos agujeros de integridad que ninguna de estas reglas cubre:**

1. **36 contactos con `territorio` nulo**, medido el 2026-10-18 (25 el 2026-09-28). `congelarLosQueYaNoEstan`
   (`lib/negocio/sincronizar.ts:307`) pone el territorio en nulo y el barrido no vuelve a esas filas. **24 no tienen
   `alta_en_el_crm`** —los mismos 24 viejos—, así que son invisibles para todas las cohortes sin ningún aviso; los otros
   12 tienen alta y se congelaron desde el 2026-09-17; 11 de los 36 tienen una cita alcanzable.
2. **Las citas no tienen resta.** No hay equivalente de `congelarLosQueYaNoEstan` en `lib/negocio/citas.ts`, que no
   cambia desde el 2026-09-14: una cita que el CRM deja de listar conserva su estado para siempre. El detalle, con su
   consulta, en [09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md) § 2.2.

**Encontrado de paso — dos definiciones de «agendó» y dos copias del predicado** (§ 4 y regla 30): en
«Completo» Lead Flow dice 303 y su atribución suma 224; y la confirmación y el precall de Conversation
escriben `ghl_calendario_id is not null` a mano. Coinciden a treinta días; no hay prueba que las obligue a seguir
coincidiendo.

Todos son del tipo que estas reglas existen para hacer visibles, y hoy no lo son.

---

## Cómo se midió este corte

Ocho consultas de sólo lectura con `scripts/supabase.mjs leer`, el 2026-10-18 entre las 15:38:44 y las 15:39:06 UTC,
todas agregadas y sobre una sola organización con datos (`count(distinct org_id)` = 1 en `negocio.citas` y en
`negocio.contactos`). Los predicados copian los de `lib/negocio/citasAlcanzables.ts` en SQL literal:

1. **Citas** (§ 3, 4, 6, 9): alcanzable = `ghl_calendario_id is not null`; descartado = `exists` sobre
   `unnest(etiquetas)` contra las seis `ETIQUETAS_DE_DESCARTE` en minúscula; cancelada = `estado_ghl`
   en minúscula dentro de `ESTADOS_CANCELADOS`; ventana = `inicio_el >= now() - make_interval(days => N)
   and inicio_el < now()`, para N = 1, 7, 14, 30 y 3650. Más el censo de `estado_ghl`, `asistio`,
   `reservada_el`, `negocio.resultados` y la última de `migraciones.migraciones_aplicadas` (`078`).
2. **Contactos** (§ 5, 11, error A): cohorte = `alta_en_el_crm >= now() - make_interval(days => N)`;
   escritos y respondieron = `exists` de un mensaje saliente / de uno saliente y uno entrante; agendó =
   `exists` de cualquier cita (Lead Flow) y, aparte, de una alcanzable; territorio y cobertura de claves
   de `atribucion_primera`, `score` y el campo `Confirmación Agendamiento`.
3. **Atribución por fuente** (§ 2): la cohorte de 30 y de 3650 días agrupada por
   `atribucion_primera ->> 'sessionSource'`, con «agendó» = cita alcanzable.
4. **Sentimiento** (§ 3, 6): `negocio.analisis_del_agente` por `auditable` y `disparo`, con
   `count(sentimiento)`, y las juzgadas de `chat_post_agenda` a 7 y 30 días.
5. a 8. **Los de la deuda**, que comparte [09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md): congelados, citas sin releer,
   mensajes, organizaciones y sus zonas, anuncios y gasto, y los conteos de las tablas de los agentes.

Las mismas consultas se corrieron el 2026-10-16 a las 19:16 UTC, al empezar este corte, y dieron cifras vecinas (por
ejemplo, 44 citas publicables a treinta días y 14 canceladas): la ventana rueda, y en dos días salieron cuatro citas
del borde. Por eso cada cifra de ventana va con la hora de su consulta, y
[09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md) lo dice para toda la carpeta.
