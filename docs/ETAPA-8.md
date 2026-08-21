# Etapa 8 — Detección

El aviso que interrumpe cuando la capa de aislamiento lanza, la sonda horaria con las dos
organizaciones de control, y las tres acciones de auditoría que faltaban.

```bash
npm run db:reset && npm run build && npm run tipos && npm test
```

**241 pruebas, 241 pasan. Las tres filas ⛔ de la etapa, y siete de las diez con archivo que las
cita.**

## Es la única etapa donde la mayoría de las filas NO son pruebas del proyecto

`PRUEBAS.md` lo dice en su encabezado, y hay que repetirlo porque cambia cómo se lee esta etapa:

> *"Estas no son pruebas del proyecto: son pruebas **del sistema andando**. Son las únicas que
> detectan un fallo mientras está pasando."*

Nueve de las diez son de tipo **Producción**. Y `EJECUCION` § 4 restringe el alcance a dos cosas:

> *"`10` **operación** — no se implementa ahora, salvo dos cosas: el aviso de la excepción de
> aislamiento y la sonda."*

Así que la contabilidad honesta es ésta:

| Fila | Estado |
| --- | --- |
| ⛔ `ADR-0801` la sonda horaria | **implementada y probada** |
| ⛔ `ADR-0802` el aviso del aislamiento | **implementado y probado** |
| ⛔ `ADR-0809` las tres acciones se emiten | **implementada y probada** (es la única de tipo Código) |
| `ADR-0803`–`ADR-0806` las cuatro señales de vigilancia | **la consulta existe y corre**; falta la cadencia y la persona |
| `ADR-0807` el respaldo se puede restaurar | **no implementada** — es un simulacro operativo |
| `ADR-0808` el aviso funciona (resumen que se manda siempre) | **no implementada** — necesita una tarea programada |
| `ADR-0810` el aviso llega de verdad | **no implementada** — necesita un entorno de ensayo y un canal real |

Las tres últimas no se pueden escribir como pruebas de este repositorio, y decirlo es más útil que
inventar algo que las tilde.

## La fila más sutil de las setenta y cinco, y encontró algo

⛔ `ADR-0809` es la única de tipo **Código**, y su justificación es mejor que su regla:

> *"Provocar cada una y verificar que aparece la fila. **Sin esto, un cero en la vigilancia es
> indistinguible de 'nadie cableó el punto de emisión'**, y tres de las seis señales quedan apagadas
> sin que nada falle."*

No era hipotético: **`organizacion_cambiada` estaba en el tipo `Accion` desde la Etapa 3 y no se
emitía en ningún lado.** La señal 5 —*"uso indebido de una cuenta con acceso a todo"*— habría
devuelto cero para siempre, y ese cero se habría leído como *"nadie miró nada"*.

Las tres, ahora cableadas donde el `10` § 1 dice:

- `permiso_denegado` → en el portero, **con la capacidad en el detalle**. Sin ese campo la señal 3
  agrupa por una capacidad nula y se pierde justo lo que quería decir: *qué* permiso le falta a qué
  rol. El `10` § 1 la llama *"la más subestimada"*, porque *"un pico de rechazos casi nunca es un
  ataque: es un rol al que le falta una capacidad, y **nadie lo va a reportar** porque la pantalla se
  ve"*.
- `credencial_ilegible` → en la función única que descifra, en la **misma transacción** que la
  lectura.
- `organizacion_cambiada` → con `org_destino` en el detalle, y la fila guardada con la organización
  **visitada**, porque el `08` § 12 lo pide así: *"al revés, el administrador de un cliente no ve en
  su propia auditoría que alguien entró."*

Y cada prueba tiene su mitad complementaria: una credencial **legible** no emite nada, porque una
función que emitiera siempre pasaría la afirmación positiva y llenaría la vigilancia de ruido.

## El aviso: las cuatro decisiones que el `10` § 1 exige

> *"Y 'avisar' tiene que significar algo concreto, o esta sección no sirve de nada. Escribir en el
> registro del servidor **no cuenta**."*
>
> *"Sin esas cuatro, `avisar()` es una función con un nombre tranquilizador."*

1. **El medio** — un punto de entrada web (`AVISO_URL`), el denominador común de todo lo que
   interrumpe. **Y sin él, `avisar()` LANZA**: no cae al registro, porque un respaldo al registro es
   exactamente lo que el documento acaba de descartar y sería el `??` del `07` § 1 aplicado a la
   detección. Hay una prueba que lo afirma.
2. **A quién** — no se puede resolver en código. `AVISO_DESTINO` viaja **en** el aviso, para que
   diga a quién buscaba incluso si el canal se reconfiguró. Los dos nombres son un pendiente.
3. **Deduplicación** — una por firma y por hora, con el conteo de suprimidos en el aviso siguiente.
   Probado: el primero sale, los cinco siguientes se suprimen, y una **firma distinta no se
   suprime** — sin esa mitad, un aviso de fuga quedaría enterrado detrás de uno de contexto.
4. **Si el canal falla** — `avisar()` propaga el error con el aviso adentro del mensaje.

### Una consecuencia que hay que aceptar de frente

`datos()` es **síncrona** —tiene que serlo: devuelve el constructor de consultas— y `avisar()` no.
Así que el aviso se dispara sin esperar. Si el canal falla, un rechazo sin manejar tumbaría el
proceso en Node, así que el `.catch` es obligatorio y lo único que puede hacer es escribir en el
registro.

**Eso no es el aviso: es el registro de que el aviso NO LLEGÓ**, y está etiquetado como tal. La
respuesta del propio documento a un canal caído no es un respaldo al registro, es *"el resumen que
se manda siempre (§ 2): también prueba que el canal vive"* — que es `ADR-0808`, y queda pendiente.

