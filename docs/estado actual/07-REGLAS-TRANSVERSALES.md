# Las reglas transversales: lo que hay que saber antes de escribir una cifra nueva
> Corte: **2026-09-15**. Cada afirmación lleva su archivo:línea o la consulta que la produjo.
> Lo que no se pudo verificar está dicho como pendiente, no omitido.
> Para ubicar cualquier cosa nombrada acá, ver `08-COMO-USAR-EL-GRAFO.md`.

Comando Central tiene un cuerpo de reglas que no pertenecen a ningún departamento: valen para los cinco. No son estilo ni gusto — cada una cerró un defecto concreto que ya estaba en producción, y casi todas están escritas en el encabezado del archivo que las paga. Este informe las reúne, las ordena y verifica cada cifra contra la base de producción (mediciones del 2026-09-15, 02:33 y 17:25 UTC). Hay once reglas centrales — el silencio, el piso de 10, los dos ceros, las citas congeladas, la cohorte contra el territorio, la ventana y su lista cerrada, la RLS forzada, la migración antes del push, el descarte propio, un solo escritor por tabla y **la cadena que no es un embudo** — más dieciocho reglas menores que ningún documento había reunido. Y una sección final con los errores de método que este proyecto ya cometió: tres veces se buscó un nombre de columna, no se lo encontró, y se concluyó que el dato no existía; tres veces se empujó código antes de aplicar su migración; y **tres** defectos de la última pantalla no aparecieron hasta que alguien la abrió — el cuarto de esa misma tanda lo cazó `next build` sin que nadie abriera nada, y ese contraste es justamente el argumento de la regla 28.

---

## Cómo leer esto, y de dónde salen las reglas

Ninguna de estas reglas se inventó para este informe. Todas estaban escritas —en el encabezado de un módulo de `lib/negocio/`, en el comentario de una migración de `db/migraciones/`, o convertidas en una prueba de `pruebas/codigo/`— con su defecto pagado al lado. Lo que faltaba era tenerlas juntas.

**Tres cosas sobre el método de este documento, porque son las mismas que las reglas exigen:**

1. **Se mide, no se supone.** Cada cifra de abajo lleva o su archivo:línea, o la consulta que la produjo. Las consultas se corrieron en modo lectura contra producción con `node --env-file=.env.supabase scripts/supabase.mjs leer`.
2. **Un `grep` sobre nuestro código prueba qué pedimos, nunca qué manda el proveedor.** Donde la afirmación es sobre el dato, la evidencia es una consulta a la base, no una búsqueda en el repositorio.
3. **Lo histórico se cita como historia.** Los incidentes de despliegue de agosto y septiembre no se pueden volver a medir: se citan desde los mensajes de commit (`git log --format=%B`), que es donde quedaron documentados, y se marcan como tales.

**El reloj de las mediciones, que son dos.** El informe se verificó en dos pasadas y las dos se dicen. `now()` en producción devolvió `2026-09-15 02:33:42 UTC` en la primera, y `2026-09-15 17:25:45 UTC` en la segunda, que rehízo todo lo que depende de la ventana. Con el reloj nuevo, el período con el que la pantalla abre —treinta días— empieza el `2026-08-16`. Los números de este informe son de esos instantes y van a moverse: la propia base crece todos los días, que es justamente el motivo de la regla de las cadenas fechadas (18). **Y el informe ya pagó esa cuenta:** entre las dos pasadas, con la misma ventana de catorce días, la tasa de cancelación del negocio pasó de 33,3 % a 32,4 % sin que nadie hiciera nada. Quince horas. Una cifra sin su fecha no es una cifra.

**El mapa del producto, para ubicarse.** `lib/autorizacion/secciones.ts` define tres grupos: AIOS (Executive, Leads Portal, ICP & Oferta), Inteligencia (Acquisition, Creative, Conversion, Conversation, Sales) y Operación (Setter, Closer, Tools, Monitoreo). Estas reglas nacieron casi todas en Operación —que es real y se usa a diario— y se están aplicando ahora a Inteligencia a medida que cada pantalla deja de ser prototipo. **Conversation es la única de las cinco que ya está construida de verdad** (commits `91e4e07`..`13ce499`), y por eso es donde más reglas están ejercidas — y donde nacieron las tres últimas de esta lista.

---

## 1 · La regla del silencio: `aviso: string | null`, y qué significa el null

**La regla.** Toda cifra que puede necesitar una advertencia viaja con un campo `aviso` de tipo `string | null`. Cuando no hay nada que decir, el valor es `null` **y la pantalla no dibuja nada**. El silencio es el caso normal, y es lo que hace que la aparición del cartel signifique algo.

Está enunciada en `lib/negocio/indicadoresDeCitas.ts:50-52`:

> «`aviso` es `null` cuando no hay nada que decir, y entonces **la pantalla no dibuja nada**. Es la misma regla de silencio que usa `Frescura`, y es la que hace que un aviso signifique algo: un cartel que aparece siempre se aprende a ignorar.»

**El defecto que cierra.** Un aviso permanentemente encendido no informa: entrena a no leer los avisos, y se lleva puestos a los que sí eran ciertos. El argumento está desarrollado en `lib/negocio/indicadoresDeCitas.ts:139-144`, donde explica por qué `avisoDeAsistencia` es un campo **propio** y no parte de `aviso`:

> «La asistencia va a estar por debajo del piso durante semanas, así que un aviso compartido estaría SIEMPRE encendido — y un aviso que siempre aparece es un aviso que nadie mira, incluido el de las citas congeladas.»

**La forma canónica son tres estados, no dos** (`lib/negocio/indicadoresDeCitas.ts:501-512`):

| Estado | Qué dice | Qué manda a hacer |
| --- | --- | --- |
| Sin base | «no hay cifra, y por qué» | esperar, o revisar el flujo |
| Con base incompleta | «la cifra vale, y sobre cuántas NO se contó» | leer la cifra sabiendo su recorte |
| Todo lo demás | **`null`** — nada en pantalla | nada |

Y el tercero se apaga solo: «el día que dejen de caer en la ventana el aviso desaparece solo, sin que nadie tenga que acordarse de sacarlo».

**Dónde está implementada hoy.** Ocho campos `aviso` en producción, todos con el mismo contrato:

| Archivo:línea | Campo |
| --- | --- |
| `lib/negocio/indicadoresDeCitas.ts:63` | `aviso` (cancelación) |
| `lib/negocio/indicadoresDeCitas.ts:146` | `avisoDeAsistencia` |
| `lib/negocio/indicadoresDeCitas.ts:163` | `avisoDeConfirmacion` |
| `lib/negocio/indicadoresDelLead.ts:170` | `aviso` (Lead Flow) — **hoy no lo dibuja nadie, ver abajo** |
| `lib/negocio/indicadoresDelLead.ts:172` | `avisoDeLatencias` |
| `lib/negocio/atribucionDelLead.ts:68` | `aviso` |
| `lib/negocio/consumoDelPrecall.ts:133` | `aviso` |
| `lib/auditor/sentimiento.ts:65` | `aviso` |
| `lib/negocio/frescura.ts:58` y `:208` | `aviso` (frescura del barrido) |

**El otro modo de romper esta regla, y es el que está roto hoy: un aviso que nadie dibuja.** Los otros siete de Conversation llegan a la pantalla (`PanelDeConversation.jsx:672`, `:663`, `:704`, `:780`, `:804` y `:821`, `:910`, `:951`). El de la cohorte de Lead Flow, no: `indicadoresDelLead.ts:360` lo arma y `:231` lo asigna, y ni `respuesta.aviso` ni `r.aviso` aparecen **una sola vez** en las 975 líneas del panel. Y no es un aviso que sobre. Medido hoy en la ventana con la que abre la pantalla —cohorte 412, escritos 382— el campo trae texto: *«30 contacto(s) no entran en la tasa de respuesta porque todavía no se les escribió»*. En la ventana «Hoy» el que se pierde es el que explica el tablero entero: la cohorte es **0** (medido: el último alta del CRM es del 2026-09-13 05:13) y `indicadoresDelLead.ts:362` dice *«No entró ningún contacto nuevo al CRM en 1 días, así que no hay nada que medir»* — mientras la pestaña dibuja «Cada barra es sobre los 0 que entraron» y un booking rate en guion (`PanelDeConversation.jsx:488` y `:495`). Es el cero indistinguible del §3, con la explicación calculada y tirada. **Un aviso sin lector es peor que un aviso siempre encendido: al segundo se lo puede aprender a ignorar, al primero no hay forma de notarlo.**

**Un corolario que ya se aplicó fuera de las cifras.** `lib/auditor/rubrica.ts:559` usa el mismo argumento dentro del prompt del modelo: un renglón «Mensajes no entregados: 0» en cada análisis enseña a saltearlo, «y cuando aparezca un 1 va a saltearlo igual».

---

## 2 · El piso de una tasa: `PISO_DE_UNA_TASA = 10`

**La regla.** Ninguna tasa de este sistema se publica con menos de diez eventos en el **denominador**. Por debajo del piso el valor es `null`, se dibuja el conteo, y el aviso explica por qué.

La constante vive en `lib/negocio/indicadoresDeCitas.ts:300`, con su justificación completa en `:268-282`.

**Por qué diez, y no es gusto.** El número sale de un defecto ya pagado. El no-show reportado se declara como **conteo y no como tasa** porque medía 2 eventos en catorce días — «una tasa sobre dos eventos no es una tasa, es un número que se mueve cincuenta puntos con el próximo registro» (`:94-103`). Con diez, un registro mueve diez puntos: sigue siendo mucho, y ya no es absurdo.

**El piso es del DENOMINADOR, no del total.** Es la parte que más se malinterpreta, y está dicha explícitamente:

> «con 151 citas y 3 respuestas la muestra son 3, y quien contestó esas tres no es una muestra al azar de las 151 — el closer que cierra sus intentos no es el mismo que no los cierra.»

