# Acquisition Intelligence
> Corte: **2026-09-15**. Cada afirmación lleva su archivo:línea o la consulta que la produjo.
> Lo que no se pudo verificar está dicho como pendiente, no omitido.
> Para ubicar cualquier cosa nombrada acá, ver `08-COMO-USAR-EL-GRAFO.md`.

**Prototipo completo — pantalla entera con datos inventados.**

La pantalla es un prototipo completo sin una sola cifra real —302 líneas que dibujan 7 campañas inventadas—, pero debajo la mitad del §18.4 ya está guardada: 176 de 233 contactos de la ventana traen el identificador del anuncio de Meta y 217 el de la campaña, mientras que TODO lo que cuesta dinero (gasto, impresiones, alcance, frecuencia, CTR, CPM, CPC, métricas de video) no existe en ninguna tabla de esta base.

---

## 1 · Qué pide el documento

El §18 es el segundo departamento más especificado del documento: diecinueve subsecciones, de la línea 1124 a la 1650 de `C:\Users\USUARIO\Downloads\AIOS\AIOS_Arquitectura_Funcional_v0.2.md`.

**§18.1 Misión** — explicar qué pasa DENTRO de Meta Ads y qué pide atención. Explícitamente NO decide qué anuncio genera más dinero: esa conclusión cruza adquisición, ICP, agendamientos, ventas y revenue, y pertenece a otros.

**§18.2 Alcance** — cuenta publicitaria, campañas, ad sets, anuncios, creativos, audiencias, presupuesto, inversión, entrega, costos, clics, leads, métricas de video, retención, fatiga, anomalías, tendencias y calidad de atribución. El foco inicial son campañas que mandan tráfico a una landing con VSL y formulario.

**§18.3 Estructura interna** — seis componentes: Meta Data Collector, Campaign Performance Analyzer, Creative Performance Analyzer, Audience Performance Analyzer, Anomaly & Fatigue Detector, Attribution Monitor.

**§18.4 Datos que deben importarse desde Meta** — la subsección clave. Pide dos bloques. *Identificadores y dimensiones*: `meta_account_id`, `meta_campaign_id`, `meta_adset_id`, `meta_ad_id`, `meta_creative_id`, nombre de campaña, nombre de ad set, nombre del anuncio, estado, objetivo, presupuesto, fecha de inicio y fin, landing asociada, formato, placement y audiencia. *Métricas diarias*: spend, impressions, reach, frequency, clicks, link clicks, CTR, link CTR, CPC, CPM, leads, CPL, landing page views, video plays, reproducciones de 3 s, retención de 6 s, 25 %/50 %/75 %/100 %, average watch time y resultados reportados por Meta. Cierra con una exigencia de forma: «las métricas deben guardarse por fecha para permitir comparaciones históricas».

**§18.5 Relación con la atribución** — la relación recomendada es `lead.meta_ad_id = ad_performance.meta_ad_id = creative.meta_ad_id`, y además pide conservar `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `fbclid`, `first_touch_meta_ad_id`, `last_touch_meta_ad_id`, `first_touch_at`, `last_touch_at`. Y pone el freno que hace honesto a todo el departamento: puede informar sobre Meta aunque la atribución posterior esté incompleta, pero **no debe presentar como definitivas conclusiones sobre citas, ventas o revenue cuando la trazabilidad sea insuficiente**.

**§18.6 Datos que consume** — desde Meta, todo lo de arriba; desde la capa compartida, leads atribuidos por anuncio, visitas atribuibles a la landing, formularios iniciados, formularios completados, citas atribuidas, ICP promedio por anuncio y resultados comerciales «únicamente como contexto». Cierra: «Acquisition no recalcula revenue, CAC real ni ROAS real».

**§18.7 KPIs** — cuatro bloques: entrega y costo (spend, CPM, reach, frequency, impressions, delivery status); interacción (CTR, link CTR, CPC, landing page view rate, click-to-landing rate); leads (leads, CPL, lead rate, cost per qualified lead); video y creativo (3 s view rate, retención 6 s, 25/50/75/100 %, average watch time, hook retention proxy, fatigue trend). Y un quinto, calidad de atribución: leads por anuncio, citas atribuidas por anuncio, **porcentaje de contactos con `meta_ad_id`**, y diferencia entre leads reportados por Meta y leads identificados en la base.

**§18.8 Responsabilidades** — y una lista de lo que NO es responsable que vale tanto como la primera: no declara cuál anuncio es el mejor para el negocio, no calcula revenue/CAC/ROAS reales, no evalúa closers ni conversaciones, no escala presupuesto sin contexto global, no apaga campañas sólo con métricas de Meta.

**§18.9 / §18.10** — separa recomendaciones operativas que se muestran directo al media buyer (revisar caída de CTR, investigar aumento de CPM, probar audiencia, crear variantes por fatiga, investigar diferencias entre leads de Meta y GHL) de acciones que requieren validación ejecutiva (duplicar o reducir presupuesto, apagar anuncios, mover presupuesto, declarar ganador, escalar únicamente por CPL).

**§18.11** — tres casos de colaboración: CPL bajo con ventas bajas, CTR que cae con revenue estable, y buen CTR con mala landing.

**§18.12 Creative Performance Analyzer** — retención inicial, CTR, CPL, caídas de retención, fatiga, frecuencia, formato, duración, placement. No reemplaza a Creative Intelligence.

**§18.13 Anomaly & Fatigue Detector** — caídas inusuales de CTR, aumentos abruptos de CPM, aumento sostenido de CPL, frecuencia alta, spend sin crecimiento proporcional, diferencias entre leads de Meta y la base, anuncios sin entrega, concentración excesiva de presupuesto. Y define la forma de cada alerta: `alert_id, entity_type, entity_id, metric, baseline, current_value, change_percentage, period_start, period_end, severity, confidence, possible_causes, recommended_review, created_at`.

**§18.14 Attribution Monitor** — porcentaje de leads con `meta_ad_id`, porcentaje de citas con anuncio identificado, porcentaje de ventas reportadas con anuncio identificado, diferencia entre leads de Meta y GHL, sesiones con UTM incompletas, first-touch sobrescrito, contactos sin campaña o creativo. Con el ejemplo: «El 37 % de los contactos creados esta semana no conserva `meta_ad_id`».

**§18.15** — tres audiencias: media buyer (rendimiento por campaña/ad set/anuncio, alertas, recomendaciones, tareas, evidencia), responsable creativo (mejor retención, creativos fatigados, hooks) y gerencia (estado general, riesgos, gasto, eficiencia, calidad de atribución, impacto de cambios).

**§18.16** — qué entrega a Creative, Conversion, Business y Executive.

**§18.17** — la plantilla del reporte para Executive, que incluye el renglón «Calidad de atribución: 91 % de leads con meta_ad_id válido».

**§18.18** — cada cambio en Meta se vincula a una tarea con hipótesis, métrica local, métricas globales, responsable, periodo y resultado. Acquisition evalúa el efecto local; Business el global.

**§18.19 Pendientes técnicos inmediatos** — diez, y son casi la agenda de este informe: confirmar campos importados, definir frecuencia de sincronización, guardar métricas por día, implementar first-touch y last-touch, validar UTMs en GHL, validar `meta_ad_id` en formularios y contactos, relacionar leads/citas/ventas con el anuncio, crear alertas estructuradas, definir umbrales de anomalía y fatiga, y separar recomendaciones locales de decisiones ejecutivas.

**§4 Organigrama** (líneas 163-196) — Acquisition Intelligence cuelga directo de Executive Intelligence y tiene un solo hijo: **Meta Ads**. Es el único departamento del organigrama cuyo hijo es un proveedor externo y no una capacidad interna, y ahí está resumido el problema entero de este departamento: sin ese hijo conectado, el nodo está vacío. En Team Execution le corresponde el «Responsable de Ads».

---

## 2 · Qué hay hoy en pantalla

**Una pantalla que se dibuja entera en el navegador, sin una sola llamada al servidor.**

La sección está declarada en `C:\PROYECTOS\ARIA\Comando Central\lib\autorizacion\secciones.ts:241-247`: clave `acquisition`, nombre «Acquisition», `capacidadRequerida: 'tablero.ver'`, `sinOperacionesTodavia: true`, grupo de menú «Inteligencia». Esa bandera es literal: `ls app/api/` devuelve 17 carpetas (admin, auditoria, auth, avisos, closer, contactos, control, cron, enlaces-rapidos, fundaciones, mensajes, monitoreo, salud, setter, sonda, tools, usuarios) y **ninguna es `acquisition`**. No hay ninguna consulta de servidor detrás de esta pantalla.

**El armazón** — `C:\PROYECTOS\ARIA\Comando Central\components\views\AcquisitionView.jsx`, 148 líneas. Encabezado «Acquisition · De dónde vienen los leads, y cuáles sirven» (líneas 15 y 17), un botón «Plan de acción» (`id="acqPlanBtn"`, línea 21), un segmentado de periodo Hoy/7 días/30 días (líneas 28-38), un selector de rango personalizado (64-92) y cinco contenedores vacíos que rellena JavaScript: `#acqKpis` (93), `#acqFunnels` (101), `#acqTables` (102). Al final, una tarjeta «Señales detectadas» (103-142) con dos alertas escritas a mano en el JSX.

