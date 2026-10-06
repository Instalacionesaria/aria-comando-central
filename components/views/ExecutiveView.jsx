'use client';

/* El Inicio (`docs/OTROS/nueva-estructura/04-EL-INICIO.md`, `NE-29`): la mascota, el saludo y el chat del
 * cerebro (`docs/OTROS/agentes/03-EL-CEREBRO.md`, AG-40 a AG-55; AG7 de los agentes).
 *
 * ── LO QUE HABÍA ACÁ ────────────────────────────────────────────────────────
 *
 * La maqueta del Executive: un organigrama, un embudo y una reunión con cifras escritas a mano, y un
 * chat que elegía entre respuestas fijas por palabras clave. Se fue el 2026-10-01 con sus seis módulos
 * del navegador, el panel lateral y la barra «Pregúntale a Executive sobre …» (`NE-30`). El inventario de
 * lo que era está en `docs/OTROS/estado actual/11-EXECUTIVE.md`. Después, hasta AG7, la caja estuvo
 * deshabilitada, diciendo que el cerebro llegaba en una próxima etapa.
 *
 * ── EL CHAT ─────────────────────────────────────────────────────────────────
 *
 * Habla con `app/api/executive/route.ts` por `lib/agentes/usarCerebro.ts`. Todo lo que se dibuja de una
 * respuesta lo devolvió el servidor, ya validado contra la evidencia: acá no hay ninguna cifra. La caja se
 * habilita sólo con el estado `listo`; con cualquier otro, dice por qué con el texto de la tabla de AG-52
 * (`lib/agentes/pantalla.ts`), que es el mismo estado con que el servidor rechazaría la pregunta.
 *
 * Sin conversación abierta se ve como antes: la mascota grande, el saludo y la caja, centrados, y debajo la
 * Reunión de hoy (AG15, `components/cerebro/ReunionDeHoy.jsx`), que también trae el servidor: tocar un tema lo
 * abre como conversación. Con una conversación, los turnos ocupan el lugar del saludo y la caja queda debajo.
 * Cuántos temas de hoy ve la persona se publica para el contador de la barra. Los hilos se abren desde
 * CONVERSACIONES, en la barra (`components/cerebro/ConversacionesDeLaBarra.jsx`), que los lee de lo que
 * este chat publica: la barra no le pide nada al servidor.
 *
 * ── LO QUE NO SE DIBUJA, Y POR QUÉ ──────────────────────────────────────────
 *
 *   · «@ agente»: abre la herramienta que crea con el pedido cargado, y las que hoy crean viven en ICP &
 *     Oferta, que se integra con otra rama antes de tocarla (`08-LAS-ETAPAS.md`, AG7);
 *   · el selector de áreas y el «+»: el cerebro lee lo que la persona ve, y no se adjunta nada (AG-51).
 *
 * La pantalla conserva su clave `executive` —el `id` de la vista y el `check` de la base no cambian
 * (`05-LO-QUE-NO-CAMBIA.md`)— y se llama «Inicio» en el menú, desde `lib/autorizacion/secciones.ts`. Ese
 * nombre no se escribe acá: el titular es el saludo. */
import { useCallback, useEffect, useState } from 'react';
import { useSesion } from '../../app/sesion-contexto.tsx';
import { estaALaVista } from '../../lib/vista.ts';
import { irALaVista } from '../../lib/aios/shell.js';
import { saludo } from '../../lib/saludo.ts';
import { puedeIrAAjustes, RUTA_DEL_INICIO, textoDelEstado } from '../../lib/agentes/pantalla.ts';
import { usarCerebro } from '../../lib/agentes/usarCerebro.ts';
import { alCambiarLosHilos, usarPublicarHilos, usarPublicarTemasDeHoy } from '../../lib/agentes/hilos-de-la-barra.ts';
import { alPedirHiloDelInicio, tomarHiloDelInicio } from '../../lib/agentes/traspaso.ts';
import Mascota from '../marca/Mascota.jsx';
import Conversacion from '../cerebro/Conversacion.jsx';
import ReunionDeHoy from '../cerebro/ReunionDeHoy.jsx';

