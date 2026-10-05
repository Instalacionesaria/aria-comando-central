# El Inicio, y lo que se retira con la maqueta

## Lo que había hasta el 2026-10-01

La pantalla Executive era una **maqueta**:

- **las cifras estaban escritas a mano** en tres módulos del navegador (`lib/aios/executive.js`,
  `executive-panel.js` y `executive-chat.js`): el mapa de departamentos, el funnel ejecutivo, la reunión y
  sus cambios;
- **el chat elegía entre respuestas fijas** por palabras clave, sin ningún modelo detrás;
- a su lado había un panel lateral (`components/SidePanel.jsx`) y, abajo de todas las pantallas, la barra
  «Pregúntale a Executive sobre …» (`components/AskBar.jsx`), con un panel que se abría con Cmd+K.

El inventario completo está en `docs/OTROS/estado actual/11-EXECUTIVE.md`, que es la foto de antes del
corte. Lo que se construyó está al final de este documento.

## `NE-29` · El Inicio honesto

Del lienzo, pantalla «Inicio · el cerebro», con lo que la data de hoy permite decir:

1. **La mascota** de 88 px, con la mirada que sigue al cursor.
2. **El saludo en dos pesos**: «Buenos días, [Nombre].» en peso 200 y «¿Qué quieres saber de [Empresa]?»
   en 500.
   - La empresa es la de la sesión —la que se mira, si se mira otra—; sin nombre dice «tu agencia», el
     texto del diseño (pedido del 2026-10-02).
   - Sólo el nombre de pila.
   - Sin nombre, sin coma.
   - La hora se cuenta en la **zona de la empresa**, no en la del navegador: «Buenos días» hasta las 12,
     «Buenas tardes» hasta las 19, «Buenas noches» después.
3. **La caja de chat del diseño, deshabilitada**, con una línea que dice que **el cerebro llega en una
   próxima etapa**. Desde AG5 de los agentes (2026-10-04) el servidor existe (`app/api/executive/route.ts`),
   y **desde AG7 (2026-10-05) la caja pregunta**: se habilita con el estado `listo`, dibuja los turnos que
   devuelve el servidor y dice por qué cuando no puede (`docs/OTROS/agentes/08-LAS-ETAPAS.md`). Lo de abajo
   describe la caja deshabilitada de este corte.
   - No manda nada ni finge una respuesta.
   - Los botones de «@ agente» y de área no se dibujan hasta que haya qué elegir.
4. **No se dibujan** las tres tarjetas de «Reunión de hoy». Tienen que salir de reglas sobre datos reales
   (gasto en cero, citas sin asistencia, llamadas sin usar), y esas reglas no existen. Mostrar las del
   diseño sería volver a la maqueta. Desde la segunda edición (`09-LA-SEGUNDA-EDICION.md`, `NE-50`), una
   nota debajo de la caja dice qué va a aparecer, con el texto del diseño: «Reunión de hoy ·
   próximamente. Aquí aparecerán los tres temas del día que detecta el cerebro.» Una nota y no una
   tarjeta, sin una sola cifra; la `189` la deja pasar a ella sola.

El inicio es el mismo para todos. Quien no tiene la sección `executive` no ve «Nueva conversación» y arranca
en su primera pantalla, como hoy (`seccionDeArranque`, `lib/autorizacion/secciones.ts:876`).

La sección se llama **«Inicio»** en la pantalla y en Ajustes › Usuarios. Su clave sigue siendo `executive`
(`05-LO-QUE-NO-CAMBIA.md`).

## `NE-30` · Lo que se retira

| se va | por qué |
|---|---|
| `lib/aios/executive.js`, `executive-panel.js`, `executive-chat.js` | Eran la maqueta: cifras escritas a mano y respuestas fijas |
| `lib/aios/leads-group.js` | El cajón «Grupo de contactos»: sólo lo abría el funnel de la maqueta |
| `lib/aios/datepicker.js`, `period-controls.js` | Sólo los usaba la píldora de período escondida de la maqueta; ya no los usa ninguna pantalla |
| `components/SidePanel.jsx` | El panel lateral con la reunión y los cambios de la maqueta |
| `components/AskBar.jsx` y el panel de Cmd+K | La barra «Pregúntale a Executive sobre …», un chat sin cerebro. Volvió en la segunda edición, con el diseño nuevo, como la caja «Pregúntale al cerebro sobre …» al pie de cada departamento, deshabilitada y como «Próximamente» (`NE-50`, `components/ConsultaAlCerebro.jsx`); responde cuando haya cerebro |
| `components/Overlays.jsx` | Los cajones y el modal que sólo abrían los módulos de arriba |

Con eso, el arranque del navegador (`lib/aios/index.js`) queda con un solo módulo: el armazón
(`lib/aios/shell.js`). La grilla de la app pierde la columna lateral y la fila de la barra de abajo.

**Un defecto que se fue con la columna**: hasta el 2026-10-01, quien arrancaba en una pantalla que no era
Executive (un closer, por ejemplo) veía el panel lateral de la maqueta hasta su primer clic, porque la clase
que lo escondía sólo se ponía al navegar.

