# Acquisition — el front original, con los datos reales

> Requisitos nuevos del **2026-09-30**, pedidos por el usuario: la pestaña vuelve al front que pidió el
> product owner —el del prototipo, `aios-command-center_1.html`, sección `#v-acquisition`— **con la
> estética al 100 %**, y se llena con lo que el backend junta hoy. Los textos son frases cortas.
> Prefijo `A14-`. Formato de la carpeta: Qué es / Rastro / Estado / Fórmula.
> Este documento **no** reemplaza a los otros trece: contesta algunas de sus preguntas (§ 4) y fija qué
> dato va en cada lugar del prototipo. Donde otro documento pide más de lo que se dibuja acá, sigue
> pidiéndolo.

---

## 1 · Qué se pidió, y las cuatro decisiones que lo ordenan

El 2026-09-16 (`be5ba97`) la maqueta se reemplazó por otra pantalla —el costo por anuncio y el monitor
de atribución— con la estética de Conversation. Se hizo por una buena razón: la maqueta calculaba sobre
58 números inventados. Pero con eso se perdió **la forma** que había pedido el product owner, y esta
carpeta ya dice que esa forma es la especificación (`00-MAPA.md` § «Qué es esta carpeta»).

Decidido por el usuario el 2026-09-30:

| tema | decisión |
|---|---|
| A qué funnel pertenece una campaña | **Se asigna a mano**, campaña por campaña, en la misma pantalla. La que no tiene funnel va a «Sin funnel» |
| Qué es un calificado | **Agendó y no está descartado** |
| Los períodos | **Los del sistema**: Hoy · 7 días · 30 días · Completo. Sin «Personalizado» |
| Plan de acción y Señales | **Etapa posterior**: los van a activar agentes de IA. No se dibujan todavía; el plan está en `docs/OTROS/futuro/plan-y-senales-de-acquisition.md` |

---

## 2 · Qué dato va en cada lugar del prototipo

| lugar del prototipo | dato | fuente |
|---|---|---|
| Inversión | gasto de la ventana | `negocio.metricas_de_anuncio.gasto`, sumado por `anuncios.meta_campana_id` |
| Entrada del funnel (Leads · DMs · Contactos) | contactos atribuidos a la campaña, dados de alta en la ventana | `contactos.atribucion_primera->>'campaignId'` y `alta_en_el_crm` |
| Clics a landing VSL | clics al enlace, **contados por Meta** | `metricas_de_anuncio.acciones->linkClick` |
| Completaron form (sólo Booking) | **hueco** | el campo «Form Landing VSL» dejó de escribirse el 2026-08-31 (`lib/negocio/embudoDelFormulario.ts:33-38`) |
| Agendados | contactos con alguna cita alcanzable | `tieneCitaAlcanzable` (`lib/negocio/citasAlcanzables.ts:128-134`) |
| Calificados | agendados sin etiqueta de descarte | `tieneCitaAlcanzable` y no `contactoDescartado` (`lib/negocio/citasAlcanzables.ts:146-150`) |
| ICP % y barra alto/medio/bajo | puntaje de los calificados | `contactos.score`, con los cortes de `lib/negocio/tramosDelIcp.ts` |
| Deltas | la misma cifra en la ventana anterior del mismo largo | el mismo cálculo, corrido una ventana antes |
| Nombre de la campaña | nombre en Meta | **no está en la base**: se trae de GoHighLevel (`lib/ghl/anuncios.ts:320`) |
| Nota bajo las cifras | cuántos leads traen campaña | el punto `sin_campana` de `lib/negocio/calidadDeLaAtribucion.ts` |

---

## 3 · Los requisitos

### A14-01 · La estética es la del prototipo, sin capas encima

**Qué es** · La pestaña se dibuja con las clases del prototipo, y en su orden: `cre-head`,
`filterbar`, `acq-kpis`, `acq-note`, `acq-fgrid` y las tablas por funnel. Esas reglas siguen vivas y sin
uso en `app/aios.css:1585-1725`. La sección **no lleva `estetica-op`**: esa capa, que entró en
`833fc51`, es la que cambió el look.

