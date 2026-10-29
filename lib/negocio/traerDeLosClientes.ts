// Las tres traídas manuales del CRM, una vez por cliente (el nivel 3, G4).
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ UN BUCLE PROPIO, Y NO EL DEL CRON
//
// «Traer del calendario», el tic de la ingesta y «Traer de GoHighLevel» traían al cliente por omisión con las
// credenciales de la empresa. Con un segundo cliente, eso dejaba a ese cliente sin leer —y el aviso de la agenda de
// la empresa, que mira el PEOR cliente activo, prendido para siempre— por mucho que alguien apretara el botón.
//
// Ahora cada ruta resuelve las credenciales de cada cliente que su pantalla lee (`clientesQueTrae`) y este bucle los
// trae de a uno, en serie, cada uno en SU ámbito (`ambitoDeUnCliente`) y con SU token. Lo mismo que el cron
// (`barrerTodo`), pero con lo que una persona espera de un botón:
//
//   · un try por cliente: el que falla no se lleva a los demás, y la respuesta dice cuál fue;
//   · el presupuesto se mira antes de cada cliente salvo el primero: con uno solo, la ruta hace lo de siempre;
//   · con un pulso (el calendario y los mensajes), el que hace más que no se trae va primero —sin pulso, después el de
//     `ultima_corrida_el` más vieja—. Es una ROTACIÓN: el reclamo estampa ese sello al empezar, así que uno lento que
//     se llevó el tiempo de un tic queda último en el siguiente. NO se le da prioridad a `atrasado`: un cliente en su
//     relleno inicial, o caído (`conElPulso` deja `atrasado` al fallar), ganaría siempre, y con él lento los demás
//     saldrían `sin_tiempo` en cada tic hasta el cron. El aviso de la agenda sí mira `atrasado`; el turno no.
//
// No abre `conOrganizacion` ni `conIdentidad`: las credenciales llegan resueltas desde la ruta (como en `barrerTodo`),
// y lo que escribe cada traída lo abre su propio módulo con el ámbito que recibe de acá. Nunca la empresa entera.
// ═══════════════════════════════════════════════════════════════════════════════

import { CADENCIA } from '../cadencia.ts';
import { TEXTO_DE_FALTA_GHL, TEXTO_DE_FALTA_GHL_DEL_CLIENTE, type AccesoAGhl } from '../credenciales/resolver.ts';
import { ambitoDeUnCliente, type AmbitoDeUnCliente } from './ambitoDelCliente.ts';
import { leerPulso, type ClaveDePulso } from './pulso.ts';
import type { ResultadoDelBarrido } from './citas.ts';
import type { ResultadoDeIngesta } from './ingesta.ts';
import type { Resumen } from './sincronizar.ts';

/**
 * Cuánto puede tardar «Traer del calendario» o «Traer de GoHighLevel» antes de no empezar otro cliente: los 300 s de
 * `maxDuration` menos 120 para el último que empezó. El mismo número y la misma guardia parcial que el barrido.
 */
export const PRESUPUESTO_DE_LA_TRAIDA_MS = 180_000;

/**
 * El de la ingesta, que pide el reloj cada `CADENCIA.operacion` y tira la respuesta: no empieza un cliente después de
 * un tic. El siguiente tic sigue por el que lleva más sin traerse, y el cron de diez minutos los cubre a todos.
 */
export const PRESUPUESTO_DEL_TIC_MS = CADENCIA.operacion;

const SIN_TIEMPO = 'No alcanzó el tiempo de esta traída; lo trae el barrido automático.';

/** La respuesta cuando no hay ningún cliente activo que traer: el enfocado, o todos los del cliente final, en pausa. */
export const NINGUN_CLIENTE_ACTIVO = 'No hay ningún cliente activo que traer: los que estás mirando están en pausa.';

export type CodigoDeLaTraida =
  | 'credenciales_incompletas'
  | 'credencial_rechazada'
  | 'servicio_externo_saturado'
  | 'servicio_externo_no_disponible';

/** Un cliente, con las credenciales de su subcuenta ya resueltas (el principal, las de la empresa). */
export interface ClienteConAcceso {
  id: string;
  nombre: string;
  esPorOmision: boolean;
  acceso: AccesoAGhl;
}

/**
 * Lo que pasó con un cliente:
 *   · `corrio`     → se trajo;
 *   · `frenada`    → no le tocaba: otro lo trajo hace segundos (el candado del pulso). No es un error;
 *   · `saltada`    → le falta una credencial: reintentar no sirve, hay que configurarla (el `porque` dice dónde);
 *   · `fallo`      → el CRM o la base fallaron: se reintenta;
 *   · `sin_tiempo` → no alcanzó el presupuesto: lo trae el apretón siguiente o el cron.
 */
export type EstadoDeLaTraida = 'corrio' | 'frenada' | 'saltada' | 'fallo' | 'sin_tiempo';

export interface TraidaDeUnCliente<R> {
  cuentaId: string;
  nombre: string;
  esPorOmision: boolean;
  estado: EstadoDeLaTraida;
  codigo?: CodigoDeLaTraida;
  porque?: string;
  llamadas?: number;
  resultado?: R;
}

