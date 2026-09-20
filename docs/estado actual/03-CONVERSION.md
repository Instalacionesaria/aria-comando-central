# Conversion Intelligence
> Corte: **2026-09-15**. Cada afirmación lleva su archivo:línea o la consulta que la produjo.
> Lo que no se pudo verificar está dicho como pendiente, no omitido.
> Para ubicar cualquier cosa nombrada acá, ver `08-COMO-USAR-EL-GRAFO.md`.

**Prototipo completo — pantalla entera con datos inventados.**

Pantalla completa y enteramente inventada (648 líneas de JavaScript, ~20 juegos de datos escritos a mano, cero operaciones de servidor), y su materia prima —el recorrido por la landing— SÍ existió y estaba casi completa hasta el 2026-08-31, día en que la empresa cambió de ruta de adquisición y el tráfico dejó de pasar por la landing: en la ventana de 14 días sólo 48 de 233 contactos muestran rastro de `accelerator.ariaia.com` y 0 tienen el campo del formulario.

> **`lib/aios/conversion.js` YA NO EXISTE.** Se borró el 2026-09-20, y con él las 655 líneas con
> 530 literales inventados y 47 frases de guion que esta carpeta documenta. Las citas
> `conversion.js:N` de abajo **siguen siendo correctas como referencia histórica** —el archivo y sus
> líneas están en el historial de git— y ésa es toda su función: este documento nunca describió lo
> que hay, describió lo que la maqueta dibujaba, para sacar de ahí los requisitos.
>
> **Y `components/views/ConversionView.jsx` se reescribió el mismo día**: pasó de 115 líneas a 79, así
> que sus citas son de DOS clases y la segunda es la peligrosa. Las que apuntan más allá de la línea
> 79 fallan al resolverse, y se ven. Las que apuntan más acá **siguen resolviendo y muestran otra
> cosa**, que es peor: una línea corrida no falla.
>
> Lo que hay hoy es `components/conversion/PanelDeConversion.jsx` con dos bloques medidos: el reparto
> de la cohorte por camino de entrada (`lib/negocio/recorridoDelLead.ts`) y el abandono del
> formulario de la landing (`embudoDelFormulario.ts`), más los cinco huecos declarados. La
> clasificación vive en `lib/negocio/recorrido.ts` y la ruta en `app/api/conversion/route.ts`.


---

## 1 · Qué pide el documento

El documento le dedica a Conversion Intelligence menos texto que a cualquier otro departamento con pantalla propia, y eso ya es un dato.

**§3 (líneas 128-160)** lo lista en la Capa de Inteligencia, entre los seis departamentos, y la Capa de Datos que lo alimenta nombra explícitamente «Leads, anuncios, sesiones, VSL, formularios, conversaciones, citas, ventas y revenue reportado». Las tres entidades del medio —sesiones, VSL, formularios— son suyas.

**§4 (líneas 163-196)** le da dos hijos y nada más: `Landing Intelligence` y `VSL Intelligence`. No hay §4.x que los desarrolle. Compárese con Conversation Intelligence, que en el mismo organigrama recibe `Lead Flow` y `Appointment Flow` y después once secciones (§8 a §16, más de 600 líneas) especificándolos. Conversion recibe dos nombres en un diagrama ASCII.

**§5.1 (líneas 203-221)** enumera las diecisiete entidades principales. Cuatro son materia prima directa de este departamento: `Landing Session`, `VSL Session`, `Form Submission` y `Creative Profile`. Ninguna de las cuatro existe en la base (lo verifiqué: no hay ninguna tabla de sesiones ni de eventos web en ningún esquema).

**§5.2 (líneas 223-238)** define la cadena de trazabilidad: `meta_ad_id → visitor_id → session_id → lead_id → ghl_contact_id → appointment_id → sales_call_id → sale_report_id`. Los dos eslabones que faltan del lado izquierdo —`visitor_id` y `session_id`— son exactamente los que Conversion necesita para tener un DENOMINADOR. Y cierra con la frase que define el problema entero del departamento: *«La atribución debe existir en los datos antes de que los agentes puedan interpretarla de forma confiable.»*

**§5.3 (líneas 240-265)** describe el perfil resumido del lead y pide dos campos que son de este departamento: «Porcentaje máximo visto del VSL, **cuando exista tracking individual verificable**» y «Porcentaje máximo visto del video precall, **cuando exista tracking individual verificable**». Las dos salvedades están en el documento original, no las agrego yo. Y cierra con una regla que el diseño actual viola: *«Los eventos de reproducción no deben guardarse únicamente como un valor fijo en el contacto. Debe conservarse su historial y exponer un resumen en el perfil.»* Hoy se guardan exactamente así: un valor fijo, sin historial.

**§9.5 (líneas 529-549)** es la especificación funcional más concreta que tiene el departamento, aunque esté escrita dentro de Conversation. Pide un trigger link que distinga seis estados: *Enlace enviado · Enlace abierto · Landing visitada · Formulario iniciado · Formulario completado · Cita agendada*. Y da los cuatro diagnósticos que habilita: «nunca abrió el enlace», «abrió pero no avanzó», «visitó la landing pero no completó el formulario», «completó el formulario pero no terminó de agendar». Esos seis estados son, literalmente, los cinco pasos que el prototipo dibuja.

**§10.6 (líneas 736-748)** define las tres ramas del consumo del video precall: no lo vio / lo vio parcialmente / lo completó. Está construido de verdad, pero para Appointment Flow (ver abajo).

**§17 (líneas 1106-1120)** lo declara sin especificar, en la primera línea de la lista: *«Las siguientes áreas tienen visión general, pero todavía requieren especificación detallada: Sales Intelligence. **Conversion Intelligence.** Creative Intelligence...»*. No hay KPIs, no hay responsabilidades, no hay vocabulario, no hay usuarios responsables. Todo eso que Acquisition sí tiene (§18.7 KPIs, §18.8 responsabilidades, §18.15 usuarios) acá está vacío.

**§18.16 (líneas 1546-1552)** es la única lista de entregables que alguien le promete: lo que Acquisition Intelligence le pasa a Conversion Intelligence son cinco cosas — «Campaña y anuncio de origen · Calidad del tráfico · CTR · **Landing page views** · Diferencias por audiencia y placement». Medido: la tabla heredada `public.closer_meta_metricas` tiene las columnas de Meta (gasto, impresiones, clics, ctr, cpc, cpm, leads, cpl, video_25/50/75/100) pero **0 filas**, y no tiene ninguna columna de landing page views. De las cinco promesas, ninguna llega hoy.

**§18.11 Caso 3 (líneas 1419-1431)** —«Buen CTR, mala landing»— es el ejemplo de colaboración donde Conversion es protagonista: el anuncio funciona y la página no. Ese diagnóstico exige comparar visitas contra conversiones por anuncio, que es precisamente el cruce que hoy no se puede hacer.

---

## 2 · Qué hay hoy en pantalla

La pantalla se registra en `lib/autorizacion/secciones.ts:255-261` con `capacidadRequerida: 'tablero.ver'` y, sobre todo, `sinOperacionesTodavia: true`. Esa bandera no es decorativa: el encabezado del archivo (`lib/autorizacion/secciones.ts:45-61`) explica que hay una prueba (`ADR-0304`) que pone la suite en rojo si una sección sin la bandera no declara un manejador. O sea que la afirmación «Conversion no tiene ni una sola operación de servidor» está **verificada por el arnés de pruebas**, no por mi lectura. Y se confirma por ausencia: en `app/api/` hay diecisiete carpetas (admin, auditoria, auth, avisos, closer, contactos, control, cron, enlaces-rapidos, fundaciones, mensajes, monitoreo, salud, setter, sonda, tools, usuarios) y ninguna es de conversion.