**El relleno** — `C:\PROYECTOS\ARIA\Comando Central\lib\aios\acquisition.js`, 302 líneas, arrancado por `lib/aios/index.js:35` dentro de `bootAios()`. La cabecera del archivo (línea 1) lo dice sin adornos: «Portado de aios-command-center_1.html — líneas 5342-5640 del original». Es HTML de maqueta convertido a módulo.

Dibuja tres cosas:
- **Cinco KPIs** (`renderKpis`, líneas 143-159): Inversión, Contactos, Clics a landing VSL, Agendados y Calificados con su costo por calificado.
- **Tres tarjetas de embudo** (`renderFunnels`, 161-205), una por cada entrada de `FUNNELS`, con barras de proporción, tasa paso a paso o acumulada, costo por etapa y una barra de afinidad ICP en tres tramos.
- **Tres tablas desplegables por campaña** (`renderTables`, 207-254), con la leyenda `'Activa · Meta'` escrita fija en la línea 229 debajo del nombre de cada campaña inventada.

**El plan de acción** — `C:\PROYECTOS\ARIA\Comando Central\lib\aios\acquisition-plan.js`, 33 líneas enteras de recomendaciones de negocio escritas a mano en una plantilla de texto (líneas 7-28).

**Y la pantalla no es la única que habla de Acquisition con datos inventados.** El Executive tiene una ficha del departamento en `lib/aios/executive.js:178-181` y una tarjeta de conflicto en `lib/aios/executive-panel.js:12-15`; Conversion le manda un hallazgo en `lib/aios/conversion.js:64`; Leads Portal la menciona en `lib/aios/period-controls.js:56`; y el chat ejecutivo le sugiere tres preguntas en `lib/aios/executive-chat.js:19`. Son cinco pantallas afirmando cifras sobre un departamento que no mide nada.

**Un dato medido que conviene decir porque era la sospecha razonable:** el prototipo NO expone nombres reales. Un `grep -niE "yaping|nueva era|ariaia|zyra|evoluciona|tofu|bofu|latam"` sobre los tres archivos (`acquisition.js`, `acquisition-plan.js`, `AcquisitionView.jsx`) da **cero coincidencias**. Las siete campañas se llaman «Prospecting A», «Prospecting B», «Retargeting 90d», «Reel de autoridad», «Remarketing interacción», «Público frío» y «Remarketing web» — inventos genéricos. El riesgo de nombres reales está al revés, y llega el día que se conecte el dato: las campañas de verdad se llaman «NUEVA ERA | TOFU | LEADS | LATAM+USA | 01-09-26» y los anuncios «agendamiento - yaping», «El app», «economia us latino», «Evoluciona native».

---

## 3 · Lo que está hardcodeado

**12 juego(s) de datos inventados.**

### 3.1 · `FUNNELS`: tres embudos completos con sus etapas, etiquetas y nombres de costo — «Lead form ads», «Profile funnel» y «Booking directo», este último con una etapa extra (`forms`) que los otros dos no tienen

- **Dónde:** `lib/aios/acquisition.js:5-18`
- **Finge ser:** La estructura real de adquisición de la empresa: los caminos por los que entra un lead, y en qué se mide cada paso. El §18.2 pide exactamente esto («el foco inicial son campañas que envían tráfico hacia una landing con VSL y formulario»).
- **¿Se puede reemplazar hoy?** Parcialmente, y con otra forma. Medido sobre la ventana de 14 días (233 contactos), `atribucion_primera->>'medium'` da tres valores y no tres embudos: `facebook` 178, `calendar` 54, `External Form` 1. O sea, los caminos reales hoy son dos y medio, no tres, y ninguno se llama como los del prototipo. Lo que NO se puede reemplazar es la etapa `clics` («Clics a landing VSL»), que existe en los tres embudos del prototipo: no hay ninguna tabla de tráfico ni de sesiones en `negocio.*` (21 tablas, verificadas una por una) y ningún clic queda registrado en esta base.

