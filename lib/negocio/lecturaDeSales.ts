// La lectura única de Sales: lo que dibuja el front del prototipo, hecho en el servidor.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ ES, Y POR QUÉ UNA SOLA
//
// La pestaña vuelve al front del prototipo (`docs/sales/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`): cuatro
// cifras, la tabla de closers, los motivos de no venta y, debajo, la cadena comercial. Este módulo compone lo que
// ya se mide —`dineroDelMes`, `tasaDeCancelacion`, `cadenaDeCierre`, `cicloHastaLaCita`, `cierrePorCloser`,
// `motivosDeLasLlamadas` y `motivosDeNoVenta`— y arma con eso lo que la pantalla dibuja. La ruta lee la lectura entera; las herramientas
// del cerebro que publican lo armado —las cuatro cifras con la tabla, y los motivos— leen su mitad del cierre,
// `lecturaDelCierre`, que es la misma que la lectura entera usa: lo que el cerebro dice de una cifra es lo que la
// pantalla dibuja (S15-14), sin cargar con la cadena, el ciclo ni el dinero, que esas herramientas no publican.
//
// Tiene dos mitades, como `lib/negocio/pasosDeConversion.ts`: `armarCierre` y `armarSales`, puras y probadas sin
// base, y `lecturaDelCierre` y `lecturaDeSales`, que leen.
//
// ── DE QUIÉN SON LAS CIFRAS ───────────────────────────────────────────────────
//
//   · **Asistencias** sale de la cancelación, que cuenta las citas de TODA la empresa en la ventana. Sin ninguna
//     cita es «—» porque no hubo citas; con citas y ninguna con la asistencia respondida, «—» porque nadie
//     respondió la pregunta. Ninguno de los dos es cero (S15-05).
//   · **Ventas, Revenue y Tasa de cierre** son lo que registraron los closers configurados: la misma población
//     que `dineroDelMes`. No son un total de la empresa sacado de sumar la tabla de citas —eso la tabla no lo
//     publica, porque sus filas no cubren todas las citas—: son los resultados registrados, que sólo registran
//     los closers. Sin closers configurados es «—» porque no hay de quién; sin ningún resultado en la ventana,
//     «—» porque nadie registró; con resultados y sin ventas, cero medido (S15-06 a S15-08). Una venta sin monto
//     deja al revenue en «—»: sumarla como cero publicaría un monto más chico que el reportado.
//
// **Los motivos de no venta** de la pantalla son los de las llamadas HT sin cierre (S15-19, `motivosDeLasLlamadas`);
// los que el closer registra en Avanzar viajan aparte, como `registrados`, y los da el agente (S15-22).
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
import { motivosDeLasLlamadas, type MotivosDeLasLlamadas } from './motivosDeLasLlamadas.ts';
import { motivosDeNoVenta, type MotivosDeNoVenta } from './motivosDeNoVenta.ts';

// ─── Los tipos ──────────────────────────────────────────────────────────────

/**
 * Por qué una cifra no tiene valor: `sin_closers` —no hay closers configurados—, `sin_citas` —no hubo citas en la
 * ventana—, `sin_asistencia` —hubo y nadie marcó la asistencia—, `sin_registros` —nadie registró un resultado en
 * la ventana—, `bajo_el_piso` —hay registros, pocos para una tasa— o `venta_sin_monto` —alguna venta no trae su
 * monto—. La frase la elige la pantalla de su lista cerrada (S15-02).
 */
export type MotivoDeLaCifra = 'sin_closers' | 'sin_citas' | 'sin_asistencia' | 'sin_registros' | 'bajo_el_piso' | 'venta_sin_monto';

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

/**
 * Lo de la tarjeta de abajo que se arma acá: las coberturas, la cancelación de 0 a 1 y el ciclo. Los eslabones de
 * la cadena y el dinero del mes la pantalla los lee de sus bloques de siempre, que ya viajan hechos. Desde SA-8 la
 * tarjeta dibuja sólo la cancelación, la mediana y el cobrado (S15-20); las coberturas, el p90 y los avisos viajan
 * para el agente.
 */
export interface ComercialDeSales {
  cobertura: { cohorte: Proporcion; tabla: Proporcion };
  cancelacion: { citas: number; canceladas: number; tasa: number | null; aviso: string | null };
  ciclo: { p50: number | null; p90: number | null; cobertura: Proporcion; avisoDelTecho: string | null; aviso: string | null };
}

/** Lo que publican las cuatro cifras, la tabla y los motivos: lo que lee también el cerebro. */
export interface CierreArmado {
  cifras: CifrasDeSales;
  closers: { filas: FilaDeCloser[]; aviso: string | null };
  /** Los motivos de no venta de la tarjeta: las llamadas HT sin cierre, por categoría de objeción (S15-19). */
  motivos: MotivosDeLasLlamadas;
  /**
   * Los «No le interesa» que registraron los closers, con «{N} sin venta»: los resultados de la ventana que no son
   * una venta. No se dibujan; los da el agente de Sales (S15-22).
   */
  registrados: MotivosDeNoVenta & { sinVenta: number };
}

export interface PantallaDeSalesArmada extends CierreArmado {
  comercial: ComercialDeSales;
}

export interface EntradaDelCierre {
  cancelacion: Cancelacion;
  closers: CierreDeLosClosers;
  motivos: MotivosDeNoVenta;
  llamadas: MotivosDeLasLlamadas;
}