El marcado vive en `components/views/ConversionView.jsx` (115 líneas) y es sólo un esqueleto: cinco contenedores vacíos —`#cvStats`, `#cvJourney`, `#cvAlarm`, `#cvInfo`, `#cvWorst`— que un módulo imperativo rellena con `innerHTML`. El encabezado declara dos proveedores en pantalla, `Clarity` y `VTurb` (`ConversionView.jsx:22-31`), con su puntito de «fuente conectada» al lado.

Todo el contenido lo pinta `lib/aios/conversion.js`, 648 líneas, portado del HTML original (`aios-command-center_1.html`, líneas 3938-4582 según su propio encabezado en la línea 1). Lo que dibuja:

1. **Tira de tres paneles de KPIs** (`conversion.js:160-216`): Visitas · Dan play al VSL / Empiezan el form · Agendan / Citas · Calificadas · No calificadas.
2. **El «Recorrido» de cinco pasos** (`conversion.js:240-296`): Landing → VSL → Formulario → Agenda → Gracias, cada uno con su porcentaje sobre visitas, su delta contra el periodo anterior, una **banda esperada** dibujada como termómetro, dos métricas clave y un contador de observaciones.
3. **Barra «Requiere acción ahora»** (`conversion.js:317-329`), que sólo aparece si hay una fricción de severidad `critica`. Hoy hay exactamente una, y es inventada.
4. **Un cajón de detalle por paso** (`conversion.js:395-555`) con, según el paso: un mapa de calor de clicks por zona de la página, una barra de alcance de scroll, una lista de grabaciones de sesión, una curva de retención del VSL dibujada como SVG con coordenadas fijas (`conversion.js:436-450`), un mapa de calor de abandono por tramos de 10 %, el abandono campo por campo del formulario, y un bloque «Lectura:» con un veredicto redactado.
5. **Un modal «Plan de acción»** (`conversion.js:576-623`) que ordena las fricciones por pérdida, proyecta cuántas citas se recuperarían, y cierra con dos párrafos de «El patrón detrás».
6. **Filtros** de periodo (Hoy / 7 días / 30 días / personalizado) y de dispositivo (Todos / Móvil / Escritorio), ambos operativos — pero operan sobre constantes multiplicándolas por factores escritos a mano.

**Dos defectos mecánicos del prototipo, medidos, que se ven aunque uno acepte los datos inventados:**

· `conversion.js:139` arranca con `let cvPeriod = 'hist'`, mientras que `ConversionView.jsx:45` marca el botón `7d` con `className="on"`. Al abrir la pantalla, la pastilla dice «7 días» y los números son los del histórico: `866 × FACTOR.hist(3.4) = 2944` visitas. Además `hasPrev()` (`conversion.js:144`) devuelve falso para `hist`, así que el rótulo `#cvInfo` dice «sin comparación» al lado de un botón de 7 días que sí debería tenerla. El chip y la cifra se contradicen desde el primer pintado.

· `conversion.js:165`: `const calP = Math.round(p.agenda*califica*0.94)`. El `0.94` no sale de ningún lado y no tiene comentario. Su único efecto es que el delta de «Calificadas» salga verde siempre. El valor de ahora se calcula con `0.63` y el de antes con `0.63 × 0.94`: la mejora está cableada.

· Cuatro constantes están declaradas y nunca se usan: `MINOR` (`:80-84`), `SCROLL` (`:129-132`, duplicado de la columna de scroll de `ZONES`), `TINT` (`:299`) y `SEVLBL` (`:300`). Verificado con `grep -c`: una sola aparición cada una, la de su propia declaración.

En contraste, lo que sí es real en este repositorio: de los 43 archivos de `lib/negocio/`, **33 leen de `negocio.*`** (agenda, citas, comisiones, atribución, consumo del precall...); los otros diez son vocabulario o cálculo puro. Conversion no aporta ninguno de los 33.

---

## 3 · Lo que está hardcodeado

**11 juego(s) de datos inventados.**

### 3.1 · CV — el funnel entero: 3 dispositivos × 6 métricas = 18 números. `all: {sesiones:866, vsl:604, form:308, agenda:225, calificados:141, gracias:198}` más las filas `mobile` y `desktop`. Su propio comentario lo confiesa: «datos por dispositivo y periodo — reemplazar por la consulta real».

- **Dónde:** `lib/aios/conversion.js:8-12`
- **Finge ser:** El recorrido medido: visitas a la landing, plays del VSL, formularios iniciados, citas agendadas, citas calificadas y visitas a la página de gracias, segmentado por dispositivo. Es el dato del que cuelga TODA la pantalla: los tres paneles de KPI, los cinco pasos, las bandas y el plan de acción.
- **¿Se puede reemplazar hoy?** NO en su mayor parte, PARCIALMENTE en dos filas. **Visitas (866) y plays del VSL (604): no.** No existe ninguna tabla de sesiones web ni de eventos de reproducción en ninguno de los doce esquemas de la base (busqué `table_name ~* 'session|sesion|evento|event|page|pagina|landing|vsl|video|visit|clarity|vturb|form|scroll|click'` sobre `information_schema.tables` en todos los esquemas: devuelve `auth.sessions`, `identidad.sesiones`, `public.closer_sesiones`, `public.closer_contacto_eventos` y `public.closer_evento_tipos` — las tres últimas son de la plataforma anterior y sus tipos de evento son de CRM, no de web: `seguimiento_creado`, `mensaje_entrante`, `cita_agendada`, `tag_aplicado`...). Un visitante que no se convierte en contacto no deja fila en ninguna parte: no hay denominador. **Formulario (308): sí lo hubo y ya no.** El campo `Form Landing VSL` del CRM tiene ese vocabulario exacto —`Form incompleto sin agendar` 87, `Form completo sin agendar` 39, `Agendado` 121— sobre 247 contactos, pero su último día es el 2026-08-31 y en la ventana de 14 días son **0 de 233**. **Agenda (225): sí, de verdad.** `negocio.citas` tiene 162 citas ya ocurridas en la ventana y 146 reservadas en la ventana. **Calificadas (141) y Gracias (198): no**, no hay origen para ninguna de las dos.

### 3.2 · BANDS — 24 números (3 dispositivos × 4 pasos × 2 extremos) que definen la «banda esperada» de cada paso, dibujada como termómetro verde/naranja en cada tarjeta del recorrido.

- **Dónde:** `lib/aios/conversion.js:21-25`
- **Finge ser:** Un percentil calculado. El comentario de la línea 19-20 afirma con precisión metodológica: «Se calcula con la mediana de los últimos 90 días: p25 a p75 del propio histórico. Se guarda por dispositivo porque el comportamiento es muy distinto». Nada de eso ocurre: son literales. Es el caso más grave del archivo, porque la falsedad no está en el número sino en la PROCEDENCIA que el comentario le atribuye — quien lea el código para auditar la cifra encuentra una metodología descrita y ninguna metodología ejecutada.
- **¿Se puede reemplazar hoy?** NO. Un p25–p75 de 90 días exige una serie diaria de 90 puntos por paso y por dispositivo. El paso que más historia tiene —`Form Landing VSL`— cubre del 2025-12-20 al 2026-08-31 pero con cobertura útil sólo desde el 2026-08-11 (medido: hasta el 2026-08-10 el campo aparece en pocos contactos sueltos; del 11 al 30 de agosto cubre casi el 100 % de las altas diarias: 14/14 el 20-08, 11/12 el 21-08, 7/7 el 22-08, 8/9 el 24-08). Son 20 días, no 90, y se cortan hace dos semanas.

