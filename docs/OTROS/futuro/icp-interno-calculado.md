# Un ICP calculado por Comando Central

> **Estado:** pendiente, y **solo se documenta**. El Leads Portal se construye con el puntaje que
> calcula el CRM (`contactos.score`); este archivo dice cómo cambiar esa fuente sin rehacer la
> pantalla. Se construye cuando el equipo entregue las reglas pregunta → peso (`LPF-P01`).
> Pedido el 2026-09-26, al aprobar el plan del Leads Portal (`docs/leads-portal/`).
> Las cifras son de la medición de producción del **2026-09-27 00:10 UTC** —la misma de
> `docs/leads-portal/`, solo agregados, por `scripts/supabase.mjs leer`— salvo donde se dice otra fecha.
> Los identificadores son `LPF-<nn>` y las preguntas `LPF-P<nn>`: este archivo no vive en
> `docs/leads-portal/` y no tiene número de archivo; la F es de futuro.

## Qué se quiere

Hoy el tramo de ICP de un lead sale de **«Puntaje | ICP»**, un número de 0 a 100 que calcula un
workflow de GoHighLevel y que Comando Central solo copia: `sincronizar.ts` lo deriva de los campos
del contacto y lo guarda en `contactos.score` (`lib/negocio/sincronizar.ts:421`,
`lib/negocio/sincronizar.ts:524-530`), con el campo designado a mano en `CAMPO_DEL_PUNTAJE`
(`lib/ghl/contrato.ts:305`). La fórmula no está escrita en ningún archivo de este repositorio.

La idea es que **el puntaje lo calcule Comando Central**, a partir de las mismas respuestas del
cuestionario de calificación que ya se guardan en `contactos.campos_del_crm`
(`lib/negocio/sincronizar.ts:392-394`), con reglas escritas por la empresa: esta respuesta a esta
pregunta vale tantos puntos. Así el número tiene autor, fórmula a la vista y versión, y no depende de
que un workflow ajeno siga corriendo.

El documento funcional nombra un *«ICP calculado con ese formulario»* —el de la landing VSL (línea
585)— entre lo que Lead Flow no puede consumir antes de que exista (§ 9.6, línea 586 de
`C:\Users\USUARIO\Downloads\CC_Arquitectura_Funcional.md`), pero no dice quién lo calcula; hoy lo
calcula el CRM. Tampoco coincide del todo con lo que se propone acá: este ICP interno usa además las
respuestas del formulario de Meta, que el § 9.6 pone aparte, entre lo que sí está disponible antes de
agendar (línea 579). El perfil del lead del § 5.3 separa las
respuestas de Meta Lead Ads y las del formulario de la landing (líneas 253-254) del «ICP score» y el
«Segmento de ICP» (líneas 255-256).

**Y hay una trampa de nombres que conviene decir de entrada:** en este repositorio «ICP» ya significa
dos cosas (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:358-361`). La herramienta `icp` de Fundaciones
es un documento que describe al cliente ideal; esto es un **puntaje por contacto**. No se cruzan.

## Por qué: lo que se midió

### Hoy funciona, y ése no es el problema

En la cohorte de 30 días, **251 de 286** contactos tienen un puntaje positivo (alto 51 · medio 83 ·
bajo 117), y en los últimos 14 días no apareció ningún cero. El puntuador del CRM está corriendo. Lo
que este documento discute es **de quién depende**, no si hoy anda.

### Se depende de un puntuador que no se ve

- **La fórmula no está en ningún lado nuestro.** Lo más cerca que se llegó es inferir un corte desde
  afuera: la casa nunca rechazó por ICP a un contacto de 60 o más —0 de 67— y rechaza a dos de cada
  tres por debajo; *«lo puso alguien, no está escrito en ningún archivo de este repositorio»*
  (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:525-541`, medido el 2026-09-16). La medición de hoy es
  compatible: con la etiqueta `icp_rechazado` hay **0 en ICP alto**, 22 en medio, 45 en bajo y 1 sin
  calificar.
- **No tiene versión.** El CRM lo recalcula cuando el lead responde el cuestionario y la
  sincronización lo pisa en cada corrida (`lib/datos/esquema.ts:320-321`). Un 70 de agosto y un 70 de
  septiembre pueden venir de fórmulas distintas y nada en la fila lo dice.
