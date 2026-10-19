# Deuda abierta

> Corte: **2026-10-18**. Producción corre el commit **`972972e`** (migraciones hasta la `078`); las citas son al árbol
> de `dc84cb2`, que suma ocho commits locales del modelo de datos sin subir (§ 22). Las cifras de producción se
> midieron el 2026-10-18 entre las **15:38 y las 16:03 UTC** con `scripts/supabase.mjs leer`, sólo conteos y agregados
> y con el OK del usuario: de la base no salió un nombre, un correo ni un teléfono. Cada punto lleva la consulta que
> lo mide o el `archivo:línea` donde se comprueba, para volver a correrla y ver si creció, se arregló sola o dejó de
> importar. Lo que no se volvió a medir lleva su fecha. Cada deuda que se cerró queda marcada **Cerrada**, con su
> commit y su fecha. Para ubicar lo nombrado, ver [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md).

> **Desde el corte del 2026-09-28** (137 commits, `ceec000..dc84cb2`)
>
> - **Cerradas:** la maqueta del Executive y lo que colgaba de ella (E7, `4e9a242`, 10-01); el «Eliminar» invisible,
>   el panel lateral y el menú sin teclado (E2 a E9, 10-01); la fuga del gasto de Meta —la pauta sí gastaba— con el
>   colector que pedía sólo 13 campañas y dos comentarios del gasto (`076`, `22ec755`, 10-07); el texto de Clarity, el
>   «Hoy» y la cobertura de Conversion (CV-1 y CV-4, 10-08 y 09); la fecha sin año de Conversation (CN-4, `89d8c19`,
>   10-10); el gasto sin escribir y el error con datos de los Analizadores (AG2, 10-04); la CI de `main` en rojo
>   (verde desde `ae30048`, 10-07). Fuera del repositorio, las tablas de HT/OB y de Closer v1 se borraron de
>   producción con respaldo y el OK del usuario (2026-10-12 y 13; § 22).
> - **Nuevas:** el modelo de datos sin subir y los pendientes de seguridad de la base (§ 22); Meta directo dormido y la
>   miniatura que casi no llega (§ 21); el voseo de Meta, que la prueba no miraba (§ 23, cerrado en `65669f4`); las zonas en
>   UTC y el día de la empresa (§ 23); ninguna campaña asignada a un funnel (§ 12); el `showed` sin lector (§ 4); y las
>   revisiones con sesión que siguen sin hacerse (§ 19).
> - **Siguen abiertas y crecieron:** los contactos congelados (25 → 36, § 2.1) y los fallidos sin motivo (475 → 530, § 5).

**Algunas cifras llevan la hora, y no es un floreo.** El denominador de la tarjeta de citas fue 128 el 2026-09-15, 103
el 2026-09-28 a las 22:03 y 40 el 2026-10-18 a las 15:38: se mueve solo, porque la ventana rueda y casi no entran
citas nuevas. Donde una cifra se mueve así va con su instante, porque en presente absoluto la lectura siguiente la
desmiente y el documento entero pierde crédito por un número que nunca estuvo mal.

Esto NO es una lista de deseos. Es lo que está roto o incompleto **hoy**, con su consecuencia
concreta. Lo que sería lindo tener vive en el § 5 de cada informe de departamento, y los riesgos de
cada pantalla en su § 7; acá se juntan los que cruzan pantallas o que nadie más anotó.

---

## 1 · Los puntos del 2026-09-28, uno por uno

| Punto de la foto anterior | Hoy | 2026-09-28 → 2026-10-18 | Acá |
|---|---|---|---|
| Contactos congelados | abierto, y creció | 25 → 36: los 24 viejos sin alta y 12 congelados después | § 2.1 |
| Citas sin resta | abierto | 76 de 103 → 24 de 40 sin releer dentro de la tarjeta | § 2.2 |
| Prompts sin cargar | abierto | 0 y 0 → 0 y 0 filas | § 3 |
| Formulario de la landing | vacío, como estaba previsto | 5 de 276 → 0 de 25 a 30 días | § 3 |
| Trigger link | abierto | 31 de 594 → 31 de 624 en el último toque | § 3 |
| Show rate | abierto | 0 de 333 → 0 de 368 citas con asistencia; el CRM ya marca 3 `showed` | § 4 |
| Columnas sin lector | abierto | `cita_id` 0 de 7 → 0 de 7; fallidos con motivo 3 de 475 → 3 de 530 | § 5 |
| `desde` en Lead Flow | **Cerrado** el 2026-10-10 (`89d8c19`) | la fecha lleva el año cuando no es el de hoy | § 6 |
| El descarte sin fecha | abierto | ninguna migración lo tocó | § 7 |
| Lo que cambiaba solo | se cumplió | el sentimiento quedó bajo el piso; las congeladas salieron de los 30 días | § 8 |
| La maqueta del Executive | **Cerrada** el 2026-10-01 (`4e9a242`) | se fue entera; el Inicio no dibuja cifras | § 9 |
| La pauta «no gasta» | **Cerrada** el 2026-10-07 (`22ec755`): era falso | la cuenta gastó; el último día con gasto es el 2026-10-14 | § 12 |
| Pantallas que dicen algo falso | abierto, menos | tres cerradas en Conversion; quedan Leads Portal y el monitor dormido | § 13 |
| Datos personales en el repositorio | abierto | el nombre de pila en 43 → 51 archivos; los apellidos en 10 → 9 | § 15 |
| La CI de `main` en rojo | **Cerrada** el 2026-10-07 (`ae30048`) | verde en todas las corridas desde entonces | § 24 |
| Verificación con sesión | abierta, y creció | se sumaron Acquisition y las cuatro pantallas vueltas al prototipo | § 19 |

---

## 2 · Dos agujeros de integridad del barrido

Siguen siendo los más caros porque **no fallan**: producen cifras plausibles sobre datos viejos.

### 2.1 · Treinta y seis contactos congelados, y un archivo que dice cuándo

`congelarLosQueYaNoEstan` (`lib/negocio/sincronizar.ts:307`) hace lo mismo que el 2026-09-15: pone
`territorio = null` (`lib/negocio/sincronizar.ts:315`) y **no toca `sincronizado_el`**. Como la
búsqueda del barrido es POR ETIQUETA, `guardar()` no vuelve a pasar por esa fila nunca más.

Lo que cambió no es el código sino lo que se sabe. El disparador de la migración `047` archiva cada
cambio de zona en `negocio.cambios_de_territorio` —el comentario lo dice en
`lib/negocio/sincronizar.ts:302-306`—, y la tabla tiene su primera fila el 2026-09-15. Medido el
2026-10-18 a las 15:39 UTC: **52 filas, 40 altas, 11 congelados, 1 descongelado y 0 traspasos**; los
congelados van del 2026-09-17 al 2026-10-09. Hoy hay **36 contactos congelados**: los 24 viejos, de los que
no se sabe cuándo porque son anteriores a la primera fila del archivo, y 12 con alta, congelados después
(el archivo registra 11; el duodécimo no se investigó).

Tres consecuencias, medidas el 2026-10-18 a las 15:39 UTC:

- **`sincronizado_el` afirma una frescura de hace entre 8,9 y 54,7 días** (11,0 y 34,9 el 2026-09-28).
  Son edades: crecen un día por día que pase sin que nada cambie. La columna miente.
- **Los 24 viejos nunca recibieron las columnas de la `048`**: `atribucion_primera = '{}'` en los
  24 y `zona_horaria_del_lead` nula en los 24; `campos_del_crm` está vacío en 23 de ellos. Los 12
  nuevos las traen.
- **Los 24 viejos son invisibles para todas las cohortes**, que se arman con `alta_en_el_crm >= …`: son
  exactamente los 24 contactos sin alta de la base (activos sin alta: 0). Leads Portal lo declara
  (`docs/leads-portal/09-DE-DONDE-VIENE-CADA-DATO.md:67`) y Conversion desde CV-4 (§ 13). 11 de los 36 tienen cita alcanzable.

```sql
select count(*) total,
       count(*) filter (where territorio is null) congelados,
       count(*) filter (where alta_en_el_crm is null) sin_alta,
       count(*) filter (where territorio is not null and alta_en_el_crm is null) activos_sin_alta,
       count(*) filter (where territorio is null and alta_en_el_crm is not null) congelados_con_alta
from negocio.contactos;
-- 2026-09-15: 584 · 25 · 25 · 0 · 0
-- 2026-09-28 22:02 UTC: 594 · 25 · 24 · 0 · 1      2026-10-18 15:39 UTC: 624 · 36 · 24 · 0 · 12

select que_paso, count(*), min(detectado_el)::date, max(detectado_el)::date
from negocio.cambios_de_territorio group by 1;
-- 2026-09-28: alta 10 · congelado 1 · descongelado 1 · traspaso 0 — desde el 2026-09-15
-- 2026-10-18: alta 40 · congelado 11 (del 09-17 al 10-09) · descongelado 1 · traspaso 0
```

**Sólo se descongelan por dos vías, y ninguna es el paso del tiempo:** que la etiqueta de zona
reaparezca en el CRM, o que alguien abra su ficha — pero un congelado no aparece en ninguna cola.
Lo mínimo sigue siendo que `congelarLosQueYaNoEstan` escriba `sincronizado_el`; lo correcto, pedirlos
por identificador cada tanto con `contactoPorId` (`lib/ghl/cliente.ts:545`), que ya usa
`refrescarUnContacto` (`lib/negocio/sincronizar.ts:585`).

### 2.2 · Las citas no tienen resta, y la tarjeta mira treinta días de un barrido que mira catorce

`lib/negocio/citas.ts` sigue con 436 líneas y cero apariciones de `congelar` o de `deleteFrom`: una
cita que el CRM deja de listar conserva su último `estado_ghl` para siempre. Pero el agujero grande
no es ése, y conviene nombrarlo por su constante: el barrido le pide al CRM las citas desde **14
días atrás** (`DIAS_ATRAS`, `lib/negocio/citas.ts:75`, usado en `lib/negocio/citas.ts:163`) y la
pestaña abre en treinta. **Toda cita que empezó hace más de catorce días no se vuelve a leer nunca**,
y sigue contando con el estado que tenía el día que cruzó ese borde.

```sql
select v.dias,
       count(*) filter (where c.sincronizado_el < now() - interval '3 days') sin_refrescar,
       count(*) filter (where c.sincronizado_el < now() - interval '3 days'
                          and c.ghl_calendario_id is null) tapadas_por_el_filtro,
       count(*) filter (where c.sincronizado_el < now() - interval '3 days'
                          and c.ghl_calendario_id is not null) con_calendario
from (values (14), (30), (3650)) v(dias)
join negocio.citas c on c.inicio_el >= now() - make_interval(days => v.dias)
                    and c.inicio_el <  now()
group by v.dias order by v.dias;
-- 2026-09-15:            14d → 12 · 11 · 1  |  30d → 114 · 77 · 37   |  completo → 138 · 101 · 37
-- 2026-09-28 22:03 UTC:  14d →  1 ·  0 · 1  |  30d → 156 · 14 · 142  |  completo → 283 · 101 · 182
-- 2026-10-18 15:39 UTC:  14d →  3 ·  0 · 3  |  30d →  27 ·  0 ·  27  |  completo → 348 · 101 · 247
```

La fila de 14 días es la del defecto «no hay resta» en estado puro: **tres citas** (una el 2026-09-28) que
el CRM dejó de listar dentro de la ventana que sí se barre. Las otras son el borde.

Y llega hasta la cifra publicada. Con el filtro del módulo —alcanzable, sin descartados, ya
ocurrida; la ventana se cierra con `inicio_el < now()` en `lib/negocio/indicadoresDeCitas.ts:417`—:

