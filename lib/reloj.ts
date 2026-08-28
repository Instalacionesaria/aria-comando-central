'use client';

// EL único módulo de relojes del navegador.
//
// ═══════════════════════════════════════════════════════════════════════════════
// DE DÓNDE SALE ESTA REGLA
//
// El `04` § 1 describe el estado del que se venía: *"ocho `setInterval` sueltos repartidos en cuatro
// archivos"*, cada uno pegándole al CRM cada 10–30 segundos, **incluso con la pestaña oculta**. Y
// `components/views/CloserView.jsx` explica por qué el reloj de 10 segundos estaba bloqueado hasta
// acá: poner el intervalo antes que el candado del servidor y la marca de agua es *"la parte fácil
// de un diseño cuya parte difícil lo sostiene"*.
//
// Este módulo garantiza las dos cosas que ningún reloj suelto puede garantizar por sí mismo:
//
//   **1 · Pestaña oculta = CERO intervalos corriendo.** Un solo escucha de `visibilitychange` los
//   pausa y los reanuda a todos. Al volver, cada reloj dispara UNA vez de inmediato: quien vuelve a
//   la pestaña quiere ver fresco, no esperar el próximo ciclo. **Eso sí lo hace este módulo; la
//   PRIMERA lectura no** — ver `registrarReloj`, que explica por qué.
//
//   **2 · Un reloj por clave.** Registrar dos veces la misma clave reemplaza al anterior, así que
//   dos montajes del mismo componente **no duplican el tráfico**. Por eso la clave del chat es
//   `chat:<id>`: abrir la ficha de otro contacto reemplaza el reloj en vez de sumar uno.
//
// El costo por pestaña sí lo acota esto; el costo total contra el CRM lo acota el candado de
// `lib/negocio/pulso.ts`. Son dos límites distintos y hacen falta los dos: sin el candado, N
// pestañas son N veces el tráfico contra el proveedor por más ordenados que estén los relojes acá.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react';

/** Lo que un reloj dispara. Puede devolver una promesa, y de eso depende el guard de vuelo. */
type Disparo = () => void | Promise<unknown>;

interface Tarea {
  fn: Disparo;
  ms: number;
  timer: ReturnType<typeof setInterval> | null;
  /**
   * ¿El ciclo anterior todavía no terminó?
   *
   * ═════════════════════════════════════════════════════════════════════
   * ESTE CAMPO NO EXISTÍA, Y ES LA «GARANTÍA 3» DEL DOCUMENTO `04`
   *
   * `setInterval` no espera nada: dispara cada `ms` haya terminado el anterior o no. El tic de la
   * operación hace dos pedidos en serie —la ingesta y después las colas— y la ingesta habla con
   * GoHighLevel, donde `pedirExterno` espera **hasta 240 segundos**.
   *
   * O sea que un ciclo lento **acumula compañía**: a los 10 segundos entra el segundo, a los 20 el
   * tercero, y con el proveedor lento de verdad hay veinticuatro ciclos encima. Cada uno pide la
   * ingesta y recarga las colas, así que la pantalla se llena de peticiones justo cuando el sistema
   * ya está en problemas — y no falla nada: se ve como «va lento».
   *
   * El candado del servidor NO cubre esto: es un antirrebote por organización para que la INGESTA no
   * corra dos veces, y los pedidos igual salen y las colas igual se recargan. Son dos límites
   * distintos, y hacen falta los dos.
   */
  enVuelo: boolean;
}

/**
 * Disparar un ciclo, **salvo que el anterior siga corriendo**.
 *
 * Todo disparo pasa por acá: el del intervalo y el de volver a la pestaña. Si alguno lo saltara, el
 * guard tendría un agujero por el lado que menos se mira — volver a la pestaña con un ciclo lento en
 * curso es exactamente cuando pasa.
 *
 * El ciclo saltado NO se encola: el próximo tic llega en `ms` y trae datos más nuevos que los que
 * habría traído el que se salteó. Encolarlo sería pagar por ver algo viejo.
 */
function disparar(t: Tarea): void {
  if (t.enVuelo) return;
  const r = t.fn();
  // Un disparo síncrono no tiene nada que esperar, y marcarlo en vuelo lo dejaría trabado para
  // siempre: no hay `finally` que lo libere.
  if (!(r instanceof Promise)) return;
  t.enVuelo = true;
  void r.then(
    () => {
      t.enVuelo = false;
    },
    // Y también si RECHAZA. Sin esta rama, un ciclo que falla apaga el reloj para siempre y el
    // síntoma es una pantalla que deja de actualizarse sin decir nada.
    () => {
      t.enVuelo = false;
    },
  );
}

