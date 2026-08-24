'use client';

/* Ajustes — la configuración de la empresa. NO viene del prototipo.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * POR QUÉ ESTA PANTALLA EXISTE
 *
 * Se pidió así: *"cada empresa tenga sus 'ajustes' donde pueda validar sus propios
 * credenciales, un campo para guardar el apikey de antropic solo para su empresa, uno para
 * conectar su cuenta de ghl y así sucesivamente"*.
 *
 * Y era necesaria además de pedida. La tabla `identidad.organizaciones_credenciales` tenía
 * `ia_clave_cifrada` desde la migración 006 y **nada la escribía**, así que la pantalla `icp`
 * respondía `sin_llave_de_ia` para siempre. El arreglo que se ve fácil desde lejos es una
 * `ANTHROPIC_API_KEY` global en Vercel — y es exactamente la fuga que
 * `lib/credenciales/resolver.ts` documenta en su encabezado: el consumo de todas las
 * organizaciones facturado a una, sin que nada falle, porque la API responde 200 y el
 * documento sale bien.
 *
 * ── LO QUE ESTA PANTALLA NUNCA HACE ────────────────────────────────────────
 *
 * **No recibe ni muestra un secreto.** El servidor devuelve `vistaPrevia` —los últimos cuatro
 * caracteres— y nunca el valor. Un campo que muestre el token completo para "confirmar" lo
 * pone en el DOM, en las herramientas de desarrollo y en cualquier captura de pantalla de
 * soporte. Los campos de carga arrancan vacíos siempre, incluso con credencial cargada: lo que
 * se ve al lado es el estado, no el valor.
 *
 * ── Y POR QUÉ CADA CAMPO SE GUARDA SOLO ────────────────────────────────────
 *
 * Un botón «Guardar todo» tendría que mandar los tres secretos en cada envío, y los dos que no
 * se tocaron irían vacíos. Con la ruta anterior eso los BORRABA. La ruta ahora solo escribe
 * los campos presentes en el cuerpo, y esta pantalla manda exactamente uno por envío — así las
 * dos mitades dicen lo mismo y no hay forma de borrar algo sin pedirlo.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';

/* Los campos, en el orden en que se muestran.
 *
 * `secreto: true` → nunca se recibe su valor; se ve el estado y una vista previa.
 * `secreto: false` → identificador de una cuenta ajena, se recibe y se muestra completo. */
const CAMPOS = [
  {
    entrada: 'crmToken',
    estado: 'crm',
    titulo: 'Token de GoHighLevel',
    ayuda: 'Private Integration Token de tu subcuenta. Settings → Private Integrations.',
    secreto: true,
  },
  {
    entrada: 'crmCuentaId',
    valor: 'crmCuentaId',
    titulo: 'Location ID de GoHighLevel',
    ayuda: 'El identificador de tu subcuenta. No es un secreto: se muestra completo.',
    secreto: false,
  },
  {
    entrada: 'iaClave',
    estado: 'ia',
    titulo: 'Clave de API de Anthropic',
    ayuda: 'La de tu empresa. El consumo de tokens se factura a esta clave, no a otra.',
    secreto: true,
  },
  {
    entrada: 'fundacionesClienteId',
    valor: 'fundacionesClienteId',
    titulo: 'Alumno de Fundaciones',
    ayuda: 'A qué alumno del hub corresponde esta organización. Sin esto, ICP & Oferta no abre.',
    secreto: false,
  },
  {
    entrada: 'pagosClave',
    estado: 'pagos',
    titulo: 'Clave de la pasarela de pagos',
    ayuda: 'Opcional. Todavía no hay ninguna operación que la use.',
    secreto: true,
  },
  {
    entrada: 'pagosComercioId',
    valor: 'pagosComercioId',
    titulo: 'ID de comercio de la pasarela',
    ayuda: 'Opcional, y no es un secreto.',
    secreto: false,
  },
];

