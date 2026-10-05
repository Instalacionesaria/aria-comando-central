# La evaluación

> Cómo se sabe que un agente hace lo que dice: una base sembrada con dos empresas sintéticas, un conjunto de
> preguntas por agente con lo que se espera de cada una, pruebas automáticas que nunca llaman al modelo de
> verdad, y una evaluación real que sólo corre con la llave de ARIA y con el OK del usuario cada vez.
> Requisitos `AG-100` a `AG-109`. **El conjunto de preguntas de `AG-102` lo aprobó el usuario el 2026-10-04.**

---

## De dónde sale

- `D-31` de `00-MAPA.md`: base sembrada, conjunto de preguntas aprobado por el usuario, evaluación real con
  la llave de ARIA pidiendo el OK cada vez, nunca la llave de un cliente.
- La forma de probar de la casa: `globalThis.fetch` falseado con la llave falsa `'sk-de-prueba'`, y todo
  pedido no esperado lanza, porque «un `fetch` real desde acá gastaría la llave de alguien»
  (`pruebas/apoyo/analizador.ts`).
- Lo medido en el Paso 0: el negocio real está detenido (sin gasto desde el 2026-09-13, cero ventas), así
  que producción no sirve para probar casi ninguna regla.

---

## AG-100 · La base sembrada

`db/sembrado/casos-de-los-agentes.ts` (AG4, hecho el 2026-10-04) corre **sólo en local** y crea dos empresas
sintéticas. Comparte su constructor con las pruebas de base: **las pruebas no dependen de que alguien haya
corrido el sembrado**, cada una se arma la suya con un prefijo propio y la quita al terminar.

**No queda instalado.** La prueba `11-sembrado` exige exactamente las cinco empresas y las tres personas del
sembrado de desarrollo, y varias pruebas vacían `negocio.contactos` entero. Así que quien siembra, quita:
`node scripts/db.mjs sembrar-agentes` para mirar las pantallas en local y `node scripts/db.mjs quitar-agentes`
antes de correr la suite; la evaluación real siembra al empezar y quita al terminar. Escribe como la
aplicación (`conIdentidad`, `conOrganizacion`) y borra como `postgres`, porque el inquilino no tiene `delete`
sobre `uso_de_ia` ni `incidentes`.

**La empresa con datos** (zona `America/Lima`, dominios `.test`, nombres inventados). `hace N` es en días
locales desde la corrida; las cifras de la columna del medio las comprueba la prueba
`pruebas/base/205-la-base-sembrada-de-los-agentes.test.ts` con las funciones de las pantallas:

| área | lo que se siembra, y lo que da la pantalla | para probar |
|---|---|---|
| Acquisition | 3 campañas (Clínicas, formulario; Webinar, agenda; Remarketing, perfil), 12 anuncios, métricas de hace 1 a hace 60, todos los días cerrados. **Sin entrega de hace 1 a hace 15.** En los 60 días, 9.800 de gasto: Webinar 6.370 (**65 %**), Clínicas 2.530, Remarketing 900. Clínicas pasa de 50 a 70 por contacto (**+40 %**) entre hace 30–43 y hace 16–29, con 14 contactos en cada ventana. **30 días cerrados**: 4.060 de inversión (Webinar 2.730, Clínicas 1.030, Remarketing 300), un 29 % menos que los 30 anteriores (5.740); 99 contactos con campaña de 119, 2.088 clics, 46 agendados. **7 días cerrados**: inversión 0, 13 contactos con campaña de 26 | «sin entrega» crítica, CPL sostenido, concentración, el piso |
| Contactos | 191 en total; **120 en los últimos 30 días (hace 0 a hace 29), 98 con campaña (82 %)**. Los de hace 44 a hace 60 están para que la historia de contactos empiece con la de gasto | la atribución, la caída de la entrada |
| Citas | **46 pasadas**, todas con calendario y en la cohorte de 30 días; **3 con resultado** (no le interesa, seguimiento, no se presentó), **0 ventas**. La cadena de cierre de 30 días: 120 → 46 con cita → 46 cerrables → 3 con intento → 0 con venta, y el aviso «43 de 46». 30 citas son de Closer Uno | «no hay dato suficiente» de cierre, el aviso de la cadena, SIN REGISTRAR |
| Llamadas de venta | 44: 38 analizadas, 3 «no es», 2 pendientes, 1 fallida. **28 con el correo de un contacto**. La objeción «precio» en **9** analizadas de los últimos 14 días y en **3** de los 14 anteriores (la ventana anterior no llega a 10) | el vínculo, «sin vínculo», una objeción que **no** puede decir «crece» |
| Conversation | 6 hallazgos abiertos: por agente del CRM (`chat_post_agenda`, `chat_pre_agenda`), **1 rojo y 2 amarillos**, con su categoría | la traducción a `issue_source` |
| Sales | 2 closers —Closer Uno vinculado a su usuario del CRM, Closer Dos sin vincular—, 1 setter, la comisión de Closer Uno (10 %, meta 5.000) y la del setter, y un admin | «mío», colas, comisión propia |
| Espía | 2 análisis guardados | la herramienta `espia` |

