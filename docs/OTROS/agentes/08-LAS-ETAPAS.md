# Las etapas

> P0 a AG16: qué toca cada etapa, qué migración y qué capacidad trae, qué pruebas nacen o cambian (cada una
> vista en rojo con su mutación), qué documentos se ponen al día y cuándo se empuja.

---

## Las reglas de todas las etapas

- **Un commit por etapa.** Antes: `git pull --rebase --autostash` (los dos `.zip` del árbol de trabajo
  nunca se preparan), `npm run build`, `npm run tipos` y la suite en `America/Lima`, `UTC` y `Asia/Tokyo`.
- **Toda prueba nueva se ve primero en rojo** con la mutación que dice su fila, y se vuelve a ver verde.
- **Las etapas marcadas «grande» pasan por una revisión adversarial** antes del commit.
- **Los documentos se ponen al día en la etapa que cambia lo que describen**, y las citas `archivo:línea`
  que se corren se reapuntan.
- **Las migraciones se aplican a producción antes del push** (`node --env-file=.env.supabase scripts/db.mjs
  migrar`), verificando antes que el número siga libre después del `pull`.
- **Un hito con capacidades nuevas corre el paso 4b** del catálogo y lo comprueba leyendo
  `identidad.roles_permisos`.
- **Se empuja por hitos**, con el OK del usuario.
- **Los números de prueba y de migración de las etapas que siguen son los del plan original, y corren.**
  Cada etapa toma los siguientes libres al empezar: AG2 usó la migración `070` y AG4 la prueba 205, así que el
  cerebro fue en la `071` y en las pruebas 206 a 213 (AG5), 214 a 216 (AG6) y 217 y 218 (AG7), y lo que el
  plan numeraba `071` a `074` pasó a `072` a `075`. Los números de prueba de las secciones de abajo son los del plan y se reasignan en su etapa.
- **Pruebas nuevas desde la 198**, con un solo contador para `pruebas/codigo` y `pruebas/base`. El número
  exacto se toma al crearla; los de abajo son la intención.
- **Ninguna llamada real al modelo** sin el OK del usuario con el número de llamadas (`07`).

---

## P0 · Medición — **hecha el 2026-10-04**

- `git pull --rebase --autostash` hasta `97fc905`.
- Producción medida sólo con lectura: lo que dice `00-MAPA.md` en «Lo medido en el Paso 0».

## AG0 · Documentos — **hecha el 2026-10-04** (`db6bc34`)

- Esta carpeta, auditada por `pruebas/codigo/101-las-citas-de-los-documentos.test.ts` desde hoy (se suma a
  `AUDITADAS`). Mutación: una cita a una línea que no existe.
- Al día:
  - `docs/OTROS/futuro/el-cerebro.md` y `docs/OTROS/futuro/plan-y-senales-de-acquisition.md`: su estado
    apunta a esta carpeta; el segundo deja de decir que el modal vive en `components/Overlays.jsx` (se fue
    el 2026-10-01) y que los umbrales se aprueban antes de publicar (`D-11`);
  - `docs/OTROS/nueva-estructura/08-LO-QUE-QUEDA-PARA-DESPUES.md`: lo del cerebro apunta acá;
  - `docs/OTROS/estado actual/09-DEUDA-ABIERTA.md`: el acuerdo de tratamiento de datos (`D-32`);
  - las citas a la línea 1191 de `pruebas/codigo/90-fundaciones.test.ts`, que hoy dice otra cosa: el
    conteo literal está en la 1263.
- **Dos OK del usuario antes de seguir**: el conjunto de preguntas (`07`, `AG-102`) y la especificación de
  Conversion (`fichas/F04-CONVERSION.md`). **Los dos llegaron el 2026-10-04, sin cambios.**

## AG1 · El transporte y el uso — **hecha el 2026-10-04**

- **Qué**: `lib/agentes/proveedor.ts` (la dirección y la versión de la API, la única copia del mundo nuevo),
  `lib/agentes/modelos.ts`, `lib/agentes/llamada.ts`, `lib/agentes/uso.ts` (`01`, `06`). De
  `rechazoDelModelo` salen `anotarIncidente` y `detalleDelFallo`, sin cambiar lo que hace.
- **Migración** `069_el_uso_de_la_ia.sql`: `negocio.uso_de_ia`, con `aplicar_aislamiento`, `usuario_id`
  con `on delete set null` y su frase en `QUE_LO_IMPIDE` para `org_id`. Se aplica a producción con H1.
- **Pruebas que cambian**: la lista de válidos se muda a `pruebas/apoyo/modelos-validos.ts` y suma
  `claude-sonnet-5-5`; la 90 la importa en las mismas seis líneas. La 171 pasa a mirar la constante única y
  las cinco copias (mutaciones: otra versión en `proveedor.ts`; la dirección copiada en `llamada.ts`).
- **Pruebas nuevas**: 198, el transporte va sólo por `pedirExterno`, sin herramienta forzada, reintenta una
  vez y sólo si es pasajero, sin tiempo o con una llave que no puede ir en una cabecera no pide, trata como
  truncada la ventana de contexto llena, no le manda esfuerzo a Haiku, los incidentes que agrega el cron, y
  un solo escritor de `uso_de_ia`. 199, cada constante de `lib/agentes/modelos.ts` está en la lista de
  válidos, y los módulos que fuerzan su herramienta no usan un modelo que la rechaza. 200 (base), la fila de uso con sus cuatro contadores bajo RLS, en su propia transacción, una por
  llamada, y sin incidentes cuando los agrega quien llama.
- **Mutaciones, las veintisiete vistas en rojo**: en la 198, un segundo intento ante `IA-SIN-SALDO`; un
  `fetch` directo; un `tool_choice` forzado con dos herramientas; otro con una sola; `tool_choice` sin
  herramientas; la llave sin quitar, en una respuesta que no llegó y en un rechazo; el tope entero en el
  reintento; el tope menos la pausa, sin descontar el primer intento; devolver el primer fallo en vez del
  segundo; pedir sin tiempo; la espera con decimales sin recortar; la infinita tratada como sin tiempo; la
  llave inválida que sale a la red; la duración medida después de anotar; el esfuerzo fuera de
  `output_config`; el esfuerzo mandado a Haiku; la ventana de contexto leída como respuesta; un segundo
  escritor. En la 198 y la 200, ignorar `los_agrega_quien_llama`. En la 200, el salvado del cron que escribe
  su incidente; escribir fuera del contexto; reusar la transacción abierta. En la 199, `'claude-sonnet-55'`,
  y el modelo de Fundaciones pasado a `claude-sonnet-5-5` con su herramienta forzada. En la 171, otra
  versión en `proveedor.ts` y la dirección copiada en `llamada.ts`.
- **Documentos**: `estado actual/17-LA-PLATAFORMA.md` (existe la tabla del uso de IA y su único escritor;
  la escriben desde AG2 los agentes que ya existían, menos Fundaciones; los nuevos, desde AG5).

## AG2 · Los agentes que ya existen registran su uso y sus fallos — **hecha el 2026-10-04 sin Fundaciones** — **hito H1**

- **Qué se hizo**: `registrarUso` en el Espía (`espia`), el auditor (`auditor` en el carril rojo,
  `auditor_mejora` en el amarillo) y los Analizadores (`analizador_clasificar`, `analizador_analizar`,
  `analizador_ficha`), **incluida la clasificación**, que antes descartaba su uso. Una fila por llamada,
  también las que fallan: con sus contadores si la respuesta llegó (se pagó), nulos si no. El Espía es la
  excepción: una fila por pedido, con el reintento de `generar` adentro, y sin contadores cuando falla,
  porque el fallo de `generar` no los trae (tampoco el 200 sin texto).
