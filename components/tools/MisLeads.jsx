'use client';

/* Mis Leads: el historial de todo lo que la organización scrapeó.
   ==========================================================================

   ── POR QUÉ ESTA VISTA NO EXISTÍA, Y POR QUÉ AHORA SÍ ─────────────────────

   Los leads de un scraping vivían en `useState([])` dentro de `Scraper.jsx` y en ningún otro
   lado del hub: **recargar la pantalla perdía la vista de leads que la organización acababa de
   pagar**. Los datos estaban a salvo en la base del backend, pero desde acá no había cómo
   volver a pedirlos.

   Se pudo cerrar recién ahora porque las tablas del scraper se mudaron a la base de este
   proyecto (`migraciones/006_aria_cc_scraper.sql`). Antes vivían en otro proyecto Supabase y
   habría hecho falta otro proxy.

   ── NO REUSA `TablaDeLeads` DE `Scraper.jsx`, A PROPÓSITO ─────────────────

   Aquélla pinta lo que devuelve EL ACTOR: columnas que cambian según la fuente, descubiertas
   en tiempo de ejecución mirando las claves del primer lead. Sirve para eso — mostrar lo que
   acaba de llegar, sin saber qué va a traer.

   Acá las columnas son SEIS y siempre las mismas, porque la tabla las normalizó. Una tabla de
   columnas fijas se puede ordenar, filtrar y exportar; una de columnas descubiertas no. Reusar
   la otra habría significado perder eso para ahorrar treinta líneas. */

import { useCallback, useEffect, useState } from 'react';

import { COLUMNAS, NOMBRE_DE_FUENTE, aCsv, leerLeads } from '@/lib/tools/leads';

/** Las fuentes que se pueden filtrar. El valor vacío es "todas". */
const FILTROS = [
  { valor: '', etiqueta: 'Todas las fuentes' },
  { valor: 'maps', etiqueta: 'Google Maps' },
  { valor: 'linkedin', etiqueta: 'LinkedIn' },
  { valor: 'facebook', etiqueta: 'Facebook' },
  { valor: 'ad-spy', etiqueta: 'Espía de Anuncios' },
];

/** Las columnas que se pintan como enlace y no como texto. */
const ES_ENLACE = new Set(['website']);

export default function MisLeads() {
  const [pagina, setPagina] = useState(1);
  const [fuente, setFuente] = useState('');
  const [filas, setFilas] = useState([]);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    const r = await leerLeads(pagina, fuente);
    if (r.tipo === 'datos') {
      setFilas(r.pagina.filas);
      setHayMas(r.pagina.hayMas);
    } else {
      setError(r.mensaje);
      setFilas([]);
      setHayMas(false);
    }
    setCargando(false);
  }, [pagina, fuente]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /* La descarga se arma en el navegador con los datos que ya están en pantalla: no hay una
     segunda petición ni una ruta que genere el archivo. Exporta LA PÁGINA visible, y eso está
     dicho en el botón — prometer "todos" y bajar cien sería peor que no ofrecerlo. */
  const descargar = () => {
    const csv = aCsv(filas);
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-pagina-${pagina}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const alCambiarFuente = (v) => {
    setFuente(v);
    setPagina(1); // sin esto, filtrar desde la página 3 muestra un vacío que parece "no hay leads"
  };

  return (
    <div className="leads-bloque">
      <div className="leads-cabeza">
        <span>Mis Leads</span>
        <div className="leads-acciones">
          <select
            aria-label="Filtrar por fuente"
            value={fuente}
            onChange={(e) => alCambiarFuente(e.target.value)}
          >
            {FILTROS.map((f) => (
              <option key={f.valor} value={f.valor}>{f.etiqueta}</option>
            ))}
          </select>
          {filas.length > 0 ? (
            <button type="button" className="fd-btn-menor" onClick={descargar}>
              Descargar esta página (CSV)
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="fd-aviso error">
          <i>◍</i>
          <span>{error}</span>
        </div>
      ) : null}

      {cargando ? <p className="leads-vacio">Cargando…</p> : null}

      {!cargando && !error && filas.length === 0 ? (
        <p className="leads-vacio">
          {fuente
            ? 'No hay leads de esa fuente todavía.'
            : 'Todavía no scrapeaste ningún lead. Los que extraigas arriba van a quedar acá.'}
        </p>
      ) : null}

      {filas.length > 0 ? (
        <>
          <div className="leads-scroll">
            <table className="leads-tabla">
              <thead>
                <tr>
                  <th>Fuente</th>
                  {COLUMNAS.map((c) => <th key={c.clave}>{c.etiqueta}</th>)}
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((lead) => (
                  <tr key={lead.id}>
                    <td>{NOMBRE_DE_FUENTE[lead.source] ?? lead.source}</td>
                    {COLUMNAS.map((c) => (
                      <td key={c.clave}>
                        {ES_ENLACE.has(c.clave) && lead[c.clave] ? (
                          <a href={lead[c.clave]} target="_blank" rel="noopener noreferrer">
                            {lead[c.clave]}
                          </a>
                        ) : (
                          lead[c.clave] || '—'
                        )}
                      </td>
                    ))}
                    <td>{new Date(lead.created_at).toLocaleDateString('es-PE')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sin total de páginas: saberlo cuesta un `count(*)` sobre toda la tabla en cada
              carga, y lo único que la pantalla necesita es si hay una más. */}
          <div className="leads-paginado">
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
              disabled={!hayMas || cargando}
              onClick={() => setPagina((p) => p + 1)}
            >
              Siguiente →
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
