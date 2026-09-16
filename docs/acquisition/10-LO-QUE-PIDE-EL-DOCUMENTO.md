# Acquisition — lo que pide el documento funcional

> **Esta es la otra mitad de la carpeta.** Los documentos `01` a `09` salen del PROTOTIPO: lo que la
> pestaña dibuja hoy con datos inventados. Éste y los tres que siguen salen del DOCUMENTO FUNCIONAL,
> §18, que es una especificación escrita y que pide bastante más.
> Fuente: `CC_Arquitectura_Funcional.md`, § 18 «Acquisition Intelligence», subsecciones 18.1 a 18.19.
> El documento vive **fuera del repositorio** (en la carpeta de descargas del usuario), así que las
> citas son por número de sección y no por `archivo:línea`.
> Donde el documento y el prototipo digan cosas distintas, **gana el documento** — y las diferencias
> están en `13-EL-CONTRASTE.md`.

---

## La frase que acota todo el departamento

> **«No decide por sí solo qué anuncio genera más dinero para el negocio, porque esa conclusión
> requiere cruzar adquisición, ICP, agendamientos, ventas y revenue.»** (§ 18.1)

Es el límite del que cuelgan los nueve «no es responsable de» del § 18.8 y los nueve «requiere
validación ejecutiva» del § 18.10. Acquisition contesta **qué está pasando dentro de Meta**, no qué
conviene hacer con el negocio.

La consecuencia práctica, y hay que tenerla presente al construir cada cifra: **una pantalla de
Acquisition que ordene anuncios por «mejor» está fuera de alcance.** Puede ordenarlos por CPL, por
CTR o por retención — y tiene que decir que ése no es el orden del negocio.

---

## A10-01 · El alcance de la primera versión está enumerado, y es largo

El § 18.2 lista diecisiete cosas que la primera versión cubre: cuenta publicitaria, campañas,
conjuntos de anuncios, anuncios, creativos asociados, audiencias, presupuesto e inversión, entrega,
costos, clics, leads, métricas de video, retención, fatiga, anomalías, tendencias y calidad de
atribución.

**El prototipo cubre cinco de esas diecisiete**: campañas, presupuesto e inversión, costos, clics y
leads (que dibuja como «contactos»). Las doce que no cubre son la cuenta, los conjuntos de anuncios,
los anuncios, los creativos, las audiencias, la entrega, las métricas de video, la retención, la
fatiga, las anomalías, las tendencias y la calidad de atribución.

Y el § 18.2 cierra acotando: *«El foco inicial son campañas que envían tráfico hacia una landing con
VSL y formulario.»* Eso coincide con los tres embudos del prototipo (`01-LOS-TRES-EMBUDOS.md`) — los
tres terminan pasando por la landing.

---

## A10-02 · Lo que hay que importar de Meta, en dos listas

El § 18.4 separa lo que no cambia de lo que cambia todos los días. La distinción es del modelo de
datos: lo primero es una dimensión, lo segundo es un hecho con fecha.

### Identificadores y dimensiones

`meta_account_id` · `meta_campaign_id` · `meta_adset_id` · `meta_ad_id` · `meta_creative_id` ·
nombre de campaña · nombre de ad set · nombre del anuncio · estado · objetivo · presupuesto · fecha
de inicio y fin · landing asociada · formato · placement · audiencia.

### Métricas diarias

Spend · impressions · reach · frequency · clicks · **link clicks** · CTR · **link CTR** · CPC · CPM ·
leads · CPL · landing page views (cuando existan) · video plays · reproducciones de tres segundos ·
**retención de seis segundos** (cuando esté disponible) · reproducción al 25 %, 50 %, 75 % y 100 % ·
**average watch time** · resultados reportados por Meta.

> **«Las métricas deben guardarse por fecha para permitir comparaciones históricas.»** (§ 18.4)

