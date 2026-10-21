# Conversion Intelligence
> Corte: **2026-10-18**, con el código de producción, `972972e`. El código de Conversion no cambió desde
> `b3ca9ad` salvo comentarios (ver abajo), así que lo que dibuja es lo del corte anterior. Las cifras de producción
> son de tres fechas y cada una lo dice: las del **2026-10-18**, re-medidas para esta foto con
> `scripts/supabase.mjs leer` (sólo lectura, sólo conteos y agregados, con el OK del usuario) y con los mismos
> predicados que el código —contrastados contra las del 2026-10-08, que reproducen exactas—; las del
> **2026-10-08**, de `docs/conversion/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md` (§ 2), que no se re-midieron; y las
> del **2026-09-28**, de la foto de entonces, re-medidas en parte. Lo que la pantalla «dibuja» con las cifras de hoy
> está deducido del código, no leído de una captura. En local hay ocho commits más, `693a383..dc84cb2`, del modelo de
> datos multiempresa (Fase 0, migraciones `079` a `084`): construidos y **sin subir**, esperando la aprobación de un
> ingeniero; lo que toca a Conversion se dice como tal. Cada afirmación lleva su `archivo:línea`. Para ubicar lo
> nombrado, ver [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md). La versión anterior —el corte del 2026-10-09—
> se lee con `git show 83798a4:"docs/OTROS/estado actual/03-CONVERSION.md"`, la del 2026-09-28 con
> `git show b3ca9ad:"docs/OTROS/estado actual/03-CONVERSION.md"`, y la de antes con
> `git show 93a1341:"docs/estado actual/03-CONVERSION.md"`.

**El front del prototipo, con los datos reales, desde el 2026-10-09.** La pestaña vuelve al marcado de
`aios-command-center_1.html` —la tira de tres paneles, la nota de cobertura, el recorrido de cinco pasos, la
alarma— y lo llena con una sola lectura del servidor, `lecturaDeConversion`, en días cerrados y con la misma
cohorte que Acquisition. El reparto por camino de entrada, que desde el 2026-09-20 era la pantalla entera, es
ahora el cajón de Landing; el formulario, el de Formulario. El titular sigue siendo de población: **el
formulario de la landing se escribió por última vez el 2026-08-31**, así que en «7 días» y «30 días» su tarjeta
dice «Sin dato desde el 31 ago.». **Medido el 2026-10-18**, sobre 30 días cerrados, del 2026-09-18 al 2026-10-17:
**28 contactos, 22 agendaron (79 %), 19 calificados (68 % de contacto a cita útil)** y 11 vistas de landing contadas
por Meta. La cohorte se encogió —el 2026-10-08 eran 105 sobre otra ventana—: entre el 2026-10-11 y el 2026-10-18
entró **un solo contacto**, el 2026-10-16, y la tarea `contactos` siguió corriendo cada diez minutos.

> **Desde el corte del 2026-10-09**
>
> - **2026-10-11 · `2415e25`** — CF-3 de Creative: se borra `app/inteligencia-estetica.css`, de la que Conversion ya
>   había salido; el comentario de `app/conversion.css` lo dice (`app/conversion.css:8-9`) y la cita de
>   `lib/negocio/recorrido.ts` a Creative queda fijada a su commit (`lib/negocio/recorrido.ts:249`). Ningún cambio en
>   lo que dibuja.
> - **2026-10-11 · `d9c10e5`** — CF-4 de Creative: el comentario del cajón deja de decir que el de Creative tiene su
>   `id` (`components/conversion/CajonDelPaso.jsx:19-20`). Sólo comentario.
> - **2026-10-11 · `fefffa1`** — CF-5 de Creative: la cita de `lib/negocio/recorridoDelLead.ts` a la foto de Creative
>   queda fijada a su commit (`lib/negocio/recorridoDelLead.ts:163`). Sólo comentario.
> - **2026-10-16 · `693a383..dc84cb2`, construido en local, sin subir** — la Fase 0 del modelo de datos: `contactos`
>   y `citas` reciben `cuenta_id` (`db/migraciones/082_la_cuenta_en_negocio_expandir.sql:123-127`), y nace
>   `negocio.eventos`, de sólo agregar, en el que nada escribe todavía (`db/migraciones/084_los_eventos.sql:6-7`,
>   `db/migraciones/084_los_eventos.sql:14`, `db/migraciones/084_los_eventos.sql:117`). Ninguno de los ocho commits
>   toca `lib/negocio/`, `components/` ni `app/`.
> - **2026-10-18** — esta foto: las cifras re-medidas.

---

## 1 · Qué pide el documento

El documento funcional (`CC_Arquitectura_Funcional.md`, 1.651 líneas) **no está versionado en este
repositorio**, así que sus números de línea se citan como los dejó
`docs/conversion/10-LO-QUE-PIDE-EL-DOCUMENTO.md:3`, que lo leyó entero el 2026-09-20. La
especificación está en esa carpeta; acá va el resumen.

- **§ 17 lo declara pendiente de especificación**, y sigue así: no hay KPIs, umbrales, responsables
  ni deslinde entre sus dos submódulos (`docs/conversion/10-LO-QUE-PIDE-EL-DOCUMENTO.md:127-139`).
  La pantalla eligió qué publicar sin esa lista; ver § 7, riesgo 9.
- **§ 18.11 le pone una sola frase en boca**: *«La finalización del formulario es baja»*
  (`docs/conversion/10-LO-QUE-PIDE-EL-DOCUMENTO.md:26-33`). La contesta la tarjeta de Formulario y su cajón,
  sólo hasta el corte del 2026-08-31 (§ 2).
