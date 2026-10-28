/* System UI: status bar, launcher, drawer, app windows, recents, shade, lock screen. */
'use strict';

(() => {
const E = () => OS.el;
const ease = 'cubic-bezier(.2,0,0,1)';

OS.initShell = () => {
  const g = id => document.getElementById(id);
  OS.el = {
    screen: g('screen'), wallpaper: g('wallpaper'), home: g('home'), pages: g('pages'), dots: g('page-dots'), dock: g('dock'),
    search: g('searchbar'), drawer: g('drawer'), dlist: g('drawer-list'), dsug: g('drawer-suggest'), dq: g('drawer-q'),
    apps: g('apps'), recents: g('recents'), popups: g('popups'), edgeL: g('edge-l'), edgeR: g('edge-r'), nav: g('nav-zone'),
    shade: g('shade'), headsup: g('headsup'), sb: g('statusbar'), lock: g('lock'), volume: g('volume'), ring: g('alarm-ring'),
    toast: g('toast'), night: g('nightlight'), dim: g('dim'), aod: g('aod'), boot: g('boot'),
  };
  buildStatusBar(); buildHome(); buildDrawer(); buildRecents(); buildShade(); buildLock(); buildHardware();
  OS.on('resize', () => { layoutRecents(false); });
};

/* ================= status bar ================= */
function buildStatusBar() {
  const sb = E().sb;
  sb.innerHTML = `<div class="sb-l"><span class="sb-time"></span><span class="sb-notifs"></span></div>
    <div class="sb-r"><span class="mi sb-ic" id="sb-dnd">do_not_disturb_on</span><span class="mi sb-ic fill" id="sb-bt">bluetooth</span>
    <span class="mi sb-ic" id="sb-flash">flashlight_on</span><span class="mi sb-ic" id="sb-rec">screen_record</span>
    <span class="mi sb-ic fill" id="sb-wifi">wifi</span><span class="mi sb-ic fill" id="sb-sig">signal_cellular_4_bar</span>
    <span class="batt-wrap"><span class="batt"><i></i></span><span class="mi bolt fill">bolt</span></span></div>`;
  OS.gesture(sb, {
    axis: 'y', dirs: ['down'], filter: () => !OS.state.locked && !OS.state.off,
    start: () => { shadeDrag.p0 = OS.state.shade ? 1 : 0; return true; },
    move: ({ dy }) => setShade(clamp(shadeDrag.p0 + dy / (OS.H * .6), 0, 1), false),
    end: ({ dy, vy }) => shadeTo(shadeDrag.p0 + dy / (OS.H * .6) > .3 || vy > .4),
  });
  const upd = () => {
    const c = OS.cfg, ap = c.airplane;
    const show = (id, v) => $('#' + id).style.display = v ? '' : 'none';
    show('sb-dnd', c.dnd); show('sb-bt', c.bt && !ap); show('sb-flash', c.flash); show('sb-rec', c.record);
    show('sb-wifi', c.wifi && !ap);
    $('#sb-sig').textContent = ap ? 'flight' : 'signal_cellular_4_bar';
    const b = OS.battery;
    sb.querySelector('.batt i').style.width = (b.level * 100) + '%';
    sb.classList.toggle('low', b.level <= .15 && !b.charging); sb.classList.toggle('charging', b.charging); sb.classList.toggle('saver', c.saver);
    renderSbNotifs(); updateClock();
  };
  OS.on('cfg', upd); OS.on('battery', upd); OS.on('notifs', upd); upd();
}
function renderSbNotifs() {
  const box = $('.sb-notifs'); box.innerHTML = '';
  const seen = [...new Set(OS.notifs.filter(n => !n.silent).map(n => n.app))];
  seen.slice(0, 3).forEach(a => { const d = OS.apps[a]; box.append(h('span.mi.sb-ic.fill', d && d.icon && d.icon.glyph || 'notifications')); });
  if (seen.length > 3) box.append(h('span.sb-dot'));
}

OS.updateSB = () => {
  const s = OS.state, dark = OS.cfg.dark; let v = 'light';
  if (s.locked || s.off) v = 'light';
  else if (s.shade) v = dark ? 'light' : 'dark';
  else if (s.drawer) v = dark ? 'light' : 'dark';
  else if (OS.current) v = OS.apps[OS.current].sb || (dark ? 'light' : 'dark');
  E().screen.dataset.sb = v;
  E().screen.classList.toggle('on-home', !OS.current && !s.locked);
};

/* ================= clock tick ================= */
let lastMin = -1;
function updateClock() {
  const d = new Date();
  $('.sb-time').textContent = fmtTime(d, { noAp: true });
  const hh = d.getHours() % 12 || 12, mm = pad(d.getMinutes());
  const lh = $('.lk-h'), lm = $('.lk-m');
  if (lh) { lh.textContent = OS.cfg.h24 ? pad(d.getHours()) : pad(hh); lm.textContent = mm; $('.lk-date').firstChild.textContent = fmtDate(d) + '  '; }
  const gd = $('.gl-date'); if (gd) gd.textContent = fmtDate(d);
  const wc = $('.wc-time'); if (wc) { wc.textContent = fmtTime(d, { noAp: true }); $('.wc-date').textContent = fmtDate(d, true); }
  const aod = $('.aod-t'); if (aod) { aod.textContent = fmtTime(d, { noAp: true }); $('.aod-d').textContent = fmtDate(d); }
  const shd = $('.sh-date'); if (shd) shd.textContent = fmtDate(d);
  const ci = $('.cal-ico b', E().screen); $$('.cal-ico b', E().screen).forEach(b => b.textContent = d.getDate());
  $$('.notif-time').forEach(t => t.textContent = timeAgo(+t.dataset.t));
  lastMin = d.getMinutes();
}
setInterval(() => {
  const d = new Date();
  if (d.getMinutes() !== lastMin) { updateClock(); OS.emit('minute', d); }
  OS.emit('tick', d);
}, 1000);

/* ================= apps ================= */
function usageBump(id) { const u = Store.get('usage', {}); u[id] = (u[id] || 0) + 1; Store.set('usage', u); }
OS.launch = (id, srcEl, params) => {
  if (!OS.apps[id]) return;
  OS.openApp(id, { from: srcEl ? OS.rect(srcEl) : null, params });
};

/* ================= home ================= */
const DEFAULT_LAYOUT = () => ({
  pages: [['gmail', 'photos', 'youtube', 'maps', 'drive', 'calendar', 'clock', 'calculator', 'keep', 'files', 'weather', 'playstore', 'settings', 'meet', 'wallet'], []],
  dock: ['phone', 'messages', 'chrome', 'camera'],
});
OS.layout = Store.get('layout', null) || DEFAULT_LAYOUT();
OS.saveLayout = () => Store.set('layout', OS.layout);
let curPage = 0, pageDrag = 0;

function buildHome() {
  const pages = E().pages;
  OS.gesture(E().home, {
    filter: e => !OS.current && !OS.state.recents && !OS.state.drawer && !OS.state.locked && !OS.state.off && !e.target.closest('.menu'),
    start: ({ axis, dy }) => {
      home.mode = axis === 'x' ? 'x' : (dy < 0 ? 'drawer' : 'shade');
      home.p0 = curPage; if (home.mode === 'shade') shadeDrag.p0 = 0; return true;
    },
    move: ({ dx, dy }) => {
      if (home.mode === 'x') { pageDrag = dx; setPages(false); }
      else if (home.mode === 'drawer') setDrawer(clamp(-dy / (OS.H * .55), 0, 1), false);
      else setShade(clamp(dy / (OS.H * .6), 0, 1), false);
    },
    end: ({ dx, dy, vx, vy }) => {
      if (home.mode === 'x') {
        let p = curPage; if (dx < -60 || vx < -.4) p++; else if (dx > 60 || vx > .4) p--;
        pageDrag = 0; gotoPage(clamp(p, 0, 1));
      } else if (home.mode === 'drawer') drawerTo(-dy / (OS.H * .55) > .25 || vy < -.5);
      else shadeTo(dy / (OS.H * .6) > .25 || vy > .5);
    },
  });
  const home = { mode: null, p0: 0 };

  E().search.addEventListener('click', () => OS.launch('chrome', E().search, { focus: true }));
  OS.longPress(E().home, e => {
    if (e.target.closest('.hi,#searchbar,.glance,.w-clock,.w-weather')) return;
    const r = { x: (e.clientX - E().screen.getBoundingClientRect().left) / OS.scale, y: (e.clientY - E().screen.getBoundingClientRect().top) / OS.scale, h: 0 };
    OS.menu(r, [
      { icon: 'wallpaper', label: 'Wallpaper & style', cb: () => OS.openApp('settings', { params: { page: 'wallpaper' } }) },
      { icon: 'widgets', label: 'Widgets', cb: () => gotoPage(1) },
      { icon: 'settings', label: 'Home settings', cb: () => OS.openApp('settings', { params: { page: 'display' } }) },
    ]);
  });
  renderHome();
  OS.on('apps', () => { renderHome(); renderDrawer(); });
  OS.on('weather', updateWidgets);
  OS.on('theme', () => { });
}

function homeIcon(id, { label = true } = {}) {
  const def = OS.apps[id]; if (!def) return null;
  const ic = OS.iconEl(def);
  const el = h('div.hi', { onclick: () => OS.launch(id, ic) }, ic, label ? h('span.hi-l', def.name) : null);
  OS.longPress(el, () => appMenu(id, ic, true));
  return el;
}

function appMenu(id, anchor, onHome) {
  const def = OS.apps[id], r = OS.rect(anchor);
  const items = [{ icon: 'open_in_new', label: 'Open', cb: () => OS.launch(id, anchor) }];
  if (onHome) items.push({ icon: 'remove_circle_outline', label: 'Remove from Home', cb: () => { removeFromHome(id); } });
  else if (![...OS.layout.pages.flat(), ...OS.layout.dock].includes(id)) items.push({ icon: 'add_to_home_screen', label: 'Add to Home screen', cb: () => { addToHome(id); OS.toast('Added to Home screen'); } });
  items.push({ icon: 'info', label: 'App info', cb: () => OS.openApp('settings', { params: { page: 'app:' + id } }) });
  if (def.installed) items.push('-', { icon: 'delete', label: 'Uninstall', danger: true, cb: () => OS.uninstall(id) });
  OS.menu(r, items);
}

function addToHome(id) {
  if ([...OS.layout.pages.flat(), ...OS.layout.dock].includes(id)) return;
  const pg = OS.layout.pages[0].length < 25 ? 0 : 1;
  OS.layout.pages[pg].push(id); OS.saveLayout(); renderHome();
}
function removeFromHome(id) {
  OS.layout.pages = OS.layout.pages.map(p => p.filter(x => x !== id)); OS.saveLayout(); renderHome();
}
OS.addToHome = addToHome;

function renderHome() {
  const L = OS.layout;
  L.pages = L.pages.map(p => p.filter(id => OS.apps[id])); L.dock = L.dock.filter(id => OS.apps[id]);
  const pages = E().pages; pages.innerHTML = '';
  const p0 = h('div.page',
    h('div.glance', { onclick: () => OS.launch('calendar', $('.gl-date')) },
      h('div.gl-date'), h('div.gl-line', h('span.mi.fill.gl-ic', 'sunny'), h('span.gl-t'))),
    h('div.grid', L.pages[0].map(id => homeIcon(id))));
  const p1 = h('div.page',
    h('div.w-clock', { onclick: () => OS.launch('clock', $('.wc-time')) }, h('div.wc-time'), h('div.wc-date')),
    h('div.w-weather', { onclick: () => OS.launch('weather', $('.ww-ic')) },
      h('span.mi.fill.ww-ic'), h('div.ww-mid', h('div.ww-t'), h('div.ww-c')), h('div.ww-r', h('div.ww-hl'), h('div.ww-p'))),
    h('div.grid', L.pages[1].map(id => homeIcon(id))));
  pages.append(p0, p1);
  const dock = E().dock; dock.innerHTML = '';
  L.dock.forEach(id => dock.append(homeIcon(id, { label: false })));
  E().dots.innerHTML = ''; [0, 1].forEach(i => E().dots.append(h('i' + (i === curPage ? '.on' : ''))));
  setPages(false); updateClock(); updateWidgets();
}

function updateWidgets() {
  const w = OS.weather; if (!w.loaded && !w.temp) return;
  const gl = $('.gl-line'); if (!gl) return;
  $('.gl-ic').textContent = w.icon; $('.gl-t').textContent = `${OS.temp(w.temp)}°${OS.cfg.units}${w.cond ? ' · ' + w.cond : ''}`;
  $('.ww-ic').textContent = w.icon; $('.ww-t').textContent = OS.temp(w.temp) + '°'; $('.ww-c').textContent = w.cond;
  $('.ww-hl').textContent = `H:${OS.temp(w.hi)}° L:${OS.temp(w.lo)}°`; $('.ww-p').textContent = w.place;
}
OS.on('cfg:units', updateWidgets);

function setPages(anim) {
  const t = E().pages; t.style.transition = anim ? `transform .3s ${ease}` : 'none';
  t.style.transform = `translateX(${-curPage * OS.W + pageDrag}px)`;
  $$('i', E().dots).forEach((d, i) => d.classList.toggle('on', i === curPage));
}
function gotoPage(p) { curPage = p; pageDrag = 0; setPages(true); }

/* ================= drawer ================= */
let drawerP = 0;
function buildDrawer() {
  const d = E().drawer;
  OS.gesture(d, {
    axis: 'y', dirs: ['down'],
    filter: e => OS.state.drawer && (E().dlist.scrollTop <= 0 || !e.target.closest('#drawer-list')),
    start: () => true,
    move: ({ dy }) => setDrawer(clamp(1 - dy / (OS.H * .55), 0, 1), false),
    end: ({ dy, vy }) => drawerTo(!(dy > 110 || vy > .5)),
  });
  E().dq.addEventListener('input', () => renderDrawer());
  E().dq.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const first = $('#drawer-list .hi'); if (first) first.click(); else if (E().dq.value.trim()) { const q = E().dq.value; drawerTo(false); OS.openApp('chrome', { params: { url: q } }); } }
  });
  renderDrawer(); setDrawer(0, false);
}
function setDrawer(p, anim) {
  drawerP = p; const d = E().drawer;
  d.style.transition = anim ? `transform .38s ${ease}` : 'none';
  d.style.transform = `translateY(${(1 - p) * 100}%)`;
  d.style.visibility = p > 0 ? 'visible' : 'hidden';
  E().home.style.transition = anim ? `opacity .3s, transform .38s ${ease}` : 'none';
  E().home.style.opacity = 1 - p;
  E().home.style.transform = `scale(${1 - p * .06})`;
  E().wallpaper.style.filter = `blur(${p * 24}px) brightness(${1 - p * .25})`;
  E().wallpaper.style.transition = anim ? 'filter .38s' : 'none';
}
function drawerTo(open, instant) {
  OS.state.drawer = open; setDrawer(open ? 1 : 0, !instant);
  if (open) { E().dq.value = ''; renderDrawer(); } else E().dq.blur();
  OS.updateSB();
}
OS.drawerTo = drawerTo;

