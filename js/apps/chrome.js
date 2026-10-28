/* Chrome-style browser. Pages load in an iframe, so sites that forbid framing won't render. */
'use strict';

OS.register({
  id: 'chrome', name: 'Chrome', icon: { bg: '#fff', special: '<span class="chrome-ico"></span>', glyph: 'language', fg: '#4285f4' },
  create(win, ctx) {
    const hist = []; let pos = -1;
    const input = h('input', { placeholder: 'Search or type web address', autocapitalize: 'off', spellcheck: false, onfocus: e => { e.target.select(); }, onkeydown: e => { if (e.key === 'Enter') { go(input.value); input.blur(); } } });
    const lockIc = mi('search', 'sm'), frame = h('iframe', { referrerPolicy: 'no-referrer', sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups' });
    const prog = h('div.cr-prog');
    const ntp = h('div.ntp.scroll',
      h('div.ntp-logo', ...'Google'.split('').map((c, i) => h('span', { style: { color: ['#4285f4', '#ea4335', '#fbbc04', '#4285f4', '#34a853', '#ea4335'][i] } }, c))),
      h('div.ntp-box', { onclick: () => input.focus() }, mi('search'), h('span', 'Search or type URL'), mi('mic')),
      h('div.ntp-tiles', [['Wikipedia', 'https://en.m.wikipedia.org', 'W', '#555'], ['Hacker News', 'https://news.ycombinator.com', 'Y', '#ff6600'], ['MDN', 'https://developer.mozilla.org', 'M', '#1b1b1b'], ['Archive', 'https://archive.org', 'A', '#2a2a2a'], ['Example', 'https://example.com', 'E', '#0b57d0'], ['OSM', 'https://www.openstreetmap.org', 'O', '#7ebc6f'], ['GitHub', 'https://github.com', 'G', '#24292f'], ['NASA', 'https://www.nasa.gov', 'N', '#0b3d91']].map(([n, u, l, c]) =>
        h('div.tile-s', { onclick: () => go(u) }, h('div.ts-ic', { style: { background: c } }, l), h('span', n)))),
      h('div.ntp-note', 'Searches use Wikipedia, because most search engines refuse to load inside frames.'));
    const warn = h('div.cr-warn', mi('info'), h('span', 'Page blank? This site may block embedding.'), h('button', { onclick: () => window.open(hist[pos], '_blank', 'noopener') }, 'Open in real tab'));
    const view = h('div.cr-view', ntp, frame, warn);
    const back = h('button.icon-btn', { onclick: () => nav(-1) }, mi('arrow_back')), fwd = h('button.icon-btn', { onclick: () => nav(1) }, mi('arrow_forward'));
    const root = h('div.app.chrome',
      h('div.cr-top', h('div.cr-bar', lockIc, input, h('button.icon-btn.sm', { onclick: () => pos >= 0 && load(hist[pos]) }, mi('refresh'))),
        h('button.icon-btn', { onclick: () => OS.toast('Tabs: this simulator keeps one tab') }, h('div.tabcount', '1')),
        h('button.icon-btn', { onclick: e => OS.menu(OS.rect(e.currentTarget), [
          { icon: 'home', label: 'New tab', cb: home }, { icon: 'open_in_new', label: 'Open in browser', cb: () => pos >= 0 && window.open(hist[pos], '_blank', 'noopener') },
          { icon: 'arrow_forward', label: 'Forward', cb: () => nav(1) }, { icon: 'star', label: 'Add bookmark', cb: () => OS.toast('Bookmarked') }]) }, mi('more_vert'))),
      prog, view);
    win.append(root);

    function norm(q) {
      q = q.trim(); if (!q) return null;
      if (/^https?:\/\//i.test(q)) return q;
      if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(q) && !/\s/.test(q)) return 'https://' + q;
      return 'https://en.m.wikipedia.org/w/index.php?search=' + encodeURIComponent(q);
    }
    function go(q) { const u = norm(q); if (!u) return; hist.length = pos + 1; hist.push(u); pos++; load(u); }
    function load(u) {
      ntp.style.display = 'none'; frame.style.display = 'block'; warn.style.display = 'flex'; input.value = u.replace(/^https?:\/\/(www\.)?/, '');
      lockIc.textContent = u.startsWith('https') ? 'lock' : 'warning'; frame.src = u; prog.classList.remove('go'); void prog.offsetWidth; prog.classList.add('go');
      sync();
    }
    function home() { pos = -1; hist.length = 0; ntp.style.display = ''; frame.style.display = 'none'; warn.style.display = 'none'; frame.src = 'about:blank'; input.value = ''; lockIc.textContent = 'search'; sync(); }
    function nav(d) { const n = pos + d; if (n < -1 || n >= hist.length) return; pos = n; n < 0 ? home() : load(hist[n]); }
    function sync() { }
    frame.style.display = 'none'; warn.style.display = 'none';
    const p = ctx.params || {};
    if (p.url) go(p.url);
    else if (p.focus) setTimeout(() => input.focus(), 380);
    return {
      onParams(q) { if (q && q.url) go(q.url); else if (q && q.focus) setTimeout(() => input.focus(), 380); },
      onBack() { if (pos >= 0) { nav(-1); return true; } return false; },
    };
  },
});
