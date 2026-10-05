# Creative Intelligence
> Corte: **2026-09-28**. Cada afirmación lleva su `archivo:línea` o la consulta que la produjo.
> Lo que no se pudo verificar está dicho como pendiente, no omitido.
> Para ubicar cualquier cosa nombrada acá, ver [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md).
> Las cifras de producción son del 2026-09-28 entre las 18:00 y las 18:30 UTC, leídas con
> `node --env-file=.env.supabase scripts/supabase.mjs leer`, sólo agregados. Salvo que se diga otra
> cosa, la ventana es la que la pantalla abre por omisión, 30 días (`lib/negocio/periodo.ts:109`),
> anclada al día como la calculan los módulos: **276 contactos** con alta del 2026-08-30 al 09-28.

**Construido desde el 2026-09-19 — tres cifras medidas y ningún literal inventado; pero lo que
mide dejó de moverse el 2026-09-13, el último día con una impresión guardada.**

La maqueta de 450 líneas se borró y la reemplazaron una ruta y tres módulos que contestan lo que
sólo este departamento contesta: qué gente trae cada pieza. A treinta días el ICP promedio va de
**29,2 a 71,0** según la pieza (factor 2,4) y la tasa de agenda de **31 % a 78 %**; en la subasta
el hook rate va de 18,6 % a 26,0 % y el clic que de verdad llega a la landing, de **12,0 % a
91,4 %**. Todo eso describe un período que terminó: desde el 2026-09-14 el colector escribe las 79
filas diarias sin una sola impresión, entraron 8 contactos en quince días, y la pantalla no lo dice.

> **Desde el corte del 2026-09-15**
>
> - **La pantalla se construyó el 2026-09-19** (`3287f74`): se borran `lib/aios/creative.js` (450
>   líneas, 201 literales, 30 frases de guion) y su entrada en `MODULOS`; entran
>   `app/api/creative/route.ts`, `components/creative/PanelDeCreative.jsx`,
>   `lib/negocio/rendimientoDelCreativo.ts`, `lib/negocio/fatigaDelCreativo.ts` y
>   `lib/negocio/vistaDeCreative.ts`, y la sección baja `sinOperacionesTodavia` en el mismo cambio.
> - **Antes, el mismo día:** los requisitos en `docs/creative/` (quince documentos) y la migración
>   `053`, que guarda el desglose `results` que el cliente convertía en nulo (`7660d2a`); los cierres
>   de los dos overlays compartidos se mudan al armazón para que borrar la maqueta no dejara modales
>   sin cerrar en otras pantallas (`332c0e6`, `lib/aios/shell.js:162-171@c4cf2a8`); y la primera cifra,
>   `lib/negocio/calidadDelCreativo.ts` (`8a117cb`).
> - **Después:** la llave de la pieza en un solo lugar, `lib/negocio/creativo.ts` (`f9998b6`);
>   `results.lead` resulta ser de Meta y queda fuera de las tasas (`741f27d`); los cuatro huecos se
>   dibujan en pantalla (`0c93853`); una auditoría de ocho lentes corrige el grano de los días, el
>   piso del CTR y del click-to-landing y el denominador del puente (`7d1bc8b`, 2026-09-20); y tres
>   pruebas que sobrevivían a su mutación (`e9ca19a`, 2026-09-20).
> - **De otros departamentos, con efecto acá:** «tuvo cita» pasa a un predicado compartido,
>   `tieneCitaAlcanzable` (`1164984`, 2026-09-21); la migración `055` copia el puntaje de ICP a
>   `contactos.score` (`e350a47`, 2026-09-21); Leads Portal decide el 2026-09-26 que un ICP 0 es
>   «sin calificar» (`lib/negocio/tramosDelIcp.ts:18-25`) y Creative sigue promediándolo (§ 7).
> - **En los datos:** la pauta dejó de entregar después del 2026-09-13 (§ 4). La foto anterior
>   medía 14 días sobre 233 contactos con la pauta andando; ésta mide 30 días sobre 276, casi todos
>   de antes del corte de la pauta.
> - **Dos afirmaciones de la foto anterior eran falsas**, y ya lo decía su corrección del 2026-09-19:
>   que de Meta no llegaba nada (llegan cuatro de los nueve indicadores del § 18.12, por GoHighLevel)
>   y que la fatiga por frecuencia era construible (no lo es: la frecuencia no se agrega).

---

## 1 · Qué pide el documento

El documento funcional vive fuera del repositorio; `docs/creative/` lo cita literal y por línea
(`docs/creative/10-LO-QUE-PIDE-EL-DOCUMENTO.md:3-12`). **No tiene una sección propia de Creative**:
todo lo detallado está dentro del § 18, que es el de Acquisition. Lo que pide, resumido:

- **§ 18.12** — el Creative Performance Analyzer: nueve indicadores y un límite, *no reemplaza a
  Creative Intelligence, que interpreta hook, body, CTA, guion y nuevas variantes*
  (`docs/creative/10-LO-QUE-PIDE-EL-DOCUMENTO.md:16-58`).
- **§ 18.7** — seis KPI de «video y creativo» y tres de «interacción» que también son de la pieza
  (`docs/creative/10-LO-QUE-PIDE-EL-DOCUMENTO.md:62-91`).
- **§ 18.15** — lo que ve el responsable creativo: mejor retención, creativos fatigados, hooks con
  mejor comportamiento, solicitudes de variantes (`docs/creative/10-LO-QUE-PIDE-EL-DOCUMENTO.md:107-122`).
- **§ 18.13** el detector de fatiga con esquema de alerta; **§ 5.1** la entidad `Creative Profile`;
  **§ 2.3** el derecho a recomendar variantes; **§ 18.16** el contrato que Acquisition le entrega
  (`docs/creative/10-LO-QUE-PIDE-EL-DOCUMENTO.md:126-177`).