function renderDrawer() {
  const q = (E().dq.value || '').trim().toLowerCase();
  const all = Object.values(OS.apps).sort((a, b) => a.name.localeCompare(b.name));
  const list = q ? all.filter(a => a.name.toLowerCase().includes(q)) : all;
  const L = E().dlist; L.innerHTML = '';
  if (q && !list.length) L.append(h('div.d-empty', mi('travel_explore'), h('div', `No apps match "${E().dq.value}"`), h('div.d-sub', 'Press Enter to search the web')));
  else L.append(h('div.grid.dgrid', list.map(a => {
    const ic = OS.iconEl(a);
    const el = h('div.hi', { dataset: { app: a.id }, onclick: () => OS.launch(a.id, ic) }, ic, h('span.hi-l', a.name));
    OS.longPress(el, () => appMenu(a.id, ic, false)); return el;
  })));
  const S = E().dsug; S.innerHTML = '';
  if (!q) {
    const u = Store.get('usage', {});
    let ids = Object.keys(u).filter(id => OS.apps[id]).sort((a, b) => u[b] - u[a]);
    ['phone', 'messages', 'chrome', 'camera', 'photos'].forEach(id => { if (!ids.includes(id)) ids.push(id); });
    ids.slice(0, 5).forEach(id => { const ic = OS.iconEl(OS.apps[id]); S.append(h('div.hi.nolabel', { onclick: () => OS.launch(id, ic) }, ic)); });
  }
}

