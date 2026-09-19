# Creative — lo que pide el documento funcional

> Fuente: `CC_Arquitectura_Funcional.md` (*AI Operating System (AIOS) — Arquitectura Funcional,
> Borrador v0.1*, 1.650 líneas). **El documento vive FUERA del repositorio**, en la carpeta de
> descargas del usuario. Las citas van por `§` y por línea del archivo, y son literales.
>
> Lo que no está en el documento —y es casi todo lo que la pantalla dibuja— sale del prototipo, y está
> en `01`–`09`.
>
> **No existe ninguna sección § propia de Creative Intelligence en las 1.650 líneas.** Todo lo
> detallado vive dentro del § 18, que es el de Acquisition. Eso no es un descuido: es la contradicción
> que `07-LO-QUE-ENTREGA-Y-RECIBE.md` resuelve.

---

## C10-01 · El § 18.12 le da nueve indicadores y un límite explícito

`:1433-1447`, literal:

```
## 18.12. Creative Performance Analyzer

Analiza el rendimiento publicitario del creativo:

- Retención inicial.
- CTR.
- CPL.
- Caídas de retención.
- Fatiga.
- Frecuencia.
- Formato.
- Duración.
- Placement.

No reemplaza a Creative Intelligence, que interpreta hook, body, CTA, guion y nuevas variantes.
```

**El estado de los nueve, medido:**

| indicador | estado |
|---|---|
| Retención inicial | **se puede**, como hook rate (`C2-10`) — con la salvedad de definición de `C14-P01` |
| CTR | **se puede** — ya guardado, y ahora además el link CTR (`C2-11`) |
| CPL | **se puede** (`C2-23`) |
| Caídas de retención | **no tiene fuente.** Los cuartiles no llegan (`C14-05`) y cuatro puntos no son una curva |
| Fatiga | **se puede por caída de CTR** (`C2-24`); no por frecuencia (`C2-25`) |
| Frecuencia | **no se agrega** (`C2-05`). Existe por día y por anuncio, en Acquisition |
| Formato | **no tiene fuente** (`C14-07`). Está codificado en el nombre, y derivarlo es una decisión |
| Duración | **no tiene fuente** (`C14-07`) |
| Placement | **no tiene fuente** (`C14-06`) |

**Cuatro de nueve se pueden construir; dos quedan afuera por aritmética; tres no tienen fuente.**

> **El límite de la última línea conviene no borrarlo.** Este componente mide **cómo se comportó** la
> pieza en la subasta; Creative Intelligence interpreta **por qué**. Un creativo con buena retención y
> bajo CTR es un hallazgo de acá; qué tiene el hook que retiene y el copy que no convierte es de allá.
> Y hoy la mitad interpretativa no se puede construir, porque exige leer la pieza y la pieza no está
> guardada (`C7-11`).

---

## C10-02 · El § 18.7 pide seis métricas de «Video y creativo», y dos de «Interacción» que también son de la pieza

`:1281-1321`, el grupo completo:

```
### Video y creativo
- Three-second view rate.
- Six-second retention.
- 25%, 50%, 75% y 100% view rate.
- Average watch time.
- Hook retention proxy.
- Fatigue trend.
```

| KPI | estado |
|---|---|
| Three-second view rate | **se puede**, sobre `videoView` (90 % de cobertura) |
| Hook retention proxy | **se puede definir** sobre el mismo dato |
| Fatigue trend | **se puede**, por caída de CTR |
| Six-second retention | **no**, confirmado (`C14-05`) |
| 25/50/75/100 % view rate | **no**, confirmado |
| Average watch time | **no**, confirmado |

Y del grupo «Interacción» del mismo § 18.7 —*«CTR. Link CTR. CPC. Landing page view rate.
Click-to-landing rate.»*— los **tres que faltaban** ahora llegan: `Link CTR` (`C2-11`),
`Landing page view rate` (`C2-12`) y `Click-to-landing rate` (`C2-13`).

> **Esto es la corrección más grande que trae esta carpeta.** `lib/ghl/anuncios.ts:41-46` contaba
> *«las seis del § 18.7 «video y creativo» más dos de «interacción»»* como imposibles. Son **tres**
> las de interacción y **las tres llegan**; de las seis de video, **dos** llegan. Ver `14`.

### C10-03 · El `Hook retention proxy` no está definido en el documento, y ahora se puede

`docs/acquisition/10-LO-QUE-PIDE-EL-DOCUMENTO.md:177-179` lo dejó como pregunta abierta: *«el
documento no lo define. Es una pregunta abierta: con los cuartiles que Meta sí entrega, el candidato
natural es la caída entre `video_plays` y la reproducción de tres segundos, pero eso hay que decidirlo,
no deducirlo.»*

**Los cuartiles no llegan, así que ese candidato queda descartado.** El que sí se puede construir es
`videoView / impresiones`: de cada mil personas a las que se les mostró la pieza, cuántas la
reprodujeron. **Sigue siendo una decisión y no una deducción**, y va escrita con su definición al
lado, no con el nombre del documento.

