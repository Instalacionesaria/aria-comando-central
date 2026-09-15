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

   ── LAS DOS PESTAÑAS DE FLUJO TODAVÍA NO MIDEN, Y LO DICEN ────────────────

   Aquí había un módulo del maquetado —`lib/aios/conversation.js`, 559 líneas— que dibujaba estas
   dos pestañas con **datos inventados**: un embudo completo, cuatro agentes con nombre propio,
   seis incidencias con diagnósticos que imitaban a un supervisor de IA, y un bloque «Qué corregir»
   que era lo mismo que hace Auditoría pero de mentira. Se borró entero.

   Lo que queda en su lugar no es un «pendiente»: es **qué dato falta y por qué**, que es el § 2.6
   del documento (*«Qué dato falta, cuando no existe evidencia suficiente»*). Un número inventado en
   el hueco es peor que el hueco — se lee, se cree, y se decide con él.
   ========================================================================= */

import { useCallback, useEffect, useState } from 'react';

import { Cuerpo } from '../auditoria/PanelDeAuditoria.jsx';
import { POR_QUE_NO_AUDITA, agruparPorPatron, leerLaPantalla } from '@/lib/auditor/vista';

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
      ['El histórico de las tasas por período', 'La cita ya guarda cuándo se reservó, pero solo desde que empezó a guardarse: las anteriores tienen el dato vacío y NO se van a llenar solas —el barrido mira una ventana de días alrededor de hoy y no vuelve a pasar por las viejas—. Hasta que haya historia, un «últimos 90 días» cuenta de menos sin avisar.'],
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
      ['La asistencia según el CALENDARIO', 'El CRM tiene sus campos «asistió» y «no apareció» y están vacíos: 3 citas de 1052 en un año. La cifra que sí se muestra la reporta el closer al cerrar el intento, o sea una persona — así que mide lo que alguien registró, no lo que el calendario observó, y un intento que nadie cierra no aparece en ninguna de las dos.'],
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
  const [pantalla, setPantalla] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  /* Qué patrón está abierto. Se guarda el CÓDIGO y no un índice: la lista se reordena al recargar
     —el orden es por cantidad de casos— y con un índice quedaría abierto otro patrón. */
  const [abierto, setAbierto] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    const r = await leerLaPantalla();
    if (r.tipo === 'datos') setPantalla(r.pantalla);
    else {
      setError(r.mensaje);
      setPantalla(null);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

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
            {s.clave === 'auditoria' && abiertos > 0 ? <span className="cnt">{abiertos}</span> : null}
            {s.clave === 'prompts' && sinPrompt > 0 ? (
              <span className="cnt aud-cnt-falta">{sinPrompt}</span>
            ) : null}
          </button>
        ))}
      </div>

      {FLUJOS[sub] ? (
        <Flujo
          flujo={FLUJOS[sub]}
          noAudita={pantalla?.noAudita ?? null}
          cancelacion={sub === 'appflow' ? (pantalla?.cancelacion ?? null) : null}
          precall={sub === 'appflow' ? (pantalla?.precall ?? null) : null}
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
 * La tasa de cancelación, con lo que quedó afuera.
 *
 * ── LA REGLA DE SILENCIO, QUE ES LO QUE HACE QUE EL AVISO SIGNIFIQUE ALGO ──
 *
 * `c.aviso` es `null` cuando no hay nada que advertir, y entonces **acá no se dibuja nada**. Es la
 * misma forma que ya usa la frescura del barrido, y la eligió una medición: una fracción de
 * cobertura puesta siempre —«184 de 316»— sería una advertencia permanente encima de una cifra
 * correcta, y un aviso que aparece siempre se aprende a ignorar.
 *
 * Y `tasa` nula **no se dibuja como 0 %**: un cero con cero citas afirma «no se cancela ninguna»,
 * que es una afirmación sobre el negocio hecha sin datos. Se dibuja el guion que esta aplicación ya
 * usa para «no se sabe», y el motivo va en el aviso.
 */
function Cifra({ titulo, valor, detalle }) {
  return (
    <div className="cs-cifra-uno">
      <p className="cs-cifra-cab">
        <b>{titulo}</b>
      </p>
      <p className="cs-cifra-valor">
        {valor === null ? '—' : valor}
        {detalle && valor !== null ? <small>{detalle}</small> : null}
      </p>
    </div>
  );
}

/** Horas a algo que se lee: «2,1 días» dice más que «49,2 h» cuando pasa de un día. */
function enTiempo(horas) {
  if (horas === null) return null;
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

function Lead({ r }) {
  return (
    <div className="cs-cifra">
      <p className="cs-cifra-titulo">
        Leads que entraron al CRM <span>últimos {r.dias} días</span>
      </p>

      <div className="cs-cifra-fila">
        {/* El KPI principal del flujo (§9.3), y va primero: es lo que la pestaña existe para
            mostrar. Estuvo bloqueado hasta que `alta_en_el_crm` dio una cohorte que no dependiera
            del territorio — el territorio es consecuencia de agendar, no una cohorte. */}
        <Cifra
          titulo="Agendaron"
          valor={r.bookingRate === null ? null : `${r.bookingRate} %`}
          detalle={`${r.agendaron} de ${r.cohorte}`}
        />
        <Cifra
          titulo="Respondieron"
          valor={r.tasa === null ? null : `${r.tasa} %`}
          /* Su denominador NO es el de la izquierda: son los que recibieron un mensaje. Por eso el
             detalle lo dice con palabras en vez de repetir la cohorte. */
          detalle={`${r.respondieron} de ${r.escritos} escritos`}
        />
        <Cifra
          titulo="Tardamos en escribir"
          valor={enMinutos(r.hastaElPrimerIntento?.p50)}
          detalle={
            r.hastaElPrimerIntento
              ? `9 de cada 10, antes de ${enMinutos(r.hastaElPrimerIntento.p90)}`
              : 'sin datos'
          }
        />
        <Cifra
          titulo="Tardan en contestar"
          valor={enMinutos(r.hastaLaPrimeraRespuesta?.p50)}
          /* El p90 va en el detalle y no escondido: medido, es 61 veces la mediana. Una tarjeta que
             dijera sólo «6 min» describiría un negocio distinto del real. */
          detalle={
            r.hastaLaPrimeraRespuesta
              ? `9 de cada 10, antes de ${enMinutos(r.hastaLaPrimeraRespuesta.p90)}`
              : 'sin datos'
          }
        />
      </div>

      {/* Los dos conteos van abajo y como texto, no como tarjetas: son números chicos sobre una
          cohorte grande, y una tarjeta grande les daría un peso que no tienen. */}
      <p className="cs-cifra-nota">
        {r.sinNingunMensaje > 0 ? (
          <>
            <b>{r.sinNingunMensaje}</b> no recibieron ningún mensaje nuestro y{' '}
          </>
        ) : null}
        <b>{r.escritosSinContestar}</b> recibieron y todavía no contestaron.
      </p>

      {/* ── LO QUE ESTA CIFRA NO ES, Y HAY QUE DECIRLO ──────────────────────
          Mide si el CONTACTO contestó, no si contestó AL AGENTE: el sistema todavía no distingue
          un mensaje del agente de uno de un flujo del CRM. Sin esta línea, alguien la lee como el
          rendimiento del agente y decide con ella. */}
      <p className="cs-cifra-nota">
        Mide si el contacto contestó, <b>no a quién</b>: todavía no se distingue un mensaje del
        agente de uno de un flujo del CRM. Esa cifra más fina está en la lista de abajo.
      </p>
      {/* Y la cota que la migración `048` dejó escrita: estas columnas no tienen relleno hacia
          atrás, así que la cohorte empieza el día que el barrido las pobló. Una pantalla que dice
          «últimos 14 días» sobre datos que empiezan hace tres semanas miente por omisión. */}
      <p className="cs-cifra-nota">
        La cohorte se arma por la fecha de entrada <b>al CRM</b>, no por cuándo la vio este sistema.
        Antes se armaba con lo segundo, que en la carga inicial es la misma fecha para todos.
      </p>
      {r.avisoDeLatencias ? <p className="cs-cifra-nota">{r.avisoDeLatencias}</p> : null}
      {r.aviso ? <p className="cs-cifra-nota">{r.aviso}</p> : null}
    </div>
  );
}

/**
 * De dónde vinieron los leads. **Una tabla y no cuatro tarjetas**, y la diferencia importa.
 *
 * Las tarjetas de arriba son cifras de la cohorte entera. Esto es la misma cohorte partida, y cada
 * fila tiene su propio denominador — dibujarlas como tarjetas sueltas invitaría a compararlas con
 * las de arriba, que hablan de otra población.
 */
function Atribucion({ a }) {
  const hay = a.porFuente.length > 0 || a.porCampana.length > 0;
  if (!hay && a.fueraDeHorario === null) return null;

  return (
    <div className="cs-cifra">
      <p className="cs-cifra-titulo">
        De dónde vinieron <span>últimos {a.dias} días</span>
      </p>

      <Corte titulo="Por fuente" filas={a.porFuente} />
      <Corte titulo="Por campaña" filas={a.porCampana} />

      {/* ── LA ADVERTENCIA DEL HORARIO, QUE NO ES UNA TASA ──────────────────
          Es lo único que la zona horaria del lead habilita, y no existía: la única zona que este
          sistema conocía era la de la EMPRESA, así que un «primer contacto a las 9» podía estar
          saliendo a las 3 de la madrugada del lead. Va con su denominador al lado porque la mitad
          de los contactos no trae zona. */}
      {a.fueraDeHorario ? (
        <p className="cs-cifra-nota">
          <b>{a.fueraDeHorario.contactos}</b> de {a.fueraDeHorario.sobre} primeros mensajes salieron
          antes de las 8 o después de las 21 <b>en la hora del contacto</b>. Sólo se puede medir en
          los que traen zona horaria; el resto no entra ni como dentro ni como fuera.
        </p>
      ) : null}

      {a.aviso ? <p className="cs-cifra-nota">{a.aviso}</p> : null}
    </div>
  );
}

/** Un corte, con sus filas. Vacío no dibuja nada: un título sin tabla se lee como un error. */
function Corte({ titulo, filas }) {
  if (filas.length === 0) return null;
  return (
    <>
      <p className="cs-cifra-nota">
        <b>{titulo}</b>
      </p>
      <div className="cs-tabla">
        {filas.map((f) => (
          <div key={f.etiqueta} className="cs-tabla-fila">
            <span className={f.esElResto ? 'cs-tabla-resto' : ''}>{f.etiqueta}</span>
            {/* Sin tasa se dibuja una raya y NO un «0 %»: la fila junta categorías distintas y un
                porcentaje sobre ellas no describe a ninguna. El conteo sí va. */}
            <b>{f.tasa === null ? '—' : `${f.tasa} %`}</b>
            <span>
              {f.agendaron} de {f.cohorte}
            </span>
          </div>
        ))}
      </div>
    </>
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
    <div className="cs-cifra">
      <p className="cs-cifra-titulo">
        El video previo a la llamada <span>últimos {p.dias} días</span>
      </p>

      <div className="cs-cifra-fila">
        <Cifra
          titulo="Registró reproducción"
          valor={p.tasa === null ? null : `${p.tasa} %`}
          detalle={`${p.registraron} de ${p.conCampo - p.sinRama} clasificados`}
        />
        {/* El desglose fino sólo aparece cuando SUS DOS ramas pasan el piso. Hoy no: son 6 y 3, y
            publicarlos invita a comparar dos números que se mueven treinta puntos por contacto. */}
        {p.detalleSePublica ? (
          <>
            <Cifra titulo="Vio parte" valor={String(p.parcial)} detalle="contactos" />
            <Cifra titulo="Lo completó" valor={String(p.completo)} detalle="contactos" />
          </>
        ) : null}
        <Cifra titulo="Llegaron a la llamada" valor={String(p.sobre)} detalle="contactos" />
      </div>

      <p className="cs-cifra-nota">
        Se cuenta sobre quienes <b>llegaron a su llamada</b>: las citas futuras y las canceladas no
        entran. El CRM escribe este campo al agendar, así que una cita que todavía no ocurrió ya
        figura como «sin reproducción» sin que eso signifique nada.
      </p>
      {p.aviso ? <p className="cs-cifra-nota">{p.aviso}</p> : null}
    </div>
  );
}

function Cancelacion({ c }) {
  return (
    <div className="cs-cifra">
      <p className="cs-cifra-titulo">
        Qué pasó con las citas <span>últimos {c.dias} días</span>
      </p>

      <div className="cs-cifra-fila">
        <Cifra
          titulo="Cancelación"
          valor={c.tasa === null ? null : `${c.tasa} %`}
          detalle={`${c.canceladas} de ${c.citas}`}
        />
        <Cifra
          titulo="Reagendadas"
          valor={c.tasaDeReagendamiento === null ? null : `${c.tasaDeReagendamiento} %`}
          detalle={`${c.reagendadas} de ${c.citas}`}
        />
        <Cifra
          titulo="Se reserva con"
          valor={enTiempo(c.horasHastaLaCita)}
          /* Su propio denominador, y no el de las otras dos: las citas anteriores a que se guardara
             la fecha de reserva no entran acá pero sí en las tasas. Decirlo evita que alguien lea
             las tres como si hablaran de las mismas filas. */
          detalle={`sobre ${c.conFechaDeReserva} de ${c.citas}`}
        />
        <Cifra
          titulo="No-show"
          /* Un CONTEO y no una tasa, a propósito: son dos eventos en catorce días, y una tasa sobre
             dos eventos se mueve cincuenta puntos con el próximo registro. */
          valor={String(c.noShowReportado)}
          detalle="reportados"
        />
        <Cifra
          titulo="Se presentaron"
          /* `null` hasta que haya suficientes respuestas, y entonces se dibuja el hueco con el
             aviso al lado — nunca un 0 %, que afirmaría que no viene nadie. El denominador NO son
             las citas: son las que alguien cerró. */
          valor={c.tasaDeAsistencia === null ? null : `${c.tasaDeAsistencia} %`}
          detalle={`${c.sePresentaron} de ${c.conAsistencia} respondidas`}
        />
        <Cifra
          titulo="Confirmaron"
          /* Ésta SÍ sale del CRM, al revés que las dos de al lado: es un campo que el contacto o un
             flujo responde. Su denominador son CONTACTOS con cita —el campo vive en el contacto— y
             por eso el detalle dice «contactos» y no «citas»: son cosas distintas y la tarjeta está
             al lado de tres que cuentan citas. */
          valor={c.tasaDeConfirmacion === null ? null : `${c.tasaDeConfirmacion} %`}
          detalle={`${c.confirmaron} de ${c.conConfirmacion} contactos`}
        />
      </div>

      {/* ── POR QUÉ ESTA CIFRA ES MÁS BAJA QUE LA QUE ALGUIEN RECUERDA ──────
          Medido: casi la mitad de las citas del período son de contactos que la empresa MISMA
          descartó, y cancelan al 94 % porque su propio flujo las cancela. Sumadas daban 62,7 %
          donde el negocio tiene 33,3 %. Esta línea existe para que el cambio no se lea como que
          algo mejoró solo — y para que nadie vaya a buscar las citas que «faltan». */}
      {c.descartados.citas > 0 ? (
        <p className="cs-cifra-nota">
          No se cuentan <b>{c.descartados.citas}</b> cita(s) de contactos que ya habían sido
          rechazados{c.descartados.tasa === null ? '' : `, que cancelan el ${c.descartados.tasa} %`}
          . Ésas las cancela el flujo de descarte de la empresa, no el lead: sumarlas le atribuiría
          al negocio el trabajo de su propio filtro.
        </p>
      ) : null}

      <p className="cs-cifra-nota">
        El no-show y la asistencia los <b>reporta el closer</b> al cerrar el intento, no el
        calendario: los campos de asistencia del CRM están vacíos en las 316 citas.
      </p>
      {/* Su aviso va aparte del de abajo: éste va a estar encendido durante semanas —la asistencia
          se empezó a registrar hoy— y compartir el renglón apagaría por costumbre el de las citas
          congeladas, que sí es excepcional. */}
      {c.avisoDeAsistencia ? <p className="cs-cifra-nota">{c.avisoDeAsistencia}</p> : null}
      {c.avisoDeConfirmacion ? <p className="cs-cifra-nota">{c.avisoDeConfirmacion}</p> : null}
      {c.aviso ? <p className="cs-cifra-nota">{c.aviso}</p> : null}
    </div>
  );
}

/**
 * Un flujo que todavía no mide, con su misión y la lista de lo que falta.
 *
 * Cada falta dice **qué** no se puede medir y **por qué**, no «próximamente». La diferencia importa:
 * con el porqué, quien lee sabe si es cuestión de esperar o de pedir algo — y dos de las tres
 * necesitan una decisión fuera de esta aplicación.
 *
 * ── EL FRENO LLEGA HASTA ACÁ, Y ANTES NO LLEGABA ───────────────────────────
 *
 * Esta pantalla afirmaba, sin condición, que *«sus hallazgos ya se ven en la pestaña Auditoría»*. Es
 * falso para casi toda la flota: **medido el 2026-09-14, de las 12 empresas activas sólo 4 tienen la
 * llave de IA y sólo 1 tiene el identificador del agente en el CRM.** En las demás la pestaña de
 * Auditoría está vacía, y esta línea mandaba a mirarla como si ahí hubiera algo.
 *
 * Es el mismo defecto que la aplicación ya persigue en las cifras —prometer un dato que no está— y
 * el freno que lo dice bien ya existía: vive en `pantalla.noAudita` y sólo lo leía la pestaña de
 * Auditoría. Acá se reusa, con el mismo texto, para que las tres pestañas digan lo mismo.
 */
function Flujo({ flujo, noAudita, cancelacion, respuesta, atribucion, precall }) {
  return (
    <>
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

      {/* ── LA PRIMERA CIFRA MEDIDA, Y LO QUE LA ACOMPAÑA ──────────────────
          Va ARRIBA del «qué falta» a propósito: lo que sí se sabe primero, y después el hueco. Al
          revés, la pestaña se lee como vacía y nadie llega al número. */}
      {cancelacion ? <Cancelacion c={cancelacion} /> : null}
      {precall ? <Precall p={precall} /> : null}
      {respuesta ? <Lead r={respuesta} /> : null}
      {atribucion ? <Atribucion a={atribucion} /> : null}

      {/* El aviso general dejó de ser incondicional. Appointment Flow YA calcula algo, así que decir
          ahí «sus indicadores todavía no se pueden calcular» sería falso — y falso de la manera que
          más cuesta, porque desmiente a la cifra que está tres centímetros más arriba. */}
      <div className="fd-aviso">
        <i>◍</i>
        <span>
          {cancelacion || respuesta || atribucion || precall
            ? 'Sus demás indicadores todavía no se pueden calcular con los datos que este sistema recibe hoy. Abajo está qué falta para cada uno.'
            : 'Sus indicadores todavía no se pueden calcular con los datos que este sistema recibe hoy. Abajo está qué falta para cada uno.'}
        </span>
      </div>

      <ul className="cs-falta">
        {flujo.falta.map(([que, porQue]) => (
          <li key={que}>
            <b>{que}</b>
            <span>{porQue}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
