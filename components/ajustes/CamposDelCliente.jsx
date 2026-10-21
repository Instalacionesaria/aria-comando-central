'use client';

/* Ajustes › Clientes › el puntaje y el Perfil de UN cliente (el nivel 3, C6 · D4). NO viene del prototipo.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * QUÉ SE ELIGE ACÁ
 *
 * Cuál campo del GoHighLevel de este cliente es el puntaje de sus leads, y qué carpetas de campos se muestran en el
 * Perfil de la ficha y en qué grupo. Sin elegir, se reconocen solos: el campo que se llama «Puntaje | ICP» y las
 * carpetas del snapshot de ARIA. Un cliente con otros nombres no tiene ni lo uno ni lo otro hasta que alguien elige.
 *
 * Se monta desde `ConexionDelCliente.jsx` también para el principal: no son credenciales, son su catálogo de campos.
 * Las opciones, los grupos y si esta persona puede guardar los dice el servidor: acá no hay ninguna lista de tipos ni
 * de grupos propia, y quien sólo ve no recibe botones que van a dar 403. «Leyendo…» sólo mientras no hay datos, como
 * en la Conexión: guardar pinta el estado RESUELTO que devuelve el servidor, no lo que se mandó.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';

const MOTIVOS = {
  sin_permiso: 'Tu usuario no puede ver ni elegir el puntaje y el Perfil de los clientes.',
  no_encontrado: 'Ese cliente ya no existe, o no es de esta empresa.',
};

const MARCAS = {
  elegido: { clase: 'ok', texto: 'Elegido' },
  por_omision: { clase: 'ok', texto: 'Por su nombre' },
  ninguno: { clase: 'warn', texto: 'Sin puntaje' },
};

function porQue(r) {
  if (r.tipo === 'sin_respuesta') return 'No llegó al servidor. No se guardó nada.';
  return r.detalle ?? MOTIVOS[r.codigo] ?? `Rechazado (${r.estado}).`;
}

/** El valor del selector del puntaje para lo que dice el servidor: '' = sin elegir. */
const puntajeDe = (d) => (d.puntaje.origen === 'elegido' ? d.puntaje.campoId : '');

