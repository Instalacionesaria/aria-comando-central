# Quién ve qué: la pestaña, la lista y la ficha

> Barrido del código de autorización —`lib/autorizacion/secciones.ts`, `lib/autorizacion/portero.ts`,
> `db/arranque/001_catalogo.sql`— hecho el **2026-09-26**, más la medición de LP-0 contra producción,
> **2026-09-27 00:10 UTC**, sólo con agregados. Cada afirmación lleva su `archivo:línea`.
>
> La regla la decidió el usuario el 2026-09-26: **ve la pestaña quien tenga `tablero.ver` y la sección
> concedida**; el teléfono y el correo van **sólo en la ficha**; **no hay enlace a GoHighLevel**. Este
> archivo dice qué significa eso en el código, a quién alcanza hoy, y qué dato va de cada lado.

---

## 1 · La regla

### LP12-01 · `tablero.ver`, y la sección `contacts` cuando el rol es restringido

La sección ya está declarada así (`lib/autorizacion/secciones.ts:219-227`):

```ts
{
  clave: 'contacts',
  nombre: 'Leads Portal',
  capacidadRequerida: 'tablero.ver',
  sinOperacionesTodavia: true,
  menu: { grupo: 'AIOS', icono: '#i-leads', galon: true },
}
```

Lo que falta es el lado del servidor, y sigue el patrón de Sales: `export const PANTALLA = 'contacts'`
y `exigir(peticion, ['tablero.ver'], PANTALLA)` (`app/api/sales/route.ts:69`, `:75`). El portero
decide en dos pasos, y cada uno tiene su código de rechazo:

| paso | qué mira | si falla | rastro |
|---|---|---|---|
| 5 | ¿el rol tiene `tablero.ver`? | `sin_permiso`, 403, y queda auditado | `lib/autorizacion/portero.ts:219-246` |
| 6 | ¿la sección `contacts` está en el alcance de la persona? | `seccion_no_concedida`, 403 | `lib/autorizacion/portero.ts:276-295`, `lib/autorizacion/respuesta.ts:51` |

El paso 6 se comprueba **además** del 5, nunca en su lugar (`lib/autorizacion/secciones.ts:688-690`).

**No se crea una capacidad nueva.** Siete secciones comparten `tablero.ver` y ninguna combinación de
capacidades puede separarlas (`lib/autorizacion/secciones.ts:682-686`); lo que separa a las
personas es el alcance. Es lo mismo que decidieron Acquisition, Creative, Conversion y Sales
(`docs/sales/12-QUIEN-VE-QUE.md:53-75`).

### LP12-02 · Los tres roles, y qué le hace falta a cada uno

| rol | ¿trae `tablero.ver`? | ¿restringido por sección? | ve la pestaña | rastro |
|---|---|---|---|---|
| superadministrador | sí: todas las capacidades | no | **siempre** | `db/arranque/001_catalogo.sql:341` |
| administrador | sí | no | **siempre**, en su empresa | `db/arranque/001_catalogo.sql:462-466` |
| usuario | sí | **sí** | **sólo con `contacts` concedida** | `db/arranque/001_catalogo.sql:383-387`, `:241-243`, `:291-293` |

«Restringido» es la bandera `secciones_restringidas` del rol
(`db/migraciones/017_alcance_de_secciones.sql:54`): con ella puesta, la persona ve sólo las
secciones que tiene en `identidad.usuarios_secciones` (`db/migraciones/017_alcance_de_secciones.sql:64`),
y cero filas son cero pestañas (`lib/autorizacion/secciones.ts:700-704`).

**Y ya no hay un rol de closer.** Los roles `closer` y `setter` salieron del catálogo
(`db/arranque/003_retiro_de_roles.sql:13-14`): quien cierra hoy es un `usuario` con la pestaña Closer
concedida, y `usuario` **trae `tablero.ver`** (`db/arranque/001_catalogo.sql:146-149`, `:352-355`).
O sea que lo que deja a un closer fuera del Leads Portal es **sólo la concesión de la sección**, no
la capacidad.