```sql
-- El denominador de la tarjeta y la cancelación, con el mismo filtro que el módulo.
select count(*) citas,
       count(*) filter (where lower(coalesce(c.estado_ghl, '')) = 'cancelled') canceladas,
       count(*) filter (where c.sincronizado_el < now() - interval '3 days') sin_refrescar,
       count(*) filter (where lower(coalesce(c.estado_ghl, '')) = 'cancelled'
                          and c.sincronizado_el < now() - interval '3 days') canceladas_sin_refrescar
from negocio.citas c
where c.inicio_el >= now() - interval '30 days' and c.inicio_el < now()
  and c.ghl_calendario_id is not null
  and not exists (select 1 from negocio.contactos ct, unnest(ct.etiquetas) e
                  where ct.org_id = c.org_id and ct.id = c.contacto_id
                    and lower(e) = any (array['icp_rechazado', 'rechazado', 'rechazado_positivo',
                                              'rechazado_negativo', 'no calificado', 'descalificado']));
-- 2026-09-15 18:17 UTC: 128 · 52 (40,6 %) · 37 · 19 (la peor, 7,6 días)
-- 2026-09-28 22:03 UTC: 103 · 33 (32,0 %) · 76 · 27 (la peor, 13,7 días)
-- 2026-10-18 15:39 UTC:  40 · 14 (35,0 %) · 24 ·  9 (la más vieja sin releer de las 40 lleva 16,6 días)
```

**24 de las 40 citas de la tarjeta no se leen desde hace más de tres días, y 9 de las 14 canceladas que
producen el 35,0 % tampoco** (76 de 103 y 27 de 33 el 2026-09-28). No se afirma que estén mal: se afirma que no
hay forma de saber si lo están. El 2026-09-28, 73 de las 76 eran de contactos sincronizados en las últimas 24
horas (no re-medido): el contacto se refresca y su cita no, en la misma fila de la misma pantalla.

Lo que haría falta: que el barrido de citas relea hacia atrás lo mismo que la ventana más ancha que
la pantalla ofrece, o que la tarjeta declare cuántas de sus citas están fuera de lo que se relee.
Hoy no hace ninguna de las dos.

---

## 3 · Lo que está bloqueado por falta de datos

Ninguno es un problema de código. Los cuatro tienen su medición, y hasta que el número cambie no hay
nada que construir.

- **`issue_source` (§ 11.4 del documento funcional) — si falló el agente o el prompt.**
  `negocio.prompts_del_agente` tiene **0 filas** (2026-10-18, igual que el 2026-09-28), así que el
  auditor no recibe el prompt vigente contra el cual distinguir un fallo de ejecución de uno de
  diseño.
- **La medición de impacto (§ 14).** `negocio.versiones_del_prompt` tiene **0 filas**: no hay línea
  base ni «después» que comparar.
- **El embudo del formulario de la landing (§ 9.7).** El campo `Form Landing VSL` está congelado:
  la última alta que lo trae es del 2026-08-31. A 30 días lo tienen **0 de 25** contactos
  (2026-10-18 15:39 UTC; 5 de 276 el 2026-09-28): llegó a cero, como las dos fotos anteriores anticiparon.
  En toda la base lo traen 247 de 624.
- **Trigger link: enviado y abierto (§ 9.5).** No hay señal propia, pero GoHighLevel ya los usa:
  `Trigger Link` vale **31 de 594** en `atribucion_ultima` y **0 de 594** en `atribucion_primera`
  (2026-09-28 22:04 UTC), y **31 de 624** y 0 de 624 el 2026-10-18: no entró ninguno nuevo. Las dos citas de
  `docs/conversion/` dan las cifras del 2026-09-28. Los 31 tienen cita. Nadie distingue el valor: Acquisition
  corta por el `sessionSource` del primer toque (`lib/negocio/atribucionDelLead.ts:96`, leído en
  `lib/negocio/atribucionDelLead.ts:143`), que nunca lo trae; la ficha de Leads Portal también lee
  el primero (`lib/negocio/fichaDelLeadDelPortal.ts:151`); Conversion lee del último su `url`
  (`lib/negocio/recorrido.ts:127`) y si trae `sessionSource` o no (`lib/negocio/recorrido.ts:165`),
  nunca cuál. El valor aparece una sola vez en el código, en un comentario
  (`lib/negocio/recorrido.ts:17`, que todavía dice 29 de 584). La pantalla de Conversation decía que un trigger
  link «es un sistema aparte —un redirector con un token por contacto—»
  (`components/conversation/PanelDeConversation.jsx:101@6f3bdb5`); el texto se fue con el panel en CN-3 (2026-10-10).
  Por cita, a 30 días: **33 de 192** el 2026-09-28 a las 22:40 UTC; no se volvió a medir para este corte.

```sql
select (select count(*) from negocio.prompts_del_agente) prompts,
       (select count(*) from negocio.versiones_del_prompt) versiones,
       (select count(*) filter (where campos_del_crm ? 'XqOfGEWle6fay7hPuvWp')
          from negocio.contactos where alta_en_el_crm >= now() - interval '30 days') con_campo_30d,
       (select count(*) from negocio.contactos
         where alta_en_el_crm >= now() - interval '30 days') cohorte_30d,
       (select count(*) from negocio.contactos
         where atribucion_ultima->>'sessionSource' = 'Trigger Link') trigger_ultima,
       (select count(*) from negocio.contactos
         where atribucion_primera->>'sessionSource' = 'Trigger Link') trigger_primera;
-- 2026-09-28 22:04 UTC: 0 · 0 · 5 · 276 · 31 · 0
-- 2026-10-18 15:39 UTC: 0 · 0 · 0 ·  25 · 31 · 0
```

---

## 4 · El show rate: el KPI principal del § 10.3 sigue vacío, y no por falta de código

La columna existe, la pantalla que la escribe existe y la que la lee la dibuja. Lo que falta es que
alguien la use. Medido el 2026-10-18 a las 15:39 UTC, sobre las **368 citas** de la tabla (333 el
2026-09-28):

- `citas.asistio is not null` —alguien cerró el intento—: **0 de 368**. La escribe
  `lib/negocio/avanzar.ts:248`.
- `estado_ghl = 'showed'` —lo dijo el CRM—: **3 de 368** (0 el 2026-09-28), las tres pasadas de `confirmed`, la
  última el 2026-10-08. **Nadie las lee**: `ESTADO_ASISTIO` (`lib/ghl/calendarios.ts:195`) no aparece en otro archivo.
- `estado_ghl = 'noshow'`: **20** (15 el 2026-09-28). El resto: 179 `cancelled` y 166 `confirmed`.
- `negocio.resultados`: **7 filas, 2 con `salida = 'no_show'`, la última del 2026-09-09.** Nadie
  cerró un intento desde que la pregunta de asistencia existe (la `049`, 2026-09-14).

**Y es cero en las cuatro ventanas**, así que no hay botón que lo rescate: el denominador de la
tarjeta va 1 (hoy), 4 (7 días), 40 (30 días) y 173 (completo) el 2026-10-18 a las 15:38 UTC, y `con_asistencia`
es 0 en las cuatro (2 · 6 · 103 · 143 el 2026-09-28).

Hasta CN-3 la pantalla lo dibujaba como el hueco que es: «asistencia · 0 de 103 cerradas»
(`components/conversation/PanelDeConversation.jsx:623@6f3bdb5`) y el eslabón «Se presentaron» con «nadie lo
registró» (`components/conversation/PanelDeConversation.jsx:651-655@6f3bdb5`). El servidor aplica el mismo
criterio: el denominador filtra `asistio is not null` (`lib/negocio/indicadoresDeCitas.ts:393-396`) y
la tasa es `null` por debajo del piso (`lib/negocio/indicadoresDeCitas.ts:473-476`). Sin ese filtro
la tasa sería 0 % sobre 103 y diría, plausible y falsamente, que no se presenta nadie.

El control está cableado de punta a punta (`components/negocio/Avanzar.jsx:138-139`, con el rótulo
en `components/negocio/Avanzar.jsx:324`), y la excepción sigue importando: **con la salida `no_show`
`asistio` se guarda en `false` sin preguntar** (`components/negocio/Avanzar.jsx:129`). La primera fila
puede entrar con que un closer registre un plantón.

Y la vía que **no** hay que abrir sigue escrita donde alguien la abriría: `asistio` está fuera del
`do update` del barrido a propósito (`lib/negocio/citas.ts:419`). Si entrara, cada pasada horaria la
pondría en nulo y nada fallaría. [13-SETTER-Y-CLOSER.md](13-SETTER-Y-CLOSER.md) § 7 anota los otros
atajos que tientan —las etiquetas del CRM, las llamadas de tl;dv— y por qué ninguno es la respuesta.

```sql
select lower(coalesce(estado_anterior_ghl, '(nulo)')) venia_de, lower(estado_ghl) esta_en, count(*)
from negocio.citas where estado_cambiado_el is not null group by 1, 2 order by 3 desc;
-- 2026-09-15: un solo par, confirmed → noshow
-- 2026-09-28: confirmed → noshow 12 · confirmed → cancelled 2 · noshow → cancelled 1;
--             el último cambio registrado es del 2026-09-22
-- 2026-10-18: confirmed → noshow 17 · confirmed → cancelled 11 · confirmed → showed 3 · noshow → cancelled 1;
--             el último, del 2026-10-17
```

---

## 5 · Columnas que se escriben y nadie lee

- **`resultados.cita_id`: 0 de 7** (2026-10-18, igual que el 2026-09-28). La escribe `lib/negocio/avanzar.ts:193`,
  en la misma transacción que `asistio`; están en cero por el mismo motivo que el § 4 y se llenan con el
  mismo primer cierre.
- **`mensajes.estado_entrega_familia` se congela.** Sólo se refresca dentro de una hora desde el
  envío (`VENTANA_MS`, `lib/negocio/entregas.ts:56`) y a dos mensajes por ciclo (`POR_CICLO`,
  `lib/negocio/entregas.ts:53`), sobre la cola de `pendientesDeRevision`
  (`lib/negocio/entregas.ts:137`). El archivo no cambió desde el 2026-08-25. El 2026-10-18 a las 15:39 UTC:
  **482 mensajes en `en_curso` y 0 dentro de la ventana** que esa cola mira (479 y 0 el 2026-09-28). Ese 482 no es
  «en tránsito»: es «nunca se supo».
- **`fallo_del_canal` casi no se escribe: 530 fallidos y 3 con motivo** (475 y 3 el 2026-09-28; 435 y 3 el
  2026-09-15). La ingesta guarda el estado y descarta el texto del canal, que es lo único que separa «se dio de
  baja» de «el número no existe». Y `failed` sigue clasificado como `sin_confirmar` (`lib/ghl/entrega.ts:69`),
  igual que `queued` (`lib/ghl/entrega.ts:68`), con 2 `queued` hoy. La familia `fallido` suma además `undelivered`
  y `opt_out` (`lib/ghl/entrega.ts:69-70`, `lib/ghl/entrega.ts:79`), pero el 2026-10-18 `estado_entrega = 'failed'`
  da también **530**: no hay un solo fallido con otro estado, como el 2026-09-28. Es la cifra que cuenta
  [06-INTEGRACIONES-GHL.md](06-INTEGRACIONES-GHL.md) § 10.
- **`citas.inicio_anterior_el`, `estado_anterior_ghl` y `estado_cambiado_el`** no las lee ningún
  archivo de `lib/`, `app/` ni `components/`: se escriben en `lib/negocio/citas.ts:390`,
  `lib/negocio/citas.ts:410` y `lib/negocio/citas.ts:414`, y quien las lee es el § 4 de este archivo.
- **`ESTADO_ASISTIO`**, nuevo como caso: el CRM ya lo escribe en 3 citas y ningún archivo lo lee (§ 4).
  Leerlo no es sumarlo: `citasAlcanzables.ts` ya prohíbe sumar los plantones del CRM con `asistio`
  (`lib/negocio/citasAlcanzables.ts:87-113`), y lo mismo valdría para éstas.

