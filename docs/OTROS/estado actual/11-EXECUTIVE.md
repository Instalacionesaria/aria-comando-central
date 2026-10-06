# Executive Intelligence

> Corte: **2026-09-28**. Las cifras de producción se midieron ese día a las 18:06 UTC, sobre la
> organización `aria`, sólo con agregados y por `scripts/supabase.mjs leer`. Cada afirmación lleva
> su archivo:línea o la consulta que la produjo; lo que no se pudo verificar está dicho como
> pendiente, no omitido. Las cifras se re-verificaron el 2026-09-29 a las 00:15 UTC con el instante
> fijado en 18:06 del 28, y reprodujeron. Para ubicar cualquier cosa nombrada acá, ver
> [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md).

> **Después del corte, el 2026-10-01**: esta maqueta se retiró en la etapa E7 de la nueva estructura, y su
> lugar lo tomó el Inicio (`docs/OTROS/nueva-estructura/04-EL-INICIO.md`). Lo que sigue es la foto del
> 2026-09-28: las citas al código que se borró están fijadas a `@c4cf2a8`, que es donde hay que leerlas.

**Maqueta completa — y desde el 2026-09-26, la única que queda.**

> **Después del corte, 2026-10-04 (AG5 de los agentes).** La bandera ya no está: `app/api/executive/route.ts`
> es la primera operación del Inicio, el servidor del cerebro —preguntar (`cerebro.usar`), ver los hilos
> propios (`tablero.ver`) y borrarlos—, y `lib/autorizacion/secciones.ts:220` quedó como un comentario de una
> línea. El conteo literal de la 90 pasó a 0 y la 30 exige que `executive` tenga su ruta. En AG6 se sumaron las
> herramientas de las demás secciones y una ruta por sección para la caja del pie
> (`app/api/<carpeta>/cerebro/route.ts`); lo común de todas está en `lib/agentes/executive/caja.ts`. Desde AG7
> (2026-10-05) la pantalla las usa: el chat del Inicio (`components/views/ExecutiveView.jsx`), la caja del pie
> con su panel y CONVERSACIONES (`docs/OTROS/agentes/08-LAS-ETAPAS.md`). Lo de abajo describe el corte del
> 2026-09-28.

Executive es la última sección con `sinOperacionesTodavia` (`lib/autorizacion/secciones.ts:213-219`)
y dibuja **179 literales numéricos y catorce contactos inventados** sin haber cambiado una línea de
datos desde el port del 2026-08-18. A 7 días dice 312 contactos, $8.525 de inversión y 11 ventas
(`lib/aios/executive.js:17@c4cf2a8`); la base dice **3 contactos, ningún día con gasto desde el
2026-09-14 y cero ventas en toda su historia**. Lo nuevo no es la maqueta: es que las seis
pantallas de las que habla —las cinco de Inteligencia y Leads Portal, a un clic desde su mapa, su
embudo o su cajón— ya miden, y la contradicen.

> **Desde el corte del 2026-09-15**
>
> - **Executive no cambió.** `lib/aios/executive.js` no se toca desde `a7f8f91` (2026-08-18, el
>   port), `components/views/ExecutiveView.jsx` desde `952688c` (2026-09-01, el mapa pulido),
>   `components/SidePanel.jsx` desde el port y `lib/aios/executive-chat.js` desde `74edd72`
>   (2026-08-26). Las cifras que dibuja hoy son las del primer día.
> - **Cambió todo lo de alrededor.** Desde el corte, cinco secciones bajaron la bandera con su
>   primera ruta: Acquisition `be5ba97` (09-16), Creative `3287f74` (09-19), Conversion `0add4cc`
>   (09-20), Sales `c109ebd` (09-21; su maqueta se fue el mismo día, en `1c875ac`) y Leads Portal
>   `3c361a1` (09-26). La lista derivada
>   tiene hoy una sola clave (`lib/autorizacion/secciones.ts:226`,
>   `pruebas/codigo/90-fundaciones.test.ts:1263`).
> - **El cierre de los overlays** pasó de `creative.js` al armazón en `332c0e6` (09-19), y
>   `executive-panel.js` dejó de sintetizar un clic sobre el botón de cierre en `0add4cc`
>   (`lib/aios/executive-panel.js:69-78@c4cf2a8`).
> - **El panel derecho se esconde a 1080 px o menos** en toda la aplicación, Executive incluido,
>   desde `1020412` y `0810498` (09-20; `app/armazon.css:363-389@c4cf2a8`).
> - **LP-6 le dejó dos herencias** (`aed4f27`, 09-26): el cajón «Grupo de contactos» pasó a ser
>   maqueta de Executive (`lib/aios/leads-group.js:57-68@c4cf2a8`), y la compuerta de paridad quedó con
>   `VISTAS` vacía y tres pasos, los tres de Executive (`scripts/paridad.mjs:148-153@c4cf2a8`,
>   `scripts/paridad.mjs:186-212@c4cf2a8`).
> - **Este archivo es nuevo.** La foto anterior no tenía informe de Executive: aparecía sólo dentro
>   de los otros, como la pantalla que publica cifras en su nombre.

---

## 1 · Qué pide el documento

El documento funcional (`CC_Arquitectura_Funcional.md`, 1.650 líneas con `wc -l`, fuera del
repositorio) **no especifica Executive**: lo lista como pendiente en el encabezado (línea 8) y en el
§ 17 (línea 1114). Lo que hay es una visión general y una docena de menciones sueltas.

