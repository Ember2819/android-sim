/* Play Store: installs placeholder apps onto the home screen / app drawer. */
'use strict';

(() => {
  const CATALOG = [
    { id: 'spotify', name: 'Spotify', cat: 'Music & Audio', rating: 4.5, size: '78 MB', bg: '#1db954', glyph: 'music_note', url: 'https://open.spotify.com' },
    { id: 'netflix', name: 'Netflix', cat: 'Entertainment', rating: 4.3, size: '65 MB', bg: '#111', fg: '#e50914', glyph: 'movie', url: 'https://www.netflix.com' },
    { id: 'instagram', name: 'Instagram', cat: 'Social', rating: 4.2, size: '55 MB', bg: 'linear-gradient(45deg,#fd5949,#d6249f,#285aeb)', glyph: 'photo_camera', url: 'https://www.instagram.com' },
    { id: 'whatsapp', name: 'WhatsApp', cat: 'Communication', rating: 4.4, size: '52 MB', bg: '#25d366', glyph: 'call', url: 'https://web.whatsapp.com' },
    { id: 'reddit', name: 'Reddit', cat: 'Social', rating: 4.1, size: '62 MB', bg: '#ff4500', glyph: 'forum', url: 'https://www.reddit.com' },
    { id: 'discord', name: 'Discord', cat: 'Communication', rating: 4.4, size: '120 MB', bg: '#5865f2', glyph: 'headset_mic', url: 'https://discord.com/app' },
    { id: 'duolingo', name: 'Duolingo', cat: 'Education', rating: 4.7, size: '48 MB', bg: '#58cc02', glyph: 'school', url: 'https://www.duolingo.com' },
    { id: 'uber', name: 'Uber', cat: 'Maps & Navigation', rating: 4.6, size: '86 MB', bg: '#000', glyph: 'local_taxi', url: 'https://m.uber.com' },
    { id: 'telegram', name: 'Telegram', cat: 'Communication', rating: 4.5, size: '70 MB', bg: '#27a7e7', glyph: 'send', url: 'https://web.telegram.org' },
    { id: 'pinterest', name: 'Pinterest', cat: 'Lifestyle', rating: 4.5, size: '45 MB', bg: '#e60023', glyph: 'push_pin', url: 'https://www.pinterest.com' },
    { id: 'tiktok', name: 'TikTok', cat: 'Entertainment', rating: 4.0, size: '95 MB', bg: '#010101', fg: '#25f4ee', glyph: 'music_video', url: 'https://www.tiktok.com' },
    { id: 'twitch', name: 'Twitch', cat: 'Entertainment', rating: 4.2, size: '88 MB', bg: '#9146ff', glyph: 'videogame_asset', url: 'https://www.twitch.tv' },
  ];
  let installed = Store.get('installed', []);
  const defOf = c => ({ id: c.id, name: c.name, installed: true, icon: { bg: c.bg, glyph: c.glyph, fg: c.fg || '#fff' }, url: c.url, desc: `${c.name} is a placeholder app installed from the simulated Play Store.` });
  const reg = c => OS.genericApp(defOf(c));
  installed.forEach(id => { const c = CATALOG.find(x => x.id === id); if (c) reg(c); });

  OS.installApp = c => { reg(c); installed.push(c.id); Store.set('installed', installed); OS.addToHome(c.id); OS.emit('apps'); };
  OS.uninstall = id => {
    const run = OS.running.find(r => r.id === id); if (run) OS.closeApp(id);
    delete OS.apps[id]; installed = installed.filter(x => x !== id); Store.set('installed', installed);
    OS.layout.pages = OS.layout.pages.map(p => p.filter(x => x !== id)); OS.saveLayout(); OS.emit('apps'); OS.toast('App uninstalled');
  };

  OS.register({
    id: 'playstore', name: 'Play Store', icon: { bg: '#fff', special: '<span class="play-ico"></span>', glyph: 'play_arrow', fg: '#01875f' },
    create(win) {
      const root = h('div.app.store'); win.append(root);
      let tab = 'For you', q = '';
      const rowFor = c => {
        const has = installed.includes(c.id);
        const btn = h('button.st-btn' + (has ? '.open' : ''), has ? 'Open' : 'Install');
        const row = h('div.st-row', { onclick: () => has && OS.launch(c.id) }, OS.iconEl({ id: c.id, icon: { bg: c.bg, glyph: c.glyph, fg: c.fg || '#fff' } }, 56),
          h('div.st-tx', h('div.st-n', c.name), h('div.st-m', `${c.cat} · ${c.size}`), h('div.st-r', `${c.rating} `, mi('star', 'fill sm'))), btn);
        btn.onclick = e => {
          e.stopPropagation();
          if (installed.includes(c.id)) return OS.launch(c.id);
          btn.className = 'st-btn prog'; btn.innerHTML = '<i></i>'; btn.firstChild.style.animation = 'stprog 2.2s linear forwards';
          setTimeout(() => {
            OS.installApp(c); btn.className = 'st-btn open'; btn.textContent = 'Open'; OS.toast(c.name + ' installed');
            OS.notify({ app: 'playstore', title: c.name + ' installed', text: 'Tap to open', onTap: () => OS.launch(c.id), silent: OS.current === 'playstore' });
          }, 2300);
        };
        return row;
      };
      const render = () => {
        root.innerHTML = '';
        const list = CATALOG.filter(c => (c.name + c.cat).toLowerCase().includes(q.toLowerCase()) && (tab === 'For you' || tab === 'Top charts' || (tab === 'Installed' && installed.includes(c.id))));
        if (tab === 'Top charts') list.sort((a, b) => b.rating - a.rating);
        const inp = h('input', { placeholder: 'Search apps & games', value: q, oninput: e => { q = e.target.value; const p = e.target.selectionStart; render(); const i = root.querySelector('input'); i.focus(); i.setSelectionRange(p, p); } });
        root.append(h('div.search-pill', mi('search'), inp, h('div.avatar.sm', { style: { background: '#7e57c2' } }, 'P')),
          h('div.chips.scroll-x', ['For you', 'Top charts', 'Installed'].map(t => h('div.chip' + (t === tab ? '.on' : ''), { onclick: () => { tab = t; render(); } }, t))),
          h('div.scroll.pad-nav', { style: 'flex:1;padding-top:8px' }, list.length ? list.map(rowFor) : h('div.empty-state', mi('apps'), tab === 'Installed' ? 'Nothing installed yet' : 'No results')));
      };
      render(); OS.on('apps', () => root.isConnected && render());
      return {};
    },
  });
})();
