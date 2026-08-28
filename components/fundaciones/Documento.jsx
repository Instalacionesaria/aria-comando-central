'use client';

/* Un entregable en pantalla: el veredicto, el documento, sus versiones, y el ajuste.
   ==========================================================================
   Es el mismo componente para las siete herramientas, y eso es lo que hace que un
   alumno no tenga que aprender siete pantallas. Lo que cambia entre ellas es el
   formulario, no el entregable.

   El bloque `<veredicto>` se separa del cuerpo ANTES de renderizar (ver
   `lib/fundaciones/documento.ts`): si saliera crudo, las cuatro primeras líneas del
   Mapa de Proceso serían etiquetas XML, y como el resto del documento se ve bien
   nadie lo reportaría — se asumiría que "así sale". */

import { useRef, useState } from 'react';

import { aHtml, aTextoPlano, leerDocumento } from '@/lib/fundaciones/documento';
import { descargarComoDoc, descargarComoPdf, nombreDeArchivo } from '@/lib/fundaciones/exportar';

export default function Documento({
  titulo,
  texto,
  versiones,
  versionActiva,
  onElegirVersion,
  cortado,
  citas,
  meta,
  onAjustar,
  ajustando,
  organizacion,
}) {
  const [notaAbierta, setNotaAbierta] = useState(false);
  const [nota, setNota] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  /* El PDF importa `jspdf` bajo demanda, así que hay una espera real entre el clic y la descarga.
     Sin decirlo, un segundo de silencio se lee como que el botón no hizo nada — y el reflejo es
     volver a apretarlo, que descarga el archivo dos veces. */
  const [exportando, setExportando] = useState(null);
  const menu = useRef(null);

  const { veredicto, cuerpo } = leerDocumento(texto);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(aTextoPlano(texto));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      /* Sin portapapeles (permiso denegado, contexto no seguro): el botón no confirma,
         y no confirmar es lo correcto — decir "copiado" sin haber copiado es peor. */
    }
  };

  /* Los tres formatos salen del MISMO texto que se copia al portapapeles: el `<veredicto>` nunca
     sale crudo a un archivo. Ver `aTextoPlano` y el encabezado de `exportar.ts`. */
  const descargarMd = () => {
    const blob = new Blob([aTextoPlano(texto)], { type: 'text/markdown;charset=utf-8' });
    bajarBlob(blob, `${nombreDeArchivo(titulo)}.md`);
  };

  const bajarBlob = (blob, nombre) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  /* Una sola puerta para los tres, y con `finally`: si el PDF falla a mitad de camino, el rótulo
     tiene que volver igual. Un botón que se queda diciendo «Armando PDF…» para siempre es peor
     que el error. */
  const exportar = async (formato) => {
    setMenuAbierto(false);
    setExportando(formato);
    try {
      if (formato === 'pdf') await descargarComoPdf(titulo, aTextoPlano(texto), organizacion || '');
      else if (formato === 'doc') descargarComoDoc(titulo, aTextoPlano(texto), organizacion || '');
      else descargarMd();
    } finally {
      setExportando(null);
    }
  };

  const pedirAjuste = () => {
    const limpia = nota.trim();
    if (!limpia) return;
    onAjustar(limpia);
    setNota('');
    setNotaAbierta(false);
  };

  return (
    <div className="card">
      <div className="card-head">
        <div className="fd-doc-cab">
          <span className="fd-titulo">{titulo}</span>
          {meta ? (
            <span className="fd-meta">
              {Math.round(meta.milisegundos / 1000)}s
              {meta.tokens ? ` · ${meta.tokens.toLocaleString('es-PE')} tokens` : ''}
            </span>
          ) : null}
          <div className="fd-der">
            <button type="button" className={`fd-mini${copiado ? ' on' : ''}`} onClick={copiar}>
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
            <span className="fd-menu-ancla" ref={menu}>
              <button
                type="button"
                className={`fd-mini${menuAbierto ? ' on' : ''}`}
                disabled={exportando !== null}
                aria-expanded={menuAbierto}
                onClick={() => setMenuAbierto((v) => !v)}
              >
                {exportando === 'pdf'
                  ? 'Armando PDF…'
                  : exportando
                    ? 'Descargando…'
                    : 'Descargar'}
              </button>
              {menuAbierto ? (
                <>
                  {/* La capa que cierra al hacer clic afuera. Es un elemento y no un `blur` del
                      botón: un `blur` se dispara ANTES del clic en el propio menú, así que elegir
                      una opción lo cerraría sin ejecutarla. */}
                  <div className="fd-menu-fondo" onClick={() => setMenuAbierto(false)} />
                  <div className="fd-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => exportar('doc')}>
                      Word (.doc)
                    </button>
                    <button type="button" role="menuitem" onClick={() => exportar('pdf')}>
                      PDF (.pdf)
                    </button>
                    <button type="button" role="menuitem" onClick={() => exportar('md')}>
                      Markdown (.md)
                    </button>
                  </div>
                </>
              ) : null}
            </span>
            {onAjustar ? (
              <button
                type="button"
                className={`fd-mini${notaAbierta ? ' on' : ''}`}
                onClick={() => setNotaAbierta((v) => !v)}
              >
                Ajustar
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Más de una versión: se pueden mirar las anteriores. El hub guarda diez y acá se
            conserva el número — un alumno que regenera cinco veces quiere volver a la segunda. */}
        {versiones && versiones.length > 1 ? (
          <div className="fd-versiones">
            <span>Versiones</span>
            {versiones.map((v, i) => (
              <button
                key={`${v.date}-${i}`}
                type="button"
                className={`fd-version${i === versionActiva ? ' on' : ''}`}
                onClick={() => onElegirVersion(i)}
                title={v.date}
              >
                v{versiones.length - i}
              </button>
            ))}
            <span>{versiones[versionActiva] ? versiones[versionActiva].date : ''}</span>
          </div>
        ) : null}

        {cortado ? (
          <div className="fd-aviso falta">
            <i>◍</i>
            <span>
              <b>El documento quedó cortado.</b> El modelo llegó al techo de tokens antes de
              terminar. Volvé a generarlo, o pedí un ajuste que lo acorte.
            </span>
          </div>
        ) : null}

        {veredicto.length > 0 ? (
          <div className="fd-veredicto">
            {veredicto.map((v, i) => (
              <div key={`${v.titulo}-${i}`}>
                <div className="fd-vt">{v.titulo}</div>
                <div className="fd-vc">{v.conclusion}</div>
              </div>
            ))}
          </div>
        ) : null}

        {/* El texto ya viene escapado por `aHtml`: el escape es lo PRIMERO que hace, antes de
            agregar cualquier etiqueta propia. Ver la nota del encabezado de ese módulo. */}
        <div className="fd-doc" dangerouslySetInnerHTML={{ __html: aHtml(cuerpo) }} />

        {citas && citas.length > 0 ? (
          <div className="fd-citas">
            <span className="fd-etq">Fuentes consultadas</span>
            {citas.map((c) => (
              <a key={c.url} href={c.url} target="_blank" rel="noreferrer noopener">
                {c.titulo}
              </a>
            ))}
          </div>
        ) : null}

        {notaAbierta ? (
          <div className="fd-ajuste">
            <textarea
              value={nota}
              placeholder="Qué querés que cambie. Ej: hacé la sección de dolores más específica al nicho, y bajá el tono de venta."
              onChange={(e) => setNota(e.target.value)}
            />
            <button
              type="button"
              className="fd-btn"
              disabled={ajustando || nota.trim() === ''}
              onClick={pedirAjuste}
            >
              {ajustando ? 'Regenerando…' : 'Regenerar'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
