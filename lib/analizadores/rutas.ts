// Lo que comparten las rutas de los Analizadores: leer los parámetros y traducir los rechazos.
//
// Son siete rutas sobre la misma pantalla, y cada una tiene que decir lo mismo de la misma forma:
// que una llamada de otra empresa «no existe», que un tipo apagado «no se analiza», que otra corrida
// «la está analizando». Si cada ruta lo tradujera por su cuenta, la primera que se desvíe hace que
// la pantalla muestre dos textos distintos para el mismo hecho según el botón que se apretó.

import { rechazo } from '../autorizacion/respuesta.ts';
import type { FiltroDeLista } from './datos.ts';
import type { RechazoDelAnalisis, ResultadoDeLaFicha } from './pipeline.ts';

/** Un identificador mal formado se responde como no encontrado: sin esto la consulta lanza `22P02`. */
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * El tiempo que tiene una ruta para trabajar: los 300 s de `maxDuration` menos lo que ya se fue en
 * el portero y en contestar. Es el reloj que la guardia mira antes de arrancar una inferencia.
 */
export const TIEMPO_DE_LA_RUTA_MS = 280_000;

/** La pestaña de la que se pide. OTRO no es una pestaña: sus llamadas salen en las dos. */
export function pestanaDe(valor: string | null): 'HT' | 'OB' | null {
  return valor === 'HT' || valor === 'OB' ? valor : null;
}

/** Un tipo al que se puede reencaminar, OTRO incluido. */
export function tipoDe(valor: unknown): 'HT' | 'OB' | 'OTRO' | null {
  return valor === 'HT' || valor === 'OB' || valor === 'OTRO' ? valor : null;
}

/** El filtro de la lista. Sin valor, las analizadas: es lo primero que alguien quiere ver. */
export function filtroDe(valor: string | null): FiltroDeLista | null {
  if (valor === null) return 'analizadas';
  return valor === 'analizadas' || valor === 'pendientes' || valor === 'descartadas' ? valor : null;
}

type RechazoDeLaFicha = Extract<ResultadoDeLaFicha, { tipo: 'rechazo' }>['que'];

/** Cada rechazo del pipeline, con su código y una frase para la pantalla. */
export function respuestaDelRechazo(que: RechazoDelAnalisis | RechazoDeLaFicha): Response {
  switch (que) {
    case 'no_encontrada':
      return rechazo('no_encontrado');
    case 'tipo_otro':
      return rechazo('tipo_otro', 'Esta reunión se descartó como «no es HT ni OB». Movela a HT u OB para analizarla.');
    case 'analizador_no_disponible':
      return rechazo('analizador_no_disponible', 'El análisis de este tipo de llamada está apagado por ahora.');
    case 'sin_transcripcion':
      return rechazo('sin_transcripcion', 'Esta llamada no tiene transcripción guardada.');
    case 'llamada_en_curso':
      return rechazo('llamada_en_curso', 'Esta llamada se está analizando ahora. Esperá a que termine.');
    case 'llamada_cambio':
      return rechazo('llamada_cambio', 'La llamada cambió mientras tanto —otra corrida la analizó o la movió—. Recargá la lista.');
    case 'llave_de_ia_rechazada':
      return rechazo('llave_de_ia_rechazada', 'Anthropic rechazó la llave de IA o la cuenta no tiene saldo. La llamada quedó como estaba.');
    case 'modelo_saturado':
      return rechazo('servicio_externo_saturado', 'Anthropic está saturado. La llamada quedó como estaba: probá en unos minutos.');
    case 'sin_tiempo':
      return rechazo('sin_tiempo_para_analizar', 'No quedaba tiempo para un análisis entero. Probá de nuevo.');
    case 'ficha_solo_ht':
      return rechazo('ficha_solo_ht', 'La ficha del prospecto es solo de las llamadas HT.');
    case 'sin_analisis':
      return rechazo('llamada_sin_analizar', 'La ficha se genera sobre una llamada ya analizada.');
  }
}

/** El estado en que la pantalla vio la llamada, para que la toma lo exija. Sin valor, PENDING. */
export function esperadoDe(valor: unknown): 'PENDING' | 'FAILED' | 'DONE' | 'ANALYZING' | null {
  if (valor === undefined || valor === null) return 'PENDING';
  return valor === 'PENDING' || valor === 'FAILED' || valor === 'DONE' || valor === 'ANALYZING' ? valor : null;
}

/** El largo máximo de cada campo de una transcripción pegada a mano. */
export const TOPES_DE_LA_MANUAL = { nombre: 120, email: 254 } as const;

/** Un correo razonable: el mismo criterio que el origen, que lo exigía para identificar al prospecto. */
export const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
