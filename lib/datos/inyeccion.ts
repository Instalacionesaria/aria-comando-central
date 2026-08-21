// La inyección de la organización en las escrituras.
//
// Por qué existe: sin esto, "poner la organización correcta" es una obligación
// que se reparte entre todas las llamadas a `insertInto(` del proyecto — y una
// obligación repartida se olvida en la número treinta. Acá se cumple una vez, en
// el árbol de la consulta, después de que el código de la aplicación ya escribió
// lo que quiso.
//
// Por qué SOLO en el INSERT: el filtrado de lectura y la validación de escritura
// los hacen las políticas de seguridad por fila. Si esta capa además agregara
// `where org_id = …`, habría DOS lugares que deciden lo mismo, y el día que
// discrepen gana el que nadie está mirando. La política es la autoridad; esto es
// nada más una comodidad para no repetir la columna. Que un SELECT pase intacto
// por acá es la decisión, no un olvido.
//
// Por qué PISA lo que venga: "la inyección pisa lo que venga… ante la duda gana
// la opción que hace más difícil escribir en los datos de otro". Una fila armada
// con el `org_id` ajeno —venga de un cuerpo JSON, de un objeto reusado o de un
// error de copiar y pegar— aterriza en la organización activa, no en la ajena.
// El costo es que un INSERT deliberado en otra organización es imposible por esta
// vía, y eso es exactamente lo que se quiere.

import {
  ColumnNode,
  OperationNodeTransformer,
  PrimitiveValueListNode,
  ValueListNode,
  ValueNode,
  ValuesNode,
  type InsertQueryNode,
  type KyselyPlugin,
  type PluginTransformQueryArgs,
  type PluginTransformResultArgs,
  type QueryId,
  type QueryResult,
  type RootOperationNode,
  type UnknownRow,
  type ValuesItemNode,
} from 'kysely';

/**
 * El nombre de la columna de inquilino. Uno, en un solo lugar: si algún día
 * cambia, cambia acá y no en veinte archivos.
 */
const COLUMNA = 'org_id';

/**
 * De dónde sale la organización activa.
 *
 * Es una función y no un string porque el plugin se construye una vez por
 * cliente y la organización cambia por petición. Y TIRA cuando no hay
 * organización activa en vez de devolver `null`: un INSERT sin organización no
 * tiene un valor razonable por defecto, así que la única respuesta correcta es
 * no dejar que la consulta salga. Ese error se propaga tal cual — envolverlo acá
 * escondería la única señal de que el contexto por petición no se armó.
 */
export type OrganizacionActiva = () => string;

/**
 * Reescribe una fila de valores dejando la organización activa en `indice`.
 *
 * `indice === columnasPrevias` significa "agregar al final"; cualquier otro
 * valor significa "pisar el que ya estaba". Es la misma operación en los dos
 * casos, y el `[indice] =` de JavaScript ya la hace.
 */
function conOrganizacion(
  fila: ValuesItemNode,
  indice: number,
  columnasPrevias: number,
  organizacion: string,
): ValuesItemNode {
  // Kysely normaliza el conjunto de columnas de un INSERT de varias filas y
  // rellena las que falten con `default`, así que toda fila mide exactamente lo
  // que mide la lista de columnas. Si alguna vez no mide —otro plugin que corre
  // antes, un nodo armado a mano—, escribir en `indice` metería los valores en
  // columnas equivocadas. Preferimos un error ruidoso a datos torcidos.
  if (fila.values.length !== columnasPrevias) {
    throw new Error(
      `inyeccion: fila de INSERT desalineada (valores: ${fila.values.length}, ` +
        `columnas: ${columnasPrevias}); inyectar ${COLUMNA} metería los datos en ` +
        'columnas equivocadas.',
    );
  }

  // Las dos formas que usa Kysely para una fila: valores crudos cuando la fila
  // está completa y es toda primitivos, y nodos cuando hay `default` o
  // expresiones. Hay que respetar la que vino: mezclarlas rompe el compilador.
  if (PrimitiveValueListNode.is(fila)) {
    const valores: unknown[] = [...fila.values];
    valores[indice] = organizacion;
    return PrimitiveValueListNode.create(valores);
  }

  const valores = [...fila.values];
  valores[indice] = ValueNode.create(organizacion);
  return ValueListNode.create(valores);
}

