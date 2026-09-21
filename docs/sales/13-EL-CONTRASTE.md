# El prototipo contra el documento contra lo medible hoy

> Las tres columnas, cifra por cifra. Prototipo: `components/views/SalesView.jsx`, 231 líneas.
> Documento: `CC_Arquitectura_Funcional.md`, 1.650 líneas. Medición: producción, **2026-09-20**.

---

## S13-01 · La tabla

| lo que el prototipo dibuja | lo que el documento pide | lo que la base sostiene hoy |
|---|---|---|
| Asistencias **74** | «Asistencia» en el perfil (`§ 5.3:261`); «Show rate» es de Appointment Flow (`§ 10.7:751`) | **nada.** `citas.asistio` nulo en las 327 |
| Tasa de cierre **24 %** | *«close rate»* (`§ 18.18:1618`), **y es de Business** | **nada.** 0 ventas sobre 7 intentos |
| Ventas **18** | *«¿El cliente compró?»* (`§ 5.4:271`) | **0** en toda la base |
| Revenue **$55.200** | *«Monto vendido»* (`§ 5.4:272`), *reportado no verificado* (`:288`) | **0 montos**, y 0 de 5 orgs con pagos |
| Tabla de 2 closers | *«coaching para un closer»* (`§ 2.3:90`) | **3 closers configurados** y un cuarto asignatario sin designar; la diferencia son **5 puntos** en la ventana por omisión |
| «ICP alto asignado» | — | **la regla no existe** en ninguna parte |
| 4 motivos de no venta | — | el catálogo tiene **otros 5**, y hay **1 fila** |
| Botón «Plan de acción» | — | **0 frases detrás** |
| — | `sales_call_id` (`§ 5.2:234`) | `resultados.cita_id`, **nulo en las 7** |
| — | *«Auditoría de llamadas de venta»*, **existente** (`§ 16.1:1072`) | `negocio.llamadas`: **0 filas** |
| — | — | **59,2 % de cancelación** — lo único medible de punta a punta |
| — | — | **mediana 2,9 días** del alta a la primera cita |
| — | — | **86 de 91 citas ocurridas sin resultado** |

**Las últimas tres filas son la noticia:** lo que se puede publicar hoy **no está ni en el prototipo
ni en el documento**. Salió de medir.

---

## S13-02 · Donde el prototipo acierta, y hay que conservarlo

Tres cosas, y son pocas pero reales:

1. **El rótulo «Revenue reportado»** (`SalesView.jsx:87`). La palabra *reportado* es exactamente lo que
   el `§ 5.4:288` exige y lo que la medición confirma. Se conserva, y se le agrega el resto de la
   frase pegada a la cifra.
2. **La forma de la tabla por closer.** Seis columnas por persona es la forma correcta de la única
   competencia que el documento atribuye. Lo que cambia es de dónde salen las filas y qué columnas
   sobreviven.
3. **Que los motivos de pérdida merecen un bloque.** El requisito es bueno; la taxonomía es inventada.

## S13-03 · Donde el documento se equivoca contra la producción

`§ 16.1:1072` declara *«Auditoría de llamadas de venta»* entre las capacidades **EXISTENTES**.

**No existe.** `negocio.llamadas` tiene **0 filas**: cero grabaciones, cero transcripciones, cero
auditoría de llamadas de venta. Lo que sí existe es la auditoría de Conversation, que audita chats.

El propio documento se contradice dos secciones después: `§ 16.2:1101` pone como pendiente n.º 7
*«Conectar contacto, cita, asistencia y venta reportada»* — que es exactamente la cadena rota.

> Es la misma clase de contradicción que Conversion documentó en su
> `14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md`: **el documento describe un sistema más completo que
> el que hay.** Acá la diferencia es que el instrumento de Sales ni siquiera se encendió una vez.

## S13-04 · Y donde el prototipo se contradice consigo mismo

Hay **dos maquetas** afirmando cosas distintas sobre la misma pantalla:

| dónde | ventas | tasa de cierre |
|---|---|---|
| `components/views/SalesView.jsx:80,70` | **18** | **24 %** |
| `lib/aios/executive.js:194-197` | **11** | **31 %** |

Y el embudo ejecutivo de `lib/aios/executive.js:27-28` declara dos de sus pasos con `own:'Sales',
view:'sales'`, o sea que **la maqueta de Sales es alcanzable por drill-through desde Executive**, no
sólo desde el menú. Quien llegue por ese camino ve 11 ventas; quien llegue por el menú ve 18.

`docs/estado actual/05-SALES.md:84` lo midió para el mismo período de 7 días: 74/18/$55.200 contra
36/11/$27.940. **El doble.** Y *«nadie lo nota porque ninguna se calcula»*.

### S13-P01 · ¿Fue un descuido o dos épocas? — **abierta**

**Por qué importa poco para el plan y mucho para el borrado:** `lib/aios/executive.js` **no se toca en
esta etapa** —es de la pantalla Executive, que sigue siendo maqueta y sigue con
`sinOperacionesTodavia`—. Pero el día que Sales publique cifras reales, el drill-through desde
Executive va a llevar de una cifra inventada a una medida, y la diferencia va a parecer un defecto de
Sales.

**Queda anotado como consecuencia conocida del borrado**, no como algo a arreglar acá.

---

## S13-05 · El veredicto, en tres líneas

- **El prototipo** dibuja 23 valores inventados que cierran aritméticamente entre sí, y una persona
  real al lado de ellos.
- **El documento** le da a Sales la última milla de la traza y le quita la interpretación comercial,
  lo declara pendiente dos veces, y no le pone ni una frase en la boca.
- **La base** no tiene ni una venta — pero tiene tres cifras con señal que ninguna de las otras dos
  fuentes había imaginado, y una de ellas (86 de 91) apunta directo al motivo por el que no hay ventas
  registradas.

> **Y ésa es la diferencia con Creative y Conversion.** Allá la medición corrigió cifras. Acá la
> medición **cambia de qué habla el departamento**: de reportar ventas a mostrar por qué no hay
> ninguna que reportar.
