/* Maps — a small slippy-map built on OpenStreetMap raster tiles + Nominatim search. */
'use strict';

OS.register({
  id: 'maps', name: 'Maps', icon: { bg: 'linear-gradient(135deg,#e8f5e9,#c8e6c9)', glyph: 'location_on', fg: '#ea4335' },
  create(win) {
    const TS = 256, MINZ = 3, MAXZ = 19;
    let lat = 37.4220, lon = -122.0841, z = 14, marker = null, me = null;
    const tiles = new Map();
    const layer = h('div.mp-tiles'), pin = h('div.mp-pin', mi('location_on', 'fill')), dot = h('div.mp-me'), view = h('div.mp-view', layer, pin, dot);
    const sheet = h('div.mp-sheet');
    const q = h('input', { placeholder: 'Search here', onkeydown: e => { if (e.key === 'Enter') search(q.value); } });
    const root = h('div.app.maps', view,
      h('div.mp-search', mi('search'), q, h('button.icon-btn.sm', { onclick: () => { q.value = ''; marker = null; sheet.classList.remove('show'); draw(); } }, mi('close'))),
      h('div.mp-ctl', h('button', { onclick: () => zoom(1) }, mi('add')), h('button', { onclick: () => zoom(-1) }, mi('remove'))),
      h('button.fab.mp-loc', { onclick: locate }, mi('my_location')),
      h('div.mp-attr', '© OpenStreetMap contributors'), sheet);
    win.append(root);

    const px = (la, lo, zz) => { const s = TS * 2 ** zz, sin = Math.sin(la * Math.PI / 180); return { x: (lo + 180) / 360 * s, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s }; };
    const unpx = (x, y, zz) => { const s = TS * 2 ** zz; const n = Math.PI - 2 * Math.PI * y / s; return { lat: 180 / Math.PI * Math.atan(Math.sinh(n)), lon: x / s * 360 - 180 }; };

    function draw() {
      const W = view.clientWidth || 412, H = view.clientHeight || 800;
      const c = px(lat, lon, z), x0 = c.x - W / 2, y0 = c.y - H / 2, n = 2 ** z;
      const need = new Set();
      for (let ty = Math.floor(y0 / TS); ty <= Math.floor((y0 + H) / TS); ty++) for (let tx = Math.floor(x0 / TS); tx <= Math.floor((x0 + W) / TS); tx++) {
        if (ty < 0 || ty >= n) continue; const wx = ((tx % n) + n) % n, key = `${z}/${wx}/${ty}@${tx}`; need.add(key);
        let img = tiles.get(key);
        if (!img) { img = h('img.mp-t', { src: `https://tile.openstreetmap.org/${z}/${wx}/${ty}.png`, draggable: false, alt: '' }); img.onerror = () => img.classList.add('err'); tiles.set(key, img); layer.append(img); }
        img.style.transform = `translate(${tx * TS - x0}px,${ty * TS - y0}px)`;
      }
      for (const [k, img] of tiles) if (!need.has(k)) { img.remove(); tiles.delete(k); }
      const place = (el, p) => { if (!p) { el.style.display = 'none'; return; } const o = px(p.lat, p.lon, z); el.style.display = ''; el.style.transform = `translate(${o.x - x0}px,${o.y - y0}px)`; };
      place(pin, marker); place(dot, me);
    }
    function zoom(d, at) { const nz = clamp(z + d, MINZ, MAXZ); if (nz === z) return; z = nz; tiles.forEach(i => i.remove()); tiles.clear(); draw(); }
    OS.gesture(view, {
      threshold: 3,
      start: () => { view._c = px(lat, lon, z); return true; },
      move: ({ dx, dy }) => { const p = unpx(view._c.x - dx, view._c.y - dy, z); lat = clamp(p.lat, -84, 84); lon = p.lon; draw(); },
    });
    view.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1 : -1); }, { passive: false });
    view.addEventListener('dblclick', () => zoom(1));

    async function search(text) {
      if (!text.trim()) return;
      sheet.innerHTML = ''; sheet.append(h('div.mp-s1', 'Searching…')); sheet.classList.add('show');
      try {
        const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(text), { headers: { Accept: 'application/json' } }); const j = await r.json();
        if (!j.length) { sheet.innerHTML = ''; sheet.append(h('div.mp-s1', 'No results'), h('div.mp-s2', `Nothing found for “${text}”`)); return; }
        const p = j[0]; lat = +p.lat; lon = +p.lon; z = p.type === 'city' || p.addresstype === 'city' ? 12 : 15; marker = { lat, lon };
        tiles.forEach(i => i.remove()); tiles.clear(); draw(); q.blur();
        const parts = p.display_name.split(', ');
        sheet.innerHTML = ''; sheet.append(h('div.mp-s1', parts[0]), h('div.mp-s2', parts.slice(1, 4).join(', ')),
          h('div.mp-s3', h('button.btn', { onclick: () => window.open(`https://www.openstreetmap.org/directions?to=${lat},${lon}`, '_blank', 'noopener') }, mi('directions'), 'Directions'), h('button.btn.tonal', { onclick: () => OS.toast('Saved to Starred places') }, mi('bookmark'), 'Save')));
      } catch { sheet.innerHTML = ''; sheet.append(h('div.mp-s1', 'Search failed'), h('div.mp-s2', 'Check your internet connection')); }
    }
    function locate() {
      if (!navigator.geolocation || !OS.cfg.location) return OS.toast(OS.cfg.location ? 'Location unavailable' : 'Turn on Location in quick settings');
      navigator.geolocation.getCurrentPosition(p => { lat = p.coords.latitude; lon = p.coords.longitude; me = { lat, lon }; z = Math.max(z, 15); tiles.forEach(i => i.remove()); tiles.clear(); draw(); }, () => OS.toast('Location permission denied'), { timeout: 8000 });
    }
    setTimeout(draw, 0);
    new ResizeObserver(() => draw()).observe(view);
    return {
      onShow() { setTimeout(draw, 30); },
      onBack() { if (sheet.classList.contains('show')) { sheet.classList.remove('show'); marker = null; draw(); return true; } return false; },
    };
  },
});
