# Las cuatro ventanas, el corte de época y el piso que sube

> Requisitos derivados del prototipo de Conversion, de la especificación funcional, y de una
> **medición propia contra producción** hecha el 2026-09-20. Cada requisito lleva el `archivo:línea`
> del que sale. El estado de cada dato sale de `docs/estado actual/03-CONVERSION.md`, medido el
> 2026-09-15, más las mediciones nuevas de `14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md`.

---

## 1 · El vocabulario de ventanas ya existe

### CV5-01 · Son cuatro, están en un solo lugar, y lo que no está se rechaza

**Rastro** · `lib/negocio/periodo.ts:83-96` define `hoy` (1 día), `7d` (7), `30d` (30) y `completo`
(3.650). `PERIODO_POR_OMISION = '30d'` (`:109`). `periodoDe()` devuelve `null` ante una clave
desconocida (`:188`), y la ruta **rechaza** en vez de caer al valor por omisión.

**Estado** · **El prototipo usa otro vocabulario, y no coincide.** `FACTOR` (`conversion.js:15`)
tiene cinco claves: `hoy`, `7d`, `mes`, `tri`, `hist`. De ésas:

| clave del prototipo | ¿existe en el sistema? |
|---|---|
| `hoy` | sí, con los mismos días |
| `7d` | sí, con los mismos días |
| `mes` | es el que el sistema llama `30d` |
| `tri` | **no existe**, y ningún botón puede seleccionarlo |
| `hist` | es el que el sistema llama `completo` |

**Requisito**: se usa `PERIODOS` de `periodo.ts`, que es el único lugar donde la decisión vive. El
`tri` del prototipo es andamiaje muerto.

### CV5-02 · El prototipo arranca en una ventana que su propio botón contradice

**Rastro** · `conversion.js:141` declara `let cvPeriod = 'hist'`, y `ConversionView.jsx:45` marca el
botón **`7 días`** con `className="on"`.
**Estado** · Al primer pintado la pastilla dice «7 días», las cifras son `866 × 3.4 = 2.944` visitas
—las del histórico— y `#cvInfo` dice «histórico · sin comparación». **Tres afirmaciones distintas en
la misma pantalla.** Y `hist` no tiene botón, así que no hay forma de volver a él salvo recargar.

**Requisito**: el botón encendido es el que **el servidor contestó**, no el que se pidió. Es lo que
`components/creative/PanelDeCreative.jsx:89` resuelve con
`valor={pantalla?.periodo ?? periodo}`.

---

## 2 · El corte de época, medido con el reloj de hoy

### CV5-03 · Las dos ventanas que no cruzan el corte no tienen volumen, y las dos que lo tienen lo cruzan

**Medido el 2026-09-20**, sobre los 566 contactos de la ventana `completo`:

| ventana | empieza | ¿cruza el 2026-08-31? | cohorte | con `Form Landing VSL` | con `url` |
|---|---|---|---|---|---|
| `hoy` | 2026-09-20 | no | **0** | 0 | 0 |
| `7d` | 2026-09-14 | no | **4** | 0 | 4 |
| **`30d`** *(por omisión)* | 2026-08-22 | **sí** | 335 | 63 | 263 |
| `completo` | 2016-09-23 | **sí** | 566 | 247 | 475 |

**Ésta es la tabla que gobierna el departamento entero.** No hay una sola ventana que tenga volumen
**y** no cruce el corte. Las dos fallan de maneras opuestas, exactamente como
`docs/estado actual/03-CONVERSION.md:221-225` lo anticipó cinco días antes — y peor, porque desde
entonces la pauta se apagó (`CV14-10`) y «7 días» pasó de poco volumen a **cuatro contactos**.

### CV5-04 · El botón por omisión es el que viola la regla 2

**Rastro** · Regla 2, `03-CONVERSION.md:219`.
**Estado** · `30d` abre en el 2026-08-22, o sea **nueve días antes del corte**, y parte la cohorte en
dos regímenes de adquisición: 335 contactos de los cuales 63 traen el campo del formulario y 272 no
podían traerlo. Una tasa sobre ese denominador divide un numerador que casi sólo pueden aportar los
de agosto entre una cohorte que es mayoritariamente de septiembre.