/** Lo que devuelve la traída de UN cliente. (`Desenlace` ya existe en `lib/negocio/etapas.ts`: por eso otro nombre.) */
export type DesenlaceDeUnCliente<R> =
  | { estado: 'corrio'; resultado: R; llamadas: number }
  | { estado: 'frenada'; porque: string }
  | { estado: 'fallo'; codigo: CodigoDeLaTraida; porque: string };

export async function traerDeCadaCliente<R>(
  orgId: string,
  clientes: readonly ClienteConAcceso[],
  traer: (ambito: AmbitoDeUnCliente, acceso: { token: string; locationId: string }) => Promise<DesenlaceDeUnCliente<R>>,
  opciones: {
    presupuestoMs: number;
    /** El pulso que decide el turno. Sin él, el orden de la sesión (el principal primero). */
    pulso?: ClaveDePulso;
    /** Qué se responde si la traída de un cliente LANZA. `relanzarSiEsElUnico`: con un cliente, el 500 de siempre. */
    siLanza: { codigo: CodigoDeLaTraida; porque: string; relanzarSiEsElUnico?: true };
    /** El reloj, inyectable para la prueba. */
    ahora?: () => number;
  },
): Promise<TraidaDeUnCliente<R>[]> {
  const ahora = opciones.ahora ?? Date.now;
  const arranque = ahora();
  const enOrden = opciones.pulso ? await porTurno(orgId, clientes, opciones.pulso) : clientes;
  const renglones: TraidaDeUnCliente<R>[] = [];
  let empezados = 0;
  for (const c of enOrden) {
    const quien = { cuentaId: c.id, nombre: c.nombre, esPorOmision: c.esPorOmision };
    if (c.acceso.tipo !== 'listo') {
      const textos = c.esPorOmision ? TEXTO_DE_FALTA_GHL : TEXTO_DE_FALTA_GHL_DEL_CLIENTE;
      renglones.push({ ...quien, estado: 'saltada', codigo: 'credenciales_incompletas', porque: textos[c.acceso.que] });
      continue;
    }
    // El primero que puede siempre empieza: con un solo cliente, la ruta hace lo de siempre.
    if (empezados > 0 && ahora() - arranque > opciones.presupuestoMs) {
      renglones.push({ ...quien, estado: 'sin_tiempo', porque: SIN_TIEMPO });
      continue;
    }
    empezados += 1;
    try {
      const d = await traer(ambitoDeUnCliente(orgId, c.id), { token: c.acceso.token, locationId: c.acceso.locationId });
      renglones.push(
        d.estado === 'corrio'
          ? { ...quien, estado: 'corrio', llamadas: d.llamadas, resultado: d.resultado }
          : { ...quien, ...d },
      );
    } catch (e) {
      if (opciones.siLanza.relanzarSiEsElUnico && clientes.length === 1) throw e;
      // `ADR-0704`: el mensaje va al registro, no al cuerpo. `conElPulso` ya lo dejó anotado en la fila del pulso.
      console.error(`traída manual: falló el cliente ${c.id} de ${orgId}`, e);
      renglones.push({ ...quien, estado: 'fallo', codigo: opciones.siLanza.codigo, porque: opciones.siLanza.porque });
    }
  }
  return renglones;
}

/**
 * El turno: primero el que no tiene pulso (nunca se trajo), después el de `ultima_corrida_el` más vieja. Sin mirar
 * `atrasado` (ver el encabezado). Con un cliente, ni una lectura. Cada lectura, en el ámbito de SU cliente.
 */
async function porTurno(orgId: string, clientes: readonly ClienteConAcceso[], clave: ClaveDePulso) {
  if (clientes.length < 2) return clientes;
  const sello = new Map<string, number>();
  for (const c of clientes) {
    const p = await leerPulso(ambitoDeUnCliente(orgId, c.id), clave);
    sello.set(c.id, p?.ultima_corrida_el ? p.ultima_corrida_el.getTime() : Number.NEGATIVE_INFINITY);
  }
  // `sort` es estable: en un empate queda el orden de la sesión (el principal primero).
  return [...clientes].sort((a, b) => sello.get(a.id)! - sello.get(b.id)! || 0);
}

export type Contestacion =
  | { tipo: 'ok'; cuerpo: Record<string, unknown> }
  | { tipo: 'rechazo'; codigo: CodigoDeLaTraida; detalle: string };

/**
 * La respuesta de la ruta. Con UN cliente, la de siempre: los mismos códigos, textos y claves, sin `clientes` y sin
 * nombre delante. Con varios, la misma forma con las cifras sumadas de los que corrieron, más `clientes` (lo que pasó
 * con cada uno), y el texto de arriba con el nombre de su cliente delante.
 *
 * El orden decide qué se contesta cuando ninguno corrió: un fallo es un rechazo aunque otro esté frenado (el frenado
 * se leyó hace segundos; el que falló, no), y sólo saltadas es un 409 que dice dónde configurar.
 */
