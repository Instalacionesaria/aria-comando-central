# Permisos y privacidad

> Las capacidades nuevas y a quién le caen, lo que se apaga bajo delegación, qué datos de personas pueden
> viajar al modelo y cuáles no, y qué archivo entra en qué lista de autorizados. Requisitos `AG-80` a
> `AG-89`.

---

## De dónde sale

- `D-02`, `D-17`, `D-20`, `D-25` y `D-32` de `00-MAPA.md`.
- Det:43 y Det:229: quien no tiene la capacidad de una herramienta no la ve en la barra ni puede pedirle sus
  datos al cerebro; lo que el cerebro responde se limita a las capacidades de sus módulos y a su
  organización.
- El catálogo de capacidades (`db/arranque/001_catalogo.sql`, `lib/autorizacion/capacidades.ts`) y su paso a
  mano en producción (`docs/OTROS/produccion/DESPLIEGUE.md:114-122`).
- Las listas de autorizados de `pruebas/apoyo/autorizados.ts` y las pruebas que las hacen cumplir
  (`pruebas/codigo/10-arquitectura.test.ts`).

---

## AG-80 · Cuatro capacidades nuevas

| capacidad | quién la recibe | cuándo entra | la exige |
|---|---|---|---|
| `cerebro.usar` | los tres roles | AG5 | el POST y el DELETE de `app/api/executive` y de cada ruta `…/cerebro` |
| `senales.resolver` | los tres roles | AG9 | el POST de `app/api/<sección>/senales` (vista, resuelta, descartada) |
| `senales.validar` | administrador y superadministrador; al `usuario` se le niega **por clave** | AG9 | el mismo POST, cuando la señal requiere validación ejecutiva |
| `umbrales.firmar` | administrador y superadministrador; al `usuario` se le niega con `not like 'umbrales.%'` | AG9 | el PUT de `app/api/<sección>/umbrales` |

- **Cada capacidad entra con su primera ruta** (`T-22`): una capacidad sin puerta es lo que el catálogo le
  reprocha a `roles.administrar`.
- Una capacidad nueva **cae sola en los tres roles** salvo que se la excluya: el rol `usuario` se deriva por
  exclusión de familias (`db/arranque/001_catalogo.sql:393-398`).
- `pruebas/base/22-los-tres-roles.test.ts` pasa a afirmar que `usuario` **no** tiene `senales.validar` ni
  `umbrales.firmar` y que el administrador sí.
- **En producción, cada hito con capacidades nuevas corre el paso 4b** (`001_catalogo.sql` con
  `supabase.mjs correr`) y después se comprueba con una lectura de `identidad.roles_permisos`. Saltearlo no
  da ningún error: da 403 a todos.

## AG-81 · No hay secciones nuevas

Las claves de sección no cambian (NE-31). En `lib/autorizacion/secciones.ts` cambia **una sola línea**, la
bandera de `executive` en `:219`, que pasa a ser un comentario de una línea: no se suma ni se quita ninguna
(NE-33). Las rutas nuevas declaran `PANTALLA` (`03`, `AG-40`), así que no hace falta tocar `SIN_PANTALLA`.

## AG-82 · Bajo delegación

Cuando alguien de ARIA mira otra empresa (`contexto.mirandoOtraOrganizacion`, `lib/autorizacion/sesion.ts:127`),
todo lo que gasta la llave del cliente o escribe un autor de la principal dentro del cliente **se rechaza en
el servidor**, no sólo en la pantalla:

| operación | bajo delegación |
|---|---|
| Preguntar al cerebro, borrar un hilo | rechazado: el cerebro se apaga y lo dice |
| Generar o regenerar el Brief del closer | rechazado: gastaría la llave del cliente. El Brief ya guardado se lee |
| Marcar «vista», resolver, descartar o validar una señal | rechazado: un autor de la principal dentro de un cliente da `23503` (`docs/OTROS/estado actual/09-DEUDA-ABIERTA.md:868-903`) |
| Firmar un umbral | rechazado: la firma es del Admin **de la empresa** (`D-11`) |
| Ajustar los topes | permitido, con autor nulo: es configuración, y la casa ya lo resuelve así con `autorDelCambio` (`lib/autorizacion/sesion.ts:384-385`) |
| Leer señales, plan, Reunión, comentario de la cabecera | permitido: sólo leen |

## AG-83 · Qué datos de personas pueden viajar al modelo

- **El cerebro** trabaja con agregados y con listas **sin teléfono ni correo** (`D-17`). Cada herramienta
  proyecta por lista blanca (`03`, `AG-45`).
