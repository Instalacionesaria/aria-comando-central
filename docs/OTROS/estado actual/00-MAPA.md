# Estado actual — el mapa de la aplicación

> Corte: **2026-10-18**, con el código de producción `972972e` (migraciones hasta la `078`). Esta carpeta es una
> foto con fecha de Comando Central entero: qué está construido, qué datos hay y cuáles faltan, qué reglas valen y qué
> deuda queda. Cada afirmación lleva su archivo:línea, su commit o la consulta que la produjo; lo que no se pudo
> verificar está dicho como pendiente, no omitido. Las cifras de este mapa salen de los otros diecisiete archivos, que
> las midieron el **2026-10-18 entre las 15:30 y las 16:05 UTC** con
> `node --env-file=.env.supabase scripts/supabase.mjs leer` —sólo conteos y agregados, sin datos de personas— y dicen
> cuáles no se volvieron a medir. La del grafo es del 2026-10-11, el día que se rehízo
> ([08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md)).
>
> **En local hay ocho commits más que en producción** (`693a383..dc84cb2`): la Fase 0 del modelo de datos
> multiempresa, migraciones `079` a `084`. Están **construidos, probados y sin subir**, esperando la aprobación de un
> ingeniero y el cierre de los pendientes de seguridad de la base. La foto describe producción; cada archivo dice qué
> le cambia la Fase 0 cuando llegue, y la descripción entera está en [17-LA-PLATAFORMA.md](17-LA-PLATAFORMA.md) § 11.
>
> **Desde el corte del 2026-09-28, en ocho líneas:**
>
> 1. **La nueva estructura** (E0 a E13, 2026-10-01/02, y su segunda edición F0 a F4, 2026-10-03): el Inicio al centro,
>    cinco departamentos por función y el engranaje del pie. La maqueta del Executive se retiró: **ya no queda
>    ninguna maqueta**.
> 2. **Los agentes de IA** (AG0 a AG16, 2026-10-04 a 06): el cerebro con herramientas de sólo lectura en el Inicio y
>    al pie de cada sección, señales y Plan de acción cada mañana en cuatro departamentos, la Reunión de hoy, el Brief
>    del closer y las objeciones clasificadas; todo uso del modelo queda en `negocio.uso_de_ia`.
> 3. **Las cinco pantallas de Inteligencia volvieron al front del prototipo con datos reales**: Acquisition (09-30),
>    Conversion y Sales (10-09), Conversation (10-10) y Creative (10-11).
> 4. **El gasto de Meta, entero**: la `076` lee el gasto de toda la cuenta y rellena lo que la pasada diaria no cuadra.
>    La foto anterior decía que la pauta no gastaba desde el 2026-09-13, y era la fuga de leer sólo las campañas
>    atribuidas ([06-INTEGRACIONES-GHL.md](06-INTEGRACIONES-GHL.md) § 9).
> 5. **Meta directo, listo y dormido** (2026-10-15): «Probar conexión» en Ajustes y la tarea `activos` que trae la
>    miniatura de cada anuncio. Ninguna empresa cargó el token, así que la tarea queda «saltada».
> 6. **La base de Supabase se limpió** (2026-10-12/13): se borraron, con respaldo, las tablas de los analizadores HT y
>    OB retirados y de la plataforma anterior del closer. Lo nuestro no se tocó.
> 7. Debajo: `app/api/` de 82 `route.ts` a 111; de 5 horarios programados a 8 y de 9 tareas a 12; de 62 migraciones a
>    78 en producción (84 en local); de 2.273 pruebas a 3.053 en el commit de producción (3.074 con la Fase 0).
> 8. **El negocio que todo eso mide casi se detuvo otra vez**: la cuenta de Meta no gastó nada desde el 2026-10-06
>    salvo 1,20 el 2026-10-14, y en la última semana entró un solo contacto.
>
> **La foto anterior** se lee con `git show 972972e:"docs/OTROS/estado actual/<archivo>"`: es la del 2026-09-28 con las
> notas fechadas que se le agregaron hasta el 2026-10-15 (02 y 03 se habían rehecho el 2026-10-11 y el 10-09). Las
> citas que llegan a esta carpeta desde otros documentos y desde el código quedaron fijadas a ese commit
> (`archivo:N@972972e`), porque esta reescritura corrió las líneas. Las anteriores, con `git show 1c55149:` (la del
> 2026-09-15 corregida) y `git show 93a1341:"docs/estado actual/<archivo>"` (la original).

