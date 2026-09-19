# El cajón, la curva y el guion

> Requisitos derivados de `lib/aios/creative.js:208-330` y de `components/Overlays.jsx:120-136`.
>
> Éste es el documento de la pieza más peligrosa de la pantalla. Todo lo demás del prototipo publica
> cifras falsas; **esto publica un diagnóstico falso** — señala un segundo del video y una frase del
> guion como la causa de que la gente se vaya.

---

## 1 · El cajón

### C4-01 · Cada pieza se abre en un cajón lateral con su ficha

**Qué es** · Al clicar una tarjeta se despliega un panel con todo lo que se sabe de la pieza.
**Rastro** · `lib/aios/creative.js:279-325` (`openCre`); el contenedor vive en
`components/Overlays.jsx:120-136`, compartido con otras pantallas.
**Estado** · **Requisito.** Es lo que separa «ordenar una lista» de «entender una pieza», y es donde
tiene que caber la cobertura de cada cifra sin ensuciar la tarjeta.

### C4-02 · El cajón abre con un veredicto en una línea

**Rastro** · `lib/aios/creative.js:286-287` → `«✓ Funciona · 31 agendas»` o
`«✕ Bajo en agendas · 8»`.
**Estado** · La forma es requisito. El texto hereda la corrección de `C3-07`: describe el hecho, no
da la orden. Y hereda `C3-06`: el veredicto es **dentro de la etapa**.

### C4-03 · La sección «Qué es»

**Rastro** · `lib/aios/creative.js:289-298`. Siete casillas: Formato · Ángulo · Estado · Duración ·
Publicado · Pieza · **Dolor que ataca**.
**Estado** · **Seis de las siete no tienen fuente.** Formato, ángulo, estado, duración y el dolor no
llegan de ninguna parte (`C14-07`); «Publicado» sale de `AGE`, ocho literales (`:58`).
Lo que sí se puede poner en su lugar, todo medido:

| casilla real | de dónde sale |
|---|---|
| En cuántos anuncios corre | `count(distinct meta_anuncio_id)` (`C3-09`) |
| Etapa del embudo | del nombre de campaña (`C1-10`), **diciendo que se lee de ahí** |
| Días con entrega, de cuántos de la ventana | `negocio.metricas_de_anuncio` |
| Primer y último día con entrega | ídem — reemplaza a «Publicado», y es un hecho |
| Conjuntos de anuncios en los que corre | `meta_conjunto_id` |

### C4-04 · La sección «Datos del video» es la rejilla de cifras con su cobertura

**Rastro** · `lib/aios/creative.js:302-308`, seis cifras con la coletilla «venta directa».
**Estado** · Requisito. **Y es el lugar donde la cobertura de cada cifra tiene que estar escrita**: en
la tarjeta no cabe, y sin ella un hook rate calculado sobre 3 de 20 días se lee igual que uno
calculado sobre 20.

---

## 2 · La curva de retención

### C4-05 · La curva NO es un dato, y no lo es de dos maneras

**Qué es** · Un SVG que dibuja cómo cae la atención a lo largo del video, con puntos rojos en las
caídas.
**Rastro** · `lib/aios/creative.js:208-232` (`retentionCurve`), `:256-262` (`dropSeconds`),
`:316` (la llamada).
**Fórmula del prototipo** ·

```
[[0,100], [0.10,hookRate], [0.25,hookRate-8], [0.45,(hookRate+retention)/2],
 [0.65,retention+6], [0.85,retention+2], [1,retention]]
```

**Estado** · **Andamiaje en sus valores Y en su forma**, y ésa es la diferencia con todo lo demás de
esta carpeta:

1. **En sus valores**: los siete puntos se interpolan entre dos literales inventados por pieza.
2. **En su forma**: los coeficientes `0.10, 0.25, -8, 0.45, 0.65, +6, 0.85, +2` son los mismos para
   las ocho piezas, así que **las ocho tienen la misma curva**, escalada. Una curva idéntica para
   todas no distingue nada; sólo dibuja el número de cabecera dos veces.
3. **Y no hay fuente ni con Meta conectado**: los cuartiles son **cuatro puntos, no una curva
   continua** — y acá ni siquiera llegan (`C14-05`). Cuatro puntos no señalan un segundo.

### C4-06 · Las «caídas de atención» y las líneas rojas del guion son un diagnóstico fabricado

