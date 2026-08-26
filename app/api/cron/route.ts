// El punto de entrada de las tareas programadas. Lo llama el disparador de Vercel, no una persona.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO ES UN GET QUE ESCRIBE
//
// Es la decisión más incómoda de este archivo y va primero, porque contradice de frente un
// precedente escrito de este repositorio.
//
// **Vercel dispara los cron con un GET, y no se puede elegir.** El tipo oficial de un cron tiene
// exactamente dos campos, `path` y `schedule`; no hay método. Un manejador `POST` acá recibiría un
// 405 de Next y el cron **no correría nunca**: no hay error de compilación, no hay error de
// despliegue, no hay nada rojo. Ése es exactamente el modo de fallar que esta ruta existe para
// evitar, así que elegir POST «por prolijidad» sería elegir que la función no exista.
//
// El precedente que esto contradice está en `app/api/closer/agenda/refrescar/route.ts`, bajo el
// título «POR QUÉ ES POST Y NO UN PARÁMETRO DEL GET», y hay que decir por qué no aplica: **ahí el
// cliente es un navegador que una persona maneja**, y el defecto real era que abrir tres pestañas
// disparaba tres barridos. Acá el cliente es el disparador de la plataforma: no hay pestañas, y el
// caso de dos disparos a la vez está acotado por el candado del pulso —`.forUpdate().skipLocked()`—
// que además es el mecanismo que la propia documentación de Vercel exige, porque **admite corridas
// duplicadas**. No es una precaución opcional: es un requisito del contrato.
//
// Y esta ruta **no pierde ninguna defensa por ser GET.** Medido: `verificarOrigen` se invoca desde
// exactamente dos lugares —`exigir()` y el login— y una ruta con secreto propio no llama a
// `exigir()`, así que un POST acá tampoco pasaría por esa verificación. `ADR-0306` no se desactiva:
// nunca alcanzó a esta clase de ruta, igual que no alcanza a la sonda.
//
// ── LA AUTENTICACIÓN, Y POR QUÉ NO SE COPIA DE NINGUNO DE LOS DOS LADOS ──────
//
// Ni el ejemplo oficial de Vercel ni la sonda de este repositorio sirven copiados, y las dos formas
// de equivocarse dan el mismo síntoma: **403 en todas las corridas, para siempre**.
//
//   · El ejemplo oficial compara con `!==` sobre cadenas. Acá eso es un canal de tiempo sobre un
//     secreto, y además `ADR-0301` exige literalmente `timingSafeEqual` en toda ruta de
//     `RUTAS_CON_SECRETO_PROPIO` — la prueba busca la cadena.
//   · La sonda compara la cabecera **entera**. Vercel manda `Authorization: Bearer <secreto>`, con
//     el prefijo COMO PARTE DEL VALOR. Comparar entero es comparar `"Bearer abc"` contra `"abc"`:
//     largos distintos, falso, siempre.
//
// La forma correcta es la del medio y está abajo. El guardia de «la variable no está definida» va
// **primero**: sin él, la comparación es contra el literal `'Bearer undefined'`, y cualquiera en
// internet que mande esa cabecera dispara la ingesta de todas las empresas.
//
// Y **nunca se autoriza por el user agent**. `vercel-cron/1.0` y `x-vercel-cron-schedule` los
// escribe el cliente: sirven para enrutar, jamás para autorizar.
//
// ── DOS COSAS QUE HACEN QUE UNA CORRIDA NO EXISTA ───────────────────────────
//
// Medido: una respuesta **3xx** o **cacheada** hace que Vercel dé la corrida por terminada **y que
// además no aparezca en los registros**. De ahí dos consecuencias que parecen detalles y no lo son:
//
//   · La ruta vive bajo `/api/`. `proxy.ts` excluye `api(?:/|$)` y nada más, así que cualquier otro
//     camino recibiría un 307 a `/entrar` — una corrida terminada, sin trabajo y sin rastro.
//   · Las respuestas salen por `ok()`, que pone `cache-control: no-store` a mano.
//
// Y una medición sobre ESTE proyecto, hecha antes de escribir el archivo: la protección de
// despliegue está en **Standard**, o sea que la URL de producción queda pública y la URL generada
// del despliegue redirige al muro de SSO. Comprobado con `curl`: `/api/salud` responde 200 en
// `aria-comando-central.vercel.app` y 302 en `aria-comando-central-<hash>.vercel.app`. El cron pega
// en la URL de producción, así que anda — pero **el día que alguien pase la protección a «All
// Deployments», el cron deja de correr en silencio**. Está anotado en `docs/DESPLIEGUE.md`.
// ═══════════════════════════════════════════════════════════════════════════════

import { timingSafeEqual } from 'node:crypto';
import { conIdentidad } from '../../../lib/datos/capa.ts';
import { listarOrganizaciones } from '../../../lib/administracion/organizaciones.ts';
import { resolverAccesoAGhl } from '../../../lib/credenciales/resolver.ts';
import { ok, rechazo } from '../../../lib/autorizacion/respuesta.ts';
import { barrerTodo, type EmpresaParaBarrer } from '../../../lib/negocio/barrido.ts';

