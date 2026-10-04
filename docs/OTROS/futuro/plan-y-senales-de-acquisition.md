# El Plan de acción y las Señales de Acquisition, con agentes de IA

> **Estado:** **postergado el 2026-09-30**, por decisión del usuario. El front de Acquisition vuelve al
> del prototipo (`docs/acquisition/14-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`), pero sin estas dos
> piezas: las van a producir **agentes de IA**, en una etapa posterior. Este archivo dice **qué falta,
> por qué falta y cómo volverían**, para que quien lo retome no tenga que reconstruirlo.
> Los requisitos ya están escritos: `docs/acquisition/06-SENALES-Y-PLAN-DE-ACCION.md` (`A6-`) y el
> § A11-05 de `docs/acquisition/11-LOS-SEIS-COMPONENTES.md`. Acá no se repiten; se ordenan.
>
> **Desde el 2026-10-04 lo planifica `docs/OTROS/agentes/`**: Acquisition es el piloto de los detectores
> (`fichas/F03-ACQUISITION.md`), sobre una tabla común de señales (`02-EL-CONTRATO-DE-SENALES.md`).
> Tres cosas de este archivo dejaron de ser ciertas y están marcadas abajo: el modal ya no existe, los
> umbrales se publican provisionales y se firman después, y las dos preguntas nuevas del § 5 tienen
> respuesta.

---

## 1 · Qué eran en el prototipo

- **«Plan de acción»**: un botón en el encabezado que abría el modal `recoModal` con nueve
  recomendaciones en cuatro grupos: «Lo que dice la data», «Ajusta o pausa esto», «Haz más de esto» y
  «Para otras áreas» (`aios-command-center_1.html:5643-5670`).
- **«Señales detectadas · sin recomendación automática»**: una tarjeta al final de la pestaña, con dos
  señales escritas a mano y un «Ver evidencia» sin cablear (`aios-command-center_1.html:2727-2741`).

Las dos salían de texto fijo. Ninguna se calculaba.

## 2 · Por qué no se construyen ahora

1. **La decisión del usuario:** las van a activar agentes de IA, y ésa es otra etapa del producto.
2. **No hay umbrales.** El § 18.19, punto 9, deja «definir umbrales iniciales» como pendiente, y los
   del prototipo estaban elegidos a ojo (`docs/acquisition/06-SENALES-Y-PLAN-DE-ACCION.md` § 7).
3. **No hay dónde guardarlas.** El § 18.13 pide una alerta de catorce campos, con `baseline`,
   `confidence` y `possible_causes`. No existe la tabla ni el par `entity_type`/`entity_id`.

**Mientras tanto la pantalla no las finge:** no se dibuja el botón ni la tarjeta. El marcado del modal
seguía montado en `components/Overlays.jsx`, sin nadie que lo abra. *Desde el 2026-10-01 ya no: el
archivo se borró con los paneles del prototipo, y la prueba 156 prohíbe sus ids.*

## 3 · Lo que ya está listo para cuando vuelvan

- **Los números sobre los que razonarían:** `lib/negocio/embudosDeAcquisition.ts` (AQ-3 del 14), con la
  ventana actual, la anterior y los pisos. Un agente no tendría que volver a calcular nada: lee eso.
- **El modal:** `recoModal`, con su cierre por velo, ✕ y Escape (`lib/aios/shell.js`), vigilado por
  `pruebas/codigo/156-cierre-de-los-overlays.test.ts`. *Ya no existe (2026-10-01): el plan se abre con
  `components/Ventana.jsx` e ids nuevos (`docs/OTROS/agentes/03-EL-CEREBRO.md`, `AG-57`).*
- **Las reglas de forma**, ya escritas en `06`:
  - cada señal viaja con el conteo sobre el que se calculó (A6-01);
  - bajo diez casos, se cuenta y no se publica (A6-02);
  - dice su ventana (A6-03);
  - su entidad es un id y nunca un nombre (A6-05);
  - tiene cinco partes (A6-12);
  - «Ver evidencia» muestra las filas que la produjeron (A6-14);
  - las recomendaciones de presupuesto van a «Requiere validación ejecutiva» (A6-22);
  - el plan se calcula sobre la ventana que dice mirar (A6-23).

## 4 · Cómo volverían

1. **Una tabla de alertas** con el esquema de catorce campos del § 18.13
   (`docs/acquisition/11-LOS-SEIS-COMPONENTES.md` § A11-05), RLS forzada y un solo escritor: el agente.
2. **El agente detecta; no decide.** Escribe `recommended_review`, no `recommended_action`. El § 18.1 le
   prohíbe a Acquisition concluir qué campaña «sirve», y el agente hereda esa prohibición.
3. **Los umbrales los aprueba una persona** antes de que el agente publique. Cada umbral queda escrito
   con quién lo decidió y cuándo. *Cambió el 2026-10-04 (`D-11`): se publican desde el primer día como
   provisionales, marcados, y el Admin de cada empresa los firma después, con quién y cuándo.*
4. **El front** vuelve a poner el botón y la tarjeta en su lugar del prototipo:
   - el botón «Plan de acción» en `ch-r`;
   - la tarjeta al final, con `sig`, `si`, `st-t`, `st-d` y `ev`, reglas que siguen en `app/aios.css`;
   - «Ver evidencia» abre las filas de la alerta.
5. **Pruebas:** que una alerta con bajo conteo no se publique; que la entidad sea un id; que una
   recomendación de presupuesto nunca caiga en «Haz más de esto».

## 5 · Preguntas que siguen abiertas

Las del § 8 de `docs/acquisition/06-SENALES-Y-PLAN-DE-ACCION.md`: el eje de cada señal, a qué abre «Ver
evidencia», dónde se guarda la señal, si el plan es generado o declarado, y quién es el dueño de una
fuga entre etapas. A esas se suman dos nuevas: **qué agente**, y **cada cuánto corre**. *Contestadas el
2026-10-04: un detector por reglas, que corre cada mañana a la hora local de la empresa (`D-09`); las del
§ 8 de `06` se resuelven en `docs/OTROS/agentes/fichas/F03-ACQUISITION.md`.*
