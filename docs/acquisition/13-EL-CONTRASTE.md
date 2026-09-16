# Acquisition — el prototipo contra el documento

> Esta carpeta tiene dos fuentes: el PROTOTIPO (`01`–`09`) y el DOCUMENTO FUNCIONAL § 18 (`10`–`12`).
> Este documento las cruza. Es el único que no agrega requisitos: los compara.
> La regla de precedencia, dicha una vez: **donde los dos digan cosas distintas, gana el documento.**
> El prototipo es una maqueta; el documento es una especificación escrita.

---

## En una tabla

| | El documento lo pide | El prototipo lo dibuja |
|---|---|---|
| KPI del § 18.7 | 25 | **4** (spend, leads, CPL, costo por calificado) |
| Componentes internos (§ 18.3) | 6 | **0** |
| Detecciones de anomalía (§ 18.13) | 10 | 2, escritas a mano |
| Campos de la alerta (§ 18.13) | 14 | **0** |
| Monitores de atribución (§ 18.14) | 7 | **0** |
| Niveles de la jerarquía (§ 18.4) | 5 (cuenta→campaña→ad set→anuncio→creativo) | **1** (campaña) |
| Roles con vista propia (§ 18.15) | 3 | 1, implícito |
| Métricas de video (§ 18.7) | 6 | **0** |

---

## 1 · Lo que el documento pide y el prototipo no tiene

Ordenado por lo que más cambia la arquitectura, no por tamaño.

### 1.1 · La estructura interna, entera

Los seis componentes del § 18.3 no existen. El prototipo es un módulo que calcula todo junto y lo
dibuja. **La diferencia no es de organización del código**: dos de los seis —el detector de anomalías
y el monitor de atribución— producen filas persistidas con esquema propio. Una alerta tiene que
sobrevivir a la recarga para poder decir cuándo apareció y si se resolvió. Ver
`11-LOS-SEIS-COMPONENTES.md`.

### 1.2 · Veintiuno de los veinticinco KPI

Y no es una cola de métricas menores: **quince de los veintiuno son de video, de entrega o de calidad
de atribución**, o sea tres de las familias que el § 18.2 pone dentro del alcance de la primera
versión. El prototipo no tiene CPM, ni reach, ni frequency, ni estado de entrega, ni link
CTR, ni ninguna métrica de video. Ver `10-LO-QUE-PIDE-EL-DOCUMENTO.md`.

### 1.3 · Los niveles intermedios de la jerarquía

El § 18.4 pide `meta_account_id`, `meta_campaign_id`, `meta_adset_id`, `meta_ad_id` y
`meta_creative_id`. **El prototipo modela un solo nivel: la campaña**, y la identifica por su
NOMBRE — que es además un defecto medido, porque un mismo nombre agrupa anuncios de campañas
distintas (`01-LOS-TRES-EMBUDOS.md`).

### 1.4 · First-touch y last-touch

El § 18.5 pide los dos con sus fechas. La base guarda `atribucion_primera`, **un solo toque**. Sin
los dos no se puede detectar el «first-touch sobrescrito» que el § 18.14 pide monitorear.

### 1.5 · Las tres vistas por rol

El § 18.15 describe tres listas distintas. El prototipo tiene una sola pantalla. Y la del responsable
creativo es la más lejana: sus cuatro cosas son todas de retención y fatiga.

---

## 2 · Lo que el prototipo tiene y el documento NO menciona

Esta mitad es la que se pierde si alguien construye leyendo sólo el documento, y hay cuatro cosas que
vale la pena conservar.

### 2.1 · Los tres embudos con etapas distintas

El documento habla de «campañas que envían tráfico hacia una landing con VSL y formulario» (§ 18.2),
en singular. El prototipo modela **tres recorridos con etapas propias y de largo distinto** — y uno
de ellos, «Booking directo», tiene un paso `forms` que los otros no.

**Eso no está en el § 18 y es una decisión de producto que alguien tomó.** Obliga a que el recorrido
se guarde como secuencia por embudo y no como columnas fijas. Ver `01-LOS-TRES-EMBUDOS.md`.

### 2.2 · Los dos modos de tasa de paso

Contra la etapa anterior, o contra el punto de entrada. El documento no lo menciona. Contestan
preguntas distintas —«¿dónde se cae?» contra «¿cuánto llega?»— y las dos hacen falta.

### 2.3 · El botón «Ver evidencia»

El § 18.13 pide un campo `evidence` en la alerta. El prototipo pone un botón al lado de cada señal.
**No está cableado a nada**, y aun así es el requisito que convierte `evidence` de texto en algo
navegable. Conviene conservarlo.

