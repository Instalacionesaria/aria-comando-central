'use client';

/* Ajustes › Clientes — los clientes de la empresa (el nivel 3). NO viene del prototipo.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * QUÉ ES UN CLIENTE, Y QUÉ SE HACE ACÁ
 *
 * Un cliente es una cuenta de la empresa: una subcuenta del CRM, un negocio (una clínica, una inmobiliaria). La
 * empresa lo da de alta, le pone su nicho, su país y su zona, y lo pausa o lo da de baja. El primero —el «principal»—
 * nació con la empresa y recibe lo que entra con sus credenciales: no se pausa ni se da de baja.
 *
 * Vincular un cliente con su subcuenta del CRM, o marcarlo de prueba, lo hace sólo ARIA (`puedeVincularClientes`): la
 * subcuenta es única en toda la plataforma, y la marca de prueba saca al cliente de las comparaciones.
 *
 * Los botones salen de lo que el servidor responde en la sesión (`puedeCrearClientes`, `puedeEditarClientes`), con la
 * capacidad exacta de cada operación: un botón que va a recibir 403 no se ofrece.
 *
 * Cada fila dice si el cliente está configurado y, abierta, qué le falta y qué hacer (`ListaDeChequeo`, C6 · D5): el
 * dato es el de ahora, no el de la foto del día. Al cerrar la ventana de un cliente la lista se relee, para que lo que se
 * cargó en su Conexión se vea en verde.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';
import { usarLectura } from '../../lib/usarLectura.ts';
import Ventana from '../Ventana.jsx';
import AvisoDesactualizado from '../negocio/AvisoDesactualizado.jsx';
import FormularioDeCliente, { cuerpoDe, valoresDe } from './FormularioDeCliente.jsx';
import ConexionDelCliente from './ConexionDelCliente.jsx';
import ListaDeChequeo, { ResumenDeLaLista } from './ListaDeChequeo.jsx';

const MOTIVOS = {
  sin_permiso: 'Tu usuario no puede hacer esto con los clientes.',
  no_encontrado: 'Ese cliente ya no existe, o no es de esta empresa.',
  subcuenta_en_uso: 'Esa subcuenta de GoHighLevel ya es de otro cliente.',
  cliente_principal: 'La subcuenta del cliente principal es la de la empresa: se carga en Ajustes › Credenciales.',
};

const ESTADOS = { activa: 'Activo', pausada: 'Pausado', baja: 'De baja' };

/** «Ana», «Ana y Luis», «Ana, Luis y Eva». */
const enLista = (nombres) =>
  nombres.length <= 1 ? (nombres[0] ?? '') : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;

/* Los closers vinculados en otros clientes y no en éste (el nivel 3): no ven sus contactos hasta que alguien los vincule
   aquí. Lo dice el servidor, sólo a quien ve la pantalla del vínculo. `null` sin nadie. Lo usa también el alta desde
   Negocios (`components/cartera/PanelDeNegocios.jsx`): el mismo texto en las dos. */
export function closersSinVincular(nombres, cliente) {
  if (!nombres?.length) return null;
  const uno = nombres.length === 1;
  return (
    `${enLista(nombres)} ${uno ? 'es closer' : 'son closers'} en otros clientes y no ${uno ? 'está vinculado' : 'están vinculados'} ` +
    `en éste: no ${uno ? 've' : 'ven'} sus contactos. ${uno ? 'Vincúlalo' : 'Vincúlalos'} en Closer › Inicio › Closers eligiendo ` +
    `«${cliente}», cuando tenga su conexión con GoHighLevel.`
  );
}

/** El texto de un rechazo, con el detalle del servidor si lo trae. */
function porQue(r) {
  if (r.tipo === 'sin_respuesta') return 'No llegó al servidor. No se cambió nada.';
  if (r.tipo === 'rechazado') return r.detalle ?? MOTIVOS[r.codigo] ?? `Rechazado (${r.estado}).`;
  return 'No se pudo.';
}

