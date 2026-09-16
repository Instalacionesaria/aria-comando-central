'use client';

/* Conversation Intelligence: los dos flujos conversacionales y su supervisor.
   ==========================================================================

   ── QUÉ ES ESTA PANTALLA, Y POR QUÉ AUDITORÍA VIVE ACÁ ────────────────────

   `AIOS_Arquitectura_Funcional_v0.2.md` § 8 define Conversation Intelligence como el departamento
   que supervisa las conversaciones automatizadas, con **dos módulos**: Lead Flow —conseguir la
   cita— y Appointment Flow —que asista—, cada uno con su agente de texto, su agente de voz y su
   Supervisor.

   Y el Supervisor **ya estaba construido**, archivado en otra parte. La pantalla que se llamaba
   «Auditoría de agentes» y colgaba del grupo «Operación» audita exactamente esos dos módulos, con
   exactamente esos nombres (`lib/auditor/vista.ts`):

     · `chat_pre_agenda`  → **LeadFlow**, Zona Setter · «califica al contacto y consigue la cita»
     · `chat_post_agenda` → **AppFlow**,  Zona Closer · «acompaña al que ya agendó»

   Los nombres no se eligieron para que coincidieran: salen de las etiquetas del CRM
   —`bot_activado_leadflow` y `bot_activado_appflow`, mapeadas en `lib/ghl/contrato.ts`—. O sea que
   esto no es una mudanza de una pantalla ajena: es archivar una donde siempre correspondió.

   ── LAS CUATRO PESTAÑAS SON PLANAS, Y ESO ES UNA DECISIÓN ─────────────────

   Auditoría traía sus propias dos («Inicio» y «Prompts») en su propia barra `.cl-sub`. Anidarlas
   habría puesto **dos barras encimadas** con la misma forma y distinto contenido, y la estética de
   operación dibuja una sola barra por pantalla. Así que las dos suben al primer nivel y quedan
   cuatro:

     Lead Flow │ Appointment Flow │ Auditoría │ Prompts

   Las dos primeras son los módulos del documento; las dos últimas, lo que el Supervisor produce.

   ── POR QUÉ LA CARGA VIVE ACÁ Y NO EN EL PANEL ────────────────────────────

   Los contadores de las pestañas —cuántos patrones abiertos, cuántos prompts sin cargar— salen de
   los datos. Con la carga en el panel, esta barra habría necesitado que el hijo le avisara hacia
   atrás, y ése es el cableado que termina con dos fuentes para el mismo número. Una sola lectura,
   acá, y todo lo demás la recibe.

   ═══════════════════════════════════════════════════════════════════════════
   LAS DOS PESTAÑAS DE FLUJO SON UN TABLERO, Y ANTES ERAN UNA PILA DE PÁRRAFOS
   ═══════════════════════════════════════════════════════════════════════════

   Las cifras eran correctas y la forma las tapaba. Medido sobre la respuesta real antes de tocar
   nada: **40 pedazos de cifra —318 caracteres— contra 32 párrafos, 5.596 caracteres.** Diecisiete
   caracteres de explicación por cada carácter de número, y siete de los nueve huecos de aviso
   encendidos a la vez. Cada número traía debajo su propia nota, y con todas puestas ninguna se lee.

   Lo que reemplaza a eso es el vocabulario que esta misma pantalla tenía cuando era una maqueta
   —`.csf`, `.csr`, `.org-split`, `.pn`, que siguen enteros en `app/aios.css:1876`— llenado con los
   números medidos. La regla nueva: **la figura se queda con el número y el porqué se va a un
   ícono**, salvo cuando lo que hay que decir es que el dato no existe. Ver `Nota`.

   ── Y LA CADENA NO ES UN EMBUDO, QUE ES EL HALLAZGO QUE DECIDIÓ EL DISEÑO ──

   Lead Flow parece un embudo: entraron 231, se le escribió a 225, contestaron 138, agendaron 121.
   Puesto en cuatro barras se lee como que 121 de esos 138 convirtieron. **Son 64.** Los otros 57
   agendaron sin contestar nunca — el enlace del calendario no obliga a conversar.

   Por eso la cadena termina en «respondieron» y lo que sigue es una BIFURCACIÓN, no un cuarto
   escalón. El motivo largo, con los números, está en `indicadoresDelLead.agendaronTrasResponder`.
   ========================================================================= */

import { useCallback, useEffect, useState } from 'react';

import { Cuerpo } from '../auditoria/PanelDeAuditoria.jsx';
/* `CADENCIA` se importa desde `reloj` y no desde `cadencia`, que es donde vive: es lo que ya hacen
   `CloserView` y `SetterView`, y tener dos caminos al mismo número invita a que alguien crea que son
   dos números. `reloj` lo reexporta justamente para eso. */
import { CADENCIA, usarReloj } from '@/lib/reloj';
import { estaALaVista } from '@/lib/vista';
import { POR_QUE_NO_AUDITA, agruparPorPatron, leerLaPantalla } from '@/lib/auditor/vista';
import { PERIODOS, PERIODO_POR_OMISION } from '@/lib/negocio/periodo';

/**
 * Las cuatro pestañas.
 *
 * Los iconos de las dos primeras son los de su ZONA —`#i-setter` para Lead Flow, `#i-closer` para
 * Appointment Flow— y no dos iconos nuevos: es el mismo par que `ICONO_DEL_AGENTE` usa dentro del
 * panel, así que la misma cosa se dibuja igual en los dos sitios.
 */
const SUB = [
  { clave: 'leadflow', nombre: 'Lead Flow', icono: '#i-setter' },
  { clave: 'appflow', nombre: 'Appointment Flow', icono: '#i-closer' },
  { clave: 'auditoria', nombre: 'Auditoría', icono: '#i-auditor' },
  { clave: 'prompts', nombre: 'Prompts', icono: '#i-tools' },
];

