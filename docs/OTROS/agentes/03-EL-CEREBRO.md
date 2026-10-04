# El cerebro

> El agente global: el chat del Inicio, la caja «Pregúntale al cerebro sobre …» al pie de cada departamento
> y CONVERSACIONES. Un solo modelo con herramientas de sólo lectura sobre lo que ya mide `lib/negocio`, más
> las señales guardadas. En pantalla, «el cerebro»; en el código, `executive`. Requisitos `AG-40` a
> `AG-59`. La ficha es `fichas/F00-EL-CEREBRO.md`.

---

## De dónde sale

- `D-02`, `D-04`, `D-12`, `D-14`, `D-16`, `D-17`, `D-27` y `D-28` de `00-MAPA.md`.
- `docs/OTROS/futuro/el-cerebro.md`, el plan que ya existía, y Det:233-243, el orden de construcción del
  cerebro: modelo, herramientas de sólo lectura, la sesión de quien pregunta, conversaciones con RLS
  forzada, la Reunión cada mañana.
- Lo que el front ya dejó dibujado como «Próximamente»: `components/views/ExecutiveView.jsx:58`,
  `components/ConsultaAlCerebro.jsx:56-71` y el rótulo de CONVERSACIONES en `components/Nav.jsx`.
- Las reglas propias de Executive: consume y no recalcula, el dinero es del mes y es venta reportada,
  correlación no es causa (`docs/OTROS/estado actual/11-EXECUTIVE.md:433-466`).

---

## AG-40 · Las rutas

Cada ruta declara la `PANTALLA` de donde se usa (`T-01`), así que **el portero aplica el alcance solo**: el
paso 6 de `exigir` niega con `seccion_no_concedida` a quien no tiene concedida esa pestaña
(`lib/autorizacion/portero.ts:294`). No se reimplementa ese paso y no se toca `SIN_PANTALLA`.

| ruta | pantalla | GET | POST y DELETE | qué hace |
|---|---|---|---|---|
| `app/api/executive/route.ts` | `executive` | `tablero.ver` | `cerebro.usar` | GET: el estado del cerebro (`AG-52`), las conversaciones propias y los temas de la Reunión. POST: preguntar. DELETE: borrar un hilo propio |
| `app/api/<carpeta de la sección>/cerebro/route.ts`, una por sección con caja al pie | la de esa sección | la capacidad de la sección | `cerebro.usar` | Lo mismo, con el contexto de esa pantalla y los hilos de esa sección |

La carpeta es la de la API de cada sección: `acquisition`, `creative`, `conversion`, `auditoria`
(Conversation), `sales`, `leads-portal` (Leads › De GHL), `setter`, `closer`, `analizadores`, `tools`
(Radar, Funnel, Leads › De Radar y Plan de prospección) y `fundaciones` (ICP & Oferta). Todas delegan en
`lib/agentes/executive/preguntar.ts` y llevan su `conOrganizacion(` literal (`T-03`).

ADR-0304 compara sólo los GET de una pantalla contra la capacidad de su sección
(`pruebas/codigo/30-portero.test.ts:280-323`); el POST pide `cerebro.usar`, que no es de lectura, así que no
entra en `MUTACIONES_CON_CAPACIDAD_DE_LECTURA`.

La ruta del Inicio **baja la bandera** `sinOperacionesTodavia` de `executive`
(`lib/autorizacion/secciones.ts:219`): la línea pasa a ser un comentario de una línea (NE-33), el conteo
literal de `pruebas/codigo/90-fundaciones.test.ts:1263` pasa de 1 a 0 en el mismo commit, y nace la prueba
de base de la ruta, como manda la regla 31 (`docs/OTROS/estado actual/07-REGLAS-TRANSVERSALES.md:799-810`).

## AG-41 · Sólo se ofrece lo de las pestañas que la persona ve

Las secciones visibles salen de `seccionesConAlcance(permisos, alcance, desdeLaPrincipal)`
(`lib/autorizacion/secciones.ts:798`), con los datos que ya trae el contexto de la sesión. El modelo recibe
**sólo** las herramientas de esas secciones; una herramienta que no se ofrece no existe para él. Con la
caja del pie, las de la sección abierta van primero.

- Una herramienta que necesita **dos** secciones (`economia_del_negocio`) sólo se ofrece si se ven las dos.
- Una que sirve a dos (`cancelacion_de_citas`, en Conversation y en Sales) se ofrece si se ve cualquiera.
- Lo de Conversation sólo con `auditor.ver`: sale solo, porque es la capacidad de su sección
  (`D-17`).

