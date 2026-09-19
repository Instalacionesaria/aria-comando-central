# El deslinde: qué calcula Creative y qué consume

> Requisitos derivados del § 18.16 y del § 18.3 del documento funcional, de la regla 10 de
> `docs/estado actual/02-CREATIVE.md`, y de la medición del 2026-09-18 que obligó a replantear el
> criterio de corte.
>
> Este documento existe porque **el documento funcional se contradice sobre si Creative es un
> departamento o una pestaña de Acquisition**, y porque resolverlo por omisión —dejando que el código
> decida— es cómo el producto ya se ganó sus peores defectos.

---

## 1 · La contradicción, y por qué hay que resolverla por escrito

### C7-01 · El documento dice las dos cosas

**Creative es un departamento propio**, cinco veces:

- § 3 lo lista en la capa de inteligencia, junto a Acquisition, Conversion, Conversation, Sales y
  Business.
- § 4 lo cuelga de Executive Intelligence en el organigrama.
- § 5.1 le da una entidad principal propia: **`Creative Profile`**.
- § 17 lo enumera entre las áreas «que todavía requieren especificación detallada».
- § 2.3 le da un derecho propio: *«Creative Intelligence puede recomendar crear variantes de un
  anuncio.»*

**Y Creative es un componente de Acquisition**, dos veces:

- § 18.3 pone el `Creative Performance Analyzer` **dentro** de la estructura interna de Acquisition
  Intelligence, como uno de sus seis componentes.
- § 18.12 lo especifica ahí, con sus nueve indicadores.

**Estado** · Las dos lecturas son textuales. El § 18.12 cierra con la línea que las reconcilia:

> **«No reemplaza a Creative Intelligence, que interpreta hook, body, CTA, guion y nuevas variantes.»**

O sea: **medir cómo se comportó la pieza en la subasta es de Acquisition; interpretar por qué es de
Creative.** Un creativo con buena retención y bajo CTR es un hallazgo del primero; qué tiene el hook
que retiene y el copy que no convierte, del segundo.

### C7-02 · El corte por FUENTE del dato ya no se sostiene, y hay que decirlo

**Qué es** · `docs/estado actual/02-CREATIVE.md` § 7 riesgo 7 propuso el criterio: *«Acquisition
publica lo que dice Meta, Creative publica lo que dice el lead que llegó por cada pieza y lo que dice
la pieza misma.»*
**Estado** · **Ese criterio era correcto en su intención y se escribió cuando el lado de Meta no
existía.** La medición del 2026-09-18 lo rompe: el hook rate, el link CTR y la landing page view rate
salen **del mismo endpoint** que ya alimenta a `costoDelAnuncio`, por anuncio y por día. No hay dos
fuentes: hay una.

Pero fijarse en qué estaba protegiendo. La regla 10 cierra con: *«Si Creative recalcula alguno, dos
pantallas del mismo producto van a mostrar dos números distintos para lo mismo.»* **El daño temido no
es la repetición: es el recálculo.**

### C7-03 · El criterio que sí se sostiene es el GRANO

**Fórmula** ·

| | Acquisition | Creative |
|---|---|---|
| Unidad | el anuncio (`meta_anuncio_id`) | la pieza (el nombre normalizado) |
| Pregunta | ¿qué costó cada anuncio? | ¿qué pieza hay que volver a producir? |
| Además | el monitor de atribución del § 18.14 | ICP y agenda por pieza, y la cobertura del puente |

**Estado** · Con el corte por fuente, la pregunta «¿puede Creative mostrar el gasto?» se contesta
«no, es de Acquisition» — y entonces la pantalla de Creative es un ranking de ICP sin dinero al lado,
que no sirve para decidir nada. Con el corte por grano se contesta **«sí, si lo produce la misma
función»**, y no existe la posibilidad de que divergan.

La regla que gobierna esto no es la del § 18.16: es la **regla 12** de
`docs/estado actual/07-REGLAS-TRANSVERSALES.md` — *«Un solo predicado por concepto.»*