### 3.2 · `CAMPS`: siete campañas inventadas con **58 literales numéricos**. Cada una trae inversión diaria (`invD`), entradas diarias (`entD`), tasas de paso (`r.clics`, `r.agendados`, y en el tercer embudo `r.forms`), tasa de calificación (`calif`) y una distribución ICP en tres tramos (`icp.a/m/b`). Cinco campañas aportan 8 números y dos aportan 9.

- **Dónde:** `lib/aios/acquisition.js:20-35`
- **Finge ser:** El inventario de campañas activas de Meta con su economía: cuánto se gasta por día en cada una, cuántos leads trae, qué proporción avanza a cada etapa y qué calidad de lead produce. Es el §18.4 entero (identificadores, presupuesto, leads) más el §18.7 (spend, CPL, lead rate, cost per qualified lead).
- **¿Se puede reemplazar hoy?** No, y es el «no» más importante del informe. El inventario de campañas SÍ existe: en la ventana de 14 días hay **4 `campaignId` distintos y 7 `adId` distintos**, medidos con `count(distinct atribucion_primera->>'campaignId')` y `->>'adId'` sobre los 233 contactos. Pero `invD` —la inversión— no existe en ninguna parte. Una búsqueda de columnas por nombre en los esquemas `negocio`, `public` e `identidad` con el patrón `spend|gasto|invers|budget|presupuest|impres|reach|frecuen|cpm|cpc|ctr|cpl` devuelve exactamente tres coincidencias: `negocio.comisiones.meta_mensual` (una meta de ventas, no Meta), `public.aria_brain_clientes.ht_budget` (de otra plataforma) y las columnas de `public.closer_meta_metricas`, que tiene **0 filas**. Sin gasto no hay CPL, ni costo por calificado, ni CPM, ni CPC: los cinco KPIs de la pantalla, cuatro son de dinero.

### 3.3 · `PERIODS`: cinco periodos con **15 números** — cada uno con días (`d`), un multiplicador del periodo actual (`m`) y otro del periodo de comparación (`pm`). Por ejemplo `p7:{d:7, m:1.04, pm:.97}`.

- **Dónde:** `lib/aios/acquisition.js:37-38`
- **Finge ser:** La variación real entre periodos: que esta semana haya ido 4 % mejor que la base y la anterior 3 % peor. Es lo que alimenta todas las flechas verdes y rojas de la pantalla (`delta`, líneas 124-134).
- **¿Se puede reemplazar hoy?** No como está planteado, porque no es una medición: es un multiplicador constante. Una flecha «▲ 4 %» que dice 4 % siempre, para cualquier campaña y cualquier semana. Lo que sí se puede medir hoy es la variación de VOLUMEN entre dos ventanas de 14 días armadas con `alta_en_el_crm` — pero ojo con el piso histórico: la migración 048 dice en su § 1 que ninguna cohorte armada con `alta_en_el_crm` tiene historia antes del despliegue, y medido, el contacto más viejo de la base es del 2026-08-24 y el más viejo con `alta_en_el_crm` en ventana es del 2026-09-01. No hay periodo anterior contra el cual comparar todavía.

### 3.4 · `seedMod(str)`: convierte el TEXTO de una fecha en un multiplicador entre 0,88 y 1,12 (`0.88 + (h % 25) / 100`, con `h` un hash de los caracteres módulo 997)

- **Dónde:** `lib/aios/acquisition.js:47-51, usado en 79-80`
- **Finge ser:** Que elegir otro rango de fechas devuelve otros números porque en ese rango pasaron otras cosas. Es el efecto más engañoso del módulo: la pantalla RESPONDE al selector de fechas, de forma determinista y estable, así que se comporta exactamente como se comportaría una pantalla real.
- **¿Se puede reemplazar hoy?** No aplica: no es un dato que se reemplace, es un generador que se borra. Cualquier cifra que se construya de verdad tiene que salir de una consulta con `alta_en_el_crm` entre dos fechas.

### 3.5 · La fórmula de afinidad ICP: los calificados se reparten en tres tramos y se ponderan `(icpA*100 + icpM*60 + icpB*25) / q`

- **Dónde:** `lib/aios/acquisition.js:98 (por campaña) y :111 (por embudo)`
- **Finge ser:** Un puntaje de afinidad ICP por campaña — el «ICP promedio por anuncio» que el §18.6 pide de Business Intelligence y que la columna «Afinidad ICP» de las tablas muestra en cada fila.
- **¿Se puede reemplazar hoy?** Sí, y con un dato mejor que el inventado. El CRM ya calcula un puntaje ICP numérico: el campo «Puntaje | ICP» (tipo `NUMERICAL`, resuelto por nombre en `negocio.campos_del_crm`) está poblado en **229 de los 233 contactos de la ventana**. Agrupado por nombre de anuncio, el promedio real es: «Evoluciona native» 73,9 (31 contactos), «agendamiento - yaping - 23/07» 68,6 (8), «link_in_bio» 57,0 (3), «El app» 45,8 (46), «agendamiento - yaping» 42,1 (109) y «economia us latino» 27,5 (19). El reparto en tres tramos y los pesos 100/60/25 hay que tirarlos: el puntaje viene continuo y promediarlo directo no necesita inventar cortes.

### 3.6 · El tope `cap = v => Math.min(.94, v)` aplicado a toda tasa de paso

- **Dónde:** `lib/aios/acquisition.js:86`
- **Finge ser:** Nada del negocio. Es una tapa estética para que las tasas multiplicadas por el modificador del periodo no pasen del 94 % y delaten que son inventadas.
- **¿Se puede reemplazar hoy?** No aplica: se borra. Una tasa real puede dar 100 % y el trabajo es explicar por qué, no taparla. Medido: el segmento «(sin adId)» de la ventana agenda 47 de 57, o sea 82,5 %, y esa cifra alta es precisamente la señal más importante de la pantalla.

### 3.7 · «Señales detectadas»: dos alertas completas escritas en el JSX, con severidad (ícono ámbar), título, diagnóstico con cifras («54 % de afinidad frente al 72 % del retargeting») y un botón «Ver evidencia» que no está cableado a nada

