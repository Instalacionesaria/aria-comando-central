# Las 47 frases, las once fricciones y cuáles tienen fuente

> Requisitos derivados del prototipo de Conversion, de la especificación funcional, y de una
> **medición propia contra producción** hecha el 2026-09-20. Cada requisito lleva el `archivo:línea`
> del que sale. El estado de cada dato sale de `docs/estado actual/03-CONVERSION.md`, medido el
> 2026-09-15, más las mediciones nuevas de `14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md`.

---

## 1 · El censo

### CV6-01 · Cuarenta y siete frases escritas a mano, y cero tienen fuente

**Rastro** · Contadas en `lib/aios/conversion.js`:

| conjunto | cantidad | línea |
|---|---|---|
| `FRICTIONS` — títulos | 11 | `:45-79` |
| `FRICTIONS` — descripciones | 11 | `:45-79` |
| `WINS` — títulos | 4 | `:88-97` |
| `WINS` — descripciones | 4 | `:88-97` |
| `ACTIONS` — recomendaciones | 6 | `:100-107` |
| `Lectura:` — diagnósticos | 6 | `:413`, `:459`, `:478`, `:502`, `:519`, `:548` |
| `El patrón detrás` | 2 | `:610-611` |
| `MINOR` — inertes | 3 | `:82-86` |
| **total** | **47** | |

**Estado** · **Ninguna sale de un cálculo.** Y las descripciones traen además trece cifras
presentadas como hechos —`31% de los envíos falla`, `la retención cae de 82% a 56% en nueve
segundos`, `El video pesa 2.4 MB`, `El 34% elige ese bloque`— que tampoco se calculan.

Es el mismo censo que Creative hizo con sus 201 literales y sus 30 frases, sólo que más grande.

---

## 2 · Lo que sobrevive del plan de acción

### CV6-02 · Ordenar las fugas por cuánta gente cuestan

**Rastro** · `conversion.js:307` define `SEV = {critica:0, alta:1, media:2}` y `:314` ordena por
severidad y luego por `loss` descendente.
**Estado** · **Requisito, y es la decisión correcta.** Ordenar por severidad declarada sola dejaría
arriba lo que alguien rotuló como grave; ordenar por personas perdidas deja arriba lo que cuesta
dinero. La combinación de las dos es lo que el `§ 2.3:79-92` del documento pide de una recomendación
local.

### CV6-03 · Sólo las tres primeras entran al plan

**Rastro** · `rank.slice(0,3)` (`conversion.js:582`, `:599`), bajo el rótulo `Qué hacer primero`.
**Estado** · **Requisito.** Un plan de doce acciones no es un plan. Tres es una decisión de producto
defendible y se conserva; lo que hay que declarar es el criterio de corte, que hoy está implícito en
un `slice`.

### CV6-04 · El bloque «No tocar»

**Rastro** · `conversion.js:614-617`, las cuatro `WINS` completas.
**Estado** · **Requisito, y poco común.** Una pantalla que sólo enumera problemas empuja a cambiar lo
que funciona. Decir explícitamente qué no tocar es la otra mitad de una recomendación, y el
`§ 18.11:1401-1417` del documento trae el caso exacto: *«El CTR del anuncio B cayó 22 %… El anuncio B
sigue liderando en revenue… Mantenerlo activo.»*

### CV6-05 · Cada fricción declara a quién le toca

**Rastro** · El campo `to` de `FRICTIONS`, pintado como `«lo resuelve {área}»` en la alarma (`:328`),
en las observaciones (`:385`) y en el plan (`:603`).
**Estado** · **Requisito, y es el `§ 7.2:393-405`**: cada tarea tiene responsable. Los destinatarios
que la maqueta usa —`Creative`, `Sales`, `Conversation`, `Acquisition`— son **departamentos reales**
del `§ 4`, así que el vocabulario es correcto.

**Lo que no se hereda**: uno de los cuatro destinatarios no es un departamento sino una persona —ver
`CV6-08`.

---

## 3 · Los umbrales inventados del plan

### CV6-06 · Se asume que cada arreglo recupera el 45 %

**Rastro** · `const recover = x => Math.round(x.loss*0.45);` (`conversion.js:581`).
**Estado** · **Sin justificación, sin comentario y sin fuente.** Ese 45 % alimenta la cabecera del
modal —`Si haces las tres · +N citas recuperables`— y el salto de conversión —`X% a Y%` (`:589-595`)—,
o sea **las dos cifras más prominentes del plan de acción salen de un número inventado**.

Y el cálculo de `convNew` mete las citas «recuperadas» en el numerador de `agenda/sesiones` (`:584`),
que afirma que una fuga arreglada se convierte en cita con probabilidad uno.

**Lo que sobrevive**: estimar el impacto de una acción antes de hacerla es el `§ 14:1003-1018`
—«Hipótesis», «Métrica principal», «Línea base»—. Lo que no sobrevive es estimarlo con un
coeficiente que nadie midió. **O se calibra y se declara, o se publica la pérdida sin la
recuperación.**