Eso corrige algo que otra carpeta dejó escrito y hay que decirlo: el `S12-04` de Sales afirma que
*«hoy `tablero.ver` no la tiene un closer»* (`docs/sales/12-QUIEN-VE-QUE.md:90-93`). Con el reparto de
tres roles, eso sólo es cierto para el conjunto de capacidades histórico que
`pruebas/codigo/91-closer-y-setter.test.ts:246-255` todavía escribe a mano. La prueba sigue pasando,
y lo que protege es un rol que ya no se asigna.

Dos consecuencias más, que no son de esta pestaña sino de la plataforma, y se anotan para que nadie
las descubra en producción:

- **Todo administrador de cualquier empresa ve su Leads Portal sin que nadie se lo conceda.** Hoy no
  pasa nada: ARIA no tiene administradores activos (`LP12-03`) y las demás empresas no tienen
  contactos (`09-DE-DONDE-VIENE-CADA-DATO.md`, `LP09-13`).
- **Un superadministrador puede mirar la pestaña de otra empresa**, porque es el único que puede
  conmutar la organización que mira (`lib/autorizacion/secciones.ts:746-748`). Es la misma regla que
  en Closer.

---

## 2 · A quién alcanza hoy, medido

### LP12-03 · Tres personas ven la pestaña, y las tres ya podían leer cualquier ficha

| qué | cuántos |
|---|---|
| usuarios activos de ARIA | **4** |
| … con el rol `usuario` | 2 |
| … con el rol `superadministrador` | 2 |
| **ven la pestaña hoy** | **3** |
| tienen `closer.ver`, `setter.ver` o `contactos.ver` | **4** |

```sql
with org as (select id from identidad.organizaciones where slug = 'aria')
select (select count(*) from identidad.usuarios u where u.org_id = (select id from org) and u.activo) activos,
       (select jsonb_object_agg(r, n) from (
          select r, count(*) n from (
            select u.id, string_agg(ro.clave, '+' order by ro.clave) r from identidad.usuarios u
              join identidad.usuarios_roles ur on ur.usuario_id = u.id
              join identidad.roles ro on ro.id = ur.rol_id
             where u.org_id = (select id from org) and u.activo group by u.id) y group by r) x) por_rol,
       (select count(distinct u.id) from identidad.usuarios u
          join identidad.usuarios_roles ur on ur.usuario_id = u.id
          join identidad.roles ro on ro.id = ur.rol_id
          join identidad.roles_permisos rp on rp.rol_id = ro.id and rp.permiso = 'tablero.ver'
         where u.org_id = (select id from org) and u.activo
           and (not ro.secciones_restringidas
                or exists (select 1 from identidad.usuarios_secciones us
                            where us.usuario_id = u.id and us.seccion = 'contacts'))) ven_la_pestana,
       (select count(distinct u.id) from identidad.usuarios u
          join identidad.usuarios_roles ur on ur.usuario_id = u.id
          join identidad.roles_permisos rp on rp.rol_id = ur.rol_id
                                          and rp.permiso in ('closer.ver', 'setter.ver', 'contactos.ver')
         where u.org_id = (select id from org) and u.activo) con_contactos;
-- 4 · {usuario 2, superadministrador 2} · 3 · 4
```

**Qué dicen las dos últimas filas, con precisión:**

- **Los tres que ven la pestaña** son los dos superadministradores —que no están restringidos— y
  uno de los dos `usuario`, que tiene `contacts` concedida. El cuarto es un `usuario` sin ella.
- **La última fila cuenta capacidades, no pestañas.** Para un `usuario`, tener `closer.ver` no
  significa ver la pestaña Closer: le falta la concesión. Pero **`contactos.ver` no se recorta por
  sección**: la ficha del contacto la pide con `SIN_SECCION` (línea 74 de
  `app/api/contactos/[id]/route.ts`) y devuelve el teléfono y el correo
  (`lib/negocio/fila.ts:470-472`) de cualquier contacto de la empresa, sin filtro de asignación. O
  sea que las cuatro personas ya podían leer, con una petición, el teléfono y el correo de cualquiera
  de los 593.

Y no es una casualidad de estas cuatro personas: de los tres roles que existen, **ninguno trae
`tablero.ver` sin `contactos.ver`**. Los tres repartos se derivan del catálogo entero y ninguno
excluye `contactos.%` (`db/arranque/001_catalogo.sql:341`, `:383-387`, `:462-466`).