**Requisito** · El corte viaja como campo en toda respuesta:

```ts
corteDeEpoca: { fecha: string | null; laVentanaLoCruza: boolean }
```

y **se detecta del dato** —el último día con `Form Landing VSL` escrito— en vez de escribirse como
literal (`CV1-07`). Cuando `laVentanaLoCruza` es cierto, el aviso lo dice y las cifras del formulario
no se publican como una sola serie.

### CV5-05 · «No hay tráfico» y «no hay dato» son dos afirmaciones distintas

**Estado** · Con `hoy` la cohorte es **cero contactos**, y no porque falte un campo: porque la pauta
está en `$0,00` desde el 2026-09-14 (`CV14-10`). Una pantalla que diga «no hay dato» sobre una
ventana sin tráfico manda a buscar un defecto que no existe.

**Requisito**: la respuesta distingue los dos casos, y el aviso los dice distinto. Es el tercer cero
de la regla 1 llevado a la cohorte.

---

## 3 · El piso

### CV5-06 · `PISO_DE_UNA_TASA` es el del sistema, y acá hay que respetarlo por familia

**Rastro** · `lib/negocio/indicadoresDeCitas.ts:300`, con su justificación en `:291-298`: diez,
porque *«con diez, un registro mueve diez puntos, que sigue siendo mucho y ya no es absurdo»*. Y **es
del denominador**, no del total.

**Estado** · Aplicado a Conversion hoy, con la ventana `30d`:

| familia | contactos | ¿pasa el piso? |
|---|---|---|
| widget de reserva | 105 | sí |
| landing con VSL | 31 | sí |
| sin url | 60 | sí |
| formulario nativo de Meta | 23 | sí |
| precall / reclutamiento | 19 / 3 | **no la de reclutamiento** |

**Las familias principales pasan; cualquier segundo corte no.** Es la regla 8 del departamento
(`03-CONVERSION.md:250`): el cohorte de escritorio son 14 citas y *«cualquier desglose de ese
cohorte cae por debajo inmediatamente… O se publica sin desglose, o no se publica.»*

### CV5-07 · Apartar no es esconder

**Rastro** · Regla 2 de `docs/estado actual/07-REGLAS-TRANSVERSALES.md:106`.
**Estado** · Las familias que no llegan al piso **siguen contando en la cohorte** y aparecen con su
conteo; lo que no se publica es su **tasa**. Las filas tienen que sumar la cohorte exacta, o la
cobertura de arriba deja de cuadrar con la tabla de abajo.

---

## 4 · Las citas congeladas

### CV5-08 · El `Agendado` del formulario incluye citas que el CRM ya no devuelve

**Estado** · Ver `CV14-09`: de 121 `Agendado`, **119 tienen alguna cita y sólo 47 la tienen
alcanzable**. Los 72 de diferencia son congeladas, y el repositorio ya las conoce: regla 4 de
`07-REGLAS-TRANSVERSALES.md:153` — *«estado ⟹ sólo `ghl_calendario_id is not null`; existencia ⟹
todas»*.

**Requisito**: la tasa de agenda usa el predicado de **estado** —`ghl_calendario_id is not null`— y
el conteo de congeladas viaja al lado, como `congeladas` en
`lib/negocio/calidadDelCreativo.ts:107`. Sin eso, esta pantalla diría 121 donde otras dos dicen 47.

---

## Preguntas abiertas

### CV5-P01 · ¿Hace falta una quinta ventana?

Ninguna de las cuatro sirve hoy: dos sin volumen, dos que cruzan el corte. Una ventana «desde el
corte» —del 2026-09-01 a hoy— tendría 241 contactos y una sola ruta. Pero sería **una ventana que se
define por un accidente del negocio**, y el día que la ruta cambie otra vez habría que redefinirla.
La alternativa es dejar las cuatro y que el `corteDeEpoca` haga el trabajo. **No está decidido**, y
la lista de ventanas es cerrada por la regla 6 de `07-REGLAS-TRANSVERSALES.md:251`: agregar una toca
a las cinco pantallas que la comparten.
