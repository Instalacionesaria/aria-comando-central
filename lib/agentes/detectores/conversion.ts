// El detector de Conversion (AG14 de los agentes; `docs/OTROS/agentes/fichas/F04-CONVERSION.md`, la especificación
// que el usuario validó el 2026-10-04; `docs/conversion/06` y `07`, CV6 y CV7).
//
// ═══════════════════════════════════════════════════════════════════════════════
// LEE LO QUE LEE LA PANTALLA
//
// `lecturaDeConversion`, la misma de `app/api/conversion/route.ts`: el reparto, el formulario y el reparto de la
// ventana anterior, con los días CERRADOS de Acquisition (`bordesDelPeriodo`) y la zona de la empresa. Así cumple
// AG-28 —7 y 30 días cerrados— y una señal habla de los mismos contactos que la pantalla (CV15-23 de
// `docs/conversion/15-EL-FRONT-ORIGINAL-CON-DATOS-REALES.md`). Hasta el 2026-10-08 leía días de calendario hasta
// hoy, y la anterior salía del doble de días menos la actual. Si la lectura no compara —sin historia que cubra la
// anterior, o con la lectura de contactos o de citas atrasada—, el cambio de ruta queda sin medición.
//
// ── LAS REGLAS DE CUIDADO ───────────────────────────────────────────────────
//
//   · **Las familias circulares no compiten.** Si casi todos los contactos de una familia traen la dirección
//     capturada al reservar, «entró por acá» y «reservó acá» son el mismo hecho, y su agenda no dice nada del
//     recorrido: no generan «no agenda», ni «no tocar».
//   · **La pérdida es lo medido**: los contactos de la familia que no agendaron. Ningún coeficiente de
//     recuperación (CV6-06).
//   · **Ningún nombre de persona** (CV6-08): las entidades son familias de entrada y el formulario.
//   · **A quién le toca** (CV6-05): la landing, el widget y otra página propia, a Conversion; lo que viene del
//     anuncio sin página (formulario nativo, navegador de Meta), a Acquisition; el precall, a Conversation.
//     «Sin rastro» no le toca a nadie, y por eso no compite en ninguna regla de familias: no es un recorrido.
//
// Lo que no se puede medir no se publica: sin la lectura de contactos al día, las reglas del recorrido van a
// «sin medición»; sin el campo del formulario en el CRM, las del formulario.
// ═══════════════════════════════════════════════════════════════════════════════

import type { RecorridoDeLosLeads } from '../../negocio/recorridoDelLead.ts';
import type { EmbudoDelFormulario } from '../../negocio/embudoDelFormulario.ts';
import { lecturaDeConversion } from '../../negocio/pasosDeConversion.ts';
import type { Familia } from '../../negocio/recorrido.ts';
import { PISO_DE_UNA_SENAL, type DebajoDelPiso, type DepartamentoConSenales, type Deteccion, type VentanaDeSenal } from '../senales/tipos.ts';
import type { ReglaDelCatalogo } from '../senales/umbrales.ts';

export const CNV = {
  familiaQueNoAgenda: 'CNV-FAMILIA-QUE-NO-AGENDA',
  cambioDeRuta: 'CNV-CAMBIO-DE-RUTA',
  formularioAbandono: 'CNV-FORMULARIO-ABANDONO',
  formularioSinDatos: 'CNV-FORMULARIO-SIN-DATOS',
} as const;

/** La regla de «No tocar» (CV6-04). No es una señal: va sólo al plan, como renglón informativo. */
export const NO_TOCAR = 'CNV-NO-TOCAR';

