# Meta directo: «Conectar con Meta» y todos los datos de anuncios desde la Marketing API

> Construido el **2026-10-26** en commits locales M1 a M7 (migraciones `101` a `104`), **sin subir** hasta que el usuario
> dé el OK. Reemplaza la lectura de anuncios por el Ad Manager de GoHighLevel («sólo Meta»). Lo que falta antes de
> producción —la prueba real con la app (M0), los textos legales validados y la revisión de la app de Meta— está en
> § 7. El kit para el encargado de Meta y el plan de subida viven en local, en `docs/modelo de datos/meta/`.

## 1 · Qué cambia

| | Antes (hasta M4) | Con Meta directo |
|---|---|---|
| De dónde salen campañas, anuncios, métricas y gasto | Ad Manager de GoHighLevel: 11 campos, una llamada por campaña y por día, una serie que se corta en 25 filas, y una maquinaria de cuadre y relleno | La Marketing API de Meta, con la conexión de cada cliente: estructura, insights por anuncio y por cuenta, desgloses |
| Qué se lee | gasto, impresiones, clics y acciones | además alcance, frecuencia, CPM, valores, video (cuartiles y reproducciones), desgloses por ubicación, plataforma, edad y género, dispositivo y país, presupuesto, objetivo, estado efectivo, moneda y zona horaria |
| Cómo se conecta | un token de usuario del sistema que cada empresa creaba en su propia app y pegaba a mano | el botón **«Conectar con Meta»** (Facebook Login for Business con `config_id`): el negocio elige sus cuentas en el diálogo de Meta y la app de ARIA recibe el token del usuario del sistema de la integración (BISU), atado a ese negocio |
| Historia | 60 días de serie | **12 meses**, traídos de a tramos |
| Un cliente sin Meta | leía el gasto de su GoHighLevel si tenía Meta vinculado ahí | no tiene datos de anuncios; su lista de chequeo y sus avisos dicen «no tiene Meta conectado» |

La **atribución de los contactos** (`adId` y `campaignId`, que llegan con el contacto de GoHighLevel) no cambia.

## 2 · Las conexiones (`101`, `104`)

- `identidad.conexiones_de_meta`: una por negocio conectado. Con `cuenta_id` nulo la conectó la empresa (una agencia que
  asigna sus cuentas a cualquiera de sus clientes); con valor, un cliente con su propio portfolio. El token va cifrado
  con `CLAVE_MAESTRA`; `origen` es `oauth` (el botón) o `manual` (el token pegado de antes, respaldo transitorio, copiado
  por la fase `meta-manual-a-conexiones` de `scripts/db.mjs`). `estado`: `activa`, `revocada` o `vencida`.
  `usuario_de_meta_id` (`104`) es el id en la app del dueño del token, para encontrarla cuando Meta avisa.
- `identidad.cuentas_publicitarias_de_meta`: cada `act_…` que una conexión puede leer, con su moneda, zona y estado en
  Meta, y **a qué cliente se asigna** (nulo = no se lee). Un `act_` es de un solo cliente; un cliente puede tener varios.
  Un disparador impide asignar a otro cliente una cuenta que conectó un cliente.
- `identidad.estados_de_oauth`: el `state` del viaje, de un solo uso, guardado como sha256 y atado a la sesión, la
  persona, la organización y el cliente; vence a los 10 minutos.
- `identidad.pedidos_de_borrado_de_meta` (`104`): la constancia de cada pedido de borrado.

Todas sólo para `app_identidad`: el inquilino no lee tokens.

## 3 · El viaje «Conectar con Meta»

1. Ajustes › Credenciales (la empresa) o Ajustes › Clientes › Conexión (un cliente): **«Conectar con Meta»** hace
   `POST /api/admin/meta/conectar` (`credenciales.editar`), que guarda el `state` y devuelve la URL del diálogo de Meta.
   La pantalla sólo navega si la URL es la del diálogo (`DIALOGO_DE_META`).
2. Meta vuelve a `/meta/retorno` con `code` y `state`; la página los manda por `POST /api/admin/meta/canje`, que valida
   el `state`, canjea el código por un `POST` con el secreto en el **cuerpo**, lee `/me` (negocio e id) y
   `/me/adaccounts`, y guarda la conexión cifrada con sus cuentas. Las de un cliente van a ese cliente; las de la empresa,
   si tiene un solo cliente activo, a él, y si no quedan sin asignar.
3. Asignar o soltar una cuenta: `PUT /api/admin/meta/cuentas/[act]`. Desconectar: `DELETE /api/admin/meta/conexiones/[id]`.
   Todo auditado (`meta_conectada`, `meta_cuenta_asignada`, `meta_desconectada`).

Cada pedido a Meta lleva el token en la cabecera —nunca en la URL— y, si la conexión es `oauth`, su `appsecret_proof`.

