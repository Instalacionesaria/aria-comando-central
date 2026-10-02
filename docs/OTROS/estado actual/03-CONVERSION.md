# Conversion Intelligence
> Corte: **2026-09-28**. Medido contra producción ese día, de 18:03 a 18:25 UTC, con
> `scripts/supabase.mjs leer` (sólo lectura, sólo agregados); re-medido el 2026-09-29 a las 00:15 UTC
> con `current_date` fijada al 28, y las cifras principales coinciden. Cada afirmación lleva su
> `archivo:línea` o su consulta, y lo no re-medido dice su fecha. Para ubicar lo nombrado, ver
> [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md). `docs/conversion/` dice que el estado de cada
> dato sale de este archivo «medido el 2026-09-15»: desde hoy sale de esta versión, y la anterior se
> lee con `git show 93a1341:"docs/estado actual/03-CONVERSION.md"`.

**Construida desde el 2026-09-20.** La pestaña dejó de ser una maqueta de 655 líneas y dibuja, desde
`app/api/conversion/route.ts`, dos bloques medidos —por dónde entró la gente, en siete familias que
suman la cohorte, y cuántos abandonan el formulario de la landing— más cinco huecos declarados en
pantalla. El titular de hoy no es de código sino de población: **el formulario de la landing se
escribió por última vez el 2026-08-31 y la pauta está en cero desde el 2026-09-14**. En la ventana
con la que abre la pantalla (30 días) hay 276 contactos y sólo 5 traen el formulario, así que la
tasa sale «—»; desde el 2026-09-30 esa ventana deja de alcanzar el corte y el formulario sólo existe
en «Completo»: 247 de 570 contactos, 64,8 % de finalización, todos de antes de septiembre.

> **Desde el corte del 2026-09-15**
>
> - **2026-09-20 · `f2634d0`** — nace `docs/conversion/`: quince archivos, 2.602 líneas, prefijo
>   `CV`, con la medición de que el embudo cambió de ruta el 2026-08-31.
> - **2026-09-20 · `b767c2a`** — etapa 0: `closeReco()` no existía en ningún archivo de la
>   aplicación; el clic en el plan de acción de la maqueta lanzaba `ReferenceError`.
> - **2026-09-20 · `7ec7be7`** — etapa A: no hace falta ninguna migración, y los 115 «sin URL» no eran
>   un agujero: 89 eran una familia con nombre (formulario nativo de Meta) y 26, atribución vacía.
> - **2026-09-20 · `4da946d`** — etapa B: `recorrido.ts`, `recorridoDelLead.ts`,
>   `embudoDelFormulario.ts`, `vistaDeConversion.ts` y 23 pruebas. La tasa de agenda por familia
>   salió circular al medirla y se retiró antes de llegar a la pantalla.
> - **2026-09-20 · `0add4cc`** — etapas C y D: se borra `lib/aios/conversion.js` (655 líneas),
>   entran la ruta y `components/conversion/PanelDeConversion.jsx`, y baja la bandera
>   `sinOperacionesTodavia` de la sección.
> - **2026-09-20 · `00e251d`** — tres defectos que sólo se veían con la pantalla abierta: la lista
>   «A y B y C», un rótulo desalineado y el ancho de teléfono, que era del armazón y se arregló esa
>   noche para las doce pantallas (`1020412`: a 375 px al cuerpo le quedaban 75; `0810498`: las doce
>   con `doc=375`). El corte está en `app/armazon.css:382-395` y lo fija
>   `pruebas/codigo/162-el-armazon-en-un-telefono.test.ts`; hoy no se miró en el navegador.
> - **2026-09-21 · `1164984`** — el «agendó» pasa a un predicado compartido, `tieneCitaAlcanzable`,
>   que Conversion usa en sus dos módulos.
> - **2026-09-26 · `db120a1`** — `hostDe` se exporta: la ficha de Leads Portal usa la clasificación
>   de Conversion. Primer consumidor de este departamento fuera de su pantalla.
> - **2026-09-28 · `e630823`, `1c55149`** — las rutas de los documentos pasan a `docs/OTROS/`.

---

## 1 · Qué pide el documento

El documento funcional (`CC_Arquitectura_Funcional.md`, 1.651 líneas) **no está versionado en este
repositorio**, así que sus números de línea se citan como los dejó
`docs/conversion/10-LO-QUE-PIDE-EL-DOCUMENTO.md:3`, que lo leyó entero el 2026-09-20. La
especificación está en esa carpeta; acá va el resumen, con lo que cambió desde el corte anterior.

- **§ 17 lo declara pendiente de especificación**, y sigue así: no hay KPIs, umbrales, responsables
  ni deslinde entre sus dos submódulos (`docs/conversion/10-LO-QUE-PIDE-EL-DOCUMENTO.md:127-139`).
  La pantalla que se construyó eligió qué publicar sin esa lista; ver § 7, riesgo 9.
- **§ 18.11 le pone una sola frase en boca**: *«La finalización del formulario es baja»*
  (`docs/conversion/10-LO-QUE-PIDE-EL-DOCUMENTO.md:26-33`). Es lo que contesta el bloque del
  formulario (`lib/negocio/embudoDelFormulario.ts:4-12`).
- **§ 4 le da dos submódulos**, Landing Intelligence y VSL Intelligence
  (`docs/conversion/10-LO-QUE-PIDE-EL-DOCUMENTO.md:39-48`). Hoy la pantalla tiene el primero a medias
  —el reparto y el formulario— y el segundo entero como hueco declarado.
- **§ 5.1 y § 5.3 piden tres entidades y un historial**: `Landing Session`, `VSL Session` y
  `Form Submission`, y que la reproducción del VSL conserve historial en vez de un valor fijo en el
  contacto (`docs/conversion/10-LO-QUE-PIDE-EL-DOCUMENTO.md:50-61`). Ninguna existe; ver abajo, § 5.
