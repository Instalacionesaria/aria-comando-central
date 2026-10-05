// Lo que comparten las rutas del cerebro: la del Inicio (`app/api/executive/route.ts`) y las de la caja del
// pie de cada sección (`app/api/<carpeta>/cerebro/route.ts`, `docs/OTROS/agentes/03-EL-CEREBRO.md`, AG-40).
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE QUEDA EN CADA RUTA, Y POR QUÉ
//
// Cada ruta declara su `PANTALLA`, llama al portero con sus capacidades escritas en el archivo (ADR-0304
// las lee de ahí), abre la identidad con `conIdentidad` y su `conOrganizacion(` (`T-03`). Lo que es igual
// en todas vive acá, sin identidad (prueba 207): leer y validar la pregunta, armar el estado, contestar con
// el resultado de `preguntar`. Doce copias de eso divergirían en la primera corrección, con el síntoma «en
// Creative se rechaza y en Sales no».
//
// `identidadDelCerebro` recibe la conexión de identidad que abrió la ruta: lee la llave y, sólo si hace
// falta, por qué el auditor no audita (quien ve Conversation) y el estado de las integraciones (quien tiene
// `credenciales.ver`). Las dos últimas pueden dejar un registro de auditoría si una credencial está
// ilegible, igual que en sus pantallas.
// ═══════════════════════════════════════════════════════════════════════════════

import { porQueNoAudita } from '../../auditor/pantalla.ts';
import { ok, rechazo } from '../../autorizacion/respuesta.ts';
import { esDeLaPrincipal, seccionesConAlcance } from '../../autorizacion/secciones.ts';
import type { Contexto } from '../../autorizacion/sesion.ts';
import type { Trx } from '../../datos/capa.ts';
import { type LlaveDeIa, resolverAccesoAlAuditor, resolverCredenciales, resolverLlaveDeIa } from '../../credenciales/resolver.ts';
import { periodoDe } from '../../negocio/periodo.ts';
import type { DatosDeLaRuta } from './adaptadores/comun.ts';
import { listarHilos, leerHilo, type HiloListado, type MensajeDelHilo } from './conversaciones.ts';
import { estadoDelCerebro, type EstadoDelCerebro } from './estado.ts';
import { herramientasPara } from './herramientas.ts';
import type { Pregunta, ResultadoDePreguntar } from './preguntar.ts';
import { loUsadoHoy, type LoUsadoHoy } from './topes.ts';

/** El largo máximo de una pregunta. Lo que se escribe en una caja, no un documento pegado. */
export const LARGO_DE_LA_PREGUNTA = 2000;

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La fecha local de la empresa, `AAAA-MM-DD`. */
export const hoyEn = (zona: string) => new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(new Date());

/** Las secciones que ve quien pregunta: lo que se le ofrece y adónde puede ir (AG-41). */
export function seccionesVisibles(contexto: Contexto): { clave: string; nombre: string }[] {
  return seccionesConAlcance(contexto.permisos, contexto.alcance, esDeLaPrincipal(contexto)).map((s) => ({ clave: s.clave, nombre: s.nombre }));
}

export interface IdentidadDelCerebro {
  llave: LlaveDeIa;
  deLaRuta: DatosDeLaRuta;
}

/**
 * Lo que el cerebro necesita de identidad, con la conexión que abrió la ruta. `completa: false` lee sólo
 * la llave: el GET no necesita más. Leer la llave puede dejar el registro de una llave ilegible
 * (`resolverLlaveDeIa`), como en toda pantalla que la lee; con `false` no se suman los del auditor y de las
 * integraciones cada vez que se abre una pantalla.
 */
