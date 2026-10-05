# Las reglas transversales: lo que hay que saber antes de escribir una cifra nueva
> Corte: **2026-09-28**. Las cifras de producción se midieron ese día entre las **22:06 y las 22:11
> UTC**, con `scripts/supabase.mjs leer` y sólo agregados: de la base no salió un nombre, un correo ni
> un teléfono. Cada afirmación lleva su archivo:línea, su commit o la consulta que la produjo.
> Lo que no se pudo verificar está dicho como pendiente, no omitido.
> Para ubicar cualquier cosa nombrada acá, ver [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md).

> **Desde el corte del 2026-09-15**
>
> - **Las reglas dejaron de vivir en una sola pantalla.** La foto anterior decía que Conversation era
>   la única de Inteligencia construida. Después dejaron de ser maqueta Acquisition (`be5ba97`,
>   2026-09-16), Creative (`3287f74`, 09-19), Conversion (`0add4cc`, 09-20), Sales (`1c875ac`, 09-21)
>   y Leads Portal (`aed4f27`, 09-26), y nació Analizadores (`35665f2`, 09-23). Las once reglas
>   centrales se ejercen hoy en seis pantallas, y varias se mudaron de un módulo de Conversation a un
>   archivo compartido.
> - **Las once siguen en pie, y casi todas sus cifras cambiaron.** Las congeladas dentro de la ventana
>   de catorce días pasaron de 11 a **0**, y dentro de la de treinta de 77 a **14** (§ 4); la tasa de
>   cancelación del negocio a treinta días, de 40,9 % a **32,0 %** a las 22:06 UTC (§ 9). Y casi no
>   entran leads: **desde el 2026-09-14 entraron 8 contactos** (una caída real de las altas, según
>   [10-LEADS-PORTAL.md](10-LEADS-PORTAL.md)), así que las ventanas cortas se vaciaron y los
>   ejemplos de catorce días de la foto anterior ya no se pueden reproducir (§ 5, § 11).
> - **Doce reglas nuevas, de la 30 a la 41**, cada una con el defecto que cerró y su commit (§ «Las
>   reglas que aparecieron entre el 2026-09-16 y el 2026-09-28»).
> - **Errores de método:** el A —concluir que un dato no existe— pasó de tres casos a **siete**, y hay
>   cinco nuevos, del I al M.
> - **Lo que la foto anterior dejó abierto, re-verificado hoy:** el `aviso` de Lead Flow sigue sin
>   lector (§ 1), la cadena visible sin fecha sigue sin fecha, el comentario «la fila más vieja es de
>   2026» sigue siendo falso y los 25 contactos con territorio nulo siguen ahí (sección final).
> - El párrafo «Actualización del 2026-09-26» que `4fc9e43` le agregó a esta página queda absorbido
>   en este corte.

Comando Central tiene un cuerpo de reglas que no pertenecen a ningún departamento: valen para todos.
No son estilo ni gusto — cada una cerró un defecto concreto que ya estaba en producción, y casi todas
están escritas en el encabezado del archivo que las paga. Este informe las reúne, las ordena y
verifica sus cifras contra la base de producción (mediciones del 2026-09-28, 22:06 a 22:11 UTC). Hay
once reglas centrales —el silencio, el piso de 10, los dos ceros, las citas congeladas, la cohorte
contra el territorio, la ventana y su lista cerrada, la RLS forzada, la migración antes del push, el
descarte propio, un solo escritor por tabla y **la cadena que no es un embudo**—, dieciocho menores
que ningún documento había reunido (12 a 29) y doce que aparecieron al construir las otras seis
pantallas (30 a 41). Y una sección final con los errores de método que este proyecto ya cometió: siete
veces se concluyó que un dato no existía y existía; tres veces se empujó código antes de aplicar su
migración; y más de una vez una prueba verde no estaba mirando nada.

---

## Cómo leer esto, y de dónde salen las reglas

Ninguna de estas reglas se inventó para este informe. Todas estaban escritas —en el encabezado de un
módulo de `lib/negocio/`, en el comentario de una migración de `db/migraciones/`, o convertidas en una
prueba de `pruebas/`— con su defecto pagado al lado. Lo que faltaba era tenerlas juntas.

**Tres cosas sobre el método de este documento, porque son las mismas que las reglas exigen:**

1. **Se mide, no se supone.** Cada cifra lleva su archivo:línea o la consulta que la produjo. Las
   consultas se corrieron en modo lectura contra producción con
   `node --env-file=.env.supabase scripts/supabase.mjs leer`, juntando varias cifras por consulta.
2. **Un `grep` sobre nuestro código prueba qué pedimos, nunca qué manda el proveedor.** Donde la
   afirmación es sobre el dato, la evidencia es una consulta a la base, no una búsqueda en el
   repositorio.
3. **Lo histórico se cita como historia.** Los incidentes de despliegue y las mediciones que quedaron
   en los mensajes de commit no se pueden volver a medir: se citan con su commit (`git log
   --format=%B`) y se marcan como tales. Lo que no se volvió a medir hoy dice «del 2026-09-15, no
   re-medida».

**El reloj de las mediciones.** `now()` en producción devolvió `2026-09-28 22:06:43 UTC` en la primera
consulta y `22:11:07` en la última: «30 días» empieza el 2026-08-29, y toda cifra de ventana de este
documento es de esa hora. La ventana rueda sola: [04-CONVERSATION.md](04-CONVERSATION.md) midió a las
18 h 277 contactos y 37 canceladas de 106 donde acá hay 276 y 33 de 103, las dos correctas a su hora
(§ «Cómo se midió este corte»). La cancelación a catorce días, **22,2 %** sobre 18, no se movió (§ 9).

**El mapa del producto, para ubicarse.** `lib/autorizacion/secciones.ts:158-161` define tres grupos del
cuerpo del menú, más el pie donde va Ajustes: AIOS (Executive, Leads Portal, ICP & Oferta),
Inteligencia (Acquisition, Creative, Conversion, Conversation, Sales) y Operación (Setter, Closer,
Analizadores, Tools, Monitoreo; Analizadores entró el 2026-09-23,
`lib/autorizacion/secciones.ts:363-366`). Las cinco de Inteligencia y Leads Portal tienen ruta propia
y dibujan datos reales; la única pantalla que sigue sin operaciones de servidor es
Executive (`lib/autorizacion/secciones.ts:216`). Estas reglas nacieron casi todas en Operación, se
ejercieron primero en Conversation y entre el 16 y el 26 de septiembre se aplicaron a las otras cinco.

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

**La forma canónica son tres estados, no dos** (`lib/negocio/indicadoresDeCitas.ts:506-518`):

| Estado | Qué dice | Qué manda a hacer |
| --- | --- | --- |
| Sin base | «no hay cifra, y por qué» | esperar, o revisar el flujo |
| Con base incompleta | «la cifra vale, y sobre cuántas NO se contó» | leer la cifra sabiendo su recorte |
| Todo lo demás | **`null`** — nada en pantalla | nada |

Y el tercero se apaga solo: «el día que dejen de caer en la ventana […] el aviso desaparece solo».
**Ya pasó en dos ventanas:** medido el 2026-09-28, ninguna cita congelada cae en los últimos siete ni
en los últimos catorce días (§ 4), así que ahí el aviso de congeladas calla sin que nadie lo tocara. A
treinta días quedan 14; la más nueva de las 101 es del 2026-09-10, así que alrededor del 2026-10-10 se
apaga también ahí.

**Dónde está implementada.** La foto anterior contaba ocho campos; medido el 2026-09-28 con `grep` del
patrón `aviso…: string | null` sobre `lib/`, son **28 campos en 18 archivos** —los de Conversation más
los de Acquisition, Creative, Conversion, Sales y Leads Portal—. Los de Conversation, re-verificados:

| Archivo:línea | Campo | Quién lo dibuja |
| --- | --- | --- |
| `lib/negocio/indicadoresDeCitas.ts:72` | `aviso` (cancelación) | `components/conversation/PanelDeConversation.jsx:677` |
| `lib/negocio/indicadoresDeCitas.ts:100` | `avisoDeLaVentana` | `components/conversation/PanelDeConversation.jsx:609` |
| `lib/negocio/indicadoresDeCitas.ts:155` | `avisoDeAsistencia` | `components/conversation/PanelDeConversation.jsx:676` |
| `lib/negocio/indicadoresDeCitas.ts:172` | `avisoDeConfirmacion` | `components/conversation/PanelDeConversation.jsx:965` |
| `lib/negocio/indicadoresDelLead.ts:106` | `avisoDeLaVentana` | `components/conversation/PanelDeConversation.jsx:496` |
| `lib/negocio/indicadoresDelLead.ts:126` | `avisoDelBooking` | `components/conversation/PanelDeConversation.jsx:507` |
| `lib/negocio/indicadoresDelLead.ts:183` | `aviso` (Lead Flow) | **nadie — ver abajo** |
| `lib/negocio/indicadoresDelLead.ts:185` | `avisoDeLatencias` | `components/conversation/PanelDeConversation.jsx:924` |
| `lib/negocio/atribucionDelLead.ts:69` | `aviso` | `components/conversation/PanelDeConversation.jsx:718` |
| `lib/negocio/consumoDelPrecall.ts:133` | `aviso` | `components/conversation/PanelDeConversation.jsx:794` |
| `lib/auditor/sentimiento.ts:65` | `aviso` | `components/conversation/PanelDeConversation.jsx:818` y `:835` |
| `lib/negocio/frescura.ts:58` y `:215` | `aviso` (frescura del barrido) | no re-verificado |

