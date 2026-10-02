# Conversation Intelligence
> Corte: **2026-09-28**, medido contra producción entre las 18:07 y las 18:45 UTC, salvo el gasto de
> Meta (23:56 UTC) y los sellos del barrido (23:58 UTC); las cifras principales se volvieron a
> medir el 2026-09-29 a las 00:16–00:30 UTC con `now()` clavado en 18:07 UTC y dieron lo mismo.
> Todas las ventanas son móviles (`now() - make_interval`), así que una cifra se reproduce pasando
> el mismo instante, no repitiendo la consulta, y se mueve sola aunque no entre nada:
> [07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md), a las 22:06 UTC, cuenta 276 contactos, 269
> escritos y 33 de 103 citas canceladas donde acá dicen 277, 270 y 37 de 106 (a las 23:58 la cohorte
> seguía en 276), y las dos lecturas son ciertas a su hora, como explica el encabezado de
> [09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md). Cada afirmación lleva su archivo:línea o la consulta que
> la produjo; lo que no se pudo verificar está dicho como pendiente, no omitido. Para ubicar lo
> nombrado acá, ver [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md).

**Construido y funcionando. Tablero desde el 2026-09-15 (`13ce499`); el código casi no cambió desde
entonces. Lo que cambió es el negocio que mide: casi dejó de moverse.**

Sigue dibujando las mismas **25 cifras** que la foto anterior —23 con número y 2 dibujadas como el
hueco que son—, todas leídas de `negocio.*` y del auditor, sobre una ventana que se elige entre
cuatro y que por omisión son 30 días (`lib/negocio/periodo.ts:109`). Pero **ningún anuncio de Meta
gastó después del 13 de septiembre** (del 14 al 17 hay filas en 0,00; desde el 18, todas nulas: § 2),
entraron al CRM **8 contactos en quince días** (4, 3 y 1 por semana, contra 175 y 89 las dos semanas
anteriores) y en los últimos 7 días hubo **27 mensajes** en total, 21 de ellos salientes (a las
18:07 UTC, sobre los 6 108 de la base). Tres consecuencias, medidas el 2026-09-28: la ventana por
omisión describe ya casi sólo la primera quincena de septiembre (la mitad de su cohorte ya había
entrado el 4); «Hoy» y «7 días» publican tasas sobre 1, 3 o 5 casos,
porque el booking rate, la respuesta, la cancelación y el reagendamiento **no tienen piso**; y el
sentimiento de Appointment Flow **se va a apagar solo el 2026-10-08**, cuando su denominador baje de
10 sin que pase nada. Con el negocio quieto, además, **la pantalla no dice si su dato está al día**:
un barrido caído se vería igual que un embudo sin entrada (riesgo 22). Y tres defectos nuevos,
ninguno a la vista en la ventana por omisión: la atribución y el booking rate dejaron de contar lo
mismo (sólo se nota en «Completo»: las filas suman 200 agendados y el titular dice 279), un
hallazgo de LeadFlow se dibuja dentro de la tarjeta de AppFlow porque los patrones se agrupan sin
mirar el agente, y dos
comentarios siguen diciendo que la sección pide `tablero.ver` cuando desde el 2026-09-21 pide
`auditor.ver`. Lo que Executive publica en nombre de este departamento sigue siendo inventado.

> **Desde el corte del 2026-09-15**
>
> - **`13ce499`** (2026-09-15, 16:56 UTC) — el tablero: selector de cuatro períodos, cadena cortada
>   en «respondieron» y bifurcación. Entró 28 minutos antes de la medición de la foto anterior, cuya
>   versión en disco ya lo describía (se reescribió en `bddb516` y `c8494e6`, el 2026-09-16).
> - **`bddb516`** (2026-09-16) — dos correcciones de Lead Flow. El booking rate cuenta **cualquier**
>   cita (`lib/negocio/indicadoresDelLead.ts:237-239`) y declara aparte las congeladas
>   (`lib/negocio/indicadoresDelLead.ts:308-313`); y `desde` viaja con `mitad` y con un aviso que se
>   enciende cuando la fecha describe a un caso suelto (`lib/negocio/periodo.ts:147`), dibujado a la
>   vista en las dos tarjetas (`components/conversation/PanelDeConversation.jsx:496` y
>   `components/conversation/PanelDeConversation.jsx:609`).
> - **`7f6235c`** (2026-09-16) — no habrá corte por anuncio acá: vive en
>   `lib/negocio/costoDelAnuncio.ts`, y el porqué quedó escrito en
>   `lib/negocio/atribucionDelLead.ts:76-93`.
> - **`d8b542e`** (2026-09-17) — un rol de plataforma que guarda un prompt o resuelve una
>   intervención en otra empresa queda como autor nulo (`app/api/auditoria/prompts/route.ts:94`,
>   `lib/auditor/intervencion.ts:186-193`).
> - **`1164984`** (2026-09-21, de la etapa 3 de Sales) — los predicados de cita se mudaron a
>   `lib/negocio/citasAlcanzables.ts` —`alcanzable`, `cancelada`, `descartado` y
>   `tieneCitaAlcanzable`, de `lib/negocio/citasAlcanzables.ts:54` a
>   `lib/negocio/citasAlcanzables.ts:135`—, y `tasaDeCancelacion` los instancia
>   (`lib/negocio/indicadoresDeCitas.ts:329-331`). Sales consume esa misma función
>   (`app/api/sales/route.ts:109`): la cancelación de las dos pantallas es un solo número.
> - **`8dcb619`** (2026-09-21) — la sección `conversation` pide `auditor.ver`
>   (`lib/autorizacion/secciones.ts:315`), la misma capacidad que su ruta
>   (`app/api/auditoria/route.ts:71`). Antes la pestaña de permisos ofrecía la casilla a un rol que
>   después recibía 403.
> - **`db120a1`** (2026-09-26, Leads Portal) — `ramaDelPrecall` se exporta
>   (`lib/negocio/consumoDelPrecall.ts:302-304`) y la ficha del portal la usa
>   (`lib/negocio/fichaDelLeadDelPortal.ts:30`): el vocabulario del precall dejó de ser sólo de acá.
> - **No son de acá** `a6d8f48`, `60844ac` y `1e41fa7` (2026-09-22, «histórico de conversaciones»):
>   tocan `lib/fundaciones/`, `components/fundaciones/`, `app/api/fundaciones/`,
>   `app/api/tools/conversar/route.ts`, `lib/datos/esquema.ts` y cuatro pruebas. Son la charla de
>   una empresa con el agente de ICP & Oferta, no las conversaciones con leads que este departamento
>   supervisa. Comprobado con `git show --stat` de los tres.
> - **Ningún commit tocó `components/conversation/` después de `bddb516`**
>   (`git log --since=2026-09-15`). Todas las cifras que cambiaron, cambiaron por los datos.

---

## 1 · Qué pide el documento

El documento funcional **no vive en el repositorio**. El código lo llama
`AIOS_Arquitectura_Funcional_v0.2.md` (`components/conversation/PanelDeConversation.jsx:8`) y la
carpeta de Leads Portal lo barrió como `CC_Arquitectura_Funcional.md`, en una carpeta local
(`docs/leads-portal/11-LO-QUE-PIDE-EL-DOCUMENTO.md:3-6`). Los encabezados de abajo se cotejaron el
2026-09-28 contra ese archivo (§8 empieza en su línea 419, §17 en la 1106). **Conversation no tiene
carpeta de requisitos propia en `docs/`** —hay de Acquisition, Creative, Conversion, Sales y Leads
Portal—, así que este resumen es la única traducción del documento que hay en el repositorio.

**§8 — Misión.** Supervisar, analizar y mejorar las conversaciones automatizadas. Dos módulos, cada
uno con agente de texto, agente de voz y Supervisor: **Lead Flow** (conseguir la cita) y
**Appointment Flow** (que asista).

