// La cadena de cierre: de la cohorte a la venta, eslabón por eslabón.
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL ÚLTIMO ESLABÓN VALE CERO, Y ÉSA ES LA CIFRA QUE ESTA PANTALLA EXISTE PARA DAR
//
// Medido contra producción el 2026-09-21, con este mismo módulo, sobre la base entera:
//
//     566  contactos con fecha de alta      (de 590 — ver `coberturaDeLaCohorte`)
//     197  llegaron a agendar               (222 citas alcanzables)
//      75  esa cita ya ocurrió y nadie la canceló   (87 citas)
//       4  alguien registró qué pasó
//       0  terminó en venta
//
// **71 de 75 contactos tuvieron una cita que ocurrió y nadie registró qué pasó.** De todo lo que
// este departamento puede publicar hoy, es lo único que puede cambiar una conducta — y por eso la
// cadena se dibuja entera en vez de publicar los cuatro KPI sueltos que la maqueta tenía.
//
// Una advertencia sobre las cifras de arriba: **son CONTACTOS**. La primera versión de este
// encabezado escribió el tercer y el cuarto eslabón en citas —91 y 5— y los puso en la misma columna
// que los contactos de los otros tres. O sea que mezcló las dos unidades **en el mismo comentario
// que existe para prohibirlo**, tres párrafos más abajo.
//
// ── LA UNIDAD ES EL CONTACTO EN LOS CINCO, Y NO ES UN DETALLE ───────────────
//
// Medido: **226 citas alcanzables son 201 contactos.** Si un eslabón cuenta contactos y el siguiente
// cuenta citas, la caída entre los dos mezcla dos unidades y nadie lo ve. El conteo de citas viaja
// AL LADO, como segundo término, nunca como el número del eslabón.
//
// ── Y LA MONOTONÍA SE GARANTIZA EN LA CONSULTA, NO SE SUPONE ────────────────
//
// `resultados.cita_id` es nulo en las 7 filas de la base, y el esquema permite un resultado sobre un
// contacto que nunca tuvo cita. Si el eslabón «con intento» se contara suelto, podría salir **mayor**
// que el de arriba y la pantalla dibujaría un embudo que se ensancha.
//
// Cada eslabón se cuenta sobre contactos que cumplen TODOS los anteriores, y los que no encajan
// viajan en `intentosSinCita`. Es la regla 11 de `07-REGLAS-TRANSVERSALES.md:451` —*«una cadena que
// no es monótona no es un embudo»*— satisfecha por construcción y no por suerte.
//
// ── EL TERCER ESLABÓN ES, EXACTAMENTE, LO QUE AVANZAR OFRECE CERRAR ─────────
//
// Sus tres condiciones —ya empezó, no cancelada, alcanzable— son las mismas tres que
// `citasParaCerrar.ts:16-26` usa para ofrecerle al closer la cita sobre la que contestar «¿se
// presentó?». Tienen que ser las mismas: si la cadena contara una población y el panel ofreciera
// otra, el «86 de 91» estaría acusando de no registrar a gente a la que nunca se le pidió.
//
// ── LA VENTANA ES RODANTE, Y ACÁ SÍ ─────────────────────────────────────────
//
// `now() - N días`, como Conversation, y **no** anclada al día como Acquisition, Creative y
// Conversion. La excepción de esas tres está escrita en `costoDelAnuncio.ts:33-63` y tiene un motivo
// concreto: cruzan contactos con el gasto, que vive en una columna `date`, y mezclar las dos formas
// dividió una vez treinta y un días de gasto entre treinta de leads.
//
// **La cadena de Sales no toca ninguna columna `date`**: contactos, citas y resultados son los tres
// `timestamptz`. Así que la excepción no aplica y vale la regla general, que además es la que el
// matiz del botón promete: *«Hoy: las últimas 24 horas, no el día del calendario»* (`periodo.ts:84`).
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';