**Por qué se renombró.** Se llamaba `PISO_DE_ASISTENCIA`. El commit `1fce636` lo cambió con el motivo escrito: «nombrar una constante compartida por la primera que la necesitó invita a que la quinta se escriba su propio piso *porque aquélla es de la asistencia*, y dos pisos distintos para la misma regla divergen sin que nada falle».

**Quién lo usa hoy — ocho cifras, verificado por `grep`:**

| Cifra | Archivo:línea |
| --- | --- |
| Tasa de asistencia | `indicadoresDeCitas.ts:449` |
| Tasa de confirmación | `indicadoresDeCitas.ts:458` |
| Tasa de cancelación de los descartados | `indicadoresDeCitas.ts:468` |
| Filas de atribución por fuente y por campaña | `atribucionDelLead.ts:158` |
| Tasa de consumo del precall | `consumoDelPrecall.ts:231` |
| Desglose fino del precall (dos ramas, las dos ≥ 10) | `consumoDelPrecall.ts:239` |
| Proporción de contactos molestos | `auditor/sentimiento.ts:127` |

**El piso funcionando, y la parte que se descubrió al hacer seleccionable la ventana.** La atribución por fuente, medida hoy en las dos ventanas que importan:

| Fuente (`sessionSource`) | Cohorte 14 d | Tasa 14 d | Cohorte 30 d | Tasa 30 d |
| --- | --- | --- | --- | --- |
| paid social | 216 | 50,9 % | 347 | **43,8 %** |
| direct traffic | **8** | 87,5 % | 18 | **44,4 %** |
| social media | **6** | 66,7 % | 47 | **34,0 %** |

A catorce días el piso hace su trabajo: las dos últimas se juntan en una fila «Otras» **con su conteo y sin tasa**. El motivo está en el encabezado de `atribucionDelLead.ts:21-37`, medido el 2026-09-14: con 8 y 6 leads esas dos categorías tenían las tasas más altas de la pantalla, y dibujadas como tres barras iguales «dicen que lo pago es lo que peor convierte — una conclusión de negocio, cara, y construida sobre catorce contactos».

**A treinta días —la ventana con la que la pantalla abre desde el rediseño— el piso no se activa: las tres pasan, no hay fila «Otras» por fuente, y las tres barras se dibujan juntas.** Y la conclusión que el comentario quería evitar se da vuelta: Paid Social queda a 0,6 puntos del primero y le gana al tercero por casi diez. **El piso protege de una muestra chica, no de una comparación mal hecha, y cuál de las dos cosas está pasando depende de la ventana — que ahora es un botón.** Un comentario que describe la lectura de una ventana envejece en cuanto alguien aprieta otra: el de `atribucionDelLead.ts` sigue siendo cierto a catorce días y ya no describe lo que se ve al abrir.

**Apartar no es esconder.** La fila «Otras» lleva su conteo y las filas suman la cohorte exacta, así que si faltara un pedazo se vería. Lo que no recibe es una barra que invite a compararla con una que sí tiene datos.

---

## 3 · Los dos ceros: «no hay dato» contra «el dato dice cero»

**La regla.** Dos hechos distintos no pueden colapsar en el mismo valor. «Nadie lo cargó» y «vale cero» mandan a hacer cosas distintas, así que se representan distinto: `null` para la ausencia, `0` para el hecho medido — y donde hace falta, un aviso que diga cuál de los dos es.

Es la regla más repetida del repositorio. Aparece veintitantas veces bajo dos nombres: «los dos ceros» y «el cero indistinguible».

**Los enunciados canónicos:**

- `lib/datos/esquema.ts:28` — «**`null` no es cero.** `null` = nadie lo cargó; `0` = esta empresa no paga, que es un hecho.»
- `lib/negocio/indicadoresDeCitas.ts:421-423` — «Sin citas NO hay tasa. Un `0 %` con cero citas se lee como *no se cancela ninguna*, que es una afirmación sobre el negocio hecha con cero datos.»
- `db/migraciones/048_de_donde_vino_el_lead.sql:67` y `049_si_se_presento_a_la_cita.sql:44-45` — «un nulo significa una sola cosa. *No se presentó* es `false`, y son distintos.»

**Los tres casos vivos hoy, medidos:**

| Caso | Medición | Qué significa el vacío |
| --- | --- | --- |
| `citas.asistio` | **0 de 127** — las citas que la tarjeta cuenta a treinta días, que son las alcanzables menos las de descartados; 0 de 317 en total | Nadie cerró el intento todavía. **No** «no se presentó nadie» |
| `resultados.cita_id` | **0 de 7** resultados | La `049` es reciente y los 7 resultados son anteriores. No hay nada que conectar |
| Campo `Confirmación Agendamiento` | 178 de 584 contactos | Si el campo no estuviera en el catálogo sería un tercer hecho más |

El caso de la asistencia es el que mejor muestra por qué la regla importa. `indicadoresDeCitas.ts:362-365` lo dice sin vueltas: sin el filtro `asistio is not null` en el **denominador**, la cuenta sería sobre las 127 citas que la tarjeta publica, y como el nulo es el caso normal, «la tasa diría que no se presenta casi nadie. Sería una cifra plausible, alarmante y falsa».

**El tercer cero, que es el más fácil de olvidar: el campo puede no existir.** `confirmacionEnLaVentana` (`indicadoresDeCitas.ts:220-224`) distingue tres estados y no dos:

1. El campo no está en el catálogo del CRM → *«El CRM de esta empresa no tiene un campo «Confirmación Agendamiento», o cambió de nombre. Sin él no hay confirmación que contar: **no es que nadie confirme**.»*
2. El campo está y nadie lo respondió → otra frase, otra acción.
3. Respondido por menos de diez → el piso.

El commit `10fde57` lo resume: «*Nadie respondió* se arregla esperando o revisando el flujo del CRM. *El campo no existe* se arregla mirando el CRM. Un hueco mudo los confunde y quien lo lea espera un dato que no va a llegar nunca.»

**Y el cuarto, en el sentimiento del auditor.** `lib/auditor/sentimiento.ts:11-26` censa tres poblaciones que se ven idénticas en la columna `sentimiento is null`. Verificado hoy contra la base:

| Población | Filas | Con sentimiento |
| --- | --- | --- |
| auditable, disparo `debounce` | 18 | 18 |
| auditable, disparo `alarma` | 2 | 2 |
| auditable, disparo `mejora` | 15 | **0** (el carril escribe null a propósito) |
| no auditable | 12 | **0** (nunca se llamó al modelo) |

Sobre las 47 filas la distribución diría «57 % sin dato», que suena a un problema de las conversaciones y en realidad describe los carriles del propio auditor. **El denominador son las 20**, y viaja al lado. Un quinto nulo posible —que el modelo conteste fuera del vocabulario— hoy tiene cero filas y **sí sería un defecto**: se cuenta aparte y se avisa.

---

## 4 · Las citas congeladas: `ghl_calendario_id is null`

**La regla, y la mitad que le faltaba.** Toda cifra que pregunte por el **ESTADO** de una cita se cuenta únicamente sobre las que el barrido todavía puede refrescar —`ghl_calendario_id is not null`— y lo congelado se declara aparte, nunca se suma en silencio.

**Toda cifra que pregunte por la EXISTENCIA de la cita las cuenta a todas.** Una cita congelada tiene el estado detenido; no deja de haber sido agendada. La distinción no es teórica: enunciar la regla sin ella costó cinco puntos y medio en el KPI principal de Lead Flow, y el motivo está abajo.

El predicado está en una constante compartida, `lib/negocio/indicadoresDeCitas.ts:316`:

```
const alcanzable = sql`ghl_calendario_id is not null`;
```

Y va en constante y no repetido ocho veces por un motivo escrito en `:296-298`: «repetidos, el día que alguien agregue una cifra la escribe con un filtro apenas distinto, las dos conviven, y la tarjeta muestra números que no cuadran entre sí mientras cada uno se ve bien por separado».

**Qué son las congeladas.** Son citas anteriores a la migración `038`, que no traen identificador de calendario. El CRM ya no devuelve sus eventos, así que su estado quedó fijo en el que tenían el día que dejaron de sincronizarse.

**Medido hoy contra producción:**

| | |
| --- | --- |
| Citas totales | **317** |
| Alcanzables (`ghl_calendario_id is not null`) | **216** |
| Congeladas (`is null`) | **101** |
| Última sincronización de las congeladas | **2026-09-06 04:03 UTC** |
| Rango de `inicio_el` de las congeladas | 2026-08-12 a 2026-09-10 |
| Congeladas que caen dentro de la ventana de 14 días | **11** |
| Congeladas que caen dentro de la de 30 días —la que la pantalla publica— | **77** |

Esas 11 son la prueba de que no es un problema de ventana: **caen dentro del período que el barrido mira y aun así no se refrescan**. Es exactamente lo que el encabezado de `indicadoresDeCitas.ts:16-18` declara haber comprobado el 2026-09-14 (entonces eran catorce).

**Y el salto de 11 a 77 es la regla de la ventana (§6) hecha número:** el botón «30 días» no agrega dieciséis días de muestra, agrega sesenta y seis citas que el sistema dejó de mirar. `tasaDeCancelacion` las cuenta y las declara en su aviso, que es lo que hace que el número de al lado siga siendo legible.

**Por qué esto es una regla y no un detalle.** El sesgo que produjeron está medido y documentado en `indicadoresDeCitas.ts:11-15` y repetido en `db/migraciones/045_cuando_cambio_el_estado_de_la_cita.sql:22-31`:

| Población (2026-09-14) | Citas | Canceladas | Tasa |
| --- | --- | --- | --- |
| Con calendario | 199 | 120 | **60,3 %** |
| Congeladas | 101 | 31 | **30,7 %** |

Mezclarlas daba «un número más bajo, estable y falso». La cifra publicada el 2026-09-13 —«160 de 316 canceladas, el 50,6 %»— estaba sesgada a la baja por eso, y lo peor era que el sesgo **parecía una tendencia**: 61,9 % a siete días, 60,1 % a catorce, 52,9 % a treinta, 50,6 % en total. No lo era.

