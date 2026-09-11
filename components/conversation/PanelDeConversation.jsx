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
import { agruparPorPatron, leerLaPantalla } from '@/lib/auditor/vista';

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
        <Flujo flujo={FLUJOS[sub]} />
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
 * Un flujo que todavía no mide, con su misión y la lista de lo que falta.
 *
 * Cada falta dice **qué** no se puede medir y **por qué**, no «próximamente». La diferencia importa:
 * con el porqué, quien lee sabe si es cuestión de esperar o de pedir algo — y dos de las tres
 * necesitan una decisión fuera de esta aplicación.
 */
function Flujo({ flujo }) {
  return (
    <>
      <p className="aud-alcance">
        <b>{flujo.titulo}.</b> {flujo.mision} Lo supervisa el agente <b>{flujo.agente}</b>, y sus
        hallazgos ya se ven en la pestaña <b>Auditoría</b>.
      </p>

      <div className="fd-aviso">
        <i>◍</i>
        <span>
          Sus indicadores todavía no se pueden calcular con los datos que este sistema recibe hoy.
          Abajo está qué falta para cada uno.
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
