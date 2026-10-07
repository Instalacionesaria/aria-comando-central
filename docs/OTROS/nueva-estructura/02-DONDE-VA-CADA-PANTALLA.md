# Dónde va cada pantalla, y qué le cambia

Cada fila es una pantalla de la barra de hoy (`main` en `60f5d81`). La columna «qué le cambia por dentro»
dice lo que cambia **en esta fase**; lo que no dice, no cambia. El recolor de la marca (`03-LA-MARCA.md`)
les toca a todas por igual y no se repite en cada fila.

> **Las tablas y los ejemplos de este documento son de la primera edición** (2026-10-01): «Research › Espía
> de anuncios», «Analizador OB», lo que abre «Tools». Lo que la segunda edición cambió de lugar o de
> nombre está al final, en «La segunda edición».

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
y `components/analizadores/PanelDeAnalizadores.jsx:49`). En la estructura nueva sus pestañas viven en
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
  (que hasta E11 estaba arriba de todas las pestañas de Tools). Nace en E9, antes de que la barra lateral
  la ofrezca. Desde E11 la franja va arriba del Scraper y de Prospección, las dos que gastan saldo.
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

**Hecho el 2026-10-02 (E12).** `alcancePorDepartamento` (`lib/autorizacion/departamentos.ts`) reparte lo
que ya devuelve `alcanceOfrecible`, sin sacar ni agregar ninguna sección, y la ruta de los roles manda ese
agrupado (`app/api/admin/roles/route.ts`). El orden es el de la barra: el Inicio primero y sin título, los
departamentos, «Menú de la cuenta» con Ajustes, el Panel de Monitoreo e Incidentes, y al final «Ajustes»
con Usuarios y Empresas, las dos pestañas de Ajustes que no son de ningún departamento. Client Success no
aparece: su única sección, Analizadores, va en Sales, donde está su primera entrada. La casilla dice lo
que abre sólo cuando abre más de una cosa —Tools seis, Analizadores dos—, y el lector de pantalla lo oye
como descripción. Lo vigila `pruebas/codigo/195-el-alcance-por-departamento.test.ts`.

## Lo que se mueve de lugar, dicho en la pantalla

Cinco textos nombraban lugares que dejaron de existir, y se corrigieron en la etapa que movió las pantallas
(E11, el 2026-10-02; las citas son de antes de ese cambio, fijadas a su commit):

- la barra de pasos de ICP decía, del paso que sigue a los siete (el video de ventas o la página), que
  «vive en Tools» (`components/fundaciones/BarraDePasos.jsx:84-85@40f699a`): pasó a decir «Marketing ›
  Tu video de ventas», con el lugar sacado de la tabla de departamentos;
- el paso de mercado de ICP mandaba a «Tools → Mis Leads» (`components/fundaciones/PanelResearch.jsx:837-841@40f699a`
  y `components/fundaciones/PanelResearch.jsx:883@40f699a`): pasó a «Research › Mis Leads»;
- lo mismo le decía al agente de ICP la instrucción del paso (`lib/fundaciones/herramientas.ts:264@40f699a`) y
  el resumen que recibe el modelo (`lib/fundaciones/mercado.ts:370@40f699a` y
  `lib/fundaciones/mercado.ts:388@40f699a`), así que también lo decía el chat.

## La segunda edición (2026-10-02)

`09-LA-SEGUNDA-EDICION.md` cambia dónde se ven algunas de estas pantallas, sin tocar ninguna por dentro
(`NE-37`). Desde su etapa F1:

| pantalla | sección | dónde se ve |
|---|---|---|
| Creative | `creative` | Marketing › **Creative Insights**: el nombre de la sección cambió en su línea (`NE-47`) |
| Sales | `sales` | Sales › **Closing**: ídem |
| Leads Portal | `contacts` | Sales › **Leads › De GHL**: una sub-pestaña del grupo Leads (`NE-46`) |
| Tools › Espía y Scraper | `tools` | Research › **Radar** › Espía a tus competidores y Scraper |
| Tools › Tu página y Tu video de ventas | `tools` | Marketing › **Funnel** › Tu landing y Tu VSL |
| Tools › Mis Leads y Prospección en frío | `tools` | Sales › **Leads** › De Radar y Plan de prospección |
| Analizadores › HT y OB | `analizadores` | Sales › **Llamadas de venta** y Client Success › **Llamadas de onboarding** |

Y lo que dicen los textos: los que mandaban a «Research › Mis Leads» —el paso de mercado de ICP y lo que
lee su agente— y la bajada del Scraper, que decía sólo «Mis Leads», sacan el lugar de la tabla
(`lugarDe`), y dicen «Sales › Leads › De Radar»; el vacío de Mis Leads nombra el Scraper y el Plan de
prospección, que guardan ahí los dos.

En Ajustes › Usuarios (`NE-21`), lo que abre cada casilla lleva el grupo —«Tools» abre Research › Radar ›
Espía a tus competidores, …, Sales › Leads › Plan de prospección—, y la casilla lo dice también cuando
abre una sola cosa que la barra llama de otra forma: el Leads Portal abre Sales › Leads › De GHL
(`diceLoQueAbre`). Lo vigila `pruebas/codigo/195-el-alcance-por-departamento.test.ts`; los grupos, en la
barra y en `lugarDe`, `pruebas/codigo/196-los-grupos.test.ts`.