**Y desde el 2026-09-14 la exclusión tiene además un motivo de producto, no sólo técnico** (`indicadoresDeCitas.ts:25-29`): está decidido que **sólo cuentan las citas agendadas desde que Comando Central existe** — la primera guardada es del 2026-08-26. Las anteriores no importan, así que excluirlas no es una pérdida que haya que compensar algún día: **es el alcance**.

**El filtro llegó a estar en las dos, y en una no correspondía.** `indicadoresDelLead.ts` lo copiaba para el booking rate con este motivo: «es el mismo filtro que todas las cifras de citas». Era consistencia por costumbre, no por la pregunta — y el propio módulo tenía escrito, para la OTRA exclusión, el argumento que lo desmiente: «**agendar es el evento**: que la cita todavía no haya ocurrido no lo deshace. La cancelación sí necesita que la cita haya pasado, porque pregunta otra cosa».

Que la cita se haya congelado tampoco lo deshace. Medido el 2026-09-16, esto es lo que el filtro descartaba del KPI del § 9.3:

| Ventana | Con el filtro | Sin el filtro | Contactos cuya única cita está congelada |
| --- | --- | --- | --- |
| hoy | — (cohorte 0) | — | 0 |
| 7 días | 50,0 % (26 de 52) | 50,0 % | 0 |
| 14 días | 55,9 % (104 de 186) | 55,9 % | **0** |
| 30 días | **44,8 %** (175 de 391) | **50,4 %** (197) | **22** |
| completo | **34,1 %** (191 de 560) | **48,2 %** (270) | **79** |

**A catorce días no descartaba a nadie, y por eso estuvo ahí sin que se notara.** El día que la pantalla pasó a treinta días por omisión empezó a costar cinco puntos y medio, y la serie descendente —50,0 → 44,8 → 34,1— se leía como un negocio que se degrada cuanto más atrás se mira. Sin el filtro es 50,0 → 50,4 → 48,2, casi plana.

Las 22 citas se miraron una por una antes de decidir: las 22 traen hora y estado reales, del 18 al 22 de agosto de 2026, o sea de antes de que la `038` empezara a guardar el calendario. Son agendamientos, no filas dudosas.

**Y la segunda mitad de la regla sí se cumple ahora**: `indicadoresDelLead.agendaronSoloCongeladas` cuenta cuántos de los que agendaron descansan en una cita detenida, y `avisoDelBooking` lo dice en pantalla — porque la tasa de cancelación de la misma pestaña NO los cuenta, y dos cifras vecinas sobre poblaciones distintas tienen que declararlo.

---

## 5 · La cohorte no es el territorio

**La regla.** Una cohorte se arma con un hecho de **entrada** (cuándo entró el lead), nunca con un estado que es **consecuencia** de lo que se quiere medir. Filtrar por `territorio` rompe cualquier tasa de conversión, por construcción.

Enunciada en `lib/negocio/indicadoresDelLead.ts:29-31`:

> «**El territorio es consecuencia de agendar, no una cohorte.** Un contacto que agenda se va a zona closer, así que `territorio = 'setter'` son los que todavía no agendaron más los que nunca lo harán — y sobre esa población un booking rate da 2 de 280, que es una tautología, no una cifra.»

**La medición, reproducida hoy contra producción:**

| Territorio | Contactos | Con cita alcanzable | Proporción |
| --- | --- | --- | --- |
| `setter` | 280 | **2** | 0,7 % |
| `closer` | 279 | 188 | 67,4 % |
| `null` (congelados) | 25 | 4 | — |

Es idéntica a la que el encabezado declara. Sobre la población de zona setter, el booking rate del §9.3 daría **0,7 % para siempre**, y no por el negocio sino porque la pregunta está mal hecha.

**Y hay una segunda cohorte rota que se corrigió en el mismo commit (`91e4e07`): `creado_el`.** La columna dice cuándo *nuestro barrido* vio al contacto, no cuándo entró al CRM. Dos defectos medidos:

- Los 7 contactos que se movían al cambiar la cohorte tenían alta en el CRM de hasta **nueve meses atrás** (2025-12-22 a 2026-08-24) y `creado_el` los contaba como «nuevos de esta semana».
- **239 contactos comparten la marca `creado_el` de la carga inicial** (2026-08-24). En cuanto la ventana la tocara, la cohorte saltaba de 260 a 499 de golpe **sin que entrara un solo lead**.

La cohorte nueva es `alta_en_el_crm` (migración `048`). Verificado hoy: **559 de 584 contactos la tienen**. Y la latencia entre las dos está medida: en la ventana, ningún contacto estuvo más de 42 minutos fuera de nuestro alcance (mediana 5 minutos), así que la cohorte nueva no mezcla leads que el sistema no pudo trabajar.

**El precio se dice en voz alta, y esa también es la regla.** `indicadoresDelLead.ts:33-36`: la tasa de respuesta **bajó de 68,1 % a 60,9 %** al sacar el filtro de territorio. No empeoró nada: la cohorte dejó de excluir a los que agendaron, y entre ellos hay **59 contactos que agendaron sin escribirnos nunca**. Una cifra que cambia de valor tiene que poder explicarse, o alguien va a buscar los leads que «faltan».

**Una sola cohorte para todas las cifras de la pantalla** (`indicadoresDelLead.ts:38-43`): «con cohortes distintas por cifra, dos tarjetas dirían cosas que no se pueden sumar —*60,9 % contesta* y *52,5 % agenda* sobre poblaciones distintas no permiten preguntarse cuántos hicieron las dos— y nadie tendría cómo darse cuenta».

**Medido hoy sobre la cohorte corregida, en la ventana con la que la pantalla abre:** 412 contactos entraron al CRM en los últimos treinta días, **176 agendaron (42,7 %)**, y a 382 se les escribió al menos una vez. A catorce días —la ventana de la que salieron los comentarios del módulo— son 230, 121 (52,6 %) y 224: el comentario de `indicadoresDelLead.ts:121` dice «entraron 231, se le escribió a 225, contestaron 138, agendaron 121», que era cierto cuando se escribió y **ya no se reproduce tal cual**. La ventana es móvil; los comentarios, no. Por eso van fechados y por eso la pantalla dibuja `desde`.

**El mismo defecto con otro disfraz.** `lib/negocio/consumoDelPrecall.ts:37-41` lo reconoce en su propia población: la cobertura del campo de video es del 94,3 % entre las citas `confirmed` y del 48,9 % entre las `cancelled`, así que «tener el campo» es **consecuencia** de no haber cancelado. Por eso el precall excluye las canceladas — «es el mismo defecto que la cohorte por territorio, con otro disfraz».

---

## 6 · La ventana: una lista cerrada de cuatro, y lo que no está se rechaza

**La regla, que ahora son dos.** La vieja: **una ventana más vieja no es una muestra más grande.** Y la que hizo falta el día que la ventana se volvió elegible: **el parámetro se valida contra una lista cerrada, y lo que no está en la lista se rechaza — nunca se corrige al valor por omisión.**

La primera parte no cambió y sigue enunciada donde nació, `lib/negocio/indicadoresDeCitas.ts:302-309`:

> «**Catorce y no treinta**, y el motivo es el sesgo: la ventana trasera del barrido son catorce días, así que más allá de eso la proporción de citas congeladas crece y la tasa se ensucia. Pedir una ventana más larga no trae más señal: trae más citas que el sistema dejó de mirar.»

Elevado a regla de proyecto en `indicadoresDeCitas.ts:21-24` y repetido en `db/migraciones/045:37-39`: «cuanto más atrás mira un número en este sistema, mayor es la proporción de citas que el sistema dejó de mirar». Medido hoy a las 17:25, con la ventana ya seleccionable, y con las tres poblaciones dichas por su nombre porque no son la misma:

| Ventana | Alcanzables (`ghl_calendario_id is not null`, ya ocurridas) | Las que la tarjeta publica (alcanzables **menos** las de contactos descartados) | Congeladas |
| --- | --- | --- | --- |
| hoy | 5 | 2 | 0 |
| 7 días | 67 | 29 | 3 |
| 30 días | **205** | **127** | **77** |
| completo | **205** | **127** | **101** |

La columna del medio es el campo `citas` de `tasaDeCancelacion` (`indicadoresDeCitas.ts:334`: `filter (where alcanzable and not descartado)`) y **no** son «las alcanzables»: las 78 citas de contactos descartados del período también traen calendario y el barrido sí las refresca, así que están en la primera columna y no en la segunda. Confundirlas es fácil porque el §4 usa «alcanzable» para la primera y la tarjeta publica la segunda. **El cuarto botón no agrega ni una cita alcanzable sobre el tercero —205 contra 205, y 127 contra 127 de las publicables—: agrega 24 citas que el sistema dejó de mirar.**

**Qué cambió.** `DIAS_DE_LA_TASA = 14` sigue existiendo (`indicadoresDeCitas.ts:310`) y sigue siendo el valor por omisión de las siete funciones que lo usan, pero **ya no es lo que ve la pantalla**: la ruta les pasa siempre el período elegido, así que ese 14 sólo actúa donde nadie pide ventana — hoy, `citasParaCerrar` (`lib/negocio/citasParaCerrar.ts:60`), que es de Avanzar y no de Conversation.

| Quién | Línea | Qué ventana usa hoy |
| --- | --- | --- |
| `lib/negocio/indicadoresDeCitas.ts` | `:295` | la del período |
| `lib/negocio/indicadoresDelLead.ts` | `:156` | la del período |
| `lib/negocio/atribucionDelLead.ts` | `:75` | la del período |
| `lib/negocio/consumoDelPrecall.ts` | `:136` | la del período |
| `lib/auditor/sentimiento.ts` | `:83` y `:191` | la del período |
| `lib/negocio/citasParaCerrar.ts` | `:60` | **los 14 por omisión** |

