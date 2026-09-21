# Sales — mapa de los requisitos

> Requisitos derivados del prototipo de Sales, de la especificación funcional, y —como en Creative y
> Conversion— de una **medición propia contra producción** hecha el 2026-09-20. Cada requisito lleva
> el `archivo:línea` del que sale. Lo que no se pudo rastrear está dicho como pregunta abierta, no
> como requisito.
> El estado de cada dato sale de `docs/estado actual/05-SALES.md`, medido el 2026-09-16, más las
> mediciones nuevas de `01-LA-VENTA-NO-EXISTE.md` y `14-LOS-CINCO-ESLABONES.md`.

---

## El estado, en una línea

**Construida el 2026-09-21. Con ésta, las cinco pantallas de Inteligencia dejan de ser maquetas — y
Sales es la única de las cuatro reescrituras donde lo que falta no era la pantalla: es que alguien
registre.**

| qué | dónde |
|---|---|
| La ruta | `app/api/sales/route.ts` |
| La cadena, el ciclo y la tabla por closer | `lib/negocio/cadenaDeCierre.ts`, `cicloHastaLaCita.ts`, `cierrePorCloser.ts` |
| Los predicados compartidos de cita | `lib/negocio/citasAlcanzables.ts` |
| El dinero del mes, consumido | `lib/negocio/dineroDelMes.ts` |
| Las tres ventanas y los huecos declarados | `lib/negocio/ventanasDeSales.ts`, `huecosDeSales.ts` |
| El lector del navegador y el panel | `lib/negocio/vistaDeSales.ts`, `components/sales/PanelDeSales.jsx` |

**Y dos cifras de esta carpeta se corrigieron al construirla**, las dos por el mismo motivo —sondas
escritas con un filtro apenas distinto del que el código acabó usando—: la brecha de cancelación
entre closers (`04 § S4-05`) y la afirmación de que no había ninguna señal de asistencia (`03`).
Están reescritas con el error anterior citado, porque esconderlo sería repetirlo.

---

## 0 · Las dos fuentes, y qué aporta cada una

Esta carpeta se armó de dos sitios y de ningún otro.

| fuente | qué aportó | dónde está documentado |
|---|---|---|
| **El documento funcional** — `CC_Arquitectura_Funcional.md`, 1.650 líneas | 7 líneas que nombran a Sales, 2 entidades, la traza del § 5.2, y el § 5.4 con los únicos campos concretos | `11-LO-QUE-PIDE-EL-DOCUMENTO.md` |
| **La pantalla hardcodeada** — `components/views/SalesView.jsx`, 231 líneas, **borrada el 2026-09-21** | 3 bloques visuales, 23 valores inventados, 28 frases escritas a mano, 3 controles muertos | `03`, `04`, `05`, `07`, `10` |

Y una tercera cosa que no es fuente de requisitos sino **el árbitro entre las dos**: la medición
contra producción. Cuando el prototipo y el documento se contradicen —y se contradicen— gana lo que
la base puede sostener. Eso vive en `01`, `09` y `14`.

