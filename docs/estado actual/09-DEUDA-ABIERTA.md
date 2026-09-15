# Deuda abierta

**Fecha de corte: 2026-09-15.** Cada punto lleva la consulta que lo midió, para que dentro de un mes
se pueda volver a correr y ver si creció, se arregló solo, o dejó de importar.

Esto NO es una lista de deseos. Es lo que está roto o incompleto **hoy**, con su consecuencia
concreta. Lo que sería lindo tener vive en los informes de cada departamento.

---

## 1 · Dos agujeros de integridad del barrido

Son los dos más caros porque **no fallan**: producen cifras plausibles sobre datos viejos.

### 1.1 · Veinticinco contactos congelados que no vuelven solos

`lib/negocio/sincronizar.ts` → `congelarLosQueYaNoEstan` pone `territorio = null` cuando un contacto
pierde sus dos etiquetas de zona, y **no toca `sincronizado_el`**. Como la búsqueda del barrido es
POR ETIQUETA, `guardar()` no vuelve a correr sobre esa fila nunca más.

Tres consecuencias, las tres medidas:

- Su `sincronizado_el` **afirma una frescura que es de hace hasta veintiún días**. La columna miente.
- Nunca recibieron las cinco columnas de la migración `048`: los 25 tienen `atribucion_primera = '{}'`
  (el valor por omisión, nunca escrito), 24 de 25 tienen `campos_del_crm` vacío, y los 25 tienen
  `zona_horaria_del_lead` nula.
- **Son invisibles para todas las cohortes de Lead Flow y de atribución**, porque esas cohortes se
  arman con `alta_en_el_crm >= …` y un nulo no satisface un `>=`. Nada lo dice en pantalla.

Y crece: 5 la semana del 24-ago, 18 la del 31-ago, 2 la del 7-sep.

```sql
select count(*) total,
       count(*) filter (where territorio is null) congelados,
       count(*) filter (where alta_en_el_crm is null) sin_alta,
       count(*) filter (where territorio is not null and alta_en_el_crm is null) activos_sin_alta
from negocio.contactos;
-- 2026-09-15: 584 · 25 · 25 · 0   ← los congelados y los sin alta son EXACTAMENTE los mismos
```

**Sólo se descongelan por dos vías, y ninguna es el paso del tiempo:** que la etiqueta de zona
reaparezca en el CRM, o que alguien abra su ficha — pero un congelado no aparece en ninguna cola, así
que nadie navega hasta él.

Lo mínimo que haría falta: que `congelarLosQueYaNoEstan` escriba `sincronizado_el`, para que la fila
al menos diga cuándo dejó de mirarse. Lo correcto: pedirlos por identificador cada tanto con
`contactoPorId`, que ya existe y lo usa `refrescarUnContacto`.

### 1.2 · Las citas no tienen resta

`lib/negocio/citas.ts` no tiene equivalente de `congelarLosQueYaNoEstan`. Una cita que el CRM deja de
listar —borrada, o movida a un calendario que no listamos— **conserva su último `estado_ghl` para
siempre y sigue contando** en todas las cifras.

Medido: 13 citas dentro de la ventana de catorce días sin refrescar hace entre 3,5 y 17 días. Tres de
ellas son de contactos vivos, sincronizados hace minutos.

**Hoy 12 de las 13 quedan fuera del denominador por casualidad**: son anteriores a la migración `042`
y no tienen `ghl_calendario_id`, así que el filtro `alcanzable` las tapa. Una ya está adentro con su
estado congelado — y como toda cita nueva sí trae calendario, **ese accidente deja de protegernos**.

```sql
select count(*) filter (where sincronizado_el < now() - interval '3 days') as sin_refrescar
from negocio.citas
where inicio_el >= now() - interval '14 days' and inicio_el < now();
```

---

## 2 · Lo que está bloqueado por falta de datos

Ninguno de estos es un problema de código. Los cuatro tienen su medición, y hasta que el número
cambie no hay nada que construir.

