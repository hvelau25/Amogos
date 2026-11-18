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

  // Cuántas unidades de mundo entran en pantalla: ~9.5 casillas de alto en celular (antes 7.5; se pidió vista más amplia).
  function worldScale() {
    return Math.min(cssH / (9.5 * T), cssW / (17 * T));
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
      case 'campanel': { // panel de cámaras: escritorio con 4 pantallitas
        shadowEllipse(x, y + 20, 40, 8);
        ctx.fillStyle = '#3b4258'; roundRect(x - 38, y - 6, 76, 26, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#20263a'; roundRect(x - 36, y - 34, 72, 32, 5); ctx.fill(); ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const sx = x - 32 + (i % 2) * 33, sy = y - 31 + Math.floor(i / 2) * 14;
          ctx.fillStyle = `rgba(110,230,170,${0.55 + Math.sin(now * 3 + i * 1.7) * 0.2})`;
          ctx.fillRect(sx, sy, 30, 12);
        }
        ctx.fillStyle = '#ffd34d'; ctx.fillRect(x - 24, y + 6, 10, 5); ctx.fillStyle = '#ff5a6a'; ctx.fillRect(x + 14, y + 6, 10, 5);
        break;
      }
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
  // Objetos al ras del piso (núcleo del reactor): siempre debajo de todo.
  const FLAT = { core: 1 };
  function drawDecor(map, v) {
    const now = performance.now() / 1000;
    for (const d of map.decor || []) if (FLAT[d.t] && inView(v, d.x * T, d.y * T)) drawItem(d, now);
    if (map.id === 'lobby') {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.font = 'bold 40px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LOBBY', 8 * T, 2.2 * T);
    }
  }
  // Objetos con altura (cajas, camas, mesas...): se ordenan por y junto con los jugadores,
  // así quien está detrás de una caja queda tapado y quien está delante la tapa.
  function decorDrawables(map, v, out) {
    for (const d of map.decor || []) if (!FLAT[d.t] && inView(v, d.x * T, d.y * T)) out.push({ y: d.y * T, d });
    if (map.cameras) {
      const pn = map.cameras.panel;
      if (inView(v, pn.x * T, pn.y * T)) out.push({ y: pn.y * T, d: { t: 'campanel', x: pn.x, y: pn.y } });
    }
    if (map.emergency && inView(v, map.emergency.x * T, map.emergency.y * T)) out.push({ y: map.emergency.y * T + 0.5, emergency: true });
    return out;
  }
  function drawEmergency(map) {
    const now = performance.now() / 1000;
    {
      const ex = map.emergency.x * T, ey = map.emergency.y * T;
      const pr = (now * 0.7) % 1;
      ctx.strokeStyle = `rgba(255,60,80,${0.5 * (1 - pr)})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(ex, ey, 22 + pr * 26, 14 + pr * 17, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#9aa3ad'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(ex, ey, 20, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8263b';
      ctx.beginPath(); ctx.ellipse(ex, ey - 4, 13, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  // Cámaras montadas en la pared de arriba de lo que enfocan. Luz roja parpadeante si alguien está mirando.
  const camSpots = new Map();
  function camDevices(map) {
    let list = camSpots.get(map.id);
    if (list) return list;
    list = [];
    for (const c of (map.cameras && map.cameras.cams) || []) {
      let ty = Math.floor(c.y);
      while (ty > 0 && !S.isSolidTile(map, Math.floor(c.x), ty)) ty--;
      list.push({ x: c.x * T, y: ty * T + T * 0.55 });
    }
    camSpots.set(map.id, list);
    return list;
  }
  function drawCamDevices(map, v, on, t) {
    for (const c of camDevices(map)) {
      if (!inView(v, c.x, c.y)) continue;
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
      ctx.fillStyle = '#c9d3e6'; roundRect(c.x - 16, c.y - 10, 32, 18, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#20263a'; ctx.beginPath(); ctx.arc(c.x, c.y + 8, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const lit = on && Math.sin(t * 6) > -0.2;
      ctx.fillStyle = lit ? '#ff3048' : '#5a2a32';
      ctx.beginPath(); ctx.arc(c.x + 10, c.y - 3, 3.5, 0, Math.PI * 2); ctx.fill();
      if (lit) { ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(c.x + 10, c.y - 3, 10, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
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
  function drawCrew(x, y, colorIdx, facing, moving, t, alpha, dead, look) {
    const c = S.COLORS[colorIdx] || S.COLORS[0];
    const r = S.PLAYER_RADIUS;
    const f = facing === -1 ? -1 : 1;
    const step = moving ? Math.sin(t * 14) : 0;
    const bob = moving ? -Math.abs(Math.sin(t * 14)) * 3 : Math.sin(t * 2) * 0.8;
    const hat = (look && look.hat) || 0, outfit = (look && look.outfit) || 0;

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
    if (outfit) drawOutfitBack(outfit, r, f, t, moving);

    // Piernas
    for (const side of [-1, 1]) {
      const off = side * step * r * 0.18;
      ctx.fillStyle = c.dark;
      roundRect(side * r * 0.42 - r * 0.28, r * 0.5 + off * 0.3, r * 0.56, r * 0.5 - off * 0.3, r * 0.2);
      ctx.fill(); ctx.stroke();
    }

    // Cuerpo
    const kit = outfit >= S.JERSEY_FIRST ? S.JERSEYS[outfit - S.JERSEY_FIRST] : null;
    ctx.fillStyle = c.body;
    roundRect(-r * 0.88, -r * 0.55, r * 1.76, r * 1.3, r * 0.6);
    ctx.fill();
    if (kit) { drawJersey(kit, r, f, c); roundRect(-r * 0.88, -r * 0.55, r * 1.76, r * 1.3, r * 0.6); }
    ctx.stroke();
    if (!kit) {
      // Cinturón y hebilla
      ctx.fillStyle = c.dark;
      ctx.fillRect(-r * 0.82, r * 0.3, r * 1.64, r * 0.18);
      ctx.fillStyle = '#ffd34d';
      ctx.fillRect(f * r * 0.25 - r * 0.1, r * 0.28, r * 0.2, r * 0.22);
    }
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

    if (outfit) drawOutfitFront(outfit, r, f);
    if (hat) drawHat(hat, r, f, t);
    ctx.restore();
  }

  // ---------- Jerseys (Liga MX): torso con el patrón del equipo; abajo queda el short del color del jugador ----------
  const JERSEY_BOTTOM = 0.56; // en radios: hasta dónde baja la playera (el casco tapa la parte de arriba)
  function drawJersey(k, r, f, c) {
    const x0 = -r * 0.88, x1 = r * 0.88, y0 = -r * 0.55, y1 = r * JERSEY_BOTTOM, w = x1 - x0, h = y1 - y0;
    ctx.save();
    roundRect(x0, y0, w, r * 1.3, r * 0.6); ctx.clip();
    ctx.fillStyle = k.base; ctx.fillRect(x0, y0, w, h);
    ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip(); // el patrón no baja al short
    const pc = k.pc;
    switch (k.pat) {
      case 'franjas': { // n franjas del color pc, del mismo ancho que los huecos
        const sw = w / (k.n * 2 + 1);
        ctx.fillStyle = pc;
        for (let i = 0; i < k.n; i++) ctx.fillRect(x0 + sw * (i * 2 + 1), y0, sw, h);
        break;
      }
      case 'mitades':
        ctx.fillStyle = pc; ctx.fillRect(0, y0, x1, h);
        break;
      case 'banda': // diagonal del hombro a la cadera
        ctx.fillStyle = pc;
        ctx.beginPath(); ctx.moveTo(x0, y0 + h * 0.05); ctx.lineTo(x0 + w * 0.32, y0); ctx.lineTo(x1, y1 - h * 0.15); ctx.lineTo(x1 - w * 0.32, y1 + 2); ctx.lineTo(x0, y0 + h * 0.5);
        ctx.closePath(); ctx.fill();
        break;
      case 'aros': // dos franjas horizontales
        ctx.fillStyle = pc;
        for (const yy of [0.3, 0.62]) ctx.fillRect(x0, y0 + h * yy, w, h * 0.13);
        break;
      case 'centro':
        ctx.fillStyle = pc; ctx.fillRect(-r * 0.2, y0, r * 0.4, h);
        break;
      case 'rayos': { // franjas en zigzag (rayos)
        ctx.strokeStyle = pc; ctx.lineWidth = r * 0.13; ctx.lineJoin = 'miter';
        for (const sx of [-0.62, -0.18, 0.26, 0.7]) {
          ctx.beginPath();
          for (let i = 0; i <= 6; i++) ctx[i ? 'lineTo' : 'moveTo'](r * (sx + (i % 2 ? 0.1 : -0.04)), y0 + (h * i) / 6);
          ctx.stroke();
        }
        break;
      }
      case 'lineas': // rayitas finas verticales
        ctx.strokeStyle = pc; ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = x0 + r * 0.12; x < x1; x += r * 0.2) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
        ctx.stroke();
        break;
      case 'tono': // patrón discreto de rombos en un tono un poco más oscuro
        ctx.fillStyle = 'rgba(0,0,0,0.09)';
        for (let yy = y0 + r * 0.1, row = 0; yy < y1; yy += r * 0.26, row++)
          for (let x = x0 + (row % 2 ? r * 0.13 : 0); x < x1; x += r * 0.26) {
            ctx.beginPath(); ctx.moveTo(x, yy - r * 0.08); ctx.lineTo(x + r * 0.08, yy); ctx.lineTo(x, yy + r * 0.08); ctx.lineTo(x - r * 0.08, yy); ctx.fill();
          }
        break;
      case 'equis': // "X" grande en un tono más oscuro
        ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = r * 0.22;
        ctx.beginPath(); ctx.moveTo(x0 + w * 0.12, y0); ctx.lineTo(x1 - w * 0.12, y1); ctx.moveTo(x1 - w * 0.12, y0); ctx.lineTo(x0 + w * 0.12, y1); ctx.stroke();
        break;
      default:
    }
    // Mangas: los costados de los hombros
    ctx.fillStyle = k.manga;
    for (const s of [-1, 1]) ctx.fillRect(s > 0 ? x1 - r * 0.2 : x0, y0 + h * 0.18, r * 0.2, h * 0.3);
    if (k.filo) { ctx.fillStyle = k.filo; for (const s of [-1, 1]) ctx.fillRect(s > 0 ? x1 - r * 0.2 : x0, y0 + h * 0.48, r * 0.2, h * 0.07); }
    ctx.restore();
    // Cuello: un aro debajo del casco (el casco tapa la parte de adentro)
    ctx.save();
    roundRect(x0, y0, w, r * 1.3, r * 0.6); ctx.clip();
    ctx.strokeStyle = k.cuello; ctx.lineWidth = r * 0.13;
    ctx.beginPath(); ctx.arc(0, -r * 0.62, r * 0.84, 0.12 * Math.PI, 0.88 * Math.PI); ctx.stroke();
    if (k.filo) { ctx.strokeStyle = k.filo; ctx.lineWidth = r * 0.04; ctx.beginPath(); ctx.arc(0, -r * 0.62, r * 0.92, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
    // Borde de la playera sobre el short
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.restore();
  }

  // ---------- Personalización (dibujos propios). Coordenadas relativas al centro del tripulante. ----------
  // Lo que va detrás del cuerpo: capa y mochila.
  function drawOutfitBack(o, r, f, t, moving) {
    ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE;
    if (o === 4) { // capa
      const fl = moving ? Math.sin(t * 12) * r * 0.12 : 0;
      ctx.fillStyle = '#c4243a';
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, -r * 0.25);
      ctx.lineTo(r * 0.7, -r * 0.25);
      ctx.quadraticCurveTo(r * 0.9, r * 0.5, r * 0.75 - f * r * 0.1, r * 1.0);
      ctx.lineTo(-f * r * 1.15 + fl, r * 1.05);
      ctx.quadraticCurveTo(-f * r * 1.1, r * 0.3, -r * 0.7, -r * 0.25);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath(); ctx.arc(-f * r * 0.15, -r * 0.05, r * 0.11, 0, Math.PI * 2); ctx.fill();
    } else if (o === 5) { // mochila
      ctx.fillStyle = '#6f8a3c';
      roundRect(-f * r * 0.88 - (f > 0 ? r * 0.42 : 0), -r * 0.4, r * 0.42, r * 0.95, r * 0.15); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#4e6528';
      roundRect(-f * r * 0.88 - (f > 0 ? r * 0.36 : -r * 0.06), r * 0.05, r * 0.3, r * 0.32, r * 0.08); ctx.fill(); ctx.stroke();
    }
  }
  // Lo que va encima del cuerpo, bajo el casco.
  function drawOutfitFront(o, r, f) {
    ctx.lineWidth = 2.5; ctx.strokeStyle = OUTLINE;
    const nx = f * r * 0.12; // el cuello mira hacia donde camina
    if (o === 1) { // corbata
      ctx.fillStyle = '#2f6fe0';
      ctx.beginPath(); ctx.moveTo(nx - r * 0.15, r * 0.12); ctx.lineTo(nx + r * 0.15, r * 0.12); ctx.lineTo(nx + r * 0.09, r * 0.27); ctx.lineTo(nx - r * 0.09, r * 0.27); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(nx - r * 0.09, r * 0.27); ctx.lineTo(nx + r * 0.09, r * 0.27); ctx.lineTo(nx + r * 0.19, r * 0.72); ctx.lineTo(nx, r * 0.88); ctx.lineTo(nx - r * 0.19, r * 0.72); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(nx - r * 0.12, r * 0.5); ctx.lineTo(nx + r * 0.1, r * 0.4); ctx.moveTo(nx - r * 0.15, r * 0.68); ctx.lineTo(nx + r * 0.14, r * 0.56); ctx.stroke();
    } else if (o === 2) { // moño (amarillo para que se vea sobre cualquier color)
      const by = r * 0.3;
      ctx.fillStyle = '#ffd34d';
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(nx, by); ctx.lineTo(nx + s * r * 0.4, by - r * 0.2); ctx.quadraticCurveTo(nx + s * r * 0.5, by, nx + s * r * 0.4, by + r * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = '#e8263b';
      ctx.beginPath(); ctx.arc(nx, by, r * 0.11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (o === 3) { // bufanda
      ctx.fillStyle = '#f28a1f';
      roundRect(-r * 0.78, r * 0.02, r * 1.56, r * 0.26, r * 0.12); ctx.fill(); ctx.stroke();
      roundRect(-f * r * 0.5 - r * 0.12, r * 0.12, r * 0.24, r * 0.55, r * 0.08); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(-r * 0.4, r * 0.06, r * 0.12, r * 0.18); ctx.fillRect(r * 0.1, r * 0.06, r * 0.12, r * 0.18);
    } else if (o === 6) { // placa (estrella)
      star(-f * r * 0.5, r * 0.2, r * 0.2, '#ffd34d');
    } else if (o === 7) { // tirantes
      // Correa con contorno (trazo grueso negro + trazo de color encima) desde el casco hasta el cinturón
      for (const [col, w] of [[OUTLINE, r * 0.2], ['#3f7be8', r * 0.11]]) {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.46, r * 0.04); ctx.lineTo(s * r * 0.4, r * 0.46); ctx.stroke(); }
      }
      ctx.lineCap = 'butt';
      ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * 0.41, r * 0.4, r * 0.07, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    }
  }
  function star(x, y, rad, fill) {
    ctx.fillStyle = fill; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? rad * 0.45 : rad;
      ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // Sombreros: se apoyan arriba del casco (el casco llega hasta y = -1.4r).
  function drawHat(h, r, f, t) {
    const cx = f * r * 0.04, y0 = -r * 1.22;
    ctx.lineWidth = 3; ctx.strokeStyle = OUTLINE;
    switch (h) {
      case 1: // gorra
        ctx.fillStyle = '#e2453b';
        ctx.beginPath(); ctx.ellipse(cx + f * r * 0.55, y0 + r * 0.04, r * 0.45, r * 0.13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, y0 + r * 0.06, r * 0.62, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx, y0 - r * 0.56, r * 0.09, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      case 2: // vaquero
        ctx.fillStyle = '#9a6a3a';
        ctx.beginPath(); ctx.moveTo(cx - r * 0.48, y0); ctx.lineTo(cx - r * 0.4, y0 - r * 0.62);
        ctx.quadraticCurveTo(cx, y0 - r * 0.42, cx + r * 0.4, y0 - r * 0.62); ctx.lineTo(cx + r * 0.48, y0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#5a3a1e'; ctx.fillRect(cx - r * 0.46, y0 - r * 0.2, r * 0.92, r * 0.13);
        ctx.fillStyle = '#b07c48';
        ctx.beginPath(); ctx.ellipse(cx, y0 + r * 0.02, r * 0.98, r * 0.18, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      case 3: { // corona
        ctx.fillStyle = '#ffcc33';
        const w = r * 0.5;
        ctx.beginPath(); ctx.moveTo(cx - w, y0 + r * 0.05); ctx.lineTo(cx - w, y0 - r * 0.42); ctx.lineTo(cx - w * 0.5, y0 - r * 0.18);
        ctx.lineTo(cx, y0 - r * 0.55); ctx.lineTo(cx + w * 0.5, y0 - r * 0.18); ctx.lineTo(cx + w, y0 - r * 0.42); ctx.lineTo(cx + w, y0 + r * 0.05); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e8263b'; ctx.beginPath(); ctx.arc(cx, y0 - r * 0.08, r * 0.09, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3fd6e0'; ctx.beginPath(); ctx.arc(cx - w * 0.6, y0 - r * 0.06, r * 0.06, 0, Math.PI * 2); ctx.arc(cx + w * 0.6, y0 - r * 0.06, r * 0.06, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 4: // gorro de fiesta
        ctx.fillStyle = '#8a4fd8';
        ctx.beginPath(); ctx.moveTo(cx - r * 0.38, y0 + r * 0.05); ctx.lineTo(cx - f * r * 0.08, y0 - r * 0.95); ctx.lineTo(cx + r * 0.38, y0 + r * 0.05); ctx.closePath(); ctx.fill();
        ctx.save(); ctx.clip();
        ctx.fillStyle = '#ffd34d';
        for (let i = 0; i < 3; i++) ctx.fillRect(cx - r, y0 - r * (0.15 + i * 0.3), r * 2, r * 0.1);
        ctx.restore(); ctx.stroke();
        ctx.fillStyle = '#ef6fbf'; ctx.beginPath(); ctx.arc(cx - f * r * 0.08, y0 - r * 0.97, r * 0.14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      case 5: // gorro de lana
        ctx.fillStyle = '#2fae55';
        ctx.beginPath(); ctx.arc(cx, y0 + r * 0.04, r * 0.6, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e8edf2'; roundRect(cx - r * 0.66, y0 - r * 0.08, r * 1.32, r * 0.22, r * 0.1); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, y0 - r * 0.62, r * 0.17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      case 6: // chef
        // Bollitos: primero el contorno grueso y luego el relleno, así no quedan líneas por dentro.
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.02, y0 - r * 0.48); ctx.arc(cx - r * 0.28, y0 - r * 0.48, r * 0.26, 0, Math.PI * 2);
        ctx.moveTo(cx + r * 0.54, y0 - r * 0.48); ctx.arc(cx + r * 0.28, y0 - r * 0.48, r * 0.26, 0, Math.PI * 2);
        ctx.moveTo(cx + r * 0.3, y0 - r * 0.7); ctx.arc(cx, y0 - r * 0.7, r * 0.3, 0, Math.PI * 2);
        ctx.rect(cx - r * 0.36, y0 - r * 0.5, r * 0.72, r * 0.3);
        ctx.lineWidth = 6; ctx.stroke(); ctx.fill();
        ctx.lineWidth = 3;
        roundRect(cx - r * 0.4, y0 - r * 0.28, r * 0.8, r * 0.32, r * 0.06); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2;
        for (const dx of [-0.18, 0.18]) { ctx.beginPath(); ctx.moveTo(cx + dx * r, y0 - r * 0.24); ctx.lineTo(cx + dx * r, y0); ctx.stroke(); }
        break;
      case 7: { // brote
        const sw = Math.sin(t * 2.2) * 0.12;
        ctx.save(); ctx.translate(cx, y0 + r * 0.05); ctx.rotate(sw);
        ctx.strokeStyle = '#2b6b2f'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(r * 0.08, -r * 0.3, 0, -r * 0.55); ctx.stroke();
        ctx.fillStyle = '#5fd06a'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(-r * 0.24, -r * 0.6, r * 0.26, r * 0.13, -0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(r * 0.24, -r * 0.62, r * 0.26, r * 0.13, 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
        break;
      }
      case 8: { // audífonos
        const hy = -r * 0.62;
        ctx.strokeStyle = OUTLINE; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.arc(0, hy, r * 0.86, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
        ctx.strokeStyle = '#3b3f4a'; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.arc(0, hy, r * 0.86, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
        ctx.fillStyle = '#ef6fbf'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
        for (const s of [-1, 1]) { roundRect(s * r * 0.8 - r * 0.16, hy - r * 0.3, r * 0.32, r * 0.5, r * 0.12); ctx.fill(); ctx.stroke(); }
        break;
      }
      case 9: // cuernos
        ctx.fillStyle = '#e23b3b';
        for (const s of [-1, 1]) { // cono curvo con base ancha, la punta hacia afuera
          ctx.beginPath(); ctx.moveTo(cx + s * r * 0.12, y0 + r * 0.12);
          ctx.quadraticCurveTo(cx + s * r * 0.2, y0 - r * 0.3, cx + s * r * 0.72, y0 - r * 0.38);
          ctx.quadraticCurveTo(cx + s * r * 0.58, y0 - r * 0.12, cx + s * r * 0.6, y0 + r * 0.14);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(cx + s * r * 0.28, y0 - r * 0.04); ctx.quadraticCurveTo(cx + s * r * 0.34, y0 - r * 0.22, cx + s * r * 0.56, y0 - r * 0.3); ctx.stroke();
          ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
        }
        break;
      case 10: { // aureola
        const fy = y0 - r * 0.45 + Math.sin(t * 2.5) * r * 0.06;
        ctx.strokeStyle = 'rgba(255,230,120,0.45)'; ctx.lineWidth = 9;
        ctx.beginPath(); ctx.ellipse(cx, fy, r * 0.5, r * 0.15, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(cx, fy, r * 0.5, r * 0.15, 0, 0, Math.PI * 2); ctx.stroke();
        break;
      }
      case 11: // copa
        ctx.fillStyle = '#26262e';
        roundRect(cx - r * 0.38, y0 - r * 0.85, r * 0.76, r * 0.88, r * 0.06); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#c4243a'; ctx.fillRect(cx - r * 0.36, y0 - r * 0.24, r * 0.72, r * 0.14);
        ctx.fillStyle = '#26262e';
        ctx.beginPath(); ctx.ellipse(cx, y0 + r * 0.04, r * 0.64, r * 0.14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      case 12: { // flor
        const fx = cx + f * r * 0.4, fy = y0 + r * 0.02;
        ctx.fillStyle = '#ff8ac0'; ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + t * 0.3;
          ctx.beginPath(); ctx.arc(fx + Math.cos(a) * r * 0.19, fy + Math.sin(a) * r * 0.19, r * 0.14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(fx, fy, r * 0.12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        break;
      }
      default:
    }
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
    drawCamDevices(state.map, view, state.camsOn, t);
    drawStations(state.map, state, view);

    // Visión: las paredes tapan. Fuera del polígono visible no se dibuja a nadie (ni cuerpos).
    const eye = state.eye || { x: state.camX, y: state.camY };
    const vr = state.vision ? state.vision * (state.flicker ? 1 + Math.sin(t * 23) * 0.03 + Math.sin(t * 7) * 0.04 : 1) : 0;
    const seen = (x, y) => !vr || (Math.hypot(x - eye.x, y - eye.y) <= vr &&
      (S.lineOfSight(state.map, eye.x, eye.y, x, y) || S.lineOfSight(state.map, eye.x, eye.y, x, y - S.PLAYER_RADIUS * 1.2)));

    for (const b of state.bodies || []) if (seen(b.x, b.y)) drawBody(b.x, b.y, b.color, b);

    const list = state.players.filter((p) => inView(view, p.x, p.y) && (p.id === state.meId || seen(p.x, p.y)));
    // Polvito a los pies de quien camina
    for (const p of list) {
      if (!p.moving || p.ghost) continue;
      const lt = lastDust.get(p.id) || 0;
      if (t - lt > 0.16) { lastDust.set(p.id, t); burst(p.x, p.y + S.PLAYER_RADIUS * 0.95, 'dust'); }
    }
    drawParts('low');
    // Jugadores y objetos con altura, ordenados por y (profundidad)
    const items = decorDrawables(state.map, view, list.map((p) => ({ y: p.y, p })));
    items.sort((a, b) => a.y - b.y);
    const now = t;
    for (const it of items) {
      if (it.p) { const p = it.p; drawCrew(p.x, p.y, p.color, p.f, p.moving, t + p.id * 0.37, p.ghost ? 0.45 : p.conn ? 1 : 0.55, false, p); }
      else if (it.emergency) drawEmergency(state.map);
      else { ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4; drawItem(it.d, now); }
    }
    for (const p of list) drawName(p.x, p.y, p.name, p.host, !p.conn, p.nameColor);
    drawParts('high');

    ctx.restore();
    if (state.map.theme === 'ice') drawBlizzard();
    if (vr) drawShadow(state.map, eye, vr, state.camX, state.camY, sc);
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
  function drawBody(x, y, colorIdx, look) {
    ctx.save();
    ctx.fillStyle = 'rgba(150,0,20,0.55)';
    ctx.beginPath(); ctx.ellipse(x + 4, y + 14, 34, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(x, y + 6);
    ctx.rotate(Math.PI / 2);
    drawCrew(0, 0, colorIdx, 1, false, 0, 1, true, look);
    ctx.restore();
  }

  // ---------- Visión tapada por paredes ----------
  // Polígono de lo que se ve desde el ojo: rayos hacia cada esquina de pared cercana (y un círculo de rayos).
  // Cada rayo entra un poco en la pared que toca, para que se vea la cara de la pared, pero no lo de atrás.
  function visionPolygon(map, ex, ey, R) {
    const angs = [];
    for (let i = 0; i < 64; i++) angs.push((i / 64) * Math.PI * 2 - Math.PI); // mismo rango que atan2
    const tx0 = Math.floor((ex - R) / T), tx1 = Math.floor((ex + R) / T);
    const ty0 = Math.floor((ey - R) / T), ty1 = Math.floor((ey + R) / T);
    const solid = (x, y) => S.isSolidTile(map, x, y);
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        if (!solid(tx, ty)) continue;
        if (solid(tx - 1, ty) && solid(tx + 1, ty) && solid(tx, ty - 1) && solid(tx, ty + 1)) continue; // pared interior
        for (const [cx, cy] of [[tx, ty], [tx + 1, ty], [tx, ty + 1], [tx + 1, ty + 1]]) {
          const a = Math.atan2(cy * T - ey, cx * T - ex);
          angs.push(a - 0.0008, a + 0.0008);
        }
      }
    angs.sort((a, b) => a - b);
    const pts = [];
    const DEEP = T * 0.8;
    let la = -99;
    for (const a of angs) {
      if (a - la < 0.0004) continue;
      la = a;
      const ux = Math.cos(a), uy = Math.sin(a);
      let d = S.rayDist(map, ex, ey, ux, uy, R);
      if (d < R) {
        // Entrar en la pared hasta DEEP, sin pasar a un piso del otro lado
        const end = Math.min(R, d + DEEP);
        let k = d + 2;
        while (k < end && solid(Math.floor((ex + ux * k) / T), Math.floor((ey + uy * k) / T))) k += 4;
        d = Math.min(k, end);
      }
      pts.push(ex + ux * d, ey + uy * d);
    }
    return pts;
  }

  // El polígono se guarda y solo se recalcula si el ojo se movió o el radio creció. Se calcula con un
  // radio un poco mayor: lo que queda más allá de R ya está a oscuridad completa, así que se ve igual
  // (y el parpadeo de luces apagadas no obliga a recalcular cada cuadro).
  const visCache = { map: null, x: NaN, y: NaN, R: 0, pts: null };
  function cachedVision(map, ex, ey, R) {
    const x = Math.round(ex), y = Math.round(ey);
    if (visCache.map !== map || visCache.x !== x || visCache.y !== y || visCache.R < R) {
      visCache.map = map; visCache.x = x; visCache.y = y;
      visCache.R = Math.ceil((R * 1.1) / 16) * 16;
      visCache.pts = visionPolygon(map, x, y, visCache.R);
    }
    return visCache.pts;
  }

  // Sombra directo en el canvas principal (sin capa aparte, que obligaba a pintar dos veces):
  // 1) todo fuera del polígono, oscuro; 2) dentro del polígono, un degradado que oscurece el borde.
  const SHADOW = 'rgba(3,4,10,0.9)';
  function drawShadow(map, eye, R, camX, camY, sc) {
    const pts = cachedVision(map, eye.x, eye.y, R);
    const ox = cssW / 2 - camX * sc, oy = cssH / 2 - camY * sc;
    const cx = eye.x * sc + ox, cy = eye.y * sc + oy, rr = R * sc;
    const poly = () => {
      ctx.moveTo(pts[0] * sc + ox, pts[1] * sc + oy);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * sc + ox, pts[i + 1] * sc + oy);
      ctx.closePath();
    };
    ctx.save();
    ctx.fillStyle = SHADOW;
    ctx.beginPath(); ctx.rect(0, 0, cssW, cssH); poly();
    ctx.fill('evenodd');
    ctx.beginPath(); poly(); ctx.clip();
    const grad = ctx.createRadialGradient(cx, cy, rr * 0.72, cx, cy, rr);
    grad.addColorStop(0, 'rgba(3,4,10,0)');
    grad.addColorStop(1, SHADOW);
    ctx.fillStyle = grad;
    const ext = visCache.R * sc + 2; // cubre todo el polígono guardado
    ctx.fillRect(cx - ext, cy - ext, ext * 2, ext * 2);
    ctx.restore();
  }

  // Centro de cada vista: el promedio del piso caminable alrededor de la cámara, para que no se
  // vea media pantalla de pared o vacío (las cámaras están en pasillos). Se calcula una vez.
  const camCenters = new Map();
  function camCenter(map, cam) {
    const key = map.id + ':' + cam.id;
    let c = camCenters.get(key);
    if (c) return c;
    let sx = 0, sy = 0, n = 0;
    for (let ty = Math.floor(cam.y - 3); ty <= Math.floor(cam.y + 3); ty++)
      for (let tx = Math.floor(cam.x - 4.5); tx <= Math.floor(cam.x + 4.5); tx++)
        if (!S.isSolidTile(map, tx, ty)) { sx += tx + 0.5; sy += ty + 0.5; n++; }
    const mx = n ? sx / n : cam.x, my = n ? sy / n : cam.y;
    // Sin alejarse demasiado de la cámara
    c = { x: (cam.x + Math.max(-2, Math.min(2, mx - cam.x))) * T, y: (cam.y + Math.max(-1.2, Math.min(1.2, my - cam.y))) * T };
    camCenters.set(key, c);
    return c;
  }

  // ---------- Cámaras de seguridad: una vista del mundo en otro canvas ----------
  // o: { map, cam:{x,y,name}, players, bodies, camsOn, dpr }
  function cameraFeed(cv, o) {
    const prev = ctx;
    ctx = cv.getContext('2d');
    const w = cv.width, h = cv.height, t = performance.now() / 1000;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05070f'; ctx.fillRect(0, 0, w, h);
    const sc = Math.min(w / (7.5 * T), h / (4.6 * T));
    const { x: camX, y: camY } = camCenter(o.map, o.cam);
    ctx.save();
    ctx.translate(w / 2, h / 2); ctx.scale(sc, sc); ctx.translate(-camX, -camY);
    const hw = w / 2 / sc, hh = h / 2 / sc;
    const x0 = Math.floor((camX - hw) / T) - 1, x1 = Math.ceil((camX + hw) / T) + 1;
    const y0 = Math.floor((camY - hh) / T) - 1, y1 = Math.ceil((camY + hh) / T) + 1;
    const view = { x0: camX - hw - 80, x1: camX + hw + 80, y0: camY - hh - 80, y1: camY + hh + 80 };
    drawMap(o.map, x0, y0, x1, y1);
    drawRoomLights(o.map, x0, y0, x1, y1, t);
    drawRoomLabels(o.map, x0, y0, x1, y1);
    drawDecor(o.map, view);
    drawCamDevices(o.map, view, o.camsOn, t);
    drawStations(o.map, {}, view);
    for (const b of o.bodies || []) if (inView(view, b.x, b.y)) drawBody(b.x, b.y, b.color, b);
    const list = o.players.filter((p) => inView(view, p.x, p.y));
    const items = decorDrawables(o.map, view, list.map((p) => ({ y: p.y, p })));
    items.sort((a, b) => a.y - b.y);
    for (const it of items) {
      if (it.p) { const p = it.p; drawCrew(p.x, p.y, p.color, p.f, p.moving, t + p.id * 0.37, 1, false, p); }
      else if (it.emergency) drawEmergency(o.map);
      else { ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4; drawItem(it.d, t); }
    }
    for (const p of list) drawName(p.x, p.y, p.name, false, false, null);
    ctx.restore();
    // Rayas de monitor, nombre y "REC"
    const dp = o.dpr || 1;
    ctx.fillStyle = 'rgba(120,255,180,0.06)';
    for (let y = (t * 30 * dp) % (4 * dp); y < h; y += 4 * dp) ctx.fillRect(0, y, w, dp);
    ctx.font = `${Math.round(13 * dp)}px "Luckiest Guy", system-ui, sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.lineJoin = 'round';
    ctx.lineWidth = 4 * dp; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.fillStyle = '#ffffff';
    const label = o.cam.name.toUpperCase();
    ctx.strokeText(label, 8 * dp, 7 * dp); ctx.fillText(label, 8 * dp, 7 * dp);
    if (Math.sin(t * 4) > 0) {
      ctx.fillStyle = '#ff3048';
      ctx.beginPath(); ctx.arc(w - 14 * dp, 14 * dp, 5 * dp, 0, Math.PI * 2); ctx.fill();
    }
    ctx = prev;
  }

  // Pantalla de expulsión: el expulsado flota por el espacio dando vueltas.
  function ejectFrame(colorIdx, progress, look) {
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
    drawCrew(0, 0, colorIdx, 1, false, t, 1, false, look);
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
    drawCrew(0, 0, colorIdx, opts.f || 1, false, performance.now() / 1000, opts.alpha == null ? 1 : opts.alpha, opts.dead, opts.look);
    ctx = prev;
  }

  // Varios tripulantes en fila en un canvas. Cada uno: índice de color o { color, hat, outfit }.
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
      drawCrew(0, 0, typeof c === 'object' ? c.color : c, i < n / 2 ? 1 : -1, false, performance.now() / 1000 + i, 1, false, typeof c === 'object' ? c : null);
      ctx.restore();
    });
    ctx = prev;
  }

  // ---------- Escena de muerte: lo que ve la víctima (animaciones propias) ----------
  // o: { kind: 0-3, killer: {color,hat,outfit}, victim: {...} }. t = segundos desde el inicio.
  // Es una función pura del tiempo: no guarda estado, así cada cuadro se dibuja desde cero.
  const KILL_KINDS = ['cuchillo', 'mordida', 'rayo', 'llave'];
  const KILL_LEN = 2.7; // duración total (main.js la usa para cerrar)
  const KW = 600, KH = 280, KFY = 236, KK = 2.5; // tamaño lógico, línea del piso y escala de los monitos
  const cl01 = (v) => Math.max(0, Math.min(1, v));
  const seg = (t, a, b) => cl01((t - a) / (b - a)); // avance 0..1 entre a y b
  const eo = (p) => 1 - (1 - p) * (1 - p) * (1 - p); // ease-out
  const ei = (p) => p * p * p; // ease-in
  const lerp = (a, b, p) => a + (b - a) * p;
  let ksBuf = null;

  // Monito parado con los pies en (x, footY); rot/sx/sy giran o aplastan desde los pies.
  function ksCrew(x, footY, look, f, t, o) {
    o = o || {};
    const R = S.PLAYER_RADIUS;
    ctx.save();
    ctx.translate(x, footY);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(KK * (o.sx || 1), KK * (o.sy || 1));
    ctx.translate(0, -R);
    drawCrew(0, 0, look.color, f, !!o.moving, t, o.alpha == null ? 1 : o.alpha, !!o.dead, look);
    ctx.restore();
  }
  // El mismo monito, pero de un solo color (carbonizado o rayos X), dibujado en una capa aparte.
  function ksTinted(x, footY, look, f, t, color, o, bs) {
    const BW = 240, BH = 260;
    if (!ksBuf) ksBuf = document.createElement('canvas');
    if (ksBuf.width !== Math.round(BW * bs)) { ksBuf.width = Math.round(BW * bs); ksBuf.height = Math.round(BH * bs); }
    const b = ksBuf.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, ksBuf.width, ksBuf.height);
    b.setTransform(bs, 0, 0, bs, 0, 0);
    const prev = ctx; ctx = b;
    ksCrew(120, 230, look, f, t, { dead: true });
    b.globalCompositeOperation = 'source-atop'; b.fillStyle = color; b.fillRect(0, 0, BW, BH);
    b.globalCompositeOperation = 'source-over';
    if (o.bones) { // esqueleto de caricatura
      const R = S.PLAYER_RADIUS * KK, cx = 120, cy = 230 - R;
      b.fillStyle = '#ffffff'; b.strokeStyle = '#ffffff'; b.lineCap = 'round';
      b.beginPath(); b.arc(cx, cy - R * 0.66, R * 0.5, 0, Math.PI * 2); b.fill();
      b.fillRect(cx - R * 0.28, cy - R * 0.3, R * 0.56, R * 0.2);
      b.fillStyle = '#0a3a4a';
      for (const s of [-1, 1]) { b.beginPath(); b.arc(cx + s * R * 0.2, cy - R * 0.7, R * 0.13, 0, Math.PI * 2); b.fill(); }
      b.lineWidth = R * 0.12; b.beginPath(); b.moveTo(cx, cy - R * 0.08); b.lineTo(cx, cy + R * 0.55); b.stroke();
      b.lineWidth = R * 0.09;
      for (let i = 0; i < 3; i++) { const yy = cy + R * (0.02 + i * 0.17); b.beginPath(); b.moveTo(cx - R * 0.55, yy + R * 0.06); b.quadraticCurveTo(cx, yy - R * 0.08, cx + R * 0.55, yy + R * 0.06); b.stroke(); }
    }
    ctx = prev;
    ctx.save();
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.translate(x, footY); ctx.scale(o.sx || 1, o.sy || 1);
    ctx.drawImage(ksBuf, -120, -230, BW, BH);
    ctx.restore();
  }
  // Globo de cómic con la onomatopeya
  function ksBurst(x, y, text, t, t0) {
    if (t < t0) return;
    const d = t - t0;
    const s = d < 0.16 ? lerp(0.2, 1.18, d / 0.16) : d < 0.3 ? lerp(1.18, 1, (d - 0.16) / 0.14) : 1 + Math.sin(d * 9) * 0.025;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(-0.12); ctx.scale(s, s);
    ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2, rr = i % 2 ? 46 : 66;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr * 1.45, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffd34d'; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = OUTLINE; ctx.stroke();
    ctx.font = '44px "Luckiest Guy", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 9; ctx.strokeText(text, 0, 4);
    ctx.fillStyle = '#ff3048'; ctx.fillText(text, 0, 4);
    ctx.restore();
  }
  // Gotitas que salen disparadas de un punto (deterministas: dependen solo del tiempo)
  function ksDrops(x, y, t, t0, color, n, dir) {
    const d = t - t0;
    if (d < 0 || d > 1.1) return;
    ctx.fillStyle = color; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * 0.5 + dir * (0.25 + (i / n) * 1.2) + Math.sin(i * 7.3) * 0.15;
      const v = 190 + ((i * 53) % 120);
      const px = x + Math.cos(a) * v * d, py = y + Math.sin(a) * v * d + 520 * d * d;
      if (py > KFY + 6) continue;
      const rr = 4 + (i % 3) * 2;
      ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
  function ksKnife(x, y, ang, bloody) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.lineWidth = 4; ctx.strokeStyle = OUTLINE; ctx.lineJoin = 'round';
    ctx.fillStyle = '#7a4a26'; roundRect(-28, -7, 32, 14, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd34d'; ctx.fillRect(2, -12, 7, 24); ctx.strokeRect(2, -12, 7, 24);
    ctx.fillStyle = '#e4ebf5';
    ctx.beginPath(); ctx.moveTo(9, -8); ctx.lineTo(64, -3); ctx.lineTo(74, 4); ctx.lineTo(9, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (bloody) { ctx.fillStyle = '#c4142b'; ctx.beginPath(); ctx.moveTo(42, -5); ctx.lineTo(64, -3); ctx.lineTo(74, 4); ctx.lineTo(42, 8); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  // Bocota: bola del color del impostor con dientes, lengua y un ojo enojado.
  function ksMouth(x, y, MR, oa, c, t) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#3a0010'; ctx.beginPath(); ctx.arc(0, 0, MR * 0.95, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff6f8a'; ctx.beginPath(); ctx.ellipse(MR * 0.4, MR * 0.1, MR * 0.45, MR * 0.16, 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.body; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, MR, oa, Math.PI * 2 - oa); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.lineWidth = 3;
    for (const s of [-1, 1]) {
      const e = s * oa, ux = Math.cos(e), uy = Math.sin(e);
      const nx = -Math.sin(e) * -s, ny = Math.cos(e) * -s; // hacia adentro de la boca
      for (let k = 0; k < 4; k++) {
        const d0 = MR * (0.3 + k * 0.17), d1 = d0 + MR * 0.15, dm = (d0 + d1) / 2;
        ctx.beginPath(); ctx.moveTo(ux * d0, uy * d0); ctx.lineTo(ux * d1, uy * d1); ctx.lineTo(ux * dm + nx * MR * 0.17, uy * dm + ny * MR * 0.17); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    // ojo enojado
    ctx.fillStyle = '#ffffff'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(-MR * 0.2, -MR * 0.55, MR * 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.arc(-MR * 0.12 + Math.sin(t * 20) * 1.5, -MR * 0.53, MR * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-MR * 0.45, -MR * 0.82); ctx.lineTo(MR * 0.02, -MR * 0.66); ctx.stroke();
    ctx.restore();
  }
  function ksRayGun(x, y, s, glow) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.lineWidth = 4; ctx.strokeStyle = OUTLINE; ctx.lineJoin = 'round';
    ctx.fillStyle = '#5a6278'; roundRect(-8, -2, 16, 26, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c9d3e6'; roundRect(-14, -16, 56, 22, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff5a6a'; for (const xx of [2, 14]) { ctx.fillRect(xx, -16, 5, 22); ctx.strokeRect(xx, -16, 5, 22); }
    ctx.fillStyle = '#c9d3e6'; roundRect(40, -11, 14, 12, 4); ctx.fill(); ctx.stroke();
    if (glow > 0) {
      ctx.fillStyle = `rgba(79,255,224,${0.35 * glow})`; ctx.beginPath(); ctx.arc(58, -5, 10 + 16 * glow, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8fffb'; ctx.beginPath(); ctx.arc(58, -5, 4 + 5 * glow, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  function ksWrench(x, y, ang) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.lineWidth = 4; ctx.strokeStyle = OUTLINE; ctx.lineJoin = 'round';
    ctx.fillStyle = '#9aa4b5'; roundRect(-10, -8, 104, 16, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c3cad6';
    ctx.beginPath(); ctx.arc(104, 0, 22, 0.55, Math.PI * 2 - 0.55); ctx.lineTo(112, -6); ctx.lineTo(112, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function ksStars(x, y, t) {
    for (let i = 0; i < 4; i++) {
      const a = t * 5 + (i * Math.PI) / 2;
      star(x + Math.cos(a) * 44, y + Math.sin(a) * 12, 11, '#ffd34d');
    }
  }
  function ksPuffs(x, y, t, t0, n, spread) {
    const d = t - t0;
    if (d < 0 || d > 0.9) return;
    ctx.fillStyle = `rgba(200,205,220,${0.75 * (1 - d / 0.9)})`;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (i / (n - 1)) * Math.PI;
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * spread * eo(d / 0.9) * (0.6 + (i % 2) * 0.4), y + Math.sin(a) * 30 * eo(d / 0.9), 9 + 14 * d, 0, Math.PI * 2); ctx.fill();
    }
  }

  function killScene(cv, o, t) {
    const prev = ctx;
    ctx = cv.getContext('2d');
    const bs = cv.width / KW;
    ctx.setTransform(bs, 0, 0, bs, 0, 0);
    const kind = KILL_KINDS[(o.kind || 0) % KILL_KINDS.length];
    const R = S.PLAYER_RADIUS * KK; // radio del monito en la escena
    const kc = S.COLORS[o.killer.color] || S.COLORS[0];
    const vc = S.COLORS[o.victim.color] || S.COLORS[0];
    const hit = { cuchillo: 0.85, mordida: 1.05, rayo: 0.8, llave: 1.0 }[kind];

    // Fondo con rayos girando y piso
    const bg = { cuchillo: ['#6a0a1a', '#1a0206'], mordida: ['#46104c', '#12021a'], rayo: ['#0a3c58', '#020c16'], llave: ['#5a3608', '#160a02'] }[kind];
    const g = ctx.createRadialGradient(KW / 2, KH * 0.55, 20, KW / 2, KH * 0.55, KW * 0.6);
    g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, KW, KH);
    ctx.save();
    const sh = t > hit && t < hit + 0.3 ? 9 * (1 - (t - hit) / 0.3) : 0; // temblor al golpe
    ctx.translate(Math.sin(t * 95) * sh, Math.cos(t * 83) * sh);
    ctx.save(); ctx.translate(KW / 2, KH * 0.55); ctx.rotate(t * 0.25);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, KW, (i * Math.PI) / 8, (i * Math.PI) / 8 + Math.PI / 16); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-20, KFY - 2, KW + 40, KH);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-20, KFY - 2); ctx.lineTo(KW + 20, KFY - 2); ctx.stroke();

    const K = o.killer, V = o.victim, VX = 380;
    const enter = (to) => lerp(-80, to, eo(seg(t, 0, 0.35)));
    const fear = t > 0.3 && t < hit ? Math.sin(t * 60) * 1.5 : 0;

    if (kind === 'cuchillo') {
      let kx = enter(225) - 18 * eo(seg(t, 0.35, 0.7)) + 78 * ei(seg(t, 0.7, 0.85)) - 35 * eo(seg(t, 1.35, 1.75));
      const ang = t < 0.7 ? lerp(0.3, -1.35, eo(seg(t, 0.4, 0.7))) : lerp(-1.35, 0.05, ei(seg(t, 0.7, 0.85)));
      const hx = kx + R * 0.8, hy = KFY - R * 0.95;
      const inside = t >= hit && t < 1.35;
      const fall = eo(seg(t, 1.35, 1.8));
      if (fall > 0.6) { // charco
        ctx.fillStyle = 'rgba(170,10,30,0.85)';
        ctx.beginPath(); ctx.ellipse(VX + R * 0.9, KFY + 4, R * 1.4 * eo(seg(t, 1.6, 2.4)), 9, 0, 0, Math.PI * 2); ctx.fill();
      }
      if (inside) ksKnife(hx, hy, ang, true);
      ksCrew(VX + 10 * eo(seg(t, hit, hit + 0.2)) + fear, KFY, V, -1, t, { dead: t >= hit, rot: fall * Math.PI / 2 });
      ksCrew(kx, KFY, K, 1, t, { moving: t < 0.35 || (t > 0.7 && t < 0.85) });
      if (!inside) ksKnife(hx, hy, ang, t >= hit);
      ksDrops(VX + R * 0.55, KFY - R * 0.9, t, hit, '#d0142e', 12, 1);
      ksBurst(470, 70, '¡ZAS!', t, hit);
    } else if (kind === 'mordida') {
      const kx = enter(125);
      const appear = seg(t, 0.4, 0.62);
      const MR = 66 * (appear < 1 ? eo(appear) * 1.1 : 1) * (1 - eo(seg(t, 1.75, 2.1)));
      let oa = lerp(0.12, 0.9, eo(seg(t, 0.62, 0.9)));
      if (t >= 0.98) oa = lerp(0.9, 0.03, ei(seg(t, 0.98, hit)));
      if (t >= hit) oa = 0.03 + Math.abs(Math.sin((t - hit) * 14)) * 0.12 * (1 - seg(t, hit + 0.4, hit + 0.6));
      const restX = kx + R * 2.45, restY = KFY - R * 1.3;
      const reach = ei(seg(t, 0.9, 1.0)) * (1 - eo(seg(t, 1.5, 1.85)));
      const mx = lerp(restX, VX - 6, reach), my = lerp(restY, KFY - R * 1.05, reach);
      const baseX = kx + R * 0.55, baseY = KFY - R * 0.6;
      // Lo que queda de la víctima: su sombrero (o la antena) cae al piso
      if (t >= hit) {
        const d = t - hit;
        let fy = KFY - R * 2.1 + 420 * d * d - 160 * d;
        let rot = d * 7;
        const landed = fy > KFY - 14;
        if (landed) { fy = KFY - 14; rot = 0.2; }
        ctx.save(); ctx.translate(VX + 30 + Math.min(d, 0.75) * 40, fy); ctx.rotate(landed ? rot : Math.sin(rot) * 0.8);
        if (V.hat) { ctx.scale(KK, KK); ctx.translate(0, S.PLAYER_RADIUS * 1.22); drawHat(V.hat, S.PLAYER_RADIUS, 1, t); }
        else { ctx.strokeStyle = OUTLINE; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 26); ctx.stroke(); ctx.fillStyle = vc.body; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        ctx.restore();
      }
      if (t < hit) ksCrew(VX + fear, KFY, V, -1, t, { dead: false });
      ksCrew(kx, KFY, K, 1, t, { moving: t < 0.35 });
      if (MR > 1) {
        // cuello elástico desde la panza
        ctx.lineCap = 'round';
        for (const [w, col] of [[30, OUTLINE], [20, kc.body]]) {
          ctx.strokeStyle = col; ctx.lineWidth = w * Math.min(1, MR / 40);
          ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.quadraticCurveTo((baseX + mx) / 2, Math.min(baseY, my) - 30, mx - MR * 0.6, my); ctx.stroke();
        }
        ctx.lineCap = 'butt';
        ksMouth(mx, my, MR, oa, kc, t);
      }
      ksDrops(VX, KFY - R * 1.1, t, hit + 0.05, '#d0142e', 8, 1);
      ksBurst(470, 64, '¡ÑAM!', t, hit);
    } else if (kind === 'rayo') {
      const kx = enter(185);
      const gs = eo(seg(t, 0.35, 0.5));
      const charge = t < hit ? seg(t, 0.5, hit) * (0.75 + Math.sin(t * 40) * 0.25) : 1 - seg(t, 1.15, 1.3);
      const gx = kx + R * 0.75, gy = KFY - R * 0.9;
      const crumble = seg(t, 1.6, 2.1);
      // ceniza
      if (t > 1.5) {
        const p = eo(seg(t, 1.5, 2.1));
        ctx.fillStyle = '#2a2a30'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(VX, KFY - 2, R * 0.95 * p, R * 0.45 * p, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        if (p > 0.8) { // la antena queda encima de la ceniza
          ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(VX + 6, KFY - R * 0.4); ctx.lineTo(VX + 12, KFY - R * 0.4 - 24); ctx.stroke();
          ctx.fillStyle = vc.body; ctx.beginPath(); ctx.arc(VX + 12, KFY - R * 0.4 - 30, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      }
      if (t < hit) ksCrew(VX + fear, KFY, V, -1, t);
      else if (t < 1.15) {
        if (Math.floor(t / 0.05) % 2) ksTinted(VX, KFY, V, -1, t, '#38c6e8', { bones: true }, bs);
        else ksCrew(VX + Math.sin(t * 90) * 3, KFY, V, -1, t, { dead: true });
      } else if (crumble < 1) {
        ksTinted(VX, KFY, V, -1, t, '#1d1d22', { sy: 1 - crumble * 0.85, sx: 1 + crumble * 0.2, alpha: 1 - crumble * 0.6 }, bs);
      }
      // humo
      if (t > 1.15) {
        for (let i = 0; i < 5; i++) {
          const d = (t - 1.15 + i * 0.18) % 0.9;
          ctx.fillStyle = `rgba(150,150,160,${0.5 * (1 - d / 0.9)})`;
          ctx.beginPath(); ctx.arc(VX - 20 + i * 10 + Math.sin(d * 6 + i) * 8, KFY - R * 1.6 - d * 90, 8 + d * 18, 0, Math.PI * 2); ctx.fill();
        }
      }
      ksCrew(kx, KFY, K, 1, t, { moving: t < 0.35 });
      if (gs > 0) ksRayGun(gx, gy, gs, charge);
      if (t >= hit && t < 1.15) { // rayo en zigzag
        const x0 = gx + 58 * gs, y0 = gy - 5, x1 = VX - 10, y1 = KFY - R;
        const seed = Math.floor(t / 0.04);
        const pts = [[x0, y0]];
        for (let i = 1; i < 7; i++) pts.push([lerp(x0, x1, i / 7), lerp(y0, y1, i / 7) + Math.sin(seed * 3.1 + i * 2.3) * 14]);
        pts.push([x1, y1]);
        for (const [w, col] of [[16, 'rgba(79,255,224,0.35)'], [7, '#9ffcf0'], [3, '#ffffff']]) {
          ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round';
          ctx.beginPath(); pts.forEach(([px, py], i) => ctx[i ? 'lineTo' : 'moveTo'](px, py)); ctx.stroke();
        }
      }
      ksBurst(470, 64, '¡BZZT!', t, hit);
    } else { // llave
      let kx = enter(195), ky = 0;
      if (t > 0.4) { kx = lerp(195, 262, eo(seg(t, 0.4, 0.85))); ky = -62 * eo(seg(t, 0.4, 0.85)); }
      if (t > 0.85) { kx = lerp(262, 270, seg(t, 0.85, hit)); ky = lerp(-62, 0, ei(seg(t, 0.85, hit))); }
      if (t > 1.5) { const p = seg(t, 1.5, 1.85); kx = lerp(270, 200, p); ky = -50 * Math.sin(p * Math.PI); }
      let ang = lerp(1.25, -2.6, eo(seg(t, 0.4, 0.85))); // llega con la llave colgando y la alza
      if (t > 0.85) ang = lerp(-2.6, 0.22, ei(seg(t, 0.85, hit)));
      if (t > 1.5) ang = lerp(0.22, -0.6, seg(t, 1.5, 1.7));
      const sq = eo(seg(t, hit, hit + 0.08));
      ksPuffs(VX, KFY, t, hit, 6, 90);
      ksCrew(VX + fear, KFY, V, -1, t, { dead: t >= hit, sy: 1 - sq * 0.62, sx: 1 + sq * 0.45 });
      ksCrew(kx, KFY + ky, K, 1, t, { moving: t < 0.35 });
      ksWrench(kx + R * 0.55, KFY + ky - R * 1.0, ang);
      if (t > hit + 0.1) ksStars(VX, KFY - R * 0.95 - 14, t);
      ksBurst(470, 64, '¡PUM!', t, hit);
    }
    ctx.restore();
    // destello al golpe y fundido al final
    if (t > hit && t < hit + 0.14) { ctx.fillStyle = `rgba(255,255,255,${0.75 * (1 - (t - hit) / 0.14)})`; ctx.fillRect(0, 0, KW, KH); }
    const fade = seg(t, KILL_LEN - 0.35, KILL_LEN);
    if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, KW, KH); }
    ctx = prev;
    return { hit };
  }

  function viewSize() { const sc = worldScale(); return { w: cssW / sc, h: cssH / sc }; }

  return { init, frame, ejectFrame, crewOn, crewRow, worldScale, burst, minimap, viewSize, cameraFeed, killScene, KILL_KINDS, KILL_LEN };
})();
