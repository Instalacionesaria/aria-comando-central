# Etapa 1 — El esquema y sus invariantes

Las diez tablas de identidad, sus permisos y políticas tabla por tabla, y los cinco
disparadores que sostienen lo que un condicional del backend no puede sostener.

```bash
npm run db:reset && npm test
```

**65 pruebas, 65 pasan, ~6 s.** Corridas dos veces seguidas sin resembrar, para
comprobar que no hay dependencia de orden.

## Estado de las diez filas

| ADR | Regla | Prueba | Estado |
| --- | --- | --- | --- |
| `ADR-0101` | El fundador no se borra, no se desactiva, no se degrada | `pruebas/base/20-invariantes.test.ts` | Pasa |
| `ADR-0102` | La organización principal no se desactiva | `20-invariantes` | Pasa |
| `ADR-0103` | El rol de plataforma solo existe en la organización principal | `20-invariantes` | Pasa |
| `ADR-0104` | Un rol privado no se asigna a usuario de otra organización | `20-invariantes` | Pasa |
| `ADR-0105` | La auditoría es inmutable | `20-invariantes` | Pasa |
| `ADR-0106` | Las referencias dentro del inquilino no cruzan organizaciones | `20-invariantes` | Pasa |
| `ADR-0107` ⛔ | Toda tabla con seguridad de fila activada, forzada y con política | `10-migraciones` | Pasa, sobre **10** tablas |
| `ADR-0108` ⛔ | Y además accesible para el rol que la usa | `21-permisos-por-rol` | Pasa, **reescrita** |
| `ADR-0109` ⛔ | Ninguna tabla quedó sin forzar | `10-migraciones` | Pasa |
| `ADR-0110` | El esquema excluido solo tiene lo declarado, sin `org_id` | `10-migraciones` | Pasa, sobre `public` |

Criterio de cierre de `EJECUCION` § 5, verificado: **las invariantes fallan contra la
base, no contra el backend** — las tres operaciones sobre el fundador, la
desactivación de la organización principal y la asignación del rol de plataforma a un
usuario de un cliente fallan las tres. Y la prueba de catálogo devuelve **cero tablas**
sin seguridad activada, forzada, con política y con permisos.

## Las cinco migraciones

Una por sección del documento, para que cada una sea diffeable línea por línea contra
su fuente. `EJECUCION` § 6: *"no se inventa… se usa ese"*.

| Archivo | Fuente | Qué trae |
| --- | --- | --- |
| `003_roles_y_permisos.sql` | `01` § 4 + `08` § 6 + `01` § 10 | `permisos`, `roles`, `roles_permisos`, `usuarios_roles`, la vista de permisos efectivos, y el catálogo inicial |
| `004_sesiones.sql` | `01` § 5 + `08` § 5.1 + `08` § 10 | `sesiones`, con los dos vencimientos y la columna de estado |
| `005_auditoria.sql` | `01` § 7 | `auditoria_accesos`, sus tres índices, `evitar_mutacion()` y su disparador |
| `006_segundo_factor_y_credenciales.sql` | `08` § 10 + `06` § 2 + `08` § 9 | `usuarios_segundo_factor`, `organizaciones_credenciales` con los cuatro estados y el refresco, y la clave única sobre el par |
| `007_invariantes.sql` | `01` § 6 + `08` § 6 | Los cinco disparadores de protección |

## Decisiones tomadas que **no estaban escritas**

`EJECUCION` § 6 pide este apartado al cerrar cada etapa.

1. **Los datos de referencia van EN la migración; los de entorno, no.** El catálogo de
   trece capacidades y los dos roles de sistema se insertan en `003`, **antes** de
   encender `enable`/`force row level security` sobre esas tablas. Es la única vía que
   no exige darle una política a `migrador` —prohibido por `EJECUCION` § 3— y **no** es
   "quitar el forzado y reponerlo": el forzado se enciende una vez y no se apaga nunca.

   La distinción con `db/sembrado/` es la que importa, y es de destino, no de
   mecanismo: **las capacidades las necesita todo entorno, producción incluida; las
   organizaciones de desarrollo no deben existir en producción.** Las migraciones corren
   también en producción. Ésa es toda la diferencia.

