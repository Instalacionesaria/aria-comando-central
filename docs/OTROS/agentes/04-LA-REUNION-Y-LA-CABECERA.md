# La Reunión de hoy y el comentario de la cabecera

> Las dos piezas del cerebro que **no esperan a que alguien pregunte**: los tres temas del día en el Inicio
> (con su contador en la barra) y la frase de una línea en la cabecera de cada departamento. Las dos salen de
> reglas sobre datos reales; el modelo sólo ordena y redacta la Reunión. Requisitos `AG-70` a `AG-79`.
> Fichas: `fichas/F17-LA-REUNION-DE-HOY.md` y `fichas/F18-EL-COMENTARIO-DE-LA-CABECERA.md`.

---

## De dónde sale

- `D-12` y `D-13` de `00-MAPA.md`.
- Det:190-195 (el Inicio: chat al centro y tres tarjetas; cada tarjeta dice su origen; tocarla abre la
  conversación; se filtra por los módulos de la persona), Det:38 (el contador en la barra), Det:241 (las
  reglas de ejemplo) y Res:72 («llamadas sin usar»).
- El Lienzo, pantalla «Inicio · el cerebro»: la cinta «DE LA REUNIÓN DE HOY · 07:00» y tres tarjetas con
  etiqueta y origen (SIN DATOS NUEVOS, SIN REGISTRAR, SIN LECTOR).
- La Simulación: la frase del cerebro por departamento, con una mascota de 28 px, a la derecha del título.
- Lo que estaba dibujado como «Próximamente» antes de AG15: la nota del Inicio, la fila de la barra (las dos
  reemplazadas en AG15) y el comentario que la cabecera no dibuja
  (`components/CabeceraDeDepartamento.jsx:41-42`).

---

## AG-70 · De dónde salen los temas

Dos fuentes, y ninguna es el modelo:

1. **Las señales que requieren validación ejecutiva** (`02`, `AG-30`), abiertas o vistas.
2. **Las reglas medibles de la Reunión**, que viven en el mismo catálogo de umbrales que las señales, con su
   valor provisional y su denominador, y se firman igual (`D-11`):

| regla | qué mide | piso | etiqueta | origen |
|---|---|---|---|---|
| `REU-SIN-ENTREGA` | **Lee** la señal de Acquisition «sin entrega»; no la recalcula | el de la señal | SIN DATOS NUEVOS | Systems · Acquisition |
| `REU-CAIDA-DE-ENTRADA` | Contactos de los últimos 7 días cerrados contra los 7 anteriores; tema si caen un 40 % o más | 10 o más contactos en la ventana anterior | CADENA | Systems · Acquisition |
| `REU-CITAS-SIN-REGISTRAR` | El aviso de `cadenaDeCierre`: citas que ocurrieron y nadie registró | 10 o más citas pasadas | SIN REGISTRAR | Sales · Closer |
| `REU-OBJECION-FRECUENTE` | La categoría de objeción más frecuente en las llamadas de venta de 14 días. Dice «crece» sólo si la ventana anterior tiene 10 o más llamadas y la sube un 50 % o más; si no, se publica como conteo («6 en 14 días, contra 2 antes»), sin decir «crece» | 10 o más llamadas analizadas en la ventana | PATRÓN | Sales · Llamadas de venta |
| `REU-LLAMADAS-SIN-VINCULO` | Llamadas de venta analizadas en 30 días que no se pueden vincular a un contacto (`D-20`: «sin usar» es «sin vínculo») | 10 o más analizadas | SIN LECTOR | Sales · Llamadas de venta |
| (futuro) `REU-CONFLICTO` | Dos áreas que se contradicen (A7-11) | — | CONTRADICCIÓN | las dos áreas |

Las etiquetas son un juego cerrado: las de Det:194 (cadena, contradicción, patrón, sin datos, sin
registrar) más SIN LECTOR, que el Lienzo usa. El Lienzo atribuye las citas sin registrar a Conversation;
acá el origen es **Sales · Closer**, que es donde se registran.

Lo que fijó la construcción (`lib/agentes/reunion/reglas.ts` y `temas.ts`):

- **Los umbrales provisionales**: «sin entrega», una señal; la caída de la entrada, 40 %; las citas sin
  registrar, una; la objeción frecuente, una en la ventana; las llamadas sin vínculo, una de cada cinco
  (20 %). Las cinco reglas están en el catálogo con el departamento `reunion`.
- **Las señales de validación ejecutiva entran desde la ventana de 30 días**: la misma decisión aparece en las
  dos ventanas y un tema por decisión basta. El texto de la señal habla de «la ventana», que en su pantalla
  se ve arriba; en la tarjeta se agrega «Sobre los últimos 30 días».
