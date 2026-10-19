'use client';

/* Ajustes › Clientes › la conexión de UN cliente (el nivel 3). NO viene del prototipo.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * QUÉ ES DEL CLIENTE Y QUÉ ES DE LA EMPRESA
 *
 * Un cliente con su propia subcuenta de GoHighLevel trae SUS contactos con SU token: el de la empresa no ve otra
 * subcuenta. Acá se carga lo suyo —el token y el calendario del CRM, el dominio de reservas, el usuario de su agente,
 * su Meta— y se genera el secreto de su aviso. La llave de IA, tl;dv y los pagos son de la empresa.
 *
 * El cliente principal NO tiene conexión propia: es la de la empresa, en Ajustes › Credenciales. Acá se dice y no se
 * ofrece ningún campo, para que no haya dos lugares donde cargar lo mismo (la ruta responde 409). La subcuenta la
 * vincula ARIA: se muestra, no se edita.
 *
 * Mismas reglas que `Credenciales.jsx`: de un secreto sólo el estado y la vista previa que calcula el servidor; la
 * cadena vacía no borra (borrar es `null`, con su botón); y una recarga con datos ya dibujados NO vuelve a «Leyendo…»,
 * porque eso desmontaría `AvisoDelCrm` y perdería la cabecera recién generada, que no se vuelve a mostrar.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';
import AvisoDelCrm from './AvisoDelCrm.jsx';

/** Lo que se carga de un cliente. `estado` = secreto (se ve su estado); `valor` = identificador (se ve entero). */
const CAMPOS = [
  { entrada: 'crmToken', titulo: 'Token de GoHighLevel', estado: 'crm' },
  { entrada: 'crmCalendarioId', titulo: 'Calendario de agendamiento', valor: 'crmCalendarioId' },
  { entrada: 'crmDominioReservas', titulo: 'Dominio de reservas', valor: 'crmDominioReservas' },
  { entrada: 'crmAgenteUsuarioId', titulo: 'Usuario del agente de IA en el CRM', valor: 'crmAgenteUsuarioId' },
  { entrada: 'metaToken', titulo: 'Token de Meta', estado: 'meta' },
  { entrada: 'metaCuentaId', titulo: 'Cuenta publicitaria de Meta', valor: 'metaCuentaId' },
];

const MOTIVOS = {
  sin_permiso: 'Tu usuario no puede ver ni cambiar la conexión de los clientes.',
  no_encontrado: 'Ese cliente ya no existe, o no es de esta empresa.',
};

function porQue(r) {
  if (r.tipo === 'sin_respuesta') return 'No llegó al servidor. No se guardó nada.';
  return r.detalle ?? MOTIVOS[r.codigo] ?? `Rechazado (${r.estado}).`;
}