/* ================= windows ================= */
function runOf(id) { return OS.running.find(r => r.id === id); }
function animateWin(win, from, to, ms, done) {
  win.style.transition = 'none';
  win.style.transform = from.transform || 'none'; win.style.opacity = from.opacity ?? 1; win.style.borderRadius = from.radius || '0px';
  win.getBoundingClientRect();
  win.style.transition = `transform ${ms}ms ${ease}, opacity ${ms * .8}ms linear, border-radius ${ms}ms ${ease}`;
  win.style.transform = to.transform || 'none'; win.style.opacity = to.opacity ?? 1; win.style.borderRadius = to.radius || '0px';
  clearTimeout(win._t); win._t = setTimeout(() => { win.style.transition = ''; done && done(); }, ms + 30);
}
const defaultOrigin = (rect) => {
  const cx = rect ? rect.x + rect.w / 2 : OS.W / 2, cy = rect ? rect.y + rect.h / 2 : OS.H - 50;
  return `translate(${cx - OS.W / 2}px,${cy - OS.H / 2}px) scale(.16)`;
};
const iconRects = {};

OS.openApp = (id, opts = {}) => {
  const def = OS.apps[id]; if (!def) return;
  if (OS.state.locked || OS.state.off) return;
  OS.closePopups();
  if (OS.state.shade) shadeTo(false, true);
  usageBump(id);
  let run = runOf(id);
  const fromRecents = OS.state.recents;
  if (!run) {
    const win = h('div.app-win'); run = { id, win, def };
    OS.running.push(run); E().apps.append(win);
    try { run.inst = def.create(win, { params: opts.params || {}, run }) || {}; }
    catch (err) { console.error(err); OS.running.pop(); win.remove(); OS.toast(`${def.name} keeps stopping`); return; }
  } else {
    OS.running.splice(OS.running.indexOf(run), 1); OS.running.push(run); E().apps.append(run.win);
    run.inst && run.inst.onParams && run.inst.onParams(opts.params || {});
  }
  if (opts.from) iconRects[id] = opts.from;
  // hide other windows (except the one animating out of recents)
  OS.running.forEach(r => { if (r !== run) { r.win.style.display = 'none'; r.win.classList.remove('in-recents'); } });
  const win = run.win;
  let from;
  if (fromRecents) {
    from = { transform: win.style.transform, radius: win.style.borderRadius, opacity: 1 };
    closeRecentsUI();
  } else if (OS.current === id && win.style.display !== 'none') from = null;
  else from = { transform: defaultOrigin(opts.from), opacity: 0, radius: '80px' };
  win.style.display = 'block'; win.classList.remove('in-recents');
  OS.current = id;
  if (OS.state.drawer) drawerTo(false, true);
  if (from) animateWin(win, from, { transform: 'none', opacity: 1, radius: '0px' }, 340, () => { win.style.transform = ''; });
  OS.updateSB();
  run.inst && run.inst.onShow && run.inst.onShow();
  OS.emit('foreground', id);
};

