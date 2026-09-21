// Por dónde entra la gente, y qué hace cada camino. El bloque principal de Conversion.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LAS FAMILIAS NO SE SUMAN, Y ÉSE ES TODO EL DISEÑO
//
// El prototipo dibujaba cinco pasos encadenados con una flecha entre cada par, y cada paso publicaba
// su porcentaje sobre el total de visitas. Eso es correcto **cuando todos pasan por el mismo sitio**.
//
// Medido contra producción el 2026-09-20: en septiembre el **44 %** agenda directo en el widget sin
// pisar la landing y otro **35 %** llega sin abrir ninguna página. La landing es el **13 %**. La
// flecha entre «landing» y «agenda» afirmaría un paso que el 87 % de la gente no da.
//
// Así que esto devuelve **una fila por familia**, no un embudo: cada una con su conteo y su porción
// de la cohorte, dibujadas una debajo de otra. Sumar `landing + widget` diría que son etapas de un
// mismo camino y son **caminos alternativos**.
//
// ── NO HAY TASA DE AGENDA POR RECORRIDO, Y NO ES UN OLVIDO ──────────────────
//
// La primera versión de este módulo publicaba `agendaron / contactos` por familia. **Medido contra
// producción, era circular**, y el dato que lo prueba es el campo `medium` de la atribución, que
// dice CUÁNDO se capturó la dirección:
//
//     medium            contactos   agendaron
//     External Form           200      35   (17 %)  ← se capturó al enviar el formulario
//     (sin medium)            157      46   (29 %)
//     calendar                124      99   (80 %)  ← se capturó AL RESERVAR
//     facebook                 88       0   ( 0 %)  ← formulario nativo, nunca abre página
//     form                     20      20   (100 %) ← el precall, que es post-agendamiento
//
// Y el mismo host aparece con los dos: `accelerator.ariaia.com` tiene **187 contactos con
// `External Form` que agendan al 13 %** y **43 con `calendar` que agendan al 74 %**. Son dos
// poblaciones distintas bajo el mismo nombre, y juntarlas daba una tasa de landing del 47 % que no
// describe a nadie.
//
// El problema no es la lista de hosts: es que `atribucion_ultima` es el ÚLTIMO toque, y para 124 de
// 590 contactos ese último toque **es la reserva**. Cualquier tasa sobre esa población divide
// «agendó» por un denominador definido en parte por haber agendado. Es la regla 3 del departamento
// —`docs/estado actual/03-CONVERSION.md:230`— y no se puede esquivar con una lista mejor.
//
// **Así que se publican CONTEOS y no tasas**, y cada familia dice cuántos de los suyos traen la
// dirección capturada al reservar: con ese número al lado, quien mire sabe cuánto de esa fila es
// circular. Publicar la tasa y una nota al pie sería publicar la tasa.
//
// El conteo de agendados sale del mismo `exists` sobre `ghl_calendario_id` que usan
// `costoDelAnuncio.ts:341-344`, `calidadDelCreativo.ts:223-226`, `atribucionDelLead.ts:150-153` e
// `indicadoresDelLead.ts:243`. No sale del campo `Form Landing VSL`, que dice `Agendado` 121 veces
// cuando las citas alcanzables son 47: publicarlo sería la tercera cifra de agendamiento del
// producto.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';

import { datos } from '../datos/contexto.ts';
import { DIAS_DE_LA_TASA, PISO_DE_UNA_TASA } from './indicadoresDeCitas.ts';
import {
  type CorteDeEpoca,
  FAMILIAS,
  type Familia,
  ROTULOS,
  corteDeEpoca,
  familiaDelRecorrido,
  ventanaDeLaCohorte,
} from './recorrido.ts';
import { tieneCitaAlcanzable } from './citasAlcanzables.ts';

export interface FilaDeRecorrido {
  familia: Familia;
  /** Cómo se llama en pantalla. Viaja en la respuesta; ver `RecorridoDeLosLeads.rotulos`. */
  titulo: string;
  /** Contactos de la cohorte que entraron por acá. */
  contactos: number;
  /** Qué porción de la cohorte es, en proporción de 0 a 1. **Nunca nulo**: es un conteo dividido. */
  porcion: number;
  /**
   * Cuántos llegaron a tener una cita alcanzable. **Un conteo, no una tasa** — ver el encabezado.
   */
  agendaron: number;
  /**
   * De los `contactos` de esta familia, cuántos traen la dirección capturada **al reservar**
   * (`medium` es `calendar` o `form`).
   *
   * Es la medida de cuánto de esta fila es circular: si `capturadaAlReservar` es igual a
   * `contactos`, entonces «entró por acá» y «reservó acá» son el mismo hecho y la fila no dice nada
   * sobre el recorrido. Viaja siempre y al lado, como los dos términos de una cobertura.
   */
  capturadaAlReservar: number;
}