- **§ 2.5** — un anuncio con bajo CTR puede valer si trae mejor ICP; es el fundamento de que el ICP
  por pieza sea la cifra central (`docs/creative/10-LO-QUE-PIDE-EL-DOCUMENTO.md:181-188`).
- **§ 16.2** pone a Creative después de validar la trazabilidad, **§ 18.19** deja pendientes los
  umbrales de fatiga y **§ 17** admite que Creative no está especificado
  (`docs/creative/10-LO-QUE-PIDE-EL-DOCUMENTO.md:192-231`).

**Los nueve del § 18.12, al 2026-09-28:**

| indicador | hoy |
|---|---|
| Retención inicial | **en pantalla**, como hook rate (`videoView` / impresiones); qué cuenta `videoView` no está documentado |
| CTR | **en pantalla**, con piso de 1.000 impresiones |
| CPL | construible y **no construido**: gasto y contactos por pieza viajan en bloques distintos y nadie los divide |
| Caídas de retención | sin fuente: los cuartiles dan 422 por GoHighLevel |
| Fatiga | **en pantalla** como caída de CTR, con umbral provisional |
| Frecuencia | no se agrega a lo largo de días ni de anuncios |
| Formato y duración | sin fuente; sólo se inferirían del nombre, y esa decisión no está tomada |
| Placement | sin fuente: `groupBy` sólo acepta `day`, `week` y `month` |

Y la otra mitad —hook, body, CTA, guion, variantes— sigue sin fuente por ninguna vía: exige leer la
pieza, y la pieza no está guardada (`docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md:195-236`).

**La contradicción del documento, y cómo quedó resuelta.** Lo declara departamento propio y a la
vez le escribe el detalle adentro de Acquisition. La foto anterior la resolvió **por fuente del
dato**: *Acquisition publica lo que dice Meta; Creative, lo que dice el lead que llegó por cada pieza
y lo que dice la pieza misma*. **Ese corte ya no se sostiene**: el hook rate y las tasas de enlace
salen del mismo endpoint que el gasto. El que se sostiene es el **grano** —Acquisition ordena
anuncios, Creative ordena piezas— y el gasto se consume con la misma función, no con una segunda
consulta (`docs/creative/07-LO-QUE-ENTREGA-Y-RECIBE.md:41-71`).

---

## 2 · Qué hay hoy en pantalla

**La ruta.** `app/api/creative/route.ts` declara `PANTALLA = 'creative'` (`app/api/creative/route.ts:45`),
pasa por el portero con `tablero.ver` (`app/api/creative/route.ts:51`), **rechaza** el período que no
está en la lista en vez de corregirlo (`app/api/creative/route.ts:57-58`) y corre los tres módulos con la
misma ventana (`app/api/creative/route.ts:60-64`). La sección ya no declara `sinOperacionesTodavia`
(`lib/autorizacion/secciones.ts:251-264`).

**La vista y el panel.** `components/views/CreativeView.jsx` (70 líneas) sólo pone el encabezado
—«Qué pieza trae mejor gente, y sobre cuántos datos» (`components/views/CreativeView.jsx:60`)— y monta
el panel. `components/creative/PanelDeCreative.jsx` (611 líneas) pide por `leerCreative`
(`lib/negocio/vistaDeCreative.ts:38-50`), recarga cada 60 s mientras la pestaña está a la vista
(`components/creative/PanelDeCreative.jsx:84-86`, `lib/cadencia.ts:91`) y dibuja cinco bloques en este
orden (`components/creative/PanelDeCreative.jsx:175-187`):

1. **Cuánto vale lo que dice esta pantalla** (`components/creative/PanelDeCreative.jsx:235-289`): la
   cobertura del puente nombre↔anuncio con sus dos pérdidas, las dos ventanas dichas en una frase y
   el aviso de la calidad, que queda a la vista.
2. **Qué gente trae cada pieza** (`components/creative/PanelDeCreative.jsx:297-392`): una tabla por
   etapa —TOFU, MOFU, BOFU y «Sin etapa» al final— con Pieza, Contactos, Agenda con su fracción, ICP
   con su n y Anuncios (`components/creative/PanelDeCreative.jsx:352-356`); diez filas a la vista y el
   resto detrás de un botón que las cuenta (`components/creative/PanelDeCreative.jsx:48`).
3. **Cómo se comportó cada pieza en la subasta** (`components/creative/PanelDeCreative.jsx:399-498`):
   ordenadas por gasto, *«que es un hecho»*; Gasto, CTR, Hook, Link CTR y Landing, con la interacción
   y el click-to-landing en la nota de la pieza (`components/creative/PanelDeCreative.jsx:458-478`).
4. **Qué piezas están perdiendo gancho** (`components/creative/PanelDeCreative.jsx:561-614`): sólo las
   que tienen veredicto, con `con/sobre` arriba.
5. **Lo que esta pantalla no puede medir** (`components/creative/PanelDeCreative.jsx:206-226`): los
   cuatro huecos, «medido contra la API de GoHighLevel el 18 de septiembre de 2026».

**Los módulos que deciden** (el panel no calcula nada, `lib/negocio/vistaDeCreative.ts:3-14`):

| módulo | qué publica | grano | piso |
|---|---|---|---|
| `lib/negocio/calidadDelCreativo.ts` | ICP promedio y tasa de agenda | contacto, por (pieza, etapa) | 10 sobre cada denominador (`lib/negocio/calidadDelCreativo.ts:244-249`) |
| `lib/negocio/rendimientoDelCreativo.ts` | gasto, impresiones y clics consumidos de `costoDelAnuncio` y sumados por pieza, y sobre esas sumas el CTR, recalculado con su propio piso (`lib/negocio/rendimientoDelCreativo.ts:314-354`); hook rate, link CTR, landing page view rate, click-to-landing, interacción | anuncio-día sumado por pieza | 1.000 impresiones (`lib/negocio/rendimientoDelCreativo.ts:66`); 10 clics al enlace para el click-to-landing |
| `lib/negocio/fatigaDelCreativo.ts` | caída relativa del CTR entre dos mitades de la serie | día de calendario por pieza | 8 días (`lib/negocio/fatigaDelCreativo.ts:53`) y 1.000 impresiones por mitad |
| `lib/negocio/creativo.ts` | la llave `lower(btrim(nombre))` y la etapa leída del nombre de campaña | — | — |

