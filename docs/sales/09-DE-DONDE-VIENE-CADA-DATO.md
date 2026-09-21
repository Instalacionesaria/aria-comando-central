# De dónde viene cada dato, y su cobertura medida

> Medición propia contra producción, **2026-09-20**, sobre la única organización con datos (ARIA).
> Cada fila lleva la consulta que la produjo, para que se pueda repetir.

---

## S9-01 · Las tablas que Sales puede leer

| tabla | filas | qué aporta |
|---|---|---|
| `negocio.contactos` | **590** | la cohorte, el asignatario, el alta, los campos del CRM |
| `negocio.citas` | **327** (226 alcanzables) | el eslabón del medio, el estado y la asistencia |
| `negocio.resultados` | **7** | el intento del closer, la salida, el monto |
| `negocio.closer_asignado` | 3 | el puente `usuarios.id` ↔ `crm_usuario_id` |
| `negocio.comisiones` | 3 | el porcentaje y la **única meta del sistema**, `meta_mensual` |
| `negocio.campos_del_crm` | **172** definidos, 102 con algún valor | el catálogo de campos |
| `negocio.llamadas` | **0** | nada. Ver `S1-11` |

**Lo que NO existe**, comprobado sobre las 53 migraciones: ninguna tabla `ventas`, `deals`,
`oportunidades`, `pagos` ni `cobros`; ninguna columna `moneda` —y es una decisión escrita,
`024_ingreso_por_empresa.sql:56-59`—; ningún `importe` ni `valor_contrato`.

---

## S9-02 · `negocio.resultados` — 13 columnas, y el mapeo con el § 5.4

```sql
select count(*)::int total, count(monto)::int con_monto,
       count(cita_id)::int con_cita, min(creado_el)::date, max(creado_el)::date
  from negocio.resultados;
-- 7 · 0 · 0 · 2026-08-30 · 2026-09-09
```

```sql
select salida, count(*)::int from negocio.resultados group by 1;
-- seguimiento 4 · no_show 2 · no_interesa 1
```

| columna | tipo | qué guarda | cobertura |
|---|---|---|---|
| `salida` | text | la salida del catálogo | 7 de 7 |
| `rol` | text | `closer` o `setter` | 7 de 7, todos closer |
| `monto` | numeric(12,2) | sólo en `venta` y `acuerdo_sin_pago` | **0 de 7** |
| `forma_pago` | text | subcategoría de la venta | **0 de 7** |
| `detalle` | text | subcategoría de las demás — **texto libre** | 4 de 7 |
| `cita_id` | uuid | el vínculo con la cita | **0 de 7** |
| `registrado_por` | uuid | quién lo registró — **nuestro** eje | 7 de 7, 2 personas |

---

## S9-03 · `negocio.citas` — el estado y la asistencia

```sql
select count(*)::int citas,
       count(*) filter (where ghl_calendario_id is not null)::int alcanzables,
       count(asistio)::int con_asistio
  from negocio.citas;
-- 327 · 226 · 0
```

| estado | citas | |
|---|---|---|
| `cancelled` | 163 | |
| `confirmed` | 149 | |
| `noshow` | 15 | |

Y sobre las **223** alcanzables cuyo horario ya pasó: 132 canceladas (**59,2 %**), 76 confirmadas,
15 no-show.

**`asistio` es nulo en las 327.** La columna existe desde `049_si_se_presento_a_la_cita.sql:46-47`.

Otras dos coberturas de la misma tabla: 16 citas reagendadas y 195 con `reservada_el`.

---

## S9-04 · El asignatario, que es el eje del bloque por closer

```sql
select count(crm_asignado_a)::int con_asignado,
       count(distinct crm_asignado_a)::int distintos
  from negocio.contactos;
-- 250 de 590 · 4 distintos
```

**Cobertura: 250 de 590 (42 %).** Y concentrada: 213 · 26 · 10 · 1.

Las citas por asignatario, que es lo que la tabla dibuja:

```sql
select crm_asignado_a, count(*)::int,
       count(*) filter (where estado_ghl = 'cancelled')::int
  from negocio.citas where ghl_calendario_id is not null group by 1;
-- A 123/85 · B 61/26 · (sin asignar) 33/16 · C 9/5
```

> La fila **«sin asignar» son 33 citas** y no se descarta: descartarla haría que las filas no sumen
> las citas de la ventana, y nadie lo notaría.

---

## S9-05 · El ciclo, y por qué la mediana