### 3.3 · FRICTIONS — once incidencias completas, cada una con título, diagnóstico redactado, pérdida en contactos, dispositivo afectado, destinatario, antigüedad y estado. Una de severidad `critica`, tres `alta`, siete `media`.

- **Dónde:** `lib/aios/conversion.js:43-77`
- **Finge ser:** Los hallazgos del departamento. Es lo que la pantalla ofrece como producto: no números, sino diagnósticos. Ejemplos textuales: «El formulario devuelve error en Safari móvil — Desde ayer 14:20, el 31% de los envíos falla en la validación del teléfono», «Abandono del VSL entre 00:18 y 00:27 — La retención cae de 82% a 56% en nueve segundos», «La página tarda 4.1s en cargar en móvil — El video pesa 2.4 MB». Las antigüedades («detectado hace 3 h», «detectada ayer», «hace 6 días») son fijas y no se mueven con el reloj: la incidencia crítica lleva tres horas detectada desde agosto.
- **¿Se puede reemplazar hoy?** NO, ninguna de las once. Ocho necesitan telemetría de página (rage clicks, dead clicks, alcance de scroll, tiempo de carga, errores de validación, reintentos de envío), que es Clarity y Clarity no está integrado — verificado: las cadenas `Clarity` y `VTurb` aparecen 13 veces en `lib/aios/conversion.js`, una vez en `lib/aios/leads-portal.js:249` y dos en `components/views/ConversionView.jsx:25,29`, y en **ningún** archivo más del repositorio; no hay variable de entorno para ninguno de los dos (`.env.example` declara doce nombres: `DATABASE_URL_ADMIN`, `DATABASE_URL_MIGRADOR`, `DATABASE_URL_INQUILINO`, `DATABASE_URL_IDENTIDAD`, `DOMINIO_ESPERADO`, `CABECERA_DIRECCION_REAL`, `CLAVE_MAESTRA`, `AVISO_URL`, `AVISO_DESTINO`, `SONDA_TOKEN`, `CRON_SECRET`, `SCRAPER_BACKEND_URL`, `N8N_HIGHLEVEL_WEBHOOK` — el único proveedor externo es GoHighLevel). Dos necesitan retención del VSL segundo a segundo, que tampoco existe. La única que rozaría un dato real es «Casi la mitad no ve el video de bienvenida», y el campo que la respondería es `Video Pre-Call`, que pertenece a otro departamento y a otro momento del recorrido.

### 3.4 · «Kevin · técnico» como destinatario de tres incidencias inventadas. Censo de destinatarios en el archivo: Creative 5, Sales 4, Kevin · técnico 3, Conversation 2, Acquisition 1.

- **Dónde:** `lib/aios/conversion.js:46, :67, :73 (el literal `to:'Kevin · técnico'`)`
- **Finge ser:** Una asignación de responsable. Y **Kevin es una persona real de la empresa**: `identidad.usuarios` tiene `Kevin Inofuente` y `Kevin Inofuente Colque` entre sus once filas (Alonso Gutierrez, Cris Prueba, Gabriel, Jorge Quiroz, Jorge Veramendi, Kevin Inofuente, Kevin Inofuente Colque, Miguel Colon, Moises Ruiz, Pamela Chunga, Walter Peñaherrera). La pantalla le atribuye por nombre tres fallas técnicas que nunca ocurrieron —un formulario roto en Safari, una página de 4,1 s, un botón sin señal de carga— con antigüedades («detectado hace 3 h») que sugieren que está tardando en resolverlas. Es exactamente lo que `lib/aios/index.js:19-24` dice que hizo sacar del prototipo a las pantallas Closer y Setter: «esos dos módulos existían para pintar datos escritos a mano —nombres de personas, montos, un diagnóstico atribuido a la IA— y estuvieron en producción mostrándolos».
- **¿Se puede reemplazar hoy?** No aplica: no es un dato a reemplazar, es contenido que debería salir de pantalla ya. Y las cuatro grabaciones de sesión (`conversion.js:107-112`) tienen el mismo problema en menor grado: inventan ciudades y dispositivos de personas —«Móvil · iPhone · Lima», «Móvil · Android · Bogotá», «Escritorio · Chrome · CDMX», «Móvil · iPhone · Santiago»— con un botón «Ver ▸» que promete un video de sesión que no existe.

### 3.5 · ZONES — seis zonas de la landing con alcance de scroll, intensidad de click, y sus dos valores del periodo anterior: 30 números. Alimentan el mapa de calor y la barra lateral de scroll.

- **Dónde:** `lib/aios/conversion.js:116-123`
- **Finge ser:** La salida de Microsoft Clarity: mapa de calor de clicks y de alcance de scroll sobre la página real, con comparación contra el periodo anterior. El veredicto que se dibuja debajo («el precio recibe el 71% de los clicks y no es interactivo», `conversion.js:411`) está derivado de estos literales.
- **¿Se puede reemplazar hoy?** NO. Requiere Clarity o equivalente instalado en la landing. Ver arriba: no hay integración ni credencial. Y hay un problema anterior al proveedor: habría que decidir sobre QUÉ página, porque en la ventana los contactos con URL registrada se reparten entre siete hosts distintos (`calls.ariaia.com` 69, `api.leadconnectorhq.com` 31, `accelerator.ariaia.com` 28, `www.fbsbx.com` 23, `precall.ariaia.com` 18, `trabaja-con-nosotros.ariaia.com` 3, `grow.ariaia.com` 1).

### 3.6 · VHEAT (10 números: retención del VSL por tramos de 10 %), la curva SVG con coordenadas fijas del path, las dos filas de caída («0:18 · 82%→74% · −8 pts» y «0:27 · 74%→56% · −18 pts»), y la duración «3:40».

- **Dónde:** `lib/aios/conversion.js:125 (VHEAT), :436-450 (el SVG), :453-456 (las caídas), :429 (la duración)`
- **Finge ser:** La curva de retención de VTurb: el producto central de VSL Intelligence, la mitad del organigrama del departamento. El SVG no se calcula a partir de `VHEAT`: es un `path` con las coordenadas escritas a mano (`M26,18 L70,34 L110,40 L150,66 L210,74 L280,82 L350,88 L410,92 L440,94`) y dos círculos rojos en posiciones fijas. O sea que la gráfica y el mapa de calor que están uno debajo del otro son dos invenciones independientes que casualmente cuentan la misma historia.
- **¿Se puede reemplazar hoy?** NO. Y acá está el hallazgo que más importa para VSL Intelligence, porque contradice el reflejo de decir «este dato no existe»: **el CRM SÍ tiene dos campos dedicados al VSL** — `VSL % máximo visto` (NUMERICAL, `qOTfHR3dfX6fqO4M0nvI`) y `VSL segundos vistos` (TEXT, `JZNURcXun6AHF74dsyBe`). Están poblados en **79 contactos**, todos con alta entre el 2026-08-11 y el 2026-08-30. Pero el censo de valores es una sola fila: `% máximo visto = '0'` y `segundos vistos = '0'` en **79 de 79**. Nunca se registró un valor distinto de cero, ni uno. No es «no hay dato»: hay dato y dice cero, veinte días seguidos, en los dos campos a la vez. Un medidor que reporta cero en el 100 % de los casos durante 20 días no distingue entre «nadie vio el video» y «el medidor no capturó nada», y por eso no sirve como señal de conversión — pero sí sirve como alarma: alguien instaló tracking de VSL el 11 de agosto, escribió ceros, y lo quitó el 30. En la ventana de 14 días: **0 de 233**.