Los otros 15 campos de las otras pantallas (28 menos los 13 de la tabla) no se auditaron uno por uno
contra su lector: **no verificado** que todos se dibujen.

**El otro modo de romper esta regla, y sigue roto trece días después: un aviso que nadie dibuja.** El
de la cohorte de Lead Flow se declara en `lib/negocio/indicadoresDelLead.ts:183`, se arma en `:323`
con `avisoDe` (`:407-423`), y ni `r.aviso` ni `respuesta.aviso` aparecen una sola vez en las 989 líneas
del panel (`grep` del 2026-09-28). Y no es un aviso que sobre: medido el 2026-09-28 en la ventana con
la que abre la pantalla, entraron 276 contactos y se les escribió a 269, así que el campo trae
*«7 contacto(s) no entran en la tasa de respuesta porque todavía no se les escribió…»*, y nadie lo lee.
En una ventana sin altas el que se pierde es el que explica el tablero entero —*«No entró ningún
contacto nuevo al CRM en N días»* (`lib/negocio/indicadoresDelLead.ts:409`)— mientras la pestaña dibuja
«Cada barra es sobre los 0 que entraron» (`components/conversation/PanelDeConversation.jsx:488`). **Un
aviso sin lector es peor que un aviso siempre encendido: al segundo se lo puede aprender a ignorar, al
primero no hay forma de notarlo.**

**Un corolario fuera de las cifras.** `lib/auditor/rubrica.ts:559` usa el mismo argumento dentro del
prompt del modelo: un renglón «Mensajes no entregados: 0» en cada análisis enseña a saltearlo, «y
cuando aparezca un 1 va a saltearlo igual».

---

## 2 · El piso de una tasa: `PISO_DE_UNA_TASA = 10`

**La regla.** Ninguna tasa de este sistema se publica con menos de diez eventos en el
**denominador**. Por debajo del piso el valor es `null`, se dibuja el conteo, y el aviso explica por
qué.

La constante vive en `lib/negocio/indicadoresDeCitas.ts:309`, con su justificación en `:293-308`.

**Por qué diez, y no es gusto.** El no-show reportado se declara como **conteo y no como tasa** porque
medía 2 eventos en catorce días —«una tasa sobre dos eventos no es una tasa»
(`lib/negocio/indicadoresDeCitas.ts:121-127`)—. Con diez, un registro mueve diez puntos: sigue siendo
mucho, y ya no es absurdo.

**El piso es del DENOMINADOR, no del total.** Dicho en `lib/negocio/indicadoresDeCitas.ts:305-307`:
«con 151 citas y 3 respuestas la muestra son 3, y quien contestó esas tres no es una muestra al azar
de las 151».

**Por qué se renombró.** Se llamaba `PISO_DE_ASISTENCIA`; el commit `1fce636` lo cambió porque
«nombrar una constante compartida por la primera que la necesitó invita a que la quinta se escriba su
propio piso», y el motivo sigue escrito en `lib/negocio/indicadoresDeCitas.ts:296-298`.

**Quién lo usa hoy.** Medido el 2026-09-28 con `grep`: **15 archivos de `lib/` nombran la constante**
(la foto anterior listaba ocho cifras en cuatro archivos). Los de Conversation, re-verificados: la asistencia
(`lib/negocio/indicadoresDeCitas.ts:453-456`), la confirmación (`:462-465`), los descartados
(`:472-475`), las filas de atribución (`lib/negocio/atribucionDelLead.ts:174`), el consumo del precall
y su desglose fino con las dos ramas sobre el piso (`lib/negocio/consumoDelPrecall.ts:231` y `:239`),
y la proporción de molestos (`lib/auditor/sentimiento.ts:127`). Entre los nuevos, el commit `7d1bc8b`
dejó escrita la variante que hay que evitar: el click-to-landing de Creative **no tenía piso** y el
comentario de arriba afirmaba que sí —8 de 24 piezas tenían menos de diez clics, y la menor, con uno,
publicaba 100 %— y se arregló con `PISO_DE_UNA_TASA`, «no uno nuevo».

**El piso funcionando, y la parte que no protege.** La atribución por fuente del primer toque, medida
el 2026-09-28 con el mismo predicado de «agendó» que usa el módulo (`tieneCitaAlcanzable`,
`lib/negocio/atribucionDelLead.ts:151`) y agrupada por el valor crudo de `sessionSource`:

| Fuente | Cohorte 30 d | Agendaron | Tasa 30 d | Cohorte completo | Tasa completo |
| --- | --- | --- | --- | --- | --- |
| Paid Social | 252 | 121 | **48,0 %** | 360 | 42,2 % |
| Direct traffic | **13** | 12 | **92,3 %** | 29 | 51,7 % |
| Social media | **10** | 5 | 50,0 % | 161 | 13,7 % |
| sin fuente | 1 | 1 | — (a «Otras») | 17 | — (a «Otras»: sin etiqueta) |
| CRM UI | 0 | 0 | — | 3 | — (a «Otras») |

El encabezado del módulo (`lib/negocio/atribucionDelLead.ts:22-38`, medido el 2026-09-14) advierte
exactamente este dibujo: con 8 y 6 leads, las dos fuentes chicas tenían las tasas más altas y «dicen
que lo pago es lo que peor convierte». Hoy pasan el piso con 13 y 10, y **la trampa se dibuja entera**:
Direct traffic al 92,3 % sobre trece contactos, al lado de Paid Social al 48,0 % sobre 252. Es lo que
la foto anterior ya había visto a treinta días y ahora es más fuerte: **el piso protege de una muestra
chica, no de una comparación mal hecha.** Y en la ventana de catorce días, que es la que los
comentarios del módulo describen, la cohorte entera son 8 contactos (§ 5): ninguna fila pasa el piso y
todo va a «Otras».

**Apartar no es esconder.** La fila «Otras» lleva su conteo y las filas suman la cohorte exacta —252 +
13 + 10 + 1 = 276, medido el 2026-09-28—, así que si faltara un pedazo se vería. Lo que no recibe es
una barra que invite a compararla con una que sí tiene datos.

---

## 3 · Los dos ceros: «no hay dato» contra «el dato dice cero»

**La regla.** Dos hechos distintos no pueden colapsar en el mismo valor. «Nadie lo cargó» y «vale
cero» mandan a hacer cosas distintas, así que se representan distinto: `null` para la ausencia, `0`
para el hecho medido — y donde hace falta, un aviso que diga cuál de los dos es.

**Los enunciados canónicos:**

- `lib/datos/esquema.ts:28` — «**`null` no es cero.** `null` = nadie lo cargó; `0` = esta empresa no
  paga, que es un hecho.»
- `lib/negocio/indicadoresDeCitas.ts:426-428` — «Sin citas NO hay tasa. Un `0 %` con cero citas se lee
  como *no se cancela ninguna*».
- `db/migraciones/048_de_donde_vino_el_lead.sql:67` y `db/migraciones/049_si_se_presento_a_la_cita.sql:44-45`
  — «un nulo significa una sola cosa. *No se presentó* es `false`».

**Los casos vivos, medidos el 2026-09-28:**

| Caso | Medición | Qué significa el vacío |
| --- | --- | --- |
| `citas.asistio` | **0 de 333** citas (era 0 de 317 el 2026-09-15) | Nadie cerró el intento. **No** «no se presentó nadie» |
| `resultados.cita_id` | **0 de 7** resultados, los mismos 7 de la foto anterior (el más nuevo es del 2026-09-09) | No se registró ningún intento nuevo desde la `049` |
| `estado_ghl = 'noshow'` | **15** de 333 citas (eran 3) | El lado negativo de la asistencia sí se observa; `showed` no aparece ni una vez |
| Campo `Confirmación Agendamiento` | **184 de 594** contactos (178 de 584 el 2026-09-15) | Sin el campo en el catálogo no hay cifra, y no es «nadie confirmó» (abajo) |

