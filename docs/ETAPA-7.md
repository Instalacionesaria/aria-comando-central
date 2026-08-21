# Etapa 7 — El framework y lo que se publica

Nada se cachea, ninguna respuesta autenticada lleva caché pública, ninguna memorización sin
organización, y ningún cuerpo de error revela estructura.

```bash
npm run db:reset && npm run build && npm run tipos && npm test
```

**228 pruebas, 228 pasan. Las cuatro filas, tres de ellas ⛔.**

## Es la etapa más corta, y por un buen motivo

> `EJECUCION` § 5: *"ninguna ruta del API usa primitivas de caché; ninguna respuesta autenticada
> lleva caché pública; ninguna ruta de autenticación registra cuerpos."*

Tres de las cuatro filas son **consecuencia de decisiones que ya estaban tomadas**: `EJECUCION` § 2
prohibió *"cualquier primitiva de caché en rutas del API"* en la Etapa 0, y desde la Etapa 3
`lib/autorizacion/respuesta.ts` es el único constructor de respuestas y pone `no-store`.

Lo que agrega esta etapa es la verificación de que el mecanismo funciona **sobre el artefacto y
sobre las respuestas de verdad**, no solo sobre el código que las construye.

## La fila que sí encontró algo, y era mío

`ADR-0704` —*"ningún cuerpo de error contiene nombres de tablas ni consultas"*— chocaba de frente
con algo que yo había escrito en la Etapa 5. Las tres rutas de administración hacían:

```ts
return rechazo('rechazo_de_la_base', mensaje.split('\n')[0]);
```

Eso viene del `05` § 3, que pide devolver el mensaje de un disparador *"tal cual"* con un argumento
correcto: *"traducirlos en el backend sería mantener dos textos que dicen lo mismo y que van a
divergir"*. Pero pasaba **cualquier** error de la base. Medido contra esta base:

```
disparador  → El administrador principal no se puede degradar (usuario 6fffc178…).
estructural → column "columna_que_no_existe" of relation "usuarios" does not exist
```

El segundo **nombra la tabla**.

### El discriminante es el SQLSTATE, no el texto

`P0001` es `raise_exception`: el código que produce **exactamente** un `raise exception` de plpgsql
y ningún error estructural. Filtrar por eso resuelve las dos reglas a la vez, y de paso excluye
solo `23505` (unicidad) y `23503` (clave foránea) — que el `05` § 3 excluye por su cuenta, porque
*"un mensaje de 'ya existe una fila con ese valor' es un canal que confirma la existencia de un
registro de otra organización"*.

La alternativa —filtrar por patrones sobre el texto— habría sido una lista de palabras prohibidas
que hay que mantener y que falla en el idioma equivocado. Hay una prueba que **prohíbe esa forma**.

Y la prueba de esto es de tipo **Base**, con los errores de verdad. Imitar los objetos de error con
literales habría probado el filtro contra mi propia idea de cómo se ven. La prueba primero afirma que
el error estructural **sí** nombra la tabla —sin eso, la afirmación siguiente pasaría aunque el
filtro no sirviera— y después que el filtro lo corta.

## Las tres ⛔, y qué las hace verificables

**`ADR-0701` · ninguna ruta se cachea.** La fila dice *"fuera de una lista autorizada"*, y acá esa
lista es **el conjunto vacío** — más fuerte que una lista corta, porque no hay caso legítimo que
exceptuar. Y se verifica sobre el artefacto: ninguna ruta bajo `/api` aparece en
`.next/prerender-manifest.json`. El barrido del vocabulario de caché ya vivía en la Etapa 3, con las
trampas que encontró la investigación de Next —`revalidate = false` **activa** la generación
estática, y `generateStaticParams` sola también—.

**`ADR-0702` · ninguna respuesta lleva caché pública.** La mitad que la hace estructural: **ningún
manejador construye una `Response` por su cuenta**. Un constructor correcto y una ruta que arma su
propia respuesta es el hueco exacto que una prueba sobre el constructor no ve. Y `no-store`, no
`no-cache`: `no-cache` permite guardar y revalidar, y con datos de inquilino esa diferencia decide si
la respuesta queda en un caché intermedio.

**`ADR-0703` · toda memorización incluye la organización.** La forma más fuerte de cumplir *"ninguna
clave de caché sin la organización"* es que **no exista ninguna memorización**, y así está. La prueba
busca la forma —una estructura mutable en el nivel superior de un módulo del servidor— con **una**
excepción nombrada: el agrupador de clientes por rol de base de `lib/datos/capa.ts`, que no es un
caché de datos. Y esa excepción tiene comprobación de entrada muerta: si `capa.ts` dejara de tener su
agrupador, la exención pasaría a eximir a un archivo que ya no la necesita.

## Etapa 7b: ya estaba hecha

Las tres filas de la cadena de dependencias —versiones exactas, archivo de bloqueo versionado,
guiones de instalación desactivados— se adelantaron a la **Etapa 0**, y el motivo está en
`docs/ETAPA-0.md`, decisión 9: dejarlas en la 7b significaba que el servidor de construcción corría
dependencias sin fijar y con guiones habilitados **durante todo el proyecto**, mientras sostiene
`CLAVE_MAESTRA`. El `10` § 5 lo dice sin vueltas: *"no hace falta que la dependencia esté en la ruta
del login. Basta con que esté en el proyecto."*

## Lo que la Etapa 7 **no** hace

Ninguna configuración de despliegue, ningún `vercel.json` ni `vercel.ts`, ninguna cabecera de
seguridad más allá de `Cache-Control` —las de transporte son del `08` § 3 y no están en las filas—, y
ningún cambio en las rutas: solo el filtro del mensaje de error.

## Pendientes

1. **Tres variables en Vercel**: `CLAVE_MAESTRA`, `DOMINIO_ESPERADO`, `CABECERA_DIRECCION_REAL`.
2. **El proveedor de PostgreSQL administrado.** Bloqueante para desplegar desde la Etapa 3.
3. **Protección de rama en `main`** con `verificar` requerido.
4. **Los mapas de origen de `.next/server`**, que viajan en el artefacto desplegado y reconstruyen
   el código fuente verbatim. No es ninguna fila —no llegan al navegador— pero conviene decidirlo
   antes de que haya producción.
