'use client';

/* «Esto no se pudo actualizar». El cartel de una pantalla que tiene datos y no pudo refrescarlos.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * EL DEFECTO QUE ESTE ARCHIVO EXISTE PARA IMPEDIR, Y QUE YA OCURRIÓ
 *
 * `lib/usarLectura.ts` tiene una regla medida: **teniendo datos, la pantalla no se vacía**. Un
 * corte de red de dos segundos no le borra el día de trabajo a nadie — lo de hace un momento
 * sigue ahí. Y su propia documentación prometía la otra mitad: *«Lo que sí se hace es decirlo»*.
 *
 * No se decía. Las tres pantallas migradas dibujaban `causa` únicamente dentro de
 * `if (situacion !== 'listo')`, y una recarga fallida deja `situacion` en `'listo'` justamente
 * para no vaciar nada. O sea que el aviso existía en una variable **que no se lee**: el tablero
 * seguía mostrando lo de hace diez minutos con cara de actual, sin un solo síntoma.
 *
 * Eso es peor que el «Cargando» que todo esto vino a sacar. Un «Cargando» se ve; un tablero viejo
 * dado por bueno se usa para decidir a quién llamar.
 *
 * ────────────────────────── POR QUÉ ES UNA PIEZA Y NO TRES LÍNEAS COPIADAS ──────────────────────────
 *
 * Porque son cuatro pantallas y el modo de falla es no acordarse en una. Copiado, la primera
 * divergencia es silenciosa — exactamente lo que acaba de pasar con `causa`, que estaba escrita
 * en las cuatro y leída en ninguna. `pruebas/codigo/131-avisos-desactualizado.test.ts` comprueba
 * que toda pantalla que use la memoria lo dibuje.
 * ══════════════════════════════════════════════════════════════════════════════
 */

/**
 * @param causa       Lo que devolvió la lectura. **Sin causa no se dibuja nada**, que es el caso
 *                    normal: la inmensa mayoría de los refrescos funcionan.
 * @param alReintentar Qué hacer con el botón. Es el `refrescar` de la pantalla.
 */
export default function AvisoDesactualizado({ causa, alReintentar }) {
  if (!causa) return null;

  return (
    <div className="aj-fila">
      {/* `falta` y no `mal`: lo que se muestra abajo sirve, solo que es de hace un rato. En rojo
          de error, la pantalla entera se leería como rota y nadie usaría los números que SÍ están. */}
      <div className="fd-aviso falta" role="status">
        <i>◍</i>
        <span>
          <b>Esto no se pudo actualizar.</b> Lo que ves es de hace un momento. {causa}
        </span>
      </div>
      <button type="button" className="fd-btn sec" onClick={() => void alReintentar()}>
        Reintentar
      </button>
    </div>
  );
}