### 2.4 · La separación entre detectar y recomendar, dicha en pantalla

El encabezado del bloque de señales dice literalmente **«Señales detectadas · sin recomendación
automática»**, y el «Plan de acción» vive en otro sitio, detrás de un botón. El § 18.19 pone «separar
recomendaciones locales de decisiones ejecutivas» como pendiente número 10 — y el prototipo ya lo
resolvió en la interfaz. Ver `06-SENALES-Y-PLAN-DE-ACCION.md`.

---

## 3 · Donde los dos se contradicen

Son pocas y hay que resolverlas antes de construir.

### 3.1 · Quién define «calificado»

**El prototipo** lo calcula solo: `calificados = agendados × tasa de calificación`, y publica «costo
por calificado» como su KPI de cabecera.

**El documento** lo condiciona: *«Cost per qualified lead, **cuando Business Intelligence exponga la
calificación**»* (§ 18.7), y en el § 18.6 lista «ICP promedio por anuncio, **cuando Business
Intelligence lo exponga**».

**Gana el documento**: la calificación es de Business, y Acquisition la consume. La decisión
pendiente no es técnica — es **quién es el dueño de la definición de «calificado»**, y hoy no está
tomada. El ICP existe en la base, así que el dato está; lo que falta es el acuerdo.

### 3.2 · El tope del 94 %

`cap = v => Math.min(.94, v)` recorta toda tasa de paso del prototipo. **El documento no lo pide** y
la conclusión correcta es la contraria: una tasa real sí puede acercarse al 100 %, y el trabajo es
explicar por qué. Medido, los contactos sin `adId` agendan al 82,5 % — la tasa más alta de la tabla, y
lo que dice es que **el widget de calendario no pasa el `adId`**. Taparla habría escondido la señal.
Ver `09-LO-QUE-NO-ES-UN-REQUISITO.md`.

### 3.3 · Los umbrales del «Plan de acción»

El prototipo trae umbrales concretos —«afinidad ICP de 43 %», «costo por calificado bajo $110»— en
recomendaciones que el documento pone en el terreno de la **validación ejecutiva** (§ 18.10:
«escalar únicamente por CPL», «duplicar presupuesto»).

**No se contradicen del todo**: el documento no prohíbe *mostrar* la recomendación, prohíbe
*decidirla* sola. Pero los umbrales del prototipo están elegidos a ojo y el § 18.19 punto 9 los deja
como pendiente explícito. **Tratarlos como ejemplos, no como valores.**

---

## 4 · Qué se puede construir hoy, medido

Tres cosas, y ninguna necesita conectar Meta.

**1 · El Attribution Monitor, cinco de sus siete puntos.** Se miden contra `negocio.contactos`, que
ya tiene los datos. Es el componente más barato del § 18 y el que dice **cuánto vale todo lo demás**.

```sql
select count(*) total,
       count(*) filter (where atribucion_primera ? 'adId')          con_adid,
       count(*) filter (where atribucion_primera ? 'campaignId')    con_campaign,
       count(*) filter (where atribucion_primera ? 'utmContent')    con_creativo,
       count(*) filter (where atribucion_primera ? 'sessionSource') con_fuente
from negocio.contactos;
-- 2026-09-16: 585 · 213 · 358 · 503 · 545
```

**2 · Leads y citas atribuidos por anuncio** (§ 18.7, grupo «calidad de atribución»). Los dos salen
de la base. No son CPL —eso necesita gasto— pero sí son el volumen por anuncio, con su cobertura
declarada al lado.

**3 · La pregunta que el § 18.1 dice que Acquisition NO puede contestar solo, en su versión honesta.**
Ordenar anuncios por calidad del lead que traen, usando el ICP que ya está en la base, y decir al lado
que ése no es el orden del negocio porque falta el revenue. Es lo que `docs/estado actual/02-CREATIVE.md`
ya midió para creativos —ICP 27,5 contra 74,1 según cuál— y vale igual por anuncio.

---

## 5 · Lo que bloquea al resto, en una línea

**`public.closer_org_config` tiene 3 filas, 0 con `meta_ad_account_id` y 0 con `meta_token_cifrado`.**

Sin esa credencial no hay Meta Data Collector, y sin colector no hay ninguno de los otros cuatro
componentes ni veintidós de los veinticinco KPI. La tabla de destino ya existe y está vacía
(`public.closer_meta_metricas`, 0 filas, sin un solo lector ni escritor en todo el repositorio).

No es un problema de diseño ni de esfuerzo: es una credencial que nadie cargó.
