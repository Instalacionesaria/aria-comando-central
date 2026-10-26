# Leads Portal · El cuadrante del ICP: cuatro palabras del CRM en vez de un número

> Requisitos de la decisión del usuario del **2026-10-26**: el ICP de cada lead deja de ser «Puntaje | ICP», un
> número de 0 a 100, y pasa a ser una de cuatro palabras que GoHighLevel calcula y manda. Reemplaza a
> [14-EL-PUNTAJE-DEL-CRM.md](14-EL-PUNTAJE-DEL-CRM.md) en todo lo que dice de los tramos, los cortes 75 y 50 y el
> cero. Construido en local, en los commits «ICP en cuadrantes · Q1» a «Q7» (migración `105`), **sin subir**. Cada
> requisito lleva su `archivo:línea`. Cómo se sube: [CUADRANTE-DEL-ICP.md](../OTROS/produccion/CUADRANTE-DEL-ICP.md).

---

## 0 · En una línea

**El CRM clasifica a cada lead en Prioriza, Valida, Financia o Descarta; la plataforma guarda esa palabra, la
cuenta en todas las pantallas y no muestra ningún número del ICP.** El puntaje viejo queda guardado y nadie lo lee.

**Decidido por el usuario el 2026-10-26:**

| Tema | Decisión |
|---|---|
| Los valores | `Prioriza` (nivel alto), `Valida` y `Financia` (nivel medio, los dos al mismo nivel), `Descarta` (nivel bajo) |
| De dónde salen | GHL los calcula y los manda en el campo `contact.cuadrante_de_clasificacion`; todos los clientes usan las mismas cuatro palabras y el mismo campo |
| Calificados | Prioriza, Valida y Financia. Descarta no |
| Descarta | Cuenta como **descartado en toda la plataforma**, como una etiqueta de descarte más |
| «Calificado» en Acquisition y Conversion | Agendó **y** está en Prioriza, Valida o Financia; el que agendó sin clasificar no cuenta |
| Contactos viejos | GHL los clasifica a todos |
| El histórico numérico | No se usa más; `score` queda guardado en la base, pero ningún número de ICP aparece en la plataforma |
| El selector del puntaje de Ajustes › Clientes | Se quita: el campo se reconoce solo por su clave |
| Las alertas del ICP | Pasan a «% de Descarta»: 15 puntos porcentuales más que su funnel o su etapa |
| El Perfil de la ficha | No dibuja el campo numérico viejo; la clasificación va en «Calificación» |

---

## 1 · El dato

### LP15-01 · El campo se reconoce por su clave, en cada subcuenta

- `CLAVE_DEL_CUADRANTE = 'contact.cuadrante_de_clasificacion'` (`lib/ghl/contrato.ts:333`). El id del campo cambia de
  subcuenta en subcuenta y el nombre lo edita cualquiera; la clave se elige al crear el campo y no se edita.
- El catálogo guarda la clave en `campos_del_crm.clave` (la `105`), y `camposDelCuadrante` devuelve un id por subcuenta
  (`lib/negocio/camposDelCrm.ts:689`). Un catálogo leído antes de la `105` —sin ninguna clave— no se da por fresco y se
  relee en la corrida siguiente (`lib/negocio/camposDelCrm.ts:235`).
- **Medido el 2026-10-26** (`scripts/medir-cuadrante.mjs`, sólo lectura) en la subcuenta de ARIA: el campo es
  `2KWcgxbUPK2Vmtsxd8qz`, «Cuadrante de Clasificacion», `RADIO`, con las opciones exactas `Prioriza`, `Valida`,
  `Financia`, `Descarta`. Lo traían **2 de los 100 contactos más nuevos** (los dos, «Descarta»). La misma subcuenta
  tiene **otro** campo, `contact.cuadrante` («cuadrante»: Prioridad, Educar, Nutrir, Descartar), que no es éste: por
  eso la comparación es exacta.

### LP15-02 · Una sola normalización, en las dos capas

- Se guarda la **clave** —minúscula, sin espacios a los costados, sin tilde—: «Prioriza», « prioriza » y «PRIORIZA» son
  la misma. Lo que no es ninguna de las cuatro se guarda como nulo, sin romper la corrida
  (`lib/negocio/cuadrantesDelIcp.ts:112`).
- La misma regla en SQL, para recalcular desde lo guardado: `cuadranteUsable` (`lib/negocio/camposDelCrm.ts:739`). Las
  dos se comparan con los mismos bordes en la 310 y la 311.

### LP15-03 · Dónde vive, y cuándo se escribe

- `contactos.cuadrante`, la columna estándar que el modelo de datos de la Fase 0 ya había puesto (la `084`, clave
  foránea a `catalogo.cuadrantes`). La `105` no agrega otra: la sincronización empieza a escribirla.
- La sincronización la escribe con el contacto (`lib/negocio/sincronizar.ts:463`, `cuadranteDelCrm` en
  `lib/negocio/sincronizar.ts:586`). Sin los ids del campo —un catálogo sin claves— no la toca, para no borrar una
  clasificación que ya estaba.
- Después de releer el catálogo, `recalcularLosCuadrantes` reclasifica desde lo guardado, también a los congelados, sin
  llamar al CRM y escribiendo sólo las filas que cambian (`lib/negocio/camposDelCrm.ts:757`,
  `lib/negocio/sincronizar.ts:241`).

### LP15-04 · El orden, el nivel y los calificados, en un solo módulo

`lib/negocio/cuadrantesDelIcp.ts`, sin imports (lo usan el servidor y el navegador): las cuatro claves
(`lib/negocio/cuadrantesDelIcp.ts:48`), los calificados (`lib/negocio/cuadrantesDelIcp.ts:51`), y las cinco tarjetas
con su rótulo y su nivel, «Sin clasificar» primero (`lib/negocio/cuadrantesDelIcp.ts:69`). Una clave que no es de las
cuatro —el `rechazo` del catálogo, que el CRM no manda— se cuenta como «Sin clasificar»
(`lib/negocio/cuadrantesDelIcp.ts:119`).

