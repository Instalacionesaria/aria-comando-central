// Lo que una persona ve de la Reunión de hoy, y abrir uno de sus temas como conversación (AG15 de los agentes;
// `docs/OTROS/agentes/04-LA-REUNION-Y-LA-CABECERA.md`, AG-73, AG-74 y AG-76). **Corre dentro de
// `conOrganizacion(`.**
//
// Abrir un tema no llama al modelo ni cuenta para el tope: el primer intercambio lo arma este servidor con lo
// que guardó la pasada. Queda como un turno respondido —el tema como lo que se tocó, y el tema mismo como
// respuesta—, así la primera pregunta de la persona ya lo tiene en el hilo que ve el modelo (`AG-51`). El tope
// se cuenta en `preguntas_del_executive`, donde esto no escribe. El hilo lo escribe su único escritor,
// `abrirHiloDeUnTema` de `../executive/conversaciones.ts`; acá se elige el tema y se arma lo que dice.

import { diaEnZona } from '../../negocio/tiempo.ts';
import { abrirHiloDeUnTema } from '../executive/conversaciones.ts';
import type { RespuestaValidada } from '../executive/respuesta.ts';
import { temasEnSuOrden, ultimaReunion } from './guardar.ts';
import { temasParaUnaPersona, type TemaDeLaReunion } from './temas.ts';

/** Lo que dibuja una tarjeta: sin la evidencia, que viaja cuando se abre el tema. */
export type TemaEnPantalla = Pick<TemaDeLaReunion, 'clave' | 'etiqueta' | 'origen' | 'seccion' | 'texto'>;

export interface ReunionEnPantalla {
  dia: string;
  /** La hora local en que corrió la pasada, `HH:MM` (AG-76): una zona mal cargada se ve ahí. */
  hora: string;
  /** Si es la de hoy en la zona de la empresa; si no, es la última que corrió. */
  deHoy: boolean;
  /** Los de las secciones que la persona ve, y de esos los tres primeros (AG-73). Vacía: corrió y no hubo nada. */
  temas: TemaEnPantalla[];
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** `2026-10-06` → «6 de octubre»: el día ya es local, no se convierte. */
const fechaLegible = (dia: string) => {
  const [, m, d] = dia.split('-').map(Number);
  return `${d} de ${MESES[m! - 1]}`;
};

const horaEnZona = (instante: Date, zona: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: zona, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instante);

/** La Reunión que ve una persona con estas secciones, o `null` si la pasada nunca corrió. */
export async function reunionParaUnaPersona(secciones: readonly string[], zona: string): Promise<ReunionEnPantalla | null> {
  const r = await ultimaReunion();
  if (!r) return null;
  return {
    dia: r.dia,
    hora: horaEnZona(r.corrioEl, zona),
    deHoy: r.dia === diaEnZona(new Date(), zona),
    temas: temasParaUnaPersona(temasEnSuOrden(r), secciones).map(({ clave, etiqueta, origen, seccion, texto }) => ({ clave, etiqueta, origen, seccion, texto })),
  };
}

/** El primer mensaje del cerebro en un tema abierto: el tema mismo, con la pantalla de su sección como siguiente paso. Pura. */
export function primerMensaje(tema: TemaDeLaReunion, dia: string): RespuestaValidada {
  return {
    conclusion: tema.texto,
    // Las cifras del tema están en su texto y en su evidencia; como cifras del cerebro pedirían una herramienta
    // que las respalde, y esto no pasó por ninguna.
    cifras: [],
    confianza: { nivel: 'alta', porque: `Lo detectaron las reglas de la Reunión en la pasada del ${fechaLegible(dia)}.` },
    areas: [tema.seccion],
    recomendaciones: [],
    no_hay_dato: [],
    siguientes: [{ tipo: 'abrir', seccion: tema.seccion, pestana: null, contexto: null }],
    avisos: [],
  };
}

/**
 * Abre un tema de la última Reunión como conversación de quien lo toca, y devuelve el hilo; `null` si el tema
 * no está o es de una sección que la persona no ve. El mismo tema del mismo día vuelve a su conversación.
 */
export async function abrirTema(usuarioId: string, clave: string, secciones: readonly string[]): Promise<string | null> {
  const r = await ultimaReunion();
  if (!r) return null;
  // Cualquiera de los que ve, no sólo los tres de las tarjetas: la redacción puede haber cambiado el orden.
  const tema = temasEnSuOrden(r).find((t) => t.clave === clave && secciones.includes(t.seccion));
  if (!tema) return null;

  return abrirHiloDeUnTema({
    usuarioId,
    dia: r.dia,
    clave,
    titulo: tema.texto,
    tocado: `${tema.etiqueta} · ${tema.origen}`,
    respuesta: primerMensaje(tema, r.dia),
    evidencia: [{ id: 'ev-1', herramienta: 'reunionDeHoy', argumentos: { dia: r.dia }, datos: tema.evidencia }],
  });
}
