# Acquisition Intelligence
> Corte: **2026-10-18**, con el código de producción, `972972e` (migraciones hasta la `078`). Las cifras de
> producción se midieron el **2026-10-18 entre las 15:30 y las 15:45 UTC** con
> `node --env-file=.env.supabase scripts/supabase.mjs leer`, sólo conteos y agregados, con el OK del usuario; las
> que no se volvieron a medir llevan su fecha vieja. **Nadie abrió la pantalla con sesión para este corte**: lo que
> «dibuja» cada bloque está deducido del código sobre esas cifras. Cada afirmación lleva su `archivo:línea`. Para
> ubicar lo nombrado, ver [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md). La versión anterior —el corte del
> 2026-09-28, con la tabla por anuncio y el monitor de atribución en pantalla— se lee con
> `git show 972972e:"docs/OTROS/estado actual/01-ACQUISITION.md"`, y la del 2026-09-15 con
> `git show 93a1341:"docs/estado actual/01-ACQUISITION.md"`.

**El front del prototipo, con los datos reales, desde el 2026-09-30.** La pestaña vuelve al marcado de
`aios-command-center_1.html`: cinco cifras, una nota de cobertura, tres funnels —Lead form ads, Profile funnel,
Booking directo— y una tabla plegable por funnel, más «Sin funnel». La campaña entra a un funnel **porque alguien
la asigna a mano**, y en producción **no hay ninguna asignada**: las 29 campañas que la pantalla lista caen en «Sin
funnel» y las tres tarjetas dicen «Sin campañas asignadas». La Inversión es, desde la `076` (2026-10-07), la de
**toda la cuenta de Meta**, igual al Administrador de anuncios: la fuga que la escondía —el colector pedía 13 de 61
campañas— está cerrada. Lo que esa cifra cuenta hoy es una pauta casi parada: **626,06 en los 30 días cerrados
hasta el 2026-10-17 y 1,20 en los últimos 7**, todo en dos campañas que nunca trajeron un contacto con su campaña
atribuida, así que no hay un solo costo por contacto que publicar. El Plan de acción y las Señales volvieron con
los agentes (AG9, 2026-10-05): hay **cuatro señales abiertas**, todas del monitor de atribución, y una de ellas —la
de UTM incompletas— era falsa por el defecto que la foto anterior ya había medido (corregido en `65669f4`, § 7).

> **Desde el corte del 2026-09-28**
>
> - **2026-09-30 · `8ff8d9d`** — AQ-0: el usuario decide volver al front del prototipo con los datos reales. Nace
>   `docs/acquisition/14-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md` (requisitos `A14-01` a `A14-19`).
> - **2026-09-30 · `fd553b7`** — AQ-1: los nombres y el estado de las campañas, en `negocio.campanas` (`065`).
> - **2026-09-30 · `e77d31f`** — AQ-2: el funnel de cada campaña, asignado a mano (`066`,
>   `negocio.funnels_de_campana`) y su ruta `PUT`/`DELETE /api/acquisition/funnel`, auditada.
> - **2026-09-30 · `4365cc9`** — AQ-3: `lib/negocio/embudosDeAcquisition.ts`, los tres funnels sobre días cerrados.
> - **2026-09-30 · `ba60560`** — AQ-4: la pantalla nueva y `app/acquisition.css`. La tabla por anuncio y el monitor
>   de atribución salen de la pantalla y de la ruta; el monitor queda dormido.
> - **2026-09-30 · `43ce5ac`** — AQ-5: a producción el 2026-10-01 (UTC), con la `065` y la `066`. La comparación en
>   el navegador quedó para el humo con sesión del usuario.
> - **2026-10-01 · `4e9a242`** — E7 de la nueva estructura: la maqueta del Executive se va, y con ella todo lo que
>   publicaba en nombre de Acquisition (§ 3).
> - **2026-10-01/02 · `4742d74`, `b532a78`, `40f699a`, `624a941`** — E8 a E11: Acquisition pasa al departamento
>   Systems de la barra nueva, y la pantalla gana la cabecera del departamento.
> - **2026-10-04/05 · `ce8ff6e`, `13723a0`, `5f15c01`** — AG5 a AG7: el cerebro, la herramienta
>   `embudos_de_acquisition`, la ruta `app/api/acquisition/cerebro/route.ts` y la caja del pie.
> - **2026-10-05 · `d715b2a`** — AG8: las señales, los planes y los umbrales (`072`), y la tarea `senales`.
> - **2026-10-05 · `dba4f80`, `fb9c1dd`, `895a3b8`, `e973a11`, `bfda59d`, `7e1adc4`, `91a5edb`, `52c1630`,
>   `59320b0`, `10bbe80`** — AG9: el detector de Acquisition con catorce reglas, su plan, las rutas de señales y
>   umbrales, el plan y las señales en la pantalla, y la redacción del plan con el modelo.
> - **2026-10-06 · `d8effd3`, `fe727e5`** — AG15: la Reunión de hoy toma temas de Acquisition, y el comentario de la
>   cabecera llega con la pantalla.
> - **2026-10-07 · `d17e029`** — el día de la empresa, diagnosticado y dejado para después (§ 7, riesgo 6).
> - **2026-10-07 · `22ec755`** — `076`: el gasto de toda la cuenta, `negocio.lecturas_de_gasto` y la tarea
>   `anuncios_relleno`. La Inversión pasa a ser la de la cuenta y los costos de personas se pagan con la de las
>   campañas con contactos.
> - **2026-10-08 · `71c71b8`** — CV-1 de Conversion: los días cerrados se mudan a `lib/negocio/diasCerrados.ts` y
>   «calificado» pasa a una sola expresión, `esCalificado`, compartida con Conversion.
> - **2026-10-11 · `a54d80e`** — CF-4 de Creative reapunta citas de esta foto.
> - **2026-10-15 · `cce2d56`, `972972e`** — Meta directo, listo y dormido (`078`): no cambia esta pantalla (§ 5).
> - **Construido en local, sin subir (`693a383..dc84cb2`, 2026-10-16)** — la Fase 0 del modelo de datos
>   multiempresa. Las seis tablas de Acquisition y `negocio.contactos` reciben una `cuenta_id` obligatoria
>   (`db/migraciones/082_la_cuenta_en_negocio_expandir.sql:124-127`) y `senales` y `planes_de_accion`, una opcional
>   (`:129-131`); `conOrganizacion` abre todas las cuentas (`lib/datos/contexto.ts:208`). Ninguna línea de la
>   pantalla, la ruta o el cálculo cambia. Espera la aprobación de un ingeniero.