La tercera fila es nueva como regla: `citasAlcanzables.ts` publica los plantones del calendario con su
propio nombre y prohíbe sumarlos con `asistio` —«son dos fuentes de la misma pregunta y sólo una es
nuestra»— (`lib/negocio/citasAlcanzables.ts:87-113`). Un «0 asistencias» y un «15 plantones» conviven
sin contradecirse porque ninguno se hace pasar por el otro.

El caso de la asistencia es el que mejor muestra por qué la regla importa:
`lib/negocio/indicadoresDeCitas.ts:365-370` dice que sin el filtro `asistio is not null` en el
denominador, como el nulo es el caso normal, «la tasa diría que no se presenta casi nadie. Sería una
cifra plausible, alarmante y falsa».

**El tercer cero: el campo puede no existir.** `confirmacionEnLaVentana`
(`lib/negocio/indicadoresDeCitas.ts:225-234`) distingue tres estados, y el primero lo dice con todas
las letras en `:277-279`: si el campo no está en el catálogo, «no es que nadie confirme». El commit
`10fde57` lo resume: «*Nadie respondió* se arregla esperando o revisando el flujo del CRM. *El campo no
existe* se arregla mirando el CRM».

**Y el cuarto, en el sentimiento del auditor.** `lib/auditor/sentimiento.ts:11-26` censa poblaciones
que se ven idénticas en `sentimiento is null`. Re-medido el 2026-09-28 sobre las 70 filas de
`negocio.analisis_del_agente` (eran 47):

| Población | Filas | Con sentimiento |
| --- | --- | --- |
| auditable, disparo `debounce` | 21 | 21 |
| auditable, disparo `alarma` | 2 | 2 |
| auditable, disparo `mejora` | 28 | **0** (el carril escribe null a propósito) |
| no auditable | 19 | **0** (nunca se llamó al modelo) |

Sobre las 70 filas la distribución diría «67 % sin dato», que describe los carriles del propio auditor
y no las conversaciones. **El denominador son las 23**, y viaja al lado.

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

**Medido el 2026-09-28 contra producción:**

| | Hoy | 2026-09-15 |
| --- | --- | --- |
| Citas totales | **333** | 317 |
| Alcanzables (`ghl_calendario_id is not null`) | **232** | 216 |
| Congeladas (`is null`) | **101** | 101 |
| Última sincronización de las congeladas | 2026-09-06 04:03 UTC | la misma |
| Rango de `inicio_el` de las congeladas | 2026-08-12 a 2026-09-10 | el mismo |
| Congeladas dentro de la ventana de 14 días | **0** | 11 |
| Congeladas dentro de la de 30 días —la que la pantalla abre— | **14** | 77 |

Las congeladas no se mueven y la ventana sí: el problema se está yendo solo por el borde trasero. Es la
regla de la ventana (§ 6) en la dirección contraria a la de la foto anterior.

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
2026-09-28: son **0** a treinta días y **79** en «Completo».

**Y eso dejó dos definiciones de «agendó» en el producto.** El booking rate de Lead Flow cuenta
cualquier cita; la atribución de la misma pantalla y Acquisition, Creative, Conversion, Sales y Leads
Portal usan `tieneCitaAlcanzable`, que excluye a quien sólo tiene congeladas
(`lib/negocio/citasAlcanzables.ts:115-145`). A 7, 14 y 30 días coinciden porque no queda nadie así;
en «Completo» Lead Flow dice **279** agendados y las filas de la atribución suman **200** (medido el
2026-09-28; el hallazgo es de [04-CONVERSATION.md](04-CONVERSATION.md) § 7). Y el comentario que
debería impedirlo afirma lo contrario: «el mismo filtro de cita alcanzable que el booking rate»
(`lib/negocio/atribucionDelLead.ts:148-150`). Es la regla 12 incumplida entre dos tarjetas vecinas.

---

## 5 · La cohorte no es el territorio

**La regla.** Una cohorte se arma con un hecho de **entrada** (cuándo entró el lead), nunca con un
estado que es **consecuencia** de lo que se quiere medir. Filtrar por `territorio` rompe cualquier
tasa de conversión, por construcción.

Enunciada en `lib/negocio/indicadoresDelLead.ts:29-31`: «**El territorio es consecuencia de agendar,
no una cohorte.** […] sobre esa población un booking rate da 2 de 280, que es una tautología».

**La medición, reproducida el 2026-09-28** (cita alcanzable = `tieneCitaAlcanzable`):

| Territorio | Contactos | Con cita alcanzable | Proporción | 2026-09-15 |
| --- | --- | --- | --- | --- |
| `setter` | 282 | **2** | 0,7 % | 2 de 280 |
| `closer` | 287 | 197 | 68,6 % | 188 de 279 |
| `null` (congelados) | 25 | 5 | — | 4 de 25 |

Sobre la población de zona setter el booking rate daría **0,7 % para siempre**, y no por el negocio
sino porque la pregunta está mal hecha. La proporción no se movió en trece días.

**La segunda cohorte rota, `creado_el`, sigue fuera** (`91e4e07`): la columna dice cuándo *nuestro
barrido* vio al contacto, y la carga inicial le puso la misma marca a 239. La cohorte es
`alta_en_el_crm` (migración `048`); medido el 2026-09-28, **570 de 594 contactos la tienen** (559 de 584
el 2026-09-15). Leads Portal nació con la misma regla escrita en su encabezado
(`lib/negocio/leadsDelPortal.ts:22-27`): el alta y no `creado_el`, de cualquier territorio.

**El precio se dice en voz alta, y esa también es la regla.** `lib/negocio/indicadoresDelLead.ts:33-36`:
la tasa de respuesta bajó de 68,1 % a 60,9 % al sacar el filtro de territorio, porque la cohorte dejó
de excluir a los que agendaron sin escribirnos nunca.

**Una sola cohorte para todas las cifras de la pantalla** (`lib/negocio/indicadoresDelLead.ts:38-43`):
con cohortes distintas, «60,9 % contesta» y «52,5 % agenda» no permitirían preguntarse cuántos hicieron
las dos.

**Medido el 2026-09-28 en la ventana con la que la pantalla abre:** 276 contactos entraron al CRM en
los últimos treinta días, **139 agendaron (50,4 %)** y a 269 se les escribió al menos una vez (el
2026-09-15 eran 412, 176 y 382). **Y la ventana de catorce días, la de los comentarios del módulo, tiene
8 contactos**: son todos los que entraron desde el 2026-09-14. El comentario de
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

La primera sigue enunciada donde nació, `lib/negocio/indicadoresDeCitas.ts:311-319` («**Catorce y no
treinta** […] Pedir una ventana más larga no trae más señal: trae más citas que el sistema dejó de
mirar»), elevada a regla de proyecto en `:20-24` y repetida en
`db/migraciones/045_cuando_cambio_el_estado_de_la_cita.sql:36-37`. Medido el 2026-09-28, con las tres
poblaciones dichas por su nombre porque no son la misma:

| Ventana | Alcanzables ya ocurridas | Las que la tarjeta publica (alcanzables **menos** descartados) | Congeladas |
| --- | --- | --- | --- |
| hoy | 2 | 2 | 0 |
| 7 días | 7 | 6 | 0 |
| 14 días | 29 | 18 | 0 |
| 30 días | **191** | **103** | **14** |
| completo | **231** | **143** | **101** |

La columna del medio es el campo `citas` de `tasaDeCancelacion`
(`lib/negocio/indicadoresDeCitas.ts:339`, `filter (where ${alcanzable} and not ${descartado})`). **La
foto anterior decía que el cuarto botón no agregaba ni una cita alcanzable sobre el tercero** (205
contra 205). Ya no: con la ventana corrida al 2026-08-29, «Completo» agrega 40 citas publicables y 87
congeladas sobre «30 días». La conclusión se dio vuelta en trece días sin que nadie tocara el código,
que es exactamente por qué un comentario que describe la lectura de una ventana envejece.

**Qué cambió de `DIAS_DE_LA_TASA`.** Sigue en 14 (`lib/negocio/indicadoresDeCitas.ts:319`) y, medido
con `grep` el 2026-09-28, es el valor por omisión de **18 funciones** en 17 archivos de `lib/` —las de
Conversation más las de Acquisition, Creative, Conversion, Sales y Leads Portal—. Las rutas les pasan siempre el período
elegido, así que ese 14 sólo actúa donde nadie pide ventana; el caso conocido sigue siendo
`citasParaCerrar` (`lib/negocio/citasParaCerrar.ts:60`), de Avanzar. **No verificado** que ninguna otra
llamada de las 18 dependa del 14.