**Estado hoy.** `public.closer_meta_metricas` existe con buena parte de esa forma y tiene **0 filas**.
Sus veintidós columnas son `id`, `org_id`, `nivel`, `objeto_id`, `nombre`, `padre_id`, `fecha`,
`gasto`, `impresiones`, `clics`, `alcance`, `ctr`, `cpc`, `cpm`, `leads`, `cpl`,
`video_reproducciones`, `video_25`, `video_50`, `video_75`, `video_100` y `sincronizado_el`.

**Cruzada contra la lista del § 18.4, cubre once de las diecinueve métricas diarias** —spend,
impressions, reach, clicks, CTR, CPC, CPM, leads, CPL, video plays y los cuatro cuartiles— y le
faltan siete: `frequency`, `link clicks`, `link CTR`, `landing page views`, reproducciones de tres
segundos, `average watch time` y los resultados reportados por Meta. La octava, la retención de seis
segundos, el propio documento la marca como condicional («cuando esté disponible»).

O sea: la tabla no es el destino terminado, es el destino **a medias** — y la diferencia importa
porque llenarla tal como está dejaría fuera las dos métricas de interacción con enlace y las tres de
retención de video, que son la mitad del § 18.12. Ver `08-DE-DONDE-VIENE-CADA-DATO.md`.

**La distinción `clicks` contra `link clicks` no es un detalle**, y hay que decirlo porque es fácil
colapsarla: un clic en el video, en el nombre de la página o en «ver más» cuenta como `click` y no
como `link click`. Un CTR calculado sobre el primero infla la interacción con la oferta. El documento
pide los dos, y el prototipo no distingue ninguno — su etapa «Clics a landing VSL» es, por su
etiqueta, un `link click`.

---

## A10-03 · La relación de atribución es una igualdad de tres términos

```text
lead.meta_ad_id  =  ad_performance.meta_ad_id  =  creative.meta_ad_id
```

Y además hay que conservar diez campos (§ 18.5): `utm_source`, `utm_medium`, `utm_campaign`,
`utm_content`, `utm_term`, `fbclid`, `first_touch_meta_ad_id`, `last_touch_meta_ad_id`,
`first_touch_at`, `last_touch_at`.

**Estado hoy.** Los cinco `utm_*` llegan dentro de `negocio.contactos.atribucion_primera`, con la
cobertura que mide `08-DE-DONDE-VIENE-CADA-DATO.md`. Lo que **no** existe con ese nombre es el par
first-touch / last-touch: la columna se llama `atribucion_primera` y guarda un solo toque. El
documento pide los dos y pide sus fechas.

---

## A10-04 · La regla que decide qué puede afirmar Acquisition con atribución rota

> **«Acquisition puede informar sobre Meta aunque la atribución posterior esté incompleta, pero no
> debe presentar como definitivas conclusiones sobre citas, ventas o revenue cuando la trazabilidad
> sea insuficiente.»** (§ 18.5)

Es una regla de dos mitades y las dos importan:

**Puede** publicar spend, CPM, CTR, CPL y todo lo que salga sólo de Meta, aunque ningún contacto
tenga `meta_ad_id`. Esas cifras no dependen de la atribución.

**No puede** publicar «este anuncio trae más citas» como un hecho cuando una parte de los contactos
no conserva el anuncio. Y la parte medida hoy no es chica: `adId` está en 213 de 585 contactos.

La forma de cumplirla es la que el § 18.14 pide: **publicar la cobertura al lado de la conclusión**,
no en una nota al pie.

---

## A10-05 · Acquisition NO recalcula revenue, CAC ni ROAS

> **«Acquisition no recalcula revenue, CAC real ni ROAS real.»** (§ 18.6)

Los consume de Business Intelligence «únicamente como contexto». Es la misma regla de
`2.4 Colaboración entre departamentos`: *«cuando un departamento necesita información de otro, debe
consumir sus datos o conclusiones, no recalcular su conocimiento»*.

**Y hoy se está violando en la pantalla de Executive**, que publica ROAS, costo por venta y margen
sobre ads con cifras inventadas — ver `07-LO-QUE-ENTREGA-A-OTROS.md`. Cuando eso se construya, el
cálculo es de Business y Acquisition lo recibe.