- **§ 5.2 pone `visitor_id → session_id` en el centro de la traza**
  (`docs/conversion/10-LO-QUE-PIDE-EL-DOCUMENTO.md:63-76`). Ningún código del repositorio los usa:
  los dos nombres sólo aparecen en dos comentarios, medido hoy con `grep`.
- **§ 9.5 pide un trigger link con seis estados** (`docs/conversion/10-LO-QUE-PIDE-EL-DOCUMENTO.md:91-98`).
  Lo único que queda de él es su huella en el último toque: 31 de 594 contactos, medido hoy.
- **§ 9.7 pone `landing visit rate`, `form start rate` y `form completion rate` bajo Lead Flow**, no
  bajo Conversion (`docs/conversion/10-LO-QUE-PIDE-EL-DOCUMENTO.md:100-104`). Se construyó en
  Conversion y el solapamiento queda declarado (`docs/conversion/01-LOS-DOS-RECORRIDOS.md:259-265`).
- **§ 10.6, el video precall, es de Appointment Flow**, y está construido en
  `lib/negocio/consumoDelPrecall.ts`. Conversion no lo publica; ver § 6, regla 7.
- **§ 18.16 enumera lo que Acquisition le debe**: campaña y anuncio de origen, calidad del tráfico,
  CTR, *landing page views* y diferencias por audiencia y placement
  (`docs/conversion/07-LO-QUE-ENTREGA-Y-RECIBE.md:29-39`).

El corte anterior afirmaba que de las cinco promesas del § 18.16 «ninguna llega hoy», y nombraba
«Landing page views» entre las inexistentes. **Dejó de ser cierto el 2026-09-19** (lo corrigió
`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:202-216`). Estado de las cinco al
2026-09-28:

| promesa | estado | de dónde |
|---|---|---|
| campaña y anuncio de origen | **llega**: `adId` en 213 de 594 contactos, `utmContent` en 506 | `atribucion_primera`, medido hoy |
| calidad del tráfico | **no está definida**: el documento no dice qué es | `docs/conversion/07-LO-QUE-ENTREGA-Y-RECIBE.md:36` |
| CTR | **llega**, por anuncio y por día, pero sin entrega desde el 2026-09-14 | `negocio.metricas_de_anuncio`, medido hoy |
| *landing page views* | **llega desde el 2026-09-19**: 150 de 240 filas anuncio-día con entrega y desglose (63 %), igual que el 2026-09-19 porque no hubo entrega nueva; último día con la clave, 2026-09-13 | `lib/negocio/rendimientoDelCreativo.ts:96`, medido hoy |
| audiencia y placement | **no llega**: GoHighLevel sólo agrupa por día, semana o mes | del 2026-09-20, no re-medido: `docs/conversion/07-LO-QUE-ENTREGA-Y-RECIBE.md:39` |

Las *landing page views* son un agregado de Meta por anuncio y por día: no son sesiones ni se pueden
cruzar con un contacto. Conversion no las usa; las publica Creative.

---

## 2 · Qué hay hoy en pantalla

**La sección.** `conversion` se registra en `lib/autorizacion/secciones.ts:264-275` con
`capacidadRequerida: 'tablero.ver'` y **sin** `sinOperacionesTodavia`: la bandera bajó con la ruta,
porque `ADR-0304` exige que las dos se muevan juntas (`lib/autorizacion/secciones.ts:268-270`): la
décima salida de la lista, quinta vez que el cable dispara (`pruebas/codigo/90-fundaciones.test.ts:1172-1174`).
El galón del menú se quedó, por el precedente de Creative (`lib/autorizacion/secciones.ts:272-273`).

**La ruta.** `GET /api/conversion?periodo=…` (`app/api/conversion/route.ts:45-70`) pide `tablero.ver`
por el portero (`app/api/conversion/route.ts:49`), **rechaza** con 400 un período que no está en la
lista en vez de corregirlo (`app/api/conversion/route.ts:52-56`), le pasa **la misma ventana** a los
dos módulos (`app/api/conversion/route.ts:58-61`) y devuelve la clave del período que usó
(`app/api/conversion/route.ts:63-69`). El lector del navegador exige el período, sin valor por
omisión (`lib/negocio/vistaDeConversion.ts:36-48`).

**La vista.** `components/views/ConversionView.jsx` (79 líneas) es una cáscara: su encabezado dice qué
se tiró y por qué (`components/views/ConversionView.jsx:21-44`), la bajada cambió a *«Por dónde entra
la gente, y quién abandona el formulario»* (`components/views/ConversionView.jsx:69`) y monta el panel
(`components/views/ConversionView.jsx:74`).

**El panel.** `components/conversion/PanelDeConversion.jsx` (478 líneas) dibuja, en este orden
(`components/conversion/PanelDeConversion.jsx:158-169`):

1. **La barra de períodos**, siempre presente (`components/conversion/PanelDeConversion.jsx:83-86`),
   con los cuatro de `lib/negocio/periodo.ts:83-96`. Abre en **30 días**
   (`lib/negocio/periodo.ts:109`, `components/conversion/PanelDeConversion.jsx:48`) y enciende el
   botón que el servidor contestó, no el que se pidió (`components/conversion/PanelDeConversion.jsx:85`).
   Se recarga cada 60 segundos sólo con la pestaña a la vista
   (`components/conversion/PanelDeConversion.jsx:76-78`, `lib/cadencia.ts:90`).
2. **«Cuánto vale lo que dice esta pantalla»** (`components/conversion/PanelDeConversion.jsx:179-247`):
   la cobertura del recorrido (contactos con dirección sobre la cohorte), la cobertura del formulario
   (contactos con el campo sobre la cohorte) y el rango real de cada bloque, que casi nunca es la
   ventana pedida (`components/conversion/PanelDeConversion.jsx:237-244`).
