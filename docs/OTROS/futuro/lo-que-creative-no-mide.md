# Lo que Creative no mide, y qué haría falta para medirlo

> Escrito el **2026-10-11**, al volver la pestaña al front del prototipo
> (`docs/creative/16-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`). Cada lugar del prototipo que no tiene dato queda en la
> pantalla con «—» y su línea; este documento dice por qué y qué haría falta. Las mediciones contra GoHighLevel están en
> `docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md`; la de Meta directo, en `docs/OTROS/futuro/miniatura-y-video-de-meta.md`.

---

## 1 · La retención y la curva

**Dónde se dibujaría** · La cifra «Retención» de la tira y de cada tarjeta, y la sección «Retención y guion» de la ficha («Retención del video» en el prototipo).

**Por qué no hay dato** · GoHighLevel entrega por anuncio y por día una lista cerrada de once valores y un desglose de
acciones; los cuartiles de video, el tiempo medio visto y el thruplay no están (`C14-04` y `C14-05`). Lo que el
prototipo dibujaba era una curva inventada, la misma para todas las piezas (`docs/creative/00-MAPA.md`).

**Qué haría falta** · Meta directo con token propio: los cuartiles (`video_p25_watched_actions` a `p100`). Son cuatro
puntos, no una curva: alcanzan para decir cuánto se queda la gente, no en qué segundo se va.

## 2 · El formato, el ángulo, la duración y el dolor

**Dónde se dibujaría** · Las etiquetas de la tarjeta y las cajas «Formato», «Ángulo», «Duración» y «Dolor que ataca» de la ficha.

**Por qué no hay dato** · Son decisiones de quien hace la pieza. Ningún sistema conectado las guarda: GoHighLevel
devuelve del anuncio sólo `{name, adId, adAccountId, locationId}` (`C14-07`), y el nombre del anuncio no sigue una
convención que las codifique.

**Qué haría falta** · Una convención de nombres de anuncio que las lleve —como la etapa, que ya se lee del nombre de la
campaña—, o un formulario por pieza en la pantalla. La duración, además, la daría Meta directo con el video.

## 3 · El guion y dónde se cae la atención

**Dónde se dibujaría** · La sección «Retención y guion» de la ficha («Guión del video» en el prototipo), con las líneas marcadas «↓ retención».

**Por qué no hay dato** · No hay transcripción de los videos, y aunque la hubiera, la retención llega en cuartiles: no
señala un segundo del guion (`docs/creative/00-MAPA.md`, el caso difícil).

**Qué haría falta** · El video desde Meta, una transcripción, y aceptar que lo que se puede marcar es un cuarto del
video, no una línea.

## 4 · Los clics a lo largo del video

**Dónde se dibujaría** · El bloque de clics por momento que el prototipo tenía escrito y nunca mostró.

**Por qué no hay dato** · Ni GoHighLevel ni Meta entregan los clics por segundo del video.

**Qué haría falta** · No hay fuente conocida; queda como idea.

## 5 · Los cierres y el costo por venta por pieza

**Dónde se dibujaría** · Las cifras de venta que los datos del prototipo traían y la pantalla nunca dibujó.

**Por qué no hay dato** · Las ventas las registra el closer y casi nadie las registra (`docs/OTROS/estado actual/05-SALES.md`):
siete resultados, ninguno con monto, el último del 2026-09-09.

**Qué haría falta** · Que se registren las ventas; el cruce con la pieza ya existe por el contacto.

## 6 · La miniatura de los contactos viejos

**Dónde se dibujaría** · La miniatura de la tarjeta y de la ficha.

**Por qué no hay dato** · El «Video Url» llega sólo en `GET /contacts/{id}`; la sincronización usa `POST /contacts/search`,
que no lo trae (`docs/creative/16-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`, § 2). Hasta que la pasada de CF1-11 complete
la atribución, ninguna pieza tiene miniatura; y una pieza cuyos contactos no traen anuncio en su primera atribución
—la campaña de mensajes de Instagram, por ejemplo— no la va a tener nunca por esta vía.

**Qué haría falta** · La pasada de CF1-11 para los que tienen anuncio; para el resto, Meta directo
(`docs/OTROS/futuro/miniatura-y-video-de-meta.md`) o el enlace manual por pieza, que ya existe.