OS.closeApp = id => {
  const run = runOf(id); if (!run) return;
  try { run.inst && run.inst.destroy && run.inst.destroy(); } catch (e) { console.error(e); }
  run.win.remove(); run.head && run.head.remove();
  OS.running.splice(OS.running.indexOf(run), 1);
  if (OS.current === id) { OS.current = null; OS.updateSB(); }
  OS.emit('closed', id);
};

OS.goHome = () => {
  OS.closePopups();
  if (OS.state.shade) { shadeTo(false); }
  if (OS.state.recents) { closeRecentsUI(); OS.running.forEach(r => { r.win.style.display = 'none'; r.win.classList.remove('in-recents'); r.win.style.transform = ''; }); OS.current = null; OS.updateSB(); return; }
  if (OS.state.drawer) { drawerTo(false); if (!OS.current) return; }
  const cur = OS.current && runOf(OS.current);
  if (!cur) { if (curPage !== 0) gotoPage(0); return; }
  OS.current = null; OS.updateSB();
  const icon = $(`#home [data-app="${cur.id}"]`);
  const rect = icon && icon.offsetParent ? OS.rect(icon) : iconRects[cur.id];
  cur.inst && cur.inst.onHide && cur.inst.onHide();
  const win = cur.win;
  animateWin(win, { transform: win.style.transform, radius: win.style.borderRadius || '0px', opacity: 1 },
    { transform: defaultOrigin(rect), opacity: 0, radius: '80px' }, 300,
    () => { if (OS.current !== cur.id) win.style.display = 'none'; win.style.transform = ''; win.style.opacity = ''; });
  OS.emit('foreground', null);
};

OS.back = () => {
  const s = OS.state;
  if (s.off) return;
  if (s.locked) { if (pinOpen) hidePin(); return; }
  if (OS.closePopups()) return;
  if (s.shade) return shadeTo(false);
  if (s.recents) { const o = recentsOrigin; return o && runOf(o) ? OS.openApp(o) : OS.goHome(); }
  if (s.drawer) return drawerTo(false);
  if (OS.current) {
    const r = runOf(OS.current);
    if (r.inst && r.inst.onBack && r.inst.onBack()) return;
    return OS.goHome();
  }
  if (curPage > 0) gotoPage(0);
};

/* ================= navigation gestures ================= */
(function () {
  let win = null, mode = null;
  const wire = () => {
    OS.gesture(E().nav, {
      axis: 'y', dirs: ['up'], threshold: 6,
      tap: () => { if (!OS.state.locked) OS.goHome(); },
      start: () => {
        if (OS.state.shade) { return false; }
        mode = OS.current ? 'app' : OS.state.recents ? 'recents' : OS.state.drawer ? 'drawer' : 'home';
        win = OS.current && runOf(OS.current).win; if (win) win.style.transition = 'none';
        return true;
      },
      move: ({ dy }) => {
        const up = -dy;
        if (mode === 'app') {
          const p = clamp(up / (OS.H * .5), 0, 1), sc = 1 - .5 * p;
          win.style.transform = `translateY(${-up * .45}px) scale(${sc})`; win.style.borderRadius = (40 * p) / sc + 'px';
        } else if (mode === 'home') setDrawer(clamp(up / (OS.H * .55), 0, 1), false);
      },
      end: ({ dy, vy }) => {
        const up = -dy;
        if (mode === 'app') {
          if (vy < -.8 || up > OS.H * .42) OS.goHome();
          else if (up > 60) OS.openRecents();
          else animateWin(win, { transform: win.style.transform, radius: win.style.borderRadius }, { transform: 'none', radius: '0px' }, 220, () => { win.style.transform = ''; });
        } else if (mode === 'home') drawerTo(up / (OS.H * .55) > .25 || vy < -.5);
        else if (mode === 'drawer' || mode === 'recents') OS.goHome();
      },
    });
    // back gesture from screen edges
    const ind = h('div#back-ind', mi('arrow_back')); E().screen.append(ind);
    [[E().edgeL, 'right', 'l'], [E().edgeR, 'left', 'r']].forEach(([el, dir, side]) => OS.gesture(el, {
      axis: 'x', dirs: [dir], threshold: 4,
      filter: () => !OS.state.locked && !OS.state.off,
      start: () => { ind.className = side + ' show'; return true; },
      move: ({ dx }) => { const m = clamp(Math.abs(dx), 0, 90); ind.style.transform = `translate(${side === 'l' ? m - 30 : -(m - 30)}px,-50%) scale(${.6 + m / 150})`; ind.classList.toggle('go', m > 55); },
      end: ({ dx }) => { ind.classList.remove('show', 'go'); if (Math.abs(dx) > 55) OS.back(); },
    }));
  };
  OS.wireNav = wire;
})();

/* ================= recents ================= */
const R = { rf: 0, cs: .62, vk: 0, rf0: 0 };
let recentsOrigin = null;
const rList = () => OS.running.slice().reverse();
const pitch = () => OS.W * R.cs + 22;

