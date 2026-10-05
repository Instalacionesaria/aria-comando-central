# Lo que se rompe en silencio

> Cada forma en que esta fase puede quedar mal **sin que nada falle**: cómo se vería y qué la vigila. Los
> números de prueba son los de `08-LAS-ETAPAS.md`.

---

| riesgo | cómo se vería | qué lo vigila |
|---|---|---|
| El cerebro ofrece la herramienta de una sección que la persona no ve | Un closer recibe cifras de Acquisition | El portero, porque cada ruta declara su pantalla (`03`, `AG-40`), y la 208 sobre las herramientas ofrecidas (AG5) |
| Una transacción queda abierta mientras se espera al modelo | El grupo de 5 conexiones se agota y la app entera se pone lenta | La 207 (estática) y la 210 (base, `pg_stat_activity`) (AG5) |
| Un dato personal viaja al modelo | Un correo en el resultado de una herramienta | La 213: juego exacto de claves por herramienta, más la negativa (AG5) |
| El modelo inventa una cifra | Un número plausible y falso, con formato de verdadero | La 208: la cifra que no está en su evidencia se quita y se dice (AG5) |
| La herramienta da otra cifra que la pantalla | Dos verdades para «7 días» | La 213, con 30 días desde AG5; las cuatro ventanas, en AG6 |
| La capacidad no llega al catálogo de producción | 403 para todos en el cerebro, o en resolver señales | El paso 4b en cada hito y la lectura de `identidad.roles_permisos` |
| La migración no está en producción al empujar | `42P01` en el Inicio o en el cron | La regla de aplicar antes del push, con el número verificado después del `pull` |
| La tarea `senales` queda `saltada` en empresas sin GHL | Ninguna señal en la mayoría de las empresas | La 99: la tarea está en la excepción del token del CRM |
| El cron sella una tarea que no trabajó | La frescura dice «al día» y las señales son de hace días | La 217: a quien no le toca no se lo sella |
| La «mañana local» es la de UTC | Las señales y la Reunión llegan de madrugada en América | La hora de la cinta de la Reunión (`04`, `AG-76`) y la carga de la zona antes de AG8 |
| Una señal descartada renace cada mañana | Se aprende a ignorar la tarjeta | La 215 |
| Una fuente apagada cierra señales | «Se cerró sola» cuando en realidad dejó de medirse | La 215, con `sin_medicion` |
| Falsa alerta de «sin entrega» en una zona al este de UTC | Una crítica todas las mañanas antes de recolectar el gasto | La 217: sin datos de anuncios del día, no hay señales de costo |
| Un `usuario` resuelve una señal de validación ejecutiva | Se salta la validación | La 22 (`senales.validar` no le cae) y la regla del POST |
| Un hilo ajeno se lee por id | Una persona lee lo que preguntó un colega | La 208 (404 para un hilo ajeno) |
| Dos preguntas en paralelo pasan el tope | 51 de 50 | La 208, con el candado de fila |
| Una llamada real sin OK | Gasto en la llave de ARIA | `--confirmo N` (204) y el pedido en el chat |
| La llave de un cliente en una evaluación | Gasto ajeno | El guion sólo corre contra la base local; la regla está en `07`, `AG-104` |
| Un modelo mal escrito | `IA-MODELO` en todas las preguntas, con todas las pruebas en verde | La 199 y la comprobación del modelo antes de la primera llamada real |
| Una herramienta forzada con `claude-sonnet-5-5` | Un 400 en todas las preguntas, con todas las pruebas en verde | La 198 para los agentes nuevos (compara el cuerpo entero); la 199 para los que ya existían, que fuerzan su herramienta y no pueden pasar a ese modelo sin quitarla |
| Un esquema con restricciones que el modo estricto no admite | Un 400 en todas las llamadas de ese agente | Una prueba de AG5: cada esquema de herramienta y de formato, sin `minimum`, `maximum`, `multipleOf`, `minLength` ni `maxLength`, y con `additionalProperties: false` en cada objeto |
| Un historial que se edita entre rondas | Un 400 en las cuentas nuevas («preserved thinking») | Una prueba de AG5: rondas seguidas de una pregunta mandan las mismas instrucciones y herramientas, y el historial anterior más lo agregado |
| Un registro guarda el texto del modelo | Datos de leads en un registro o un incidente | La 200 fija el juego exacto de columnas de `uso_de_ia`, ninguna para el texto del modelo; la 201 para el error de los Analizadores |
| El panel del pie reusa un id prohibido | La 156 en rojo, o alguien la afloja | Ids nuevos (`03`, `AG-57`) |
| Un aviso nuevo sin lector, o un comentario siempre encendido | La cabecera dice algo todos los días y se deja de leer | La 230 (la regla del silencio) |
| Un tema de la Reunión de una sección que la persona no ve | Fuga entre áreas | La 229: un texto por tema, sin referencias cruzadas, y el filtro antes de tomar tres |
| El Brief se genera bajo delegación | Gasto de la llave del cliente por alguien de ARIA | La 225 |
| Citas `archivo:línea` corridas | Los documentos mandan a la línea equivocada | La 101 (que no pasen del final) y el mapa del diff de cada etapa (que sigan apuntando a lo mismo) |
| La rama de ICP & Oferta y este plan tocan lo mismo | Un conflicto resuelto a ciegas que deshace un cambio ajeno | La coordinación de `00-MAPA.md`: AG2 y AG3 después de integrar la rama |
| Un número de migración en carrera | Dos `069` con nombres distintos | La verificación después de cada `pull` |