```sql
select count(*) filter (where estado_entrega_familia = 'en_curso') en_curso,
       count(*) filter (where estado_entrega_familia = 'en_curso' and direccion = 'saliente'
                          and id_fabricado = false
                          and enviado_el > now() - interval '1 hour') en_cola,
       count(*) filter (where estado_entrega_familia = 'fallido') fallidos,
       count(*) filter (where estado_entrega_familia = 'fallido'
                          and fallo_del_canal is not null) con_motivo
from negocio.mensajes;
-- 2026-09-15 18:17 UTC: 478 · 0 · 435 · 3
-- 2026-09-28 22:04 UTC: 479 · 0 · 475 · 3
-- 2026-10-18 15:39 UTC: 482 · 0 · 530 · 3
```

---

## 6 · `desde`: Cerrado el 2026-10-10

En Lead Flow, con «Completo», `desde` vale 2025-08-08 sobre una cohorte casi entera de agosto en adelante de 2026.
`bddb516` (2026-09-16) lo cerró a medias: `desde` sigue siendo el mínimo (`lib/negocio/indicadoresDelLead.ts:268`),
pero viaja con la mediana y con un guardián que habla cuando la fecha describe a un caso suelto (`avisoDeLaCola`,
`lib/negocio/periodo.ts:158-176`, con el umbral de 0,25 en `lib/negocio/periodo.ts:147`). Faltaba el año: `fechaCorta`
formateaba con `day` y `month` y nada más (`components/conversation/PanelDeConversation.jsx:399-404@6f3bdb5`), así que
el 2025-08-08 salía «8 de agosto» al lado de un «24 de agosto» de 2026. **Cerrado el 2026-10-10 en CN-4
(`89d8c19`)**: la fecha lleva el año cuando no es el de hoy (`components/conversation/comun.jsx:91-96`), y el aviso
de la cola, que la pantalla ya no dibuja, lo recibe el cerebro (`lib/agentes/executive/adaptadores/conversation.ts:75`).
Medido el 2026-10-18: la mitad de los 600 contactos con alta entró después del 2026-08-28.
La tarjeta dibuja ese «desde el …» debajo de «Contactos» y de «Citas totales»
(`components/conversation/PanelDeConversation.jsx:300`, `:320`), y la regla general está en
[07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) § 6: «Completo» no se lee como historia.

```sql
select min(alta_en_el_crm)::date desde_completo, count(*) cohorte,
       count(*) filter (where alta_en_el_crm >= '2026-08-01') desde_agosto,
       count(*) filter (where alta_en_el_crm <  '2026-08-01') cola
from negocio.contactos where alta_en_el_crm is not null;
-- 2026-09-16 13:49 UTC: 2025-08-08 · 560 · 531 (94,8 %) · 29
-- 2026-09-28 22:11 UTC: 2025-08-08 · 570 · 540 (94,7 %) · 30
-- 2026-10-18 15:39 UTC: 2025-08-08 · 600 · 562 (93,7 %) · 38
```

---

## 7 · El descarte no tiene fecha

**Sigue igual el 2026-10-18.** De la `050` a la `078` ninguna migración toca `etiquetas` (`grep -li` sólo la encuentra
en un comentario de la `079`, que no está en producción). Los eventos de la `084`, de sólo agregar, podrían guardar
cuándo se puso cada etiqueta, pero nada los escribe hasta la Fase 1 del modelo (§ 22). La partición entre «citas de
contactos descartados» y el resto se lee de las etiquetas **actuales** del contacto, y
`negocio.contactos` no guarda cuándo se aplicó cada etiqueta. El archivo de la `047` guarda la zona,
no las etiquetas.

Consecuencia: una etiqueta puesta mañana reclasifica retroactivamente citas de la semana pasada, y
**dos lecturas de la misma ventana en días distintos pueden dar tasas distintas sin que haya entrado
una cita**. Lo que se publica es «cómo se clasifican HOY las citas de la ventana elegida», no «cómo
estaban clasificadas entonces». Y crece solo: las citas ya ocurridas van del 2026-08-12 al 2026-10-17 (368 en la
tabla, 2026-10-18), así que «completo» ya son 67 días de pasado que una etiqueta de esta mañana puede reescribir;
47 el 2026-09-28 y 34 el 2026-09-15.

---

## 8 · Lo que cambia solo, para que no se lea como una falla

- **El sentimiento ya cruzó el piso, como se había anticipado.** En la ventana de 30 días hay **6 juzgadas**
  (2026-10-18 15:39 UTC; 23 el 2026-09-28): las 3 del 2026-09-21 y una del 2026-10-02, otra del 10-06 y otra del
  10-14. Bajo 10 la cifra es `null` (`lib/auditor/sentimiento.ts:127`), y el piso se aplica sobre las juzgadas con
  valor del vocabulario (`lib/auditor/sentimiento.ts:120`). Con 7 días hay **1**. No es una falla: casi no entran
  conversaciones que auditar (§ 12).
- **El aviso de citas congeladas se apagó a 30 días.** La congelada más nueva sigue siendo del 2026-09-10: a 30
  días quedan **0** (14 el 2026-09-28), así que el aviso calla desde alrededor del 2026-10-10, como estaba
  previsto; en «completo» son 101 y no se apaga nunca.
- **La pestaña Auditoría está vacía para 10 de las 11 empresas activas**, igual que el 2026-09-28. Por el motivo
  que devolvería `resolverAccesoAlAuditor` (`lib/credenciales/resolver.ts:574`): **6 sin fila de credenciales**
  —que se reporta como falta de llave (`lib/credenciales/resolver.ts:589`)—, **4 con llave y sin
  `crm_agente_usuario_id`** (`lib/credenciales/resolver.ts:597`), 0 apagadas y **una sola que audita**.

```sql
select analizado_el::date dia, count(*) from negocio.analisis_del_agente
where agente = 'chat_post_agenda' and auditable and disparo <> 'mejora' group by 1 order by 1;
-- 2026-09-28: 09-01 → 10 · 09-06 → 1 · 09-07 → 1 · 09-08 → 3 · 09-10 → 2 · 09-11 → 1
--             09-12 → 2 · 09-21 → 3
-- 2026-10-18: lo mismo, más 10-02 → 1 · 10-06 → 1 · 10-14 → 1

select count(*) activas,
       count(*) filter (where cr.org_id is null) sin_fila,
       count(*) filter (where cr.auditor_activo = false) apagado,
       count(*) filter (where cr.ia_clave_cifrada is not null
                          and coalesce(trim(cr.crm_agente_usuario_id), '') = '') sin_id_del_agente
from identidad.organizaciones o
left join identidad.organizaciones_credenciales cr on cr.org_id = o.id
where o.activa;
-- 2026-09-15: 12 · 8 · 0 · 3      2026-09-28: 11 · 6 · 0 · 4      2026-10-18: 11 · 6 · 0 · 4
```

---

## 9 · Executive: la última maqueta publicaba en nombre de seis pantallas que ya miden

**Cerrada el 2026-10-01** (nueva estructura, E7, `4e9a242`): la maqueta se retiró entera —cifras, panel, chat y
cajones— y la pantalla `executive` pasó a ser el Inicio, que no dibuja ninguna cifra
(`docs/OTROS/nueva-estructura/04-EL-INICIO.md`). Desde el 2026-10-04 tiene ruta propia, la del cerebro, y la bandera
`sinOperacionesTodavia` bajó (`lib/autorizacion/secciones.ts:239`); desde el 2026-10-06 también la Reunión de hoy. Lo
que sigue es la deuda como estaba el 2026-09-28, para que se pueda comparar; el detalle pieza por pieza, en
[11-EXECUTIVE.md](11-EXECUTIVE.md) § 3:

- **7 días: 312 contactos, $8.525 de inversión y 11 ventas** (`lib/aios/executive.js:17@c4cf2a8`), cuando la base
  decía 3 contactos y 0 ventas registradas en toda su historia.
- **Sales con punto verde y «11 ventas · cierre 31 %»** (`lib/aios/executive.js:194-197@c4cf2a8`); **Acquisition con
  «312 contactos · +9 %»** (`lib/aios/executive.js:178-181@c4cf2a8`); **Conversion con «26 % de visita a cita» y un
  formulario que falla en Safari** (`lib/aios/executive.js:186-189@c4cf2a8`).
- **El panel encadenaba Creative → Conversion → Sales** en un tema causal inventado
  (`lib/aios/executive-panel.js:12-13@c4cf2a8`), y el chat contestaba «Vas 11 de 30» con Conversion y Sales como
  fuentes (`lib/aios/executive-chat.js:35-36@c4cf2a8`).

La veía quien tuviera `tablero.ver` (`lib/autorizacion/secciones.ts:238`), que hoy es la capacidad del Inicio.

---

## 10 · Leads Portal: el humo, dos preguntas, y lo que LP-6 dejó sin dueño

- **La prueba de humo con sesión iniciada no tiene registro.** Es el paso 4 de la verificación del
  plan (`docs/leads-portal/13-EL-CONTRASTE.md:240-241`), la hace el usuario, y ni el repositorio ni
  la historia de git dicen que se haya hecho ([10-LEADS-PORTAL.md](10-LEADS-PORTAL.md) § 2); la memoria del
  proyecto la sigue dando por pendiente. El cotejo para ese día es `scripts/medir-leads-portal.sql`.
- **Dos preguntas abiertas, del lado del usuario.** `LP05-P02`: si `medium`, `campaignId` y el objetivo del anuncio
  entran a la lista blanca de la ficha (`docs/leads-portal/05-LA-FICHA-DEL-LEAD.md:400-403`). `LP04-P01`: si la
  rejilla se ordena por alta o por puntaje (`docs/leads-portal/04-LA-REJILLA-Y-LOS-FILTROS.md:289-294`); con 1 alta
  en los últimos 7 días (2026-10-18), el orden por alta muestra primero a gente de hace semanas. La tercera,
  `LP08-P01` (`docs/leads-portal/08-LO-QUE-ENTREGA-Y-RECIBE.md:350`), **cerrada el 2026-10-01** (E7): el cajón de
  Executive del que hablaba se borró con la maqueta.
- **Cerradas el 2026-10-01 (E7), las tres de la maqueta que quedaban.** `#recoModal` quedó en el marcado sin quién lo
  abriera (`components/Overlays.jsx:101@c4cf2a8`, `lib/aios/period-controls.js:40-45@c4cf2a8`); `datepicker.js`
  abría el calendario sin que nadie registrara su función (`lib/aios/datepicker.js:123-131@c4cf2a8`,
  `lib/aios/datepicker.js:133@c4cf2a8`), así que «Aplicar» cambiaba el rótulo y no las cifras, mientras
  `scripts/paridad.mjs:159-162@c4cf2a8` y el punto 8 de `LP08-12`
  (`docs/leads-portal/08-LO-QUE-ENTREGA-Y-RECIBE.md:259-261`) decían que la píldora estaba `hidden`
  (`components/views/ExecutiveView.jsx:62@c4cf2a8`) aunque el modo Funnel la mostraba
  (`lib/aios/executive.js:161-162@c4cf2a8`); y el comentario del armazón nombraba a quienes ya no abrían los
  overlays (`lib/aios/shell.js:156-158@c4cf2a8`; los que sí: `lib/aios/executive-panel.js:81@c4cf2a8` y
  `lib/aios/executive-panel.js:102@c4cf2a8`). Los tres archivos se fueron con la maqueta del Executive. El punto 8
  de `LP08-12` sigue diciendo lo de la píldora en un documento que ya no tiene de qué hablar (§ 16).

Los huecos de la pantalla y los documentos de `docs/leads-portal/` que quedaron atrás están en los
§ 13 y § 16.

---

## 11 · Analizadores: construidos, y una isla