**§9 — Lead Flow.** Convertir contactos sin cita en citas, guiándolos a la landing sin agendar
dentro de la conversación (§9.1). KPI principal **Booking Rate** con el denominador declarado
(§9.3). §9.5 pide un **trigger link** que separe enlace enviado / abierto / landing visitada /
formulario iniciado / completado / cita. §9.6 lista lo consumible: datos básicos con **zona
horaria**, **atribución** (campaña, ad set, anuncio, UTM de primer y último toque), calificación
previa e historial con **sentimiento**. §9.7 pide veinte KPIs, entre ellos los tiempos hasta el
primer intento y la primera respuesta, agendamientos **por fuente y anuncio**, sentimiento, errores
e intervención humana.

**§10 — Appointment Flow.** Convertir citas en asistencias; KPI principal **Show Rate** (§10.3).
§10.5 pide **ICP score y segmento ICP**, closer, tiempo entre agendamiento y cita, confirmación,
cancelaciones, reagendamientos y el consumo del VSL y del precall «cuando exista tracking individual
verificable». §10.6: tres ramas del precall (no vio / parcial / completo). §10.7: dieciséis KPIs,
seis de ellos cortes del show rate (por ICP, anuncio, closer, anticipación, VSL, precall).

**§11 — Supervisor.** No conversa: evalúa. §11.2 le exige el **prompt activo y su versión**; §11.3,
dos evaluaciones separadas (ejecución del agente / calidad del prompt); §11.4, el vocabulario
`issue_source` de seis valores; §11.6, cuatro categorías de error. **§11.7** exige un resultado
estructurado de **diecisiete** campos —la foto anterior decía dieciséis y listaba diecisiete— y
prohíbe guardar «únicamente un párrafo libre». §11.8: el supervisor propone y un humano publica la
versión nueva del prompt.

**§12** recomendaciones locales · **§13** cinco responsables con sus reportes y tareas · **§14**
medición de impacto con seis estados en fila, de Propuesta a En medición, y un cierre con tres
salidas, Validada/Iterar/Revertir (la foto anterior decía «ocho estados») · **§15** lo que se
entrega a Executive, **datos faltantes** incluidos · **§16.2** la prioridad técnica inmediata: ocho
pruebas de trazabilidad Anuncio → Landing → Sesión → VSL → Formulario → Contacto → ICP → Cita →
Asistencia → Venta · **§17** los otros departamentos todavía sin especificación detallada.

---

## 2 · Qué hay hoy en pantalla

La sección es `conversation`, grupo «Inteligencia», con `auditor.ver` desde el 2026-09-21
(`lib/autorizacion/secciones.ts:294-317`). La vista es `components/views/ConversationView.jsx:43` y
todo el cuerpo es `components/conversation/PanelDeConversation.jsx` (989 líneas; 975 en la foto
anterior). **Cuatro pestañas planas** (`components/conversation/PanelDeConversation.jsx:84-89`):
Lead Flow · Appointment Flow · Auditoría · Prompts. Una sola lectura alimenta las cuatro, en una
transacción: `GET /api/auditoria` (`app/api/auditoria/route.ts:88-106`). El reloj recarga cada 60 s
sólo con la pantalla a la vista (`components/conversation/PanelDeConversation.jsx:208`,
`lib/cadencia.ts:91`).

**Cómo se midió lo de esta sección.** Con SQL de sólo lectura que copia los predicados de cada
módulo (`scripts/supabase.mjs leer`); ni se ejecutó el módulo ni se abrió la pantalla, porque este
trabajo no puede levantar un servidor. Las cifras son las que la consulta del módulo devolvería;
**cómo se ven dibujadas no está verificado en un navegador**.

── **LOS TRES CONTROLES QUE GOBIERNAN TODO LO DE ABAJO** ──

**1 · El período** (`components/conversation/PanelDeConversation.jsx:294-313`). Hoy · 7 días · 30
días · Completo, dibujados desde `PERIODOS` (`lib/negocio/periodo.ts:83-96`), 30 por omisión
(`lib/negocio/periodo.ts:109`). La clave viaja en `?periodo=` y lo que no está en la lista se
rechaza con 400 (`app/api/auditoria/route.ts:79-80`). Sólo aparece en las dos pestañas de flujo
(`components/conversation/PanelDeConversation.jsx:252`), y cambiarlo es una carga primera, no una
recarga (`components/conversation/PanelDeConversation.jsx:168-174`).

**2 · `Nota`** (`components/conversation/PanelDeConversation.jsx:337-358`): el porqué de cada cifra
va detrás de una «i» que se abre al pasar el ratón o al tocarla; con `grave`, el texto queda a la
vista. Lo grave se reserva para lo que no es un matiz sino un hueco.

**3 · Lo que falta, plegado** en un `<details>` nativo con el contador en el resumen
(`components/conversation/PanelDeConversation.jsx:974-986`).

**Alcance, medido el 2026-09-28:** **13 organizaciones, 11 activas** (el 15 eran 15 y 12); de las
activas, **5 tienen llave de IA** (eran 4), **1 tiene el identificador del agente** y **1 tiene
token de CRM**. Una sola organización —la de clave `aria`— tiene datos de negocio: **594 contactos,
333 citas, 6 108 mensajes** (el 15: 584, 317 y 5 864). En las otras diez activas la pantalla dibuja
el freno `POR_QUE_NO_AUDITA` (`lib/auditor/vista.ts:206-216`) y cifras vacías.

**Y el volumen que cambió la lectura de todo lo de abajo.** Altas en el CRM por semana (lunes):
08-10 **117** · 08-17 **90** · 08-24 **53** · 08-31 **175** · 09-07 **89** · 09-14 **4** · 09-21
**3** · 09-28 **1** (a las 18:07 UTC del lunes). Citas por semana de inicio: 76 · 92 · **27** ·
**6** · **3** desde la del 31 de agosto. En `negocio.metricas_de_anuncio` **no hay un solo día con
gasto ni con impresiones después del 13**: 13 filas en 0,00, todas del 14 al 17, y 1 172 **nulas**
—303 del 14 al 17 y las 869 que hay desde el 18—, y nulo es «el anuncio no entregó ese día», no un
cero (`lib/negocio/recolectarAnuncios.ts:416-418`). Medido el 2026-09-28 a las 23:56 UTC, con el
colector sincronizando hasta las 06:20 UTC de ese día. El barrido está vivo —el último contacto lo
creó hoy a las 13:50 UTC—, así que el hueco es de leads y no de ingesta. **Por qué se pausó la pauta
no está verificado**: no hay en la base nada que lo diga.

── **PESTAÑA LEAD FLOW** ──

Módulos: `lib/negocio/indicadoresDelLead.ts` (448 líneas), `lib/negocio/atribucionDelLead.ts` (279)
y `lib/auditor/sentimiento.ts` (200). Cohorte única: `alta_en_el_crm` dentro de la ventana
(`lib/negocio/indicadoresDelLead.ts:197`). Todas las cifras, a 30 días y medidas el 2026-09-28;
entre paréntesis, la de la foto anterior (2026-09-15 17:24 UTC; el booking rate, 2026-09-16 14:51
UTC).

1. **Agendaron (§9.3)**, el titular (`components/conversation/PanelDeConversation.jsx:500-509`):
   **50,2 % · 139 de 277** (50,4 % · 197 de 391). Sin piso: sólo es `null` con cohorte 0
   (`lib/negocio/indicadoresDelLead.ts:306`). `agendaronSoloCongeladas` es **0** a 30 días —las
   citas congeladas son de agosto y sus contactos ya salieron de la ventana— y 79 en «Completo».
