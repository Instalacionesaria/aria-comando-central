# La tabla de closers, y la persona real que está adentro

> Requisitos derivados del prototipo de Sales y de una medición propia contra producción del
> **2026-09-20**. Cada requisito lleva su `archivo:línea`.

`components/views/SalesView.jsx:95-171` dibuja una tarjeta «Closers» con seis columnas y **dos filas**.

| | Closer | Agendadas | Asistieron | Ventas | Cierre | Revenue |
|---|---|---|---|---|---|---|
| 1 | **Jorge Veramendi** — «ICP alto asignado» | `44` | `31` | `10` | `32%` | `$31,000` |
| 2 | **Asesor comercial** — «ICP medio y bajo» | `63` | `43` | `8` | `19%` | `$24,200` |

Líneas: `:123`, `:130`, `:133`, `:136`, `:139`, `:142` la primera; `:148`, `:155`, `:158`, `:161`,
`:164`, `:167` la segunda.

---

## S4-01 · Hay una persona real ahí, y es lo primero que hay que decir

**«Jorge Veramendi» es un nombre real**, y es el único de los tres prototipos de Inteligencia que
pone una persona identificable al lado de cifras. Creative tenía 18 puertas a un panel de catorce
personas inventadas y Conversion 7; **Sales no tiene ninguna puerta**, pero tiene esto, que es peor
en una dimensión concreta.

`docs/estado actual/05-SALES.md:204` lo nombra sin rodeos: *«Poner una persona real al lado de un
número inventado […] el daño no es un número mal calculado: es una evaluación de desempeño»*. Y esa
persona **tiene acceso a la pantalla**.

> **Consecuencia para la reescritura:** los nombres de las filas salen de
> `lib/negocio/alcanceDelCloser.ts :: closersDeLaEmpresa()`, o sea de la base, o no salen. Y la prueba
> de que la maqueta no vuelve es un barrido del archivo: **`SalesView.jsx` no puede contener ningún
> nombre propio ni ninguna cifra**.

---

## S4-02 · Las dos filas no son dos closers: son un closer y un rótulo

La segunda fila dice **«Asesor comercial»**, que no es un nombre sino un cargo. Y sus subtítulos
—«ICP alto asignado» y «ICP medio y bajo»— afirman **una regla de asignación por tramo de ICP**.

**Esa regla no existe en ninguna parte.** No hay tabla, ni columna, ni constante que la exprese; lo
comprueba `docs/estado actual/05-SALES.md:151`. El ICP vive en `campos_del_crm` y la asignación en
`contactos.crm_asignado_a`, y **nada las relaciona**.

Es andamiaje en su forma, no sólo en sus valores: la tabla no tiene dos filas por diseño, tiene dos
porque alguien dibujó dos.

---

## S4-03 · Cuántos closers hay de verdad

Medido: **4 asignatarios distintos** en `contactos.crm_asignado_a`, y 250 de 590 contactos asignados.

| asignatario | contactos | con al menos una cita |
|---|---|---|
| A | **213** | 121 |
| B | 26 | 25 |
| C | 10 | 10 |
| D | 1 | 0 |

Y `negocio.closer_asignado` tiene **3 filas** para esta organización — el tope es
`TOPE_DE_CLOSERS = 3` (`lib/negocio/closer.ts:232`). O sea que hay un cuarto asignatario en el CRM
que no está configurado como closer acá.

---

## S4-04 · Las filas salen del catálogo, no de un `group by`

**Requisito.** Las filas se construyen desde `closersDeLaEmpresa()`
(`lib/negocio/alcanceDelCloser.ts:77`), no agrupando lo que haya en las tablas.

**El defecto que evita:** un `group by` sólo devuelve a quien tiene filas. **El closer sin actividad
desaparece de la tabla**, y su ausencia se lee como «no está configurado» en vez de «no registró
nada». Son dos hechos opuestos y la tabla no distingue cuál está mostrando.

Y el orden es el de esa función —designación, desempate por id (`:85-86`)—, que ya es estable.

---

## S4-05 · El hallazgo: 69,1 % contra 42,6 %

Medido sobre las 226 citas alcanzables, agrupadas por asignatario:

| asignatario | citas | canceladas | confirmadas | no-show | cancelación |
|---|---|---|---|---|---|
| A | 123 | 85 | 24 | 14 | **69,1 %** |
| B | 61 | 26 | 35 | 0 | **42,6 %** |
| *sin asignar* | 33 | 16 | 17 | 0 | 48,5 % |
| C | **9** | 5 | 3 | 1 | — **bajo el piso** |

**Veintiséis puntos de diferencia entre dos personas que superan el piso de 10.** Y es la única cifra
comparable entre closers que hoy tiene señal, sin una sola venta registrada.

Ésa es, literalmente, la única competencia que el documento le atribuye al departamento:
*«Sales Intelligence puede recomendar coaching para un closer»* (`§ 2.3:90`).

### S4-P01 · ¿Esa diferencia es del closer o de sus leads? — **abierta**

**Por qué importa:** los dos closers no reciben el mismo tráfico. A tiene 213 contactos y B tiene 26;
si A se lleva los leads de una fuente que cancela más, el 69,1 % mide la fuente y no a la persona — y
la pantalla estaría sugiriendo coaching sobre una diferencia que no le pertenece.

**Cómo se contesta:** cruzando el asignatario con `contactos.atribucion_ultima`, que es la llave de
Conversion (`lib/negocio/recorrido.ts`). Es trabajo aparte y **no se hace en esta etapa**.

**Mientras tanto:** la tabla publica la **concentración** —medido, A se lleva el 85 % de lo asignado—
al lado, para que la comparación llegue con su advertencia puesta.

---

## S4-06 · Los dos ejes van en el tipo, no en un comentario

Este departamento tiene **dos identificadores de persona** y no son intercambiables:

| eje | columna | qué cifras corta |
|---|---|---|
| **el del CRM** | `contactos.crm_asignado_a`, `citas.crm_asignado_a` | contactos y citas |
| **el nuestro** | `resultados.registrado_por` → `identidad.usuarios.id` | intentos y dinero |

El puente es `negocio.closer_asignado.crm_usuario_id`. `lib/negocio/inicio.ts:218-220` ya advierte qué
pasa si se cruzan: *«cruzarlos daría los contactos de quien registró»*.

**Requisito:** un closer designado **sin vínculo** al CRM tiene las cifras del eje CRM en **`null`**,
nunca en `0`. No es que tenga cero citas: es que no hay eje para buscárselas.

---

## S4-07 · El piso es de la fila, no de la tabla — y no borra filas

`PISO_DE_UNA_TASA = 10` se aplica **al denominador de cada fila**. El asignatario con 9 citas
**tiene fila y tiene conteos**; lo que tiene en `null` son sus tasas.

**El defecto que evita:** aplicar el piso a la fila la borraría, y borrar la fila de una persona es
afirmar que no trabaja acá.

---

## S4-08 · Sin ranking, sin columnas ordenables, sin total

Tres prohibiciones, cada una con su defecto:

1. **Sin orden por tasa.** Con 213 / 26 / 10 / 1, cualquier orden por tasa pone primero al que tiene
   una observación apenas la tenga.
2. **Sin columnas ordenables.** Lo mismo, a un clic de distancia.
3. **Sin fila de total.** 340 de 590 contactos **no son de nadie**. Un pie que sume las filas
   afirmaría que la empresa son sus closers. El total de la empresa lo dan la cadena y el bloque del
   dinero, cada uno con su denominador dicho.

---

## S4-09 · Y el dinero no baja a esta tabla

Las columnas «Ventas» y «Revenue» del prototipo **no vuelven acá**, ni siquiera cuando haya ventas.

**El defecto que evita:** pondrían en la misma **fila** una columna del mes calendario —que es la
ventana del cockpit, `inicio.ts:147`— junto a columnas de la ventana rodante que elige el segmentado.
Dos ventanas en una pantalla ya cuestan explicación; **dos ventanas en una fila son peores, porque
una fila se lee como una unidad**.

El día que haya volumen, el desglose de dinero por persona entra **dentro del bloque del mes** y con
su rótulo. Ver `06-PERIODOS-Y-PISOS.md`.
