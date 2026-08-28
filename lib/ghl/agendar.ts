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
//   · `https://link.<dominio propio>/widget/booking/<id>` responde **404**: el dominio blanco del
//     cliente no sirve para esto.
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