/**
 * El tope de Vercel en el plan Hobby, y no hay palanca para subirlo ahí.
 *
 * Se declara acá y **no** en un bloque `functions` de `vercel.json`: dos fuentes para el mismo
 * límite es la clase de divergencia que después nadie encuentra. Hay una prueba que lo ata.
 */
export const maxDuration = 300;

/** Comparación de largo constante. Un `===` sobre un secreto es un canal de tiempo. */
function coincide(recibido: string, esperado: string): boolean {
  const a = Buffer.from(recibido, 'utf8');
  const b = Buffer.from(esperado, 'utf8');
  // `timingSafeEqual` LANZA si los largos difieren, así que el largo se compara antes — y eso sí
  // filtra el largo del secreto, que es información de la que no se puede hacer nada.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Vercel manda el prefijo COMO PARTE DEL VALOR de la cabecera. Ver el encabezado. */
const PREFIJO = 'Bearer ';

export async function GET(peticion: Request): Promise<Response> {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) {
    // El nombre de la variable va al REGISTRO, no al cuerpo: esta ruta es alcanzable **sin
    // autenticar** —es su naturaleza— así que un `detalle` acá se lo cuenta a cualquiera que la
    // golpee. Quien puede arreglarlo administra el despliegue y lee el registro.
    //
    // Y que el barrido NO corrió es justo lo que hay que gritar ahí: un 403 silencioso en una tarea
    // programada se lee como «el cron anda y no había nada que hacer».
    console.error(
      'cron: el secreto de las tareas programadas no está configurado, así que la ruta responde ' +
        '403 y EL BARRIDO NO CORRIÓ. Ver docs/DESPLIEGUE.md.',
    );
    return rechazo('sin_permiso');
  }

  const cabecera = peticion.headers.get('authorization') ?? '';
  if (!cabecera.startsWith(PREFIJO)) return rechazo('sin_permiso');
  if (!coincide(cabecera.slice(PREFIJO.length), esperado)) return rechazo('sin_permiso');

  /* ── QUÉ HORARIO DISPARÓ ───────────────────────────────────────────────────
   *
   * Varias entradas de `crons` pueden apuntar al MISMO camino con horarios distintos, y esta
   * cabecera es la que las distingue. Es lo que permite que haya una sola ruta que auditar y un solo
   * secreto, en vez de una ruta por tarea.
   *
   * Si falta o no está en el mapa, `tareasDelHorario` corre TODAS las tareas y la respuesta lo dice.
   * Nunca «no hacer nada»: eso sería un cron que dispara, responde 200 y no trabaja — indistinguible
   * de uno que funciona, que es el rechazo-igual-a-vacío que `ADR-0305` prohíbe.
   */
  const horario = peticion.headers.get('x-vercel-cron-schedule');

  /* ── FASE 1 · IDENTIDAD, EN UNA SOLA TRANSACCIÓN, Y SE CIERRA ANTES DEL BUCLE ──
   *
   * La lista de empresas y sus credenciales viven en identidad —`organizaciones_credenciales` es
   * una tabla sobre la que el rol del inquilino no tiene ni `select`—, así que esta parte va acá y no
   * en `lib/negocio/barrido.ts`: es el mismo reparto que la ingesta y el refresco de la agenda ya
   * usan, y es lo que mantiene la excepción declarada en el manejador, donde se lee.
   *
   * `resolverAccesoAGhl` se llama UNA VEZ POR EMPRESA a propósito. Está prohibido escribir una
   * consulta nueva que traiga todas las credenciales de un tirón: sumaría un cuarto lugar donde el
   * filtro por organización lo pone una consulta a mano, y olvidarse un `where` ahí entrega el token
   * de una empresa a otra sin ningún error.
   */
  const empresas: EmpresaParaBarrer[] = await conIdentidad(async (db) => {
    const todas = await listarOrganizaciones(db);
    // ── EL FILTRO POR `activa`, QUE LA CONSULTA NO TRAE ─────────────────────
    //
    // `listarOrganizaciones` NO filtra por `activa`, y con motivo escrito: el panel tiene que seguir
    // mostrando una empresa cliente desactivada. Acá es lo contrario — barrer una empresa apagada es
    // gastar diez llamadas al proveedor por una empresa a la que nadie puede entrar.
    const activas = todas.filter((o) => o.activa);
    return Promise.all(
      activas.map(async (org) => ({ org, acceso: await resolverAccesoAGhl(db, org.id) })),
    );
  });

  const r = await barrerTodo(horario, empresas);

  /* Se devuelve el reporte COMPLETO, no un `{ ok: true }`. Es el mismo criterio que la
   * sincronización de contactos: *"un contacto salteado en silencio es la peor forma de esto: la
   * lista queda corta, se ve completa"*.
   *
   * Y hay que decir para qué sirve y para qué no: este cuerpo es para depurar a mano. En el plan
   * Hobby los registros duran **una hora** y **no existe ninguna alerta por ausencia** de
   * invocaciones —las dos alertas de Vercel son por exceso—. Lo que sobrevive a la hora es el sello
   * de `negocio.tareas_programadas`, y ése es el que hay que mirar para saber si el cron corre. */
  return ok(r);
}