### 3.7 · THANKS_VIDEO `{visto:54, retencion:63, duracion:'1:20'}` más una segunda curva de diez tramos `[100,92,86,79,71,66,63,60,58,57]` para el «video de bienvenida» de la página de gracias, y el veredicto «solo 54% le da play, pero quien lo termina asiste 12 puntos más».

- **Dónde:** `lib/aios/conversion.js:127, :545, :546`
- **Finge ser:** El consumo del video de bienvenida post-agendamiento y su relación con la asistencia.
- **¿Se puede reemplazar hoy?** PARCIALMENTE, y con una advertencia de límite jurisdiccional. El equivalente real es el campo `Video Pre-Call` (RADIO, `vnmG6lwG0mnh8JX0t4Pp`), que está en 213 de 584 contactos y en **81 de los 233** de la ventana de altas. Ya está construido, en `lib/negocio/consumoDelPrecall.ts`, y **pertenece a Appointment Flow (§10.6), no a Conversion**. Medido hoy sobre su propia población (citas ya ocurridas y no canceladas de los últimos 14 días, 52 contactos): `Sin abrir (0%)` 25, `Nada` 8, `-20%` 4, sin campo 3, `1–25%` 3, `76–100%` 3, `40-60%` 2, `Clic a link` 2, `Accede: sin reproducir` 1, `26–50%` 1. O sea 33 sin reproducción registrada, 9 con reproducción, 7 sin rama clasificable, 3 sin campo. Dos cosas lo hacen inservible para lo que la pantalla de Conversion dibuja: (a) el vocabulario tiene dos escalas incompatibles conviviendo —`1–25%` con guion largo U+2013 y `40-60%` con guion corto— así que no se puede promediar ni convertir a un «63 % de retención»; (b) el propio módulo documenta que `Nada` y `Sin abrir (0%)` son el ESTADO INICIAL que el CRM escribe al agendar, no una afirmación sobre el lead. Y el «asiste 12 puntos más» de la pantalla de Conversion es un cruce contra asistencia que, si se hiciera, sería una cifra de Appointment Flow publicada en otra pantalla: dos departamentos publicando la misma tasa con poblaciones distintas es exactamente el defecto que hay que evitar.

### 3.8 · FIELDS — cinco campos del formulario con cuántos llegaron y cuántos abandonaron en cada uno: `['Nombre',308,4], ['WhatsApp',296,11], ['Facturación mensual',285,83], ['Tipo de agencia',202,18], ['Objetivo a 90 días',184,12]`. Más el veredicto «facturación mensual concentra el 63% del abandono».

- **Dónde:** `lib/aios/conversion.js:134-137, :476`
- **Finge ser:** El abandono campo por campo del formulario de la landing — el análisis más accionable que ofrece la pantalla, y el que genera la recomendación «Cambiar facturación mensual por rangos seleccionables».
- **¿Se puede reemplazar hoy?** NO. El CRM guarda la RESPUESTA de un campo cuando la hay, no el momento del abandono: un formulario que se dejó a la mitad deja los campos posteriores vacíos, pero «vacío» no distingue «lo saltó» de «abandonó ahí» de «el campo no estaba en esa versión del formulario». Los nombres de la pantalla además ni siquiera coinciden con los reales: en `negocio.campos_del_crm` (170 definiciones) las preguntas de facturación se llaman «¿Cuál es tu meta de facturación mensual dentro de 6 meses?», «¿A cuanto quieres llevar tu facturacion mensual en 6 meses?» y «¿Cuál es tu objetivo de facturación?» — tres campos distintos en tres carpetas distintas, no uno. Lo único que sí existe es el corte grueso: `Form Landing VSL` separa `Form incompleto sin agendar` (87) de `Form completo sin agendar` (39), que responde «cuántos abandonaron el formulario» pero no «dónde».

### 3.9 · FACTOR y PREV — diez multiplicadores que convierten la constante `CV` en cifras por periodo: `FACTOR = {hoy:0.035, 7d:0.22, mes:1, tri:2.6, hist:3.4}` y `PREV = {hoy:0.031, 7d:0.19, mes:0.88, tri:2.35, hist:3.4}`.

- **Dónde:** `lib/aios/conversion.js:13, :15`
- **Finge ser:** Que el selector de periodo consulta datos de ese periodo. En realidad multiplica la misma fila por un número. El corolario incómodo: como `FACTOR` y `PREV` son constantes, **todos los deltas de la pantalla son fijos**. «▲ +16%» significa `0.22/0.19`, no una mejora. Y `PREV.hist = FACTOR.hist = 3.4`, así que en histórico la comparación sería cero — lo tapa `hasPrev()` (`conversion.js:144`), que oculta los deltas en `hist` y `hoy`.
- **¿Se puede reemplazar hoy?** Sí, en cuanto haya una consulta, y el vocabulario de periodos ya no hay que inventarlo: `lib/negocio/periodo.ts:83-96` declara los cuatro que ofrece Conversation —`hoy` 1 día, `7d` 7, `30d` 30 y `completo` 3650 (`periodo.ts:52`)— y lo que no está en esa lista **se rechaza**, no se corrige (`periodo.ts:188-193`: la ausencia cae en el valor por omisión, la clave desconocida devuelve `null` y quien llama lo convierte en un 400). Los cinco de `FACTOR` no son esos cuatro: `tri` y `hist` no existen en el sistema y `mes` se llama `30d`. Catorce días siguen existiendo pero como otra cosa, y conviene no confundirlas: `DIAS_DE_LA_TASA = 14` (`lib/negocio/indicadoresDeCitas.ts:310`) es el argumento **por omisión** de cinco módulos de `lib/negocio/` cuando nadie les pasa ventana —`tasaDeCancelacion` (`indicadoresDeCitas.ts:312`), `indicadoresDelLead` (`:156`), `atribucionDelLead` (`:75`), `consumoDelPrecall` (`:136`) y `citasParaCerrar` (`:60`)—, mientras que el periodo con el que Conversation ABRE su tablero son **30 días** (`periodo.ts:109`) — y es el que Conversion heredaría el día que se construya, porque es la lista que ya existe. El piso de publicación es `PISO_DE_UNA_TASA = 10` (`indicadoresDeCitas.ts:300`). Pero reemplazar los multiplicadores sin reemplazar `CV` no arregla nada: serían periodos reales sobre números falsos.

### 3.10 · Las métricas clave de cada paso (16 literales) y las cajas del cajón de detalle (15 literales más): «Scroll medio 52 / antes 54», «Rage clicks 84 / antes 61», «Dead clicks 37», «Rebote bajo 3s 48», «Visto promedio 41 / antes 38», «Hook 0-3s 82», «Llegan al CTA 31», «Tiempo medio 1:48», «Reintentos 12», «Errores validación 7», «Confirmadas 78», «La completan 88», «Agregan al calendario 71», «Vuelven a la landing 8», «Franja preferida 9-11h», «Motivo principal: Facturación baja», «Duración 3:40».

