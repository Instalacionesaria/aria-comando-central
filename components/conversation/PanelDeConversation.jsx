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
      ['La asistencia', 'El CRM tiene los campos «asistió» y «no apareció» y están casi vacíos: 3 citas de 1052. La única señal de no-show con volumen la registra el closer al cerrar el intento, y eso es un dato reportado por una persona, no por el calendario.'],
      ['El video precall', 'Llega como campo suelto del CRM, sin fecha ni porcentaje visto, así que no se puede decir quién lo vio ni cuánto.'],
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
          respuesta={sub === 'leadflow' ? (pantalla?.respuesta ?? null) : null}
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

function Respuesta({ r }) {
  return (
    <div className="cs-cifra">
      <p className="cs-cifra-titulo">
        Contactos nuevos del setter <span>últimos {r.dias} días</span>
      </p>

      <div className="cs-cifra-fila">
        <Cifra
          titulo="Respondieron"
          valor={r.tasa === null ? null : `${r.tasa} %`}
          detalle={`${r.respondieron} de ${r.escritos}`}
        />
        <Cifra titulo="Entraron" valor={String(r.cohorte)} detalle="contactos" />
      </div>

      {/* ── LO QUE ESTA CIFRA NO ES, Y HAY QUE DECIRLO ──────────────────────
          Mide si el CONTACTO contestó, no si contestó AL AGENTE: el sistema todavía no distingue
          un mensaje del agente de uno de un flujo del CRM. Sin esta línea, alguien la lee como el
          rendimiento del agente y decide con ella. */}
      <p className="cs-cifra-nota">
        Mide si el contacto contestó, <b>no a quién</b>: todavía no se distingue un mensaje del
        agente de uno de un flujo del CRM. Esa cifra más fina está en la lista de abajo.
      </p>
      {r.aviso ? <p className="cs-cifra-nota">{r.aviso}</p> : null}
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
      </div>

      <p className="cs-cifra-nota">
        El no-show y la asistencia los <b>reporta el closer</b> al cerrar el intento, no el
        calendario: los campos de asistencia del CRM están vacíos en las 316 citas.
      </p>
      {/* Su aviso va aparte del de abajo: éste va a estar encendido durante semanas —la asistencia
          se empezó a registrar hoy— y compartir el renglón apagaría por costumbre el de las citas
          congeladas, que sí es excepcional. */}
      {c.avisoDeAsistencia ? <p className="cs-cifra-nota">{c.avisoDeAsistencia}</p> : null}
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
function Flujo({ flujo, noAudita, cancelacion, respuesta }) {
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
      {respuesta ? <Respuesta r={respuesta} /> : null}

      {/* El aviso general dejó de ser incondicional. Appointment Flow YA calcula algo, así que decir
          ahí «sus indicadores todavía no se pueden calcular» sería falso — y falso de la manera que
          más cuesta, porque desmiente a la cifra que está tres centímetros más arriba. */}
      <div className="fd-aviso">
        <i>◍</i>
        <span>
          {cancelacion || respuesta
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