- **§ 6 (líneas 292-346), la única sección propia.** «Será la puerta de entrada principal del
  usuario» (línea 294). Once responsabilidades (§ 6.1, líneas 296-308), la primera *«recibir
  conclusiones de todos los departamentos»*. Siete piezas de experiencia (§ 6.2, líneas 310-321):
  Executive Briefing, Ask Executive, Priorities, Decisions, Evidence, Initiatives y System
  Improvement. Dos modos de consulta, negocio y sistema (§ 6.3, líneas 323-344), y una regla: no
  proponer cambios internos sin evidencia (línea 344).
- **§ 2, los principios que más lo atan.** Valida lo que toque presupuesto o varios departamentos
  (§ 2.3, líneas 79-92); un departamento consume las conclusiones de otro y **no recalcula su
  conocimiento** (§ 2.4, línea 98); nada se optimiza contra el funnel completo (§ 2.5, línea 102); y
  toda recomendación dice qué datos la respaldan, qué confianza tiene y **qué dato falta** (§ 2.6,
  líneas 106-114).
- **§ 3 y § 4.** Es la capa ejecutiva entre inteligencia y ejecución (líneas 128-158) y la cima del
  organigrama (líneas 163-192).
- **§ 7 y § 14, lo que viene después de decidir.** Iniciativas con tareas, siete estados y
  medición de impacto (líneas 348-417 y 1003-1036), con una advertencia: distinguir correlación de
  causalidad (línea 1032).
- **Lo que otros le entregan.** Conversation, dieciocho renglones (§ 15, líneas 1040-1059);
  Acquisition, ocho renglones y un reporte resumido (§ 18.16-18.17, líneas 1563-1599). Sus
  veredictos de ejemplo están en el § 18.11 (líneas 1385-1431), y el § 18.18 le da la última
  palabra sobre un cambio (línea 1637).
- **Y una condición previa que el propio documento pone**: *«antes de construir Business, Creative
  y Executive Intelligence, debe validarse la trazabilidad»* hasta la venta reportada (§ 16.2,
  línea 1078, con la prueba 7 en la línea 1101).

No hay `docs/executive/`. Lo que cada departamento dejó escrito sobre lo que le entrega está en
`docs/acquisition/07-LO-QUE-ENTREGA-A-OTROS.md:25-34`,
`docs/creative/07-LO-QUE-ENTREGA-Y-RECIBE.md:145-152`,
`docs/conversion/07-LO-QUE-ENTREGA-Y-RECIBE.md:137-143`,
`docs/sales/08-LO-QUE-ENTREGA-Y-RECIBE.md:118-127` y
`docs/leads-portal/08-LO-QUE-ENTREGA-Y-RECIBE.md:157-329`. Este archivo los resume; no los repite.

---

## 2 · Qué hay hoy en pantalla

**La sección.** `executive`, grupo AIOS, capacidad `tablero.ver`, **sin ruta de servidor**
(`lib/autorizacion/secciones.ts:213-219`). No existe `app/api/executive/`. Medido el 2026-09-28:
de los **4 usuarios activos** de `aria`, **3 ven la pestaña** (los que no están restringidos por
sección o la tienen concedida; misma consulta que `docs/leads-portal/12-QUIEN-VE-QUE.md:95-115`, con
`seccion = 'executive'`). La foto del 2026-09-16 contaba once usuarios activos con `tablero.ver`
([05-SALES.md](05-SALES.md) § 2); no dice si eran todos de `aria`, así que la comparación no es
exacta.

**El código.** Todo es la capa imperativa del prototipo, arrancada por `bootAios()`
(`lib/aios/index.js:29-37@c4cf2a8`): de sus siete módulos, cinco sirven sólo a Executive
—`executive.js` (243 líneas), `executive-panel.js` (105), `executive-chat.js` (121),
`leads-group.js` (89) y `datepicker.js` (135), que ya sólo abre la píldora de Executive—;
`period-controls.js` (47) no tiene emisor (§ 3.7) y `shell.js` es el armazón. El marcado está en
`components/views/ExecutiveView.jsx` (313), `components/SidePanel.jsx` (30) y
`components/AskBar.jsx` (33), y los cajones en `components/Overlays.jsx`.

**Lo que se dibuja**, de arriba abajo:

- **Dos modos**, «Equipo» por omisión y «Funnel» (`components/views/ExecutiveView.jsx:27-106@c4cf2a8`). El
  cambio lo hace `lib/aios/executive.js:151-164@c4cf2a8`, y al pasar a Funnel **destapa** el selector, la
  nota de comparación y la píldora «Personalizado» (`lib/aios/executive.js:161-163@c4cf2a8`).
- **El mapa del equipo**: el núcleo con «3 temas hoy · 1 conflicto»
  (`components/views/ExecutiveView.jsx:232@c4cf2a8`) y cinco áreas con un rótulo y un punto de estado cada
  una (`components/views/ExecutiveView.jsx:236-305@c4cf2a8`). Al pasar el cursor, una ficha de tres renglones
  por área (`lib/aios/executive.js:177-232@c4cf2a8`); al tocar, navega (`lib/aios/executive.js:235-241@c4cf2a8`).
- **El funnel del negocio**: un cockpit con el objetivo del mes, los ingresos, una curva y tres
  mosaicos (`lib/aios/executive.js:66-129@c4cf2a8`), y una tabla de seis etapas atribuidas a cuatro
  departamentos (`lib/aios/executive.js:22-29@c4cf2a8`, `lib/aios/executive.js:131-137@c4cf2a8`) con volumen,
  porcentaje del total, avance y costo por unidad, más una fila de «cuello de botella»
  (`lib/aios/executive.js:142-147@c4cf2a8`). Cada fila navega (`lib/aios/executive.js:139-141@c4cf2a8`) y cada
  cifra abre el cajón de contactos (`lib/aios/executive.js:49@c4cf2a8`).