---

## A10-06 · Los veinticinco KPI del § 18.7, en cinco grupos

El documento los agrupa, y el grupo dice de qué habla cada uno. **Marcados en negrita los que el
prototipo no tiene de ninguna forma.**

### Entrega y costo

Spend · **CPM** · **Reach** · **Frequency** · **Impressions** · **Delivery status**

### Interacción

**CTR** · **Link CTR** · **CPC** · **Landing page view rate** · **Click-to-landing rate**

### Leads

Leads · CPL · **Lead rate** · Cost per qualified lead *(«cuando Business Intelligence exponga la
calificación»)*

### Video y creativo

**Three-second view rate** · **Six-second retention** · **25 %, 50 %, 75 % y 100 % view rate** ·
**Average watch time** · **Hook retention proxy** · **Fatigue trend**

### Calidad de atribución

**Leads por anuncio** · **Citas atribuidas por anuncio** · **Porcentaje de contactos con
`meta_ad_id`** · **Diferencia entre leads reportados por Meta y leads identificados en la base**

---

**El recuento es el titular de este documento: de los veinticinco KPI, el prototipo dibuja cuatro**
—spend, leads, CPL y el costo por calificado—. Los otros veintiuno no están, y **quince de ellos son
de video, de entrega o de calidad de atribución**, o sea tres de las familias que el § 18.2 pone
dentro del alcance de la primera versión.

Dos que conviene mirar con cuidado porque no son obvios:

**`Hook retention proxy`** — el documento no lo define. Es una **pregunta abierta**: con los
cuartiles que Meta sí entrega, el candidato natural es la caída entre `video_plays` y la
reproducción de tres segundos, pero eso hay que decidirlo, no deducirlo. Ver `13-EL-CONTRASTE.md`.

**`Cost per qualified lead`** — el prototipo lo dibuja como su KPI de cabecera («Calificados ·
$X por calificado»), y el documento lo condiciona: *«cuando Business Intelligence exponga la
calificación»*. O sea que el prototipo se adelantó a una dependencia que el documento pone en otro
departamento. No es un error del prototipo — es una decisión que hay que tomar: **quién define
«calificado»**.

---

## A10-07 · Los diez pendientes técnicos, que son el orden de trabajo

El § 18.19 los enumera, y son lo más parecido a un plan que el documento da:

1. Confirmar campos importados desde Meta.
2. Definir frecuencia de sincronización.
3. Guardar métricas por día.
4. Implementar first-touch y last-touch.
5. Validar UTMs en GHL.
6. Validar `meta_ad_id` en formularios y contactos.
7. Relacionar leads, citas y ventas reportadas con el anuncio.
8. Crear alertas estructuradas.
9. Definir umbrales iniciales de anomalía y fatiga.
10. Separar recomendaciones locales de decisiones ejecutivas.

**Tres de los diez ya están medidos y se pueden cerrar o descartar hoy**, y conviene decirlo para no
volver a investigarlos:

- **El 3 tiene su tabla hecha y vacía.** `public.closer_meta_metricas` es exactamente «guardar
  métricas por día» con jerarquía campaña→ad set→anuncio. Lo que falta es llenarla.
- **El 5 y el 6 están medidos.** Las UTM llegan a GoHighLevel y de ahí a `atribucion_primera`; el
  `meta_ad_id` llega en 213 de 585 contactos. El trabajo que queda no es validar que lleguen: es
  entender **por qué falta en el resto**, y hay una pista medida en `00-MAPA.md` — los contactos sin
  `adId` agendan al 82,5 %, o sea que se concentran en el widget de calendario.
- **El 10 es de producto y no de datos**, y el prototipo ya lo resolvió a su manera: separa «Señales
  detectadas · sin recomendación automática» del modal «Plan de acción». Ver `12-QUIEN-DECIDE-QUE.md`.

Los otros siete dependen de conectar Meta, y eso está cerrado por credencial: `closer_org_config`
tiene 3 filas y **0 con cuenta de anuncios y 0 con token**.
