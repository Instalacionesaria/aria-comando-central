# Estado actual — el mapa de la aplicación

> Corte: **2026-09-28**. Esta carpeta es una foto con fecha de Comando Central entero: qué está
> construido, qué es maqueta, qué datos hay y cuáles faltan, qué reglas valen y qué deuda queda.
> Cada afirmación lleva su archivo:línea, su commit o la consulta que la produjo; lo que no se pudo
> verificar está dicho como pendiente, no omitido. Las cifras de este mapa salen de los otros
> diecisiete archivos, que dicen cuándo midió cada una (todos el día; todos salvo 12, también la
> hora, que en 05 es aproximada). Trece de ellas se volvieron a leer en producción el 2026-09-28 a las **22:46 UTC**, en
> una sola consulta de agregados con
> `node --env-file=.env.supabase scripts/supabase.mjs leer` —organizaciones y activas, contactos,
> organizaciones con contactos, contactos desde el 2026-09-14, citas, citas con asistencia,
> resultados, ventas, último resultado, último día con gasto, mensajes y reuniones de tl;dv—, y
> dieron lo mismo que en esos archivos. Una verificación adversarial las repitió a las **23:03
> UTC**, junto con el gasto guardado y los anuncios con gasto, las HT y OB analizadas y las
> organizaciones con token del CRM y con llave de IA: dieron igual. Las demás son de ellos.
>
> **Desde el corte del 2026-09-15, en cinco líneas:**
>
> 1. Cinco maquetas pasaron a medir —Acquisition (09-16), Creative (09-19), Conversion (09-20), Sales
>    (09-21) y Leads Portal (09-26)— y queda una sola, Executive.
> 2. Nació una sección, Analizadores (09-23), y el menú pasó de 13 entradas a 14.
> 3. Debajo: `app/api/` de 17 carpetas a 23 y de 69 `route.ts` a 82; de 3 horarios programados a 5
>    y de 6 tareas a 9; de 49 migraciones a 62; de 1.746 pruebas a 2.273 (del mensaje de commit).
> 4. El negocio que todo eso mide casi se detuvo: el último día con gasto en Meta es el 2026-09-13, y
>    desde el 14 entraron 8 contactos.
> 5. La carpeta pasa de 10 archivos a 18 y cubre todo el menú, no sólo los cinco departamentos de
>    Inteligencia.
>
> **La foto anterior** se lee con `git show 1c55149:"docs/OTROS/estado actual/<archivo>"`: es la del
> 2026-09-15 con las correcciones fechadas que le agregaron `bddb516`, `c8494e6`, `3287f74`,
> `0add4cc`, `aed4f27` y `4fc9e43`, hasta el 2026-09-26, y el traslado a `docs/OTROS/` del
> 2026-09-28 (`e630823`, `1c55149`, que sólo cambiaron rutas). La original, tal como se escribió,
> se lee con `git show 93a1341:"docs/estado actual/<archivo>"` (commit del 2026-09-14 a las 21:52
> de Lima, las 02:52 UTC del 15). Los archivos 10 a 17 son nuevos y no tienen versión anterior.

Esta carpeta existe para contestar, antes de discutir qué construir, **qué hay de verdad detrás de
cada entrada del menú**: si mide o inventa, sobre qué datos, con qué reglas y qué le falta.

---

## 1 · Las catorce secciones del menú

El menú sale de una sola lista, `SECCIONES`, repartida en los grupos de `GRUPOS_DEL_MENU`: AIOS sin
rótulo, «Inteligencia», «Operación» y el pie (`lib/autorizacion/secciones.ts:145-161`). Una sección
es maqueta cuando lleva la bandera `sinOperacionesTodavia`, que dice que no tiene ninguna ruta de
servidor detrás; la lista de las que la llevan se deriva de ahí
(`lib/autorizacion/secciones.ts:454-456`). El 2026-09-15 la llevaban seis de trece —`executive`,
`contacts`, `acquisition`, `creative`, `conversion` y `sales`
(`git show 93a1341:lib/autorizacion/secciones.ts`)—; hoy, una.

