// La cadena de «Construir el método» sobrevive a salir de ICP & Oferta y volver.
//
// Hasta el 2026-10-03 la cadena vivía solo en la memoria de la pantalla: salir con la cadena en pausa
// (o detenida en Categoría) la perdía, y «Construir» quedaba bloqueado hasta recargar. Ahora el bucle
// guarda su estado en cada transición (`negocio.cadena_del_metodo`, migración 068) y al volver la
// pantalla lo reconcilia con lo que de verdad pasó (`cadenaAlVolver`).
//
// Esta prueba recorre el caso pedido —salir y volver con la cadena en pausa— con el MISMO registro que
// escribe la pantalla, y los demás finales posibles de un paso que se estaba generando.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ, sinComentarios } from '../apoyo/fuente.ts';
import { TOPE_DE_UNA_GENERACION_MS, cadenaAlVolver, leerRegistro, type RegistroDeCadena } from '../../lib/fundaciones/cadena.ts';
import { estadoVacio } from '../../lib/fundaciones/estado.ts';

const codigo = (ruta: string): string => sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8'));

// Los eslabones del método, en orden: ICP(3), Categoría(2), Oferta(4), Tu precio(10), Mapa(26).
const ICP = { indice: 0, herramienta: 3 };
const OFERTA = { indice: 2, herramienta: 4 };

function conVersiones(id: number, n: number) {
  const e = estadoVacio();
  e.historial = { [id]: Array.from({ length: n }, (_, i) => ({ date: `v${i}`, output: `doc ${i}` })) };
  return e;
}

test('salir con la cadena en pausa y volver: se retoma desde el paso siguiente, sin recargar', () => {
  /* 1 · La cadena genera el ICP y se pausa. Antes de esperar la respuesta, la pantalla guarda esto
         (es el objeto literal de `Fundaciones.jsx`, comprobado abajo). */
  const guardado: RegistroDeCadena = { fase: 'pausa', ...ICP, versiones: 1, reanudar: ICP.indice + 1 };
  // 2 · Lo que viaja a la base y vuelve: el servidor lo valida con el mismo lector al escribir y al leer.
  const leido = leerRegistro(JSON.parse(JSON.stringify(guardado)));
  assert.deepEqual(leido, guardado);

  // 3 · Se vuelve a la pantalla (una hora después, da igual: una pausa no vence).
  const vuelta = cadenaAlVolver(leido, 60 * 60_000, conVersiones(3, 1));
  assert.deepEqual(vuelta, { tipo: 'detenida', indice: 0, herramienta: 3, motivo: 'pausa', reanudar: 1, versiones: 1 });

  // 4 · La pantalla la pinta como cadena detenida con «Seguir con la cadena», que retoma desde `reanudar`.
  const armazon = codigo('components/fundaciones/Fundaciones.jsx');
  assert.match(
    armazon,
    /await guardarLaCadena\(\{ fase: 'pausa', indice, herramienta: h\.id, versiones: versionesDe\(h\.id\), reanudar: indice \+ 1 \}\);[\s\S]{0,600}?const seguir = await new Promise/,
    'la pausa no se guarda ANTES de esperar la respuesta: salir en ese momento la perdería',
  );
  assert.match(armazon, /La cadena quedó en pausa después de \{cadena\.detenida\.titulo\}\./);
  assert.match(armazon, /onClick=\{reanudarLaCadena\}/);
  // Una pausa ya apunta al siguiente: retomar no le suma otro paso.
  assert.match(armazon, /const desde = cadena\.reanudar === cadena\.indice && generadoMientras \? cadena\.reanudar \+ 1 : cadena\.reanudar;/);
  // Y la lectura al volver ocurre al montar, sin recargar la página.
  assert.match(armazon, /useEffect\(\(\) => \{\s*void cargar\(\)\.then\(\(leido\) => reconciliarLaCadena\(leido\)\);\s*\}, \[cargar, reconciliarLaCadena\]\);/);
});

test('detenida en Categoría (esperando respuestas) también se retoma al volver', () => {
  const registro: RegistroDeCadena = { fase: 'detenida', motivo: 'pregunta', indice: 1, herramienta: 2, versiones: 0, reanudar: 1 };
  assert.deepEqual(cadenaAlVolver(registro, 0, estadoVacio()), {
    tipo: 'detenida', indice: 1, herramienta: 2, motivo: 'pregunta', reanudar: 1, versiones: 0,
  });
});