- **§ 4 le da dos submódulos**, Landing Intelligence y VSL Intelligence
  (`docs/conversion/10-LO-QUE-PIDE-EL-DOCUMENTO.md:39-48`). Hoy el primero está a medias —la tarjeta de
  Landing, el reparto en su cajón y el formulario— y el segundo es la tarjeta de VSL, un hueco en su lugar.
- **§ 5.1 y § 5.3 piden tres entidades y un historial**: `Landing Session`, `VSL Session` y
  `Form Submission`, y que la reproducción del VSL conserve historial en vez de un valor fijo en el
  contacto (`docs/conversion/10-LO-QUE-PIDE-EL-DOCUMENTO.md:50-61`). Ninguna existe en producción; ver § 5.
- **§ 5.2 pone `visitor_id → session_id` en el centro de la traza**
  (`docs/conversion/10-LO-QUE-PIDE-EL-DOCUMENTO.md:63-76`). Ningún código del repositorio los usa.
- **§ 9.5 pide un trigger link con seis estados** (`docs/conversion/10-LO-QUE-PIDE-EL-DOCUMENTO.md:91-98`).
  Lo único que queda de él es su huella en el último toque: 31 de 624 contactos, medido el 2026-10-18 (31 de 594
  el 2026-09-28: ninguno nuevo).
- **§ 9.7 pone `landing visit rate`, `form start rate` y `form completion rate` bajo Lead Flow**, no
  bajo Conversion (`docs/conversion/10-LO-QUE-PIDE-EL-DOCUMENTO.md:100-104`). Se construyó en
  Conversion y el solapamiento queda declarado (`docs/conversion/01-LOS-DOS-RECORRIDOS.md:259-265`).
- **§ 10.6, el video precall, es de Appointment Flow**, y está construido en
  `lib/negocio/consumoDelPrecall.ts`. La tarjeta «Gracias» del prototipo es ese video, y queda como hueco
  (§ 6, regla 7).
- **§ 18.16 enumera lo que Acquisition le debe**: campaña y anuncio de origen, calidad del tráfico,
  CTR, *landing page views* y diferencias por audiencia y placement
  (`docs/conversion/07-LO-QUE-ENTREGA-Y-RECIBE.md:29-39`).

Estado de las cinco promesas del § 18.16, con su fecha:

| promesa | estado | de dónde |
|---|---|---|
| campaña y anuncio de origen | **llega**: `adId` en 215 de 624 contactos, `utmContent` en 508 | `atribucion_primera`, medido el 2026-10-18 (213 y 506 de 594 el 2026-09-28) |
| calidad del tráfico | **no está definida**: el documento no dice qué es | `docs/conversion/07-LO-QUE-ENTREGA-Y-RECIBE.md:36` |
| CTR | **llega**, por anuncio y por día | `negocio.metricas_de_anuncio` |
| *landing page views* | **llega, y Conversion la publica desde el 2026-10-09**: «Vistas de landing, según Meta», sin tasa. El desglose de acciones empieza el 2026-08-18 (re-medido el 2026-10-18), y `landingPageView` y `omniLandingPageView` valían lo mismo en las 221 filas que traían las dos el 2026-10-08 | `lib/negocio/pasosDeConversion.ts:498` |
| audiencia y placement | **no llega**: GoHighLevel sólo agrupa por día, semana o mes | del 2026-09-20, no re-medido: `docs/conversion/07-LO-QUE-ENTREGA-Y-RECIBE.md:39` |

Las vistas de landing son un agregado de Meta por anuncio y por día: no son sesiones ni se pueden cruzar con
un contacto, y cuentan vistas de cualquier destino del anuncio, también el widget de reserva. Por eso no son la
base de ningún porcentaje (§ 6, regla 14).

---

## 2 · Qué hay hoy en pantalla

**La sección.** `conversion` se registra en `lib/autorizacion/secciones.ts:288` con
`capacidadRequerida: 'tablero.ver'` y **sin** `sinOperacionesTodavia`: la bandera bajó con la ruta el
2026-09-20, porque `ADR-0304` exige que las dos se muevan juntas (`lib/autorizacion/secciones.ts:291-293`).
El galón del menú se quedó (`lib/autorizacion/secciones.ts:297`), por el precedente de Creative; desde la barra
nueva de la etapa E10, el 2026-10-02, no se dibuja: ninguna línea de `components/`, `app/` ni `lib/` lee
`menu.galon` (grep del 2026-10-18).

**La ruta.** `GET /api/conversion?periodo=…` (`app/api/conversion/route.ts:53-116`) pide `tablero.ver`
por el portero (`app/api/conversion/route.ts:57`) y **rechaza** con 400 un período que no está en la
lista en vez de corregirlo (`app/api/conversion/route.ts:63-64`). Hace una sola lectura,
`lecturaDeConversion` (`app/api/conversion/route.ts:79`), con la zona de la empresa. Reparte las señales por
paso según su entidad (`app/api/conversion/route.ts:73-77`) y suma la frescura de la lectura de contactos, con
la frase de la cabecera del departamento (`app/api/conversion/route.ts:48-51`). Responde `pasos`, `recorrido`,
`formulario`, `frescura`, `senales`, `puedeConSenales`, el comentario de la cabecera y la clave del período que
usó (`app/api/conversion/route.ts:96-115`). El lector del navegador exige el período, sin valor por omisión
(`lib/negocio/vistaDeConversion.ts:51`).

**La lectura.** `lecturaDeConversion` (`lib/negocio/pasosDeConversion.ts:563`) compone lo que ya se medía y no
lo recalcula:

- la ventana, con `bordesDelPeriodo` (`lib/negocio/diasCerrados.ts:82`): «7 días» y «30 días» son días
  **cerrados**, hasta el último día cerrado de la serie de gasto de la cuenta; «Hoy» es el día de calendario, y
  «Completo» empieza en el primer contacto con alta;