2. **La cadena** (`components/conversation/PanelDeConversation.jsx:512-541`), cada barra sobre la
   cohorte: Entraron al CRM **277** · Les escribimos **270 (97,5 %)**, con la nota «7 no recibieron
   ningún mensaje» · Respondieron **161 (58,1 %)**. Ahí termina, a propósito.
3. **La bifurcación** (`components/conversation/PanelDeConversation.jsx:548-570`): **73** después de
   contestar —«45,3 % de los que contestaron»— y **66** sin contestar nunca; 73 + 66 = 139,
   descuadre 0 (el 15: 94 + 82 = 176, 44,3 %, antes de que `bddb516` cambiara el numerador).
4. **Cuánto se tarda** (`components/conversation/PanelDeConversation.jsx:897-931`): Respondieron
   **59,6 % · 161 de 270 escritos** (55,5 %); Tardamos en escribir **2,3 min**, «9 de 10 antes de
   10,1 min», sobre 270 (2,8 min y **8,1 h**: la cola lenta de agosto salió de la ventana); Tardan
   en contestar **5,4 min**, «9 de 10 antes de 6 h», sobre 160 (4,2 min y 11 h); Esperan respuesta
   **109** (170).
5. **De dónde vinieron · por fuente** (`components/conversation/PanelDeConversation.jsx:702`), por
   cohorte descendente: **Paid Social 47,8 % · 121 de 253 · Direct traffic 92,3 % · 12 de 13 ·
   Social media 50 % · 5 de 10** y «Otras» con 1 contacto sin fuente. Las tres pasan el piso de 10,
   y el orden de las tasas se dio vuelta respecto del 15 —ver riesgo 10—.
6. **Por campaña** (`components/conversation/PanelDeConversation.jsx:703`): «TOFU · 01-09-26» **43,3
   % · 74 de 171**, «Bofu · Agendas · 28-08-26» **83,7 % · 36 de 43**, «TOFU · 31-08-26» **9,5 % · 2
   de 21** —las tres, idénticas a las del 15, porque ninguna recibió contactos nuevos— y «Otras» con
   **42 contactos y 27 agendados** (177 contactos el 15); 27 de esos 42 no traen campaña. Los
   nombres completos vienen de la base; se abrevian acá.
7. **Fuera de horario** (`components/conversation/PanelDeConversation.jsx:710-716`): **61 de 152**
   primeros mensajes antes de las 8 o después de las 21 en la zona del contacto (75 de 212); 118 de
   los 270 escritos no traen zona y no entran.
8. **Sentimiento de Lead Flow** (`components/conversation/PanelDeConversation.jsx:816-819`): sólo el
   aviso grave, porque `juzgadas = 0` en las cuatro ventanas. `chat_pre_agenda` tiene ahora **6
   análisis** (5 el 15): 5 no auditables y 1 auditable del carril de mejora, que no produce
   sentimiento (`lib/auditor/sentimiento.ts:89-93`).

**«Hoy» y «7 días» ya no son ventanas con datos, y se dibujan igual.** A las 18:07 UTC: «Hoy» tiene
**1 contacto**, y el titular publica **0 % · 0 de 1**; «7 días» tiene 3 y publica **66,7 % · 2 de
3**, con la respuesta en **33,3 % · 1 de 3** y «Tardan en contestar» en 40,8 h sobre **un**
contacto. Ninguna de esas cifras tiene piso. Y cuando «Hoy» queda en cero —pasó, por ejemplo, del 26
a las 14:53 al 28 a las 13:37 UTC—, el único texto que lo explica es `respuesta.aviso`
(`lib/negocio/indicadoresDelLead.ts:407-410`), que **sigue sin dibujarse**: en
`components/conversation/PanelDeConversation.jsx` los únicos avisos de `respuesta` que se leen son
`avisoDeLaVentana`, `avisoDelBooking` y `avisoDeLatencias`, comprobado con `grep`. La tarjeta queda
con «Entraron al CRM 0 · 100 %», porque ese pie es un literal
(`components/conversation/PanelDeConversation.jsx:518`); lo mismo «Citas del período»
(`components/conversation/PanelDeConversation.jsx:625`).

── **PESTAÑA APPOINTMENT FLOW** ──

Módulos: `lib/negocio/indicadoresDeCitas.ts` (531 líneas) y `lib/negocio/consumoDelPrecall.ts`
(304), con los predicados de `lib/negocio/citasAlcanzables.ts` (165). Ventana: citas con `inicio_el`
en el período **y ya ocurridas**, sin congeladas ni descartados.

9. **El titular es un hueco** (`components/conversation/PanelDeConversation.jsx:611-616`): «—»,
   «asistencia · 0 de 106 cerradas». `negocio.citas.asistio` está en **0 de 333** y `showed` en **0
   de 333**, comprobado por las dos vías.
10. **La cadena** (`components/conversation/PanelDeConversation.jsx:619-648`): Citas del período
    **106** (127), con la nota de los descartados —**88 citas, que cancelan el 89,8 %** (78 y 91
    %)—; Siguieron en pie **69 (65,1 %)**; Se presentaron «—», barra vacía, «nadie lo registró».
11. **Las salidas** (`components/conversation/PanelDeConversation.jsx:650-672`): Canceladas **37 ·
    34,9 %** (52 · 40,9 %); Reagendadas **14 · 13,2 %** (11 · 8,7 %). Con los descartados mezclados
    la tasa sería **59,8 % sobre 194**: casi la mitad de las citas de la ventana son de contactos
    que la empresa ya había rechazado.
12. **Confirmaron** (`components/conversation/PanelDeConversation.jsx:938-947`): **77,6 % · 59 de 76
    contactos** (71,4 % · 65 de 91), sobre 173 contactos con cita. Sigue sin excluir descartados
    (`lib/negocio/indicadoresDeCitas.ts:246-253`): 82 de esos 173 lo son, y 8 de los 76 que
    contestaron.
13. **Se reserva con** (`components/conversation/PanelDeConversation.jsx:948-953`): **2,4 días**
    (mediana 57,2 h), «sobre 105 de 106». La cobertura que el 15 se degradaba (96 de 127) volvió a
    ser casi completa porque las citas sin fecha de reserva salieron de la ventana.
14. **No-show** (`components/conversation/PanelDeConversation.jsx:954-961`): **2 reportados**,
    conteo y no tasa. `negocio.resultados` tiene **7 filas en total y la última es del 2026-09-09**:
    nadie cerró un intento en diecinueve días.
15. **Precall · Registró reproducción** (`components/conversation/PanelDeConversation.jsx:773-778`):
    **19,6 % · 10 de 51 clasificados** (19,7 % · 12 de 61). De 65 contactos que llegaron a la
    llamada, 5 sin campo, 41 sin reproducción, 7 parcial, 3 completo y **9 sin rama** (`-20%` 4,
    `Accede: sin reproducir` 3, `Clic a link` 2): los sin rama son **tres veces** los que
    completaron. El desglose fino sigue oculto por el piso (`lib/negocio/consumoDelPrecall.ts:239`)
    y el aviso grave está encendido con sus tres partes.
16. **Sentimiento de Appointment Flow** (`components/conversation/PanelDeConversation.jsx:822-834`):
    **Quedaron molestos 26,1 % · 6 de 23**, neutrales 14, positivas 3 (25 % · 5 de 20). A 7 días son
    3 juzgadas y la proporción no se publica.
17. **Los avisos graves de las citas** (`components/conversation/PanelDeConversation.jsx:676-677`),
    los dos encendidos: la asistencia («en ninguna de las 106 citas de los últimos 30 días») y las
    congeladas, que bajaron de **77 a 14** en la ventana.

