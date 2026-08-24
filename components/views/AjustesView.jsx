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
 * organizaciones facturado a una, sin que nada falle.
 *
 * ── LO QUE ESTA PANTALLA NUNCA HACE ────────────────────────────────────────
 *
 * **No recibe ni muestra un secreto.** El servidor devuelve `vistaPrevia` —los últimos cuatro
 * caracteres— y nunca el valor. Un campo que muestre el token completo para "confirmar" lo
 * pone en el DOM, en las herramientas de desarrollo y en cualquier captura de pantalla de
 * soporte. Los campos de carga arrancan vacíos siempre, incluso con credencial cargada.
 *
 * ── Y POR QUÉ CADA CAMPO SE GUARDA SOLO ────────────────────────────────────
 *
 * Un botón «Guardar todo» tendría que mandar los tres secretos en cada envío, y los dos que no
 * se tocaron irían vacíos. Con la ruta anterior eso los BORRABA. La ruta ahora solo escribe
 * los campos presentes en el cuerpo, y esta pantalla manda exactamente uno por envío.
 *
 * ── LOS ESTILOS: SE REUSA, NO SE INVENTA ───────────────────────────────────
 *
 * Todo lo visual sale de clases que ya existen. `.card` / `.card-head` / `.card-body` es la
 * tarjeta canónica del prototipo; `.fd-campo` / `.fd-btn` / `.fd-aviso` es el formulario que
 * la Etapa 9 tuvo que inventar porque el prototipo era un tablero de LECTURA; `.chip` con
 * `.ok` / `.warn` / `.crit` es la píldora de estado del diseño original.
 *
 * La primera versión de este archivo inventó un tercer juego de clases para lo mismo, y además
 * usó dos que no existen fuera de su padre —`.cre-desc` solo pinta dentro de `.cre-head`, y
 * `.stack` solo existe como `.ch-l.stack`—, así que se veía sin estilo. Las dos trampas están
 * anotadas en `app/ajustes.css`.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';

/* Los campos, en el orden en que se muestran: primero lo que hace falta para que las pestañas
 * Closer y Setter traigan datos, después lo de Fundaciones, y al final lo opcional.
 *
 * `secreto: true` → nunca se recibe su valor; se ve el estado y una vista previa.
 * `secreto: false` → identificador de una cuenta ajena, se recibe y se muestra completo. */
const CAMPOS = [
  {
    entrada: 'crmToken',
    estado: 'crm',
    titulo: 'Token de GoHighLevel',
    ayuda: 'El Private Integration Token de tu subcuenta. En GHL: Settings → Private Integrations.',
    secreto: true,
  },
  {
    entrada: 'crmCuentaId',
    valor: 'crmCuentaId',
    titulo: 'Location ID de GoHighLevel',
    ayuda: 'El identificador de tu subcuenta. No es un secreto, así que se muestra entero.',
    secreto: false,
  },
  {
    entrada: 'iaClave',
    estado: 'ia',
    titulo: 'Clave de API de Anthropic',
    ayuda: 'La de tu empresa. El consumo de tokens se factura a esta clave y a ninguna otra.',
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
    ayuda: 'Opcional, y tampoco es un secreto.',
    secreto: false,
  },
];

/* El texto de los rechazos que esta pantalla sabe nombrar.
 *
 * `peticion_invalida` NO está acá a propósito: el servidor manda un `detalle` que dice qué
 * campo y por qué, y es más preciso que cualquier frase genérica. El código prefiere el
 * detalle, así que un texto acá lo taparía. */
const MOTIVOS = {
  sin_permiso: 'Tu usuario no puede ver ni cambiar los ajustes de esta organización.',
  organizacion_inactiva: 'Esta organización está desactivada.',
};

/* La píldora de estado, con la clase del diseño original.
 *
 * Los cuatro estados y su texto viven en `lib/credenciales/resolver.ts`; acá solo se traduce
 * a color. Repetir los textos haría que las dos mitades divergieran. */
function pinta(estado, cargado) {
  if (!cargado) return { chip: 'warn', etiqueta: 'Falta cargar' };
  if (estado === 'ilegible') return { chip: 'crit', etiqueta: 'Ilegible' };
  if (estado === 'vencida') return { chip: 'crit', etiqueta: 'Vencida' };
  if (estado === 'revocada') return { chip: 'crit', etiqueta: 'Revocada' };
  return { chip: 'ok', etiqueta: 'Cargada' };
}

