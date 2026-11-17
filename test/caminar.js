// Ayudante de pruebas: camino que esquiva paredes y objetos sólidos (BFS en una cuadrícula fina).
const S = require('../shared/game.js');
const STEP = 16;

function path(map, fx, fy, tx, ty) {
  const W = Math.ceil((map.width * S.TILE) / STEP), H = Math.ceil((map.height * S.TILE) / STEP);
  const free = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !S.collides(map, x * STEP, y * STEP, S.PLAYER_RADIUS);
  const near = (wx, wy) => { // punto libre de la cuadrícula más cercano
    const cx = Math.round(wx / STEP), cy = Math.round(wy / STEP);
    for (let r = 0; r < 12; r++)
      for (let y = cy - r; y <= cy + r; y++)
        for (let x = cx - r; x <= cx + r; x++) if (free(x, y)) return [x, y];
    return [cx, cy];
  };
  const s = near(fx, fy), g = near(tx, ty);
  const key = (x, y) => y * W + x, prev = new Map([[key(...s), null]]), q = [s];
  let head = 0;
  while (head < q.length) {
    const [x, y] = q[head++];
    if (x === g[0] && y === g[1]) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (prev.has(key(nx, ny)) || !free(nx, ny) || (dx && dy && (!free(x + dx, y) || !free(x, y + dy)))) continue;
      prev.set(key(nx, ny), [x, y]);
      q.push([nx, ny]);
    }
  }
  const out = [];
  for (let c = g; c; c = prev.get(key(...c))) out.unshift([c[0] * STEP, c[1] * STEP]);
  // quitar puntos intermedios en línea recta
  return out.filter((p, i) => i === 0 || i === out.length - 1 || i % 3 === 0).concat(S.collides(map, tx, ty, S.PLAYER_RADIUS) ? [] : [[tx, ty]]);
}

// b: { s: socket, x, y }. Camina hasta (tx,ty) mandando 'mov' como un cliente real.
async function walkTo(map, b, tx, ty, opts) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const close = (opts && opts.close) || 4;
  for (const [x, y] of path(map, b.x, b.y, tx, ty)) {
    for (let i = 0; i < 80; i++) {
      const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx, dy);
      if (d < close) break;
      const st = Math.min(12, d);
      const r = S.move(map, b.x, b.y, (dx / d) * st, (dy / d) * st, S.PLAYER_RADIUS, false);
      b.x = r.x; b.y = r.y;
      b.s.emit('mov', { x: b.x, y: b.y, f: 1, m: 1 });
      await wait(45);
    }
  }
  b.s.emit('mov', { x: b.x, y: b.y, f: 1, m: 0 });
  await wait(100);
}

module.exports = { path, walkTo };
