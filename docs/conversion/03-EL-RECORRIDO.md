# Los cinco pasos, la banda de «lo esperado» y la caída entre pasos

> Requisitos derivados del prototipo de Conversion, de la especificación funcional, y de una
> **medición propia contra producción** hecha el 2026-09-20. Cada requisito lleva el `archivo:línea`
> del que sale. El estado de cada dato sale de `docs/estado actual/03-CONVERSION.md`, medido el
> 2026-09-15, más las mediciones nuevas de `14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md`.

---

## 1 · Los cinco pasos

### CV3-01 · La cadena que el prototipo dibuja

**Rastro** · `lib/aios/conversion.js:36-42`, con el subtítulo *«porcentajes sobre el total de visitas
· abre un paso para ver su evidencia»* (`components/views/ConversionView.jsx:90-92`).

| # | rótulo | subtítulo | fuente que el prototipo declara |
|---|---|---|---|
| 1 | `Landing` | `entran a la página` | `Clarity` |
| 2 | `VSL` | `le dan play` | `VTurb` |
| 3 | `Formulario` | `lo empiezan` | `Clarity` |
| 4 | `Agenda` | `reservan la cita` | `Calendario` |
| 5 | `Gracias` | `la completa` | `Clarity` |

**Estado, paso por paso:**

| paso | ¿tiene fuente hoy? |
|---|---|
| Landing | **parcial** — `atribucion_ultima->>'url'` dice que llegó, no que la vio. Sin sesiones no hay visitantes (`CV1-01`) |
| VSL | **no** — 79 escrituras, 79 ceros (`CV14-07`) |
| Formulario | **sí sobre el histórico**, cero desde el 2026-08-31 (`CV2-04`) |
| Agenda | **sí, y es el único completo** — `negocio.citas`, 19 columnas, fuente propia y viva |
| Gracias | **no** — sus seis cifras son literales (`conversion.js:537-542`) |

**Uno de cinco tiene fuente completa.** Y los campos `n:'01'…'05'` y `src:'Clarity'/'VTurb'/'Calendario'`
de `STEPS` **no se leen nunca**: la plantilla no los usa y el CSS esconde el nodo (`app/aios.css:926`).

### CV3-02 · La cadena sólo es un embudo si hay un solo camino

**Rastro** · Cada paso publica `pct(vals[i], vals[0])` (`conversion.js:268`) y `.jarrow` dibuja una
flecha entre cada par (`:264`).

**Estado** · Es correcto **cuando todos pasan por el mismo sitio**. Hoy el 44 % agenda directo sin
pisar la landing (`CV1-03`), así que la flecha entre `Landing` y `Agenda` afirma un paso que la
mayoría no da. Ver `CV1-04` y la regla 11 de `docs/estado actual/07-REGLAS-TRANSVERSALES.md:451`.

**Lo que sobrevive del requisito**: la idea de mostrar el recorrido como etapas con su caída. Lo que
cambia es que hay **dos recorridos** y cada uno tiene las suyas.

---

## 2 · La banda de «lo esperado»

### CV3-03 · La forma es un requisito; el umbral, no

**Rastro** · `BANDS` (`conversion.js:23-27`), 24 literales, con la metodología declarada en el
comentario de `:20-22`.
**Estado** · Ver `CV2-08`: la metodología está escrita y **no se ejecuta**. La barra visual añade
además un margen inventado de **±8 puntos** (`conversion.js:273`) y recorta la marca entre 2 % y 98 %
(`:274`).

**Lo que sobrevive**: comparar cada cifra contra una referencia en vez de dejarla suelta es una buena
decisión de producto, y `title="esperado LO–HI%"` (`:276`) la hace auditable de un vistazo. Lo que
hay que resolver es contra qué, y está en `CV2-P01`.

### CV3-04 · La clasificación en tres estados, y el cuarto que gana siempre

**Rastro** · `bandState` (`conversion.js:29-34`) devuelve `bajo` · `sobre` · `ok`, con los textos
`«bajo lo esperado · N pts»`, `«sobre lo esperado · +N pts»` y `«en rango»`. `crit` gana sobre la
banda (`:254`, `:259`), y hay un quinto estado `na` que el CSS pinta apagado
(`app/aios.css:1139`).