---

## 1 · Qué pide el documento

El § 18 vive fuera del repositorio, en las descargas del usuario (1.650 líneas; el § 18 va de la 1.124 a la
1.650, comprobado el 2026-09-28; no se volvió a abrir). La carpeta `docs/acquisition/` lo resume con detalle y acá
sólo va lo que la foto necesita:

- **Misión y límite (§ 18.1, § 18.8, § 18.10).** Explica qué pasa dentro de Meta; no decide qué anuncio genera más
  dinero, porque eso cruza ICP, agendas, ventas y revenue. Nueve «no es responsable de» y nueve acciones que
  requieren validación ejecutiva (`docs/acquisition/12-QUIEN-DECIDE-QUE.md:10`, `:69`). El detector las respeta:
  la concentración y la escala tocan presupuesto y van a «Requiere validación ejecutiva»
  (`lib/agentes/detectores/acquisition.ts:135`, `:132`, `lib/agentes/plan/acquisition.ts:41-42`).
- **Seis componentes (§ 18.3)**: Meta Data Collector, tres analizadores, Anomaly & Fatigue Detector y Attribution
  Monitor (`docs/acquisition/11-LOS-SEIS-COMPONENTES.md:9`). Desde AG9 el detector existe, y el monitor vive dentro
  de él como cinco reglas (`lib/agentes/detectores/acquisition.ts:86-92`).
- **Datos de Meta (§ 18.4)**, guardados «por fecha para permitir comparaciones históricas»
  (`docs/acquisition/10-LO-QUE-PIDE-EL-DOCUMENTO.md:65`).
- **La regla que hace honesto al departamento (§ 18.5)**: puede informar sobre Meta con la atribución incompleta,
  pero no presentar como definitivas conclusiones sobre citas, ventas o revenue; y no recalcula revenue, CAC ni
  ROAS (§ 18.6).
- **25 KPI en cinco grupos (§ 18.7)** (`docs/acquisition/10-LO-QUE-PIDE-EL-DOCUMENTO.md:140-166`).
- **La alerta de catorce campos (§ 18.13)** y **los siete puntos del Attribution Monitor (§ 18.14)**
  (`docs/acquisition/11-LOS-SEIS-COMPONENTES.md:148`, `:182`). La alerta es hoy `negocio.senales`
  (`db/migraciones/072_las_senales.sql:36`).
- **Tres vistas por rol (§ 18.15)** y el reporte para Executive (§ 18.17), cuyo ejemplo dice «91 % de leads con
  meta_ad_id válido».
- **Diez pendientes técnicos (§ 18.19)** (`docs/acquisition/10-LO-QUE-PIDE-EL-DOCUMENTO.md:189-202`). El 1
  (confirmar campos) está medido uno por uno (`lib/ghl/anuncios.ts:62-74`); el 2 (frecuencia) es una pasada diaria
  a las 06:17 UTC que relee hoy y los dos días anteriores (`lib/negocio/barrido.ts:289`,
  `lib/negocio/recolectarAnuncios.ts:62`) más un relleno cada hora (`lib/negocio/barrido.ts:323`); el 3 (guardar
  por día) es `negocio.metricas_de_anuncio` (`db/migraciones/050_lo_que_costo_cada_anuncio.sql:230-232`) y, desde
  la `076`, el total diario de la cuenta (`db/migraciones/076_el_gasto_de_toda_la_cuenta.sql:23`); el 4 tiene los
  dos toques pero no su historia; el 5 (UTM) lo mide el monitor (su defecto, cerrado, en el § 7, riesgo 2); el 6 y el 7 están
  medidos salvo las ventas, que no existen; el 8 y el 9 no tienen nada construido, y el 10 (separar detectar de
  recomendar) está construido: el detector sólo detecta y el plan sale de plantillas (§ 2).

---

## 2 · Qué hay hoy en pantalla

**La sección.** `acquisition`, capacidad `tablero.ver`, sin `sinOperacionesTodavia`
(`lib/autorizacion/secciones.ts:264-272`). En la barra nueva vive en el departamento Systems, junto a Conversion y
Conversation (`lib/autorizacion/departamentos.ts:90-92`).