export default function CamposDelCliente({ cliente }) {
  const ruta = `/api/admin/cuentas/${cliente.id}/campos`;
  const [datos, setDatos] = useState(null);
  const [causa, setCausa] = useState(null);
  const [puntaje, setPuntaje] = useState('');
  const [grupos, setGrupos] = useState({});
  const [guardando, setGuardando] = useState(null);
  const [aviso, setAviso] = useState(null);

  /* Lo que el servidor dijo pasa a ser lo que se ve: el selector del puntaje y el de cada carpeta vuelven a su valor
     guardado, así que «cambiado» es siempre contra lo guardado. */
  const pintar = useCallback((d) => {
    setDatos(d);
    setPuntaje(puntajeDe(d));
    setGrupos(Object.fromEntries(d.carpetas.map((c) => [c.carpetaId, c.grupo ?? ''])));
  }, []);

  const leer = useCallback(async () => {
    const r = await pedir(ruta);
    if (r.tipo !== 'datos') {
      setCausa(porQue(r));
      return;
    }
    pintar(r.datos);
    setCausa(null);
  }, [ruta, pintar]);

  useEffect(() => {
    void leer();
  }, [leer]);

  const guardar = useCallback(
    async (que, cuerpo, listo) => {
      setGuardando(que);
      setAviso(null);
      const r = await pedir(ruta, { metodo: 'PUT', cuerpo });
      setGuardando(null);
      if (r.tipo !== 'datos') {
        setAviso({ mal: true, texto: porQue(r) });
        return;
      }
      pintar(r.datos);
      setAviso({ mal: false, texto: listo });
    },
    [ruta, pintar],
  );

  if (!datos) {
    return (
      <div className="aj-bloque">
        <div className="dw-sec-t">Puntaje y Perfil</div>
        {causa ? (
          <>
            <div className="fd-aviso mal" role="status">
              <i>⚠</i>
              <span>{causa}</span>
            </div>
            <div className="aj-fila">
              <button type="button" className="fd-btn sec" onClick={() => void leer()}>
                Reintentar
              </button>
            </div>
          </>
        ) : (
          <p className="aj-ayuda">Leyendo el catálogo de campos…</p>
        )}
      </div>
    );
  }

  const elAviso = aviso ? (
    <div className={`fd-aviso ${aviso.mal ? 'mal' : 'bien'}`} role="status">
      <i>{aviso.mal ? '⚠' : '✓'}</i>
      <span>{aviso.texto}</span>
    </div>
  ) : null;

  if (!datos.catalogo.leido) {
    return (
      <div className="aj-bloque">
        <div className="dw-sec-t">Puntaje y Perfil</div>
        <p className="aj-ayuda">
          Todavía no se leyó el catálogo de campos de este cliente. Se lee con la sincronización de contactos; vuelve
          cuando haya corrido.
        </p>
      </div>
    );
  }

  const editable = datos.puedeEditar === true;
  const marca = MARCAS[datos.puntaje.origen];
  const puntajeCambiado = puntaje !== puntajeDe(datos);
  const cambiadas = datos.carpetas
    .filter((c) => (grupos[c.carpetaId] ?? '') !== (c.grupo ?? ''))
    .map((c) => ({ carpetaId: c.carpetaId, grupo: grupos[c.carpetaId] === '' ? null : grupos[c.carpetaId] }));

  return (
    <div className="aj-bloque">
      <div className="dw-sec-t">Puntaje y Perfil</div>
      <p className="aj-ayuda">
        El campo de su GoHighLevel que es el puntaje de sus leads (0 a 100), y qué carpetas de campos se ven en el Perfil
        de la ficha. Sin elegir, se reconocen por su nombre.
      </p>

      <div className="fd-campo">
        <label htmlFor={`pyp-${cliente.id}`}>
          Campo del puntaje <span className={`chip ${marca.clase}`}>{marca.texto}</span>
        </label>
        <div className="aj-fila">
          <div className="fd-campo">
            <select
              id={`pyp-${cliente.id}`}
              value={puntaje}
              disabled={!editable || guardando !== null}
              onChange={(e) => setPuntaje(e.target.value)}
            >
              <option value="">Sin elegir: el que se llama «Puntaje | ICP»</option>
              {datos.opciones.map((o) => (
                // El elegido viaja aunque ya no sea numérico: se ve seleccionado, y no se puede volver a elegir.
                <option key={o.campoId} value={o.campoId} disabled={o.yaNoEsNumerico}>
                  {`${o.nombre} — ${o.usables} leads con un número de 0 a 100${o.yaNoEsNumerico ? ` (ahora es ${o.tipo})` : ''}`}
                </option>
              ))}
            </select>
          </div>
          {editable ? (
            <button
              type="button"
              className="fd-btn"
              disabled={!puntajeCambiado || guardando !== null}
              onClick={() =>
                void guardar('puntaje', { puntaje: puntaje === '' ? null : puntaje }, 'Guardado. El puntaje de sus leads ya se recalculó con este campo.')
              }
            >
              {guardando === 'puntaje' ? 'Guardando…' : 'Guardar el puntaje'}
            </button>
          ) : null}
        </div>
        {datos.puntaje.origen === 'ninguno' ? (
          <div className="fd-aviso mal" role="status">
            <i>⚠</i>
            <span>
              {editable
                ? 'Su GoHighLevel no tiene un campo «Puntaje | ICP»: elige el suyo, o sus leads quedan «Sin calificar».'
                : 'Su GoHighLevel no tiene un campo «Puntaje | ICP»: hasta que alguien elija el suyo, sus leads quedan «Sin calificar».'}
            </span>
          </div>
        ) : null}
        {datos.puntaje.yaNoEsNumerico ? (
          <div className="fd-aviso mal" role="status">
            <i>⚠</i>
            <span>
              El campo elegido ya no es numérico en GoHighLevel: lo que no sea un número de 0 a 100 queda «Sin calificar».
            </span>
          </div>
        ) : null}
        {datos.puntaje.noVistoEnLaUltimaLectura ? (
          <div className="fd-aviso mal" role="status">
            <i>⚠</i>
            <span>
              El campo elegido no vino en la última lectura del catálogo: lo borraron en GoHighLevel, o este cliente se
              vinculó a otra subcuenta. Mientras siga elegido, sus leads nuevos quedan «Sin calificar».
            </span>
          </div>
        ) : null}
      </div>

      <div className="fd-campo">
        <label>Carpetas del Perfil</label>
        {datos.carpetas.map((c) => (
          <div className="aj-fila" key={c.carpetaId}>
            <div className="fd-campo">
              <label htmlFor={`pyp-${cliente.id}-${c.carpetaId}`}>
                {c.nombre ?? `Sin nombre (${c.carpetaId})`} · {c.campos} {c.campos === 1 ? 'campo' : 'campos'}{' '}
                {c.elegida ? <span className="chip">Elegida a mano</span> : null}
              </label>
              <select
                id={`pyp-${cliente.id}-${c.carpetaId}`}
                value={grupos[c.carpetaId] ?? ''}
                disabled={!editable || guardando !== null}
                onChange={(e) => setGrupos((g) => ({ ...g, [c.carpetaId]: e.target.value }))}
              >
                <option value="">No se muestra</option>
                {datos.grupos.map((g) => (
                  <option key={g.clave} value={g.clave}>
                    {g.titulo}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
        {editable ? (
          <div className="aj-fila">
            <button
              type="button"
              className="fd-btn"
              disabled={cambiadas.length === 0 || guardando !== null}
              onClick={() =>
                void guardar(
                  'carpetas',
                  { carpetas: cambiadas },
                  'Guardado. El Perfil lo muestra al abrir la ficha, y los Briefs de sus citas se vuelven a preparar.',
                )
              }
            >
              {guardando === 'carpetas' ? 'Guardando…' : 'Guardar las carpetas'}
            </button>
          </div>
        ) : null}
      </div>
      {elAviso}
    </div>
  );
}