function buildRecents() {
  const rc = E().recents;
  rc.append(h('div.rc-empty', 'No recent items'), h('button.rc-clear', { onclick: clearAll }, 'Clear all'));
  const pxOf = e => (e.clientX - E().screen.getBoundingClientRect().left) / OS.scale - OS.W / 2;
  const pyOf = e => (e.clientY - E().screen.getBoundingClientRect().top) / OS.scale - OS.H / 2;
  const cardAt = px => Math.round(R.rf - px / pitch());
  let mode = null;
  OS.gesture(rc, {
    filter: () => OS.state.recents,
    start: ({ axis, dy, e }) => {
      mode = axis; R.rf0 = R.rf;
      if (axis === 'y') { if (dy > 0) return false; R.vk = cardAt(pxOf(e)); const r = rList()[R.vk]; if (!r) return false; r.dy = 0; }
      return true;
    },
    move: ({ dx, dy }) => {
      if (mode === 'x') { R.rf = clamp(R.rf0 + dx / pitch(), -.25, rList().length - .75); layoutRecents(false); }
      else { const r = rList()[R.vk]; if (r) { r.dy = Math.min(0, dy); layoutRecents(false); } }
    },
    end: ({ dx, dy, vx, vy }) => {
      if (mode === 'x') { R.rf = clamp(Math.round(R.rf + vx * 220 / pitch()), 0, Math.max(0, rList().length - 1)); layoutRecents(true); }
      else {
        const r = rList()[R.vk]; if (!r) return;
        if (dy < -90 || vy < -.6) { r.dismissing = true; r.dy = -OS.H; layoutRecents(true); setTimeout(() => { OS.closeApp(r.id); R.rf = clamp(R.rf, 0, Math.max(0, rList().length - 1)); layoutRecents(true); }, 280); }
        else { r.dy = 0; layoutRecents(true); }
      }
    },
    tap: e => {
      const px = pxOf(e), py = pyOf(e), k = cardAt(px), r = rList()[k];
      if (r && Math.abs((R.rf - k) * pitch() - px) < OS.W * R.cs / 2 && Math.abs(py + 34) < OS.H * R.cs / 2) OS.openApp(r.id);
      else if (py < OS.H / 2 - 40 || true) OS.goHome();
    },
  });
}
OS.openRecents = () => {
  if (OS.state.recents) return;
  OS.closePopups(); if (OS.state.shade) shadeTo(false, true); if (OS.state.drawer) drawerTo(false, true);
  recentsOrigin = OS.current; OS.current = null;
  OS.state.recents = true; R.rf = 0;
  const rc = E().recents; rc.classList.add('open');
  rList().forEach(run => {
    run.dy = 0; run.dismissing = false; run.win.style.display = 'block'; run.win.classList.add('in-recents');
    run.head = h('div.rc-head', OS.iconEl(run.def, 22), h('span', run.def.name)); rc.append(run.head);
  });
  recentsBackdrop(true); layoutRecents(true); OS.updateSB();
};
function recentsBackdrop(on) {
  E().home.style.transition = 'opacity .3s'; E().home.style.opacity = on ? 0 : 1; E().home.style.transform = '';
  E().wallpaper.style.transition = 'filter .3s'; E().wallpaper.style.filter = on ? 'blur(16px) brightness(.7)' : '';
}
function closeRecentsUI() {
  recentsBackdrop(false);
  OS.state.recents = false; E().recents.classList.remove('open');
  $$('.rc-head', E().recents).forEach(x => x.remove());
  OS.running.forEach(r => { r.head = null; });
}
function layoutRecents(anim) {
  const rc = E().recents; if (!OS.state.recents) return;
  const list = rList(), cs = R.cs, p = pitch();
  rc.classList.toggle('empty', !list.length);
  list.forEach((run, k) => {
    const x = (R.rf - k) * p, y = -34 + (run.dy || 0);
    const w = run.win;
    w.style.transition = anim ? `transform .36s ${ease}, border-radius .3s, opacity .25s` : 'none';
    w.style.transform = `translate(${x}px,${y}px) scale(${cs})`;
    w.style.borderRadius = (28 / cs) + 'px';
    w.style.opacity = run.dismissing ? 0 : 1;
    if (run.head) {
      run.head.style.cssText = `left:${(OS.W - OS.W * cs) / 2}px;top:${(OS.H - OS.H * cs) / 2 - 78}px;width:${OS.W * cs}px;` +
        `transition:${anim ? `transform .36s ${ease}, opacity .25s` : 'none'};transform:translate(${x}px,${(run.dy || 0)}px);opacity:${run.dismissing ? 0 : 1}`;
    }
  });
}
function clearAll() {
  const list = rList(); list.forEach(r => { r.dismissing = true; r.dy = -OS.H; }); layoutRecents(true);
  setTimeout(() => { list.forEach(r => OS.closeApp(r.id)); OS.goHome(); }, 260);
}

/* ================= quick settings + notification shade ================= */
let shadeP = 0; const shadeDrag = { p0: 0 };
let qsExpanded = false;
const TILES = [
  { key: 'wifi', label: 'Internet', icon: 'wifi', off: 'wifi_off', on: c => c.wifi && !c.airplane, sub: c => c.wifi && !c.airplane ? c.network : 'Off', set: v => { if (v) OS.set('airplane', false); OS.set('wifi', v); }, page: 'network' },
  { key: 'bt', label: 'Bluetooth', icon: 'bluetooth', off: 'bluetooth_disabled', on: c => c.bt && !c.airplane, sub: c => c.bt && !c.airplane ? 'Pixel Buds Pro 2' : 'Off', set: v => { if (v) OS.set('airplane', false); OS.set('bt', v); }, page: 'devices' },
  { key: 'flash', label: 'Flashlight', icon: 'flashlight_on', off: 'flashlight_off', sub: c => c.flash ? 'On' : 'Off', set: v => { OS.set('flash', v); } },
  { key: 'dnd', label: 'Do Not Disturb', icon: 'do_not_disturb_on', sub: c => c.dnd ? 'On' : 'Off', set: v => OS.set('dnd', v), page: 'notifications' },
  { key: 'dark', label: 'Dark theme', icon: 'dark_mode', sub: c => c.dark ? 'On' : 'Off', set: v => { OS.set('dark', v); OS.applyTheme(); OS.updateSB(); }, page: 'display' },
  { key: 'rotate', label: 'Auto-rotate', icon: 'screen_rotation', off: 'screen_lock_rotation', sub: c => c.rotate ? 'On' : 'Off', set: v => OS.set('rotate', v) },
  { key: 'saver', label: 'Battery Saver', icon: 'battery_saver', sub: c => c.saver ? 'On' : 'Off', set: v => { OS.set('saver', v); OS.applyTheme(); }, page: 'battery' },
  { key: 'airplane', label: 'Airplane mode', icon: 'flight', sub: c => c.airplane ? 'On' : 'Off', set: v => OS.set('airplane', v), page: 'network' },
  { key: 'nightlight', label: 'Night Light', icon: 'nightlight', sub: c => c.nightlight ? 'On' : 'Off', set: v => { OS.set('nightlight', v); OS.applyTheme(); }, page: 'display' },
  { key: 'location', label: 'Location', icon: 'location_on', off: 'location_off', sub: c => c.location ? 'On' : 'Off', set: v => OS.set('location', v) },
  { key: 'hotspot', label: 'Hotspot', icon: 'wifi_tethering', sub: c => c.hotspot ? 'On' : 'Off', set: v => OS.set('hotspot', v), page: 'network' },
  { key: 'record', label: 'Screen record', icon: 'screen_record', sub: c => c.record ? 'Recording…' : 'Start', set: v => { OS.set('record', v); OS.toast(v ? 'Screen recording started' : 'Screen recording saved'); } },
];

