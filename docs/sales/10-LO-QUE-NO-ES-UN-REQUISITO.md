# Lo que NO es un requisito, y la lista de borrado

> Medición propia sobre `components/views/SalesView.jsx` (231 líneas), **2026-09-20**, contada token
> por token. Cada afirmación lleva su `archivo:línea`.

**Un requisito** es una pregunta que el departamento tiene que poder contestar. Sobrevive al borrado.
**El andamiaje** es la forma concreta en que la maqueta finge contestarla.

---

## S10-01 · El recuento exacto

`SalesView.jsx` tiene **67 tokens numéricos**. Los que importan:

| categoría | cuántos |
|---|---|
| **cifras de negocio dibujadas como texto** | **19** |
| **anchos de barra** (dato inventado dibujado como geometría) | **4** |
| numerales dentro de rótulos («7 días», «30 días») | 2 |
| valores `fr` de las rejillas en línea | 30 |
| ruido estructural (`h2`, `grid-4`, `data-p="7d"`…) | 5 |
| números del comentario de cabecera | 6 |

**El número que compara con Creative (201) y Conversion (530): Sales dibuja 23 valores inventados.**
Es, por lejos, la maqueta más chica de las tres — y la que más cerca está de poder medir.

Desglose:

- **13 conteos sin unidad**: 74, 18, 44, 31, 10, 63, 43, 8, 56, 21, 13, 12, 10
- **7 porcentajes**: `24%`, `32%`, `19%` visibles, más `38%`, `23%`, `21%`, `18%` como ancho de barra
- **3 montos**: `$55,200`, `$31,000`, `$24,200`
- **1 nombre de persona: «Jorge Veramendi»** (`:123`), **y es real**
- **0 fechas.** Ni una, en todo el archivo

---

## S10-02 · Las 28 frases escritas a mano

**20 son vocabulario de interfaz** y sobreviven casi tal cual: «Sales», «Closers», «Closer»,
«Agendadas», «Asistieron», «Ventas», «Cierre», «Revenue», «Asistencias», «Tasa de cierre», «Revenue
reportado», «Motivos de no venta», «Hoy», «7 días», «30 días», «Personalizado», «Plan de acción».

**8 son contenido afirmado**, y son las que se van:

| frase | línea | qué afirma |
|---|---|---|
| «Jorge Veramendi» | `:123` | que esa persona vendió $31.000 |
| «ICP alto asignado» | `:126` | una regla de asignación que **no existe** |
| «Asesor comercial» | `:148` | que hay dos closers |
| «ICP medio y bajo» | `:151` | la otra mitad de la regla inexistente |
| «Precio» | `:182` | un motivo que sí está en el catálogo |
| «No es quien decide» | `:193` | **no existe** en ninguna salida |
| «Sin necesidad clara» | `:204` | **no existe** |
| «Pidió tiempo» | `:215` | existe, pero es de `nurture`, no de `no_interesa` |

Ver `04-LA-TABLA-DE-CLOSERS.md` y `05-LOS-MOTIVOS-DE-NO-VENTA.md`.

---

## S10-03 · Lo que NO tiene, y conviene decirlo

Sales es la maqueta más limpia de las tres en tres dimensiones:

| | Creative | Conversion | Sales |
|---|---|---|---|
| módulo en `lib/aios/` | `creative.js`, 450 líneas | `conversion.js`, 655 | **ninguno** |
| puertas `data-leads` al panel de 14 personas inventadas | 18 | 7 | **0** |
| abre `#drawer` o `#recoModal` | sí | sí | **no** |

**Confirmado:** `grep -rni "v-sales|slPlanBtn|slPeriod|slPill" lib/` no devuelve nada. No hay
`lib/aios/sales.js`, no hay `app/api/sales/`, y `SalesView.jsx` no llama a `pedir()` ni a `fetch` ni
una vez.

**El borrado de Sales es el más chico de los tres.** Lo que se borra está todo en un archivo.

---

## S10-04 · Los tres controles muertos

Detallados en `07-EL-PLAN-DE-ACCION.md`. En resumen:

| control | id | qué hace |
|---|---|---|
| Botón «Plan de acción» | `slPlanBtn` (`:23`) | **nada.** Ningún oyente en todo el árbol |
| Segmentado de período | `slPeriod` (`:30`) | **nada**, y su tercer botón manda `data-p="mes"`, clave inválida |
| Píldora «Personalizado» | `slPill` (`:42`) | abre el calendario, no registra callback, y **apaga el resaltado del segmentado** |

---

## S10-05 · La lista de borrado

En el commit de la pantalla nueva:

1. **Los 23 valores inventados** y las 8 frases de contenido.
2. **«Jorge Veramendi».** Los nombres salen de `closersDeLaEmpresa()` o no salen.
3. **La mitad derecha del encabezado entera** (`.ch-r`, `:22-49`): el botón muerto, el segmentado
   muerto y la píldora. El período vive dentro del panel, como en las otras cuatro.
4. **El cuerpo entero** (`:52-226`), reemplazado por `<PanelDeSales />`.
5. **`sinOperacionesTodavia: true`** de `lib/autorizacion/secciones.ts:303`, y el conteo literal de
   `pruebas/codigo/90-fundaciones.test.ts:1078` de **3 a 2**.

`SalesView.jsx` queda como cáscara de unas 75 líneas con el comentario de qué se tiró y por qué —la
forma de `CreativeView.jsx` (70) y `ConversionView.jsx` (79)—.

**El galón se queda** (`secciones.ts:304`). Es el precedente de Creative: el adorno es del prototipo y
lo que estaba mal no era él, sino que detrás no hubiera nada.

---

## S10-06 · El CSS: seis clases exclusivas, y se miden antes de tocarlas

`SalesView.jsx` emite **34 clases**. Medido emisor por emisor sobre `components/` y `lib/`:

**Exclusivas de Sales (un solo emisor en todo el árbol servido):**

| clase | dónde está definida |
|---|---|
| `grid-4` | `app/aios.css:532` + `app/inteligencia-estetica.css:652` |
| `stat` | `app/aios.css:536-537` + `inteligencia-estetica.css:683-689` |
| `s-l` | `app/aios.css:536` + `inteligencia-estetica.css:684-689` |
| `s-v` | `app/aios.css:537` + `inteligencia-estetica.css:683` |
| `col-head` | `app/aios.css:553-559` |
| `mini-bar` | `app/aios.css:569-570` + `inteligencia-estetica.css:690` |

**Cuatro de ellas tienen regla `#v-sales` propia** en `app/inteligencia-estetica.css:683-690`. Si la
reescritura deja de emitirlas, esas reglas quedan sin emisor.

**Y dos avisos concretos:**

- `app/inteligencia-estetica.css:642-644` dice textualmente que la regla de `grid-4` **queda sólo
  porque Sales la sigue emitiendo**. Es la última.
- `app/inteligencia-estetica.css:24-28` afirma que las cinco pantallas de Inteligencia comparten
  `.ch-r`. **Ya no es cierto**: Creative y Conversion lo borraron, y Sales es la única que queda.

**`app/aios.css` no se toca.** Es el port literal del maquetado, y su propia cabecera lo dice. Lo que
se limpia es `app/inteligencia-estetica.css`, y **con la medición hecha, no con una suposición**: en
Conversion resultó que ocho clases se creían muertas y una estaba viva en SalesView.

---

## S10-07 · Y lo que se posterga, que no es lo mismo que borrar

Estos son **requisitos sin fuente**, no andamiaje. Vuelven el día que haya de dónde sacarlos:

| requisito | qué le falta | ficha |
|---|---|---|
| El revenue y la tasa de cierre | que alguien registre una venta | `S2-14`, `S2-15` |
| La asistencia | que alguien conteste «¿se presentó?» en Avanzar | `S2-16`, `S1-08` |
| El reparto de motivos | volumen: hoy hay 1 fila | `S5-04` |
| El plan de acción | frases con fuente. Hoy hay una: la diferencia de cancelación | `S7-01` |
| El desglose de dinero por closer | ventas, y resolver la ventana | `S4-09` |

Se posterga **por escrito y con su medición**, que es lo que convierte un hueco en un hueco declarado
en vez de en una regresión.