| Grupo | Sección (clave) | Estado | Desde | Capacidad | Archivo | El titular, medido el 2026-09-28 |
|---|---|---|---|---|---|---|
| AIOS | Executive (`executive`) | **Maqueta** | el port, 2026-08-18 (`a7f8f91`); sin cambios de datos desde entonces | `tablero.ver` | [11](11-EXECUTIVE.md) | 179 literales numéricos y 14 contactos inventados. A 7 días dice 312 contactos, 8.525 de inversión y 11 ventas (`lib/aios/executive.js:17`); la base dice 3 contactos en esos 7 días y 0 ventas en toda su historia |
| AIOS | Leads Portal (`contacts`) | Construida | 2026-09-26 (`3c361a1`, `aed4f27`) | `tablero.ver` | [10](10-LEADS-PORTAL.md) | 277 personas a 30 días, 139 agendaron, contadas con los mismos predicados que Sales, Creative y Conversion. Cierre y monto salen «—»: 0 asistencias en 333 citas y 0 ventas |
| AIOS | ICP & Oferta (`icp`) | Construida | 2026-08-23 (`aa4da8e`) | `fundaciones.ver` | [12](12-ICP-Y-OFERTA.md) | De 11 organizaciones activas, 5 cargaron su llave de IA, 4 generaron alguna vez un documento y 2 generaron algo desde el 2026-09-15. Nada de lo que produce se cruza con un dato del negocio |
| Inteligencia | Acquisition (`acquisition`) | Construida | 2026-09-16 (`be5ba97`) | `tablero.ver` | [01](01-ACQUISITION.md) | 3.511,28 de gasto real guardado desde el 2026-08-18 en 63 de 79 anuncios, leído por GoHighLevel sin conectar Meta. El último día con gasto es el 2026-09-13, y la pantalla no lo advierte |
| Inteligencia | Creative (`creative`) | Construida | 2026-09-19 (`3287f74`) | `tablero.ver` | [02](02-CREATIVE.md) | A 30 días el ICP promedio va de 29,2 a 71,0 según la pieza (factor 2,4) y la tasa de agenda de 31 % a 78 %; todo describe un período que terminó el 2026-09-13 |
| Inteligencia | Conversion (`conversion`) | Construida | 2026-09-20 (`0add4cc`) | `tablero.ver` | [03](03-CONVERSION.md) | A 30 días, 5 de 276 contactos traen el formulario de la landing y la tasa sale «—»; el formulario se escribió por última vez el 2026-08-31 |
| Inteligencia | Conversation (`conversation`) | Construida | 2026-09-10 (`f0f09b7`); tablero desde el 2026-09-15 (`13ce499`) | `auditor.ver` | [04](04-CONVERSATION.md) | Las mismas 25 cifras de la foto anterior (23 con número y 2 huecos declarados), sobre 8 contactos nuevos en quince días; el sentimiento de Appointment Flow se va a apagar solo el 2026-10-08 |
| Inteligencia | Sales (`sales`) | Construida | 2026-09-21 (`c109ebd`, `1c875ac`) | `tablero.ver` | [05](05-SALES.md) | `negocio.resultados` tiene 7 filas, 0 ventas y 0 montos, y la última es del 2026-09-09; Executive dibuja 11 ventas en su nombre |
| Operación | Setter (`setter`) | Construida | 2026-08-24 (`9ef7ecc`) | `setter.ver` | [13](13-SETTER-Y-CLOSER.md) | Avanzar guarda resultado, etapa, nota, tarea, cita y asistencia en una transacción, y nadie registra nada desde el 2026-09-09 |
| Operación | Closer (`closer`) | Construida | 2026-08-24 (`9ef7ecc`) | `closer.ver` | [13](13-SETTER-Y-CLOSER.md) | 0 de 333 citas con la asistencia registrada; desde que existe la pregunta «¿se presentó?» pasaron 15 citas que se podían cerrar, y no se cerró ninguna |
| Operación | Analizadores (`analizadores`) | Construida | 2026-09-23 (`35665f2`) | `analizadores.ver` | [14](14-ANALIZADORES.md) | 115 reuniones de tl;dv y 48 analizadas (38 HT, 10 OB), en una sola empresa; nada fuera de la pestaña lee lo que produce |
| Operación | Tools (`tools`) | Construida | 2026-08-26 (`78e76f3`) | `tools.ver` | [15](15-TOOLS-Y-MONITOREO.md) | 16 scrapeos de 3 empresas en toda su historia, ninguno después del 2026-09-23; el plan de Prospección en Frío no lo generó nadie |
| Operación | Panel de Monitoreo (`monitoreo`) | Construida | 2026-08-29 (`166984e`) | `monitoreo.ver`, y `soloDesdeLaPrincipal` | [15](15-TOOLS-Y-MONITOREO.md) | Lo ven 3 personas; ingreso y margen salen «—» en las once filas porque ninguna empresa tiene precio cargado |
| Pie | Ajustes (`credenciales`) | Construida | 2026-08-24 (`9fa82c9`); el modelo de permisos, 2026-08-21 (`433ca86`) | `credenciales.ver`; sus pestañas Empresas y Usuarios, `organizaciones.listar` y `usuarios.ver` | [16](16-AJUSTES-Y-PERMISOS.md) | 32 capacidades, 3 roles, 13 organizaciones (15 el 2026-09-15) y 15 personas; el token del CRM está cargado en una sola organización y nadie tiene segundo factor |

