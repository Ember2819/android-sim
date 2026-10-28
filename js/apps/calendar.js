/* Calendar: month grid + agenda, events stored locally. */
'use strict';

(() => {
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const COLORS = ['#1a73e8', '#d93025', '#188038', '#e8710a', '#9334e6', '#00897b'];
  const today = new Date();
  const rel = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
  let events = Store.get('events', null) || [
    { id: 'e1', title: 'Team sync', date: rel(0), time: '15:00', color: COLORS[0] },
    { id: 'e2', title: 'Gym', date: rel(0), time: '18:30', color: COLORS[2] },
    { id: 'e3', title: 'Dentist', date: rel(1), time: '09:30', color: COLORS[1] },
    { id: 'e4', title: 'Lunch with Priya', date: rel(3), time: '12:15', color: COLORS[3] },
    { id: 'e5', title: 'Sunday dinner at Mom’s', date: rel((7 - today.getDay()) % 7 || 7), time: '18:00', color: COLORS[4] },
    { id: 'e6', title: 'Project deadline', date: rel(9), time: '', color: COLORS[1] },
  ];
  const save = () => Store.set('events', events);
  const t12 = t => { if (!t) return 'All day'; const [hh, mm] = t.split(':').map(Number); return `${hh % 12 || 12}:${pad(mm)} ${hh >= 12 ? 'PM' : 'AM'}`; };

  OS.register({
    id: 'calendar', name: 'Calendar', icon: { bg: '#fff', special: `<div class="cal-ico"><i></i><b>${today.getDate()}</b></div>`, glyph: 'calendar_month', fg: '#1a73e8' },
    create(win) {
      let view = new Date(today.getFullYear(), today.getMonth(), 1), sel = iso(today);
      const root = h('div.app.cal'); win.append(root);
      const render = () => {
        root.innerHTML = '';
        const first = new Date(view), start = new Date(first); start.setDate(1 - first.getDay());
        const cells = [];
        for (let i = 0; i < 42; i++) {
          const d = new Date(start); d.setDate(start.getDate() + i); const k = iso(d);
          const evs = events.filter(e => e.date === k);
          cells.push(h('div.cd' + (d.getMonth() !== view.getMonth() ? '.out' : '') + (k === iso(today) ? '.today' : '') + (k === sel ? '.sel' : ''),
            { onclick: () => { sel = k; render(); } }, h('span', d.getDate()), h('div.dots', evs.slice(0, 3).map(e => h('i', { style: { background: e.color } })))));
        }
        const day = new Date(sel + 'T12:00'), list = events.filter(e => e.date === sel).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        root.append(
          h('div.cal-head',
            h('div.cal-month', MONTHS[view.getMonth()], h('small', ' ' + view.getFullYear())),
            h('button.icon-btn', { onclick: () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); render(); } }, mi('chevron_left')),
            h('button.icon-btn', { onclick: () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); render(); } }, mi('chevron_right')),
            h('button.icon-btn', { onclick: () => { view = new Date(today.getFullYear(), today.getMonth(), 1); sel = iso(today); render(); } }, mi('today'))),
          h('div.cal-dow', DAYS.map(d => h('span', d[0]))),
          h('div.cal-grid', cells),
          h('div.cal-agenda.scroll.pad-nav',
            h('div.ag-h', fmtDate(day, true)),
            list.length ? list.map(e => h('div.ag-ev', { style: { background: `color-mix(in oklab, ${e.color} 28%, var(--surface))`, borderLeft: `4px solid ${e.color}` }, onclick: () => editEvent(e) },
              h('div.ag-t', e.title), h('div.ag-m', t12(e.time)))) : h('div.ag-none', 'No events')),
          h('button.fab', { onclick: () => editEvent() }, mi('add')));
      };
      function editEvent(ev) {
        const isNew = !ev; ev = ev || { id: uid(), title: '', date: sel, time: '09:00', color: COLORS[0] };
        const title = h('input.d-input', { placeholder: 'Add title', value: ev.title }), date = h('input.d-input', { type: 'date', value: ev.date, style: 'margin-top:10px' }), time = h('input.d-input', { type: 'time', value: ev.time, style: 'margin-top:10px' });
        const sw = h('div.col-row', COLORS.map(c => h('i' + (c === ev.color ? '.on' : ''), { style: { background: c }, onclick: e => { ev.color = c; [...sw.children].forEach(x => x.classList.remove('on')); e.currentTarget.classList.add('on'); } })));
        OS.dialog({
          title: isNew ? 'New event' : 'Event', body: h('div', title, date, time, sw),
          actions: [...(isNew ? [] : [{ label: 'Delete', cb: () => { events = events.filter(x => x !== ev); save(); render(); } }]), { label: 'Cancel' },
            { label: 'Save', primary: true, cb: () => {
              if (!title.value.trim()) { OS.toast('Add a title'); return false; }
              Object.assign(ev, { title: title.value.trim(), date: date.value || sel, time: time.value }); if (isNew) events.push(ev); save(); sel = ev.date; const d = new Date(sel + 'T12:00'); view = new Date(d.getFullYear(), d.getMonth(), 1); render(); } }],
        });
      }
      render();
      return { onShow: render };
    },
  });
  OS.calendarEvents = () => events;
})();