## Las pruebas que cambian

Las pruebas que leen estos archivos se ajustan **diciendo por qué**:

- la del mapa ejecutivo (`120`) se borra con el mapa;
- la del cierre de los paneles (`156`) pasa a vigilar que **no vuelvan**;
- se ajustan las que nombran la barra de abajo, el panel lateral y los pasos de comparación con el
  prototipo (`90`, `102`, `107`, `162`, `178`);
- la `95` y la `103` leían `components/Overlays.jsx` para exigir que dos paneles inertes del prototipo no
  volvieran: pasan a buscar sus ids en todo el código, y la `95` exige además que el archivo no exista.

Una prueba nueva, como la de Leads Portal (`178`), vigila que la maqueta no vuelva:

- los archivos no existen;
- el arranque tiene un solo módulo;
- no hay atajo Cmd+K;
- el inicio no lleva cifras escritas.

## Hecho el 2026-10-01 (E7)

Lo que se decidió al construirlo, además de lo de arriba:

- **«88 px» es el diámetro del orbe**, como lo mide el lienzo. El elemento de la marca dibuja el orbe en
  el 58 % de su caja (el resto es el halo), así que el `size` de `<aria-mascot>` es 152. El envoltorio
  (`components/marca/Mascota.jsx`) recibe el diámetro y hace la cuenta. Espera a que el elemento esté
  definido antes de dibujarlo, y sólo mira el cursor mientras el Inicio está a la vista. El SVG mide más
  que la caja de 88, y para que el orbe quede en su centro la rejilla del envoltorio centra la pista además
  del elemento (`placeContent`): sin eso el orbe caía 32 px a la derecha y 32 abajo, encima del saludo.
  Lo encontró la revisión de la etapa, medido en Chrome; después del arreglo, el orbe queda en el centro y
  a 28 px del saludo a 1440, 1000, 812 y 375 px de ancho.
- **La disposición**: el halo es el del elemento de la marca, no la sombra del lienzo, porque la marca no
  lleva sombras (`NE-28`). El saludo baja de 44 px a 30 en un teléfono (`clamp`), y los 120 px de margen a
  los lados, a 24. El centrado vertical es con márgenes automáticos y no con `justify-content: center`:
  cuando el contenido no entra —un teléfono acostado, una ventana baja— el Inicio arranca arriba y se
  puede desplazar, en vez de perder la mascota por arriba sin forma de llegar a ella.
- **La caja**: `surface-raised` con el borde de control y el radio que la marca da a «la caja de
  consulta» (`--radius-sm`, 12 px; el lienzo dibuja 22, que no es un token). Sólo el campo y el botón
  de enviar, los dos deshabilitados; el botón, en secundario, para que no se lea como una acción. El
  «+» tampoco se dibuja: no hay qué adjuntar. El campo dice «Pregúntale al cerebro…», sin la mitad que
  ofrecía agentes, y debajo va la línea del cerebro en camino. El campo y el botón la nombran con
  `aria-describedby`, y ninguno lleva opacidad: ni la que usaría un diseño para decir «deshabilitado» ni
  la que les ponen Firefox al texto de muestra y Safari de iOS al campo (esta última no se midió en un
  teléfono). El borde de la caja da 2,07:1 contra el fondo: como control deshabilitado, la WCAG 1.4.11 lo
  exime. **El día que la caja se habilite**, su borde tiene que llegar a 3:1 contra el fondo y contra la
  caja (por ejemplo `#5b6576`: 3,45:1 y 3,26:1), o llevar otra señal de dónde está el campo. Se habilitó en
  AG7 de los agentes con `--line-control`, `#7f8a9b` (5,8:1 y 5,49:1): `#5b6576` es el `ink-3` del tema claro
  de la marca, y su paleta oscura no lo tiene.
- **El saludo** vive en `lib/saludo.ts`, con la hora de `horaDelDiaEnZona` (`lib/negocio/tiempo.ts`):
  una zona inválida cae a UTC, no a la del navegador. Se recalcula cada vez que el Inicio vuelve a la
  vista. La madrugada dice «Buenos días», al pie de la letra de esta regla.
- **La sección se llama «Inicio»** en `lib/autorizacion/secciones.ts`, en su misma línea.
- **La grilla** quedó con dos filas y dos columnas (`app/armazon.css`), y con ella se fue la clase
  `.solo` y el defecto del panel lateral en la primera carga. Desde E10, en la computadora, la barra va de
  arriba abajo; desde E11, la columna del cuerpo tiene la fila de la cabecera del departamento; y desde
  la segunda edición (F3), una tercera debajo del cuerpo, `consulta`, con la caja «Pregúntale al cerebro
  sobre …» (`NE-50`).
- **La compuerta de paridad quedó retirada**: sus tres pasos eran de la maqueta. Con `VISTAS` y `PASOS`
  vacías imprime «retirada» y sale 0, como decidió la Etapa 0.

Lo vigilan `pruebas/codigo/189-la-maqueta-del-executive-se-fue.test.ts` y
`pruebas/codigo/190-el-saludo-en-la-zona-de-la-empresa.test.ts`.
