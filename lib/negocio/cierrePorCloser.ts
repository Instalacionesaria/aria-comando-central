// Qué hizo cada closer en la ventana. La única competencia que el documento le da a Sales.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ES UNA EVALUACIÓN DE DESEMPEÑO Y HAY QUE TRATARLA COMO TAL
//
// `CC_Arquitectura_Funcional.md:90`, § 2.3, es la única atribución de competencia que el documento le
// da a este departamento en 1.650 líneas: *«Sales Intelligence puede recomendar coaching para un
// closer.»* Y tres departamentos se declaran NO responsables de evaluar closers (`:647`, `:786`,
// `:1345`) sin que ninguno lo reclame.
//
// Lo que esta tabla publica se lee como una calificación de personas con nombre —y los tres nombres
// de producción son reales, uno de ellos es el que la maqueta que se va ya tenía cableado—. Por eso
// todo acá lleva piso, cobertura y **ningún orden por tasa**.
//
// ── LA MEDICIÓN QUE CORRIGIÓ EL PLAN ────────────────────────────────────────
//
// El plan de esta pantalla justificaba la tabla con *«26 puntos de diferencia entre dos closers»*
// (69,1 % contra 42,6 %). **Esa cifra no se reproduce bajo el predicado compartido.** Medido el
// 2026-09-21 con `alcanzable and not descartado` y sólo citas ya ocurridas:
//
//                        todas   descartadas   en la cifra   canceladas    tasa
//     Q (94 citas)        134         39            94           37       39,4 %
//     V (20 citas)         31          9            20            5       25,0 %
//     sin asignar          50         35            15           10       66,7 %
//     G  (7 citas)         11          4             7            2        — bajo el piso
//
// La sonda del plan contaba los descartados y metía los 14 `noshow` en la lista de cancelados. Con
// el predicado de `citasAlcanzables.ts` la brecha es de **14 puntos, no 26**.
//
// **Y en la ventana que la pantalla usa por omisión son 5.** A catorce días: Q tiene 32 citas y
// 28,1 %, V tiene 13 y 23,1 %. O sea que el hallazgo que justificaba la tabla vive en los datos
// viejos, y V está a una cancelación de caer bajo el piso. La tabla no puede dejar que eso se lea
// como una brecha estable: de ahí `concentracion` y el aviso que la acompaña.
//
// ── LOS DOS EJES VAN EN EL TIPO, Y ACÁ CRUZARLOS INVIERTE LA TABLA ──────────
//
// Este departamento tiene DOS identificadores de persona y no son intercambiables:
//
//   · `contactos.crm_asignado_a` — el del CRM. Corta contactos y citas.
//   · `resultados.registrado_por` — el nuestro. Corta lo registrado.
//
// El puente es `closer_asignado.crm_usuario_id`, y `inicio.ts:123-125` ya advierte qué pasa si se
// cruzan: *«cruzarlos daría los contactos de quien registró»*. Medido, **acá no es una hipótesis**:
//
//     Q  94 citas  ·  0 resultados
//     V  20 citas  ·  5 resultados
//     G   7 citas  ·  2 resultados   ← los únicos de los últimos catorce días
//
// Quien tiene 94 de las 136 citas no registró nada, y quien tiene 7 registró toda la actividad
// reciente. Cruzar los ejes no desviaría la tabla: **la daría vuelta**.
//
// Y hay un tercer identificador que NO se usa: `citas.crm_asignado_a` existe. Medido, difiere del
// asignatario del contacto en **38 de las 134 citas de Q**. La cita no tiene dueño propio: es del
// contacto (`agenda.ts:286-287`).
//
// ── LA ASISTENCIA SALE DE LA CITA, Y EL CASO QUE LO PRUEBA ESTÁ EN LA BASE ──
//
// Los dos únicos resultados de los últimos catorce días son **dos `no_show` de G**, y las citas de
// esas personas tienen `asistio` nulo — como las 327 de la base. Un mutante que dedujera la
// asistencia de la salida publicaría «G: 0 % de asistencia sobre 2», que es plausible, alarmante y
// falso. Lo correcto es lo que hace este archivo: `conAsistencia: 0` y `tasaDeAsistencia: null`.
//
// ── PERO «SIN DATO DE ASISTENCIA» ERA DEMASIADO: EL CALENDARIO SÍ DICE ALGO ─
//
// La primera versión de este archivo publicaba la asistencia vacía y nada más, que es lo que todo
// el departamento venía afirmando. **Es incompleto.** Censo de `estado_ghl` del 2026-09-21:
//
//     cancelled  163  ·  confirmed  149  ·  noshow  15
//
// Quince citas marcadas como plantón por el calendario, las quince alcanzables, y `showed` cero
// veces. Así que el lado negativo de la asistencia SE OBSERVA y el positivo no. Publicar sólo
// `asistio` dejaba esas quince afuera diciendo «no hay dato», y sí lo hay — de otra fuente.
//
// Por eso `noShowDelCalendario` es una columna propia con su rótulo, y **no entra en
// `tasaDeAsistencia`**: son dos fuentes de la misma pregunta y sólo una es nuestra.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';