**Conclusión, verificada:** el portal **no le abre un dato personal a nadie que no pudiera leerlo
ya**.

**Lo que sí cambia, y hay que decirlo igual: la lista.** Hoy los 593 se ven por partes: la pestaña
del setter muestra su territorio, la del closer el suyo, y un closer vinculado a su usuario del CRM
ve sólo sus asignados (`lib/negocio/alcanceDelCloser.ts:25-28`). El portal pone a los 593 en una sola
lista, con nombre, puntaje y estado, para quien tenga la pestaña. Para los dos superadministradores
no es nada nuevo —en Closer ven «todo»—; para el tercero, depende de si es un closer vinculado, y eso
no está medido (`LP12-P01`).

### LP12-04 · Nadie nuevo recibe la pestaña, y la medición se muestra antes de LP-4

- **LP-4 no toca roles, ni `identidad.usuarios_secciones`, ni el reparto.** Bajar la bandera tampoco
  cambia quién ve la entrada del menú: *«Lo que la bandera NO significa: que la pantalla se vea sin
  permiso»* (`lib/autorizacion/secciones.ts:86-88`). El día de LP-4, las mismas tres personas ven la
  pestaña — ahora con datos reales.
- **La tabla de `LP12-03` se le muestra al usuario antes de LP-4**, y se vuelve a medir con la misma
  consulta el día del despliegue. Si alguien concedió `contacts` en el medio, el número cambia, y eso
  tiene que verse antes de que esa persona vea 593 nombres, no después.
- **Se volvió a medir el día de LP-4**, el 2026-09-27 a las 02:26 UTC, con la misma consulta, y se le
  mostró al usuario antes del commit de la ruta: **4 usuarios activos, 3 ven la pestaña, y los 4 ya
  leían contactos** por `closer.ver`, `setter.ver` o `contactos.ver`. Nada cambió desde LP-0.

---

## 3 · Qué va en la lista y qué sólo en la ficha

### LP12-05 · La lista lleva catorce claves, y ninguna es de contacto

| clave | qué es | por qué va |
|---|---|---|
| `id` | `contactos.id` | para abrir la ficha (`LP12-07`) |
| `nombre` | el nombre | es lo único que permite reconocer a la persona |
| `altaEl` | el alta en el CRM | la cohorte y el orden |
| `campana`, `creativo` | `campaign` y `utmContent` | la línea «campaña · creativo» de la tarjeta |
| `puntaje`, `tramo` | el puntaje y su tramo | la tarjeta y el filtro |
| `territorio` | closer, setter o congelado | para decir «congelado» |
| `descartado` | sí o no | un booleano, no las etiquetas |
| `cita`, `asistencia`, `planton` | el estado de cita de la persona | el filtro de etapa |
| `vendio`, `monto` | venta y monto reportado | la tarjeta |

**Lo que no va en la lista, nombrado uno por uno:** `telefono`, `email`, `atribucion_primera`,
`atribucion_ultima`, `campos_del_crm`, las `etiquetas` crudas, el `crm_asignado_a` crudo,
`ghl_contact_id` y `ultimo_entrante_texto`.

La maqueta ya partía así: la tarjeta de la rejilla dibuja nombre, origen, puntaje, monto y
progreso (`aios-command-center_1.html:4757-4775`), y el teléfono y el correo aparecen sólo en la ficha
(`aios-command-center_1.html:4861-4863`). La decisión conserva el reparto; lo que agrega es que sea un
contrato comprobado y no una costumbre del marcado.

**Requisito:** la prueba de la cohorte afirma que las claves de cada fila son **exactamente** la lista
blanca, y la de la ruta que la lista no trae teléfono, correo, atribución ni `campos_del_crm` (plan,
LP-2 y LP-4). «Exactamente» y no «no contiene X»: una clave nueva agregada mañana tiene que poner la
prueba en rojo, aunque no sea ninguna de las prohibidas hoy.

### LP12-06 · La ficha trae el contacto, y el resto pasa por lista blanca

