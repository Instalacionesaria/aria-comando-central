# Lo que pide el documento funcional: siete líneas, y ninguna frase

> Barrido completo de `CC_Arquitectura_Funcional.md` (**1.650 líneas**, verificado con `wc -l`),
> hecho el **2026-09-20**. El documento **no vive en el repositorio**: está en
> `C:\Users\USUARIO\Downloads\`. Las citas `:NNN` son a ese archivo.

---

## S11-01 · Las siete menciones, enteras

De las siete líneas que contienen la palabra «Sales», **cinco** hablan del departamento y **dos** son
entidades de datos.

| línea | § | frase textual |
|---|---|---|
| `:8` | encabezado | *«Pendiente: especificación detallada de **Sales**, Acquisition, Conversion, Creative, Business, Executive y Team Execution.»* |
| `:90` | § 2.3 | *«**Sales Intelligence** puede recomendar coaching para un closer.»* |
| `:149` | § 3 | `│ Sales Intelligence │` — dentro de la CAPA DE INTELIGENCIA |
| `:181` | § 4 | `├── Sales Intelligence` — cuelga de Executive, **sin submódulos** |
| `:215` | § 5.1 | *«**Sales Call**.»* |
| `:234` | § 5.2 | `→ sales_call_id` |
| `:1110` | § 17 | *«**Sales Intelligence**.»* — secciones pendientes |

**Y dos de las cinco son la misma lista de pendientes** (`:8` y `:1110`).

---

## S11-02 · Cero submódulos

`§ 4:181`. Es una de las tres ramas del organigrama que cuelga vacía, junto con Creative y Business:

```
├── Conversion Intelligence
│   ├── Landing Intelligence
│   └── VSL Intelligence
...
├── Sales Intelligence
│
└── Business Intelligence
```

Acquisition tiene `Meta Ads` (`:169`) y además seis componentes internos en el § 18.3. Conversation
tiene `Lead Flow` y `Appointment Flow` (`:178-179`). **Sales: nada.** No hay un § equivalente al 18.3.

---

## S11-03 · Cero frases en su boca

`§ 18.11:1385-1431` es la sección de casos de uso, con tres casos. Quién habla:

| caso | departamentos que hablan |
|---|---|
| 1 (`:1387`) | Acquisition `:1391`, **Business** `:1395`, Executive `:1399` |
| 2 (`:1401`) | Acquisition `:1405`, **Business** `:1409`, Creative `:1413`, Executive `:1417` |
| 3 (`:1419`) | Acquisition `:1423`, Conversion `:1425`, Executive `:1431` |

**Sales no aparece en ninguno.** Conversion tiene una frase, Creative una, Business dos, Sales cero.

Y la frase que más se le parece —*«El anuncio A tiene baja tasa de cierre y bajo revenue»* (`:1395`)—
**el documento la pone en boca de Business**. Ver `08-LO-QUE-ENTREGA-Y-RECIBE.md`.

---

## S11-04 · Cero KPIs propios

`§ 9` es «Lead Flow», no un catálogo global. Los tres bloques de KPI del documento:

| § | línea | de quién |
|---|---|---|
| 9.3 y 9.7 | `:479`, `:603-624` | **Lead Flow** |
| 10.3 y 10.7 | `:672`, `:749-766` | **Appointment Flow** |
| 18.7 | `:1281-1321` | **Acquisition** |

**Sales no aparece en ninguno.** No existe una sección de KPIs de Sales.

Y los que suenan suyos están asignados a otro:

| línea | KPI | de quién |
|---|---|---|
| `:751`, `:759` | «Show rate», «Show rate **por closer**» | **Appointment Flow** |
| `:1048` | «Show rate» | lo que **Conversation** entrega a Executive |
| `:1618` | «ICP, booking rate, show rate, **close rate** y revenue» | evaluadas por **Business** (`:1635`) |

---

## S11-05 · Las dos entidades, y son las últimas de la cadena

`§ 5.1:215-216`: **`Sales Call`** y **`Sale Report`**.

`§ 5.2:227-236`, la trazabilidad principal:

```
meta_ad_id → visitor_id → session_id → lead_id → ghl_contact_id
           → appointment_id → sales_call_id → sale_report_id
