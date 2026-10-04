# Los agentes de IA de Comando Central — mapa

> Plan del **2026-10-04**: el cerebro (el agente global del Inicio, `executive` en el código) y un agente
> por tipo en cada inteligencia, enganchados al front de la segunda edición. Esta carpeta dice **todo lo
> que se va a construir, cada decisión y cada riesgo, antes de tocar el código**. Prefijo de los
> requisitos: `AG-`. Estado: **AG0 · documentos**, esperando dos OK del usuario (el conjunto de preguntas
> de `07-LA-EVALUACION.md` y la especificación de Conversion de `fichas/F04-CONVERSION.md`).

---

## De dónde sale

- **Las decisiones del usuario del 2026-10-03 y 2026-10-04**, tomadas pregunta por pregunta después de leer
  el código y los documentos de producto. Están abajo, numeradas `D-01` a `D-33`.
- **Los documentos de producto**, que viven **fuera del repositorio** y se citan sin copiarse (el
  repositorio es público):
  - «CC_Arquitectura_Funcional» (se cita **Arq:línea**), el borrador funcional de AIOS: departamentos de
    inteligencia, la alerta de 14 campos, el Supervisor de Conversation, el Attribution Monitor;
  - «COMANDO-CENTRAL-ORGANIZACION-DETALLE» del 2026-09-30 (se cita **Det:línea**): la organización nueva,
    cada herramienta, el cerebro, la Reunión de hoy y el orden de construcción;
  - «Nueva organización (resumen)» (se cita **Res:línea**);
  - el lienzo «Departamentos por dentro» (se cita **Lienzo, pantalla “…”**): ocho pantallas, entre ellas
    «Inicio · el cerebro», «Sales · Closer», «Conversación · respuesta con evidencia» y «Estado especial ·
    no hay dato suficiente»;
  - la **Simulación** de la segunda edición (se cita **Simulación**), que es la que sigue el front actual.
- **Los contratos que cada departamento ya escribió** y que son, sin decirlo, el «contrato de comunicación
  entre agentes» que Arq deja pendiente: `docs/acquisition/06`, `07`, `11`, `12` (prefijos A6, A7, A11,
  A12), `docs/creative/06`, `07`, `11` (C6, C7, C11), `docs/conversion/06`, `07` (CV6, CV7),
  `docs/sales/07`, `08` (S7, S8) y `docs/leads-portal/08` (LP08).
- **Las metodologías del ARIA anterior** (`aria-ia-brain/app-next/public/skills/`), que se portan (D-18).
- **El código**, medido el 2026-10-04 sobre `main` en `97fc905`, y **producción**, medida ese mismo día
  sólo con lectura (ver «Lo medido en el Paso 0»).

La regla que ordena la estructura (`docs/OTROS/nueva-estructura/00-MAPA.md:21-22`) ordena también a los
agentes: **Research define, Marketing crea, Systems mide, Sales opera y Client Success retiene.** De ahí
salen los tipos de `01-LA-ARQUITECTURA.md`.

## Las decisiones del usuario (2026-10-03 y 2026-10-04)