- **Incidentes**: el auditor y los Analizadores los suman, **agregados por corrida, situación y paso** con
  `agruparIncidentes` (`lib/incidentes/agrupados.ts`). El primero de cada grupo se escribe en el acto y al
  terminar se le pone cuántos fueron: el auditor espera al modelo hasta 240 s en una función de 300, y una
  corrida que la plataforma corta antes del `finally` no puede dejar el panel vacío. También agrupa el botón de sincronizar los Analizadores
  (clasifica hasta cuarenta reuniones). Analizar o pedir la ficha desde la pantalla anota uno por fallo, con
  quien lo vio; la mejora del día, uno solo. El Espía anota su incidente y su uso con la MISMA referencia.
- **El error de un análisis fallido** ya no guarda texto del modelo: un JSON ilegible es
  `AnalyzerCallError('sin_estructura')`, con el uso y sin el `slice` de la respuesta (`runAnalysis` y
  `runInsight`). El error del transporte lleva `codigo`, `motivo` y `causa`, y `falloDelModeloDe` lo traduce
  a las situaciones `IA-*` (`lib/analizadores/nucleo/anthropic.ts`). La clasificación mira el motivo de corte
  como el análisis: un truncado o un rechazo ya no se anotan como `IA-ESTRUCTURA`. Y el fallo del auditor
  sale sin la llave (`redactKey`), porque desde ahora llega al registro y al incidente. `Generacion` suma `uso` con los cuatro
  contadores (`lib/fundaciones/generacion.ts`).
- **Se quitó el bloque duplicado** de `lectura === 'texto'` en `pedirExterno` (`lib/http/cliente.ts`): era
  idéntico al anterior e inalcanzable, y el contrato no cambia.
- **Migración** `070_el_incidente_no_retiene_a_la_persona.sql`: `incidentes_usuario_id_fkey` pasa a `on delete
  set null`, como la `068` y la `069`, y su frase sale de `QUE_LO_IMPIDE`. Se decidió con el usuario el
  2026-10-04.
- **Lo que quedó para después**: el uso de Fundaciones (generar, conversar, rellenar) choca con la rama
  `feature/icp-oferta-v2` (`00-MAPA.md`), y el usuario decidió hacerlo después de que la rama se integre.
- **Pruebas que cambian**: 172 y 173 (el uso de la clasificación, el análisis y la ficha; el incidente de la
  pantalla con quien lo vio; uno por situación al descubrir, en la tarea y en el reintento, también cuando la
  corrida corta), 95 y 92 (el uso del auditor y de la mejora, el incidente agrupado del rojo y el suelto del
  amarillo), 200 (el Espía corrido con la red falsa: su uso, y la referencia que comparte con su incidente) y
  23 (una clave del diccionario que ya no frena un borrado sobra). La del cuerpo del auditor sigue igual.
- **Pruebas nuevas**: 201, el error de un análisis y de una ficha no guarda texto del modelo, la
  clasificación cuenta lo que costó aunque devuelva null, y los errores del transporte se traducen con lo que
  mandó el proveedor.
- **Mutaciones, veintinueve vistas en rojo**: en la 201, devolver el `slice` en el análisis y en la ficha;
  el error de lectura sin su uso; la causa de `sin_respuesta` perdida; la clasificación fallida que no cuenta.
  En la 172, quitar `registrarUso`; quitar el incidente de la pantalla; la pantalla que no agrupa la
  clasificación; volcar fuera del `finally`; el uso sin la persona; el uso del error ignorado. En la 173, la
  tarea y el reintento sin agrupar; el agrupador que junta todas las situaciones. En la 95, quitar
  `registrarUso`; anotar uno por llamada; no volcar. En la 92, quitar el uso y el incidente de la mejora. En
  la 200, el Espía sin uso; con otra referencia que su incidente; sin los contadores de caché. En la 23, la
  frase vieja que sigue en la lista. Una vigésima cuarta —anotar dos veces el uso cuando falla una escritura
  después del modelo— quedó verde y mostró que la guarda que vigilaba sobraba: un error que no es del modelo
  no deja uso (`falloDelModeloDe` lo devuelve nulo). La guarda se quitó. Después de la revisión adversarial,
  seis más: el primero del grupo que espera a `volcar`, la clave sin el paso y `volcar` sin recontar (172,
  173 y 95); la clasificación sin mirar el corte, y la llave en la causa y en el motivo del auditor (201).
- **Documentos**: `estado actual/14-ANALIZADORES.md`, `04-CONVERSATION.md`, `17-LA-PLATAFORMA.md` y
  `09-DEUDA-ABIERTA.md`; en esta carpeta, `00-MAPA`, `01`, `05`, `06` y las fichas F01, F02, F05, F08 y F11.
- **Hito H1**: aplicar la `069` y la `070` a producción, push con OK.

## AG3 · La voz — **hecha el 2026-10-04 sin Fundaciones**

- **Qué se hizo**: todo Tools pasó a tú neutro, no sólo el Espía: también el Scraper, Mis leads, el saldo de
  leads y el plan de prospección (`components/tools/`) y el aviso de la ruta que envía leads
  (`app/api/tools/leads/enviar/route.ts`). Eran veintitrés textos, del estilo de «Escribí un nicho…»,
  «Intentá de nuevo» o «Elegí una búsqueda del Espía». El prompt del Espía ya tuteaba. Se adelantó a la
  integración de la rama porque la rama no toca ningún archivo de Tools.
- **Fundaciones lo hace la rama `feature/icp-oferta-v2`** (prompt, textos, `VERSION_DEL_AGENTE` 3 y su prueba
  185, «un solo tono»): después de integrarla, esta etapa sólo cubre lo que la rama no haya tocado.
- **La lista de voseo** de la 185 de la rama se mudó a `pruebas/apoyo/voseo.ts`, con las formas que tenía
  Tools sumadas. Al integrar la rama, la 185 puede importarla en vez de llevar su copia.
- **Pruebas que cambian**: la 139 afirma «Habla con tu coach» en vez de «Hablá». La rama cambia otra línea
  de la misma prueba (la 93), así que no se pisan.
- **Pruebas nuevas**: 202, Tools no vosea —los componentes, `lib/tools/` y las rutas de `app/api/tools/`, sin
  comentarios, y el prompt del Espía—, con una comprobación de que la lista atrapa las formas que había.
- **Mutaciones, las cuatro vistas en rojo**: devolver «Escribí» al Espía; un «Elegí» en el Scraper; el prompt
  del Espía con «Extraé»; la ruta de enviar con «Recargá».
- **Fuera**: el auditor y los Analizadores (`D-26`: cuando se evalúen).

## AG4 · La base sembrada y el guion de evaluación — **hecha el 2026-10-04**

- **Qué se hizo**: el constructor compartido `db/sembrado/casos-de-los-agentes.ts` (`07`, `AG-100`), con
  `sembrar-agentes` y `quitar-agentes` en `scripts/db.mjs`, y `scripts/evaluar-agentes.mjs` (`07`, `AG-104`)
  con su primera tanda, `modelo` (`06`, `AG-92`). El sembrado no queda instalado: la `11` exige las cinco
  empresas del sembrado de desarrollo, así que quien siembra, quita. Escribe como la aplicación y borra como
  `postgres` —quitar una empresa es vaciar `negocio` e `identidad` a la vez, y cada rol de la aplicación ve
  uno solo—, recorriendo todas las tablas
  con `org_id` en pasadas: `resultados.cita_id` es `on delete set null` sin lista de columnas (`049`) y borrar
  `citas` primero anula su `org_id` (`23502`).
- **Listas**: el sembrado entra en `ARCHIVOS_AUTORIZADOS` y en `CRUZAN_LOS_DOS_DOMINIOS`, el guion sólo en
  `ARCHIVOS_AUTORIZADOS` (todavía no abre ninguna empresa: lo hará la tanda del cerebro); los dos, en la lista de
  llamadores de la guarda de anfitrión (la `11`), y el sembrado en la de quienes importan `pg` (la `10`), por
  el borrado.
- **Pruebas nuevas**: 203, el sembrado y el borrado se niegan si la base de identidad o la de administración no
  es local. 204, el guion corrido como proceso: sin `--confirmo` dice el número y no corre, con otro número se
  niega antes de mirar la base, con el correcto llega hasta la guarda, y no tiene `fetch(`; corre con la base
  remota inexistente, así que nunca puede gastar. 205 (base), las cifras de `07` con las funciones de las
  pantallas, y que sembrar dos veces deja lo mismo.
