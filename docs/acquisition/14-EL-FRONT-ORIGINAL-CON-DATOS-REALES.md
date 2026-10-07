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
| Inversión | gasto de la ventana | `negocio.metricas_de_anuncio.gasto`, sumado por `anuncios.meta_campana_id`. Sólo de las campañas que el colector pide: las de la atribución y, desde AQ-3, las asignadas a un funnel y las que ya tienen anuncios guardados. De una campaña nueva entra lo que la pasada pide igual —hoy y los dos días que se releen—, no lo de antes |
| Entrada del funnel (Leads · DMs · Contactos) | contactos atribuidos a la campaña, dados de alta en la ventana | `contactos.atribucion_primera->>'campaignId'` y `alta_en_el_crm` |
| Clics a landing VSL | clics al enlace, **contados por Meta** | `metricas_de_anuncio.acciones->linkClick` |
| Completaron form (sólo Booking) | **hueco** | el campo «Form Landing VSL» dejó de escribirse el 2026-08-31 (`lib/negocio/embudoDelFormulario.ts:33-38`) |
| Agendados | contactos con alguna cita alcanzable | `tieneCitaAlcanzable` (`lib/negocio/citasAlcanzables.ts:135-145`) |
| Calificados | agendados sin etiqueta de descarte | `tieneCitaAlcanzable` y no `contactoDescartado` (`lib/negocio/citasAlcanzables.ts:157-161`) |
| ICP % y barra alto/medio/bajo | puntaje de los calificados | `contactos.score`, con los cortes de `lib/negocio/tramosDelIcp.ts` |
| Deltas | la misma cifra en la ventana anterior del mismo largo | el mismo cálculo, corrido una ventana antes, con los agendados a la misma edad (A14-11) |
| Nombre de la campaña | nombre en Meta | `negocio.campanas` (`065`), que el colector llena desde GoHighLevel (`lib/ghl/anuncios.ts:327`) |
| Nota bajo las cifras | cuántos leads traen campaña | `lib/negocio/embudosDeAcquisition.ts`, con la misma ventana que el resto de la pantalla (A14-12) |

---

## 3 · Los requisitos

### A14-01 · La estética es la del prototipo, sin capas encima

**Qué es** · La pestaña se dibuja con las clases del prototipo, y en su orden: `cre-head`, `acq-kpis`,
`acq-note`, `acq-fgrid` y las tablas por funnel. La `filterbar` del prototipo no se dibuja: su único
control era el segmentado de tasa, que quedó oculto (A14-09). Esas reglas siguen vivas en
`app/aios.css:1585-1725`, y son las que la visten. La sección **no lleva `estetica-op`**: esa capa, que entró en
`833fc51`, es la que cambió el look.

**Fórmula** · Lo nuevo —el selector de funnel, el texto de un hueco, el estado vacío, el teléfono— va en
una hoja propia, `app/acquisition.css`, acotada a `#v-acquisition` y en la capa `components`. Es el
método de Leads Portal (`app/leads-portal.css:1-12`): `aios.css` tiene que seguir siendo comparable
línea por línea contra el HTML del prototipo.

**Rastro** · El prototipo: `aios-command-center_1.html` (marcado en 2679-2744, reglas `acq-*` en
1671-1813, dibujo en 5482-5594).

**Estado** · **Construido el 2026-09-30** (AQ-4): `components/views/AcquisitionView.jsx`,
`components/acquisition/PanelDeAcquisition.jsx` y `app/acquisition.css`. `#v-acquisition` salió también
de los `:is()` de `app/inteligencia-estetica.css`, que pisaban el segmentado y el encabezado del
prototipo aun sin `estetica-op`. `pruebas/codigo/182-la-pantalla-de-acquisition.test.ts` lo vigila.

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
| la asignación de un funnel falló | «No se pudo guardar. Reintenta.» |
| la primera carga | «Cargando…» |
| falta algún día de gasto cerrado, o el colector está atrasado (`faltan_dias`, `gasto_incompleto`) | «Faltan días de gasto.» |
| todos los días tienen el total de la cuenta y el detalle por campaña todavía no lo explica (`gasto.motivo: no_cuadra`, A14-19) | «Falta gasto de algunas campañas.» |
| una campaña que nunca trajo un contacto con su campaña en la atribución: su pie, y el guion en sus etapas de personas (A14-19) | «Sin contactos atribuidos» |
| al pie de la Inversión, después del monto que gastaron esas campañas (A14-19) | «sin contactos atribuidos» |
| la ventana anterior no está entera (`sin_historia`) | «Sin historia para comparar.» |
| «Hoy» no publica costos (`sinCostos: hoy`) | «Hoy, sin costos.» |
| una campaña que GoHighLevel no listó, y que por eso no se puede asignar | «No figura en Meta» |