- **El panel derecho**: «Reunión de hoy» con tres temas y «Cambios en curso» con tres cambios
  (`components/SidePanel.jsx:5-27@c4cf2a8`, llenado por `lib/aios/executive-panel.js:51-52@c4cf2a8`), cada uno con
  un cajón de «qué pasó / qué hay que decidir / dónde está la evidencia»
  (`lib/aios/executive-panel.js:54-82@c4cf2a8`), más siete «reuniones anteriores»
  (`lib/aios/executive-panel.js:86-103@c4cf2a8`).
- **El chat**, «Pregúntale a Executive sobre …», **en todas las pantallas** y no sólo en ésta
  (`components/AskBar.jsx:16-29@c4cf2a8`, `components/CommandCenter.jsx:98-99@c4cf2a8`), con atajo Ctrl+K
  (`lib/aios/executive-chat.js:112-115@c4cf2a8`).

**Ventanas y pisos.** Tres botones —`hoy`, `7d` encendido, `mes`—
(`components/views/ExecutiveView.jsx:51-61@c4cf2a8`, `lib/aios/executive.js:30@c4cf2a8`). Los datos tienen dos
períodos más, `tri` y `hist` (`lib/aios/executive.js:12-13@c4cf2a8`, `lib/aios/executive.js:19-20@c4cf2a8`), que
ningún control alcanza. **No hay piso**: cada porcentaje se calcula sobre el denominador que haya
(`lib/aios/executive.js:37@c4cf2a8`), y ninguna cifra dice sobre cuántos se midió.

---

## 3 · Lo que está inventado, y qué dato real hay hoy para cada pieza

**Nada de Executive fue reemplazado.** Lo que se reemplazó son las pantallas de las que habla, y eso
cambió la naturaleza del problema: el 2026-09-15 eran seis maquetas que se contradecían entre sí;
hoy es una maqueta que contradice a seis pantallas que miden.

### 3.1 · El censo

Literales contados dentro de cada estructura, sin las claves ni los rótulos de período: un número
cuenta uno aunque lleve separador de miles o decimales («1,007», «0.61»), y una hora cuenta como dos.

| Juego | Dónde | Literales |
|---|---|---|
| `F`: 5 períodos × 9 cifras | `lib/aios/executive.js:15-21@c4cf2a8` | 45 |
| `PREVP`: la «ventana anterior», 5 × 5 | `lib/aios/executive.js:8-14@c4cf2a8` | 25 |
| El objetivo del mes, las cuatro semanas, «meta 8 semanales», «hace 7 periodos» | `lib/aios/executive.js:64-108@c4cf2a8` | 14 |
| `DEPT`: seis fichas de departamento | `lib/aios/executive.js:177-202@c4cf2a8` | 30 |
| Rótulos del mapa, más cinco puntos de estado | `components/views/ExecutiveView.jsx:232-303@c4cf2a8` | 7 |
| `MEET`: tres temas de la reunión | `lib/aios/executive-panel.js:11-27@c4cf2a8` | 10 |
| `CHANGES`: tres cambios en curso | `lib/aios/executive-panel.js:29-39@c4cf2a8` | 10 |
| Siete reuniones anteriores | `lib/aios/executive-panel.js:90-96@c4cf2a8` | 11 |
| «07:00 · 6 áreas» y «3 en seguimiento» | `components/SidePanel.jsx:8-23@c4cf2a8` | 4 |
| `SUGG`: preguntas sugeridas para diez pantallas | `lib/aios/executive-chat.js:17-28@c4cf2a8` | 2 |
| `ANSWERS`: cuatro respuestas escritas | `lib/aios/executive-chat.js:30-39@c4cf2a8` | 21 |
| **Total** | | **179** |

Aparte, la curva de ingresos es un trazo escrito a mano (`lib/aios/executive.js:103-106@c4cf2a8`), y el
cajón de contactos rellena con **catorce contactos inventados**, personas y empresas, tres con
monto, repetidos hasta cuarenta filas (`lib/aios/leads-group.js:14-37@c4cf2a8`). Todo lo demás del
funnel —tasas, costo por etapa, ROAS, ticket, margen, costo por venta— se deriva de `F` y es tan
inventado como su fuente.

### 3.2 · El funnel del negocio, contra la base

| Etapa (dueño que declara) | Executive a 7 días | Base a 7 días | Base a 30 días | Executive a 30 días |
|---|---|---|---|---|
| Contactos (Acquisition) | 312 | **3** | 277 | 1.248 |
| Conversaciones (Conversation) | 268 | 1 respondió, de 3 escritos | 161, de 270 escritos | 1.072 |
| Visitas landing (Conversion) | 194 | la visita no se mide; Meta no reporta vistas (sin entrega) | 44 contactos entraron por la landing; Meta reporta 1.330 vistas de landing | 776 |
| Agendamientos (Conversion) | 57 | 2 | 139 | 228 |
| Citas asistidas (Sales) | 36 | **sin dato** | **sin dato** | 144 |
| Ventas (Sales) | 11 | 0 | 0 | 44 |
| Ingresos | $27.940 | 0 ventas en toda la base | ídem | $111.760 |
| Inversión | $8.525 | **ningún día con gasto** | $1.974,93 | $34.100 |

Executive en `lib/aios/executive.js:17-18@c4cf2a8` (7 días y «mes»). Base medida el 2026-09-28 sobre `aria`,
cohorte por `alta_en_el_crm` en ventana móvil; «conversación» es «le escribimos y contestó», el
predicado de `lib/negocio/indicadoresDelLead.ts:250`; «entró por la landing» es la familia de
Conversion, por el host del último toque; «agendó» es tener una cita alcanzable. «Hoy» dice 48
contactos (`lib/aios/executive.js:16@c4cf2a8`) y en las últimas 24 horas entró **1**.

