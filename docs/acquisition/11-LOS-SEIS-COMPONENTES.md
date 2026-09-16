# Acquisition — los seis componentes internos

> Sale del DOCUMENTO FUNCIONAL, § 18.3, 18.12, 18.13 y 18.14. El prototipo no tiene nada de esto:
> dibuja tablas y dos alertas escritas a mano, sin ninguna estructura detrás.
> El documento vive fuera del repositorio; las citas son por número de sección.

---

El § 18.3 divide Acquisition en seis piezas, y aclara que **«pueden implementarse como agentes,
servicios o funciones»** — o sea que la división es de responsabilidad, no de tecnología.

```text
Acquisition Intelligence
│
├── Meta Data Collector
├── Campaign Performance Analyzer
├── Creative Performance Analyzer
├── Audience Performance Analyzer
├── Anomaly & Fatigue Detector
└── Attribution Monitor
```

**Ninguno existe.** Y la división importa más de lo que parece: tres de los seis —el detector de
anomalías, el monitor de atribución y el analizador de creativos— producen su propia salida
estructurada, con esquema propio, y no son «una vista más de la tabla».

---

## A11-01 · Meta Data Collector

**Qué hace.** Trae de Meta lo que el § 18.4 enumera y lo guarda **por fecha**, con la jerarquía
cuenta → campaña → ad set → anuncio → creativo.

**Lo que hay que decidir y el documento deja abierto** (§ 18.19 punto 2): **la frecuencia de
sincronización**. No es una decisión de comodidad — decide qué alertas son posibles. Una anomalía de
CPM detectable el mismo día necesita varias corridas diarias; una tendencia de fatiga a siete días se
conforma con una.

**Dependencia dura, medida.** `public.closer_org_config` tiene 3 filas y **0 con
`meta_ad_account_id` y 0 con `meta_token_cifrado`**. Sin credencial no hay colector. Es la primera
pieza de la cadena y la única que bloquea a las otras cinco.

**Y una decisión de diseño que conviene tomar antes de escribir la primera línea**: el colector
escribe métricas que **no se recalculan**. Una fila de `2026-09-01` con su gasto es un hecho cerrado.
El día que Meta corrija un dato hacia atrás —lo hace, sobre todo con atribución y conversiones— hay
que decidir si se pisa la fila o se guarda la corrección. Sin esa decisión, dos lecturas de la misma
ventana en días distintos dan cifras distintas y nadie sabe por qué. Es el mismo problema que
`docs/estado actual/09-DEUDA-ABIERTA.md` documenta para las etiquetas de descarte.

---

## A11-02 · Campaign Performance Analyzer

**Qué hace.** Es el que produce lo que el prototipo ya dibuja: rendimiento por campaña, por ad set y
por anuncio, con sus costos y sus tasas de paso.

**Es el único de los seis que el prototipo cubre**, y lo cubre a medias: tiene campañas, le faltan
los ad sets y los anuncios como nivel propio. Medido, ese hueco ya duele: en la base hay **15
anuncios y 14 campañas distintos**, y el prototipo sólo modela el nivel campaña. Ver
`02-METRICAS.md` para las dimensiones que toda métrica tiene que poder cortar.

---

## A11-03 · Creative Performance Analyzer

El § 18.12 le da nueve aspectos: retención inicial, CTR, CPL, caídas de retención, fatiga,
frecuencia, formato, duración y placement.

Y le pone un límite explícito:

> **«No reemplaza a Creative Intelligence, que interpreta hook, body, CTA, guion y nuevas
> variantes.»** (§ 18.12)

**La línea es clara y conviene no borrarla**: este componente mide **cómo se comportó** el creativo
en la subasta; Creative Intelligence interpreta **por qué**. Un creativo con buena retención y bajo
CTR es un hallazgo de acá; qué tiene el hook que retiene y el copy que no convierte es de allá.

**Estado hoy.** De los nueve aspectos, ninguno se puede medir: los cinco que salen de Meta necesitan
el colector, y `formato`, `duración` y `placement` ni siquiera están entre las columnas de la tabla
de destino. Lo único que existe hoy del creativo es su **nombre**, en
`atribucion_primera->>'utmContent'` (503 de 585 contactos, 30 valores distintos) — y eso permite una
cosa que este componente NO hace y que `docs/estado actual/02-CREATIVE.md` ya midió: ordenar
creativos por la **calidad del lead** que traen, que es una pregunta de negocio y no de subasta.

---

## A11-04 · Audience Performance Analyzer

El § 18.2 pone «audiencias» en el alcance y el § 18.9 permite recomendar «probar una audiencia» y
«revisar solapamiento de audiencias». El § 18.13 pide detectar «cambios bruscos por ad set».

**Es el componente peor especificado de los seis**, y hay que decirlo: el documento nunca enumera qué
métricas produce ni qué es una «audiencia» a efectos del modelo — si es el ad set, el público
guardado de Meta, o una segmentación propia. **Queda como pregunta abierta.**

Lo que sí se puede afirmar: el dato de entrada es el ad set, porque es el nivel donde Meta define la
segmentación. Y ese nivel hoy está casi vacío en la base — `docs/estado actual/01-ACQUISITION.md`
mide el identificador de ad set en 39 de 233 contactos de su ventana, con **un solo** valor distinto.
O sea que aunque se conectara Meta mañana, el cruce contra nuestros contactos por ad set no tendría
con qué hacerse.

---

## A11-05 · Anomaly & Fatigue Detector

Es el componente más especificado del § 18 y el que más lejos está de existir.

### Las diez detecciones (§ 18.13)