Esta carpeta existe para contestar, antes de discutir qué construir, **qué hay de verdad detrás de cada entrada de la
barra**: si mide o inventa, sobre qué datos, con qué reglas y qué le falta.

---

## 1 · La barra: el Inicio, cinco departamentos y el engranaje

La barra sale de dos listas: los cinco departamentos (`lib/autorizacion/departamentos.ts:50-56`) y sus entradas, cada
una con su sección y, si la tiene, su pestaña (`lib/autorizacion/departamentos.ts:85-116`). El Inicio y los tres
destinos del engranaje no son de ningún departamento (`lib/autorizacion/departamentos.ts:125-128`). Las secciones,
sus claves, las capacidades y las rutas **no cambiaron** con la nueva estructura: lo que una persona ve sigue
saliendo de su capacidad y su alcance, y la barra sólo ordena ([16-AJUSTES-Y-PERMISOS.md](16-AJUSTES-Y-PERMISOS.md)).

| Dónde | Entrada (sección) | Archivo | El titular, medido el 2026-10-18 |
|---|---|---|---|
| Inicio | Nueva conversación (`executive`) | [11](11-EXECUTIVE.md) | El cerebro y la Reunión de hoy. 12 conversaciones en toda la historia, todas de una persona y todas desde el Inicio; la última pregunta es del 2026-10-12. La Reunión se guardó 143 veces para 11 empresas, y sólo una tiene temas |
| Research | ICP & Oferta (`icp`) | [12](12-ICP-Y-OFERTA.md) | 41 versiones de documento (eran 24); las 17 nuevas son de la organización principal, del 2 al 7 de octubre. La rama de ICP y oferta v2 de otra persona sigue sin integrar y choca con `main` |
| Research | Radar: Espía y Scraper (`tools`) | [15](15-TOOLS-Y-MONITOREO.md) | 26 scrapeos de 4 empresas en toda su historia, ninguno desde el 2026-10-10; el Espía guarda su historial (2 análisis) |
| Systems | Acquisition (`acquisition`) | [01](01-ACQUISITION.md) | La cuenta de Meta gastó 7.100,65 del 2026-08-18 al 10-18, el último día el 2026-10-14; a 30 días cerrados, 626,06. **Ninguna campaña tiene funnel asignado**: las tres tarjetas dicen «Sin campañas asignadas» |
| Systems | Conversion (`conversion`) | [03](03-CONVERSION.md) | A 30 días cerrados (2026-09-18 a 10-17): 28 contactos, 22 agendaron y 19 calificados. El formulario sigue «Sin dato desde el 31 ago.» |
| Systems | Conversation (`conversation`) | [04](04-CONVERSATION.md) | A 30 días, 25 contactos y 19 agendaron (76 %), sobre una cohorte que ya no tiene pauta. 27 hallazgos del auditor abiertos en 7 códigos, ninguno resuelto nunca |
| Marketing | Creative Insights (`creative`) | [02](02-CREATIVE.md) | 2 piezas con miniatura (una en la ventana), 0 activos leídos de Meta y 5 piezas a 30 días; el último día con impresiones es el 2026-10-14, 127 de un solo anuncio |
| Marketing | Funnel: Tu landing y Tu VSL (`tools`); Copywriter y Content Studio, «Próximamente» | [15](15-TOOLS-Y-MONITOREO.md) | Pestañas de Tools, sin cifras propias |
| Sales | Sales (`sales`) | [05](05-SALES.md) | 7 resultados, 0 ventas, el último del 2026-09-09. La cadena a 30 días es 25 → 19 → 12 → 0 → 0 |
| Sales | Leads: De GHL (`contacts`), De Radar y Plan de prospección (`tools`); «Todos», «Próximamente» | [10](10-LEADS-PORTAL.md), [15](15-TOOLS-Y-MONITOREO.md) | De GHL: 25 personas a 30 días, 19 agendaron; «Completo», 600 |
| Sales | Setter y Closer (`setter`, `closer`) | [13](13-SETTER-Y-CLOSER.md) | 0 de 368 citas con la asistencia registrada y 0 Briefs generados; sólo 1 de los 3 closers entró desde el 2026-09-28 |
| Sales | Llamadas de venta (`analizadores`, HT) | [14](14-ANALIZADORES.md) | 135 llamadas descubiertas en tl;dv, 41 de venta analizadas; las 89 objeciones tienen categoría. La última reunión descubierta es del 2026-10-12 |
| Client Success | Llamadas de onboarding (`analizadores`, OB) | [14](14-ANALIZADORES.md) | 13 de onboarding analizadas |
| Client Success | Client OS (`clientos`); Seguimiento de clientes, «Próximamente» | [16](16-AJUSTES-Y-PERMISOS.md) | Una sección sin operaciones propias en Comando Central: es otra herramienta |
| Engranaje | Ajustes (`credenciales`) | [16](16-AJUSTES-Y-PERMISOS.md) | 38 capacidades, 3 roles, 15 personas, ninguna con segundo factor. De 13 empresas: 1 con token del CRM, 5 con llave de IA, 1 con la de tl;dv, 0 con el de Meta |
| Engranaje | Panel de Monitoreo e Incidentes (`monitoreo`, `incidentes`) | [15](15-TOOLS-Y-MONITOREO.md) | Sólo desde la organización principal; 1 incidente en toda la tabla, y ninguna empresa con precio cargado |