import { datos } from '../datos/contexto.ts';
import { DIAS_DE_LA_TASA, PISO_DE_UNA_TASA } from './indicadoresDeCitas.ts';
import { alcanzable, cancelada, descartado, tieneCitaAlcanzable } from './citasAlcanzables.ts';

/** Las claves de los cinco eslabones, en el orden en que se dibujan. */
export const ESLABONES = ['cohorte', 'con_cita', 'cerrable', 'con_intento', 'con_venta'] as const;
export type ClaveDeEslabon = (typeof ESLABONES)[number];

/**
 * Los rótulos, que **viajan en la respuesta**.
 *
 * El panel es `'use client'` y este archivo abre la base: importarlo desde el navegador arrastraría
 * `pg` —y con él `fs`, `dns` y `net`— al paquete, y el build falla con «Can't resolve 'dns'».
 *
 * Y lo que el build NO vigila es que alguien borre `rotulos` de la respuesta y reescriba los cinco
 * títulos a mano en el JSX: compila, se ve igual, y la definición de cada eslabón queda escrita en
 * dos lugares que se corrigen por separado.
 */
export const ROTULOS: Record<ClaveDeEslabon, { titulo: string; que: string }> = {
  cohorte: {
    titulo: 'Entraron al CRM',
    que: 'Contactos dados de alta en esta ventana. Es el denominador de todo lo de abajo.',
  },
  con_cita: {
    titulo: 'Llegaron a agendar',
    que: 'Tienen al menos una cita que el CRM todavía devuelve. Las congeladas no cuentan acá: su estado dejó de refrescarse y no se puede decir qué pasó con ellas.',
  },
  cerrable: {
    titulo: 'La cita ya ocurrió',
    que: 'Su horario pasó y nadie la canceló, así que la reunión debería haber sucedido. Son exactamente las citas que el botón Avanzar ofrece cerrar.',
  },
  con_intento: {
    titulo: 'Alguien registró qué pasó',
    que: 'Se guardó un resultado después de esa cita: una venta, un seguimiento, un no-show. Sin esto, lo que ocurrió en la reunión no existe para el sistema.',
  },
  con_venta: {
    titulo: 'Terminó en venta',
    que: 'El resultado registrado fue una venta. No incluye los acuerdos sin pagar, que son plata comprometida y no cobrada.',
  },
};

export interface EslabonDeCierre {
  clave: ClaveDeEslabon;
  /** Cómo se llama en pantalla. Viaja; ver `ROTULOS`. */
  titulo: string;
  /** Qué mide exactamente. Viaja por lo mismo. */
  que: string;
  /** **Contactos**, en los cinco. Nunca citas. */
  contactos: number;
  /** De la cohorte, de 0 a 1. `null` con cohorte cero: un 0 % sería una afirmación. */
  porcionDeLaCohorte: number | null;
  /** Del eslabón ANTERIOR. `null` en el primero y cuando el anterior vale cero. */
  porcionDelAnterior: number | null;
  /** Cuántas CITAS hay detrás de estos contactos. `null` donde el eslabón no es de citas. */
  citas: number | null;
}