**Qué ruta ya calcula cada fila, y qué no existe:**

- **Contactos** — cuatro rutas cuentan la cohorte por `alta_en_el_crm`: `cadenaDeCierre` en Sales
  (`app/api/sales/route.ts:110`), `leadsDelPortal` en Leads Portal, `recorridoDelLead` en Conversion
  e `indicadoresDelLead` en Conversation. **Con dos formas de ventana**: móvil en Sales, Leads Portal
  y Conversation (`lib/negocio/cadenaDeCierre.ts:46-55`), anclada al día en Acquisition, Creative y
  Conversion (`lib/negocio/recorrido.ts:186-198`). Hoy, a 30 días, dan 277 y 276.
- **Conversaciones** — `indicadoresDelLead`, pero sólo detrás de `/api/auditoria`, que pide
  `auditor.ver` y no `tablero.ver` (`app/api/auditoria/route.ts:58`). Ver § 6, regla 6.
- **Visitas landing** — **no existe**: Conversion declara que no hay sesiones ni visitantes
  guardados (`lib/negocio/embudoDelFormulario.ts:129-136`). Lo que sí publica es cuántos contactos
  entraron por cada camino, en conteos y no en tasas (`lib/negocio/recorridoDelLead.ts:4-45`). Lo
  más parecido a una visita son las «vistas de la landing» que Meta reporta por pieza y Creative
  publica como tasa (`lib/negocio/rendimientoDelCreativo.ts:246-248`): 1.330 en la ventana de 30
  días al 2026-09-28, todas entre el 2026-08-30 y el 2026-09-13, en 88 filas de anuncio y día. Son
  cargas atribuidas a un anuncio, no visitantes.
- **Agendamientos** — lo calculan Sales (`con_cita`) y Conversation (`agendaron`), **con dos
  predicados**: cita alcanzable contra cualquier cita (`lib/negocio/indicadoresDelLead.ts:216-243`).
  Hoy coinciden, 139 y 139. El dueño que Executive declara, Conversion, no lo publica como etapa.
- **Citas asistidas** — **no existe**: `citas.asistio` vale nulo en las **333** citas. Eran 321 el
  2026-09-16 ([05-SALES.md](05-SALES.md) § 4) y 327 en la medición del 2026-09-21 de
  `lib/negocio/huecosDeSales.ts:28-30`. Lo más cercano es «la cita ya ocurrió y nadie la canceló»,
  el tercer eslabón de Sales, que **no es asistencia**: 46 contactos a 30 días. El calendario marca
  15 plantones, que Sales publica como conteo.
- **Ventas e ingresos** — `cadenaDeCierre` y `dineroDelMes` en Sales. Valen **cero medido**: 7
  resultados en toda la base, 0 ventas, 0 montos, el último del 2026-09-09 (igual que el
  2026-09-21). El dinero es del mes calendario y el selector no lo gobierna
  (`lib/negocio/dineroDelMes.ts:31-35`).
- **Inversión** — `costoDelAnuncio` en Acquisition, sobre `negocio.metricas_de_anuncio`. El
  recolector sigue escribiendo —869 filas después del 2026-09-17, la última sincronización a las
  06:20 UTC del 2026-09-28— y **ninguna trae gasto**, que es como el proveedor dice «no entregó»
  (`db/migraciones/050_lo_que_costo_cada_anuncio.sql:178-179`). Tampoco del 14 al 17: de las 1.185
  filas desde el 2026-09-14, 13 traen cero, 1.172 nulo y ninguna más; el último día con gasto es
  el 2026-09-13 (15,09): quince días sin pauta. A 30 días, $1.974,93, entregados entre el
  2026-08-30 y el 2026-09-13.
- **ROAS, margen, ticket y costo por venta** — **nadie los calcula** y hoy no se pueden: los dos
  primeros necesitan un ingreso y los otros dos dividen por ventas, y los dos valen cero. Quién
  debería calcularlos está escrito dos veces y distinto: Executive según
  `docs/acquisition/07-LO-QUE-ENTREGA-A-OTROS.md:138-148`, Business según
  `docs/acquisition/10-LO-QUE-PIDE-EL-DOCUMENTO.md:134-136`. Business no tiene pantalla.
- **El costo por etapa** — Acquisition publica el gasto por lead **de cada anuncio**
  (`lib/negocio/costoDelAnuncio.ts:212`); el de la empresa entera, por etapa, no lo calcula nadie.
- **La comparación contra la ventana anterior** (`PREVP`, `lib/aios/executive.js:57-63@c4cf2a8`) —
  **ninguna ruta la calcula**: un `grep` sobre `lib/negocio/` y `app/api/` no encuentra ninguna
  ventana previa. Lo más cercano, `fatigaDelCreativo`, compara dos mitades de la misma ventana por
  pieza, que es otra pregunta.

**La tabla tampoco es un embudo.** Dibuja seis etapas en fila con el avance de cada una sobre la
anterior (`lib/aios/executive.js:37@c4cf2a8`), y medido a 30 días la fila se ensancha: 44 contactos
entraron por la landing y 139 agendaron. De los 139, sólo 73 habían contestado alguna vez. Es la
regla § 11 de [07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) («una cadena que no es
monótona no es un embudo»), que la cadena de Sales satisface por construcción
(`lib/negocio/cadenaDeCierre.ts:29-37`). A 30 días esa cadena da 277 → 139 → 46 → 3 → 0.

### 3.3 · El objetivo del mes