/**
 * El transformador.
 *
 * Extiende `OperationNodeTransformer` en vez de reescribir el nodo raíz a mano
 * por una razón concreta: un INSERT puede vivir DENTRO de otra consulta. Un
 * `with('nuevo', d => d.insertInto(…)).selectFrom('nuevo')` tiene un
 * `SelectQueryNode` en la raíz y el INSERT colgado del `WithNode`. Una
 * reescritura de la raíz lo dejaría pasar sin organización — justo el agujero
 * que este archivo existe para tapar. El transformador recorre el árbol entero y
 * encuentra el INSERT donde esté.
 */
class TransformadorDeOrganizacion extends OperationNodeTransformer {
  readonly #organizacionActiva: OrganizacionActiva;
  readonly #tablasExentas: ReadonlySet<string>;

  constructor(organizacionActiva: OrganizacionActiva, tablasExentas: ReadonlySet<string>) {
    super();
    this.#organizacionActiva = organizacionActiva;
    this.#tablasExentas = tablasExentas;
  }

  protected override transformInsertQuery(node: InsertQueryNode, queryId?: QueryId): InsertQueryNode {
    // Primero el padre: clona el subárbol y transforma lo anidado (el `with`,
    // el `returning`, el `onConflict`, un select en `values`). Después
    // reescribimos encima, para que lo que agreguemos no se vuelva a visitar.
    const insercion = super.transformInsertQuery(node, queryId);

    // El nombre sin calificar, porque así lo escribe el código de la aplicación
    // (la ruta de búsqueda por rol resuelve el esquema).
    const tabla = insercion.into?.table.identifier.name;
    if (tabla !== undefined && this.#tablasExentas.has(tabla)) {
      return insercion;
    }

    const valores = insercion.values;

    // `.defaultValues()`: no hay lista de valores todavía. Se puede inyectar sin
    // cambiar el significado —las demás columnas siguen tomando su valor por
    // defecto— así que se inyecta, que es el lado seguro.
    if (valores === undefined) {
      return {
        ...insercion,
        defaultValues: undefined,
        columns: [ColumnNode.create(COLUMNA)],
        values: ValuesNode.create([PrimitiveValueListNode.create([this.#organizacionActiva()])]),
      };
    }

    // INSERT … SELECT (y cualquier otra expresión en `values`): no hay literales
    // que reescribir. Pasa intacto y lo rechaza el `with check` de la política si
    // las filas no son de la organización activa. Reescribir la lista de
    // selección del select sería adivinar: puede ser una unión, puede ya traer
    // `org_id`, y el orden importa.
    if (!ValuesNode.is(valores)) {
      return insercion;
    }

    const columnas = insercion.columns ?? [];
    const indice = columnas.findIndex((c) => c.column.name === COLUMNA);
    const organizacion = this.#organizacionActiva();

    if (indice >= 0) {
      return {
        ...insercion,
        values: ValuesNode.create(
          valores.values.map((fila) => conOrganizacion(fila, indice, columnas.length, organizacion)),
        ),
      };
    }

    return {
      ...insercion,
      columns: [...columnas, ColumnNode.create(COLUMNA)],
      values: ValuesNode.create(
        valores.values.map((fila) => conOrganizacion(fila, columnas.length, columnas.length, organizacion)),
      ),
    };
  }
}

/**
 * El plugin. Se le pasa al cliente de negocio; el de identidad NO lo lleva.
 *
 * `tablasExentas` está vacío a propósito: inyectar en todo lo que pase por este
 * cliente es lo único que falla del lado seguro. Una lista de tablas
 * PERMITIDAS sería una segunda fuente de verdad al lado de las migraciones, y el
 * día que alguien agregue una tabla y se olvide de anotarla, la escritura sale
 * SIN organización y nadie se entera. Al revés, si se inyecta donde no
 * corresponde, la base contesta `column "org_id" of relation … does not exist` en
 * el primer INSERT: ruidoso, inmediato, imposible de ignorar. La lista existe
 * como escotilla para ese caso —una tabla de negocio compartida, sin inquilino—
 * y se espera que quede vacía.
 */
export class InyectarOrganizacion implements KyselyPlugin {
  readonly #transformador: TransformadorDeOrganizacion;

  constructor(organizacionActiva: OrganizacionActiva, tablasExentas: Iterable<string> = []) {
    this.#transformador = new TransformadorDeOrganizacion(organizacionActiva, new Set(tablasExentas));
  }

  transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
    return this.#transformador.transformNode(args.node, args.queryId);
  }

  // Nada que hacer con el resultado: la inyección es solo de ida.
  async transformResult(args: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>> {
    return args.result;
  }
}
