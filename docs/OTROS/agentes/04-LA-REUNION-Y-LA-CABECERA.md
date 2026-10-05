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
- Lo que hoy está dibujado como «Próximamente»: la nota del Inicio (`components/views/ExecutiveView.jsx:75-77`),
  la fila de la barra (`components/Nav.jsx:165-174`) y el comentario que la cabecera no dibuja
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

## AG-71 · Se calcula una vez al día y se guarda

Dentro de la tarea `senales` (`02`, `AG-35`), **después** de los detectores, por empresa y día local. Se
guarda en `negocio.reuniones_del_dia` (migración `075`): **todos** los temas candidatos, ordenados, cada uno
con su sección de origen, su evidencia (ids y cifras) y **su propio texto**.

## AG-72 · El modelo ordena y redacta; las reglas detectan

- **Con llave**: Sonnet 5.5 (`D-15`: redactar no es clasificar) ordena los candidatos y redacta **un texto
  por tema, sin referencias cruzadas** entre temas: si un texto mencionara otro tema, filtrar por persona
  dejaría pasar lo de una sección que no ve. Lo redactado pasa por la validación de `03`, `AG-47`.
- **Sin llave**: el orden es el de las reglas (gravedad, después pérdida en contactos) y el texto sale de
  plantillas.

## AG-73 · Se filtra por persona y recién después se toman tres

Al leer, se quitan los temas de las secciones que la persona no ve (Det:194-195) y **después** se toman los
tres primeros. Elegir tres antes de filtrar dejaría con menos tarjetas a quien tiene secciones restringidas.
Si quedan menos de tres, se muestran los que haya; si no queda ninguno, la cinta dice que la pasada corrió y
no hubo temas, con su hora.

## AG-74 · Tocar un tema abre una conversación

Una conversación nueva, con origen `reunion`, con el tema y su evidencia ya cargados. El primer mensaje lo
arma el servidor con lo guardado; **el modelo no se llama hasta la primera pregunta**, y abrir el tema no
consume tope.

## AG-75 · El contador de la barra

Reemplaza a «Próximamente» en la fila «Reunión de hoy» (`components/Nav.jsx:165-174`): el número de temas
que esa persona ve hoy. La fila pasa a ser un botón que lleva al Inicio. Sólo la ve quien ve el Inicio, como
hoy.

## AG-76 · La hora de la cinta

«DE LA REUNIÓN DE HOY · HH:MM», con la hora local en que corrió la pasada. Con 11 de 13 empresas en `UTC` por
omisión (`00-MAPA.md`, lo medido en el Paso 0), esa hora hace visible una zona mal cargada.

## AG-77 · El comentario de la cabecera: reglas, sin modelo

Una línea por **departamento** (como la Simulación), calculada al leer, sin modelo (`D-12`), con la mascota
de 28 px. Prioridad:

1. **Lo que falta configurar** en el departamento, **con lo que su ruta ya resuelve**: el identificador del
   agente que audita Conversation lo resuelve hoy `app/api/auditoria/route.ts:82`. Una ruta de pantalla no
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
