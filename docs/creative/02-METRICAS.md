# Creative · Catálogo de métricas

> **`lib/aios/creative.js` YA NO EXISTE.** Se borró el 2026-09-19, y con él los 201 literales
> inventados que esta carpeta documenta. Las citas `creative.js:N` de abajo **siguen siendo
> correctas como referencia histórica** —el archivo y sus líneas están en el historial de git— y ésa
> es toda su función: este documento nunca describió lo que hay, describió lo que la maqueta dibujaba
> para sacar de ahí los requisitos.
>
> **Y `components/views/CreativeView.jsx` se reescribió el mismo día**: pasó de 99 líneas a 70, así
> que sus citas son de DOS clases y la segunda es la peligrosa. Las que apuntan más allá de la línea
> 70 fallan al resolverse, y se ven. Las que apuntan más acá **siguen resolviendo y muestran otra
> cosa**, que es peor: una línea corrida no falla.
>
> Lo que hay hoy es `components/creative/PanelDeCreative.jsx` con tres bloques medidos: el ICP y la
> agenda por pieza (`lib/negocio/calidadDelCreativo.ts`), el hook rate y las tasas de enlace
> (`rendimientoDelCreativo.ts`) y la caída del CTR (`fatigaDelCreativo.ts`).

> Requisitos derivados del prototipo de Creative (`lib/aios/creative.js`, 450 líneas, 201 literales
> inventados) y del § 18 del documento funcional, con el estado de cada dato medido el 2026-09-18.
> Las mediciones contra la API de GoHighLevel están en `14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md`.
>
> Este documento dice qué número tiene que poder dar Creative, con qué fórmula, en qué unidad y
> **sobre qué población**.

---

## 0 · Cómo se lee una ficha

Cada requisito trae seis campos. El que decide si el requisito sirve es **Población**: dos cifras con
la misma fórmula y distinta población son dos cifras distintas, y ésa es la forma más barata de
publicar un número falso sin que nada falle.

| Campo | Qué dice |
|---|---|
| **Qué es** | La definición, en una línea. |
| **Fórmula** | Lo que el sistema real tiene que calcular. Cuando el prototipo calcula otra cosa, se dice aparte. |
| **Unidad** | Contactos, dinero, proporción, días o conteo de entidades. |
| **Población** | El conjunto sobre el que se mide, y su filtro. |
| **Rastro** | El `archivo:línea` del que sale: del prototipo, o del resto del sistema cuando el prototipo no lo tiene. |
| **Estado** | Ya está / está incompleto / no existe y de dónde tiene que venir. |

---

## 1 · Las siete reglas que valen para todas las métricas

### C2-01 · Toda tasa lleva piso, y el piso es del DENOMINADOR

**Fórmula** · Si el denominador es menor que `PISO_DE_UNA_TASA = 10`, la tasa viaja `null`.
**Rastro** · `lib/negocio/indicadoresDeCitas.ts:300`, la única definición del repositorio.
**Estado** · Se reusa, no se redefine. *«Nombrar una constante compartida por la primera que la
necesitó invita a que la quinta se escriba su propio piso, y dos pisos distintos para la misma regla
divergen sin que nada falle.»*

### C2-02 · Bajo el piso se conserva el CONTEO y se pierde la TASA

**Qué es** · Una pieza con 4 contactos y 3 agendas no publica «75 %». Publica «3 de 4».
**Estado** · Es la forma que ya usa el resto del sistema. Un `0` en lugar del `null` afirma algo sobre
el negocio con cero datos.

### C2-03 · El denominador de cada tasa de Meta se filtra por la presencia de su clave

**Qué es** · El desglose de acciones no viene en todas las filas: `videoView` en el 90 % de las filas
anuncio-día con entrega, `linkClick` en el 74 %, `landingPageView` en el 65 %.
**Fórmula** · `sum(impresiones) filter (where acciones ? '<clave>')`, nunca `sum(impresiones)` a secas.
**Rastro** · `14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md` C14-01.
**Estado** · **Es el error más fácil de cometer en toda la carpeta.** Sumar el numerador sobre el 65 %
de los días y el denominador sobre el 100 % da una tasa sistemáticamente baja, **plausible y falsa**.
Es el mismo error que `indicadoresDeCitas` evita poniendo `asistio is not null` en el denominador.
Cada tasa de esta familia viaja con el par `diasConLaClave / diasConEntrega`.

