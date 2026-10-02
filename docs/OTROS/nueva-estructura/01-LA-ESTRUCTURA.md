# La estructura: la barra lateral, los departamentos y quién ve qué

## `NE-11` · La barra lateral, de arriba abajo

260 px de ancho, sobre el fondo de la marca, con líneas de 1 px y sin sombras (lienzo «Departamentos por
dentro», todas las pantallas):

1. **El logotipo de ARIA** (el archivo de la marca, nunca escrito con una fuente) y, a su derecha, **el
   selector de empresa** como píldora. Es el `SelectorDeEmpresa` de hoy: sólo se abre para quien puede
   cambiar de empresa.
2. **«Nueva conversación»**, botón píldora: abre el **Inicio** (la sección `executive`).
3. **«Reunión de hoy»**: se ve como **«Próximamente»**, sin contador (`NE-05`). Sus temas tienen que salir
   de reglas sobre datos reales, y eso todavía no existe.
4. **DEPARTAMENTOS**, rótulo mono en mayúsculas, y debajo los cinco departamentos como acordeones. Cada uno
   se despliega y lista sus entradas. **Sólo queda abierto el que está en uso.**
5. **CONVERSACIONES**: **no se dibuja** en esta fase. Es el historial de las conversaciones con el cerebro,
   y el cerebro todavía no existe.
6. **El pie**: avatar con las iniciales, el nombre, el rol en mono —**ADMIN** o **USUARIO**— y **el
   engranaje**, que abre el único menú de la cuenta (`NE-14`).

## `NE-12` · Los departamentos y sus entradas

| departamento | ceja de la cabecera | entradas, en orden → sección de hoy [pestaña] |
|---|---|---|
| **Research** | `RESEARCH · SE INSTALA EN FOUNDATIONS` | ICP & Oferta → `icp` · Espía de anuncios → `tools` [espia] · **Scraper** → `tools` [scraper, nueva] · Mis Leads → `tools` [mis-leads] |
| **Systems** | `SYSTEMS · SE INSTALA EN SYSTEMS` | Acquisition → `acquisition` · Conversion → `conversion` · Conversation → `conversation` |
| **Marketing** | `MARKETING · SE INSTALA EN GROWTH` | Creative → `creative` · Bio de Instagram · Guiones TOFU · MOFU · BOFU · Guiones de venta directa · Social Media Posting · Clon de IA · Tu página → `tools` [landing] · Tu video de ventas → `tools` [VSL] |
| **Sales** | `SALES · SE INSTALA EN SALES` | Sales → `sales` · Leads Portal → `contacts` · Setter → `setter` · Closer → `closer` · Analizador HT → `analizadores` [HT] · Prospección en frío → `tools` [prospección] |
| **Client Success** | `CLIENT SUCCESS · SE INSTALA EN SCALE` | Analizador OB → `analizadores` [OB] · Seguimiento de clientes |

Las entradas sin sección son **«Próximamente»** (`NE-05`): Bio de Instagram, los dos creadores de guiones,
Social Media Posting, Clon de IA y Seguimiento de clientes.

La ceja dice dónde se instala cada departamento en el programa (Foundations, Systems, Growth, Sales,
Scale), como en el diseño. Las cinco inteligencias **conservan sus nombres**: Acquisition, Creative,
Conversion, Conversation y Sales.

## `NE-13` · Una entrada «Próximamente»

- Se ve en su departamento con la palabra «Próximamente», en el tono atenuado de la marca.
- **No se puede abrir**: no lleva ninguna acción ni el atributo que la navegación busca.
- **Nunca hace aparecer un departamento sola.** Un departamento cuyas entradas visibles son todas
  «Próximamente» no se dibuja.
- No muestra datos de ejemplo. Cuando la herramienta se construya, la entrada pasa a apuntar a su sección.

## `NE-14` · El engranaje del pie

Un solo menú, con lo que no es de ningún departamento:

| entrada | sección | quién la ve |
|---|---|---|
| Ajustes | `credenciales` | quien tiene `credenciales.ver` (administración) |
| Panel de Monitoreo | `monitoreo` | sólo desde la organización principal, con su capacidad |
| Incidentes | `incidentes` | sólo desde la organización principal, con su capacidad |
| *separador* | | |
| Cambiar contraseña | | todos |
| Cerrar sesión | | todos |

Hoy Monitoreo e Incidentes ya forman su propio grupo «Administración» del menú (`60f5d81`), y Ajustes vive
en el pie. La estructura nueva los junta en el engranaje. «Cambiar contraseña» sigue antes de «Cerrar
sesión» (lo exige `pruebas/codigo/140-boton-de-mi-password.test.ts`).

Si a alguien no le toca ninguna de las tres primeras, el menú se abre igual con las dos últimas.

## `NE-15` · ADMIN o USUARIO

El pie dice **USUARIO** a quien tiene el alcance restringido por pestañas —el rol `usuario`— y **ADMIN** a
todos los demás. El servidor manda **un booleano**, `restringido`, y **nunca el nombre del rol**: el
proyecto prohíbe decidir nada por el nombre de un rol (`pruebas/codigo/30-portero.test.ts`). Si un día
existiera un rol sin restricción y sin poderes de administración, el pie diría ADMIN; ese día el rótulo
pasa a salir de una capacidad.

## `NE-16` · Quién ve qué

**Exactamente lo mismo que hoy** (`NE-07`). La lista de lo que cada persona ve sigue saliendo de
`menuVisible()` (`lib/autorizacion/secciones.ts:820`), que aplica la capacidad, el alcance por pestañas y la
regla de la organización principal. La estructura nueva **no vuelve a decidir permisos**: reparte lo que
`menuVisible()` ya dejó pasar: `lib/autorizacion/departamentos.ts` recibe el menú y nada más.

| si la persona tiene… | ve… |
|---|---|
| `tools` | Research › Espía, Scraper y Mis Leads · Marketing › Tu página y Tu video de ventas · Sales › Prospección en frío |
| `analizadores` | Sales › Analizador HT · Client Success › Analizador OB |
| sólo `closer` | Sales › Closer, y nada más |
| `executive` | «Nueva conversación» (y el Inicio) |
| ninguna sección de un departamento | ese departamento no se dibuja |

Partir `tools` y `analizadores` por herramienta —que quien prospecta no vea la landing— es de la fase
posterior (`08-LO-QUE-QUEDA-PARA-DESPUES.md`).

## `NE-17` · La plantilla de un departamento

Del lienzo, pantallas de Research, Systems, Marketing, Sales y Client Success:

1. **La ceja**, mono y en mayúsculas (`NE-12`).
2. **El título**: el nombre de la entrada abierta, en Geist 500.
3. **A la derecha, el comentario del cerebro** con la mascota de 32 px: **no se dibuja** en esta fase. El
   cerebro no existe, y un comentario escrito a mano sería una cifra inventada con otra forma.
4. **La fila de pestañas**: las entradas del departamento que la persona ve, con la abierta subrayada en
   cian. Las «Próximamente» aparecen deshabilitadas.
5. **Debajo, la pantalla de siempre.**

Los títulos que cada pantalla trae por dentro (su `h2` y su bajada) se **ocultan** con una sola regla de
CSS: si no, se leería «Espía de anuncios» encima de «Tools», que nombra un lugar que ya no existe. Los
controles de esas cabeceras (períodos, botones) siguen visibles.

Las pantallas que ya tienen pestañas propias **las conservan** cuando viven dentro de una sola entrada:
Closer, Setter, Conversation, Ajustes y los siete pasos de ICP & Oferta. Las barras propias de `tools` y de
`analizadores` **se van**, porque sus pestañas pasan a ser entradas de departamentos distintos.

## `NE-18` · El teléfono

El producto es para computadora, pero la app hoy funciona en un teléfono con la barra como cajón, y la
prueba `pruebas/codigo/162-el-armazon-en-un-telefono.test.ts` lo exige. La barra nueva **sigue abriéndose
como cajón** a 375 px. No se diseña nada más para el teléfono en esta fase.