---

## 2 · La situación general, en ocho hechos

**1 · Ya no hay maquetas: todo lo que se ve mide, y el Inicio habla por todas.** La maqueta del Executive se retiró
con la nueva estructura (E7, `4e9a242`), y en su lugar el Inicio tiene el cerebro y la Reunión de hoy, que leen las
mismas lecturas que las pantallas ([11-EXECUTIVE.md](11-EXECUTIVE.md)). Las cinco de Inteligencia volvieron al marcado
del prototipo con los datos reales, cada una con su foto rehecha.

**2 · Lo que se mide describe un negocio con la adquisición apagada.** La cuenta de Meta no gastó nada desde el
2026-10-06 salvo 1,20 el 2026-10-14, y entre el 2026-10-11 y el 10-18 entró un solo contacto, aunque la sincronización
siguió corriendo ([03-CONVERSION.md](03-CONVERSION.md), [01-ACQUISITION.md](01-ACQUISITION.md)). Las ventanas de 30
días todavía tienen la pauta de septiembre y se vacían solas: cualquier tasa está a pocos contactos del piso, y una
cifra que cae no se lee como una falla ([09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md)).

**3 · Todo el volumen es de una empresa.** De 13 organizaciones (11 activas), una tiene contactos, el token del CRM y
datos; las otras diez se saltean con su motivo en cada tarea. Y 9 de las 11 activas siguen con la zona horaria en UTC,
que es la que decide el «día» de sus cifras ([16-AJUSTES-Y-PERMISOS.md](16-AJUSTES-Y-PERMISOS.md),
[17-LA-PLATAFORMA.md](17-LA-PLATAFORMA.md)).

**4 · Nadie registra el hecho comercial, y el CRM ya lo empezó a decir.** `negocio.resultados` sigue con 7 filas y 0
ventas, la última del 2026-09-09, y ninguna de las 368 citas tiene la asistencia registrada. Mientras tanto el CRM
marca 2 contactos con `venta_ganada` y 3 citas como `showed`, y nada de eso llega a una pantalla
([05-SALES.md](05-SALES.md), [13-SETTER-Y-CLOSER.md](13-SETTER-Y-CLOSER.md)).

**5 · Los agentes están construidos y casi no se usaron.** 12 conversaciones del cerebro en toda su historia, 0 Briefs
del closer, y los avisos nuevos —la cabecera del Closer, la Reunión, las marcas del Brief— no movieron el registro.
`negocio.planes_de_accion` crece unas 88 filas por día, diez de las once empresas sin datos, y nada las borra
([11-EXECUTIVE.md](11-EXECUTIVE.md), [09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md)).

