// Los valores de borde del cuadrante del ICP, con lo que tiene que salir de cada uno. Los usan la 310 (la
// normalización de la sincronización) y la 311 (la misma en SQL): con dos listas, una de las dos capas podría quedar
// probada con menos bordes que la otra y nadie lo notaría.

export const BORDES_DEL_CUADRANTE: readonly (readonly [unknown, string | null])[] = [
  ['Prioriza', 'prioriza'],
  ['Valida', 'valida'],
  ['Financia', 'financia'],
  ['Descarta', 'descarta'],
  [' Prioriza ', 'prioriza'],
  ['\tvalida\r\n', 'valida'],
  ['FINANCIA', 'financia'],
  ['Válida', 'valida'],
  ['DESCÁRTA', 'descarta'],
  ['Prioridad', null],
  ['Descartar', null],
  ['Educar', null],
  ['Prio riza', null],
  ['prioriza.', null],
  ['', null],
  ['   ', null],
  [68, null],
  [['Prioriza'], null],
  [null, null],
  [undefined, null],
];
