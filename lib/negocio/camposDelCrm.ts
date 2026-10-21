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
// Lo dice `CARPETAS_DEL_PERFIL` en `lib/ghl/contrato.ts`, y se aplica **solo a la carpeta que nace** —ver
// `refrescarCatalogoDeCampos`—; desde la `098` también lo elige una persona, cliente por cliente, en Ajustes ›
// Clientes (`elegirLosGrupos`). No está en una migración porque ninguna puede escribir datos por organización: el
// migrador ve cero filas de `identidad.organizaciones` por la RLS forzada, y no puede asumir otro rol. Se midió, y
// está contado en `db/migraciones/039_campos_del_crm.sql`.
// ═══════════════════════════════════════════════════════════════════════════════

import { sql, type RawBuilder } from 'kysely';
import { datos } from '../datos/contexto.ts';
import { camposPersonalizados, nombreDeCarpeta } from '../ghl/cliente.ts';
import { CAMPO_DEL_PUNTAJE, CARPETAS_DEL_PERFIL, ETIQUETAS_CORTAS, NOMBRE_DEL_PUNTAJE, type CarpetaDelPerfil } from '../ghl/contrato.ts';

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

    /* ── EL GRUPO SE PONE AL DESCUBRIRLA, O CUANDO LLEGA TARDE SU NOMBRE ──
     *
     * `CARPETAS_DEL_PERFIL` dice cuáles se muestran, y se consulta para la fila que nace y para una sin
     * nombre ni grupo que nadie eligió cuando su nombre por fin llega (`grupoQueLlegaTarde`). Nada más.
     *
     * Es deliberado y es la única forma de que una decisión de una persona sobreviva: quien esconda una
     * carpeta —o le ponga grupo a una que el contrato no lista— en Ajustes › Clientes (`grupo_elegido_el`)
     * lo vería revertido en la sincronización siguiente. Un cambio que se deshace solo unas horas después
     * es peor que uno que no se puede hacer. */
    await datos()
      .insertInto('carpetas_del_crm')
      .values({
        carpeta_id: carpetaId,
        nombre,
        grupo: grupoDeLaCarpeta(carpetaId, nombre),
        visto_el: sql<Date>`now()`,
      } as never)
      .onConflict((oc) =>
        oc.columns(['org_id', 'carpeta_id']).doUpdateSet({
          /* El `grupo` sólo cambia si la carpeta no tenía nombre, ni grupo, ni elección: es nuestro. Pisarlo
             en cada refresco borraría la elección de qué se muestra, y el síntoma sería que el Perfil se
             vacía solo después de sincronizar. Ver `grupoQueLlegaTarde`. */
          nombre, grupo: grupoQueLlegaTarde(carpetaId, nombre),
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

/**
 * El identificador de un campo del CRM **por su nombre**, sin pasar por el filtro de carpetas.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * POR QUÉ NO SIRVE `camposQueSeMuestran` PARA ESTO, Y POR QUÉ ESTO NO ES UN ATAJO
 *
 * Aquélla filtra por `cp.grupo is not null`, o sea por la decisión de **qué se dibuja en la ficha**.
 * Ese filtro es correcto para la pantalla y equivocado para el negocio: un campo puede ser un dato
 * que hace falta para una cifra y a la vez algo que no tiene por qué ocupar lugar en el Perfil del
 * closer.
 *
 * El caso medido que obligó a escribir esto: **`Confirmación Agendamiento`** está guardado en
 * `contactos.campos_del_crm` —178 de 584 contactos lo traen, con un vocabulario binario de `Si` y
 * `No`— y era **ilegible desde el código de negocio**, porque su carpeta está deliberadamente fuera
 * de `CARPETAS_DEL_PERFIL`. El dato estaba y no había forma de preguntarle.
 *
 * ── LA PANTALLA NO SE TOCA, Y ÉSE ES EL PUNTO ──────────────────────────────
 *
 * Esto **no** agrega la carpeta al Perfil. Son dos preguntas distintas —«qué mira una persona» y
 * «qué necesita una cifra»— y mezclarlas haría que agregar un indicador cambiara lo que el closer ve
 * en pantalla, sin que nadie lo pidiera.
 *
 * ── POR NOMBRE, Y EL PRECIO DICHO ──────────────────────────────────────────
 *
 * Los valores se guardan por identificador justamente para que renombrar un campo en el CRM no
 * congele nada (migración `039`). Acá el nombre es lo único que hay: una cifra no puede llevar
 * escrito un identificador opaco de GoHighLevel, que no se puede leer ni verificar.
 *
 * El precio es real y hay que decirlo: **si alguien renombra ese campo en el CRM, esto devuelve
 * `null`**. Por eso `null` es un valor de retorno legítimo y no una excepción, y por eso quien lo
 * usa tiene que poder decir «no sé» en vez de «cero» — que es lo que hace la cifra que lo consume.
 *
 * Comparación exacta y no `ilike`: dos campos que difieran sólo en mayúsculas son dos campos, y
 * elegir el equivocado daría una cifra plausible sobre la pregunta equivocada.
 *
 * ── UNO POR SUBCUENTA (el nivel 3) ─────────────────────────────────────────
 *
 * El identificador es de la SUBCUENTA: el mismo campo, en la subcuenta de otro cliente, tiene otro. Con la empresa
 * entera a la vista vuelven todos —uno por cliente—, y los lectores toman el que el contacto tiene
 * (`valorDelCampo`, `tieneElCampo`): los ids no se repiten entre subcuentas, así que en los campos de un contacto
 * sólo puede estar el de la suya. Con uno solo elegido, los contactos de los demás clientes contaban como «sin
 * responder» y el aviso callaba, porque el campo «estaba».
 *
 * Con `cuentaId` (C6 · D3), el de esa subcuenta sola: un detector que mide a cada cliente con lo suyo sabe así que
 * un cliente no tiene el campo, en vez de contar a su gente como «sin responder» junto a la de otro que sí lo tiene.
 *
 * Se corre dentro de `conOrganizacion(`.
 */
export async function campoPorNombre(nombre: string, cuentaId?: string): Promise<CampoDelCrm | null> {
  let consulta = datos()
    .selectFrom('campos_del_crm')
    .select(['cuenta_id', 'campo_id'])
    .where('nombre', '=', nombre);
  if (cuentaId !== undefined) consulta = consulta.where('cuenta_id', '=', cuentaId);
  const filas = await consulta
    /* El desempate estable, dentro de cada subcuenta. Dos campos con el mismo nombre en carpetas distintas son
       posibles —el CRM no lo impide— y sin orden la cifra tomaría uno u otro según cómo devolviera el motor,
       cambiando de denominador entre corridas sin que nada falle. */
    .orderBy('cuenta_id')
    .orderBy('campo_id')
    .execute();
  const porCliente = new Map<string, string>();
  for (const f of filas) if (!porCliente.has(f.cuenta_id)) porCliente.set(f.cuenta_id, f.campo_id);
  const ids = [...porCliente.values()];
  return ids.length === 0 ? null : (ids as unknown as CampoDelCrm);
}

/** Los identificadores de UN campo del CRM: uno por subcuenta a la vista. Nunca vacío. */
export type CampoDelCrm = readonly [string, ...string[]];

const losIds = (campo: string | CampoDelCrm): readonly string[] => (typeof campo === 'string' ? [campo] : campo);

/** El valor del campo en un `campos_del_crm`, con el id de la subcuenta del contacto. */
export function valorDelCampo(json: RawBuilder<unknown>, campo: string | CampoDelCrm): RawBuilder<string | null> {
  const ids = losIds(campo);
  return ids.length === 1
    ? sql<string | null>`${json} ->> ${ids[0]}`
    : sql<string | null>`coalesce(${sql.join(ids.map((id) => sql`${json} ->> ${id}`))})`;
}

/** Si un `campos_del_crm` tiene el campo, con el id de la subcuenta del contacto. */
export function tieneElCampo(json: RawBuilder<unknown>, campo: string | CampoDelCrm): RawBuilder<boolean> {
  const ids = losIds(campo);
  return ids.length === 1 ? sql<boolean>`(${json} ? ${ids[0]})` : sql<boolean>`(${json} ?| ${[...ids]}::text[])`;
}

/** Lo mismo en memoria, sobre los campos de UN contacto: el id de los suyos que tenga, o `null`. */
export function idEn(valores: Record<string, unknown>, campo: string | CampoDelCrm | null): string | null {
  if (campo === null) return null;
  return losIds(campo).find((id) => Object.hasOwn(valores, id)) ?? null;
}

/**
 * El grupo del Perfil de una carpeta que se descubre: por su id —las de la subcuenta de ARIA— o, en la subcuenta de
 * otro cliente (el nivel 3), por su nombre exacto. Los clientes nacen del mismo snapshot: la carpeta se llama igual y
 * tiene otro id, y sin esto ninguna tenía grupo y el Perfil de sus leads salía vacío.
 */
export function grupoDeLaCarpeta(carpetaId: string, nombre: string | null): CarpetaDelPerfil['grupo'] | null {
  return (
    CARPETAS_DEL_PERFIL.find((c) => c.id === carpetaId)?.grupo ??
    (nombre === null ? null : (CARPETAS_DEL_PERFIL.find((c) => c.nombre === nombre)?.grupo ?? null))
  );
}

/**
 * Los ids del campo del puntaje, para la sincronización, el refresco de la ficha y el portal: de una subcuenta con un
 * campo ELEGIDO (la `098`), ése y nada más; de las demás, lo de antes —la constante de ARIA y el primero que se llama
 * «Puntaje | ICP»—. Un contacto sólo trae los ids de su subcuenta: vale el primero que tenga. En `conOrganizacion(`.
 */
export async function camposDelPuntaje(): Promise<readonly string[]> {
  // Sin nada elegido es, id por id y en el mismo orden, `[CAMPO_DEL_PUNTAJE, ...campoPorNombre(NOMBRE_DEL_PUNTAJE)]`.
  return idsDelPuntaje(await puntajeDeCadaCliente());
}

/**
 * Cuántas definiciones tiene el catálogo. `0` = nunca se leyó. Con un cliente (el nivel 3), el de SU subcuenta: con
 * el de otro, «no se leyó su catálogo» se decía «no completó los formularios».
 */
export async function hayCatalogo(cuentaId?: string): Promise<boolean> {
  const r = await datos()
    .selectFrom('campos_del_crm')
    .select(({ fn }) => fn.countAll().as('n'))
    .$if(cuentaId !== undefined, (q) => q.where('cuenta_id', '=', cuentaId as string))
    .executeTakeFirst();
  return Number(r?.n ?? 0) > 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EL PUNTAJE Y EL PERFIL DE CADA CLIENTE, ELEGIDOS (el nivel 3, C6 · D4, la `098`)
//
// Cuál campo es el puntaje y qué carpetas se muestran se reconocían solos: por el id de la subcuenta de ARIA o por el
// nombre del snapshot. Un cliente con otros nombres se quedaba sin puntaje y sin Perfil. Desde la `098` se eligen
// cliente por cliente en Ajustes › Clientes (`app/api/admin/cuentas/[id]/campos`), y lo de antes queda de respaldo.
//
// ── CON LA CONFIGURACIÓN DE HOY NADA CAMBIA, Y ESO ES POR DISEÑO ──────────────
//
// Una subcuenta SIN campo elegido resuelve exactamente lo de antes, y no una cascada nueva: la sincronización sigue
// con la unión de la constante de ARIA y el primero que se llama «Puntaje | ICP», y Creative con el de su nombre.
// Sólo la subcuenta que tiene uno elegido usa ése y nada más; sin esa exclusión, un contacto con los dos campos
// tomaría el que quedara primero en la lista.
//
// ── UNA SOLA VALIDACIÓN DEL PUNTAJE ───────────────────────────────────────────
//
// Un puntaje es un entero de 0 a 100 escrito con dígitos. Lo dice `puntajeDeUnValor` para la sincronización y
// `puntajeUsable`, lo mismo en SQL, para Creative, el conteo de la pantalla y el recálculo. Con dos validaciones, un
// campo con decimales o con otra escala salía «Sin calificar» en Acquisition y con promedio en Creative.
//
// ── «ELEGIDA» QUIERE DECIR UNA SOLA COSA ──────────────────────────────────────
//
// Que una PERSONA la eligió: `grupo_elegido_el` no nulo. Una carpeta con el grupo del contrato «se muestra»
// (`hayCarpetasQueSeMuestran`), pero no está elegida, y ningún refresco toca a una elegida.
// ═══════════════════════════════════════════════════════════════════════════════

/** Los grupos del Perfil y su título, en el orden de la ficha. Los mismos del `check carpetas_del_crm_grupo` (`039`). */
export const GRUPOS_DEL_PERFIL: readonly { clave: CampoMostrable['grupo']; titulo: string }[] = [
  { clave: 'detalles', titulo: 'Detalles' },
  { clave: 'origen', titulo: 'Origen' },
  { clave: 'calificacion', titulo: 'Calificación' },
  { clave: 'interacciones', titulo: 'Interacciones' },
];

/** Un puntaje, escrito: de uno a tres dígitos y nada más. El tope de 100 va aparte. */
const PUNTAJE_ESCRITO = /^[0-9]{1,3}$/;

/**
 * El puntaje que trae un valor del CRM, listo para `contactos.score`: un entero de 0 a 100, o `null`.
 *
 * Es LA validación del puntaje: la sincronización la usa así, y los lectores en SQL con `puntajeUsable`, que dice lo
 * mismo con las mismas dos reglas. Por qué se valida en vez de confiar está en `puntajeDelCrm` (`sincronizar.ts`).
 *
 * Sobre el texto, y no con `Number()`: `Number` acepta ` 50`, `50.0`, `1e1` o `0x32`, que SQL no puede leer igual, y dos
 * validaciones que discrepan dan «Sin calificar» en una pantalla y un promedio en otra. Un campo NUMERICAL llega como el
 * número escrito (`68`): medido el 2026-09-21, los 471 de ARIA son enteros de 0 a 100, así que con ellos nada cambia.
 */
export function puntajeDeUnValor(crudo: unknown): number | null {
  if (typeof crudo !== 'string' && typeof crudo !== 'number') return null;
  const texto = String(crudo);
  if (!PUNTAJE_ESCRITO.test(texto)) return null;
  const n = Number(texto);
  return n <= 100 ? n : null;
}

/**
 * `puntajeDeUnValor` en SQL: el valor como entero de 0 a 100, o nulo. Dos `case` anidados y no un `and`: PostgreSQL no
 * promete evaluar el `~` antes que el `::int`, y un texto en el campo lanzaría `22P02` y se llevaría la consulta entera.
 */
export function puntajeUsable(valor: RawBuilder<string | null>): RawBuilder<number | null> {
  return sql<number | null>`(case when ${valor} ~ '^[0-9]{1,3}$' then case when (${valor})::int <= 100 then (${valor})::int end end)`;
}

/** El puntaje usable de un `campos_del_crm`, con el id de la subcuenta del contacto. */
export function puntajeDelCampo(json: RawBuilder<unknown>, campo: string | CampoDelCrm): RawBuilder<number | null> {
  return puntajeUsable(valorDelCampo(json, campo));
}

/** Una fila del catálogo que puede ser el puntaje de un cliente. */
export interface FilaDelPuntaje {
  campoId: string;
  nombre: string;
  tipo: string;
  vistoEl: Date;
}

/** Lo que el catálogo de UN cliente dice de su puntaje. Una subcuenta sin ninguna de las tres no tiene campo. */
export interface PuntajeDelCliente {
  /** El elegido en Ajustes › Clientes. Con él, las otras dos no cuentan. */
  elegido: FilaDelPuntaje | null;
  /** La fila de `CAMPO_DEL_PUNTAJE`, si es de esta subcuenta (la de ARIA). */
  constante: FilaDelPuntaje | null;
  /** El primero que se llama exactamente «Puntaje | ICP», con el desempate de `campoPorNombre` (por `campo_id`). */
  porNombre: FilaDelPuntaje | null;
}

/**
 * El campo del puntaje de cada cliente a la vista, por `cuenta_id` y en ese orden. Una sola consulta: el elegido, la
 * constante de ARIA y los que se llaman «Puntaje | ICP». Corre dentro de `conOrganizacion(`.
 */
export async function puntajeDeCadaCliente(): Promise<Map<string, PuntajeDelCliente>> {
  const filas = await datos()
    .selectFrom('campos_del_crm')
    .select(['cuenta_id', 'campo_id', 'nombre', 'tipo', 'es_el_puntaje', 'visto_el'])
    .where((eb) =>
      eb.or([eb('es_el_puntaje', '=', true), eb('nombre', '=', NOMBRE_DEL_PUNTAJE), eb('campo_id', '=', CAMPO_DEL_PUNTAJE)]),
    )
    .orderBy('cuenta_id')
    .orderBy('campo_id')
    .execute();
  const porCliente = new Map<string, PuntajeDelCliente>();
  for (const f of filas) {
    const c = porCliente.get(f.cuenta_id) ?? { elegido: null, constante: null, porNombre: null };
    const fila: FilaDelPuntaje = { campoId: f.campo_id, nombre: f.nombre, tipo: f.tipo, vistoEl: f.visto_el };
    if (f.es_el_puntaje) c.elegido = fila;
    if (f.campo_id === CAMPO_DEL_PUNTAJE) c.constante = fila;
    if (f.nombre === NOMBRE_DEL_PUNTAJE && c.porNombre === null) c.porNombre = fila;
    porCliente.set(f.cuenta_id, c);
  }
  return porCliente;
}

/**
 * Los ids de `camposDelPuntaje`. La constante de ARIA va primera, como siempre, salvo que su subcuenta tenga otro
 * elegido; y va también sin catálogo, que es lo que ejercita la `98`. Después, el de cada cliente: su elegido, o el
 * primero por su nombre. El orden entre clientes no importa: un contacto sólo trae los ids de su subcuenta.
 */
function idsDelPuntaje(porCliente: Map<string, PuntajeDelCliente>): readonly string[] {
  const deLaConstante = [...porCliente.values()].find((c) => c.constante !== null);
  const ids: string[] = deLaConstante?.elegido ? [] : [CAMPO_DEL_PUNTAJE];
  for (const c of porCliente.values()) {
    const id = (c.elegido ?? c.porNombre)?.campoId;
    if (id !== undefined) ids.push(id);
  }
  return [...new Set(ids)];
}

/**
 * El campo del puntaje para Creative: el elegido de cada cliente o, si no hay, el primero que se llama «Puntaje | ICP».
 * Sólo ids del catálogo, sin la constante: `null` = ningún cliente a la vista tiene campo, y apaga la columna con su
 * aviso. Sin nada elegido es `campoPorNombre(NOMBRE_DEL_PUNTAJE)`, lo que Creative leía hasta la `098`.
 */
export async function campoDelPuntaje(): Promise<CampoDelCrm | null> {
  const ids = [...(await puntajeDeCadaCliente()).values()].flatMap((c) => {
    const f = c.elegido ?? c.porNombre;
    return f === null ? [] : [f.campoId];
  });
  return ids.length === 0 ? null : (ids as unknown as CampoDelCrm);
}

/** Un cliente sin campo del puntaje. `catalogo` separa «no se leyó su catálogo» de «se leyó y no tiene campo». */
export interface ClienteSinPuntaje {
  cuentaId: string;
  nombre: string;
  catalogo: boolean;
}

/**
 * De esos clientes, los que no tienen campo del puntaje —ni elegido ni llamado «Puntaje | ICP»—, por nombre. Los dos
 * estados no son el mismo: sin catálogo no hay nada que elegir todavía (se lee con la sincronización de contactos), y
 * con catálogo lo que falta es una elección. Corre dentro de `conOrganizacion(`.
 */
export async function clientesSinPuntaje(cuentaIds: readonly string[]): Promise<ClienteSinPuntaje[]> {
  if (cuentaIds.length === 0) return [];
  const conCampo = await puntajeDeCadaCliente();
  const sin = [...new Set(cuentaIds)].filter((id) => {
    const c = conCampo.get(id);
    return (c?.elegido ?? c?.porNombre ?? null) === null;
  });
  if (sin.length === 0) return [];
  const filas = await datos()
    .selectFrom('cuentas')
    .select([
      'id',
      'nombre',
      sql<boolean>`exists (select 1 from negocio.campos_del_crm ca where ca.org_id = cuentas.org_id and ca.cuenta_id = cuentas.id)`.as('catalogo'),
    ])
    .where('id', 'in', sin)
    .orderBy('nombre')
    .orderBy('id')
    .execute();
  return filas.map((f) => ({ cuentaId: f.id, nombre: f.nombre, catalogo: f.catalogo }));
}

/**
 * Si alguna carpeta de la subcuenta de ese cliente se muestra en el Perfil (`grupo` no nulo), la haya elegido una
 * persona o el contrato. Es la pregunta del tercer «falta» de la ficha: con catálogo y ninguna, el Perfil no puede
 * mostrar nada y no es culpa del contacto.
 */
export async function hayCarpetasQueSeMuestran(cuentaId: string): Promise<boolean> {
  const r = await datos()
    .selectFrom('carpetas_del_crm')
    .select('carpeta_id')
    .where('cuenta_id', '=', cuentaId)
    .where('grupo', 'is not', null)
    .limit(1)
    .executeTakeFirst();
  return r !== undefined;
}

/**
 * El `grupo` del refresco para una carpeta que ya existe: sólo si NO tenía nombre, ni grupo, ni elección, y su nombre
 * llega ahora, toma el del contrato (`grupoDeLaCarpeta`, por id o por nombre). En cualquier otro caso queda el suyo.
 * Las referencias a `carpetas_del_crm` son la fila de antes: es un `on conflict do update`.
 */
function grupoQueLlegaTarde(carpetaId: string, nombre: string | null): RawBuilder<unknown> {
  if (nombre === null) return sql`carpetas_del_crm.grupo`;
  return sql`case when carpetas_del_crm.nombre is null and carpetas_del_crm.grupo is null
                   and carpetas_del_crm.grupo_elegido_el is null
              then ${grupoDeLaCarpeta(carpetaId, nombre)}::text else carpetas_del_crm.grupo end`;
}

// ─── Lo que ve y elige Ajustes › Clientes ───────────────────────────────────

/** Un campo que se puede elegir como puntaje: un NUMERICAL del catálogo del cliente, o el elegido aunque ya no lo sea. */
export interface OpcionDelPuntaje {
  campoId: string;
  nombre: string;
  /** El nombre de su carpeta. `null` = la carpeta no tiene nombre leído. */
  carpeta: string | null;
  tipo: string;
  /** El elegido dejó de ser NUMERICAL en GoHighLevel. La elección sigue, y sus valores siguen pasando por la validación. */
  yaNoEsNumerico: boolean;
  /** Cuántos contactos del cliente traen algo en ese campo. */
  conValor: number;
  /** Cuántos traen un puntaje usable (`puntajeUsable`): los que dejarían de quedar «Sin calificar». */
  usables: number;
}

/** El catálogo de UN cliente, como lo muestra y lo devuelve la ruta. */
export interface CatalogoDelCliente {
  /** `leido: false` = nunca se leyó su catálogo: no hay nada que elegir todavía. `vistoEl` = la última lectura. */
  catalogo: { leido: boolean; vistoEl: string | null };
  puntaje: {
    /** `elegido` en Ajustes › Clientes; `por_omision` = la constante de ARIA o por su nombre; `ninguno` = no tiene. */
    origen: 'elegido' | 'por_omision' | 'ninguno';
    campoId: string | null;
    nombre: string | null;
    tipo: string | null;
    yaNoEsNumerico: boolean;
    /**
     * El elegido no vino en la última lectura del catálogo: lo borraron en GoHighLevel, o el cliente se vinculó a otra
     * subcuenta. El catálogo no borra filas, así que la elección sigue viva y sus leads quedan «Sin calificar».
     */
    noVistoEnLaUltimaLectura: boolean;
  };
  opciones: OpcionDelPuntaje[];
  carpetas: {
    carpetaId: string;
    nombre: string | null;
    grupo: CampoMostrable['grupo'] | null;
    /** La eligió una persona (`grupo_elegido_el`). Una con el grupo del contrato se muestra y no está elegida. */
    elegida: boolean;
    /** Cuántos campos del catálogo tiene. */
    campos: number;
  }[];
  /** Los grupos válidos, con su título: la pantalla no tiene lista propia. */
  grupos: typeof GRUPOS_DEL_PERFIL;
}

/** Lo que Ajustes › Clientes muestra del catálogo de un cliente. Corre con el foco en ese cliente. */
export async function catalogoDelCliente(cuentaId: string): Promise<CatalogoDelCliente> {
  const [lectura, deCadaCliente, opciones, carpetas] = await Promise.all([
    datos()
      .selectFrom('campos_del_crm')
      .select(({ fn }) => [fn.max('visto_el').as('ultimo'), fn.countAll().as('n')])
      .where('cuenta_id', '=', cuentaId)
      .executeTakeFirst(),
    puntajeDeCadaCliente(),
    datos()
      .selectFrom('campos_del_crm as ca')
      .leftJoin('carpetas_del_crm as cp', (j) => j.onRef('cp.org_id', '=', 'ca.org_id').onRef('cp.carpeta_id', '=', 'ca.carpeta_id'))
      .select([
        'ca.campo_id',
        'ca.nombre',
        'ca.tipo',
        'cp.nombre as carpeta',
        sql<number>`(select count(*) from negocio.contactos c
                      where c.org_id = ca.org_id and c.cuenta_id = ca.cuenta_id and c.campos_del_crm ? ca.campo_id)`.as('conValor'),
        sql<number>`(select count(*) from negocio.contactos c
                      where c.org_id = ca.org_id and c.cuenta_id = ca.cuenta_id
                        and ${puntajeUsable(sql`c.campos_del_crm ->> ca.campo_id`)} is not null)`.as('usables'),
      ])
      .where('ca.cuenta_id', '=', cuentaId)
      .where((eb) => eb.or([eb('ca.tipo', '=', 'NUMERICAL'), eb('ca.es_el_puntaje', '=', true)]))
      .orderBy('ca.nombre')
      .orderBy('ca.campo_id')
      .execute(),
    datos()
      .selectFrom('carpetas_del_crm as cp')
      .select([
        'cp.carpeta_id',
        'cp.nombre',
        'cp.grupo',
        'cp.grupo_elegido_el',
        sql<number>`(select count(*) from negocio.campos_del_crm ca where ca.org_id = cp.org_id and ca.carpeta_id = cp.carpeta_id)`.as('campos'),
      ])
      .where('cp.cuenta_id', '=', cuentaId)
      .orderBy('cp.nombre')
      .orderBy('cp.carpeta_id')
      .execute(),
  ]);

  const ultimo = lectura?.ultimo ? new Date(lectura.ultimo) : null;
  const c = deCadaCliente.get(cuentaId);
  const elegido = c?.elegido ?? null;
  // Sin elegido, el que la sincronización prefiere: la constante si es de esta subcuenta, si no el de su nombre.
  const resuelto = elegido ?? c?.constante ?? c?.porNombre ?? null;
  return {
    catalogo: { leido: Number(lectura?.n ?? 0) > 0, vistoEl: ultimo?.toISOString() ?? null },
    puntaje: {
      origen: elegido ? 'elegido' : resuelto ? 'por_omision' : 'ninguno',
      campoId: resuelto?.campoId ?? null,
      nombre: resuelto?.nombre ?? null,
      tipo: resuelto?.tipo ?? null,
      yaNoEsNumerico: elegido !== null && elegido.tipo !== 'NUMERICAL',
      noVistoEnLaUltimaLectura: elegido !== null && ultimo !== null && new Date(elegido.vistoEl).getTime() < ultimo.getTime(),
    },
    opciones: opciones.map((o) => ({
      campoId: o.campo_id,
      nombre: o.nombre,
      carpeta: o.carpeta ?? null,
      tipo: o.tipo,
      yaNoEsNumerico: o.tipo !== 'NUMERICAL',
      conValor: Number(o.conValor ?? 0),
      usables: Number(o.usables ?? 0),
    })),
    carpetas: carpetas.map((f) => ({
      carpetaId: f.carpeta_id,
      nombre: f.nombre,
      grupo: f.grupo,
      elegida: f.grupo_elegido_el !== null,
      campos: Number(f.campos ?? 0),
    })),
    grupos: GRUPOS_DEL_PERFIL,
  };
}

/** Lo que una persona elige para un cliente: el campo del puntaje (`null` = volver al de su nombre), y carpetas. */
export interface EleccionDelCatalogo {
  puntaje?: string | null;
  carpetas?: readonly { carpetaId: string; grupo: CampoMostrable['grupo'] | null }[];
}

/**
 * Por qué no se puede guardar esa elección en el catálogo de ESE cliente, o `null`. Se valida todo antes de escribir
 * nada: un campo que no está en su catálogo (de otro cliente, o inventado) o que no es NUMERICAL, y una carpeta ajena.
 */
export async function porQueNoSePuedeElegir(cuentaId: string, e: EleccionDelCatalogo): Promise<string | null> {
  if (typeof e.puntaje === 'string') {
    const campo = await datos()
      .selectFrom('campos_del_crm')
      .select(['nombre', 'tipo'])
      .where('cuenta_id', '=', cuentaId)
      .where('campo_id', '=', e.puntaje)
      .executeTakeFirst();
    if (!campo) return `El campo «${e.puntaje}» no está en el catálogo de campos de este cliente.`;
    if (campo.tipo !== 'NUMERICAL') {
      return `«${campo.nombre}» es un campo ${campo.tipo}: el puntaje tiene que ser un campo numérico (NUMERICAL) de 0 a 100.`;
    }
  }
  if (e.carpetas !== undefined && e.carpetas.length > 0) {
    const ids = e.carpetas.map((c) => c.carpetaId);
    const suyas = new Set(
      (await datos().selectFrom('carpetas_del_crm').select('carpeta_id').where('cuenta_id', '=', cuentaId).where('carpeta_id', 'in', ids).execute()).map(
        (f) => f.carpeta_id,
      ),
    );
    const ajena = ids.find((id) => !suyas.has(id));
    if (ajena !== undefined) return `La carpeta «${ajena}» no está en el catálogo de campos de este cliente.`;
  }
  return null;
}

/**
 * Elige el campo del puntaje de un cliente (`null` = ninguno: vuelve al de su nombre). `true` si cambió algo.
 *
 * Primero apaga el elegido anterior y después prende el nuevo: el índice único de la `098` no es diferible, y al revés
 * chocaría consigo mismo. Dos elecciones al mismo tiempo: la segunda sale `23505`, y la ruta la responde 409. El nuevo
 * se prende sólo si es NUMERICAL. No toca `visto_el`: si lo tocara, el catálogo parecería recién leído y no se releería.
 */
export async function elegirElPuntaje(cuentaId: string, campoId: string | null): Promise<boolean> {
  const antes = await datos()
    .selectFrom('campos_del_crm')
    .select('campo_id')
    .where('cuenta_id', '=', cuentaId)
    .where('es_el_puntaje', '=', true)
    .executeTakeFirst();
  if ((antes?.campo_id ?? null) === campoId) return false;
  await datos()
    .updateTable('campos_del_crm')
    .set({ es_el_puntaje: false })
    .where('cuenta_id', '=', cuentaId)
    .where('es_el_puntaje', '=', true)
    .execute();
  if (campoId === null) return true;
  const r = await datos()
    .updateTable('campos_del_crm')
    .set({ es_el_puntaje: true })
    .where('cuenta_id', '=', cuentaId)
    .where('campo_id', '=', campoId)
    .where('tipo', '=', 'NUMERICAL')
    .executeTakeFirst();
  if (r.numUpdatedRows === 0n) throw new Error(`elegirElPuntaje: «${campoId}» no es un campo NUMERICAL del catálogo de este cliente`);
  return true;
}

/**
 * Recalcula el puntaje de TODOS los contactos de un cliente desde lo ya guardado, con el campo que resuelve ahora. Cero
 * llamadas al CRM. Sin esto, cambiar la elección corregía en diez minutos a los que la sincronización trae, y un
 * contacto congelado —que ya no trae— quedaba para siempre con el puntaje del campo anterior (o «Sin calificar», con
 * el valor en sus campos). Da lo mismo que la sincronización: el primer id que el contacto tiene, y `puntajeUsable`.
 */
export async function recalcularLosPuntajes(cuentaId: string): Promise<number> {
  const ids = (await camposDelPuntaje()) as CampoDelCrm;
  const r = await datos()
    .updateTable('contactos')
    .set({ score: puntajeDelCampo(sql`campos_del_crm`, ids) } as never)
    .where('cuenta_id', '=', cuentaId)
    .executeTakeFirst();
  return Number(r.numUpdatedRows);
}

/**
 * Elige el grupo del Perfil de unas carpetas de un cliente (`null` = no se muestra) y las marca elegidas. Devuelve las
 * que cambiaron: una ya elegida con el mismo grupo no se toca. No toca `visto_el`, por lo mismo que `elegirElPuntaje`.
 */
export async function elegirLosGrupos(
  cuentaId: string,
  carpetas: readonly { carpetaId: string; grupo: CampoMostrable['grupo'] | null }[],
): Promise<{ carpetaId: string; grupo: CampoMostrable['grupo'] | null }[]> {
  const cambiadas: { carpetaId: string; grupo: CampoMostrable['grupo'] | null }[] = [];
  for (const c of carpetas) {
    const r = await datos()
      .updateTable('carpetas_del_crm')
      .set({ grupo: c.grupo, grupo_elegido_el: sql<Date>`now()` } as never)
      .where('cuenta_id', '=', cuentaId)
      .where('carpeta_id', '=', c.carpetaId)
      .where(sql<boolean>`(grupo_elegido_el is null or grupo is distinct from ${c.grupo})`)
      .executeTakeFirst();
    if (r.numUpdatedRows > 0n) cambiadas.push(c);
  }
  return cambiadas;
}
