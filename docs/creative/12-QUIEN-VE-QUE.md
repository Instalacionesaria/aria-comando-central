# Quién ve qué: la vista del responsable creativo

> **`lib/aios/creative.js` YA NO EXISTE.** Se borró el 2026-09-19, y con él los 201 literales
> inventados que esta carpeta documenta. Las citas `creative.js:N` de abajo **siguen siendo
> correctas como referencia histórica** —el archivo y sus líneas están en el historial de git— y ésa
> es toda su función: este documento nunca describió lo que hay, describió lo que la maqueta dibujaba
> para sacar de ahí los requisitos.
>
> **Y `components/views/CreativeView.jsx` se reescribió el mismo día**: pasó de 99 líneas a 70, así
> que sus citas son de DOS clases y la segunda es la peligrosa. Las que apuntan más allá de la línea
> 70 fallan al resolverse, y se ven. Las que apuntan más acá **siguen resolviendo y muestran otra
> cosa**, que es peor: una línea corrida no falla.
>
> Lo que hay hoy es `components/creative/PanelDeCreative.jsx` con tres bloques medidos: el ICP y la
> agenda por pieza (`lib/negocio/calidadDelCreativo.ts`), el hook rate y las tasas de enlace
> (`rendimientoDelCreativo.ts`) y la caída del CTR (`fatigaDelCreativo.ts`).

> Fuente: `CC_Arquitectura_Funcional.md` § 18.15 (`:1499-1531`) y § 18.10 (`:1369-1383`).
> Más la declaración real de la sección en `lib/autorizacion/secciones.ts:250-256`.

---

## C12-01 · El § 18.15 no dice «hay permisos»: dice qué ve cada rol, y las tres listas son distintas

Literal, `:1499-1531`:

```
### Media buyer

Ve:
- Rendimiento por campaña, ad set y anuncio.
- Alertas.
- Recomendaciones locales.
- Tareas.
- Evidencia.
- Evolución de cambios.

### Responsable creativo

Ve:
- Anuncios con mejor retención.
- Creativos fatigados.
- Hooks con mejor comportamiento.
- Solicitudes de nuevas variantes.

### Gerencia

Ve:
- Estado general de adquisición.
- Riesgos.
- Gasto.
- Eficiencia.
- Calidad de atribución.
- Iniciativas pendientes.
- Impacto de cambios.
```

**Las tres no son tres filtros del mismo tablero: son tres tableros.** El media buyer ve el grano del
anuncio; el responsable creativo, el de la pieza; la gerencia, el del departamento.

---

## C12-02 · Las cuatro cosas del responsable creativo, medidas

| lo que ve | estado |
|---|---|
| **«Anuncios con mejor retención»** | **no tiene fuente.** La retención por cuartil no llega (`C14-05`). Lo más cercano es el **hook rate**, que es otra cosa: mide cuántos empiezan a ver, no cuántos se quedan |
| **«Creativos fatigados»** | **se puede, por caída de CTR** (`C2-24`), con el umbral sin calibrar (`C11-07`) y la base corta (5 piezas con ≥ 14 días) |
| **«Hooks con mejor comportamiento»** | **a medias.** Se puede ordenar por hook rate; **no se puede decir qué es el hook** de cada pieza, porque el guion no existe (`C4-08`) |
| **«Solicitudes de nuevas variantes»** | **no existe.** Es una entidad persistida —alguien la crea, alguien la recibe, alguien la cierra— y no hay tabla ni flujo (`C6-P01`) |

### C12-03 · Es la vista más lejana de construirse, aunque parezca la más chica

`docs/acquisition/12-QUIEN-DECIDE-QUE.md:91-123` lo había anotado: *«El responsable creativo ve cuatro
cosas y las cuatro son de video y fatiga — o sea que su pantalla depende entera del `Creative
Performance Analyzer`, que hoy no existe. Su vista es **la más lejana de construirse**, aunque parezca
la más chica.»*

