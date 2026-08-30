'use client';

/* Prospección en Frío: el panel propio, con el scraper adentro.
   ==========================================================================
   Puerto de `ARIA-brain/app-next/components/ProspeccionPanel.tsx`.

   ── POR QUÉ ESTA HERRAMIENTA NO USA `PanelHerramienta` ────────────────────

   Las nueve de Fundaciones son la misma cosa: un formulario, un botón, un documento. Ésta no.
   `tools.ts` del hub la DECLARA con cuatro campos y forma genérica, y el hub **no la pinta con
   eso**: tiene este panel, que usa solo dos de los cuatro —Canal y Tono— y pone en su lugar un
   extractor de leads que habla con otro sistema.

   El primer port de esta herramienta se guió por la declaración y salió un formulario de cuatro
   campos que no se parecía en nada a la pantalla real. Queda dicho acá porque el próximo que lea
   `TOOL_20_PROSPECCION` va a llegar a la misma conclusión equivocada.

   ── LOS DOS CAMPOS QUE NO SE MUESTRAN ─────────────────────────────────────

   `t20-ubicacion` y `t20-fuentes` siguen existiendo en el registro y en el almacén, y siguen
   entrando al prompt. Lo que cambió es de dónde salen:

     · `t20-fuentes` se fija en "las 3" al generar, porque ahora el alumno elige la fuente
       arriba, en las pestañas del scraper. El hub hace exactamente esto.
     · `t20-ubicacion` queda con lo que hubiera guardado. No se borra: el prompt lo usa, y
       vaciarlo porque la pantalla ya no lo muestra sería perder un dato que el documento lee.

   ── EL SCRAPER Y EL PLAN SON DOS COSAS SEPARADAS ──────────────────────────

   Scrapear NO genera el plan, y generar el plan NO scrapea. Son dos gastos distintos —leads de
   un monedero, tokens de la llave de IA— y el hub los deja sueltos a propósito: se puede generar
   el plan sin haber scrapeado nunca. El indicador de tres pasos de abajo explica el orden
   recomendado, no lo impone. */

import { useMemo, useState } from 'react';

import { ESPERA_DE_RUTA_LARGA_MS, pedir } from '@/lib/http/cliente';
import { aValoresDeFormulario, camposDe } from '@/lib/fundaciones/campos';
import { FUENTES_POR_HERRAMIENTA, faltantes, fuentes } from '@/lib/fundaciones/herencia';
import { SIN_RESPUESTA, mensajeDeRechazo } from '@/lib/fundaciones/mensajes';

import Documento from '../fundaciones/Documento';
import Scraper, { TablaDeLeads } from './Scraper';

/** Las fuentes quedan fijas: la elección real la hacen las pestañas del scraper. */
const TODAS_LAS_FUENTES = 'Las 3: Google Maps + LinkedIn + Facebook';

