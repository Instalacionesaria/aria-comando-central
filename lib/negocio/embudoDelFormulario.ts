// El embudo del formulario de la landing, y el hueco del VSL.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LA ÚNICA FRASE QUE EL DOCUMENTO FUNCIONAL LE ATRIBUYE A ESTE DEPARTAMENTO
//
// `CC_Arquitectura_Funcional.md:1425`, § 18.11, caso 3:
//
//     Conversion: La finalización del formulario es baja.
//
// Es todo lo que el documento pone en boca de Conversion en 1.651 líneas, y este módulo es lo que
// la contesta. Medido el 2026-09-20 sobre la cohorte histórica: **(121 + 39) / 247 = 64,8 %**, o
// sea **35,2 % de abandono**.
//
// ── EL VOCABULARIO ES CERRADO, Y LO QUE NO CAE SE CUENTA ────────────────────
//
// `Form Landing VSL` es un `SINGLE_OPTIONS` con tres valores y sólo tres. Pero
// `negocio.campos_del_crm` **no guarda las opciones declaradas de un campo**, así que no hay forma
// de enterarse de que el CRM agregó un cuarto salvo contando los que no caen en ninguna rama y
// publicándolos. Es lo mismo que `consumoDelPrecall.ts:74-85` hace con `-20%`, `Clic a link` y
// `Accede: sin reproducir`. Hoy los huérfanos son cero, **y por eso hay que contarlos**: el día que
// no lo sean, nadie se va a enterar de otra manera.
//
// ── Y SU `Agendado` NO ES LA FUENTE DEL AGENDAMIENTO ────────────────────────
//
// El campo dice `Agendado` **121** veces. Las citas alcanzables de esos mismos contactos son **47**
// —119 tienen alguna cita y 72 están congeladas—. Publicar el campo como fuente de agendamiento
// crearía la tercera cifra de agendamiento del producto, contra las 47 que ya publican Acquisition
// y Conversation.
//
// Lo que este campo aporta, y ninguna otra pantalla puede dar, es **el abandono**: cuántos
// empezaron el formulario y no lo terminaron. Eso no está en `negocio.citas` ni en ningún otro lado.
//
// ── Y LA POBLACIÓN MURIÓ EL 2026-08-31 ─────────────────────────────────────
//
// Ningún contacto creado desde esa fecha trae el campo. El campo **sigue existiendo en el CRM**
// —visto el 2026-09-20— así que no lo borró nadie: dejó de haber quien pasara por el formulario.
// Por eso `corteDeEpoca` viaja al lado y no como nota al pie: una ventana de 30 días mezcla la
// época en que el formulario se llenaba con la época en que no existe.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';

import { datos } from '../datos/contexto.ts';
import { campoPorNombre } from './camposDelCrm.ts';
import { DIAS_DE_LA_TASA, PISO_DE_UNA_TASA } from './indicadoresDeCitas.ts';
import {
  CAMPO_DEL_FORMULARIO,
  type CorteDeEpoca,
  ESTADOS_DEL_FORMULARIO,
  type EstadoDelFormulario,
  corteDeEpoca,
  ventanaDeLaCohorte,
} from './recorrido.ts';

export interface FilaDelFormulario {
  estado: EstadoDelFormulario;
  contactos: number;
  /** Porción de los que traen el campo. Conteo sobre conteo: **nunca nulo**. */
  porcion: number;
}