export interface EntradaDeSales extends EntradaDelCierre {
  cadena: CadenaDeCierre;
  ciclo: CicloHastaLaCita;
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

/** Un monto reportado: sin ninguna venta sin monto, la suma; con alguna, «—» con su motivo. */
function monto(suma: number, sinMonto: number): CifraDeSales {
  return sinMonto > 0 ? sinValor('venta_sin_monto') : conValor(suma);
}

/**
 * Las cuatro cifras, la tabla y los motivos, desde lo leído. Sin base: la prueba lo arma con números a mano.
 *
 * Los montos de las filas llegan exactos —la base los suma en `numeric`—, pero su suma acá es de JavaScript y
 * dejaría colas de coma flotante (`2300.0000000000005`) en lo que lee el cerebro: se redondea a centavos.
 */
export function armarCierre(e: EntradaDelCierre): CierreArmado {
  const filas = e.closers.filas;
  const intentos = filas.reduce((s, f) => s + f.intentos, 0);
  const ventas = filas.reduce((s, f) => s + f.ventas, 0);
  const suma = Math.round(filas.reduce((s, f) => s + f.montoDeVentas, 0) * 100) / 100;
  const sinMonto = filas.reduce((s, f) => s + f.ventasSinMonto, 0);
  const sinClosers = filas.length === 0;

  const cifras: CifrasDeSales = {
    asistencias:
      e.cancelacion.citas === 0
        ? sinValor('sin_citas')
        : e.cancelacion.conAsistencia === 0
          ? sinValor('sin_asistencia')
          : conValor(e.cancelacion.sePresentaron),
    tasaDeCierre: sinClosers ? sinValor('sin_closers') : cierre(ventas, intentos),
    ventas: sinClosers ? sinValor('sin_closers') : intentos === 0 ? sinValor('sin_registros') : conValor(ventas),
    revenue: sinClosers ? sinValor('sin_closers') : intentos === 0 ? sinValor('sin_registros') : monto(suma, sinMonto),
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
        : f.citas === 0
          ? sinValor('sin_citas')
          : f.conAsistencia === 0
            ? sinValor('sin_asistencia')
            : conValor(f.sePresentaron ?? 0),
    ventas: f.intentos === 0 ? sinValor('sin_registros') : conValor(f.ventas),
    cierre: cierre(f.ventas, f.intentos),
    revenue: f.intentos === 0 ? sinValor('sin_registros') : monto(f.montoDeVentas, f.ventasSinMonto),
    aviso: f.aviso,
  }));

  return {
    cifras,
    closers: { filas: tabla, aviso: e.closers.aviso },
    motivos: e.llamadas,
    registrados: { ...e.motivos, sinVenta: intentos - ventas },
  };
}

/** Lo que dibuja la pantalla, desde lo leído. Sin base: la prueba lo arma con números a mano. */
export function armarSales(e: EntradaDeSales): PantallaDeSalesArmada {
  const ciclo = e.ciclo;
  return {
    ...armarCierre(e),
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

/**
 * El sujeto del dinero: los closers de la empresa, o `nadie` sin ninguno. `{tipo:'empresa'}` con la lista vacía no
 * puede llegar a la consulta —un `in ()` es SQL inválido—, y `nadie` es el estado que hace que el dinero salga «—»
 * con su motivo en vez de cero. Lo comparten esta lectura y la herramienta `dinero_del_mes` del cerebro.
 */
export function sujetoDelDinero(catalogo: readonly CloserConfigurado[]) {
  return catalogo.length === 0
    ? ({ tipo: 'nadie' } as const)
    : ({ tipo: 'empresa', usuarioIds: catalogo.map((k) => k.usuarioId) } as const);
}

export interface LecturaDelCierre extends EntradaDelCierre {
  /** Los closers configurados, leídos una vez: la tabla y los motivos hablan de las mismas personas. */
  catalogo: CloserConfigurado[];
  cierre: CierreArmado;
}

/** La mitad del cierre: lo que leen las cuatro cifras, la tabla y los motivos. Corre dentro de `conOrganizacion`. */
export async function lecturaDelCierre(dias: number): Promise<LecturaDelCierre> {
  const catalogo: CloserConfigurado[] = await closersDeLaEmpresa();
  const cancelacion = await tasaDeCancelacion(dias);
  const closers = await cierrePorCloser(dias, catalogo);
  const motivos = await motivosDeNoVenta(dias, catalogo);
  const llamadas = await motivosDeLasLlamadas(dias);
  return { catalogo, cancelacion, closers, motivos, llamadas, cierre: armarCierre({ cancelacion, closers, motivos, llamadas }) };
}

export interface LecturaDeSales {
  dinero: DineroDelMes;
  cancelacion: Cancelacion;
  cadena: CadenaDeCierre;
  ciclo: CicloHastaLaCita;
  closers: CierreDeLosClosers;
  motivos: MotivosDeNoVenta;
  llamadas: MotivosDeLasLlamadas;
  /** Lo que dibuja el front del prototipo. */
  pantalla: PantallaDeSalesArmada;
}

/**
 * Lo que lee la pantalla de Sales en una ventana. Corre dentro de `conOrganizacion`.
 *
 * Los closers se leen una vez, en la mitad del cierre: el sujeto del dinero, las filas de la tabla y los motivos
 * tienen que hablar de las mismas personas. Sin closers, el sujeto del dinero es `nadie`, que es lo que hace que
 * salga «—» con su motivo.
 */
export async function lecturaDeSales(dias: number, zonaHoraria: string): Promise<LecturaDeSales> {
  const { catalogo, cancelacion, closers, motivos, llamadas } = await lecturaDelCierre(dias);
  const dinero = await dineroDelMes(zonaHoraria, sujetoDelDinero(catalogo));
  const cadena = await cadenaDeCierre(dias);
  const ciclo = await cicloHastaLaCita(dias);

  return {
    dinero,
    cancelacion,
    cadena,
    ciclo,
    closers,
    motivos,
    llamadas,
    pantalla: armarSales({ cancelacion, cadena, ciclo, closers, motivos, llamadas }),
  };
}
