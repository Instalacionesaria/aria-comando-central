# Creative — la miniatura y el video de cada anuncio

> Requisitos nuevos del **2026-09-29**, pedidos por el usuario: que la pantalla no muestre sólo las
> cifras de cada pieza sino **cómo es**, con una miniatura, y que al hacer click se **vea el video**
> —reproducido en la aplicación, o abriendo el post en Facebook o Instagram si no se puede—.
> Prefijo `C15-`. Mismo formato que el resto de la carpeta: Qué es / Rastro / Estado / Fórmula.
> La medición que decidió la fuente está en `14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md` § 6 (`C14-16` a
> `C14-22`).
>
> **Postergado el 2026-09-30.** CR-0 a CR-3 están construidos y en producción; **CR-4 a CR-9 esperan
> el token de Meta**, y el usuario los dejó para más adelante. Qué falta, por qué y cómo se hace: `docs/OTROS/futuro/miniatura-y-video-de-meta.md`.
> Los «Planificado» de abajo son de CR-4 en adelante y siguen valiendo como diseño.

---

## 1 · Qué se pidió, y la decisión que lo ordena

La unidad de la pantalla es la **pieza**: el nombre del anuncio normalizado
(`lib/negocio/creativo.ts:44-51`). Hoy hay 79 anuncios y 32 piezas, y 21 piezas corren en más de un
anuncio, hasta seis (`03-LA-BIBLIOTECA.md`, `C3-09`). La pantalla dice cuánto rindió cada pieza y no
dice **cuál es**: no hay miniatura, ni video, ni copy, y ese hueco está declarado en pantalla
(`lib/negocio/rendimientoDelCreativo.ts:155-160`).

**Decisiones del usuario, 2026-09-29:**

| tema | decisión |
|---|---|
| Fuente | Agotar primero GoHighLevel, que ya está conectado a Meta. Si no alcanza, **Meta directo con un token propio**, y un **link manual por pieza** de respaldo |
| El click | Reproducir el video en la aplicación. Si no se puede, «Ver en Facebook / Instagram» en una pestaña nueva |
| El token de Meta | Lo genera **otra persona del equipo**, con acceso al Business Manager, y lo carga en Ajustes. Nadie más lo ve |
| Lo que NO se usa | El token de la Página que GoHighLevel devuelve en `/integration` (`C14-21`): es una credencial de la app de GoHighLevel, y usarla por fuera de GoHighLevel puede ir contra los términos de Meta y de GoHighLevel |

**GoHighLevel no alcanza.** Se volvió a medir el 2026-09-29 con la sonda `scripts/medir-activos-en-ghl.mjs`,
incluida la ruta que la medición del 2026-09-18 no había probado (`GET /campaign/{campaignId}`), y
ninguna lectura con el token del CRM devuelve la miniatura, el video ni un link al post (`C14-16` a
`C14-20`). La vista previa que se ve en el Ad Manager de GoHighLevel la dibuja su propia pantalla con
lo que se va escribiendo en el borrador (`C14-22`): no sale de ningún link. **La fuente decidida es
Meta directo**, y esta decisión revisa la del 2026-09-19 de «sólo GoHighLevel, y el hueco se declara».

Conectar Meta con un token propio **no rompe ninguna política**: es el uso previsto, una aplicación
propia que lee su propia cuenta publicitaria. La documentación de autorización de Meta dice que si la
app sólo maneja su propia cuenta, el acceso estándar a `ads_read` alcanza, **sin revisión de la app**.

---

## 2 · Los requisitos

### C15-01 · Cada pieza muestra una miniatura, y la regla que la elige está escrita

**Qué es** · Una imagen chica al lado del nombre de la pieza, en la tabla de la subasta y en el cajón.
**Fórmula** · De los anuncios de la pieza, **el de más impresiones en la ventana**. Si ninguno entregó
en la ventana —la pauta está parada desde el 2026-09-14—, el de más impresiones en toda la historia
guardada. Empate: el `meta_anuncio_id` menor. Una función pura, probada por separado.
**Estado** · Planificado (CR-7). **Por qué una regla y no «la primera»**: con seis anuncios por
pieza, «la primera» es la que la base devuelve primero, y eso cambia sin que nadie lo decida.

