'use client';

/* El detalle de una llamada OB: el perfil de arranque de un cliente que ya compró.

   ── UNA SOLA VISTA, Y SIN FICHA ──────────────────────────────────────────

   El paquete la pide así (11-FRONTEND § 3.9): no hay vista Prospecto, ni deshabilitada ni vacía. La
   ficha es solo de HT —`insightsFor('OB')` está vacío y el servidor contesta `ficha_solo_ht`—, así que
   este componente no la pide nunca.

   ── LOS DATOS DUROS SALEN DE LA LLAMADA, NUNCA DEL MODELO ─────────────────

   El correo del cliente es el de la llamada: si no hay, dice «email pendiente». El esquema OB SÍ tiene
   `clientEmail` —la rúbrica pide llenarlo si se dice en voz alta— y un `email` por participante, que
   la rúbrica ni menciona. Medido en las 7 OB copiadas (2026-09-23): `clientEmail` está vacío en las 7,
   y el correo de un participante no coincide nunca con el de la llamada. Por eso ninguno de los dos
   se dibuja: un correo que escribe el modelo al lado de uno que viene de tl;dv no deja saber cuál vale.

   ── «NO CONSTA», EN TODOS LOS VACÍOS ──────────────────────────────────────

   El paquete describe que Brain oculta los vacíos y pide unificar hacia la regla de HT (R1, «No
   consta»); acá se aplica eso, en todos los campos. Un título sin nada debajo se lee como un error de
   carga. Los valores
   de enumeración, en cambio, nunca dicen «No consta»: `normalizeOb` les pone uno por omisión, y el
   esquema no tiene «no se habló». Ver `lib/analizadores/rotulos.ts`.

   ── LA CITA CON TIEMPO, SOLO EN LOS MOMENTOS CLAVE ────────────────────────

   Es el único lugar del esquema OB con `quote` y `startSec`: la rúbrica prohíbe tiempos en el resto.
   Van en el orden de la llamada, porque el modelo no siempre los devuelve así.

   ── LO QUE DEL § 3.9 NO VA ────────────────────────────────────────────────

   La transcripción completa, porque la API del detalle no la devuelve para ningún tipo. Y el bloque
   «Uso del modelo», igual que en el detalle HT: el costo espera la tarifa confirmada (decisión 8 de
   docs/ANALIZADORES.md) y los tokens quedan guardados en la base. */

import { useCallback, useEffect, useState } from 'react';

import { pedir } from '../../lib/http/cliente.ts';
import { formatSeconds } from '@/lib/analizadores/nucleo/time';
import { consta, momentosEnOrden, rotuloOb } from '@/lib/analizadores/rotulos';

const CHIP_DE_LA_PREPARACION = { LISTO: 'ok', PARCIAL: 'warn', BLOQUEADO: 'crit' };

const fecha = (iso) =>
  iso ? new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin fecha';

const NoConsta = () => <span className="az-no-consta">No consta</span>;

/** Un dato de una línea: su nombre y su valor, o «No consta». */
function Dato({ nombre, valor }) {
  return (
    <>
      <span>{nombre}</span>
      <span>{consta(valor) ? valor : <NoConsta />}</span>
    </>
  );
}

