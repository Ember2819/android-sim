/* Shared photo library + Photos app */
'use strict';

OS.photos = (() => {
  let seeds = null;
  const PAL = [
    ['#ff9a5a', '#c2417a', '#3b1d63', '#14102e'], ['#8ed0ff', '#4a90e2', '#2a5d9f', '#0d2a4d'], ['#ffd86b', '#ff8f4a', '#d94f5c', '#4a2358'],
    ['#b8f2e6', '#5cc6a8', '#2a8a74', '#0f4a42'], ['#e6c3ff', '#a67cf2', '#5b3fb5', '#1e1457'], ['#fff1c9', '#f2b66d', '#b9672e', '#4a2410'],
    ['#9bd1ff', '#5aa0e8', '#2b5fa8', '#12315e'], ['#ffb199', '#ff6f91', '#8e3b8f', '#2b1a5a'],
  ];
  function draw(i) {
    const c = document.createElement('canvas'); c.width = 360; c.height = 480; const x = c.getContext('2d');
    const p = PAL[i % PAL.length]; let s = (i + 1) * 9301;
    const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const g = x.createLinearGradient(0, 0, 0, 480); g.addColorStop(0, p[3]); g.addColorStop(.45, p[2]); g.addColorStop(.8, p[1]); g.addColorStop(1, p[0]);
    x.fillStyle = g; x.fillRect(0, 0, 360, 480);
    for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(255,255,255,${rnd() * .6})`; x.fillRect(rnd() * 360, rnd() * 200, 1.5, 1.5); }
    const sx = 60 + rnd() * 240, sy = 230 + rnd() * 60, sr = 26 + rnd() * 24;
    const sg = x.createRadialGradient(sx, sy, 0, sx, sy, sr * 3); sg.addColorStop(0, 'rgba(255,255,230,.95)'); sg.addColorStop(.3, 'rgba(255,230,160,.5)'); sg.addColorStop(1, 'rgba(255,200,120,0)');
    x.fillStyle = sg; x.fillRect(0, 0, 360, 480); x.fillStyle = '#fff8e0'; x.beginPath(); x.arc(sx, sy, sr, 0, 7); x.fill();
    for (let l = 0; l < 3; l++) {
      const base = 330 + l * 45, amp = 30 + rnd() * 30, ph = rnd() * 6, fr = .01 + rnd() * .012;
      x.fillStyle = `color-mix(in srgb, ${p[3]} ${40 + l * 25}%, ${p[2]})`;
      x.beginPath(); x.moveTo(0, 480); for (let px = 0; px <= 360; px += 6) x.lineTo(px, base + Math.sin(px * fr + ph) * amp + Math.sin(px * fr * 2.3 + ph) * amp * .4); x.lineTo(360, 480); x.fill();
    }
    return c.toDataURL('image/jpeg', .78);
  }
  const mk = () => { if (!seeds) { const base = Date.now(); seeds = Array.from({ length: 14 }, (_, i) => ({ id: 'seed' + i, seed: true, src: draw(i), t: base - (i * 4 + i * i * .9 + 1) * 3600e3 })); } return seeds; };
  let user = Store.get('photos', []), deleted = Store.get('photos-del', []);
  return {
    all() { return [...user, ...mk().filter(p => !deleted.includes(p.id))].sort((a, b) => b.t - a.t); },
    add(src) { const p = { id: uid(), src, t: Date.now() }; user.unshift(p); user = user.slice(0, 14); if (!Store.set('photos', user)) { user = user.slice(0, 4); Store.set('photos', user); } OS.emit('photos'); return p; },
    remove(id) { if (id.startsWith('seed')) { deleted.push(id); Store.set('photos-del', deleted); } else { user = user.filter(p => p.id !== id); Store.set('photos', user); } OS.emit('photos'); },
  };
})();

(() => {
  const PD = 'M0 0V-12C0-18 4-21 8-21 14-21 18-17 18-11 18-5 14 0 8 0Z';
  const PINWHEEL = `<svg viewBox="0 0 48 48" width="74%" height="74%"><g transform="translate(24 24)">${['#ea4335', '#fbbc04', '#34a853', '#4285f4'].map((c, i) => `<path d="${PD}" fill="${c}" transform="rotate(${i * 90})"/>`).join('')}</g></svg>`;
  const dayLabel = t => { const d = new Date(t), n = new Date(); if (d.toDateString() === n.toDateString()) return 'Today'; if (d.toDateString() === new Date(n - 864e5).toDateString()) return 'Yesterday'; return fmtDate(d, true); };

  OS.register({
    id: 'photos', name: 'Photos', icon: { bg: '#fff', special: PINWHEEL, glyph: 'photo_library', fg: '#ea4335' },
    create(win) {
      const root = h('div.app.photos'); win.append(root);
      let tab = 'photos', viewer = null;
      const render = () => {
        root.innerHTML = '';
        const all = OS.photos.all();
        const content = h('div.scroll.ph-scroll');
        if (tab === 'photos') {
          let last = '', grid = null;
          all.forEach(p => {
            const l = dayLabel(p.t);
            if (l !== last) { last = l; content.append(h('div.ph-day', l)); grid = h('div.ph-grid'); content.append(grid); }
            grid.append(h('div.ph-th', { onclick: () => view(p.id) }, h('img', { src: p.src, loading: 'lazy', draggable: false })));
          });
          if (!all.length) content.append(h('div.empty-state', mi('photo_library'), 'No photos yet — take one with the Camera'));
        } else if (tab === 'library') {
          content.append(h('div.ph-day', 'Library'), h('div.lib', [['star', 'Favorites'], ['delete', 'Trash'], ['download', 'Downloads'], ['screenshot', 'Screenshots']].map(([ic, n]) => h('div.lib-i', { onclick: () => OS.toast(n + ' is empty') }, mi(ic), n))));
        } else {
          content.append(h('div.ph-day', 'Search'), h('div.chips', ['Sunsets', 'Landscapes', 'Selfies', 'Screenshots', 'Videos'].map(t => h('div.chip', { onclick: () => OS.toast(`Searching for "${t}"…`) }, t))));
        }
        root.append(h('div.search-pill', mi('search'), h('span', 'Search your photos'), h('div.avatar.sm', { style: { background: '#7e57c2' } }, 'P')), content,
          h('div.bottom-nav', [['photos', 'photo', 'Photos'], ['search', 'search', 'Search'], ['library', 'photo_library', 'Library']].map(([id, ic, lb]) => h('div.bn' + (tab === id ? '.on' : ''), { onclick: () => { tab = id; render(); } }, mi(ic, tab === id ? 'fill' : ''), lb))));
      };
      function view(id) {
        const all = OS.photos.all(); let i = all.findIndex(p => p.id === id); if (i < 0) return;
        const v = h('div.viewer'); const img = h('img', { draggable: false }); const cnt = h('span.v-cnt');
        const show = () => { const p = all[i]; img.src = p.src; cnt.textContent = `${dayLabel(p.t)} · ${fmtTime(new Date(p.t))}`; };
        v.append(h('div.v-top', h('button.icon-btn', { onclick: close }, mi('arrow_back')), cnt, h('button.icon-btn', { onclick: e => OS.menu(OS.rect(e.currentTarget), [
          { icon: 'wallpaper', label: 'Use as wallpaper', cb: () => { OS.cfg.customWp = all[i].src; OS.save(); OS.applyTheme(); OS.toast('Wallpaper set'); } },
          { icon: 'info', label: 'Details', cb: () => OS.dialog({ title: 'Details', body: `${new Date(all[i].t).toLocaleString()}<br>Pixel 11 · f/1.7 · 1/120s · ISO 50`, actions: [{ label: 'OK', primary: true }] }) }]) }, mi('more_vert'))),
          h('div.v-img', img),
          h('div.v-bot', ...[['share', 'Share', () => OS.toast('Sharing isn’t available in the simulator')], ['tune', 'Edit', () => OS.toast('Editing isn’t available')], ['search', 'Lens', () => OS.toast('Nothing recognized')],
            ['delete', 'Delete', () => { OS.photos.remove(all[i].id); OS.toast('Moved to trash'); close(); }]].map(([ic, lb, fn]) => h('button', { onclick: fn }, mi(ic), h('span', lb)))));
        const go = d => { const n = i + d; if (n >= 0 && n < all.length) { i = n; img.style.transition = 'none'; img.style.transform = `translateX(${-d * 60}px)`; show(); requestAnimationFrame(() => { img.style.transition = 'transform .2s'; img.style.transform = ''; }); } };
        OS.gesture(v.querySelector('.v-img'), { axis: 'x', end: ({ dx, vx }) => { if (dx < -50 || vx < -.4) go(1); else if (dx > 50 || vx > .4) go(-1); } });
        function close() { v.remove(); viewer = null; render(); }
        viewer = { close }; show(); root.append(v);
      }
      render(); const off = OS.on('photos', () => !viewer && render());
      return { onBack() { if (viewer) { viewer.close(); return true; } return false; }, onShow() { if (!viewer) render(); } };
    },
  });
})();