| Qué | Por qué está bloqueado | Medición |
|---|---|---|
| `issue_source` (§11.4) — si falló el agente o el prompt | `negocio.prompts_del_agente` tiene **0 filas**, así que el auditor no recibe el prompt vigente contra el cual distinguir un fallo de ejecución de uno de diseño | `select count(*) from negocio.prompts_del_agente` → 0 |
| Medición de impacto (§14) | `negocio.versiones_del_prompt` tiene **0 filas**: no hay línea base ni «después» que comparar | `select count(*) from negocio.versiones_del_prompt` → 0 |
| El embudo del formulario de la landing (§9.7) | El dato existe en `campos_del_crm` pero está **congelado desde el 2026-08-31**: cero cobertura dentro de la ventana de catorce días donde viven todas las cifras | — |
| Trigger link: enviado y abierto (§9.5) | No tenemos señal propia. **Pero hay una pista que conviene seguir antes de construir un redirector**: `atribucion_primera->>'sessionSource'` vale literalmente `Trigger Link` en 27 de 150 citas de la ventana, o sea que GoHighLevel ya los usa y no le estamos pidiendo sus eventos | ver `06-INTEGRACIONES-GHL.md` |

---

## 3 · Columnas que se escriben y nadie lee

`resultados.cita_id` (migración `049`) **tiene 0 filas con dato**: la columna es del 2026-09-14 y los
7 resultados que existen son anteriores. No hay nada que conectar hasta que se registren intentos
nuevos, y con 7 filas totales cualquier tasa violaría el piso de 10.

```sql
select count(*) resultados, count(cita_id) con_cita,
       min(creado_el)::date desde, max(creado_el)::date hasta
from negocio.resultados;
-- 2026-09-15: 7 · 0 · 2026-08-30 · 2026-09-09
```

Otras que el auditor de columnas encontró y que **no** afectan a ninguna cifra publicada hoy, pero
que conviene conocer antes de agregar una:

- **`mensajes.estado_entrega_familia` se congela.** Sólo se refresca dentro de una ventana de una
  hora desde el envío y a dos mensajes por ciclo. Medido: **478 mensajes en `en_curso`, los 478
  fuera de esa ventana**. Ese 478 no es «en tránsito»: es «nunca se supo».
- **`fallo_del_canal` casi no se escribe.** 430 mensajes con familia `fallido` y **sólo 3 con
  motivo**: la ingesta guarda el estado y descarta el texto del canal. El auditor arma la marca
  `[NO ENTREGADO: …]` con una frase genérica en 427 de 430 casos, y el motivo es lo único que separa
  «se dio de baja» de «el número no existe».
- **`citas.inicio_anterior_el`, `estado_anterior_ghl` y `estado_cambiado_el`** no tienen lector.

---

## 4 · Una propiedad del dato que conviene decir antes de discutirla

**El descarte no tiene fecha.** La partición entre «citas de contactos descartados» y el resto se lee
de las etiquetas **actuales** del contacto, y `negocio.contactos` no guarda cuándo se aplicó cada
etiqueta.

Consecuencia: una etiqueta puesta mañana reclasifica retroactivamente citas de la semana pasada, así
que **dos lecturas de la misma ventana en días distintos pueden dar tasas distintas sin que haya
entrado una cita**. No es un error del módulo — es la forma del dato que manda GoHighLevel — pero lo
que se publica es «cómo se clasifican HOY las citas de los últimos catorce días», no «cómo estaban
clasificadas entonces».

---

## 5 · Lo que va a cambiar solo, para que no se lea como una falla

- **El sentimiento cruza el piso esta semana.** El denominador pasa de 20 a 10 cuando la siembra del
  2026-09-01 sale de la ventana, y a 9 el 2026-09-20 — donde la cifra se vuelve `null` y desaparece.
  Es el comportamiento correcto y el aviso lo explica, pero alguien lo va a ver y va a pensar que el
  auditor se rompió.
- **El aviso de citas congeladas se apaga solo** en pocos días, cuando las últimas anteriores a la
  `042` salgan de la ventana. Es el contraste útil: ese aviso depende de una consulta, así que se
  apaga; las cifras escritas a mano no se apagan nunca.
- **La pestaña Auditoría está vacía para 11 de las 12 empresas activas**, por falta de llave de IA o
  de `crm_agente_usuario_id`. No es un defecto del módulo: es configuración que nadie cargó.

---

## 6 · Verificación pendiente, y es mía

**Nunca vi estas pantallas.** Compilan, la suite pasa en las tres zonas y el servidor local no lanza
errores, pero abrirlas requiere iniciar sesión y eso no lo hago yo. Todo lo que este repositorio
afirma sobre cómo se VE Conversation está sin comprobar.