3. **«Por dónde entró la gente»** (`components/conversion/PanelDeConversion.jsx:256-323`): una fila
   por familia con contactos, porción de la cohorte y **un conteo** de agendados, no una tasa. Al lado
   del nombre, una nota cuando al menos el 90 % de la fila tiene la dirección registrada al reservar
   (`components/conversion/PanelDeConversion.jsx:334-347`), y al pie el aviso del servidor.
4. **«Cuántos abandonan el formulario de la landing»**
   (`components/conversion/PanelDeConversion.jsx:362-413`): los tres estados del campo, la tasa de
   finalización —o «—» con el rótulo «no alcanza para una tasa»
   (`components/conversion/PanelDeConversion.jsx:383-386`)— y la contradicción entre lo que dice el
   campo y lo que dicen las citas (`components/conversion/PanelDeConversion.jsx:424-436`).
5. **«Lo que esta pantalla no puede medir»** (`components/conversion/PanelDeConversion.jsx:458-478`):
   los cinco huecos, bajo un encabezado fechado el 20 de septiembre
   (`components/conversion/PanelDeConversion.jsx:466-467`). Ver § 5.

**Los módulos.** `lib/negocio/recorrido.ts` (315 líneas) tiene la clasificación: siete familias
(`lib/negocio/recorrido.ts:55-63`), sus rótulos (`lib/negocio/recorrido.ts:68-94`), la lista de hosts
(`lib/negocio/recorrido.ts:107-116`), el `case` de tres ramas (`lib/negocio/recorrido.ts:139-167`), la
ventana (`lib/negocio/recorrido.ts:197-199`) y el corte de época (`lib/negocio/recorrido.ts:247-284`).
`lib/negocio/recorridoDelLead.ts` (283) hace el reparto y `lib/negocio/embudoDelFormulario.ts` (304)
el formulario y los huecos. Las pruebas son 24: 13 en `pruebas/base/160-recorrido-del-lead.test.ts` y
11 en `pruebas/base/161-embudo-del-formulario.test.ts`, contadas hoy por `grep`; no las corrí.

**Ventanas y pisos.**

- **La cohorte es por alta en el CRM, anclada al día**: `alta_en_el_crm` desde la medianoche del
  primer día de la ventana, `dias - 1` días antes de `current_date` (`lib/negocio/recorrido.ts:197-199`).
  La zona de la base es UTC (`current_setting('TimeZone')`, leído hoy por la vía de lectura; la de la
  conexión de la aplicación no la verifiqué). Un contacto sin alta no entra en ninguna ventana.
- **El corte se detecta del dato**: el último día con `Form Landing VSL` escrito
  (`lib/negocio/recorrido.ts:234-245`), y viaja con `laVentanaLoCruza` en las dos respuestas.
- **Pisos**: la finalización exige al menos `PISO_DE_UNA_TASA = 10` contactos con el campo
  (`lib/negocio/embudoDelFormulario.ts:235-237`, `lib/negocio/indicadoresDeCitas.ts:309`); la porción de
  cada familia se publica sin piso porque es un conteo exacto (`lib/negocio/recorridoDelLead.ts:191-194`);
  el aviso de circularidad exige 10 contactos y el 90 % (`lib/negocio/recorridoDelLead.ts:263-265`), y la
  nota por fila sólo el 90 % (`components/conversion/PanelDeConversion.jsx:337`).
- **El valor por omisión de los módulos es `DIAS_DE_LA_TASA = 14`**
  (`lib/negocio/indicadoresDeCitas.ts:319`, `lib/negocio/recorridoDelLead.ts:135`), pero la ruta
  siempre pasa el período, así que la pantalla nunca mide catorce días.

**Lo que dibujaría hoy**, reproduciendo las consultas de los dos módulos a mano, medido el 2026-09-28
a las 18:04 UTC. **No abrí la pantalla** (no se levantan servidores en este trabajo): esto es lo que
el código calcula sobre la base, no una captura.

| | Hoy | 7 días | **30 días** (abre) | Completo |
|---|---|---|---|---|
| empieza | 2026-09-28 | 2026-09-22 | 2026-08-30 | 2016-10-01 |
| cohorte (contactos con alta) | 1 | 3 | **276** | 570 |
| con dirección en el último toque | 1 | 2 | 203 (74 %) | 477 (84 %) |
| widget de reserva | 0 | 1 | 114 | 190 |
| llegó sin abrir una página | 0 | 1 | 72 | 90 |
| landing con VSL | 1 | 1 | 43 | 235 |
| Meta, navegador interno | 0 | 0 | 23 | 23 |
| precall | 0 | 0 | 19 | 20 |
| otra página | 0 | 0 | 4 | 9 |
| sin rastro | 0 | 0 | 1 | 3 |
| con `Form Landing VSL` | 0 | 0 | **5** (del 2026-08-30 al 08-31) | 247 |
| finalización del formulario | — | — | **—** (5 < 10) | **64,8 %** |
| ¿cruza el 2026-08-31? | no | no | **sí, hasta el 2026-09-29** | sí |
| filas marcadas circulares en el aviso | — | — | «Meta, navegador interno» y «Precall» | las mismas dos |

Las familias en 0 no llevan fila en pantalla. En «Completo» el campo dice `Agendado` 121 veces y
47 de esos contactos tienen una cita alcanzable, así que la nota de la contradicción aparece; en 30
días son 3 y 3, y no aparece.

---

## 3 · Lo que era maqueta y qué la reemplazó

