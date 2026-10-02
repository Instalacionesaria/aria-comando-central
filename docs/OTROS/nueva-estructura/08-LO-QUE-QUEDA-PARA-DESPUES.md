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

### Del diseño de la segunda edición

El diseño «Comando Central · Simulación» (`09-LA-SEGUNDA-EDICION.md`) entra en la estructura y no por
dentro (`NE-37`). Lo que dibuja dentro de cada pantalla, con cifras de muestra, y la app no dice así:

- **Radar › Espía**: la búsqueda como una tarjeta, «Busca en Meta Ad Library», con el nicho y el país en
  píldoras; y una tarjeta «Saldo del scraper» dentro de Radar.
- **Acquisition**: cinco cifras arriba —inversión, contactos, clics a landing o VSL, agendados,
  calificados— y el costo por calificado de cada embudo (lead form ads, profile funnel, booking directo).
- **Conversion**: cuatro tarjetas —cuánto vale lo que dice la pantalla, por dónde entró la gente, cuántos
  abandonan el formulario, lo que la pantalla no puede medir—.
- **Conversation › Lead Flow**: «El recorrido del lead» —entraron al CRM, los escribimos, respondieron,
  agendaron— y «Cuánto se tarda» entre cada paso.
- **Creative Insights**: «Rendimiento de cada pieza», una lista por pieza con sus contactos y cuántos
  agendan, y «Lo que no se puede medir desde la API de GHL».
- **Funnel › Tu landing**: el patrón conversacional, con el «Prompt para AI Studio» armándose a la derecha.
- **Closing**: una tarjeta «Closers · Configura hasta 3 closers». Hoy eso está en Closer › Inicio, para
  quien administra.
- **Setter › Inicio**: ventas chicas, agendas propias, agendas del agente, asistencia y «Tu comisión».
- **Closer › Inicio**: ventas, acuerdos sin pagar, con cita agendada y asistencia.
- **Llamadas de venta y de onboarding**: «Sincronizar con tl;dv» y «Analizar transcripción» como botones
  píldora, y el vacío «Todavía no hay llamadas de … analizadas».
- **El Inicio**: la caja dice «Pregúntale al cerebro o pídele algo a un agente…»; no hay agentes todavía.
- **Las «Próximamente» que se abren**: en el diseño, cada una abre una página con lo que va a ser.
  Copywriter: «Un solo agente que escribe tu bio de Instagram, tus guiones TOFU · MOFU · BOFU y tus guiones
  de venta directa a partir de tu ICP y tu oferta». Content Studio: «Videos hechos con tu clon de IA y
  publicación en redes, en un solo lugar». Seguimiento de clientes: «El avance de cada cliente, alertas de
  riesgo y oportunidades de renovación y recompra». Acá siguen sin abrirse (`NE-13`).

## Lo que se construye después

| pieza | por qué no ahora | plan |
|---|---|---|
| **Los permisos por herramienta** | Hoy `tools` y `analizadores` son un permiso cada uno (`NE-07`). Partirlos exige una migración para el `check` de pestañas, un guion que mude las pestañas de las personas con rol `usuario` y cambiar las rutas | `docs/OTROS/futuro/permisos-por-herramienta.md` |
| **El cerebro** | El chat del inicio no tiene modelo. Hace falta un modelo con herramientas **de sólo lectura** sobre las funciones que ya miden en `lib/negocio/`, con la sesión y la organización de cada persona, que sólo ofrezca lo que sus pestañas permiten. Las conversaciones se guardan en tablas nuevas con seguridad por filas forzada. Queda por decidir quién paga el modelo | `docs/OTROS/futuro/el-cerebro.md` |
| **La lista de CONVERSACIONES** | Es el historial del cerebro | con el cerebro |
| **La Reunión de hoy** | Sus temas tienen que salir de reglas medibles sobre la data real —gasto en cero, caída de la entrada, citas sin asistencia, una objeción que crece—, calculadas cada mañana | con el cerebro |
| **El comentario del cerebro en cada departamento** | Lo escribe el cerebro | con el cerebro |
| **Las herramientas nuevas de Marketing**: Copywriter —Bio de Instagram, Guiones TOFU · MOFU · BOFU y Guiones de venta directa, en un solo agente— y Content Studio —Social Media Posting y el Clon de IA— | No existen; desde la segunda edición son dos «Próximamente» (`NE-13`, `NE-47`), y antes eran cinco | cada una cuando se construya, con el patrón conversacional |
| **Seguimiento de clientes** (Client Success) | No existe; hoy es «Próximamente» | cuando se construya |
| **Sales › Leads › Todos** (segunda edición) | Junta los contactos de GHL y los leads del scraper en una sola lista, con su origen y su etapa, las cifras por calidad de ICP y «Subir a HighLevel». Hoy son dos pantallas, cada una con su permiso; la lista junta exige decidir qué ve quien tiene uno solo | cuando se construya; hasta entonces, «Próximamente» (`NE-38`) |
| **Dream 100 y Enviar hallazgos a Copywriter** (segunda edición) | Seguir cuentas exige guardarlas y volver a buscarlas; mandar los hallazgos exige que exista Copywriter | con Copywriter; hasta entonces, dos notas «Próximamente» del Espía (`NE-41`) |
| **Separar el Scraper de la Prospección** | Hoy el buscador queda en los dos lugares (`NE-20`) | fase de detalles |
| **Retirar el tema de la base** | La columna `usuarios.tema` y su ruta quedan dormidas (`NE-23`) | una migración, cuando no haga falta para nada |
| **El tema claro con los valores de la marca** | El bloque claro de `app/temas.css` quedó dormido con su paleta de antes (`NE-23`); la marca tiene su tema claro para documentos y PDFs | el día que un documento imprimible lo use |
| **El Plan de acción y las Señales** | Los van a producir agentes de IA | `docs/OTROS/futuro/plan-y-senales-de-acquisition.md` |

Las propuestas del documento de producto que todavía no están decididas (Selector de nicho, La Auditoría,
Máquina de contenido, Brief del closer, Indicadores de la garantía) no entran en ningún plan hasta que se
decidan.
