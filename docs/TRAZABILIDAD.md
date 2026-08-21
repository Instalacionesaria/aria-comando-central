# Trazabilidad — regla ↔ identificador ↔ prueba

**Generado.** No editar a mano: sale de `tools/graphify/spec-overlay.mjs`,
que parsea las tablas de `PRUEBAS.md`. Regenerar con:

```bash
node tools/graphify/spec-overlay.mjs --trazabilidad
```

## Cómo se usa

El identificador va en un **comentario** del archivo que implementa la regla y
del que la prueba. El paso AST de graphify reconoce `ADR-NNNN` dentro de una línea
de comentario y crea una arista `archivo --cites--> ADR-NNNN` con confianza
`EXTRACTED`, gratis y refrescada por cada `graphify update`. Entonces:

```bash
graphify affected "ADR-0301" --relation cites --depth 1
```

devuelve **la implementación y su prueba como una sola respuesta**.

> Un `describe('ADR-0207 …')` **no** se escanea: tiene que estar en un comentario.

Total: **75 reglas**, de las cuales **26 son ⛔**.

## Etapa 0

| ID | ⛔ | Regla | La prueba | Tipo |
| --- | --- | --- | --- | --- |
| `ADR-0001` | ⛔ | Las pruebas corren en cada cambio y pueden bloquear | Una prueba que falla a propósito bloquea la integración | Código |
| `ADR-0002` | ⛔ | Las migraciones son versionadas y se aplican igual en todos lados | El entorno de pruebas se levanta solo desde las migraciones | Base |
| `ADR-0003` | ⛔ | Hay dos organizaciones con datos distintos en desarrollo | El sembrado crea dos, con un usuario en cada una | Base |

## Etapa 1

| ID | ⛔ | Regla | La prueba | Tipo |
| --- | --- | --- | --- | --- |
| `ADR-0101` |  | El administrador fundador no se borra, no se desactiva, no se degrada | Las tres operaciones fallan contra la base, no contra el backend | Base |
| `ADR-0102` |  | La organización principal no se desactiva | La operación falla contra la base | Base |
| `ADR-0103` |  | El rol de plataforma solo existe en la organización principal | Asignarlo a un usuario de un cliente falla contra la base | Base |
| `ADR-0104` |  | Un rol privado de una organización no se asigna a usuario de otra | La inserción cruzada falla contra la base | Base |
| `ADR-0105` |  | La auditoría es inmutable | update y delete fallan, y el rol no tiene el permiso | Base |
| `ADR-0106` |  | Las referencias dentro del inquilino no cruzan organizaciones | Insertar una fila que referencia un registro de otra organización falla | Base |
| `ADR-0107` | ⛔ | Toda tabla tiene seguridad de fila activada, forzada y con política | Consulta al catálogo: cero tablas sin las tres cosas | Catálogo |
| `ADR-0108` | ⛔ | Y además, permisos: la tabla es accesible para el rol que la usa | has_table_privilege por tabla. Una tabla con política perfecta y sin permiso pasa la fila anterior y rompe en producción | Catálogo |
| `ADR-0109` | ⛔ | Ninguna tabla quedó sin forzar | Una tabla con seguridad y política pero sin forzar deja que su dueño la evada, y el catálogo la muestra igual que una correcta | Catálogo |
| `ADR-0110` |  | El esquema de catálogos solo tiene lo declarado, y ninguna de sus tablas lleva columna de organización | Es el único camino por el que una tabla de negocio puede nacer sin aislamiento y sin que nada falle | Catálogo |

## Etapa 2

| ID | ⛔ | Regla | La prueba | Tipo |
| --- | --- | --- | --- | --- |
| `ADR-0201` | ⛔ | Ninguna consulta corre sin organización activa | Una consulta sin contexto lanza | Código |
| `ADR-0202` | ⛔ | Toda operación abre el contexto de su organización | Recorre los archivos de operaciones y verifica que cada una lo abre — salvo las rutas públicas y las operaciones del dominio de identidad, que van en una lista explícita. Sin esa exención la prueba falla sobre código correcto y se termina ignorando | Código |
| `ADR-0203` |  | Un solo lugar crea el cliente de base | Ningún archivo fuera de la capa de datos importa el controlador | Código |
| `ADR-0204` | ⛔ | Los roles de la aplicación no pueden saltear las políticas | bypassrls es falso y no son superusuarios | Catálogo |
| `ADR-0205` | ⛔ | Sin organización en contexto, no se ve nada de negocio | La consulta lanza o devuelve 0. Exigir exactamente 0 hace una prueba que pasa o falla según el estado del agrupador de conexiones | Base |
| `ADR-0206` | ⛔ | Con la organización A no se ve ni una fila de la B | Dos organizaciones sembradas, consulta desde A | Base |
| `ADR-0207` | ⛔ | La escotilla no llega a las tablas de negocio | Con el rol de identidad, consultar negocio lanza permiso denegado (no vacío) | Base |
| `ADR-0208` | ⛔ | El dominio del inquilino no llega a las tablas de identidad | Con el rol del inquilino, consultar sesiones lanza | Base |
| `ADR-0209` |  | Ninguna operación cruza los dos dominios sin decirlo | Los archivos que mencionan los dos accesos se revisan a mano: entre dos dominios no hay atomicidad, y la mitad que falla no puede reportar éxito | Código |
| `ADR-0210` |  | Los rellenos de datos tocan filas de verdad | Con las políticas puestas, el rol que migra no ve nada: un update de relleno informa cero filas sin error. Contar antes y después | Base |
| `ADR-0211` |  | Solo los archivos autorizados usan el acceso sin filtro | Lista explícita, y un archivo nuevo rompe la suite | Código |