**6 · Hay instrumentos listos que esperan a una persona.** El token de Meta (la miniatura de cada anuncio y el post),
el funnel de cada campaña en Acquisition (0 asignadas), la zona horaria de cada empresa y el precio de cada una en el
Panel de Monitoreo: todo está construido y vacío por falta de carga ([02-CREATIVE.md](02-CREATIVE.md),
[01-ACQUISITION.md](01-ACQUISITION.md), [15-TOOLS-Y-MONITOREO.md](15-TOOLS-Y-MONITOREO.md)).

**7 · Lo que falla en silencio.** La señal de atribución por UTM de Acquisition salía cada mañana y era falsa: buscaba
`utmCampaign`, que ningún contacto trae, cuando la campaña llega como `campaign`. **Cerrado el 2026-10-18 (`65669f4`,
subido el mismo día; hasta entonces producción buscaba sólo `utmCampaign`)**: hoy cuenta las dos claves, y la señal sigue
saliendo por la causa real, `utmTerm` ([01-ACQUISITION.md](01-ACQUISITION.md)).
Los textos de la conexión con Meta y una frase de Leads Portal voseaban, y la prueba de voseo sólo miraba Tools; en el
mismo commit pasaron a tú, y la prueba nueva `pruebas/codigo/258-la-aplicacion-no-vosea.test.ts` mira toda la aplicación
fuera de Fundaciones: el resto del voseo (38 archivos) quedó contado y vigilado, no corregido. De los comentarios
del código que esta foto encontró falsos, trece se corrigieron ese mismo día, sin mover líneas, y otros siguen. Los
contactos congelados pasaron de 25 a 36. El detalle y la consulta para volver a medir cada uno, en
[09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md).

**8 · Lo grande que viene está construido en local y pendiente de aprobación.** El modelo de datos multiempresa —la
subcuenta como segunda llave de aislamiento, el idioma común entre agencias, la bandeja única de entrada y los
eventos— está en ocho commits locales, con su orden de subida escrito. No sube hasta que lo apruebe un ingeniero y se
cierren los pendientes de seguridad de la base, revisados el 2026-10-12, cuyo plan vive fuera del repositorio a
propósito ([17-LA-PLATAFORMA.md](17-LA-PLATAFORMA.md) § 11, [07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md)).

---

## 3 · Los archivos transversales

Los de sección están en la tabla de la § 1. Éstos cruzan todas las pantallas:

| Archivo | Qué contesta |
|---|---|
| [06-INTEGRACIONES-GHL.md](06-INTEGRACIONES-GHL.md) | Qué nos dan los proveedores hoy: las 18 operaciones de GoHighLevel, todas con llamador desde la `076`; las 12 tareas del cron con su costo (un piso de 1.568 llamadas diarias a GoHighLevel); el gasto de toda la cuenta de Meta; y Meta directo (§ 11), de sólo lectura y sin token cargado |
| [07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) | Las reglas que valen para todas las pantallas —las 11 centrales, de la 12 a la 41 y las nuevas 42 a 52: el transporte único, `uso_de_ia` sin textos, el cerebro, señales y planes, el voseo prohibido, `PANTALLA` en cada ruta…—, los errores de método, y aparte lo que la Fase 0 cambiaría. **Leer antes de escribir una cifra nueva** |
| [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md) | Cómo ubicar cualquier cosa con el grafo de conocimiento (7.999 nodos, 22.107 aristas, 353 comunidades, rehecho el 2026-10-11), y lo que no tiene: todo lo posterior, empezando por Meta directo y el modelo de datos |
| [09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md) | Lo que está roto o incompleto, cada punto con su consulta para volver a medirlo: lo que se cerró desde el 2026-09-28 (con su commit), lo que sigue abierto y lo nuevo (§§ 21 a 23) |
| [16-AJUSTES-Y-PERMISOS.md](16-AJUSTES-Y-PERMISOS.md) | Quién ve qué: las 38 capacidades, los roles, el alcance por persona, `soloDesdeLaPrincipal`, las credenciales por organización (con la de Meta y «Probar conexión»), los topes del cerebro y la zona horaria de cada empresa |
| [17-LA-PLATAFORMA.md](17-LA-PLATAFORMA.md) | Lo que está debajo: el cron con sus 8 horarios y 12 tareas, la frescura de cada dato, la base (`negocio` con 49 tablas e `identidad` con 11, todas con RLS forzada), las migraciones `063` a `078` con su hora de aplicación, la limpieza de Supabase, y la Fase 0 sin subir (§ 11) |