### C15-02 · La pieza se abre en un cajón que lista sus anuncios

**Qué es** · Es el `C4-01` de la maqueta, que nunca se construyó. El cajón muestra la pieza y sus 1 a
6 anuncios, cada uno con su miniatura, sus impresiones y su gasto en la ventana, y su botón de video.
**Rastro** · Molde: `components/leads-portal/FichaDelLead.jsx` (portal propio, foco, Escape; **no**
el `#drawer` compartido, que usa Executive).
**Estado** · **Construido el 2026-09-29** (CR-2): `components/creative/FichaDelCreativo.jsx`, que se
abre con el nombre de la pieza en la subasta y en la tabla de gente.

### C15-03 · El click tiene tres salidas, y cada una dice por qué

**Qué es** · Al pedir el video de un anuncio el servidor contesta una de tres cosas:

| salida | qué dibuja la pantalla |
|---|---|
| `archivo` | el reproductor, dentro de la aplicación, con la miniatura de póster |
| `enlace` | «Ver en Facebook» o «Ver en Instagram», que abre el post en una pestaña nueva |
| `ninguno` | el motivo, en una línea: no es un video, falta la credencial, Meta no dio permiso… |

**Estado** · Planificado (CR-8). **Nunca se reproduce dentro de un `iframe`**: la vista previa
oficial de Meta dura 24 horas y sólo la ve quien tiene un rol en la cuenta publicitaria, y la
aplicación no tiene política de seguridad de contenido que acote qué se embebe.

### C15-04 · El archivo del video se pide al hacer click, y no se guarda

**Qué es** · La URL del archivo (`source`) es firmada y de vida corta: funciona como una llave del
archivo. Se pide a Meta en el momento del click y viaja sólo a quien lo pidió.
**Estado** · Planificado (CR-8). **Por qué no se guarda**: guardada, vencería sin aviso; y copiar el
video a un almacenamiento propio obligaría, según los términos de Meta, a una política de borrado.

### C15-05 · La miniatura se guarda con su fecha de lectura y su vencimiento

**Qué es** · A diferencia del video, la miniatura se lee una vez por pasada y se guarda con
`leido_el` y `miniatura_caduca_el` (lo que dice la firma `oe=` de la URL, si la trae). Una miniatura
vencida **no se dibuja rota**: no viaja, y la pantalla muestra el hueco.
**Estado** · Planificado (CR-5 a CR-7). Cuánto dura una URL del CDN no está documentado (`C15-P02`):
la cadencia del refresco sale de medirlo (CR-4).

### C15-06 · El link manual por pieza es el respaldo, y no se embebe

**Qué es** · Para la pieza cuyo video Meta no entregue, alguien puede pegar el link del post o del
reel. Se muestra como enlace; **nunca** se reproduce ni se embebe.
**Quién lo carga** · Quien tenga `credenciales.editar`, la misma capacidad que carga los links de
pago (ver `12-QUIEN-VE-QUE.md`, `C12-07`). Queda auditado.
**Qué se acepta** · Sólo `https`, sin usuario ni contraseña en la URL, sin puerto, y sólo estos hosts:
`facebook.com`, `www.facebook.com`, `m.facebook.com`, `web.facebook.com`, `business.facebook.com`,
`fb.watch`, `fb.me` —el acortador de Meta, que es el formato del link «Compartir vista previa» del
Administrador de anuncios—, `instagram.com` y `www.instagram.com` (`lib/negocio/urlExterna.ts:43`).
La comparación es **exacta**: `evilfacebook.com` no pasa. Molde: `urlDePagoValida` (`lib/negocio/enlacesRapidos.ts:79-87`), más la
lista de hosts.
**Estado** · **Construido el 2026-09-29** (CR-1): tabla `negocio.enlaces_de_pieza` (migración 063),
validador `enlaceDePublicacion` (`lib/negocio/urlExterna.ts:82`) y ruta `PUT`/`DELETE
/api/creative/enlace`.

### C15-07 · Lo que viaja al navegador es una lista blanca

