'use client';

/* Los topes del cerebro, en Ajustes › Credenciales (`docs/OTROS/agentes/06-MODELOS-USO-TOPES-E-INCIDENTES.md`,
 * AG-96 y AG-97): cuántas preguntas por día admite el cerebro, por persona y por empresa, y lo usado hoy.
 *
 * Lee y escribe `app/api/admin/cerebro/route.ts`. Los números de omisión, el máximo y lo usado los manda el
 * servidor: acá no se escribe ninguno. El formulario se dibuja sólo para quien puede guardar, que es
 * `credenciales.editar` —lo que la sesión dice en `puedeConfigurarComisiones`, con la condición exacta del
 * PUT—: un botón que el servidor va a rechazar es peor que no tenerlo. */

import { useCallback, useEffect, useState } from 'react';
import { useSesion } from '../../app/sesion-contexto.tsx';
import { pedir } from '../../lib/http/cliente.ts';

export default function TopesDelCerebro() {
  const sesion = useSesion();
  // `credenciales.editar`, la condición exacta del PUT: la sesión la dice con ese nombre (`app/api/auth/sesion`).
  const puedeEditar = Boolean(sesion?.puedeConfigurarComisiones);
  const zona = sesion?.organizacion.zonaHoraria ?? 'UTC';
  const [datos, setDatos] = useState(null);
  const [causa, setCausa] = useState(null);
  const [borrador, setBorrador] = useState({ porPersona: '', porEmpresa: '' });
  const [aviso, setAviso] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const r = await pedir('/api/admin/cerebro');
    if (r.tipo !== 'datos') {
      setCausa(r.tipo === 'rechazado' ? (r.detalle ?? 'No se pudieron leer los topes.') : 'No se pudo contactar al servidor.');
      return;
    }
    setDatos(r.datos);
    setCausa(null);
    setBorrador({ porPersona: String(r.datos.porPersona), porEmpresa: String(r.datos.porEmpresa) });
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const guardar = async () => {
    setGuardando(true);
    setAviso(null);
    const r = await pedir('/api/admin/cerebro', {
      metodo: 'PUT',
      cuerpo: { porPersona: Number(borrador.porPersona), porEmpresa: Number(borrador.porEmpresa) },
    });
    setGuardando(false);
    if (r.tipo !== 'datos') {
      setAviso({ mal: true, texto: r.tipo === 'rechazado' ? (r.detalle ?? 'No se pudieron guardar.') : 'No llegó la respuesta del servidor: vuelve a abrir Ajustes para ver si se guardaron.' });
      return;
    }
    setAviso({ mal: false, texto: 'Guardados. Rigen desde la próxima pregunta.' });
    await cargar();
  };

  const cambiado =
    datos !== null && (borrador.porPersona !== String(datos.porPersona) || borrador.porEmpresa !== String(datos.porEmpresa));

  return (
    <div className="card">
      <div className="card-head">Topes del cerebro</div>
      <div className="card-body aj-cuerpo">
        <div className="aj-ayuda">
          Cuántas preguntas por día puede hacerle al cerebro cada persona, y la empresa entera. Cada pregunta gasta la
          llave de IA de la empresa. El día es el de la empresa: se renueva a la medianoche.
        </div>
        {causa ? (
          <div className="fd-aviso mal" role="status">
            <i>◍</i>
            <span>{causa}</span>
          </div>
        ) : null}
        {datos ? (
          <>
            <div className="aj-ayuda">
              Hoy van {datos.usadasPorEmpresa} de {datos.porEmpresa} preguntas de la empresa. Se renueva a las{' '}
              {new Intl.DateTimeFormat('es', { timeZone: zona, hour: '2-digit', minute: '2-digit' }).format(new Date(datos.renuevaEl))} ({zona}).
              Por omisión son {datos.porOmision.porPersona} por persona y {datos.porOmision.porEmpresa} por empresa.
            </div>
            {puedeEditar ? (
              <div className="aj-fila">
                <label className="fd-campo cb-tope">
                  <span>Por persona</span>
                  <input
                    type="number"
                    min={1}
                    max={datos.maximo}
                    value={borrador.porPersona}
                    onChange={(e) => setBorrador((b) => ({ ...b, porPersona: e.target.value }))}
                  />
                </label>
                <label className="fd-campo cb-tope">
                  <span>Por empresa</span>
                  <input
                    type="number"
                    min={1}
                    max={datos.maximo}
                    value={borrador.porEmpresa}
                    onChange={(e) => setBorrador((b) => ({ ...b, porEmpresa: e.target.value }))}
                  />
                </label>
                <button type="button" className="fd-btn" disabled={guardando || !cambiado} onClick={() => void guardar()}>
                  {guardando ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            ) : (
              <div className="aj-valor">
                {datos.porPersona} por persona · {datos.porEmpresa} por empresa
              </div>
            )}
          </>
        ) : null}
        {aviso ? (
          <div className={`fd-aviso ${aviso.mal ? 'mal' : 'bien'}`} role="status">
            <i>{aviso.mal ? '⚠' : '✓'}</i>
            <span>{aviso.texto}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