---

## 4 · Cómo leer los informes de sección

Los informes de sección —01 a 05 y 10 a 15— abren igual: un recuadro con el corte y el commit de producción, y un
bloque «Desde el corte del …» con los commits que cambiaron la sección (los que ya se habían rehecho después del
2026-09-28 conservan su bloque anterior debajo, como historia). Después vienen sus secciones, en este orden:

1. **Qué pide el documento** — con sus números de sección, para volver a la fuente. El documento funcional no vive en
   el repositorio, así que lo que no se pudo cotejar está dicho.
2. **Qué hay hoy en pantalla** — con archivo y línea.
3. **Lo que era maqueta, o lo que había antes, y qué lo reemplazó.**
4. **Datos que ya tenemos** — con su cobertura medida.
5. **Datos que faltan** — y de dónde tendrían que venir: GoHighLevel, Meta, la landing, tl;dv o el registro manual.
6. **Reglas propias** — vocabularios, umbrales, cohortes, y qué **no** se puede mezclar.
7. **Riesgos** — lo que rompería una cifra si se construye mal.

Algunos se apartan y lo dicen: [11-EXECUTIVE.md](11-EXECUTIVE.md) es ahora la foto del Inicio y el cerebro,
[13-SETTER-Y-CLOSER.md](13-SETTER-Y-CLOSER.md) cambia la 4 y la 5 por qué registra el closer, y
[15-TOOLS-Y-MONITOREO.md](15-TOOLS-Y-MONITOREO.md) empieza por qué son, porque Tools y el Panel de Monitoreo nunca
estuvieron en el prototipo. Los transversales tienen el orden de su tema.

**Las convenciones de toda la carpeta.** Una cita al código va entre acentos graves como `ruta:línea` o
`ruta:desde-hasta`, con ruta suficiente para que no sea ambigua; una cita a código que ya no existe va fijada al
último commit donde existía (`ruta:N@sha`). Una referencia a otro archivo de esta carpeta va como enlace y «§ N»,
nunca con línea. Toda cifra lleva su fecha, su denominador y su población; si cambió desde la foto anterior van las
dos, y la que no se pudo volver a medir lo dice. Ningún archivo nombra a una persona ni a un cliente: el repositorio
es público.

**Qué audita la prueba de citas, y qué no.** `pruebas/codigo/101-las-citas-de-los-documentos.test.ts` comprueba que
cada cita de las carpetas auditadas —esta incluida— resuelva a un único archivo y que su línea exista; las fijadas a
un commit no las mira, porque valen para ese commit. Que una cita resuelva no garantiza que muestre lo que el texto
dice: cada archivo de esta foto revisó las suyas abriendo la línea, y las que estaban corridas se reapuntaron
([07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md)).

---

## 5 · Lo que esta carpeta NO es

**No es un plan.** No propone orden de trabajo ni estima esfuerzo. Es una foto con fecha, para que la discusión sobre
qué construir se haga sobre hechos medidos y no sobre lo que cada uno recuerda.

**No es la aplicación vista con sus datos.** Desde el 2026-09-28 las pantallas que volvieron al prototipo se miraron
en el navegador sobre la base local, con respuestas sintéticas o sembradas, contra el prototipo. Lo que no consta en
ningún commit ni documento es que alguien haya abierto una pantalla **en producción, con sesión iniciada y los datos
reales**, y comparado lo que dibuja contra la base: las revisiones con sesión de Acquisition, Conversion, Sales,
Conversation y Creative siguen pendientes del usuario ([09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md)). Para esta foto
tampoco se levantó ningún servidor: cada cifra «de pantalla» es lo que el código produce sobre los datos medidos,
reconstruido con consultas equivalentes a las de sus módulos. Y un tablero de cifras reales se ve exactamente igual
que uno que las calcula mal.

**No es una corrida de la suite.** Donde un archivo dice que una prueba cubre algo, es leído, no ejecutado. Las cifras
de la suite son las de los commits: 3.053 pruebas en verde en el commit de producción (`972972e`) y 3.074 con la Fase 0
local (`dc84cb2`) ([17-LA-PLATAFORMA.md](17-LA-PLATAFORMA.md)).
