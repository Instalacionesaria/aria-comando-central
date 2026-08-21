# Etapa 6 — Credenciales

La función única, los cuatro estados con su texto, el enmascarado en el servidor, el refresco
con candado, y la primera prueba de tipo **Construcción** del proyecto.

```bash
npm run db:reset && npm run build && npm run tipos && npm test
```

**218 pruebas, 218 pasan. Las seis filas, incluida la ⛔.**

> El `npm run build` ahora es **parte de la secuencia**, no un paso opcional: la fila ⛔ inspecciona
> el artefacto construido. Si `.next` no existe o es más viejo que el código, la prueba **falla con
> el comando exacto** en vez de saltearse.

## El criterio de cierre, y el agujero que tenía

> `EJECUCION` § 5: *"el paquete que se publica al navegador **no contiene los nombres ni los
> valores** de ninguna variable secreta."*

El `08` § 4 dice por qué es innegociable: *"en un dominio público una filtración así es **total,
permanente y publicada** — queda en un paquete que la gente ya descargó y en la caché de la red de
distribución."* No se rota y ya está.

**Y había un agujero en este repo que hacía decorativa la mitad más importante de esa fila.**
`scripts/credenciales.mjs --github-env` emitía **solo las cuatro cadenas de conexión**. El build de
la integración corría sin `CLAVE_MAESTRA`, así que un `NEXT_PUBLIC_CLAVE_MAESTRA` se habría
inlineado como `undefined` —nada que buscar, verde— **y con la clave real en producción**. La
integración habría dicho verde sobre exactamente el defecto que existe para atrapar.

Arreglado: el script emite ahora las tres que faltaban, con valores efímeros que no protegen nada y
existen para que haya algo que buscar.

### La mutación que lo demuestra

Metí una filtración real —`process.env.NEXT_PUBLIC_CLAVE_MAESTRA` en el componente de cliente—,
reconstruí, y la prueba la nombró:

```
.next/static/chunks/3inni-1ao3275.js contiene CLAVE_MAESTRA (valor)
```

Y lo que más importa de ese resultado: **la mitad de los NOMBRES no la detectó.** El empaquetador
inlinea el valor y borra la referencia a `process.env`, así que el nombre no queda en ningún lado.
Sin la mitad de los valores —y sin el arreglo de la integración que la hace funcionar— esa fuga
habría pasado.

## Lo que "el paquete que se publica" resultó ser

No es solo `.next/static`. También los payloads prerrenderizados —`.html`, `.rsc`— que se envían
literalmente al cliente. Y hay dos conjuntos que **no** se barren, cada uno con su motivo:

- **`.next/server/**` en general**: el código de servidor menciona `process.env.CLAVE_MAESTRA`
  legítimamente. Una prueba que falla siempre se relaja hasta dejar de significar algo.
- **`.next/cache`**: `next build` lo **preserva** entre corridas. Un secreto de la semana pasada, ya
  arreglado, daría un rojo que no corresponde al commit — el otro camino por el que una prueba se
  debilita.

Y tres caminos que un barrido de nombres **no ve**, todos cubiertos aparte:

1. **`env: {}` en `next.config` inyecta siempre**, sin prefijo. La documentación del paquete
   instalado usa esa palabra: *"will **always** be included in the JavaScript bundle"*. No deja
   rastro en ningún nombre de variable ni en ningún `.env`.
2. **Un componente de servidor que renderice un secreto al HTML.** Solo la búsqueda de valores sobre
   los payloads prerrenderizados lo agarra.
3. **`productionBrowserSourceMaps: true`**, que publica el código fuente del cliente completo.

## Un bug que encontró correr las pruebas, y era de diseño

`tokenVigente()` marcaba el estado (`vencida`, `revocada`) y **lanzaba** — todo dentro de la misma
transacción. El `rollback` se llevaba la marca.

Consecuencia: el estado quedaba en `activa` **para siempre**, la interfaz seguía diciendo que la
conexión andaba, y el diagnóstico correcto —*"venció, hay que volver a autorizarla"*— no llegaba
nunca. Es la familia del `07` § 0 dada vuelta: un **fracaso registrado que no se registró**.

El arreglo cambió la forma de la función: devuelve `{ tipo: 'token' } | { tipo: 'no_operativa' }` en
vez de lanzar. La transacción confirma, la marca persiste, y quien llama decide. Es la misma forma
que `lib/http/cliente.ts` — tres cosas distintas, tres valores distintos, ninguno nulo. Y hay una
prueba que **relee el estado en otra transacción**, que es la mitad que faltaba.

## Decisiones que la especificación **no toma**

