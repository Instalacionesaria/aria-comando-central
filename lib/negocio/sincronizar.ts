// Traer los contactos de GoHighLevel a `negocio.contactos`.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LAS DOS ETIQUETAS, Y POR QUÉ EL CLOSER GANA
//
// Se pidió así: *"los que tengan zona closer se van para el closer, y los contactos que tengan
// la etiqueta de zona setter se van para el setter"*.
//
// Un contacto puede tener LAS DOS. Pasa de forma normal: el workflow WF 04.1 de GoHighLevel
// cambia la zona al agendar, y según cómo esté armado puede sumar la nueva sin sacar la vieja.
// Con las dos etiquetas hay que elegir, y **gana el closer**: un contacto que ya llegó a la
// agenda del closer no vuelve a la bandeja del setter. Que aparezca en las dos listas sería
// peor que elegir mal — dos personas trabajando el mismo lead sin saberlo, y atender una no
// cierra la otra.
//
// ── LO QUE NO SE INVENTA ────────────────────────────────────────────────────
//
// GoHighLevel **no documenta** una fecha de última actividad entrante ni saliente por contacto.
// Lo más cercano es `lastActivity`, que no distingue dirección, y los filtros de dirección
// están en `conversations/search` —otra versión de cabecera— cuyo esquema de respuesta
// documentado ni siquiera lista esos campos.
//
// Así que `ultimo_entrante_el`, `ultimo_entrante_texto` y `ultimo_saliente_el` **quedan nulos**.
// La consecuencia es visible y es correcta: la fila no muestra microtexto de actividad. Poner
// `dateAdded` ahí sería más fácil y diría "respondió hace 3 días" de alguien que nunca escribió.
//
// Lo mismo con `etapa` (GHL no expone un campo de etapa: la mueve un workflow), `score` (nada
// lo calcula) y `responsable_id` (las etiquetas dicen territorio, no asignación).
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import type { Territorio } from '../datos/esquema.ts';
import {
  etiquetasDeLaSubcuenta,
  nombreDe,
  todosLosContactosPorEtiqueta,
  type ContactoDeGhl,
  type FalloDeGhl,
} from '../ghl/cliente.ts';

/**
 * Las etiquetas de GoHighLevel, y a qué territorio corresponde cada una.
 *
 * El orden ES la precedencia: el primero que coincida gana. Ver el encabezado.
 */
export const ETIQUETAS: readonly { etiqueta: string; territorio: Territorio }[] = [
  { etiqueta: 'zona_closer', territorio: 'closer' },
  { etiqueta: 'zona_setter', territorio: 'setter' },
];

/** Lo que pasó en una sincronización. */
export interface Resumen {
  /** Cuántos contactos trajo GoHighLevel, por etiqueta. */
  traidos: Record<string, number>;
  /** Cuántas filas quedaron escritas, por territorio. */
  guardados: Record<Territorio, number>;
  /**
   * Los que NO se guardaron, con el motivo. **Se informan uno por uno.**
   *
   * Un contacto salteado en silencio es la peor forma de esto: la lista queda corta, se ve
   * completa, y el síntoma que llega es "faltan contactos" sin nada que mirar.
   */
  salteados: { id: string; porque: string }[];
  /** `true` si se llegó al tope de páginas sin agotar una etiqueta. Ver `TOPE_DE_PAGINAS`. */
  truncado: boolean;
  /**
   * Las etiquetas que EXISTEN en la subcuenta. Solo se consulta cuando no vino ningún
   * contacto, que es cuando sirve para algo.
   *
   * `null` = no se preguntó, o no se pudo (el token puede no tener `locations/tags.readonly`,
   * que es un alcance distinto del que usa la búsqueda). `[]` = la subcuenta no tiene ninguna
   * etiqueta. Los dos NO son lo mismo: uno manda a revisar el token y el otro las etiquetas.
   */
  etiquetasDeLaCuenta: string[] | null;
}

export type ResultadoDeSincronizar =
  | { tipo: 'listo'; resumen: Resumen }
  | { tipo: 'fallo'; fallo: FalloDeGhl };

/**
 * Trae los contactos de las dos etiquetas y los deja en `negocio.contactos`.
 *
 * ── SE CORRE DENTRO DE `conOrganizacion(` ───────────────────────────────────
 *
 * No recibe `orgId` y no lo escribe: lo inyecta la capa fina, y la política de fila hace el
 * resto. Este archivo no nombra `org_id` ni una vez, que es la propiedad que se busca — un
 * `org_id` escrito a mano acá sería un lugar más donde equivocarse.
 */