**Las cuatro ventanas son una lista cerrada, en un archivo propio** (`lib/negocio/periodo.ts:83-96`):
`hoy` = 1 día, `7d`, `30d` y `completo` = `DIAS_DE_TODO` = 3650 (`:52`). La pantalla abre en **30 días**
(`PERIODO_POR_OMISION`, `:109`) porque catorce no es ninguno de los cuatro botones. **Entre el
2026-09-16 y el 2026-09-26 pasó de una ruta a seis**: Acquisition, Conversation, Creative, Conversion,
Sales y Leads Portal validan con `periodoDe` (`app/api/acquisition/route.ts:53`, `app/api/auditoria/route.ts:79`,
`app/api/creative/route.ts:57`, `app/api/conversion/route.ts:55`, `app/api/sales/route.ts:84`,
`app/api/leads-portal/route.ts:53`).

**El defecto que cierra la lista cerrada** está enunciado en `lib/negocio/periodo.ts:6-17` y convertido
en prueba en `pruebas/codigo/155-el-periodo-de-conversation.test.ts:58`. Leer `?dias=` como número abre
tres agujeros, **y los tres se ven bien en pantalla**:

| Lo que llega | Qué pasa si no se valida | Qué se ve |
| --- | --- | --- |
| `?dias=abc` | `NaN` cae al valor por omisión | El botón dice una ventana y las cifras son de otra |
| `?dias=90` | Se atiende como si existiera | Números correctos de una ventana que nadie decidió |
| `?dias=-5` | `now() - interval '-5 days'`: una ventana **en el FUTURO** | Cero filas, dibujadas como «no pasó nada» |

Por eso `periodoDe()` (`lib/negocio/periodo.ts:188`) devuelve `null` ante cualquier clave desconocida y
**`null` significa rechazar**: `app/api/auditoria/route.ts:80` lo convierte en un 400. La prueba exige
el rechazo con `=== null` y prohíbe el `??` (`pruebas/codigo/155-el-periodo-de-conversation.test.ts:126`),
porque `periodoDe(x) ?? POR_OMISION` compila, se lee razonable y es exactamente el defecto. La única
ausencia que cae en el valor por omisión es la real, la primera carga sin parámetro (`:79`).

**Y la lista viaja entera hacia los dos lados.** La clave elegida vuelve en la respuesta
(`app/api/auditoria/route.ts:114`) para que el botón encendido describa lo que el servidor contestó;
los botones salen de `PERIODOS` (`pruebas/codigo/155-el-periodo-de-conversation.test.ts:181`); y la
lectura del navegador exige el período, sin valor por omisión propio (`lib/auditor/vista.ts:41`,
forzado por `pruebas/codigo/155-el-periodo-de-conversation.test.ts:163`).

**Y «completo» no puede leerse como historia.** Por eso las cifras traen `desde`, que es `min()` sobre
las filas alcanzadas y no `now() - dias` (`lib/negocio/indicadoresDelLead.ts:268`,
`lib/negocio/indicadoresDeCitas.ts:380-383`). Medido el 2026-09-28: en Lead Flow «Completo» arranca el
**2025-08-08** (el alta más vieja); en las citas, el **2026-08-24 13:00 UTC** contra el **2026-08-29 23:00**
de «30 días». La foto anterior decía que en las citas los dos botones coincidían al minuto; ya no. Y
`desde` solo también miente cuando describe a un caso suelto: para eso está `avisoDeLaCola`
(`lib/negocio/periodo.ts:111-147` y `:158`), que hoy usan los dos módulos de Conversation y Leads
Portal (el error D).

**La ventana se mide con `inicio_el`, no con `reservada_el`** (`lib/negocio/indicadoresDeCitas.ts:31-37`):
la cobertura de `reservada_el` es parcial y crece sola. Medido el 2026-09-28: **201 de 333** citas la
tienen; `inicio_el` es `not null` por esquema.

**La ventana la calcula la BASE, no la aplicación** (`lib/negocio/indicadoresDeCitas.ts:394-396`): «es
la única forma de que el “ahora” sea el mismo reloj que escribió las filas». **Con una excepción
declarada, que es nueva:** el gasto de anuncios vive en una columna `date`, así que
`lib/negocio/costoDelAnuncio.ts:36-44` cuenta días de calendario y no 24 horas, y lo dice en su
encabezado en vez de mezclar las dos formas (ver la regla 41).

**Una cifra que cruza el piso hacia abajo sola, y ya pasó.** El sentimiento del auditor: medido el
2026-09-28, `chat_post_agenda` tiene **23** conversaciones juzgadas a treinta días y **0** a siete (el
2026-09-15 eran 20 y 5). Cada ventana es un denominador nuevo, y el piso se evalúa en cada una.

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

**Dónde se resuelve entonces.** El dato se arregla **al leer**, no al migrar. El ejemplo canónico sigue
siendo la `040`: el canal efectivo se infiere en `lib/negocio/ficha.ts:186` (`CANAL_EFECTIVO`), sin tocar
una fila.

---

## 8 · La migración va antes del push, y las tres veces que se rompió

**La regla.** **La migración se aplica ANTES de empujar el código que la necesita. Si eso no se puede,
el código no se empuja.** Es una regla de **orden, no de memoria**.

**El contexto que la hace necesaria.** `docs/OTROS/produccion/DESPLIEGUE.md:395-396`: «Vercel despliega
por push, no por chequeo»; un commit rojo se publica igual, y la protección de rama en `main` con
`verificar` requerido, pendiente según ese documento y `docs/OTROS/capa-base/ETAPA-8.md:170`, **sigue
sin estar**: el 2026-09-28 `gh api` da `protected: false` ([17-LA-PLATAFORMA.md](17-LA-PLATAFORMA.md) § 5.2).

**Las tres veces que se rompió** (documentadas en `git log` antes del 2026-09-15; no re-medibles):

| Fecha | Qué se empujó sin migrar | Consecuencia |
| --- | --- | --- |
| 2026-08-28 | — | La regla se escribe por primera vez |
| 2026-08-31 | Código que consultaba `negocio.analisis_del_agente` y `auditor_activo` | Closer y Setter en 500 (`42P01`) y **el cron caído 69 minutos**, en silencio |
| 2026-09-11 | La `043` (`reservada_el`), empujada después del código | `42703`; una corrida del barrido perdida |

**La corrección que dejó la tercera.** No alcanza con preguntar qué LEE el arranque: hay que preguntar
**qué TOCA la columna nueva, en cualquier sentido** —un `insert` que la nombra rompe igual que un
`select`— y en qué horario corre la tarea (`HORARIOS`, `lib/negocio/barrido.ts:122`; el barrido de
citas va a la hora y tres, `lib/negocio/barrido.ts:206`).

**La comprobación de treinta segundos, antes de cada `git push`:**

```
node --env-file=.env.supabase scripts/supabase.mjs leer \
  "select name from migraciones.migraciones_aplicadas order by name desc limit 1"
ls db/migraciones | tail -1
```

**Cómo se aplica** (pagado el 2026-09-14): `node --env-file=.env.supabase scripts/db.mjs migrar`, no
`scripts/supabase.mjs correr` —la Management API conecta como `postgres`, que no es dueño de nuestras
tablas— y sólo con `.env.supabase`, porque `npm run db:migrar` puede apuntar a la base local.

**Estado el 2026-09-28.** Entre el 16 y el 23 de septiembre entraron trece migraciones, de la `050` a la
`062`. Medido: **producción está en la `062`, que es la última del repositorio**. El commit `a434f98`
declara la `062` aplicada antes del push; para la `050` a la `061` **no verifiqué el orden** uno por
uno, y ningún mensaje de commit de esos días registra un `42P01` ni un `42703` (búsqueda en `git log
--since=2026-09-15`).

---

## 9 · El descarte propio: por qué la cancelación se parte en dos poblaciones

**La regla.** Una cita que se cancela porque el lead se arrepintió y una que se cancela porque
**nosotros decidimos que no calificaba** son hechos opuestos. Sumadas dan un número que no describe a
ninguna de las dos.

El vocabulario vive en `lib/ghl/contrato.ts:231` (`ETIQUETAS_DE_DESCARTE`), con su censo en
`:193-230`, y el predicado que lo aplica en `descartado()` de `lib/negocio/citasAlcanzables.ts:68-85`.

**Medido el 2026-09-28, en las tres ventanas que importan:**

| Población | Citas 30 d | Canceladas | Tasa 30 d | Tasa 14 d | Tasa completo |
| --- | --- | --- | --- | --- | --- |
| De contactos descartados | 88 | 79 | **89,8 %** | 81,8 % (11) | 89,8 % |
| El resto | 103 | 33 | **32,0 %** | 22,2 % (18) | 39,2 % (143) |
| **Las dos juntas** | **191** | **112** | **58,6 %** | 44,8 % (29) | 58,4 % (231) |