Las seis de abajo entraron al construir (AQ-4): sin ellas, un fallo al asignar, la primera carga, la
falta de flechas o de costos y la campaña que no se puede asignar se habrían visto como un guion sin
explicación. El motivo largo de cada una sigue en este documento, no en la pantalla. Lo que el servidor
dice cuando algo falla va en el `title`.

**Estado** · **Construido el 2026-09-30** (AQ-4): la lista vive en `FRASE`, en
`components/acquisition/PanelDeAcquisition.jsx`, y `pruebas/codigo/182-la-pantalla-de-acquisition.test.ts`
exige que las dos coincidan. La lista es cerrada: una frase nueva entra acá primero.

### A14-03 · El funnel de una campaña se asigna a mano

**Qué es** · Cada campaña pertenece a uno de los tres funnels del prototipo —Lead form ads, Profile
funnel, Booking directo— **porque alguien lo decidió**, y esa decisión se guarda.

**Fórmula** · Una tabla, `negocio.funnels_de_campana`, con la clave `(org_id, meta_campana_id)` y un
`check` sobre los tres valores. Tiene un solo escritor. La ruta es `PUT`/`DELETE /api/acquisition/funnel`,
con `credenciales.editar` y auditoría, igual que el link manual de Creative
(`app/api/creative/enlace/route.ts`).

**Por qué a mano** · Ninguna fuente automática separa los tres:
- el objetivo de Meta llega pero no alcanza: 11 de las 12 campañas son `OUTCOME_LEADS` y 1 `OUTCOME_ENGAGEMENT` (producción, 2026-09-30), así que Lead form ads y Booking directo salen iguales;
- `mediumId` parte una misma campaña en dos (P-04 de `01`);
- el nombre de la campaña no sigue ninguna convención.

Las campañas son pocas —12 en `negocio.anuncios` el 2026-09-28—, y quien las lanza sabe a qué funnel
van.

**Estado** · **Construido el 2026-09-30** (AQ-2): `db/migraciones/066_el_funnel_de_la_campana.sql`, `lib/negocio/funnelDeLaCampana.ts` y `PUT`/`DELETE /api/acquisition/funnel` (`app/api/acquisition/funnel/route.ts`). **El selector, construido el 2026-09-30** (AQ-4): va en el pie de cada campaña, sólo si el servidor
dice que la sesión puede asignar (`puedeAsignar`) y no se está mirando otra empresa, como el link manual
de Creative. Una campaña que GoHighLevel no listó no lleva selector: lleva «No figura en Meta».

### A14-04 · La entrada de cada funnel son los contactos de sus campañas

**Qué es** · La primera etapa es la gente que la campaña trajo en la ventana. Se rotula como en el
prototipo: «Leads» en Lead form ads, «DMs» en Profile funnel y «Contactos» en Booking directo
(`aios-command-center_1.html:5344-5356`).

**Fórmula** · Son los contactos cuyo `atribucion_primera->>'campaignId'` es una campaña del funnel y
cuyo `alta_en_el_crm` cae en la ventana. **Se identifica por id, nunca por nombre** (A1-10).

**Qué no es** · «DMs» no mide mensajes directos: la base no los registra (`03-COSTOS.md:80`). Es la
gente que trajo una campaña que alguien asignó a Profile funnel.

**Estado** · **Construido el 2026-09-30** (AQ-3): `lib/negocio/embudosDeAcquisition.ts`. Dibujado en AQ-4.

### A14-05 · «Clics a landing VSL» es una cifra de Meta, y no lleva tasa

**Qué es** · Los clics al enlace que Meta cuenta por anuncio (`linkClick`), sumados por campaña.

**Por qué sin tasa** · Son clics y no personas: una persona puede hacer tres. Una tasa «desde leads»
dividiría clics por personas y podría pasar el 100 %. La etapa dibuja su número, su costo por clic y
«según Meta». Las tasas de las etapas de personas saltan por encima de ella: los agendados se miden
contra la entrada.