export const REGLAS_DE_CONVERSION: readonly ReglaDelCatalogo[] = [
  {
    codigo: CNV.familiaQueNoAgenda,
    departamento: 'conversion',
    valor: 0.15,
    unidad: 'puntos_porcentuales',
    denominador: 'contactos de la familia',
    gravedad: 'media',
    porque: 'Quince puntos bajo la agenda de la cohorte, con diez contactos en la familia, separan un recorrido que pierde gente de una diferencia por azar.',
  },
  {
    codigo: CNV.cambioDeRuta,
    departamento: 'conversion',
    valor: 0.15,
    unidad: 'puntos_porcentuales',
    denominador: 'contactos de la cohorte',
    gravedad: 'info',
    porque: 'Que una familia gane o pierda quince puntos de la cohorte de una ventana a otra es un cambio de ruta (CV7-09, el hallazgo más grande del departamento). Cambia a dónde va el presupuesto: requiere validación ejecutiva.',
  },
  {
    codigo: CNV.formularioAbandono,
    departamento: 'conversion',
    valor: 0.5,
    unidad: 'proporcion',
    denominador: 'contactos que empezaron el formulario',
    gravedad: 'media',
    porque: 'Si menos de la mitad de los que empiezan el formulario lo terminan, el formulario mismo es la fricción.',
  },
  {
    codigo: CNV.formularioSinDatos,
    departamento: 'conversion',
    valor: 0.1,
    unidad: 'proporcion',
    denominador: 'contactos de la cohorte',
    gravedad: 'media',
    porque: 'Con menos de uno de cada diez contactos trayendo el formulario, lo que la pantalla dice de él no vale para la ventana: el formulario dejó de llegar.',
  },
];

/** Si al menos esta parte de una familia trae la dirección capturada al reservar, la familia es circular. */
export const PORCION_CIRCULAR = 0.9;

/** A quién le toca cada fricción, por la familia por la que entró (CV6-05). `null`: nadie puede actuar sobre ella. */
export const LE_TOCA: Readonly<Record<Familia, DepartamentoConSenales | null>> = {
  landing: 'conversion',
  widget: 'conversion',
  otra: 'conversion',
  'sin-pagina': 'acquisition',
  'meta-navegador': 'acquisition',
  precall: 'conversation',
  'sin-rastro': null,
};

export interface MedidaDeConversion {
  ventana: VentanaDeSenal;
  recorrido: Pick<RecorridoDeLosLeads, 'filas' | 'cohorte' | 'desde' | 'hasta'>;
  /** La ventana anterior, de igual largo y justo antes. `null` si la lectura no compara: el cambio de ruta no se mide. */
  anterior: { filas: Pick<RecorridoDeLosLeads['filas'][number], 'familia' | 'contactos'>[]; cohorte: number } | null;
  formulario: Pick<EmbudoDelFormulario, 'cobertura' | 'finalizacion' | 'campoDelFormulario'>;
  /** Si la lectura de contactos del CRM está al día. */
  contactosAlDia: boolean;
  periodo: { desde: string; hasta: string };
}

/**
 * Corre dentro de `conOrganizacion`.
 *
 * @param zona La de la empresa (`identidad.organizaciones.zona_horaria`): cuándo termina su día, para los días cerrados.
 */
export async function medirConversion(ventana: VentanaDeSenal, zona: string): Promise<MedidaDeConversion> {
  const lectura = await lecturaDeConversion({ clave: ventana, dias: ventana === '7d' ? 7 : 30 }, zona);
  // La frescura al medir, por el ciclo de módulos que explica `./creative.ts`.
  const { frescuraDe } = await import('../../negocio/frescura.ts');
  const contactos = await frescuraDe('contactos');
  const previa = lectura.recorridoAnterior;
  return {
    ventana,
    recorrido: lectura.recorrido,
    anterior: previa === null ? null : { filas: previa.filas.map((f) => ({ familia: f.familia, contactos: f.contactos })), cohorte: previa.cohorte },
    formulario: lectura.formulario,
    contactosAlDia: contactos.estado === 'al_dia',
    periodo: lectura.ventana,
  };
}

type Umbral = (codigo: string) => { valor: number; provisional: boolean };
const redondear = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

