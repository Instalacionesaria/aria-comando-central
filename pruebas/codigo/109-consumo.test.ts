// El consumo de GoHighLevel y de Vercel. Tipo: Código.
//
// ═══════════════════════════════════════════════════════════════════════════════
// LO QUE ESTABA MEDIDO, Y POR QUÉ NINGUNA DE LAS TRES COSAS FALLABA
//
// Una empresa con UNA pestaña abierta costaba **720 pedidos a Vercel y 360 llamadas al CRM por
// hora**. Ocho horas son ≈2.880 llamadas por día y por empresa; con M empresas se multiplica por M.
// Más del 95 % de eso es la misma búsqueda que devuelve «no cambió nada».
//
// Los tres defectos que este archivo fija tienen la propiedad de siempre: **nada falla con ellos
// puestos**. Se ven contando peticiones, no mirando la pantalla.
//
// **1 · El reloj corría mire quien mire.** `CommandCenter` monta las diez vistas de una sola vez y el
// cambio de pantalla es puro DOM, así que React no se entera de cuál está abierta. Resultado:
// cualquiera con la sección Closer en su menú pagaba 360 llamadas/hora sin abrir el Closer. Un
// administrador que entra a Ajustes pagaba lo mismo que un closer trabajando.
//
// **2 · No había guard de ciclo en vuelo.** `setInterval` no espera nada, y el tic hace dos pedidos
// en serie de los cuales uno habla con el CRM, donde `pedirExterno` espera hasta 240 s. Un ciclo
// lento **acumula compañía**: a los 10 s entra el segundo, a los 20 el tercero. El candado del
// servidor no cubre esto — es un antirrebote de la INGESTA, y los pedidos igual salen.
//
// **3 · El antirrebote era más corto que la cadencia.** 8 segundos contra un ciclo de 10, así que dos
// pestañas desfasadas más de 8 segundos producían DOS corridas por ciclo. El techo con varias
// pestañas subía de 360 a 450 llamadas/hora: un 25 % de más que no se ve en ninguna pantalla.
// ═══════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import { archivosFuente } from '../apoyo/fuente.ts';
import { CADENCIA } from '../../lib/cadencia.ts';
import { ANTIRREBOTE_MS } from '../../lib/negocio/pulso.ts';
import { registrarReloj } from '../../lib/reloj.ts';

function limpio(ruta: string): string {
  const a = archivosFuente(['app', 'components', 'lib']).find((x) => x.ruta === ruta);
  assert.ok(a, `no se encontró ${ruta}`);
  return a.limpio;
}

const esperar = (ms: number) => new Promise((listo) => setTimeout(listo, ms));

// ═══════════════════════════════════════════════════════════════════════════════
// 1 · EL TIC NO CORRE SI NADIE MIRA EL CLOSER
// ═══════════════════════════════════════════════════════════════════════════════