**Las cuatro ventanas son una lista cerrada, y vive en un archivo propio** (`lib/negocio/periodo.ts:83-96`): `hoy` = 1 día, `7d`, `30d` y `completo` = `DIAS_DE_TODO` = 3650 (`:52`). La pantalla abre en **30 días** (`PERIODO_POR_OMISION`, `:109`), y el motivo está escrito: catorce no es ninguno de los cuatro botones, y un valor por omisión que ningún botón produce deja el segmentado sin nada encendido sobre cifras que nadie puede volver a pedir.

**El defecto que cierra la lista cerrada, y es el que casi todo el mundo deja abierto.** Está enunciado en `periodo.ts:6-17` y convertido en prueba en `pruebas/codigo/155-el-periodo-de-conversation.test.ts:58`. Leer `?dias=` como número abre tres agujeros, **y los tres se ven bien en pantalla**:

| Lo que llega | Qué pasa si no se valida | Qué se ve |
| --- | --- | --- |
| `?dias=abc` → una clave inventada | `NaN` cae al valor por omisión | El botón dice una ventana y las cifras son de otra |
| `?dias=30` → un número crudo (la forma vieja del parámetro) | Se atiende como si existiera | Números correctos de una ventana que nadie decidió |
| `?dias=-5` → un negativo | `now() - interval '-5 days'`: una ventana **en el FUTURO** | Cero filas, dibujadas como «no pasó nada» |

Ninguno falla. Por eso `periodoDe()` (`periodo.ts:188`) devuelve `null` ante cualquier clave desconocida y **`null` significa rechazar**: `app/api/auditoria/route.ts:80` lo convierte en un 400. La prueba comprueba además que el rechazo esté escrito con `=== null` (`155:131-135`) y **no** con un `??` (`155:136-139`), porque `periodoDe(x) ?? POR_OMISION` compila, se lee razonable y es exactamente el defecto. La única ausencia que sí cae en el valor por omisión es la ausencia real, la primera carga sin parámetro (`155:79`).

**Y la lista viaja entera hacia los dos lados.** La clave elegida vuelve en la respuesta (`route.ts:114`) para que el botón encendido describa **lo que el servidor contestó** y no lo que la pantalla pidió; los botones se dibujan mapeando `PERIODOS` y no una lista escrita a mano (`155:181`); y la lectura del navegador **exige** el período, sin valor por omisión propio (`lib/auditor/vista.ts:41`, forzado por `155:163`). Con la lista copiada en dos sitios, el día que se toque uno solo hay un botón que manda una clave que el servidor rechaza — o peor, un período válido que ningún botón puede pedir.

**Y «completo» no puede leerse como historia.** Por eso las dos cifras que encabezan traen `desde` —`indicadoresDelLead.ts:82` y `indicadoresDeCitas.ts:77`—, que es `min()` sobre las filas alcanzadas y **no** `now() - dias`. Medido hoy a las 17:25: en Lead Flow «completo» arranca el **2025-08-08** contra el **2026-08-16** de «30 días». En Appointment Flow arranca el **2026-08-24 13:00**, que es **exactamente el mismo `desde`** que devuelve «30 días» — la misma fecha, al minuto. O sea que en las citas los dos botones coinciden en todo lo que se ve: 127 citas, 52 canceladas, 40,9 %, la misma mediana y el mismo `desde`. **Lo único que cambia entre uno y otro son las congeladas: 77 contra 101**, y eso no está en el titular sino en el aviso, que las cuenta en la misma pasada (`indicadoresDeCitas.ts:345`) y las declara (`:487-489`). Para lo que sirve el `desde` acá es para lo otro: sin él, el cuarto botón invita a leer veintidós días de citas como un año.

**La ventana se mide con `inicio_el`, no con `reservada_el`, y el motivo es el mismo** (`indicadoresDeCitas.ts:31-37`). `reservada_el` es «la fecha nueva y tentadora» —contestaría «de las que se agendaron esta semana, cuántas se cayeron»— pero su cobertura es parcial y **crece sola**: las citas anteriores a la `043` no la tienen. «Una tasa sobre una columna que se está llenando cambia cada día sin que cambie el negocio.» `inicio_el` está en 317 de 317, así que la ventana es completa por construcción. (La cobertura de `reservada_el` sí se degrada al ensanchar, y ahora se ve: la mediana de horas hasta la cita se calcula sobre 28 de 29 citas a siete días y sobre **96 de 127** a treinta.)

**La ventana la calcula la BASE, no la aplicación** (`indicadoresDeCitas.ts:389-390`):

> «es la única forma de que el *ahora* sea el mismo reloj que escribió las filas»

Verificado por `grep` sobre los cinco módulos de cifras: **cero `Date.now()` y cero `new Date()`**, y quince usos de `now()` de PostgreSQL. No es una convención suelta: es lo que hace que dos cifras de la misma tarjeta hablen del mismo instante.

**Una cifra que va a cruzar el piso hacia abajo sola** — y que ahora se puede hundir con un clic. El sentimiento del auditor produce ~1,3 veredictos por día con un pico de 10 el día de la siembra. Cuando ese día salga de la ventana, el denominador cae de 20 a ~11 — y el aviso lo explica de antemano «para que no se lea como que el auditor dejó de funcionar» (commit `ae600f2`). Es la ventana móvil comportándose, no un fallo. Lo nuevo es que ya no hay que esperar: medido hoy, `chat_post_agenda` tiene **20** conversaciones juzgadas a treinta días y **5** a siete, así que la proporción de molestos se publica en la ventana por omisión y **desaparece al apretar «7 días»**. El aviso que lo explica ya estaba escrito para el paso del tiempo y sirve igual para el botón; la regla que hay que recordar es que cada ventana nueva es un denominador nuevo, y el piso se evalúa en cada una.

---

## 7 · RLS forzada: lo que una migración NO puede hacer

**La regla, en una línea** (`db/migraciones/040_canal_del_mensaje.sql:80-81`):

> «**Una migración solo puede cambiar la FORMA de `negocio.*`, nunca su contenido.** Los datos los mueve código que corra como `app_inquilino`.»

**El mecanismo, medido y no supuesto** (`db/migraciones/039_campos_del_crm.sql:207-220`):

- Las tablas de identidad y de negocio tienen `force row level security`, y sus políticas son para `app_identidad` / `app_inquilino`.
- El migrador es el **dueño** de la tabla, y `force` alcanza también al dueño: **sin política propia, ve cero filas.** Medido el 2026-09-07.
- No puede esquivarlo: `rolsuper` y `rolbypassrls` en falso, y `set role app_identidad` responde `permission denied to set role`. Verificado contra la base real.

**El error silencioso que produce, y es lo que hace la regla cara.** Un `insert` o un `update` del migrador **recorre cero filas e informa éxito**. No hay excepción, no hay registro, no hay contador que se mueva. Pasó dos veces, con síntomas distintos:

| Migración | Qué intentó | Qué pasó |
| --- | --- | --- |
| `039` | Sembrar cuatro carpetas del perfil | **Escribió cero filas, sin error.** Se notó al mirar la tabla vacía |
| `040` | `update … set tipo_ghl = canal where canal like 'TYPE\_%'` | **Se aplicó a producción escribiendo cero filas, sin error.** Peor: «habría pasado por correcto para siempre y el chat seguiría mostrando correos, con una migración aplicada que dice haberlos etiquetado» |

**Once migraciones citan esta regla explícitamente** — `010:71`, `012:73`, `017:51` y `:114`, `018:19`, `023:12` y `:25`, `032:11` y `:32`, `039:209`, `040:72`, `041:30`, `042:35`, `043:28`, `044:46`, `045:54`, `048:49`, `049:94`.

**La consecuencia práctica para quien construye una cifra nueva.** Toda columna que agrega una migración **nace vacía y se llena hacia adelante**. Nunca hay relleno retroactivo. Dicho en `048:47-55`:

> «los 584 contactos reciben estas cinco columnas vacías y las pueblan en la pasada siguiente del cron. […] Lo que sí importa es que **ninguna cohorte armada con `alta_en_el_crm` tiene historia antes del despliegue**, y toda pantalla que la use tiene que decir desde cuándo mide.»

Y su corolario en la `045`: «El nulo es *no se sabe cuándo*, nunca *no cambió*» — que es la regla de los dos ceros aplicada a cada columna nueva.

**Dónde se resuelve entonces.** El dato se arregla **al leer**, no al migrar. El ejemplo canónico es la `040`: la inferencia del canal efectivo vive en `lib/negocio/ficha.ts`, con dos ventajas sobre haberla escrito en SQL — vale para cualquier organización, incluidas las que conecten el CRM mañana, y no toca ni una fila.

---

## 8 · La migración va antes del push, y las tres veces que se rompió

**La regla.** **La migración se aplica ANTES de empujar el código que la necesita. Si eso no se puede, el código no se empuja.**

Es una regla de **orden, no de memoria** — y esa distinción es el aprendizaje, porque la versión anterior («escribir el pendiente al pie del commit») falló dos veces.

**El contexto que la hace necesaria.** `docs/DESPLIEGUE.md:395` y `README.md:7`: **Vercel despliega por push, no por chequeo.** Un commit con las pruebas en rojo se publica igual. La protección de rama en `main` con `verificar` requerido **sigue pendiente** (`docs/ETAPA-8.md:170`).

**Las tres veces que se rompió** (documentadas en `git log` y en la memoria del proyecto):

| Fecha | Qué se empujó sin migrar | Consecuencia medida |
| --- | --- | --- |
| 2026-08-28 | — | La regla se escribe por primera vez: «antes de empujar, preguntar qué LEE en el arranque lo que la migración crea» |
| 2026-08-31 | `lib/negocio/colas.ts` consultando `negocio.analisis_del_agente`; `app/api/cron/route.ts` leyendo `organizaciones_credenciales.auditor_activo` | **Closer y Setter en 500 en cada carga** (`42P01`). Y **el cron entero caído 69 minutos** — sin mensajes nuevos, sin releer etiquetas, sin barrer el calendario. «Ésta es la peor de las dos porque es silenciosa: nadie ve un error, solo deja de entrar información» |
| 2026-09-11 | La `043` (`reservada_el`), empujada después del código | El barrido de citas falló con `42703 column "reservada_el" does not exist`. **Una corrida perdida**, la de las 20:03 |