import { datos } from '../datos/contexto.ts';
import { closersDeLaEmpresa } from './alcanceDelCloser.ts';
import { DIAS_DE_LA_TASA, PISO_DE_UNA_TASA } from './indicadoresDeCitas.ts';
import { alcanzable, cancelada, descartado, marcadaComoPlanton } from './citasAlcanzables.ts';

/**
 * A partir de qué porción de las citas se avisa que la tabla está desbalanceada.
 *
 * `0.6` y no `0.9`: medido en la ventana por omisión, el más grande tiene el **62,7 %**, y es
 * justamente ahí donde comparar su tasa con la del de 13 citas ya engaña. Un umbral alto dejaría
 * pasar el caso real de esta base.
 */
const CONCENTRACION_QUE_AVISA = 0.6;

/** Los rótulos de las columnas, que **viajan**: el panel es `'use client'` y no puede importar esto. */
export const ROTULOS_DE_COLUMNA = {
  contactos: {
    titulo: 'Personas',
    que: 'Cuántas personas distintas hay detrás de esas citas. No es lo mismo que el número de citas: medido, 94 citas son 82 personas.',
  },
  citas: {
    titulo: 'Citas',
    que: 'Las que ya ocurrieron en esta ventana, alcanzables y de personas no descartadas, contadas por el asignatario del CONTACTO. La cita no tiene dueño propio: es del contacto.',
  },
  cancelacion: {
    titulo: 'Cancelación',
    que: 'Qué porción de esas citas se cayó antes de ocurrir. Es lo único comparable entre closers que hoy tiene señal.',
  },
  asistencia: {
    titulo: 'Asistencia',
    que: 'De las citas cuya asistencia alguien respondió en Avanzar, cuántas se presentaron. Hoy nadie la respondió nunca, así que va vacía — y no se deduce de la salida registrada.',
  },
  planton: {
    titulo: 'Plantón',
    que: 'Citas que el CALENDARIO marcó como plantón. Es otra fuente que la asistencia de Avanzar y no se suman: el calendario avisa cuando alguien no aparece, pero nunca dice que sí apareció.',
  },
  intentos: {
    titulo: 'Registró',
    que: 'Cuántos resultados cargó esta persona en la ventana. Sale del eje NUESTRO: quién lo registró, no a quién se lo asignaron. Son dos columnas de dos ejes distintos.',
  },
  cierre: {
    titulo: 'Cierre',
    que: 'De lo que registró, qué porción fue una venta. No cuenta los acuerdos sin pagar: es plata comprometida, no cobrada.',
  },
} as const;

export type ClaveDeColumna = keyof typeof ROTULOS_DE_COLUMNA;

/** Un bucket de citas que **no** está en ninguna fila. Los tres términos, para que cierre la cuenta. */
export interface CitasFueraDeLasFilas {
  contactos: number;
  citas: number;
  canceladas: number;
}