### C7-04 · El precedente ya está tomado en esta dirección

**Rastro** · `lib/negocio/atribucionDelLead.ts:74-89` decidió **no** agregar un corte por anuncio en
Conversation, y escribió por qué: *«ya existe, y duplicarlo los haría discrepar.
`lib/negocio/costoDelAnuncio.ts` entrega leads y agendamientos por anuncio… Usa EL MISMO `exists` con
`ghl_calendario_id` que este archivo, que es lo que hace que las dos pantallas sumen igual.»*
**Estado** · No prohibió que Conversation hablara de anuncios por doctrina departamental: prohibió que
**escribiera un segundo corte**, y señaló al módulo que ya lo tenía. Es exactamente lo que hay que
hacer acá, con un grano más.

### C7-05 · En este repositorio no hay «código de Acquisition»

**Qué es** · `lib/negocio/costoDelAnuncio.ts` no vive en una carpeta de Acquisition: vive en
`lib/negocio/`, se llama por lo que contesta, y `app/api/acquisition/route.ts` lo importa en cuatro
líneas.
**Estado** · El § 18.3 es un organigrama, y **un organigrama no decide dónde vive un archivo** en un
repositorio cuya unidad de organización es el predicado. Así que el § 18.3 y el § 18.16 se traducen
sin contradicción: el analizador es un módulo de `lib/negocio/`, y «Acquisition **entrega** a Creative
rendimiento por anuncio, retención, CTR, fatiga, frecuencia» es **un `import`**.

---

## 2 · Lo que Creative RECIBE, y no recalcula

### C7-06 · El contrato del § 18.16, renglón por renglón

El § 18.16 dice que Acquisition entrega a Creative Intelligence: *«Rendimiento por anuncio.
Retención. CTR. Fatiga. Frecuencia. Formato. Placement. Tendencia histórica.»*

| lo que el § 18.16 entrega | estado real |
|---|---|
| Rendimiento por anuncio | **llega**: `costoDelAnuncio(dias)` ya lo calcula, y Creative lo agrupa |
| CTR | **llega**, en la misma respuesta |
| Retención | **no existe** (`C14-05`) |
| Fatiga | **se puede construir por caída de CTR** (`C2-24`), no por frecuencia (`C2-25`) |
| Frecuencia | **no se agrega** (`C2-05`). Existe por día y por anuncio |
| Formato | **no existe** (`C14-07`) |
| Placement | **no existe** (`C14-06`) |
| Tendencia histórica | **existe desde el 2026-08-18**, y hay que decirlo (`C5-10`) |

**Cuatro de las ocho no se pueden entregar**, y tres de esas cuatro son las que la vista del
responsable creativo necesita (`12-QUIEN-VE-QUE.md`).

### C7-07 · El gasto se consume por la misma función, no por una segunda consulta

**Rastro** · Regla 10 de `02-CREATIVE.md`; regla 12 de `07-REGLAS-TRANSVERSALES.md`.
**Estado** · **Y hay un modo de fallo concreto si se ignora**, con su factura ya pagada por el
repositorio: la divergencia no aparece primero en una tasa, aparece en el **denominador** —qué días
cuentan como entrega, si el piso aplica, si el alcance se suma— y las dos pantallas muestran **gastos
distintos para la misma ventana** sin que ninguna falle. Es el defecto del `not like 'cancel%'` contra
`ESTADOS_CANCELADOS`, otra vez.

---

## 3 · Lo que Creative NO calcula, y de quién es

### C7-08 · La regla 10, hecha lista