### C2-04 · Un tipo de acción ausente no es cero

**Qué es** · Que Meta no reporte `videoView` para un anuncio-día significa «no lo reportó», no «hubo
cero reproducciones». Una pieza estática no tiene reproducciones **nunca**, y eso no es una laguna.
**Estado** · Es la regla de los dos ceros aplicada al desglose. Una pieza sin ninguna fila con
`videoView` publica hook rate **`null`**, no `0` — la diferencia entre «no es video» y «nadie lo vio».

### C2-05 · El alcance y la frecuencia no se agregan, y por eso no están

**Qué es** · No hay «alcance de la pieza en la ventana» ni «frecuencia de la pieza».
**Rastro** · `lib/negocio/costoDelAnuncio.ts:88-95`: *«Sumar siete días de alcance cuenta siete veces a
quien vio el anuncio los siete días… es un número más grande que no significa nada, y que encima se
parece a uno que sí.»*
**Estado** · **Al grano de la pieza es peor que al grano del anuncio**: la misma persona alcanzada por
los hasta seis anuncios de la pieza se contaría seis veces. Las dos se pueden publicar **por día** y
por anuncio; su agregado no existe. Con ellas cae la fatiga por frecuencia (`C2-24`).

### C2-06 · El guion es «no se sabe», nunca un cero

**Estado** · El formateador dibuja `—` cuando el valor es `null`. Ya está resuelto en
`components/acquisition/PanelDeAcquisition.jsx:174-203` y se reusa.

### C2-07 · Cada cifra dice sobre qué ventana habla, y hay TRES en esta pantalla

**Qué es** · El gasto y las métricas de entrega existen desde el **2026-08-18** (arranque del
colector). El desglose de acciones existirá desde el día del despliegue. Los contactos existen desde
el **2025-08-08**.
**Estado** · **Tres fechas de inicio distintas en la misma pantalla.** La respuesta lleva
`desdeCuandoHayGasto` y `desdeCuandoHayDesglose` por separado, igual que `costoDelAnuncio` ya lleva
`desde`/`hasta`. Una pantalla que diga «30 días» mientras el hook rate habla de tres es una
afirmación falsa sobre el alcance de la cifra.

---

## 2 · Las seis cifras de cabecera del prototipo

El prototipo dibuja una fila de seis tarjetas (`lib/aios/creative.js:142-162`) y las **mismas seis** en
cada tarjeta de pieza (`DIRECTA_GRID`, `:123-126`): **Calificados · Agendas · Hook rate · Retención ·
Alcance · Frecuencia**.

### C2-08 · La cabecera es un resumen de la población visible, no del negocio

**Qué es** · Las seis cifras se recalculan sobre las piezas que el filtro deja a la vista.
**Rastro** · `lib/aios/creative.js:143-147`.
**Estado** · Requisito, y hay que conservarlo: es lo que hace que la cabecera describa la tabla de
abajo. Lo que cambia es **qué seis**: de las seis del prototipo, **dos no se pueden construir**
(Retención y Frecuencia, ver `C2-05` y `C2-25`) y una cambia de nombre (`Calificados`, ver `C2-09`).

### C2-09 · «Calificados» no existe con ese nombre, y lo que hay es mejor

**Qué es** · El prototipo publica un conteo de «calificados» por pieza.
**Fórmula del prototipo** · Un literal por pieza (`lib/aios/creative.js:8-22`).
**Estado** · **No hay una definición de «calificado» en el sistema.** Lo que sí hay, medido, es el
puntaje de ICP por contacto, que es un número y no una etiqueta binaria — y publicar el promedio es
más informativo que publicar un conteo con un corte que nadie definió. Ver `C2-16`.
El corte en tramos existe como pregunta abierta en `docs/acquisition/04-CALIDAD-DEL-LEAD.md`; Creative
**no lo inventa por su cuenta**, porque sería la quinta pantalla publicando lo mismo de la quinta
manera.

