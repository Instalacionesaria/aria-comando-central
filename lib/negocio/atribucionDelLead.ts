// De dónde vinieron los leads que agendaron. **El §9.6 y el §9.7, con lo que ya está guardado.**
//
// ═══════════════════════════════════════════════════════════════════════════════
// EL DATO ESTABA HACE CUATRO COMMITS Y NO LO LEÍA NADIE
//
// La migración `048` guarda `contactos.atribucion_primera` y `atribucion_ultima` —los dos objetos
// de atribución de GoHighLevel, crudos— y hasta este archivo **ninguna línea del sistema los
// consultaba**. Medido el 2026-09-14: `atribucion_primera` poblada en 544 de 584 contactos, y
// dentro de la ventana de catorce días **236 de 236 traen `sessionSource`**.
//
// Se llegó a proponer conectar el API de Meta para conseguir esto. No hacía falta: viene en la
// misma respuesta que ya se pedía, y lo único que faltaba era leerlo.
//
// ── POR QUÉ ESTE ARCHIVO EXISTE Y NO ES UNA COLUMNA MÁS DE `indicadoresDelLead` ──
//
// Porque devuelve FILAS y no cifras. Las cuatro cifras de Lead Flow son números sobre una cohorte;
// esto es la misma cohorte partida en pedazos, y cada pedazo tiene su propio denominador y su propio
// piso. Mezclarlos en la misma interfaz haría que `tasa` significara dos cosas distintas según el
// campo, que es exactamente lo que este proyecto persigue en todas partes.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA TRAMPA DE ESTE ARCHIVO, MEDIDA, Y ES LA QUE DA VUELTA LA LECTURA DEL NEGOCIO
//
// Agrupando la cohorte por fuente del primer toque, el 2026-09-14:
//
//     Paid Social      113 de 222   50,9 %
//     Direct traffic     7 de   8   87,5 %
//     Social media       4 de   6   66,7 %
//
// Las dos categorías con la tasa MÁS ALTA de la pantalla tienen ocho y seis leads. Dibujadas como
// barras al lado de Paid Social dicen que **lo pago es lo que peor convierte** —una conclusión de
// negocio, cara, y construida sobre catorce contactos—. Con un lead más, «Direct traffic» salta de
// 87,5 % a 88,9 % o cae a 77,8 %: no es una tasa, es un número que se mueve diez puntos por fila.
//
// Por eso todo lo que no llega al piso **se junta en una sola fila con su conteo y sin tasa**. No se
// esconde —el conteo está, y sumado da la cohorte entera— pero no se le da una barra que invite a
// compararla con una que sí tiene datos.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { DIAS_DE_LA_TASA, PISO_DE_UNA_TASA } from './indicadoresDeCitas.ts';

/** Una fila del corte: cuántos entraron por ahí y cuántos agendaron. */
export interface FilaDeAtribucion {
  etiqueta: string;
  cohorte: number;
  agendaron: number;
  /** `null` cuando la fila no llega al piso. **No es cero**: es que no se puede decir. */
  tasa: number | null;
  /** `true` en la fila que junta a todas las que no llegaban al piso. */
  esElResto: boolean;
}

export interface AtribucionDelLead {
  dias: number;
  /** El primer toque: por dónde LLEGÓ el lead. `sessionSource` de GoHighLevel. */
  porFuente: FilaDeAtribucion[];
  /** Por campaña, con el nombre que le puso quien la armó. Vacío si el CRM no manda campañas. */
  porCampana: FilaDeAtribucion[];
  /**
   * Primeros mensajes que salieron fuera del horario razonable del CONTACTO.
   *
   * `null` cuando ningún contacto de la ventana trae zona horaria. No es una tasa: es una
   * advertencia, y su denominador son sólo los que tienen zona — medido, 130 de 230.
   */
  fueraDeHorario: { contactos: number; sobre: number } | null;
  aviso: string | null;
}

/** Desde qué hora y hasta qué hora se considera razonable escribirle a alguien, en SU zona. */
const DESDE = 8;
const HASTA = 21;

export async function atribucionDelLead(dias = DIAS_DE_LA_TASA): Promise<AtribucionDelLead> {
  const [porFuente, porCampana, horario] = await Promise.all([
    cortePor('sessionSource', dias),
    cortePor('campaign', dias),
    fueraDeHorario(dias),
  ]);

  return {
    dias,
    porFuente,
    porCampana,
    fueraDeHorario: horario,
    aviso: avisoDe(porFuente, porCampana),
  };
}