**Casi la mitad de las citas del período (88 de 191, 46,1 %) son de contactos que la empresa MISMA
había rechazado**, y cancelan al 89,8 % porque su flujo de descarte las cancela. «Publicar 62,7 % como
*tasa de cancelación* le atribuía al negocio la mitad del trabajo de su propio filtro»
(`lib/negocio/indicadoresDeCitas.ts:186-188`, con la medición del 2026-09-14 en `:179-184`).

**Y la cifra que abre la pantalla cambió otra vez sin que nadie la tocara.** El comentario del módulo
publica **33,3 %** (`lib/negocio/indicadoresDeCitas.ts:183`, del 2026-09-14, a catorce días); la foto
anterior medía 40,9 % a treinta días (52 de 127); a las 22:06 UTC, **32,0 %** (33 de 103; 34,9 % a
las 18:00). Las 88 citas de descartados son de los últimos treinta días: «Completo» no suma ninguna.

**Apartar no es esconder** (`lib/negocio/indicadoresDeCitas.ts:190-191`): las descartadas van con su
conteo y su tasa, y las dos poblaciones suman exactamente el total (88 + 103 = 191).

**Dónde se trazó la línea, y por qué da igual.** Medido el 2026-09-14 (`lib/ghl/contrato.ts:218-222`):
con las dos etiquetas grandes o con las seis, la cifra del resto daba 33,3 %. Que la conclusión no
dependa del corte se midió antes de elegir; no re-medido hoy.

**Tres detalles que son reglas en sí mismos:**

1. **Todas las cifras de la tarjeta cortan igual**, o las demás hablarían de otra población.
2. **`exists` sobre `unnest` y no `&&` de arreglos** (`lib/negocio/citasAlcanzables.ts:71-73`): las
   etiquetas se guardan crudas y GoHighLevel no garantiza la caja.
3. **Todo en la misma pasada** (`lib/negocio/indicadoresDeCitas.ts:343-345`): dos consultas podrían ver
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

**Por qué existe: el caso de `negocio.mensajes`.** `lib/negocio/ingesta.ts` decía ser «EL único
escritor» y era falso: el chat insertaba directo, con un identificador fabricado que nunca colisiona
con el real, y cada mensaje propio quedaba dos veces. «Y no falla nada»
(`lib/negocio/mensajes.ts:4-24`). La prueba busca la FORMA, no el nombre: todo `insertInto('mensajes')`
es un escritor, «se llame como se llame» (`pruebas/codigo/111-un-solo-escritor.test.ts:55-56`).

**Por qué importa para las cifras** (`pruebas/codigo/147-un-solo-escritor-de-citas.test.ts:14-26`):
`inicio_anterior_el` sólo es correcta si la escribe el `do update` que lee la fila vieja en la misma
sentencia, y un escritor del webhook pondría como fecha de reserva la hora del aviso, «que se parece
tanto a la buena que nadie lo notaría».

**La excepción, y por qué no afloja la regla.** `citas.asistio` tiene un segundo escritor (`avanzar.ts`)
porque **el CRM no la tiene** —su campo de asistencia estaba poblado en 3 de 1052 citas, medido en
septiembre de 2026—. El barrido la deja fuera de su `do update`. «No hay dos escritores de una misma
columna: hay dos columnas con un escritor cada una.» La prueba se **afinó** en vez de aflojarse.

**Un corolario para toda prueba de código.** Las pruebas de escritor único leen el archivo **sin
comentarios**: «una prueba que leyera el texto crudo contaría explicaciones y se pondría roja por
documentar bien» (`pruebas/codigo/147-un-solo-escritor-de-citas.test.ts:28-32`).

---

## 11 · Una cadena que no es monótona no es un embudo

**La regla.** Una flecha entre dos escalones afirma que el segundo es **subconjunto** del primero. Si
no lo es, la flecha miente aunque los dos números sean correctos — y entonces la cadena se corta ahí y
lo que sigue es una **bifurcación**, con los dos sumandos sumando el total.

**El defecto concreto, re-medido el 2026-09-28** en la ventana con la que abre Lead Flow: entraron
**276**, se les escribió a **269**, respondieron **161**, agendaron **139**. De los 139, sólo **73**
habían contestado alguna vez. Una barra de 161 a 139 afirmaría que convirtieron el **86,3 %**; lo real
es 73 de 161, el **45,3 %**. Casi el doble, con los cuatro números correctos.

| Ventana | Lo que afirmaría el embudo | Lo que es verdad | 2026-09-15 |
| --- | --- | --- | --- |
| 7 días | **200 %** (2 de 1) | 100 % (1 de 1) | 97,2 % contra 38,9 % |
| 14 días | **175 %** (7 de 4) | 100 % (4 de 4) | 87,7 % contra 46,4 % |
| 30 días (la que abre) | 86,3 % (139 de 161) | 45,3 % (73 de 161) | 83,0 % contra 44,3 % |
| completo | 95,2 % (279 de 293) | 56,7 % (166 de 293) | 66,4 % contra 35,0 % |

**Las ventanas cortas lo muestran sin disfraz:** con 8 altas en dos semanas, a catorce días agendaron 7 y
respondieron 4. Un «embudo» dibujado ahí **se ensancharía**, que es la prueba más directa de que
«agendaron» no es un escalón de «respondieron». (Son cohortes de 3 y 8 contactos, debajo del piso: se
citan como ilustración, no como tasas.)

**Por qué es cara: no falla.** Los cuatro valores se pueden auditar uno por uno y están bien. Lo único
falso es la flecha, que no es un dato sino un dibujo.

**La forma honesta, y por qué es una regla y no una decisión de diseño.**

1. **La cadena se corta donde deja de ser monótona.** En Lead Flow, en «respondieron»
   (`components/conversation/PanelDeConversation.jsx:513-541`), y el pie lo dice
   (`components/conversation/PanelDeConversation.jsx:572-576`): «agendar no exige haber contestado».
2. **Lo que sigue es una bifurcación, no un cuarto eslabón**
   (`components/conversation/PanelDeConversation.jsx:543-570`).
3. **Los dos sumandos salen de la MISMA pasada que su total** (`lib/negocio/indicadoresDelLead.ts:257-262`),
   y el complemento se calcula en el módulo (`lib/negocio/indicadoresDelLead.ts:315`), no en la pantalla.
4. **Hay una prueba que exige la suma** (`pruebas/base/150-indicadores-del-lead.test.ts:558`) y otra
   que impide confundirla con la tasa de respuesta (`pruebas/base/150-indicadores-del-lead.test.ts:601`).

**Medido: la suma cierra, descuadre 0.** 73 + 66 = 139 a treinta días (de los 66, 6 nunca recibieron un
mensaje); 166 + 113 = 279 en «Completo» (17 sin mensaje).

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
Todas tienen un defecto pagado escrito al lado. Las citas se re-verificaron el 2026-09-28.

**12 · Un solo predicado por concepto.** Dos cifras de la misma pantalla no pueden tener cada una su
definición de «cancelada». El commit `a0e1eb5` encontró `consumoDelPrecall` con `not like 'cancel%'` e
`indicadoresDeCitas` con la lista cerrada `ESTADOS_CANCELADOS` (`lib/ghl/calendarios.ts:192`). **Desde
entonces pasó tres veces más, y las tres con factura:** la llave de la pieza de Creative estaba escrita
cinco veces y dos no eran la misma función (`f9998b6`); «días de la ventana» eran dos predicados y dos
granos dibujados en la misma frase, con un 12,7 % de diferencia (`7d1bc8b`); y una sonda de Sales con un
filtro apenas distinto publicó 26 puntos de brecha entre dos closers que con el predicado compartido
son 14, y 5 en la ventana por omisión (`371c0c5`, `lib/negocio/cierrePorCloser.ts:28`). La regla 30 es
la respuesta estructural. **Y el riesgo del vocabulario sigue vivo:** el 2026-09-15 había 3 citas
`noshow`; medido el 2026-09-28 son **15**, y no están en `ESTADOS_CANCELADOS` a propósito —se cuentan
aparte como plantones (§ 3)—.

