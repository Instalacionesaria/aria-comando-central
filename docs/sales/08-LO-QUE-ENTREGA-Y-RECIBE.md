# El deslinde: Sales genera el hecho, Business lo interpreta, Closer es dueño del dinero

> Requisitos derivados de la especificación funcional y de una medición propia sobre el código del
> **2026-09-20**. Cada afirmación lleva su `archivo:línea`.

---

## S8-01 · Lo que el documento le da, y lo que le quita

El documento funcional coloca a Sales en **la última milla de la trazabilidad** y le **quita la
interpretación comercial**. Las dos cosas a la vez, y hay que leerlas juntas.

**Lo que le da** (`§ 5.2:227-236`): los dos últimos eslabones de la cadena.

```
meta_ad_id → visitor_id → session_id → lead_id → ghl_contact_id
           → appointment_id → sales_call_id → sale_report_id
                              └──────── de Sales ────────┘
```

Y el cierre del recorrido: `§ 1:37` `→ Venta`, `§ 1:38` `→ Revenue reportado`.

**Lo que le quita:** cada vez que el documento necesita un número comercial, **se lo pide a Business
Intelligence**.

| línea | qué | a quién |
|---|---|---|
| `:288` | *«Business Intelligence podrá utilizar estos datos, pero deberá indicar que se trata de ventas reportadas por el closer»* | **Business** lee lo que Sales genera |
| `:1279` § 18.6 | *«Acquisition no recalcula revenue, CAC real ni ROAS real»* | Business los calcula |
| `:1395` § 18.11 | *«El anuncio A tiene baja tasa de cierre y bajo revenue»* | dicho por **Business** |
| `:1618` § 18.18 | *«ICP, booking rate, show rate, close rate y revenue»* | evaluadas por **Business** (`:1635`) |

> **El deslinde en una frase: Sales genera el hecho comercial; Business lo interpreta. Y hoy Business
> no existe como pantalla** — no está en `lib/autorizacion/secciones.ts` ni en el menú.

### S8-P01 · ¿Business va a existir? — **abierta**

**Por qué importa:** si nunca existe, Sales hereda por omisión el revenue, el CAC, el ROAS y la tasa
de cierre — y eso hay que decidirlo explícitamente, no por vacío. Si existe, Sales tiene que dejarle
esas cuatro y limitarse a producir el hecho.

**Mientras tanto:** Sales **no publica** tasa de cierre ni ROAS. Publica la cadena y lo que el
cockpit ya calcula.

---

## S8-02 · Nadie le entrega nada, y es literal

`§ 18.16:1533` lista qué entrega Acquisition a otros departamentos. Tiene cuatro destinatarios:
Creative (`:1535`), Conversion (`:1546`), Business (`:1554`) y Executive (`:1563`).

**No hay `### A Sales Intelligence`.** Y como el documento no tiene una sección de Sales, **tampoco
hay un § que diga qué entrega Sales a otros**. Ningún § nombra a Sales como destinatario de nada.

Lo único derivable, y es indirecto:

- **Sales → Business**: `§ 5.4:288`, redactado al revés — como Business consumiendo la capa de datos.
- **Sales → Executive**: por la regla general del `§ 2.3:83`, no por una lista propia.
- **Conversation → Sales**: implícito y nunca nombrado como traspaso. `§ 10.5:726` («Closer
  asignado») y `§ 10.7:759` («Show rate por closer») son datos de closer que produce Appointment Flow.

---

## S8-03 · Y tres departamentos se declaran no responsables de evaluar closers

| línea | quién dice que NO es suyo |
|---|---|
| `:647` § 9.8 | Lead Flow: no audita llamadas de venta, no evalúa closers |
| `:785-788` § 10.8 | Appointment Flow: no audita la llamada de ventas, no evalúa closers, **no calcula revenue** |
| `:1342-1345` § 18.8 | Acquisition: no calcula revenue real, ni CAC, ni ROAS, **ni evalúa closers** |

**Tres lo rechazan y ninguno lo reclama**, salvo Sales por `§ 2.3:90`: *«Sales Intelligence puede
recomendar coaching para un closer»* — que el documento nunca desarrolla.

Es la única competencia atribuida, y es la que sostiene el bloque por closer de `04`.

---

## S8-04 · El deslinde de verdad, el que decide el código: Closer es dueño del dinero

Esto no está en el documento. Sale de medir el repositorio, y es la restricción más fuerte del plan.

**`lib/negocio/inicio.ts :: cockpitDelMes` ya publica el dinero, hoy, en una pantalla que la gente usa
todos los días.** Y `lib/negocio/comision.ts` lo usa para decidir si alguien cobra.

| pieza | quién | línea |
|---|---|---|
| **escribe** un resultado | `lib/negocio/avanzar.ts` — único escritor | `:181-193` |
| **agrega** el dinero del mes | `lib/negocio/inicio.ts` | `:167-180` |
| **agrega** para la comisión | `lib/negocio/comision.ts` | `:109-112` |
| lo **dibuja** | `components/closer/Inicio.jsx` | `:152`, `:165`, `:171` |

**Requisito: Sales no escribe una sola consulta sobre `resultados.monto`.**

El `01` del proyecto lo dice y está citado en producción: *«si dos pantallas muestran el mismo número,
comparten la función que lo calcula»* (`app/api/closer/mi-dia/route.ts:17-19`). Con dos
implementaciones, el día que una sume `acuerdo_sin_pago` al cobrado, Inicio y Sales publican dos
revenues distintos y **ninguna falla**.

### Y consumirlo tiene una consecuencia que se acepta por escrito

El cockpit trabaja sobre **mes calendario en la zona de la organización** (`inicio.ts:147`); Sales
sobre ventanas rodantes. **Las dos nunca coinciden.** Por eso el bloque del dinero lleva el mes en su
propio encabezado. Ver `06-PERIODOS-Y-PISOS.md`.

---

## S8-05 · Qué consume Sales, exactamente

| de dónde | qué | por qué no lo recalcula |
|---|---|---|
| `lib/negocio/inicio.ts` | `cobrado`, `ventas`, `acuerdos` | el dinero tiene un solo dueño |
| `lib/negocio/indicadoresDeCitas.ts:312` | la tasa de cancelación | ya existe, y trae la partición de descartados que el commit `9931f4d` pagó |
| `lib/negocio/alcanceDelCloser.ts:77` | quiénes son los closers | o las filas salen de un `group by` y el inactivo desaparece |
| `lib/negocio/salidas.ts` | el vocabulario de salidas y sus opciones | el catálogo existe una vez |
| `lib/negocio/periodo.ts` | las cuatro ventanas | isomorfo, lo comparten las cinco pantallas |

## S8-06 · Qué entrega Sales, y a quién

**Hoy, a nadie.** No hay otra pantalla que lea de Sales.

Lo que produce y otro podría consumir el día que exista:

- **la cadena de cierre** — Executive la querría para su embudo, que hoy la finge
  (`lib/aios/executive.js:27-28` declara dos pasos con `own:'Sales'`);
- **la diferencia de cancelación entre closers** — es lo que el `§ 2.3:90` llama coaching;
- **el ciclo hasta la cita** — Acquisition podría cruzarlo con la fuente del lead.

Y lo que **no** entrega, aunque suene suyo: revenue, CAC, ROAS y tasa de cierre. Son de Business.
