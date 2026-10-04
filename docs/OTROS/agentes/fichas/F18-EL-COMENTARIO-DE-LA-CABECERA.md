# F18 · El comentario de la cabecera

> Una línea por departamento, con la mascota de 28 px, a la derecha del título. Sale de reglas, sin modelo
> (`D-12`), y si no hay nada que decir no se dibuja nada. El diseño está en `04-LA-REUNION-Y-LA-CABECERA.md`.

| campo | valor |
|---|---|
| Tipo | EL CEREBRO (sin pregunta, sin modelo) |
| Lugar en el front | La cabecera de cada departamento (`components/CabeceraDeDepartamento.jsx`) |
| Estado | **Se construye** en AG15 |
| Modelo | Ninguno |
| Permisos | La capacidad de la sección abierta: lo sirve el GET de esa pantalla. Funciona sin llave |
| Código | `lib/agentes/cabecera.ts` |

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

230 de `08`, y la 194 cambia: el comentario es nada cuando no hay nada.