| id | tema | decisión |
|---|---|---|
| `D-01` | Reparto | Un agente **por tipo** más el cerebro: los que **CREAN** (Research y Marketing), los **DETECTORES** que miden (Acquisition, Conversion, Conversation, Creative Insights), los asistentes de **OPERACIÓN** (Sales) y los de **RETENCIÓN** (Client Success) |
| `D-02` | Quién paga | La **llave de IA de cada empresa** (ADR-0908 intacto). Sin llave, la caja se deshabilita y dice el motivo con un enlace a Ajustes; todo lo que sale de reglas funciona igual |
| `D-03` | Leer o actuar | La v1 **lee y navega** (botones que abren la pantalla y pasan contexto) y **recomienda** qué hacer. Las acciones con permisos vienen después, todavía sin definir; el diseño les deja el lugar |
| `D-04` | El cerebro | **Un solo modelo con herramientas de sólo lectura** sobre `lib/negocio` que además **lee las señales guardadas**. Sólo ofrece lo de las pestañas que la persona ve |
| `D-05` | Alcance | **Se diseña todo y se construye lo vivo**: el cerebro y lo que hoy ya mide o crea. Copywriter, Content Studio, Seguimiento de clientes y Leads › Todos quedan sólo diseñados |
| `D-06` | Orden | La capa común, después el cerebro de sólo lectura, después **Acquisition como piloto** de los detectores, después el resto |
| `D-07` | Trazabilidad (Arq §16.2) | Se construye igual. Donde falte el dato, se responde «no hay dato suficiente» diciendo qué falta |
| `D-08` | Carpeta | `docs/OTROS/agentes/`, con `00-MAPA` y prefijo `AG-` |
| `D-09` | Detectores | Corren **cada mañana a la hora local de la empresa**, guardan las señales con su evidencia y el **Plan de acción** con sus recomendaciones. Las preguntas las contesta el cerebro leyéndolas |
| `D-10` | Contrato | **Una sola tabla común, `negocio.senales`**, con la alerta de 14 campos de Arq. Ciclo: abierta → vista → resuelta o descartada (con motivo), o cerrada sola. Gravedad: crítica, alta, media, info. **Dos niveles**: lo local se ve en la pantalla del departamento; lo que «requiere validación ejecutiva» sube a la Reunión y al cerebro |
| `D-11` | Umbrales | **Provisionales y declarados** desde el primer día. El **Admin de cada empresa** los pasa a firmes, y queda quién y cuándo |
| `D-12` | El front | La caja del pie la contesta **el cerebro con el contexto** de la pantalla, en un **panel que sube** sobre el cuerpo. La caja lleva **sólo la pregunta**: sin «@ agente» y sin filtro de áreas. «@ agente» vive en el Inicio y lista **los agentes que crean**; elegir uno abre su herramienta con el pedido cargado. El comentario de la cabecera sale **de reglas, sin modelo** |
| `D-13` | Reunión de hoy | Sus temas salen de **señales y reglas medibles**; el modelo sólo **ordena y redacta**. Sin llave, texto armado con plantillas. Tocar un tema abre una conversación sobre él |
| `D-14` | Conversaciones | Son **de quien las escribió**. La memoria es **sólo la del hilo**. No vencen: **el autor las borra**. El título es la primera pregunta. Sin «＋» para adjuntar y sin URL para compartir en la v1 |
| `D-15` | Modelos | Una constante por agente. **Sonnet 5.5** (`claude-sonnet-5-5`) por omisión y **Haiku 4.5** (`claude-haiku-4-5-20251001`) para clasificar o rutear. Los agentes que ya existen se quedan en Sonnet 5 y se evalúan después |
| `D-16` | Uso y topes | **Una tabla de uso por llamada**, también para los agentes que ya existen; el costo en USD cuando alguien confirme la tarifa. Topes de **50 preguntas por persona y 300 por empresa por día**, que el Admin ajusta. Respuestas **enteras**, sin streaming |
| `D-17` | Permisos y datos | Capacidad nueva **`cerebro.usar`**. Lo de Conversation sólo con `auditor.ver`. El cerebro trabaja con **agregados y listas sin teléfono ni correo**; los datos de una persona sólo los ve un agente por contacto (el Brief del closer). **Bajo delegación el cerebro se apaga** |
| `D-18` | Herramientas que crean | Las **dos columnas** (agente a la izquierda, entregable a la derecha) quedan **para después**. Copywriter es **un solo agente** (bio, guiones, venta directa, objeciones) que lee ICP y oferta, el Espía y las objeciones de las llamadas; para el DM por palabra clave **da instrucciones**, no toca GHL. Las metodologías del ARIA anterior **se portan**. Funnel suma, en diseño, la precall y el VSL de gracias. Content Studio: sólo diseño |
| `D-19` | Brief del closer | **Se construye**. Se genera al abrir la cita; vive en la cola «TUS CITAS DE HOY» de Mi Día, con las marcas «BRIEF LISTO» y «SIN FORMULARIO», y en la ficha. Cuatro secciones, como el Lienzo. La objeción probable sale del formulario o, si no alcanza, es la más frecuente de las llamadas, **marcada como tal** |
| `D-20` | Llamadas | Agregados sin modelo más el **vínculo** con el contacto y el closer. **Haiku clasifica cada objeción una vez**. «Llamadas sin usar» quiere decir **sin vínculo**. La evidencia puede citar frases (minuto, enlace a tl;dv, si se ganó) **sólo para quien tiene `analizadores.ver`** |
| `D-21` | Sales y Client Success | El «setter de IA» es LeadFlow, y lo supervisa el auditor; el agente del Setter asiste con el alcance de esa pantalla. El del Closer usa «mío» cuando aplica. Los dos sólo leen datos. Seguimiento de clientes: sólo diseño |
| `D-22` | Acquisition | Piloto **con todo lo escrito**: A6, la alerta de 14 campos y el monitor de atribución. Vuelven el botón «Plan de acción» y la tarjeta de Señales |
| `D-23` | Conversion, Conversation, Creative | Conversion: se escribe su especificación y **el usuario la valida** antes de construir. Conversation: el auditor se conserva y sus hallazgos **se traducen a `issue_source`**; la auditoría de voz queda fuera. Creative: **después de Acquisition**, con el mismo molde |
| `D-24` | Radar, Leads, Closing | «Enviar hallazgos a Copywriter» se diseña. Leads no tiene agente: el cerebro lee. Closing no tiene detector: el cerebro calcula ROAS y CAC cuando haya ventas |
| `D-25` | Fuera de la v1 | Iniciativas, Decisiones, Mejora del sistema, Team Execution, el modo sistema, un agente de Monitoreo y el nivel 3. Búsqueda web sólo en Research. Permisos por sección, como hoy |
| `D-26` | Voz y nombre | **Tú neutro**. Ahora pasan Fundaciones y el Espía; el auditor y los Analizadores, cuando se evalúen. En pantalla, «**el cerebro**»; en el código, **`executive`** |
| `D-27` | Teléfono | Se ve el chat del Inicio. La caja del pie, su panel y el comentario de la cabecera no |
| `D-28` | La respuesta | Conclusión primero; cifras con muestra, período y fuente; botones de siguiente paso; «no hay dato suficiente» cuando corresponde; **la evidencia desplegable dentro de la respuesta** (no en un panel aparte); la mascota con estados y el avatar sólo en la primera burbuja |
| `D-29` | Diseño | La Simulación manda en la estructura; el Lienzo, en los interiores con agente |
| `D-30` | Incidentes | Todo fallo de un agente queda en Incidentes, también los del auditor y los Analizadores |
| `D-31` | Validación | **Base sembrada** y un conjunto de preguntas por agente, que se escribe acá y el usuario aprueba. La evaluación real va con la **llave de ARIA**, **pidiendo el OK cada vez** con el número de llamadas. Nunca con la llave de un cliente |
| `D-32` | Acuerdo de datos | El acuerdo de tratamiento de datos con los clientes lo ve el equipo; queda como deuda abierta |
| `D-33` | Paso 0 | Autorizado: traer `origin/main` y volver a medir producción, sólo con lectura |

