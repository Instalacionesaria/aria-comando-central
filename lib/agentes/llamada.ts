// EL TRANSPORTE de los agentes nuevos: un pedido a Anthropic, su reintento, su uso y su incidente.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ HACE, EN ORDEN
//
//   1 · Arma el cuerpo: modelo, techo, instrucciones (marcadas para el caché), mensajes, y lo que el
//       agente pida de lo opcional: herramientas, formato de la salida, esfuerzo, `tool_choice` `auto` o
//       `none`.
//   2 · Lo manda por `pedirExterno` —el único cliente saliente, `ADR-0305`— con la dirección y la
//       versión de `./proveedor.ts`, que importa y no copia.
//   3 · Si el fallo es pasajero (`esPasajero`) y llegó temprano, un segundo intento. Uno solo.
//   4 · Clasifica con las situaciones `IA-*` que ya existen, lee los cuatro contadores, y anota el uso
//       (`registrarUso`) y, si falló, el incidente (`anotarIncidente`), con la MISMA referencia en la
//       línea de registro, en `negocio.incidentes` y en `negocio.uso_de_ia`.
//
// Devuelve un resultado con tipo, nunca un `Response` ni una excepción: quien llama puede ser una ruta,
// el cron o el bucle del cerebro, y sólo la ruta sabe armar un 502. `detalleDelFallo`
// (`lib/fundaciones/fallo-del-modelo.ts`) le da el FORMATO del detalle; los textos de cada situación que
// vea la persona son de cada pantalla (los de `lib/fundaciones/mensajes.ts` son de Fundaciones).
//
// ── LOS INCIDENTES DE UNA TAREA DEL CRON ─────────────────────────────────────
//
// Una ruta anota cada fallo: lo vio una persona y la referencia es lo que va a dictar. Una tarea del cron
// que llama al modelo muchas veces por corrida no: con el proveedor caído llenaría el panel con una fila
// por llamada (AG-98). Con `incidentes: 'los_agrega_quien_llama'` el transporte clasifica y devuelve, pero
// no escribe la línea ni la fila del incidente: la tarea los agrega por corrida y situación. La fila del
// uso se escribe igual, con la referencia del pedido.
//
// ── LO QUE NO HACE ───────────────────────────────────────────────────────────
//
// No lo usan los módulos que ya llamaban al modelo (Fundaciones, el auditor, los Analizadores): cada uno
// conserva su cuerpo, fijado por pruebas que nacieron de un 400 en producción
// (`docs/OTROS/agentes/01-LA-ARQUITECTURA.md`, AG-09). El tipo `AgenteNuevo` lo hace cumplir.
//
// No va en flujo (`D-16`), así que la espera nunca pasa de `ESPERA_EXTERNA_MS`. Sin flujo, Anthropic no
// manda una cabecera hasta terminar y el `fetch` de Node corta solo a los 300 s (el comentario de
// `ESPERA_DE_GENERACION_MS`, `lib/http/cliente.ts`): un tope nuestro más largo no actuaría nunca, y el
// corte llegaría como `IA-CONEXION` —que se reintenta— en vez de `IA-TIEMPO`.
//
// No se llama dentro de una transacción abierta (AG-05): mientras espera al modelo retendría una de las
// cinco conexiones del agrupador. El uso y el incidente abren cada uno la suya, corta, al final.
//
// ── NO FUERZA HERRAMIENTAS NI CONFIGURA EL PENSAMIENTO ───────────────────────
//
// `claude-sonnet-5-5`, el modelo de casi todos los agentes nuevos (`./modelos.ts`), rechaza con un 400
// `tool_choice` de tipo `tool` o `any` (la referencia de la API de Anthropic para Claude Sonnet 5.5; no
// medido con esta cuenta). Copiar la herramienta forzada del auditor —que usa `claude-sonnet-5`, donde sí
// se acepta— perdería ahí TODAS las llamadas. La salida estructurada va por las dos formas que acepta:
// `formato` (`output_config.format`, un JSON Schema) o herramientas con `strict: true` que el prompt pide
// usar; si no la usó, su lector lo dice y es `IA-ESTRUCTURA`. `tool_choice` sólo viaja como `auto` o como
// `none` —para cerrar una ronda sin que las use: se ofrecen igual y `none` las apaga—, nunca `tool` ni
// `any`, y sólo cuando hay herramientas (sin ellas, la API lo rechaza).
//
// Los dos modos estrictos no admiten parte del JSON Schema: ni `minimum`/`maximum`/`multipleOf`, ni
// `minLength`/`maxLength`, ni las restricciones complejas de arreglos, ni esquemas recursivos, y todo
// objeto lleva `additionalProperties: false`. Por HTTP directo no hay un SDK que las quite: un esquema que
// las use es un `IA-PETICION` en cada llamada, con todas las pruebas de la red falseada en verde.
//
// `thinking` no se manda: `claude-sonnet-5-5` piensa por omisión (y `{type:'disabled'}` es un 400) y
// `claude-haiku-4-5-20251001` no piensa si no se le pide. El `techo` cubre pensamiento y texto, y la
// respuesta puede empezar con bloques `thinking` vacíos: los lectores buscan por TIPO y por NOMBRE,
// nunca por posición. Cuánto piensa se gobierna con `esfuerzo` (`output_config.effort`), que Haiku 4.5
// rechaza: el transporte no se lo manda aunque se lo pidan (`SIN_ESFUERZO`).
//
// Y el historial que vuelve al modelo es de sólo agregar: dentro de las rondas de una pregunta, los
// bloques de cada turno vuelven tal cual llegaron —`thinking` incluidos—, y las instrucciones y las
// herramientas no cambian. Editar un turno anterior invalida los bloques `thinking` que siguen, y en las
// cuentas creadas desde el 2026-08-31 eso es un 400 («preserved thinking»). El transporte manda lo que
// recibe; cuidarlo es de quien arma `mensajes`.
//
// `cache_control` va en las instrucciones y en la última herramienta, con la vida por omisión de 5
// minutos. La de una hora (`ttl: '1h'`, sin cabecera beta) cuesta el doble al escribir y sólo paga si las
// llamadas que comparten prefijo se separan más de 5 minutos: se decide con los contadores de caché de
// `negocio.uso_de_ia` (AG7). Un prefijo más corto que el mínimo del modelo no se cachea, y no falla: se ve
// en esos contadores.
// ═══════════════════════════════════════════════════════════════════════════════

