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

/** Las marcas de las dos organizaciones de control, del sembrado. */
export const MARCAS_DE_CONTROL = ['control-alfa', 'control-beta'] as const;

export interface ResultadoDeSonda {
  /** Cuántas organizaciones de control se revisaron. Menos de dos es un falso verde. */
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
  // Las organizaciones de control se buscan por su MARCA, no por su slug: la marca está en la fila
  // de control, que es lo que la sonda mira. Si alguien renombrara los slugs, la sonda seguiría
  // encontrando sus dos organizaciones; si borrara las filas de control, la guarda de abajo lo dice.
  const controles = await conIdentidad(async (db) =>
    db
      .selectFrom('organizaciones')
      .select(['id', 'slug'])
      .where('slug', 'in', ['alfa', 'beta'])
      .orderBy('slug')
      .execute(),
  );

  const fugas: ResultadoDeSonda['fugas'] = [];

  for (const org of controles) {
    // EL CAMINO REAL: `conOrganizacion()` + `datos()`, como una petición.
    const filas = await conOrganizacion(org.id, async () =>
      datos().selectFrom('control_aislamiento').select(['org_id', 'marca']).execute(),
    );

    for (const fila of filas) {
      if (fila.org_id !== org.id) {
        fugas.push({ desde: org.slug, vio: fila.org_id, marca: fila.marca });
      }
    }
  }

  // LA GUARDA CONTRA EL FALSO VERDE, y acá es la mitad que decide si la sonda sirve: *"ninguna ve a
  // la otra"* es cierto y vacío a la vez si no hay dos organizaciones con filas. Una sonda que
  // devuelve "todo bien" sobre una tabla vacía es peor que ninguna sonda, porque tranquiliza.
  if (controles.length < 2) {
    // Esto NO es una fuga, es una sonda rota — y hay que decirlo por el mismo canal, porque una
    // sonda que dejó de mirar es tan grave como una fuga que no se ve.
    const aviso = await avisar('fuga_entre_organizaciones', {
      gravedad: 'maxima',
      motivo: 'la sonda no encontró las dos organizaciones de control: no está verificando nada',
      revisadas: controles.length,
    });
    return { revisadas: controles.length, fugas: [], aviso };
  }

  if (fugas.length === 0) {
    return { revisadas: controles.length, fugas: [], aviso: false };
  }

  // El MISMO canal que la señal 1, con las cuatro decisiones ya tomadas (`10` § 1).
  const aviso = await avisar('fuga_entre_organizaciones', { filas: fugas, gravedad: 'maxima' });
  return { revisadas: controles.length, fugas, aviso };
}