**«30 días» y «Completo» ya no son idénticas.** El 15 devolvían las mismas 127 citas; hoy «Completo»
son **142 citas, 56 canceladas (39,4 %)** contra 106 y 34,9 %, porque la ventana de 30 días ya
empieza el 29 de agosto y la cita alcanzable más vieja sigue siendo del 24. «7 días» publica **40 %
· 2 de 5** y «Hoy» **0 % · 0 de 1**: `tasaDeCancelacion` sólo devuelve `null` con cero citas
(`lib/negocio/indicadoresDeCitas.ts:429`), y el reagendamiento igual
(`lib/negocio/indicadoresDeCitas.ts:442`). Como Sales consume la misma función, su cifra de cabecera
hereda los mismos números.

── **PESTAÑA AUDITORÍA (el Supervisor del §11)** ──

`lib/auditor/pantalla.ts` (394 líneas) y `components/auditoria/PanelDeAuditoria.jsx` (520). Las
tarjetas cuentan **toda la historia** (`lib/auditor/pantalla.ts:195-241`) y por eso no hay
segmentado en esta pestaña.

18. **AppFlow**: **64 análisis, 50 auditables · 30 verdes / 17 amarillos / 3 rojos**, 14 sin poder
    juzgar y **3 intervenciones abiertas** (42 análisis, 35 auditables, 17/16/2 el 15). Veintidós
    análisis en trece días; el último, hoy a las 06:18 UTC.
19. **LeadFlow**: **6 análisis, 1 auditable (amarillo)**, 5 sin poder juzgar (5, 0 y 5 el 15).
20. **Patrones abiertos: 6, con 24 casos, ninguno resuelto** (5 con 20 el 15), ordenados por
    cantidad y, a igual cantidad, por el caso más reciente (`lib/auditor/vista.ts:100-132`):
    `ignora_pedido_reagendar` ×10 (rojo), `recordatorio_fecha_inconsistente` ×5 (rojo),
    `no_lee_confirmacion_previa` ×4 (amarillo), `presiona_asistencia_con_duda` ×3 (rojo),
    `dato_faltante` ×1 y `no_leyo_a_medias` ×1 (amarillos). Entraron cuatro hallazgos desde el
    corte, el último el 2026-09-21. **Uno es de
    LeadFlow y se dibuja en la tarjeta de AppFlow**: ver riesgo 21.
21. **La lista de conversaciones** tiene tope de 50 (`lib/auditor/pantalla.ts:50`) y **hoy corta**:
    hay 70 análisis. AppFlow muestra 44 de 64 y lo dice. LeadFlow muestra sus 6 de 6 y **también
    dice que el tope cortó la lista**, porque `hayMas` es uno solo para las dos tarjetas
    (`lib/auditor/pantalla.ts:380`, `components/auditoria/PanelDeAuditoria.jsx:152`).

── **PESTAÑA PROMPTS** ──

22. Contador «2» (`components/conversation/PanelDeConversation.jsx:241-243`):
    `negocio.prompts_del_agente` y `negocio.versiones_del_prompt` siguen en **0 filas**. El panel
    aclara que ese prompt sería «de referencia» y no el que corre en el CRM
    (`components/auditoria/PanelDeAuditoria.jsx:448`).

── **LOS AVISOS, CONTADOS HOY** ──

De los nueve huecos de aviso que midió el rediseño, a 30 días siguen encendidos **siete**, los
mismos del 15: `respuesta.aviso` (que no se dibuja), `avisoDeLatencias` (detrás de un ícono), el de
la atribución, el de las congeladas, el de la asistencia, el del precall y el del sentimiento de
LeadFlow. Callan el de la confirmación y el del sentimiento de AppFlow. Los tres que agregó
`bddb516` —`avisoDelBooking` y los dos `avisoDeLaVentana`— callan a 30 días; en «Completo» se
encienden los dos de Lead Flow, y el de la cola dice que la mitad de los contactos entró después del
28 de agosto de 2026. El de las citas calla en los cuatro períodos (proporción 0,70 a 30 días y 0,68
en «Completo», contra un umbral de 0,25).

Los porcentajes en pantalla llevan **punto** y no coma: `porciento`
(`components/conversation/PanelDeConversation.jsx:404-407`) interpola sin `Intl` aunque su docblock
prometa coma. Cosmético, sin cambios desde el 15.

---

## 3 · Lo que era maqueta, y qué la reemplazó

── **LO QUE SE BORRÓ** ──

`lib/aios/conversation.js` **ya no existe** —se borró el 2026-09-10, en `f0f09b7`; hoy `lib/aios/`
tiene 8 archivos (13 el 15) y ninguno es ése—. Eran 559 líneas, ~180 de literales inventados: un
embudo completo, cuatro agentes con nombre de persona, quince líneas de diálogo de clientes que no
existen, seis «incidencias» que imitaban a un supervisor de IA y catorce líneas de prompt sugerido.
Entre esos literales había un nombre de agente inventado, un nombre de pila en un saludo y las
iniciales de un cliente en tres sitios; todo está documentado en
`components/views/ConversationView.jsx:12-33`. **Ningún nombre de persona ni de marca real quedó en
el código de esta pantalla**: verificado con `grep` el 2026-09-28 sobre `components/conversation/`,
`components/auditoria/` y `components/views/ConversationView.jsx`, y los dos únicos aciertos
(`components/views/ConversationView.jsx:26` y `components/views/ConversationView.jsx:28`) están
dentro del comentario que explica que se fueron. Las marcas que sí se ven en pantalla —los nombres
de campaña de la tabla de atribución— **vienen de la base**, no del código.

── **LO QUE EXECUTIVE TODAVÍA INVENTA EN NOMBRE DE ESTE DEPARTAMENTO** ──

Ninguno de los cuatro cambió desde el 15 (`git log --since=2026-09-15` sobre los tres archivos sólo
muestra `0add4cc`, que cambió cómo se cierra el cajón en `lib/aios/executive-panel.js` y no tocó
ningún dato). Los tres módulos siguen arrancando desde `lib/aios/index.js:29-37@c4cf2a8`. Es la única
pantalla que habla por Conversation: `grep` de «Lead Flow», «agente de voz» y «show rate» en
`components/`, `app/` y `lib/aios/`, fuera de `components/conversation/` y `components/auditoria/`,
el 2026-09-28, sólo acierta en `lib/aios/executive.js` y en dos comentarios de la ruta de esta misma
pantalla (`app/api/auditoria/route.ts:125` y `app/api/auditoria/route.ts:130`). En `lib/negocio/`
hay más aciertos, todos comentarios o un texto de Sales (`lib/negocio/huecosDeSales.ts:82`) que no
habla por este departamento.

**3.1 · La tarjeta de Conversation** (`lib/aios/executive.js:190-193@c4cf2a8`): «58 % de efectividad en Lead
Flow · +3 pts» y «El agente de voz no reconfirma día y hora en 14 de 22 llamadas». El 58 % se podría
reemplazar hoy por el booking rate (50,2 %, 139 de 277) o por la respuesta (59,6 %, 161 de 270); el
«+3 pts» no, porque no hay línea base; y el hallazgo de voz es indefendible en cualquier forma:
`negocio.llamadas` tiene **0 filas** y ninguna columna de transcripción, medido el 2026-09-28.

**3.2 · El paso «Conversaciones» del embudo** (`lib/aios/executive.js:15-21@c4cf2a8`, y el paso en
`lib/aios/executive.js:24@c4cf2a8`): 41 / 268 / 1072 / 2787 / 6840, y con esa serie se elige el cuello de
botella que se pinta en rojo (`lib/aios/executive.js:38@c4cf2a8`). Reemplazable a medias: contactos,
escritos y agendados se miden hoy (277, 270, 139 a 30 días); «Visitas landing» y «Citas asistidas»
no tienen dato.

