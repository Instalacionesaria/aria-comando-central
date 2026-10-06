// Los temas de la Reunión de hoy: de dónde salen y en qué orden (AG15 de los agentes;
// `docs/OTROS/agentes/04-LA-REUNION-Y-LA-CABECERA.md`, AG-70 a AG-73; `fichas/F17-LA-REUNION-DE-HOY.md`).
//
// ═══════════════════════════════════════════════════════════════════════════════
// DOS FUENTES, Y NINGUNA ES EL MODELO
//
//   1. **Las señales que requieren validación ejecutiva**, abiertas o vistas, de los cuatro detectores (`02`,
//      AG-30). Se leen con la misma función que sus pantallas (`senalesDeLaPantalla`), con su frase y su nombre:
//      la Reunión no recalcula nada.
//   2. **Las reglas medibles** de la tabla de AG-70, en el mismo catálogo de umbrales que las señales:
//      «sin entrega» (lee la señal de Acquisition), la caída de la entrada, las citas sin registrar, la objeción
//      frecuente y las llamadas sin vínculo. Cada una con su piso; debajo, no hay tema.
//
// Cada tema lleva la **sección** de la que sale —para filtrar por persona al leer, AG-73— su etiqueta del juego
// cerrado, su origen en palabras, su gravedad, su pérdida si la hay, su texto de plantilla y su evidencia (ids y
// cifras). Sin llave, el orden es el de las reglas: gravedad y después pérdida (AG-72). **Corre dentro de
// `conOrganizacion(`.**
//
// ── LAS ETIQUETAS ───────────────────────────────────────────────────────────
//
// El juego cerrado de AG-70: CADENA, CONTRADICCIÓN, PATRÓN, SIN DATOS NUEVOS, SIN REGISTRAR y SIN LECTOR. Una
// señal de validación ejecutiva va como CADENA: todas tocan la cadena que va del anuncio a la cita (el reparto
// del gasto, el cambio de ruta). CONTRADICCIÓN queda para `REU-CONFLICTO`, que no se construye todavía.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../../datos/contexto.ts';
import { cadenaDeCierre } from '../../negocio/cadenaDeCierre.ts';
import { llamadasDeVenta } from '../../negocio/llamadasDeVenta.ts';
import { senalesDeLaPantalla, type SenalParaMostrar } from '../senales/lectura.ts';
import { GRAVEDADES, PISO_DE_UNA_SENAL, type DepartamentoConSenales, type Gravedad } from '../senales/tipos.ts';
import { textoDe as textoDeAcquisition } from '../plan/acquisition.ts';
import { textoDeCreative } from '../plan/creative.ts';
import { textoDeConversation } from '../plan/conversation.ts';
import { textoDeConversion } from '../plan/conversion.ts';

import { ETIQUETAS, REU, type Etiqueta } from './reglas.ts';

export { ETIQUETAS, REU, type Etiqueta };

export interface TemaDeLaReunion {
  /** Único dentro del día: la regla y su entidad. */
  clave: string;
  regla: string;
  etiqueta: Etiqueta;
  /** La clave de la sección de la que sale: quien no la ve no recibe el tema. */
  seccion: string;
  /** El origen en palabras, como lo dibuja la tarjeta: «Systems · Acquisition». */
  origen: string;
  gravedad: Gravedad;
  perdida: number | null;
  texto: string;
  evidencia: unknown;
}

/** La sección y el origen de cada departamento con detector. */
const DE_CADA_DEPARTAMENTO: Readonly<Record<DepartamentoConSenales, { seccion: string; origen: string; texto: (d: Parameters<typeof textoDeCreative>[0], v: '7d' | '30d') => string }>> = {
  acquisition: { seccion: 'acquisition', origen: 'Systems · Acquisition', texto: textoDeAcquisition },
  creative: { seccion: 'creative', origen: 'Marketing · Creative Insights', texto: (d) => textoDeCreative(d) },
  conversion: { seccion: 'conversion', origen: 'Systems · Conversion', texto: textoDeConversion },
  conversation: { seccion: 'conversation', origen: 'Systems · Conversation', texto: (d) => textoDeConversation(d) },
};

type Umbral = (codigo: string) => { valor: number; provisional: boolean };

const conNombre = (s: Pick<SenalParaMostrar, 'nombre' | 'texto'>) => (s.nombre ? `${s.nombre}: ${s.texto}` : s.texto);

