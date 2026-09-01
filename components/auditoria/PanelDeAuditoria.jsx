'use client';

/* La pantalla del técnico: qué patrones fallan en los agentes, y con qué corregirlos.
   ==========================================================================

   ── NO ES LA COLA ROJA, Y ESA ES TODA LA SEPARACIÓN DEL MÓDULO ────────────

   La cola roja vive en el Closer y en el Setter, donde trabaja el vendedor, y dice *«alguien tiene
   que tomar ESTA conversación ahora»*. Esto es lo otro: una lista que se mira cuando se puede, con
   correcciones para el prompt. Que fueran una sola cosa es el defecto que este módulo entero existe
   para arreglar — hacía que un *«podría ser más breve»* le apagara el agente a una persona real.

   ── LOS TRES ESTADOS DE UNA TARJETA, Y LOS TRES SE VEN DISTINTO ───────────

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
  POR_QUE_NO_AUDITA,
  QUE_HACE_EL_AGENTE,
  agruparPorPatron,
  guardarElPrompt,
  leerLaPantalla,
} from '@/lib/auditor/vista';

/** Una fecha corta y legible. `null` se dibuja como un guion, nunca como «hoy». */
function cuando(valor) {
  if (!valor) return '—';
  return new Date(valor).toLocaleDateString('es', { day: '2-digit', month: 'short' });
}

export default function PanelDeAuditoria() {
  const [pantalla, setPantalla] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  /* Qué patrón está abierto. Se guarda el CÓDIGO y no un índice: la lista se reordena al recargar
     —el orden es por cantidad de casos— y con un índice quedaría abierto otro patrón. */
  const [abierto, setAbierto] = useState(null);

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

  /* Los tres estados de la CARGA, y los tres distintos. Un error dibujado como «no hay hallazgos»
     es el cero indistinguible que este módulo persigue en otras cuatro formas. */
  if (cargando) return <p className="aud-estado">Cargando la auditoría…</p>;
  if (error) {
    return (
      <div className="aud-estado aud-error">
        <p>{error}</p>
        <button className="pr-btn" type="button" onClick={cargar}>
          Reintentar
        </button>
      </div>
    );
  }
  if (!pantalla) return null;

  const patrones = agruparPorPatron(pantalla.casos);

  return (
    <>
      {/* ── EL AVISO DE LA EMPRESA, ARRIBA Y NO DENTRO DE CADA TARJETA ──────
          Es un hecho de la empresa entera, no de un agente. Repetirlo en las dos tarjetas lo haría
          leer como dos problemas distintos. */}
      {pantalla.noAudita ? (
        <div className="aud-aviso">
          <strong>Esta empresa todavía no audita.</strong>{' '}
          {POR_QUE_NO_AUDITA[pantalla.noAudita] ?? 'Falta configurar el auditor.'}
        </div>
      ) : null}

      <div className="mon-totales">
        {pantalla.tarjetas.map((t) => (
          <TarjetaDelAgente key={t.agente} t={t} />
        ))}
      </div>

      <Patrones
        patrones={patrones}
        abierto={abierto}
        alAbrir={(p) => setAbierto(abierto === p ? null : p)}
      />

      <Prompts prompts={pantalla.prompts} alGuardar={cargar} />

      <Conversaciones
        conversaciones={pantalla.conversaciones}
        hayMas={pantalla.hayMas}
      />
    </>
  );
}