export default function ExecutiveView({ activa }) {
  const sesion = useSesion();
  /* Si el Inicio está a la vista: la mascota sólo mira el cursor mientras se la ve. Y cada vez que
     cambia, la vista se vuelve a dibujar y el saludo se recalcula: quien sale del Inicio a las 11:50 y
     vuelve a las 13:00 lee «Buenas tardes». Quedarse en la pantalla no lo actualiza. */
  const aLaVista = estaALaVista('executive');
  /* La hora de la EMPRESA, no la del navegador: ver `lib/saludo.ts`. `UTC` si la sesión no trajo la
     organización, que es lo que la guarda pone por omisión. */
  const linea = saludo(sesion?.usuarioNombre, sesion?.organizacion.zonaHoraria ?? 'UTC');
  const zona = sesion?.organizacion.zonaHoraria ?? 'UTC';
  /* El nombre de la empresa en la que está la persona —la que mira, si mira otra—: es de la que va a
     hablar el cerebro. Sin nombre, «tu agencia», que era el texto del diseño. */
  const empresa = sesion?.organizacion?.nombre?.trim() || 'tu agencia';
  const secciones = sesion?.secciones;
  const nombres = useCallback((clave) => secciones?.find((s) => s.clave === clave)?.nombre ?? clave, [secciones]);

  const publicar = usarPublicarHilos();
  const cerebro = usarCerebro(RUTA_DEL_INICIO, publicar);
  const { abrir, nueva, recargar } = cerebro;
  const publicarTemas = usarPublicarTemasDeHoy();
  const reunion = cerebro.panel?.reunion;
  // El contador de la barra: los temas de HOY que ve la persona. Antes de leer el panel no se publica nada.
  useEffect(() => {
    if (reunion !== undefined) publicarTemas(reunion?.deHoy ? reunion.temas.length : 0);
  }, [reunion, publicarTemas]);
  const [texto, setTexto] = useState('');
  // Borrar no tiene vuelta atrás: el primer clic pregunta, el segundo borra.
  const [porBorrar, setPorBorrar] = useState(false);

  /* Lo que pide la barra —abrir un hilo, o «Nueva conversación»— llega por el traspaso: puede haberse
     pedido antes de montar, y se toma una sola vez. Con el evento llega también el pedido, que es el único
     que hay si el navegador no deja guardar. */
  useEffect(() => {
    const atender = (delEvento) => {
      const pedido = tomarHiloDelInicio() ?? delEvento ?? null;
      if (!pedido) return;
      if (pedido.hilo === null) nueva();
      else void abrir(pedido.hilo);
    };
    atender();
    return alPedirHiloDelInicio(atender);
  }, [abrir, nueva]);

  // Lo que se pregunta o se borra en la caja del pie de una sección, también aparece en CONVERSACIONES.
  useEffect(() => alCambiarLosHilos(() => void recargar()), [recargar]);

  const estado = cerebro.panel?.estado ?? null;
  const motivo = estado ? textoDelEstado(estado, zona, nombres('credenciales')) : cerebro.causa;
  const listo = estado?.tipo === 'listo';
  const enCamino = cerebro.pendiente !== null;
  const hayConversacion = cerebro.turnos.length > 0 || enCamino;
  // Sin permiso para preguntar, la caja no se dibuja (AG-52).
  const sinCaja = estado?.tipo === 'sin_permiso';

  const enviar = async () => {
    const limpio = texto.trim();
    if (limpio === '' || !listo || enCamino) return;
    setTexto('');
    if (!(await cerebro.preguntar(limpio, null))) setTexto(limpio);
  };

  return (
    <section className={activa ? 'view on' : 'view'} id="v-executive">
      <div className={hayConversacion ? 'view-scroll inicio con-conversacion' : 'view-scroll inicio'}>
        {hayConversacion ? (
          <Conversacion turnos={cerebro.turnos} pendiente={cerebro.pendiente} nombres={nombres} aLaVista={aLaVista} />
        ) : (
          <>
            <Mascota className="inicio-mascota" diametro={88} sigue viva={aLaVista} />
            <h1 className="inicio-saludo">
              <span className="l1">{linea}</span>
              <span className="l2">¿Qué quieres saber de {empresa}?</span>
            </h1>
          </>
        )}

        {sinCaja ? null : (
          <form
            className="inicio-caja"
            onSubmit={(e) => {
              e.preventDefault();
              void enviar();
            }}
          >
            <textarea
              className="inicio-campo"
              rows={1}
              value={texto}
              disabled={!listo}
              /* Mientras se espera, sólo lectura y no deshabilitado: un campo deshabilitado suelta el foco, y
                 quien pregunta con Enter quedaba sin saber dónde estaba (lo encontró la revisión de AG7). */
              readOnly={enCamino}
              aria-busy={enCamino}
              placeholder="Pregúntale al cerebro…"
              aria-label="Pregúntale al cerebro"
              aria-describedby={motivo || cerebro.error ? 'inicioEstado' : undefined}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                // Enter pregunta, Shift+Enter hace un salto de línea: lo que espera quien usó un chat.
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void enviar();
                }
              }}
            />
            <div className="inicio-fila">
              {cerebro.hiloId !== null && !enCamino ? (
                <>
                  {/* El autor borra sus conversaciones (`D-14`): los hilos del Inicio no tienen otra caja. */}
                  {porBorrar ? (
                    <>
                      <button
                        type="button"
                        className="inicio-nueva"
                        onClick={() => {
                          setPorBorrar(false);
                          void cerebro.borrar(cerebro.hiloId);
                        }}
                      >
                        Sí, borrarla
                      </button>
                      <button type="button" className="inicio-nueva" onClick={() => setPorBorrar(false)}>
                        No
                      </button>
                    </>
                  ) : (
                    <button type="button" className="inicio-nueva" onClick={() => setPorBorrar(true)}>
                      Borrar esta conversación
                    </button>
                  )}
                  <button type="button" className="inicio-nueva" onClick={nueva}>
                    Nueva conversación
                  </button>
                </>
              ) : null}
              <button type="submit" className="inicio-enviar" disabled={!listo || enCamino || texto.trim() === ''} aria-label="Enviar">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            </div>
          </form>
        )}

        {motivo || cerebro.error ? (
          <p className={cerebro.error ? 'inicio-nota mal' : 'inicio-nota'} id="inicioEstado" role="status">
            {cerebro.error ?? motivo}
            {estado && puedeIrAAjustes(estado) ? (
              <>
                {' '}
                <button type="button" className="inicio-enlace" onClick={() => irALaVista('credenciales', { pestana: 'credenciales' })}>
                  Ir a {nombres('credenciales')}
                </button>
              </>
            ) : null}
          </p>
        ) : null}
        {hayConversacion ? null : (
          <ReunionDeHoy
            reunion={reunion}
            // Abrir escribe un hilo: hace falta `cerebro.usar` y no estar mirando otra empresa. La llave y el tope no.
            puedeAbrir={estado !== null && estado.tipo !== 'sin_permiso' && estado.tipo !== 'delegacion'}
            alAbrir={(clave) => void cerebro.abrirTema(clave)}
          />
        )}
      </div>
    </section>
  );
}