## AG-42 · Las herramientas

**Regla de todas**: cada herramienta es un adaptador que llama a **la misma función, con los mismos
argumentos, que la ruta de su pantalla** («consume, no recalcula»). Recibe el `periodo` con una de las
cuatro claves de `lib/negocio/periodo.ts:83` como `enum`; otra clave se rechaza. Devuelve una **proyección
por lista blanca** (`AG-45`) con los avisos y los huecos de la función tal cual.

| herramienta | función | sección (capacidad) | como la ruta | qué viaja además |
|---|---|---|---|---|
| `embudos_de_acquisition` | `embudosDeAcquisition(periodo, zona)` | acquisition (`tablero.ver`) | `app/api/acquisition/route.ts:58-60` | `sinCostos`, `sinComparacion`, cobertura; tasas `null` bajo el piso |
| `calidad_de_piezas` | `calidadDelCreativo(periodo.dias)` | creative (`tablero.ver`) | `app/api/creative/route.ts:63` | el aviso si falta el campo del ICP |
| `rendimiento_de_piezas` | `rendimientoDelCreativo(periodo.dias)` | creative | `app/api/creative/route.ts:64` | sus huecos |
| `fatiga_de_piezas` | `fatigaDelCreativo(periodo.dias)` | creative | `app/api/creative/route.ts:65` | el umbral «no calibrado» |
| `recorrido_de_los_leads` | `recorridoDelLead(periodo.dias)` | conversion (`tablero.ver`) | `app/api/conversion/route.ts:59` | conteos, no tasas |
| `formulario_de_la_landing` | `embudoDelFormulario(periodo.dias)` | conversion | `app/api/conversion/route.ts:60` | sus huecos |
| `auditoria_de_agentes` | `laPantallaDelTecnico(noAudita)` | conversation (`auditor.ver`) | `app/api/auditoria/route.ts:92` | por qué no audita; **sin citas de conversaciones** |
| `cancelacion_de_citas` | `tasaDeCancelacion(periodo.dias)` | conversation o sales | `app/api/auditoria/route.ts:97`, `app/api/sales/route.ts:109` | sus avisos |
| `lead_flow` | `indicadoresDelLead(periodo.dias)` | conversation | `app/api/auditoria/route.ts:98` | aviso y latencias |
| `atribucion_del_lead` | `atribucionDelLead(periodo.dias)` | conversation | `app/api/auditoria/route.ts:99` | piso |
| `consumo_del_precall` | `consumoDelPrecall(periodo.dias)` | conversation | `app/api/auditoria/route.ts:100` | aviso |
| `sentimiento_por_flujo` | `sentimientoPorFlujo(periodo.dias)` | conversation | `app/api/auditoria/route.ts:104` | `null` bajo 10 |
| `dinero_del_mes` | `dineroDelMes(zona, sujeto)` | sales (`tablero.ver`) | `app/api/sales/route.ts:106` | **mes calendario**, que no gobierna el selector; «venta reportada» |
| `cadena_de_cierre` | `cadenaDeCierre(periodo.dias)` | sales | `app/api/sales/route.ts:110` | el aviso de citas que nadie registró |
| `ciclo_hasta_la_cita` | `cicloHastaLaCita(periodo.dias)` | sales | `app/api/sales/route.ts:111` | aviso de techo |
| `cierre_por_closer` | `cierrePorCloser(periodo.dias, catalogo)` | sales | `app/api/sales/route.ts:112` | `bajoElPiso`, `fueraDeLasFilas` |
| `economia_del_negocio` | nueva, `lib/negocio/economiaDelNegocio.ts`: `dineroDelMes` más la inversión del mismo mes con **la misma función de gasto** que Acquisition (C7-07) | sales **y** acquisition | — (A7-08 la asigna a Executive) | con 0 ventas, «no hay dato suficiente»; siempre «venta reportada» |
| `cohorte_de_leads` | `leadsDelPortal(periodo.dias)` | contacts (`tablero.ver`) | `app/api/leads-portal/route.ts:57` | la fila con sus 14 claves (`lib/negocio/leadsDelPortal.ts:114`), sin teléfono ni correo |
| `leads_del_scraper` | nueva, `lib/negocio/leadsDelScraper.ts`: **sólo agregados** (por fuente, con y sin contacto, enviados al CRM) | tools (`tools.ver`) | — | la ruta de la pantalla devuelve filas con correo y teléfono: el cerebro no las ve |
| `espia` | `busquedasDelEspia()` y `analisisDe(trabajo)` | tools | `app/api/tools/busquedas-del-espia/route.ts:25-27` | el texto del análisis, recortado |
| `fundaciones` | el estado de Fundaciones: qué entregables hay, qué paso del método falta, extractos acotados del ICP y la oferta | icp (`fundaciones.ver`) | `app/api/fundaciones/estado/route.ts` | lo que necesita de identidad (el alumno) lo resuelve la ruta |
| `colas_del_setter` | `colasDelSetter(zona)` | setter (`setter.ver`) | `app/api/setter/mi-dia/route.ts:53` | el territorio entero, como la pantalla; conteos por cola |
| `inicio_del_setter` | `cockpitDelSetter(…)` y `comisionDelSetter(quien, zona)` | setter | `app/api/setter/mi-dia/route.ts:67-68` | **sólo lo propio** |
| `pipeline_del_setter` | `pipelineDe('setter', {conCongelados:false})` | setter | `app/api/setter/pipeline/route.ts:34-35` | conteos por etapa |
| `mi_dia_del_closer` | `colasDelDia(zona, alcance)` con `alcanceDeQuienMira` | closer (`closer.ver`) | `app/api/closer/mi-dia/route.ts:81-83` | «mío» si el closer está vinculado |
| `inicio_del_closer` | `cockpitDelMes(…)` y `comisionDelMes(…)` | closer | `app/api/closer/mi-dia/route.ts:107-121` | sólo lo propio |
| `agenda_del_closer` | `agendaDelCloser('closer', zona, {dias, alcance})` | closer | `app/api/closer/agenda/route.ts:93-97` | la ventana de la agenda, como la pantalla |
| `pipeline_del_closer` | `pipelineDe('closer', {conCongelados:true, alcance})` | closer | `app/api/closer/pipeline/route.ts:37-40` | conteos por etapa |
| `llamadas_de_venta` | nueva, `lib/negocio/llamadasDeVenta.ts` (AG11) | analizadores (`analizadores.ver`) | — | objeciones por categoría con su tendencia, puntaje por closer, llamadas sin vínculo; las frases citables (`D-20`) |
| `llamadas_de_onboarding` | nueva, `lib/negocio/llamadasDeOnboarding.ts` (AG11) | analizadores | — | expectativas y riesgos agregados |
| `senales_abiertas` | `lib/agentes/senales/lectura.ts` | la de cada departamento con detector | — | gravedad, ventana, «umbral provisional» |
| `frescura` | `frescuraDe(tarea)` (`lib/negocio/frescura.ts:108`) | sólo las tareas que alimentan secciones visibles | — | una fuente parada se dice como tal |
| `estado_de_integraciones` | los estados de `resolverCredenciales`, sin valores | **sólo con `credenciales.ver`** | — | lo resuelve la ruta en identidad y lo pasa como dato |

