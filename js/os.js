/* OS core: state, settings, theme, gestures, popups, notifications, weather. */
'use strict';

const OS = window.OS = {
  W: 412, H: 915, scale: 1,
  apps: {}, running: [], current: null,
  notifs: [], bus: {}, el: {},
  state: { locked: true, off: false, recents: false, drawer: false, shade: 0 },
};

OS.on = (ev, fn) => ((OS.bus[ev] ||= []).push(fn), fn);
OS.emit = (ev, ...a) => (OS.bus[ev] || []).slice().forEach(f => { try { f(...a); } catch (e) { console.error(ev, e); } });

/* ---------- settings ---------- */
const CFG_DEFAULTS = {
  dark: true, wp: 0, hue: null, themed: false, customWp: null, pin: '',
  brightness: 85, wifi: true, bt: true, dnd: false, airplane: false, nightlight: false,
  saver: false, location: true, hotspot: false, rotate: true, flash: false, record: false,
  volume: { media: 55, ring: 70, alarm: 80 }, ringer: 'sound', devTaps: 0,
  units: /^en-US/.test(navigator.language) ? 'F' : 'C', network: 'Pixel_Home_5G',
};
OS.cfg = Object.assign({}, CFG_DEFAULTS, Store.get('cfg', {}));
OS.cfg.volume = Object.assign({}, CFG_DEFAULTS.volume, OS.cfg.volume);
OS.save = () => Store.set('cfg', OS.cfg);
OS.set = (k, v) => { OS.cfg[k] = v; OS.save(); OS.emit('cfg', k, v); OS.emit('cfg:' + k, v); };

/* ---------- wallpapers & theme ---------- */
OS.WALLPAPERS = [
  { name: 'Bloom', hue: 268, css: 'radial-gradient(75% 50% at 15% 10%,#7ea6ff 0,transparent 70%),radial-gradient(60% 45% at 95% 38%,#f08fc4 0,transparent 70%),radial-gradient(85% 55% at 25% 100%,#58dcc2 0,transparent 70%),linear-gradient(165deg,#1b2159,#3a1c63)' },
  { name: 'Dusk', hue: 28, css: 'radial-gradient(80% 50% at 80% 0,#ffb36b 0,transparent 70%),radial-gradient(70% 50% at 0 55%,#d9507e 0,transparent 70%),radial-gradient(90% 60% at 70% 100%,#6a3cc2 0,transparent 70%),linear-gradient(170deg,#2a1346,#5b1f4d)' },
  { name: 'Lagoon', hue: 205, css: 'radial-gradient(70% 45% at 90% 8%,#6ee7ff 0,transparent 70%),radial-gradient(70% 55% at 5% 60%,#2c7bd9 0,transparent 70%),radial-gradient(90% 50% at 60% 100%,#37d6a1 0,transparent 72%),linear-gradient(170deg,#08284d,#0b4a63)' },
  { name: 'Meadow', hue: 150, css: 'radial-gradient(70% 45% at 15% 5%,#c9f27a 0,transparent 70%),radial-gradient(75% 55% at 95% 55%,#37b58c 0,transparent 70%),radial-gradient(80% 55% at 20% 100%,#1f7a54 0,transparent 72%),linear-gradient(170deg,#0d3b2e,#14513a)' },
  { name: 'Ember', hue: 38, css: 'radial-gradient(70% 45% at 85% 5%,#ffd166 0,transparent 70%),radial-gradient(70% 55% at 0 60%,#f2623a 0,transparent 70%),radial-gradient(85% 50% at 80% 100%,#b02a4f 0,transparent 72%),linear-gradient(170deg,#3a1114,#5a1d24)' },
  { name: 'Orchid', hue: 322, css: 'radial-gradient(70% 45% at 10% 8%,#ff9be0 0,transparent 70%),radial-gradient(65% 50% at 100% 50%,#9a6bff 0,transparent 70%),radial-gradient(85% 55% at 30% 100%,#4aa8ff 0,transparent 72%),linear-gradient(170deg,#2a0f46,#46145e)' },
  { name: 'Midnight', hue: 250, css: 'radial-gradient(60% 40% at 50% 0,#4a5bd6 0,transparent 70%),radial-gradient(80% 55% at 0 100%,#1c2b80 0,transparent 72%),linear-gradient(170deg,#070914,#0f1230)' },
  { name: 'Graphite', hue: 230, css: 'radial-gradient(60% 40% at 80% 5%,#6b7280 0,transparent 70%),radial-gradient(80% 55% at 10% 100%,#3b4252 0,transparent 72%),linear-gradient(170deg,#16181d,#262a33)' },
];
OS.ACCENTS = [268, 232, 200, 160, 120, 80, 50, 25, 355, 322];