- **«Sin entrega»** lee la señal de 7 días, que mira los últimos días cerrados. Si es de la empresa, el tema
  usa su texto y su gravedad; si son campañas sueltas mientras otras siguen, es alta y las nombra.
- **La entrada** se cuenta en días de la empresa (su zona), con los 7 días cerrados contra los 7 anteriores.
- **«Crece»** es el de `llamadasDeVenta`, con su piso (`AG-F14-1`); la tarjeta no lo recalcula.

## AG-71 · Se calcula una vez al día y se guarda

Dentro de la tarea `senales` (`02`, `AG-35`), **después** de los detectores, por empresa y día local. Se
guarda en `negocio.reuniones_del_dia` (migración `075`): **todos** los temas candidatos, ordenados, cada uno
con su sección de origen, su evidencia (ids y cifras) y **su propio texto**.

- **Una vez por día**: la pasada no entra si los departamentos ya corrieron, la tarea está sellada hoy y la
  fila del día existe. Sin la fila, la hora siguiente la rehace sin volver a medir los departamentos.
- **Un departamento que falló no la frena**: sus señales de ayer siguen abiertas y entran tal cual. Un
  detector roto no debe dejar a la empresa sin Reunión.
- La pasada con una lista de detectores a medida (las pruebas de un detector) no mide la Reunión.

## AG-72 · El modelo ordena y redacta; las reglas detectan

- **Con llave**: Sonnet 5.5 (`D-15`: redactar no es clasificar) ordena los candidatos y redacta **un texto
  por tema, sin referencias cruzadas** entre temas: si un texto mencionara otro tema, filtrar por persona
  dejaría pasar lo de una sección que no ve. Lo redactado pasa por la validación de `03`, `AG-47`.
- **Sin llave**: el orden es el de las reglas (gravedad, después pérdida en contactos) y el texto sale de
  plantillas.

Lo construido (`lib/agentes/reunion/redaccion.ts`; la pasada, en `lib/agentes/detectores/correr.ts`):

- **Primero se guarda, después se redacta**, como el plan: un solo pedido por empresa y día, con la misma
  espera (la menor entre 120 s y lo que le queda a la función menos 15 s). Sin temas no hay pedido. Si no
  llega, quedan el orden de las reglas y las plantillas.
- **El orden**: sólo claves que existen, sin repetir. Lo que el modelo no nombró va al final, en el orden de
  las reglas: un tema no se pierde porque el modelo lo olvidó.
- **Cada frase se valida contra su propio tema**, y la que no pasa conserva la plantilla: ninguna cifra que
  su texto no traiga, ningún superlativo, ningún término «entre comillas» ajeno y ningún nombre del origen de
  otro tema que no sea también del suyo («Acquisition» en un tema de Closer; «Sales» en uno de Closer sí
  vale). Esta última es la regla de las referencias cruzadas, medida.
- La validación de `03`, `AG-47`, es la de las cifras del cerebro contra su evidencia; acá la evidencia es el
  texto del tema, y la regla es la misma.

## AG-73 · Se filtra por persona y recién después se toman tres

Al leer, se quitan los temas de las secciones que la persona no ve (Det:194-195) y **después** se toman los
tres primeros. Elegir tres antes de filtrar dejaría con menos tarjetas a quien tiene secciones restringidas.
Si quedan menos de tres, se muestran los que haya; si no queda ninguno, la cinta dice que la pasada corrió y
no hubo temas, con su hora.

Lo construido (`lib/agentes/reunion/leer.ts`, `components/cerebro/ReunionDeHoy.jsx`):

- El GET del Inicio la trae sin `?hilo=`, con `tablero.ver`: sólo lee, así que se ve sin llave, sin
  `cerebro.usar` y bajo delegación (`AG-79`). La tarjeta no lleva la evidencia; viaja al abrir el tema.
- Antes de la pasada de la mañana se ve la última que corrió, con su fecha: «De la última Reunión · 5 de
  octubre, 06:23». No se hace pasar por la de hoy, y no suma al contador.

## AG-74 · Tocar un tema abre una conversación

Una conversación nueva, con origen `reunion`, con el tema y su evidencia ya cargados. El primer mensaje lo
arma el servidor con lo guardado; **el modelo no se llama hasta la primera pregunta**, y abrir el tema no
consume tope.

Lo construido (`app/api/executive/reunion/route.ts`, `lib/agentes/reunion/leer.ts`; el hilo lo escribe
`abrirHiloDeUnTema`, en el único escritor de las conversaciones):