La ficha lleva el teléfono, el correo, el país, el alta, la última sincronización, el puntaje con su
tramo, el recorrido, el cuestionario de calificación, el estado del formulario, el video precall
como texto del CRM (`05-LA-FICHA-DEL-LEAD.md`, `LP05-11`), el conteo y las
fechas de los mensajes, las citas, los resultados y el closer asignado. Lo que **no** trae, y por qué:

| dato | cuántos lo tienen (2026-09-27) | por qué no viaja |
|---|---|---|
| `ip` | 331 | es un dato personal y nadie pidió publicarlo (`docs/acquisition/08-DE-DONDE-VIENE-CADA-DATO.md:238`) |
| `userAgent` | 331 | ídem |
| `fbclid` | 286 | identificador de clic de Meta |
| `fbp`, `fbc` | 69 · 66 | cookies de Meta |
| `gaClientId` | 41 | identificador de Google Analytics |
| la `url` y el `referrer` completos | 331 · 66 | **286 URLs llevan un token adentro**: va sólo el host (`docs/acquisition/08-DE-DONDE-VIENE-CADA-DATO.md:239`) |
| una clave que no está en la lista blanca | — | nace invisible |
| los campos del CRM sin grupo (174), **salvo «Form Landing VSL»** | — | ahí están la atribución de campañas y los enlaces del sistema (`lib/ghl/contrato.ts:243-245`); la excepción está debajo de la tabla |
| el texto de los mensajes | — | `ultimo_entrante_texto` (`db/migraciones/011_negocio_closer_setter.sql:131`) y el cuerpo no viajan: la conversación tiene su pantalla y su capacidad |
| el id crudo del asignado | 1 que no cruza | se dice «no configurado como closer» |

**La excepción de los campos sin grupo.** El estado del formulario que la ficha sí lleva es «Form
Landing VSL», y vive en la carpeta «📁 Score | ICP», que no tiene grupo
(`docs/OTROS/estado actual/06-INTEGRACIONES-GHL.md:739`). Viaja porque se lee **por nombre**, con
`CAMPO_DEL_FORMULARIO` (`lib/negocio/recorrido.ts:208`), no porque su carpeta pase. Es el único
campo sin grupo que viaja; el detalle, en `LP09-09`.

La columna guarda todo eso tal como llega del CRM (`lib/ghl/cliente.ts:215-225`), y la migración que
la creó dejó escrita la regla que esta ficha cumple: *«ninguna pantalla los renderiza tal cual»*
(`db/migraciones/048_de_donde_vino_el_lead.sql:94-99`). La lista blanca, clave por clave, está en
`09-DE-DONDE-VIENE-CADA-DATO.md`, `LP09-08`.

### LP12-07 · La ficha se abre por id, nunca por nombre

La maqueta abre la ficha **por nombre**: `window.AIOSLeadCard` busca el nombre en minúscula
(`aios-command-center_1.html:4873-4875`), y si no lo encuentra **dibuja la ficha del primer lead con el
nombre pedido** (`aios-command-center_1.html:4876-4877`). El cajón de grupo la llamaba con el texto de la
fila, hasta que LP-6 sacó ese clic junto con la maqueta (`lib/aios/leads-group.js:57-59` es el
comentario que quedó).

Con personas inventadas es un atajo. Con 593 reales son dos defectos de privacidad: dos personas con
el mismo nombre abren la misma ficha, y un nombre que no está muestra **el teléfono de una persona
bajo el nombre de otra**.

**Requisito:** la ficha se pide por `id`. Un id que no es un UUID, o que es de otra empresa, responde
404, y los dos casos son indistinguibles a propósito, como en la ficha del contacto (líneas 78-89 de
`app/api/contactos/[id]/route.ts`). Y se dibuja en un cajón con id propio, no en `#drawer`
(`components/Overlays.jsx:120-136`), que Executive usa: un cajón compartido puede quedar mostrando
los datos de una persona cuando otra pantalla lo abre.

### LP12-08 · Sin enlace a GoHighLevel; llamar y escribir

La maqueta salta al CRM desde dos lugares: el botón «↗ GHL» de la ficha
(`aios-command-center_1.html:4809`, con su `window.open` en `aios-command-center_1.html:4865-4866`) y la
flecha de cada fila del cajón de grupo (`lib/aios/leads-group.js:51`, `lib/aios/leads-group.js:54-56`).
Los dos abren la portada del CRM, no el contacto (`lib/aios/leads-group.js:8`).

