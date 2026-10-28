/* Boot sequence: wire everything up, seed notifications, handle deep links. */
'use strict';

(() => {
  OS.initShell();
  OS.wireNav();
  OS.fit();
  OS.applyTheme();
  addEventListener('resize', OS.fit);
  OS.updateSB();
  OS.on('theme', OS.updateSB);
  OS.on('cfg:dark', OS.updateSB);

  // keep the launcher in sync with the hardware-style toggles
  OS.on('cfg', k => { if (k === 'dark' || k === 'themed' || k === 'wp' || k === 'hue') OS.applyTheme(); });

  OS.loadWeather();
  setInterval(OS.loadWeather, 30 * 60e3);

  // Seed a few notifications like a freshly used phone
  const seed = () => {
    const t = Date.now();
    OS.notifs = [
      { app: 'messages', title: 'Mom', text: "Don't forget dinner on Sunday 🍝 Bring dessert!", time: t - 2 * 60e3, silent: true, key: 'seed1' },
      { app: 'calendar', title: 'Team sync', text: 'Starts in 15 minutes · Google Meet', time: t - 9 * 60e3, silent: true, key: 'seed2' },
      { app: 'photos', title: 'Rediscover this day', text: 'You have new memories from last year', time: t - 55 * 60e3, silent: true, key: 'seed3' },
      { app: 'settings', appName: 'Pixel Tips', icon: 'lightbulb', title: 'Try swiping up from the bottom', text: 'Swipe up to go home, hold to see recent apps, and swipe from the edge to go back.', time: t - 3 * 3600e3, silent: true, key: 'seed4',
        onTap: () => OS.toast('Try it on the pill at the bottom!') },
    ];
    OS.emit('notifs');
  };
  seed();

  // deep links for quick testing: ?app=settings&page=about&unlocked
  const q = new URLSearchParams(location.search);
  const finish = () => {
    OS.el.boot.classList.add('done');
    if (q.has('unlocked') || q.has('app')) {
      OS.unlock();
      if (q.get('app')) setTimeout(() => OS.openApp(q.get('app'), { params: { page: q.get('page') } }), 450);
    }
  };
  setTimeout(finish, q.has('fast') || q.has('app') ? 50 : 1300);
})();
