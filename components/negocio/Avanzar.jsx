'use client';

/* Avanzar: el único lugar donde se registra cómo terminó una conversación.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * DOS PASOS, Y EL SEGUNDO ES LA MITAD QUE SE OLVIDA
 *
 * **Paso 1 · ¿cómo terminó?** Las seis tarjetas. Un clic y listo — es el 90 % de los usos y tiene
 * que costar un clic.
 *
 * **Paso 2 · el detalle.** La subcategoría, el monto si corresponde, la nota, y cuándo volver.
 * Existe porque sin él la píldora diría `VENTA` y nada más: sin forma de pago, sin monto, y los
 * números de Inicio sumarían una venta de cero pesos.
 *
 * Los dos pasos son el MISMO modal y no dos ventanas: cerrar y volver a abrir entre uno y otro
 * pierde lo que se eligió, y el `02` § 1 es explícito en que registrar no puede hacer perder el
 * contexto.
 *
 * ── SE REUSA `Ventana.jsx`, Y ES DELIBERADO ─────────────────────────────────
 *
 * Las cuatro propiedades que hacen que un modal no esté roto —foco que entra y vuelve, trampa del
 * tabulador, Escape, y «montado = visible» sin depender de una animación— ya viven ahí con sus
 * motivos escritos y su prueba. `Ficha.jsx` las copió porque es un panel lateral con tres zonas;
 * esto **sí es** un modal centrado, así que no hay nada que copiar.
 *
 * Lo que sí se toma del prototipo son las clases de las tarjetas —`.res-g`, `.res-o`, `.ic`— para
 * que el aspecto sea el que ya estaba diseñado.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useMemo, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';

/* Lo que declara `app/api/contactos/[id]/avanzar/route.ts` en su `maxDuration`, en milisegundos.

   La regla está escrita en `lib/http/cliente.ts`: quien llama a una ruta con tope tiene que
   esperar AL MENOS ese tope. Esperando menos, el navegador aborta mientras el servidor sigue
   trabajando, y entonces se reporta un fallo sobre algo que salió bien — que es exactamente lo
   que pasó acá: la escritura ya estaba confirmada y el cartel decía que no se había registrado
   nada. `pruebas/codigo/132-avanzar-sin-respuesta.test.ts` ata los dos números para que no puedan
   separarse. */
const ESPERA_DE_AVANZAR_MS = 30_000;
import { salidasDe, modosDe } from '../../lib/negocio/salidas.ts';
import Ventana from '../Ventana.jsx';
import { useSesion } from '../../app/sesion-contexto.tsx';

/** El día de hoy en `YYYY-MM-DD`, para el mínimo del campo de fecha. */
function hoy() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * ── `territorio` DECIDE QUÉ TARJETAS SE DIBUJAN ─────────────────────────────
 *
 * El closer tiene seis salidas y el setter cinco, y **ninguna de las dos listas sirve para el otro**:
 * las dos tienen una `seguimiento` que pide cosas distintas y ofrece modos distintos.
 *
 * Llega como propiedad y no se lee de un global porque la ficha se abre desde las dos pestañas sobre
 * el mismo componente. Y viene del SERVIDOR, dentro de la fila del contacto: dejar que la pantalla
 * lo dedujera de en qué pestaña está sería dejar que el navegador elija el negocio.
 *
 * `null` —un contacto congelado— no dibuja ninguna: no hay vocabulario con el que registrar, y el
 * servidor lo rechaza con ese motivo. Es lo mismo que decir el `07` § 4: no se muestra un control
 * que no puede cumplir.
 */