export interface EmbudoDelFormulario {
  dias: number;
  /** Los extremos de la cohorte que TRAE EL CAMPO, no de la ventana pedida. */
  desde: string | null;
  hasta: string | null;
  /** Una fila por estado del vocabulario, en el orden del embudo. */
  filas: FilaDelFormulario[];
  /**
   * Cuántos contactos de la ventana traen el campo, sobre la cohorte entera.
   *
   * Los dos términos, siempre: es lo que separa «el 65 % completa el formulario» de «el 65 % de los
   * 247 que llegaron a verlo, que son el 42 % de la cohorte».
   */
  cobertura: { con: number; sobre: number };
  /**
   * `(Agendado + Form completo sin agendar) / los que traen el campo`, en porcentaje.
   *
   * **`null` bajo el piso, nunca cero.** Es la cifra que contesta al § 18.11.
   */
  finalizacion: number | null;
  /**
   * Contactos con un valor que no es ninguno de los tres. **Se cuentan y se informan, no se
   * fuerzan.** Ver el encabezado.
   */
  fueraDelVocabulario: number;
  /**
   * Cuántos de los que el campo marca `Agendado` tienen de verdad una cita alcanzable.
   *
   * Viaja para que la contradicción sea visible en la respuesta y no haya que descubrirla cruzando
   * dos pantallas. Medido el 2026-09-20 sobre la base entera: el campo dice 121 y las citas
   * alcanzables son 47.
   */
  agendadoSegunLasCitas: { segunElCampo: number; conCitaAlcanzable: number };
  corte: CorteDeEpoca;
  /** `null` si el CRM no tiene el campo. Entonces el bloque entero se apaga y lo dice. */
  campoDelFormulario: string | null;
  /** Lo que este departamento NO puede medir, con el motivo. **Se dibuja**; ver `FUERA_DE_ALCANCE`. */
  fueraDeAlcance: { punto: string; porque: string }[];
  aviso: string | null;
}

/**
 * Lo que Conversion no puede medir, con su motivo medido.
 *
 * Es el patrón `fueraDeAlcance` de `calidadDeLaAtribucion.ts:69`, y existe por lo mismo: *«viajan
 * para que nadie los rehaga»*. Pero acá hay un segundo motivo, que es el que decidió el usuario el
 * 2026-09-20: **el prototipo dibujaba estas cinco cosas con números inventados** —una curva de
 * retención con 89 literales y dos caídas marcadas al segundo exacto, un mapa de calor de seis
 * zonas, el abandono campo por campo—. Quien conozca esa pantalla las va a buscar, y si no están ni
 * se dice por qué, la lectura razonable es que se rompió.
 *
 * **La diferencia entre un hueco declarado y una regresión es este párrafo.**
 */
export const FUERA_DE_ALCANCE: { punto: string; porque: string }[] = [
  {
    punto: 'La retención del VSL',
    porque:
      /* Sin asteriscos: la pantalla dibuja este texto tal cual, dentro de un `<p>`. Un Markdown se
         lee con los asteriscos puestos, y el texto que existe para explicar un hueco termina
         pareciendo un error de la aplicación. Ya pasó en el aviso de fatiga de Creative. */
      'el campo que la guarda se escribió 79 veces entre el 2026-08-11 y el 2026-08-30 y las 79 ' +
      'dicen cero. No es que nadie viera el video: es que el medidor no reporta. Los otros dos ' +
      'campos de porcentaje de video están en 0 de 590. Hace falta arreglar vTurb o su integración, ' +
      'que está fuera de este sistema',
  },
  {
    punto: 'Las sesiones, los visitantes y los eventos de página',
    porque:
      /* Sin acentos graves tampoco. La pantalla dibuja este texto crudo dentro de un `<p>`, así que
         un «`visitor_id`» se lee con las comillas invertidas puestas. Verificado en el navegador el
         2026-09-20: salían literales. Es el mismo motivo por el que no lleva asteriscos. */
      'no existe ninguna tabla que los guarde, y los identificadores de visitante y de sesión no ' +
      'aparecen en una sola línea del repositorio. Un visitante que no se convierte en contacto no ' +
      'deja rastro en ningún lado, así que la unidad de este departamento es el contacto y no la visita',
  },
  {
    punto: 'El mapa de calor, el scroll y los clics muertos',
    porque:
      'Clarity aparece en la pantalla como fuente conectada y sólo existe como una cadena de texto ' +
      'en el JSX: no hay integración, ni credencial, ni variable de entorno, ni tabla',
  },
  {
    punto: 'La tasa de conversión de la landing',
    porque:
      'su denominador tendría que ser gente registrada AL LLEGAR, y la dirección se registra al ' +
      'convertir: medido, 124 de 590 contactos la traen con origen «calendar». Una tasa sobre esa ' +
      'población divide «agendó» por un denominador definido en parte por haber agendado',
  },
  {
    punto: 'El abandono pregunta por pregunta del formulario',
    porque:
      'GoHighLevel no expone ningún endpoint de formularios ni de encuestas — ninguna de las catorce ' +
      'operaciones que este sistema usa los toca. Haría falta instrumentar el formulario',
  },
];

