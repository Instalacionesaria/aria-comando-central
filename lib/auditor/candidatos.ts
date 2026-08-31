// LOS CANDIDATOS: la consulta que arma la fila que los portones deciden. Y LA CORRIDA EN SECO.
//
// ═══════════════════════════════════════════════════════════════════════════════
// UNA SOLA CONSULTA, Y CERO LLAMADAS AL CRM
//
// Todo lo que los portones necesitan sale de nuestra propia base: el territorio y las etiquetas de la
// fila del contacto, un `exists` sobre los avisos abiertos, y dos cuentas de mensajes. No hay un
// segundo viaje por contacto y no hay ninguna llamada al proveedor.
//
// Y los dos portones baratos van **en el `where` de SQL**, no en el bucle de TypeScript. Traer los 322
// contactos para descartar 280 en memoria funcionaría igual y haría cuatro cosas peor: más filas por
// la red, más subconsultas evaluadas —las cuentas de mensajes se calculan por fila que sobrevive al
// `where`—, y una corrida en seco cuyo renglón más frecuente sería «este contacto no tiene territorio»
// repetido doscientas veces, que es ruido que tapa lo que importa.
//
// El resto de los portones se decide en `decidirSiAuditar`, en código, **a propósito**: la resta del
// antirrebote y las cuatro señales del nivel 0 tienen que ser probables sin una base al lado, y son
// justamente las que más se van a ajustar.
//
// ── LA CORRIDA EN SECO ES LA HERRAMIENTA DE ESTA ETAPA ──────────────────────
//
// Recorre el camino de decisión completo —empresa, candidatos, portones, resta, señales— y **se
// detiene justo antes de llamar al modelo**, diciendo qué haría y por qué. Es lo que permite verificar
// contra datos reales de producción **sin gastar un centavo y sin escribir una fila**.
//
// No es un lujo: el módulo entero es un gasto proporcional a cuántos contactos pasan los portones, y
// no hay otra forma honesta de saber ese número antes de encenderlo.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { ETIQUETAS_DEL_AGENTE } from '../ghl/contrato.ts';
import {
  TEXTO_DEL_PORTON,
  decidirSiAuditar,
  porQueNoSeAuditaLaEmpresa,
  type CandidatoAAuditar,
  type Decision,
  type EmpresaParaAuditar,
  type MotivoDeLaEmpresa,
} from './portones.ts';
import type { Agente } from './veredicto.ts';

/**
 * Las etiquetas que dicen que un agente ESTÁ ATENDIENDO. Derivadas del contrato, no escritas a mano.
 *
 * Es el filtro grueso de SQL: trae los contactos que tienen alguna de éstas y deja que el portón 2
 * decida si es la del territorio correcto. Escribir la lista acá a mano sería la segunda lista del
 * mismo hecho — y cuando divergiera, el síntoma sería que los contactos de una etiqueta **dejan de
 * auditarse en silencio**, porque el filtro de SQL los descarta antes de que ningún portón los vea.
 */
export const ETIQUETAS_QUE_ATIENDEN: readonly string[] = ETIQUETAS_DEL_AGENTE.filter((e) =>
  e.estado.startsWith('atendiendo'),
).map((e) => e.etiqueta);

/**
 * El tope de candidatos por corrida y por empresa.
 *
 * ── POR QUÉ HAY UN TOPE, Y POR QUÉ SE DICE CUANDO SE ALCANZA ────────────────
 *
 * La primera corrida de una empresa que nunca se auditó tiene la línea base en `null` para todos, así
 * que **la resta es el total** y pasan todos los que tengan cinco mensajes del agente. Medido en
 * producción: 65 contactos con etiqueta de agente activo. Sin tope, esa primera corrida son 65
 * inferencias de golpe.
 *
 * El tope no pierde nada: el barrido es reconciliación, así que lo que no entró en esta corrida entra
 * en la siguiente —y la siguiente es en diez minutos—. Lo que sí hay que hacer es **decirlo**: un tope
 * silencioso hace que «se auditaron 20» se lea como «había 20».
 */
export const TOPE_DE_CANDIDATOS = 20;

/** Un candidato con su decisión ya tomada, más lo que la corrida en seco necesita mostrar. */
export interface CandidatoDecidido {
  candidato: CandidatoAAuditar;
  decision: Decision;
  /** El nombre, solo para el reporte. **No se usa para decidir nada.** */
  nombre: string;
}