Lo detalla [14-ANALIZADORES.md](14-ANALIZADORES.md) § 7, con cifras del 2026-09-28 que acá no se re-midieron. Lo
verificado acá contra el código, otra vez el 2026-10-18:

- **El sello se escribe y no lo lee nadie.** El comentario dice que el motivo «tiene que poder
  leerse desde la pantalla de monitoreo» (`lib/negocio/barrido.ts:801-812`), y en `lib/`, `app/` y
  `components/` `ultimo_motivo` sólo aparece en `lib/negocio/barrido.ts` y en `lib/datos/esquema.ts`;
  fuera de ahí lo lee `scripts/medir-analizadores.sql:88`. Una llave de tl;dv revocada sólo se ve
  con SQL. Y desde la `076` el mismo sello dice cuándo Meta no está vinculado (§ 12): tampoco lo lee nadie.
- **La caché se paga y no se lee.** El sistema va con `cache_control`
  (`lib/analizadores/nucleo/anthropic.ts:215`); según 14, 0 tokens leídos de caché en 7 de 7
  análisis propios (no re-medido).
- **Gasto que no queda escrito.** `terminarConFallo` no guarda tokens
  (`lib/analizadores/datos.ts:336-344`) y la clasificación descartaba el uso del modelo. **Cerrada en AG2
  de los agentes (`cd851b3`, 2026-10-04)**: cada llamada de los Analizadores, la clasificación incluida, deja su
  fila en `negocio.uso_de_ia` (`lib/analizadores/pipeline.ts`, `anotarLaLlamada`); el 2026-10-18 hay 24 de ellas.
- **El contador de reintentos sólo sube** (`lib/analizadores/datos.ts:878-886`), y **el reintento
  exige la llave de tl;dv aunque no la use** (`lib/negocio/barrido.ts:739-755`): una transcripción
  pegada a mano que falle en una empresa con sólo llave de IA no se reintenta nunca sola.
- **`scripts/medir-analizadores.sql` no mide el reintento**: el sello que lee es sólo el de
  `analizadores` (`scripts/medir-analizadores.sql:87-89`) y `reintentos_automaticos` no aparece.
- **El mismo umbral escrito dos veces:** `MINUTOS_PARA_DARLA_POR_COLGADA = 15` en
  `lib/analizadores/datos.ts:58` y en `components/analizadores/PanelDeAnalizadores.jsx:61`, sin
  prueba que ate los dos.
- **Fuera de la pestaña, sólo los agentes leen estos datos**: desde AG11 (`3170786`, 2026-10-05) las objeciones
  clasificadas y los agregados de venta y onboarding llegan al cerebro (89 objeciones el 2026-10-18); ni Sales ni la
  ficha ni Closer los dibujan, y `negocio.llamadas` sigue en **0 filas** (2026-10-18). El error de una llamada
  fallida guardaba datos del cliente: § 15.

---

## 12 · Datos del negocio que cambian la lectura de todo

- **La pauta «no gastaba desde el 2026-09-14»: Cerrada el 2026-10-07 (`22ec755`, la `076`), porque era falso.** Las
  13 campañas que el colector pedía no gastaban, pero una campaña de mensajes —cuyos contactos llegan sin
  `campaignId`— gastó 200,19 del 30-sep al 6-oct, medido con la serie de la cuenta contra el Administrador de anuncios
  (`docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md`, C14-23). **Lo que sí pasa hoy:** la serie de la cuenta
  (`negocio.gasto_de_la_cuenta`) da entre 28 y 38 por día hasta el 2026-10-05 y **0 desde el 2026-10-06**, salvo 1,20
  el 2026-10-14 (medido el 2026-10-18). Toda cifra de Acquisition, Creative y Leads Portal con ventana posterior al
  5 de octubre habla de un negocio sin pauta. Y entran pocos: desde el 2026-09-14, 29 contactos; a 7 días, 1. La
  ventana de 30 días no cayó bajo el piso de 10, como se temía el 2026-09-28: tiene 25.
- **«Meta desconectado» contra «no se invirtió»: Cerrada a medias el 2026-10-07 (`22ec755`).** El colector ya
  preguntaba el vínculo (`lib/negocio/recolectarAnuncios.ts:622-627@d17e029`), y desde la `076` el sello lo dice:
  «Meta no está vinculado en GoHighLevel: no se leyó el gasto» (`lib/negocio/barrido.ts:1110-1113`). Lo que falta es
  quien lea el sello (§ 11): ninguna pantalla lo muestra.
- **Sólo se pedían las campañas de nuestra atribución: Cerrada el 2026-10-07 (`22ec755`).** Antes, 13 de las 61
  campañas de la cuenta (`lib/negocio/recolectarAnuncios.ts:261-320@d17e029`); hoy se piden las activas y las que
  gastaron en la última semana (`lib/negocio/recolectarAnuncios.ts:597`), el relleno busca lo que la cuenta dice que
  gastó otra campaña, y `negocio.campanas` tiene 62 filas (2026-10-18).
- **Ninguna campaña está asignada a un funnel.** `negocio.funnels_de_campana` tiene **0 filas** el 2026-10-18: los
  tres funnels de Acquisition se calculan sobre campañas sin asignar. Asignarlas era la primera tarea del usuario
  después de AQ-5 (memoria del proyecto).
- **Hay ventas en el CRM que Sales no ve.** La etiqueta `venta_ganada` está en **2 contactos** (1 el 2026-09-28) y
  `negocio.resultados` no tiene ninguna fila con `salida = 'venta'`; Sales cuenta por la segunda
  (`lib/negocio/ventasDelContacto.ts:27`). Sumar las dos fuentes mezclaría lo que dijo el CRM con lo que registró una
  persona ([13-SETTER-Y-CLOSER.md](13-SETTER-Y-CLOSER.md) § 7).

```sql
select (select max(fecha) from negocio.metricas_de_anuncio where gasto > 0) ultimo_dia_con_gasto,
       (select count(*) from negocio.contactos where alta_en_el_crm >= '2026-09-14') desde_el_14,
       (select count(*) from negocio.contactos where 'venta_ganada' = any (etiquetas)) etiqueta,
       (select count(*) from negocio.resultados where salida = 'venta') resultados_venta,
       (select count(*) from negocio.funnels_de_campana) funnels;
-- 2026-09-28 22:11 UTC: 2026-09-13 · 8 · 1 · 0 (la primera cifra estaba mal: el colector no pedía la campaña que gastaba)
-- 2026-10-18 15:39 UTC: 2026-10-14 · 29 · 2 · 0 · 0
select fecha, gasto from negocio.gasto_de_la_cuenta where fecha >= '2026-09-28' order by fecha;
```

---

## 13 · Pantallas que dicen algo falso de sí mismas

Es la clase de deuda más cara de esta lista, porque el que la lee es el usuario y no un programador.

- **Conversion dice que Clarity está conectado.** El texto que se dibuja afirma que «Clarity
  aparece en la pantalla como fuente conectada» (`lib/negocio/embudoDelFormulario.ts:142-143@b2dcdf5`), y los
  chips se borraron el mismo 2026-09-20 (`components/views/ConversionView.jsx:21-25@b2dcdf5`). **Cerrado el
  2026-10-09** (CV-4 de Conversion): el texto dice que Clarity no está integrado, y la pantalla ya no dibuja los huecos.
- **«Sin rastro: 26 contactos, todos anteriores a septiembre»** (`lib/negocio/recorrido.ts:91-94`, y
  lo mismo en `lib/negocio/recorrido.ts:28-29` y `docs/conversion/01-LOS-DOS-RECORRIDOS.md:205-211`).
  Medido el 2026-10-18 (igual que el 2026-09-28): 27 con `atribucion_ultima = '{}'`: 24 sin alta, 2 con alta de
  antes de septiembre y **uno con alta en septiembre**; como la cohorte exige alta, en «Completo» la fila muestra 3
  y no 26. Desde CV-4 el texto viaja como `title` de la celda del cajón (`components/conversion/CajonDelPaso.jsx:134`).
- **El botón «Hoy» promete «las últimas 24 horas, no el día del calendario»**
  (`lib/negocio/periodo.ts:84`), y ese título se dibuja en Conversion
  (`components/conversion/PanelDeConversion.jsx:122@b2dcdf5`) —Acquisition dejó de dibujarlo en AQ-4, el
  2026-09-30—, cuyas cohortes se anclan al día de
  calendario (`lib/negocio/recorrido.ts:201-203`; el propio `lib/negocio/costoDelAnuncio.ts:62-64`
  lo admite). Y `lib/negocio/periodo.ts:76-77` decía, hasta `65669f4` (2026-10-18),
  que todas las ventanas del sistema son móviles. Leads Portal sí es móvil
  (`lib/negocio/leadsDelPortal.ts:300`): sus «30 días» no son la misma cohorte en los bordes. **En Conversion,
  cerrado el 2026-10-09** (CV-4): su segmentado va sin ese `title`, y desde CV-3 corta en días cerrados. El comentario
  de `periodo.ts`, **cerrado el 2026-10-18 (`65669f4`)**; lo de Leads Portal sigue.
- **El monitor de atribución contaba una clave que nadie trae. Cerrada el 2026-10-18 (`65669f4`).** Las cinco UTM
  incluyen `utmCampaign` (`lib/negocio/calidadDeLaAtribucion.ts:89`), que está en **0 de 624** contactos; GoHighLevel
  manda `campaign` (273 en el primer toque, 2026-10-18), y la atribución ya lo usaba (`lib/negocio/atribucionDelLead.ts:97`).
  Como el `?&` de las cinco no se cumplía nunca, todo contacto con alguna UTM contaba como incompleto, y la señal
  `ACQ-ATRIBUCION-UTM` del detector, que volvió el 2026-10-05 tras dormir desde AQ-4, mandaba a arreglar enlaces que
  sí llevan la campaña ([01-ACQUISITION.md](01-ACQUISITION.md), riesgo 2). Hoy cada UTM se reconoce por cualquiera de
  sus claves (`lib/negocio/calidadDeLaAtribucion.ts:91-106`, usadas en `:137-145`): completas, 56 de 519; la señal sigue,
  por `utmTerm`, la que menos llega. Subido a producción el mismo día.
- **«Entregó N días» cuenta días sin impresiones.** `diasConEntrega` es `gasto is not null`
  (`lib/negocio/costoDelAnuncio.ts:297`), y hay **47 filas con gasto 0 y sin impresiones** (2026-10-18; 38 el
  2026-09-28); la nota se dibujaba en la tabla por anuncio de Acquisition, que salió con AQ-4. Creative lo
  corrigió de su lado (`lib/negocio/rendimientoDelCreativo.ts:220-233`) y
  `pruebas/base/99-costo-del-anuncio.test.ts:207-220` no cubre el caso.
- **«Landing con VSL» es circular y no se marca.** La marca exige el 90 %
  (`components/conversion/PanelDeConversion.jsx:347@b2dcdf5`, `lib/negocio/recorridoDelLead.ts:273-275`) y la
  fila da 86 % a 30 días según [03-CONVERSION.md](03-CONVERSION.md) (no re-medido); su rótulo
  (`lib/negocio/recorrido.ts:70-73`) describe el recorrido de agosto. Desde CV-4 (2026-10-09) la tabla vive en el
  cajón de Landing, y la marca «registrada al reservar» va sólo en la fila registrada entera; la del 86 % sigue
  sin marca, y el aviso del servidor la nombra sólo desde el 90 %.
- **La cobertura de Conversion dice «de 570» sobre una base de 594** sin declarar los 24 sin alta
  (§ 2.1), que Leads Portal sí declara. **Cerrado el 2026-10-09** (CV-4 de Conversion): en «Completo» la nota dice
  «{N} contactos sin alta no entran.» (CV15-10).
