'use client';

/* La ficha del contacto: un panel lateral con cinco pestañas.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * LAS DOS REGLAS DE LA APERTURA, Y LAS DOS SON DEL `02` § 1
 *
 * **1 · Se abre donde se la invoque, y NUNCA navega.** No es una pantalla: es un panel que se
 * superpone. Quien la abre no pierde el contexto de dónde estaba, y al cerrarla vuelve a la misma
 * lista en la misma posición. Si navegara, atender diez contactos de una cola serían veinte
 * navegaciones y diez pérdidas de scroll.
 *
 * **2 · Es UN solo componente para toda la aplicación.** La misma ficha se abre desde las tres
 * pantallas del closer, desde las del setter y desde la auditoría. El motivo está escrito:
 * *"si hubiera tres, mostrarían tres cosas distintas del mismo contacto, y las tres parecerían
 * correctas"*.
 *
 * ── EL PANEL YA EXISTÍA, INERTE, Y ESO ES LO QUE ESTO REEMPLAZA ─────────────
 *
 * `components/Overlays.jsx` tenía `#cwPanel` completo —encabezado, las cinco pestañas, el cuerpo y
 * el compositor— portado fiel del prototipo y **sin una línea de JavaScript**. Cinco botones sin
 * manejador, un cuerpo que nadie llenaba, y un solo control vivo: el enlace a GoHighLevel.
 *
 * Los módulos que lo manejaban se borraron a propósito (commit `9ef7ecc`, *"Closer y Setter dejan
 * de inventar datos"*): pintaban nombres de personas y montos que solo existían en el ejemplo, y
 * estuvieron en producción mostrándolos.
 *
 * Este componente emite **el mismo DOM y las mismas clases**, así que el CSS de `app/aios.css` y la
 * comparación con el prototipo siguen valiendo sin escribir una regla nueva.
 *
 * ── LO QUE TODAVÍA NO SE DIBUJA, Y NO ES UN OLVIDO ──────────────────────────
 *
 * **El botón «Avanzar →» y el compositor de mensajes no están.** Los dos existen en el CSS y en el
 * prototipo, y los dos llegan en su bloque. Dibujarlos ahora sería exactamente lo que este
 * repositorio quitó dos veces —el «Reportar un problema» de la barra superior, los seis botones del
 * menú de cuenta— con el criterio que quedó escrito: **un control que parece funcionar y no hace
 * nada es peor que su ausencia.**
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';
import { SeisIconos } from './Fila.jsx';

/* Los seis íconos se importan de `Fila.jsx` y NO se copian.
 *
 * Es la regla 9 del `02`: *"un solo componente los dibuja"*. Y el defecto que previene está
 * medido: el bloque de dibujo vivía duplicado en cinco vitrinas con lógica distinta, y el mismo
 * contacto se veía «sin bot» en las listas y «IA activa» en la ficha.
 *
 * Vive en `Fila.jsx` y no en un archivo propio porque ahí nació y ahí está exportado para esto.
 * Moverlo sería tocar dos archivos para que el import se lea más lindo. */

/** Lo que puede recibir el foco. Igual que en `components/Ventana.jsx`. */
const ENFOCABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* Las cinco pestañas, en el orden del prototipo. **Chat primero**, porque el `02` § 4 dice que es
   lo que se necesita el 90 % de las veces.

   `camino` es el segmento de la ruta y `clave` el `data-t` del prototipo: son iguales salvo en
   Chat, donde la pestaña se llama `chat` y el endpoint `mensajes`. Se nombran los dos para que la
   pantalla no tenga que traducir. */
const PESTANAS = [
  { clave: 'chat', camino: 'mensajes', glifo: '◔', nombre: 'Chat', lista: 'mensajes' },
  { clave: 'llamada', camino: 'llamadas', glifo: '✆', nombre: 'Llamada', lista: 'llamadas' },
  { clave: 'perfil', camino: 'perfil', glifo: '☰', nombre: 'Perfil', lista: 'campos' },
  { clave: 'historial', camino: 'historial', glifo: '◷', nombre: 'Historial', lista: 'eventos' },
  { clave: 'notas', camino: 'notas', glifo: '▤', nombre: 'Notas', lista: 'notas' },
];