## Las decisiones técnicas

Son del plan, no del usuario, y se pueden corregir. Varias salen de dos revisiones adversariales del diseño
(una con la lente de las reglas de la plataforma y otra con la de fidelidad a las decisiones). Cada una está
desarrollada en el documento que se indica.

| id | decisión | dónde |
|---|---|---|
| `T-01` | **Rutas por pantalla, sin reimplementar el portero.** El Inicio tiene `app/api/executive/route.ts` (`PANTALLA='executive'`). La caja del pie de cada sección habla con una ruta fina en la carpeta de la API de esa sección, con `PANTALLA` de esa sección. Así el paso 6 del portero (`lib/autorizacion/portero.ts:294`) aplica el alcance solo y no hace falta tocar `SIN_PANTALLA` | `03` |
| `T-02` | **NE-33**: la única línea de `lib/autorizacion/secciones.ts` que cambia es la bandera de `:219`, que pasa a ser un comentario de una línea. No se suma ni se quita ninguna | `03`, `08` |
| `T-03` | **La identidad sólo en los archivos de ruta.** La llave y el estado de las integraciones se resuelven con `conIdentidad` en la ruta; cada ruta nueva entra en `ARCHIVOS_AUTORIZADOS` (y en `CRUZAN_LOS_DOS_DOMINIOS` si corresponde) y lleva el literal `conOrganizacion(`. Nada bajo `lib/agentes/**` importa `conIdentidad` | `01`, `05` |
| `T-04` | **Transacciones cortas**: ninguna queda abierta mientras se espera al modelo, y las herramientas corren en serie (el grupo de conexiones tiene 5, `lib/datos/capa.ts:83`) | `01` |
| `T-05` | **El transporte es común y el cuerpo es de cada agente**: `lib/agentes/llamada.ts` sobre `pedirExterno`, con una sola constante de dirección y versión de la API | `01`, `06` |
| `T-06` | **Las herramientas son adaptadores**: llaman a la misma función, con los mismos argumentos que la ruta de su pantalla, y proyectan por **lista blanca** | `03` |
| `T-07` | **La respuesta tiene forma fija** y el servidor la valida: una cifra que no aparece en su evidencia se quita y se dice | `03` |
| `T-08` | **Siguientes pasos y traspaso** con el molde de `lib/tools/del-espia-al-scraper.ts` | `03` |
| `T-09` | **Los topes** cuentan preguntas desde la medianoche local, bajo `select … for update` sobre la fila de topes; una pregunta fallida no cuenta | `06` |
| `T-10` | **El ciclo de vida de una señal**: la huella de una señal descartada la suprime mientras la condición siga; `sin_medicion` cuando la fuente se apaga; «vista» la marca quien la abre; las de validación ejecutiva sólo las resuelve el Admin | `02` |
| `T-11` | **Umbrales en el código, firmas en una tabla** | `02` |
| `T-12` | **La tarea `senales` del cron**: minuto 23, sólo a las empresas a las que les toca su mañana, sin sellar a las demás, con presupuesto propio, plantillas primero y redacción después | `02` |
| `T-13` | **El estado del cerebro es una unión** (`listo`, `sin_permiso`, `sin_llave`, `llave_ilegible`, `delegacion`, `tope`), nunca un booleano | `03` |
| `T-14` | **La mascota la decide el servidor**, a partir de la evidencia y no del modelo | `03` |
| `T-15` | **La memoria es el hilo entero** dentro de un presupuesto de tokens; los turnos viejos viajan reducidos a su conclusión y sus cifras | `03` |
| `T-16` | **La cabecera y la Reunión no usan el modelo para detectar.** La cabecera la sirve el GET de cada departamento | `04` |
| `T-17` | **La traducción a `issue_source`** de los hallazgos del auditor | `02` |
| `T-18` | **Las categorías de objeción** las pone Haiku una vez, al analizar la llamada, y se guardan | `fichas/F14` |
| `T-19` | **El vínculo de las llamadas se calcula al leer**, sin tabla nueva | `fichas/F14` |
| `T-20` | **El Brief es más estricto que la ficha**: exige la sección `closer`, respeta «mío» y se apaga bajo delegación | `fichas/F13` |
| `T-21` | **Las acciones futuras quedan sólo como tipo**: `accion` existe en el contrato y la v1 la rechaza | `01` |
| `T-22` | **Cada capacidad entra con su primera ruta**: `cerebro.usar` en AG5; `senales.resolver`, `senales.validar` y `umbrales.firmar` en AG9 | `05` |
| `T-23` | **Claves foráneas**: conversaciones con el autor en cascada; `uso_de_ia` con `on delete set null`, como la `068`; los autores de cierres y firmas con su frase en `QUE_LO_IMPIDE` | `05` |
| `T-24` | **Las ventanas emergentes usan `components/Ventana.jsx`**, el único componente de la casa, con ids nuevos | `03`, `04` |
| `T-25` | **Bajo delegación, sólo lectura**: chat, ciclo de vida de señales, firmas, topes y Brief apagados y rechazados en el servidor; señales, plan y cabecera se leen | `05` |
| `T-26` | **La evaluación real va por guion** (`scripts/evaluar-agentes.mjs`), que sale por `pedirExterno` y no corre sin `--confirmo N` | `07` |

