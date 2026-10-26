'use client';

/* Ajustes › Clientes › el ICP y el Perfil de UN cliente (el nivel 3, C6 · D4). NO viene del prototipo.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * QUÉ SE VE Y QUÉ SE ELIGE ACÁ
 *
 * Se ve el campo del cuadrante del ICP de su GoHighLevel (la `105`): si lo tiene y cuántos de sus leads clasifica. No
 * se elige: el ICP son las cuatro palabras que el CRM manda en `contact.cuadrante_de_clasificacion`, el mismo campo en
 * todos los clientes, y se reconoce por su clave. Hasta el 2026-10-26 acá se elegía el campo del puntaje de 0 a 100,
 * que ya no se usa. Se elige qué carpetas de campos se muestran en el Perfil de la ficha y en qué grupo; sin elegir, se
 * reconocen las del snapshot de ARIA.
 *
 * Se monta desde `ConexionDelCliente.jsx` también para el principal: no son credenciales, son su catálogo de campos.
 * Las opciones, los grupos y si esta persona puede guardar los dice el servidor: acá no hay ninguna lista de tipos ni
 * de grupos propia, y quien sólo ve no recibe botones que van a dar 403. «Leyendo…» sólo mientras no hay datos, como
 * en la Conexión: guardar pinta el estado RESUELTO que devuelve el servidor, no lo que se mandó.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';

const MOTIVOS = {
  sin_permiso: 'Tu usuario no puede ver el ICP ni elegir el Perfil de los clientes.',
  no_encontrado: 'Ese cliente ya no existe, o no es de esta empresa.',
};

const miles = (n) => Number(n).toLocaleString('es-PE');

function porQue(r) {
  if (r.tipo === 'sin_respuesta') return 'No llegó al servidor. No se guardó nada.';
  return r.detalle ?? MOTIVOS[r.codigo] ?? `Rechazado (${r.estado}).`;
}

export default function CamposDelCliente({ cliente }) {
  const ruta = `/api/admin/cuentas/${cliente.id}/campos`;
  const [datos, setDatos] = useState(null);
  const [causa, setCausa] = useState(null);
  const [grupos, setGrupos] = useState({});
  const [guardando, setGuardando] = useState(null);
  const [aviso, setAviso] = useState(null);

  /* Lo que el servidor dijo pasa a ser lo que se ve: el selector de cada carpeta vuelve a su valor guardado, así que
     «cambiado» es siempre contra lo guardado. */
  const pintar = useCallback((d) => {
    setDatos(d);
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
        <div className="dw-sec-t">ICP y Perfil</div>
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
        <div className="dw-sec-t">ICP y Perfil</div>
        <p className="aj-ayuda">
          Todavía no se leyó el catálogo de campos de este cliente. Se lee con la sincronización de contactos; vuelve
          cuando haya corrido.
        </p>
      </div>
    );
  }

  const editable = datos.puedeEditar === true;
  const cuadrante = datos.cuadrante;
  const cambiadas = datos.carpetas
    .filter((c) => (grupos[c.carpetaId] ?? '') !== (c.grupo ?? ''))
    .map((c) => ({ carpetaId: c.carpetaId, grupo: grupos[c.carpetaId] === '' ? null : grupos[c.carpetaId] }));

  return (
    <div className="aj-bloque">
      <div className="dw-sec-t">ICP y Perfil</div>
      <p className="aj-ayuda">
        El cuadrante del ICP de sus leads (Prioriza, Valida, Financia o Descarta) sale del campo de su GoHighLevel con la
        clave contact.cuadrante_de_clasificacion: se reconoce solo, no se elige. Abajo, qué carpetas de campos se ven en
        el Perfil de la ficha.
      </p>

      <div className="fd-campo">
        <label>
          Campo del cuadrante{' '}
          <span className={`chip ${cuadrante.campoId ? 'ok' : 'warn'}`}>{cuadrante.campoId ? 'Encontrado' : 'No está'}</span>
        </label>
        {cuadrante.campoId ? (
          <p className="aj-ayuda">
            «{cuadrante.nombre}» · {miles(cuadrante.clasificados)} {cuadrante.clasificados === 1 ? 'lead clasificado' : 'leads clasificados'}
            {cuadrante.conValor > cuadrante.clasificados
              ? ` · ${miles(cuadrante.conValor - cuadrante.clasificados)} con un valor que no es ninguna de las cuatro palabras`
              : ''}
          </p>
        ) : (
          <div className="fd-aviso mal" role="status">
            <i>⚠</i>
            <span>
              Su GoHighLevel no tiene el campo contact.cuadrante_de_clasificacion: hasta que lo tenga, sus leads quedan «Sin
              clasificar».
            </span>
          </div>
        )}
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
