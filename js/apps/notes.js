/* Keep-style notes */
'use strict';

(() => {
  const NC = [null, '#f28b82', '#fbbc04', '#fff475', '#ccff90', '#a7ffeb', '#aecbfa', '#d7aefb'];
  let notes = Store.get('notes', [
    { id: 'n1', title: 'Grocery list', body: 'Oat milk\nAvocados\nSourdough\nCoffee beans\nLemons', color: NC[3], t: Date.now() - 864e5 },
    { id: 'n2', title: 'Ideas', body: 'Build a pixel-perfect phone simulator in the browser 📱', color: NC[5], t: Date.now() - 3 * 864e5 },
    { id: 'n3', title: 'WiFi', body: 'Network: Pixel_Home_5G\nPassword: ilovepixels', color: null, t: Date.now() - 6 * 864e5 },
  ]);
  const save = () => Store.set('notes', notes);

  OS.register({
    id: 'keep', name: 'Keep Notes', icon: { bg: 'linear-gradient(135deg,#ffd54f,#fbbc04)', glyph: 'lightbulb' },
    create(win) {
      const root = h('div.app.keep'); win.append(root);
      let q = '', editing = null;
      const noteCard = n => h('div.nc' + (n.color ? '' : '.plain'), { style: n.color ? `background:${n.color};color:#202124` : '', onclick: () => edit(n) },
        n.title ? h('div.nc-t', n.title) : null, h('div.nc-b', n.body.split('\n').slice(0, 8).join('\n')));
      const list = () => {
        editing = null; root.innerHTML = '';
        const shown = notes.filter(n => (n.title + n.body).toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.t - a.t);
        const inp = h('input', { placeholder: 'Search your notes', value: q, oninput: e => { q = e.target.value; const pos = e.target.selectionStart; list(); const i = root.querySelector('input'); i.focus(); i.setSelectionRange(pos, pos); } });
        root.append(h('div.search-pill', mi('menu'), inp, mi('grid_view')),
          h('div.scroll.pad-nav', { style: 'flex:1;padding:6px 12px' }, shown.length ? h('div.nc-cols', shown.map(noteCard)) : h('div.empty-state', mi('lightbulb'), 'Notes you add appear here')),
          h('button.fab', { onclick: () => edit() }, mi('add')));
      };
      function edit(n) {
        const isNew = !n; n = n || { id: uid(), title: '', body: '', color: null, t: Date.now() }; editing = n;
        root.innerHTML = '';
        const title = h('input.ne-t', { placeholder: 'Title', value: n.title }), body = h('textarea.ne-b', { placeholder: 'Note', value: n.body });
        const paint = () => { root.style.background = n.color || ''; root.style.color = n.color ? '#202124' : ''; };
        const done = () => {
          n.title = title.value; n.body = body.value; n.t = Date.now();
          if (!n.title.trim() && !n.body.trim()) notes = notes.filter(x => x !== n); else if (isNew) notes.push(n);
          save(); root.style.background = ''; root.style.color = ''; list();
        };
        editing.done = done;
        root.append(h('div.appbar', h('button.icon-btn', { onclick: done }, mi('arrow_back')), h('div', { style: 'flex:1' }),
          h('button.icon-btn', { onclick: () => { notes = notes.filter(x => x !== n); save(); root.style.background = ''; root.style.color = ''; list(); OS.toast('Note deleted'); } }, mi('delete'))),
          h('div.ne', title, body),
          h('div.ne-colors.scroll-x', NC.map(c => h('i' + (c === n.color ? '.on' : ''), { style: { background: c || 'var(--surface)' }, onclick: e => { n.color = c; paint(); [...e.currentTarget.parentNode.children].forEach(x => x.classList.remove('on')); e.currentTarget.classList.add('on'); } }))));
        paint(); if (isNew) setTimeout(() => body.focus(), 50);
      }
      list();
      return { onBack() { if (editing) { editing.done(); return true; } return false; }, onShow() { } };
    },
  });
})();