«11 / 30 ventas», ritmo esperado al 61 %, «18 días restantes», «proyección 22» y cuatro semanas,
tres contra una meta de 8 y la cuarta contra 6 (`lib/aios/executive.js:64-85@c4cf2a8`). **No hay meta en
ninguna tabla**: `negocio.comisiones.meta_mensual` es nula en las **3 de 3** filas (medido el
2026-09-28; igual que el 2026-09-16). Los días restantes son un literal: al 2026-09-28 quedan dos.
La proyección exige ventas fechadas, y no hay ninguna.

### 3.4 · El mapa y las fichas: lo que Executive dice en nombre de cada departamento

| Departamento | Lo que Executive afirma | Lo que hay hoy, medido el 2026-09-28 |
|---|---|---|
| Acquisition | «2 a revisar», punto ámbar (`components/views/ExecutiveView.jsx:239-247@c4cf2a8`); «312 contactos · +9 %» y un hallazgo sobre una campaña (`lib/aios/executive.js:178-181@c4cf2a8`) | 3 contactos a 7 días y ninguna comparación calculada. El ICP por pieza lo publica Creative. La campaña citada no aparece: ningún anuncio se llama así y ningún contacto la trae en su atribución (medido el 2026-09-29, 00:20 UTC); el nombre de campaña no se guarda aparte, así que eso no la descarta del todo |
| Creative | «8 piezas activas», punto verde (`components/views/ExecutiveView.jsx:295-303@c4cf2a8`); «hook rate +4, cierre −7» (`lib/aios/executive.js:182-185@c4cf2a8`) | **14 piezas** con entrega a 30 días y **0** a 7. El hook rate existe en `rendimientoDelCreativo`; el cierre no existe |
| Conversion | «1 incidencia crítica», punto rojo (`components/views/ExecutiveView.jsx:267-275@c4cf2a8`); «26 % de visita a cita» y un formulario que falla en Safari (`lib/aios/executive.js:186-189@c4cf2a8`) | Conversion no publica tasas por camino, no publica dispositivo, y el formulario de la landing **no tiene quien lo llene desde el 2026-08-31** (`lib/negocio/embudoDelFormulario.ts:33-38`) |
| Conversation | «1 a revisar» (`components/views/ExecutiveView.jsx:253-261@c4cf2a8`); «58 % de efectividad» y el agente de voz en «14 de 22 llamadas» (`lib/aios/executive.js:190-193@c4cf2a8`) | «Efectividad» no está definida en ningún otro archivo. Responde el 59,6 % (161 de 270 escritos, 30 días). **El agente de voz no se audita**: el auditor mira dos agentes de texto (`lib/auditor/veredicto.ts:52`), con 70 análisis en toda la base |
| Sales | «cierre 31 %», **punto verde** (`components/views/ExecutiveView.jsx:281-289@c4cf2a8`); «11 ventas · cierre 31 %» (`lib/aios/executive.js:194-197@c4cf2a8`) | 0 ventas; la tasa de cierre no tiene numerador ni piso. La pantalla de Sales lo dice como hueco declarado (`lib/negocio/huecosDeSales.ts:57-62`) |
| Leads Portal | «312 contactos · 78 de ICP alto», «22 % del volumen, 61 % de las ventas» (`lib/aios/executive.js:198-201@c4cf2a8`), **en una ficha que ningún nodo dibuja** | Tramo alto: 50 de los 277 de la cohorte a 30 días (18,1 %; 248 con un puntaje mayor que cero), 0 de 3 a 7 días; el 61 % no se puede calcular con cero ventas |

Y los dos juegos del panel derecho hablan en nombre de varios a la vez. `MEET` encadena
Creative → Conversion → Sales en un tema causal —«el hook nuevo está costando ventas»— y opone
Acquisition a Conversion sobre una campaña (`lib/aios/executive-panel.js:12-21@c4cf2a8`); `CHANGES` da
por bueno un formulario de 8 campos y reprueba un hook (`lib/aios/executive-panel.js:30-35@c4cf2a8`).
Ninguna fila del sistema registra un cambio, una hipótesis o una línea base (§ 5).

Los cinco sitios que el 2026-09-15 hablaban de Acquisition con datos inventados —la ficha, el
panel y el chat de Executive, un hallazgo de Conversion y el plan de Leads Portal— **quedaron en
tres, los de Executive**: los otros dos se fueron en `0add4cc` y `aed4f27`. Y ninguna pantalla de
departamento habla en nombre de Executive: un `grep` de «Executive» sobre `components/` y
`lib/negocio/` sólo encuentra comentarios, el montaje de la propia vista y los rótulos de su chat
(`components/AskBar.jsx:21@c4cf2a8`, `components/Overlays.jsx:63@c4cf2a8`).

### 3.5 · El chat

Las sugerencias cubren diez pantallas (`lib/aios/executive-chat.js:17-28@c4cf2a8`) y la respuesta sale de
cuatro textos fijos elegidos por palabras sueltas (`lib/aios/executive-chat.js:77-83@c4cf2a8`), después de
700 ms de «escribiendo» (`lib/aios/executive-chat.js:89-104@c4cf2a8`). No hay modelo detrás. Dos casos que el
código produce, leídos y no vistos en pantalla:

- **Un closer en su pestaña** toca «¿Cómo voy este mes?» (`lib/aios/executive-chat.js:27@c4cf2a8`), la
  palabra «mes» elige la respuesta de la meta (`lib/aios/executive-chat.js:80@c4cf2a8`) y lee «Vas 11 de 30
  con 18 días por delante» con Conversion y Sales como fuentes (`lib/aios/executive-chat.js:35-36@c4cf2a8`).
- **Cualquier pregunta sin esas palabras** recibe el párrafo de Conversion con «$15,000» y «78 % en
  móvil» (`lib/aios/executive-chat.js:31-32@c4cf2a8`): las tres de Leads Portal, las de Sales, las del setter.