- **Leads Portal manda los huecos de Sales siempre** (`app/api/leads-portal/route.ts:80`), con el
  texto fijo «No hay ninguna venta registrada» (`lib/negocio/huecosDeSales.ts:59`), sin mirar si hay
  ventas. El día de la primera venta, la tarjeta la va a contar y el hueco la va a negar. Sigue igual el 2026-10-18.
- **La tarjeta «Todos» de Leads Portal dibuja «0 vendidos»**
  (`components/leads-portal/PanelDeLeadsPortal.jsx:308-309`), el único cero de la pantalla sobre la
  venta, al lado de un «—» con motivo, cuando el encabezado del mismo archivo promete «un guion donde
  no hay de qué hablar, nunca un cero» (`components/leads-portal/PanelDeLeadsPortal.jsx:21`).
- **Executive entero** (§ 9), y su píldora «Personalizado», que aplica un rango que no cambia nada
  (§ 10). **Cerrado el 2026-10-01** (nueva estructura, E7): los dos se fueron con la maqueta.

---

## 14 · Comentarios que dicen lo contrario del código

Un comentario falso es un defecto de primera clase: quien lo lee para decidir, decide sobre otro
sistema. Todos re-verificados el 2026-10-18 leyendo las dos puntas.

- **Cerrada el 2026-10-07 (`22ec755`).** `lib/negocio/barrido.ts:243-245@d17e029` contaba **52 llamadas por día**
  «por cuatro días» cuando se releían dos (`DIAS_QUE_SE_RELEEN`, `lib/negocio/recolectarAnuncios.ts:62`); con la
  `076` el comentario se reescribió con el costo nuevo, 8 a 14 llamadas por día (`lib/negocio/barrido.ts:285-288`).
- **Cerrada el 2026-10-18 (`65669f4`).** `db/migraciones/053_el_desglose_que_ya_llegaba.sql:34-35` ponía la tarea
  `anuncios` en «el cron de las 17:06 UTC»; es `17 6 * * *`, las 06:17 (`lib/negocio/barrido.ts:266`), y hoy dice eso.
- `lib/negocio/sincronizar.ts:23-28` dice que `ultimo_entrante_el` y los suyos «quedan nulos» y que
  `score` «nada lo calcula»; `lib/negocio/sincronizar.ts:337-338` pone `score` y `responsable_id` entre
  lo que no se pisa. Lo contradicen `lib/negocio/sincronizar.ts:441` y `lib/negocio/sincronizar.ts:501`,
  que escriben `score`, y la `054`, que borró `responsable_id`.
- `lib/ghl/contrato.ts:339` dice que la carpeta del formulario de Meta tiene 9 campos y
  `lib/ghl/contrato.ts:355` que las siete etiquetas cortas son de esa carpeta; 06 midió hoy 7 campos y
  dos de las etiquetas en otra carpeta (no re-medido).
- `lib/ghl/cliente.ts:1` dice «Solo lectura de contactos»; el archivo pone y quita etiquetas
  (`lib/ghl/cliente.ts:592`, `lib/ghl/cliente.ts:638`).
- **Cerrada el 2026-09-30 (AQ-1 de Acquisition, `fd553b7`).** Una copia huérfana de un bloque de
  `lib/negocio/recolectarAnuncios.ts` se borró: en su lugar quedó el escritor de campañas.
- **Cerrada el 2026-10-07 (`22ec755`).** `comoDia` (`lib/negocio/costoDelAnuncio.ts:409-412@d17e029`) usaba
  `toISOString()` sobre un `date`, lo que `lib/negocio/recolectarAnuncios.ts:329-333@d17e029` documenta como defecto
  al este de UTC; la función se fue con la reescritura del gasto.
- `lib/negocio/costoDelAnuncio.ts:517` numera «2 ·» el tercer aviso (el de
  `lib/negocio/costoDelAnuncio.ts:493` ya es el 2), y `lib/negocio/costoDelAnuncio.ts:18` dice que el
  `adId` llega «si y sólo si» el lead entró por Facebook o Instagram; 01 midió hoy 4 de 217 que no
  (no re-medido).
- **Cerrado el 2026-10-08** (CV-1 de Conversion): `lib/negocio/recorrido.ts:193-195@210ac73` justificaba la ventana anclada porque Conversion cruza con el
  gasto y las piezas; de lo que mide, la ruta sólo llamaba a `recorridoDelLead` y a `embudoDelFormulario` (desde
  AG14 de los agentes además lee sus señales guardadas, que no cruzan gasto ni piezas)
  (`app/api/conversion/route.ts:64-78@02d9207`).
- `lib/negocio/tramosDelIcp.ts:20` («47 de los 471») no dice la fecha en esa línea. (El «79 anuncios y
  12 con gasto» del panel anterior de Acquisition salió con él en AQ-4.)
- `lib/negocio/leadsDelPortal.ts:272-275`: sin argumento mide 14 días (`DIAS_DE_LA_TASA`), que no es
  ninguna de las cuatro ventanas. La ruta siempre le pasa el período; es un riesgo latente.
- Los números de la maqueta de Conversion no coinciden entre sí: 530 literales en
  `components/views/ConversionView.jsx:2@b2dcdf5` y `components/conversion/PanelDeConversion.jsx:11@b2dcdf5`, 538 en
  `lib/negocio/vistaDeConversion.ts:8` y `docs/conversion/09-LO-QUE-NO-ES-UN-REQUISITO.md:36`; y 648
  líneas en `components/conversion/PanelDeConversion.jsx:8@b2dcdf5` y `lib/negocio/vistaDeConversion.ts:6`,
  cuando `git show 0add4cc^:lib/aios/conversion.js` tiene 655.
- `lib/aios/shell.js:156-158@c4cf2a8` y `scripts/paridad.mjs:159-162@c4cf2a8`: § 10, cerradas.
- **Nuevos, del 2026-10-08; cerrados el 2026-10-18 (`65669f4`).** `lib/autorizacion/secciones.ts:239` decía que no
  quedaba ninguna sección con la bandera `sinOperacionesTodavia`, y `pruebas/codigo/30-portero.test.ts:348-350` que la
  lista estaba vacía; las dos lo eran hasta que Client OS entró con la bandera (`lib/autorizacion/secciones.ts:494`,
  `82ba9e7`), y hoy dicen que queda sólo `clientos`. Y `lib/negocio/periodo.ts:76-77` decía que todas las ventanas son
  móviles, que dejó de ser cierto con los días cerrados de CV-1 (§ 13); hoy dice que esas pantallas pasaron a cerrados.

---

## 15 · Datos personales en un repositorio público

El repositorio es público: un comentario es una publicación, y **la historia de git conserva todo
lo que se borre del árbol**. Sacarlos del árbol es un commit; sacarlos de la historia es reescribirla,
y eso es una decisión, no un arreglo. Acá no se repite ningún nombre: se dice dónde están.

- **`docs/OTROS/capa-base/ETAPA-9.md`** tiene nombres propios de personas y de una organización
  cliente cerca de `docs/OTROS/capa-base/ETAPA-9.md:151` y `docs/OTROS/capa-base/ETAPA-9.md:347-349`.
- **Los apellidos de los dos closers que la tabla de Sales mide** aparecen en `docs/sales/` —por
  ejemplo `docs/sales/04-LA-TABLA-DE-CLOSERS.md:99-100` y `docs/sales/02-METRICAS.md:177-178`, y en
  `docs/sales/06-PERIODOS-Y-PISOS.md`, `docs/sales/10-LO-QUE-NO-ES-UN-REQUISITO.md`— y en comentarios
  de código: `lib/ghl/calendarios.ts:19`, `components/negocio/Fila.jsx:23`,
  `components/views/CloserView.jsx:11` (el único de los cuatro que
  [13-SETTER-Y-CLOSER.md](13-SETTER-Y-CLOSER.md) § 3.6 señala), `components/views/SalesView.jsx:19-20@a39a732`.
  También en una migración (`db/migraciones/034_varios_closers.sql:38`) y en una prueba
  (`pruebas/codigo/91-closer-y-setter.test.ts:434`, `pruebas/codigo/91-closer-y-setter.test.ts:442`): **9 archivos**
  con alguno de los dos apellidos el 2026-10-18 (`git grep -l` sobre las siete carpetas de fuente; 10 el 2026-09-28).
- **El nombre de pila de una persona del equipo está en 51 archivos** el 2026-10-18 (`git grep -lw` sobre `lib/`,
  `app/`, `components/`, `pruebas/`, `scripts/`, `docs/` y `db/`; 43 el 2026-09-28): casi todos comentarios
  que atribuyen un pedido con su fecha, en `lib/fundaciones/`, `lib/tools/`, `components/fundaciones/`,
  `components/tools/`, `app/api/`, `pruebas/codigo/`, y cuatro documentos de `docs/conversion/` que lo
  asocian a las fallas inventadas de la maqueta (por ejemplo
  `docs/conversion/09-LO-QUE-NO-ES-UN-REQUISITO.md:66`).
- **`docs/OTROS/analizadores/ANALIZADORES.md:5`** tiene un nombre de pila y
  `docs/OTROS/analizadores/ANALIZADORES.md:205` el UUID de una llamada.
  **`scripts/comparar-con-brain.sql`** tiene escritos dos UUID: uno en
  `scripts/comparar-con-brain.sql:28` y el otro en `scripts/comparar-con-brain.sql:36`, `:56` y `:58`
  (según 14, el `cliente_id` de una cuenta de ARIA Brain y el de una organización).
- **`lib/ghl/entrega.ts:128`** cita literalmente el título de una cita, que parece llevar el nombre
  completo de una persona, y **`app/api/closer/contactos/route.ts:78`** nombra a una persona en un
  ejemplo.
- **`lib/ghl/contrato.ts:44`** y **`lib/ghl/contrato.ts:94`** llaman por su nombre de pila a un
  contacto de la subcuenta, el ejemplo de un contacto con dos etiquetas contradictorias a la vez
  (leído el 2026-09-28; [13-SETTER-Y-CLOSER.md](13-SETTER-Y-CLOSER.md) § 3.6 ya los señala).
- **Y uno que no está en el repositorio sino en la base:** el error de una llamada fallida guarda los
  primeros 200 caracteres de la respuesta del modelo, que en un informe OB empiezan por los datos del
  cliente, y la lista lo dibuja (`components/analizadores/PanelDeAnalizadores.jsx:395`). Toda medición
  SQL que lea `error` lee datos personales. **Cerrada para las fallas nuevas en AG2 (`cd851b3`, 2026-10-04)**: el
  error dice sólo «El modelo no devolvió JSON parseable.» (`lib/analizadores/nucleo/engine.ts:71`); las FAILED ya
  guardadas conservan el suyo hasta que se reintenten (no re-medido cuántas quedan).
- **No hay un acuerdo de tratamiento de datos con los clientes** sobre mandar datos de sus leads a un proveedor de
  IA (`AG-86`, `docs/OTROS/agentes/05-PERMISOS-Y-PRIVACIDAD.md`, 2026-10-04). Viajan la conversación del lead (el
  auditor), la transcripción de la llamada (los Analizadores) y, desde AG12, el Brief del closer, el agente que manda
  los datos de una persona. El modelo de datos sin subir trae la tabla donde se anotaría lo que firmó cada empresa
  (`identidad.acuerdos`, `db/migraciones/080_las_cuentas.sql:5-17`; § 22); el acuerdo en sí sigue sin existir.

---

## 16 · Documentos que se contradicen o quedaron viejos

**De producción y de la especificación.**

- `docs/OTROS/produccion/DESPLIEGUE.md:675-687` dice que «las otras siete pantallas del prototipo
  siguen igual» y lista como datos inventados `AcquisitionView.jsx`, `SalesView.jsx`,
  `lib/aios/leads-portal.js` y `creative.js`, `conversion.js`, `conversation.js` y `acquisition*.js`.
  Las dos vistas miden desde el 16 y el 21 de septiembre, y el 2026-10-18 de `lib/aios/` sólo quedan `index.js` y
  `shell.js`: la maqueta del Executive y `components/Overlays.jsx` se fueron el 2026-10-01 (E7). Ninguna pantalla
  del prototipo sigue con datos inventados.