import { ESPERA_EXTERNA_MS, pedirExterno } from '../http/cliente.ts';
import { redactKey, usageOf } from '../analizadores/nucleo/anthropic.ts';
import type { TokenUsage } from '../analizadores/nucleo/pricing.ts';
import {
  type FalloDelModelo,
  type SituacionDelModelo,
  anotarIncidente,
  clasificarFallo,
  esPasajero,
  nuevaReferencia,
  tecnico,
} from '../fundaciones/fallo-del-modelo.ts';
import { registrarIncidente } from '../incidentes/registro.ts';
import { DIRECCION_DE_LA_API, VERSION_DE_LA_API } from './proveedor.ts';
import { type AgenteNuevo, registrarUso } from './uso.ts';

/** Hasta cuándo un fallo pasajero merece un segundo intento: el mismo número que `generar`. */
export const VENTANA_DE_REINTENTO_MS = 90_000;
/** Un respiro: reintentar en el mismo milisegundo contra un servicio saturado no ayuda. */
export const PAUSA_ANTES_DE_REINTENTAR_MS = 3_000;

/** Lo que puede ir en una cabecera: ASCII visible, sin espacios. Una llave de Anthropic lo es entera. */
const LLAVE_QUE_VIAJA = /^[\x21-\x7E]+$/;

/**
 * Los modelos que rechazan `output_config.effort` con un 400. Un prefijo y no una lista de constantes: el
 * día que alguien use otra versión de Haiku 4.5, la regla lo cubre igual.
 */
