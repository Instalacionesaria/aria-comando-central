// Una pregunta al cerebro, de punta a punta: el ciclo de `docs/OTROS/agentes/01-LA-ARQUITECTURA.md`, AG-04.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL ORDEN, Y POR QUÉ ASÍ
//
//   1 · Transacción CORTA: el hilo, el tope bajo candado y la reserva de la pregunta (`./conversaciones.ts`).
//   2 · El bucle del modelo, FUERA de toda transacción (AG-05): una conexión de cinco retenida durante dos
//       minutos de espera deja a la empresa entera esperando. Cada herramienta que el modelo pide abre su
//       propia `conOrganizacion` corta, en serie.
//   3 · La validación de `responder` contra lo que se leyó (`./respuesta.ts`).
//   4 · Transacción CORTA: la respuesta y la evidencia. Si falló, la pregunta queda `fallida`: cuenta para
//       el tope sólo si el proveedor contestó (se pagó). Si lo que falla es una escritura, la pregunta
//       también queda fallida, y una respuesta ya validada llega igual aunque no se haya podido guardar.
//
// El uso de cada ronda lo anota el transporte (`../llamada.ts`), una fila por llamada; el incidente de una
// ronda que falla, también. Lo que el transporte no ve —que el modelo nunca contestó con `responder`, o que
// lo hizo sin la forma— es un `IA-ESTRUCTURA` que se anota acá.
//
// ── LAS RONDAS ───────────────────────────────────────────────────────────────
//
// Hasta seis. En cada una el modelo puede pedir herramientas o contestar con `responder`. El historial de
// una pregunta es de sólo agregar —«preserved thinking» de `claude-sonnet-5-5`—: cada turno vuelve tal
// cual llegó, bloques `thinking` incluidos, y las instrucciones y las herramientas no cambian entre rondas.
// No se puede forzar `responder` (el modelo rechaza `tool_choice` forzado con un 400): si contesta con texto
// suelto, o se llega a la última ronda, esa ronda pide la salida con el formato de `responder`
// (`output_config.format`) y apaga las herramientas con `tool_choice: none`, que se siguen ofreciendo para
// no cambiar el prefijo.
//
// Los tiempos: 120 s por llamada, 240 s en total, dentro de una función de 300 (`maxDuration` de la ruta).
// ═══════════════════════════════════════════════════════════════════════════════

import { conOrganizacion } from '../../datos/contexto.ts';
import { type FalloDelModelo, anotarIncidente } from '../../fundaciones/fallo-del-modelo.ts';
import { type BloqueDelModelo, type MensajeAlModelo, llamarAlModelo } from '../llamada.ts';
import { MODELO_DEL_EXECUTIVE } from '../modelos.ts';
import { type ContextoDeHerramienta, type DatosDeLaRuta, ejecutarHerramienta, herramientasPara, paraElModelo } from './herramientas.ts';
import { instruccionesDelCerebro, type DatosDeLasInstrucciones } from './prompt.ts';
import { type Evidencia, NOMBRE_DE_RESPONDER, RESPONDER, type RespuestaValidada, validarRespuesta } from './respuesta.ts';
import { guardarRespuesta, marcarFallida, reservarPregunta, type OrigenDelHilo, type TurnoAnterior } from './conversaciones.ts';
import { cerrarLugar } from './topes.ts';
import { estadoDeTope, type EstadoDelCerebro } from './estado.ts';

export const RONDAS = 6;
export const ESPERA_POR_LLAMADA_MS = 120_000;
export const ESPERA_TOTAL_MS = 240_000;
/** `max_tokens` de cada ronda: cubre pensamiento y texto. */
export const TECHO_DEL_CEREBRO = 12_000;
/** Por debajo de esto no se empieza una ronda: terminaría cortada y se pagaría igual. */
export const ESPERA_MINIMA_MS = 5_000;

/** Cómo se ve la mascota de la respuesta. La decide el servidor, no el modelo (`T-14`, AG-55). */
export type EstadoDeLaMascota = 'hallazgo' | 'neutral' | 'sin-conexion';

