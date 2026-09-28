# Estado actual — mapa de los cinco departamentos

> Corte: **2026-09-15**. Todo lo que hay acá se midió contra producción o se leyó del código con su
> archivo:línea. Lo que no se pudo verificar está dicho como pendiente, no omitido.
>
> El front de Conversation se rediseñó **después** de ese corte y el mismo día: commit `13ce499`,
> 16:56 UTC, catorce horas más tarde que la medición que escribió estos documentos. Lo que cambió es
> **qué ventana pide la pantalla**, y no cuánto vale el 14; la distinción decide qué cifras de esta
> carpeta quedaron viejas y cuáles no:
>
> - **La pantalla** abre en 30 días: `PERIODO_POR_OMISION = '30d'` (`lib/negocio/periodo.ts:109`).
>   Su ruta es el **único** sitio de la aplicación que pisa la ventana de los módulos, y les pasa
>   `periodo.dias` a las cinco cifras juntas (`app/api/auditoria/route.ts:97-104`). Sólo los
>   denominadores de 14 días que describan **lo que Conversation dibuja al abrirse** quedaron viejos;
>   sus cifras se volvieron a medir a las 17:23 UTC.
> - **El código** sigue en 14: `DIAS_DE_LA_TASA = 14` (`lib/negocio/indicadoresDeCitas.ts:310`) no se
>   tocó y sigue siendo el valor por omisión de la firma de `tasaDeCancelacion` (`:295`),
>   `indicadoresDelLead` (`lib/negocio/indicadoresDelLead.ts:183`), `atribucionDelLead`
>   (`lib/negocio/atribucionDelLead.ts:75`), `consumoDelPrecall`
>   (`lib/negocio/consumoDelPrecall.ts:136`), `sentimientoPorFlujo` (`lib/auditor/sentimiento.ts:190`,
>   que lo baja a `sentimientoDelFlujo`, `:81`) y `citasParaCerrar`
>   (`lib/negocio/citasParaCerrar.ts:58`). Cualquiera de esos módulos llamado **sin argumento** mide
>   catorce días hoy, y hay uno que se llama así: `app/api/contactos/[id]/route.ts:151` pide
>   `citasParaCerrar(id)` a secas.
> - **Los otros archivos de esta carpeta** miden casi siempre contra la base y no contra una
>   pantalla: sus ventanas de 14 días describen mediciones propias, y siguen valiendo tal como están
>   escritas.
>
> Los otros cuatro departamentos **no cambiaron de aspecto, pero decir que el commit no tocó nada
> suyo sería falso**. De los once archivos, `app/inteligencia-estetica.css` es la hoja **compartida**
> por las cinco pantallas de Inteligencia —la importa `app/globals.css:50` para toda la aplicación—,
> y el commit la llevó de 378 a 675 líneas. Lo que sí se puede afirmar es que **el cambio no las
> alcanza**: el diff de esa hoja es un solo trozo
> (`@@ -129,130 +129,427 @@`), todo selector agregado cuelga de `#v-conversation` salvo los dos
> envoltorios `@media`, y ninguna línea borrada nombra a los otros cuatro.

Esta carpeta existe para contestar una pregunta antes de discutir el front: **de los cinco
departamentos de Inteligencia, ¿qué está construido, qué es una maqueta, y qué haría falta para
cerrar la diferencia?**

---

## Los cinco departamentos, en una tabla

El organigrama del documento (§4) cuelga seis departamentos de Executive Intelligence. Cinco tienen
pantalla en Comando Central, bajo el grupo «Inteligencia» del menú:

| # | Departamento | Estado | Datos inventados | El titular |
|---|---|---|---|---|
| [01](01-ACQUISITION.md) | **Acquisition** | Prototipo completo | 12 juegos | La mitad del §18.4 ya está guardada —176 de 233 contactos traen el identificador del anuncio— pero **todo lo que cuesta dinero** (gasto, impresiones, CTR, CPM) no existe en ninguna tabla |
| [02](02-CREATIVE.md) | **Creative** | Prototipo completo | 13 juegos | 450 líneas dibujan ocho piezas inventadas con guion y curva de retención fabricada, mientras la base ya permite un ranking real por calidad de lead: **ICP 27,5 contra 74,1 según el creativo** |
| [03](03-CONVERSION.md) | **Conversion** | Prototipo completo | 11 juegos | Su materia prima **existió y estaba casi completa hasta el 2026-08-31**, cuando la empresa cambió de ruta de adquisición y el tráfico dejó de pasar por la landing |
| [04](04-CONVERSATION.md) | **Conversation** | **Construido** | 10 rastros | Cifras reales con su denominador y su piso, hoy en un **tablero con cuatro ventanas a elección** —hoy · 7 días · 30 días · completo (`lib/negocio/periodo.ts:83`). Su cadena de Lead Flow **no es un embudo**: a 30 días, que es lo que se abre por omisión, dibujarla como tal afirmaría que agendó el **83,0 %** de los que respondieron, y agendó el **44,3 %** (94 de 212, no 176). Y Executive sigue publicando números inventados **en nombre de este departamento** (`lib/aios/executive.js:190-193`) |
| [05](05-SALES.md) | **Sales** | Prototipo completo | 8 juegos | 23 números inventados y el nombre real de un closer, contra `negocio.resultados` con **7 filas, cero ventas y cero montos** |

El sexto —**Business Intelligence**— está en el organigrama y **no tiene pantalla**. No se analizó
acá porque no hay nada que analizar todavía.

---

## La situación general, en cinco hechos

**1 · Uno de cinco está construido.** Conversation. Los otros cuatro son maquetas completas: dibujan
pantallas enteras y convincentes con números escritos a mano. Ninguna de esas cuatro tiene una sola
ruta de servidor detrás — `app/api/` tiene diecisiete carpetas y ninguna es suya. La única de
Inteligencia es `app/api/auditoria`, y alimenta las cuatro pestañas de Conversation con una sola
lectura en una sola transacción (`app/api/auditoria/route.ts:88-106`).

**2 · El cuello de botella no es el mismo para todos.** Acquisition y Creative están bloqueados por
un dato que **el CRM no puede dar**: el gasto publicitario vive en Meta. Conversion está bloqueado
por un cambio de negocio —la landing dejó de estar en el camino— y Sales, simplemente, por volumen:
7 resultados contra un piso de 10.

**3 · Y sin embargo hay más construible de lo que parece.** Creative puede rankear creativos **hoy**,
sin conectar nada, porque la atribución que llega de GoHighLevel trae el nombre del creativo y se
puede cruzar contra el puntaje ICP. Es el mismo patrón que ya pasó cuatro veces en este proyecto:
datos guardados que nadie leía.

**4 · Este proyecto ya concluyó tres veces que un dato no existía, y las tres se equivocó.**
`meta_ad_id`, las UTM y el porcentaje de video visto venían de GoHighLevel bajo otro nombre. La regla
que salió de ahí está en [07](07-REGLAS-TRANSVERSALES.md) y vale para toda decisión de integración:
**un `grep` sobre nuestro código prueba qué pedimos, nunca qué manda el proveedor.**