**Las ventanas.** Los cuatro botones salen de `PERIODOS` (`lib/negocio/periodo.ts:83-96`). Las tres
consultas anclan la ventana **al día de calendario** y no a 24 horas: los contactos con
`alta_en_el_crm >= current_date - (días - 1)` (`lib/negocio/calidadDelCreativo.ts:228`) y las
métricas con `fecha > current_date - días` (`lib/negocio/costoDelAnuncio.ts:82-84`), por el motivo
que explica `lib/negocio/costoDelAnuncio.ts:34-65`.

**Lo que dibuja hoy con 30 días**, repitiendo las consultas de los tres módulos contra producción:

**Qué gente trae cada pieza** — 14 filas (pieza, etapa); las cinco que pasan el piso de 10:

    etapa  pieza                          contactos   agenda        ICP (n)      anuncios
    TOFU   agendamiento - yaping             112      48 · 43 %     42,7 (112)       3
    TOFU   el app                             59      23 · 39 %     45,4 (59)        4
    TOFU   economia us latino                 26       8 · 31 %     29,2 (26)        4
    BOFU   evoluciona native                  36      28 · 78 %     71,0 (36)        5
    —      (sin creativo)                     19      15 · 79 %     65,7 (14)        —

Las otras nueve filas tienen de 1 a 8 contactos y salen con conteo y sin tasa, y el aviso lo dice
(`lib/negocio/calidadDelCreativo.ts:373-381`). Las cuatro con nombre dan **lo mismo que el
2026-09-19** (`8a117cb`): no entró nadie nuevo que cambie sus cifras.

**Factor 2,4 entre el ICP más bajo y el más alto** (29,2 contra 71,0). La foto anterior lo midió a
14 días el 2026-09-15 —27,5 contra 74,1, factor 2,7— cuando ordenar las piezas por la calidad del
lead que traen era lo único que la base permitía y ninguna pantalla lo hacía. Es lo que el § 18.6
pide («ICP promedio por anuncio») y lo que el § 2.5 defiende, y hoy está construido. Que tampoco es
el orden del negocio —faltan las ventas— la pantalla lo dice sobre la subasta
(`components/creative/PanelDeCreative.jsx:412-413`), no sobre esta tabla.

**Cómo se comportó cada pieza en la subasta** — 32 piezas en la tabla, 14 con gasto, **1.974,93** de
gasto en la ventana; las cinco de más gasto (tasas redondeadas):

    pieza                            gasto     CTR      hook     link CTR   click→landing
    agendamiento - yaping            566,99    2,37 %   21,0 %   1,59 %     12,0 %
    evoluciona native                554,05    2,11 %   19,6 %   1,49 %     87,7 %
    el app                           385,27    4,04 %   18,6 %   2,21 %     22,7 %
    economia us latino               240,34    3,94 %   26,0 %   2,09 %     29,1 %
    agendamiento - yaping - 23/07    167,97    3,35 %   23,0 %   2,15 %     91,4 %

Con los pisos, el CTR y el hook rate se publican en **6 de 32** piezas y el click-to-landing en **8**;
entre esas ocho va de 12,0 % a 91,4 %. Siete veces y media entre dos piezas de la misma cuenta, y es
el § 18.7 «click-to-landing rate», que el código daba por imposible hasta el 2026-09-19.

**Qué piezas están perdiendo gancho** — la clave arriba dice **5/14**: catorce piezas entregaron en la
ventana, cinco tienen veredicto; de las nueve sin él, cuatro por pocos días y cinco porque alguna
mitad no llega a mil impresiones. Dos pasan el umbral del 20 %: **el app** (−32,5 % de CTR en 14
días, del 2026-08-31 al 09-13) y **evoluciona native** (−20,3 %, 14 días). Las otras tres: −17,2 %,
−15,2 % y −0,6 %. Con «Completo» son 5 de 28, y evoluciona native cae −24,7 % en 20 días.

**El puente y las dos ventanas.** 248 de 276 contactos cruzan contra un anuncio guardado (**89,9 %**):
19 no traen nombre de pieza y 9 traen uno que no está en `negocio.anuncios` —`link_in_bio`, la
plantilla sin expandir, dos nombres sueltos—. La frase de las ventanas dice hoy *«Los contactos van
del 30 ago al 28 sep. El gasto, del 30 ago al 28 sep»*, y el aviso grave, *«No se cuentan 1 cita(s)
de este período…»* más *«9 de 14 pieza(s) no llegan a 10 contactos»*.

**Con «Hoy» y «7 días» casi no hay pantalla**: la cohorte es de 1 y 3 contactos, la subasta lista las
32 piezas con guiones —las 79 filas diarias existen, ninguna trae impresiones
y cada `sum` da nulo (`lib/negocio/costoDelAnuncio.ts:282-288`)— y el bloque de fatiga no se dibuja
(`components/creative/PanelDeCreative.jsx:563`). Con «Completo»: 570 contactos, 37 filas, y la más
grande es «agendamiento - yaping - 23/07» **sin etapa** (196 contactos, 16 % de agenda): son altas
del 2026-08-07 al 08-31 que no traen ningún nombre de campaña del que leer la etapa.

