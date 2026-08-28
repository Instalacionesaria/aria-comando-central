# Etapa 9 — Fundaciones dentro de ICP & Oferta

Las siete primeras herramientas del método de ARIA-brain, portadas a la pantalla `icp` con el
lenguaje visual del Command Center, compartiendo el almacén con el hub.

```bash
npm run tipos && npm test pruebas/codigo && npm run build
```

**97 pruebas de tipo Código, 97 pasan** (78 previas + 19 nuevas). La suite completa incluye las de
tipo Base, que necesitan Postgres levantado (`npm run db:reset`).

## Qué se portó, y qué no

Nueve herramientas tiene Foundations en ARIA-brain. Entraron **siete**, y las dos que faltaban
—VSL(`5`) y Landing(`6`)— **entraron después**; ver "Las nueve, completas" al final.

| # | Pestaña | `id` del hub | Metodología | Forma |
| --- | --- | --- | --- | --- |
| 1 | Tu ficha | `0` | `perfil/onboarding` | formulario |
| 2 | Research | `1` | `market-research/paso-1..5` | cinco pasos encadenados |
| 3 | ICP | `3` | `icp/avatar` | formulario |
| 4 | Categoría | `2` | `categoria/system` | formulario |
| 5 | Oferta | `4` | `oferta/irresistible` | formulario |
| 6 | Tu precio | `10` | `pricing/protocol` | formulario |
| 7 | Mapa | `26` | `mapa-proceso/system` | formulario |

**El orden de la tabla no es el de los identificadores, y eso es lo primero que hay que entender de
esta etapa.** El orden es el del método: la secuencia en la que cada herramienta hereda de las
anteriores. Los identificadores son los del hub porque son la **llave del almacén compartido**:
`perfil[3]` es el ICP, `historial[10]` es el precio.

Renumerarlos —"que queden 0..6, más ordenado"— no rompe nada visible. Rompe la herencia, y el
síntoma es un documento generado con el contexto de otra herramienta. Hay una prueba con la lista
literal para que eso sea una decisión y no un accidente.

**Las dos que faltaban** eran VSL (`5`) y Landing (`6`), las dos últimas del método. Estaban
nombradas en la prueba justamente para que agregarlas fuera una decisión — y se decidió. La prueba
ahora custodia lo contrario: que no se caigan sin que nadie lo note.

**Nada se borró de ARIA-brain.** El hub sigue completo y sigue siendo el sistema que los alumnos usan
hoy. Esta etapa es un port que CONVIVE, no un reemplazo.

## La decisión de la etapa: el almacén es compartido

El estado de Fundaciones —inputs y versiones de cada entregable— **no vive en la base de este
proyecto**. Vive en `aria_brain_client_state`, la misma tabla que usa el hub.

El motivo: los dos sistemas van a estar en pie unos meses, los alumnos van a entrar por las dos
puertas, y un alumno que genera su avatar acá y lo ve vacío allá no tiene forma de entender qué pasó.
Compartir el almacén es lo que hace que las dos puertas den al mismo cuarto.

Lo que cuesta, escrito para que nadie lo descubra después:

1. **El aislamiento de este proyecto no cubre estos datos.** No hay `org_id`, no hay política de
   seguridad a nivel de fila, no hay `conOrganizacion(`. El filtro es la columna `cliente_id` de la
   tabla ajena, y lo pone `lib/fundaciones/almacen.ts`. Por eso ese `cliente_id` **nunca llega del
   navegador**: sale de `identidad.organizaciones_credenciales.fundaciones_cliente_id`, resuelto
   desde la organización de la sesión, igual que `orgEfectiva`. Un `cliente_id` que viajara en el
   cuerpo de una petición sería la fuga entera — cualquiera con sesión podría leer y sobrescribir el
   trabajo de cualquier alumno.
2. **Las dos rutas están en `ARCHIVOS_AUTORIZADOS`.** Es un caso nuevo en esa lista: no abren
   contexto de inquilino porque los datos que manejan no están en esta base. De acá leen UNA fila, la
   de credenciales, que el rol del inquilino no puede ni mirar. Son —junto a
   `app/api/usuarios/route.ts`— los lugares donde olvidarse un `where` devuelve datos de otra
   organización sin ningún error.