- **Dónde:** `components/views/AcquisitionView.jsx:103-142`
- **Finge ser:** El Anomaly & Fatigue Detector del §18.13, con la forma de alerta que esa subsección especifica (`alert_id, entity_type, entity_id, metric, baseline, current_value, change_percentage, severity, confidence, possible_causes, recommended_review`).
- **¿Se puede reemplazar hoy?** No. No existe ninguna tabla capaz de guardar una alerta con esa forma. `negocio.hallazgos` es lo más parecido —tiene `titulo`, `categoria`, `severidad`, `diagnostico`, `detectado_el`, `resuelto_el`— pero está atada al contacto y a la conversación: sus 20 filas tienen las 20 `contacto_id` poblada, y sus otras columnas son `analisis_id`, `agente`, `patron`, `criterio`, `fragmento_prompt`, `prompt_seccion`, `prompt_hash`. Es la tabla de Conversation Intelligence. Una alerta de Acquisition es sobre una campaña, un ad set o un anuncio, no sobre un contacto, y no hay `entity_type`/`entity_id` donde ponerlo.

### 3.8 · El modal «Plan de acción»: diez recomendaciones de negocio en una plantilla de texto, repartidas en cuatro grupos («Lo que dice la data», «Ajusta o pausa esto», «Haz más de esto», «Para otras áreas»), con umbrales concretos: «afinidad ICP de 43 %», «mientras el costo por calificado se mantenga bajo $110»

- **Dónde:** `lib/aios/acquisition-plan.js:7-28`
- **Finge ser:** Las recomendaciones operativas del §18.9, ya separadas de las decisiones ejecutivas del §18.10 — incluso reproduce bien esa separación, mandando la fuga de formulario a Conversion y la afinidad ICP a Leads Portal.
- **¿Se puede reemplazar hoy?** No. Las dos del grupo «Ajusta o pausa esto» son literalmente lo que el §18.10 prohíbe decidir en solitario («deja de escalar Prospecting B», «sube el presupuesto de retargeting»), y las tres del primer grupo dependen de un costo por calificado que no se puede calcular sin gasto. El texto además está en una plantilla estática: no se recalcula al cambiar el periodo, así que un usuario que mueva las fechas ve KPIs distintos y el mismo plan.

### 3.9 · Fechas por defecto del selector de rango: periodo 2026-07-01 → 2026-07-21 y comparación 2026-06-01 → 2026-06-21

- **Dónde:** `components/views/AcquisitionView.jsx:68, 72, 85, 89`
- **Finge ser:** Un rango de trabajo plausible.
- **¿Se puede reemplazar hoy?** Hay que cambiarlas sí o sí el día que la pantalla lea datos: los cuatro valores son ANTERIORES al primer contacto de la base. Medido, `min(creado_el)` en `negocio.contactos` es 2026-08-24 y el `alta_en_el_crm` más viejo dentro de la ventana es 2026-09-01. Con los valores de hoy, una pantalla real abriría mostrando cero y se leería como una pantalla rota.

### 3.10 · La ficha del departamento en Executive: «312 contactos · +9 % vs semana pasada», «Prospecting B baja el ICP alto de 41 % a 27 % con 22 % más de inversión · −110 contactos útiles», estado `warn`

- **Dónde:** `lib/aios/executive.js:178-181`
- **Finge ser:** El resumen que el §18.17 pide que Acquisition entregue a Executive.
- **¿Se puede reemplazar hoy?** El conteo sí: la ventana real de 14 días tiene **233 contactos**, no 312. El hallazgo no: menciona una campaña que no existe y una inversión que no está guardada.

### 3.11 · La tarjeta de conflicto: «Acquisition y Conversion se contradicen en Prospecting B» — «Acquisition lo escala porque trae el contacto más barato del mes, a $19»

- **Dónde:** `lib/aios/executive-panel.js:12-15`
- **Finge ser:** El caso 1 del §18.11 (CPL bajo, ventas bajas) ocurriendo de verdad y detectado automáticamente.
- **¿Se puede reemplazar hoy?** No. Los $19 son un costo por contacto y no hay gasto en la base. Y «se contradicen» requiere que los dos departamentos publiquen cifras reales: Conversion también es prototipo.

### 3.12 · Un hallazgo de Conversion dirigido a Acquisition, con `loss:48` contactos perdidos, estado `visto` y antigüedad `hace 2 días`; y tres preguntas sugeridas al chat ejecutivo («¿Qué campaña escalo?», «¿Cuál trae el ICP que cierra?», «¿Hay fatiga en algún anuncio?»); y un ítem de recomendación en Leads Portal que dice que «qué campañas traen ICP alto se decide en Acquisition»

- **Dónde:** `lib/aios/conversion.js:64, lib/aios/executive-chat.js:19, lib/aios/period-controls.js:56`
- **Finge ser:** El §18.16 funcionando: el flujo de información entre departamentos.
- **¿Se puede reemplazar hoy?** No hoy. La tercera pregunta («¿Hay fatiga en algún anuncio?») es la que más lejos está: la fatiga es frecuencia contra CTR en el tiempo, y ni frecuencia ni CTR ni serie diaria existen. La segunda («¿Cuál trae el ICP que cierra?») tiene la mitad —el ICP por anuncio se puede medir— y le falta la otra mitad: cero ventas registradas.


---

## 4 · Datos que YA tenemos

Todo lo que sigue está medido el 2026-09-14/15 contra producción con `node --env-file=.env.supabase scripts/supabase.mjs leer`. La lectura va por la Management API como el rol `postgres`, que tiene `rolbypassrls` (está documentado en la cabecera de `scripts/supabase.mjs`, líneas 9-13), así que los conteos son totales reales y no conteos recortados por la política de fila. Hay una sola organización con datos: `57e90f8a-cc6d-4837-8f71-fb5f52c82b38`, con 584 contactos.

**La ventana.** La cohorte se arma con `alta_en_el_crm`, que es cuándo entró el lead al CRM, y no con `creado_el`, que es cuándo lo vio nuestro barrido — la distinción la estableció la migración 048 en su § 1 y la respeta `lib/negocio/atribucionDelLead.ts:137`. La diferencia no es cosmética: con `creado_el >= now() - 14 días` la ventana tiene **256 contactos** y con `alta_en_el_crm` tiene **233**. Los 23 de diferencia son latencia de ingesta. En este informe la ventana son los **233 contactos con `alta_en_el_crm` entre 2026-09-01 y 2026-09-13**.

**Cobertura clave por clave de `atribucion_primera` sobre esos 233** (`count(*) filter (where atribucion_primera ? 'clave')`):

