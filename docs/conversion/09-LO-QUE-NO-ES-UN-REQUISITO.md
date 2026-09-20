# El andamiaje, y la lista de borrado

> Requisitos derivados del prototipo de Conversion, de la especificación funcional, y de una
> **medición propia contra producción** hecha el 2026-09-20. Cada requisito lleva el `archivo:línea`
> del que sale. El estado de cada dato sale de `docs/estado actual/03-CONVERSION.md`, medido el
> 2026-09-15, más las mediciones nuevas de `14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md`.

---

## 1 · El censo del andamiaje

### CV9-01 · Quinientos treinta y ocho literales numéricos

**Medido el 2026-09-20** sobre `lib/aios/conversion.js` (648 líneas), contando tokens numéricos
**fuera de los comentarios**:

| ámbito | literales |
|---|---|
| **total fuera de comentarios** | **538** |
| en el bloque de constantes de datos (`:8-137`) | 192 |
| en el SVG de la curva de retención (`:436-451`) | 89 |
| en la rampa de color del mapa de calor (`:338-341`) | 12 |

El motor entero son **dieciocho**: `CV` (`:8-12`), multiplicado por `FACTOR[periodo]` (`:13`). Todo
lo demás es constante fija que no reacciona al período ni al dispositivo.

### CV9-02 · Cuarenta y siete frases de guion

Ver `CV6-01` para el desglose. Ninguna sale de un cálculo, y trece de las descripciones traen cifras
presentadas como hechos.

### CV9-03 · Dos fuentes declaradas como conectadas que no existen

**Rastro** · `components/views/ConversionView.jsx:22-31`, los chips `Clarity` y `VTurb` con el punto
de «fuente viva».
**Estado** · **No hay integración, ni credencial, ni variable de entorno, ni tabla.** Sólo cadenas de
texto en el JSX y en `conversion.js`, donde además se declaran como origen de cada cajón —`Clarity ·
N sesiones` (`:398`), `VTurb · N reproducciones` (`:420`)—.

Esto **no es andamiaje**: el andamiaje existe para que la maqueta tenga un número que dibujar. Esto
es una **afirmación falsa sobre el sistema**, y del tipo más caro: alguien que mire la pantalla
concluye que la telemetría está conectada y que los números salen de ahí.

Y hay una quinta fuente que ni siquiera figura en los chips: el cajón de `Citas calificadas` declara
`CRM` (`conversion.js:506`).

### CV9-04 · Un nombre de persona, culpado de tres fallas inventadas

Ver `CV6-08`. `Kevin · técnico` en `conversion.js:46`, `:67`, `:73`, renderizado en tres sitios de la
pantalla.

### CV9-05 · Siete puertas a catorce personas inventadas con montos en dólares

Ver `CV6-09`. Las siete cifras de la tira de KPI llevan `data-leads` y abren el panel de
`lib/aios/leads-group.js:14-29`.

### CV9-06 · Las contradicciones internas de la maqueta

| defecto | dónde | qué pasa |
|---|---|---|
| «Calificadas» tiene dos fuentes | `:163-164` contra `:9-11` | con `hist`, el panel dice 482 y el cajón 479 |
| «Las 84 restantes» | `:500` | la propia pantalla calcula 283 y 286 en otros dos sitios |
| El período inicial | `:139` contra `ConversionView.jsx:45` | la pastilla dice «7 días» y los números son del histórico |
| `FIELDS` no escala | `:134-137` contra `:465` | la cabecera dice 1.047 y la tabla arranca en 308 |
| `Tiempo medio` | `:234` | siempre dice `▲ mejor` sin comparar nada |
| El `0.94` | `:165` | sin justificación ni comentario |
| El rango personalizado | `:640-644` | fuerza el período a `'mes'` sea cual sea el rango: 3 días y 90 días dan los mismos números |

### CV9-07 · Las constantes y los campos muertos