const tareas = new Map<string, Tarea>();
let escuchando = false;

const visible = (): boolean =>
  typeof document === 'undefined' || document.visibilityState === 'visible';

function arrancar(t: Tarea): void {
  if (t.timer !== null) return;
  t.timer = setInterval(() => {
    // Se vuelve a comprobar dentro del intervalo y no solo al pausarlo: entre que la pestaña se
    // oculta y corre el escucha puede caer un disparo.
    if (visible()) disparar(t);
  }, t.ms);
}

function frenar(t: Tarea): void {
  if (t.timer === null) return;
  clearInterval(t.timer);
  t.timer = null;
}

function escuchar(): void {
  if (escuchando || typeof document === 'undefined') return;
  escuchando = true;
  document.addEventListener('visibilitychange', () => {
    if (visible()) {
      for (const t of tareas.values()) {
        disparar(t);
        arrancar(t);
      }
    } else {
      for (const t of tareas.values()) frenar(t);
    }
  });
}

/**
 * Registra un reloj: dispara `fn` cada `ms`. Devuelve la función para darlo de baja.
 *
 * ── NO HACE LA PRIMERA LECTURA, Y ESO SE APRENDIÓ MIRANDO ──────────────────
 *
 * La versión anterior disparaba una vez al registrarse, y con eso la primera carga del chat quedaba
 * colgada de este módulo. **Medido en el navegador**: con la pestaña oculta, `visible()` es falso,
 * el disparo inicial no ocurre, y el chat se quedaba en «Cargando…» sin decir por qué. Se
 * recuperaba al volver a la pestaña, pero mientras tanto era un estado sin salida aparente — y el
 * `03` § 5 llama a eso un defecto.
 *
 * La división correcta: **el reloj REPITE; la primera lectura la hace quien abre.** Un componente
 * siempre puede pedir sus datos; lo que no puede es garantizar que la pestaña esté a la vista.
 *
 * Lo que sí sigue haciendo, porque ahí sí es el único que puede: **disparar al volver de oculta**.
 * Quien vuelve a la pestaña quiere ver fresco, no esperar el próximo ciclo.
 */
export function registrarReloj(clave: string, fn: Disparo, ms: number): () => void {
  escuchar();
  const previa = tareas.get(clave);
  if (previa) frenar(previa);

  const t: Tarea = { fn, ms, timer: null, enVuelo: false };
  tareas.set(clave, t);
  // Solo se arranca el intervalo. Con la pestaña oculta ni eso: el escucha de visibilidad lo
  // levanta al volver, y de paso dispara una vez.
  if (visible()) arrancar(t);

  return () => {
    // Solo se da de baja si el registro sigue siendo ÉSTE. Sin esta comprobación, el desmontaje
    // tardío de un componente viejo apagaría el reloj que acaba de registrar el nuevo — y el
    // síntoma sería un chat que deja de actualizarse al cambiar de contacto rápido.
    const actual = tareas.get(clave);
    if (actual === t) {
      frenar(t);
      tareas.delete(clave);
    }
  };
}

/** El mismo registro, como hook: vive mientras el componente esté montado. */
export function usarReloj(clave: string | null, fn: Disparo, ms: number): void {
  useEffect(() => {
    // `null` = no hay nada que vigilar todavía (la ficha cerrada, por ejemplo). No se registra, y
    // así el componente no necesita romper la regla de los hooks para apagarlo.
    if (clave === null) return undefined;
    return registrarReloj(clave, fn, ms);
  }, [clave, fn, ms]);
}

/* La cadencia se mudó a `lib/cadencia.ts` y se reexporta desde acá.
 *
 * El motivo está en el encabezado de ese archivo: `lib/negocio/pulso.ts` —que es del SERVIDOR—
 * necesita el mismo número para su antirrebote, y este archivo lleva `'use client'`.
 *
 * Se reexporta y no se cambian las importaciones de los componentes porque este módulo sigue siendo
 * el lugar natural donde buscarla: quien va a poner un reloj entra acá. */
export { CADENCIA } from './cadencia.ts';
