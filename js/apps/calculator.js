/* Calculator */
'use strict';

(() => {
  function evaluate(src) {
    const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '');
    let i = 0; const peek = () => s[i];
    function expr() { let v = term(); while (peek() === '+' || peek() === '-') { const o = s[i++]; const r = term(); v = o === '+' ? v + r : v - r; } return v; }
    function term() { let v = factor(); while (peek() === '*' || peek() === '/' || peek() === '(') { if (peek() === '(') { v *= factor(); continue; } const o = s[i++]; const r = factor(); v = o === '*' ? v * r : v / r; } return v; }
    function factor() { if (peek() === '-') { i++; return -factor(); } if (peek() === '+') { i++; return factor(); } let v = atom(); while (peek() === '%') { i++; v /= 100; } return v; }
    function atom() {
      if (peek() === '(') { i++; const v = expr(); if (peek() === ')') i++; return v; }
      const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i)); if (!m) throw new Error('syntax');
      i += m[0].length; return parseFloat(m[0]);
    }
    const v = expr(); if (i < s.length) throw new Error('syntax'); return v;
  }
  const fmt = v => {
    if (!isFinite(v)) return "Can't divide by 0";
    let t = +v.toPrecision(10); let str = String(t);
    if (Math.abs(t) >= 1e15 || (Math.abs(t) < 1e-9 && t !== 0)) return t.toExponential(6).replace(/\.?0+e/, 'e');
    const [a, b] = str.split('.'); return a.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (b ? '.' + b : '');
  };

  OS.register({
    id: 'calculator', name: 'Calculator', icon: { bg: 'linear-gradient(135deg,#26a69a,#00796b)', glyph: 'calculate' },
    create(win) {
      let expr = '', result = '', justEq = false;
      const exprEl = h('div.calc-expr'), resEl = h('div.calc-res');
      const render = () => {
        exprEl.textContent = expr || '';
        let live = ''; if (expr) { try { const v = evaluate(expr); if (/[+\-×÷%(]/.test(expr.slice(1)) || /\(/.test(expr)) live = fmt(v); } catch { } }
        resEl.textContent = justEq ? result : live; resEl.classList.toggle('final', justEq);
        exprEl.classList.toggle('dim', justEq);
        if (!expr && !justEq) resEl.textContent = '';
      };
      const press = k => {
        Sound.click();
        const ops = '+−×÷';
        if (k === 'C') { expr = ''; result = ''; justEq = false; }
        else if (k === '⌫') { expr = expr.slice(0, -1); justEq = false; }
        else if (k === '=') {
          if (!expr) return;
          try { const v = evaluate(expr); result = fmt(v); justEq = true; if (!isFinite(v)) { justEq = true; } else { expr = expr; } } catch { result = 'Format error'; justEq = true; }
        } else {
          if (justEq) { if (ops.includes(k) && isFinite(parseFloat(result.replace(/,/g, '')))) expr = result.replace(/,/g, ''); else if (!ops.includes(k) && k !== '%') expr = ''; justEq = false; }
          if (k === '( )') { const o = (expr.match(/\(/g) || []).length, c = (expr.match(/\)/g) || []).length; const last = expr.slice(-1); k = (o > c && /[\d)%]/.test(last)) ? ')' : '('; }
          if (ops.includes(k)) { if (!expr && k !== '−') return; if (ops.includes(expr.slice(-1))) expr = expr.slice(0, -1); }
          if (k === '.' ) { const cur = expr.split(/[+−×÷()%]/).pop(); if (cur.includes('.')) return; }
          expr += k;
        }
        render();
      };
      const keys = [['C', '( )', '%', '÷'], ['7', '8', '9', '×'], ['4', '5', '6', '−'], ['1', '2', '3', '+'], ['0', '.', '⌫', '=']];
      const kp = h('div.calc-pad', keys.flat().map(k => {
        const cls = k === '=' ? 'eq' : '+−×÷'.includes(k) ? 'op' : ['C', '( )', '%', '⌫'].includes(k) ? 'fn' : 'num';
        return h('button.ck.' + cls, { onclick: () => press(k) }, k === '⌫' ? mi('backspace') : k);
      }));
      win.append(h('div.app.calc', h('div.calc-top', h('button.icon-btn', { onclick: () => OS.toast('History is empty') }, mi('history')), h('button.icon-btn', { onclick: () => OS.toast('Scientific mode isn’t available') }, mi('more_vert'))),
        h('div.calc-disp', exprEl, resEl), kp));
      const key = e => {
        if (OS.current !== 'calculator' || e.target.matches('input,textarea')) return;
        const m = { '*': '×', '/': '÷', '-': '−', Enter: '=', '=': '=', Backspace: '⌫', '(': '( )', ')': '( )' };
        const k = m[e.key] || (/^[0-9+.%]$/.test(e.key) ? e.key : null);
        if (k) { e.preventDefault(); press(k); }
      };
      addEventListener('keydown', key);
      render();
      return { destroy() { removeEventListener('keydown', key); } };
    },
  });
})();