Hasta el 2026-09-20 la pestaña entera era inventada: `lib/aios/conversion.js` —648 líneas en el corte
anterior, 655 al borrarse, porque la etapa 0 le sumó siete netas (`b767c2a`)— sin una sola petición
de red. El inventario de sus once juegos de datos está en la versión anterior de este archivo (§ 3) y en
`docs/conversion/09-LO-QUE-NO-ES-UN-REQUISITO.md:29-92`; las citas `conversion.js:N` de esas fuentes
son historia y se leen con `git show 0add4cc^:lib/aios/conversion.js`.

| lo que dibujaba la maqueta | qué hay hoy |
|---|---|
| El funnel `CV`: 18 números —sesiones, VSL, formulario, agenda, calificadas y gracias por tres dispositivos— multiplicados por un factor de período | **El reparto de siete familias**, con conteos reales. Visitas, VSL y gracias pasaron a hueco declarado; «calificadas» no tiene fuente y no se dibuja |
| La cadena `Landing → VSL → Formulario → Agenda → Gracias`, cada paso sobre el total de visitas | **Se borró en vez de postergarse**: landing y widget son dos caminos, no dos pasos (`components/views/ConversionView.jsx:30-35`) |
| `BANDS`, la «banda esperada» que su comentario llamaba p25–p75 de 90 días y eran literales | Nada. Sin serie de 90 días no hay banda que calibrar |
| Once fricciones, el modal «Plan de acción» con su 45 % de recuperación y 47 frases de guion | **Borrados** con el botón (`components/views/ConversionView.jsx:39-41`) |
| Tres fallas técnicas inventadas asignadas por nombre a una persona real del equipo | Se fueron con el archivo. El nombre sigue en cuatro archivos de `docs/conversion/` (06, 09, 12 y 13); ver [09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md) § 15 |
| El mapa de calor, el scroll y los clics por zona | Hueco declarado (`lib/negocio/embudoDelFormulario.ts:138-143`), con un texto que quedó falso; ver § 7, riesgo 2 |
| La curva de retención del VSL, un `path` SVG con coordenadas escritas a mano | Hueco declarado (`lib/negocio/embudoDelFormulario.ts:117-127`) |
| El «video de bienvenida» de la página de gracias | Nada: es el precall, de Appointment Flow. La familia `precall` se dibuja sólo para que la cohorte cuadre (`lib/negocio/recorrido.ts:85-88`) |
| El abandono campo por campo del formulario | Hueco (`lib/negocio/embudoDelFormulario.ts:151-156`). Lo que sí hay son los tres estados del campo |
| `FACTOR` y `PREV`, los multiplicadores de período | Las cuatro ventanas reales (`lib/negocio/periodo.ts:83-96`), y lo que no está se rechaza |
| Los chips «Clarity» y «VTurb» con punto de fuente conectada | **Borrados** (`components/views/ConversionView.jsx:21-25`) |
| El filtro por dispositivo | **Borrado**: no hay sesiones de las que sacarlo (`components/views/ConversionView.jsx:26-29`) |
| Siete puertas al panel de catorce personas inventadas | Quitadas de esta pantalla (`components/views/ConversionView.jsx:42-44`); `lib/aios/leads-group.js` sigue para Executive |

Los números del borrado no coinciden entre los comentarios que lo cuentan:
`components/views/ConversionView.jsx:2` y `components/conversion/PanelDeConversion.jsx:11` dicen 530
literales; `lib/negocio/vistaDeConversion.ts:8` y `docs/conversion/09-LO-QUE-NO-ES-UN-REQUISITO.md:36`
dicen 538; y `components/conversion/PanelDeConversion.jsx:8` y `lib/negocio/vistaDeConversion.ts:6`
dicen 648 líneas de un archivo que al borrarse tenía 655. Un recuento mío con otro criterio dio 505.
El número depende de qué se cuenta como literal, así que no lo fijo.

**Lo que Executive todavía inventa en nombre de Conversion** (la pantalla entera está en
[11-EXECUTIVE.md](11-EXECUTIVE.md)). Executive es la única pantalla que
conserva `sinOperacionesTodavia: true` (`lib/autorizacion/secciones.ts:212-218`), y sus tres módulos
siguen cargándose (`lib/aios/index.js:29-37@c4cf2a8`; **después del corte, el 2026-10-01**, se borraron con la maqueta, en la etapa E7 de la nueva estructura). Citan a Conversion como fuente de cifras que Conversion
ya demostró que no existen:

- `lib/aios/executive.js:15-21@c4cf2a8` escribe a mano un embudo por período con «visitas a la landing» —29
  hoy, 194 en siete días, 4.960 en el histórico—, y `lib/aios/executive.js:25-26@c4cf2a8` le asigna a
  Conversion «Visitas landing» y «Agendamientos». Conversion no publica visitas porque no existen, y
  el agendamiento del producto sale del calendario.
- `lib/aios/executive.js:186-189@c4cf2a8` dibuja la ficha de Conversion en estado crítico: *«26% de visita a
  cita»* y el formulario que falla en Safari móvil con 64 contactos perdidos, que es la misma falla
  inventada que tenía la maqueta de Conversion.
- `lib/aios/executive-panel.js:11-27@c4cf2a8` pone a Conversion como evidencia de tres puntos de reunión: la
  retención del VSL cayendo 18 puntos, un tráfico que «convierte tres veces peor» y móvil al 19 %
  contra escritorio al 42 %. `lib/aios/executive-panel.js:29-39@c4cf2a8` agrega un formulario que pasó de 11
  a 8 campos con la completación de 61 % a 73 %, y un video de bienvenida que ve el 54 %.
- `lib/aios/executive-chat.js:21@c4cf2a8` sugiere preguntas a Conversion y `lib/aios/executive-chat.js:30-39@c4cf2a8`
  contesta con cifras que la citan como fuente: *«solo avanza 29% y se pierden 1,007 personas»*.