**Rastro** · `db/migraciones/053_el_desglose_que_ya_llegaba.sql` guarda el desglose; Creative ya lo lee
(`lib/negocio/rendimientoDelCreativo.ts:95`).

**Fórmula** · La suma de `linkClick` de la ventana. Si en la ventana no llegó ningún desglose de
acciones, los clics son nulos —no se saben—; si llegó y no trae `linkClick`, son cero: ese tipo no
ocurrió. **Si nada entregó, son cero**: el proveedor omite el desglose cuando el anuncio no entregó, y
sin entrega no hay clics. **Si el desglose no cubre la ventana** —empezó el 2026-08-21, después que el
gasto—, los clics no se publican: serían los de una parte de la ventana. El costo por clic divide sólo el gasto de las filas con desglose: las filas
sin desglose gastaron, pero sus clics no se saben.

**Estado** · **Construido el 2026-09-30** (AQ-3).

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

**Estado** · Decidido el 2026-09-30; contesta P-1 y P-2 de `04`. **Construido el 2026-09-30** (AQ-3).

### A14-08 · El ICP de los calificados: promedio del puntaje y tres tramos

**Qué es** · El «ICP %» es el promedio de `contactos.score` de los calificados. La barra reparte a esos
calificados en alto, medio y bajo, con los cortes de Leads Portal: 75 y 50 (`lib/negocio/tramosDelIcp.ts`).

**Fórmula** · Un puntaje 0 o nulo es «sin calificar» (`lib/negocio/tramosDelIcp.ts:35-90`): **no entra en
el promedio ni en la barra**. El promedio se publica desde diez calificados con puntaje
(`PISO_DE_UNA_TASA`), igual que el ICP por pieza de Creative; debajo, «—».

**Por qué no los pesos 100/60/25 del prototipo** · Nadie los justificó e imponen un piso de 25 % (A4-13).
El promedio del puntaje no necesita pesos (P-4 de `04`).

**Estado** · Contesta P-4, P-5 y P-6 de `04`. **Construido el 2026-09-30** (AQ-3).

### A14-09 · Costos y tasas, con el piso de siempre

**Qué es** · Cada etapa lleva su costo (`inversión / etapa`) y, si es de personas, su tasa contra la
etapa anterior de personas.

**El segmentado «Tasa: Paso a paso / Acumulada» del prototipo NO se dibuja por ahora**, decidido por el
usuario el 2026-09-30. Con los clics fuera —no son personas (A14-05)— y «Completaron form» sin dato
(A14-06), la etapa anterior de personas es siempre la entrada, y las dos tasas darían el mismo número:
un control que no cambia nada. Vuelve el día que una etapa las haga diferir —la del formulario, si
vuelve a tener dato—, y con él la tasa acumulada (A2-27).

**Fórmula** · Los costos de personas —por contacto, por agendado, por calificado— se pagan con la **inversión
con contactos**, la de las campañas que trajeron algún contacto atribuido; el costo por clic, con el gasto con
desglose de Meta (A14-19). Una tasa con denominador bajo `PISO_DE_UNA_TASA` (10,
`lib/negocio/indicadoresDeCitas.ts:309`) se dibuja «—». Un costo con la etapa en cero también, y **un
costo de una ventana sin inversión**: con la pauta parada llegan contactos de lo que se gastó antes, y
«$0 por contacto» diría que salieron gratis. En «Hoy» no hay costos: el gasto de hoy es una foto de la
madrugada —se lee a las 06:17 UTC— y los contactos son del día entero. **Y en ningún período hay costos
si el gasto de la ventana no está entero** —un día sin gasto cerrado, contactos de antes del primer
gasto, o el colector atrasado (A14-10)—: el costo por contacto saldría bajo y se leería como un
dato.
Por qué no hay costos viaja en `sinCostos` (`hoy` o `gasto_incompleto`), para que la pantalla lo pueda
decir.

**Estado** · **El cálculo, construido el 2026-09-30** (AQ-3): llega una tasa por etapa (A14-17).
Dibujado en AQ-4, sin el segmentado. Un costo por debajo de diez dólares se dibuja con dos decimales: el
costo por clic real anda en centavos, y el redondeo del prototipo lo dibujaba «$0».

### A14-10 · Los cuatro períodos del sistema, y qué días abarcan

**Qué es** · El segmentado del encabezado ofrece Hoy · 7 días · 30 días · Completo
(`lib/negocio/periodo.ts:83-96`), y abre en 30 días (`:109`). «Personalizado» no se dibuja.

