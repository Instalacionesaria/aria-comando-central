/**
 * <aria-mascot> — la mascota de ARIA (Brandbook v2.0).
 * Web component sin dependencias: funciona en React/Next, Vue o HTML plano.
 *
 * Atributos:
 *   size    diámetro visible en px (por defecto 160). Mínimo 48; debajo usa la versión mínima (sin ojos).
 *   state   neutral | pensando | escuchando | hallazgo | celebra | alerta | cargando | sin-conexion
 *   follow  si está presente, los ojos siguen el cursor (portada, asistente, login).
 *
 * Reglas de la mirada (sección Mascota del brandbook): solo se mueven los ojos; recorrido
 * máx. 9% del diámetro en X y 6% en Y; suavizado 0.12/frame; vuelve al centro tras 3 s
 * sin movimiento; parpadeo cada 3–6 s; en táctil mira hacia el último toque;
 * con prefers-reduced-motion queda fija y no parpadea.
 */
(function () {
  if (typeof window === 'undefined' || customElements.get('aria-mascot')) return;
  const INK = '#04060A', C = '#8FE3FF', ALERT = '#FF8C7A';
  let uid = 0;
  const eyes = {
    pill: '<rect x="84" y="83" width="8" height="18" rx="4" fill="' + INK + '"/><rect x="108" y="83" width="8" height="18" rx="4" fill="' + INK + '"/>',
    up: '<rect x="90" y="77" width="8" height="18" rx="4" fill="' + INK + '"/><rect x="114" y="77" width="8" height="18" rx="4" fill="' + INK + '"/>',
    small: '<rect x="84" y="87" width="8" height="14" rx="4" fill="' + INK + '"/><rect x="108" y="87" width="8" height="14" rx="4" fill="' + INK + '"/>',
    wide: '<circle cx="88" cy="92" r="7" fill="' + INK + '"/><circle cx="112" cy="92" r="7" fill="' + INK + '"/>',
    arc: '<path d="M82 96 Q88 86 94 96" fill="none" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/><path d="M106 96 Q112 86 118 96" fill="none" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/>',
    closed: '<path d="M82 94 L94 94" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/><path d="M106 94 L118 94" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/>'
  };
  const ringDots = (n, r, start) => Array.from({ length: n }, (_, k) => {
    const a = start + k * 2 * Math.PI / n;
    return '<circle cx="' + (100 + r * Math.cos(a)).toFixed(1) + '" cy="' + (100 + r * Math.sin(a)).toFixed(1) + '" r="3" fill="' + C + '"/>';
  }).join('');
  const STATES = {
    'neutral': { eyes: 'pill', extra: '' },
    'pensando': { eyes: 'up', extra: '<circle cx="100" cy="100" r="80" fill="none" stroke="#242C3A" stroke-width="1.5" stroke-dasharray="3 6"/>' + ringDots(3, 80, -1.2) },
    'escuchando': { eyes: 'pill', extra: '<path d="M168 82 Q176 100 168 118" fill="none" stroke="' + C + '" stroke-width="2" stroke-linecap="round"/><path d="M180 74 Q192 100 180 126" fill="none" stroke="' + C + '" stroke-opacity="0.5" stroke-width="2" stroke-linecap="round"/>' },
    'hallazgo': { eyes: 'wide', extra: '<path d="M156 46 L156 62 M148 54 L164 54" stroke="' + C + '" stroke-width="2.5" stroke-linecap="round"/>' },
    'celebra': { eyes: 'arc', extra: ringDots(8, 82, 0) },
    'alerta': { eyes: 'small', extra: '<circle cx="150" cy="52" r="7" fill="' + ALERT + '"/>' },
    'cargando': { eyes: 'closed', extra: '<circle cx="100" cy="100" r="80" fill="none" stroke="#161D29" stroke-width="1.5"/><path d="M100 20 A80 80 0 0 1 169.3 140" fill="none" stroke="' + C + '" stroke-width="2.5" stroke-linecap="round"/>' },
    'sin-conexion': { eyes: 'closed', extra: '', gray: true }
  };

  class AriaMascot extends HTMLElement {
    static get observedAttributes() { return ['size', 'state', 'follow']; }
    connectedCallback() { this.render(); this.setupFollow(); }
    disconnectedCallback() { this.teardown(); }
    attributeChangedCallback() { if (this.isConnected) { this.teardown(); this.render(); this.setupFollow(); } }

    render() {
      const size = Math.max(16, parseInt(this.getAttribute('size') || '160', 10));
      const key = STATES[this.getAttribute('state')] ? this.getAttribute('state') : 'neutral';
      const st = STATES[key];
      const id = 'am' + (++uid);
      const stops = st.gray ? ['#E9EDF2', '#AAB3C1', '#5B6576', '#3A4456', '#0A0F18'] : ['#FFFFFF', C, '#4A78FF', '#4B3FD9', '#07061A'];
      const minimal = size < 48; // versión mínima: sin ojos
      this.innerHTML =
        '<svg width="' + size + '" height="' + size + '" viewBox="0 0 200 200" role="img" aria-label="ARIA" style="display:block;overflow:visible">' +
        '<defs><radialGradient id="' + id + 'b" cx="0.36" cy="0.32" r="0.72">' +
        stops.map((c, i) => '<stop offset="' + [0, .16, .45, .75, 1][i] + '" stop-color="' + c + '"/>').join('') +
        '</radialGradient><radialGradient id="' + id + 'h" cx="0.5" cy="0.5" r="0.5"><stop offset="0.5" stop-color="#4A78FF" stop-opacity="' + (st.gray ? 0 : 0.35) + '"/><stop offset="1" stop-color="#4A78FF" stop-opacity="0"/></radialGradient></defs>' +
        (minimal ? '' : '<circle cx="100" cy="100" r="96" fill="url(#' + id + 'h)"/>' + st.extra) +
        '<circle cx="100" cy="100" r="58" fill="url(#' + id + 'b)"/>' +
        (minimal ? '' : '<g class="eyes"><g class="lids" style="transform-origin:100px 92px;transition:transform .08s">' + eyes[st.eyes] + '</g></g>') +
        '</svg>';
      this.style.display = 'inline-block';
    }

    setupFollow() {
      const g = this.querySelector('.eyes'); const lids = this.querySelector('.lids');
      if (!g) return;
      const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) return;
      // parpadeo (en todos los estados con ojos abiertos)
      const blink = () => { lids.style.transform = 'scaleY(0.1)'; setTimeout(() => { lids.style.transform = ''; }, 120); this._bt = setTimeout(blink, 3000 + Math.random() * 3000); };
      this._bt = setTimeout(blink, 2500);
      if (!this.hasAttribute('follow')) return;
      let tx = 0, ty = 0, x = 0, y = 0, last = Date.now();
      const aim = (cx0, cy0) => {
        const r = this.getBoundingClientRect();
        const dx = cx0 - (r.left + r.width / 2), dy = cy0 - (r.top + r.height / 2);
        const dist = Math.hypot(dx, dy) || 1, k = Math.min(1, dist / (r.width * 1.5));
        // unidades del viewBox (200): 9% y 6% del diámetro del orb (116)
        tx = dx / dist * 116 * 0.09 * k; ty = dy / dist * 116 * 0.06 * k; last = Date.now();
      };
      this._move = (e) => aim(e.clientX, e.clientY);
      this._touch = (e) => { const t = e.touches && e.touches[0]; if (t) aim(t.clientX, t.clientY); };
      this._leave = () => { tx = 0; ty = 0; };
      document.addEventListener('mousemove', this._move);
      document.addEventListener('touchstart', this._touch, { passive: true });
      document.addEventListener('mouseleave', this._leave);
      const tick = () => {
        if (Date.now() - last > 3000) { tx = 0; ty = 0; }
        x += (tx - x) * 0.12; y += (ty - y) * 0.12;
        g.setAttribute('transform', 'translate(' + x.toFixed(2) + ' ' + y.toFixed(2) + ')');
        this._raf = requestAnimationFrame(tick);
      };
      this._raf = requestAnimationFrame(tick);
    }

    teardown() {
      clearTimeout(this._bt); cancelAnimationFrame(this._raf);
      if (this._move) document.removeEventListener('mousemove', this._move);
      if (this._touch) document.removeEventListener('touchstart', this._touch);
      if (this._leave) document.removeEventListener('mouseleave', this._leave);
    }
  }
  customElements.define('aria-mascot', AriaMascot);
})();