**La vista.** `components/views/AcquisitionView.jsx` monta el panel sin la capa `estetica-op`, para que manden las
reglas del prototipo (`components/views/AcquisitionView.jsx:10-13`, `:18-25`). Lo nuevo va en `app/acquisition.css`,
acotado a `#v-acquisition`.

**La ruta.** `GET /api/acquisition` pide `tablero.ver` (`app/api/acquisition/route.ts:52`), rechaza el período que
no está en la lista (`:58-59`) y, en una sola `conOrganizacion`, lee los embudos, las señales de la ventana, el
último plan, las reglas y el comentario de la cabecera (`:66-80`). Las señales sólo existen en «7 días» y «30 días»
(`:65`). Devuelve `puedeAsignar` —quien tiene `credenciales.editar`— (`:93`) y lo que la sesión puede hacer con las
señales, todo falso mirando otra empresa (`:98-102`). Ya no publica la tabla por anuncio ni el monitor (`:23-33`).
`vistaDeAcquisition.ts` pide y no calcula (`lib/negocio/vistaDeAcquisition.ts:47-59`).

**El panel** (`components/acquisition/PanelDeAcquisition.jsx`), de arriba abajo:

1. **El encabezado**: «Acquisition», el botón «Plan de acción» (`components/acquisition/PanelDeAcquisition.jsx:205`) y el segmentado de cuatro períodos, sin
   «Personalizado» y sin el matiz «las últimas 24 horas» de las otras pantallas, porque acá «Hoy» es el día de
   calendario (`:230-249`). El botón encendido es el que contestó el servidor (`:210`).
2. **Cinco cifras** (`Cifras`, `:315-351`): Inversión, Contactos («todas las campañas»), Clics a landing VSL
   («según Meta»), Agendados y Calificados con su costo. Debajo de la Inversión va la ventana real —«18 sep – 17
   oct»— y, si la hay, la inversión «sin contactos atribuidos» (`:321-330`).
3. **La nota** (`Nota`, `:357-380`): «N de M leads traen campaña», y por qué faltan flechas o costos con las frases
   de la lista cerrada (`:79-100`).
4. **Tres tarjetas de funnel** (`Tarjeta`, `:383-465`): inversión, calificados y costo por calificado, y cada etapa
   con su barra, su tasa contra la entrada, su costo y, bajo los agendados, los calificados con el ICP promedio y
   la barra alto/medio/bajo (`:441-458`).
5. **Las tablas plegables**, una por funnel y «Sin funnel» al final, abierta mientras tenga campañas (`:474-477`).
   Cada campaña dice su estado en Meta y, para quien puede asignar y no mira otra empresa, lleva el selector de
   funnel (`:636-683`); la que GoHighLevel no listó dice «No figura en Meta» y no se asigna (`:642-647`). Una
   campaña que nunca trajo un contacto con su campaña dibuja «—» en sus etapas de personas, no 0 (`:592-594`).
6. **La tarjeta «Señales detectadas»** (`:268-276`), de `components/senales/SenalesDelDepartamento.jsx`.

El reloj recarga sólo con la pestaña a la vista (`components/acquisition/PanelDeAcquisition.jsx:193-195`); la caja del cerebro del pie pregunta con el período
que se mira (`:140`), y el comentario de la cabecera se publica desde la respuesta (`:143`).

**De dónde sale cada cifra** (`lib/negocio/embudosDeAcquisition.ts:12-20`):

- **Inversión del total**: lo que Meta cobró en toda la cuenta en la ventana, de `negocio.gasto_de_la_cuenta`
  (`lib/negocio/embudosDeAcquisition.ts:496-507`). La de cada campaña y cada funnel suma `metricas_de_anuncio` por
  `meta_campana_id` (`:561-571`).
- **Inversión con contactos**: la de las campañas que alguna vez trajeron un contacto con su `campaignId`
  (`:646-651`, `:623`). Es el único numerador de los costos de personas (`:387`, `:405`).
- **Contactos**: los que traen esa campaña en `atribucion_primera->>'campaignId'`, dados de alta en la ventana
  (`:591-604`). **Agendados**: `tieneCitaAlcanzable`; **calificados**: `esCalificado`, agendó y no está descartado
  (`lib/negocio/citasAlcanzables.ts:180-182`).
- **Clics**: `linkClick` de Meta; sin entrega son cero, con entrega y sin desglose no se saben
  (`lib/negocio/embudosDeAcquisition.ts:636`). No llevan tasa: son clics, no personas (`:372-390`).
- **«Completaron form»**, la etapa de Booking directo: siempre «Sin dato desde el 31 ago.» (`:346-352`,
  `components/acquisition/PanelDeAcquisition.jsx:429-430`).
- **ICP**: promedio del puntaje de los calificados con puntaje, desde diez (`lib/negocio/embudosDeAcquisition.ts:421`),
  con los cortes 75 y 50 de `tramosDelIcp.ts` (`lib/negocio/embudosDeAcquisition.ts:603-606`).
- **Las campañas listadas**: toda campaña con anuncios guardados, con contactos atribuidos alguna vez o con un funnel
  asignado, no sólo las de la ventana (`lib/negocio/embudosDeAcquisition.ts:720-788`), ordenadas por inversión, contactos e identificador (`:468-473`).

