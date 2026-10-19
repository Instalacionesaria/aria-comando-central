'use client';

/* El tablero de Negocios (el nivel 3): las empresas —los clientes de ARIA— y los clientes de cada una.
   ==========================================================================
   Lo ve sólo el superadministrador, desde la principal (`app/api/negocios/route.ts`). Arriba, las cifras de la cartera
   sin ARIA y sin clientes de prueba; abajo, una fila por empresa que se abre en sus clientes.

   La configuración es la de ahora; las cifras, las de la foto del día, que dice de cuándo es (`lib/cartera/tablero.ts`).
   Una cifra que no se midió es «—», nunca un cero. «Entrar» cambia a esa empresa, como el selector de la barra.
   «Descargar» arma un CSV con lo que está a la vista. */

import { Fragment, useMemo, useState } from 'react';
import { usarLectura } from '../../lib/usarLectura.ts';
import { pedir } from '../../lib/http/cliente.ts';
import AvisoDesactualizado from '../negocio/AvisoDesactualizado.jsx';

/** Cómo se dice cada paso de la lista de chequeo (`lib/cartera/pasos.ts`). */
const PASO = {
  crm: 'CRM',
  calendario: 'calendario',
  zona: 'zona horaria',
  nicho: 'nicho',
  datos: 'datos al día',
  meta: 'Meta',
  aviso: 'avisos del CRM',
  llave_de_ia: 'llave de IA',
  un_cliente: 'un cliente listo',
};
const ESTADO = { activa: 'activo', pausada: 'pausado', baja: 'de baja' };

