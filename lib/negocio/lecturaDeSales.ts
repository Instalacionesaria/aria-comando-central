// La lectura única de Sales: lo que dibuja el front del prototipo, hecho en el servidor.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ ES, Y POR QUÉ UNA SOLA
//
// La pestaña vuelve al front del prototipo (`docs/sales/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`): cuatro
// cifras, la tabla de closers, los motivos de no venta y, debajo, la cadena comercial. Este módulo compone lo que
// ya se mide —`dineroDelMes`, `tasaDeCancelacion`, `cadenaDeCierre`, `cicloHastaLaCita`, `cierrePorCloser` y
// `motivosDeNoVenta`— y arma con eso lo que la pantalla dibuja. La ruta y el cerebro leen esta misma lectura,
// así que lo que el cerebro dice de una cifra es lo que la pantalla dibuja (S15-14).
//
// Tiene dos mitades, como `lib/negocio/pasosDeConversion.ts`: `armarSales`, pura y probada sin base, y
// `lecturaDeSales`, que lee.
//
// ── DE QUIÉN SON LAS CIFRAS ───────────────────────────────────────────────────
//
//   · **Asistencias** sale de la cancelación, que cuenta las citas de TODA la empresa en la ventana. Sin ninguna
//     cita con la asistencia respondida es «—» y no cero: nadie respondió la pregunta (S15-05).
//   · **Ventas, Revenue y Tasa de cierre** son lo que registraron los closers configurados: la misma población
//     que `dineroDelMes`. No son un total de la empresa sacado de sumar la tabla de citas —eso la tabla no lo
//     publica, porque sus filas no cubren todas las citas—: son los resultados registrados, que sólo registran
//     los closers. Sin ningún resultado en la ventana es «—»; con resultados y sin ventas, cero medido (S15-06 a
//     S15-08).
//
// Todo lo que viaja en `pantalla` va de 0 a 1. La cancelación sigue viajando también entera, de 0 a 100, en su
// propio objeto: la función la comparten Conversation, Closer y el cerebro, y su contrato no cambia (S15-13).
// ═══════════════════════════════════════════════════════════════════════════════

import { closersDeLaEmpresa, type CloserConfigurado } from './alcanceDelCloser.ts';
import { cadenaDeCierre, type CadenaDeCierre } from './cadenaDeCierre.ts';
import { cicloHastaLaCita, type CicloHastaLaCita } from './cicloHastaLaCita.ts';
import { cierrePorCloser, type CierreDeLosClosers } from './cierrePorCloser.ts';
import { dineroDelMes, type DineroDelMes } from './dineroDelMes.ts';
import { type Cancelacion, PISO_DE_UNA_TASA, tasaDeCancelacion } from './indicadoresDeCitas.ts';
import { motivosDeNoVenta, type MotivosDeNoVenta } from './motivosDeNoVenta.ts';

// ─── Los tipos ──────────────────────────────────────────────────────────────

/**
 * Por qué una cifra no tiene valor: `sin_asistencia` —nadie marcó la asistencia—, `sin_registros` —nadie registró
 * un resultado en la ventana— o `bajo_el_piso` —hay registros, pocos para una tasa—. La frase la elige la pantalla
 * de su lista cerrada (S15-02).
 */
export type MotivoDeLaCifra = 'sin_asistencia' | 'sin_registros' | 'bajo_el_piso';

export interface CifraDeSales {
  /** Un conteo, un monto o una proporción de 0 a 1. `null`: «—», y el motivo dice por qué. */
  valor: number | null;
  motivo: MotivoDeLaCifra | null;
}

/** Las cuatro del prototipo, en su orden (`aios-command-center_1.html:2948-2953`). */
export interface CifrasDeSales {
  asistencias: CifraDeSales;
  tasaDeCierre: CifraDeSales;
  ventas: CifraDeSales;
  revenue: CifraDeSales;
}

/** Una fila de la tabla «Closers», con las seis columnas del prototipo (S15-09). */
export interface FilaDeCloser {
  usuarioId: string;
  nombre: string;
  /** Los contactos que el CRM le asigna: la subfila «{N} contactos asignados». `null` sin vínculo. */
  contactos: number | null;
  /** Sus citas en la ventana, por el eje del CRM. `null` sin vínculo. */
  agendadas: number | null;
  asistieron: CifraDeSales;
  ventas: CifraDeSales;
  cierre: CifraDeSales;
  revenue: CifraDeSales;
  /** La nota de la fila, que escribe `cierrePorCloser`. */
  aviso: string | null;
}

/** Dos términos y su proporción, de 0 a 1. `null` sin denominador. */
export interface Proporcion {
  con: number;
  sobre: number;
  porcion: number | null;
}

/** La tarjeta de abajo: lo que la pantalla de hoy mide y el prototipo no tenía (S15-12). */
export interface ComercialDeSales {
  cobertura: { cohorte: Proporcion; tabla: Proporcion };
  cancelacion: { citas: number; canceladas: number; tasa: number | null; aviso: string | null };
  ciclo: { p50: number | null; p90: number | null; cobertura: Proporcion; avisoDelTecho: string | null; aviso: string | null };
}

export interface PantallaDeSalesArmada {
  cifras: CifrasDeSales;
  closers: { filas: FilaDeCloser[]; aviso: string | null };
  /** Los motivos, con «{N} sin venta»: los resultados de los closers en la ventana que no son una venta. */
  motivos: MotivosDeNoVenta & { sinVenta: number };
  comercial: ComercialDeSales;
}