---

## 3 · Las métricas de META por pieza

Todas salen del desglose `results` del endpoint que el colector ya llama. Ver `C14-01`.

### C2-10 · Hook rate

**Qué es** · Qué proporción de las impresiones terminó en una reproducción contada por Meta.
**Fórmula** · `Σ videoView / Σ impresiones × 100`, los dos sobre **las filas anuncio-día que traen la
clave `videoView`**.
**Unidad** · Proporción.
**Población** · Las filas de `negocio.metricas_de_anuncio` de los anuncios de la pieza, en la ventana,
con `acciones ? 'videoView'` **y** `impresiones is not null`.
**Piso** · **No es `PISO_DE_UNA_TASA`.** El denominador son impresiones, no eventos contables: con
100 impresiones una reproducción mueve un punto entero. Hace falta un piso de impresiones propio, y
**no está calibrado contra nada** — ver `C2-P01`.
**Rastro** · `lib/aios/creative.js:8-22` (el campo `hookRate`, inventado), `:103` (es criterio de
orden), `:123-126` (se dibuja en cada tarjeta). La fuente real: `C14-01`.
**Estado** · **Construible en cuanto el desglose se guarde.** Cobertura del 90 %. Se publica con el
par `diasConLaClave / diasConEntrega` al lado (`C2-03`) y rotulado **«reproducciones que Meta
contó»**, no «vistas de tres segundos» — ver `C14-P01`.

### C2-11 · Link CTR

**Qué es** · Qué proporción de las impresiones terminó en un clic **al enlace**, que no es lo mismo
que un clic.
**Fórmula** · `Σ linkClick / Σ impresiones × 100`, sobre las filas con `acciones ? 'linkClick'`.
**Unidad** · Proporción.
**Población** · Ídem `C2-10` con la clave `linkClick`.
**Rastro** · § 18.7 «Interacción». El prototipo **no lo tiene**.
**Estado** · Construible. Cobertura **74 %**. **Se dibuja al lado del CTR que ya está guardado**, y la
diferencia entre los dos es justo lo que el § 18.7 separa: en la fila medida, `clicks` 28 contra
`linkClick` 18. «Se toca» y «manda a la web» son dos cosas. `linkClick ≤ clics` siempre; si alguna vez
no lo es, el lector mezcló claves.

### C2-12 · Landing page view rate

**Fórmula** · `Σ landingPageView / Σ impresiones × 100`, sobre las filas con la clave.
**Población** · Ídem con `landingPageView`. Cobertura **65 %**.
**Rastro** · § 18.7 «Interacción». El prototipo no lo tiene.
**Estado** · Construible. **El 35 % que falta no son ceros** (`C2-04`): una pieza cuyos días no traen
la clave sale nula, no baja.

### C2-13 · Click-to-landing rate

**Qué es** · De los que hicieron clic al enlace, cuántos llegaron a ver la landing. Es la medida de
cuánto se pierde entre el clic y la carga.
**Fórmula** · `Σ landingPageView / Σ linkClick × 100`, sobre las filas que traen **las dos** claves.
**Unidad** · Proporción.
**Piso** · `PISO_DE_UNA_TASA = 10` clics al enlace. Acá sí: son eventos contables.
**Estado** · Construible. **Puede pasar de 100 %**, porque Meta puede contar una vista de landing de un
clic de otro día. **Si pasa, se dice; no se topa.** Toparlo es la lección que
`docs/acquisition/00-MAPA.md` ya dejó escrita sobre un `cap = 0.94`.

### C2-14 · Tasa de interacción

**Fórmula** · `Σ postEngagement / Σ impresiones × 100`, sobre las filas con la clave.
**Población** · Cobertura **90 %**.
**Rastro** · El prototipo tiene `IX` (`lib/aios/creative.js:46`) y **no lo dibuja nunca**.
**Estado** · Construible. Es señal de la pieza, no del negocio: mide si el contenido detiene el scroll.

### C2-15 · Las señales sociales, que existen y no se publican todavía