Contra lo medido: la retención del VSL son 79 ceros; la finalización del formulario es 64,8 % sobre
la cohorte histórica y no hay serie de antes y después; el corte por dispositivo no se puede hacer.
**Leads Portal, en cambio, consume y no inventa**: su ficha trae la familia de cada lead con
`familiaDelRecorrido` y el estado del formulario con `CAMPO_DEL_FORMULARIO` y el corte
(`lib/negocio/fichaDelLeadDelPortal.ts:157`, `lib/negocio/fichaDelLeadDelPortal.ts:212-213`).

---

## 4 · Datos que ya tenemos

Medido el 2026-09-28 sobre `negocio.contactos`: **594 contactos** de una sola organización (584 el
2026-09-14, 590 el 2026-09-20). **570 tienen `alta_en_el_crm`**; los otros 24 no tienen alta ni
atribución, no entran en ninguna ventana —ni en «Completo»— y 13 de ellos tienen alguna cita. Leads
Portal los declara (`docs/leads-portal/09-DE-DONDE-VIENE-CADA-DATO.md:67`); Conversion no.

| dato | antes | 2026-09-28 |
|---|---|---|
| `atribucion_ultima` con `url` | 468 de 584 (09-14) · 475 de 590 (09-20) | **477 de 594** (80,3 %) |
| `atribucion_primera` con `url` | 325 de 584 (09-14) · 329 de 590 (09-20) | 332 de 594 |
| `Trigger Link` como `sessionSource` del último toque | 29 de 584 (09-14) | **31 de 594**; en el primero, 0 |
| `Form Landing VSL`: `Agendado` / incompleto / completo | 121 / 87 / 39 = 247 (09-14) | **igual**; último día 2026-08-31, cero desde septiembre, cero fuera del vocabulario |
| `Agendado` con cita alcanzable | 47 de 121 (09-20) | 47 de 121; 119 con alguna cita, 72 congeladas |
| `VSL % máximo visto` y `VSL segundos vistos` | 79, todos `0` (09-14) | **79, todos `0`**, altas del 2026-08-11 al 08-30 |
| `Porcentaje de Video Visto`, `Video Watch Percentage` | 0 (09-20) | 0 de 594 |
| `Last Landing URL` (campo del CRM) | 173 de 584 (09-14) · 180 (09-20) | 183 de 594, 108 desde septiembre |
| `Video Pre-Call` (de Conversation) | 213 de 584 (09-14) · 219 (09-20) | 222 de 594 |
| definiciones en `negocio.campos_del_crm` | 170 (09-14) · 172 (09-20) | 195 |

**La atribución guarda dos toques, no uno, y ninguno tiene historia ni fecha.**
`docs/conversion/00-MAPA.md:212-215` dice que `atribucion_ultima` está en 475 de 590 contactos, y
`docs/acquisition/11-LOS-SEIS-COMPONENTES.md:225-227` y `docs/acquisition/13-EL-CONTRASTE.md:53-54`
dicen que la base guarda `atribucion_primera`, *«un solo toque»*. Medido hoy, **la de Conversion es
la verdadera**: las dos columnas existen desde la `048`
(`db/migraciones/048_de_donde_vino_el_lead.sql:100-110`), `atribucion_primera` está no vacía en 553
de 594 y `atribucion_ultima` en 567, las dos a la vez en 552, y **en 279 los dos toques son
distintos**. Lo que Acquisition quería decir sí es cierto, por otro motivo: el barrido reescribe las
dos cada vez que el CRM las devuelve (`lib/negocio/sincronizar.ts:443-448`) y ninguna de sus claves
es una fecha —la primera tiene 20 claves y la última 19, medido hoy—, así que no se puede detectar un
primer toque sobrescrito. Lo dice bien `lib/negocio/calidadDeLaAtribucion.ts:26-29`. Y la otra mitad
de aquella frase de `docs/conversion/00-MAPA.md:212-215` —que ningún módulo la lee— dejó de ser
cierta el 2026-09-20: la lee `lib/negocio/recorrido.ts:125-127`.

**El reparto por época**, sobre los 570 con alta y por host del último toque:

| época | contactos | landing con VSL | widget de reserva | sin página | navegador de Meta |
|---|---|---|---|---|---|
| agosto y antes | 325 | **203 (62 %)** | 84 (26 %) | 29 | 0 |
| septiembre | 245 | **32 (13 %)** | **106 (43 %)** | 61 (25 %) | 23 (9 %) |

El 2026-09-20 la misma tabla decía 349 y 241 contactos, con la landing al 58 % en agosto
(`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:33-36`): aquellos 349 incluían a los 24
sin alta, que la consulta de entonces mandaba a «agosto y antes». Sobre contactos con alta, la caída
es del 62 % al 13 %.

**El censo de hosts**, sobre los 594: `accelerator.ariaia.com` 230 (31 de septiembre),
`calls.ariaia.com` 144 (74), `api.leadconnectorhq.com` 46 (32), `www.fbsbx.com` 23 (23),
`precall.ariaia.com` 20 (19), `grow.ariaia.com` 5 (1), `trabaja-con-nosotros.ariaia.com` 4 (3), dos
previsualizaciones de `vibepreview.com` 5 (0), y sin dirección 117 (62; 24 son los sin alta). El
`medium` del último toque: `External Form` 201, sin `medium` 156, `calendar` 125, `facebook` 88,
`form` 22, `instagram` 2.

**Y la población se detuvo.** Desde el 2026-09-14 entraron **8 contactos** en quince días, nunca más
de uno por día salvo el 2026-09-18 (dos). El último día con gasto en `negocio.metricas_de_anuncio`
es el 2026-09-13 y la suma desde el 2026-09-14 es 0,00 en 1.185 filas. **No es un defecto de
ingesta**: la tarea `contactos` de `negocio.tareas_programadas` corrió el 2026-09-28 a las 18:01 UTC
y `anuncios` a las 06:20 UTC. Es el `CV14-10` de
`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:178-191`, que sigue vigente dos semanas
después.