- **El texto libre** de personas (notas, mensajes de chat, transcripciones) no viaja al cerebro.
- **Las frases de las llamadas de venta** (con minuto, enlace y si se ganó) viajan sólo a quien tiene
  `analizadores.ver` (`D-20`), que es la capacidad propia que existe justamente para que un closer no lea
  las transcripciones de todo el equipo.
- **Los datos de una persona** sólo los ve un agente por contacto: el Brief del closer (`fichas/F13`), que
  además exige la sección `closer` y respeta «mío» (`T-20`).
- Lo que ya viaja hoy y no cambia: el auditor manda la conversación del lead y los Analizadores mandan la
  transcripción de la llamada.

## AG-84 · Registros

Ni el prompt ni la respuesta del modelo van a un registro ni a un incidente
(`db/migraciones/067_los_incidentes.sql:23`). `negocio.uso_de_ia` no guarda texto: sólo contadores,
modelo, agente, duración, resultado (`ok` o la situación `IA-*`), quién y una referencia de hasta 64
caracteres (el hilo, el análisis o la del incidente).

Y se cierra una deuda abierta: un análisis fallido de los Analizadores guarda hoy 200 caracteres de la
respuesta del modelo, que pueden traer datos del cliente (`lib/analizadores/nucleo/engine.ts:57`). En AG2 el
error guarda el código, no el texto.

## AG-85 · Retención

- **Las conversaciones** no vencen; las borra su autor (`D-14`), y se borran en cascada con la persona.
- **La evidencia guardada** en un hilo son ids y cifras; los nombres se resuelven al mostrar. Así un hilo
  viejo no acumula nombres de leads.
- **El Brief** guarda citas del formulario y de la llamada: su tabla cascadea con la cita.
- Las tres cosas se suman a la deuda del acuerdo de tratamiento de datos (`AG-86`).

## AG-86 · El acuerdo de tratamiento de datos

No existe un acuerdo con los clientes sobre mandar datos de sus leads a un proveedor de IA. Lo ve el equipo
(`D-32`); queda escrito como deuda abierta en `docs/OTROS/estado actual/09-DEUDA-ABIERTA.md`.

## AG-87 · El repositorio es público

La base sembrada es sintética, con dominios `.test`. Ningún nombre, correo, teléfono ni identificador real
en código, pruebas, documentos o commits.

## AG-88 · Las listas de autorizados, archivo por archivo

`conIdentidad` sólo en archivos de ruta, del sembrado y del guion de evaluación; **nada bajo
`lib/agentes/**` lo importa** (una prueba nueva lo vigila). Todo archivo con `conIdentidad(` va en
`ARCHIVOS_AUTORIZADOS` (`pruebas/apoyo/autorizados.ts:27`), y si además contiene `conOrganizacion(`, en
`CRUZAN_LOS_DOS_DOMINIOS` (`:432`), diciendo en su propio código qué pasa si la segunda mitad falla.

| archivo | qué resuelve en identidad | listas | etapa |
|---|---|---|---|
| `app/api/executive/route.ts` | la llave; el estado de las integraciones si la persona tiene `credenciales.ver`; el alumno de Fundaciones si ve ICP & Oferta | las dos | AG5 |
| `app/api/<sección>/cerebro/route.ts`, una por sección | lo mismo, para su sección | las dos | AG6 |
| `app/api/closer/brief/route.ts` | la llave | las dos | AG12 |
| `db/sembrado/casos-de-los-agentes.ts` | crea las empresas sintéticas | las dos | AG4 |
| `scripts/evaluar-agentes.mjs` | la llave de la organización principal, en la base local | las dos | AG4 |
| `app/api/<sección>/senales/route.ts`, `…/umbrales/route.ts`, `app/api/admin/cerebro/route.ts` | nada | ninguna: llevan `conOrganizacion(` literal | AG9, AG7 |

El cron (`app/api/cron/route.ts`) ya está en las dos listas; la tarea `senales` usa las llaves que el cron
resuelve en su fase de identidad.

## AG-89 · Quien no ve el Inicio

Una persona restringida (por ejemplo, sólo Sales › Closer y Research › Radar) usa el cerebro desde la caja
del pie de sus pestañas, con las herramientas de lo que ve. Guarda sus hilos y los borra desde el panel que
sube. No ve CONVERSACIONES ni la Reunión de hoy, igual que hoy.

---

## Lo que no se pudo verificar

- Si `scripts/evaluar-agentes.mjs` necesita identidad o le alcanza con leer la llave cargada en la base
  local por el camino de las rutas. Se decide en AG4; la tabla de arriba toma el peor caso.

## Preguntas abiertas

Ninguna para el usuario.
