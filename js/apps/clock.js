/* Clock: alarms, world clock, timer, stopwatch. Timers/alarms keep running when the app is closed. */
'use strict';

(() => {
  const DAYL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  let alarms = Store.get('alarms', [
    { id: 'a1', h: 7, m: 0, label: 'Wake up', on: true, days: [1, 2, 3, 4, 5] },
    { id: 'a2', h: 8, m: 30, label: 'Weekend', on: false, days: [0, 6] },
  ]);
  const saveAlarms = () => Store.set('alarms', alarms);
  const cities = Store.get('cities', [['New York', 'America/New_York'], ['London', 'Europe/London'], ['Tokyo', 'Asia/Tokyo']]);
  const CITY_PRESETS = [['New York', 'America/New_York'], ['Los Angeles', 'America/Los_Angeles'], ['London', 'Europe/London'], ['Paris', 'Europe/Paris'], ['Berlin', 'Europe/Berlin'], ['Dubai', 'Asia/Dubai'], ['Mumbai', 'Asia/Kolkata'], ['Tokyo', 'Asia/Tokyo'], ['Sydney', 'Australia/Sydney'], ['São Paulo', 'America/Sao_Paulo'], ['Singapore', 'Asia/Singapore'], ['Honolulu', 'Pacific/Honolulu']];

  /* ---- timer + stopwatch state (module level so they outlive the window) ---- */
  const T = { total: 0, left: 0, running: false, end: 0, digits: '' };
  const SW = { running: false, start: 0, acc: 0, laps: [] };
  let ringing = false;

  const hhmm = (h24, m) => { const ap = h24 >= 12 ? 'PM' : 'AM'; return { t: `${h24 % 12 || 12}:${pad(m)}`, ap }; };
  const nextAlarm = () => {
    const now = new Date(); let best = null;
    alarms.filter(a => a.on).forEach(a => {
      for (let d = 0; d < 8; d++) {
        const t = new Date(now); t.setDate(now.getDate() + d); t.setHours(a.h, a.m, 0, 0);
        if (t > now && (!a.days.length || a.days.includes(t.getDay()))) { if (!best || t < best) best = t; break; }
      }
    });
    return best;
  };
  const untilText = t => { const m = Math.round((t - new Date()) / 60000), d = Math.floor(m / 1440), hr = Math.floor(m % 1440 / 60), mn = m % 60; return 'Rings in ' + [d && d + ' d', hr && hr + ' hr', mn && mn + ' min'].filter(Boolean).join(' ') || 'Rings in less than a minute'; };

  OS.on('tick', now => {
    // alarms fire at the top of the minute
    if (now.getSeconds() === 0 && !ringing) {
      const a = alarms.find(a => a.on && a.h === now.getHours() && a.m === now.getMinutes() && (!a.days.length || a.days.includes(now.getDay())));
      if (a) fireAlarm(a);
    }
    if (T.running && Date.now() >= T.end) {
      T.running = false; T.left = 0; ringing = true;
      OS.notify({ app: 'clock', title: 'Timer', text: "Time's up!", icon: 'timer', key: 'timer', silent: true });
      OS.ring({ label: 'Timer', icon: 'timer', snooze: false, dismissLabel: 'Stop', onDismiss: () => { ringing = false; OS.dismissKey('timer'); resetTimer(); } });
      OS.emit('clock:timer');
    }
  });
  function fireAlarm(a) {
    ringing = true;
    if (!a.days.length) { a.on = false; saveAlarms(); }
    OS.ring({
      label: a.label || 'Alarm', icon: 'alarm',
      onDismiss: () => { ringing = false; OS.emit('clock:alarms'); },
      onSnooze: () => { ringing = false; const t = new Date(Date.now() + 10 * 60000); alarms.push({ id: uid(), h: t.getHours(), m: t.getMinutes(), label: (a.label || 'Alarm') + ' (snoozed)', on: true, days: [], tmp: true }); saveAlarms(); OS.toast('Snoozed for 10 minutes'); OS.emit('clock:alarms'); },
    });
  }
  function resetTimer() { T.running = false; T.total = 0; T.left = 0; T.digits = ''; OS.emit('clock:timer'); }

  OS.register({
    id: 'clock', name: 'Clock', icon: { bg: 'linear-gradient(135deg,#5c8dff,#2b57d6)', glyph: 'schedule' },
    create(win, ctx) {
      let tab = (ctx.params && ctx.params.tab) || 'alarm';
      const body = h('div.clk-body'), nav = h('div.bottom-nav');
      win.append(h('div.app', body, nav));
      const tabs = [['alarm', 'alarm', 'Alarm'], ['clock', 'schedule', 'Clock'], ['timer', 'timer', 'Timer'], ['stopwatch', 'avg_pace', 'Stopwatch']];
      const renderNav = () => { nav.innerHTML = ''; tabs.forEach(([id, ic, lb]) => nav.append(h('div.bn' + (tab === id ? '.on' : ''), { onclick: () => { tab = id; render(); } }, mi(ic, tab === id ? 'fill' : ''), lb))); };
      let raf = 0, ticker = 0;

      const render = () => {
        cancelAnimationFrame(raf); clearInterval(ticker); renderNav(); body.innerHTML = '';
        ({ alarm: viewAlarm, clock: viewClock, timer: viewTimer, stopwatch: viewSW })[tab]();
      };

      /* alarms */
      function viewAlarm() {
        const na = nextAlarm();
        body.append(h('div.clk-head', h('h2', 'Alarm'), h('div.clk-sub', na ? untilText(na) : 'No alarms set')),
          h('div.scroll.clk-list', alarms.map(a => {
            const { t, ap } = hhmm(a.h, a.m);
            const row = h('div.alarm' + (a.on ? '' : '.off'),
              h('div.al-main', { onclick: () => editAlarm(a) }, h('div.al-t', t, h('small', ' ' + ap)), h('div.al-l', a.label || 'Alarm'),
                h('div.al-d', DAYL.map((d, i) => h('span' + (a.days.includes(i) ? '.on' : ''), d)))),
              toggleSwitch(a.on, v => { a.on = v; saveAlarms(); row.classList.toggle('off', !v); body.querySelector('.clk-sub').textContent = nextAlarm() ? untilText(nextAlarm()) : 'No alarms set'; }));
            return row;
          })),
          h('button.fab', { onclick: () => editAlarm() }, mi('add'), 'Add alarm'));
      }
      function editAlarm(a) {
        const isNew = !a; a = a || { id: uid(), h: new Date().getHours(), m: 0, label: '', on: true, days: [] };
        const time = h('input.d-input', { type: 'time', value: `${pad(a.h)}:${pad(a.m)}` });
        const label = h('input.d-input', { placeholder: 'Label', value: a.label, style: 'margin-top:12px' });
        const days = h('div.al-days', DAYL.map((d, i) => h('span.dp' + (a.days.includes(i) ? '.on' : ''), { onclick: e => { e.currentTarget.classList.toggle('on'); } }, d)));
        OS.dialog({
          title: isNew ? 'New alarm' : 'Edit alarm', body: h('div', time, label, days),
          actions: [
            ...(isNew ? [] : [{ label: 'Delete', cb: () => { alarms = alarms.filter(x => x !== a); saveAlarms(); render(); } }]),
            { label: 'Cancel' },
            { label: 'Save', primary: true, cb: () => {
              const [hh, mm] = (time.value || '07:00').split(':').map(Number);
              Object.assign(a, { h: hh, m: mm, label: label.value, on: true, days: [...days.children].map((el, i) => el.classList.contains('on') ? i : -1).filter(i => i >= 0) });
              if (isNew) alarms.push(a); alarms.sort((x, y) => x.h * 60 + x.m - (y.h * 60 + y.m)); saveAlarms(); render();
              OS.toast(untilText(nextAlarm())); } },
          ],
        });
      }

      /* world clock */
      function viewClock() {
        const big = h('div.wc-big'), date = h('div.wc-bdate');
        const upd = () => { const d = new Date(); big.textContent = fmtTime(d, { noAp: true }); date.textContent = fmtDate(d, true); list.querySelectorAll('[data-tz]').forEach(el => { el.querySelector('.cl-t').textContent = new Date().toLocaleTimeString('en-US', { timeZone: el.dataset.tz, hour: 'numeric', minute: '2-digit' }); }); };
        const list = h('div.scroll.clk-list', cities.map(([n, tz]) => {
          const off = (new Date(new Date().toLocaleString('en-US', { timeZone: tz })) - new Date(new Date().toLocaleString('en-US'))) / 3600000;
          return h('div.city', { dataset: { tz }, onclick: () => OS.menu({ x: 150, y: 400, h: 0 }, [{ icon: 'delete', label: 'Remove ' + n, cb: () => { const i = cities.findIndex(c => c[1] === tz); cities.splice(i, 1); Store.set('cities', cities); render(); } }]) },
            h('div', h('div.cl-n', n), h('div.cl-o', off === 0 ? 'Same time' : `${Math.abs(off)} hr ${off > 0 ? 'ahead' : 'behind'}`)), h('div.cl-t'));
        }));
        body.append(h('div.wc-hero', big, date), list,
          h('button.fab', { onclick: () => OS.dialog({ title: 'Add city', body: h('div.city-pick', CITY_PRESETS.filter(c => !cities.some(x => x[1] === c[1])).map(c => h('div.menu-item', { onclick: () => { cities.push(c); Store.set('cities', cities); document.querySelector('.pscrim.dim') && OS.closePopups(); render(); } }, c[0]))), actions: [{ label: 'Cancel' }] }) }, mi('add'), 'Add city'));
        upd(); ticker = setInterval(upd, 1000);
      }

      /* timer */
      function viewTimer() {
        const fmtT = s => { const hh = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60; return hh ? `${hh}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`; };
        if (T.total && (T.running || T.left > 0)) {
          const ring = h('div.t-ring'), txt = h('div.t-txt');
          const circ = 2 * Math.PI * 120;
          ring.innerHTML = `<svg viewBox="0 0 260 260"><circle cx="130" cy="130" r="120" class="bg"/><circle cx="130" cy="130" r="120" class="fg" stroke-dasharray="${circ}"/></svg>`;
          const fg = ring.querySelector('.fg');
          const paintT = () => {
            const left = T.running ? Math.max(0, (T.end - Date.now()) / 1000) : T.left;
            txt.textContent = fmtT(Math.ceil(left)); fg.style.strokeDashoffset = circ * (1 - left / T.total);
            if (left <= 0 && !T.running) { render(); return; }
            raf = requestAnimationFrame(paintT);
          };
          body.append(h('div.clk-head', h('h2', 'Timer')), h('div.t-wrap', ring, txt),
            h('div.t-ctl', h('button.btn.tonal', { onclick: () => { T.left = Math.ceil((T.end - Date.now()) / 1000) + 60; if (T.running) T.end += 60000; T.total += 60; } }, '+ 1:00'),
              h('button.fab.inline', { onclick: () => { if (T.running) { T.left = Math.max(0, (T.end - Date.now()) / 1000); T.running = false; } else { T.end = Date.now() + T.left * 1000; T.running = true; } render(); } }, mi(T.running ? 'pause' : 'play_arrow', 'fill')),
              h('button.btn.tonal', { onclick: () => { resetTimer(); render(); } }, 'Delete')));
          paintT();
        } else {
          const d = T.digits.padStart(6, '0');
          const disp = h('div.t-disp', [[d.slice(0, 2), 'h'], [d.slice(2, 4), 'm'], [d.slice(4), 's']].map(([v, u]) => h('span' + (T.digits ? '.has' : ''), v, h('small', u))));
          const key = k => {
            if (k === '⌫') T.digits = T.digits.slice(0, -1); else if ((T.digits + k).length <= 6) T.digits += k;
            T.digits = T.digits.replace(/^0+/, ''); render();
          };
          body.append(h('div.clk-head', h('h2', 'Timer')), disp,
            h('div.t-pad', ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'].map(k => h('button', { onclick: () => key(k) }, k === '⌫' ? mi('backspace') : k))),
            T.digits ? h('button.fab', { onclick: () => {
              const dd = T.digits.padStart(6, '0'); const s = +dd.slice(0, 2) * 3600 + +dd.slice(2, 4) * 60 + +dd.slice(4);
              if (!s) return; T.total = s; T.left = s; T.end = Date.now() + s * 1000; T.running = true; T.digits = ''; render(); } }, mi('play_arrow', 'fill'), 'Start') : null);
        }
      }

      /* stopwatch */
      function viewSW() {
        const ms = () => SW.acc + (SW.running ? performance.now() - SW.start : 0);
        const f = v => `${pad(Math.floor(v / 60000))}:${pad(Math.floor(v % 60000 / 1000))}.${pad(Math.floor(v % 1000 / 10))}`;
        const disp = h('div.sw-disp'), laps = h('div.scroll.sw-laps');
        const renderLaps = () => { laps.innerHTML = ''; SW.laps.slice().reverse().forEach((l, i) => laps.append(h('div.lap', h('span', 'Lap ' + (SW.laps.length - i)), h('span', f(l.lap)), h('span', f(l.total))))); };
        const ctl = h('div.sw-ctl');
        const buildCtl = () => {
          ctl.innerHTML = '';
          ctl.append(
            h('button.btn.tonal', { onclick: () => { if (SW.running) { SW.laps.push({ lap: ms() - (SW.laps.length ? SW.laps[SW.laps.length - 1].total : 0), total: ms() }); renderLaps(); } else { SW.acc = 0; SW.laps = []; renderLaps(); } buildCtl(); } }, SW.running ? 'Lap' : 'Reset'),
            h('button.fab.inline', { onclick: () => { if (SW.running) { SW.acc = ms(); SW.running = false; } else { SW.start = performance.now(); SW.running = true; } buildCtl(); } }, mi(SW.running ? 'pause' : 'play_arrow', 'fill')));
        };
        const paint = () => { disp.textContent = f(ms()); raf = requestAnimationFrame(paint); };
        body.append(h('div.clk-head', h('h2', 'Stopwatch')), disp, ctl, laps);
        buildCtl(); renderLaps(); paint();
      }

      render();
      const offs = [OS.on('clock:alarms', () => tab === 'alarm' && render()), OS.on('clock:timer', () => tab === 'timer' && render())];
      return { onShow() { render(); }, onHide() { cancelAnimationFrame(raf); clearInterval(ticker); }, destroy() { cancelAnimationFrame(raf); clearInterval(ticker); }, onParams(p) { if (p && p.tab) { tab = p.tab; render(); } } };
    },
  });
})();
