'use client';

/* La pantalla del técnico: qué patrones fallan en los agentes, y con qué corregirlos.
   ==========================================================================

   ── NO ES LA COLA ROJA, Y ESA ES TODA LA SEPARACIÓN DEL MÓDULO ────────────

   La cola roja vive en el Closer y en el Setter, donde trabaja el vendedor, y dice *«alguien tiene
   que tomar ESTA conversación ahora»*. Esto es lo otro: una lista que se mira cuando se puede, con
   correcciones para el prompt. Que fueran una sola cosa es el defecto que este módulo entero existe
   para arreglar — hacía que un *«podría ser más breve»* le apagara el agente a una persona real.

   ── DOS PESTAÑAS, Y LA SEGUNDA SE PIDIÓ ───────────────────────────────────

   Los cuadros de prompt vivían en el medio de esta misma página, entre los patrones y las
   conversaciones. Dos `textarea` de ocho filas empujaban las conversaciones auditadas debajo del
   borde de la pantalla: la lista existía y nadie la veía.

     · **Inicio** — los análisis. Es lo que se mira todos los días.
     · **Prompts** — los dos cuadros. Se abre cuando hay algo que corregir, que es otro momento.

   La barra se dibuja SIEMPRE, también mientras carga y con error. Una barra que aparece cuando
   llegan los datos hace que la pantalla salte, y deja sin salida a quien entró con un error.

   ── Y LOS ANÁLISIS VAN SEPARADOS POR AGENTE, NO EN UNA LISTA SOLA ─────────

   Se pidió así, y el motivo es que son dos trabajos distintos con dos prompts distintos: **LeadFlow**
   atiende la zona del Setter —califica y consigue la cita— y **AppFlow** la del Closer, donde entran
   los que ya están agendados. Un patrón de LeadFlow no se arregla tocando el prompt de AppFlow.

   Con una lista sola, «tres patrones abiertos» no dice a qué prompt ir, y el chip de severidad es lo
   único que distingue dos filas que se corrigen en archivos distintos.

   ── LOS TRES ESTADOS DE UN BLOQUE, Y LOS TRES SE VEN DISTINTO ─────────────

     1 · La empresa no audita → se dice CUÁL de las tres cosas falta y **no se atenúa**. Una tarjeta
         gris se lee como un defecto de la pantalla, y esto es un dato.
     2 · Audita y no hay análisis de ese agente → **un guion y un chip «sin datos»**, nunca `0 %` ni
         un tilde verde. Un cero medido y un cero por falta de datos se ven iguales en un número, y
         el segundo es el que hace tomar decisiones sobre nada.
     3 · Con datos → los números.

   Y el cuarto —cargando / listo / error— también se ve distinto, por lo mismo.

   ── EL CONTADOR DE CASOS ES `casos.length` ───────────────────────────────

   El servidor manda un caso por hallazgo y acá se agrupan. Con un contador que viaje al lado, un tope
   o un filtro de más harían que la pantalla dijera «×15 casos» mostrando tres. */

import { useCallback, useEffect, useState } from 'react';

import {
  NOMBRE_DEL_AGENTE,
  ORDEN_DE_LOS_AGENTES,
  POR_QUE_NO_AUDITA,
  QUE_HACE_EL_AGENTE,
  ZONA_DEL_AGENTE,
  agruparPorPatron,
  guardarElPrompt,
  leerLaPantalla,
} from '@/lib/auditor/vista';

/** Una fecha corta y legible. `null` se dibuja como un guion, nunca como «hoy». */
function cuando(valor) {
  if (!valor) return '—';
  return new Date(valor).toLocaleDateString('es', { day: '2-digit', month: 'short' });
}

/** El icono de la zona que atiende cada agente. Dice de un vistazo de quién es la cola. */
const ICONO_DEL_AGENTE = {
  chat_pre_agenda: '#i-setter',
  chat_post_agenda: '#i-closer',
};

const SUB = [
  { clave: 'inicio', nombre: 'Inicio', icono: '#i-exec' },
  { clave: 'prompts', nombre: 'Prompts', icono: '#i-tools' },
];