```sql
with p as (
  select extract(epoch from (
           (select min(ci.inicio_el) from negocio.citas ci
             where ci.contacto_id = c.id and ci.ghl_calendario_id is not null)
           - c.alta_en_el_crm)) / 86400 d
    from negocio.contactos c)
select round(avg(d)::numeric,1) media,
       round(percentile_cont(0.5) within group (order by d)::numeric,1) mediana
  from p where d is not null;
-- media 16,5 · mediana 2,9
```

| tramo | contactos |
|---|---|
| negativo | **0** |
| mismo día | 31 |
| dentro de la semana | 134 |
| dentro del mes | 18 |
| más de un mes | **14** |
| máximo | **290 días** |

**197 contactos medidos de 590.** Los 393 restantes no tienen cita y **no entran**.

---

## S9-06 · La cadena, eslabón por eslabón

```sql
select (select count(*)::int from negocio.contactos) contactos,
       (select count(distinct contacto_id)::int from negocio.citas
         where ghl_calendario_id is not null) con_cita,
       (select count(*)::int from negocio.citas
         where ghl_calendario_id is not null and inicio_el < now()
           and coalesce(estado_ghl,'') <> 'cancelled') ocurridas,
       (select count(*)::int from negocio.resultados) resultados;
-- 590 · 201 · 91 · 7
```

Y el que más importa:

```sql
select count(*) filter (where not exists (
         select 1 from negocio.resultados r
          where r.contacto_id = ci.contacto_id and r.creado_el >= ci.inicio_el))::int
  from negocio.citas ci
 where ci.ghl_calendario_id is not null and ci.inicio_el < now()
   and coalesce(ci.estado_ghl,'') <> 'cancelled';
-- 86 de 91
```

---

## S9-07 · El censo de campos del CRM

```sql
with v as (select c.nombre, (select count(*)::int from negocio.contactos ct
                              where ct.org_id = c.org_id and ct.campos_del_crm ? c.campo_id) n
             from negocio.campos_del_crm c)
select count(*)::int totales, count(*) filter (where n > 0)::int con_valor from v;
-- 172 · 102
```

**Los de dinero del TRATO: 0 contactos cada uno.** Comprobados uno por uno: «Forma de pago venta»,
«Método de pago», «forma_de_pago», «Cuota Inicial», «Cuotas», «Fecha Pago Cuota 2/3», «Estado del
Producto», «Objetivo de facturación».

> El método está validado: la misma consulta devuelve **247** para `Form Landing VSL`, que sí está
> poblado. El cero no es un error de la consulta.

---

## S9-08 · Y los que SÍ tienen dinero, que son de otro

| campo | contactos | de quién habla |
|---|---|---|
| «Disposición e inversión» | **216** | del prospecto |
| «Meta de facturación 6 meses» | **216** | del prospecto |
| «Ticket promedio mensual por cliente» | **209** | del prospecto |
| «Clientes activos» | 138 | del prospecto |
| «¿Cuál es tu objetivo de facturación?» | 129 | del prospecto |

Distribución del primero:

| valor | contactos |
|---|---|
| Podría, con algo de esfuerzo | 66 |
| Sí, con capital propio | 60 |
| No en este momento | 59 |
| Sí, con tarjeta o financiamiento | 31 |

> **Ninguno entra en una cifra de revenue.** Ver `S1-10`. Es el hueco donde el dato existe y tienta, y
> el requisito que sale de ahí es una prohibición: **ningún módulo de Sales lee `camposDelCrm`**.

---

## S9-09 · La vía de pagos

```sql
select count(*)::int orgs, count(pagos_clave_cifrada)::int con_pagos
  from identidad.organizaciones_credenciales;
-- 5 · 0
```

Nadie las consume salvo el formulario que las guarda (`app/api/admin/credenciales/route.ts:91`) y el
resolvedor (`lib/credenciales/resolver.ts:199`). La migración lo dice:
*«nada las consume»* (`024_ingreso_por_empresa.sql:8-9`).

---

## S9-10 · Y el reparto por organización

```sql
select o.nombre,
       (select count(*)::int from negocio.contactos c where c.org_id = o.id) contactos
  from identidad.organizaciones o;
-- ARIA 590 · las demás 0
```

**Una sola organización tiene datos.** Todo lo de esta carpeta describe a ARIA; el resto de los
inquilinos verían la pantalla vacía con sus avisos, que es lo correcto y hay que comprobarlo.