/** Lo que miden las reglas, para que el orden y los textos se puedan probar sin base. */
export interface MedidaDeLaReunion {
  validacion: { departamento: DepartamentoConSenales; senal: Pick<SenalParaMostrar, 'id' | 'regla' | 'entidad' | 'nombre' | 'texto' | 'gravedad' | 'perdidaContactos'> }[];
  sinEntrega: Pick<SenalParaMostrar, 'id' | 'entidad' | 'nombre' | 'texto' | 'gravedad'>[];
  entrada: { semana: number; anterior: number };
  citas: { cerrables: number; citasCerrables: number; sinRegistrar: number };
  objeciones: { analizadas: number; antes: number | null; top: { categoria: string; ahora: number; antes: number | null; crece: boolean | null } | null };
  vinculo: { analizadas: number; sinVinculo: number };
}

/** Mide todo lo que la Reunión lee. **Dentro de `conOrganizacion(`.** */
export async function medirLaReunion(zona: string): Promise<MedidaDeLaReunion> {
  const validacion: MedidaDeLaReunion['validacion'] = [];
  for (const departamento of Object.keys(DE_CADA_DEPARTAMENTO) as DepartamentoConSenales[]) {
    // La de 30 días: la misma decisión aparece en las dos ventanas, y un tema por decisión basta.
    const lista = await senalesDeLaPantalla(departamento, '30d', DE_CADA_DEPARTAMENTO[departamento].texto);
    for (const senal of lista) if (senal.requiereValidacionEjecutiva && senal.estado !== 'sin_medicion') validacion.push({ departamento, senal });
  }
  // «Sin entrega» es un estado: la de 7 días, que es la que mira los últimos días cerrados.
  const sinEntrega = (await senalesDeLaPantalla('acquisition', '7d', textoDeAcquisition)).filter((s) => s.regla === 'ACQ-SIN-ENTREGA' && s.estado !== 'sin_medicion');

  // La entrada: los contactos de los últimos 7 días cerrados contra los 7 anteriores, en días de la empresa.
  const e = (
    await sql<{ semana: string; anterior: string }>`
      with hoy as (select (now() at time zone ${zona})::date as d)
      select count(*) filter (where (c.alta_en_el_crm at time zone ${zona})::date between hoy.d - 7 and hoy.d - 1)::text as semana,
             count(*) filter (where (c.alta_en_el_crm at time zone ${zona})::date between hoy.d - 14 and hoy.d - 8)::text as anterior
        from negocio.contactos c, hoy
       where c.alta_en_el_crm is not null`.execute(datos())
  ).rows[0]!;

  const cadena = await cadenaDeCierre(30);
  const cerrable = cadena.eslabones.find((x) => x.clave === 'cerrable');
  const conIntento = cadena.eslabones.find((x) => x.clave === 'con_intento');

  // 14 días: la clave sólo decide si hay ventana anterior (la hay); los días, la ventana.
  const catorce = await llamadasDeVenta({ clave: '7d', dias: 14 }, { conFrases: false });
  const treinta = await llamadasDeVenta({ clave: '30d', dias: 30 }, { conFrases: false });
  const top = catorce.objeciones.porCategoria[0];

  return {
    validacion,
    sinEntrega,
    entrada: { semana: Number(e.semana), anterior: Number(e.anterior) },
    citas: {
      cerrables: cerrable?.contactos ?? 0,
      citasCerrables: cerrable?.citas ?? 0,
      sinRegistrar: Math.max(0, (cerrable?.contactos ?? 0) - (conIntento?.contactos ?? 0)),
    },
    objeciones: {
      analizadas: catorce.llamadas.llamadas,
      antes: catorce.llamadasAntes,
      top: top && top.ahora > 0 ? { categoria: top.categoria, ahora: top.ahora, antes: top.antes, crece: top.crece } : null,
    },
    vinculo: { analizadas: treinta.llamadas.llamadas, sinVinculo: treinta.llamadas.sinVinculo },
  };
}