- **Ya cambió de forma más de una vez.** El catálogo guarda la versión vieja del cuestionario
  (`📁 Score | ICP`, fuera del Perfil a propósito: `lib/ghl/contrato.ts:262-265`). Buscando en el
  catálogo por «icp», «puntaje» o «score» salen **diez campos**, y **nueve estaban vacíos** en la
  ventana de 14 días medida el 2026-09-16 —entre ellos `Puntaje Final` y `puntaje_encaje_icp`, que por
  el nombre eran candidatos a ser la afinidad que Acquisition necesita—
  (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:375-397`, `lib/negocio/calidadDelCreativo.ts:53-56`).
  Buscando solo por «score» o «puntaje» —sin `perfil_icp`— el 2026-09-21 salieron **nueve, con ocho
  vacíos** sobre todos los contactos, y el segundo con datos es `Pre-Score | Meta Lead Ads`, que es
  categórico y no un puntaje (`lib/ghl/contrato.ts:293-295`). Son dos búsquedas distintas en dos
  fechas, no dos conteos del mismo conjunto. Los dos dicen lo mismo: son rastros de puntuadores que
  alguien empezó y dejó.
- **Lo que llega por el CRM puede dejar de llegar sin que nada falle.** Dos instrumentos dejaron de
  reportar el 2026-08-30 y el 2026-08-31, y el tercero, el host de la URL, pasó de la landing al
  widget la semana del 2026-08-31; se supo midiendo, no por un aviso
  (`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:14-20`): «Form Landing VSL» no se
  escribe desde el 2026-08-31 (hoy vacío en 346 contactos) y el VSL de VTurb escribió ceros y dejó de
  reportar el 2026-08-30. La explicación medida es que cambió la ruta de entrada y medían la vieja
  (`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:22-23`): justamente el tipo de cambio
  que deja a un workflow sin alimentar un campo, y el puntuador es un workflow.

### El régimen de los ceros

**47 de los 471 puntajes valen exactamente 0**, y no están repartidos: por semana de alta son 3
(17-ago), 23 (24-ago) y 21 (31-ago), y **ninguno en los últimos 14 días**. El código ya lo dejó
escrito: *«No se sabe si el CRM calculó cero o si su workflow no corrió: el proveedor no dice la
diferencia»* (`lib/negocio/sincronizar.ts:414-420`). El primer registro del patrón, con los ceros
terminándose de golpe el 2026-09-03, está en `docs/acquisition/04-CALIDAD-DEL-LEAD.md:403-421`.

De las dos semanas que concentran 44 de los 47 ceros, la del 31-ago es la misma en que la ruta de
entrada pasó de la landing al widget de reserva
(`docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:38-46`); en la del 24-ago todavía entraba
por la landing el 74 % (medido el 2026-09-20 sobre `atribucion_ultima`, línea 44 del mismo archivo).
La base no dice si hay relación.

La consecuencia ya está en el producto: el Leads Portal va a contar esos ceros como «sin calificar»
(decisión del 2026-09-26), mientras Creative los **promedia** en su ICP por pieza
(`lib/negocio/calidadDelCreativo.ts:218`). Son dos lecturas del mismo número del CRM, y las dos son
defendibles porque el número no dice cuál es la correcta. Un puntaje propio no tiene ese problema:
**si Comando Central no lo calculó, vale `null`; si lo calculó, el 0 es un 0.**

### Dos cuestionarios para la misma pregunta

El grupo `calificacion` tiene **17 campos en 3 carpetas** (`lib/ghl/contrato.ts:288-291`; la
medición de hoy da los mismos 17 y las mismas 3). La carpeta `Contact` trae el puntaje y dos URL, la de
la web y la de las redes (`lib/ghl/contrato.ts:319-321`). Las cuentas no cierran: los comentarios de
cada carpeta suman 19 (3 + 7 + 9, `lib/ghl/contrato.ts:319-326`, el 3 escrito el 2026-09-21 y el 7 y
el 9 el 2026-09-07), y `lib/ghl/contrato.ts:289` cuenta como «preguntas del cuestionario» a los
dieciséis que no son el puntaje, URL incluidas. Cuántos campos hay hoy en cada carpeta no está medido
(queda en `LPF-08`). Las otras dos carpetas son el cuestionario, **en dos voces**:

- `📁 Score | ICP Nuevo`, el formulario de calificación vigente (`lib/ghl/contrato.ts:323-324`);
- `📁 Score | ICP Lead Form (Meta)`, *«el mismo cuestionario para quien entra por el formulario de
  Meta»* (`lib/ghl/contrato.ts:325-326`), con el nombre de cada campo escrito como pregunta entera
  (`lib/ghl/contrato.ts:337-339`).

Y hay contactos que contestaron los dos: *«Medido: 5 contactos tienen los DOS formularios
contestados»* (`lib/ghl/contrato.ts:350-352`; medido al escribir el comentario, en el commit del
2026-09-07, y la medición de hoy no lo repitió). Desde la base no se sabe si el puntuador del CRM pesa
igual las dos voces, ni cuál gana cuando están las dos.

## Cómo podría quedar

### LPF-01 · Las reglas: pregunta → peso, por empresa

Una tabla por empresa, porque cada subcuenta pregunta a su manera:

| Columna | Qué es |
|---|---|
| `org_id` | la empresa (RLS forzada, como todas las de `negocio`) |
| `pregunta` | una clave nuestra —p. ej. `ticket_promedio`— que agrupa las dos voces de la misma pregunta |
| `campo` | el **nombre** del campo en el CRM; una pregunta puede tener una fila por voz (Nuevo, Meta) |
| `respuesta` | el texto de la opción, tal como se guarda |
| `peso` | los puntos que suma esa respuesta |
| `activo` | para apagar una regla sin borrarla |

Nombre tentativo: `negocio.icp_reglas`, con su migración, su prueba de aislamiento y su lugar en
`lib/datos/esquema.ts`. **Pide migración la tabla de reglas** y, si `LPF-P04` se resuelve como
«guardado», también la columna del puntaje interno y la de su versión (`LPF-04`); las etapas LP-1 a
LP-7 no necesitan ninguna.

Tres cosas que salen de lo medido:

- **Solo preguntas de opción cerrada.** «A quién ayuda y qué entrega» es texto libre —el formulario
  de Meta le agrega *«Se especifico o sera rechazado»* (`lib/ghl/contrato.ts:358-359`)— y pesarlo
  exigiría un modelo, que es gastar. Las URL tampoco entran. El tipo de cada campo está en
  `negocio.campos_del_crm.tipo` (`lib/datos/esquema.ts:478`), y es lo primero que se mira.
- **Las opciones no están en el catálogo**: `TablaCamposDelCrm` no las guarda
  (`lib/datos/esquema.ts:470-489`). El vocabulario de cada pregunta sale de los valores ya guardados,
  y **se mueve**: en «Video Pre-Call» el CRM renombró «Sin abrir (0%)» a «Nada» el 2026-09-08
  (`lib/negocio/consumoDelPrecall.ts:44-48`), y hoy conviven 130 y 50. Una respuesta que ninguna
  regla nombra es **«no reconocida»**, no una respuesta que vale cero.
- **Las reglas no se pueden sembrar por migración**: *«ninguna migración puede sembrar datos por
  organización»*, y se midió con un `insert` que escribió cero filas sin error
  (`lib/ghl/contrato.ts:249-253`). O existe la pantalla de `LPF-07` desde el primer día, o las carga
  un script que corre como el inquilino.

### LPF-02 · Los campos se nombran, y se resuelven con `campoPorNombre`

Las reglas guardan el nombre del campo y lo resuelven a su identificador con `campoPorNombre`
(`lib/negocio/camposDelCrm.ts:307`), el mismo mecanismo que ya usan Creative, el precall, el
formulario y la confirmación. Es lo que una persona puede leer y verificar en una pantalla, y la
comparación es exacta (`lib/negocio/camposDelCrm.ts:302-303`).

El precio es el que el archivo declara: *«si alguien renombra ese campo en el CRM, esto devuelve
`null`»* (`lib/negocio/camposDelCrm.ts:298-300`). Para el puntaje eso significa que la pregunta queda
**sin campo** y se dice en el aviso; no que el lead pierde esos puntos en silencio.

Y un detalle que obliga a algo más: cuando dos campos tienen el mismo nombre, `campoPorNombre`
desempata por identificador y toma uno (`lib/negocio/camposDelCrm.ts:312-316`). Para una cifra es
correcto; para una regla escrita a mano, no, porque el catálogo tiene una versión vieja del mismo
cuestionario. **Un nombre que casa con más de un campo se rechaza al guardar la regla**, en vez de
dejar que el desempate elija.

### LPF-03 · `puntajeInterno`, una función pura

```ts
puntajeInterno(respuestas, reglas) → {
  puntaje: number | null;   // entero 0–100, o null
  motivo: 'sin_reglas' | 'sin_respuestas' | 'pocas_respuestas' | null;
  contestadas: number;      // preguntas con una respuesta reconocida
  noReconocidas: string[];  // preguntas cuya respuesta ninguna regla nombra
}
```

- `respuestas` es `contactos.campos_del_crm` tal cual, por identificador; `reglas` llegan **ya
  resueltas** (nombre → identificador) desde el servidor. Así la función no importa nada, como
  `lib/negocio/periodo.ts`, y corre igual en el navegador —para la vista previa— y en el servidor.
- La respuesta se compara sin mayúsculas, sin tildes y con los espacios colapsados.
- Una pregunta contestada en las dos voces cuenta **una vez** (cuál gana: `LPF-P02`).
- El resultado es `round(100 × puntos obtenidos / puntos posibles)`. Qué entra en «posibles» cuando
  una pregunta no se contestó es `LPF-P03`.
- **Sin respuestas da `null`, nunca 0.** Es la lección de los 47 ceros escrita como regla.
- Misma escala y mismo tipo que `contactos.score` (entero de 0 a 100), para que los cortes de LP-1
  valgan sin tocarlos.

### LPF-04 · El número lleva la versión de las reglas que lo produjo

Todo puntaje interno viaja con la versión de las reglas que lo produjo. Es lo que el del CRM no tiene
(ver «No tiene versión» arriba): cambiar un peso deja de ser un cambio invisible en el pasado de todos
los contactos y pasa a ser una fecha. Cómo se cumple depende de `LPF-P04`:

- **Si se guarda**, cada fila guarda el puntaje y la versión con que se calculó. Recalcular cuando
  cambian las reglas **no llama al CRM**: las respuestas ya están en `contactos.campos_del_crm`, así
  que es una pasada sobre nuestra propia tabla. Y tiene que ser así, no esperar a la próxima
  sincronización, porque los 25 contactos congelados ya no se refrescan.
- **Si se calcula al leer**, no hay puntaje guardado que lleve versión: todos los números de una
  respuesta salen de las reglas vigentes, y la respuesta de la ruta dice cuál es esa versión. Lo que
  se pierde es poder comparar un número de hoy con el que dio la versión anterior.

En los dos casos **se guarda —o se calcula— el puntaje, nunca el tramo**: el tramo se deriva al leer,
que es el requisito que la maqueta dejó a la vista al guardar dos leads inventados con el mismo 79 en
tramos distintos (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:514-518`).

