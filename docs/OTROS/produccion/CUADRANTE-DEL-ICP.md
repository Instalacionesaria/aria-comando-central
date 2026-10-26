# El cuadrante del ICP: el puntaje del lead pasa a ser cuatro palabras del CRM

> Construido el **2026-10-26** en commits locales «ICP en cuadrantes · Q1» a «Q7» (migración `105`), **sin subir**
> hasta que el usuario dé el OK. Los requisitos y las decisiones están en
> [15-EL-CUADRANTE-DEL-ICP.md](../../leads-portal/15-EL-CUADRANTE-DEL-ICP.md). Depende de subir antes la `079` a la
> `104` (la Fase 0, el nivel 3 y Meta directo): la columna `contactos.cuadrante` es de la `084`.

## 1 · Qué cambia

| | Antes | Con el cuadrante |
|---|---|---|
| El ICP de un lead | «Puntaje \| ICP», un número de 0 a 100, cortado en 75 y 50 | Prioriza, Valida, Financia o Descarta, del campo `contact.cuadrante_de_clasificacion` |
| Dónde se guarda | `contactos.score` | `contactos.cuadrante` (la `084`); `score` se sigue guardando y nadie lo lee |
| Cuál campo es | se elegía por cliente en Ajustes › Clientes, o por su nombre | se reconoce solo por su clave (`campos_del_crm.clave`, la `105`) |
| Calificado | agendó y no está descartado | agendó, está en Prioriza, Valida o Financia, y no está descartado |
| Descartado | una etiqueta de descarte | una etiqueta de descarte **o** el cuadrante Descarta |
| Lo que se ve | números del ICP en Leads Portal, Acquisition, Creative, el Perfil y la fila del Closer | las palabras; ningún número del ICP |
| Las alertas | ICP promedio 15 puntos bajo su funnel o su etapa | porción de Descarta 15 puntos porcentuales sobre su funnel o su etapa |

## 2 · La migración `105`

- `campos_del_crm.clave`: el `fieldKey` de GoHighLevel. La pisa el refresco del catálogo, como el nombre y el tipo.
- El comentario de `contactos.cuadrante`, que dice quién la escribe desde ahora.
- Reaplicable, sin relleno: el migrador no ve filas. Lo que hay que llenar lo llena la sincronización (§ 3).

## 3 · Qué pasa la primera vez que corre la sincronización

1. La tarea de contactos guarda los contactos como siempre. El catálogo de cada cliente todavía no tiene claves, así
   que el cuadrante no se escribe (no se borra nada).
2. Al final de la misma corrida, el catálogo se relee aunque se haya leído hace menos de un día (no tiene ninguna
   clave), guarda las claves y `recalcularLosCuadrantes` clasifica a todos los contactos de ese cliente con lo que ya
   estaba guardado en sus campos. Cero llamadas nuevas al CRM.
3. Desde la corrida siguiente, cada contacto que se sincroniza llega con su cuadrante.

No hay ningún paso a mano.

## 4 · Lo que falta antes de producción

- **Que el CRM haya clasificado a los contactos.** Medido el 2026-10-26 en ARIA: 2 de los 100 más nuevos traían el
  campo. Con la regla nueva, quien agendó sin cuadrante no es calificado: si se sube antes de que GHL clasifique, los
  calificados de Acquisition y Conversion caen casi a cero. Se vuelve a medir con `scripts/medir-cuadrante.mjs`.
- **El campo en la subcuenta de cada cliente**, con la misma clave. Ajustes › Clientes dice si lo tiene.
- La subida de la `079` a la `104`.

## 5 · El plan de subida

> Nada de esto se corre sin el OK del usuario. `migrar` se corre en el modo de pedir permiso.

1. Medir: `node --env-file=.env.supabase scripts/medir-cuadrante.mjs`. Seguir sólo si la mayoría de los contactos
   recientes traen el campo.
2. Respaldo de `negocio.contactos` y `negocio.campos_del_crm`.
3. `scripts/supabase.mjs migrar` con la `105` (después de la `079` a la `104`).
4. Push.
5. Humo con login: esperar una corrida de la tarea de contactos, y mirar Leads Portal (las seis tarjetas y el aviso de
   «Sin clasificar»), Acquisition (la barra de tres y «Prioriza N %»), Ajustes › Clientes (el campo «Encontrado») y la
   ficha de un lead.
6. Contar en la base, sólo lectura: cuántos contactos tienen `cuadrante`, y cuántos traen algo en el campo que no es
   ninguna de las cuatro palabras.

**Si hay que volver atrás:** el código anterior lee `score`, que se siguió escribiendo; la `105` sólo agrega una
columna, y se puede dejar.

## 6 · Las pruebas

| Prueba | Qué cuida |
|---|---|
| 310 (código) | la normalización, el orden, los calificados, la clave exacta, que el módulo no importe nada |
| 311 (base) | la misma normalización en SQL, la clave del catálogo, la sincronización, el catálogo sin claves que se relee y reclasifica, no borrar sin los ids, el recálculo por cliente |
| 312 (base) | Descarta es un descarte; calificado es agendó con Prioriza, Valida o Financia |
| 313 (base) | Creative con varios clientes: los calificados de cada uno, el aviso del que no tiene el campo; el Perfil sin números del ICP |
| 314 (código) | ningún componente vuelve a leer el puntaje, el score ni el ICP promedio, y cada pantalla lee el cuadrante |
| 175, 176, 157, 181, 250, 252, 296 y 297, y las de código de los detectores y las pantallas | reescritas para el cuadrante |

Cada prueba nueva se vio fallar por mutación (37 mutaciones en tres tandas; la única viva, «Descarta en la lista de
calificados» contra la 312, la mata la 310).