**Fórmula** · Días de calendario, con el `current_date` de la base; el gasto por su `fecha` y los
contactos por el día de su alta. Y, decidido por el usuario el 2026-09-30 después de la revisión de
AQ-3:

- **«7 días» y «30 días» son días CERRADOS**: los 7 o 30 días completos hasta el último día que el
  colector ya releyó DESPUÉS de que terminó, como en el Administrador de anuncios de Meta. Desde la `076` lo
  que se relee es el **total de la cuenta** de ese día (`negocio.gasto_de_la_cuenta`), y el día está entero
  cuando además el detalle por campaña cuadra con él (A14-19). El total de
  un día se lee a las 06:17 UTC de ese día y se relee a la misma hora del siguiente —medido en
  producción, sobre las métricas: cada día del 2026-09-26 al 09-29 se releyó al día siguiente a las 06:19 UTC—, así que
  **ayer recién está cerrado después de la pasada de hoy**, y si una pasada se perdió, anteayer tampoco.
  «Terminó» es a la medianoche de la empresa (`zona_horaria`; ARIA, America/Lima), la mejor
  aproximación a la de la cuenta de Meta, que la API no dice. En una empresa al oeste de UTC−6 su
  medianoche cae después de las 06:17 UTC, así que ni la relectura cierra el día: la ventana termina un
  día antes, y eso no es atraso. La ventana se exige con TODOS sus días cerrados. **El atraso se mide
  por la última escritura y por días**: si el colector no escribe hace más de 26 horas, o si el último
  día cerrado quedó más de tres días atrás —escribir no es cerrar, y tres es el peor caso normal, al
  oeste de UTC−6 antes de la pasada—, la ventana termina ayer y no compara ni publica costos.
  **El límite que había, cerrado con la `076`**: un día que nunca se releía después de terminar quedaba
  abierto para siempre, porque el colector no volvía a pedir un día que ya tenía filas. Ahora el relleno
  de cada hora vuelve a pedir el total de la cuenta de los días que no lo tienen cerrado, desde anteayer
  hacia atrás. Una ventana con un día a medias compararía seis días y medio contra siete cerrados: la
  flecha bajaría siempre, en rojo, con el negocio igual;
- **«Hoy» es hoy**, a medias: no compara y no publica costos (A14-09);
- **«Completo» es todo lo guardado**: empieza en el primer dato —gasto o contacto con campaña, el más
  viejo— y termina hoy. Su gasto se exige entero hasta el último día cerrado: hoy, a medias, no cuenta
  para eso, y así los costos no desaparecen de noche.

**La diferencia con el resto del sistema, dicha** · Creative y `costoDelAnuncio` terminan sus ventanas
hoy, así que «7 días» puede dar otra cifra en Creative que acá. Es la contrapartida de que acá las
flechas y los costos no carguen el día a medias.

**Estado** · Contesta P-01 de `05`. **El cálculo, construido el 2026-09-30** (AQ-3). **El «Riesgo 2» del
estado actual —un «Hoy» con dos significados en la misma pantalla— quedó cerrado en AQ-4**: el monitor
de `calidadDeLaAtribucion` —24 horas móviles por día— salió de la pantalla y de la ruta (A14-15), y el
segmentado de esta pantalla no lleva el matiz de «Hoy» de `periodo.ts`, que es el de las otras
pantallas. La ventana real se lee debajo de la Inversión: «23 sep – 29 sep».

### A14-11 · Los deltas contra la ventana anterior

**Qué es** · Las cantidades y la Inversión llevan su `dlt` contra la ventana anterior del mismo largo,
justo antes. Los calificados, por ahora no (ver abajo).

**Fórmula** · Las reglas del prototipo:
- en «Hoy» y en «Completo» no se compara (`aios-command-center_1.html:5464`);
- bajo 0,5 % se dibuja «=» (`:5469`);
- se empareja por la clave de la campaña y no por su posición (A1-15).

