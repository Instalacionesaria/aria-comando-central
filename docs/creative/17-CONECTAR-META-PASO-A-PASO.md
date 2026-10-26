# Conectar Meta, paso a paso

> Para la persona del equipo que tiene acceso de **administrador al Business Manager** dueño de la cuenta
> publicitaria. No hace falta saber programar. Toma unos quince minutos.
>
> Escrita el **2026-10-15**, con lo de Comando Central ya construido: «Probar conexión» en Ajustes y la tarea que
> trae la miniatura de cada anuncio (`15-LA-MINIATURA-Y-EL-VIDEO.md`, etapas M-1 a M-3). Los nombres de las pantallas
> de Meta son los de su documentación a esa fecha: si cambiaron, el orden de los pasos es el mismo.

> **2026-10-26 · Meta directo (construido en local, sin subir).** Lo normal pasa a ser el botón **«Conectar con Meta»**
> de Ajustes: el negocio elige sus cuentas en el diálogo de Meta y no hace falta crear una app ni un token. Esta guía queda
> para el **token pegado a mano**, que sigue como respaldo, plegado en «Avanzado: un token de Meta pegado a mano». Ver `docs/OTROS/produccion/META-DIRECTO.md`.

---

## Qué se consigue

Con el token cargado, **Creative muestra la miniatura de cada anuncio** y el botón «Ver en Facebook/Instagram» abre el
post del anuncio. Hasta hoy la imagen llega sólo con los contactos que entran por un anuncio de Instagram que abre un
mensaje directo: 3 contactos de 526, una sola pieza con imagen en 30 días (medido el 2026-10-15).

El token es **sólo de lectura**: con los tres permisos de abajo no se puede crear, pausar, editar ni gastar nada.

## Antes de empezar

- Tener rol de **administrador** en el Business Manager (hoy se llama «portfolio comercial») que es dueño de la cuenta
  publicitaria de los anuncios.
- Tener a mano el número de la **cuenta publicitaria**: es el `act_…` que se ve en el Administrador de anuncios,
  arriba a la izquierda, o en *Configuración del negocio* → *Cuentas* → *Cuentas publicitarias*.
- **El token no se manda por chat ni por correo.** Se pega directamente en Comando Central, queda cifrado, y desde
  ahí nadie lo vuelve a ver: ni desarrollo.

## Paso 1 · Crear la app

1. Entrar a `developers.facebook.com` → *Mis apps* → *Crear app*.
2. Tipo **Empresa** (o «Otro» → «Empresa», según cómo lo pregunte Meta).
3. Vincularla al Business Manager de la empresa.
4. Dentro de la app, agregar el producto **Marketing API**.

No hace falta publicar la app ni pedir revisión: una app que sólo lee su propia cuenta publicitaria usa el acceso
estándar de Meta.

## Paso 2 · Crear el usuario del sistema

1. Entrar a `business.facebook.com` → *Configuración del negocio* → *Usuarios* → **Usuarios del sistema** → *Agregar*.
2. Un nombre que diga para qué es, por ejemplo **«Comando Central (lectura)»**.
3. Rol **Empleado**, no administrador: no necesita más.

Un usuario del sistema no es una persona: si alguien se va del equipo, el token sigue funcionando.

## Paso 3 · Asignarle los activos, sólo con lectura

Con el usuario del sistema elegido → **Asignar activos**:

| activo | qué marcar |
|---|---|
| la **cuenta publicitaria** de los anuncios | sólo **ver el rendimiento**. Nada de administrar campañas |
| la **Página de Facebook** con la que corren los anuncios | sólo **ver el contenido** |
| la **app** del paso 1 | si Meta la pide para generar el token: con el permiso mínimo que ofrezca |

Si los anuncios también corren en Instagram, la cuenta de Instagram va con la Página: no hace falta asignarla aparte.

## Paso 4 · Generar el token

1. Con el usuario del sistema elegido → **Generar nuevo token**.
2. Elegir la app del paso 1.
3. Vencimiento: **«Nunca»** si Meta lo ofrece. Si sólo ofrece 60 días, sirve igual, pero hay que repetir este paso y
   el siguiente antes de que venza.
4. Marcar **solamente** estos tres permisos:
   - `ads_read`
   - `pages_read_engagement`
   - `pages_show_list`
5. Generar y **copiar** el token. Meta lo muestra una sola vez.

## Paso 5 · Cargarlo en Comando Central

1. Comando Central → **Ajustes** → **Credenciales** → la empresa.
2. **Token de Meta**: pegar el token y guardar.
3. **Cuenta publicitaria de Meta**: el `act_…` y guardar. Sirve con o sin el `act_` adelante.

Después de guardar, Ajustes muestra el token como **cargado**, sin su valor.

## Paso 6 · Probar la conexión

En la misma pantalla, la tarjeta **«La conexión con Meta»** → **Probar conexión**. Comando Central le pregunta a Meta,
sin escribir nada, en tres pasos y en este orden:

| paso | qué mira |
|---|---|
| **1 · El token** | que Meta acepte el token |
| **2 · La cuenta publicitaria** | que con ese token se vea la cuenta `act_…` cargada |
| **3 · La lectura de los anuncios** | que se puedan leer los anuncios de la cuenta y sus imágenes |

Si sale bien dice **«Conectado con «nombre de la cuenta»»**, la moneda, y cuántos de los últimos anuncios traen una
miniatura. Si sale mal dice en qué paso falló y qué hacer:

| lo que dice | qué hacer |
|---|---|
| Meta rechazó el token | volver al paso 4: generar uno nuevo y cargarlo de nuevo |
| El token no tiene permiso para esto | revisar el paso 3 (la cuenta y la Página asignadas) y el paso 4 (los tres permisos) |
| Meta no encuentra la cuenta publicitaria | revisar el número `act_…` y que esa cuenta esté asignada al usuario del sistema |
| Meta limitó las llamadas / no contestó | esperar unos minutos y probar de nuevo |
| La cuenta no está activa en Meta | la conexión anda; sin anuncios en curso no hay miniaturas nuevas |

Los textos completos están en `lib/meta/graph.ts:66-81` y la tarjeta en `components/ajustes/ConexionConMeta.jsx`.

## Paso 7 · Esperar la primera pasada

Una tarea automática corre **cada hora, en el minuto 37**, y trae la miniatura y el post de hasta 200 anuncios por
pasada, primero los que entregaron hace menos. Después de cargar el token, a lo sumo en una hora las miniaturas
aparecen en **Creative**; si la cuenta tiene más de 200 anuncios, el resto llega en las horas siguientes. Cada hora vuelve a pedir las que están por vencer: las imágenes de Meta vienen firmadas y
vencen, y así ninguna se ve rota.

Para saber si la tarea anda, se le puede preguntar al agente de Creative si las fuentes están al día: entre ellas
está «la lectura de las miniaturas de los anuncios en Meta».

## Si algo falla más adelante

- **El token venció o alguien lo revocó**: la tarea deja de traer miniaturas y su registro dice «Meta rechazó el
  token». Se repiten los pasos 4 a 6.
- **Se cambia de cuenta publicitaria**: se carga el `act_…` nuevo en el paso 5 y se asigna esa cuenta al usuario del
  sistema (paso 3).
- **Para cortar el acceso**: en el Business Manager, quitarle los activos al usuario del sistema o borrarlo. El token
  deja de servir en el momento.

## Lo que NO se usa

El token de la Página que GoHighLevel guarda para su propia integración con Meta: es una credencial de la app de
GoHighLevel, y usarla por fuera de GoHighLevel puede ir contra los términos de Meta y de GoHighLevel (`C14-21`).
