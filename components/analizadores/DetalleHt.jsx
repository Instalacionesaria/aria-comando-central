'use client';

/* El detalle de una llamada HT: cómo trabajó el closer, y quién es el prospecto.
   ==========================================================================

   ── LAS FASES: POR SU CAMPO CUANDO SE PUEDE, POR POSICIÓN SOLO EN EL HISTORIAL v8 ──

   Los análisis v8 del historial copiado de ARIA Brain dicen `apertura_rapport` en las cinco fases:
   el origen comparaba en mayúsculas contra una lista en minúsculas. Rotular por el campo ahí
   mostraría «Apertura» cinco veces.

   Pero rotular SIEMPRE por posición tampoco es cierto: el esquema no obliga a devolver las fases en
   orden —la rúbrica las enumera del 1 al 5, y nada más—, y en producción 3 de 37 HT no tienen
   exactamente cinco. Así que `rotulosDeLasFases`: por el campo cuando las fases vienen distintas
   (v8.1), por posición cuando son cinco y todas iguales (el defecto v8), y «Fase N» cuando no hay
   forma honesta de saber cuál es cuál. Vive en `lib/analizadores/fases.ts`, donde se prueba.

   ── LOS DATOS DUROS SALEN DE LA LLAMADA, NUNCA DEL MODELO ─────────────────

   Fecha, duración, organizador y enlace vienen de tl;dv y se dibujan de la fila de la llamada. El
   esquema del análisis no les da lugar a propósito: si el modelo los escribiera, a veces bien y a
   veces inventados, no habría forma de saber cuál mostrar.

   ── Y «NO CONSTA» ES UN RESULTADO, NO UN HUECO ────────────────────────────

   La ficha tiene tres estados por campo. Un NO_MENCIONADO se escribe «No consta», explícito: un campo
   vacío en blanco se lee como «falta cargar» y alguien lo completa de memoria. */

import { useCallback, useEffect, useState } from 'react';

import { pedir } from '../../lib/http/cliente.ts';
import { formatSeconds } from '@/lib/analizadores/nucleo/time';
import { deriveScoreColor } from '@/lib/analizadores/nucleo/score';
import { rotulosDeLasFases } from '@/lib/analizadores/fases';

const RESULTADO = { CERRADA: 'Cerrada', NO_CERRADA: 'No cerrada', INDETERMINADO: 'Indeterminado' };
const ESPERA_LARGA = 300_000;

const fecha = (iso) =>
  iso ? new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin fecha';

function Tiempo({ evidencia, conMarcas }) {
  if (!evidencia || typeof evidencia.startSec !== 'number') return null;
  return (
    <span
      className="az-tiempo"
      title={conMarcas === false ? 'La transcripción no traía marcas de tiempo: esto es el número de turno, contando solo los renglones con texto.' : undefined}
    >
      {' '}
      {/* `turno` y no `línea`: el parser numera los renglones NO vacíos y empieza en 0, así que «línea 7»
          no era la séptima línea del texto pegado. */}
      {conMarcas === false ? `turno ${evidencia.startSec + 1}` : formatSeconds(evidencia.startSec)}
    </span>
  );
}

function Lista({ items, render }) {
  if (!items || items.length === 0) return <p className="az-no-consta">Nada que registrar.</p>;
  return items.map((it, i) => <div key={i}>{render(it)}</div>);
}