/**
 * El embudo del formulario, en la ventana.
 *
 * Se corre dentro de `conOrganizacion(`.
 */
export async function embudoDelFormulario(dias = DIAS_DE_LA_TASA): Promise<EmbudoDelFormulario> {
  const campo = await campoPorNombre(CAMPO_DEL_FORMULARIO);
  const corte = await corteDeEpoca(dias);

  /* Sin el campo, el bloque entero se apaga **y lo dice**. No publica ceros: que el CRM no tenga
     ese campo no significa que nadie complete el formulario. Es el mismo apagado que
     `calidadDelCreativo.ts:358-363` hace con el campo de ICP. */
  if (campo === null) {
    return {
      dias,
      desde: null,
      hasta: null,
      filas: [],
      cobertura: { con: 0, sobre: 0 },
      finalizacion: null,
      fueraDelVocabulario: 0,
      agendadoSegunLasCitas: { segunElCampo: 0, conCitaAlcanzable: 0 },
      corte,
      campoDelFormulario: null,
      fueraDeAlcance: FUERA_DE_ALCANCE,
      aviso:
        `El CRM de esta empresa no tiene un campo «${CAMPO_DEL_FORMULARIO}», o cambió de nombre. ` +
        'Sin él no se puede decir cuánta gente abandona el formulario: no es que nadie lo abandone.',
    };
  }

  const valor = sql<string | null>`nullif(btrim(contactos.campos_del_crm ->> ${campo}), '')`;

  const f = await datos()
    .selectFrom('contactos')
    .select([
      sql<number>`count(*)`.as('cohorte'),
      sql<number>`count(*) filter (where ${valor} is not null)`.as('conCampo'),
      ...ESTADOS_DEL_FORMULARIO.map((e) =>
        sql<number>`count(*) filter (where ${valor} = ${e})`.as(`e_${e.replace(/\s+/g, '_')}`),
      ),
      /* Los que traen un valor y no es ninguno de los tres. Se cuentan y se informan. */
      sql<number>`count(*) filter (
        where ${valor} is not null
          and ${valor} not in (${sql.join(ESTADOS_DEL_FORMULARIO.map((e) => sql`${e}`), sql`, `)}))`.as('huerfanos'),
      /* La contradicción, medida en la misma consulta para que no haya que cruzar dos pantallas. */
      sql<number>`count(*) filter (
        where ${valor} = 'Agendado'
          and exists (select 1 from negocio.citas ci
                       where ci.org_id = contactos.org_id and ci.contacto_id = contactos.id
                         and ci.ghl_calendario_id is not null))`.as('agendadoDeVerdad'),
      /* Los extremos de la cohorte QUE TRAE EL CAMPO, que es de lo que habla este bloque. */
      sql<string | null>`min(alta_en_el_crm) filter (where ${valor} is not null)::date::text`.as('primero'),
      sql<string | null>`max(alta_en_el_crm) filter (where ${valor} is not null)::date::text`.as('ultimo'),
    ])
    .where(ventanaDeLaCohorte('contactos', dias))
    .executeTakeFirst();

  const cohorte = Number(f?.cohorte ?? 0);
  const conCampo = Number(f?.conCampo ?? 0);

  const filas: FilaDelFormulario[] = ESTADOS_DEL_FORMULARIO.map((e) => {
    const n = Number((f as Record<string, unknown> | undefined)?.[`e_${e.replace(/\s+/g, '_')}`] ?? 0);
    return { estado: e, contactos: n, porcion: conCampo === 0 ? 0 : n / conCampo };
  });

  const completaron = filas
    .filter((x) => x.estado === 'Agendado' || x.estado === 'Form completo sin agendar')
    .reduce((s, x) => s + x.contactos, 0);

  const segunElCampo = filas.find((x) => x.estado === 'Agendado')?.contactos ?? 0;

  const salida: EmbudoDelFormulario = {
    dias,
    desde: f?.primero ?? null,
    hasta: f?.ultimo ?? null,
    filas,
    cobertura: { con: conCampo, sobre: cohorte },
    /* El piso es del DENOMINADOR —los que traen el campo—, no de la cohorte. Con cuatro contactos
       que llegaron al formulario, «el 75 % lo completa» se lee igual que un 75 % sobre doscientos. */
    finalizacion: conCampo >= PISO_DE_UNA_TASA ? redondear((completaron / conCampo) * 100, 1) : null,
    fueraDelVocabulario: Number(f?.huerfanos ?? 0),
    agendadoSegunLasCitas: { segunElCampo, conCitaAlcanzable: Number(f?.agendadoDeVerdad ?? 0) },
    corte,
    campoDelFormulario: CAMPO_DEL_FORMULARIO,
    fueraDeAlcance: FUERA_DE_ALCANCE,
    aviso: null,
  };

  salida.aviso = avisoDe(salida);
  return salida;
}