export default function ConexionDelCliente({ cliente }) {
  const ruta = `/api/admin/cuentas/${cliente.id}/conexion`;
  const [datos, setDatos] = useState(null);
  const [causa, setCausa] = useState(null);
  const [borradores, setBorradores] = useState({});
  const [guardando, setGuardando] = useState(null);
  const [avisos, setAvisos] = useState({});
  const yaHayDatos = useRef(false);

  const cargar = useCallback(async () => {
    if (!yaHayDatos.current) setCausa(null);
    const r = await pedir(ruta);
    if (r.tipo !== 'datos') {
      setCausa(porQue(r));
      return;
    }
    setDatos(r.datos);
    yaHayDatos.current = true;
  }, [ruta]);

  // Un componente por cliente: quien lo monta le pone `key={cliente.id}`, así que cambiar de cliente empieza de cero.
  useEffect(() => {
    if (cliente.esPorOmision) return;
    void cargar();
  }, [cliente.esPorOmision, cargar]);

  const guardar = useCallback(
    async (campo, valor) => {
      setGuardando(campo.entrada);
      setAvisos((a) => ({ ...a, [campo.entrada]: null }));
      const r = await pedir(ruta, { metodo: 'PUT', cuerpo: { [campo.entrada]: valor } });
      setGuardando(null);
      if (r.tipo !== 'datos') {
        setAvisos((a) => ({ ...a, [campo.entrada]: { mal: true, texto: porQue(r) } }));
        return;
      }
      // El estado RESUELTO que devuelve el servidor, no un «ok»: lo que quedó, no lo que se mandó.
      setDatos(r.datos);
      setBorradores((b) => ({ ...b, [campo.entrada]: '' }));
      setAvisos((a) => ({ ...a, [campo.entrada]: { mal: false, texto: valor === null ? 'Borrado.' : 'Guardado.' } }));
    },
    [ruta],
  );

  if (cliente.esPorOmision) {
    return (
      <div className="aj-bloque">
        <div className="dw-sec-t">Conexión</div>
        <p className="aj-ayuda">
          El cliente principal usa la conexión de la empresa: su token de GoHighLevel, su Meta y su aviso se cargan en
          <b> Ajustes › Credenciales</b>.
        </p>
      </div>
    );
  }

  if (!datos) {
    return (
      <div className="aj-bloque">
        <div className="dw-sec-t">Conexión</div>
        {causa ? (
          <div className="fd-aviso mal" role="status">
            <i>⚠</i>
            <span>{causa}</span>
          </div>
        ) : (
          <p className="aj-ayuda">Leyendo la conexión…</p>
        )}
      </div>
    );
  }

  function fila(campo) {
    const secreto = Boolean(campo.estado);
    const estado = secreto ? datos[campo.estado] : null;
    const publico = secreto ? null : (datos[campo.valor] ?? null);
    const cargado = secreto ? Boolean(estado?.cargado) : publico !== null;
    const borrador = borradores[campo.entrada] ?? '';
    const ocupado = guardando === campo.entrada;
    const aviso = avisos[campo.entrada];
    const id = `con-${campo.entrada}`;
    return (
      <div className="fd-campo" key={campo.entrada}>
        <label htmlFor={id}>
          {campo.titulo}{' '}
          <span className={`chip ${cargado ? (estado && estado.estado !== 'activa' ? 'crit' : 'ok') : 'warn'}`}>
            {cargado ? (secreto ? (estado?.vistaPrevia ?? '••••') : 'Cargado') : 'Falta cargar'}
          </span>
        </label>
        {publico ? <div className="aj-valor">{publico}</div> : null}
        {estado?.texto ? <div className="aj-ayuda">{estado.texto}</div> : null}
        <div className="aj-fila">
          <div className="fd-campo">
            <input
              id={id}
              type={secreto ? 'password' : 'text'}
              value={borrador}
              autoComplete="off"
              spellCheck={false}
              placeholder={cargado ? 'Pega el valor nuevo para reemplazarlo' : 'Pega el valor'}
              onChange={(e) => setBorradores((b) => ({ ...b, [campo.entrada]: e.target.value }))}
            />
          </div>
          <button
            type="button"
            className="fd-btn"
            disabled={ocupado || borrador.trim().length === 0}
            onClick={() => void guardar(campo, borrador.trim())}
          >
            {ocupado ? 'Guardando…' : cargado ? 'Reemplazar' : 'Guardar'}
          </button>
          {cargado ? (
            <button type="button" className="fd-btn sec aj-peligro" disabled={ocupado} onClick={() => void guardar(campo, null)}>
              Borrar
            </button>
          ) : null}
        </div>
        {aviso ? (
          <div className={`fd-aviso ${aviso.mal ? 'mal' : 'bien'}`} role="status">
            <i>{aviso.mal ? '⚠' : '✓'}</i>
            <span>{aviso.texto}</span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="aj-bloque">
      <div className="dw-sec-t">Conexión</div>
      <p className="aj-ayuda">
        Lo propio de este cliente: su GoHighLevel y su Meta. La llave de IA, tl;dv y los pagos son de la empresa.
      </p>
      <div className="aj-ayuda">
        Subcuenta de GoHighLevel: <b>{datos.crmCuentaId ?? 'sin vincular'}</b>. La vincula ARIA.
      </div>
      {causa ? (
        <div className="fd-aviso mal" role="status">
          <i>⚠</i>
          <span>{causa}</span>
        </div>
      ) : null}
      {CAMPOS.map(fila)}
      <AvisoDelCrm ruta={ruta} configurado={datos.avisoSecretoConfigurado === true} alGenerar={() => void cargar()} />
    </div>
  );
}