1. **No hay respaldo a las credenciales de la organización principal, ni siquiera explícito.** El
   `06` § 6 lo describe y lo presenta como condicional (*"es habitual que la organización principal…
   tenga sus credenciales en variables de entorno desde antes"*). Acá **no existe ninguna de esas
   variables**, `EJECUCION` no lo menciona, y nadie lo pidió. Implementar el mecanismo que
   `ADR-0604` existe para vigilar, por si acaso, es agregar el camino que ya costó una fuga entre
   clientes. Por eso `origen` es un tipo de **un solo valor**: el día que aparezca un segundo va a
   ser un cambio que alguien revisa.

2. **Un quinto estado, `ilegible`, que no está en el `check` de la columna.** El `05` § 7 nombra la
   acción de auditoría `credencial_ilegible` pero el `check` solo admite cuatro valores y el JSON
   del `06` § 7 no tiene rama para *"hay algo cargado y no lo puedo descifrar"*. Ese caso pasa cada
   vez que se restaura una copia de la base en otro entorno. **No se persiste** —la columna no lo
   admite— pero sí se informa: decir "falta conectar" mandaría a reconectar una integración que está
   conectada, y el problema real quedaría sin diagnosticar.

3. **El camino y el método de las credenciales.** Ningún documento de los catorce da una ruta: un
   grep de `/credenciales` devuelve cero. `GET`/`PUT /api/admin/credenciales` sigue la forma de las
   rutas de administración que ya existen.

4. **El margen del refresco es de cinco minutos.** El `08` § 9 dice *"unos minutos"* y no da número.

5. **El enmascarado se calcula en el SERVIDOR**, y un valor corto se enmascara **entero**. Mostrar
   dos de cuatro caracteres de un secreto corto es mostrar medio secreto. Si el valor completo
   viajara para enmascararlo en el navegador, el asterisco sería decoración sobre un dato que está
   en las herramientas de desarrollo.

6. **`ADR-0304` se acotó a los métodos `GET`.** El caso que lo forzó: `credenciales.ver` y
   `credenciales.editar` son dos capacidades a propósito —el `03` § 2 usa exactamente ese criterio,
   *"¿existe un rol plausible que necesite A y no B?"*— y un rol de consulta tiene que poder ver la
   pantalla sin poder escribir. Igualarlas para que la prueba pasara habría sido una **escalada
   silenciosa**: el portero usa `contieneAlguna`, así que pedir las dos en las dos deja escribir a
   quien solo puede leer. El defecto que `ADR-0304` previene es de lecturas (`07` § 2, *"una sección
   con datos y cuatro en blanco"*); un botón que se ve y da 403 es el `07` § 4 y se resuelve no
   renderizando el control.

7. **La prohibición del caché de credenciales es decisión propia.** El `07` § 3 describe el defecto
   —*"un caché de proceso 'para no descifrar dos veces' es exactamente cómo el token de una
   organización termina usándose para otra"*— y ningún documento prescribe una prueba. Es barata,
   porque la forma es reconocible: un `Map` en el nivel superior de un módulo de credenciales.

8. **La clasificación de secretas es a mano y acotada.** `DOMINIO_ESPERADO` y
   `CABECERA_DIRECCION_REAL` **no** son secretas: sus valores son el dominio público y `x-real-ip`,
   que aparecen legítimamente y coinciden por casualidad. Buscarlos daría **rojo permanente**, el
   rojo permanente produce excepciones, y las excepciones son donde después se cuela lo que importa.
   Sus **nombres** sí se vigilan.

9. **Una variable secreta sin valor hace FALLAR la prueba, nombrándola.** `''.includes()` devuelve
   siempre `true`, así que el `if (!valor) continue` que uno escribe para arreglarlo convierte la
   comprobación en cero — y ése era exactamente el agujero de la integración.

## Lo que la Etapa 6 **no** hace

Ninguna pantalla de integraciones, ninguna conexión OAuth real (`pedirTokenNuevo` se inyecta),
ningún servicio externo, ninguna rotación de la clave maestra con dos claves a la vez —el `06` § 4
la describe y se desactiva a sí mismo: *"si no lo necesitás hoy, al menos dejá anotado el
procedimiento"*— y ninguna columna nueva: las de refresco ya estaban desde la Etapa 1.

## Pendientes

1. **Tres variables en Vercel**: `CLAVE_MAESTRA`, `DOMINIO_ESPERADO`, `CABECERA_DIRECCION_REAL`.
2. **El proveedor de PostgreSQL administrado.** Bloqueante para desplegar desde la Etapa 3.
3. **Protección de rama en `main`** con `verificar` requerido.
4. **Los mapas de origen de `.next/server`.** No se sirven al navegador, pero **sí viajan en el
   artefacto desplegado** y reconstruyen el código fuente verbatim. No es la fila ⛔ —que es sobre el
   navegador— pero conviene decidirlo antes de que haya producción.
5. **`pagos_clave_cifrada` y `pagos_comercio_id` no tienen nombre de salida.** La migración 006 ya lo
   avisaba: los nombres de las columnas de integración son *"un conjunto ilustrativo"* del `06` § 2
   y hay que reconciliarlos con los servicios reales. Hoy solo `crm` tiene columnas de refresco.