- El bloque «Lo que queda pendiente» del mismo archivo (`docs/OTROS/produccion/DESPLIEGUE.md:441`)
  tiene tres puntos que el código desmiente (leído el 2026-09-28):
  - Que faltan «las pantallas de administración» y que el alta se hace por guion
    (`docs/OTROS/produccion/DESPLIEGUE.md:448-449`). Ajustes existe desde `9fa82c9` y sus pestañas
    de usuarios y de empresas desde `b24d697`, los dos del 2026-08-24, y dan de alta por la API
    (`components/ajustes/Usuarios.jsx:365-366`, `components/ajustes/Empresas.jsx:145-146`).
  - Que «el auditor de IA no existe» y que `negocio.hallazgos` no tiene lector ni escritor
    (`docs/OTROS/produccion/DESPLIEGUE.md:473-476`). Tiene dos escritores
    (`lib/auditor/escritura.ts:295`, `lib/auditor/buscarMejora.ts:267`), lectores en `lib/auditor/`
    (por ejemplo `lib/auditor/pantalla.ts:244`) y **27 filas**, detectadas entre el 2026-09-01 y el
    2026-10-06 (2026-10-18; 24 el 2026-09-28). Las dos consecuencias que el párrafo deduce sobre la cola
    «Intervenciones urgentes» cuelgan de esa premisa y no se re-midieron acá.
  - Que `serie_agotada` es un sabor pendiente de conectar
    (`docs/OTROS/produccion/DESPLIEGUE.md:490-502`). Se retiró: `lib/negocio/miDia.ts` ya no lo
    nombra y `components/closer/MiDia.jsx:123-126` dice que nunca se produjo. La línea de arriba,
    `components/closer/MiDia.jsx:122`, todavía anuncia «los cuatro sabores».

  De los otros cuatro que el bloque da por abiertos (el de la sincronización ya está tachado como
  cerrado), el del QR sigue cierto: el servidor no lo genera
  (`app/entrar/page.tsx:98-99`), la pantalla sólo arma el enlace (`app/entrar/page.tsx:113`), y
  en `lib/`, `app/` y `components/` «QR» sólo aparece en ese comentario y en
  `app/api/auth/2fo/configurar/route.ts:57`, otro comentario.
  La protección de rama y el canal de avisos los sigue
  [17-LA-PLATAFORMA.md](17-LA-PLATAFORMA.md) § 5.3 y § 8. El guion de los usuarios de `closer_usuarios` ya no
  tiene tabla: Closer v1 se borró de producción el 2026-10-13 (§ 22).
- `docs/OTROS/especificacion/TRAZABILIDAD.md:25` dice «75 reglas, 26 ⛔»; las tablas del mismo
  archivo tienen **85 filas `ADR-` distintas, 31 con ⛔** (contadas el 2026-09-28).
- `docs/OTROS/especificacion/LEXICO.md:18` ubica `conOrganizacion(` en `lib/datos/capa.ts`; vive en
  `lib/datos/contexto.ts:156`.
- `docs/OTROS/capa-base/ETAPA-0.md:201-202` y `docs/OTROS/produccion/COMPATIBILIDAD.md:148` dicen
  que la imagen es `postgres:18-alpine`; `docker-compose.yml` fija `postgres:17-alpine`, que es lo que
  `docs/OTROS/produccion/DESPLIEGUE.md:12` explica.
- El `README.md`, en «ICP & Oferta es la excepción», dice que el estado de Fundaciones vive en el
  almacén de ARIA-brain; `docs/OTROS/analizadores/ANALIZADORES.md:26` dice que esa dependencia se
  cortó el 2026-09-07. **Tiene razón el segundo**, y [12-ICP-Y-OFERTA.md](12-ICP-Y-OFERTA.md) § 2.5 lo
  decidió con el código a la vista, junto con cuatro comentarios que repiten al `README.md`.
- `docs/OTROS/especificacion/00-MAPA.md:15` fechaba la guía del grafo el 2026-09-15; ya da el corte del grafo, el 2026-09-29.
- `docs/OTROS/analizadores/ANALIZADORES.md:116` sigue diciendo que falta el hito de 24 h,
  `docs/OTROS/analizadores/ANALIZADORES.md:117` y `docs/OTROS/analizadores/ANALIZADORES.md:121` dejan
  HT-10 y OB-4 «en curso», y `docs/OTROS/analizadores/ANALIZADORES.md:342` anuncia como futuro un
  rescate que el reintento hizo el 2026-09-24 ([14-ANALIZADORES.md](14-ANALIZADORES.md) § 7).

**De los departamentos.**

- **Sales, `S2-12`:** el cuerpo mide la concentración en **62,7 %** (32 de 51 citas a 14 días,
  `docs/sales/02-METRICAS.md:210`) y el resumen del mismo archivo dice **85 %**
  (`docs/sales/02-METRICAS.md:266`).
- **Creative, referencias cruzadas rotas.** `C2-05` manda la fatiga por frecuencia a `C2-24`
  (`docs/creative/02-METRICAS.md:87`), que es la fatiga por caída de CTR
  (`docs/creative/02-METRICAS.md:307`); la de frecuencia es `C2-25`
  (`docs/creative/02-METRICAS.md:326`). `C14-P02` se cita como abierta
  (`docs/creative/08-DE-DONDE-VIENE-CADA-DATO.md:83`, `docs/creative/08-DE-DONDE-VIENE-CADA-DATO.md:222`,
  `docs/creative/11-EL-ANALIZADOR-Y-EL-DETECTOR.md:91`, `docs/creative/13-EL-CONTRASTE.md:184`) y se
  contestó el 2026-09-19 (`docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md:283`). Y
  `docs/creative/13-EL-CONTRASTE.md:188` llama `C14-P03` a «si `results` puede llegar como arreglo»,
  que es `C14-P04` (`docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md:410`); `C14-P03` es otra
  pregunta (`docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md:403`).
- **Acquisition.** `docs/acquisition/00-MAPA.md:147-155` dice que el gasto por anuncio «espera a
  Meta» y su propia cabecera (`docs/acquisition/00-MAPA.md:16-18`) dice que se mide.
  `docs/acquisition/13-EL-CONTRASTE.md:164-170`, `docs/acquisition/10-LO-QUE-PIDE-EL-DOCUMENTO.md:216-217`
  y `docs/acquisition/11-LOS-SEIS-COMPONENTES.md:40` siguen poniendo la credencial de Meta como el
  freno, que `3d96e8c` desmintió (`lib/ghl/anuncios.ts:4-25`). `A1-06` remite al gran total de
  `A1-07` (`docs/acquisition/01-LOS-TRES-EMBUDOS.md:169`), que son las etiquetas
  (`docs/acquisition/01-LOS-TRES-EMBUDOS.md:171`); el gran total es `A1-14`
  (`docs/acquisition/01-LOS-TRES-EMBUDOS.md:275`).
- **«Un solo toque».** `docs/acquisition/11-LOS-SEIS-COMPONENTES.md:225-227`,
  `docs/acquisition/13-EL-CONTRASTE.md:53-54` y `docs/acquisition/10-LO-QUE-PIDE-EL-DOCUMENTO.md:100-103`
  dicen que la base guarda un solo toque. Guarda los dos: primer toque no vacío en **580**, último en
  **597**, distintos entre sí en **292** (2026-10-18; 553, 567 y 279 el 2026-09-28). Lo que no hay es historia ni fecha.
- **Conversion.** `docs/conversion/00-MAPA.md:212-215` dice que ningún módulo lee
  `atribucion_ultima`; la lee `lib/negocio/recorrido.ts:127` desde el 2026-09-20.
  `docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:33-36` cuenta 349 contactos en «agosto
  y antes» con los 24 sin alta adentro; sin ellos, la landing de agosto es 62 % y no 58 % (según 03,
  no re-medido).
- **Leads Portal.** El resumen de `docs/leads-portal/11-LO-QUE-PIDE-EL-DOCUMENTO.md:69-74` da «sin
  medir» a las respuestas de Meta y de la landing, que su propia tabla da medidas
  (`docs/leads-portal/11-LO-QUE-PIDE-EL-DOCUMENTO.md:51-52`); `LP12-P01` sigue «sin medir»
  (`docs/leads-portal/12-QUIEN-VE-QUE.md:342`) y 10 lo midió el 2026-09-28; `LP12-01` muestra la bandera
  `sinOperacionesTodavia` como actual (`docs/leads-portal/12-QUIEN-VE-QUE.md:17-27`) y salió en LP-4;
  `LP10-13` da por pendiente el cursor de mano (`docs/leads-portal/10-LO-QUE-NO-ES-UN-REQUISITO.md:325`)
  que `app/leads-portal.css:107@c4cf2a8` ya anuló; `LP10-03` cita líneas sin archivo que eran del
  `leads-portal.js` borrado (`docs/leads-portal/10-LO-QUE-NO-ES-UN-REQUISITO.md:104-106`); y el
  punto 8 de `LP08-12`, § 10.

---

## 17 · Citas que se pudren sin que nada falle

Una línea corrida es peor que una rota, porque no falla: alguien la abre, ve otra cosa, y no sabe si
el documento miente o si buscó mal.

- **La auditoría de citas mira las que salen de esta carpeta y sólo parte de las que llegan.** La carpeta entró a
  la lista de auditadas el 2026-09-28 (`pruebas/codigo/101-las-citas-de-los-documentos.test.ts:39-41`, en `861b5f0`),
  con el patrón que admite corchetes y el espacio entre `estado` y `actual/` (`:77-84`), así que también se
  auditan las que llegan desde `docs/sales/`, `docs/leads-portal/` y los planes de la lista (`:55-65`). El resto de
  `docs/conversion/` y de `docs/acquisition/` no, ni los comentarios del código. **Y no sólo citan los documentos:**
  `docs/conversion/01-LOS-DOS-RECORRIDOS.md:56` y `docs/conversion/07-LO-QUE-ENTREGA-Y-RECIBE.md:104` citan las
  líneas 187-188 de este archivo por el trigger link; cuatro rutas de señales (por ejemplo
  `app/api/creative/senales/route.ts:17`) y dos documentos de `docs/OTROS/agentes/` citan las 871-906 por la autoría
  bajo delegación; y doce documentos y `lib/negocio/cadenaDeCierre.ts:36` citan líneas de
  [07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md). El 2026-10-18 el árbol de trabajo las tiene fijadas a
  `972972e` (sin commit), que es la defensa correcta; este corte igual no movió esas líneas: § 20 empieza en la 871.
- **56 citas `01-ACQUISITION.md:N`** en `docs/acquisition/` —20 en `01-LOS-TRES-EMBUDOS.md`, 16 en
  `03-COSTOS.md` y 20 en `05-PERIODOS-Y-COMPARACION.md` (contadas el 2026-09-28)— apuntan a líneas
  de la foto anterior de [01-ACQUISITION.md](01-ACQUISITION.md), que hoy es otro texto.
- **La regla 11 de [07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md)** se cita por línea
  desde `components/conversion/PanelDeConversion.jsx:24@b2dcdf5`, `lib/negocio/cadenaDeCierre.ts:36`,
  `docs/conversion/01-LOS-DOS-RECORRIDOS.md:101`, `docs/conversion/03-EL-RECORRIDO.md:62` y
  `docs/sales/14-LOS-CINCO-ESLABONES.md:54`. Las cinco decían 451, que dejó de ser la regla; el 2026-09-28 se
  reapuntaron a la 625 (`861b5f0`), y el 2026-10-18 la 625 sigue siendo el encabezado del § 11. La de `docs/sales/`
  la audita la prueba; las otras cuatro, no.
