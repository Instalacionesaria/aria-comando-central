# F17 · La Reunión de hoy

> Los tres temas del día en el Inicio y su contador en la barra. Salen de señales y reglas medibles; el modelo
> sólo ordena y redacta (`D-13`). El diseño entero está en `04-LA-REUNION-Y-LA-CABECERA.md`.

| campo | valor |
|---|---|
| Tipo | EL CEREBRO (sin pregunta) |
| Lugar en el front | La cinta «DE LA REUNIÓN DE HOY · HH:MM» del Inicio y la fila «Reunión de hoy» de la barra |
| Estado | **Se construye** en AG15: el servidor (las reglas, la medida y la pasada) hecho el 2026-10-06 |
| Modelo | Ninguno para elegir los temas. `claude-sonnet-5-5` para ordenarlos y redactarlos, si hay llave |
| Permisos | Leer: `tablero.ver` (la ruta del Inicio). Se filtra por las secciones de cada persona |
| Código | `lib/agentes/reunion/reglas.ts` (las reglas del catálogo), `temas.ts` (la medida y los temas), `guardar.ts` (el único escritor); la pasada, en `lib/agentes/detectores/correr.ts` |
| Tabla | `negocio.reuniones_del_dia` (`075`) |

## Qué lee

Las señales que requieren validación ejecutiva y las reglas de la Reunión (`04`, `AG-70`): sin entrega,
caída de la entrada, citas sin registrar, objeción frecuente, llamadas sin vínculo.

## Qué produce

Todos los temas candidatos del día, ordenados, cada uno con su etiqueta, su origen, su evidencia y su propio
texto. Al leer, se filtran por persona y se toman tres.

## Requisitos

- **AG-F17-1 · Un texto por tema, sin referencias cruzadas.**
- **AG-F17-2 · Se filtra antes de tomar tres.**
- **AG-F17-3 · Tocar un tema abre una conversación** sin llamar al modelo hasta la primera pregunta.
- **AG-F17-4 · Sin llave, plantillas.**
- **AG-F17-5 · Las reglas de la Reunión son umbrales provisionales** del mismo catálogo, y se firman.

## Pruebas y evaluación

238 (código) y 239 (base) de `08`; F17 en `07`, `AG-102`.