export interface CadenaDeCierre {
  dias: number;
  /** Los extremos de la cohorte ALCANZADA, no el borde de la ventana pedida. */
  desde: string | null;
  hasta: string | null;
  cohorte: number;
  /**
   * Cuántos contactos de la empresa pueden entrar en una cohorte, y sobre cuántos hay.
   *
   * ── LOS QUE NO TIENEN FECHA DE ALTA DESAPARECEN SIN QUE NADA LO DIGA ──────
   *
   * Toda ventana de este sistema recorta por `alta_en_el_crm`, y esa columna **puede ser nula**.
   * Medido el 2026-09-21: **24 de 590 contactos no la traen**, o sea un 4 % que no entra en ninguna
   * cohorte de ninguna pantalla —ni acá, ni en Conversion, ni en Creative, ni en Acquisition— y que
   * hasta hoy ninguna declaraba.
   *
   * No es lo mismo que «no entraron en la ventana»: ésos sí se pueden recuperar ampliándola. Éstos
   * no entran nunca, ni con «Completo».
   */
  coberturaDeLaCohorte: { con: number; sobre: number };
  eslabones: EslabonDeCierre[];
  /**
   * Citas de la cohorte que el barrido ya no alcanza. **No entran en ningún eslabón.**
   *
   * Su estado no va a cambiar nunca más, así que contarlas sería contar una foto vieja como si fuera
   * de hoy. Viajan para que la diferencia se pueda ver en vez de descubrirse restando.
   */
  congeladas: number;
  /** Citas de contactos que descartamos nosotros. Apartadas: no se esconden y no se suman. */
  descartadas: number;
  /**
   * Contactos con un resultado registrado y SIN ninguna cita cerrable.
   *
   * Son los que rompen la monotonía, y van aparte en vez de engordar el cuarto eslabón. Medido el
   * 2026-09-20: de los 7 resultados de la base, 2 son de contactos sin cita ofrecible.
   */
  intentosSinCita: number;
  /** El piso de las tasas, para que la pantalla lo diga sin importar un módulo que abre la base. */
  piso: number;
  rotulos: Record<ClaveDeEslabon, { titulo: string; que: string }>;
  aviso: string | null;
}

/**
 * La cadena de cierre de la cohorte, en la ventana.
 *
 * Se corre dentro de `conOrganizacion(`.
 */
