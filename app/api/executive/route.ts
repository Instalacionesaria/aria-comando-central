// ADR-0301 — Toda operación llama al portero. INNEGOCIABLE.
// ADR-0304 — Las operaciones de una misma pantalla piden el mismo conjunto de capacidades.
//
// El cerebro en el Inicio: preguntar, ver los hilos propios y borrarlos (AG5 de los agentes,
// `docs/OTROS/agentes/03-EL-CEREBRO.md`, AG-40).
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA PRIMERA OPERACIÓN DEL INICIO, Y LA BANDERA QUE BAJA
//
// `executive` era la última sección con `sinOperacionesTodavia` (`lib/autorizacion/secciones.ts`). Esta
// ruta y esa bandera se mueven juntas: el cable existe para que nadie le dé su primera operación a una
// pantalla sin enterarse.
//
// ── TRES CAPACIDADES, DOS PUERTAS ────────────────────────────────────────────
//
// El GET pide `tablero.ver`, la capacidad de la sección: mirar el Inicio. El POST y el DELETE piden
// `cerebro.usar`: preguntar gasta la llave de IA de la empresa. ADR-0304 compara sólo los GET con la
// capacidad de la sección, y `cerebro.usar` no es de lectura.
//
// ── IDENTIDAD ACÁ, NEGOCIO EN `lib/agentes/executive/` ───────────────────────
//
// La llave se resuelve en este archivo con `conIdentidad` (`resolverLlaveDeIa`) y viaja como dato: nada
// bajo `lib/agentes/` importa la conexión de identidad (prueba 207). Qué queda a medias si la segunda
// mitad falla: la identidad sólo se LEE; lo de negocio lo escribe `preguntar` en transacciones cortas, y una
// pregunta que no llega a respuesta queda `fallida` —cuenta para el tope sólo si se pagó—. Si la función se
// corta antes de marcarla, su reserva vence sola a los diez minutos (`lib/agentes/executive/topes.ts`).
//
// Bajo delegación el cerebro no responde (`D-17`): lo rechaza este servidor, no sólo la pantalla.
// ═══════════════════════════════════════════════════════════════════════════════

import { exigir } from '../../../lib/autorizacion/portero.ts';
import { ok, rechazo } from '../../../lib/autorizacion/respuesta.ts';
import { esDeLaPrincipal, seccionesConAlcance } from '../../../lib/autorizacion/secciones.ts';
import { conIdentidad } from '../../../lib/datos/capa.ts';
import { conOrganizacion } from '../../../lib/datos/contexto.ts';
import { resolverLlaveDeIa } from '../../../lib/credenciales/resolver.ts';
import { periodoDe } from '../../../lib/negocio/periodo.ts';
import { borrarHilo, leerHilo, listarHilos } from '../../../lib/agentes/executive/conversaciones.ts';
import { estadoDelCerebro } from '../../../lib/agentes/executive/estado.ts';
import { herramientasPara } from '../../../lib/agentes/executive/herramientas.ts';
import { loUsadoHoy } from '../../../lib/agentes/executive/topes.ts';
import { preguntar } from '../../../lib/agentes/executive/preguntar.ts';

export const PANTALLA = 'executive';

/** Una pregunta tarda hasta 240 s de modelo, más lo de antes y lo de después. */
export const maxDuration = 300;

/** El largo máximo de una pregunta. Lo que se escribe en una caja, no un documento pegado. */
export const LARGO_DE_LA_PREGUNTA = 2000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La fecha local de la empresa, `AAAA-MM-DD`. */
const hoyEn = (zona: string) => new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(new Date());

/**
 * El estado del cerebro, los hilos propios y —con `?hilo=`— los mensajes de uno de ellos. Los temas de la
 * Reunión llegan en AG15.
 */