**Decisión del 2026-09-26: no hay enlace.** En la ficha del Closer ya se quitó a pedido, en el commit
`bd26085` del 2026-08-27, y el campo que lo armaba se fue con él (líneas 95-105 de
`app/api/contactos/[id]/route.ts`). La pestaña no es una puerta a otro sistema con sus propios
permisos.

Lo que queda son dos acciones: **llamar** (`tel:`) y **escribir un correo** (`mailto:`), atenuadas
cuando falta el dato. El número y la dirección van en el enlace, y son los mismos que la ficha ya
muestra: no es una exposición nueva.

### LP12-09 · Nada de esto queda guardado en un caché

`ok()` responde con `cache-control: no-store` (`lib/autorizacion/respuesta.ts:293-295`), y el lector
del navegador pide también sin caché (`lib/http/cliente.ts:147-149`). **Requisito:** la pantalla no
guarda la lista ni la ficha en el almacenamiento del navegador. Una lista de 593 nombres que
sobrevive al cierre de sesión en una computadora compartida es la fuga más barata de todas.

---

## 4 · La bandera, y los dos ADR

### LP12-10 · `sinOperacionesTodavia` bajó en LP-4, en el mismo commit que la primera ruta

`contacts` era una de las dos secciones que conservaban la bandera, junto con `executive`
(`lib/autorizacion/secciones.ts:216`). El comentario de Sales lo anticipaba cuando decía *«las dos que
quedan no están empezadas»*; desde LP-7 dice que `contacts` salió (`lib/autorizacion/secciones.ts:322-323`). En LP-4 la línea de la bandera pasó
a ser su comentario (`lib/autorizacion/secciones.ts:225`), y queda sólo `executive`.

No es documentación: es un cable trampa que dispara en tres lugares.

| dónde | qué afirma | con la bandera puesta y la ruta nueva | sin la bandera y sin ruta |
|---|---|---|---|
| `pruebas/codigo/30-portero.test.ts:325-348` | ninguna ruta declara la `PANTALLA` de una sección con bandera | **rojo** | verde |
| `pruebas/codigo/30-portero.test.ts:441-458` | la bandera no miente, en las dos direcciones | **rojo** | **rojo** |
| `pruebas/codigo/90-fundaciones.test.ts:1187-1191` | `SIN_OPERACIONES_TODAVIA.length` vale 1, literal desde LP-4 | **rojo** si se baja la bandera sin tocar el número | — |

**Requisito, cumplido en LP-4:** la ruta `app/api/leads-portal/route.ts`, la bandera bajada con su
comentario —como el de Sales—, y el 2 que pasó a 1 **fueron en el mismo commit**. Es la séptima vez que el cable dispara,
según la cuenta que lleva `pruebas/codigo/90-fundaciones.test.ts:1176-1179`.

### LP12-11 · El `ADR-0304` obliga a que la lista y la ficha pidan lo mismo

`ADR-0304`: *«Las operaciones de una misma pantalla piden el mismo conjunto de capacidades»*
(`lib/autorizacion/secciones.ts:2`). La prueba agrupa los `GET` por `PANTALLA` y exige un solo conjunto
(`pruebas/codigo/30-portero.test.ts:418-426`).

O sea que `GET /api/leads-portal` y `GET /api/leads-portal/[id]` piden **los dos** `['tablero.ver']`.
**La ficha no puede pedir además `contactos.ver`**: sería otro conjunto, y la prueba lo pone en rojo.

La consecuencia hay que tenerla a la vista: la garantía de `LP12-03` —nadie ve un teléfono que no
pudiera leer ya— **no la da esta pantalla**, la da un hecho del reparto: que todo rol con
`tablero.ver` trae también `contactos.ver`. Si eso deja de ser cierto, la pestaña no se entera
(`LP12-P02`).

El `ADR-0303` —*«Todo rol asignable tiene al menos una pantalla»* (`lib/autorizacion/secciones.ts:1`)—
no se mueve: no se crea ningún rol.

### LP12-12 · Lo que el cambio no toca