**Por qué se repitió, dicho sin adornos** (memoria del proyecto): «los commits de las etapas 2 a 5 decían *PENDIENTE EN PRODUCCIÓN* al pie y aun así se empujó el código. **Escribir el pendiente no es aplicarlo.**»

**La regla se corrigió tras la tercera, y quedó más estrecha.** El argumento fallido fue «son `add column` nulables y nada las LEE en el arranque». Era falso de la forma más obvia: **el código no las lee, las ESCRIBE** — `lib/negocio/citas.ts` las pone en el `insert` del barrido.

> No alcanza con preguntar qué LEE el arranque. Hay que preguntar **qué TOCA la columna nueva, en cualquier sentido** — un `insert` que la nombra rompe igual que un `select`. Y para saber cuánto cuesta, hay que mirar **en qué horario va la tarea**, que está en `HORARIOS` de `lib/negocio/barrido.ts`.

**Dos matices del tercer incidente que conviene no confundir:**

1. El hueco de una hora entre la última sincronización buena y la migración **es la cadencia, no el daño**: `citas` corre en el horario de la hora (`3 * * * *` en `vercel.json`).
2. **El daño se recuperó solo** porque el barrido de citas relee una ventana móvil y no es incremental. Si hubiera sido incremental —como el de mensajes—, se perdía.

**La comprobación de treinta segundos, antes de cada `git push`:**

```
node --env-file=.env.supabase scripts/supabase.mjs leer \
  "select name from migraciones.migraciones_aplicadas order by name desc limit 1"
ls db/migraciones | tail -1
```

Si el segundo número es mayor que el primero, **no se empuja**: se migra primero.

**Y una corrección de método sobre cómo aplicar, pagada el 2026-09-14.** Aplicar es `node --env-file=.env.supabase scripts/db.mjs migrar`. **No** `scripts/supabase.mjs correr --archivo`: falla con `42501: must be owner of table contactos`, porque la Management API conecta como `postgres`, que no es dueño de nuestras tablas — ese guion existe sólo para los dos archivos de arranque que necesitan omitir RLS. Y **sólo con `.env.supabase`**: `npm run db:migrar` usa `--env-file-if-exists=.env.local`, que pisa `DATABASE_URL_MIGRADOR` y apunta a `127.0.0.1:55432`.

**Lo que funcionó.** La `048` y la `049` se aplicaron el 2026-09-14 **cada una antes de empujar su código** — la regla funcionando, dos veces seguidas. Producción está hoy en la `049`, y el repositorio tiene 49 migraciones.

---

## 9 · El descarte propio: por qué la cancelación se parte en dos poblaciones

**La regla.** Una cita que se cancela porque el lead se arrepintió y una que se cancela porque **nosotros decidimos que no calificaba** son hechos opuestos. Sumadas dan un número que no describe a ninguna de las dos.

El vocabulario vive en `lib/ghl/contrato.ts:231` (`ETIQUETAS_DE_DESCARTE`), con su censo completo en `:193-230`.

**Medido hoy contra producción, en la ventana con la que la pantalla abre —treinta días— y en la de catorce, que es la de los comentarios del módulo:**

| Población | Citas 30 d | Canceladas | Tasa 30 d | Tasa 14 d |
| --- | --- | --- | --- | --- |
| De contactos descartados | 78 | 71 | **91,0 %** | 92,0 % ← la automatización de la casa |
| El resto | 127 | 52 | **40,9 %** | 32,4 % ← el negocio |
| **Las dos juntas** | **205** | **123** | **60,0 %** | 63,0 % ← lo que se publicaba |

La brecha entre las dos poblaciones se sostiene en las dos ventanas: cincuenta puntos a treinta días, sesenta a catorce. **Casi cuatro de cada diez citas del período son de contactos que la empresa MISMA había rechazado**, y cancelan al 91 % porque su flujo de descarte las cancela. «Publicar 62,7 % como *tasa de cancelación* le atribuía al negocio la mitad del trabajo de su propio filtro» (`indicadoresDeCitas.ts:178-179`, con la medición del 2026-09-14 —72 / 78 / 150— en `:156-158`), y el número quedaba a mitad de camino entre dos verdades, más cerca de la que no sirve para decidir.

**Y la cifra que abre la pantalla cambió sin que nadie la volviera a medir.** Los documentos de estado y el comentario del módulo publican **33,3 %** (`indicadoresDeCitas.ts:174`, medido el 2026-09-14), que era la tasa del negocio **a catorce días**; esa misma ventana de catorce días da hoy a las 17:25 **32,4 %** (23 de 71) sin que nadie haya tocado nada — y catorce ya no es ninguno de los cuatro botones. Lo que se dibuja al entrar es **40,9 %** (52 de 127), porque el período por omisión pasó a treinta. Cambiar una ventana por omisión es cambiar todos los titulares, y ninguna prueba lo iba a decir.

**Apartar no es esconder** (`indicadoresDeCitas.ts:181-182`): las descartadas van con su conteo y su tasa, y **las dos poblaciones suman exactamente el total**. Es la misma disciplina que las citas congeladas.

**Dónde se trazó la línea, y por qué da igual.** Censo de las etiquetas de descarte de la subcuenta real: `icp_rechazado` 64, `rechazado` 55, `rechazado_positivo` 6, `no calificado` 5, `rechazado_negativo` 1, `descalificado` 1. Medido el 2026-09-14, con las dos grandes solamente la cifra del resto daba 33,3 %; con las seis, 33,3 % también. **Que la conclusión no dependa del corte es lo que la hace confiable** — y eso se midió antes de elegir.

**Tres detalles de implementación que son reglas en sí mismos:**

1. **Las cinco cifras de la tarjeta cortan igual.** Si sólo cortara la cancelación, las demás hablarían de otra población «y las cinco se verían bien por separado».
2. **`exists` sobre `unnest` y no `&&` de arreglos** (`indicadoresDeCitas.ts:318-326`): las etiquetas se guardan crudas y GoHighLevel no garantiza la caja, así que hay que comparar en minúscula — y `&&` no deja. El fixture de la prueba escribe la etiqueta en MAYÚSCULA a propósito.
3. **Todo en la misma pasada** (`:321-323`): «Dos consultas podrían ver estados distintos de la tabla —el barrido escribe cada hora— y entonces las dos poblaciones de la misma tarjeta no sumarían el total, sin que nada falle».

**Y una propiedad del dato que hay que decir antes de que alguien la descubra discutiendo:** el descarte se lee de las etiquetas **actuales** del contacto, sin fecha. Una etiqueta puesta mañana reclasifica citas de la semana pasada, así que dos lecturas de la misma ventana en días distintos pueden dar tasas distintas sin que haya entrado una cita. (De ahí que el 92,0 % de hoy a catorce días no sea idéntico al 94,4 % del 2026-09-14: la ventana corrió y las etiquetas se movieron.)

---

## 10 · Un solo escritor por tabla

**La regla.** Cada tabla tiene **un** escritor, está declarado en la primera línea de ese archivo, y una prueba de código lo hace cumplir.

**Dónde está declarado:**

| Tabla | Escritor | Prueba que lo fuerza |
| --- | --- | --- |
| `negocio.mensajes` | `lib/negocio/mensajes.ts:1` — «EL único escritor de `negocio.mensajes`. Ahora sí.» | `pruebas/codigo/111-un-solo-escritor.test.ts` |
| `negocio.citas` | `lib/negocio/citas.ts` (el barrido) | `pruebas/codigo/147-un-solo-escritor-de-citas.test.ts` |
| `negocio.resultados` | `lib/negocio/avanzar.ts:1` — «Avanzar: el ÚNICO lugar donde se registra un resultado» | `pruebas/codigo/132-avanzar-sin-respuesta.test.ts` |
| El sello del setter | — | `pruebas/codigo/112-sello-del-setter.test.ts` |

**Por qué la regla existe: el caso de `negocio.mensajes`, con su factura.** `lib/negocio/ingesta.ts` abría diciendo ser «EL único escritor» **y era falso**: el `POST` del chat insertaba directo. El resultado, documentado línea por línea en `mensajes.ts:4-24`:

1. Mandamos un mensaje. La respuesta de GoHighLevel puede no traer identificador, y la ruta fabrica uno (`propio:<contactoId>:<epoch>`, marcado `id_fabricado: true`).
2. Más tarde la ingesta lee la conversación y trae **también los salientes**, con el identificador REAL.
3. `unique (org_id, ghl_mensaje_id)` es la única defensa, y no salta: un fabricado **no puede colisionar nunca** con uno real.
4. → **Dos filas para un mensaje**, las dos dibujadas en el chat.

«Y no falla nada. No hay error, no hay registro, no hay contador que se mueva.»

**La prueba busca la FORMA, no el nombre** (`111:53-58`): «cualquier archivo de `app/` o `lib/` que haga `insertInto('mensajes')` es un escritor, se llame como se llame».

**Por qué importa para las cifras, y no sólo para la integridad.** El encabezado de `147-un-solo-escritor-de-citas.test.ts:14-26` es el argumento más claro del repositorio:

- `inicio_anterior_el` **sólo es correcta si la escribe el `do update`**, que lee la fila vieja en la misma sentencia que la pisa. Un escritor que la ponga a mano necesita un `select` antes, y entre el `select` y el `update` la fila puede moverse: «guardaría una hora que nunca fue la anterior».
- La guarda `is distinct from` vive en ese `do update`. Un segundo escritor sin ella marca como movida una cita que no se movió, y **«cuántas se reagendaron» empieza a contar el barrido en vez del negocio**.
- «Y la que viene después: un escritor del webhook pondría como fecha de reserva la hora en que llegó el aviso, **que se parece tanto a la buena que nadie lo notaría**.»