---

## 5 · Datos que faltan, y de dónde tendrían que venir

**Los cinco huecos que la pantalla declara** viajan en cada respuesta
(`lib/negocio/embudoDelFormulario.ts:116-157`) y se dibujan al final del panel. Su encabezado dice
«medido el 20 de septiembre»; cada uno, re-medido hoy:

| hueco | medición del código (2026-09-20) | 2026-09-28 | de dónde tendría que venir |
|---|---|---|---|
| La retención del VSL (`lib/negocio/embudoDelFormulario.ts:117-127`) | 79 escrituras, las 79 en cero; los otros dos campos de video en 0 de 590 | igual; los otros dos en 0 de 594 | vTurb o su integración, fuera de este sistema. Decisión del 2026-09-20: no se toca (`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:137-138`) |
| Sesiones, visitantes y eventos de página (`lib/negocio/embudoDelFormulario.ts:128-137`) | no hay tabla | por nombre en `information_schema.tables` sólo hay `auth.sessions`, `identidad.sesiones` y tres `public.closer_*` de la plataforma anterior; ninguna es web | un píxel propio o un proveedor que escriba `visitor_id` y `session_id` (§ 5.2) |
| El mapa de calor, el scroll y los clics muertos (`lib/negocio/embudoDelFormulario.ts:138-143`) | Clarity sólo existe como texto | igual: fuera de comentarios y de este mismo texto no aparece en el código, y `.env.example` no lo nombra | Clarity o equivalente instalado en la landing. **El texto del hueco quedó falso**; ver § 7, riesgo 2 |
| La tasa de conversión de la landing (`lib/negocio/embudoDelFormulario.ts:144-150`) | 124 de 590 con `medium = calendar` | 125 de 594; y en septiembre 31 de los 32 contactos de la familia landing | un registro AL LLEGAR a la página, que hoy no existe |
| El abandono pregunta por pregunta (`lib/negocio/embudoDelFormulario.ts:151-156`) | GoHighLevel no expone formularios entre las operaciones que este sistema usa | del 2026-09-20, no re-medido: haría falta una sonda contra la API | instrumentar el formulario |

**Y los que no se declaran en pantalla:**

- **La historia de los toques.** El § 5.3 pide historial y el § 18.5 los dos toques con sus fechas.
  Hay dos toques por contacto, sobrescritos en cada barrido y sin fecha (§ 4). Los 31 `Trigger Link`
  son los que lo tienen como último toque, no los que alguna vez llegaron por uno. Tendría que venir
  de una tabla de cambios como la de la `047`, que no existe (`lib/negocio/calidadDeLaAtribucion.ts:26-29`).
- **Los 24 contactos sin alta.** Ninguna ventana los alcanza y la cobertura de Conversion no los
  cuenta: dice «de 570» sobre una base de 594.
- **Las etapas del widget.** El widget de reserva es hoy el camino mayoritario —106 de 245 contactos
  de septiembre— y no se sabe si distingue «abrió el calendario» de «eligió horario» de «confirmó»
  (`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:240-245`). Requiere una sonda propia
  contra GoHighLevel; no se hizo.
- **Por qué cambió la ruta el 2026-08-31.** La base dice qué pasó y no por qué
  (`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:232-238`). Se contesta preguntando.
- **El dispositivo.** El filtro se borró. `userAgent` está en 348 de 594 últimos toques (medido hoy);
  el reparto móvil / escritorio sobre citas del corte anterior —107 / 14 / 41 sin dato, sobre 162
  citas— es del 2026-09-14, no re-medido.
- **Calidad del tráfico, audiencia y placement**, las dos promesas del § 18.16 que no llegan (§ 1).

---

## 6 · Reglas propias de este departamento

Las nueve del corte anterior conservan su número, porque el código y `docs/conversion/` las citan por
número (`lib/negocio/recorrido.ts:250-251`, `lib/negocio/recorridoDelLead.ts:37-38`). Las nueve
tienen ya algún punto del código que las cumple, y cada una dice cuál.

**1. Los ceros de este departamento son tres, y hay que nombrarlos distinto.**

No hay campo · el campo dice cero · el medidor no reportó. `VSL % máximo visto` es el caso: 79
contactos lo traen, todos con alta del 2026-08-11 al 2026-08-30, y los 79 dicen `0` —re-medido hoy,
sin una excepción—. La regla: **mientras el censo de un campo numérico tenga un solo valor distinto,
ese campo no es una medición: es un indicador de que algo se instaló y no funcionó**, y se reporta
como alarma, no como cifra. En código: el VSL es un hueco y no una cifra
(`lib/negocio/embudoDelFormulario.ts:117-127`), y la finalización bajo el piso es «—» y no «0 %»
(`components/conversion/PanelDeConversion.jsx:383-386`).

**2. Nunca mezclar cohortes de antes y después del 2026-08-31.**

Cualquier serie que cruce esa fecha muestra un derrumbe fantasma de los indicadores de landing y de
VSL, y no es una caída de conversión: es un cambio de ruta de adquisición. En código es
`corteDeEpoca` (`lib/negocio/recorrido.ts:247-284`), que las dos respuestas llevan siempre y que los
dos avisos dicen (`lib/negocio/recorridoDelLead.ts:252-258`, `lib/negocio/embudoDelFormulario.ts:272-277`).
Con el reloj del 2026-09-28, las cuatro ventanas siguen fallando de maneras opuestas:

- **Hoy y 7 días** no cruzan el corte y no tienen gente: 1 y 3 contactos, ninguno con el formulario.
- **30 días** —el botón con el que abre— empieza el 2026-08-30 y cruza el corte **hasta el
  2026-09-29**: 276 contactos, 5 con el formulario, de dos días. Desde el 2026-09-30 deja de cruzarlo.
- **Completo** lo cruza siempre: 570 contactos, 325 de antes de septiembre, y es la única ventana
  donde el formulario tiene población.

El 2026-09-15 a las 18:50 UTC la ventana de 14 días daba 229 altas y 0 con el formulario, y la de 30
días 409 altas —146 de antes del corte— con el formulario en 137. El 2026-09-20, 30 días eran 335 con
63 (`docs/conversion/05-PERIODOS-Y-PISOS.md:65-79`). La mezcla se fue achicando sola: no porque se
arreglara, sino porque el corte va quedando fuera de la ventana.

**3. Distinguir «visitó la landing» de «la URL quedó registrada».**

`atribucion_ultima` es el último toque, y para muchos contactos ese toque es la reserva. El
2026-09-14, de 48 contactos de la ventana con rastro de la landing, 44 tenían `medium = calendar`.
Hoy es más marcado: **en septiembre, 31 de los 32 contactos de la familia landing tienen la dirección
capturada al reservar**, y uno solo por el formulario; en la ventana de 30 días son 37 de 43. Una
tasa de conversión sobre ese denominador da casi 100 % por construcción, así que no se publica. En
código, la fila lleva el conteo de los capturados al reservar (`lib/negocio/recorridoDelLead.ts:17-42`)
y el hueco lo dice (`lib/negocio/embudoDelFormulario.ts:144-150`).

**4. El vocabulario de `Form Landing VSL` es cerrado y hay que tratarlo como cerrado.**

Tres valores exactos (`lib/negocio/recorrido.ts:211-215`). `negocio.campos_del_crm` no guarda las
opciones declaradas, así que un cuarto valor sólo se ve contándolo: la consulta lo cuenta
(`lib/negocio/embudoDelFormulario.ts:201-203`) y el aviso lo nombra
(`lib/negocio/embudoDelFormulario.ts:289-294`). Hoy son cero.

**5. Los siete hosts no son la misma página y no se pueden sumar.**

Widgets de reserva (`calls.ariaia.com`, `api.leadconnectorhq.com`), landings con VSL
(`accelerator.ariaia.com`, `grow.ariaia.com`), el formulario precall, el navegador interno de
Facebook y una página de reclutamiento son cinco cosas distintas. Una métrica de «visitas a la
landing» que sume los siete cuenta cinco poblaciones como si fueran una. En código es una lista y no
una expresión regular, para que un host nuevo caiga visible en «otra página»
(`lib/negocio/recorrido.ts:96-116`). Censo de hoy en § 4.

**6. Primer toque y último toque son dos preguntas, y para este departamento manda el último.**

Acquisition mira el primer toque —de qué anuncio vino—; Conversion mira el último —por dónde volvió a
entrar—. Confundirlos hace que el departamento mida cero y lo reporte como ausencia. El caso que lo
prueba, re-medido hoy: `Trigger Link` vale 31 de 594 en el último toque y 0 de 594 en el primero. En
código: la clasificación lee `atribucion_ultima` (`lib/negocio/recorrido.ts:10-18`).

**7. Lo que NO es de este departamento, aunque la pantalla lo dibuje.**

El consumo del video precall es § 10.6, Appointment Flow, y ya está construido en
`lib/negocio/consumoDelPrecall.ts`. Conversion no lo publica: la familia `precall` aparece en el
reparto sólo para que la cohorte cuadre (`lib/negocio/recorrido.ts:85-88`). Dos tasas del mismo hecho
con poblaciones distintas, en dos pantallas, serían dos cifras para una sola pregunta. Al revés:
Creative mide retención del ANUNCIO (las reproducciones de Meta); Conversion mide la del VSL de la
landing. Son dos videos, y hoy Conversion no puede medir el suyo (regla 1).

**8. El piso de publicación, y dónde muerde acá.**

`PISO_DE_UNA_TASA = 10` (`lib/negocio/indicadoresDeCitas.ts:309`), sobre el denominador. El corte anterior
advertía que el filtro por dispositivo no soportaba un segundo corte; el filtro se borró y el problema
con él. Hoy el piso muerde en el formulario: la ventana por omisión tiene 5 contactos con el campo y
la tasa no se publica (`lib/negocio/embudoDelFormulario.ts:235-237`). La porción de cada familia va
sin piso, porque es un conteo exacto y no una muestra.

**9. Ninguna cifra puede llevar un identificador de GoHighLevel escrito a mano.**

`campoPorNombre()` (`lib/negocio/camposDelCrm.ts:307-319`) es la única puerta: compara por nombre
exacto, desempata por `campo_id` y devuelve `null` —no cero— si alguien renombra el campo. Conversion
entra por ahí (`lib/negocio/recorrido.ts:235`, `lib/negocio/embudoDelFormulario.ts:165`), y sin el
campo el bloque se apaga y lo dice (`lib/negocio/embudoDelFormulario.ts:168-188`). El catálogo tiene
hoy 195 definiciones y 194 nombres: un nombre repetido, que no es de este departamento.

**Y tres que nacieron al construir la pantalla, el 2026-09-20:**

**10. Por familia se publican conteos, no tasas.** La tasa de agenda por recorrido salió circular: las
familias cuya dirección se escribe al reservar dan 100 % porque estar en la fila y haber agendado
son el mismo hecho (`lib/negocio/recorridoDelLead.ts:17-42`, `docs/conversion/02-METRICAS.md:83-120`).
Hoy, en 30 días, «Meta, navegador interno» son 23 de 23 y «Precall» 19 de 19.