**No verificado:** cómo se ve. No abrí la pantalla (esta pasada no levanta servidores) y los dos
commits de construcción dejan la comprobación visual con sesión como pendiente (`3287f74`,
`332c0e6`). Lo de arriba es lo que el código dibuja con estos datos, no una captura.

---

## 3 · Lo que era maqueta y qué la reemplazó

La foto anterior contaba 13 juegos de datos inventados en `lib/aios/creative.js`; el archivo ya no
existe y sus líneas están en el historial de git. Lo que cada cosa fue, y lo que hay:

| la maqueta dibujaba | hoy |
|---|---|
| ocho piezas con nombre, formato, ángulo, dolor y siete métricas | las 32 piezas reales de 79 anuncios, por nombre normalizado |
| seis cifras de cabecera | el bloque de cobertura: el puente, las dos ventanas y el aviso |
| cinco criterios de orden elegibles | orden fijo: por volumen la calidad (`lib/negocio/calidadDelCreativo.ts:253-255`), por gasto la subasta (`lib/negocio/rendimientoDelCreativo.ts:360`); el criterio elegible no se construyó |
| la partición «Funciona / No funciona» por el promedio | borrada: con etapas mezcladas mandaba a pausar a las TOFU (`components/views/CreativeView.jsx:34-37`); hoy hay una tabla por etapa y ningún corte |
| la curva de retención y el guion con líneas rojas | **borrados sin reemplazo**, y es el único requisito que se borró en vez de postergarse (`components/views/CreativeView.jsx:27-33`) |
| el «Plan de acción», doce frases | borrado: diez no tenían fuente (`components/views/CreativeView.jsx:19-23`) |
| un selector de rango y cuatro presets propios | los cuatro botones de `PERIODOS` (`components/views/CreativeView.jsx:24-26`) |
| 18 puertas a un panel de catorce personas inventadas | borradas de Creative (`components/views/CreativeView.jsx:38-40`); el panel sigue en Executive |
| alcance, frecuencia, DM, interacción social, inversión y cierres por pieza | alcance y frecuencia no se agregan; la interacción (`postEngagement`) va en la nota de cada pieza; la inversión es el gasto consumido; DM por pieza y cierres no hay |

Del CSS se fueron 141 reglas muertas con la construcción y 41 más en la revisión del mismo día,
**182** en total, conservando las siete clases que parecían de Creative y están vivas en otras pantallas:
`.ghead`, `.filterbar`, `.db-info`, `.cls`, `.band`, `.legend` y `.read` (`3287f74`, `f9998b6`).

**El galón `›` del menú se quedó.** La foto anterior lo señalaba como el detalle que hacía que la
maqueta pareciera tan real como ICP & Oferta, porque nada en la interfaz avisaba que lo que se veía
era inventado. Se conservó a propósito: es del prototipo, y lo que estaba mal no era el adorno sino
que detrás no hubiera nada (`lib/autorizacion/secciones.ts:259-263`). Después del corte: desde la barra nueva de la etapa E10, el 2026-10-02, no se dibuja.

**Lo que Executive todavía inventa en nombre de Creative** (Executive sigue siendo maqueta):

- La tarjeta del mapa: «Piezas, hooks y ángulos», **«8 piezas activas»** y el punto verde
  (`components/views/ExecutiveView.jsx:292-305@c4cf2a8`). Medido: 32 piezas en 79 anuncios, y ninguna con una
  impresión desde el 2026-09-14.
- La ficha de reunión: «8 piezas activas · 3 sobre el promedio de agendas», un «hook nuevo» que subió
  el hook rate 4 puntos y bajó el cierre 7, y una «caída del VSL en 00:27» que Creative «asume»
  (`lib/aios/executive.js:182-185@c4cf2a8`); y Conversion que «entrega a Creative el drop del VSL»
  (`lib/aios/executive.js:189@c4cf2a8`). No hay cierres registrados ni medidor de VSL que dé un segundo.
- El panel ejecutivo: una alerta crítica «El hook nuevo está costando ventas» con la cadena
  Creative → Conversion → Sales (`lib/aios/executive-panel.js:12-16@c4cf2a8`), el cambio «Hook nuevo en
  Prospecting B» (`lib/aios/executive-panel.js:33-35@c4cf2a8`) y una reunión donde «se aprobó revertir el
  hook» (`lib/aios/executive-panel.js:92@c4cf2a8`).
- **Y adentro de la propia pestaña Creative**: el chat con Executive, abierto desde ella, ofrece
  «¿Qué ángulo replico?», «¿Por qué cayó la retención?» y «¿Qué pieza pauso?»
  (`lib/aios/executive-chat.js:20@c4cf2a8`, no comprobado en el navegador). Ángulo y
  retención no tienen fuente, y las tres preguntas caen en la respuesta por omisión, que habla de la
  landing y de 15.000 inventados (`lib/aios/executive-chat.js:31-32@c4cf2a8`, `lib/aios/executive-chat.js:77-83@c4cf2a8`).
- El cajón «Grupo de contactos» conserva las catorce personas inventadas, con orígenes del tipo
  «Creative 12» y montos de venta (`lib/aios/leads-group.js:13-29@c4cf2a8`); desde el 2026-09-26 lo abre
  sólo el embudo de Executive (`lib/aios/executive.js:49@c4cf2a8`), único emisor de `data-leads` que queda.

---

## 4 · Datos que ya tenemos