function buildShade() {
  const s = E().shade;
  s.innerHTML = '';
  const bright = slider(5, 100, OS.cfg.brightness, v => { OS.cfg.brightness = v; OS.save(); OS.applyTheme(); });
  OS.on('cfg:brightness', v => { bright.value = v; bright.style.setProperty('--v', v + '%'); });
  s.append(
    h('div.sh-scroll.scroll',
      h('div.sh-head', h('div.sh-date'), h('div.sh-batt'),
        h('div.sh-btns', h('button.icon-btn', { onclick: () => { shadeTo(false); OS.openApp('settings'); } }, mi('settings')),
          h('button.icon-btn', { onclick: () => { shadeTo(false); OS.powerButton(); } }, mi('power_settings_new')))),
      h('div.qs-wrap', h('div.qs.qs-main'), h('div.qs-more-wrap', h('div.qs.qs-more'))),
      h('div.sh-bright', mi('brightness_medium'), bright),
      h('div.sh-notifs'),
    ),
    h('div.sh-foot', h('button.clear-all', { onclick: () => { clearNotifsAnim(); } }, 'Clear all')),
    h('div.sh-handle'));
  OS.gesture(s, {
    axis: 'y', dirs: ['up', 'down'], threshold: 10,
    filter: e => OS.state.shade && !e.target.closest('input'),
    start: ({ dir }) => {
      if (dir === 'down') { if (!qsExpanded) { setQsExpanded(true); } return false; }
      const sc = $('.sh-scroll', s); if (sc.scrollTop + sc.clientHeight < sc.scrollHeight - 3) return false;
      shadeDrag.p0 = 1; return true;
    },
    move: ({ dy }) => setShade(clamp(1 + dy / (OS.H * .6), 0, 1), false),
    end: ({ dy, vy }) => shadeTo(!(dy < -70 || vy < -.5)),
  });
  s.addEventListener('click', e => { if (e.target.classList.contains('sh-handle')) shadeTo(false); });
  renderTiles(); renderNotifs();
  OS.on('cfg', () => { renderTiles(); updateBattText(); });
  OS.on('notifs', renderNotifs);
  OS.on('battery', updateBattText);
  OS.on('headsup', showHeadsUp);
  setShade(0, false); updateBattText();
}
function updateBattText() {
  const b = OS.battery, el = $('.sh-batt');
  el.innerHTML = `${I('battery_horiz_075')}<span>${Math.round(b.level * 100)}%${b.charging ? ' · charging' : OS.cfg.saver ? ' · Battery Saver' : ''}</span>`;
}
function setQsExpanded(v) {
  qsExpanded = v; E().shade.classList.toggle('qs-open', v);
}
function renderTiles() {
  const main = $('.qs-main'), more = $('.qs-more'); main.innerHTML = ''; more.innerHTML = '';
  TILES.forEach((t, i) => {
    const on = t.on ? t.on(OS.cfg) : !!OS.cfg[t.key];
    const el = h('div.tile' + (on ? '.on' : ''),
      { onclick: () => { t.set(!(t.on ? t.on(OS.cfg) : OS.cfg[t.key])); Sound.click(); } },
      h('div.t-ic', mi(on ? t.icon : (t.off || t.icon), 'fill')),
      h('div.t-tx', h('div.t-l', t.label), h('div.t-s', t.sub(OS.cfg))));
    if (t.page) OS.longPress(el, () => { shadeTo(false, true); OS.openApp('settings', { params: { page: t.page } }); });
    (i < 4 ? main : more).append(el);
  });
}

function setShade(p, anim) {
  shadeP = p; const s = E().shade;
  s.style.transition = anim ? `transform .38s ${ease}, opacity .3s` : 'none';
  s.style.transform = `translateY(${(p - 1) * 100}%)`;
  s.style.opacity = p > 0 ? 1 : 0;
  s.style.visibility = p > 0 ? 'visible' : 'hidden';
  if (p > .5 !== !!OS.state.shade) { OS.state.shade = p > .5 ? 1 : 0; OS.updateSB(); }
  E().screen.classList.toggle('shade-open', p > 0);
}
function shadeTo(open, instant) {
  OS.state.shade = open ? 1 : 0; setShade(open ? 1 : 0, !instant);
  if (!open) setTimeout(() => { if (!OS.state.shade) setQsExpanded(false); }, 350);
  OS.updateSB();
}
OS.shadeTo = shadeTo;