const SIN_ESFUERZO: readonly string[] = ['claude-haiku-4-5'];

/**
 * Los dos cortes por largo: el techo pedido, o la ventana de contexto del modelo llena. Un arreglo y no un
 * `Set`: nada mutable en el nivel superior de un módulo del servidor (`ADR-0703`).
 */
const CORTES_POR_LARGO: readonly string[] = ['max_tokens', 'model_context_window_exceeded'];

/** Un mensaje de la conversación. `content` va tal cual: un texto, o los bloques de un turno anterior. */
export interface MensajeAlModelo {
  role: 'user' | 'assistant';
  content: string | readonly Record<string, unknown>[];
}

/**
 * El proveedor admite hasta 20 herramientas con `strict: true` por pedido; con más contesta 400 («Too many
 * strict tools»). Lo encontró la primera evaluación real del cerebro (2026-10-05), con 31 para el admin, y
 * ninguna prueba con la red falseada lo podía ver. Lo vigila la 212 sobre el juego más grande del cerebro.
 */
export const MAXIMO_DE_HERRAMIENTAS_ESTRICTAS = 20;

/**
 * Una herramienta que el agente ofrece. Con `estricta`, sale con `strict: true` y el proveedor garantiza la
 * forma de lo que el modelo escribe: su esquema lleva `additionalProperties: false` y `required` en cada
 * objeto, y ninguna de las restricciones que el modo estricto no admite (ver el encabezado), o el proveedor
 * contesta 400. Sin `estricta`, la forma la valida quien ejecuta la herramienta.
 */
export interface HerramientaDelModelo {
  nombre: string;
  descripcion: string;
  esquema: Record<string, unknown>;
  estricta: boolean;
}

/** Un bloque de la respuesta, como llegó. Se lee por `type` y por `name`, nunca por posición. */
export interface BloqueDelModelo {
  readonly type?: string;
  readonly text?: string;
  readonly name?: string;
  readonly input?: unknown;
  readonly [campo: string]: unknown;
}

/** Una respuesta que llegó con un 200, sin truncar ni declinar: lo que recibe el lector del agente. */
export interface MensajeDelModelo {
  /** Los bloques en su orden, `thinking` incluidos: el bucle del cerebro los devuelve sin tocar. */
  readonly contenido: readonly BloqueDelModelo[];
  readonly motivoDeCorte: string | null;
}

/** Lo que dice el lector: el dato, o por qué la respuesta no sirve. */
export type Lectura<T> = { tipo: 'datos'; datos: T } | { tipo: 'sin_texto' } | { tipo: 'sin_estructura' };

export interface PedidoAlModelo<T> {
  agente: AgenteNuevo;
  /** De `./modelos.ts`. */
  modelo: string;
  /** La llave de ESA empresa, sin valor por omisión (`ADR-0908`). */
  llave: string;
  orgId: string;
  /** Quién pidió. `null` en el cron. Bajo delegación no se llama: lo que gasta se apaga (`D-17`, `T-25`). */
  usuarioId: string | null;
  /**
   * El hilo o el análisis: la referencia de la fila del uso cuando sale bien, y también cuando falla con
   * `los_agrega_quien_llama` (no hay un incidente propio al que apuntar).
   */
  ref?: string | null;
  /** El paso, en palabras, para el incidente: «herramienta 3». */
  donde?: string;
  /** `max_tokens`. Cubre pensamiento y texto. */
  techo: number;
  /** El prefijo estable. Va como `system`, marcado para el caché. */
  instrucciones: string;
  mensajes: readonly MensajeAlModelo[];
  herramientas?: readonly HerramientaDelModelo[];
  /** Un JSON Schema: la respuesta sale como JSON que lo cumple (`output_config.format`). */
  formato?: Record<string, unknown>;
  /** `output_config.effort`. Sin él, el del modelo (`high` en `claude-sonnet-5-5`). A Haiku 4.5 no viaja. */
  esfuerzo?: 'low' | 'medium' | 'high';
  /** `tool_choice`. Sólo `auto` o `none`, y sólo con herramientas; los forzados son un 400 en `claude-sonnet-5-5`. */
  herramientasPermitidas?: 'auto' | 'none';
  /** Marca para el caché también la cola de la conversación (`cache_control` de primer nivel). */
  cachearLaConversacion?: boolean;
  /** El tope de toda la llamada, reintento incluido. Nunca más que `ESPERA_EXTERNA_MS`. */
  espera?: number;
  /** Quién escribe el incidente: ver «LOS INCIDENTES DE UNA TAREA DEL CRON» arriba. */
  incidentes?: 'cada_llamada' | 'los_agrega_quien_llama';
  /**
   * Decide si la respuesta sirve. Si dice que no, la llamada es un fallo con su situación, y así queda en
   * el uso: una fila `ok` sobre una respuesta que el agente tiró mentiría.
   */
  leer: (mensaje: MensajeDelModelo) => Lectura<T>;
}