OS.applyTheme = () => {
  const c = OS.cfg, wp = OS.WALLPAPERS[c.wp] || OS.WALLPAPERS[0];
  document.body.classList.toggle('dark', !!c.dark);
  document.body.classList.toggle('themed', !!c.themed);
  document.body.classList.toggle('saver', !!c.saver);
  document.body.style.setProperty('--h', c.hue ?? wp.hue);
  const wcss = c.customWp ? `center/cover url(${c.customWp})` : wp.css;
  OS.el.wallpaper.style.background = wcss;
  OS.el.lock.style.background = `linear-gradient(rgba(0,0,0,.12),rgba(0,0,0,.4)),${wcss}`;
  OS.el.dim.style.opacity = (1 - c.brightness / 100) * .7;
  OS.el.night.style.opacity = c.nightlight ? 1 : 0;
  OS.emit('theme');
};

/* ---------- geometry ---------- */
OS.rect = el => {
  const s = OS.el.screen.getBoundingClientRect(), r = el.getBoundingClientRect(), k = OS.scale;
  return { x: (r.left - s.left) / k, y: (r.top - s.top) / k, w: r.width / k, h: r.height / k };
};

OS.fit = () => {
  const vw = innerWidth, vh = innerHeight, mobile = vw <= 520;
  document.body.classList.toggle('mobile', mobile);
  let s, H;
  if (mobile) { s = vw / OS.W; H = Math.round(vh / s); }
  else { H = 915; s = Math.min((vh - 32) / (H + 18), (vw - 110) / (OS.W + 18), 1.3); }
  OS.scale = s; OS.H = H;
  const r = document.documentElement.style;
  r.setProperty('--s', s); r.setProperty('--H', H + 'px');
  OS.emit('resize');
};

/* ---------- gesture helper (pointer based, scale-aware) ---------- */
OS.gesture = (el, o) => {
  el.addEventListener('pointerdown', e => {
    if ((e.pointerType === 'mouse' && e.button !== 0) || (o.filter && !o.filter(e))) return;
    const k = OS.scale, id = e.pointerId, x0 = e.clientX, y0 = e.clientY;
    let pts = [{ x: x0, y: y0, t: performance.now() }], active = false, dead = false;
    const rm = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
    function mv(ev) {
      if (ev.pointerId !== id || dead) return;
      const dx = (ev.clientX - x0) / k, dy = (ev.clientY - y0) / k;
      pts.push({ x: ev.clientX, y: ev.clientY, t: performance.now() }); if (pts.length > 6) pts.shift();
      if (!active) {
        if (Math.hypot(dx, dy) < (o.threshold ?? 8)) return;
        const axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        const dir = axis === 'x' ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        if ((o.axis && o.axis !== axis) || (o.dirs && !o.dirs.includes(dir)) || (o.start && o.start({ dx, dy, axis, dir, e: ev }) === false)) { dead = true; rm(); return; }
        active = true; try { el.setPointerCapture(id); } catch { }
      }
      o.move && o.move({ dx, dy, e: ev });
    }
    function up(ev) {
      if (ev.pointerId !== id) return;
      rm();
      if (dead) return;
      if (active) {
        const a = pts[0], b = pts[pts.length - 1], dt = Math.max(1, b.t - a.t);
        o.end && o.end({ dx: (ev.clientX - x0) / k, dy: (ev.clientY - y0) / k, vx: (b.x - a.x) / k / dt, vy: (b.y - a.y) / k / dt, cancelled: ev.type === 'pointercancel', e: ev });
        const stop = c => { c.stopPropagation(); c.preventDefault(); };
        addEventListener('click', stop, { capture: true, once: true });
        setTimeout(() => removeEventListener('click', stop, true), 50);
      } else if (ev.type === 'pointerup') o.tap && o.tap(ev);
    }
    addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  });
};

OS.longPress = (el, cb, ms = 480) => {
  let lastType = 'touch';
  el.addEventListener('pointerdown', e => {
    lastType = e.pointerType;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const x = e.clientX, y = e.clientY;
    const cancel = () => { clearTimeout(t); removeEventListener('pointermove', mv); removeEventListener('pointerup', cancel); removeEventListener('pointercancel', cancel); };
    const t = setTimeout(() => {
      cancel(); cb(e);
      addEventListener('pointerup', () => {
        const stop = c => { c.stopPropagation(); c.preventDefault(); };
        addEventListener('click', stop, { capture: true, once: true });
        setTimeout(() => removeEventListener('click', stop, true), 60);
      }, { once: true });
    }, ms);
    const mv = ev => { if (Math.hypot(ev.clientX - x, ev.clientY - y) > 10) cancel(); };
    addEventListener('pointermove', mv); addEventListener('pointerup', cancel); addEventListener('pointercancel', cancel);
  });
  el.addEventListener('contextmenu', e => { e.preventDefault(); if (lastType === 'mouse') cb(e); });
};