export interface RecorridoDeLosLeads {
  dias: number;
  /** Los extremos de la cohorte ALCANZADA, no de la ventana pedida. */
  desde: string | null;
  hasta: string | null;
  /** Una fila por familia con al menos un contacto, en el orden de `FAMILIAS`. */
  filas: FilaDeRecorrido[];
  /** La cohorte entera. Las filas suman esto exacto; ver `avisoDe`. */
  cohorte: number;
  /**
   * Sobre cuántos de la cohorte se puede decir por dónde entraron, con sus **dos** términos.
   *
   * `sobre` es la cohorte entera y no los que traen dirección: el rótulo de la pantalla promete
   * «contactos», y con el denominador chico la cifra sale siete puntos más alta. Es el mismo defecto
   * que `calidadDelCreativo.ts:291-317` corrigió en el puente de Creative.
   */
  cobertura: { con: number; sobre: number };
  /** Hasta cuándo se escribió el embudo del formulario, y si esta ventana lo cruza. */
  corte: CorteDeEpoca;
  /** El texto de cada familia, una vez por respuesta. La pantalla es `'use client'` y no importa. */
  rotulos: Record<Familia, { titulo: string; que: string }>;
  aviso: string | null;
}

/**
 * El puesto de una familia en el orden de `FAMILIAS`.
 *
 * Un `indexOf` sobre siete elementos y **no** un `Map` en el nivel superior: el cable trampa de
 * `ADR-0703` —`pruebas/codigo/70-publicacion.test.ts:169`— busca la FORMA y no la intención, porque
 * el motivo por el que existe es que un caché de proceso se reutiliza entre peticiones de
 * organizaciones distintas. Este mapa no guardaba datos de nadie, pero eximirlo habría agregado la
 * segunda excepción por nombre a una prueba cuyo propio comentario dice que la lista no crece.
 *
 * `-1` va al final y no al principio: una familia que el `case` no emitiera no debe quedar arriba
 * de todo, que es justo donde se mira primero.
 */
function puesto(f: Familia): number {
  const i = FAMILIAS.indexOf(f);
  return i === -1 ? FAMILIAS.length : i;
}

/**
 * El reparto de la cohorte por recorrido, en la ventana.
 *
 * Se corre dentro de `conOrganizacion(`.
 */
export async function recorridoDelLead(dias = DIAS_DE_LA_TASA): Promise<RecorridoDeLosLeads> {
  const familia = familiaDelRecorrido('contactos');

  const [filas, extremos, corte] = await Promise.all([
    datos()
      .selectFrom('contactos')
      .select([
        familia.as('familia'),
        sql<number>`count(*)`.as('contactos'),
        /* El MISMO `exists` con `ghl_calendario_id` que los otros cuatro módulos. Tiene que ser el
           mismo o las filas de este corte no sumarían la cifra grande de al lado, y nadie tendría
           cómo darse cuenta de cuál de las dos está mal.
           *
           * Y `exists` y no un `join` con `count(*)`: un contacto con dos citas pesaría doble.
           Verificado en `docs/estado actual/02-CREATIVE.md:287`, donde ese defecto infló una pieza
           de 109 a 112. */
        sql<number>`count(*) filter (where ${tieneCitaAlcanzable('contactos')})`.as('agendaron'),
        // Los que traen dirección: el numerador de la cobertura.
        sql<number>`count(*) filter (where contactos.atribucion_ultima ? 'url')`.as('conUrl'),
        /* Los que la traen capturada AL RESERVAR. `calendar` es el widget y `form` es el precall,
           los dos posteriores a la cita. Lista cerrada y no un `like`: un medio nuevo tiene que
           aparecer como no-circular y notarse, no colarse como circular por parecerse. */
        sql<number>`count(*) filter (
          where contactos.atribucion_ultima ->> 'medium' in ('calendar', 'form'))`.as('alReservar'),
      ])
      .where(ventanaDeLaCohorte('contactos', dias))
      /* Se agrupa por la EXPRESIÓN, que es la misma instancia textual que la del `select`. Ver el
         argumento de `sql.raw` en `recorrido.ts`: con parámetros esto muere con `42803`. */
      .groupBy(familia)
      .execute(),

    /* Los extremos de la cohorte alcanzada, no de la ventana pedida. Una ventana de 30 días sobre
       cinco contactos no muestra «poca gente»: muestra cinco días con gente y veinticinco sin
       nadie, y decir «del 22 de agosto al 20 de septiembre» sobre eso afirma un alcance que no hay. */
    datos()
      .selectFrom('contactos')
      .select([
        sql<string | null>`min(alta_en_el_crm)::date::text`.as('primero'),
        sql<string | null>`max(alta_en_el_crm)::date::text`.as('ultimo'),
      ])
      .where(ventanaDeLaCohorte('contactos', dias))
      .executeTakeFirst(),

    corteDeEpoca(dias),
  ]);

  const cohorte = filas.reduce((s, f) => s + Number(f.contactos), 0);
  const conUrl = filas.reduce((s, f) => s + Number(f.conUrl), 0);

  const salida: FilaDeRecorrido[] = filas
    .map((f) => {
      const contactos = Number(f.contactos);
      return {
        familia: f.familia,
        titulo: ROTULOS[f.familia]?.titulo ?? f.familia,
        contactos,
        /* La porción SÍ se publica, y sin piso: es un conteo dividido por otro conteo sobre la misma
           población, no una tasa sobre una muestra. Una familia de tres contactos es el 1 % de la
           cohorte, y eso es un hecho exacto, no una estimación que se mueva con el próximo caso. */
        porcion: cohorte === 0 ? 0 : contactos / cohorte,
        agendaron: Number(f.agendaron),
        capturadaAlReservar: Number(f.alReservar),
      };
    })
    .sort((a, b) => puesto(a.familia) - puesto(b.familia));

  return {
    dias,
    desde: extremos?.primero ?? null,
    hasta: extremos?.ultimo ?? null,
    filas: salida,
    cohorte,
    cobertura: { con: conUrl, sobre: cohorte },
    corte,
    rotulos: ROTULOS,
    aviso: avisoDe(salida, cohorte, corte),
  };
}


