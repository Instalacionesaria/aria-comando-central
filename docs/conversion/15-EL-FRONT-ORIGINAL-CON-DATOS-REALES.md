# Conversion — el front original, con los datos reales

> Requisitos nuevos del **2026-10-08**, pedidos por el usuario: la pestaña vuelve al front que pidió el
> product owner —el del prototipo, `aios-command-center_1.html`, sección `#v-conversion`— **con la
> estética al 100 %**, y se llena con lo que el backend junta hoy. Ya no son datos de maqueta: son los
> reales, adaptados lo más fiel posible a cada lugar de la maqueta. Los textos son frases cortas.
> Prefijo `CV15-`. Formato de la carpeta: Qué es / Fórmula / Rastro / Estado.
> Este documento **no** reemplaza a los otros catorce: contesta algunas de sus preguntas (§ 4) y fija qué
> dato va en cada lugar del prototipo. Donde otro documento pide más de lo que se dibuja acá, sigue
> pidiéndolo. Es el mismo camino que siguió Acquisition con
> `docs/acquisition/14-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`.

---

## 1 · Qué se pidió, y las decisiones que lo ordenan

El 2026-09-20 la maqueta se reemplazó por otra pantalla —el reparto de la cohorte por camino de entrada,
el embudo del formulario y los cinco huecos— con la estética de operación (`estetica-op`). Se hizo por una
buena razón: la maqueta dibujaba dieciocho números inventados multiplicados por un factor de período
(`docs/conversion/00-MAPA.md:37-49`). Pero con eso se perdió **la forma** que había pedido el product owner,
y esta carpeta ya dice que esa forma es la especificación (`docs/conversion/00-MAPA.md:55-60`). Hoy el
backend existe: `GET /api/conversion`, `recorridoDelLead`, `embudoDelFormulario`, el detector `CNV-*` y las
herramientas del cerebro. Lo que falta es volver a la forma, con esos datos.

### Decidido por el usuario el 2026-10-08

| tema | decisión | requisito |
|---|---|---|
| El recorrido | **Las cinco tarjetas del prototipo**. Las que no tienen dato quedan como hueco honesto: «—» y «Sin dato» | CV15-11 |
| La base de los porcentajes | **Los contactos de la ventana**, no las «visitas»: no hay sesiones (CV15-05) | CV15-05 |
| Los cajones | **Sólo con lo real**. No se dibuja ninguna sección inventada | CV15-17 |
| El dispositivo | **No, por ahora**: el `userAgent` está en 47 de los 106 contactos de 30 días | CV15-03 |
| Las bandas de «lo esperado» | **No se dibujan**: no hay umbral medido contra el cual compararse | CV15-11 |
| Las fuentes del encabezado | **Un solo chip: «GoHighLevel»**, que es la integración de la que sale todo | CV15-03 |
| Los bloques de hoy | **Se reparten en el diseño original**: la cobertura pasa a la nota, el reparto al cajón de Landing, el formulario al de Formulario, las señales al final y los huecos a un documento | CV15-10, CV15-17, CV15-19, CV15-27 |
| Las flechas de variación | **Sí, con la regla de Acquisition**: los conteos en %, las tasas en puntos, los agendados a la misma edad y los calificados sin flecha | CV15-20 |

### Tomado por defecto, y que se confirma en la revisión de este documento (§ 6)

| tema | lo que se toma | por qué | pregunta |
|---|---|---|---|
| Qué días abarcan «7 días» y «30 días» | **Días cerrados**, igual que Acquisition | Las vistas de Meta sólo están enteras en días cerrados; AG-28 lo exige a los detectores; el cerebro ya lo promete; y así los contactos de esta pantalla son los mismos que los de Acquisition (CV15-04, CV15-21) | `CV15-P01` |
| El panel «Landing y VSL» | **Tres celdas**: Contactos · Vistas de landing, según Meta · Dan play al VSL | La base de los porcentajes tiene que estar a la vista, y «Visitas» no existe (CV15-06) | `CV15-P02` |
| La caída «−N» de cada tarjeta | **Contra la cohorte**, no contra la tarjeta anterior | El camino no está anidado: el 44 % agenda por el widget sin pasar por el formulario (CV15-16) | — |
| Confirmados y Cancelaron | **Sobre los calificados** | Así no se mezcla la automatización de descarte, que cancela el 94 % (CV15-18) | `CV15-P04`, `CV15-P10` |
| VSL y Gracias | **No abren cajón** | Sería un cajón que sólo dice «Sin dato» (CV15-13) | — |
| El contador `#cvWorst` | **No se dibuja** | Sin bandas, sólo podría afirmar salud por falta de medición (CV15-11) | `CV15-P09` |
| La alarma «Requiere acción ahora» | **Sólo con señales `critica`**. Hoy ninguna regla `CNV-*` lo es, así que no aparece | El prototipo la reservaba para lo crítico (CV15-19) | `CV15-P05` |
| El punto del chip | **Verde sólo si la lectura de contactos está al día** | Un punto verde fijo afirma una fuente viva sin comprobarlo (CV15-03) | — |
| Los rótulos | **Cinco desvíos declarados** del prototipo | La unidad es la persona y no la visita (CV15-02) | — |

---

## 2 · Qué dato va en cada lugar del prototipo

Las cifras de la columna «medido» son de producción, del 2026-10-08, sobre **30 días cerrados**: del
2026-09-08 al 2026-10-07. La ventana anterior va del 2026-08-09 al 2026-09-07. Son conteos de la
organización principal, leídos con `scripts/supabase.mjs leer`.

