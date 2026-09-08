/* Buscar un lead dentro del Pipeline que ya está en pantalla.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * POR QUÉ SE FILTRA EN LA PANTALLA Y NO SE LE PREGUNTA AL SERVIDOR
 *
 * Porque **el Pipeline ya trae todo**. `pipelineDe` llama a `filasDeTerritorio` con `todas: true`,
 * y eso no es una paginación disfrazada: el tope es `TOPE_SIN_PAGINAR = 5000` y la cartera real
 * medida el 2026-09-08 son **268 contactos** —244 en zona y 24 congelados—. Las filas están todas
 * en memoria antes de que nadie escriba una letra.
 *
 * Así que buscar acá cuesta **cero llamadas**, que es lo que el `04` § 8 exige de esta pantalla:
 * las cuatro que el closer mira todo el día no gastan presupuesto del proveedor. Un buscador que
 * pidiera al servidor por cada tecla sería el gasto exacto que ese documento prohíbe, y encima
 * tardaría más que filtrar 268 filas en memoria.
 *
 * ── LA CONDICIÓN QUE HACE HONESTO ESTE DISEÑO, Y CÓMO SE VIGILA ────────────
 *
 * Filtrar en la pantalla solo es honesto si la pantalla tiene TODO. El día que la cartera pase de
 * 5.000, `filasDeTerritorio` corta y devuelve `hayMas: true` — y entonces un «ningún contacto
 * coincide» pasaría a significar «no está entre los primeros 5.000», que se lee como «no existe».
 *
 * Eso ya está resuelto del lado del dato: el tablero recibe `hayMas` y **ya dibuja un aviso** de
 * que los conteos están incompletos. Lo que este archivo agrega es que el buscador tiene que
 * decirlo también: ver `buscar()`, que devuelve `parcial`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * QUÉ CAMPOS SE MIRAN, Y CUÁL SE DEJÓ AFUERA A PROPÓSITO
 *
 * **Nombre, teléfono y correo.** Son las tres formas en que un closer conoce a un lead: se acuerda
 * del nombre, tiene el número en el teléfono, o le llegó el correo.
 *
 * `fuente` NO se mira, y es la exclusión que hay que explicar porque es la tentación obvia: la
 * mitad de la cartera tiene `Meta Ads`, así que escribir «meta» devolvería doscientas filas. Un
 * buscador que ante tres letras comunes devuelve casi todo no ayuda a encontrar a nadie — y peor,
 * hace creer que filtró. Filtrar por fuente es un filtro de LISTA, no una búsqueda, y ése es otro
 * control.
 *
 * Tampoco se mira el último mensaje. Buscar dentro de las conversaciones es otra función —y de
 * verdad útil— pero se llama distinto y necesita el texto completo, que la fila no trae: `Fila`
 * solo carga el último entrante.
 * ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Texto comparable: sin mayúsculas y **sin tildes**.
 *
 * Lo segundo no es un adorno: la cartera está llena de nombres como «Martín», «Sofía» y
 * «Benítez», y nadie escribe las tildes en un buscador. Sin esta línea, buscar «martin» no
 * encuentra a Martín — y el resultado es el peor de los dos posibles: el buscador dice que no
 * existe alguien que sí está en la lista, a la vista, tres renglones más abajo.
 *
 * `NFD` separa la letra de su tilde y el rango borra las tildes sueltas. Se hace así y no con una
 * tabla de reemplazos para que valga también para la diéresis y para lo que traiga el CRM.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Solo los dígitos. Es lo que hace comparables dos teléfonos escritos distinto. */
export function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

/**
 * Cuántos dígitos hace falta escribir para que la búsqueda mire los teléfonos.
 *
 * Con uno o dos, casi todo número de la cartera coincide —un `+54 9 11 5523-8841` contiene cada
 * dígito varias veces— así que el buscador devolvería la lista entera y parecería que filtró. Con
 * tres ya recorta de verdad.
 *
 * No afecta a los nombres ni a los correos: buscar «An» sigue encontrando a Ana.
 */
export const DIGITOS_MINIMOS = 3;

/** Lo que la búsqueda necesita de una fila. Es un subconjunto de `Fila`, a propósito: así esta
 *  función se puede probar sin construir una fila completa con sus seis iconos. */
