// El tablero de Negocios: lo que la pantalla dibuja, armado con la foto del día y la configuración en vivo.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA FOTO Y LO VIVO, Y QUIÉN MÁS LEE ESTO
//
// La pestaña Negocios (sólo el superadministrador, sólo desde la principal) muestra de cada empresa y de cada cliente
// dos clases de cosas:
//
//   · lo que se configura —estado, nicho, la lista de chequeo—, EN VIVO desde identidad: un cliente dado de alta hace
//     una hora tiene que aparecer, y uno que se terminó de configurar no puede seguir diciendo que le falta algo;
//   · las cifras —contactos, ventas, gasto—, de la FOTO del día (`089`): medirlas en vivo sería recorrer todas las
//     empresas en cada carga. La foto dice de qué día es, y si es vieja la pantalla lo avisa.
//
// Los nombres salen sólo de lo vivo: la foto no guarda ninguno. Sin la configuración —`armarElTablero(foto, null)`—
// es el modo del agente que va a leer esto: las mismas cifras, la configuración de la foto, y ningún nombre.
//
// Las cifras de arriba, las que suman:
//   · sin ARIA (la principal) y sin los clientes de prueba: ARIA no es su propio cliente, y uno de prueba no vende;
//   · una tasa con menos de `PISO_DE_UNA_TASA` en el denominador no se calcula: la misma regla que las pantallas;
//   · nunca se suman montos de monedas distintas: van por moneda.
//
// Pura y sin base: la prueba la 272.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ConfiguracionDeLosNegocios, ConfiguracionDeUnCliente, ConfiguracionDeUnaEmpresa } from './configuracion.ts';
import type { FilaDeLaFotoDeUnCliente, FilaDeLaFotoDeUnaEmpresa, FotoDeLosNegocios } from './lectura.ts';
import { nichoDeLaEmpresa } from './foto.ts';
import {
  PASOS_DE_LA_EMPRESA,
  PASOS_DEL_CLIENTE,
  clienteConfigurado,
  configurado,
  faltan,
  pasosDeLaEmpresa,
  pasosDelCliente,
} from './pasos.ts';
import { HORARIOS } from '../negocio/barrido.ts';
import { PISO_DE_UNA_TASA } from '../negocio/indicadoresDeCitas.ts';

/**
 * Desde cuándo la foto es vieja: el umbral de atraso del horario que la toma (dos días y una hora). Una sola fuente,
 * para que la pantalla no avise antes ni después que el Panel de Monitoreo.
 */
export const FOTO_VIEJA_MS = HORARIOS['29 11 * * *'].umbralMinutos * 60_000;

export interface CifrasDeUnCliente {
  medida: boolean;
  motivo: string | null;
  contactos: number | null;
  contactosNuevos30d: number | null;
  contactosNuevos30dPrevios: number | null;
  agendaron30d: number | null;
  calificados30d: number | null;
  /** Agendaron sobre los contactos nuevos. `null` con menos de `PISO_DE_UNA_TASA` contactos nuevos. */
  tasaDeAgenda: number | null;
  ventas30d: number | null;
  ventas30dPrevias: number | null;
  /** En la moneda del cliente. Nunca se suma con la de otro. */
  monto30d: string | null;
  compradores: number | null;
  gasto30d: string | null;
  ultimaIngestaEl: string | null;
}

export interface ClienteDelTablero {
  id: string;
  /** `null` en el modo del agente. */
  nombre: string | null;
  estado: 'activa' | 'pausada' | 'baja';
  esPrueba: boolean;
  esPorOmision: boolean;
  nicho: string | null;
  nichoConfirmado: boolean;
  pais: string | null;
  moneda: string | null;
  configurado: boolean;
  faltan: string[];
  /** `null` = no está en la foto (se dio de alta después). */
  cifras: CifrasDeUnCliente | null;
}