**Qué es** · `postReaction` (61 %), `onsiteConversion.postSave` (48 %), `comment` (23 %), `like` (6 %).
**Estado** · **Se guardan, no se publican.** Guardar es gratis —vienen en el mismo objeto— y publicar
cuatro cifras con cobertura del 6 % al 61 % al lado de cuatro con cobertura del 65 % al 90 % invita a
compararlas. Queda dicho para que el día que importen no haya que volver a llamar al proveedor.

---

## 4 · Las métricas del LEAD por pieza

Éstas no necesitan a Meta y son las que hacen que Creative deje de ser una maqueta el primer día.

### C2-16 · ICP promedio por pieza

**Qué es** · El puntaje de encaje que el CRM le asignó a los contactos que llegaron por la pieza.
**Fórmula** · Promedio de `(campos_del_crm->>$campoIcp)::numeric` sobre los contactos de la pieza que
traen el campo poblado.
**Unidad** · Puntaje, de 0 a 100.
**Población** · Contactos con `alta_en_el_crm` en la ventana y la pieza en `utmContent`, **con el campo
poblado**. El conteo de los que lo traen viaja siempre al lado.
**Piso** · `PISO_DE_UNA_TASA`.
**Rastro** · `docs/estado actual/02-CREATIVE.md:161`; medición propia del 2026-09-18.
**Estado** · **Construible hoy, medido.** Ventana de 30 días:

| pieza | contactos | con puntaje | ICP |
|---|---:|---:|---:|
| `evoluciona native` | 39 | 39 | **69,2** |
| `agendamiento - yaping - 23/07` | 65 | 59 | 48,6 |
| `el app` | 59 | 59 | 45,4 |
| `agendamiento - yaping` | 112 | 112 | 42,7 |
| `economia us latino` | 26 | 26 | **29,2** |

**Factor 2,4 entre la mejor y la peor pieza**, con cobertura del campo prácticamente total. Es la
cifra más valiosa del departamento y no depende de ninguna credencial nueva.

### C2-17 · El campo de ICP se resuelve por nombre, y hay diez candidatos

**Qué es** · `contactos.campos_del_crm` está indexado por **id de GoHighLevel**, no por nombre.
**Fórmula** · `campoPorNombre('Puntaje | ICP')` de `lib/negocio/camposDelCrm.ts:307`, que ya existe.
**Estado** · Medido: el id vigente es `9HXxl5DW6aayQgKUPiOS`, el campo más poblado de la cohorte (344
contactos en 30 días). **Y hay diez campos con nombre parecido** en el catálogo del CRM:
`Pre-Score | ICP`, `Puntaje | Meta Lead Ads`, `Pre-Score | Meta Lead Ads`, `Puntaje Final`,
`Puntaje Survey HT`, `perfil_icp`, `puntaje_encaje_icp`, `puntaje_interaccion`, `Lead Score`. Elegir
el equivocado es un defecto silencioso: la columna se llena con números plausibles de otra cosa.
**El nombre exacto va en una constante con su medición al lado**, y si `campoPorNombre` devuelve
`null` la columna **se apaga y lo dice** — no publica ceros.

### C2-18 · Tasa de agenda por pieza

**Fórmula** · Contactos de la pieza con al menos una cita / contactos de la pieza.
**Unidad** · Proporción.
**Población** · Contactos con `alta_en_el_crm` en la ventana.
**Piso** · `PISO_DE_UNA_TASA`.
**Rastro** · `docs/estado actual/02-CREATIVE.md:163-171`; medición del 2026-09-18.
**Estado** · **Construible hoy.** Medido: de 31 % a 77 % según la pieza, con cinco piezas sobre el
piso en 30 días. **Se cuenta con `count(distinct contacto_id)`** — verificado en
`02-CREATIVE.md:258`: un `count(*)` sobre el `left join` inflaba «agendamiento - yaping» de 109 a 112.
Y usa **el mismo `exists` con `ghl_calendario_id`** que `lib/negocio/costoDelAnuncio.ts:302-305`, o
las dos pantallas no sumarían igual.

### C2-19 · Las citas congeladas viajan al lado de la tasa de agenda