**Fórmula** · Lo nuevo —el selector de funnel, el texto de un hueco, el estado vacío, el teléfono— va en
una hoja propia, `app/acquisition.css`, acotada a `#v-acquisition` y en la capa `components`. Es el
método de Leads Portal (`app/leads-portal.css:1-12`): `aios.css` tiene que seguir siendo comparable
línea por línea contra el HTML del prototipo.

**Rastro** · El prototipo: `aios-command-center_1.html` (marcado en 2679-2744, reglas `acq-*` en
1671-1813, dibujo en 5482-5594).

**Estado** · Planificado (AQ-4).

### A14-02 · Frases cortas

**Qué es** · Cada texto de la pantalla es una frase corta o una palabra. Lo que la explica va en este
documento y no en la pantalla. Los huecos usan **sólo** estas frases:

| situación | texto |
|---|---|
| etapa sin dato | «Sin dato desde el 31 ago.» |
| etapa contada por Meta | «según Meta» |
| tasa bajo el piso | «—» |
| cifra sin ventana anterior | «sin comparación» |
| funnel sin campañas | «Sin campañas asignadas» |
| grupo «Sin funnel» | «Asigna cada campaña a su funnel» |
| la pauta no gastó en la ventana | «Sin gasto en este período» |
| la lectura falló | «No se pudo leer. Reintenta.» |

**Estado** · Planificado (AQ-4). La lista es cerrada: una frase nueva entra acá primero.

### A14-03 · El funnel de una campaña se asigna a mano

**Qué es** · Cada campaña pertenece a uno de los tres funnels del prototipo —Lead form ads, Profile
funnel, Booking directo— **porque alguien lo decidió**, y esa decisión se guarda.

**Fórmula** · Una tabla, `negocio.funnels_de_campana`, con la clave `(org_id, meta_campana_id)` y un
`check` sobre los tres valores. Tiene un solo escritor. La ruta es `PUT`/`DELETE /api/acquisition/funnel`,
con `credenciales.editar` y auditoría, igual que el link manual de Creative
(`app/api/creative/enlace/route.ts`).

**Por qué a mano** · Ninguna fuente automática separa los tres:
- el objetivo de Meta no llega;
- `mediumId` parte una misma campaña en dos (P-04 de `01`);
- el nombre de la campaña no sigue ninguna convención.

Las campañas son pocas —12 en `negocio.anuncios` el 2026-09-28—, y quien las lanza sabe a qué funnel
van.

**Estado** · Planificado (AQ-2).

### A14-04 · La entrada de cada funnel son los contactos de sus campañas

**Qué es** · La primera etapa es la gente que la campaña trajo en la ventana. Se rotula como en el
prototipo: «Leads» en Lead form ads, «DMs» en Profile funnel y «Contactos» en Booking directo
(`aios-command-center_1.html:5344-5356`).

**Fórmula** · Son los contactos cuyo `atribucion_primera->>'campaignId'` es una campaña del funnel y
cuyo `alta_en_el_crm` cae en la ventana. **Se identifica por id, nunca por nombre** (A1-10).

**Qué no es** · «DMs» no mide mensajes directos: la base no los registra (`03-COSTOS.md:80`). Es la
gente que trajo una campaña que alguien asignó a Profile funnel.

**Estado** · Planificado (AQ-3).

### A14-05 · «Clics a landing VSL» es una cifra de Meta, y no lleva tasa

**Qué es** · Los clics al enlace que Meta cuenta por anuncio (`linkClick`), sumados por campaña.

**Por qué sin tasa** · Son clics y no personas: una persona puede hacer tres. Una tasa «desde leads»
dividiría clics por personas y podría pasar el 100 %. La etapa dibuja su número, su costo por clic y
«según Meta». Las tasas de las etapas de personas saltan por encima de ella: los agendados se miden
contra la entrada.

**Rastro** · `db/migraciones/053_el_desglose_que_ya_llegaba.sql` guarda el desglose; Creative ya lo lee
(`lib/negocio/rendimientoDelCreativo.ts:95`).

**Estado** · Planificado (AQ-3).

### A14-06 · «Completaron form» queda como hueco

