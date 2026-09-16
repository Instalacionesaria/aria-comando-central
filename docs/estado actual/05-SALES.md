# Sales Intelligence
> Corte: **2026-09-16 13:54 UTC**; las tablas que el barrido escribe siguen creciendo después de esa
> hora. Cada afirmación lleva su archivo:línea o la consulta que la produjo.
> Lo que no se pudo verificar está dicho como pendiente, no omitido.
> Para ubicar cualquier cosa nombrada acá, ver `08-COMO-USAR-EL-GRAFO.md`.

**Prototipo completo — pantalla entera con datos inventados.**

Prototipo completo: la pantalla `sales` dibuja 23 números inventados y el nombre real de un closer, mientras `negocio.resultados` —la única fuente posible de una venta— tiene 7 filas, cero ventas y cero montos, es decir menos de la mitad del piso de 10 eventos que el proyecto exige para publicar cualquier tasa.

---

## 1 · Qué pide el documento

El documento nunca especifica Sales Intelligence: el §17 («Secciones pendientes», línea 1110) lo lista explícitamente como área que «tiene visión general pero todavía requiere especificación detallada». Lo que hay son cuatro apariciones sueltas.

§4 Organigrama funcional (líneas 163-192): «Sales Intelligence» cuelga directamente de Executive Intelligence, sin subdepartamentos —a diferencia de Acquisition (Meta Ads), Conversion (Landing + VSL) y Conversation (Lead Flow + Appointment Flow)—. En Team Execution hay un «Responsable de Ventas» (línea 190). El diagrama de capas (líneas 140-158) lo pone en la CAPA DE INTELIGENCIA y le asigna, en la capa de datos, «ventas y revenue reportado».

§2.3 (línea 90): la única atribución de competencia que el documento le da: «Sales Intelligence puede recomendar coaching para un closer». Todo lo que afecte presupuesto o varios departamentos sube a Executive.

§5.2 Trazabilidad principal (líneas 223-238): la cadena `meta_ad_id → visitor_id → session_id → lead_id → ghl_contact_id → appointment_id → sales_call_id → sale_report_id`. Los dos últimos eslabones son los de Sales, y son los únicos dos que no existen en nuestro esquema con ningún nombre.

§5.4 Registro actual de ventas (líneas 267-288) — lo más parecido a una especificación que tiene este departamento, y son 22 líneas: «En la versión actual, la fuente de verdad comercial es un registro manual del closer». El closer completa dos cosas: «¿El cliente compró?» y «Monto vendido». Campos sugeridos: `sale_status`, `sale_amount`, `sale_currency`, `reported_by_closer_id`, `reported_at`, `opportunity_id`, `sale_source = closer_reported`. Y cierra con la advertencia que gobierna todo el departamento: Business Intelligence «deberá indicar que se trata de ventas reportadas por el closer y no necesariamente de pagos verificados».

§5.3 Perfil resumido del lead (líneas 260-263): el perfil debe incluir «Asistencia», «Resultado de venta» y «Monto reportado por el closer».

§16.1 (línea 1072) declara «Auditoría de llamadas de venta» entre las capacidades EXISTENTES, y §16.2 (línea 1101) pone como prueba pendiente n.º 7: «Conectar contacto, cita, asistencia y venta reportada». §10.7 (línea 759) pide «Show rate por closer».

---

## 2 · Qué hay hoy en pantalla

La pantalla es `components/views/SalesView.jsx`, 231 líneas, montada en `components/CommandCenter.jsx:43` y declarada en `lib/autorizacion/secciones.ts:285-291` con la bandera `sinOperacionesTodavia: true` — la declaración formal de que no tiene una sola operación de servidor. No existe `app/api/sales/`, y `ls app/api` lo confirma: hay `closer`, `setter`, `contactos`, `monitoreo`, pero ninguna ruta de Sales.

**No hay módulo `lib/aios/sales.js`.** A diferencia de Acquisition (`acquisition.js`, 17 008 bytes), Creative (`creative.js`, 30 106) y Conversion (`conversion.js`, 37 522), Sales no tiene capa imperativa: sus datos inventados están escritos directamente en el JSX, valor por valor. `lib/aios/index.js` (líneas 26-38) lista los 12 módulos que arrancan y ninguno es de Sales.

Lo que se dibuja, de arriba abajo:
· Encabezado «Sales · Cierre, closers y motivos de pérdida» (SalesView.jsx:14-18).
· Botón «Plan de acción» `#slPlanBtn` (SalesView.jsx:23). **Es un botón muerto.** Un grep sobre todo el código fuera de `.next/` devuelve dos apariciones de `slPlanBtn`: la del propio JSX y la del prototipo `aios-command-center_1.html:2940` del que la vista está portada. Ninguna lo engancha. `lib/aios/period-controls.js:40` engancha `lpPlanBtn` (Leads Portal) y ningún otro. El botón se pinta, se puede hacer clic, y no pasa nada.
· Selector de periodo `#slPeriod` con «Hoy / 7 días / 30 días» y «7 días» marcado `on` (SalesView.jsx:30-39). **También muerto**: no hay handler para `slPeriod` en ningún archivo. El número no cambiaría aunque se pudiera cambiar el periodo, porque es literal.
· Píldora «Personalizado» `#slPill` con `data-datepick="sl"` (SalesView.jsx:41-48). `lib/aios/datepicker.js:123-129` sí abre el calendario para cualquier `[data-datepick]`, pero busca el callback en `window.AIOSDate._cbs['sl']` y nadie registra `'sl'`. Abre un calendario que no aplica nada.
· Cuatro tarjetas KPI (SalesView.jsx:57-90): Asistencias, Tasa de cierre, Ventas, Revenue reportado.
· Tabla «Closers» con dos filas (SalesView.jsx:100-170).
· Tarjeta «Motivos de no venta» con cuatro barras (SalesView.jsx:172-221).

