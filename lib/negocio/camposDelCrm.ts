// El catálogo de campos personalizados de GoHighLevel, espejado en nuestra base.
//
// ═══════════════════════════════════════════════════════════════════════════════
// POR QUÉ HAY UN CATÁLOGO Y NO SE PIDE AL MOSTRAR
//
// Los valores llegan pegados al contacto —`[{id, value}]`— y no dicen cómo se llama cada campo ni
// a qué carpeta pertenece. Eso está en el catálogo de la subcuenta, que es **una llamada aparte**.
//
// Resolverlo al abrir cada ficha costaría una llamada por apertura para leer 170 definiciones que
// no cambian en semanas. La ficha ya tiene su llamada —la de refrescar el contacto— y el archivo
// que la documenta dice por qué es la única: *«todo lo que la ficha muestra sale de la caché»*.
// Este archivo es lo que hace que eso siga siendo cierto con los campos nuevos adentro.
//
// ── EL TOPE DE UN DÍA, Y LO QUE CUESTA DE VERDAD ────────────────────────────
//
// El catálogo se relee como mucho una vez cada `FRESCURA_MS`. Es una llamada por día por empresa,
// y el número está acá y no repartido: `sincronizarContactos` lo suma a `Resumen.llamadas`, que es
// la columna con la que se mira si el trabajo automático se come el presupuesto del proveedor.
//
// Sin el tope, cada corrida del cron pagaría esa llamada —y las de los nombres de carpeta— para
// releer lo mismo. Es el defecto que la 013 describe: *«no rompe nada y gasta presupuesto
// indefinidamente»*.
//
// ── LAS CARPETAS SE PIDEN UNA POR UNA, Y SOLO LAS QUE FALTAN ────────────────
//
// GoHighLevel no las lista (las cuatro formas probadas están en `lib/ghl/cliente.ts`). El nombre
// solo se consigue pidiendo la carpeta por su id. Así que se piden **solo las que todavía no
// tienen nombre guardado**: 24 la primera vez, 0 después.
//
// Que la condición sea «nombre nulo» y no «carpeta desconocida» es deliberado. El nombre es la
// parte que puede fallar sola —un 500 del proveedor, un permiso— y con «desconocida» esa carpeta
// se quedaría sin nombre **para siempre**, con su fila ya escrita y nadie volviendo a preguntar.
// Así, un fallo se reintenta a la vuelta del día y se arregla solo.
//
// ── Y HAY UNA CARPETA QUE NO EXISTE. MEDIDO. ────────────────────────────────
//
// De las 24, la `SU7G44jzFy1XJKZ7aY31` responde **404 «The custom field id or field_key is
// invalid»**: la borraron en GoHighLevel y un campo quedó apuntándole. Su nombre nunca se va a
// poder leer, y esa es la razón concreta por la que `carpetas_del_crm.nombre` admite nulos: sin
// eso, o se inventaba un nombre, o el campo que la referencia no tenía dónde engancharse y la
// clave foránea lo dejaba afuera del catálogo. Cuesta una llamada por día y no molesta a nadie
// —esa carpeta no tiene grupo, así que sus campos no se muestran—.
//
// ── QUÉ CARPETAS SE MUESTRAN, Y POR QUÉ NO LO DECIDE UNA MIGRACIÓN ──────────
//
// Lo dice `CARPETAS_DEL_PERFIL` en `lib/ghl/contrato.ts`, y se aplica **solo a la carpeta que nace**
// —ver `refrescarCatalogoDeCampos`—. No está en una migración porque ninguna migración de este
// proyecto puede escribir datos por organización: el migrador ve cero filas de
// `identidad.organizaciones` por la RLS forzada, y no puede asumir otro rol. Se midió, y está
// contado en `db/migraciones/039_campos_del_crm.sql`.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { camposPersonalizados, nombreDeCarpeta } from '../ghl/cliente.ts';
import { CARPETAS_DEL_PERFIL, ETIQUETAS_CORTAS } from '../ghl/contrato.ts';

/**
 * Cuánto vale el catálogo antes de releerlo. **Un día.**
 *
 * No es un número redondo por gusto: los campos personalizados los cambia una persona editando
 * formularios, no un proceso. Entre que alguien agrega un campo en el CRM y que aparezca en el
 * Perfil puede pasar hasta un día, y eso es aceptable — lo que no lo sería es que un campo nuevo
 * no apareciera **nunca**, que es lo que pasaría sin ningún refresco.
 */
export const FRESCURA_MS = 24 * 60 * 60 * 1000;

/** Lo que costó y lo que dejó una lectura del catálogo. */
export interface ResumenDelCatalogo {
  /** Llamadas a GoHighLevel: 1 por el catálogo, más 1 por cada carpeta sin nombre. */
  llamadas: number;
  /** Cuántas definiciones de campo quedaron escritas. */
  campos: number;
  /** Cuántas carpetas nuevas se descubrieron. Nacen con `grupo` nulo: **no se muestran**. */
  carpetasNuevas: number;
  /**
   * `true` si no se leyó nada porque el catálogo todavía está fresco.
   *
   * Se informa en vez de devolver un cero mudo: un `llamadas: 0` con `saltado: false` significaría
   * que la lectura ocurrió y no costó nada, que no puede pasar.
   */
  saltado: boolean;
}

