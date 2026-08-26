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
 * ── EL CHAT ES LA ÚNICA PESTAÑA CON RELOJ, Y ESO ES DELIBERADO ──────────────
 *
 * Las otras cuatro se piden al abrirlas y se quedan. El `04` § 5 lo justifica: su dato **no cambia
 * mientras alguien mira**, y si cambia es porque esa misma persona lo cambió. El chat sí: del otro
 * lado hay alguien escribiendo.
 *
 * El reloj se registra con la clave `chat:<id>` en `lib/reloj.ts`, y de ahí salen las dos
 * propiedades que un `setInterval` suelto no puede dar: **pestaña oculta = cero intervalos**, y
 * **abrir la ficha de otro contacto reemplaza el reloj en vez de sumar uno**.
 *
 * Y no negocia con nadie: leer mensajes es **cero llamadas al CRM**. Lo que cuesta —la ingesta—
 * tiene su propio ciclo, su propio candado y su propio presupuesto.
 *
 * ── AVANZAR ES EL CONTROL MÁS IMPORTANTE DE ESTA PANTALLA ──────────────────
 *
 * Y no por gusto: de él salen los números de Inicio, las siete columnas del Pipeline y la píldora
 * de cada fila. Sin él las tres cosas están en cero o vacías, y ninguna tiene otra fuente.
 *
 * Está en el ENCABEZADO y no al pie del chat: se registra un resultado igual después de una llamada
 * que después de una conversación escrita, así que colgarlo de una pestaña lo escondería en la
 * mitad de los casos.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { pedir } from '../../lib/http/cliente.ts';
import { useSesion } from '../../app/sesion-contexto.tsx';
import { conSeparadores, fusionarMensajes } from '../../lib/negocio/chat.ts';
import { CADENCIA, usarReloj } from '../../lib/reloj.ts';
import Avanzar from './Avanzar.jsx';
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
function hora(iso, zona) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    // La zona de la EMPRESA, igual que los separadores de día. Si la hora y el separador usaran
    // zonas distintas, un mensaje podría quedar bajo «AYER» con una hora de hoy.
    return new Intl.DateTimeFormat('es', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: zona,
    }).format(d);
  } catch {
    return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  }
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

/**
 * Una burbuja, con lo que se sabe de su entrega.
 *
 * ── POR QUÉ EL ESTADO SE DIBUJA Y NO SE GUARDA CALLADO ──────────────────────
 *
 * Es la mitad visible del arreglo del defecto que originó todo el bloque: un mensaje se mandó, la
 * aplicación lo dio por enviado, **y nunca llegó**. La ventana de 24 horas evita gastar la llamada
 * en el caso conocido; esto hace visible **todo lo demás** que el canal puede rechazar — un número
 * sin WhatsApp, un dispositivo desconectado.
 *
 * Y hay DOS fallos distintos, y se dicen distinto porque llevan a cosas distintas:
 *
 *   · `envio: 'fallido'` → el `POST` no terminó bien: **el servidor no tiene nada**. Se reintenta.
 *   · `entrega: 'fallido'` → la fila existe, el CRM la aceptó, y el canal la rechazó después.
 *     Reintentar el mismo texto por el mismo canal va a fallar igual.
 */
function Burbuja({ m, zona }) {
  const saliente = m.direccion === 'saliente';
  const noSalio = m.envio === 'fallido';
  const rechazado = m.entrega === 'fallido';
  const mal = noSalio || rechazado;

  return (
    <div className={`msgw ${saliente ? 'out' : 'in'}${mal ? ' mal' : ''}`}>
      {/* Un mensaje sin texto NO se descarta: un audio o una imagen existieron, y descartarlos
          hacía que para el auditor ese turno no hubiera ocurrido. Va con un marcador honesto entre
          corchetes, distinguible del contenido real. */}
      {m.cuerpo ?? '[mensaje sin texto]'}
      {/* Y el motivo del canal, cuando lo hay. Es lo ÚNICO que explica por qué no llegó, y sin él
          la burbuja en rojo solo dice que algo salió mal. */}
      {rechazado && m.falloDelCanal ? <span className="msgw-falla">{m.falloDelCanal}</span> : null}
      <span className="t">
        {hora(m.enviadoEl, zona)}
        {m.autor === 'agente' ? ' · agente' : null}
        {saliente ? <EstadoDeEnvio m={m} /> : null}
      </span>
    </div>
  );
}

/**
 * El renglon de estado de un saliente. **Nunca dice «entregado» hasta que el canal lo diga.**
 *
 * `en_curso` se lee «enviado», que es exactamente lo que se sabe: salió de acá y el CRM lo aceptó.
 * Decir «entregado» ahí sería afirmar un hecho que todavía no ocurrió, y es el defecto entero.
 */