Las fechas de «Desde» son las del commit que le dio a la sección su primera operación de servidor o
le borró la maqueta. La clave y la capacidad de cada fila están en
`lib/autorizacion/secciones.ts:171-442`; Empresas y Usuarios son secciones sin entrada propia en el
menú, pestañas de Ajustes (`lib/autorizacion/secciones.ts:172-191`). La capacidad de la sección no
es siempre la única puerta: guardar un prompt del auditor pide `auditor.editar`
(`app/api/auditoria/prompts/route.ts:69`), y el Panel de Monitoreo pide tres cosas a la vez
([16-AJUSTES-Y-PERMISOS.md](16-AJUSTES-Y-PERMISOS.md) § 3). El sexto departamento que la foto
anterior contaba en el organigrama del documento funcional, Business Intelligence, sigue sin
sección: ninguna clave de `SECCIONES` lo nombra.

---

## 2 · La situación general, en ocho hechos

**1 · Trece de las catorce secciones miden, y la única maqueta habla en nombre de las otras.** El
2026-09-15 medían siete de trece. Hoy la bandera queda sólo en `executive`
(`lib/autorizacion/secciones.ts:212-218`), y `lib/aios/` pasó de 13 archivos a 8: se borraron las
maquetas de Acquisition (dos archivos), Creative, Conversion y Leads Portal; la de Sales vivía en
`components/views/SalesView.jsx`, que pasó de 231 líneas a 82. Executive no cambió una línea de datos
desde el port, y lo que dibuja contradice a las seis pantallas a las que enlaza
([11-EXECUTIVE.md](11-EXECUTIVE.md) § 3, [09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md) § 9).