**3.3 · Las preguntas sugeridas** (`lib/aios/executive-chat.js:22@c4cf2a8`) caen las tres en la respuesta
`default` (`lib/aios/executive-chat.js:30-39@c4cf2a8`), que habla de la landing y del móvil. Sólo «¿Qué
agente necesita ajuste?» tendría respuesta medida: AppFlow, 17 amarillos y 3 rojos sobre 50
auditables, 23 casos abiertos en 6 patrones.

**3.4 · La tarjeta de cambio «Video de bienvenida en la página de gracias»**, «Solo 54 % le da
play», con Conversation como fuente (`lib/aios/executive-panel.js:36-38@c4cf2a8`; la foto anterior la
ubicaba cinco líneas más arriba, en la 31-33, antes de `0add4cc`). No reemplazable: el §14 no
existe en ninguna forma.

── **TEXTOS FIJOS DENTRO DE LA PROPIA PANTALLA** ──

- **«3 citas de 1052 en todo un año»**, fechado «en septiembre de 2026», en el renglón plegado de la
  asistencia (`components/conversation/PanelDeConversation.jsx:128`). Bien resuelto: es una medición
  fechada de la subcuenta del CRM, que esta base no puede reproducir (tiene 333 citas).
- **«el CRM tiene ese campo en 3 de 1052 citas»**, **sin fecha**, dentro del aviso grave de la
  asistencia (`lib/negocio/indicadoresDeCitas.ts:494-496`), visible hoy en las cuatro ventanas. Es
  el único de los tres sin fecha y el único a la vista. Desde esta base: `showed` en 0 de 333 y
  `noshow` en **15 de 333** (3 el 15).
- **«las 316 citas que había al medirlo»**, detrás del ícono del no-show
  (`components/conversation/PanelDeConversation.jsx:960`). Fechado; hoy son 333.
- **Los tres valores sin rama nombrados a mano** en el aviso del precall
  (`lib/negocio/consumoDelPrecall.ts:274-275`). Hoy siguen coincidiendo —los 9 sin rama son
  exactamente esos tres valores—, pero el día que el CRM agregue un cuarto el conteo lo contará y la
  frase no.
- **El mapa `RAMA`** (`lib/negocio/consumoDelPrecall.ts:94-102`) y su censo fechado el 2026-09-14
  (`lib/negocio/consumoDelPrecall.ts:69-72`). Censo del 2026-09-28 sobre 222 contactos:
  `Sin abrir (0%)` 130 · `Nada` 50 · `76–100%` 12 · `1–25%` 11 · `-20%` 6 · `51–75%` 4 ·
  `Accede: sin reproducir` 3 · `26–50%` 2 · `Clic a link` 2 · `40-60%` 2. **Los mismos diez
  valores**; ninguno nuevo.
- **Los nombres de campo como constantes** —`CAMPO_DE_CONFIRMACION`
  (`lib/negocio/indicadoresDeCitas.ts:208`), `CONFIRMO` (`lib/negocio/indicadoresDeCitas.ts:211`) y
  `CAMPO_DEL_PRECALL` (`lib/negocio/consumoDelPrecall.ts:64`)—. Configuración de una empresa
  disfrazada de constante, declarada así en los dos archivos; el identificador del campo se resuelve
  por nombre, y los dos nombres siguen resolviendo en el catálogo de hoy (195 campos; 170 el 15).

---

## 4 · Datos que ya tenemos

Medido el 2026-09-28 sobre la única organización con datos. Las coberturas son sobre la cohorte de
30 días —**277 contactos** con alta desde el 2026-08-29— salvo donde se dice otra cosa. Esa cohorte
es de otra época que la del 15 (412 contactos, del 16 de agosto al 15 de septiembre): los
porcentajes no son comparables como tendencia.

── **Lo que el documento pide y ya se dibuja** ──

§9.3 booking rate con su denominador; §9.7 respuesta, tiempo hasta el primer intento y la primera
respuesta, conversaciones sin atender, agendamientos por fuente y por campaña, y sentimiento; §10.7
cancelación, reagendamiento, anticipación, confirmación, no-show reportado, consumo del precall y
sentimiento; §10.6 las tres ramas más la cuarta que el documento no tiene; §11 el supervisor, con
sus 70 análisis y 24 hallazgos. Las cifras están en la sección 2.

── **Lo que ya está guardado y la pantalla todavía no usa** ──

**1 · El anuncio.** `atribucion_primera->>'adId'` en **199 de 277 (71,8 %)**, once anuncios
distintos; `adSource = facebook` en 201. El corte por anuncio se decidió no hacerlo acá: vive en
`lib/negocio/costoDelAnuncio.ts`, por los motivos de `lib/negocio/atribucionDelLead.ts:76-93`.

**2 · El ad set y las UTM.** `Last UTM Medium (Adset)` en **204 de 277**; en el primer toque
`utmSource` 264, `utmContent` 258, `fbclid` 56; en el último, `sessionSource` 276 y `adId` 70. Las
dos atribuciones están casi completas y la pantalla sólo lee la primera.

**3 · El ICP score, y ahora también su segmento.** `Puntaje | ICP` en **272 de 277 (98,2 %)**, 23 de
ellos en `"0"`. Lo nuevo: el §10.5 pide «segmento ICP» y la decisión que la foto anterior dejaba
pendiente **ya se tomó, en Leads Portal**: tramos 75 y 50 (`lib/negocio/tramosDelIcp.ts:38` y
`lib/negocio/tramosDelIcp.ts:41`), con el 0 contado como «sin calificar»
(`lib/negocio/tramosDelIcp.ts:85-90`). Conversation no los usa; el día que publique un booking rate
por tramo tiene que importar ese archivo y no repetir los números
(`docs/leads-portal/11-LO-QUE-PIDE-EL-DOCUMENTO.md:316-320`). `perfil_icp`, `Pre-Score | ICP` y
`Lead Score` siguen en 0 de 277.

**4 · La zona horaria.** `zona_horaria_del_lead` en **157 de 277** (314 de 594 en toda la base). Se
usa sólo para el aviso de fuera de horario.

**5 · Quién escribió cada saliente.** De los **1 536** salientes a la cohorte, **504 son del agente
de IA (32,8 %)**, 790 no traen autor (51,4 %) y 242 son de otro usuario; **74 de los 270** contactos
escritos recibieron al menos uno del agente (el 15: 44,2 % y 134 de 382). La nota de la cadena que
dice que «todavía no se distingue un mensaje del agente de uno de un flujo del CRM»
(`components/conversation/PanelDeConversation.jsx:539`) sigue siendo demasiado pesimista: se
distingue en un tercio de los mensajes.

**6 · El formulario de la landing.** `Form Landing VSL` en **247 de 594**, sin cambios: dejó de
escribirse el 2026-08-31 y está en **0 de los 245** contactos con alta en septiembre. En la cohorte
de 30 días quedan **6 de 277** (140 de 412 el 15), y en dos días no va a quedar ninguno.

**7 · El clic al precall.** `Clic a Video Pre-Call` en 20 contactos, igual que el 15. Es la razón
del rótulo «Registró reproducción» y no «Vio el video»
(`components/conversation/PanelDeConversation.jsx:753-759`).

**8 · El estado de envío del mensaje** (`mensajes.estado_entrega` y su familia) — del 2026-09-15, no
re-medido: la columna se rellena hacia atrás y su conteo no se reproduce ni clavando el corte. Es la
materia prima de la «tasa de errores» del §9.7 y del §10.7.

