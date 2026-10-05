# La miniatura y el video de cada anuncio, desde Meta directo

> **Estado:** **postergado el 2026-09-30**, por decisión del usuario: hay otras prioridades. Está
> construida la mitad que no depende de Meta (CR-0 a CR-3, 2026-09-29) y **falta la otra mitad
> (CR-4 a CR-9)**, que se retoma cuando una persona del equipo genere el token de Meta y lo cargue en
> Ajustes. Los requisitos son los de `docs/creative/15-LA-MINIATURA-Y-EL-VIDEO.md` (prefijo `C15-`);
> este archivo no los repite: dice **qué falta, por qué falta y cómo se hace**, para que quien lo
> retome no tenga que reconstruir el plan.
> Sin identificadores propios: las etapas son `CR-<n>`, las mismas del § 3 del 15.

---

## 1 · Qué se quiere

Que Creative no muestre sólo las cifras de cada pieza sino **cómo es**: una miniatura por pieza, y
al hacer click en un anuncio, **el video reproducido en la aplicación**; si no se puede reproducir,
un botón que abre el post en Facebook o Instagram (`C15-01` a `C15-03`).

## 2 · Por qué falta: tres razones, y ninguna es de código

1. **No hay token de Meta.** GoHighLevel no entrega el creativo de los anuncios del Business Manager
   —medido contra la API el 2026-09-29, `docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md` § 6, de
   `C14-16` a `C14-22`—, así que la única fuente es la API de Meta con un token propio. Lo genera
   **otra persona del equipo**, con acceso de administrador al Business Manager, siguiendo la guía
   del § 4 del 15. Nadie de desarrollo lo ve ni lo tipea: se pega en Ajustes y queda cifrado.
2. **Dos cosas sólo se saben con ese token.** La documentación de Meta no dice qué permiso entrega el
   `source` del video de un anuncio (`C15-P01`) ni cuánto dura una URL firmada del CDN, la firma
   `oe=` (`C15-P02`). De las dos depende el diseño: si se reproduce en la app o sólo se abre el post,
   y si la miniatura se refresca una vez por día o cada hora. Construir CR-5 a CR-9 antes de medir
   es adivinar esas dos respuestas, y la mitad de las pruebas quedaría escrita contra una suposición.
3. **Se decidió no usar el atajo.** GoHighLevel expone en `GET /ad-publishing/facebook/integration`
   el token de la Página de Facebook que le dio Meta. Usarlo fuera de GoHighLevel es dudoso frente a
   los términos de Meta y el usuario lo descartó el 2026-09-29: **no se usa**, ni para medir.

**Mientras tanto la pantalla no miente:** el cajón de la pieza dice que la miniatura y el video
todavía no se pueden mostrar y por qué (`components/creative/FichaDelCreativo.jsx:87-91`), y ofrece
el link manual como respaldo.

## 3 · Lo que ya está construido y se reusa

| etapa | commit | qué quedó | dónde |
|---|---|---|---|
| CR-0 | `7a7eb17` | los requisitos `C15-`, la medición de GoHighLevel y su sonda de sólo lectura | `docs/creative/15-LA-MINIATURA-Y-EL-VIDEO.md`, `scripts/medir-activos-en-ghl.mjs` |
| CR-1 | `1159c43` | el link manual por pieza: tabla `negocio.enlaces_de_pieza` (migración 063), validador de hosts, ruta `PUT`/`DELETE` con `credenciales.editar` y auditoría | `lib/negocio/urlExterna.ts:82`, `lib/negocio/enlaceDeLaPieza.ts:54`, `app/api/creative/enlace/route.ts` |
| CR-2 | `8fd0afd` | el cajón de la pieza con sus anuncios, ordenados por impresiones | `components/creative/FichaDelCreativo.jsx`, `lib/negocio/rendimientoDelCreativo.ts:259` |
| CR-3 | `ecfbc26` | la credencial de Meta en Ajustes (migración 064): el token cifrado y la cuenta `act_…` | `lib/credenciales/resolver.ts:607` |

Las migraciones 063 y 064 **ya están en producción** desde el 2026-09-29. Las piezas que CR-4 en
adelante van a usar sin tocarlas:

- `resolverAccesoAMeta` (`lib/credenciales/resolver.ts:607`) devuelve el token descifrado y la cuenta
  normalizada, o qué falta, con su texto en `TEXTO_DE_FALTA_META` (`lib/credenciales/resolver.ts:576`).