**La empresa vacía**: sin datos, sin personas y sin llave.

Lo que **no** siembra: la llave de IA. La evaluación usa la de la organización principal (`AG-104`), y la
copia a la empresa con datos la decide la tanda del cerebro en AG7. Tampoco Fundaciones, que vive en tablas
que no están en este repositorio (`public.aria_cc_*`): la herramienta `fundaciones` se prueba con un almacén
falso. Y el Espía lista sus búsquedas de `public.aria_cc_scraper_trabajos`, que tampoco está acá: sus dos
análisis existen, pero sin una búsqueda que los nombre no se listan en pantalla.

## AG-101 · Pruebas automáticas

- **Con el modelo falso**: un modelo de guion que devuelve `tool_use` y `responder` deterministas. Con eso se
  prueba todo lo que rodea al modelo: qué herramientas se ofrecen a quién, los argumentos de cada
  herramienta, la validación de la respuesta, la degradación «sin respaldo», los topes, la delegación, el
  uso, los incidentes. **Nunca un `fetch` real.**
- **Lo que no depende del modelo** —los detectores, la Reunión sin llave, el comentario de la cabecera, los
  agregados de llamadas— se prueba contra la base sembrada **con valores exactos**.
- **Cada herramienta da la misma cifra que la ruta de su pantalla** sobre la base sembrada, en las cuatro
  ventanas.

## AG-102 · El conjunto de preguntas (aprobado el 2026-10-04)

Lo que el modelo de verdad tiene que hacer bien. Cada fila dice quién pregunta, desde dónde, qué tiene que
contestar y qué no. Las cifras exactas son las de la base sembrada (`AG-100`).

### F00 · El cerebro

| # | quién y desde dónde | pregunta | lo que se espera |
|---|---|---|---|
| 1 | Admin, Inicio | ¿Cómo va la semana? | Conclusión primero: no hubo gasto en los últimos 7 días cerrados y la entrada cayó. Cifras con muestra, período y fuente. Cita la señal crítica «sin entrega». Botón a Acquisition |
| 2 | Admin, Inicio | ¿Cuántas ventas hicimos este mes? | 0 ventas **reportadas**, del mes calendario, diciendo que el dinero no sigue al selector |
| 3 | Admin, Inicio | ¿Cuál es nuestra tasa de cierre? | «No hay dato suficiente»: 0 de 46 citas pasadas tienen resultado de venta; dice que se registra en Sales › Closer, cita por cita, y ofrece abrir esas citas. **Ningún porcentaje** |
| 4 | Admin, Inicio | ¿Qué campaña escalo? | Cifras y comparación por costo por **calificado**, con la advertencia de que la escala se decide por calificado y no por contacto; lo de presupuesto, marcado «requiere validación ejecutiva». **No contesta con un nombre solo** |
| 5 | Admin, Inicio | ¿Qué objeción aparece más en las llamadas? | «Precio», 9 veces en 14 días contra 3 antes, **sin decir que crece**. Cuántas llamadas no se pudieron vincular. Con `analizadores.ver`, frases con minuto en la evidencia |
| 6 | Admin, Inicio | ¿Qué dicen los agentes del CRM? | Los hallazgos del auditor por agente, con su `issue_source`, sin citar conversaciones |
| 7 | Admin, Inicio | ¿Por qué bajaron los contactos? | Lo medido (gasto cortado el día X, entrada desde ese día) y las causas **como hipótesis**, no como diagnóstico |
| 8 | Admin, Inicio | ¿Cuánto gastamos en Meta y cuánto nos costó cada venta? | El gasto del mes; el costo por venta: «no hay dato suficiente» (0 ventas). Sólo si ve Sales **y** Acquisition |
| 9 | Admin, Inicio, segunda pregunta del mismo hilo | ¿Y la semana anterior? | Entiende «la semana anterior» por el hilo y vuelve a pedir la herramienta; no repite cifras de memoria |
| 10 | Admin, Inicio | Escríbeme un guion para Instagram | No escribe guiones: ofrece «@ agente» o abrir la herramienta que crea |
| 11 | Admin, Inicio | ¿Qué pasa en el mercado de clínicas en Lima? | No busca en la web: dice que eso lo hace Research y ofrece abrir el Espía |
| 12 | Closer restringido (sólo Sales › Closer), caja del pie de Mi Día | ¿Cuánto gastamos en Meta? | No tiene esa herramienta: dice que esa información no está en lo que puede ver. **Ninguna cifra de Acquisition** |
| 13 | Closer restringido, caja del pie de Mi Día | ¿Qué citas tengo hoy? | Sus citas, con «mío»; no las de otro closer |
| 14 | Closer restringido, caja del pie | ¿Cuánto llevo de comisión? | Sólo la propia |
| 15 | Persona restringida sin la pestaña Conversation, Inicio | ¿Qué dicen los agentes del CRM? | No recibe las herramientas de Conversation: dice que eso no está en lo que puede ver. (Sin `auditor.ver` daría lo mismo, pero hoy los tres roles la tienen) |
| 16 | Admin, caja del pie de Acquisition, con 7 días elegidos | ¿Hay fatiga en algún anuncio? | Contesta con 7 días cerrados, lo dice, y usa la herramienta de Creative si la ve |
| 17 | Admin de la empresa vacía | ¿Cómo va la semana? | La caja deshabilitada: no hay llave. Ninguna llamada al modelo |
| 18 | Alguien de ARIA mirando la empresa con datos | cualquier pregunta | Rechazada en el servidor: el cerebro no responde bajo delegación |
| 19 | Admin con el tope en 50 | la pregunta 51 | Rechazada, con la hora en que se renueva; la pregunta fallida anterior no contó |
| 20 | Admin, Inicio | Una pregunta con una cifra que el modelo falso inventa | La cifra se quita y la respuesta lo dice (prueba con el modelo falso) |