/** Qué mide cada flujo y qué le falta para medirlo. Ver el encabezado: se dice, no se inventa. */
const FLUJOS = {
  leadflow: {
    titulo: 'Lead Flow',
    mision: 'Convertir contactos que todavía no agendaron en citas agendadas.',
    agente: 'LeadFlow',
    falta: [
      ['El recorrido hasta la landing', 'Enlace enviado, enlace abierto, visita y formulario no se registran en ninguna parte. Hace falta un trigger link, que es un sistema aparte —un redirector con un token por contacto— y no un campo que se pueda agregar.'],
      ['El histórico de las tasas por período', 'La cita ya guarda cuándo se reservó, pero solo desde que empezó a guardarse: las anteriores tienen el dato vacío y NO se van a llenar solas —el barrido mira una ventana de días alrededor de hoy y no vuelve a pasar por las viejas—. Hasta que haya historia, comparar contra el período anterior contaría de menos sin avisar.'],
      ['El agente de voz', 'Sus llamadas no dejan transcripción en esta base: la tabla existe y tiene cero filas.'],
    ],
  },
  appflow: {
    titulo: 'Appointment Flow',
    mision: 'Convertir citas agendadas en asistencias efectivas.',
    agente: 'AppFlow',
    falta: [
      /* ── «LA ASISTENCIA» SALIÓ DE ESTA LISTA, Y NO ES UN RECORTE ──────────
       *
       * Estaba acá declarada como imposible mientras la tarjeta de arriba **ya dibuja la cifra**:
       * la migración `049` le dio a la cita su columna `asistio` y Avanzar la pregunta al cerrar
       * el intento. Una pantalla que muestra un número tres centímetros arriba de un cartel que
       * dice que ese número no se puede saber no es una imprecisión: enseña a no leer los
       * carteles, y con eso se pierden los tres que sí son ciertos.
       *
       * Lo que sigue faltando es OTRA cosa, más chica y más concreta, así que se dice aparte: el
       * dato lo reporta una persona y todavía no hay volumen. Eso ya lo dice `avisoDeAsistencia`
       * al lado de la cifra, con el conteo real, así que acá no se repite. */
      /* ── LA CIFRA VA FECHADA, Y ÉSE ES EL ARREGLO ───────────────────────
       *
       * Decía «3 citas de 1052» en presente, como si fuera el estado de hoy. `negocio.citas` crece
       * todos los días, así que ese denominador envejece solo — y es el ARGUMENTO por el que se
       * ignora el campo del CRM, o sea justo el número que no puede quedar viejo.
       *
       * Fechada se lee como lo que es: una medición, que sigue siendo cierta el día que se hizo.
       * Es la diferencia entre un comentario del código —donde este proyecto fecha todo— y una
       * cadena que alguien lee en pantalla creyendo que describe el ahora. */
      ['La asistencia según el CALENDARIO', 'Los campos «asistió» y «no apareció» del CRM están prácticamente vacíos: medido en septiembre de 2026, 3 citas de 1052 en todo un año. La cifra que sí se muestra la reporta el closer al cerrar el intento, o sea una persona — así que mide lo que alguien registró, no lo que el calendario observó, y un intento que nadie cierra no aparece en ninguna de las dos.'],
      /* ── ESTE RENGLÓN DECÍA QUE EL PORCENTAJE NO VENÍA, Y VENÍA ───────────
       *
       * Decía «sin fecha ni porcentaje visto». La fecha es cierto. El porcentaje era falso, y la
       * creencia salió de mirar los dos campos equivocados: `Video Watch Percentage` y `Porcentaje
       * de Video Visto` están en 0 de 584 contactos —con razón— mientras `Video Pre-Call` está en
       * 213 y trae el porcentaje adentro de sus opciones.
       *
       * Lo que sigue faltando es la FECHA, y no es un detalle: sin ella el valor que el CRM escribe
       * al agendar no se distingue de uno medido después de la llamada. */
      ['CUÁNDO vio el precall', 'El campo dice cuánto del video se reprodujo, pero no cuándo. Sin la fecha no se puede saber si lo vio antes de la llamada —que es lo que el flujo persigue— o si el valor es el que el CRM escribió al agendar y nadie tocó después.'],
      ['El historial de reagendamientos', 'Desde ahora se guarda el ÚLTIMO movimiento —la hora anterior y cuándo lo movieron—, pero no la cadena completa: el barrido mira una vez por hora, así que dos movimientos seguidos se ven como uno. Y cancelar para volver a reservar produce otra cita en el CRM, no un reagendamiento.'],
    ],
  },
};