**5 · Cuatro defectos del rediseño de Conversation aparecieron MIRANDO la pantalla, no razonando
sobre ella.** Uno rompía la construcción, y apareció al intentar levantar la pantalla, no leyéndola:
`periodo.ts` nació importando `DIAS_DE_TODO` desde `indicadoresDeCitas.ts` —su lugar natural, al lado
de `DIAS_DE_LA_TASA`— y, como el componente del navegador usa ese mismo vocabulario, eso metía la
capa de datos entera, con el cliente de PostgreSQL, en el paquete del cliente; `next build` lo
rechazó con el rastro de `pg` hasta `PanelDeConversation`
(`lib/negocio/periodo.ts:25-34`, y hoy lo exige una prueba:
`pruebas/codigo/155-el-periodo-de-conversation.test.ts:231`). Los otros tres no rompían ninguna
prueba y se veían de una: la columna del nombre medía **397 px a 1280**, con cuatrocientos píxeles de
nada entre «Entraron al CRM» y su «231» (`app/inteligencia-estetica.css:244-256`); a 400 px el panel
seguía en dos columnas, porque `:is(.pn-b.q3, .pn-b.q4)` del corte de 900 pesa más que `.pn-b` a
secas y la especificidad manda sobre el orden (`:529-533`); y el precall decía el mismo número dos
veces, en el encabezado y en una celda (`components/conversation/PanelDeConversation.jsx:761-763`).
Es el argumento a favor de abrir la aplicación, y esta carpeta no lo tenía.

---

## Los otros archivos de esta carpeta

| Archivo | Qué contesta |
|---|---|
| [06-INTEGRACIONES-GHL.md](06-INTEGRACIONES-GHL.md) | Qué nos da GoHighLevel hoy (14 operaciones, 1.392 llamadas/día), qué le estamos tirando, qué no nos puede dar — y **si hace falta conectar Meta**, contestado con la medición y no con una opinión |
| [07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) | Las reglas que valen para los cinco, cada una con el defecto concreto que cerró. **Leer antes de escribir una cifra nueva.** Incluye los errores de método que este proyecto ya cometió |
| [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md) | Cómo ubicar cualquier cosa nombrada en esta carpeta, usando el grafo de conocimiento |
| [09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md) | Lo que está roto o incompleto hoy, con la consulta para volver a medirlo dentro de un mes |

---

## Cómo leer los informes de departamento

Los cinco tienen la misma forma, y el orden es deliberado:

1. **Qué pide el documento** — con sus números de sección, para poder volver a la fuente.
2. **Qué hay hoy** — con archivo y línea.
3. **Lo que está hardcodeado** — cada juego de datos inventado, dónde vive, **qué dato real estaría
   en su lugar**, y si se puede reemplazar hoy.
4. **Datos que ya tenemos** — con su cobertura medida. Es la sección que más sorpresas dio.
5. **Datos que faltan** — y de dónde tendrían que venir: GoHighLevel, Meta, la landing, o registro
   manual. La distinción decide el costo.
6. **Reglas propias** — vocabularios, umbrales, cohortes, y qué **no** se puede mezclar.
7. **Riesgos** — lo que rompería una cifra si se construye mal.

La sección 3 es la que sirve para planificar el front: dice, pantalla por pantalla, qué se puede
conectar a un dato real sin tocar nada más.

---

## Lo que esta carpeta NO es

No es un plan. No propone orden de trabajo ni estima esfuerzo. Es una foto con fecha, para que la
discusión sobre qué construir primero se haga sobre hechos medidos y no sobre lo que cada uno
recuerda de la maqueta.

Y tiene un vacío que hay que decir con precisión, porque hay dos cosas distintas adentro y una ya no
es cierta. **El rediseño de Conversation sí se miró en el navegador:** los dos temas, a 1280, 880 y
400 px, montando el marcado real sobre las hojas reales (commit `13ce499`). De ahí salieron los
cuatro defectos del hecho 5. Todo lo demás que esta carpeta afirma sobre lo que se dibuja sale de
leer el código.

Lo que **nadie** hizo todavía, en ninguna de las cinco pantallas, es abrirlas **con sesión iniciada y
datos reales**: ninguna cifra de esta carpeta se comprobó viéndola dibujada por la aplicación
andando. La distinción importa porque son dos miradas que encuentran cosas distintas —la primera
encontró un `next build` roto y tres defectos de dibujo; la segunda es la única que puede decir dónde
quedó la línea entre aviso visible y nota escondida— y porque un tablero de cifras reales se ve
exactamente igual que uno que las calcula mal.