### LPF-05 · El tramo del Leads Portal se alimenta de un solo punto: `tramosDelIcp`

La etapa LP-1 crea `lib/negocio/tramosDelIcp.ts`, sin imports, con `UMBRAL_ALTO = 75`,
`UMBRAL_MEDIO = 50`, `TRAMOS`, `tramoDelPuntaje` y `motivoSinCalificar`; LP-2 calcula el tramo en SQL
con esos mismos umbrales. **Todo lo que convierta un número en tramo pasa por ahí.** Para que el ICP
interno entre sin tocar la pantalla, a ese archivo se le agrega una sola cosa:

- `FUENTE_DEL_PUNTAJE = 'crm' | 'interno'`.
- `leadsDelPortal` y la ficha eligen la columna con un mapa cerrado —`crm` → `score`, `interno` →
  la del puntaje interno— leyendo esa constante. Ninguna otra línea del portal nombra `score`.
- `tramoDelPuntaje` y `motivoSinCalificar` reciben la fuente, porque **el significado del 0 depende de
  ella** (`LPF-P05`).
- La respuesta de la ruta dice qué fuente usó, y la pantalla lo rotula: «ICP calculado por el CRM» o
  «ICP calculado por Comando Central».
- Si la fuente es `interno` y la empresa no tiene reglas activas, la ruta lo dice en el aviso; no
  dibuja a todos como «sin calificar».

