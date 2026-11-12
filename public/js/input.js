// Controles: joystick táctil (mitad izquierda de la pantalla) y teclado (WASD / flechas) para probar en PC.
window.Input = (function () {
  const joy = { active: false, id: null, baseX: 0, baseY: 0, knobX: 0, knobY: 0, dx: 0, dy: 0 };
  const RADIUS = 60; // en píxeles CSS
  const keys = new Set();
  let enabled = false;

  function onDown(e) {
    if (!enabled || joy.active) return;
    if (e.clientX > window.innerWidth * 0.5) return;
    joy.active = true;
    joy.id = e.pointerId;
    joy.baseX = joy.knobX = e.clientX;
    joy.baseY = joy.knobY = e.clientY;
    joy.dx = joy.dy = 0;
    e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId);
  }
  function onMove(e) {
    if (!joy.active || e.pointerId !== joy.id) return;
    let dx = e.clientX - joy.baseX, dy = e.clientY - joy.baseY;
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) {
      // La base sigue al dedo si se pasa del radio, así no hay que volver al centro.
      const over = d - RADIUS;
      joy.baseX += (dx / d) * over;
      joy.baseY += (dy / d) * over;
      dx = e.clientX - joy.baseX;
      dy = e.clientY - joy.baseY;
    }
    joy.knobX = e.clientX;
    joy.knobY = e.clientY;
    const m = Math.min(Math.hypot(dx, dy) / RADIUS, 1);
    const dead = 0.15;
    if (m < dead) { joy.dx = joy.dy = 0; return; }
    const ang = Math.atan2(dy, dx);
    const k = (m - dead) / (1 - dead);
    joy.dx = Math.cos(ang) * k;
    joy.dy = Math.sin(ang) * k;
  }
  function onUp(e) {
    if (e.pointerId !== joy.id) return;
    joy.active = false;
    joy.id = null;
    joy.dx = joy.dy = 0;
  }

  function attach(canvas) {
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => { keys.clear(); onUp({ pointerId: joy.id }); });
  }

  function vector() {
    if (!enabled) return { x: 0, y: 0 };
    let x = joy.dx, y = joy.dy;
    let kx = 0, ky = 0;
    if (keys.has('a') || keys.has('arrowleft')) kx -= 1;
    if (keys.has('d') || keys.has('arrowright')) kx += 1;
    if (keys.has('w') || keys.has('arrowup')) ky -= 1;
    if (keys.has('s') || keys.has('arrowdown')) ky += 1;
    if (kx || ky) {
      const l = Math.hypot(kx, ky);
      x = kx / l;
      y = ky / l;
    }
    return { x, y };
  }

  return {
    attach,
    vector,
    joystick: joy,
    RADIUS,
    setEnabled(v) { enabled = v; if (!v) { joy.active = false; joy.dx = joy.dy = 0; keys.clear(); } },
  };
})();