**1 · El nombre de la pieza**, en `negocio.contactos.atribucion_primera`, el `jsonb` de GoHighLevel.
Medido el 2026-09-28 sobre los 276 contactos de la ventana de 30 días; entre paréntesis, la foto del
2026-09-15 sobre 233 contactos de 14 días:

    utmContent (nombre de la pieza)    257 de 276   93,1 %    (220 de 233, 94,4 %)
    utmMedium  (nombre del adset)      259 de 276   93,8 %    (222 de 233, 95,3 %)
    utmTerm    (id del ad set)          51 de 276   18,5 %    (no medido)
    campaign   (nombre de campaña)     250 de 276   90,6 %    (217 de 233, 93,1 %)
    adId       (el meta_ad_id)         199 de 276   72,1 %    (176 de 233, 75,5 %)
    fbclid                              55 de 276   19,9 %    (42 de 233, 18,0 %)
    atribucion_primera vacía             1 de 276    0,4 %    (0 de 233)

Doce nombres de pieza distintos y once `adId` distintos en la ventana. `mediumId` no es el ad set
(es el formulario o el calendario) y el ad set llega en `utmTerm`, corregido el 2026-09-16 y
guardado como `negocio.anuncios.meta_conjunto_id`. En la base entera: 594 contactos, 570 con alta,
506 con `utmContent` (85,2 %) y **213 con `adId`, los mismos 213 del 2026-09-16**: el último
contacto con `adId` es del 2026-09-13 05:13 UTC.

**2 · Lo que llegó de Meta, por GoHighLevel.** `negocio.anuncios`: 79 anuncios de 12 campañas, 59 con
ad set; son **32 piezas**, 21 en más de un anuncio, hasta seis (igual que el 2026-09-18).
`negocio.metricas_de_anuncio`: 3.318 filas anuncio-día del 2026-08-18 al 2026-09-28, **266 con
impresiones, todas hasta el 2026-09-13**, 3.511,28 de gasto en total; el desglose de acciones desde
el 2026-08-21. Sobre las 240 filas con desglose y entrega, `videoView` 224 (93,3 %), `linkClick` 171
(71,3 %), `landingPageView` 150 (62,5 %) y `postEngagement` 225 (93,8 %): **idénticas** a las del
2026-09-19 (`lib/negocio/rendimientoDelCreativo.ts:18-20`), porque no hubo entrega nueva. En la
ventana de 30 días son 134 filas: 91,0 %, 70,9 %, 64,9 % y 91,8 %.

**La pauta está sin entrega desde el 2026-09-14.** Por semana: 60 filas con impresiones la del 7 de
septiembre, **cero** las del 14, el 21 y el 28, con el colector escribiendo todos los días (última
pasada el 2026-09-28 06:20 UTC, la tarea diaria de `lib/negocio/barrido.ts:242-246`). Los contactos
nuevos caen igual: 89 la semana del 7, 4, 3 y 1 después. Es consistente con que la pauta se apagó y
no con una ingesta rota —el barrido de contactos también corre—, lo mismo que midió Conversion
(`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:178-191`). **No verificado contra la
cuenta publicitaria**: por qué se apagó no está en esta base.

**3 · El ICP por contacto.** «Puntaje | ICP» es número en **271 de 276** (98,2 %); 22 de esos valen
exactamente 0. Desde la `055` (2026-09-21) el mismo puntaje se copia a `contactos.score`, que está en
270 de 276. Creative lee el campo del CRM por su nombre exacto (`lib/negocio/calidadDelCreativo.ts:62`);
Leads Portal lee la columna. El 2026-09-15 la columna estaba en 0 de 233.

**4 · Las agendas por pieza.** Cruce por `tieneCitaAlcanzable` (`lib/negocio/citasAlcanzables.ts:135-145`),
en la tabla del § 2. Las citas de los 276 contactos son 156, y **una** está congelada.

**5 · El Espía de Anuncios**, en Tools (`components/tools/EspiaDeAnuncios.jsx`,
`app/api/tools/espia/route.ts`): pide a la IA hooks, ángulos y estructuras de copy de anuncios de la
competencia (`lib/tools/espia.ts:84-92`). Sigue siendo la única capacidad del producto que lee una
pieza, y mira hacia afuera. Y `public.closer_meta_metricas`, de la plataforma anterior, sigue con 0
filas: ya no hace falta, porque la `050` dio tablas propias y la `053`, la columna del desglose.

---

## 5 · Datos que faltan, y de dónde tendrían que venir

**Los huecos que el código declara y la pantalla dibuja**, medidos contra la API el 2026-09-18
(`lib/negocio/rendimientoDelCreativo.ts:140-168`):

- **La curva de retención y los cuartiles**: `fields` es un enum cerrado de once valores y
  `video_p25_watched_actions` y el resto dan 422 (`docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md:133-170`).
- **El placement y los desgloses demográficos**: `groupBy` sólo acepta `day`, `week` y `month`
  (`docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md:174-191`).
- **El activo creativo** —imagen, video, copy, miniatura—: `/entity` devuelve cuatro campos y
  `/creatives`, `/videos` y `/posts` dan 404 (`docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md:195-236`).
- **El formato y la duración**: no vienen; se podrían inferir del nombre —hay piezas que se llaman
  «horizontal», «native», «vsl»— y es una decisión sin tomar.

Los cuatro sólo se cierran con Meta directo: una app, un token de larga duración y una revisión de la
plataforma (`docs/creative/13-EL-CONTRASTE.md:161-164`). No hay cliente de la API de Meta en el
repositorio: buscando `graph.facebook` en `lib/`, `app/` y `scripts/` no aparece ninguno.

**Tres que llegan y no se usan, a propósito:**

- **La frecuencia y el alcance** llegan por día y por anuncio, y no se agregan: sumarlos cuenta varias
  veces a la misma persona (`lib/negocio/costoDelAnuncio.ts:115-125`,
  `lib/negocio/fatigaDelCreativo.ts:6-19`).
- **`results.lead`** es de Meta y suma dos mecanismos de conteo que ocurren en los mismos anuncios;
  dividirlo por impresiones publicaría el doble (`lib/negocio/rendimientoDelCreativo.ts:100-123`,
  `docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md:313-339`).