**La excepción, y por qué no afloja la regla.** `citas.asistio` tiene un segundo escritor (`avanzar.ts`) porque **el CRM no la tiene** — su campo de asistencia está poblado en 3 de 1052 citas. El barrido la deja deliberadamente fuera de su `do update`. «No hay dos escritores de una misma columna: hay dos columnas con un escritor cada una.» La prueba se **afinó** en vez de aflojarse: ahora admite el segundo escritor y afirma que no puede tocar ninguna otra columna.

**Un corolario que vale para toda prueba de código de este repositorio.** Las pruebas de escritor único leen el archivo **sin comentarios**. El motivo está en `147:28-32`: «una prueba que leyera el texto crudo contaría explicaciones y se pondría roja por documentar bien. **Van trece veces en este repositorio.**» La función `codigo()` que quita comentarios aparece con esa nota al pie en `123`, `129`, `131` y otras.

---

## 11 · Una cadena que no es monótona no es un embudo

**La regla.** Una flecha entre dos escalones afirma que el segundo es **subconjunto** del primero. Si no lo es, la flecha miente aunque los dos números sean correctos — y entonces la cadena se corta ahí y lo que sigue es una **bifurcación**, con los dos sumandos sumando el total.

**El defecto concreto, y es el que decidió el rediseño de Conversation.** Lead Flow tiene cuatro números que puestos en fila parecen un embudo. Medidos hoy en la ventana con la que la pantalla abre:

| Escalón | Contactos |
| --- | --- |
| Entraron al CRM | 412 |
| Les escribimos | 382 |
| Respondieron | 212 |
| Agendaron | 176 |

**No lo son.** De los 176 que agendaron, sólo **94** habían contestado alguna vez. Los otros 82 agendaron sin una sola respuesta nuestra: el enlace del calendario no obliga a conversar. Una barra que vaya de 212 a 176 afirma que convirtieron 176 de esos 212 —el **83,0 %**— cuando el número real es 94 de 212, el **44,3 %**. Casi el doble, con los cuatro números correctos.

**Y la mentira es peor cuanto más corta es la ventana**, que es lo contrario de lo que uno esperaría:

| Ventana | Lo que afirmaría el embudo | Lo que es verdad | Cuántas veces |
| --- | --- | --- | --- |
| 7 días | **97,2 %** (35 de 36) | **38,9 %** (14 de 36) | 2,50 × |
| 14 días | 87,7 % (121 de 138) | 46,4 % (64 de 138) | 1,89 × |
| 30 días (la que abre) | 83,0 % (176 de 212) | 44,3 % (94 de 212) | 1,87 × |
| completo | 66,4 % (190 de 286) | 35,0 % (100 de 286) | 1,90 × |

A siete días la barra diría que **casi todos los que contestaron convirtieron**. Fueron catorce de treinta y seis. El ejemplo que quedó escrito en el código y en los documentos —el de catorce días— es el caso intermedio, no el peor.

**Por qué es cara: no falla.** No hay error, no hay aviso, no hay número que no cuadre. Los cuatro valores se pueden auditar uno por uno y están bien. Lo único falso es la flecha, que no es un dato sino un dibujo — y un dibujo no tiene prueba que lo contradiga a menos que alguien la escriba.

**La forma honesta, y por qué es una regla y no una decisión de diseño.**

1. **La cadena se corta donde deja de ser monótona.** En Lead Flow, en «respondieron» (`components/conversation/PanelDeConversation.jsx:508-537`), y el pie de la tarjeta lo dice con todas las letras (`:562-566`): «agendar no exige haber contestado, así que una flecha de un escalón al otro diría algo falso con números correctos».
2. **Lo que sigue es una bifurcación en tono menor, no un cuarto eslabón** (`:538-560`). Las dos barras juntas llenan la fila: eso es lo que hace comprobable de un vistazo que sumen.
3. **Los dos sumandos salen de la MISMA pasada que su total** (`lib/negocio/indicadoresDelLead.ts:221-223`), y el complemento se calcula en el módulo, no restando en la pantalla (`:223`). Restarlo al dibujar dejaría que los dos vinieran de dos consultas y pudieran no sumar.
4. **Hay una prueba que exige la suma** (`pruebas/base/150-indicadores-del-lead.test.ts:488`), y su fixture pone los cuatro casos posibles —contestó y agendó, contestó y no, agendó sin contestar, ni una cosa ni la otra— porque sin el tercero la cifra podría estar devolviendo `agendaron` entero. Una segunda prueba (`:531`) impide que se confunda con la tasa de respuesta, con los tres números distintos a propósito.

**Medido: la suma cierra en las tres ventanas con datos, descuadre 0.** 14 + 21 = 35 (7 días) · 94 + 82 = 176 (30 días) · 100 + 90 = 190 (completo). En «hoy» los tres números son cero, y lo son por sequía de altas y no porque el negocio diera cero: el último alta del CRM es del 2026-09-13 05:13 y el reloj marcaba las 17:25 del 15. Y el sumando «se agendaron solos» no es una sola cosa: a treinta días son **68** a quienes les escribimos y nunca contestaron más **14** que nunca recibieron un mensaje. Van juntos a propósito —para esta pregunta significan lo mismo— y partirlos daría dos cifras que se mueven con tres contactos.

**Cómo saber si una cadena nueva es un embudo, antes de dibujarla.** Preguntar si el escalón N+1 **exige** el N. Si se puede llegar al segundo sin pasar por el primero, no hay flecha: hay dos poblaciones que se cruzan, y dibujarlas en fila es afirmar una conversión que nadie midió. Vale para los cinco departamentos, y no sólo para las cuatro cifras de Lead Flow.

---

## Las otras reglas transversales, que no estaban en la lista

Salieron de leer los encabezados de `lib/negocio/*.ts`, `db/migraciones/*.sql` y `pruebas/codigo/*.test.ts`. Todas tienen un defecto pagado escrito al lado.

**12 · Un solo predicado por concepto.** Dos cifras de la misma pantalla no pueden tener cada una su definición de «cancelada». El commit `a0e1eb5` encontró exactamente eso: `consumoDelPrecall` usaba `not like 'cancel%'` y `indicadoresDeCitas` la lista cerrada `ESTADOS_CANCELADOS` (`lib/ghl/calendarios.ts:192`). «Hoy coinciden, pero el vocabulario se mueve, y un `cancelled_by_owner` futuro sería *no cancelada* para una cifra y *cancelada* para la otra, en la misma pantalla.» **Y el riesgo es vivo, medido hoy:** producción tiene 3 citas en estado `noshow`, las tres alcanzables y las tres dentro de la ventana — un valor que **no está** en `ESTADOS_CANCELADOS`, así que hoy cuentan en el denominador y no como canceladas. Es una decisión, no un accidente; pero es la clase de valor que aparece sin aviso.

**13 · El denominador se elige, y `exists` no es `join`.** Cuando el campo vive en el contacto y la cifra habla de citas, el denominador son CONTACTOS (`indicadoresDeCitas.ts:151-155`): «contar citas repetiría el mismo valor dos veces y lo haría pesar doble». Y siempre `exists`, nunca `join` (`:217-219`): «con el `join`, un contacto con tres citas contaría tres veces, y su única respuesta pesaría el triple que la de quien tuvo una sola». Lo mismo en `indicadoresDelLead.ts:186-187`.

**14 · Mediana y percentiles, nunca promedio.** `indicadoresDelLead.ts:51-61`, con la medición: en el tiempo hasta el primer intento **el promedio es 30,6 veces la mediana** (71,0 contra 2,32 minutos), porque una sola conversación de dos días y medio lo arrastra entera. Y el p90 va **siempre** al lado del p50: en el tiempo hasta la primera respuesta el p90 es **61 veces** el p50 (6 minutos contra 6,2 horas). «Publicar sólo la mediana diría *contestan en seis minutos* de un negocio donde uno de cada diez tarda más de seis horas.» **Y desde que la ventana se elige, el p90 es además lo único que se mueve:** medido hoy a las 17:25, el tiempo hasta el primer intento tiene p50 2,34 min y p90 5,34 min a catorce días (sobre 224), y p50 **2,78** con p90 **483,65** a treinta (sobre 381). La mediana no se enteró; la cola lenta que la ventana nueva importó está entera arriba del percentil 90. Publicar una sola de las dos cifras haría que ensanchar la ventana pareciera no cambiar nada.

**15 · Lo que no se puede clasificar se cuenta aparte.** `consumoDelPrecall.ts:229-238`: `-20%`, `Clic a link` y `Accede: sin reproducir` no se fuerzan a ninguna rama — son 7 contactos, más que los 3 que completaron el video. «Elegir por ellos movería la cifra con casos que nadie entendió.»

**16 · Dos regímenes de vocabulario van a la misma rama.** `consumoDelPrecall.ts:43-51`: `Sin abrir (0%)` deja de escribirse de golpe el 2026-09-08 y `Nada` ocupa su lugar, sin transición. «Nadie dejó de no-abrir videos un martes: es el mismo valor renombrado.» Si fueran a ramas distintas, cualquier serie temporal mostraría **un derrumbe fantasma el 8 de septiembre**.

**17 · El rótulo es parte de la cifra.** La misma tabla, mismo archivo: `Nada` y `Sin abrir (0%)` son el estado inicial que el CRM escribe **al agendar**. Evidencia: de las 13 citas futuras, las 13 ya tienen el campo y 11 ya dicen «sin reproducción» — su llamada no ocurrió. Por eso la rama se llama «el CRM registró reproducción» y no «vio el video»: con el rótulo equivocado, «dos tercios de los leads quedan acusados de ignorar un video cuando parte de eso es un medidor que no reportó».

