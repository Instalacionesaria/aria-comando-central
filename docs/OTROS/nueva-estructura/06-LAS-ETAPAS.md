# Las etapas

> Cada etapa es **un commit**. Antes de cada uno:
>
> - `git pull --rebase` (hay otra persona trabajando en `main` a la vez);
> - el preview detenido;
> - `npm run build` y `npm run tipos`;
> - la suite entera en America/Lima, UTC y Asia/Tokyo.
>
> Toda prueba nueva se ve primero **en rojo** con la mutación que dice su fila. Las etapas grandes pasan
> además por una revisión adversarial. **No hay migraciones.**

## La tabla

| etapa | qué hace | archivos principales | pruebas que cambian o nacen (mutación que las pone en rojo) |
|---|---|---|---|
| **E0 · Documentos** | Esta carpeta. Notas de «después del corte» en `estado actual`, la deuda encontrada y los planes de lo posterior en `futuro/` | `docs/OTROS/nueva-estructura/`, `docs/OTROS/estado actual/00-MAPA.md`, `09-DEUDA-ABIERTA.md`, `docs/OTROS/futuro/` | La carpeta entra a la prueba de las citas, `101` (una cita a una línea que no existe) |
| **E1 · El PR #2** | Integra la marca sin cambiar un píxel (`NE-22`) | `brand/`, `public/brand/`, `app/brand/`, `app/globals.css`, `app/layout.js` | El orden de las capas de CSS (invertir dos); la deriva entre `brand/tokens.json` y la hoja generada (editar un valor a mano) |
| **E2 · La sesión entera** | `app/guardia.tsx` copia todo lo que la ruta de sesión manda. Hoy pierde `puedeBorrarPersonas`, y el botón «Eliminar» de Ajustes › Usuarios no aparece nunca | `app/guardia.tsx`, `app/sesion-contexto.tsx` | Toda clave de la sesión llega al contexto, salvo una lista con motivos (borrar una copia) |
| **E3 · Sólo oscuro** | `NE-23` | `app/tema.ts`, `app/layout.js`, `components/Nav.jsx`, se borra `components/BotonDeTema.jsx` | `104` y `107` dejan de exigir la simetría de dos temas en uso; nueva: nadie escribe el tema ni lo lee del navegador (volver a leer `localStorage`) |
| **E4 · Tipografía** | `NE-24` | `app/layout.js`, `app/globals.css`, `app/operacion-estetica.css`, `app/incidentes.css` | `121` aprende a leer las hojas que `globals.css` importa; nueva: Geist es la fuente y toda hoja usa la variable (devolver la pila del sistema) |
| **E5 · Paleta y superficies** | `NE-25` a `NE-27` | `app/temas.css`, `app/operacion-estetica.css`, `brand/MIGRACION.md` | Nueva: paridad con `brand/tokens.json`, un solo acento, etapas que no saturan más que el cian, contraste ≥ 4,5:1 de todo color de texto (poner un verde vivo; poner `ink-4` como texto); `106` sigue exigiendo doce etapas distintas |
| **E6 · Citas** | Reescribe, sólo en documentos, las citas a los archivos que E7 borra o cambia: 224 a los nueve que borra y 36 a los que cambia (`ExecutiveView.jsx`, `lib/aios/index.js`, `lib/aios/shell.js`, `app/armazon.css`), contadas con el patrón de la `101` sobre las carpetas auditadas. Pasan a rangos del prototipo o a «en `<commit>`» | documentos auditados | `101` verde antes y después |
| **E7 · El Inicio** | `NE-29` y `NE-30` | `components/views/ExecutiveView.jsx`, `components/marca/Mascota.jsx`, `lib/aios/index.js`, `lib/aios/shell.js`, `app/armazon.css`; se borran los nueve archivos de `NE-30` | Se borra `120`; cambian `90`, `95`, `102`, `103`, `107`, `156`, `162` y `178` (la `95` y la `103` leen `components/Overlays.jsx`); nueva: la maqueta se fue (volver a cargar un módulo) y el saludo usa la zona de la empresa (contar la hora con la del proceso) |
| **E8 · El modelo** | `lib/autorizacion/departamentos.ts`, puro: los departamentos, sus entradas y las funciones que reparten `menuVisible()`. La sesión suma `navegacion` y `restringido`. Sin cambio visual | `lib/autorizacion/departamentos.ts`, `app/api/auth/sesion/route.ts`, `app/guardia.tsx` | Nueva, cruzada: toda sección del menú queda ubicada una sola vez (agregar una sección sin ubicar); toda pestaña existe (borrar `mis-leads` del modelo); la visibilidad sale sólo de `menu` (sacar el filtro); el orden exacto |
| **E9 · La navegación en React** | `irALaVista` acepta la pestaña y la deja pedida; Tools y Analizadores la toman de ahí; las filas del menú son botones de verdad. Nace la pestaña **Scraper** de Tools (`NE-20`), que por ahora se ve en la barra propia de Tools: así existe antes de que la barra lateral de E10 la ofrezca | `lib/aios/shell.js`, `lib/vista.ts`, `components/fundaciones/Fundaciones.jsx`, `components/analizadores/PanelDeAnalizadores.jsx`, `components/Nav.jsx`, `components/tools/VistaDelScraper.jsx`, `components/views/ToolsView.jsx` | `91` y `109` cambian donde fijaban el clic del arranque; nueva: el pedido se guarda antes de avisar, lleva número de secuencia, y nadie ata clics al arrancar |
| **E10 · La barra lateral** | `NE-11` a `NE-16` y `NE-18` | `components/Nav.jsx`, `components/MenuDeUsuario.jsx`, `components/TopBar.jsx`, `app/armazon.css` | `91` (sin `GROUP` ni migas), `123` (el punto del scraper), `162` (el cajón); nueva: la barra lee sólo `navegacion` (leer `menu`), las «Próximamente» no navegan, el rótulo sale de `restringido` |
| **E11 · Cabecera y pestañas** | `NE-17` y `NE-19` | `components/CabeceraDeDepartamento.jsx`, `app/departamentos.css`, `components/views/ToolsView.jsx`, `components/analizadores/PanelDeAnalizadores.jsx`, `lib/fundaciones/` (los textos «Tools →») | `104` y `107` suman la hoja nueva; `126` y `139` cambian donde fijaban Tools; nueva: la ceja sale del modelo (escribirla a mano), los títulos propios se ocultan en las dos formas de cabecera, no quedan barras en Tools ni Analizadores, ningún texto de `components/` ni de `lib/fundaciones/` dice «Tools →» |
| **E12 · Ajustes › Usuarios** | `NE-21` | `lib/autorizacion/departamentos.ts`, `app/api/admin/roles/route.ts`, `components/ajustes/Usuarios.jsx` | `101-alcance` no se toca; nueva: cada sección en un solo grupo y su lista de lo que abre (poner Tools en tres grupos) |
| **E13 · Cierre** | Documentos al día, una foto nueva en `estado actual`, la memoria del proyecto y producción | documentos | `101` |