- **Mutaciones, nueve vistas en rojo**: sin la guarda; la guarda que sólo mira identidad (203); aceptar
  cualquier número; correr sin confirmar; un `fetch` (204); otro gasto de Webinar; «precio» una vez menos; un
  resultado que es venta; sin el tramo de contactos que da historia a la comparación (205). Una décima —quitar
  sin borrar antes lo que cuelga de cada persona— quedó verde: esas tablas caen en cascada con la persona, y
  ese paso se quitó.
- **Documentos**: `07` con las cifras exactas del sembrado.

## AG5 · El cerebro, servidor I — **grande** — **hecha el 2026-10-04**

- **Qué se hizo**: `lib/agentes/executive/` —`prompt.ts` (tú neutro, `VERSION_DEL_CEREBRO` 1), `respuesta.ts`
  (el esquema `responder` y su validación contra la evidencia), `herramientas.ts` con `adaptadores/` (las de
  Acquisition, Sales y Leads › De GHL: `embudos_de_acquisition`, `dinero_del_mes`, `cadena_de_cierre`,
  `ciclo_hasta_la_cita`, `cierre_por_closer`, `cancelacion_de_citas` y `cohorte_de_leads`), `conversaciones.ts`,
  `topes.ts`, `estado.ts` y `preguntar.ts` (el ciclo de `AG-04`)— y `app/api/executive/route.ts`, que **baja la
  bandera** (`lib/autorizacion/secciones.ts:220` es ahora el comentario de una línea).
- **Cómo se asegura la salida** (lo que `03`, AG-46, dejaba para esta etapa): `responder` se ofrece con
  `strict: true` junto a las herramientas, con `tool_choice: auto`. Si el modelo contesta con texto suelto, o se
  llega a la sexta ronda, esa ronda pide el formato de `responder` (`output_config.format`) y apaga las
  herramientas con `tool_choice: none`, sin dejar de ofrecerlas. Si ni así contesta con la forma, es un
  `IA-ESTRUCTURA` con su incidente, y la pregunta queda `fallida`. 120 s por llamada, 240 s en total, techo de
  12.000 tokens y esfuerzo `medium`.
- **Migración** `071` (la `070` la usó AG2): `conversaciones_del_executive` (autor con `on delete cascade`),
  `mensajes_del_executive` (la respuesta validada y la evidencia sin nombres, y `responde_a`),
  `topes_del_executive` (50 y 300) y `preguntas_del_executive` (el registro del tope, que no cuelga de los
  hilos); sus cuatro claves de empresa con su frase en `QUE_LO_IMPIDE`.
- **Capacidad** `cerebro.usar`, en `db/arranque/001_catalogo.sql` y `lib/autorizacion/capacidades.ts`: los
  tres roles la reciben por el reparto derivado. **Producción la necesita con el paso 4b en el hito H2.**
- **Códigos de rechazo nuevos**: `cerebro_bajo_delegacion` (409), `tope_del_cerebro` (429) y
  `cerebro_sin_datos` (409).
- **Lo que cambió la revisión adversarial**: el tope se cuenta en `preguntas_del_executive` y no en los
  mensajes —borrar los hilos lo reiniciaba—; una reserva vence a los diez minutos; una fallida que se pagó
  cuenta; todo lo que sigue a la reserva va dentro de un `try` que la marca fallida, y una respuesta validada
  llega aunque no se haya podido guardar; cada cifra cita el `campo` de su evidencia y los números del texto
  libre tienen que estar entre las cifras; el hilo guardado reemplaza los nombres de la evidencia por
  «[persona]»; sin herramientas no se llama al modelo; las respuestas se emparejan con su pregunta por
  `responde_a`; lo opcional del esquema va como `anyOf` con `null`; y no se empieza una ronda con menos de
  5 s.
- **Pruebas que cambian**: la 90, el conteo de `SIN_OPERACIONES_TODAVIA` pasa de 1 a 0; la 30 suma que
  `executive` tiene su ruta; la 91 escribe la lista de tableros en vez de recorrer la lista vacía; la 198 suma
  las tres tablas a `ESCRITORES`; `pruebas/apoyo/autorizados.ts` suma la ruta a las dos listas.
- **Pruebas nuevas** (el plan las numeraba 205 a 209; la 205 la usó AG4): 206 (base) la ruta del Inicio, regla
  31 —qué capacidad pide cada método, `seccion_no_concedida`, sin llave no llama al modelo, de punta a punta con
  el modelo falso—; 207 nada bajo `lib/agentes/` llama al modelo dentro de una `conOrganizacion(` ni importa
  `conIdentidad`; 208 `responder` —la cifra sin respaldo se quita, la acción se rechaza, la herramienta
  inventada no se corre—; 209 (base) los hilos son del autor, el tope bajo candado con dos preguntas en una
  carrera de verdad, la fallida no cuenta y la delegación se rechaza; 210 (base) ninguna sesión `idle in
  transaction` mientras el modelo falso espera; 211 (base) las rondas sólo agregan y la pregunta siguiente
  arranca reducida; 212 los esquemas cumplen el modo estricto; 213 (base, sobre la base sembrada) el juego
  exacto de claves de cada herramienta, ningún correo, y la misma cifra que la ruta de su pantalla con 30 días.
  El modelo falso es `pruebas/apoyo/cerebro.ts`.
- **Mutaciones, treinta y una vistas en rojo**: devolver la bandera (90, 30, 206); el POST con otra capacidad
  (206); el modelo dentro de una transacción (207 y 210); importar `conIdentidad` (207); aceptar cualquier
  `ev`, aceptar una acción, correr una herramienta inventada (208); leer y borrar un hilo ajeno, sin el
  candado, la fallida que cuenta, responder bajo delegación (209); el turno sin su pensamiento, sacar las
  herramientas en la ronda del formato, el historial con texto que no es la respuesta (211); un `maxLength`
  (212); una clave de más en una proyección, una herramienta con otro período que su pantalla (213). Y las de
  la revisión: la fallida sin pago que cuenta, la pagada que no, la reserva que no vence, marcar sin mirar
  si se pagó, borrar el hilo que devuelve el lugar, el guardado sin atrapar (209); guardar con los nombres
  (213); comparar contra toda la evidencia, el porcentaje de cualquier número, no mirar la conclusión, la
  recomendación con un número inventado (208); llamar sin herramientas (206); emparejar el historial por
  orden (211).
- **Lo que queda para AG6**: las demás herramientas y las rutas finas de la caja del pie; la misma cifra que la
  pantalla en las cuatro ventanas, no sólo en 30 días.
- **Documentos**: `estado actual/11-EXECUTIVE.md`, `nueva-estructura/04-EL-INICIO.md`, `futuro/el-cerebro.md`,
  `03`, `09` y `00-MAPA`.

## AG6 · El cerebro, servidor II — **grande** — **hecha el 2026-10-04**

- **Qué se hizo**: las herramientas que faltaban de `03`, `AG-42`, en `lib/agentes/executive/adaptadores/`
  —Creative (`calidad_de_piezas`, `rendimiento_de_piezas`, `fatiga_de_piezas`), Conversion
  (`recorrido_de_los_leads`, `formulario_de_la_landing`), Conversation (`auditoria_de_agentes`, `lead_flow`,
  `atribucion_del_lead`, `consumo_del_precall`, `sentimiento_por_flujo`), Setter (`colas_del_setter`,
  `inicio_del_setter`, `pipeline_del_setter`), Closer (`mi_dia_del_closer`, `inicio_del_closer`,
  `agenda_del_closer`, `pipeline_del_closer`), Tools (`leads_del_scraper`, `espia`), ICP & Oferta
  (`fundaciones`) y las dos de la plataforma (`frescura`, `estado_de_integraciones`)—, las dos funciones nuevas
  (`lib/negocio/economiaDelNegocio.ts`, con su herramienta `economia_del_negocio`, y
  `lib/negocio/leadsDelScraper.ts`) y las once rutas finas `app/api/<carpeta>/cerebro/route.ts`. El catálogo
  tiene 30 herramientas. Radar y Funnel son pestañas de Tools: ahí el cerebro lee el Espía y los leads del
  scraper, y Funnel no tiene cifras medidas que leer (`03`, `AG-42`).
