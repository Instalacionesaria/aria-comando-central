# Los seis detalles por paso, y la rama que nadie puede abrir

> Requisitos derivados del prototipo de Conversion, de la especificación funcional, y de una
> **medición propia contra producción** hecha el 2026-09-20. Cada requisito lleva el `archivo:línea`
> del que sale. El estado de cada dato sale de `docs/estado actual/03-CONVERSION.md`, medido el
> 2026-09-15, más las mediciones nuevas de `14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md`.

---

## 1 · La forma

### CV4-01 · Cada paso se abre y muestra su evidencia

**Rastro** · `stepDetail()` (`lib/aios/conversion.js:397-557`), abierto por `openStep()` (`:559-568`)
desde cualquier `[data-step]` de la vista (`:570`). El subtítulo del grupo lo anuncia: *«abre un paso
para ver su evidencia»* (`components/views/ConversionView.jsx:90-92`).

**Estado** · **Requisito, y es el § 2.6 del documento funcional**: *«Toda recomendación debe mostrar
qué se detectó, qué datos la respaldan… qué dato falta, cuando no existe evidencia suficiente»*
(`CC_Arquitectura_Funcional.md:106-114`). Que cada cifra se pueda abrir en su población es la forma
que este proyecto ya usa en cuatro pantallas.

### CV4-02 · Los seis cajones llevan la misma estructura

Meta con la fuente y la población · una rejilla de seis cajas · una o dos secciones propias · una
`Lectura` en prosa con su destinatario · y el bloque de `Observaciones`.

| cajón | meta declarada | línea |
|---|---|---|
| `Landing` | `Clarity · N sesiones · {periodo}` | `:398` |
| `VSL` | `VTurb · N reproducciones · {periodo}` | `:420` |
| `Formulario` | `Clarity · N lo iniciaron · {periodo}` | `:461` |
| `Agenda` | `Calendario · N citas · {periodo}` | `:480` |
| `Citas calificadas` | `CRM · N de M citas · {periodo}` | `:506` |
| `Gracias` | `Clarity · N visitas · {periodo}` | `:531` |

**El requisito más valioso de toda la maqueta está acá**: **la meta declara la población y la
fuente**. `CRM · 479 de 765 citas` dice de dónde sale el número y sobre cuántos se calculó, en una
línea, arriba de todo. Es lo que el `§ 18.5:1247` exige y lo que el resto de la pantalla no hace.

---

## 2 · Lo que cada cajón tiene de propio

### CV4-03 · `Landing` — el mapa de calor

**Rastro** · `ZONES` (`conversion.js:118-125`), seis zonas con scroll y clicks, actual y previo.
Leyenda `Menos … Más clicks` (`:356`) y rótulo lateral `Hasta dónde llega el scroll` (`:359`).
**Estado** · **Sin fuente.** Los 24 números son literales y Clarity no está integrado (`CV9-03`). La
rampa de color tiene además su propio umbral inventado: corte en `t = 0.5` del máximo
(`conversion.js:340-343`).
**Lo que sobrevive**: nada construible hoy. Va a `11-LOS-DOS-SUBMODULOS.md` como hueco declarado.

### CV4-04 · `VSL` — la curva de retención

**Rastro** · Un SVG dibujado a mano con **89 literales de geometría** (`conversion.js:438-453`), dos
círculos rojos marcando caídas en coordenadas fijas (`:448-449`), el mapa de calor `VHEAT = [100, 88,
82, 74, 56, 51, 47, 44, 42, 41]` (`:127`) y dos filas de caída con sus momentos exactos:
`0:18 · 82% → 74% · −8 pts` y `0:27 · 74% → 56% · −18 pts` (`:455-458`).
**Estado** · **Sin fuente, y es el hueco más caro.** Ver `CV14-07`. La normalización del calor usa
además un máximo fijo de 20 puntos (`:367`).
**Lo que sobrevive**: la forma. Decir **en qué segundo** se cae la atención es el requisito; hoy no
hay con qué.

### CV4-05 · `Formulario` — el abandono campo por campo

**Rastro** · `FIELDS` (`conversion.js:136-139`), cinco campos con «llegan» y «pierde».
**Estado** · Ver `CV2-11`: los cinco números son fijos, no escalan con el período, y contradicen la
cabecera del propio cajón. GoHighLevel **no expone endpoint de formularios ni de encuestas**.
**Lo que sobrevive**: es el requisito mejor planteado de la pantalla —saber en qué pregunta se cae
la gente— y el que más lejos está. Requiere instrumentar el formulario.

### CV4-06 · `Agenda` — «Qué pasa después»