**Estado** · **Los cinco estados son el requisito, y `na` es el importante.** Es «no se puede decir»,
que en este departamento va a ser el estado más frecuente: cuatro de los cinco pasos no tienen fuente
completa. Es el mismo `fatigado: boolean | null` de `lib/negocio/fatigaDelCreativo.ts:85-90`, donde
`null` *«no es lo mismo que “no está fatigada”»*.

### CV3-05 · El contador de pasos fuera de rango

**Rastro** · `#cvWorst` (`conversion.js:293-296`): `«N paso(s) bajo lo esperado»` en `--warn`, o
`«todos los pasos en rango»` en `--ok`.
**Estado** · **Requisito, con una corrección**: sólo cuenta los pasos 2-5 (`STEPS.slice(1)`), lo cual
es correcto —el primero no tiene con qué compararse—, pero **no distingue «en rango» de «no se puede
decir»**. Con cuatro pasos sin fuente, diría «todos los pasos en rango» sobre una pantalla que no
midió ninguno. Es la regla del silencio al revés: afirmar salud por ausencia de datos.

---

## 3 · La caída entre pasos

### CV3-06 · El `−N` en personas es la mejor idea del prototipo

**Rastro** · `conversion.js:288`, la esquina inferior derecha de cada tarjeta.
**Estado** · Ver `CV2-13`. Un porcentaje dice **dónde** está el problema; una resta en personas dice
**cuánto cuesta**, y es lo que permite ordenar las fugas por impacto en vez de por severidad
declarada. Se conserva entero.

### CV3-07 · La sub-línea que dice cuántos son, y no sólo qué porcentaje

**Rastro** · `.j-sub` (`conversion.js:282`): `«<b>N</b> le dan play»`, más el sufijo `«N pts bajo lo
esperado»` **sólo cuando cae por debajo**.
**Estado** · **Requisito, y es la regla del silencio bien aplicada**: el sufijo aparece sólo cuando
hay algo que decir. Y publicar el conteo al lado del porcentaje es el par `{con, sobre}` que este
repositorio exige en todas partes —*«una proporción sola se lee como precisión y el par dice de
cuántos habla»* (`lib/negocio/calidadDelCreativo.ts:315-316`)—.

---

## 4 · Las dos métricas por paso

### CV3-08 · Ocho de las diez son literales que no reaccionan a nada

**Rastro** · `keyMetrics()` (`conversion.js:222-240`).

| paso | métrica 1 | métrica 2 |
|---|---|---|
| Landing | `Scroll medio` 52 % | `Rage clicks` 84 |
| VSL | `Visto promedio` 41 % | `Llegan al CTA` 31 % |
| Formulario | **`Lo completan`** — calculado | `Tiempo medio` `1:48` |
| Agenda | **`Calificadas`** — calculado | `Confirmadas` 78 % |
| Gracias | `Dan play al video` 54 % | `Video visto` 63 % |

**Estado** · Sólo `Lo completan` y `Calificadas` se recalculan; **las otras ocho no cambian al mover
el período ni el dispositivo**. Y `Tiempo medio` siempre dice `▲ mejor` sin comparar nada
(`conversion.js:236`).

**Lo que sobrevive**: la decisión de que cada paso lleve **dos** cifras de contexto además de su tasa.
Es la misma forma que Creative resolvió metiendo la interacción y el click-to-landing en la nota de
la pieza en vez de darles columna (`components/creative/PanelDeCreative.jsx:411-420`).

---

## Preguntas abiertas

### CV3-P01 · ¿El recorrido directo tiene etapas?

Si `calls.ariaia.com` no distingue «abrió el calendario» de «eligió horario» de «confirmó», entonces
el recorrido mayoritario de hoy es **un solo punto** y Conversion no puede decir dónde se pierde la
gente en él — que es literalmente la bajada de la pantalla: *«Dónde se pierde la gente entre el click
y la cita»* (`ConversionView.jsx:18-20`). Es `CV14-P02`, y sin contestarla la mitad grande del
departamento es un conteo, no un embudo.

### CV3-P02 · ¿El paso «Gracias» es de este departamento?

Sus seis cifras son literales y su sección de video es el precall, que es de Appointment Flow
(`CV1-09`). Lo único propio sería «cuántos llegaron a la página de gracias», que hoy se puede
aproximar con `precall.ariaia.com` en la URL (20 contactos, 19 de septiembre) — pero ésa también es
post-agendamiento. **Puede que este paso no exista para Conversion**, y que el recorrido sean cuatro.
