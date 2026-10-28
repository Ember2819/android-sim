/* Weather — live data from Open-Meteo (falls back to generated data offline). */
'use strict';

OS.register({
  id: 'weather', name: 'Weather', sb: 'light', icon: { bg: 'linear-gradient(160deg,#4aa3ff,#1c5fd1)', glyph: 'partly_cloudy_day' },
  create(win) {
    const root = h('div.app.wx'); win.append(root);
    const render = () => {
      const w = OS.weather, t = OS.temp, u = OS.cfg.units, night = !!(w.icon && /night/.test(w.icon));
      root.className = 'app wx ' + (night ? 'night' : /rain|thunder|snow|cloud|fog/.test(w.icon) ? 'gray' : 'day');
      root.innerHTML = '';
      root.append(
        h('div.wx-bar', h('button.icon-btn', { onclick: () => OS.goHome() }, mi('arrow_back')), h('div.wx-place', mi('location_on', 'fill'), w.place),
          h('button.icon-btn', { onclick: () => OS.menu({ x: 200, y: 50, h: 0 }, [
            { icon: 'my_location', label: 'Use my location', cb: locate },
            { icon: 'thermostat', label: 'Switch to °' + (u === 'F' ? 'C' : 'F'), cb: () => { OS.set('units', u === 'F' ? 'C' : 'F'); render(); } },
            { icon: 'refresh', label: 'Refresh', cb: () => { OS.loadWeather(); OS.toast('Refreshing…'); } }]) }, mi('more_vert'))),
        h('div.scroll.pad-nav', { style: 'flex:1' },
          h('div.wx-hero', h('span.mi.fill.wx-big-ic', w.icon), h('div.wx-temp', t(w.temp), h('small', '°' + u)), h('div.wx-cond', w.cond), h('div.wx-hl', `H: ${t(w.hi)}°  L: ${t(w.lo)}°`),
            !w.live ? h('div.wx-off', 'Offline — showing sample data') : null),
          h('div.wx-card', h('div.wx-ct', mi('schedule'), 'Hourly forecast'),
            h('div.scroll-x.wx-hours', w.hourly.slice(0, 24).map((x, i) => h('div.wx-h', h('div', i === 0 ? 'Now' : fmtTime(x.d).replace(':00', '').replace(' ', '')), h('span.mi.fill', x.icon), h('div', t(x.temp) + '°'))))),
          h('div.wx-card', h('div.wx-ct', mi('calendar_month'), '7-day forecast'),
            w.daily.map((d, i) => h('div.wx-d', h('span.wx-dn', i === 0 ? 'Today' : DAYS[d.d.getDay()].slice(0, 3)), h('span.mi.fill', d.icon), h('span.wx-dr', h('b', t(d.hi) + '°'), h('span', ' ' + t(d.lo) + '°'))))),
          h('div.wx-src', w.live ? 'Data: Open-Meteo.com' : '')));
    };
    function locate() {
      if (!navigator.geolocation) return OS.toast('Location unavailable');
      navigator.geolocation.getCurrentPosition(async p => {
        OS.weather.lat = p.coords.latitude; OS.weather.lon = p.coords.longitude; OS.weather.place = 'Current location';
        try { const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${p.coords.latitude}&longitude=${p.coords.longitude}&localityLanguage=en`); const j = await r.json(); OS.weather.place = j.city || j.locality || 'Current location'; } catch { }
        await OS.loadWeather();
      }, () => OS.toast('Location permission denied'), { timeout: 8000 });
    }
    render(); const off = OS.on('weather', render);
    return { onShow: render };
  },
});