Lo que existe hoy para contestar las tres de Sales —«¿por qué perdemos las llamadas?», «¿qué
objeción se repite?», «¿qué closer necesita apoyo?» (`lib/aios/executive-chat.js:23@c4cf2a8`)— no es de
Sales sino de Analizadores: medido el 2026-09-28, 38 llamadas de venta analizadas de 47 (reuniones
del 2026-07-31 al 2026-09-24), con objeciones por llamada y un desenlace según el modelo —**36 no
cerradas, 2 indeterminadas, 0 cerradas**— que no es una venta reportada
(`lib/analizadores/nucleo/ht.ts:135-137`). Vive detrás de `analizadores.ver`.

### 3.6 · El cajón «Grupo de contactos»

Cualquier cifra del funnel lo abre con un número (`lib/aios/executive.js:49@c4cf2a8`) y el cajón fabrica la
lista (`lib/aios/leads-group.js:31-37@c4cf2a8`); el pie promete «Ver los N en Leads Portal»
(`lib/aios/leads-group.js:60@c4cf2a8`), y a 7 días son 312 contra 3. **El dato para reemplazarlo existe**:
`leadsDelPortal` ya devuelve la cohorte persona por persona. Falta que el cajón reciba la cohorte y
no un conteo, que es `A7-28`, abierto (`docs/leads-portal/08-LO-QUE-ENTREGA-Y-RECIBE.md:302`).

### 3.7 · Los controles que no hacen nada

- **La píldora «Personalizado»** es el único `data-datepick` de la aplicación
  (`components/views/ExecutiveView.jsx:62@c4cf2a8`) y queda visible en modo Funnel
  (`lib/aios/executive.js:161-163@c4cf2a8`). Abre el calendario, pero nadie registra su función
  (`lib/aios/datepicker.js:129@c4cf2a8`, `lib/aios/datepicker.js:133@c4cf2a8`): al aplicar apaga los tres botones y
  cambia el rótulo (`lib/aios/datepicker.js:112-118@c4cf2a8`) y **las cifras siguen siendo las del botón
  anterior**.
- **`period-controls.js` quedó entero sin emisor.** Su comentario dice que lo vivo es abrir y cerrar
  `.pill-wrap` (`lib/aios/period-controls.js:27@c4cf2a8`), y ningún componente dibuja esa clase.
- **`tri` y `hist`**: dieciocho cifras de `F` y diez de `PREVP` que ningún botón pide.

---

## 4 · Datos que ya tenemos

Todo medido el 2026-09-28 sobre `aria`. Executive no lee ninguno: la columna de la derecha dice
qué módulo ya lo publica en otra pantalla.

| Dato | Medido | Quién lo publica |
|---|---|---|
| Contactos | 594, **570 con fecha de alta** (24 no entran en ninguna cohorte) | las cuatro cohortes del § 3.2 |
| Entrada diaria | 18, 23, 11, 14 y 12 del 8 al 12 de septiembre; **8 en los quince días desde el 14** | ninguna pantalla; la caída está anotada en `docs/leads-portal/08-LO-QUE-ENTREGA-Y-RECIBE.md:46` |
| Cohorte a 30 días | 277 móvil, 276 anclada al día | ídem |
| Respondieron / escritos | 161 / 270 a 30 días; 1 / 3 a 7 | `indicadoresDelLead`, Conversation |
| Cadena de cierre, 30 días | 277 → 139 → 46 → 3 → 0 | `cadenaDeCierre`, Sales |
| Camino de entrada, 30 días | landing 43, widget 114, de 276 en la ventana anclada de Conversion (sobre la móvil de 277, landing 44) | `recorridoDelLead`, Conversion |
| Gasto | 30 días $1.974,93; 7 días, ningún día con entrega; 7 campañas y 14 piezas entregaron en 30 | `costoDelAnuncio` y `rendimientoDelCreativo` |
| Tramo del ICP, 30 días | de 277: alto 50, medio 81, bajo 117 y sin calificar 29 (6 sin puntaje, 23 en cero) | `leadsDelPortal`, cortes en `lib/negocio/tramosDelIcp.ts:38-41` |
| Resultados | 7, 0 ventas, 0 montos, 0 con cita; último el 2026-09-09 | `dineroDelMes` y `cadenaDeCierre` |
| Citas | 333, 0 con asistencia registrada, 15 plantones del calendario | `cierrePorCloser`, Sales |
| Auditoría de agentes | 70 análisis: 64 post-agenda, 6 pre-agenda | `/api/auditoria`, Conversation |
| Llamadas de venta | 47 de tipo HT, 38 analizadas; `negocio.llamadas` sigue en 0 | Analizadores |
| Avisos y huecos declarados | avisos en las rutas; lista de lo que no se puede medir en cinco (Conversation no verificado); con fecha, sólo Sales y Leads Portal | las rutas de departamento |

La última fila es lo más cercano a lo que el § 6.1 pide primero, «recibir conclusiones»: el aviso
de la cadena de Sales ya dice cuántos contactos tuvieron una cita que ocurrió y nadie registró
(`lib/negocio/cadenaDeCierre.ts:316-327`); a 30 días, 43 de 46. Es un hallazgo real, con
denominador, que ninguna pantalla le entrega a Executive.

La consulta de la cadena, con los predicados de `lib/negocio/citasAlcanzables.ts`, para repetirla:

```sql
with org as (select id from identidad.organizaciones where slug = 'aria'),
k as (select c.* from negocio.contactos c
       where c.org_id = (select id from org) and c.alta_en_el_crm >= now() - interval '30 days')
select count(*) cohorte,
  count(*) filter (where exists (select 1 from negocio.citas ci where ci.org_id = k.org_id
    and ci.contacto_id = k.id and ci.ghl_calendario_id is not null)) con_cita,
  count(*) filter (where exists (select 1 from negocio.citas ci where ci.org_id = k.org_id
    and ci.contacto_id = k.id and ci.ghl_calendario_id is not null and ci.inicio_el < now()
    and lower(coalesce(ci.estado_ghl, '')) <> all (array['cancelled','canceled','cancelada']))) cerrable
from k;
-- 2026-09-28 18:06 UTC: 277 · 139 · 46 (con now() cambia a medida que corre la ventana)
```

---

## 5 · Datos que faltan, y de dónde tendrían que venir

Executive **no declara ningún hueco**: no tiene lista, ni fecha, ni aviso. Lo que le falta es la
suma de lo que otros ya declararon y de lo que nadie tiene.

**1 · La asistencia y la venta.** Los dos eslabones del § 16.2 que el documento exige validar antes
de construir Executive (línea 1078). La asistencia tiene columna desde la migración 049
(`db/migraciones/049_si_se_presento_a_la_cita.sql:47`) y escritor en Avanzar
(`lib/negocio/avanzar.ts:248`), y **cero filas**; la venta, cero en toda la base. Tienen que venir
del registro del closer. Sales lo declara en `lib/negocio/huecosDeSales.ts:46-85`, medido el
2026-09-21. Re-medido el 2026-09-28: los 7 resultados (4 seguimientos, 2 no-show, 1 no interesa),
0 ventas, 0 montos y 0 citas enganchadas siguen igual; el resto de esa lista no se re-midió.

**2 · La meta.** `meta_mensual` nula en 3 de 3. Registro manual; nadie la pidió todavía.

**3 · El gasto de estos quince días.** No falta el dato: la pauta no entregó. Pero cualquier cifra de
costo a 7 días hoy es «sin entrega», no «$0», y así tiene que decirse.

**4 · La visita, la sesión, el VSL y el dispositivo.** Declarados por Conversion
(`lib/negocio/embudoDelFormulario.ts:116-157`, escrito el 2026-09-20), Creative
(`lib/negocio/rendimientoDelCreativo.ts:143-168`, del 2026-09-18) y Leads Portal
(`lib/negocio/huecosDelLeadsPortal.ts:37-77`, del 2026-09-27). Las «visitas landing», el «26 % de
visita a cita» y el «78 % en móvil» de Executive cuelgan de ellos. Vienen de instrumentar la landing
o de Meta directo, no del CRM.

**5 · La ventana anterior.** Ningún módulo la calcula. Es trabajo propio, no un dato ajeno, y
arrastra la regla del delta sin denominador (`docs/acquisition/02-METRICAS.md:701-717`).

**6 · El registro de cambios, prioridades e iniciativas.** El § 14 pide doce campos por cambio y el
§ 7, siete estados por tarea. No hay tabla: `negocio.tareas` son los seguimientos del closer (4
filas) y no iniciativas. Sin eso, «Cambios en curso» y «Reuniones anteriores» no tienen fuente.

**7 · El contrato de las conclusiones.** El documento lo deja pendiente —«contratos de comunicación
entre agentes», § 17, línea 1120—. Lo más parecido son los `aviso` y `huecos` de cada ruta, que no
tienen una forma común.

**8 · La auditoría del agente de voz.** El auditor mira sólo texto (`lib/auditor/veredicto.ts:52`).

### Lo que haría falta para que baje la bandera

El mecanismo es corto y va en un solo commit, como las siete veces anteriores que disparó el cable
(`pruebas/codigo/90-fundaciones.test.ts:1224-1263`):

1. **Una ruta** con `export const PANTALLA = 'executive'` cuyo `GET` pida exactamente
   `tablero.ver` (`pruebas/codigo/30-portero.test.ts:280-323`).
2. **Borrar la bandera**, que estaba en la línea 219 de `lib/autorizacion/secciones.ts` (hecho en AG5). Con la ruta y la bandera a la vez,
   `30-portero` falla por dos lados (`pruebas/codigo/30-portero.test.ts:325-352`,
   `pruebas/codigo/30-portero.test.ts:445-456`).
3. **Bajar el conteo literal a cero** (`pruebas/codigo/90-fundaciones.test.ts:1263`). Y decidir qué
   pasa con el cable trampa: con la lista vacía, la prueba de `ADR-0303` que la mira pasa sin mirar
   nada. Pero una sección nueva que nazca sin operaciones —como nació `tools`
   (`lib/autorizacion/secciones.ts:389-393`)— necesita la bandera para no dar rojo, así que
   retirarla del tipo no es gratis.
4. **Los períodos de `lib/negocio/periodo.ts:83-96`.** `data-p="mes"` se rechaza con un 400
   (`lib/negocio/periodo.ts:188-193`, `app/api/sales/route.ts:82-85`); `tri` no existe, y lo más
   cercano a `hist` es `completo`.
5. **La paridad.** «funnel ejecutivo» y «grupo de contactos» comparan el texto de `#exFunnel` y del
   cajón contra el prototipo (`scripts/paridad.mjs:209-212@c4cf2a8`, `scripts/paridad.mjs:346-356`): con
   cifras reales quedan en rojo para siempre. Salen con su motivo, y
   `pruebas/codigo/90-fundaciones.test.ts:1406-1410@c4cf2a8` deja de exigir que el cajón se abra desde el
   embudo. Si sale también «Ask Executive», la compuerta imprime «retirada»
   (`scripts/paridad.mjs:301-305`). Lo que no vale es editar el prototipo para que dé verde
   (`scripts/paridad.mjs:75-78`).