export interface CierreDeUnCloser {
  /** Nuestro usuario: el eje de lo REGISTRADO. */
  usuarioId: string;
  nombre: string;
  /** El del CRM: el eje de personas y citas. `null` = designado sin vincular. */
  crmUsuarioId: string | null;

  // ── Eje CRM. Todos `null` sin vínculo, que NO es lo mismo que cero. ──
  /** Personas distintas detrás de sus citas. Segundo término de `citas`, nunca su reemplazo. */
  contactos: number | null;
  citas: number | null;
  canceladas: number | null;
  /** `null` bajo el piso o sin vínculo. **Nunca cero por falta de datos.** */
  tasaDeCancelacion: number | null;
  /** Citas con la asistencia RESPONDIDA. Sale de `citas.asistio` y de ningún otro lado. */
  conAsistencia: number | null;
  sePresentaron: number | null;
  tasaDeAsistencia: number | null;
  /**
   * Citas que el CALENDARIO marcó como plantón. **Otra fuente, y no se suma con la de arriba.**
   *
   * Es la única señal de asistencia que hoy existe —15 en toda la base, contra 0 de `asistio`— y es
   * asimétrica: el calendario avisa del plantón y nunca del presente. Por eso es un CONTEO y no una
   * tasa: sin el lado positivo no hay denominador honesto.
   */
  noShowDelCalendario: number | null;

  // ── Eje propio: lo que esta persona REGISTRÓ. Nunca nulo: el eje siempre existe. ──
  intentos: number;
  /**
   * Reparto por salida, tal como está en la base.
   *
   * Se arma de lo que hay y no de un catálogo cerrado: `resultados.salida` puede traer
   * `venta_chica` del setter, y el día que el catálogo crezca esto lo muestra en vez de perderlo.
   */
  porSalida: Record<string, number>;
  /** Sólo `salida = 'venta'`. **Nunca `venta_chica`**: son dos negocios y no se suman. */
  ventas: number;
  tasaDeCierre: number | null;
  /** Qué le falta a ESTA fila para tener tasas. **`null` ⟹ la fila no dibuja ninguna nota.** */
  aviso: string | null;
}

export interface CierreDeLosClosers {
  dias: number;
  /** Una por closer CONFIGURADO, en orden de designación. Nunca filtradas, nunca reordenadas. */
  filas: CierreDeUnCloser[];
  /**
   * Las citas de la ventana que **no están en ninguna fila**, separadas por motivo.
   *
   * `filas` + estos dos = el total de la ventana, y esa identidad es lo que permite decir que la
   * tabla no suma la empresa **sin que el lector tenga que descubrirlo restando**. Los dos motivos
   * van separados porque llevan a acciones opuestas: uno se arregla asignando en el CRM, el otro
   * designando a esa persona como closer.
   */
  fueraDeLasFilas: {
    /** Contactos sin `crm_asignado_a`. Medido a 14 días: 1 cita; sobre todo lo pasado: 15. */
    sinAsignar: CitasFueraDeLasFilas;
    /** Asignados en el CRM a alguien que **no está designado closer acá**. Hoy: ninguno. */
    deAlguienQueNoEsCloser: CitasFueraDeLasFilas;
  };
  /** De las citas de la ventana, cuántas caen en alguna fila. Los **dos** términos. */
  coberturaDeLaTabla: { con: number; sobre: number };
  /**
   * Porción de las citas de las FILAS que se lleva el closer más grande, de 0 a 1.
   *
   * `null` con menos de dos filas con citas: sin dos, no hay concentración de la que hablar.
   * Medido a 14 días: **0,627**. Sin esto, comparar dos filas es comparar una carrera con una
   * caminata — y en esta base la diferencia de volumen es de más del doble.
   */
  concentracion: number | null;
  /** Cuántas filas no tienen NINGUNA tasa. La comparación, para ellas, no es posible. */
  bajoElPiso: number;
  piso: number;
  rotulos: typeof ROTULOS_DE_COLUMNA;
  aviso: string | null;
}