export interface EmpresaDelTablero {
  id: string;
  nombre: string | null;
  esPrincipal: boolean;
  activa: boolean;
  pais: string | null;
  nicho: string | null;
  nichoOrigen: 'fijado' | 'calculado' | null;
  configurada: boolean;
  faltan: string[];
  usuarios: number;
  usuariosLimitados: number;
  llaveDeIa: boolean;
  /** Los clientes por estado, sin los de prueba; los de prueba aparte. */
  clientes: { activos: number; pausados: number; deBaja: number; dePrueba: number; configurados: number };
  /** De la foto. `null` = la empresa no está en la foto. */
  cifras: {
    medida: boolean;
    motivo: string | null;
    contactos: number | null;
    contactosNuevos30d: number | null;
    ventas30d: number | null;
    iaLlamadas30d: number | null;
    incidentes30d: number | null;
    senalesAbiertas: number | null;
  } | null;
  /** Lo vendido en 30 días, una línea por moneda, de sus clientes que no son de prueba. */
  montos: { moneda: string | null; monto30d: string }[];
  detalle: ClienteDelTablero[];
}

export interface TableroDeNegocios {
  foto: { dia: string | null; tomadaEl: string | null; contrato: number | null; vieja: boolean };
  /** Lo que la pantalla dice arriba de todo, o `null`. */
  aviso: string | null;
  indicadores: {
    empresas: number;
    empresasConfiguradas: number;
    clientes: number;
    clientesConfigurados: number;
    /** `null` = ninguna empresa medida. */
    contactosNuevos30d: number | null;
    ventas30d: number | null;
    /** Empresas activas que la foto no midió (o que todavía no están en ella). */
    sinMedir: number;
  };
  /** Los clientes con el nicho confirmado, por nicho, y cuántas empresas los tienen. */
  nichos: { nicho: string; clientes: number; empresas: number }[];
  /** Clientes reales que todavía no tienen el nicho confirmado: no entran en `nichos`. */
  sinNicho: number;
  empresas: EmpresaDelTablero[];
}

const aIso = (d: Date | string | null): string | null => (d === null ? null : new Date(d).toISOString());

const tasa = (parte: number | null, total: number | null): number | null =>
  parte === null || total === null || total < PISO_DE_UNA_TASA ? null : parte / total;

function cifrasDelCliente(f: FilaDeLaFotoDeUnCliente): CifrasDeUnCliente {
  return {
    medida: f.medida,
    motivo: f.motivo_sin_medir,
    contactos: f.contactos,
    contactosNuevos30d: f.contactos_nuevos_30d,
    contactosNuevos30dPrevios: f.contactos_nuevos_30d_previos,
    agendaron30d: f.agendaron_30d,
    calificados30d: f.calificados_30d,
    tasaDeAgenda: tasa(f.agendaron_30d, f.contactos_nuevos_30d),
    ventas30d: f.ventas_30d,
    ventas30dPrevias: f.ventas_30d_previas,
    monto30d: f.monto_30d,
    compradores: f.compradores,
    gasto30d: f.gasto_30d,
    ultimaIngestaEl: aIso(f.ultima_ingesta_el),
  };
}

function cifrasDeLaEmpresa(f: FilaDeLaFotoDeUnaEmpresa): EmpresaDelTablero['cifras'] {
  return {
    medida: f.medida,
    motivo: f.motivo_sin_medir,
    contactos: f.contactos,
    contactosNuevos30d: f.contactos_nuevos_30d,
    ventas30d: f.ventas_30d,
    iaLlamadas30d: f.ia_llamadas_30d,
    incidentes30d: f.incidentes_30d,
    senalesAbiertas: f.senales_abiertas,
  };
}

/** Un cliente, con su configuración en vivo y sus cifras de la foto. */
function clienteVivo(c: ConfiguracionDeUnCliente, f: FilaDeLaFotoDeUnCliente | undefined, ahora: number): ClienteDelTablero {
  /* Lo medido —sus datos al día y Meta en su GoHighLevel— es de la foto. Sin fila, o con la fila de una empresa que no
     se pudo medir, no se sabe: `sin_medir`, que no se acusa (la foto lo escribe igual, `filasDeUnaEmpresa`). */
  const medido =
    f && f.medida
      ? { ultimaIngestaEl: f.ultima_ingesta_el === null ? null : new Date(f.ultima_ingesta_el), metaLeido: f.meta_leido }
      : undefined;
  const pasos = pasosDelCliente(c, medido, ahora);
  return {
    id: c.id,
    nombre: c.nombre,
    estado: c.estado,
    esPrueba: c.esPrueba,
    esPorOmision: c.esPorOmision,
    nicho: c.nicho,
    nichoConfirmado: c.nichoConfirmado,
    pais: c.pais,
    moneda: c.moneda,
    configurado: clienteConfigurado(c.estado, pasos),
    faltan: faltan(pasos, PASOS_DEL_CLIENTE),
    cifras: f ? cifrasDelCliente(f) : null,
  };
}