**2 · Lo que se mide describe un negocio con la adquisición apagada.** El último día con
`gasto > 0` en `negocio.metricas_de_anuncio` es el 2026-09-13, y desde el 2026-09-14 (medianoche de
Lima) entraron **8 de los 594 contactos** (leído el 2026-09-28 a las 22:46 UTC). Es compatible con la
pauta pausada y no está verificado contra Meta (la primera de las cinco mediciones de
[06-INTEGRACIONES-GHL.md](06-INTEGRACIONES-GHL.md)). Las ventanas se vacían solas: Acquisition,
Creative, Conversion, Conversation, Sales y Leads Portal abren en 30 días
(`lib/negocio/periodo.ts:109`), que ya describen casi sólo la primera quincena de septiembre; el
sentimiento de Appointment Flow se apaga el 2026-10-08 ([04-CONVERSATION.md](04-CONVERSATION.md)),
y Leads Portal queda bajo el piso de 10 a mediados de octubre
([10-LEADS-PORTAL.md](10-LEADS-PORTAL.md)). Acquisition y Creative no lo advierten en pantalla
([01-ACQUISITION.md](01-ACQUISITION.md), [02-CREATIVE.md](02-CREATIVE.md)). Por eso una cifra que
cae desde el 14 no se lee como una falla ([09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md) § 8 y § 12).

**3 · Todo el volumen es de una empresa.** De 13 organizaciones (11 activas), **1** tiene contactos
—los 594— (22:46 UTC); las 333 citas y los 6.110 mensajes son de la misma
([17-LA-PLATAFORMA.md](17-LA-PLATAFORMA.md) § 7). Es también la única con el token del CRM
cargado, así que las ocho tareas que dejan sello corren en ella y se saltean con su motivo en las
otras diez activas ([17-LA-PLATAFORMA.md](17-LA-PLATAFORMA.md) § 2,
[16-AJUSTES-Y-PERMISOS.md](16-AJUSTES-Y-PERMISOS.md) § 5).

**4 · Nadie registra el hecho comercial, y eso vacía tres pantallas.** `negocio.resultados` tiene 7
filas, 0 con `salida = 'venta'`, la última del 2026-09-09; `citas.asistio` está en 0 de 333 (22:46
UTC). El instrumento está entero; lo que falta es uso. De ahí salen el show rate de Conversation en
«—», los dos últimos eslabones de la cadena de Sales en 4 y 0, y el cierre y el monto de Leads Portal
en «—» ([13-SETTER-Y-CLOSER.md](13-SETTER-Y-CLOSER.md) § 5,
[10-LEADS-PORTAL.md](10-LEADS-PORTAL.md) § 2). La única señal de una venta está fuera del registro:
un contacto lleva en el CRM la etiqueta `venta_ganada` y no tiene resultado en la base
([05-SALES.md](05-SALES.md) § 5, [06-INTEGRACIONES-GHL.md](06-INTEGRACIONES-GHL.md) § 4).

**5 · «Agendó» todavía tiene dos definiciones.** Desde el 2026-09-21 hay un predicado compartido,
`tieneCitaAlcanzable` (`lib/negocio/citasAlcanzables.ts:115-145`, `1164984`), que excluye a quien
sólo tiene citas congeladas y que usan Acquisition, Creative, Conversion, Sales, Leads Portal y la
atribución de Lead Flow. El booking rate de Lead Flow, en la misma pantalla, cuenta cualquier cita:
a 7, 14 y 30 días coinciden porque no queda nadie así, y en «Completo» dice 279 agendados mientras
las filas de la atribución suman 200 ([07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) § 4,
[04-CONVERSATION.md](04-CONVERSATION.md) § 7). Y su cadena sigue sin ser un embudo: a 30 días
una barra de 161 respondieron a 139 agendaron diría 86,3 %, y los que agendaron habiendo contestado
son 73 de 161, el 45,3 % ([07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) § 11).