/* ---------- app registry & icons ---------- */
OS.register = app => { OS.apps[app.id] = app; return app; };

OS.iconEl = (app, size) => {
  const ic = app.icon || {};
  const el = h('div.ai', { style: size ? { '--ai': size + 'px' } : null });
  el.dataset.app = app.id;
  el.innerHTML = `<i class="ai-bg" style="background:${ic.bg || '#5f6368'}"></i>` +
    (ic.special ? `<span class="ai-special">${ic.special}</span>` : '') +
    (ic.glyph ? `<span class="mi ai-glyph ${ic.fill === false ? '' : 'fill'} ${ic.special ? 'alt' : ''}" style="color:${ic.fg || '#fff'}">${ic.glyph}</span>` : '');
  return el;
};

/* ---------- toast / popup menu / dialog ---------- */
OS.toast = (msg, ms = 2200) => {
  const t = OS.el.toast; t.textContent = msg; t.classList.add('show');
  clearTimeout(OS._toast); OS._toast = setTimeout(() => t.classList.remove('show'), ms);
};

OS.popups = [];
OS._popup = (node, scrimClass = '') => {
  const scrim = h('div.pscrim' + (scrimClass ? '.' + scrimClass : ''), node);
  const rec = { close() { scrim.classList.remove('in'); setTimeout(() => scrim.remove(), 160); OS.popups = OS.popups.filter(p => p !== rec); rec.onclose && rec.onclose(); }, scrim };
  scrim.addEventListener('pointerdown', e => { if (e.target === scrim) { e.preventDefault(); rec.close(); } });
  OS.el.popups.append(scrim); requestAnimationFrame(() => scrim.classList.add('in'));
  OS.popups.push(rec); return rec;
};
OS.closePopups = () => { const had = OS.popups.length > 0; OS.popups.slice().forEach(p => p.close()); return had; };

OS.menu = (at, items) => {
  const m = h('div.menu', items.map(it => it === '-' ? h('div.menu-sep') :
    h('div.menu-item' + (it.danger ? '.danger' : ''), { onclick: () => { rec.close(); it.cb && it.cb(); } },
      it.icon ? mi(it.icon) : null, h('span', it.label))));
  const rec = OS._popup(m);
  const W = OS.W, H = OS.H, w = 230, hh = items.length * 48 + 16;
  let x = clamp(at.x - 8, 12, W - w - 12), y = at.y + (at.h || 0) + 8;
  if (y + hh > H - 40) y = Math.max(50, at.y - hh - 8);
  m.style.left = x + 'px'; m.style.top = y + 'px';
  return rec;
};

OS.dialog = ({ title, icon, body, actions = [{ label: 'OK', primary: true }], dismiss = true, wide }) => {
  const acts = actions.map(a => h('button.dbtn' + (a.primary ? '.pri' : ''), {
    onclick: () => { if (!a.cb || a.cb(rec) !== false) rec.close(); },
  }, a.label));
  const d = h('div.dialog' + (wide ? '.wide' : ''),
    icon ? h('div.d-ic', mi(icon)) : null,
    title ? h('div.d-title' + (icon ? '.center' : ''), title) : null,
    body ? h('div.d-body', typeof body === 'string' ? { html: body } : null, typeof body === 'string' ? null : body) : null,
    h('div.d-actions', acts));
  const rec = OS._popup(d, 'dim');
  if (!dismiss) rec.scrim.onpointerdown = null;
  return rec;
};

OS.prompt = (title, { value = '', placeholder = '', type = 'text', ok = 'OK' } = {}) => new Promise(res => {
  const inp = h('input.d-input', { value, placeholder, type, autocomplete: 'off' });
  const rec = OS.dialog({
    title, body: inp, actions: [
      { label: 'Cancel', cb: () => res(null) },
      { label: ok, primary: true, cb: () => res(inp.value) },
    ],
  });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { res(inp.value); rec.close(); } });
  setTimeout(() => inp.focus(), 120);
});

/* ---------- notifications ---------- */
OS.notify = n => {
  n.id ||= uid(); n.time ||= Date.now();
  if (n.key) OS.notifs = OS.notifs.filter(x => x.key !== n.key);
  OS.notifs.unshift(n);
  OS.emit('notifs');
  const fg = OS.current === n.app && !OS.state.locked && !OS.state.off;
  if (!n.silent && !OS.cfg.dnd && !fg) { OS.emit('headsup', n); Sound.chime(); }
  return n.id;
};
OS.dismiss = id => { OS.notifs = OS.notifs.filter(n => n.id !== id); OS.emit('notifs'); };
OS.dismissKey = key => { OS.notifs = OS.notifs.filter(n => n.key !== key); OS.emit('notifs'); };
OS.clearNotifs = () => { OS.notifs = OS.notifs.filter(n => n.ongoing); OS.emit('notifs'); };