- **Lo común de las rutas**, en `lib/agentes/executive/caja.ts`: leer y validar la pregunta, la identidad
  (`identidadDelCerebro`, con la conexión que abre la ruta), el estado y los hilos del panel, y la respuesta.
  La del Inicio se reescribió sobre lo mismo, sin cambiar lo que contesta. La traducción de por qué el auditor
  no audita pasó de `app/api/auditoria/route.ts` a `lib/auditor/pantalla.ts` (`porQueNoAudita`): la usan la
  pantalla y el cerebro.
- **Lo que viaja y lo que no**: de las colas del Setter y del Closer y de los pipelines, sólo los conteos; de la
  agenda, la hora y el estado de cada cita; de la auditoría, las tarjetas y los casos por patrón, sin los casos;
  del Espía y de ICP & Oferta, el texto recortado y sin datos de contacto (`sinDatosDeContacto`); de los leads
  del scraper, sólo agregados, y «enviados al CRM» como `null` porque no se registra; de las integraciones,
  `cargado` y `estado`, sólo a quien tiene `credenciales.ver`.
- **Lo que cambió la revisión adversarial**: el filtro de contactos borraba el símbolo de un usuario de una red
  y no el usuario, y dejaba pasar un móvil escrito con puntos (`987.654.321`); ahora borra los dos, y ante la
  duda borra un número de siete cifras o más. Una caja rechaza a quien no ve su sección
  (`seccion_no_concedida`), y sólo lee, continúa y borra los hilos de su sección. La economía no publica
  retorno ni costo por venta con una venta sin monto ni con el gasto del mes incompleto, y `gastoHasta` sale de
  las mismas filas que la inversión. `frescura` da `contactos` a todas las secciones que cuentan contactos. La
  auditoría dice `casosTruncados` cuando la pantalla llegó a su tope de casos. Y cuatro comentarios falsos: el
  registro de auditoría del GET, `hayMas`, la regla de `frescura` y quién ve la empresa en el Closer.
- **Pruebas que cambian**: la 207 mira también las rutas finas y `caja.ts`; la 208, el contexto nuevo de las
  herramientas; la 213 pasa al catálogo entero, con las tres tablas de `public` creadas para la prueba
  (`pruebas/apoyo/tablas-de-public.ts`: no existen en la base local) y sembradas con correos y teléfonos;
  `pruebas/apoyo/autorizados.ts` suma las once rutas a las dos listas.
- **Pruebas nuevas** (el plan las numeraba 210 a 212; esos números los usó AG5): 214, lo que se le ofrece a
  cada sección, escrito a mano, la de dos secciones sólo con las dos, las integraciones sólo con su dato, y el
  filtro de contactos; 215 (base), la misma cifra que la ruta de su pantalla en las cuatro ventanas y con la
  sesión de quien mira, y la economía con y sin ventas, con una venta sin monto y con el gasto incompleto; 216
  (base), las cajas del pie —su `PANTALLA` y sus capacidades, `seccion_no_concedida`, el hilo con su sección,
  lo que le llega al modelo, y por qué no audita igual que la pantalla—.
- **Mutaciones, veinticuatro vistas en rojo**: ofrecer el catálogo entero, la de dos secciones con cualquiera,
  las integraciones a todos, una fecha tomada por teléfono, el móvil con puntos, el usuario de una red (214); el
  análisis del Espía y el ICP sin filtrar, las filas de las colas, `frescura` de todas las tareas o sin
  `contactos` (213); recalcular con 30 días, la economía con todo el gasto, el Closer sin su alcance, el gasto
  siempre entero, las ventas sin monto que no cuentan (215); sin `noAudita`, las integraciones a cualquiera, la
  caja que pregunta como el Inicio, la caja que no mira si se ve su sección, continuar, leer y borrar un hilo de
  otra sección (216); preguntar dentro de una transacción en una ruta fina (207).
- **Lo que queda para AG7**: la caja del pie manda sólo `{ pregunta, hilo?, periodo? }`; la pestaña, la entrada
  y la sub-pestaña (`03`, `AG-44`) llegan con la pantalla. Las colas se comparan con la pantalla en cero contra
  cero, porque la base sembrada no tiene filas en las colas: el alcance del Closer lo prueban el campo `de` y el
  pipeline.
- **Documentos**: `03`, `05`, `09`, `00-MAPA`, `fichas/F00-EL-CEREBRO.md`, `futuro/el-cerebro.md` y
  `estado actual/11-EXECUTIVE.md`. Las pruebas de las etapas siguientes empiezan en la 217.

## AG7 · El cerebro en pantalla — **grande** — **hito H2** — **hecha el 2026-10-05**

- **Qué se hizo**: el chat del Inicio (`components/views/ExecutiveView.jsx`: la caja habilitada con el estado
  `listo`, los turnos, la mascota con estados, la evidencia desplegable, el estado sin llave, bajo delegación
  o con tope, con el camino a Ajustes para quien puede cargar la llave); la caja del pie habilitada, con el
  período que mira la pantalla y el panel que sube (`components/ConsultaAlCerebro.jsx`,
  `components/cerebro/PanelDelCerebro.jsx`: una `Ventana` con la variante `vt-panel`); CONVERSACIONES como
  lista navegable (`components/cerebro/ConversacionesDeLaBarra.jsx`); el traspaso (`lib/agentes/traspaso.ts`);
  y los topes en Ajustes (`app/api/admin/cerebro/route.ts`, `components/ajustes/TopesDelCerebro.jsx`, y
  `fijarTopes` en `lib/agentes/executive/topes.ts`). Las burbujas son `components/cerebro/Respuesta.jsx` y
  `Evidencia.jsx`; la conversación, `Conversacion.jsx`; lo que habla con las rutas, `lib/agentes/usarCerebro.ts`.
- **Lo que necesitó y no estaba**: el período de cada pantalla vive en su estado, así que cada panel con
  períodos lo anuncia (`lib/agentes/periodos.ts`) y la caja lo lee; la barra no le pide nada al servidor
  (`193`), así que el Inicio publica sus hilos (`lib/agentes/hilos-de-la-barra.ts`, en la memoria de
  lecturas con la empresa en la clave, ADR-0703) y CONVERSACIONES los lee; un hilo guardado devuelve su
  evidencia (`leerHilo`), para el desplegable al reabrirlo.
- **El borde de la caja llega a 3:1** con un token nuevo, `--line-control` (`app/temas.css`): el `ink-3` de la
  marca, `#7f8a9b`, 5,8:1 contra el fondo y 5,49:1 contra la caja. El `#5b6576` que proponía
  `nueva-estructura/04-EL-INICIO.md` es el `ink-3` del tema claro, y la paleta oscura no lo tiene (`188`).
- **«@ agente» no se construyó en esta etapa.** Abre la herramienta que crea con el pedido cargado, y las tres
  que hoy crean —ICP & Oferta, Tu landing y Tu VSL— reciben ese pedido en `ChatDeHerramienta`, `PanelHerramienta`
  y `Fundaciones`, los archivos que reescribe la rama `feature/icp-oferta-v2` (unas 600 líneas). Por la misma
  regla que dejó para después el uso y la voz de Fundaciones (AG2, AG3), va después de integrar esa rama. Sin
  quien reciba el pedido, el Inicio no ofrece «@ agente» (la 189 lo vigila).