export default function PanelDeAuditoria() {
  const [pantalla, setPantalla] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  /* Qué patrón está abierto. Se guarda el CÓDIGO y no un índice: la lista se reordena al recargar
     —el orden es por cantidad de casos— y con un índice quedaría abierto otro patrón. */
  const [abierto, setAbierto] = useState(null);
  const [sub, setSub] = useState('inicio');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    const r = await leerLaPantalla();
    if (r.tipo === 'datos') setPantalla(r.pantalla);
    else {
      setError(r.mensaje);
      setPantalla(null);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /* Los patrones agrupados UNA vez, acá, y repartidos por agente más abajo. Agruparlos dentro de
     cada bloque recorrería la lista dos veces y —peor— dejaría dos llamadas que alguien puede
     cambiar de a una. */
  const patrones = pantalla ? agruparPorPatron(pantalla.casos) : [];
  const abiertos = patrones.length;
  const sinPrompt = pantalla ? pantalla.prompts.filter((p) => !p.texto).length : 0;

  return (
    <>
      {/* La barra, SIEMPRE. Ver el encabezado: si apareciera con los datos, la pantalla salta. */}
      <div className="cl-sub aud-sub">
        {SUB.map((s) => (
          <button
            key={s.clave}
            type="button"
            data-c={s.clave}
            className={sub === s.clave ? 'on' : undefined}
            onClick={() => setSub(s.clave)}
          >
            <svg viewBox="0 0 16 16">
              <use href={s.icono} />
            </svg>
            {s.nombre}
            {/* Los contadores solo si hay algo. Un `0` en una píldora al lado del nombre es ruido
                que se aprende a ignorar, y acá además sería un cero de dos significados. */}
            {s.clave === 'inicio' && abiertos > 0 ? <span className="cnt">{abiertos}</span> : null}
            {s.clave === 'prompts' && sinPrompt > 0 ? (
              <span className="cnt aud-cnt-falta">{sinPrompt}</span>
            ) : null}
          </button>
        ))}
      </div>

      <Cuerpo
        cargando={cargando}
        error={error}
        pantalla={pantalla}
        patrones={patrones}
        sub={sub}
        abierto={abierto}
        alAbrir={(p) => setAbierto(abierto === p ? null : p)}
        alRecargar={cargar}
      />
    </>
  );
}

/** Los cuatro estados de la carga, y los cuatro distintos. */
function Cuerpo({ cargando, error, pantalla, patrones, sub, abierto, alAbrir, alRecargar }) {
  if (cargando) return <p className="aud-estado">Cargando la auditoría…</p>;
  /* Un error dibujado como «no hay hallazgos» es el cero indistinguible que este módulo persigue en
     otras cuatro formas. */
  if (error) {
    return (
      <div className="aud-estado aud-error">
        <p>{error}</p>
        <button className="pr-btn" type="button" onClick={alRecargar}>
          Reintentar
        </button>
      </div>
    );
  }
  if (!pantalla) return null;

  if (sub === 'prompts') return <Prompts prompts={pantalla.prompts} alGuardar={alRecargar} />;

  return (
    <>
      {/* ── EL AVISO DE LA EMPRESA, ARRIBA Y NO DENTRO DE CADA BLOQUE ───────
          Es un hecho de la empresa entera, no de un agente. Repetirlo en los dos bloques lo haría
          leer como dos problemas distintos. */}
      {pantalla.noAudita ? (
        <div className="aud-aviso">
          <strong>Esta empresa todavía no audita.</strong>{' '}
          {POR_QUE_NO_AUDITA[pantalla.noAudita] ?? 'Falta configurar el auditor.'}
        </div>
      ) : null}

      {/* ── EL ALCANCE, DICHO ANTES DE QUE ALGUIEN LO PREGUNTE ──────────────
          Se auditan los DOS chats y ningún agente de llamada. Sin esta línea, quien sabe que hay
          agentes de voz en la cuenta lee esta pantalla como incompleta o —peor— como que sus
          llamadas salieron todas bien. El motivo es medido y está en `lib/auditor/pantalla.ts`. */}
      <p className="aud-alcance">
        Se auditan los <b>dos chats</b>. Los agentes de <b>llamada</b> todavía no: sus llamadas no
        dejan transcripción en esta base, así que no hay qué leer.
      </p>

      {ORDEN_DE_LOS_AGENTES.map((agente) => (
        <BloqueDelAgente
          key={agente}
          agente={agente}
          tarjeta={pantalla.tarjetas.find((t) => t.agente === agente)}
          patrones={patrones.filter((p) => p.casos[0]?.agente === agente)}
          conversaciones={pantalla.conversaciones.filter((c) => c.agente === agente)}
          hayMas={pantalla.hayMas}
          abierto={abierto}
          alAbrir={alAbrir}
        />
      ))}
    </>
  );
}

/**
 * Todo lo de UN agente, junto: sus números, sus patrones y sus conversaciones.
 *
 * Junto y no repartido en tres secciones por tipo, porque el trabajo es por agente: quien viene a
 * corregir el prompt de LeadFlow no necesita ver los patrones de AppFlow en la misma lista.
 */
function BloqueDelAgente({
  agente,
  tarjeta,
  patrones,
  conversaciones,
  hayMas,
  abierto,
  alAbrir,
}) {
  /* Sin tarjeta no hay nada que decir de este agente, y **no se dibuja un bloque vacío**. Pasa si el
     servidor deja de mandar una: mejor no mostrarlo que mostrar un marco con guiones. */
  if (!tarjeta) return null;
  const sinDatos = tarjeta.analizadas === 0;

  return (
    <section className="aud-agente">
      <header className="aud-agente-cabeza">
        <span className="aud-agente-icono">
          <svg viewBox="0 0 16 16">
            <use href={ICONO_DEL_AGENTE[agente] ?? '#i-chat'} />
          </svg>
        </span>
        <div className="aud-agente-quien">
          <h3>
            {NOMBRE_DEL_AGENTE[agente] ?? agente}
            <span className="aud-agente-zona">{ZONA_DEL_AGENTE[agente] ?? ''}</span>
          </h3>
          <span className="cre-desc">{QUE_HACE_EL_AGENTE[agente] ?? ''}</span>
        </div>

        {sinDatos ? (
          /* EL GUION Y EL CHIP, nunca `0 %` ni un tilde verde: nadie auditó todavía a este agente,
             y un cero acá se leería como «no encontró nada malo». */
          <div className="aud-agente-cifras">
            <span className="mon-cifra">—</span>
            <span className="aud-chip aud-chip-vacio">sin datos</span>
          </div>
        ) : (
          <div className="aud-agente-cifras">
            <span className="mon-cifra">{tarjeta.auditables}</span>
            <span className="aud-semaforo">
              <Nivel n={tarjeta.verdes} nivel="verde" />
              <Nivel n={tarjeta.amarillos} nivel="amarillo" />
              <Nivel n={tarjeta.rojos} nivel="rojo" />
            </span>
          </div>
        )}
      </header>

      {!sinDatos ? (
        <p className="aud-agente-pie">
          {/* LAS DOS CUENTAS, y por eso son dos. «Se miraron 40 y 19 no se pudieron juzgar» en un
              solo número no dice ninguna de las dos cosas. */}
          {tarjeta.analizadas} conversaciones miradas
          {tarjeta.analizadas > tarjeta.auditables
            ? `, ${tarjeta.analizadas - tarjeta.auditables} sin poder juzgar`
            : ''}
          {' · '}último {cuando(tarjeta.ultimoEl)}
          {tarjeta.tienePrompt ? '' : ' · sin prompt cargado'}
          {tarjeta.intervencionesAbiertas > 0 ? (
            <>
              {' · '}
              <span className="aud-urgente">
                {tarjeta.intervencionesAbiertas} en la cola de urgentes
              </span>
            </>
          ) : null}
        </p>
      ) : null}

      <Patrones patrones={patrones} agente={agente} abierto={abierto} alAbrir={alAbrir} />
      <Conversaciones conversaciones={conversaciones} hayMas={hayMas} agente={agente} />
    </section>
  );
}

/**
 * Un nivel del semáforo. **Un cero se dibuja NEUTRO, no del color de su nivel.**
 *
 * Se vio en pantalla: «0 rojo» con borde y letra rojos llama la atención sobre lo que NO pasó, que
 * es lo contrario de para qué está el color. En una tarjeta con tres chips, el ojo va al rojo
 * primero — y encontrar un cero ahí ensucia el único color que tenía que significar algo.
 *
 * El cero NO se esconde: «0 rojo» dicho en gris es información —ninguna conversación grave— y
 * sacarlo dejaría dos chips donde a veces hay tres, con la fila cambiando de forma según el dato.
 */
function Nivel({ n, nivel }) {
  /* Concuerda en número: «2 verdes», no «2 verde». Los tres niveles son regulares, así que la
     `s` alcanza y no hace falta una tabla. El cero va en PLURAL —«0 rojos»— que es lo correcto en
     castellano y lo que evita el «0 rojo» que se veía antes. */
  const etiqueta = n === 1 ? nivel : `${nivel}s`;
  return (
    <span className={`aud-chip aud-chip-${nivel}${n === 0 ? ' aud-chip-cero' : ''}`}>
      {n} {etiqueta}
    </span>
  );
}

/** Los patrones de UN agente: una fila por código, con sus casos adentro. */
function Patrones({ patrones, agente, abierto, alAbrir }) {
  return (
    <div className="aud-seccion">
      <div className="aud-seccion-cabeza">
        <h4>Patrones a corregir</h4>
        <span className="cre-desc">
          {patrones.length === 0
            ? 'Ninguno abierto'
            : `${patrones.length} ${patrones.length === 1 ? 'patrón' : 'patrones'}`}
        </span>
      </div>

      {patrones.length === 0 ? (
        /* El vacío DICE por qué está vacío. «Ningún patrón» a secas se lee igual con un auditor
           apagado que con un agente que funciona bien, y son cosas opuestas. */
        <p className="aud-vacio">
          Sin hallazgos abiertos para {NOMBRE_DEL_AGENTE[agente] ?? agente}. O está trabajando bien,
          o todavía no se auditó ninguna de sus conversaciones — las cifras de arriba lo dicen.
        </p>
      ) : (
        patrones.map((p) => (
          <div className="aud-patron" key={p.patron}>
            <button
              className="aud-patron-cabeza"
              type="button"
              onClick={() => alAbrir(p.patron)}
              aria-expanded={abierto === p.patron}
            >
              <span className={`aud-chip aud-chip-${p.severidad === 'rojo' ? 'rojo' : 'amarillo'}`}>
                {p.severidad === 'rojo' ? 'rojo' : 'amarillo'}
              </span>
              <span className="aud-patron-titulo">{p.casos[0]?.titulo ?? p.patron}</span>
              {/* El contador es la LONGITUD de la lista que se dibuja abajo, no un número que
                  llegó al lado. Por construcción no puede decir quince y mostrar tres. */}
              <span className="aud-patron-casos">×{p.casos.length}</span>
              <span className="aud-patron-codigo">{p.patron}</span>
            </button>

            {abierto === p.patron ? <DetalleDelPatron p={p} /> : null}
          </div>
        ))
      )}
    </div>
  );
}

/** El diagnóstico, la corrección y los casos. Lo primero es DEL PATRÓN; lo último, de cada caso. */
function DetalleDelPatron({ p }) {
  return (
    <div className="aud-patron-cuerpo">
      <p className="aud-diagnostico">{p.diagnostico ?? 'Sin diagnóstico.'}</p>

      {p.elPromptCambio ? (
        /* EL AVISO DE QUE EL PROMPT CAMBIÓ. Sin esto, el técnico pega un reemplazo cuyo fragmento
           original ya no existe, no encuentra qué reemplazar, y desconfía de la pantalla entera. */
        <p className="aud-aviso aud-aviso-chico">
          El prompt de este agente cambió desde que se diagnosticó esto. El fragmento de abajo puede
          ya no existir.
        </p>
      ) : null}

      {p.fragmentoPrompt ? (
        <div className="aud-corr">
          <span className="mon-rotulo">
            Reemplazar {p.promptSeccion ? `en «${p.promptSeccion}»` : 'en el prompt'}
          </span>
          {/* `<pre>` y no `<p>`: un fragmento de prompt tiene viñetas y sangría, y sin conservar
              los espacios llega como un chorizo que no se puede pegar. */}
          <pre className="aud-texto">{p.fragmentoPrompt}</pre>
        </div>
      ) : null}

      <div className="aud-corr">
        <span className="mon-rotulo">
          {p.fragmentoPrompt
            ? 'Por esto'
            : `Agregar ${p.promptSeccion ? `en «${p.promptSeccion}»` : 'al prompt'}`}
        </span>
        <pre className="aud-texto aud-texto-corr">{p.correccion}</pre>
      </div>

      <span className="mon-rotulo">
        {p.casos.length} {p.casos.length === 1 ? 'caso' : 'casos'}
      </span>
      <ul className="aud-casos">
        {p.casos.map((c) => (
          <li key={c.hallazgoId}>
            <span className="aud-caso-quien">{c.contacto}</span>
            <span className="aud-caso-cuando">{cuando(c.detectadoEl)}</span>
            <blockquote className="aud-cita">{c.evidenciaAgente}</blockquote>
            {c.evidenciaContacto ? (
              <blockquote className="aud-cita aud-cita-contacto">{c.evidenciaContacto}</blockquote>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Las conversaciones auditadas de UN agente. **Incluye las que no se pudieron juzgar.**
 *
 * Empieza CERRADA, y es la única lista de esta pantalla que lo hace. No es capricho de espacio: los
 * patrones son el trabajo —qué corregir— y esto es la evidencia, que se abre cuando alguien duda de
 * un patrón. Abierta, cincuenta filas por agente empujan el segundo bloque fuera de la pantalla, que
 * es exactamente lo que hacían los cuadros de prompt antes de irse a su pestaña.
 */
function Conversaciones({ conversaciones, hayMas, agente }) {
  const [abierta, setAbierta] = useState(false);

  return (
    <div className="aud-seccion">
      <button
        className="aud-seccion-cabeza aud-plegable"
        type="button"
        onClick={() => setAbierta(!abierta)}
        aria-expanded={abierta}
      >
        <span className="aud-flecha" aria-hidden="true">
          {abierta ? '▾' : '▸'}
        </span>
        <h4>Conversaciones auditadas</h4>
        {/* EL TOPE SE DICE. Un tope silencioso hace que «50» se lea como «había 50». */}
        <span className="cre-desc">
          {conversaciones.length === 0
            ? 'ninguna'
            : hayMas
              ? `${conversaciones.length} · el tope cortó la lista`
              : `${conversaciones.length} en total`}
        </span>
      </button>

      {abierta ? (
        conversaciones.length === 0 ? (
          <p className="aud-vacio">
            Todavía no se auditó ninguna conversación de {NOMBRE_DEL_AGENTE[agente] ?? agente}.
          </p>
        ) : (
          <ul className="aud-lista">
            {conversaciones.map((c) => (
              <li className="aud-conv" key={c.analisisId}>
                {/* Las NO auditables entran a esta lista y NO a los contadores de arriba. Son dos
                    filtros distintos: acá se ve por qué no se pudo juzgar, y allá meterlas haría
                    que el porcentaje de verdes bajara cada vez que entra una conversación de dos
                    mensajes — «el agente empeoró» sobre un agente que no cambió. */}
                <span
                  className={`aud-chip aud-chip-${c.auditable ? (c.nivel ?? 'vacio') : 'vacio'}`}
                >
                  {c.auditable ? (c.nivel ?? 'sin nivel') : 'no auditable'}
                </span>
                <span className="aud-caso-quien">{c.contacto}</span>
                <span className="aud-caso-cuando">{cuando(c.analizadoEl)}</span>
                <p className="aud-resumen">{c.auditable ? c.resumen : c.noAuditableMotivo}</p>
                {c.intervencion ? (
                  <p className={c.resueltoEl ? 'aud-resuelto' : 'aud-urgente'}>
                    {c.resueltoEl ? 'Intervención resuelta · ' : 'Intervención abierta · '}
                    {c.motivo ?? 'sin motivo registrado'}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

/** La pestaña Prompts: un cuadro por agente. **Vaciarlo lo borra.** */
function Prompts({ prompts, alGuardar }) {
  /* En el ORDEN del embudo, el mismo que los bloques de Inicio. El servidor manda los prompts en el
     orden de `AGENTES`, que es otro: sin esto, LeadFlow es el primero en una pestaña y el segundo en
     la otra, y quien pega dos prompts seguidos los cruza. */
  const enOrden = ORDEN_DE_LOS_AGENTES.map((a) => prompts.find((p) => p.agente === a)).filter(
    Boolean,
  );

  return (
    <div className="aud-prompts">
      <p className="aud-alcance">
        Esto es lo que el auditor lee para saber <b>qué debería decir</b> cada agente. Es una copia
        de referencia: <b>no</b> es el prompt que corre en el CRM, así que cambiarlo acá no cambia
        cómo contesta el agente.
      </p>
      {enOrden.map((p) => (
        <CuadroDePrompt key={p.agente} p={p} alGuardar={alGuardar} />
      ))}
    </div>
  );
}

function CuadroDePrompt({ p, alGuardar }) {
  const [texto, setTexto] = useState(p.texto ?? '');
  const [guardando, setGuardando] = useState(false);
  const [dice, setDice] = useState('');

  const guardar = async () => {
    setGuardando(true);
    setDice('');
    const r = await guardarElPrompt(p.agente, texto);
    setGuardando(false);
    /* Las TRES respuestas se dicen distinto, y la tercera no es un error: quien vacía un campo que
       ya estaba vacío consiguió lo que quería. Un error rojo ahí es cómo se aprende a ignorar los
       errores de una pantalla. */
    if (r.tipo === 'fallo') setDice(r.mensaje);
    else if (r.que === 'guardado') setDice('Guardado.');
    else if (r.que === 'borrado') setDice('Borrado: este agente vuelve a no tener prompt.');
    else setDice('No había ninguno cargado.');
    if (r.tipo === 'ok') alGuardar();
  };

  const cambio = texto !== (p.texto ?? '');

  return (
    <div className="aud-prompt">
      <div className="aud-prompt-cabeza">
        <span className="aud-agente-icono">
          <svg viewBox="0 0 16 16">
            <use href={ICONO_DEL_AGENTE[p.agente] ?? '#i-chat'} />
          </svg>
        </span>
        <h4>
          {NOMBRE_DEL_AGENTE[p.agente] ?? p.agente}
          <span className="aud-agente-zona">{ZONA_DEL_AGENTE[p.agente] ?? ''}</span>
        </h4>
        <span className="cre-desc">{QUE_HACE_EL_AGENTE[p.agente] ?? ''}</span>
      </div>

      <textarea
        className="aud-prompt-caja"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={16}
        spellCheck={false}
        placeholder="Sin prompt cargado. Se audita igual: las correcciones salen como instrucciones para agregar, en vez de reemplazos citados."
      />
      <div className="aud-prompt-pie">
        <button className="pr-btn" type="button" onClick={guardar} disabled={guardando || !cambio}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        {/* VACIAR ES BORRAR, y se dice antes de que alguien lo descubra. Es al revés que en una
            credencial, donde un campo vacío no toca el secreto guardado. */}
        <span className="mon-pie">
          {p.texto
            ? `Cargado · última edición ${cuando(p.actualizadoEl)} · vaciar el cuadro lo borra`
            : 'Sin prompt cargado'}
        </span>
        {dice ? <span className="aud-dice">{dice}</span> : null}
      </div>
    </div>
  );
}
