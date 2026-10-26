'use client';

/* «Conectar con Meta» (Meta directo, M4). NO viene del prototipo.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * EL FLUJO DE TRES PASOS, VISTO DESDE AJUSTES
 *
 *   1. «Conectar con Meta» pide al servidor la URL del diálogo de Meta (`POST /api/admin/meta/conectar`) y navega a
 *      ella. Antes anota desde qué pestaña salió, porque Meta no lo devuelve;
 *   2. en Meta, quien conecta elige su portfolio y sus cuentas publicitarias, y acepta;
 *   3. Meta vuelve a `/meta/retorno`, que canjea el código y deja el resultado para acá (`lib/meta/retorno.ts`).
 *
 * Con `cliente` nulo es la vista de la EMPRESA (Ajustes › Credenciales): todas sus conexiones y todas sus cuentas
 * publicitarias, con un selector para asignar cada una a un cliente (sólo las que conectó la empresa: las que conectó
 * un cliente con su propio Meta son de ese cliente). Con `cliente` es la de ESE cliente (Ajustes › Clientes ›
 * Conexión): sus cuentas, y «Conectar» con el Meta de ese cliente.
 *
 * Ningún token llega acá: la vista sale de `GET /api/admin/meta`, que no lo trae.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';
import { anotarDesdeDondeSeConecta, tomarResultadoDeMeta } from '../../lib/meta/retorno.ts';

/** Lo que dice Meta del estado de una cuenta publicitaria (`account_status`). */
const ESTADO_EN_META = { 1: 'activa', 2: 'deshabilitada', 3: 'sin pagar', 7: 'en revisión', 8: 'pendiente de cierre', 9: 'en período de gracia', 101: 'cerrada' };
const ESTADO_DE_LA_CONEXION = { activa: ['ag', 'activa'], revocada: ['no', 'revocada: vuelve a conectar'], vencida: ['no', 'vencida: vuelve a conectar'] };
/** Lo único que esta pantalla acepta como destino: el diálogo de Meta. Cualquier otra URL es un error del servidor. */
const DIALOGO_DE_META = /^https:\/\/www\.facebook\.com\/v\d+\.\d+\/dialog\/oauth\?/;

function porQue(r) {
  if (r.tipo === 'sin_respuesta') return 'No llegó al servidor. Prueba de nuevo.';
  return r.detalle ?? `El servidor respondió ${r.estado}.`;
}

