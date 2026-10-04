# Deuda abierta

> Corte: **2026-09-28**. Las cifras de producción se midieron ese día entre las **22:02 y las 22:14
> UTC**, con `scripts/supabase.mjs leer` y sólo agregados: de la base no salió un nombre, un correo
> ni un teléfono. Cada punto lleva la consulta que lo midió o el `archivo:línea` donde se comprueba,
> para que dentro de un mes se pueda volver a correr y ver si creció, se arregló solo o dejó de
> importar. Lo que no se pudo verificar está dicho como pendiente, no omitido. Para ubicar cualquier
> cosa nombrada acá, ver [08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md). Una segunda lectura,
> entre las 22:30 y las 22:32 UTC, repitió las cifras principales y dio lo mismo, salvo las que
> ruedan con la ventana, que se corrieron en uno (dicho donde pasa).

> **Desde el corte del 2026-09-15**
>
> - **De los once puntos de la foto anterior se cerró uno a medias y ninguno entero.** La fecha
>   `desde` de Lead Flow ya no engaña sola desde `bddb516` (09-16), pero sigue sin año (§ 6). Ocho
>   siguen abiertos con la cifra de hoy, uno se vacía como estaba previsto y otro se corrió (§ 1).
> - **Dos crecieron sin que cambiara una línea del código que las produce** (`lib/negocio/citas.ts` y
>   `lib/negocio/entregas.ts` no tienen commits desde el corte). Las citas que nadie volvió a leer
>   dentro de la tarjeta de Appointment Flow pasaron de 37 a 76 (§ 2.2), y los mensajes fallidos de
>   435 a 475, con los mismos 3 que traen motivo (§ 5).
> - **Cinco secciones dejaron de ser maqueta** —Acquisition (16 sep), Creative (19), Conversion
>   (20), Sales (21) y Leads Portal (26)— y una nació sin maqueta previa, Analizadores (23). Cada
>   una dejó su deuda: está en los § 9 a § 18, verificada una por una contra el código.
> - **La deuda nueva más cara no es de código.** La pauta no gasta desde el 2026-09-14 y la ventana
>   por omisión se está vaciando (§ 12), y el repositorio es público con nombres de personas reales
>   en decenas de archivos (§ 15).

**Algunas cifras llevan la hora, y no es un floreo.** El denominador de la tarjeta de citas era 128
a las 18:17 UTC del 2026-09-15, [13-SETTER-Y-CLOSER.md](13-SETTER-Y-CLOSER.md) lo midió en 106 a
las 18 h de hoy y acá dio 103 a las 22:03: se mueve solo, porque la ventana rueda y casi no entran
citas nuevas. Donde una cifra se mueve así va con su instante, porque en presente absoluto la
lectura siguiente la desmiente y el documento entero pierde crédito por un número que nunca estuvo
mal.

Esto NO es una lista de deseos. Es lo que está roto o incompleto **hoy**, con su consecuencia
concreta. Lo que sería lindo tener vive en el § 5 de cada informe de departamento, y los riesgos de
cada pantalla en su § 7; acá se juntan los que cruzan pantallas o que nadie más anotó.

---

## 1 · Los once puntos del 2026-09-15, uno por uno

| Punto de la foto anterior | Hoy | 2026-09-15 → 2026-09-28 | Acá |
|---|---|---|---|
| Contactos congelados | abierto | 25 → 25: quedan 24 de los viejos y hay 1 nuevo | § 2.1 |
| Citas sin resta | abierto, y creció | 37 → 76 dentro del denominador de la tarjeta | § 2.2 |
| Prompts sin cargar | abierto | 0 y 0 → 0 y 0 filas | § 3 |
| Formulario de la landing | se vacía, como estaba previsto | 137 de 409 → 5 de 276 a 30 días | § 3 |
| Trigger link | abierto | 29 de 584 → 31 de 594 en el último toque | § 3 |
| Show rate | abierto | 0 de 317 → 0 de 333 citas con asistencia | § 4 |
| Columnas sin lector | abierto | `cita_id` 0 de 7 → 0 de 7; fallidos con motivo 3 de 435 → 3 de 475 | § 5 |
| `desde` en Lead Flow | cerrado a medias, `bddb516` | queda la fecha sin año | § 6 |
| El descarte sin fecha | abierto | ninguna migración lo tocó | § 7 |
| Lo que cambiaba solo | se corrió | el piso del sentimiento cae hacia el 10-08 y no el 10-06 | § 8 |
| Verificación con sesión | abierta | sigue sin registro de que se haya hecho | § 19 |

---

## 2 · Dos agujeros de integridad del barrido

Siguen siendo los más caros porque **no fallan**: producen cifras plausibles sobre datos viejos.

### 2.1 · Veinticinco contactos congelados, y un archivo que ahora dice cuándo

`congelarLosQueYaNoEstan` (`lib/negocio/sincronizar.ts:289`) hace lo mismo que el 2026-09-15: pone
`territorio = null` (`lib/negocio/sincronizar.ts:297`) y **no toca `sincronizado_el`**. Como la
búsqueda del barrido es POR ETIQUETA, `guardar()` no vuelve a pasar por esa fila nunca más.

Lo que cambió no es el código sino lo que se sabe. El disparador de la migración `047` archiva cada
cambio de zona en `negocio.cambios_de_territorio` —el comentario lo dice en
`lib/negocio/sincronizar.ts:284-288`—, y la tabla tiene su primera fila el 2026-09-15. Medido el
2026-09-28 a las 22:02 UTC: **12 filas, 10 altas, 1 congelado, 1 descongelado y 0 traspasos**; el
congelado y el descongelado son los dos del 2026-09-17. O sea que de los 25 del corte anterior
quedan 24, se congeló uno nuevo, y **del nuevo sí se sabe cuándo**; de los 24 viejos no, porque son
anteriores a la primera fila del archivo.

Tres consecuencias, las tres medidas a las 22:02 UTC:

- **`sincronizado_el` afirma una frescura de hace entre 11,0 y 34,9 días** (el 2026-09-15 eran 3,9
  y 21,8). Son edades: crecen un día por día que pase sin que nada cambie. La columna miente.
- **Los 24 viejos nunca recibieron las columnas de la `048`**: `atribucion_primera = '{}'` en los
  24 y `zona_horaria_del_lead` nula en los 24; `campos_del_crm` está vacío en 23 de ellos. El nuevo
  trae las tres.
- **Son invisibles para todas las cohortes**, que se arman con `alta_en_el_crm >= …`: los 24 viejos
  son exactamente los 24 contactos sin alta de la base (activos sin alta: 0). Leads Portal lo
  declara (`docs/leads-portal/09-DE-DONDE-VIENE-CADA-DATO.md:67`); Conversion no (§ 13).

```sql
select count(*) total,
       count(*) filter (where territorio is null) congelados,
       count(*) filter (where alta_en_el_crm is null) sin_alta,
       count(*) filter (where territorio is not null and alta_en_el_crm is null) activos_sin_alta,
       count(*) filter (where territorio is null and alta_en_el_crm is not null) congelados_con_alta
from negocio.contactos;
-- 2026-09-15: 584 · 25 · 25 · 0 · 0
-- 2026-09-28 22:02 UTC: 594 · 25 · 24 · 0 · 1

select que_paso, count(*), min(detectado_el)::date, max(detectado_el)::date
from negocio.cambios_de_territorio group by 1;
-- 2026-09-28: alta 10 · congelado 1 · descongelado 1 · traspaso 0 — desde el 2026-09-15
```

**Sólo se descongelan por dos vías, y ninguna es el paso del tiempo:** que la etiqueta de zona
reaparezca en el CRM, o que alguien abra su ficha — pero un congelado no aparece en ninguna cola.
Lo mínimo sigue siendo que `congelarLosQueYaNoEstan` escriba `sincronizado_el`; lo correcto, pedirlos
por identificador cada tanto con `contactoPorId` (`lib/ghl/cliente.ts:545`), que ya usa
`refrescarUnContacto` (`lib/negocio/sincronizar.ts:562`).

### 2.2 · Las citas no tienen resta, y la tarjeta mira treinta días de un barrido que mira catorce