- **Dónde:** `lib/aios/conversion.js:219-233 (keyMetrics) y :395-555 (stepDetail)`
- **Finge ser:** Las dos cifras que resumen cada paso en la tarjeta del recorrido, y el detalle de seis cajas que se abre al hacer clic. Cada una trae su valor «anterior» también inventado, lo que produce una flecha verde o roja.
- **¿Se puede reemplazar hoy?** NO, salvo tres. «Confirmadas» tiene origen real: el campo `Confirmación Agendamiento` del CRM, con vocabulario binario `Si`/`No`, ya usado por `lib/negocio/indicadoresDeCitas.ts`. «Canceladas» sale de `negocio.citas.estado_ghl` y ya está construido (`tasaDeCancelacion`, misma ruta). «Franja preferida» sale de `negocio.citas.inicio_el` cruzado con `contactos.zona_horaria_del_lead`. Las otras catorce necesitan telemetría de página o de video.

### 3.11 · El modal «Plan de acción» entero: el factor de recuperación `0.45`, la proyección «+N citas recuperables», el salto de conversión «X% a Y%», y los dos párrafos de «El patrón detrás»: «Cuatro de las cinco fugas ocurren solo en móvil» y «La conversión en escritorio es 42% y en móvil 19%».

- **Dónde:** `lib/aios/conversion.js:579 (el 0.45), :580-592 (la proyección), :608-609 (el patrón)`
- **Finge ser:** Una recomendación priorizada con retorno estimado — el entregable que §2.3 del documento le pide a un Departamento de Inteligencia. El `0.45` afirma que arreglar una fricción recupera el 45 % de su pérdida; no tiene comentario ni origen. Lo más traicionero es que el «patrón» ES internamente consistente con los datos inventados: `CV.desktop` da 107/254 = 42,1 % y `CV.mobile` 118/612 = 19,3 %. Un lector que audite la aritmética la encuentra correcta, y eso hace que la conclusión se lea como análisis en vez de como decoración.
- **¿Se puede reemplazar hoy?** NO, y el contraste con la realidad medida es el argumento más fuerte para bajar la pantalla. La brecha móvil/escritorio sí se puede medir hoy, parcialmente, con `atribucion_ultima->>'userAgent'`: sobre las 162 citas ya ocurridas de la ventana, **107 móvil, 14 escritorio, 41 sin dato**. El prototipo construye toda su tesis estratégica —«igualar la mitad de esa brecha vale más que cualquier ajuste individual»— sobre un cohorte de escritorio de 254 sesiones y 107 citas que en la realidad de esta ventana son 14 citas. Una recomendación cuyo cohorte de control tiene 14 filas no es una recomendación.


---

## 4 · Datos que YA tenemos

Todo esto está medido el 2026-09-14 contra producción, y de acá sale el cohorte que el resto del documento llama «la ventana»: donde se lea «los 233 contactos de la ventana» o «las 162 citas de la ventana» son los de esta medición y de esta fecha, no los de hoy — el corte es móvil (`now() - interval '14 days'`) y se corre solo. La ventana de 14 días se resuelve de dos formas según la cifra, y las digo por separado porque dan poblaciones distintas: **por alta de contacto** (`alta_en_el_crm >= now() - interval '14 days'`) son **233 contactos** de 584 totales; **por cita ya ocurrida** (`inicio_el` entre `now()-14d` y `now()`) son **162 citas de 147 contactos**; por cita reservada en la ventana, **146 citas**.

**1. El paso «Agenda» es real y completo.** `negocio.citas` tiene 19 columnas incluyendo `inicio_el`, `reservada_el`, `estado_ghl`, `estado_anterior_ghl`, `estado_cambiado_el`, `reagendada_el`, `inicio_anterior_el` y `asistio`. De los 233 contactos de la ventana, **123 tienen al menos una cita**. Es el único de los cinco pasos del prototipo que tiene fuente propia, viva y auditable. Ya hay módulos construidos sobre ella: `lib/negocio/indicadoresDeCitas.ts`, `citas.ts`, `agenda.ts`, `citasParaCerrar.ts`.

**2. El formulario de la landing SÍ estuvo instrumentado, y su vocabulario es exactamente el que el prototipo inventa.** El campo `Form Landing VSL` (SINGLE_OPTIONS, `XqOfGEWle6fay7hPuvWp`) tiene tres valores y sólo tres: `Agendado` 121, `Form incompleto sin agendar` 87, `Form completo sin agendar` 39 — total 247 contactos. Eso es, palabra por palabra, la distinción del §9.5 entre «formulario iniciado», «formulario completado» y «cita agendada».

Y es un campo **confiable**, no una etiqueta suelta: lo crucé contra `negocio.citas`, que es una fuente independiente. De los 121 marcados `Agendado`, **118 tienen cita** (97,5 %). De los 87 marcados `Form incompleto sin agendar`, **1 tiene cita** (1,1 %). De los 39 marcados `Form completo sin agendar`, **0 tienen cita** (0 %). Un campo del CRM que coincide con la tabla de citas en esos tres niveles a la vez no es ruido.

**3. La URL de la landing llega, y trae adentro el `session_id` del §5.2 y el trigger link del §9.5.** El campo `Last Landing URL` (TEXT, `rU9mqLWhY3PlNaMWxIiw`) está en 173 contactos totales y **99 de los 233** de la ventana. Y `atribucion_ultima->>'url'` está en 468 de 584 contactos y en **173 de los 233** de la ventana. Las URLs no son simples: traen `contact_id`, `email`, **`sessionId`** y **`trigger_link`** como parámetros. Ejemplo real de la ventana: `https://precall.ariaia.com/form-pre-call-350857?contact_id=...&email=...&firstname&sessionId=3369979c-ed55-4709-8fb5-bf8dcb39f4e0&trigger_link=HHZTgdEIpTLDgd1eoroz`.

Hay al menos tres trigger links distintos en uso: `HHZTgdEIpTLDgd1eoroz` (formulario precall), `dD19qtffi42LJeeaF0pg` (landing accelerator) y `fl7H6L9HrIrvWQNXxqRF` (una página `vibepreview`).

**4. Corrección medida al enunciado de la tarea, y hay que hacerla antes de construir nada.** El brief dice que `atribucion_primera->>'sessionSource'` vale `Trigger Link` en 27 de 150 citas de la ventana. El 27 es correcto; **la columna no**. Censo de `atribucion_primera->>'sessionSource'` sobre los 584 contactos: `Paid Social` 360, `Social media` 158, nulo 40, `Direct traffic` 24, `CRM UI` 2. **`Trigger Link` no aparece ni una sola vez.** Donde sí aparece es en `atribucion_ultima->>'sessionSource'`: sobre los 584, `Direct traffic` 209, `Paid Social` 194, `Social media` 117, **`Trigger Link` 29**, nulo 27, `Referral` 8. Y sobre las 162 citas ya ocurridas de la ventana: `Direct traffic` 91, **`Trigger Link` 27**, `Paid Social` 24, nulo 11, `Social media` 6, `Referral` 3.

La diferencia no es cosmética, es semántica y decide el diseño: `atribucion_primera` es el PRIMER toque (por dónde llegó el lead: el anuncio) y `atribucion_ultima` el ÚLTIMO (por dónde volvió: el enlace que le mandó el agente). Que el trigger link viva en el último toque es lo correcto y confirma la tesis del §9.5 — GoHighLevel ya está usando trigger links y nosotros ya recibimos el resultado. Un módulo que leyera `atribucion_primera` buscando `Trigger Link` mediría cero para siempre y lo reportaría como «no se usan trigger links».