| lugar del prototipo | dato | fuente | medido |
|---|---|---|---|
| Encabezado: chips de fuente | un chip, «GoHighLevel», con el punto de `frescuraDe('contactos')` | `lib/negocio/frescura.ts:112`; la cabecera ya ata Conversion a esa tarea (`lib/agentes/cabecera.ts:110`) | — |
| Encabezado: «Plan de acción» | el plan de la pasada de la mañana | `BotonDelPlan` (`components/senales/SenalesDelDepartamento.jsx:120-127`) | sólo con 7 y 30 días |
| Encabezado: segmentado de período | Hoy · 7 días · 30 días · Completo | `PERIODOS` (`lib/negocio/periodo.ts:83-96`), con 30 días por omisión (`lib/negocio/periodo.ts:109`) | — |
| Panel 1 · Contactos | la cohorte: contactos dados de alta en la ventana | `negocio.contactos.alta_en_el_crm` | **105** (anterior: 447) |
| Panel 1 · Vistas de landing | la suma de `landingPageView` de todas las campañas, **contada por Meta** | `negocio.metricas_de_anuncio.acciones` (la `053`); la misma clave que lee Creative (`lib/negocio/rendimientoDelCreativo.ts:96`) | **462** (anterior: 2.420, sin día de gasto entero; CV15-07) |
| Panel 1 · Dan play al VSL | hueco | 79 escrituras, las 79 en cero (`lib/negocio/embudoDelFormulario.ts:124-134`) | — |
| Panel 2 · Empiezan el form | contactos con el campo `Form Landing VSL` | `CAMPO_DEL_FORMULARIO` (`lib/negocio/recorrido.ts:231`), que murió el 2026-08-31 | **0**: «Sin dato desde el 31 ago.» |
| Panel 2 · Agendan | contactos con alguna cita alcanzable, sobre la cohorte | `tieneCitaAlcanzable` (`lib/negocio/citasAlcanzables.ts:135-145`) | **63** de 105, 60 % |
| Panel 3 · Agendados | los mismos 63 | igual | **63** |
| Panel 3 · Calificados | agendados sin etiqueta de descarte, sobre los agendados | `tieneCitaAlcanzable` y no `contactoDescartado` (`lib/negocio/citasAlcanzables.ts:157-161`), como A14-07 | **35** de 63, 56 % |
| Panel 3 · No calificados | agendados descartados | la resta | **28** de 63, 44 % |
| Panel 3 · «% de contacto a cita útil» | calificados sobre la cohorte | igual | 35 de 105, 33 % |
| Nota de cobertura | cuántos contactos traen por dónde entraron, y el rango | `recorrido.cobertura` (`lib/negocio/recorridoDelLead.ts:217`) | — |
| 01 Landing | la cohorte; «Vistas, según Meta» y «Por la landing» | lo de arriba, más la porción de la familia `landing` (`lib/negocio/recorridoDelLead.ts:201-204`) | 105 · 462 |
| 02 VSL | hueco | — | — |
| 03 Formulario | `con` sobre la cohorte hasta el corte; «Lo completan» | `embudoDelFormulario` (`lib/negocio/embudoDelFormulario.ts:174-263`) | «—» en 7 y 30 días |
| 04 Agenda | agendados sobre la cohorte; «Calificados» y «Confirmados» | lo de arriba, más `CAMPO_DE_CONFIRMACION` (`lib/negocio/indicadoresDeCitas.ts:208`) | 60 % · 56 % · 18 de 35 |
| 05 Gracias | hueco | es el precall, de Appointment Flow (`docs/conversion/04-LOS-CAJONES.md:100-105`) | — |
| Cajón de Landing | la tabla de las siete familias, que hasta CV-4 fue el bloque principal | `recorridoDelLead` | — |
| Cajón de Formulario | los tres estados y la contradicción con las citas, que hasta CV-4 fueron el segundo bloque | `embudoDelFormulario` | — |
| Cajón de Agenda | agendados, calificados, tasa, confirmados, cancelaron y no calificados | CV15-18 | 63 · 35 · 56 % · 18 · 12 · 28 |
| Alarma | las señales `critica` | `senales.lista` | ninguna: no hay reglas críticas |
| Tarjeta «Señales» | la de hoy, al final | `TarjetaDeSenales` (`components/senales/SenalesDelDepartamento.jsx:196`) | — |

### Lo que la medición del 2026-10-08 agregó

- **Las dos claves de Meta son la misma cifra.** En 221 filas vienen `landingPageView` y
  `omniLandingPageView` juntas, y en las 221 valen lo mismo. No hay ninguna fila con una sola de las dos. Se
  lee una sola, y **nunca se suman**.
- **El desglose de acciones empieza el 2026-08-18**, no el 2026-08-21 que dice A14-05: el relleno de la
  `076` volvió a pedir esos días y trajo también su desglose. Hoy coincide con el primer día de gasto
  guardado.
- **El gasto de la ventana anterior de 30 días no está entero**: tiene el total de la cuenta en 21 de sus 30
  días, porque la base guarda gasto recién desde el 2026-08-18. La actual tiene los 30 días, y los 30
  cuadran. Así que las vistas de 30 días **no comparan** hasta que la ventana anterior empiece el
  2026-08-18 o después.
- **Las citas congeladas, en la anterior de 30 días: 80 de sus 447 contactos** tienen alguna. Los agendados
  de 30 días no comparan (CV15-20). En la anterior de 7 días no hay ninguna.
- **La confirmación, sobre los 35 calificados:** 18 traen el campo, y los 18 dicen `Si`. Sobre los que
  respondieron, la tasa da **100 %**; sobre los calificados, 51 %. Es `CV15-P10`.
- **Cancelaron, sobre los calificados:** 12 de 35 tienen todas sus citas alcanzables canceladas.
- **Hay 24 contactos sin fecha de alta**, sobre 620. No entran en ninguna ventana, tampoco en «Completo».
- **7 días cerrados** (del 2026-10-01 al 10-07): 12 contactos y 7 agendados; la anterior, 6 y 5. Hubo 1
  vista de landing; en la anterior, 3.

---

## 3 · Los requisitos

### CV15-01 · La estética es la del prototipo, sin capas encima

**Qué es** · La pestaña se dibuja con las clases del prototipo, y en su orden: `cv-wrap`, `cre-head`,
`cs-panels cv-panels`, la nota, `ghead` y `journey`, y la alarma (`aios-command-center_1.html:2806-2862`).
Esas reglas siguen vivas en `app/aios.css`: `.cv-wrap` (`app/aios.css:917`), `.journey` y `.jstep`
(`app/aios.css:920-934`) y los paneles (`app/aios.css:1948-1989`). La sección **no lleva `estetica-op`**,
que es la capa que cambió el look.

**Fórmula** · Lo nuevo —la nota, el cajón, el chip con su punto, el teléfono— va en una hoja propia,
`app/conversion.css`, acotada a `#v-conversion`. Es el método de Acquisition (A14-01): `aios.css` tiene que
seguir siendo comparable línea por línea contra el HTML del prototipo. Y `#v-conversion` sale de los
`:is()` de `app/inteligencia-estetica.css` (`app/inteligencia-estetica.css:91-154@b2dcdf5` y `:206@b2dcdf5` en adelante),
que repintan el segmentado, el botón del plan y los `.pn` aun sin `estetica-op`.

**Rastro** · El prototipo: marcado en `aios-command-center_1.html:2806-2862`, reglas en 988-1289 y dibujo
en 3937-4582.

**Estado** · **Construido el 2026-10-09** (CV-4): la vista va sin `estetica-op` y con `cv-wrap`
(`components/views/ConversionView.jsx`), lo nuevo en `app/conversion.css`, y `#v-conversion` salió de cada `:is()` de
`app/inteligencia-estetica.css`. Lo vigila `pruebas/codigo/247-la-pantalla-de-conversion.test.ts`, junto con `pruebas/codigo/146-estetica-de-operacion.test.ts`,
que cuenta una vista menos con la estética de operación.

### CV15-02 · Frases cortas, de una lista cerrada

**Qué es** · Cada texto de la pantalla es una frase corta o una palabra. Lo que la explica va en este
documento, no en la pantalla. Los huecos, los motivos y los estados usan **sólo** estas frases:

| situación | texto |
|---|---|
| cifra, tasa o métrica sin dato o sin fuente —«Tiempo medio», las de VSL y Gracias—, o bajo el piso | «—» |
| paso o sección sin fuente: VSL, Gracias, «Dan play al VSL» y las secciones de los cajones | «Sin dato» |
| el formulario, en una ventana que empieza después del corte | «Sin dato desde el {corte}.» |
| el formulario, en una ventana que cruza el corte: su tarjeta y su cajón | «hasta el {corte}» |
| la ventana cruza el corte del formulario: en la nota | «Cruza el corte del {corte}.» |
| cifra contada por Meta | «según Meta» |
| en la nota, «Completo» o una ventana cuyas personas no comparan; en la tira y en las métricas, una cifra que no compara con la ventana comparando | «sin comparación» |
| «Hoy», en la nota | «día en curso, sin comparación» |
| «7 días», en la nota | «vs 7 días previos» |
| «30 días», en la nota | «vs 30 días previos» |
| la ventana anterior no está entera (`sin_historia`) | «Sin historia para comparar.» |
| la lectura de contactos o de citas está atrasada (`faltan_contactos`) | «Faltan contactos por leer.» |
| a las vistas les falta algún día de gasto, o el colector está atrasado | «Faltan días de gasto.» |
| las vistas: el detalle por campaña no cuadra con la cuenta (`no_cuadra`) | «Falta gasto de algunas campañas.» |
| las vistas: el desglose de Meta no cubre la ventana o la anterior (`sin_desglose`) | «Sin desglose de Meta.» |
| la anterior tiene citas congeladas, y los agendados no comparan | «Los agendados no comparan: hay citas congeladas.» |
| «Completo»: los contactos sin fecha de alta | «{N} contactos sin alta no entran.» |
| ventana sin contactos | «Sin contactos en este período» |
| una familia cuya dirección se capturó al reservar, en el cajón de Landing | «registrada al reservar» |
| el pie de un paso con reglas y ninguna señal | «sin observaciones» |
| la bajada de la alarma | «detectada en la pasada de la mañana» |
| la entrada a la evidencia de una señal | «Ver evidencia →» |
| la primera carga | «Cargando…» |
| la lectura falló | «No se pudo leer. Reintenta.» |