## La sonda, que la Etapa 2 venía esperando

`negocio.control_aislamiento` existe desde la migración 008, y su comentario ya decía que la sonda
de la Etapa 8 la iba a usar. Ese "después" es ahora.

Corre **por el camino real** —`conOrganizacion()` y `datos()`, como una petición— y eso es todo el
punto: la advertencia que `EJECUCION` § 5 puso sobre el criterio de cierre de la Etapa 2 vale igual
acá. *"Correr estas pruebas con el rol propietario las hace pasar todas sin que nada esté
protegido."*

Con dos guardas que la hacen valer algo:

- **Si no encuentra las dos organizaciones de control, AVISA.** Eso no es una fuga: es una sonda
  rota, y una sonda que dejó de mirar es tan grave como una fuga que no se ve. Sin esta rama,
  *"ninguna ve a la otra"* sería cierto y vacío a la vez.
- **No lanza cuando encuentra una fuga: devuelve.** Es la misma lección que costó el refactor de
  `tokenVigente()` en la Etapa 6 — el aviso ya salió por el canal que interrumpe, y un 500 haría que
  la tarea programada reintentara y disparara la deduplicación en vez del aviso.

## Una ruta que no encajaba en ninguna categoría

`POST /api/sonda` es la única del sistema que **no puede pasar por el portero** (no hay sesión: la
llama una tarea programada, y `exigir()` respondería 401 a la única cosa que puede detectar una fuga
en producción) **y no puede ser pública** (dejar que cualquiera la llame es dejar que cualquiera
pregunte por el estado del aislamiento y consuma conexiones sin autenticarse).

La resolución fue darle una tercera categoría con nombre —`RUTAS_CON_SECRETO_PROPIO`— en vez de
meterla en la lista que menos molestara. Tiene un secreto compartido comparado con
`timingSafeEqual`, y la prueba del portero **verifica que lo use**: estar en esa lista no exime de
autenticar, solo de usar el portero. La lista existe para que una segunda entrada sea un acto
deliberado: *"un endpoint con su propia autenticación" es exactamente la forma que toma un portero
saltado por comodidad.*

## Lo que encontró correr las pruebas

**`identidad.auditoria_accesos` no se puede borrar.** Un disparador de la migración 005 lo impide, y
la primera versión de `80-deteccion.test.ts` murió ahí con las once pruebas en rojo. La invariante es
correcta —un registro de auditoría que se puede borrar no es un registro de auditoría— así que las
pruebas miden **deltas**: cuentan antes, provocan, cuentan después. Es más trabajo, es lo correcto, y
de paso significa que no dependen de que la tabla esté vacía.

## Las cuatro consultas de vigilancia

Las filas `ADR-0803`–`ADR-0806` son de Producción y no se implementan. Pero **la consulta es la mitad
barata del trabajo**, y dejarla sin escribir convierte *"es de producción"* en *"no está"*. Están en
`db/vigilancia/senales.sql`, literales del `10` § 2, con una prueba que verifica que:

- son SQL válido y **corren con el rol real de la aplicación** —no con el propietario, que probaría
  los permisos de otro—;
- devuelven **las columnas que la señal necesita**: si alguien renombra una, la consulta sigue
  corriendo y la vigilancia deja de decir lo que decía;
- la señal 4 cuenta **correos distintos**, que es lo que distingue *"alguien se olvidó la
  contraseña"* de *"un barrido"*. Y que el campo existe en las filas que el login escribe.

Lo que falta para que sean la fila de `PRUEBAS`: la **cadencia** y la **persona**. Las dos son
decisiones de operación.

## Pendientes — y ahora son los únicos que quedan

**Del código: nada.** Las nueve etapas están.

**De operación, en orden de urgencia:**

1. **Seis variables en Vercel**: `DATABASE_URL_INQUILINO`, `DATABASE_URL_IDENTIDAD`,
   `CLAVE_MAESTRA`, `DOMINIO_ESPERADO`, `CABECERA_DIRECCION_REAL`, y las tres de esta etapa
   (`AVISO_URL`, `AVISO_DESTINO`, `SONDA_TOKEN`). `DATABASE_URL_MIGRADOR` **no va**: su contraseña
   no está en el entorno de la aplicación (`09` § 2, `10` § 4).
2. **El proveedor de PostgreSQL administrado.** Bloqueante para desplegar desde la Etapa 3. Debería
   pasar por la habilidad `vercel:marketplace`, y para eso hace falta autorizar el servidor MCP de
   Vercel desde una sesión interactiva.
3. **Las dos personas del aviso**: una nombrada y un suplente. *"Al equipo es a nadie a las tres de
   la mañana."*
4. **La tarea programada de la sonda**, cada hora, contra `POST /api/sonda`.
5. **Protección de rama en `main`** con `verificar` requerido. Vercel despliega por push, no por
   chequeo: hoy un commit con las pruebas en rojo se publica igual.
6. **`ADR-0808` y `ADR-0810`**: el resumen que se manda siempre —que además prueba que el canal
   vive— y el ensayo de que el aviso llega al medio elegido. Los dos necesitan el canal real.
7. **`ADR-0807`**: el simulacro de restauración, con **los roles primero** (no viajan en el volcado
   de la base) y las pruebas de aislamiento corriendo contra la copia.
8. **La deuda de `SECCIONES`**: unificar las cuatro copias de las claves de pantalla, con el riesgo
   de `npm run paridad` nombrado en `docs/ETAPA-3.md`.
9. **Los mapas de origen de `.next/server`**, que viajan en el artefacto desplegado y reconstruyen
   el código fuente verbatim.