- la cohorte, con `cohorteEntre` (`lib/negocio/recorrido.ts:214`), la misma expresión que usa Acquisition: en 7
  y 30 días las dos pantallas cuentan a la misma gente;
- el reparto, con `recorridoDelLead`, y el formulario, con `embudoDelFormulario`, sobre esa ventana;
- una pasada por la cohorte —agendó, calificó, confirmó, canceló, la cohorte hasta el corte y las citas
  congeladas— (`lib/negocio/pasosDeConversion.ts:446`), y la de la ventana anterior a la misma edad;
- las vistas de landing de Meta (`lib/negocio/pasosDeConversion.ts:529`).

`armarPasos` (`lib/negocio/pasosDeConversion.ts:278`) arma con eso la tira y las cinco tarjetas, con sus
variaciones y su lectura; todo viaja de 0 a 1. El cerebro (`pasos_de_conversion`, `recorrido_de_los_leads`,
`formulario_de_la_landing`, `lib/agentes/executive/adaptadores/conversion.ts:19`) y el detector leen la misma
lectura, así que lo que dicen de una cifra es lo que la pantalla dibuja.

**La vista.** `components/views/ConversionView.jsx` (29 líneas) monta el panel dentro de `cv-wrap`, sin
`estetica-op` (`components/views/ConversionView.jsx:19-27`).

**El panel.** `components/conversion/PanelDeConversion.jsx` (520 líneas) dibuja el marcado del prototipo, en su
orden (`components/conversion/PanelDeConversion.jsx:189`):

1. **El encabezado**: «Conversion», «Dónde se pierde la gente entre el click y la cita», el chip «GoHighLevel»
   con el punto verde sólo si la lectura de contactos está al día
   (`components/conversion/PanelDeConversion.jsx:159`), el botón «Plan de acción» y los cuatro períodos sin
   «Personalizado» ni el matiz de «Hoy» (`components/conversion/PanelDeConversion.jsx:171`). Abre en 30 días y
   enciende el botón que el servidor contestó.
2. **La tira** (`components/conversion/PanelDeConversion.jsx:252`): «Landing y VSL» con Contactos, Vistas de
   landing según Meta y «Dan play al VSL» en «—»; «Formulario y cita» con quienes empiezan el formulario y los que
   agendan; «Calidad de lo agendado» con agendados, calificados y no calificados.
3. **La nota de cobertura** (`components/conversion/PanelDeConversion.jsx:311`): cuántos contactos traen por
   dónde entraron, la ventana de verdad, contra qué compara, y por qué falta una flecha cuando falta.
4. **El recorrido** (`components/conversion/PanelDeConversion.jsx:368`): Landing, VSL, Formulario, Agenda y
   Gracias, sin bandas. Cada porcentaje es sobre los contactos de la ventana, y la caída «−N» es contra la cohorte,
   no contra la tarjeta de al lado. VSL y Gracias son huecos y no abren cajón.
5. **La alarma** (`components/conversion/PanelDeConversion.jsx:469`), sólo con señales `critica` y con 7 o 30
   días. Hoy ninguna regla de Conversion es crítica, así que no aparece.
6. **La tarjeta de señales**, la misma de Acquisition, Creative y Conversation.

**El cajón** (`components/conversion/CajonDelPaso.jsx:37`), en un portal propio: Landing con la tabla de las
siete familias (`components/conversion/CajonDelPaso.jsx:113`), Formulario con lo empezado, lo completado, la tasa
y los tres estados del campo (`components/conversion/CajonDelPaso.jsx:163`), y Agenda con agendados,
calificados, tasa, confirmados, cancelaron y no calificados (`components/conversion/CajonDelPaso.jsx:226`). Las
observaciones van sólo en los pasos a los que apunta una regla (`components/conversion/CajonDelPaso.jsx:258`).

Las frases de los huecos y los motivos son una lista cerrada (`components/conversion/comun.jsx:41`), la del
`CV15-02`; el navegador no calcula y multiplica por 100 en un solo lugar (`components/conversion/comun.jsx:77`).
Lo nuevo de estilo vive en `app/conversion.css` (175 líneas), acotado a la vista y al cajón.

**Las pruebas.** 20 en `pruebas/codigo/246-pasos-de-conversion.test.ts`, 19 en
`pruebas/base/246-pasos-de-conversion.test.ts`, 14 en `pruebas/codigo/247-la-pantalla-de-conversion.test.ts`,
14 en `pruebas/base/160-recorrido-del-lead.test.ts`, 12 en `pruebas/base/161-embudo-del-formulario.test.ts`, 8 en
`pruebas/codigo/236-el-detector-de-conversion.test.ts` y 3 en `pruebas/base/237-las-senales-de-conversion.test.ts`,
contadas por `grep` el 2026-10-18: las mismas del 2026-10-09. Cada etapa de CV-1 a CV-4 se probó con mutaciones:
las 40 de CV-4 salieron en rojo.

**Lo que dibuja con lo medido el 2026-10-18**, 30 días cerrados, del 2026-09-18 al 2026-10-17 —el último día cerrado
de la serie de gasto en la zona de la empresa—. Es lo que el código calcula sobre esas cifras, no una captura:

| lugar | cifra | por qué así |
|---|---|---|
| Contactos | **28**, ▼ contra 367 en la anterior (2026-08-19 a 2026-09-17) | las personas comparan: la historia de contactos cubre la anterior |
| Vistas de landing | **11**, según Meta; la anterior suma unas 2.870 | desde que la ventana anterior empieza el 2026-08-19, la serie de gasto y el desglose (desde el 2026-08-18) la cubren: puede llevar ▼, si el gasto de la anterior está entero y cuadra; eso no se comprobó |
| Empiezan el form | «—», «Sin dato desde el 31 ago.» | la ventana empieza después del corte |
| Agendan | **22**, 79 %, «sin comparación» | 9 de los 367 contactos de la anterior tienen citas congeladas: «Los agendados no comparan: hay citas congeladas.» |
| Calificados / no calificados | **19** (86 %) / **3** (14 %) | sobre los agendados, nunca comparan |
| De contacto a cita útil | **68 %** | 19 de 28 |
| Confirmados | **8**, 42 % | sobre los calificados; los 8 que respondieron dijeron «Si» (`CV15-P10`) |
| Cancelaron | **5**, 26 % | calificados con todas sus citas canceladas |

En 7 días cerrados, del 2026-10-11 al 10-17: **1 contacto**, agendado, calificado y que confirmó; la anterior, 8
contactos y 5 agendados. Con un contacto la tasa de agenda queda bajo el piso de diez y dice «—». Las vistas de
landing: 0, contra 0. En «Hoy», sin contactos, la nota dice «Sin contactos en este período» (regla 12).

**El 2026-10-08**, sobre 2026-09-08 a 10-07 (reproducido el 2026-10-16 con la misma consulta que las cifras de arriba): 105
contactos, 63 agendados (60 %), 35 calificados (33 % de contacto a cita útil), 18 confirmados, 12 cancelaron y 462
vistas de landing. La diferencia es de población, no de código: la ventana nueva ya no tiene los días de antes del
2026-09-14, cuando la pauta se detuvo.

---

## 3 · Lo que era maqueta y qué la reemplazó

La pestaña tuvo tres vidas:

- **hasta el 2026-09-20**, una maqueta: `lib/aios/conversion.js`, 655 líneas sin una sola petición de red, sobre
  seis números multiplicados por un factor de período. Se lee con `git show 0add4cc^:lib/aios/conversion.js`;
- **del 2026-09-20 al 2026-10-09**, una pantalla medida con la estética de operación: el reparto por camino de
  entrada, el embudo del formulario y cinco huecos declarados. Se lee con
  `git show b3ca9ad^:components/conversion/PanelDeConversion.jsx` y con la foto del 2026-09-28;
- **desde el 2026-10-09**, el front del prototipo con los datos reales (§ 2).

| lugar del prototipo | la maqueta | hoy |
|---|---|---|
| Chips «Clarity» y «VTurb» con el punto de fuente conectada | cadenas de texto, sin integración | **un chip, «GoHighLevel»**, con el punto encendido sólo si la lectura de contactos está al día |
| Segmentado y «Personalizado» | `FACTOR` y `PREV` sobre cinco períodos | los cuatro períodos del sistema; «7 días» y «30 días» cerrados |
| Filtro por dispositivo | 18 literales por dispositivo | **no se dibuja**: el `userAgent` estaba en 47 de 106 contactos de 30 días (2026-10-08) |
| Panel «Landing y VSL» | «Visitas» y «Dan play al VSL» | **Contactos**, **Vistas de landing según Meta** y el VSL en «—» |
| Panel «Formulario y cita» y «Calidad de lo agendado» | porcentajes sobre visitas | sobre los contactos, en personas: Agendados, Calificados, No calificados |
| `#cvInfo` | «N sesiones · período · vs anterior» | **la nota de cobertura** |
| Las cinco tarjetas del recorrido, con bandas y `#cvWorst` | cada paso sobre el anterior, banda p25–p75 inventada | **las cinco tarjetas**, sin bandas ni contador; la caída contra la cohorte, porque el camino no está anidado |
| Cajones de los cinco pasos, con mapa de calor, curva del VSL, grabaciones y campo por campo | inventados | **tres cajones**, sólo con lo medido; lo demás dice «Sin dato» en su lugar |
| Once fricciones y el plan con su 45 % de recuperación | inventados | **las señales de la pasada de la mañana** y su plan (AG14); la alarma, sólo con señales críticas |
| Siete puertas a un panel de catorce personas inventadas | `data-leads` | quitadas, y no vuelven (`CV15-24`) |

**Executive ya no inventa en nombre de Conversion.** Hasta el 2026-10-01 su maqueta citaba a Conversion como
fuente de «visitas a la landing», del corte por dispositivo y de una falla de formulario
(`lib/aios/executive.js:186-189@c4cf2a8`, `lib/aios/executive-panel.js:11-27@c4cf2a8`); se borró con la etapa E7 de la
nueva estructura. **Leads Portal consume y no inventa**: su ficha trae la familia de cada lead con
`familiaDelRecorrido` y el estado del formulario con `CAMPO_DEL_FORMULARIO`
(`lib/negocio/fichaDelLeadDelPortal.ts:158`, `lib/negocio/fichaDelLeadDelPortal.ts:213-214`).

---

## 4 · Datos que ya tenemos

**Medido el 2026-10-18**: **624 contactos**, y 24 sin `alta_en_el_crm`, que no entran en ninguna ventana; en
«Completo» la nota los dice. **Entre el 2026-10-11 y el 2026-10-18 entró un solo contacto, el 2026-10-16**, con la
tarea `contactos` sellada `corrio` el 2026-10-18. Las cifras de la cohorte de 30 días
están en § 2.

- **La confirmación**: el campo `Confirmación Agendamiento` existe y, sobre los 19 calificados de 30 días, 8 lo
  traen y los 8 dicen `Si` (el 2026-10-08: 18 de 35, los 18 `Si`).
- **Las citas congeladas** —sin `ghl_calendario_id`, anteriores a la `038`—: 9 de los 367 contactos de la
  anterior de 30 días (el 2026-10-08, 80 de 447); ninguna en la anterior de 7.