function notifEl(n, lock) {
  const def = OS.apps[n.app] || {};
  const el = h('div.notif' + (n.big ? '.big' : ''), { dataset: { id: n.id } },
    h('div.n-head',
      h('div.n-ic', { style: { background: (def.icon && def.icon.bg) || 'var(--pri)', color: (def.icon && def.icon.fg) || '#fff' } }, mi(n.icon || (def.icon && def.icon.glyph) || 'notifications', 'fill')),
      h('span.n-app', n.appName || def.name || 'System'), h('span.n-dot', '•'), h('span.notif-time', { dataset: { t: n.time } }, timeAgo(n.time))),
    h('div.n-title', n.title), n.text ? h('div.n-text', n.text) : null,
    n.actions && !lock ? h('div.n-acts', n.actions.map(a => h('button', { onclick: e => { e.stopPropagation(); a.cb && a.cb(n); } }, a.label))) : null);
  el.addEventListener('click', () => openNotif(n));
  if (!n.ongoing) OS.gesture(el, {
    axis: 'x', threshold: 10,
    move: ({ dx }) => { el.style.transition = 'none'; el.style.transform = `translateX(${dx}px)`; el.style.opacity = 1 - Math.abs(dx) / 260; },
    end: ({ dx, vx }) => {
      if (Math.abs(dx) > 110 || Math.abs(vx) > .6) { el.style.transition = 'transform .2s, opacity .2s'; el.style.transform = `translateX(${dx > 0 ? 420 : -420}px)`; el.style.opacity = 0; setTimeout(() => OS.dismiss(n.id), 190); }
      else { el.style.transition = 'transform .2s, opacity .2s'; el.style.transform = ''; el.style.opacity = 1; }
    },
  });
  return el;
}
function openNotif(n) {
  if (OS.state.locked) return requestUnlock(() => openNotif(n));
  if (!n.ongoing) OS.dismiss(n.id);
  if (OS.state.shade) shadeTo(false, true);
  if (n.onTap) n.onTap(n); else OS.openApp(n.app, { params: n.params });
}
function renderNotifs() {
  const box = $('.sh-notifs'); if (!box) return;
  box.innerHTML = '';
  const list = OS.notifs;
  if (!list.length) box.append(h('div.n-empty', 'No notifications'));
  list.forEach(n => box.append(notifEl(n)));
  E().shade.classList.toggle('has-n', list.some(n => !n.ongoing));
  const lk = $('.lk-notifs'); if (lk) {
    lk.innerHTML = ''; list.slice(0, 3).forEach(n => lk.append(notifEl(n, true)));
    if (list.length > 3) lk.append(h('div.lk-more', `+${list.length - 3} more`));
  }
}
function clearNotifsAnim() {
  $$('.sh-notifs .notif').forEach((el, i) => { el.style.transition = `transform .25s ${i * 30}ms, opacity .25s ${i * 30}ms`; el.style.transform = 'translateX(-420px)'; el.style.opacity = 0; });
  setTimeout(() => OS.clearNotifs(), 300);
}

/* heads-up banner */
let huTimer;
function showHeadsUp(n) {
  if (OS.state.locked || OS.state.off) return;
  const box = E().headsup; box.innerHTML = '';
  const card = notifEl(n, false); card.classList.add('hu'); box.append(card);
  box.classList.add('show'); clearTimeout(huTimer);
  huTimer = setTimeout(() => box.classList.remove('show'), 5000);
  OS.gesture(box, { axis: 'y', dirs: ['up'], end: () => box.classList.remove('show') });
}

/* ================= lock screen ================= */
let pinOpen = false, pinBuf = '', onUnlock = null;
function buildLock() {
  const L = E().lock;
  L.innerHTML = `<div class="lk-clock"><div class="lk-h"></div><div class="lk-m"></div></div>
    <div class="lk-info"><span class="lk-date"><span></span><span class="mi fill lk-w">sunny</span><span class="lk-wt"></span></span></div>
    <div class="lk-notifs"></div>
    <div class="lk-bottom">
      <button class="lk-short" id="lk-wallet"><span class="mi fill">account_balance_wallet</span></button>
      <button class="lk-fp" id="lk-fp"><span class="mi">fingerprint</span></button>
      <button class="lk-short" id="lk-cam"><span class="mi fill">photo_camera</span></button>
    </div>
    <div class="lk-hint">Swipe up to unlock</div>
    <div class="lk-pin"><div class="pin-top"><span class="mi">lock</span><div class="pin-dots"></div><div class="pin-msg">Enter PIN</div></div><div class="pin-pad"></div><button class="pin-cancel">Cancel</button></div>`;
  const pad = $('.pin-pad', L);
  '123456789'.split('').concat(['', '0', '⌫']).forEach(k => pad.append(k === '' ? h('i') : h('button', { onclick: () => pinKey(k) }, k)));
  $('.pin-cancel', L).onclick = hidePin;
  $('#lk-fp').onclick = () => unlock(true);
  $('#lk-cam').onclick = () => { unlock(true); setTimeout(() => OS.openApp('camera'), 60); };
  $('#lk-wallet').onclick = () => requestUnlock(() => OS.openApp('wallet'));
  OS.gesture(L, {
    axis: 'y', dirs: ['up'], filter: e => OS.state.locked && !pinOpen && !e.target.closest('.notif'),
    move: ({ dy }) => { L.style.transition = 'none'; L.style.transform = `translateY(${dy}px)`; L.style.opacity = 1 + dy / 500; },
    end: ({ dy, vy }) => {
      if (dy < -OS.H * .18 || vy < -.5) { if (OS.cfg.pin) { resetLockPos(); showPin(); } else unlock(true); }
      else resetLockPos();
    },
  });
  OS.on('weather', () => { $('.lk-w').textContent = OS.weather.icon; $('.lk-wt').textContent = ` ${OS.temp(OS.weather.temp)}°`; });
}
function resetLockPos() { const L = E().lock; L.style.transition = `transform .3s ${ease}, opacity .3s`; L.style.transform = ''; L.style.opacity = 1; }
function showPin() {
  pinOpen = true; pinBuf = ''; renderPin(); E().lock.classList.add('pin-on'); $('.pin-msg').textContent = 'Enter PIN';
}
function hidePin() { pinOpen = false; pinBuf = ''; E().lock.classList.remove('pin-on'); }
function renderPin() {
  const n = OS.cfg.pin.length || 4, d = $('.pin-dots');
  d.innerHTML = ''; for (let i = 0; i < n; i++) d.append(h('i' + (i < pinBuf.length ? '.on' : '')));
}
function pinKey(k) {
  Sound.click();
  if (k === '⌫') pinBuf = pinBuf.slice(0, -1); else if (pinBuf.length < OS.cfg.pin.length) pinBuf += k;
  renderPin();
  if (pinBuf.length === OS.cfg.pin.length) {
    if (pinBuf === OS.cfg.pin) setTimeout(() => unlock(true), 120);
    else { const d = $('.pin-dots'); d.classList.add('shake'); $('.pin-msg').textContent = 'Wrong PIN'; setTimeout(() => { d.classList.remove('shake'); pinBuf = ''; renderPin(); }, 450); }
  }
}
function requestUnlock(after) {
  if (!OS.state.locked) return after && after();
  onUnlock = after; if (OS.cfg.pin) showPin(); else unlock(true);
}
OS.requestUnlock = requestUnlock;
function unlock() {
  if (!OS.state.locked) return;
  OS.state.locked = false; hidePin();
  const L = E().lock;
  L.style.transition = `transform .38s ${ease}, opacity .3s`; L.style.transform = 'translateY(-22%) scale(1.05)'; L.style.opacity = 0;
  setTimeout(() => { L.style.display = 'none'; }, 380);
  OS.updateSB(); OS.emit('unlock');
  const f = onUnlock; onUnlock = null; f && setTimeout(f, 80);
}
OS.unlock = unlock;
OS.lockNow = () => {
  OS.state.locked = true; const L = E().lock;
  L.style.display = ''; L.style.transition = 'none'; L.style.transform = ''; L.style.opacity = 1; hidePin();
  if (OS.state.shade) shadeTo(false, true);
  OS.closePopups(); OS.updateSB();
};