2. **Los cuerpos de los disparadores CALIFICAN cada tabla** (`identidad.usuarios`),
   donde `01` § 6 escribe sin calificar confiando en la ruta de búsqueda. Es una
   desviación deliberada y es la que hace que funcionen: una función sin calificar
   resuelve sus tablas con el `search_path` **de quien la invoca**, y estos disparadores
   existen justamente para detener lo que NO pasa por la aplicación — *"una sentencia a
   mano un domingo"*. Esa sesión es un superusuario con `search_path = "$user", public`,
   donde `usuarios` **no resuelve**. El disparador fallaría con *relation does not
   exist* en vez de con su mensaje.

3. **Las pruebas de invariantes corren como SUPERUSUARIO**, y es lo contrario de lo que
   pide el `09` § 1 para todo lo demás. Dos razones:

   - **Doctrinal:** el disparador no existe para detener a la aplicación, existe para
     detener lo que la saltea. Probarlo desde una sesión exenta de RLS es probar su
     modelo de amenaza.
   - **Mecánica, y decisiva:** con el rol de la aplicación varias de esas operaciones se
     rechazan **antes** de llegar al disparador —`app_identidad` no tiene `delete` sobre
     `usuarios`— y la prueba pasaría por el motivo equivocado. El caso más engañoso es
     el borrado como `migrador`: con el forzado puesto y sin política que lo nombre, el
     `delete` afecta **cero filas sin error** y el disparador nunca se dispara. Una
     prueba que exigiera "falla" quedaría verde creyendo haber comprobado la invariante.

   La segunda capa —que ningún rol de aplicación **tenga** el permiso— se afirma aparte,
   con `has_table_privilege`.

4. **`ADR-0108` está reescrita, y estaba anticipado.** `PRUEBAS.md` dice
   *"`has_table_privilege` por tabla"*, pero la compuerta de la Etapa 0 midió que
   `has_table_privilege` **no ve los permisos por columna** — y `identidad.usuarios` se
   otorga por columna. Escrita literalmente, esta fila ⛔ fallaría sobre código
   correcto. Se implementa la versión del `09` § 4 (bucle acotado a `negocio`) más un
   **mapa explícito de expectativas por rol** para las diez tablas, que es donde vive el
   contenido real hoy.

5. **`DELETE` no existe a nivel de columna.** PostgreSQL rechaza
   `has_column_privilege(..., 'DELETE')` con *unrecognized privilege type* — tiene
   sentido: no se borra una columna, se borra una fila. Consecuencia: *"el inquilino no
   puede borrar un usuario"* solo se puede afirmar a nivel de tabla.

6. **`select count(*) from identidad.permisos` como `migrador` devuelve CERO.** Force
   RLS sin política que lo nombre. Es la asimetría del `09` § 2 mordiendo en una prueba
   en vez de en producción, y obliga a una distinción que conviene tener presente:
   **el catálogo (`pg_class`, `has_*_privilege`) se consulta como `migrador`; los DATOS,
   como `app_identidad`.**

7. **La vista `usuarios_permisos` se crea**, con `security_invoker = true` y otorgada
   solo a `app_identidad`. `01` § 4 la ofrece condicionalmente (*"si la usás"*) y el
   `09` § 2 escribe su grant. No contradice la prohibición de `EJECUCION` § 2, que es
   sobre **vistas de tablas de negocio**. Viene con dos pruebas: que declara
   `security_invoker` —sin eso *"evade las políticas del inquilino y devuelve todo"*— y
   que **devuelve filas de verdad**, porque un permiso que existe no es un permiso que
   funciona.

