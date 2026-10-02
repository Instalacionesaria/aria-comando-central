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

Hasta la etapa E10, Monitoreo e Incidentes formaban su propio grupo «Administración» del menú (`60f5d81`),
y Ajustes vivía en el pie. La estructura nueva los junta en el engranaje, y así quedó en E10. «Cambiar contraseña» sigue antes de «Cerrar
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

## Hecho el 2026-10-02 (E10)

La barra está en `components/Nav.jsx` y el pie en `components/MenuDeUsuario.jsx`. Lo que se decidió al
construirla, además de lo de arriba:

- **La geometría es la del lienzo**: 260 px de arriba abajo, sobre el fondo, con la línea de 1 px a la
  derecha. La barra de arriba quedó sólo para el teléfono, con el conmutador del cajón y el logotipo; la
  miga de pan se fue, porque la barra ya dice dónde estás. Los radios de 10 y 8 px del lienzo no son
  tokens: van con `--radius-sm`.
- **La entrada marcada** es la que se ve: la pantalla a la vista y la pestaña que esa pantalla dibuja.
  Tools cambia de pestaña por dentro —su barra propia hasta E11, el «Continuar» del VSL, los chips «Hereda
  de»— y Analizadores con la suya; por eso las dos anuncian lo que dibujan, sin crear un pedido. Si la
  barra marcara por el último pedido, mentiría.
- **El acordeón** sigue al departamento en uso cada vez que éste cambia; en el Inicio y en lo del
  engranaje, ninguno queda abierto, como en el lienzo. Entre un cambio y otro, la cabecera abre otro a mano.
- **La Reunión de hoy** dice «Próximamente», no navega y no tiene contador, y sólo la ve quien ve el Inicio:
  un closer ve Sales › Closer y nada más (`NE-16`). La palabra va debajo del nombre, como en las entradas: al
  lado, en el ancho de la barra, partía «Reunión de hoy» en dos renglones. El tono es el del lienzo.
- **Una «Próximamente»** lleva la palabra debajo del nombre, en mono: el tono no alcanza para distinguirla,
  porque una entrada en reposo ya es el piso del texto de la marca.
- **El punto «scrapeando»** va en la entrada desde la que el trabajo se vuelve a ver: las búsquedas de
  anuncios, en el Espía, que las retoma al abrirse; lo demás, en el Scraper, que retoma Maps al abrirse y cada
  otra fuente al tocar su pestaña. Prospección lleva el mismo Scraper adentro, pero el punto no se repite: una
  puerta por trabajo. Con Research cerrado, el punto va en su cabecera. Lo que dice va a una región viva fuera
  de la barra: dentro del botón entraba a su nombre.
- **El engranaje** se llama «Menú de la cuenta» y no «Ajustes», porque abre el menú. Cerrado, el menú se
  esconde del todo —el prototipo sólo lo volvía transparente, y sus botones seguían en el tabulador—, y
  cerrarlo con el foco adentro lo devuelve al engranaje. «Cambiar contraseña» cierra el cajón del teléfono
  antes de abrir su ventana, que se dibuja en el `body`.
- **La píldora de la empresa** lleva el nombre en mono. Mirando otra organización va en el tono de atención, y
  el lector de pantalla oye la frase entera; a la vista no va, porque en 150 px el prefijo se comía el nombre.
  Sin permiso para cambiar de empresa no es un botón.
- **La barra se desplaza entera** cuando la lista no entra: ningún bloque encoge. La barra de desplazamiento
  tiene su canal reservado a los dos lados —6 px de relleno más 8 de canal dan los 14 del lienzo—, así que
  las filas no saltan al abrir un departamento largo.
- **En el teléfono**, el velo empieza debajo de la barra de arriba, que lleva el botón que cierra el cajón, y
  el cajón lleva el borde de control. Al abrirlo, el foco va a la entrada marcada o a «Nueva conversación».
- **El galón** de las secciones y su ícono del menú viejo no se dibujan: la barra dibuja el ícono de cada
  departamento, del lienzo. `galon` e `icono` siguen en `lib/autorizacion/secciones.ts`, sin quien los dibuje
  (a ese archivo no se le agregan ni se le quitan líneas, `NE-33`).

Un defecto que la barra hizo visible y no es suyo: los chips «Hereda de» de Tools llevan a una herramienta de
ICP, y el panel cae a Prospección. Está anotado en `docs/OTROS/estado actual/09-DEUDA-ABIERTA.md`.

Lo vigila `pruebas/codigo/193-la-barra-lateral.test.ts`.