---

## 2 · Lo que cambia en las reglas del sistema

### LP15-05 · Descarta es un descarte

`contactoDescartado` mira la etiqueta de descarte **o** el cuadrante Descarta (`lib/negocio/citasAlcanzables.ts:166`), y
`descartado` (de las citas) lo hereda. Así lo toman, sin código propio, los calificados de Acquisition y Conversion, la
cartera, la cadena de cierre y el cierre por closer de Sales, la asistencia de Conversation y la marca del Leads Portal.

### LP15-06 · Calificado es agendó con Prioriza, Valida o Financia

`esCalificado` = agendó (`tieneCitaAlcanzable`) **y** `cuadranteCalificado` **y** sin descarte
(`lib/negocio/citasAlcanzables.ts:180`, `lib/negocio/citasAlcanzables.ts:205`). El que agendó sin cuadrante ya no es
calificado. Creative cuenta como «Calificados» a los Prioriza, Valida y Financia hayan agendado o no, como hacía con el
puntaje de 75 o más.

---

## 3 · Las pantallas

| Pantalla | Antes | Ahora |
|---|---|---|
| Leads Portal | cinco tarjetas (Sin calificar, ICP alto, medio, bajo, Todos), el número en cada persona | **seis**: Sin clasificar, Prioriza, Valida, Financia, Descarta y Todos; la palabra en cada persona, sin número |
| La ficha del Leads Portal | «ICP 82 · ICP alto» | «Clasificación ICP: Prioriza»; si es Descarta, «Descarta (ICP)» entre los descartes (`lib/negocio/fichaDelLeadDelPortal.ts:260`) |
| Acquisition | la barra alto/medio/bajo y el «ICP 62 %» promedio | la barra Prioriza/Valida/Financia de los calificados y «Prioriza N %», una proporción y no un puntaje; la porción de Descarta viaja para la alerta (`lib/negocio/embudosDeAcquisition.ts:433`) |
| Creative | «Calificados» = puntaje 75 o más; ICP promedio por pieza | Calificados = Prioriza, Valida o Financia; porción de Descarta por pieza (`lib/negocio/calidadDelCreativo.ts:266`) |
| Conversation | el grupo que agendó en alto/medio/bajo | en Prioriza/Valida/Financia/Descarta; la asistencia por calidad sin Descarta (`lib/negocio/lecturaDeConversation.ts:158`) |
| Perfil de la ficha | «Calificación: 82» y el campo «Puntaje \| ICP» | «Calificación: Financia»; ni el puntaje viejo ni el campo crudo del cuadrante (`lib/negocio/ficha.ts:538`) |
| La fila del Closer y el Setter | el número en el círculo | la inicial de la palabra, con la palabra en el título |
| Ajustes › Clientes | el selector del campo del puntaje | el campo del cuadrante, si está y cuántos clasifica; sólo se eligen las carpetas (`app/api/admin/cuentas/[id]/campos/route.ts:48`) |

### LP15-07 · «Sin clasificar» se parte en dos, y el guardián mira la empresa

La tarjeta dice cuántos no traen nada en el campo y cuántos traen algo que no es ninguna de las cuatro palabras
(`lib/negocio/leadsDelPortal.ts:324`). Los segundos, contados en toda la empresa y sin la ventana, encienden el aviso
del Leads Portal (`lib/negocio/leadsDelPortal.ts:333`); sin el campo en el catálogo, el aviso dice eso
(`lib/negocio/leadsDelPortal.ts:531`).

---

## 4 · Los agentes

- **Las alertas.** `ACQ-DESCARTA-ENTRE-CAMPANAS` (`lib/agentes/detectores/acquisition.ts:73`) y `CRE-DESCARTA-POR-PIEZA`
  (`lib/agentes/detectores/creative.ts:50`) reemplazan a `ACQ-ICP-ENTRE-CAMPANAS` y `CRE-ICP-POR-PIEZA`: avisan cuando
  una campaña o una pieza tiene 15 puntos porcentuales más de Descarta que su funnel o su etapa (en su cliente), con el
  piso de diez clasificados. El umbral es provisional, como todos, hasta que el Admin lo firme. Las señales viejas
  quedan en el historial con su código y su rótulo.
- **Las frases del plan** dicen «Su porción de Descarta está N puntos por encima de…», con porcentajes, no puntajes.
- **El cerebro** lee el reparto por cuadrante, sin ningún número del ICP; el brief del closer dice «Clasificación ICP».

---

## 5 · Preguntas abiertas

- **LP15-P01 · Los contactos que el CRM todavía no clasificó.** El 2026-10-26 eran 98 de los 100 más nuevos. Hasta que
  GHL los clasifique, los calificados de Acquisition y Conversion caen y el costo por calificado sube. Se mide antes de
  subir.
- **LP15-P02 · El `rechazo` del catálogo.** `catalogo.cuadrantes` tiene una quinta clave para el normalizador de la Fase
  1 («falta un dato obligatorio»). El CRM no la manda; si un día aparece, se cuenta como «Sin clasificar» y hay que
  decidir cómo se dibuja.
- **LP15-P03 · La historia.** La `084` tiene `negocio.clasificaciones` para la historia de cada cambio de cuadrante; esta
  etapa escribe sólo el vigente. Medir velocidad o cambios de cuadrante espera a la Fase 1.
- **LP15-P04 · El umbral de las alertas.** 15 puntos porcentuales es la traducción directa de los 15 puntos del ICP; no
  está medido contra datos reales.