- **El gasto de la cuenta** se guarda desde el 2026-08-18. Las dos ventanas de 30 días del 2026-10-18 —la
  que termina el 2026-10-17 y su anterior, desde el 2026-08-19— caen dentro de la serie.
- **El desglose de acciones de Meta** empieza también el 2026-08-18; en «Completo», por eso, las vistas son «—».
- **La pauta**, según la serie de la cuenta: entregó todos los días del 2026-10-01 al 10-05, nada del 10-06 al 10-13,
  127 impresiones el 10-14 y nada del 10-15 al 10-18.

**Medido el 2026-09-28** (la foto de entonces), con lo re-medido el 2026-10-18:

| dato | 2026-09-28 | 2026-10-18 |
|---|---|---|
| `atribucion_ultima` con `url` | **477 de 594** (80,3 %) | 483 de 624 |
| `atribucion_primera` con `url` | 332 de 594 | 340 de 624 |
| `Trigger Link` como `sessionSource` del último toque | **31 de 594**; en el primero, 0 | 31 de 624; en el primero, 0 |
| `Form Landing VSL`: `Agendado` / incompleto / completo | 121 / 87 / 39 = 247; último día 2026-08-31, cero desde septiembre, cero fuera del vocabulario | 120 / 88 / 39 = 247; el último contacto con el campo es del 2026-08-31 |
| `Agendado` con cita alcanzable | 47 de 121; 119 con alguna cita, 72 congeladas | no re-medido |
| `VSL % máximo visto` y `VSL segundos vistos` | **79, todos `0`**, altas del 2026-08-11 al 08-30 | `VSL % máximo visto`: 79, un solo valor, `0` |
| `Porcentaje de Video Visto`, `Video Watch Percentage` | 0 de 594 | no re-medido |
| `Last Landing URL` (campo del CRM) | 183 de 594, 108 desde septiembre | no re-medido |
| definiciones en `negocio.campos_del_crm` | 195 | 212 |

**La atribución guarda dos toques, no uno, y ninguno tiene historia ni fecha.** Las dos columnas existen desde
la `048` (`db/migraciones/048_de_donde_vino_el_lead.sql:100-110`); el 2026-10-18 `atribucion_primera` estaba no
vacía en 580 de 624 y `atribucion_ultima` en 597 (553 y 567 de 594 el 2026-09-28, cuando en 279 los dos toques eran
distintos; eso no se re-midió). El barrido reescribe las dos cada vez que el CRM las devuelve
(`lib/negocio/sincronizar.ts:463-468`) y ninguna de sus claves es una fecha, así que no se puede detectar un primer
toque sobrescrito (`lib/negocio/calidadDeLaAtribucion.ts:26-29`). La clasificación de Conversion lee el último
(`lib/negocio/recorrido.ts:126-128`).

**El reparto por época**, el 2026-09-28, sobre los 570 con alta y por host del último toque (no re-medido):

| época | contactos | landing con VSL | widget de reserva | sin página | navegador de Meta |
|---|---|---|---|---|---|
| agosto y antes | 325 | **203 (62 %)** | 84 (26 %) | 29 | 0 |
| septiembre | 245 | **32 (13 %)** | **106 (43 %)** | 61 (25 %) | 23 (9 %) |

**El censo de hosts**, el 2026-09-28 sobre los 594 (no re-medido): `accelerator.ariaia.com` 230, `calls.ariaia.com`
144, `api.leadconnectorhq.com` 46, `www.fbsbx.com` 23, `precall.ariaia.com` 20, `grow.ariaia.com` 5,
`trabaja-con-nosotros.ariaia.com` 4, dos previsualizaciones de `vibepreview.com` 5, y sin dirección 117.

**La población.** El 2026-09-28 la pauta estaba en cero desde el 2026-09-14 y entraban contactos de a uno; el
2026-10-08 la cohorte de 30 días cerrados tenía 105 contactos y 462 vistas de landing; el 2026-10-18, 28 y 11, y
la de 7 días, un contacto. La entrega de la primera semana de octubre no trajo vistas de landing: en la semana del
2026-10-02 al 10-08 Meta contó una.

---

## 5 · Datos que faltan, y de dónde tendrían que venir

**Los huecos ya no se dibujan en un bloque**: cada uno dice «—» o «Sin dato» en su lugar del prototipo —la
tarjeta de VSL, la de Gracias, «Dan play al VSL», el comportamiento del cajón de Landing, el campo por campo del
Formulario, «Qué pasa después» de la Agenda—. La lista viaja en la respuesta para el cerebro
(`lib/negocio/embudoDelFormulario.ts:123`), y lo que haría falta para cada uno está en
`docs/OTROS/futuro/lo-que-conversion-no-mide.md`:

| hueco | por qué no hay dato | de dónde tendría que venir |
|---|---|---|
| La retención, el play y el CTA del VSL | 79 escrituras del medidor, las 79 en cero (2026-09-28; el mismo único valor el 2026-10-18) | vTurb o su integración, fuera de este sistema |
| Sesiones, visitantes y dispositivo | no hay tabla de sesiones; el `userAgent`, en 47 de 106 contactos de 30 días (2026-10-08) | eventos de página con un identificador de visita que se una al contacto |
| El mapa de calor, el scroll y los clics muertos | Clarity no está integrado | Clarity o equivalente, con credencial por empresa |
| La tasa de conversión de la landing | la dirección se registra al convertir, no al llegar | lo mismo que las sesiones |
| El abandono pregunta por pregunta | GoHighLevel no expone formularios entre las operaciones que este sistema usa | instrumentar el formulario |
| La página de gracias | es el precall, de Appointment Flow | — |
| Las bandas de «lo esperado» | no hay umbral medido | una serie propia de varios meses |

**Y los que no tienen lugar en la pantalla:**

