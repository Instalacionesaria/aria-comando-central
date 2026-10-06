'use client';

// La conversación con el cerebro, para React: el chat del Inicio y el panel de la caja del pie la usan igual,
// cada uno con su ruta (`docs/OTROS/agentes/03-EL-CEREBRO.md`, AG-40, AG-51 y AG-52).
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE SE DIBUJA SALE DEL SERVIDOR
//
// Cada turno del cerebro es lo que devolvió el POST —la respuesta ya validada contra la evidencia— o lo que
// devuelve el GET de un hilo guardado. El navegador no arma respuestas ni cifras. Lo único que se dibuja sin
// haber vuelto es la pregunta mientras se espera (`pendiente`), aparte de los turnos, como el chat de ICP &
// Oferta (`components/fundaciones/ChatDeHerramienta.jsx`).
//
// Si una pregunta falla, el servidor igual la guardó —como `fallida`, y con un hilo nuevo si no había uno—,
// y el rechazo no trae el hilo. Así que después de un fallo se vuelven a leer los hilos: el abierto, o el que
// nació con esta pregunta (el que no estaba antes), se reabre, y la pantalla muestra lo que quedó guardado.
// Sin eso, reintentar dejaba dos hilos con el mismo título (lo encontró la revisión de AG7).
//
// ── LA GENERACIÓN ───────────────────────────────────────────────────────────
//
// Cada pedido recuerda en qué «generación» salió, y lo que llega de una anterior se descarta. La generación
// sube al cambiar de ruta —la caja del pie es UNA y pasa de una sección a otra—, al abrir otro hilo y al
// empezar uno nuevo. Sin esto, la respuesta de una pregunta hecha en Sales llegaba dos minutos después a la
// conversación de Creative y la siguiente pregunta iba con el hilo de Sales a la ruta de Creative; y abrir
// otro hilo mientras se esperaba mezclaba los dos (lo encontró la revisión de AG7). Lo que se descarta no se
// pierde: el servidor lo guardó en su hilo.
//
// Las respuestas son enteras, sin flujo (`D-16`): el cliente de la casa no lee en flujo y la regla 30
// prohíbe otro camino al servidor. Preguntar espera al menos lo que la ruta puede tardar (`maxDuration`,
// 300 s); leer y borrar son cortos y esperan lo de siempre.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import { ESPERA_DE_RUTA_LARGA_MS, pedir } from '../http/cliente.ts';
import { RUTA_DE_LOS_TEMAS, textoDelRechazo, type EstadoDelCerebro } from './pantalla.ts';
import type { HiloDeLaBarra } from './hilos-de-la-barra.ts';

/** Una cifra, una recomendación, lo que falta: la forma de `RespuestaValidada` (`./executive/respuesta.ts`). */
export interface RespuestaEnPantalla {
  conclusion: string;
  cifras: { valor: number; que_es: string; muestra: string; periodo: string; fuente: string; ev: string; campo: string }[];
  confianza: { nivel: 'alta' | 'media' | 'baja'; porque: string };
  areas: string[];
  recomendaciones: { texto: string; requiere_validacion_ejecutiva: boolean; ev: string[] }[];
  no_hay_dato: { falta: string; donde_se_carga: string }[];
  siguientes: { tipo: 'abrir'; seccion: string; pestana: string | null; contexto: string | null }[];
  avisos: string[];
}

export interface EvidenciaEnPantalla {
  id: string;
  herramienta: string;
  argumentos: Record<string, unknown>;
  datos: unknown;
}

export type Turno =
  | { tipo: 'persona'; clave: string; texto: string }
  | { tipo: 'cerebro'; clave: string; respuesta: RespuestaEnPantalla; evidencia: EvidenciaEnPantalla[]; mascota: string }
  | { tipo: 'fallo'; clave: string; texto: string };

