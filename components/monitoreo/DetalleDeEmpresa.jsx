'use client';

/* Qué scrapeó UNA empresa, y qué leads le quedaron.
   ==========================================================================

   Se abre haciendo clic en una fila del Panel de Monitoreo, y reemplaza la tabla en vez de
   abrirse en una ventana. Es una decisión, no una comodidad: son dos tablas largas —los
   trabajos y los leads— y una ventana modal con scroll propio dentro de una pantalla con
   scroll propio es exactamente donde la gente se pierde. El «← Volver» lleva de vuelta.

   ── LO QUE SE MUESTRA, Y POR QUÉ SON DOS TABLAS Y NO UNA ──────────────────

   Porque responden dos preguntas distintas:

     · **Qué buscó** — una fila por scraping disparado, con lo que se pidió (`Peluquería ·
       Cayma, Arequipa, Perú`), el estado, y cuántos leads dejó ESE trabajo. Es lo que dice si
       una empresa está usando bien la herramienta o disparando búsquedas que no traen nada.
     · **Qué obtuvo** — el historial de leads, igual que lo ve la propia empresa en «Mis Leads»,
       con filtro por fuente y descarga a CSV.

   Una sola tabla mezclada no puede: un trabajo que falló no tiene leads que mostrar, y un lead
   no sabe de qué búsqueda salió una vez que está en el historial.

   ── LOS CEROS QUE NO SON CEROS, OTRA VEZ ──────────────────────────────────

   Un trabajo `COMPLETED` con 0 leads y un trabajo `FAILED` con 0 leads se ven igual si sólo se
   mira el número. El estado va en su propia columna y el texto del fallo se muestra debajo,
   porque son dos problemas opuestos: uno es del criterio de búsqueda, el otro del scraper. */

import { useCallback, useEffect, useState } from 'react';

import { NOMBRE_DE_FUENTE } from '@/lib/monitoreo/fuentes';
import {
  COLUMNAS_DE_LEAD,
  NOMBRE_DE_ESTADO,
  leadsACsv,
  leerDetalle,
  num,
} from '@/lib/monitoreo/panel';

/* Las fuentes del filtro de leads. Incluye `facebook` —la etiqueta corta con la que el backend
   guarda las dos variantes— porque es un valor real de la columna `source`, no de la de trabajos. */
const FILTROS = [
  { valor: '', etiqueta: 'Todas las fuentes' },
  { valor: 'maps', etiqueta: 'Google Maps' },
  { valor: 'linkedin', etiqueta: 'LinkedIn' },
  { valor: 'facebook', etiqueta: 'Facebook' },
  { valor: 'ad-spy', etiqueta: 'Espía de Anuncios' },
];

/** Las columnas que se pintan como enlace y no como texto. */
const ES_ENLACE = new Set(['website']);

