// ADR-0801 — El aislamiento se sostiene AHORA, no solo en pruebas. INNEGOCIABLE.
//
// El punto de entrada de la sonda horaria. Lo llama una tarea programada, no una persona.
//
// ═══════════════════════════════════════════════════════════════════════════════
// NO ES UNA RUTA PÚBLICA, Y NO PASA POR EL PORTERO
//
// Es la única ruta del sistema que no encaja en ninguna de las dos categorías, y eso hay que
// resolverlo a la vista en vez de meterla en la lista que menos moleste:
//
//   · **No puede pasar por el portero**: no hay sesión. La llama una tarea programada, y
//     `exigir()` respondería 401 a la única cosa que puede detectar una fuga en producción.
//   · **No puede ser pública**: dejar que cualquiera la llame es dejar que cualquiera pregunte por
//     el estado del aislamiento y consuma conexiones de la base sin autenticarse.
//
// Así que tiene su propia autenticación, y es la más simple que sirve: **un secreto compartido en
// una cabecera**. `SONDA_TOKEN`, comparado con `timingSafeEqual`.
//
// Sin ese secreto configurado, la ruta responde 403 y **no corre la sonda**. No hay respaldo: una
// sonda que corre sin autenticación es un punto de entrada abierto, y una sonda que se saltea
// porque falta la variable es una sonda que no existe — la segunda se ve en la respuesta, la
// primera no.
//
// ── POR QUÉ UNA RUTA Y NO UN SCRIPT ──────────────────────────────────────────
//
// El arranque del primer administrador es un script porque corre **una vez** y no puede estar
// expuesto (`EJECUCION` § 3). Esta corre **cada hora, en producción, contra la base de producción**:
// tiene que correr donde corre la aplicación, con sus mismas credenciales y su mismo agrupador. Un
// script en otra máquina probaría el aislamiento de esa otra máquina.
// ═══════════════════════════════════════════════════════════════════════════════

import { timingSafeEqual } from 'node:crypto';
import { ok, rechazo } from '../../../lib/autorizacion/respuesta.ts';
import { sondaDeAislamiento } from '../../../lib/deteccion/sonda.ts';

/** Comparación de largo constante. Un `===` sobre un secreto es un canal de tiempo. */
function coincide(recibido: string, esperado: string): boolean {
  const a = Buffer.from(recibido, 'utf8');
  const b = Buffer.from(esperado, 'utf8');
  // `timingSafeEqual` LANZA si los largos difieren, así que el largo se compara antes — y eso sí
  // filtra el largo del secreto, que es información de la que no se puede hacer nada.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(peticion: Request): Promise<Response> {
  const esperado = process.env.SONDA_TOKEN;
  if (!esperado) {
    // El nombre de la variable va al REGISTRO, no al cuerpo. Mismo motivo que en
    // `verificarOrigen`: esta ruta es alcanzable **sin autenticar** —es su naturaleza, la llama
    // una tarea programada— así que un `detalle` acá se lo cuenta a cualquiera que la golpee. Y
    // desde que la pantalla de entrada muestra el `detalle` de los rechazos, ese campo dejó de
    // ser un rincón que nadie lee.
    //
    // Quien puede arreglar esto administra el despliegue y lee el registro. Que la sonda NO
    // corrió es justo lo que hay que gritar ahí: un 403 silencioso en una tarea horaria se lee
    // como "la sonda anda y no encuentra nada".
    console.error(
      'sonda: el secreto de la sonda no está configurado, así que la ruta responde 403 y LA ' +
        'SONDA NO CORRIÓ. La señal 6 está apagada. Ver docs/DESPLIEGUE.md.',
    );
    return rechazo('sin_permiso');
  }
  const recibido = peticion.headers.get('x-sonda-token');
  if (!recibido || !coincide(recibido, esperado)) {
    return rechazo('sin_permiso');
  }

  const resultado = await sondaDeAislamiento();

  // Se responde el resultado ENTERO, incluido `revisadas`. El registro de la tarea programada es
  // donde alguien va a mirar cuando quiera saber si la sonda sigue viva, y `revisadas: 0` con
  // `fugas: []` se lee como "todo bien" si no está el número al lado.
  //
  // Y el estado NO es 500 cuando hay fuga: el aviso ya salió por el canal que interrumpe, y un 500
  // haría que la tarea programada reintentara, disparando la deduplicación en vez del aviso.
  return ok(resultado);
}
