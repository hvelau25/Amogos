// Prueba de tareas, sabotajes y ventilaciones. 3 jugadores (1 impostor).
const { io } = require('socket.io-client');
const S = require('../shared/game.js');
const URL = process.env.URL || 'http://localhost:3000';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (cond, msg) => { if (!cond) { console.error('FALLA:', msg); process.exit(1); } console.log('ok -', msg); };
const until = async (fn, ms, msg) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return; await wait(50); }
  ok(false, 'timeout esperando ' + msg);
};
const MAPKEY = process.env.MAP || 'estacion'; // MAP=hielo para probar la Base Polar
const MAP = S.MAPS[MAPKEY];

function bot(name, i) {
  const s = io(URL, { transports: ['websocket'], forceNew: true });
  const b = { s, name, sala: null, me: null, x: 0, y: 0, snaps: [] };
  s.on('sala', (r) => (b.sala = r));
  s.on('corr', (c) => { b.x = c.x; b.y = c.y; });
  s.on('s', (l) => b.snaps.push(...l));
  b.emit = (ev, d) => new Promise((r) => (d === undefined ? s.emit(ev, r) : s.emit(ev, d, r)));
  b.token = 'fase3' + i + 'xxxxxxxx';
  return b;
}
// Camina por la cuadrícula usando BFS para no chocar con paredes.
function path(fx, fy, tx, ty) {
  const W = MAP.width, H = MAP.height, T = S.TILE;
  const s = [Math.floor(fx / T), Math.floor(fy / T)], g = [Math.floor(tx / T), Math.floor(ty / T)];
  const key = (x, y) => y * W + x, prev = new Map([[key(...s), null]]), q = [s];
  while (q.length) {
    const [x, y] = q.shift();
    if (x === g[0] && y === g[1]) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (S.isSolidTile(MAP, nx, ny) || prev.has(key(nx, ny))) continue;
      prev.set(key(nx, ny), [x, y]);
      q.push([nx, ny]);
    }
  }
  const out = [];
  for (let c = g; c; c = prev.get(key(...c))) out.unshift([(c[0] + 0.5) * T, (c[1] + 0.5) * T]);
  out.push([tx, ty]);
  return out;
}
async function walkTo(b, tx, ty) {
  for (const [x, y] of path(b.x, b.y, tx, ty)) {
    for (let i = 0; i < 80; i++) {
      const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx, dy);
      if (d < 4) break;
      const st = Math.min(12, d);
      b.x += (dx / d) * st; b.y += (dy / d) * st;
      b.s.emit('mov', { x: b.x, y: b.y, f: 1, m: 1 });
      await wait(45);
    }
  }
  b.s.emit('mov', { x: b.x, y: b.y, f: 1, m: 0 });
  await wait(100);
}
const at = (spot) => [spot.x * S.TILE, spot.y * S.TILE + 20];

async function newGame(tasks) {
  const bots = ['Ana', 'Beto', 'Caro'].map(bot);
  const [A] = bots;
  const r = await A.emit('crear', { name: 'Ana', token: A.token + Math.random().toString(36).slice(2, 6) });
  A.me = r.me;
  for (const b of bots.slice(1)) {
    const j = await b.emit('unirse', { code: r.room.code, name: b.name, token: b.token + Math.random().toString(36).slice(2, 6) });
    b.me = j.me;
  }
  A.s.emit('ajustes', { tasks, map: S.MAP_CHOICES.indexOf(MAPKEY) }); await wait(150);
  await A.emit('empezar'); await wait(300);
  for (const b of bots) { const p = b.sala.players.find((q) => q.id === b.me); b.x = p.x; b.y = p.y; }
  ok(A.sala.map === MAPKEY, 'la partida usa el mapa ' + MAPKEY);
  await wait(4000); // revelación de rol
  const imp = bots.find((b) => b.sala.me.role === 'impostor');
  return { bots, imp, crew: bots.filter((b) => b !== imp) };
}