`lib/negocio/citas.ts` sigue con 436 líneas y cero apariciones de `congelar` o de `deleteFrom`: una
cita que el CRM deja de listar conserva su último `estado_ghl` para siempre. Pero el agujero grande
no es ése, y conviene nombrarlo por su constante: el barrido le pide al CRM las citas desde **14
días atrás** (`DIAS_ATRAS`, `lib/negocio/citas.ts:74`, usado en `lib/negocio/citas.ts:161`) y la
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
-- 2026-09-28 22:30 UTC:  igual, salvo 30d → 155 · 13 · 142 (una congelada salió por el borde)
```

La fila de 14 días es la del defecto «no hay resta» en estado puro: **una sola cita** que el CRM
dejó de listar dentro de la ventana que sí se barre. Las otras son el borde.

Y llega hasta la cifra publicada. Con el filtro del módulo —alcanzable, sin descartados, ya
ocurrida; la ventana se cierra con `inicio_el < now()` en `lib/negocio/indicadoresDeCitas.ts:397`—:

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
-- «la peor» es la cancelada sin releer más vieja; entre las 76, la más vieja lleva 17,1 días
-- (22:30 UTC, con las mismas 103 · 33 · 76 · 27).
```

**76 de las 103 citas de la tarjeta no se leen desde hace más de tres días, y 27 de las 33
canceladas que producen el 32,0 % tampoco.** No se afirma que estén mal: se afirma que no hay forma
de saber si lo están. Y 73 de esas 76 son de contactos sincronizados en las últimas 24 horas: el
contacto se refresca y su cita no, en la misma fila de la misma pantalla.

Lo que haría falta: que el barrido de citas relea hacia atrás lo mismo que la ventana más ancha que
la pantalla ofrece, o que la tarjeta declare cuántas de sus citas están fuera de lo que se relee.
Hoy no hace ninguna de las dos.

---

## 3 · Lo que está bloqueado por falta de datos

Ninguno es un problema de código. Los cuatro tienen su medición, y hasta que el número cambie no hay
nada que construir.

- **`issue_source` (§ 11.4 del documento funcional) — si falló el agente o el prompt.**
  `negocio.prompts_del_agente` tiene **0 filas** (2026-09-28, igual que el 2026-09-15), así que el
  auditor no recibe el prompt vigente contra el cual distinguir un fallo de ejecución de uno de
  diseño.
- **La medición de impacto (§ 14).** `negocio.versiones_del_prompt` tiene **0 filas**: no hay línea
  base ni «después» que comparar.
- **El embudo del formulario de la landing (§ 9.7).** El campo `Form Landing VSL` está congelado:
  la última alta que lo trae es del 2026-08-31. A 30 días lo tienen **5 de 276** contactos
  (2026-09-28 22:04 UTC; el 2026-09-15 eran 137 de 409), y **el 2026-09-30 vuelve a ser cero**, como
  la foto anterior anticipó. En toda la base lo traen 247 de 594.
- **Trigger link: enviado y abierto (§ 9.5).** No hay señal propia, pero GoHighLevel ya los usa:
  `Trigger Link` vale **31 de 594** en `atribucion_ultima` y **0 de 594** en `atribucion_primera`
  (2026-09-28 22:04 UTC; el 2026-09-15 era 29 de 584 y 0 de 584, y las dos citas de
  `docs/conversion/` ya dan las dos cifras). Los 31 tienen cita. Nadie distingue el valor: Acquisition
  corta por el `sessionSource` del primer toque (`lib/negocio/atribucionDelLead.ts:96`, leído en
  `lib/negocio/atribucionDelLead.ts:143`), que nunca lo trae; la ficha de Leads Portal también lee
  el primero (`lib/negocio/fichaDelLeadDelPortal.ts:151`); Conversion lee del último su `url`
  (`lib/negocio/recorrido.ts:126`) y si trae `sessionSource` o no (`lib/negocio/recorrido.ts:164`),
  nunca cuál. El valor aparece una sola vez en el código, en un comentario
  (`lib/negocio/recorrido.ts:17`). Y la pantalla de Conversation sigue diciendo que un trigger link
  «es un sistema aparte —un redirector con un token por contacto—»
  (`components/conversation/PanelDeConversation.jsx:98`). Por cita, uniendo las citas con
  calendario de los últimos 30 días con su contacto, como hizo la foto anterior: **33 de 192**
  (2026-09-28 22:40 UTC; eran 32 de 206 a las 18:17 del 2026-09-15).

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
```

---

## 4 · El show rate: el KPI principal del § 10.3 sigue vacío, y no por falta de código

La columna existe, la pantalla que la escribe existe y la que la lee la dibuja. Lo que falta es que
alguien la use. Medido el 2026-09-28 a las 22:02 UTC, sobre las **333 citas** de la tabla (317 el
2026-09-15):

- `citas.asistio is not null` —alguien cerró el intento—: **0 de 333**. La escribe
  `lib/negocio/avanzar.ts:248`.
- `estado_ghl = 'showed'` —lo dijo el CRM—: **0 de 333**.
- `estado_ghl = 'noshow'`: **15** (10 el 2026-09-15 a las 18:52). El resto: 166 `cancelled` y 152
  `confirmed`.
- `negocio.resultados`: **7 filas, 2 con `salida = 'no_show'`, la última del 2026-09-09.** Nadie
  cerró un intento desde que la pregunta de asistencia existe (la `049`, 2026-09-14).

**Y es cero en las cuatro ventanas**, así que no hay botón que lo rescate: el denominador de la
tarjeta va 2 (hoy), 6 (7 días), 103 (30 días) y 143 (completo) a las 22:03 UTC, y `con_asistencia`
es 0 en las cuatro. El 2026-09-15 era 2 · 29 · 128 · 128.

La pantalla lo dibuja como el hueco que es: «asistencia · 0 de 103 cerradas»
(`components/conversation/PanelDeConversation.jsx:614`) y el eslabón «Se presentaron» con «nadie lo
registró» (`components/conversation/PanelDeConversation.jsx:642-646`). El servidor aplica el mismo
criterio: el denominador filtra `asistio is not null` (`lib/negocio/indicadoresDeCitas.ts:373-376`) y
la tasa es `null` por debajo del piso (`lib/negocio/indicadoresDeCitas.ts:453-456`). Sin ese filtro
la tasa sería 0 % sobre 103 y diría, plausible y falsamente, que no se presenta nadie.

El control está cableado de punta a punta (`components/negocio/Avanzar.jsx:138-139`, con el rótulo
en `components/negocio/Avanzar.jsx:324`), y la excepción sigue importando: **con la salida `no_show`
`asistio` se guarda en `false` sin preguntar** (`components/negocio/Avanzar.jsx:129`). La primera fila
puede entrar con que un closer registre un plantón.

Y la vía que **no** hay que abrir sigue escrita donde alguien la abriría: `asistio` está fuera del
`do update` del barrido a propósito (`lib/negocio/citas.ts:417`). Si entrara, cada pasada horaria la
pondría en nulo y nada fallaría. [13-SETTER-Y-CLOSER.md](13-SETTER-Y-CLOSER.md) § 7 anota los otros
atajos que tientan —las etiquetas del CRM, las llamadas de tl;dv— y por qué ninguno es la respuesta.

```sql
select lower(coalesce(estado_anterior_ghl, '(nulo)')) venia_de, lower(estado_ghl) esta_en, count(*)
from negocio.citas where estado_cambiado_el is not null group by 1, 2 order by 3 desc;
-- 2026-09-15: un solo par, confirmed → noshow
-- 2026-09-28: confirmed → noshow 12 · confirmed → cancelled 2 · noshow → cancelled 1;
--             el último cambio registrado es del 2026-09-22
```

---

## 5 · Columnas que se escriben y nadie lee

- **`resultados.cita_id`: 0 de 7** (2026-09-28). La escribe `lib/negocio/avanzar.ts:193`, en la
  misma transacción que `asistio`; están en cero por el mismo motivo que el § 4 y se llenan con el
  mismo primer cierre.
- **`mensajes.estado_entrega_familia` se congela.** Sólo se refresca dentro de una hora desde el
  envío (`VENTANA_MS`, `lib/negocio/entregas.ts:55`) y a dos mensajes por ciclo (`POR_CICLO`,
  `lib/negocio/entregas.ts:52`), sobre la cola de `pendientesDeRevision`
  (`lib/negocio/entregas.ts:134`). El archivo no cambió desde el 2026-08-25. A las 22:04 UTC del
  2026-09-28: **479 mensajes en `en_curso` y 0 dentro de la ventana** que esa cola mira (478 y 0 el
  2026-09-15 a las 18:17). Ese 479 no es «en tránsito»: es «nunca se supo».
- **`fallo_del_canal` casi no se escribe: 475 fallidos y 3 con motivo** (435 y 3 el 2026-09-15). La
  ingesta guarda el estado y descarta el texto del canal, que es lo único que separa «se dio de baja»
  de «el número no existe». Y `failed` sigue clasificado como `sin_confirmar`
  (`lib/ghl/entrega.ts:69`), igual que `queued` (`lib/ghl/entrega.ts:68`), con 2 `queued` hoy.
  **Contra qué se compara el 475.** La foto anterior leyó el 2026-09-15 tres veces la misma consulta
  y dio 430, 432 y 435 fallidos, con mensajes del día todavía entrando; el 435 es la lectura de las
  18:17 UTC, la de la consulta de abajo. [06-INTEGRACIONES-GHL.md](06-INTEGRACIONES-GHL.md) § 10
  cuenta otra cosa —`estado_entrega = 'failed'`, no la familia `fallido`, que además suma
  `undelivered` y `opt_out` (`lib/ghl/entrega.ts:69-70`, `lib/ghl/entrega.ts:79`)—, pero a las
  23:56 UTC del 2026-09-28 las dos dan **475** y no hay un solo fallido con otro estado. El
  2026-09-15 no se separaron, así que no se sabe si ese día también coincidían.
- **`citas.inicio_anterior_el`, `estado_anterior_ghl` y `estado_cambiado_el`** no las lee ningún
  archivo de `lib/`, `app/` ni `components/`: se escriben en `lib/negocio/citas.ts:388`,
  `lib/negocio/citas.ts:408` y `lib/negocio/citas.ts:412`, y quien las lee es el § 4 de este archivo.

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
```

