// El barrido de todas las empresas. Lo llama una tarea programada, no una persona.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTE ARCHIVO CIERRA, Y ES EL ÚLTIMO HUECO GRANDE DEL BLOQUE
//
// Hasta acá, la ingesta de mensajes y el barrido de citas **solo corrían mientras alguien tenía la
// pestaña del Closer abierta**: el reloj del navegador cada 10 segundos era el único disparador. Eso
// significa que un fin de semana sin nadie trabajando es un fin de semana sin mensajes nuevos, y que
// el primero que entra el lunes espera veintitrés corridas para ponerse al día.
//
// ── LAS CUATRO COSAS QUE LA PLATAFORMA GARANTIZA, Y LAS CUATRO CAMBIAN EL DISEÑO ──
//
// Medido en la documentación oficial de Vercel, no supuesto:
//
//   1 · El disparo es un **GET**, y no se puede elegir. El tipo del cron tiene exactamente dos
//       campos, `path` y `schedule`. Ver el encabezado de `app/api/cron/route.ts`.
//   2 · **No hay reintentos.** Ante ningún fallo, nunca.
//   3 · Se admiten corridas **perdidas** y corridas **duplicadas**. O sea que no se puede contar con
//       «esto corre exactamente una vez cada N minutos».
//   4 · El horario se interpreta **siempre en UTC**.
//
// De (2) y (3) sale la propiedad que gobierna todo este archivo: **es reconciliación, no una cola**.
// Nada se acumula, nada se incrementa, y el orden de trabajo se decide cada vez por el sello más
// viejo — así una corrida perdida se arregla sola en la siguiente, sin que nadie lleve la cuenta.
//
// De (4) sale que el horario se escriba en UTC con la hora local al lado, y que no haga falta más
// que eso: **ninguna de las dos tareas depende de un día calendario local**. La ventana de citas es
// relativa a ahora (−14/+45 días) y la ingesta camina por marca de agua. Correr a las 03:00 de Lima
// en vez de a las 08:00 no cambia ni una fila: cambia la frescura.
// ═══════════════════════════════════════════════════════════════════════════════

import { datos, conOrganizacion } from '../datos/contexto.ts';
import type { OrganizacionListada } from '../administracion/organizaciones.ts';
import type { AccesoAGhl } from '../credenciales/resolver.ts';
import { ingerirMensajes } from './ingesta.ts';
import { barrerCitas } from './citas.ts';
import { sondaDeAislamiento } from '../deteccion/sonda.ts';

/** Las tareas que el cron sabe hacer. Es la misma lista que el `check` de la migración 014. */
export type Tarea = 'sonda' | 'mensajes' | 'citas';

/** En qué estado quedó un par (empresa, tarea). Tres de los cinco son NORMALES. */
export type EstadoDeTarea = 'corrio' | 'saltada' | 'frenada' | 'sin_tiempo' | 'fallo';

/**
 * Qué hace cada horario, indexado por **la cadena literal del horario**.
 *
 * ── POR QUÉ INDEXADO POR LA CADENA, Y NO UNA LISTA ──────────────────────────
 *
 * Porque es lo que hace que la prueba sea total en las dos direcciones: cada horario de `vercel.json`
 * tiene que tener entrada acá, **y** cada entrada de acá tiene que estar en `vercel.json`. Con una
 * lista, cambiar `0 12 * * *` por `0 6 * * *` en la configuración y no tocar este archivo no rompería
 * nada — y el síntoma sería que el cron dispara y no hace ninguna tarea, en silencio.
 *
 * ── EL UMBRAL, Y LA CUENTA QUE HAY DETRÁS ───────────────────────────────────
 *
 * `umbralMinutos` es a partir de cuándo el sello se considera atrasado, y la regla es
 * **`umbral >= 2 × cadencia + 60`**:
 *
 *   · el `2 ×` es para que **perder una corrida no grite**. No hay reintentos (hecho 2), así que
 *     perder una es normal; perder dos seguidas ya no lo es.
 *   · el `+60` es la imprecisión del plan Hobby, donde el disparo cae en cualquier momento de la
 *     hora indicada: ±59 minutos.
 *
 * Un umbral igual a la cadencia haría que la pantalla avisara de un atraso todos los días.
 */