| clave de GHL | equivale en §18.4/§18.5 a | cobertura | % |
|---|---|---|---|
| `sessionSource` | canal del primer toque | 233 | 100 % |
| `mediumId` | id del medio (formulario, calendario) | 233 | 100 % |
| `utmSource` | `utm_source` | 224 | 96,1 % |
| `utmMedium` | **nombre del ad set** | 222 | 95,3 % |
| `utmContent` | **nombre del anuncio** | 220 | 94,4 % |
| `campaign` | nombre de campaña | 219 | 94,0 % |
| `campaignId` | **`meta_campaign_id`** | 217 | 93,1 % |
| `adId` | **`meta_ad_id`** | 176 | 75,5 % |
| `fbc` / `fbp` | cookies de Meta | 49 | 21,0 % |
| `fbclid` | `fbclid` | 42 | 18,0 % |
| `utmTerm` | **id del ad set** (`utm_term`) | 39 | 16,7 % |
| `utmKeyword` | duplicado de `utmTerm` | 36 | 15,5 % |
| `gaClientId` | id de Google Analytics | 33 | 14,2 % |
| `url` / `referrer` | landing y referente | 55 / 47 | 23,6 % / 20,2 % |

**Los dos ceros están limpios.** `count(*) filter (where atribucion_primera->>'adId' = '')` da 0, lo mismo `campaignId` y `utmSource`. Cuando el dato falta, falta la CLAVE: no hay cadenas vacías disfrazadas de valor. «No hay `adId`» significa siempre «GoHighLevel no mandó `adId`».

**La cobertura no está repartida al azar, y esto es el hallazgo central.** Cruzando `medium` con `sessionSource`:

- `medium = 'facebook'` + `Paid Social`: **178 contactos, 176 con `adId` y 176 con `campaignId` — 98,9 %**. Son los que entraron por el anuncio directamente (formulario nativo de Meta Lead Ads o clic a la landing).
- `medium = 'calendar'` + `Paid Social`: **41 contactos, 41 con `campaignId`, 0 con `adId`**. Vinieron de pauta y aterrizaron en el widget de agendamiento: la campaña sobrevive, el anuncio se pierde.
- `medium = 'calendar'` + `Direct traffic` 7 y + `Social media` 6, y `External Form` + `Direct traffic` 1: **14 contactos sin campaña ni anuncio, y es correcto** — no vinieron de pauta.

O sea: el agujero de atribución de anuncio no está repartido por toda la base; es **un solo hueco de 41 contactos con una forma identificable**, la campaña de retargeting que manda al calendario. Eso convierte el §18.14 en un diagnóstico accionable y no en un porcentaje ambiguo.

**§18.14 «porcentaje de leads con `meta_ad_id`», medido:** 176 de 233 sobre la cohorte completa = **75,5 %**; 176 de 219 sobre los contactos de pauta = **80,4 %**. Para campaña: 217 de 233 = 93,1 %, y 217 de 219 = 99,1 % sobre pauta. (De esos 217, dos son la etiqueta `{{campaign.id}}` sin renderizar, así que el `campaignId` real son 215 = 98,2 % de la pauta.) El ejemplo del §18.17 escribe «91 % de leads con meta_ad_id válido»; el real es 80,4 %.

**Inventario real de Meta en la ventana:** 4 `campaignId` distintos, 7 `adId` distintos y **1 solo id de ad set**. Las campañas:

- `120249633901590467` «NUEVA ERA | TOFU | LEADS | LATAM+USA | 01-09-26» — 171 contactos repartidos en dos `mediumId` de facebook (107 + 64), 7 anuncios entre las dos.
- `120249590301010467` «Nueva Era | Bofu | Agendas | Latam+usa | 28-08-26» — 39 contactos, todos por calendario, **0 anuncios identificados**.
- `120249792217660467` «NUEVA ERA | TOFU | Q. LEADS | LATAM+USA | 12-09-26» — 5 contactos, 3 anuncios. Campaña nueva, arrancó el 12.
- Sin `campaignId`: «Ig-dm» 9 contactos (nombre escrito a mano, sin id), más 7 sin nada.

**Reparto por anuncio, con agendas** (cohorte / agendaron, joinando `negocio.citas` con `ghl_calendario_id is not null`, el mismo filtro de cita alcanzable que usa el booking rate en `lib/negocio/atribucionDelLead.ts:132-135`):

- `120249633901580467` «agendamiento - yaping» — 109 / 48
- **(sin adId) — 57 / 47**
- `120249633901550467` «El app» — 44 / 20
- `120249633901570467` «economia us latino» — 17 / 6
- `120249792217700467` «El app» — 2 / 1
- `120249792217690467` «economia us latino» — 2 / 1
- `120249633901560467` «el modelo está roto» — 1 / 0
- `120249792217680467` «agendamiento - yaping1» — 1 / 0

**Citas.** 163 citas alcanzables con `inicio_el` en los últimos 14 días, sobre 149 contactos. De ellas, **82 con `adId` (50,3 %)**, 133 con `campaignId` (81,6 %) y 157 con `sessionSource` (96,3 %). Es la segunda métrica del §18.14 y está lista para publicar.

**El primer toque y el último.** `atribucion_ultima` está poblada en los 233 pero es mucho más pobre: `adId` 59 (25,3 %), `campaignId` 81, `utmSource` 89. Y la pregunta que el §18.14 llama «first-touch sobrescrito» tiene respuesta medida: **117 contactos tienen `adId` en el primer toque y no en el último, y sólo 1 cambió de anuncio entre los dos**. El primer toque no se pisa: se conserva y el último simplemente trae menos. Para Acquisition, la columna es `atribucion_primera`.

**Sobre el total histórico (584 contactos):** `atribucion_primera` útil en 544 y `atribucion_ultima` en 557; 40 y 27 quedaron en `{}`. Son los que no volvió a tocar el barrido desde la migración, que no rellena hacia atrás (048 § 1).

**Los campos del CRM, resueltos por nombre.** `negocio.campos_del_crm` tiene 170 definiciones. Resolviendo por `nombre` (nunca por identificador escrito a mano, como hace `campoPorNombre` en `lib/negocio/camposDelCrm.ts:307`), sobre los 233 de la ventana:

- «Last UTM Source» — 178
- «Last UTM Medium (Adset)» — 174
- «Last Landing URL» — 99
- «Meta Lead ID» — 89
- «Last UTM Content (Anuncio)» — 85
- «Last Campaign ID» — 79
- «Last FB ClickId» — 39
- «Puntaje | ICP» — 229

