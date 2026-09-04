'use client';

/* El agente que hace las preguntas del formulario, hablando.
   ==========================================================================
   La otra mitad de los dos paneles —`PanelHerramienta` y `PanelResearch`—: las mismas preguntas y
   el mismo entregable después. Lo único que cambia es cómo se llega a las respuestas.

   UNO SOLO para las nueve herramientas, por lo mismo que hay un solo módulo de agente en el
   servidor: nueve chats con su propia burbuja y su propio manejo de errores divergen en la primera
   corrección, y ocho quedan con el defecto que se arregló en la novena.

   ── ESTE COMPONENTE NO SABE LAS PREGUNTAS, Y NO PUEDE SABERLAS ─────────────

   Las hace el servidor a partir del catálogo de campos (ver `lib/fundaciones/conversacion.ts`), y
   acá solo se dibujan los turnos. Es a propósito: una copia de las preguntas en el navegador sería
   la lista paralela con la peor forma posible — la de arriba se vería perfecta mientras el
   entregable se genera con otras respuestas.

   ── EL HISTORIAL NO SE ARMA ACÁ ────────────────────────────────────────────

   Se manda UNA línea y el servidor devuelve la conversación entera, leída del almacén. Este
   componente nunca le agrega el turno del agente por su cuenta, ni siquiera para que se vea más
   rápido: es el mismo motivo por el que las salidas de los cinco pasos vienen del servidor. Lo que
   el navegador arma, el navegador lo puede armar mal — y una conversación con un turno inventado no
   se distingue de una real.

   Lo único que se dibuja sin haber vuelto del servidor es el turno de la persona mientras espera, y
   se dibuja aparte (`pendiente`), nunca dentro de la lista guardada. */

import { useEffect, useRef, useState } from 'react';

import { ESPERA_DE_RUTA_LARGA_MS, pedir } from '@/lib/http/cliente';
import { camposDe, claveCorta } from '@/lib/fundaciones/campos';
import { VERSION_DEL_AGENTE } from '@/lib/fundaciones/version-del-agente';
import { SIN_RESPUESTA, mensajeDeRechazo } from '@/lib/fundaciones/mensajes';