**9 · El sello del barrido.** `negocio.tareas_programadas` guarda, por empresa y tarea, cuándo pasó
el cron y cómo terminó. Medido el 2026-09-28 a las 23:58 UTC, en la organización `aria` las cinco
tareas de las que vive esta pantalla estaban en `corrio` y dentro de su umbral: `contactos`,
`mensajes` y `auditoria` hace 7 minutos (umbral 80), `citas` hace 54 (umbral 180) y `mejora` hace
1 060, unas 17,7 h (umbral 3 000; los tres horarios, `lib/negocio/barrido.ts:194-198`,
`lib/negocio/barrido.ts:206-210` y `lib/negocio/barrido.ts:242-246`). Tienen sello las 11 empresas
activas y ninguna inactiva. La pantalla no lo lee: riesgo 22.

---

## 5 · Datos que faltan, y de dónde tendrían que venir

── **Los seis renglones de `FLUJOS[*].falta`, contra la base del 2026-09-28** ──

**L1 · «El recorrido hasta la landing»** (`components/conversation/PanelDeConversation.jsx:98`) —
**sigue siendo falso para el formulario**: `Form Landing VSL` tiene el vocabulario exacto del §9.5
(`Agendado` · `Form incompleto sin agendar` · `Form completo sin agendar`) en 247 contactos, y lo
que pasó es que una automatización del CRM se apagó el 2026-08-31. Lo que cambió es que la
contradicción **se está yendo de la pantalla sola**: el 15 la cohorte que el tablero dibujaba traía
el campo en 140 de 412; hoy en 6 de 277; a fin de mes, en ninguno. El renglón va a parecer cierto
mirando la pantalla sin haberlo sido nunca. Lo del enlace sí es cierto: en los 195 campos del
catálogo, `%trigger%`, `%clic%`, `%click%`, `%abri%`, `%visit%` y `%session%` sólo encuentran
`Clic a Video Pre-Call` (del precall) y `Last FB ClickId` (el clic del anuncio de Meta, en 85
contactos). La visita tiene una URL de atribución, `Last Landing URL`, en 119 de 277: no es un
evento de visita.

**L2 · «El histórico de las tasas»** (`components/conversation/PanelDeConversation.jsx:99`) —
**cierto**. `reservada_el` en 201 de 333 citas; por semana de inicio, 0 de 24 y 0 de 63 en las
semanas del 10 y del 17 de agosto, 11 de 42, 66 de 76 y 88 de 92 después, y completa desde el 14 de
septiembre. No se va a llenar: el barrido mira catorce días hacia atrás (`lib/negocio/citas.ts:74`).

**L3 · «El agente de voz»** (`components/conversation/PanelDeConversation.jsx:100`) — **cierto**:
`negocio.llamadas` en 0 filas y ninguna columna con «transcrip» en `information_schema.columns`.
Concuerda con `lib/auditor/veredicto.ts:46-52`.

**A1 · «La asistencia según el CALENDARIO»** (`components/conversation/PanelDeConversation.jsx:128`)
— **cierto en el fondo, y el calendario empezó a hablar un poco**. `showed` en 0 de 333; `noshow` en
15, de los cuales 12 pasaron de `confirmed` a `noshow` entre el 2026-09-15 18:04 y el 2026-09-18
16:04 UTC, cuando `estado_cambiado_el` estrenó contenido; en esos mismos días y hasta el
2026-09-22 se registraron otros tres cambios, a `cancelled` —dos desde `confirmed` y uno desde
`noshow`—. `citas.asistio` sigue en 0 de 333.

**A2 · «CUÁNDO vio el precall»** (`components/conversation/PanelDeConversation.jsx:138`) —
**cierto**. Ninguno de los campos de video del catálogo trae fecha; de los seis con «fecha» en el
nombre, el único con volumen es `Fecha de Reunion` (TEXT, 220 contactos; `Fecha Alternativa 1` y
`Fecha Alternativa 2` están en 1 contacto cada uno y las tres de cuotas en 0), y es por su nombre
la fecha de la llamada y no la del visionado (no se abrieron sus valores).

**A3 · «El historial de reagendamientos»** (`components/conversation/PanelDeConversation.jsx:139`) —
**cierto**: `reagendada_el` es una sola columna, en 16 de 333 citas, y el calendario se barre una
vez por hora (`lib/negocio/barrido.ts:206-207`, al minuto 3).

── **Falta en el CRM** ──

**1 · El trigger link del §9.5** (§16.2, prueba 4). Un sistema aparte —un redirector con un token
por contacto—; sin él, link sent / link open / landing visit rate y el tiempo hasta el envío del
enlace no tienen de dónde salir. **2 · El formulario**, que no falta: se apagó (arriba). **3 · El
VSL individual** (§16.2, prueba 5): `VSL % máximo visto` y `VSL segundos vistos` en 79 contactos,
**los 79 en cero**, sin cambios; la prueba 5 sigue FALLADA con evidencia. **4 · La fecha del
precall.** **5 · La asistencia**, por ninguna de las dos vías: con ella caen los seis cortes del
show rate del §10.7.

── **Falta en la landing** ──

**6 · `visitor_id` y `session_id`** (§16.2, pruebas 2 y 3): no existe nada con esa forma. La cadena
del §16.2 sigue cortada en «Sesión», y con el VSL en cero, dos eslabones seguidos.

── **Falta como registro nuestro** ──

**7 · Cinco de los diecisiete campos del §11.7.** `negocio.analisis_del_agente` tiene 23 columnas y
`negocio.hallazgos` 20 (contadas el 2026-09-28). Faltan **`issue_source`, `effectiveness_score` y
`confidence`**: ni el vocabulario del §11.4 ni `effectiveness` aparecen en `lib/`, `components/` o
`app/`, y `confidence` aparece sólo fuera del auditor —en el analizador de llamadas de venta
(`lib/analizadores/`, `components/analizadores/`) y en un comentario de Acquisition—. Tampoco
tienen columna `agent_type` ni `objective` (`objective` sólo aparece como el objetivo de campaña de
Meta, en `lib/ghl/anuncios.ts` y `lib/negocio/recolectarAnuncios.ts`). **8 · La segunda evaluación del §11.3**, la del prompt. **9 · El prompt
y su versión** (§11.2, §11.8): las dos tablas en 0 filas. **10 · El §14 entero**: los 24 hallazgos
tienen `resuelto_el` nulo. **11 · Los cinco responsables del §13**: hoy hay una capacidad,
`auditor.ver`, que llevan los 3 roles de `identidad.roles` (re-medido el 2026-09-28: 3 de 3 con
`auditor.ver` y con `tablero.ver`; el 2026-09-21, según `8dcb619`, era igual). **12 · El canal
hacia Executive del §15**: lo que Executive muestra es inventado.

---

## 6 · Reglas propias

Las transversales —el silencio, el piso de 10, los dos ceros, las citas congeladas— están en
[07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md). Acá, las de este departamento, todas
vigentes y releídas en el código el 2026-09-28:

- **Los dos vocabularios del supervisor no se mezclan.** Post-agenda
  (`lib/auditor/veredicto.ts:97-112`) y pre-agenda (`lib/auditor/veredicto.ts:134-149`) son siete
  criterios cada una y comparten sólo `dato_faltante`; auditar una con la rúbrica de la otra da un
  resultado «convincente y falso» (`lib/auditor/veredicto.ts:128-129`). Ningún promedio junta a los
  dos agentes.
- **El nivel se deriva, no se le cree al modelo** (`nivelDerivado`, `lib/auditor/veredicto.ts:259`):
  con intervención es rojo por definición, y así un error del modelo no tumba la escritura con la
  inferencia ya pagada.
- **La ventana es una palabra de una lista cerrada** (`lib/negocio/periodo.ts:1-34`): lo que no está
  se rechaza (`lib/negocio/periodo.ts:188-193`), y el archivo no importa nada porque lo usa el
  navegador (`lib/negocio/periodo.ts:25-34`).
- **«Completo» es una ventana grande, no un centinela** (`DIAS_DE_TODO = 3650`,
  `lib/negocio/periodo.ts:52`), y por eso existen `desde`, `mitad` y el aviso de la cola.
