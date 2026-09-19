# El Creative Performance Analyzer y el Anomaly & Fatigue Detector

> Fuente: `CC_Arquitectura_Funcional.md` § 18.3, § 18.12 y § 18.13. Citas literales por línea.
>
> El § 18.3 (`:1162-1175`) declara seis componentes internos de Acquisition Intelligence, y **dos de
> los seis son la materia de Creative**:
>
> ```
> Acquisition Intelligence
> │
> ├── Meta Data Collector
> ├── Campaign Performance Analyzer
> ├── Creative Performance Analyzer
> ├── Audience Performance Analyzer
> ├── Anomaly & Fatigue Detector
> └── Attribution Monitor
> ```
>
> `docs/acquisition/11-LOS-SEIS-COMPONENTES.md:23-25` anotó que **ninguno existe**, y que tres de los
> seis *«producen su propia salida estructurada, con esquema propio, y no son "una vista más de la
> tabla"*». Dos de esos tres son éstos.

---

## 1 · El Creative Performance Analyzer

### C11-01 · Qué es, y qué NO es

**Rastro** · § 18.12 (`:1433-1447`), transcrito entero en `C10-01`.
**Estado** · **Cuatro de sus nueve indicadores se pueden construir hoy**: retención inicial como hook
rate, CTR (y ahora link CTR), CPL y fatiga por caída de CTR. Dos quedan afuera por aritmética
(frecuencia, y con ella la fatiga por frecuencia) y tres no tienen fuente (caídas de retención,
formato, duración, placement).

**Y su límite es la mitad del componente**: *«No reemplaza a Creative Intelligence, que interpreta
hook, body, CTA, guion y nuevas variantes.»* Esa mitad exige leer la pieza, y **la pieza no está
guardada en ninguna de las tablas de `negocio`** (`C7-11`).

### C11-02 · Dónde vive el código, y por qué no es una pregunta de organigrama

**Qué es** · El § 18.3 lo pone dentro de Acquisition. En este repositorio, `lib/negocio/` no tiene
carpetas por departamento: los módulos se llaman por lo que contestan y las rutas los importan.
**Estado** · Así que el componente es **un módulo de `lib/negocio/` parametrizado por grano**:
Acquisition lo llama al grano del anuncio, Creative al grano de la pieza, y *«Acquisition entrega a
Creative»* del § 18.16 es un `import`. Ver `C7-03` y `C7-05`.

**El síntoma de que la parametrización se partió** conviene dejarlo escrito por adelantado: la primera
vez que aparezca una rama por grano **dentro del cálculo** —y no sólo en la expresión de
agrupación—, hay que separar las dos funciones y bajar lo compartido a ayudantes puros. Una función
con un `if` de grano adelante es peor que dos funciones honestas.

### C11-03 · Su salida es estructurada, no una tabla más

**Qué es** · Un veredicto por pieza, con su evidencia: la cifra, su población, su cobertura y su
ventana.
**Rastro** · `docs/acquisition/11-LOS-SEIS-COMPONENTES.md:23-25`.
**Estado** · Es la diferencia entre este componente y la tabla de `03-LA-BIBLIOTECA.md`. La tabla
ordena; el componente **afirma algo sobre una pieza** y tiene que poder defenderlo. Hoy sólo puede
afirmar dos cosas: «está bajo el promedio de su etapa» (`C6-04a`) y «su CTR está cayendo» (`C2-24`).

---

## 2 · El Anomaly & Fatigue Detector

### C11-04 · Las diez detecciones del § 18.13, y cuáles se pueden hacer

`:1449-1469`, literal:

```
Debe detectar:

- Caídas inusuales de CTR.
- Aumentos abruptos de CPM.
- Aumento sostenido de CPL.
- Frecuencia alta.
- Spend sin crecimiento proporcional.
- Diferencias entre leads de Meta y la base.
- Anuncios sin entrega.
- Concentración excesiva de presupuesto.
- Cambios bruscos por ad set.
- Cambios de fase de aprendizaje.
```