**13 · El denominador se elige, y `exists` no es `join`.** Cuando el campo vive en el contacto y la
cifra habla de citas, el denominador son CONTACTOS (`lib/negocio/indicadoresDeCitas.ts:162-164`). Y
siempre `exists`, nunca `join` (`lib/negocio/indicadoresDeCitas.ts:243-244`,
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
`components/conversation/PanelDeConversation.jsx:128` («medido en septiembre de 2026, 3 citas de 1052») y
`:960` («las 316 citas que había al medirlo»). **Y su versión para el código, nueva:** un comentario con
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
y por `pruebas/codigo/10-arquitectura.test.ts:308`, `:356` y `:399`.

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
(`lib/negocio/camposDelCrm.ts:307`) existe para que agregar un indicador no cambie lo que el closer ve.

**28 · Un módulo que comparten el servidor y el navegador no puede importar nada que toque la base.**
`lib/negocio/periodo.ts:25-34`, forzado por `pruebas/codigo/155-el-periodo-de-conversation.test.ts:231`.
El defecto: `DIAS_DE_TODO` vivía en `indicadoresDeCitas.ts` y arrastró el cliente de PostgreSQL al
paquete del navegador; `next build` lo rechazó. **Desde el 2026-09-26 son dos módulos:**
`lib/negocio/tramosDelIcp.ts:27-32` («Por lo mismo que `periodo.ts`», `b04fb6c`), forzado por
`pruebas/codigo/175-tramos-del-icp.test.ts:111`, que cuenta también los reexportes; y los filtros de
Leads Portal sólo pueden importar dos módulos puros (`pruebas/codigo/177-filtros-del-portal.test.ts:108`).
El corolario: lo que el panel `'use client'` necesita explicar y no puede importar, **viaja en la
respuesta** —las ventanas de Sales con su texto (`c109ebd`), el título de Creative (`7d1bc8b`)—.

**29 · En CSS la especificidad manda sobre el orden.** `app/inteligencia-estetica.css:581-585`: el corte
de 640 px tiene que nombrar `:is(.pn-b, .pn-b.q3, .pn-b.q4)` porque el de 900 px pesa más, y sin eso a
400 px el panel queda en dos columnas de 170 px. «Visto en el navegador, no deducido.» La hoja hoy la
comparten las cinco pantallas de Inteligencia.

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
**Lo que no quedó en un solo lugar, medido con `grep` el 2026-09-28:** dos consultas de Conversation
siguen escribiendo el predicado a mano —la confirmación (`lib/negocio/indicadoresDeCitas.ts:250`) y el
precall (`lib/negocio/consumoDelPrecall.ts:192`, que además reescribe `cancelada` como
`<> all(ESTADOS_CANCELADOS)` en `:195`)—, y «agendó» tiene dos definiciones en el producto (§ 4).

**31 · La bandera `sinOperacionesTodavia` y la primera ruta de una pantalla se mueven en el mismo
commit.** La bandera es un cable trampa editado a mano (`lib/autorizacion/secciones.ts:79-90`): la
prueba `ADR-0304` que empieza en `pruebas/codigo/30-portero.test.ts:350` da rojo en las dos
direcciones —una sección con la bandera que sí tiene ruta (`pruebas/codigo/30-portero.test.ts:442-452`),
o una sin la bandera que no tiene ninguna ruta con su `PANTALLA` (`:454-457`)—; `ADR-0303` (`:325`)
vigila además que ninguna de las marcadas reciba una operación sin entrar al modelo de permisos; y el
conteo literal de `pruebas/codigo/90-fundaciones.test.ts:1263` obliga a decidir en vez de derivar.
Por eso la ruta, la bandera y el conteo van juntos: Sales los movió de 3 a 2 en `c109ebd` y Leads
Portal de 2 a 1 en `3c361a1` (`app/api/leads-portal/route.ts:3-8`), con una prueba de base por
pantalla que lo exige (`pruebas/base/166-la-ruta-de-sales.test.ts:82`,
`pruebas/base/177-la-ruta-del-leads-portal.test.ts:115`). Queda `executive`
(`lib/autorizacion/secciones.ts:216`).

**32 · El GET de una pantalla pide exactamente la capacidad que declara su sección.**
`pruebas/codigo/30-portero.test.ts:280` (`c109ebd`). El agujero lo encontró una mutación: `ADR-0304`
comparaba las capacidades de las rutas de una pantalla **entre sí** y nunca contra la sección, así que
cambiar la de Sales a `closer.ver` dejaba la suite entera en verde — y el resultado sería una entrada de
menú que aparece y devuelve 403. Medido sobre las 73 rutas, había una así: Conversation. Se resolvió en
`8dcb619` alineando la **sección** a la ruta (`auditor.ver`, `lib/autorizacion/secciones.ts:313-315`),
no al revés, porque igualarlas por la ruta habría ampliado el acceso a lo más sensible de las dos. Y no
era latente: la pestaña de permisos le ofrecía la casilla de Conversation a un rol con sólo
`tablero.ver`. La lista de excepciones queda declarada y vacía (`pruebas/apoyo/autorizados.ts:755`).

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
  serializada (`pruebas/base/166-la-ruta-de-sales.test.ts:106`, `c109ebd`): `return ok({ cockpit })`
  los traería con la forma correcta y sin que nada fallara.

Lista blanca y no negra porque con una negra lo nuevo aparece solo (`lib/negocio/atribucionVisible.ts:12-14`).

**34 · Toda prueba nueva se ve roja con su mutación antes de quedar.** Escrita como regla de etapa en
`docs/OTROS/analizadores/ANALIZADORES.md:102` y nombrada en más de la mitad de los commits del
período (`git log --since=2026-09-15 -i --grep=mutaci` devuelve 39 de los 67, medido el 2026-09-28).
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
(`:153-192`). Auditaba `docs/sales`; `docs/leads-portal` entró el día que nació, y **esta carpeta entra
el 2026-09-28** (`:37-42`), cuando el patrón pasó a admitir corchetes y el espacio de `estado actual/`
(`:52-64`); los dos cambios, en el árbol sin commit. **Lo que no atrapa, y lo dice:** la cita que sigue
en rango y ya apunta a otra cosa (`:17-19`). Es el error J. **Y lo que no mira:** las citas de
`docs/conversion/`, `docs/acquisition/` y el código (fuera de `AUDITADAS`, `:42`). Medido el 2026-09-28:
en `HEAD` las cinco citas de la regla 11 —`cadenaDeCierre.ts:36`, `PanelDeConversion.jsx:24`,
`14-LOS-CINCO-ESLABONES.md:54`, `01-LOS-DOS-RECORRIDOS.md:101`, `03-EL-RECORRIDO.md:62`— dicen 451,
cierta al escribirlas y corrida por `4fc9e43` a la regla 10; en el árbol ya dicen 625, el título de § 11.

**36 · La suite corre en tres zonas horarias.** `America/Lima`, `UTC` y `Asia/Tokyo`, «justamente porque
una cifra que cambia según dónde esté el servidor es indistinguible de una cifra correcta»
(`lib/negocio/periodo.ts:74-77`); una prueba de Mi Día recorre además las tres zonas dentro del mismo
archivo (`pruebas/base/92-mi-dia.test.ts:818`). No es nueva —ya se practicaba el 2026-09-10
(`d4d6ecf`)— pero no estaba en esta lista; 32 de los 67 commits del período la nombran
(`git log --since=2026-09-15 -i -E --grep='Asia/Tokyo|tres zonas|3 zonas'`, medido el 2026-09-28).
**Su límite, medido en `1164984`:** cuatro pruebas de agenda fallaban sólo en la hora siguiente a la
medianoche de Lima, porque la zona de la organización está fijada en el archivo y cambiar `TZ` no lo
evita; quedó anotado como trabajo aparte. **No verificado** si se arregló.

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
ocurrido». **No verificado** cuándo corrió por última vez.

**39 · Los huecos se declaran, viajan con su fecha y no se escriben en el JSX.** El defecto
(`0c93853`, 2026-09-19): la decisión era «sólo GHL, y el hueco se declara», y el back de Creative no
publicaba los huecos ni la pantalla los dibujaba — donde la maqueta tenía números inventados, «un hueco
que se omite no se distingue de una regresión». El patrón es `fueraDeAlcance`
(`lib/negocio/calidadDeLaAtribucion.ts:68-69`), y Sales y Leads Portal le agregaron la fecha:
`MEDIDO_EL` viaja con la lista (`lib/negocio/huecosDeSales.ts:39-46`, `app/api/sales/route.ts:125`;
`lib/negocio/huecosDelLeadsPortal.ts:37`) porque sin ella «no hay ventas registradas» se lee como un
hecho permanente del producto. **La deuda que trae:** `MEDIDO_EL` es un literal escrito a mano, y envejece
como cualquier cifra de comentario (lo registra [05-SALES.md](05-SALES.md)).

**40 · La cohorte y su resumen salen de UNA sentencia.** `lib/negocio/leadsDelPortal.ts:6-13` (`d97848e`):
la pantalla publica «ICP alto 51» y, debajo, las 51 tarjetas; con dos consultas, un barrido entre una y
otra deja la tarjeta diciendo 51 sobre una rejilla de 52, «y ninguna de las dos está mal». Una CTE arma
una fila por persona y de ella salen la lista y el resumen, que agrupa sin volver a clasificar. Y cuando
dos pantallas publican la misma cifra, la ruta las compara y lo dice en el aviso en vez de elegir una
(`coherenciaConSales`, `lib/negocio/leadsDelPortal.ts:610`, `app/api/leads-portal/route.ts:68-69`). Es la
regla de «todo en la misma pasada» (§ 9) llevada de una tarjeta a una pantalla entera.

**41 · «Los últimos 30 días» pueden ser tres poblaciones: cada una viaja con su nombre y su grano.** En
Sales conviven el mes calendario del dinero, los contactos dados de alta en N días y las citas que
ocurrieron en N días, y **las dos últimas dicen «30 días» y describen poblaciones distintas**
(`app/api/sales/route.ts:18-30`, `c109ebd`); por eso las ventanas viajan descritas en la respuesta
(`lib/negocio/ventanasDeSales.ts`). En Creative, «días de la ventana» sumaba días de gasto por anuncio
contra un denominador de días con impresiones —otro predicado y otro grano, 12,7 % de diferencia— y se
arregló poniendo el grano en el nombre, `anuncioDiasConLaClave / anuncioDiasConEntrega` (`7d1bc8b`),
«porque el comentario no alcanzó». Y el gasto de anuncios cuenta días de calendario y no 24 horas, y lo
declara (`lib/negocio/costoDelAnuncio.ts:36-44`).

---

## Los errores de método que este proyecto ya cometió

Los del A al H son de la foto anterior, actualizados. Del I al M aparecieron entre el 16 y el 28 de
septiembre.

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

**Verificado el 2026-09-28 contra la base:** la atribución trae `sessionSource` en **553 de 594**
contactos, `utmSource` en 511 y `adId` en 213 (544, 506 y 213 de 584 el 2026-09-15); `score` está en
**472 de 594**. La tabla de campos del video (`Video Pre-Call` en 213 de 584; los dos NUMERICAL en 0) es
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

**Estado el 2026-09-28, verificado:** `resultados.cita_id` sigue en **0 de 7** —no hay intentos nuevos
desde la `049`—, así que sigue sin haber nada que conectar.

**Pero el patrón volvió por otra puerta, y sigue abierto: un CAMPO CALCULADO sin lector.** El `aviso` de
Lead Flow (`lib/negocio/indicadoresDelLead.ts:183`, armado en `:323`) sigue sin nadie que lo dibuje (§ 1).
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
lectura de hoy ya trae un sesgo nuevo que ningún aviso declara:** con 8 altas desde el 2026-09-14,
casi toda cifra de cohorte a treinta días describe a gente que entró antes de la caída de altas del
14 de septiembre (268 de 276, medido el 2026-09-28), y la de catorce días, a casi nadie. No es un
defecto de cálculo; es la pregunta que hay que hacerse antes de leer una caída.

## E · Aflojar una prueba en vez de corregir la cohorte que medía

Al corregir la cohorte de Lead Flow, dos pruebas que afirmaban que el closer NO cuenta pasaron a
afirmar lo contrario. El commit `91e4e07` lo argumenta: «no es aflojar una prueba, es corregir la
cohorte que medía». La distinción tiene que quedar escrita, o el próximo cambio de prueba se justifica
solo.

## F · Pruebas que fallan sobre un archivo correcto

Dos casos en `1fce636`: una buscaba una guarda en una ventana de 300 caracteres y otra anclaba en una
frase que también aparece en un comentario. «Una prueba que falla cuando todo está bien es una prueba que
alguien apaga» (`pruebas/codigo/151-lo-que-se-mide-no-se-declara-faltante.test.ts:26-27`). Se
reescribieron para afirmar **la propiedad** y no **la distancia**. Es la otra cara del error I.

## G · Nombrar un agente a mano

La tarjeta de sentimiento escribía `'chat_pre_agenda'` en la ruta y
`pruebas/codigo/114-derivacion-del-nivel.test.ts` la rechazó. **Las listas salen de una constante, no
del teclado.**

## H · Creer que revisar el código alcanza para revisar una pantalla

El rediseño de Conversation dejó cuatro defectos y **tres aparecieron mirando**; el cuarto lo cazó
`next build`, que es el caso feliz de la regla 28.

| Qué estaba mal | Dónde quedó escrito | Cómo apareció |
| --- | --- | --- |
| El vocabulario de períodos metía el cliente de PostgreSQL en el paquete del navegador | `lib/negocio/periodo.ts:25-34` | Lo rechazó `next build` |
| La columna del nombre medía **397 px** a 1280 y el rótulo quedaba a 400 px de su número | `app/inteligencia-estetica.css:290-293` | Mirándola |
| A 400 px el panel seguía en dos columnas: la especificidad le ganaba al orden | `app/inteligencia-estetica.css:581-585` | Mirándola a 400 px |
| El precall decía el mismo número dos veces | `components/conversation/PanelDeConversation.jsx:765-767` | Mirándola |

**Y se repitió en el período, más grande.** A 375 px la barra lateral no colapsaba y al cuerpo le
quedaban **75 píxeles** en las doce pantallas, «y no lo veía ninguna prueba porque no hay nada que
falle» (`1020412`, 2026-09-20); al arreglarlo, tres pantallas seguían desbordando de costado
(`0810498`). Y abrir Conversion «en los dos temas y los tres anchos» encontró tres defectos que no eran
cifras —la frase, la alineación y el ancho—, uno de ellos un «A y B y C» que sólo aparece con tres
familias (`00e251d`). **Medir antes de arreglar vale también para lo que se ve.**

**Lo que sigue pendiente, dicho como corresponde:** esas verificaciones se hicieron sobre la base local
sembrada. **No verificado** si alguien abrió Conversation con sesión y datos reales desde el
2026-09-15; para Leads Portal la prueba de humo con sesión sigue pendiente
([10-LEADS-PORTAL.md](10-LEADS-PORTAL.md)).

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

La lección: una prueba se da por buena cuando se la vio roja por la razón correcta, no cuando está
verde.

## J · Una cita `archivo:línea` que sigue resolviendo y muestra otra cosa

Borrar la maqueta de Acquisition dejó **374 citas** apuntando a un archivo que ya no está, y **11
seguían resolviendo y mostraban otra cosa**: «una línea corrida no falla» (`c8494e6`, 2026-09-16). Se
repitió con las trece citas de `docs/sales/` que motivaron la regla 35 (`371c0c5`) y con cinco citas
corridas en Creative, entre ellas dos citas de la `053` que señalaban un ternario y un `leftJoin`
(`7d1bc8b`). La prueba de la regla 35 atrapa la mitad cruda; la otra mitad sólo la atrapa releer la
línea citada, que es lo que este corte hizo con cada una de las suyas.

## K · Medir con una sonda propia en vez de con el predicado compartido

La tabla por closer de Sales se justificaba con «69,1 % de cancelación contra 42,6 %, veintiséis
puntos». La sonda contaba citas de descartados y metía los `noshow` entre los cancelados; con el
predicado de `citasAlcanzables.ts` son 14 puntos, y en la ventana por omisión 5, con uno de los dos
closers a una cancelación de caer bajo el piso (`371c0c5`). La cifra estaba en seis documentos. **Una
cifra de un documento se mide con el mismo predicado que la pantalla, o describe otra pantalla.**

## L · Creer que un sello de éxito prueba que algo avanzó

El colector de anuncios estuvo atascado en producción: el sello decía `corrio`, las 39 llamadas eran
reales, y la fecha más nueva guardada no se movía, porque la ventana iba en orden cronológico y el
presupuesto cortaba por el final. **Y el primer arreglo introdujo el defecto contrario**: invertir el
orden hacía que lo que el presupuesto sacrificaba quedara perdido por construcción. Lo encontró una
revisión adversarial con dos escépticos por hallazgo, que ejecutaron la función real (`be7ef03`,
2026-09-18): «una marca de agua no puede describir un conjunto con agujeros». La ventana ahora sale de
lo que FALTA.

## M · Un comentario que afirma sin medir

Un comentario falso es un defecto de primera clase, porque es lo que alguien lee antes de tocar el
código. Casos del período, todos medidos después de escritos:

- `esquema.ts` decía que «nada calcula el score», y de ahí salió la decisión de protegerlo como dato
  nuestro (`e350a47`); el CRM lo calculaba (error A, fila 7).
- El comentario del click-to-landing afirmaba un piso que no existía (`7d1bc8b`).
- `lib/negocio/atribucionDelLead.ts:148-150` afirma usar «el mismo filtro de cita alcanzable que el
  booking rate», y desde el 2026-09-16 no es el mismo (§ 4). **Abierto el 2026-09-28.**
- `lib/negocio/periodo.ts:48` y `pruebas/codigo/155-el-periodo-de-conversation.test.ts:97` dicen que la
  fila más vieja del CRM es de 2026; medido el 2026-09-28, `min(alta_en_el_crm)` es **2025-08-08**.
  **Abierto** (sección final).

---

## Lo que NO pude verificar, y lo que encontré de paso

Dicho como pendiente, que es la regla.

**No verificado — lo histórico.** Los incidentes de despliegue (§ 8), los códigos `42P01`, `42703` y
`42501`, los 69 minutos de cron caído, las mediciones que sólo están en mensajes de commit (el 14 contra
26 de Sales, los 75 píxeles, el colector atascado) y las de la memoria del proyecto (los fallos
fantasma de la suite, el `.next` viejo). Son hechos documentados en su momento; las ventanas ya pasaron.

**No verificado — la suite.** Las reglas 34 a 37 hablan de la suite, y este informe no la corrió: la
base local es una sola y otros trabajos corrían en paralelo (regla 37). El número de pruebas que se cita
en los commits del período, 2273 × 3 zonas (`1c55149`), es del mensaje, no de una corrida mía.

**Verificado, y ausente — la protección de rama.** `docs/OTROS/produccion/DESPLIEGUE.md:396` la declara
pendiente, y el 2026-09-28 `gh api …/branches/main` da `protected: false`: **la regla de § 8 es lo único
que separa un commit rojo de producción** ([17-LA-PLATAFORMA.md](17-LA-PLATAFORMA.md) § 5.2).

**No verificado — los 15 avisos de las otras pantallas** (§ 1) y las 18 llamadas con el 14 por omisión
(§ 6): se contaron con `grep`, no se siguieron uno por uno hasta su lector o su llamador.

**No verificado — lo que no se re-midió:** las latencias de la regla 14, el censo de etiquetas de
descarte y la tabla de campos del video del error A. Van con su
fecha del 2026-09-15 o anterior.

**Encontrado de paso — la cadena visible sin fecha, que la foto anterior ya había señalado.**
`lib/negocio/indicadoresDeCitas.ts:494-496` arma un aviso que se dibuja en pantalla
(`components/conversation/PanelDeConversation.jsx:676`) y termina en presente: «el CRM tiene ese campo en
3 de 1052 citas». La cadena vecina del panel sí está fechada (regla 18). **Sigue igual el 2026-09-28.**

**Encontrado de paso — el comentario de las ventanas que afirma sin medir.** `lib/negocio/periodo.ts:48`
dice que la fila más vieja es de 2026, y `pruebas/codigo/155-el-periodo-de-conversation.test.ts:97` lo
repite. Medido el 2026-09-28: `min(alta_en_el_crm)` es **2025-08-08 13:11 UTC**. La conclusión («la
ventana no recorta nada») es cierta; el hecho con el que se justifica, no. **Sigue igual.**

**Encontrado de paso — dos agujeros de integridad que ninguna de estas reglas cubre:**

1. **25 contactos con `territorio` nulo**, medido el 2026-09-28 (los mismos 25 de la foto anterior en
   número). `congelarLosQueYaNoEstan` (`lib/negocio/sincronizar.ts:289`) pone el territorio en nulo y el
   barrido no vuelve a esas filas. **24 de los 25 no tienen `alta_en_el_crm`** (el 2026-09-15 eran los
   25), así que son invisibles para todas las cohortes de Lead Flow y de Leads Portal en las cuatro
   ventanas, sin ningún aviso; 5 tienen una cita alcanzable.
2. **Las citas no tienen resta.** No hay equivalente de `congelarLosQueYaNoEstan` en `lib/negocio/citas.ts`
   (búsqueda del 2026-09-28): una cita que el CRM deja de listar conserva su estado para siempre. Hoy las
   que quedan fuera lo hacen por casualidad —son las 101 sin calendario— y ese accidente no protege a
   ninguna cita nueva.

**Encontrado de paso — dos definiciones de «agendó» y dos copias del predicado** (§ 4 y regla 30): en
«Completo» Lead Flow dice 279 y su atribución suma 200; y la confirmación y el precall de Conversation
escriben `ghl_calendario_id is not null` a mano después de que `1164984` lo mudara a un solo archivo.
Coinciden hoy a treinta días; no hay prueba que las obligue a seguir coincidiendo.

Todos son del tipo que estas reglas existen para hacer visibles, y hoy no lo son.

---

## Cómo se midió este corte

Cinco consultas de sólo lectura con `scripts/supabase.mjs leer`, el 2026-09-28 entre las 22:06 y las
22:11 UTC, todas agregadas y sobre una sola organización con datos (`count(distinct org_id)` = 1 en
`negocio.citas` y en `negocio.contactos`). Los predicados copian los de `lib/negocio/citasAlcanzables.ts`
en SQL literal:

1. **Citas** (§ 3, 4, 6, 9): alcanzable = `ghl_calendario_id is not null`; descartado = `exists` sobre
   `unnest(etiquetas)` contra las seis `ETIQUETAS_DE_DESCARTE` en minúscula; cancelada = `estado_ghl`
   en minúscula dentro de `ESTADOS_CANCELADOS`; ventana = `inicio_el >= now() - make_interval(days => N)
   and inicio_el < now()`, para N = 1, 7, 14, 30 y 3650. Más el censo de `estado_ghl`, `asistio`,
   `reservada_el`, `negocio.resultados` y la última de `migraciones.migraciones_aplicadas`.
2. **Contactos** (§ 5, 11, error A): cohorte = `alta_en_el_crm >= now() - make_interval(days => N)`;
   escritos y respondieron = `exists` de un mensaje saliente / de uno saliente y uno entrante; agendó =
   `exists` de cualquier cita (Lead Flow) y, aparte, de una alcanzable; territorio y cobertura de claves
   de `atribucion_primera` y de `score`.
3. **Atribución por fuente** (§ 2): la cohorte de 30 y de 3650 días agrupada por
   `atribucion_primera ->> 'sessionSource'`, con «agendó» = cita alcanzable.
4. **Sentimiento** (§ 3, 6): `negocio.analisis_del_agente` por `auditable` y `disparo`, con
   `count(sentimiento)`, y las juzgadas de `chat_post_agenda` a 7 y 30 días.
5. **Ventanas de citas** (§ 6, 9): la consulta 1 repetida por ventana, con descartados y canceladas.

Una verificación adversarial volvió a correr las consultas 1 a 5 el mismo día, entre las 22:27 y las
22:40 UTC, con los predicados de `lib/negocio/citasAlcanzables.ts` y de `lib/negocio/indicadoresDelLead.ts`
(«respondieron» = saliente **y** entrante): todas las cifras dieron iguales. Agregó dos que faltaban:
la cobertura de `Confirmación Agendamiento` (contactos con la clave del catálogo en `campos_del_crm`,
184 de 594) y el `creado_el` más nuevo de `negocio.resultados` (2026-09-09).

**Las mismas pantallas, cuatro horas antes.** [04-CONVERSATION.md](04-CONVERSATION.md) (18:07 a 18:45
UTC) y [13-SETTER-Y-CLOSER.md](13-SETTER-Y-CLOSER.md) (desde las 18:03) publican, a treinta días, una
cohorte de Lead Flow de **277**, 270 escritos y un booking rate de **50,2 %** (139 de 277); una
cancelación del negocio de **34,9 %** (37 de 106) y un «Completo» de 142 citas con 56 canceladas
(39,4 %). Acá, a las 22:06: **276**, 269 y **50,4 %** (139 de 276); **32,0 %** (33 de 103); 143 citas
con las mismas 56 (39,2 %). Ninguna lectura está mal. A las 23:56 UTC las consultas 1 y 2 se
corrieron otra vez con el instante fijo en lugar de `now()` —2026-09-28 18:00 y 22:06:43— y
devolvieron exactamente las dos series. La diferencia es la ventana, que rueda: en esas cuatro horas
salió de la cohorte un contacto con alta del 2026-08-29 al que se le había escrito y que no tenía
cita (escritos 270 → 269, agendaron 139 en los dos); salieron de la ventana de citas cuatro canceladas
del resto que empezaban ese 29 de agosto, y entró una sin cancelar que empezó hoy entre las 18:00 y
las 22:06 (por eso «Completo» sube a 143 con las mismas 56 canceladas). La de catorce días dio igual
en los dos instantes: 8 contactos, 18 citas del resto, 4 canceladas (22,2 %). La foto anterior ya
había pagado esta cuenta en quince horas —la cancelación a catorce días pasó de 33,3 % a 32,4 % entre
dos pasadas del 2026-09-15—; por eso cada cifra de ventana va con la hora de su consulta, y
[09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md) lo dice para toda la carpeta.