**Cambiar de fuente es cambiar esa constante, y volver atrás también.** Es una constante y no una
columna por empresa por el mismo motivo que `CAMPO_DEL_PUNTAJE`: hoy hay una sola subcuenta con
contactos, y el día que haya otra se muda a la configuración de la empresa
(`lib/ghl/contrato.ts:297-303`).

La condición para que el punto sea único es que no quede otro: hoy el corte también está escrito en
`lib/aios/leads-group.js:10`, y la maqueta del portal rotula sus tarjetas por su cuenta
(`aios-command-center_1.html:4724`). LP-6 los saca del camino del portal.

### LPF-06 · La ficha muestra los dos números mientras convivan

Durante la validación, y mientras alguien pueda querer volver atrás, la ficha del lead muestra el
puntaje del CRM y el interno uno al lado del otro, cada uno con su tramo. La lista y las tarjetas usan
solo la fuente vigente: dos tramos por fila en una rejilla no se leen.

### LPF-07 · La pantalla de reglas, con vista previa

Una lista editable de preguntas, sus voces, sus opciones y sus pesos. Al lado de cada pregunta, las
respuestas que ya existen en los contactos guardados y cuántas veces aparece cada una, para escribir
reglas sobre el vocabulario real y ver de entrada cuáles quedarían «no reconocidas».