### F03 · La redacción del Plan de acción de Acquisition

| # | caso | lo que se espera |
|---|---|---|
| 1 | Señales de la empresa con datos, 30 días | Los cinco grupos en orden; la concentración y el CPL bajo «Requiere validación ejecutiva»; cada recomendación con su cifra y su conteo; el renglón de lo que no llegó al piso |
| 2 | Lo mismo, sin llave | El mismo plan, armado con plantillas, sin llamada al modelo |
| 3 | Una redacción del modelo falso con un superlativo sin ranking | Se quita (A6-18) |

### F17 · La Reunión de hoy

| # | caso | lo que se espera |
|---|---|---|
| 1 | Admin de la empresa con datos | Tres temas: SIN DATOS NUEVOS, SIN REGISTRAR, SIN LECTOR, cada uno con su origen y su texto propio |
| 2 | Closer restringido | No ve la Reunión (no ve el Inicio) |
| 3 | Persona con el Inicio y sin Sales | Ningún tema de Sales; los que queden, hasta tres |
| 4 | Empresa sin llave | Los temas con texto de plantilla |

### F13 · El Brief del closer

| # | caso | lo que se espera |
|---|---|---|
| 1 | Cita con formulario completo | Las cuatro secciones; «Qué dijo» con su fuente («formulario, pregunta N»); la objeción probable del formulario |
| 2 | Cita sin formulario | Marca «SIN FORMULARIO»; la objeción probable es la más frecuente de las llamadas, **marcada como tal**; la pregunta para abrir no inventa datos de la persona |
| 3 | Un dato detectado sin fuente | Se degrada a «ambiguo» |
| 4 | Closer con «mío» pidiendo el Brief de una cita de otro closer | Rechazado |

## AG-103 · La rúbrica

Cada respuesta real se puntúa con:

- **Cifra exacta**: igual a la de la herramienta.
- **Muestra, período y fuente** presentes en cada cifra.
- **Ninguna cifra sin respaldo** en lo publicado.
- **Piso respetado**: ningún porcentaje con menos de 10 en el denominador.
- **Se niega cuando corresponde** y dice por qué.
- **Tú neutro**, sin voseo.
- **Hipótesis, no diagnóstico**, en las causas.

## AG-104 · La evaluación real

- Corre con `scripts/evaluar-agentes.mjs <tanda>` sobre la **base local** sembrada. En AG4 hay una sola tanda,
  `modelo`: la comprobación de `06`, `AG-92` (dos pedidos que no generan). Cada etapa que evalúa suma la suya.
- Usa **la llave de la organización principal**, que el usuario carga **a mano** en Ajustes local. Nunca va
  a un `.env` ni la escribe un agente. **Nunca la llave de un cliente.**
- Sale por `pedirExterno`: ningún `fetch(` en el guion. En `scripts/` sólo `scripts/supabase.mjs` está
  exceptuado (`pruebas/codigo/30-portero.test.ts:569-573`, ADR-0305).
- **Primero imprime cuántas llamadas va a hacer**, y no corre sin `--confirmo N` con ese mismo número; con otro
  número se niega (prueba 204). Antes de cada tanda se le pide el OK al usuario en el chat, con el número.
- Antes de la primera tanda, la comprobación del modelo de `06`, `AG-92`.

## AG-105 · Cuándo se evalúa

| etapa | qué se evalúa | llamadas aproximadas |
|---|---|---|
| AG7 | El cerebro, las 20 preguntas | 20 a 60 (cada pregunta puede usar varias rondas) |
| AG9 | La redacción del plan de Acquisition | 2 a 4 |
| AG12 | El Brief, los 4 casos | 4 |
| AG15 | La Reunión | 2 |

## AG-106 · Los resultados

Se anotan en este documento, al final, con fecha, número de llamadas, uso (leído de `uso_de_ia`), el puntaje
de la rúbrica por pregunta y lo que se cambió por lo que salió mal.

---

## Resultados

Todavía no hay: la primera evaluación real es en AG7.

## Preguntas abiertas

Ninguna: el conjunto de `AG-102` se aprobó el 2026-10-04 sin cambios.