## Etapa 3

| ID | ⛔ | Regla | La prueba | Tipo |
| --- | --- | --- | --- | --- |
| `ADR-0301` | ⛔ | Toda operación llama al portero | Recorre los archivos de operaciones y las funciones que el framework expone solas, salvo las rutas públicas (login, salud, arranque) | Código |
| `ADR-0302` |  | El permiso se pregunta por capacidad, nunca por nombre de rol | Ninguna comparación con un nombre de rol en el código | Código |
| `ADR-0303` |  | Todo rol asignable tiene al menos una pantalla | Cruce entre roles asignables y secciones de menú | Código |
| `ADR-0304` |  | Las operaciones de una misma pantalla piden el mismo conjunto de capacidades | Agrupadas por pantalla, los conjuntos coinciden | Código |
| `ADR-0305` |  | Un rechazo por permiso no se muestra como "no hay datos" | El cliente HTTP distingue el rechazo del vacío legítimo | Código |
| `ADR-0306` |  | Toda petición que modifica verifica el origen | Una petición con origen ajeno se rechaza | Código |

## Etapa 4

| ID | ⛔ | Regla | La prueba | Tipo |
| --- | --- | --- | --- | --- |
| `ADR-0401` |  | El mensaje único va con el tiempo único | El login con email inexistente y con contraseña incorrecta tardan lo mismo | Código |
| `ADR-0402` |  | El freno por intentos no se evade | Una cabecera de origen falsificada no evade el freno | Código |
| `ADR-0403` |  | La búsqueda usa la misma expresión que el índice único | Un usuario guardado con mayúsculas puede entrar | Base |
| `ADR-0404` |  | La sesión tiene techo absoluto | Una sesión creada hace más del techo no entra, aunque se haya usado a diario | Base |
| `ADR-0405` |  | La cookie lleva el prefijo y los atributos | La respuesta del login trae el nombre y los cuatro atributos | Código |
| `ADR-0406` |  | El cambio de contraseña no exige capacidades | Es la única salida del estado de contraseña temporal | Código |
| `ADR-0407` | ⛔ | Ninguna ruta de autenticación registra cuerpos | Ningún archivo de esas rutas pasa el cuerpo a la función de registro | Código |
| `ADR-0408` |  | Ninguna ruta específica de un estado está en dos listas | Comparando sin el conjunto común (consultar y cerrar sesión, que están a propósito en las cuatro) | Código |
| `ADR-0409` |  | De todo estado se puede salir y preguntar quién soy | Cerrar sesión y consultar la sesión están en las cuatro listas | Código |
| `ADR-0410` | ⛔ | Un endpoint nuevo nace cerrado a los estados restringidos | Recorre las rutas que llaman al portero: las que no están en ninguna lista responden rechazo. Sin acotarlo, la prueba falla sobre el login y la comprobación de salud | Código |
| `ADR-0411` |  | La sesión a medio autenticar no llega a nada real | Con una sesión pendiente, todas las rutas fuera de su lista rechazan | Código |
| `ADR-0412` | ⛔ | Todo rol de plataforma exige segundo factor | Consulta a la tabla de roles: cero filas con solo_principal y la bandera apagada; y asignar un rol así sin la bandera falla | Catálogo |
| `ADR-0413` | ⛔ | Un usuario con un rol que exige segundo factor no obtiene sesión habilitada | El login devuelve un estado restringido, no activa, y el portero corta | Código |
| `ADR-0414` |  | El estado de la sesión existe como dato | La columna está en el esquema con su restricción de valores. Sin ella todo el mecanismo es decorativo | Catálogo |

## Etapa 5