function redondear(v: number, decimales: number): number {
  const f = 10 ** decimales;
  return Math.round(v * f) / f;
}

/** El aviso. **`null` ⟹ la pantalla no dibuja nada.** */
function avisoDe(r: EmbudoDelFormulario): string | null {
  const partes: string[] = [];

  /* Lo primero, porque invalida la lectura entera: la población de este bloque puede no existir en
     la ventana, y eso no es «nadie abandona el formulario». */
  if (r.cobertura.con === 0) {
    partes.push(
      r.corte.fecha === null
        ? 'Ningún contacto de esta ventana pasó por el formulario de la landing.'
        : `Ningún contacto de esta ventana trae el formulario de la landing: el último fue el ` +
          `${r.corte.fecha}, y desde entonces el tráfico entra por otros caminos. El campo sigue ` +
          'existiendo en el CRM, así que no lo borró nadie — dejó de haber quien lo llenara.',
    );
    return partes.join(' ');
  }

  if (r.corte.laVentanaLoCruza && r.corte.fecha !== null) {
    partes.push(
      `Esta ventana cruza el ${r.corte.fecha}, que es el último día con el formulario escrito, así ` +
        'que las cifras de abajo hablan sólo de la parte de la ventana anterior a esa fecha.',
    );
  }

  /* La contradicción con las citas, dicha acá y no descubierta cruzando pantallas. */
  const { segunElCampo, conCitaAlcanzable } = r.agendadoSegunLasCitas;
  if (segunElCampo > conCitaAlcanzable) {
    partes.push(
      `El campo marca «Agendado» en ${segunElCampo} contacto(s) y sólo ${conCitaAlcanzable} tiene(n) ` +
        'una cita que el CRM siga devolviendo. Por eso el agendamiento de esta pantalla sale del ' +
        'calendario y no de este campo: si saliera de acá diría otra cifra que las demás pantallas.',
    );
  }

  if (r.fueraDelVocabulario > 0) {
    partes.push(
      `${r.fueraDelVocabulario} contacto(s) traen un valor que no es ninguno de los tres conocidos. ` +
        'No se fuerzan a ninguna rama: el CRM agregó una opción y hay que mirarla.',
    );
  }

  if (r.finalizacion === null) {
    partes.push(
      `Menos de ${PISO_DE_UNA_TASA} contactos llegaron al formulario en esta ventana, así que se ` +
        'muestra cuántos hay en cada estado pero no la tasa de finalización.',
    );
  }

  return partes.length === 0 ? null : partes.join(' ');
}