---

## C10-04 · El § 18.15 le da al responsable creativo cuatro cosas, y tres no tienen fuente

`:1499-1531`:

```
### Responsable creativo

Ve:

- Anuncios con mejor retención.
- Creativos fatigados.
- Hooks con mejor comportamiento.
- Solicitudes de nuevas variantes.
```

Desarrollado en `12-QUIEN-VE-QUE.md`.

---

## C10-05 · El § 18.13 pide un detector de fatiga con esquema de alerta

`:1449-1481`. Diez detecciones y catorce campos por alerta. Desarrollado en
`11-EL-ANALIZADOR-Y-EL-DETECTOR.md`.

---

## C10-06 · El § 5.1 le da a Creative una entidad principal: `Creative Profile`

`:209`. **No existe como tabla**, y no se puede llenar por esta vía (`C14-07`, `C14-08`). El § 18.4
nombra además `meta_creative_id` (`:1185`) y el § 18.5 declara la relación
`lead.meta_ad_id = ad_performance.meta_ad_id = creative.meta_ad_id` (`:1231`) — el tercer término de
esa igualdad no tiene tabla.

---

## C10-07 · El § 2.3 le da un derecho propio: recomendar variantes

`:88`: *«**Creative Intelligence puede recomendar crear variantes de un anuncio.**»*

Y el § 18.9 (`:1358-1363`) enumera tres recomendaciones permitidas que son de esta materia:

```
- Crear variantes por fatiga.
- Revisar un creativo con buena retención y bajo CTR.
- Revisar un creativo con buen CTR y mala retención.
```

**Las dos últimas necesitan retención, que no llega.** La primera se puede construir hoy (`C2-24`).
Y todas son **recomendaciones**, no acciones: el § 18.10 (`:1383`) reserva las decisiones para
Executive, y la decisión del 2026-09-18 es que Creative sea de sólo lectura (`C6-10`).

---

## C10-08 · El § 18.16 define el contrato de datos que Acquisition le entrega

`:1533-1545`:

```
### A Creative Intelligence

- Rendimiento por anuncio.
- Retención.
- CTR.
- Fatiga.
- Frecuencia.
- Formato.
- Placement.
- Tendencia histórica.
```

Renglón por renglón en `C7-06`: **cuatro de las ocho no se pueden entregar.**

---

## C10-09 · El § 2.5 prohíbe el ranking simple, y es la razón de que el orden sea elegible

`:104`: *«Un anuncio con bajo CTR puede seguir siendo valioso si genera mejores ICP, más ventas o
mayor revenue.»*

Es el fundamento del `C3-01`: un puntaje único esconde exactamente eso. Y es el fundamento de que el
ICP por pieza sea la cifra central del departamento (`C2-16`): **es el eslabón de esa cadena que hoy
tiene dato**.

---

## C10-10 · El § 16.2 pone a Creative después de una validación que todavía no pasó

`:1078`: *«Antes de construir Business, **Creative** y Executive Intelligence, debe validarse la
trazabilidad: Anuncio → Landing → Sesión → VSL → Formulario → Contacto GHL → ICP → Cita → Asistencia →
Venta reportada»*.

**Estado, eslabón por eslabón:**

| eslabón | estado |
|---|---|
| Anuncio → Contacto | **94,5 % por nombre**, 36,2 % por `adId` (`C8-03`, `C8-04`) |
| Contacto → ICP | **prácticamente total** (`C8-08`) |
| ICP → Cita | **sí** (`C8-09`) |
| Landing → Sesión → VSL | **roto**: los cinco campos de VSL en 0 de 233, y «Form Landing VSL» cortado el 2026-08-31 |
| Cita → Asistencia | **`negocio.citas.asistio` tiene 0 no nulos** |
| Asistencia → Venta | **`negocio.resultados`: 7 filas, cero ventas** |

O sea: **la cadena está entera de Anuncio a Cita y cortada de Cita en adelante.** Creative se puede
construir hasta donde la cadena llega, y el § 18.1 (`:1136`) ya dice por qué eso no alcanza para la
pregunta grande: *«No decide por sí solo qué anuncio genera más dinero para el negocio, porque esa
conclusión requiere cruzar adquisición, ICP, agendamientos, ventas y revenue.»*

---

## C10-11 · El § 18.19 declara pendiente lo que la pantalla necesita para dar un veredicto

`:1649`, pendiente 9: *«Definir umbrales iniciales de anomalía y fatiga.»*

**Es el pendiente que decide si la fatiga se puede publicar como veredicto o sólo como serie.** Ver
`C2-P01`.

---

## C10-12 · Y el § 17 admite que Creative no está especificado

`:1112`: *«Las siguientes áreas tienen visión general, pero todavía requieren especificación detallada:
… **Creative Intelligence.** …»*

Es la línea que justifica esta carpeta entera: **la especificación detallada de Creative hay que
escribirla, y la mitad de ella ya estaba escrita en la maqueta sin que nadie la hubiera enunciado.**
