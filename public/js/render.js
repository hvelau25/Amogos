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

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt)));
    const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
    return `rgb(${r},${g},${b})`;
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

  function drawDecor(map) {
    const now = performance.now() / 1000;
    for (const d of map.decor || []) drawItem(d, now);
    // Botón de emergencia (sobre la mesa central)
    if (map.emergency) {
      const ex = map.emergency.x * T, ey = map.emergency.y * T;
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

  function drawRoomLabels(map, x0, y0, x1, y1) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 30px system-ui, sans-serif';
    for (const r of map.rooms) {
      if (r.label === false || !r.name) continue;
      if (r.x + r.w < x0 || r.x > x1 || r.y + r.h < y0 || r.y > y1) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillText(r.name.toUpperCase(), (r.x + r.w / 2) * T, (r.y + 0.7) * T);
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
    const label = (isHost ? '★ ' : '') + name + (disconnected ? ' (…)' : '');
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(label, x, y - S.PLAYER_RADIUS * 2.0);
    ctx.fillStyle = disconnected ? '#9aa3c7' : color || '#ffffff';
    ctx.fillText(label, x, y - S.PLAYER_RADIUS * 2.0);
  }

  function drawJoystick() {
    const j = Input.joystick;
    if (!j.active) return;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(j.baseX, j.baseY, Input.RADIUS, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    let kx = j.knobX - j.baseX, ky = j.knobY - j.baseY;
    const d = Math.hypot(kx, ky);
    if (d > Input.RADIUS) { kx = (kx / d) * Input.RADIUS; ky = (ky / d) * Input.RADIUS; }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(j.baseX + kx, j.baseY + ky, 28, 0, Math.PI * 2); ctx.fill();
  }

  // state: { map, camX, camY, players: [{x,y,color,f,moving,name,host,conn}] }
  function frame(state) {
    const t = performance.now() / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground(state.map, state.camX, state.camY);
    if (!state.map) return;

    const sc = worldScale();
    ctx.save();
    ctx.translate(cssW / 2, cssH / 2);
    ctx.scale(sc, sc);
    ctx.translate(-state.camX, -state.camY);

    const halfW = cssW / 2 / sc, halfH = cssH / 2 / sc;
    const x0 = Math.floor((state.camX - halfW) / T) - 1, x1 = Math.ceil((state.camX + halfW) / T) + 1;
    const y0 = Math.floor((state.camY - halfH) / T) - 1, y1 = Math.ceil((state.camY + halfH) / T) + 1;

    drawMap(state.map, x0, y0, x1, y1);
    drawRoomLabels(state.map, x0, y0, x1, y1);
    drawDecor(state.map);
    drawStations(state.map, state);

    for (const b of state.bodies || []) drawBody(b.x, b.y, b.color);

    const list = state.players.slice().sort((a, b) => a.y - b.y);
    for (const p of list) drawCrew(p.x, p.y, p.color, p.f, p.moving, t + p.id * 0.37, p.ghost ? 0.45 : p.conn ? 1 : 0.55);
    for (const p of list) drawName(p.x, p.y, p.name, p.host, !p.conn, p.nameColor);

    ctx.restore();
    if (state.map.theme === 'ice') drawBlizzard();
    if (state.vision) drawVision(state.vision, sc);
    if (state.arrows) for (const a of state.arrows) drawArrow(a, state.camX, state.camY, sc);
    drawJoystick();
  }

  // Consolas de tareas, ventilaciones y puntos de arreglo de sabotajes.
  function drawStations(map, state) {
    const t = performance.now() / 1000;
    const pend = state.myTasks || new Set();
    for (const v of map.vents || []) {
      const x = v.x * T, y = v.y * T;
      const lit = state.ventIds && state.ventIds.has(v.id);
      ctx.fillStyle = '#3a3f4f'; ctx.strokeStyle = lit ? '#ff5a6a' : OUTLINE; ctx.lineWidth = lit ? 5 : 3;
      roundRect(x - 26, y - 16, 52, 32, 6); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#1d2030'; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = -16; i <= 16; i += 8) { ctx.moveTo(x + i, y - 11); ctx.lineTo(x + i, y + 11); }
      ctx.stroke();
    }
    for (const k of map.tasks || []) {
      const x = k.x * T, y = k.y * T;
      const mine = pend.has(k.id);
      ctx.fillStyle = '#2b3348'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
      roundRect(x - 20, y - 18, 40, 28, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = mine ? '#ffd34d' : '#4fb3ff';
      ctx.fillRect(x - 14, y - 13, 28, 14);
      if (mine) {
        ctx.strokeStyle = `rgba(255,211,77,${0.55 + Math.sin(t * 5) * 0.35})`;
        ctx.lineWidth = 5;
        roundRect(x - 26, y - 24, 52, 40, 8); ctx.stroke();
        ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4;
        ctx.font = 'bold 30px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        const by = y - 28 + Math.sin(t * 4) * 4;
        ctx.strokeText('!', x, by); ctx.fillText('!', x, by);
      }
    }
    const fx = map.fixes || {};
    const sab = state.sabotage;
    const spots = [];
    if (fx.luces) spots.push([fx.luces, sab && sab.kind === 'luces', '💡']);
    if (fx.reactorA) spots.push([fx.reactorA, sab && sab.kind === 'reactor', '✋']);
    if (fx.reactorB) spots.push([fx.reactorB, sab && sab.kind === 'reactor', '✋']);
    for (const [s, active, icon] of spots) {
      const x = s.x * T, y = s.y * T;
      ctx.fillStyle = active ? (Math.sin(t * 8) > 0 ? '#ff3048' : '#7a1020') : '#3b4258';
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
      roundRect(x - 20, y - 20, 40, 40, 8); ctx.fill(); ctx.stroke();
      ctx.font = '22px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(icon, x, y + 1);
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
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
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

  return { init, frame, ejectFrame, crewOn, crewRow, worldScale };
})();
