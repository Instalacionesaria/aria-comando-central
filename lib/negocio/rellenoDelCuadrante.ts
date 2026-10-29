// El relleno del cuadrante del ICP para los calificados viejos: a quién, con qué valor, y cómo se escribe y se deshace.
//
// ═══════════════════════════════════════════════════════════════════════════════
// QUÉ PROBLEMA RESUELVE (decisión del usuario, 2026-10-29)
//
// Hasta el 2026-10-26 «calificado» era agendó y no descartado (`tieneCitaAlcanzable` y no `contactoDescartado`). Desde
// la `105` también hace falta un cuadrante calificado, que pone GoHighLevel en el campo «Cuadrante de Clasificacion»
// (`CLAVE_DEL_CUADRANTE`). Medido en producción el 2026-10-29: 156 calificados con la regla vieja y 1 con la nueva; 155
// de ellos sin cuadrante, y 148 con la primera reserva antes del 2026-10-26.
//
// Escribir sólo en nuestra base no sirve: la sincronización pisa `cuadrante` con lo que trae el CRM cada diez minutos.
// Así que el valor se escribe EN EL CAMPO DEL CRM y el contacto se relee por el camino normal (`refrescarUnContacto`).
//
// ── EL ALCANCE Y EL VALOR, DEL USUARIO ──────────────────────────────────────
//
//   · a quién: agendó (una cita alcanzable), sin etiqueta de descarte, sin cuadrante, y con la PRIMERA reserva —la menor
//     `coalesce(reservada_el, inicio_el)` de sus citas alcanzables— antes del corte (por omisión el 2026-10-26, a la
//     medianoche UTC, como la medición). Los que reservaron después entraron con el clasificador andando: rellenarlos
//     taparía que GoHighLevel no los clasificó;
//   · el valor, por el puntaje viejo del ICP: 75 o más → Prioriza; de 50 a menos de 75 → Valida; el resto, y sin
//     puntaje, → Descarta.
//
// Los predicados son los de `citasAlcanzables.ts` (`alcanzable`, `tieneCitaAlcanzable`, `contactoDescartado`,
// `todasSusCitasCanceladas`, que usa la lista completa de estados cancelados): un «agendó» copiado acá divergiría.
//
// ── LA HISTORIA DICE QUE FUE UNA PERSONA (la `109`) ─────────────────────────
//
// La relectura pasa por los disparadores de la `106`. Con `comoPersona`, la transacción pone las variables que la `109`
// lee: la clasificación queda con origen `persona` (y el evento con actor `persona`), y la respuesta del campo del
// cuadrante con `obtenida_por = 'persona'`. Los otros campos que cambien en la misma relectura siguen siendo del CRM.
//
// ── NADA DE ESTO CORRE SOLO ─────────────────────────────────────────────────
//
// Lo usa sólo `scripts/clasificar-calificados-viejos.mjs`, a mano, con `--escribir`. Ninguna ruta ni tarea lo llama.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';

import { conOrganizacion, datos } from '../datos/contexto.ts';
import {
  camposDelContacto,
  contactoPorId,
  escribirCampoDelContacto,
  type FalloDeGhl,
  type ValorDelCuadranteEnElCrm,
} from '../ghl/cliente.ts';
import { cuentaDe, type AmbitoDeUnCliente } from './ambitoDelCliente.ts';
import { alcanzable, contactoDescartado, tieneCitaAlcanzable, todasSusCitasCanceladas } from './citasAlcanzables.ts';
import { cuadranteDeUnValor } from './cuadrantesDelIcp.ts';
import { refrescarUnContacto } from './sincronizar.ts';

/** El corte por omisión: el día que entró el cuadrante (la `105`). */
export const CORTE_POR_OMISION = '2026-10-26';

/** Desde este puntaje viejo, Prioriza. */
export const PUNTAJE_DE_PRIORIZA = 75;
/** Desde este puntaje viejo (y por debajo del de Prioriza), Valida. */
export const PUNTAJE_DE_VALIDA = 50;

/** Lo que el relleno escribe: nunca Financia (el puntaje viejo no la distingue) ni el vacío. */
export type ValorDelRelleno = 'Prioriza' | 'Valida' | 'Descarta';

/**
 * El valor del relleno para un puntaje viejo. Sin puntaje (o con uno que no es un número), Descarta: así lo decidió el
 * usuario, y un número inventado sería peor.
 */
