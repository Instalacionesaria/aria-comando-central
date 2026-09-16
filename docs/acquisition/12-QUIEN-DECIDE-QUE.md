# Acquisition — qué puede decidir solo, qué no, y quién ve qué

> Sale del DOCUMENTO FUNCIONAL, § 18.8, 18.9, 18.10, 18.15 y 18.18. El documento vive fuera del
> repositorio; las citas son por número de sección.
> El prototipo resolvió una parte de esto a su manera —separa «Señales detectadas» del «Plan de
> acción»— y eso está en `06-SENALES-Y-PLAN-DE-ACCION.md`.

---

## A12-01 · Las once responsabilidades, y las nueve que NO lo son

El § 18.8 es la sección que más acota el departamento, y las dos listas hay que leerlas juntas.

### Es responsable de

Explicar qué ocurre dentro de Meta · detectar cambios relevantes · identificar aumentos o caídas de
costos · detectar fatiga · detectar anomalías · comparar audiencias · comparar anuncios según
métricas de adquisición · identificar problemas de entrega · monitorear la calidad de atribución ·
emitir recomendaciones operativas locales · compartir conclusiones con otros departamentos.

### NO es responsable de

Declarar cuál anuncio es el mejor para el negocio completo · calcular revenue real · calcular CAC
real · calcular ROAS real · evaluar closers · evaluar conversaciones · tomar decisiones estratégicas
entre áreas · escalar presupuesto sin contexto global · **apagar campañas basándose únicamente en
métricas de Meta**.

---

**Las dos listas no son simétricas, y ahí está el diseño.** Lo que puede hacer está todo en
indicativo —«explicar», «detectar», «comparar»—; lo que no puede hacer está todo en la forma de una
CONCLUSIÓN o una ACCIÓN: «declarar», «calcular», «decidir», «escalar», «apagar».

Acquisition produce observaciones. **Las conclusiones de negocio y las acciones son de otro.**

La frase que lo explica está en § 18.1: *«No decide por sí solo qué anuncio genera más dinero para el
negocio, porque esa conclusión requiere cruzar adquisición, ICP, agendamientos, ventas y revenue.»*

---

## A12-02 · Las nueve recomendaciones que SÍ puede mostrar sola

El § 18.9 las enumera, y las nueve tienen la misma forma: **empiezan con un verbo de investigación,
no de acción.**

1. Revisar una caída anormal del CTR.
2. Investigar un aumento del CPM.
3. Probar una audiencia.
4. Crear variantes por fatiga.
5. Revisar un anuncio rechazado o limitado.
6. Revisar solapamiento de audiencias.
7. Investigar diferencias entre leads de Meta y GHL.
8. **Revisar un creativo con buena retención y bajo CTR.**
9. **Revisar un creativo con buen CTR y mala retención.**

> **«Estas recomendaciones son visibles para el responsable de Ads. Executive Intelligence también
> las recibe y decide cuáles deben convertirse en prioridades estratégicas.»** (§ 18.9)

O sea: **se publican sin esperar aprobación**, y Executive las ve igual. Es la misma regla del § 2.3
del documento, que ya se aplica en Conversation.

**Las dos últimas son un par y conviene no separarlas.** «Buena retención y bajo CTR» y «buen CTR y
mala retención» son los dos cuadrantes fuera de la diagonal, y las dos necesitan métricas de video
que hoy no existen. Son, además, la evidencia de que el documento quiere que retención y CTR se
publiquen **cruzadas** y no en columnas separadas.

---

## A12-03 · Las nueve acciones que requieren validación ejecutiva

El § 18.10:

Duplicar presupuesto · reducir inversión · apagar anuncios · mover presupuesto entre campañas ·
declarar un anuncio ganador del negocio · cambiar oferta · cambiar landing · cambiar posicionamiento ·
**escalar únicamente por CPL**.

> **«Estas decisiones requieren contexto de Business Intelligence y, cuando corresponda, Creative,
> Conversion y Executive.»** (§ 18.10)