`{corte}` es la fecha corta del corte, «31 ago», y sale del dato (`corteDeEpoca`, `lib/negocio/recorrido.ts:292-312`), nunca escrita a mano. Lo que el servidor dice cuando algo falla va en el `title`.

**Los cinco desvíos de rótulo, declarados** · El prototipo contaba visitas y citas; acá se cuentan personas:

| en el prototipo | acá | por qué |
|---|---|---|
| «de visita a agenda» | «de contacto a agenda» | no hay visitas (CV15-05) |
| «{x}% de visita a cita útil» | «{x}% de contacto a cita útil» | igual |
| «Citas», «Calificadas», «No calificadas», «Confirmadas» | «Agendados», «Calificados», «No calificados», «Confirmados» | la unidad es la persona: 226 citas alcanzables son 201 contactos (`lib/negocio/citasAlcanzables.ts:28-30`) |
| «Visitas» | «Contactos» y «Vistas de landing» | CV15-06 |
| Landing: «entran a la página» | «llegan como contacto» | la familia `sin-pagina` nunca abre una página (`lib/negocio/recorrido.ts:74-77`) |

**Estado** · **Construido el 2026-10-09** (CV-4): la lista es la constante `FRASE` de
`components/conversion/comun.jsx`, que comparten el panel y el cajón, y `pruebas/codigo/247-la-pantalla-de-conversion.test.ts` exige que las dos coincidan en
las dos direcciones, como la 182 de Acquisition. La lista es cerrada: una frase nueva entra acá primero.

### CV15-03 · El encabezado

**Qué es** · El del prototipo (`aios-command-center_1.html:2811-2827`):

- **El título y la bajada vuelven**: «Conversion» y «Dónde se pierde la gente entre el click y la cita». La
  bajada se había cambiado porque la pantalla dejó de ser un embudo; con las cinco tarjetas y la caída en
  personas (CV15-16), la pantalla vuelve a contestar esa pregunta.
- **Un solo chip, «GoHighLevel»**, en lugar de «Clarity» y «VTurb», que eran cadenas sin integración
  (`docs/conversion/00-MAPA.md:119-123`). Su punto `.dotx` (`app/aios.css:965`) es verde sólo si
  `frescuraDe('contactos')` está `al_dia`; si no, va apagado, con la clase de `app/conversion.css`.
- **«Plan de acción»** es el `BotonDelPlan` que ya existe, en `.ch-r` antes del segmentado, como en
  Acquisition. El plan es de 7 y 30 días: con «Hoy» y «Completo» el botón se abre igual y lo dice.
- **El segmentado** son los cuatro períodos (CV15-04). **Sin** la pastilla «Personalizado» y **sin** la
  `filterbar` del dispositivo: lo decidió el usuario, y su texto `#cvInfo` pasa a la nota (CV15-10).

**Con la cabecera del departamento a la vista** · `app/departamentos.css` oculta el `.ch-l` entero de las pantallas
del prototipo, porque ahí viven el título y la bajada que la cabecera ya dice. En Conversion ahí vive también el
chip, así que `app/conversion.css` oculta sólo el título y la bajada, y el chip queda.

**Estado** · **Construido el 2026-10-09** (CV-4). La frescura viaja en la respuesta (`frescura.contactos`, de
`frescuraDe('contactos')`), con la frase de la cabecera del departamento (`faltaPorFrescura`) para el `title` del
chip: la de `frescuraDe` promete una lectura al abrir la pantalla, y ésta no lee.

### CV15-04 · Los cuatro períodos, y qué días abarcan

**Qué es** · Hoy · 7 días · 30 días · Completo (`lib/negocio/periodo.ts:83-96`), con 30 días por omisión
(`lib/negocio/periodo.ts:109`). El botón encendido es el que **el servidor contestó**
(`docs/conversion/05-PERIODOS-Y-PISOS.md:57-59`).

**Fórmula** · La de Acquisition (A14-10), con la misma función:

- **«7 días» y «30 días» son días CERRADOS**: los 7 o 30 días completos hasta el último día cerrado de la
  serie de gasto de la cuenta. Hasta el CV-3 Conversion cortaba con días de calendario que **incluían hoy**
  (`ventanaDeLaCohorte`, `lib/negocio/recorrido.ts:201-203`, desde `app/api/conversion/route.ts:67-68@02d9207`); desde el
  2026-10-08 la ruta, el cerebro y el detector cortan con `bordesDelPeriodo` y `cohorteEntre`.
- **«Hoy» es hoy**, a medias: no compara.
- **«Completo»** empieza en el dato más viejo —el primer contacto con fecha de alta, o el primer día de gasto
  guardado si fuera anterior— y termina hoy. Es la regla de la función compartida (CV15-21); en ARIA el primer
  dato es un contacto.

El segmentado **no** lleva el `title` del matiz de «Hoy» (`lib/negocio/periodo.ts:84`): dice «las últimas 24
horas», y acá «Hoy» es el día de calendario. Es el mismo arreglo que A14-10 y cierra el riesgo 4 de
`docs/OTROS/estado actual/03-CONVERSION.md:486-492@b3ca9ad`.

**La diferencia con el resto del sistema, dicha** · Creative sigue terminando sus ventanas hoy, así que «7
días» puede dar otra cifra en Creative que acá. Es la misma contrapartida que A14-10.

**Estado** · **La ventana, construida el 2026-10-08** (CV-1): `bordesDelPeriodo` (CV15-21). **La ruta la usa desde
el 2026-10-08** (CV-3), y el segmentado sin el matiz desde el 2026-10-09 (CV-4). Es `CV15-P01`.

### CV15-05 · La población: los contactos de la ventana

**Qué es** · Todo porcentaje de la pantalla es **sobre los contactos dados de alta en la ventana**. Lo
decidió el usuario. La unidad es la persona: no existe ninguna tabla de sesiones ni de visitantes
(`docs/conversion/00-MAPA.md:229-230`).

**Fórmula** · `alta_en_el_crm >= desde and alta_en_el_crm < hasta + 1`, con las fechas de CV15-21. Una tasa
con denominador bajo `PISO_DE_UNA_TASA` (10, `lib/negocio/indicadoresDeCitas.ts:329`) se dibuja «—».

**Lo que no entra** · Los 24 contactos sin fecha de alta no caen en ninguna ventana, tampoco en «Completo».
En «Completo» la nota lo dice (CV15-10). Es el riesgo 6 de
`docs/OTROS/estado actual/03-CONVERSION.md:498-502@b3ca9ad`.

**Estado** · **El cálculo, construido el 2026-10-08** (CV-2): `lecturaDeConversion`, en `lib/negocio/pasosDeConversion.ts`. Se dibuja desde el 2026-10-09 (CV-4).

### CV15-06 · El panel «Landing y VSL»: tres celdas