/** Una lista de textos: sus renglones, o «No consta». */
function Renglones({ nombre, items }) {
  return (
    <>
      <span>{nombre}</span>
      {consta(items) ? (
        <ul className="az-renglones">
          {items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      ) : (
        <NoConsta />
      )}
    </>
  );
}

function Tiempo({ startSec, conMarcas }) {
  if (typeof startSec !== 'number') return null;
  return (
    <span
      className="az-tiempo"
      title={conMarcas === false ? 'La transcripción no traía marcas de tiempo: esto es el número de turno, contando solo los renglones con texto.' : undefined}
    >
      {conMarcas === false ? `turno ${startSec + 1}` : formatSeconds(startSec)}
    </span>
  );
}

export default function DetalleOb({ id, alVolver }) {
  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState('');

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

  if (error && !detalle) {
    return (
      <div className="az-detalle">
        <button type="button" className="az-boton" onClick={alVolver}>← Volver</button>
        <div className="az-error">{error}</div>
      </div>
    );
  }
  if (!detalle) return <div className="az-aviso">Cargando…</div>;

  const { llamada, analisis } = detalle;
  const a = analisis?.coincide ? analisis.analisis : null;

  return (
    <div className="az-detalle">
      <div className="az-barra">
        <button type="button" className="az-boton" onClick={alVolver}>← Volver</button>
      </div>

      <div className="az-bloque">
        <h3>
          {llamada.titulo ?? 'Llamada sin título'}{' '}
          {a ? <span className={`chip ${CHIP_DE_LA_PREPARACION[a.readiness] ?? 'warn'}`}>{rotuloOb('readiness', a.readiness)}</span> : null}
        </h3>
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
              <span>De ARIA</span>
              <span>{llamada.organizadorNombre ?? llamada.organizadorEmail}</span>
            </>
          ) : null}
          <span>Cliente</span>
          <span>
            {llamada.prospectoNombre ?? 'Sin nombre'}
            {' · '}
            {llamada.prospectoEmail ? llamada.prospectoEmail : <span className="az-no-consta">email pendiente</span>}
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
            La transcripción se pegó sin marcas de tiempo: en los momentos clave, lo que se muestra es el
            número de turno, no un tiempo de la grabación.
          </p>
        ) : null}
      </div>

      {error ? <div className="az-error">{error}</div> : null}
      {a ? <Informe a={a} conMarcas={llamada.conMarcasDeTiempo} /> : <div className="az-aviso">Esta llamada no tiene análisis.</div>}
    </div>
  );
}

