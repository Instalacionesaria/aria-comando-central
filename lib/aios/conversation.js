/* Portado de aios-command-center_1.html — líneas 5733-6288 del original. */
export function initConversation() {

  /* ===================== CONVERSATION ===================== */
  (function(){
  const nn = n => n.toLocaleString('es-PE');

  /* factores por periodo · 'mes' es la base de los datos */
  const CSF  = {hoy:0.035, '7d':0.22, mes:1, hist:3.4};
  const CSFP = {hoy:0.032, '7d':0.19, mes:0.88, hist:3.4};
  let csPer = '7d';
  const csScale = (o, prev) => {
    const f = (prev ? CSFP : CSF)[csPer] || 1;
    const r = {}; for(const k in o) r[k] = Math.round(o[k] * f); return r;
  };

  /* Lead Flow solo trabaja a quien NO agendó por su cuenta */
  const LEAD0 = {contactados:346, respondieron:212, abrieron:158, agendados:121};

  /* Appointment Flow trabaja TODAS las citas, vengan de donde vengan */
  const ORIGEN0 = {
    lead:   {n:121, confirmaron:88,  asistieron:68},
    directo:{n:104, confirmaron:84,  asistieron:70},
  };
  const APPT0 = {
    agendados: ORIGEN0.lead.n + ORIGEN0.directo.n,
    confirmaron: ORIGEN0.lead.confirmaron + ORIGEN0.directo.confirmaron,
    asistieron: ORIGEN0.lead.asistieron + ORIGEN0.directo.asistieron,
    reprogramaron:19, cancelaron:14,
  };
  const CALIF0 = {total:98, alto:63, medio:35, bajo:41};
  const ASIS0  = {alto:76, medio:44, bajo:18};

  let LEAD, LEAD_P, APPT, APPT_P, ORIGEN, CALIF, CALIF_P;
  function csRefresh(){
    LEAD   = csScale(LEAD0);      LEAD_P = csScale(LEAD0, 1);
    APPT   = csScale(APPT0);      APPT_P = csScale(APPT0, 1);
    ORIGEN = {lead: csScale(ORIGEN0.lead), directo: csScale(ORIGEN0.directo)};
    CALIF  = csScale(CALIF0);     CALIF_P = csScale(CALIF0, 1);
  }
  csRefresh();
  const ESCAL = {n:23, pct:7};
  const ESCAL_P = {n:31, pct:10};

  let csHist = false;
  const csHasCmp = () => !csHist && csPer !== 'hist' && csPer !== 'hoy';
  const csDelta = (now, before, opts) => {
    opts = opts || {};
    if(!csHasCmp()) return '';
    if(before == null || !before) return '';
    const diff = opts.pts ? Math.round(now-before) : Math.round((now-before)/before*100);
    if(diff === 0) return '<span class="dlt flat">=</span>';
    const up = diff > 0, good = opts.inverse ? !up : up;
    return `<span class="dlt ${good?'up':'down'}">${up?'▲ +':'▼ '}${Math.abs(diff)}${opts.pts?' pts':'%'}</span>`;
  };

  /* texto: respondió o no · voz: la llamada sirvió o no */
  const AG_OUT = {
    'lf-txt': [['Respondieron', 212], ['Sin respuesta', 134]],
    'lf-voz': [['Exitosas · respondió todo', 40], ['Contestó sin completar', 22],
               ['No contestó', 34], ['Buzón', 22]],
    'af-txt': [['Respondieron', 94], ['Sin respuesta', 27]],
    'af-voz': [['Exitosas · respondió todo', 46], ['Contestó sin completar', 14],
               ['No contestó', 16], ['Buzón', 12]],
  };

  const AGENTS = [
    {k:'lf-txt', n:'Sofía · Texto', flow:'Lead Flow', canal:'WhatsApp',
     role:'Conversa con el contacto nuevo y lo lleva a la landing BCL para que agende.',
     kpi:'agendaron', v:58, conv:346, resp:'2 min', msgs:9.4, sent:{p:64,n:28,g:8}, esc:6, st:'ok'},
    {k:'lf-voz', n:'Sofía · Voz', flow:'Lead Flow', canal:'Llamada',
     role:'Rescata al contacto que no respondió los primeros mensajes de texto.',
     kpi:'reactivó', v:34, conv:118, resp:'—', msgs:1.0, sent:{p:52,n:36,g:12}, esc:11, st:'ok'},
    {k:'af-txt', n:'Sofía · Texto', flow:'Appointment Flow', canal:'WhatsApp',
     role:'Recuerda, confirma y sostiene la cita hasta que el contacto entra a la llamada.',
     kpi:'asistieron', v:71, conv:121, resp:'3 min', msgs:6.1, sent:{p:71,n:24,g:5}, esc:3, st:'ok'},
    {k:'af-voz', n:'Sofía · Voz', flow:'Appointment Flow', canal:'Llamada',
     role:'Touchpoint de experiencia: hace dos preguntas y confirma. No busca convertir.',
     kpi:'respondieron', v:52, conv:88, resp:'—', msgs:1.0, sent:{p:58,n:27,g:15}, esc:8, st:'warn'},
  ];

  const NEG = [
    {t:'Pidió el precio tres veces y el agente no respondió', ag:'LF · Texto', when:'hace 20 min',
     chat:[['lead','¿Cuánto cuesta el sistema?',null],
           ['ag','Te lo explica el equipo en la llamada. ¿Te va bien mañana a las 10?',null],
           ['lead','Solo dime un rango, no quiero perder el tiempo',null],
           ['ag','Prefiero que lo veas con contexto. ¿Mañana 10 o 4?','flag'],
           ['lead','Olvídalo',null]]},
    {t:'El agente de voz cortó antes de confirmar la hora', ag:'AF · Voz', when:'hace 2 h',
     chat:[['ag','Hola Rodrigo, confirmo tu llamada con el equipo.',null],
           ['lead','Sí, pero ¿a qué hora era?',null],
           ['ag','Perfecto, nos vemos entonces. Que tengas buen día.','flag']]},
    {t:'Insistió con 5 mensajes sin respuesta del contacto', ag:'LF · Texto', when:'ayer',
     chat:[['ag','¿Sigues ahí?',null],['ag','Te dejo el link otra vez',null],
           ['ag','¿Te llamo mejor?','flag'],['lead','Ya deja de escribir',null]]},
    {t:'No reconoció que el contacto ya había agendado', ag:'AF · Texto', when:'hace 2 días',
     chat:[['ag','¿Quieres agendar una llamada?',null],
           ['lead','Ya agendé para el jueves','flag'],
           ['ag','Genial, te paso el link para agendar',null]]},
  ];

  const ISSUES = [
    {cat:'prompt', sev:'crit', ag:'Appointment Flow', canal:'Voz', st:'det',
     t:'No reconfirma día y hora al cerrar la llamada',
     d:'En 14 de 22 llamadas el agente cierra sin repetir la fecha. Ese grupo asiste 12 puntos menos.',
     cost:'−14', costl:'asistencias', n:14,
     prompt:['Antes de cerrar, repite el día y la hora exactos de la cita',
             'Pide confirmación explícita: "¿te queda bien el {dia} a las {hora}?"',
             'Si el contacto duda, ofrece dos alternativas concretas'],
     del:'Despedirse cuando el contacto confirme que entendió', neg:1},
    {cat:'prompt', sev:'warn', ag:'Lead Flow', canal:'Texto', st:'det',
     t:'Se traba cuando preguntan el precio',
     d:'En 31 conversaciones preguntan el precio dos o más veces. El 68% termina sin agenda.',
     cost:'−21', costl:'agendas', n:31,
     prompt:['Reconoce la pregunta antes de redirigir: "es la pregunta correcta"',
             'Da el rango de inversión sin cerrar el número exacto',
             'Conecta el precio con el resultado antes de proponer la llamada'],
     del:'Evadir la pregunta pidiendo agendar de inmediato', neg:0},
    {cat:'datos', sev:'warn', ag:'Lead Flow', canal:'Texto', st:'det',
     t:'Teléfonos inválidos en el formulario',
     d:'27 contactos dejaron un número que no existe o está incompleto. El agente insiste sin poder entregar.',
     cost:'−27', costl:'contactos', n:27,
     prompt:['Al detectar número inválido, pide confirmarlo en el primer mensaje',
             'Si no responde en dos intentos, marca el contacto como dato inválido y detén la secuencia'],
     del:'Reintentar el envío indefinidamente', neg:0, other:'Conversion · validación del formulario'},
    {cat:'datos', sev:'media', ag:'Appointment Flow', canal:'Texto', st:'det',
     t:'Correos con dominio mal escrito',
     d:'9 contactos con errores de tipeo en el dominio. No reciben el recordatorio de la cita.',
     cost:'−9', costl:'recordatorios', n:9,
     prompt:['Verifica el dominio contra la lista de errores frecuentes',
             'Confirma el correo por WhatsApp antes de enviar el recordatorio'],
     del:'Enviar sin validar el dominio', neg:0, other:'Conversion · validación del formulario'},
    {cat:'prompt', sev:'warn', ag:'Lead Flow', canal:'Texto', st:'apl',
     t:'Insiste más de tres veces sin respuesta',
     d:'Aplicado hace 4 días. El sentimiento negativo bajó de 14% a 8%.',
     cost:'−9', costl:'contactos', n:9,
     prompt:['Máximo tres intentos por canal',
             'Al tercero sin respuesta, deriva al agente de voz'],
     del:'Reintentar indefinidamente cada 24 horas', neg:2},
    {cat:'prompt', sev:'warn', ag:'Appointment Flow', canal:'Texto', st:'ver',
     t:'No detecta cuando el contacto ya agendó',
     d:'Verificando desde hace 2 días. Ocurría 7 veces por semana.',
     cost:'−7', costl:'conversaciones', n:7,
     prompt:['Consulta el estado de la cita antes del primer mensaje',
             'Si ya existe cita activa, entra en modo confirmación'],
     del:'Iniciar siempre con la propuesta de agendar', neg:3},
  ];

  const FIXES = [
    {sev:'crit', ic:'!', ag:'Appointment Flow · Voz', st:'det',
     t:'No reconfirma día y hora al cerrar la llamada',
     d:'En 14 de 22 llamadas el agente cierra sin repetir la fecha. Ese grupo asiste 12 puntos menos que el resto.',
     cost:'−14', costl:'asistencias',
     prompt:['Antes de cerrar, repite el día y la hora exactos de la cita',
             'Pide confirmación explícita: "¿te queda bien el {dia} a las {hora}?"',
             'Si el contacto duda, ofrece dos alternativas concretas'],
     del:'Despedirse cuando el contacto confirme que entendió'},
    {sev:'warn', ic:'$', ag:'Lead Flow · Texto', st:'det',
     t:'Se traba cuando preguntan el precio',
     d:'En 31 conversaciones el contacto pregunta el precio dos o más veces. El 68% de esas conversaciones termina sin agenda.',
     cost:'−21', costl:'agendas',
     prompt:['Reconoce la pregunta antes de redirigir: "es la pregunta correcta"',
             'Da el rango de inversión sin cerrar el número exacto',
             'Conecta el precio con el resultado esperado antes de proponer la llamada'],
     del:'Evadir la pregunta pidiendo agendar de inmediato'},
    {sev:'warn', ic:'↻', ag:'Lead Flow · Texto', st:'apl',
     t:'Insiste más de tres veces sin respuesta',
     d:'Aplicado hace 4 días. El sentimiento negativo bajó de 14% a 8%, pendiente de confirmar con más volumen.',
     cost:'−9', costl:'contactos',
     prompt:['Máximo tres intentos por canal',
             'Al tercero sin respuesta, deriva al agente de voz',
             'Si tampoco responde, pasa a nurture y avisa al setter'],
     del:'Reintentar indefinidamente cada 24 horas'},
    {sev:'warn', ic:'◔', ag:'Appointment Flow · Texto', st:'ver',
     t:'No detecta cuando el contacto ya agendó',
     d:'Verificando desde hace 2 días. Ocurría en 7 conversaciones por semana y generaba sentimiento negativo inmediato.',
     cost:'−7', costl:'conversaciones',
     prompt:['Consulta el estado de la cita antes del primer mensaje',
             'Si ya existe cita activa, entra en modo confirmación, no en modo agenda'],
     del:'Iniciar siempre con la propuesta de agendar'},
  ];

  /* ---- resumen ---- */
  function stats(){
    const lfR  = Math.round(LEAD.agendados/LEAD.contactados*100);
    const lfRp = Math.round(LEAD_P.agendados/LEAD_P.contactados*100);
    const afR  = Math.round(APPT.asistieron/APPT.agendados*100);
    const afRp = Math.round(APPT_P.asistieron/APPT_P.agendados*100);

    /* calidad de quien efectivamente llegó a la llamada */
    const mix = (n, part) => Math.round(APPT.asistieron * part);
    const ASIS = {total:APPT.asistieron,
      alto: mix(0, ASIS0.alto/(ASIS0.alto+ASIS0.medio+ASIS0.bajo)),
      medio: mix(0, ASIS0.medio/(ASIS0.alto+ASIS0.medio+ASIS0.bajo)),
      bajo: 0};
    ASIS.bajo = ASIS.total - ASIS.alto - ASIS.medio;
    const ASIS_P = {total:APPT_P.asistieron,
      alto: Math.round(APPT_P.asistieron*0.50), medio: Math.round(APPT_P.asistieron*0.33), bajo:0};
    ASIS_P.bajo = ASIS_P.total - ASIS_P.alto - ASIS_P.medio;
    const qR  = Math.round((ASIS.alto+ASIS.medio)/ASIS.total*100);
    const qRp = Math.round((ASIS_P.alto+ASIS_P.medio)/ASIS_P.total*100);

    const pair = (k, v, r, d, g) => `
      <div class="pn-c">
        <div class="pn-k">${k}</div>
        <div class="pn-r"><span class="pn-v"${g?` data-leads="${g.t}" data-n="${g.n}"${g.seg?` data-seg="${g.seg}"`:''} data-sub="${g.sub||''}"`:''}>${v}</span>${r?`<span class="pn-rt">${r}</span>`:''}</div>
        <div class="pn-d">${d || ''}</div>
      </div>`;

    document.getElementById('csStats').innerHTML = `
      <div class="pn">
        <div class="pn-h">Lead Flow
          <em>rescata a quien no agendó solo</em></div>
        <div class="pn-b">
          ${pair('Contactos sin cita', nn(LEAD.contactados), '', csDelta(LEAD.contactados, LEAD_P.contactados))}
          ${pair('Agendó', nn(LEAD.agendados), lfR+'%', csDelta(lfR, lfRp, {pts:1}))}
        </div>
      </div>

      <div class="pn hi">
        <div class="pn-h">Appointment Flow
          <em>sostiene todas las citas</em></div>
        <div class="pn-b">
          ${pair('Citas totales', nn(APPT.agendados), '', csDelta(APPT.agendados, APPT_P.agendados))}
          ${pair('Asistieron', nn(APPT.asistieron), afR+'%', csDelta(afR, afRp, {pts:1}))}
        </div>
      </div>

      <div class="pn">
        <div class="pn-h">De qué está hecho el grupo que asistió
          <em>${qR}% calificado</em></div>
        <div class="pn-b q4">
          ${pair('Asistentes', nn(ASIS.total), '', csDelta(ASIS.total, ASIS_P.total),
                 {n:ASIS.total, t:'Asistieron a la llamada', sub:'todos los perfiles'})}
          ${pair('Alto', nn(ASIS.alto), Math.round(ASIS.alto/ASIS.total*100)+'%', '',
                 {n:ASIS.alto, seg:'alto', t:'Asistieron · calificado alto', sub:'de los que llegaron a la llamada'})}
          ${pair('Medio', nn(ASIS.medio), Math.round(ASIS.medio/ASIS.total*100)+'%', '',
                 {n:ASIS.medio, seg:'medio', t:'Asistieron · calificado medio', sub:'de los que llegaron a la llamada'})}
          ${pair('Bajo', nn(ASIS.bajo), Math.round(ASIS.bajo/ASIS.total*100)+'%', '',
                 {n:ASIS.bajo, seg:'bajo', t:'Asistieron · no calificado', sub:'de los que llegaron a la llamada'})}
        </div>
      </div>`;
  }

  /* ---- los dos flujos ---- */
  function flows(){
    const chain = (arr, base) => arr.map(([n,v,side])=>{
      const p = Math.round(v/base*100);
      return `<div class="csr">
        <span class="csr-n">${n}</span>
        <span class="csr-v" data-leads="${n}" data-n="${v}" data-sub="Conversation">${nn(v)}</span>
        <span class="csr-b"><i style="width:${p}%"></i></span>
        <span class="csr-p">${p}%</span>
      </div>`;
    }).join('');

    document.getElementById('csFlows').innerHTML = `
      <div class="csf">
        <div class="csf-h" style="display:flex; align-items:flex-start">
          <div>
            <div class="csf-t">Lead Flow</div>
            <div class="csf-m">Que agende quien no lo hizo solo</div>
          </div>
          <div class="csf-key"><b>${Math.round(LEAD.agendados/LEAD.contactados*100)}%</b><span>contacto a agenda</span></div>
        </div>
        <div class="csf-chain">${chain([
          ['Contactados sin cita', LEAD.contactados],
          ['Respondieron', LEAD.respondieron],
          ['Abrieron la landing BCL', LEAD.abrieron],
          ['Agendaron', LEAD.agendados],
        ], LEAD.contactados)}</div>
        <div class="csf-foot">La mayor pérdida está entre <b>responder</b> y <b>abrir el link</b>: 54 contactos conversan y no llegan a la landing.</div>
      </div>

      <div class="csf">
        <div class="csf-h" style="display:flex; align-items:flex-start">
          <div>
            <div class="csf-t">Appointment Flow</div>
            <div class="csf-m">Que asista · todas las citas, vengan de donde vengan</div>
          </div>
          <div class="csf-key"><b>${Math.round(APPT.asistieron/APPT.agendados*100)}%</b><span>agenda a asistencia</span></div>
        </div>
        <div class="csf-chain">${chain([
          ['Agendados · todos', APPT.agendados],
          ['Confirmaron', APPT.confirmaron],
          ['Asistieron', APPT.asistieron],
        ], APPT.agendados)}
        <div class="org-split">
          <div class="org-h">Salidas antes de la llamada</div>
          <div class="org-r"><span class="org-n">Reprogramaron</span>
            <span class="org-v" data-leads="Reprogramaron la cita" data-n="${APPT.reprogramaron}" data-sub="Appointment Flow">${nn(APPT.reprogramaron)}</span>
            <span class="org-b"><i style="width:${Math.round(APPT.reprogramaron/APPT.agendados*100)}%; background:rgba(240,136,76,.45)"></i></span>
            <span class="org-p">${Math.round(APPT.reprogramaron/APPT.agendados*100)}%</span></div>
          <div class="org-r"><span class="org-n">Cancelaron</span>
            <span class="org-v" data-leads="Cancelaron la cita" data-n="${APPT.cancelaron}" data-sub="Appointment Flow">${nn(APPT.cancelaron)}</span>
            <span class="org-b"><i style="width:${Math.round(APPT.cancelaron/APPT.agendados*100)}%; background:rgba(240,92,92,.45)"></i></span>
            <span class="org-p">${Math.round(APPT.cancelaron/APPT.agendados*100)}%</span></div>
        </div>
        <div class="org-split">
          <div class="org-h">Tasa de asistencia por calidad <em>· de cada nivel agendado</em></div>
          ${ICPCONN.map(x=>`
            <div class="org-r">
              <span class="org-n">${x.n}</span>
              <span class="org-v" data-leads="Asistieron · ${x.n.toLowerCase()}" data-n="${x.asis}" data-seg="${x.k==='bajo'?'bajo':(x.k==='alto'?'alto':'medio')}" data-sub="de ${nn(x.agen)} agendados">${nn(x.asis)}</span>
              <span class="org-b"><i style="width:${Math.round(x.asis/x.agen*100)}%"></i></span>
              <span class="org-p">${Math.round(x.asis/x.agen*100)}% de ${nn(x.agen)}</span>
            </div>`).join('')}
        </div>
        <div class="org-split">
          <div class="org-h">De dónde viene la cita</div>
          ${[['Los rescató Lead Flow', ORIGEN.lead],['Se agendaron solos', ORIGEN.directo]].map(([n,o])=>`
            <div class="org-r">
              <span class="org-n">${n}</span>
              <span class="org-v" data-leads="${n}" data-n="${o.n}" data-sub="Appointment Flow · origen de la cita">${nn(o.n)}</span>
              <span class="org-b"><i style="width:${Math.round(o.asistieron/o.n*100)}%"></i></span>
              <span class="org-p">${Math.round(o.asistieron/o.n*100)}% asiste</span>
            </div>`).join('')}
        </div></div>
        <div class="csf-foot">Quien se agenda solo asiste <b>${Math.round(ORIGEN.directo.asistieron/ORIGEN.directo.n*100 - ORIGEN.lead.asistieron/ORIGEN.lead.n*100)} puntos más</b> que el rescatado. El show-up del embudo de Executive sale de este número.</div>
      </div>`;
  }

  /* ---- agentes ---- */
  function agents(){
    const F = CSF[csPer] || 1;
    document.getElementById('csAgents').innerHTML = AGENTS.map((a,i)=>{
      const conv = Math.round(a.conv * F);
      return `
      <div class="csa ${a.st==='warn'?'warn':''}" data-ag="${i}">
        <div class="csa-h">
          <span class="csa-ch ${a.canal==='Llamada'?'voz':'txt'}">${a.canal==='Llamada'?'Voz':'Texto'}</span>
          <span class="csa-n">${a.flow}</span>
        </div>
        <div class="csa-role">${a.role}</div>
        <div class="csa-v"><b>${nn(Math.round(conv * a.v / 100))}</b>
          <span class="csa-rt">${a.v}%</span><span>${a.kpi}</span></div>
        <div class="csa-mx">
          ${(AG_OUT[a.k]||[]).map(([lab, base], j)=>{
            const v = Math.round(base * F);
            const pctv = conv ? Math.round(v/conv*100) : 0;
            return `<div class="csa-r ${j===0?'good':''}${j>0 && a.canal==='Llamada' ? ' sub':''}">
              <span>${lab}</span><b>${nn(v)} <em>${pctv}%</em></b></div>`;
          }).join('')}
        </div>
        <div class="csa-sent">
          <div class="csa-sl"><span>Sentimiento</span>
            <b class="${a.sent.g>10?'neg':''}">${a.sent.g}% negativo</b></div>
          <div class="sent-bar">
            <i class="p" style="width:${a.sent.p}%"></i>
            <i class="n" style="width:${a.sent.n}%"></i>
            <i class="g" style="width:${a.sent.g}%"></i>
          </div>
        </div>
      </div>`;
    }).join('');
    document.querySelectorAll('[data-ag]').forEach(el=> el.onclick = ()=> openAgent(AGENTS[+el.dataset.ag]));
  }

  /* qué perfil llega hasta la llamada */
  const ICPCONN = [
    {k:'alto',  n:'Calificado alto',  base:78, resp:64, agen:51, asis:41},
    {k:'medio', n:'Calificado medio', base:164, resp:98, agen:52, asis:26},
    {k:'bajo',  n:'No calificado',    base:104, resp:41, agen:18, asis:7},
  ];

  /* ---- correcciones ---- */
  const STL = {det:'Detectado', apl:'Aplicado', ver:'Verificando', ok:'Resuelta'};
  const CATL = {prompt:'Prompt', datos:'Datos inválidos'};
  let issCat = 'abiertos';

  function fixes(){
    const TINT = {crit:'rgba(240,92,92,.14);color:var(--crit)',
                  warn:'rgba(240,136,76,.14);color:var(--warn)',
                  media:'rgba(148,197,255,.08);color:var(--txt-faint)'};
    const list = ISSUES.filter(x=> issCat==='resueltos' ? x.st==='ok' : x.st!=='ok');
    document.getElementById('csFixes').innerHTML = list.map((f)=>`
      <div class="iss" data-iss="${ISSUES.indexOf(f)}">
        <div class="iss-who">
          <span class="csa-ch ${f.canal==='Voz'?'voz':'txt'}">${f.canal}</span>
          <span class="iss-fl">${f.ag}</span>
        </div>
        <div>
          <div class="iss-t">${f.t}</div>
          <div class="iss-d">${f.d}</div>
          <div class="iss-m">
            <span>${CATL[f.cat].toLowerCase()}</span>
            ${f.other ? `<span>también afecta a ${f.other}</span>` : ''}
            ${f.neg ? `<span>${f.neg} conversación${f.neg>1?'es':''} marcada${f.neg>1?'s':''}</span>` : ''}
          </div>
        </div>
        <div class="iss-cost"><b>${f.cost}</b><span>${f.costl}</span></div>
        <span class="fix-st ${f.st}">${STL[f.st]}</span>
      </div>`).join('') ||
      '<div class="dw-empty" style="padding:28px 16px; text-align:center; color:var(--txt-faint); font-size:12.5px">' +
      (issCat==='resueltos' ? 'Todavía no marcaste ninguna como resuelta.' : 'No hay nada por resolver.') + '</div>';
    document.getElementById('csIssN').textContent =
      ISSUES.filter(x=>x.st!=='ok').length + ' por resolver';
    document.querySelectorAll('[data-iss]').forEach(el=> el.onclick = ()=> openFix(ISSUES[+el.dataset.iss]));
  }

  document.getElementById('csIssFilter').addEventListener('click', e=>{
    const b = e.target.closest('button'); if(!b) return;
    document.querySelectorAll('#csIssFilter button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); issCat = b.dataset.c; fixes();
  });

  /* ---- detalles ---- */
  function drawer(title, meta, body){
    document.getElementById('dwTitle').textContent = title;
    document.getElementById('dwMeta').textContent = meta;
    document.getElementById('dwVerdict').innerHTML = '';
    document.getElementById('dwBody').innerHTML = body;
    document.getElementById('scrim').classList.add('on');
    document.getElementById('drawer').classList.add('on');
  }
  const kvb = rows => `<div class="kv-box">${rows.map(([k,v])=>
    `<div class="kv"><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;

  function openAgent(a){
    const F = CSF[csPer] || 1, conv = Math.round(a.conv * F);
    drawer(`${a.flow} · ${a.canal}`, `Sofía · ${nn(conv)} conversaciones en el periodo`, `
      <div><div class="dw-sec-t">Qué hace</div>
        <div class="dw-block"><p class="ex-p">${a.role}</p></div></div>
      <div><div class="dw-sec-t">Rendimiento</div>
        ${kvb([['Efectividad · '+a.kpi, a.v+'%'], ['Conversaciones', nn(conv)]]
          .concat((AG_OUT[a.k]||[]).map(([lab, base])=>{
            const v = Math.round(base * F);
            return [lab, nn(v) + ' · ' + (conv ? Math.round(v/conv*100) : 0) + '%'];
          }))
          .concat([['Escaló a humano', a.esc+'%']]))}</div>
      <div><div class="dw-sec-t">Sentimiento</div>
        <div class="dw-block">
          <div class="sent-bar"><i class="p" style="width:${a.sent.p}%"></i>
            <i class="n" style="width:${a.sent.n}%"></i><i class="g" style="width:${a.sent.g}%"></i></div>
          <div class="sent-l"><span>positivo <b>${a.sent.p}%</b></span><span>neutro <b>${a.sent.n}%</b></span>
            <span>negativo <b>${a.sent.g}%</b></span></div>
        </div></div>
      <div><div class="dw-sec-t">Qué hay que corregir <span class="r">detectado por el supervisor</span></div>
        <div class="dw-block">${ISSUES.filter(f=>f.ag===a.flow && f.canal===(a.canal==='Llamada'?'Voz':'Texto'))
          .map(f=>`<div class="rec" data-openfix="${ISSUES.indexOf(f)}">
            <div><div class="rt">${f.t}</div><div class="rm">${CATL[f.cat]} · ${STL[f.st]} · ${f.cost} ${f.costl}</div></div>
            <div class="rp">Ver ajuste ▸</div></div>`).join('') || '<p class="ex-p">Sin correcciones pendientes.</p>'}
        </div></div>
      <div><div class="dw-sec-t">Conversaciones con error <span class="r">evidencia</span></div>
        <div class="dw-block">${NEG.filter(x=>x.ag.includes(a.canal==='Llamada'?'Voz':'Texto') &&
            x.ag.includes(a.flow==='Lead Flow'?'LF':'AF'))
          .map(x=>`<div class="rec" data-openneg="${NEG.indexOf(x)}">
            <div><div class="rt">${x.t}</div><div class="rm">${x.when}</div></div>
            <div class="rp">Ver chat ▸</div></div>`).join('') || '<p class="ex-p">Sin conversaciones marcadas.</p>'}
        </div></div>`);
    document.querySelectorAll('#dwBody [data-openfix]').forEach(el=>
      el.onclick = ()=> openFix(ISSUES[+el.dataset.openfix]));
    document.querySelectorAll('#dwBody [data-openneg]').forEach(el=>
      el.onclick = ()=> openChat(NEG[+el.dataset.openneg]));
  }

  function openChat(x){
    drawer(x.t, `${x.ag} · ${x.when}`, `
      <div><div class="dw-sec-t">La conversación <span class="r">marcado donde se detectó</span></div>
        <div class="chat-l">${x.chat.map(([who,txt,flag])=>
          `<div class="cl ${who==='ag'?'ag':''} ${flag?'flag':''}">${txt}
            <div class="cl-w">${who==='ag'?'agente':'contacto'}</div></div>`).join('')}</div>
      </div>
      <div><div class="dw-sec-t">Qué hacer</div>
        <div class="dw-block"><p class="ex-p">Este patrón ya está registrado en correcciones de prompt. Al aplicarlo, las conversaciones nuevas dejan de repetirlo.</p></div></div>`);
  }

  function openFix(f){
    drawer(f.t, `${f.ag} · ${f.canal} · ${STL[f.st]}`, `
      <div><div class="dw-sec-t">Qué se detectó</div>
        <div class="dw-block"><p class="ex-p">${f.d}</p></div></div>
      <div><div class="dw-sec-t">Costo estimado</div>
        ${kvb([['Impacto', f.cost+' '+f.costl], ['Casos detectados', f.n],
               ['Categoría', CATL[f.cat]], ['Agente', f.ag+' · '+f.canal],
               ['Estado', STL[f.st]]].concat(f.other?[['También afecta a', f.other]]:[]))}</div>
      <div><div class="dw-sec-t">Ajuste sugerido <span class="r">para pegar en GHL</span></div>
        <div class="pr-box">
          ${f.prompt.map(l=>`<div class="add">+ ${l}</div>`).join('')}
          <div class="del">− ${f.del}</div>
        </div>
        <div class="pr-copy">Copiar bloque ›</div>
      </div>
      <div><div class="dw-sec-t">Cómo se verifica</div>
        <div class="dw-block"><p class="ex-p">Al aplicarlo se guarda el valor actual de la métrica afectada. En la siguiente sincronización se compara: si mejora, la corrección se cierra sola. Si no, vuelve a la lista con la nota de que ya se intentó.</p></div></div>

      <div><div class="dw-sec-t">Acciones</div>
        <div class="ld-actions" style="margin-top:9px">
          <button class="ld-btn" data-ghl="1">↗ Ver contacto en GHL</button>
          <button class="ld-btn" data-done="1">✓ Marcar como resuelta</button>
        </div>
        <div class="dw-hint">GHL abre en otra pestaña, en la conversación del contacto que originó el hallazgo.</div>
      </div>`);
    const done = document.querySelector('#dwBody [data-done]');
    if(done) done.onclick = ()=>{
      f.st = 'ok';
      document.getElementById('dwClose').click();
      fixes(); stats();
    };
    const ghl = document.querySelector('#dwBody [data-ghl]');
    if(ghl) ghl.onclick = ()=> window.open('https://app.gohighlevel.com/', '_blank');
  }

  const CMPL = {'hoy':'día en curso · sin comparación','7d':'vs los 7 días previos','mes':'vs los 30 días previos'};
  document.getElementById('csPeriod').addEventListener('click', e=>{
    const b = e.target.closest('button'); if(!b) return;
    document.querySelectorAll('#csPeriod button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
    csHist = false; csPer = b.dataset.p; csRefresh();
    const pill = document.getElementById('csPill');
    if(pill){ pill.classList.remove('active'); pill.querySelector('.pv').textContent = 'Personalizado'; }
    document.getElementById('csCmp').textContent = CMPL[b.dataset.p];
    stats(); flows(); agents();
  });
  window.AIOSDate._cbs.cs = (kind, f, t, label)=>{
    csHist = (kind === 'hist'); csPer = csHist ? 'hist' : 'mes'; csRefresh();
    document.getElementById('csCmp').textContent = csHist
      ? 'todo el histórico · sin comparación' : label + ' · vs periodo previo';
    stats(); flows(); agents();
  };


  document.getElementById('csMode').addEventListener('click', e=>{
    const b = e.target.closest('button'); if(!b) return;
    document.querySelectorAll('#csMode button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
    const estado = b.dataset.m === 'estado';
    document.getElementById('csEstado').hidden = !estado;
    document.getElementById('csAgentes').hidden = estado;
  });

  document.getElementById('csPlanBtn').addEventListener('click', function(){
    document.getElementById('recoSub').textContent = 'Conversation · dos flujos · cuatro agentes';
    document.getElementById('recoBody').innerHTML = `
      <div class="reco-group">
        <h4>Lo que dice la data</h4>
        <div class="reco-item">Lead Flow convierte <b>35%</b> de contacto a agenda. La fuga está entre responder y abrir la landing BCL.</div>
        <div class="reco-item">Appointment Flow sostiene <b>61%</b> de asistencia, 3 puntos bajo su banda. Es la causa parcial del show-up del embudo.</div>
        <div class="reco-item">El agente de voz de Appointment Flow concentra el sentimiento negativo más alto: <b>15%</b>.</div>
      </div>
      <div class="reco-group bad">
        <h4>Corrige esto primero</h4>
        <div class="reco-item bad">Agrega la reconfirmación de día y hora al agente de voz: son 14 asistencias al mes.</div>
        <div class="reco-item bad">Dale un rango de precio al agente de texto de Lead Flow antes de redirigir a la llamada.</div>
      </div>
      <div class="reco-group good">
        <h4>Mantén esto</h4>
        <div class="reco-item good">El límite de tres intentos bajó el sentimiento negativo de 14% a 8%. Se mantiene.</div>
      </div>
      <div class="reco-group idea">
        <h4>Para otras áreas</h4>
        <div class="reco-item idea">El 54% que responde y no abre el link puede ser un problema de la landing · <b>Conversion</b>.</div>
      </div>`;
    document.getElementById('recoScrim').classList.add('on');
    document.getElementById('recoModal').classList.add('on');
  });

  stats(); flows(); agents(); fixes();
  })();
}