**18 · Una cifra medida que llega a una cadena VISIBLE va fechada.** Regla nueva del commit `a0e1eb5`. Dos cadenas decían «3 citas de 1052» y «las 316 citas» en presente, «cuando la tabla crece todos los días». Corregidas en `components/conversation/PanelDeConversation.jsx:128` («medido en septiembre de 2026, 3 citas de 1052 en todo un año») y `:946` («las 316 citas que había al medirlo, en septiembre de 2026»).

**19 · Lo que la pantalla mide no puede estar en su lista de «lo que falta».** `pruebas/codigo/151-lo-que-se-mide-no-se-declara-faltante.test.ts`. Cuando la `049` dio la columna `asistio`, la tarjeta «Se presentaron» apareció y el renglón que decía «La asistencia: el CRM tiene los campos y están casi vacíos» se quedó tres centímetros más abajo. «Un cartel que se contradice con la pantalla enseña a no leer los carteles: se pierde la credibilidad de los tres que había que leer.» **Es la regla del silencio con otro traje.** La relación se declara a mano, un renglón por cifra publicada, y el costo es el punto: «agregar una cifra a la pantalla obliga a pasar por este archivo».

**20 · Teniendo datos, la pantalla no se vacía nunca.** `lib/usarLectura.ts`, forzada por `pruebas/codigo/123-relojes.test.ts` y `131-avisos-desactualizado.test.ts`. Una recarga periódica que ponga «cargando» y anule la pantalla al fallar «parpadearía las siete cifras cada minuto y borraría números correctos por un corte de red de un segundo». El aviso va **al lado**, no en lugar del dato.

**21 · Todo sondeo repetido pasa por `lib/reloj.ts`.** `pruebas/codigo/123-relojes.test.ts`. Garantía número uno: **pestaña oculta = cero intervalos corriendo**. Ya se rompió dos veces; la segunda, `components/Nav.jsx` sondeaba cada 20 segundos con su propio `setTimeout`: **180 peticiones por hora y por persona conectada**, mirara o no alguien la aplicación. Las cadencias viven en un solo lugar, `lib/cadencia.ts`: `chat` 5 s, `operacion` 10 s, **`inteligencia` 60 s** (`:90`) — más lenta a propósito, «son agregados sobre catorce días, y pedirlos seis veces por minuto pagaría siete consultas pesadas para redibujar el mismo número». (El comentario de `cadencia.ts:81-84` sigue diciendo catorce; el argumento no depende del número —una cifra que resume semanas no se mueve en diez segundos— pero la ventana ya es de treinta y se elige en pantalla.)

**22 · Ninguna ruta autenticada se cachea.** `ADR-0701`, forzado por `pruebas/codigo/70-publicacion.test.ts` y por `10-arquitectura.test.ts:304` («ninguna primitiva de caché bajo `app/`»), `:356` («la caché no se puede activar por la puerta de al lado») y `:399` (`cacheComponents` desactivado).

**23 · Toda operación abre el contexto de su organización.** `ADR-0202`, INNEGOCIABLE, forzado por `10-arquitectura.test.ts:234`. El encabezado explica por qué es análisis estático y no una prueba de comportamiento: «olvidarse NO FALLA: la operación funciona, sin verificar nada». En el sistema del que salen estas notas, **catorce operaciones ya estaban escritas sin activar el contexto** y ninguna fallaba — leían los datos de la organización equivocada.

**24 · Toda fecha que una persona lee se formatea en la zona de la ORGANIZACIÓN.** `lib/negocio/tiempo.ts:1-24`. Defecto pagado dos veces: «cuando cada pantalla la calculaba por su cuenta, **dos vitrinas mostraban horas distintas para la misma cita**». El instante se guarda en `timestamptz` y la zona se aplica sólo al mostrarlo.

**25 · Todos los literales del CRM en un archivo.** `lib/ghl/contrato.ts:1-26`. Tres razones, y la tercera es la que vale: **«un tag mal escrito no da error. No hace nada.»** El contacto aparece en la cola equivocada y nadie tiene dónde mirar. Cada literal lleva su confianza: `confirmado` / `pendiente` (existe internamente y **no se manda**) / `sin_confirmar` (**sólo lectura**).

**26 · Un dato de configuración disfrazado de constante se declara como tal, con la condición de mudanza escrita.** `CAMPO_DE_CONFIRMACION` (`indicadoresDeCitas.ts:188-199`) y `ETIQUETAS_DE_DESCARTE` (`contrato.ts:224-226`) dicen los dos lo mismo: «el día que haya una segunda empresa con otro nombre, esto se muda a una columna de `organizaciones_credenciales`, **y este comentario dice cuándo dejó de serlo**».

**27 · Leer el catálogo no cambia lo que se muestra.** `campoPorNombre` (`lib/negocio/camposDelCrm.ts:307`) existe porque el único camino al catálogo era `camposQueSeMuestran()`, que filtra por la decisión de qué se dibuja en la ficha del closer. «Son dos preguntas distintas —*qué mira una persona* y *qué necesita una cifra*— y mezclarlas haría que agregar un indicador cambiara lo que el closer ve, sin que nadie lo pidiera.» El precio está dicho: si alguien renombra el campo en el CRM, devuelve `null`, «y por eso quien lo usa tiene que poder decir *no sé* en vez de *cero*».

**28 · Un módulo que comparten el servidor y el navegador no puede importar nada que toque la base.** `lib/negocio/periodo.ts:25-34`, forzado por `pruebas/codigo/155-el-periodo-de-conversation.test.ts:231`, que exige que la lista de `import` de ese archivo esté **vacía**. El defecto no es hipotético: `DIAS_DE_TODO` vivía en `indicadoresDeCitas.ts`, al lado de `DIAS_DE_LA_TASA`, que es exactamente donde parecía corresponder. Como el vocabulario de períodos lo importan **los dos lados** —la ruta para validar y el componente del navegador para dibujar los botones—, esa sola línea arrastraba la capa de datos entera, y con ella el cliente de PostgreSQL, al paquete del cliente. **`next build` lo rechazó con el rastro completo, de `pg` hasta `PanelDeConversation`.** Es el caso feliz de esta lista: falló ruidoso, y temprano. La prueba existe porque el arreglo —mover la constante— se deshace sin querer, y la próxima constante compartida va a tener la misma tentación.

**29 · En CSS la especificidad manda sobre el orden, y un `@media` escrito después puede no ganar.** `app/inteligencia-estetica.css:537-541`. El corte de 900 px pasa el panel de cifras a dos columnas con `:is(.pn-b.q3, .pn-b.q4)`; el corte de 640, escrito más abajo en la misma hoja, pedía una sola columna con `.pn-b` a secas — que pesa menos. **A 400 px el panel se quedaba en dos columnas de 170 px**, con la regla correcta escrita después y sin aplicarse. Se cerró nombrando las tres variantes en el corte chico (`:533-537`). Y la parte que es regla y no anécdota está en el comentario: *«Visto en el navegador, no deducido»* — leer las dos reglas seguidas no alcanza, hay que abrirlas al ancho donde compiten.

---

## Los errores de método que este proyecto ya cometió

Los tres primeros son el mismo error, tres veces, y por eso encabezan.

## A · Buscar un nombre de columna, no encontrarlo, y concluir que el dato no existe

**Ocurrió tres veces.** Las tres, el dato venía de GoHighLevel bajo otro nombre.

| # | Lo que se dio por inexistente | Dónde venía en realidad | Commit |
| --- | --- | --- | --- |
| 1 | `meta_ad_id` | Dentro de `attributionSource`, como `adId` | `54d7ad0` |
| 2 | Las UTM | Ídem, como `utmSource` y compañía | `54d7ad0`, `7e38ddc` |
| 3 | El porcentaje de video visto | Dentro del vocabulario de un campo RADIO | `03fd9a6` |

**Verificado hoy contra la base, no contra el código:**

| Campo | Tipo | Poblado |
| --- | --- | --- |
| `Video Pre-Call` | RADIO | **213 de 584** ← el porcentaje está acá |
| `Clic a Video Pre-Call` | SINGLE_OPTIONS | 20 de 584 |
| `Video Watch Percentage` | NUMERICAL | **0 de 584** ← el que se miró |
| `Porcentaje de Video Visto` | NUMERICAL | **0 de 584** ← y el otro |

Y la atribución, en `negocio.contactos`: **544 de 584** con `sessionSource`, **506** con `utmSource`, **213** con `adId`. Se llegó a proponer conectar el API de Meta para conseguir esa atribución. No hacía falta: venía en la misma respuesta que ya se pedía.

**La regla que sale de ahí:** *«Cierto como nombre de campo, engañoso como conclusión.»* Y su forma operativa: **un `grep` sobre nuestro código prueba qué pedimos, nunca qué manda el proveedor.** Antes de escribir «este dato no existe», hay que medirlo contra la base o contra la respuesta cruda del proveedor.

## B · Escribir el pendiente y creer que es aplicarlo

Detallado en §8. Tres incidentes, dos de ellos con caída de producción, uno silencioso (69 minutos de cron caído). La lección: **la regla que funciona es de orden, no de memoria.** Y la corrección de la corrección: no basta preguntar qué *lee* el arranque; hay que preguntar **qué toca la columna, en cualquier sentido**.

## C · Columnas con escritor y sin lector

Un patrón propio, con al menos cuatro casos en dos semanas. El dato estaba guardado, completo, y ninguna línea del sistema lo consultaba:

| Dato | Cuánto llevaba guardado | Commit que lo conectó |
| --- | --- | --- |
| `atribucion_primera` / `atribucion_ultima` | 4 commits, 544 contactos | `1fce636` |
| `alta_en_el_crm` | 3 commits, 559 contactos | `91e4e07` |
| `analisis_del_agente.sentimiento` | desde que existe el módulo | `ae600f2` |
| `Confirmación Agendamiento` | desde la `039`, 178 contactos | `10fde57` |
| `mensajes.fuente`, la entrega, `resultados.salida` | ya poblados | `4f752f7` |

El coste no es sólo la cifra que falta: es que **se propusieron integraciones externas para conseguir datos que ya estaban en la base**.

