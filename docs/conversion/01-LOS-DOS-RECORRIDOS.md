# La unidad, el corte del 2026-08-31 y por qué hay dos caminos

> Requisitos derivados del prototipo de Conversion, de la especificación funcional, y de una
> **medición propia contra producción** hecha el 2026-09-20. Cada requisito lleva el `archivo:línea`
> del que sale. Lo que no se pudo rastrear está dicho como pregunta abierta, no como requisito.
> El estado de cada dato sale de `docs/estado actual/03-CONVERSION.md`, medido el 2026-09-15, más las
> mediciones nuevas de `14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md`.

---

## 1 · La unidad de análisis

### CV1-01 · La unidad es el CONTACTO, no la sesión — y no por elección

**Rastro** · El prototipo cuenta sesiones: `CV.all.sesiones = 866` (`lib/aios/conversion.js:8`), y
`#cvInfo` publica *«N sesiones · periodo»* (`:215`). El `§ 5.1:210-212` del documento funcional
nombra tres entidades —`Landing Session`, `VSL Session`, `Form Submission`— y el `§ 5.2:228-235` pone
`visitor_id` y `session_id` en el centro de la traza.

**Estado** · **Ninguna de las tres entidades existe**, y `visitor_id`/`session_id` dan **cero
coincidencias en todo el repositorio** —`db/migraciones`, `lib`, `app`, `components`—. No hay tabla
de sesiones web, ni de eventos de página, ni de reproducción de video. La única `sesiones` del
esquema es `identidad.sesiones`, que son los inicios de sesión de nuestros usuarios
(`lib/datos/esquema.ts:120-134`).

Así que la unidad de este departamento **es el contacto**, y eso no es una simplificación: es un
techo. Un visitante que no se convierte en contacto **no deja rastro en ninguna parte**. La
consecuencia está en `CV1-05`.

### CV1-02 · La llave es el ÚLTIMO toque, no el primero

**Rastro** · Regla 6 del departamento, `docs/estado actual/03-CONVERSION.md:242`: *«Acquisition
mira el primer toque —de qué anuncio vino—; Conversion mira el último —por dónde volvió a entrar—.
Confundirlos hace que el departamento mida cero y lo reporte como ausencia.»*

**Estado** · **Medido, y la diferencia es grande.** `contactos.atribucion_ultima->>'url'` está en
**475 de 590** contactos; `atribucion_primera->>'url'` en **329**. Y el caso que lo prueba:
`Trigger Link` vale **29 de 584** en la última y **0 de 584** en la primera
(`docs/estado actual/09-DEUDA-ABIERTA.md:177`). Un módulo que buscara trigger links en la primera
mediría cero para siempre y lo reportaría como «no se usan».

Las dos columnas las creó `db/migraciones/048_de_donde_vino_el_lead.sql:100-104,125-129`, con el
argumento escrito en `048:85-89`: son dos columnas y no una porque primer y último toque son
preguntas distintas.

**Y ningún módulo de `lib/negocio/` lee `atribucion_ultima` hoy.** La columna existe, se puebla y no
tiene lectores.

---

## 2 · Hay DOS recorridos, y no son etapas del mismo

### CV1-03 · El embudo del documento ya no es por donde pasa la gente

**Rastro** · `CC_Arquitectura_Funcional.md:28-39` define el recorrido:
`Anuncio → Landing → VSL → Formulario → Lead calificado → Agendamiento → …`. El prototipo lo dibuja
como cinco pasos encadenados (`conversion.js:34-40`).

**Estado** · **Medido el 2026-09-20, dejó de ser el camino mayoritario el 2026-08-31:**

| época | contactos | landing con VSL | widget de reserva directo | sin url |
|---|---|---|---|---|
| agosto y antes | 349 | **203 (58 %)** | 84 (24 %) | 55 |
| **septiembre** | 241 | **31 (13 %)** | **105 (44 %)** | 60 |

El detalle semana a semana y el censo por host están en `CV14-01`, `CV14-02` y `CV14-03`.

### CV1-04 · Las dos poblaciones NO se suman, y ése es el requisito

Sumar `landing + widget` afirmaría que son **etapas de un mismo camino**, y son **dos caminos
alternativos**: quien agenda directo en `calls.ariaia.com` no pasó por la landing ni la iba a pasar.

El prototipo comete exactamente ese error en su forma más pura: sus cinco pasos son una cadena
—`.jarrow` dibuja una flecha entre cada par (`conversion.js:262`)— y cada paso publica su porcentaje
**sobre el total de visitas** (`:266`), con el subtítulo *«porcentajes sobre el total de visitas»*
(`components/views/ConversionView.jsx:90-92`). Eso es válido cuando hay un solo camino. Hoy no lo
hay.

**El requisito**: una fila por familia de recorrido, cada una con su cohorte y su tasa, dibujadas
una debajo de otra. Y la cifra más valiosa que esta pantalla puede publicar hoy es **el reparto
mismo**: cuánta gente entra por cada camino.

Es la regla 11 de `docs/estado actual/07-REGLAS-TRANSVERSALES.md:451` aplicada acá: *«una cadena que
no es monótona no es un embudo»*.

### CV1-05 · «Visitó la landing» y «la URL quedó registrada» no son lo mismo