- **Qué cuenta `videoView`** no está documentado; la pantalla lo dice en su aviso
  (`lib/negocio/rendimientoDelCreativo.ts:599-604`,
  `docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md:271-279`).

**Los umbrales, sin calibrar.** El piso de 1.000 impresiones, los ocho días de serie y el 20 % de
caída están declarados como no calibrados contra nada, y el § 18.19 los tiene pendientes
(`lib/negocio/rendimientoDelCreativo.ts:58-61`, `lib/negocio/fatigaDelCreativo.ts:47-51`,
`lib/negocio/fatigaDelCreativo.ts:62-66`).

**Del cierre.** `negocio.resultados` sigue con **7 filas y cero ventas** (4 `seguimiento`, 2
`no_show`, 1 `no_interesa`), igual que el 2026-09-15. Sin ventas no hay CPA, ROAS ni «qué pieza
genera más dinero», que es lo que el § 18.1 dice que hay que cruzar.

**De la asistencia.** `negocio.citas.asistio` tiene **0 no nulos de 333 citas**. Del embudo por pieza
se mide contacto → cita, y ahí se corta.

**De la pieza misma.** `negocio` tiene hoy 29 tablas (21 el 2026-09-15) y ninguna guarda un video, un
copy, un guion ni una miniatura propios: `negocio.anuncios` son siete columnas —organización, tres
identificadores, nombre, objetivo y fecha de sincronización—. La entidad `Creative Profile` del
§ 5.1 no existe.

**De la landing y del VSL, que no son de este departamento.** La foto anterior dejó abierto por qué
«Form Landing VSL» dejó de escribirse el 2026-08-31 y «VSL % máximo visto» el 2026-08-30. Conversion
midió después que el recorrido cambió ese mismo día: en agosto el 58 % pasaba por la landing del VSL
y en septiembre el 13 %
(`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:29-36`); por qué, no se sabe
(`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:232-238`). El campo «VSL % máximo
visto» son 79 escrituras y 79 ceros (`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:127-138`).
Creative no lee ninguno de los dos; ver [03-CONVERSION.md](03-CONVERSION.md). No re-medidos acá.

---

## 6 · Reglas propias de este departamento

Las diez de la foto anterior se volvieron requisitos numerados en `docs/creative/` y casi todas están
en el código. Cada una, con lo que la sostiene hoy y su cifra re-medida:

**1 · La unidad es la PIEZA, no el anuncio — y agrupar por `adId` borra una campaña entera.** La llave
es el nombre normalizado, en un solo lugar (`lib/negocio/creativo.ts:44-46`). Re-medido: `adId` está
en 199 de 276 (72,1 %), y **esos 199 son exactamente los 199 contactos de TOFU**; ninguno de los 45
de BOFU ni de los 32 sin etapa lo trae. El 2026-09-15 eran 176 de 233 y los 39 de BOFU tampoco.
Agrupar por anuncio haría desaparecer la etapa de mejor ICP (71,0) y mejor agenda (78 %) sin fallar.

**2 · El mismo creativo vive en varios anuncios, y ésa es la premisa del departamento.** 79 anuncios
son 32 piezas y 21 corren en más de uno, hasta seis (medido hoy). Un ranking por anuncio partiría la
pieza en filas con una fracción de su gente cada una. La columna «Anuncios» es además la única
mitigación de que dos piezas distintas con el mismo nombre se fundan
(`lib/negocio/calidadDelCreativo.ts:85-93`).

**3 · TOFU y BOFU no se comparan, en ninguna cifra de conversión.** En código: se agrupa por (pieza,
etapa) (`lib/negocio/calidadDelCreativo.ts:231`) y se dibuja una tabla por etapa
(`components/creative/PanelDeCreative.jsx:294-334`). Re-medido: BOFU 78 % de agenda, TOFU de 31 % a
43 %; el 2026-09-15 eran 83,9 % contra 36,8-45,7 %. La etapa se lee del segmento del nombre de
campaña, y lo que no trae segmento es un grupo aparte, no una etapa forzada
(`components/creative/PanelDeCreative.jsx:343-347`).

**4 · Los nombres se normalizan antes de agrupar.** En la ventana hay 12 cadenas de campaña crudas y
10 en mayúsculas. La etapa ya no depende de eso —se lee por segmento exacto, no por el nombre entero
ni por `like` (`lib/negocio/creativo.ts:53-66`)—, pero cualquier corte futuro por campaña tiene que
normalizar igual. Los nombres de pieza: 12 crudos, 12 normalizados.

**5 · Dos caminos de adquisición conviven bajo la misma pieza.** «Meta Lead ID» está en 110 de 276
(39,9 %) y «Last Landing URL» en 119 (43,1 %); el 2026-09-15 eran 89 y 99 de 233, y «agendamiento -
yaping» tenía 43 leads de formulario y 21 con landing de 109, contra 0 y 31 de «Evoluciona native».
Hoy: 46 y 22 de 112 contra 0 y 36 de 36. **Y un matiz nuevo, medido: «Last Landing URL» no es la
landing del VSL.** De los 119, 56 apuntan al host de la landing y casi todo el resto al widget del
calendario o a Facebook; de los 49 contactos de Lead Ads que traen URL, 4 muestran la landing
(agregado por host de la URL, sin leer ninguna entera). Cualquier cifra de
landing o de VSL por pieza tiene como denominador a los que pasaron por el host de la landing, no a
los que traen el campo. No está construida en pantalla.

**6 · El campo que se LLAMA «Anuncio» es el peor de los dos.** «Last UTM Content (Anuncio)» está en 112
de 276 (40,6 %); el `utmContent` del `jsonb`, en 257 (93,1 %): 2,3 veces más en el lugar que no lleva
el nombre (el 2026-09-15, 85 contra 220, 2,6 veces).