| cifra | de quién es | por qué |
|---|---|---|
| Gasto, CPM, CPC, CTR, frecuencia **por anuncio** | **Acquisition** | § 18.16. Creative los consume al grano de la pieza |
| El monitor de atribución del § 18.14 | **Acquisition** | ya está construido en `lib/negocio/calidadDeLaAtribucion.ts` |
| La retención del VSL de la landing | **Conversion** | `docs/estado actual/03-CONVERSION.md:248`: *«Creative mide retención del ANUNCIO, Conversion mide la del VSL. Son dos videos.»* Y el medidor está roto: cinco campos en 0 de 233 |
| El video precall | **Conversation** | es el § 10.6: el video que se manda **después** de agendar |
| La calificación del lead como etiqueta binaria | **Business**, cuando la exponga | § 18.7: «cost per qualified lead, **cuando Business Intelligence exponga la calificación**» |
| Revenue, CAC, ROAS, ventas | **Business** | § 18.6. `negocio.resultados` tiene 7 filas y cero ventas |
| Los tramos de ICP (alto/medio/bajo) | **sin dueño decidido** | el corte es una pregunta abierta en `docs/acquisition/04-CALIDAD-DEL-LEAD.md`. Creative **no lo inventa**: sería la quinta pantalla publicando lo mismo de la quinta manera |

---

## 4 · Lo que Creative ENTREGA

### C7-09 · A Executive, la ficha del departamento

**Qué es** · Una tarjeta con el estado del departamento y su hallazgo principal.
**Estado** · **Y hay una deuda que hay que nombrar acá, porque es el precedente exacto de lo que no
hay que hacer**: `lib/aios/executive-panel.js` publica hoy una tarjeta inventada —«Hook nuevo en
Prospecting B · el hook rate subió 4 puntos pero el cierre bajó 7»— que la gerencia ve, sobre datos
que no existen. Mientras Creative no publique una cifra medida, la tarjeta de Executive tiene que
decir **qué falta**, no inventar un hallazgo.

### C7-10 · A quien mire, la pregunta que sólo Creative contesta

**Qué es** · *¿Qué pieza trae mejor gente?*
**Rastro** · El § 18.1 dice que Acquisition **no puede** contestar sola qué anuncio genera más dinero,
*«porque esa conclusión requiere cruzar adquisición, ICP, agendamientos, ventas y revenue»*.
**Estado** · **Construible hoy en su versión honesta**, y es el ICP por pieza: de 29,2 a 69,2, factor
2,4. No es «qué pieza genera más dinero» —eso necesita ventas, que no hay— sino «qué pieza trae gente
con mejor encaje», que es un eslabón real de esa cadena y el único que hoy tiene dato.

### C7-11 · A Creative Intelligence, nada todavía — y por qué

**Qué es** · La mitad interpretativa que el § 18.12 le reserva en exclusiva: hook, body, CTA, guion,
variantes nuevas.
**Estado** · **Exige leer la pieza, y la pieza no está guardada en ninguna de las tablas de
`negocio`.** Ni video, ni copy, ni miniatura, ni guion. El `Creative Profile` del § 5.1 no existe como
tabla, y la API de GoHighLevel no lo da (`C14-07`, `C14-08`).

Así que **la independencia departamental que el corte por fuente quería defender no se puede
construir hoy por falta de datos, no por una decisión de arquitectura.** La forma honesta de
conservarla es dejar el lugar hecho y vacío: el día que exista un repositorio de piezas, Creative gana
su fuente propia y su módulo interpretativo se cuelga de la misma clave de pieza que `01` establece.

Lo que **no** hay que hacer es construir una agregación paralela ahora para justificar una frontera
que el dato todavía no sostiene.

### C7-P01 · La única capacidad creativa real del producto mira hacia AFUERA

`components/tools/EspiaDeAnuncios.jsx` + `lib/tools/espia.ts` consultan la Meta Ad Library y le piden
a la IA *«hooks/ganchos más usados»*, *«ofertas y ángulos recurrentes»* y *«estructuras de copy»*
(`lib/tools/espia.ts:79-88`). Es, literalmente, el análisis interpretativo del § 18.12 — **aplicado a
los anuncios de otros**, porque de los propios no se guarda la pieza.

Queda como pregunta abierta si ese análisis debería poder correr sobre las piezas propias el día que
existan, y si eso lo hace parte de Creative o sigue siendo una herramienta suelta.