/**
 * La cohorte partida por una clave del objeto de atribución, con el piso ya aplicado.
 *
 * ── LA CLAVE ES UN PARÁMETRO Y ESO NO ES UNA INYECCIÓN ──────────────────────
 *
 * `clave` viaja como VALOR ligado (`${clave}` dentro de una plantilla `sql`), no concatenado: Kysely
 * lo manda como parámetro y PostgreSQL lo trata como texto para el operador `->>`. Aunque alguien
 * pasara comillas, no habría forma de que se interprete como SQL. La alternativa —armar el
 * fragmento con una plantilla de texto— sí lo sería, y por eso no está.
 *
 * ── Y EL DENOMINADOR ES LA COHORTE, NO LOS QUE TIENEN LA CLAVE ──────────────
 *
 * Un contacto sin `campaign` entra igual, en la fila «sin campaña». Excluirlo haría que la suma de
 * las filas no diera la cohorte, y una tabla cuyas partes no suman el total es una en la que nadie
 * puede detectar que falta un pedazo.
 */
async function cortePor(clave: string, dias: number): Promise<FilaDeAtribucion[]> {
  const filas = await datos()
    .selectFrom('contactos')
    .select([
      sql<string | null>`atribucion_primera ->> ${clave}`.as('etiqueta'),
      sql<number>`count(*)`.as('cohorte'),
      /* El mismo `exists` y el mismo filtro de cita alcanzable que el booking rate. Tiene que ser
         el mismo o las filas de este corte no sumarían la cifra grande de al lado, y nadie tendría
         cómo darse cuenta de cuál de las dos está mal. */
      sql<number>`count(*) filter (where exists (
        select 1 from negocio.citas ci
         where ci.org_id = contactos.org_id and ci.contacto_id = contactos.id
           and ci.ghl_calendario_id is not null))`.as('agendaron'),
    ])
    .where(sql<boolean>`alta_en_el_crm >= now() - make_interval(days => ${dias})`)
    /* ── `group by 1` Y NO LA EXPRESIÓN REPETIDA ──────────────────────────
     *
     * `clave` viaja como PARÁMETRO, así que escribir `atribucion_primera ->> ${clave}` otra vez acá
     * produce un segundo marcador de posición y PostgreSQL no reconoce las dos expresiones como la
     * misma: falla con *«column "contactos.atribucion_primera" must appear in the GROUP BY
     * clause»*. El ordinal apunta a la primera columna del `select`, que es exactamente la que se
     * quiere agrupar, y no depende de que dos textos coincidan. */
    .groupBy(sql`1`)
    .orderBy(sql`count(*) desc`)
    .execute();

  const grandes: FilaDeAtribucion[] = [];
  let restoCohorte = 0;
  let restoAgendaron = 0;

  for (const f of filas) {
    const cohorte = Number(f.cohorte ?? 0);
    const agendaron = Number(f.agendaron ?? 0);
    /* Sin etiqueta el lead no trae esa clave. Se junta con el resto en vez de dibujar una fila
       «null», que en pantalla se lee como una categoría con ese nombre. */
    if (f.etiqueta === null || cohorte < PISO_DE_UNA_TASA) {
      restoCohorte += cohorte;
      restoAgendaron += agendaron;
      continue;
    }
    grandes.push({
      etiqueta: f.etiqueta,
      cohorte,
      agendaron,
      tasa: Math.round((agendaron / cohorte) * 1000) / 10,
      esElResto: false,
    });
  }

  if (restoCohorte === 0) return grandes;
  return [
    ...grandes,
    {
      etiqueta: 'Otras',
      cohorte: restoCohorte,
      agendaron: restoAgendaron,
      /* **Sin tasa, y ése es el punto entero del archivo.** Esta fila junta categorías distintas:
         una tasa sobre ellas no describe a ninguna, y encima invitaría a compararla con las de
         arriba. El conteo sí va, para que las filas sumen la cohorte. */
      tasa: null,
      esElResto: true,
    },
  ];
}