**6 · Lo construido en el período dejó datos que se escriben y nadie lee.** Analizadores audita
llamadas de venta de personas que están en `negocio.contactos` —22 de las 38 HT— y ninguna otra
pantalla lo cruza ([14-ANALIZADORES.md](14-ANALIZADORES.md) § 4,
[09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md) § 11). De los sellos de las tareas programadas, sólo
la Agenda del Closer, el chat de la ficha y Leads Portal leen alguno; ninguna
pantalla lee el de `anuncios`, `auditoria`, `mejora`, `analizadores` ni `reintentos`
([17-LA-PLATAFORMA.md](17-LA-PLATAFORMA.md) § 3). La medición de duración de Tools escribe en
una tabla que no existe en producción ([15-TOOLS-Y-MONITOREO.md](15-TOOLS-Y-MONITOREO.md) § 6). Y
el aviso de Lead Flow sigue sin lector
([07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) § 1 y § C).

**7 · El error más repetido sigue siendo dar un dato por inexistente.** Pasó tres veces hasta el
2026-09-15 y cuatro más en la semana siguiente; las siete, el dato venía de GoHighLevel
([07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) § A). El más caro fue creer que el gasto
de Meta necesitaba una credencial propia: GoHighLevel expone el Ad Manager con el mismo token
(`3d96e8c`, `lib/ghl/anuncios.ts:4-25`), y de esa frase colgaban veintiún KPI.

**8 · Lo que tendría que frenar un error no está puesto.** `main` no tiene protección de rama, y el
2026-09-21 dos corridas rojas de la CI llegaron igual a `main`
([17-LA-PLATAFORMA.md](17-LA-PLATAFORMA.md) § 5 y § 10). El repositorio es público, y el nombre de
pila de una persona del equipo está en 43 archivos y los apellidos de los dos closers que mide Sales
en 10 ([09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md) § 15). Y la auditoría de citas no mira las que
llegan a esta carpeta desde `docs/conversion/`, `docs/acquisition/`, `docs/creative/` ni los
comentarios del código (§ 4 de este mapa).

---

## 3 · Los archivos transversales

Los de sección están en la tabla de la § 1. Éstos cruzan todas las pantallas:

| Archivo | Qué contesta |
|---|---|
| [06-INTEGRACIONES-GHL.md](06-INTEGRACIONES-GHL.md) | Qué nos da GoHighLevel hoy (18 operaciones sobre 17 rutas, 16 con llamador; un piso de 1.432 llamadas por día), qué le estamos tirando, qué no nos puede dar, y **si hace falta conectar el API de Meta**, contestado con lo que ya está guardado |
| [07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) | Las reglas que valen para todas las pantallas —las 11 centrales, de la 12 a la 29, y las 30 a 41 que aparecieron desde el 2026-09-16—, cada una con el defecto que cerró, y los errores de método de la A a la M. **Leer antes de escribir una cifra nueva** |
| [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md) | Cómo ubicar cualquier cosa nombrada en la carpeta con el grafo de conocimiento (6854 nodos, 19569 aristas, 244 comunidades, corte del 2026-09-29), y qué no garantiza. Desde ese corte, los 18 archivos de esta carpeta están en el grafo |
| [09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md) | Lo que está roto o incompleto: los once puntos del 2026-09-15 uno por uno (uno cerrado a medias, ocho abiertos), la deuda nueva de cada sección y la que las cruza (§§ 9 a 18 y § 20), lo que falta verificar (§ 19), y la consulta para volver a medir cada punto |
| [16-AJUSTES-Y-PERMISOS.md](16-AJUSTES-Y-PERMISOS.md) | Quién ve qué: las capacidades, los roles, el alcance por persona, `soloDesdeLaPrincipal`, el portero, la entrada y las credenciales por organización, con las pruebas que vigilan cada regla |
| [17-LA-PLATAFORMA.md](17-LA-PLATAFORMA.md) | Lo que está debajo de las pantallas: el cron único con sus 5 horarios y 9 tareas, cómo se sabe si un dato está fresco, la base (40 tablas de `negocio` e `identidad`, todas con RLS forzada), la suite, la CI y los volúmenes por tabla |

---

## 4 · Cómo leer los informes de sección

