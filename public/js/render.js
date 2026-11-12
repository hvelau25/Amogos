// Dibujo del mundo: mapa, tripulantes y joystick.
window.Render = (function () {
  const S = window.Shared;
  const T = S.TILE;
  const OUTLINE = '#141420';

  let canvas, ctx, dpr = 1, cssW = 0, cssH = 0;
  const stars = [];

  function init(c) {
    canvas = c;
    ctx = canvas.getContext('2d');
    for (let i = 0; i < 220; i++)
      stars.push({ x: Math.random() * 2000, y: Math.random() * 2000, r: Math.random() * 1.6 + 0.3, a: Math.random() * 0.7 + 0.3 });
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = window.innerWidth;
    cssH = window.innerHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }

  // Cuántas unidades de mundo entran en pantalla: ~7.5 casillas de alto en celular.
  function worldScale() {
    return Math.min(cssH / (7.5 * T), cssW / (13 * T));
  }

  function drawStars(camX, camY) {
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, cssW, cssH);
    for (const s of stars) {
      const x = (((s.x - camX * 0.15) % 2000) + 2000) % 2000;
      const y = (((s.y - camY * 0.15) % 2000) + 2000) % 2000;
      if (x > cssW || y > cssH) continue;
      ctx.globalAlpha = s.a;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, s.r, s.r);
    }
    ctx.globalAlpha = 1;
  }

  // Fondo del planeta helado: cielo frío, aurora lenta y nieve cayendo (con parallax).
  function drawSnowBackground(map, camX, camY) {
    const P = map.palette || {};
    const g = ctx.createLinearGradient(0, 0, 0, cssH);
    g.addColorStop(0, P.bgTop || '#08111f');
    g.addColorStop(1, P.bgBot || '#1b3150');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW, cssH);
    const t = performance.now() / 1000;
    // Aurora
    ctx.save();
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 3; i++) {
      const y = cssH * (0.18 + i * 0.12) + Math.sin(t * 0.25 + i) * 14;
      const ag = ctx.createLinearGradient(0, y - 40, 0, y + 40);
      ag.addColorStop(0, 'rgba(80,255,190,0)');
      ag.addColorStop(0.5, i === 1 ? 'rgba(130,160,255,1)' : 'rgba(80,255,190,1)');
      ag.addColorStop(1, 'rgba(80,255,190,0)');
      ctx.fillStyle = ag;
      ctx.fillRect(0, y - 40, cssW, 80);
    }
    ctx.restore();
    // Copos
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const depth = 0.12 + s.r * 0.12;
      const x = (((s.x + Math.sin(t * 0.6 + i) * 18 - camX * depth) % 2000) + 2000) % 2000;
      const y = (((s.y + t * (22 + s.r * 26) - camY * depth) % 2000) + 2000) % 2000;
      if (x > cssW || y > cssH) continue;
      ctx.globalAlpha = Math.min(1, s.a + 0.25);
      ctx.beginPath(); ctx.arc(x, y, s.r + 0.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawBackground(map, camX, camY) {
    if (map && map.theme === 'ice') drawSnowBackground(map, camX, camY);
    else drawStars(camX, camY);
  }

  // Ventisca por encima del mapa (solo en el planeta helado): copos grandes que cruzan la pantalla.
  function drawBlizzard() {
    const t = performance.now() / 1000;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) {
      const s = stars[i];
      const x = (((s.x * 1.3 + t * (120 + s.r * 70)) % (cssW + 80)) + cssW + 80) % (cssW + 80) - 40;
      const y = (((s.y * 0.9 + t * (60 + s.r * 40)) % (cssH + 80)) + cssH + 80) % (cssH + 80) - 40;
      ctx.globalAlpha = 0.28;
      ctx.beginPath(); ctx.arc(x, y, 1.2 + s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function floorColor(map, tx, ty) {
    const i = map.roomOf[ty * map.width + tx];
    return i >= 0 ? map.rooms[i].floor : map.corridorFloor || '#565d6e';
  }

  const shadeMemo = new Map(); // se llama por cada casilla en cada cuadro: guardar el resultado evita crear miles de textos
  function shade(hex, amt) {
    const key = hex + amt;
    let v = shadeMemo.get(key);
    if (v) return v;
    const n = parseInt(hex.slice(1), 16);
    const f = (x) => Math.max(0, Math.min(255, Math.round(x + amt)));
    v = `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
    shadeMemo.set(key, v);
    return v;
  }

  function drawMap(map, x0, y0, x1, y1) {
    const solid = (tx, ty) => S.isSolidTile(map, tx, ty);
    // Piso
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        if (solid(tx, ty)) continue;
        const c = floorColor(map, tx, ty);
        const px = tx * T, py = ty * T;
        ctx.fillStyle = c;
        ctx.fillRect(px, py, T + 0.5, T + 0.5);
        ctx.fillStyle = shade(c, (tx + ty) % 2 ? 6 : -6);
        ctx.fillRect(px + 4, py + 4, T - 8, T - 8);
        if (map.theme === 'ice') {
          // Grietas y brillos de hielo (determinista por casilla, no parpadea).
          const h = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
          if (h % 5 === 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
            ctx.beginPath();
            const a = (h >> 3) % 40 + 8, b = (h >> 9) % 40 + 8;
            ctx.moveTo(px + a, py + 8); ctx.lineTo(px + a + 10, py + 26); ctx.lineTo(px + b, py + 50);
            ctx.stroke();
          } else if (h % 7 === 1) {
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillRect(px + (h >> 4) % 44 + 8, py + (h >> 11) % 44 + 8, 3, 3);
          }
        }
      }
    // Paredes: cara frontal (cuando hay piso abajo) y borde superior
    const P = map.palette || {};
    const wTop = P.wallTop || '#2a3045', wFace = P.wallFace || '#4a5370', wHi = P.wallHi || '#5d6889', wLo = P.wallLo || '#353c55';
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        if (!solid(tx, ty)) continue;
        const px = tx * T, py = ty * T;
        const floorBelow = !solid(tx, ty + 1);
        const nearFloor = floorBelow || !solid(tx, ty - 1) || !solid(tx - 1, ty) || !solid(tx + 1, ty) ||
          !solid(tx - 1, ty + 1) || !solid(tx + 1, ty + 1) || !solid(tx - 1, ty - 1) || !solid(tx + 1, ty - 1);
        if (!nearFloor) continue;
        ctx.fillStyle = wTop;
        ctx.fillRect(px, py, T + 0.5, T + 0.5);
        if (floorBelow) {
          ctx.fillStyle = wFace;
          ctx.fillRect(px, py + T * 0.35, T + 0.5, T * 0.65 + 0.5);
          ctx.fillStyle = wHi;
          ctx.fillRect(px, py + T * 0.35, T + 0.5, map.theme === 'ice' ? 12 : 6);
          ctx.fillStyle = wLo;
          ctx.fillRect(px, py + T - 6, T + 0.5, 6);
        }
      }
    // Contorno entre piso y pared
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        if (!solid(tx, ty)) continue;
        const px = tx * T, py = ty * T;
        if (!solid(tx, ty - 1)) { ctx.moveTo(px, py); ctx.lineTo(px + T, py); }
        if (!solid(tx - 1, ty)) { ctx.moveTo(px, py); ctx.lineTo(px, py + T); }
        if (!solid(tx + 1, ty)) { ctx.moveTo(px + T, py); ctx.lineTo(px + T, py + T); }
      }
    ctx.stroke();
  }

  function shadowEllipse(x, y, rx, ry) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawItem(d, now) {
    const x = d.x * T, y = d.y * T;
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4;
    switch (d.t) {
      case 'table':
        shadowEllipse(x, y + 10, 44, 18);
        ctx.fillStyle = '#c9d3e6';
        ctx.beginPath(); ctx.ellipse(x, y, 44, 28, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      case 'core': {
        ctx.fillStyle = 'rgba(' + (d.c || '80,255,190') + ',' + (0.35 + Math.sin(now * 3) * 0.15) + ')';
        ctx.beginPath(); ctx.arc(x, y, 70, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = d.c && d.c.startsWith('255') ? '#6b4524' : '#2b5a4f';
        ctx.beginPath(); ctx.arc(x, y, 40, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(' + (d.c || '80,255,190') + ',0.9)';
        ctx.beginPath(); ctx.arc(x, y, 14 + Math.sin(now * 5) * 2, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'crate': {
        const s = 40;
        shadowEllipse(x, y + s / 2, s * 0.6, 8);
        ctx.fillStyle = d.c || '#9a7b52';
        ctx.fillRect(x - s / 2, y - s / 2, s, s); ctx.strokeRect(x - s / 2, y - s / 2, s, s);
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x - s / 2, y - s / 2); ctx.lineTo(x + s / 2, y + s / 2); ctx.moveTo(x + s / 2, y - s / 2); ctx.lineTo(x - s / 2, y + s / 2); ctx.stroke();
        break;
      }
      case 'barrel':
        shadowEllipse(x, y + 16, 20, 7);
        ctx.fillStyle = '#c0572b';
        roundRect(x - 16, y - 20, 32, 38, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#7a3516'; ctx.fillRect(x - 16, y - 8, 32, 5); ctx.fillRect(x - 16, y + 5, 32, 5);
        break;
      case 'bed':
        shadowEllipse(x, y + 22, 44, 8);
        ctx.fillStyle = '#e8edf5';
        roundRect(x - 42, y - 22, 84, 44, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#5b8fd8'; roundRect(x - 14, y - 22, 56, 44, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffffff'; roundRect(x - 38, y - 15, 22, 30, 6); ctx.fill();
        break;
      case 'plant':
        shadowEllipse(x, y + 14, 22, 7);
        ctx.fillStyle = '#7a5a3a'; roundRect(x - 14, y - 2, 28, 20, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#3fae5a';
        for (const [dx, dy, r] of [[-10, -12, 12], [10, -12, 12], [0, -22, 13], [0, -8, 12]]) {
          ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        ctx.fillStyle = '#ff6fa8'; ctx.beginPath(); ctx.arc(x + 4, y - 24, 4, 0, Math.PI * 2); ctx.fill();
        break;
      case 'bench': {
        const w = (d.w || 2) * T;
        shadowEllipse(x, y + 20, w * 0.5, 8);
        ctx.fillStyle = '#7e8aa6';
        roundRect(x - w / 2, y - 18, w, 36, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#c9d3e6'; ctx.fillRect(x - w / 2 + 6, y - 12, w - 12, 8);
        ctx.fillStyle = '#5fe0c0'; ctx.beginPath(); ctx.arc(x - w / 4, y + 6, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff8a5f'; ctx.beginPath(); ctx.arc(x + w / 5, y + 6, 6, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'console': {
        const w = (d.w || 2) * T;
        ctx.fillStyle = '#2b3348';
        roundRect(x - w / 2, y - 20, w, 40, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(80,200,255,' + (0.7 + Math.sin(now * 2 + d.x) * 0.2) + ')';
        ctx.fillRect(x - w / 2 + 8, y - 14, w - 16, 18);
        ctx.fillStyle = '#ffd34d';
        for (let i = 0; i < 4; i++) ctx.fillRect(x - w / 2 + 10 + i * 14, y + 9, 8, 5);
        break;
      }
      case 'dish':
        shadowEllipse(x, y + 22, 26, 8);
        ctx.fillStyle = '#9aa3ad'; ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#d6dde6'; ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = OUTLINE; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 18, y - 24); ctx.stroke();
        ctx.fillStyle = '#ff4d5e'; ctx.beginPath(); ctx.arc(x + 18, y - 24, 4, 0, Math.PI * 2); ctx.fill();
        break;
      case 'telescope':
        shadowEllipse(x, y + 26, 34, 9);
        ctx.fillStyle = '#6f7a94'; roundRect(x - 22, y + 6, 44, 18, 6); ctx.fill(); ctx.stroke();
        ctx.save(); ctx.translate(x, y); ctx.rotate(-0.6);
        ctx.fillStyle = '#c9d3e6'; roundRect(-12, -52, 24, 66, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#4fb3ff'; ctx.beginPath(); ctx.arc(0, -52, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
        break;
      case 'sled':
        shadowEllipse(x, y + 24, 46, 9);
        ctx.strokeStyle = OUTLINE; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(x - 46, y + 20); ctx.lineTo(x + 40, y + 20); ctx.quadraticCurveTo(x + 56, y + 20, x + 52, y + 6); ctx.stroke();
        ctx.lineWidth = 4;
        ctx.fillStyle = '#d6453a'; roundRect(x - 38, y - 14, 76, 28, 10); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffd34d'; ctx.fillRect(x - 20, y - 14, 10, 28);
        break;
      default:
    }
  }

  // v = rectángulo visible en unidades de mundo (con margen): lo de afuera no se dibuja.
  const inView = (v, x, y) => !v || (x >= v.x0 && x <= v.x1 && y >= v.y0 && y <= v.y1);
  function drawDecor(map, v) {
    const now = performance.now() / 1000;
    for (const d of map.decor || []) if (inView(v, d.x * T, d.y * T)) drawItem(d, now);
    // Botón de emergencia (sobre la mesa central)
    if (map.emergency) {
      const ex = map.emergency.x * T, ey = map.emergency.y * T;
      const pr = (now * 0.7) % 1;
      ctx.strokeStyle = `rgba(255,60,80,${0.5 * (1 - pr)})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(ex, ey, 22 + pr * 26, 14 + pr * 17, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#9aa3ad'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(ex, ey, 20, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8263b';
      ctx.beginPath(); ctx.ellipse(ex, ey - 4, 13, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    if (map.id === 'lobby') {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.font = 'bold 40px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LOBBY', 8 * T, 2.2 * T);
    }
  }

  // El texto de cada sala no cambia nunca: se dibuja una vez en una imagen y luego solo se pega.
  // (Si la fuente aún no cargó, se dibuja directo; al cargar se vacía la caché para rehacerla.)
  const labelCache = new Map();
  // ¿La fuente de los títulos ya está lista? (si aún se descarga, no guardar nada: se guardaría con la letra equivocada)
  const fontOk = () => !document.fonts || document.fonts.check('30px "Luckiest Guy"');
  const LABEL_FONT = (px) => `${px}px "Luckiest Guy", system-ui, sans-serif`;
  function roomLabelImg(map, r) {
    const key = map.id + ':' + r.id;
    let c = labelCache.get(key);
    if (c) return c;
    if (!fontOk()) return null;
    const K = 2, text = r.name.toUpperCase();
    const g0 = document.createElement('canvas').getContext('2d');
    g0.font = LABEL_FONT(30 * K);
    const w = Math.ceil(g0.measureText(text).width) + 24 * K, h = 56 * K;
    c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.font = LABEL_FONT(30 * K); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = 6 * K; g.strokeStyle = 'rgba(0,0,0,0.16)'; g.strokeText(text, w / 2, h / 2 + 3 * K);
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillText(text, w / 2, h / 2);
    c._w = w / K; c._h = h / K;
    labelCache.set(key, c);
    return c;
  }

  function drawRoomLabels(map, x0, y0, x1, y1) {
    for (const r of map.rooms) {
      if (r.label === false || !r.name) continue;
      if (r.x + r.w < x0 || r.x > x1 || r.y + r.h < y0 || r.y > y1) continue;
      const lx = (r.x + r.w / 2) * T, ly = (r.y + 0.75) * T;
      const img = roomLabelImg(map, r);
      if (img) { ctx.drawImage(img, lx - img._w / 2, ly - img._h / 2, img._w, img._h); continue; }
      const label = r.name.toUpperCase();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = LABEL_FONT(30);
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineJoin = 'round';
      ctx.strokeText(label, lx, ly + 3);
      ctx.lineJoin = 'miter';
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillText(label, lx, ly);
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Tripulante original: cuerpo redondito, casco tipo pecera con cara y antena.
  function drawCrew(x, y, colorIdx, facing, moving, t, alpha, dead) {
    const c = S.COLORS[colorIdx] || S.COLORS[0];
    const r = S.PLAYER_RADIUS;
    const f = facing === -1 ? -1 : 1;
    const step = moving ? Math.sin(t * 14) : 0;
    const bob = moving ? -Math.abs(Math.sin(t * 14)) * 3 : Math.sin(t * 2) * 0.8;

    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;

    // Sombra
    if (!dead) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(x, y + r * 1.0, r * 0.95, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    }

    ctx.translate(x, y + bob);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = OUTLINE;

    // Piernas
    for (const side of [-1, 1]) {
      const off = side * step * r * 0.18;
      ctx.fillStyle = c.dark;
      roundRect(side * r * 0.42 - r * 0.28, r * 0.5 + off * 0.3, r * 0.56, r * 0.5 - off * 0.3, r * 0.2);
      ctx.fill(); ctx.stroke();
    }

    // Cuerpo
    ctx.fillStyle = c.body;
    roundRect(-r * 0.88, -r * 0.55, r * 1.76, r * 1.3, r * 0.6);
    ctx.fill(); ctx.stroke();
    // Cinturón y hebilla
    ctx.fillStyle = c.dark;
    ctx.fillRect(-r * 0.82, r * 0.3, r * 1.64, r * 0.18);
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(f * r * 0.25 - r * 0.1, r * 0.28, r * 0.2, r * 0.22);
    // Brillo del cuerpo
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    roundRect(-f * r * 0.65 - (f < 0 ? r * 0.2 : 0), -r * 0.3, r * 0.2, r * 0.5, r * 0.1);
    ctx.fill();

    // Antena
    ctx.beginPath();
    ctx.moveTo(-f * r * 0.35, -r * 1.25);
    ctx.quadraticCurveTo(-f * r * 0.5, -r * 1.55, -f * r * 0.42, -r * 1.75);
    ctx.stroke();
    ctx.fillStyle = c.body;
    ctx.beginPath(); ctx.arc(-f * r * 0.42, -r * 1.78, r * 0.16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Casco de vidrio
    const hy = -r * 0.62, hr = r * 0.78;
    const g = ctx.createRadialGradient(f * r * 0.15, hy - r * 0.2, r * 0.1, 0, hy, hr);
    g.addColorStop(0, '#e9fbff');
    g.addColorStop(1, '#8fcde6');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, hy, hr, 0, Math.PI * 2); ctx.fill();
    // Cara dentro del casco
    ctx.fillStyle = '#f3d2b3';
    ctx.beginPath(); ctx.arc(f * r * 0.12, hy + r * 0.05, hr * 0.62, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = OUTLINE;
    if (dead) {
      ctx.lineWidth = 2.5;
      for (const ex of [-0.12, 0.22]) {
        const cx = f * r * (0.12 + ex), cy = hy - r * 0.02, s = r * 0.09;
        ctx.beginPath(); ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s, cy + s); ctx.moveTo(cx + s, cy - s); ctx.lineTo(cx - s, cy + s); ctx.stroke();
      }
    } else {
      for (const ex of [-0.12, 0.22]) {
        ctx.beginPath(); ctx.ellipse(f * r * (0.12 + ex), hy - r * 0.02, r * 0.07, r * 0.11, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(f * r * 0.17, hy + r * 0.16, r * 0.12, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }
    // Brillo y borde del casco
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(0, hy, hr * 0.78, -Math.PI * 0.95, -Math.PI * 0.62); ctx.stroke();
    ctx.strokeStyle = OUTLINE;
    ctx.beginPath(); ctx.arc(0, hy, hr, 0, Math.PI * 2); ctx.stroke();

    ctx.restore();
  }

  function drawName(x, y, name, isHost, disconnected, color) {
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const label = name + (disconnected ? ' (…)' : '');
    const ny = y - S.PLAYER_RADIUS * 2.0;
    ctx.lineWidth = 4; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(label, x, ny);
    ctx.fillStyle = disconnected ? '#9aa3c7' : color || '#ffffff';
    ctx.fillText(label, x, ny);
    ctx.lineJoin = 'miter';
    if (isHost) { // estrella propia junto al nombre del host
      const w = ctx.measureText(label).width, im = window.Icons && Icons.img('estrella');
      if (im && im.complete) ctx.drawImage(im, x - w / 2 - 24, ny - 21, 20, 20);
    }
  }

  function drawJoystick() {
    const j = Input.joystick;
    if (!j.active) return;
    const bg = ctx.createRadialGradient(j.baseX, j.baseY, Input.RADIUS * 0.3, j.baseX, j.baseY, Input.RADIUS);
    bg.addColorStop(0, 'rgba(255,255,255,0.04)');
    bg.addColorStop(1, 'rgba(255,255,255,0.16)');
    ctx.fillStyle = bg;
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(j.baseX, j.baseY, Input.RADIUS, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    let kx = j.knobX - j.baseX, ky = j.knobY - j.baseY;
    const d = Math.hypot(kx, ky);
    if (d > Input.RADIUS) { kx = (kx / d) * Input.RADIUS; ky = (ky / d) * Input.RADIUS; }
    if (d > 8) {
      const a = Math.atan2(ky, kx);
      ctx.strokeStyle = 'rgba(255,204,51,0.8)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(j.baseX, j.baseY, Input.RADIUS - 2, a - 0.45, a + 0.45); ctx.stroke();
    }
    const kg = ctx.createRadialGradient(j.baseX + kx - 8, j.baseY + ky - 8, 4, j.baseX + kx, j.baseY + ky, 28);
    kg.addColorStop(0, 'rgba(255,255,255,0.85)');
    kg.addColorStop(1, 'rgba(200,210,240,0.5)');
    ctx.fillStyle = kg;
    ctx.beginPath(); ctx.arc(j.baseX + kx, j.baseY + ky, 28, 0, Math.PI * 2); ctx.fill();
  }

  // ---------- Partículas (polvo al caminar, destellos, salpicaduras) ----------
  const parts = [];
  const lastDust = new Map();
  function burst(x, y, kind, color) {
    const n = { dust: 3, sparkle: 26, splat: 22, puff: 16, confetti: 0 }[kind] || 8;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      let sp = 0, life = 0.6, r = 4;
      if (kind === 'dust') { sp = 20 + Math.random() * 30; life = 0.45 + Math.random() * 0.2; r = 4 + Math.random() * 4; }
      if (kind === 'sparkle') { sp = 120 + Math.random() * 220; life = 0.7 + Math.random() * 0.5; r = 3 + Math.random() * 4; }
      if (kind === 'splat') { sp = 80 + Math.random() * 260; life = 0.5 + Math.random() * 0.5; r = 4 + Math.random() * 6; }
      if (kind === 'puff') { sp = 40 + Math.random() * 120; life = 0.6 + Math.random() * 0.4; r = 10 + Math.random() * 10; }
      parts.push({ kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * (kind === 'dust' ? 0.4 : 1) - (kind === 'dust' ? 8 : 0),
        life, max: life, r, color: color || null, rot: Math.random() * 6 });
    }
    if (parts.length > 400) parts.splice(0, parts.length - 400);
  }
  function stepParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      const drag = p.kind === 'sparkle' ? 2.6 : p.kind === 'splat' ? 5 : 3;
      p.vx -= p.vx * Math.min(1, drag * dt);
      p.vy -= p.vy * Math.min(1, drag * dt);
      if (p.kind === 'sparkle') p.vy += 60 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 6;
    }
  }
  function drawParts(layer) {
    for (const p of parts) {
      const k = p.life / p.max;
      if (layer === 'low' && (p.kind !== 'dust' && p.kind !== 'splat')) continue;
      if (layer === 'high' && (p.kind === 'dust' || p.kind === 'splat')) continue;
      if (p.kind === 'dust') {
        ctx.globalAlpha = k * 0.35; ctx.fillStyle = '#e6ecff';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.6 - k * 0.6), 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'sparkle') {
        ctx.globalAlpha = Math.min(1, k * 1.6); ctx.fillStyle = p.color || '#ffe27a';
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        const s = p.r * (0.6 + k);
        ctx.beginPath(); ctx.moveTo(0, -s * 2); ctx.lineTo(s * 0.5, 0); ctx.lineTo(0, s * 2); ctx.lineTo(-s * 0.5, 0); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-s * 2, 0); ctx.lineTo(0, s * 0.5); ctx.lineTo(s * 2, 0); ctx.lineTo(0, -s * 0.5); ctx.closePath(); ctx.fill();
        ctx.restore();
      } else if (p.kind === 'splat') {
        ctx.globalAlpha = Math.min(1, k * 2); ctx.fillStyle = p.color || '#b0102a';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + k * 0.5), 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'puff') {
        ctx.globalAlpha = k * 0.55; ctx.fillStyle = p.color || '#8b93a8';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.8 - k), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Luz suave de cada sala visible (da volumen al piso).
  const lightCache = new Map(); // un degradado por sala (se crea una vez; la pulsación va en globalAlpha)
  function drawRoomLights(map, x0, y0, x1, y1, t) {
    for (const r of map.rooms) {
      if (r.x + r.w < x0 || r.x > x1 || r.y + r.h < y0 || r.y > y1) continue;
      const key = map.id + ':' + r.id;
      let g = lightCache.get(key);
      if (!g) {
        const cx = (r.x + r.w / 2) * T, cy = (r.y + r.h / 2) * T;
        const rad = Math.max(r.w, r.h) * T * 0.62;
        g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, map.theme === 'ice' ? 'rgb(200,240,255)' : 'rgb(255,240,200)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        lightCache.set(key, g);
      }
      ctx.globalAlpha = 0.13 + Math.sin(t * 0.8 + r.x) * 0.02;
      ctx.fillStyle = g;
      ctx.fillRect(r.x * T, r.y * T, r.w * T, r.h * T);
      ctx.globalAlpha = 1;
      // Sombra interior en las orillas de la sala
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 14;
      ctx.strokeRect(r.x * T + 7, r.y * T + 7, r.w * T - 14, r.h * T - 14);
    }
  }

  // Detalles en las paredes: ventanas con estrellas (estación), carámbanos (hielo) y foquitos.
  function drawWallDetails(map, x0, y0, x1, y1, t) {
    const solid = (tx, ty) => S.isSolidTile(map, tx, ty);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        if (!solid(tx, ty) || solid(tx, ty + 1)) continue;
        const h = ((tx * 92837111) ^ (ty * 689287499)) >>> 0;
        const px = tx * T, py = ty * T;
        if (map.theme === 'ice') {
          ctx.fillStyle = 'rgba(220,245,255,0.9)'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
          const n = 2 + (h % 3);
          for (let i = 0; i < n; i++) {
            const ix = px + 8 + ((h >> (i * 3)) % 48), len = 8 + ((h >> (i * 4 + 2)) % 14);
            ctx.beginPath(); ctx.moveTo(ix - 5, py + T); ctx.lineTo(ix + 5, py + T); ctx.lineTo(ix, py + T + len); ctx.closePath(); ctx.fill(); ctx.stroke();
          }
          if (h % 9 === 0) {
            ctx.fillStyle = `rgba(120,220,255,${0.5 + Math.sin(t * 2 + tx) * 0.3})`;
            ctx.beginPath(); ctx.arc(px + T / 2, py + T * 0.6, 5, 0, Math.PI * 2); ctx.fill();
          }
        } else if (h % 5 === 0) {
          // Ventana redonda al espacio
          const cx = px + T / 2, cy = py + T * 0.66, rr = 13;
          ctx.fillStyle = '#060a18'; ctx.strokeStyle = '#8d97b3'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#ffffff';
          for (let i = 0; i < 3; i++) {
            const sx = cx - 7 + ((h >> (i * 5)) % 14), sy = cy - 6 + ((h >> (i * 5 + 3)) % 12);
            ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t * 1.5 + i + tx));
            ctx.fillRect(sx, sy, 2, 2);
          }
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(cx, cy, rr - 5, -2.6, -1.6); ctx.stroke();
        } else if (h % 7 === 2) {
          // Foquito que parpadea
          const on = Math.sin(t * 3 + h) > -0.3;
          ctx.fillStyle = on ? (h % 2 ? '#5fe08a' : '#ffcc33') : '#3a4054';
          ctx.beginPath(); ctx.arc(px + T / 2, py + T * 0.62, 4, 0, Math.PI * 2); ctx.fill();
          if (on) { ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(px + T / 2, py + T * 0.62, 10, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
        } else if (h % 7 === 4) {
          // Tubo
          ctx.fillStyle = '#6b7592'; ctx.fillRect(px, py + T * 0.5, T + 0.5, 7);
          ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(px, py + T * 0.5, T + 0.5, 2);
        }
      }
  }

  // Pantalla de inicio: tripulantes flotando por el espacio.
  const floaters = [];
  function drawMenu(t, dt) {
    if (!floaters.length)
      for (let i = 0; i < 7; i++)
        floaters.push({ x: Math.random() * cssW, y: Math.random() * cssH, vx: (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 26),
          vy: (Math.random() - 0.5) * 14, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.9, s: 0.7 + Math.random() * 0.8, c: i * 2 % 12 });
    for (const f of floaters) {
      f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
      if (f.x < -80) f.x = cssW + 70; if (f.x > cssW + 80) f.x = -70;
      if (f.y < -80) f.y = cssH + 70; if (f.y > cssH + 80) f.y = -70;
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.scale(f.s, f.s);
      drawCrew(0, 0, f.c, f.vx < 0 ? -1 : 1, false, t + f.c, 0.85);
      ctx.restore();
    }
  }

  // ---------- Minimapa ----------
  const miniCache = new Map();
  function miniBase(map, w, h, dp, labels) {
    labels = labels && fontOk(); // sin la fuente lista, el mapa sale sin nombres un instante y se rehace después
    const key = map.id + ':' + w + 'x' + h + ':' + dp + (labels ? ':L' : '');
    let c = miniCache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const k = Math.min(w / map.width, h / map.height);
    const ox = (w - map.width * k) / 2, oy = (h - map.height * k) / 2;
    // Salas y pasillos como figuras (no casilla por casilla): primero el contorno, luego el relleno.
    const R = (r, pad) => [ox + r.x * k - pad, oy + r.y * k - pad, r.w * k + pad * 2, r.h * k + pad * 2];
    const lw = Math.max(2, k * 0.28);
    const rad = (r) => Math.min(k * 0.9, r.w * k / 3, r.h * k / 3);
    const shape = (r, pad, fill) => {
      const [x, y, ww, hh] = R(r, pad);
      g.fillStyle = fill;
      g.beginPath();
      if (g.roundRect) g.roundRect(x, y, ww, hh, rad(r) + pad * 0.5); else g.rect(x, y, ww, hh);
      g.fill();
    };
    for (const r of map.corridors) shape(r, lw, '#e8ecff');
    for (const r of map.rooms) shape(r, lw, '#e8ecff');
    for (const r of map.corridors) shape(r, 0, '#2b3146');
    for (const r of map.rooms) {
      shape(r, 0, shade(r.floor, -38));
      // brillo suave arriba de cada sala
      const [x, y, ww] = R(r, 0);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(x + lw, y + lw, ww - lw * 2, Math.max(2, k * 0.6));
    }
    if (labels) { // los nombres no cambian: van dentro de la imagen guardada
      const u = 0.8 * dp * Math.sqrt(w / dp / 150);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      for (const r of map.rooms) {
        if (!r.name || r.label === false) continue;
        const lx = ox + (r.x + r.w / 2) * k, ly = oy + (r.y + r.h - Math.min(0.9, r.h * 0.25)) * k; // abajo: arriba están las consolas
        const fs = Math.max(9 * dp, Math.min(7 * u, (r.w * k * 1.9) / r.name.length));
        g.font = LABEL_FONT(Math.round(fs));
        g.lineWidth = 3 * u; g.strokeStyle = 'rgba(5,8,20,0.85)'; g.strokeText(r.name, lx, ly);
        g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillText(r.name, lx, ly);
      }
    }
    c._k = k; c._ox = ox; c._oy = oy;
    miniCache.set(key, c);
    return c;
  }

  // opts: { map, me:{x,y,color}, tasks:[{x,y}], fixes:[{x,y}], vents:[{x,y}], emergency, labels, view:{w,h} }
  function minimap(cv, o) {
    const g = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    const t = performance.now() / 1000;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    g.lineJoin = 'round';
    if (!o.map) return;
    const dp = o.dpr || 1;
    const base = miniBase(o.map, w, h, dp, !!o.labels);
    g.drawImage(base, 0, 0);
    const k = base._k, ox = base._ox, oy = base._oy;
    const P = (x, y) => [ox + (x / T) * k, oy + (y / T) * k];
    const u = 0.8 * dp * Math.sqrt(w / dp / 150); // escala de los iconos (en píxeles reales)
    for (const v of o.vents || []) {
      const [vx, vy] = P(v.x * T, v.y * T);
      g.fillStyle = '#9aa3c7'; g.fillRect(vx - 3 * u, vy - 2 * u, 6 * u, 4 * u);
    }
    if (o.emergency) {
      const [ex, ey] = P(o.emergency.x * T, o.emergency.y * T);
      g.fillStyle = '#ff3048'; g.strokeStyle = '#141420'; g.lineWidth = 1.5 * u;
      g.beginPath(); g.arc(ex, ey, 3.2 * u, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    for (const s of o.tasks || []) {
      const [sx, sy] = P(s.x * T, s.y * T);
      const b = Math.sin(t * 5) * 1.2 * u;
      g.fillStyle = '#ffd34d'; g.strokeStyle = '#141420'; g.lineWidth = 1.5 * u;
      g.beginPath(); g.moveTo(sx, sy - 6 * u + b); g.lineTo(sx + 4 * u, sy + b); g.lineTo(sx, sy + 6 * u + b); g.lineTo(sx - 4 * u, sy + b); g.closePath(); g.fill(); g.stroke();
    }
    for (const s of o.fixes || []) {
      const [sx, sy] = P(s.x * T, s.y * T);
      const pr = (t * 1.6) % 1;
      g.strokeStyle = `rgba(255,48,72,${1 - pr})`; g.lineWidth = 2 * u;
      g.beginPath(); g.arc(sx, sy, (4 + pr * 10) * u, 0, Math.PI * 2); g.stroke();
      g.fillStyle = Math.sin(t * 8) > 0 ? '#ff3048' : '#ffffff';
      g.beginPath(); g.arc(sx, sy, 3.5 * u, 0, Math.PI * 2); g.fill();
    }
    if (o.me) {
      const [mx, my] = P(o.me.x, o.me.y);
      if (o.view) {
        const vw = (o.view.w / T) * k, vh = (o.view.h / T) * k;
        g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.2 * u;
        g.strokeRect(mx - vw / 2, my - vh / 2, vw, vh);
      }
      const c = S.COLORS[o.me.color] || S.COLORS[0];
      const pr = (t * 1.2) % 1;
      g.strokeStyle = `rgba(255,255,255,${0.8 - pr * 0.8})`; g.lineWidth = 2 * u;
      g.beginPath(); g.arc(mx, my, (5 + pr * 9) * u, 0, Math.PI * 2); g.stroke();
      g.fillStyle = c.body; g.strokeStyle = '#ffffff'; g.lineWidth = 2 * u;
      g.beginPath(); g.arc(mx, my, 4.5 * u, 0, Math.PI * 2); g.fill(); g.stroke();
    }
  }

  // state: { map, camX, camY, players: [{x,y,color,f,moving,name,host,conn}] }
  let lastFrameT = 0;
  function frame(state) {
    const t = performance.now() / 1000;
    const dt = Math.min(0.1, lastFrameT ? t - lastFrameT : 0.016);
    lastFrameT = t;
    stepParts(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground(state.map, state.camX, state.camY);
    if (!state.map) { drawMenu(t, dt); return; }

    const sc = worldScale();
    ctx.save();
    ctx.translate(cssW / 2, cssH / 2);
    ctx.scale(sc, sc);
    ctx.translate(-state.camX, -state.camY);

    const halfW = cssW / 2 / sc, halfH = cssH / 2 / sc;
    const x0 = Math.floor((state.camX - halfW) / T) - 1, x1 = Math.ceil((state.camX + halfW) / T) + 1;
    const y0 = Math.floor((state.camY - halfH) / T) - 1, y1 = Math.ceil((state.camY + halfH) / T) + 1;

    drawMap(state.map, x0, y0, x1, y1);
    drawRoomLights(state.map, x0, y0, x1, y1, t);
    drawWallDetails(state.map, x0, y0, x1, y1, t);
    drawRoomLabels(state.map, x0, y0, x1, y1);
    const view = { x0: state.camX - halfW - 120, x1: state.camX + halfW + 120, y0: state.camY - halfH - 120, y1: state.camY + halfH + 120 };
    drawDecor(state.map, view);
    drawStations(state.map, state, view);

    for (const b of state.bodies || []) drawBody(b.x, b.y, b.color);

    const list = state.players.filter((p) => inView(view, p.x, p.y)).sort((a, b) => a.y - b.y);
    // Polvito a los pies de quien camina
    for (const p of list) {
      if (!p.moving || p.ghost) continue;
      const lt = lastDust.get(p.id) || 0;
      if (t - lt > 0.16) { lastDust.set(p.id, t); burst(p.x, p.y + S.PLAYER_RADIUS * 0.95, 'dust'); }
    }
    drawParts('low');
    for (const p of list) drawCrew(p.x, p.y, p.color, p.f, p.moving, t + p.id * 0.37, p.ghost ? 0.45 : p.conn ? 1 : 0.55);
    for (const p of list) drawName(p.x, p.y, p.name, p.host, !p.conn, p.nameColor);
    drawParts('high');

    ctx.restore();
    if (state.map.theme === 'ice') drawBlizzard();
    if (state.vision) drawVision(state.vision * (state.flicker ? 1 + Math.sin(t * 23) * 0.03 + Math.sin(t * 7) * 0.04 : 1), sc);
    else drawVignette();
    if (state.arrows) for (const a of state.arrows) drawArrow(a, state.camX, state.camY, sc);
    if (state.flashUntil && performance.now() < state.flashUntil) {
      ctx.fillStyle = `rgba(255,30,50,${((state.flashUntil - performance.now()) / 400) * 0.45})`;
      ctx.fillRect(0, 0, cssW, cssH);
    }
    drawJoystick();
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(cssW / 2, cssH / 2, Math.min(cssW, cssH) * 0.45, cssW / 2, cssH / 2, Math.max(cssW, cssH) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,10,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW, cssH);
  }

  // Consolas de tareas, ventilaciones y puntos de arreglo de sabotajes.
  function drawStations(map, state, view) {
    const t = performance.now() / 1000;
    const pend = state.myTasks || new Set();
    for (const v of map.vents || []) {
      const x = v.x * T, y = v.y * T;
      if (!inView(view, x, y)) continue;
      const lit = state.ventIds && state.ventIds.has(v.id);
      if (lit) {
        ctx.fillStyle = `rgba(255,90,106,${0.25 + Math.sin(t * 6) * 0.12})`;
        ctx.beginPath(); ctx.ellipse(x, y, 46, 32, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#3a3f4f'; ctx.strokeStyle = lit ? '#ff5a6a' : OUTLINE; ctx.lineWidth = lit ? 5 : 3;
      roundRect(x - 26, y - 16, 52, 32, 6); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#1d2030'; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = -16; i <= 16; i += 8) { ctx.moveTo(x + i, y - 11); ctx.lineTo(x + i, y + 11); }
      ctx.stroke();
    }
    for (const k of map.tasks || []) {
      const x = k.x * T, y = k.y * T;
      if (!inView(view, x, y)) continue;
      const mine = pend.has(k.id);
      ctx.fillStyle = '#2b3348'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
      roundRect(x - 20, y - 18, 40, 28, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = mine ? '#ffd34d' : '#4fb3ff';
      ctx.fillRect(x - 14, y - 13, 28, 14);
      if (mine) {
        const halo = ctx.createRadialGradient(x, y - 4, 4, x, y - 4, 60);
        halo.addColorStop(0, `rgba(255,211,77,${0.28 + Math.sin(t * 3) * 0.1})`);
        halo.addColorStop(1, 'rgba(255,211,77,0)');
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(x, y - 4, 60, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(255,211,77,${0.55 + Math.sin(t * 5) * 0.35})`;
        ctx.lineWidth = 5;
        roundRect(x - 26, y - 24, 52, 40, 8); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,' + (0.5 + Math.sin(t * 9 + x) * 0.4) + ')';
        ctx.fillRect(x - 14 + ((t * 30) % 24), y - 13, 4, 14);
        ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4;
        ctx.font = 'bold 30px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        const by = y - 28 + Math.sin(t * 4) * 4;
        ctx.strokeText('!', x, by); ctx.fillText('!', x, by);
      }
    }
    const fx = map.fixes || {};
    const sab = state.sabotage;
    const spots = [];
    if (fx.luces) spots.push([fx.luces, sab && sab.kind === 'luces', 'foco']);
    if (fx.reactorA) spots.push([fx.reactorA, sab && sab.kind === 'reactor', 'mano']);
    if (fx.reactorB) spots.push([fx.reactorB, sab && sab.kind === 'reactor', 'mano']);
    for (const [s, active, icon] of spots) {
      const x = s.x * T, y = s.y * T;
      ctx.fillStyle = active ? (Math.sin(t * 8) > 0 ? '#ff3048' : '#7a1020') : '#3b4258';
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
      roundRect(x - 20, y - 20, 40, 40, 8); ctx.fill(); ctx.stroke();
      const im = window.Icons && Icons.img(icon);
      if (im && im.complete) ctx.drawImage(im, x - 15, y - 15, 30, 30);
    }
  }

  // Flecha en el borde de la pantalla que apunta a un punto del mapa.
  function drawArrow(a, camX, camY, sc) {
    const dx = (a.x - camX) * sc, dy = (a.y - camY) * sc;
    const hw = cssW / 2 - 40, hh = cssH / 2 - 40;
    if (Math.abs(dx) < hw && Math.abs(dy) < hh) return; // ya se ve en pantalla
    const k = Math.min(hw / Math.abs(dx || 1e-6), hh / Math.abs(dy || 1e-6));
    const x = cssW / 2 + dx * k, y = cssH / 2 + dy * k;
    const ang = Math.atan2(dy, dx);
    const bob = Math.sin(performance.now() / 120) * 5;
    ctx.save();
    ctx.translate(x - Math.cos(ang) * bob, y - Math.sin(ang) * bob);
    ctx.rotate(ang);
    ctx.scale(1.25, 1.25);
    ctx.fillStyle = a.color || '#ff3048';
    ctx.strokeStyle = '#141420';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-12, -14); ctx.lineTo(-6, 0); ctx.lineTo(-12, 14); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // Cuerpo: tripulante tendido de lado con ojos en X y un charquito.
  function drawBody(x, y, colorIdx) {
    ctx.save();
    ctx.fillStyle = 'rgba(150,0,20,0.55)';
    ctx.beginPath(); ctx.ellipse(x + 4, y + 14, 34, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(x, y + 6);
    ctx.rotate(Math.PI / 2);
    drawCrew(0, 0, colorIdx, 1, false, 0, 1, true);
    ctx.restore();
  }

  // Oscuridad fuera del radio de visión (en píxeles de pantalla).
  function drawVision(radiusWorld, sc) {
    const r = radiusWorld * sc;
    const cx = cssW / 2, cy = cssH / 2;
    const g = ctx.createRadialGradient(cx, cy, r * 0.75, cx, cy, r);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(2,3,8,0.97)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW, cssH);
  }

  // Pantalla de expulsión: el expulsado flota por el espacio dando vueltas.
  function ejectFrame(colorIdx, progress) {
    const t = performance.now() / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawStars(t * 400, t * 30);
    // Planeta al fondo y estelas de velocidad
    const px = cssW * 0.82, py = cssH * 0.25, pr = Math.min(cssW, cssH) * 0.16;
    const pg = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
    pg.addColorStop(0, '#7fa8ff'); pg.addColorStop(1, '#23306e');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(200,220,255,0.35)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(px, py, pr * 1.6, pr * 0.35, -0.3, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const s = stars[i];
      const len = 60 + s.r * 60;
      const x = cssW + len - ((s.x * 3 + t * 900) % (cssW + len * 2)) - len;
      const y = (s.y * 0.37) % cssH;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
    }
    if (colorIdx == null) return;
    const x = -60 + (cssW + 120) * progress;
    const y = cssH * 0.62 + Math.sin(progress * 6) * 12;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(progress * Math.PI * 5);
    const s = Math.min(cssW, cssH) / 160;
    ctx.scale(s, s);
    drawCrew(0, 0, colorIdx, 1, false, t, 1);
    ctx.restore();
  }

  // Dibuja un tripulante en otro canvas (tarjetas de votación, carteles).
  function crewOn(canvas2, colorIdx, opts) {
    opts = opts || {};
    const prev = ctx;
    ctx = canvas2.getContext('2d');
    const w = canvas2.width, h = canvas2.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const s = (h / (S.PLAYER_RADIUS * 3.2)) * (opts.scale || 1);
    ctx.translate(opts.x != null ? opts.x : w / 2, h * 0.58);
    ctx.scale(s, s);
    drawCrew(0, 0, colorIdx, opts.f || 1, false, performance.now() / 1000, opts.alpha == null ? 1 : opts.alpha, opts.dead);
    ctx = prev;
  }

  // Varios tripulantes en fila en un canvas.
  function crewRow(canvas2, colors) {
    const c2 = canvas2.getContext('2d');
    c2.setTransform(1, 0, 0, 1, 0, 0);
    c2.clearRect(0, 0, canvas2.width, canvas2.height);
    const prev = ctx;
    ctx = c2;
    const n = colors.length, w = canvas2.width, h = canvas2.height;
    const gap = Math.min(110, w / Math.max(n, 1));
    const s = h / (S.PLAYER_RADIUS * 3.4);
    colors.forEach((c, i) => {
      ctx.save();
      ctx.translate(w / 2 + (i - (n - 1) / 2) * gap, h * 0.6);
      ctx.scale(s, s);
      drawCrew(0, 0, c, i < n / 2 ? 1 : -1, false, performance.now() / 1000 + i, 1);
      ctx.restore();
    });
    ctx = prev;
  }

  function viewSize() { const sc = worldScale(); return { w: cssW / sc, h: cssH / sc }; }

  return { init, frame, ejectFrame, crewOn, crewRow, worldScale, burst, minimap, viewSize };
})();