export default function ConectarConMeta({ cliente = null }) {
  const [vista, setVista] = useState(null);
  const [aviso, setAviso] = useState(() => {
    const r = tomarResultadoDeMeta();
    return r ? { mal: !r.ok, texto: r.texto } : null;
  });
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    const r = await pedir('/api/admin/meta');
    if (r.tipo === 'datos') setVista(r.datos);
    else setAviso({ mal: true, texto: `No se pudo leer la conexión con Meta. ${porQue(r)}` });
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const conectar = useCallback(async () => {
    setOcupado(true);
    setAviso(null);
    anotarDesdeDondeSeConecta(cliente ? 'clientes' : 'credenciales');
    const r = await pedir('/api/admin/meta/conectar', { metodo: 'POST', cuerpo: { cuentaId: cliente ? cliente.id : null } });
    if (r.tipo === 'datos' && typeof r.datos.url === 'string' && DIALOGO_DE_META.test(r.datos.url)) {
      window.location.assign(r.datos.url);
      return;
    }
    setOcupado(false);
    setAviso({ mal: true, texto: r.tipo === 'datos' ? 'El servidor no devolvió la dirección de Meta.' : porQue(r) });
  }, [cliente]);

  const asignar = useCallback(
    async (act, cuentaId) => {
      setOcupado(true);
      const r = await pedir(`/api/admin/meta/cuentas/${act}`, { metodo: 'PUT', cuerpo: { cuentaId: cuentaId || null } });
      setOcupado(false);
      if (r.tipo === 'datos') {
        setVista((v) => ({ ...v, ...r.datos }));
        setAviso({ mal: false, texto: cuentaId ? 'Cuenta asignada: desde la próxima lectura, su gasto es de ese cliente.' : 'Cuenta sin asignar: deja de leerse.' });
      } else setAviso({ mal: true, texto: porQue(r) });
    },
    [],
  );

  const desconectar = useCallback(async (id) => {
    if (!window.confirm('¿Desconectar este Meta? Sus cuentas dejan de leerse desde la próxima lectura. Lo ya traído se queda.')) return;
    setOcupado(true);
    const r = await pedir(`/api/admin/meta/conexiones/${id}`, { metodo: 'DELETE' });
    setOcupado(false);
    if (r.tipo === 'datos') {
      setVista((v) => ({ ...v, ...r.datos }));
      setAviso({ mal: false, texto: 'Meta quedó desconectado. Para que Meta tampoco le dé acceso, quita la integración en tu Business Manager.' });
    } else setAviso({ mal: true, texto: porQue(r) });
  }, []);

  if (vista === null) {
    return (
      <div className="pr-box">
        <div className="dw-sec-t">Meta</div>
        {aviso ? <div className={`fd-aviso ${aviso.mal ? 'mal' : 'bien'}`} role="status">{aviso.texto}</div> : <p className="aj-intro">Leyendo…</p>}
      </div>
    );
  }

  const nombreDe = (id) => vista.clientes.find((c) => c.id === id)?.nombre ?? 'sin asignar';
  const conexionDe = (id) => vista.conexiones.find((c) => c.id === id);
  // Las de la vista: la empresa ve todo; un cliente, lo suyo y las cuentas que la empresa le asignó.
  const cuentas = cliente ? vista.cuentas.filter((c) => c.cliente === cliente.id) : vista.cuentas;
  const conexiones = cliente
    ? vista.conexiones.filter((x) => x.cliente === cliente.id || cuentas.some((c) => c.conexionId === x.id))
    : vista.conexiones;

  return (
    <div className="pr-box">
      <div className="dw-sec-t">
        Meta
        <span className="r">
          {cuentas.some((c) => conexionDe(c.conexionId)?.estado === 'activa') ? (
            <span className="tagx ag">conectado</span>
          ) : (
            <span className="tagx no">sin conectar</span>
          )}
        </span>
      </div>
      <p className="aj-intro">
        {cliente
          ? `De Meta salen el gasto, las campañas y los anuncios de «${cliente.nombre}». Conéctalo con su Business Manager, o pídele a la empresa que le asigne una cuenta de las suyas.`
          : 'De Meta salen el gasto, las campañas y los anuncios de cada cliente. Conecta tu Business Manager y asigna cada cuenta publicitaria a su cliente. Sólo lectura: no se crea, pausa ni gasta nada.'}
      </p>
      {aviso ? (
        <div className={`fd-aviso ${aviso.mal ? 'mal' : 'bien'}`} role="status">
          {aviso.texto}
        </div>
      ) : null}
      {!vista.appConfigurada ? (
        <div className="fd-aviso mal" role="status">
          La conexión con Meta todavía no está configurada en el servidor. Avisa a quien administra Comando Central.
        </div>
      ) : null}

      {conexiones.map((x) => {
        const [clase, estado] = ESTADO_DE_LA_CONEXION[x.estado] ?? ['no', x.estado];
        return (
          <div className="aj-fila" key={x.id}>
            <span className="aj-ayuda">
              {x.origen === 'manual' ? 'Token pegado a mano' : `Business Manager ${x.negocio ?? ''}`.trim()} ·{' '}
              {x.cliente ? `de «${nombreDe(x.cliente)}»` : 'de la empresa'} · <span className={`tagx ${clase}`}>{estado}</span>
              {x.ultimoError ? ` · ${x.ultimoError}` : ''}
            </span>
            <button type="button" className="fd-btn sec aj-peligro" disabled={ocupado} onClick={() => void desconectar(x.id)}>
              Desconectar
            </button>
          </div>
        );
      })}

      {cuentas.length === 0 ? (
        <p className="aj-ayuda">{cliente ? 'Este cliente no tiene ninguna cuenta publicitaria de Meta asignada.' : 'Todavía no hay cuentas publicitarias conectadas.'}</p>
      ) : (
        cuentas.map((c) => {
          const deUnCliente = conexionDe(c.conexionId)?.cliente ?? null;
          return (
            <div className="aj-fila" key={c.act}>
              <span className="aj-ayuda">
                <b>{c.nombre ?? c.act}</b> · {c.act}
                {c.moneda ? ` · ${c.moneda}` : ''}
                {c.estadoEnMeta !== null && c.estadoEnMeta !== 1 ? ` · ${ESTADO_EN_META[c.estadoEnMeta] ?? `estado ${c.estadoEnMeta}`} en Meta` : ''}
              </span>
              {cliente || deUnCliente ? (
                <span className="aj-ayuda">{nombreDe(c.cliente)}</span>
              ) : (
                <div className="fd-campo">
                  <select value={c.cliente ?? ''} disabled={ocupado} onChange={(e) => void asignar(c.act, e.target.value)} aria-label={`Cliente de ${c.act}`}>
                    <option value="">Sin asignar (no se lee)</option>
                    {vista.clientes.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          );
        })
      )}

      <div className="aj-fila">
        <button type="button" className="fd-btn" disabled={ocupado || !vista.appConfigurada} onClick={() => void conectar()}>
          {ocupado ? 'Un momento…' : conexiones.length > 0 ? 'Conectar otro Business Manager' : 'Conectar con Meta'}
        </button>
      </div>
    </div>
  );
}