**Qué es** · Ni el token, ni la respuesta cruda de Meta, ni su mensaje de error llegan al navegador.
Cada respuesta se arma a mano, clave por clave, y una prueba compara las claves exactas.
**Estado** · Planificado (CR-8), con el precedente de `CLAVES_DE_LA_FILA` de Leads Portal.

### C15-08 · El orden de las fuentes es fijo

**Fórmula** · Para el video de un anuncio: el archivo que da Meta → el post de Facebook o Instagram
que da Meta → el link manual de la pieza → `ninguno`, con su motivo. Para la miniatura: la que da
Meta, o el hueco.
**Estado** · Planificado. GoHighLevel queda fuera del orden mientras no entregue nada (`C14-16` a
`C14-20`); si mañana entrega el creativo de los anuncios creados desde su Ad Manager (`C14-20`), entra
primero.

### C15-09 · Si una pieza corre con activos distintos, se dice

**Qué es** · Dos anuncios con el mismo nombre pueden llevar videos distintos, y la pieza los funde
(`C1-P03`). Con el creativo de cada anuncio a la vista, por primera vez se puede **medir**: si una pieza
tiene más de un video o una imagen distintos, el cajón lo publica («esta pieza corre con 2 videos
distintos»).
**Estado** · Planificado (CR-7). Es la primera mitigación medida de `C1-P03`.

### C15-10 · El hueco depende de cada empresa, y lleva su fecha

**Qué es** · El hueco «el activo creativo» de `FUERA_DE_ALCANCE` deja de ser fijo. Se achica a «el
copy y el guion», y el de la miniatura y el video aparece **sólo** en la empresa que no tiene la
credencial de Meta o cuyo token falló, con la fecha de la medición (`MEDIDO_EL`).
**Estado** · Planificado (CR-9). La prueba `pruebas/base/158-rendimiento-del-creativo.test.ts` sigue
pidiendo al menos cuatro huecos.

### C15-11 · El anuncio de otra cuenta se descarta

**Qué es** · El token puede ver más de una cuenta publicitaria. Cada anuncio que devuelve Meta se
compara contra la cuenta guardada en Ajustes (`meta_cuenta_id`), y si no coincide se descarta con el
motivo `cuenta_ajena`. Es el mismo razonamiento que el del token del CRM sin Location ID.
**Estado** · Planificado (CR-6).

### C15-12 · Una sola tabla nueva, con su propio escritor

**Qué es** · El creativo de cada anuncio va en `negocio.activos_de_anuncio`, una tabla aparte, y no en
columnas de `negocio.anuncios`: esa tabla ya tiene un escritor (`lib/negocio/recolectarAnuncios.ts`), y
las URLs de Meta se refrescan con otra cadencia. Esto corrige lo que `08-DE-DONDE-VIENE-CADA-DATO.md`
decía sobre «columnas que se agregan».
**Estado** · Planificado (CR-5).

---

## 3 · Cómo se construye

Cada etapa es un commit, con sus pruebas vistas en rojo con su mutación. Las migraciones van a
producción antes del push. Las etapas postergadas están detalladas, paso por paso, en `docs/OTROS/futuro/miniatura-y-video-de-meta.md`.

| etapa | qué | depende de | estado |
|---|---|---|---|
| CR-1 | El link manual por pieza: tabla `negocio.enlaces_de_pieza`, validador de URL, ruta `PUT`/`DELETE` con `credenciales.editar` y auditoría | nada | hecho, 2026-09-29 |
| CR-2 | El cajón de la pieza con sus anuncios | nada | hecho, 2026-09-29 |
| CR-3 | La credencial de Meta en Ajustes: `meta_token_cifrado` y `meta_cuenta_id`, con el molde de `db/migraciones/057_llave_de_tldv.sql:1-29` y `resolverAccesoAlAnalizador`; quedó en `resolverAccesoAMeta` (`lib/credenciales/resolver.ts:607`), migración 064 | nada | hecho, 2026-09-29 |
| CR-4 | Medir contra Meta con el token ya cargado: qué campos llegan, si `source` se entrega, cuánto dura una URL | **el token, cargado por la persona del equipo** | postergado el 2026-09-30 |
| CR-5 | La tabla `negocio.activos_de_anuncio` y la tarea `activos` del cron | CR-4 | postergado el 2026-09-30 |
| CR-6 | El cliente de Meta y el escritor único `lib/negocio/recolectarActivos.ts` | CR-4 | postergado el 2026-09-30 |
| CR-7 | La miniatura en la tabla y en el cajón (molde: `components/tools/anuncios.jsx:67-112`, `<img>` crudo con `onError`) | CR-6 | postergado el 2026-09-30 |
| CR-8 | La ruta del click, `app/api/creative/anuncios/[id]/route.ts`, y el reproductor | CR-6 | postergado el 2026-09-30 |
| CR-9 | Los huecos dinámicos y los documentos al día | todo | postergado el 2026-09-30 |