**Rastro** · Regla 3 del departamento, `docs/estado actual/03-CONVERSION.md:230`. Medido allí:
de los 48 contactos de la ventana con rastro de `accelerator.ariaia.com`, **44 tienen
`medium = calendar`** — o sea que su URL se escribió **en el momento de reservar**, no al navegar.

**Estado** · El cruce sale **circular**: «tener la URL» es consecuencia de haber convertido, así que
una tasa de conversión sobre ese denominador da casi 100 % por construcción. Es el mismo defecto que
`lib/negocio/consumoDelPrecall.ts` documenta para la cobertura del precall entre citas `confirmed`
(94,3 %) y `cancelled` (48,9 %).

**La consecuencia, que es el requisito**: mientras el denominador no sea gente registrada **al
llegar**, **la tasa de conversión de la landing no se publica**. Lo que sí se publica es el reparto
de la cohorte por recorrido, que no tiene ese sesgo porque no divide por una población que se define
a sí misma.

---

## 3 · El corte de época

### CV1-06 · Ninguna serie puede cruzar el 2026-08-31 en silencio

**Rastro** · Regla 2 del departamento, `docs/estado actual/03-CONVERSION.md:219`: *«Es la regla
más importante y la que más fácil se viola. Cualquier serie temporal que cruce esa fecha va a
mostrar un derrumbe fantasma de todos los indicadores de landing y de VSL, y no será una caída de
conversión: será un cambio de ruta de adquisición.»*

**Estado** · **Y el botón por omisión es el que la viola.** `PERIODO_POR_OMISION = '30d'`
(`lib/negocio/periodo.ts:109`) abre una ventana que hoy empieza el 2026-08-21 y cruza el corte. Las
cuatro ventanas fallan de maneras distintas y están medidas en `CV5-03`.

### CV1-07 · El corte se DETECTA del dato, no se escribe en el código

Un `'2026-08-31'` literal en un módulo es una cifra medida que envejece sin que nada avise — el
defecto que Creative pagó tres veces y documentó en
`components/creative/PanelDeCreative.jsx:32-37`.

**El requisito**: el corte se deriva del último día con `Form Landing VSL` escrito, y viaja en la
respuesta:

```ts
corteDeEpoca: { fecha: string | null; laVentanaLoCruza: boolean }
```

Cuando `laVentanaLoCruza` es cierto, el aviso lo dice. Es la regla 2 convertida en un campo que la
pantalla no puede ignorar por descuido, que es la única forma de que una regla sobreviva.

---

## 4 · Los puentes con los otros departamentos

### CV1-08 · Con Creative y Acquisition se cruza por el NOMBRE del creativo, no por `adId`

**Estado** · Medido sobre los 104 contactos cuya última URL es la landing propia:

| qué traen | cuántos |
|---|---|
| `utm_content` dentro de la URL | **89** |
| `utmContent` en `atribucion_primera` | 93 |
| **`adId`** | **4** |

Cuatro de ciento cuatro. El puente por `adId` **no existe** para esta población; el puente por nombre
sí, y es la llave de `lib/negocio/creativo.ts`, que Creative ya usa con el 94,5 % de cobertura.

**El requisito**: si Conversion cruza con la pauta, usa `llaveDelCreativo()` de ese módulo y no
escribe una segunda normalización. El argumento entero está en `creativo.ts:4-13`: la misma llave
estaba escrita cinco veces con **dos** definiciones, y `btrim` de PostgreSQL no es `String.trim()`
de JavaScript.

### CV1-09 · El precall NO es de este departamento

**Rastro** · Regla 7, `docs/estado actual/03-CONVERSION.md:246`. El prototipo lo dibuja en el
paso «Gracias» como «video de bienvenida» (`conversion.js:543-546`).

**Estado** · El consumo del video precall es el `§ 10.6` del documento —**Appointment Flow**— y ya
está construido en `lib/negocio/consumoDelPrecall.ts`, con su población, su piso y sus avisos. Si
Conversion publica su propia versión, habrá **dos tasas del mismo hecho con poblaciones distintas en
dos pantallas**.

Lo que sí es de Conversion, y **no** de Creative: la retención del VSL. Creative mide la retención
del **anuncio** (`video_25/50/75/100` de Meta); Conversion mediría la del **VSL de la landing**. Son
dos videos. Hoy no se puede: ver `CV11-04`.

---

## Preguntas abiertas

### CV1-P01 · ¿Los 115 sin URL son una cuarta familia o un agujero?

115 de 590 contactos no traen `url` en `atribucion_ultima`, y 60 son de septiembre. Si entraron por
un camino que no registra URL, son una **cuarta familia de recorrido** y hay que dibujarlos. Si es
pérdida de captura, son un **agujero en el denominador** de las otras tres y hay que decirlo al lado
de cada cifra. La diferencia cambia qué significa toda la pantalla, y la base no la desempata.

### CV1-P02 · ¿Quién es el dueño de `form completion rate`?

El `§ 9.7:609-611` lista `landing visit rate`, `form start rate` y `form completion rate` como **KPIs
de Lead Flow**, no de Conversion. Las dos lecturas son defendibles —Lead Flow guía al contacto hacia
la landing, Conversion mide qué pasa dentro de ella— y el documento no desempata. Mientras tanto se
construye en Conversion y **se declara el solapamiento**; si Conversation lo publica algún día, uno
de los dos consume al otro y no lo recalcula, que es el `§ 2.4`.