export default function Avanzar({ contactoId, nombre, territorio, citas = [], alCerrar, alRegistrar }) {
  /* La zona de la EMPRESA, igual que el resto de la ficha. Con la del navegador, un closer que
     viaja vería la cita de las 9 rotulada a las 11 y elegiría la equivocada de una lista de dos. */
  const zona = useSesion()?.organizacion.zonaHoraria ?? 'UTC';
  /** La salida elegida. `null` = paso 1. */
  const [elegida, setElegida] = useState(null);
  const [detalle, setDetalle] = useState('');
  const [monto, setMonto] = useState('');
  const [nota, setNota] = useState('');
  const [volverEl, setVolverEl] = useState('');
  /** El modo, para las salidas que los tienen. `''` = todavía no eligió, y el botón lo exige. */
  const [modo, setModo] = useState('');
  /* ── LA CITA Y LA ASISTENCIA ───────────────────────────────────────────────
   *
   * `citaId` arranca en la más reciente cuando hay exactamente una: con una sola candidata no hay
   * nada que elegir, y obligar a elegirla es un clic que sólo puede salir bien. Con varias arranca
   * vacío, porque ahí sí hay una decisión y adivinarla la escondería.
   *
   * `asistio` arranca en `null` —«todavía no contestó»— y NO en `true`. Preseleccionar el sí
   * convertiría la pregunta en un trámite y la tasa en «cuántos apretaron Registrar»: lo que se
   * quiere medir es lo que alguien afirmó, no lo que dejó como venía. */
  const [citaId, setCitaId] = useState(() => (citas.length === 1 ? citas[0].id : ''));
  const [asistio, setAsistio] = useState(null);
  const [enviando, setEnviando] = useState(false);

  /* ────────────────────────── UNA CLAVE POR APERTURA DE ESTE PANEL ──────────────────────────

     `Ficha.jsx` dibuja `{avanzando ? <Avanzar/> : null}`, así que este componente nace y muere
     con cada apertura y el inicializador de `useState` corre UNA vez por apertura. Eso es
     exactamente el alcance que se pidió:

       · reintentar después de un corte manda la MISMA clave, choca contra el índice único, y no
         escribe un segundo resultado — ni una segunda nota, ni una segunda tarea en Mi Día;
       · cerrar el panel y volver a abrirlo genera otra, porque eso ya es una decisión de la
         persona y no un reintento.

     Va en `useState` y no en un `useRef` ni en una constante del módulo: en un `useRef` habría
     que inicializarlo aparte, y en el módulo la compartirían TODAS las fichas de la sesión — o
     sea que registrar sobre el segundo contacto chocaría con el primero y no escribiría nada.

     `crypto.randomUUID()` está en todo navegador con `https` o `localhost`, que es donde esta
     aplicación corre. */
  const [claveDeIntento] = useState(() => crypto.randomUUID());
  const [aviso, setAviso] = useState(null);

  /** Las salidas de ESTE territorio. Vacío cuando el contacto está congelado. */
  const salidas = useMemo(() => (territorio === null ? [] : salidasDe(territorio)), [territorio]);
  const def = useMemo(() => salidas.find((s) => s.salida === elegida) ?? null, [salidas, elegida]);
  /** Los modos que admite. Vacío en las salidas que no tienen. */
  const modos = useMemo(
    () => (territorio !== null && elegida !== null ? modosDe(territorio, elegida) : []),
    [territorio, elegida],
  );
  const elModo = useMemo(() => modos.find((m) => m.modo === modo) ?? null, [modos, modo]);

  /* ── `no_show` CONTESTA LA PREGUNTA SOLA ───────────────────────────────────
   *
   * «No apareció a la cita» y «no se presentó» son la misma afirmación. Preguntarla dos veces
   * invita a que discrepen —y el día que discrepen, la tabla tiene un plantón registrado como
   * asistencia— así que acá la pregunta no se dibuja y la respuesta sale de la salida elegida.
   *
   * Es la mitad visible de lo que la `049` hizo en el catálogo: sacó `'No-show'` de las opciones de
   * `nurture`, que era la otra forma de decir lo mismo. */
  const laSalidaYaLoDice = elegida === 'no_show';
  const respuesta = laSalidaYaLoDice ? false : asistio;
  /* ── SON DOS PREGUNTAS Y SÓLO UNA LA CONTESTA `no_show` ────────────────────
   *
   * «De cuál cita hablamos» sigue haciendo falta con `no_show` —si el contacto tiene dos, hay que
   * decir a cuál faltó— y «si vino» no. Colapsarlas en una sola bandera escondía el selector justo
   * en el caso que más importa registrar: el plantón de alguien con varias citas.
   *
   * Sin citas no se dibuja nada: un control que no puede cumplir es peor que su ausencia
   * (`07` § 4). */
  const seEligeLaCita = citas.length > 0;
  const sePreguntaSiVino = seEligeLaCita && !laSalidaYaLoDice;
  /** La elegida, o la única. `null` = todavía no hay a cuál colgar la respuesta. */
  const laCita = useMemo(() => citas.find((c) => c.id === citaId) ?? null, [citas, citaId]);

  /* ── LA FECHA APARECE SEGÚN EL MODO, Y ES LA MITAD VISIBLE DE LA REGLA ─────
   *
   * Con `manual` hace falta —es el día en que el contacto aparece en Mi Día— y con `automatico`
   * estorba: la persecución la hace la secuencia del CRM con su propio calendario, así que un día
   * nuestro no lo usaría nadie. El servidor rechaza esa combinación; esto es para que no haya que
   * descubrirlo con un rechazo.
   *
   * Y para las cinco salidas sin modos la fecha sigue estando: un recordatorio después de un no-show
   * es útil, y ahí nadie del CRM persigue a nadie. */
  const pideFecha = modos.length === 0 || elModo?.exigeFecha === true;

  /* El monto es obligatorio cuando la salida lo pide, y el botón lo respeta. NO es la defensa: el
     servidor valida lo mismo, porque cualquiera puede llamar al endpoint con una herramienta de
     línea de comandos. Esto es para que no haya que descubrirlo con un rechazo. */
  const puedeRegistrar =
    def !== null &&
    !enviando &&
    (!def.pideMonto || (monto.trim() !== '' && Number(monto) >= 0)) &&
    // Un modo sin elegir no tiene valor por omisión posible: los dos hacen cosas disjuntas.
    (modos.length === 0 || elModo !== null) &&
    // Y `manual` sin fecha no tiene día que poner en Mi Día.
    (!pideFecha || modos.length === 0 || volverEl !== '') &&
    /* La mitad no se acepta: una cita elegida sin respuesta se guardaría como «nadie sabe», que es
       exactamente el estado del que esta pantalla existe para salir. El servidor rechaza lo mismo,
       porque cualquiera puede llamar al endpoint; esto es para no descubrirlo con un rechazo. */
    (!sePreguntaSiVino || citaId === '' || asistio !== null);

  const registrar = useCallback(async () => {
    if (!def) return;
    setEnviando(true);
    setAviso(null);

    const r = await pedir(`/api/contactos/${contactoId}/avanzar`, {
      metodo: 'POST',
      espera: ESPERA_DE_AVANZAR_MS,
      cuerpo: {
        claveDeIntento,
        salida: def.salida,
        ...(detalle !== '' ? { detalle } : {}),
        ...(def.pideMonto ? { monto: monto.trim() } : {}),
        ...(nota.trim() !== '' ? { nota: nota.trim() } : {}),
        ...(modos.length > 0 ? { modo } : {}),
        /* La fecha se manda SOLO si el modo la usa. Mandándola con `automatico` el servidor
           rechaza —y tiene razón—, y eso pasaría si alguien elige un día, cambia a automático y
           registra: el campo está oculto pero su estado sigue teniendo el valor viejo. */
        ...(pideFecha && volverEl !== '' ? { volverEl } : {}),
        /* Las dos juntas o ninguna. Con `no_show` la cita se manda igual —hay a cuál colgar el
           plantón— pero la respuesta no la eligió nadie: la dice la salida. */
        ...(laCita !== null && respuesta !== null
          ? { citaId: laCita.id, asistio: respuesta }
          : {}),
      },
    });
    setEnviando(false);

    if (r.tipo !== 'datos') {
      /* ────────────────────────── LO QUE ESTE CARTEL NO PUEDE AFIRMAR ──────────────────────────
       *
       * Acá decía **«No se registró nada»**, y era falso. La ruta está escrita en dos pasos y su
       * propio comentario lo dice: *«PASO 1 · LA BASE, en una transacción»* y *«PASO 2 · EL CRM, y
       * su fallo NO invalida el paso 1»*. O sea que cuando la respuesta no llega, **el resultado
       * ya puede estar escrito**: el corte pudo caer después de confirmar la transacción.
       *
       * Y `registrarResultado` hace un `insertInto('resultados')` sin guarda de duplicado. Así que
       * el cartel no era solo impreciso: **invitaba a duplicar el resultado**, con su nota, su
       * tarea en Mi Día y su comisión.
       *
       * ────────────────────────── SON DOS FAMILIAS Y HAY QUE SEPARARLAS ──────────────────────────
       *
       *   · **Rechazos con código** —`no_encontrado`, `peticion_invalida`, `sin_permiso`— salen de
       *     la ruta ANTES de escribir, o desde la transacción sin insertar. Sobre ésos sí se puede
       *     decir qué pasó, y se dice con el detalle que manda el servidor.
       *   · **Corte sin respuesta, y `sin_codigo`** —que es lo que devuelve `pedir()` cuando el
       *     cuerpo no es JSON, o sea un 502/504 de la plataforma con HTML— son DESENLACE
       *     DESCONOCIDO. Un 504 por el tope de la ruta llega justo después de escribir.
       *
       * Sobre la segunda familia lo único honesto es decir que no se sabe, y mandar a mirar. El
       * Historial del contacto es la pestaña de al lado: comprobarlo cuesta un clic, y registrar
       * dos veces cuesta una comisión mal pagada. */
      const desenlaceDesconocido =
        r.tipo === 'sin_respuesta' || (r.tipo === 'rechazado' && r.codigo === 'sin_codigo');

      setAviso({
        mal: true,
        texto: desenlaceDesconocido
          ? 'Se cortó antes de saber cómo terminó, así que PUEDE haber quedado registrado. ' +
            'Revisá el Historial de este contacto antes de volver a registrarlo: si ya está, ' +
            'registrarlo otra vez lo cuenta dos veces.'
          : (r.detalle ?? `No se pudo registrar (${r.estado}).`),
      });
      return;
    }

    /* ── LO QUE PASÓ CON EL CRM SE DICE, NO SE ESCONDE ──────────────────────
     *
     * El resultado quedó registrado —los números y la columna ya se movieron— pero mientras el
     * aviso no llegue **el CRM no disparó sus automatismos**: la secuencia de recuperación de un
     * no-show, por ejemplo. Colapsarlo en «listo» sería reportar un éxito a medias como completo.
     */
    /* Si esta clave ya había registrado, lo que sigue en pantalla es lo de ANTES. Se dice: sin
       esto, quien reintentó después de un corte creería que registró dos veces e iría a
       «corregir» algo que está bien. */
    alRegistrar?.({
      yaEstaba: Boolean(r.datos.yaEstaba),
      salida: def.salida,
      etapa: r.datos.etapa,
      crm: r.datos.crm,
      nota: r.datos.nota,
      tarea: r.datos.tarea,
      modo,
    });
    alCerrar?.();
  }, [def, contactoId, detalle, monto, nota, volverEl, laCita, respuesta, alRegistrar, alCerrar]);

  // ─── Paso 1 · las seis tarjetas ───────────────────────────────────────────

  if (def === null) {
    return (
      <Ventana
        titulo="¿Cómo terminó?"
        subtitulo={
          nombre
            ? `Resultado de ${nombre}. Sirve igual tras una llamada o tras el chat.`
            : 'Sirve igual tras una llamada o tras el chat.'
        }
        alCerrar={alCerrar}
      >
        <div className="res-g">
          {salidas.map((s) => (
            <button
              key={s.salida}
              type="button"
              className={`res-o ${s.clase}`}
              onClick={() => {
                setElegida(s.salida);
                setDetalle('');
                setAviso(null);
              }}
            >
              <span className={`ic ${s.clase}`}>{s.icono}</span>
              <span>
                <b>{s.nombre}</b>
                <span>{s.detalle}</span>
              </span>
            </button>
          ))}
        </div>
      </Ventana>
    );
  }

  // ─── Paso 2 · el detalle ──────────────────────────────────────────────────

  return (
    <Ventana
      titulo={def.nombre}
      subtitulo={def.detalle}
      alCerrar={alCerrar}
    >
      {/* VOLVER, y no cerrar. Elegir mal la tarjeta es el error más probable de los dos pasos, y
          la salida no puede ser perder el modal y volver a abrirlo. */}
      <button
        type="button"
        className="fd-btn sec"
        style={{ marginBottom: 14 }}
        onClick={() => {
          setElegida(null);
          setAviso(null);
        }}
      >
        ← Elegir otro resultado
      </button>

      {/* ── LA ASISTENCIA, ARRIBA DE TODO ────────────────────────────────────
          Va primero y no al final porque es lo único de este paso que **no se puede reconstruir
          después**: el monto está en el CRM, la nota se puede volver a escribir, y si alguien se
          presentó o no sólo lo sabe quien estuvo en la llamada. Al final del formulario, es lo
          primero que se saltea. */}
      {seEligeLaCita ? (
        <div className="fd-campo">
          <label htmlFor="av-cita">
            {laSalidaYaLoDice ? '¿A qué cita no se presentó?' : '¿Se presentó a la cita?'}
          </label>
          {citas.length > 1 ? (
            <select
              id="av-cita"
              value={citaId}
              onChange={(e) => {
                setCitaId(e.target.value);
                setAsistio(null);
              }}
              style={{ marginBottom: 8 }}
            >
              {/* Vacío es legítimo: este resultado puede no ser de ninguna de sus citas. */}
              <option value="">No es sobre ninguna de estas citas</option>
              {citas.map((c) => (
                <option key={c.id} value={c.id}>
                  {cuandoFue(c.inicioEl, zona)}
                  {c.titulo ? ` · ${c.titulo}` : ''}
                </option>
              ))}
            </select>
          ) : (
            /* Con una sola no hay nada que elegir, pero SÍ hay que decir de cuál se habla: sin
               esta línea, «¿se presentó?» no dice a qué, y la respuesta se da a ciegas. */
            <div className="aj-ayuda" style={{ marginBottom: 8 }}>
              La del {cuandoFue(citas[0].inicioEl, zona)}
              {citas[0].titulo ? ` · ${citas[0].titulo}` : ''}.
            </div>
          )}

          {sePreguntaSiVino && citaId !== '' ? (
            <div className="res-si-no">
              {[
                { valor: true, texto: 'Sí, se presentó' },
                { valor: false, texto: 'No apareció' },
              ].map((o) => (
                <button
                  key={String(o.valor)}
                  type="button"
                  className={`fd-btn ${asistio === o.valor ? '' : 'sec'}`}
                  aria-pressed={asistio === o.valor}
                  onClick={() => setAsistio(o.valor)}
                >
                  {o.texto}
                </button>
              ))}
            </div>
          ) : null}

          {/* Con `no_show` la respuesta no se pide: la salida ya la dio. Se dice, para que nadie
              busque el control que falta y crea que la pantalla está rota. */}
          {laSalidaYaLoDice ? (
            <div className="aj-ayuda">
              Queda registrada como no presentada. Elegiste «No-show», así que no hace falta
              decirlo dos veces.
            </div>
          ) : laCita !== null && laCita.asistio !== null ? (
            /* Lo que ya se había respondido. Sin esto, reabrir Avanzar sobre una cita ya cerrada
               pregunta en blanco, y la segunda respuesta —dada sin acordarse de la primera— pisa a
               la primera sin que nada lo advierta. */
            <div className="aj-ayuda">
              Ya estaba registrada como <b>{laCita.asistio ? 'presentada' : 'no presentada'}</b>.
              Responder de nuevo la pisa.
            </div>
          ) : (
            <div className="aj-ayuda">
              Es lo único de esta pantalla que no está en el CRM: su campo de asistencia está vacío
              en 1049 de 1052 citas.
            </div>
          )}
        </div>
      ) : null}

      {def.pideMonto ? (
        <div className="fd-campo">
          <label htmlFor="av-monto">Monto</label>
          <input
            id="av-monto"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={monto}
            placeholder="0.00"
            onChange={(e) => setMonto(e.target.value)}
          />
          {/* Se dice POR QUÉ es obligatorio. Un campo requerido sin motivo se lee como un trámite;
              con el motivo se entiende que el número va a algún lado. */}
          <div className="aj-ayuda">
            De acá sale el «cobrado» de Inicio. Sin monto, esta venta sumaría cero.
          </div>
        </div>
      ) : null}

      {def.etiquetaDelCampo ? (
        <div className="fd-campo">
          <label htmlFor="av-detalle">{def.etiquetaDelCampo}</label>
          <select id="av-detalle" value={detalle} onChange={(e) => setDetalle(e.target.value)}>
            {/* Vacío SÍ es una opción legítima acá, al contrario del rol de una persona: la
                subcategoría afina la píldora y no habilita nada. Obligarla haría inventar una. */}
            <option value="">Sin especificar</option>
            {def.opciones.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="fd-campo">
        <label htmlFor="av-nota">Nota</label>
        <textarea
          id="av-nota"
          rows={3}
          value={nota}
          placeholder="Qué se dijo, en una línea."
          onChange={(e) => setNota(e.target.value)}
        />
        <div className="aj-ayuda">
          Va al historial del contacto, en la pestaña Notas. Opcional.
        </div>
      </div>

      {/* ── EL MODO, Y SOLO PARA LA SALIDA QUE LO TIENE ─────────────────────
          Se dibuja desde el catálogo, no desde una lista escrita acá: es la misma tabla que valida
          el servidor, así que esta pantalla no puede ofrecer un modo que dé 400.

          Son botones y no un desplegable a propósito: las dos opciones hacen cosas disjuntas y cada
          una necesita su renglon de explicación. Un `select` esconde el detalle justo cuando hay que
          leerlo, y la diferencia —quién persigue a esta persona— no es obvia por el nombre. */}
      {modos.length > 0 ? (
        <div className="fd-campo">
          <label>¿Quién lo persigue?</label>
          <div className="av-modos">
            {modos.map((m) => (
              <button
                key={m.modo}
                type="button"
                className={`av-modo${modo === m.modo ? ' on' : ''}`}
                aria-pressed={modo === m.modo}
                onClick={() => setModo(m.modo)}
              >
                <b>{m.nombre}</b>
                <span>{m.detalle}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {pideFecha ? (
      <div className="fd-campo">
        <label htmlFor="av-volver">Volver el</label>
        <input
          id="av-volver"
          type="date"
          value={volverEl}
          min={hoy()}
          onChange={(e) => setVolverEl(e.target.value)}
        />
        <div className="aj-ayuda">
          {modos.length > 0
            ? 'El día que este contacto te aparece en Mi Día.'
            : 'Crea una tarea para ese día en Mi Día. Opcional — dejalo vacío si no hay que volver.'}
        </div>
      </div>
      ) : null}

      {aviso ? (
        <div className={`fd-aviso ${aviso.mal ? 'mal' : 'bien'}`} role="status">
          <i>{aviso.mal ? '⚠' : '✓'}</i>
          <span>{aviso.texto}</span>
        </div>
      ) : null}

      <div className="aj-fila">
        <button type="button" className="fd-btn" disabled={!puedeRegistrar} onClick={() => void registrar()}>
          {enviando ? 'Registrando…' : `Registrar ${def.nombre.toLowerCase()}`}
        </button>
        <button type="button" className="fd-btn sec" disabled={enviando} onClick={() => alCerrar?.()}>
          Cancelar
        </button>
      </div>
    </Ventana>
  );
}

/**
 * Cuándo fue la cita, en la zona de la empresa. **Sólo para elegir entre varias.**
 *
 * `2-digit` es una preferencia y no una promesa —`Intl` puede devolver un dígito—, y acá no
 * importa: esto rotula opciones de una lista, no arma una columna alineada. Lo que sí importa es
 * que las dos opciones se distingan, y para eso alcanza el día y la hora.
 *
 * Una fecha ilegible devuelve un texto que lo dice, en vez de `Invalid Date`: el `select` lo
 * mostraría igual, y quien elija no tendría forma de saber cuál eligió.
 */
function cuandoFue(inicioEl, zona) {
  const d = new Date(inicioEl);
  if (Number.isNaN(d.getTime())) return 'fecha desconocida';
  return new Intl.DateTimeFormat('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: zona,
  }).format(d);
}
