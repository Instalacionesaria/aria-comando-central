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
import type { AccesoAGhl, AccesoAlAuditor } from '../credenciales/resolver.ts';
import { TEXTO_DE_FALTA_AUDITOR } from '../credenciales/resolver.ts';
import { auditarEmpresa } from '../auditor/analisis.ts';
import { buscarUnaMejora } from '../auditor/buscarMejora.ts';
import { ingerirMensajes } from './ingesta.ts';
import { sincronizarContactos } from './sincronizar.ts';
import { barrerCitas } from './citas.ts';
import { sondaDeAislamiento } from '../deteccion/sonda.ts';

/**
 * Las tareas que el cron sabe hacer. Es la misma lista que el `check` de `tareas_programadas`,
 * ampliada en la **021** con `contactos` y en la **030** con `auditoria`.
 *
 * ── `auditoria` ES LA PRIMERA QUE NO LE HABLA AL CRM ──────────────────────
 *
 * Las otras cuatro cuentan peticiones a GoHighLevel. Ésta cuenta **inferencias pagadas al proveedor
 * del modelo**, que es otra unidad y mucho más cara: una petición al CRM cuesta una fracción de
 * centavo y una inferencia cuesta centavos. Van en la misma columna porque la pregunta es la misma
 * —«cuánto costó esta corrida»— y conviene saberlo antes de sumar las cinco.
 */
export type Tarea = 'sonda' | 'contactos' | 'mensajes' | 'citas' | 'auditoria' | 'mejora';

/**
 * Las cinco, **en el orden en que hay que correrlas**. La única lista en tiempo de ejecución.
 *
 * ── POR QUÉ EXISTE, Y QUÉ DEJÓ DE ESTAR ESCRITO TRES VECES ────────────────
 *
 * El tipo `Tarea` es de compilación, así que hasta acá «las tareas que existen» estaba escrita a mano
 * en tres lugares: el respaldo de `tareasDelHorario`, y dos pruebas de `99-cron.test.ts`. Agregar la
 * quinta puso las tres en rojo a la vez, y ahí se ve el problema: **arreglarlas es escribir el mismo
 * nombre tres veces**, y la que se olvide no falla igual.
 *
 * La del respaldo es la peor de las tres, porque su modo de fallo es silencioso: un horario
 * desconocido correría cuatro de las cinco tareas y la respuesta diría que corrió «todas».
 *
 * El ORDEN es el mismo que exigen los horarios y por los mismos motivos: `contactos` antes de
 * `mensajes` —o los mensajes de un contacto nuevo quedan bajo la marca de agua para siempre— y
 * `auditoria` después de `mensajes`, o el antirrebote cuenta los mensajes de la corrida anterior.
 */