export interface BuscableEnLaFila {
  nombre: string;
  telefono?: string | null;
  email?: string | null;
}

/** `true` si esta fila coincide con lo escrito. La consulta llega SIN normalizar. */
export function coincide(fila: BuscableEnLaFila, consulta: string): boolean {
  const q = normalizar(consulta);
  if (q === '') return true;

  if (normalizar(fila.nombre).includes(q)) return true;
  if (fila.email && normalizar(fila.email).includes(q)) return true;

  /* El teléfono se compara por dígitos, así que `5523` encuentra `+54 9 11 5523-8841` y `+595`
     encuentra a los paraguayos. Y se compara la consulta ENTERA reducida a dígitos, no cada
     dígito: escribir «595 97» busca `59597`, que es cómo alguien copia un número de otra pantalla. */
  const digitos = soloDigitos(consulta);
  if (digitos.length >= DIGITOS_MINIMOS && fila.telefono) {
    if (soloDigitos(fila.telefono).includes(digitos)) return true;
  }

  return false;
}

/** Una columna del Pipeline, con lo que la búsqueda necesita. */
export interface ColumnaBuscable<F extends BuscableEnLaFila> {
  clave: string;
  nombre: string;
  cuantos: number;
  filas: F[];
}

export interface Busqueda<F extends BuscableEnLaFila> {
  /** Las columnas, con sus filas filtradas y su conteo **recalculado**. Ver abajo. */
  columnas: ColumnaBuscable<F>[];
  /** `true` si hay algo escrito. Es lo que decide qué dice cada vacío. */
  filtrando: boolean;
  /** Cuántas filas coinciden, en todas las columnas. */
  coincidencias: number;
  /** Sobre cuántas se buscó. */
  deCuantas: number;
  /**
   * `true` si se buscó sobre una lista INCOMPLETA — el tablero llegó truncado.
   *
   * Existe porque un cero sobre una lista cortada no significa «no está»: significa «no está entre
   * las que llegaron». Quien dibuja el buscador tiene que decirlo, o el vendedor concluye que el
   * contacto no existe y lo busca en el CRM.
   */
  parcial: boolean;
}

/**
 * Filtra el tablero. Con la consulta vacía devuelve lo mismo que entró.
 *
 * ── EL CONTEO SE RECALCULA, Y NO ES UN DETALLE ─────────────────────────────
 *
 * `cuantos` lo trae el servidor y es el total de la columna. Si se dejara así con un filtro puesto,
 * el encabezado diría «Agendado 12» con dos filas debajo — y ése es un defecto que este proyecto ya
 * pagó una vez y dejó escrito en `components/views/CloserView.jsx`: *«el encabezado del buzón decía
 * 25 con siete filas debajo»*.
 *
 * Con el conteo recalculado el encabezado dice cuántas coinciden, y eso sirve además para lo otro:
 * una sección REPLEGADA con coincidencias las anuncia con su número, que es justamente lo que
 * `SeccionPlegable` existe para poder hacer.
 */
export function buscar<F extends BuscableEnLaFila>(
  columnas: readonly ColumnaBuscable<F>[],
  consulta: string,
  opciones: { hayMas?: boolean } = {},
): Busqueda<F> {
  const q = consulta.trim();
  const deCuantas = columnas.reduce((n, c) => n + c.filas.length, 0);

  if (q === '') {
    return {
      columnas: columnas.map((c) => ({ ...c, filas: [...c.filas] })),
      filtrando: false,
      coincidencias: deCuantas,
      deCuantas,
      parcial: false,
    };
  }

  const filtradas = columnas.map((c) => {
    const filas = c.filas.filter((f) => coincide(f, q));
    return { ...c, cuantos: filas.length, filas };
  });

  return {
    columnas: filtradas,
    filtrando: true,
    coincidencias: filtradas.reduce((n, c) => n + c.filas.length, 0),
    deCuantas,
    /* Solo cuando hay algo escrito: sin filtro, el aviso de truncado del tablero ya lo dice y
       repetirlo sería dos carteles para el mismo hecho. */
    parcial: opciones.hayMas === true,
  };
}