const GRUPOS_DEL_PERFIL = [
  { clave: 'detalles', titulo: 'Detalles' },
  { clave: 'origen', titulo: 'Origen' },
  { clave: 'calificacion', titulo: 'Calificación' },
  { clave: 'interacciones', titulo: 'Interacciones' },
];

/** Las iniciales del avatar. Dos letras, de las dos primeras palabras. */
function iniciales(nombre) {
  const partes = String(nombre ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length === 0) return '··';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

/** La hora de un mensaje, en la zona de quien mira. */
function hora(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

/** La fecha larga de un separador de día. */
function diaLargo(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hoy = new Date();
  const mismo = (a, b) => a.toDateString() === b.toDateString();
  if (mismo(d, hoy)) return 'HOY';
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  if (mismo(d, ayer)) return 'AYER';
  return d.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
}

/** «hace 2 h», para el historial y las notas. */
function hace(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

/** El aviso de lo que falta medir. NO es un error: es un hecho sobre el sistema. */
function LoQueFalta({ texto }) {
  return (
    <div className="dw-empty">
      {texto}
    </div>
  );
}

export default function Ficha({ contactoId, alCerrar }) {
  const [contacto, setContacto] = useState(null);
  const [refresco, setRefresco] = useState(null);
  const [situacion, setSituacion] = useState('cargando');
  const [causa, setCausa] = useState(null);
  const [activa, setActiva] = useState('chat');
  /** Lo que trajo cada pestaña, por clave. `undefined` = todavía no se pidió. */
  const [pestanas, setPestanas] = useState({});
  const [nota, setNota] = useState('');
  const [guardandoNota, setGuardandoNota] = useState(false);
  const [avisoNota, setAvisoNota] = useState(null);

  const caja = useRef(null);
  const previo = useRef(null);
  const cuerpo = useRef(null);

  /* El foco entra y vuelve, y el fondo no se desplaza. Las tres cosas están copiadas de
     `components/Ventana.jsx`, que las tiene con sus motivos escritos y su prueba. No se reusa el
     componente: `Ventana` es un modal CENTRADO de una sola zona, y esto es un panel pegado a la
     derecha con tres —pestañas fijas, cuerpo con scroll, y el compositor que llega después. */
  useEffect(() => {
    previo.current = document.activeElement;
    // El primer control del CUERPO del panel y no el primero del DOM: el primero del DOM es la ✕,
    // y enfocarla haría que un Enter cierre la ficha en el acto.
    const primero = caja.current?.querySelector('.cw-tabs button');
    (primero ?? caja.current)?.focus();
    return () => {
      if (previo.current instanceof HTMLElement) previo.current.focus();
    };
  }, []);

  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = antes;
    };
  }, []);

  const teclas = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        alCerrar?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const dentro = [...(caja.current?.querySelectorAll(ENFOCABLE) ?? [])].filter(
        (el) => el.offsetParent !== null,
      );
      if (dentro.length === 0) return;
      const primero = dentro[0];
      const ultimo = dentro[dentro.length - 1];
      if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      } else if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      }
    },
    [alCerrar],
  );

  /* El contacto. Se pide UNA vez por apertura, y esa petición refresca sus etiquetas contra el CRM
     — es la única llamada que cuesta abrir la ficha. */
  useEffect(() => {
    let vigente = true;
    setSituacion('cargando');
    void (async () => {
      const r = await pedir(`/api/contactos/${contactoId}`);
      if (!vigente) return;
      if (r.tipo !== 'datos') {
        setCausa(
          r.tipo === 'rechazado'
            ? (r.detalle ?? `El servidor respondió ${r.estado}.`)
            : 'No se pudo contactar al servidor.',
        );
        setSituacion(r.tipo);
        return;
      }
      setContacto(r.datos.contacto);
      setRefresco(r.datos.refresco);
      setSituacion('listo');
    })();
    return () => {
      vigente = false;
    };
  }, [contactoId]);

  /* Cada pestaña se pide AL ABRIRLA, no al abrir la ficha. El `02` § 4: traer las cinco de una
     serían cuatro llamadas para pantallas que nadie va a mirar.
     Y una vez pedida se queda: el `04` § 5 dice que ninguna de las otras cuatro tiene reloj, porque
     su dato no cambia mientras alguien mira — y si cambia, es porque esa misma persona lo cambió. */
  useEffect(() => {
    if (situacion !== 'listo') return undefined;
    if (pestanas[activa] !== undefined) return undefined;
    const cual = PESTANAS.find((p) => p.clave === activa);
    if (!cual) return undefined;

    let vigente = true;
    void (async () => {
      const r = await pedir(`/api/contactos/${contactoId}/${cual.camino}`);
      if (!vigente) return;
      setPestanas((antes) => ({
        ...antes,
        [activa]:
          r.tipo === 'datos'
            ? { filas: r.datos[cual.lista] ?? [], falta: r.datos.falta ?? null }
            : {
                filas: [],
                // Un fallo NO se muestra como «no hay nada». Son dos hechos distintos y el `05`
                // § 8 lo dice: *"un dato que no se pudo traer y un dato que dice cero no son el
                // mismo hecho, y no pueden verse igual"*.
                error:
                  r.tipo === 'rechazado'
                    ? (r.detalle ?? `El servidor respondió ${r.estado}.`)
                    : 'No se pudo contactar al servidor.',
              },
      }));
    })();
    return () => {
      vigente = false;
    };
  }, [activa, contactoId, pestanas, situacion]);

  const agregarNota = useCallback(async () => {
    const texto = nota.trim();
    if (texto.length === 0) return;
    setGuardandoNota(true);
    setAvisoNota(null);
    const r = await pedir(`/api/contactos/${contactoId}/notas`, {
      metodo: 'POST',
      cuerpo: { cuerpo: texto },
    });
    setGuardandoNota(false);
    if (r.tipo !== 'datos') {
      setAvisoNota(
        r.tipo === 'rechazado'
          ? (r.detalle ?? `No se guardó (${r.estado}).`)
          : 'No llegó al servidor. La nota no se guardó.',
      );
      return;
    }
    setNota('');
    /* FUSIÓN, NO REEMPLAZO. Es la tercera regla del `04` § 4, y la que ese documento llama *"el
       defecto más fácil de introducir, porque el código se ve más limpio"*: al recargar, la lista
       se reconstruía con las notas vacías y **borraba la que se acababa de crear**.
       Acá se agrega la fila REAL que devolvió el servidor —con su identificador y su fecha de la
       base— arriba de las que ya estaban. */
    setPestanas((antes) => ({
      ...antes,
      notas: {
        falta: null,
        filas: [
          {
            id: r.datos.id,
            cuerpo: texto,
            // El autor que devolvió el SERVIDOR. `null` acá significaría «la importó el sistema», y
            // la nota apareció firmada por `Sistema` hasta que se recargaba. Lo vio la
            // verificación en el navegador, no la suite.
            autor: r.datos.autor ?? null,
            origen: 'plataforma',
            creadoEl: r.datos.creadoEl,
          },
          ...(antes.notas?.filas ?? []),
        ],
      },
    }));
  }, [contactoId, nota]);

  // ─── El cuerpo de cada pestaña ────────────────────────────────────────────

  function Cuerpo() {
    const p = pestanas[activa];
    if (p === undefined) return <div className="dw-empty">Cargando…</div>;
    if (p.error) {
      return (
        <div className="fd-aviso mal">
          <i>⚠</i>
          <span>{p.error}</span>
        </div>
      );
    }

    if (activa === 'chat') {
      if (p.filas.length === 0) return <LoQueFalta texto={p.falta ?? 'Sin mensajes.'} />;
      /* Los separadores de día. Sin ellos, una conversación de varios días se lee como si el
         tiempo retrocediera: `19:14` seguido de `08:09` parece desorden cuando lo que cambió fue
         el día. El dato ya viaja en cada mensaje; el defecto aparece cuando la pantalla lo
         descarta y pone un «HOY» fijo. */
      let ultimoDia = null;
      return (
        <>
          {p.filas.map((m) => {
            const dia = new Date(m.enviadoEl).toDateString();
            const separador = dia !== ultimoDia ? diaLargo(m.enviadoEl) : null;
            ultimoDia = dia;
            return (
              <div key={m.id}>
                {separador ? <div className="cw-day">{separador}</div> : null}
                <div className={m.direccion === 'saliente' ? 'msgw out' : 'msgw in'}>
                  {/* Un mensaje sin texto NO se descarta: un audio o una imagen existieron, y
                      descartarlos hacía que para el auditor ese turno no hubiera ocurrido. Va con
                      un marcador honesto entre corchetes, distinguible del contenido real. */}
                  {m.cuerpo ?? '[mensaje sin texto]'}
                  <span className="t">
                    {hora(m.enviadoEl)}
                    {m.autor === 'agente' ? ' · agente' : null}
                  </span>
                </div>
              </div>
            );
          })}
        </>
      );
    }

    if (activa === 'llamada') {
      if (p.filas.length === 0) return <LoQueFalta texto={p.falta ?? 'Sin llamadas.'} />;
      return (
        <>
          {p.filas.map((l) => (
            <div className="dw-block" key={l.id}>
              <div className="dw-sec-t">
                {l.agente ?? 'Llamada'}
                <span className="r">{l.contestada ? 'contestada' : 'sin respuesta'}</span>
              </div>
              <div className="kv-box">
                {/* Si el dato no existe, el bloque no se dibuja. El `04` § 1: *"un campo vacío
                    afirma algo falso"*. */}
                {l.inicioEl ? (
                  <div className="kv">
                    <span>Cuándo</span>
                    <b>{new Date(l.inicioEl).toLocaleString('es')}</b>
                  </div>
                ) : null}
                {l.duracionSegundos !== null ? (
                  <div className="kv">
                    <span>Duración</span>
                    <b>{Math.round(l.duracionSegundos / 60)} min</b>
                  </div>
                ) : null}
                {l.resumen ? (
                  <div className="kv">
                    <span>Resumen</span>
                    <b style={{ textAlign: 'left', fontWeight: 400 }}>{l.resumen}</b>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </>
      );
    }

    if (activa === 'perfil') {
      return (
        <>
          {GRUPOS_DEL_PERFIL.map((g) => {
            const suyos = p.filas.filter((c) => c.grupo === g.clave);
            // Los grupos sin campos NO se dibujan. Un encabezado con nada abajo es ruido.
            if (suyos.length === 0) return null;
            return (
              <div className="dw-block" key={g.clave}>
                <div className="dw-sec-t">{g.titulo}</div>
                <div className="kv-box">
                  {suyos.map((c) => (
                    <div className="kv" key={c.etiqueta}>
                      <span>{c.etiqueta}</span>
                      <b style={{ textAlign: 'left', fontWeight: 400 }}>{c.valor}</b>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {p.falta ? <LoQueFalta texto={p.falta} /> : null}
        </>
      );
    }

    if (activa === 'historial') {
      if (p.filas.length === 0) return <LoQueFalta texto={p.falta ?? 'Sin eventos.'} />;
      return (
        <>
          {p.filas.map((e) => (
            <div className="ld-time" key={e.id}>
              <span className="ld-dot ok" />
              <div>
                <div className="ld-t">{e.titulo}</div>
                {/* El autor SIEMPRE, y `Sistema` cuando lo hizo un automatismo. El `04` § 3: esa
                    distinción es lo que hace que el historial sirva para entender qué pasó. */}
                <div className="ld-m">
                  {e.autor}
                  {e.detalle ? ` · ${e.detalle}` : ''}
                </div>
              </div>
              <span className="ld-when">{hace(e.cuando)}</span>
            </div>
          ))}
        </>
      );
    }

    // Notas
    return (
      <>
        <div className="fd-campo">
          <label htmlFor="ficha-nota">Agregar una nota</label>
          <textarea
            id="ficha-nota"
            rows={3}
            value={nota}
            placeholder="Lo que haya que recordar de este contacto…"
            onChange={(e) => setNota(e.target.value)}
          />
        </div>
        <div className="aj-fila">
          <button
            type="button"
            className="fd-btn"
            disabled={guardandoNota || nota.trim().length === 0}
            onClick={() => void agregarNota()}
          >
            {guardandoNota ? 'Guardando…' : 'Guardar nota'}
          </button>
        </div>
        {avisoNota ? (
          <div className="fd-aviso mal">
            <i>⚠</i>
            <span>{avisoNota}</span>
          </div>
        ) : null}

        {p.filas.length === 0 ? (
          <LoQueFalta texto="Este contacto todavía no tiene notas." />
        ) : (
          p.filas.map((n) => (
            <div className="pr-box" key={n.id} style={{ marginTop: 9, padding: '11px 13px' }}>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, whiteSpace: 'pre-line' }}>{n.cuerpo}</div>
              <div style={{ fontSize: 10.5, color: 'var(--txt-faint)', marginTop: 7 }}>
                {/* `null` = la importó el sistema desde el CRM, y se dice así. Poner el nombre de
                    quien mira sería atribuirle una nota que no escribió. */}
                {n.autor ?? 'Sistema'} · {hace(n.creadoEl)}
                {n.origen === 'importada' ? ' · importada del CRM' : ''}
              </div>
            </div>
          ))
        )}
      </>
    );
  }

  // ─── El panel ─────────────────────────────────────────────────────────────

  const pildora = contacto?.pildora;

  return (
    <>
      {/* El fondo es `.scrim` del prototipo. Cerrar al clicarlo es uno de los dos gestos que todo
          el mundo prueba primero; el otro es Escape. */}
      <div className="scrim on" onClick={() => alCerrar?.()} />
      <aside
        className="cw on"
        role="dialog"
        aria-modal="true"
        aria-label={contacto?.nombre ?? 'Ficha del contacto'}
        ref={caja}
        tabIndex={-1}
        onKeyDown={teclas}
      >
        <div className="cw-h">
          <div className="cw-top">
            <span className="cw-av">{iniciales(contacto?.nombre)}</span>
            <div>
              <div className="cw-n">{contacto?.nombre ?? 'Cargando…'}</div>
              <div className="cw-p">{contacto?.telefono ?? 'sin teléfono'}</div>
            </div>
            {/* El enlace al CRM solo si se sabe a dónde. Con `enlaceCrm` nulo el botón NO se
                dibuja, en vez de llevar a una página que no es la de este contacto. */}
            {refresco?.enlaceCrm ? (
              <button
                type="button"
                className="cw-pin"
                style={{ marginLeft: 'auto' }}
                onClick={() => window.open(refresco.enlaceCrm, '_blank', 'noopener')}
              >
                ↗ Ver en GHL
              </button>
            ) : null}
            <span
              className="cw-x"
              role="button"
              tabIndex={0}
              onClick={() => alCerrar?.()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') alCerrar?.();
              }}
              style={refresco?.enlaceCrm ? undefined : { marginLeft: 'auto' }}
            >
              ✕
            </span>
          </div>

          {/* EL ENCABEZADO ES SOLO ESTADO. Nada de acá es clicable salvo cerrar y el enlace al
              CRM: es una foto del contacto, no un panel de control (`02` § 2). */}
          <div className="cw-meta">
            {/* La píldora viene ARMADA del servidor, la misma que la fila que abrió la ficha. Es
                el espejo que el `02` exige, y es cierto por construcción: no hay dos formatos que
                puedan divergir porque no hay dos lugares que formateen. */}
            {pildora ? <span className={`tagx ${pildora.clase}`}>{pildora.texto}</span> : null}
            {contacto ? <SeisIconos iconos={contacto.iconos} /> : null}
          </div>

          {/* Si el refresco contra el CRM no salió, se dice — y la ficha se abre igual con lo que
              había. Una ficha que se niega a abrir porque el CRM está caído es inútil justo cuando
              hay que trabajar sin él. */}
          {refresco && !refresco.actualizado && refresco.porque ? (
            <div className="fd-aviso falta" style={{ marginTop: 12 }}>
              <i>◍</i>
              <span>{refresco.porque}</span>
            </div>
          ) : null}
        </div>

        <div className="cw-tabs">
          {PESTANAS.map((p) => (
            <button
              key={p.clave}
              type="button"
              data-t={p.clave}
              className={activa === p.clave ? 'on' : undefined}
              onClick={() => setActiva(p.clave)}
            >
              {p.glifo} {p.nombre}
            </button>
          ))}
        </div>

        <div className="cw-body" ref={cuerpo}>
          {situacion === 'cargando' ? (
            <div className="dw-empty">Cargando el contacto…</div>
          ) : situacion !== 'listo' ? (
            <div className="fd-aviso mal">
              <i>⚠</i>
              <span>{causa}</span>
            </div>
          ) : (
            <Cuerpo />
          )}
        </div>
      </aside>
    </>
  );
}