La pantalla se renderiza SIEMPRE en el DOM, activa o no (`className={activa ? 'view on estetica-op' : 'view estetica-op'}`, SalesView.jsx:5). La capacidad que pide es `tablero.ver`, y una consulta a `identidad.roles_permisos` devuelve que **los 11 usuarios activos la tienen**: Alonso Gutierrez, Cris Prueba, Gabriel, Jorge Quiroz, Jorge Veramendi, Kevin Inofuente, Kevin Inofuente Colque, Miguel Colon, Moises Ruiz, Pamela Chunga y Walter Peñaherrera. Todos ven esta pantalla.

Sales aparece además en tres superficies fuera de su propia pantalla, y ninguna es real: el nodo del mapa ejecutivo (`components/views/ExecutiveView.jsx:278-290`), el embudo y la tarjeta de departamento de `lib/aios/executive.js` (líneas 9-20 y 194-197), y las tarjetas de reunión y cambios de `lib/aios/executive-panel.js:10,30`.

---

## 3 · Lo que está hardcodeado

**8 juego(s) de datos inventados.**

### 3.1 · Las cuatro tarjetas KPI: «Asistencias 74», «Tasa de cierre 24%», «Ventas 18», «Revenue reportado $55,200»

- **Dónde:** `components/views/SalesView.jsx:60, :70, :80, :90`
- **Finge ser:** El resultado comercial del periodo «7 días»: asistencias a citas de venta, tasa de cierre sobre asistidas, conteo de ventas y suma de montos reportados por el closer. Es exactamente lo que el §5.4 pide («¿El cliente compró?» + «Monto vendido») y lo que el §4 le asigna a la capa de datos («ventas y revenue reportado»).
- **¿Se puede reemplazar hoy?** NO, ninguno de los cuatro. Medido: `select count(*), min(creado_el), max(creado_el) from negocio.resultados` devuelve 7 filas, primera 2026-08-30, última 2026-09-09, 6 de ellas dentro de los últimos 14 días. Desglosadas por salida: seguimiento 4, no_show 2, no_interesa 1. **Ventas: 0. Acuerdos sin pago: 0. Filas con monto cargado: 0** (`count(monto)` = 0 en las 7). Las 7 son `rol='closer'`; el setter no registró ninguna. Con 7 eventos no se alcanza `PISO_DE_UNA_TASA = 10` (lib/negocio/indicadoresDeCitas.ts:300), así que «Tasa de cierre» no se puede publicar ni siquiera como cero. «Ventas» y «Revenue» sí se pueden publicar, pero como CERO MEDIDO con su rótulo, no como 18 y $55,200. «Asistencias 74» es el caso peor: `select count(asistio) from negocio.citas` devuelve **0 sobre 321 filas** — asistencia NO REGISTRADA, que no es cero asistencias.

### 3.2 · La fila del closer «Jorge Veramendi», con subtítulo «ICP alto asignado» y los números 44 agendadas / 31 asistieron / 10 ventas / 32% cierre / $31,000 revenue

- **Dónde:** `components/views/SalesView.jsx:123-142`
- **Finge ser:** El desempeño individual de un closer real. Jorge Veramendi es un usuario activo de producción: `identidad.usuarios` lo trae con rol `superadministrador`, id `09153d98-09ab-48f9-88dc-43ed5f739312`; tiene comisión configurada al 10% en `negocio.comisiones` desde 2026-09-07; está mapeado al CRM en `negocio.closer_asignado` con `crm_usuario_id = ryxDLpnsr1ERnlFNeSfz`; y **es quien registró 5 de las 7 filas de `negocio.resultados`** — una de ellas con una nota que dice «el closer (yo, jorge veramendi)». Es decir: la pantalla le atribuye 10 ventas y $31,000 a una persona que en la base no tiene ninguna venta registrada, y esa persona puede abrir la pantalla y leerlo (tiene `tablero.ver`).
- **¿Se puede reemplazar hoy?** PARCIALMENTE, y solo dos de las cinco columnas. **Agendadas: SÍ.** Medido sobre la ventana de 14 días con el mismo filtro que ya usa `tasaDeCancelacion` (alcanzable = `ghl_calendario_id is not null`, no descartado = sin etiqueta de `ETIQUETAS_DE_DESCARTE`), las citas por closer son: `0peGoq7VvFqnDGA7gxtX` 43, `ryxDLpnsr1ERnlFNeSfz` (Jorge Veramendi) 21, `h0GyOecIxLdARqhzT5mZ` 5, sin asignar 2. Dos de los tres closers pasan el piso de 10; el tercero no. **Asistieron: NO** — `citas.asistio` es NULL en las 321 filas. **Ventas, Cierre, Revenue: NO** — cero filas de venta en toda la base. El subtítulo «ICP alto asignado» también es inventado: no existe ninguna tabla ni columna que asigne contactos a un closer por tramo de ICP.