---

## 6 · `desde`: cerrado a medias el 2026-09-16

La foto anterior contaba que en Lead Flow, con «Completo», `desde` valía 2025-08-08 sobre una
cohorte que era casi entera de agosto y septiembre de 2026. **`bddb516` lo cerró a medias, y bien:**
`desde` sigue siendo el mínimo (`lib/negocio/indicadoresDelLead.ts:268`), pero viaja con la mediana y
con un guardián que habla cuando la fecha describe a un caso suelto (`avisoDeLaCola`,
`lib/negocio/periodo.ts:158-176`, con el umbral de 0,25 en `lib/negocio/periodo.ts:147`), y la
pantalla lo dibuja en las dos pestañas (`components/conversation/PanelDeConversation.jsx:496`,
`components/conversation/PanelDeConversation.jsx:609`). Medido el 2026-09-28 a las 22:14 UTC: la
mitad de los 570 contactos con alta entró después del 2026-08-28 y la proporción da **0,077**, así
que el aviso está encendido en «Completo», que es donde tiene que estar.

**Lo que no se cerró: la fecha se sigue dibujando sin año.** `fechaCorta` formatea con `day` y `month`
y nada más (`components/conversation/PanelDeConversation.jsx:390-395`), así que el 2025-08-08 de Lead
Flow sale «8 de agosto» al lado del «24 de agosto» de Appointment Flow, que es de 2026. El aviso sí
lleva el año (`lib/negocio/periodo.ts:172`), pero en su propia frase; la fecha que el lector ve
primero sigue siendo la que no lo tiene. Cuesta una línea.

```sql
select min(alta_en_el_crm)::date desde_completo, count(*) cohorte,
       count(*) filter (where alta_en_el_crm >= '2026-08-01') desde_agosto,
       count(*) filter (where alta_en_el_crm <  '2026-08-01') cola
from negocio.contactos where alta_en_el_crm is not null;
-- 2026-09-16 13:49 UTC: 2025-08-08 · 560 · 531 (94,8 %) · 29
-- 2026-09-28 22:11 UTC: 2025-08-08 · 570 · 540 (94,7 %) · 30
```

---

## 7 · El descarte no tiene fecha

**Sigue igual, y ninguna migración posterior al corte lo tocó** (de la `050` a la `062` son anuncios,
un índice de contactos por alta, dos columnas que se borraron, el puntaje y los Analizadores, y
ninguna nombra `etiquetas`: `grep -li etiquetas`, 2026-09-28). La partición entre «citas de
contactos descartados» y el resto se lee de las etiquetas **actuales** del contacto, y
`negocio.contactos` no guarda cuándo se aplicó cada etiqueta. El archivo de la `047` guarda la zona,
no las etiquetas.

Consecuencia: una etiqueta puesta mañana reclasifica retroactivamente citas de la semana pasada, y
**dos lecturas de la misma ventana en días distintos pueden dar tasas distintas sin que haya entrado
una cita**. Lo que se publica es «cómo se clasifican HOY las citas de la ventana elegida», no «cómo
estaban clasificadas entonces». Y crece solo: la tabla de citas va del 2026-08-12 al 2026-10-01 (333
citas, 2026-09-28), así que «completo» ya son 47 días de pasado que una etiqueta de esta mañana
puede reescribir; el 2026-09-15 eran 34.

---

## 8 · Lo que cambia solo, para que no se lea como una falla

- **El sentimiento se sostiene una semana más de lo previsto, y en un botón ya no está.** En la
  ventana de 30 días hay 23 juzgadas (2026-09-28 22:04 UTC): las 20 de la foto anterior más 3 del
  2026-09-21. El 2026-10-01 sale la siembra del 2026-09-01 (10) y quedan 13; hacia el 2026-10-08,
  cuando salgan las tres del 2026-09-08, quedan 8 y la cifra se vuelve `null`
  (`lib/auditor/sentimiento.ts:127`). La foto anterior decía el 2026-10-06. El piso se aplica sobre
  las juzgadas con valor del vocabulario (`lib/auditor/sentimiento.ts:120`), y de las 23 ninguna
  trae el sentimiento nulo (22:31 UTC), así que la cuenta vale. **Con 7 días son 0 juzgadas**: la
  última es del 2026-09-21 a las 21:12 UTC, y la cifra ya no está en ese botón.
- **El aviso de citas congeladas.** La congelada más nueva sigue siendo del 2026-09-10: a 30 días
  quedan 14 a las 22:03 UTC y 13 a las 22:31 (77 el 2026-09-15) y el aviso sigue encendido hasta
  el 2026-10-10; **a 7 días son 0 y el aviso se apagó** (eran 3); en «completo» son 101 y no se
  apaga nunca.
- **La pestaña Auditoría está vacía para 10 de las 11 empresas activas** (11 de 12 el 2026-09-15).
  Por el motivo que devolvería `resolverAccesoAlAuditor` (`lib/credenciales/resolver.ts:449-479`):
  **6 sin fila de credenciales** —que se reporta como falta de llave
  (`lib/credenciales/resolver.ts:459`)—, **4 con llave y sin `crm_agente_usuario_id`**
  (`lib/credenciales/resolver.ts:467`), 0 apagadas y **una sola que audita**.

```sql
select analizado_el::date dia, count(*) from negocio.analisis_del_agente
where agente = 'chat_post_agenda' and auditable and disparo <> 'mejora' group by 1 order by 1;
-- 2026-09-28: 09-01 → 10 · 09-06 → 1 · 09-07 → 1 · 09-08 → 3 · 09-10 → 2 · 09-11 → 1
--             09-12 → 2 · 09-21 → 3

select count(*) activas,
       count(*) filter (where cr.org_id is null) sin_fila,
       count(*) filter (where cr.auditor_activo = false) apagado,
       count(*) filter (where cr.ia_clave_cifrada is not null
                          and coalesce(trim(cr.crm_agente_usuario_id), '') = '') sin_id_del_agente
from identidad.organizaciones o
left join identidad.organizaciones_credenciales cr on cr.org_id = o.id
where o.activa;
-- 2026-09-15: 12 · 8 · 0 · 3      2026-09-28: 11 · 6 · 0 · 4
```

---

## 9 · Executive: la última maqueta publica en nombre de seis pantallas que ya miden

**Cerrado el 2026-10-01** (nueva estructura, E7): la maqueta se retiró entera —cifras, panel, chat y cajones— y la pantalla `executive` pasó a ser el Inicio, que no dibuja ninguna cifra (`docs/OTROS/nueva-estructura/04-EL-INICIO.md`); conserva la bandera porque sigue sin ruta. Lo que sigue es la deuda como estaba el 2026-09-28. Executive es la única sección que conserva `sinOperacionesTodavia`
(`lib/autorizacion/secciones.ts:212-218`), y `lib/aios/executive.js` no cambia desde `a7f8f91`
(2026-08-18). Lo que la volvió deuda no es ella sino lo de alrededor: sus cifras hablan en nombre de
departamentos que desde el 16 de septiembre publican las suyas, a un clic. El detalle pieza por pieza
está en [11-EXECUTIVE.md](11-EXECUTIVE.md) § 3; lo verificado acá contra la base, a las 22:13 UTC:

- **7 días: 312 contactos, $8.525 de inversión y 11 ventas** (`lib/aios/executive.js:17@c4cf2a8`). La base
  dice **3 contactos, ningún gasto medido y 0 ventas registradas en toda su historia** (hay una
  marcada en el CRM que no entró: § 12). Del 2026-09-22 al 09-28 hay 553 filas de anuncio (79 × 7),
  ninguna con gasto no nulo ni con impresiones: es «sin entrega», no $0.
- **Sales con punto verde y «11 ventas · cierre 31 %»** (`lib/aios/executive.js:194-197@c4cf2a8`): con cero
  ventas, la tasa de cierre no tiene numerador.
- **Acquisition con «312 contactos · +9 %»** y una caída de ICP en una campaña
  (`lib/aios/executive.js:178-181@c4cf2a8`); **Conversion con «26 % de visita a cita» y un formulario que
  falla en Safari** (`lib/aios/executive.js:186-189@c4cf2a8`), dos cifras que Conversion declara no medibles.
- **El panel encadena Creative → Conversion → Sales** en un tema causal inventado
  (`lib/aios/executive-panel.js:12-13@c4cf2a8`), y el chat contesta «Vas 11 de 30» con Conversion y
  Sales como fuentes (`lib/aios/executive-chat.js:35-36@c4cf2a8`).

La ve sólo quien tenga `tablero.ver` (`lib/autorizacion/secciones.ts:215`), y eso acota a quién le
miente, no si le miente. Lo que haría falta para bajar la bandera está en
[11-EXECUTIVE.md](11-EXECUTIVE.md) § 5.

---

## 10 · Leads Portal: el humo, tres preguntas, y lo que LP-6 dejó sin dueño

- **La prueba de humo con sesión iniciada no tiene registro.** Es el paso 4 de la verificación del
  plan (`docs/leads-portal/13-EL-CONTRASTE.md:240-241`), la hace el usuario, y ni el repositorio ni
  la historia de git dicen que se haya hecho ([10-LEADS-PORTAL.md](10-LEADS-PORTAL.md) § 2). El
  cotejo para ese día es `scripts/medir-leads-portal.sql` contra lo que muestre la pantalla.
- **Tres preguntas abiertas, del lado del usuario.** `LP05-P02`: si `medium`, `campaignId` y el
  objetivo del anuncio entran a la lista blanca de la ficha
  (`docs/leads-portal/05-LA-FICHA-DEL-LEAD.md:400-403`). `LP08-P01`: si el pie del cajón de Executive
  sigue llevando a Leads Portal, cuando promete una cifra inventada y el destino muestra otra
  (`docs/leads-portal/08-LO-QUE-ENTREGA-Y-RECIBE.md:350`); ésta, **cerrada el 2026-10-01** (nueva estructura, E7): el cajón se borró con la maqueta del Executive. `LP04-P01`: si la rejilla se ordena por
  alta o por puntaje; con 8 altas desde el 2026-09-14 (medido 22:11 UTC), el orden por alta muestra
  primero a gente de hace semanas (`docs/leads-portal/04-LA-REJILLA-Y-LOS-FILTROS.md:289-294`).
- **`#recoModal` quedó en el marcado sin quién lo abra.** Vive en `components/Overlays.jsx:101@c4cf2a8`; el
  último que lo abría era el Plan de acción de Leads Portal, que salió en LP-6
  (`lib/aios/period-controls.js:40-45@c4cf2a8`), y la compuerta de paridad no tiene paso que lo abra
  (`scripts/paridad.mjs:127@c4cf2a8`). Un modal que nadie abre es código muerto que se lee como vivo. **Cerrado el 2026-10-01** (nueva estructura, E7): `Overlays.jsx` se fue con la maqueta del Executive.
- **`datepicker.js` no quedó «sin quién lo abra»: quedó sin quién lo escuche, y dos documentos lo
  dicen al revés.** `scripts/paridad.mjs:159-162@c4cf2a8` y el punto 8 de `LP08-12`
  (`docs/leads-portal/08-LO-QUE-ENTREGA-Y-RECIBE.md:259-261`) afirman que la píldora de Executive
  está `hidden`. Lo está al cargar (`components/views/ExecutiveView.jsx:62@c4cf2a8`), pero el modo Funnel la
  muestra (`lib/aios/executive.js:161-162@c4cf2a8`) y un clic abre el calendario
  (`lib/aios/datepicker.js:123-131@c4cf2a8`). Lo que no hay es quien registre su función: `_cbs` nace vacío
  (`lib/aios/datepicker.js:133@c4cf2a8`) y nadie le agrega nada, así que «Aplicar» cambia el rótulo y las
  cifras siguen siendo las del botón anterior. La deuda existe; su descripción está mal. **Cerrado el 2026-10-01** (E7): el calendario y la píldora se fueron con la maqueta.
- **El comentario del armazón sigue con los que abrían los overlays antes de LP-6.** Dice que
  `#drawer` y `#recoModal` los abren `leads-portal.js`, `executive-panel.js` y `period-controls.js`
  (`lib/aios/shell.js:156-158@c4cf2a8`): el primero se borró y el tercero ya no abre nada. Hoy sólo
  `lib/aios/executive-panel.js:81@c4cf2a8` y `lib/aios/executive-panel.js:102@c4cf2a8` abren `#drawer`. **Cerrado el 2026-10-01** (E7): el bloque se fue con los overlays.

Los huecos de la pantalla y los documentos de `docs/leads-portal/` que quedaron atrás están en los
§ 13 y § 16.

---

## 11 · Analizadores: construidos, y una isla

Lo detalla [14-ANALIZADORES.md](14-ANALIZADORES.md) § 7, con cifras medidas hoy entre las 18:03 y
las 18:23 UTC que acá no se re-midieron. Lo verificado acá contra el código:

- **El sello se escribe y no lo lee nadie.** El comentario dice que el motivo «tiene que poder
  leerse desde la pantalla de monitoreo» (`lib/negocio/barrido.ts:540-550`), y en `lib/`, `app/` y
  `components/` `ultimo_motivo` sólo aparece en `lib/negocio/barrido.ts` y en `lib/datos/esquema.ts`;
  fuera de ahí lo lee `scripts/medir-analizadores.sql:88`. Una llave de tl;dv revocada sólo se ve
  con SQL.
- **La caché se paga y no se lee.** El sistema va con `cache_control`
  (`lib/analizadores/nucleo/anthropic.ts:215`); según 14, 0 tokens leídos de caché en 7 de 7
  análisis propios.
- **Gasto que no queda escrito.** `terminarConFallo` no guarda tokens
  (`lib/analizadores/datos.ts:336-344`) y la clasificación descartaba el uso del modelo. **Cerrado en AG2
  de los agentes (2026-10-04)**: cada llamada de los Analizadores, la clasificación incluida, deja su fila
  en `negocio.uso_de_ia` (`lib/analizadores/pipeline.ts`, `anotarLaLlamada`).
- **El contador de reintentos sólo sube** (`lib/analizadores/datos.ts:878-886`), y **el reintento
  exige la llave de tl;dv aunque no la use** (`lib/negocio/barrido.ts:493-501`): una transcripción
  pegada a mano que falle en una empresa con sólo llave de IA no se reintenta nunca sola.
- **`scripts/medir-analizadores.sql` no mide el reintento**: el sello que lee es sólo el de
  `analizadores` (`scripts/medir-analizadores.sql:87-89`) y `reintentos_automaticos` no aparece.
- **El mismo umbral escrito dos veces:** `MINUTOS_PARA_DARLA_POR_COLGADA = 15` en
  `lib/analizadores/datos.ts:58` y en `components/analizadores/PanelDeAnalizadores.jsx:60`, sin
  prueba que ate los dos.
- **Nada fuera de la pestaña lee estos datos**: ni Sales, ni la ficha, ni Closer; `negocio.llamadas`
  sigue en cero filas (medido el 2026-09-28 a las 22:32 UTC). El error de una llamada fallida
  guarda datos del cliente: § 15.

---

## 12 · Datos del negocio que cambian la lectura de todo

- **La pauta no gasta desde el 2026-09-14.** El último día con `gasto > 0` en
  `negocio.metricas_de_anuncio` es el 2026-09-13 (3.318 filas, medido 22:11 UTC), y desde el
  2026-09-14 entraron **8 contactos**; a 7 días, 3. Toda cifra de Acquisition, Creative y Leads
  Portal con ventana posterior al 13 habla de un negocio sin pauta, y a mediados de octubre la
  ventana por omisión de 30 días va a quedar debajo del piso de 10
  ([10-LEADS-PORTAL.md](10-LEADS-PORTAL.md)).
