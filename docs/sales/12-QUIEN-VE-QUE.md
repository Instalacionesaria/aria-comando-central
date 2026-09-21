# El documento no nombra un dueño de Sales, y sí nombra un «Responsable de Ventas»

> Barrido de `CC_Arquitectura_Funcional.md` (1.650 líneas) y del código de autorización, hecho el
> **2026-09-20**. Cada afirmación lleva su `archivo:línea`.

---

## S12-01 · El § 18.15 no nombra a nadie de Sales

`:1499` «Usuarios responsables». Tres roles, ninguno comercial:

- `:1501` **Media buyer**
- `:1512` **Responsable creativo**
- `:1521` **Gerencia**

Tampoco en el § 13 (`:979-987`), que lista los cinco roles sugeridos de Conversation.

**No hay una vista de Sales ni un dueño de Sales en todo el documento.**

## S12-02 · Salvo una línea, en otro organigrama

`§ 4:190`, dentro del bloque **Team Execution** —no de la capa de Inteligencia—:

```
├── Responsable de Ventas
```

**Es el único nombramiento comercial del documento, y no se vuelve a mencionar nunca.**

Y ésa es la diferencia con Conversion, cuyo `docs/conversion/12-QUIEN-VE-QUE.md` se titula casi igual:
Conversion **no tenía** ni siquiera esto. Sales tiene un rol nombrado una vez, en el organigrama de
ejecución, sin ninguna atribución.

### S12-P01 · ¿Quién es el dueño de Sales? — **abierta**

**Por qué importa, y acá más que en las otras cuatro:** este departamento publica una tabla con el
nombre de personas al lado de cifras que se pueden leer como desempeño (`04-LA-TABLA-DE-CLOSERS.md`).
Quién puede abrirla no es una pregunta de permisos: es una pregunta de a quién le corresponde tomar
esa decisión.

Las tres lecturas defendibles:

1. **El «Responsable de Ventas» del `§ 4:190`** — el único nombrado, pero es de Team Execution.
2. **Gerencia** — por el `§ 7.2:407-415`, que describe lo que Gerencia debería poder ver.
3. **Cada closer, sólo lo suyo** — por el `§ 2.3:81`: *«Cada departamento puede mostrar directamente
   recomendaciones operativas al responsable de su área»*.

**El documento no desempata.** Y la tercera lectura choca con la primera: una tabla comparativa sin
comparación no es una tabla.

---

## S12-03 · Lo que el código dice hoy

`lib/autorizacion/secciones.ts:299-305`:

```ts
{
  clave: 'sales',
  nombre: 'Sales',
  capacidadRequerida: 'tablero.ver',
  sinOperacionesTodavia: true,
  menu: { grupo: 'Inteligencia', icono: '#i-sales', galon: true },
}
```

**La capacidad es `tablero.ver`**, compartida por siete secciones: `executive`, `contacts`,
`acquisition`, `creative`, `conversion`, `conversation` y `sales`. El propio comentario de
`secciones.ts:645-649` la usa como argumento de por qué el alcance por persona **no se puede expresar
con capacidades**.

**Requisito que sale de ahí:** no se inventa una `sales.ver`. Lo que separa a estas siete pantallas es
el **alcance** por persona, no la capacidad; agregar un eje nuevo acá lo rompería para las otras seis.
Es lo mismo que decidieron Acquisition, Creative y Conversion.

---

## S12-04 · Y el alcance «solo lo mío» ya existe, pero es de otra pantalla

`lib/negocio/alcanceDelCloser.ts` publica `alcanceDeQuienMira` y `verComoDeLaUrl` (`:77-185`), y la
pantalla Closer ya los usa: un closer ve sus contactos, no los de todos.

**Sales no puede reusar eso tal cual**, y hay que decidirlo:

| si Sales aplica el alcance | entonces |
|---|---|
| **sí** | un closer ve una tabla de una sola fila: la suya. La comparación desaparece, y con ella la única competencia que el documento atribuye (`§ 2.3:90`) |
| **no** | todo el que tenga `tablero.ver` ve la tabla comparativa completa, con los nombres |

**Hoy `tablero.ver` no la tiene un closer** —lo comprueba `pruebas/codigo/91-closer-y-setter.test.ts`,
que verifica que un closer no vea los tableros del prototipo—, así que la tensión no está activa. Pero
el día que alguien le dé esa capacidad a un closer, la decisión se toma sola y en el sentido
equivocado.

> **Queda declarado como decisión pendiente, no como olvido.** No se resuelve en esta etapa porque el
> documento no la plantea y la base no la fuerza.

---

## S12-05 · El galón, y por qué se queda

`secciones.ts:304` — `galon: true`. Lo dibuja `components/Nav.jsx:196` y lo llevan cinco secciones:
`contacts`, `icp`, `creative`, `conversion` y `sales`.

`docs/estado actual/02-CREATIVE.md:34` lo señalaba como el detalle que hacía que la pantalla pareciera
tan real como ICP & Oferta sin serlo. **El precedente de Creative ya resolvió esa duda: se queda.** El
adorno es del prototipo —cinco de las diez lo llevan— y lo que estaba mal no era el galón, sino que
detrás no hubiera nada.

---

## S12-06 · La bandera, y el cable trampa que dispara cuando se baje

`sinOperacionesTodavia: true` (`secciones.ts:303`). **Sales es una de las tres que quedan**, junto con
`executive` (`:216`) y `contacts` (`:225`) — de nueve que eran.

No es documentación: `secciones.ts:417-419` deriva de ella `SIN_OPERACIONES_TODAVIA`, y el cable
trampa de `ADR-0304` la verifica **en las dos direcciones** (`pruebas/codigo/30-portero.test.ts:295`,
`:400`, `:408`):

- con la bandera puesta y una ruta que declare `PANTALLA = 'sales'` → **rojo**;
- sin la bandera y sin ninguna ruta → **rojo también**.

Y hay una tercera dirección, en otro archivo: el conteo literal
`assert.equal(SIN_OPERACIONES_TODAVIA.length, 3)` en `pruebas/codigo/90-fundaciones.test.ts:1078`.

**Los tres se mueven en el mismo commit.** Es el mismo par que movieron `icp`, `conversation`,
`acquisition`, `creative` y `conversion` — las cinco veces que el cable disparó.