Con una vista previa: al cambiar un peso, cómo quedaría el reparto por tramo —y la matriz de
`LPF-09`— sobre los contactos guardados, **sin escribir nada** y solo con conteos.

## Validarlo antes de encenderlo, sin gastar

Las respuestas ya están guardadas y hay un puntaje del CRM contra el que comparar, así que el ICP
interno se puede probar **entero contra el historial** antes de que la pantalla lo use. Sin llamar al
CRM ni a ningún modelo: una consulta de solo lectura por `scripts/supabase.mjs leer` y
`puntajeInterno` corriendo sobre sus filas en un script que **solo imprime agregados**, en la línea
de `scripts/medir-analizadores.sql`. Ni una fila, ni una respuesta suelta, sale de la corrida.

### LPF-08 · Primero, cuántos contestaron de verdad

La medición de hoy da **475 contactos con alguna respuesta del grupo `calificacion`**, pero ese
conteo incluye el propio «Puntaje | ICP» y los campos de URL, que viven en ese grupo. **No es la
cantidad de gente que contestó el cuestionario**, y esa cifra no está medida. Antes de contarla hay
que saber qué campos son el cuestionario: **cuántos campos tiene hoy cada una de las tres carpetas**,
porque los comentarios del código suman 19 y la medición da 17 (ver «Dos cuestionarios para la misma
pregunta»). Después, contar a la gente sin el puntaje y sin ningún campo de URL o de texto libre: por
voz (Nuevo, Meta, las dos) y por semana de alta, para ver qué pasó con el cuestionario cuando la ruta
de entrada cambió.

### LPF-09 · La matriz de acuerdo, contra los 471 puntajes del CRM

Filas: el tramo del CRM. Columnas: el tramo interno.

| CRM \ interno | alto | medio | bajo | sin respuestas |
|---|---|---|---|---|
| alto (108) | | | | |
| medio (158) | | | | |
| bajo (158) | | | | |
| en cero (47) | | | | |
| sin puntaje (122) | | | | |

Cómo se lee:

- **La diagonal sobre los 424 con puntaje positivo** dice cuánto se parece el interno al del CRM.
- **La fila de los 47 ceros** contesta una pregunta que hoy no tiene respuesta: si esos contactos
  tienen respuestas y el interno los pone en alto o medio, el CRM no los puntuó —su workflow no
  corrió—; si no tienen respuestas, el cero era «nada que puntuar».
- **La fila de los 122 sin puntaje** dice cuánta cobertura se gana o se pierde.
- **Con la etiqueta `icp_rechazado`**, cuántos caerían en alto interno. Hoy son 0 en alto del CRM; cada
  uno que aparezca sería un lead que la pantalla llama «ICP alto» y que la casa ya descartó por ICP.
  Esa celda no mide calidad —según lo medido, el rechazo por ICP opera como un corte en 60 del puntaje
  del CRM (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:525-541`, 2026-09-16)— sino **cuánta
  contradicción visible** traería el cambio (`LPF-P08`).

### LPF-10 · Contra el agendamiento

La otra vara es la única consecuencia que hoy se registra: **si el lead agendó**, con la misma
definición que el resto de las pestañas —`tieneCitaAlcanzable`
(`lib/negocio/citasAlcanzables.ts:135`), donde una cancelada cuenta y una congelada no—. Tasa de
agendamiento por tramo, con las dos fuentes, sobre la misma población, y con el piso
`PISO_DE_UNA_TASA = 10` en cada celda (`lib/negocio/indicadoresDeCitas.ts:309`).

La referencia del CRM ya está medida: el 2026-09-16, sobre 180 contactos, alto agendó 75,7 %, medio
50,8 %, bajo 53,1 % y los ceros 35,0 % (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:543-555`). **Medio y
bajo eran indistinguibles.** Un interno que separe al alto por lo menos igual, y además distinga medio
de bajo, es mejor en lo único que hoy se puede medir.