### 3.3 · La fila «Asesor comercial», con subtítulo «ICP medio y bajo» y los números 63 / 43 / 8 / 19% / $24,200

- **Dónde:** `components/views/SalesView.jsx:148-167`
- **Finge ser:** Un segundo closer, presentado como un rol genérico. La base tiene TRES closers con comisión y mapeo al CRM, no dos: Jorge Veramendi, Jorge Quiroz (`a5ad6a05-…`, `0peGoq7VvFqnDGA7gxtX`) y Gabriel (`2d3d1f2e-…`, `h0GyOecIxLdARqhzT5mZ`). La tabla de dos filas no corresponde a ninguna realidad del equipo.
- **¿Se puede reemplazar hoy?** PARCIALMENTE, igual que la fila anterior, y con el mismo recorte: solo «Agendadas» tiene fuente. Además la tabla tendría que pasar de 2 filas a 3 (o 4 con el bucket «sin asignar», que son 2 citas alcanzables en la ventana). Gabriel, con 5 citas alcanzables en 14 días, queda por debajo del piso de 10 para cualquier tasa propia.

### 3.4 · La tarjeta «Motivos de no venta»: el rótulo «56 llamadas sin cierre» y las cuatro barras Precio 21 (38%), No es quien decide 13 (23%), Sin necesidad clara 12 (21%), Pidió tiempo 10 (18%)

- **Dónde:** `components/views/SalesView.jsx:176, :182-218`
- **Finge ser:** La distribución de motivos de pérdida — el insumo del «coaching para un closer» que el §2.3 le atribuye a este departamento. Y el vocabulario es INVENTADO, no el nuestro: «No es quien decide» y «Sin necesidad clara» no existen en ningún catálogo del sistema. El catálogo real de motivos de `no_interesa` es `['Precio', 'No es el momento', 'Competencia', 'No califica', 'Otro']` (lib/negocio/salidas.ts:82, salida `no_interesa`). «Pidió tiempo» sí existe, pero como opción de `nurture`, no de pérdida. O sea que la pantalla mezcla un vocabulario que nadie puede alimentar.
- **¿Se puede reemplazar hoy?** NO. Medido: la única fila `no_interesa` de toda la base tiene `detalle = 'Otro'`, y es de 2026-08-30. Un motivo, y es el cajón de sastre. El denominador tampoco existe: «56 llamadas sin cierre» exige saber cuántas llamadas hubo y cuántas cerraron, y ninguna de las dos cifras tiene fuente (0 asistencias registradas, 0 ventas). En el CRM tampoco está: el campo «Motivo de descalificación» (`dKEa5EAjdTk5kHXQ3Ilj`, resuelto por nombre en `negocio.campos_del_crm`) tiene valor en **3 contactos de 585, y 0 en la ventana de 14 días**; «Nivel de interés seguimiento» (`iZN1zfDlTOrPvjssFjrX`) en 1 de 585, 0 en la ventana; «Razón de no-show» (`LLOXds4s0uN89Y8pbesx`) en 2 de 585, 0 en la ventana.

### 3.5 · Los cuatro números de Sales dentro del embudo de Executive: `asistidas`, `ventas` y `revenue` en los objetos `F` y `PREVP`, cinco periodos cada uno (hoy / 7d / mes / tri / hist)

- **Dónde:** `lib/aios/executive.js:9-13 (PREVP) y :16-20 (F), con la atribución a Sales en :27-28`
- **Finge ser:** Los dos pasos finales del embudo ejecutivo, declarados propiedad de Sales: `{k:'asistidas', t:'Citas asistidas', own:'Sales'}` y `{k:'ventas', t:'Ventas', own:'Sales'}`. Son 10 filas de constantes con 30 valores de Sales en total. Para el periodo por omisión ('7d', `let exP = '7d'` en la línea 30) dice: 36 asistidas, 11 ventas, $27,940 de revenue.
- **¿Se puede reemplazar hoy?** NO, y además **CONTRADICE a la propia pantalla de Sales**. Para el mismo periodo de 7 días, `SalesView.jsx` dice 74 asistencias / 18 ventas / $55,200 y `executive.js` dice 36 asistidas / 11 ventas / $27,940. Dos pantallas del mismo producto, el mismo departamento, el mismo periodo, y los números son el doble en una que en la otra. Nadie lo nota porque ninguna se calcula.

### 3.6 · La tarjeta de departamento de Sales en el panel ejecutivo: «11 ventas · cierre 31%», el hallazgo «37% de las citas no califican y ocupan agenda del closer · el filtro está en el formulario», y la dependencia «Necesito que Conversion endurezca el formulario antes de subir volumen»

- **Dónde:** `lib/aios/executive.js:194-197`
- **Finge ser:** La conclusión que Sales le entrega a Executive — el §2.2 («los departamentos producen inteligencia») y el §15 en acción. El hallazgo del 37% es una afirmación causal con dos partes inventadas: el porcentaje y el diagnóstico de dónde está el problema.
- **¿Se puede reemplazar hoy?** NO. Además el «cierre 31%» contradice el «24%» de la propia pantalla de Sales (SalesView.jsx:70). Y hay un tercer lugar con el mismo número: `components/views/ExecutiveView.jsx:288-290` rotula el nodo Sales del mapa con «cierre 31%» y le pone el punto verde de estado OK (`fill: 'var(--ok)'`, línea 281) — un departamento declarado sano sobre una tasa que no existe.

