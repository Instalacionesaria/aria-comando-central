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
  cerebro fue en la `071` y en las pruebas 206 a 213, y lo que el plan numeraba `071` a `074` pasó a `072` a
  `075`. Los números de prueba de las secciones de abajo son los del plan y se reasignan en su etapa.
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

## AG6 · El cerebro, servidor II — **grande**

- **Qué**: el resto de las herramientas de `03`, `AG-42` (Creative, Conversion, Conversation, Setter,
  Closer, Radar, Funnel, ICP & Oferta), las dos nuevas (`economiaDelNegocio`, `leadsDelScraper`) y las rutas
  finas `…/cerebro` de cada sección.
- **Pruebas nuevas**: 210, las herramientas ofrecidas son exactamente las de las secciones visibles; la de dos
  secciones, sólo con las dos (mutación: ofrecer el catálogo entero). 211, cada adaptador devuelve
  exactamente sus claves, y ningún resultado lleva `@` ni un teléfono (mutación: dejar pasar `email`). 212
  (base), cada herramienta da la misma cifra que la ruta de su pantalla, en las cuatro ventanas (mutación:
  recalcular en el adaptador).

## AG7 · El cerebro en pantalla — **grande** — **hito H2**

- **Qué**: el chat del Inicio (la caja habilitada, burbujas, la mascota con estados, la evidencia
  desplegable, el estado sin llave, bajo delegación o con tope, «@ agente»), la caja del pie con el panel que
  sube, CONVERSACIONES como lista navegable, el traspaso (`lib/agentes/traspaso.ts`) y los topes en Ajustes
  (`app/api/admin/cerebro/route.ts`). El borde de la caja llega a contraste 3:1.
- **Pruebas que cambian**: la 197 (la caja habla con su ruta, nombra la entrada con el dato, no se dibuja en
  el teléfono), la 189 (las respuestas vienen sólo del servidor, ninguna cifra escrita) y la 162 (el panel no
  aparece en el teléfono; el chat del Inicio sí).
- **Pruebas nuevas**: 213, la evidencia es un desplegable dentro de la burbuja, el avatar va sólo en la
  primera, la mascota sigue su tabla, ids nuevos (mutaciones: avatar en todas; un panel lateral). 214, «@
  agente» carga el pedido sin enviarlo (mutación: enviarlo).
- **Verificación**: preview local y el arnés de React a 1440 y 375 px, como admin, como `usuario`
  restringido y bajo delegación. **Una evaluación real del cerebro, con el OK del usuario** (`07`).
- **Documentos**: `nueva-estructura/09-LA-SEGUNDA-EDICION.md` (lo «Próximamente» que deja de serlo) y los
  comentarios de `components/Nav.jsx` y `components/ConsultaAlCerebro.jsx`.
- **Hito H2**: aplicar la `070`, paso 4b, comprobar `cerebro.usar` en `roles_permisos`, push con OK.

## AG8 · Las señales

- **Qué**: `lib/agentes/senales/*`, `lib/agentes/plan/` (la parte que guarda), `lib/agentes/detectores/correr.ts`
  y la tarea `senales` del cron (`02`, `AG-35`): `Tarea`, `TAREAS`, `HORARIOS['23 * * * *']`, la excepción
  del token del CRM, `vercel.json`.
- **Migración** `072`: `senales`, `planes_de_accion`, `umbrales`, y el `check` de `tareas_programadas` suma
  `senales`.
- **Antes**: que alguien de ARIA cargue la zona real de las empresas activas (`00-MAPA.md`).
- **Pruebas que cambian**: la 99 (el horario en las dos listas, la tarea en la excepción; mutación: sacarla
  de la excepción).
- **Pruebas nuevas**: 215, la huella: una descartada no renace mientras la condición siga, una que sube de
  gravedad nace de nuevo, `sin_medicion` cuando la fuente se apaga (mutaciones: huella única sólo entre las
  abiertas; cerrar sola sin mirar la frescura). 216 (base), la reconciliación sobre la base. 217, la hora
  local: Lima a las 6:23 corre y a las 5:23 no, una vez por día y por departamento, a las que no les toca no
  se las sella, sin datos de anuncios no hay señales de costo (mutación: comparar en UTC).

## AG9 · Acquisition, el piloto — **grande** — **hito H3**

- **Qué**: el detector (`fichas/F03-ACQUISITION.md`, con la tabla A6-01 a A6-24 regla por regla), el monitor
  de atribución en días cerrados, el Plan de acción con sus cinco grupos y su redacción, y en la pantalla: el
  botón «Plan de acción» en `components/acquisition/PanelDeAcquisition.jsx:172` y la tarjeta de Señales al
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

- **Qué**: el detector (`fichas/F06-CREATIVE-INSIGHTS.md`), su Plan de acción con el formato C6, la tarjeta y
  el botón en su pantalla, sus rutas de señales y umbrales.
- **Pruebas nuevas**: 221, el grano: Creative publica piezas, nunca campañas ni conjuntos (mutación:
  publicar una señal de campaña). 222 (base), el detector sobre la base.
- **Documentos**: `docs/creative/06` y `11`.

## AG11 · Llamadas: objeciones, vínculo y agregados

- **Qué**: la categoría de cada objeción la pone Haiku en la tarea del analizador, por reconciliación (las
  que faltan se clasifican en la pasada siguiente); `lib/negocio/vinculoDeLlamadas.ts` (al leer),
  `lib/negocio/llamadasDeVenta.ts`, `lib/negocio/llamadasDeOnboarding.ts` y sus herramientas del cerebro. La
  pantalla de las llamadas no cambia por dentro.
- **Migración** `073`: `negocio.objeciones_clasificadas`.
- **Pruebas nuevas**: 223, las categorías son un juego cerrado con «otra», la cobertura viaja, el vínculo dice
  cuántas no casan (mutación: descartar las «otra»). 224 (base), «28 de 44» sobre la base sembrada.
- **Documentos**: `estado actual/14-ANALIZADORES.md`.

## AG12 · El Brief del closer — **grande** — **hito H4**

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
  en el Inicio en lugar de la nota de `components/views/ExecutiveView.jsx:75-77`, el contador en la barra y el
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