export async function sincronizarContactos(acceso: {
  token: string;
  locationId: string;
}): Promise<ResultadoDeSincronizar> {
  const resumen: Resumen = {
    traidos: {},
    guardados: { closer: 0, setter: 0 },
    salteados: [],
    truncado: false,
    etiquetasDeLaCuenta: null,
  };

  // Se recorren las etiquetas en orden de precedencia y se queda el PRIMER territorio que le
  // toque a cada contacto. `vistos` es lo que hace que el closer gane sobre el setter.
  const vistos = new Set<string>();

  for (const { etiqueta, territorio } of ETIQUETAS) {
    const r = await todosLosContactosPorEtiqueta(acceso, etiqueta);
    if (r.tipo === 'fallo') return r;

    resumen.traidos[etiqueta] = r.datos.contactos.length;
    if (r.datos.truncado) resumen.truncado = true;

    for (const c of r.datos.contactos) {
      if (vistos.has(c.id)) continue;
      vistos.add(c.id);

      const guardado = await guardar(c, territorio);
      if (guardado === true) resumen.guardados[territorio] += 1;
      else resumen.salteados.push({ id: c.id, porque: guardado });
    }
  }

  // Si no vino NI UN contacto, la pregunta siguiente siempre es la misma: ¿estarán mal los
  // nombres de las etiquetas? Se contesta antes de que alguien la haga.
  //
  // Solo en ese caso: cuando vinieron contactos, el catálogo no aporta nada y sería una
  // llamada más contra el límite de tasa de GoHighLevel.
  const vinoAlgo = Object.values(resumen.traidos).some((n) => n > 0);
  if (!vinoAlgo) {
    resumen.etiquetasDeLaCuenta = await etiquetasDeLaSubcuenta(acceso);
  }

  return { tipo: 'listo', resumen };
}

/**
 * Guarda un contacto. Devuelve `true`, o el motivo por el que se salteó.
 *
 * ── EL `on conflict` ES POR `(org_id, ghl_contact_id)` ──────────────────────
 *
 * Que es único POR ORGANIZACIÓN y no globalmente, y eso es lo que hace que traer de nuevo sea
 * idempotente entre inquilinos. Con un único global, el `insert` de una organización chocaría
 * con la fila INVISIBLE de otra y devolvería `23505` en vez de escribir — un error que además
 * confirma que ese contacto existe en otro cliente.
 *
 * ── Y LO QUE EL `do update` NO PISA ─────────────────────────────────────────
 *
 * `sello_setter_id`, `sello_setter_el`, `etapa`, `score` y `responsable_id` no están en el
 * `set`. Son datos NUESTROS, no de GoHighLevel: pisarlos en cada sincronización borraría la
 * atribución del setter y el trabajo hecho acá. El sello además tiene un disparador que lo
 * protege, así que esto es el cinturón además del tirante.
 */
async function guardar(c: ContactoDeGhl, territorio: Territorio): Promise<true | string> {
  const nombre = nombreDe(c);
  // La columna `nombre` es obligatoria. Un contacto sin nombre se saltea CON MOTIVO en vez de
  // entrar como "Sin nombre", que después se lee como si fuera su nombre.
  if (!nombre) return 'el contacto no trae ningún nombre';
  if (!c.id) return 'el contacto no trae identificador';

  const valores = {
    ghl_contact_id: c.id,
    nombre,
    telefono: c.phone ?? null,
    email: c.email ?? null,
    // Las etiquetas completas, tal como vienen. Sirven para diagnosticar por qué un contacto
    // cayó donde cayó, que es la primera pregunta cuando alguien dice "éste no va acá".
    etiquetas: c.tags ?? [],
    territorio,
    // `source` es texto libre que pone quien creó el contacto. Cuando no viene se deja que la
    // base ponga su valor de reserva: el `11` § 7.1 exige que ninguna fila quede sin chip de
    // fuente, y la reserva vive en la base para que no dependa de este archivo.
    ...(c.source ? { fuente: c.source } : {}),
    sincronizado_el: sql<Date>`now()`,
  };

  await datos()
    .insertInto('contactos')
    .values(valores as never)
    .onConflict((oc) =>
      // Por las DOS columnas, que es como está declarado el único. Nombrar solo
      // `ghl_contact_id` haría que PostgreSQL no encontrara el índice y el `insert` fallara
      // con `42P10` — un error de forma, no de datos, y por eso fácil de no ver hasta que se
      // corre contra una base real.
      oc.columns(['org_id', 'ghl_contact_id']).doUpdateSet({
        nombre: valores.nombre,
        telefono: valores.telefono,
        email: valores.email,
        etiquetas: valores.etiquetas,
        territorio: valores.territorio,
        ...(c.source ? { fuente: c.source } : {}),
        sincronizado_el: valores.sincronizado_el,
      } as never),
    )
    .execute();

  return true;
}