export interface EntradaDeSales {
  cancelacion: Cancelacion;
  cadena: CadenaDeCierre;
  ciclo: CicloHastaLaCita;
  closers: CierreDeLosClosers;
  motivos: MotivosDeNoVenta;
}

// ─── Las cuentas, puras ─────────────────────────────────────────────────────

const conValor = (valor: number): CifraDeSales => ({ valor, motivo: null });
const sinValor = (motivo: MotivoDeLaCifra | null): CifraDeSales => ({ valor: null, motivo });

function proporcion(con: number, sobre: number): Proporcion {
  return { con, sobre, porcion: sobre === 0 ? null : con / sobre };
}

/** Ventas sobre intentos, con el piso del denominador. */
function cierre(ventas: number, intentos: number): CifraDeSales {
  if (intentos === 0) return sinValor('sin_registros');
  if (intentos < PISO_DE_UNA_TASA) return sinValor('bajo_el_piso');
  return conValor(ventas / intentos);
}

/** Lo que dibuja la pantalla, desde lo leído. Sin base: la prueba lo arma con números a mano. */
export function armarSales(e: EntradaDeSales): PantallaDeSalesArmada {
  const filas = e.closers.filas;
  const intentos = filas.reduce((s, f) => s + f.intentos, 0);
  const ventas = filas.reduce((s, f) => s + f.ventas, 0);
  const monto = filas.reduce((s, f) => s + f.montoDeVentas, 0);

  const cifras: CifrasDeSales = {
    asistencias:
      e.cancelacion.conAsistencia === 0 ? sinValor('sin_asistencia') : conValor(e.cancelacion.sePresentaron),
    tasaDeCierre: cierre(ventas, intentos),
    ventas: intentos === 0 ? sinValor('sin_registros') : conValor(ventas),
    revenue: intentos === 0 ? sinValor('sin_registros') : conValor(monto),
  };

  const tabla: FilaDeCloser[] = filas.map((f) => ({
    usuarioId: f.usuarioId,
    nombre: f.nombre,
    contactos: f.contactos,
    agendadas: f.citas,
    /* Sin vínculo con el CRM no hay citas que mirar: «—» sin motivo, y la nota de la fila dice por qué. */
    asistieron:
      f.conAsistencia === null
        ? sinValor(null)
        : f.conAsistencia === 0
          ? sinValor('sin_asistencia')
          : conValor(f.sePresentaron ?? 0),
    ventas: f.intentos === 0 ? sinValor('sin_registros') : conValor(f.ventas),
    cierre: cierre(f.ventas, f.intentos),
    revenue: f.intentos === 0 ? sinValor('sin_registros') : conValor(f.montoDeVentas),
    aviso: f.aviso,
  }));

  const ciclo = e.ciclo;
  return {
    cifras,
    closers: { filas: tabla, aviso: e.closers.aviso },
    motivos: { ...e.motivos, sinVenta: intentos - ventas },
    comercial: {
      cobertura: {
        cohorte: proporcion(e.cadena.coberturaDeLaCohorte.con, e.cadena.coberturaDeLaCohorte.sobre),
        tabla: proporcion(e.closers.coberturaDeLaTabla.con, e.closers.coberturaDeLaTabla.sobre),
      },
      /* La tasa de la función viaja de 0 a 100 con un decimal; acá pasa a 0 a 1, una vez. */
      cancelacion: {
        citas: e.cancelacion.citas,
        canceladas: e.cancelacion.canceladas,
        tasa: e.cancelacion.tasa === null ? null : e.cancelacion.tasa / 100,
        aviso: e.cancelacion.aviso,
      },
      ciclo: {
        p50: ciclo.p50,
        p90: ciclo.p90,
        cobertura: proporcion(ciclo.cobertura.con, ciclo.cobertura.sobre),
        avisoDelTecho: ciclo.avisoDelTecho,
        aviso: ciclo.aviso,
      },
    },
  };
}

// ─── La lectura ─────────────────────────────────────────────────────────────

export interface LecturaDeSales {
  dinero: DineroDelMes;
  cancelacion: Cancelacion;
  cadena: CadenaDeCierre;
  ciclo: CicloHastaLaCita;
  closers: CierreDeLosClosers;
  motivos: MotivosDeNoVenta;
  /** Lo que dibuja el front del prototipo. */
  pantalla: PantallaDeSalesArmada;
}

/**
 * Lo que lee la pantalla de Sales en una ventana. Corre dentro de `conOrganizacion`.
 *
 * Los closers se leen una vez: el sujeto del dinero, las filas de la tabla y los motivos tienen que hablar de las
 * mismas personas. Sin closers, el sujeto del dinero es `nadie`, que es lo que hace que salga «—» con su motivo.
 */
export async function lecturaDeSales(dias: number, zonaHoraria: string): Promise<LecturaDeSales> {
  const catalogo: CloserConfigurado[] = await closersDeLaEmpresa();
  const sujeto =
    catalogo.length === 0
      ? ({ tipo: 'nadie' } as const)
      : ({ tipo: 'empresa', usuarioIds: catalogo.map((k) => k.usuarioId) } as const);

  const dinero = await dineroDelMes(zonaHoraria, sujeto);
  const cancelacion = await tasaDeCancelacion(dias);
  const cadena = await cadenaDeCierre(dias);
  const ciclo = await cicloHastaLaCita(dias);
  const closers = await cierrePorCloser(dias, catalogo);
  const motivos = await motivosDeNoVenta(dias, catalogo);

  return {
    dinero,
    cancelacion,
    cadena,
    ciclo,
    closers,
    motivos,
    pantalla: armarSales({ cancelacion, cadena, ciclo, closers, motivos }),
  };
}
