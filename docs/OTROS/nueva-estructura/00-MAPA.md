# La nueva estructura de Comando Central — mapa

> Plan del **2026-10-01**: la app deja de ordenarse por inteligencias y pasa a ordenarse como un área de
> growth, con **el Inicio al centro y cinco departamentos por función**, bajo la marca v2. Esta carpeta dice
> **todo lo que se va a hacer y cada cambio que va a haber, antes de tocar el código**. Prefijo de los
> requisitos: `NE-`.

---

## De dónde sale

- **Los documentos del equipo de producto del 2026-09-30**: el resumen de una página («Nueva organización»)
  y su detalle, con cada herramienta, su estado y el orden de implementación.
- **El lienzo de diseño «Comando Central — Departamentos por dentro»**: ocho pantallas a 1440 × 900
  (inicio, Research › ICP & Oferta, Systems › Acquisition, Marketing › Guiones, Sales › Closer,
  Client Success › Analizador OB, una respuesta con evidencia y el estado «no hay dato suficiente»).
- **El sistema de marca «ARIA» (Brandbook v2.0, septiembre 2026)**: tokens, Geist y Geist Mono, un solo
  acento cian, la mascota.
- **Lo que hay en el código hoy**, medido el 2026-10-01 sobre `main` en `60f5d81`.

La regla que ordena todo, del documento de producto: **Research define, Marketing crea, Systems mide, Sales
opera y Client Success retiene.** Ninguna pantalla que mide datos reales se borra: cambia de lugar.

## Las decisiones del 2026-10-01

Tomadas por el usuario después de leer el diseño y el código:

| id | tema | decisión |
|---|---|---|
| `NE-01` | Primero la estructura | Esta fase es la estructura y la estética del armazón. Los detalles de cada pantalla van en una fase posterior |
| `NE-02` | Base de la marca | Se integra primero el PR #2 `feature/brand-v2`, que ya instala los tokens, Geist, la mascota y los logos |
| `NE-03` | Alcance estético | El armazón (barra lateral, cabecera de departamento, inicio) se dibuja con el diseño nuevo, y **toda la app** pasa a la paleta y la tipografía de la marca **cambiando los valores de los tokens**. El interior de cada pantalla conserva su disposición |
| `NE-04` | El inicio | Diseño nuevo y honesto: mascota, saludo y la caja de chat, que dice que el cerebro llega en una etapa posterior. Sin tarjetas de «Reunión de hoy». La maqueta del Executive se retira |
| `NE-05` | Lo que no existe todavía | Se ve como «Próximamente», sin datos y sin abrirse. La lista de CONVERSACIONES y el contador de la Reunión **no se dibujan** |
| `NE-06` | Tema | Sólo oscuro, como pide el brandbook. Sale el botón de tema |
| `NE-07` | Permisos | Iguales que hoy. `tools` y `analizadores` siguen siendo un permiso cada uno; partirlos por herramienta es una fase posterior |
| `NE-08` | Scraper | Gana una pestaña propia en Research. Prospección en frío queda en Sales como hoy |
| `NE-09` | «Pregúntale al cerebro» | La barra de abajo y su panel con Cmd+K se retiran con la maqueta. Vuelven con el cerebro |
| `NE-10` | Colores con significado | Extensión sobria: éxito en un verde apagado, atención en el dorado de la marca, dinero en blanco, incidencias en coral; las 12 etapas del pipeline en tonos apagados que nunca saturan más que el cian |

Y decididas al planificar, corregibles si el usuario dice otra cosa: la sección `executive` se muestra como
**«Inicio»** (cambia el nombre, no la clave); los títulos propios de cada vista se ocultan debajo de la
cabecera de departamento; hay **un solo menú**, en el engranaje del pie; el saludo usa la **zona horaria de
la empresa**; el comentario del cerebro de la cabecera **no se dibuja** todavía.

## Índice

| archivo | qué dice |
|---|---|
| [01-LA-ESTRUCTURA.md](01-LA-ESTRUCTURA.md) | La barra lateral entera, los departamentos y sus entradas, el engranaje y quién ve qué |
| [02-DONDE-VA-CADA-PANTALLA.md](02-DONDE-VA-CADA-PANTALLA.md) | Cada pantalla de hoy, a dónde va y qué le cambia |
| [03-LA-MARCA.md](03-LA-MARCA.md) | El paso a la marca v2: PR #2, sólo oscuro, Geist, la paleta, lo que se aplana |
| [04-EL-INICIO.md](04-EL-INICIO.md) | El inicio honesto y todo lo que se retira con la maqueta |
| [05-LO-QUE-NO-CAMBIA.md](05-LO-QUE-NO-CAMBIA.md) | El contrato: claves, permisos, rutas y base, intactos |
| [06-LAS-ETAPAS.md](06-LAS-ETAPAS.md) | E0 a E13: qué toca cada una, sus pruebas, cómo se verifica y cómo se revierte |
| [07-LO-QUE-SE-ROMPE-EN-SILENCIO.md](07-LO-QUE-SE-ROMPE-EN-SILENCIO.md) | Cada riesgo, con la prueba que lo vigila |
| [08-LO-QUE-QUEDA-PARA-DESPUES.md](08-LO-QUE-QUEDA-PARA-DESPUES.md) | La fase de detalles y lo que se construye después |

## Estado

**Planificado el 2026-10-01.** E0 es esta carpeta. De E1 a E7 están hechas, todas el mismo día, y cada
etapa, al terminar, suma acá abajo su fila. Sus commits se leen en `git log --oneline`: el mensaje empieza «Nueva estructura E<n>:».

| etapa | estado |
|---|---|
| E0 · documentos | hecho, 2026-10-01 |
| E1 · el PR #2 de la marca | hecho, 2026-10-01 |
| E2 · la sesión entera | hecho, 2026-10-01 |
| E3 · sólo oscuro | hecho, 2026-10-01 |
| E4 · la tipografía | hecho, 2026-10-01 |
| E5 · la paleta y las superficies | hecho, 2026-10-01 |
| E6 · las citas | hecho, 2026-10-01 |
| E7 · el Inicio | hecho, 2026-10-01 |
| E8 · el modelo | hecho, 2026-10-01 |
| E9 · la navegación en React | hecho, 2026-10-01 |
| E10 · la barra lateral | hecho, 2026-10-02 |
| E11 · la cabecera del departamento | hecho, 2026-10-02 |
| E12 · Ajustes › Usuarios por departamento | hecho, 2026-10-02 |
