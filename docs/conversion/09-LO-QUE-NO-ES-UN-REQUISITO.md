# El andamiaje, y la lista de borrado

> Requisitos derivados del prototipo de Conversion, de la especificación funcional, y de una
> **medición propia contra producción** hecha el 2026-09-20. Cada requisito lleva el `archivo:línea`
> del que sale. El estado de cada dato sale de `docs/estado actual/03-CONVERSION.md`, medido el
> 2026-09-15, más las mediciones nuevas de `14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md`.

> **`lib/aios/conversion.js` YA NO EXISTE.** Se borró el 2026-09-20, y con él las 655 líneas con
> 530 literales inventados y 47 frases de guion que esta carpeta documenta. Las citas
> `conversion.js:N` de abajo **siguen siendo correctas como referencia histórica** —el archivo y sus
> líneas están en el historial de git— y ésa es toda su función: este documento nunca describió lo
> que hay, describió lo que la maqueta dibujaba, para sacar de ahí los requisitos.
>
> **Y `components/views/ConversionView.jsx` se reescribió el mismo día**: pasó de 115 líneas a 79, así
> que sus citas son de DOS clases y la segunda es la peligrosa. Las que apuntan más allá de la línea
> 79 fallan al resolverse, y se ven. Las que apuntan más acá **siguen resolviendo y muestran otra
> cosa**, que es peor: una línea corrida no falla.
>
> Lo que hay hoy es `components/conversion/PanelDeConversion.jsx` con dos bloques medidos: el reparto
> de la cohorte por camino de entrada (`lib/negocio/recorridoDelLead.ts`) y el abandono del
> formulario de la landing (`embudoDelFormulario.ts`), más los cinco huecos declarados. La
> clasificación vive en `lib/negocio/recorrido.ts` y la ruta en `app/api/conversion/route.ts`.


---

## 1 · El censo del andamiaje

### CV9-01 · Quinientos treinta y ocho literales numéricos

**Medido el 2026-09-20** sobre `lib/aios/conversion.js` (648 líneas), contando tokens numéricos
**fuera de los comentarios**:

| ámbito | literales |
|---|---|
| **total fuera de comentarios** | **538** |
| en el bloque de constantes de datos (`:10-139`) | 192 |
| en el SVG de la curva de retención (`:438-453`) | 89 |
| en la rampa de color del mapa de calor (`:340-343`) | 12 |

El motor entero son **dieciocho**: `CV` (`:10-14`), multiplicado por `FACTOR[periodo]` (`:15`). Todo
lo demás es constante fija que no reacciona al período ni al dispositivo.

### CV9-02 · Cuarenta y siete frases de guion

Ver `CV6-01` para el desglose. Ninguna sale de un cálculo, y trece de las descripciones traen cifras
presentadas como hechos.

### CV9-03 · Dos fuentes declaradas como conectadas que no existen

**Rastro** · `components/views/ConversionView.jsx:22-31`, los chips `Clarity` y `VTurb` con el punto
de «fuente viva».
**Estado** · **No hay integración, ni credencial, ni variable de entorno, ni tabla.** Sólo cadenas de
texto en el JSX y en `conversion.js`, donde además se declaran como origen de cada cajón —`Clarity ·
N sesiones` (`:400`), `VTurb · N reproducciones` (`:422`)—.

Esto **no es andamiaje**: el andamiaje existe para que la maqueta tenga un número que dibujar. Esto
es una **afirmación falsa sobre el sistema**, y del tipo más caro: alguien que mire la pantalla
concluye que la telemetría está conectada y que los números salen de ahí.

Y hay una quinta fuente que ni siquiera figura en los chips: el cajón de `Citas calificadas` declara
`CRM` (`conversion.js:508`).

### CV9-04 · Un nombre de persona, culpado de tres fallas inventadas

Ver `CV6-08`. `Kevin · técnico` en `conversion.js:48`, `:69`, `:75`, renderizado en tres sitios de la
pantalla.

### CV9-05 · Siete puertas a catorce personas inventadas con montos en dólares

Ver `CV6-09`. Las siete cifras de la tira de KPI llevan `data-leads` y abren el panel de
`lib/aios/leads-group.js:14-29`.

### CV9-06 · Las contradicciones internas de la maqueta

| defecto | dónde | qué pasa |
|---|---|---|
| «Calificadas» tiene dos fuentes | `conversion.js:165-166` contra `:11-13` | con `hist`, el panel dice 482 y el cajón 479 |
| «Las 84 restantes» | `conversion.js:502` | la propia pantalla calcula 283 y 286 en otros dos sitios |
| El período inicial | `conversion.js:141` contra `components/views/ConversionView.jsx:45` | la pastilla dice «7 días» y los números son del histórico |
| `FIELDS` no escala | `conversion.js:136-139` contra `:467` | la cabecera dice 1.047 y la tabla arranca en 308 |
| `Tiempo medio` | `conversion.js:236` | siempre dice `▲ mejor` sin comparar nada |
| El `0.94` | `conversion.js:167` | sin justificación ni comentario |
| El rango personalizado | `conversion.js:642-646` | fuerza el período a `'mes'` sea cual sea el rango: 3 días y 90 días dan los mismos números |

### CV9-07 · Las constantes y los campos muertos

`MINOR` (`conversion.js:82-86`), `SEVLBL` (`:302`), `TINT` (`:301`), `SCROLL` (`:131-134`); los campos
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

### CV9-09 · El defecto que bloqueaba el borrado — **cerrado el 2026-09-20**

Ver `CV4-10`: `closeReco()` no existía. Se resolvió **antes** del borrado y no con él, porque estaba
roto en producción y borrarlo lo habría hecho desaparecer sin que nadie se enterara de que estuvo
ahí.

**Y el borrado ya no deja overlays huérfanos**, comprobado el 2026-09-20 por los dos lados:
`conversion.js` abre `#drawer` (`:578-580`) y `#recoModal` (`:640-642`), y los dos los cierra
`lib/aios/shell.js:192-200`. El `#lgPanel` que abren las siete puertas del KPI lo cierra su propio
módulo (`lib/aios/leads-group.js:74`), que **no se borra** porque lo usan otras pantallas.

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

`CRM · 479 de 765 citas · histórico` (`conversion.js:508`) es la única línea de toda la pantalla que
declara fuente, numerador, denominador y ventana a la vez. Es exactamente lo que el `§ 18.5:1247`
exige, y se conserva como forma obligatoria de cada bloque.