function Informe({ a, conMarcas }) {
  const setup = a.setup ?? {};
  const momentos = momentosEnOrden(a.keyMoments);
  return (
    <>
      <div className="az-bloque">
        <h3>Dónde está</h3>
        <div className="az-par">
          <Dato nombre="Etapa del onboarding" valor={a.onboardingStage} />
          <Dato nombre="Compromiso" valor={rotuloOb('commitmentLevel', a.commitmentLevel)} />
          <Dato nombre="Empresa" valor={a.company} />
          <Dato nombre="País" valor={a.country} />
        </div>
      </div>

      <div className="az-bloque">
        <h3>Resumen</h3>
        {consta(a.summary) ? <p>{a.summary}</p> : <p className="az-no-consta">No consta</p>}
      </div>

      <div className="az-bloque">
        <h3>Estado del onboarding</h3>
        <div className="az-par">
          <Renglones nombre="Qué quedó claro" items={a.captured} />
          <Renglones nombre="Qué falta" items={a.missing} />
          <Renglones nombre="Bloqueadores" items={a.blockers} />
        </div>
      </div>

      <div className="az-bloque">
        <h3>Próximos pasos</h3>
        {/* Cada lista con su rótulo, dentro de la grilla: un «No consta» suelto bajo el título parecía
            valer para todo el bloque, con «Siguiente paso» lleno justo debajo. */}
        <div className="az-par">
          <span>Tareas</span>
          {consta(a.actionItems) ? (
            <ul className="az-renglones">
              {a.actionItems.map((t, i) => (
                <li key={i}>
                  {t.task} <span className="az-fila-m">· {rotuloOb('owner', t.owner)}{consta(t.dueDate) ? ` · ${t.dueDate}` : ''}</span>
                </li>
              ))}
            </ul>
          ) : (
            <NoConsta />
          )}
          <Renglones nombre="Info pendiente del cliente" items={a.infoPendingFromClient} />
          <Dato nombre="Siguiente paso" valor={a.nextStep} />
        </div>
      </div>

      <div className="az-bloque">
        <h3>Quiénes estuvieron</h3>
        <div className="az-par">
          <span>Participantes</span>
          {consta(a.participants) ? (
            <ul className="az-renglones">
              {a.participants.map((p, i) => (
                <li key={i}>
                  {p.name}
                  {consta(p.role) ? ` · ${p.role}` : ''}
                  {p.isPrimary ? ' · titular' : ''}
                </li>
              ))}
            </ul>
          ) : (
            <NoConsta />
          )}
          <Renglones nombre="Mercados objetivo" items={a.targetMarkets} />
        </div>
      </div>

      <div className="az-bloque">
        <h3>A qué se dedica</h3>
        <div className="az-par">
          <Dato nombre="Negocio" valor={a.businessBackground} />
          <Dato nombre="Experiencia con agencias" valor={rotuloOb('agencyExperience', a.agencyExperience)} />
          <Renglones nombre="Clientes o resultados actuales" items={a.currentClientsOrResults} />
          <Dato nombre="Oferta y precio actual" valor={a.currentOfferPricing} />
        </div>
      </div>

      <div className="az-bloque">
        <h3>Nivel técnico</h3>
        <div className="az-par">
          <Dato nombre="GoHighLevel" valor={rotuloOb('goHighLevelLevel', a.goHighLevelLevel)} />
          <Dato nombre="Anuncios" valor={rotuloOb('adsExperience', a.adsExperience)} />
          <Dato nombre="Herramientas de IA" valor={a.aiToolsExperience} />
          <Dato nombre="Comodidad técnica" valor={a.techComfort} />
          <Dato nombre="Quién lleva lo técnico" valor={a.technicalPersonName} />
        </div>
      </div>

      <div className="az-bloque">
        <h3>Nicho</h3>
        <div className="az-par">
          <Dato nombre="Definido" valor={a.nicheDefined ? 'Sí' : 'Todavía no'} />
          <Dato nombre="Nicho elegido" valor={a.chosenNiche} />
          <Renglones nombre="Nichos candidatos" items={a.candidateNiches} />
          <Dato nombre="Cliente ideal" valor={a.idealCustomer} />
          <Renglones nombre="Dolores del nicho" items={a.nichePains} />
        </div>
      </div>

      <div className="az-bloque">
        <h3>Objetivos</h3>
        <div className="az-par">
          <Dato nombre="Meta principal" valor={a.mainGoal} />
          <Dato nombre="Plazo" valor={a.timeline} />
          <Dato nombre="Por qué ahora" valor={a.whyNow} />
          <Dato nombre="Escalabilidad" valor={a.scalabilityNeeds} />
        </div>
      </div>

      <div className="az-bloque">
        <h3>Accesos</h3>
        <div className="az-par">
          <Dato nombre="Slack" valor={rotuloOb('slack', setup.slack)} />
          <Dato nombre="School" valor={rotuloOb('school', setup.school)} />
          <Dato nombre="GoHighLevel" valor={rotuloOb('goHighLevel', setup.goHighLevel)} />
          <Renglones nombre="Otras herramientas" items={setup.otherTools} />
        </div>
      </div>

      <div className="az-bloque">
        <h3>Preocupaciones y riesgos</h3>
        <div className="az-par">
          <Renglones nombre="Preocupaciones" items={a.concerns} />
          <Renglones nombre="Objeciones" items={a.objections} />
          <Renglones nombre="Señales de riesgo" items={a.riskFlags} />
        </div>
      </div>

      <div className="az-bloque">
        <h3>Cómo es el cliente</h3>
        <div className="az-par">
          <Dato nombre="Personalidad" valor={a.personality} />
          <Dato nombre="Quién decide" valor={a.decisionMakerNotes} />
        </div>
      </div>

      <div className="az-bloque">
        <h3>Momentos clave</h3>
        {momentos.length === 0 ? (
          <p className="az-no-consta">No consta</p>
        ) : (
          momentos.map((m, i) => (
            <div key={i} className="az-momento">
              <Tiempo startSec={m.startSec} conMarcas={conMarcas} /> {m.label}
              {consta(m.quote) ? <div className="az-cita">«{m.quote}»</div> : null}
            </div>
          ))
        )}
      </div>
    </>
  );
}