- **Entre módulos:** `lib/negocio/calidadDelCreativo.ts:170`, `lib/negocio/rendimientoDelCreativo.ts:119`
  y `lib/negocio/rendimientoDelCreativo.ts:235` mandan el defecto de grano a las líneas 158-165 de
  `costoDelAnuncio.ts` (157-164 el 2026-09-28: alguien sumó una y siguen sin llegar), y está hacia
  `lib/negocio/costoDelAnuncio.ts:200`; `lib/negocio/fatigaDelCreativo.ts:7` manda la frecuencia a las 89-96, y está
  hacia `lib/negocio/costoDelAnuncio.ts:119`; `lib/negocio/rendimientoDelCreativo.ts:225` manda a la 296 lo
  que está en `lib/negocio/costoDelAnuncio.ts:297`; y `lib/negocio/recorrido.ts:189@210ac73` mandaba —cerrado el 2026-10-08, CV-1— a la 357 de
  `costoDelAnuncio.ts` y a la 230 de `calidadDelCreativo.ts` lo que está en
  `lib/negocio/costoDelAnuncio.ts:355` y `lib/negocio/calidadDelCreativo.ts:239`.

Lo que haría falta: que la auditoría sume `docs/conversion/`, `docs/acquisition/` y los comentarios
del código, y que las citas entre documentos de carpetas distintas vayan por sección y no por línea,
como ya hace esta carpeta hacia adentro.

---

## 18 · El grafo

Es deuda de herramienta y no de producto, pero sin ella la próxima foto ubica mal. Detalle en
[08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md). Lo de abajo se verificó el 2026-09-29; el 2026-10-18 sólo se
miraron las fechas: `graphify-out/graph.json` es del 2026-10-11 (hubo una actualización después de esta lista, que no
se revisó) y la firma de los rótulos sigue siendo del 2026-09-15.

- **La firma de los rótulos es vieja.** `graphify-out/.graphify_labels.json.sig` es del 2026-09-15 y
  ninguna de las 244 comunidades del grafo de hoy coincide con la suya: el próximo `graphify update`
  le pondría a cada una el nombre de su nodo central, también a las 154 que heredaron su nombre el
  2026-09-29 y a las 90 que rotuló un subagente ese día.
- **Los dos grafos anteriores de estos días sólo están en copias sueltas**: el de la mañana del
  2026-09-28 en `graphify-out/.graphify_old.json`, que el paso de actualización del skill pisa antes
  de fusionar y borra al terminar, y el del 2026-09-29 antes del AST completo en
  `graphify-out/.graphify_pre_ast.json`, que nada protege. `graphify-out/2026-09-28/` ya no corre
  riesgo —el respaldo de un `update` corrido hoy iría a otra carpeta—, y sigue guardando el corte del
  2026-09-17, sin `GRAPH_REPORT.md` ni `manifest.json`: 4.164 nodos y 10.264 aristas (contados otra
  vez el 2026-09-29), las cifras que 08 da para ese corte.
- **`graphify update` extrae en paralelo** (`watch.py` del paquete llama a `extract()` sin
  `parallel=False`), y en esta máquina el pool pierde archivos en silencio.
- **Re-extraer código suelto perdía llamadas entre archivos: cerrado el 2026-09-29.** Los 11
  archivos de código que ese día sólo cambiaron comentarios perdieron al re-extraerse por AST 19
  aristas hacia archivos de fuera del lote, 9 de ellas llamadas a `datos()`, que vive en
  `contexto.ts`. Un AST completo de los 641 archivos de código las devolvió todas, y de paso otras
  que faltaban desde la pasada por lote de la mañana del 2026-09-28 (08 § 1 y § 3). **La lección:
  re-extraer por AST un lote chico pierde las aristas entre archivos**; después de hacerlo, lo seguro
  es el AST completo, que no gasta tokens.
- **43 documentos de `docs/` siguen en el grafo con su versión de la mañana del 2026-09-28**, sin sello
  en `graphify-out/manifest.json` a propósito, para que el próximo `update` los pida (08 § 3).
- **`graph.html` pasó a ser la vista por comunidades** porque 6.854 nodos superan
  `MAX_NODES_FOR_VIZ = 5_000` del paquete, y nadie lo avisa.
- **`normalize_id` pasa todo por `casefold()`**, así que un tipo y su función homónima quedan como un
  solo nodo (08 contó 30 pares, y el 2026-09-29 siguen siendo 30).
- «29 files» en el `Corpus Check` de `graphify-out/GRAPH_REPORT.md`, que se regeneró después del
  AST completo, son los que la extracción de esta carpeta mandó a extraer —los 11 de código y los 18
  de esta carpeta—, no el corpus ni lo que detectó como nuevo o cambiado (72, según 08 § 1); y el
  comentario de `.graphifyignore` dice que el `.gitignore` esconde `lib/credenciales/`, que el
  `.gitignore` re-incluye desde `05534de`.

---

## 19 · Verificación pendiente

- **Las pantallas con sesión iniciada y datos reales de producción.** Ninguna tiene registro de haberse mirado así
  desde el 2026-09-15. Conversion, Sales, Conversation y Creative volvieron al front del prototipo entre el 2026-10-08
  y el 11 y se compararon con él en el preview local, con la base sembrada o con una respuesta sintética (CV-5,
  SA-5, CN-5 y CF-5); la revisión del usuario en producción figura pendiente en la memoria del proyecto. Acquisition
  se subió el 2026-10-01 sin haberse mirado nunca con datos (decisión del usuario), y el humo con login de la nueva
  estructura (usuario restringido, chat de ICP, escaneo en vuelo) y el de Leads Portal (§ 10) también siguen
  pendientes. Nadie miró si los números que hoy manda la base entran.
- **Dónde quedaba la línea entre aviso visible y nota escondida: Cerrada por cambio de diseño el 2026-10-10** (CN-3,
  `a6e6309`). La decidía `Nota` (`components/conversation/PanelDeConversation.jsx:346@6f3bdb5`), con `cs-grave`
  cuando era grave (`components/conversation/PanelDeConversation.jsx:349@6f3bdb5`) y sin prueba que mirara el
  reparto. Desde CN-3 la pantalla no dibuja avisos (`components/conversation/PanelDeConversation.jsx:30-31`): viajan
  en la respuesta y los da el agente. Lo que sigue igual es que la gravedad no viaja con el aviso —la capa de datos
  manda `string | null` (`lib/negocio/indicadoresDeCitas.ts:72`, `lib/negocio/indicadoresDeCitas.ts:155`,
  `lib/negocio/indicadoresDeCitas.ts:172`)—, así que el agente no tiene cómo saber cuál es grave.
- **El 500 de la autoría bajo delegación** no se reprodujo en vivo: § 20.
- **La pasada de miniaturas de los contactos** (CF-1, 2026-10-11) figura «por medir» en la memoria del proyecto. El
  2026-10-18 `negocio.miniaturas_del_contacto` tiene 526 filas, la última leída el 2026-10-11, y sólo 3 con video
  y ninguna con imagen (§ 21): no se averiguó si la pasada terminó su lista o dejó de correr.
- **La CI** no se mira desde el repositorio: el 2026-10-16 las doce últimas corridas de `main` estaban en verde
  (`gh run list`), y la protección de rama sigue sin estar ([17-LA-PLATAFORMA.md](17-LA-PLATAFORMA.md) § 5.2).
- **El orden «migrar y después empujar» de la `067`, la `068` y la `076`** no quedó registrado en ningún lado que
  esta foto haya podido leer ([07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md) § 8).
- **La suite no se corrió para esta foto**: comparte una sola base local. Donde este archivo dice que una prueba
  cubre o no cubre algo, es leído, no ejecutado. Sí se corrió la `101`, la auditoría de citas.
- **La evaluación real de los agentes** se hizo por tandas con el OK del usuario (memoria del proyecto, del
  2026-10-05 al 07); no se repitió para este corte, y ninguna llamada al modelo se hizo para escribirlo.

---

## 20 · La autoría bajo delegación: una decisión de producto que hoy se cobraría con un 500

Cuando un rol de plataforma trabaja sobre una empresa cliente, su sesión lleva la organización de
la empresa y el usuario de la principal, y ese par no existe en `identidad.usuarios`: la foránea
compuesta lo rechaza con `23503`, «nadie lo atrapa, y sale un 500 sin diagnóstico»
(`lib/autorizacion/sesion.ts:423-425`). `d8b542e` (2026-09-17) lo resolvió para «quién tocó esta
configuración», que bajo delegación va nulo (`lib/autorizacion/sesion.ts:453-454`), y **dejó
afuera a propósito la autoría de contenido**, donde un nulo sería una nota sin autor o una venta
que no registró nadie (`lib/autorizacion/sesion.ts:443-450`, y la sección «DÓNDE NO SE APLICÓ» del
mensaje del commit). Esas cuatro escrituras siguen fallando bajo delegación:

- `resultados.registrado_por`, `notas.autor_id` y `tareas.creada_por`, las tres de Avanzar
  (`lib/negocio/avanzar.ts:189`, `lib/negocio/avanzar.ts:277`, `lib/negocio/avanzar.ts:347`).
- `mensajes.autor_usuario_id`, al mandar un mensaje a mano
  (`app/api/contactos/[id]/mensajes/route.ts:223`). **Éste es el caro**: el envío al CRM va antes
  (`app/api/contactos/[id]/mensajes/route.ts:147`) y la escritura después, sin `catch`
  (`app/api/contactos/[id]/mensajes/route.ts:206`). Bajo delegación el mensaje le llega al contacto
  y quien lo mandó recibe un 500, que es justo lo que el comentario de la misma ruta dice que hay
  que evitar, porque «lo mandaría de nuevo» (`app/api/contactos/[id]/mensajes/route.ts:247-249`).

Las cuatro foráneas son compuestas desde la `011`
(`db/migraciones/011_negocio_closer_setter.sql:251`, `db/migraciones/011_negocio_closer_setter.sql:349`,
`db/migraciones/011_negocio_closer_setter.sql:409`, `db/migraciones/011_negocio_closer_setter.sql:451`).

**Hoy no lo paga nadie, y por eso no se ve.** De las **13 organizaciones**, la única con datos de
negocio es `aria`, la principal: fuera de ella, 0 contactos, resultados, notas, tareas y mensajes (re-medido el
2026-10-18 a las 15:39 UTC, como `count(distinct org_id)` = 1 en las cinco tablas), y dentro de la principal no hay
delegación. Se cobra el primer día que una empresa cliente tenga sus propios contactos y alguien de
la plataforma registre algo ahí. `components/negocio/Avanzar.jsx` no mira `mirandoOtraOrganizacion`,
así que el botón se ofrece igual y el error llega después de llenar el formulario.

Lo que falta no es código sino la decisión que el comentario deja escrita: si un rol de plataforma
puede registrar ventas dentro de un inquilino. Si no puede, el botón tiene que apagarse bajo
delegación y decir por qué; si puede, hay que decidir quién firma la fila. Lo de arriba está leído
en el código y en el commit, no reproducido: no se probó con una sesión de plataforma sobre una
empresa cliente. [16-AJUSTES-Y-PERMISOS.md](16-AJUSTES-Y-PERMISOS.md) § 5 lo nombra de pasada.

## 21 · Creative: la miniatura y el video, y Meta directo listo y dormido

Agregado el 2026-09-30 y puesto al día el 2026-10-18. El 2026-09-29 se decidió traer la miniatura y el video de cada
anuncio desde Meta directo, porque GoHighLevel no los entrega (`docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md`
§ 6). Se construyó primero la mitad que no depende de Meta —el link manual por pieza, el cajón de la pieza y la
credencial de Meta en Ajustes, con las migraciones `063` y `064`— y el 2026-10-15 la otra mitad, **lista y dormida**:
«Probar conexión» en Ajustes (`cce2d56`), y la tabla `negocio.activos_de_anuncio` (`078`) con su tarea horaria
`activos` al minuto 37, que sin token se sella como saltada (`972972e`). El plan, en
`docs/OTROS/futuro/miniatura-y-video-de-meta.md`; la guía para conectarlo, en
`docs/creative/17-CONECTAR-META-PASO-A-PASO.md`.

