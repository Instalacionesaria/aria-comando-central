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

import {
  COLUMNAS,
  NOMBRE_DE_FUENTE,
  aCsv,
  enviarLeadsAlCrm,
  leerLeads,
} from '@/lib/tools/leads';

/**
 * Las fuentes, como BOTONES y no como desplegable.
 *
 * Un `select` esconde las opciones hasta que lo abrís: no se ve que hay filtros ni cuáles son.
 * Con cinco opciones fijas, los botones dicen de un vistazo qué se puede filtrar y cuál está
 * puesto — que es como estaba en el hub, y por eso Kevin lo pidió así.
 */
const FILTROS = [
  { valor: '', etiqueta: 'Todos' },
  { valor: 'maps', etiqueta: 'Maps' },
  { valor: 'linkedin', etiqueta: 'LinkedIn' },
  { valor: 'facebook', etiqueta: 'Facebook' },
  { valor: 'ad-spy', etiqueta: 'Espía' },
];

/**
 * Lo que se espera desde la última tecla antes de consultar.
 *
 * Sin esta pausa, escribir "clínica" son SIETE consultas contra la base, seis de las cuales ya
 * no le importan a nadie cuando llegan — y encima pueden volver desordenadas y pintar el
 * resultado de "clín" encima del de "clínica".
 */
const ESPERA_DE_TECLEO_MS = 350;

/** Las columnas que se pintan como enlace y no como texto. */
const ES_ENLACE = new Set(['website']);

/**
 * El color de la pastilla de cada fuente.
 *
 * Un color por origen y no uno solo, porque la columna se lee de un vistazo: con todo del mismo
 * gris hay que LEER cada fila para saber de dónde salió el lead. Las dos variantes de Facebook
 * comparten color a propósito — para quien mira la tabla son "Facebook", y distinguirlas por
 * tono sería una diferencia sin consecuencia.
 *
 * Son tokens de la paleta y no colores escritos: el tema claro los redefine, así que la tabla
 * se adapta sola.
 */
const COLOR_DE_FUENTE = {
  maps: 'maps',
  linkedin: 'linkedin',
  facebook: 'facebook',
  'facebook-ads': 'facebook',
  'facebook-pages': 'facebook',
  'ad-spy': 'espia',
};

/** Las columnas que llevan tratamiento propio: el correo se destaca, el teléfono va monoespaciado. */
const CLASE_DE_COLUMNA = {
  name: 'lead-nombre',
  email: 'lead-email',
  phone: 'lead-tel',
  website: 'lead-enlace',
};

