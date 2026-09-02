'use client';

/* Las piezas del Espía que usan las DOS pantallas.
   ==========================================================================
   El buscador y la tarjeta de anuncio viven acá porque hay dos lugares que espían la Meta Ad
   Library con el mismo motor:

     · `EspiaDeAnuncios` (Tools → Espía de Anuncios): mirar el nicho y sacar los patrones con IA.
     · La columna del Espía en la pestaña Facebook de Prospección: descubrir anunciantes para
       después sacarles los contactos.

   Duplicar el buscador habría sido la lista paralela con forma de formulario: la pantalla en la que
   alguien agregue un país, corrija el marcador o arregle el Enter quedaría distinta de la otra sin
   que nada falle — y las dos siguen llamando al mismo actor de Apify, que se cobra igual. */

import { useState } from 'react';

import { PAISES, TIPO_DE_ANUNCIO } from '@/lib/tools/scrapers';

/**
 * El buscador: dónde, en qué país y qué.
 *
 * `onBuscar` recibe el texto ya limpio. La validación de que no esté vacío la hace quien lo usa,
 * porque el mensaje de error va a su propio aviso —y en Prospección ese aviso convive con el de la
 * columna de al lado—.
 */
export function BuscadorDeAnuncios({ consulta, onConsulta, pais, onPais, onBuscar, ocupado, etiqueta }) {
  return (
    <div className="es-barra">
      <select className="es-select" value="meta" onChange={() => {}} aria-label="Dónde espiar">
        <option value="meta">Meta Ad Library</option>
        {/* Deshabilitada y a la vista, como en el hub: dice qué falta sin prometer que anda. */}
        <option value="tiktok" disabled>
          TikTok Creative Center (pronto)
        </option>
      </select>
      <select
        className="es-select"
        value={pais}
        onChange={(e) => onPais(e.target.value)}
        aria-label="País donde espiar los anuncios"
      >
        {PAISES.map((p) => (
          <option key={p.codigo} value={p.codigo}>
            {p.etiqueta}
          </option>
        ))}
      </select>
      <input
        className="es-consulta"
        type="text"
        value={consulta}
        onChange={(e) => onConsulta(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !ocupado) onBuscar();
        }}
        placeholder="Buscá por nicho, marca o página… (ej: agencias de marketing IA)"
      />
      <button type="button" className="fd-btn" disabled={ocupado} onClick={onBuscar}>
        {ocupado ? 'Buscando…' : etiqueta}
      </button>
    </div>
  );
}

/** Una tarjeta de anuncio: la miniatura, la longevidad, la página y el copy. */
export function TarjetaDeAnuncio({ anuncio }) {
  const [imagenOk, setImagenOk] = useState(true);
  const dias = anuncio.days_active ?? 0;
  const copy = anuncio.body_text || anuncio.title || '';

  return (
    <div className="es-tarjeta">
      <div className="es-media">
        {anuncio.thumbnail_url && imagenOk ? (
          /* eslint-disable-next-line @next/next/no-img-element -- la miniatura la sirve el CDN de
             Meta con una URL firmada y de vida corta: `next/image` la optimizaría contra un dominio
             que no podemos declarar de antemano y que además cambia. */
          <img src={anuncio.thumbnail_url} alt="" onError={() => setImagenOk(false)} />
        ) : (
          <svg width="30" height="30" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke="currentColor" strokeWidth="1.5" d="M4 5h16v14H4zM4 9h16M9 5v4" />
          </svg>
        )}
      </div>
      <div className="es-cuerpo">
        <div className="es-meta">
          {/* La longevidad es LA señal de esta herramienta: un anuncio que lleva meses corriendo es
              uno que le está funcionando a alguien. Por eso va primero y resaltada. */}
          <span className={`es-pastilla${anuncio.is_active ? ' vivo' : ''}`}>
            Activo {dias} día{dias === 1 ? '' : 's'}
          </span>
          <span className="es-pastilla">
            {TIPO_DE_ANUNCIO[anuncio.media_type || ''] || 'Anuncio'}
          </span>
        </div>
        {anuncio.page_name ? <div className="es-pagina">{anuncio.page_name}</div> : null}
        {copy ? <div className="es-copy">{copy}</div> : null}
        {anuncio.ad_library_url ? (
          <a
            className="es-enlace"
            href={anuncio.ad_library_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver en Ad Library ↗
          </a>
        ) : null}
      </div>
    </div>
  );
}