- **Desde la pantalla no se distingue «Meta desconectado» de «no se invirtió».** El colector
  pregunta el vínculo cada día justamente para eso (`lib/negocio/recolectarAnuncios.ts:622-627`, el
  campo en `lib/negocio/recolectarAnuncios.ts:149`), pero `motivoDeLoIncompleto`
  (`lib/negocio/barrido.ts:749`) no lo lee y ninguna pantalla lo muestra. Si el vínculo se cayera, el
  sello diría `corrio` sin motivo.
- **Sólo se piden las campañas que ya aparecen en nuestra atribución**
  (`lib/negocio/recolectarAnuncios.ts:261-320`): hoy son 13 `campaignId` numéricos distintos en el
  primer toque (22:32 UTC); las 61 de la cuenta son las del comentario, contadas el 2026-09-16. Una
  campaña nueva cuyos leads no traigan el toque sería invisible, y eso no se puede ver desde la base.
- **Hay una venta en el CRM que Sales no ve.** La etiqueta `venta_ganada` está en **1 contacto** y
  `negocio.resultados` no tiene ninguna fila con `salida = 'venta'` (22:11 UTC); Sales cuenta por la
  segunda (`lib/negocio/ventasDelContacto.ts:27`). Sumar las dos fuentes mezclaría lo que dijo el CRM
  con lo que registró una persona ([13-SETTER-Y-CLOSER.md](13-SETTER-Y-CLOSER.md) § 7).

```sql
select (select max(fecha) from negocio.metricas_de_anuncio where gasto > 0) ultimo_dia_con_gasto,
       (select count(*) from negocio.contactos where alta_en_el_crm >= '2026-09-14') desde_el_14,
       (select count(*) from negocio.contactos where 'venta_ganada' = any (etiquetas)) etiqueta,
       (select count(*) from negocio.resultados where salida = 'venta') resultados_venta;
-- 2026-09-28 22:11 UTC: 2026-09-13 · 8 · 1 · 0
```

---

## 13 · Pantallas que dicen algo falso de sí mismas

Es la clase de deuda más cara de esta lista, porque el que la lee es el usuario y no un programador.

- **Conversion dice que Clarity está conectado.** El texto que se dibuja afirma que «Clarity
  aparece en la pantalla como fuente conectada» (`lib/negocio/embudoDelFormulario.ts:141-142`), y los
  chips se borraron el mismo 2026-09-20 (`components/views/ConversionView.jsx:21-25`).
- **«Sin rastro: 26 contactos, todos anteriores a septiembre»** (`lib/negocio/recorrido.ts:90-93`, y
  lo mismo en `lib/negocio/recorrido.ts:28-29` y `docs/conversion/01-LOS-DOS-RECORRIDOS.md:205-211`).
  Medido 22:11 UTC: 27 con `atribucion_ultima = '{}'`: 24 sin alta, 2 con alta de antes de
  septiembre y **uno con alta en septiembre**; como la cohorte exige alta, en «Completo» la fila
  muestra 3 y no 26.
- **El botón «Hoy» promete «las últimas 24 horas, no el día del calendario»**
  (`lib/negocio/periodo.ts:84`), y ese título se dibuja en Conversion
  (`components/conversion/PanelDeConversion.jsx:113`) —Acquisition dejó de dibujarlo en AQ-4, el
  2026-09-30—, cuyas cohortes se anclan al día de
  calendario (`lib/negocio/recorrido.ts:197-199`; el propio `lib/negocio/costoDelAnuncio.ts:61-63`
  lo admite). Y `lib/negocio/periodo.ts:76-77` sigue diciendo
  que todas las ventanas del sistema son móviles. Leads Portal sí es móvil
  (`lib/negocio/leadsDelPortal.ts:300`): sus «30 días» no son la misma cohorte en los bordes.
- **El monitor de atribución cuenta una clave que nadie trae.** Las cinco UTM incluyen `utmCampaign`
  (`lib/negocio/calidadDeLaAtribucion.ts:89`, usadas en `lib/negocio/calidadDeLaAtribucion.ts:101-114`),
  que está en **0 de 594** contactos; GoHighLevel manda `campaign` (272 en el primer toque, 22:11 UTC)
  y la atribución ya lo usa (`lib/negocio/atribucionDelLead.ts:97`). Como el `?&` de las cinco no se
  cumple nunca, todo contacto con alguna UTM cuenta como incompleto; según
  [01-ACQUISITION.md](01-ACQUISITION.md), el aviso del monitor manda a arreglar enlaces que sí llevan
  la campaña (el texto del aviso no se re-leyó acá). Desde AQ-4 (2026-09-30) el monitor está dormido:
  no se dibuja ni se calcula (`docs/OTROS/futuro/monitor-de-atribucion.md`).
- **«Entregó N días» cuenta días sin impresiones.** `diasConEntrega` es `gasto is not null`
  (`lib/negocio/costoDelAnuncio.ts:288`), y hay **38 filas con gasto 0 y sin impresiones** (22:11
  UTC); la nota se dibujaba en la tabla por anuncio de Acquisition, que salió con AQ-4. Creative lo
  corrigió de su lado (`lib/negocio/rendimientoDelCreativo.ts:216-229`) y
  `pruebas/base/99-costo-del-anuncio.test.ts:207-220` no cubre el caso.
- **«Landing con VSL» es circular y no se marca.** La marca exige el 90 %
  (`components/conversion/PanelDeConversion.jsx:337`, `lib/negocio/recorridoDelLead.ts:263-265`) y la
  fila da 86 % a 30 días según [03-CONVERSION.md](03-CONVERSION.md) (no re-medido); su rótulo
  (`lib/negocio/recorrido.ts:69-72`) describe el recorrido de agosto.
- **La cobertura de Conversion dice «de 570» sobre una base de 594** sin declarar los 24 sin alta
  (§ 2.1), que Leads Portal sí declara.
- **Leads Portal manda los huecos de Sales siempre** (`app/api/leads-portal/route.ts:79`), con el
  texto fijo «No hay ninguna venta registrada» (`lib/negocio/huecosDeSales.ts:52`), sin mirar si hay
  ventas. El día de la primera venta, la tarjeta la va a contar y el hueco la va a negar.
- **La tarjeta «Todos» de Leads Portal dibuja «0 vendidos»**
  (`components/leads-portal/PanelDeLeadsPortal.jsx:305-306`), el único cero de la pantalla sobre la
  venta, al lado de un «—» con motivo, cuando el encabezado del mismo archivo promete «un guion donde
  no hay de qué hablar, nunca un cero» (`components/leads-portal/PanelDeLeadsPortal.jsx:21`).
- **Executive entero** (§ 9), y su píldora «Personalizado», que aplica un rango que no cambia nada
  (§ 10). **Cerrado el 2026-10-01** (nueva estructura, E7): los dos se fueron con la maqueta.

---

## 14 · Comentarios que dicen lo contrario del código

Un comentario falso es un defecto de primera clase: quien lo lee para decidir, decide sobre otro
sistema. Todos verificados el 2026-09-28 leyendo las dos puntas.

- `lib/negocio/barrido.ts:239-241` cuenta **52 llamadas por día** «por cuatro días»; se releen dos
  (`DIAS_QUE_SE_RELEEN`, `lib/negocio/recolectarAnuncios.ts:59`), o sea 39, y
  [06-INTEGRACIONES-GHL.md](06-INTEGRACIONES-GHL.md) midió 40.
- `db/migraciones/053_el_desglose_que_ya_llegaba.sql:34-35` pone la tarea `anuncios` en «el cron de
  las 17:06 UTC»; es `17 6 * * *`, las 06:17 (`lib/negocio/barrido.ts:220`).
- `lib/negocio/sincronizar.ts:23-28` dice que `ultimo_entrante_el` y los suyos «quedan nulos» y que
  `score` «nada lo calcula»; `lib/negocio/sincronizar.ts:319-320` pone `score` y `responsable_id` entre
  lo que no se pisa. Lo contradicen `lib/negocio/sincronizar.ts:421` y `lib/negocio/sincronizar.ts:481`,
  que escriben `score`, y la `054`, que borró `responsable_id`.
- `lib/ghl/contrato.ts:325` dice que la carpeta del formulario de Meta tiene 9 campos y
  `lib/ghl/contrato.ts:341` que las siete etiquetas cortas son de esa carpeta; 06 midió hoy 7 campos y
  dos de las etiquetas en otra carpeta (no re-medido).
