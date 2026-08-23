// ADR-0801 — El aislamiento se sostiene AHORA, no solo en pruebas. INNEGOCIABLE.
//
// La sonda de aislamiento. Es la señal 6 del `10` § 1.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ES LO ÚNICO DE TODA LA LISTA QUE PUEDE DETECTAR LA FUGA MISMA
//
// El `10` § 1 lo dice así:
//
//   "Las pruebas verifican el aislamiento **en el entorno de desarrollo, antes de desplegar**. La
//    sonda lo verifica **en producción, cada hora**, que es donde importa. […] Cuesta dos filas y
//    una tarea programada. Y es lo único de esta lista que puede detectar **la fuga misma** en vez
//    de sus alrededores."
//
// Todas las otras señales miran alrededores: excepciones, rechazos, intentos fallidos. Esta mira la
// cosa.
//
// ── LAS DOS FILAS QUE ESTA SONDA VINO ESPERANDO DESDE LA ETAPA 2 ─────────────
//
// `negocio.control_aislamiento` existe desde la migración 008, y su comentario ya lo decía: *"el
// `10` § 1 ya describe esta tabla: la sonda de aislamiento de la Etapa 8 usa 'dos organizaciones de
// control, con una fila marcada cada una' sobre una 'tabla de control'. Así que existe en la
// especificación, sirve a las pruebas de ahora y a la sonda de producción después."*
//
// Ese "después" es ahora.
//
// ── Y CORRE POR EL CAMINO REAL, QUE ES TODO EL PUNTO ────────────────────────
//
// `conOrganizacion()` y `datos()`, igual que una petición. Una sonda que consultara con el rol
// propietario, o con una conexión de conveniencia, pasaría **sin que nada esté protegido** — que es
// la advertencia que `EJECUCION` § 5 puso sobre el criterio de cierre de la Etapa 2 y que vale
// exactamente igual acá.
// ═══════════════════════════════════════════════════════════════════════════════

import { conIdentidad } from '../datos/capa.ts';
import { conOrganizacion, datos } from '../datos/contexto.ts';
import { avisar } from './aviso.ts';

/**
 * Las dos organizaciones de control de la sonda.
 *
 * ── POR QUÉ NO SON `alfa` Y `beta` ────────────────────────────────────────────
 *
 * Lo eran, y era un defecto de producción con forma de detalle. `alfa` y `beta` son
 * los slugs del SEMBRADO DE DESARROLLO (`db/sembrado/organizaciones.ts`), y el
 * sembrado se niega a correr contra cualquier cosa que no sea la base local — así que
 * en producción esas dos organizaciones NO EXISTEN.
 *
 * Consecuencia exacta: la sonda no encontraba sus dos controles, caía en la guarda
 * anti-falso-verde de abajo, y emitía un aviso de gravedad `maxima` EN CADA CORRIDA.
 * Con la tarea programada cada hora, eso es un aviso máximo por hora sobre un sistema
 * sano. Se silencia en dos días, y con él se apaga la señal 6 — *"lo único de esta
 * lista que puede detectar la fuga misma"*.
 *
 * La guarda no está mal: es impecable, y es la que hizo visible el problema. Lo que
 * estaba mal es de dónde salían las organizaciones.
 *
 * Ahora son dos organizaciones propias, creadas por `db/controles/sonda.ts` desde los
 * DOS caminos que existen —`scripts/arranque.mjs` en producción y el sembrado en
 * desarrollo— así que la sonda encuentra lo mismo en los dos lados.
 *
 * Nacen con `activa = false`: son infraestructura, no clientes. Nadie puede entrar a
 * ellas (el portero exige la organización activa) y la sonda funciona igual, porque
 * `conOrganizacion()` fija la variable de transacción y no consulta ese campo.
 *
 * Y tienen que ser organizaciones DE VERDAD, no una constante: `negocio.control_aislamiento`
 * tiene una clave foránea a `identidad.organizaciones(id)`, y `aplicar_aislamiento()`
 * la exige. Dos filas es el costo que el `10` § 1 ya presupuestaba.
 */
export const SLUGS_DE_CONTROL = ['control-a', 'control-b'] as const;

// No hay `MARCAS_DE_CONTROL`. La había —`['control-alfa', 'control-beta']`— exportada y
// SIN UN SOLO USO en todo el repositorio, y con los slugs del sembrado de desarrollo
// adentro. Una constante muerta es deuda; una constante muerta con los valores viejos de
// algo que se acaba de cambiar es una trampa para el próximo que la lea y la crea vigente.
// La marca de cada fila de control la deriva `marcaDeControl()` en `db/controles/sonda.ts`,
// que es el único lugar que la escribe.