**5. El dispositivo es real y se puede medir hoy.** `atribucion_primera` tiene 20 claves; las relevantes acá: `userAgent` 325, `ip` 325, `url` 325, `referrer` 65. `atribucion_ultima` tiene 19; `userAgent` 339, `url` 468, `referrer` 56. Clasificando por `userAgent` sobre las 162 citas de la ventana: **107 móvil, 14 escritorio, 41 sin dato**. Los dos ceros están separados: 41 es «no hay dato», no «cero escritorio».

**6. La atribución publicitaria ya está construida y probada.** `lib/negocio/atribucionDelLead.ts` lee `atribucion_primera` y su encabezado declara medido el mismo día: «`atribucion_primera` poblada en 544 de 584 contactos, y dentro de la ventana de catorce días **236 de 236 traen `sessionSource`**». Lo que el §18.16 promete entregarle a Conversion desde Acquisition —campaña y anuncio de origen— ya tiene tubería. Coberturas en la ventana de altas: `Last UTM Source` 178/233, `Last UTM Medium (Adset)` 174/233, `Last UTM Content (Anuncio)` 85/233, `Last FB ClickId` 39/233.

**7. El precall está construido.** `lib/negocio/consumoDelPrecall.ts`, campo `Video Pre-Call`, 213 de 584 totales y 81 de 233 en la ventana de altas. Con la salvedad del §10.6: es de Appointment Flow.

**8. El catálogo de campos se resuelve por nombre, que es la forma correcta.** `lib/negocio/camposDelCrm.ts` expone `campoPorNombre()`, que consulta `negocio.campos_del_crm` (170 definiciones) por el nombre exacto y devuelve `null` —no cero— si alguien renombra el campo en el CRM. Todo lo que construya Conversion debe entrar por ahí y nunca por un identificador opaco escrito a mano.

---

## 5 · Datos que faltan, y de dónde tendrían que venir

**A. El denominador. Es lo único que no se puede conseguir sin tocar la landing.**

No existe ninguna tabla de sesiones ni de eventos web. Lo verifiqué contra `information_schema.tables` sobre los doce esquemas de la base (`public` 63 tablas, `auth` 23, `negocio` 21, `identidad` 12, `storage` 8, `realtime` 3, `migraciones` 2, `extensions` 2, `vault` 2, `supabase_functions` 2, `net` 2, `supabase_migrations` 1) filtrando por todos los nombres plausibles: no hay nada. Las tres candidatas de nombre —`public.closer_sesiones`, `public.closer_contacto_eventos`, `public.closer_evento_tipos`— son de la plataforma anterior y son de CRM, no de web; el catálogo de tipos de evento lo confirma: `seguimiento_creado`, `seguimiento_cancelado`, `avanzar_registrado`, `nota_agregada`, `mensaje_entrante`, `mensaje_saliente`, `cita_agendada`, `cita_cancelada`, `serie_toque_enviado`, `serie_agotada`, `contacto_respondio`, `entro_zona_closer`, `tarea_completada`, `tarea_reabierta`, `tag_aplicado`.

Consecuencia dura: **un visitante que no se convierte en contacto no deja rastro en ninguna parte.** Todo lo que sabemos de la landing lo sabemos a través de gente que YA llegó al CRM. Eso invierte el funnel: el prototipo dibuja 866 visitas de las que 225 agendan; lo que la base permite es contar 233 contactos y mirar hacia atrás. Los pasos 01 (Landing) y 02 (VSL) del recorrido del prototipo **no tienen origen posible con la instrumentación actual**, y tampoco lo tiene el paso 05 (Gracias). Tendrían que venir de la landing: un pixel propio que escriba `visitor_id` y `session_id`, o Clarity con su API.

**B. El proveedor de telemetría de página. No está, en ningún sentido de «no está».**

`Clarity` y `VTurb` figuran en pantalla como fuentes conectadas (`ConversionView.jsx:22-31`, con el `<span className="dotx" />` que es el indicador de fuente viva), pero sólo existen como cadenas de texto: 13 apariciones en `lib/aios/conversion.js`, 1 en `lib/aios/leads-portal.js:249`, 2 en `ConversionView.jsx` y 16 en `aios-command-center_1.html`, que es el maquetado original y está versionado. Cuatro archivos, todos de pintar pantalla. No hay cliente, no hay ruta, no hay tabla, no hay variable de entorno, no hay fila. La pantalla afirma dos integraciones que nunca existieron.

**C. Lo que Acquisition le debe según §18.16, y no llega.**

`public.closer_meta_metricas` existe con las columnas correctas (`gasto, impresiones, clics, alcance, ctr, cpc, cpm, leads, cpl, video_reproducciones, video_25, video_50, video_75, video_100`) y tiene **0 filas**; `min(fecha)` y `max(fecha)` son nulos. Y aunque tuviera filas, no tiene columna de *landing page views*, que es la tercera de las cinco promesas del §18.16. Lo que sí llega de Meta hoy llega por GoHighLevel, contacto por contacto (las UTM y `adId`), no como serie diaria de campaña.

**D. El historial, que el §5.3 exige explícitamente.**

`atribucion_primera` y `atribucion_ultima` son **una fila por contacto, sobrescribible**. No hay tabla de toques. Alguien que visita la landing tres veces, ve el VSL dos, abandona el formulario una y agenda a la cuarta deja un único objeto JSON: el último. El §5.3 lo prohíbe con todas las letras: «Los eventos de reproducción no deben guardarse únicamente como un valor fijo en el contacto. Debe conservarse su historial y exponer un resumen en el perfil.» Cualquier análisis de recorrido —que es el oficio entero de este departamento— necesita el historial, no el estado final.

**E. La especificación funcional. El §17 la declara pendiente y sigue pendiente.**

No hay lista de KPIs de Conversion (Acquisition tiene §18.7 con cinco grupos; Appointment Flow tiene §10.7 con dieciséis), no hay responsabilidades, no hay usuarios responsables, no hay vocabulario, no hay umbrales, no hay definición de qué separa Landing Intelligence de VSL Intelligence. Construir sin eso es elegir por el negocio: la pantalla actual ya eligió cinco pasos, cinco fuentes y cuatro severidades, y nadie los aprobó.

**F. Y el hecho que reordena todo lo anterior: el tráfico dejó de pasar por la landing el 2026-08-31.**

Esto no lo pedía el brief y es lo más importante que encontré. Medido día por día sobre `atribucion_primera->>'medium'`:

    fecha        total  ExternalForm  facebook  calendar
    2026-08-27      12            11         0         1
    2026-08-28      10             8         0         2
    2026-08-29       1             1         0         0
    2026-08-30       4             4         0         0
    2026-08-31      27             1        21         5
    2026-09-01      17             0        12         5
    2026-09-02      46             0        38         8
    ...
    2026-09-13       1             0         1         0

El corte es de un día para el otro y no hay transición. Entre el 2026-08-11 y el 2026-08-30, de 259 altas **238 entraron por `External Form`** —el formulario de la propia landing— y **235 de esas 238 tienen escrito `Form Landing VSL`** (98,7 % de cobertura). En los últimos 14 días, `External Form` es **1 de 233**, `facebook` es 178 y `calendar` 54.

Por eso los campos de landing y de VSL están vacíos en la ventana: **no se rompió el medidor, se fue el tráfico que medía.** Y el dato que lo cierra: de los 178 leads cuyo primer toque es `facebook`, sólo **3** muestran algún rastro de `accelerator.ariaia.com` en cualquiera de los tres lugares donde podría estar (`atribucion_primera.url`, `atribucion_ultima.url`, `Last Landing URL`), mientras **22** traen `www.fbsbx.com` — el navegador interno de Facebook, o sea formulario nativo de Meta, sin landing de por medio. De los 54 de `medium = calendar`, 44 sí tocan la landing, pero su URL queda registrada en el momento de AGENDAR, no de navegar.

