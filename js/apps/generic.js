/* Apps that are not full re-creations: Gmail (mock inbox), Files, Wallet, and a generic "web app" shell. */
'use strict';

/** Lightweight stand-in app: icon, description and an "open the real site" button. */
OS.genericApp = ({ id, name, icon, url, desc, installed }) => OS.register({
  id, name, icon, installed,
  create(win) {
    win.append(h('div.app.generic',
      h('div.appbar', h('button.icon-btn', { onclick: () => OS.goHome() }, mi('arrow_back')), h('h1', name)),
      h('div.gen-body',
        OS.iconEl({ id, icon }, 96),
        h('div.gen-name', name),
        h('div.gen-desc', desc || `${name} isn't part of this simulator yet, but the real thing is one tap away.`),
        url ? h('button.btn', { onclick: () => window.open(url, '_blank', 'noopener') }, `Open ${new URL(url).hostname.replace('www.', '')}`) : null,
        h('div.gen-note', 'Simulated app'))));
    return {};
  },
});

OS.genericApp({ id: 'youtube', name: 'YouTube', icon: { bg: '#fff', glyph: 'smart_display', fg: '#f03' }, url: 'https://www.youtube.com', desc: 'Video streaming runs on the real site — open it in a browser tab.' });
OS.genericApp({ id: 'drive', name: 'Drive', icon: { bg: '#fff', glyph: 'add_to_drive', fg: '#1a73e8' }, url: 'https://drive.google.com', desc: 'Your files live in the cloud, not in this simulator.' });
OS.genericApp({ id: 'meet', name: 'Meet', icon: { bg: '#fff', glyph: 'videocam', fg: '#00897b' }, url: 'https://meet.google.com', desc: 'Start or join a video call from the real Meet site.' });

/* ---------------- Gmail ---------------- */
const MAILS = [
  { from: 'Google Pixel', s: 'Welcome to your Pixel 11', p: 'Here are some tips to get the most from your new phone…', c: '#4285f4', t: '9:41 AM', b: 'Welcome to Pixel 11!\n\nSwipe up from the bottom to see all your apps, pull down from the top for quick settings, and long-press the home screen to change your wallpaper.\n\nEnjoy,\nThe Pixel team' },
  { from: 'Alex Rivera', s: 'Weekend hike?', p: 'The forecast looks great for Saturday. Want to hit the ridge trail at 8?', c: '#e8710a', t: '8:15 AM', b: 'Hey!\n\nThe forecast looks great for Saturday. Want to hit the ridge trail at 8? I can drive.\n\n— Alex' },
  { from: 'Calendar', s: 'Invitation: Team sync @ 3:00 PM', p: 'You have been invited to the following event…', c: '#1a73e8', t: 'Yesterday', b: 'You have been invited to Team sync.\n\nWhen: Today 3:00 PM\nWhere: Google Meet\n\nReply: Yes · No · Maybe' },
  { from: 'Priya Nair', s: 'Photos from last week', p: 'Finally got around to uploading them. The sunset ones are my favorite!', c: '#9334e6', t: 'Yesterday', b: 'Finally got around to uploading them. The sunset ones are my favorite!\n\nPriya' },
  { from: 'Acme Store', s: 'Your order has shipped 📦', p: 'Good news! Your order #48213 is on its way and will arrive Thursday.', c: '#188038', t: 'Oct 25', b: 'Good news! Your order #48213 is on its way and will arrive Thursday.' },
  { from: 'Sam Patel', s: 'Re: Budget draft', p: 'Looks good to me — just a couple of small comments in the doc.', c: '#d93025', t: 'Oct 24', b: 'Looks good to me — just a couple of small comments in the doc.\n\nSam' },
  { from: 'Google', s: 'Security alert', p: 'A new sign-in on Pixel 11. If this was you, you don’t need to do anything.', c: '#ea4335', t: 'Oct 22', b: 'A new sign-in on Pixel 11. If this was you, you don’t need to do anything.' },
];
OS.register({
  id: 'gmail', name: 'Gmail', icon: { bg: '#fff', glyph: 'mail', fg: '#ea4335' },
  create(win) {
    const starred = new Set([1]); const read = new Set([3, 4, 5, 6]);
    const root = h('div.app'); win.append(root);
    const list = () => {
      root.innerHTML = '';
      root.append(
        h('div.search-pill', mi('menu'), h('span', 'Search in mail'), h('div.avatar.sm', { style: { background: '#7e57c2' } }, 'P')),
        h('div.mail-label', 'Primary'),
        h('div.mail-list.scroll', MAILS.map((m, i) => h('div.mail' + (read.has(i) ? '.read' : ''), { onclick: () => { read.add(i); open(i); } },
          h('div.avatar', { style: { background: m.c } }, m.from[0]),
          h('div.mail-tx', h('div.mail-top', h('b', m.from), h('span', m.t)), h('div.mail-s', m.s), h('div.mail-p', m.p)),
          h('button.mail-star', { onclick: e => { e.stopPropagation(); starred.has(i) ? starred.delete(i) : starred.add(i); list(); } }, mi('star', starred.has(i) ? 'fill gold' : ''))))),
        h('button.fab', { onclick: () => OS.toast('Compose isn’t available in the simulator') }, mi('edit'), 'Compose'));
    };
    const open = i => {
      const m = MAILS[i]; root.innerHTML = '';
      root.append(h('div.appbar', h('button.icon-btn', { onclick: list }, mi('arrow_back')), h('div', { style: 'flex:1' }),
        h('button.icon-btn', { onclick: () => OS.toast('Archived') }, mi('archive')), h('button.icon-btn', { onclick: () => OS.toast('Deleted') }, mi('delete'))),
        h('div.mail-view.scroll', h('div.mv-s', m.s), h('div.mv-from', h('div.avatar', { style: { background: m.c } }, m.from[0]), h('div', h('b', m.from), h('div.mv-to', 'to me · ' + m.t))),
          h('div.mv-body', m.b)));
    };
    list();
    return { onBack() { if (root.querySelector('.mail-view')) { list(); return true; } return false; } };
  },
});