**Qué es** · Cuántas citas de la ventana todavía no ocurrieron, y por lo tanto no pueden haber
producido resultado.
**Rastro** · `docs/estado actual/02-CREATIVE.md` regla 7; el patrón está en
`lib/negocio/indicadoresDeCitas.ts:345`.
**Estado** · Medido allí: en 14 días, 11 congeladas de 147 alcanzables (7,0 %); en 30 días, 77 de 206
(**27,2 %**); en «Completo», 101 de 206 (32,9 %) — *«Completo no agrega ni una cita alcanzable sobre
30 días: agrega 24 congeladas.»* **Sin este conteo, una ventana de 30 días publica una tasa de agenda
que ignora que un cuarto de las citas todavía no pasó.**

### C2-20 · Contactos por pieza

**Fórmula** · `count(*)` agrupado por la clave normalizada.
**Unidad** · Contactos.
**Población** · La cohorte de la ventana por `alta_en_el_crm`, **entera**: «sin creativo» es fila
(`C1-03`) y `{{ad.name}}` es fila propia rotulada como plantilla sin expandir.
**Estado** · Construible hoy. No lleva piso: es un conteo, no una tasa.

### C2-21 · Los dos caminos de adquisición, por pieza

**Qué es** · Cuántos contactos de la pieza entraron por formulario de Meta y cuántos por la landing.
**Rastro** · `C1-12`.
**Estado** · Construible. Existe para que ninguna métrica de landing se divida por el total de la
pieza.

---

## 5 · El dinero, que se CONSUME y no se recalcula

### C2-22 · Gasto, CPM, CPC y CTR por pieza

**Fórmula** · Las filas de `costoDelAnuncio(dias)` agrupadas por la clave normalizada de la pieza.
**Rastro** · § 18.16: Acquisition **entrega** a Creative «rendimiento por anuncio, retención, CTR,
fatiga, frecuencia». `docs/estado actual/02-CREATIVE.md` regla 10.
**Estado** · **No se escribe una segunda consulta del gasto.** Dos consultas del mismo gasto es
exactamente cómo dos pantallas del mismo producto terminan mostrando dos números, que es la regla 12
de `07-REGLAS-TRANSVERSALES.md`. Creative agrupa lo que Acquisition ya calculó.
**Medido**: 79 anuncios, $3.511,28 de gasto guardado, 2.528 filas diarias del 2026-08-18 al 09-18.

### C2-23 · CPL por pieza

**Fórmula** · Gasto de la pieza / contactos de la pieza.
**Piso** · **Ninguno, y no es una inconsistencia.** `lib/negocio/costoDelAnuncio.ts:110-118` lo dejó
escrito: *«el piso existe para las PROPORCIONES… El CPL no es una proporción — "gastamos 200 y entró
uno" es un hecho exacto sobre lo que ya pasó.»* Lo que lo salva es que el conteo de contactos viaja al
lado.
**Estado** · Construible hoy.

---

## 6 · La fatiga

### C2-24 · La fatiga por CAÍDA DE CTR

**Qué es** · Una pieza cuyo CTR baja a lo largo de la ventana está cansando a su audiencia.
**Fórmula** · CTR de la mitad reciente de la serie contra el de la mitad anterior, por pieza.
**Unidad** · Proporción, y su variación.
**Población** · Piezas con serie suficiente. **Medido: 28 piezas con entrega, 8,1 días de promedio, 16
con ≥ 7 días, sólo 5 con ≥ 14. Máximo 26.**
**Rastro** · § 18.7 «Fatigue trend»; § 18.12 «Fatiga»; § 18.13.
**Estado** · **Construible hoy, con los datos ya recolectados.** Medido el 2026-09-18:

| pieza | días | gasto | CTR 1ª mitad | CTR 2ª mitad |
|---|---:|---:|---:|---:|
| `Evoluciona native` | 20 | $589 | **2,76 %** | **1,98 %** |
| `El app` | 14 | $385 | 4,73 % | 3,55 % |
| `agendamiento - yaping - 23/07` | 26 | $1.301 | 2,24 % | 3,35 % |

**La pieza de mejor ICP (69,2) y mejor tasa de agenda (77 %) es la que está perdiendo CTR.** Ése es
exactamente el hallazgo que la pantalla existe para dar, y es el que ninguna otra pantalla puede dar.