/**
 * Lo que hizo cada closer configurado, en la ventana.
 *
 * Se corre dentro de `conOrganizacion(`.
 */
export async function cierrePorCloser(dias = DIAS_DE_LA_TASA): Promise<CierreDeLosClosers> {
  /* ── LAS FILAS SALEN DEL CATÁLOGO, NO DE UN `group by` ─────────────────────
   *
   * Un `group by` sólo devuelve a quien tiene filas, así que **el closer sin actividad desaparece de
   * la tabla** — y su ausencia se lee como «no está configurado» en vez de «no registró nada». Son
   * dos hechos opuestos y la tabla no distinguiría cuál está mostrando.
   *
   * Y el orden es el de esa función —designación, desempate por id—, que ya es estable a propósito.
   * Medido: los tres closers se designaron el mismo día, así que el desempate decide, y deja **al de
   * 94 citas último**. Correcto: la tabla no ordena por tamaño ni por tasa. */
  const closers = await closersDeLaEmpresa();

  /* ── LA VENTANA ES LA DE `tasaDeCancelacion`, Y ESO SE MIDIÓ ───────────────
   *
   * `citas.inicio_el` en los últimos N días **y ya pasadas**, exactamente como
   * `indicadoresDeCitas.ts:396-397`. No la cohorte de `contactos.alta_en_el_crm` que usan
   * `cadenaDeCierre` y `cicloHastaLaCita`, y el motivo es que esta tabla publica una **tasa de
   * cancelación** y la pantalla publica otra arriba, de cabecera: con dos ventanas distintas para la
   * misma palabra, las filas no se relacionan con la cifra grande y la divergencia se ve como «la
   * tabla no cuadra» sin que nada falle.
   *
   * Y es además lo que la columna significa: «qué hizo esta persona en catorce días» son las citas
   * que ocurrieron, no las personas que entraron al CRM. Una cita futura tampoco entra — su
   * cancelación todavía no es un hecho. */
  const enLaVentana = sql<boolean>`ci.inicio_el >= now() - make_interval(days => ${dias})
                               and ci.inicio_el < now()`;

  /* El contacto se llama `co` y no `ct` a propósito: `descartado('ci')` abre su propia subconsulta
     con `negocio.contactos ct`, y con el mismo alias afuera la de adentro lo tapa. Daría el mismo
     resultado —es la misma fila— pero es un sombreado esperando a que alguien agregue una condición
     y no entienda por qué no filtra. */
  const ejeCrm = await datos()
    .selectFrom('citas as ci')
    .innerJoin('contactos as co', (j) =>
      j.onRef('co.org_id', '=', 'ci.org_id').onRef('co.id', '=', 'ci.contacto_id'),
    )
    .select([
      'co.crm_asignado_a as quien',
      sql<number>`count(*)`.as('citas'),
      /* `distinct` y no `count(*)`: 94 citas son 82 personas, y publicar el conteo de citas con el
         rótulo de personas es el defecto que `citasAlcanzables.ts:19-30` mide y nombra. */
      sql<number>`count(distinct co.id)`.as('contactos'),
      sql<number>`count(*) filter (where ${cancelada('ci')})`.as('canceladas'),
      /* `is not null` en el DENOMINADOR de la asistencia. Sin ese filtro la cuenta sería sobre todas
         las citas, y como el nulo es el caso normal —nadie cerró el intento todavía— la tasa diría
         que no se presenta casi nadie: plausible, alarmante y falsa. Es literal de
         `indicadoresDeCitas.ts:365-372`, y acá vale lo mismo por fila. */
      sql<number>`count(*) filter (where ci.asistio is not null)`.as('con_asistencia'),
      /* `is true` y no `= true`: son equivalentes hoy porque el filtro de arriba ya excluyó los
         nulos, y `is true` lo sigue siendo el día que alguien toque ese filtro. */
      sql<number>`count(*) filter (where ci.asistio is true)`.as('se_presentaron'),
      /* Y la del CALENDARIO, en la MISMA pasada. En una consulta aparte podría salir de otro estado
         de la tabla —el barrido escribe cada hora— y la fila diría «12 citas» al lado de «13
         plantones». Es el mismo motivo por el que `tasaDeCancelacion` junta sus seis cifras. */
      sql<number>`count(*) filter (where ${marcadaComoPlanton('ci')})`.as('planton'),
    ])
    .where(alcanzable('ci'))
    .where(sql<boolean>`not ${descartado('ci')}`)
    .where(enLaVentana)
    .groupBy('co.crm_asignado_a')
    .execute();

  /* El otro eje, en su propia consulta porque agrupa por otra columna de otra tabla. Dos niveles
     —persona y salida— y el armado en JavaScript: es más simple que un `jsonb_object_agg` y no
     obliga a nadie a leer JSON crudo para entender qué cuenta.
     *
     * **No se filtra por `rol`.** Es la misma decisión que `dineroDelMes` (`:137`), que corta sólo
     * por `registrado_por`: la columna dice «qué registró esta persona», y esconderle una fila
     * porque la cargó con el otro sombrero haría que «Registró: 2» no coincida con lo que esa
     * persona ve en su propia pantalla. Lo que sí está separado es la VENTA: `porSalida` muestra
     * `venta_chica` si aparece y `ventas` no la suma. */
  const ejePropio = await datos()
    .selectFrom('resultados')
    .select(['registrado_por', 'salida', sql<number>`count(*)`.as('n')])
    /* La misma cantidad de días, anclada a otra columna: acá el hecho es cuándo se REGISTRÓ, no
       cuándo era la cita. Que las dos ventanas midan lo mismo y cuenten cosas distintas es propio de
       las dos columnas, y el aviso de la tabla lo dice. */
    .where(sql<boolean>`creado_el >= now() - make_interval(days => ${dias})`)
    .groupBy(['registrado_por', 'salida'])
    .execute();

  const porCrm = new Map(ejeCrm.filter((f) => f.quien !== null).map((f) => [f.quien!, f] as const));
  const conCloser = new Set<string>();

  const filas: CierreDeUnCloser[] = closers.map((c) => {
    const e = c.crmUsuarioId === null ? undefined : porCrm.get(c.crmUsuarioId);
    if (c.crmUsuarioId !== null) conCloser.add(c.crmUsuarioId);

    /* ── SIN VÍNCULO ES `null`; VINCULADO Y SIN CITAS ES CERO MEDIDO ──────────
     *
     * La diferencia manda a hacer dos cosas distintas: una a vincular al closer con su usuario del
     * CRM, la otra a mirar por qué no le están llegando citas. Un `?? 0` las escribe igual y la
     * primera desaparece. Hoy los tres closers de producción están vinculados, así que este nulo
     * **no lo cubre ninguna fila real**: sólo el tipo y su prueba. */
    const sinEje = c.crmUsuarioId === null;
    const contactos = sinEje ? null : Number(e?.contactos ?? 0);
    const citas = sinEje ? null : Number(e?.citas ?? 0);
    const canceladas = sinEje ? null : Number(e?.canceladas ?? 0);
    const conAsistencia = sinEje ? null : Number(e?.con_asistencia ?? 0);
    const sePresentaron = sinEje ? null : Number(e?.se_presentaron ?? 0);
    const noShowDelCalendario = sinEje ? null : Number(e?.planton ?? 0);

    const porSalida: Record<string, number> = {};
    let intentos = 0;
    for (const r of ejePropio) {
      if (r.registrado_por !== c.usuarioId) continue;
      porSalida[r.salida] = Number(r.n);
      intentos += Number(r.n);
    }
    /* `['venta']` por clave exacta y no una búsqueda de subcadena: la `venta_chica` del setter es
       otro negocio con otra comisión y no se suma, nunca (`lib/negocio/etapas.ts:86-94`). */
    const ventas = porSalida['venta'] ?? 0;

    return {
      usuarioId: c.usuarioId,
      nombre: c.nombre,
      crmUsuarioId: c.crmUsuarioId,
      contactos,
      citas,
      canceladas,
      /* El piso es del DENOMINADOR **de esta fila**, no del total ni de la tabla. Aplicado a la fila
         la borraría, y borrar la fila de una persona afirma que no trabaja acá. */
      tasaDeCancelacion: tasa(canceladas, citas),
      conAsistencia,
      sePresentaron,
      tasaDeAsistencia: tasa(sePresentaron, conAsistencia),
      noShowDelCalendario,
      intentos,
      porSalida,
      ventas,
      tasaDeCierre: tasa(ventas, intentos),
      aviso: avisoDeLaFila({ sinEje, citas, conAsistencia, noShowDelCalendario, intentos }),
    };
  });

  /* Los dos buckets que no son de nadie de la tabla. El segundo existe porque las filas salen del
     catálogo: una cita asignada en el CRM a alguien que nadie designó closer no cae en ninguna fila,
     y sin este término desaparecería de la pantalla sin dejar rastro. */
  const vacio = (): CitasFueraDeLasFilas => ({ contactos: 0, citas: 0, canceladas: 0 });
  const sinAsignar = vacio();
  const deAlguienQueNoEsCloser = vacio();
  for (const f of ejeCrm) {
    if (f.quien !== null && conCloser.has(f.quien)) continue;
    const donde = f.quien === null ? sinAsignar : deAlguienQueNoEsCloser;
    donde.contactos += Number(f.contactos);
    donde.citas += Number(f.citas);
    donde.canceladas += Number(f.canceladas);
  }

  const citasDeLasFilas = filas.map((f) => f.citas ?? 0);
  const enFilas = citasDeLasFilas.reduce((s, n) => s + n, 0);

  const salida: CierreDeLosClosers = {
    dias,
    filas,
    fueraDeLasFilas: { sinAsignar, deAlguienQueNoEsCloser },
    coberturaDeLaTabla: {
      con: enFilas,
      sobre: enFilas + sinAsignar.citas + deAlguienQueNoEsCloser.citas,
    },
    concentracion:
      citasDeLasFilas.filter((n) => n > 0).length < 2 || enFilas === 0
        ? null
        : Math.max(...citasDeLasFilas) / enFilas,
    bajoElPiso: filas.filter(
      (f) => f.tasaDeCancelacion === null && f.tasaDeAsistencia === null && f.tasaDeCierre === null,
    ).length,
    piso: PISO_DE_UNA_TASA,
    rotulos: ROTULOS_DE_COLUMNA,
    aviso: null,
  };

  salida.aviso = avisoDe(salida);
  return salida;
}

