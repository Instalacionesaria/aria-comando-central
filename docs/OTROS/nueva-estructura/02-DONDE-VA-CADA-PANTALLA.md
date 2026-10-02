# Dónde va cada pantalla, y qué le cambia

Cada fila es una pantalla de la barra de hoy (`main` en `60f5d81`). La columna «qué le cambia por dentro»
dice lo que cambia **en esta fase**; lo que no dice, no cambia. El recolor de la marca (`03-LA-MARCA.md`)
les toca a todas por igual y no se repite en cada fila.

| hoy en la barra | sección | pasa a | qué le cambia por dentro |
|---|---|---|---|
| Executive | `executive` | **el Inicio** («Nueva conversación») | Se reemplaza entera: la maqueta se retira y entra el inicio honesto (`04-EL-INICIO.md`). Se muestra como «Inicio» |
| Leads Portal | `contacts` | Sales | Nada |
| ICP & Oferta | `icp` | Research | Nada: conserva sus siete pasos y su agente |
| Acquisition | `acquisition` | Systems | Nada |
| Creative | `creative` | Marketing | Nada |
| Conversion | `conversion` | Systems | Nada |
| Conversation | `conversation` | Systems | Nada: conserva sus cuatro pestañas (Lead Flow, Appointment Flow, Auditoría, Prompts) |
| Sales | `sales` | Sales | Nada |
| Setter | `setter` | Sales | Nada: conserva sus pestañas |
| Closer | `closer` | Sales | Nada: conserva sus pestañas |
| Analizadores | `analizadores` | **se parte**: HT → Sales, OB → Client Success | Pierde su barra HT/OB: la pestaña la elige la entrada del departamento (`NE-19`) |
| Tools | `tools` | **se reparte en tres departamentos** | Pierde su barra propia; la pestaña la elige la entrada (`NE-19`). Gana la pestaña **Scraper** (`NE-20`) |
| Panel de Monitoreo | `monitoreo` | el engranaje (sólo desde la principal) | Nada |
| Incidentes | `incidentes` | el engranaje (sólo desde la principal) | Nada |
| Ajustes | `credenciales` | el engranaje | Nada: conserva Credenciales, Empresas y Usuarios. Usuarios agrupa los permisos por departamento (`NE-21`) |

## `NE-19` · Tools y Analizadores, partidos sin partir el permiso

Son **una sección cada uno**, con sus pestañas como estado interno (`components/fundaciones/Fundaciones.jsx`
y `components/analizadores/PanelDeAnalizadores.jsx:45`). En la estructura nueva sus pestañas viven en
departamentos distintos, así que **la pestaña la elige la navegación**:

- abrir «Research › Espía de anuncios» es abrir la vista `tools` **pidiéndole** la pestaña `espia`;
- abrir «Client Success › Analizador OB» es abrir `analizadores` pidiéndole la pestaña OB.

La vista sigue siendo **una sola** y sigue montada, pero en Tools **el panel de cada pestaña se vuelve a
montar** al cambiar de pestaña (`components/fundaciones/Fundaciones.jsx`): es así hoy y no cambia. Lo que
sobrevive es el trabajo del servidor —un escaneo en vuelo sigue, y el Scraper lo retoma al volver, con lo
escrito en su formulario—; lo dibujado, no. Analizadores no se vuelve a montar: conserva todo menos la
lista (`NE-35`). Lo que cambia es quién elige la pestaña. Por eso su barra propia se va: sus pestañas pasan a
ser la fila de pestañas del departamento.

El permiso no cambia (`NE-07`): quien tiene `tools` ve las seis entradas en sus tres departamentos.

## `NE-20` · El Scraper gana su pestaña

Hoy el buscador vive **dentro** de Prospección en frío (`components/tools/PanelProspeccion.jsx:165`), que
lo usa para armar el plan. En el diseño, el Scraper es de Research y la Prospección de Sales.

- **Research › Scraper**: pestaña nueva de `tools` con el buscador y, arriba, la franja del saldo de leads
  (que hoy está en la cabecera de Tools). Nace en E9, antes de que la barra lateral la ofrezca.
- **Sales › Prospección en frío**: queda **como está**, con el buscador adentro.

El buscador queda en dos lugares hasta la fase de detalles, que decidirá si la Prospección lo pierde y
toma los leads de «Mis Leads».

## `NE-21` · Ajustes › Usuarios, agrupado por departamento

Hoy las casillas de pestañas de una persona se agrupan como el menú viejo (Inteligencia, Operación…). Pasan
a agruparse **por departamento**, cada sección **en un solo grupo** —el departamento de su primera entrada—,
con la lista de lo que abre:

> **Tools** · abre Research › Espía de anuncios · Research › Scraper · Research › Mis Leads ·
> Marketing › Tu página · Marketing › Tu video de ventas · Sales › Prospección en frío

Así queda claro, antes de marcarla, que una sola casilla abre seis entradas en tres departamentos. Las
reglas que hoy vigila `pruebas/codigo/101-alcance.test.ts` (cada sección una vez, ningún grupo vacío, sólo
lo que el rol puede) siguen iguales.

## Lo que se mueve de lugar, dicho en la pantalla

Hoy cinco textos nombran lugares que dejan de existir, y se corrigen en la etapa que mueve las pantallas
(E11):

- la barra de pasos de ICP dice, del paso que sigue a los siete (el video de ventas o la página), que
  «vive en Tools» (`components/fundaciones/BarraDePasos.jsx:84-85`): pasa a decir «Marketing»;
- el paso de mercado de ICP manda a «Tools → Mis Leads» (`components/fundaciones/PanelResearch.jsx:837-841`
  y `:883`): pasa a «Research › Mis Leads»;
- lo mismo le dice al agente de ICP la instrucción del paso (`lib/fundaciones/herramientas.ts:264`) y el
  resumen que recibe el modelo (`lib/fundaciones/mercado.ts:370` y `:388`), así que también lo dice el chat.