export type ResultadoDeLlamada<T> =
  | {
      tipo: 'datos';
      datos: T;
      uso: TokenUsage;
      milisegundos: number;
      modelo: string;
      /** El primer intento falló y el reintento lo salvó: la situación de ese primero, o `null`. */
      salvadoDe: SituacionDelModelo | null;
    }
  | {
      tipo: 'fallo';
      /** La rama tal cual, para quien tenga que distinguir (un `declino` no es un error nuestro). */
      fallo: FalloDelModelo;
      situacion: SituacionDelModelo;
      /**
       * La MISMA de la línea de registro, del incidente y de la fila del uso. Con
       * `los_agrega_quien_llama` no hay línea ni incidente, y la fila del uso lleva la referencia del
       * pedido: ésta es una referencia nueva, sólo para quien agrega.
       */
      ref: string;
      tecnico: string;
      /** `null` si el proveedor no contestó; con valores si contestó y la respuesta no sirvió. */
      uso: TokenUsage | null;
      milisegundos: number;
      modelo: string;
    };

/**
 * El reloj y la pausa del reintento. Una costura, como la de `barrerTodo` (`lib/negocio/barrido.ts`):
 * sin ella, probar la ventana exigiría una prueba de minutos y cada reintento costaría tres segundos.
 */
export interface Costuras {
  ahora: () => number;
  pausa: (ms: number) => Promise<void>;
}

const COSTURAS_REALES: Costuras = {
  ahora: () => Date.now(),
  pausa: (ms) => new Promise<void>((listo) => setTimeout(listo, ms)),
};