export default function PanelDeConversation() {
  const [sub, setSub] = useState(SUB[0].clave);
  const [periodo, setPeriodo] = useState(PERIODO_POR_OMISION);
  const [pantalla, setPantalla] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  /* Qué patrón está abierto. Se guarda el CÓDIGO y no un índice: la lista se reordena al recargar
     —el orden es por cantidad de casos— y con un índice quedaría abierto otro patrón. */
  const [abierto, setAbierto] = useState(null);

  /**
   * Trae la pantalla. `esRecarga` cambia qué pasa mientras tanto y qué pasa si falla.
   *
   * ── TENIENDO DATOS, LA PANTALLA NO SE VACÍA NUNCA ───────────────────────
   *
   * Es la regla que `lib/usarLectura.ts` ya tiene escrita con su factura pagada: *«poner "cargando"
   * en una recarga reemplazaba el cuerpo entero y se llevaba puesta la ficha abierta»*. Acá el
   * equivalente es el patrón abierto —que `abierto` guarda justo para sobrevivir a una recarga— y
   * las cifras, que parpadearían cada minuto.
   *
   * Y si la recarga FALLA, lo que había se queda: el aviso va al lado. Anular `pantalla` en un tic
   * fallido borraría cifras correctas por un corte de red de un segundo — y quien esté mirando
   * pierde el número que estaba leyendo, sin haber hecho nada.
   *
   * ── EL CAMBIO DE PERÍODO ENTRA POR ACÁ Y NO ES UNA RECARGA ──────────────
   *
   * Va como carga PRIMERA (`esRecarga` en falso) aunque ya haya datos en pantalla, y es deliberado:
   * las cifras que están dibujadas son de otra ventana. Dejarlas puestas mientras llega la nueva
   * mostraría treinta días bajo el botón «Hoy» ya encendido, que es la peor versión posible de esto
   * —todo se ve bien y los números son de otro período—. El indicador de carga es la única forma
   * honesta de decir «esto que ves ya no corresponde».
   */
  const cargar = useCallback(
    async (esRecarga = false) => {
      if (!esRecarga) setCargando(true);
      const r = await leerLaPantalla(periodo);
      if (r.tipo === 'datos') {
        setPantalla(r.pantalla);
        setError('');
      } else {
        setError(r.mensaje);
        /* Sólo la PRIMERA carga deja la pantalla en nulo: ahí no hay nada que conservar, y el cuerpo
           tiene que poder dibujar el error con su botón. */
        if (!esRecarga) setPantalla(null);
      }
      if (!esRecarga) setCargando(false);
    },
    [periodo],
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  /* ── EL RELOJ, COLGADO DE QUE LA PANTALLA ESTÉ A LA VISTA ────────────────
   *
   * `estaALaVista` es la única forma en que React se entera de que esta sección se abrió: el cambio
   * de vista lo hace `lib/aios/shell.js` moviendo clases en el DOM, sin desmontar nada.
   *
   * Con `null` como clave el reloj no se registra, así que con Conversation cerrada esto no cuesta
   * una sola petición — que es la lección que `CADENCIA.puntitoDeTools` documenta habiendo pagado
   * 180 peticiones por hora desperdiciadas. */
  const aLaVista = estaALaVista('conversation');
  const recargar = useCallback(() => cargar(true), [cargar]);
  usarReloj(aLaVista ? 'conversation:tic' : null, recargar, CADENCIA.inteligencia);

  /* Los patrones agrupados UNA vez, acá, y repartidos por agente más abajo. Agruparlos dentro de
     cada bloque recorrería la lista dos veces y —peor— dejaría dos llamadas que alguien puede
     cambiar de a una. */
  const patrones = pantalla ? agruparPorPatron(pantalla.casos) : [];
  const abiertos = patrones.length;
  const sinPrompt = pantalla ? pantalla.prompts.filter((p) => !p.texto).length : 0;

  return (
    <>
      {/* La barra, SIEMPRE: si apareciera con los datos, la pantalla salta al cargar. */}
      {/* Sin clase propia: la separación del encabezado la da el `gap: 18px` de `.cl-page`, que es
          el padre. `aud-sub` existía para eso mismo cuando la barra colgaba de otro sitio. */}
      <div className="cs-barra">
        <div className="cl-sub">
          {SUB.map((s) => (
            <button
              key={s.clave}
              type="button"
              data-c={s.clave}
              className={sub === s.clave ? 'on' : undefined}
              onClick={() => setSub(s.clave)}
            >
              <svg viewBox="0 0 16 16">
                <use href={s.icono} />
              </svg>
              {s.nombre}
              {/* Los contadores solo si hay algo. Un `0` en una píldora al lado del nombre es ruido
                  que se aprende a ignorar, y acá además sería un cero de dos significados. */}
              {s.clave === 'auditoria' && abiertos > 0 ? (
                <span className="cnt">{abiertos}</span>
              ) : null}
              {s.clave === 'prompts' && sinPrompt > 0 ? (
                <span className="cnt aud-cnt-falta">{sinPrompt}</span>
              ) : null}
            </button>
          ))}
        </div>

        {/* ── EL PERÍODO SÓLO EN LAS DOS PESTAÑAS QUE MIDEN ─────────────────
            Auditoría y Prompts no lo usan: sus listas no están acotadas por ventana. Un segmentado
            encendido encima de una lista que no cambia al tocarlo es peor que no tenerlo —enseña
            que el control no hace nada, y después tampoco se usa donde sí hace. */}
        {FLUJOS[sub] ? <Periodos valor={periodo} alElegir={setPeriodo} /> : null}
      </div>

      {FLUJOS[sub] ? (
        <Flujo
          flujo={FLUJOS[sub]}
          cargando={cargando}
          error={error}
          noAudita={pantalla?.noAudita ?? null}
          cancelacion={sub === 'appflow' ? (pantalla?.cancelacion ?? null) : null}
          precall={sub === 'appflow' ? (pantalla?.precall ?? null) : null}
          sentimiento={pantalla?.sentimiento?.[sub] ?? null}
          respuesta={sub === 'leadflow' ? (pantalla?.respuesta ?? null) : null}
          atribucion={sub === 'leadflow' ? (pantalla?.atribucion ?? null) : null}
        />
      ) : (
        <Cuerpo
          cargando={cargando}
          error={error}
          pantalla={pantalla}
          patrones={patrones}
          /* El panel entiende dos caras, `inicio` y `prompts`. «Auditoría» es su `inicio`. */
          sub={sub === 'prompts' ? 'prompts' : 'inicio'}
          abierto={abierto}
          alAbrir={(p) => setAbierto(abierto === p ? null : p)}
          alRecargar={cargar}
        />
      )}
    </>
  );
}

/**
 * El segmentado de período. Las cuatro ventanas salen de `PERIODOS`, no de una lista escrita acá.
 *
 * ── LA LISTA NO SE REPITE, Y ÉSE ES TODO EL MOTIVO DEL IMPORT ─────────────
 *
 * Escribir los cuatro botones a mano sería más corto. También sería el defecto de siempre: el
 * servidor valida contra su lista y la pantalla dibuja la suya, y el día que alguien agregue un
 * período a una sola de las dos, el botón nuevo manda una clave que el servidor rechaza — o el
 * servidor acepta una que ningún botón produce. Ver la cabecera de `lib/negocio/periodo.ts`.
 */
function Periodos({ valor, alElegir }) {
  return (
    <div className="db-seg cs-periodos" role="group" aria-label="Período de las cifras">
      {PERIODOS.map((p) => (
        <button
          key={p.clave}
          type="button"
          className={valor === p.clave ? 'on' : undefined}
          /* `aria-pressed` y no `aria-selected`: esto es un grupo de botones de alternancia, no una
             lista de pestañas, y un lector de pantalla los anuncia distinto. */
          aria-pressed={valor === p.clave}
          title={p.matiz ?? undefined}
          onClick={() => alElegir(p.clave)}
        >
          {p.etiqueta}
        </button>
      ))}
    </div>
  );
}

/**
 * El porqué de una cifra, escondido detrás de un ícono.
 *
 * ── POR QUÉ ESTO EXISTE, MEDIDO ────────────────────────────────────────────
 *
 * Antes cada número traía debajo su párrafo. Sumados daban **5.596 caracteres de prosa contra 318
 * de cifra**, y con siete avisos encendidos a la vez ninguno se lee: una advertencia que aparece
 * siempre se aprende a ignorar, y con ella se pierden las que sí importan.
 *
 * ── LO QUE NO SE ESCONDE ───────────────────────────────────────────────────
 *
 * `grave` deja el texto a la vista. Es para lo que no es un matiz sino un hueco: *«nadie registró
 * esto todavía»*, *«el campo no existe en el CRM»*. Esconder eso detrás de un ícono convertiría un
 * dato inexistente en un dato con asterisco, que es exactamente la confusión que esta aplicación
 * persigue — el cero que no se distingue del vacío.
 *
 * ── Y POR QUÉ HAY UN PANEL ADEMÁS DEL `title` ──────────────────────────────
 *
 * El `title` del navegador sale al pasar el ratón y **no existe en un teléfono**. Con sólo `title`,
 * la mitad del porqué sería invisible para quien mire esto desde el celular, que es donde más se
 * mira un tablero. El botón abre el mismo texto al tocarlo.
 */
function Nota({ texto, grave = false }) {
  const [abierta, setAbierta] = useState(false);
  if (!texto) return null; // La regla del silencio: sin nada que decir, no se dibuja nada.
  if (grave) return <p className="cs-grave">{texto}</p>;

  return (
    <span className="cs-nota">
      <button
        type="button"
        className={abierta ? 'cs-nota-b on' : 'cs-nota-b'}
        title={texto}
        aria-expanded={abierta}
        aria-label="Por qué"
        onClick={() => setAbierta(!abierta)}
      >
        {/* Un signo y no un icono del atlas: los `#i-*` son de 16 px y acá la marca mide 13. */}
        <span aria-hidden="true">i</span>
      </button>
      {abierta ? <span className="cs-nota-p">{texto}</span> : null}
    </span>
  );
}

/** Horas a algo que se lee: «2,1 días» dice más que «49,2 h» cuando pasa de un día. */
function enTiempo(horas) {
  if (horas === null || horas === undefined) return null;
  if (horas < 48) return `${Math.round(horas)} h`;
  return `${(horas / 24).toFixed(1)} días`;
}

/**
 * Un tiempo en minutos, dicho en la unidad que no miente.
 *
 * Medido: la mediana hasta la primera respuesta es de 6 minutos y el percentil 90 de 6,2 HORAS. Si
 * los dos se dibujaran en minutos, «371 min» obliga a quien mira a dividir de cabeza; si los dos se
 * dibujaran en horas, «0,1 h» borra la cifra que importa. Cada uno en su unidad, y por eso esto
 * decide por valor y no por campo.
 */
function enMinutos(m) {
  if (m === null || m === undefined) return null;
  if (m < 90) return `${Math.round(m * 10) / 10} min`;
  if (m < 60 * 48) return `${Math.round((m / 60) * 10) / 10} h`;
  return `${Math.round((m / 1440) * 10) / 10} d`;
}

/**
 * La fecha desde la que hay datos, en la zona de quien mira.
 *
 * En la zona del navegador y no en UTC a propósito: es una fecha que se compara con el calendario
 * de quien está mirando la pantalla («ah, desde el lunes pasado»), no un instante que tenga que
 * coincidir con una fila de la base. En UTC, quien esté en Lima vería un día menos cada vez que el
 * primer registro del período cayó después de las 19 h.
 */
function fechaCorta(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long' }).format(d);
}

/** Un porcentaje listo para un ancho de barra. Nunca pasa de 100 ni baja de 0. */
function ancho(parte, total) {
  if (!total || total <= 0) return '0%';
  return `${Math.max(0, Math.min(100, (parte / total) * 100))}%`;
}

/** El mismo número como porcentaje de texto, con coma decimal y una cifra. */
function porciento(parte, total) {
  if (!total || total <= 0) return null;
  return `${Math.round((parte / total) * 1000) / 10} %`;
}

/**
 * Un eslabón de la cadena: nombre, valor, barra y porcentaje.
 *
 * ── LA BARRA NUNCA INFORMA SOLA ────────────────────────────────────────────
 *
 * El valor y el porcentaje van SIEMPRE al lado, aunque la barra ya lo diga. Es la regla de la
 * estética —el color y la longitud no pueden ser el único portador de un dato— y acá además hace
 * falta por otra razón: dos barras de largo parecido son indistinguibles a ojo, y la diferencia
 * entre 97,4 % y 59,7 % es toda la conversación.
 *
 * `valor` en `null` dibuja el guion y **deja la barra vacía**, que es cómo se declara un hueco: una
 * barra a cero diría «medimos y da cero», y son dos cosas distintas.
 */
function Eslabon({ nombre, valor, parte, total, pie, nota, menor = false }) {
  const vacio = valor === null || valor === undefined;
  return (
    <div className={menor ? 'csr side' : 'csr'}>
      <span className="csr-n">
        {nombre}
        <Nota texto={nota} />
      </span>
      <b className="csr-v">{vacio ? '—' : valor}</b>
      <span className="csr-b">
        {vacio ? null : <i style={{ width: ancho(parte, total) }} />}
      </span>
      <span className="csr-p">{pie}</span>
    </div>
  );
}

/** Una cifra de apoyo dentro de un panel. El guion es «no se sabe», nunca un cero. */
function Dato({ rotulo, valor, detalle, nota }) {
  return (
    <div className="pn-c">
      <p className="pn-k">
        {rotulo}
        <Nota texto={nota} />
      </p>
      <p className="pn-r">
        <b className="pn-v">{valor === null || valor === undefined ? '—' : valor}</b>
      </p>
      {detalle ? <p className="pn-rt">{detalle}</p> : null}
    </div>
  );
}

/** Un panel de cifras de apoyo. `columnas` decide la rejilla: 2, 3 o 4. */
function Panel({ titulo, extra, columnas, children }) {
  const clase = columnas === 4 ? 'pn-b q4' : columnas === 3 ? 'pn-b q3' : 'pn-b';
  return (
    <div className="pn">
      <div className="pn-h">
        {titulo}
        {extra ? <em>{extra}</em> : null}
      </div>
      <div className={clase}>{children}</div>
    </div>
  );
}

/**
 * El recorrido del lead (§9.3), y la bifurcación que impide que se lea como un embudo.
 *
 * ── LAS BARRAS SON TODAS SOBRE LA COHORTE, Y SE DICE EN EL SUBTÍTULO ───────
 *
 * Los tres eslabones se miden contra los que entraron al CRM, no cada uno contra el anterior. Con
 * cada uno contra el anterior las barras quedarían casi llenas siempre —97 %, 61 %— y la caída real
 * desde el total dejaría de verse. Y como la tasa de respuesta publicada (61,3 %) SÍ es contra los
 * escritos, el subtítulo dice cuál es cuál: dos porcentajes del mismo número sin explicación es la
 * forma más rápida de que nadie confíe en la pantalla.
 */
function Recorrido({ r }) {
  const desde = fechaCorta(r.desde);
  return (
    <div className="csf">
      <div className="csf-h">
        <div className="csf-hl">
          <p className="csf-t">El recorrido del lead</p>
          <p className="csf-m">
            Cada barra es sobre los {r.cohorte} que entraron
            {desde ? ` · desde el ${desde}` : ''}
          </p>
          {/* ── EL MATIZ DE LA FECHA NO SE ESCONDE DETRÁS DE UN ÍCONO ────────
              Es la única nota de esta pantalla que corrige al renglón que tiene encima: dice que la
              fecha de ahí arriba describe a un contacto suelto y no a la cohorte. Puesta en un
              ícono, la fecha engañosa se queda sola en pantalla, que es el defecto entero. Aparece
              sólo cuando hace falta — hoy, únicamente en «Completo». */}
          {r.avisoDeLaVentana ? <p className="csf-m cs-cola">{r.avisoDeLaVentana}</p> : null}
        </div>
        {/* EL número de la pestaña (§9.3). Va arriba a la derecha y es lo único de 26 px que hay:
            una pantalla donde todo es grande no tiene titular. */}
        <div className="csf-key">
          <b>{r.bookingRate === null ? '—' : `${r.bookingRate} %`}</b>
          <span>
            agendaron · {r.agendaron} de {r.cohorte}
            {/* Éste SÍ va al ícono: no corrige a la cifra —la cifra está bien— sino que dice que su
                numerador y el de la cancelación de abajo no son la misma población. Es un matiz
                sobre un denominador, que es exactamente para lo que existe `Nota`. */}
            <Nota texto={r.avisoDelBooking} />
          </span>
        </div>
      </div>

      <div className="csf-chain">
        <Eslabon
          nombre="Entraron al CRM"
          valor={r.cohorte}
          parte={r.cohorte}
          total={r.cohorte}
          pie="100 %"
          nota="La cohorte se arma por la fecha de entrada AL CRM, no por cuándo la vio este sistema. Antes se armaba con lo segundo, que en la carga inicial es la misma fecha para todos."
        />
        <Eslabon
          nombre="Les escribimos"
          valor={r.escritos}
          parte={r.escritos}
          total={r.cohorte}
          pie={porciento(r.escritos, r.cohorte)}
          nota={
            r.sinNingunMensaje > 0
              ? `${r.sinNingunMensaje} no recibieron ningún mensaje nuestro. No entran en la tasa de respuesta —no pudieron contestar— pero sí en el booking rate, que no depende de que les escribamos.`
              : null
          }
        />
        <Eslabon
          nombre="Respondieron"
          valor={r.respondieron}
          parte={r.respondieron}
          total={r.cohorte}
          pie={porciento(r.respondieron, r.cohorte)}
          nota="Mide si el contacto contestó, NO a quién: todavía no se distingue un mensaje del agente de uno de un flujo del CRM. Sobre los que sí recibieron mensaje la tasa es otra, y está en la fila de abajo."
        />
      </div>

      {/* ── LA BIFURCACIÓN, QUE NO ES UN CUARTO ESLABÓN ────────────────────
          Ver la cabecera del archivo: sólo 64 de los 121 que agendaron habían contestado. Una barra
          de 138 a 121 afirmaría que convirtieron 121 de 138 — casi el doble de lo real, con los
          cuatro números correctos. Los dos renglones de acá suman `agendaron` exactamente, y las
          dos barras juntas llenan la fila: eso es lo que hay que poder comprobar de un vistazo. */}
      <div className="org-split">
        <p className="org-h">
          De los <b>{r.agendaron}</b> que agendaron — <em>cómo llegaron a la cita</em>
        </p>
        <div className="org-r">
          <span>Después de contestarnos</span>
          <b className="org-v">{r.agendaronTrasResponder}</b>
          <span className="org-b">
            <i style={{ width: ancho(r.agendaronTrasResponder, r.agendaron) }} />
          </span>
          <span className="org-p">
            {porciento(r.agendaronTrasResponder, r.respondieron)} de los que contestaron
          </span>
        </div>
        <div className="org-r">
          <span>Se agendaron solos</span>
          <b className="org-v">{r.agendaronSinResponder}</b>
          <span className="org-b">
            <i style={{ width: ancho(r.agendaronSinResponder, r.agendaron) }} />
          </span>
          <span className="org-p">sin contestar nunca</span>
        </div>
      </div>

      <p className="csf-foot">
        La cadena <b>se corta en «respondieron»</b> a propósito: agendar no exige haber contestado
        —el enlace del calendario no obliga a conversar— así que una flecha de un escalón al otro
        diría algo falso con números correctos.
      </p>
    </div>
  );
}

/**
 * Qué pasó con las citas (§10.3), con el KPI principal dibujado como el hueco que es.
 *
 * ── EL TITULAR ES UN GUION, Y ESO ES DELIBERADO ────────────────────────────
 *
 * El § 10.3 pide la tasa de asistencia. Medido: `citas.asistio` está en 0 de 317 y el estado
 * `showed` del CRM también. No hay vía. La tentación era ascender la cancelación a titular, porque
 * es la cifra que sí hay — y eso dejaría la pestaña con un número grande donde falta otro, sin que
 * nadie se entere de que el que el documento pide no está.
 *
 * Así que el titular es el guion, con el conteo al lado que dice POR QUÉ está vacío. Es el mismo
 * criterio que el servidor ya aplica en `tasaDeAsistencia`, subido al lugar donde se ve.
 */
function Citas({ c }) {
  const desde = fechaCorta(c.desde);
  const noCanceladas = c.citas - c.canceladas;
  return (
    <div className="csf">
      <div className="csf-h">
        <div className="csf-hl">
          <p className="csf-t">Qué pasó con las citas</p>
          <p className="csf-m">
            Cada barra es sobre las {c.citas} del período
            {desde ? ` · desde el ${desde}` : ''}
          </p>
          {/* Hoy nunca se enciende —la historia de citas no tiene cola— y se dibuja igual, por lo
              mismo que existe del otro lado: el día que le llegue una cita vieja suelta, la fecha de
              arriba deja de describir a la ventana sin que nada falle. */}
          {c.avisoDeLaVentana ? <p className="csf-m cs-cola">{c.avisoDeLaVentana}</p> : null}
        </div>
        <div className="csf-key falta">
          <b>{c.tasaDeAsistencia === null ? '—' : `${c.tasaDeAsistencia} %`}</b>
          <span>
            asistencia · {c.conAsistencia} de {c.citas} cerradas
          </span>
        </div>
      </div>

      <div className="csf-chain">
        <Eslabon
          nombre="Citas del período"
          valor={c.citas}
          parte={c.citas}
          total={c.citas}
          pie="100 %"
          nota={
            c.descartados.citas > 0
              ? `No se cuentan ${c.descartados.citas} cita(s) de contactos que la empresa ya había rechazado${c.descartados.tasa === null ? '' : `, que cancelan el ${c.descartados.tasa} %`}. Ésas las cancela el flujo de descarte, no el lead: sumarlas le atribuiría al negocio el trabajo de su propio filtro.`
              : null
          }
        />
        <Eslabon
          nombre="Siguieron en pie"
          valor={noCanceladas}
          parte={noCanceladas}
          total={c.citas}
          pie={porciento(noCanceladas, c.citas)}
        />
        {/* El eslabón que el documento pide y que no se puede medir. Se dibuja igual, vacío: sacarlo
            haría que la cadena termine en «siguieron en pie» y que nadie note que falta el final. */}
        <Eslabon
          nombre="Se presentaron"
          valor={c.sePresentaron > 0 ? c.sePresentaron : null}
          parte={c.sePresentaron}
          total={c.citas}
          pie={c.conAsistencia === 0 ? 'nadie lo registró' : `sobre ${c.conAsistencia} cerradas`}
        />
      </div>

      <div className="org-split">
        <p className="org-h">
          Las salidas antes de la llamada — <em>sobre las {c.citas} del período</em>
        </p>
        <div className="org-r">
          <span>Canceladas</span>
          <b className="org-v">{c.canceladas}</b>
          <span className="org-b">
            <i style={{ width: ancho(c.canceladas, c.citas) }} />
          </span>
          <span className="org-p">{c.tasa === null ? '—' : `${c.tasa} %`}</span>
        </div>
        <div className="org-r">
          <span>Reagendadas</span>
          <b className="org-v">{c.reagendadas}</b>
          <span className="org-b">
            <i style={{ width: ancho(c.reagendadas, c.citas) }} />
          </span>
          <span className="org-p">
            {c.tasaDeReagendamiento === null ? '—' : `${c.tasaDeReagendamiento} %`}
          </span>
        </div>
      </div>

      {/* El aviso de la asistencia se queda VISIBLE, no va a un ícono: dice que el dato no existe
          todavía, y eso no es un matiz de la cifra — es la cifra. Ver `Nota`. */}
      <Nota texto={c.avisoDeAsistencia} grave />
      <Nota texto={c.aviso} grave />
    </div>
  );
}

/**
 * De dónde vinieron los leads, con la misma fila de la cadena.
 *
 * Reusa `.csr` y no una tabla propia: es exactamente el mismo objeto —nombre, valor, barra,
 * porcentaje— y con dos formas distintas para lo mismo la pantalla se lee como dos pantallas. La
 * `.cs-tabla` que había acá no tenía columna de barra, así que dos fuentes con 12 y 47 agendados se
 * veían igual de importantes.
 */
function Atribucion({ a }) {
  const hay = a.porFuente.length > 0 || a.porCampana.length > 0;
  if (!hay && a.fueraDeHorario === null) return null;

  return (
    <div className="csf">
      <div className="csf-h">
        <div className="csf-hl">
          <p className="csf-t">De dónde vinieron</p>
          <p className="csf-m">Cada fuente con su propia cohorte y su propia tasa</p>
        </div>
      </div>
      <Corte titulo="Por fuente" filas={a.porFuente} />
      <Corte titulo="Por campaña" filas={a.porCampana} />

      {/* ── LA ADVERTENCIA DEL HORARIO, QUE NO ES UNA TASA ──────────────────
          Es lo único que la zona horaria del lead habilita, y no existía: la única zona que este
          sistema conocía era la de la EMPRESA, así que un «primer contacto a las 9» podía estar
          saliendo a las 3 de la madrugada del lead. Va con su denominador al lado porque la mitad
          de los contactos no trae zona. */}
      {a.fueraDeHorario ? (
        <p className="csf-foot">
          <b>{a.fueraDeHorario.contactos}</b> de {a.fueraDeHorario.sobre} primeros mensajes salieron
          antes de las 8 o después de las 21 <b>en la hora del contacto</b>
          <Nota texto="Sólo se puede medir en los contactos que traen zona horaria; el resto no entra ni como dentro ni como fuera." />
        </p>
      ) : null}

      <Nota texto={a.aviso} grave />
    </div>
  );
}

/** Un corte, con sus filas. Vacío no dibuja nada: un título sin tabla se lee como un error. */
function Corte({ titulo, filas }) {
  if (filas.length === 0) return null;
  /* La barra de cada fila se mide contra la cohorte MÁS GRANDE del corte y no contra el total de la
     pantalla: es lo que hace comparables entre sí a las fuentes, que es la única pregunta que esta
     tabla contesta. Con el total del período, la fuente chica quedaría en un pelo invisible. */
  const mayor = filas.reduce((m, f) => Math.max(m, f.cohorte), 0);
  return (
    <div className="csf-chain">
      <p className="org-h">{titulo}</p>
      {filas.map((f) => (
        <Eslabon
          key={f.etiqueta}
          nombre={f.etiqueta}
          valor={f.cohorte}
          parte={f.cohorte}
          total={mayor}
          menor={f.esElResto}
          /* Sin tasa se dibuja una raya y NO un «0 %»: la fila junta categorías distintas y un
             porcentaje sobre ellas no describe a ninguna. El conteo sí va. */
          pie={f.tasa === null ? `${f.agendaron} agendaron` : `${f.tasa} % · ${f.agendaron}`}
        />
      ))}
    </div>
  );
}

/**
 * El consumo del video precall (§10.6).
 *
 * ── EL RÓTULO ES LO MÁS IMPORTANTE DE ESTE COMPONENTE ──────────────────────
 *
 * Dice **«el CRM registró reproducción»** y no «vio el video», y la diferencia no es de estilo.
 * Medido: el valor lo escribe el CRM AL AGENDAR —las 13 citas futuras ya lo tienen puesto, 11 de
 * ellas en «sin reproducción»— y 9 de los 20 contactos que sí clicaron el link lo tienen todavía en
 * su valor inicial. Con el rótulo equivocado, dos tercios de los leads quedan acusados de ignorar un
 * video cuando parte de eso es un medidor que no reportó.
 */
function Precall({ p }) {
  if (p.sobre === 0 && p.aviso === null) return null;
  return (
    <>
      {/* El `extra` del encabezado SÓLO cuando el desglose ocupa las tres celdas. Sin él, la celda
          de «llegaron a la llamada» y el encabezado decían el mismo número con otras palabras —visto
          en el navegador— y dos veces el mismo dato invita a buscar la diferencia que no hay. */}
      <Panel
        titulo="El video previo a la llamada"
        extra={p.detalleSePublica ? `${p.sobre} llegaron a la llamada` : null}
        columnas={p.detalleSePublica ? 3 : 2}
      >
        <Dato
          rotulo="Registró reproducción"
          valor={p.tasa === null ? null : `${p.tasa} %`}
          detalle={`${p.registraron} de ${p.conCampo - p.sinRama} clasificados`}
          nota="Se cuenta sobre quienes llegaron a su llamada: las citas futuras y las canceladas no entran. El CRM escribe este campo al agendar, así que una cita que todavía no ocurrió ya figura como «sin reproducción» sin que eso signifique nada."
        />
        {/* El desglose fino sólo aparece cuando SUS DOS ramas pasan el piso. Hoy no: son 6 y 3, y
            publicarlos invita a comparar dos números que se mueven treinta puntos por contacto. */}
        {p.detalleSePublica ? (
          <>
            <Dato rotulo="Vio parte" valor={String(p.parcial)} detalle="contactos" />
            <Dato rotulo="Lo completó" valor={String(p.completo)} detalle="contactos" />
          </>
        ) : (
          <Dato
            rotulo="Llegaron a la llamada"
            valor={String(p.sobre)}
            detalle="contactos del período"
          />
        )}
      </Panel>
      <Nota texto={p.aviso} grave />
    </>
  );
}

/**
 * Cómo estaba el contacto en las conversaciones que el auditor juzgó.
 *
 * ── TRES CEROS DEJARON DE SER TRES TARJETAS ────────────────────────────────
 *
 * Esto dibujaba tres cifras grandes en cero encima de un párrafo que explicaba que no eran ceros
 * —el auditor no había juzgado nada todavía— y era lo PRIMERO que se veía al abrir Lead Flow. Tres
 * ceros grandes son una afirmación sobre el negocio: «ningún contacto quedó molesto». Ahora, sin
 * conversaciones juzgadas, es una línea que dice que no hay nada juzgado.
 *
 * ── Y SE ROTULA COMO CONVERSACIONES, NUNCA COMO PERSONAS ───────────────────
 *
 * La fila de la base es por `(contacto, agente, analizado_el)` y el transcript puede llegar
 * recortado a las últimas 40 líneas: el modelo etiqueta UN TRAMO, no una historia. Dibujarlo como
 * una insignia junto al nombre de alguien convertiría un pedazo de chat en un atributo permanente
 * de una persona — y medido, hay contactos con dos análisis cuyo sentimiento difiere.
 */
function Sentimiento({ s }) {
  if (s.juzgadas === 0) {
    return s.aviso ? <Nota texto={s.aviso} grave /> : null;
  }
  return (
    <>
      <Panel titulo="Cómo estaban los contactos" extra={`${s.juzgadas} conversaciones juzgadas`} columnas={3}>
        {/* El MOLESTO primero y con porcentaje, los otros dos como conteo: es el único accionable
            —un contacto molesto es una conversación que alguien tiene que mirar, y un positivo no
            pide nada—. Con tres porcentajes, el que decide qué hacer se pierde entre dos que no. */}
        <Dato
          rotulo="Quedaron molestos"
          valor={s.molestos === null ? null : `${s.molestos} %`}
          detalle={`${s.porValor.molesto} de ${s.juzgadas}`}
          nota="Es el sentimiento de LA CONVERSACIÓN juzgada, no del contacto: el auditor etiqueta un tramo del chat en un momento, y el mismo contacto puede volver a ser juzgado con otro resultado."
        />
        <Dato rotulo="Neutrales" valor={String(s.porValor.neutral)} detalle="conversaciones" />
        <Dato rotulo="Positivas" valor={String(s.porValor.positivo)} detalle="conversaciones" />
      </Panel>
      <Nota texto={s.aviso} grave />
    </>
  );
}

/**
 * Un flujo: su tablero arriba y la lista de lo que todavía no se puede medir abajo.
 *
 * ── EL ORDEN ES LO MEDIDO PRIMERO, Y ANTES NO LO ERA ──────────────────────
 *
 * Lo primero que se veía en Lead Flow era el bloque de sentimiento con tres ceros, y el KPI del
 * § 9.3 aparecía tercero. Ahora el recorrido —que es lo que la pestaña existe para mostrar— abre, y
 * las cifras de apoyo van después. Lo que falta cierra: una pestaña que abre con sus huecos se lee
 * como vacía y nadie llega al número.
 *
 * ── EL FRENO DE LA EMPRESA LLEGA HASTA ACÁ ─────────────────────────────────
 *
 * Esta pantalla afirmaba, sin condición, que *«sus hallazgos ya se ven en la pestaña Auditoría»*. Es
 * falso para casi toda la flota: **medido el 2026-09-14, de las 12 empresas activas sólo 4 tienen la
 * llave de IA y sólo 1 tiene el identificador del agente en el CRM.** En las demás la pestaña de
 * Auditoría está vacía, y esta línea mandaba a mirarla como si ahí hubiera algo.
 */
function Flujo({
  flujo,
  cargando,
  error,
  noAudita,
  cancelacion,
  respuesta,
  atribucion,
  precall,
  sentimiento,
}) {
  const hayCifras = cancelacion || respuesta || atribucion || precall;

  return (
    <div className="cs-view">
      <p className="aud-alcance">
        <b>{flujo.titulo}.</b> {flujo.mision} Lo supervisa el agente <b>{flujo.agente}</b>
        {noAudita ? '.' : (
          <>
            , y sus hallazgos ya se ven en la pestaña <b>Auditoría</b>.
          </>
        )}
      </p>

      {/* El freno de la empresa, con las palabras que ya usa la pestaña de Auditoría: si las dos
          pantallas lo dijeran distinto, se leerían como dos problemas. */}
      {noAudita ? (
        <div className="aud-aviso">
          <strong>Esta empresa todavía no audita.</strong>{' '}
          {POR_QUE_NO_AUDITA[noAudita] ?? 'Falta configurar el auditor.'}
        </div>
      ) : null}

      {/* El error de red va ARRIBA y no reemplaza nada: las cifras que están dibujadas siguen siendo
          ciertas, sólo que de hace un minuto. Ver `cargar`. */}
      {error ? <p className="cs-grave">{error}</p> : null}
      {cargando && !hayCifras ? <p className="cs-cargando">Midiendo…</p> : null}

      {respuesta ? <Recorrido r={respuesta} /> : null}
      {respuesta ? (
        <Panel titulo="Cuánto se tarda" columnas={4}>
          <Dato
            rotulo="Respondieron"
            valor={respuesta.tasa === null ? null : `${respuesta.tasa} %`}
            detalle={`${respuesta.respondieron} de ${respuesta.escritos} escritos`}
            nota="Su denominador NO es la cohorte: son los que recibieron un mensaje. En la cadena de arriba el mismo número está medido sobre el total, y por eso el porcentaje es otro."
          />
          <Dato
            rotulo="Tardamos en escribir"
            valor={enMinutos(respuesta.hastaElPrimerIntento?.p50)}
            detalle={
              respuesta.hastaElPrimerIntento
                ? `9 de 10 antes de ${enMinutos(respuesta.hastaElPrimerIntento.p90)}`
                : null
            }
            nota="Mediana y no promedio: medido, el promedio es 30 veces la mediana porque una sola conversación de dos días y medio lo arrastra entero."
          />
          <Dato
            rotulo="Tardan en contestar"
            valor={enMinutos(respuesta.hastaLaPrimeraRespuesta?.p50)}
            /* El p90 va al lado y no escondido: medido, es 61 veces la mediana. Una tarjeta que
               dijera sólo «6 min» describiría un negocio distinto del real. */
            detalle={
              respuesta.hastaLaPrimeraRespuesta
                ? `9 de 10 antes de ${enMinutos(respuesta.hastaLaPrimeraRespuesta.p90)}`
                : null
            }
            nota={respuesta.avisoDeLatencias}
          />
          <Dato
            rotulo="Esperan respuesta"
            valor={String(respuesta.escritosSinContestar)}
            detalle="recibieron y no contestaron"
          />
        </Panel>
      ) : null}
      {atribucion ? <Atribucion a={atribucion} /> : null}

      {cancelacion ? <Citas c={cancelacion} /> : null}
      {cancelacion ? (
        <Panel titulo="Lo que dice el CRM y lo que dice el closer" columnas={3}>
          <Dato
            rotulo="Confirmaron"
            valor={
              cancelacion.tasaDeConfirmacion === null
                ? null
                : `${cancelacion.tasaDeConfirmacion} %`
            }
            detalle={`${cancelacion.confirmaron} de ${cancelacion.conConfirmacion} contactos`}
            nota="Ésta SÍ sale del CRM, al revés que la asistencia: es un campo que el contacto o un flujo responde. Su denominador son CONTACTOS con cita —el campo vive en el contacto—, no citas."
          />
          <Dato
            rotulo="Se reserva con"
            valor={enTiempo(cancelacion.horasHastaLaCita)}
            detalle={`sobre ${cancelacion.conFechaDeReserva} de ${cancelacion.citas}`}
            nota="Su propio denominador, y no el de las tasas: las citas anteriores a que se guardara la fecha de reserva no entran acá pero sí en las demás."
          />
          <Dato
            rotulo="No-show"
            /* Un CONTEO y no una tasa, a propósito: son dos eventos en catorce días, y una tasa
               sobre dos eventos se mueve cincuenta puntos con el próximo registro. */
            valor={String(cancelacion.noShowReportado)}
            detalle="reportados por el closer"
            nota="El no-show y la asistencia los reporta el closer al cerrar el intento, no el calendario: los campos de asistencia del CRM estaban vacíos en las 316 citas que había al medirlo, en septiembre de 2026."
          />
        </Panel>
      ) : null}
      {precall ? <Precall p={precall} /> : null}
      {cancelacion ? <Nota texto={cancelacion.avisoDeConfirmacion} grave /> : null}

      {sentimiento ? <Sentimiento s={sentimiento} /> : null}

      {/* ── LO QUE FALTA, PLEGADO ──────────────────────────────────────────
          Tres párrafos largos abiertos debajo de un tablero vuelven a ser el problema que este
          rediseño cerró. Plegado sigue estando —el resumen dice cuántos son— y quien quiera el
          detalle lo abre. Un `<details>` nativo y no un estado de React: se abre sin JavaScript y el
          teclado lo maneja solo. */}
      <details className="cs-falta-caja">
        <summary>
          Lo que todavía no se puede medir <span>{flujo.falta.length}</span>
        </summary>
        <ul className="cs-falta">
          {flujo.falta.map(([que, porQue]) => (
            <li key={que}>
              <b>{que}</b>
              <span>{porQue}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