- **`desde` es la fila más vieja real, calculada en la misma pasada que sus conteos**
  (`lib/negocio/indicadoresDelLead.ts:265-275`, `lib/negocio/indicadoresDeCitas.ts:380-392`).
- **La cadena se corta donde deja de ser monótona.** Un embudo exige que cada escalón sea
  subconjunto del anterior, y agendar no exige haber contestado. La suma de la bifurcación se
  calcula en el módulo (`lib/negocio/indicadoresDelLead.ts:315`) y la fija una prueba
  (`pruebas/base/150-indicadores-del-lead.test.ts:558`).
- **Agendar es el evento**: el booking rate cuenta cualquier cita, futura o congelada
  (`lib/negocio/indicadoresDelLead.ts:209-239`); la cancelación necesita las dos exclusiones porque
  pregunta otra cosa. Lo fija `pruebas/base/150-indicadores-del-lead.test.ts:248`.
- **La cohorte de Lead Flow es por `alta_en_el_crm` y sin filtro de territorio**
  (`lib/negocio/indicadoresDelLead.ts:1-44`).
- **Las tres exclusiones de Appointment Flow se declaran, nunca se suman en silencio**: congeladas,
  descartados por etiqueta (`lib/negocio/citasAlcanzables.ts:79`, con la lista en
  `lib/ghl/contrato.ts:231-238`) y futuras.
- **El precall: dos regímenes, una cuarta categoría y escalas que no se promedian**
  (`lib/negocio/consumoDelPrecall.ts:44-51` y `lib/negocio/consumoDelPrecall.ts:74-93`).
  `Sin abrir (0%)` y `Nada` van a la misma rama; `Accede: sin reproducir` no tiene rama a propósito.
- **El sentimiento es de la conversación, nunca de la persona**, y se publica el molesto
  (`lib/auditor/sentimiento.ts:29-42` y `lib/auditor/sentimiento.ts:57-64`); su denominador son las
  auditables fuera del carril de mejora (`lib/auditor/sentimiento.ts:89-93`).
- **Los contadores cuentan auditables; la lista muestra todo**, con su motivo
  (`lib/auditor/pantalla.ts:29-41`).
- **La severidad del patrón es la del peor caso** (`lib/auditor/vista.ts:120-123`).
- **El carril de mejora tiene criterio, disparo y tope propios** (`lib/auditor/mejora.ts:52`,
  `lib/auditor/mejora.ts:55` y `lib/auditor/mejora.ts:63`: una mejora por día).
- **El hash del prompt se recalcula del texto** (`hashDelPrompt`, `lib/auditor/prompts.ts:64`).
- **Los nombres que se ven son los del CRM** —LeadFlow · Zona Setter, AppFlow · Zona Closer
  (`lib/auditor/vista.ts:151-154` y `lib/auditor/vista.ts:166-169`)— y la lista de agentes sale de
  `AGENTES` (`lib/auditor/veredicto.ts:52`). Nombrar un agente a mano está prohibido con un motivo
  caro: en la plataforma anterior la base aceptaba cuatro agentes y el código validaba contra una
  lista de dos, y los patrones de voz no se podían cerrar ni medir su reincidencia
  (`pruebas/codigo/114-derivacion-del-nivel.test.ts:267-276`).
- **No se nombra al proveedor en texto que se pinta.** Se cumple —cero apariciones fuera de
  comentarios en los nueve archivos de la pantalla, contadas el 2026-09-28— pero **ninguna prueba lo
  vigila acá**: la de `pruebas/codigo/91-closer-y-setter.test.ts:776` barre sólo cuatro archivos del
  Closer.

---

## 7 · Riesgos

**1 · Executive sigue publicando cifras inventadas en nombre de este departamento.** Sin cambios
desde el 15 (sección 3): la gerencia ve «58 % de efectividad» y un hallazgo sobre 22 llamadas de un
agente de voz del que no hay una sola fila.

**2 · Una falta declarada sin censar la base, que ahora se va a ver cierta.** L1 dice que el
formulario no se registra en ninguna parte y el campo está en 247 contactos. A fin de mes la ventana
por omisión ya no va a tener ninguno, y el renglón falso va a coincidir con lo que la pantalla
muestra. Regla que sigue valiendo: antes de escribir una falta, censar `negocio.campos_del_crm` por
nombre y contar coberturas en toda la base, no en la ventana.

**3 · Confundir «se dejó de escribir» con «no existe» — y ahora con «el negocio se cayó».** El VSL
(2026-08-30) y el formulario (2026-08-31) se apagaron el mismo fin de semana; desde el 14 de
septiembre se apagó además la pauta. Las cifras de 30 días van a ir vaciándose día a día sin que
cambie nada de lo que miden, y quien compare dos semanas va a leer un derrumbe del agente o de la
agenda donde lo que hay es un embudo sin entrada. Ninguna cifra de la pantalla dice cuánto entró.

**4 · Los ceros del VSL.** 79 de 79 en cero. Un «show rate según consumo del VSL» sobre eso diría
que nadie ve el video, con un medidor roto como fuente.

**5 · El show rate no tiene ninguna vía abierta.** `asistio` en 0 de 333, `showed` en 0, y el
reporte del closer quieto desde el 2026-09-09. Una tasa sin `asistio is not null` en el denominador
diría que no viene nadie; el módulo lo evita (`lib/negocio/indicadoresDeCitas.ts:365-379`) y cada
corte nuevo del §10.7 puede volver a caer.

**6 · Dos ventanas en la misma pantalla.** Las tarjetas del supervisor cuentan toda la historia
(`lib/auditor/pantalla.ts:195-241`); el sentimiento, treinta días. «30 verdes» al lado de «26,1 %
molestos» con el botón «30 días» encendido se lee como si hablaran del mismo período.

**7 · El sentimiento de AppFlow se apaga solo el 2026-10-08.** Sus 23 juzgadas tienen fechas: 10 del
2026-09-01, 10 entre el 6 y el 12 y 3 del 21. Salen de la ventana el 1, el 6, el 7 y el 8 de
octubre, y el 8 quedan 8, bajo el piso de 10 (`lib/auditor/sentimiento.ts:126-129`), salvo que el
auditor juzgue dos o más en esos diez días: en los trece anteriores juzgó 3. El aviso de ese caso
existe (`lib/auditor/sentimiento.ts:158-164`), pero se va a leer como que el auditor dejó de
funcionar.

**8 · El supervisor audita sin saber qué se le pidió al agente.** Prompts y versiones en 0 filas:
mide ejecución sin controlar diseño, y `elPromptCambio` no puede encenderse nunca.

**9 · El vocabulario del CRM se mueve y la única alarma es un contador.** El censo del precall está
completo hoy, pero `negocio.campos_del_crm` no guarda las opciones declaradas: un valor nuevo sólo
se vería como `sinRama` subiendo, con el aviso nombrando los tres viejos.

**10 · La comparación entre fuentes que el propio módulo prohíbe se dibuja ahora al revés.** El
encabezado de `lib/negocio/atribucionDelLead.ts:22-37` advierte que una fuente chica con tasa alta
al lado de Paid Social dice que «lo pago es lo que peor convierte», con catorce contactos. Hoy es
exactamente eso: **Direct traffic 92,3 % sobre 13** y Social media 50 % sobre 10, contra Paid Social
47,8 % sobre 253, y las tres pasan el piso. El 15 salvaba la pantalla la casualidad del orden; esa
casualidad se terminó.

**11 · La agrupación de campañas.** Sigue partida la misma campaña en dos filas por un `+` contra un
espacio (43 y 2 contactos), sigue un `{{campaign.name}}` sin expandir en 2 y apareció un valor de
campaña que es el nombre de una persona, en 1 contacto. Los tres quedan escondidos en «Otras» por el
piso; si el tercero llegara a 10 contactos, la tabla mostraría el nombre de una persona como si
fuera una campaña.