---

## 4 · Guía para la persona que genera el token

**Esto lo hace una persona con acceso de administrador al Business Manager dueño de la cuenta
publicitaria.** El token no se manda por chat ni por correo: se pega directamente en Comando Central,
y desde ahí nadie lo vuelve a ver. Los nombres de las pantallas son los de la documentación de Meta
al 2026-09-29; si cambiaron, el orden de los pasos es el mismo.

1. **Crear la app.** En `developers.facebook.com` → *Mis apps* → *Crear app*, de tipo **Empresa**, y
   vincularla al Business Manager de la empresa. Agregarle el producto **Marketing API**.
2. **Crear el usuario del sistema.** En `business.facebook.com` → *Configuración del negocio* →
   *Usuarios* → *Usuarios del sistema* → *Agregar*. Un nombre que diga para qué es, p. ej.
   «Comando Central (lectura)».
3. **Asignarle los activos, sólo con lectura.** Con el usuario del sistema elegido → *Asignar
   activos*:
   - la **cuenta publicitaria** de los anuncios, con permiso de ver el rendimiento;
   - la **Página de Facebook** con la que corren los anuncios, con permiso de ver el contenido.
4. **Generar el token.** *Generar nuevo token* → elegir la app del paso 1 → marcar **solamente**
   `ads_read`, `pages_read_engagement` y `pages_show_list`. Ninguno de los tres permite crear, pausar
   ni gastar.
5. **Cargarlo.** En Comando Central → *Ajustes* → *Credenciales* → la empresa → **Token de Meta** y
   **Cuenta publicitaria** (el `act_…` que se ve en el Administrador de anuncios).

Si Meta ofrece un token que vence a los 60 días y otro que no vence, cualquiera sirve; el que vence
hay que volver a generarlo y cargarlo, y la pantalla va a avisar cuando falle (`C15-10`).

---

## 5 · Preguntas abiertas

| id | pregunta | cómo se contesta |
|---|---|---|
| `C15-P01` | Qué permiso entrega el `source` del video de un anuncio: la documentación de Meta no lo dice | CR-4, con el token real: el código de error de Meta lo dice (`#10` o `#200` es permiso) |
| `C15-P02` | Cuánto dura una URL del CDN de Meta (la firma `oe=`) | CR-4: se resta la hora actual al `oe` de varias URLs |
| `C15-P03` | Si el post de un anuncio creado desde el Administrador de anuncios —un post no publicado— se ve sin tener rol en la cuenta | a mano: abrir el link en una ventana privada |
| `C15-P04` | Qué rutas internas usa la pantalla del Ad Manager de GoHighLevel | no hace falta: la vista previa se dibuja con el borrador (`C14-22`). Queda abierta sólo para anuncios creados desde GoHighLevel |
| `C15-P05` | Si la empresa va a lanzar campañas desde el Ad Manager de GoHighLevel | hoy no: 0 campañas de ese origen el 2026-09-29 (`C14-18`). Si empieza, esos anuncios traerían su creativo en GoHighLevel (`C14-20`) |
| `C15-P06` | Qué pasa con el link manual si la pieza se renombra | el link queda huérfano y no se dibuja; se decide si se ofrece moverlo |
| `C15-P07` | Si el link manual acepta otros hosts (YouTube, Drive, Vimeo) | decisión de producto; hoy no, para que el respaldo sea el post del anuncio y no otra copia |
| `C15-P08` | Qué video mostrar en un anuncio dinámico (Advantage+) con varios videos | CR-4 mide cuántos hay; si hay, se listan |