8. **El sembrado ahora asigna los roles de sistema**: fundadora →
   `superadministrador`, los dos administradores de cliente → `administrador`. La
   asignación es dato de **entorno**, así que va por `conIdentidad()`, no por migración.
   Y que el fundador tenga el rol de plataforma es lo que hace **testeable** el
   disparador `usuarios_roles_fundador`: sin una asignación que proteger, esa invariante
   no tiene sujeto.

9. **El conjunto de columnas de `organizaciones_credenciales` es el ILUSTRATIVO del
   documento** (`crm_*`, `pagos_*`, `ia_*`, con el refresco OAuth sobre `crm_`). Todavía
   no está decidido qué integraciones conecta cada organización en este producto;
   inventar el conjunto ahora sería inventar. **Reconciliar en la Etapa 6**, que es
   cuando la función única y el enmascarado se escriben. Agregar o renombrar una columna
   nullable después es una migración de una línea.

10. **El roster de las diez tablas se afirma explícitamente.** Sin eso, borrar una tabla
    dejaría la prueba de catálogo verde sobre las que quedan, y *"cero tablas sin las
    tres cosas"* sería cierto y vacío a la vez.

11. **`negocio` está vacío, así que el bucle de `ADR-0108` sobre tablas de negocio no
    corre — y eso se AFIRMA**, con un conteo que falla el día que la Etapa 2 cree la
    primera tabla. Quien lo arregle tiene que decidir a propósito qué espera del bucle,
    en vez de heredar una prueba que pasaba en vacío.

12. **Una prueba que muta estado sembrado compartido lo hace en una transacción y la
    revierte.** La regla salió de un fallo real durante esta etapa: la prueba de *"la
    contraseña del fundador SÍ se puede rotar"* dejaba al fundador con un hash
    inservible, y la prueba del sembrado (*"el hash guardado verifica"*) fallaba según
    el orden de los archivos. Las demás no la necesitan porque esperan un **rechazo**, y
    un rechazo no cambia nada.

13. **La fila de auditoría que escribe `ADR-0105` es permanente.** La tabla es inmutable
    por diseño, así que la fila de prueba no se puede limpiar. Es el riesgo residual 5
    del `10` § 7 aceptado a propósito: *"un registro escrito por error —con un dato que
    no debía estar ahí— es permanente"*.

14. **Se cerró el hueco que la Etapa 0 dejó abierto:** ahí se aplicó la
    *configuración* de la Etapa 7b (`.npmrc`, versiones exactas) pero nunca se
    escribieron sus **pruebas**. Ya están, en
    `pruebas/codigo/01-cadena-de-dependencias.test.ts`, y `7b` está 3/3.

## Lo que la Etapa 1 **no** hace

Ninguna tabla en `negocio`, ninguna función `aplicar_aislamiento()`, ningún
`conOrganizacion(`, ningún contexto por petición, ningún manejador de ruta, ningún
portero, ningún login, ningún agrupador de conexiones, ningún proveedor administrado.

`aplicar_aislamiento()` es de la Etapa 2 a propósito: es la función que aplica el
régimen a una tabla **de negocio**, y hoy no hay ninguna. Crearla ahora sería una
función sin llamador — y el corredor de migraciones ya rechaza un `create table` en
`negocio` que no la invoque, así que la primera tabla de negocio no puede nacer sin
ella.

## Pendientes que siguen abiertos

Los mismos que al cerrar la Etapa 0, sin cambios:

1. **Protección de rama en `main`** con `verificar` requerido y trabajo por pull
   request. Sin eso `ADR-0001` sigue implementada e inerte, y Vercel despliega por push.
2. **Proveedor de PostgreSQL administrado** — bloqueante al cierre de la Etapa 2.
3. **Quién sostiene la credencial de `migrador` en producción.**
4. **`EJECUCION.md` sigue sin trackear** en el repo de la especificación.
5. **El binario `claude` no está autenticado**, así que el backend `claude-cli` de
   graphify no puede usarse para re-extraer la especificación.
