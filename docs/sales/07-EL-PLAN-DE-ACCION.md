# El «Plan de acción», y los otros dos controles muertos

> Requisitos derivados del prototipo de Sales y de una medición propia sobre el código del
> **2026-09-20**. Cada afirmación lleva su `archivo:línea`.

`components/views/SalesView.jsx:22-49` dibuja tres controles en la mitad derecha del encabezado. **Los
tres están muertos, y cada uno de una forma distinta.**

---

## S7-01 · El botón «Plan de acción» — no abre nada, y eso lo hace el peor de los tres prototipos

`SalesView.jsx:23-28`, `className="reco-btn"`, `id="slPlanBtn"`, con el glifo `◈`.

**No tiene ningún oyente.** `slPlanBtn` aparece exactamente dos veces en todo el árbol servido:
`SalesView.jsx:23` y `aios-command-center_1.html:2940`, que es el prototipo de referencia y no se
sirve. El único «Plan de acción» cableado del sistema es el de Leads Portal
(`lib/aios/period-controls.js:38` → `lpPlanBtn`).

### Y acá está la diferencia con las otras dos pantallas

| | frases detrás del botón | con fuente |
|---|---|---|
| Creative | 12 | 2 |
| Conversion | 47 | 0 |
| **Sales** | **0** | — |

Creative prometía doce frases inventadas y Conversion cuarenta y siete. **Sales no promete contenido
inventado: promete nada.** El botón se aprieta y no pasa absolutamente nada — ni siquiera un modal
vacío, porque nadie escucha el clic.

En cierto sentido es el menos dañino —no afirma nada falso— y en otro el peor: es un control visible,
con el estilo del botón principal de la pantalla, que enseña que la aplicación no responde.

> **El requisito no se borra.** El día que haya ventas registradas, un plan de acción de Sales tiene
> de dónde salir: la diferencia de cancelación entre closers (`S2-09`) ya es accionable hoy. Lo que se
> borra es el botón que no hace nada.

---

## S7-02 · El segmentado de período — no escucha, y su tercer botón es inválido

`SalesView.jsx:29-40`, `<div className="db-seg" id="slPeriod">`, tres botones.

**Dos defectos independientes:**

1. **`slPeriod` no tiene oyente en ninguna parte.** Clicar «Hoy» ni siquiera mueve el resaltado,
   porque el `.on` está escrito a mano en el JSX sobre «7 días» (`:34`).
2. **El tercer botón manda `data-p="mes"`** (`:37`), y `mes` **no existe** en `PERIODOS`
   (`lib/negocio/periodo.ts:83-96`). Si alguna vez llegara al servidor, `periodoDe()` devolvería `null`
   y la petición sería rechazada. Es un botón rotulado «30 días» que pide una ventana que el sistema
   no tiene.

**Y el marcado tampoco está al día.** Los cuatro paneles nuevos emiten `db-seg cs-periodos` con
`role="group"` y `aria-label` (`PanelDeConversion.jsx:106`, `PanelDeCreative.jsx:111`,
`PanelDeAcquisition.jsx:126`, `PanelDeConversation.jsx:296`). Sales emite `db-seg` pelada con un `id`.

---

## S7-03 · La píldora «Personalizado» — el único que reacciona, y para empeorar las cosas

`SalesView.jsx:41-48`, `className="pill"`, `data-datepick="sl"`, `id="slPill"`.

**Éste sí hace algo, y es lo peor que podría hacer.** `lib/aios/datepicker.js:125-131` engancha un
oyente delegado global a `[data-datepick]`, así que **el calendario abre**. Pero
`window.AIOSDate._cbs['sl']` nunca se registra —`_cbs` sólo se declara vacío (`datepicker.js:133`) y
no hay una sola escritura en todo el repositorio—, así que al apretar «Aplicar» el callback es
`undefined` y lo único que ocurre es cosmético (`datepicker.js:110-119`):

- reescribe el texto de `.pv` con el rango elegido;
- le pone `.active` a la píldora;
- y **apaga el `.on` del segmentado de al lado**.

**Resultado:** el control deja la pantalla en un estado visualmente incoherente —una píldora que dice
«1 ago – 15 ago» y un segmentado sin ningún botón encendido— **sin haber cambiado un solo dato**.

Y un detalle más: la píldora **no** está envuelta en `.pill-wrap`, así que el abrir/cerrar de
`lib/aios/period-controls.js:6-13` tampoco la alcanza.

---

## S7-04 · Qué se conserva del encabezado

Lo mismo que conservaron las dos reescrituras anteriores, y nada más: **el encabezado invertido de la
estética de operación** — rótulo en versalitas arriba, titular debajo.

En concreto:

```
<section className={activa ? 'view on estetica-op' : 'view estetica-op'} id="v-sales">
  <div className="view-scroll cre-scroll">
    <div className="cre-head">
      <div className="ch-l stack">
        <div className="ch-title">
          <h2>Sales</h2>
          <span className="cre-desc">…bajada…</span>
    <div className="cl-page">
      <PanelDeSales />
```

Con dos observaciones que valen para las tres pantallas:

1. **Ese encabezado no es del prototipo.** El HTML original (`aios-command-center_1.html:2935-2937`)
   tenía `<div class="ch-l">` pelado, sin `stack` ni `ch-title`, y **sin `.cl-page`**: el cuerpo
   colgaba directo del scroller. Se agregaron después, y sin `.cl-page` el `gap: 24px` del scroller se
   aplica entre todos los bloques.
2. **La mitad derecha (`.ch-r`) se va entera.** Creative y Conversion ya la borraron; hoy **Sales es
   la única de las cinco que la conserva**, lo cual deja desactualizado el comentario de
   `app/inteligencia-estetica.css:24-28`, que afirma que las cinco la comparten.

## S7-05 · Y la bajada cambia, como en las otras dos

Hoy dice **«Cierre, closers y motivos de pérdida»** (`SalesView.jsx:18`). Las tres cosas que promete
son justamente las tres que la medición cuestiona: el cierre no existe (`S1-01`), los closers son uno
real y un rótulo (`S4-02`), y los motivos son otra taxonomía (`S5-02`).

En las dos reescrituras anteriores la bajada se cambió por el mismo motivo: prometía algo que la
medición dice que no se puede construir.