/**
 * Cuántos primeros mensajes salieron fuera del horario del CONTACTO.
 *
 * ── POR QUÉ ESTO NO EXISTÍA Y AHORA SÍ ─────────────────────────────────────
 *
 * La única zona horaria que este sistema conocía era la de la EMPRESA. Con
 * `contactos.zona_horaria_del_lead` —guardada por la `048`, poblada en 304 de 584— se puede
 * preguntar qué hora era **para quien recibió el mensaje**, y la respuesta medida el 2026-09-14 no
 * es menor: **51 de 130** primeros mensajes salieron antes de las 8 o después de las 21 en la zona
 * del lead.
 *
 * ── ES UN CONTEO Y NO UNA TASA, Y EL DENOMINADOR VIAJA ─────────────────────
 *
 * 100 de los 230 contactos escritos no traen zona horaria, así que una tasa sobre «los que tienen
 * zona» se leería como si hablara de todos. El par (contactos, sobre) obliga a la pantalla a decir
 * las dos cosas.
 *
 * `pais` **no se usa como respaldo**, y es a propósito: un país no es una zona. Perú tiene una y
 * Estados Unidos seis, así que derivar la hora del país acertaría en 546 casos y erraría en 13 sin
 * ninguna señal de cuáles. Un dato aproximado que no se puede distinguir del exacto es peor que la
 * ausencia — y el aviso ya dice sobre cuántos se midió.
 */
async function fueraDeHorario(dias: number): Promise<{ contactos: number; sobre: number } | null> {
  const f = await datos()
    .selectFrom('contactos as ct')
    .select([
      sql<number>`count(*) filter (where prim is not null and ct.zona_horaria_del_lead is not null)`.as('sobre'),
      sql<number>`count(*) filter (
        where prim is not null and ct.zona_horaria_del_lead is not null
          and (extract(hour from prim at time zone ct.zona_horaria_del_lead) < ${DESDE}
            or extract(hour from prim at time zone ct.zona_horaria_del_lead) >= ${HASTA}))`.as('fuera'),
    ])
    .innerJoin(
      (eb) =>
        eb
          .selectFrom('contactos as c2')
          .select([
            'c2.id as cid',
            sql<Date | null>`(select min(m.enviado_el) from negocio.mensajes m
               where m.org_id = c2.org_id and m.contacto_id = c2.id and m.direccion = 'saliente')`.as('prim'),
          ])
          .as('h'),
      (j) => j.onRef('h.cid', '=', 'ct.id'),
    )
    .where(sql<boolean>`ct.alta_en_el_crm >= now() - make_interval(days => ${dias})`)
    .executeTakeFirst();

  const sobre = Number(f?.sobre ?? 0);
  /* Sin ningún contacto con zona no hay nada que decir, y un «0 de 0» se lee como «nunca pasa». */
  if (sobre === 0) return null;
  return { contactos: Number(f?.fuera ?? 0), sobre };
}

/**
 * Qué advertir del corte, y cuándo callarse.
 *
 * El caso que importa es el primero: **ninguna fuente llegó al piso**. Ahí la tabla es una sola fila
 * «Otras» sin tasa, y sin explicación se lee como que el sistema no sabe de dónde vienen los leads —
 * cuando lo que pasa es que vienen repartidos entre muchas fuentes chicas.
 */
function avisoDe(porFuente: FilaDeAtribucion[], porCampana: FilaDeAtribucion[]): string | null {
  const conTasa = porFuente.filter((f) => !f.esElResto);
  if (porFuente.length === 0) return null; // Sin cohorte; ya lo dice el aviso de Lead Flow.
  if (conTasa.length === 0) {
    const total = porFuente.reduce((n, f) => n + f.cohorte, 0);
    return `Los ${total} leads del período vienen repartidos entre fuentes de menos de ` +
      `${PISO_DE_UNA_TASA} contactos cada una, así que ninguna tiene suficientes para una tasa. No ` +
      'es que se desconozca su origen: está guardado, pero partido demasiado fino para comparar.';
  }
  const resto = [...porFuente, ...porCampana].filter((f) => f.esElResto);
  if (resto.length === 0) return null;
  const n = resto.reduce((s, f) => s + f.cohorte, 0);
  return `«Otras» junta las fuentes y campañas con menos de ${PISO_DE_UNA_TASA} contactos y va sin ` +
    `tasa a propósito: entre ellas hay ${n} lead(s) repartidos, y un porcentaje sobre grupos así de ` +
    'chicos se mueve diez puntos con cada contacto nuevo. El conteo sí sirve; el porcentaje no.';
}
