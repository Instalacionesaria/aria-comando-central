# Los permisos por herramienta

> **Estado:** **postergado el 2026-10-01**, por decisión del usuario. La estructura nueva
> (`docs/OTROS/nueva-estructura/`) mantiene los permisos como están (`NE-07`). Este archivo dice **qué falta,
> por qué y cómo se haría**, para retomarlo sin reconstruirlo.

## Qué falta

El documento de producto pide que a un Usuario se le activen «departamentos o herramientas sueltas». Hoy
el permiso es **por sección**, y dos secciones abarcan varias herramientas de departamentos distintos:

| sección | qué abre hoy, de un solo golpe |
|---|---|
| `tools` | Research › Espía de anuncios, Scraper, Mis Leads · Marketing › Tu página, Tu video de ventas · Sales › Prospección en frío |
| `analizadores` | Sales › Analizador HT · Client Success › Analizador OB |

Quien sólo prospecta, entonces, también ve la landing; y quien hace onboarding también ve las llamadas de
venta.

## Por qué no se hizo en la estructura nueva

La clave de una sección es cinco cosas a la vez (`docs/OTROS/nueva-estructura/05-LO-QUE-NO-CAMBIA.md`,
`NE-31`). Partir `tools` en, por ejemplo, `espia`, `scraper`, `prospeccion`, `landing` y `vsl` exige:

1. **Una migración que agregue las claves nuevas** al `check` de `identidad.usuarios_secciones.seccion`.
2. **Un guion que mude las pestañas** de las personas con rol `usuario`: quien tenía `tools` recibe las cinco
   claves nuevas. Una migración no puede hacerlo, porque corre como el migrador y la seguridad por filas
   forzada le muestra cero filas.
   - El precedente es `scripts/mudar-auditoria.mjs`, con su corrida en seco.
   - En producción hay 4 personas con rol `usuario` (`docs/OTROS/estado actual/16-AJUSTES-Y-PERMISOS.md`).
3. **Partir las rutas**: hoy las diez rutas de `app/api/tools/` declaran `PANTALLA = 'tools'`. Cada una pasa a
   la clave de su herramienta, y las compartidas necesitan una decisión: `/api/tools/scrape` y
   `/api/tools/saldo`, que usan el Scraper, la Prospección y el paso de mercado de ICP.
4. **Una migración posterior que retire la clave vieja** del `check`, que falla si quedó alguna fila con ella.
5. Las secciones nuevas en `lib/autorizacion/secciones.ts`, y su lugar en `lib/autorizacion/departamentos.ts`.

Es el mismo camino que se recorrió para retirar `auditoria`, y no cabía en una fase cuyo pedido era «sin
romper los roles».

## Lo que resuelve de paso

El 403 conocido de Research › ICP & Oferta (`NE-36`): su paso de mercado llama a `/api/tools/saldo` y a
`/api/tools/scrape`, así que quien tiene ICP sin Tools no puede correrlo. Con los permisos partidos, esas dos
rutas pueden aceptar a quien tenga ICP o el Scraper, y se deciden juntas.