export const TAREAS = ['sonda', 'contactos', 'mensajes', 'auditoria', 'citas', 'mejora'] as const satisfies
  readonly Tarea[];

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
  /* ═════════════════════════════════════════════════════════════════════════════
     DOS HORARIOS, Y EL PLAN DEJÓ DE SER UNA INCÓGNITA

     Hasta acá había **una sola entrada, diaria**, con este motivo escrito: *«es el único horario que
     funciona en los DOS planes de Vercel — en Hobby, un horario más frecuente que un día no se ignora
     ni se ajusta: hace fallar el despliegue entero»*. Y ese comentario también decía que el plan **no
     se pudo medir**: el token lee los proyectos pero da 403 sobre la facturación, y la API no lo expone.
     Se eligió el horario correcto en los dos porque los dos errores no cuestan lo mismo.

     **Confirmado el 2026-08-28: el plan es Pro.** Así que se toma la decisión que estaba esperando ese
     dato, y lo que compra es lo más grande de todo el trabajo de consumo:

       · antes, fuera del horario en que alguien tenía el Closer abierto, un mensaje entrante esperaba
         **hasta 24 horas**;
       · ahora espera **como máximo 10 minutos**, sin una línea de código nuevo, sin ruta pública y sin
         una superficie de ataque nueva.

     ── Y `contactos` VA CON `mensajes`, QUE ES LO QUE EL COMENTARIO VIEJO NO PODÍA SABER ──

     Los dos renglones que este archivo dejaba preparados decían `['mensajes']` y `['citas','sonda']`.
     Se escribieron ANTES de la migración 021, o sea antes de que existiera la tarea `contactos` — y
     descomentarlos tal cual la **apaga**, reabriendo una pérdida de datos permanente.

     El motivo es el orden: la ingesta descarta toda conversación cuyo contacto no esté en
     `negocio.contactos` y **avanza la marca de agua sobre ella**. Si `contactos` corriera cada hora y
     `mensajes` cada diez minutos, un contacto nuevo pasaría hasta cinco ciclos siendo desconocido, y en
     cada uno la marca se le adelantaría un poco más. Cuando por fin se sincroniza, **sus mensajes
     quedaron por debajo de la marca y no se recuperan nunca**.

     Así que las dos van juntas, en el mismo horario y en este orden. La garantía no es de la base —un
     `check` no ordena tareas— sino del bucle de `barrerTodo` y de una prueba de
     `pruebas/codigo/99-cron.test.ts`.

     ── EL COSTO, CONTADO ──────────────────────────────────────────────

     Por empresa: `contactos` son unas 5 llamadas (dos etiquetas, páginas de 100 sobre ~376 contactos)
     y `mensajes` **una** en régimen, así que el horario de diez minutos cuesta ~36 llamadas por hora.
     El de la hora —`citas` es 1+N con nueve calendarios— cuesta ~10.
     Total ~46 por hora y por empresa, contra las ~20 por DÍA de antes.

     Es un aumento grande y hay con qué compararlo: la plataforma anterior corrió en producción a
     **~7 peticiones por minuto y por pestaña** —420 por hora— y GoHighLevel lo toleró
     (`aria-project-closer-setter/docs/migracion/closer/09-INGESTA-Y-RECONCILIACION.md:138`). Queda un
     orden de magnitud por debajo de lo ya probado.

     Y no reemplaza al webhook: el aviso del CRM baja esto a segundos de latencia y a ~cero llamadas.
     Lo que este cambio hace es cerrar el agujero de las 24 horas **hoy**, sin esperar una ruta pública.
     Ver `docs/ETAPA-5.5-EL-AVISO-DEL-CRM.md`. ══════════════════════════════════════════ */

  /* ── CADA DIEZ MINUTOS, Y `auditoria` VA TERCERA ─────────────────────────

     Releer las etiquetas, traer los mensajes, y auditar. **En ese orden, y el orden es corrección.**

     `contactos` antes de `mensajes` es pérdida de datos permanente si se rompe, y está explicado en
     el bloque de arriba. Lo nuevo es la tercera, y su motivo es más directo: el antirrebote del
     auditor cuenta los mensajes del agente que hay en NUESTRA base. Corriendo antes de la ingesta
     contaría los de la corrida anterior, así que un contacto con cinco mensajes nuevos se auditaría
     diez minutos tarde **y con el transcript incompleto** — un veredicto sobre una conversación que
     ya siguió, que es peor que no auditar.

     ── Y VA EN EL HORARIO DE DIEZ MINUTOS Y NO EN EL DE LA HORA ─────────

     Es la cola que dice «alguien tiene que tomar esto ahora». En el horario de la hora, una
     conversación con daño en curso esperaría hasta sesenta minutos, y el encabezado de este módulo
     ya dice que pasar de segundos a diez minutos es el precio que este presupuesto impone. Sesenta
     sería regalar lo que no hace falta regalar.

     El costo, contado: la primera corrida son hasta veinte inferencias por empresa —medido en
     producción, dieciocho— y después el antirrebote las baja a las conversaciones que de verdad
     avanzaron. Y el presupuesto de tiempo del propio auditor evita que una empresa con cola larga se
     coma los 300 segundos de la función. */
  '*/10 * * * *': {
    tareas: ['contactos', 'mensajes', 'auditoria'],
    cadenciaMinutos: 10,
    umbralMinutos: 80,
  },

  /* Al minuto 3 de cada hora: el calendario y la sonda de aislamiento.
     El minuto 3 y no el 0 para no coincidir con el otro horario: dos corridas simultáneas de la misma
     empresa se frenarían entre sí por el candado, y una de las dos quedaría como `frenada` sin haber
     hecho nada — correcto pero ruidoso, y con el sello contando una corrida que no trabajó.
     Y la sonda sube de una vez por día a veinticuatro: cuesta CERO llamadas al proveedor y es la
     única señal de seguridad activa del sistema. */
  '3 * * * *': {
    tareas: ['citas', 'sonda'],
    cadenciaMinutos: 60,
    umbralMinutos: 180,
  },

  /* ── UNA VEZ POR DÍA: EL CARRIL AMARILLO ──────────────────────────────

     Es el único horario diario del sistema, y es diario porque **el tope lo es**: una mejora por
     día y por empresa. Ponerlo cada diez minutos no produciría más mejoras —el tope las corta— y
     produciría ciento cuarenta consultas del tope por día para no hacer nada.

     ── LA HORA, Y POR QUÉ NO ES REDONDA ────────────────────────────────

     `17 6 * * *` son las 06:17 UTC, o sea la madrugada en las zonas donde trabajan estas empresas
     (01:17 en Lima, 03:17 en Buenos Aires). Corre **en frío**, así que la madrugada es cuando menos
     compite con el barrido de diez minutos por el presupuesto de la función.

     Y el minuto 17 y no el 0 por lo mismo que el otro horario usa el 3: dos horarios que caen en el
     mismo minuto se frenan entre sí por el candado, y uno de los dos queda como `frenada` sin haber
     hecho nada — correcto pero ruidoso, con el sello contando una corrida que no trabajó.

     El umbral respeta la regla `>= 2 × cadencia + 60`: 2 × 1440 + 60 = 2940, y va 3000 para dejar
     margen a la imprecisión del disparo. */
  '17 6 * * *': {
    tareas: ['mejora'],
    cadenciaMinutos: 1440,
    umbralMinutos: 3000,
  },

  /* ── EL HORARIO DIARIO SE FUE, Y LA REGLA ES BIDIRECCIONAL ─────────────
     Primero lo dejé acá «por si alguien vuelve a Hobby», con el argumento de que la prueba solo exige
     que cada horario de `vercel.json` tenga entrada en este mapa. **Eso es falso**, y la prueba lo
     dijo: `pruebas/codigo/99-cron.test.ts` exige las DOS direcciones, y tiene razón en exigirlas.

     Una entrada acá que no está en la configuración es configuración muerta que engaña: se lee como
     «esto corre a las 12» y no corre. Y lo que yo quería conservar ya está cubierto por otra vía:
     `tareasDelHorario` corre TODAS las tareas ante un horario desconocido — así que volver a poner
     `'0 12 * * *'` en `vercel.json` sin tocar este archivo hace más trabajo, no menos, y la respuesta
     lo dice con `horarioDesconocido`. */
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