**Sigue siendo cierto, con un matiz que la medición cambia**: de las cuatro, una se puede construir
hoy (creativos fatigados) y otra a medias (hooks, si se acepta el hook rate como proxy). Antes eran
cero de cuatro. **Sigue sin ser una vista completa**, y la diferencia entre «dos de cuatro» y «cuatro
de cuatro» es exactamente el activo creativo y los cuartiles: Meta directo.

### C12-04 · Y lo que la pantalla SÍ le puede dar hoy, el § 18.15 no lo pide

La cifra más valiosa que Creative puede publicar hoy no está en la lista del responsable creativo:
**qué pieza trae mejor gente.** Medido, factor 2,4 en el ICP promedio y de 31 % a 77 % en la tasa de
agenda (`C2-16`, `C2-18`).

No es una omisión del documento: el § 18.15 enumera lo que un responsable creativo *pide*, y el ICP
del lead es una consecuencia de la pieza que sólo se ve cruzando dos departamentos. **Es el hallazgo
que justifica que esta pantalla exista antes de que llegue el video**, y va en su vista aunque el
documento no lo haya previsto.

---

## C12-05 · Lo que el responsable creativo NO puede hacer desde el producto

**Rastro** · § 18.10 (`:1369-1383`): las decisiones de presupuesto, de pausa y de lanzamiento
requieren validación ejecutiva. `docs/acquisition/12-QUIEN-DECIDE-QUE.md` lo numeró como `A12-03`.
**Estado** · Y por decisión del 2026-09-18, **Creative es de sólo lectura**: propone, y la persona
ejecuta en Meta. Así que:

- No se pausa una pieza desde la pantalla.
- No se duplica ni se relanza.
- No se cambia presupuesto.
- El rótulo «pausar o iterar» del prototipo (`lib/aios/creative.js:197`) **cambia de verbo**:
  describe el hecho, no da la orden (`C3-07`).

**Y hay una consecuencia que no es de permisos sino de medición**: si el cambio lo hace una persona
fuera del producto, el producto no sabe cuándo ocurrió, y entonces el «medir dos veces» del § 18.12 no
tiene un «antes» que fechar. Ver `C11-P01`.

---

## C12-06 · Lo que la sección declara hoy ante la capa de autorización

**Rastro** · `lib/autorizacion/secciones.ts:250-256`, literal:

```ts
{
  clave: 'creative',
  nombre: 'Creative',
  capacidadRequerida: 'tablero.ver',
  sinOperacionesTodavia: true,
  menu: { grupo: 'Inteligencia', icono: '#i-creative', galon: true },
},
```

**Estado** ·

- **`capacidadRequerida: 'tablero.ver'`** es la correcta y no hay que inventar otra: siete pantallas la
  comparten, y lo que separa a las personas es el **alcance**, no la capacidad. Acquisition lo dejó
  escrito en `app/api/acquisition/route.ts:38-41`.
- **`sinOperacionesTodavia: true` es un cable trampa del `ADR-0304`, y funciona en las dos
  direcciones**: con la bandera puesta, crear una ruta que declare `PANTALLA = 'creative'` pone la
  suite en rojo; sin la bandera y sin ruta, también. **La bandera y la ruta se mueven juntas, en el
  mismo cambio.**
- **`galon: true`** le pone a Creative el mismo galón `›` que a ICP & Oferta, que sí es real.
  `docs/estado actual/02-CREATIVE.md:34` lo dice sin rodeos: **nada en la interfaz le avisa a quien
  mira que lo que ve es inventado.** Es el argumento más corto para no dejar el prototipo puesto.

### C12-P01 · Si los tres roles del § 18.15 son tres pantallas o tres alcances

El repositorio tiene alcances por persona y una pantalla por departamento. El § 18.15 describe tres
vistas con contenidos distintos, no con filtros distintos. No está decidido si eso se resuelve con
tres pantallas, con una pantalla que cambie según el rol, o dejando que cada rol mire la pantalla del
departamento que le toca. **Creative no lo decide solo**: la vista de gerencia es de Executive y la
del media buyer es de Acquisition.