export function desenlaceDeLaTraida<R>(
  renglones: readonly TraidaDeUnCliente<R>[],
  forma: {
    deUno: (resultado: R, llamadas: number) => Record<string, unknown>;
    deVarios: (corrieron: readonly { resultado: R; llamadas: number }[]) => Record<string, unknown>;
  },
): Contestacion {
  if (renglones.length === 0) return { tipo: 'ok', cuerpo: { corrio: false, porque: NINGUN_CLIENTE_ACTIVO } };
  const varios = renglones.length > 1;
  const deQuien = (r: TraidaDeUnCliente<R>, texto: string) => (varios ? `${r.nombre}: ${texto}` : texto);
  const informe = varios ? { clientes: renglones } : {};
  const corrieron = renglones.filter((r) => r.estado === 'corrio') as (TraidaDeUnCliente<R> & {
    resultado: R;
    llamadas: number;
  })[];
  if (corrieron.length > 0) {
    const cifras = varios ? forma.deVarios(corrieron) : forma.deUno(corrieron[0]!.resultado, corrieron[0]!.llamadas);
    return { tipo: 'ok', cuerpo: { ...cifras, ...informe } };
  }
  const fallo = renglones.find((r) => r.estado === 'fallo');
  if (fallo) return { tipo: 'rechazo', codigo: fallo.codigo!, detalle: deQuien(fallo, fallo.porque!) };
  const frenada = renglones.find((r) => r.estado === 'frenada');
  if (frenada) return { tipo: 'ok', cuerpo: { corrio: false, porque: deQuien(frenada, frenada.porque!), ...informe } };
  // Quedan sólo saltadas: `sin_tiempo` no puede quedar sola, porque el primero con credencial siempre empieza.
  const saltada = renglones.find((r) => r.estado === 'saltada')!;
  return { tipo: 'rechazo', codigo: 'credenciales_incompletas', detalle: deQuien(saltada, saltada.porque!) };
}

// ── LAS CIFRAS DE VARIOS CLIENTES ──────────────────────────────────────────
//
// Campo por campo, a mano y no con un bucle sobre las claves: un campo nuevo del resultado tiene que decidirse (¿se
// suma, es un «alguno», es de una sola subcuenta?), y un bucle lo sumaría sin preguntar.

/** Los barridos del calendario de varios clientes: todo se suma, y `atrasado` es «alguno quedó incompleto». */
export function sumarBarridos(rs: readonly ResultadoDelBarrido[]): ResultadoDelBarrido {
  const suma = (f: (r: ResultadoDelBarrido) => number) => rs.reduce((n, r) => n + f(r), 0);
  return {
    calendarios: suma((r) => r.calendarios),
    vistas: suma((r) => r.vistas),
    nuestras: suma((r) => r.nuestras),
    guardadas: suma((r) => r.guardadas),
    borradas: suma((r) => r.borradas),
    dadasDeBaja: suma((r) => r.dadasDeBaja),
    sinHora: suma((r) => r.sinHora),
    canceladas: suma((r) => r.canceladas),
    llamadas: suma((r) => r.llamadas),
    atrasado: rs.some((r) => r.atrasado),
  };
}

/** Las ingestas de varios clientes: lo mismo. */
export function sumarIngestas(rs: readonly ResultadoDeIngesta[]): ResultadoDeIngesta {
  const suma = (f: (r: ResultadoDeIngesta) => number) => rs.reduce((n, r) => n + f(r), 0);
  return {
    miradas: suma((r) => r.miradas),
    nuestras: suma((r) => r.nuestras),
    mensajesNuevos: suma((r) => r.mensajesNuevos),
    sinFecha: suma((r) => r.sinFecha),
    atrasado: rs.some((r) => r.atrasado),
    entregasRevisadas: suma((r) => r.entregasRevisadas),
    entregasResueltas: suma((r) => r.entregasResueltas),
  };
}

/**
 * Las sincronizaciones de varios clientes. `etiquetasDeLaCuenta` y `catalogoDeCampos` son de UNA subcuenta: no se
 * juntan, quedan en `clientes[i].resultado`. Y `congelados` suma los que son número: `null` es «no se pudo conciliar»,
 * no un cero, así que sólo queda `null` si ningún cliente concilió.
 */
export function juntarResumenes(rs: readonly Resumen[]): Omit<Resumen, 'etiquetasDeLaCuenta' | 'catalogoDeCampos'> {
  const traidos: Record<string, number> = {};
  for (const r of rs) for (const [etiqueta, n] of Object.entries(r.traidos)) traidos[etiqueta] = (traidos[etiqueta] ?? 0) + n;
  const conciliados = rs.filter((r) => typeof r.congelados === 'number');
  return {
    traidos,
    guardados: {
      closer: rs.reduce((n, r) => n + r.guardados.closer, 0),
      setter: rs.reduce((n, r) => n + r.guardados.setter, 0),
    },
    salteados: rs.flatMap((r) => r.salteados),
    truncado: rs.some((r) => r.truncado),
    congelados: conciliados.length === 0 ? null : conciliados.reduce((n, r) => n + (r.congelados ?? 0), 0),
    llamadas: rs.reduce((n, r) => n + r.llamadas, 0),
  };
}