- **La historia de los toques.** El § 5.3 pide historial y el § 18.5 los dos toques con sus fechas. Hay dos
  toques por contacto, sobrescritos en cada barrido y sin fecha (§ 4). **Construido en local, sin subir**: la
  Fase 0 crea `negocio.eventos`, una tabla de sólo agregar para cada hecho del lead
  (`db/migraciones/084_los_eventos.sql:6-7`, `db/migraciones/084_los_eventos.sql:117`); nada escribe en ella todavía
  (`db/migraciones/084_los_eventos.sql:14`), así que no cambia este hueco.
- **Las etapas del widget.** El widget de reserva fue en septiembre el camino mayoritario y no se sabe si
  distingue «abrió el calendario» de «eligió horario» de «confirmó»
  (`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:240-245`).
- **Por qué cambió la ruta el 2026-08-31.** La base dice qué pasó y no por qué
  (`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:232-238`). Se contesta preguntando.
- **Calidad del tráfico, audiencia y placement**, las dos promesas del § 18.16 que no llegan (§ 1).

---

## 6 · Reglas propias de este departamento

Conservan su número, porque el código y `docs/conversion/` las citan por número
(`lib/negocio/recorrido.ts:273-274`, `lib/negocio/recorridoDelLead.ts:38-39`). Cada una dice dónde se cumple.

**1. Los ceros de este departamento son tres, y hay que nombrarlos distinto.**

No hay campo · el campo dice cero · el medidor no reportó. `VSL % máximo visto` es el caso: 79 contactos lo
traen y los 79 dicen `0` (2026-09-28; el 2026-10-18, el mismo único valor). **Mientras el censo de un campo numérico
tenga un solo valor distinto, ese campo no es una medición: es un indicador de que algo se instaló y no funcionó.**
En código: el VSL es un hueco en su tarjeta y no una cifra, y una tasa bajo el piso o sin dato es «—» y no «0 %», con
la frase de su motivo de la lista cerrada (`components/conversion/comun.jsx:41`).

**2. Nunca mezclar cohortes de antes y después del 2026-08-31.**

Cualquier serie que cruce esa fecha muestra un derrumbe fantasma de los indicadores de landing y de VSL, y no es
una caída de conversión: es un cambio de ruta. En código es `corteDeEpoca` (`lib/negocio/recorrido.ts:292`), que
viaja en las respuestas. Desde CV-4 la tarjeta de Formulario lo aplica así: si la ventana empieza después del
corte —hoy, «Hoy», «7 días» y «30 días»— dice «Sin dato desde el 31 ago.»; si lo cruza —«Completo»—, publica
quienes traen el campo **sobre la cohorte anterior al corte**, no sobre la ventana, y la nota dice «Cruza el
corte del 31 ago.». El formulario nunca lleva flecha.

**3. Distinguir «visitó la landing» de «la URL quedó registrada».**

`atribucion_ultima` es el último toque, y para muchos contactos ese toque es la reserva. El 2026-09-28, en
septiembre, 31 de los 32 contactos de la familia landing tenían la dirección capturada al reservar; en la
ventana de 30 días de entonces, 37 de 43. Una tasa sobre ese denominador da casi 100 % por construcción, así que
no se publica: la fila del cajón lleva el conteo de agendados, no una tasa (`lib/negocio/recorridoDelLead.ts:18-43`).

**4. El vocabulario de `Form Landing VSL` es cerrado y hay que tratarlo como cerrado.**

Tres valores exactos (`lib/negocio/recorrido.ts:234-238`). Un cuarto valor sólo se ve contándolo: la consulta lo
cuenta (`lib/negocio/embudoDelFormulario.ts:219-221`) y el aviso lo nombra
(`lib/negocio/embudoDelFormulario.ts:309-314`).

**5. Los siete hosts no son la misma página y no se pueden sumar.**

Widgets de reserva, landings con VSL, el formulario precall, el navegador interno de Facebook y una página de
reclutamiento son cinco cosas distintas. En código es una lista y no una expresión regular, para que un host
nuevo caiga visible en «otra página» (`lib/negocio/recorrido.ts:108`).

**6. Primer toque y último toque son dos preguntas, y para este departamento manda el último.**

Acquisition mira el primer toque —de qué anuncio vino—; Conversion mira el último —por dónde volvió a entrar—.
`Trigger Link` valía 31 de 594 en el último toque y 0 en el primero (2026-09-28), y 31 de 624 y 0 el 2026-10-18.
La clasificación lee `atribucion_ultima` (`lib/negocio/recorrido.ts:10-18`).

**7. Lo que NO es de este departamento, aunque la pantalla lo dibuje.**

El consumo del video precall es § 10.6, Appointment Flow (`lib/negocio/consumoDelPrecall.ts`). La tarjeta
«Gracias» del prototipo es ese video y queda como hueco, sin cajón; la familia `precall` aparece en el reparto
sólo para que la cohorte cuadre (`lib/negocio/recorrido.ts:86-89`). Creative mide la retención del ANUNCIO;
Conversion la del VSL de la landing, y hoy no puede (regla 1).

**8. El piso de publicación, y dónde muerde acá.**

`PISO_DE_UNA_TASA = 10` (`lib/negocio/indicadoresDeCitas.ts:329`), sobre el denominador. Muerde en las tasas de
la ventana corta: el 2026-10-18, en 7 días hay un contacto y la tasa de agenda dice «—»; en la finalización del
formulario, sobre los que lo empezaron (`lib/negocio/embudoDelFormulario.ts:256`); y en confirmados y cancelaron,
sobre los calificados. La porción de cada familia va sin piso, porque es un conteo exacto.

**9. Ninguna cifra puede llevar un identificador de GoHighLevel escrito a mano.**

