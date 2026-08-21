// ADR-0802 — Una operación sin contexto AVISA, no solo falla. INNEGOCIABLE.
//
// `avisar(` — el único canal de aviso del sistema.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ESCRIBIR EN EL REGISTRO DEL SERVIDOR **NO CUENTA**
//
// El `10` § 1 lo dice sin dejar lugar:
//
//   "**Y 'avisar' tiene que significar algo concreto, o esta sección no sirve de nada.** Escribir en
//    el registro del servidor NO CUENTA: es exactamente el error 500 en un archivo que nadie lee que
//    estábamos tratando de convertir en detección."
//
// Y remata: *"sin esas cuatro [decisiones], `avisar()` es una función con un nombre tranquilizador."*
//
// Las cuatro, y qué se decidió acá:
//
// ── 1 · EL MEDIO ─────────────────────────────────────────────────────────────
//
// *"Uno que interrumpa: mensaje al teléfono, canal de chat del equipo, correo con regla de prioridad.
// No un panel que hay que abrir."*
//
// Es una decisión de operación, no de código: depende de qué usa el equipo. Acá se implementa como un
// **punto de entrada web** (`AVISO_URL`) porque es el denominador común de todos los medios que
// interrumpen —chat de equipo, mensajería, y las pasarelas a teléfono lo aceptan—.
//
// **Y si no está configurado, `avisar()` LANZA.** No cae al registro: un respaldo al registro es
// exactamente lo que el documento acaba de descartar, y sería el `??` del `07` § 1 aplicado a la
// detección. Un aviso que no llega no existe, y un aviso que "llega" a un archivo es peor que
// ninguno, porque hace creer que hay detección.
//
// ── 2 · A QUIÉN ──────────────────────────────────────────────────────────────
//
// *"Una persona nombrada y un suplente. 'Al equipo' es a nadie a las tres de la mañana."*
//
// Eso NO se puede resolver en código: son dos nombres y dos formas de alcanzarlos. Queda como
// pendiente explícito en `docs/ETAPA-8.md`, y `AVISO_DESTINO` viaja en el cuerpo para que el destino
// esté en el aviso y no solo en la configuración del canal.
//
// ── 3 · DEDUPLICACIÓN ────────────────────────────────────────────────────────
//
// *"Una operación rota en bucle dispara MILES de avisos y entierra al resto. Un aviso por firma del
// problema y por hora, con el conteo adentro."*
//
// Implementado, y con una limitación que hay que decir: la ventana vive **en memoria del proceso**.
// Con varias instancias, cada una manda su propio aviso por hora. Eso es aceptable —el techo son
// unos pocos avisos por hora en vez de miles— y la alternativa, una tabla de deduplicación, pondría
// la deduplicación en la base, que es justo lo que puede estar fallando cuando esto se dispara.
//
// ── 4 · SI EL CANAL FALLA ────────────────────────────────────────────────────
//
// *"El aviso que no llega no existe."* `avisar()` **no se traga el error del canal**: lo propaga a
// quien la llamó, con el aviso adentro del mensaje. Así el fallo del canal aparece en la respuesta de
// la petición que lo provocó en vez de desaparecer.
// ═══════════════════════════════════════════════════════════════════════════════

/** Las firmas de aviso. Un conjunto cerrado: una firma nueva es un cambio que alguien revisa. */
export type Firma = 'aislamiento_sin_contexto' | 'fuga_entre_organizaciones';

// `credencial_ilegible` NO está acá, y es deliberado: el `10` § 2 le asigna cadencia **diaria**
// (*"consulta diaria sobre la auditoría"*), así que es una fila de auditoría que alguien consulta,
// no un aviso que interrumpe. Las dos únicas cosas que interrumpen son las dos que este proyecto
// implementa por `EJECUCION` § 5: la excepción del aislamiento y la sonda.

/** Cuánto dura la ventana de deduplicación. El `10` § 1 dice "por hora". */
const VENTANA_MS = 60 * 60 * 1000;

/**
 * La ventana de deduplicación, por firma.
 *
 * Es una estructura mutable en el nivel superior de un módulo, o sea justo lo que `ADR-0703`
 * prohíbe — y por eso este archivo está en su lista de excepciones **con nombre**. La diferencia:
 * `ADR-0703` protege contra mezclar DATOS DE INQUILINO entre peticiones, y acá no hay ni un dato de
 * inquilino. Lo que se guarda es un contador por firma.
 */
const ventanas = new Map<Firma, { desde: number; cuantos: number }>();

/** Solo para las pruebas: vacía la ventana. */
export function reiniciarVentanas(): void {
  ventanas.clear();
}

function urlDelCanal(): string | undefined {
  return process.env.AVISO_URL;
}

/**
 * Emite un aviso. **Lanza si el canal no está configurado o si falla.**
 *
 * Devuelve `true` si se mandó y `false` si se suprimió por deduplicación — y esa distinción importa:
 * quien la llame puede querer saber si el aviso salió, y un `void` haría que "suprimido" y "mandado"
 * se vean igual.
 */
export async function avisar(firma: Firma, detalle: Record<string, unknown>): Promise<boolean> {
  const ahora = Date.now();
  const ventana = ventanas.get(firma);

  if (ventana && ahora - ventana.desde < VENTANA_MS) {
    // Dentro de la ventana: se cuenta y no se manda. El conteo va en el aviso SIGUIENTE, que es lo
    // que el `10` § 1 pide con *"con el conteo adentro"*.
    ventana.cuantos += 1;
    return false;
  }

  const suprimidos = ventana?.cuantos ?? 0;
  ventanas.set(firma, { desde: ahora, cuantos: 0 });

  const url = urlDelCanal();
  if (!url) {
    // NO se cae al registro. Ver el encabezado: el respaldo al registro es exactamente lo que el
    // documento descarta, y haría creer que hay detección donde no hay.
    throw new Error(
      `avisar(${firma}): AVISO_URL no está configurada, así que este aviso NO LLEGÓ A NADIE. ` +
        'Escribir en el registro del servidor no cuenta como detección (10 § 1). ' +
        `Detalle del aviso perdido: ${JSON.stringify(detalle)}`,
    );
  }

  const cuerpo = {
    firma,
    // El destino viaja EN el aviso, no solo en la configuración del canal: así el aviso dice a quién
    // buscaba, incluso si el canal se reconfiguró después.
    destino: process.env.AVISO_DESTINO ?? '(sin destino nombrado)',
    // Sin `Date.now()` en el cuerpo del mensaje: la marca de tiempo la pone el canal, y dos relojes
    // que no coinciden en un aviso confunden más de lo que ayudan.
    suprimidosDesdeElUltimo: suprimidos,
    detalle,
  };

  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
      // Corto a propósito: este aviso corre dentro de una petición que ya falló, y colgarla diez
      // segundos más no ayuda a nadie.
      signal: AbortSignal.timeout(3000),
    });
  } catch (e) {
    throw new Error(
      `avisar(${firma}): el canal de avisos no respondió, así que este aviso NO LLEGÓ. ` +
        `${e instanceof Error ? e.message : 'causa desconocida'}. ` +
        `Detalle del aviso perdido: ${JSON.stringify(detalle)}`,
    );
  }

  if (!respuesta.ok) {
    throw new Error(
      `avisar(${firma}): el canal de avisos respondió ${respuesta.status}, así que este aviso ` +
        `NO LLEGÓ. Detalle del aviso perdido: ${JSON.stringify(detalle)}`,
    );
  }

  return true;
}