**Qué es** · La etapa de Booking directo se dibuja en su lugar, con «—» y «Sin dato desde el 31 ago.».
No se borra: el hueco dice qué falta.

**Estado** · Hueco. Vuelve el día que el formulario vuelva a escribir el campo, o que se sepa qué se
apagó (P-02 de `01`).

### A14-07 · Calificado es quien agendó y no está descartado

**Qué es** · Un contacto de la entrada que tiene alguna cita alcanzable **y** no tiene ninguna etiqueta
de `ETIQUETAS_DE_DESCARTE` (`lib/ghl/contrato.ts:231-238`).

**Fórmula** · `tieneCitaAlcanzable(c) and not contactoDescartado(c)`. Las dos funciones existen y las
usan Leads Portal, Conversion y Sales, así que el número es el mismo que se ve en esas pantallas.

**Cómo se lee** · Queda **después** del agendado, como en el prototipo
(`aios-command-center_1.html:5433`). El «calificado» del pipeline del setter es otra cosa y va antes
(`lib/negocio/etapasDelSetter.ts:48`); no se cruzan.

**Estado** · Decidido el 2026-09-30; contesta P-1 y P-2 de `04`. Planificado (AQ-3).

### A14-08 · El ICP de los calificados: promedio del puntaje y tres tramos

**Qué es** · El «ICP %» es el promedio de `contactos.score` de los calificados. La barra reparte a esos
calificados en alto, medio y bajo, con los cortes de Leads Portal: 75 y 50 (`lib/negocio/tramosDelIcp.ts`).

**Fórmula** · Un puntaje 0 o nulo es «sin calificar» (`lib/negocio/tramosDelIcp.ts:35-89`): **no entra en
el promedio ni en la barra**.

**Por qué no los pesos 100/60/25 del prototipo** · Nadie los justificó e imponen un piso de 25 % (A4-13).
El promedio del puntaje no necesita pesos (P-4 de `04`).

**Estado** · Contesta P-4, P-5 y P-6 de `04`. Planificado (AQ-3).

### A14-09 · Costos y tasas, con el piso de siempre

**Qué es** · Cada etapa lleva su costo (`inversión / etapa`) y, si es de personas, su tasa. El segmentado
«Tasa» del prototipo vuelve: «Paso a paso» divide por la etapa anterior de personas, y «Acumulada» por
la entrada (A2-27).

**Fórmula** · Una tasa con denominador bajo `PISO_DE_UNA_TASA` (10,
`lib/negocio/indicadoresDeCitas.ts:309`) se dibuja «—». Un costo con la etapa en cero también.

**Estado** · Planificado (AQ-3, AQ-4).

### A14-10 · Los cuatro períodos del sistema

**Qué es** · El segmentado del encabezado ofrece Hoy · 7 días · 30 días · Completo
(`lib/negocio/periodo.ts:83-96`), y abre en 30 días (`:109`). «Personalizado» no se dibuja.

**Fórmula** · **Una sola regla de días** para todas las fuentes de la pantalla: días de calendario.
Así se cierra el «Riesgo 2» del estado actual, un «Hoy» con dos significados en la misma pantalla.

**Estado** · Contesta P-01 de `05`. Planificado (AQ-3).

### A14-11 · Los deltas contra la ventana anterior

**Qué es** · Cada cifra lleva su `dlt` contra la ventana anterior del mismo largo, justo antes.

**Fórmula** · Las reglas del prototipo:
- en «Hoy» y en «Completo» no se compara (`aios-command-center_1.html:5464`);
- bajo 0,5 % se dibuja «=» (`:5469`);
- se empareja por la clave de la campaña y no por su posición (A1-15).

Y las que los documentos pedían:
- **la ventana anterior sólo se compara si los datos la cubren entera**; si no, «sin comparación»
  (P-04 de `05`);
- **en los costos, bajar es bueno**: el color va invertido (P-06 de `05`);
- **la Inversión lleva flecha sin color**, porque subir no es bueno ni malo (P-07 de `05`).

**Estado** · Planificado (AQ-3, AQ-4).

