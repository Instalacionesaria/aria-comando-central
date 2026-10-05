// El único escritor de `negocio.senales` (migración 072). **Corre dentro de `conOrganizacion(`**: lo abre la
// pasada diaria (`lib/agentes/detectores/correr.ts`).
//
// ═══════════════════════════════════════════════════════════════════════════════
// RECONCILIACIÓN, NO UNA COLA
//
// `docs/OTROS/agentes/02-EL-CONTRATO-DE-SENALES.md`, AG-22 y AG-23. Cada pasada de un departamento y una
// ventana compara lo que detectó con lo que ya había:
//
//   · lo detectado que ya existe se actualiza —nunca nace dos veces—; lo nuevo nace `abierta`;
//   · lo que existía y no se detectó se cierra solo si la regla se pudo medir, o queda `sin_medicion` si
//     su fuente dejó de llegar: cerrarlo afirmaría que la condición se fue cuando sólo dejó de poder verse;
//   · lo que una persona descartó o resolvió no renace mientras la condición siga: la pasada lo encuentra,
//     anota que se volvió a ver y no crea otra. Si la condición se apaga se anota la fecha, y si vuelve
//     después es un hecho nuevo. Si la gravedad SUBE, también es un hecho nuevo: la decisión se tomó sobre
//     algo menos grave.
//
// Dos pasadas a la vez de la misma empresa, departamento y ventana —el cron admite entregas duplicadas— se
// ordenan con un candado de transacción: sin él, las dos verían la misma fila ausente y la segunda chocaría
// contra el índice único por huella.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../../datos/contexto.ts';
import {
  type DebajoDelPiso,
  type DepartamentoConSenales,
  type Deteccion,
  type Gravedad,
  PISO_DE_UNA_SENAL,
  type VentanaDeSenal,
  confianzaDe,
  huellaDe,
  subeLaGravedad,
} from './tipos.ts';

export interface PasadaDeUnDepartamento {
  departamento: DepartamentoConSenales;
  /** El nombre del detector que la produjo, para la columna `detector`. */
  detector: string;
  ventana: VentanaDeSenal;
  detecciones: readonly Deteccion[];
  /** Las reglas cuya fuente no llegó en esta pasada: lo suyo que no se detectó queda `sin_medicion`. */
  sinMedicion: readonly string[];
}

export interface ResumenDeLaReconciliacion {
  nuevas: number;
  actualizadas: number;
  /** Descartadas o resueltas que se volvieron a ver igual: no renacen. */
  vistasDeNuevo: number;
  /** Descartadas o resueltas que volvieron más graves: nace una fila nueva. */
  renacidas: number;
  cerradasSolas: number;
  sinMedicion: number;
  condicionesApagadas: number;
  /** Las que llegaron por debajo del piso: no se guardan, se cuentan (AG-27). */
  debajoDelPiso: DebajoDelPiso[];
  /**
   * Las huellas que se detectaron y una persona ya descartó o resolvió, sin que subieran de gravedad. No
   * van al plan: cada recomendación es una condición vigente que nadie decidió todavía (A6-20).
   */
  decididas: string[];
}

/** Los estados que bloquean una huella, con la condición de las decididas. Ver la migración 072. */
const VIVAS = ['abierta', 'vista', 'sin_medicion'] as const;
const DECIDIDAS = ['resuelta', 'descartada'] as const;