Los demás documentos que describen lo que cambia se actualizan **en la etapa que lo cambia**, no antes:

- `estado actual/11-EXECUTIVE.md`, en E7;
- `15-TOOLS-Y-MONITOREO.md` y `16-AJUSTES-Y-PERMISOS.md`, en E10 a E12;
- `17-LA-PLATAFORMA.md`, en E10;
- los `12-QUIEN-VE-QUE.md` de cada departamento, en E10;
- `brand/MIGRACION.md`, en E5.

Un documento que describe lo que todavía no existe es falso.

## El orden, y por qué

- **La marca va antes que la navegación**: el recolor por tokens es de bajo riesgo y no depende del menú.
- **El sólo-oscuro va antes que la paleta**, para que la paleta nueva no se escriba sobre un tema que
  alguien todavía puede tener puesto.
- **El Inicio se retira antes de tocar el menú.** Los módulos de la maqueta navegan haciendo clic en las
  filas del menú viejo; si el menú cambiara primero, esos clics caerían en el vacío sin un solo error.
- **El modelo de departamentos va antes que la barra**, y la navegación pasa a React antes que el diseño
  nuevo. Así cada paso se puede probar sin cambio visual antes del que sí lo tiene.

## La verificación

- **Pruebas**: lo de arriba, en las tres zonas, en cada commit.
- **En el navegador**: el login lo hace el usuario (nunca se escribe una contraseña). Con los datos de
  muestra sembrados en la base local, se sacan capturas antes y después de cada etapa visual:
  - el inicio, cada departamento y el engranaje;
  - a 1440 px y a 375 px;
  - la consola sin errores del arranque;
  - **una entrada del menú que no lleva a ningún lado cuenta como falla**.
- **Con un usuario restringido**, que el usuario crea en la base local:
  - un closer ve sólo Sales › Closer;
  - quien tiene Tools ve Research, Marketing y Sales;
  - desde una empresa que no es la principal no aparecen Monitoreo ni Incidentes.
- **Qué estado sobrevive**: empezar un chat de ICP, pasar a otro departamento y volver; y el recorrido
  Research › Scraper → Marketing › Tu página → Research › Scraper, con un escaneo en vuelo y con uno ya
  terminado (`NE-35`).

## La publicación, por hitos

Cada push lo aprueba el usuario:

| hito | etapas | qué se mira en producción |
|---|---|---|
| 0 | E0 | La carpeta, que el usuario revisa antes de que se toque código |
| 1 | E1 a E5 | La marca y el recolor: todas las pantallas, con login |
| 2 | E6 y E7 | El Inicio honesto |
| 3 | E8 a E13 | La navegación nueva entera, con un usuario restringido |

Después de cada push:

- el CI verde, el despliegue de Vercel listo y `/api/salud`;
- el humo con login del usuario.

**Reversión**: `git revert` de los commits, en orden inverso. Ninguna etapa toca la base, así que revertir
el código basta.
