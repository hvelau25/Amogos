// Validación de mapas: con paredes y objetos sólidos, desde la aparición se debe poder llegar
// a todas las salas, estaciones de tarea, ventilaciones, arreglos, botón de emergencia y panel de cámaras.
// Uso: node test/mapas.js   (no necesita el servidor)
const S = require('../shared/game.js');
const T = S.TILE, R = S.PLAYER_RADIUS, STEP = 8;
let fails = 0;
const fail = (m) => { fails++; console.log('  FALLA:', m); };

for (const id of S.MAP_CHOICES.concat('lobby')) {
  const map = S.MAPS[id];
  console.log(id);
  const W = Math.ceil((map.width * T) / STEP), H = Math.ceil((map.height * T) / STEP);
  const seen = new Uint8Array(W * H);
  const free = (gx, gy) => gx >= 0 && gy >= 0 && gx < W && gy < H && !S.collides(map, gx * STEP, gy * STEP, R);
  // Todos los puntos de aparición (3 a 12 jugadores) libres
  for (let n = 3; n <= 12; n++)
    for (let i = 0; i < n; i++) {
      const p = S.spawnPoint(map, i, n);
      if (S.collides(map, p.x, p.y, R)) fail(`aparición ${i}/${n} encimada`);
    }
  const start = S.spawnPoint(map, 0, 1);
  const q = [[Math.round(start.x / STEP), Math.round(start.y / STEP)]];
  if (!free(q[0][0], q[0][1])) { fail('el inicio no está libre'); continue; }
  seen[q[0][1] * W + q[0][0]] = 1;
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx]) continue;
      if (!free(nx, ny)) continue;
      seen[ny * W + nx] = 1;
      q.push([nx, ny]);
    }
  }
  const reach = (wx, wy, range) => {
    const r = Math.ceil(range / STEP);
    const cx = Math.round(wx / STEP), cy = Math.round(wy / STEP);
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++)
        if (x >= 0 && y >= 0 && x < W && y < H && seen[y * W + x] && Math.hypot(x * STEP - wx, y * STEP - wy) <= range - 6) return true;
    return false;
  };
  for (const r of map.rooms) {
    let ok = false;
    for (let y = r.y * T; y < (r.y + r.h) * T && !ok; y += STEP) for (let x = r.x * T; x < (r.x + r.w) * T && !ok; x += STEP) if (seen[Math.round(y / STEP) * W + Math.round(x / STEP)]) ok = true;
    if (!ok) fail('sala inalcanzable: ' + r.id);
  }
  for (const k of map.tasks || []) if (!reach(k.x * T, k.y * T, S.USE_RANGE)) fail('tarea inalcanzable: ' + k.id);
  for (const v of map.vents || []) if (!reach(v.x * T, v.y * T, S.USE_RANGE)) fail('ventila inalcanzable: ' + v.id);
  for (const [k, f] of Object.entries(map.fixes || {})) if (!reach(f.x * T, f.y * T, S.USE_RANGE)) fail('arreglo inalcanzable: ' + k);
  if (map.emergency && !reach(map.emergency.x * T, map.emergency.y * T, S.USE_RANGE)) fail('botón de emergencia inalcanzable');
  if (map.cameras) {
    const pn = map.cameras.panel;
    if (!reach(pn.x * T, pn.y * T, S.USE_RANGE)) fail('panel de cámaras inalcanzable');
    // Que el panel no quede pegado a una tarea (USAR elegiría la tarea)
    for (const k of map.tasks || []) if (Math.hypot(k.x - pn.x, k.y - pn.y) * T < S.USE_RANGE * 1.4) fail('panel de cámaras muy cerca de la tarea ' + k.id);
    for (const c of map.cameras.cams) if (S.isSolidTile(map, Math.floor(c.x), Math.floor(c.y))) fail('cámara dentro de pared: ' + c.id);
  }
  // Las estaciones no deben quedar debajo de un objeto
  for (const k of (map.tasks || []).concat(map.vents || []))
    for (const b of map.blocks) if (k.x * T > b.x0 && k.x * T < b.x1 && k.y * T > b.y0 && k.y * T < b.y1) fail('estación bajo un objeto: ' + k.id);
  console.log('  objetos sólidos:', map.blocks.length);
}
console.log(fails ? `${fails} fallas` : 'MAPAS OK');
process.exit(fails ? 1 : 0);