(async () => {
  // ---- Partida 1: tareas, ventilaciones, luces, victoria por tareas ----
  let { bots, imp, crew } = await newGame(2);
  ok(crew.every((b) => b.sala.me.tasks.length === 2) && imp.sala.me.tasks.length === 2, 'cada uno tiene 2 tareas (el impostor, falsas)');
  const expected = crew.reduce((n, c) => n + c.sala.me.tasks.reduce((m, k) => m + k.steps, 0), 0);
  ok(crew[0].sala.taskProgress.total === expected && crew[0].sala.taskProgress.done === 0, 'barra de progreso: 0/' + expected + ' (cuenta etapas, no las del impostor)');

  // tarea sin abrirla o desde lejos → rechazada
  const t0 = crew[0].sala.me.tasks[0].id;
  crew[0].s.emit('tarea', t0); await wait(150);
  ok(crew[0].sala.taskProgress.done === 0, 'no se puede completar una tarea sin estar ahí');

  // ventilación
  const v = MAP.vents[6]; // cafetería
  await walkTo(imp, ...at(v));
  imp.s.emit('ventila'); await wait(200);
  ok(imp.sala.me.inVent === v.id, 'el impostor entra a la ventilación');
  ok(!crew[0].sala.players.some((p) => p.id === imp.me), 'los demás no lo ven');
  const v2 = MAP.vents.find((q) => q.group === v.group && q.id !== v.id);
  imp.s.emit('ventilaMover', v2.id); await wait(200);
  ok(imp.sala.me.inVent === v2.id, 'se mueve a otra ventilación conectada');
  imp.s.emit('ventilaMover', MAP.vents[0].id); await wait(150);
  ok(imp.sala.me.inVent === v2.id, 'no puede saltar a una ventilación de otro grupo');
  imp.s.emit('ventila'); await wait(200);
  ok(!imp.sala.me.inVent && crew[0].sala.players.some((p) => p.id === imp.me), 'sale y vuelve a ser visible');
  imp.x = v2.x * S.TILE; imp.y = v2.y * S.TILE;

  // luces
  await until(() => { imp.s.emit('sabotear', 'luces'); return !!crew[0].sala.sabotage; }, 25000, 'sabotaje disponible');
  ok(crew[0].sala.sabotage && crew[0].sala.sabotage.kind === 'luces', 'el impostor apaga las luces');
  crew[0].s.emit('emergencia'); await wait(100);
  ok(crew[0].sala.phase === 'juego', 'no hay reunión de emergencia durante un sabotaje');
  await walkTo(crew[1], ...at(MAP.fixes.luces));
  crew[1].s.emit('arreglarLuces'); await wait(200);
  ok(!crew[0].sala.sabotage, 'un tripulante arregla las luces en Eléctrica');

  // hacer todas las tareas (las de varias etapas, una sala tras otra)
  let multi = false;
  for (const c of crew) {
    for (const k0 of c.sala.me.tasks) {
      for (let guard = 0; guard < 4; guard++) {
        const k = c.sala.me.tasks.find((q) => q.id === k0.id);
        if (k.done) break;
        if (k.steps > 1) multi = true;
        const st = MAP.tasks.find((q) => q.id === k.station);
        await walkTo(c, ...at(st));
        c.s.emit('abrirTarea', k.id);
        await wait(800);
        c.s.emit('tarea', k.id);
        await wait(200);
        const k2 = c.sala.me.tasks.find((q) => q.id === k0.id);
        ok(k2.step === k.step + 1, 'etapa ' + (k.step + 1) + '/' + k.steps + ' de ' + k.id + ' completada');
      }
    }
  }
  if (!multi) console.log('  (esta vez no tocó ninguna tarea de varias etapas)');
  await until(() => crew[0].sala.phase === 'fin', 5000, 'fin por tareas');
  ok(crew[0].sala.ending.winner === 'tripulantes' && /tareas/.test(crew[0].sala.ending.reason), 'ganan los tripulantes por tareas');
  bots.forEach((b) => b.s.disconnect());

  // ---- Partida 2: reactor ----
  ({ bots, imp, crew } = await newGame(4));
  await until(() => { imp.s.emit('sabotear', 'reactor'); return !!imp.sala.sabotage; }, 25000, 'sabotaje reactor');
  ok(crew[0].sala.sabotage.kind === 'reactor' && crew[0].sala.sabotage.endsIn > 30000, 'reactor en crisis con cuenta regresiva');
  await walkTo(crew[0], ...at(MAP.fixes.reactorA));
  crew[0].s.emit('mano', { panel: 'A', on: true }); await wait(200);
  ok(crew[0].sala.sabotage && crew[0].sala.sabotage.hands.A && !crew[0].sala.sabotage.hands.B, 'una mano no basta');
  crew[0].s.emit('mano', { panel: 'B', on: true }); await wait(150);
  ok(crew[0].sala.sabotage && !crew[0].sala.sabotage.hands.B, 'no se puede poner la mano en un panel lejano');
  await walkTo(crew[1], ...at(MAP.fixes.reactorB));
  crew[1].s.emit('mano', { panel: 'B', on: true }); await wait(200);
  ok(!crew[0].sala.sabotage, 'dos manos a la vez detienen el reactor');

  // reactor sin arreglar → ganan impostores
  await until(() => { imp.s.emit('sabotear', 'reactor'); return !!imp.sala.sabotage; }, 40000, 'segundo reactor');
  ok(true, 'segundo sabotaje tras el enfriamiento');
  await until(() => crew[0].sala.phase === 'fin', S.REACTOR_TIME * 1000 + 3000, 'reactor fundido');
  ok(crew[0].sala.ending.winner === 'impostores' && /reactor/.test(crew[0].sala.ending.reason), 'si nadie lo arregla, ganan los impostores');
  console.log('\nFase 3 OK.');
  process.exit(0);
})();