- `medioPermitido` (`lib/negocio/urlExterna.ts:90`) es la lista blanca de hosts de medios
  (`.fbcdn.net`, `.cdninstagram.com`); `enlaceDePublicacion` (`lib/negocio/urlExterna.ts:82`), la de
  publicaciones.
- `anunciosDeLaPieza` ya viaja en cada fila de Creative: el cajón sabe qué anuncios mostrar.

## 4 · Cómo se hace lo que falta, etapa por etapa

Las reglas de siempre: cada etapa es un commit; cada prueba nueva se ve en rojo con su mutación; la
suite corre en America/Lima, UTC y Asia/Tokyo; y las migraciones van a producción **antes** del push.
Antes de tocar código, leer `node_modules/next/dist/docs/` (lo pide `AGENTS.md`).

### CR-4 · Medir contra Meta con el token ya cargado

**Primero se comprueba que el token esté**: `resolverAccesoAMeta` tiene que devolver `listo` para la
empresa. Después, un script nuevo, `scripts/medir-activos-en-meta.mjs`, con el molde de
`scripts/medir-activos-en-ghl.mjs`:

- **Sólo `GET`**, por `pedirExterno` (`lib/http/cliente.ts:329`), con el token en la cabecera
  `Authorization` y **nunca en la URL**; se agrega a `ARCHIVOS_AUTORIZADOS`
  (`pruebas/apoyo/autorizados.ts`) si usa `conIdentidad(`.
- **Imprime** estado, claves, hosts y códigos de error. **Nunca** el valor de una URL firmada, del
  token ni de un id de persona: el repositorio fue público.
- Sobre **5 anuncios** de `negocio.anuncios`, mide:
  - `GET /{ad_id}?fields=account_id,creative{id,object_type,video_id,image_url,thumbnail_url,effective_object_story_id,instagram_permalink_url,asset_feed_spec}`;
  - si `thumbnail_width` y `thumbnail_height` agrandan la miniatura (por omisión son 64 px);
  - `GET /{video_id}?fields=source,picture,permalink_url` y, si falla, el código: `#10` o `#200` es
    permiso, `#190` es el token;
  - cuánto falta para el `oe=` de varias URLs (es hexadecimal, en segundos Unix), sin imprimirlas;
  - cuántos `video_id` distintos hay por pieza (`C15-09`), y cuántos anuncios traen `asset_feed_spec`
    con varios videos (`C15-P08`);
  - que `account_id` coincida con la cuenta cargada (`C15-11`).
- **A mano**, el usuario abre un permalink en una ventana privada, sin sesión con rol en la cuenta,
  para contestar `C15-P03`.

**Compuerta B**, con lo medido:

| si… | entonces |
|---|---|
| `source` llega | el click reproduce en la app (salida `archivo`) |
| `source` da `#10`/`#200` | lo máximo es abrir el post (salida `enlace`); CR-8 no pide `source` |
| el `oe` dura menos de 30 h | la tarea `activos` corre cada hora, no una vez por día |

El resultado se escribe en el § 6 del 14 (a partir de `C14-23`) y cierra `C15-P01`, `P02`, `P03` y `P08`.

### CR-5 · La tabla y la tarea del cron

- **Migración `NNN_el_activo_del_anuncio.sql`, con el próximo número libre** (la 065 y la 066 son de Acquisition): `negocio.activos_de_anuncio (org_id,
  meta_anuncio_id, fuente, meta_creativo_id, meta_video_id, tipo_de_objeto, publicacion_url,
  instagram_url, miniatura_url, miniatura_caduca_el, motivo, leido_el)`.
  - `fuente` con `check (fuente in ('ghl', 'meta'))`: `ghl` queda para el día en que se lancen
    campañas desde el Ad Manager de GoHighLevel, que sí traen su creativo (`C15-P05`).
  - Clave primaria `(org_id, meta_anuncio_id)` y clave foránea a `negocio.anuncios` con
    `on delete cascade`, con el molde de `db/migraciones/050_lo_que_costo_cada_anuncio.sql:239-240`.
  - Las URLs con `check (… like 'https://%' and length(…) <= 500)`, como en la 063.
  - RLS forzada con `negocio.aplicar_aislamiento`, y su tipo en `lib/datos/esquema.ts`.
  - La tarea `activos` en el `check` de `negocio.tareas_programadas`, que hoy vive en
    `db/migraciones/062_reintentos_de_los_analizadores.sql:19-23`: se hace `drop` y se vuelve a
    crear con la lista completa más `activos`.