/** La Reunión de hoy como la ve la persona: la forma de `ReunionEnPantalla` (`./reunion/leer.ts`). */
export interface ReunionEnPantalla {
  dia: string;
  hora: string;
  deHoy: boolean;
  temas: { clave: string; etiqueta: string; origen: string; seccion: string; texto: string }[];
}

export interface PanelDelCerebro {
  estado: EstadoDelCerebro;
  usado: { porPersona: number; usadasPorPersona: number; renuevaEl: string };
  hilos: HiloDeLaBarra[];
  /** Sólo en el Inicio (AG15): `null` si la pasada nunca corrió. */
  reunion?: ReunionEnPantalla | null;
}

export interface MensajeGuardado {
  id: string;
  rol: 'persona' | 'cerebro';
  texto: string;
  estado: string | null;
  respuesta: unknown;
  evidencia: unknown;
  respondeA: string | null;
  situacion: string | null;
  ref: string | null;
}

/**
 * Los mensajes de un hilo guardado, como turnos: cada pregunta, y debajo su respuesta —la que la cita en
 * `respondeA`, no la que sigue en el orden—, o lo que le pasó: que falló, o que todavía no tiene respuesta
 * (una reserva que la plataforma cortó, o una pregunta que se está respondiendo en otra pestaña).
 */
export function turnosDeUnHilo(mensajes: readonly MensajeGuardado[]): Turno[] {
  const respuestas = new Map(mensajes.filter((m) => m.rol === 'cerebro' && m.respondeA).map((m) => [m.respondeA!, m]));
  const turnos: Turno[] = [];
  for (const m of mensajes) {
    if (m.rol !== 'persona') continue;
    turnos.push({ tipo: 'persona', clave: m.id, texto: m.texto });
    const r = respuestas.get(m.id);
    if (r && r.respuesta && typeof r.respuesta === 'object') {
      turnos.push({
        tipo: 'cerebro',
        clave: r.id,
        respuesta: r.respuesta as RespuestaEnPantalla,
        evidencia: Array.isArray(r.evidencia) ? (r.evidencia as EvidenciaEnPantalla[]) : [],
        // El estado de la mascota no se guarda: un turno viejo no la tiene viva, así que basta saber si
        // hubo cifras.
        mascota: (r.respuesta as RespuestaEnPantalla).cifras?.length > 0 ? 'hallazgo' : 'neutral',
      });
    } else if (m.estado === 'fallida') {
      const motivo = m.situacion ? ` (${m.situacion}${m.ref ? `, ${m.ref}` : ''})` : '';
      turnos.push({ tipo: 'fallo', clave: `${m.id}-fallo`, texto: `Esta pregunta no se pudo responder${motivo}.` });
    } else {
      turnos.push({ tipo: 'fallo', clave: `${m.id}-sin`, texto: 'Esta pregunta todavía no tiene respuesta.' });
    }
  }
  return turnos;
}

export interface Cerebro {
  panel: PanelDelCerebro | null;
  /** Si el panel se leyó: `cargando`, `listo`, o el motivo de que no. */
  situacion: 'cargando' | 'listo' | 'error';
  causa: string | null;
  hiloId: string | null;
  turnos: Turno[];
  /** La pregunta que se está respondiendo, o `null`. */
  pendiente: string | null;
  /** Lo que salió mal con la última pregunta, para decirlo junto al campo. */
  error: string | null;
  /** Vuelve a leer el estado y los hilos. */
  recargar: () => Promise<void>;
  abrir: (hilo: string) => Promise<void>;
  nueva: () => void;
  /** Pregunta. `false` si no llegó una respuesta y la pregunta tiene que volver al campo. */
  preguntar: (texto: string, periodo: string | null) => Promise<boolean>;
  borrar: (hilo: string) => Promise<void>;
  /** Abre un tema de la Reunión de hoy como conversación y la muestra (AG-74). Sólo el Inicio tiene temas. */
  abrirTema: (clave: string) => Promise<void>;
}