`campoPorNombre()` (`lib/negocio/camposDelCrm.ts:318-335`) es la única puerta: compara por nombre exacto y
devuelve `null` —no cero— si alguien renombra el campo. Conversion entra por ahí para el formulario
(`lib/negocio/embudoDelFormulario.ts:182`) y para la confirmación, y sin el campo la cifra es un hueco.

**10. Por familia se publican conteos, no tasas.** La tasa de agenda por recorrido salió circular: las familias
cuya dirección se escribe al reservar dan 100 % porque estar en la fila y haber agendado son el mismo hecho
(`lib/negocio/recorridoDelLead.ts:18-43`, `docs/conversion/02-METRICAS.md:83-120`).

**11. El agendamiento sale del calendario, no del campo del formulario.** El campo decía `Agendado` 121 veces y
sólo 47 de esos contactos tenían una cita alcanzable (2026-09-28). Sale del predicado compartido
`tieneCitaAlcanzable` (`lib/negocio/citasAlcanzables.ts:135-145`); el cajón de Formulario muestra la
contradicción en la columna «Con cita».

**12. «No hubo gente» no es «no hay dato».** Una ventana vacía es falta de tráfico, y el aviso lo dice con esas
palabras (`lib/negocio/recorridoDelLead.ts:254-264`); la nota empieza con «Sin contactos en este período».

**Y tres que nacieron con el front del prototipo, el 2026-10-08:**

**13. Días cerrados, y la misma cohorte que Acquisition.** «7 días» y «30 días» terminan en el último día
cerrado de la serie de gasto, con `bordesDelPeriodo` (`lib/negocio/diasCerrados.ts:82`), y la cohorte es una sola
expresión para las dos pantallas (`lib/negocio/recorrido.ts:214`). La prueba
`pruebas/base/246-pasos-de-conversion.test.ts` exige que la cohorte de Conversion sea el `cobertura.sobre` de
Acquisition en 7 y 30 días. Creative sigue terminando sus ventanas hoy, y su «7 días» puede dar otra cifra.

**14. La base de todo porcentaje son los contactos, y lo que compara es una lista cerrada.** Las vistas de Meta
no son personas y no llevan tasa. Contra la ventana anterior comparan los contactos y la porción que entra por la
landing (con las dos cohortes en el piso); los agendados, a la misma edad y sin citas congeladas en la anterior;
las vistas, por su cuenta, con el gasto entero y el desglose completo en las dos ventanas. **Nunca** comparan el
formulario, los calificados, los no calificados, los confirmados ni los que cancelaron: el descarte y la
confirmación no tienen fecha (`lib/negocio/pasosDeConversion.ts:278`, `CV15-20`).

**15. El servidor calcula; el navegador dibuja.** Las tasas, las caídas y las variaciones con su lectura llegan
hechas; el navegador sólo les da formato, multiplica por 100 en un solo lugar
(`components/conversion/comun.jsx:77`) y elige la frase de la lista cerrada. La prueba
`pruebas/codigo/247-la-pantalla-de-conversion.test.ts` lo vigila.

**16. Con varios clientes (el nivel 3, C5 · G3), las vistas no son las de otro cliente.** Si un cliente pautó en la
ventana sin Meta conectado, sus vistas no las leyó nadie: no se publica la suma de los demás ni el cero que midió la
cuenta de otro, y la nota dice «Faltan días de gasto» (`lib/negocio/pasosDeConversion.ts:542`). Y con un cliente sin su
gasto en la ventana o en la anterior, las vistas no comparan, diciendo por qué (`lib/negocio/pasosDeConversion.ts:609`,
`lib/negocio/pasosDeConversion.ts:619`). Desde C6 · D1, la nota dice después de «Faltan días de gasto» de qué cliente
falta y qué hacer, preguntando por la ventana que decidió el motivo (`lib/negocio/pasosDeConversion.ts:642`). Con un
solo cliente, lo de siempre. Lo exigen `pruebas/base/284-acquisition-y-conversation-con-varios-clientes.test.ts` y
`pruebas/base/290-los-avisos-dicen-de-que-cliente.test.ts:567`.

**17. Las señales, por cliente (C6 · D3).** Con contactos de más de un cliente, el detector mide a cada cliente activo
contra SU cohorte, SU anterior y el campo del formulario de SU CRM (`lib/negocio/pasosDeConversion.ts:695`), con la
misma regla de la anterior que la pantalla (`lib/negocio/pasosDeConversion.ts:224`): el cambio de mezcla entre
clientes ya no parece un cambio de ruta, y un CRM sin el campo no diluye ni frena a los demás
(`lib/agentes/detectores/conversion.ts:238`). Uno con la lectura de contactos atrasada no publica sus familias y deja
sin medición sólo lo suyo; la familia y el formulario de otro cliente llevan su id adelante y se dibujan con su nombre,
en la tarjeta y en los cajones (`components/conversion/CajonDelPaso.jsx:263`). Con los contactos de un solo cliente y
otro activo sin ninguno, el freno es el del que tiene contactos, y la anterior del cambio de ruta, la de SU lectura
(`lib/agentes/detectores/conversion.ts:173`): otro activo con la lectura fallando ya no lo deja sin medición para
siempre. La pantalla sigue siendo de la empresa. Lo exigen
`pruebas/codigo/294-las-senales-que-mezclaban-clientes.test.ts:289`,
`pruebas/base/295-las-senales-de-cada-cliente.test.ts:473` y
`pruebas/base/295-las-senales-de-cada-cliente.test.ts:488`.

---

## 7 · Riesgos

Conservan el número de la foto anterior, porque otros documentos los citan así; los cerrados lo dicen.