- **Lo que cambió la revisión adversarial**: cada pedido del navegador recuerda su «generación» y lo que llega
  tarde se descarta —la respuesta de una pregunta hecha en Sales caía en la conversación de Creative, y abrir
  otro hilo mientras se esperaba mezclaba los dos—; la caja del pie devuelve la pregunta al campo si falla y
  muestra el error; el panel se cierra al navegar; el campo queda en sólo lectura mientras se espera, porque
  deshabilitado soltaba el foco fuera de la ventana; después de un fallo se reabre el hilo —el servidor guarda
  la pregunta como fallida, y reintentar dejaba dos hilos—; un hilo guardado empareja cada respuesta con su
  pregunta por `responde_a` y dice cuál no tiene respuesta; la caja del pie avisa lo que pregunta o borra, y
  CONVERSACIONES se entera (`avisarQueCambiaronLosHilos`) y muestra todos los hilos que manda el servidor; los
  del Inicio se borran ahí, con un segundo clic; «Ir a Ajustes» abre Credenciales y también está en la caja y
  en el panel; el rechazo por el tope de la empresa ya no le dice «llegaste» a la persona; claves sin
  repetidos; el traspaso usa el pedido del evento si el navegador no deja guardar; y comentarios falsos.
- **Lo que no se pasa todavía**: un paso «abrir» navega a su sección y su pestaña, sin el `contexto` que
  propone el modelo (AG-49), que ninguna pantalla sabe leer; y la mascota no llega a `alerta`, que sale de las
  señales (AG8).
- **Pruebas que cambian**: la 197 pasa a `197-la-caja-y-las-conversaciones-del-cerebro.test.ts` —la caja
  pregunta a la ruta de su sección con el período de la pantalla y sólo con el estado `listo`, cada ruta del
  mapa existe y es de su sección, las pantallas anuncian su período, CONVERSACIONES lista lo que publica el
  Inicio y lo abre ahí, y el panel va dentro de la caja, que no se dibuja en el teléfono—; la 189 —la caja del
  Inicio pregunta por `usarCerebro`, sólo con `listo`, y la búsqueda de cifras escritas recorre todo lo que el
  Inicio importa, no sólo el primer nivel—; la 104 y la 107 suman `app/cerebro.css`. La 162 no cambió: el panel
  vive dentro de la caja, que la rejilla del teléfono no dibuja.
- **Pruebas nuevas** (el plan las numeraba 213 y 214, que usaron AG5 y AG6): 217, las burbujas —la evidencia
  dentro de la primera, la mascota sólo en la primera y sólo el turno actual sigue el cursor, ningún id del
  prototipo ni propio, los turnos de un hilo guardado, los textos de cada estado y de cada rechazo, el período
  anunciado y el traspaso que se toma una vez—; 218 (base), los topes en Ajustes —sus capacidades, la
  validación, quién y cuándo, que rigen, y bajo delegación sin autor—.
- **Mutaciones, veintiocho vistas en rojo**: la caja sin período, una ruta del mapa que no existe o es de otra
  sección, una pantalla que deja de anunciar, la caja sin `listo`, CONVERSACIONES sin pedir el hilo, «Nueva
  conversación» que vuelve al hilo abierto (197); el campo del Inicio sin `listo`, una cifra escrita en una
  burbuja (189); todas las mascotas siguiendo el cursor, lo técnico del rechazo a la persona, la pregunta
  fallida que no lo dice, un id en el panel (217); el autor bajo delegación, una persona por encima de la
  empresa, el PUT con la capacidad de leer (218). Y las de la revisión: una respuesta vieja que se aplica,
  abrir un hilo sin invalidar la pregunta en camino, el panel abierto al cambiar de pantalla o al seguir un
  paso, la respuesta emparejada por orden, la pregunta sin respuesta que no lo dice (217); la caja que pierde
  la pregunta, la barra que no se entera de lo del pie, enviar con una pregunta en camino (197); el campo
  deshabilitado mientras se espera (189); el tope de la empresa dicho a la persona (218).
- **Verificación**: en el preview local, con una sesión de desarrollo y dos hilos sembrados (nunca la
  contraseña en el formulario), a 1280 y 375 px y en los dos temas: el estado sin llave con el camino a
  Ajustes, CONVERSACIONES y su corte con puntos suspensivos (corregido ahí: la columna crecía al ancho del
  título), un hilo reabierto con su evidencia, la caja de Sales con su motivo, el panel que sube con sus hilos,
  Escape que lo cierra y devuelve el foco, y los topes en Ajustes. Después de la revisión, otra vez: borrar con
  confirmación (y la barra que se actualiza), «Ir a Ajustes» que llega a Credenciales desde Usuarios, y el paso
  «Abrir» que cierra el panel y devuelve el desplazamiento del fondo. Una pregunta real no: el preview no tiene
  la llave de ARIA, y la evaluación real espera el OK del usuario (`07`).
- **Documentos**: `03`, `06`, `00-MAPA`, `fichas/F00` y `F19`, `nueva-estructura/01`, `04` y `09`,
  `futuro/el-cerebro.md`, `estado actual/11-EXECUTIVE.md`, y los comentarios de `components/Nav.jsx` y
  `components/ConsultaAlCerebro.jsx`. Las pruebas de las etapas siguientes empiezan en la 219.
- **Hito H2**: aplicar la `071` (la `070` ya está en producción desde H1), paso 4b, comprobar `cerebro.usar` en
  `roles_permisos`, push con OK.
  Hecho el 2026-10-05: la `071` en producción con sus cuatro tablas forzadas, el catálogo con `cerebro.usar` en
  los tres roles, y el push.
- **La tanda `cerebro` de la evaluación** (`scripts/evaluar-agentes.mjs`): las preguntas 1 a 16 de `07`,
  `AG-102`, por el mismo camino que la ruta —el portero con la sesión de la persona sembrada y la pantalla desde
  la que pregunta, `identidadDelCerebro`, `laPregunta`, `preguntar`—, con la llave de ARIA sólo en memoria: la
  empresa sembrada no recibe una copia. Pide confirmar el techo (16 × `RONDAS`, 96) e imprime lo gastado, leído
  de `uso_de_ia`. Por escribir sesiones en identidad e hilos en negocio entra en `CRUZAN_LOS_DOS_DOMINIOS`; el
  `finally` quita la empresa con todo. La 204 suma el techo (mutaciones: sin «hasta», otro número de rondas).
  Ensayada contra la base local con un modelo falso en un guion aparte (32 rondas, la base limpia al final);
  la corrida real espera la llave cargada y el OK.

## AG8 · Las señales — **hecha el 2026-10-05**

- **Qué se hizo**: `lib/agentes/senales/tipos.ts` (lo que entrega un detector, la huella, la confianza por la
  muestra), `escritura.ts` (el único escritor de las señales: la reconciliación diaria de `02`, AG-22 y AG-23,
  con un candado de transacción por empresa, departamento y ventana para las entregas duplicadas del cron),
  `umbrales.ts` (el catálogo provisional —vacío hasta que cada detector sume sus reglas— y la firma),
  `lib/agentes/plan/guardar.ts` (el plan de cada departamento, ventana y día, también vacío) y
  `lib/agentes/detectores/correr.ts` (la pasada: a quién le toca, qué departamento ya corrió, primero medir y
  después escribir las señales con su plan en una sola transacción). La tarea `senales` del cron: `Tarea`,
  `TAREAS` (al final), `HORARIOS['23 * * * *']` con el umbral de una tarea diaria (2.940 minutos), la
  excepción del token del CRM, el motivo del sello cuando un departamento no terminó, su nombre en la
  frescura y `vercel.json`.
- **Migración** `072`: `senales` (con el índice único parcial por huella entre las que bloquean, y los `check`
  del ciclo de vida, del piso de 10 y de `issue_source` sólo en Conversation), `planes_de_accion`, `umbrales`,
  y el `check` de `tareas_programadas` suma `senales`. Las tres en el mapa del borrado.
- **«Ya corrió» es el plan**: la fila de `planes_de_accion` de las dos ventanas. Un departamento que falla no
  deja plan y se reintenta la hora siguiente; el que terminó no vuelve a medir. A la empresa que no le toca
  no se la sella; la primera pasada del día de una empresa sin departamentos pendientes —hoy todas: el
  catálogo nace vacío— se sella una vez.
