/* Messages: conversations with simulated replies and notifications. */
'use strict';

(() => {
  const now = Date.now();
  let convs = Store.get('sms', null) || [
    { id: 'mom', unread: 1, msgs: [{ me: false, text: 'Hi sweetie! Are you free this weekend?', t: now - 5 * 3600e3 }, { me: true, text: 'Yeah, what’s up?', t: now - 5 * 3600e3 + 120e3 }, { me: false, text: "Don't forget dinner on Sunday 🍝 Bring dessert!", t: now - 2 * 60e3 }] },
    { id: 'alex', unread: 0, msgs: [{ me: true, text: 'Trail at 8 on Saturday?', t: now - 30 * 3600e3 }, { me: false, text: 'Perfect, I’ll bring coffee ☕', t: now - 29 * 3600e3 }] },
    { id: 'priya', unread: 0, msgs: [{ me: false, text: 'Sent you the photos 📸', t: now - 3 * 864e5 }, { me: true, text: 'Got them, thank you!!', t: now - 3 * 864e5 + 600e3 }] },
    { id: 'pixel', unread: 0, msgs: [{ me: false, text: 'Welcome to Pixel 11! Reply HELP anytime for tips.', t: now - 7 * 864e5 }] },
  ];
  const save = () => Store.set('sms', convs);
  const CANNED = {
    mom: ['Love you too ❤️', 'Call me when you get a chance!', 'Okay sweetie 😊', 'Drive safe!'],
    dad: ['👍', 'Sounds good, kiddo.', 'Let me know!'],
    default: ['Sounds good!', 'Haha, nice 😄', 'Let me check and get back to you', 'Yeah for sure', 'On my way!', 'Can we do later?', '👍', 'Awesome, thanks!'],
  };
  const reply = (c, text) => {
    const t = text.toLowerCase();
    if (/^(hi|hey|hello|yo)\b/.test(t)) return 'Hey! 😊';
    if (/thank|thx/.test(t)) return 'Anytime!';
    if (/help/.test(t) && c === 'pixel') return 'Tips: swipe up for apps, pull down for quick settings, long-press the home screen for wallpapers.';
    if (/\b(where|when|what|how|why)\b|\?/.test(t)) return ['Good question — let me think.', 'Not sure, I’ll find out!', 'Probably around 6?'][Math.floor(Math.random() * 3)];
    const pool = CANNED[c] || CANNED.default; return pool[Math.floor(Math.random() * pool.length)];
  };
  const preview = c => { const m = c.msgs[c.msgs.length - 1]; return (m.me ? 'You: ' : '') + m.text; };
  const short = t => { const d = new Date(t), n = new Date(); return d.toDateString() === n.toDateString() ? fmtTime(d) : (n - d) < 6 * 864e5 ? DAYS[d.getDay()].slice(0, 3) : fmtDate(d); };

  OS.register({
    id: 'messages', name: 'Messages', icon: { bg: 'linear-gradient(135deg,#4f8dff,#1a62d6)', glyph: 'chat' },
    create(win, ctx) {
      const root = h('div.app.msgs'); win.append(root);
      let open = null; // conversation id
      const conv = id => convs.find(c => c.id === id);
      const list = () => {
        open = null; OS._smsOpen = null; root.innerHTML = '';
        const sorted = convs.slice().sort((a, b) => b.msgs[b.msgs.length - 1].t - a.msgs[a.msgs.length - 1].t);
        root.append(h('div.search-pill', mi('search'), h('span', 'Search conversations'), h('div.avatar.sm', { style: { background: '#7e57c2' } }, 'P')),
          h('div.scroll.pad-nav', { style: 'flex:1' }, sorted.map(c => {
            const ct = OS.contactById(c.id) || { name: c.id, color: '#5f6368' };
            return h('div.list-item.conv' + (c.unread ? '.unread' : ''), { onclick: () => thread(c.id) }, OS.avatar(ct),
              h('div.tx', h('div.t1', ct.name), h('div.t2', preview(c))), h('div.cv-t', short(c.msgs[c.msgs.length - 1].t), c.unread ? h('i.badge') : null));
          })),
          h('button.fab', { onclick: newChat }, mi('add_comment', 'fill'), 'Start chat'));
      };
      const newChat = () => OS.dialog({ title: 'Start chat', body: h('div.city-pick', OS.contacts.map(c => h('div.menu-item', { onclick: () => { OS.closePopups(); if (!conv(c.id)) { convs.push({ id: c.id, unread: 0, msgs: [] }); save(); } thread(c.id); } }, OS.avatar(c, 'sm'), c.name))), actions: [{ label: 'Cancel' }] });

      const thread = id => {
        open = id; OS._smsOpen = id; const c = conv(id); c.unread = 0; save(); OS.dismissKey('sms:' + id); if (id === 'mom') OS.dismissKey('seed1');
        const ct = OS.contactById(id) || { name: id, color: '#5f6368', phone: '' };
        root.innerHTML = '';
        const box = h('div.scroll.bubbles'), typing = h('div.msg.them.typing', h('i'), h('i'), h('i'));
        const paint = () => {
          box.innerHTML = ''; let lastDay = '';
          c.msgs.forEach((m, i) => {
            const day = new Date(m.t).toDateString();
            if (day !== lastDay) { lastDay = day; box.append(h('div.day', day === new Date().toDateString() ? 'Today' : fmtDate(new Date(m.t)))); }
            const prev = c.msgs[i - 1], next = c.msgs[i + 1];
            box.append(h('div.msg.' + (m.me ? 'me' : 'them') + (next && next.me === m.me ? '.grp' : ''), m.text, !next || next.me !== m.me ? h('span.mt', fmtTime(new Date(m.t))) : null));
          });
          box.scrollTop = box.scrollHeight;
        };
        const inp = h('input', { placeholder: 'Text message', onkeydown: e => { if (e.key === 'Enter') send(); } });
        const send = () => {
          const text = inp.value.trim(); if (!text) return; inp.value = '';
          c.msgs.push({ me: true, text, t: Date.now() }); save(); paint(); Sound.click();
          setTimeout(() => { if (open === id) { box.append(typing); box.scrollTop = box.scrollHeight; } }, 600);
          setTimeout(() => incoming(id, reply(id, text)), 1500 + Math.random() * 1500);
        };
        root.append(h('div.appbar', h('button.icon-btn', { onclick: list }, mi('arrow_back')), OS.avatar(ct, 'sm'), h('h1', { style: 'font-size:19px;margin-left:8px' }, ct.name),
          h('button.icon-btn', { onclick: () => { OS.openApp('phone'); setTimeout(() => OS.startCall(document.querySelector('.phone'), ct.name, ct.phone, ct.color), 400); } }, mi('call')), h('button.icon-btn', mi('more_vert'))),
          box, h('div.composer', h('button.icon-btn', mi('add_circle')), h('div.cmp-in', inp), h('button.send', { onclick: send }, mi('send', 'fill'))));
        paint(); OS.closePopups();
      };

      OS.on('sms:incoming', id => { if (open === id) { const c = conv(id); thread(id); } else if (!open) list(); });
      ctx.params && ctx.params.contact ? (convs.some(c => c.id === ctx.params.contact) || (convs.push({ id: ctx.params.contact, unread: 0, msgs: [] }), save()), thread(ctx.params.contact)) : list();
      return {
        onBack() { if (open) { list(); return true; } return false; },
        onParams(p) { if (p && p.contact) { if (!conv(p.contact)) { convs.push({ id: p.contact, unread: 0, msgs: [] }); save(); } thread(p.contact); } },
        onShow() { open ? thread(open) : list(); },
        destroy() { OS._smsOpen = null; },
      };
    },
  });

  function incoming(id, text) {
    const c = convs.find(x => x.id === id); if (!c) return;
    c.msgs.push({ me: false, text, t: Date.now() });
    const viewing = OS.current === 'messages' && OS._smsOpen === id;
    if (!viewing) c.unread++;
    save(); OS.emit('sms:incoming', id);
    const ct = OS.contactById(id) || { name: id };
    if (!viewing) OS.notify({ app: 'messages', key: 'sms:' + id, title: ct.name, text, params: { contact: id }, actions: [{ label: 'Reply', cb: n => { OS.dismiss(n.id); OS.shadeTo(false, true); OS.openApp('messages', { params: { contact: id } }); } }] });
  }
  OS.smsIncoming = incoming;
})();