**12 · La respuesta es de la conversación, no del agente.** Publicarla como rendimiento del agente
es falso; la fina, sobre 74 contactos con mensaje del agente, necesita decir su denominador.

**13 · El censurado de las latencias.** Los 109 escritos que no contestaron no son latencia cero ni
infinita, y no son una muestra al azar: reciben una mediana de **4 salientes contra 1** antes de la
primera respuesta de quienes sí contestaron (109 y 160 contactos), la misma dirección que el
comentario del módulo (`lib/negocio/indicadoresDelLead.ts:432-434`).

**14 · La guarda `>= 0` excluye filas sin decirlo.** A 30 días saca de la latencia de respuesta 1
contacto que escribió antes de que le escribiéramos (161 respondieron, la mediana es sobre 160); en
«Completo», 1 del primer intento y 8 de la respuesta. La guarda está justificada
(`lib/negocio/indicadoresDelLead.ts:331-339`), pero `avisoDeLatencias` sólo declara a los censurados
(`lib/negocio/indicadoresDelLead.ts:436-448`), no a éstos.

**15 · Convertir la bifurcación en un cuarto escalón.** A 30 días afirmaría **86,3 %** donde el real
es 45,3 %; en «Completo», 95,2 % contra 56,7 %; a 7 días, **2 agendados sobre 1 que contestó**. Las
defensas: la forma (`components/conversation/PanelDeConversation.jsx:548-570`), el pie
(`components/conversation/PanelDeConversation.jsx:572-576`) y la suma que fija la prueba. Sólo la
tercera no se rompe en silencio.

**16 · Tasas sin piso sobre uno a cinco casos.** Con la entrada de leads casi en cero, «Hoy» y «7
días» publican 0 %, 66,7 %, 33,3 % y 40 % sobre 1, 3 y 5 casos. El piso de 10 lo aplican siete
cifras, y el booking rate, la respuesta, la cancelación y el reagendamiento no están entre ellas
(`lib/negocio/indicadoresDelLead.ts:306`, `lib/negocio/indicadoresDelLead.ts:318`,
`lib/negocio/indicadoresDeCitas.ts:429` y `lib/negocio/indicadoresDeCitas.ts:442`). No es nuevo en
el código; lo nuevo es que ahora es lo normal. Y Sales hereda la cancelación.

**17 · La atribución y el booking rate dejaron de contar lo mismo, y el comentario dice lo
contrario.** `bddb516` sacó el filtro de cita alcanzable del booking rate y no de
`atribucionDelLead`, que sigue usando `tieneCitaAlcanzable` (`lib/negocio/atribucionDelLead.ts:151`)
bajo un comentario que afirma que es «el mismo filtro de cita alcanzable que el booking rate» y que
sin eso las filas no sumarían la cifra de al lado (`lib/negocio/atribucionDelLead.ts:148-150`). A 30
días no se nota —ningún contacto de la ventana tiene sólo citas congeladas—; en «Completo» las filas
suman **200** agendados y el titular dice **279**: las 79 congeladas. El riesgo inverso, volver a
poner el filtro en el booking rate, lo sigue vigilando
`pruebas/base/150-indicadores-del-lead.test.ts:248`.

**18 · Diez de las once empresas activas verían esta pantalla vacía.** Una sola tiene token de CRM y
una sola el identificador del agente; las cifras de flujo no dependen del auditor pero sí de
`negocio.*`, que está vacío en las otras diez. La pantalla es real para una empresa.

**19 · `desde` sin mediana.** Resuelto en Lead Flow —en «Completo» el aviso de la cola está a la
vista—; `fechaCorta` sigue sin dibujar el año
(`components/conversation/PanelDeConversation.jsx:390-395`), así que la fila de 2025 se ve como «8
de agosto». En las citas el aviso calla en los cuatro períodos, y un campo siempre nulo invita a
creer que no funciona.

**20 · Dos comentarios dicen que la sección pide `tablero.ver`.**
`lib/autorizacion/secciones.ts:291` («La capacidad de la SECCIÓN sigue siendo `tablero.ver`»)
contradice a la línea 315 del mismo archivo, y `components/views/ConversationView.jsx:37-39` dice lo
mismo. `8dcb619` cambió el valor y no los dos textos que lo explicaban.

**21 · Los patrones se agrupan sin mirar el agente.** `agruparPorPatron` junta por código
(`lib/auditor/vista.ts:100-104`) y cada tarjeta se queda con los patrones cuyo **primer caso** es
suyo (`components/auditoria/PanelDeAuditoria.jsx:150`), y el primero es el más reciente, porque
los casos llegan por `detectado_el` descendente (`lib/auditor/pantalla.ts:293`). Desde el
2026-09-17 `no_lee_confirmacion_previa` tiene casos de los dos agentes —3 de AppFlow y 1 de
LeadFlow—; hasta el 2026-09-21 el más reciente era el de LeadFlow y el patrón entero se dibujaba en
su tarjeta, y desde ese día es uno de AppFlow, así que hoy **el caso de LeadFlow se dibuja dentro de
la tarjeta de AppFlow**, y la de LeadFlow afirma «Sin hallazgos abiertos para LeadFlow»
(`components/auditoria/PanelDeAuditoria.jsx:272-284`) teniendo uno. Deducido del código y de las
filas; no visto en pantalla. Es la regla de los dos vocabularios rota en el último paso, el que ya
no mira la base.

**22 · La pantalla no avisa si su dato está viejo.** Las tres primeras pestañas dibujan filas que
escriben cinco tareas del cron —`contactos`, `mensajes`, `auditoria`, `citas` y `mejora` (ítem 9 de
la sección 4)—, y la plataforma ya tiene con qué decirlo: `frescuraDe(tarea)`
(`lib/negocio/frescura.ts:108`) devuelve un aviso que sólo calla cuando la tarea está al día
(`lib/negocio/frescura.ts:49-59`), y lo leen la Agenda del Closer, el chat de la ficha y Leads
Portal, éste sobre las mismas `contactos` y `citas` (`app/api/leads-portal/route.ts:63-64`).
Conversation no: `GET /api/auditoria` arma siete lecturas (`app/api/auditoria/route.ts:88-106`) y
ninguna es ésa. Un `grep` de `frescura` y `tareas_programadas` sobre `lib/auditor/`,
`components/conversation/`, `components/auditoria/`, `app/api/auditoria/`,
`lib/negocio/indicadoresDelLead.ts`, `lib/negocio/indicadoresDeCitas.ts`,
`lib/negocio/atribucionDelLead.ts`, `lib/negocio/consumoDelPrecall.ts` y
`lib/negocio/citasAlcanzables.ts`, el 2026-09-28, sólo acierta en dos comentarios que la usan como
analogía (`lib/negocio/indicadoresDeCitas.ts:60` y `lib/negocio/indicadoresDeCitas.ts:395`).
Lo único que la pantalla dice sobre la edad de lo dibujado es el error de red, que deja las cifras
en su lugar (`components/conversation/PanelDeConversation.jsx:890-892`). Hoy no muerde —las cinco
tareas estaban al día a las 23:58 UTC—, pero con el negocio quieto es la peor combinación: todas las
ventanas miden desde `now()`, así que un barrido caído vaciaría «Hoy» y «7 días» igual que un embudo
sin entrada (riesgo 3), la pestaña de Auditoría dejaría de sumar análisis sin decir por qué, y la
pantalla no tendría con qué distinguir una cosa de la otra. Tampoco lo anota el § 8 de
[17-LA-PLATAFORMA.md](17-LA-PLATAFORMA.md), que enumera los tableros sin frescura y deja afuera a
éste.