Y las que los documentos pedían, o que salieron de la revisión de AQ-3:
- **las dos ventanas tienen que estar enteras**: cada día con el total de la cuenta releído después de
  terminar, y el detalle por campaña cuadrando con él (A14-10, A14-19). Un día sin el total de la cuenta es
  un día que nadie pidió; uno con filas que no cuadra —la cuenta dice 200 y por campaña se leyó 0— tampoco
  cuenta. Hasta la `076` bastaba con que el día tuviera filas, y así se escondió la fuga. Si falta uno en la ventana
  actual, «sin comparación» (`faltan_dias`); si falta en la anterior, o los contactos empiezan después
  de ella, también (`sin_historia`). Una ventana anterior guardada a medias achica el
  denominador, y la flecha sube contra días que nadie guardó (P-04 de `05`);
- **los clics comparan sólo si el desglose cubre la anterior**: empezó después que el gasto (la `053`);
  sin él, se apaga sólo la flecha de los clics;
- **los agendados de la anterior se cuentan a la MISMA edad**: sus contactos llevan 7 o 30 días más en la
  base, así que sólo cuentan las citas reservadas antes de esa edad (`reservada_el`, la `043`; sin ella,
  el inicio de la cita, que es posterior a la reserva). Sin eso, la flecha de los agendados bajaría siempre;
- **los calificados no llevan flecha, por ahora**: las etiquetas de descarte no tienen fecha, así que la
  anterior tuvo días de más para recibirlas y sus calificados saldrían más bajos —la flecha subiría
  siempre, en verde—. Vuelve el día que se guarde cuándo se pone cada etiqueta de descarte;
- **en los costos, bajar es bueno** (P-06 de `05`). El prototipo no les dibuja flecha, así que hoy no
  llevan variación; si algún día la llevan, el color va invertido;
- **la Inversión lleva flecha sin color**, porque subir no es bueno ni malo (P-07 de `05`). La del total
  compara el total de la cuenta contra el de la cuenta (A14-19). El límite que había —una campaña recién
  asignada a un funnel entraba con su gasto desde dos días antes de la primera pasada que la pedía— se cerró
  con la `076`: el colector pide todas las campañas de la cuenta, y el relleno trae su gasto hacia atrás;
- **con la anterior en cero no hay porcentaje**, y con la actual en cero sí: es una caída del 100 %. El
  prototipo se guardaba también de la actual en cero (`if(!prev || !cur)`), y A5-16 de `05` pide sólo la
  guarda del denominador.

Cada variación llega con su lectura —buena, mala o neutra— calculada en el servidor (A14-17).

**Estado** · **El cálculo, construido el 2026-09-30** (AQ-3); dibujado en AQ-4. Los calificados de las
tablas dicen «sin comparación», como el prototipo cuando no había delta.

### A14-12 · La nota de cobertura, en una línea

**Qué es** · El párrafo `acq-note` del prototipo pasa a decir, en una línea, cuántos leads de la ventana
traen campaña: «N de M leads traen campaña». La regla 10 del estado actual pide que la cobertura vaya
arriba de la tabla, y ahí queda.

**Rastro** · La cuenta `lib/negocio/embudosDeAcquisition.ts`, con la MISMA ventana de días de calendario que el resto de la pantalla
(A14-10). El plan decía sacarla del punto `sin_campana` de `lib/negocio/calidadDeLaAtribucion.ts`, y se
descartó al construir: ese monitor cuenta los contactos en una ventana MÓVIL de 24 horas por día, así que
la nota y la cifra de Contactos habrían hablado de dos poblaciones distintas con el mismo «7 días» arriba.
El monitor salió de la pantalla en AQ-4 (A14-15). La línea suma por qué faltan flechas o costos
cuando faltan, con las frases de A14-02.

**Estado** · **Construido el 2026-09-30** (AQ-3).

### A14-13 · La campaña se nombra con su nombre de Meta

**Qué es** · La fila de la tabla muestra el nombre de la campaña y su estado.

**Fórmula** · Se guardan en `negocio.campanas` (migración `065`), que llena el colector de anuncios con
`estructuraDeAnuncios` en el nivel `CAMPAIGN`, al principio de cada pasada: desde la `076` es el universo de
campañas que el colector pide. Una campaña sin nombre se guarda
con el nombre nulo —no con uno inventado— y se muestra con su id. El nombre se conserva si una lectura
no lo trae; el estado es la foto de la última lectura.

**Estado** · **Construido el 2026-09-30** (AQ-1): `db/migraciones/065_las_campanas.sql` y
`lib/negocio/recolectarAnuncios.ts`. Un fallo del proveedor no tumba la pasada y queda en el sello del
cron.

### A14-14 · «Sin funnel» es un grupo más, al final