### 3.7 · Sales como fuente de evidencia en las tarjetas de reunión y de cambios del panel ejecutivo: «El hook nuevo está costando ventas · Sales cierra 7 puntos menos desde el día 8» y «Hook nuevo en Prospecting B · el hook rate subió 4 puntos pero el cierre bajó 7»

- **Dónde:** `lib/aios/executive-panel.js:6-10 y :29-30`
- **Finge ser:** Una cadena causal entre tres departamentos (Creative → Conversion → Sales) con Sales aportando la medición de cierre, más una decisión pendiente («Revertir o ajustar esta semana»). Es el §2.4 (colaboración entre departamentos) dibujado.
- **¿Se puede reemplazar hoy?** NO. La cadena entera se apoya en una serie temporal de tasa de cierre por día que requeriría, como mínimo, ventas fechadas. Hay 0.

### 3.8 · Las tres preguntas sugeridas del chat ejecutivo para Sales: «¿Por qué perdemos las llamadas?», «¿Qué objeción se repite?», «¿Qué closer necesita apoyo?», más las respuestas preescritas que citan a Sales como fuente («Vas 11 de 30 con 18 días por delante… cierras en 22»)

- **Dónde:** `lib/aios/executive-chat.js:23 y :33-36`
- **Finge ser:** La interfaz conversacional del §6.3 «Modo negocio». Las tres preguntas son exactamente las que este departamento debería contestar. La respuesta `meta` inventa además una meta de 30 ventas que no existe en ninguna parte: `negocio.comisiones.meta_mensual` es NULL en las tres filas configuradas.
- **¿Se puede reemplazar hoy?** NO ninguna de las tres. «¿Qué objeción se repite?» necesita motivos de pérdida (hay 1, y dice «Otro»). «¿Qué closer necesita apoyo?» necesita tasas por closer (0 ventas, 0 asistencias registradas). «¿Por qué perdemos las llamadas?» necesita la llamada: `negocio.llamadas` tiene **0 filas**.


---

## 4 · Datos que YA tenemos

Lo que Sales tiene de verdad hoy es un esquema bien diseñado y casi vacío, más un puñado de dimensiones reales que vienen de otros departamentos.

**El esquema de la venta existe y es mejor que el del §5.4.** `negocio.resultados` tiene 13 columnas: `org_id, id, contacto_id, salida, rol, monto, forma_pago, detalle, nota, registrado_por, creado_el, clave_de_intento, cita_id`. El mapeo contra los campos sugeridos del §5.4 es casi uno a uno: `sale_status` → `salida`, `sale_amount` → `monto`, `reported_by_closer_id` → `registrado_por`, `reported_at` → `creado_el`, `sale_source = closer_reported` → implícito (toda fila es un registro manual). Lo que NO existe con ningún nombre: `sale_currency` (no hay columna de moneda en ninguna tabla de `negocio`) y `opportunity_id` (un grep por `opportunit` en `lib/` y `app/` devuelve solo `TYPE_ACTIVITY_OPPORTUNITY` en `lib/ghl/entrega.ts:144`, que es un tipo de evento del feed, no una entidad ingestada). Y el esquema mejora al §5.4 en dos puntos: separa `forma_pago` del estado, y separa «acordó comprar» de «vendió».

**Las 7 filas, contadas.** `select count(*), count(distinct contacto_id), count(distinct registrado_por), min(creado_el), max(creado_el) from negocio.resultados` → 7 filas, 6 contactos, 2 personas, del 2026-08-30 al 2026-09-09. Seis de las siete caen dentro de los últimos 14 días. Por salida: `seguimiento` 4, `no_show` 2, `no_interesa` 1. Cinco las escribió Jorge Veramendi, dos Gabriel. **Cero ventas, cero acuerdos sin pago, cero montos, cero filas del setter.**

**Los catálogos de desenlace son reales, completos y usados en producción.** `lib/negocio/salidas.ts:82` define las seis del closer: `venta` (win, pide monto, subcategoría «Forma de pago» con Contado/Splitwise/Buy Now Pay Later/Cuotas), `acuerdo_sin_pago` (money, pide monto, sin subcategoría), `seguimiento` (next, «Nivel de interés»: Próximo a pagar/Muy interesado/Dudando/Enfriándose/Otro, con dos modos manual y automático), `no_interesa` (lost, «Motivo»: Precio/No es el momento/Competencia/No califica/Otro), `no_show` (lost, «Qué pasó»: Avisó quiere reagendar/Plantón sin aviso/Falla técnica/Datos incorrectos) y `nurture` (next, «De dónde viene»: Pidió tiempo/Se enfrió). `lib/negocio/salidasDelSetter.ts:54` define las cinco del setter: `agendo`, `venta_chica` (pide monto), `seguimiento`, `no_califica`, `nurture`.

**La maquinaria de dinero ya está escrita y probada, solo le falta insumo.** `lib/negocio/inicio.ts:173-180` calcula el «cobrado» del mes sumando `monto` únicamente donde `salida = 'venta'`, y cuenta los `acuerdo_sin_pago` aparte. `lib/negocio/comision.ts:109-112` hace lo mismo filtrado por persona. Los dos distinguen los cuatro estados del número (sin porcentaje / cero deliberado / sin resultados propios / con resultados y sin ventas) — la disciplina que Sales tendría que heredar tal cual.

