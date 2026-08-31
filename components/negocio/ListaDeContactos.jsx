'use client';

/* La lista de contactos de una pestaña. UN SOLO archivo para las dos.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * LO ÚNICO QUE CAMBIA ENTRE CLOSER Y SETTER ES EL `camino`
 *
 * Y el territorio NO viaja en un parámetro: cada pestaña tiene su propia ruta
 * (`/api/closer/contactos`, `/api/setter/contactos`) con el territorio escrito en el SERVIDOR.
 *
 * Si fuera `/api/contactos?territorio=…`, **el navegador elegiría el territorio**: un setter
 * pediría `territorio=closer` y lo recibiría, porque la capacidad que el portero comprobó
 * sería la misma para los dos. La separación quedaría dependiendo de que el cliente pida lo
 * que le corresponde. Está explicado en `app/api/setter/contactos/route.ts`.
 *
 * ── LAS TRES RAMAS, SIN COLAPSAR ────────────────────────────────────────────
 *
 * `ADR-0305`: un rechazo por permiso NO se muestra como "no hay datos". Son tres hechos
 * distintos y se dibujan distinto:
 *
 *   · no pude preguntar  → se puede reintentar, y se dice que no es culpa de los datos
 *   · no tenés permiso   → NO se ofrece reintentar: reintentar no cambia tus capacidades
 *   · no hay contactos   → el vacío legítimo, que dice POR QUÉ está vacío
 *
 * Colapsarlos es cómo un 403 termina viéndose como una bandeja de trabajo vacía — y una
 * bandeja vacía nadie la reporta.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';
import Fila from './Fila.jsx';
import Ficha from './Ficha.jsx';

const MOTIVOS = {
  sin_permiso: 'Tu usuario no tiene permiso para ver esta pestaña.',
  organizacion_inactiva: 'Esta organización está desactivada.',
  // Los cuatro de GoHighLevel NO tienen texto acá a propósito: el servidor manda un `detalle`
  // que dice cuál de los cinco faltantes es, o qué respondió GoHighLevel. Un texto genérico
  // local lo taparía, y esos cinco faltantes llevan a cinco acciones distintas.
};

export default function ListaDeContactos({ camino, zona, pulso = 0 }) {
  /* LA FICHA. `onAbrir` de `Fila.jsx` existia desde la Etapa 11, documentado, **y sin un solo
     llamador**: su comentario decia *"todavia no hay ficha -es el paso siguiente- asi que cuando no
     se pasa, la fila no es clicable"*. Este es ese paso.

     Se guarda el IDENTIFICADOR y no la fila entera: la ficha vuelve a pedir el contacto al abrirse
     -con eso refresca sus etiquetas contra el CRM- y quedarse con una copia de la fila haria que el
     encabezado mostrara el estado viejo al lado de los datos nuevos. */
  const [abierta, setAbierta] = useState(null);
  const [filas, setFilas] = useState(null);
  const [situacion, setSituacion] = useState('cargando');
  const [causa, setCausa] = useState(null);
  const [codigo, setCodigo] = useState(null);
  /* La página que ya se pidió, y si el servidor dijo que hay más.
     Sin esto la lista corta en 100 y **se ve completa**: medido contra la cuenta real, el
     closer tiene 123 contactos y la primera página trae 100. Una lista truncada que parece
     entera es el mismo defecto que un dato inventado — nadie reporta lo que no sabe que falta. */
  const [pagina, setPagina] = useState(0);
  const [hayMas, setHayMas] = useState(false);
  const [trayendoPagina, setTrayendoPagina] = useState(false);
  const [trayendo, setTrayendo] = useState(false);
  const [resultado, setResultado] = useState(null);
  const yaPedido = useRef(false);

  const cargar = useCallback(async () => {
    /* ══ UNA RECARGA NO ES UNA PRIMERA CARGA, Y CONFUNDIRLAS CIERRA LA FICHA ════
     *
     * Esta línea era `setSituacion('cargando')` a secas, y con una lista que solo se cargaba una
     * vez eso no se notaba. Con un reloj cada diez segundos se nota mucho: reemplaza el cuerpo
     * entero por el aviso de espera, y al desmontarse **se lleva puesta la ficha abierta**.
     *
     * No es una hipótesis. Es el mismo defecto que `components/views/CloserView.jsx` ya midió en el
     * navegador y resolvió con esta misma forma: *«con una ficha abierta, volver a la pestaña la
     * cerraba»*. Se copia la regla junto con el reloj, porque el reloj es lo que la vuelve constante.
     *
     * La regla, entonces: **la pantalla solo se vacía cuando no hay nada que mostrar.** Teniendo
     * datos, una recarga los reemplaza cuando llega la respuesta, y hasta entonces no se toca nada. */
    setSituacion((antes) => (antes === 'listo' ? antes : 'cargando'));
    const r = await pedir(camino);
    if (r.tipo === 'sin_respuesta') {
      setCausa('No se pudo contactar al servidor.');
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
    setFilas(r.datos.filas ?? []);
    setHayMas(Boolean(r.datos.hayMas));
    setPagina(0);
    setSituacion('listo');
  }, [camino]);

  /* Traer la página siguiente y AGREGARLA, no reemplazar. Quien está mirando la lista no
     pierde el lugar, que es lo que pasa cuando "ver más" repinta desde cero. */
  const masFilas = useCallback(async () => {
    setTrayendoPagina(true);
    const siguiente = pagina + 1;
    const r = await pedir(`${camino}?pagina=${siguiente}`);
    setTrayendoPagina(false);
    if (r.tipo !== 'datos') {
      /* No se toca la lista que ya está. Un fallo al pedir la página 2 no invalida la 1, y
         vaciarla haría desaparecer datos correctos por un problema de red. */
      setResultado({ mal: true, texto: 'No se pudo traer la página siguiente. Lo que ves sigue siendo correcto.' });
      return;
    }
    setFilas((antes) => [...antes, ...(r.datos.filas ?? [])]);
    setHayMas(Boolean(r.datos.hayMas));
    setPagina(siguiente);
  }, [camino, pagina]);

  useEffect(() => {
    if (yaPedido.current) return;
    yaPedido.current = true;
    void cargar();
  }, [cargar]);

  /* ── EL PULSO: cómo el reloj de la vista recarga esta lista ─────────────────
   *
   * Un contador que sube. Quien monta esta lista lo incrementa después de traer mensajes nuevos, y
   * acá se vuelve a preguntar. Es un número y no una función a propósito: una función nueva en cada
   * render del padre dispararía una recarga por render.
   *
   * El `pulso > 0` saltea el montaje — el valor inicial no es un pulso, y sin esta guarda la primera
   * carga saldría dos veces. */
  useEffect(() => {
    if (pulso > 0) void cargar();
  }, [pulso, cargar]);

  /* Traer de GoHighLevel. Es una operación APARTE de cargar la lista, y se ve aparte.
   *
   * Colapsarlas —traer siempre al abrir la pestaña— tendría dos problemas: abrir la pestaña
   * pasaría a depender de que GoHighLevel esté arriba, y cada apertura gastaría peticiones
   * contra un límite de tasa ajeno. La lista lee lo que YA está guardado; traer es explícito. */
  const traer = useCallback(async () => {
    setTrayendo(true);
    setResultado(null);
    const r = await pedir('/api/contactos/sincronizar', { metodo: 'POST' });
    setTrayendo(false);

    if (r.tipo === 'sin_respuesta') {
      setResultado({ mal: true, texto: 'No llegó al servidor. No se trajo nada.' });
      return;
    }
    if (r.tipo === 'rechazado') {
      setResultado({ mal: true, texto: r.detalle ?? MOTIVOS[r.codigo] ?? `Rechazado (${r.estado}).` });
      return;
    }

    /* EL RESULTADO EN CASTELLANO, NO EL DIAGNÓSTICO.
     *
     * Acá se armaba un resumen técnico que terminaba en el cliente: nombres de etiquetas del CRM,
     * el catálogo entero de su subcuenta, y hasta el permiso que le faltaba al token. Nada de eso
     * le dice a quien lo lee algo que pueda hacer — y lo que sí importaba se perdía entre la jerga.
     *
     * Lo que se conserva es lo único que cambia una decisión: **cuántos entraron**, y si la lista
     * pudo quedar corta. Un "listo" a secas sobre una traída incompleta es un éxito que no ocurrió.
     *
     * El detalle técnico sigue existiendo del lado del servidor, para la pantalla de estado de las
     * conexiones. Acá no. */
    const d = r.datos;
    const guardados = (d.guardados?.closer ?? 0) + (d.guardados?.setter ?? 0);
    const corta = Boolean(d.salteados?.length || d.truncado);

    let texto;
    if (guardados === 0) {
      texto = 'No entró ningún contacto. Revisá la conexión en Ajustes.';
    } else if (corta) {
      texto = `${guardados} contacto(s). Puede faltar gente: volvé a traer en un rato.`;
    } else {
      texto = `${guardados} contacto(s) al día.`;
    }

    setResultado({ mal: guardados === 0 || corta, texto });

    // Y se vuelve a leer la lista. Decir "guardados 12" sin releer sería reportar un éxito sin
    // verificar que se puede ver.
    yaPedido.current = false;
    await cargar();
  }, [cargar]);

  const boton = (
    <button type="button" className="fd-btn sec" disabled={trayendo} onClick={() => void traer()}>
      {trayendo ? 'Trayendo de GoHighLevel…' : 'Traer de GoHighLevel'}
    </button>
  );

  const avisoDeTraida = resultado ? (
    <div className={`fd-aviso ${resultado.mal ? 'falta' : 'bien'}`} role="status">
      <i>{resultado.mal ? '⚠' : '✓'}</i>
      <span>{resultado.texto}</span>
    </div>
  ) : null;

  if (situacion === 'cargando') {
    return (
      <div className="fd-aviso">
        <i>◍</i>
        <span>Trayendo tus contactos…</span>
      </div>
    );
  }

  if (situacion === 'sin_respuesta') {
    return (
      <div className="aj-fila">
        <div className="fd-aviso mal">
          <i>◍</i>
          <span>{causa} No es que no tengas contactos: no se pudo preguntar.</span>
        </div>
        <button type="button" className="fd-btn sec" onClick={() => void cargar()}>
          Reintentar
        </button>
      </div>
    );
  }

  if (situacion === 'rechazado') {
    const sinPermiso = codigo === 'sin_permiso' || codigo === 'organizacion_inactiva';
    return (
      <div className={`fd-aviso ${sinPermiso ? 'falta' : 'mal'}`}>
        <i>◍</i>
        <span>{causa}</span>
      </div>
    );
  }

  if (filas.length === 0) {
    /* El vacío LEGÍTIMO, y dice por qué. El `11` § 4: *"no hay datos cargados → `—`, con una
       línea que diga qué falta"*. Un panel que simplemente parece vacío no se reporta, y con
       él se pierde el único síntoma de que la conexión con GoHighLevel no está puesta. */
    return (
      <>
        {avisoDeTraida}
        <div className="empty">
          <div className="e-ic">◔</div>
          <div className="e-t">Todavía no hay contactos en {zona}</div>
          <div className="e-d">
            Todavía no entró nadie a <b>{zona}</b>. Si es la primera vez, traelos con el botón. Si
            ya lo hiciste y sigue vacío, revisá la conexión en <b>Ajustes</b>.
          </div>
          <div className="aj-fila" style={{ justifyContent: 'center', marginTop: 14 }}>{boton}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="aj-fila">
        {boton}
        {avisoDeTraida}
      </div>
      <div className="md-sec">
        <div className="md-h">
          Tus contactos <span className="b">{filas.length}</span>
          {/* El conteo dice cuántas se están MOSTRANDO, y cuando hay más se dice al lado. Un
              número a secas con la lista cortada afirma un total que no es. */}
          {hayMas ? <span className="hint"> y hay más</span> : null}
        </div>
        {filas.map((f) => (
          <Fila key={f.id} fila={f} onAbrir={(fila) => setAbierta(fila.id)} />
        ))}
        {hayMas ? (
          <div className="aj-fila" style={{ justifyContent: 'center', padding: '12px 0' }}>
            <button
              type="button"
              className="fd-btn sec"
              disabled={trayendoPagina}
              onClick={() => void masFilas()}
            >
              {trayendoPagina ? 'Trayendo…' : 'Ver más contactos'}
            </button>
          </div>
        ) : null}
      </div>
      {/* La ficha se abre DONDE se la invoco y nunca navega: es un panel superpuesto, asi que la
          lista de atras conserva su posicion de scroll y al cerrar se vuelve exactamente a donde
          se estaba. Ver `components/negocio/Ficha.jsx`. */}
      {abierta ? <Ficha contactoId={abierta} alCerrar={() => setAbierta(null)} /> : null}
    </>
  );
}