**Ventanas.** «7 días» y «30 días» son días **cerrados**: terminan en el último día cuyo total de la cuenta se
releyó después de la medianoche de la empresa (`lib/negocio/diasCerrados.ts:14-26`,
`lib/negocio/gastoDeLaCuenta.ts:301-349`). «Hoy» es hoy, sin costos ni flechas; «Completo» empieza en el dato más
viejo —gasto o contacto con campaña— y termina hoy (`lib/negocio/embudosDeAcquisition.ts:43-47`). La ventana
anterior se compara sólo si está entera (`:898-911`), y sus agendados se cuentan a la misma edad (`:943-944`). Un
día está entero cuando su total de la cuenta se releyó después de terminar y el detalle por campaña cuadra con él,
con diez centavos de tolerancia, o está declarado residuo (`lib/negocio/gastoDeLaCuenta.ts:36`, `:354-429`). Los
costos sólo salen con el gasto de la ventana entero (`lib/negocio/embudosDeAcquisition.ts:920-921`).

**Lo que dibuja hoy, deducido** del código sobre lo medido el 2026-10-18 (§ 4). El último día cerrado es el
2026-10-17:

- **«30 días» (18 sep – 17 oct)**: Inversión **626,06**, con «$626 sin contactos atribuidos» al pie; Contactos 0,
  Agendados 0, Calificados 0 y «— por calificado»; Clics **875**. La nota: «0 de 28 leads traen campaña». La
  ventana anterior (19 ago – 17 sep) está entera, así que **hay flechas**: Inversión ▼ 90 % sin color (6.276,60
  antes), Clics ▼ 98 % y Contactos ▼ 100 % en rojo (323 antes). Las tres tarjetas: «Sin campañas asignadas».
- **«7 días» (11 oct – 17 oct)**: Inversión **1,20** (66,91 la semana anterior, ▼ 98 %), Contactos 0 sin flecha
  —la anterior también fue cero—, Clics 2, «0 de 1 leads traen campaña».
- **«Completo»** empieza el 2026-08-11, el alta del primer contacto con campaña, una semana antes del primer día de
  gasto guardado (2026-08-18). A la ventana le faltan esos siete días de la serie, así que **nunca publica costos**
  y la nota dice «Faltan días de gasto.» (`lib/negocio/gastoDeLaCuenta.ts:430-435`,
  `lib/negocio/embudosDeAcquisition.ts:920-921`): riesgo 3. Su Inversión es la suma por campaña, 7.100,17, porque
  sin todos los días no hay total de la cuenta (`lib/negocio/gastoDeLaCuenta.ts:439`).
- **«Sin funnel»** lista **29 campañas**: las 28 con anuncios guardados y una con contactos y sin anuncios. 13
  tienen contactos atribuidos; las 16 restantes dibujan «—» en sus personas.

**Las señales y el plan.** La pasada del detector corre cada hora y trabaja la empresa que ya pasó las 6:00 de su
zona sin haber corrido hoy (`lib/negocio/barrido.ts:357-371`, `lib/agentes/detectores/correr.ts:50`). Mide con la
misma `lecturaDeAcquisition` que la pantalla (`lib/agentes/detectores/acquisition.ts:4-9`, `:210-212`) y catorce
reglas con valores provisionales que firma un administrador (`:45-60`, `:74-170`). El plan va en cuatro grupos más
«Requiere validación ejecutiva» (`lib/agentes/plan/acquisition.ts:32-38`) y, con llave de IA, el modelo lo redacta
dentro de esos renglones (`:19-20`). Resolver, validar y firmar tienen sus rutas y capacidades
(`app/api/acquisition/senales/route.ts:40`, `app/api/acquisition/umbrales/route.ts:26`).

**El comentario de la cabecera** habla, en este orden, de la frescura de la tarea `anuncios`, de días de los últimos
7 que no cuadran con la cuenta, de la señal abierta crítica o alta más grave y de la regla de la Reunión de hoy de
esta sección (`lib/agentes/cabecera.ts:7-14`, `:108-112`, `:130-132`). Las cuatro señales abiertas son de gravedad
media, así que por ellas no dice nada (`:67`).

**Pruebas**, contadas con `grep` el 2026-10-18 y **no corridas para este corte**:
`pruebas/codigo/181-embudos-de-acquisition.test.ts` (19), `pruebas/base/181-embudos-de-acquisition.test.ts` (29),
`pruebas/codigo/182-la-pantalla-de-acquisition.test.ts` (8), `pruebas/base/180-el-funnel-de-la-campana.test.ts`
(10), `pruebas/codigo/180-un-solo-escritor-de-acquisition.test.ts` (2), `pruebas/codigo/221-el-detector-de-acquisition.test.ts`
(10), `pruebas/codigo/222-el-plan-de-acquisition.test.ts` (7), `pruebas/base/223-las-senales-de-acquisition-sobre-la-base-sembrada.test.ts`
(3), `pruebas/base/224-las-senales-de-acquisition-en-su-pantalla.test.ts` (5) y, del colector,
`pruebas/codigo/99-anuncios.test.ts` (42) y `pruebas/base/99-anuncios.test.ts` (24).

**Lo que nadie vio todavía: la pantalla con sesión y datos reales.** AQ-5 subió sin la comparación en el
navegador, por decisión del usuario (`docs/acquisition/14-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md:471`); la
verificación de AG9 miró el plan y las señales en el preview local, no en producción. No hay en el repositorio ni en
los mensajes de commit ningún registro del humo con sesión.

---

## 3 · Lo que era maqueta, y lo que era la pantalla del 2026-09-28