export default function DetalleHt({ id, alVolver }) {
  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState('');
  /* El error de una ACCIÓN —generar o rehacer la ficha— va aparte del de la carga: la recarga que
     sigue a la acción limpiaba `error` en el mismo ciclo, y el rechazo desaparecía sin verse. */
  const [errorDeAccion, setErrorDeAccion] = useState('');
  // `vendedor` y no `closer`: `30-portero` prohíbe comparar contra un nombre de rol, y lo mira por la forma.
  const [vista, setVista] = useState('vendedor');
  const [trabajando, setTrabajando] = useState('');

  const cargar = useCallback(async () => {
    const r = await pedir(`/api/analizadores/llamadas/${id}`);
    if (r.tipo === 'datos') {
      setDetalle(r.datos);
      setError('');
    } else {
      setError(r.tipo === 'sin_respuesta' ? 'No se pudo contactar al servidor.' : (r.detalle ?? `El servidor respondió ${r.estado}.`));
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const generarFicha = async () => {
    setErrorDeAccion('');
    setTrabajando('Armando la ficha del prospecto… puede tardar un par de minutos.');
    const r = await pedir(`/api/analizadores/llamadas/${id}/ficha`, { metodo: 'POST', espera: ESPERA_LARGA });
    setTrabajando('');
    if (r.tipo !== 'datos') {
      setErrorDeAccion(r.tipo === 'sin_respuesta' ? 'No se pudo contactar al servidor.' : (r.detalle ?? `El servidor respondió ${r.estado}.`));
    }
    await cargar();
  };

  if (error && !detalle) {
    return (
      <div className="az-detalle">
        <button type="button" className="az-boton" onClick={alVolver}>← Volver</button>
        <div className="az-error">{error}</div>
      </div>
    );
  }
  if (!detalle) return <div className="az-aviso">Cargando…</div>;

  const { llamada, analisis, ficha, historial } = detalle;
  const a = analisis?.coincide ? analisis.analisis : null;
  const posicion = historial.findIndex((h) => h.id === llamada.id) + 1;

  return (
    <div className="az-detalle">
      <div className="az-barra">
        <button type="button" className="az-boton" onClick={alVolver}>← Volver</button>
        <div className="cl-sub">
          {[
            ['vendedor', 'Closer', '#i-closer'],
            ['prospecto', 'Prospecto', '#i-leads'],
          ].map(([clave, nombre, icono]) => (
            <button key={clave} type="button" className={vista === clave ? 'on' : undefined} onClick={() => setVista(clave)}>
              <svg viewBox="0 0 16 16">
                <use href={icono} />
              </svg>
              {nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="az-bloque">
        <h3>{llamada.titulo ?? 'Llamada sin título'}</h3>
        <div className="az-par">
          <span>Fecha</span>
          <span>{fecha(llamada.fechaDeLaReunion ?? llamada.creadoEl)}</span>
          {llamada.duracionSeg ? (
            <>
              <span>Duración</span>
              <span>{formatSeconds(llamada.duracionSeg)}</span>
            </>
          ) : null}
          {llamada.organizadorNombre || llamada.organizadorEmail ? (
            <>
              <span>Closer</span>
              <span>{llamada.organizadorNombre ?? llamada.organizadorEmail}</span>
            </>
          ) : null}
          <span>Prospecto</span>
          <span>
            {llamada.prospectoNombre ?? 'Sin nombre'}
            {llamada.prospectoEmail ? ` · ${llamada.prospectoEmail}` : ''}
            {historial.length > 1 ? ` · reunión ${posicion} de ${historial.length}` : ''}
          </span>
          {llamada.urlDeLaGrabacion ? (
            <>
              <span>Grabación</span>
              <a href={llamada.urlDeLaGrabacion} target="_blank" rel="noreferrer">
                Abrir en tl;dv
              </a>
            </>
          ) : null}
        </div>
        {llamada.conMarcasDeTiempo === false ? (
          <p className="az-aviso">
            La transcripción se pegó sin marcas de tiempo: donde el análisis cita un momento, lo que se
            muestra es el número de línea, no un tiempo de la grabación.
          </p>
        ) : null}
      </div>

      {trabajando ? <div className="az-aviso">{trabajando}</div> : null}
      {error ? <div className="az-error">{error}</div> : null}
      {errorDeAccion ? <div className="az-error">{errorDeAccion}</div> : null}

      {vista === 'vendedor' ? (
        a ? <VistaCloser a={a} conMarcas={llamada.conMarcasDeTiempo} /> : <div className="az-aviso">Esta llamada no tiene análisis.</div>
      ) : (
        <VistaProspecto ficha={ficha} conMarcas={llamada.conMarcasDeTiempo} alGenerar={generarFicha} trabajando={trabajando !== ''} />
      )}
    </div>
  );
}

function VistaCloser({ a, conMarcas }) {
  const color = deriveScoreColor(a.score).toLowerCase();
  const fases = rotulosDeLasFases(a.seller?.phaseScores ?? []);
  return (
    <>
      <div className="az-bloque">
        <div className="az-acciones">
          <span className={`az-puntaje az-${color}`}>{a.score}/10</span>
          <span className="chip">{RESULTADO[a.outcome] ?? a.outcome}</span>
        </div>
        {a.outcomeReason ? <p>{a.outcomeReason}</p> : null}
        {a.summary ? <p>{a.summary}</p> : null}
        {a.scoreJustification ? <p className="az-fila-m">{a.scoreJustification}</p> : null}
        {a.coachingPriority ? (
          <p>
            <b>Lo primero a trabajar:</b> {a.coachingPriority}
          </p>
        ) : null}
      </div>

      <div className="az-bloque">
        <h3>Las fases</h3>
        {fases.nota ? <p className="az-no-consta">{fases.nota}</p> : null}
        {(a.seller?.phaseScores ?? []).map((f, i) => (
          <details key={i}>
            <summary>
              {fases.rotulos[i]} · {f.score}/10
            </summary>
            {f.rationale ? <p>{f.rationale}</p> : null}
            {f.toReachTen ? (
              <p>
                <b>Para llegar a 10:</b> {f.toReachTen}
              </p>
            ) : null}
          </details>
        ))}
      </div>

      <div className="az-bloque">
        <h3>Lo que hizo bien</h3>
        <Lista
          items={a.seller?.strengths}
          render={(s) => (
            <p>
              <b>{s.title}.</b> {s.description}
              <Tiempo evidencia={s.evidence} conMarcas={conMarcas} />
              {s.evidence?.quote ? <span className="az-cita"> «{s.evidence.quote}»</span> : null}
            </p>
          )}
        />
      </div>

      <div className="az-bloque">
        <h3>Lo que hay que mejorar</h3>
        <Lista
          items={a.seller?.improvements}
          render={(s) => (
            <p>
              <b>{s.title}.</b> {s.description} <i>{s.suggestion}</i>
              <Tiempo evidencia={s.evidence} conMarcas={conMarcas} />
            </p>
          )}
        />
      </div>

      <div className="az-bloque">
        <h3>Objeciones</h3>
        <Lista
          items={a.seller?.objections}
          render={(o) => (
            <p>
              <b>{o.objection}</b> — {o.howHandled} <i>{o.howToRespond}</i>
              <Tiempo evidencia={o.evidence} conMarcas={conMarcas} />
            </p>
          )}
        />
      </div>

      <div className="az-bloque">
        <h3>Momentos clave</h3>
        <Lista
          items={a.keyMoments}
          render={(k) => (
            <p>
              <Tiempo evidencia={k} conMarcas={conMarcas} /> <b>{k.label}</b>
              {k.quote ? <span className="az-cita"> «{k.quote}»</span> : null}
            </p>
          )}
        />
      </div>
    </>
  );
}

/** Un campo de la ficha con sus tres estados. La confianza aparece solo si NO es ALTA. */
function Campo({ nombre, c, conMarcas }) {
  if (!c) return null;
  return (
    <>
      <span>{nombre}</span>
      <span>
        {c.state === 'NO_MENCIONADO' ? (
          <span className="az-no-consta">No consta</span>
        ) : (
          <>
            {c.state === 'AMBIGUO' ? 'Ambiguo: ' : ''}
            {c.value}
            {c.confidence !== 'ALTA' ? <span className="az-tiempo"> · confianza {c.confidence.toLowerCase()}</span> : null}
            <Tiempo evidencia={c.startSec === null ? null : { startSec: c.startSec }} conMarcas={conMarcas} />
            {c.quote ? <span className="az-cita"> «{c.quote}»</span> : null}
          </>
        )}
      </span>
    </>
  );
}

function VistaProspecto({ ficha, conMarcas, alGenerar, trabajando }) {
  if (!ficha) {
    return (
      <div className="az-bloque">
        <p>Esta llamada todavía no tiene ficha del prospecto.</p>
        <button type="button" className="az-boton az-primario" disabled={trabajando} onClick={alGenerar}>
          Generar la ficha
        </button>
      </div>
    );
  }
  if (ficha.estado === 'FAILED') {
    return (
      <div className="az-bloque">
        <p className="az-error">La ficha falló: {ficha.error}</p>
        <button type="button" className="az-boton" disabled={trabajando} onClick={alGenerar}>
          Rehacer la ficha
        </button>
      </div>
    );
  }
  const f = ficha.ficha;
  const b = f.business ?? {};
  const i = f.buyingIntent ?? {};
  const t = f.commercialTerms ?? {};
  return (
    <>
      <div className="az-bloque">
        {f.summary ? <p>{f.summary}</p> : null}
        {f.transcriptStatus === 'INCOMPLETA' ? (
          <p className="az-aviso">La transcripción está incompleta: lo que dice «No consta» puede haberse dicho en la parte que falta.</p>
        ) : null}
        <button type="button" className="az-boton" disabled={trabajando} onClick={alGenerar}>
          Rehacer la ficha
        </button>
      </div>

      <div className="az-bloque">
        <h3>El negocio</h3>
        <div className="az-par">
          <Campo nombre="Modelo" c={b.model} conMarcas={conMarcas} />
          <Campo nombre="Tamaño" c={b.size} conMarcas={conMarcas} />
          <Campo nombre="Equipo" c={b.team} conMarcas={conMarcas} />
          <Campo nombre="Clientes actuales" c={b.currentClients} conMarcas={conMarcas} />
          <Campo nombre="Facturación" c={b.revenue} conMarcas={conMarcas} />
          <Campo nombre="Qué busca con nosotros" c={f.whatTheyWant} conMarcas={conMarcas} />
        </div>
      </div>

      <div className="az-bloque">
        <h3>La intención de compra</h3>
        <div className="az-par">
          <Campo nombre="Nivel" c={i.level} conMarcas={conMarcas} />
          <Campo nombre="Objeción principal" c={i.mainObjection} conMarcas={conMarcas} />
          <Campo nombre="Decisor presente" c={i.decisionMakerPresent} conMarcas={conMarcas} />
          <Campo nombre="Quién decide" c={i.whoDecides} conMarcas={conMarcas} />
          <Campo nombre="Capacidad de pago" c={i.payAbility} conMarcas={conMarcas} />
          <Campo nombre="Urgencia" c={i.urgency} conMarcas={conMarcas} />
        </div>
      </div>

      <div className="az-bloque">
        <h3>Lo que se habló de plata</h3>
        <div className="az-par">
          <Campo nombre="Programa" c={t.program} conMarcas={conMarcas} />
          <Campo nombre="Duración" c={t.duration} conMarcas={conMarcas} />
          <Campo nombre="Precio" c={t.price} conMarcas={conMarcas} />
          <Campo nombre="Estructura de pago" c={t.paymentStructure} conMarcas={conMarcas} />
          <Campo nombre="Pago contra resultado" c={t.resultTrigger} conMarcas={conMarcas} />
          <Campo nombre="Descuentos" c={t.discounts} conMarcas={conMarcas} />
        </div>
      </div>

      <div className="az-bloque">
        <h3>Próximos pasos</h3>
        <p><b>Nuestros:</b></p>
        <Lista items={f.nextStepsAria} render={(p) => <p>{p.action}{p.dueDateText ? ` · ${p.dueDateText}` : ''}</p>} />
        <p><b>Del prospecto:</b></p>
        <Lista items={f.nextStepsProspect} render={(p) => <p>{p.action}{p.dueDateText ? ` · ${p.dueDateText}` : ''}</p>} />
        {(f.nextStepsUnassigned ?? []).length > 0 ? (
          <>
            <p><b>Sin dueño claro:</b></p>
            <Lista items={f.nextStepsUnassigned} render={(p) => <p>{p.action}</p>} />
          </>
        ) : null}
      </div>

      <div className="az-bloque">
        <h3>Señales de riesgo</h3>
        <Lista
          items={f.riskFlags}
          render={(r) => (
            <p>
              {r.text}
              {r.quote ? <span className="az-cita"> «{r.quote}»</span> : null}
            </p>
          )}
        />
      </div>

      {(f.notRecorded ?? []).length > 0 ? (
        <div className="az-bloque">
          <h3>Lo que la llamada no registró</h3>
          <p className="az-no-consta">{f.notRecorded.join(' · ')}</p>
        </div>
      ) : null}
    </>
  );
}