Total de contactos de la ventana con cualquier rastro de la landing: **48 de 233**. Y de esos 48, 44 son `calendar`. Landing Intelligence hoy no tiene población.

---

## 6 · Reglas propias de este departamento

**1. Los dos ceros de este departamento, que son tres y hay que nombrarlos distinto.**

`VSL % máximo visto` obliga a una distinción más fina que la habitual. Hay tres estados y la pantalla tiene que decir cuál es: (a) **no hay campo** — en la ventana no lo tiene ninguno, como dice §3.6; (b) **el campo dice cero** — los 79 contactos que sí lo tienen, todos con alta entre el 2026-08-11 y el 2026-08-30, o sea fuera de la ventana, y son 79 de 79, sin una sola excepción; (c) **el medidor no reportó** — que es lo que 79 ceros consecutivos en dos campos a la vez sugieren, y que no se puede afirmar ni descartar desde la base. Publicar «0 % de visionado promedio del VSL» sería técnicamente cierto y completamente engañoso. La regla: mientras el censo de un campo numérico tenga un solo valor distinto, **ese campo no es una medición, es un indicador de que algo se instaló y no funcionó**, y se reporta como alarma, no como cifra.

**2. Nunca mezclar cohortes de antes y después del 2026-08-31.**

Es la regla más importante y la que más fácil se viola. Cualquier serie temporal que cruce esa fecha va a mostrar un derrumbe fantasma de todos los indicadores de landing y de VSL, y no será una caída de conversión: será un cambio de ruta de adquisición. Es el mismo defecto que `consumoDelPrecall.ts` documenta para el 2026-09-08 con `Sin abrir (0%)` → `Nada`, con dos diferencias que lo hacen peor: acá no es un renombre de valor sino la desaparición de la población, y acá la fecha cae **dentro de las dos ventanas anchas que el sistema ofrece**, «30 días» y «Completo» — y «30 días» es la que sale sola al abrir. En «Hoy» y en «7 días» el corte queda afuera, así que esas dos no tienen el problema: tienen el otro, que es no tener volumen.

Y hay que decirlo con las cuatro, porque la ventana ya no es una sola: Conversation ofrece `hoy`, `7d`, `30d` y `completo` (`lib/negocio/periodo.ts:83-96`), y **la de por omisión es 30 días** (`periodo.ts:109`), no 14. Las dos que importan acá fallan de maneras opuestas, medidas con el reloj clavado a las 18:50 UTC del 2026-09-15 (la ventana es móvil y arrastra sus denominadores, por eso van con la hora):

- **Catorce días** (`DIAS_DE_LA_TASA`, que es lo que devuelve un módulo al que nadie le pasa ventana) empieza el 2026-09-01, enteramente después del corte: 229 altas y `Form Landing VSL` en **0 de 229**. Todo cero.
- **Treinta días** —el botón con el que Conversation abre hoy, y el que Conversion heredaría— empieza el 2026-08-16, o sea **quince días antes del corte**, y parte el cohorte en dos regímenes de adquisición: 409 altas, **146 anteriores al 2026-08-31 y 263 desde el corte**, con `Form Landing VSL` en 137 de 409 y `VSL % máximo visto` en 61 de 409.

El segundo caso es el peligroso y es el que va a ocurrir, porque es el que sale solo al abrir la pantalla: una tasa de landing sobre ese denominador divide un numerador que casi sólo pueden aportar los 146 entre 409 contactos de los que 263 casi nunca pudieron aportarlo — «casi» porque hay uno del otro lado del corte, con alta del 2026-08-31 a las 00:57 UTC, que sí lo trae: el cambio de ruta no fue un interruptor al filo de la medianoche. El botón por omisión es, exactamente, el que viola esta regla.

**3. Distinguir «visitó la landing» de «la URL quedó registrada».**

Los 48 contactos de la ventana con rastro de `accelerator.ariaia.com` NO son 48 visitantes de la landing: 44 tienen `medium = calendar`, o sea que su URL se escribió en el momento de reservar. El cruce sale circular exactamente como el de la cobertura del precall entre citas `confirmed` (94,3 %) y `cancelled` (48,9 %) que documenta `consumoDelPrecall.ts`: «tener la URL» es consecuencia de haber agendado, así que una tasa de conversión calculada sobre ese denominador da casi 100 % por construcción. Si se publica una tasa de conversión de landing, el denominador tiene que ser gente registrada AL LLEGAR, no al convertir. Hoy no existe.

**4. El vocabulario de `Form Landing VSL` es cerrado y hay que tratarlo como cerrado.**

Tres valores exactos: `Agendado`, `Form incompleto sin agendar`, `Form completo sin agendar`. `negocio.campos_del_crm` **no guarda las opciones declaradas de un campo** —lo documenta `consumoDelPrecall.ts`— así que no hay forma de enterarse si el CRM agrega un cuarto valor salvo contando los que no caen en ninguna rama y publicándolos. Igual que con `-20%`, `Clic a link` y `Accede: sin reproducir` en el precall: lo que no tiene rama **no se fuerza**, se cuenta aparte y se informa.

**5. Los tres hosts no son la misma página y no se pueden sumar.**

En la ventana, las URL registradas se reparten en siete hosts: `calls.ariaia.com` 69 y `api.leadconnectorhq.com` 31 son **widgets de reserva** (ya está agendando, no está decidiendo); `accelerator.ariaia.com` 28 y `grow.ariaia.com` 1 son **landings con VSL**; `precall.ariaia.com` 18 es el **formulario precall**, que es post-agendamiento y pertenece a Appointment Flow; `www.fbsbx.com` 23 **no es una página nuestra**, es el navegador interno de Facebook y significa formulario nativo de Meta; `trabaja-con-nosotros.ariaia.com` 3 es reclutamiento y no es del funnel comercial. Una métrica de «visitas a la landing» que sume los siete cuenta cinco cosas distintas. El corte tiene que ser por host y declarado.

**6. Primer toque y último toque son dos preguntas, y para este departamento manda el último.**

Ver el punto 4 de «datos que ya tenemos»: `Trigger Link` sólo existe en `atribucion_ultima` (29 de 584; 27 de las 162 citas de la ventana) y no existe en `atribucion_primera` (0 de 584). Acquisition mira el primer toque —de qué anuncio vino—; Conversion mira el último —por dónde volvió a entrar—. Confundirlos hace que el departamento mida cero y lo reporte como ausencia.

**7. Lo que NO es de este departamento, aunque la pantalla lo dibuje.**

El consumo del video precall es §10.6, Appointment Flow, y ya está construido en `lib/negocio/consumoDelPrecall.ts` con su población, su piso y sus avisos. El prototipo lo dibuja en el paso «Gracias» como «video de bienvenida». Si Conversion publica su propia versión, va a haber dos tasas del mismo hecho con poblaciones distintas en dos pantallas — el defecto que ya costó una corrección en este proyecto («La tasa de cancelación publicada sumaba dos hechos opuestos», commit `9931f4d`). La retención del VSL por tramos, en cambio, sí es de Conversion y **no** de Creative: Creative mide retención del ANUNCIO (`video_25/50/75/100` de Meta), Conversion mide la del VSL de la landing. Son dos videos.

**8. El piso de publicación, y por qué acá hay que subirlo.**

