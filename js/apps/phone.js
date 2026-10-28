/* Phone (dialer, recents, contacts) and Contacts */
'use strict';

OS.contacts = [
  { id: 'mom', name: 'Mom', phone: '(555) 010-2211', color: '#e8710a', fav: true },
  { id: 'dad', name: 'Dad', phone: '(555) 010-2212', color: '#1a73e8', fav: true },
  { id: 'alex', name: 'Alex Rivera', phone: '(555) 010-4821', color: '#188038', fav: true },
  { id: 'priya', name: 'Priya Nair', phone: '(555) 010-7733', color: '#9334e6', fav: true },
  { id: 'sam', name: 'Sam Patel', phone: '(555) 010-9034', color: '#d93025' },
  { id: 'jamie', name: 'Jamie Chen', phone: '(555) 010-5560', color: '#00897b' },
  { id: 'pizza', name: 'Luigi’s Pizza', phone: '(555) 010-3377', color: '#c2185b' },
  { id: 'pixel', name: 'Pixel Support', phone: '1-855-836-3987', color: '#4285f4' },
];
OS.contactById = id => OS.contacts.find(c => c.id === id);
OS.contactByNumber = n => { const d = n.replace(/\D/g, ''); return OS.contacts.find(c => c.phone.replace(/\D/g, '') === d); };
OS.avatar = (c, cls = '') => h('div.avatar' + (cls ? '.' + cls : ''), { style: { background: c.color } }, c.name[0]);

OS.contactList = (box, pick, filter = '') => {
  box.innerHTML = '';
  const list = OS.contacts.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()) || c.phone.includes(filter)).sort((a, b) => a.name.localeCompare(b.name));
  let letter = '';
  list.forEach(c => {
    if (c.name[0] !== letter) { letter = c.name[0]; box.append(h('div.ct-letter', letter)); }
    box.append(h('div.list-item', { onclick: () => pick(c) }, OS.avatar(c), h('div.tx', h('div.t1', c.name), h('div.t2', c.phone))));
  });
  if (!list.length) box.append(h('div.empty-state', mi('person_search'), 'No contacts found'));
};

