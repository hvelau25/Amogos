// Minijuegos de tareas y de arreglo de sabotajes. Todo pensado para dedo en celular.
window.Tasks = (function () {
  const COLORS = ['#e23b3b', '#2f6fe0', '#f4d23a', '#ef6fbf', '#3fcf72', '#f28a1f'];
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
  function cables(done, opts) {
    const n = Math.min(6, 4 + (opts.step || 0)); // más cables en cada etapa
    const board = el('div', 'cables');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('cables-lineas');
    const left = el('div', 'cables-col'), right = el('div', 'cables-col');
    board.append(left, svg, right);
    root.appendChild(board);
    let sel = null, joined = 0;
    const ids = Array.from({ length: n }, (_, i) => i);
    const L = shuffle(ids), R = shuffle(ids);
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
        if (++joined === n) done();
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
    const btn = el('button', 'btn btn-grande btn-mantener', opts.label || (opts.step ? 'Mantén para SUBIR' : 'Mantén para DESCARGAR'));
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
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'borrar', '0', 'OK'].forEach((k) => {
      const b = el('button', 'tecla' + (k === 'OK' ? ' tecla-ok' : ''), k === 'borrar' ? null : k);
      if (k === 'borrar') { b.appendChild(Icons.el('borrar')); b.setAttribute('aria-label', 'Borrar'); }
      b.onclick = () => {
        if (k === 'borrar') val = val.slice(0, -1);
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
    const track = el('div', 'riel'), card = el('div', 'tarjeta-id');
    card.appendChild(Icons.el('tarjeta'));
    track.appendChild(card);
    const msg = el('div', 'grande', 'Desliza la tarjeta');
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
      else { msg.textContent = '¡Aceptada!'; done(); return; }
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
    const pad = el('button', 'mano');
    pad.appendChild(Icons.el('mano'));
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

  // ---------- (Difícil) Secuencia: repetir las luces que se encienden, 3 rondas de 4, 5 y 6 ----------
  function secuencia(done) {
    const ROUNDS = [4, 5, 6];
    const grid = el('div', 'sec-grid');
    const leds = el('div', 'sec-leds');
    const pads = [];
    for (let i = 0; i < 9; i++) {
      const b = el('button', 'sec-pad');
      b.style.setProperty('--c', ['#e23b3b', '#2f6fe0', '#f4d23a', '#3fcf72', '#ef6fbf', '#f28a1f', '#4fd8ff', '#8a4fd8', '#e8edf2'][i]);
      pads.push(b);
      grid.appendChild(b);
    }
    ROUNDS.forEach(() => leds.appendChild(el('i')));
    const msg = el('div', 'grande', 'Mira…');
    root.append(leds, grid, msg);
    let round = 0, seq = [], pos = 0, input = false;
    const flash = (i, ms) => { pads[i].classList.add('luz'); later(() => pads[i].classList.remove('luz'), ms); if (window.Sound) Sound.play('click'); };
    const play = () => {
      input = false; pos = 0;
      msg.textContent = 'Mira…';
      seq = Array.from({ length: ROUNDS[round] }, () => Math.floor(Math.random() * 9));
      seq.forEach((v, k) => later(() => flash(v, 380), 700 + k * 560));
      later(() => { input = true; msg.textContent = 'Ahora tú: ' + ROUNDS[round] + ' toques'; }, 700 + seq.length * 560);
    };
    pads.forEach((b, i) => {
      b.onclick = () => {
        if (!input) return;
        flash(i, 180);
        if (i !== seq[pos]) {
          shake(grid);
          round = 0;
          [...leds.children].forEach((l) => l.classList.remove('ok'));
          msg.textContent = 'Mal. Desde el principio.';
          input = false;
          later(play, 900);
          return;
        }
        if (++pos === seq.length) {
          leds.children[round].classList.add('ok');
          input = false;
          if (++round === ROUNDS.length) { done(); return; }
          msg.textContent = '¡Bien!';
          later(play, 800);
        }
      };
    });
    play();
    hint('Repite el orden en que se encienden los botones. Si fallas, vuelves a la primera ronda.');
  }

  // ---------- (Difícil) Frecuencia: igualar tu onda con la de referencia ----------
  function frecuencia(done) {
    const cv = el('canvas', 'onda');
    cv.width = 520; cv.height = 150;
    const mkSlider = (label) => {
      const row = el('label', 'deslizador');
      const inp = el('input');
      inp.type = 'range'; inp.min = 0; inp.max = 1000; inp.value = Math.floor(Math.random() * 1000);
      row.append(el('span', null, label), inp);
      return { row, inp };
    };
    const f = mkSlider('Frecuencia'), a = mkSlider('Amplitud');
    const msg = el('div', 'grande', 'Ajusta hasta que las ondas coincidan');
    root.append(cv, f.row, a.row, msg);
    // Objetivo lejos de donde empiezan los deslizadores
    const far = (v) => { let t; do { t = 100 + Math.random() * 800; } while (Math.abs(t - v) < 300); return t; };
    const tf = far(+f.inp.value), ta = far(+a.inp.value);
    const g = cv.getContext('2d');
    let lockedFor = 0, last = performance.now(), finished = false;
    const wave = (fr, am, ph, color, w, dash) => {
      g.strokeStyle = color; g.lineWidth = w; g.setLineDash(dash || []);
      g.beginPath();
      for (let x = 0; x <= cv.width; x += 4) {
        const y = cv.height / 2 + Math.sin(x / cv.width * Math.PI * 2 * (1.5 + fr / 1000 * 5) + ph) * (10 + am / 1000 * 55);
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke(); g.setLineDash([]);
    };
    frame((t) => {
      const dt = Math.min((t - last) / 1000, 0.1); last = t;
      const ph = t / 400;
      const df = Math.abs(+f.inp.value - tf), da = Math.abs(+a.inp.value - ta);
      const close = df < 22 && da < 28; // margen estrecho: es difícil a propósito
      g.fillStyle = '#071a10'; g.fillRect(0, 0, cv.width, cv.height);
      g.strokeStyle = 'rgba(95,224,138,.15)'; g.lineWidth = 1;
      for (let x = 0; x < cv.width; x += 26) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, cv.height); g.stroke(); }
      wave(tf, ta, ph, 'rgba(255,255,255,.75)', 4, [10, 8]);
      wave(+f.inp.value, +a.inp.value, ph, close ? '#5fe08a' : '#ffcc33', 5);
      if (finished) return;
      lockedFor = close ? lockedFor + dt : 0;
      msg.textContent = close ? 'Mantenla así… ' + Math.max(0, 1.2 - lockedFor).toFixed(1) + 's' : (df > da ? 'Mueve la frecuencia' : 'Mueve la amplitud');
      if (lockedFor >= 1.2) { finished = true; done(); }
    });
    hint('Mueve los dos deslizadores hasta que tu onda tape la línea punteada, y mantenla 1 segundo.');
  }

  // ---------- (Difícil) Ordenar: tocar del 1 al 10 en orden antes de que se acabe el tiempo ----------
  function ordenar(done) {
    const N = 10, LIMIT = 9;
    const box = el('div', 'ord-caja');
    const bar = el('div', 'barra'), fill = el('div', 'barra-relleno ord-tiempo');
    bar.appendChild(fill);
    const msg = el('div', 'grande', 'Toca del 1 al ' + N);
    root.append(bar, box, msg);
    let next = 1, startedAt = 0, finished = false;
    const deal = () => {
      box.innerHTML = '';
      next = 1; startedAt = 0;
      // Posiciones al azar en una cuadrícula de 5x3 para que no se encimen
      const cells = shuffle(Array.from({ length: 15 }, (_, i) => i)).slice(0, N);
      cells.forEach((c, k) => {
        const b = el('button', 'ord-num', String(k + 1));
        b.style.left = (c % 5) * 20 + 2 + Math.random() * 4 + '%';
        b.style.top = Math.floor(c / 5) * 33 + 3 + Math.random() * 6 + '%';
        b.style.transform = `rotate(${(Math.random() - 0.5) * 30}deg)`;
        b.onclick = () => {
          if (finished) return;
          if (+b.textContent !== next) { shake(box); msg.textContent = 'Ese no. Se revuelven…'; later(deal, 500); return; }
          if (next === 1) startedAt = performance.now();
          b.disabled = true; b.classList.add('ok');
          if (++next > N) { finished = true; done(); }
        };
        box.appendChild(b);
      });
    };
    frame((t) => {
      if (!startedAt || finished) { fill.style.width = '100%'; return; }
      const left = 1 - (t - startedAt) / 1000 / LIMIT;
      fill.style.width = Math.max(0, left) * 100 + '%';
      if (left <= 0) { shake(box); msg.textContent = '¡Tiempo! Otra vez.'; deal(); }
    });
    deal();
    hint('Toca los números del 1 al 10 en orden. Tienes 9 segundos desde el primer toque; si fallas, se revuelven.');
  }

  const GAMES = { cables, descarga, codigo, tarjeta, interruptores, calibrar, reactor, secuencia, frecuencia, ordenar };

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