- `lib/ghl/cliente.ts:1` dice «Solo lectura de contactos»; el archivo pone y quita etiquetas
  (`lib/ghl/cliente.ts:590`, `lib/ghl/cliente.ts:636`).
- **Cerrado el 2026-09-30 (AQ-1 de Acquisition).** La copia huérfana del bloque de
  `lib/negocio/recolectarAnuncios.ts:550-564` se borró: en su lugar quedó el escritor de campañas.
- `comoDia` (`lib/negocio/costoDelAnuncio.ts:409-412`) usa `toISOString()` sobre un `date`, que es
  exactamente lo que `lib/negocio/recolectarAnuncios.ts:329-333` documenta como defecto al este de
  UTC. En producción (UTC) no se nota; leído, no ejecutado.
- `lib/negocio/costoDelAnuncio.ts:492` numera «2 ·» el tercer aviso (el de
  `lib/negocio/costoDelAnuncio.ts:468` ya es el 2), y `lib/negocio/costoDelAnuncio.ts:18` dice que el
  `adId` llega «si y sólo si» el lead entró por Facebook o Instagram; 01 midió hoy 4 de 217 que no
  (no re-medido).
- `lib/negocio/recorrido.ts:193-195` justifica la ventana anclada porque Conversion cruza con el
  gasto y las piezas; la ruta sólo llama a `recorridoDelLead` y a `embudoDelFormulario`
  (`app/api/conversion/route.ts:58-61`).
- `lib/negocio/tramosDelIcp.ts:20` («47 de los 471») no dice la fecha en esa línea. (El «79 anuncios y
  12 con gasto» del panel anterior de Acquisition salió con él en AQ-4.)
- `lib/negocio/leadsDelPortal.ts:272-275`: sin argumento mide 14 días (`DIAS_DE_LA_TASA`), que no es
  ninguna de las cuatro ventanas. La ruta siempre le pasa el período; es un riesgo latente.
- Los números de la maqueta de Conversion no coinciden entre sí: 530 literales en
  `components/views/ConversionView.jsx:2` y `components/conversion/PanelDeConversion.jsx:11`, 538 en
  `lib/negocio/vistaDeConversion.ts:8` y `docs/conversion/09-LO-QUE-NO-ES-UN-REQUISITO.md:36`; y 648
  líneas en `components/conversion/PanelDeConversion.jsx:8` y `lib/negocio/vistaDeConversion.ts:6`,
  cuando `git show 0add4cc^:lib/aios/conversion.js` tiene 655.
- `lib/aios/shell.js:156-158@c4cf2a8` y `scripts/paridad.mjs:159-162@c4cf2a8`: § 10.

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
  [13-SETTER-Y-CLOSER.md](13-SETTER-Y-CLOSER.md) § 3.6 señala), `components/views/SalesView.jsx:19-20`.
  También en una migración
  (`db/migraciones/034_varios_closers.sql:38`) y en una prueba
  (`pruebas/codigo/91-closer-y-setter.test.ts:432`, `pruebas/codigo/91-closer-y-setter.test.ts:440`):
  10 archivos con alguno de los dos apellidos (`grep -rl` sobre las siete carpetas de fuente,
  2026-09-28).
- **El nombre de pila de una persona del equipo está en 43 archivos** (`grep -rl` sobre `lib/`,
  `app/`, `components/`, `pruebas/`, `scripts/`, `docs/` y `db/`, 2026-09-28): casi todos comentarios
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
  cliente, y la lista lo dibuja (`components/analizadores/PanelDeAnalizadores.jsx:392`). Toda medición
  SQL que lea `error` lee datos personales. **Cerrado para las fallas nuevas en AG2 de los agentes
  (2026-10-04)**: el error dice sólo «El modelo no devolvió JSON parseable.»
  (`lib/analizadores/nucleo/engine.ts:71`); las FAILED ya guardadas conservan el suyo hasta que se
  reintenten.
- **Agregado el 2026-10-04, al planificar los agentes** (`docs/OTROS/agentes/05-PERMISOS-Y-PRIVACIDAD.md`,
  `AG-86`): **no hay un acuerdo de tratamiento de datos con los clientes** sobre mandar datos de sus leads
  a un proveedor de IA. Ya viajan hoy la conversación del lead (el auditor) y la transcripción de la
  llamada (los Analizadores); el plan de los agentes suma el Brief del closer, el único agente que manda
  los datos de una persona. Lo ve el equipo. El error de 200 caracteres de arriba se cierra en la etapa
  AG2 de ese plan.

---

## 16 · Documentos que se contradicen o quedaron viejos

**De producción y de la especificación.**

- `docs/OTROS/produccion/DESPLIEGUE.md:675-687` dice que «las otras siete pantallas del prototipo
  siguen igual» y lista como datos inventados `AcquisitionView.jsx`, `SalesView.jsx`,
  `lib/aios/leads-portal.js` y `creative.js`, `conversion.js`, `conversation.js` y `acquisition*.js`.
  Las dos vistas miden desde el 16 y el 21 de septiembre, y de `lib/aios/` sólo quedan `datepicker`,
  `executive*`, `index`, `leads-group`, `period-controls` y `shell`. Lo que sigue siendo maqueta es
  Executive y el cajón `leads-group.js`. `components/Overlays.jsx`, que la tabla acusa de un nombre
  en la ficha lateral, ya no tiene ficha ni nombre: leído el 2026-09-28, es marcado vacío que llenan
  otros módulos, y su último commit es del 2026-08-26.
- El bloque «Lo que queda pendiente» del mismo archivo (`docs/OTROS/produccion/DESPLIEGUE.md:441`)
  tiene tres puntos que el código desmiente (leído el 2026-09-28):
  - Que faltan «las pantallas de administración» y que el alta se hace por guion
    (`docs/OTROS/produccion/DESPLIEGUE.md:448-449`). Ajustes existe desde `9fa82c9` y sus pestañas
    de usuarios y de empresas desde `b24d697`, los dos del 2026-08-24, y dan de alta por la API
    (`components/ajustes/Usuarios.jsx:348-349`, `components/ajustes/Empresas.jsx:145-146`).
  - Que «el auditor de IA no existe» y que `negocio.hallazgos` no tiene lector ni escritor
    (`docs/OTROS/produccion/DESPLIEGUE.md:473-476`). Tiene dos escritores
    (`lib/auditor/escritura.ts:295`, `lib/auditor/buscarMejora.ts:261`), lectores en `lib/auditor/`
    (por ejemplo `lib/auditor/pantalla.ts:219`) y **24 filas**, detectadas entre el 2026-09-01 y el
    2026-09-21 (2026-09-28 23:56 UTC). Las dos consecuencias que el párrafo deduce sobre la cola
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
  [17-LA-PLATAFORMA.md](17-LA-PLATAFORMA.md) § 5.3 y § 8. El guion de los cinco usuarios de
  `closer_usuarios` no se verificó.
- `docs/OTROS/especificacion/TRAZABILIDAD.md:25` dice «75 reglas, 26 ⛔»; las tablas del mismo
  archivo tienen **85 filas `ADR-` distintas, 31 con ⛔** (contadas el 2026-09-28).
- `docs/OTROS/especificacion/LEXICO.md:18` ubica `conOrganizacion(` en `lib/datos/capa.ts`; vive en
  `lib/datos/contexto.ts:76`.
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
  (`docs/creative/02-METRICAS.md:86`), que es la fatiga por caída de CTR
  (`docs/creative/02-METRICAS.md:306`); la de frecuencia es `C2-25`
  (`docs/creative/02-METRICAS.md:325`). `C14-P02` se cita como abierta
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
  dicen que la base guarda un solo toque. Guarda los dos: primer toque no vacío en **553**, último en
  **567**, distintos entre sí en **279** (22:11 UTC). Lo que no hay es historia ni fecha.
- **Conversion.** `docs/conversion/00-MAPA.md:212-215` dice que ningún módulo lee
  `atribucion_ultima`; la lee `lib/negocio/recorrido.ts:126` desde el 2026-09-20.
  `docs/conversion/14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md:33-36` cuenta 349 contactos en «agosto
  y antes» con los 24 sin alta adentro; sin ellos, la landing de agosto es 62 % y no 58 % (según 03,
  no re-medido).