Y siete campos que existen en el catálogo y **ningún contacto de la ventana trae** —esto es un cero medido, no una ausencia de dato—: «Form Landing VSL» 0, «Porcentaje de Video Visto» 0, «Video Watch Percentage» 0, «VSL % máximo visto» 0, «VSL segundos vistos» 0, «Pre-Score | Meta Lead Ads» 0, «Puntaje | Meta Lead Ads» 0.

**«Last Landing URL» merece párrafo propio,** porque es donde aparece el único `meta_adset_id` que existe. De sus 99 valores, 33 traen `utm_term=` con un número largo y los mismos 33 traen `utm_id=`; 39 traen `fbclid`. Un ejemplo real, con el identificador recortado: `https://accelerator.ariaia.com/?utm_source=fb_ad&utm_medium=Engagers+++IG,+FB,+Web+-+365d&utm_campaign=NUEVA+ERA+|+BOFU+|+AGENDAS+…&utm_content=agendamiento+-+yaping+-+23/07&campaign_id=120249590301010467&fbclid=…&utm_id=120249590301010467&utm_term=120249590300950467`. Ahí `utm_id` es el id de campaña y `utm_term` es el **id del ad set**. Pero es un solo ad set: `count(distinct substring(url from 'utm_term=([0-9]+)'))` da **1**, y el mismo id aparece en `atribucion_primera->>'utmTerm'` en 39 contactos, siempre para el ad set «Engagers + IG, FB, Web - 365d». Los anuncios del ad set «Advantage+ ON / America Hispano / 25-65», que son 176 contactos, no traen id de ad set por ningún lado: los formularios nativos de Meta no pasan parámetros de URL.

El mismo campo da también las **landings** del §18.4: 11 distintas en la ventana — `accelerator.ariaia.com/` 44, `api.leadconnectorhq.com/widget/booking/wh97…` 23, `www.fbsbx.com/` 18, `calls.ariaia.com/widget/booking/pZqT…` 6, `precall.ariaia.com/form-pre-call-350857` 2, `trabaja-con-nosotros.ariaia.com/` 1, y seis URLs de `calls.ariaia.com/r/2/eyJ…` que son JWT con el `contact_id` adentro.

**La sincronización (§18.19 punto 2), resuelta para GHL.** `vercel.json` declara tres crons contra `/api/cron`: `*/10 * * * *`, `3 * * * *` y `17 6 * * *`. Medido, `max(contactos.sincronizado_el)` = 2026-09-15 02:30:30 UTC y **559 de los 584 contactos fueron tocados en la última hora**. El barrido corre y trae la atribución completa en cada pasada.

---

## 5 · Datos que faltan, y de dónde tendrían que venir

**1 · De Meta, por el API de Marketing — y esto es la mitad del §18.4 y casi todo el §18.7.**

Nada de lo que sigue está en esta base, comprobado contra la BASE y no contra el código: una búsqueda de columnas en `information_schema.columns` para los esquemas `negocio`, `public` e `identidad` con el patrón `spend|gasto|invers|budget|presupuest|impres|reach|frecuen|cpm|cpc|ctr|cpl|adset|ad_id|campaign|anuncio|creativ|meta_` devuelve trece filas, y ninguna es un dato de Meta poblado.

Falta, entonces: **spend** (y con él CPL, CPM, CPC, costo por calificado y cualquier cifra de dinero de la pantalla), impressions, reach, frequency, clicks, link clicks, CTR, link CTR, landing page views, video plays, reproducciones de 3 s, retención de 6 s, 25 %/50 %/75 %/100 %, average watch time, resultados reportados por Meta, delivery status, objetivo de campaña, presupuesto, fechas de inicio y fin, formato, placement, audiencia, `meta_account_id`, `meta_creative_id` y el `meta_adset_id` de todos los ad sets menos uno.

Sin eso no hay: §18.7 «Entrega y costo» completo, §18.7 «Interacción» completo, §18.7 «Video y creativo» completo, el Creative Performance Analyzer del §18.12 entero, y siete de los nueve detectores del §18.13.

**2 · Lo que ya está a medio camino y vale decirlo, porque es la mejor noticia del departamento.**

Existe `public.closer_meta_metricas`, con exactamente la forma que el §18.4 pide: `nivel`, `objeto_id`, `nombre`, `padre_id`, `fecha`, `gasto`, `impresiones`, `clics`, `alcance`, `ctr`, `cpc`, `cpm`, `leads`, `cpl`, `video_reproducciones`, `video_25`, `video_50`, `video_75`, `video_100`, `sincronizado_el`. Es una tabla diaria con jerarquía campaña→ad set→anuncio, o sea el «guardar métricas por día» del §18.19 punto 3 ya diseñado. **Tiene 0 filas.** Y `public.closer_org_config` tiene 3 filas con `meta_ad_account_id` y `meta_token_cifrado`: **0 no nulos en las dos columnas**.

Dos precisiones que importan. Primera: esas tablas son de la **plataforma anterior**, que vive en `public.closer_*`; lo nuestro es el esquema `negocio.*`. Un `grep -rn "closer_meta_metricas\|meta_ad_account_id\|meta_token_cifrado"` sobre todos los `.ts`, `.tsx`, `.js`, `.mjs` y `.sql` del repositorio (excluyendo `.next` y `node_modules`) da **cero coincidencias**: ni una línea de este sistema las toca. Segunda: el cero es un cero real, no un cero de RLS, porque la lectura va como `postgres` con `rolbypassrls`.

La conclusión que se puede sacar con esto es firme: **Meta nunca estuvo conectado en ninguna de las dos plataformas.** No es que se rompió; es que no se hizo. Y el esquema para recibirlo ya está pensado, así que conectar Meta es trabajo de integración (app de Meta, token de larga duración, revisión de app, un recolector diario) y no de diseño de datos.

**3 · De la landing, y no lo tiene nadie.**

El §18.6 pide «visitas atribuibles a la landing», «formularios iniciados» y «formularios completados», y el §18.7 pide «landing page view rate» y «click-to-landing rate». No existe ninguna tabla de tráfico, sesiones ni eventos de landing en `negocio.*`: son 21 tablas y las revisé una por una (`analisis_del_agente`, `avisos_del_crm`, `cambios_de_territorio`, `campos_del_crm`, `carpetas_del_crm`, `citas`, `closer_asignado`, `comisiones`, `contactos`, `control_aislamiento`, `enlaces_rapidos`, `hallazgos`, `ingesta_pulso`, `llamadas`, `mensajes`, `notas`, `prompts_del_agente`, `resultados`, `tareas`, `tareas_programadas`, y una más). El único rastro de landing es la URL final guardada en «Last Landing URL» (99 de 233) y `atribucion_primera->>'url'` (55 de 233) — que dicen DÓNDE cayó quien ya se convirtió en contacto, nunca cuántos la vieron. Los tres KPIs de landing necesitan analítica de la landing (Meta Pixel + Conversions API, GA4, o un endpoint propio), no Meta ni GHL.