export async function reconciliarSenales(p: PasadaDeUnDepartamento): Promise<ResumenDeLaReconciliacion> {
  const db = datos();
  const resumen: ResumenDeLaReconciliacion = {
    nuevas: 0,
    actualizadas: 0,
    vistasDeNuevo: 0,
    renacidas: 0,
    cerradasSolas: 0,
    sinMedicion: 0,
    condicionesApagadas: 0,
    debajoDelPiso: [],
    decididas: [],
  };

  // El candado de esta empresa, departamento y ventana, hasta el fin de la transacción. Ver el encabezado.
  await sql`select pg_advisory_xact_lock(hashtextextended(current_setting('app.org_id') || ${`·senales·${p.departamento}·${p.ventana}`}, 0))`.execute(db);

  // Las que bloquean su huella en este departamento y esta ventana.
  const existentes = await db
    .selectFrom('senales')
    .select(['id', 'huella', 'regla', 'estado', 'gravedad'])
    .where('departamento', '=', p.departamento)
    .where('ventana', '=', p.ventana)
    .where((w) =>
      w.or([
        w('estado', 'in', VIVAS),
        w.and([w('estado', 'in', DECIDIDAS), w('condicion_apagada_el', 'is', null)]),
      ]),
    )
    .execute();
  const porHuella = new Map(existentes.map((f) => [f.huella, f]));
  const detectadas = new Set<string>();

  for (const d of p.detecciones) {
    // Debajo del piso no hay señal (AG-26). El detector no debería mandarla; si la manda, se cuenta.
    if (d.muestra !== null && d.muestra < PISO_DE_UNA_SENAL) {
      resumen.debajoDelPiso.push({ regla: d.regla, entidad: d.entidad, muestra: d.muestra });
      continue;
    }
    const huella = huellaDe(p.departamento, d, p.ventana);
    if (detectadas.has(huella)) throw new Error(`senales: la pasada de ${p.departamento} detectó dos veces la misma huella`);
    detectadas.add(huella);
    const previa = porHuella.get(huella);

    if (!previa) {
      await insertar(p, d, huella);
      resumen.nuevas += 1;
      continue;
    }

    if ((DECIDIDAS as readonly string[]).includes(previa.estado)) {
      if (subeLaGravedad(previa.gravedad as Gravedad, d.gravedad)) {
        // Más grave que lo que se decidió: la decisión deja de bloquear y nace un hecho nuevo.
        await db.updateTable('senales').set({ condicion_apagada_el: new Date() }).where('id', '=', previa.id).execute();
        await insertar(p, d, huella);
        resumen.renacidas += 1;
      } else {
        // Lo mismo que alguien ya decidió: se anota que se volvió a ver, sin tocar la foto de la decisión.
        await db.updateTable('senales').set({ ultima_deteccion_el: new Date() }).where('id', '=', previa.id).execute();
        resumen.vistasDeNuevo += 1;
        resumen.decididas.push(huella);
      }
      continue;
    }

    // Viva: se actualiza con la medida de hoy. Si volvió a llegar su fuente, vuelve a `abierta`; y si subió
    // de gravedad, también, sin la marca de vista: lo que alguien vio era menos grave.
    const vuelveAbierta = previa.estado === 'sin_medicion' || subeLaGravedad(previa.gravedad as Gravedad, d.gravedad);
    await db
      .updateTable('senales')
      .set({
        ...columnasDeLaMedida(d),
        ultima_deteccion_el: new Date(),
        ...(vuelveAbierta ? { estado: 'abierta' as const, vista_el: null, vista_por: null } : {}),
      })
      .where('id', '=', previa.id)
      .execute();
    resumen.actualizadas += 1;
  }

  // Lo que había y hoy no se detectó.
  const ahora = new Date();
  for (const previa of existentes) {
    if (detectadas.has(previa.huella)) continue;
    const sinFuente = p.sinMedicion.includes(previa.regla);
    if ((DECIDIDAS as readonly string[]).includes(previa.estado)) {
      // Sin fuente no se puede afirmar que la condición se apagó: la decisión sigue bloqueando.
      if (sinFuente) continue;
      await db.updateTable('senales').set({ condicion_apagada_el: ahora }).where('id', '=', previa.id).execute();
      resumen.condicionesApagadas += 1;
      continue;
    }
    if (sinFuente) {
      if (previa.estado !== 'sin_medicion') {
        await db.updateTable('senales').set({ estado: 'sin_medicion' }).where('id', '=', previa.id).execute();
      }
      resumen.sinMedicion += 1;
      continue;
    }
    await db.updateTable('senales').set({ estado: 'cerrada_sola', cerrada_el: ahora }).where('id', '=', previa.id).execute();
    resumen.cerradasSolas += 1;
  }

  return resumen;
}

/** Las columnas que dicen qué se midió y cómo se juzgó: las mismas al nacer y al actualizar. */
function columnasDeLaMedida(d: Deteccion) {
  return {
    metrica: d.metrica,
    linea_base: d.lineaBase,
    valor_actual: d.valorActual,
    cambio_pct: d.cambioPct,
    muestra: d.muestra,
    periodo_desde: d.periodo.desde,
    periodo_hasta: d.periodo.hasta,
    datos_desde: d.datosDesde,
    gravedad: d.gravedad,
    confianza: confianzaDe(d.muestra),
    causas_posibles: [...d.causasPosibles],
    revision_recomendada: d.revisionRecomendada,
    perdida_contactos: d.perdidaContactos,
    destino_departamento: d.destino,
    requiere_validacion_ejecutiva: d.requiereValidacionEjecutiva,
    umbral: JSON.stringify(d.umbral),
    evidencia: JSON.stringify(d.evidencia),
    issue_source: d.issueSource ?? null,
  };
}

async function insertar(p: PasadaDeUnDepartamento, d: Deteccion, huella: string): Promise<void> {
  await datos()
    .insertInto('senales')
    .values({
      departamento: p.departamento,
      detector: p.detector,
      ventana: p.ventana,
      regla: d.regla,
      entidad_tipo: d.entidad.tipo,
      entidad_id: d.entidad.id,
      huella,
      ...columnasDeLaMedida(d),
    })
    .execute();
}