Sin herramienta en la v1, y sin sugerencias en esas pestañas: **Conversation › Prompts** (el texto de los
prompts de los agentes del CRM; el cerebro lee los hallazgos del auditor, no los prompts) y el **monitor de
atribución**, que antes de publicarse tiene que pasar a días cerrados (`docs/OTROS/futuro/monitor-de-atribucion.md`;
llega con el piloto de Acquisition como señales).

## AG-43 · No inventar donde no hay dato

Los avisos y los huecos de cada función viajan tal cual. Debajo del piso, la respuesta dice «no hay dato
suficiente», **qué falta** y **dónde se carga** (Lienzo, pantalla «Estado especial · no hay dato
suficiente»: «0 de 333 … se registra en Sales · Closer, cita por cita»). Sin datos no se llama al modelo
(`AG-15` de `01`).

## AG-44 · El contexto de la caja del pie

`{origen:'pie', seccion, pestana, entrada, sub, periodo?}`, armado con lo que la caja ya sabe
(`components/ConsultaAlCerebro.jsx`) más el período que está mirando la pantalla. El servidor no confía en
él: la sección ya la validó el portero, y el período se valida contra el `enum`. La caja nombra la entrada
abierta con el dato, no a mano.

## AG-45 · Proyecciones por lista blanca

