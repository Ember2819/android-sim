/* Settings — most toggles here are wired to real simulator behaviour. */
'use strict';

OS.register({
  id: 'settings', name: 'Settings', icon: { bg: 'linear-gradient(135deg,#7a8699,#4a5568)', glyph: 'settings' },
  create(win, ctx) {
    const root = h('div.app.settings'); win.append(root);
    const stack = [];
    const c = () => OS.cfg;

    /* ---- row helpers ---- */
    const ico = (name, color) => h('div.s-ic', { style: color ? { background: color } : null }, mi(name, 'fill'));
    const row = ({ icon, color, title, sub, go: to, right, onclick }) => h('div.list-item', { onclick: onclick || (() => to && go(to)) },
      icon ? ico(icon, color) : null, h('div.tx', h('div.t1', title), sub != null ? h('div.t2', sub) : null), right || null);
    const switchRow = ({ icon, title, sub, key, get, set, color }) => {
      const sw = toggleSwitch(get ? get() : c()[key], v => (set ? set(v) : OS.set(key, v)));
      const r = row({ icon, color, title, sub, right: sw, onclick: () => sw.click() });
      return r;
    };
    const section = t => h('div.s-sec', t);
    const sliderRow = (icon, label, val, onChange) => h('div.s-slider', mi(icon), h('div.tx', h('div.t1', label), slider(0, 100, val, onChange)));

    /* ---- pages ---- */
    const pages = {
      root() {
        const q = h('input', { placeholder: 'Search settings' });
        const items = [
          { icon: 'wifi', color: '#1a73e8', title: 'Network & internet', sub: c().wifi && !c().airplane ? c().network : 'Off', go: 'network' },
          { icon: 'devices', color: '#e8710a', title: 'Connected devices', sub: c().bt ? 'Bluetooth, Pixel Buds Pro 2' : 'Bluetooth off', go: 'devices' },
          { icon: 'apps', color: '#188038', title: 'Apps', sub: Object.keys(OS.apps).length + ' apps', go: 'apps' },
          { icon: 'notifications', color: '#d93025', title: 'Notifications', sub: c().dnd ? 'Do Not Disturb is on' : 'Notification history, conversations', go: 'notifications' },
          { icon: 'battery_full', color: '#00897b', title: 'Battery', sub: Math.round(OS.battery.level * 100) + '%' + (c().saver ? ' · Battery Saver on' : ''), go: 'battery' },
          { icon: 'storage', color: '#9334e6', title: 'Storage', sub: '50% used · 64 GB free', go: 'storage' },
          { icon: 'volume_up', color: '#c2185b', title: 'Sound & vibration', sub: 'Volume, haptics, Do Not Disturb', go: 'sound' },
          { icon: 'brightness_medium', color: '#f9ab00', title: 'Display', sub: c().dark ? 'Dark theme on' : 'Dark theme off', go: 'display' },
          { icon: 'wallpaper', color: '#1e88e5', title: 'Wallpaper & style', sub: 'Colors, themed icons, wallpapers', go: 'wallpaper' },
          { icon: 'security', color: '#43a047', title: 'Security & privacy', sub: c().pin ? 'Screen lock: PIN' : 'Screen lock: None', go: 'security' },
          { icon: 'settings_suggest', color: '#546e7a', title: 'System', sub: 'Time, languages, reset', go: 'system' },
          { icon: 'phone_android', color: '#5c6bc0', title: 'About phone', sub: 'Pixel 11', go: 'about' },
        ];
        const list = h('div');
        const fill = () => { list.innerHTML = ''; items.filter(i => (i.title + i.sub).toLowerCase().includes(q.value.toLowerCase())).forEach(i => list.append(row(i))); };
        q.oninput = fill; fill();
        return { title: 'Settings', big: true, node: h('div', h('div.search-pill.slim', mi('search'), q), list) };
      },

      network() {
        const nets = [['Pixel_Home_5G', true, 4], ['CoffeeShop_Guest', false, 3], ['Neighbors-2.4G', true, 2], ['Library_Public', false, 2], ['AndroidAP_2931', true, 1]];
        const list = h('div');
        const fill = () => {
          list.innerHTML = '';
          if (!c().wifi || c().airplane) { list.append(h('div.empty-state', mi('wifi_off'), c().airplane ? 'Airplane mode is on' : 'Turn on Wi-Fi to see available networks')); return; }
          nets.forEach(([n, sec, lvl]) => list.append(row({ icon: ['signal_wifi_0_bar', 'network_wifi_1_bar', 'network_wifi_2_bar', 'network_wifi_3_bar', 'wifi'][lvl], title: n, sub: c().network === n ? 'Connected' : sec ? 'Secured' : 'Open',
            right: sec ? mi('lock', 'dim') : null, onclick: () => { OS.toast('Connecting to ' + n + '…'); setTimeout(() => { OS.set('network', n); OS.toast('Connected to ' + n); fill(); }, 900); } })));
        };
        return { title: 'Network & internet', node: h('div',
          switchRow({ icon: 'wifi', title: 'Wi-Fi', get: () => c().wifi && !c().airplane, set: v => { if (v) OS.set('airplane', false); OS.set('wifi', v); fill(); } }),
          switchRow({ icon: 'flight', title: 'Airplane mode', key: 'airplane', set: v => { OS.set('airplane', v); fill(); } }),
          switchRow({ icon: 'wifi_tethering', title: 'Hotspot & tethering', sub: 'Share your connection', key: 'hotspot' }), section('Available networks'), list) , after: fill };
      },

      devices() {
        const devs = [['headphones', 'Pixel Buds Pro 2', 'Connected · Battery 86%'], ['directions_car', 'Car Audio', 'Saved'], ['speaker', 'JBL Flip 6', 'Saved'], ['keyboard', 'Keyboard K3', 'Saved']];
        return { title: 'Connected devices', node: h('div', switchRow({ icon: 'bluetooth', title: 'Bluetooth', key: 'bt' }), section('Previously connected devices'),
          devs.map(([ic, n, s], i) => row({ icon: ic, title: n, sub: s, onclick: () => OS.toast(i === 0 ? 'Already connected' : 'Connecting to ' + n + '…') })),
          row({ icon: 'add', title: 'Pair new device', onclick: () => OS.toast('Searching for nearby devices…') })) };
      },

      apps() {
        const all = Object.values(OS.apps).sort((a, b) => a.name.localeCompare(b.name));
        return { title: 'Apps', node: h('div', h('div.s-sub', `${all.length} apps installed`), all.map(a => row({ icon: null, title: a.name, sub: a.installed ? 'Installed from Play Store' : 'System app', go: 'app:' + a.id, right: null,
          onclick: () => go('app:' + a.id) })).map((r, i) => { r.prepend(OS.iconEl(all[i], 40)); return r; })) };
      },

      notifications() {
        return { title: 'Notifications', node: h('div', switchRow({ icon: 'do_not_disturb_on', title: 'Do Not Disturb', sub: 'Silence heads-up notifications and sounds', key: 'dnd' }),
          row({ icon: 'history', title: 'Notification history', sub: `${OS.notifs.length} notification${OS.notifs.length === 1 ? '' : 's'} right now` }),
          switchRow({ icon: 'lock', title: 'Lock screen notifications', get: () => true, set: () => OS.toast('Always shown in this simulator') }),
          section('Recently sent'), OS.notifs.slice(0, 5).map(n => row({ icon: (OS.apps[n.app] && OS.apps[n.app].icon.glyph) || 'notifications', title: n.title, sub: n.text }))) };
      },

      battery() {
        const b = OS.battery;
        return { title: 'Battery', node: h('div', h('div.bat-big', Math.round(b.level * 100) + '%', h('small', b.charging ? 'Charging' : 'On battery')),
          h('div.bat-bar', h('i', { style: { width: b.level * 100 + '%' } })),
          h('div.s-sub', b.charging ? 'Charging — full in about 40 min' : `About ${Math.round(b.level * 30)} hr left · Screen on time 4 hr 12 min`),
          switchRow({ icon: 'battery_saver', title: 'Battery Saver', sub: 'Extends battery life by limiting background activity', key: 'saver', set: v => { OS.set('saver', v); OS.applyTheme(); } }),
          switchRow({ icon: 'battery_charging_full', title: 'Adaptive charging', get: () => true, set: () => { } })) };
      },

      storage() {
        const cats = [['Apps', 22, '#1a73e8'], ['Images', 14, '#e8710a'], ['Videos', 9, '#d93025'], ['Audio', 4, '#9334e6'], ['System', 15.2, '#5f6368']];
        return { title: 'Storage', node: h('div', h('div.bat-big', '64.2 GB', h('small', 'used of 128 GB')),
          h('div.stack', cats.map(([, v, col]) => h('i', { style: { width: v / 128 * 100 + '%', background: col } }))),
          cats.map(([n, v, col]) => row({ icon: 'circle', color: col, title: n, sub: v + ' GB' }))) };
      },

      sound() {
        const v = c().volume;
        return { title: 'Sound & vibration', node: h('div',
          sliderRow('music_note', 'Media volume', v.media, x => { c().volume.media = x; OS.save(); Sound.click(); }),
          sliderRow('notifications', 'Ring & notification volume', v.ring, x => { c().volume.ring = x; OS.save(); }),
          sliderRow('alarm', 'Alarm volume', v.alarm, x => { c().volume.alarm = x; OS.save(); Sound.tone(900, .1, { vol: x / 400 }); }),
          section('Ringer mode'), ['sound', 'vibrate', 'silent'].map(m => row({ icon: m === 'sound' ? 'notifications_active' : m === 'vibrate' ? 'vibration' : 'notifications_off', title: m[0].toUpperCase() + m.slice(1), right: h('div.radio' + (c().ringer === m ? '.on' : '')), onclick: () => { OS.set('ringer', m); rerender(); } })),
          switchRow({ icon: 'do_not_disturb_on', title: 'Do Not Disturb', key: 'dnd' })) };
      },

      display() {
        return { title: 'Display', node: h('div',
          switchRow({ icon: 'dark_mode', title: 'Dark theme', sub: 'Use a dark background everywhere', key: 'dark', set: v => { OS.set('dark', v); OS.applyTheme(); OS.updateSB(); } }),
          sliderRow('brightness_medium', 'Brightness level', c().brightness, x => { c().brightness = x; OS.save(); OS.applyTheme(); OS.emit('cfg:brightness', x); }),
          switchRow({ icon: 'nightlight', title: 'Night Light', sub: 'Warm the screen colors', key: 'nightlight', set: v => { OS.set('nightlight', v); OS.applyTheme(); } }),
          switchRow({ icon: 'screen_rotation', title: 'Auto-rotate screen', key: 'rotate' }),
          row({ icon: 'timer', title: 'Screen timeout', sub: 'After 1 minute of inactivity' })) };
      },

      wallpaper() {
        const preview = h('div.wp-prev', h('div.wp-clock', h('b', pad(new Date().getHours() % 12 || 12)), h('b', pad(new Date().getMinutes()))), h('div.wp-dock', [1, 2, 3, 4].map(() => h('i'))));
        const paint = () => { const w = OS.WALLPAPERS[c().wp]; preview.style.background = c().customWp ? `center/cover url(${c().customWp})` : w.css; };
        paint();
        const thumbs = h('div.wp-grid', OS.WALLPAPERS.map((w, i) => h('div.wp-th' + (!c().customWp && c().wp === i ? '.on' : ''), { style: { background: w.css }, onclick: () => { OS.set('customWp', null); OS.set('wp', i); OS.set('hue', null); OS.applyTheme(); rerender(); } }, h('span', w.name))),
          h('label.wp-th.up', mi('add_photo_alternate'), h('span', 'Upload'), h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: e => {
            const f = e.target.files[0]; if (!f) return; const r = new FileReader();
            r.onload = () => { const img = new Image(); img.onload = () => { const cv = document.createElement('canvas'), k = Math.min(1, 900 / img.height); cv.width = img.width * k; cv.height = img.height * k; cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); OS.set('customWp', cv.toDataURL('image/jpeg', .85)); OS.applyTheme(); rerender(); }; img.src = r.result; };
            r.readAsDataURL(f); } })));
        const sw = h('div.col-row.big', [null, ...OS.ACCENTS].map(hue => h('i' + ((c().hue ?? null) === hue ? '.on' : ''), { style: { background: hue == null ? 'conic-gradient(#f66,#fc6,#6c6,#6cf,#96f,#f66)' : `oklch(.7 .15 ${hue})` }, onclick: () => { OS.set('hue', hue); OS.applyTheme(); rerender(); } }, hue == null ? 'A' : '')));
        return { title: 'Wallpaper & style', node: h('div', preview, section('Wallpapers'), thumbs, section('Colors'), sw,
          switchRow({ icon: 'palette', title: 'Themed icons', sub: 'Use theme colors for app icons', key: 'themed', set: v => { OS.set('themed', v); OS.applyTheme(); } }),
          switchRow({ icon: 'dark_mode', title: 'Dark theme', key: 'dark', set: v => { OS.set('dark', v); OS.applyTheme(); OS.updateSB(); } })) };
      },

      security() {
        return { title: 'Security & privacy', node: h('div',
          row({ icon: 'lock', title: 'Screen lock', sub: c().pin ? 'PIN' : 'None — swipe to unlock', onclick: setLock }),
          row({ icon: 'fingerprint', title: 'Fingerprint Unlock', sub: 'Tap the sensor on the lock screen', onclick: () => OS.toast('Tap the fingerprint icon on the lock screen') }),
          switchRow({ icon: 'location_on', title: 'Location', key: 'location' }),
          row({ icon: 'shield', title: 'Play Protect', sub: 'No harmful apps found' })) };
      },

      system() {
        return { title: 'System', node: h('div',
          switchRow({ icon: 'schedule', title: 'Use 24-hour format', sub: 'e.g. 13:00', key: 'h24', get: () => !!c().h24, set: v => OS.set('h24', v) }),
          row({ icon: 'language', title: 'Languages', sub: 'English (United States)' }),
          row({ icon: 'gesture', title: 'Gestures', sub: 'Swipe up to go home · hold for recents · edge swipe for back' }),
          row({ icon: 'restart_alt', title: 'Reset options', sub: 'Erase all data (factory reset)', onclick: () => OS.dialog({ title: 'Erase all data?', body: 'Notes, messages, photos and settings in this browser will be deleted.', actions: [{ label: 'Cancel' }, { label: 'Erase', primary: true, cb: () => { Store.clear(); location.reload(); } }] }) })) };
      },

      about() {
        const data = [['Device name', 'Pixel 11'], ['Model', 'Pixel 11 (simulated)'], ['Android version', '17'], ['Android security update', 'October 5, 2026'], ['Processor', 'Google Tensor G6'], ['Memory', '12 GB'], ['Storage', '128 GB'], ['Display', '6.3″ Actua OLED · 120 Hz'], ['Build number', 'CP41.261005.003'], ['Simulator', 'Browser web app — not real Android']];
        return { title: 'About phone', node: h('div', h('div.about-hero', mi('smartphone', 'fill'), h('div', 'Pixel 11')),
          data.map(([k, v]) => row({ title: k, sub: v, onclick: k === 'Build number' ? () => {
            const t = c().devTaps + 1; OS.cfg.devTaps = t; OS.save();
            if (t >= 7) OS.toast('You are now a developer!'); else if (t >= 4) OS.toast(`${7 - t} steps away from being a developer`);
          } : null }))) };
      },
    };

    function appInfo(id) {
      const a = OS.apps[id]; if (!a) return pages.apps();
      return { title: 'App info', node: h('div.ai-page', OS.iconEl(a, 72), h('div.ai-n', a.name), h('div.ai-v', 'Version 17.0.' + (a.name.length * 7)),
        h('div.ai-btns', h('button.btn.tonal', { onclick: () => OS.launch(id) }, mi('open_in_new'), 'Open'),
          h('button.btn.tonal', { onclick: () => { OS.closeApp(id); OS.toast(a.name + ' stopped'); } }, mi('cancel'), 'Force stop'),
          a.installed ? h('button.btn.tonal', { onclick: () => { OS.uninstall(id); back(); } }, mi('delete'), 'Uninstall') : h('button.btn.tonal', { onclick: () => OS.toast('System apps can’t be disabled here') }, mi('block'), 'Disable')),
        row({ icon: 'notifications', title: 'Notifications', sub: 'On' }), row({ icon: 'security', title: 'Permissions', sub: id === 'camera' ? 'Camera' : id === 'maps' ? 'Location' : 'No permissions granted' }),
        row({ icon: 'storage', title: 'Storage & cache', sub: '38.4 MB used' }), row({ icon: 'battery_full', title: 'Battery', sub: 'Optimized' })) };
    }

    async function setLock() {
      if (c().pin) {
        OS.dialog({ title: 'Screen lock', body: 'Current: PIN', actions: [{ label: 'Remove lock', cb: () => { OS.set('pin', ''); rerender(); } }, { label: 'Change PIN', primary: true, cb: () => { setTimeout(newPin, 200); } }] });
      } else newPin();
    }
    async function newPin() {
      const p = await OS.prompt('Choose a PIN', { placeholder: '4–6 digits', type: 'password', ok: 'Next' });
      if (p == null) return; if (!/^\d{4,6}$/.test(p)) return OS.toast('PIN must be 4–6 digits');
      const p2 = await OS.prompt('Confirm your PIN', { type: 'password', ok: 'Confirm' });
      if (p2 == null) return; if (p2 !== p) return OS.toast('PINs didn’t match');
      OS.set('pin', p); OS.toast('PIN set — try locking the phone'); rerender();
    }

    /* ---- navigation ---- */
    let cur = null;
    function build(name) { return name.startsWith('app:') ? appInfo(name.slice(4)) : pages[name](); }
    function render() {
      const pg = build(stack[stack.length - 1]); cur = pg; root.innerHTML = '';
      const body = h('div.scroll.pad-nav.s-body', pg.node);
      root.append(pg.big ? h('div.s-big', h('h1', pg.title)) : h('div.appbar', h('button.icon-btn', { onclick: back }, mi('arrow_back')), h('h1', pg.title)), body);
      pg.after && pg.after();
    }
    const rerender = () => { const sc = $('.s-body', root); const t = sc ? sc.scrollTop : 0; render(); const n = $('.s-body', root); if (n) n.scrollTop = t; };
    function go(p) { stack.push(p); render(); }
    function back() { if (stack.length > 1) { stack.pop(); render(); return true; } OS.goHome(); return true; }
    stack.push('root');
    const p0 = ctx.params && ctx.params.page; if (p0 && (pages[p0] || p0.startsWith('app:'))) stack.push(p0);
    render();
    const offs = ['cfg', 'battery'].map(ev => OS.on(ev, () => { if (stack.length === 1 && root.isConnected) { const q = $('input', root); if (!q || !q.value) rerender(); } }));
    return {
      onBack: () => { if (stack.length > 1) { back(); return true; } return false; },
      onParams(p) { if (p && p.page) { stack.length = 1; stack.push(p.page); render(); } },
    };
  },
});
