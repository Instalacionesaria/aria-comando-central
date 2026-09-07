// El enlace para agendar una llamada en el calendario de la empresa.
//
// ═══════════════════════════════════════════════════════════════════════════════
// UN ARCHIVO PARA UNA LÍNEA, Y EL MOTIVO ES QUE LA FORMA DE LA URL SE MIDIÓ
//
// `https://api.leadconnectorhq.com/widget/booking/<calendarId>` — comprobado contra la subcuenta real
// el 2026-08-26: responde **200 con HTML**. Las otras dos formas que probé no sirven:
//
//   · `…/widget/bookings/<widgetSlug>` también responde 200, y se descartó porque el `widgetSlug`
//     lo puede cambiar quien administra el calendario en GoHighLevel sin avisarle a nadie. El
//     identificador no cambia.
//   · `https://link.<dominio propio>/widget/booking/<id>` responde **404**: ese host del dominio
//     blanco no sirve para esto. **Ojo con generalizarlo**, que es lo que decía este comentario
//     hasta hoy: medido el 2026-09-07, el dominio de RESERVAS propio —`calls.ariaia.com`, que no
//     es `link.…`— responde 200 igual que el de GoHighLevel. Lo que 404 es `link.`, no el dominio
//     propio en general.
//
// La arma el SERVIDOR y no el navegador, y eso es la única razón por la que este archivo existe: si
// el navegador recibiera el identificador y armara la URL, la forma quedaría escrita en un componente
// —o en dos— y el día que GoHighLevel la cambie habría que encontrar todas las copias. Acá el
// navegador recibe una URL o un `null`.
//
// ── HOY NO TIENE CONSUMIDOR, Y SE DEJA A PROPÓSITO ───────────────────────────
//
// El único que la llamaba era el botón «◷ Agendar» de la ficha, y ese botón se quitó a pedido. Así
// que esta función queda **declarada y sin llamar**, lo cual normalmente sería código muerto que hay
// que borrar. Se deja, y por tres motivos concretos:
//
//   · `identidad.organizaciones_credenciales.crm_calendario_id` **sigue existiendo y sigue
//     configurándose** en Ajustes → Credenciales, porque se pidió explícitamente. Borrar esto
//     dejaría un campo que se guarda y del que nada en el repositorio dice qué es;
//   · lo que vale de este archivo no es la línea, es la **medición** de arriba: tres formas
//     probadas contra la subcuenta real, dos descartadas con su motivo. Eso no se vuelve a deducir
//     leyendo código, y su pérdida costaría otra tarde;
//   · tiene sus pruebas en `pruebas/codigo/100-agendar.test.ts`, así que no es código sin verificar:
//     si GoHighLevel cambiara la forma, la prueba sigue siendo el lugar donde dice cuál era.
//
// Si alguna vez se decide que el calendario tampoco se configura más, este archivo, su prueba y la
// columna se van juntos — no antes.
// ═══════════════════════════════════════════════════════════════════════════════

/** La base del widget de agendamiento. Es de GoHighLevel, no del dominio blanco del cliente. */
const BASE_DEL_WIDGET = 'https://api.leadconnectorhq.com/widget/booking';

/**
 * El enlace para agendar en el calendario configurado. `null` cuando no hay calendario cargado.
 *
 * **Nulo y no una URL a la portada.** El prototipo tenía ese defecto con el enlace al CRM y está
 * escrito en `app/api/contactos/[id]/route.ts`: *"el prototipo resolvía esto abriendo
 * `https://app.gohighlevel.com/` a secas, o sea la portada: un botón que dice «Ver en GHL» y lleva a
 * buscar el contacto a mano"*. Un botón que lleva a un lugar inútil es peor que un botón atenuado,
 * porque el atenuado dice qué falta.
 */
export function enlaceDeAgendamiento(calendarioId: string | null | undefined): string | null {
  if (typeof calendarioId !== 'string') return null;
  const id = calendarioId.trim();
  // La cadena vacía cuenta como ausencia, igual que en todo el resto del trato con este proveedor:
  // un campo de texto guardado sin tocar llega como `''` y no como nulo.
  if (id === '') return null;
  return `${BASE_DEL_WIDGET}/${encodeURIComponent(id)}`;
}

/**
 * El enlace para REAGENDAR una cita concreta. `null` si falta cualquiera de las dos piezas.
 *
 * ────────────────────────── POR QUÉ `event_id` Y NO EL LINK DE AGENDAR A SECAS ──────────────────────────
 *
 * Medido contra la subcuenta real el 2026-09-07: con `?event_id=<evento>`, el widget devuelve la
 * cita de verdad en los datos de la página —el id del evento y su fecha, junto a `event_address` y
 * `selected_timezone`— y las menciones de «reschedule» pasan de 1 a 3. Sin el parámetro esos datos
 * no están: es una reserva nueva, no un reagendado.
 *
 * La diferencia importa para quien lo recibe. Un link de reserva nueva le pide elegir todo otra
 * vez y **deja la cita vieja en pie**, así que el closer termina con dos citas y una que nadie va
 * a atender.
 *
 * ────────────────────────── EL CALENDARIO ES EL DE LA CITA, NO EL DE LA EMPRESA ──────────────────────────
 *
 * `crm_calendario_id` es uno y la subcuenta tiene nueve. Con el de la empresa, el link abriría el
 * calendario de otro closer: la persona vería horarios que no son y reservaría ahí. Por eso el
 * calendario entra por parámetro y sale de `negocio.citas.ghl_calendario_id`.
 *
 * @param dominio      El de reservas de la empresa, o `null` para el de GoHighLevel.
 * @param calendarioId El calendario DE LA CITA.
 * @param eventoId     El `ghl_evento_id` de la cita.
 */
export function enlaceDeReagendamiento(
  dominio: string | null | undefined,
  calendarioId: string | null | undefined,
  eventoId: string | null | undefined,
): string | null {
  const cal = typeof calendarioId === 'string' ? calendarioId.trim() : '';
  const ev = typeof eventoId === 'string' ? eventoId.trim() : '';
  // Las dos hacen falta. Con una sola, la URL llevaría a una reserva nueva o a un 404, y las dos
  // son peores que no ofrecer el link: la primera crea una segunda cita.
  if (cal === '' || ev === '') return null;

  /* La barra final se saca acá y no se le pide a quien configura: un dominio pegado de la barra
     del navegador la trae, y `https://x.com//widget/...` no es la misma URL. */
  const base =
    typeof dominio === 'string' && dominio.trim() !== ''
      ? `${dominio.trim().replace(/\/+$/, '')}/widget/booking`
      : BASE_DEL_WIDGET;

  return `${base}/${encodeURIComponent(cal)}?event_id=${encodeURIComponent(ev)}`;
}