| ID | ⛔ | Regla | La prueba | Tipo |
| --- | --- | --- | --- | --- |
| `ADR-0501` | ⛔ | Un administrador no opera sobre usuarios de otra organización | Para crear, editar, desactivar, restablecer y asignar rol con el identificador de un usuario ajeno: responde 404, nunca 200 — y 404 y no 403, porque un 403 confirma que ese identificador existe | Código |
| `ADR-0502` |  | Nadie se borra, desactiva ni degrada a sí mismo | La operación sobre el propio identificador se rechaza | Código |
| `ADR-0503` |  | No se puede dejar una organización sin administrador activo | Desactivar al último administrador se rechaza | Código |
| `ADR-0504` |  | Un administrador no puede otorgar el rol de plataforma | Rechazo en el endpoint y en la base | Base |
| `ADR-0505` |  | Restablecer una contraseña cierra las sesiones | Después del restablecimiento, las sesiones del usuario no valen | Base |
| `ADR-0506` |  | La contraseña temporal nunca queda registrada | No aparece en la auditoría ni en ningún registro | Código |
| `ADR-0507` |  | El generador de temporales no tiene sesgo | Distribución de caracteres sobre muchas muestras | Código |
| `ADR-0508` |  | Una organización nueva no hereda credenciales | Nace sin ninguna, no opera, y la respuesta lo dice | Base |

## Etapa 6

| ID | ⛔ | Regla | La prueba | Tipo |
| --- | --- | --- | --- | --- |
| `ADR-0601` | ⛔ | Ningún secreto llega al navegador | El paquete construido no contiene los nombres ni los valores | Construcción |
| `ADR-0602` |  | El nonce es distinto en cada cifrado | Cifrar dos veces el mismo valor da resultados distintos | Código |
| `ADR-0603` |  | El descifrado fallido lanza con un mensaje accionable | Nunca devuelve nulo ni vacío | Código |
| `ADR-0604` |  | Sin credencial, la organización no opera y lo dice | Ningún respaldo implícito a la credencial de otra organización | Código |
| `ADR-0605` |  | Dos refrescos simultáneos no se invalidan | Dos peticiones a la vez: una refresca, la otra usa el resultado | Base |
| `ADR-0606` |  | Un estado ausente y uno vencido no se muestran igual | Cada uno con su texto; nunca un cero como si fuera un dato | Código |

## Etapa 7

| ID | ⛔ | Regla | La prueba | Tipo |
| --- | --- | --- | --- | --- |
| `ADR-0701` | ⛔ | Ninguna ruta autenticada se cachea | Ningún archivo de rutas usa primitivas de caché fuera de una lista autorizada | Código |
| `ADR-0702` | ⛔ | Ninguna respuesta autenticada lleva caché pública | Las respuestas traen la cabecera de no almacenar | Código |
| `ADR-0703` | ⛔ | Toda memorización incluye la organización efectiva | Ninguna clave de caché sin la organización | Código |
| `ADR-0704` |  | Las respuestas de error no revelan estructura | Ningún cuerpo de error contiene nombres de tablas ni consultas | Código |

## Etapa 7b

| ID | ⛔ | Regla | La prueba | Tipo |
| --- | --- | --- | --- | --- |
| `ADR-7101` |  | Las versiones son exactas, sin rangos | Revisar el manifiesto; un rango es un cambio que nadie aprobó | Código |
| `ADR-7102` |  | El archivo de bloqueo está versionado | Un cambio en ese archivo sin cambio en el manifiesto bloquea la integración | Código |
| `ADR-7103` |  | Los guiones de instalación están desactivados | Con una lista corta de excepciones justificadas | Construcción |

## Etapa 8

| ID | ⛔ | Regla | La prueba | Tipo |
| --- | --- | --- | --- | --- |
| `ADR-0801` | ⛔ | El aislamiento se sostiene ahora, no solo en pruebas | Sonda cada hora: dos organizaciones de control, ninguna ve a la otra | Producción |
| `ADR-0802` | ⛔ | Una operación sin contexto avisa, no solo falla | La excepción del aislamiento emite un aviso inmediato | Producción |
| `ADR-0803` |  | Las credenciales ilegibles se detectan | Consulta diaria sobre la auditoría | Producción |
| `ADR-0804` |  | Los rechazos por permiso se vigilan | Resumen semanal por organización y capacidad | Producción |
| `ADR-0805` |  | Los intentos fallidos se vigilan | Consulta horaria, contando emails distintos por origen | Producción |
| `ADR-0806` |  | El acceso de soporte queda registrado | Todo cambio de organización activa queda en la auditoría | Producción |
| `ADR-0807` |  | El respaldo se puede restaurar | Restauración ensayada: los roles primero (no viajan en el volcado de la base), la aplicación arranca, se descifra una credencial, coinciden los conteos, y las pruebas de aislamiento pasan contra la copia | Producción |
| `ADR-0808` |  | El aviso funciona | El resumen se manda siempre, también cuando todo está en cero | Producción |
| `ADR-0809` | ⛔ | Las tres acciones de auditoría se emiten | Provocar cada una y verificar que aparece la fila. Sin esto, un cero en la vigilancia es indistinguible de "nadie cableó el punto de emisión", y tres de las seis señales quedan apagadas sin que nada falle | Código |
| `ADR-0810` |  | El aviso de aislamiento llega de verdad | Provocar la excepción en un entorno de ensayo y confirmar que el mensaje llega al medio elegido. Escribir en el registro del servidor no cuenta | Producción |
