# De dónde viene cada dato, y su cobertura medida

> Requisitos derivados del prototipo de Conversion, de la especificación funcional, y de una
> **medición propia contra producción** hecha el 2026-09-20. Cada requisito lleva el `archivo:línea`
> del que sale. El estado de cada dato sale de `docs/estado actual/03-CONVERSION.md`, medido el
> 2026-09-15, más las mediciones nuevas de `14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md`.

---

## 1 · La tabla de origen

### CV8-01 · Lo que existe, con su cobertura

| id | dato | de dónde sale | cobertura medida |
|---|---|---|---|
| `CV8-02` | Por dónde entró el contacto | `contactos.atribucion_ultima->>'url'` | **475 de 590 (80,5 %)** |
| `CV8-03` | El primer toque | `contactos.atribucion_primera` | 590 de 590; con `url`, 329 |
| `CV8-04` | El embudo del formulario | campo `Form Landing VSL` | **247 de 590**, último el 2026-08-31 |
| `CV8-05` | Las citas | `negocio.citas` | fuente propia y viva, 19 columnas |
| `CV8-06` | El ICP del lead | campo `Puntaje | ICP` | 344 de 344 en 30 días |
| `CV8-07` | La cohorte | `contactos.alta_en_el_crm` | 590 de 590 |
| `CV8-08` | El creativo de origen | `atribucion_primera->>'utmContent'` | 93 de 104 en la landing propia |
| `CV8-09` | Las vistas de landing de Meta | `metricas_de_anuncio.acciones->>'landingPageView'` | 150 de 240 filas anuncio-día (63 %) |
| `CV8-10` | El dispositivo | `atribucion_*->>'userAgent'` | 121 de 162 citas (`03-CONVERSION.md:156`) |

### CV8-11 · Lo que existe y está en cero

| dato | campo | estado |
|---|---|---|
| Porcentaje máximo del VSL | `VSL % máximo visto` | **79 escrituras, 79 ceros** |
| Segundos vistos del VSL | `VSL segundos vistos` | **79 escrituras, 79 ceros** |
| Porcentaje de video | `Porcentaje de Video Visto` | 0 de 590 |
| Porcentaje de video | `Video Watch Percentage` | 0 de 590 |
| Etapa del contacto | `contactos.etapa` | 6 de 584 |
| Puntaje del contacto | `contactos.score` | **0 de 584** |

### CV8-12 · Lo que no existe

- **Ninguna tabla de sesiones web, de eventos de página o de reproducción de video.** El registro
  completo está en `lib/datos/esquema.ts:1246-1298`: 22 tablas de `negocio` y ninguna es de sesión.
- **`visitor_id` y `session_id`**: búsqueda literal sobre `db/migraciones`, `lib`, `app` y
  `components` — **cero coincidencias**.
- **Las tres entidades del `§ 5.1:210-212`**: `Landing Session`, `VSL Session`, `Form Submission`.
- **Clarity y VTurb**: ni integración, ni credencial, ni variable de entorno, ni tabla. Sólo cadenas
  de texto en `components/views/ConversionView.jsx:22-31` y en `conversion.js`.
- **Endpoint de formularios en GoHighLevel**: ninguna de las catorce operaciones de `lib/ghl/` toca
  `/forms`, `/surveys`, eventos de página ni trigger links.
- **Tabla de historial de toques**: `atribucion_primera` y `atribucion_ultima` son **una fila por
  contacto, sobrescribible**, y el `§ 5.3:265` pide explícitamente lo contrario.

---

## 2 · La puerta al catálogo del CRM

### CV8-13 · `campoPorNombre()` es la única vía, y devuelve `null`

**Rastro** · `lib/negocio/camposDelCrm.ts:307-320`.
**Estado** · Compara por **nombre exacto, no por `ilike`** (`:302-303`); desempata por `campo_id`
para que el denominador no cambie entre corridas (`:313-315`); y **`null` es un retorno legítimo**:
quien lo use *«tiene que poder decir "no sé" en vez de "cero"»* (`:298-300`).

Es la regla 9 del departamento (`03-CONVERSION.md:254`). Los tres campos que el código ya nombra
así:

```
lib/negocio/calidadDelCreativo.ts:61   CAMPO_DE_ICP          = 'Puntaje | ICP'
lib/negocio/consumoDelPrecall.ts:64    CAMPO_DEL_PRECALL     = 'Video Pre-Call'
lib/negocio/indicadoresDeCitas.ts:199  CAMPO_DE_CONFIRMACION = 'Confirmación Agendamiento'
```

Conversion agrega `CAMPO_DEL_FORMULARIO = 'Form Landing VSL'` con el mismo molde: si devuelve `null`,
la columna se apaga y **lo dice**, como hace `calidadDelCreativo.ts:358-363`.

### CV8-14 · Ciento cuarenta y nueve campos están fuera de pantalla, y 81 tienen datos

**Rastro** · `docs/estado actual/06-INTEGRACIONES-GHL.md:14`.
**Estado** · De los 170 campos del catálogo, 149 no se ven porque su carpeta no tiene `grupo`
—`camposQueSeMuestran()` filtra por `cp.grupo is not null` (`camposDelCrm.ts:256`)— y 81 de ésos sí
tienen valores: **4.939 valores guardados que ninguna pantalla lee**. Ahí adentro está la carpeta
entera de atribución y la de VSL.

