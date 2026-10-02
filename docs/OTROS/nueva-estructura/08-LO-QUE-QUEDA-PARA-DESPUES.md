# Lo que queda para después

> Lo que el diseño y los documentos de producto piden y **esta fase no hace**, con su porqué. Cada uno tiene
> o tendrá su plan en `docs/OTROS/futuro/`.

## La fase de detalles, pantalla por pantalla

Esta fase cambia la estructura, el armazón y la paleta (`NE-01`, `NE-03`). La de detalles lleva cada
pantalla al diseño del lienzo:

- las cejas mono, los titulares de dos pesos y los botones en píldora;
- los degradados y resplandores que no se apagan por tokens;
- los radios escritos a mano;
- la caja «Pregúntale al cerebro sobre…» al pie de cada tablero, cuando haya cerebro;
- el patrón conversacional de las herramientas que crean algo: el agente a la izquierda y el entregable
  armándose a la derecha, empezando por ICP & Oferta;
- alinear con la cabecera del departamento el contenido que no es de operación (Acquisition y Leads
  Portal arrancan a 18 px del borde y la cabecera a 40), y los títulos de cada panel por dentro
  («Prospección Inteligente», «Espía de Anuncios»), que no coinciden con el nombre de su entrada (E11);
- devolverle a Tools, en algún lugar, el medidor de avance de sus tres herramientas, que se fue con su
  barra propia (E11);
- que la barra de pasos de ICP lleve al VSL en vez de decir dónde vive, cuando se sepa si la persona ve
  Tools (E11).

El inventario técnico queda en `brand/MIGRACION.md` (E5).

## Lo que se construye después

| pieza | por qué no ahora | plan |
|---|---|---|
| **Los permisos por herramienta** | Hoy `tools` y `analizadores` son un permiso cada uno (`NE-07`). Partirlos exige una migración para el `check` de pestañas, un guion que mude las pestañas de las personas con rol `usuario` y cambiar las rutas | `docs/OTROS/futuro/permisos-por-herramienta.md` |
| **El cerebro** | El chat del inicio no tiene modelo. Hace falta un modelo con herramientas **de sólo lectura** sobre las funciones que ya miden en `lib/negocio/`, con la sesión y la organización de cada persona, que sólo ofrezca lo que sus pestañas permiten. Las conversaciones se guardan en tablas nuevas con seguridad por filas forzada. Queda por decidir quién paga el modelo | `docs/OTROS/futuro/el-cerebro.md` |
| **La lista de CONVERSACIONES** | Es el historial del cerebro | con el cerebro |
| **La Reunión de hoy** | Sus temas tienen que salir de reglas medibles sobre la data real —gasto en cero, caída de la entrada, citas sin asistencia, una objeción que crece—, calculadas cada mañana | con el cerebro |
| **El comentario del cerebro en cada departamento** | Lo escribe el cerebro | con el cerebro |
| **Las herramientas nuevas de Marketing**: Bio de Instagram, Guiones TOFU · MOFU · BOFU, Guiones de venta directa, Social Media Posting, Clon de IA | No existen; hoy son «Próximamente» (`NE-13`) | cada una cuando se construya, con el patrón conversacional |
| **Seguimiento de clientes** (Client Success) | No existe; hoy es «Próximamente» | cuando se construya |
| **Separar el Scraper de la Prospección** | Hoy el buscador queda en los dos lugares (`NE-20`) | fase de detalles |
| **Retirar el tema de la base** | La columna `usuarios.tema` y su ruta quedan dormidas (`NE-23`) | una migración, cuando no haga falta para nada |
| **El tema claro con los valores de la marca** | El bloque claro de `app/temas.css` quedó dormido con su paleta de antes (`NE-23`); la marca tiene su tema claro para documentos y PDFs | el día que un documento imprimible lo use |
| **El Plan de acción y las Señales** | Los van a producir agentes de IA | `docs/OTROS/futuro/plan-y-senales-de-acquisition.md` |

Las propuestas del documento de producto que todavía no están decididas (Selector de nicho, La Auditoría,
Máquina de contenido, Brief del closer, Indicadores de la garantía) no entran en ningún plan hasta que se
decidan.