const cifra = (v) => (v === null || v === undefined ? '—' : v.toLocaleString('es-PE'));
const porcentaje = (v) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)} %`);
const dinero = (monto, moneda) =>
  monto === null || monto === undefined
    ? '—'
    : `${moneda ?? ''} ${Number(monto).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();

/** «Foto de hoy, 06:29» o «Foto del 2026-10-17». */
function rotuloDeLaFoto(foto) {
  if (!foto.dia) return 'Sin foto todavía';
  const hoy = new Date().toLocaleDateString('en-CA');
  const hora = foto.tomadaEl
    ? new Date(foto.tomadaEl).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
    : null;
  return foto.dia === hoy ? `Foto de hoy${hora ? `, ${hora}` : ''}` : `Foto del ${foto.dia}`;
}

function LoQueFalta({ faltan, listo }) {
  if (listo) return <span className="tagx ag">listo</span>;
  if (faltan.length === 0) return <span className="tagx nu">sin medir</span>;
  return (
    <span className="neg-tags">
      {faltan.map((p) => (
        <span key={p} className="tagx seg">
          {PASO[p] ?? p}
        </span>
      ))}
    </span>
  );
}

/** Un valor de CSV, entre comillas si hace falta. */
const celda = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function descargar(empresas) {
  const filas = [
    ['empresa', 'cliente', 'estado', 'de_prueba', 'nicho', 'nicho_confirmado', 'configurado', 'faltan', 'contactos',
      'contactos_nuevos_30d', 'agendaron_30d', 'ventas_30d', 'monto_30d', 'moneda', 'gasto_30d'],
  ];
  for (const e of empresas) {
    for (const c of e.detalle) {
      filas.push([
        e.nombre, c.nombre, c.estado, c.esPrueba ? 'si' : 'no', c.nicho, c.nichoConfirmado ? 'si' : 'no',
        c.configurado ? 'si' : 'no', c.faltan.join(' '), c.cifras?.contactos, c.cifras?.contactosNuevos30d,
        c.cifras?.agendaron30d, c.cifras?.ventas30d, c.cifras?.monto30d, c.moneda, c.cifras?.gasto30d,
      ]);
    }
  }
  const texto = filas.map((f) => f.map(celda).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `negocios-${new Date().toLocaleDateString('en-CA')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PanelDeNegocios() {
  const { datos, situacion, causa, refrescar } = usarLectura('/api/negocios', {
    sinRespuesta: 'No se pudo contactar al servidor: no es que no haya negocios.',
  });
  const [nicho, setNicho] = useState('');
  const [soloLoQueFalta, setSoloLoQueFalta] = useState(false);
  const [abiertas, setAbiertas] = useState(() => new Set());
  const [aviso, setAviso] = useState(null);

  /* El filtro va sobre los clientes: una empresa queda si su nicho es ése o si tiene un cliente de ese nicho, y al
     abrirla se ven sólo esos clientes. «Sólo lo que falta» deja lo que no está listo, en los dos niveles. */
  const empresas = useMemo(() => {
    if (!datos) return [];
    return datos.empresas
      .map((e) => {
        const detalle = e.detalle.filter(
          (c) => (!nicho || c.nicho === nicho) && (!soloLoQueFalta || (!c.configurado && c.estado === 'activa')),
        );
        return { ...e, detalle };
      })
      .filter((e) => (!nicho || e.nicho === nicho || e.detalle.length > 0) && (!soloLoQueFalta || !e.configurada || e.detalle.length > 0));
  }, [datos, nicho, soloLoQueFalta]);

  const conmutar = (id) =>
    setAbiertas((antes) => {
      const ahora = new Set(antes);
      if (ahora.has(id)) ahora.delete(id);
      else ahora.add(id);
      return ahora;
    });

  const entrar = async (e) => {
    setAviso(null);
    const r = await pedir('/api/auth/sesion', { metodo: 'PATCH', cuerpo: { orgId: e.id } });
    if (r.tipo !== 'datos') {
      setAviso(`No se pudo entrar a ${e.nombre ?? 'esa empresa'}.`);
      return;
    }
    // La sesión entera cambió: se recarga, como al cambiar de empresa desde la barra.
    window.location.reload();
  };

  if (!datos) {
    return situacion === 'rechazado' || situacion === 'sin_respuesta' ? (
      <div className="fd-aviso mal" role="status">
        <i>⚠</i>
        <span>{causa ?? 'No se pudieron leer los negocios.'}</span>
      </div>
    ) : (
      <p className="mon-vacio">Leyendo los negocios…</p>
    );
  }

  const i = datos.indicadores;
  return (
    <>
      <AvisoDesactualizado causa={causa} alReintentar={refrescar} />
      {datos.aviso ? (
        <div className="fd-aviso falta" role="status">
          <i>◍</i>
          <span>{datos.aviso}</span>
        </div>
      ) : null}
      {aviso ? (
        <div className="fd-aviso mal" role="status">
          <i>⚠</i>
          <span>{aviso}</span>
        </div>
      ) : null}

      <div className="mon-totales">
        <div className="mon-tarjeta">
          <span className="mon-cifra">{cifra(i.empresas)}</span>
          <span className="mon-rotulo">Empresas</span>
          <span className="mon-pie">{cifra(i.empresasConfiguradas)} configuradas</span>
        </div>
        <div className="mon-tarjeta">
          <span className="mon-cifra">{cifra(i.clientes)}</span>
          <span className="mon-rotulo">Sus clientes</span>
          <span className="mon-pie">{cifra(i.clientesConfigurados)} configurados</span>
        </div>
        <div className="mon-tarjeta">
          <span className="mon-cifra">{cifra(i.contactosNuevos30d)}</span>
          <span className="mon-rotulo">Contactos nuevos</span>
          <span className="mon-pie">
            últimos 30 días{i.sinMedir > 0 ? ` · ${i.sinMedir} sin medir` : ''}
          </span>
        </div>
        <div className="mon-tarjeta">
          <span className="mon-cifra">{cifra(i.ventas30d)}</span>
          <span className="mon-rotulo">Ventas</span>
          <span className="mon-pie">últimos 30 días, sin ARIA ni clientes de prueba</span>
        </div>
      </div>

      {datos.nichos.length > 0 || datos.sinNicho > 0 ? (
        <div className="neg-nichos" aria-label="Clientes por nicho">
          {datos.nichos.map((n) => (
            <span key={n.nicho} className="neg-nicho">
              <b>{n.nicho}</b> {n.clientes} {n.clientes === 1 ? 'cliente' : 'clientes'} · {n.empresas}{' '}
              {n.empresas === 1 ? 'empresa' : 'empresas'}
            </span>
          ))}
          {datos.sinNicho > 0 ? (
            <span className="neg-nicho">
              <b>sin nicho confirmado</b> {datos.sinNicho}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mon-bloque">
        <div className="mon-cabeza">
          <div className="inc-filtros">
            <span className="neg-foto">{rotuloDeLaFoto(datos.foto)}</span>
            <select value={nicho} onChange={(e) => setNicho(e.target.value)} aria-label="Nicho">
              <option value="">Todos los nichos</option>
              {datos.nichos.map((n) => (
                <option key={n.nicho} value={n.nicho}>
                  {n.nicho}
                </option>
              ))}
            </select>
            <label>
              <input type="checkbox" checked={soloLoQueFalta} onChange={(e) => setSoloLoQueFalta(e.target.checked)} />
              Sólo lo que falta
            </label>
          </div>
          <div className="mon-acciones">
            <button type="button" className="fd-btn-menor" onClick={() => descargar(empresas)} disabled={empresas.length === 0}>
              Descargar
            </button>
            <button type="button" className="fd-btn-menor" onClick={() => void refrescar()}>
              Actualizar
            </button>
          </div>
        </div>

        {empresas.length === 0 ? <p className="mon-vacio">Nada con ese filtro.</p> : null}
        {empresas.length > 0 ? (
          <div className="mon-scroll">
            <table className="mon-tabla">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Clientes</th>
                  <th>Configuración</th>
                  <th>Contactos nuevos</th>
                  <th>Ventas</th>
                  <th>Vendido</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {empresas.map((e) => {
                  const abierta = abiertas.has(e.id);
                  return (
                    <Fragment key={e.id}>
                      <tr className={e.activa ? '' : 'inc-revisado'}>
                        <td>
                          <button
                            type="button"
                            className="neg-abrir"
                            aria-expanded={abierta}
                            onClick={() => conmutar(e.id)}
                            disabled={e.detalle.length === 0}
                          >
                            {abierta ? '▾' : '▸'}
                          </button>
                          <b>{e.nombre ?? e.id}</b>
                          {e.esPrincipal ? <span className="tagx nu">ARIA</span> : null}
                          <span className="inc-sub">
                            {[e.nicho, e.pais, e.activa ? null : 'desactivada'].filter(Boolean).join(' · ') || 'sin nicho'}
                          </span>
                        </td>
                        <td>
                          {cifra(e.clientes.activos)} activos
                          <span className="inc-sub">
                            {e.clientes.pausados} pausados · {e.clientes.deBaja} de baja
                            {e.clientes.dePrueba > 0 ? ` · ${e.clientes.dePrueba} de prueba` : ''}
                          </span>
                        </td>
                        <td>
                          <LoQueFalta faltan={e.faltan} listo={e.configurada} />
                        </td>
                        <td>{e.cifras?.medida ? cifra(e.cifras.contactosNuevos30d) : '—'}</td>
                        <td>{e.cifras?.medida ? cifra(e.cifras.ventas30d) : '—'}</td>
                        <td>
                          {e.montos.length === 0
                            ? '—'
                            : e.montos.map((m) => (
                                <span key={m.moneda ?? '-'} className="inc-sub">
                                  {dinero(m.monto30d, m.moneda)}
                                </span>
                              ))}
                        </td>
                        <td>
                          {e.esPrincipal ? null : (
                            <button type="button" className="fd-btn-menor" onClick={() => void entrar(e)}>
                              Entrar
                            </button>
                          )}
                        </td>
                      </tr>
                      {abierta
                        ? e.detalle.map((c) => (
                            <tr key={c.id} className="neg-cliente">
                              <td>
                                {c.nombre ?? c.id}
                                {c.esPorOmision ? <span className="tagx nu">principal</span> : null}
                                {c.esPrueba ? <span className="tagx nu">de prueba</span> : null}
                                <span className="inc-sub">
                                  {[ESTADO[c.estado], c.nicho ? `${c.nicho}${c.nichoConfirmado ? '' : ' (sin confirmar)'}` : null]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </span>
                              </td>
                              <td>
                                {c.cifras?.medida ? `${cifra(c.cifras.compradores)} compradores` : '—'}
                                <span className="inc-sub">{c.cifras?.medida ? `${cifra(c.cifras.contactos)} contactos` : ''}</span>
                              </td>
                              <td>
                                <LoQueFalta faltan={c.faltan} listo={c.configurado} />
                              </td>
                              <td>
                                {c.cifras?.medida ? cifra(c.cifras.contactosNuevos30d) : '—'}
                                <span className="inc-sub">
                                  {c.cifras?.medida ? `agendó ${porcentaje(c.cifras.tasaDeAgenda)}` : ''}
                                </span>
                              </td>
                              <td>{c.cifras?.medida ? cifra(c.cifras.ventas30d) : '—'}</td>
                              <td>
                                {c.cifras?.medida ? dinero(c.cifras.monto30d, c.moneda) : '—'}
                                <span className="inc-sub">
                                  {c.cifras?.medida && c.cifras.gasto30d !== null ? `gasto ${dinero(c.cifras.gasto30d, c.moneda)}` : ''}
                                </span>
                              </td>
                              <td />
                            </tr>
                          ))
                        : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </>
  );
}