**7 · El piso y la ventana son los del proyecto — y el sesgo de la ventana es de las CITAS, no de los
CONTACTOS.** `PISO_DE_UNA_TASA = 10` (`lib/negocio/indicadoresDeCitas.ts:309`) rige cada denominador
por separado (`lib/negocio/calidadDelCreativo.ts:244-249`); `DIAS_DE_LA_TASA = 14`
(`lib/negocio/indicadoresDeCitas.ts:319`) es sólo el valor por omisión de los módulos, porque la ruta
siempre pasa el período.

- **Las citas SÍ envejecen** (congeladas = `ghl_calendario_id is null`). Sobre citas ya ocurridas, el
  2026-09-15: 14 días 147 alcanzables y 11 congeladas (7,0 %); 30 días 206 y 77 (27,2 %); completo
  206 y 101 (32,9 %), y «Completo» no agregaba ni una alcanzable sobre «30 días». **Re-medido el
  2026-09-28** con la definición que reproduce las 101 del total: 30 y 0 (0,0 %), 194 y 14 (6,7 %),
  230 y 101 (30,5 %). La ventana corrió y el sesgo con ella; el de «Completo» sigue.
- **Los contactos NO envejecen**: la cohorte se arma con `alta_en_el_crm`, que el barrido reescribe
  tal como viene (`lib/negocio/sincronizar.ts:442`). Una ventana ancha sólo agrega denominador.
- **Cuánta más señal, medido el 2026-09-16:** 14 días → 4 creativos sobre el piso; 30 días → 18
  distintos y 6 sobre el piso. **El 2026-09-28**: 14 días → 8 contactos y ninguna pieza sobre el
  piso; 30 días → 12 nombres y 4 piezas más «sin creativo» sobre el piso.
- **La condición para una ventana ancha en una cifra de citas** se cumple: las congeladas viajan en
  la misma pasada (`lib/negocio/calidadDelCreativo.ts:137-142`) y se dicen con el texto de
  `tasaDeCancelacion` (`lib/negocio/calidadDelCreativo.ts:363-371`,
  `lib/negocio/indicadoresDeCitas.ts:526-528`).
  El módulo las cuenta sobre la cohorte de contactos, no por fecha de cita: 1 de 156 hoy.

**8 · «Sin creativo» es un grupo, no un descarte.** `llaveOSinCreativo` devuelve nulo y ese nulo es
una fila (`lib/negocio/creativo.ts:49-51`). Re-medido: 19 de 276 sin `utmContent`, 15 con cita
(79 %); el literal `{{ad.name}}` sin expandir, en 2 contactos, cae en «no cruza» con su nota.

**9 · Las cifras se miden sobre `alta_en_el_crm`, y hay que decir desde cuándo.** La `048` lo dejó
escrito (`db/migraciones/048_de_donde_vino_el_lead.sql:53-54`) y la pantalla dice la fecha real de
la cohorte (`components/creative/PanelDeCreative.jsx:274-284`). `adId` sigue en 35 contactos de
agosto y 178 de septiembre: la diferencia es la ingesta, no el rendimiento.

**10 · Lo que Creative NO calcula.** El gasto se consume de `costoDelAnuncio`, no se vuelve a sumar
(`lib/negocio/rendimientoDelCreativo.ts:32-41`); el conteo de leads sale de contactos nuestros y no
de `results.lead`; la retención del VSL es de Conversion, el video precall de Conversation, el revenue
y el CAC de Business. Si Creative recalcula alguno, dos pantallas mostrarán dos números para lo
mismo. Lo que cambió es el porqué: no es la fuente, es el grano (§ 1).

**11 · Una cifra por contacto se cuenta por contactos, no por sus citas.** Medido el 2026-09-15:
cruzar contactos con `negocio.citas` con un `left join` y contar con `count(*)` inflaba
«agendamiento - yaping» de 109 a 112 y «Evoluciona native» de 31 a 36, porque hay contactos con más
de una cita.
Hoy se cuenta con un `exists` compartido, `tieneCitaAlcanzable`, y no con un `join`
(`lib/negocio/calidadDelCreativo.ts:225`, `lib/negocio/citasAlcanzables.ts:116-145`).

---

## 7 · Riesgos

**1 · La pantalla describe con precisión un período que terminó, y no lo dice.** Desde el 2026-09-14
no hay impresiones, pero el colector escribe las 79 filas de cada día, así que las fechas del gasto
son las de las filas y no las de la entrega (`lib/negocio/costoDelAnuncio.ts:381-406`): la frase
dice «El gasto, del 30 ago al 28 sep» sobre un gasto que termina el 13. El aviso de «ventana
incompleta» de `costoDelAnuncio` no se enciende por lo mismo, y Creative no lo lee. Lo único que lo
delata es la nota de cada pieza, detrás de un ícono. **Si la pauta no vuelve, desde el 2026-10-13 la
ventana de 30 días ya no contiene ningún día con entrega**: la subasta queda en guiones, la fatiga
desaparece y la cohorte baja a la decena. Es la distinción que Conversion ya pidió, «no hay tráfico»
no es «no hay dato» (`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:190-191`).

**2 · El mismo ICP se lee distinto en dos pantallas construidas.** Creative promedia los ceros como
ceros (`lib/negocio/calidadDelCreativo.ts:209`, `lib/negocio/calidadDelCreativo.ts:218`); Leads
Portal cuenta el 0 como «sin calificar» desde el 2026-09-26 (`lib/negocio/tramosDelIcp.ts:85-86`,
`lib/negocio/leadsDelPortal.ts:287`). Medido: 22 ceros en la cohorte de 30 días, **18 de ellos en
«agendamiento - yaping»**, que da ICP 42,7 con ceros y 50,8 sin ellos — y con eso el orden de TOFU
entre esa pieza y «el app» (45,4) se da vuelta según la lectura del cero que se use. Además leen dos copias
del mismo puntaje: Creative el campo del CRM (271 con número) y Leads Portal `contactos.score` (270).
Es la pregunta (b) de la foto anterior, decidida —no contestada— en una pantalla y no en la otra.