Lo que **no** sirve de vara, y por qué:

- **La cancelación o la cita viva**: según lo medido, el rechazo por ICP opera como un corte en 60 del
  puntaje del CRM (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:525-541`, 2026-09-16), y las citas de los
  descartados se cancelan al 94 % por el flujo de descarte (`lib/negocio/indicadoresDeCitas.ts:179-187`,
  2026-09-14). Medir contra eso favorece al CRM por construcción. «Agendó» cuenta las canceladas
  justamente para esquivarlo.
- **La asistencia**: `asistio` verdadero en 0 contactos y falso en 0.
- **La venta**: 0 contactos con venta.

Con esas tres lecturas se decide antes de que el interno clasifique un solo lead en pantalla: si
coincide mucho con el CRM, lo que se gana es independencia y versión; si coincide poco pero separa
mejor el agendamiento, es mejor; si coincide poco y separa peor, no se enciende.

## Decisiones pendientes

### LPF-P01 · Los pesos, y de dónde se parte

Es la condición para empezar, y la tiene el equipo. Tres puntos de partida posibles: **copiar la
fórmula del workflow del CRM**, si alguien puede leerla en GoHighLevel —la matriz de `LPF-09` daría
casi la diagonal y el cambio sería invisible, con la ganancia de tener la fórmula a la vista—;
**pesos nuevos** escritos por el equipo comercial; o **pesos ajustados a los datos**, que tientan y
son los más peligrosos: con cero ventas lo único que se puede ajustar es el agendamiento, y un puntaje
entrenado para predecir quién agenda no es un puntaje de encaje.

### LPF-P02 · Las dos voces, y la versión vieja

Qué campo de `📁 Score | ICP Nuevo` equivale a qué campo de `📁 Score | ICP Lead Form (Meta)`, si
`📁 Score | ICP` —la versión vieja— entra también, y **cuál gana** para los contactos que contestaron
las dos. `campos_del_crm` no guarda cuándo se escribió cada campo, así que «la más reciente» no se
puede saber desde la base.

### LPF-P03 · Qué pasa con una pregunta sin contestar

Se saca de los puntos posibles (el lead se mide solo por lo que contestó) o cuenta como cero (no
contestar es una señal). Y cuántas preguntas contestadas hacen falta para emitir un número; por debajo,
`null` con motivo `pocas_respuestas`.

### LPF-P04 · Guardado o calculado al leer

**Guardado** en una columna nueva de `contactos`, derivado en la misma pasada que `score` y
recalculado al cambiar las reglas: permite calcular el tramo en SQL, como hace LP-2, y comparar con
una consulta. **Calculado al leer**: siempre al día con las reglas, sin migración de columna, pero
saca el tramo del SQL y hace viajar `campos_del_crm` desde la base en cada lectura del portal —al
servidor, nunca a la lista—.

### LPF-P05 · Qué es un 0 interno

Con el CRM, 0 es «sin calificar» porque no se sabe si puntuó o no corrió
(`lib/negocio/sincronizar.ts:414-420`; Acquisition dejó la misma pregunta abierta en
`docs/acquisition/04-CALIDAD-DEL-LEAD.md:594-597`). Con el interno esa ambigüedad no existe: si no
hay respuestas, el resultado es `null`. Un 0 interno sería un lead que contestó todo y no sumó nada,
y lo natural es que sea **ICP bajo**. Es lo que obliga a que `tramoDelPuntaje` reciba la fuente.

### LPF-P06 · Qué otras cifras cambian de fuente

`tramosDelIcp` garantiza el Leads Portal y nada más. Creative lee el puntaje del CRM **por su
cuenta**, por nombre y sin pasar por `contactos.score` (`lib/negocio/calidadDelCreativo.ts:62`,
`lib/negocio/calidadDelCreativo.ts:135`), y el Perfil del closer muestra `score` como «Calificación»
(`lib/negocio/ficha.ts:502`). Si cambia la fuente, ¿cambian también ellas? Si no, el mismo lead va a
tener un ICP en el portal y otro en Creative y en el Closer, y eso se tiene que decir en las tres.

### LPF-P07 · Los cortes

El interno hereda 75/50 de LP-1, que a su vez los heredó de la maqueta. Los datos ya proponían el 60
(donde la casa deja de rechazar) como alternativa, confirmaban el 75 (donde salta el agendamiento) y
sostenían dos grupos, no tres (`docs/acquisition/04-CALIDAD-DEL-LEAD.md:589-592`). Con una escala nueva los
cortes se pueden revisar; el lugar para hacerlo ya es uno solo.

### LPF-P08 · La convivencia con el rechazo del CRM

Según lo medido, el rechazo por ICP opera como un corte en 60 del puntaje del CRM
(`docs/acquisition/04-CALIDAD-DEL-LEAD.md:525-541`, 2026-09-16): quién pone la etiqueta
`icp_rechazado` y con qué regla no está escrito en este repositorio. Y las citas de los descartados
se cancelan al 94 % por el flujo de descarte (`lib/negocio/indicadoresDeCitas.ts:179-187`,
2026-09-14). Con la fuente interna, un lead puede salir «ICP alto» y
rechazado por ICP a la vez. ¿Se muestra la contradicción en la fila, se avisa en la ficha, o se le
pide al equipo que el rechazo pase a seguir al puntaje interno? Esto último ya no es de esta pantalla:
Comando Central no escribe etiquetas.

### LPF-P09 · Quién edita las reglas

Quien tenga la pestaña (`tablero.ver` más la sección `contacts`), quien tenga `configuracion.editar`,
o solo un administrador. Cambiar un peso cambia el tramo de cientos de leads de una vez; la versión de
`LPF-04` hace que se vea, pero no decide quién puede.

## Lo que NO cambia

- **`contactos.score` se sigue guardando igual**, con el 0 como 0 y la ausencia como `null`
  (`lib/negocio/sincronizar.ts:524-530`). El interno nunca lo pisa: sin los dos no hay comparación ni
  vuelta atrás.
- **El descarte sigue siendo del CRM.** `ETIQUETAS_DE_DESCARTE` (`lib/ghl/contrato.ts:231-238`) sigue
  marcando quién está descartado, y el interno no descarta a nadie.
- **Ni sincronización nueva, ni llamadas al CRM, ni modelos.** Todo sale de lo que ya está en
  `contactos.campos_del_crm`.
- **Los rótulos y los tramos de LP-1** —ICP alto, medio, bajo y «Sin calificar»— mientras
  `LPF-P05` y `LPF-P07` no digan otra cosa.
- **La lista del portal no lleva respuestas del cuestionario**, igual que no lleva teléfono ni correo:
  las respuestas se ven en la ficha, como hoy en el Perfil (`lib/negocio/ficha.ts:459`).
- **El Perfil del closer y sus carpetas** (`lib/ghl/contrato.ts:318-330`), salvo lo que decida
  `LPF-P06`.

## Pruebas que va a necesitar

- `puntajeInterno` no importa nada, como `tramosDelIcp` (código);
- sin respuestas da `null` y nunca 0; la mutación que devuelve 0 tiene que verse roja (código);
- la comparación ignora mayúsculas, tildes y espacios repetidos (código);
- una respuesta que ninguna regla nombra queda en `noReconocidas` y no suma cero en silencio (código);
- la misma pregunta contestada en las dos voces cuenta una vez (código);
- con la fuente interna, un 0 va al tramo que decida `LPF-P05`, y el tramo en SQL coincide con
  `tramoDelPuntaje` en los bordes 0, 1, 49, 50, 74, 75 y 100 (base);
- cambiar `FUENTE_DEL_PUNTAJE` cambia el tramo de la lista y de la ficha, y ningún otro archivo del
  portal nombra `score` ni escribe 75 o 50 como corte (código, leyendo las fuentes);
- un nombre de campo que casa con dos campos se rechaza al guardar la regla (base);
- un campo renombrado en el CRM deja la pregunta «sin campo» y lo dice, sin bajar el puntaje (base);
- recalcular no llama al CRM: el contador de la red falsa queda en cero (base);
- recalcular no toca `contactos.score` (base);
- lo que escribe una empresa en sus reglas no lo ve otra (base, aislamiento);
- la vista previa y la validación no escriben nada (base).