export default function DetalleDeEmpresa({ empresa, alVolver }) {
  const [detalle, setDetalle] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [fuente, setFuente] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    const r = await leerDetalle(empresa.orgId, pagina, fuente);
    if (r.tipo === 'datos') setDetalle(r.detalle);
    else {
      setError(r.mensaje);
      setDetalle(null);
    }
    setCargando(false);
  }, [empresa.orgId, pagina, fuente]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const alCambiarFuente = (v) => {
    setFuente(v);
    setPagina(1); // sin esto, filtrar desde la página 3 muestra un vacío que parece "no hay leads"
  };

  const descargar = () => {
    /* El BOM al principio: sin él, Excel en Windows abre el CSV con la codificación del sistema y
       «Espía de Anuncios» aparece con la tilde rota. */
    const url = URL.createObjectURL(
      new Blob([`﻿${leadsACsv(detalle.leads)}`], { type: 'text/csv;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${empresa.slug}-pagina-${pagina}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="mon-detalle-cabeza">
        <button type="button" className="fd-btn-menor" onClick={alVolver}>
          ← Volver al panel
        </button>
        <span className="mon-detalle-titulo">
          {empresa.nombre}
          {empresa.esPrincipal ? <span className="tagx ag">Principal</span> : null}
        </span>
        <button type="button" className="fd-btn-menor" onClick={cargar} disabled={cargando}>
          {cargando ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {error ? (
        <div className="fd-aviso error">
          <i>◍</i>
          <span>{error}</span>
        </div>
      ) : null}

      {cargando && !detalle ? <p className="mon-vacio">Cargando…</p> : null}

      {detalle ? (
        <>
          {/* ── Qué buscó ── */}
          <div className="mon-bloque">
            <div className="mon-cabeza">
              <span>
                Scrapeos disparados
                {detalle.hayMasTrabajos ? (
                  <span className="mon-pie" style={{ display: 'inline', marginLeft: 8 }}>
                    se muestran los {detalle.trabajos.length} más recientes
                  </span>
                ) : null}
              </span>
            </div>

            {detalle.trabajos.length === 0 ? (
              <p className="mon-vacio">Esta empresa todavía no disparó ningún scraping.</p>
            ) : (
              <div className="mon-scroll">
                <table className="mon-tabla">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Scraper</th>
                      <th>Qué buscó</th>
                      <th>Estado</th>
                      <th className="mon-n">Pedidos</th>
                      <th className="mon-n">Leads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.trabajos.map((t) => (
                      <tr key={t.id}>
                        <td>{new Date(t.fecha).toLocaleDateString('es-PE')}</td>
                        <td>{NOMBRE_DE_FUENTE[t.fuente] ?? t.fuente}</td>
                        <td>
                          {t.queBusco || <span className="mon-cero">—</span>}
                          {/* El motivo del fallo, debajo y no en un `title`: un texto que sólo se
                              ve al pasar el mouse es un texto que en la práctica no existe. */}
                          {t.error ? <div className="mon-error">{t.error}</div> : null}
                        </td>
                        <td className={t.estado === 'FAILED' ? 'mon-fallo' : undefined}>
                          {NOMBRE_DE_ESTADO[t.estado] ?? t.estado}
                        </td>
                        <td className="mon-n">
                          {t.maxLeads === null ? <span className="mon-cero">—</span> : num(t.maxLeads)}
                        </td>
                        <td className={t.leads > 0 ? 'mon-n' : 'mon-n mon-cero'}>{num(t.leads)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Qué obtuvo ── */}
          <div className="mon-bloque" style={{ marginTop: 14 }}>
            <div className="mon-cabeza">
              <span>Leads obtenidos</span>
              <div className="mon-acciones">
                <select
                  aria-label="Filtrar por fuente"
                  value={fuente}
                  onChange={(e) => alCambiarFuente(e.target.value)}
                >
                  {FILTROS.map((f) => (
                    <option key={f.valor} value={f.valor}>{f.etiqueta}</option>
                  ))}
                </select>
                {detalle.leads.length > 0 ? (
                  <button type="button" className="fd-btn-menor" onClick={descargar}>
                    Descargar esta página (CSV)
                  </button>
                ) : null}
              </div>
            </div>

            {detalle.leads.length === 0 ? (
              <p className="mon-vacio">
                {fuente
                  ? 'Esta empresa no tiene leads de esa fuente.'
                  : 'Esta empresa todavía no tiene ningún lead guardado.'}
              </p>
            ) : (
              <>
                <div className="mon-scroll">
                  <table className="mon-tabla">
                    <thead>
                      <tr>
                        <th>Fuente</th>
                        {COLUMNAS_DE_LEAD.map((c) => <th key={c.clave}>{c.etiqueta}</th>)}
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.leads.map((l) => (
                        <tr key={l.id}>
                          <td>{NOMBRE_DE_FUENTE[l.source] ?? l.source}</td>
                          {COLUMNAS_DE_LEAD.map((c) => (
                            <td key={c.clave}>
                              {ES_ENLACE.has(c.clave) && l[c.clave] ? (
                                <a href={l[c.clave]} target="_blank" rel="noopener noreferrer">
                                  {l[c.clave]}
                                </a>
                              ) : (
                                l[c.clave] || <span className="mon-cero">—</span>
                              )}
                            </td>
                          ))}
                          <td>{new Date(l.created_at).toLocaleDateString('es-PE')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Sin total de páginas: saberlo cuesta un `count(*)` sobre toda la tabla en cada
                    carga, y lo único que hace falta es si hay una más. */}
                <div className="mon-paginado">
                  <button
                    type="button"
                    className="fd-btn-menor"
                    disabled={pagina <= 1 || cargando}
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  >
                    ← Anterior
                  </button>
                  <span>Página {pagina}</span>
                  <button
                    type="button"
                    className="fd-btn-menor"
                    disabled={!detalle.hayMasLeads || cargando}
                    onClick={() => setPagina((p) => p + 1)}
                  >
                    Siguiente →
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}
