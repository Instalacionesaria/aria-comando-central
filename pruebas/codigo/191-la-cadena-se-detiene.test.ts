// «Construir el método» se detiene a confirmar después del ICP y de la Oferta.
//
// La cadena construía los pasos 3 a 7 sin parar, y un ICP mal entendido se arrastraba hasta el Mapa.
// Desde el 2026-10-03 se pausa después de los dos documentos sobre los que se apoya el resto, muestra
// su resumen y pregunta «¿Sigo con esto o quieres cambiar algo?», con la misma tarjeta que la
// confirmación del segmento. Una cadena detenida —por un cambio, por una pregunta del agente o por un
// fallo— se puede retomar.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';

const armazon = sinComentarios(readFileSync(join(RAIZ, 'components/fundaciones/Fundaciones.jsx'), 'utf8'));

test('pausa después del ICP (3) y de la Oferta (4), y solo si queda algo por construir', () => {
  assert.match(armazon, /const PAUSAR_DESPUES_DE = \[3, 4\];/);
  assert.match(armazon, /if \(siguiente && PAUSAR_DESPUES_DE\.includes\(h\.id\)\) \{/);
  // La pausa ocurre DESPUÉS de generar y de recargar: el documento está en pantalla al preguntar.
  const generar = armazon.indexOf('const generacion = await pedir(rutaGenerar');
  const recargar = armazon.indexOf('await cargar();', generar);
  const pausa = armazon.indexOf('PAUSAR_DESPUES_DE.includes(h.id)', recargar);
  assert.ok(generar > 0 && recargar > generar && pausa > recargar, 'la pausa no está después de generar y recargar');
  // El resumen es el veredicto del documento que acaba de salir.
  assert.match(armazon, /resumen: leerDocumento\(generacion\.datos\.texto\)\.veredicto/);
});

test('la tarjeta pregunta con esas palabras, con la forma de la confirmación del segmento', () => {
  assert.match(armazon, /¿Sigo con esto o quieres cambiar algo\?/);
  assert.match(armazon, /\{cadena && cadena\.pausa \? \(\s*<div className="fd-mirada gasto"/);
  assert.match(armazon, /onClick=\{\(\) => decidirLaPausa\(true\)\}/);
  assert.match(armazon, /onClick=\{\(\) => decidirLaPausa\(false\)\}>\s*Quiero cambiar algo/);
});

test('«Quiero cambiar algo» detiene la cadena ahí, y se puede retomar desde el paso siguiente', () => {
  assert.match(armazon, /if \(!seguir\) \{\s*detener\(indice, h, 'cambiar'\);\s*return;/);
  assert.match(armazon, /reanudar: motivo === 'cambiar' \? indice \+ 1 : indice,/);
  assert.match(armazon, /Seguir con la cadena/);
  assert.match(armazon, /onClick=\{reanudarLaCadena\}/);
  // Detenida por una pregunta del agente: si mientras tanto se generó ese paso, se sigue con el siguiente.
  assert.match(armazon, /const desde = cadena\.motivo !== 'cambiar' && generadoMientras \? cadena\.reanudar \+ 1 : cadena\.reanudar;/);
  // Y al retomar no se rehacen los pasos ya construidos.
  assert.match(armazon, /if \(indice < desde\) continue;/);
});