| detección | estado |
|---|---|
| **Caídas inusuales de CTR** | **se puede hoy**, con los 32 días ya guardados. Medido: `Evoluciona native` de 2,76 % a 1,98 % en 20 días (`C2-24`) |
| **Aumentos abruptos de CPM** | **se puede**: el CPM se deriva de gasto e impresiones, las dos sumables |
| **Aumento sostenido de CPL** | **se puede**: gasto y contactos por ventana |
| Frecuencia alta | **no se agrega** (`C2-05`). Por día y por anuncio sí; «alta» necesitaría un umbral y no hay |
| **Spend sin crecimiento proporcional** | **se puede**: es gasto contra contactos en el tiempo |
| Diferencias entre leads de Meta y la base | **depende de `C14-P02`.** La `050` lo declaró muerto midiendo el campo `leads`; `results.lead` es otro campo y podría revivirlo |
| **Anuncios sin entrega** | **se puede, y ya está resuelto**: `costoDelAnuncio` publica *«No entregó ni un día de esta ventana. No es que gastara cero: no se mostró»* |
| **Concentración excesiva de presupuesto** | **se puede**: medido, `agendamiento - yaping - 23/07` tiene $1.301 de $3.511, o sea el 37 % en una pieza |
| Cambios bruscos por ad set | **se puede al grano del conjunto**, que es de Acquisition, no de Creative |
| Cambios de fase de aprendizaje | **no llega**: el estado del anuncio no viene (`C14-07`, `C8-24`) |

**Seis de las diez se pueden construir**, y cuatro de esas seis son de Acquisition por grano, no de
Creative. Las que le toca publicar a Creative son la caída de CTR y la concentración de presupuesto
por pieza.

### C11-05 · El esquema de la alerta: catorce campos

`:1471-1481`:

```
alert_id / entity_type / entity_id / metric / baseline / current_value / change_percentage /
period_start / period_end / severity / confidence / possible_causes / recommended_review / created_at
```

**Estado** · **Una alerta no es una cifra: es una entidad persistida**, y eso cambia todo.

| campo | qué implica |
|---|---|
| `alert_id`, `created_at` | **tiene que sobrevivir a la recarga**, o no puede decir «esto apareció el martes» |
| `entity_type`, `entity_id` | la alerta apunta a una pieza, un anuncio, un conjunto o una campaña: el tipo es parte de la llave |
| `baseline`, `current_value`, `change_percentage` | **la evidencia viaja con la alerta**, no se recalcula al mirarla. Si el baseline se recalcula, la alerta de ayer cambia de razón sola |
| `period_start`, `period_end` | la ventana sobre la que se detectó, que no es la que el usuario está mirando |
| `severity`, `confidence` | **dos escalas que nadie definió** — y `confidence` sobre 7 días de serie no puede ser la misma que sobre 26 |
| `possible_causes` | plural, y es el § 2.6: la alerta ofrece hipótesis, no un diagnóstico |
| `recommended_review` | **qué revisar, no qué hacer.** Coincide con `C6-10`: Creative propone |

### C11-06 · No hay tabla, y el detector no puede ser un cálculo de la pantalla

**Qué es** · Si la alerta se calcula al dibujar, no tiene `created_at` ni `alert_id`, y entonces no
existe: es una cifra con un color.
**Estado** · **No hay tabla de alertas en `negocio`.** Es el trabajo real de este componente y es
mayor que la pantalla que lo mostraría. Queda declarado, no resuelto acá.

### C11-07 · Los umbrales son el pendiente que lo bloquea

**Rastro** · § 18.19 pendiente 9 (`:1649`): *«Definir umbrales iniciales de anomalía y fatiga.»*
**Estado** · Sin umbral no hay «inusual», no hay «abrupto», no hay «alta» y no hay «excesiva» — y las
cuatro palabras están en la lista de detecciones. **Cuatro de las diez detecciones son
literalmente indefinibles hasta que alguien fije un número.**

Y la base de serie medida hace el problema concreto: **5 piezas con ≥ 14 días, 16 con ≥ 7**. Un umbral
elegido sobre siete días de serie y dos mitades de tres días y medio se dispara por ruido. Las dos
salidas honestas son declarar el umbral como provisional o publicar la serie sin veredicto
(`C2-P01`).

### C11-P01 · Cómo se mide el efecto de un cambio

El § 18.12 y el § 12 piden que cada cambio en Meta se vincule a una tarea y **se mida dos veces**:
antes y después. `docs/acquisition/12-QUIEN-DECIDE-QUE.md` lo numeró como `A12-05`.

Con Creative de sólo lectura, el cambio lo hace una persona en Meta y el producto no lo sabe. **No hay
forma de fechar el «antes» sin que alguien lo declare**, y no hay entidad donde declararlo. Queda
abierta, y es la misma carencia que `C6-P01`: falta el objeto «tarea».
