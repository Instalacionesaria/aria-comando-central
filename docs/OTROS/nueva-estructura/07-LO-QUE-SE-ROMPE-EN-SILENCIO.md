# Lo que se rompe en silencio

> Cada riesgo de esta fase que **no falla con un error**: se ve bien y está mal, o deja de andar sin
> avisar. Al lado, la prueba o el paso que lo vigila.

| riesgo | por qué no avisa | qué lo vigila |
|---|---|---|
| **Clics al menú viejo.** Los módulos de la maqueta navegan buscando la fila `.nav-item[data-view=…]` y haciéndole clic. Si la fila no está, el clic no pasa y nada falla | Un `querySelector` que no encuentra nada devuelve `null`, y el código lo salta | Los módulos se retiraron en E7, **antes** de tocar el menú (E9 y E10). Lo exige `pruebas/codigo/189-la-maqueta-del-executive-se-fue.test.ts`, que además busca cualquier clic sintetizado sobre una fila del menú |
| **Filas que nacen después del arranque.** El armazón ata los clics del menú una sola vez, al arrancar. Una fila que React dibuja después —un acordeón que se abre— no tendría clic | La fila se ve y no hace nada | En E9 cada fila navega con su propio `onClick`, y una prueba exige que ya nadie ate clics al arrancar |
| **Una pestaña sin entrada.** Al quitar las barras propias de Tools y Analizadores, una pestaña que el modelo no nombre queda **inalcanzable** | Sigue en el código, nadie llega a ella | La prueba cruzada de E8: toda pestaña de Tools y de Analizadores tiene su entrada |
| **Una sección nueva sin ubicar.** Si se agrega una sección a `secciones.ts` y no a un departamento, la sección desaparece del menú | Desaparece; no da error | La prueba cruzada de E8: toda sección del menú queda ubicada una sola vez |
| **La cabecera dentro de la pantalla.** Las vistas de operación se estiran sobre el relleno de su contenedor (`margin` negativo y `height: calc(100% + 22px)`); una cabecera dentro del mismo contenedor les cortaría el pie | El final de la pantalla queda tapado | La cabecera va en **su propia área de la grilla**, fuera de `.main` (E11). Se mira con capturas en las pantallas de operación |
| **El tema guardado en el navegador.** Quien eligió «claro» lo tiene guardado en el navegador y en la base | Sin el botón, quedaría en claro sin poder volver | El tema se fija en `app/tema.ts` y ya no se lee de ningún lado (E3). Lo exige `pruebas/codigo/186-solo-oscuro.test.ts` |
| **Geist es más ancho.** Las mismas palabras ocupan más | Nombres de menú, cifras y columnas se cortan con puntos suspensivos | Capturas de cada pantalla a 1440 px en E4 y E5 |
| **El recolor de las pantallas de operación.** Su elevación era zinc de tres escalones; pasa a superficies de la marca con diferencias mínimas (1,03 a 1,07:1) sobre líneas finas | Las tarjetas «flotan» menos y una tarjeta puede perder el borde | Capturas de cada vista de operación en E5; la prueba de la paleta mide el contraste de todo color de texto |
| **Las citas `archivo:línea` de los documentos.** Borrar archivos o agregarles líneas corre las citas | La prueba de las citas sólo mira que la línea exista, no que diga lo mismo | E6 reescribe las citas antes de borrar; `secciones.ts` no se toca (`NE-33`); cada etapa revisa las citas a los archivos que cambia |
| **El estado de las pantallas.** Si las vistas se montaran al abrirlas, un chat de ICP o un escaneo se perderían al cambiar de departamento | La pantalla vuelve vacía, como recién abierta | Todas siguen montadas a la vez (`NE-35`); se prueba en el navegador en E11 |
| **Dos entradas de la misma vista en departamentos distintos.** Dentro de Tools el panel de cada pestaña se vuelve a montar al cambiar de pestaña (Analizadores no: ver `NE-35`). Pasar de Research › Scraper a Marketing › Tu página y volver pierde los leads ya traídos y, sin un escaneo en vuelo, lo escrito en el formulario | Se ve como si el Scraper se hubiera borrado solo | Ya pasa hoy dentro de Tools y no cambia (`NE-35`); el escaneo en vuelo se retoma. Se recorre en el navegador en E11, con un escaneo en vuelo y con uno terminado |
| **Las casillas de Ajustes › Usuarios.** Agruparlas por departamento podría repetir una sección en dos grupos | Una casilla repetida guarda la misma pestaña dos veces o desmarca la otra | E12 pone cada sección en un solo grupo, y una prueba lo exige |
| **El otro desarrollo en paralelo.** Otra persona agrega secciones y toca el armazón en `main` | Un rebase que mezcla mal se ve bien hasta que se navega | `git pull --rebase` antes de cada commit, la suite entera después, y la prueba cruzada de E8 |
| **El 403 de Research › ICP.** Quien tiene ICP sin Tools recibe 403 en el paso de mercado (`/api/tools/saldo` y `/api/tools/scrape`) | Ya pasa hoy; la estructura nueva lo vuelve más visible | Queda documentado (`NE-36`); se resuelve con los permisos por herramienta |

## Tres defectos que ya existían, encontrados al planificar

Se anotan en `docs/OTROS/estado actual/09-DEUDA-ABIERTA.md`:

1. **El botón «Eliminar» de Ajustes › Usuarios no aparece para nadie**, tampoco para el superadministrador.
   La ruta de sesión manda `puedeBorrarPersonas`, pero `app/guardia.tsx` no lo copia al contexto. Se
   corrige en E2. **Cerrado el 2026-10-01** en E2: la guarda copia toda clave de la sesión, y la `185` lo exige.
2. **El panel lateral de la maqueta se ve en la primera carga** a quien arranca en otra pantalla, hasta su
   primer clic. Se va con la columna, en E7. **Cerrado el 2026-10-01** en E7: la columna lateral se fue, y con ella la clase `.solo`.
3. **El menú no se puede usar con el teclado**: sus filas son `div` sin foco. Pasan a ser botones en E9. **Cerrado el 2026-10-01** en E9: las filas son `<button>` y la abierta lleva `aria-current`; en el teléfono, el cajón cerrado sale del orden del tabulador (`visibility`), así que las filas no son paradas invisibles.