**Qué es** · El prototipo tenía dos celdas, «Visitas» y «Dan play al VSL»
(`aios-command-center_1.html:4111-4121`). Pasa a tres, con `.pn-b.q3` (`app/aios.css:1986-1989`):

| celda | cifra | tasa | flecha |
|---|---|---|---|
| «Contactos» | la cohorte | — | en %, más es mejor |
| «Vistas de landing», con «según Meta» abajo | CV15-07 | **ninguna** | en %, sólo si el gasto está entero en las dos ventanas |
| «Dan play al VSL» | «—», con «Sin dato» | — | — |

El `em` del panel sigue siendo «llegan y consumen».

**Por qué no «Visitas»** · Meta cuenta vistas de cualquier destino del anuncio —también el widget de
reserva—, y no se pueden cruzar con una persona (`docs/conversion/07-LO-QUE-ENTREGA-Y-RECIBE.md`, CV7-02).
En 30 días son 462 vistas contra 105 contactos. Rotularlas «Visitas a la landing VSL» afirmaría las dos
cosas que no son.

**Estado** · **Construido el 2026-10-09** (CV-4): la «Tira» del panel. Es `CV15-P02`.

### CV15-07 · Las vistas de landing son una cifra de Meta, y no llevan tasa

**Qué es** · La suma de `landingPageView` de la ventana, de **todas** las campañas de la cuenta: el mismo
filtro `meta_campana_id is not null` que el detalle del gasto (`lib/negocio/gastoDeLaCuenta.ts:355`). Una
campaña de mensajes no trae la clave y suma cero, así que no hace falta filtrar por funnel.

**Fórmula** · La de A14-05 de Acquisition, con dos diferencias, una para cada lado:

- **más estricta**: si el desglose no cubre la ventana —empieza después de su comienzo, o alguna fila que entregó no
  lo trae—, no se publican (`sin_desglose`): serían las de una parte. Acquisition publica esa suma y cobra el clic
  sólo a las filas con desglose, porque el costo la acota; acá la cifra está sola. En «Completo» se dibuja «—»;
- con filas, la suma; si ninguna entregó, cero;
- **menos estricta**: sin ninguna fila, Acquisition dice siempre «—»; acá, cero si la cuenta midió el cero esos días
  —todos cerrados y enteros, con el total en cero—. Con la cuenta entera y gasto —un día declarado residuo cuenta como
  entero, y sí gastó— es «—» con «Falta gasto de algunas campañas.»: la cuenta cobró algo que ninguna campaña que
  tenemos explica. Sin la cuenta entera, «—»: así lo ven «Hoy» antes de la pasada de las 06:17 UTC, un día que el
  colector no leyó y una empresa que nunca pautó. Con 7 y 30 días la nota dice por qué: «Faltan días de gasto.» si el
  colector está atrasado o falta algún día de la cuenta, y «Falta gasto de algunas campañas.» si no cuadra. A la
  empresa que nunca pautó no le dice nada: no le falta nada que leer.

**Cuándo compara** · Con 7 y 30 días, **por su cuenta**: aunque las personas no comparen, porque no son personas.
Sólo si las dos ventanas tienen el gasto entero, con `coberturaDelGasto`, y el desglose completo en la anterior. Un
día que cuadra con el total de la cuenta prueba que se leyeron las filas de todas las campañas que gastaron, y las
acciones viven en esas mismas filas; que estén todas lo prueba la cuenta de filas sin desglose. Si no, se apaga sólo
esta flecha, con el motivo en la nota.

**«Hoy»** · Es la foto de las 06:17 UTC, la misma que Acquisition publica de sus clics. Es `CV15-P06`.

**Estado** · **El cálculo, construido el 2026-10-08** (CV-2): `vistasDeLaLanding` y la cobertura del gasto en `lecturaDeConversion`. El desglose empieza el 2026-08-18, así que en «Completo» las vistas son «—».

### CV15-08 · El panel «Formulario y cita»

**Qué es** · El del prototipo (`aios-command-center_1.html:4123-4134`), con `.pn.hi` y el `em` «de contacto
a agenda»:

| celda | cifra | tasa | flecha |
|---|---|---|---|
| «Empiezan el form» | los que traen el campo | sobre la cohorte; CV15-14 | **nunca** |
| «Agendan» | los agendados | sobre la cohorte | en puntos, a la misma edad |

**Estado** · **Construido el 2026-10-09** (CV-4).

### CV15-09 · El panel «Calidad de lo agendado»

**Qué es** · El del prototipo (`aios-command-center_1.html:4136-4147`), con `.pn-b.q3` y el `em` «{x}% de
contacto a cita útil», donde x son los calificados sobre la cohorte, con el piso:

| celda | cifra | tasa | flecha |
|---|---|---|---|
| «Agendados» | los agendados | — | en %, a la misma edad |
| «Calificados» | agendados sin descarte (A14-07), con `esCalificado` | sobre los agendados | **ninguna**: el descarte no tiene fecha |
| «No calificados» | agendados descartados | sobre los agendados | ninguna, como en el prototipo |

**Estado** · **Construido el 2026-10-09** (CV-4).

### CV15-10 · La nota de cobertura, en una línea

**Qué es** · El bloque «Cuánto vale lo que dice esta pantalla» de hoy se vuelve una línea bajo la tira,
`.cv-note`, con el molde de `.acq-note`. Ocupa el lugar del `#cvInfo` del prototipo
(`aios-command-center_1.html:4149-4151`):

«**{con} de {sobre}** contactos traen por dónde entraron · {rango} · vs 30 días previos»

La comparación es una frase cerrada de CV15-02: «vs 7 días previos» o «vs 30 días previos», «día en curso, sin
comparación» con «Hoy», y «sin comparación» con «Completo» o cuando las personas no comparan. El rango de la ventana
anterior va en el `title` de esa frase. Sin contactos en la ventana, la nota empieza con «Sin contactos en este
período».

Y, cuando corresponda, las frases cerradas de CV15-02: «Sin historia para comparar.», «Faltan contactos por
leer.», «Faltan días de gasto.», «Falta gasto de algunas campañas.», «Sin desglose de Meta.», «Los agendados no
comparan: hay citas congeladas.», «Cruza el corte del {corte}.» y, en «Completo», «{N} contactos sin alta no
entran.».

**Rastro** · `con` y `sobre` salen de `recorrido.cobertura` (`lib/negocio/recorridoDelLead.ts:217`). La
cobertura va arriba de cualquier reparto: es el § 18.5.

**Estado** · **Construido el 2026-10-09** (CV-4): la «Nota» del panel.

### CV15-11 · El recorrido: cinco tarjetas, con huecos

**Qué es** · El `ghead` «Recorrido» y la `.journey` de cinco `.jstep`, con las claves del prototipo:
`sesiones`, `vsl`, `form`, `agenda` y `gracias` (`aios-command-center_1.html:3969-3975`).

- El `gsub` pasa a «porcentajes sobre los contactos de la ventana · abre un paso para ver su evidencia».
- **Sin bandas**: cada tarjeta lleva `<div class="jband empty">` (`app/aios.css:1123-1124`). Lo decidió el
  usuario. El umbral sigue siendo una pregunta abierta (`docs/conversion/02-METRICAS.md:308-314`).
- **Sin `off`** y **sin `#cvWorst`**: sin banda no hay «bajo lo esperado», y el contador diría «todos los
  pasos en rango» sobre pasos que no se midieron (`docs/conversion/03-EL-RECORRIDO.md:95-102`).
- El estado de cada tarjeta es `st-na` (`app/aios.css:1139`), que sólo apaga el punto. Pasa a `st-crit crit`
  si tiene una señal crítica.