export const HORARIOS = {
  // 12:00 UTC = 07:00 en `America/Lima`, antes de que el equipo empiece.
  //
  // ── UNA SOLA ENTRADA, Y DIARIA, Y NO ES LO QUE QUISIÉRAMOS ────────────────
  //
  // Es el único horario que funciona en los DOS planes de Vercel, y eso es una decisión con costo
  // que conviene decir entera: **en Hobby, un horario más frecuente que un día no se ignora ni se
  // ajusta — hace fallar el despliegue entero**, con un mensaje sobre cuentas Hobby. En Pro andaría
  // `*/10 * * * *`.
  //
  // El plan de este proyecto no se pudo medir: el token disponible lee los proyectos pero no la
  // facturación del equipo (403), y el panel de Vercel no expone el plan por API. Así que se eligió
  // el horario que es correcto en los dos, porque los dos errores no cuestan lo mismo: con el diario
  // en Pro la agenda se refresca menos seguido, y con `*/10` en Hobby **no se puede desplegar**.
  //
  // Para pasar a Pro: cambiar esta entrada y la de `vercel.json` por las dos comentadas abajo. Son
  // dos renglones y la prueba de `pruebas/codigo/99-cron.test.ts` verifica que se muevan juntos.
  //
  //   '*/10 * * * *': { tareas: ['mensajes'], cadenciaMinutos: 10, umbralMinutos: 80 },
  //   '3 * * * *':    { tareas: ['citas', 'sonda'], cadenciaMinutos: 60, umbralMinutos: 180 },
  '0 12 * * *': {
    tareas: ['sonda', 'mensajes', 'citas'],
    cadenciaMinutos: 1440,
    umbralMinutos: 2940,
  },
} as const satisfies Record<string, { tareas: readonly Tarea[]; cadenciaMinutos: number; umbralMinutos: number }>;

/**
 * El presupuesto de una corrida, en milisegundos.
 *
 * ── ES UN GUARDIA PARCIAL, Y HAY QUE DECIRLO ────────────────────────────────
 *
 * Se comprueba **antes de empezar cada empresa**, así que acota el caso de muchas empresas lentas.
 * Lo que NO acota es una sola llamada colgada: `pedirExterno` espera hasta 240 s por una, contra un
 * `maxDuration` de 300, y en ese caso este guardia no llega a ejecutarse nunca — Vercel termina la
 * función y no reintenta.
 *
 * Lo que hace eso tolerable no es este número, es todo lo demás: el orden por sello más viejo hace
 * que la corrida siguiente empiece justo por lo que quedó sin hacer, todo el trabajo es idempotente,
 * y el sello deja anotado hasta dónde se llegó. Una espera externa más corta para el camino del cron
 * es la mitigación de fondo y no está hecha: obligaría a pasar un presupuesto por llamada a través
 * de `ingerirMensajes` y `barrerCitas` hasta `pedirExterno`.
 */
const PRESUPUESTO_MS = 180_000;

/** Qué pasó con un par (empresa, tarea). Es la unidad del reporte. */
export interface RenglonDelBarrido {
  slug: string;
  tarea: Tarea;
  estado: EstadoDeTarea;
  /** Por qué, cuando el estado no es `corrio`. Nunca se colapsan dos motivos distintos. */
  porque?: string;
  llamadas?: number;
  /** El resumen que devolvió la tarea, cuando corrió. */
  resumen?: unknown;
}

export interface ResultadoDelBarridoCompleto {
  horario: string | null;
  /** `true` = el horario que disparó no está en `HORARIOS`. Se corrieron TODAS las tareas. */
  horarioDesconocido?: true;
  tareas: readonly Tarea[];
  sonda: { estado: 'corrio' | 'fallo' | 'no_tocaba'; revisadas?: number; porque?: string };
  renglones: RenglonDelBarrido[];
  /**
   * Cuántos pares (empresa, tarea) **de verdad corrieron**.
   *
   * No las recorridas. Es el falso verde que la sonda ya pagó una vez: contar lo que se intentó hace
   * que una corrida donde ninguna empresa tenía credencial se lea como una corrida exitosa.
   */
  corrieron: number;
}

/** Lo que el manejador resuelve antes de entrar: la empresa y su acceso al CRM, ya descifrado. */
export interface EmpresaParaBarrer {
  org: OrganizacionListada;
  acceso: AccesoAGhl;
}

/**
 * Qué tareas corresponden a un horario. **Un horario desconocido corre TODAS.**
 *
 * Nunca «no hacer nada»: un horario que no está en el mapa es un error de configuración, y no hacer
 * nada lo convertiría en un cron que dispara, responde 200 y no trabaja — indistinguible de un cron
 * que funciona. Correr todo es más caro y es lo honesto: el trabajo se hace y la respuesta avisa.
 */
export function tareasDelHorario(horario: string | null): {
  tareas: readonly Tarea[];
  desconocido: boolean;
} {
  const entrada = horario === null ? undefined : (HORARIOS as Record<string, { tareas: readonly Tarea[] }>)[horario];
  if (!entrada) return { tareas: ['sonda', 'mensajes', 'citas'], desconocido: true };
  return { tareas: entrada.tareas, desconocido: false };
}