**La novena es la que más se va a violar**, porque es la más natural: el CPL es la cifra más visible
de la pantalla y escalar por ella es el reflejo del oficio. El documento la prohíbe explícitamente y
da el caso que la justifica en el § 18.11 (caso 1): *«El anuncio A tiene el menor CPL y el mayor
volumen de leads» / «El anuncio A tiene baja tasa de cierre y bajo revenue» / «No escalar.»*

**Requisito que sale de ahí, y que ninguna pantalla tiene todavía:** cuando la interfaz ofrezca
ordenar anuncios por CPL, tiene que decir al lado que ése no es el orden del negocio. Un ranking sin
esa línea es la recomendación prohibida, dibujada.

---

## A12-04 · Tres roles, y cada uno ve otra cosa

El § 18.15 no dice «hay permisos»: dice **qué ve cada rol**, y las tres listas son distintas entre
sí.

### Media buyer

Rendimiento por campaña, ad set y anuncio · alertas · recomendaciones locales · tareas · evidencia ·
evolución de cambios.

### Responsable creativo

Anuncios con mejor retención · creativos fatigados · hooks con mejor comportamiento · solicitudes de
nuevas variantes.

### Gerencia

Estado general de adquisición · riesgos · gasto · eficiencia · calidad de atribución · iniciativas
pendientes · impacto de cambios.

---

**Lo que la partición revela**, y es un requisito de producto y no de permisos:

- **El media buyer es el único que ve el detalle por entidad.** Los otros dos ven agregados.
- **El responsable creativo ve cuatro cosas y las cuatro son de video y fatiga** — o sea que su
  pantalla depende entera del `Creative Performance Analyzer` (`11-LOS-SEIS-COMPONENTES.md`), que hoy
  no existe. Su vista es **la más lejana de construirse**, aunque parezca la más chica.
- **Gerencia ve «calidad de atribución» y ninguno de los otros dos.** Es la única de las siete cosas
  de su lista que no es de dinero ni de estado, y está ahí porque es lo que dice **cuánto valen las
  otras seis**.
- **«Impacto de cambios» y «evolución de cambios» aparecen en dos de las tres listas**, así que el
  § 18.18 no es un anexo: es parte de la vista de dos roles.

**Estado hoy.** El repositorio tiene roles y alcance por sección (`lib/autorizacion/`), pero la
sección `acquisition` se declara con `sinOperacionesTodavia: true`, así que no hay ninguna vista que
partir. Cuando la haya, **las tres vistas no son tres filtros del mismo tablero**: son tres tableros.

---

## A12-05 · Cada cambio en Meta se vincula a una tarea, y se mide dos veces

El § 18.18 da la plantilla:

```text
Cambio:              Nueva audiencia para campaña X.
Hipótesis:           Reducir CPL sin disminuir calidad.
Métrica local:       CPL.
Métricas globales:   ICP, booking rate, show rate, close rate y revenue.
Responsable:         Media buyer.
Periodo:             14 días.
Resultado local:     CPL −18 %.
Resultado global:    Pendiente de Business Intelligence.
```

> **«Acquisition evalúa el efecto local. Business evalúa el efecto global. Executive decide si se
> mantiene, amplía, ajusta o revierte.»** (§ 18.18)

**La plantilla tiene una hipótesis con dos mitades y eso es deliberado**: «reducir CPL **sin
disminuir calidad**». La métrica local puede mejorar mientras la global empeora, y el ejemplo lo
dibuja — CPL −18 % con el resultado global todavía pendiente. Publicar el −18 % como un éxito antes
de que Business conteste es exactamente lo que el § 18.10 prohíbe.

**Requisito que sale de ahí:** un resultado local no se publica como resultado a secas. Lleva su
estado de medición global al lado, aunque ese estado sea «pendiente».

Los estados son los del § 14, compartidos con Conversation:

```text
Propuesta → Aprobada → Asignada → En progreso → Implementada → En medición → Validada / Iterar / Revertir
```

Y la regla del § 14 que vale igual acá: **«El sistema debe diferenciar entre correlación y
causalidad.»** Con su ejemplo, que es el tono exacto que hay que usar: *«El show rate aumentó después
del cambio. Existe una asociación positiva, pero todavía no hay evidencia suficiente para atribuir
toda la mejora al nuevo mensaje.»*