`PISO_DE_UNA_TASA = 10` (`lib/negocio/indicadoresDeCitas.ts:300`). Aplicado a Conversion hoy: el cohorte escritorio son 14 citas —pasa el piso por cuatro—, pero cualquier desglose de ese cohorte (escritorio × landing, escritorio × campaña) cae por debajo inmediatamente. La segmentación por dispositivo que el prototipo ofrece como filtro de primera clase **no soporta un segundo corte**. O se publica sin desglose, o no se publica.

**9. Ninguna cifra puede llevar un identificador de GoHighLevel escrito a mano.**

`campoPorNombre()` (`lib/negocio/camposDelCrm.ts`) es la única puerta: compara por nombre exacto, no por `ilike`, desempata por `campo_id` para que dos campos homónimos no cambien de denominador entre corridas, y devuelve `null` —no cero— si alguien renombra el campo en el CRM. Quien consuma esa función tiene que poder decir «no sé» y decirlo en pantalla, como hace `consumoDelPrecall.ts` con su aviso de campo ausente.

---

## 7 · Riesgos

**1. Publicar un funnel de landing con los datos de hoy daría todo cero, y el cero se leería como catástrofe comercial.**

Es el riesgo inmediato y el más probable. Si alguien construye la pantalla contra la base con los 14 días de `DIAS_DE_LA_TASA`, obtiene: formularios iniciados 0, formularios completados 0, VSL visto 0 %, y citas 123 — porque la ventana empieza después del 2026-08-31, el día exacto en que el tráfico dejó de pasar por la landing. Un tablero que diga «0 % de conversión de landing» junto a 146 citas reservadas va a mandar a alguien a arreglar una landing que está bien y que simplemente ya no está en el camino. La cifra correcta no es cero: es «este departamento no tiene población en esta ventana», que es una frase, no un número.

Y hay una segunda forma del mismo riesgo que es peor y es la que va a ocurrir, porque 14 días ya no es el botón por omisión: Conversation abre en **30 días** (`lib/negocio/periodo.ts:109`). Con treinta no sale cero, sale una cifra mezclada — medido a las 18:50 UTC del 2026-09-15: 409 altas, 146 de antes del corte y 263 de después, con `Form Landing VSL` en 137. Un cero se discute; un tercio que en realidad es «137 formularios de una landing que dejó de recibir tráfico, divididos por un mes que contiene dos rutas de adquisición distintas» se publica y nadie pregunta. Ver la regla 2 de §6.

**2. Reemplazar las constantes una por una, dejando el resto, produce una pantalla mixta indistinguible.**

El caso concreto: `negocio.citas` permite llenar los pasos «Agenda» (123 contactos con cita) mientras «Landing», «VSL» y «Gracias» siguen viniendo de `CV`. El resultado sería un recorrido donde un paso es verdad y cuatro son mentira, con el mismo tipo de letra, las mismas bandas y los mismos deltas. Hoy la pantalla al menos es uniformemente falsa y el comentario de la línea 7 lo dice («reemplazar por la consulta real»); a medio camino, nadie puede saber qué mirar. Si se toca, o se pinta el paso real y **se vacían explícitamente los otros cuatro** —con su motivo escrito—, o no se toca.

**3. La banda esperada es el riesgo de mayor alcance, porque no miente sobre el valor sino sobre el método.**

`BANDS` (`conversion.js:21-25`) viene con un comentario que describe un p25–p75 de 90 días por dispositivo. Ese comentario sobrevive a cualquier auditoría superficial: quien lea el código para verificar de dónde salen los umbrales encuentra una metodología. Si alguien reemplaza `CV` por consultas reales y deja `BANDS`, la pantalla va a evaluar datos verdaderos contra umbrales inventados y va a marcar pasos «bajo lo esperado» sin ninguna base — y el termómetro es lo que dispara el contador de `#cvWorst` («N pasos bajo lo esperado») y la severidad de las tarjetas. Un umbral falso sobre un dato verdadero es peor que un dato falso: produce una decisión.

**4. Kevin Inofuente está en pantalla, con nombre, culpado de tres fallas que no existen.**

`identidad.usuarios` tiene `Kevin Inofuente` y `Kevin Inofuente Colque`. La pantalla le asigna «El formulario devuelve error en Safari móvil» (severidad crítica, «detectado hace 3 h», «64 contactos perdidos»), «La página tarda 4.1s en cargar en móvil» y «12% reintenta el envío». Esto no es un riesgo de cifra, es un riesgo de persona, y es exactamente el motivo por el que `lib/aios/index.js:19-24` sacó Closer y Setter del prototipo: «estuvieron en producción mostrándolos». Además, la incidencia crítica dispara la barra roja «Requiere acción ahora», que es el elemento de más jerarquía visual de la pantalla. Esto no espera a que se construya nada.

**5. Los deltas son constantes y siempre verdes donde importa.**

`FACTOR` y `PREV` son fijos, así que toda flecha ▲/▼ de la pantalla es un cociente entre dos literales, no una variación. Y el `0.94` de `conversion.js:165` está puesto sólo para que «Calificadas» mejore. Quien mire esta pantalla dos semanas seguidas va a ver los mismos porcentajes de mejora y va a concluir que las cosas van bien de forma sostenida. Es el tipo de error que no se detecta mirando: hay que leer el código.

**6. Un módulo que busque `Trigger Link` en la columna equivocada va a reportar «no se usan trigger links» con total confianza.**

Es el error que este proyecto ya cometió tres veces —`meta_ad_id`, las UTM, el porcentaje del video precall— y estuvo a punto de cometer una cuarta en el propio enunciado de esta tarea. `atribucion_primera->>'sessionSource'` no contiene `Trigger Link` ni una vez en 584 contactos; `atribucion_ultima` lo tiene 29 veces. Un `count(*) = 0` sobre la columna equivocada es indistinguible de un dato ausente, y llevaría a pedirle a GoHighLevel que empiece a mandar algo que ya manda.

**7. Duplicar el consumo del precall haría que la misma tasa aparezca dos veces con dos poblaciones.**

`consumoDelPrecall.ts` publica esa tasa sobre una población cuidadosamente recortada (citas alcanzables, **ya pasadas** y **no canceladas**), y documenta por qué cada condición es necesaria. Si Conversion la recalcula para su paso «Gracias» sin esas tres condiciones —que es lo natural, porque Conversion piensa en visitas a una página, no en citas—, van a convivir dos porcentajes distintos del mismo hecho en la misma aplicación, y los dos se van a ver bien por separado. Es literalmente el defecto del commit `9931f4d`.

**8. Si se instrumenta de nuevo, hay que guardar eventos y no un campo por contacto.**

El §5.3 lo pide y el estado actual es la demostración de por qué: `atribucion_ultima` se sobrescribe, así que los 27 contactos con `Trigger Link` de la ventana son los que tienen el trigger link **como último toque**, no los que alguna vez llegaron por uno. Cualquiera que haya vuelto después por otra vía ya no figura. Repetir ese diseño para la landing y el VSL —un campo `% máximo visto` sobrescribible por contacto— entrega exactamente el dato que hoy tenemos: 79 filas con un solo valor y ninguna manera de saber qué pasó en el medio.

**9. Y el riesgo de fondo: el §17 sigue vacío.**

No hay KPIs definidos, ni umbrales, ni usuarios responsables, ni límite acordado entre Landing Intelligence y VSL Intelligence. Construir contra la pantalla existente equivaliría a ratificar decisiones que tomó un prototipo HTML: cinco pasos, dos proveedores que no están contratados, cuatro severidades, un factor de recuperación del 45 %. Ninguna de esas elecciones la tomó el negocio.