test('si se salió mientras generaba, al volver se ve lo que de verdad pasó', () => {
  const generando: RegistroDeCadena = { fase: 'generando', ...OFERTA, versiones: 2, reanudar: OFERTA.indice };

  // El documento está (hay una versión más): terminó. Se sigue desde el paso siguiente.
  assert.deepEqual(cadenaAlVolver(generando, 30_000, conVersiones(4, 3)), {
    tipo: 'detenida', indice: 2, herramienta: 4, motivo: 'terminado', reanudar: 3, versiones: 3,
  });
  // No está y pasó el tope de una generación: falló. Se reintenta ese mismo paso.
  assert.deepEqual(cadenaAlVolver(generando, TOPE_DE_UNA_GENERACION_MS + 1, conVersiones(4, 2)), {
    tipo: 'detenida', indice: 2, herramienta: 4, motivo: 'fallo', reanudar: 2, versiones: 2,
  });
  // No está pero sigue dentro del tope: se sigue generando de verdad, y la pantalla vuelve a mirar.
  assert.deepEqual(cadenaAlVolver(generando, 60_000, conVersiones(4, 2)), { tipo: 'generando', indice: 2, herramienta: 4 });

  const armazon = codigo('components/fundaciones/Fundaciones.jsx');
  assert.match(armazon, /if \(!generandoAfuera\) return undefined;\s*const t = setTimeout\(/, 'la franja de «sigue generando» no vuelve a mirar');
  assert.match(armazon, /await guardarLaCadena\(\{ fase: 'generando', indice, herramienta: h\.id, versiones: versionesAntes, reanudar: indice \}\);/);
});

test('el bucle no sigue construyendo pasos que nadie mira: si se salió, guarda dónde quedó y corta', () => {
  const armazon = codigo('components/fundaciones/Fundaciones.jsx');
  // Antes de abrir cada paso, queda guardado que se retoma desde ahí.
  assert.match(armazon, /await guardarLaCadena\(\{ fase: 'detenida', motivo: 'salio', indice, herramienta: h\.id, versiones: versionesDe\(h\.id\), reanudar: indice \}\);/);
  // Después de abrir, si la pantalla ya no está, corta.
  assert.match(armazon, /if \(!montado\.current\) return;/);
  // Después de generar, si la pantalla ya no está, deja la cadena en pausa después de este paso.
  assert.match(armazon, /if \(!montado\.current\) \{\s*await guardarLaCadena\(\{ fase: 'pausa', indice, herramienta: h\.id, versiones: versionesAntes \+ 1, reanudar: indice \+ 1 \}\);\s*return;/);
  // Terminada o cerrada, se borra: no vuelve a aparecer.
  assert.match(armazon, /await guardarLaCadena\(null\);/);
  assert.match(armazon, /const cerrarLaCadena = \(\) => \{\s*setCadena\(null\);\s*void guardarLaCadena\(null\);/);
});

test('lo guardado es de la organización: tabla propia, aislada, y una ruta con portero', () => {
  const migracion = readFileSync(join(RAIZ, 'db/migraciones/068_la_cadena_del_metodo.sql'), 'utf8');
  assert.match(migracion, /create table if not exists negocio\.cadena_del_metodo/);
  assert.match(migracion, /primary key \(org_id\)/);
  assert.match(migracion, /select negocio\.aplicar_aislamiento\('negocio\.cadena_del_metodo'\);/);

  const ruta = codigo('app/api/fundaciones/cadena/route.ts');
  assert.match(ruta, /exigir\(peticion, \['fundaciones\.ver'\], PANTALLA\)/);
  assert.match(ruta, /exigir\(peticion, \['fundaciones\.editar'\], PANTALLA\)/);
  assert.match(ruta, /conOrganizacion\(orgId,/);
  // No se escribe lo que después no se podría leer.
  assert.match(ruta, /if \(cuerpo\.registro !== null && registro === null\) \{\s*return rechazo\('peticion_invalida'/);

  // El lector es tolerante: una forma rara es «no hay cadena», no una pantalla rota.
  assert.equal(leerRegistro({ fase: 'otra', indice: 0, herramienta: 3, versiones: 0, reanudar: 0 }), null);
  assert.equal(leerRegistro({ fase: 'detenida', indice: 0, herramienta: 3, versiones: 0, reanudar: 0 }), null, 'detenida sin motivo');
  assert.equal(leerRegistro('basura'), null);
  assert.deepEqual(cadenaAlVolver(null, 0, estadoVacio()), { tipo: 'nada' });
});