```

**`sales_call_id` (`:234`) y `sale_report_id` (`:235`) son los dos últimos eslabones, y son los dos
únicos que no existen en nuestro esquema con ningún nombre.**

Lo más cercano: `sale_report_id` ≈ `resultados.id`, y `sales_call_id` ≈ `resultados.cita_id` — que es
nulo en las 7 filas (`S1-06`).

---

## S11-06 · El § 5.4, que son 22 líneas y es todo lo que hay

`:267-288`, «Registro actual de ventas». **Es lo más parecido a una especificación que Sales tiene en
todo el documento**, y no describe un departamento: describe un formulario de dos preguntas.

> `:269` — *«En la versión actual, la fuente de verdad comercial es un registro manual del closer.»*
> `:271-274` — *«El closer completa: ¿El cliente compró? / Monto vendido.»*

Campos sugeridos (`:278-286`) y su mapeo con lo que existe:

| el documento pide | lo que existe | cobertura |
|---|---|---|
| `sale_status` | `resultados.salida` | 7 de 7 |
| `sale_amount` | `resultados.monto` | **0 de 7** |
| `sale_currency` | **no existe**, y es deliberado (`024:56-59`) | — |
| `reported_by_closer_id` | `resultados.registrado_por` | 7 de 7 |
| `reported_at` | `resultados.creado_el` | 7 de 7 |
| `opportunity_id` | `resultados.cita_id` | **0 de 7** |
| `sale_source = closer_reported` | implícito: es la única fuente | — |

**Y la advertencia que gobierna el departamento entero**, `:288`:

> *«Business Intelligence podrá utilizar estos datos, pero deberá indicar que se trata de **ventas
> reportadas por el closer y no necesariamente de pagos verificados**.»*

Medido, eso es literalmente cierto: **0 de 5 organizaciones tienen credencial de pagos**, no hay
integración ni tabla de transacciones (`S1-09`). El rótulo no es una precaución: es una descripción.

El `§ 5.3:261-263` agrega tres campos al perfil del lead: *«Asistencia»*, *«Resultado de venta»*,
*«Monto reportado por el closer»*.

---

## S11-07 · Declarado pendiente dos veces, y las dos primero de la lista

`§ 17:1106` «Secciones pendientes»:
> `:1108` — *«Las siguientes áreas tienen visión general, pero todavía requieren especificación
> detallada:»*
> `:1110` — *«**Sales Intelligence**.»*

**Es el primer ítem de los once.** Conversion es el segundo (`:1111`), Creative el tercero (`:1112`).

Y el encabezado del documento lo pone primero también (`:8`). Es el departamento menos especificado de
los cinco, y por bastante.

---

## S11-08 · Y una contradicción del documento contra la producción

`§ 16.1:1072` declara *«Auditoría de llamadas de venta»* entre las capacidades **EXISTENTES**.

**Medido: `negocio.llamadas` tiene 0 filas.** Cero grabaciones, cero transcripciones. La auditoría que
sí existe en el producto cubre Conversation, no Sales.

`§ 16.2:1101` lo corrige a medias: pone como prueba pendiente n.º 7 *«Conectar contacto, cita,
asistencia y venta reportada»* — que es exactamente la cadena de `14-LOS-CINCO-ESLABONES.md`, y
exactamente lo que está roto.

Ver `13-EL-CONTRASTE.md`.

---

## S11-09 · El vocabulario que el documento NO tiene

Comprobado sobre las 1.650 líneas:

| término | apariciones |
|---|---|
| `MRR` | **0** |
| `LTV` | **0** |
| `pipeline` | **0** |
| `forecast` | **0** |
| `deal` | **0** |
| `CAC` | 2, y las dos en negativo y de Acquisition |
| `close rate` | 1, y es de Business |

> **El modelo de venta del documento es de ticket único reportado a mano por el closer, no de
> recurrencia.** Cualquier requisito de MRR, LTV, pipeline o forecast que aparezca en una
> conversación **no sale de este documento**, y hay que decir de dónde sale antes de construirlo.
