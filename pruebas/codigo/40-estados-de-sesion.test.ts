// ADR-0408 — Ninguna ruta específica de un estado está en dos listas.
// ADR-0409 — De todo estado se puede salir y preguntar quién soy.
// Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LAS DOS PROPIEDADES DE LAS LISTAS BLANCAS, Y SON OPUESTAS
//
// `ADR-0409` exige que DOS rutas estén en las cuatro listas. `ADR-0408` exige que **ninguna
// otra** esté en más de una. Las dos juntas dicen: el conjunto común es exactamente el
// conjunto común, y todo lo demás es de un solo estado.
//
// Por qué importa cada una:
//
//   · `ADR-0409` — el 03 § 5 lo llama *"el error más fácil de cometer armando estas listas"*.
//     Sin consultar la sesión, el frontend no sabe en qué estado está y no sabe qué pantalla
//     mostrar. Sin cerrar sesión, el estado no tiene salida: *"un estado sin salida es una
//     cuenta bloqueada que necesita a un administrador"*.
//
//   · `ADR-0408` — una ruta específica en dos listas significa que se puede alcanzar desde
//     dos estados a medio autenticar distintos. El caso concreto: si
//     `POST /api/auth/2fo/verificar` estuviera también en `debe_configurar_2fo`, alguien que
//     todavía NO configuró su segundo factor podría llamar a verificar. Y el 03 § 5 explica
//     por qué ese orden es peligroso: la contraseña temporal *"la conoce quien creó la
//     cuenta"*, así que dejar configurar el segundo factor antes le permitiría a esa persona
//     **inscribir su dispositivo en la cuenta de otro**.
//
// El "comparando **sin** el conjunto común" de `PRUEBAS.md` no es una simplificación: es la
// mitad que hace que la prueba sea escribible. Sin restar `COMUN`, las cuatro listas se
// solapan por diseño y la comprobación fallaría sobre las listas correctas.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMUN,
  ESTADOS,
  SIN_SESION_REQUERIDA,
  estadoHabilita,
  type Ruta,
} from '../../lib/autorizacion/estados.ts';

/** Los estados que RESTRINGEN: los que tienen lista. `activa` habilita todo con `null`. */
function estadosRestringidos(): [string, readonly Ruta[]][] {
  return Object.entries(ESTADOS).filter(
    (par): par is [string, readonly Ruta[]] => par[1] !== null,
  );
}

test('ADR-0409 · cerrar sesión y consultar la sesión están en las CUATRO listas', () => {
  const restringidos = estadosRestringidos();
  assert.ok(restringidos.length > 0, 'no hay estados restringidos: la prueba pasaría en vacío');

  for (const [estado, rutas] of restringidos) {
    for (const comun of COMUN) {
      assert.ok(
        rutas.includes(comun),
        `el estado ${estado} no habilita ${comun}: es un estado sin salida`,
      );
    }
  }

  // Y `activa`, que habilita todo, también. Se comprueba por la función y no por la lista,
  // porque `activa` está escrito como `null` a propósito: "todas" no es un conjunto
  // enumerable, y escribirlo como lista obligaría a mantener acá cada ruta nueva del sistema.
  for (const comun of COMUN) {
    assert.ok(estadoHabilita('activa', comun), `el estado activa no habilita ${comun}`);
  }

  // La guarda de contenido: `COMUN` tiene que ser exactamente las dos rutas que el 03 § 5
  // nombra. Si alguien le agregara una tercera, esta prueba seguiría pasando y `ADR-0408`
  // dejaría de vigilar esa ruta — porque `ADR-0408` compara restando `COMUN`.
  assert.deepEqual(
    [...COMUN].sort(),
    ['DELETE /api/auth/sesion', 'GET /api/auth/sesion'],
    'COMUN cambió: cada ruta que se agregue acá queda EXENTA de ADR-0408',
  );
});

test('ADR-0408 · ninguna ruta específica está en dos listas', () => {
  const restringidos = estadosRestringidos();
  const comun = new Set<string>(COMUN);

  // Cada ruta específica, con los estados que la habilitan.
  const porRuta = new Map<string, string[]>();
  for (const [estado, rutas] of restringidos) {
    for (const ruta of rutas) {
      if (comun.has(ruta)) continue; // el conjunto común está exento a propósito
      porRuta.set(ruta, [...(porRuta.get(ruta) ?? []), estado]);
    }
  }

  assert.ok(porRuta.size > 0, 'no hay ninguna ruta específica: la prueba pasaría en vacío');

  const compartidas = [...porRuta]
    .filter(([, estados]) => estados.length > 1)
    .map(([ruta, estados]) => `${ruta} → ${estados.join(', ')}`);

  assert.deepEqual(
    compartidas,
    [],
    'una ruta específica alcanzable desde dos estados a medio autenticar: ' +
      'el orden entre estados deja de valer',
  );
});

test('ADR-0408 · las dos rutas sin sesión son EXACTAMENTE el conjunto común', () => {
  // `SIN_SESION_REQUERIDA` y `COMUN` describen dos cosas distintas —"funciona sin sesión" y
  // "está en las cuatro listas"— y hoy coinciden. Que coincidan es una propiedad, no una
  // casualidad: una ruta que funciona sin sesión tiene que estar habilitada en todo estado
  // (si no, tener sesión daría MENOS acceso que no tenerla), y una ruta del conjunto común que
  // exigiera sesión dejaría sin salida a quien la perdió.
  //
  // Si algún día divergen, la divergencia tiene que ser deliberada y esta prueba la fuerza.
  assert.deepEqual([...SIN_SESION_REQUERIDA].sort(), [...COMUN].sort());
});

test('ADR-0408 · un estado desconocido no habilita NADA', () => {
  // Falla cerrado. Si algún día la base admite un estado nuevo y nadie lo agrega a `ESTADOS`,
  // sus sesiones quedan sin poder hacer nada en vez de con acceso total. Es el modo de fallar
  // correcto y hay que afirmarlo: el opuesto —un `??` que devuelva "todas"— es una línea.
  assert.equal(estadoHabilita('inventado', 'GET /api/auth/sesion'), false);
  assert.equal(estadoHabilita('', 'GET /api/auth/sesion'), false);
});