Y lo que no es mecánico, que es lo que de verdad falta: qué hace Executive con Conversation
(§ 6, regla 6), con qué ventana cruza gasto y contactos (regla 3), de dónde salen la reunión, los
cambios y la meta (puntos 2, 6 y 7 de arriba), y si el chat se conecta a un modelo o se retira.
Mientras eso no se decida, bajar la bandera sólo cambiaría literales por ceros.

---

## 6 · Reglas propias de este departamento

**1 · Consume, no recalcula.** § 2.4 (línea 98) y la regla del proyecto: *«si dos pantallas muestran
el mismo número, comparten la función que lo calcula»* (`app/api/closer/mi-dia/route.ts:17-18`).
Leads Portal ya lo escribió para el funnel: quien lo construya consume `cadenaDeCierre` o la cohorte
del portal, **no escribe una tercera** (`docs/leads-portal/08-LO-QUE-ENTREGA-Y-RECIBE.md:325-329`).

**2 · Una fila de etapas de cuatro departamentos no es un embudo.** Ver el § 3.2: se ensancha entre
«landing» y «agendó». La única cadena del sistema que llega hasta la venta y es monótona por
construcción es la de Sales.

**3 · Gasto y contactos, en la misma ventana.** El gasto es un `date` y la cohorte un instante; mezclar
las dos formas dividió una vez treinta y un días de gasto entre treinta de leads
(`lib/negocio/costoDelAnuncio.ts:33-63`). Todo costo por etapa de Executive cae ahí.

**4 · El dinero es del mes calendario, y es venta reportada.** No lo gobierna el selector
(`app/api/sales/route.ts:24-26`) y no es un pago verificado (`lib/negocio/cadenaDeCierre.ts:353-358`,
§ 5.4 del documento). Y el del closer no se suma con el del setter (`lib/negocio/etapas.ts:86-94`).

**5 · Los dos ceros y el piso.** Con cero ventas, el ticket y el costo por venta dan `NaN` o
infinito (`lib/aios/executive.js:95@c4cf2a8`, `lib/aios/executive.js:125@c4cf2a8`); con una cohorte de 3, cualquier
avance está bajo el piso de 10. Ver [07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) § 2 y
§ 3.

**6 · Conversation pide otra capacidad.** Su sección es `auditor.ver` desde el 2026-09-21
(`lib/autorizacion/secciones.ts:297-316`) y Executive es `tablero.ver`; `ADR-0304` no deja que dos
`GET` de una pantalla pidan conjuntos distintos. Publicar aquí sus agregados es abrirlos a quien no
ve Conversation. Hoy no alcanza a nadie —los tres roles llevan las dos capacidades, medido el
2026-09-21 (`lib/autorizacion/secciones.ts:304-305`) y re-medido el 2026-09-29 a las 00:25 UTC:
3 de 3 roles con `tablero.ver` tienen también `auditor.ver`—, pero es una decisión, no un detalle.

**7 · Qué dato falta, y correlación no es causa.** § 2.6 (línea 114) y § 14 (línea 1032). `MEET`
afirma una causa —«el hook nuevo está costando ventas»— sobre tres series que no existen.

---

## 7 · Riesgos

**Ahora contradice a pantallas que miden, y el clic lleva de una a otra.** El nodo de Sales dice
«cierre 31 %» con punto verde y navega a una pantalla que publica cero ventas; la fila «Contactos»
dice 312 y abre un cajón que promete 312 en Leads Portal, que a 7 días tiene 3. Antes la
contradicción era entre dos maquetas; hoy, quien la note va a desconfiar de la que tiene razón.

**El chat inventa en todas las pantallas y para todos.** Se dibuja para los cuatro usuarios activos,
tengan Executive o no, y contesta con cifras de ventas a un closer en su propia pestaña (§ 3.5).
Además rotula el período con el botón escondido de Executive, porque el selector de
`lib/aios/executive-chat.js:56-57@c4cf2a8` encuentra primero `#exPeriod`: puede decir «7 días» sobre una
pantalla abierta en 30. Leído del código, no verificado en pantalla; el mismo defecto está descrito
en `docs/acquisition/07-LO-QUE-ENTREGA-A-OTROS.md:380-385`.

**El panel derecho puede verse sin tener Executive.** La columna existe por omisión
(`app/aios.css:117-125`) y la esconde `.solo` (`app/aios.css:115-116`), que ponen la navegación
(`lib/aios/shell.js:135@c4cf2a8`) y el modo Funnel de la propia Executive (`lib/aios/executive.js:160@c4cf2a8`), que
quien no tiene Executive no dibuja. Nada la pone al cargar, y quien no tiene Executive arranca en
otra pestaña (`lib/autorizacion/secciones.ts:863-873`): hoy, uno de los cuatro activos vería
«Reunión de hoy» a más de 1080 px hasta su primer clic en el menú. No verificado en el navegador.

**Una alarma falsa y dos luces verdes.** El punto rojo de Conversion anuncia un formulario roto en
Safari; los verdes de Sales y Creative declaran sanos a dos departamentos sobre tasas que no existen.

**Reemplazar literal por literal.** Cambiar `F` por las cifras de las rutas sin tocar el render
dibuja `$NaN`, infinitos y avances sobre tres personas (regla 5), y deja la fila de etapas afirmando
un embudo (regla 2).

**Una compuerta que protege lo inventado.** La única paridad que queda compara textos inventados
contra el prototipo; está dormida —no corre en CI y pide sesión (`scripts/paridad.mjs:141-146`)—,
pero el día que alguien la corra, arreglar Executive la pone en rojo.

**Lo que no se verificó.** Ninguna de estas pantallas se abrió con sesión y datos reales para este
informe: todo lo que dice qué se dibuja sale de leer el código. Las cifras de la base sí están
medidas, y la de «quién ve la pestaña» repite una consulta de otra carpeta con la sección cambiada.
