# El cerebro: el chat del Inicio, con datos de verdad

> **Estado:** **postergado el 2026-10-01**. La estructura nueva pone en el Inicio la caja de chat del diseño,
> **deshabilitada**, con una línea que dice que el cerebro llega en una próxima etapa
> (`docs/OTROS/nueva-estructura/04-EL-INICIO.md`, `NE-29`). Este archivo dice qué hace falta para
> encenderla.
>
> **Desde el 2026-10-04 lo planifica `docs/OTROS/agentes/`** (`03-EL-CEREBRO.md` y
> `fichas/F00-EL-CEREBRO.md`), con las decisiones del usuario. Las dos que este archivo dejaba abiertas
> quedaron cerradas: paga **la llave de cada empresa** (`D-02`) y la primera versión **lee, navega y
> recomienda**, sin actuar (`D-03`). Y una cambió: la evidencia va **dentro de la respuesta**, como un
> desplegable, no en un panel a la derecha (`D-28`). Lo de abajo queda como estaba escrito ese día.
>
> **El servidor del cerebro está hecho (AG5 y AG6, 2026-10-04)**: `lib/agentes/executive/`,
> `app/api/executive/route.ts` y una ruta `app/api/<carpeta>/cerebro/route.ts` por sección, con las herramientas
> de todas las secciones que ya miden. La pantalla llega en AG7.

## Qué es

Según el documento de producto, el centro de la app: la persona pregunta («¿cómo va la semana?», «¿qué
objeción frena más cierres?») y el cerebro responde:

- **la conclusión primero**;
- **las cifras con su muestra, su período y su fuente**;
- **botones de siguiente paso**;
- un panel a la derecha sólo cuando la respuesta se profundiza. Por ejemplo, las llamadas con la objeción,
  con la frase, el minuto y el enlace a tl;dv. Dos pantallas del lienzo de diseño lo dibujan: la respuesta
  con evidencia y el estado «no hay dato suficiente».

## Qué hace falta

1. **Un modelo.** Anthropic ya está integrado en ICP & Oferta y en los Analizadores, con la llave de cada
   organización. **Decisión abierta**: quién paga el chat. Puede ser la llave de cada organización (según el
   documento de producto, el 2026-09-30 la tenían 5 de 11) o una de ARIA.
2. **Herramientas de sólo lectura** que llamen a las funciones que ya miden, en `lib/negocio/`:
   - Leads Portal: `leadsDelPortal`;
   - Acquisition: `embudosDeAcquisition`;
   - Creative: `rendimientoDelCreativo`;
   - Conversion: `recorridoDelLead`;
   - Sales: `cadenaDeCierre`, `cierrePorCloser`;
   - las objeciones de los Analizadores.
3. **Cada herramienta corre con la sesión y la organización de quien pregunta** (la seguridad por filas de
   siempre). El cerebro **sólo ofrece las herramientas de las pestañas que esa persona tiene**: un closer no
   puede pedirle las cifras de Acquisition.
4. **Las conversaciones se guardan** en tablas nuevas, con la seguridad por filas forzada y un solo escritor,
   como el resto de la base. De ahí sale la lista de CONVERSACIONES de la barra lateral.
5. **Las reglas transversales**:
   - bajo el piso de muestra responde «no hay dato suficiente» y dice qué falta («0 de 333 citas tienen
     la asistencia registrada»);
   - una fuente que dejó de llegar se dice como tal;
   - una integración caída manda a Ajustes.
6. **La Reunión de hoy**: temas calculados cada mañana con reglas medibles (gasto en cero, caída de la
   entrada, citas sin asistencia registrada, una objeción que crece). Se dibujan como las tres tarjetas del
   inicio y como el contador de la barra.

**Decisión abierta**: si en la primera versión el cerebro sólo lee (lo recomendado) o también actúa, con
aprobación.

## Lo que ya está listo para eso

El Inicio, la caja de chat y la mascota (con su estado «pensando») quedan dibujados por la estructura
nueva. Encender el cerebro es conectar la caja, no rediseñar la pantalla.