/** Los temas candidatos, ordenados por las reglas: gravedad y después pérdida. Pura. */
export function temasDeLaReunion(m: MedidaDeLaReunion, umbral: Umbral): TemaDeLaReunion[] {
  const temas: TemaDeLaReunion[] = [];

  for (const { departamento, senal } of m.validacion) {
    const de = DE_CADA_DEPARTAMENTO[departamento];
    temas.push({
      clave: `${senal.regla}:${senal.entidad.tipo}:${senal.entidad.id}`,
      regla: senal.regla,
      etiqueta: 'CADENA',
      seccion: de.seccion,
      origen: de.origen,
      gravedad: senal.gravedad,
      perdida: senal.perdidaContactos,
      // El texto de la señal habla de «la ventana», que en su pantalla se ve arriba; acá no, y se dice cuál.
      texto: `${conNombre(senal)} Sobre los últimos 30 días; requiere validación ejecutiva.`,
      evidencia: { senal: senal.id },
    });
  }

  if (m.sinEntrega.length >= umbral(REU.sinEntrega).valor) {
    const empresa = m.sinEntrega.find((s) => s.entidad.tipo === 'empresa');
    const campanas = m.sinEntrega.filter((s) => s.entidad.tipo === 'campana');
    temas.push({
      clave: REU.sinEntrega,
      regla: REU.sinEntrega,
      etiqueta: 'SIN DATOS NUEVOS',
      seccion: 'acquisition',
      origen: 'Systems · Acquisition',
      gravedad: empresa ? empresa.gravedad : 'alta',
      perdida: null,
      texto: empresa
        ? empresa.texto
        : `${campanas.length === 1 ? 'Una campaña activa dejó' : `${campanas.length} campañas activas dejaron`} de entregar mientras otras siguen: ${campanas.map((c) => c.nombre ?? c.entidad.id).join(', ')}.`,
      evidencia: { senales: m.sinEntrega.map((s) => s.id) },
    });
  }

  const { semana, anterior } = m.entrada;
  const uCaida = umbral(REU.caidaDeEntrada);
  if (anterior >= PISO_DE_UNA_SENAL && (anterior - semana) / anterior >= uCaida.valor) {
    temas.push({
      clave: REU.caidaDeEntrada,
      regla: REU.caidaDeEntrada,
      etiqueta: 'CADENA',
      seccion: 'acquisition',
      origen: 'Systems · Acquisition',
      gravedad: 'alta',
      perdida: anterior - semana,
      texto: `Entraron ${semana} contactos en los últimos 7 días cerrados, contra ${anterior} en los 7 anteriores.`,
      evidencia: { semana, anterior, umbral: uCaida },
    });
  }

  const { cerrables, citasCerrables, sinRegistrar } = m.citas;
  if (citasCerrables >= PISO_DE_UNA_SENAL && sinRegistrar >= umbral(REU.citasSinRegistrar).valor) {
    temas.push({
      clave: REU.citasSinRegistrar,
      regla: REU.citasSinRegistrar,
      etiqueta: 'SIN REGISTRAR',
      seccion: 'closer',
      origen: 'Sales · Closer',
      gravedad: 'media',
      perdida: null,
      texto: `${sinRegistrar} de ${cerrables} contactos tuvieron una cita que ya ocurrió y nadie registró si se presentaron.`,
      evidencia: { cerrables, citasCerrables, sinRegistrar },
    });
  }

  const o = m.objeciones;
  if (o.analizadas >= PISO_DE_UNA_SENAL && o.top && o.top.ahora >= umbral(REU.objecionFrecuente).valor) {
    const antes = o.top.antes === null ? '' : `, contra ${o.top.antes} antes`;
    temas.push({
      clave: REU.objecionFrecuente,
      regla: REU.objecionFrecuente,
      etiqueta: 'PATRÓN',
      seccion: 'analizadores',
      origen: 'Sales · Llamadas de venta',
      gravedad: 'media',
      perdida: null,
      // «Crece» sólo con piso (AG-F14-1); si no, el conteo.
      texto:
        o.top.crece === true
          ? `La objeción «${o.top.categoria}» crece: ${o.top.ahora} en 14 días${antes}.`
          : `La objeción más frecuente es «${o.top.categoria}»: ${o.top.ahora} en 14 días${antes}.`,
      evidencia: { analizadas: o.analizadas, ...o.top },
    });
  }

  const v = m.vinculo;
  if (v.analizadas >= PISO_DE_UNA_SENAL && v.sinVinculo / v.analizadas >= umbral(REU.llamadasSinVinculo).valor) {
    temas.push({
      clave: REU.llamadasSinVinculo,
      regla: REU.llamadasSinVinculo,
      etiqueta: 'SIN LECTOR',
      seccion: 'analizadores',
      origen: 'Sales · Llamadas de venta',
      gravedad: 'media',
      perdida: null,
      texto: `${v.sinVinculo} de ${v.analizadas} llamadas de venta analizadas en 30 días no se pueden vincular a un contacto: su análisis no se usa.`,
      evidencia: v,
    });
  }

  return temas.sort(
    (a, b) =>
      GRAVEDADES.indexOf(a.gravedad) - GRAVEDADES.indexOf(b.gravedad) ||
      (b.perdida ?? -1) - (a.perdida ?? -1) ||
      a.clave.localeCompare(b.clave),
  );
}

/** Los temas que ve una persona, y recién después los tres primeros (AG-73). Pura. */
export function temasParaUnaPersona<T extends Pick<TemaDeLaReunion, 'seccion'>>(temas: readonly T[], secciones: readonly string[], cuantos = 3): T[] {
  const visibles = new Set(secciones);
  return temas.filter((t) => visibles.has(t.seccion)).slice(0, cuantos);
}