**La comisión está configurada.** `negocio.comisiones`: tres filas, las tres `tipo='closer'` con `porcentaje = 10.00`, cargadas el 2026-09-02 y el 2026-09-07. `meta_mensual` es NULL en las tres.

**El mapeo closer ↔ CRM existe.** `negocio.closer_asignado`: tres filas del 2026-09-02 que atan `identidad.usuarios.id` con el `crm_usuario_id` de GoHighLevel. Es lo que permite atribuir una cita a una persona nuestra, porque `negocio.citas.crm_asignado_a` guarda el identificador del CRM.

**Las citas son el dato más sólido que Sales puede consumir.** 321 filas, del 2026-08-12 al 2026-10-01, con `crm_asignado_a` poblado en 187 (los 134 restantes están sin asignar). En los últimos 14 días, 156 citas ya pasadas; aplicando el filtro de `tasaDeCancelacion` quedan 71 alcanzables y no descartadas. Por closer, alcanzables y no descartadas en la ventana: 43 / 21 / 5 / 2 sin asignar. Estados del CRM sobre las 321: `cancelled` 160, `confirmed` 146, `noshow` 15.

**El ICP es real y pasa el piso con holgura.** El campo «Puntaje | ICP» (`9HXxl5DW6aayQgKUPiOS`, resuelto por nombre en `negocio.campos_del_crm`) tiene valor en **465 de 585 contactos, y 200 dentro de la ventana de 14 días**. Es el único insumo de calidad de lead que Sales puede usar hoy sin inventar nada. Ojo: la columna `negocio.contactos.score` es NULL en las 585 filas — el ICP no vive ahí, vive en el JSON del CRM.

**El territorio y la etapa.** `negocio.contactos`: 585 filas, 280 del territorio `closer` (113 creados en los últimos 14 días), 280 del `setter`, 25 sin territorio. La columna `etapa` está poblada en **6 contactos de 585** — los mismos 6 que tienen resultado: `seguimiento` 3, `no_show` 2, `descalificado` 1. Ningún contacto en etapa `ganado`.

---

## 5 · Datos que faltan, y de dónde tendrían que venir

**1 · La venta misma. No la hay en ningún lado, y lo comprobé contra la base, no contra el código.**
Esto es lo que el aviso del proyecto exige verificar, así que lo hice por cuatro caminos distintos:
· `negocio.resultados`: 0 filas con `salida='venta'` o `'acuerdo_sin_pago'`, 0 con `monto` no nulo.
· Campos del CRM resueltos POR NOMBRE en `negocio.campos_del_crm`: «Forma de pago venta» (`eUVX9ZlZsAHIwPr07hdR`) **0 de 585 contactos**; «forma_de_pago» (`k8u7GHpFDqBAW91q7hux`) 0; «Método de pago» (`fjUxq7EHNV6tSH77q5GG`) 0; «Cuota Inicial» (`YATkJYBm7J2FxTuKOMRv`) 0; «Cuotas» (`eesx5OAqxpkloIal25tb`) 0; «Cuota 2», «Cuota 3» y «Cuota 4» —los tres de tipo MONETORY, los únicos campos monetarios de toda la subcuenta— **0, 0 y 0**; «Estado del Producto» 0; «Política de Pagos» 0; «Etapa del Lead» 0; «Lead Score» 0.
· Etiquetas de contacto: un censo completo de `unnest(etiquetas)` sobre las 585 filas. Las 30 etiquetas más frecuentes no incluyen ninguna de venta. Un `similar to '%(vent|compr|pag|cliente|clos|gan|cerr|deal|win)%'` devuelve solo `zona_closer` (293, es territorio) y `afiliado ghl pago` (2, que es otra cosa).
· Oportunidades de GoHighLevel: no se ingestan. No hay tabla, no hay llamada al endpoint.
Conclusión: **la venta no existe bajo ningún otro nombre.** Tiene que venir del registro manual del closer, exactamente como dice el §5.4, y ese registro no tiene ninguna venta anotada.

**2 · La asistencia. El mecanismo existe desde el 2026-09-14, y por eso no tiene ni una fila.**
`citas.asistio` es NULL en las 321 filas, y `resultados.cita_id` es NULL en las 7. No es abandono: la migración `db/migraciones/049_si_se_presento_a_la_cita.sql` —que agrega `citas.asistio` (líneas 46-47) y `resultados.cita_id` (líneas 65-66)— figura en `migraciones.migraciones_aplicadas` con fecha **2026-09-14T21:49**. El escritor ya está en `lib/negocio/avanzar.ts:248`, que hace `.set({ asistio: lo.cita.asistio })` cuando el closer elige a qué cita se refiere. El encabezado de esa migración deja medido por qué no se puede leer del CRM: el campo de asistencia de GoHighLevel está poblado en 3 de 1 052 citas, y sus campos personalizados de asistencia en 0 de 316. Mi propia medición lo confirma desde otro ángulo: `estado_ghl='noshow'` son 15 filas de 321.
Hay una señal parcial que conviene no confundir con un dato: la etiqueta de contacto `noshow` está en **52 contactos**, bastantes más que las 15 citas con ese estado en el CRM. Pero es de CONTACTO, no de CITA —un contacto con dos citas no se puede resolver—. Sirve como pista, no como denominador.