(() => {
  let calls = Store.get('calls', [
    { n: 'Mom', num: '(555) 010-2211', dir: 'in', t: Date.now() - 3 * 3600e3 },
    { n: 'Alex Rivera', num: '(555) 010-4821', dir: 'out', t: Date.now() - 26 * 3600e3 },
    { n: 'Luigi’s Pizza', num: '(555) 010-3377', dir: 'miss', t: Date.now() - 50 * 3600e3 },
    { n: '(555) 010-1234', num: '(555) 010-1234', dir: 'in', t: Date.now() - 4 * 864e5 },
  ]);
  const saveCalls = () => Store.set('calls', calls.slice(0, 40));
  const when = t => { const d = new Date(t), n = new Date(); return d.toDateString() === n.toDateString() ? fmtTime(d) : d.toDateString() === new Date(n - 864e5).toDateString() ? 'Yesterday' : fmtDate(d); };

  /** Full-screen call UI. Returns a controller. */
  function startCall(parent, name, num, color) {
    const o = h('div.call'); parent.append(o);
    const state = { t: 0, muted: false, speaker: false, kp: false, timer: 0, answered: false };
    const status = h('div.call-st', 'Calling…');
    const kpDisp = h('div.call-kp');
    const btn = (ic, label, fn) => { const b = h('button.cb', { onclick: () => fn(b) }, h('div.cb-c', mi(ic)), h('span', label)); return b; };
    const end = () => {
      clearInterval(state.timer); calls.unshift({ n: name, num, dir: 'out', t: Date.now(), dur: state.t }); saveCalls();
      status.textContent = 'Call ended'; o.classList.add('ended'); setTimeout(() => { o.remove(); OS.emit('calls'); }, 700); Sound.tone(480, .25, { vol: .08 });
    };
    o.append(h('div.call-top', h('div.avatar.xl', { style: { background: color || '#5f6368' } }, name[0] === '(' || /^\d/.test(name) ? mi('person', 'fill') : name[0]), h('div.call-n', name), num !== name ? h('div.call-num', num) : null, status),
      kpDisp,
      h('div.call-grid',
        btn('mic_off', 'Mute', b => { state.muted = !state.muted; b.classList.toggle('on', state.muted); }),
        btn('dialpad', 'Keypad', b => { state.kp = !state.kp; b.classList.toggle('on', state.kp); o.classList.toggle('kp', state.kp); }),
        btn('volume_up', 'Speaker', b => { state.speaker = !state.speaker; b.classList.toggle('on', state.speaker); })),
      h('div.call-pad', ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(k => h('button', { onclick: () => { Sound.dtmf(k); kpDisp.textContent += k; } }, k))),
      h('button.call-end', { onclick: end }, mi('call_end', 'fill')));
    // ring, then connect
    let ringN = 0; const ring = setInterval(() => { Sound.tone(440, .4, { vol: .05 }); Sound.tone(480, .4, { vol: .05 }); if (++ringN > 2) { clearInterval(ring); connect(); } }, 1000);
    function connect() {
      if (!o.isConnected) return; state.answered = true; status.textContent = '0:00';
      state.timer = setInterval(() => { state.t++; status.textContent = `${Math.floor(state.t / 60)}:${pad(state.t % 60)}`; }, 1000);
    }
    const old = end; o.end = () => { clearInterval(ring); old(); };
    return o;
  }
  OS.startCall = startCall;

  OS.register({
    id: 'phone', name: 'Phone', icon: { bg: 'linear-gradient(135deg,#5aa0ff,#1a62d6)', glyph: 'call' },
    create(win, ctx) {
      let tab = (ctx.params && ctx.params.tab) || 'favorites', q = '', dial = false, digits = '';
      const root = h('div.app.phone'); win.append(root);
      const callOut = (name, num, color) => startCall(root, name, num, color);
      const render = () => {
        root.querySelectorAll(':scope > :not(.call)').forEach(x => x.remove());
        const body = h('div.scroll.ph-body');
        if (tab === 'favorites') {
          body.append(h('div.fav-grid', OS.contacts.filter(c => c.fav).map(c => h('div.fav', { onclick: () => callOut(c.name, c.phone, c.color) }, OS.avatar(c, 'xl'), h('div', c.name)))),
            h('div.ct-letter', 'Frequent'), ...OS.contacts.filter(c => !c.fav).slice(0, 3).map(c => h('div.list-item', { onclick: () => callOut(c.name, c.phone, c.color) }, OS.avatar(c), h('div.tx', h('div.t1', c.name), h('div.t2', c.phone)))));
        } else if (tab === 'recents') {
          if (!calls.length) body.append(h('div.empty-state', mi('history'), 'No recent calls'));
          calls.forEach(c => body.append(h('div.list-item', { onclick: () => callOut(c.n, c.num, (OS.contactByNumber(c.num) || {}).color) },
            OS.avatar(OS.contactByNumber(c.num) || { name: '#', color: '#5f6368' }), h('div.tx', h('div.t1' + (c.dir === 'miss' ? '.miss' : ''), c.n), h('div.t2', mi(c.dir === 'in' ? 'call_received' : c.dir === 'out' ? 'call_made' : 'call_missed', 'sm'), ' ' + when(c.t))), mi('info', 'dim'))));
        } else {
          body.append(h('div.search-pill.slim', mi('search'), h('input', { placeholder: 'Search contacts', value: q, oninput: e => { q = e.target.value; OS.contactList(list, c => OS.menu({ x: 120, y: 300, h: 0 }, [{ icon: 'call', label: 'Call ' + c.name, cb: () => callOut(c.name, c.phone, c.color) }, { icon: 'chat', label: 'Message', cb: () => OS.openApp('messages', { params: { contact: c.id } }) }]), q); } })));
          const list = h('div'); body.append(list);
          OS.contactList(list, c => OS.menu({ x: 120, y: 300, h: 0 }, [{ icon: 'call', label: 'Call ' + c.name, cb: () => callOut(c.name, c.phone, c.color) }, { icon: 'chat', label: 'Message', cb: () => OS.openApp('messages', { params: { contact: c.id } }) }]), q);
        }
        const nav = h('div.bottom-nav', [['favorites', 'star', 'Favorites'], ['recents', 'schedule', 'Recents'], ['contacts', 'person', 'Contacts']].map(([id, ic, lb]) =>
          h('div.bn' + (tab === id ? '.on' : ''), { onclick: () => { tab = id; render(); } }, mi(ic, tab === id ? 'fill' : ''), lb)));
        root.append(h('div.appbar', h('h1', ''), h('div.ph-search', { onclick: () => { tab = 'contacts'; render(); } }, mi('search'), h('span', 'Search contacts & places'))), body, nav,
          h('button.fab', { onclick: openDial }, mi('dialpad', 'fill')));
        root.querySelector('.appbar h1').remove();
      };
      const openDial = () => {
        digits = ''; dial = true;
        const disp = h('div.dial-n'), pad = h('div.dial-pad');
        const upd = () => { disp.textContent = digits ? fmtNum(digits) : ''; const m = OS.contactByNumber(digits); sug.textContent = m ? m.name : ''; };
        const sug = h('div.dial-s');
        '123456789*0#'.split('').forEach(k => pad.append(h('button', { onclick: () => { if (digits.length < 15) digits += k; Sound.dtmf(k); upd(); } }, k, h('small', ({ 2: 'ABC', 3: 'DEF', 4: 'GHI', 5: 'JKL', 6: 'MNO', 7: 'PQRS', 8: 'TUV', 9: 'WXYZ', 0: '+' })[k] || ''))));
        const sheet = h('div.dial', h('div.dial-top', sug, disp), pad,
          h('div.dial-row', h('i'), h('button.dial-call', { onclick: () => { if (!digits) return; const m = OS.contactByNumber(digits); close(); callOut(m ? m.name : fmtNum(digits), m ? m.phone : fmtNum(digits), m && m.color); } }, mi('call', 'fill')),
            h('button.dial-bs', { onclick: () => { digits = digits.slice(0, -1); upd(); } }, mi('backspace'))));
        const close = () => { dial = false; sheet.remove(); }; sheet.close = close;
        root.append(sheet); ctrl.dial = sheet;
      };
      const fmtNum = d => /^\d{10}$/.test(d) ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d;
      render();
      const ctrl = { onBack() { if (ctrl.dial && ctrl.dial.isConnected) { ctrl.dial.close(); return true; } const c = root.querySelector('.call'); if (c) { return true; } return false; }, onShow() { }, onParams(p) { if (p && p.tab) { tab = p.tab; render(); } if (p && p.dial) { openDial(); digits = p.dial; } } };
      OS.on('calls', () => tab === 'recents' && render());
      return ctrl;
    },
  });

  OS.register({
    id: 'contacts', name: 'Contacts', icon: { bg: 'linear-gradient(135deg,#4f8dff,#1a62d6)', glyph: 'person' },
    create(win) {
      const root = h('div.app'); win.append(root);
      let q = ''; const list = h('div.scroll.pad-nav', { style: 'flex:1' });
      const detail = c => OS.dialog({
        title: c.name, icon: 'person', body: h('div.cdet', h('div.avatar.xl', { style: { background: c.color, margin: '0 auto 12px' } }, c.name[0]), h('div', { style: 'text-align:center;font-size:18px;color:var(--on)' }, c.phone)),
        actions: [{ label: 'Close' }, { label: 'Message', cb: () => { OS.openApp('messages', { params: { contact: c.id } }); } }, { label: 'Call', primary: true, cb: () => { OS.openApp('phone'); setTimeout(() => OS.startCall(document.querySelector('.phone'), c.name, c.phone, c.color), 400); } }],
      });
      root.append(h('div.search-pill', mi('menu'), h('input', { placeholder: 'Search contacts', oninput: e => { q = e.target.value; OS.contactList(list, detail, q); } }), mi('account_circle')), list,
        h('button.fab', { onclick: () => OS.toast('Adding contacts isn’t supported yet') }, mi('person_add')));
      OS.contactList(list, detail);
      return {};
    },
  });
})();