/**
 * El aviso. **`null` ⟹ la pantalla no dibuja nada**, que es la regla del silencio de este proyecto.
 *
 * El orden es el mismo criterio que `costoDelAnuncio`: primero lo que invalida la lectura entera,
 * después lo que la matiza.
 */
/**
 * Una lista en castellano: «A», «A y B», «A, B y C».
 *
 * Era un `join(' y ')`, que con dos elementos se lee bien y con tres da «A y B y C». **No se veía
 * porque en producción eran dos**: las familias circulares medidas el 2026-09-20 sobre treinta días
 * son «Meta, navegador interno» y «Precall». Apareció al mirar la pantalla con una tercera.
 *
 * A mano y no con `Intl.ListFormat`: esa API depende de que el runtime traiga los datos de idioma
 * completos, y un `small-icu` devolvería la lista en inglés —«A, B and C»— sin fallar. Es el mismo
 * tipo de silencio que el resto de este archivo existe para evitar.
 */
function enumerar(partes: string[]): string {
  if (partes.length <= 1) return partes[0] ?? '';
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

function avisoDe(filas: FilaDeRecorrido[], cohorte: number, corte: CorteDeEpoca): string | null {
  const partes: string[] = [];

  /* ── «NO HAY TRÁFICO» Y «NO HAY DATO» SON DOS AFIRMACIONES DISTINTAS ───────
   *
   * Con la ventana de «hoy» la cohorte son cero contactos, y no porque falte un campo: porque la
   * pauta está en cero desde el 2026-09-14 (medido, `docs/conversion/14-…md`). Una pantalla que
   * diga «no hay dato» sobre una ventana sin tráfico manda a buscar un defecto que no existe. */
  if (cohorte === 0) {
    return (
      'No entró ni un contacto en esta ventana. No es que falte el dato: no hubo gente. Probá una ' +
      'ventana más larga.'
    );
  }

  if (corte.laVentanaLoCruza && corte.fecha !== null) {
    partes.push(
      `Esta ventana cruza el ${corte.fecha}, que es el último día con el formulario de la landing ` +
        'escrito. Antes de esa fecha la mayoría entraba por la landing y después casi nadie, así ' +
        'que el reparto de abajo mezcla dos maneras distintas de captar gente.',
    );
  }

  /* Las familias donde «entró por acá» y «reservó acá» son el mismo hecho. No se ocultan —su gente
     es parte de la cohorte y tiene que sumar— pero hay que decir que su conteo de agendados no
     describe un recorrido. */
  const circulares = filas.filter(
    (f) => f.contactos >= PISO_DE_UNA_TASA && f.capturadaAlReservar / f.contactos >= 0.9,
  );
  if (circulares.length > 0) {
    partes.push(
      `En ${enumerar(circulares.map((f) => `«${f.titulo}»`))} la dirección se registró al ` +
        'reservar, así que el conteo de agendados de esa fila no dice que ese camino convierta ' +
        'mejor: dice que quien llegó ahí ya había agendado.',
    );
  }

  /* La nota de definición, que es de la fuente y no de ninguna ventana: se dice siempre que haya
     algo que decir sobre el reparto, porque sin ella «landing» se lee como «visitó la landing». */
  partes.push(
    'El recorrido sale de la ÚLTIMA dirección registrada del contacto, que dice por dónde volvió a ' +
      'entrar. No dice cuánto tiempo estuvo ahí ni qué hizo: para eso harían falta sesiones, y no ' +
      'existen.',
  );

  return partes.length === 0 ? null : partes.join(' ');
}