- **`lib/negocio/barrido.ts`**: `activos` en el tipo `Tarea`, en `TAREAS` después de `anuncios`
  (`lib/negocio/barrido.ts:90-101`) y en el horario `'17 6 * * *'` (`lib/negocio/barrido.ts:246-250`),
  o en uno de cada hora si la compuerta B lo pide —el plan de Vercel es Pro, así que un horario de
  cada hora se acepta; si es uno nuevo, va también a `vercel.json`—. Sin credencial, la tarea queda `saltada` con el
  texto de `TEXTO_DE_FALTA_META`, igual que los Analizadores sin tl;dv
  (`lib/negocio/barrido.ts:529-533`); y se suma al despacho (`lib/negocio/barrido.ts:551-552`).
- **Las traducciones de las claves foráneas nuevas** en `QUE_LO_IMPIDE`
  (`lib/administracion/borrado.ts:40`): sin eso, la suite falla en la prueba que las exige.
- **Prueba**: `pruebas/codigo/99-cron.test.ts` ya exige que toda tarea de `HORARIOS` esté en `TAREAS`
  y que el despachador la sepa hacer, y que `vercel.json` y `HORARIOS` digan lo mismo. El `check` de
  la base no lo mira esa prueba: la migración tiene que agregarlo.

### CR-6 · El cliente de Meta y el escritor único

- **`lib/meta/anuncios.ts`** (la carpeta no existe todavía): pide los anuncios **en lotes de 50**
  (`GET /?ids=…&fields=…`), sólo por `pedirExterno`, y traduce los errores de Graph a un motivo
  cerrado. El detalle del error de Meta nunca llega al navegador.
- **`lib/negocio/recolectarActivos.ts`**, el único que escribe la tabla, con el molde de
  `lib/negocio/recolectarAnuncios.ts`:
  - un anuncio que falla se anota con su `motivo` y **no aborta la pasada**;
  - un anuncio cuyo `account_id` no es la cuenta cargada se descarta (`cuenta_ajena`, `C15-11`):
    `negocio.anuncios` no guarda la cuenta, así que la comparación es contra `meta_cuenta_id`;
  - toda URL pasa por `medioPermitido` antes de escribirse; la que no pasa, no se guarda;
  - presupuesto de tiempo como `PRESUPUESTO_MS` (`lib/negocio/recolectarAnuncios.ts:94`), y la marca
    de «incompleto» si no alcanza.
- **Pruebas, cada una con su mutación**: una miniatura ausente es `null` y no `''`; la segunda pasada
  reescribe; un 500 en un anuncio no tumba a los demás; un host fuera de la lista no se escribe; la
  cuenta ajena se descarta; y hay un solo escritor, al estilo de las pruebas 111 y 147.

### CR-7 · La miniatura en pantalla

- **`lib/negocio/activoDelCreativo.ts`**:
  - `elegirLaMiniatura`, pura: gana el anuncio de la pieza con más impresiones en la ventana; si
    ninguno entregó —la pauta está parada desde el 2026-09-14—, el de más impresiones en toda la
    historia; el empate se rompe por el `meta_anuncio_id` menor.
  - `activosDeLasPiezas` filtra `miniatura_caduca_el > now()` **en SQL**: una miniatura vencida no se
    dibuja, se muestra el hueco (`C15-05`).
  - Si una pieza corre con videos distintos, se publica «N activos distintos» (`C15-09`).
- **En el panel**, `<img loading="lazy" referrerPolicy="no-referrer" onError>` con el molde de
  `components/tools/anuncios.jsx:67-86` (`<img>` crudo, no `next/image`, por lo que explica su
  comentario), en la subasta y en cada anuncio del cajón.
- **Mutaciones**: `max` por `min`, sin desempate, sin el respaldo de la historia, sin el filtro de
  vencimiento.

### CR-8 · El click: la ruta y el reproductor

- **`app/api/creative/anuncios/[id]/route.ts`**, sólo `GET`, con `['tablero.ver']` y el molde de
  `app/api/leads-portal/[id]/route.ts`. El id tiene que cumplir `^\d{5,25}$`; uno inválido y uno de
  otra empresa dan **el mismo 404**.