**3 · La llamada de venta. Cero grabaciones, cero transcripciones, cero auditoría.**
El §16.1 (línea 1072) declara «Auditoría de llamadas de venta» entre las capacidades existentes. Medido: `negocio.llamadas` tiene **0 filas**. `negocio.analisis_del_agente` tiene 49 filas, todas de agentes de TEXTO: `chat_post_agenda` 44 y `chat_pre_agenda` 5 — ninguna de una llamada de closer. En el CRM, el campo «Audio de llamada» (`t0aZuoISOYQftQNVLQaI`, FILE_UPLOAD) tiene valor en **0 de 585 contactos**; «Transcripcion de Elevenlabs» en 4 (y esas son del agente de voz, no del closer). El §16.1 sobreestima lo que hay: hoy la auditoría cubre Conversation, no Sales.

**4 · El eslabón `sales_call_id` y `sale_report_id` del §5.2.**
`sale_report_id` es, de hecho, `resultados.id`, así que ese eslabón existe aunque sin filas de venta. `sales_call_id` no tiene tabla: `negocio.llamadas` está vacía y no hay nada que la pueble. El eslabón `appointment_id → sale_report_id` se abrió el 2026-09-14 con `resultados.cita_id` y todavía no tiene ninguna fila que lo recorra.

**5 · La asignación de contactos por ICP.**
El subtítulo «ICP alto asignado / ICP medio y bajo» de la tabla de closers no tiene fuente: no hay tabla, columna ni campo del CRM que asigne un closer por tramo de ICP. El ICP existe (465 contactos), la asignación existe (`closer_asignado`, 3 filas), pero la REGLA que las une no está escrita en ninguna parte.

**6 · La moneda y la meta.**
No hay columna de moneda en `negocio.resultados` ni en ninguna tabla de `negocio` — el §5.4 pide `sale_currency`. Y `negocio.comisiones.meta_mensual` es NULL en las tres filas, así que la respuesta preescrita del chat («Vas 11 de 30») inventa también el denominador.

---

## 6 · Reglas propias de este departamento

**1 · Una venta del closer y una venta del setter NO se suman. Nunca.**
Es la regla más dura del departamento y está escrita con su motivo en `lib/negocio/etapas.ts:86-94`. El mapa `ETAPA_DE_LA_SALIDA` (línea 76) tenía las nueve salidas y mandaba `venta_chica` a la etapa `ganado` —la del cierre del closer— con un comentario que admitía que estaba mal. El texto que quedó: «Una venta chica de $497 dibujada en la misma columna que un cierre de $12.000 no es un detalle de presentación: son dos negocios sumados en un número». Hoy cada catálogo mapea sus salidas a sus etapas. Cualquier «Ventas» o «Revenue» de la pantalla de Sales tiene que declarar de qué negocio habla. Si mañana el setter registra su primera `venta_chica`, un `sum(monto)` sin filtro de rol infla el revenue del closer y no falla nada.

**2 · Una venta y un acuerdo sin pago son dos hechos distintos, y solo uno es dinero.**
`lib/negocio/inicio.ts:36-45`: «Lo COBRADO del mes. Cobrado real, no prometido — son dos cosas distintas y solo una va acá. […] Un acuerdo sin pago NO suma: tiene su propio indicador». `ETAPA_DE_LA_SALIDA` los separa también: `venta → ganado`, `acuerdo_sin_pago → cierre` («hay plata comprometida y no cobrada: más que cualquier estado pendiente, menos que la venta»). El «Revenue reportado» de Sales debe ser la suma de `venta` y nada más; lo comprometido va aparte, con su rótulo.

**3 · Es venta REPORTADA, no pago verificado. El §5.4 lo exige por escrito.**
«Business Intelligence podrá utilizar estos datos, pero deberá indicar que se trata de ventas reportadas por el closer y no necesariamente de pagos verificados» (línea 288). Sales es el departamento que produce ese dato, así que el rótulo nace acá. Ninguna cifra de revenue de este departamento puede presentarse sin él.

**4 · El piso de 10 y la ventana de 14 días, y el piso es del DENOMINADOR.**
`PISO_DE_UNA_TASA = 10` (lib/negocio/indicadoresDeCitas.ts:300) y `DIAS_DE_LA_TASA = 14` (línea 293). El encabezado del piso trae la regla que más le importa a Sales: «el piso es del DENOMINADOR, no del total de citas: con 151 citas y 3 respuestas la muestra son 3, y quien contestó esas tres no es una muestra al azar de las 151 — **el closer que cierra sus intentos no es el mismo que no los cierra**». Ése es exactamente el sesgo que va a tener la tasa de cierre de Sales el día que haya 10 resultados: los closers que registran no son una muestra al azar de los closers.