**3 · El CTR bajo el piso sale como un guion pelado.** La celda es `pct(f.ctr) ?? '—'`
(`components/creative/PanelDeCreative.jsx:481`), sin la nota que `CeldaDeAccion` agregó para las otras
tres tasas justamente por esto (`components/creative/PanelDeCreative.jsx:506-558`). En 30 días, 26 de
32 piezas no tienen CTR: 18 porque no entregaron y 8 porque no llegan a mil impresiones, y se ven
igual. Las impresiones, los clics, el CPM y el CPC viajan en la respuesta y no se dibujan, aunque el
módulo dice que viajan para que se vea sobre qué base se calló
(`lib/negocio/rendimientoDelCreativo.ts:349-350`).

**4 · «Hoy» dice 24 horas y calcula el día.** El botón lleva de título el matiz de `PERIODOS`, *«Las
últimas 24 horas, no el día del calendario»* (`lib/negocio/periodo.ts:84`,
`components/creative/PanelDeCreative.jsx:121`), y los tres módulos calculan el día de calendario, como
`costoDelAnuncio` deja escrito para su pantalla (`lib/negocio/costoDelAnuncio.ts:58-63`). En la sesión
de mi medición `current_date` es UTC y la organización es de `America/Lima`; la zona de la sesión de
la aplicación no la verifiqué. Además Leads Portal arma su «30 días» con `now()` móvil
(`lib/negocio/leadsDelPortal.ts:300`): hoy 277 contactos contra los 276 de Creative, con la misma
etiqueta.

**5 · La ventana de la cohorte está escrita cuatro veces en `calidadDelCreativo`.** Las líneas
`lib/negocio/calidadDelCreativo.ts:228`, `lib/negocio/calidadDelCreativo.ts:266`,
`lib/negocio/calidadDelCreativo.ts:283` y `lib/negocio/calidadDelCreativo.ts:330` repiten a mano el
predicado que `lib/negocio/recorrido.ts:197-199` exporta como «un solo lugar», y `costoDelAnuncio`
suma dos más (`lib/negocio/costoDelAnuncio.ts:346` sus leads, `lib/negocio/costoDelAnuncio.ts:368` su
cobertura de `adId`). Hoy son idénticas; si una cambia, la misma etiqueta cubrirá dos ventanas distintas.

**6 · Un `results` con otra forma se tiraría en silencio.** `desglose()` devuelve `acciones: null` y
cero ilegibles cuando llega un arreglo (`lib/ghl/anuncios.ts:208-209`), que es como la API nativa de
Meta entrega las acciones. La pregunta abierta pide lo contrario —contarlo como ilegible
(`docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md:410-415`)—, y la evidencia es de una sola cuenta.
Con otra, el hook rate y las tasas de enlace pasarían a «el proveedor no reportó» sin ningún contador.

**7 · Los comentarios de los módulos citan líneas que se corrieron.** Varias citas a
`costoDelAnuncio` y a `indicadoresDeCitas` dentro de los tres módulos resuelven y muestran otra cosa:
el defecto de grano que citan está hoy en `lib/negocio/costoDelAnuncio.ts:188-194`, el alcance que no
se suma en `lib/negocio/costoDelAnuncio.ts:115-125`, el `gasto is not null` en
`lib/negocio/costoDelAnuncio.ts:288` y el conteo de congeladas de `tasaDeCancelacion` en
`lib/negocio/indicadoresDeCitas.ts:350`. Una línea corrida no falla: manda a leer otra cosa.

**8 · Executive publica un Creative sano y activo.** «8 piezas activas» con punto verde, y un «hook
nuevo» que cuesta ventas (§ 3), mientras la base dice 0 piezas con entrega desde el 2026-09-14 y 0
ventas registradas. Mientras Executive sea maqueta, publica en nombre de Creative cifras que la base desmiente.

**De la foto anterior, lo que ya no es riesgo:** la recomendación de guion sobre una curva fabricada
(la curva se borró); ordenar por `adId` (la llave es el nombre); mezclar TOFU con BOFU (una tabla por
etapa); los catorce nombres con montos abiertos desde Creative (las 18 puertas se fueron). **Lo que
sigue:** prometer cierres por pieza con siete resultados y cero ventas, y tomar el cero del medidor
del VSL por comportamiento —hoy no, porque Creative no lo lee—.

**Pendientes que no pude verificar:** (a) cómo se ve la pantalla con sesión iniciada, que tampoco
comprobaron los commits de construcción; (b) por qué se apagó la pauta: la base es consistente con
una decisión y no con una falla, y no lo prueba; (c) qué cuenta `videoView`; (d) la zona horaria de
la sesión de la aplicación, que decide dónde empieza «Hoy»; (e) si `public.closer_meta_metricas` se
llenó alguna vez en la plataforma anterior —lo único medido es que tiene 0 filas—.

---

> **Después del corte, 2026-09-29 y 30.** Entraron el link manual por pieza (`1159c43`, tabla
> `negocio.enlaces_de_pieza`), el cajón de la pieza con sus anuncios (`8fd0afd`,
> `components/creative/FichaDelCreativo.jsx`) y la credencial de Meta en Ajustes (`ecfbc26`,
> `lib/credenciales/resolver.ts:607`), con los requisitos en `docs/creative/15-LA-MINIATURA-Y-EL-VIDEO.md`.
> Lo del § 5 sigue siendo cierto: todavía no hay cliente de la API de Meta. La miniatura y el video
> quedaron **postergados** hasta que haya token; el plan está en
> `docs/OTROS/futuro/miniatura-y-video-de-meta.md`.
