# El documento no nombra responsables de Conversion

> Fuente: `CC_Arquitectura_Funcional.md`, leído entero el 2026-09-20, más la declaración real de la
> sección en `lib/autorizacion/secciones.ts:264-270`.

---

## 1 · El hueco

### CV12-01 · Conversion no tiene su § 18.15

**Rastro** · Acquisition tiene una sección entera —`§ 18.15:1499-1531`— que enumera qué ve el media
buyer, qué ve el responsable creativo y qué ve la gerencia. Conversation tiene la suya —`§ 13:979-999`—
con cinco roles sugeridos.

**Estado** · **Conversion no tiene equivalente.** El `§ 17:1111` lo deja pendiente. El organigrama
del `§ 4:185-192` lista seis roles de Team Execution:

```text
├── Responsable de Ads
├── Responsable Creativo
├── Responsable de Conversation
├── Responsable de Ventas
├── Equipo Técnico
└── Gerencia
```

**Ninguno es «Responsable de Conversion».** El más cercano sería `Equipo Técnico`, que es a quien el
prototipo le asigna tres de sus once fricciones — con nombre propio, ver `CV6-08`.

### CV12-02 · Los destinatarios que la maqueta usa son departamentos, no roles

**Rastro** · El campo `to` de `FRICTIONS` (`lib/aios/conversion.js:43-77`) reparte las once
fricciones entre `Creative` (4), `Sales` (2), `Conversation` (1), `Acquisition` (1) y
`Kevin · técnico` (3).

**Estado** · Cuatro de los cinco son **departamentos del `§ 4:168-183`**, así que el vocabulario es
correcto y se conserva. El quinto es una persona y se va.

**Y dice algo del departamento**: de once fugas detectadas en la landing y el VSL, **ninguna la
resuelve Conversion**. Las arregla Creative —el guion, el mensaje—, Sales —el formulario, la
oferta— o el equipo técnico. Conversion **detecta y no ejecuta**, que es el mismo perfil que Creative
adoptó por decisión del 2026-09-18.

---

## 2 · Lo que la sección declara hoy

### CV12-03 · Seis líneas, y la bandera que se mueve con la ruta

**Rastro** · `lib/autorizacion/secciones.ts:264-270`, literal:

```ts
{
  clave: 'conversion',
  nombre: 'Conversion',
  capacidadRequerida: 'tablero.ver',
  sinOperacionesTodavia: true,
  menu: { grupo: 'Inteligencia', icono: '#i-conv', galon: true },
},
```

**Estado** ·

- **`capacidadRequerida: 'tablero.ver'`** es la correcta y no hay que inventar otra: siete pantallas
  la comparten, y lo que separa a las personas es el **alcance**, no la capacidad
  (`app/api/acquisition/route.ts:38-41`).
- **`sinOperacionesTodavia: true` es un cable trampa del `ADR-0304` y funciona en las dos
  direcciones**: con la bandera puesta, crear una ruta que declare `PANTALLA = 'conversion'` pone la
  suite en rojo; sin la bandera y sin ruta, también. **La bandera y la ruta se mueven juntas, en el
  mismo cambio.** Conversion sería el **tercer departamento** que la baja.
- **`galon: true` se queda.** El precedente ya resolvió esa duda: *«el galón es del prototipo… Lo que
  estaba mal no era el adorno: era que detrás no hubiera nada»* (`secciones.ts:257-261`).

---

## 3 · Lo que este departamento le puede dar a cada quien

### CV12-04 · A quien mira la landing

- Por dónde entra la gente hoy, con su reparto y su cobertura.
- Cuántos abandonan el formulario, y en qué estado.
- Qué recorrido convierte mejor **sin afirmar que uno lleva al otro**.
- Y lo que **no** se puede medir, dicho en la pantalla con su motivo.

### CV12-05 · A gerencia

La cifra que ninguna otra pantalla publica: **el 2026-08-31 la ruta de entrada cambió**, del 74 % por
la landing al 13 %, y el 44 % ahora agenda directo. Si fue deliberado, es una confirmación; si no,
es un hallazgo de veinte días de antigüedad que nadie había visto.

### CV12-06 · Lo que Conversion NO hace

Por el mismo criterio que Creative: **detecta y propone; no ejecuta**. No cambia la landing, no toca
el formulario, no edita el VSL. Y el `§ 18.10:1369-1383` pone los cambios de landing y de oferta
entre los que **requieren validación ejecutiva**.

**Y hay una consecuencia que no es de permisos sino de medición**: si el cambio lo hace una persona
fuera del producto, el producto no sabe cuándo ocurrió, y el «medir dos veces» del `§ 14:1003-1018`
no tiene un «antes» que fechar. Es el mismo `C11-P01` que Creative dejó abierto.

---

## Preguntas abiertas

### CV12-P01 · ¿Quién es el responsable de Conversion?

El organigrama no lo nombra. Las once fricciones del prototipo las resuelven otros cuatro
departamentos. Puede que Conversion **no tenga un responsable propio** y sea un departamento que
sólo produce para otros —lo cual sería legítimo y hay que decirlo—, o puede que el hueco sea del
documento. No se decide desde acá.

### CV12-P02 · ¿La pantalla la mira alguien hoy?

Conversion está en el menú con galón, la dibuja un módulo con 538 literales inventados, y **no tiene
una sola comprobación automática** (`CV9-11`). Si alguien la usa para decidir, está decidiendo sobre
números que no existen. Si no la usa nadie, el galón sobra. Las dos respuestas cambian la prioridad
de construirla.