Y catorce días **ya no es la ventana del sistema, sino el valor por omisión de una función.** Desde el commit `13ce4999`, `lib/negocio/periodo.ts` declara la lista CERRADA de las cuatro ventanas que se pueden pedir —`hoy` 1 día, `7d` 7, `30d` 30 y `completo` `DIAS_DE_TODO = 3650` (`lib/negocio/periodo.ts:52` y `lib/negocio/periodo.ts:83-96`)— con `PERIODO_POR_OMISION = '30d'` (`periodo.ts:109`), justamente porque «catorce no está entre los cuatro botones». `DIAS_DE_LA_TASA = 14` sigue vivo como el argumento por omisión de `tasaDeCancelacion(dias = DIAS_DE_LA_TASA)` (`indicadoresDeCitas.ts:312`): es lo que recibe quien NO pide ventana. Para Sales eso significa que el día que la pantalla tenga selector de período, la clave se valida contra la lista y lo que no está se RECHAZA —`periodoDe` devuelve `null` y quien llama lo convierte en un 400 (`periodo.ts:188-192`)—, y la ventana elegida tiene que llegarle a TODAS las cifras de la pantalla: una sola que se quede con su argumento por omisión sigue en catorce días mientras las demás cambian con el botón, y nada falla.

**5 · Los dos ceros, y acá deciden si alguien cobra.**
`lib/negocio/comision.ts:14-28` enumera los cuatro estados que ningún número de Sales puede colapsar: (1) sin porcentaje cargado → `null` con motivo; (2) porcentaje en 0 a propósito → `0` medido; (3) sin ningún resultado propio este mes → `null` con motivo; (4) con resultados propios y sin ventas → `0` medido. Y el aviso: «Un `?? 0` en cualquier punto de la cadena convierte (1) y (3) en (2) y (4). Y `Number(null)` es `0`, así que ni el tipo ni el motor avisan». Hoy Sales está en el estado (4) para el conteo de ventas —hay 7 resultados y ninguno es venta, así que «0 ventas» es un cero medido— y en el estado (3) para el revenue del setter y para la asistencia.

**6 · El denominador de una tasa de asistencia lleva `asistio is not null`.**
`lib/negocio/indicadoresDeCitas.ts:360-374`. El comentario dice por qué: «como el nulo es el caso normal —nadie cerró el intento todavía, y ninguna cita anterior a la `049` lo va a tener nunca— la tasa diría que no se presenta casi nadie. Sería una cifra plausible, alarmante y falsa». Con 0 de 321 citas con asistencia, hoy ese denominador es cero y la tasa es `null`.

**7 · «No-show» ya no es una opción de detalle de `nurture`, y no es un recorte.**
`lib/negocio/salidas.ts`, salida `nurture`: la opción «No-show» se sacó porque «cualquier inferencia 'salida de closer distinta de `no_show` ⟹ apareció' contaba ese caso como asistencia — un show rate inflado sin que nada fallara». Sales NO puede deducir asistencia a partir de la salida. Tiene que leer `citas.asistio`.

**8 · Un resultado es un INTENTO del closer, no una cita.**
`indicadoresDeCitas.ts` declara el conteo de no-shows como conteo y no como tasa, con este motivo: «su denominador tampoco sería el de las citas: un resultado es un intento del closer, que no es lo mismo». Las dos poblaciones —citas y resultados— no son intercambiables, y hasta que `resultados.cita_id` se llene no hay forma de cruzarlas.

**9 · El filtro de citas «alcanzables y no descartadas» es del sistema, no de una pantalla.**
Alcanzable = `ghl_calendario_id is not null` (las anteriores a la `038` están congeladas: «contarlas es contar una foto vieja como si fuera de hoy»). Descartado = el contacto tiene alguna de `ETIQUETAS_DE_DESCARTE` (`lib/ghl/contrato.ts:232-237`: `icp_rechazado`, `rechazado`, `rechazado_positivo`, `rechazado_negativo`, `no calificado`, `descalificado`). El commit `9931f4d` de este repositorio ya pagó el error de no aplicarlo: «La tasa de cancelación publicada sumaba dos hechos opuestos: 62,7 % era mitad descarte propio». En la ventana de 14 días el filtro deja 71 de 156 citas pasadas. Una tabla de closers que lo ignore cuenta más del doble de agendadas.

**10 · Los identificadores del CRM se resuelven por NOMBRE, nunca a mano.**
Toda medición de campos de este informe pasó por `negocio.campos_del_crm`. El motivo está en `lib/negocio/salidas.ts`: de 17 claves curadas que traía la referencia, **7 ya no existen en la subcuenta**, y escribir un campo que no existe se responde con un 200 y no hace nada.

**11 · Las opciones del catálogo hoy se guardan en `resultados.detalle` y NO se escriben al CRM.** Misma fuente. Si Sales quiere leer motivos de pérdida, los lee de `detalle`, no del campo «Motivo de descalificación» del CRM.

**12 · `resultados.detalle` es texto libre en la base y las filas viejas conservan su texto.** Reescribir el pasado para que coincida con el catálogo de hoy «sería inventar». Un agrupador de motivos tiene que tolerar valores que ya no están en el catálogo.

---

## 7 · Riesgos

**El riesgo que ya está ocurriendo: la pantalla es internamente consistente, y por eso engaña.**
Verifiqué la aritmética de `SalesView.jsx` y cierra perfecto: 44+63 = 107 agendadas; 31+43 = **74**, que es la tarjeta «Asistencias»; 10+8 = **18**, que es «Ventas»; $31,000+$24,200 = **$55,200**, que es «Revenue»; 18/74 = 24,3%, que es «Tasa de cierre 24%»; 21+13+12+10 = **56**, que es «56 llamadas sin cierre»; y 56+18 = 74, que cierra contra las asistencias. Alguien fabricó estos números con cuidado. Eso los hace más peligrosos que un número suelto: pasan cualquier revisión rápida, no se contradicen entre sí dentro de la pantalla, y once usuarios reales los están viendo desde hace meses. El único indicio de que son falsos está FUERA: el Executive dice 11 ventas y 31% de cierre para el mismo periodo.