### C2-25 · La fatiga por FRECUENCIA no se puede construir

**Qué es** · El indicador clásico —la frecuencia sube y el CTR baja— exige agregar frecuencia.
**Estado** · **No existe**, por `C2-05`. Publicar una frecuencia promediada a lo largo de días y de
hasta seis anuncios de la misma pieza sería *«un número más grande que no significa nada, y que encima
se parece a uno que sí»*. La frecuencia se puede mostrar **por día y por anuncio**, en Acquisition.
Queda dicho para que su ausencia sea una decisión y no un olvido.

### C2-P01 · Los umbrales de fatiga y el piso de impresiones no están calibrados

Ni el umbral de «cuánto tiene que caer el CTR» ni el piso de impresiones de `C2-10` tienen un valor
justificado. **El § 18.19 del documento funcional lo declara pendiente**: «Definir umbrales iniciales
de anomalía y fatiga».

Publicar «fatigado» con un umbral inventado es exactamente lo que se le critica al prototipo. Las dos
salidas honestas son: elegir un valor, escribir su justificación al lado y **declarar que no está
calibrado**; o no publicar el veredicto y publicar la serie. No hay una tercera.

---

## 7 · Lo que NO es una métrica de Creative, aunque aparezca en su pantalla

1. **La retención del VSL.** Es de Conversion — `docs/estado actual/03-CONVERSION.md:248` lo deslinda:
   *«Creative mide retención del ANUNCIO, Conversion mide la del VSL de la landing. Son dos videos.»*
   Y además **el medidor está roto**: los cinco campos están en 0 de 233, y los 79 valores históricos
   valen todos exactamente `0`. Una pantalla que los promedie publica «retención del VSL: 0 %» y va a
   parecer un problema de creativo cuando es un pixel.
2. **El video precall.** Es el video que se manda **después** de agendar. Es el § 10.6 y es de
   Conversation.
3. **El revenue, el CAC y el ROAS.** Son de Business. `negocio.resultados` tiene 7 filas y cero ventas.
4. **Los cierres.** El prototipo los tiene (`SALES`, `lib/aios/creative.js:36`) y **no los dibuja**.
5. **Las métricas de video de Meta** —cuartiles, tiempo medio visto, retención de seis segundos—. No
   son de otro departamento: **no tienen fuente**. Ver `C14-05`.
6. **El placement, el formato y la duración.** El § 18.12 los pide y no llegan (`C14-06`, `C14-07`).
   El formato se podría **inferir del nombre** (`broll`, `horizontal`, `entrevista`, `editado`,
   `native`, `VSL`) y eso es una decisión de producto, no un dato: queda como pregunta abierta en
   `13-EL-CONTRASTE.md`, no como requisito.

---

## 8 · Índice del catálogo

| id | métrica | ¿construible hoy? |
|---|---|---|
| `C2-08` | La cabecera resume la población visible | sí, con cuatro cifras en vez de seis |
| `C2-09` | «Calificados» | **no con ese nombre** — se reemplaza por `C2-16` |
| `C2-10` | Hook rate | al guardar el desglose |
| `C2-11` | Link CTR | al guardar el desglose |
| `C2-12` | Landing page view rate | al guardar el desglose |
| `C2-13` | Click-to-landing rate | al guardar el desglose |
| `C2-14` | Tasa de interacción | al guardar el desglose |
| `C2-15` | Señales sociales | se guardan, no se publican |
| `C2-16` | **ICP promedio por pieza** | **sí, hoy** |
| `C2-18` | **Tasa de agenda por pieza** | **sí, hoy** |
| `C2-19` | Citas congeladas | **sí, hoy** |
| `C2-20` | Contactos por pieza | **sí, hoy** |
| `C2-21` | Los dos caminos | **sí, hoy** |
| `C2-22` | Gasto, CPM, CPC, CTR | **sí, hoy** — consumidos de Acquisition |
| `C2-23` | CPL por pieza | **sí, hoy** |
| `C2-24` | Fatiga por caída de CTR | **sí, hoy**, con base corta |
| `C2-25` | Fatiga por frecuencia | **no, por aritmética** |