- **`lib/negocio/reproduccionDelAnuncio.ts`** resuelve en este orden (`C15-08`): el `source` pedido en
  el momento (no se guarda, `C15-04`) → el post de Facebook o Instagram → el link manual de la pieza
  → nada. La respuesta se arma a mano, con claves exactas (`C15-07`, como `CLAVES_DE_LA_FILA` en
  `lib/negocio/leadsDelPortal.ts:114`):
  - `{ tipo: 'archivo', url, poster, respaldo }`
  - `{ tipo: 'enlace', enlace, motivo, texto }`
  - `{ tipo: 'ninguno', motivo, texto }`

  y los textos salen de un mapa cerrado.
- **En el cajón**, `<video controls preload="metadata" playsInline poster>`; si falla, el respaldo es un
  `<a>` que la persona clickea. **Nunca un `iframe`**: la vista previa de Meta dura 24 h y sólo la ve
  quien tiene rol en la cuenta, y la aplicación no tiene política de seguridad de contenido.
- **Mutaciones**: otra empresa da 404; claves exactas; el token no aparece en ninguna respuesta; sin
  credencial da `ninguno`; un host fuera de la lista baja a `enlace`.

### CR-9 · Los huecos y los documentos al día

- El hueco del activo en `FUERA_DE_ALCANCE` (`lib/negocio/rendimientoDelCreativo.ts:155-160`) se
  achica a «el copy y el guion». El de la miniatura y el video pasa a ser **dinámico**, con su
  `MEDIDO_EL`: aparece sólo en la empresa sin fuente (`C15-10`). La prueba
  `pruebas/base/158-rendimiento-del-creativo.test.ts` sigue pidiendo al menos 4 huecos, y se suma
  que el hueco desaparece cuando hay activos.
- El texto fijo del cajón (`components/creative/FichaDelCreativo.jsx:87-91`) pasa a depender de lo
  mismo.
- Documentos: el 15 pasa a «hecho»; `docs/OTROS/estado actual/02-CREATIVE.md` § 5 deja de decir que
  no hay cliente de Meta; `16-AJUSTES-Y-PERMISOS.md` y `06-INTEGRACIONES-GHL.md` nombran la
  credencial nueva; y este archivo se borra o se marca como hecho.
- **Producción**: `migrar` antes del push. Después del despliegue, `/api/creative/anuncios/1` sin
  sesión tiene que dar 401; la prueba con sesión la hace el usuario.

## 5 · Para retomarlo

1. Pedirle a la persona del equipo que siga el § 4 del 15: la app de tipo Empresa, el usuario del
   sistema, los activos con sólo lectura, el token con `ads_read`, `pages_read_engagement` y
   `pages_show_list`, y la carga en Ajustes con la cuenta `act_…`.
2. Comprobar en Ajustes que la credencial se ve como cargada, sin ver su valor.
3. Correr CR-4 y escribir lo medido **antes** de escribir código: la compuerta B cambia CR-5, CR-6 y
   CR-8.
4. Seguir en orden, un commit por etapa.

## 6 · Riesgos

| riesgo | qué pasa entonces |
|---|---|
| el Business Manager dueño de la cuenta es de otra persona u otra empresa | no hay token: queda el link manual, que ya funciona |
| Meta niega el `source` (`#10`/`#200`) | se baja a `enlace`; el reproductor no se construye |
| el post de un anuncio no publicado no se ve sin rol (`C15-P03`) | el `enlace` sirve sólo al equipo; para el resto, el link manual |
| el `oe` dura poco | la tarea corre cada hora: 24 veces más llamadas, que CR-4 tiene que contar contra el límite de la API de Meta |
| el token vence a los 60 días | la tarea queda `saltada` con su texto; hay que regenerarlo y volver a cargarlo |
| algún día se agrega una política de seguridad de contenido | tiene que permitir `fbcdn` en `img-src` y en `media-src` |

## 7 · Preguntas que siguen abiertas

Las de `docs/creative/15-LA-MINIATURA-Y-EL-VIDEO.md` § 5. Las que se contestan midiendo son `C15-P01`,
`P02` y `P08` (CR-4) y `P03` (a mano). Las de producto, sin fecha: qué hacer con el link manual cuando
una pieza se renombra (`P06`) y si se aceptan otros hosts como YouTube o Drive (`P07`).