**Qué es** · `dropSeconds` marca como caída todo tramo que pierda ≥ 12 puntos de la curva, y esas
marcas deciden qué frase del guion se pinta en rojo.
**Rastro** · `lib/aios/creative.js:256-262`, `:263-278`. El pie de la sección dice: *«Las líneas
marcadas coinciden con caídas de atención — revisa qué se dice ahí para ajustarlo, o replícalo si el
video funcionó.»*
**Estado** · **Es el riesgo más caro de la pantalla.** Como la curva es la misma para todas las
piezas, las «caídas» caen siempre en los mismos tramos relativos, y lo que se marca en rojo depende
sólo de en qué segundo cae cada frase del guion inventado. La pantalla le dice a alguien que
reescriba una frase concreta de su video **por un cálculo que no tiene ninguna entrada de la
realidad**.

### C4-07 · Lo que sobrevive es el requisito, no la forma

**El requisito** · *Decir dónde se cae la atención dentro de la pieza.*
**Estado** · **No tiene fuente por ninguna vía disponible, y no se aproxima.** Lo que haría falta:

| para | hace falta |
|---|---|
| Los cuatro cuartiles | conectar Meta directo — `fields` es enum cerrado (`C14-05`) |
| El tiempo medio visto | ídem |
| El guion | un repositorio de piezas: el `Creative Profile` del § 5.1, que no existe como tabla (`C14-08`) |
| Señalar un segundo | **nada de lo anterior alcanza**: cuatro cuartiles no son una curva |

**No se dibuja una curva con los cuartiles el día que lleguen.** Cuatro barras son cuatro barras;
unirlas con una línea vuelve a afirmar lo que pasa en el medio, que es de nuevo lo mismo.

---

## 3 · El guion

### C4-08 · La transcripción del video no existe en ninguna tabla

**Rastro** · `lib/aios/creative.js:62-68` (`TRANSCRIPT`): 30 frases en primera persona con su marca de
tiempo, escritas a mano, para cinco de las ocho piezas.
**Estado** · **No existe.** Ninguna de las tablas de `negocio` guarda guion, copy, archivo de video ni
miniatura, y la API de GoHighLevel no los da (`C14-07`, `C14-08`).
**El vacío que dibuja el prototipo cuando falta** ya está bien resuelto y se conserva: «Formato
**Estático** — sin guión (no es video).»

### C4-09 · Y sin embargo, el nombre de la pieza dice mucho

**Qué es** · La convención de nombres codifica etapa, ángulo, formato y variante. Ejemplos reales de
`negocio.anuncios`:

```
tofu - educación - construir - broll        bofu - agendamiento - yaping - 23/07
(nicho) dolor "sistema" - horizontal        credibilidad - testimonio - entrevista
Valor - nuevo modelo - editado              (margen) dolor "general" - broll
Servicio HT - transición a AI Native Agency - editado
```

**Estado** · Es un dato real y es lo único que se sabe de la pieza. **Pero derivar el ángulo y el
formato de ahí es una decisión de producto, no una lectura**: nadie garantiza la convención, y hay
nombres que no la siguen (`El app`, `VSL`, `Estancada`, `Evoluciona native`, `manifiesto horz`). Queda
como pregunta abierta en `13-EL-CONTRASTE.md`, no como requisito. Si se decide, **lo que no parsea se
cuenta aparte y no se fuerza a ninguna rama**.

---

## 4 · El cajón no es sólo de Creative, y eso importa al borrar

### C4-10 · `#drawer` y `#recoModal` son compartidos, y Creative es el único que los cierra

**Qué es** · Los dos overlays viven en `components/Overlays.jsx:97-136`, hermanos de las vistas.
**Rastro** · `lib/aios/creative.js:442-445` registra **los únicos** escuchadores de cierre:
`recoClose`, `recoScrim`, `scrim`, `dwClose`, más el `Escape`.
Y los **abren** sin registrar nada: `lib/aios/conversion.js:563` y `:620`,
`lib/aios/executive-panel.js:67` y `:88`, `lib/aios/leads-portal.js:286`,
`lib/aios/period-controls.js:58`. Peor: `executive-panel.js:64` hace literalmente
`document.getElementById('dwClose').click()`.
**Estado** · **No es un requisito de Creative: es una deuda de armazón que el borrado de Creative
destapa.** Si `creative.js` se va sin mudar esos cinco escuchadores, alguien abre «Plan de acción» en
Conversion y el modal queda con su velo sobre toda la aplicación **sin botón, sin velo y sin `Escape`
que lo cierre — y sin un error en consola**. Está en la lista de borrado de
`09-LO-QUE-NO-ES-UN-REQUISITO.md` como paso bloqueante.
