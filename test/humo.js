// Prueba rápida: dos jugadores, crear/unirse, color, movimiento, empezar, reconexión.
const { io } = require('socket.io-client');
const URL = process.env.URL || 'http://localhost:3000';
const c = (o) => io(URL, { transports: ['websocket'], forceNew: true, ...o });
const emit = (s, ev, d) => new Promise((r) => s.emit(ev, d, r));
const wait = (ms) => new Promise((r) => setTimeout(r, ms + (Number(process.env.LAG) || 0))); // LAG=ms extra para probar contra un servidor remoto
const ok = (cond, msg) => { if (!cond) { console.error('FALLA:', msg); process.exit(1); } console.log('ok -', msg); };

(async () => {
  const a = c(), b = c();
  const A = await emit(a, 'crear', { name: 'Ana', token: 'tokenAAAA1' });
  const extra = c(); await emit(extra, 'unirse', { code: A.room.code, name: 'Caro', token: 'tokenCCCC9' });
  ok(A.ok && A.room.code.length === 4, 'crear sala ' + A.room.code);
  const bad = await emit(b, 'unirse', { code: 'ZZZZ', name: 'x', token: 'tokenBBBB1' });
  ok(!bad.ok, 'código inexistente rechazado');
  const B = await emit(b, 'unirse', { code: A.room.code, name: 'Beto', token: 'tokenBBBB1' });
  ok(B.ok && B.room.players.length === 3, 'unirse');
  ok(B.room.players[0].color !== B.room.players[1].color, 'colores distintos');

  let lastSala; a.on('sala', (r) => (lastSala = r));
  b.emit('color', A.room.players[0].color); await wait(150);
  ok(lastSala.players.find((p) => p.id === B.me).color !== A.room.players[0].color, 'no se puede robar un color');

  const snaps = []; a.on('s', (l) => snaps.push(...l));
  const me = B.room.players.find((p) => p.id === B.me);
  for (let i = 1; i <= 10; i++) { b.emit('mov', { x: me.x + i * 12, y: me.y, f: 1, m: 1 }); await wait(50); }
  await wait(150);
  const lastB = snaps.filter((s) => s[0] === B.me).pop();
  ok(lastB && lastB[1] > me.x + 60, 'movimiento llega al otro jugador');

  let corr = null; b.on('corr', (p) => (corr = p));
  b.emit('mov', { x: me.x + 5000, y: me.y, f: 1, m: 1 }); await wait(150);
  ok(corr && corr.x < me.x + 400, 'teletransporte bloqueado por el servidor');

  b.emit('empezar'); await wait(100);
  ok(lastSala.phase === 'lobby', 'solo el host puede empezar');
  a.emit('empezar'); await wait(150);
  ok(lastSala.phase === 'juego' && lastSala.map === 'estacion', 'host empieza la partida');
  await wait(4100); // revelación de rol

  b.disconnect(); await wait(200);
  ok(lastSala.players.find((p) => p.id === B.me).conn === false, 'desconexión marcada');
  const b2 = c();
  const B2 = await emit(b2, 'unirse', { code: A.room.code, name: 'Beto', token: 'tokenBBBB1' });
  ok(B2.ok && B2.me === B.me, 'reconexión con el mismo jugador (partida ya empezada)');
  const late = await emit(c(), 'unirse', { code: A.room.code, name: 'Tarde', token: 'tokenCCCC1' });
  ok(!late.ok, 'no se puede entrar a media partida');

  a.emit('salir'); await wait(150);
  let sb; b2.on('sala', (r) => (sb = r)); a.disconnect(); await wait(150);
  console.log('\nTodo bien.'); process.exit(0);
})();
