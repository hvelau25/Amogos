// Prueba de una partida completa: 4 jugadores, roles, asesinato, reporte, chat, votación y fin.
const { io } = require('socket.io-client');
const URL = process.env.URL || 'http://localhost:3000';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (cond, msg) => { if (!cond) { console.error('FALLA:', msg); process.exit(1); } console.log('ok -', msg); };
const until = async (fn, ms = 20000, msg = 'condición') => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return; await wait(50); }
  ok(false, 'timeout esperando ' + msg);
};

function bot(name, i) {
  const s = io(URL, { transports: ['websocket'], forceNew: true });
  const b = { s, name, sala: null, chats: [], muerte: false, me: null, x: 0, y: 0 };
  s.on('sala', (r) => (b.sala = r));
  s.on('chat', (m) => b.chats.push(m));
  s.on('muerte', () => (b.muerte = true));
  s.on('corr', (c) => { b.x = c.x; b.y = c.y; });
  b.emit = (ev, d) => new Promise((r) => (d === undefined ? s.emit(ev, r) : s.emit(ev, d, r)));
  b.token = 'prueba' + i + 'xxxxxxx';
  return b;
}
async function walkTo(b, x, y) {
  for (let i = 0; i < 200; i++) {
    const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx, dy);
    if (d < 20) return;
    const st = Math.min(12, d);
    b.x += (dx / d) * st; b.y += (dy / d) * st;
    b.s.emit('mov', { x: b.x, y: b.y, f: 1, m: 1 });
    await wait(50);
  }
}
const self = (b) => b.sala.players.find((p) => p.id === b.me);

(async () => {
  const bots = ['Ana', 'Beto', 'Caro', 'Dani'].map(bot);
  const [A] = bots;
  const r = await A.emit('crear', { name: 'Ana', token: A.token });
  A.me = r.me; A.sala = r.room;
  for (const b of bots.slice(1)) { const j = await b.emit('unirse', { code: r.room.code, name: b.name, token: b.token }); b.me = j.me; }
  await wait(200);

  // Con 2 jugadores no se puede empezar
  const solo = bot('Solo', 9); const rs = await solo.emit('crear', { name: 'Solo', token: solo.token });
  const res2 = await solo.emit('empezar');
  ok(!res2.ok && /al menos/.test(res2.error), 'mínimo 3 jugadores');
  solo.s.disconnect();

  bots[1].s.emit('chat', 'hola lobby'); await wait(200);
  ok(A.chats.some((m) => m.text === 'hola lobby'), 'chat en el lobby');

  A.s.emit('ajustes', { discussion: 15, voting: 30, killCooldown: 15 }); await wait(150);
  ok(A.sala.settings.discussion === 15, 'host cambia ajustes');
  const st = await A.emit('empezar');
  ok(st.ok, 'empieza la partida');
  await wait(300);
  for (const b of bots) { const p = self(b); b.x = p.x; b.y = p.y; }

  const imps = bots.filter((b) => b.sala.me.role === 'impostor');
  ok(imps.length === 1, 'hay exactamente 1 impostor con 4 jugadores');
  const imp = imps[0];
  const crew = bots.filter((b) => b !== imp);
  ok(crew.every((b) => b.sala.players.filter((p) => p.role).length === 1), 'los tripulantes no ven roles ajenos');

  const victim = crew[0];
  imp.s.emit('matar', victim.me); await wait(200);
  ok(victim.sala.players.find((p) => p.id === victim.me).alive, 'no se puede matar antes del tiempo de espera');

  await wait(4000); // revelación de rol: nadie se mueve
  await walkTo(imp, victim.x, victim.y);
  // Espera la revelación de rol + el primer enfriamiento (~16 s), intentando cada medio segundo.
  await until(() => { if (Date.now() % 500 < 60) imp.s.emit('matar', victim.me); return victim.muerte; }, 25000, 'asesinato');
  ok(victim.muerte, 'el impostor mata a ' + victim.name);
  await wait(200);
  const witness = crew[1];
  ok(!witness.sala.players.some((p) => p.id === victim.me), 'los vivos no ven al fantasma');
  ok(victim.sala.players.length === 4, 'el fantasma ve a todos');
  ok(witness.sala.bodies.length === 1, 'hay un cuerpo en el mapa');

  victim.s.emit('chat', 'soy fantasma'); await wait(200);
  ok(victim.chats.some((m) => m.text === 'soy fantasma') && !witness.chats.some((m) => m.text === 'soy fantasma'), 'chat de fantasmas privado');
  witness.s.emit('chat', 'no puedo hablar'); await wait(200);
  ok(!witness.chats.some((m) => m.text === 'no puedo hablar'), 'los vivos no chatean fuera de reunión');

  const body = witness.sala.bodies[0];
  await walkTo(witness, body.x, body.y);
  witness.s.emit('reportar', body.id); await wait(300);
  ok(witness.sala.phase === 'reunion' && witness.sala.meeting.reason === 'cuerpo', 'reporte inicia reunión');
  ok(witness.sala.players.find((p) => p.id === victim.me).alive === false, 'en la reunión todos ven quién murió');

  witness.s.emit('chat', 'fue ' + imp.name); await wait(800);
  ok(bots.every((b) => b.chats.some((m) => m.text === 'fue ' + imp.name)), 'chat de reunión llega a todos');
  victim.s.emit('chat', 'buu'); await wait(200);
  ok(!witness.chats.some((m) => m.text === 'buu'), 'el fantasma no habla con los vivos en la reunión');

  witness.s.emit('votar', imp.me); await wait(100);
  ok(!witness.sala.meeting.voted.length, 'no se vota durante la discusión');
  await until(() => witness.sala.meeting && witness.sala.meeting.stage === 'votacion', 20000, 'votación');
  ok(true, 'empieza la votación');
  victim.s.emit('votar', imp.me); await wait(150);
  ok(!witness.sala.meeting.voted.includes(victim.me), 'los fantasmas no votan');
  for (const b of crew.slice(1)) b.s.emit('votar', imp.me);
  imp.s.emit('votar', 'skip');
  await until(() => witness.sala.meeting && witness.sala.meeting.stage === 'resultado', 5000, 'resultado');
  const res = witness.sala.meeting.result;
  ok(res.ejectedId === imp.me && res.wasImpostor === true, 'el impostor es expulsado');
  await until(() => witness.sala.phase === 'fin', 15000, 'fin');
  ok(witness.sala.ending.winner === 'tripulantes', 'ganan los tripulantes');
  ok(witness.sala.players.every((p) => p.role), 'al final se revelan todos los roles');
  await until(() => witness.sala.phase === 'lobby', 12000, 'vuelta al lobby');
  ok(true, 'vuelven al lobby');
  console.log('\nPartida completa OK.');
  process.exit(0);
})();