/* `conConexion`: si la persona ve Ajustes › Credenciales. La conexión de un cliente pide las mismas capacidades que
   la de la empresa, así que quien no ve una no ve la otra. */
export default function Clientes({ sesion, conConexion = false }) {
  const { datos, situacion, causa, refrescar } = usarLectura('/api/admin/cuentas', {
    sinRespuesta: 'No se pudo contactar al servidor.',
    motivos: MOTIVOS,
  });
  const lista = datos?.clientes ?? null;
  const catalogo = datos?.catalogo ?? null;
  const [aviso, setAviso] = useState(null);
  const [alta, setAlta] = useState(null);
  const [editando, setEditando] = useState(null);
  const [valores, setValores] = useState(valoresDe(null));
  const [vinculo, setVinculo] = useState({ crmCuentaId: '', esPrueba: false });
  const [ocupado, setOcupado] = useState(false);
  /* La Conexión del cliente: cuántas veces hay que releerla (sube al vincular la subcuenta) y si tiene una cabecera
     del aviso a la vista. Esa cabecera no se vuelve a mostrar: mientras está, la ventana no se cierra con Escape ni
     con el fondo, y guardar no la cierra. */
  const [relectura, setRelectura] = useState(0);
  const [cabeceraVisible, setCabeceraVisible] = useState(false);
  // Los clientes con su lista de chequeo abierta.
  const [abiertas, setAbiertas] = useState(() => new Set());
  const conmutar = (id) =>
    setAbiertas((antes) => {
      const ahora = new Set(antes);
      if (ahora.has(id)) ahora.delete(id);
      else ahora.add(id);
      return ahora;
    });

  const nombreDelNicho = (clave) => catalogo?.nichos.find((n) => n.clave === clave)?.nombre ?? clave;

  const guardar = useCallback(async () => {
    setOcupado(true);
    setAviso(null);
    const r = editando
      ? await pedir(`/api/admin/cuentas/${editando.id}`, { metodo: 'PATCH', cuerpo: cuerpoDe(valores) })
      : await pedir('/api/admin/cuentas', { metodo: 'POST', cuerpo: cuerpoDe(valores) });
    setOcupado(false);
    if (r.tipo !== 'datos') {
      setAviso({ mal: true, texto: porQue(r) });
      return;
    }
    const listo = editando ? 'Cliente guardado.' : `«${valores.nombre.trim()}» agregado.`;
    const sin = editando ? null : closersSinVincular(r.datos.closersSinVincular, valores.nombre.trim());
    setAviso({ mal: false, texto: sin ? `${listo} ${sin}` : listo });
    if (!cabeceraVisible) {
      setAlta(null);
      setEditando(null);
    }
    await refrescar();
  }, [editando, valores, refrescar, cabeceraVisible]);

  const cambiarEstado = useCallback(
    async (cliente, estado) => {
      setAviso(null);
      const r = await pedir(`/api/admin/cuentas/${cliente.id}`, { metodo: 'PATCH', cuerpo: { estado } });
      const sin = r.tipo === 'datos' ? closersSinVincular(r.datos.closersSinVincular, cliente.nombre) : null;
      const listo = `«${cliente.nombre}»: ${ESTADOS[estado].toLowerCase()}.`;
      setAviso(r.tipo === 'datos' ? { mal: false, texto: sin ? `${listo} ${sin}` : listo } : { mal: true, texto: porQue(r) });
      await refrescar();
    },
    [refrescar],
  );

  const vincular = useCallback(async () => {
    setOcupado(true);
    setAviso(null);
    const r = await pedir(`/api/admin/cuentas/${editando.id}/vinculo`, {
      metodo: 'PATCH',
      // Vacío es «no la toques», no «desvincular»: un formulario que se guarda por la marca de prueba no puede borrar la
      // subcuenta de paso.
      cuerpo: vinculo.crmCuentaId.trim() === ''
        ? { esPrueba: vinculo.esPrueba }
        : { crmCuentaId: vinculo.crmCuentaId.trim(), esPrueba: vinculo.esPrueba },
    });
    setOcupado(false);
    // Al cambiar la subcuenta, el servidor recuerda revisar el puntaje y el Perfil elegidos para la anterior.
    const listo = r.tipo === 'datos' && r.datos.aviso ? `Vinculación guardada. ${r.datos.aviso}` : 'Vinculación guardada.';
    setAviso(r.tipo === 'datos' ? { mal: false, texto: listo } : { mal: true, texto: porQue(r) });
    if (r.tipo === 'datos') {
      setRelectura((n) => n + 1);
      await refrescar();
    }
  }, [editando, vinculo, refrescar]);

  if (lista === null) {
    return situacion === 'rechazado' || situacion === 'sin_respuesta' ? (
      <div className="fd-aviso mal" role="status">
        <i>⚠</i>
        <span>{causa ?? 'No se pudieron leer los clientes.'}</span>
      </div>
    ) : (
      <p className="aj-intro">Leyendo los clientes…</p>
    );
  }

  const elAviso = aviso ? (
    <div className={`fd-aviso ${aviso.mal ? 'mal' : 'bien'}`} role="status">
      <i>{aviso.mal ? '⚠' : '✓'}</i>
      <span>{aviso.texto}</span>
    </div>
  ) : null;
  const puedeGuardar = valores.nombre.trim().length > 0 && !ocupado;

  return (
    <>
      <AvisoDesactualizado causa={causa} alReintentar={refrescar} />
      <p className="aj-intro">
        Cada cliente es <b>un negocio de la empresa</b>, con su propia subcuenta de GoHighLevel. Con un cliente elegido
        arriba, Leads y Sales muestran sólo ese cliente.
      </p>
      {alta || editando ? null : elAviso}

      <div className="card">
        <div className="card-head">
          Clientes <span className="hint">{lista.length}</span>
          {sesion?.puedeCrearClientes ? (
            <button
              type="button"
              className="fd-btn aj-alta"
              onClick={() => {
                setAviso(null);
                setValores(valoresDe(null));
                setAlta(true);
              }}
            >
              Agregar cliente
            </button>
          ) : null}
        </div>
        <div className="rows">
          {lista.map((c) => (
            <div className="row-i" key={c.id} style={{ gridTemplateColumns: '1.6fr 1.2fr 1fr auto' }}>
              <div>
                <div className="rn">
                  {c.nombre}
                  {c.esPorOmision ? <span className="tagx ag aj-tag">Principal</span> : null}
                  {c.estado !== 'activa' ? <span className="tagx no aj-tag">{ESTADOS[c.estado]}</span> : null}
                  {c.esPrueba ? <span className="tagx seg aj-tag">De prueba</span> : null}
                </div>
                <div className="rs">
                  {c.pais ?? 'sin país'} · {c.zonaHoraria}
                </div>
                {/* Sólo en los activos, y sólo para quien ve el vínculo: lo decide el servidor. */}
                {c.closersSinVincular?.length ? <div className="rs">Closers sin vincular aquí: {enLista(c.closersSinVincular)}</div> : null}
              </div>
              <div>
                {/* El nicho sin confirmar se dice: no entra a las comparaciones entre negocios. */}
                {c.nicho ? (
                  <span>
                    {nombreDelNicho(c.nicho)}
                    {c.nichoConfirmado ? null : <span className="rs"> · sin confirmar</span>}
                  </span>
                ) : (
                  <span className="rs">sin nicho</span>
                )}
              </div>
              <div className="aj-estado">
                <span className={`chip ${c.crmVinculado ? 'ok' : 'warn'}`}>{c.crmVinculado ? 'Vinculado' : 'Sin vincular'}</span>
                <ResumenDeLaLista cliente={c} />
                {c.listaDeChequeo ? (
                  <button type="button" className="aj-ver" aria-expanded={abiertas.has(c.id)} onClick={() => conmutar(c.id)}>
                    {abiertas.has(c.id) ? 'Ocultar la lista' : 'Ver la lista'}
                  </button>
                ) : null}
              </div>
              <div className="num aj-acciones">
                {sesion?.puedeEditarClientes ? (
                  <>
                    <button
                      type="button"
                      className="fd-btn sec"
                      onClick={() => {
                        setAviso(null);
                        setValores(valoresDe(c));
                        setVinculo({ crmCuentaId: '', esPrueba: c.esPrueba });
                        setCabeceraVisible(false);
                        setEditando(c);
                      }}
                    >
                      Editar
                    </button>
                    {c.esPorOmision ? null : (
                      <button
                        type="button"
                        className="fd-btn sec"
                        onClick={() => void cambiarEstado(c, c.estado === 'activa' ? 'pausada' : 'activa')}
                      >
                        {c.estado === 'activa' ? 'Pausar' : 'Activar'}
                      </button>
                    )}
                  </>
                ) : null}
              </div>
              {abiertas.has(c.id) ? (
                <div className="aj-fila-entera">
                  <ListaDeChequeo cliente={c} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {alta || editando ? (
        <Ventana
          titulo={editando ? editando.nombre : 'Agregar un cliente'}
          subtitulo={
            editando?.esPorOmision
              ? 'Es el cliente principal de la empresa: recibe lo que entra con sus credenciales.'
              : 'Un negocio de la empresa, con su propia subcuenta de GoHighLevel.'
          }
          cerrablePorFuera={!cabeceraVisible}
          alCerrar={() => {
            setAlta(null);
            setEditando(null);
            setCabeceraVisible(false);
            // Lo que se cargó en su Conexión cambia su lista de chequeo: se relee al cerrar.
            void refrescar();
          }}
        >
          <FormularioDeCliente valores={valores} alCambiar={setValores} catalogo={catalogo} prefijo={editando ? 'ed-cli' : 'cli'} />
          {elAviso}
          <div className="aj-fila">
            <button type="button" className="fd-btn" disabled={!puedeGuardar} onClick={() => void guardar()}>
              {ocupado ? 'Guardando…' : editando ? 'Guardar' : 'Agregar cliente'}
            </button>
            {editando && !editando.esPorOmision && editando.estado !== 'baja' ? (
              <button type="button" className="fd-btn sec" disabled={ocupado} onClick={() => void cambiarEstado(editando, 'baja')}>
                Dar de baja
              </button>
            ) : null}
          </div>

          {/* Sólo ARIA: la subcuenta del CRM y la marca de prueba. La del cliente principal es la de la empresa y se
              carga en Ajustes › Credenciales: acá sólo la marca de prueba. */}
          {editando && sesion?.puedeVincularClientes ? (
            <div className="aj-bloque">
              {editando.esPorOmision ? null : (
                <div className="fd-campo">
                  <label htmlFor="ed-cli-subcuenta">Subcuenta de GoHighLevel</label>
                  <input
                    id="ed-cli-subcuenta"
                    type="text"
                    value={vinculo.crmCuentaId}
                    placeholder={editando.crmVinculado ? 'Vinculada: escribe otra para cambiarla' : 'El identificador de la location'}
                    onChange={(e) => setVinculo({ ...vinculo, crmCuentaId: e.target.value })}
                  />
                </div>
              )}
              <label className="aj-casilla">
                <input type="checkbox" checked={vinculo.esPrueba} onChange={(e) => setVinculo({ ...vinculo, esPrueba: e.target.checked })} />
                <span>Es un cliente de prueba: no entra a ninguna cifra agregada.</span>
              </label>
              <div className="aj-fila">
                <button type="button" className="fd-btn sec" disabled={ocupado} onClick={() => void vincular()}>
                  Guardar la vinculación
                </button>
              </div>
            </div>
          ) : null}

          {/* La conexión propia del cliente: su GoHighLevel, su Meta y su aviso. Una por cliente (`key`). */}
          {editando && conConexion ? (
            <ConexionDelCliente
              key={editando.id}
              cliente={editando}
              relectura={relectura}
              alMostrarCabecera={setCabeceraVisible}
            />
          ) : null}
        </Ventana>
      ) : null}
    </>
  );
}