/**
 * Los candidatos de la empresa en la que se está, ya decididos.
 *
 * Corre **dentro** de un contexto de organización: el aislamiento lo pone la política de la base.
 *
 * @param ahora El instante de referencia. Inyectable por el umbral de silencio del nivel 0.
 */
export async function candidatosDecididos(ahora: Date): Promise<{
  decididos: readonly CandidatoDecidido[];
  /** `true` = se alcanzó el tope y quedaron candidatos sin mirar. Ver `TOPE_DE_CANDIDATOS`. */
  hayMas: boolean;
}> {
  const filas = await datos()
    .selectFrom('contactos as c')
    .select((eb) => [
      'c.id',
      'c.nombre',
      'c.territorio',
      'c.etiquetas',
      'c.ultimo_entrante_el',
      'c.ultimo_saliente_el',
      'c.ultimo_entrante_texto',

      /* Los mensajes del agente que hay AHORA. `autor = 'agente'` es una columna, así que esto es un
         conteo y no una atribución — y ahí está su límite, dicho en el encabezado de `portones.ts`:
         adentro hay automatizaciones del CRM. El portón 5 es el que cuenta de verdad. */
      eb
        .selectFrom('mensajes')
        .whereRef('mensajes.contacto_id', '=', 'c.id')
        .where('mensajes.autor', '=', 'agente')
        .select(({ fn }) => fn.countAll<string>().as('n'))
        .as('mensajes_del_agente'),

      /* La línea base: los que había en el ÚLTIMO análisis. `null` cuando nunca se analizó, y esa
         diferencia se conserva hasta arriba — ver `mensajesDelAgenteEnElUltimoAnalisis`. */
      eb
        .selectFrom('analisis_del_agente')
        .whereRef('analisis_del_agente.contacto_id', '=', 'c.id')
        .select('analisis_del_agente.mensajes_del_agente')
        .orderBy('analisis_del_agente.analizado_el', 'desc')
        .limit(1)
        .as('mensajes_en_el_ultimo_analisis'),

      // El portón 3, como `exists`: la pregunta es sí o no, no cuántos.
      eb
        .exists(
          eb
            .selectFrom('hallazgos')
            .whereRef('hallazgos.contacto_id', '=', 'c.id')
            .where('hallazgos.resuelto_el', 'is', null)
            .select(sql`1`.as('x')),
        )
        .as('tiene_aviso_abierto'),
    ])
    /* Los dos portones baratos, en SQL. Ver el encabezado: hacerlos en memoria funcionaría igual y
       llenaría la corrida en seco de ruido. */
    .where('c.territorio', 'is not', null)
    .where(sql<boolean>`c.etiquetas && ${sql.val(ETIQUETAS_QUE_ATIENDEN)}::text[]`)
    /* El orden decide a quién le toca cuando el tope corta, y **el más viejo primero** es lo que hace
       que el corte se recupere solo: sin orden, la misma empresa podría auditar siempre a los mismos
       veinte y nunca llegar a los demás. Los que nunca se analizaron van antes que todos. */
    .orderBy(
      sql`(select max(a.analizado_el) from negocio.analisis_del_agente a
             where a.org_id = c.org_id and a.contacto_id = c.id) asc nulls first`,
    )
    // Uno más que el tope: es lo que permite afirmar `hayMas` sin una segunda consulta de conteo.
    .limit(TOPE_DE_CANDIDATOS + 1)
    .execute();

  const hayMas = filas.length > TOPE_DE_CANDIDATOS;
  const decididos = filas.slice(0, TOPE_DE_CANDIDATOS).map((f) => {
    const candidato: CandidatoAAuditar = {
      contactoId: f.id,
      territorio: f.territorio,
      etiquetas: f.etiquetas,
      /* `Boolean(...)` y no el valor crudo: un `exists` de Kysely llega tipado como `boolean |
         number`, y el mismo `Boolean(` está en `lib/negocio/fila.ts` por lo mismo. Un `1` en un campo
         declarado booleano es verdadero en JavaScript, así que sin esto **funcionaría igual** —y el día
         que alguien compare con `=== true`, el portón 3 se apagaría entero y en silencio. */
      tieneAvisoAbierto: Boolean(f.tiene_aviso_abierto),
      /* `count(*)` viaja como TEXTO en `pg` —es un `bigint`—, así que sin el `Number` la resta sería
         una concatenación de cadenas: `'12' - 5` da 7 por coerción, pero `'12' - null` da 12 y
         `'12' + 1` daría `'121'`. Se convierte una vez, acá. */
      mensajesDelAgente: Number(f.mensajes_del_agente),
      mensajesDelAgenteEnElUltimoAnalisis: f.mensajes_en_el_ultimo_analisis,
      ultimoEntranteEl: f.ultimo_entrante_el,
      ultimoSalienteEl: f.ultimo_saliente_el,
      ultimoEntranteTexto: f.ultimo_entrante_texto,
    };
    return { candidato, nombre: f.nombre, decision: decidirSiAuditar(candidato, ahora) };
  });

  return { decididos, hayMas };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LA CORRIDA EN SECO
// ═══════════════════════════════════════════════════════════════════════════════

/** Un renglón del reporte: un contacto y qué se haría con él. */
export interface RenglonEnSeco {
  contactoId: string;
  nombre: string;
  /** `null` cuando no se auditaría. */
  agente: Agente | null;
  /** `'—'` cuando no se auditaría. */
  disparo: string;
  /** La frase del portón que lo frenó, o por qué se auditaría. **Siempre dice algo.** */
  porque: string;
  delta: number | null;
  alarmas: readonly string[] | null;
}

export interface CorridaEnSeco {
  /** `null` = la empresa se audita. Con valor, no se miró ni un contacto. */
  frenoDeLaEmpresa: MotivoDeLaEmpresa | null;
  /** Cuántos contactos pasaron el filtro grueso de SQL. */
  candidatos: number;
  /** Cuántos se auditarían. **Es el número que decide si esto se puede encender.** */
  seAuditarian: number;
  /** `true` = el tope cortó y quedaron candidatos sin mirar. */
  hayMas: boolean;
  /** Cuántos frenó cada portón. Es lo que dice si un portón está haciendo algo o no. */
  porPorton: Readonly<Record<string, number>>;
  renglones: readonly RenglonEnSeco[];
}

/**
 * Recorre todo el camino de decisión y **no llama al modelo ni escribe una fila**.
 *
 * ── POR QUÉ DEVUELVE TAMBIÉN EL CONTEO POR PORTÓN ──────────────────────────
 *
 * Porque es la única forma de ver que un portón **no está haciendo nada**. Un portón que frena cero
 * contactos puede ser correcto —nadie está en ese estado— o puede estar apagado por un error, y las
 * dos cosas se ven idénticas mirando el resultado. Con el conteo al lado, la diferencia se nota:
 * `ya_marcado: 0` con avisos abiertos en la base es un defecto.
 *
 * Corre **dentro** de un contexto de organización.
 */
export async function corridaEnSeco(
  empresa: EmpresaParaAuditar,
  ahora: Date,
): Promise<CorridaEnSeco> {
  const freno = porQueNoSeAuditaLaEmpresa(empresa);
  if (freno !== null) {
    /* Se corta ANTES de consultar. No es una optimización: consultar y después descartar produciría
       un reporte con veinte renglones y un freno arriba, y quien lo lea va a discutir los renglones.
       Cuando la empresa no se audita, el único hecho es el freno. */
    return {
      frenoDeLaEmpresa: freno,
      candidatos: 0,
      seAuditarian: 0,
      hayMas: false,
      porPorton: {},
      renglones: [],
    };
  }

  const { decididos, hayMas } = await candidatosDecididos(ahora);

  const porPorton: Record<string, number> = {};
  const renglones: RenglonEnSeco[] = decididos.map(({ candidato, nombre, decision }) => {
    if (decision.audita) {
      return {
        contactoId: candidato.contactoId,
        nombre,
        agente: decision.agente,
        disparo: decision.disparo,
        porque:
          decision.disparo === 'debounce'
            ? `${decision.delta} mensajes nuevos del agente`
            : `señal: ${(decision.alarmas ?? []).join(', ')}`,
        delta: decision.delta,
        alarmas: decision.alarmas,
      };
    }
    porPorton[decision.porton] = (porPorton[decision.porton] ?? 0) + 1;
    return {
      contactoId: candidato.contactoId,
      nombre,
      agente: null,
      disparo: '—',
      /* La frase del portón, y el detalle cuando lo hay. Nunca solo el código: una corrida en seco que
         nadie entiende no se lee, y una que no se lee no verifica nada. */
      porque:
        decision.detalle === undefined
          ? TEXTO_DEL_PORTON[decision.porton]
          : `${TEXTO_DEL_PORTON[decision.porton]} (${decision.detalle})`,
      delta: null,
      alarmas: null,
    };
  });

  return {
    frenoDeLaEmpresa: null,
    candidatos: decididos.length,
    seAuditarian: renglones.filter((r) => r.agente !== null).length,
    hayMas,
    porPorton,
    renglones,
  };
}