export default function AjustesView({ activa }) {
  const [datos, setDatos] = useState(null);
  const [situacion, setSituacion] = useState('cargando');
  const [causa, setCausa] = useState(null);
  const [codigo, setCodigo] = useState(null);
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
       (`ADR-0305`): con una sola rama, alguien sin `credenciales.ver` vería la pantalla vacía
       y creería que su empresa no tiene nada configurado. */
    if (r.tipo === 'sin_respuesta') {
      setCausa('No se pudo contactar al servidor. No es tu configuración: no llegó la pregunta.');
      setCodigo(null);
      setSituacion('sin_respuesta');
      return;
    }
    if (r.tipo === 'rechazado') {
      setCausa(r.detalle ?? MOTIVOS[r.codigo] ?? `El servidor respondió ${r.estado}.`);
      setCodigo(r.codigo);
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
      setAvisos((a) => ({
        ...a,
        [campo.entrada]: { mal: true, texto: 'No llegó al servidor. No se guardó nada.' },
      }));
      return;
    }
    if (r.tipo === 'rechazado') {
      /* El `detalle` del servidor va PRIMERO: es el que dice qué campo y por qué. Un texto
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

  function tarjeta(campo) {
    const estado = campo.secreto ? datos?.[campo.estado] : null;
    const valorPublico = campo.secreto ? null : (datos?.[campo.valor] ?? null);
    const cargado = campo.secreto ? Boolean(estado?.cargado) : valorPublico !== null;
    const vista = pinta(estado?.estado, cargado);
    const aviso = avisos[campo.entrada];
    const borrador = borradores[campo.entrada] ?? '';
    const ocupado = guardando === campo.entrada;

    return (
      <div className="card" key={campo.entrada}>
        <div className="card-head">
          {campo.titulo}
          <span className="hint">
            <span className={`chip ${vista.chip}`}>{vista.etiqueta}</span>
          </span>
        </div>
        <div className="card-body aj-cuerpo">
          <div className="aj-ayuda">{campo.ayuda}</div>

          {/* EL VALOR. De un secreto solo la vista previa que calculó el servidor; de un
              identificador público, entero. No hay camino por el que el valor de un secreto
              llegue acá. */}
          <div className={`aj-valor${cargado ? '' : ' vacio'}`}>
            {cargado
              ? campo.secreto
                ? (estado?.vistaPrevia ?? '••••')
                : valorPublico
              : 'Sin configurar'}
          </div>

          {/* El texto del estado, cuando hay algo que decir. `activa` no dice nada —no hay
              nada que decir— y ahí el servidor manda `texto: null`. */}
          {estado?.texto ? <div className="aj-ayuda">{estado.texto}</div> : null}

          <div className="aj-fila">
            <div className="fd-campo">
              <input
                type={campo.secreto ? 'password' : 'text'}
                value={borrador}
                autoComplete="off"
                spellCheck={false}
                placeholder={cargado ? 'Pegá el valor nuevo para reemplazarlo' : 'Pegá el valor'}
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
            {/* Borrar manda `null` explícito, que es la única forma de borrar en la ruta. Solo
                aparece si hay algo que borrar: un botón que no puede hacer nada es peor que la
                ausencia del botón. */}
            {cargado ? (
              <button
                type="button"
                className="fd-btn sec aj-peligro"
                disabled={ocupado}
                onClick={() => void guardar(campo, null)}
              >
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
      </div>
    );
  }

  function cuerpo() {
    if (situacion === 'cargando') {
      return (
        <div className="fd-aviso">
          <i>◍</i>
          <span>Cargando los ajustes…</span>
        </div>
      );
    }

    if (situacion === 'sin_respuesta') {
      return (
        <div className="aj-fila">
          <div className="fd-aviso mal">
            <i>◍</i>
            <span>{causa}</span>
          </div>
          <button type="button" className="fd-btn sec" onClick={() => void cargar()}>
            Reintentar
          </button>
        </div>
      );
    }

    if (situacion === 'rechazado') {
      /* Un rechazo por PERMISO se dibuja distinto de un error, y no ofrece «Reintentar»:
         reintentar no cambia qué capacidades tiene tu usuario, y un botón que no puede
         funcionar hace que la gente lo apriete tres veces antes de pedir ayuda. */
      const sinPermiso = codigo === 'sin_permiso' || codigo === 'organizacion_inactiva';
      return (
        <div className={`fd-aviso ${sinPermiso ? 'falta' : 'mal'}`}>
          <i>◍</i>
          <span>{causa}</span>
        </div>
      );
    }

    return (
      <>
        <p className="aj-intro">
          Estas credenciales son <b>solo de esta organización</b>. Cada empresa usa las suyas:
          nunca se toma la de otra, ni una global del servidor. Sin la credencial que
          corresponde, la parte que la necesita no funciona y lo dice.
        </p>
        <div className="fd-rejilla dos">{CAMPOS.map(tarjeta)}</div>
      </>
    );
  }

  return (
    <>
    <section className={activa ? 'view on' : 'view'} id="v-credenciales">
      <div className="view-scroll cre-scroll">
        <div className="cre-head">
          <div className="ch-l">
            <h2>
              Ajustes
            </h2>
            <span className="cre-desc">
              Las credenciales y las cuentas externas de esta empresa
            </span>
          </div>
        </div>
        {cuerpo()}
      </div>
    </section>
    </>
  );
}