export function detectarEnConversion(
  m: MedidaDeConversion,
  umbral: Umbral,
): { detecciones: Deteccion[]; informativas: Deteccion[]; debajoDelPiso: DebajoDelPiso[]; sinMedicion: string[] } {
  const salida = { detecciones: [] as Deteccion[], informativas: [] as Deteccion[], debajoDelPiso: [] as DebajoDelPiso[], sinMedicion: [] as string[] };
  const base = { periodo: m.periodo, datosDesde: null, requiereValidacionEjecutiva: false };
  const cohorte = m.recorrido.cohorte;
  const agendaronTodos = m.recorrido.filas.reduce((s, f) => s + f.agendaron, 0);

  // ── Las familias de entrada ──
  if (!m.contactosAlDia) {
    salida.sinMedicion.push(CNV.familiaQueNoAgenda, CNV.cambioDeRuta);
  } else if (cohorte >= PISO_DE_UNA_SENAL) {
    const tasaDeLaCohorte = agendaronTodos / cohorte;
    const u = umbral(CNV.familiaQueNoAgenda);
    for (const f of m.recorrido.filas) {
      // «Sin rastro» no es un recorrido: no se sabe por dónde entró nadie, y nadie puede actuar sobre eso.
      if (LE_TOCA[f.familia] === null) continue;
      const entidad = { tipo: 'familia_de_entrada' as const, id: f.familia };
      const circular = f.contactos > 0 && f.capturadaAlReservar / f.contactos >= PORCION_CIRCULAR;
      if (circular) continue;
      const tasa = f.contactos > 0 ? f.agendaron / f.contactos : 0;
      const debajo = tasaDeLaCohorte - tasa;
      const evidencia = { ventana: m.ventana, familia: f.familia, contactos: f.contactos, agendaron: f.agendaron, cohorte, agendaronEnLaCohorte: agendaronTodos, capturadaAlReservar: f.capturadaAlReservar };
      if (f.contactos < PISO_DE_UNA_SENAL) {
        if (debajo >= u.valor) salida.debajoDelPiso.push({ regla: CNV.familiaQueNoAgenda, entidad, muestra: f.contactos });
        continue;
      }
      const leToca = LE_TOCA[f.familia];
      if (debajo >= u.valor) {
        salida.detecciones.push({
          ...base,
          regla: CNV.familiaQueNoAgenda,
          entidad,
          metrica: 'tasa_de_agenda',
          lineaBase: redondear(tasaDeLaCohorte),
          valorActual: redondear(tasa),
          cambioPct: null,
          muestra: f.contactos,
          gravedad: 'media',
          causasPosibles:
            leToca === 'acquisition'
              ? ['puede deberse a lo que promete el anuncio']
              : leToca === 'conversation'
                ? ['puede deberse a lo que pasa en la conversación después de entrar']
                : ['puede deberse a la página o al video por los que entra'],
          revisionRecomendada: 'Revisa ese recorrido: agenda bastante menos que el resto de la cohorte.',
          perdidaContactos: f.contactos - f.agendaron,
          destino: leToca === 'conversion' ? null : leToca,
          umbral: u,
          evidencia: { ...evidencia, leToca },
        });
      } else if (tasa >= tasaDeLaCohorte) {
        // «No tocar» (CV6-04): agenda igual o mejor que la cohorte. Va al plan, no a las señales.
        salida.informativas.push({
          ...base,
          regla: NO_TOCAR,
          entidad,
          metrica: 'tasa_de_agenda',
          lineaBase: redondear(tasaDeLaCohorte),
          valorActual: redondear(tasa),
          cambioPct: null,
          muestra: f.contactos,
          gravedad: 'info',
          causasPosibles: [],
          revisionRecomendada: 'No lo toques mientras se corrige lo demás.',
          perdidaContactos: null,
          destino: null,
          umbral: { valor: 0, provisional: true },
          evidencia,
        });
      }
    }

    // ── El cambio de ruta: la porción de cada familia contra la ventana anterior ──
    const uRuta = umbral(CNV.cambioDeRuta);
    const anterior = m.anterior;
    const antes = new Map((anterior?.filas ?? []).map((f) => [f.familia, f.contactos]));
    // Sin una anterior que la lectura compare, no hay contra qué medir el cambio: se dice, no se calla.
    if (anterior === null) salida.sinMedicion.push(CNV.cambioDeRuta);
    else if (anterior.cohorte >= PISO_DE_UNA_SENAL) {
      for (const f of m.recorrido.filas) {
        // Que crezca «sin rastro» es un problema de la lectura, no un cambio de ruta que decida la dirección.
        if (LE_TOCA[f.familia] === null) continue;
        const porcionAntes = (antes.get(f.familia) ?? 0) / anterior.cohorte;
        const porcionAhora = f.contactos / cohorte;
        const cambio = porcionAhora - porcionAntes;
        if (Math.abs(cambio) < uRuta.valor) continue;
        salida.detecciones.push({
          ...base,
          regla: CNV.cambioDeRuta,
          entidad: { tipo: 'familia_de_entrada', id: f.familia },
          metrica: 'porcion_de_la_cohorte',
          lineaBase: redondear(porcionAntes),
          valorActual: redondear(porcionAhora),
          cambioPct: redondear(cambio),
          muestra: Math.min(cohorte, anterior.cohorte),
          gravedad: 'info',
          causasPosibles: ['puede deberse a un cambio de campañas o de presupuesto entre las dos ventanas'],
          revisionRecomendada: 'Decide con la dirección si ese cambio de ruta es el que se buscaba.',
          perdidaContactos: null,
          destino: null,
          requiereValidacionEjecutiva: true,
          umbral: uRuta,
          evidencia: { ventana: m.ventana, familia: f.familia, ahora: { contactos: f.contactos, cohorte }, antes: { contactos: antes.get(f.familia) ?? 0, cohorte: anterior.cohorte } },
        });
      }
    }
  }

  // ── El formulario ──
  if (m.formulario.campoDelFormulario === null) {
    salida.sinMedicion.push(CNV.formularioAbandono, CNV.formularioSinDatos);
  } else {
    const { con, sobre } = m.formulario.cobertura;
    const entidad = { tipo: 'funnel' as const, id: 'formulario' };
    const uSin = umbral(CNV.formularioSinDatos);
    if (sobre >= PISO_DE_UNA_SENAL && con / sobre < uSin.valor) {
      salida.detecciones.push({
        ...base,
        regla: CNV.formularioSinDatos,
        entidad,
        metrica: 'cobertura_del_formulario',
        lineaBase: null,
        valorActual: redondear(con / sobre),
        cambioPct: null,
        muestra: sobre,
        gravedad: 'media',
        causasPosibles: ['puede deberse a que el formulario dejó de escribir el campo en el CRM'],
        revisionRecomendada: 'Revisa si el formulario de la landing sigue escribiendo su campo en el CRM.',
        perdidaContactos: null,
        destino: null,
        umbral: uSin,
        evidencia: { ventana: m.ventana, con, sobre },
      });
    }
    // `finalizacion` llega en porcentaje y nula bajo el piso de 10 que empezaron.
    const uAbandono = umbral(CNV.formularioAbandono);
    const fin = m.formulario.finalizacion;
    if (fin !== null && fin / 100 < uAbandono.valor) {
      salida.detecciones.push({
        ...base,
        regla: CNV.formularioAbandono,
        entidad,
        metrica: 'finalizacion_del_formulario',
        lineaBase: null,
        valorActual: redondear(fin / 100),
        cambioPct: null,
        muestra: con,
        gravedad: 'media',
        causasPosibles: ['puede deberse al largo del formulario o a una pregunta que frena'],
        revisionRecomendada: 'Revisa el formulario: la mitad o más lo empieza y no lo termina.',
        perdidaContactos: Math.round(con * (1 - fin / 100)),
        destino: null,
        umbral: uAbandono,
        evidencia: { ventana: m.ventana, empezaron: con, finalizacion: fin },
      });
    }
  }
  return salida;
}