export async function cadenaDeCierre(dias = DIAS_DE_LA_TASA): Promise<CadenaDeCierre> {
  /* La ventana rodante. Ver el encabezado: acá no hay ninguna columna `date` que obligue a anclar
     al día, así que vale la regla general del sistema y la que el matiz del botón promete. */
  const enLaVentana = sql<boolean>`contactos.alta_en_el_crm >= now() - make_interval(days => ${dias})`;

  /* ── LOS TRES PREDICADOS DE «LA CITA YA OCURRIÓ Y NADIE LA CANCELÓ» ────────
   *
   * Son las mismas tres condiciones que `citasParaCerrar.ts` usa para OFRECER la cita, y tienen que
   * serlo. Los dos primeros salen de `citasAlcanzables.ts`, que es donde viven desde la etapa 3. */
  const cerrable = sql<boolean>`${alcanzable('ci')} and not ${cancelada('ci')} and ci.inicio_el < now()`;

  const deLaPersona = sql<boolean>`ci.org_id = contactos.org_id and ci.contacto_id = contactos.id`;

  /** Ese contacto tiene al menos una cita que Avanzar ofrecería cerrar. */
  const tieneCitaCerrable = sql<boolean>`exists (
    select 1 from negocio.citas ci where ${deLaPersona} and ${cerrable})`;

  /** Ese contacto tiene un resultado registrado DESPUÉS de una de esas citas. */
  const tieneIntento = sql<boolean>`exists (
    select 1 from negocio.citas ci
     where ${deLaPersona} and ${cerrable}
       and exists (select 1 from negocio.resultados r
                    where r.org_id = contactos.org_id and r.contacto_id = contactos.id
                      and r.creado_el >= ci.inicio_el))`;

  /** Y de esos resultados, alguno es una venta. Nunca `acuerdo_sin_pago`: ver `ROTULOS.con_venta`. */
  const tieneVenta = sql<boolean>`exists (
    select 1 from negocio.resultados r
     where r.org_id = contactos.org_id and r.contacto_id = contactos.id
       and r.salida = 'venta')`;

  const f = await datos()
    .selectFrom('contactos')
    .select([
      sql<number>`count(*)`.as('cohorte'),
      /* Cada eslabón sobre los que cumplen TODOS los anteriores. Escrito así y no restando: una
         resta sigue dando un número el día que uno de los dos cambie, y deja de significar lo que
         dice. */
      sql<number>`count(*) filter (where ${tieneCitaAlcanzable('contactos')})`.as('con_cita'),
      sql<number>`count(*) filter (where ${tieneCitaCerrable})`.as('cerrable'),
      sql<number>`count(*) filter (where ${tieneCitaCerrable} and ${tieneIntento})`.as('con_intento'),
      sql<number>`count(*) filter (
        where ${tieneCitaCerrable} and ${tieneIntento} and ${tieneVenta})`.as('con_venta'),
      /* Los que rompen la monotonía: registraron algo y no tienen ninguna cita cerrable. */
      sql<number>`count(*) filter (
        where not ${tieneCitaCerrable}
          and exists (select 1 from negocio.resultados r
                       where r.org_id = contactos.org_id and r.contacto_id = contactos.id))`.as('sin_cita'),
      /* ── LAS CITAS, Y VAN DENTRO DE UN `sum` POR UN MOTIVO DE POSTGRES ──────
       *
       * Segundo término de los eslabones de citas, nunca el número del eslabón.
       *
       * La primera versión las escribió como subconsultas escalares sueltas, y la base devolvió
       * **`42803`** (`check_ungrouped_columns_walker`): en una consulta de agregación, toda columna
       * de la lista de selección tiene que estar dentro de un agregado o en el `group by`, y esas
       * subconsultas referencian `contactos.id`.
       *
       * Envolverlas en `sum` no es un rodeo para callar al motor: es lo que se quiere decir. Cada
       * fila aporta sus propias citas y lo que se publica es el total de la cohorte. */
      sql<number>`sum((select count(*) from negocio.citas ci
                        where ${deLaPersona} and ${alcanzable('ci')}))`.as('citas_alcanzables'),
      sql<number>`sum((select count(*) from negocio.citas ci
                        where ${deLaPersona} and ${cerrable}))`.as('citas_cerrables'),
      sql<number>`sum((select count(*) from negocio.citas ci
                        where ${deLaPersona} and not ${alcanzable('ci')}))`.as('congeladas'),
      sql<number>`sum((select count(*) from negocio.citas ci
                        where ${deLaPersona} and ${alcanzable('ci')} and ${descartado('ci')}))`.as('descartadas'),
      /* Los extremos de la cohorte ALCANZADA. `min`/`max` y no los bordes de la ventana: con la
         ventana, la pantalla diría «últimos 30 días» sobre una base que arranca hace tres. */
      sql<string | null>`min(alta_en_el_crm)::date::text`.as('primero'),
      sql<string | null>`max(alta_en_el_crm)::date::text`.as('ultimo'),
    ])
    .where(enLaVentana)
    .executeTakeFirst();

  /* La cobertura de la cohorte se mide SIN la ventana: es otra pregunta. «No entra en estos 30
     dias» se arregla ampliando la ventana; «no tiene fecha de alta» no se arregla nunca. */
  const cob = await datos()
    .selectFrom('contactos')
    .select([
      sql<number>`count(*)`.as('sobre'),
      sql<number>`count(alta_en_el_crm)`.as('con'),
    ])
    .executeTakeFirst();

  const n = (c: string): number => Number((f as Record<string, unknown> | undefined)?.[c] ?? 0);

  const cohorte = n('cohorte');
  const conteos: Record<ClaveDeEslabon, number> = {
    cohorte,
    con_cita: n('con_cita'),
    cerrable: n('cerrable'),
    con_intento: n('con_intento'),
    con_venta: n('con_venta'),
  };
  const citasDe: Partial<Record<ClaveDeEslabon, number>> = {
    con_cita: n('citas_alcanzables'),
    cerrable: n('citas_cerrables'),
  };

  const eslabones: EslabonDeCierre[] = ESLABONES.map((clave, i) => {
    const anterior = i === 0 ? null : conteos[ESLABONES[i - 1]!];
    return {
      clave,
      titulo: ROTULOS[clave].titulo,
      que: ROTULOS[clave].que,
      contactos: conteos[clave],
      /* `null` y no `0` con la cohorte vacía: un «0 %» afirma que nadie pasó, y lo que pasa es que
         no hubo nadie de quien decirlo. */
      porcionDeLaCohorte: cohorte === 0 ? null : conteos[clave] / cohorte,
      porcionDelAnterior: anterior === null || anterior === 0 ? null : conteos[clave] / anterior,
      citas: citasDe[clave] ?? null,
    };
  });

  const salida: CadenaDeCierre = {
    dias,
    desde: f?.primero ?? null,
    hasta: f?.ultimo ?? null,
    cohorte,
    coberturaDeLaCohorte: {
      con: Number(cob?.con ?? 0),
      sobre: Number(cob?.sobre ?? 0),
    },
    eslabones,
    congeladas: n('congeladas'),
    descartadas: n('descartadas'),
    intentosSinCita: n('sin_cita'),
    piso: PISO_DE_UNA_TASA,
    rotulos: ROTULOS,
    aviso: null,
  };

  salida.aviso = avisoDe(salida);
  return salida;
}

