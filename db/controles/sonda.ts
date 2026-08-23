// Las dos organizaciones de control de la sonda de aislamiento.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ ESTO NO ES EL SEMBRADO, Y POR QUÉ NO ES UNA MIGRACIÓN
//
// El sembrado de desarrollo (`db/sembrado/organizaciones.ts`) enumera en su
// encabezado seis maneras de crear filas y por qué cinco no sirven. La sexta —"un
// programa aparte que escribe por `conIdentidad()`"— es la que vale, y esto es otra
// instancia de ella.
//
// Pero NO puede ser el sembrado, y ésa es exactamente la corrección: el sembrado se
// niega a correr contra algo que no sea local, porque escribe usuarios con una
// contraseña conocida. Estas dos organizaciones son lo contrario: no tienen usuarios,
// no tienen credenciales, y TIENEN que existir en producción — la sonda de producción
// es su única razón de ser.
//
// Y no puede ser una migración, por la cadena que el sembrado ya documenta: `migrador`
// no puede insertar en `identidad.organizaciones` después de que las políticas están
// puestas, y ninguna de las salidas a ese problema está permitida (EJECUCION § 3
// prohíbe darle política al rol que migra; el 09 § 2 prohíbe el `grant` cruzado; y
// quitar el forzado a mitad de una migración está explícitamente descartado).
//
// La objeción que mató la opción 5 del sembrado —"LAS MIGRACIONES CORREN TAMBIÉN EN
// PRODUCCIÓN, crearía dos organizaciones cliente con credenciales de desarrollo en el
// servidor administrado"— acá NO aplica, y vale decir por qué: estas dos no son
// clientes y no tienen credenciales. Que existan en producción es el requisito, no el
// accidente.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ESTE ARCHIVO ESCRIBE EN LOS DOS DOMINIOS. QUÉ PASA SI LA SEGUNDA MITAD FALLA.
//
// Está en `CRUZAN_LOS_DOS_DOMINIOS` y el 09 § 6 exige decir esto en el propio código:
//
//   "una operación que escribe en los dos dominios NO PUEDE SER ATÓMICA. Son dos
//    transacciones distintas; una puede confirmar y la otra fallar. Y si la segunda
//    mitad falla, la respuesta —a menos que alguien lo haya pensado— va a decir que
//    todo salió bien, porque la primera mitad funcionó."
//
// Acá las dos mitades son: (1) las organizaciones, por `conIdentidad()`; (2) sus filas
// de control, por `conOrganizacion()`. Si la (1) confirma y la (2) falla, queda una
// organización de control **sin su fila**.
//
// ── Y ESO IMPORTABA MÁS DE LO QUE PARECE ─────────────────────────────────────
//
// La sonda comprobaba `controles.length < 2`: que existieran las DOS ORGANIZACIONES. Con
// este estado a medias, la sonda encontraba dos, no tenía nada que comparar en una de
// ellas, y devolvía `fugas: []` —"todo bien"— habiendo revisado UNA SOLA. El éxito
// reportado que no ocurrió, en lo único del sistema que puede detectar la fuga misma.
//
// Escribir este bloque es lo que hizo verlo. La sonda ahora cuenta las organizaciones
// CON FILA, así que este estado a medias **se detecta y avisa con gravedad máxima** en
// vez de pasar en verde. Ver `lib/deteccion/sonda.ts`.
//
// ── LAS TRES PROPIEDADES QUE HACEN ACEPTABLE LA FALTA DE ATOMICIDAD ──────────
//
//   1. **Se detecta.** La sonda avisa, con las dos cifras que distinguen "faltan las
//      organizaciones" de "falta la fila".
//   2. **Se repara volviendo a correrlo.** Es idempotente POR ORGANIZACIÓN, no por
//      corrida completa: comprueba y crea cada mitad de cada organización por separado,
//      así que una segunda corrida completa exactamente lo que faltaba. `scripts/arranque.mjs`
//      la llama antes de su propio corte por "ya existe el administrador fundador",
//      precisamente para que reparar sea `node scripts/arranque.mjs` y nada más.
//   3. **No hay datos que perder.** Las dos mitades son infraestructura sin usuarios,
//      sin credenciales y sin datos de nadie. Un reintento no puede duplicar nada
//      —cada mitad se comprueba antes de escribir— ni pisar nada de un cliente.
//
// Y devuelve QUÉ MITADES CREÓ, en vez de un booleano: así el llamador informa lo que
// pasó de verdad en vez de "listo".
// ═══════════════════════════════════════════════════════════════════════════════

import { conIdentidad } from '../../lib/datos/capa.ts';
import { conOrganizacion, datos } from '../../lib/datos/contexto.ts';
import { SLUGS_DE_CONTROL } from '../../lib/deteccion/sonda.ts';

/** La marca de la fila de control, derivada del slug. La sonda compara por org_id. */
export function marcaDeControl(slug: string): string {
  return `control-de-sonda:${slug}`;
}

export interface ResumenDeControles {
  /** Slugs de las organizaciones que hubo que crear. Vacío si ya estaban las dos. */
  organizaciones: string[];
  /** Slugs cuya fila de control hubo que crear. */
  filas: string[];
}

/**
 * Crea las dos organizaciones de control y su fila, si faltan.
 *
 * **Idempotente**: correrla diez veces deja el mismo resultado. Es un requisito y no
 * una comodidad — la llaman el arranque de producción y el sembrado de desarrollo, y
 * el arranque se puede volver a correr después de que alguien ya creó su primer
 * administrador.
 */
export async function asegurarControlesDeSonda(): Promise<ResumenDeControles> {
  const organizaciones: string[] = [];
  const filas: string[] = [];

  const orgs = await conIdentidad(async (db) => {
    const salida: { id: string; slug: string }[] = [];
    for (const slug of SLUGS_DE_CONTROL) {
      const existente = await db
        .selectFrom('organizaciones')
        .select(['id', 'slug'])
        .where('slug', '=', slug)
        .executeTakeFirst();
      if (existente) {
        salida.push(existente);
        continue;
      }

      const creada = await db
        .insertInto('organizaciones')
        .values({
          nombre: `Control de sonda (${slug})`,
          slug,
          // Infraestructura, no cliente: nadie entra acá. El portero exige la
          // organización activa, así que esto cierra el login sin cerrar la sonda —
          // `conOrganizacion()` fija la variable de transacción y no mira este campo.
          activa: false,
        })
        .returning(['id', 'slug'])
        .executeTakeFirstOrThrow();
      organizaciones.push(slug);
      salida.push(creada);
    }
    return salida;
  });

  // La fila de control, por el CAMINO REAL. Igual que en el sembrado: `org_id` no se
  // escribe, lo inyecta la capa fina. Si el código de negocio tuviera que acordarse de
  // ponerlo, volveríamos a "acordate de filtrar".
  for (const org of orgs) {
    await conOrganizacion(org.id, async () => {
      const db = datos();
      const existente = await db
        .selectFrom('control_aislamiento')
        .select(['id'])
        .where('marca', '=', marcaDeControl(org.slug))
        .executeTakeFirst();
      if (existente) return;

      await db
        .insertInto('control_aislamiento')
        .values({ marca: marcaDeControl(org.slug) })
        .execute();
      filas.push(org.slug);
    });
  }

  return { organizaciones, filas };
}