3. **Migrar a la base propia es trabajo pendiente y nombrado.** `lib/fundaciones/almacen.ts` es la
   única puerta: cuando llegue ese día, se reescribe ahí y las siete herramientas no se enteran.

## La llave de IA es por organización, sin respaldo

`identidad.organizaciones_credenciales.ia_clave_cifrada` existía desde la migración 006 y hasta ahora
nadie la leía. Ahora la lee `resolverAccesoAFundaciones(`.

**No hay `ANTHROPIC_API_KEY` en el entorno, y no es un olvido.** Sería el `??` del `07` § 1 con la
peor consecuencia de esta etapa: el consumo de tokens de todas las organizaciones facturado a una,
con la API respondiendo 200 y sin que nada falle. ARIA-brain ya pagó ese defecto y lo quitó en agosto
de 2026 — su propio código lo dice: *"el fallback hacía que el consumo de cualquier cuenta lo pagara
ARIA"*.

Sin llave propia, la organización **no genera y lo dice**. Y lo dice con precisión: tres faltantes,
tres códigos, tres acciones distintas.

| Código | Significa | Quién lo arregla |
| --- | --- | --- |
| `sin_llave_de_ia` | Nunca se cargó | Quien administra la organización, en Integraciones |
| `llave_de_ia_ilegible` | Está cargada y el servidor no la puede descifrar | Quien administra el servidor: cambió la clave maestra |
| `sin_alumno_vinculado` | La organización no está vinculada a una cuenta del hub | Quien administra la plataforma |

Colapsarlos en *"no se pudo generar"* mandaría a las tres personas al lugar equivocado.

**Leer no necesita la llave.** `resolverAlumnoDeFundaciones(` está separada a propósito: una
organización sin llave cargada tiene que poder abrir la pantalla y ver los siete documentos que ya
generó en el hub. Si las dos cosas se resolvieran juntas, la respuesta honesta —*"acá está tu
trabajo, y para generar de nuevo falta la llave"*— sería imposible de dar.

## El cable trampa de `SIN_OPERACIONES_TODAVIA` disparó

`lib/autorizacion/secciones.ts` decía, desde la Etapa 3, que sus dos filas de `PRUEBAS.md` no podían
verificar nada real: ninguna de las diez pantallas del prototipo tenía una operación de servidor. Y
dejaba una instrucción para el día que eso cambiara — *"catalogar su capacidad y ponerla en
`SECCIONES`, o justificar por qué no"*.

Se catalogó. `icp` salió de `SIN_OPERACIONES_TODAVIA` y entró a `SECCIONES` con `fundaciones.ver`.
Con eso `ADR-0303` deja de estar inerte y `ADR-0304` compara de verdad los conjuntos de sus
operaciones.

