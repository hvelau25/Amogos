// Prueba de la Fase 9: sombrero/outfit, cámaras de seguridad y objetos sólidos (en el servidor).
// Uso: node test/fase9.js   (MAP=hielo para la Base Polar; con el servidor corriendo)
const { io } = require('socket.io-client');
const S = require('../shared/game.js');
const Walk = require('./caminar.js');
const URL = process.env.URL || 'http://localhost:3000';
const MAPKEY = process.env.MAP || 'estacion';
const MAP = S.MAPS[MAPKEY];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (cond, msg) => { if (!cond) { console.error('FALLA:', msg); process.exit(1); } console.log('ok -', msg); };

function bot(name, i) {
  const s = io(URL, { transports: ['websocket'], forceNew: true });
  const b = { s, name, sala: null, me: null, x: 0, y: 0 };
  s.on('sala', (r) => (b.sala = r));
  s.on('corr', (c) => { b.x = c.x; b.y = c.y; });
  b.emit = (ev, d) => new Promise((r) => s.emit(ev, d, r));
  b.token = 'fase9' + i + Math.random().toString(36).slice(2, 10);
  return b;
}
const self = (b, who) => b.sala.players.find((p) => p.id === (who || b).me);

(async () => {
  const bots = ['Ana', 'Beto', 'Caro'].map(bot);
  const [A, B, C] = bots;
  const r = await A.emit('crear', { name: 'Ana', token: A.token, hat: 3, outfit: 4 });
  A.me = r.me;
  for (const b of [B, C]) b.me = (await b.emit('unirse', { code: r.room.code, name: b.name, token: b.token, hat: 99, outfit: -1 })).me;
  await wait(200);
  ok(self(B, A).hat === 3 && self(B, A).outfit === 4, 'el sombrero y outfit al crear llegan a los demás');
  ok(self(A, B).hat === 0 && self(A, B).outfit === 0, 'valores inválidos quedan en "nada"');
  B.s.emit('look', { hat: 7, outfit: 2 }); await wait(200);
  ok(self(A, B).hat === 7 && self(A, B).outfit === 2, 'cambiar sombrero/outfit en el lobby');

  A.s.emit('ajustes', { map: S.MAP_CHOICES.indexOf(MAPKEY) }); await wait(150);
  await new Promise((res) => A.s.emit('empezar', res)); await wait(300);
  for (const b of bots) { const p = self(b); b.x = p.x; b.y = p.y; }
  B.s.emit('look', { hat: 1 }); await wait(200);
  ok(self(A, B).hat === 7, 'no se cambia la apariencia a media partida');
  await wait(4000); // revelación

  // Objetos sólidos: el servidor no deja atravesar el primer objeto del mapa
  const blk = MAP.blocks[0];
  const crew = bots.find((b) => b.sala.me.role !== 'impostor');
  const cx = (blk.x0 + blk.x1) / 2, top = blk.y0 - S.PLAYER_RADIUS - 6;
  await Walk.walkTo(MAP, crew, cx, top);
  const yBefore = crew.y;
  for (let i = 0; i < 12; i++) { crew.y += 10; crew.s.emit('mov', { x: crew.x, y: crew.y, f: 1, m: 1 }); await wait(50); }
  await wait(300);
  const me = { x: crew.x, y: crew.y }; // posición corregida por el servidor ('corr')
  ok(!(me.x + S.PLAYER_RADIUS > blk.x0 && me.x - S.PLAYER_RADIUS < blk.x1 && me.y + S.PLAYER_RADIUS > blk.y0 && me.y - S.PLAYER_RADIUS < blk.y1),
    `no se puede entrar al objeto (${yBefore.toFixed(0)} → ${me.y.toFixed(0)}, objeto desde y=${blk.y0.toFixed(0)})`);

  // Cámaras: lejos no se puede mirar; en el panel sí, y los demás ven la luz encendida
  const watcher = bots.find((b) => b !== crew);
  watcher.s.emit('camaras', true); await wait(250);
  ok(!A.sala.camsOn, 'lejos del panel no se pueden mirar las cámaras');
  const pn = MAP.cameras.panel;
  await Walk.walkTo(MAP, watcher, pn.x * S.TILE, pn.y * S.TILE + 50);
  watcher.s.emit('camaras', true); await wait(250);
  ok(A.sala.camsOn && watcher.sala.me.watching, 'en el panel se miran las cámaras y se enciende la luz para todos');
  watcher.s.emit('camaras', false); await wait(250);
  ok(!A.sala.camsOn, 'al cerrar se apaga la luz');
  watcher.s.emit('camaras', true); await wait(250);
  ok(A.sala.camsOn, 'se puede volver a mirar');
  watcher.s.emit('mov', { x: watcher.x + 5, y: watcher.y, f: 1, m: 1 }); await wait(250);
  ok(!A.sala.camsOn, 'moverse deja de mirar');
  watcher.s.emit('camaras', true); await wait(250);
  // Una reunión saca a todos de las cámaras
  const caller = crew;
  await Walk.walkTo(MAP, caller, MAP.emergency.x * S.TILE, MAP.emergency.y * S.TILE + 60);
  await wait(15500 - 4000); // espera del botón de emergencia
  caller.s.emit('emergencia'); await wait(300);
  ok(A.sala.phase === 'reunion' && !watcher.sala.me.watching, 'la reunión saca a todos de las cámaras');
  bots.forEach((b) => b.s.close());
  console.log('\nFase 9 OK.');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