/** Un cliente sólo de la foto: el modo del agente. */
function clienteDeLaFoto(f: FilaDeLaFotoDeUnCliente): ClienteDelTablero {
  return {
    id: f.cuenta_ref,
    nombre: null,
    estado: f.estado,
    esPrueba: f.es_prueba,
    esPorOmision: f.es_por_omision,
    nicho: f.nicho,
    nichoConfirmado: f.nicho_confirmado,
    pais: f.pais,
    moneda: f.moneda,
    configurado: f.configurada,
    faltan: f.faltan,
    cifras: cifrasDelCliente(f),
  };
}

/** Lo vendido por moneda, de los clientes reales. Dos monedas son dos líneas, nunca una suma. */
function montosPorMoneda(clientes: readonly ClienteDelTablero[]): EmpresaDelTablero['montos'] {
  const por = new Map<string | null, number>();
  for (const c of clientes) {
    if (c.esPrueba || c.cifras?.monto30d == null) continue;
    por.set(c.moneda, (por.get(c.moneda) ?? 0) + Number(c.cifras.monto30d));
  }
  return [...por]
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .map(([moneda, monto]) => ({ moneda, monto30d: monto.toFixed(2) }));
}

function conteoDeClientes(clientes: readonly ClienteDelTablero[]): EmpresaDelTablero['clientes'] {
  const reales = clientes.filter((c) => !c.esPrueba);
  return {
    activos: reales.filter((c) => c.estado === 'activa').length,
    pausados: reales.filter((c) => c.estado === 'pausada').length,
    deBaja: reales.filter((c) => c.estado === 'baja').length,
    dePrueba: clientes.length - reales.length,
    configurados: reales.filter((c) => c.configurado).length,
  };
}

function empresaViva(
  e: ConfiguracionDeUnaEmpresa,
  f: FilaDeLaFotoDeUnaEmpresa | undefined,
  filasDeClientes: ReadonlyMap<string, FilaDeLaFotoDeUnCliente>,
  ahora: number,
): EmpresaDelTablero {
  const detalle = e.clientes.map((c) => clienteVivo(c, filasDeClientes.get(c.id), ahora));
  const clientes = conteoDeClientes(detalle);
  const pasos = pasosDeLaEmpresa(e, clientes.configurados);
  // La misma regla que la foto (`nichoDeLaEmpresa`), sobre lo vivo.
  const nicho = nichoDeLaEmpresa(e);
  return {
    id: e.id,
    nombre: e.nombre,
    esPrincipal: e.esPrincipal,
    activa: e.activa,
    pais: e.pais,
    nicho: nicho.nicho,
    nichoOrigen: nicho.origen,
    configurada: configurado(pasos, PASOS_DE_LA_EMPRESA),
    faltan: faltan(pasos, PASOS_DE_LA_EMPRESA),
    usuarios: e.usuarios,
    usuariosLimitados: e.usuariosLimitados,
    llaveDeIa: e.llaveDeIa,
    clientes,
    cifras: f ? cifrasDeLaEmpresa(f) : null,
    montos: montosPorMoneda(detalle),
    detalle,
  };
}

function empresaDeLaFoto(f: FilaDeLaFotoDeUnaEmpresa, clientes: readonly FilaDeLaFotoDeUnCliente[]): EmpresaDelTablero {
  const detalle = clientes.map(clienteDeLaFoto);
  return {
    id: f.organizacion_ref,
    nombre: null,
    esPrincipal: f.es_principal,
    activa: f.activa,
    pais: f.pais,
    nicho: f.nicho,
    nichoOrigen: f.nicho_origen,
    configurada: f.configurada,
    faltan: f.faltan,
    usuarios: f.usuarios,
    usuariosLimitados: f.usuarios_limitados,
    llaveDeIa: f.llave_de_ia,
    clientes: conteoDeClientes(detalle),
    cifras: cifrasDeLaEmpresa(f),
    montos: montosPorMoneda(detalle),
    detalle,
  };
}

