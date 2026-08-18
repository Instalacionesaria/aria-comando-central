/* Portado de aios-command-center_1.html — líneas 5342-5640 del original. */
export function initAcquisition() {
  /* ============ ACQUISITION — datos y render ============ */
  (function(){
    const FUNNELS = {
      leadform: { name:'Lead form ads',
        stages:['contactos','clics','agendados'],
        labels:{contactos:'Leads',clics:'Clics a landing VSL',agendados:'Agendados'},
        costs:{contactos:'CPL',clics:'C/clic',agendados:'C/agendado'} },
      profile: { name:'Profile funnel',
        stages:['contactos','clics','agendados'],
        labels:{contactos:'DMs',clics:'Clics a landing VSL',agendados:'Agendados'},
        costs:{contactos:'C/DM',clics:'C/clic',agendados:'C/agendado'} },
      booking: { name:'Booking directo',
        stages:['contactos','forms','clics','agendados'],
        labels:{contactos:'Contactos',forms:'Completaron form',clics:'Clics a landing VSL',agendados:'Agendas'},
        costs:{contactos:'C/contacto',forms:'C/form',clics:'C/clic',agendados:'C/agenda'} }
    };

    const CAMPS = [
      {f:'leadform', n:'Prospecting A \u00b7 Lead Ads', invD:92, entD:9.2,
       r:{clics:.38, agendados:.31}, calif:.61, icp:{a:.32,m:.44,b:.24}},
      {f:'leadform', n:'Prospecting B \u00b7 Lead Ads', invD:48, entD:3.8,
       r:{clics:.33, agendados:.29}, calif:.54, icp:{a:.19,m:.44,b:.37}},
      {f:'leadform', n:'Retargeting 90d \u00b7 Lead Ads', invD:21, entD:1.6,
       r:{clics:.46, agendados:.36}, calif:.72, icp:{a:.45,m:.39,b:.16}},
      {f:'profile', n:'Reel de autoridad \u00b7 DM', invD:54, entD:7.4,
       r:{clics:.44, agendados:.178}, calif:.58, icp:{a:.24,m:.46,b:.30}},
      {f:'profile', n:'Remarketing interacci\u00f3n \u00b7 DM', invD:24, entD:2.5,
       r:{clics:.52, agendados:.215}, calif:.69, icp:{a:.40,m:.41,b:.19}},
      {f:'booking', n:'P\u00fablico fr\u00edo \u00b7 Agendamiento', invD:68, entD:8.0,
       r:{forms:.36, clics:.58, agendados:.74}, calif:.52, icp:{a:.21,m:.44,b:.35}},
      {f:'booking', n:'Remarketing web \u00b7 Agendamiento', invD:38, entD:3.4,
       r:{forms:.44, clics:.62, agendados:.80}, calif:.68, icp:{a:.46,m:.38,b:.16}}
    ];

    const PERIODS = { p1:{d:1,m:1.02,pm:.95}, p7:{d:7,m:1.04,pm:.97}, p30:{d:30,m:1.00,pm:.94},
      pmes:{d:12,m:1.06,pm:.99}, hist:{d:365,m:1.00,pm:1.00} };
    const S = { period:'p7', rate:'step', cmp:'prev', open:{leadform:true, profile:false, booking:false} };

    const nf = n => Math.round(n).toLocaleString('es-MX');
    const cf = n => '$' + Math.round(n).toLocaleString('es-MX');
    const pf = n => Math.round(n*100) + '%';
    const val = id => document.getElementById(id).value;
    const dayDiff = (a,b) => (!a || !b) ? 0 : Math.round((new Date(b) - new Date(a)) / 86400000) + 1;

    function seedMod(str){
      let h = 0;
      for(let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 997;
      return 0.88 + (h % 25) / 100;
    }

    function shift(dateStr, days){
      const d = new Date(dateStr);
      d.setDate(d.getDate() - days);
      return d.toISOString().slice(0, 10);
    }

    function windows(){
      if(S.period === 'hist'){
        const P = PERIODS.hist;
        return { a:{days:P.d, mod:P.m}, b:{days:P.d, mod:P.pm}, note:'histórico completo' };
      }
      if(S.period !== 'custom'){
        const P = PERIODS[S.period];
        return { a:{days:P.d, mod:P.m}, b:{days:P.d, mod:P.pm}, note:'' };
      }
      const a1 = val('acqA1'), a2 = val('acqA2');
      const da = Math.max(1, Math.min(365, dayDiff(a1, a2) || 21));
      let b1, b2, db;
      if(S.cmp === 'prev'){
        b2 = shift(a1, 1); b1 = shift(a1, da); db = da;
      } else {
        b1 = val('acqB1'); b2 = val('acqB2');
        db = Math.max(1, Math.min(365, dayDiff(b1, b2) || da));
      }
      const warn = db !== da ? ' \u00b7 \u26a0 periodos de distinta duraci\u00f3n' : '';
      return {
        a:{days:da, mod:seedMod(a1)},
        b:{days:db, mod:seedMod(b1)},
        note: da + 'd vs ' + db + 'd \u00b7 base ' + b1 + ' \u2192 ' + b2 + warn
      };
    }

    function build(w){
      const cap = v => Math.min(.94, v);
      const rows = CAMPS.map(function(c, i){
        const cfg = FUNNELS[c.f], o = { i:i, f:c.f, n:c.n, inv: Math.round(c.invD * w.days) };
        cfg.stages.forEach(function(s, k){
          o[s] = k === 0
            ? Math.max(1, Math.round(c.entD * w.days * w.mod))
            : Math.round(o[cfg.stages[k-1]] * cap(c.r[s] * w.mod));
        });
        o.calificados = Math.round(o.agendados * cap(c.calif * w.mod));
        const q = o.calificados;
        o.icpA = Math.round(q * c.icp.a); o.icpM = Math.round(q * c.icp.m);
        o.icpB = Math.max(0, q - o.icpA - o.icpM);
        o.icp = q ? (o.icpA*100 + o.icpM*60 + o.icpB*25) / q : 0;
        return o;
      });
      const fn = {};
      Object.keys(FUNNELS).forEach(function(k){
        const list = rows.filter(function(r){ return r.f === k; });
        const t = { inv:0, calificados:0, icpA:0, icpM:0, icpB:0 };
        FUNNELS[k].stages.forEach(function(s){ t[s] = 0; });
        list.forEach(function(r){
          t.inv += r.inv; t.calificados += r.calificados;
          t.icpA += r.icpA; t.icpM += r.icpM; t.icpB += r.icpB;
          FUNNELS[k].stages.forEach(function(s){ t[s] += r[s]; });
        });
        t.icp = t.calificados ? (t.icpA*100 + t.icpM*60 + t.icpB*25) / t.calificados : 0;
        fn[k] = { list:list, total:t };
      });
      const g = { inv:0, contactos:0, clics:0, agendados:0, calificados:0 };
      Object.keys(fn).forEach(function(k){
        const t = fn[k].total;
        g.inv += t.inv; g.contactos += t.contactos; g.agendados += t.agendados;
        g.calificados += t.calificados; g.clics += (t.clics || 0);
      });
      g.cq = g.calificados ? g.inv / g.calificados : 0;
      return { fn:fn, g:g };
    }

    function delta(cur, prev, invert){
      if(S.period === 'hist' || S.period === 'p1') return '';   /* Histórico y Hoy: sin comparación */
      if(!prev || !cur) return '';
      const d = (cur - prev) / prev;
      if(!isFinite(d)) return '';
      const good = invert ? d < 0 : d > 0;
      if(Math.abs(d) < .005) return ' <span class="dlt flat">=</span>';
      const cls = good ? 'up' : 'down';
      const ar  = d > 0 ? '\u25b2' : '\u25bc';
      return ' <span class="dlt ' + cls + '">' + ar + ' ' + Math.round(Math.abs(d*100)) + '%</span>';
    }

    function icpBar(a, m, b){
      const t = a + m + b, p = n => t ? (n/t)*100 : 0;
      return '<div class="acq-icp"><i class="a" style="width:' + p(a) + '%"></i>' +
             '<i class="m" style="width:' + p(m) + '%"></i>' +
             '<i class="b" style="width:' + p(b) + '%"></i></div>';
    }

    function renderKpis(m, p){
      const g = m.g, q = p.g;
      const K = [
        ['Inversión', cf(g.inv), delta(g.inv, q.inv, false), 'periodo seleccionado', 0],
        ['Contactos', nf(g.contactos), delta(g.contactos, q.contactos, false), 'entradas de los 3 funnels', g.contactos],
        ['Clics a landing VSL', nf(g.clics), delta(g.clics, q.clics, false), 'los 3 funnels', g.clics],
        ['Agendados', nf(g.agendados), delta(g.agendados, q.agendados, false), 'volumen total', g.agendados],
        ['Calificados', nf(g.calificados), delta(g.calificados, q.calificados, false), cf(g.cq) + ' por calificado', g.calificados, 'alto']
      ];
      document.getElementById('acqKpis').innerHTML = K.map(function(k){
        const grp = k[4] ? ' data-leads="' + k[0] + '" data-n="' + Math.round(k[4]) +
          '"' + (k[5] ? ' data-seg="' + k[5] + '"' : '') + ' data-sub="Acquisition · los 3 funnels"' : '';
        return '<div class="kpi"><div class="k-label">' + k[0] + '</div>' +
               '<div class="k-val"><span' + grp + '>' + k[1] + '</span></div>' +
               '<div class="k-delta">' + (k[2] || '') + ' <span style="color:var(--txt-faint)">' + k[3] + '</span></div></div>';
      }).join('');
    }

    function renderFunnels(m, p){
      document.getElementById('acqFunnels').innerHTML = Object.keys(FUNNELS).map(function(k){
        const c = FUNNELS[k], t = m.fn[k].total, tp = p.fn[k].total, base = t[c.stages[0]];
        const body = c.stages.map(function(s, i){
          const v = t[s], w = base ? (v/base)*100 : 0;
          let rate = 'punto de entrada';
          if(i > 0){
            const bb = S.rate === 'cum' ? base : t[c.stages[i-1]];
            rate = bb ? pf(v/bb) + (S.rate === 'cum'
                  ? ' sobre ' + c.labels[c.stages[0]].toLowerCase()
                  : ' desde ' + c.labels[c.stages[i-1]].toLowerCase()) : '\u2014';
          }
          let qual = '';
          if(s === 'agendados'){
            qual = '<div class="acq-qual"><div class="acq-qual-top">' +
                   '<span class="acq-qual-k">Calificados</span>' +
                   '<span class="acq-qual-v" data-leads="Calificados" data-n="' + t.calificados +
                   '" data-seg="alto" data-sub="Acquisition · ' + c.name + '">' + nf(t.calificados) +
                   '<span class="acq-stg-d">' + delta(t.calificados, tp.calificados, false) + '</span></span></div>' +
                   '<div class="acq-qual-m">' + (v ? pf(t.calificados/v) : '\u2014') + ' de ' + c.labels[s].toLowerCase() +
                   ' \u00b7 ' + (t.calificados ? cf(t.inv/t.calificados) : '\u2014') + ' c/u \u00b7 ICP ' + Math.round(t.icp) + '%</div>' +
                   icpBar(t.icpA, t.icpM, t.icpB) + '</div>';
          }
          return '<div class="acq-stg"><div class="acq-stg-top">' +
                 '<span class="acq-stg-n">' + c.labels[s] + '</span>' +
                 '<span class="acq-stg-v" data-leads="' + c.labels[s] + '" data-n="' + v +
                   '" data-sub="Acquisition · ' + c.name + '">' + nf(v) + '</span>' +
                 '<span class="acq-stg-d">' + delta(v, tp[s], false) + '</span></div>' +
                 '<div class="acq-bar"><i style="width:' + w + '%"></i></div>' +
                 '<div class="acq-stg-m">' + rate + ' · ' + c.costs[s] + ' ' + (v ? cf(t.inv/v) : '—') + '</div>' +
                 qual + '</div>';
        }).join('');
        return '<div class="card"><div class="acq-fhead">' +
               '<div class="acq-ftitle">' +
                 '<div class="acq-fname">' + c.name + '</div>' +
                 '<div class="acq-fentry">entra en ' + c.labels[c.stages[0]].toLowerCase() + ' · ' + m.fn[k].list.length + ' campañas</div>' +
               '</div>' +
               '<div class="acq-fstats">' +
                 '<div class="acq-fs"><span>Inversi\u00f3n</span><b>' + cf(t.inv) + '</b></div>' +
                 '<div class="acq-fs key"><span>Calificados</span><b>' + nf(t.calificados) + '</b></div>' +
                 '<div class="acq-fs key"><span>Costo / calif.</span><b>' + (t.calificados ? cf(t.inv/t.calificados) : '\u2014') + '</b></div>' +
               '</div></div>' +
               '<div class="acq-fbody">' + body + '</div></div>';
      }).join('');
    }

    function renderTables(m, p){
      document.getElementById('acqTables').innerHTML = Object.keys(FUNNELS).map(function(k){
        const c = FUNNELS[k], d = m.fn[k], pd = p.fn[k], open = S.open[k];
        const stages = c.stages.slice(0, c.stages.indexOf('agendados') + 1);
        const grid = 'grid-template-columns:1.7fr .7fr' + ' .85fr'.repeat(stages.length) + ' .8fr .7fr .8fr .9fr';
        const head = '<div class="col-head" style="' + grid + '"><span>Campa\u00f1a</span><span>Inversi\u00f3n</span>' +
                     stages.map(function(s){ return '<span>' + c.labels[s] + '</span>'; }).join('') +
                     '<span>Calificados</span><span>% calif.</span><span>Costo/calif.</span><span>Afinidad ICP</span></div>';
        const row = function(r, pr, tot){
          const cells = stages.map(function(s, i){
            const v = r[s];
            let sub = 'entrada';
            if(i > 0){
              const bb = S.rate === 'cum' ? r[stages[0]] : r[stages[i-1]];
              sub = bb ? pf(v/bb) : '\u2014';
            }
            return '<div class="num"><span data-leads="' + c.labels[s] + ' · ' + (tot ? c.name : r.n) +
              '" data-n="' + Math.round(v) + '" data-sub="Acquisition">' + nf(v) + '</span>' +
              '<div class="acq-sub">' + sub + ' · ' + (v ? cf(r.inv/v) : '—') + '</div></div>';
          }).join('');
          return '<div class="row-i ' + (tot ? 'acq-tot' : '') + '" style="' + grid + '">' +
            '<div><div class="rn">' + (tot ? 'Total del funnel' : r.n) + '</div>' +
            '<div class="rs">' + (tot ? d.list.length + ' campañas' : 'Activa · Meta') + '</div></div>' +
            '<div class="num">' + cf(r.inv) + '</div>' + cells +
            '<div class="num acq-q"><span data-leads="Calificados · ' + (tot ? c.name : r.n) +
              '" data-n="' + Math.round(r.calificados) + '" data-seg="alto" data-sub="Acquisition">' +
              nf(r.calificados) + '</span>' +
              '<div class="acq-sub">' + (delta(r.calificados, pr ? pr.calificados : 0, false) || 'sin comparación') + '</div></div>' +
            '<div class="num">' + (r.agendados ? pf(r.calificados/r.agendados) : '\u2014') + '</div>' +
            '<div class="num">' + (r.calificados ? cf(r.inv/r.calificados) : '\u2014') + '</div>' +
            '<div class="num"><div class="acq-icp-cell"><span style="font-weight:600">' + Math.round(r.icp) + '%</span>' +
              icpBar(r.icpA, r.icpM, r.icpB) + '</div></div></div>';
        };
        const kids = open ? d.list.map(function(r, i){ return row(r, pd.list[i], false); }).join('') : '';
        return '<div class="card" style="margin-bottom:10px">' +
          '<div class="card-head" data-acq-toggle="' + k + '" style="cursor:pointer">' +
          '<span style="color:var(--txt-faint);display:inline-block;transform:rotate(' + (open ? 90 : 0) + 'deg)">\u203a</span> ' +
          c.name + ' <span class="hint">' + d.list.length + ' campañas · hasta calificado · ' + cf(d.total.inv) +
          '<em class="acq-toggle-l">' + (open ? 'ocultar campañas' : 'ver campañas') + '</em></span></div>' +
          (open ? head : '') + '<div class="rows">' + kids + row(d.total, pd.total, true) + '</div></div>';
      }).join('');
      document.querySelectorAll('[data-acq-toggle]').forEach(function(el){
        el.addEventListener('click', function(){
          S.open[el.dataset.acqToggle] = !S.open[el.dataset.acqToggle];
          renderAcq();
        });
      });
    }

    function renderAcq(){
      const w = windows();
      document.getElementById('acqRange').classList.toggle('off', S.period !== 'custom');
      document.getElementById('acqBWrap').classList.toggle('off', S.cmp !== 'custom');
      document.getElementById('acqRangeNote').textContent = w.note;
      renderKpis(build(w.a), build(w.b));
      renderFunnels(build(w.a), build(w.b));
      renderTables(build(w.a), build(w.b));
    }

    window.AIOSDate._cbs.acq = function(kind, f, t, label){
      S.period = (kind === 'hist') ? 'hist' : 'custom';
      if(kind !== 'hist'){ S.from = f; S.to = t; }
      const note = document.getElementById('acqRangeNote');
      if(note) note.textContent = kind === 'hist' ? 'histórico · sin comparación' : label;
      renderAcq();
    };
    document.getElementById('acqPeriodSeg').addEventListener('click', function(e){
      e.target = e.target.closest('button') || e.target;
      if(!e.target.dataset.p) return;
      S.period = e.target.dataset.p;
      const apill = document.getElementById('acqPill');
      if(apill){ apill.classList.remove('active'); apill.querySelector('.pv').textContent = 'Personalizado'; }
      const cmpBar = document.getElementById('acqCmpSeg');
      if(cmpBar) cmpBar.closest('.acq-range') && (cmpBar.closest('.acq-range').style.opacity = S.period==='p1' ? .45 : 1);
      const note = document.getElementById('acqRangeNote');
      if(note && S.period==='p1') note.textContent = 'histórico · sin comparación';
      renderAcq();
    });
    document.getElementById('acqRateSeg').addEventListener('click', function(e){
      e.target = e.target.closest('button') || e.target;
      if(!e.target.dataset.r) return;
      S.rate = e.target.dataset.r; renderAcq();
    });
    document.getElementById('acqCmpSeg').addEventListener('click', function(e){
      if(!e.target.dataset.c) return;
      S.cmp = e.target.dataset.c;
      document.querySelectorAll('#acqCmpSeg span').forEach(function(x){ x.classList.toggle('on', x === e.target); });
      renderAcq();
    });
    ['acqA1','acqA2','acqB1','acqB2'].forEach(function(id){
      document.getElementById(id).addEventListener('change', renderAcq);
    });

    renderAcq();
  })();
}