> **El documento no vive en el repositorio.** Está en `C:\Users\USUARIO\Downloads\`. Las citas
> `:NNN` de esta carpeta son a ese archivo, verificadas contra `wc -l` = 1.650.

---

## 1 · Los quince archivos

| archivo | qué contesta |
|---|---|
| `00-MAPA.md` | éste: el índice, las dos fuentes, y la distinción requisito/andamiaje |
| **`01-LA-VENTA-NO-EXISTE.md`** | **el que hay que leer si se lee uno solo.** La maquinaria está entera y nadie la usó |
| `02-METRICAS.md` | el catálogo de métricas, con la ficha de seis campos |
| `03-LOS-CUATRO-KPI.md` | las cuatro tarjetas de arriba (74 · 24 % · 18 · $55.200) y cuál tiene fuente |
| `04-LA-TABLA-DE-CLOSERS.md` | las dos filas, el nombre real, las seis columnas, y qué es medible por persona |
| `05-LOS-MOTIVOS-DE-NO-VENTA.md` | la taxonomía inventada contra el catálogo real, y la mezcla de dos salidas |
| `06-PERIODOS-Y-PISOS.md` | las cuatro ventanas, la tensión mes/rodante, y el piso sobre el denominador |
| `07-EL-PLAN-DE-ACCION.md` | el botón muerto: cero frases detrás, ni las 12 de Creative ni las 47 de Conversion |
| `08-LO-QUE-ENTREGA-Y-RECIBE.md` | el deslinde: Sales genera el hecho, Business lo interpreta, Closer es dueño del dinero |
| `09-DE-DONDE-VIENE-CADA-DATO.md` | tabla de origen y cobertura, con la consulta de cada medición |
| `10-LO-QUE-NO-ES-UN-REQUISITO.md` | los 23 literales, la persona real, los tres controles muertos, y la lista de borrado |
| `11-LO-QUE-PIDE-EL-DOCUMENTO.md` | las 7 menciones, el § 5.4, las dos entidades y el § 17 |
| `12-QUIEN-VE-QUE.md` | el documento no nombra un dueño de Sales, y sí nombra un «Responsable de Ventas» |
| `13-EL-CONTRASTE.md` | el prototipo contra el documento contra lo medible hoy |
| **`14-LOS-CINCO-ESLABONES.md`** | la cadena medida y dónde se corta cada eslabón |

---

## 2 · Cómo se citan los requisitos

**El prefijo de este departamento es `S`.** Comprobado libre el 2026-09-20: `A` es Acquisition, `C`
Creative, `CV` Conversion, y `grep -rohE '\bS[0-9]{1,2}-[0-9]{2}\b' docs/` no devolvía nada.

El identificador es `S<archivo>-<nn>`, y **el número del medio es el archivo donde vive la ficha**, no
una sección abstracta: `S2-01` vive en `02-METRICAS.md`, `S14-03` en `14-LOS-CINCO-ESLABONES.md`. Los
identificadores son estables y se citan entre archivos.

Las preguntas abiertas van como `### S<archivo>-P01 · …`, **en el sitio donde nacen** y no en un
archivo aparte. Una pregunta lejos de su contexto se contesta mal.

### La convención de las citas, y por qué importa acá más que en las otras dos

`components/views/SalesView.jsx` **pasó de 231 líneas a 83** el 2026-09-21. Sus citas quedaron de
dos clases, y la segunda es la peligrosa:

- las que apuntaban más allá de la línea 83 **fallaron al resolverse, y se vieron**: trece, y las
  encontró `pruebas/codigo/101-las-citas-de-los-documentos.test.ts` en su primera ocasión real;
- las que apuntan más acá **siguen resolviendo y muestran otra cosa**, que es peor, y **eso ninguna
  prueba lo ve**.

Por eso las trece se reapuntaron al ENCABEZADO del archivo nuevo, que enumera cada pieza borrada con
la medición que la desmiente, en vez de a un número de línea del marcado que ya no existe. Y cada
documento afectado lleva una nota que lo dice, porque «`SalesView.jsx:14-18` dibuja cuatro tarjetas»
era cierto ayer y hoy sería falso.

Cuando eso pase, esta carpeta lleva la nota de cabecera que ya llevan `docs/creative/` y
`docs/conversion/`. Hoy todavía no: **al 2026-09-20 el archivo sigue entero y sus citas son exactas.**

---

## 3 · Requisito y andamiaje: la distinción que ordena la carpeta

La misma de las dos carpetas anteriores, y acá es la que hace casi todo el trabajo — porque el
prototipo de Sales es **aritméticamente coherente** y por eso pasa cualquier lectura de plausibilidad.

- **Un requisito** es una pregunta que el departamento tiene que poder contestar. Sobrevive al
  borrado de la maqueta. *«Cuántas de las citas que ocurrieron terminaron en algo registrado»* es un
  requisito.