interface RespuestaDeAnthropic {
  content?: unknown;
  stop_reason?: unknown;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

type Intento<T> =
  | { tipo: 'datos'; datos: T; uso: TokenUsage }
  | { tipo: 'fallo'; fallo: FalloDelModelo; uso: TokenUsage | null };

/**
 * Llama al modelo. **No lanza**: todo final vuelve como `datos` o como `fallo`, con su situación.
 *
 * @param costuras El reloj y la pausa. En producción, los de verdad.
 */
export async function llamarAlModelo<T>(
  pedido: PedidoAlModelo<T>,
  costuras: Costuras = COSTURAS_REALES,
): Promise<ResultadoDeLlamada<T>> {
  const desde = costuras.ahora();
  /* Nunca más que `ESPERA_EXTERNA_MS` (ver «LO QUE NO HACE» en el encabezado) —lo infinito se recorta al
     tope—, y siempre un entero: `AbortSignal.timeout` no acepta otra cosa. `NaN` es «no queda tiempo». */
  const pedida = pedido.espera ?? ESPERA_EXTERNA_MS;
  const espera = Number.isNaN(pedida) ? 0 : Math.floor(Math.min(pedida, ESPERA_EXTERNA_MS));
  const cuerpo = cuerpoDelPedido(pedido);
  const anotaCadaUno = (pedido.incidentes ?? 'cada_llamada') === 'cada_llamada';

  /* ── LO QUE YA SE SABE QUE FALLA, SIN GASTAR UN PEDIDO ─────────────────
   *
   *   · Sin tiempo. Quien calcula la espera con lo que le queda (el cron: «lo que quede menos 15 s») puede
   *     llegar sin nada: con cero, el pedido cortaría antes de salir; negativa, `AbortSignal.timeout`
   *     tiraría un `RangeError` que saldría como una conexión cortada —`IA-CONEXION`, que culpa a la
   *     red—. Es un tiempo agotado, y se dice con la frase que lo clasifica así.
   *   · Una llave que no puede viajar en una cabecera: un salto de línea, o un espacio de ancho cero
   *     pegado con ella desde un documento. `fetch` tiraría antes de salir a la red, y eso también se
   *     leería como la conexión. Es la llave, `IA-LLAVE`: hay que volver a cargarla, no esperar. */
  let intento: Intento<T> =
    espera < 1
      ? {
          tipo: 'fallo',
          fallo: { tipo: 'sin_respuesta', causa: 'se agotó el tiempo de espera antes de empezar (el tope es 0 s)' },
          uso: null,
        }
      : !LLAVE_QUE_VIAJA.test(pedido.llave)
        ? {
            tipo: 'fallo',
            fallo: {
              tipo: 'rechazado',
              estado: 0,
              codigo: 'authentication_error',
              motivo: 'la llave tiene caracteres que no pueden ir en una cabecera',
            },
            uso: null,
          }
        : await unIntento(pedido, cuerpo, espera);
  // Hasta la última respuesta del modelo, sin las escrituras del incidente y del uso que vienen después.
  let milisegundos = costuras.ahora() - desde;
  let salvadoDe: SituacionDelModelo | null = null;

  if (intento.tipo === 'fallo' && esPasajero(intento.fallo)) {
    /* ── UN SEGUNDO INTENTO, Y SOLO UNO ────────────────────────────────────
     *
     * Sólo si el fallo llegó TEMPRANO, medido desde el primer intento: antes de la ventana de `generar` y
     * antes de la mitad de lo que deja la pausa. Así el segundo tiene al menos tanto tiempo como el que se
     * llevó el primero, y usa lo que QUEDA del tope, no uno entero: quien espera tiene su techo, y el
     * reintento tiene que caber adentro. */
    const transcurrido = costuras.ahora() - desde;
    if (transcurrido <= Math.min(VENTANA_DE_REINTENTO_MS, (espera - PAUSA_ANTES_DE_REINTENTAR_MS) / 2)) {
      const primero = intento.fallo;
      const situacion = clasificarFallo(primero);
      // La referencia nace acá: el aviso del registro y el incidente salvado comparten la misma.
      const ref = nuevaReferencia();
      console.warn(`${pedido.agente}: reintento tras ${situacion} · ref ${ref} a los ${Math.round(transcurrido / 1000)} s`);
      await costuras.pausa(PAUSA_ANTES_DE_REINTENTAR_MS);
      intento = await unIntento(pedido, cuerpo, Math.max(1, Math.floor(espera - (costuras.ahora() - desde))));
      milisegundos = costuras.ahora() - desde;
      /* Si salió bien, la persona no vio nada, pero el Panel de Incidentes lo anota —en gris, como
         «salvado»—: un proveedor que falla seguido se ve aunque nadie se queje. Si salió mal, se anota
         ESE fallo, abajo, con su propia referencia: es la que va a ver la persona. */
      if (intento.tipo === 'datos') {
        salvadoDe = situacion;
        if (anotaCadaUno) {
          await registrarIncidente({
            orgId: pedido.orgId,
            ref,
            situacion,
            origen: pedido.agente,
            ...(pedido.donde ? { donde: pedido.donde } : {}),
            usuarioId: pedido.usuarioId,
            tecnico: tecnico(primero),
            salvado: true,
          });
        }
      }
    }
  }

  if (intento.tipo === 'datos') {
    await registrarUso({
      orgId: pedido.orgId,
      agente: pedido.agente,
      modelo: pedido.modelo,
      uso: intento.uso,
      duracionMs: milisegundos,
      resultado: 'ok',
      usuarioId: pedido.usuarioId,
      ref: pedido.ref ?? null,
    });
    return { tipo: 'datos', datos: intento.datos, uso: intento.uso, milisegundos, modelo: pedido.modelo, salvadoDe };
  }

  // La línea de registro y el incidente; después la fila del uso, con LA MISMA referencia.
  const anotado = anotaCadaUno
    ? await anotarIncidente(intento.fallo, {
        origen: pedido.agente,
        orgId: pedido.orgId,
        ...(pedido.donde ? { donde: pedido.donde } : {}),
        usuarioId: pedido.usuarioId,
      })
    : { situacion: clasificarFallo(intento.fallo), ref: nuevaReferencia(), tecnico: tecnico(intento.fallo) };
  await registrarUso({
    orgId: pedido.orgId,
    agente: pedido.agente,
    modelo: pedido.modelo,
    uso: intento.uso,
    duracionMs: milisegundos,
    resultado: anotado.situacion,
    usuarioId: pedido.usuarioId,
    // Sin incidente propio, la fila apunta a lo que se pidió (el análisis, el plan), no a una referencia suelta.
    ref: anotaCadaUno ? anotado.ref : (pedido.ref ?? null),
  });
  return { tipo: 'fallo', fallo: intento.fallo, ...anotado, uso: intento.uso, milisegundos, modelo: pedido.modelo };
}

/** El cuerpo. Se arma una vez y viaja igual en el reintento: un reintento no es otra pregunta. */
function cuerpoDelPedido(p: PedidoAlModelo<unknown>): Record<string, unknown> {
  const cuerpo: Record<string, unknown> = {
    model: p.modelo,
    max_tokens: p.techo,
    system: [{ type: 'text', text: p.instrucciones, cache_control: { type: 'ephemeral' } }],
    messages: p.mensajes,
  };
  const herramientas = p.herramientas ?? [];
  if (herramientas.length > 0) {
    cuerpo['tools'] = herramientas.map((h, i) => ({
      name: h.nombre,
      description: h.descripcion,
      input_schema: h.esquema,
      ...(h.estricta ? { strict: true } : {}),
      // La última marca el corte: las herramientas van primero en el prefijo y no cambian entre las
      // rondas de una misma pregunta.
      ...(i === herramientas.length - 1 ? { cache_control: { type: 'ephemeral' } } : {}),
    }));
  }
  if (p.herramientasPermitidas && herramientas.length > 0) cuerpo['tool_choice'] = { type: p.herramientasPermitidas };
  const salida: Record<string, unknown> = {};
  if (p.formato) salida['format'] = { type: 'json_schema', schema: p.formato };
  // A Haiku 4.5 no se le manda: lo rechaza con un 400, y quien pide clasificar barato pide `low` de reflejo.
  if (p.esfuerzo && !SIN_ESFUERZO.some((m) => p.modelo.startsWith(m))) salida['effort'] = p.esfuerzo;
  if (Object.keys(salida).length > 0) cuerpo['output_config'] = salida;
  if (p.cachearLaConversacion) cuerpo['cache_control'] = { type: 'ephemeral' };
  return cuerpo;
}

async function unIntento<T>(pedido: PedidoAlModelo<T>, cuerpo: Record<string, unknown>, espera: number): Promise<Intento<T>> {
  const r = await pedirExterno<RespuestaDeAnthropic>(DIRECCION_DE_LA_API, {
    metodo: 'POST',
    cabeceras: { 'x-api-key': pedido.llave, 'anthropic-version': VERSION_DE_LA_API },
    cuerpo,
    espera,
  });

  /* Las dos ramas sin respuesta se traducen sin tocar lo que las clasifica: el motivo del servicio (sin
     él, la falta de saldo se lee como un 400 cualquiera) y la causa, cuyo comienzo «se agotó el tiempo de
     espera» es lo único que separa IA-TIEMPO de IA-CONEXION. Lo único que se quita es la llave
     (`redactKey`): una que no puede ir en una cabecera ya no llega acá (`LLAVE_QUE_VIAJA`), pero un
     mensaje de la red, de un intermediario o del proveedor que la repita no puede llevarla al registro. */
  if (r.tipo === 'rechazado') {
    return {
      tipo: 'fallo',
      fallo: {
        tipo: 'rechazado',
        estado: r.estado,
        codigo: r.codigo,
        motivo: r.detalle === undefined ? null : redactKey(r.detalle, pedido.llave),
      },
      uso: null,
    };
  }
  if (r.tipo === 'sin_respuesta') {
    return { tipo: 'fallo', fallo: { tipo: 'sin_respuesta', causa: redactKey(r.causa, pedido.llave) }, uso: null };
  }

  const datos: RespuestaDeAnthropic = typeof r.datos === 'object' && r.datos !== null ? r.datos : {};
  // Contestó: se pagó, sirva o no. Los cuatro contadores, con cero donde el proveedor no mandó el campo.
  const uso = usageOf({ usage: datos.usage });

  /* El motivo de corte, ANTES de leer: un truncado leído como estructura inválida manda a revisar el
     esquema en vez de subir el techo o acortar la conversación —y un `tool_use` cortado podría leerse
     como un dato con argumentos a medias—, y un rechazo por políticas llega con HTTP 200. Truncado es
     tanto el techo pedido como la ventana de contexto llena (`model_context_window_exceeded`). */
  const motivoDeCorte = typeof datos.stop_reason === 'string' ? datos.stop_reason : null;
  if (motivoDeCorte !== null && CORTES_POR_LARGO.includes(motivoDeCorte)) return { tipo: 'fallo', fallo: { tipo: 'truncado' }, uso };
  if (motivoDeCorte === 'refusal') return { tipo: 'fallo', fallo: { tipo: 'declino' }, uso };

  const contenido = Array.isArray(datos.content)
    ? (datos.content.filter((b: unknown) => typeof b === 'object' && b !== null) as BloqueDelModelo[])
    : [];
  let lectura: Lectura<T>;
  try {
    lectura = pedido.leer({ contenido, motivoDeCorte });
  } catch {
    // Un lector que tropieza con la forma de la respuesta dice lo mismo que uno que la rechaza.
    lectura = { tipo: 'sin_estructura' };
  }
  if (lectura.tipo !== 'datos') return { tipo: 'fallo', fallo: lectura, uso };
  return { tipo: 'datos', datos: lectura.datos, uso };
}

/** La salida de un pedido con `formato`: el JSON del texto, con el pensamiento afuera. */
export function leerJson(m: MensajeDelModelo): Lectura<unknown> {
  const texto = m.contenido
    .filter((b) => b.type === 'text')
    .map((b) => (typeof b.text === 'string' ? b.text : ''))
    .join('')
    .trim();
  if (texto.length === 0) return { tipo: 'sin_texto' };
  try {
    return { tipo: 'datos', datos: JSON.parse(texto) as unknown };
  } catch {
    return { tipo: 'sin_estructura' };
  }
}

/**
 * La entrada de la herramienta `nombre`. Por NOMBRE y no por tipo: con dos ofrecidas, «el primer
 * `tool_use`» tomaría la equivocada (`lib/auditor/modelo.ts`, el mismo criterio).
 */
export function leerHerramienta(nombre: string): (m: MensajeDelModelo) => Lectura<Record<string, unknown>> {
  return (m) => {
    const entrada = m.contenido.find((b) => b.type === 'tool_use' && b.name === nombre)?.input;
    if (entrada === null || typeof entrada !== 'object' || Array.isArray(entrada)) return { tipo: 'sin_estructura' };
    return { tipo: 'datos', datos: entrada as Record<string, unknown> };
  };
}