/**
 * Refresca el catálogo si hace falta. `null` = no se pudo leer del CRM.
 *
 * `null` y un resumen con `campos: 0` NO son lo mismo, y por eso no se colapsan: el primero manda a
 * revisar el alcance del token —leer campos personalizados puede necesitar un permiso que la
 * búsqueda de contactos no necesita— y el segundo dice que la subcuenta no tiene ninguno.
 *
 * Se corre dentro de `conOrganizacion(`: no recibe ni escribe `orgId`. Lo inyecta la capa fina.
 */
export async function refrescarCatalogoDeCampos(acceso: {
  token: string;
  locationId: string;
}): Promise<ResumenDelCatalogo | null> {
  if (await estaFresco()) {
    return { llamadas: 0, campos: 0, carpetasNuevas: 0, saltado: true };
  }

  const definiciones = await camposPersonalizados(acceso);
  if (definiciones === null) return null;
  let llamadas = 1;

  // ── LAS CARPETAS PRIMERO, QUE ES UN REQUISITO DE LA BASE ─────────────────
  //
  // `campos_del_crm` tiene una clave foránea `(org_id, carpeta_id)` hacia `carpetas_del_crm`. No es
  // decoración: `aplicar_aislamiento` la exige con `org_id` de los dos lados para que una fila
  // propia no pueda apuntar a la carpeta de otra organización. La consecuencia práctica es este
  // orden, y escribir al revés falla con un `23503` en vez de dejar campos huérfanos.
  const conocidas = await datos()
    .selectFrom('carpetas_del_crm')
    .select(['carpeta_id', 'nombre'])
    .execute();
  const yaEstan = new Map(conocidas.map((c) => [c.carpeta_id, c.nombre]));

  const carpetas = [...new Set(definiciones.map((d) => d.carpetaId))];
  let carpetasNuevas = 0;

  for (const carpetaId of carpetas) {
    const conocida = yaEstan.has(carpetaId);
    if (!conocida) carpetasNuevas += 1;

    // Solo se pide el nombre de las que no lo tienen. Ver el encabezado: es lo que hace que la
    // segunda corrida cueste cero, y también lo que le da nombre a las cuatro que sembró la 039.
    let nombre = yaEstan.get(carpetaId) ?? null;
    if (nombre === null) {
      nombre = await nombreDeCarpeta(acceso, carpetaId);
      llamadas += 1;
    }

    /* ── EL GRUPO SOLO SE PONE AL DESCUBRIRLA ─────────────────────────────
     *
     * `CARPETAS_DEL_PERFIL` dice cuáles se muestran, y se consulta **únicamente para la fila que
     * nace**. Ninguna carpeta que ya exista cambia de grupo por volver a sincronizar.
     *
     * Es deliberado y es la única forma de que una decisión tomada en producción sobreviva: alguien
     * que ponga el grupo en nulo para esconder una carpeta —o que le ponga uno a una carpeta que el
     * contrato no lista— lo vería revertido en la sincronización siguiente. Un cambio que se
     * deshace solo unas horas después es peor que uno que no se puede hacer. */
    await datos()
      .insertInto('carpetas_del_crm')
      .values({
        carpeta_id: carpetaId,
        nombre,
        grupo: CARPETAS_DEL_PERFIL.find((c) => c.id === carpetaId)?.grupo ?? null,
        visto_el: sql<Date>`now()`,
      } as never)
      .onConflict((oc) =>
        oc.columns(['org_id', 'carpeta_id']).doUpdateSet({
          /* El `grupo` NO está acá, y es la mitad importante de esta tabla: es la única columna que
             decidimos nosotros. Pisarla en cada refresco borraría la elección de qué se muestra, y
             el síntoma sería que el Perfil se vacía solo después de sincronizar. */
          nombre,
          visto_el: sql<Date>`now()`,
        } as never),
      )
      .execute();
  }

  for (const d of definiciones) {
    await datos()
      .insertInto('campos_del_crm')
      .values({
        campo_id: d.id,
        nombre: d.nombre,
        etiqueta_corta: ETIQUETAS_CORTAS[d.id] ?? null,
        carpeta_id: d.carpetaId,
        tipo: d.tipo,
        posicion: d.posicion,
        visto_el: sql<Date>`now()`,
      } as never)
      .onConflict((oc) =>
        oc.columns(['org_id', 'campo_id']).doUpdateSet({
          /* `carpeta_id` SÍ se pisa: un campo que alguien mueve a otra carpeta en el CRM tiene que
             seguir a su carpeta, y si eso lo saca de las que se muestran, deja de verse. Es lo
             correcto — la regla de `sincronizar.ts`: lo que decide GoHighLevel se pisa. */
          nombre: d.nombre,
          /* `etiqueta_corta` solo se llena si está VACÍA. Lo escrito a mano gana y sobrevive a todos
             los refrescos siguientes; el contrato solo cubre el hueco.
             Un `set` a secas la pisaría en cada corrida —una corrección hecha en producción duraría
             hasta la sincronización siguiente— y no ponerla nunca dejaría los siete campos largos
             de Meta sin acortar para siempre, porque sus filas ya existen. */
          etiqueta_corta: sql`coalesce(campos_del_crm.etiqueta_corta, ${ETIQUETAS_CORTAS[d.id] ?? null})`,
          carpeta_id: d.carpetaId,
          tipo: d.tipo,
          posicion: d.posicion,
          visto_el: sql<Date>`now()`,
        } as never),
      )
      .execute();
  }

  /* ── LO QUE SE BORRÓ EN EL CRM NO SE BORRA ACÁ, Y NO HACE FALTA ────────────
   *
   * Un campo eliminado en GoHighLevel deja su fila de catálogo acá. No molesta: sus valores también
   * desaparecen de los contactos, así que nunca se dibuja nada — el Perfil solo muestra campos con
   * valor.
   *
   * Borrarlos tendría un riesgo real y ninguna ganancia: si esta lectura alguna vez volviera
   * incompleta —una paginación que hoy no existe, un 200 a medias—, la resta vaciaría el catálogo
   * entero y el Perfil de toda la empresa perdería sus campos sin que nada fallara. Es la misma
   * trampa que `congelarLosQueYaNoEstan` documenta, y ahí sí hizo falta pagarla con dos guardas. */

  return { llamadas, campos: definiciones.length, carpetasNuevas, saltado: false };
}

