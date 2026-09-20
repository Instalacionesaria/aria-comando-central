# Las siete menciones, las tres entidades y la traza del § 5.2

> Fuente: `CC_Arquitectura_Funcional.md`, **1.651 líneas**, leído entero el 2026-09-20.
> Cada requisito lleva su línea. Lo que no se pudo rastrear está dicho como pregunta abierta.

---

## 1 · Este es el archivo más corto de la carpeta, y no por descuido

### CV10-01 · Conversion aparece siete veces en 1.651 líneas

| línea | qué dice |
|---|---|
| `:8` | *«Pendiente: especificación detallada de Sales, Acquisition, **Conversion**, Creative…»* |
| `:146` | figura en la capa de inteligencia del diagrama |
| `:171` | figura en el organigrama, con sus dos submódulos |
| `:1111` | vuelve a figurar en la lista de secciones pendientes |
| `:1383` | *«requieren contexto de Business Intelligence y, cuando corresponda, Creative, **Conversion** y Executive»* |
| `:1425` | **la única frase que Conversion dice** |
| `:1546` | `### A Conversion Intelligence` — lo que Acquisition le entrega |

**Dos de las siete son la misma lista de pendientes.** Acquisition tiene un `§ 18` con diecinueve
subsecciones; Creative hereda del `§ 18.12` y del `§ 18.15`. **Conversion no hereda de ninguna
parte.**

### CV10-02 · La única frase

> **Conversion:**
> La finalización del formulario es baja.

`§ 18.11`, `:1425`, dentro del «Caso 3: Buen CTR, mala landing». Es todo lo que el documento pone en
boca de este departamento, y es por eso que `CV2-05` —la tasa de finalización del formulario— es la
métrica que la carpeta trata como obligatoria.

---

## 2 · Lo que sí le da

### CV10-03 · Dos submódulos

```text
├── Conversion Intelligence
│   ├── Landing Intelligence
│   └── VSL Intelligence
```

`§ 4`, `:171-173`. **No hay un tercer submódulo para el formulario**, así que el formulario vive
dentro de Landing Intelligence. Ver `11-LOS-DOS-SUBMODULOS.md`.

### CV10-04 · Tres entidades, y ninguna existe

`§ 5.1`, `:210-212`: `Landing Session`, `VSL Session`, `Form Submission`.

**Estado** · **Ninguna existe como tabla.** Ver `CV8-12`. Las tres son la forma correcta del
problema: una fila por sesión, no una columna por contacto. Y el `§ 5.3:265` lo dice explícito:

> Los eventos de reproducción no deben guardarse únicamente como un valor fijo en el contacto. Debe
> conservarse su historial y exponer un resumen en el perfil.

**Lo que hay hoy es exactamente lo que esa frase prohíbe**: `VSL % máximo visto` es un valor fijo en
el contacto, sin historial. Y está en cero.

### CV10-05 · La traza, con el eslabón que falta

`§ 5.2`, `:228-235`:

```text
meta_ad_id → visitor_id → session_id → lead_id → ghl_contact_id → appointment_id → …
```

**Estado** · **`visitor_id` y `session_id` dan cero coincidencias en todo el repositorio.** Los dos
eslabones que le tocan a Conversion son justamente los que no existen. Lo que sí existe es
`ghl_contact_id → appointment_id`, que es de donde sale la única fuente viva del departamento.

El `§ 16.2:1093-1102` lo pone como prueba pendiente número 2: *«Generar `visitor_id` y `session_id`»*,
y la 5: *«Validar tracking individual del VSL»*.

### CV10-06 · El recorrido del § 1 y el del § 9.2

`§ 1`, `:28-39`, define el embudo del sistema. `§ 9.2`, `:466-477`, define el recorrido esperado de
Lead Flow y **pasa entero por el territorio de Conversion**:

```text
… → Envío del enlace a la landing VSL → Apertura del enlace → Visita a la landing
  → Consumo de la VSL → Formulario completado → Cita agendada
```

**Estado** · Medido, el 44 % de la gente ya no hace ese recorrido (`CV1-03`). El documento describe
un camino que la empresa dejó de usar el 2026-08-31.

### CV10-07 · El trigger link, y los seis estados que permite distinguir

`§ 9.5`, `:529-549`: enlace enviado · abierto · landing visitada · formulario iniciado · formulario
completado · cita agendada. Y el motivo: *«Esto permite al supervisor identificar el punto real de
pérdida»* (`:540`), con los cuatro casos enumerados en `:544-547`.

**Estado** · El instrumento es de **Lead Flow**, y su huella queda en la columna que lee Conversion:
`Trigger Link` vale 29 en `atribucion_ultima` y **0** en `atribucion_primera`. Ver `CV7-06`.

### CV10-08 · Los tres KPIs que el documento le da a Lead Flow

`§ 9.7`, `:609-611`: `Landing visit rate`, `Form start rate`, `Form completion rate`.

**Estado** · Es el solapamiento más grande de la carpeta. Ver `CV1-P02` y `CV7-05`.

### CV10-09 · Lo que Acquisition le entrega

`§ 18.16`, `:1546-1552`. Las cinco, remedidas en `CV7-01`. Una de ellas —`landingPageView`— **llega
desde el 2026-09-19** y corrige lo publicado.

### CV10-10 · El VSL, condicionado dos veces y pendiente una

| línea | qué dice |
|---|---|
| `§ 5.3:258` | *«Porcentaje máximo visto del VSL, **cuando exista tracking individual verificable**»* |
| `§ 10.5:733` | *«Consumo del VSL, **cuando exista tracking individual verificable**»* |
| `§ 10.7:761` | *«Show rate según consumo del VSL»* — un KPI de Appointment Flow que depende de este dato |
| `§ 16.2:1099` | *«Validar tracking individual del VSL»* — pendiente técnico número 5 |

**El documento nunca asume que el VSL funcione.** Lo condiciona dos veces y lo pone como pendiente
una. Medido: **no funciona** (`CV14-07`).

---

## 3 · Lo que el documento NO le da

### CV10-11 · Sin KPIs, sin umbrales, sin responsables

El `§ 17:1111` lo declara pendiente de especificación. No hay:

- una lista de KPIs de Conversion —los tres que existen están bajo Lead Flow;
- un umbral de ningún tipo;
- un `Conversion Performance Analyzer` ni un detector equivalente al `§ 18.13`;
- un esquema de alerta como el de `§ 18.13:1466-1481`;
- una sección de «Usuarios responsables» como el `§ 18.15`;
- un deslinde explícito entre `Landing Intelligence` y `VSL Intelligence`.

**Consecuencia**: el prototipo es la especificación, y esta carpeta es donde se convierte en
requisitos. Ver `12-QUIEN-VE-QUE.md`.

---

## Preguntas abiertas

### CV10-P01 · ¿El paso «Gracias» está en el documento?

El recorrido del `§ 1:28-39` termina en `Lead calificado → Agendamiento`. El del `§ 9.2:466-477`
termina en `Cita agendada`. **Ninguno menciona una página de gracias.** El prototipo la dibuja como
quinto paso con seis cifras literales, y su contenido propio —el video de bienvenida— es el precall,
que es del `§ 10.6`. Ver `CV3-P02`.

### CV10-P02 · ¿«Calidad del tráfico» qué es?

`§ 18.16:1550` la promete y el documento no la define. Ver `CV7-P01`.
