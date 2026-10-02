# Lo que no cambia: el contrato

> La estructura nueva es **una capa de navegación encima de lo que ya existe**. Este documento dice qué
> queda intacto, para que nadie lo toque por accidente.

## `NE-31` · Las claves de sección

La clave de una sección (`executive`, `contacts`, `icp`, `acquisition`, `creative`, `conversion`,
`conversation`, `sales`, `setter`, `closer`, `analizadores`, `tools`, `monitoreo`, `incidentes`,
`credenciales`, más `usuarios` y `empresas`, que son pestañas de Ajustes) es **cinco cosas a la vez**:

| es… | dónde |
|---|---|
| la clave de la vista | `id="v-<clave>"` de cada `components/views/*View.jsx`, y el mapa `VISTAS` de `components/CommandCenter.jsx:34` |
| la pantalla de cada ruta | `export const PANTALLA = '<clave>'` en `app/api/**/route.ts`; el portero (`exigir`) niega con 403 a quien no tiene esa pestaña |
| un valor permitido en la base | el `check` de `identidad.usuarios_secciones.seccion`, que guarda las pestañas de cada persona |
| la clave del grupo de las migas | `GROUP` en `lib/aios/shell.js:35` (se va cuando se van las migas, `06-LAS-ETAPAS.md` E10) |
| la clave de las reglas de estilo | cada hoja de CSS cuelga sus reglas de `#v-<clave>` |

**Ninguna clave cambia en esta fase.** Renombrar una exige una migración para el `check`, un guion que mude
las pestañas de las personas (una migración no las ve: la seguridad por filas está forzada) y cambiar las
rutas. Es el camino que ya se recorrió para retirar `auditoria`, y no hace falta para mover pantallas de
lugar. Por eso la sección `executive` se **muestra** como «Inicio» sin cambiar su clave.

## `NE-32` · Quién ve qué

- **`menuVisible()`** (`lib/autorizacion/secciones.ts:820`) sigue siendo **la única fuente** de lo que cada
  persona ve: capacidad, alcance por pestañas y regla de la organización principal. La estructura nueva
  reparte su resultado; **no lo vuelve a calcular**.
- **Los tres roles** (superadministrador, administrador, usuario) y sus capacidades **no cambian**.
- **Las pestañas que cada persona tiene concedidas no cambian**: ni una fila de `usuarios_secciones` se
  toca.
- **El portero** (`lib/autorizacion/portero.ts`) sigue negando igual.
- **`seccionDeArranque()`** sigue eligiendo la pantalla con la que se abre la app.

## `NE-33` · `secciones.ts` no se toca

`lib/autorizacion/secciones.ts` tiene cerca de cien citas `archivo:línea` en los documentos. Agregarle una
línea correría todas sin que nada fallara (la prueba de las citas sólo mira que la línea exista). La
estructura nueva vive en un **archivo nuevo**, `lib/autorizacion/departamentos.ts`, que lee a
`secciones.ts` y no lo modifica. Una sección nueva que alguien agregue a `secciones.ts` sin ubicarla en un
departamento pone en rojo la prueba cruzada del modelo (`06-LAS-ETAPAS.md` E8).

Única excepción: el cambio del **nombre visible** de `executive` a «Inicio», que se escribe en la misma
línea y no corre ninguna.

## `NE-34` · Sin migraciones

Esta fase **no tiene migraciones**. La base de producción queda en la `067`.

## `NE-35` · Las pantallas por dentro

Fuera de lo que dicen `02-DONDE-VA-CADA-PANTALLA.md` y el recolor de `03-LA-MARCA.md`, ninguna pantalla
cambia su disposición, sus cifras ni sus rutas. **Todas siguen montadas a la vez**: lo que una pantalla
tiene a medias (un chat de ICP, una pestaña del Closer) sigue ahí al volver, también cuando se vuelve
desde otro departamento.

**Con una excepción que ya existe y no cambia**: dentro de Tools, el panel de cada pestaña se vuelve a
montar al cambiar de pestaña (`components/fundaciones/Fundaciones.jsx`, `key={herramienta.id}`). Como las
pestañas de Tools quedan en departamentos distintos, pasar de Research › Scraper a Marketing › Tu página y
volver desmonta el Scraper:

- **sobrevive** el trabajo del servidor: un escaneo en vuelo sigue, y el Scraper lo retoma al volver;
- **no sobrevive** lo dibujado: los leads ya traídos y lo escrito en el formulario.

Lo mismo vale para las dos pestañas de Analizadores.

## `NE-36` · Los accesos cruzados que ya existen

Se documentan porque la estructura nueva los hace más visibles, no porque cambien:

- **Research › ICP & Oferta** usa el buscador de negocios en su paso de mercado, y las dos rutas que llama
  son de `tools`: `/api/tools/saldo`, para el saldo de leads, y `/api/tools/scrape`, para el escaneo
  (`components/fundaciones/PanelResearch.jsx`). Quien tiene ICP y no tiene Tools recibe un 403 en ese
  paso. Se resuelve con los
  permisos por herramienta (`08-LO-QUE-QUEDA-PARA-DESPUES.md`).
- **Los botones de comisión y de designar closer**, dentro de Closer y Setter, llaman a rutas de
  `credenciales`. Funciona porque a quien no es administrador ya le faltan esas capacidades.