export interface ResultadoDeSonda {
  /**
   * Cuántas organizaciones de control se VERIFICARON de verdad — o sea, cuántas tenían su
   * fila de control. Menos de dos es un falso verde.
   *
   * No es "cuántas organizaciones se encontraron", y la distinción es la que hace honesto
   * el campo: una organización sin su fila no verifica nada, y contarla acá sería la misma
   * mentira que la guarda vieja dejaba pasar.
   */
  revisadas: number;
  /** Las fugas encontradas. Vacío es lo que se espera. */
  fugas: { desde: string; vio: string; marca: string }[];
  /** Si se avisó. `false` cuando no hubo fugas, o cuando el aviso se suprimió por deduplicación. */
  aviso: boolean;
}

/**
 * Corre la sonda. **Devuelve el resultado; no lanza cuando encuentra una fuga.**
 *
 * Devolver en vez de lanzar es deliberado, y es la misma lección que costó el refactor de
 * `tokenVigente()` en la Etapa 6: si esto lanzara, quien la programa por hora vería un error y
 * tendría que ir a buscar qué pasó. Devolviendo el resultado, el aviso ya salió y el resultado
 * queda para el registro de la tarea.
 */
export async function sondaDeAislamiento(): Promise<ResultadoDeSonda> {
  const controles = await conIdentidad(async (db) =>
    db
      .selectFrom('organizaciones')
      .select(['id', 'slug'])
      .where('slug', 'in', [...SLUGS_DE_CONTROL])
      .orderBy('slug')
      .execute(),
  );

  const fugas: ResultadoDeSonda['fugas'] = [];
  // Las organizaciones que de verdad tenían una fila. Ver la guarda de abajo: NO es lo mismo que
  // `controles`, y confundirlas es lo que hacía que esta sonda pudiera tranquilizar en falso.
  const conFila: string[] = [];

  for (const org of controles) {
    // EL CAMINO REAL: `conOrganizacion()` + `datos()`, como una petición.
    const filas = await conOrganizacion(org.id, async () =>
      datos().selectFrom('control_aislamiento').select(['org_id', 'marca']).execute(),
    );

    if (filas.length > 0) conFila.push(org.slug);

    for (const fila of filas) {
      if (fila.org_id !== org.id) {
        fugas.push({ desde: org.slug, vio: fila.org_id, marca: fila.marca });
      }
    }
  }

  // LA GUARDA CONTRA EL FALSO VERDE, y acá es la mitad que decide si la sonda sirve: *"ninguna ve a
  // la otra"* es cierto y vacío a la vez si no hay dos organizaciones con filas. Una sonda que
  // devuelve "todo bien" sobre una tabla vacía es peor que ninguna sonda, porque tranquiliza.
  //
  // ── Y SE CUENTAN LAS ORGANIZACIONES CON FILA, NO LAS ORGANIZACIONES ──────────
  //
  // La versión anterior comprobaba `controles.length < 2`, o sea que existieran las dos
  // organizaciones. El comentario de arriba ya decía "dos organizaciones CON FILAS" — describía la
  // guarda correcta mientras el código implementaba una más débil, y esa distancia era el defecto.
  //
  // El caso concreto que se colaba: `db/controles/sonda.ts` escribe en los DOS dominios y entre
  // dominios no hay atomicidad (09 § 6). Si su primera mitad confirma y la segunda falla, queda una
  // organización de control SIN su fila. Con la guarda vieja, `controles.length` era 2, el bucle no
  // encontraba nada que comparar en esa organización, y la sonda devolvía `fugas: []` habiendo
  // revisado UNA SOLA. Es exactamente el "éxito reportado que no ocurrió" del 09 § 6, y en la única
  // cosa del sistema que puede detectar la fuga misma.
  if (conFila.length < 2) {
    // Esto NO es una fuga, es una sonda rota — y hay que decirlo por el mismo canal, porque una
    // sonda que dejó de mirar es tan grave como una fuga que no se ve.
    const aviso = await avisar('fuga_entre_organizaciones', {
      gravedad: 'maxima',
      motivo:
        'la sonda no encontró dos organizaciones de control CON su fila: no está verificando nada',
      // Las dos cifras, porque distinguen dos fallas con arreglos distintos: si
      // `organizaciones` es menor que 2, faltan las organizaciones y hay que correr
      // `scripts/arranque.mjs`. Si son 2 y `conFila` es menor, la organización está y le falta la
      // fila — es la mitad que quedó a medias, y el arranque también la repone. Sin las dos, quien
      // reciba el aviso a las tres de la mañana no sabe qué mirar.
      organizaciones: controles.length,
      conFila: conFila.length,
    });
    return { revisadas: conFila.length, fugas: [], aviso };
  }

  if (fugas.length === 0) {
    return { revisadas: conFila.length, fugas: [], aviso: false };
  }

  // El MISMO canal que la señal 1, con las cuatro decisiones ya tomadas (`10` § 1).
  const aviso = await avisar('fuga_entre_organizaciones', { filas: fugas, gravedad: 'maxima' });
  return { revisadas: conFila.length, fugas, aviso };
}