/** Una tasa con su piso. `null` sin vínculo, sin denominador o bajo el piso — **nunca cero**. */
function tasa(numerador: number | null, denominador: number | null): number | null {
  if (numerador === null || denominador === null) return null;
  if (denominador < PISO_DE_UNA_TASA) return null;
  return Math.round((numerador / denominador) * 1000) / 1000;
}

/** Qué le falta a una fila. **`null` ⟹ la fila no dibuja ninguna nota.** */
function avisoDeLaFila(f: {
  sinEje: boolean;
  citas: number | null;
  conAsistencia: number | null;
  noShowDelCalendario: number | null;
  intentos: number;
}): string | null {
  if (f.sinEje) {
    return (
      'Está designado como closer y no está vinculado a un usuario del CRM, así que no se le pueden ' +
      'atribuir personas ni citas. No es que no tenga: es que no hay por dónde buscarlas.'
    );
  }

  const partes: string[] = [];
  const citas = f.citas ?? 0;
  if (citas === 0) {
    partes.push('No tiene ninguna cita ocurrida en esta ventana.');
  } else if (citas < PISO_DE_UNA_TASA) {
    partes.push(
      `Tiene ${citas} cita(s) en esta ventana y hacen falta ${PISO_DE_UNA_TASA} para que una tasa ` +
        'signifique algo, así que se muestran los conteos y no los porcentajes.',
    );
  } else if (f.conAsistencia === 0) {
    /* Sólo cuando SÍ hay citas suficientes: con cero o pocas, la frase de arriba ya explica por qué
       la celda está vacía, y las dos juntas dirían dos veces lo mismo en el lugar más chico de la
       pantalla. */
    const planton = f.noShowDelCalendario ?? 0;
    partes.push(
      planton === 0
        ? 'Ninguna de sus citas tiene la asistencia respondida en Avanzar.'
        : /* La celda vacía con plantones al lado se lee como una contradicción, así que la fila dice
             de dónde sale cada cosa. El calendario avisa del plantón y nunca del presente: por eso
             lo de la izquierda sigue vacío aunque acá haya un número. */
          `Ninguna de sus citas tiene la asistencia respondida en Avanzar, así que la tasa queda ` +
          `vacía. Los ${planton} plantones de al lado los marcó el calendario, que es otra fuente: ` +
          'avisa cuando alguien no aparece y nunca dice que sí apareció.',
    );
  }

  if (f.intentos === 0) partes.push('No registró ningún resultado en esta ventana.');

  return partes.length === 0 ? null : partes.join(' ');
}

