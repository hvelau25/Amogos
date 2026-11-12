// Minijuegos de tareas y de arreglo de sabotajes. Todo pensado para dedo en celular.
window.Tasks = (function () {
  const COLORS = ['#e23b3b', '#2f6fe0', '#f4d23a', '#ef6fbf'];
  let root = null; // contenedor del minijuego activo
  let cleanup = []; // funciones a ejecutar al cerrar (timers, listeners)
  let active = null;

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const shuffle = (a) => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const later = (fn, ms) => { const id = setTimeout(fn, ms); cleanup.push(() => clearTimeout(id)); };
  const every = (fn, ms) => { const id = setInterval(fn, ms); cleanup.push(() => clearInterval(id)); };
  const frame = (fn) => {
    let alive = true, id = 0;
    const tick = (t) => { if (!alive) return; fn(t); id = requestAnimationFrame(tick); };
    id = requestAnimationFrame(tick);
    cleanup.push(() => { alive = false; cancelAnimationFrame(id); });
  };
  const hint = (text) => { const h = root.querySelector('.tarea-pista'); if (h) h.textContent = text; };
  const shake = (node) => { node.classList.remove('sacudir'); void node.offsetWidth; node.classList.add('sacudir'); if (window.Sound) Sound.play('error'); };

  // ---------- Cables: une cada color de la izquierda con el mismo de la derecha ----------
  function cables(done) {
    const board = el('div', 'cables');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('cables-lineas');
    const left = el('div', 'cables-col'), right = el('div', 'cables-col');
    board.append(left, svg, right);
    root.appendChild(board);
    let sel = null, joined = 0;
    const L = shuffle([0, 1, 2, 3]), R = shuffle([0, 1, 2, 3]);
    const mk = (c, side) => {
      const b = el('button', 'cable');
      b.style.background = COLORS[c];
      b.dataset.c = c;
      b.dataset.side = side;
      return b;
    };
    const line = (a, b, c) => {
      const br = board.getBoundingClientRect(), ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      ln.setAttribute('x1', ra.right - br.left); ln.setAttribute('y1', ra.top + ra.height / 2 - br.top);
      ln.setAttribute('x2', rb.left - br.left); ln.setAttribute('y2', rb.top + rb.height / 2 - br.top);
      ln.setAttribute('stroke', COLORS[c]);
      ln.setAttribute('stroke-width', '10');
      ln.setAttribute('stroke-linecap', 'round');
      svg.appendChild(ln);
    };
    L.forEach((c) => {
      const b = mk(c, 'L');
      b.onclick = () => {
        if (b.disabled) return;
        left.querySelectorAll('.cable').forEach((x) => x.classList.remove('elegido'));
        b.classList.add('elegido');
        sel = b;
      };
      left.appendChild(b);
    });
    R.forEach((c) => {
      const b = mk(c, 'R');
      b.onclick = () => {
        if (!sel || b.disabled) return;
        if (sel.dataset.c !== b.dataset.c) { shake(b); return; }
        line(sel, b, c);
        sel.disabled = b.disabled = true;
        sel.classList.remove('elegido');
        sel = null;
        if (++joined === 4) done();
      };
      right.appendChild(b);
    });
    hint('Toca un cable de la izquierda y luego el del mismo color a la derecha.');
  }

  // ---------- Descarga: mantener presionado hasta llenar la barra ----------
  function descarga(done, opts) {
    const bar = el('div', 'barra'), fill = el('div', 'barra-relleno');
    bar.appendChild(fill);
    const pct = el('div', 'grande', '0%');
    const btn = el('button', 'btn btn-grande btn-mantener', opts.label || 'Mantén presionado');
    root.append(pct, bar, btn);
    let holding = false, p = 0, last = performance.now(), finished = false;
    const set = (v) => { holding = v; btn.classList.toggle('presionado', v); };
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); btn.setPointerCapture && btn.setPointerCapture(e.pointerId); set(true); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => btn.addEventListener(ev, () => set(false)));
    frame((t) => {
      const dt = Math.min((t - last) / 1000, 0.1);
      last = t;
      if (holding && !finished) p = Math.min(1, p + dt / (opts.seconds || 3));
      fill.style.width = p * 100 + '%';
      pct.textContent = Math.floor(p * 100) + '%';
      if (p >= 1 && !finished) { finished = true; done(); }
    });
    hint(opts.hint || 'Mantén el botón hasta que la barra se llene. Si lo sueltas, se pausa.');
  }

  // ---------- Código: escribir el número de la nota ----------
  function codigo(done) {
    const code = String(Math.floor(10000 + Math.random() * 90000));
    const nota = el('div', 'nota', code);
    const disp = el('div', 'pantalla-codigo', '');
    const pad = el('div', 'teclado');
    let val = '';
    const upd = () => { disp.textContent = val.padEnd(5, '·'); };
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'].forEach((k) => {
      const b = el('button', 'tecla' + (k === 'OK' ? ' tecla-ok' : ''), k);
      b.onclick = () => {
        if (k === '⌫') val = val.slice(0, -1);
        else if (k === 'OK') {
          if (val === code) { done(); return; }
          shake(disp); val = '';
        } else if (val.length < 5) val += k;
        upd();
      };
      pad.appendChild(b);
    });
    const wrap = el('div', 'codigo');
    const izq = el('div', 'codigo-izq');
    izq.append(el('div', 'tenue', 'Nota pegada en la consola:'), nota, disp);
    wrap.append(izq, pad);
    root.appendChild(wrap);
    upd();
    hint('Escribe el código de la nota y toca OK.');
  }

  // ---------- Tarjeta: deslizar a velocidad justa ----------
  function tarjeta(done) {
    const track = el('div', 'riel'), card = el('div', 'tarjeta-id', '🪪');
    track.appendChild(card);
    const msg = el('div', 'grande', 'Desliza la tarjeta →');
    root.append(msg, track);
    let start = null, x0 = 0, maxX = 0, dragging = false;
    const place = (x) => { card.style.transform = `translateX(${x}px)`; };
    card.addEventListener('pointerdown', (e) => {
      dragging = true;
      start = performance.now();
      x0 = e.clientX;
      maxX = track.clientWidth - card.offsetWidth - 8;
      card.setPointerCapture && card.setPointerCapture(e.pointerId);
    });
    card.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      place(Math.max(0, Math.min(maxX, e.clientX - x0)));
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      const x = Math.max(0, Math.min(maxX, e.clientX - x0));
      const secs = (performance.now() - start) / 1000;
      if (x < maxX - 6) msg.textContent = 'Desliza hasta el final.';
      else if (secs < 0.45) msg.textContent = 'Muy rápido. Otra vez.';
      else if (secs > 1.6) msg.textContent = 'Muy lento. Otra vez.';
      else { msg.textContent = 'Aceptada ✓'; done(); return; }
      shake(track);
      place(0);
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
    hint('Arrastra la tarjeta de izquierda a derecha, ni muy rápido ni muy lento.');
  }

  // ---------- Interruptores: dejarlos todos encendidos ----------
  function interruptores(done, opts) {
    const box = el('div', 'interruptores');
    const n = 5;
    let state = Array.from({ length: n }, () => Math.random() < 0.5);
    if (state.every(Boolean)) state[Math.floor(Math.random() * n)] = false;
    if (state.filter((v) => !v).length < 2) state[(state.indexOf(false) + 2) % n] = false;
    const btns = state.map((on, i) => {
      const b = el('button', 'interruptor');
      const render = () => { b.classList.toggle('encendido', state[i]); b.textContent = state[i] ? 'ON' : 'OFF'; };
      b.onclick = () => {
        state[i] = !state[i];
        render();
        if (state.every(Boolean)) done();
      };
      render();
      box.appendChild(b);
      return b;
    });
    root.appendChild(box);
    hint(opts.hint || 'Enciende todos los interruptores.');
    return btns;
  }

  // ---------- Calibrar: tocar cuando la aguja está en la zona verde (3 veces) ----------
  function calibrar(done) {
    const dials = [];
    const row = el('div', 'medidores');
    for (let i = 0; i < 3; i++) {
      const d = el('div', 'medidor');
      const zone = el('div', 'zona');
      const needle = el('div', 'aguja');
      const zStart = 15 + Math.random() * 55;
      zone.style.left = zStart + '%';
      d.append(zone, needle);
      row.appendChild(d);
      dials.push({ d, needle, zStart, zEnd: zStart + 18, speed: 70 + i * 25 + Math.random() * 20, pos: Math.random() * 100, dir: 1, ok: false });
    }
    const btn = el('button', 'btn btn-grande', 'FIJAR');
    root.append(row, btn);
    let idx = 0, last = performance.now();
    dials[0].d.classList.add('activo');
    frame((t) => {
      const dt = Math.min((t - last) / 1000, 0.1);
      last = t;
      for (const m of dials) {
        if (m.ok) continue;
        m.pos += m.dir * m.speed * dt;
        if (m.pos > 98) { m.pos = 98; m.dir = -1; }
        if (m.pos < 0) { m.pos = 0; m.dir = 1; }
        m.needle.style.left = m.pos + '%';
      }
    });
    btn.onclick = () => {
      const m = dials[idx];
      if (!m) return;
      if (m.pos + 1 >= m.zStart && m.pos + 1 <= m.zEnd) {
        m.ok = true;
        m.d.classList.remove('activo');
        m.d.classList.add('listo');
        idx++;
        if (idx >= dials.length) done();
        else dials[idx].d.classList.add('activo');
      } else shake(m.d);
    };
    hint('Toca FIJAR cuando la aguja esté dentro de la zona verde. Son 3 medidores.');
  }

  // ---------- Reactor: mantener la mano en el panel ----------
  function reactor(_done, opts) {
    const pad = el('button', 'mano', '✋');
    const status = el('div', 'grande', '');
    root.append(pad, status);
    let holding = false;
    const set = (v) => {
      if (holding === v) return;
      holding = v;
      pad.classList.toggle('presionado', v);
      opts.onHold(v);
    };
    pad.addEventListener('pointerdown', (e) => { e.preventDefault(); pad.setPointerCapture && pad.setPointerCapture(e.pointerId); set(true); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => pad.addEventListener(ev, () => set(false)));
    cleanup.push(() => set(false));
    every(() => {
      const h = opts.hands() || {};
      const other = opts.panel === 'A' ? h.B : h.A;
      status.textContent = holding
        ? (other ? '¡Las dos manos! Arreglando…' : 'Esperando a alguien en el otro panel…')
        : 'Mantén la mano en el panel.';
    }, 150);
    hint('Hace falta una persona aquí y otra en el otro panel del reactor, al mismo tiempo.');
  }

  const GAMES = { cables, descarga, codigo, tarjeta, interruptores, calibrar, reactor };

  // Abre un minijuego. opts: { title, onDone, onClose, ... }
  function open(type, opts) {
    close(true);
    opts = opts || {};
    const modal = document.getElementById('tareaModal');
    document.getElementById('tareaTitulo').textContent = opts.title || '';
    root = document.getElementById('tareaContenido');
    root.innerHTML = '';
    root.appendChild(el('p', 'tarea-pista tenue', ''));
    active = { type, opts, finished: false };
    modal.classList.remove('oculto');
    const done = () => {
      if (!active || active.finished) return;
      active.finished = true;
      const ok = el('div', 'tarea-lista', '¡Listo!');
      root.appendChild(ok);
      if (navigator.vibrate) navigator.vibrate(60);
      if (window.Sound) Sound.play('tarea');
      opts.onDone && opts.onDone();
      later(() => close(), 650);
    };
    GAMES[type](done, opts);
  }

  function close(silent) {
    cleanup.forEach((f) => { try { f(); } catch (_) {} });
    cleanup = [];
    const wasActive = active;
    active = null;
    const modal = document.getElementById('tareaModal');
    if (modal) modal.classList.add('oculto');
    if (root) root.innerHTML = '';
    if (wasActive && !silent && wasActive.opts.onClose) wasActive.opts.onClose(wasActive.finished);
  }

  return { open, close, isOpen: () => !!active, current: () => active };
})();