## Índice

| archivo | qué dice |
|---|---|
| [01-LA-ARQUITECTURA.md](01-LA-ARQUITECTURA.md) | Los tipos de agente, el ciclo de una llamada, la capa común `lib/agentes/`, las tablas nuevas y la frontera con lo que ya existe |
| [02-EL-CONTRATO-DE-SENALES.md](02-EL-CONTRATO-DE-SENALES.md) | La tabla `negocio.senales`, su ciclo de vida, la gravedad, los umbrales, el Plan de acción de cada departamento y la tarea diaria |
| [03-EL-CEREBRO.md](03-EL-CEREBRO.md) | Las rutas, las herramientas una por una, la forma de la respuesta, la evidencia, las conversaciones, la mascota y «@ agente» |
| [04-LA-REUNION-Y-LA-CABECERA.md](04-LA-REUNION-Y-LA-CABECERA.md) | La Reunión de hoy, el contador de la barra y el comentario de la cabecera |
| [05-PERMISOS-Y-PRIVACIDAD.md](05-PERMISOS-Y-PRIVACIDAD.md) | Las capacidades nuevas, la delegación, los datos personales, las listas de autorizados |
| [06-MODELOS-USO-TOPES-E-INCIDENTES.md](06-MODELOS-USO-TOPES-E-INCIDENTES.md) | El modelo de cada agente, la tabla de uso, los topes y los incidentes |
| [07-LA-EVALUACION.md](07-LA-EVALUACION.md) | La base sembrada, el conjunto de preguntas por agente (para aprobar), la rúbrica y el guion de evaluación real |
| [08-LAS-ETAPAS.md](08-LAS-ETAPAS.md) | P0 a AG16: qué toca cada etapa, sus pruebas, cómo se verifica y los hitos de push |
| [09-LO-QUE-SE-ROMPE-EN-SILENCIO.md](09-LO-QUE-SE-ROMPE-EN-SILENCIO.md) | Cada riesgo, cómo se vería y qué lo vigila |
| [10-LO-QUE-QUEDA-PARA-DESPUES.md](10-LO-QUE-QUEDA-PARA-DESPUES.md) | Lo que esta fase deja afuera, con su motivo |
| [fichas/](fichas/) | Una ficha por agente o pieza, con la misma plantilla: F00 el cerebro a F19 CONVERSACIONES |