- **Lo que pasó a AG9**: las capacidades `senales.resolver`, `senales.validar` y `umbrales.firmar` (con la
  pantalla que las usa), y «sin datos de anuncios del día no hay señales de costo», que es del detector de
  Acquisition. Ninguna pantalla lee todavía las señales: `frescura` no suma `senales` a ninguna sección.
- **Antes de que corra en producción con detectores (AG9)**: que alguien de ARIA cargue la zona real de las
  empresas activas (`00-MAPA.md`). Sin detectores, la pasada de AG8 no escribe nada más que su sello.
- **Pruebas que cambian**: la 28 (la tarea corre sin credenciales y deja su sello; las corridas que no prueban
  el presupuesto llevan un reloj fijo a las 12:00 de Lima, porque `senales` depende de la hora local y con el
  reloj de verdad cambiaban de resultado según la hora) y la 99 (el motivo del sello).
- **Pruebas nuevas** (el plan las numeraba 215 a 217, que usaron AG6 y AG7): 219 (base), la huella —nace una
  vez, debajo del piso se cuenta, una descartada no renace salvo más grave o con la condición apagada,
  `sin_medicion` sin fuente y de vuelta a `abierta`, y la base sola rechaza dos vivas con la misma huella—;
  220 (base), la pasada —a las 10:23 UTC le toca a Tokio y no a Lima, la que no le toca no se sella, la que
  ya corrió no se vuelve a sellar, el departamento que falla se reintenta y el que terminó no vuelve a medir,
  al día siguiente corren todos, el plan vacío se guarda—. La 220 corre sobre el día de hoy en Lima y no sobre
  una fecha fija: «ya corrió hoy» compara con el sello, y `sellar` escribe la hora de verdad.
- **La prueba encontró un defecto**: el escritor no guardaba la ventana al insertar, y el `as never` del
  `insert` lo escondía del compilador. Los escritores de AG8 van sin `as never`: una columna que falta es un
  error de tipos.
- **Mutaciones, once vistas en rojo**: comparar la hora en UTC, volver a correr el mismo día, volver a medir
  el departamento que terminó, sellar a la que no le toca, sacar `senales` de la excepción del token, callar
  los departamentos que fallaron, la huella única sólo entre las vivas, cerrar sola sin mirar la fuente, la
  descartada que no renace aunque suba la gravedad, guardar debajo del piso, y `sin_medicion` que no vuelve a
  `abierta`.

## AG9 · Acquisition, el piloto — **grande** — **hito H3** — **en curso**

- **Primera tanda, hecha el 2026-10-05: el detector y el plan.** `lecturaDeAcquisition` sale de
  `embudosDeAcquisition` sin cambiarle nada a la pantalla, para que el detector compare con las mismas cifras.
  `lib/agentes/detectores/acquisition.ts` mide y detecta siete reglas (`ACQ-SIN-ENTREGA`, `ACQ-CPL-SOSTENIDO`,
  `ACQ-GASTO-SIN-CRECIMIENTO`, `ACQ-CONCENTRACION`, `ACQ-ICP-ENTRE-CAMPANAS`, `ACQ-ESCALA-POR-CALIFICADO`,
  `ACQ-FUGA-ENTRE-ETAPAS`), con su piso y su umbral provisional en el catálogo; `lib/agentes/plan/acquisition.ts`
  arma el plan con plantillas. La pasada arma el plan **después** de reconciliar y sólo con lo vigente: lo que
  una persona descartó o resolvió no vuelve a recomendarse (A6-20). «Sin entrega» pasó a ser un estado —60
  días de historia, las pausadas fuera—: con «gastaba en la ventana anterior», la pauta parada hace 15 días no
  daba nada en 7 días. Pruebas nuevas 221, 222 y 223 (el plan las numeraba 218 a 220, que usaron AG7 y AG8),
  la 28 con la pasada que ahora mide y escribe, y la 220 con lo descartado fuera del plan. Mutaciones, nueve
  vistas en rojo: el piso en 9, el presupuesto en «Haz más de esto», dos grupos invertidos, la pausada contada,
  «sin entrega» con un día sin cerrar, la concentración sin validación ejecutiva, el plan sin ordenar, lo
  descartado en el plan y la campaña sin funnel compitiendo por el ICP.
- **Segunda tanda, hecha el 2026-10-05: el resto de las reglas.** `ACQ-CPM-ABRUPTO` (piso de mil impresiones),
  `ACQ-CAMBIO-BRUSCO-CONJUNTO` (sólo en 7 días; el contacto se ubica en su conjunto por `utmTerm`) y los cinco
  puntos del monitor de atribución como señales de la empresa, con `calidadDeLaAtribucion` sobre los mismos
  días cerrados que la pantalla —una ventana de calendario opcional; la pantalla sigue con la móvil—. La 221
  suma sus casos y la 223 las señales del monitor sobre la base sembrada. Mutaciones, seis vistas en rojo: el
  piso del costo por mil en 900, el conjunto también en 30 días, nombrar el cambio más chico, las UTM sin dar
  vuelta, las ventas sin denominador medidas, y el monitor con la ventana móvil.
- **Tercera tanda, hecha el 2026-10-05: las capacidades y las rutas.** `senales.resolver` (los tres roles),
  `senales.validar` y `umbrales.firmar` (administrador y superadministrador: al `usuario` se le niegan en su
  reparto, y la comprobación del catálogo y la 22 cuentan la diferencia nueva). `app/api/acquisition/senales`
  (POST: vista, resolver, descartar; lo de validación ejecutiva pide además `senales.validar`; con motivo;
  sólo señales de Acquisition), `app/api/acquisition/umbrales` (PUT, con su fila de auditoría
  `umbral_firmado`) y el GET de Acquisition con `senales` —las vivas de la ventana, con el nombre de la
  campaña resuelto, el último plan, las reglas con su umbral vigente y el estado del departamento— y
  `puedeConSenales`. Bajo delegación no se marca, no se resuelve y no se firma (`senales_bajo_delegacion`).
  `lib/agentes/senales/lectura.ts` lee para la pantalla; el escritor suma marcar vista y cerrar. Pruebas: 224
  nueva (base, por los manejadores), la 219 con el filtro de departamento del escritor, la 22 y la 181.
  Mutaciones, siete vistas en rojo.
- **Cuarta tanda, hecha el 2026-10-05: la pantalla.** `components/acquisition/SenalesDeAcquisition.jsx` (desde AG10,
  `components/senales/SenalesDelDepartamento.jsx`, compartido con Creative), con el
  marcado del prototipo: el botón «Plan de acción» junto al período, que abre el plan de la ventana elegida en
  `Ventana` (los grupos con renglones, lo que quedó bajo el piso, lo que no se pudo medir y el día en que se
  calculó), y la tarjeta «Señales detectadas · sin recomendación automática» al final, con el ícono por
  gravedad, la pérdida o «sin pérdida calculable», las marcas «umbral provisional», «requiere validación
  ejecutiva», «vista» y «sin medición hoy», «Ver evidencia» (que la marca vista y dibuja la evidencia con el
  mismo `Valor` del cerebro), resolver y descartar con motivo, y firmar el umbral para quien puede. Con «hoy» o
  «completo», la tarjeta y el plan dicen que se calculan sobre 7 y 30 días cerrados. El nombre de cada campaña
  sale de los embudos; el del funnel, de los rótulos de la pantalla.
- **Verificada el 2026-10-05 en el preview local**, con la sesión de la fundadora y señales de ejemplo copiadas de
  la base sembrada, a 419 px y a 1.100 px: la tarjeta, el plan, «Ver evidencia» (marcó vista), resolver con
  motivo (la base guardó el motivo y el autor) y firmar un umbral (guardó 0,85 con su autor). Lo que encontró:
  el nombre de una campaña sin datos en la ventana no se resolvía —ahora manda el que resuelve el servidor—,
  las frases del monitor traían acentos graves, la evidencia anidada desbordaba en el teléfono, los controles
  tenían el estilo del navegador —ahora `fd-btn`—, y el umbral se leía «0.9» con un porqué que nombraba
  código: cada regla del catálogo dice su unidad (`proporcion`, `puntos_porcentuales`, `puntos`, `dias`) y la
  pantalla muestra y recibe «90 %».