export default function MisLeads() {
  const [pagina, setPagina] = useState(1);
  const [fuente, setFuente] = useState('');
  /* Dos estados para el buscador, no uno: `texto` es lo que se ve en el campo y cambia con
     cada tecla; `busqueda` es lo que se consultó y sólo cambia cuando pasó la pausa. Con uno
     solo, o el campo escribe a tirones o se consulta por cada letra. */
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filas, setFilas] = useState([]);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  /* ── La selección y el envío al CRM ───────────────────────────────────────
     `Set` y no array: marcar y desmarcar son la operación más frecuente de esta pantalla, y con
     un array cada clic sería un `filter` sobre cien elementos. */
  const [marcados, setMarcados] = useState(() => new Set());
  const [etiqueta, setEtiqueta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);

  /* El reloj de la pausa. Al teclear de nuevo —o al desmontar— se cancela el anterior: sin el
     `clearTimeout`, cerrar la pestaña con una búsqueda a medias dejaría un `setState` sobre un
     componente que ya no existe. */
  useEffect(() => {
    const t = setTimeout(() => {
      setBusqueda(texto.trim());
      setPagina(1); // buscar desde la página 3 mostraría un vacío que parece "no hay resultados"
    }, ESPERA_DE_TECLEO_MS);
    return () => clearTimeout(t);
  }, [texto]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    const r = await leerLeads(pagina, fuente, busqueda);
    if (r.tipo === 'datos') {
      setFilas(r.pagina.filas);
      setHayMas(r.pagina.hayMas);
    } else {
      setError(r.mensaje);
      setFilas([]);
      setHayMas(false);
    }
    /* La selección se limpia al cambiar de página, filtro o búsqueda, y es a propósito: si
       sobreviviera, el contador diría «12 seleccionados» mientras en pantalla hay otros cuatro,
       y nadie podría saber qué se va a enviar. La selección es sobre lo que se ve. */
    setMarcados(new Set());
    setCargando(false);
  }, [pagina, fuente, busqueda]);

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

  const alternar = (id) => {
    setMarcados((antes) => {
      const ahora = new Set(antes);
      if (ahora.has(id)) ahora.delete(id);
      else ahora.add(id);
      return ahora;
    });
  };

  const todosMarcados = filas.length > 0 && filas.every((f) => marcados.has(f.id));
  const alternarTodos = () =>
    setMarcados(todosMarcados ? new Set() : new Set(filas.map((f) => f.id)));

  const enviar = async () => {
    setEnviando(true);
    setAviso(null);
    const r = await enviarLeadsAlCrm([...marcados], etiqueta);
    if (r.tipo === 'ok') {
      setAviso({
        mal: false,
        texto: `${r.enviados} leads subidos a HighLevel con la etiqueta «${r.etiqueta}».`,
      });
      /* Se limpia la selección pero NO la etiqueta: lo normal es subir varios lotes al mismo
         sitio, y volver a escribirla cada vez sería trabajo de más. */
      setMarcados(new Set());
    } else {
      setAviso({ mal: true, texto: r.mensaje });
    }
    setEnviando(false);
  };

  return (
    /* ── DOS COLUMNAS: la tabla y el panel de envío ────────────────────────────
       El panel va a la DERECHA y no debajo, y es la forma que tenía el hub. La razón no es
       estética: la selección se hace en la tabla y el envío se dispara en el panel, así que los
       dos tienen que estar visibles A LA VEZ. Con el panel debajo de cien filas, marcar y
       enviar quedan a dos pantallas de distancia.

       Y es PERMANENTE, con el contador en cero cuando no hay nada marcado. Así la pantalla dice
       que la acción existe antes de que alguien descubra las casillas — que es exactamente lo
       que le pasó a Kevin con la pestaña. */
    <div className="leads-con-panel">
      <div className="leads-bloque">
      <div className="leads-barra">
        <div className="leads-filtros" role="group" aria-label="Filtrar por fuente">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              aria-pressed={f.valor === fuente}
              className={f.valor === fuente ? 'on' : ''}
              onClick={() => alCambiarFuente(f.valor)}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>

        <input
          type="search"
          className="leads-buscar"
          placeholder="Buscar por nombre o email…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-label="Buscar por nombre o email"
        />

        {/* Se DESACTIVA en vez de esconderse: un botón que aparece y desaparece según los
            resultados hace saltar la fila entera y cuesta volver a encontrarlo. */}
        <button
          type="button"
          className="fd-btn-menor leads-csv"
          disabled={filas.length === 0}
          onClick={descargar}
        >
          Descargar CSV
        </button>
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
          {busqueda
            ? `Ningún lead coincide con «${busqueda}».`
            : fuente
              ? 'No hay leads de esa fuente todavía.'
              : 'Todavía no scrapeaste ningún lead. Los que extraigas en Prospección van a quedar acá.'}
        </p>
      ) : null}

      {filas.length > 0 ? (
        <>
          <div className="leads-scroll">
            <table className="leads-tabla">
              <thead>
                <tr>
                  {/* La casilla de la cabecera marca y desmarca LO QUE SE VE, no toda la tabla.
                      Prometer "todos" y marcar cien de tres mil seria peor que no ofrecerlo. */}
                  <th className="lead-casilla">
                    <input
                      type="checkbox"
                      checked={todosMarcados}
                      onChange={alternarTodos}
                      aria-label="Marcar todos los de esta página"
                    />
                  </th>
                  <th>Fuente</th>
                  {COLUMNAS.map((c) => <th key={c.clave}>{c.etiqueta}</th>)}
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((lead) => (
                  <tr key={lead.id} className={marcados.has(lead.id) ? 'marcada' : ''}>
                    <td className="lead-casilla">
                      <input
                        type="checkbox"
                        checked={marcados.has(lead.id)}
                        onChange={() => alternar(lead.id)}
                        aria-label={`Seleccionar ${lead.name ?? 'este lead'}`}
                      />
                    </td>
                    <td>
                      <span className={`lead-fuente ${COLOR_DE_FUENTE[lead.source] ?? ''}`}>
                        {NOMBRE_DE_FUENTE[lead.source] ?? lead.source}
                      </span>
                    </td>
                    {COLUMNAS.map((c) => {
                      const valor = lead[c.clave];
                      return (
                        <td key={c.clave} className={valor ? CLASE_DE_COLUMNA[c.clave] : 'lead-vacio'}>
                          {!valor ? (
                            '—'
                          ) : ES_ENLACE.has(c.clave) ? (
                            <a href={valor} target="_blank" rel="noopener noreferrer">
                              {/* Sin el esquema la columna se lee mejor y el enlace sigue yendo
                                  al mismo lado: `https://` ocupa ocho caracteres en cada fila y
                                  no distingue una de otra. */}
                              {String(valor).replace(/^https?:\/\//, '').replace(/\/$/, '')}
                            </a>
                          ) : (
                            valor
                          )}
                        </td>
                      );
                    })}
                    <td className="lead-fecha">
                      {new Date(lead.created_at).toLocaleDateString('es-PE')}
                    </td>
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

      {/* ── El panel de envío ─────────────────────────────────────────────────
          NO pide API Token ni Location ID, y ésa es la diferencia con el del hub. Los dos ya
          viven en las credenciales de la organización —el token cifrado— cargados una vez en
          Ajustes por un administrador. Pedirlos otra vez acá sería duplicar un secreto y
          dejar que cualquiera con permiso de editar pegue el de otra empresa.

          Sólo la ETIQUETA es de este envío, porque es lo único que cambia entre un lote y el
          siguiente. */}
      <aside className="leads-panel">
        <div className="lp-cuenta">
          <span>Leads para enviar</span>
          <b>{marcados.size}</b>
        </div>

        {marcados.size === 0 ? (
          <p className="lp-pista">
            Marcá los leads que querés subir con las casillas de la izquierda.
          </p>
        ) : null}

        <label className="lp-campo">
          Etiqueta
          <input
            type="text"
            placeholder="Ej: Clínicas Arequipa"
            value={etiqueta}
            onChange={(e) => setEtiqueta(e.target.value)}
            maxLength={60}
          />
          <em>Para identificar este lote en HighLevel.</em>
        </label>

        <button
          type="button"
          className="fd-btn lp-enviar"
          disabled={marcados.size === 0 || enviando}
          onClick={enviar}
        >
          {enviando
            ? 'Subiendo…'
            : `Subir ${marcados.size || ''} ${marcados.size === 1 ? 'lead' : 'leads'} a HighLevel`}
        </button>

        {aviso ? (
          <div className={aviso.mal ? 'fd-aviso mal' : 'fd-aviso'}>
            <i>◍</i>
            <span>{aviso.texto}</span>
          </div>
        ) : null}

        {/* Dónde se cargan las credenciales. Va SIEMPRE y no sólo cuando fallan: quien abre esta
            pantalla por primera vez se pregunta a qué cuenta van los leads, y la respuesta no
            debería requerir provocar un error para verla. */}
        <p className="lp-nota">
          El token y la subcuenta de HighLevel son los de tu organización, cargados en Ajustes.
        </p>
      </aside>
    </div>
  );
}