export default function PanelProspeccion({
  herramienta,
  estado,
  puedeEditar,
  organizacion,
  faltaPermiso,
  onIr,
  onEstadoCambiado,
  rutaEstado,
  rutaGenerar,
}) {
  const ids = useMemo(() => camposDe(herramienta).map((c) => c.id), [herramienta]);

  const [valores, setValores] = useState(() => {
    const guardados = aValoresDeFormulario(ids, estado.perfil[herramienta.id]);
    for (const campo of camposDe(herramienta)) {
      if (guardados[campo.id] === undefined && campo.valorPorOmision) {
        guardados[campo.id] = campo.valorPorOmision;
      }
    }
    return guardados;
  });

  const versionesGuardadas = estado.historial[herramienta.id] || [];
  const [version, setVersion] = useState(0);
  const [reciente, setReciente] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [leads, setLeads] = useState([]);

  const todas = useMemo(() => fuentes(estado), [estado]);
  const heredadas = FUENTES_POR_HERRAMIENTA[herramienta.id] || [];
  const criticasQueFaltan = useMemo(() => faltantes(estado, herramienta.id), [estado, herramienta.id]);

  /* El nicho heredado prellena el tipo de negocio de Maps y el cargo de LinkedIn. Es lo único
     que el scraper toma del contexto: lo demás lo escribe el alumno para cada búsqueda. */
  const nicho = todas.niche.presente ? todas.niche.completo : '';

  const documento = reciente
    ? reciente.texto
    : versionesGuardadas[version]
      ? versionesGuardadas[version].output
      : '';

  const campo = (id) => camposDe(herramienta).find((c) => c.id === id);
  const canal = campo('t20-canal');
  const tono = campo('t20-tono');

  const ponerCampo = (id, v) => setValores((previo) => ({ ...previo, [id]: v }));

  const problema = (respuesta) => {
    if (respuesta.tipo === 'datos') return null;
    if (respuesta.tipo === 'rechazado') return mensajeDeRechazo(respuesta.codigo, respuesta.estado, respuesta.detalle);
    return SIN_RESPUESTA;
  };

  const generar = async () => {
    setError(null);
    setGenerando(true);
    const r = await pedir(rutaGenerar, {
      metodo: 'POST',
      cuerpo: {
        herramienta: herramienta.id,
        valores: { ...valores, 't20-fuentes': TODAS_LAS_FUENTES },
      },
      espera: ESPERA_DE_RUTA_LARGA_MS,
    });
    setGenerando(false);
    const mal = problema(r);
    if (mal) {
      setError(mal);
      return;
    }
    setReciente(r.datos);
    setVersion(0);
    onEstadoCambiado();
  };

  return (
    <div className="cl-page">
      <div className="fd-cab">
        <h3>{herramienta.titulo}</h3>
        <span className="fd-bajada">{herramienta.bajada}</span>
        {herramienta.detalle ? (
          <>
            <button type="button" className="fd-mas" onClick={() => setDetalleAbierto((v) => !v)}>
              ¿Cómo funciona? {detalleAbierto ? '▴' : '▾'}
            </button>
            {detalleAbierto ? <div className="fd-detalle">{herramienta.detalle}</div> : null}
          </>
        ) : null}
      </div>

      {heredadas.length > 0 ? (
        <div className="fd-herencia">
          <span className="fd-etq">Hereda de</span>
          {heredadas.map((clave) => {
            const f = todas[clave];
            const critica = criticasQueFaltan.includes(clave);
            return (
              <button
                key={clave}
                type="button"
                className={`fd-fuente${f.presente ? ' ok' : critica ? ' falta' : ''}`}
                onClick={() => onIr(f.herramienta)}
                title={f.presente ? 'Ir a la herramienta que lo produjo' : 'Ir a completarlo'}
              >
                <b>{f.etiqueta}</b>
                {f.presente ? (f.resumen ? f.resumen : 'listo') : 'sin hacer'}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="pr-cols">
        <Scraper nicho={nicho} onLeads={setLeads} />

        <div className="pr-tarjeta">
          <div className="pr-tarjeta-titulo">💬 Configuración de Outreach</div>
          <div className="fd-campo">
            <label htmlFor="t20-canal">{canal ? canal.etiqueta : ''}</label>
            <select
              id="t20-canal"
              value={valores['t20-canal'] ?? (canal ? canal.valorPorOmision : '') ?? ''}
              onChange={(e) => ponerCampo('t20-canal', e.target.value)}
            >
              {canal?.opciones?.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
            </select>
          </div>
          <div className="fd-campo">
            <label htmlFor="t20-tono">{tono ? tono.etiqueta : ''}</label>
            <select
              id="t20-tono"
              value={valores['t20-tono'] ?? (tono ? tono.valorPorOmision : '') ?? ''}
              onChange={(e) => ponerCampo('t20-tono', e.target.value)}
            >
              {tono?.opciones?.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
            </select>
          </div>
          <p className="pr-nota">
            Estos definen el canal y el tono del Plan de Prospección que generás abajo.
          </p>
        </div>
      </div>

      {leads.length > 0 ? (
        <div className="pr-resultados">
          <TablaDeLeads leads={leads} />
        </div>
      ) : null}

      {/* El historial NO se pinta acá: vive en su propia pestaña «Mis Leads», al lado de
          Prospección. Estuvo un rato embebido debajo de esta tabla y el problema fue de
          descubrimiento — quedaba bajo el pliegue, después de un panel largo, y no se veía. */}

      <div className="pr-zona-plan">
        {/* El orden recomendado, no un requisito: se puede generar el plan sin scrapear. */}
        <div className="pr-flujo">
          <span className={`pr-paso${leads.length > 0 ? ' hecho' : ''}`}>1 · Scrapeá los leads</span>
          <span className="pr-flecha">→</span>
          <span className="pr-paso espera">2 · Esperá a que termine</span>
          <span className="pr-flecha">→</span>
          <span className="pr-paso sigue">3 · Generá el plan</span>
        </div>

        {puedeEditar ? (
          <button type="button" className="fd-btn pr-btn-plan" disabled={generando} onClick={generar}>
            {generando ? 'Generando…' : herramienta.etiquetaBoton}
          </button>
        ) : null}

        {faltaPermiso ? (
          <div className="fd-aviso">
            <i>◍</i>
            <span>Tu rol puede ver esta pantalla, pero no generar. Generar consume tokens de la organización.</span>
          </div>
        ) : null}

        <p className="pr-nota-plan">
          Scrapeá tus leads arriba, después generá el plan de ataque con tu contexto heredado,
          canal y tono.
        </p>
      </div>

      {error ? (
        <div className="fd-aviso error">
          <i>◍</i>
          <span>{error}</span>
        </div>
      ) : null}

      {generando ? (
        <>
          <div className="fd-cargando">
            <span className="fd-punto" />
            Esto tarda entre uno y tres minutos. No cierres la pestaña.
          </div>
          <div className="fd-esqueleto">
            <span style={{ width: '62%' }} />
            <span style={{ width: '94%' }} />
            <span style={{ width: '88%' }} />
          </div>
        </>
      ) : null}

      {documento ? (
        <Documento
          titulo={herramienta.etiquetaSalida}
          texto={documento}
          versiones={versionesGuardadas}
          versionActiva={version}
          onElegirVersion={(i) => {
            setVersion(i);
            setReciente(null);
          }}
          cortado={reciente ? reciente.cortado : false}
          citas={reciente ? reciente.citas : []}
          meta={reciente}
          organizacion={organizacion}
          /* `sinAjuste` — el hub declara esta herramienta con `hasEdit: false`. */
          onAjustar={null}
          ajustando={generando}
        />
      ) : null}
    </div>
  );
}