**Rastro** · Dos filas (`conversion.js:495-500`): `Asistencia esperada · Según consumo del VSL y
segmento ICP · 74%`, y `Riesgo de no-show · Vieron menos del 40% del VSL · 31 contactos`.
**Estado** · **Las dos dependen del VSL**, que está en cero. El segmento ICP sí existe
(`lib/negocio/calidadDelCreativo.ts:61`, 344 de 344). Y la asistencia ya la publica
`lib/negocio/indicadoresDeCitas.ts` con `asistio is not null` en el denominador.
**Lo que sobrevive**: cruzar el consumo del VSL con la asistencia es un requisito real del
`§ 10.7:761` —*«Show rate según consumo del VSL»*— y está **bloqueado por el mismo medidor roto**.

### CV4-07 · `Gracias` — el video de bienvenida

**Rastro** · `conversion.js:545-548`, con un array literal escrito en línea.
**Estado** · **Es el precall, y es de Appointment Flow.** Ver `CV1-09` y `CV2-14`.

---

## 3 · La rama muerta

### CV4-08 · `Citas calificadas` existe, tiene 35 literales y cuatro frases, y nadie puede abrirla

**Rastro** · `stepDetail('calificados')` (`conversion.js:506-530`).
**Estado** · **Inalcanzable.** `'calificados'` no está en `STEPS` (`:36-42`) y ningún nodo de la
pantalla emite `data-step="calificados"`. Las seis cajas, la `Lectura` y las tres filas de «Por dónde
entraron» **no se dibujan nunca**.

Y declara una **quinta fuente, `CRM`** (`:508`), que no figura entre los chips del encabezado
(`ConversionView.jsx:22-31`) — o sea que ni siquiera es coherente con lo que la pantalla dice tener
conectado.

**Lo que sobrevive**: su meta es la mejor de las seis (`CRM · N de M citas`, con el denominador
explícito) y sus tres filas de «Por dónde entraron» describen exactamente el cruce que
`calidadDelCreativo` ya hace por pieza. **La forma es el requisito; el paso, no**: calificar una cita
por ICP es del cajón de `Agenda`, no de un paso propio.

---

## 4 · El bloque de observaciones

### CV4-09 · Cada cajón cierra con lo que hay que revisar y lo que está a favor

**Rastro** · `obsBlock()` (`conversion.js:376-395`), con el contador `«N a revisar · M a favor»`
(`:389-390`) y, por fila, `−N contactos` a la derecha (`:387`).
**Estado** · **Requisito, y bien resuelto.** Que lo positivo y lo negativo convivan en el mismo
bloque evita el sesgo de una pantalla que sólo enumera problemas, y el `§ 2.6` lo pide. La pérdida en
personas es `CV3-06` otra vez.

**El defecto a no heredar**: el denominador de `loss` **no se declara en ningún sitio**. Es
`x.loss × FACTOR[periodo]` (`:313`), sin relación explícita con las sesiones del período. Un `−64
contactos` sin decir sobre cuántos no se puede leer.

---

## 5 · El defecto que bloquea el borrado

### CV4-10 · `closeReco()` no existía — **cerrado el 2026-09-20**

> Se deja el diagnóstico porque de él salió la etapa 0 del plan, y **en pasado** porque un documento
> que declara en presente un defecto arreglado manda a alguien a buscarlo.

**Rastro** · `conversion.js`, hasta el 2026-09-20:

```js
el.onclick = ()=>{ closeReco(); openStep(el.dataset.goto); };
```

**Qué pasaba** · `closeReco` **no estaba definida en ningún archivo de la aplicación** — ni en
`lib/`, ni en `components/`, ni en `app/`, ni en `scripts/`. `conversion.js` no tenía una sola
sentencia `import`, y `lib/aios/shell.js` exporta `cerrarElModal`, no `closeReco`. La única
definición vivía en el prototipo `aios-command-center_1.html`, que no se carga.

Clicar cualquiera de las tres filas del plan de acción lanzaba `ReferenceError`, el `openStep()`
posterior **nunca se ejecutaba** y el modal se quedaba encima. El síntoma no era una excepción
visible sino una ausencia: el cajón sencillamente no se abría.

**Hoy** el módulo importa `cerrarElModal` de `./shell` y lo llama. Medido el 2026-09-20 sobre los
nueve módulos de `lib/aios/`: **era el único caso**. Y la tercera prueba de
`pruebas/codigo/156-cierre-de-los-overlays.test.ts` lo vigila — las dos que ya había cubrían que el
armazón registre los cierres y que ningún módulo de pantalla se los apropie; faltaba la tercera
dirección, que es llamar a un cierre que no existe.

---

## Preguntas abiertas

### CV4-P01 · ¿Cuántos cajones sobreviven?

De los seis, uno es inalcanzable (`CV4-08`), uno es de otro departamento (`CV4-07`) y tres dependen
de fuentes que no existen. El único con datos propios y vivos es `Agenda`. **Puede que el requisito
no sea «un cajón por paso» sino «un cajón por población que se pueda abrir»**, que hoy serían dos: el
recorrido y el formulario.