**La maqueta** (doce juegos de datos inventados, foto del 2026-09-15) se borró el 2026-09-16 (`be5ba97`). Lo que
hizo cada pieza está en la versión del 2026-09-28 de esta foto (§ 3 de `git show 972972e:…`).

**La pantalla del 2026-09-16 al 2026-09-30** —«Lo que costó la pauta», el monitor de atribución y la tabla por
anuncio— se reemplazó en AQ-4 (`components/views/AcquisitionView.jsx:1-9`):

| lo que había | qué hay ahora |
|---|---|
| la tabla por anuncio de `costoDelAnuncio` | la tabla por campaña dentro de cada funnel; el detalle por pieza es de Creative, que sigue usando `costoDelAnuncio` |
| el monitor de atribución, en pantalla | dormido el 2026-09-30 y vuelto el 2026-10-05 como cinco reglas del detector, sobre los mismos días cerrados (`lib/agentes/detectores/acquisition.ts:86-92`, `lib/negocio/calidadDeLaAtribucion.ts:113-131`) |
| «Hoy» con dos significados en la misma respuesta | cerrado: la respuesta sólo trae días de calendario (`app/api/acquisition/route.ts:28-29`) |
| la ventana de 30 días terminando hoy | días cerrados (§ 2) |
| el gasto de las 13 campañas que nombraba la atribución | el de toda la cuenta (`076`) |

**Lo que Executive publicaba en nombre de Acquisition** —la ficha «312 contactos», la inversión de 8.525 a 7 días,
el conflicto «a $19», las tres preguntas del chat y la tarjeta «Campañas y tráfico · 2 a revisar»
(`lib/aios/executive.js:178-181@c4cf2a8`, `lib/aios/executive.js:16-20@c4cf2a8`,
`lib/aios/executive-panel.js:17-21@c4cf2a8`)— **se fue el 2026-10-01** con la maqueta del Executive (E7,
`4e9a242`): `lib/aios/` sólo conserva `index.js` y `shell.js`. Lo que el Inicio dice hoy de Acquisition sale de las
mismas lecturas: la Reunión de hoy toma la falta de entrega de las señales y la caída de entrada de la semana
cerrada (`lib/agentes/reunion/temas.ts:146-186`), y el cerebro responde con `embudos_de_acquisition`, la misma
función y la misma ventana que la pantalla (`lib/agentes/executive/adaptadores/acquisition.ts:1-2`, `:32-35`).

---

## 4 · Datos que ya tenemos, medidos el 2026-10-18

Una sola organización tiene contactos, métricas y gasto de la cuenta (`count(distinct org_id)` = 1 en las tres). La
lectura va como `postgres`, que salta la política de fila: los conteos son totales.

**El total de la cuenta** (`negocio.gasto_de_la_cuenta`): **62 días, del 2026-08-18 al 2026-10-18, 7.100,65**. Por
semana (lunes): 1.251,57 · 1.443,91 · 2.169,42 · 1.532,37 · **175,56** (desde el 14 sep) · 256,13 · 241,59 ·
**28,90** (desde el 5 oct) · **1,20** (desde el 12 oct). Días con gasto en octubre: del 1 al 5 (entre 28,90 y 38,01
por día) y el 14 (1,20). **Último día con gasto e impresiones: 2026-10-14.** La foto anterior decía «ningún gasto
desde el 13 de septiembre»: era lo que el colector veía de las 13 campañas que pedía; la cuenta gastó 703,38 más
después de esa fecha (sumando la serie por semana).

**El detalle por campaña** (`negocio.metricas_de_anuncio`): 4.918 filas de 129 anuncios, del 2026-08-18 al
2026-10-18, **7.100,17**. Cuadra con la cuenta todos los días salvo uno, declarado residuo (0,48 de diferencia, en
la semana del 24 de agosto). `negocio.lecturas_de_gasto`: 2.929 pares (campaña, día) de 62 campañas.

**La mitad del gasto nunca trajo un contacto atribuido.** De los 7.100,17, **3.511,28** son de las 13 campañas que
alguna vez trajeron un contacto con su `campaignId` —la cifra entera que veía la foto anterior, y su último día de
gasto es el 2026-09-13— y **3.588,89** de campañas sin ninguno. En los 30 días cerrados, las dos únicas campañas que
gastaron son de las segundas: los 626,06 enteros.

**Las campañas** (`negocio.campanas`): **62**, todas con nombre, **las 62 en `PAUSED`** según la última lectura.
`negocio.anuncios`: 129 anuncios en 28 campañas, 108 con conjunto. **`negocio.funnels_de_campana`: 0 filas**:
ninguna campaña asignada a un funnel desde que AQ-5 subió.

**El colector.** El 2026-10-18, `anuncios` corrió a las 06:18 UTC con 8 llamadas y `anuncios_relleno` a las 14:53
con 0 —nada pendiente—; las otras diez organizaciones, `saltada` en las dos. La tarea `activos` (Meta directo),
`saltada`: la empresa no cargó su token de Meta.

**Los contactos.** 624 en total (594 el 2026-09-28); 355 con `campaignId` numérico, 215 con `adId`, 24 sin
`alta_en_el_crm`. Por semana de alta desde el 31 de agosto: 175 (164 con campaña) · 89 (81) · 5 · 5 · 11 · 7 · 1,
**ninguno con campaña desde el 14 de septiembre**; el último contacto con campaña entró el 2026-09-13 a las 05:13
UTC. El último alta de cualquier contacto es del 2026-10-16 a las 22:13 UTC y la tarea `contactos` corre: la
ingesta anda, lo que no llega es atribución de pauta.