- **Leads Portal.** El resumen de `docs/leads-portal/11-LO-QUE-PIDE-EL-DOCUMENTO.md:69-74` da «sin
  medir» a las respuestas de Meta y de la landing, que su propia tabla da medidas
  (`docs/leads-portal/11-LO-QUE-PIDE-EL-DOCUMENTO.md:51-52`); `LP12-P01` sigue «sin medir»
  (`docs/leads-portal/12-QUIEN-VE-QUE.md:341`) y 10 lo midió hoy; `LP12-01` muestra la bandera
  `sinOperacionesTodavia` como actual (`docs/leads-portal/12-QUIEN-VE-QUE.md:17-27`) y salió en LP-4;
  `LP10-13` da por pendiente el cursor de mano (`docs/leads-portal/10-LO-QUE-NO-ES-UN-REQUISITO.md:325`)
  que `app/leads-portal.css:107@c4cf2a8` ya anuló; `LP10-03` cita líneas sin archivo que eran del
  `leads-portal.js` borrado (`docs/leads-portal/10-LO-QUE-NO-ES-UN-REQUISITO.md:104-106`); y el
  punto 8 de `LP08-12`, § 10.

---

## 17 · Citas que se pudren sin que nada falle

Una línea corrida es peor que una rota, porque no falla: alguien la abre, ve otra cosa, y no sabe si
el documento miente o si buscó mal.

- **La auditoría de citas mira las que salen de esta carpeta y sólo parte de las que llegan.** La
  carpeta entró a la lista de auditadas el 2026-09-28
  (`pruebas/codigo/101-las-citas-de-los-documentos.test.ts:42`, un cambio del árbol que todavía no
  tiene commit), así que sus propias citas `archivo:línea` se comprueban. Ese mismo cambio hizo que
  el patrón admita corchetes y el espacio entre `estado` y `actual/`
  (`pruebas/codigo/101-las-citas-de-los-documentos.test.ts:63-64`), así que las que llegan desde
  `docs/sales/` y `docs/leads-portal/` también se auditan. Las demás no: `docs/conversion/` y
  `docs/acquisition/` no están en esa lista, y los comentarios del código tampoco. El caso que lo
  muestra: `docs/conversion/01-LOS-DOS-RECORRIDOS.md:56` y
  `docs/conversion/07-LO-QUE-ENTREGA-Y-RECIBE.md:104` citaban la línea 177 de este archivo por la
  cifra del trigger link, y en la versión del 2026-09-15 esa línea ya era la fila del formulario de
  la landing. El 2026-09-28 se reapuntaron a mano (en el árbol, sin commit) a las líneas 187-188 de
  este archivo, con 31 de 594 y la cifra vieja al lado. Siguen fuera de la auditoría: el día que
  alguien agregue una línea antes de esas dos, vuelven a quedar corridas sin que nada se ponga rojo.
- **56 citas `01-ACQUISITION.md:N`** en `docs/acquisition/` —20 en `01-LOS-TRES-EMBUDOS.md`, 16 en
  `03-COSTOS.md` y 20 en `05-PERIODOS-Y-COMPARACION.md` (contadas el 2026-09-28)— apuntan a líneas
  de la foto anterior de [01-ACQUISITION.md](01-ACQUISITION.md), que hoy es otro texto.
- **La regla 11 de [07-REGLAS-TRANSVERSALES.md](07-REGLAS-TRANSVERSALES.md)** se cita por línea
  desde `components/conversion/PanelDeConversion.jsx:24`, `lib/negocio/cadenaDeCierre.ts:36`,
  `docs/conversion/01-LOS-DOS-RECORRIDOS.md:101`, `docs/conversion/03-EL-RECORRIDO.md:62` y
  `docs/sales/14-LOS-CINCO-ESLABONES.md:54`. Las cinco decían 451 en `HEAD`, que dejó de ser la
  regla; el 2026-09-28 se reapuntaron (en el árbol, sin commit) a la 625, que hoy es su encabezado.
  La de `docs/sales/` ya la audita la prueba; las otras cuatro están en el mismo caso que el punto
  anterior: un párrafo nuevo en 07 antes del § 11 las corre sin aviso. Las otras citas de
  `docs/conversion/` a líneas de 07 no se revisaron acá.
- **Entre módulos:** `lib/negocio/calidadDelCreativo.ts:162`, `lib/negocio/rendimientoDelCreativo.ts:116`
  y `lib/negocio/rendimientoDelCreativo.ts:231` mandan el defecto de grano a las líneas 157-164 de
  `costoDelAnuncio.ts`, y hoy está hacia `lib/negocio/costoDelAnuncio.ts:193`;
  `lib/negocio/fatigaDelCreativo.ts:7` manda la frecuencia a las líneas 88-95, y está hacia
  `lib/negocio/costoDelAnuncio.ts:118`; `lib/negocio/rendimientoDelCreativo.ts:221` manda a la 287 lo
  que está en `lib/negocio/costoDelAnuncio.ts:288`; y `lib/negocio/recorrido.ts:189` manda a la 348 de
  `costoDelAnuncio.ts` y a la 230 de `calidadDelCreativo.ts` lo que está en
  `lib/negocio/costoDelAnuncio.ts:346` y `lib/negocio/calidadDelCreativo.ts:228`.

Lo que haría falta: que la auditoría sume `docs/conversion/`, `docs/acquisition/` y los comentarios
del código, y que las citas entre documentos de carpetas distintas vayan por sección y no por línea,
como ya hace esta carpeta hacia adentro.

---

## 18 · El grafo

Es deuda de herramienta y no de producto, pero sin ella la próxima foto ubica mal. Detalle en
[08-COMO-USAR-EL-GRAFO.md](08-COMO-USAR-EL-GRAFO.md); verificado acá:

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

- **Conversation con sesión iniciada y datos reales.** Lo que la foto anterior dejó pendiente sigue
  sin registro: lo verificado es la forma, con valores puestos a mano, en los dos temas y tres anchos
  (`00e251d` hizo lo mismo en Conversion con la base local sembrada). Nadie miró si los números que
  hoy manda la base entran.
- **Dónde quedó la línea entre aviso visible y nota escondida.** La decide un solo componente:
  `Nota` (`components/conversation/PanelDeConversation.jsx:337`) devuelve `<p className="cs-grave">`
  cuando la nota es grave (`components/conversation/PanelDeConversation.jsx:340`) y el botón con
  ícono cuando no (`components/conversation/PanelDeConversation.jsx:343`). **Ninguna prueba mira ese
  reparto.** La foto anterior decía que `cs-grave` no aparecía en `pruebas/`; hoy aparece en
  `pruebas/codigo/147-lo-que-el-panel-dibuja.test.ts:7`, pero esa prueba comprueba que cada clase
  tenga una regla de CSS y no por qué canal sale un aviso
  (`pruebas/codigo/147-lo-que-el-panel-dibuja.test.ts:25-26`). Y la gravedad sigue sin viajar con el
  aviso: la capa de datos manda `string | null` (`lib/negocio/indicadoresDeCitas.ts:72`,
  `lib/negocio/indicadoresDeCitas.ts:155`, `lib/negocio/indicadoresDeCitas.ts:172`), y «grave» en
  `lib/negocio/` sólo aparece en comentarios. Mientras sea así, mover un `grave` en una
  refactorización no rompe nada. Hoy la tarjeta de citas enciende dos avisos graves seguidos
  (`components/conversation/PanelDeConversation.jsx:676-677`); hay que mirar si se leen como dos
  cosas.
- **Leads Portal con sesión**: § 10.
- **El 500 de la autoría bajo delegación** no se reprodujo en vivo: § 20.
- **La suite no se corrió para esta foto**: comparte una sola base local y otros archivos se
  escribían en paralelo. Donde este archivo dice que una prueba cubre o no cubre algo, es leído, no
  ejecutado.

---

## 20 · La autoría bajo delegación: una decisión de producto que hoy se cobraría con un 500

Cuando un rol de plataforma trabaja sobre una empresa cliente, su sesión lleva la organización de
la empresa y el usuario de la principal, y ese par no existe en `identidad.usuarios`: la foránea
compuesta lo rechaza con `23503`, «nadie lo atrapa, y sale un 500 sin diagnóstico»
(`lib/autorizacion/sesion.ts:354-356`). `d8b542e` (2026-09-17) lo resolvió para «quién tocó esta
configuración», que bajo delegación va nulo (`lib/autorizacion/sesion.ts:384-385`), y **dejó
afuera a propósito la autoría de contenido**, donde un nulo sería una nota sin autor o una venta
que no registró nadie (`lib/autorizacion/sesion.ts:374-381`, y la sección «DÓNDE NO SE APLICÓ» del
mensaje del commit). Esas cuatro escrituras siguen fallando bajo delegación:

- `resultados.registrado_por`, `notas.autor_id` y `tareas.creada_por`, las tres de Avanzar
  (`lib/negocio/avanzar.ts:189`, `lib/negocio/avanzar.ts:277`, `lib/negocio/avanzar.ts:347`).
- `mensajes.autor_usuario_id`, al mandar un mensaje a mano
  (`app/api/contactos/[id]/mensajes/route.ts:224`). **Éste es el caro**: el envío al CRM va antes
  (`app/api/contactos/[id]/mensajes/route.ts:148`) y la escritura después, sin `catch`
  (`app/api/contactos/[id]/mensajes/route.ts:207`). Bajo delegación el mensaje le llega al contacto
  y quien lo mandó recibe un 500, que es justo lo que el comentario de la misma ruta dice que hay
  que evitar, porque «lo mandaría de nuevo» (`app/api/contactos/[id]/mensajes/route.ts:248-250`).

Las cuatro foráneas son compuestas desde la `011`
(`db/migraciones/011_negocio_closer_setter.sql:251`, `db/migraciones/011_negocio_closer_setter.sql:349`,
`db/migraciones/011_negocio_closer_setter.sql:409`, `db/migraciones/011_negocio_closer_setter.sql:451`).

**Hoy no lo paga nadie, y por eso no se ve.** De las **13 organizaciones**, la única con datos de
negocio es `aria`, la principal: fuera de ella hay 0 contactos, 0 resultados, 0 notas, 0 tareas y
0 mensajes (2026-09-29 00:03 UTC, el cierre de esta lectura), y dentro de la principal no hay
delegación. Se cobra el primer día que una empresa cliente tenga sus propios contactos y alguien de
la plataforma registre algo ahí. `components/negocio/Avanzar.jsx` no mira `mirandoOtraOrganizacion`,
así que el botón se ofrece igual y el error llega después de llenar el formulario.

Lo que falta no es código sino la decisión que el comentario deja escrita: si un rol de plataforma
puede registrar ventas dentro de un inquilino. Si no puede, el botón tiene que apagarse bajo
delegación y decir por qué; si puede, hay que decidir quién firma la fila. Lo de arriba está leído
en el código y en el commit, no reproducido: no se probó con una sesión de plataforma sobre una
empresa cliente. [16-AJUSTES-Y-PERMISOS.md](16-AJUSTES-Y-PERMISOS.md) § 5 lo nombra de pasada.

## 21 · Creative: la miniatura y el video, a medio construir y postergados

Agregado el 2026-09-30, después del corte. El 2026-09-29 se decidió traer la miniatura y el video de
cada anuncio desde Meta directo, porque GoHighLevel no los entrega
(`docs/creative/14-LO-QUE-GHL-SI-DA-Y-LO-QUE-NO.md` § 6). Se construyó la mitad que no depende de
Meta —el link manual por pieza, el cajón de la pieza y la credencial de Meta en Ajustes, con las
migraciones 063 y 064 ya en producción— y **falta la otra mitad, CR-4 a CR-9**: medir con el token,
la tabla de activos y su tarea del cron, el cliente de Meta, la miniatura, el reproductor y los huecos
dinámicos.

Falta porque **no hay token**: lo genera otra persona del equipo con la guía del § 4 de
`docs/creative/15-LA-MINIATURA-Y-EL-VIDEO.md`, y dos decisiones de diseño —si se reproduce en la app
y cada cuánto se refresca la miniatura— sólo se pueden medir con él. El usuario lo postergó el
2026-09-30 por otras prioridades. Mientras tanto la pantalla lo dice: el cajón explica que la
miniatura y el video todavía no se pueden mostrar (`components/creative/FichaDelCreativo.jsx:87-91`).
El plan, etapa por etapa, está en `docs/OTROS/futuro/miniatura-y-video-de-meta.md`.

---

Agregado el 2026-10-01, después del corte, al planificar la nueva estructura
(`docs/OTROS/nueva-estructura/07-LO-QUE-SE-ROMPE-EN-SILENCIO.md`). Tres defectos que ya existían:

- **El botón «Eliminar» de Ajustes › Usuarios no aparece para nadie**, tampoco para el
  superadministrador. La ruta de sesión manda `puedeBorrarPersonas`, pero `app/guardia.tsx` no lo copia al
  contexto, y `components/ajustes/Usuarios.jsx` lo lee de ahí. La prueba que lo vigila mira las dos
  puntas y no el paso del medio. **Cerrado el mismo 2026-10-01** en la etapa E2 de la nueva estructura:
  la guarda copia toda clave de la sesión, y la prueba `185` lo exige.
- **El panel lateral de la maqueta del Executive se ve en la primera carga** a quien arranca en otra
  pantalla (un closer, por ejemplo), hasta su primer clic: la clase que lo esconde sólo se pone al
  navegar. **Cerrado el 2026-10-01** en la etapa E7: la columna lateral se fue, y con ella la clase `.solo`.
- **El menú no se puede usar con el teclado**: sus filas son `div` sin foco. Pasan a ser botones en la
  etapa E9. **Cerrado el 2026-10-01** en la etapa E9: las filas son `<button>` y la abierta lleva `aria-current`; en
  el teléfono, el cajón cerrado sale del orden del tabulador, así que las filas no son paradas invisibles.
- **Los chips «Hereda de» de Tools llevan a Prospección** (encontrado el 2026-10-02 en la revisión de la
  etapa E10). En Tu video de ventas y en Tu página, cada chip llama a `onIr` con el `id` de la herramienta
  de ICP que produjo el dato (`components/fundaciones/PanelHerramienta.jsx:403`; las fuentes, en
  `lib/fundaciones/herencia.ts:178`). Tools no tiene esos `id`, así que el panel cae a su primera
  herramienta, Prospección en frío, y desde E10 la barra lo marca: se cierra Marketing y se abre Sales.
  Para quien apretó «Hereda de: Oferta», es un salto que nada explica. El arreglo es que un chip cuya
  herramienta vive en ICP & Oferta navegue allá, o no sea un botón, sabiendo que quien tiene Tools no
  siempre ve ICP. Abierto.
- **La prueba de los colores escritos a mano no mira el principio de una hoja** (encontrado el
  2026-10-02 al construir la cabecera de la etapa E11). `pruebas/codigo/104-temas.test.ts` salta todo
  lo que va antes de la primera vez que la hoja nombra la pseudoclase de la raíz —también dentro de un
  comentario o en un selector de más abajo—, porque supone que ahí empieza el bloque de tokens. Un color
  escrito a mano arriba de eso pasa en verde. `app/departamentos.css` la esquiva no nombrándola; el
  arreglo es que la prueba quite sólo los bloques de tokens. Abierto.

Y, aparte, lo que encontró la línea base de la suite del 2026-10-01 en `main` (`60f5d81`), que no es de
esa planificación ni lo corrige ninguna de sus etapas:

- **Las tres claves foráneas de la `067` (`incidentes_org_id_fkey`, `incidentes_usuario_id_fkey`,
  `incidentes_revisado_por_fkey`) no tenían traducción en `QUE_LO_IMPIDE`**
  (`lib/administracion/borrado.ts`): si un borrado se bloqueaba por un incidente, el rechazo decía
  «tiene historial» sin decir cuál. La prueba `pruebas/base/23-editar-y-borrar.test.ts` lo detectaba
  desde `46c5556`, el commit que trajo la `067`. **Cerrado el mismo 2026-10-01**: las tres tienen su
  frase. Desde la `070` (AG2 de los agentes, 2026-10-04) `incidentes_usuario_id_fkey` es `on delete set
  null` y ya no frena nada, así que su frase salió de la lista; las otras dos siguen.
- **El CI de `main` está en rojo desde `43ce5ac`**, y no sólo por eso. Cada corrida falló por pruebas que
  dependen de la hora a la que corren:
  - en `43ce5ac`, la del mes pasado de `pruebas/base/98-setter-inicio.test.ts`, que arma «el mes pasado»
    con el reloj de Node y falla en UTC el día 1 antes de las 05:00;
  - en `b7203b2` y `c936b24`, cuatro de la agenda y del día del closer;
  - en `46c5556` y `60f5d81`, además de la `23`, «una cita vencida sigue en la lista, marcada y ABAJO»
    (`pruebas/base/92-mi-dia.test.ts`).

  La suite local del 2026-10-01, corrida en las tres zonas sobre `60f5d81`, pasó todas esas, salvo la
  `23`. Traducir las tres claves no deja el CI en verde por sí solo: las de la hora siguen abiertas.