Orden de lectura sugerido: este mapa, `01`, `03`, `02`, la ficha que interese, `08`.

## Glosario

- **El cerebro.** El agente global. En pantalla se llama así; en el código, `executive` (rutas, tablas,
  carpetas, componentes). La única excepción es la capacidad `cerebro.usar`, que el usuario nombró así.
- **Agente.** Quien **crea** algo con el modelo: el entrevistador de Fundaciones, Copywriter, el Brief del
  closer. «Agente» ya nombra también a LeadFlow y AppFlow, que son bots del CRM de cada cliente y no de la
  plataforma; cuando haga falta distinguir, se dice «el agente del CRM».
- **Detector.** Quien **mide** con reglas y escribe señales. No decide: recomienda una revisión
  (`recommended_review`, A11-05).
- **Señal.** Una fila de `negocio.senales`: algo medido que cruzó un umbral, con su conteo, su ventana, su
  entidad y su evidencia.
- **Plan de acción.** Las recomendaciones del día de un departamento, en el formato que ese departamento
  escribió (A6, C6, CV6), armadas desde sus señales.
- **Tema.** Una tarjeta de la Reunión de hoy.
- **Brief.** La preparación de una cita para el closer.
- **Umbral provisional y firme.** Provisional es el valor que vive en el código y se muestra marcado. Firme
  es el que firmó el Admin de la empresa, con fecha.
- **Evidencia.** Lo que una herramienta devolvió, recortado y guardado como foto, con un id `ev-n` que la
  respuesta cita.

## Lo medido en el Paso 0 (2026-10-04)

Con `node --env-file=.env.supabase scripts/supabase.mjs leer`, sólo agregados y booleanos, sin nombres ni
identificadores:

| qué | resultado |
|---|---|
| Última migración aplicada | `068_el_analisis_del_espia`. La próxima libre es la **069** |
| Empresas | 13, de las cuales 11 activas y 10 activas con al menos una persona |
| Con llave de IA | **5 de 11 activas**, incluida la organización principal (la de ARIA) |
| Zona horaria | **11 de 13 en `UTC`**, que es el valor por omisión y quiere decir «nadie lo dijo» (`components/ajustes/Empresas.jsx:108-110`); una en Lima y una en Santo Domingo |
| Roles | 3 roles globales: `usuario` con 19 capacidades, `administrador` con 25, `superadministrador` con las 34 del catálogo |
| Capacidades del cerebro | Ninguna todavía (`cerebro.%`, `senales.%`, `umbrales.%`) |
| Incidentes, 30 días | Ninguno |
| Auditor, 30 días | 66 análisis |
| Analizadores, 30 días | 23 análisis y 39 fichas; 318.050 tokens de entrada, 64.751 de salida, 80.062 escritos en caché y **0 leídos de caché**; costo `null` |
| Llamadas del Analizador | 122 en total |
| Citas creadas, 30 días | 126 |
| Anuncios | 79 |
| Hallazgos del auditor | 26 |
| Análisis del Espía guardados | 0 (la tabla es del 2026-10-03) |

Tres consecuencias para el plan:

1. **La «mañana local» de 11 empresas es hoy la mañana de UTC**, o sea la madrugada de América. Antes de
   AG8, alguien de ARIA tiene que cargar la zona real de las empresas activas en Ajustes › Empresas (la
   cambia `organizaciones.editar`, `app/api/admin/organizaciones/[id]/route.ts:71`). No es un defecto del
   plan: es un dato que falta, y la tarea lo va a hacer visible.
2. **La caché de las instrucciones de los Analizadores se escribe y nunca se lee.** El cerebro marca
   `cache_control` (T-05); conviene medir en AG7, con `uso_de_ia`, si la suya sí se lee.
3. **La evaluación real tiene con qué correr**: la organización principal tiene llave (D-31).

## Lo que corre en paralelo y hay que coordinar

- **La rama `feature/icp-oferta-v2`**, de otra persona del equipo, sin integrar a `main` al 2026-10-04.
  Cambia el agente de ICP & Oferta a fondo: pasa su voz a **tú neutro** con una prueba propia («un solo
  tono»), sube `VERSION_DEL_AGENTE` a 3 y toca `lib/fundaciones/{conversacion,prompts,relleno,
  operaciones,herramientas,mercado}.ts`. Eso cambia dos etapas de este plan:
  - **AG3 (la voz)** no reescribe Fundaciones: esa parte de D-26 la hace la rama. AG3 queda para el Espía y
    para lo que la rama no cubra, y se hace **después** de que la rama se integre.
  - **AG2 (registrar el uso)** toca en Fundaciones sólo el punto donde vuelve la respuesta del modelo, y se
    hace después de la integración, o con un `pull` y su conflicto resuelto a mano.
  - Además, la rama numera pruebas nuevas del 184 al 192, que en `main` ya existen con otros nombres. Las de
    este plan empiezan en la **198**, así que no se pisan.
- **Otra persona empuja a `main`** (la `068` y la región `gru1` llegaron así). Cada etapa empieza con
  `git pull --rebase --autostash` y vuelve a verificar el número libre de migración.

## Estado

| etapa | estado |
|---|---|
| P0 · Medición | **Hecho** el 2026-10-04: `pull` a `97fc905` y la tabla de arriba |
| AG0 · Documentos | **En curso**: esta carpeta |
| AG1 a AG16 | Sin empezar. Ver `08-LAS-ETAPAS.md` |

## Cómo se cita

- El código y los documentos del repositorio: `` `archivo:línea` `` o `` `archivo:desde-hasta` ``, entre
  acentos graves. La prueba `pruebas/codigo/101-las-citas-de-los-documentos.test.ts` audita esta carpeta
  (que una cita no pase del final de su archivo) desde el día en que nace.
- Lo que sólo existe en una rama o en un commit: `@commit`.
- Los documentos de producto: **Arq:N**, **Det:N**, **Res:N**, **Lienzo, pantalla “…”**, **Simulación**.
  No tienen ruta en el repositorio y la prueba 101 no los ve.
- Los requisitos de esta carpeta: `AG-nn`; los de las fichas, `AG-Fnn-k`; las decisiones, `D-nn` y `T-nn`.
