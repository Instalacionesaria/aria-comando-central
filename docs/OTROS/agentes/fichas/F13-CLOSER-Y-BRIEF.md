# F13 · Sales › Closer y el Brief del closer

> En la pantalla del Closer hay dos cosas: el cerebro en la caja del pie, con «mío» cuando aplica, y el
> **Brief del closer**, el único agente por contacto de esta fase: la preparación de cada cita, que se
> genera al abrirla (`D-19`).

| campo | valor |
|---|---|
| Tipo | OPERA |
| Lugar en el front | Sales › Closer: la cola «Agenda de hoy» de Mi Día (`components/closer/MiDia.jsx:98`; el Lienzo la llama «TUS CITAS DE HOY») con las marcas «BRIEF LISTO» y «SIN FORMULARIO», y la ficha que se abre desde ahí y desde la Agenda |
| Estado | El cerebro en la caja del pie, AG6. **El Brief, hecho** en AG12, el 2026-10-05 |
| Modelo | El del cerebro; el Brief, `claude-sonnet-5-5` |
| Permisos | Leer: `closer.ver`. Generar o regenerar el Brief: `cerebro.usar` (gasta tokens). Siempre con la sección `closer` y su alcance |
| Código | `lib/agentes/brief/entrada.ts` (qué lee), `brief.ts` (qué se pide y qué se acepta), `guardar.ts` (la tabla y las marcas); `app/api/closer/brief/route.ts` (`PANTALLA='closer'`); `components/closer/BriefDeLaCita.jsx`, en la ficha |
| Tabla | `negocio.briefs_del_closer` (`074`), una fila por cita, en cascada con ella |

## Lo que el cerebro lee acá

`mi_dia_del_closer`, `inicio_del_closer` (lo propio), `agenda_del_closer` y `pipeline_del_closer`, con los
mismos argumentos que sus rutas, y con `alcanceDeQuienMira`: un closer vinculado a su usuario ve **lo suyo**.

## El Brief: qué lee

- **El formulario** del contacto (`perfilDeLaFicha`, `lib/negocio/ficha.ts:459`).
- **La ficha del lead** (`fichaDelLeadDelPortal`, `lib/negocio/fichaDelLeadDelPortal.ts:137`): de dónde vino,
  su puntaje de ICP, su recorrido.
- **La ficha de una llamada anterior** del Analizador, si la llamada está vinculada al contacto (`F14`).
- **Las objeciones frecuentes** de las llamadas de venta de la empresa, por categoría (`F14`).

**Cada dato viaja con una clave de fuente** —`formulario:3`, `ficha:campana`, `llamada:facturacion`,
`objeciones_frecuentes`— y el modelo tiene que citarla. El formulario son los campos del CRM de las carpetas
elegidas que tienen valor, con la misma regla que la marca «SIN FORMULARIO» (`formulariosDe`). La llamada
anterior es la última HT analizada con ficha **vinculada a este contacto** por las dos vías de `F14`: una
ambigua no se le atribuye. **El teléfono y el correo no viajan.**

## El Brief: qué produce

Cuatro secciones, como el Lienzo (pantalla «Sales · Closer»):

| sección | qué dice | de dónde sale |
|---|---|---|
| **Quién es** | Lo que se sabe de la persona y de su negocio | el formulario y la ficha |
| **Qué dijo** | Sus palabras, **cada una con su fuente** («formulario, pregunta 6») | el formulario o la llamada anterior |
| **Objeción probable** | La que el formulario deja ver, con una sugerencia para responderla. Si el formulario no alcanza, **la más frecuente de las llamadas de la empresa, marcada como tal** («es la objeción más frecuente en tus llamadas, no algo que esta persona dijo») | el formulario; si no, las objeciones frecuentes |
| **Pregunta para abrir** | Una pregunta para empezar la llamada | lo anterior; no inventa datos de la persona |

## Requisitos

- **AG-F13-1 · Cada dato con su fuente.** Cada campo lleva estado, valor, fuente, cita y confianza; un dato
  «detectado» sin fuente **se degrada a ambiguo**, con el patrón de
  `lib/analizadores/nucleo/prospect-card.ts:17-19`. Se impone en código, no sólo en el prompt: también se
  degrada el que cita una fuente que no se le dio o una cita que no está en esa fuente (sin mayúsculas ni
  espacios de más). La objeción es «de la empresa» si y sólo si quedó detectada con la fuente de las
  objeciones frecuentes, diga lo que diga el modelo.
- **AG-F13-2 · Se genera al abrir la cita** y se guarda. No se regenera solo: si llegan datos nuevos (el
  formulario cambió, hay una llamada nueva), dice «hay datos nuevos · regenerar». Lo decide la **huella** de lo
  que leyó —formulario, ficha y llamada anterior—; las objeciones frecuentes no entran, porque cambian cada
  día y dirían «datos nuevos» de todos los Briefs sin que nada de la persona haya cambiado.
- **Dónde se ve**: la ficha que se abre desde una cita —la agenda de Mi Día o la Agenda— trae una pestaña
  «Brief», primera; abierta desde cualquier otra cola, la ficha es la de siempre.
- **AG-F13-3 · «SIN FORMULARIO»** cuando el contacto no tiene formulario: el Brief se genera igual, con lo que
  haya, y lo dice.
- **AG-F13-4 · Más estricto que la ficha** (`T-20`): exige la sección `closer` y, para un closer con «mío»,
  sólo sus citas. La ficha de hoy no filtra por territorio; el Brief sí, porque manda datos de una persona
  al modelo. También al leer el guardado. No atiende «ver como»: quien administra ya ve todo el territorio, y
  el Brief es de una cita que abrió, no una lista que el selector tenga que acotar
  (`pruebas/codigo/142-alcance-en-las-cuatro.test.ts`).
- **AG-F13-5 · Bajo delegación no se genera**: gastaría la llave del cliente. El ya guardado se lee.
- **AG-F13-6 · Sin llave**, la marca dice «sin llave de IA» y el Brief no se genera; la ficha sigue igual.
- **AG-F13-7 · Su ruta declara `maxDuration`**, y quien la llama espera al menos eso.

## Lo que no cubre

- Dos pestañas que abren la misma cita sin Brief a la vez lo piden dos veces: la segunda escritura reemplaza a
  la primera. No hay candado por cita; abrir es una acción de una persona.

## Topes

Generar al abrir la cita no cuenta; regenerar a mano sí cuenta para la persona (`06`, `AG-96`).

## Sugerencias en la caja del pie

«¿Qué citas tengo hoy?», «¿Qué citas pasadas me falta registrar?», «¿Cuánto llevo de comisión?».

## Qué dato falta

Asistencias y resultados registrados: hoy casi ninguna cita los tiene, y eso limita lo que el cerebro puede
decir del Closer. El Brief no depende de eso.