Los once informes de sección —01 a 05 y 10 a 15— abren igual: un recuadro con el corte y, salvo en
12, la hora de la medición (en 05, aproximada); una línea en negrita con el estado y desde cuándo; el titular
medido y, donde algo se movió en el período, un bloque «Desde el corte del 2026-09-15» con sus
commits. Después vienen siete secciones, y el orden es deliberado:

1. **Qué pide el documento** — con sus números de sección, para volver a la fuente. El documento
   funcional no vive en el repositorio (`docs/sales/00-MAPA.md:47-48`), así que lo que no se pudo
   cotejar está dicho.
2. **Qué hay hoy en pantalla** — con archivo y línea.
3. **Lo que era maqueta y qué la reemplazó** en las que dejaron de serlo; en Executive, cada pieza
   inventada con el dato real que hay hoy para ella; en 12, 13 y 14, lo que queda escrito a mano.
4. **Datos que ya tenemos** — con su cobertura medida.
5. **Datos que faltan** — y de dónde tendrían que venir: GoHighLevel, Meta, la landing, tl;dv o el
   registro manual. La distinción decide el costo.
6. **Reglas propias** — vocabularios, umbrales, cohortes, y qué **no** se puede mezclar.
7. **Riesgos** — lo que rompería una cifra si se construye mal.

Dos se apartan, y lo dicen: [13-SETTER-Y-CLOSER.md](13-SETTER-Y-CLOSER.md) cambia la 4 y la 5 por
qué registra el closer y por qué está casi vacío, y [15-TOOLS-Y-MONITOREO.md](15-TOOLS-Y-MONITOREO.md)
tiene seis y empieza por qué son, porque Tools y el Panel de Monitoreo nunca estuvieron en el
prototipo. Los transversales tienen el orden de su tema.

**Las convenciones de toda la carpeta.** Una cita al código va entre acentos graves como
`ruta:línea` o `ruta:desde-hasta`, con ruta suficiente para que no sea ambigua; una referencia a otro
archivo de esta carpeta va como enlace y «§ N», nunca con línea. Toda cifra lleva su fecha, su
denominador y su población; si cambió desde la foto anterior van las dos, y la que no se pudo volver
a medir dice «del 2026-09-15, no re-medida». Ningún archivo nombra a una persona: el repositorio es
público.

**Qué audita la prueba de citas, y qué no.** `pruebas/codigo/101-las-citas-de-los-documentos.test.ts`
comprueba que cada cita de las carpetas auditadas resuelva a un único archivo y que su línea exista.
Esta carpeta entra a esa lista en un cambio que está en el árbol y todavía no tiene commit
(`pruebas/codigo/101-las-citas-de-los-documentos.test.ts:42`). El mismo cambio abre el patrón a
corchetes y, sólo entre `estado` y `actual/`, al espacio
(`pruebas/codigo/101-las-citas-de-los-documentos.test.ts:63-64`); hasta entonces una cita como
`app/api/monitoreo/[orgId]/route.ts` o una que entrara a esta carpeta se salteaba sin aviso
(`pruebas/codigo/101-las-citas-de-los-documentos.test.ts:52-61`). Con eso ya se auditan las que
`docs/sales/` y `docs/leads-portal/` hacen a esta carpeta; las de `docs/conversion/`,
`docs/acquisition/`, `docs/creative/` y los comentarios del código, no, porque no están en la lista
de auditadas. Varias ya quedaron corridas con esta reescritura
([09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md) § 17). Y una cita que resuelve no garantiza que muestre
lo que el texto dice ([07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) § J).

---

## 5 · Lo que esta carpeta NO es

**No es un plan.** No propone orden de trabajo ni estima esfuerzo. Es una foto con fecha, para que
la discusión sobre qué construir se haga sobre hechos medidos y no sobre lo que cada uno recuerda de
la maqueta.

**No es la aplicación vista con sus datos.** Desde el 2026-09-15 la aplicación se miró en el
navegador varias veces, y conviene separar qué se miró y dónde, porque son miradas que encuentran
cosas distintas:

- **Sin sesión**, el 2026-09-15 y el 16: el rediseño de Conversation, montando el marcado real sobre
  las hojas reales (`13ce499`), y la línea nueva de Lead Flow (`bddb516`). Los dos commits dejan
  escrito que falta la mirada con sesión.
- **Pendiente por falta de contraseña**, del 2026-09-16 al 19: Acquisition (`be5ba97`, `e1aefb8`,
  `be7ef03`, `c1093f4`) y Creative (`3287f74`, `332c0e6`) dejaron la comprobación visual con sesión
  como pendiente.
- **Con sesión, sobre la base local**, el 2026-09-20: Conversion (`0add4cc`), y después en los dos
  temas con 341 contactos sembrados en local (`00e251d`, que encontró la frase «A y B y C», un rótulo
  desalineado y el ancho de teléfono, y dejó este último sin tocar porque era del armazón). El ancho
  se arregló ese mismo día: `1020412` saca la barra lateral de la rejilla bajo 760 px y el cuerpo
  pasa de 75 px a 375 de 375 en las doce pantallas, mirado a 375, 760, 762, 880 y 1400 px; `0810498`
  recorre las doce a 375 px, encuentra tres que seguían desbordando de costado y las deja en
  `doc=375`. El arreglo sigue en `app/armazon.css:392-407` (leído el 2026-09-28, no vuelto a mirar en
  un navegador). `0810498` deja dicho lo que no arregla: la tabla de Monitoreo se desliza dentro de
  su propia caja, por decisión, y 7 px de Leads Portal que eran de la maqueta, borrada el 2026-09-26
  (`aed4f27`). Sólo `00e251d` nombra la base; `0add4cc`, `1020412` y `0810498` dicen «con sesión»
  sin decir cuál, y
  [07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) § H da estas miradas por hechas sobre la
  base local sembrada.
- **Humo con login de Analizadores**, el 2026-09-23 (`70a84c6`;
  `docs/OTROS/analizadores/ANALIZADORES.md:115`, `docs/OTROS/analizadores/ANALIZADORES.md:120`). El
  documento lo pone junto a la primera corrida real de producción
  (`docs/OTROS/analizadores/ANALIZADORES.md:212-214`), pero no dice sobre qué base se miró ni que
  se cotejaran cifras.
- **Sólo la hoja de estilos de Leads Portal**, el 2026-09-26: a escritorio, a 375 px y en los dos
  temas (`aed4f27`). La prueba de humo con sesión es un paso del usuario y no tiene registro
  ([10-LEADS-PORTAL.md](10-LEADS-PORTAL.md) § 2, [09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md) § 10).

Lo que no consta en ningún commit ni documento es que alguien haya abierto una pantalla **en
producción, con sesión iniciada y los datos reales**, y comparado lo que dibuja contra la base. Para
esta foto tampoco: no se levantó ningún servidor, y cada cifra «de pantalla» de la carpeta es lo que
el código produce sobre los datos medidos, reconstruido con consultas equivalentes a las de sus
módulos. La distinción importa: la mirada del 2026-09-20 encontró el ancho, la frase y la alineación,
que no son cifras; sólo la otra puede decir si los números que hoy manda la base entran y dónde quedó
la línea entre aviso visible y nota escondida ([09-DEUDA-ABIERTA.md](09-DEUDA-ABIERTA.md) § 19). Y un
tablero de cifras reales se ve exactamente igual que uno que las calcula mal.

**No es una corrida de la suite.** La suite no se corrió para esta foto: usa una sola base local y
otros archivos se escribían en paralelo. Donde un archivo dice que una prueba cubre algo, es leído,
no ejecutado, y las 2.273 pruebas son las del último mensaje de commit
([17-LA-PLATAFORMA.md](17-LA-PLATAFORMA.md) § 5).