/* ---------- battery ---------- */
OS.battery = { level: .82, charging: false };
if (navigator.getBattery) {
  navigator.getBattery().then(b => {
    const upd = () => {
      if (b.level === 1 && b.charging) return; // desktop without a battery: keep the simulated value
      OS.battery.level = b.level; OS.battery.charging = b.charging; OS.emit('battery');
    };
    ['levelchange', 'chargingchange'].forEach(ev => b.addEventListener(ev, upd)); upd();
  }).catch(() => { });
}

/* ---------- weather (Open-Meteo, with generated fallback) ---------- */
OS.weather = { loaded: false, place: 'Mountain View', lat: 37.386, lon: -122.084, temp: 72, cond: 'Sunny', icon: 'sunny', hi: 76, lo: 56, hourly: [], daily: [] };
const WMO = (c, night) => {
  if (c === 0) return night ? ['Clear', 'clear_night'] : ['Sunny', 'sunny'];
  if (c <= 2) return night ? ['Partly cloudy', 'partly_cloudy_night'] : ['Partly cloudy', 'partly_cloudy_day'];
  if (c === 3) return ['Cloudy', 'cloud'];
  if (c <= 48) return ['Fog', 'foggy'];
  if (c <= 57) return ['Drizzle', 'rainy_light'];
  if (c <= 67) return ['Rain', 'rainy'];
  if (c <= 77) return ['Snow', 'weather_snowy'];
  if (c <= 82) return ['Showers', 'rainy'];
  if (c <= 86) return ['Snow showers', 'weather_snowy'];
  return ['Thunderstorms', 'thunderstorm'];
};
OS.temp = f => OS.cfg.units === 'F' ? Math.round(f) : Math.round((f - 32) * 5 / 9);
OS.loadWeather = async () => {
  const w = OS.weather;
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${w.lat}&longitude=${w.lon}&current=temperature_2m,weather_code,is_day&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto&forecast_days=7`;
    const r = await fetch(u, { signal: AbortSignal.timeout(6000) }); const j = await r.json();
    const [cond, icon] = WMO(j.current.weather_code, !j.current.is_day);
    Object.assign(w, { temp: j.current.temperature_2m, cond, icon, hi: j.daily.temperature_2m_max[0], lo: j.daily.temperature_2m_min[0] });
    const now = new Date(j.current.time).getTime();
    w.hourly = j.hourly.time.map((t, i) => ({ d: new Date(t), temp: j.hourly.temperature_2m[i], code: j.hourly.weather_code[i] }))
      .filter(x => x.d.getTime() >= now - 3600e3).slice(0, 24)
      .map(x => ({ d: x.d, temp: x.temp, icon: WMO(x.code, x.d.getHours() < 6 || x.d.getHours() >= 20)[1] }));
    w.daily = j.daily.time.map((t, i) => ({ d: new Date(t + 'T12:00'), hi: j.daily.temperature_2m_max[i], lo: j.daily.temperature_2m_min[i], icon: WMO(j.daily.weather_code[i])[1], cond: WMO(j.daily.weather_code[i])[0] }));
    w.live = true;
  } catch (err) {
    // offline: plausible generated data
    const n = new Date(), hr = n.getHours();
    const t = hx => 64 + 11 * Math.sin((hx - 9) / 24 * Math.PI * 2);
    w.temp = t(hr); w.cond = 'Sunny'; w.icon = (hr < 6 || hr >= 20) ? 'clear_night' : 'sunny'; w.hi = 75; w.lo = 53;
    w.hourly = Array.from({ length: 24 }, (_, i) => { const d = new Date(n.getTime() + i * 3600e3); return { d, temp: t(d.getHours()), icon: (d.getHours() < 6 || d.getHours() >= 20) ? 'clear_night' : (i % 7 === 4 ? 'partly_cloudy_day' : 'sunny') }; });
    const ic = ['sunny', 'partly_cloudy_day', 'sunny', 'cloud', 'rainy', 'partly_cloudy_day', 'sunny'];
    w.daily = Array.from({ length: 7 }, (_, i) => ({ d: new Date(n.getTime() + i * 864e5), hi: 74 - (i % 3) * 3, lo: 54 - (i % 2) * 2, icon: ic[i], cond: '' }));
    w.live = false;
  }
  w.loaded = true; OS.emit('weather');
};