- Las flechas `.jarrow` (`app/aios.css:1129`) se dibujan, como decoración: cada porcentaje es sobre la
  cohorte y no sobre la tarjeta de al lado.
- VSL y Gracias, que no abren cajón (CV15-13), no llevan la flecha `›` del encabezado ni la mano del cursor.
- Cada métrica `jm` va en dos renglones, el rótulo arriba y la flecha y la cifra abajo, haya flecha o no: en el
  prototipo todas la tenían, y con los datos reales sólo comparan algunas. Así las cinco tarjetas coinciden línea
  por línea.

**Estado** · **Construido el 2026-10-09** (CV-4): la «Tarjeta» del panel, cada una con `jband empty`.

### CV15-12 · La tarjeta de Landing

**Qué es** · El número grande `.jv` es la cohorte, con su flecha en %. La `j-sub` dice «llegan como
contacto». Sus dos `.jmx`:

- «Vistas, según Meta»: la cifra de CV15-07, con su flecha si compara;
- «Por la landing»: la porción de la familia `landing` sobre la cohorte. Sin piso, porque es un conteo
  sobre otro (`lib/negocio/recorridoDelLead.ts:201-204`). Su flecha es en puntos y **neutra**: que la
  landing gane o pierda porción es un cambio de ruta, no algo bueno o malo.

**Qué no es** · «Por la landing» no dice «vio la landing». La familia de septiembre es casi toda circular
(`docs/OTROS/estado actual/03-CONVERSION.md:479-484@b3ca9ad`). El cajón marca sólo la fila registrada entera al reservar, y
el aviso del servidor nombra las que lo son en un 90 % o más, con el piso; la de septiembre, con el 86 %, queda sin
marca (el riesgo 3 de ese documento).

**Estado** · **Construido el 2026-10-09** (CV-4). El segundo `jmx` es `CV15-P08`.

### CV15-13 · VSL y Gracias quedan como huecos

**Qué es** · Las dos tarjetas se dibujan en su lugar, con «—» como número y «Sin dato» como `j-sub`. Sus
`jmx` llevan los rótulos del prototipo con «—»: «Visto promedio» y «Llegan al CTA» en VSL, «Dan play al
video» y «Video visto» en Gracias (`aios-command-center_1.html:4155-4166`). El pie queda vacío.

**No abren cajón**: el cajón diría «Sin dato» y nada más. El hueco ya lo dice la tarjeta.

**Por qué** · El VSL tiene 79 escrituras y las 79 dicen cero (`lib/negocio/embudoDelFormulario.ts:124-134`).
Gracias es el precall, que pertenece a Appointment Flow (`docs/conversion/04-LOS-CAJONES.md:100-105`).

**Estado** · **Construido el 2026-10-09** (CV-4).

### CV15-14 · La tarjeta de Formulario

**Qué es** · Cuántos de la cohorte traen el campo `Form Landing VSL`. Es la tarjeta que más depende del
corte del 2026-08-31.

**Fórmula** · Según cómo cae la ventana:

- **Empieza después del corte** —hoy, «Hoy», «7 días» y «30 días»—: `.jv` «—» y `j-sub` «Sin dato desde el
  {corte}.». No hay a quién medir: nadie dado de alta después del corte trae el campo.
- **Cruza el corte** —hoy, «Completo»—: `.jv` es `con / cohorte hasta el corte`, y la `j-sub` dice «**{con}**
  lo empiezan · hasta el {corte}». **El denominador es la cohorte anterior al corte, no la ventana**: la
  regla 2 del departamento prohíbe mezclar las dos épocas en una cifra
  (`docs/OTROS/estado actual/03-CONVERSION.md:368@b3ca9ad`), y `docs/conversion/05-PERIODOS-Y-PISOS.md:81-97`
  pide no publicarlas como una sola serie.
- **Sus `jmx`** · «Lo completan»: la `finalizacion` del embudo, con el piso sobre `con`
  (`lib/negocio/embudoDelFormulario.ts:251`). «Tiempo medio»: «—».
- **Nunca lleva flecha**, mientras el campo esté muerto y la ventana actual termine después del corte. La
  anterior de 30 días cae casi entera antes del corte, y la actual entera después: sin esta regla la flecha
  bajaría 100 %, en rojo, sin que nada cambie.

**Estado** · **El cálculo, construido el 2026-10-08** (CV-2), con la cohorte hasta el corte que cuenta `personasDeLaCohorte`; se dibuja desde el 2026-10-09 (CV-4). El denominador
es `CV15-P03`.

### CV15-15 · La tarjeta de Agenda

**Qué es** · El `.jv` son los agendados sobre la cohorte, con su flecha en puntos. La `j-sub` dice
«**{n}** reservan la cita». Sus dos `jmx`:

- «Calificados»: los calificados sobre los agendados, sin flecha;
- «Confirmados»: CV15-18, sin flecha.

**Por qué los agendados son la suma de las filas** · El número es Σ `agendaron` de las filas del recorrido.
Así la tarjeta suma exactamente lo que dice la tabla del cajón de Landing.

**Estado** · **El cálculo, construido el 2026-10-08** (CV-2); se dibuja desde el 2026-10-09 (CV-4).

### CV15-16 · El pie de cada tarjeta

**Qué es** · El `.jx` del prototipo (`aios-command-center_1.html:4219-4222`):

- **A la izquierda**, «N a revisar», con las señales del paso que no están en `sin_medicion`. «sin
  observaciones» se escribe sólo cuando hay de dónde decirlo: con 7 o 30 días, y en un paso con reglas. Con
  «Hoy» o «Completo», el pie queda vacío.
- **A la derecha**, «−N»: los contactos de la cohorte que **no** llegaron a ese paso —en el formulario, de la cohorte
  hasta el corte, que es su denominador (CV15-14)—. El prototipo restaba
  la tarjeta anterior (`aios-command-center_1.html:4180`); acá se resta de la cohorte, porque los agendados
  no son un subconjunto de los que empezaron el formulario. CV2-13 pide medir la caída sólo dentro de una
  misma población (`docs/conversion/02-METRICAS.md:254-261`). La caída en personas es la mejor idea del
  prototipo y se conserva.
- En la tarjeta de Landing, ni hueco ni resta: es la base.

**Estado** · **La caída, construida el 2026-10-08** (CV-2): `Paso.caida`. El pie, desde el 2026-10-09 (CV-4): los
pasos con reglas son los que `pasoDeLaSenal` puede devolver, y `pruebas/codigo/247-la-pantalla-de-conversion.test.ts` lo exige.

### CV15-17 · Los cajones: sólo Landing, Formulario y Agenda

**Qué es** · Cada uno con la forma del prototipo: la meta con la **fuente y la población**, una rejilla de
cajas, sus secciones reales y, en los pasos con reglas —Landing y Formulario, CV15-16—, las «Observaciones»
(`docs/conversion/04-LOS-CAJONES.md:40-58`). **No llevan
la «Lectura»** en prosa: no hay ningún texto que el servidor escriba con fuente.

**El componente** · `components/conversion/CajonDelPaso.jsx`, con `createPortal`, `scrim` y `drawer on`, el
id `cvCajon` y la raíz `.cv-cajon`. Es el molde de la ficha de Creative
(`components/creative/FichaDelCreativo.jsx:58-61`), no el `#drawer` del prototipo.

**Landing** · Meta: «GoHighLevel · {cohorte} contactos · {rango}».