Y ojo con la etapa «Clics a landing VSL», que el prototipo dibuja en los TRES embudos: es la etapa que menos existe de todas. Un clic no queda registrado en ninguna parte de esta base.

**4 · Alertas estructuradas (§18.13, §18.19 punto 8): falta la tabla.**

No hay dónde guardar una alerta de Acquisition. `negocio.hallazgos` es la tabla de alertas del sistema y es de Conversation: tiene 20 filas, todas con `contacto_id` poblada, y columnas `analisis_id`, `agente`, `patron`, `criterio`, `fragmento_prompt`, `prompt_seccion`, `prompt_hash`, `evidencia_agente`, `evidencia_contacto`. Una alerta de Acquisition es sobre una campaña, un ad set o un anuncio; hace falta el par `entity_type`/`entity_id` del §18.13, que ahí no existe.

**5 · Registro manual: nada obligatorio, pero una decisión pendiente.**

Lo comercial ya tiene su registro: `negocio.resultados`, con `contacto_id`, `salida`, `monto`, `forma_pago`, `cita_id`. Tiene **7 filas y ninguna es una venta**: 4 `seguimiento`, 2 `no_show`, 1 `no_interesa`. Así que la tercera métrica del §18.14 —«porcentaje de ventas reportadas con anuncio identificado»— **no da cero: no tiene denominador**. Es el caso de los dos ceros del que este proyecto se cuida, y publicarlo como 0 % sería afirmar que ninguna venta tiene anuncio cuando lo que pasa es que no hay ventas registradas.

Lo único que sí exigiría registro manual es el §18.18 (vincular cada cambio de Meta a una tarea con hipótesis, métrica local y periodo). `negocio.tareas` existe pero no tiene forma de apuntar a una entidad de Meta.

**6 · La frecuencia de sincronización de Meta (§18.19 punto 2).** Para GHL está resuelta: cron cada 10 minutos, medido funcionando. Para Meta no existe porque no existe el recolector. Y la decisión no es trivial: los insights de Meta se corrigen hacia atrás durante días, así que un recolector que sólo inserte «lo de ayer» va a guardar cifras que Meta después cambia. El §18.4 pide guardar por fecha justamente para poder rehacerlas.

---

## 6 · Reglas propias de este departamento

**1 · La clave del anuncio es `adId`, nunca el nombre.** Medido en la ventana: «El app» tiene DOS `adId` distintos (`120249633901550467` con 44 contactos y `120249792217700467` con 2) y «economia us latino» otros dos (`120249633901570467` con 17 y `120249792217690467` con 2). Son los mismos creativos relanzados en la campaña nueva del 12 de septiembre. Agrupar por `utmContent` fusiona anuncios de campañas distintas y hace desaparecer el arranque de la campaña nueva, que es precisamente lo que un media buyer necesita ver. El §18.5 ya lo dice sin ambigüedad: la relación es por `meta_ad_id`.

**2 · Pero el corte por ad set hoy sólo se puede hacer por NOMBRE, y hay que decirlo en pantalla.** El id de ad set existe en 39 de 233 contactos y es **un solo ad set**. El nombre existe en 222 de 233 — y viene en la clave `utmMedium`, cuyo nombre dice «medio» y cuyo contenido es «Advantage+ ON / America Hispano / 25-65». Quien lea el código sin esta nota va a creer que `utmMedium` es un canal. La equivalencia real de las claves de GHL, medida sobre valores reales, es: `utmMedium` = nombre del ad set, `utmContent` = nombre del anuncio, `utmTerm`/`utmKeyword` = id del ad set, `campaignId` = `meta_campaign_id`, `adId` = `meta_ad_id`, `mediumId` = id del formulario o del calendario por el que entró (NO es la cuenta publicitaria: el mismo `campaignId` `120249633901590467` aparece con dos `mediumId` distintos, `1565833687804655` con 107 contactos y `1564725741812379` con 64).

**3 · Normalizar la caja antes de agrupar por nombre, y mostrar una variante tal cual vino.** En la ventana hay 4 `campaignId` distintos y 5 nombres de campaña distintos en minúsculas: hay más nombres que ids. Es la misma regla que `lib/negocio/atribucionDelLead.ts:124-127` ya aplica, con su motivo escrito: agrupar por `lower(...)` y mostrar con `min(...)`, porque una etiqueta en minúsculas forzadas se lee como un error de la pantalla y no como el nombre que alguien puso.

**4 · Descartar las etiquetas sin renderizar.** Dos contactos de la ventana traen literalmente `{{campaign.id}}`, `{{campaign.name}}`, `{{adset.name}}` y `{{ad.name}}`: son los parámetros dinámicos de Meta que no se sustituyeron. Sin un filtro `not like '{{%'`, la pantalla va a mostrar una campaña llamada `{{campaign.name}}` con 2 contactos. Es basura conocida y medible, no un caso raro.

**5 · Ventana de 14 días y piso de 10, los mismos que el resto del sistema.** `DIAS_DE_LA_TASA = 14` (`lib/negocio/indicadoresDeCitas.ts:282`, con su motivo: la ventana trasera del barrido son 14 días, más allá la proporción de citas congeladas ensucia la tasa) y `PISO_DE_UNA_TASA = 10` (línea 272). Aplicados a Acquisition, el efecto es severo y hay que aceptarlo: de los 7 anuncios de la ventana, **sólo 3 llegan al piso** (109, 44 y 17 contactos). Los otros cuatro tienen 1 o 2 contactos cada uno. Una tabla de anuncios con tasa va a tener tres filas y una fila «Otras», no siete.

**6 · La cohorte se arma con `alta_en_el_crm`, no con `creado_el`.** Son 233 contactos contra 256: 23 de diferencia que son latencia de ingesta. La migración 048 § 1 lo fija y agrega la advertencia que esta pantalla tiene que obedecer: ninguna cohorte armada con `alta_en_el_crm` tiene historia antes del despliegue, y toda pantalla que la use **tiene que decir desde cuándo mide**.

