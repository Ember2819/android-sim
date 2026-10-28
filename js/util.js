/* Small helpers shared by the OS and the apps. */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/** Hyperscript: h('div.card#id', {onclick, style:{...}}, child, ...) */
function h(tag, props, ...kids) {
  const m = tag.match(/^([a-z0-9-]*)((?:[.#][\w-]+)*)$/i);
  const el = document.createElement(m[1] || 'div');
  (m[2].match(/[.#][\w-]+/g) || []).forEach(t => t[0] === '.' ? el.classList.add(t.slice(1)) : (el.id = t.slice(1)));
  if (props && (typeof props !== 'object' || props.nodeType || Array.isArray(props))) { kids.unshift(props); props = null; }
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className += ' ' + v;
    else if (k === 'style') typeof v === 'string' ? el.style.cssText += v : Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && k !== 'list') { try { el[k] = v; } catch { el.setAttribute(k, v); } }
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = k => {
    if (k == null || k === false) return;
    if (Array.isArray(k)) k.forEach(add);
    else el.append(k.nodeType ? k : document.createTextNode(k));
  };
  kids.forEach(add);
  return el;
}

/** Material Symbols icon element / html string */
const mi = (name, cls = '') => h('span.mi' + (cls ? '.' + cls.split(' ').join('.') : ''), name);
const I = (name, cls = '') => `<span class="mi ${cls}">${name}</span>`;

const Store = {
  get(k, d) { try { const v = localStorage.getItem('pixel11:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('pixel11:' + k, JSON.stringify(v)); return true; } catch { return false; } },
  clear() { Object.keys(localStorage).filter(k => k.startsWith('pixel11:')).forEach(k => localStorage.removeItem(k)); },
};

const pad = n => String(n).padStart(2, '0');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const uid = () => Math.random().toString(36).slice(2, 9);

const fmtTime = (d, opts = {}) => {
  let hr = d.getHours(); const m = pad(d.getMinutes());
  const h24 = opts.h24 ?? (window.OS && OS.cfg && OS.cfg.h24);
  if (h24) return pad(hr) + ':' + m;
  const ap = hr >= 12 ? 'PM' : 'AM'; hr = hr % 12 || 12;
  return opts.noAp ? `${hr}:${m}` : `${hr}:${m} ${ap}`;
};
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtDate = (d, long) => long
  ? `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
  : `${DAYS[d.getDay()].slice(0, 3)}, ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
const timeAgo = ts => {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
};

/* ---- tiny WebAudio synth (alarm, timer, notification chime, key clicks) ---- */
const Sound = {
  ctx: null,
  _c() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { } } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); return this.ctx; },
  tone(freq, dur = .15, { type = 'sine', vol = .15, at = 0 } = {}) {
    const c = this._c(); if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .02);
  },
  vol(kind) { return (window.OS && OS.cfg ? OS.cfg.volume[kind] : 60) / 100; },
  chime() { const v = this.vol('ring') * .25; if (!v || (OS.cfg.ringer !== 'sound')) return; this.tone(880, .25, { vol: v }); this.tone(1318, .4, { vol: v, at: .12 }); },
  click() { const v = this.vol('media') * .08; if (v) this.tone(1800, .03, { type: 'square', vol: v }); },
  alarm(i = 0) { const v = this.vol('alarm') * .25; [0, .18, .36, .54].forEach(a => this.tone(1000, .1, { type: 'square', vol: v, at: a })); },
  shutter() { this.tone(2400, .04, { type: 'square', vol: .06 }); this.tone(1200, .06, { type: 'square', vol: .06, at: .06 }); },
  dtmf(k) {
    const rows = [697, 770, 852, 941], cols = [1209, 1336, 1477];
    const keys = '123456789*0#'; const i = keys.indexOf(k); if (i < 0) return;
    this.tone(rows[Math.floor(i / 3)], .12, { vol: .06 }); this.tone(cols[i % 3], .12, { vol: .06 });
  },
};

/* Mouse drag-to-scroll for any .scroll / .scroll-x container (mimics touch on desktop) */
(function dragScroll() {
  document.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    if (e.target.closest('input,textarea,select,[contenteditable],.no-drag')) return;
    let sc = e.target.closest('.scroll,.scroll-x');
    // choose the nearest ancestor that can actually scroll
    while (sc && !(sc.scrollHeight > sc.clientHeight + 2 && sc.classList.contains('scroll')) && !(sc.scrollWidth > sc.clientWidth + 2 && sc.classList.contains('scroll-x'))) {
      sc = sc.parentElement && sc.parentElement.closest('.scroll,.scroll-x');
    }
    if (!sc) return;
    const x0 = e.clientX, y0 = e.clientY, sl = sc.scrollLeft, st = sc.scrollTop;
    const k = (window.OS && OS.scale) || 1;
    let moved = false;
    const mv = ev => {
      const dx = (ev.clientX - x0) / k, dy = (ev.clientY - y0) / k;
      if (!moved && Math.hypot(dx, dy) > 6) moved = true;
      if (moved) { if (sc.classList.contains('scroll-x')) sc.scrollLeft = sl - dx; else sc.scrollTop = st - dy; }
    };
    const up = () => {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      if (moved) { const stop = ev => { ev.stopPropagation(); ev.preventDefault(); }; addEventListener('click', stop, { capture: true, once: true }); setTimeout(() => removeEventListener('click', stop, true), 0); }
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  });
})();

/* range inputs: keep the --v fill variable in sync */
function bindRange(input, onChange) {
  const upd = () => input.style.setProperty('--v', ((input.value - input.min) / (input.max - input.min) * 100) + '%');
  input.classList.add('sl', 'no-drag'); upd();
  input.addEventListener('input', () => { upd(); onChange && onChange(+input.value); });
  return input;
}
const slider = (min, max, val, onChange) => bindRange(h('input', { type: 'range', min, max, value: val }), onChange);

function toggleSwitch(on, onChange) {
  const el = h('div.sw' + (on ? '.on' : ''), { role: 'switch' });
  el.set = v => { el.classList.toggle('on', !!v); };
  el.addEventListener('click', e => { e.stopPropagation(); const v = !el.classList.contains('on'); el.set(v); onChange && onChange(v); });
  return el;
}