export function valorPorPuntaje(score: number | null | undefined): ValorDelRelleno {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'Descarta';
  if (score >= PUNTAJE_DE_PRIORIZA) return 'Prioriza';
  if (score >= PUNTAJE_DE_VALIDA) return 'Valida';
  return 'Descarta';
}

/** El corte como instante: `AAAA-MM-DD` a la medianoche UTC. Lanza con cualquier otra forma. */
export function corteDe(fecha: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error(`el corte «${fecha}» no es una fecha AAAA-MM-DD`);
  const d = new Date(`${fecha}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== fecha) throw new Error(`el corte «${fecha}» no es una fecha válida`);
  return d;
}

/** Un contacto a rellenar. Sin nombre: el relleno no lo necesita y nada de lo que imprime debe poder mostrarlo. */
export interface Candidato {
  contactoId: string;
  ghlContactId: string;
  score: number | null;
  territorio: string | null;
  primeraReserva: Date;
  /** Todas sus citas alcanzables están canceladas. La regla vieja lo contaba igual. */
  soloCanceladas: boolean;
  /** El CRM ya no lo tiene (la `108`): se saltea sin llamar. */
  conBaja: boolean;
  valor: ValorDelRelleno;
}

/** La primera reserva del contacto `alias`: la menor reserva (o inicio) de sus citas alcanzables. */
function primeraReserva(alias: string) {
  const a = sql.raw(alias);
  return sql<Date | null>`(select min(coalesce(pr.reservada_el, pr.inicio_el)) from negocio.citas pr
                            where pr.org_id = ${a}.org_id and pr.contacto_id = ${a}.id and ${alcanzable('pr')})`;
}

/**
 * Los candidatos del relleno a la vista (en `conOrganizacion(`, con el ámbito de UN cliente). La primera reserva más
 * vieja primero; a igualdad, por id, para que dos corridas recorran a los que quedan en el mismo orden.
 */
export async function candidatosDelRelleno(opciones: {
  antesDe: Date;
  sinSoloCanceladas?: boolean;
  solo?: string;
}): Promise<Candidato[]> {
  const { rows } = await sql<{
    id: string;
    ghl_contact_id: string;
    score: number | null;
    territorio: string | null;
    primera_reserva: Date;
    solo_canceladas: boolean;
    con_baja: boolean;
  }>`
    select c.id, c.ghl_contact_id, c.score, c.territorio,
           ${primeraReserva('c')} as primera_reserva,
           ${todasSusCitasCanceladas('c')} as solo_canceladas,
           c.baja_en_el_crm is not null as con_baja
      from negocio.contactos c
     where ${tieneCitaAlcanzable('c')}
       and not ${contactoDescartado('c')}
       and c.cuadrante is null
       and ${primeraReserva('c')} < ${opciones.antesDe}
       ${opciones.sinSoloCanceladas ? sql`and not ${todasSusCitasCanceladas('c')}` : sql``}
       ${opciones.solo === undefined ? sql`` : sql`and c.ghl_contact_id = ${opciones.solo}`}
     order by primera_reserva, c.id`.execute(datos());
  return rows.map((f) => ({
    contactoId: f.id,
    ghlContactId: f.ghl_contact_id,
    score: f.score === null ? null : Number(f.score),
    territorio: f.territorio,
    primeraReserva: new Date(f.primera_reserva),
    soloCanceladas: f.solo_canceladas,
    conBaja: f.con_baja,
    valor: valorPorPuntaje(f.score === null ? null : Number(f.score)),
  }));
}

/** Los conteos del relleno en seco: a cuántos, con qué valor, y cuántos quedan afuera y por qué. Sin nombres ni ids. */
export interface ResumenDelRelleno {
  /** Con alguna cita alcanzable: la población de la regla vieja antes de mirar el descarte. */
  agendaron: number;
  /** Afuera: ya tienen cuadrante (el CRM los clasificó). */
  yaClasificados: number;
  /** Afuera: sin cuadrante y descartados por una etiqueta. */
  descartadosPorEtiqueta: number;
  /** Afuera: su primera reserva es del corte o después. */
  desdeElCorte: number;
  /** Afuera, sólo con `--sin-solo-canceladas`: todas sus citas alcanzables canceladas. */
  soloCanceladasExcluidos: number;
  candidatos: number;
  porValor: Record<ValorDelRelleno, number>;
  /** De los candidatos: congelados (sin territorio), sólo con citas canceladas, y con baja en el CRM. */
  congelados: number;
  soloCanceladas: number;
  conBaja: number;
}

/** El resumen de `candidatosDelRelleno` con las mismas reglas, para el seco. En `conOrganizacion(`. */
export async function resumenDelRelleno(opciones: { antesDe: Date; sinSoloCanceladas?: boolean }): Promise<ResumenDelRelleno> {
  const { rows } = await sql<{
    agendaron: number;
    ya_clasificados: number;
    descartados_por_etiqueta: number;
    desde_el_corte: number;
    solo_canceladas_excluidos: number;
  }>`
    with agendaron as (
      select c.cuadrante, ${contactoDescartado('c')} as descartado, ${primeraReserva('c')} as primera,
             ${todasSusCitasCanceladas('c')} as solo_canceladas
        from negocio.contactos c
       where ${tieneCitaAlcanzable('c')}
    )
    select count(*)::int as agendaron,
           count(*) filter (where cuadrante is not null)::int as ya_clasificados,
           count(*) filter (where cuadrante is null and descartado)::int as descartados_por_etiqueta,
           count(*) filter (where cuadrante is null and not descartado and primera >= ${opciones.antesDe})::int as desde_el_corte,
           count(*) filter (where cuadrante is null and not descartado and primera < ${opciones.antesDe}
                              and ${opciones.sinSoloCanceladas ? sql`solo_canceladas` : sql`false`})::int as solo_canceladas_excluidos
      from agendaron`.execute(datos());
  const candidatos = await candidatosDelRelleno(opciones);
  const porValor: Record<ValorDelRelleno, number> = { Prioriza: 0, Valida: 0, Descarta: 0 };
  for (const c of candidatos) porValor[c.valor]++;
  const f = rows[0]!;
  return {
    agendaron: f.agendaron,
    yaClasificados: f.ya_clasificados,
    descartadosPorEtiqueta: f.descartados_por_etiqueta,
    desdeElCorte: f.desde_el_corte,
    soloCanceladasExcluidos: f.solo_canceladas_excluidos,
    candidatos: candidatos.length,
    porValor,
    congelados: candidatos.filter((c) => c.territorio === null).length,
    soloCanceladas: candidatos.filter((c) => c.soloCanceladas).length,
    conBaja: candidatos.filter((c) => c.conBaja).length,
  };
}

/**
 * Por qué un contacto NO es candidato (para `--solo`), con las mismas reglas. `null` = sí lo es. En `conOrganizacion(`.
 */
export async function porQueNoEsCandidato(ghlContactId: string, opciones: { antesDe: Date; sinSoloCanceladas?: boolean }): Promise<string | null> {
  const { rows } = await sql<{ agendo: boolean; clasificado: boolean; descartado: boolean; primera: Date | null; solo_canceladas: boolean }>`
    select ${tieneCitaAlcanzable('c')} as agendo, c.cuadrante is not null as clasificado,
           ${contactoDescartado('c')} as descartado, ${primeraReserva('c')} as primera,
           ${todasSusCitasCanceladas('c')} as solo_canceladas
      from negocio.contactos c
     where c.ghl_contact_id = ${ghlContactId}`.execute(datos());
  const f = rows[0];
  if (!f) return 'no está en la base de este cliente';
  if (!f.agendo) return 'no tiene ninguna cita alcanzable';
  if (f.clasificado) return 'ya tiene cuadrante';
  if (f.descartado) return 'está descartado por una etiqueta';
  if (f.primera === null || new Date(f.primera) >= opciones.antesDe) return 'su primera reserva es del corte o después';
  if (opciones.sinSoloCanceladas && f.solo_canceladas) return 'todas sus citas están canceladas';
  return null;
}

/**
 * Corre `trabajo` como una persona: pone las variables de transacción que lee la `109`, así la clasificación queda con
 * origen `persona` y la respuesta del campo `campoId` con `obtenida_por = 'persona'`.
 *
 * **Tiene que correr dentro de `conOrganizacion(`**: `set_config(…, true)` fuera de una transacción tiene éxito y no hace
 * nada (`contexto.ts`). Adentro, revierte al terminar la transacción: la siguiente escritura de esa conexión vuelve a ser
 * del CRM. Se verifica la lectura de vuelta, como `conOrganizacion` con la suya.
 */
export async function comoPersona<T>(campoId: string, trabajo: () => Promise<T>): Promise<T> {
  const { rows } = await sql<{ origen: string; via: string; campo: string }>`
    select set_config('negocio.origen_de_clasificacion', 'persona', true) as origen,
           set_config('negocio.obtenida_por', 'persona', true) as via,
           set_config('negocio.obtenida_por_campo', ${campoId}, true) as campo`.execute(datos());
  if (rows[0]?.origen !== 'persona' || rows[0]?.via !== 'persona' || rows[0]?.campo !== campoId) {
    throw new Error('comoPersona: las variables de la transacción no quedaron puestas');
  }
  return trabajo();
}

/** Una línea del diario (JSONL): lo necesario para deshacer y para contar, sin nombres. */
export interface LineaDelDiario {
  accion: 'escrito' | 'deshecho';
  cuentaId: string;
  contactoId: string | null;
  ghlContactId: string;
  campoId: string;
  valorAnterior: string;
  valorNuevo: string;
  territorioAntes: string | null;
  territorioDespues: string | null;
  /** El cuadrante que quedó en nuestra base después de releer: la única prueba de que el CRM lo escribió. */
  cuadranteDespues: string | null;
  /** Cómo terminó la relectura: listo, no_esta_en_el_crm, salteado o el tipo del fallo. */
  relectura: string;
  el: string;
}

/** Cómo terminó una corrida. */
export interface TotalesDelRelleno {
  /** PUT aceptados por el CRM (cuentan para el tope). */
  escritos: number;
  /** De ésos, cuántos quedaron con el valor en nuestra base después de releer. */
  quedaron: number;
  /** De ésos, cuántos se descongelaron (sin territorio antes, con territorio después). */
  descongelados: number;
  porValor: Record<string, number>;
  salteados: Record<string, number>;
  /** Por qué se cortó la corrida (401, 403 o 429), o `null`. */
  cortada: string | null;
}

const vacios = (): TotalesDelRelleno => ({ escritos: 0, quedaron: 0, descongelados: 0, porValor: {}, salteados: {}, cortada: null });

const sumar = (m: Record<string, number>, k: string) => {
  m[k] = (m[k] ?? 0) + 1;
};

/** Un 401, 403 o 429 vale para todos los que faltan: se corta en vez de gastar el resto en el mismo rechazo. */
function corta(f: FalloDeGhl): string | null {
  if (f.tipo === 'no_autorizado') return `el CRM rechazó el token (${f.estado})`;
  if (f.tipo === 'demasiadas_peticiones') return `el CRM pidió esperar (${f.estado})`;
  return null;
}

/** El valor del campo en el contacto que devolvió el CRM: el texto, o `''` si no lo tiene. */
function valorEnElCrm(c: Parameters<typeof camposDelContacto>[0], campoId: string): string {
  return camposDelContacto(c)[campoId] ?? '';
}

/** Relee como persona y devuelve lo que quedó: el territorio y el cuadrante de nuestra base. */
async function releerComoPersona(
  ambito: AmbitoDeUnCliente,
  acceso: { token: string; locationId: string },
  ghlContactId: string,
  campoId: string,
): Promise<{ relectura: string; territorio: string | null; cuadrante: string | null; fallo: FalloDeGhl | null }> {
  return conOrganizacion(ambito, () =>
    comoPersona(campoId, async () => {
      const r = await refrescarUnContacto(acceso, ghlContactId);
      const fila = await datos()
        .selectFrom('contactos')
        .select(['territorio', 'cuadrante'])
        .where('ghl_contact_id', '=', ghlContactId)
        .executeTakeFirst();
      return {
        relectura: r.tipo === 'fallo' ? r.fallo.tipo : r.tipo,
        territorio: fila?.territorio ?? null,
        cuadrante: fila?.cuadrante ?? null,
        fallo: r.tipo === 'fallo' ? r.fallo : null,
      };
    }),
  );
}

/**
 * Escribe el valor de cada candidato en el CRM, de a uno y en orden, y relee cada contacto como persona.
 *
 * Por contacto: con baja en el CRM se saltea sin llamar; un GET de precondición (404 → se saltea; si el campo YA tiene un
 * valor en el CRM, no se escribe: se relee como CRM para que nuestra base lo alcance y se saltea); el PUT; la relectura
 * con `comoPersona`; y UNA línea en el diario. Un 401, 403 o 429 corta la corrida. `tope` cuenta los PUT aceptados.
 */
export async function correrElRelleno(opciones: {
  ambito: AmbitoDeUnCliente;
  acceso: { token: string; locationId: string };
  campoId: string;
  candidatos: readonly Candidato[];
  tope: number;
  pausaMs: number;
  anotar: (linea: LineaDelDiario) => void;
  dormir?: (ms: number) => Promise<void>;
}): Promise<TotalesDelRelleno> {
  const { ambito, acceso, campoId, anotar } = opciones;
  const dormir = opciones.dormir ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const t = vacios();
  const cuentaId = cuentaDe(ambito);
  let primero = true;
  for (const c of opciones.candidatos) {
    if (t.escritos >= opciones.tope) break;
    if (c.conBaja) {
      sumar(t.salteados, 'baja_en_el_crm');
      continue;
    }
    if (!primero && opciones.pausaMs > 0) await dormir(opciones.pausaMs);
    primero = false;

    const leido = await contactoPorId(acceso, c.ghlContactId);
    if (leido.tipo === 'fallo') {
      t.cortada = corta(leido.fallo);
      if (t.cortada) break;
      sumar(t.salteados, 'fallo_al_leer');
      continue;
    }
    if (!leido.datos) {
      sumar(t.salteados, 'no_esta_en_el_crm');
      continue;
    }
    if (valorEnElCrm(leido.datos, campoId) !== '') {
      // El CRM ya lo clasificó: no se pisa. Se relee como CRM (sin `comoPersona`) para que la base lo alcance.
      const r = await conOrganizacion(ambito, () => refrescarUnContacto(acceso, c.ghlContactId));
      sumar(t.salteados, 'ya_tiene_valor_en_el_crm');
      if (r.tipo === 'fallo') {
        t.cortada = corta(r.fallo);
        if (t.cortada) break;
      }
      continue;
    }

    const escrito = await escribirCampoDelContacto(acceso, c.ghlContactId, campoId, c.valor as ValorDelCuadranteEnElCrm);
    if (escrito.tipo === 'fallo') {
      t.cortada = corta(escrito.fallo);
      if (t.cortada) break;
      sumar(t.salteados, 'escritura_rechazada');
      continue;
    }
    t.escritos++;
    sumar(t.porValor, c.valor);

    let despues: Awaited<ReturnType<typeof releerComoPersona>> = { relectura: 'excepcion', territorio: null, cuadrante: null, fallo: null };
    try {
      despues = await releerComoPersona(ambito, acceso, c.ghlContactId, campoId);
    } finally {
      // El diario se escribe aunque la relectura lance: el PUT ya ocurrió, y sin su línea no se podría deshacer.
      anotar({
        accion: 'escrito',
        cuentaId,
        contactoId: c.contactoId,
        ghlContactId: c.ghlContactId,
        campoId,
        valorAnterior: '',
        valorNuevo: c.valor,
        territorioAntes: c.territorio,
        territorioDespues: despues.territorio,
        cuadranteDespues: despues.cuadrante,
        relectura: despues.relectura,
        el: new Date().toISOString(),
      });
    }
    if (despues.cuadrante === cuadranteDeUnValor(c.valor)) t.quedaron++;
    if (c.territorio === null && despues.territorio !== null) t.descongelados++;
    if (despues.fallo) {
      t.cortada = corta(despues.fallo);
      if (t.cortada) break;
    }
  }
  return t;
}

/** Lo que el relleno pudo haber escrito: lo único que el deshacer acepta comparar y vaciar. */
const VALORES_ESCRITOS: readonly string[] = ['Prioriza', 'Valida', 'Financia', 'Descarta'];

/**
 * Las líneas `escrito` de un diario, la última por contacto. Las que no tienen forma se ignoran (y se cuentan), y
 * también una con un valor que el relleno no escribe: el deshacer compara `valorNuevo` con el CRM y vacía si coincide,
 * así que un diario ajeno o editado no puede llevarlo a vaciar otra cosa. Si lo último que dice el diario de un
 * contacto es `deshecho` (el mismo archivo usado para escribir y deshacer), ese contacto ya no se deshace otra vez.
 */
export function escritosDelDiario(texto: string): { lineas: LineaDelDiario[]; ilegibles: number } {
  const porContacto = new Map<string, LineaDelDiario | null>();
  let ilegibles = 0;
  for (const cruda of texto.split(/\r?\n/)) {
    if (cruda.trim() === '') continue;
    let l: Partial<LineaDelDiario>;
    try {
      l = JSON.parse(cruda) as Partial<LineaDelDiario>;
    } catch {
      ilegibles++;
      continue;
    }
    if (l === null || typeof l !== 'object' || typeof l.ghlContactId !== 'string' || typeof l.cuentaId !== 'string') {
      ilegibles++;
      continue;
    }
    const clave = `${l.cuentaId}:${l.ghlContactId}`;
    if (l.accion === 'deshecho') {
      porContacto.set(clave, null);
      continue;
    }
    if (l.accion !== 'escrito' || typeof l.campoId !== 'string' || typeof l.valorNuevo !== 'string' || !VALORES_ESCRITOS.includes(l.valorNuevo)) {
      ilegibles++;
      continue;
    }
    porContacto.set(clave, l as LineaDelDiario);
  }
  return { lineas: [...porContacto.values()].filter((l): l is LineaDelDiario => l !== null), ilegibles };
}

/**
 * Deshace lo escrito: vuelve a vaciar el campo SÓLO donde el CRM todavía tiene el valor que escribimos. Si alguien (el
 * clasificador, una persona) lo cambió después, no se toca. Relee como persona y anota `deshecho`. Las mismas reglas de
 * corte y de tope (que cuenta los PUT) que el relleno.
 *
 * Sólo vacía el campo del cuadrante de ESTE cliente (`campoId`, de `camposDelCuadrante()`): una línea que nombra otro
 * campo se saltea como `otro_campo`, y una de otro cliente ni se mira. El diario es un archivo en disco; no decide qué
 * campo del CRM se vacía.
 */
export async function correrElDeshacer(opciones: {
  ambito: AmbitoDeUnCliente;
  acceso: { token: string; locationId: string };
  campoId: string;
  lineas: readonly LineaDelDiario[];
  tope: number;
  pausaMs: number;
  anotar: (linea: LineaDelDiario) => void;
  dormir?: (ms: number) => Promise<void>;
}): Promise<TotalesDelRelleno> {
  const { ambito, acceso, anotar } = opciones;
  const dormir = opciones.dormir ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const t = vacios();
  const cuentaId = cuentaDe(ambito);
  let primero = true;
  for (const l of opciones.lineas) {
    if (l.cuentaId !== cuentaId) continue;
    if (t.escritos >= opciones.tope) break;
    if (l.campoId !== opciones.campoId) {
      sumar(t.salteados, 'otro_campo');
      continue;
    }
    if (!primero && opciones.pausaMs > 0) await dormir(opciones.pausaMs);
    primero = false;

    const leido = await contactoPorId(acceso, l.ghlContactId);
    if (leido.tipo === 'fallo') {
      t.cortada = corta(leido.fallo);
      if (t.cortada) break;
      sumar(t.salteados, 'fallo_al_leer');
      continue;
    }
    if (!leido.datos) {
      sumar(t.salteados, 'no_esta_en_el_crm');
      continue;
    }
    const actual = valorEnElCrm(leido.datos, l.campoId);
    if (actual !== l.valorNuevo) {
      sumar(t.salteados, actual === '' ? 'ya_vacio' : 'cambiado_despues');
      continue;
    }
    const antes = await conOrganizacion(ambito, () =>
      datos().selectFrom('contactos').select(['territorio']).where('ghl_contact_id', '=', l.ghlContactId).executeTakeFirst(),
    );

    const escrito = await escribirCampoDelContacto(acceso, l.ghlContactId, l.campoId, '');
    if (escrito.tipo === 'fallo') {
      t.cortada = corta(escrito.fallo);
      if (t.cortada) break;
      sumar(t.salteados, 'escritura_rechazada');
      continue;
    }
    t.escritos++;
    sumar(t.porValor, l.valorNuevo);

    let despues: Awaited<ReturnType<typeof releerComoPersona>> = { relectura: 'excepcion', territorio: null, cuadrante: null, fallo: null };
    try {
      despues = await releerComoPersona(ambito, acceso, l.ghlContactId, l.campoId);
    } finally {
      anotar({
        accion: 'deshecho',
        cuentaId,
        contactoId: l.contactoId,
        ghlContactId: l.ghlContactId,
        campoId: l.campoId,
        valorAnterior: actual,
        valorNuevo: '',
        territorioAntes: antes?.territorio ?? null,
        territorioDespues: despues.territorio,
        cuadranteDespues: despues.cuadrante,
        relectura: despues.relectura,
        el: new Date().toISOString(),
      });
    }
    if (despues.cuadrante === null && despues.relectura === 'listo') t.quedaron++;
    if (despues.fallo) {
      t.cortada = corta(despues.fallo);
      if (t.cortada) break;
    }
  }
  return t;
}