/* ---------------- Files ---------------- */
OS.register({
  id: 'files', name: 'Files', icon: { bg: 'linear-gradient(135deg,#4f8dff,#1a62d6)', glyph: 'folder' },
  create(win) {
    const used = 64.2, total = 128;
    const cats = [['image', 'Images', '#e8710a'], ['movie', 'Videos', '#d93025'], ['music_note', 'Audio', '#9334e6'], ['description', 'Documents', '#1a73e8'], ['download', 'Downloads', '#188038'], ['apps', 'Apps', '#00897b']];
    win.append(h('div.app',
      h('div.search-pill', mi('menu'), h('span', 'Search this phone'), mi('more_vert')),
      h('div.scroll.pad-nav', { style: 'flex:1;padding:6px 16px' },
        h('div.files-cats', cats.map(([ic, n, c]) => h('div.fcat', { onclick: () => OS.toast(n + ' is empty in the simulator') }, h('div.fcat-ic', { style: { background: c } }, mi(ic, 'fill')), n))),
        h('div.files-store', h('div.fs-t', 'Storage'), h('div.fs-bar', h('i', { style: { width: used / total * 100 + '%' } })), h('div.fs-s', `${used} GB used of ${total} GB`)),
        h('div.fs-h', 'Recent files'),
        ['Boarding-pass.pdf · 214 KB', 'Resume-2026.docx · 88 KB', 'IMG_2043.jpg · 3.1 MB', 'budget.xlsx · 41 KB'].map(f => h('div.list-item', mi('insert_drive_file', 'fill'), h('div.tx', h('div.t1', f.split(' · ')[0]), h('div.t2', f.split(' · ')[1])))))));
    return {};
  },
});

/* ---------------- Wallet ---------------- */
OS.register({
  id: 'wallet', name: 'Wallet', icon: { bg: '#fff', glyph: 'account_balance_wallet', fg: '#1a73e8' },
  create(win) {
    win.append(h('div.app',
      h('div.appbar', h('button.icon-btn', { onclick: () => OS.goHome() }, mi('arrow_back')), h('h1', 'Wallet')),
      h('div.scroll.pad-nav', { style: 'flex:1;padding:8px 20px' },
        h('div.card-pay', { style: 'background:linear-gradient(135deg,#1a73e8,#7b3fe4)' }, h('div.cp-top', h('span', 'Pixel Pay'), mi('contactless')), h('div.cp-num', '•••• 4821'), h('div.cp-bot', h('span', 'PIXEL USER'), h('span', '09/29'))),
        h('div.card-pay', { style: 'background:linear-gradient(135deg,#0f9d58,#0b6e4f)' }, h('div.cp-top', h('span', 'Debit'), mi('contactless')), h('div.cp-num', '•••• 9034'), h('div.cp-bot', h('span', 'PIXEL USER'), h('span', '02/28'))),
        h('div.gen-note', { style: 'margin-top:20px' }, 'Simulated cards — nothing here is real'))));
    return {};
  },
});