/**
 * El barrido completo. **Corre FUERA de cualquier contexto de organización**: lo abre por empresa.
 *
 * @param empresas Ya resueltas por el manejador, con su acceso al CRM. Se reciben resueltas para que
 *   este archivo no necesite `conIdentidad(` — las credenciales viven en identidad y el bucle vive
 *   acá, y separarlos es lo que mantiene la lista de excepciones de `pruebas/apoyo/autorizados.ts`
 *   en el manejador, donde se lee.
 * @param ahora Inyectable **para poder probar el presupuesto**. Sin la costura, comprobar que las
 *   empresas restantes salen como `sin_tiempo` exigiría una prueba de tres minutos.
 */
export async function barrerTodo(
  horario: string | null,
  empresas: readonly EmpresaParaBarrer[],
  ahora: () => number = Date.now,
): Promise<ResultadoDelBarridoCompleto> {
  const { tareas, desconocido } = tareasDelHorario(horario);
  const arranque = ahora();
  const renglones: RenglonDelBarrido[] = [];

  // ── LA SONDA VA PRIMERO, Y ES DELIBERADO ──────────────────────────────────
  //
  // Lo que va último es lo que se sacrifica cuando se agota el tiempo, y la sonda es lo único que
  // detecta una fuga de aislamiento en producción **y** lo único que cuesta cero llamadas al
  // proveedor. Ponerla al final sería gastar el presupuesto en refrescar una agenda y quedarse sin
  // tiempo para la única señal de seguridad del sistema.
  //
  // Y va en su propio try/catch: sin canal de avisos configurado, `avisar()` LANZA a propósito, y
  // una excepción del canal de avisos no puede tumbar el barrido de las empresas.
  let sonda: ResultadoDelBarridoCompleto['sonda'] = { estado: 'no_tocaba' };
  if (tareas.includes('sonda')) {
    try {
      const r = await sondaDeAislamiento();
      sonda = { estado: 'corrio', revisadas: r.revisadas };
    } catch (e) {
      console.error('cron: la sonda de aislamiento falló', e);
      sonda = { estado: 'fallo', porque: 'la sonda no pudo completarse' };
    }
  }

  // ── EL ORDEN: EL SELLO MÁS VIEJO PRIMERO, Y LOS QUE NO TIENEN, ANTES ──────
  //
  // Es lo que convierte una corrida perdida en un problema que se arregla solo. Ordenar por nombre
  // haría que la última empresa de la lista fuera siempre la que se queda sin tiempo — para siempre,
  // y sin que nada lo dijera.
  const conSello = await Promise.all(
    empresas.map(async (e) => ({ ...e, sello: await selloMasViejo(e.org.id, tareas) })),
  );
  conSello.sort((a, b) => {
    if (a.sello === null && b.sello === null) return 0;
    if (a.sello === null) return -1; // sin sello = nunca se barrió = primero
    if (b.sello === null) return 1;
    return a.sello - b.sello;
  });

  for (const { org, acceso } of conSello) {
    // El guardia del presupuesto, antes de empezar la empresa. Ver `PRESUPUESTO_MS`.
    if (ahora() - arranque > PRESUPUESTO_MS) {
      for (const tarea of tareas) {
        if (tarea === 'sonda') continue;
        renglones.push({ slug: org.slug, tarea, estado: 'sin_tiempo' });
        await sellar(org.id, tarea, 'sin_tiempo', 'se agotó el presupuesto de la corrida', null);
      }
      continue;
    }

    for (const tarea of tareas) {
      if (tarea === 'sonda') continue; // no es por empresa

      // ── LA CREDENCIAL AUSENTE NO ES UN FALLO, Y SU MOTIVO NO SE COLAPSA ───
      //
      // Una empresa sin token cargado es el caso NORMAL de una empresa recién creada. Y las cinco
      // faltas se distinguen porque significan cosas distintas: `token_ilegible` en todas las
      // empresas a la vez significa que cambió la clave maestra del servidor, no que todos los
      // clientes desconectaron su CRM el mismo día.
      if (acceso.tipo !== 'listo') {
        renglones.push({ slug: org.slug, tarea, estado: 'saltada', porque: acceso.que, llamadas: 0 });
        await sellar(org.id, tarea, 'saltada', acceso.que, 0);
        continue;
      }

      // ── TRY/CATCH POR VUELTA, Y ES OBLIGATORIO ───────────────────────────
      //
      // `conElPulso` anota el fallo en la fila del pulso y **lo relanza**. Sin este try/catch, la
      // empresa que falla se lleva puestas a todas las que venían después — y el reporte no las
      // menciona, así que la lista queda corta y se ve completa.
      try {
        const r =
          tarea === 'mensajes'
            ? await ingerirMensajes(org.id, acceso)
            : await barrerCitas(org.id, acceso);

        if (r.corrio === false) {
          // El antirrebote o el candado. **No es un error**, y tratarlo como uno convertiría el
          // candado en un generador de tráfico: reintentar lo que frenó a propósito.
          renglones.push({ slug: org.slug, tarea, estado: 'frenada', porque: r.porque, llamadas: 0 });
          await sellar(org.id, tarea, 'frenada', r.porque, 0);
          continue;
        }
        renglones.push({
          slug: org.slug,
          tarea,
          estado: 'corrio',
          llamadas: r.llamadas,
          resumen: r.resultado,
        });
        await sellar(org.id, tarea, 'corrio', null, r.llamadas);
      } catch (e) {
        // El mensaje de la excepción va al REGISTRO y no al cuerpo (`ADR-0704`): puede llevar
        // nombres de tabla o fragmentos de consulta.
        console.error(`cron: falló ${tarea} de ${org.slug}`, e);
        renglones.push({
          slug: org.slug,
          tarea,
          estado: 'fallo',
          porque: 'la tarea no pudo completarse',
        });
        await sellar(org.id, tarea, 'fallo', 'la tarea no pudo completarse', null);
      }
    }
  }

  /* ── LA SONDA NO DEJA SELLO, Y ES UNA DECISIÓN ────────────────────────────
   *
   * Las otras dos tareas sí, porque su pregunta es «¿está esta empresa al día?». La sonda no es de
   * ninguna empresa: es del sistema. Sellarla bajo las organizaciones de control —que existen y
   * tienen identificador— sería posible y diría algo falso: que la sonda es una tarea de esas dos
   * empresas de infraestructura.
   *
   * Lo que la cubre es distinto y ya existe: su resultado va en esta respuesta, y **cuando encuentra
   * una fuga avisa por su propio canal**, con deduplicación. O sea que la sonda tiene la única
   * alerta activa del sistema, y no la necesita de acá.
   */
  return {
    horario,
    ...(desconocido ? { horarioDesconocido: true as const } : {}),
    tareas,
    sonda,
    renglones,
    // Los que DE VERDAD corrieron. Ver el comentario del campo.
    corrieron: renglones.filter((r) => r.estado === 'corrio').length,
  };
}