export interface Pregunta {
  orgId: string;
  usuarioId: string;
  zona: string;
  llave: string;
  /** Las claves y nombres de las secciones que la persona ve: lo que se le ofrece y adónde puede ir. */
  secciones: readonly { clave: string; nombre: string }[];
  origen: OrigenDelHilo;
  /** La sección de la caja del pie; `null` en el Inicio. */
  seccion: string | null;
  /** El período que está mirando la pantalla, ya validado. */
  periodo: string | null;
  contexto: Record<string, unknown>;
  hiloId: string | null;
  texto: string;
  /** La fecha local de la empresa (`AAAA-MM-DD`), para las instrucciones. */
  hoy: string;
  /** Lo que la ruta resolvió en identidad: por qué el auditor no audita, el estado de las integraciones. */
  deLaRuta: DatosDeLaRuta;
}

export type ResultadoDePreguntar =
  | {
      tipo: 'respondida';
      hiloId: string;
      respuesta: RespuestaValidada;
      /** La evidencia completa, para el desplegable de la respuesta (AG-48). En el hilo se guarda sin nombres. */
      evidencia: Evidencia[];
      mascota: EstadoDeLaMascota;
    }
  | { tipo: 'tope'; estado: Extract<EstadoDelCerebro, { tipo: 'tope' }> }
  | { tipo: 'no_encontrado' }
  /** Ninguna sección que la persona ve tiene herramientas: no hay qué leer, y no se llama al modelo. */
  | { tipo: 'sin_herramientas' }
  | { tipo: 'fallo'; hiloId: string; situacion: string; ref: string; detalle: string; mascota: EstadoDeLaMascota }
  /** Algo que no es el modelo lanzó (una escritura de la base): la pregunta quedó fallida, sin contar. */
  | { tipo: 'error_interno'; hiloId: string };

/** Las situaciones que son del proveedor y no de la respuesta: la mascota sin conexión. */
const SIN_CONEXION: readonly string[] = ['IA-CONEXION', 'IA-TIEMPO', 'IA-SATURADO'];

/** Los mensajes de la primera ronda: los turnos anteriores reducidos y, al final, la pregunta. */
export function mensajesIniciales(anteriores: readonly TurnoAnterior[], pregunta: string): MensajeAlModelo[] {
  return [
    ...anteriores.flatMap((t): MensajeAlModelo[] => [
      { role: 'user', content: t.pregunta },
      { role: 'assistant', content: t.respuesta },
    ]),
    { role: 'user', content: pregunta },
  ];
}

const esBloque = (b: BloqueDelModelo, tipo: string) => b.type === tipo;

/** El texto de un turno que contestó con el formato: el JSON de `responder`, o `undefined`. */
function jsonDelTexto(contenido: readonly BloqueDelModelo[]): unknown {
  const texto = contenido
    .filter((b) => esBloque(b, 'text'))
    .map((b) => b.text ?? '')
    .join('');
  try {
    return JSON.parse(texto);
  } catch {
    return undefined;
  }
}

export async function preguntar(p: Pregunta): Promise<ResultadoDePreguntar> {
  const claves = p.secciones.map((s) => s.clave);
  const ofrecidas = herramientasPara(claves, p.seccion, p.deLaRuta.integraciones !== null);
  // AG-43: sin datos que leer no se llama al modelo. Antes de reservar: no gasta ni cuenta.
  if (ofrecidas.length === 0) return { tipo: 'sin_herramientas' };

  // ── 1 · Reserva, en una transacción corta ─────────────────────────────────
  const reserva = await conOrganizacion(p.orgId, () =>
    reservarPregunta({
      usuarioId: p.usuarioId,
      zona: p.zona,
      hiloId: p.hiloId,
      texto: p.texto,
      origen: p.origen,
      seccion: p.seccion,
      contexto: p.contexto,
    }),
  );
  if (reserva.tipo === 'no_encontrado') return { tipo: 'no_encontrado' };
  if (reserva.tipo === 'tope') return { tipo: 'tope', estado: estadoDeTope(reserva.usado) };
  const { hiloId, preguntaId, lugarId } = reserva;

  /* Desde acá la pregunta está reservada, y nada la puede dejar así: todo lo que sigue va dentro de un
     `try` que, si algo lanza, la marca fallida —sin contar, salvo que ya se haya pagado— y contesta con lo
     que se sabe en vez de un 500 pelado. Una función que la plataforma corta no llega a este `catch`: su
     reserva vence sola a los diez minutos (`./topes.ts`). */
  let pagada = false;
  try {
    return await elBucle(p, ofrecidas, reserva.anteriores, hiloId, preguntaId, lugarId, (v) => (pagada ||= v));
  } catch (e) {
    console.error(`cerebro: la pregunta ${preguntaId} se cortó · ${e instanceof Error ? e.message : 'desconocido'}`);
    try {
      await conOrganizacion(p.orgId, () => marcarFallida(preguntaId, lugarId, null, null, pagada));
    } catch (e2) {
      console.error(`cerebro: tampoco se pudo marcar fallida ${preguntaId} · ${e2 instanceof Error ? e2.message : 'desconocido'}`);
    }
    return { tipo: 'error_interno', hiloId };
  }
}