- **El galón se queda** (`lib/autorizacion/secciones.ts:226`), por el precedente de Creative: el
  adorno es del prototipo, y lo que estaba mal no era él sino que detrás no hubiera nada
  (`lib/autorizacion/secciones.ts:258-261`).
- **No se pierde cobertura en `91-closer-y-setter`.** Su recorrido de los tableros itera
  `SIN_OPERACIONES_TODAVIA` (`pruebas/codigo/91-closer-y-setter.test.ts:272-275`), así que cuando
  `contacts` salga de la lista deja de nombrarla. Pero la aserción de arriba compara el menú entero
  del closer contra `['closer']` (`pruebas/codigo/91-closer-y-setter.test.ts:267-268`), y ésa sigue
  cubriéndolo — con el conjunto histórico de `LP12-02`.

---

## 5 · Lo que dice el documento

### LP12-13 · Nada: «Permisos y roles» está pendiente

El documento funcional pone **«Permisos y roles»** entre las secciones que todavía no especifica
(`§ 17:1119`). Describe lo que ven tres grupos de usuarios:

- los de Team Execution, con Gerencia aparte: reportes de su área, alertas, tareas, prioridades,
  responsables (`§ 7.2:393-415`);
- los de Conversation Intelligence: reportes de su módulo, alertas, **conversaciones
  problemáticas**, errores y tareas (`§ 13:979-999`, la de las conversaciones en `:993`);
- los de Acquisition —media buyer, responsable creativo, gerencia—: rendimiento, alertas y tareas
  (`§ 18.15:1499-1531`).

**Ninguno ve una lista de leads con sus datos de contacto.** Lo más cercano son las conversaciones
problemáticas de Conversation Intelligence, que son conversaciones y no un padrón de personas. El
teléfono y el correo aparecen **una sola vez**, como datos que consumen los agentes de Lead Flow
(`§ 9.6:558-559`), no como columnas de una pantalla.

**La regla de este archivo es nuestra, no del documento**, y por eso está escrita con su fecha y con
quién la decidió. Ver `11-LO-QUE-PIDE-EL-DOCUMENTO.md`.

---

## Preguntas abiertas

### LP12-P01 · ¿Alguno de los tres que ven la pestaña es un closer vinculado? — **sin medir**

Si lo es, en Closer ve sólo sus asignados y en el portal vería los 593. La decisión —«quien tenga la
pestaña»— dice que los ve; lo que falta es tomarla con el número a la vista, antes de LP-4. Es la
misma tensión que Sales dejó declarada (`docs/sales/12-QUIEN-VE-QUE.md:78-96`), y acá pesa más
porque la lista trae nombres de leads, no de closers.

```sql
with org as (select id from identidad.organizaciones where slug = 'aria')
select count(distinct u.id)
  from identidad.usuarios u
  join negocio.closer_asignado ca on ca.org_id = u.org_id and ca.usuario_id = u.id
                                 and ca.crm_usuario_id is not null
  join identidad.usuarios_roles ur on ur.usuario_id = u.id
  join identidad.roles ro on ro.id = ur.rol_id
  join identidad.roles_permisos rp on rp.rol_id = ro.id and rp.permiso = 'tablero.ver'
 where u.org_id = (select id from org) and u.activo
   and (not ro.secciones_restringidas
        or exists (select 1 from identidad.usuarios_secciones us
                    where us.usuario_id = u.id and us.seccion = 'contacts'));
```

### LP12-P02 · ¿Se vigila que ningún rol tenga `tablero.ver` sin `contactos.ver`?

Hoy es cierto por derivación (`LP12-03`). Pero el documento nombra un rol que querría exactamente
eso —**Gerencia**, que ve el estado general y no personas (`§ 18.15:1521-1531`)—, y el día que
alguien lo cree con sólo los tableros, la ficha del portal le va a mostrar el teléfono y el correo de
593 personas sin que nadie lo haya decidido y **sin que falle ninguna prueba**.

Dos salidas: una prueba sobre el reparto que afirme la implicación, o aceptarlo y dejarlo escrito
junto a la capacidad en el catálogo. La primera cuesta una prueba de base; la segunda, una línea que
alguien tiene que leer. **Decide el usuario.**