---

## 3 · Los dos ceros, y el tercero

### CV8-15 · Un campo con un solo valor distinto no es una medición

**Rastro** · Regla 1, `03-CONVERSION.md:215`.
**Estado** · `VSL % máximo visto` es el caso de libro: **79 escrituras, 79 ceros, ninguna excepción**.
Un campo vacío se nota; un cero se publica. La distinción de los tres estados —no hay campo · el
campo dice cero · el medidor no reportó— **no se puede resolver desde la base**, y por eso el
veredicto es una alarma y no una cifra.

Hay un cuarto estado que este departamento tiene y los otros no: **la población no existe**. Con
`hoy` la cohorte son cero contactos porque no hay tráfico (`CV14-10`), lo cual no es ninguno de los
tres anteriores y se dice distinto (`CV5-05`).

---

## 4 · La etapa A: por qué NO hace falta ninguna migración

### CV8-18 · Medido el 2026-09-20, antes de escribir una línea del back

El plan dejaba abierto si el host clasificado se materializa en una columna generada o se calcula en
cada consulta. **Se calcula**, y estas son las cuatro cifras que lo deciden:

| qué se midió | resultado |
|---|---|
| Tamaño de la tabla | **590 filas, 3.784 kB** |
| Índices que ya tiene | `contactos_pkey`, `_ghl_por_org`, `_por_territorio`, `_buzon`, `_por_asignado`, **`_por_alta`** |
| Costo de la consulta de clasificación con su tasa de agenda, ventana de 30 días | **58 ms**, con `Index Scan using contactos_por_alta` sobre 335 filas |
| Columnas que harían falta | **ninguna**: `atribucion_ultima` está poblada y tipada |

La ventana de cohorte ya está indexada por `contactos_por_alta`, que es el único índice que esta
consulta necesita. Una columna generada para el host añadiría peso en cada escritura a cambio de
ahorrar milisegundos sobre 590 filas — que es exactamente el argumento que
`db/migraciones/052_el_indice_que_la_048_dejo_debiendo.sql` dejó escrito para los índices sin
consumidor.

**Se revisa si el volumen crece.** El umbral no está calibrado y se declara: con 590 filas cualquier
plan sirve, y el día que sean cien mil habrá que volver a medir.

### CV8-19 · Y el dato no tiene zona gris, que es lo que habría obligado a normalizar

La trampa que habría forzado una columna: que la clave `url` existiera con un valor vacío, y
entonces «no hay dato» y «hay una URL vacía» colapsaran. **Medido: no ocurre.**

| forma | contactos |
|---|---|
| trae la clave `url` | 475 |
| la clave está **vacía** | **0** |
| la clave es `null` de JSON | **0** |
| el valor no empieza por `http` | **0** |
| `atribucion_ultima` es `{}` entero | 26 |

La distinción «trae la clave / no la trae» es limpia, así que el módulo puede apoyarse en ella sin
normalizar nada antes. Es la regla de los dos ceros comprobada **en el origen** y no asumida.

---

## 5 · Cómo se midió cada cobertura

Todas las mediciones de esta carpeta se hicieron con:

```bash
node --env-file=.env.supabase scripts/supabase.mjs leer "SELECT …"
```

**Y sólo con eso.** `DATABASE_URL_MIGRADOR` y `DATABASE_URL_INQUILINO` devuelven **cero filas sin
error** contra producción, así que una medición hecha por esa vía diría «no hay datos» sobre una
tabla llena.

Las consultas de cada cifra están al pie de `14-LOS-TRES-INSTRUMENTOS-QUE-SE-APAGARON.md`.

---

## 6 · Lo que esta medición corrige de lo ya publicado

### CV8-16 · `03-CONVERSION.md:148-150` midió la URL sobre la columna de menos cobertura

Ese archivo mide `Last Landing URL` en 99 de 233 y `atribucion_ultima->>'url'` en 173 de 233 — o sea
que ya notó que la segunda es mejor. **Remedido el 2026-09-20 sobre toda la base**: 180 contra
**475**. La diferencia se agrandó porque el campo del CRM dejó de escribirse y la columna de
atribución no.

### CV8-17 · El censo de hosts cambió de reparto, y las dos mediciones son ciertas

Ver `CV14-13`. `03-CONVERSION.md:238` midió sobre la ventana de 14 días, que cae **entera después
del corte**; esta carpeta mide sobre toda la base. Los repartos son distintos porque las ventanas
son distintas, y eso es exactamente por qué la regla 2 existe.

---

## Preguntas abiertas

### CV8-P01 · ¿La URL se puede renderizar?

`db/migraciones/048_de_donde_vino_el_lead.sql:94-99` deja escrito que **`referrer` y `url` no se
renderizan crudos**: son direcciones completas y pueden llevar el identificador de una persona
adentro. Medido: hay URLs con `first_name` en la cadena de consulta
(`api.leadconnectorhq.com/widget/booking/…?first_name=…`).

Conversion necesita el **host** y los **UTM**, no la URL entera. El requisito es extraer las dos
cosas y **no publicar la cadena completa en ninguna parte** — ni en una tabla, ni en un `title`, ni
en un cajón.