/** Las etapas 2 a 4: el bucle del modelo, la validación y el guardado. */
async function elBucle(
  p: Pregunta,
  ofrecidas: ReturnType<typeof herramientasPara>,
  anteriores: readonly TurnoAnterior[],
  hiloId: string,
  preguntaId: string,
  lugarId: string,
  sePago: (v: boolean) => void,
): Promise<ResultadoDePreguntar> {
  let pagada = false;
  const pago = (v: boolean) => {
    pagada ||= v;
    sePago(v);
  };
  /** Una pregunta que no llegó a respuesta: `fallida`, y cuenta para el tope sólo si se pagó. */
  const fallar = async (situacion: string, ref: string, detalle: string): Promise<ResultadoDePreguntar> => {
    await conOrganizacion(p.orgId, () => marcarFallida(preguntaId, lugarId, situacion, ref, pagada));
    return { tipo: 'fallo', hiloId, situacion, ref, detalle, mascota: SIN_CONEXION.includes(situacion) ? 'sin-conexion' : 'neutral' };
  };
  /** Lo que el transporte no puede ver: el modelo contestó, pero nunca con `responder` o sin su forma. */
  const anotar = async (fallo: FalloDelModelo, donde: string): Promise<ResultadoDePreguntar> => {
    const a = await anotarIncidente(fallo, { origen: 'executive', orgId: p.orgId, donde, usuarioId: p.usuarioId });
    return fallar(a.situacion, a.ref, a.tecnico);
  };

  // ── 2 · El bucle, fuera de toda transacción ───────────────────────────────
  const claves = p.secciones.map((s) => s.clave);
  const herramientas = [...ofrecidas.map(paraElModelo), RESPONDER];
  const desde: DatosDeLasInstrucciones['desde'] =
    p.origen === 'pie' && p.seccion !== null ? { origen: 'pie', seccion: p.seccion, periodo: p.periodo } : { origen: 'inicio' };
  const instrucciones = instruccionesDelCerebro({ hoy: p.hoy, zona: p.zona, secciones: p.secciones, desde });
  const mensajes = mensajesIniciales(anteriores, p.texto);
  const contextoDeHerramienta: ContextoDeHerramienta = { zona: p.zona, usuarioId: p.usuarioId, secciones: claves, deLaRuta: p.deLaRuta };
  const evidencias: Evidencia[] = [];
  const inicio = Date.now();
  let conFormato = false;

  for (let ronda = 1; ronda <= RONDAS; ronda++) {
    conFormato ||= ronda === RONDAS;
    // Sin tiempo para una llamada de verdad, no se paga una que va a terminar cortada.
    const queda = ESPERA_TOTAL_MS - (Date.now() - inicio);
    if (queda < ESPERA_MINIMA_MS) {
      return anotar(
        { tipo: 'sin_respuesta', causa: `se agotó el tiempo de espera: quedaban ${Math.round(queda / 1000)} s del tope de la pregunta` },
        `el cerebro, antes de la ronda ${ronda}`,
      );
    }
    const r = await llamarAlModelo({
      agente: 'executive',
      modelo: MODELO_DEL_EXECUTIVE,
      llave: p.llave,
      orgId: p.orgId,
      usuarioId: p.usuarioId,
      ref: hiloId,
      donde: `el cerebro, ronda ${ronda}`,
      techo: TECHO_DEL_CEREBRO,
      instrucciones,
      mensajes,
      herramientas,
      herramientasPermitidas: conFormato ? 'none' : 'auto',
      ...(conFormato ? { formato: RESPONDER.esquema } : {}),
      esfuerzo: 'medium',
      espera: Math.min(ESPERA_POR_LLAMADA_MS, queda),
      leer: (m) => ({ tipo: 'datos', datos: m }),
    });
    if (r.tipo === 'fallo') {
      // Una respuesta que llegó y no sirvió (truncada, declinada) se pagó.
      pago(r.uso !== null);
      return fallar(r.situacion, r.ref, r.tecnico);
    }
    pago(true);
    const contenido = r.datos.contenido;

    // ¿Contestó? Con la herramienta, o con el formato en la ronda que lo pidió.
    const responder = contenido.find((b) => esBloque(b, 'tool_use') && b.name === NOMBRE_DE_RESPONDER);
    const entrada = responder ? responder.input : conFormato ? jsonDelTexto(contenido) : undefined;
    if (entrada !== undefined) {
      const v = validarRespuesta(entrada, evidencias, claves);
      if (v.tipo === 'invalida') return anotar({ tipo: 'sin_estructura' }, `el cerebro contestó sin la forma de responder: ${v.motivo}`);
      // ── 4 · La respuesta, en una transacción corta ─────────────────────────
      const respuesta = v.respuesta;
      try {
        await conOrganizacion(p.orgId, () => guardarRespuesta(hiloId, preguntaId, lugarId, respuesta, evidencias));
      } catch (e) {
        /* Se pagó y está validada: la persona la recibe igual, y se le dice que no quedó en el hilo. La
           pregunta cuenta para el tope, porque se respondió. */
        console.error(`cerebro: no se pudo guardar la respuesta de ${preguntaId} · ${e instanceof Error ? e.message : 'desconocido'}`);
        respuesta.avisos.push('Esta respuesta no se pudo guardar en el hilo: cópiala si la necesitas.');
        try {
          await conOrganizacion(p.orgId, () => cerrarLugar(lugarId, 'respondida'));
        } catch {
          // Si tampoco se puede cerrar, la reserva vence sola a los diez minutos.
        }
      }
      return { tipo: 'respondida', hiloId, respuesta, evidencia: evidencias, mascota: respuesta.cifras.length > 0 ? 'hallazgo' : 'neutral' };
    }
    if (conFormato) return anotar({ tipo: 'sin_estructura' }, 'el cerebro no contestó con el formato de responder');

    // El turno del modelo vuelve tal cual llegó: sólo agregar.
    mensajes.push({ role: 'assistant', content: contenido as readonly Record<string, unknown>[] });
    const pedidos = contenido.filter((b) => esBloque(b, 'tool_use'));
    if (pedidos.length === 0) {
      // Texto suelto sin `responder`: la ronda siguiente pide el formato.
      conFormato = true;
      mensajes.push({ role: 'user', content: 'Entrega ahora la respuesta final, con la forma de «responder».' });
      continue;
    }
    const resultados: Record<string, unknown>[] = [];
    for (const pedido of pedidos) {
      let resultado;
      try {
        // Cada herramienta, en su transacción corta y en serie: el agrupador tiene cinco conexiones.
        resultado = await conOrganizacion(p.orgId, () => ejecutarHerramienta(String(pedido.name), pedido.input, ofrecidas, contextoDeHerramienta));
      } catch (e) {
        console.error(`cerebro: la herramienta ${String(pedido.name)} falló · ${e instanceof Error ? e.message : 'desconocido'}`);
        resultado = { tipo: 'error' as const, mensaje: 'La herramienta no pudo leer los datos ahora.' };
      }
      if (resultado.tipo === 'datos') {
        const ev: Evidencia = {
          id: `ev-${evidencias.length + 1}`,
          herramienta: String(pedido.name),
          argumentos: (pedido.input ?? {}) as Record<string, unknown>,
          datos: resultado.datos,
        };
        evidencias.push(ev);
        resultados.push({ type: 'tool_result', tool_use_id: pedido.id, content: JSON.stringify({ ev: ev.id, datos: ev.datos }) });
      } else {
        resultados.push({ type: 'tool_result', tool_use_id: pedido.id, is_error: true, content: resultado.mensaje });
      }
    }
    mensajes.push({ role: 'user', content: resultados });
  }
  // No se llega: la última ronda pide el formato y vuelve en cualquier caso.
  return anotar({ tipo: 'sin_estructura' }, 'el cerebro se quedó sin rondas');
}
