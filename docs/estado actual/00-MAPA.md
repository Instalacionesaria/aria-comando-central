# Estado actual — mapa de los cinco departamentos

> Corte: **2026-09-15**. Todo lo que hay acá se midió contra producción o se leyó del código con su
> archivo:línea. Lo que no se pudo verificar está dicho como pendiente, no omitido.

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
| [04](04-CONVERSATION.md) | **Conversation** | **Construido** | 10 rastros | **21 cifras reales** con su denominador y su piso. Pero una de las seis declaraciones de «lo que falta» es falsa, y los números que Executive publica **en nombre de este departamento** siguen inventados |
| [05](05-SALES.md) | **Sales** | Prototipo completo | 8 juegos | 23 números inventados y el nombre real de un closer, contra `negocio.resultados` con **7 filas, cero ventas y cero montos** |

El sexto —**Business Intelligence**— está en el organigrama y **no tiene pantalla**. No se analizó
acá porque no hay nada que analizar todavía.

---

## La situación general, en cuatro hechos

**1 · Uno de cinco está construido.** Conversation. Los otros cuatro son maquetas completas: dibujan
pantallas enteras y convincentes con números escritos a mano. Ninguna de esas cuatro tiene una sola
ruta de servidor detrás — `app/api/` no tiene carpeta para ninguna.

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

Y tiene un vacío que hay que decir: **nadie verificó estas pantallas abriéndolas.** Todo lo que acá
se afirma sobre lo que se dibuja sale de leer el código, no de mirar la aplicación.