### A14-12 · La nota de cobertura, en una línea

**Qué es** · El párrafo `acq-note` del prototipo pasa a decir, en una línea, cuántos leads de la ventana
traen campaña: «N de M leads traen campaña». La regla 10 del estado actual pide que la cobertura vaya
arriba de la tabla, y ahí queda.

**Rastro** · Es el punto `sin_campana` de `lib/negocio/calidadDeLaAtribucion.ts:151-195`, que ya cuenta
eso.

**Estado** · Planificado (AQ-3).

### A14-13 · La campaña se nombra con su nombre de Meta

**Qué es** · La fila de la tabla muestra el nombre de la campaña y su estado.

**Fórmula** · Se guardan en `negocio.campanas`, que llena el colector de anuncios con `estructuraDeAnuncios`
en el nivel `CAMPAIGN` (`lib/ghl/anuncios.ts:320`). Una campaña sin nombre se muestra con su id.

**Estado** · Planificado (AQ-1).

### A14-14 · «Sin funnel» es un grupo más, al final

**Qué es** · Las campañas sin asignar se listan al final, con el selector de funnel para quien puede
asignar. Sus cifras no entran en las tres tarjetas, pero **sí en las cinco cifras de arriba**, que suman
todo lo que la pauta trajo.

**Estado** · Planificado (AQ-4).

### A14-15 · Lo que sale de la pantalla

- **La tabla por anuncio.** El prototipo muestra campañas; el detalle por pieza está en Creative.
- **La tarjeta del monitor de atribución.** Su cifra clave pasa a la nota (A14-12). El módulo se queda.
- **El botón «Plan de acción» y la tarjeta «Señales detectadas».** Se dejan para la etapa de los agentes
  de IA (A14-16).
- **Los `data-leads` del prototipo.** Abrían un cajón con personas inventadas (`lib/aios/leads-group.js`).

### A14-16 · Plan de acción y Señales, para los agentes de IA

**Qué es** · Las dos piezas vuelven cuando haya agentes que las produzcan, con el esquema de alerta
del § 18.13 y la separación entre detectar y recomendar que `06` ya desarmó.

**Estado** · Postergado el 2026-09-30. Plan en `docs/OTROS/futuro/plan-y-senales-de-acquisition.md`.

---

## 4 · Lo que esto contesta de los otros documentos

| pregunta | respuesta |
|---|---|
| P-04 de `01`: qué define un recorrido | un mapeo declarado a mano (A14-03) |
| P-1 y P-2 de `04`: qué es un calificado, y sobre qué se mide | agendó y no está descartado; sobre agendados (A14-07) |
| P-4, P-5 y P-6 de `04`: afinidad, cortes y ceros | promedio del puntaje; 75 y 50; el 0 no entra (A14-08) |
| P-01 de `05`: la lista de períodos | la del sistema, sin rango libre (A14-10) |
| P-04, P-06 y P-07 de `05`: sin período anterior, `invert`, Inversión | A14-11 |

## 5 · Cómo se construye

| etapa | qué | estado |
|---|---|---|
| AQ-0 | Este documento y las respuestas en los otros | hecho, 2026-09-30 |
| AQ-1 | Los nombres de las campañas: migración `065_las_campanas.sql` y el colector | pendiente |
| AQ-2 | El funnel de cada campaña: migración `066_el_funnel_de_la_campana.sql`, escritor y ruta | pendiente |
| AQ-3 | El cálculo, `lib/negocio/embudosDeAcquisition.ts`, y la ruta `/api/acquisition` | pendiente |
| AQ-4 | El front sobre el marcado del prototipo, y `app/acquisition.css` | pendiente |
| AQ-5 | La comparación lado a lado contra el prototipo, y a producción | pendiente |

## 6 · Preguntas abiertas

| id | pregunta |
|---|---|
| `A14-P01` | Si una campaña puede pertenecer a dos funnels. Hoy no: una fila, un funnel |
| `A14-P02` | Quién asigna. Hoy, quien tiene `credenciales.editar` (el administrador) |
| `A14-P03` | Si la pantalla avisa cuando aparece una campaña nueva sin asignar |