**7 · La fila «sin anuncio» se cuenta pero no compite.** Es la regla más importante de este departamento y está medida: los 57 contactos sin `adId` agendan 47 veces, **82,5 %**, la tasa más alta de toda la tabla — muy por encima del 44 % del anuncio de mayor volumen. Dibujada como una barra al lado de las demás, esa fila dice que el mejor anuncio es ninguno. Lo que pasa en realidad es que son en su mayoría los 41 contactos de la campaña BOFU de retargeting, gente que ya conocía la oferta y entró directo al calendario. El criterio ya existe y está escrito en `lib/negocio/atribucionDelLead.ts:179-183`: el conteo va, para que las filas sumen la cohorte; la tasa no va, porque junta categorías distintas.

**8 · Primer toque y último toque no se mezclan, y para Acquisition manda el primero.** `atribucion_primera` tiene `adId` en 176 de 233; `atribucion_ultima` en 59. Si alguien arma el reparto por anuncio con el último toque, pierde dos tercios de la atribución sin que nada falle. Dato tranquilizador para el §18.14: el primer toque **no se sobrescribe** — sólo 1 contacto de 233 cambió de anuncio entre un toque y otro.

**9 · El vocabulario de `sessionSource` es ajeno y cerrado a medir, no a suponer.** Los valores reales en la base son cuatro: `Paid Social` (360 histórico / 219 en ventana), `Social media` (158 / 6), `Direct traffic` (24 / 8) y `CRM UI` (2 / 0). Ninguna lista cerrada en código: la regla del proyecto para vocabularios de GoHighLevel (migración 048, § 3) es que un valor nuevo no puede abortar el ciclo.

**10 · Lo que Acquisition no calcula, aunque pudiera.** El §18.6 y el §18.8 se lo prohíben: revenue, CAC real, ROAS real. Hoy además no podría — cero ventas registradas. Y el §18.10 le prohíbe recomendar en solitario duplicar presupuesto, reducir inversión, apagar anuncios, mover presupuesto o declarar un ganador. El «Plan de acción» actual (`acquisition-plan.js:17-18`) viola esta regla dos veces; si se reconstruye, ese grupo de recomendaciones tiene que cambiar de lugar, no de redacción.

**11 · Los dos ceros, en este departamento, son tres casos distintos y hay que distinguirlos en pantalla.** (a) `public.closer_meta_metricas` con 0 filas = nunca se conectó Meta. (b) «Porcentaje de Video Visto» con 0 de 233 = el campo existe en el catálogo del CRM y nadie lo llenó en la ventana. (c) `negocio.resultados` sin ninguna fila `venta` = la métrica de ventas por anuncio no tiene denominador. Los tres se verían como «0» y significan cosas incompatibles.

---

## 7 · Riesgos

**Publicar cualquier cifra de dinero.** Es el riesgo número uno y el más fácil de cometer, porque cuatro de los cinco KPIs actuales son de dinero (Inversión, y los costos por contacto, por clic y por calificado). No hay spend en ninguna tabla de esta base. Si alguien reconstruye la pantalla leyendo contactos reales y deja el costo calculándose de `CAMPS[i].invD`, el resultado va a ser una pantalla con conteos verdaderos y costos inventados — que es peor que la de hoy, porque hoy nadie puede confundirse y entonces sí.

**Agrupar anuncios por nombre.** Fusiona `120249633901550467` con `120249792217700467` («El app») y `120249633901570467` con `120249792217690467` («economia us latino»), y con eso borra el arranque de la campaña nueva del 12 de septiembre justo cuando un media buyer necesita mirarlo.

**Dejar que la fila «sin anuncio» compita.** 57 contactos con 82,5 % de agendamiento contra el 44 % del anuncio de mayor volumen. Es una conclusión de negocio cara —«la pauta convierte peor»— construida sobre el hecho técnico de que el widget de calendario no pasa el `adId`. `lib/negocio/atribucionDelLead.ts` ya pagó exactamente este error con «Direct traffic 7 de 8» y lo dejó documentado en su cabecera.

**Dibujar tasas sobre uno o dos contactos.** Cuatro de los siete anuncios de la ventana tienen 1 o 2 contactos. Un «100 %» al lado de un «44 %» invita a una comparación que no existe.

**Renderizar crudos `url`, `referrer` o «Last Landing URL».** Seis de los 99 valores de «Last Landing URL» son `calls.ariaia.com/r/2/eyJ…`, un JWT cuyo payload contiene `contact_id` y `link_id`; otros traen `fbclid` completo. La migración 048 ya dejó la regla escrita en sus líneas 94-99: guardarlos está bien, mostrarlos no, y el guion que los midió imprime la forma y nunca el valor. Una tabla «landings más usadas» que pegue la URL entera la rompe.

**Afirmar el 91 % del §18.17.** Es un ejemplo del documento, no una medición. El real es 75,5 % sobre la cohorte y 80,4 % sobre los contactos de pauta. Copiar la plantilla con su número puesto sería exactamente la clase de éxito reportado que no ocurrió.

**Reportar «no hay diferencia entre leads de Meta y leads en la base».** El §18.13 y el §18.14 piden esa comparación y hoy es imposible: no tenemos el lado de Meta. Un cero ahí no es «coinciden»: es que sólo se contó un lado. Sería el peor de los dos ceros posibles, porque se leería como una confirmación de que la atribución está sana.

**Publicar el `meta_adset_id` como si existiera.** Está en 39 de 233 contactos y corresponde a **un solo ad set**. Una tabla por ad set basada en el id mostraría un ad set y ocultaría el resto; la que hay que hacer es por nombre (222 de 233), diciendo que el nombre es lo que hay.

**Construir el reparto por anuncio con `atribucion_ultima`.** Bajaría la cobertura de 176 a 59 de 233 sin que nada falle, y con ella los conteos de todos los anuncios — una pantalla que dice que se vendieron un tercio de los leads que se vendieron.

**Dejar las fechas por defecto de 2026-07-01.** Son anteriores al primer contacto de la base (2026-08-24). El día que la pantalla lea datos reales, abrirá en cero.

**Y una que no es de cifras: cinco pantallas afirman hoy cosas sobre Acquisition que Acquisition no mide.** Executive dice que el departamento está en `warn` con «312 contactos · +9 %» (`executive.js:178-181`), el panel ejecutivo reporta un conflicto con un contacto «a $19» (`executive-panel.js:12-15`), Conversion le manda un hallazgo de 48 contactos perdidos (`conversion.js:64`) y Leads Portal le adjudica una decisión (`period-controls.js:56`). Arreglar la pantalla de Acquisition y dejar esas cuatro como están produce un sistema que se contradice consigo mismo en la cara del usuario — y las cuatro afirmaciones inventadas van a parecer las reales, porque están en la pantalla del jefe.