export async function identidadDelCerebro(db: Trx, contexto: Contexto, completa: boolean): Promise<IdentidadDelCerebro> {
  const llave = await resolverLlaveDeIa(db, contexto.orgEfectiva);
  if (!completa) return { llave, deLaRuta: { noAudita: null, integraciones: null } };
  const visibles = seccionesVisibles(contexto).map((s) => s.clave);
  const noAudita = visibles.includes('conversation') ? porQueNoAudita(await resolverAccesoAlAuditor(db, contexto.orgEfectiva)) : null;
  let integraciones: DatosDeLaRuta['integraciones'] = null;
  if (contexto.permisos.has('credenciales.ver')) {
    const c = await resolverCredenciales(db, contexto.orgEfectiva);
    const estado = (v: (typeof c)['crm']) => ({ cargado: v.cargado, estado: v.estado });
    integraciones = { crm: estado(c.crm), ia: estado(c.ia), pagos: estado(c.pagos), tldv: estado(c.tldv), meta: estado(c.meta) };
  }
  return { llave, deLaRuta: { noAudita, integraciones } };
}

/** Lo del panel: los hilos propios (de esa sección, en la caja del pie), uno abierto y lo usado hoy. */
export interface LoDelPanel {
  hilos: HiloListado[];
  mensajes: MensajeDelHilo[] | null;
  usado: LoUsadoHoy;
}

/** **Corre dentro de la `conOrganizacion(` de la ruta.** */
export async function loDelPanel(contexto: Contexto, seccion: string | null, hilo: string | null): Promise<LoDelPanel> {
  return {
    hilos: await listarHilos(contexto.usuarioId, seccion),
    mensajes: hilo === null ? null : await leerHilo(contexto.usuarioId, hilo, seccion),
    usado: await loUsadoHoy(contexto.usuarioId, contexto.organizacion.zonaHoraria),
  };
}

/** El `?hilo=` del GET, o un 404 si no tiene forma de id. `null` sin parámetro. */
export function hiloPedido(peticion: Request): string | null | Response {
  const hilo = new URL(peticion.url).searchParams.get('hilo');
  if (hilo !== null && !UUID.test(hilo)) return rechazo('no_encontrado');
  return hilo;
}

/** La respuesta del GET: el estado, lo usado, los hilos y, si se pidió uno, sus mensajes. */
export function respuestaDelPanel(contexto: Contexto, llave: LlaveDeIa, panel: LoDelPanel, hilo: string | null, extra: Record<string, unknown> = {}): Response {
  // Un hilo ajeno se contesta igual que uno que no existe.
  if (hilo !== null && panel.mensajes === null) return rechazo('no_encontrado');
  const visibles = seccionesVisibles(contexto).map((s) => s.clave);
  const estado: EstadoDelCerebro = estadoDelCerebro({
    permisos: contexto.permisos,
    mirandoOtraOrganizacion: contexto.mirandoOtraOrganizacion,
    llave,
    usado: panel.usado,
    conHerramientas: herramientasPara(visibles, null, contexto.permisos.has('credenciales.ver')).length > 0,
  });
  return ok({
    estado,
    usado: { porPersona: panel.usado.porPersona, usadasPorPersona: panel.usado.usadasPorPersona, renuevaEl: panel.usado.renuevaEl.toISOString() },
    hilos: panel.hilos,
    ...(panel.mensajes === null ? {} : { mensajes: panel.mensajes }),
    ...extra,
  });
}

export interface PreguntaLeida {
  texto: string;
  hiloId: string | null;
  periodo: string | null;
}

/**
 * Lee y valida el cuerpo del POST `{ pregunta, hilo?, periodo? }`, y rechaza bajo delegación (`D-17`): lo
 * rechaza el servidor, no sólo la pantalla. Antes de abrir la identidad: lo que no puede pasar no la toca.
 */