`MINOR` (`:80-84`), `SEVLBL` (`:300`), `TINT` (`:299`), `SCROLL` (`:129-132`); los campos
`STEPS[].n` y `STEPS[].src`, `FRICTIONS[].ic` / `.color` / `.state`, `WINS[].ic` / `.color`; la rama
`stepDetail('calificados')` entera (`:504-528`, inalcanzable); la guarda `.fr-send` (`:570`) sobre
una clase que este módulo nunca emite; y el período `'tri'` de `FACTOR` y `PREV`, que ningún botón
puede seleccionar.

---

## 2 · La lista de borrado

### CV9-08 · Lo que se va

- **`lib/aios/conversion.js`** entero — 648 líneas, 538 literales, 47 frases.
- Su entrada en **`lib/aios/index.js:8`** (el `import`) y **`:26`** (la posición en `MODULOS`).
- Los chips **`Clarity`** y **`VTurb`** de `components/views/ConversionView.jsx:22-31`.
- Las **siete puertas** `data-leads` de la tira de KPI.
- El botón **`◈ Plan de acción`** (`ConversionView.jsx:34-39`) y la pastilla **`Personalizado`**
  (`:52-59`), por los mismos motivos que `components/views/AcquisitionView.jsx:21-26`.

`ConversionView.jsx` queda como **cáscara que documenta qué se tiró**, con la forma de
`components/views/CreativeView.jsx`.

### CV9-09 · El defecto que bloquea el borrado

Ver `CV4-10`: `closeReco()` no existe. Hay que resolverlo **antes**, no con el borrado, porque hoy ya
está roto y el borrado sólo lo haría desaparecer sin que nadie se entere de que estuvo ahí.

### CV9-10 · El CSS se mide emisor por emisor antes de tocarlo

**Rastro** · El bloque propio vive en `app/aios.css:916` y siguientes, bajo el comentario
`/* ============ CONVERSION ============ */`.

**Estado** · **Al menos nueve familias las emiten otras vistas**: `.read`, `.legend`, `.filterbar`,
`.ghead`, `.dlt`, `.out`, `.rec`, `.reco-group` y `.cs-panels`. En Creative esto se midió y
resultaron **siete clases vivas fuera**, no una, y el modo de fallo es que no falla nada: se ve
distinto y nada lo dice.

**Requisito**: ninguna clase se borra sin su medición de emisores.

Ojo con una confusión fácil: los treinta selectores `#v-conversation` de
`app/operacion-estetica.css:1240-1353` son la pestaña **Conversation**, que es otra vista.

### CV9-11 · `scripts/paridad.mjs` no tiene nada que romper, y ése es el hallazgo

**Rastro** · `VISTAS = ['contacts']` (`:137`). Ninguno de los cinco pasos toca `#v-conversion` ni
ninguna de sus clases.

**Estado** · **Conversion no tiene hoy una sola comprobación automática de ninguna cifra.** Ni una
prueba, ni un paso de paridad. El propio archivo registra la pérdida (`:114-117`): *«el eje de
`texto` era lo único que comprobaba que ese port imperativo siguiera dando los mismos números»*.

Y su comentario de `:117-118` afirma que *«queda una rendija: los pasos que miran `#drawer` y
`#recoModal` siguen»*. **Ya no es cierto para esta vista**, y se corrige con el borrado.

---

## 3 · Lo que parece andamiaje y es requisito

### CV9-12 · La banda de «lo esperado»

Sus 24 números son inventados y su metodología declarada no se ejecuta (`CV2-08`). Pero **al borrarla
queda un hueco con forma**: comparar cada cifra contra una referencia. Eso es requisito; el umbral,
no.

### CV9-13 · La caída entre pasos en personas

`−N` es un literal derivado de otros literales, pero la **decisión** de expresar la pérdida en
personas y no en puntos porcentuales es la mejor de la maqueta (`CV3-06`).

### CV9-14 · La meta de cada cajón

`CRM · 479 de 765 citas · histórico` (`conversion.js:506`) es la única línea de toda la pantalla que
declara fuente, numerador, denominador y ventana a la vez. Es exactamente lo que el `§ 18.5:1247`
exige, y se conserva como forma obligatoria de cada bloque.