/** El aviso. **`null` ⟹ la pantalla no dibuja nada.** */
function avisoDe(r: CadenaDeCierre): string | null {
  const partes: string[] = [];

  /* Lo primero, porque invalida la lectura entera: «no hubo gente» y «falta el dato» son dos
     afirmaciones distintas, y sólo una es cierta cuando la pauta está apagada. */
  if (r.cohorte === 0) {
    return (
      'No entró ni un contacto en esta ventana. No es que falte el dato: no hubo gente. Probá una ' +
      'ventana más larga.'
    );
  }

  const cerrable = r.eslabones.find((e) => e.clave === 'cerrable')?.contactos ?? 0;
  const conIntento = r.eslabones.find((e) => e.clave === 'con_intento')?.contactos ?? 0;

  /* La cifra que le habla al problema real, y por eso va en el aviso y no escondida en una columna:
     de todo lo que esta pantalla publica, es lo único que hoy puede cambiar una conducta. */
  if (cerrable > 0 && conIntento < cerrable) {
    partes.push(
      `${cerrable - conIntento} de ${cerrable} contacto(s) tuvieron una cita que ya ocurrió y nadie ` +
        'registró qué pasó. Lo que ocurrió en esas reuniones no existe para el sistema, así que ' +
        'ninguna cifra de más abajo las puede contar.',
    );
  }

  if (r.intentosSinCita > 0) {
    partes.push(
      `${r.intentosSinCita} contacto(s) tienen un resultado registrado y ninguna cita que ya ` +
        'hubiera ocurrido. No entran en la cadena —la romperían— y se cuentan aparte.',
    );
  }

  if (r.congeladas > 0) {
    partes.push(
      `${r.congeladas} cita(s) de esta cohorte están congeladas: el CRM ya no devuelve su evento, ` +
        'así que su estado no va a cambiar y no entran en ningún eslabón.',
    );
  }

  /* Los que no tienen fecha de alta. Va en el aviso y no sólo en el campo porque es la única
     población que NINGUNA ventana recupera: ampliar a «Completo» no los trae. */
  const { con, sobre } = r.coberturaDeLaCohorte;
  if (sobre > con) {
    partes.push(
      `${sobre - con} contacto(s) de la empresa no tienen fecha de alta en el CRM, así que no entran ` +
        'en esta cohorte ni en ninguna otra: ampliar la ventana no los trae.',
    );
  }

  /* La nota de definición, que es de la fuente y no de ninguna ventana. Sin ella, «terminó en venta»
     se lee como «cobramos», y el § 5.4 del documento funcional exige exactamente lo contrario. */
  partes.push(
    'Una venta acá es la que el closer reportó al cerrar la cita, no un pago verificado: este ' +
      'sistema no tiene ninguna integración de cobros.',
  );

  return partes.length === 0 ? null : partes.join(' ');
}
