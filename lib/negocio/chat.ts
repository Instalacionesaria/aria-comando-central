// La fusión del chat y sus separadores de día.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO NO VIVE DENTRO DEL COMPONENTE
//
// Es la única parte del chat que puede estar mal **sin que se vea al mirar**. El orden se nota, el
// scroll se nota; «un mensaje que se perdió en la fusión» solo aparece cuando ya pasó. Acá se puede
// probar contra los casos que importan, incluido el de mandar el mismo texto dos veces.
//
// Módulo isomorfo y puro: sin base, sin React, sin DOM.
// ═══════════════════════════════════════════════════════════════════════════════

import type { FamiliaDeEntrega } from '../ghl/entrega.ts';
import { diaEnZona, etiquetaDeDia } from './tiempo.ts';

/**
 * Lo mínimo que la fusión necesita saber de un mensaje. El componente pasa los suyos enteros.
 *
 * ── HAY DOS «FALLIDO» Y NO SON EL MISMO HECHO ───────────────────────────────
 *
 * `entrega: 'fallido'` es del servidor: la fila **existe** en la base, el CRM la aceptó, y el canal
 * la rechazó después. Lo descubre la tercera pasada de la ingesta.
 *
 * `envio: 'fallido'` es local: el `POST` nunca terminó bien, así que **el servidor no tiene nada**.
 * Nadie más que esta pantalla sabe que ese mensaje se intentó.
 *
 * La distinción es la razón de ser de la mitad de este archivo: al primero lo trae el servidor en
 * cada vuelta, y al segundo **hay que conservarlo acá o desaparece**.
 */
export interface MensajeFusionable {
  /** Identificador. Los optimistas traen uno local (`local:<n>`) que el servidor no conoce. */
  id: string;
  cuerpo: string | null;
  direccion: 'entrante' | 'saliente';
  /** La familia que dice el servidor. `undefined` en una burbuja optimista. */
  entrega?: FamiliaDeEntrega | null;
  /** Solo en las burbujas optimistas. `undefined` = ésta la trajo el servidor. */
  envio?: 'enviando' | 'fallido' | null;
}

/** `true` si esta burbuja todavía no la confirmó el servidor. */
function enVuelo(m: MensajeFusionable): boolean {
  return m.direccion === 'saliente' && (m.envio === 'enviando' || m.envio === 'fallido');
}

/**
 * Devuelve la lista a mostrar: lo del servidor, y detrás lo que sigue viajando.
 *
 * ── EL DEFECTO QUE MOTIVÓ ESTO ──────────────────────────────────────────────
 *
 * El chat repregunta cada 5 segundos y **pisaba la lista entera** con la respuesta. Un mensaje
 * recién enviado todavía no está ahí —el CRM tarda un momento en devolverlo—, así que la burbuja
 * desaparecía de la pantalla y volvía unos segundos después. En WhatsApp eso no pasa nunca, y es lo
 * que se veía como «desincronización».
 *
 * El caso peor era el otro: un envío que falló de verdad (sin red) se marcaba fallido en local, y
 * como el servidor nunca lo tuvo, el reemplazo siguiente lo borraba. Se veía el error un segundo y
 * después nada — **un mensaje que el contacto no recibió, desaparecido sin rastro**.
 *
 * ── SE CUENTAN COPIAS, NO PRESENCIA ────────────────────────────────────────
 *
 * Mandar «ok» dos veces seguidas es normal. Comparando con un conjunto, la segunda burbuja se daba
 * por confirmada apenas llegaba la primera del servidor: el mensaje desaparecía de la pantalla
 * **habiendo salido de verdad**. Cada copia del servidor cancela **una** burbuja en vuelo, no todas
 * las que digan lo mismo.
 *
 * El texto es el único puente disponible entre las dos: la burbuja optimista se identifica con el
 * reloj del navegador y la fila real con el identificador de la base, y no hay forma de atarlas
 * antes de que el servidor la devuelva.
 *
 * ── LO QUE **NO** SE CONSERVA, Y POR QUÉ ────────────────────────────────────
 *
 * Un saliente ya confirmado no se arrastra de la lista vieja. Duplicarlo sería lo obvio; lo peor es
 * que dejaría en pantalla **un estado viejo**: un mensaje que el servidor daba por en curso y que
 * después el canal rechazó seguiría mostrándose en curso para siempre. La lista del servidor es la
 * verdad de todo lo que el servidor conoce.
 */
