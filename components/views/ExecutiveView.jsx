'use client';

/* El Inicio (`docs/OTROS/nueva-estructura/04-EL-INICIO.md`, `NE-29`), con lo que la data de hoy
 * permite decir: la mascota, el saludo y la caja del cerebro, que todavía no responde.
 *
 * ── LO QUE HABÍA ACÁ ────────────────────────────────────────────────────────
 *
 * La maqueta del Executive: un organigrama, un embudo y una reunión con cifras escritas a mano, y un
 * chat que elegía entre respuestas fijas por palabras clave. Se fue el 2026-10-01 con sus seis módulos
 * del navegador, el panel lateral y la barra «Pregúntale a Executive sobre …» (`NE-30`). El inventario de
 * lo que era está en `docs/OTROS/estado actual/11-EXECUTIVE.md`.
 *
 * ── LO QUE NO SE DIBUJA, Y POR QUÉ ──────────────────────────────────────────
 *
 *   · las tarjetas de «Reunión de hoy»: tienen que salir de reglas sobre datos reales —gasto en cero,
 *     citas sin asistencia, llamadas sin usar— que todavía no existen. Mostrar las del diseño sería
 *     volver a la maqueta;
 *   · «@ agente», el selector de áreas y el «+»: no hay qué elegir ni qué adjuntar hasta que haya
 *     cerebro;
 *   · una respuesta: la caja está deshabilitada, no manda nada y no finge nada.
 *
 * La pantalla conserva su clave `executive` —el `id` de la vista y el `check` de la base no cambian
 * (`05-LO-QUE-NO-CAMBIA.md`); no tiene rutas propias— y se llama «Inicio» en el menú, desde
 * `lib/autorizacion/secciones.ts`. Ese nombre no se escribe acá: el titular es el saludo. */
import { useSesion } from '../../app/sesion-contexto.tsx';
import { estaALaVista } from '../../lib/vista.ts';
import { saludo } from '../../lib/saludo.ts';
import Mascota from '../marca/Mascota.jsx';

export default function ExecutiveView({ activa }) {
  const sesion = useSesion();
  /* Si el Inicio está a la vista: la mascota sólo mira el cursor mientras se la ve. Y cada vez que
     cambia, la vista se vuelve a dibujar y el saludo se recalcula: quien sale del Inicio a las 11:50 y
     vuelve a las 13:00 lee «Buenas tardes». Quedarse en la pantalla no lo actualiza. */
  const aLaVista = estaALaVista('executive');
  /* La hora de la EMPRESA, no la del navegador: ver `lib/saludo.ts`. `UTC` si la sesión no trajo la
     organización, que es lo que la guarda pone por omisión. */
  const linea = saludo(sesion?.usuarioNombre, sesion?.organizacion.zonaHoraria ?? 'UTC');
  /* El nombre de la empresa en la que está la persona —la que mira, si mira otra—: es de la que va a
     hablar el cerebro. Sin nombre, «tu agencia», que era el texto del diseño. */
  const empresa = sesion?.organizacion?.nombre?.trim() || 'tu agencia';

  return (
    <section className={activa ? 'view on' : 'view'} id="v-executive">
      <div className="view-scroll inicio">
        <Mascota className="inicio-mascota" diametro={88} sigue viva={aLaVista} />

        <h1 className="inicio-saludo">
          <span className="l1">{linea}</span>
          <span className="l2">¿Qué quieres saber de {empresa}?</span>
        </h1>

        <div className="inicio-caja">
          <textarea
            className="inicio-campo"
            rows={1}
            disabled
            placeholder="Pregúntale al cerebro…"
            aria-label="Pregúntale al cerebro"
            aria-describedby="inicioEnCamino"
          />
          <div className="inicio-fila">
            <button type="button" className="inicio-enviar" disabled aria-label="Enviar" aria-describedby="inicioEnCamino">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>

        <p className="inicio-nota" id="inicioEnCamino">
          El cerebro llega en una próxima etapa: todavía no hay quien te responda acá.
        </p>
      </div>
    </section>
  );
}