Cada adaptador declara **exactamente** qué claves devuelve, como la fila del Leads Portal
(`lib/negocio/leadsDelPortal.ts:114`). Con una lista negra, lo nuevo aparece solo (regla 33). Una prueba de
juego exacto de claves por herramienta, más una negativa: ningún resultado lleva `@` ni un teléfono. El
texto libre de personas (notas, mensajes, transcripciones) no viaja; las frases de llamadas sólo viajan en
`llamadas_de_venta`, a quien tiene `analizadores.ver` (`D-20`).

## AG-46 · La forma de la respuesta

El modelo contesta con la herramienta `responder`, ofrecida con `strict: true` y pedida por el prompt. **No
se puede forzar**: `claude-sonnet-5-5` rechaza `tool_choice` de tipo `tool` o `any` con un 400 (`06`, AG-93).
Cómo se asegura la salida —`responder` con `tool_choice` `auto`, o el formato de la salida
(`output_config.format`) en la última ronda— y qué se hace con una respuesta que no la usó (`IA-ESTRUCTURA`)
lo decide AG5. La forma:

```text
conclusion        una o dos frases, la respuesta primero
cifras[]          { valor, que_es, muestra, periodo, fuente, ev }
confianza         alta | media | baja, con su porqué
areas[]           las secciones de donde salió, navegables (A7-22)
recomendaciones[] { texto, requiere_validacion_ejecutiva, ev[] }
no_hay_dato[]     { falta, donde_se_carga }
siguientes[]      { tipo:'abrir', seccion, pestana?, contexto? }
```

Guardas de las recomendaciones (`docs/acquisition/12-QUIEN-DECIDE-QUE.md`, A7-20, Arq §14):

- lo que toca presupuesto lleva `requiere_validacion_ejecutiva`;
- no se escala ni se ordena por costo por lead sin la advertencia de que la escala se decide por calificado;
- «¿Qué campaña escalo?» se contesta con cifras y la comparación, no con un nombre;
- las causas son hipótesis, nunca un diagnóstico.

## AG-47 · Una cifra sin respaldo se quita

Cada resultado de herramienta recibe un id `ev-n` con su proyección (hasta 20 filas, el total, los avisos).
La arma el adaptador, no el modelo. Cada cifra de `responder` dice su `ev`; el servidor comprueba que exista
y que el valor aparezca en esa evidencia, con tolerancia de redondeo. **La que no pasa se quita** y la
respuesta lo dice («una cifra sin respaldo se quitó»). Es el patrón de
`lib/analizadores/nucleo/prospect-card.ts:17-19`: lo detectado sin cita se degrada. Lo mismo para las
recomendaciones y para los nombres de herramienta.

## AG-48 · La evidencia va dentro de la respuesta

Un desplegable `<details>` dentro de la burbuja, no un panel aparte (`D-28`): por cada `ev`, las filas
reales con «mostrando X de N» (A7-29). La evidencia se guarda como **ids y cifras**; los nombres se resuelven
al mostrar, así el hilo guardado no acumula datos personales.

## AG-49 · Los siguientes pasos navegan y pasan contexto

Cada paso `abrir` se valida contra las secciones visibles y se dibuja como botón. Al tocarlo, el navegador
usa `irALaVista` y `lib/agentes/traspaso.ts`, con el molde de `lib/tools/del-espia-al-scraper.ts:13-19`
(`sessionStorage` y un evento, leído una sola vez por la pantalla que lo recibe).

## AG-50 · Sugerencias por entrada

Sólo donde están declaradas; sin sugerencias propias no se muestra ninguna (A7-21). Las de Acquisition son
las de A7-20 («¿Qué campaña escalo?», «¿Cuál trae el ICP que cierra?», «¿Hay fatiga en algún anuncio?»).
Las de cada entrada están en su ficha.

## AG-51 · Las conversaciones

- **Son del autor**: la lectura filtra siempre por `usuario_id`; un hilo ajeno da 404 (`D-14`).
- **Título**: la primera pregunta, recortada.
- **Memoria**: el hilo entero, dentro de un presupuesto de tokens; los turnos viejos viajan reducidos a su
  conclusión y sus cifras (`T-15`). El contexto de la empresa se vuelve a leer siempre: nada de lo que el
  modelo «recuerda» reemplaza a una herramienta.