export function fusionarMensajes<T extends MensajeFusionable>(
  delServidor: readonly T[],
  previos: readonly T[],
): T[] {
  const disponibles = new Map<string, number>();
  for (const m of delServidor) {
    if (m.direccion === 'saliente') {
      const k = clave(m.cuerpo);
      disponibles.set(k, (disponibles.get(k) ?? 0) + 1);
    }
  }

  const pendientes = previos.filter((m) => {
    if (!enVuelo(m)) return false;
    const k = clave(m.cuerpo);
    const quedan = disponibles.get(k) ?? 0;
    // Hay una copia del servidor sin reclamar: ésta ya llegó, se consume y se suelta.
    if (quedan > 0) {
      disponibles.set(k, quedan - 1);
      return false;
    }
    return true;
  });

  // Los pendientes van al final: son los más nuevos de la conversación.
  return [...delServidor, ...pendientes];
}

/**
 * La clave de comparación. Se recorta y se colapsan los espacios porque el canal normaliza el texto
 * al devolverlo, y un salto de línea de más haría que la burbuja no se reconozca nunca.
 */
function clave(cuerpo: string | null): string {
  return (cuerpo ?? '').trim().replace(/\s+/g, ' ');
}

// ─── Los separadores de día ─────────────────────────────────────────────────
//
// `diaEnZona` y `etiquetaDeDia` VIVÍAN ACÁ y se mudaron a `lib/negocio/tiempo.ts`. El motivo es el
// defecto que el documento de la Agenda ya había pagado: *"cuando cada pantalla la calculaba por su
// cuenta, dos vitrinas mostraban horas distintas para la misma cita"*. Con la Agenda serían tres
// definiciones del mismo día; ahora hay una.
//
// Se re-exportan para no romper a quien ya las importaba de acá, y porque el defecto que arreglaron
// —días distintos pegados sin separador, «el orden correcto leído como desorden»— se explica en el
// archivo nuevo.
export { diaEnZona, etiquetaDeDia } from './tiempo.ts';

/** Un renglón de la lista que se dibuja: o un separador, o un mensaje. */
export type RenglonDeChat<T> =
  | { tipo: 'dia'; clave: string; texto: string }
  | { tipo: 'mensaje'; clave: string; mensaje: T };

/**
 * Intercala los separadores. Se hace acá y no en el JSX porque «dónde cambia el día» es una
 * decisión con dos zonas horarias metidas, y en el JSX no se puede probar.
 *
 * Los mensajes tienen que venir del más viejo al más nuevo — es como los devuelve
 * `mensajesDeLaFicha`.
 */
export function conSeparadores<T extends { id: string; enviadoEl: Date | string }>(
  mensajes: readonly T[],
  zona: string,
  ahora: Date | string = new Date(),
): RenglonDeChat<T>[] {
  const hoy = diaEnZona(ahora, zona);
  const renglones: RenglonDeChat<T>[] = [];
  let ultimoDia = '';
  for (const m of mensajes) {
    const dia = diaEnZona(m.enviadoEl, zona);
    // Un mensaje con fecha ilegible NO se descarta: se dibuja sin separador. El `03` § 7 dice que
    // cuando un mensaje se descartaba «para el auditor ese mensaje no existió y el turno anterior
    // parecía sin respuesta».
    if (dia !== '' && dia !== ultimoDia) {
      renglones.push({ tipo: 'dia', clave: `dia:${dia}`, texto: etiquetaDeDia(dia, hoy) });
      ultimoDia = dia;
    }
    renglones.push({ tipo: 'mensaje', clave: m.id, mensaje: m });
  }
  return renglones;
}