**Las ventanas de la pantalla** (días de calendario, con el borde en UTC): «30 días» 28 contactos, 0 con campaña;
la anterior, 367 y 323. «7 días», 1 y 0; la anterior, 8 y 0. Clics de Meta: 875 en 30 días y 50.465 en los 30
anteriores. `negocio.resultados`: 7 filas y **0 ventas**, igual que el 2026-09-15.

**Las UTM.** Ningún contacto trae `utmCampaign`; 273 traen `campaign`, y 519 alguna de las cinco (riesgo 2). Con las
dos claves de campaña, como cuenta el monitor desde `65669f4`, las completas son 56 de 519; la que menos llega, `utmTerm`.

**Las señales** (`negocio.senales`, departamento `acquisition`): 9 en total. **Cuatro abiertas, todas de 30 días y
de gravedad media**, las cuatro del monitor: contactos con anuncio 7,1 % (sobre 28), citas con anuncio 10,2 % (sobre
49), contactos con campaña 0 % (sobre 28) y UTM completas 0 % (sobre 10). Cinco cerradas solas: las tres del monitor
en 7 días, una de concentración y una de escala por calificado. Ninguna «sin entrega»: la regla cuenta sólo las campañas
activas o de estado desconocido, y las 62 están pausadas (`lib/agentes/detectores/acquisition.ts:409-412`). Planes de la empresa: 14 por
ventana, del 2026-10-05 al 2026-10-18, redactados por el modelo 14 de 30 días y 10 de 7. `negocio.umbrales`: 0
firmas, todos los valores siguen provisionales.

**Del 2026-09-28, no re-medidos**: la cobertura por puerta de entrada (`facebook`/`instagram` con `adId`, formulario y
calendario sin él), el ad set en `utmTerm` y el cambio de anuncio entre los dos toques.

---

## 5 · Datos que faltan, y de dónde tendrían que venir

**1 · De Meta, lo que GoHighLevel no pasa.** Cuartiles de video, tiempo visto, placement, desgloses demográficos y
el activo creativo: `fields` es un enum cerrado y `groupBy` sólo acepta día, semana o mes (`lib/ghl/anuncios.ts:62-74`);
el estado de entrega por anuncio tampoco llega (`db/migraciones/050_lo_que_costo_cada_anuncio.sql:60-63`). Meta
directo existe desde el 2026-10-15 (`078`, tarea `activos` cada hora, `lib/negocio/barrido.ts:351`), pero sólo lee
la miniatura y el post de cada anuncio, para Creative, y espera el token de la empresa.

**2 · Las campañas de mensajes, sin atribución.** El gasto ya entra (`076`); la gente que trae no: sus contactos llegan
sin `campaignId`, y «cuántos DMs trajo cada campaña» queda fuera
(`docs/acquisition/14-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md:447-448`). Hoy es todo el gasto de la ventana (§ 4).

**3 · «Completaron form».** El campo del CRM dejó de escribirse el 2026-08-31 (`lib/negocio/embudoDelFormulario.ts:33-38`).

**4 · El funnel de cada campaña.** No es un dato que traer: alguien con `credenciales.editar` tiene que asignarlo
(`app/api/acquisition/funnel/route.ts:77`). En producción, 0 de 29.

**5 · Ventas por anuncio.** Sin denominador: 0 ventas.

**6 · El primer toque sobrescrito (§ 18.14).** Los dos toques se guardan y se reescriben en cada pasada; detectar un
cambio exige una tabla de cambios que no existe (`lib/negocio/calidadDeLaAtribucion.ts:26-29`).

**7 · Cuándo se pone una etiqueta de descarte.** Sin esa fecha, los calificados no pueden compararse contra la
ventana anterior (`lib/negocio/embudosDeAcquisition.ts:182-189`).

**8 · Calificado y costo por calificado del § 18.7**, si «calificado» llega a significar otra cosa que agendó y no
descartado (A14-07); y **la diferencia entre leads de Meta y de la base**, que sigue fuera de alcance
(`db/migraciones/050_lo_que_costo_cada_anuncio.sql:210-223`).

---

## 6 · Reglas propias

**1 · La campaña se identifica por id, nunca por nombre**, y el funnel se asigna por campaña, a mano
(`lib/negocio/embudosDeAcquisition.ts:219-221`, `db/migraciones/066_el_funnel_de_la_campana.sql:35`).

**2 · El servidor calcula; el navegador dibuja.** Tasas, costos, variaciones y su color llegan hechos, porque el piso
vive en un módulo que importa la base (`lib/negocio/embudosDeAcquisition.ts:22-27`).

**3 · Una tasa debajo de diez es «—», y un costo sin inversión o sin etapa también**: con la pauta parada, «$0 por
contacto» diría que salieron gratis (`lib/negocio/embudosDeAcquisition.ts:289-302`).

**4 · La Inversión es la de la cuenta; los costos de personas, la de las campañas con contactos.** Una campaña de
mensajes no puede inflar el costo por contacto de las otras (`lib/negocio/embudosDeAcquisition.ts:95-100`, `:483-499`).