export default function ChatDeHerramienta({
  herramienta,
  /* El valor por omisión cubre UNA ventana concreta: la de un despliegue a mitad de camino, con la
     pantalla nueva pidiéndole el estado a un servidor que todavía no devuelve la llave del chat.
     Sin él, `inicial.messages` revienta la pestaña entera —incluido el documento ya generado, que
     no tiene nada que ver— por un documento del almacén que casi siempre está vacío. */
  inicial = { messages: [], answers: {} },
  puedeEditar,
  corriendo,
  onRespuestas,
  onArrancar,
  rutaConversar,
  /* Al montar, en vez de retomar la conversación guardada, empezar una nueva. Lo pide el panel
     cuando se llegó por «Continuar al paso N» y la herramienta todavía no tiene entregable: la
     conversación vieja —de antes de que el agente supiera proponer, o abandonada a medias— no sirve
     para arrancar, y una apertura nueva trae las propuestas hechas con lo que HOY existe. */
  reiniciarAlAbrir = false,
  /* Se llegó por «Continuar al paso N»: además de reabrir proponiendo, ARRANCAR si alcanza. El
     servidor decide si alcanza; si sí, devuelve `listo` y `aplicar` dispara la generación. */
  generarAlAbrir = false,
}) {
  const [mensajes, setMensajes] = useState(() => [...inicial.messages]);
  const [respuestas, setRespuestas] = useState(() => ({ ...inicial.answers }));
  const [texto, setTexto] = useState('');
  const [pendiente, setPendiente] = useState(null);
  const [esperando, setEsperando] = useState(false);
  /* Distinto de `esperando`: la apertura lee la ficha y el research para proponer, y tarda. Un
     «escribiendo…» ahí es mentira chica —no está escribiendo, está leyendo— y sin ninguna señal la
     pantalla parece muerta. Kevin: «no miro ni una bolita dando vueltas ni nada». */
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState(null);

  const campos = camposDe(herramienta);
  const hilo = useRef(null);
  /* React monta dos veces en desarrollo, y abrir la conversación ESCRIBE. La escritura es
     idempotente —el mismo saludo sobre la misma llave— así que el guard no evita un daño, evita una
     segunda llamada que confunde a quien mire los registros buscando otra cosa. */
  const yaSeAbrio = useRef(false);

  const aplicar = (datos) => {
    setMensajes(datos.mensajes);
    setRespuestas(datos.respuestas);
    onRespuestas(datos.respuestas);
    if (datos.listo) onArrancar(datos.respuestas);
  };

  const hablar = async (cuerpo) => {
    setError(null);
    setEsperando(true);
    const r = await pedir(rutaConversar, {
      metodo: 'POST',
      cuerpo: { herramienta: herramienta.id, ...cuerpo },
      espera: ESPERA_DE_RUTA_LARGA_MS,
    });
    setEsperando(false);
    setPendiente(null);
    if (r.tipo !== 'datos') {
      setError(
        r.tipo === 'rechazado' ? mensajeDeRechazo(r.codigo, r.estado, r.detalle) : SIN_RESPUESTA,
      );
      return false;
    }
    aplicar(r.datos);
    return true;
  };

  // Abrir la conversación. No gasta una inferencia: el saludo lo arma el servidor con el código.
  useEffect(() => {
    if (yaSeAbrio.current) return;
    /* Una conversación guardada por una versión anterior del agente se manda igual al servidor: él la
       reabre una vez, conservando lo contestado. Sin esto quedaría en pantalla tal como se guardó,
       con el agente viejo diciendo cosas que ya no son ciertas. */
    const anticuada = mensajes.length > 0 && (inicial.agent_version ?? 0) < VERSION_DEL_AGENTE;
    if (mensajes.length > 0 && !reiniciarAlAbrir && !anticuada) return;
    yaSeAbrio.current = true;
    setAbriendo(true);
    void hablar(reiniciarAlAbrir ? { reiniciar: true, generar: generarAlAbrir } : {}).finally(() =>
      setAbriendo(false),
    );
    // Una sola vez, al montar. `hablar` no se lista a propósito: se redefine en cada render y
    // volvería a abrir la conversación en cada uno.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al fondo con cada turno nuevo: lo último que se dijo es lo único que importa leer.
  useEffect(() => {
    if (hilo.current) hilo.current.scrollTop = hilo.current.scrollHeight;
  }, [mensajes, pendiente, esperando]);

  /* `corriendo` es lo que la pantalla esté haciendo con lo que el agente entregó: los cinco pasos
     del Research o la generación de un documento. Mientras eso pasa el chat no acepta turnos — un
     mensaje nuevo cambiaría las respuestas por debajo de una generación en curso. */
  const bloqueado = !puedeEditar || esperando || corriendo;

  const enviar = async () => {
    const limpio = texto.trim();
    if (limpio === '' || bloqueado) return;
    setTexto('');
    /* El turno se dibuja mientras se espera y NO se agrega a `mensajes`: si el modelo falla, el
       texto vuelve al cuadro y la conversación queda tal como está guardada. Mezclarlo con los
       turnos reales dejaría en pantalla un mensaje que el servidor nunca guardó. */
    setPendiente(limpio);
    const bien = await hablar({ mensaje: limpio });
    if (!bien) setTexto(limpio);
  };

  const reiniciar = async () => {
    if (bloqueado) return;
    setTexto('');
    await hablar({ reiniciar: true });
  };

  return (
    <div className="card">
      <div className="card-head">
        <span>Agente conversacional</span>
        <span className="hint">
          {esperando
            ? 'pensando…'
            : `${cuantosHay(campos, respuestas)} de ${campos.length} respuestas`}
        </span>
      </div>
      <div className="card-body fd-chat">
        <div className="fd-chat-hilo" ref={hilo}>
          {mensajes.map((m, i) => (
            <div key={i} className={`fd-burbuja ${m.role === 'user' ? 'mia' : 'agente'}`}>
              {m.content}
            </div>
          ))}
          {pendiente !== null ? <div className="fd-burbuja mia">{pendiente}</div> : null}
          {esperando ? (
            <div className="fd-burbuja agente esperando">
              <span className="fd-punto" />
              {abriendo ? 'Leyendo tu ficha y tu research para proponerte las respuestas…' : 'escribiendo…'}
            </div>
          ) : null}
        </div>

        {/* Lo que el agente lleva anotado, a la vista. No es decorativo: es lo que va a quedar en
            el formulario y lo que se va a usar para generar, y verlo mientras se habla es lo que
            permite corregir un dato mal entendido ANTES de pagar la generación. */}
        {cuantosHay(campos, respuestas) > 0 ? (
          <div className="fd-anotado">
            {campos.map((campo) => {
              const v = respuestas[claveCorta(campo.id)];
              if (!v || v.trim() === '') return null;
              return (
                <span key={campo.id} className="fd-anotado-uno">
                  <i>{campo.etiqueta}</i>
                  {v}
                </span>
              );
            })}
          </div>
        ) : null}

        {error ? (
          <div className="fd-aviso mal">
            <i>◍</i>
            <span>{error}</span>
          </div>
        ) : null}

        {puedeEditar ? (
          <div className="fd-chat-pie">
            {/* `fd-campo` y no una clase propia: es el MISMO cuadro de texto que el formulario, y
                pintarlo aparte habría estrenado un foco distinto para el mismo gesto — además de
                una sombra que el barrido de temas no alcanza (ver `107-sin-sombras`). */}
            <div className="fd-campo">
            <textarea
              value={texto}
              placeholder={corriendo ? 'Generando…' : 'Escribí tu respuesta…'}
              disabled={bloqueado}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                // Enter manda, Shift+Enter hace un salto de línea. Es lo que espera cualquiera que
                // haya usado un chat, y el trasfondo se contesta en varias líneas.
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void enviar();
                }
              }}
            />
            </div>
            <div className="fd-acciones">
              <button type="button" className="fd-btn" disabled={bloqueado} onClick={enviar}>
                Enviar
              </button>
              <button
                type="button"
                className="fd-btn sec"
                disabled={bloqueado}
                onClick={reiniciar}
                title="Borra la conversación y empieza de cero. Lo guardado no se toca."
              >
                Empezar de nuevo
              </button>
            </div>
          </div>
        ) : (
          <div className="fd-aviso">
            <i>◍</i>
            <span>
              Tu rol puede <b>ver</b> esta conversación pero no seguirla.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* Cuántas respuestas tiene anotadas el agente. La traducción de identificador a clave corta sale de
   `campos.ts` —la misma función que usa el servidor—, no de una copia local: es UNA línea de código
   y sería igual la lista paralela, con las dos mitades del chat leyendo claves distintas. */

function cuantosHay(campos, respuestas) {
  return campos.filter((c) => {
    const v = respuestas[claveCorta(c.id)];
    return v !== undefined && v.trim() !== '';
  }).length;
}