**Estado hoy, verificado:** no queda ninguna columna con escritor y sin lector, salvo `resultados.cita_id`, que tiene **0 filas con dato** porque la `049` es reciente y los 7 resultados existentes son anteriores. No hay nada que conectar hasta que se registren intentos nuevos.

**Pero el patrón volvió por otra puerta, y hay que decirlo acá: un CAMPO CALCULADO sin lector.** El rediseño de Conversation dejó `aviso` de Lead Flow (`indicadoresDelLead.ts:170`, armado en `:315`) sin nadie que lo dibuje — el detalle y lo que se pierde están en el §1. No es una columna de la base, así que ninguna de las búsquedas que encontraron los cinco casos de arriba lo habría visto: **el escritor y el lector de un aviso están los dos en el código, y la distancia entre ellos es la misma.** La forma de detectarlo también: preguntarle al campo quién lo consume, no al módulo si lo produce.

## D · Concluir una tendencia de un sesgo

La tasa de cancelación subía hacia el presente —61,9 % a siete días, 60,1 % a catorce, 52,9 % a treinta, 50,6 % en total— «y eso se parece a una tendencia. No lo era». Era la proporción creciente de citas congeladas en las ventanas más largas. **Antes de leer una serie por período, hay que preguntarse si la cobertura del dato es constante en el tiempo.**

**Y estuvo a punto de volver a pasar, con el mismo mecanismo y una diferencia que lo empeoraba.** El booking rate de Lead Flow caía de 50,0 % a 44,8 % a 34,1 % al ensanchar la ventana, y la caída era el filtro de citas congeladas —sin él la serie es 50,0 → 50,4 → 48,2— como está medido en el §4. La diferencia con la primera vez: entonces había que escribir una consulta para producir el sesgo, y acá **había cuatro botones que lo producían en un clic**, sobre la cifra que titula la pestaña. Se sacó el filtro de esa cifra. Lo que queda como regla es lo general: un control que ofrece ventanas donde la cobertura del dato cambia tiene que declarar ese cambio en cada una de ellas, o está invitando a esta conclusión.

## E · Aflojar una prueba en vez de corregir la cohorte que medía

Al corregir la cohorte de Lead Flow, dos pruebas que afirmaban que el closer NO cuenta pasaron a afirmar lo contrario. El commit `91e4e07` lo argumenta en el encabezado: «**no es aflojar una prueba, es corregir la cohorte que medía**». La distinción tiene que quedar escrita, o el próximo cambio de prueba se justifica solo.

## F · Pruebas que fallan sobre un archivo correcto

Dos casos documentados en `1fce636`: una buscaba una guarda en una ventana de 300 caracteres «que la tercera cifra desbordó», y otra anclaba en una frase que también aparece en un comentario. «Una prueba que falla cuando todo está bien es una prueba que alguien apaga» (`151:26-27`). Las dos se reescribieron para afirmar **la propiedad** y no **la distancia**. Y la lección hermana, ya pagada trece veces: las pruebas de código leen el archivo **sin comentarios**, o se ponen rojas por documentar bien.

## G · Nombrar un agente a mano

La primera versión de la tarjeta de sentimiento escribía `'chat_pre_agenda'` en la ruta, y `pruebas/codigo/114-derivacion-del-nivel.test.ts` la rechazó. El motivo está pagado por la plataforma anterior: «la base aceptaba cuatro agentes, el código validaba contra una lista de dos, y los patrones de voz no se podían cerrar ni medir». **Las listas salen de una constante, no del teclado.**

## H · Creer que revisar el código alcanza para revisar una pantalla

El rediseño de Conversation dejó cuatro defectos, y la columna que importa es la de la derecha: **tres aparecieron mirando** —no los habría encontrado ningún razonamiento sobre el código ni ninguna prueba de las 1.764— y **el cuarto lo cazó una herramienta sobre el código**, `next build`, sin que nadie abriera la página. Ése es el caso feliz de la regla 28: falló ruidoso y temprano, en el único de los cuatro que tenía quién lo hiciera fallar. Los otros tres no tenían.

| Qué estaba mal | Dónde quedó escrito | Cómo apareció |
| --- | --- | --- |
| El vocabulario de períodos metía el cliente de PostgreSQL en el paquete del navegador | `lib/negocio/periodo.ts:25-34` | Lo rechazó `next build` |
| La columna del nombre medía **397 px** a 1280: «Entraron al CRM» arrancaba en x=22 y su «231» caía en x=431 | `app/inteligencia-estetica.css:244-252` | Mirándola |
| A 400 px el panel seguía en dos columnas: la especificidad le ganaba al orden | `app/inteligencia-estetica.css:537-541` | Mirándola a 400 px |
| El precall decía el mismo número dos veces, en el encabezado y en una celda | `components/conversation/PanelDeConversation.jsx:761-763` | Mirándola |

El de los 397 píxeles es el más difícil de argumentar sin haberlo visto: **los dos elementos eran legibles**. Nada estaba cortado, nada se superponía, ninguna prueba podía fallar. Lo que pasaba es que el rótulo y su número dejaban de leerse como una sola cosa, y eso no tiene otra forma de detectarse que abrir la página y medir.

**Y uno que parecía defecto y no lo era, que es la otra mitad de la regla.** Los nombres de la tabla de atribución parecían más tenues que los de la cadena de al lado. Medido, **el color es idéntico en las dos**: lo que cambiaba era que un renglón estaba en minúsculas. Corregir el color habría sido mover un valor correcto para perseguir una impresión, y habría dejado en la hoja una excepción sin motivo que el próximo que la lea no va a poder explicar. **Medir antes de arreglar vale también para lo que se ve, no sólo para lo que se cuenta.**

**Lo que sigue pendiente, dicho como corresponde:** nadie abrió esta pantalla con datos reales. El rediseño se verificó montando el marcado real sobre las hojas reales, en los dos temas y a 1280, 880 y 400 px, y el cableado lo cubren las pruebas. Falta la mirada de alguien con sesión abierta, sobre todo para revisar dónde quedó la línea entre aviso visible y nota escondida.

---

## Lo que NO pude verificar, y lo que encontré de paso

Dicho como pendiente, que es la regla.

**No verificado — lo histórico.** Los tres incidentes de despliegue (§8), los códigos de error `42P01`, `42703` y `42501`, los 69 minutos de cron caído y la corrida única perdida del 2026-09-11 salen de los mensajes de commit y de la memoria del proyecto. Son hechos documentados en su momento; **no los pude re-medir**, porque no hay registro de errores consultable desde acá y las ventanas ya pasaron.

**No verificado — el corte de vocabulario del 2026-09-08.** El commit `03fd9a6` afirma que `Sin abrir (0%)` deja de escribirse de golpe ese día y `Nada` ocupa su lugar. No lo comprobé: requiere cruzar el valor del campo contra `alta_en_el_crm` por día, y no lo corrí. Lo que **sí** verifiqué es que los dos valores existen y que los dos campos NUMERICAL están en cero.

**No verificado — la protección de rama.** `docs/ETAPA-8.md:170` y `DESPLIEGUE.md:396` la declaran pendiente. No tengo forma de comprobar el estado actual en GitHub desde una consulta a la base. **Si sigue pendiente, la regla de §8 es lo único que separa un commit rojo de producción.**

**Encontrado de paso — una cadena visible que incumple la regla 18.** `lib/negocio/indicadoresDeCitas.ts:491` arma un aviso que se dibuja en pantalla (`PanelDeConversation.jsx:672`) y termina con *«el CRM tiene ese campo en 3 de 1052 citas»*, en presente y sin fecha. Es la misma cifra que el commit `a0e1eb5` fechó explícitamente en la cadena vecina del panel («medido en septiembre de 2026, 3 citas de 1052 en todo un año»). No es un defecto de cálculo; es la regla nueva que todavía no alcanzó a este renglón.

**Encontrado de paso — un comentario que afirma sin medir, en el archivo que define las ventanas.** `lib/negocio/periodo.ts:48` dice que diez años es más que la vida del CRM de esta empresa «—la fila más vieja es de 2026—», y `pruebas/codigo/155-el-periodo-de-conversation.test.ts:97` lo repite. Medido: `min(alta_en_el_crm)` es **2025-08-08 13:11:41**, y hay 6 contactos de 2025. No rompe nada —3.650 días los cubren de sobra— pero el `desde` de «completo» va a mostrar una fecha de 2025, que es justo lo que ese comentario promete que no pasa. Es la regla de medir aplicada a una frase de paso: la conclusión («la ventana no recorta nada») es cierta, el hecho con el que se la justifica no.

**Encontrado de paso — dos agujeros de integridad que ninguna de estas reglas cubre** (y que la memoria del proyecto ya tenía anotados; los verifiqué):

1. **25 contactos con `territorio` nulo.** `congelarLosQueYaNoEstan` pone el territorio en nulo y **no toca `sincronizado_el`**; como la búsqueda del barrido es por etiqueta, `guardar()` no vuelve a correr sobre esa fila. Resultado: son invisibles para todas las cohortes de Lead Flow **sin ningún aviso**. Verificado: 25 contactos en ese estado, 4 de ellos con cita. Y son **exactamente los mismos 25** que no tienen `alta_en_el_crm` (medido: las tres cuentas dan 25), así que la invisibilidad no depende del botón de período — `null >= now() - interval` es falso en las cuatro ventanas, «completo» incluida. El cuarto botón no los rescata, y la pantalla no dice que existen.
2. **Las citas no tienen resta.** No hay equivalente de `congelarLosQueYaNoEstan` en `lib/negocio/citas.ts`: una cita que el CRM deja de listar conserva su `estado_ghl` para siempre y sigue contando. Hoy las que quedan fuera lo hacen **por casualidad** —son anteriores a la `042` y no traen `ghl_calendario_id`— y ese accidente deja de protegernos, porque toda cita nueva sí lo trae.

Los dos son del tipo que estas reglas existen para hacer visibles, y hoy no lo son.

---