- «Por dónde entró la gente»: la tabla de las siete familias (Camino · Contactos · Del total ·
  Agendaron), con la nota de cada fila en el `title` y la marca «registrada al reservar» en la fila que se
  registró entera al reservar. El aviso del servidor, debajo, nombra también las que lo son casi enteras.
- Una línea «Sin dato» donde el prototipo tenía el comportamiento, el mapa de calor y las grabaciones.
- Sus observaciones.

**Formulario** · Meta: «GoHighLevel · {con} lo empezaron · {desde} – {hasta}».

- Una rejilla: Lo empezaron · Lo completaron · Tasa. «Lo completaron» es `completaron`, el numerador de la
  finalización, que el embudo publica desde el 2026-10-09 para no sumar filas en el navegador.
- La tabla de los tres estados (Estado · Contactos · De los que llegaron · Con cita), con la contradicción del
  campo contra las citas (`agendadoSegunLasCitas`) en la columna «Con cita» de `Agendado`, y el aviso del
  embudo.
- «Campo por campo»: «Sin dato».
- Sus observaciones.

**Agenda** · Meta: «Calendario · {agendados} agendados · {rango}».

- Una rejilla de 3×2: Agendados (con su flecha) · Calificados · Tasa de calificación · Confirmados · Cancelaron
  · No calificados.
- «Qué pasa después»: «Sin dato», porque depende del VSL (`docs/conversion/04-LOS-CAJONES.md:90-99`).
- «Franja preferida» no se dibuja: no es una de las cifras pedidas, y se podría calcular de `inicio_el`, así
  que «Sin dato» sería falso.
- Sin «Observaciones»: ninguna regla apunta a la Agenda (CV15-19), y la sección no se dibuja (`CON_REGLAS`, en
  `components/conversion/comun.jsx`).

**Las observaciones** · Las señales del paso, con el marcado `obs` (`app/aios.css:1080-1092`): `obs-t` es el
texto, `obs-d` la revisión, `obs-m` la fecha y el estado, y `obs-n` la pérdida en contactos. «No tocar» no es
una señal (`lib/agentes/detectores/conversion.ts:44-45`): si va como «a favor», es `CV15-P07`.

**Estado** · **Construido el 2026-10-09** (CV-4): `components/conversion/CajonDelPaso.jsx`. Contesta CV4-P01: los
cajones que sobreviven son tres.

### CV15-18 · Confirmados y Cancelaron

**Qué es** · Dos cifras de **personas** de la cohorte, sobre los **calificados**. Así no se mezcla la
automatización de descarte, que cancela el 94 % de lo suyo (`lib/negocio/indicadoresDeCitas.ts:179-188`).

**Fórmula** ·

- **Confirmados**: calificados cuyo campo `Confirmación Agendamiento`
  (`lib/negocio/indicadoresDeCitas.ts:208`) vale `Si` (`lib/negocio/indicadoresDeCitas.ts:211`). Sin el campo
  en el CRM, «—». El predicado se exporta y lo usa también `confirmacionEnLaVentana`
  (`lib/negocio/indicadoresDeCitas.ts:245`): una sola definición de «confirmó». El denominador es
  `CV15-P10`.
- **Cancelaron**: calificados con al menos una cita alcanzable y **ninguna** alcanzable que no esté cancelada
  (`alcanzable` y `cancelada`, `lib/negocio/citasAlcanzables.ts:54-66`). Quien canceló y volvió a reservar
  no cuenta. Tasa sobre los calificados, con el piso.

**Qué no es** · No es la tasa de cancelación de Conversation y Sales (`lib/negocio/indicadoresDeCitas.ts:341`),
que cuenta **citas** en una ventana móvil. Por eso se rotula «Cancelaron» y no «Canceladas».

**Estado** · **Los predicados, construidos el 2026-10-08** (CV-1): `confirmoElAgendamiento`,
`respondioLaConfirmacion` y `todasSusCitasCanceladas`, probados en `pruebas/base/246-pasos-de-conversion.test.ts`.
La cifra sobre la cohorte, construida el 2026-10-08 (CV-2): `personasDeLaCohorte`. Contesta CV2-15.

### CV15-19 · Las señales: por paso, la alarma y la tarjeta

**Qué es** · Las señales de la pasada de la mañana se reparten por paso según su entidad:

| entidad | paso |
|---|---|
| `familia_de_entrada` (`lib/agentes/detectores/conversion.ts:153`) | Landing: el reparto vive en su cajón |
| `funnel` `formulario` (`lib/agentes/detectores/conversion.ts:250`) | Formulario |
| cualquier otra | ninguno: va sólo a la tarjeta |

**La alarma** · `#cvAlarmWrap` se muestra sólo si hay alguna señal con gravedad `critica`
(`lib/agentes/senales/tipos.ts:22`), y sólo con 7 o 30 días. **Hoy ninguna regla de Conversion es crítica**
—son media, info, media y media (`lib/agentes/detectores/conversion.ts:47-84`)—, así que no aparece hasta que
exista una. Su `gsub` del prototipo, «rompe el funnel · no espera al ciclo diario», es falso: las señales
las guarda la pasada de la mañana. Pasa a «detectada en la pasada de la mañana». Cada fila: `al-t` es el
texto, `al-d` la revisión, `al-m` «{Paso} · {fecha}», y «Ver evidencia →» abre el cajón del paso.

**La tarjeta** · `TarjetaDeSenales` va al final, como en Acquisition, con todo `puede` en falso cuando se
mira otra empresa.

**Estado** · El reparto por paso, `pasoDeLaSenal`, construido el 2026-10-08 (CV-2), y en la ruta desde ese día (CV-3): `senales.porPaso`, vigilado en `pruebas/base/237-las-senales-de-conversion.test.ts`. La pantalla lo dibuja desde el 2026-10-09 (CV-4): el pie de cada tarjeta, las observaciones de su cajón y la alarma. Es `CV15-P05`.

### CV15-20 · Las flechas contra la ventana anterior

**Qué es** · La ventana anterior es la del mismo largo, justo antes, y sólo existe con 7 y 30 días. Las
reglas son las del prototipo y las de A14-11: bajo 0,5 % se dibuja «=»; con la anterior en cero no hay
porcentaje; cada variación llega con su lectura —buena, mala o neutra— calculada en el servidor.

| cifra | compara si | si no |
|---|---|---|
| Contactos | el primer contacto es anterior al comienzo de la anterior, y las lecturas de contactos y de citas están al día | «Sin historia para comparar.» o «Faltan contactos por leer.», para todas las cifras de personas |
| Porciones y tasas sobre la cohorte | lo anterior, y las dos cohortes llegan al piso | «sin comparación» en esa cifra |
| Agendados, en conteo y en tasa | lo anterior; la anterior contada **a la misma edad**; y ninguna cita congelada entre sus contactos | «Los agendados no comparan: hay citas congeladas.» Hoy pasa en 30 días: 80 de los 447 contactos de la anterior tienen alguna |
| Vistas de Meta | por su cuenta, aunque las personas no comparen: el gasto entero en las dos ventanas, y el desglose completo en la anterior | «Faltan días de gasto.», «Falta gasto de algunas campañas.» o «Sin desglose de Meta.» |
| Formulario | nunca, mientras el campo esté muerto | — |
| Calificados, no calificados, confirmados y cancelaron | nunca | el descarte es una etiqueta sin fecha; la confirmación, un campo del CRM sin fecha |

**La diferencia con Acquisition, dicha** · Las cifras de personas no dependen del gasto, así que un gasto
incompleto apaga sólo la flecha de las vistas. En Acquisition apaga todo, porque sus costos dividen el gasto.

