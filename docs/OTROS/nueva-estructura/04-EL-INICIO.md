# El Inicio, y lo que se retira con la maqueta

## Lo que hay hoy

La pantalla Executive es una **maqueta**:

- **las cifras están escritas a mano** en tres módulos del navegador (`lib/aios/executive.js`,
  `executive-panel.js` y `executive-chat.js`): el mapa de departamentos, el funnel ejecutivo, la reunión y
  sus cambios;
- **el chat elige entre respuestas fijas** por palabras clave, sin ningún modelo detrás;
- a su lado hay un panel lateral (`components/SidePanel.jsx`) y, abajo de todas las pantallas, la barra
  «Pregúntale al cerebro» (`components/AskBar.jsx`), con un panel que se abre con Cmd+K.

El inventario completo está en `docs/OTROS/estado actual/11-EXECUTIVE.md`.

## `NE-29` · El Inicio honesto

Del lienzo, pantalla «Inicio · el cerebro», con lo que la data de hoy permite decir:

1. **La mascota** de 88 px, con la mirada que sigue al cursor.
2. **El saludo en dos pesos**: «Buenos días, [Nombre].» en peso 200 y «¿Qué quieres saber de tu agencia?»
   en 500.
   - Sólo el nombre de pila.
   - Sin nombre, sin coma.
   - La hora se cuenta en la **zona de la empresa**, no en la del servidor: «Buenos días» hasta las 12,
     «Buenas tardes» hasta las 19, «Buenas noches» después.
3. **La caja de chat del diseño, deshabilitada**, con una línea que dice que **el cerebro llega en una
   próxima etapa**.
   - No manda nada ni finge una respuesta.
   - Los botones de «@ agente» y de área no se dibujan hasta que haya qué elegir.
4. **No se dibujan** las tres tarjetas de «Reunión de hoy». Tienen que salir de reglas sobre datos reales
   (gasto en cero, citas sin asistencia, llamadas sin usar), y esas reglas no existen. Mostrar las del
   diseño sería volver a la maqueta.

El inicio es el mismo para todos. Quien no tiene la sección `executive` no ve «Nueva conversación» y arranca
en su primera pantalla, como hoy (`seccionDeArranque`, `lib/autorizacion/secciones.ts:875`).

La sección se llama **«Inicio»** en la pantalla y en Ajustes › Usuarios. Su clave sigue siendo `executive`
(`05-LO-QUE-NO-CAMBIA.md`).

## `NE-30` · Lo que se retira

| se va | por qué |
|---|---|
| `lib/aios/executive.js`, `executive-panel.js`, `executive-chat.js` | Eran la maqueta: cifras escritas a mano y respuestas fijas |
| `lib/aios/leads-group.js` | El cajón «Grupo de contactos»: sólo lo abría el funnel de la maqueta |
| `lib/aios/datepicker.js`, `period-controls.js` | Sólo los usaba la píldora de período escondida de la maqueta; ya no los usa ninguna pantalla |
| `components/SidePanel.jsx` | El panel lateral con la reunión y los cambios de la maqueta |
| `components/AskBar.jsx` y el panel de Cmd+K | «Pregúntale al cerebro» sin cerebro (`NE-09`). Vuelve con el diseño nuevo cuando el cerebro responda con datos |
| `components/Overlays.jsx` | Los cajones y el modal que sólo abrían los módulos de arriba |

Con eso, el arranque del navegador (`lib/aios/index.js`) queda con un solo módulo: el armazón
(`lib/aios/shell.js`). La grilla de la app pierde la columna lateral y la fila de la barra de abajo.

**Un defecto que se va con la columna**: hoy, quien arranca en una pantalla que no es Executive (un closer,
por ejemplo) ve el panel lateral de la maqueta hasta su primer clic, porque la clase que lo esconde sólo se
pone al navegar.

## Las pruebas que cambian

Las pruebas que leen estos archivos se ajustan **diciendo por qué**:

- la del mapa ejecutivo (`120`) se borra con el mapa;
- la del cierre de los paneles (`156`) pasa a vigilar que **no vuelvan**;
- se ajustan las que nombran la barra de abajo, el panel lateral y los pasos de comparación con el
  prototipo (`90`, `102`, `107`, `162`, `178`);
- la `95` y la `103` leen `components/Overlays.jsx` para exigir que dos paneles inertes del prototipo no
  vuelvan: pasan a exigir que el archivo no exista.

Una prueba nueva, como la de Leads Portal (`178`), vigila que la maqueta no vuelva:

- los archivos no existen;
- el arranque tiene un solo módulo;
- no hay atajo Cmd+K;
- el inicio no lleva cifras escritas.