**5 · Tres ceros distintos**: el medido (la cuenta dijo 0), el no pedido (`dias_sin_leer`) y el parcial (`no_cuadra`)
(`lib/negocio/gastoDeLaCuenta.ts:275-281`, `:344-353`).

**6 · Días cerrados, y se compara sólo lo entero.** Una ventana con un día a medias compararía seis días y medio
contra siete (`lib/negocio/embudosDeAcquisition.ts:33-42`); la anterior, con los agendados a la misma edad
(`lib/negocio/citasAlcanzables.ts:127-133`).

**7 · Los clics no son personas**: sin tasa, y su costo se paga con el gasto de las filas que los cuentan
(`lib/negocio/embudosDeAcquisition.ts:101-105`).

**8 · La Inversión lleva flecha sin color**; las demás cantidades, «más es mejor»; los calificados, sin flecha por
ahora (`lib/negocio/embudosDeAcquisition.ts:304-325`, `:403`).

**9 · Lista cerrada de frases.** Cada hueco dice una de las de `FRASE`
(`components/acquisition/PanelDeAcquisition.jsx:77-100`), y una frase nueva entra primero en el documento.

**10 · Ningún botón que vaya a dar 403**: el selector de funnel y las acciones sobre señales los decide el servidor,
y nada se ofrece mirando otra empresa (`app/api/acquisition/route.ts:91-102`,
`components/acquisition/PanelDeAcquisition.jsx:256`).

**11 · Detectar no es recomendar.** El detector mide sobre la lectura de la pantalla y una regla que no se puede medir
queda «sin medición» en vez de cerrarse sola (`lib/agentes/detectores/acquisition.ts:11-17`); lo de presupuesto va a
validación ejecutiva.

**12 · El colector reconcilia y no olvida**: pide lo que falta, reescribe lo que Meta corrige y un fallo nunca se
guarda como cero (`lib/negocio/recolectarAnuncios.ts:11-20`, `db/migraciones/076_el_gasto_de_toda_la_cuenta.sql:68-70`).

**13 · Con varios clientes (el nivel 3, C5 · G3), lo de una cuenta publicitaria es de su cliente.** Cada campaña dice de
qué cliente es cuando las campañas son de más de uno (`lib/negocio/embudosDeAcquisition.ts:720`); con uno solo, la fila
de siempre. Un cliente que pautó en la ventana sin ningún día de su serie deja a la empresa sin costos, sin flechas y
sin el total de la cuenta (`lib/negocio/embudosDeAcquisition.ts:681`, `lib/negocio/embudosDeAcquisition.ts:927`); el
detector sólo frena lo que lee Meta con un cliente que tiene métricas y no serie
(`lib/negocio/embudosDeAcquisition.ts:826`), y mide «sin entrega», la concentración, la escala y el gasto sin
crecimiento dentro de cada cliente (`lib/agentes/detectores/acquisition.ts:369`). El funnel de una campaña se guarda en
su cliente (`lib/negocio/funnelDeLaCampana.ts:100`). Toda señal de campaña se nombra «Campaña (Cliente)» —en la
tarjeta, la cabecera y la Reunión—, con el cliente de la pantalla (`lib/agentes/senales/lectura.ts:116`). A un cliente
en pausa se le pide la serie sólo hasta su último día cerrado (`lib/negocio/gastoDeLaCuenta.ts:398`): pausarlo no deja
a la empresa sin el gasto entero mientras la ventana tenga días después de la pausa. Y desde C6 · D1 la nota dice,
después de «Faltan días de gasto.», de qué cliente falta y qué hacer —Meta sin vincular en su GoHighLevel, su conexión,
o que ya no está activo—, también con el colector atrasado, cuando el sello del barrido lo sabe
(`lib/negocio/embudosDeAcquisition.ts:934`; `pruebas/base/290-los-avisos-dicen-de-que-cliente.test.ts:487`). Lo exigen
`pruebas/base/284-acquisition-y-conversation-con-varios-clientes.test.ts:313`,
`pruebas/base/284-acquisition-y-conversation-con-varios-clientes.test.ts:519` y
`pruebas/codigo/285-los-detectores-del-gasto-por-cliente.test.ts:41`; con un solo cliente, que el freno de Meta y su
anterior sean los de siempre, `pruebas/base/284-acquisition-y-conversation-con-varios-clientes.test.ts:449`.

**14 · Las señales que comparaban contra la empresa, dentro de su cliente (C6 · D3).** Con campañas de varios clientes,
el ICP de una campaña se compara con su funnel EN SU cliente (`lib/agentes/detectores/acquisition.ts:608`), la fuga
con los otros funnels de su cliente, con un id que lleva el cliente salvo el del principal
(`lib/agentes/detectores/acquisition.ts:714`), y el monitor de atribución es el de cada cliente activo con campañas:
el que no tiene denominador en la ventana se salta y no frena a los demás (`lib/agentes/detectores/acquisition.ts:862`).
El cambio brusco del conjunto pasa al freno de Meta, con la anterior de Meta (`lib/agentes/detectores/acquisition.ts:812`).
El plan dice de qué cliente falta el gasto que deja sin medir los costos, con la frase de la nota
(`lib/agentes/plan/acquisition.ts:162`). La pantalla no cambia: Acquisition no tiene foco por cliente. Lo exigen
`pruebas/codigo/294-las-senales-que-mezclaban-clientes.test.ts:111`,
`pruebas/codigo/294-las-senales-que-mezclaban-clientes.test.ts:156` y
`pruebas/base/295-las-senales-de-cada-cliente.test.ts:274`; un `campaignId` de Google Ads sigue contando como pauta
sin Meta (07, «Lo que todavía supone una subcuenta»).