/* El texto de cada motivo de rechazo del servidor.
 *
 * Uno por motivo y ninguno genérico: un «no se pudo guardar» hace que quien lo ve pruebe otra
 * vez con lo mismo. Un motivo que llegue sin texto se muestra CRUDO en vez de colapsarse a un
 * mensaje amable — así un motivo nuevo se nota en vez de esconderse. */
const MOTIVOS = {
  sin_permiso: 'Tu usuario no puede ver ni cambiar los ajustes de esta organización.',
  organizacion_inactiva: 'Esta organización está desactivada.',
  // `peticion_invalida` NO tiene texto acá a propósito: el servidor manda un `detalle` que dice
  // exactamente qué campo y por qué, y es más preciso que cualquier frase genérica que se
  // pudiera poner. Un texto acá lo taparía — el `?? r.detalle` de abajo lo prefiere.
};

export default function AjustesView({ activa }) {
  const [datos, setDatos] = useState(null);
  const [situacion, setSituacion] = useState('cargando');
  const [causa, setCausa] = useState(null);
  const [borradores, setBorradores] = useState({});
  const [guardando, setGuardando] = useState(null);
  /* El resultado del último guardado, POR CAMPO. Uno global haría que guardar el token de GHL
     mostrara «guardado» al lado de la clave de Anthropic. */
  const [avisos, setAvisos] = useState({});
  const yaPedido = useRef(false);

  const cargar = useCallback(async () => {
    setSituacion('cargando');
    const r = await pedir('/api/admin/credenciales');
    /* Las tres ramas separadas, sin colapsar. Un rechazo por permiso NO es «no hay datos»
       (`ADR-0305`): con una sola rama, alguien sin `credenciales.ver` vería la pantalla vacía y
       creería que su empresa no tiene nada configurado. */
    if (r.tipo === 'sin_respuesta') {
      setCausa('No se pudo contactar al servidor.');
      setSituacion('sin_respuesta');
      return;
    }
    if (r.tipo === 'rechazado') {
      setCausa(r.detalle ?? MOTIVOS[r.codigo] ?? `El servidor respondió ${r.estado}.`);
      setSituacion('rechazado');
      return;
    }
    setDatos(r.datos);
    setSituacion('listo');
  }, []);

  useEffect(() => {
    if (yaPedido.current) return;
    yaPedido.current = true;
    void cargar();
  }, [cargar]);

  /* Guarda UN campo. `valor === null` borra. */
  const guardar = useCallback(async (campo, valor) => {
    setGuardando(campo.entrada);
    setAvisos((a) => ({ ...a, [campo.entrada]: null }));

    const r = await pedir('/api/admin/credenciales', {
      metodo: 'PUT',
      cuerpo: { [campo.entrada]: valor },
    });

    setGuardando(null);
    if (r.tipo === 'sin_respuesta') {
      setAvisos((a) => ({ ...a, [campo.entrada]: { mal: true, texto: 'No llegó al servidor. No se guardó nada.' } }));
      return;
    }
    if (r.tipo === 'rechazado') {
      /* El `detalle` del servidor va PRIMERO. Es el que dice qué campo y por qué; un texto
         local genérico lo taparía y quien lo lee volvería a probar con lo mismo. */
      setAvisos((a) => ({
        ...a,
        [campo.entrada]: {
          mal: true,
          texto: r.detalle ?? MOTIVOS[r.codigo] ?? `Rechazado (${r.estado}).`,
        },
      }));
      return;
    }
    /* El servidor devuelve el estado RESUELTO, no un «ok». Se pisa el estado local con eso:
       mostrar «guardado» sin haber leído lo que quedó es reportar un éxito sin verificarlo. */
    setDatos(r.datos);
    setBorradores((b) => ({ ...b, [campo.entrada]: '' }));
    setAvisos((a) => ({
      ...a,
      [campo.entrada]: { mal: false, texto: valor === null ? 'Borrado.' : 'Guardado.' },
    }));
  }, []);

  const cuerpo = () => {
    if (situacion === 'cargando') return <p className="cre-desc">Cargando los ajustes…</p>;

    if (situacion === 'sin_respuesta' || situacion === 'rechazado') {
      return (
        <div className="stack">
          <p className="cre-desc">{causa}</p>
          {situacion === 'sin_respuesta' ? (
            <button type="button" onClick={() => void cargar()}>
              Reintentar
            </button>
          ) : null}
        </div>
      );
    }

    return (
      <div className="stack">
        {/* La organización, dicha en voz alta. Estos ajustes son de UNA empresa, y quien
            administra varias tiene que ver de cuál está tocando los secretos antes de tocarlos
            — es el mismo motivo del cartel permanente del `03` § 3. */}
        <p className="cre-desc">
          Ajustes de <strong>{datos?.orgId ? 'esta organización' : '—'}</strong>. Cada empresa
          usa sus propias credenciales: nunca se toma la de otra ni la de una variable global.
        </p>

        {CAMPOS.map((campo) => {
          const estado = campo.secreto ? datos?.[campo.estado] : null;
          const valorPublico = campo.secreto ? null : (datos?.[campo.valor] ?? null);
          const cargado = campo.secreto ? Boolean(estado?.cargado) : valorPublico !== null;
          const aviso = avisos[campo.entrada];
          const borrador = borradores[campo.entrada] ?? '';
          const ocupado = guardando === campo.entrada;

          return (
            <div className="stack" key={campo.entrada}>
              <div className="ch-title">
                <h3>{campo.titulo}</h3>
                <span className="cre-desc">{campo.ayuda}</span>
              </div>

              {/* El ESTADO, que es lo único que se muestra de un secreto. Los cuatro estados
                  con su texto vienen del servidor: repetirlos acá los haría divergir. */}
              <p className="cre-desc">
                {campo.secreto ? (
                  cargado ? (
                    <>
                      Cargada{estado?.vistaPrevia ? ` · ${estado.vistaPrevia}` : ''}
                      {estado?.texto ? ` · ${estado.texto}` : ''}
                    </>
                  ) : (
                    (estado?.texto ?? 'Falta cargarla')
                  )
                ) : cargado ? (
                  <code>{valorPublico}</code>
                ) : (
                  'Sin configurar'
                )}
              </p>

              <input
                type={campo.secreto ? 'password' : 'text'}
                value={borrador}
                autoComplete="off"
                spellCheck={false}
                placeholder={cargado ? 'Pegá el valor nuevo para reemplazarlo' : 'Pegá el valor'}
                onChange={(e) =>
                  setBorradores((b) => ({ ...b, [campo.entrada]: e.target.value }))
                }
              />

              <div className="stack">
                <button
                  type="button"
                  disabled={ocupado || borrador.trim().length === 0}
                  onClick={() => void guardar(campo, borrador.trim())}
                >
                  {ocupado ? 'Guardando…' : cargado ? 'Reemplazar' : 'Guardar'}
                </button>
                {/* Borrar manda `null` explícito, que es la única forma de borrar en la ruta.
                    Solo aparece si hay algo que borrar. */}
                {cargado ? (
                  <button type="button" disabled={ocupado} onClick={() => void guardar(campo, null)}>
                    Borrar
                  </button>
                ) : null}
              </div>

              {aviso ? (
                <p className="cre-desc" role="status">
                  {aviso.mal ? '⚠ ' : '✓ '}
                  {aviso.texto}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
    <section className={activa ? 'view on' : 'view'} id="v-credenciales">
      <div className="view-scroll cre-scroll">
        <div className="cre-head">
          <div className="ch-l stack">
            <div className="ch-title">
              <h2>
                Ajustes
              </h2>
              <span className="cre-desc">
                Las credenciales y las cuentas externas de esta empresa
              </span>
            </div>
          </div>
        </div>
        {cuerpo()}
      </div>
    </section>
    </>
  );
}