/** El aviso de la tabla. **`null` ⟹ la pantalla no dibuja nada.** */
function avisoDe(r: CierreDeLosClosers): string | null {
  if (r.filas.length === 0) {
    return (
      'Todavía no hay ningún closer configurado, así que no hay de quién mostrar números. Se ' +
      'configuran en la pantalla del Closer.'
    );
  }

  const partes: string[] = [];

  /* La concentración va PRIMERO porque califica todo lo de abajo: comparar dos tasas sin saber que
     una sale de más del doble de citas que la otra es comparar dos cosas distintas. Medido, es el
     caso real de esta base. */
  if (r.concentracion !== null && r.concentracion >= CONCENTRACION_QUE_AVISA) {
    partes.push(
      `Un solo closer tiene el ${Math.round(r.concentracion * 100)} % de las citas de esta tabla, ` +
        'así que las tasas de las otras filas salen de bases mucho más chicas: una diferencia de ' +
        'puntos entre dos filas de tamaños muy distintos no es una diferencia de desempeño.',
    );
  }

  const { con, sobre } = r.coberturaDeLaTabla;
  if (sobre > con) {
    const s = r.fueraDeLasFilas.sinAsignar.citas;
    const o = r.fueraDeLasFilas.deAlguienQueNoEsCloser.citas;
    const motivos = [
      s > 0 ? `${s} son de personas sin closer asignado en el CRM` : null,
      o > 0 ? `${o} están asignadas a alguien que no está designado como closer acá` : null,
    ].filter((t): t is string => t !== null);
    partes.push(
      `Las filas no suman las ${sobre} citas de la ventana: ${motivos.join(' y ')}. No se ` +
        'descartan, se cuentan aparte — pero no son de nadie de esta tabla.',
    );
  }

  if (r.bajoElPiso > 0) {
    partes.push(
      `${r.bajoElPiso} fila(s) no tienen ninguna tasa: su volumen no llega al piso de ${r.piso}. Se ` +
        'muestran igual, con sus conteos, porque una fila borrada se lee como una persona que no ' +
        'trabaja acá.',
    );
  }

  /* La nota de definición, y va siempre. Sin ella «Registró» se lee como una columna del mismo eje
     que «Citas», y son dos: en esta base quien tiene 94 citas registró 0 resultados y quien tiene 7
     registró los únicos 2 de la ventana. Leerlas como un embudo de la misma persona invierte la
     conclusión. */
  partes.push(
    'Las personas y las citas son de quien el CRM se las asignó; lo registrado es de quien lo cargó ' +
      'en Avanzar. Son dos ejes distintos, así que una cita puede estar en una fila mientras su ' +
      'resultado está en otra, y las dos columnas no se leen como un embudo.',
  );

  return partes.join(' ');
}