---

## 7 · Riesgos

**1 · Ninguna campaña tiene funnel, y la pantalla lo dice en voz baja.** Las tres tarjetas, que son el centro del
prototipo, dicen «Sin campañas asignadas»; todo está en la última tabla. La primera tarea real después de AQ-5 era
asignar las campañas, y no se hizo (§ 4). Si la pantalla debe avisar cuando aparece una campaña sin asignar es
`A14-P03`, abierta (`docs/acquisition/14-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md:479`).

**2 · Una señal abierta era falsa. Cerrado el 2026-10-18 (`65669f4`).** Al corte,
`ACQ-ATRIBUCION-UTM` decía que 0 % de los contactos con alguna UTM las trae completas. El monitor buscaba sólo
`utmCampaign`, que **ningún contacto trae**; GoHighLevel guarda la campaña en `campaign` (273 contactos), la clave que
sí usa `lib/negocio/atribucionDelLead.ts:105`. Era el riesgo 3 de la foto anterior: entonces un aviso en pantalla, y
al corte una señal viva en el plan de cada mañana. Hoy cada UTM se reconoce por cualquiera de sus claves
(`lib/negocio/calidadDeLaAtribucion.ts:91-106`, `CLAVES_DE_LA_UTM`): las cinco completas son 56 de 519, y la señal
sigue saliendo, pero por la causa real, `utmTerm`, que es la que menos llega. Subido a producción el mismo
día, 2026-10-18.

**3 · «Completo» no publica costos, y no va a publicarlos.** Empieza en el primer contacto con campaña, el
2026-08-11, y la serie de la cuenta empieza el 2026-08-18: a la ventana siempre le faltan siete días, y la nota dice
«Faltan días de gasto.» aunque no falte nada que el colector pueda pedir (§ 2). Es el límite de A14-09 —«contactos de
antes del primer gasto»— con una consecuencia que el documento no dice: es permanente mientras la serie no se
extienda hacia atrás.

**4 · Las flechas de 30 días acusan una caída que pasó hace un mes.** La ventana anterior (19 ago – 17 sep) tiene la
pauta llena y la actual no: Contactos ▼ 100 % en rojo. Es verdad, y no es noticia; quien abra la pantalla sin contexto
lo va a leer como una caída de hoy.

**5 · Toda la Inversión es «sin contactos atribuidos».** Las dos campañas que gastaron en la ventana nunca trajeron un
contacto con su campaña. La cifra de arriba es correcta y no dice a quién trajo; los costos van en «—» con razón.

**6 · El día de la empresa.** Los días cerrados se deciden en la zona de la empresa (America/Lima), pero el borde de
cada día de contactos y de métricas se corta con `::date` en la zona de la base (`lib/negocio/recorrido.ts:214-217`).
Diagnosticado y dejado para después por decisión del usuario el 2026-10-07 (`docs/OTROS/futuro/el-dia-de-la-empresa.md:63`).

**7 · Los umbrales del detector son provisionales y nadie los firmó**: 0 filas en `negocio.umbrales`. Cada valor salió
del criterio, no de una serie (`lib/agentes/detectores/acquisition.ts:95-99`).

**8 · El 91 % del § 18.17 es un ejemplo.** El real, sobre los 30 días cerrados, es 7,1 % (la señal de contactos con
anuncio); sobre la base entera, 215 de 624.

**9 · Documentos que dicen lo contrario de lo medido.** `docs/acquisition/00-MAPA.md:147` sigue poniendo el gasto entre
lo que «Espera a Meta»; `docs/acquisition/13-EL-CONTRASTE.md:166-170` sigue diciendo que el freno es una credencial;
`docs/acquisition/01-LOS-TRES-EMBUDOS.md:169` remite al «gran total del §A1-07», que son las etiquetas (`:171`). Y
`docs/acquisition/01`, `03` y `05` tienen 12, 20 y 12 citas a líneas de esta foto (contadas el 2026-10-18), escritas
contra la versión del 2026-09-15: con ésta caen en otro texto.

**10 · Comentarios del código que no decían la verdad. Cerrado el 2026-10-18 (`65669f4`).**
`db/migraciones/053_el_desglose_que_ya_llegaba.sql:34-35` ponía la tarea `anuncios` «del cron de las 17:06 UTC», y es
a las 06:17 (`lib/negocio/barrido.ts:289`); `lib/negocio/costoDelAnuncio.ts:471` decía que «el colector pide hoy y los
tres anteriores», y pide hoy y los dos anteriores (`lib/negocio/recolectarAnuncios.ts:62`). Los dos seguían igual que
el 2026-09-28 al corte; ese mismo día se corrigieron, y hoy dicen 06:17 UTC y «hoy y los dos anteriores». Antes ya
se habían cerrado el de las «52 llamadas» de `barrido.ts` (hoy `lib/negocio/barrido.ts:285-288`, con el costo de la `076`) y el de
`comoDia` en `costoDelAnuncio.ts`, que ya saca las fechas como texto (`lib/negocio/costoDelAnuncio.ts:418-420`).

**11 · La comprobación con sesión no consta.** Ni la de AQ-5 ni la de las señales en producción (§ 2).