**Qué es** · Las campañas sin asignar se listan al final, con el selector de funnel para quien puede
asignar. Sus cifras no entran en las tres tarjetas, pero **sí en las cinco cifras de arriba**, que suman
todo lo que la pauta trajo. Desde la `076` la Inversión de arriba es la de toda la cuenta (A14-19).

**Estado** · **El cálculo, construido el 2026-09-30** (AQ-3): `sinFunnel` y el total de todas las
campañas. Dibujado en AQ-4: es la última tabla, y abre desplegada mientras tenga campañas —las otras
abren como en el prototipo, Lead form ads desplegada y las demás plegadas—, decidido por el usuario el
2026-09-30. Por eso la cifra de Contactos de arriba dice «todas las campañas» y no «los 3 funnels».

### A14-15 · Lo que sale de la pantalla

- **La tabla por anuncio.** El prototipo muestra campañas; el detalle por pieza está en Creative.
- **La tarjeta del monitor de atribución.** La nota de cobertura no sale de ella: es una cuenta propia de
  los funnels, con la misma ventana que el resto (A14-12). **Decidido por el usuario el 2026-09-30:** el
  módulo `calidadDeLaAtribucion` queda **dormido**, con sus pruebas, y sale también de la ruta, que lo
  calculaba en cada carga para nadie. Cómo volvería: `docs/OTROS/futuro/monitor-de-atribucion.md`.
  `GET /api/acquisition` responde `{ periodo, embudos, puedeAsignar }`; `costoDelAnuncio` sigue vivo
  porque lo usa Creative.
- **El botón «Plan de acción» y la tarjeta «Señales detectadas».** Se dejan para la etapa de los agentes
  de IA (A14-16).
- **Los `data-leads` del prototipo.** Abrían un cajón con personas inventadas (`lib/aios/leads-group.js`).

### A14-16 · Plan de acción y Señales, para los agentes de IA

**Qué es** · Las dos piezas vuelven cuando haya agentes que las produzcan, con el esquema de alerta
del § 18.13 y la separación entre detectar y recomendar que `06` ya desarmó.

**Estado** · Postergado el 2026-09-30. Plan en `docs/OTROS/futuro/plan-y-senales-de-acquisition.md`.

### A14-17 · El servidor calcula; el navegador dibuja

**Qué es** · La tasa de cada etapa —una sola, ver A14-09—, los costos, las variaciones y su lectura
llegan ya calculados en la respuesta de `GET /api/acquisition`. El prototipo los calculaba en el navegador; acá
no se puede sin duplicar reglas: el piso de las tasas vive en un módulo que importa la base, y copiar el
número sería una segunda definición del mismo piso.

**Rastro** · `lib/negocio/embudosDeAcquisition.ts`, en dos mitades: una pura —`armarEmbudos`, `armarGrupo`, `tasa`, `costo`,
`variacion`—, probada sin base en `pruebas/codigo/181-embudos-de-acquisition.test.ts`, y la lectura,
probada contra la base en `pruebas/base/181-embudos-de-acquisition.test.ts`.

**Estado** · **Construido el 2026-09-30** (AQ-3).

### A14-18 · Qué campañas se listan, y en qué orden

**Qué es** · Se listan todas las campañas con anuncios guardados, con contactos atribuidos alguna vez o
con un funnel asignado, **no sólo las de la ventana**: con la pauta parada, una ventana de siete días no
tendría ninguna, y no habría a quién asignarle un funnel. Una sin actividad en la ventana sale en cero.

**Fórmula** · Se ordenan por inversión, después por contactos y después por identificador: el gasto es
el hecho, y el desempate fijo hace que dos campañas iguales no cambien de lugar entre lecturas. Una
campaña que GoHighLevel no listó —`conocida: false`— va a «Sin funnel» con sus contactos contados, y no
se puede asignar (la foránea de la `066`).

**Estado** · **Construido el 2026-09-30** (AQ-3).

### A14-19 · Inversión e inversión con contactos

**Por qué existe** · El 2026-10-07 la pantalla decía 0 de inversión en 7 días y el Administrador de anuncios de
la misma cuenta 200,19; en 30 días, 865,58 contra 2.234,55. El colector pedía sólo las 13 campañas que nombraba
nuestra atribución, y la que gastó en la semana era una campaña de mensajes: sus contactos llegan como
`instagram` o `facebook`, sin `campaignId`, así que no podía entrar nunca. Y nadie lo vio porque un día con
filas se daba por entero, y las filas nulas de las campañas pausadas tapaban a la única que gastó.