/** Suma lo medido; `null` si no hay ninguna medida (nulo no es cero). */
function sumaMedida(valores: readonly (number | null)[]): number | null {
  const medidos = valores.filter((v): v is number => v !== null);
  return medidos.length === 0 ? null : medidos.reduce((s, v) => s + v, 0);
}

function avisoDe(foto: FotoDeLosNegocios, vieja: boolean): string | null {
  if (foto.dia === null) {
    return 'Todavía no hay ninguna foto: la toma el cron cada mañana. Hasta la primera, la configuración se ve y las cifras no.';
  }
  if (vieja) return `La última foto es del ${foto.dia}: el cron no la tomó en los últimos dos días. Las cifras no están al día.`;
  return null;
}

/**
 * El tablero. Con la configuración, la lista es la de hoy y la configuración es la viva; sin ella, todo sale de la foto
 * y sin nombres (el modo del agente).
 */
export function armarElTablero(
  foto: FotoDeLosNegocios,
  config: ConfiguracionDeLosNegocios | null,
  ahora: number,
): TableroDeNegocios {
  const filasDeEmpresas = new Map(foto.empresas.map((f) => [f.organizacion_ref, f]));
  const filasDeClientes = new Map(foto.cuentas.map((f) => [f.cuenta_ref, f]));

  const empresas = config
    ? config.empresas.map((e) => empresaViva(e, filasDeEmpresas.get(e.id), filasDeClientes, ahora))
    : foto.empresas.map((f) => empresaDeLaFoto(f, foto.cuentas.filter((c) => c.organizacion_ref === f.organizacion_ref)));

  // Las de arriba: sin ARIA, sólo las activas, y sin los clientes de prueba (`conteoDeClientes` ya los separa).
  const clientesDe = empresas.filter((e) => !e.esPrincipal && e.activa);
  const reales = clientesDe.flatMap((e) => e.detalle.filter((c) => !c.esPrueba && c.estado !== 'baja'));

  const nichos = new Map<string, { clientes: number; empresas: Set<string> }>();
  for (const e of clientesDe) {
    for (const c of e.detalle) {
      if (c.esPrueba || c.estado === 'baja' || !c.nicho || !c.nichoConfirmado) continue;
      const n = nichos.get(c.nicho) ?? { clientes: 0, empresas: new Set<string>() };
      n.clientes += 1;
      n.empresas.add(e.id);
      nichos.set(c.nicho, n);
    }
  }

  const tomadaEl = aIso(foto.tomadaEl);
  const vieja = foto.tomadaEl === null || ahora - new Date(foto.tomadaEl).getTime() > FOTO_VIEJA_MS;
  return {
    foto: { dia: foto.dia, tomadaEl, contrato: foto.contrato, vieja },
    aviso: avisoDe(foto, vieja),
    indicadores: {
      empresas: clientesDe.length,
      empresasConfiguradas: clientesDe.filter((e) => e.configurada).length,
      clientes: clientesDe.reduce((s, e) => s + e.clientes.activos, 0),
      clientesConfigurados: clientesDe.reduce((s, e) => s + e.clientes.configurados, 0),
      contactosNuevos30d: sumaMedida(clientesDe.map((e) => (e.cifras?.medida ? e.cifras.contactosNuevos30d : null))),
      ventas30d: sumaMedida(clientesDe.map((e) => (e.cifras?.medida ? e.cifras.ventas30d : null))),
      sinMedir: clientesDe.filter((e) => !e.cifras?.medida).length,
    },
    nichos: [...nichos]
      .map(([nicho, n]) => ({ nicho, clientes: n.clientes, empresas: n.empresas.size }))
      .sort((a, b) => b.clientes - a.clientes || a.nicho.localeCompare(b.nicho)),
    sinNicho: reales.filter((c) => !c.nicho || !c.nichoConfirmado).length,
    empresas,
  };
}