- **Un turno ya respondido**: lo tocado («SIN REGISTRAR · Sales · Closer») y, como respuesta, el tema con su
  evidencia y la pantalla de su sección como siguiente paso. Así la primera pregunta ya tiene el tema en el
  hilo que ve el modelo. El tope se cuenta en `preguntas_del_executive`, donde abrir no escribe.
- **Pide `cerebro.usar`**, como preguntar y borrar: escribe un hilo a nombre de quien toca (`D-14`). Sin esa
  capacidad, o bajo delegación, las tarjetas se leen pero no se abren. La llave y el tope no hacen falta.
- **El mismo tema del mismo día vuelve a su conversación**; un tema de una sección que la persona no ve da
  404, como uno que no existe. Puede abrirse cualquiera de los que ve, no sólo los tres de las tarjetas: la
  redacción puede cambiar el orden.
- **Lo que encontró la prueba 240**: los dos mensajes iban en la misma transacción, con la misma hora, y el
  hilo los devolvía en cualquier orden. La respuesta lleva la hora del reloj.

## AG-75 · El contador de la barra

Reemplaza a «Próximamente» en la fila «Reunión de hoy» (`components/cerebro/ReunionDeLaBarra.jsx`): el
número de temas que esa persona ve hoy. La fila pasa a ser un botón que lleva al Inicio sin una conversación
abierta, donde están las tarjetas. Sólo la ve quien ve el Inicio, como antes. La barra no le pide nada al
servidor: el número lo publica el Inicio cada vez que lee su panel, por el mismo camino que los hilos de
CONVERSACIONES (`lib/agentes/hilos-de-la-barra.ts`). Sin temas de hoy no hay contador.

## AG-76 · La hora de la cinta

«DE LA REUNIÓN DE HOY · HH:MM», con la hora local en que corrió la pasada. Con 11 de 13 empresas en `UTC` por
omisión (`00-MAPA.md`, lo medido en el Paso 0), esa hora hace visible una zona mal cargada.

## AG-77 · El comentario de la cabecera: reglas, sin modelo

Una línea por **departamento** (como la Simulación), calculada al leer, sin modelo (`D-12`), con la mascota
de 28 px. Prioridad:

1. **Lo que falta configurar** en el departamento, **con lo que su ruta ya resuelve**: el identificador del
   agente que audita Conversation lo resuelve hoy `app/api/auditoria/route.ts:68`. Una ruta de pantalla no
   suma identidad sólo para la cabecera; lo que no resuelve se dice por su consecuencia, que es un dato que
   cualquiera de esa pantalla puede ver: «Sin datos nuevos del CRM desde el 13 de septiembre» (la
   frescura). El detalle de la credencial, sólo a quien tiene `credenciales.ver`: el catálogo le niega
   `credenciales.%` al rol `usuario` justamente porque ahí se ven los estados de conexión de la empresa.
2. **La señal abierta más grave** del departamento, si es crítica o alta.
3. **Una regla medible** que aplique al departamento: en Sales › Closer, «15 citas pasadas esperan que
   registres si el prospecto se presentó» (el aviso de `cadenaDeCierre`); en Acquisition, la caída de la
   entrada cruzada con el gasto.
4. **Lo que falta en Fundaciones**: en Research, el paso del método que falta; en Marketing, los datos que
   harán salir «[COMPLETAR]» en un guion.
5. **Nada.** Sin una de las anteriores, no se dibuja nada: es la regla del silencio
   (`docs/OTROS/estado actual/07-REGLAS-TRANSVERSALES.md:82-152`). La frase descriptiva de Client Success de
   la Simulación no sale: no dice nada medido.

## AG-78 · Quién lo sirve

**El GET de la pantalla abierta**, con la capacidad de su sección: el comentario sale de reglas y lo que sale
de reglas funciona sin llave (`D-02`), así que no puede depender de `cerebro.usar`. El panel abierto le
entrega el comentario a la cabecera.

La cabecera tiene hoy el título y las pestañas en la misma fila; meter el comentario a la derecha del título
obliga a reordenar `.cd-arriba` (`components/CabeceraDeDepartamento.jsx`), y a sacar el comentario del
bloque «lo que no se dibuja» de `:41-42`.

## AG-79 · Teléfono y delegación

- En el teléfono **no se dibuja** el comentario (`D-27`). La Reunión del Inicio sí.
- Bajo delegación se ven los dos: sólo leen.

---

## Lo que no se pudo verificar

- La hora del Lienzo (07:00) es un ejemplo, no una decisión. La tarea corre a partir de las 6:00 locales en
  el minuto 23, así que la cinta va a decir la hora real de la pasada.

## Preguntas abiertas

Ninguna para el usuario. Los valores de las reglas son provisionales y se firman con `D-11`.