**Dos capacidades y no una**, con el criterio del `03` § 2 (*"¿existe un rol plausible que necesite A
y no B?"*): sí, y es el caso normal — un coach abre el avatar y la oferta de un alumno para preparar
el kickoff, y no tiene por qué poder gastarle tokens generando de nuevo. Ver es leer siete
documentos; editar es gastar dinero de la organización.

`ADR-0304` compara solo los `GET` de una pantalla, y eso es correcto acá: el defecto que previene es
de LECTURAS (*"veía una sección con datos y cuatro en blanco"*), y pedir `fundaciones.ver` en el
`POST` que genera sería una escalada silenciosa — el portero usa `contieneAlguna`.

**La deuda de la lista paralela NO se pagó**, y conviene decirlo con precisión: `icp` sigue apareciendo
en los cuatro lugares (`Nav.jsx`, el mapa `GROUP` de `shell.js`, el `id="v-icp"`, y `paridad.mjs`), y
el menú sigue mostrando las diez entradas a cualquiera con sesión. Lo que cambió es que ahora hay una
pantalla donde eso tiene consecuencia visible: quien no tenga `fundaciones.ver` entra y sus
operaciones responden `sin_permiso` con su texto, en vez de ver una pantalla vacía.

## Un fallo de datos no se lleva la navegación

La primera versión del componente devolvía el cartel de error **en lugar de todo**: sin sesión, sin
llave o sin almacén, la pantalla mostraba un cartel y nada más. Se descubrió al abrirla en un
navegador antes de desplegar, y estaba mal por dos motivos.

Las siete pestañas son estructura, no un dato leído: esconderlas cuando el almacén no contesta le
quita a la persona lo único que le explica de qué le están hablando. Y sobre todo, vuelve imposible
distinguir *"esta pantalla no existe todavía"* de *"esta pantalla existe y ahora mismo no puede
leer"* — que es la confusión que `ADR-0305` existe para impedir, cometida un nivel más arriba.

Ahora con problema se pinta todo —pestañas, formularios, lo que hereda cada herramienta— sobre un
estado vacío, con el aviso arriba diciendo qué pasó y con qué código, y con la frase que hace la
diferencia: *"los campos salen vacíos porque no se pudo leer lo guardado, no porque no haya nada"*.

Y un detalle que la misma revisión encontró: los dos motivos para no poder generar —falta el permiso,
o no se pudo leer el estado— viajan como **motivos distintos** y no como un booleano. Un cartel que
diga *"tu rol puede ver pero no generar"* sobre una sesión vencida manda a pedirle un permiso a
alguien que no tiene nada que darle.

## No hay prompt suplente, y es lo contrario de lo que hace el hub

ARIA-brain tiene, para cada herramienta, la metodología en un `SKILL.md` **y** una copia embebida en
TypeScript como respaldo. Si el archivo no carga, usa la copia.

Acá el respaldo **no se portó**. Si `lib/fundaciones/skills/<id>/SKILL.md` no se puede leer, la
generación responde `metodologia_ilegible` y no genera nada.

El motivo: dos copias del mismo prompt divergen en la primera corrección. Cuando Jorge afine el
framework de la Oferta, va a tocar el archivo — y el suplente se queda con la versión vieja
esperando el día en que el archivo falte. El síntoma sería un documento generado con la metodología
vieja, **sin ningún error**. Un fallo ruidoso es mejor que un documento silenciosamente equivocado.

La consecuencia práctica es que los archivos TIENEN que entrar al paquete construido, y eso no pasa
solo: no se importan, así que el trazado de Next no los ve. Están en `outputFileTracingIncludes` de
`next.config.mjs`, con la advertencia al lado — olvidarlo funciona en desarrollo y falla en
producción, que es el peor par posible.

Los once archivos son **copias byte a byte** de `ARIA-brain/app-next/public/skills/`. Esa fidelidad
es el punto: el diff entre los dos árboles tiene que ser legible cuando alguien corrija un framework.

## Los recortes y las etiquetas del contexto heredado son parte del contrato

`lib/fundaciones/prompts.ts` es el puerto de `DATA_GETTERS` del hub, y se parece más de lo que
gustaría: las etiquetas (`AVATAR YA GENERADO`), los recortes (`slice(0, 3500)`) y el orden de los
bloques están copiados.

No es pereza. Los `SKILL.md` fueron escritos y afinados contra esos textos. Cambiar
"AVATAR YA GENERADO" por "Avatar", o subir un recorte de 2500 a 4000, cambia el documento que recibe
el alumno — y lo cambia sin que nada falle. Los recortes existen por una razón medida: el Mapa hornea
desde cuatro documentos completos y sin límites el prompt no entra.

Lo que **sí** cambió: en el hub esto corre en el navegador, lee el DOM y variables globales
mutables. Acá corre en el servidor y todo entra por argumentos. No es prolijidad — una global de
módulo en el servidor se comparte entre peticiones de organizaciones distintas, y el valor filtrado
sería el avatar y la oferta de otro cliente dentro del prompt del primero. Es la forma del defecto
que `ADR-0703` prohíbe para las credenciales. Funciones puras lo hacen inexpresable.

## `icp` salió de la compuerta de paridad

`npm run paridad` compara el port contra `aios-command-center_1.html` vista por vista: forma del DOM,
texto y geometría. Su valor entero depende de que un rojo signifique *"se rompió algo"*.

`icp` dejó de ser comparable a propósito: era el placeholder "Pendiente de construir" y ahora tiene
las siete herramientas con estado en React. Compararla daría un rojo permanente — y un rojo
permanente no se arregla, se ignora, y con él se ignoran los otros nueve. Así muere una compuerta.

Lo que se pierde, dicho con precisión: **esta vista ya no tiene red de seguridad automática.** Lo que
se conserva: las otras nueve siguen comparándose, así que el día que se reactifique una segunda, la
comparación sigue siendo confiable para las que no cambiaron.

Hay una prueba que cuenta las nueve. Si mañana quedan siete, falla, y alguien tiene que explicar por
qué — para que sacar una vista no se vuelva la salida fácil de cualquier rojo.

## La primera vista con estado en React

El README describe el camino para reactificar una vista: *"reescribís su módulo de `lib/aios/` como
componente con estado y lo quitás de la lista de `lib/aios/index.js`"*. `icp` no tenía módulo —era un
placeholder—, así que no hubo nada que quitar. Las otras nueve las sigue pintando la capa
imperativa, intacta.

`app/aios.css` **no se tocó**: sigue siendo la hoja original íntegra y diffeable. Lo que el prototipo
nunca tuvo —campos, botones, documentos largos— está en `app/fundaciones.css`, importado en la capa
`components` (que gana a `aios`, o el reset `* { margin:0 }` se comería todos los márgenes). Ni un
color literal: todo sale de los tokens. Las subpestañas reutilizan `.cl-sub` / `.cl-page`, el patrón
del cockpit del Closer, para no inventar una segunda gramática de pestañas.

## Lo que NO está en esta entrega

Nombrado, no escondido:

- **Editar una fuente heredada solo para una herramienta.** El hub tiene `chipOverrides` —overrides
  en memoria, que se pierden al recargar—. Acá las fuentes son de solo lectura: se muestran, y se va
  a su herramienta para cambiarlas.
- **La procedencia al escribir.** El campo `sources` de cada versión (qué versión de cada fuente
  consumió esta generación) se **lee** y no se **escribe**. Una versión generada acá queda sin
  procedencia, así que el hub no le puede avisar *"tu Oferta se generó con un ICP que ya cambiaste"*.
  Las versiones que ya la tienen quedan intactas: el campo es opcional.
- **La investigación profunda y el lenguaje de campo del Research.** Se leen del almacén y se pasan
  al prompt del ICP si el alumno los corrió en el hub, pero no se pueden generar desde acá.
- **Un tope de gasto.** Un alumno puede pedir el Mapa veinte veces seguidas: son veinte generaciones
  de 16.000 tokens contra la llave de su organización. El hub tampoco lo pone. Es una decisión
  pendiente, no una que ya se tomó.
- **Una pantalla para cargar `fundaciones_cliente_id`.** La columna existe y la lee el código; hoy se
  puebla con SQL. `app/api/admin/credenciales/route.ts` no la expone todavía.
- **Pruebas de tipo Base para las dos capacidades nuevas.** La prueba de catálogo que cruza
  `CAPACIDADES` con `identidad.permisos` las va a verificar en cuanto haya Postgres; la mitad que se
  puede comprobar sin base —que la migración las nombra y las reparte— está en
  `pruebas/codigo/90-fundaciones.test.ts`.

## El modelo: la intención era el del hub, y el identificador no existía

**Hoy es `claude-sonnet-5`.** Esta sección decía `claude-sonnet-4-6` «el mismo que usa ARIA-brain», y
ese identificador **no es un modelo de la API de Anthropic**: toda generación fallaba, y la pantalla
decía «el modelo no respondió» — que manda a revisar la credencial, que estaba bien.

Se corrigió el 2026-08-28. Este párrafo queda escrito y no se borra porque el documento fue parte
del defecto: un valor inventado, escrito con seguridad en la especificación Y en el código Y en una
prueba que lo exigía literalmente. Tres lugares diciendo lo mismo no lo vuelven cierto, y quien
fuera a diagnosticarlo leyendo este archivo se iba a convencer de que el modelo estaba bien.

La intención original sigue en pie: mientras los dos sistemas estén en pie, un alumno tiene que
poder comparar su avatar de acá con el de allá, porque un modelo distinto sobre el mismo prompt da
un documento distinto y la diferencia se leería como un error del port. Pero un identificador
inválido no iguala nada: no genera. `MODELO` en `lib/fundaciones/generacion.ts` sigue siendo la
única línea que hay que cambiar, y la prueba que la vigila ahora comprueba contra la lista de
identificadores válidos en vez de fijar uno solo.

La búsqueda web del Research usa la variante con filtrado dinámico (`web_search_20260209`), que el
hub todavía no usa. Es la única diferencia deliberada con el hub en la llamada al modelo.

### Y el diagnóstico ya no depende de adivinar

El mismo día, la pantalla volvió a fallar con `invalid_request_error` — otro código, misma
impotencia. `pedirExterno` leía `error.type` y **descartaba `error.message`**, que es el único campo
donde la API dice qué estuvo mal. Con el tipo a secas son indistinguibles una cuenta sin saldo, un
`max_tokens` fuera de rango y un campo de más en el cuerpo: tres investigaciones con el mismo
nombre.

Ahora el motivo del proveedor queda **entero en el registro del servidor** y **acotado en la
pantalla**, junto al código. Es el mismo criterio que `motor_rechazo` ya usaba para el motor de
scraping, donde el caso normal es el saldo agotado — así que lo de acá no era un criterio distinto,
era una inconsistencia.

## Puesta en marcha

```sql
-- 1 · La migración (dos capacidades + la columna del vínculo)
```
```bash
npm run db:migrar
```
```sql
-- 2 · Vincular la organización con su cuenta del hub y cargar su llave de IA.
--     El id sale de `aria_brain_clientes.id` en el almacén del hub.
update identidad.organizaciones_credenciales
   set fundaciones_cliente_id = '<uuid del alumno en el hub>'
 where org_id = '<uuid de la organización>';
```

La llave de IA se carga por el camino que ya existe para las credenciales (cifrada con
`CLAVE_MAESTRA`), y las dos variables del almacén van al entorno — ver `.env.example`.

Sin el vínculo: `sin_alumno_vinculado`. Sin la llave: se puede ver todo, no se puede generar. Sin las
variables del almacén: `almacen_no_disponible`. Los tres lo dicen, y ninguno se muestra como "no hay
nada".


## Las nueve, completas

VSL (`5`) y Landing (`6`) entraron después de la entrega original. Con eso las nueve subpestañas de
Foundations del hub existen en la pantalla `icp`, en el orden del método:

    Perfil(0) → Research(1) → ICP(3) → Categoría(2) → Oferta(4) → Pricing(10) → Mapa(26) → VSL(5) → Landing(6)

Lo que trajeron consigo, y que no estaba:

**El desplegable.** `PanelHerramienta` solo sabía pintar campos de texto y áreas: el tipo `lista`
estaba declarado en `herramientas.ts` y ninguna herramienta lo usaba. El VSL tiene tres, y **no son
adorno**. Los valores de esas listas no son etiquetas: son el texto que entra al prompt, y
`vsl/killer-framework` deriva de ellos tres booleanos que encienden ramas enteras del framework
—`_isB2C` cambia el lenguaje y el cierre, `_hasProof` cambia en qué se apoya la credibilidad,
`_isScreenShare` cambia el entregable de "un guion" a "un guion más un documento visual"—. La
derivación mira el PRINCIPIO de la cadena (`'Sí'`, `'B2C'`, `'Case study'`), igual que el hub.

Eso hace que acortar un valor —"B2C" en vez de la frase entera— apague una rama **y el documento
salga igual**, escrito con el molde equivocado. Hay una prueba que lo custodia, y el comentario está
en los tres archivos que participan.

**Los prefijos de campo que no coinciden con el id.** El VSL es la herramienta `5` y sus campos son
`t6-*`; la Landing es la `6` y el suyo es `t7-niche`. Así están en el hub, y `claveCorta()` guarda el
identificador sin prefijo. "Arreglarlo" para que coincida no rompe nada visible y cambia la clave con
la que se guarda cada campo: el mismo alumno vería el formulario en blanco en el otro sistema.

**`compromisos.ts`**, que no tiene equivalente en las siete anteriores. La Landing es la única
herramienta que hereda un documento *recortado a dos de sus secciones*: los requisitos para aplicar y
los cupos del VSL. Es un puerto de `vslCommitments.ts` del hub, y su encabezado documenta el defecto
que lo originó — la página hablaba de los mismos requisitos sin leer el VSL, y podía contradecirlo.
La extracción es por encabezados de Markdown y es tolerante a propósito: el guion lo escribe un
modelo y la redacción del título varía entre generaciones.

**Y una fuente heredada nueva:** `vsl`. La Landing es la que más hereda de las nueve — las cuatro del
Mapa más el guion.

Las trece metodologías (once más las dos nuevas) entran al paquete construido por el glob de
`outputFileTracingIncludes`; se verificó en el `.nft.json` de la ruta que genera, no se supuso.
