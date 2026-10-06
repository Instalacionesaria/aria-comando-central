# F18 · El comentario de la cabecera

> Una línea por departamento, con la mascota de 28 px, a la derecha del título. Sale de reglas, sin modelo
> (`D-12`), y si no hay nada que decir no se dibuja nada. El diseño está en `04-LA-REUNION-Y-LA-CABECERA.md`.

| campo | valor |
|---|---|
| Tipo | EL CEREBRO (sin pregunta, sin modelo) |
| Lugar en el front | La cabecera de cada departamento (`components/CabeceraDeDepartamento.jsx`) |
| Estado | **Hecho** en AG15 el 2026-10-06 para Acquisition, Creative Insights, Conversion y Conversation. Research, Marketing y Sales quedan para después (`10`) |
| Modelo | Ninguno |
| Permisos | La capacidad de la sección abierta: lo sirve el GET de esa pantalla. Funciona sin llave |
| Código | `lib/agentes/cabecera.ts` (la prioridad y las fuentes), `lib/agentes/comentario-de-la-cabecera.ts` (del panel a la cabecera); lo sirven los GET de `app/api/acquisition`, `creative`, `conversion` y `auditoria` |

## La prioridad

1. Lo que falta configurar en el departamento, con lo que su ruta ya resuelve; el detalle de una credencial,
   sólo a quien tiene `credenciales.ver`.
2. La señal abierta más grave del departamento, si es crítica o alta.
3. Una regla medible que aplique al departamento.
4. Lo que falta en Fundaciones.
5. Nada.

## Ejemplos por departamento

| departamento | cuándo habla | ejemplo |
|---|---|---|
| Research | falta un paso del método | «Te falta un paso para cerrar tu método: el Mapa de proceso.» (Simulación) |
| Systems | una señal crítica o un dato que no llega | «Entraron 8 contactos desde el 14 de septiembre; la caída empieza el día en que se detuvo el gasto en Meta.» (Lienzo) |
| Marketing | falta un dato que hará salir «[COMPLETAR]» | «Saldrán marcadores [COMPLETAR] hasta que cargues tus videos.» (Simulación) |
| Sales | citas sin registrar | «15 citas pasadas esperan que registres si el prospecto se presentó.» (Lienzo) |
| Client Success | — | no habla: la frase de la Simulación es descriptiva y no dice nada medido |

Los ejemplos son la forma; las cifras salen siempre del dato.

## Requisitos

- **AG-F18-1 · La regla del silencio**: sin una de las cuatro fuentes, no se dibuja nada.
- **AG-F18-2 · Nunca escrito a mano**: un comentario fijo sería una cifra inventada con otra forma.
- **AG-F18-3 · No se dibuja en el teléfono.** Bajo delegación sí.

## Pruebas

242 (código: la prioridad, el silencio, la frescura, nada escrito a mano y nada en el teléfono) y 243 (base: los GET de Acquisition y de Conversation). La 194 sigue en verde: el comentario va después de las sub-pestañas.