- **El andamiaje** es la forma concreta en que la maqueta finge contestarla. `$55.200` es andamiaje.
  Y también lo es la *forma* de algunos bloques: ver `05`, donde la taxonomía de cuatro motivos es
  andamiaje **en sus valores y en su vocabulario**.

Lo que se borra es el andamiaje. Lo que se posterga es el requisito sin fuente, y se posterga **por
escrito y con su medición**, que es lo que convierte un hueco en un hueco declarado en vez de una
regresión. Ver `10`.

---

## 4 · Lo que se puede construir hoy

- **La cadena de cierre** — `S14-01`. Cuatro eslabones con el contacto como unidad: 590 contactos →
  201 con cita alcanzable → los que confirmaron → los que tienen un intento registrado. Ninguna venta.
- **La tasa de cancelación** — `S2-04`. **59,2 % medido**, y es la única cifra del embudo comercial
  medible de punta a punta hoy. **No se recalcula**: `lib/negocio/indicadoresDeCitas.ts:312` ya la
  publica y Sales sería su segundo consumidor.
- **El ciclo del alta a la primera cita** — `S2-05`. **Mediana 2,9 días** contra media 16,5: la media
  está arrastrada por una cola de 14 contactos que llega a 290 días.
- **El reparto por closer** — `S4-05`. Es la única comparación entre closers con señal, y su tamaño
  real es más chico de lo que decía la primera medición: **14 puntos de cancelación sobre todo el
  pasado y 5 en la ventana de 14 días** que la pantalla dibuja por omisión.
- **El dinero del mes** — `S2-01`. **Consumido**, no recalculado: `lib/negocio/inicio.ts` es su dueño.

## 5 · Lo que NO se puede, y se dibuja como hueco declarado

| hueco | medición | ficha |
|---|---|---|
| **La venta misma** | 7 filas en toda la base, **cero** `venta`, cero montos | `S1-01` |
| **La asistencia** | `citas.asistio` **nulo en las 327 filas**; lo único que hay son **15 plantones del calendario** | `S1-07` |
| **El motivo de no venta** | 1 sola fila, y con el valor «Otro» | `S5-04` |
| **El vínculo resultado ↔ cita** | `cita_id` nulo en las 7 | `S1-06` |
| **El cobro verificado** | 0 de 5 organizaciones con credencial de pagos | `S1-09` |
| **El valor del trato** | los campos de dinero del CRM, en **0 de 590** contactos | `S1-10` |

> **El último es el más peligroso de los seis, porque el dato existe y tienta.** «Ticket promedio
> mensual por cliente» está en 209 contactos y «Meta de facturación 6 meses» en 216 — pero son lo que
> **el prospecto dice que factura**, no lo que le vendimos. Publicarlos como valor de la venta da un
> revenue plausible y completamente falso. Ver `S1-10` y `S9-08`.

---

## 6 · Las preguntas abiertas de todo el departamento

Viven en el archivo donde nacen. El índice:

| id | pregunta | dónde |
|---|---|---|
| `S1-P01` | ¿Por qué 5 de los 7 resultados se guardaron sin enganchar la cita que tenían disponible? | `01` |
| `S1-P02` | ¿Por qué `citas.asistio` está vacío en las 327 si el calendario marca 15 plantones? **Apareció al construir la pantalla** | `01` |
| `S4-P01` | ¿Los 5 puntos de cancelación entre los dos closers son del closer o de la fuente de sus leads? | `04` |
| `S5-P01` | ¿El CRM guarda motivos de pérdida en algún campo que no sea `resultados.detalle`? | `05` |
| `S8-P01` | ¿Business va a existir como pantalla? El documento le da revenue, CAC, ROAS y la tasa de cierre | `08` |
| `S12-P01` | ¿Quién es el dueño de Sales? El documento nombra un «Responsable de Ventas» y nunca más | `12` |
| `S13-P01` | ¿La contradicción entre las dos maquetas (18 ventas contra 11) fue un descuido o dos épocas? | `13` |
