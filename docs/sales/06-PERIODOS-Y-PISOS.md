# Las ventanas, la tensión mes/rodante, y el piso

> Requisitos derivados del prototipo de Sales y de una medición propia contra producción del
> **2026-09-20**. Cada requisito lleva su `archivo:línea`.

---

## S6-01 · El vocabulario de ventanas del sistema

`lib/negocio/periodo.ts:83-96` — cuatro, y son las mismas para las cinco pantallas de Inteligencia:

| clave | etiqueta | días | matiz |
|---|---|---|---|
| `hoy` | Hoy | 1 | «Las últimas 24 horas, no el día del calendario.» |
| `7d` | 7 días | 7 | — |
| `30d` | 30 días | 30 | — |
| `completo` | Completo | 3650 | «Todo lo que hay guardado, que puede ser mucho menos de lo que parece.» |

`PERIODO_POR_OMISION = '30d'` (`:109`). `periodoDe()` devuelve `null` para lo que no está en la lista
y quien llama lo convierte en un 400 (`:188-192`).

El módulo **no importa nada**, a propósito (`:30-33`): es isomorfo, así el panel del navegador puede
usarlo sin arrastrar la base al paquete.

## S6-02 · Y el segmentado del prototipo manda una clave que no existe

`SalesView.jsx:29-40` dibuja tres botones: `data-p="hoy"`, `data-p="7d"` y **`data-p="mes"`** (`:37`),
rotulado «30 días».

**`mes` no está en `PERIODOS`.** Si ese botón llegara alguna vez al servidor, `periodoDe('mes')`
devolvería `null` y la petición sería rechazada. Hoy no pasa porque **el segmentado no tiene ningún
oyente**: `slPeriod` no aparece en `lib/` ni una vez. Ver `07-EL-PLAN-DE-ACCION.md`.

---

## S6-03 · La tensión que define la disposición de la pantalla

Sales publica cifras de **dos ventanas distintas**, y no es una diferencia de largo. Difieren en tres
ejes:

| | el cockpit (`inicio.ts:147`) | `PERIODOS` |
|---|---|---|
| ancla | `date_trunc('month', …)` — fija al día 1 | rodante: `now() - N días` |
| reloj | zona de la **organización** | el de la base, sin zona (`periodo.ts:72-82`) |
| largo | **variable**: el día 1 son horas | constante |

**El tercero es el que muerde.** El primero de cada mes, el bloque del dinero mide unas horas mientras
el segmentado de al lado sigue diciendo «30 días». Eso es textualmente el defecto que `periodo.ts:9-17`
existe para cerrar —*«la pantalla dibuja catorce días mientras el botón encendido dice otra cosa»*—
sólo que producido por la disposición en vez de por el parseo.

### El requisito: un bloque, una ventana, escrita en su encabezado

1. **El bloque del dinero va primero, ARRIBA del segmentado.** Si va debajo, la primera cifra grande
   de la pantalla queda visualmente gobernada por un control encendido que dice «7 días», y el rótulo
   del mes compite con él y pierde. Rompe la simetría con las otras cuatro de Inteligencia, y eso se
   declara en el encabezado del panel.
2. **Su rótulo es el nombre del mes que el servidor ya publica** (`inicio.ts:247-249`): «septiembre de
   2026». **Nunca «este mes»**, que no dice en qué zona se cortó ni que la ventana está truncada. Un
   nombre de mes se puede verificar mirándolo.
3. **El segmentado deja de ser control de pantalla** y pasa a ser encabezado del bloque de la cadena,
   con su propio rótulo.
4. **El botón encendido es el que contestó el SERVIDOR**, no el estado local — como
   `PanelDeConversion.jsx:84-85`.

## S6-04 · Y por eso sólo tres campos del cockpit viajan

De los siete que `Cockpit` publica (`inicio.ts:32-72`), Sales dibuja **`cobrado`, `ventas` y
`acuerdos`**. Los otros cuatro quedan fuera, cada uno por un defecto distinto:

| campo | por qué no |
|---|---|
| `conCitaAgendada` | **no es del mes.** Su propio comentario lo dice (`inicio.ts:50-58`): *«una etiqueta no trae fecha»*. Bajo un encabezado que diga «septiembre de 2026», el rótulo lo convierte en mentira |
| `tasaDeAsistencia` | está **cableada a `null`** (`inicio.ts:266-272`), y Sales publica su propia asistencia desde `citas.asistio`. Dos respuestas a la misma pregunta, una permanentemente vacía |
| `noShows` | cuenta contactos con etiqueta `noshow`; la cifra de Sales cuenta **citas** con `estado_ghl = 'noshow'`. Dos poblaciones, dos ventanas, el mismo nombre |
| `tareasPendientes` | no tiene valor honesto acá, y es el **único** campo del cockpit que no es `number \| null` |

---

## S6-05 · El piso, y de qué es

`PISO_DE_UNA_TASA = 10` (`lib/negocio/indicadoresDeCitas.ts:300`).

**Es del DENOMINADOR**, no del total ni de la fila. Sobre esta base eso decide mucho:

| cifra | denominador medido | ¿publica tasa? |
|---|---|---|
| Tasa de cancelación (empresa) | 223 citas pasadas | **sí** |
| Cancelación del closer A | 123 citas | **sí** |
| Cancelación del closer B | 61 citas | **sí** |
| Cancelación del closer C | **9 citas** | **no** — conteos sí, tasa no |
| Tasa de cierre | 7 intentos | **no** |
| Motivos de no venta | 1 resultado | **no** |
| Ciclo hasta la cita | 197 contactos | **sí** |

**Bajo el piso hay conteos, no silencio.** Y la fila no se borra: borrar la fila de una persona es
afirmar que no trabaja acá.

---

## S6-06 · El techo de la ventana: el sesgo que ninguna otra pantalla tiene

El ciclo del alta a la primera cita (`S2-05`) tiene un problema propio de las ventanas rodantes:

**Con el botón de «7 días», la mediana no puede pasar de 7.** Sólo entran los contactos que agendaron
dentro de esos siete días; los que tardaron veinte no están en la cohorte. **Esa ventana produce
siempre un ciclo excelente, y nada falla.**

Medido, la escala del sesgo: la mediana real sobre toda la base es 2,9 días, pero hay **14 contactos
de más de un mes** y uno de **290 días**. Con «7 días» esos catorce desaparecen; con «completo»
(3650 días, `periodo.ts:52`) entran todos.

**Requisito:** la cifra viaja con su `techoDeLaVentana`, y un aviso se enciende cuando el p90 se
acerca al borde. Con «completo» no se enciende nunca, que es lo correcto.

## S6-07 · Y la censura, que es el otro sesgo del ciclo

**389 de 590 contactos nunca tuvieron una cita.** No son ciclo cero ni ciclo infinito: **no entran en
la cifra, y eso se dice**. El precedente es `avisoDeLasLatencias`
(`lib/negocio/indicadoresDelLead.ts:426-450`).

Un `coalesce(primera_cita, now())` los metería como «todavía esperando» y movería la mediana sin que
nada falle.

---

## S6-08 · Los tres módulos reciben LA MISMA ventana

Es la regla 4 del departamento (`docs/estado actual/05-SALES.md:170-173`), con un matiz que esa regla
ya corrige: **catorce días ya no es la ventana del sistema**. `DIAS_DE_LA_TASA = 14`
(`indicadoresDeCitas.ts:310`) es hoy sólo el argumento por omisión de `tasaDeCancelacion` para quien
no pide ventana. Sales sí pide.

**Defecto que evita:** que un módulo se quede con su valor por omisión mientras los otros dos usan el
período elegido. La pantalla mostraría tres cifras de tres ventanas con un solo botón encendido.