/**
 * El acceso al CRM ya estrechado. **El bucle lo garantizó; el tipo no lo sabe.**
 *
 * Hasta la tarea `auditoria` el guardia de la credencial era una sola condición y TypeScript podía
 * estrechar el tipo solo. Ahora son dos guardias —una tarea que no usa el CRM y otra que no usa la
 * llave de IA— y el estrechamiento no cruza esa bifurcación.
 *
 * El `throw` es preferible a un valor por omisión, y es el mismo criterio que usa `auditar(`: un token
 * vacío llamaría al proveedor y gastaría un rechazo, mientras que la excepción cae en el try/catch por
 * vuelta del bucle y sale reportada como `fallo` de esa empresa sin llevarse a las demás.
 */
function conToken(acceso: AccesoAGhl): { token: string; locationId: string } {
  if (acceso.tipo !== 'listo') throw new Error('barrido: la empresa no tiene token resuelto');
  return acceso;
}

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

/**
 * Lo que el manejador resuelve antes de entrar: la empresa y sus DOS accesos, ya descifrados.
 *
 * Son dos y no uno porque son dos proveedores distintos con dos llaves distintas, y una empresa
 * puede tener una y no la otra: hoy en producción **solo una de cinco tiene llave de IA**, y todas
 * las que trabajan tienen token del CRM. Con un solo campo, la falta de una apagaría la otra.
 */
export interface EmpresaParaBarrer {
  org: OrganizacionListada;
  acceso: AccesoAGhl;
  /** La llave de IA y el identificador del agente. `falta` es el caso normal de casi toda empresa. */
  auditor: AccesoAlAuditor;
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
  // El respaldo son TODAS, de `TAREAS` y no de una lista escrita acá: una lista propia se olvidaría
  // de la tarea siguiente y **el modo de fallo es silencioso** — el horario desconocido correría
  // cuatro de cinco y la respuesta diría que corrió todas. El orden ya viene bien de allá.
  if (!entrada) return { tareas: TAREAS, desconocido: true };
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