**Estado** · **Construido el 2026-10-08** (CV-2), en `lib/negocio/pasosDeConversion.ts`, y probado en `pruebas/codigo/246-pasos-de-conversion.test.ts` y `pruebas/base/246-pasos-de-conversion.test.ts`, cada regla con su mutación. La pantalla lo dibuja desde el 2026-10-09 (CV-4): con la ventana comparando, la cifra que no compara dice «sin comparación» en su lugar en las celdas de personas de la tira y en las métricas de las tarjetas; la cifra grande de cada tarjeta, la celda de las vistas y la caja del cajón no tienen lugar para la frase, y lo dicen la tira y la nota. Con «Hoy» o «Completo» lo dice sólo la nota.

### CV15-21 · Una sola ventana, la de Acquisition

**Qué es** · El cálculo de los bordes de la ventana —último día cerrado, anterior, colector atrasado— vivía
dentro de `lecturaDeAcquisition` (`lib/negocio/embudosDeAcquisition.ts:722-776@210ac73`). Desde el 2026-10-08
vive en un módulo compartido, `bordesDelPeriodo` (`lib/negocio/diasCerrados.ts:82-129`), y Acquisition lo usa: se
mudó, no se copió. La cohorte también es una sola expresión, `cohorteEntre` (`lib/negocio/recorrido.ts:214-217`):
la usan Acquisition y, desde CV-3, la ruta, el cerebro y el detector de Conversion.

**La invariante** · Con la misma ventana, la cohorte de Conversion es exactamente el `cobertura.sobre` de
Acquisition en 7 y en 30 días. La exige `pruebas/base/246-pasos-de-conversion.test.ts`, con un contacto en cada
borde de las dos ventanas.

**Estado** · **Construido el 2026-10-08** (CV-1): la función compartida, la expresión de la cohorte y la prueba de
la invariante. La ruta de Conversion corta con esa ventana desde el 2026-10-08 (CV-3).

### CV15-22 · El servidor calcula; el navegador dibuja

**Qué es** · Las tasas, las caídas, las variaciones y su lectura llegan calculadas en la respuesta de
`GET /api/conversion`. El navegador sólo dibuja, y multiplica por 100 en un solo lugar.

**Rastro** · Un módulo nuevo, `lib/negocio/pasosDeConversion.ts`, con dos mitades, como
`lib/negocio/embudosDeAcquisition.ts`:

- **una pura**, probada sin base: `armarPasos`, `variacionEnPuntos` y `pasoDeLaSenal`. Importa `tasa` y
  `variacion` de Acquisition (`lib/negocio/embudosDeAcquisition.ts:280-283` y `:307-316`), y no las copia;
- **una de lectura**, probada contra la base: una sola pasada por los contactos de la cohorte y la suma de
  las vistas. Compone `recorridoDelLead` y `embudoDelFormulario`, que reciben la ventana explícita, y no
  recalcula lo que ya calculan, con una excepción: en la ventana anterior, la pasada cuenta la cohorte junto con
  los agendados a la misma edad, para que la tasa salga de una sola foto.

**La respuesta crece, no cambia** · Siguen `comentario`, `periodo`, `recorrido`, `formulario`, `senales` y
`puedeConSenales`, ahora sobre la ventana cerrada. Se agregan `pasos` y `senales.porPaso` (CV-3), y `frescura` y
`formulario.completaron` (CV-4). Todo lo de `pasos` viaja
de 0 a 1: la `finalizacion`, que llega en %, se divide por 100 al consumirla; el `formulario` que viaja para su
cajón es el del embudo, con la `finalizacion` en %.

**Estado** · **El módulo, construido el 2026-10-08** (CV-2): `lib/negocio/pasosDeConversion.ts`, con sus dos pruebas, `pruebas/codigo/246-pasos-de-conversion.test.ts` y `pruebas/base/246-pasos-de-conversion.test.ts`. **La ruta lo usa desde el 2026-10-08** (CV-3): `GET /api/conversion` responde
también `pasos` y `senales.porPaso`.

### CV15-23 · El cerebro y el detector leen lo mismo

**Qué es** · Lo que se mide no se recalcula en ningún otro lugar:

- **El cerebro.** `recorrido_de_los_leads` y `formulario_de_la_landing`
  (`lib/agentes/executive/adaptadores/conversion.ts:45` y `:62`) pasan a la lectura única, con la zona de la
  empresa. Se agrega `pasos_de_conversion`, con las cifras de la tira y de las tarjetas. Ya promete días
  cerrados para 7 y 30 días (`lib/agentes/executive/adaptadores/comun.ts:65`), y deja de ser falso para
  Conversion. `TAREAS_POR_SECCION.conversion`
  (`lib/agentes/executive/adaptadores/plataforma.ts:32-42`) suma las citas y los anuncios.
- **El detector.** `medirConversion` (`lib/agentes/detectores/conversion.ts:116-130`) consume la misma
  lectura, como el de Acquisition. Así cumple AG-28, que pide 7 y 30 días cerrados
  (`lib/agentes/senales/tipos.ts:10-11`). La ventana anterior sale de la lectura y no del doble de días menos
  la actual.

**Estado** · **Construido el 2026-10-08** (CV-3): las tres herramientas leen `lecturaDeConversion` con la zona de la
empresa, `pasos_de_conversion` es nueva, y `pruebas/base/215-la-cifra-del-cerebro-es-la-de-la-pantalla.test.ts` exige
que sus cifras sean las de la pantalla; el detector mide con la misma lectura, y sin una anterior que compare el
cambio de ruta queda sin medición (`pruebas/codigo/236-el-detector-de-conversion.test.ts`,
`pruebas/base/237-las-senales-de-conversion.test.ts`). **Las señales de la pasada de la mañana cambian de ventana**:
de los días de calendario hasta hoy a los días cerrados.

### CV15-24 · Sin datos personales

**Qué es** · La pantalla no dibuja ningún dato de una persona:

- nunca la `url` ni el `referrer`, tampoco en un `title`. La familia sale sólo del host
  (`lib/negocio/recorrido.ts:334-343`), y la dirección entera puede llevar el nombre de la persona
  (`db/migraciones/048_de_donde_vino_el_lead.sql:94-99`, CV8-P01);
- la evidencia de las señales lleva sólo conteos (CV6-08);
- no vuelven los `data-leads`, que abrían un cajón con personas inventadas.

**Estado** · **Construido el 2026-10-09** (CV-4), y vigilado en `pruebas/codigo/247-la-pantalla-de-conversion.test.ts`.

### CV15-25 · El teléfono

**Qué es** · A 375 px las cinco tarjetas pasan a una columna, la tira a un panel por fila y el cajón ocupa el
ancho. Lo nuevo va en `app/conversion.css`. El panel 1, con tres celdas, puede quedar apretado en la columna
de `.cv-panels` (`app/aios.css:1985`): se mira en el navegador en CV-5.

**Estado** · **Las reglas, construidas el 2026-10-09** (CV-4) en `app/conversion.css`: entre el escritorio y el
teléfono las cinco tarjetas van en tres columnas, la tira en un panel por fila y sin las flechas; desde 760 px,
una tarjeta por fila, la fila del plan y del período al ancho —el segmentado parte sus botones en dos renglones
si no entra— y el cajón también. **Visto en el navegador el 2026-10-09** (CV-5): a 1440, 1180, 1125 y 375 px no
desborda nada, ni la pantalla ni los tres cajones; a 375 px el cajón ocupa el ancho y su rejilla va en dos columnas.

### CV15-26 · Los textos que pasan a ser falsos se corrigen en la misma etapa

**Qué es** · Lo que dice el código sobre la pantalla vieja deja de ser cierto con esta:

- **El hueco de Clarity** (`lib/negocio/embudoDelFormulario.ts:139-144@b2dcdf5`) decía que Clarity aparecía en la
  pantalla como fuente conectada. No aparece desde el 2026-09-20. Es el riesgo 2 de
  `docs/OTROS/estado actual/03-CONVERSION.md:473-477@b3ca9ad`.
- **Los encabezados** de la vista, del panel, de la ruta, de `lib/negocio/vistaDeConversion.ts` y del
  detector describen el reparto como bloque principal.
- **El comentario de `ventanaDeLaCohorte`** (`lib/negocio/recorrido.ts:187-200`): corregido el 2026-10-08 (CV-1); ya no dice que
  Conversion cruza sus contactos con el gasto.
- **Los comentarios de `app/inteligencia-estetica.css`** sobre las clases del recorrido.

**Estado** · **Corregido**: el comentario de la ventana en CV-1; la ruta, la vista de datos y el detector en CV-3; y
el hueco de Clarity, la vista, el panel y `app/inteligencia-estetica.css` el 2026-10-09 (CV-4). El hueco de Clarity
ya no se dibuja, pero viaja en `formulario.fueraDeAlcance` y lo lee el cerebro.

### CV15-27 · Lo que sale de la pantalla

- **El bloque «Lo que esta pantalla no puede medir».** Su lista —el VSL, las sesiones, el mapa de calor, la
  tasa de la landing, el abandono campo por campo— pasa a
  `docs/OTROS/futuro/lo-que-conversion-no-mide.md`, con lo que haría falta para cada una. En la pantalla, el VSL,
  el comportamiento y el mapa de calor del cajón de Landing y el abandono campo por campo quedan en su lugar del
  prototipo, con «Sin dato». Las sesiones y la tasa de la landing no tienen lugar propio: la base de los porcentajes
  son los contactos (CV15-05), y la celda «Visitas» pasó a «Contactos» y «Vistas de landing» (CV15-06).
- **El bloque «Cuánto vale lo que dice esta pantalla».** Pasa a la nota de una línea (CV15-10).
- **El filtro por dispositivo, la pastilla «Personalizado» y las bandas.** Decidido por el usuario.
- **Los chips «Clarity» y «VTurb».** Siguen fuera; en su lugar va «GoHighLevel» (CV15-03).
- **Los `data-leads`** (CV15-24).

---

## 4 · Lo que esto contesta de los otros documentos

| pregunta | respuesta |
|---|---|
| CV1-04 y CV3-02: la cadena sólo es un embudo con un solo camino | cinco tarjetas, cada porcentaje sobre la cohorte, la caída contra la cohorte y las flechas como decoración (CV15-11, CV15-16) |
| CV2-P01: con qué se calibran las bandas | no se dibujan, por ahora (CV15-11) |
| CV2-P02: el dispositivo | no, por ahora: 47 de 106 contactos traen `userAgent` (CV15-03) |
| CV2-15: confirmadas, canceladas y franja | confirmados y cancelaron sobre los calificados; la franja no se dibuja (CV15-17, CV15-18) |
| CV3-05: el contador de pasos fuera de rango | no se dibuja (CV15-11) |
| CV3-P02: si Gracias es de este departamento | queda como hueco en su lugar, sin cajón (CV15-13) |
| CV4-P01: cuántos cajones sobreviven | tres: Landing, Formulario y Agenda (CV15-17) |
| CV5-02: el botón encendido | el que contestó el servidor (CV15-04) |
| CV5-P01: una quinta ventana | no: el corte viaja con cada respuesta, y el formulario se publica «hasta el corte» (CV15-14) |
| CV6-P01: si una fricción es una entidad persistida | sí: son las señales de la tabla común, desde AG14, y se dibujan como observaciones (CV15-19) |
| CV8-P01: si la URL se puede dibujar | no, ni en un `title`: sólo el host, y sólo para clasificar (CV15-24) |
| CV9-08: la lista de borrado | «Plan de acción» volvió con AG14; los chips, «Personalizado» y los `data-leads` siguen fuera (CV15-27) |

---

## 5 · Cómo se construye

| etapa | qué | estado |
|---|---|---|
| CV-0 | Este documento, las respuestas en los otros, `docs/OTROS/futuro/lo-que-conversion-no-mide.md` y la medición del 2026-10-08 | **escrito el 2026-10-08**, para la revisión del usuario |
| CV-1 | Las piezas compartidas: `lib/negocio/diasCerrados.ts`, mudado desde Acquisition; los predicados de calificado, confirmó y cancelaron; la ventana explícita en `recorridoDelLead`, `embudoDelFormulario` y `corteDeEpoca`; la cohorte de Acquisition con la misma `cohorteEntre`, y la prueba de la invariante | **hecho el 2026-10-08** |
| CV-2 | El módulo `lib/negocio/pasosDeConversion.ts` y sus dos pruebas | **hecho el 2026-10-08** |
| CV-3 | La ruta, el cerebro y el detector | **hecho el 2026-10-08** |
| CV-4 | El front sobre el marcado del prototipo, `CajonDelPaso.jsx` y `app/conversion.css` | **hecho el 2026-10-09** |
| CV-5 | La comparación lado a lado contra el prototipo, el humo con login, el teléfono y la subida | **hecho el 2026-10-09**: la letra, los rellenos, los radios y los espacios, medidos en los dos, coinciden salvo los desvíos declarados (el panel 1 con tres celdas, las métricas en dos renglones); a 1180 px las cinco columnas miden lo mismo que en el prototipo; y el usuario revisó la pantalla en producción |

Cada etapa lleva sus pruebas vistas en rojo con su mutación. Las migraciones, si hiciera falta alguna, van a
producción antes del push.

---

## 6 · Preguntas abiertas

Cada una tiene una respuesta tomada por defecto, que es la que se construye si nadie dice otra cosa.

| id | pregunta | lo que se toma |
|---|---|---|
| `CV15-P01` | ¿«7 días» y «30 días» en días cerrados, aunque Creative siga con días de calendario? | sí (CV15-04) |
| `CV15-P02` | ¿El panel 1 con «Contactos» y «Vistas de landing», o sólo una celda como en el prototipo? | las tres celdas (CV15-06) |
| `CV15-P03` | ¿El formulario en «Completo» sobre la cohorte hasta el corte, o sobre la ventana entera? | hasta el corte, por la regla 2 (CV15-14) |
| `CV15-P04` | ¿Confirmados y Cancelaron sobre los calificados, o sobre los agendados? | los calificados (CV15-18) |
| `CV15-P05` | ¿Alguna regla `CNV-*` debería ser crítica, para que la alarma se use? | ninguna, por ahora (CV15-19) |
| `CV15-P06` | ¿Las vistas de Meta se publican en «Hoy»? | sí, como Acquisition publica sus clics (CV15-07) |
| `CV15-P07` | ¿Las familias de «No tocar» del plan van como «a favor» en el cajón de Landing? | sí (CV15-17) |
| `CV15-P08` | ¿El segundo `jmx` de Landing es «Por la landing» o «Directo a agendar»? | «Por la landing» (CV15-12) |
| `CV15-P09` | ¿`#cvWorst` no se dibuja, o dice «N pasos sin dato»? | no se dibuja (CV15-11) |
| `CV15-P10` | ¿«Confirmados» es la tasa sobre los que respondieron, como en Conversation (hoy 18 de 18, **100 %**), o sobre los calificados (18 de 35, 51 %)? | sobre los calificados: con 18 de 18 la tasa se lee como «todos confirmaron», y la mitad no respondió (CV15-18) |