/* ================= power, AOD, volume, alarm ring ================= */
OS.screenOff = () => {
  if (OS.state.off) return;
  OS.state.off = true; E().aod.classList.add('on'); OS.lockNow(); OS.emit('screen', false);
};
OS.wake = () => {
  if (!OS.state.off) return;
  OS.state.off = false; E().aod.classList.remove('on'); OS.updateSB(); OS.emit('screen', true);
};
OS.powerButton = () => OS.state.off ? OS.wake() : OS.screenOff();

let volTimer;
OS.volume = d => {
  const v = OS.cfg.volume;
  v.media = clamp(v.media + d, 0, 100); OS.cfg.volume = v;
  if (d < 0 && v.media === 0) OS.cfg.ringer = 'vibrate'; else if (d > 0 && OS.cfg.ringer !== 'sound') OS.cfg.ringer = 'sound';
  OS.save(); OS.emit('cfg', 'volume');
  const box = E().volume, vib = OS.cfg.ringer !== 'sound';
  box.innerHTML = `<span class="mi fill">${v.media === 0 ? 'volume_off' : v.media < 40 ? 'volume_down' : 'volume_up'}</span><div class="vol-bar"><i style="height:${v.media}%"></i></div><span class="mi">${vib ? 'vibration' : 'notifications_active'}</span>`;
  box.classList.add('show'); clearTimeout(volTimer); volTimer = setTimeout(() => box.classList.remove('show'), 1800);
  Sound.click();
};

OS.ring = (o) => {
  OS.wake(); const el = E().ring;
  const t = new Date();
  let loop;
  const stop = () => { clearInterval(loop); el.classList.remove('show'); };
  el.innerHTML = '';
  el.append(h('div.ring-top', mi(o.icon || 'alarm', 'fill'), h('div.ring-time', fmtTime(t, { noAp: true })), h('div.ring-label', o.label || 'Alarm')),
    h('div.ring-acts',
      o.snooze === false ? null : h('button.ring-btn', { onclick: () => { stop(); o.onSnooze && o.onSnooze(); } }, 'Snooze'),
      h('button.ring-btn.pri', { onclick: () => { stop(); o.onDismiss && o.onDismiss(); } }, o.dismissLabel || 'Stop')));
  el.classList.add('show'); Sound.alarm(); loop = setInterval(() => Sound.alarm(), 1300);
  return { stop };
};

/* ================= hardware buttons / toolbar / keyboard ================= */
function buildHardware() {
  const act = {
    back: () => OS.back(), home: () => OS.goHome(), recents: () => (OS.state.locked || OS.state.off) ? 0 : (OS.state.recents ? OS.goHome() : OS.openRecents()),
    power: () => OS.powerButton(), volup: () => OS.volume(8), voldn: () => OS.volume(-8),
    reset: () => {
      const wasOff = OS.state.off; if (wasOff) OS.wake();
      OS.dialog({ title: 'Reset simulator?', body: 'This erases saved notes, messages, photos and settings in this browser and restarts the phone.', actions: [{ label: 'Cancel' }, { label: 'Erase & restart', primary: true, cb: () => { Store.clear(); location.reload(); } }] });
    },
  };
  $$('#toolbar button').forEach(b => b.addEventListener('click', () => act[b.dataset.act]()));
  $('#hw-power').onclick = act.power; $('#hw-volup').onclick = act.volup; $('#hw-voldn').onclick = act.voldn;
  E().aod.addEventListener('click', () => OS.wake());
  addEventListener('keydown', e => {
    if (e.target.matches('input,textarea,[contenteditable]') && e.key !== 'Escape') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (e.key === 'Escape') { if (e.target.matches('input,textarea')) e.target.blur(); else act.back(); }
    else if (k === 'h') act.home(); else if (k === 'r') act.recents(); else if (k === 'p') act.power();
    else if (e.key === 'ArrowUp' && e.shiftKey) act.volup(); else if (e.key === 'ArrowDown' && e.shiftKey) act.voldn();
    else if (e.key === 'Enter' && OS.state.locked && !OS.state.off) { OS.cfg.pin ? showPin() : unlock(); }
    else if (OS.state.off && !e.repeat) OS.wake();
    else if (OS.state.locked && pinOpen && /^[0-9]$/.test(e.key)) pinKey(e.key);
    else if (OS.state.locked && pinOpen && e.key === 'Backspace') pinKey('⌫');
  });
  E().screen.addEventListener('contextmenu', e => e.preventDefault());
  // Accessibility: Tab key moves focus off inputs in the sim, mouse wheel on home pages
  E().home.addEventListener('wheel', e => {
    if (OS.current || OS.state.drawer || OS.state.recents) return;
    if (Math.abs(e.deltaY) > 20) { e.deltaY > 0 ? drawerTo(true) : shadeTo(true); }
    else if (Math.abs(e.deltaX) > 20) gotoPage(clamp(curPage + Math.sign(e.deltaX), 0, 1));
  }, { passive: true });
}
})();