/** `true` si el catálogo se leyó hace menos de `FRESCURA_MS`. */
async function estaFresco(): Promise<boolean> {
  const r = await datos()
    .selectFrom('campos_del_crm')
    .select(({ fn }) => fn.max('visto_el').as('ultimo'))
    .executeTakeFirst();

  const ultimo = r?.ultimo ?? null;
  // Sin ninguna fila, `max` devuelve nulo y hay que leer. Un catálogo vacío no es un catálogo
  // fresco: es uno que nunca se leyó, y son los dos casos en los que la pantalla dice cosas
  // distintas (ver `FALTA.perfil` en `ficha.ts`).
  if (ultimo === null) return false;
  return Date.now() - new Date(ultimo).getTime() < FRESCURA_MS;
}

/** Un campo del catálogo, ya resuelto a lo que la pantalla necesita. */
export interface CampoMostrable {
  campoId: string;
  /** La etiqueta corta si la hay; si no, el nombre de GoHighLevel. */
  etiqueta: string;
  grupo: 'detalles' | 'origen' | 'calificacion' | 'interacciones';
}

/**
 * Los campos que SE MUESTRAN, en el orden en que van dibujados.
 *
 * El filtro es `grupo is not null` sobre la carpeta, que es donde vive la decisión. Una carpeta
 * nueva en el CRM no aparece acá hasta que alguien le ponga grupo: el lado correcto del que fallar
 * —ver la migración 039—, porque al revés una carpeta de pruebas del CRM se dibujaría sola en la
 * pantalla del closer.
 *
 * Ordenado por nombre de carpeta y después por la posición del campo dentro de ella: es lo que
 * mantiene juntas las preguntas de un mismo formulario. Las carpetas sin nombre van al final, que
 * es donde PostgreSQL manda los nulos al ordenar ascendente.
 */
export async function camposQueSeMuestran(): Promise<CampoMostrable[]> {
  const filas = await datos()
    .selectFrom('campos_del_crm as ca')
    /* El `org_id` va en el `onRef` para que el `join` sea el mismo par que la clave foránea. NO es
       lo que aísla —eso lo hace la política de fila, que ya redujo las dos tablas antes de que esto
       corra, y el arnés de mutación de `136` lo confirma: sacarlo no rompe ninguna prueba—. Está
       porque un `join` que no coincide con la clave declarada invita a leerlo como si uniera cosas
       de organizaciones distintas, y eso es lo que hay que poder descartar de un vistazo. */
    .innerJoin('carpetas_del_crm as cp', (j) =>
      j.onRef('cp.org_id', '=', 'ca.org_id').onRef('cp.carpeta_id', '=', 'ca.carpeta_id'),
    )
    .select(['ca.campo_id', 'ca.nombre', 'ca.etiqueta_corta', 'cp.grupo', 'cp.nombre as carpeta'])
    .where('cp.grupo', 'is not', null)
    .orderBy('cp.nombre')
    .orderBy('ca.posicion')
    .execute();

  return filas.map((f) => ({
    campoId: f.campo_id,
    // La corta gana cuando existe (`04` § 2: la etiqueta, no la pregunta entera). Cuando no,
    // el nombre de GoHighLevel — que para la mitad de los campos ya es corto.
    etiqueta: f.etiqueta_corta ?? f.nombre,
    grupo: f.grupo as CampoMostrable['grupo'],
  }));
}

/** Cuántas definiciones tiene el catálogo. `0` = nunca se leyó. */
export async function hayCatalogo(): Promise<boolean> {
  const r = await datos()
    .selectFrom('campos_del_crm')
    .select(({ fn }) => fn.countAll().as('n'))
    .executeTakeFirst();
  return Number(r?.n ?? 0) > 0;
}