function EstadoDeEnvio({ m }) {
  if (m.envio === 'enviando') return <span className="msgw-est"> · enviando…</span>;
  if (m.envio === 'fallido') return <span className="msgw-est mal"> · no salió</span>;
  if (m.entrega === 'fallido') return <span className="msgw-est mal"> · no llegó</span>;
  if (m.entrega === 'entregado') return <span className="msgw-est"> · entregado</span>;
  if (m.entrega === 'en_curso') return <span className="msgw-est"> · enviado</span>;
  // `desconocido`, o un mensaje viejo sin estado. NO se inventa uno: se calla.
  return null;
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
  /** La ventana de 24 horas, tal como la calculó el SERVIDOR. `null` = todavía no se sabe. */
  const [ventana, setVentana] = useState(null);
  const [borrador, setBorrador] = useState('');
  const [avanzando, setAvanzando] = useState(false);
  const [loRegistrado, setLoRegistrado] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [avisoEnvio, setAvisoEnvio] = useState(null);

  const sesion = useSesion();
  /* La zona de la EMPRESA y no la del navegador. Un mensaje de las 22:00 en Lima son las 03:00 del
     día siguiente en UTC: sin esto, el separador diría un día distinto del que ve quien lo
     escribió. `UTC` de respaldo — no se cae a la del navegador, que seria inventar un hecho. */
  const zona = sesion?.organizacion.zonaHoraria ?? 'UTC';

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
     — es la única llamada que cuesta abrir la ficha.
     Está en su propia función y no dentro del efecto porque Avanzar la vuelve a llamar: registrar un
     resultado cambia la píldora y los seis íconos, y dejarlos con lo de antes mostraría el resultado
     nuevo con la píldora vieja, las dos cosas en la misma pantalla contradiciéndose. */
  const cargarContacto = useCallback(async () => {
    const r = await pedir(`/api/contactos/${contactoId}`);
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
  }, [contactoId]);

  useEffect(() => {
    setSituacion('cargando');
    void cargarContacto();
  }, [cargarContacto]);

  /* Cada pestaña se pide AL ABRIRLA, no al abrir la ficha. El `02` § 4: traer las cinco de una
     serían cuatro llamadas para pantallas que nadie va a mirar.
     Y una vez pedida se queda: el `04` § 5 dice que ninguna de las otras cuatro tiene reloj, porque
     su dato no cambia mientras alguien mira — y si cambia, es porque esa misma persona lo cambió. */
  useEffect(() => {
    if (situacion !== 'listo') return undefined;
    // El chat NO pasa por acá: tiene reloj, ventana y envío, y su carga vive en `cargarChat`.
    if (activa === 'chat') return undefined;
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

  /* ── EL CHAT: una lectura que FUSIONA, nunca reemplaza ──────────────────────
   *
   * Pisar la lista con la respuesta es el defecto que `lib/negocio/chat.ts` existe para impedir: un
   * mensaje recién enviado todavía no está del otro lado, así que la burbuja desaparecía de la
   * pantalla y volvía unos segundos después. Y el caso peor era el otro — un envío que falló de
   * verdad se borraba, y era lo único que decía que el contacto no lo había recibido.
   *
   * La ventana viene en la MISMA respuesta, no en otra: son el mismo hecho, y separadas pueden
   * contradecirse — llega una respuesta y el compositor sigue deshabilitado hasta el pedido
   * siguiente.
   */
  const cargarChat = useCallback(async () => {
    const r = await pedir(`/api/contactos/${contactoId}/mensajes`);
    if (r.tipo !== 'datos') {
      setPestanas((antes) => {
        // Un fallo NO borra lo que ya se estaba mostrando. Vaciar el chat por una respuesta que no
        // llegó convierte un problema de red en «este contacto nunca escribió».
        if (antes.chat?.filas?.length) return antes;
        return {
          ...antes,
          chat: {
            filas: [],
            error:
              r.tipo === 'rechazado'
                ? (r.detalle ?? `El servidor respondió ${r.estado}.`)
                : 'No se pudo contactar al servidor.',
          },
        };
      });
      return;
    }
    setVentana(r.datos.ventana ?? null);
    setPestanas((antes) => ({
      ...antes,
      chat: {
        filas: fusionarMensajes(r.datos.mensajes ?? [], antes.chat?.filas ?? []),
        falta: r.datos.falta ?? null,
      },
    }));
  }, [contactoId]);

  /* LA PRIMERA LECTURA LA HACE LA FICHA, no el reloj, y no es una duplicación.
     Medido en el navegador: con la pestaña oculta el reloj no dispara —es su razón de ser— y el
     chat se quedaba en «Cargando…» sin decir por qué. El reloj REPITE; abrir es de quien abre. */
  useEffect(() => {
    if (situacion !== 'listo' || activa !== 'chat') return undefined;
    if (pestanas.chat !== undefined) return undefined;
    void cargarChat();
    return undefined;
  }, [activa, cargarChat, pestanas.chat, situacion]);

  /* Y el reloj, que solo repite. La clave lleva el identificador del contacto: abrir otra ficha
     REEMPLAZA el reloj en vez de sumar uno, y con la pestaña oculta no queda ninguno corriendo.
     `null` mientras el chat no esté a la vista: no se registra, y así no hace falta romper la regla
     de los hooks para apagarlo. */
  usarReloj(
    situacion === 'listo' && activa === 'chat' ? `chat:${contactoId}` : null,
    cargarChat,
    CADENCIA.chat,
  );

  const mandar = useCallback(async () => {
    const texto = borrador.trim();
    if (texto.length === 0) return;
    setEnviando(true);
    setAvisoEnvio(null);

    /* LA BURBUJA OPTIMISTA. Se dibuja antes de que el servidor conteste, y **sobrevive** a los
       ciclos que todavía no la traen porque `fusionarMensajes` la conserva mientras esté en vuelo.
       El identificador es local: el de verdad lo pone el CRM, y hasta entonces el único puente
       entre las dos es el texto. */
    const local = `local:${contactoId}:${performance.now()}`;
    setPestanas((antes) => ({
      ...antes,
      chat: {
        ...(antes.chat ?? { falta: null }),
        filas: [
          ...(antes.chat?.filas ?? []),
          {
            id: local,
            cuerpo: texto,
            direccion: 'saliente',
            autor: 'persona',
            enviadoEl: new Date().toISOString(),
            envio: 'enviando',
          },
        ],
      },
    }));
    setBorrador('');

    const r = await pedir(`/api/contactos/${contactoId}/mensajes`, {
      metodo: 'POST',
      cuerpo: { texto },
    });
    setEnviando(false);

    if (r.tipo !== 'datos') {
      setAvisoEnvio(
        r.tipo === 'rechazado'
          ? (r.detalle ?? `No se pudo enviar (${r.estado}).`)
          : 'No se pudo contactar al servidor.',
      );
      // La burbuja NO se borra: se marca. Es lo único que dice que el contacto no lo recibió, y
      // borrarla dejaría el mensaje desaparecido sin rastro. El texto vuelve al compositor para
      // poder reintentar sin volver a escribirlo.
      setPestanas((antes) => ({
        ...antes,
        chat: {
          ...(antes.chat ?? { falta: null }),
          filas: (antes.chat?.filas ?? []).map((m) =>
            m.id === local ? { ...m, envio: 'fallido' } : m,
          ),
        },
      }));
      setBorrador(texto);
      return;
    }

    if (r.datos.sinSeguimiento) {
      // El CRM no devolvió identificador, así que este mensaje **no se va a poder confirmar
      // nunca**. Quien mira tiene derecho a saber que el visto bueno no va a llegar.
      setAvisoEnvio(
        'Salió, pero GoHighLevel no devolvió su identificador: no vamos a poder confirmar la entrega.',
      );
    }
    // No se toca la burbuja: el ciclo siguiente trae la fila real y la fusión suelta la optimista.
    // Marcarla «entregada» acá sería exactamente el defecto original — dar por llegado lo que solo
    // fue aceptado.
    void cargarChat();
  }, [borrador, cargarChat, contactoId]);

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
      /* Los separadores de día los pone `conSeparadores`, no este JSX, y no es por prolijidad:
         «donde cambia el día» es una decisión con dos zonas horarias adentro y en el JSX no se
         puede probar. Sin ellos, una conversación de varios días se lee como si el tiempo
         retrocediera — `19:14` seguido de `08:09` parece desorden cuando lo que cambió fue el día. */
      return (
        <>
          {conSeparadores(p.filas, zona).map((r) =>
            r.tipo === 'dia' ? (
              <div className="cw-day" key={r.clave}>
                {r.texto}
              </div>
            ) : (
              <Burbuja key={r.clave} m={r.mensaje} zona={zona} />
            ),
          )}
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
            {/* AVANZAR primero y a la derecha: es la acción de la pantalla, no una más. */}
            <button
              type="button"
              className="fd-btn"
              style={{ marginLeft: 'auto' }}
              disabled={situacion !== 'listo'}
              onClick={() => setAvanzando(true)}
            >
              Avanzar →
            </button>
            {refresco?.enlaceCrm ? (
              <button
                type="button"
                className="cw-pin"
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

        {/* EL COMPOSITOR, solo en la pestaña del chat. En las otras cuatro no se dibuja: un cuadro
            de texto debajo del historial de llamadas invitaría a escribir algo que no va a ningún
            lado. */}
        {/* ── LO QUE SE REGISTRÓ, Y LO QUE PASÓ CON EL CRM ─────────────────────
            El resultado quedó guardado y la ficha ya se refrescó. Lo que puede haber quedado a
            medias es el aviso al CRM, y eso se dice aparte: mientras no llegue, el CRM **no
            disparó sus automatismos** —la secuencia de recuperación de un no-show, por ejemplo—.
            Colapsarlo en «listo» sería reportar un éxito a medias como completo. */}
        {loRegistrado ? (
          <div className={`fd-aviso ${loRegistrado.crm?.avisado ? 'bien' : 'falta'} cw-cerrada`}>
            <i>{loRegistrado.crm?.avisado ? '✓' : '◍'}</i>
            <span>
              Registrado. El contacto pasó a <b>{loRegistrado.etapa}</b>.
              {loRegistrado.tarea ? ' Se creó la tarea de seguimiento.' : ''}
              {loRegistrado.crm?.avisado
                ? ''
                : ` Falta avisarle a GoHighLevel: ${loRegistrado.crm?.porque ?? 'no se pudo.'}`}
            </span>
          </div>
        ) : null}

        {situacion === 'listo' && activa === 'chat' ? (
          <Compositor
            ventana={ventana}
            borrador={borrador}
            alEscribir={setBorrador}
            alMandar={mandar}
            enviando={enviando}
            aviso={avisoEnvio}
                      />
        ) : null}
      </aside>

      {avanzando ? (
        <Avanzar
          contactoId={contactoId}
          nombre={contacto?.nombre}
          alCerrar={() => setAvanzando(false)}
          alRegistrar={(lo) => {
            setLoRegistrado(lo);
            /* Se recarga el contacto: la píldora del encabezado y los seis íconos salen del
               servidor, y dejarlos con lo de antes mostraría un resultado registrado con la
               píldora vieja — las dos cosas en la misma pantalla, contradiciéndose. */
            void cargarContacto();
            /* Y el chat, porque la nota del resultado también aparece en el historial. */
            setPestanas((antes) => {
              const { historial, notas, ...resto } = antes;
              return resto;
            });
          }}
        />
      ) : null}
    </>
  );
}

/**
 * El compositor.
 *
 * ── DESHABILITADO **CON EL MOTIVO A LA VISTA**, no deshabilitado a secas ────
 *
 * Un control apagado sin explicación es peor que uno que falla: quien lo mira no sabe si es un
 * defecto, si le falta un permiso, o si tiene que hacer algo. Acá lo que hay que hacer está escrito
 * — esperar a que el contacto escriba, o mandarle una plantilla desde el CRM —, y por eso el motivo
 * lo redacta el SERVIDOR: es el mismo texto con el que responde el rechazo si alguien manda igual.
 *
 * ── Y MIENTRAS NO SE SEPA, NO SE DECIDE ────────────────────────────────────
 *
 * `ventana === null` es «todavía no contestó el servidor», que **no es** «está cerrada». Dibujarlo
 * cerrado en ese instante haría parpadear el motivo del vencimiento en cada apertura de ficha, y
 * quien lo lee no tiene forma de saber que fue mentira por medio segundo.
 */
function Compositor({ ventana, borrador, alEscribir, alMandar, enviando, aviso }) {
  const sinRespuesta = ventana === null;
  const cerrada = ventana !== null && !ventana.abierta;
  const bloqueado = sinRespuesta || cerrada || enviando;

  return (
    <>
      {cerrada ? (
        <div className="fd-aviso falta cw-cerrada">
          <i>◍</i>
          <span>{ventana.motivo}</span>
        </div>
      ) : null}
      {aviso ? (
        <div className="fd-aviso mal cw-cerrada">
          <i>⚠</i>
          <span>{aviso}</span>
        </div>
      ) : null}
      <div className="cw-input">
        <input
          type="text"
          value={borrador}
          onChange={(e) => alEscribir(e.target.value)}
          onKeyDown={(e) => {
            // Enter manda. No hay Shift+Enter para el salto de línea porque esto es un `input` de
            // una línea, que es lo que el prototipo tiene y lo que el CSS estila.
            if (e.key === 'Enter' && !bloqueado) {
              e.preventDefault();
              void alMandar();
            }
          }}
          disabled={bloqueado}
          placeholder={
            sinRespuesta
              ? 'Cargando la conversación…'
              : cerrada
                ? 'Pasaron más de 24 horas: el canal no acepta texto libre'
                : 'Escribí un mensaje…'
          }
          aria-label="Mensaje para el contacto"
        />
        <button
          type="button"
          className="cw-send"
          onClick={() => void alMandar()}
          disabled={bloqueado || borrador.trim().length === 0}
          aria-label="Enviar"
        >
          {enviando ? '◍' : '➤'}
        </button>
      </div>
    </>
  );
}