**Qué es** · Dos inversiones, cada una con un solo uso:

- **La Inversión** es lo que Meta cobró en toda la cuenta en la ventana, de todas las campañas, crucen o no con
  contactos: la serie diaria de la cuenta (`negocio.gasto_de_la_cuenta`, la `076`), igual al Administrador de
  anuncios. Es la de las cinco cifras de arriba y la de la economía del cerebro, porque las ventas no se
  atribuyen a una campaña. Las filas, los funnels y la concentración suman el gasto por campaña.
- **La inversión con contactos** es la de las campañas que alguna vez trajeron un contacto con su
  `campaignId` en `atribucion_primera`. Es el único numerador de los costos de personas —por contacto, por
  agendado, por calificado—, en la campaña, en el funnel y en el total. El costo por clic sigue siendo de Meta.

La diferencia se publica al pie de la Inversión: «$X sin contactos atribuidos». Ahí entra el gasto de las
campañas sin contactos y, mientras el relleno busca, el que la cuenta cobró y ninguna campaña leída explica
todavía.

**El criterio es por evidencia y no por objetivo de Meta**: una campaña de mensajes también puede tener objetivo
de leads, y once de doce campañas lo tenían (A14-03). Una campaña sin contactos atribuidos dibuja «—» en sus
etapas de personas, con «Sin contactos atribuidos» al pie: no se sabe cuánta gente trajo, y un 0 diría que no
trajo a nadie. Un límite: una campaña de leads nueva, antes de su primer contacto, tampoco paga costos.

**El gasto entero** · Un día está entero cuando tiene el total de la cuenta releído después de terminar y el
detalle por campaña cuadra con él, con una tolerancia de diez centavos, o cuando se declaró residuo: gasto que
ninguna campaña listada explica, por ejemplo de una campaña borrada. Se distinguen tres ceros: el medido —la
cuenta dijo 0—, el no pedido —no hay total de la cuenta, «Faltan días de gasto.»— y el parcial —la cuenta dice
200 y por campaña se leyó 0, «Falta gasto de algunas campañas.»—. El motivo viaja en `gasto.motivo`
(`colector_atrasado`, `dias_sin_leer`, `no_cuadra`).

**Rastro** · `lib/negocio/gastoDeLaCuenta.ts` (el cuadre, la cobertura), `lib/negocio/recolectarAnuncios.ts`
(la pasada diaria), `lib/negocio/rellenarAnuncios.ts` (el relleno de cada hora) y
`lib/negocio/embudosDeAcquisition.ts` (`inversionConContactos`, `gasto`).

**Estado** · **Construido el 2026-10-07.** La atribución de los mensajes —cuántos DMs trajo cada campaña— queda
fuera: hoy ningún contacto de mensajes trae su campaña.

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
| AQ-1 | Los nombres de las campañas: migración `065_las_campanas.sql` y el colector | hecho, 2026-09-30 |
| AQ-2 | El funnel de cada campaña: migración `066_el_funnel_de_la_campana.sql`, escritor y ruta | hecho, 2026-09-30 |
| AQ-3 | El cálculo, `lib/negocio/embudosDeAcquisition.ts`, y la ruta `/api/acquisition` | hecho, 2026-09-30 |
| AQ-4 | El front sobre el marcado del prototipo, y `app/acquisition.css` | hecho, 2026-09-30 |
| AQ-5 | La comparación lado a lado contra el prototipo, y a producción. Antes del humo, `negocio.campanas` tiene que tener filas: la llena la primera pasada del colector (06:17 UTC), y hasta entonces toda asignación da 404 | **a producción el 2026-10-01** (UTC), con la `065` y la `066` aplicadas antes del push. **La comparación en el navegador quedó para el humo con login**, decidido por el usuario: nadie miró la pantalla con datos antes de subirla, y lo que salga de ahí es un cambio aparte |

## 6 · Preguntas abiertas

| id | pregunta |
|---|---|
| `A14-P01` | Si una campaña puede pertenecer a dos funnels. Hoy no: una fila, un funnel |
| `A14-P02` | Quién asigna. Hoy, quien tiene `credenciales.editar` (el administrador) |
| `A14-P03` | Si la pantalla avisa cuando aparece una campaña nueva sin asignar |
