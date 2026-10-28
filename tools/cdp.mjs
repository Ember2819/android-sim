// Minimal Chrome DevTools Protocol driver for headless smoke tests (no dependencies; needs Node 22+).
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function launch(url, { width = 640, height = 1000, port = 9333 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cdp-'));
  const proc = spawn('chromium', ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`,
    `--window-size=${width},${height}`, '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
  let targets;
  for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch { } await new Promise(r => setTimeout(r, 200)); }
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => (ws.onopen = r));
  let id = 0; const pending = new Map(); const logs = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    else if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) logs.push(m.params.type.toUpperCase() + ' ' + m.params.args.map(a => a.value ?? a.description).join(' '));
  };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  const api = {
    logs,
    sleep: ms => new Promise(r => setTimeout(r, ms)),
    async eval(expr) { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) return 'ERR ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result.result.value; },
    async shot(path, clip) { const r = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) }); writeFileSync(path, Buffer.from(r.result.data, 'base64')); },
    async mouse(type, x, y) { await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 }); },
    async click(x, y) { await api.mouse('mouseMoved', x, y); await api.mouse('mousePressed', x, y); await api.mouse('mouseReleased', x, y); },
    async drag(x1, y1, x2, y2, steps = 12) { await api.mouse('mouseMoved', x1, y1); await api.mouse('mousePressed', x1, y1); for (let i = 1; i <= steps; i++) { await api.mouse('mouseMoved', x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps); await api.sleep(12); } await api.mouse('mouseReleased', x2, y2); },
    async key(k) { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k }); },
    close() { try { ws.close(); } catch { } proc.kill(); },
  };
  return api;
}
