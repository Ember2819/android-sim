/* Camera — uses the real webcam via getUserMedia, with a synthetic viewfinder as fallback. */
'use strict';

OS.register({
  id: 'camera', name: 'Camera', sb: 'light', icon: { bg: 'linear-gradient(135deg,#f1f3f4,#c9cdd2)', glyph: 'photo_camera', fg: '#202124' },
  create(win) {
    let stream = null, facing = 'environment', zoom = 1, mode = 'Camera', recording = 0, recTimer = 0, flash = false, fallbackRaf = 0, usingFallback = false, starting = false;
    const video = h('video', { autoplay: true, playsInline: true, muted: true });
    const fb = h('canvas.cam-fb', { width: 540, height: 960 });
    const thumb = h('div.cam-thumb'), flashOv = h('div.cam-flash'), hint = h('div.cam-hint');
    const zoomChips = [1, 2, 5].map(z => h('button.zc' + (z === 1 ? '.on' : ''), { onclick: () => setZoom(z) }, z + (z === 1 ? '×' : '×')));
    const timerEl = h('div.cam-rec');
    const modes = ['Portrait', 'Camera', 'Video', 'Night Sight'];
    const modeEls = modes.map(m => h('div.cm' + (m === mode ? '.on' : ''), { onclick: () => setMode(m) }, m));
    const shutter = h('button.shutter', { onclick: shoot }, h('i'));

    const root = h('div.app.cam',
      h('div.cam-view', video, fb, flashOv, hint, timerEl),
      h('div.cam-top', h('button.icon-btn', { onclick: () => { flash = !flash; fl.firstChild.textContent = flash ? 'flash_on' : 'flash_off'; OS.toast(flash ? 'Flash on' : 'Flash off'); } }, (() => { return mi('flash_off'); })()),
        h('div', { style: 'flex:1' }), h('button.icon-btn', { onclick: () => OS.toast('Timer off') }, mi('timer')), h('button.icon-btn', { onclick: () => OS.toast('Camera settings aren’t available') }, mi('settings'))),
      h('div.cam-bot', h('div.cam-zoom', zoomChips), h('div.cam-modes.scroll-x', modeEls),
        h('div.cam-ctl', h('div.cam-tw', { onclick: () => OS.openApp('photos') }, thumb), shutter, h('button.flip', { onclick: flip }, mi('flip_camera_android')))));
    win.append(root);
    const fl = root.querySelector('.cam-top .icon-btn');

    function setZoom(z) { zoom = z; zoomChips.forEach((c, i) => c.classList.toggle('on', [1, 2, 5][i] === z)); const t = `scale(${z})`; video.style.transform = (facing === 'user' ? 'scaleX(-1) ' : '') + t; fb.style.transform = t; }
    function setMode(m) { mode = m; modeEls.forEach(e => e.classList.toggle('on', e.textContent === m)); root.classList.toggle('video', m === 'Video'); root.classList.toggle('night', m === 'Night Sight'); }
    function updThumb() { const a = OS.photos.all()[0]; thumb.style.backgroundImage = a ? `url(${a.src})` : ''; }

    async function start() {
      if (stream || starting) return; starting = true;
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('no mediadevices');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        video.srcObject = stream; usingFallback = false; root.classList.remove('nofeed'); video.style.transform = (facing === 'user' ? 'scaleX(-1) ' : '') + `scale(${zoom})`;
        cancelAnimationFrame(fallbackRaf); hint.textContent = '';
      } catch (err) {
        usingFallback = true; root.classList.add('nofeed'); hint.textContent = 'No camera available — showing a simulated scene'; paintFallback();
      }
      starting = false;
    }
    function stop() { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } video.srcObject = null; cancelAnimationFrame(fallbackRaf); }
    function flip() { facing = facing === 'user' ? 'environment' : 'user'; stop(); start(); }

    function paintFallback() {
      const x = fb.getContext('2d'), t = performance.now() / 1000;
      const g = x.createLinearGradient(0, 0, 0, 960); g.addColorStop(0, '#1c2a5a'); g.addColorStop(.5, '#e0708a'); g.addColorStop(.7, '#ffb26b'); g.addColorStop(1, '#3a2442');
      x.fillStyle = g; x.fillRect(0, 0, 540, 960);
      x.fillStyle = '#fff3c4'; x.beginPath(); x.arc(270 + Math.sin(t * .4) * 60, 560, 56, 0, 7); x.fill();
      for (let l = 0; l < 3; l++) { x.fillStyle = ['#5a2f4f', '#3c2043', '#241435'][l]; x.beginPath(); x.moveTo(0, 960); for (let px = 0; px <= 540; px += 8) x.lineTo(px, 640 + l * 80 + Math.sin(px * .012 + l * 2 + t * .2) * (40 - l * 8)); x.lineTo(540, 960); x.fill(); }
      fallbackRaf = requestAnimationFrame(paintFallback);
    }

    function shoot() {
      if (mode === 'Video') {
        if (recording) { clearInterval(recTimer); recording = 0; root.classList.remove('recording'); timerEl.textContent = ''; capture(true); OS.toast('Video saved'); }
        else { recording = 1; root.classList.add('recording'); const t0 = Date.now(); recTimer = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); timerEl.textContent = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; }, 250); timerEl.textContent = '00:00'; }
        return;
      }
      capture(); Sound.shutter(); flashOv.classList.remove('go'); void flashOv.offsetWidth; flashOv.classList.add('go');
    }
    function capture() {
      const c = document.createElement('canvas'); const src = usingFallback ? fb : video;
      const sw = usingFallback ? 540 : video.videoWidth, sh = usingFallback ? 960 : video.videoHeight;
      if (!sw) { OS.toast('Camera not ready'); return; }
      // crop to the phone's portrait aspect, then apply zoom
      const aspect = 412 / 870; let cw = Math.min(sw, sh * aspect), ch = cw / aspect; if (ch > sh) { ch = sh; cw = ch * aspect; }
      cw /= zoom; ch /= zoom; const cx = (sw - cw) / 2, cy = (sh - ch) / 2;
      const scale = Math.min(1, 720 / cw); c.width = Math.round(cw * scale); c.height = Math.round(ch * scale);
      const x = c.getContext('2d'); if (facing === 'user' && !usingFallback) { x.translate(c.width, 0); x.scale(-1, 1); }
      if (mode === 'Night Sight') x.filter = 'brightness(1.3) contrast(1.05)';
      x.drawImage(src, cx, cy, cw, ch, 0, 0, c.width, c.height);
      OS.photos.add(c.toDataURL('image/jpeg', .82)); updThumb();
    }

    updThumb(); setMode('Camera');
    const off = OS.on('photos', updThumb);
    return {
      onShow() { start(); updThumb(); },
      onHide() { if (recording) { clearInterval(recTimer); recording = 0; root.classList.remove('recording'); } stop(); },
      destroy() { stop(); clearInterval(recTimer); },
    };
  },
});