1. Caídas inusuales de CTR.
2. Aumentos abruptos de CPM.
3. Aumento sostenido de CPL.
4. Frecuencia alta.
5. Spend sin crecimiento proporcional.
6. Diferencias entre leads de Meta y la base.
7. Anuncios sin entrega.
8. Concentración excesiva de presupuesto.
9. Cambios bruscos por ad set.
10. Cambios de fase de aprendizaje.

**Nueve de las diez necesitan una serie histórica**, no una foto: «caída», «aumento», «sostenido»,
«brusco» y «cambio de fase» son todos comparaciones contra un pasado. Por eso el § 18.4 insiste en
guardar por fecha, y por eso el punto 3 de los pendientes técnicos es previo a los puntos 8 y 9.

La única que se puede calcular con una sola lectura es la 8, la concentración de presupuesto.

### El esquema de la alerta (§ 18.13)

> **«Cada alerta debería guardar:»**

```text
alert_id
entity_type
entity_id
metric
baseline
current_value
change_percentage
period_start
period_end
severity
confidence
possible_causes
recommended_review
created_at
```

**Catorce campos, y tres de ellos son la diferencia entre una alerta y un cartel.** Conviene
nombrarlos porque son los que se olvidan:

- **`baseline`** — contra qué se comparó. Sin él, un «CTR cayó 22 %» no se puede auditar ni
  reproducir.
- **`confidence`** — cuánta evidencia hay. Es lo que permite no publicar una alerta construida sobre
  tres impresiones, y lo que conecta con el `PISO_DE_UNA_TASA = 10` que este repositorio ya aplica en
  todas sus tasas (`lib/negocio/indicadoresDeCitas.ts:300`).
- **`possible_causes`** — en plural, y el plural es del documento. Una alerta que afirma UNA causa
  está diagnosticando, y diagnosticar sin cruzar con Business y Creative es exactamente lo que el
  § 18.1 le prohíbe a este departamento.

Y `recommended_review` —no `recommended_action`— dice lo mismo con el nombre del campo: **la alerta
propone mirar, no propone hacer.**

### Contra lo que el prototipo tiene

El prototipo dibuja **dos alertas escritas a mano en el JSX**, con título y diagnóstico fijos, un
botón «Ver evidencia» que no está cableado, y el encabezado «Señales detectadas · sin recomendación
automática». No tiene ninguno de los catorce campos. El detalle está en
`06-SENALES-Y-PLAN-DE-ACCION.md`.

Lo que **sí** aporta el prototipo y el documento no dice: **el botón «Ver evidencia»**. Es la forma
de que `evidence` sea navegable y no un texto. Vale conservarlo como requisito.

### Los umbrales no están, y es un pendiente declarado

El punto 9 del § 18.19 es «definir umbrales iniciales de anomalía y fatiga». **El documento no da ni
uno.** El prototipo tampoco, en sus señales — pero sí da algunos en el modal «Plan de acción»
(«afinidad ICP de 43 %», «costo por calificado bajo $110»), que son de otra cosa. Ver
`06-SENALES-Y-PLAN-DE-ACCION.md`.

---

## A11-06 · Attribution Monitor

El § 18.14 le da siete cosas que monitorear:

1. Porcentaje de leads con `meta_ad_id`.
2. Porcentaje de citas con anuncio identificado.
3. Porcentaje de ventas reportadas con anuncio identificado.
4. Diferencia entre leads de Meta y GHL.
5. Sesiones con UTM incompletas.
6. First-touch sobrescrito.
7. Contactos sin campaña o creativo.

Y da el ejemplo de salida, que es el formato:

> **«El 37 % de los contactos creados esta semana no conserva `meta_ad_id`; las conclusiones por
> anuncio son incompletas.»** (§ 18.14)

**Ése es el componente que más se puede construir hoy**, y es el único de los seis que no depende de
conectar Meta: cinco de los siete se miden contra `negocio.contactos`, que ya tiene los datos.

Medido el 2026-09-16 sobre los 585 contactos de la base:

| Qué | Cobertura |
|---|---|
| `sessionSource` | 545 de 585 |
| `utmContent` (creativo) | 503 de 585 |
| `campaignId` | 358 de 585 |
| `adId` | **213 de 585** |

```sql
select count(*) total,
       count(*) filter (where atribucion_primera ? 'adId')          con_adid,
       count(*) filter (where atribucion_primera ? 'campaignId')    con_campaign,
       count(*) filter (where atribucion_primera ? 'utmContent')    con_creativo,
       count(*) filter (where atribucion_primera ? 'sessionSource') con_fuente
from negocio.contactos;
-- 2026-09-16: 585 · 213 · 358 · 503 · 545
```

**El punto 4 —la diferencia entre leads de Meta y GHL— es el único de los siete que necesita Meta**,
y es el más valioso de todos: es la comprobación cruzada que dice si el problema está en la captura o
en la ingesta.

**El punto 6 —first-touch sobrescrito— no se puede medir hoy, y no por falta de volumen**: la base
guarda `atribucion_primera`, un solo toque. Detectar que un first-touch fue pisado exige guardar los
dos, que es el punto 4 del § 18.19.

---

## Lo que esta división cambia respecto del prototipo

El prototipo es **una pantalla**: un módulo que calcula todo junto y lo dibuja. El documento pide
**seis productores con salidas distintas**, y dos de ellos —el detector de anomalías y el monitor de
atribución— producen filas persistidas con esquema propio, no una vista.

La consecuencia práctica, y es la que decide la arquitectura: **una alerta tiene que sobrevivir a la
recarga de la pantalla.** Si se recalcula al abrir, no se puede decir cuándo apareció, no se puede
marcar como vista, y no se puede medir si la acción que la siguió la resolvió — que es lo que el
§ 18.18 pide. El prototipo las tiene escritas en el JSX, o sea en el extremo opuesto.