  for (const { org, acceso, auditor } of conSello) {
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
      /* ── `auditoria` NO PIDE EL TOKEN DEL CRM, Y ESO CAMBIA ESTA RAMA ────
       *
       * Es la primera tarea que no le habla a GoHighLevel: lee de nuestra base y llama al modelo. Sin
       * esta distinción, una empresa sin token del CRM —el caso NORMAL de una empresa recién creada—
       * saldría como `saltada` en una tarea que no necesita ese token, y el motivo diría
       * `sin_token_de_crm` sobre algo que no lo usa. */
      if (tarea !== 'auditoria' && tarea !== 'mejora' && acceso.tipo !== 'listo') {
        renglones.push({ slug: org.slug, tarea, estado: 'saltada', porque: acceso.que, llamadas: 0 });
        await sellar(org.id, tarea, 'saltada', acceso.que, 0);
        continue;
      }
      // Y su propia falta, con su propio texto: cuatro motivos que llevan a cuatro acciones distintas.
      if ((tarea === 'auditoria' || tarea === 'mejora') && auditor.tipo !== 'listo') {
        const que = TEXTO_DE_FALTA_AUDITOR[auditor.que];
        renglones.push({ slug: org.slug, tarea, estado: 'saltada', porque: que, llamadas: 0 });
        await sellar(org.id, tarea, 'saltada', que, 0);
        continue;
      }

      // ── TRY/CATCH POR VUELTA, Y ES OBLIGATORIO ───────────────────────────
      //
      // `conElPulso` anota el fallo en la fila del pulso y **lo relanza**. Sin este try/catch, la
      // empresa que falla se lleva puestas a todas las que venían después — y el reporte no las
      // menciona, así que la lista queda corta y se ve completa.
      try {
        const r =
          tarea === 'contactos'
            ? await releerContactos(org.id, conToken(acceso))
            : tarea === 'mensajes'
              ? await ingerirMensajes(org.id, conToken(acceso))
              : tarea === 'auditoria'
                ? await auditar(org, auditor, acceso, arranque, ahora)
                : tarea === 'mejora'
                  ? await mejorar(org, auditor)
                  : await barrerCitas(org.id, conToken(acceso));

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
 * Auditar a los agentes de esa empresa, con la forma que espera el bucle de arriba.
 *
 * ── EL PRESUPUESTO SE LE PASA, NO SE LO INVENTA ───────────────────────────
 *
 * El guardia de `PRESUPUESTO_MS` de arriba comprueba el reloj **antes de empezar cada empresa**, y
 * para las otras cuatro tareas eso alcanza: cuestan unas pocas llamadas al CRM y terminan en
 * segundos. Esta puede hacer veinte llamadas al modelo, que pasan cómodamente los 300 segundos de
 * `maxDuration` — y la plataforma **no reintenta**, así que lo que se corta se pierde y la llamada en
 * vuelo se paga igual.
 *
 * Así que el auditor recibe la misma fecha límite que usa este bucle y se detiene solo antes de cada
 * inferencia. Los que quedan salen como `sin_tiempo` en su reporte, y la corrida siguiente empieza
 * por ellos porque los candidatos vienen ordenados por el análisis más viejo primero.
 *
 * ── Y UN FRENO DEL CANDADO NO ES UN FALLO ────────────────────────────────
 *
 * `auditarEmpresa` usa `conElPulso`, igual que la ingesta, así que puede devolver que no le tocaba.
 * Eso se traduce al vocabulario del bucle —`frenada`— y no a un error: reintentar lo que frenó a
 * propósito convertiría el candado en un generador de gasto.
 */
async function auditar(
  org: OrganizacionListada,
  auditor: AccesoAlAuditor,
  acceso: AccesoAGhl,
  arranque: number,
  ahora: () => number,
): Promise<{ corrio: true; resultado: unknown; llamadas: number } | { corrio: false; porque: string }> {
  // El bucle ya garantizó que está `listo` antes de llamar acá. El tipo no lo sabe, y el `throw` es
  // preferible a un valor por omisión: una llave vacía llamaría al proveedor y gastaría un rechazo.
  if (auditor.tipo !== 'listo') throw new Error('auditar: la empresa no tiene acceso resuelto');

  const r = await auditarEmpresa(
    {
      orgId: org.id,
      zona: org.zonaHoraria,
      // El interruptor y las dos faltas ya las resolvió `resolverAccesoAlAuditor`.
      auditorActivo: true,
      claveIa: auditor.claveIa,
      idDelAgente: auditor.idDelAgente,
      /* El token del CRM va aparte, y puede faltar: auditar no le habla al CRM, solo MARCAR lo
         necesita. Una empresa sin token audita igual —los verdes, los amarillos y los hallazgos no
         lo usan— y lo único que no puede es pausarle el agente al CRM. Exigirlo acá apagaría el
         auditor entero por la última milla. */
      tokenDelCrm: acceso.tipo === 'listo' ? acceso.token : null,
    },
    { hasta: arranque + PRESUPUESTO_MS, reloj: ahora },
  );

  if (r.frenado !== undefined) return { corrio: false, porque: r.frenado };
  return { corrio: true, resultado: r, llamadas: r.llamadas };
}

/**
 * El carril amarillo, con la forma que espera el bucle de arriba.
 *
 * ── NO RECIBE PRESUPUESTO DE TIEMPO, Y ESO NO ES UN OLVIDO ────────────────
 *
 * `auditar` sí lo recibe porque puede hacer veinte llamadas al modelo. Éste hace **como mucho una**
 * —el tope del día lo corta— así que el guardia de `PRESUPUESTO_MS` que el bucle ya comprueba antes
 * de cada empresa alcanza: entre dos empresas hay a lo sumo una inferencia.
 *
 * Y no pasa por `conElPulso`: dos corridas simultáneas del mismo horario diario no existen —lo
 * frena el propio candado de Vercel— y si existieran, **el tope del día las hace inofensivas**: la
 * segunda cuenta la fila que escribió la primera y se va. Es la misma propiedad que hace idempotente
 * una entrega duplicada del carril rojo, y acá es todavía más directa.
 */
async function mejorar(
  org: OrganizacionListada,
  auditor: AccesoAlAuditor,
): Promise<{ corrio: true; resultado: unknown; llamadas: number }> {
  // El bucle ya garantizó que está `listo`. Ver el mismo criterio en `auditar(`.
  if (auditor.tipo !== 'listo') throw new Error('mejorar: la empresa no tiene acceso resuelto');

  const r = await buscarUnaMejora({
    orgId: org.id,
    zona: org.zonaHoraria,
    claveIa: auditor.claveIa,
    idDelAgente: auditor.idDelAgente,
  });
  return { corrio: true, resultado: r, llamadas: r.llamadas };
}

/**
 * Releer las etiquetas de los contactos, con la forma que espera el bucle de arriba.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUÉ NO PASA POR `conElPulso`, A DIFERENCIA DE LAS OTRAS DOS
 *
 * `ingerirMensajes` y `barrerCitas` lo usan porque las dispara **el reloj del navegador cada diez
 * segundos**, y sin candado N pestañas son N veces el tráfico contra el proveedor.
 *
 * Esta tarea no tiene reloj: la disparan el cron —una vez por día— y un botón de la pestaña Setter,
 * que es una acción explícita de una persona. Meterla en el candado le pondría un antirrebote de diez
 * segundos a ese botón sin que haya un tráfico que acotar, y el síntoma sería un botón que «no hace
 * nada» cuando alguien lo aprieta dos veces.
 *
 * El día que esta tarea gane un reloj, el candado es lo primero que hay que ponerle.
 *
 * ── Y UN FALLO SE LANZA, no se devuelve ───────────────────────────────
 *
 * El bucle de arriba ya tiene su try/catch por vuelta, y su rama de `fallo` deja el sello con el
 * motivo. Devolver `corrio: false` sería mentir con el vocabulario del candado: ese valor significa
 * «no le tocaba» —que **no es un error**— y un token rechazado por el CRM sí lo es.
 */
async function releerContactos(
  orgId: string,
  acceso: { token: string; locationId: string },
): Promise<{ corrio: true; resultado: unknown; llamadas: number }> {
  const r = await conOrganizacion(orgId, () =>
    sincronizarContactos({ token: acceso.token, locationId: acceso.locationId }),
  );
  // El tipo del fallo va al registro y NO al cuerpo (`ADR-0704`); el bucle pone el texto genérico.
  if (r.tipo === 'fallo') throw new Error(`el CRM respondió ${r.fallo.tipo}`);
  return { corrio: true, resultado: r.resumen, llamadas: r.resumen.llamadas };
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