test('el reloj de la operación cuelga de que el Closer esté a la vista, no de `activa`', () => {
  const src = limpio('components/views/CloserView.jsx');

  /* `activa` NO sirve y por eso se prueba que no se use para esto: `CommandCenter` la calcula UNA
     vez, al arrancar, comparando con la sección de arranque de la sesión. Quien empieza en Ajustes
     tendría `false` para siempre —y el Closer no se actualizaría nunca al abrirlo— y quien empieza en
     el Closer, `true` para siempre, que es justo el defecto que se vino a cerrar. */
  assert.match(
    src,
    /usarReloj\(\s*aLaVista \? 'operacion:tic' : null/,
    'el reloj de 10 segundos volvió a registrarse sin condición: son 360 llamadas al CRM por hora y ' +
      'por empresa para cualquiera que tenga la sección Closer en su menú, sin abrirla',
  );
  assert.match(
    src,
    /const aLaVista = estaALaVista\('closer'\)/,
    'la pantalla dejó de preguntar cuál está a la vista',
  );

  /* Y la PRIMERA carga también. Sin esto el gasto no es cero: es una llamada a `/api/closer/mi-dia`
     por cada persona que abre la aplicación, más la ingesta que ese endpoint no dispara pero que el
     tic sí. Es menos que 360/h y sigue siendo un pedido por nada. */
  assert.match(
    src,
    /if \(!aLaVista\) return;/,
    'la primera carga volvió a colgar del montaje: se paga aunque nadie abra el Closer',
  );
});

test('la pantalla activa se pregunta en un solo lugar, y es el que decide abrirla', () => {
  /* `irALaVista` es —dice su propio encabezado— *«el único lugar que decide qué significa abrir una
     pantalla»*. El aviso sale de ahí y no de un `MutationObserver` ni de un segundo estado en React,
     porque cualquiera de esas dos sería una segunda verdad sobre lo mismo. */
  const shell = limpio('lib/aios/shell.js');
  assert.match(shell, /export function vistaActiva\(\)/, 'no se puede preguntar qué vista está abierta');
  assert.match(shell, /export function alCambiarDeVista\(fn\)/, 'no se puede escuchar el cambio');

  /* Y el aviso va DESPUÉS de tocar el DOM. Al revés, el primero en preguntar recibe la pantalla
     anterior, y el síntoma sería un reloj que arranca un ciclo tarde y otro que se apaga tarde. */
  const cuerpo = shell.slice(shell.indexOf('export function irALaVista'));
  const iOn = cuerpo.indexOf("destino.classList.add('on')");
  const iAviso = cuerpo.indexOf('for (const fn of oyentesDeVista)');
  assert.ok(iOn >= 0 && iAviso >= 0, 'falta la marca de la vista abierta o el aviso');
  assert.ok(iAviso > iOn, 'se avisa ANTES de abrir la pantalla: quien pregunte recibe la anterior');

  /* El valor inicial se LEE del DOM y no se guarda. Guardarlo sería tener dos verdades: la primera
     pantalla la marca React con su propiedad `activa`, y esta función recién corre en el primer clic
     del menú — así que un valor inicial guardado acá estaría vacío justo al arrancar. */
  assert.match(
    limpio('lib/vista.ts'),
    /vistaActiva\(\)/,
    'el puente a React dejó de preguntarle al único lugar que sabe',
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2 · UN CICLO LENTO NO ACUMULA COMPAÑÍA
// ═══════════════════════════════════════════════════════════════════════════════

test('un ciclo que todavía no terminó NO se dispara de nuevo', async () => {
  // ── LA PRUEBA CORRE DE VERDAD, NO LEE LA FUENTE ────────────────────────────
  //
  // `lib/reloj.ts` funciona sin DOM: `visible()` devuelve `true` cuando no hay `document`, y
  // `escuchar()` se retira. Así que el guard se puede ejercitar con un intervalo corto y un reloj de
  // verdad, que es mucho mejor que buscar la palabra `enVuelo` en el archivo.
  let arranques = 0;
  /* Un objeto y no `let soltar`: TypeScript no ve la asignación de adentro del constructor de la
     promesa, así que estrecha la variable a `null` y `soltar?.()` no compila. Una propiedad no se
     estrecha igual. */
  const cierre: { soltar: (() => void) | null } = { soltar: null };

  const baja = registrarReloj(
    'prueba:en-vuelo',
    () => {
      arranques += 1;
      return new Promise<void>((listo) => {
        cierre.soltar = listo;
      });
    },
    15,
  );

  try {
    // Cuatro intervalos de 15 ms. Sin el guard, esto son cuatro arranques encimados.
    await esperar(90);
    assert.equal(
      arranques,
      1,
      `el ciclo se disparó ${arranques} veces con el anterior todavía corriendo: con el proveedor ` +
        'lento eso son veinticuatro ciclos encimados, cada uno pidiendo la ingesta y recargando las colas',
    );

    // Se libera, y el siguiente intervalo SÍ corre: el guard salta ciclos, no apaga el reloj.
    cierre.soltar?.();
    await esperar(60);
    assert.ok(
      arranques >= 2,
      'después de terminar, el reloj no volvió a disparar: el guard apagó el reloj en vez de saltear ' +
        'un ciclo',
    );
  } finally {
    cierre.soltar?.();
    baja();
  }
});

test('un ciclo que FALLA no deja el reloj trabado para siempre', async () => {
  /* La rama que es fácil de olvidar, y su síntoma es el peor de los dos: una pantalla que deja de
     actualizarse y no dice nada. Sin el manejador de rechazo, la bandera de vuelo se queda en `true`
     y el reloj no vuelve a disparar nunca — y como el reloj sigue registrado, tampoco hay forma de
     notarlo mirando. */
  let arranques = 0;
  const baja = registrarReloj(
    'prueba:falla',
    () => {
      arranques += 1;
      return Promise.reject(new Error('el CRM está caído'));
    },
    15,
  );
  try {
    await esperar(90);
    assert.ok(
      arranques >= 3,
      `solo hubo ${arranques} arranque(s): un ciclo que rechaza dejó el reloj trabado, y la pantalla ` +
        'se queda vieja sin decirlo',
    );
  } finally {
    baja();
  }
});

test('un disparo SÍNCRONO no se marca en vuelo', async () => {
  /* Un reloj cuya función no devuelve promesa no tiene nada que esperar. Marcarlo en vuelo lo dejaría
     trabado para siempre: no hay `finally` que lo libere. Es el caso de cualquier reloj futuro que
     solo toque estado local. */
  let arranques = 0;
  const baja = registrarReloj('prueba:sincrono', () => {
    arranques += 1;
  }, 15);
  try {
    await esperar(90);
    assert.ok(arranques >= 3, `un reloj síncrono se disparó ${arranques} veces: quedó trabado`);
  } finally {
    baja();
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3 · LA VENTANA DEL ANTIRREBOTE NO ES MÁS CORTA QUE LA CADENCIA
// ═══════════════════════════════════════════════════════════════════════════════

test('el antirrebote del candado es al menos la cadencia del tic', () => {
  /* UN NÚMERO CONTRA OTRO, y no la presencia de una constante. Eran 8.000 contra 10.000, y la
     consecuencia es aritmética:
   *
   *     pestaña A tira a los 0 s   → corre
   *     pestaña B tira a los 9 s   → pasaron 9 > 8, corre también
   *     pestaña A tira a los 10 s  → pasó 1 desde B, se frena
   *
   * Dos corridas por ciclo de diez segundos en vez de una: 450 llamadas/hora en vez de 360. */
  assert.ok(
    ANTIRREBOTE_MS >= CADENCIA.operacion,
    `la ventana del antirrebote (${ANTIRREBOTE_MS} ms) es más corta que la cadencia del tic ` +
      `(${CADENCIA.operacion} ms): dos pestañas desfasadas más que la ventana producen dos corridas ` +
      'por ciclo, y el techo de llamadas al CRM sube un 25 %',
  );

  /* Y la relación está DECLARADA, no repetida. Con dos números escritos a mano ya se habían
     desalineado una vez, en silencio: mover la cadencia dejaba la ventana donde estaba, y el costo
     del descuadre no se ve en ninguna pantalla. */
  assert.match(
    limpio('lib/negocio/pulso.ts'),
    /ANTIRREBOTE_MS = CADENCIA\.operacion/,
    'el antirrebote volvió a ser un número escrito a mano: el valor no significa nada por sí solo, ' +
      'significa «la cadencia del tic»',
  );

  /* La cadencia vive en un módulo ISOMORFO, y eso es lo que permite lo de arriba: `lib/reloj.ts`
     lleva `'use client'`, así que importarlo desde `pulso.ts` —que es del servidor— mete un módulo de
     cliente en el paquete del servidor. */
  assert.doesNotMatch(
    limpio('lib/cadencia.ts'),
    /use client/,
    '`lib/cadencia.ts` se volvió un módulo de cliente, y el servidor necesita ese número',
  );
});