**Lo que falta, medido el 2026-10-18:**

- **El token.** `negocio.activos_de_anuncio` tiene **0 filas**: nadie siguió la guía todavía. CR-4 (medir con el token
  real), CR-8 (el video) y CR-9 (los huecos dinámicos) esperan eso, y el usuario decidió dejar el video para después
  de medir. Mientras tanto la pantalla es la del corte de [02-CREATIVE.md](02-CREATIVE.md).
- **La miniatura por el otro camino casi no llega.** Desde el 2026-10-11 la pasada de
  `lib/negocio/miniaturaDelContacto.ts` pide el «Video Url» de cada contacto con anuncio (`077`, CF-1): hay **526
  filas**, 519 encontradas, **3 con video y 0 con imagen**, y la última se leyó el 2026-10-11. El link manual por
  pieza tampoco se usó: `negocio.enlaces_de_pieza` tiene **0 filas**.

---

## 22 · Lo construido en local y lo pendiente en producción

- **El modelo de datos multiempresa, Fase 0: construido en local, sin subir, pendiente de aprobación.** Ocho
  commits del 2026-10-16 (`693a383..dc84cb2`) con las migraciones `079` a `084`: el catálogo común, las cuentas, la
  bandeja de lo crudo, `cuenta_id` en las 39 tablas de negocio de una cuenta con la política por cuenta, y los
  eventos (el detalle y las reglas que cambia, en [07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md), sección
  «Construido en local»). **Esperan la aprobación de un ingeniero**, y se suben en el orden de
  `docs/modelo de datos/20-PLAN-DE-SUBIDA-FASE-0.md` (carpeta local, fuera de git): el código de `app.cuentas`
  primero, después cada migración con su fase de relleno, y la `083` recién cuando la fase `cuenta-en-negocio` dejó
  todas las filas con su cuenta. Mientras no se suban, **`main` local va ocho commits adelante de producción**, y el
  próximo push de cualquier otra cosa los lleva si no se separan. Se comprueba con
  `git log 972972e..HEAD --oneline` y con la última de `migraciones.migraciones_aplicadas` (hoy, `078`).
- **Hay pendientes de seguridad de la base**, revisados el 2026-10-12, con su plan fuera del repositorio a
  propósito. No se detallan acá.
- **Cerrada fuera del repositorio, el 2026-10-12 y 13: lo ajeno que ya no se usaba.** Con el OK del usuario y un
  respaldo por grupo, se borraron de producción las tablas de las aplicaciones HT/OB y las de Closer v1. Medido el
  2026-10-18 en el catálogo: **0 tablas** `public.closer_*`, `public.ht_*` ni `public.ob_*`. Comando Central no
  dependía de ninguna; lo que sigue en `public` no es nuestro y no se toca sin la respuesta de su dueño.

---

## 23 · Lo nuevo del 2026-09-29 al 2026-10-16

- **El voseo de la conexión con Meta. Cerrada el 2026-10-18 (`65669f4`).** Al corte, los textos que ve quien conecta
  Meta voseaban: «Revisá…» y «Probá de nuevo» (`lib/meta/graph.ts:68`, `lib/meta/graph.ts:71`,
  `lib/meta/graph.ts:74-75`) y «Probá de nuevo» en `components/ajustes/ConexionConMeta.jsx:36`; y lo mismo el aviso
  de una ventana vacía de Leads Portal, «Probá una ventana más larga» (`lib/negocio/leadsDelPortal.ts:528-529`). La
  prueba de voseo **sólo miraba Tools** (`pruebas/codigo/202-tools-no-vosea.test.ts:40-44`), así que no lo veía. Hoy
  esas líneas dicen «Revisa», «Prueba de nuevo», «avisa a desarrollo» y «Prueba una ventana más larga», y la lista de
  `pruebas/apoyo/voseo.ts` suma «revisá» y «avisá». El arreglo completo que se proponía —que la lista recorra toda la
  aplicación— quedó hecho con `pruebas/codigo/258-la-aplicacion-no-vosea.test.ts`, que mira `components/`, `lib/` y
  `app/` enteros, fuera de Fundaciones (`:69-76`). **Lo que queda abierto:** el voseo del resto de la aplicación, contado
  y vigilado pero no corregido: 38 archivos en `TODAVIA_VOSEAN` (`:27-66`), y Fundaciones, que pasa a tú en la rama
  `feature/icp-oferta-v2` (por ejemplo `lib/fundaciones/conversacion.ts:348`). Un archivo nuevo que vosee pone la
  suite en rojo, y uno que se corrige tiene que salir de la lista (`:92-96`), así que sólo puede achicarse. Se mide con
  `node scripts/pruebas.mjs pruebas/codigo/258-la-aplicacion-no-vosea.test.ts` y contando las entradas de la lista.
- **El día de la empresa, diagnosticado y dejado para después** (`d17e029`, 2026-10-07). Las ventanas ancladas a
  `current_date` usan el día UTC de la base: para una empresa en Lima, de 19:00 a 24:00 «hoy» ya es mañana
  (`docs/OTROS/futuro/el-dia-de-la-empresa.md:8-13`). Y **9 de las 11 empresas activas tienen la zona `UTC`** por
  omisión (2026-10-18): la que tiene datos tiene la suya, pero los detectores corren cada hora para todas.
- **Los planes de acción crecen solos.** `negocio.planes_de_accion` tiene **1.152 filas** en 11 organizaciones el
  2026-10-18, unas 88 por día. Es lo diseñado: una fila por empresa, departamento, ventana y día, también vacía,
  porque el plan vacío es la marca de «ya corrió hoy» (`db/migraciones/072_las_senales.sql:28-33`); 22 por
  departamento y día son las 11 empresas por dos ventanas, y diez de ellas no tienen datos. Nada en `lib/`, `app/` ni `scripts/` las borra.
- **Las preguntas abiertas de cada frente** quedaron en sus planes, con su dueño: `docs/OTROS/futuro/lo-que-conversion-no-mide.md`,
  `docs/OTROS/futuro/lo-que-sales-no-mide.md`, `docs/OTROS/futuro/lo-que-conversation-no-mide.md`,
  `docs/OTROS/futuro/lo-que-creative-no-mide.md` y `docs/OTROS/futuro/plan-y-senales-de-acquisition.md`. De
  Acquisition, además, falta la decisión del usuario sobre el límite de `A14-10` («Completo» pierde los costos de un
  día que nunca se relee; memoria del proyecto).
- **Lo que espera a otra rama.** El «@ agente» del cerebro, y el uso y la voz de Fundaciones, esperan la rama de ICP
  & Oferta v2 de otra persona (memoria del proyecto); hasta entonces Fundaciones no deja su fila en
  `negocio.uso_de_ia`.
- **`MEDIDO_EL` envejece**: el de Sales y el de Leads Portal siguen diciendo el 21 y el 27 de septiembre
  (`lib/negocio/huecosDeSales.ts:53`, `lib/negocio/huecosDelLeadsPortal.ts:37`).

---

## 24 · Lo que encontraron la planificación de la nueva estructura y la línea base de la suite

Agregado el 2026-10-01, al planificar la nueva estructura
(`docs/OTROS/nueva-estructura/07-LO-QUE-SE-ROMPE-EN-SILENCIO.md`). Tres defectos que ya existían:

- **El botón «Eliminar» de Ajustes › Usuarios no aparece para nadie**, tampoco para el
  superadministrador. La ruta de sesión manda `puedeBorrarPersonas`, pero `app/guardia.tsx` no lo copia al
  contexto, y `components/ajustes/Usuarios.jsx` lo lee de ahí. La prueba que lo vigila mira las dos
  puntas y no el paso del medio. **Cerrado el mismo 2026-10-01** en la etapa E2 de la nueva estructura
  (`34e966c`): la guarda copia toda clave de la sesión, y la prueba `185` lo exige.
- **El panel lateral de la maqueta del Executive se ve en la primera carga** a quien arranca en otra
  pantalla (un closer, por ejemplo), hasta su primer clic: la clase que lo esconde sólo se pone al
  navegar. **Cerrado el 2026-10-01** en la etapa E7: la columna lateral se fue, y con ella la clase `.solo`.
- **El menú no se puede usar con el teclado**: sus filas son `div` sin foco. **Cerrado el 2026-10-01** en la etapa
  E9 (`b532a78`): las filas son `<button>` y la abierta lleva `aria-current`; en el teléfono, el cajón cerrado sale
  del orden del tabulador, así que las filas no son paradas invisibles.
- **Los chips «Hereda de» de Tools llevan a Prospección** (encontrado el 2026-10-02 en la revisión de la
  etapa E10). En Tu video de ventas y en Tu página, cada chip llama a `onIr` con el `id` de la herramienta
  de ICP que produjo el dato (`components/fundaciones/PanelHerramienta.jsx:403`; las fuentes, en
  `lib/fundaciones/herencia.ts:178`). Tools no tiene esos `id`, así que el panel cae a su primera
  herramienta, Prospección en frío, y desde E10 la barra lo marca: se cierra Marketing y se abre Sales.
  El arreglo es que un chip cuya herramienta vive en ICP & Oferta navegue allá, o no sea un botón, sabiendo
  que quien tiene Tools no siempre ve ICP. **Abierto el 2026-10-18** (el `onIr` es el mismo).
- **La prueba de los colores escritos a mano no mira el principio de una hoja** (encontrado el
  2026-10-02 al construir la cabecera de la etapa E11). `pruebas/codigo/104-temas.test.ts` salta todo
  lo que va antes de la primera vez que la hoja nombra la pseudoclase de la raíz —también dentro de un
  comentario o en un selector de más abajo—, porque supone que ahí empieza el bloque de tokens. Un color
  escrito a mano arriba de eso pasa en verde. El arreglo es que la prueba quite sólo los bloques de tokens.
  **Abierto el 2026-10-18**: desde entonces la prueba sumó siete hojas a su lista, sin cambiar ese salto.

Y, aparte, lo que encontró la línea base de la suite del 2026-10-01 en `main` (`60f5d81`):

- **Las tres claves foráneas de la `067` no tenían traducción en `QUE_LO_IMPIDE`**
  (`lib/administracion/borrado.ts`): si un borrado se bloqueaba por un incidente, el rechazo decía «tiene historial»
  sin decir cuál. **Cerrado el mismo 2026-10-01** (`33e0a76`): las tres tienen su frase. Desde la `070` (AG2,
  2026-10-04) `incidentes_usuario_id_fkey` es `on delete set null` y ya no frena nada, así que su frase salió de la
  lista. El modelo de datos sin subir agrega las frases de sus tablas nuevas en el mismo archivo (§ 22).
- **El CI de `main` estaba en rojo desde `43ce5ac`** por pruebas que dependen de la hora: la del mes pasado de
  `pruebas/base/98-setter-inicio.test.ts`, que falla en UTC el día 1 antes de las 05:00; cuatro de la agenda y del
  día del closer; y «una cita vencida sigue en la lista» (`pruebas/base/92-mi-dia.test.ts`). **Cerrada el
  2026-10-07** en lo que se ve: después de `ae30048`, que dejó de hacer depender la 205 de la hora, todas las
  corridas de `main` dieron verde (la última roja, `d0e711c`, 2026-10-07; `gh run list`, 2026-10-16). **Siguen
  abiertas** las que fallan cerca de la medianoche de Lima —la 27 y la 92, según la memoria del proyecto— y la 98 el
  día 1, que no cambió desde el corte: una corrida a esa hora vuelve a dar rojo.