export async function GET(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['tablero.ver'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  const hilo = new URL(peticion.url).searchParams.get('hilo');
  if (hilo !== null && !UUID.test(hilo)) return rechazo('no_encontrado');

  const llave = await conIdentidad((db) => resolverLlaveDeIa(db, contexto.orgEfectiva));
  const { hilos, mensajes, usado } = await conOrganizacion(contexto.orgEfectiva, async () => ({
    hilos: await listarHilos(contexto.usuarioId),
    mensajes: hilo === null ? null : await leerHilo(contexto.usuarioId, hilo),
    usado: await loUsadoHoy(contexto.usuarioId, contexto.organizacion.zonaHoraria),
  }));
  // Un hilo ajeno se contesta igual que uno que no existe.
  if (hilo !== null && mensajes === null) return rechazo('no_encontrado');

  const visibles = seccionesConAlcance(contexto.permisos, contexto.alcance, esDeLaPrincipal(contexto)).map((s) => s.clave);
  return ok({
    estado: estadoDelCerebro({
      permisos: contexto.permisos,
      mirandoOtraOrganizacion: contexto.mirandoOtraOrganizacion,
      llave,
      usado,
      conHerramientas: herramientasPara(visibles).length > 0,
    }),
    usado: { porPersona: usado.porPersona, usadasPorPersona: usado.usadasPorPersona, renuevaEl: usado.renuevaEl.toISOString() },
    hilos,
    ...(mensajes === null ? {} : { mensajes }),
    temasDeLaReunion: [],
  });
}

/** Preguntar: `{ pregunta, hilo?, periodo? }`. */
export async function POST(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['cerebro.usar'], PANTALLA);
  if (contexto instanceof Response) return contexto;
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

  const llave = await conIdentidad((db) => resolverLlaveDeIa(db, contexto.orgEfectiva));
  if (llave.tipo === 'falta') return rechazo(llave.que);

  const zona = contexto.organizacion.zonaHoraria;
  const r = await preguntar({
    orgId: contexto.orgEfectiva,
    usuarioId: contexto.usuarioId,
    zona,
    llave: llave.claveIa,
    secciones: seccionesConAlcance(contexto.permisos, contexto.alcance, esDeLaPrincipal(contexto)).map((s) => ({ clave: s.clave, nombre: s.nombre })),
    origen: 'inicio',
    seccion: null,
    periodo: periodo?.clave ?? null,
    contexto: periodo ? { periodo: periodo.clave } : {},
    hiloId,
    texto,
    hoy: hoyEn(zona),
  });

  if (r.tipo === 'no_encontrado') return rechazo('no_encontrado');
  if (r.tipo === 'sin_herramientas') {
    return rechazo('cerebro_sin_datos', 'Con las pestañas que ves no hay datos que el cerebro pueda leer.');
  }
  // Lo que falló no fue el modelo: casi siempre, una escritura de la base. La pregunta quedó fallida.
  if (r.tipo === 'error_interno') return rechazo('base_no_disponible');
  if (r.tipo === 'tope') {
    // Se renueva a la medianoche de la empresa; la hora exacta viaja en el GET (`usado.renuevaEl`).
    return rechazo('tope_del_cerebro', `Llegaste al tope de hoy (${r.estado.tope} preguntas). Se renueva a la medianoche.`);
  }
  if (r.tipo === 'fallo') {
    // El detalle con la forma que la pantalla ya sabe leer: situación, referencia y lo técnico.
    return rechazo('modelo_no_disponible', `${r.situacion} · ref ${r.ref} · ${r.detalle}`);
  }
  return ok(r);
}

/** Borrar un hilo propio: `?hilo=`. Uno ajeno da 404, como uno que no existe. */
export async function DELETE(peticion: Request): Promise<Response> {
  const contexto = await exigir(peticion, ['cerebro.usar'], PANTALLA);
  if (contexto instanceof Response) return contexto;
  const hilo = new URL(peticion.url).searchParams.get('hilo');
  if (hilo === null || !UUID.test(hilo)) return rechazo('no_encontrado');
  const borrado = await conOrganizacion(contexto.orgEfectiva, () => borrarHilo(contexto.usuarioId, hilo));
  if (!borrado) return rechazo('no_encontrado');
  return ok({ borrado: true });
}