/** Una tarjeta por agente. Ver los tres estados en el encabezado del archivo. */
function TarjetaDelAgente({ t }) {
  const sinDatos = t.analizadas === 0;
  return (
    <div className="mon-tarjeta">
      <span className="mon-rotulo">{NOMBRE_DEL_AGENTE[t.agente] ?? t.agente}</span>
      {sinDatos ? (
        <>
          {/* EL GUION Y EL CHIP, nunca `0 %` ni un tilde verde: nadie auditó todavía a este
              agente, y un cero acá se leería como «no encontró nada malo». */}
          <span className="mon-cifra">—</span>
          <span className="aud-chip aud-chip-vacio">sin datos</span>
          <span className="mon-pie">{QUE_HACE_EL_AGENTE[t.agente] ?? ''}</span>
        </>
      ) : (
        <>
          <span className="mon-cifra">{t.auditables}</span>
          <span className="aud-semaforo">
            <span className="aud-chip aud-chip-verde">{t.verdes} verde</span>
            <span className="aud-chip aud-chip-amarillo">{t.amarillos} amarillo</span>
            <span className="aud-chip aud-chip-rojo">{t.rojos} rojo</span>
          </span>
          <span className="mon-pie">
            {/* LAS DOS CUENTAS, y por eso son dos. «Se miraron 40 y 19 no se pudieron juzgar» en un
                solo número no dice ninguna de las dos cosas. */}
            {t.analizadas} conversaciones miradas
            {t.analizadas > t.auditables
              ? `, ${t.analizadas - t.auditables} sin poder juzgar`
              : ''}
            {' · '}último {cuando(t.ultimoEl)}
            {t.tienePrompt ? '' : ' · sin prompt cargado'}
          </span>
          {t.intervencionesAbiertas > 0 ? (
            <span className="mon-pie aud-urgente">
              {t.intervencionesAbiertas} en la cola de urgentes
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Los patrones: una fila por código, con sus casos adentro. */
function Patrones({ patrones, abierto, alAbrir }) {
  return (
    <div className="mon-bloque aud-bloque">
      <div className="mon-cabeza">
        <h3>Patrones a corregir</h3>
        <span className="cre-desc">
          {patrones.length === 0
            ? 'Ninguno abierto'
            : `${patrones.length} ${patrones.length === 1 ? 'patrón' : 'patrones'}`}
        </span>
      </div>

      {patrones.length === 0 ? (
        /* El vacío DICE por qué está vacío. «Ningún patrón» a secas se lee igual con un auditor
           apagado que con agentes que funcionan bien, y son cosas opuestas. */
        <p className="aud-vacio">
          No hay hallazgos abiertos. O los agentes están trabajando bien, o todavía no se auditó
          ninguna conversación — las tarjetas de arriba lo dicen.
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

/** El cuadro del prompt de cada agente. **Vaciarlo lo borra.** */
function Prompts({ prompts, alGuardar }) {
  return (
    <div className="mon-bloque aud-bloque">
      <div className="mon-cabeza">
        <h3>Prompt de referencia</h3>
        <span className="cre-desc">
          Lo que el auditor lee para saber qué debería decir cada agente
        </span>
      </div>
      {prompts.map((p) => (
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
      <span className="mon-rotulo">{NOMBRE_DEL_AGENTE[p.agente] ?? p.agente}</span>
      <textarea
        className="aud-prompt-caja"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={8}
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

/** La lista de conversaciones auditadas. **Incluye las que no se pudieron juzgar.** */
function Conversaciones({ conversaciones, hayMas }) {
  return (
    <div className="mon-bloque aud-bloque">
      <div className="mon-cabeza">
        <h3>Conversaciones auditadas</h3>
        {/* EL TOPE SE DICE. Un tope silencioso hace que «50» se lea como «había 50». */}
        <span className="cre-desc">
          {hayMas ? 'las 50 más recientes' : `${conversaciones.length} en total`}
        </span>
      </div>

      {conversaciones.length === 0 ? (
        <p className="aud-vacio">Todavía no se auditó ninguna conversación.</p>
      ) : (
        <ul className="aud-lista">
          {conversaciones.map((c) => (
            <li className="aud-conv" key={c.analisisId}>
              {/* Las NO auditables entran a esta lista y NO a los contadores de arriba. Son dos
                  filtros distintos: acá se ve por qué no se pudo juzgar, y allá meterlas haría que
                  el porcentaje de verdes bajara cada vez que entra una conversación de dos
                  mensajes — «el agente empeoró» sobre un agente que no cambió. */}
              <span className={`aud-chip aud-chip-${c.auditable ? (c.nivel ?? 'vacio') : 'vacio'}`}>
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
      )}
    </div>
  );
}