**1. «Completo» es la única ventana con formulario, y describe una ruta que ya no existe.** La tarjeta publica
quienes traen el campo sobre la cohorte anterior al corte, y la nota dice que la ventana cruza el 31 de agosto;
quien lea esa cifra como «el formulario de hoy» está mirando una ruta que se cerró. Sigue así el 2026-10-18: el
último contacto con el campo es del 2026-08-31.

**2. Cerrado el 2026-10-09.** El hueco de Clarity decía que Clarity aparecía en la pantalla como fuente
conectada (`lib/negocio/embudoDelFormulario.ts:142-143@b2dcdf5`). Ahora dice que no está integrado.

**3. La fila «Landing con VSL» de septiembre es casi toda circular, y no lleva la marca.** El 2026-09-28, en 30
días, eran 43 contactos, 37 capturados al reservar (86 %). El cajón marca sólo la fila registrada entera
(`components/conversion/CajonDelPaso.jsx:113`), y el aviso del servidor nombra las de un 90 % o más
(`lib/negocio/recorridoDelLead.ts:277-279`): esta fila sale sin marca, y sus agendados se leen como conversión de
la landing. Su rótulo (`lib/negocio/recorrido.ts:70-73`) describe agosto. No se re-midió con la ventana de hoy.

**4. Cerrado el 2026-10-09.** «Hoy» decía en su `title` «las últimas 24 horas» y medía el día de calendario. El
segmentado de Conversion ya no lleva ese `title`; `lib/negocio/periodo.ts:84` sigue diciéndolo para las otras
pantallas.

**5. Cerrado el 2026-10-01.** Executive publicaba en nombre de Conversion cifras inventadas; su maqueta se borró
en la etapa E7 de la nueva estructura (§ 3).

**6. A medias.** Los 24 sin alta los dice la nota de «Completo» desde el 2026-10-09. El rótulo de «Sin rastro»
sigue afirmando *«26 contactos, todos anteriores a septiembre»* (`lib/negocio/recorrido.ts:91-94`), y va en el
`title` de su fila del cajón de Landing, que muestra otro número.

**7. Una clasificación, dos pantallas.** La ficha de Leads Portal usa `familiaDelRecorrido` y `ROTULOS`
(`lib/negocio/fichaDelLeadDelPortal.ts:33-40`). Es el diseño correcto, pero un cambio en `lib/negocio/recorrido.ts`
mueve las dos pantallas a la vez.

**8. Landing Intelligence puede estar midiendo una ruta abandonada a propósito.** Si el cambio del 2026-08-31 fue
una decisión de negocio, la mitad del departamento mide algo que la empresa dejó; si fue un accidente, es un
defecto que nadie notó. La base no desempata.

**9. El § 17 sigue vacío, y la pantalla ya eligió.** No hay KPIs, umbrales ni responsables definidos por el
negocio. Lo que se publica lo decidieron el usuario y el doc 15, con diez preguntas que se tomaron con su
respuesta por defecto (`docs/conversion/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`, § 6). Los umbrales de las
cuatro reglas del detector siguen provisionales (`lib/agentes/detectores/conversion.ts:70`).

**10. Si se vuelve a instrumentar, que sean eventos y no un campo por contacto.** Dos toques sobrescribibles sin
fecha y un `% máximo visto` con 79 ceros son la demostración. La Fase 0 del modelo de datos, **construida en local
y sin subir**, ya trae la tabla para eso, `negocio.eventos` (`db/migraciones/084_los_eventos.sql:117`), vacía y sin
escritor (`db/migraciones/084_los_eventos.sql:14`).

**11. La alarma no aparece nunca.** Sólo se dibuja con señales `critica`, y ninguna regla de Conversion lo es
(`lib/agentes/detectores/conversion.ts:70`). Es la respuesta por defecto de `CV15-P05`: el lugar existe, vacío,
hasta que alguna regla merezca la alarma.

**12. «Confirmados» depende de un campo del CRM sin fecha.** Sobre los calificados, la tasa cuenta a quien
respondió `Si`; el 2026-10-18, 11 de los 19 calificados no habían respondido (el 2026-10-08, la mitad). No es la
confirmación de Conversation, que se calcula sobre los que respondieron (`CV15-P10`).

**13. «7 días» no es la misma ventana en Creative.** Conversion y Acquisition cortan en días cerrados; Creative
termina hoy. Mirando las tres pestañas el mismo día, «7 días» puede dar dos cohortes distintas: el 2026-10-18, la
de Conversion va del 10-11 al 10-17 y la de Creative, del 10-12 al 10-18.

**14. La cohorte de 30 días ya casi no tiene pauta.** **Nuevo, 2026-10-18.** Con 28 contactos, uno solo dado de alta
después del 2026-10-10, cada tasa de la tira está a pocos contactos del piso, y las que comparan lo hacen contra una
anterior de 367. No es un defecto del código: la pantalla dice lo que pasó. Pero una lectura de «30 días» que no
mire la cifra de Contactos va a tomar una cohorte de 28 personas por una tendencia.

---

## 8 · Lo que queda abierto

- **Las diez preguntas del doc 15** (`CV15-P01` a `CV15-P10`) se construyeron con su respuesta por defecto. Si el
  usuario contesta otra cosa, el cambio empieza en ese documento.
- **Lo que no mide** —el VSL, las sesiones, el mapa de calor, el campo por campo, las bandas— tiene su plan en
  `docs/OTROS/futuro/lo-que-conversion-no-mide.md`.
- **Las cifras de esta foto** son del 2026-10-18, del 2026-10-08 y del 2026-09-28, y cada una dice su fecha. No se
  re-midieron el reparto por época, el censo de hosts, el `userAgent` ni la columna «Con cita» del formulario.
- **La Fase 0 del modelo de datos** (`693a383..dc84cb2`) espera la aprobación de un ingeniero; cuando suba, esta
  pantalla no cambia, pero sus tablas llevan `cuenta_id`.