**Poner una persona real al lado de un número inventado.** Jorge Veramendi aparece por nombre con 10 ventas y $31,000 que la base no respalda, y él mismo tiene acceso a la pantalla. Cualquier decisión de coaching, comisión o comparación entre closers que se tome mirando esa fila está tomada sobre ficción. Es el riesgo más urgente de los siete, porque el daño no es un número mal calculado: es una evaluación de desempeño.

**Publicar una tasa de cierre con menos de 10 eventos.** Con 7 resultados, un solo registro nuevo mueve la tasa 14 puntos. Con las 0 ventas de hoy, la primera venta que se registre llevaría la tasa de 0% a 12,5% de golpe. El propio proyecto ya pagó este error: la tasa de no-show se declaró como conteo porque medía 2 eventos, «una tasa sobre dos eventos no es una tasa — es un número que se mueve cincuenta puntos con el próximo registro».

**Confundir «nadie registró la asistencia» con «nadie asistió».** Es el riesgo más caro de todos, porque el número falso es alarmante y plausible. Si alguien calcula asistencia sobre las 321 citas sin el filtro `asistio is not null`, obtiene 0% de show rate y dispara una crisis que no existe. La migración 049 se escribió previendo exactamente esto.

**Sumar `venta_chica` con `venta`.** Un `sum(monto) from resultados where salida like '%venta%'` mezcla dos negocios con tickets de un orden de magnitud de diferencia. Hoy da cero porque no hay ninguna de las dos, así que el defecto entraría sin síntomas y aparecería recién cuando el setter registrara su primera venta chica — momento en el que el revenue del closer subiría sin que nadie hubiera vendido nada.

**Contar el revenue prometido como cobrado.** `acuerdo_sin_pago` pide monto igual que `venta`. Un filtro por «tiene monto» en vez de por `salida='venta'` mete plata comprometida dentro del revenue cobrado. `inicio.ts` y `comision.ts` ya lo hacen bien; una implementación nueva de Sales que no los mire lo va a hacer mal.

**Contar las citas sin el filtro de descarte.** En la ventana de 14 días, 81 de 156 citas pasadas pertenecen a contactos con etiqueta de descarte. Una tabla de closers que las cuente infla las agendadas y baja artificialmente la tasa de cierre. El commit `9931f4d` ya documenta este error exacto en otra cifra de este mismo producto.

**Deducir la asistencia a partir de la salida.** «Salida distinta de `no_show` ⟹ asistió» infla el show rate silenciosamente: un plantón real puede estar registrado como `nurture`. Hay que leer `citas.asistio` y nada más.

**Publicar el revenue sin el rótulo de «reportado».** El §5.4 lo exige explícitamente. Un `$55,200` sin ese rótulo afirma pagos verificados que nadie verificó.

**Cablear identificadores del CRM a mano.** Siete de diecisiete claves curadas ya no existen en la subcuenta, y una escritura a un campo inexistente devuelve 200 sin hacer nada. Cualquier medición de campos tiene que pasar por `negocio.campos_del_crm`.

**Un `?? 0` en cualquier punto de la cadena.** Colapsa «nadie cargó nada» con «el resultado es cero». En este departamento ese colapso decide cuánto cobra una persona: `comision.ts` distingue los cuatro estados justamente por eso, y ni el tipo ni el motor avisan cuando se rompe.

**Lo que se puede construir hoy, con evidencia, y lo que no.**
SÍ, hoy: (a) una tabla de closers con la columna «Agendadas» real, sobre `negocio.citas` + `negocio.closer_asignado`, con el filtro de alcanzables/no descartadas y con tres filas en vez de dos — 43, 21 y 5 citas en la ventana, más 2 sin asignar; el tercer closer queda por debajo del piso y hay que decirlo. (b) Un conteo de ventas y un revenue que hoy valen CERO MEDIDO, con el rótulo de «reportado por el closer» y con el testigo de que hubo 7 resultados registrados (si no hubiera ninguno, sería `null`, no cero). (c) El cruce con el ICP, que tiene 200 contactos con puntaje en la ventana y pasa el piso con holgura.
NO, hoy: tasa de cierre (7 eventos < 10), asistencias y show rate (0 de 321 citas con `asistio`), motivos de pérdida (1 fila, y dice «Otro»), cualquier cosa sobre la llamada de venta (`negocio.llamadas` vacía, 0 grabaciones en el CRM), y la asignación por tramo de ICP (la regla no existe).
Y la conclusión honesta que ordena todo lo demás: **el cuello de botella de Sales no es técnico.** El esquema está, el escritor está (`avanzar.ts`), la comisión está configurada al 10% para los tres closers, el mapeo al CRM está, y desde el 2026-09-14 hasta la asistencia tiene dónde guardarse. Lo que falta es que alguien registre: la tabla tiene 321 citas y 7 resultados, ninguno de ellos una venta. Hasta que esa proporción cambie, cualquier pantalla de Sales que muestre un número va a estar mostrando, otra vez, un número inventado.