## 4 · La lectura, por el cron

| Tarea | Horario | Qué hace |
|---|---|---|
| `anuncios` | `17 6 * * *` | Por cada cuenta asignada al cliente: la estructura (campañas, conjuntos, anuncios), los insights por anuncio y por cuenta de los **últimos 28 días** (Meta corrige la atribución hasta ahí) y los desgloses de los últimos 3 |
| `anuncios_relleno` | `53 * * * *` | La **historia**: 30 días más hacia atrás por cuenta y por corrida, hasta 365 días |
| `activos` | `37 * * * *` | La miniatura y el post de cada anuncio, por cuenta |

- El único escritor es `lib/negocio/recolectarDeMeta.ts`, con el ámbito de cada cliente (el puente pone `cuenta_id`).
  Las claves de `actions` se traducen a las que leen las pantallas (`link_click` → `linkClick`).
- Por cuenta y por día queda su total en su moneda (`gasto_por_cuenta_publicitaria`); el total del cliente
  (`gasto_de_la_cuenta`) es la suma de sus cuentas, en su moneda si es una sola y en USD si son varias. Nunca se suman
  monedas distintas. Un día que Meta no devolvió en un rango leído no tuvo entrega: se guarda en 0.
- La cuota: con el uso de las cabeceras de Meta por encima del 90 % la pasada se corta y sigue en la próxima. Un rango
  que Meta rechaza por grande se parte en mitades.
- Sin cuentas asignadas, las tres tareas quedan `saltada` con «Meta no está conectado». Un token rechazado (190) deja la
  conexión `revocada` y el cliente pasa a «la conexión con Meta se cayó».
- El cuadre de `gastoDeLaCuenta.ts` queda como control: el total y el detalle salen de la misma pasada, y un día que no
  cuadra es un anuncio que Meta no dio en el detalle.

## 5 · Lo que se ve

- **La lista de chequeo y la foto** (contrato 3, `103`): «Meta conectado» (requerido: una cuenta asignada con su conexión
  activa) y «Campañas leídas de Meta» (recomendado, medido con el sello de la pasada).
- **Acquisition**: cada campaña trae su entrega —estado efectivo, presupuesto diario o total, moneda, objetivo—.
- **Creative**: la retención del video (la parte de las reproducciones que llegó al final) con su curva por cuartiles, y
  un piso de 100 reproducciones.
- **Los avisos** por cliente: «{cliente} no tiene Meta conectado: conéctalo en Ajustes» y «La conexión de {cliente} con
  Meta se cayó: vuelve a conectar Meta en Ajustes».

## 6 · Lo que Meta exige (M6)

- `POST /api/meta/desautorizado` (Deauthorize callback) y `POST /api/meta/borrado` (Data Deletion Request): sin sesión,
  autenticados por la firma del `signed_request` con el secreto de la app, comparada con `timingSafeEqual`. La
  desautorización revoca las conexiones de ese usuario de Meta; el borrado borra lo leído de sus cuentas en cada
  cliente, rehace el total diario con lo que queda, borra las conexiones y contesta `{ url, confirmation_code }`.
- Páginas públicas, sin sesión: `/privacidad`, `/terminos`, `/borrado-de-datos` y `/meta/borrado/<código>` (el estado
  de un borrado). El proxy las deja pasar por una lista explícita (`lib/autorizacion/caminosPublicos.ts`).
- Variables de entorno: `META_APP_ID`, `META_APP_SECRET`, `META_CONFIG_ID` y `CONTACTO_DE_PRIVACIDAD` (ver
  `.env.example`). El secreto nunca lleva `NEXT_PUBLIC_` ni pasa por el navegador.

## 7 · Lo que falta antes de producción

1. **M0, la prueba real** con la app de ARIA en modo desarrollo y un Business Manager de prueba separado: que el BISU
   salga, que `me/adaccounts` traiga las cuentas compartidas como agencia, que `ads_read` alcance para todo, que la suma
   `level=ad` iguale a `level=account` con anuncios borrados, y qué `user_id` llega en los avisos.
2. **Los textos legales**, validados por el área legal, y el correo de contacto.
3. **La verificación del negocio, el App Review y el nivel de acceso «Full»** de la Marketing API.
4. **El corte**: «sólo Meta» deja sin datos de anuncios a cada cliente que no conecte. El código de M5 sube a producción
   cuando los clientes actuales ya conectaron.

## 8 · Las pruebas

`303` (conexiones y resolvedor), `304` (el viaje y la asignación), `305` (lo que trae Meta), `301` (el cron de punta a
punta con un Meta falso), `306` (lo que se ve), `307` (la firma y los caminos públicos), `308` (los avisos de Meta contra
la base) y `309` (una agencia conecta, asigna, el cron lee y cada cliente ve lo suyo). Cada una vista en rojo por
mutación.