export async function leerLaPregunta(peticion: Request, contexto: Contexto): Promise<PreguntaLeida | Response> {
  if (contexto.mirandoOtraOrganizacion) {
    return rechazo('cerebro_bajo_delegacion', 'Estás mirando otra empresa: el cerebro no responde aquí.');
  }
  let cuerpo: { pregunta?: unknown; hilo?: unknown; periodo?: unknown };
  try {
    cuerpo = (await peticion.json()) as typeof cuerpo;
  } catch {
    return rechazo('peticion_invalida', 'El cuerpo no es JSON.');
  }
  const texto = typeof cuerpo?.pregunta === 'string' ? cuerpo.pregunta.trim() : '';
  if (texto === '' || texto.length > LARGO_DE_LA_PREGUNTA) {
    return rechazo('peticion_invalida', `La pregunta tiene que tener entre 1 y ${LARGO_DE_LA_PREGUNTA} caracteres.`);
  }
  const hiloId = cuerpo.hilo === undefined || cuerpo.hilo === null ? null : String(cuerpo.hilo);
  if (hiloId !== null && !UUID.test(hiloId)) return rechazo('no_encontrado');
  // El período de la pantalla se valida contra la lista; uno que no existe se rechaza, no se corrige.
  const periodo = cuerpo.periodo === undefined || cuerpo.periodo === null ? null : periodoDe(String(cuerpo.periodo));
  if (cuerpo.periodo !== undefined && cuerpo.periodo !== null && periodo === null) {
    return rechazo('peticion_invalida', 'Ese período no existe.');
  }
  return { texto, hiloId, periodo: periodo?.clave ?? null };
}

/**
 * Lo que `preguntar` recibe, de lo que juntó la ruta; o el rechazo si falta la llave. `seccion` es la
 * `PANTALLA` de la caja del pie, o `null` en el Inicio.
 */
export function laPregunta(contexto: Contexto, identidad: IdentidadDelCerebro, leida: PreguntaLeida, seccion: string | null): Pregunta | Response {
  /* El portero mira el alcance de una persona restringida, pero el POST pide `cerebro.usar` y no la capacidad
     de la sección: un rol propio con `cerebro.usar` y sin `setter.ver` pasaría y dejaría un hilo del Setter
     que su caja nunca le mostraría (lo encontró la revisión de AG6). Lo que no se ve no tiene caja. */
  if (seccion !== null && !seccionesVisibles(contexto).some((s) => s.clave === seccion)) return rechazo('seccion_no_concedida');
  if (identidad.llave.tipo === 'falta') return rechazo(identidad.llave.que);
  const zona = contexto.organizacion.zonaHoraria;
  return {
    orgId: contexto.orgEfectiva,
    usuarioId: contexto.usuarioId,
    zona,
    llave: identidad.llave.claveIa,
    secciones: seccionesVisibles(contexto),
    origen: seccion === null ? 'inicio' : 'pie',
    seccion,
    periodo: leida.periodo,
    contexto: leida.periodo ? { periodo: leida.periodo } : {},
    hiloId: leida.hiloId,
    texto: leida.texto,
    hoy: hoyEn(zona),
    deLaRuta: identidad.deLaRuta,
  };
}

/** El resultado de `preguntar`, como respuesta HTTP. */
export function respuestaDePreguntar(r: ResultadoDePreguntar): Response {
  if (r.tipo === 'no_encontrado') return rechazo('no_encontrado');
  if (r.tipo === 'sin_herramientas') {
    return rechazo('cerebro_sin_datos', 'Con las pestañas que ves no hay datos que el cerebro pueda leer.');
  }
  // Lo que falló no fue el modelo: casi siempre, una escritura de la base. La pregunta quedó fallida.
  if (r.tipo === 'error_interno') return rechazo('base_no_disponible');
  if (r.tipo === 'tope') {
    // Se renueva a la medianoche de la empresa; la hora exacta viaja en el GET (`usado.renuevaEl`).
    // De quién es el tope: «llegaste» sólo a quien llegó al suyo, no cuando la que llegó es la empresa.
    const quien = r.estado.de === 'persona' ? 'Llegaste al tope de hoy' : 'Tu empresa llegó al tope de hoy';
    return rechazo('tope_del_cerebro', `${quien} (${r.estado.tope} preguntas). Se renueva a la medianoche.`);
  }
  if (r.tipo === 'fallo') {
    // El detalle con la forma que la pantalla ya sabe leer: situación, referencia y lo técnico.
    return rechazo('modelo_no_disponible', `${r.situacion} · ref ${r.ref} · ${r.detalle}`);
  }
  return ok(r);
}