/**
 * El sello más viejo de las tareas que toca hacer, en milisegundos. `null` = alguna nunca corrió.
 *
 * Se mira solo las tareas del horario: si el horario de hoy es solo `mensajes`, un sello viejo de
 * `citas` no tiene por qué adelantar a esta empresa en la fila.
 */
async function selloMasViejo(orgId: string, tareas: readonly Tarea[]): Promise<number | null> {
  const delTrabajo = tareas.filter((t) => t !== 'sonda');
  if (delTrabajo.length === 0) return null;

  return conOrganizacion(orgId, async () => {
    const filas = await datos()
      .selectFrom('tareas_programadas')
      .select(['tarea', 'ultima_corrida_el'])
      .where('tarea', 'in', delTrabajo)
      .execute();

    // Falta alguna → nunca se barrió esa tarea acá, y eso va primero.
    if (filas.length < delTrabajo.length) return null;
    return Math.min(...filas.map((f) => f.ultima_corrida_el.getTime()));
  });
}

/**
 * El sello, y **se escribe SIEMPRE**, también cuando la tarea no corrió.
 *
 * Ésa es toda la razón de ser de la tabla: la diferencia entre «el cron pasó por acá y esta empresa
 * no tiene token» y «el cron no pasó nunca». Sin la fila de `saltada`, las dos se ven igual — un
 * cero, sin nada que diga si está medido.
 *
 * `on conflict do update`, nunca un incremento: la plataforma admite corridas duplicadas, y un `+1`
 * contaría de más con una entrega doble y de menos con una perdida, sin forma de saber cuál pasó.
 */
async function sellar(
  orgId: string,
  tarea: Tarea,
  estado: EstadoDeTarea,
  motivo: string | null,
  llamadas: number | null,
): Promise<void> {
  try {
    await conOrganizacion(orgId, async () => {
      await datos()
        .insertInto('tareas_programadas')
        .values({
          tarea,
          ultima_corrida_el: new Date(),
          ultimo_estado: estado,
          ultimo_motivo: motivo,
          ultimas_llamadas: llamadas,
        } as never)
        .onConflict((oc) =>
          oc.columns(['org_id', 'tarea']).doUpdateSet({
            ultima_corrida_el: new Date(),
            ultimo_estado: estado,
            ultimo_motivo: motivo,
            ultimas_llamadas: llamadas,
          } as never),
        )
        .execute();
    });
  } catch (e) {
    // El sello es contabilidad: si falla, el trabajo YA SE HIZO y no se deshace. Se grita y se
    // sigue. Lanzar acá convertiría un problema de auditoría en la pérdida del barrido de las
    // empresas que venían después.
    console.error(`cron: no se pudo sellar ${tarea} de la organización`, e);
  }
}