### CV6-07 · «El patrón detrás» trae dos cifras que no recalculan

**Rastro** · `conversion.js:610-611`. La segunda dice: *«La conversión en escritorio es **42%** y en
móvil **19%**.»*
**Estado** · Los dos números son literales. Coinciden por casualidad con lo que daría `CV.desktop` y
`CV.mobile`, pero **no se calculan**: si alguien cambiara `CV`, la frase seguiría diciendo 42 y 19.

**Lo que sobrevive**: buscar el patrón común detrás de varias fugas —*«no son problemas distintos: es
un layout que no se diseñó para pantalla vertical»*— es la parte más valiosa de una recomendación y
la única que un humano no saca de una tabla. Es exactamente lo que el `§ 2.2:67-77` pide de un
departamento. Pero una afirmación así **necesita su evidencia al lado**, y hoy no la tiene.

---

## 4 · Lo que hay que borrar

### CV6-08 · Hay un nombre de persona en pantalla, culpado de tres fallas que no existen

**Rastro** · `Kevin · técnico` aparece en `conversion.js:48`, `:69` y `:75`, como responsable de tres
fricciones. Se renderiza literalmente: `«lo resuelve Kevin · técnico»` en el bloque de alarma
(`:328`), en las observaciones (`:385`) y en el plan de acción (`:603`).

**Estado** · Las tres fricciones son inventadas —*«El formulario devuelve error en Safari móvil»*,
*«La página tarda 4.1s en cargar en móvil»*, *«12% reintenta el envío»*— así que la pantalla **le
atribuye a una persona con nombre tres problemas que no ocurrieron**.

`lib/aios/index.js:16-22` deja constancia de que `initCloser` y `initCloserContact` se borraron en la
Etapa 11 por *«pintar datos escritos a mano —nombres de personas, montos, un diagnóstico atribuido a
la IA— y estuvieron en producción mostrándolos»*. **Es el mismo defecto, todavía en producción.**

### CV6-09 · Las siete puertas al panel de las catorce personas inventadas

**Rastro** · Las siete cifras de la tira de KPI llevan `data-leads` (`conversion.js:173`, valores en
`:183`, `:186`, `:196`, `:199`, `:208`, `:210`, `:212`). Un oyente global las captura
(`lib/aios/leads-group.js:79-85`) y abre un panel con `POOL` (`:14-29`): **catorce nombres completos
de personas y empresas**, con puntaje ICP, campaña, estado comercial y **montos en dólares**
—`$4,500`, `$9,600`, `$6,000`—.

**Estado** · Clicar `Visitas` abre un panel titulado *«Visitas a la landing»* con `2.944 contactos` y
una lista de nombres inventados. Es el mismo panel que Creative tenía y del que se le quitaron las
dieciocho puertas. **Conversion todavía tiene siete.**

### CV6-10 · Las constantes que no se leen nunca

Todas en `lib/aios/conversion.js`, y **con el archivo escrito en cada una**: una cita corta hereda
su archivo de la anterior, y acá la anterior es de otro módulo.

| constante | dónde | qué pasa |
|---|---|---|
| `MINOR` | `conversion.js:82-86` | tres hallazgos con el comentario *«por debajo del umbral de impacto: no se muestran, se cuentan»* (`conversion.js:81`): **ni se muestran ni se cuentan** |
| `SEVLBL` | `conversion.js:302` | nunca referenciada |
| `TINT` | `conversion.js:301` | nunca referenciada |
| `SCROLL` | `conversion.js:131-134` | duplica `ZONES`, no se usa |
| `STEPS[].n` y `STEPS[].src` | `conversion.js:36-42` | la plantilla no los lee y el CSS esconde el nodo |
| `FRICTIONS[].ic` / `.color` / `.state`, `WINS[].ic` / `.color` | `conversion.js:45-79` y `:88-97` | campos muertos: la alarma escribe `⛔` a mano (`conversion.js:326`) y las observaciones colorean por severidad vía CSS |

---

## Preguntas abiertas

### CV6-P01 · ¿Una fricción es una entidad persistida?

El prototipo las trata como una lista fija con antigüedad (`detectado hace 3 h`, `hace 6 días`) y
estado (`nuevo` / `visto`), o sea como **registros con ciclo de vida**. Eso implica una tabla: quién
la detectó, cuándo, quién la vio, cuándo se cerró, y si volvió. El `§ 18.13:1464-1481` define el
esquema de una alerta con catorce campos para Acquisition, y **Conversion no tiene su equivalente**.
Sin persistencia, «detectada hace 3 h» no se puede calcular y el estado `visto` no existe.

Es el mismo hueco que Creative dejó abierto con «Solicitudes de nuevas variantes»
(`docs/creative/12-QUIEN-VE-QUE.md:70`).