/**
 * La conversación con la ruta `ruta` (`/api/executive` o la caja de una sección). Con `ruta` nula no pide
 * nada: una caja sin sección no tiene a quién preguntar. `alCambiarLosHilos` recibe cada lista nueva, y
 * `alPreguntarOBorrar` avisa que algo cambió en los hilos.
 */
export function usarCerebro(
  ruta: string | null,
  alCambiarLosHilos?: (hilos: readonly HiloDeLaBarra[]) => void,
  alPreguntarOBorrar?: () => void,
): Cerebro {
  const [panel, setPanel] = useState<PanelDelCerebro | null>(null);
  const [situacion, setSituacion] = useState<Cerebro['situacion']>('cargando');
  const [causa, setCausa] = useState<string | null>(null);
  const [hiloId, setHiloId] = useState<string | null>(null);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [pendiente, setPendiente] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const avisos = useRef({ alCambiarLosHilos, alPreguntarOBorrar });
  avisos.current = { alCambiarLosHilos, alPreguntarOBorrar };
  const vivo = useRef(true);
  const generacion = useRef(0);
  const panelLeido = useRef<PanelDelCerebro | null>(null);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);
  /** Si lo que llega es de la generación de quien lo pidió, y el componente sigue montado. */
  const vigente = (de: number) => vivo.current && de === generacion.current;

  const leerPanel = useCallback(async (): Promise<PanelDelCerebro | null> => {
    if (ruta === null) return null;
    const de = generacion.current;
    const r = await pedir<PanelDelCerebro>(ruta);
    if (!vigente(de)) return null;
    if (r.tipo === 'datos') {
      panelLeido.current = r.datos;
      setPanel(r.datos);
      setSituacion('listo');
      setCausa(null);
      avisos.current.alCambiarLosHilos?.(r.datos.hilos);
      return r.datos;
    }
    // Lo que ya se leyó se queda: un corte de red no le borra los hilos a nadie.
    setSituacion((antes) => (antes === 'listo' ? antes : 'error'));
    setCausa(r.tipo === 'rechazado' ? textoDelRechazo(r.codigo, r.detalle) : 'No se pudo contactar al servidor.');
    return null;
  }, [ruta]);

  /* Otra ruta es otra caja —la persona pasó a otra sección—: lo de la anterior no se mezcla, ni lo que
     todavía está en camino. Antes de leer, porque los efectos corren en el orden en que se declaran. */
  useEffect(() => {
    generacion.current += 1;
    panelLeido.current = null;
    setPanel(null);
    setSituacion('cargando');
    setCausa(null);
    setHiloId(null);
    setTurnos([]);
    setPendiente(null);
    setError(null);
  }, [ruta]);

  useEffect(() => {
    void leerPanel();
  }, [leerPanel]);

  /** Lee un hilo y lo muestra, si sigue siendo de esta generación. */
  const mostrarHilo = useCallback(
    async (hilo: string, de: number) => {
      if (ruta === null) return false;
      const r = await pedir<{ mensajes: MensajeGuardado[] }>(`${ruta}?hilo=${encodeURIComponent(hilo)}`);
      if (!vigente(de)) return false;
      if (r.tipo !== 'datos') {
        setError(r.tipo === 'rechazado' ? textoDelRechazo(r.codigo, r.detalle) : 'No se pudo contactar al servidor.');
        return false;
      }
      setHiloId(hilo);
      setTurnos(turnosDeUnHilo(r.datos.mensajes ?? []));
      return true;
    },
    [ruta],
  );

  const abrir = useCallback(
    async (hilo: string) => {
      generacion.current += 1;
      setPendiente(null);
      setError(null);
      await mostrarHilo(hilo, generacion.current);
    },
    [mostrarHilo],
  );

  const nueva = useCallback(() => {
    generacion.current += 1;
    setHiloId(null);
    setTurnos([]);
    setPendiente(null);
    setError(null);
  }, []);

  const preguntar = useCallback(
    async (texto: string, periodo: string | null) => {
      if (ruta === null || pendiente !== null) return false;
      const de = generacion.current;
      const hiloDeLaPregunta = hiloId;
      const antes = new Set((panelLeido.current?.hilos ?? []).map((h) => h.id));
      setError(null);
      setPendiente(texto);
      const r = await pedir<{ tipo: 'respondida'; hiloId: string; respuesta: RespuestaEnPantalla; evidencia: EvidenciaEnPantalla[]; mascota: string }>(ruta, {
        metodo: 'POST',
        cuerpo: { pregunta: texto, hilo: hiloDeLaPregunta, periodo },
        espera: ESPERA_DE_RUTA_LARGA_MS,
      });
      // Otra generación: la persona se fue a otro hilo o a otra sección. Lo que llegó quedó en su hilo.
      if (!vigente(de)) return true;
      setPendiente(null);
      avisos.current.alPreguntarOBorrar?.();
      if (r.tipo !== 'datos') {
        const motivo =
          r.tipo === 'rechazado'
            ? textoDelRechazo(r.codigo, r.detalle)
            : 'No llegó la respuesta del servidor. Puede que la pregunta se haya respondido igual: mira el hilo antes de repetirla.';
        // El estado pudo cambiar (el tope, la llave), y la pregunta pudo quedar guardada como fallida.
        const leido = await leerPanel();
        if (!vigente(de)) return true;
        const hilo = hiloDeLaPregunta ?? leido?.hilos.find((h) => !antes.has(h.id))?.id ?? null;
        if (hilo !== null) await mostrarHilo(hilo, de);
        if (vigente(de)) setError(motivo);
        return false;
      }
      const d = r.datos;
      setHiloId(d.hiloId);
      setTurnos((previos) => [
        ...previos,
        { tipo: 'persona', clave: `${d.hiloId}-p-${previos.length}`, texto },
        { tipo: 'cerebro', clave: `${d.hiloId}-c-${previos.length}`, respuesta: d.respuesta, evidencia: d.evidencia, mascota: d.mascota },
      ]);
      void leerPanel();
      return true;
    },
    [ruta, hiloId, pendiente, leerPanel, mostrarHilo],
  );

  const borrar = useCallback(
    async (hilo: string) => {
      if (ruta === null) return;
      const de = generacion.current;
      const r = await pedir(`${ruta}?hilo=${encodeURIComponent(hilo)}`, { metodo: 'DELETE' });
      if (!vigente(de)) return;
      if (r.tipo !== 'datos') {
        setError(r.tipo === 'rechazado' ? textoDelRechazo(r.codigo, r.detalle) : 'No se pudo contactar al servidor.');
        return;
      }
      avisos.current.alPreguntarOBorrar?.();
      if (hilo === hiloId) nueva();
      void leerPanel();
    },
    [ruta, hiloId, nueva, leerPanel],
  );

  const recargar = useCallback(async () => {
    await leerPanel();
  }, [leerPanel]);

  const abrirTema = useCallback(
    async (clave: string) => {
      generacion.current += 1;
      const de = generacion.current;
      setPendiente(null);
      setError(null);
      const r = await pedir<{ hilo: string }>(RUTA_DE_LOS_TEMAS, { metodo: 'POST', cuerpo: { tema: clave } });
      if (!vigente(de)) return;
      if (r.tipo !== 'datos') {
        setError(r.tipo === 'rechazado' ? textoDelRechazo(r.codigo, r.detalle) : 'No se pudo contactar al servidor.');
        return;
      }
      // El hilo nuevo aparece en CONVERSACIONES, y después se muestra.
      avisos.current.alPreguntarOBorrar?.();
      await leerPanel();
      if (vigente(de)) await mostrarHilo(r.datos.hilo, de);
    },
    [leerPanel, mostrarHilo],
  );

  return { panel, situacion, causa, hiloId, turnos, pendiente, error, recargar, abrir, nueva, preguntar, borrar, abrirTema };
}