- **Quinta tanda, hecha el 2026-10-05: la redacción.** `lib/agentes/plan/redaccion.ts`: después de guardar el
  plan con plantillas, si la empresa tiene llave, `claude-sonnet-5-5` reescribe cada renglón (esfuerzo bajo,
  formato estricto, una llamada por ventana). Cada frase se valida: ninguna cifra que no esté en su renglón y
  ningún superlativo, porque la plantilla no trae el ranking que lo sostenga (A6-18); la que no pasa deja la
  frase de la plantilla, y lo quitado se cuenta. La espera es la menor entre 120 s y lo que le queda a la función
  menos 15 s; sin tiempo, no se pide. La llave la resuelve la ruta del cron sólo en el horario de `senales`
  (AG-35); el uso queda con el agente `plan`. La pantalla muestra la frase redactada y lo dice en el pie. La
  tanda `plan` de `scripts/evaluar-agentes.mjs` (dos pedidos), ensayada con un modelo falso. Pruebas: 225
  (código, la validación) y la 223 con la pasada que redacta y la que no tiene llave. Mutaciones, cinco vistas
  en rojo: una cifra inventada, un superlativo, una frase vacía o repetida, pedir sin llave y no guardar.
- **Lo que sigue**: la evaluación real de la redacción (con la llave cargada y OK), la suite completa y el hito
  H3.

- **Qué**: el detector (`fichas/F03-ACQUISITION.md`, con la tabla A6-01 a A6-24 regla por regla), el monitor
  de atribución en días cerrados, el Plan de acción con sus cinco grupos y su redacción, y en la pantalla: el
  botón «Plan de acción» en `components/acquisition/PanelDeAcquisition.jsx:179` y la tarjeta de Señales al
  final, con «Ver evidencia», «umbral provisional», resolver, descartar, validar y firmar.
- **Rutas**: `app/api/acquisition/route.ts` suma señales, plan y lo que la persona puede hacer;
  `app/api/acquisition/senales/route.ts` y `app/api/acquisition/umbrales/route.ts`.
- **Capacidades** `senales.resolver`, `senales.validar` y `umbrales.firmar` (`05`, `AG-80`).
- **Pruebas que cambian**: la 22 (base), quién tiene qué capacidad nueva; la 30, las rutas nuevas; las de la
  pantalla de Acquisition.
- **Pruebas nuevas**: 218, el detector es puro: bajo el piso no hay señal y se cuenta, la entidad es un id,
  lo de presupuesto va sólo a validación ejecutiva, la fila «sin anuncio» no compite (mutaciones: piso en 9;
  presupuesto en «Haz más de esto»). 219, el plan: el orden de los grupos, la ventana declarada, un
  superlativo sin ranking se quita (mutación: invertir dos grupos). 220 (base), el detector sobre la base
  sembrada da exactamente las señales esperadas.
- **Verificación**: el cron a mano en local con su cabecera de horario; la pantalla; una evaluación real de
  la redacción, con OK.
- **Documentos**: `docs/acquisition/06` y `14`, `futuro/plan-y-senales-de-acquisition.md`,
  `futuro/monitor-de-atribucion.md` y la cabecera de `app/api/acquisition/route.ts`, que hoy dice que el
  monitor está dormido.
- **Hito H3**: aplicar la `072`, paso 4b, comprobar las capacidades, push con OK.

## AG10 · Creative Insights

- **Hecho el 2026-10-05, sin push.** Sin migración: las tablas de la `072` ya guardan cualquier departamento, y
  las capacidades son las de AG9.
- **El detector** (`lib/agentes/detectores/creative.ts`, `fichas/F06-CREATIVE-INSIGHTS.md`): cuatro reglas
  —`CRE-CAIDA-DE-CTR`, `CRE-CONCENTRACION`, `CRE-FRECUENCIA-ALTA` y `CRE-ICP-POR-PIEZA`— sobre las mismas
  funciones y los mismos días que la pantalla, más la frecuencia de cada anuncio pesada por impresiones. Sólo
  piezas y anuncios: lo de campaña y de conjunto es de Acquisition (C11-04). El ICP se compara dentro de la
  etapa (C3-06). La unidad nueva `veces` en el catálogo, para la frecuencia. Lo que tiene de propio el plan
  vive en `lib/agentes/plan/creative.ts`; el armado, el orden y la ventana pasaron a `lib/agentes/plan/comun.ts`,
  que comparten los dos departamentos. Corre en la pasada diaria junto a Acquisition (`DETECTORES`).
- **El ciclo de módulos que apareció**: la frescura lee los horarios de `barrido.ts`, que importa la pasada, que
  importa este detector y su plan; importada arriba, el plan leía `CRE` antes de que existiera y la 221 se caía.
  Se carga al medir.
- **Las rutas**: `app/api/creative/senales` y `…/umbrales`, gemelas de las de Acquisition y no una función
  compartida (cada ruta llama al portero con su pantalla y abre su `conOrganizacion(`), y el GET de Creative con
  `senales` y `puedeConSenales`. `lib/agentes/senales/lectura.ts` resuelve al mostrar el nombre de un anuncio
  (`negocio.anuncios`) y el de una pieza (su id).
- **La pantalla**: el componente de AG9 pasó a `components/senales/SenalesDelDepartamento.jsx`, con el
  departamento como dato (nombre, ventanas de días cerrados o hasta hoy, si calcula gente perdida), y su estilo a
  `app/senales.css`, acotado a las dos vistas. Las escrituras del navegador, a `lib/negocio/vistaDeSenales.ts`.
  En Creative, el botón va en la barra y la tarjeta después de la fatiga.
- **Pruebas nuevas**: 226 (código: el grano, cada regla, el ICP dentro de la etapa, «sin medición», el plan), 227
  (base: la frecuencia, la frescura y los nombres al mostrar) y 228 (base: las rutas). Cambian la 104, la 107 y
  la 182 por la hoja nueva, y la 223: la pasada corre los dos detectores, y sobre la base sembrada Creative no
  publica nada y dice qué no pudo medir (no hay sello de la lectura de anuncios ni campo de ICP); sus dos pruebas
  de la redacción corren sólo Acquisition. Mutaciones, 26 vistas en rojo: la caída sin veredicto, la concentración con dos
  piezas o sin validación, la frecuencia sin piso o en 30 días, el ICP entre etapas o con la fila sin etapa, la
  pieza en dos etapas, la caída sin frescura, el ICP sin campo, la frecuencia en otro grupo, el CTR multiplicado,
  la frecuencia sin peso, las impresiones de los días sin frecuencia, «fallando» como al día, el anuncio y la
  pieza sin nombre, siete en las rutas, Creative fuera de la pasada y Creative midiendo sin la lectura al día. Queda verde la unión del anuncio sin `org_id`: la política de fila ya
  lo impide, y la unión por las dos columnas es la segunda línea.
- **Verificada en el preview local**, con señales de ejemplo en la empresa principal, a 1.440 y a 375 px: la
  tarjeta, el plan y «Ver evidencia» (marcó vista). Lo que encontró: el estilo de la tarjeta estaba acotado a
  `#v-acquisition` y en Creative se veían los botones del navegador; de ahí la hoja compartida.
- **Lo que sigue**: el push, con OK. La migración no hace falta.

## AG11 · Llamadas: objeciones, vínculo y agregados

- **Hecho el 2026-10-05, sin push.** La `073` (`negocio.objeciones_clasificadas`) sólo en local: va a producción
  antes del push que la lleve. Sin capacidad nueva.