**11. El agendamiento sale del calendario, no del campo del formulario.** El campo dice `Agendado` 121
veces y sólo 47 de esos contactos tienen una cita alcanzable (re-medido hoy). Si saliera del campo,
esta pantalla diría una tercera cifra de agendamiento (`lib/negocio/embudoDelFormulario.ts:23-31`); sale
del predicado compartido `tieneCitaAlcanzable` (`lib/negocio/citasAlcanzables.ts:135-145`).

**12. «No hubo gente» no es «no hay dato».** Con la pauta en cero, una ventana vacía es falta de
tráfico, y el aviso lo dice con esas palabras (`lib/negocio/recorridoDelLead.ts:240-250`); un bloque del
formulario sin población dice cuándo fue el último y que el campo sigue existiendo
(`lib/negocio/embudoDelFormulario.ts:259-270`). Desde el 2026-09-14 es lo que la pantalla dice casi
todos los días en «Hoy» y «7 días».

---

## 7 · Riesgos

**1. «Completo» es la única ventana con formulario, y su 64,8 % describe una ruta que ya no existe.**
Desde el 2026-09-30 las otras tres ventanas dirán, correctamente, que ningún contacto trae el
formulario. Queda una sola tasa en la pantalla, sobre 247 contactos del 2025-12-20 al 2026-08-31, en
una ventana que cruza el corte siempre. El aviso lo dice; la cifra grande, no. Quien la lea como «el
formulario de hoy» está mirando una ruta que se cerró el 31 de agosto.

**2. El hueco de Clarity dice en pantalla algo falso sobre la propia pantalla.**
`lib/negocio/embudoDelFormulario.ts:141-142` afirma que *«Clarity aparece en la pantalla como fuente
conectada y sólo existe como una cadena de texto en el JSX»*. Los chips se borraron el mismo día
(`components/views/ConversionView.jsx:21-25`): Clarity ya no aparece en la pantalla como nada. Es la
clase de texto que la regla del proyecto trata como defecto de primera clase, porque se dibuja.

**3. La fila «Landing con VSL» de septiembre es casi toda circular, y no lleva la marca.**
En 30 días son 43 contactos, 37 capturados al reservar (86 %) y 30 «agendaron». La marca pide el 90 %
(`components/conversion/PanelDeConversion.jsx:337`, `lib/negocio/recorridoDelLead.ts:263-265`), así que
la fila sale limpia y sus 30 agendados se leen como conversión de la landing. Y su rótulo —*«Entró
por la página propia con el video y el formulario»* (`lib/negocio/recorrido.ts:69-72`)— describe
agosto: en septiembre, 31 de sus 32 contactos tienen esa dirección registrada al reservar.

**4. «Hoy» dice una cosa al pasar el cursor y mide otra.** El título del botón dice *«Las últimas 24
horas, no el día del calendario»* (`lib/negocio/periodo.ts:84`,
`components/conversion/PanelDeConversion.jsx:113`), y la cohorte de Conversion es el día de calendario
desde la medianoche UTC (`lib/negocio/recorrido.ts:197-199`). `lib/negocio/costoDelAnuncio.ts:61-63`
admite la diferencia para Acquisition, pero el título es compartido y no cambió. Además,
`lib/negocio/recorrido.ts:193-195` justifica el anclaje porque Conversion *«cruza sus contactos con el
gasto y con las piezas»*, y la ruta no lee ni gasto ni piezas (`app/api/conversion/route.ts:58-61`).

**5. Executive sigue publicando en nombre de Conversion.** Móvil contra escritorio, la retención del
VSL, visitas a la landing y una falla de formulario con su pérdida en contactos (§ 3). Ahora hay una
pantalla real que declara no medibles el VSL y las visitas, a un clic de la que los inventa.

**6. Los 24 sin alta, y un rótulo que dice un número que la fila no muestra.** Conversion reparte 570
de 594 sin decir que faltan 24; Leads Portal, sobre la misma base, sí lo dice. Y el rótulo de «Sin
rastro» afirma *«26 contactos, todos anteriores a septiembre»* (`lib/negocio/recorrido.ts:90-93`): en
«Completo» la fila muestra 3, porque 24 de los 27 contactos con la atribución vacía son los sin alta,
y uno de los 3 es del 2026-09-21. El rótulo está fechado el 2026-09-20; la fila de al lado, no.

**7. Una clasificación, dos pantallas.** Desde el 2026-09-26 la ficha de Leads Portal
([10-LEADS-PORTAL.md](10-LEADS-PORTAL.md)) usa
`familiaDelRecorrido` y `ROTULOS` (`lib/negocio/fichaDelLeadDelPortal.ts:33-40`). Es el diseño correcto
—una sola definición—, pero un cambio en `lib/negocio/recorrido.ts` mueve las dos pantallas a la vez,
y lo que diga mal un rótulo lo dice en las dos.

**8. Landing Intelligence puede estar midiendo una ruta abandonada a propósito.** Si el cambio del
2026-08-31 fue una decisión de negocio, la mitad del departamento mide algo que la empresa dejó; si
fue un accidente, es un defecto de cuatro semanas que nadie notó. La base no desempata.

**9. El § 17 sigue vacío, y la pantalla ya eligió.** No hay KPIs, umbrales ni responsables definidos
por el negocio. Lo que se publica —reparto, formulario, cinco huecos— lo decidió la construcción con
la medición en la mano; el VSL como hueco fue decisión explícita del 2026-09-20
(`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:137-138`). Es mejor que ratificar la
maqueta, pero sigue sin ser una especificación.

**10. Si se vuelve a instrumentar, que sean eventos y no un campo por contacto.** El estado actual es
la demostración: dos toques sobrescribibles sin fecha y un `% máximo visto` con 79 ceros. Repetir
ese diseño para la landing o el VSL entrega exactamente el dato que hoy no sirve.