- **El historial es de sólo agregar** («preserved thinking» de `claude-sonnet-5-5`): dentro de las rondas de
  una pregunta, cada turno vuelve tal cual llegó —bloques `thinking` incluidos— y las instrucciones y las
  herramientas no cambian; cada pregunta nueva arranca con los turnos anteriores reducidos y **sin** sus
  bloques de pensamiento. Editar un turno anterior invalida los bloques que siguen, y en las cuentas creadas
  desde el 2026-08-31 eso es un 400.
- **No vencen**: el autor las borra. Se borran en cascada con la persona.
- Cada hilo guarda su **origen** (`inicio`, `pie`, `reunion`) y su contexto.
- **Quien no ve el Inicio** también guarda sus hilos de la caja del pie, y el panel que sube le muestra la
  lista de sus hilos de esa sección, con borrar.
- Sin «＋» para adjuntar y sin URL para compartir.

Tablas `negocio.conversaciones_del_executive` y `negocio.mensajes_del_executive`, migración `070`.

## AG-52 · El estado del cerebro

Una unión, nunca un booleano (`T-13`):

| estado | qué ve la persona |
|---|---|
| `listo` | la caja habilitada |
| `sin_permiso` | no tiene `cerebro.usar`: la caja no se dibuja |
| `sin_llave` | «El cerebro necesita la llave de IA de tu empresa.» Con `credenciales.ver`, un enlace a Ajustes; sin ella, «pídesela a quien administra» |
| `llave_ilegible` | lo mismo, con el motivo |
| `delegacion` | «Estás mirando otra empresa: el cerebro no responde aquí.» |
| `tope` | «Llegaste al tope de hoy (N preguntas).» Con la hora a la que se renueva |

## AG-53 · Topes

50 preguntas por persona y 300 por empresa por día local, ajustables por el Admin en Ajustes (`D-16`). El
detalle está en `06`.

## AG-54 · Bajo delegación

El cerebro se apaga y lo dice (`D-17`). El POST lo rechaza el servidor con `contexto.mirandoOtraOrganizacion`
(`lib/autorizacion/sesion.ts:127`), no sólo la pantalla.

## AG-55 · La mascota

La decide el servidor a partir de la evidencia, no el modelo (`T-14`), con los estados que ya tiene el
elemento, en su primera línea de documentación (`public/brand/mascota/aria-mascot.js`, fuera de las carpetas que audita la prueba 101):

| momento | estado |
|---|---|
| esperando la respuesta | `pensando` |
| la respuesta cita una señal crítica o alta | `alerta` |
| la conclusión quedó respaldada | `hallazgo` |
| `IA-CONEXION`, `IA-TIEMPO` o `IA-SATURADO` | `sin-conexion` |
| lo demás | `neutral` |

**El avatar va sólo en la primera burbuja** de cada respuesta, y sólo la mascota del turno actual queda viva:
cada instancia con seguimiento del cursor lleva su propio bucle por cuadro.

## AG-56 · «@ agente», sólo en el Inicio

Lista los **agentes que crean** que la persona ve: hoy ICP & Oferta, Tu landing y Tu VSL; Copywriter cuando
exista. Elegir uno y escribir el pedido abre esa herramienta con el pedido **cargado en su campo, sin
enviarlo** (`lib/agentes/traspaso.ts`). No hay «@ agente» en la caja del pie (`D-12`).

## AG-57 · El panel que sube

La respuesta de la caja del pie se abre en un panel que sube sobre el cuerpo del departamento (`D-12`), con
`components/Ventana.jsx` o su misma mecánica de foco y Escape, y con **ids nuevos**: la prueba 156 prohíbe
`askPanel`, `askScrim`, `askTrigger` y los demás del prototipo
(`pruebas/codigo/156-cierre-de-los-overlays.test.ts:38`), y la 162 prohíbe las clases `.ask` y `.side` en el
armazón.

## AG-58 · En el teléfono

Se ve el chat del Inicio. La caja del pie y su panel no (`D-27`).

## AG-59 · Sin búsqueda web

El cerebro no busca en la web: la búsqueda queda sólo en Research (`D-25`). Lo que no está en las
herramientas, no lo sabe, y lo dice.

---

## Lo que no se pudo verificar

- Si la caché de instrucciones del cerebro se va a leer en la práctica: la de los Analizadores se escribe y
  nunca se lee (`00-MAPA.md`, lo medido en el Paso 0). Se mide en AG7 con `uso_de_ia`.

## Preguntas abiertas

Ninguna para el usuario. Las sugerencias concretas de cada entrada se proponen en las fichas y se pueden
cambiar sin tocar la arquitectura.