- **La categoría de cada objeción** (`lib/analizadores/objeciones.ts`): el cuarto paso de la tarea del
  analizador, una pedida a `claude-haiku-4-5-20251001` por llamada, con lo que sobre de la corrida; por
  posición y por la huella del texto, así que una objeción que cambia con un nuevo análisis se clasifica de
  nuevo. El juego vive en `lib/analizadores/categorias.ts` para que quien cuenta no arrastre el transporte.
- **El vínculo** (`lib/negocio/vinculoDeLlamadas.ts`), al leer: por correo y, si no, por una sola cita a ±12
  horas; con dos contactos citados, ambigua.
- **Los agregados** (`lib/negocio/llamadasDeVenta.ts`, `lib/negocio/llamadasDeOnboarding.ts`) y sus dos
  herramientas del cerebro, con la sección Analizadores. Lo que se apartó de la ficha: las metas de onboarding
  no se cuentan (texto libre), las frases citables de onboarding quedan para después, y el cliente va por su
  empresa, sin nombre de persona.
- **El sembrado** suma las categorías de las objeciones («confianza» sin clasificar, para que la cobertura no
  sea completa) y tres llamadas de onboarding, una por estado.
- **Pruebas nuevas**: 229 (código: el juego cerrado igual en el código, el tipo y la migración; lo que vale de
  la respuesta; el vínculo y el estado del cliente), 230 (base: la tarea clasifica por reconciliación, con la
  red falsa) y 231 (base: los agregados sobre la base sembrada, a 30 días y «completo»: a 7 días la llamada de
  hace 7 entra o no según la hora). Cambian la 205 (el sembrado), la 213 y la 214 (las herramientas), y la red
  falsa de los Analizadores conoce a Haiku de las objeciones. Mutaciones, 17 vistas en rojo.
- **Lo que no se hizo**: una evaluación real de la clasificación (pide la llave de ARIA y el OK).

Lo que decía el plan:

- **Qué**: la categoría de cada objeción la pone Haiku en la tarea del analizador, por reconciliación (las
  que faltan se clasifican en la pasada siguiente); `lib/negocio/vinculoDeLlamadas.ts` (al leer),
  `lib/negocio/llamadasDeVenta.ts`, `lib/negocio/llamadasDeOnboarding.ts` y sus herramientas del cerebro. La
  pantalla de las llamadas no cambia por dentro.
- **Migración** `073`: `negocio.objeciones_clasificadas`.
- **Pruebas nuevas**: 223, las categorías son un juego cerrado con «otra», la cobertura viaja, el vínculo dice
  cuántas no casan (mutación: descartar las «otra»). 224 (base), «28 de 44» sobre la base sembrada.
- **Documentos**: `estado actual/14-ANALIZADORES.md`.

## AG12 · El Brief del closer — **grande** — **hito H4**

- **Hecho el 2026-10-05, sin push.** La `074` (`negocio.briefs_del_closer`) sólo en local: va a producción con el
  hito H4, antes del push. La `073` ya está en producción desde AG11. Sin capacidad nueva: leer pide
  `closer.ver` y generar `cerebro.usar`, como la caja del pie.
- **Lo que lee** (`lib/agentes/brief/entrada.ts`): el formulario (campos del CRM con valor), la ficha del lead,
  la ficha de la última llamada vinculada y las objeciones frecuentes de 30 días, cada dato con su clave de
  fuente; sin teléfono ni correo. **Lo que acepta** (`lib/agentes/brief/brief.ts`): lo detectado sin una
  fuente que se le dio, o con una cita que no está en ella, se degrada; lo de la empresa, sólo por su fuente.
- **La ruta** (`app/api/closer/brief/route.ts`, `maxDuration` 300): el GET lee el guardado y dice si hay datos
  nuevos y por qué no se puede generar; el POST genera al abrir (no cuenta) o regenera a mano (cuenta, con el
  candado de los topes). Más estricta que la ficha: territorio del closer y «mío». Bajo delegación y sin llave,
  no se genera.
- **La pantalla**: Mi Día marca cada cita con «BRIEF LISTO» y «SIN FORMULARIO» (la cita de la cola ahora trae su
  id), y la ficha abierta desde una cita —Mi Día o la Agenda— trae la pestaña «Brief», primera, que lo genera
  al abrir si no hay uno (`components/closer/BriefDeLaCita.jsx`, estilos en `app/closer.css`).
- **Pruebas nuevas**: 232 (código: cada dato con su fuente) y 233 (base: la ruta y las marcas, con el modelo
  falso). Cambian la 127 (la fila de la agenda abre con contacto y cita), la 133 (el cliente espera el tope de
  la ruta) y la 142 (el Brief resuelve el alcance propio, sin «ver como»). Un defecto que encontró la 232: una
  objeción degradada seguía marcada «de la empresa». Mutaciones, 14 vistas en rojo.
- **Hito H4 hecho el 2026-10-05**, con el OK del usuario: la `074` en producción (RLS forzada y su política,
  verificado con lectura) y push. **La evaluación real** (tanda `brief` de `scripts/evaluar-agentes.mjs`, 2
  llamadas): ningún dato degradado; un arreglo, «Sin rastro» ya no viaja como dato (`07`).

Lo que decía el plan:

- **Qué**: `lib/agentes/brief/*` (`fichas/F13-CLOSER-Y-BRIEF.md`), `app/api/closer/brief/route.ts`
  (`PANTALLA='closer'`, `maxDuration` declarado), la marca en la cola «TUS CITAS DE HOY» y la ficha.
- **Migración** `074`: `negocio.briefs_del_closer`, una fila por cita, en cascada con ella.
- **Pruebas nuevas**: 225, un dato detectado sin fuente se degrada, «mío» no sirve el Brief de otro closer,
  bajo delegación no se genera (mutaciones: aceptar lo detectado sin fuente; servir el ajeno). 226 (base).
- **Verificación**: una evaluación real, con OK.
- **Hito H4**: aplicar la `073` y la `074`, push con OK.

## AG13 · Conversation en la tabla común

- **Qué**: el traductor de hallazgos a señales con `issue_source` (`02`, `AG-37`), la tarjeta de Señales y el
  botón «Plan de acción» en su pantalla. El auditor no cambia.
- **Pruebas nuevas**: 227, la tabla de traducción cubre toda combinación, y el auditor sigue siendo el único
  escritor de `negocio.hallazgos` (mutación: que el traductor escriba en `hallazgos`).

## AG14 · Conversion

- **Qué**: el detector según la especificación validada (`fichas/F04-CONVERSION.md`), su plan con el formato
  CV6, su tarjeta y su botón.
- **Pruebas nuevas**: 228, sólo las tres primeras fugas, el bloque «No tocar», ningún nombre de persona
  (mutación: cuatro fugas en el plan).

## AG15 · La Reunión de hoy y el comentario de la cabecera — **grande** — **hito H5**

- **Qué**: `lib/agentes/reunion.ts` (dentro de la tarea `senales`), `lib/agentes/cabecera.ts`, las tarjetas
  en el Inicio en lugar de la nota de `components/views/ExecutiveView.jsx:202-204`, el contador en la barra y el
  comentario en la cabecera (`04`).
- **Migración** `075`: `negocio.reuniones_del_dia`.
- **Pruebas que cambian**: la 189 (las tarjetas vienen sólo del servidor), la 193 (el contador), la 194 (el
  comentario es nada cuando no hay nada, y no aparece en el teléfono).
- **Pruebas nuevas**: 229, las reglas de la Reunión, el filtro por persona antes de tomar tres, las
  plantillas sin llave (mutación: tomar tres antes de filtrar). 230, la prioridad del comentario y la regla
  del silencio (mutación: un comentario siempre encendido). 231 (base).
- **Verificación**: una evaluación real de la redacción, con OK.
- **Hito H5**: aplicar la `075`, push con OK.

## AG16 · El cierre

- `00-MAPA.md` con el estado de cada etapa, los resultados de la evaluación en `07`, las notas de «después
  del corte» en `estado actual/`, la memoria del proyecto, y una revisión de todas las citas con el mapa de los
  diffs. Push final con OK.
