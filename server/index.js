const path = require('path');
const http = require('http');
const os = require('os');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const S = require('../shared/game.js');

const PORT = process.env.PORT || 3000;
const TICK_MS = 50; // 20 actualizaciones por segundo
const RECONNECT_GRACE_MS = 45000; // tiempo para volver si se cae la conexión (pantalla bloqueada, etc.)
const ROLE_REVEAL_MS = 4000; // pantalla de "eres impostor/tripulante"
const FIRST_KILL_COOLDOWN = 12; // segundos
const EMERGENCY_COOLDOWN = 15; // segundos tras empezar o tras una reunión
const VOTE_REVEAL_MS = 4500; // mostrar quién votó a quién
const EJECT_MS = 6000; // pantalla de expulsión
const END_MS = 9000; // pantalla de fin antes de volver al lobby
const CHAT_MIN_INTERVAL_MS = 700;
const CHAT_HISTORY = 60;

const app = express();
app.use(express.static(path.join(__dirname, '..', 'public'), {
  // Las fuentes no cambian: que el celular las guarde un año. El resto se revalida (así un deploy nuevo se ve al instante).
  setHeaders: (res, file) => { if (file.endsWith('.woff2')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); },
}));
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));
app.get('/salud', (_req, res) => res.send('ok'));

const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 8000 });

/** @type {Map<string, any>} */
const rooms = new Map();

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin I ni O para no confundir
function newCode() {
  for (let i = 0; i < 1000; i++) {
    let c = '';
    for (let j = 0; j < 4; j++) c += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
    if (!rooms.has(c)) return c;
  }
  throw new Error('sin códigos libres');
}

function cleanName(n) {
  n = String(n || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, S.NAME_MAX);
  return n || 'Tripulante';
}
function cleanToken(t) {
  t = String(t || '');
  return /^[a-zA-Z0-9_-]{8,64}$/.test(t) ? t : null;
}

const inMatch = (room) => room.phase !== 'lobby';
const alivePlayers = (room) => [...room.players.values()].filter((p) => p.alive);
const deadRoom = (room) => room.code + ':muertos';

// ---------- Estado que ve cada jugador ----------
// Cada uno recibe una versión distinta: roles ajenos y fantasmas quedan ocultos.
function stateFor(room, viewer) {
  const now = Date.now();
  const showAll = room.phase === 'fin';
  const viewerKnowsDead = !viewer.alive || room.phase === 'reunion' || room.phase === 'expulsion' || showAll;
  const players = [];
  for (const p of room.players.values()) {
    if (inMatch(room) && !p.alive && !viewerKnowsDead) continue; // los vivos no ven fantasmas
    if (p.inVent && p.id !== viewer.id) continue; // nadie ve a quien está en una ventilación
    const out = { id: p.id, name: p.name, color: p.color, x: p.x, y: p.y, f: p.f, conn: p.connected };
    if (inMatch(room)) {
      out.alive = p.alive;
      if (showAll || p.id === viewer.id || (viewer.role === 'impostor' && p.role === 'impostor')) out.role = p.role;
    }
    players.push(out);
  }
  const st = {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    map: room.map,
    settings: room.settings,
    players,
    bodies: room.bodies,
  };
  if (inMatch(room)) {
    st.me = {
      role: viewer.role,
      alive: viewer.alive,
      killIn: viewer.role === 'impostor' ? Math.max(0, viewer.killReadyAt - now) : null,
      emergencies: viewer.emergenciesLeft,
      tasks: (viewer.tasks || []).map((k) => ({ id: k.id, done: k.done, step: k.step, steps: k.steps.length, station: k.steps[Math.min(k.step, k.steps.length - 1)] })),
      inVent: viewer.inVent || null,
      sabotageIn: viewer.role === 'impostor' ? Math.max(0, room.sabotageReadyAt - now) : null,
    };
    st.taskProgress = taskProgress(room);
    if (room.sabotage) {
      const sb = room.sabotage;
      st.sabotage = { kind: sb.kind };
      if (sb.kind === 'reactor') {
        st.sabotage.endsIn = Math.max(0, sb.endsAt - now);
        st.sabotage.hands = { A: !!sb.hands.A, B: !!sb.hands.B };
      }
    }
    st.emergencyIn = Math.max(0, room.emergencyReadyAt - now);
    st.impostorCount = room.impostorTotal;
  }
  if (room.meeting) {
    const m = room.meeting;
    st.meeting = {
      reason: m.reason,
      callerId: m.callerId,
      bodyId: m.bodyId,
      stage: m.stage,
      endsIn: Math.max(0, m.endsAt - now),
      voted: [...m.votes.keys()],
      result: m.result,
    };
  }
  if (room.ending) st.ending = room.ending;
  return st;
}

function sendRoom(room) {
  for (const p of room.players.values()) {
    if (p.connected) io.to(p.socketId).emit('sala', stateFor(room, p));
  }
}

function freeColor(room, preferred) {
  const used = new Set([...room.players.values()].map((p) => p.color));
  if (preferred != null && preferred >= 0 && preferred < S.COLORS.length && !used.has(preferred)) return preferred;
  for (let i = 0; i < S.COLORS.length; i++) if (!used.has(i)) return i;
  return 0;
}

function placeAll(room, onlyAlive) {
  const map = S.MAPS[room.map];
  const list = [...room.players.values()].filter((p) => !onlyAlive || p.alive);
  list.forEach((p, i) => {
    const sp = S.spawnPoint(map, i, list.length);
    p.x = sp.x;
    p.y = sp.y;
    p.lastMoveAt = Date.now();
    p.dirty = true;
    const sock = io.sockets.sockets.get(p.socketId);
    if (sock) sock.emit('corr', { x: p.x, y: p.y });
  });
}

function addPlayer(room, socket, name, token, preferredColor) {
  const map = S.MAPS[room.map];
  const sp = S.spawnPoint(map, room.players.size, room.players.size + 1);
  const p = {
    id: room.nextId++,
    token,
    socketId: socket.id,
    name,
    color: freeColor(room, preferredColor),
    x: sp.x,
    y: sp.y,
    f: 1,
    moving: false,
    connected: true,
    removeTimer: null,
    lastMoveAt: Date.now(),
    lastChatAt: 0,
    dirty: true,
    role: null,
    alive: true,
    killReadyAt: 0,
    emergenciesLeft: 0,
    tasks: [],
    taskOpen: null,
    inVent: null,
  };
  room.players.set(p.id, p);
  if (room.hostId == null) room.hostId = p.id;
  return p;
}

function removePlayer(room, p) {
  clearTimeout(p.removeTimer);
  room.players.delete(p.id);
  if (room.players.size === 0) {
    clearTimeout(room.timer);
    clearTimeout(room.sabTimer);
    rooms.delete(room.code);
    return;
  }
  if (room.hostId === p.id) {
    const next = [...room.players.values()].find((q) => q.connected) || room.players.values().next().value;
    room.hostId = next.id;
  }
  if (room.meeting) room.meeting.votes.delete(p.id);
  releaseHands(room, p);
  if (inMatch(room) && room.phase !== 'fin') {
    if (checkWin(room)) return;
    if (room.phase === 'reunion' && room.meeting.stage === 'votacion') maybeEndVoting(room);
  }
  sendRoom(room);
}

function bindSocket(socket, room, p) {
  socket.data.code = room.code;
  socket.data.pid = p.id;
  socket.join(room.code);
  if (inMatch(room) && !p.alive) socket.join(deadRoom(room));
  else socket.leave(deadRoom(room));
}

function current(socket) {
  const room = rooms.get(socket.data.code);
  if (!room) return {};
  const p = room.players.get(socket.data.pid);
  if (!p || p.socketId !== socket.id) return {};
  return { room, p };
}

function leaveCurrent(socket) {
  const { room, p } = current(socket);
  if (!room) return;
  socket.leave(room.code);
  socket.leave(deadRoom(room));
  socket.data.code = null;
  removePlayer(room, p);
}

function setTimer(room, ms, fn) {
  clearTimeout(room.timer);
  room.timer = setTimeout(() => {
    if (rooms.get(room.code) === room) fn();
  }, ms);
}

// ---------- Tareas y sabotajes ----------
function taskProgress(room) {
  let done = 0, total = 0;
  for (const p of room.players.values()) {
    if (p.role !== 'tripulante') continue;
    for (const k of p.tasks) { total += k.steps.length; done += k.step; } // cada etapa cuenta
  }
  return { done, total };
}

function assignTasks(room, p) {
  const all = S.taskPool(S.MAPS[room.map]);
  for (let i = all.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [all[i], all[j]] = [all[j], all[i]];
  }
  p.tasks = all.slice(0, room.settings.tasks).map((t) => ({ id: t.id, steps: t.steps, step: 0, done: false }));
  p.taskOpen = null;
}

function near(p, spot, range) {
  return !!spot && Math.hypot(spot.x * S.TILE - p.x, spot.y * S.TILE - p.y) <= range + 16;
}

function clearSabotage(room) {
  clearTimeout(room.sabTimer);
  room.sabTimer = null;
  room.sabotage = null;
  room.sabotageReadyAt = Date.now() + S.SABOTAGE_COOLDOWN * 1000;
}

function releaseHands(room, p) {
  const sb = room.sabotage;
  if (!sb || sb.kind !== 'reactor') return false;
  let changed = false;
  for (const k of ['A', 'B']) if (sb.hands[k] === p.id) { sb.hands[k] = null; changed = true; }
  return changed;
}

// ---------- Flujo de partida ----------
function startGame(room) {
  const list = [...room.players.values()];
  const nImp = S.impostorCount(list.length, room.settings.impostors);
  const shuffled = list.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const now = Date.now();
  // El mapa se elige antes de repartir tareas (salen del mapa). 2 = aleatorio.
  const choice = room.settings.map;
  room.map = choice === 2 ? S.MAP_CHOICES[crypto.randomInt(S.MAP_CHOICES.length)] : S.MAP_CHOICES[choice] || 'estacion';
  shuffled.forEach((p, i) => {
    p.role = i < nImp ? 'impostor' : 'tripulante';
    p.alive = true;
    p.killReadyAt = now + ROLE_REVEAL_MS + FIRST_KILL_COOLDOWN * 1000;
    p.emergenciesLeft = room.settings.emergencies;
    p.inVent = null;
    assignTasks(room, p); // los impostores reciben una lista falsa para disimular
    const sock = io.sockets.sockets.get(p.socketId);
    if (sock) sock.leave(deadRoom(room));
  });
  room.impostorTotal = nImp;
  room.phase = 'juego';
  room.bodies = [];
  room.meeting = null;
  room.ending = null;
  room.chat = [];
  room.emergencyReadyAt = now + ROLE_REVEAL_MS + EMERGENCY_COOLDOWN * 1000;
  room.frozenUntil = now + ROLE_REVEAL_MS;
  clearTimeout(room.sabTimer);
  room.sabotage = null;
  room.sabotageReadyAt = now + ROLE_REVEAL_MS + 15000;
  placeAll(room);
  sendRoom(room);
  io.to(room.code).emit('revelar');
}

function backToLobby(room) {
  clearTimeout(room.timer);
  clearTimeout(room.sabTimer);
  room.sabotage = null;
  room.phase = 'lobby';
  room.map = 'lobby';
  room.bodies = [];
  room.meeting = null;
  room.ending = null;
  room.chat = [];
  for (const p of room.players.values()) {
    p.role = null;
    p.alive = true;
    p.tasks = [];
    p.inVent = null;
    const sock = io.sockets.sockets.get(p.socketId);
    if (sock) sock.leave(deadRoom(room));
  }
  placeAll(room);
  sendRoom(room);
}

function checkWin(room) {
  const alive = alivePlayers(room);
  const imps = alive.filter((p) => p.role === 'impostor').length;
  const crew = alive.length - imps;
  let winner = null, reason = '';
  const tp = taskProgress(room);
  if (imps === 0) { winner = 'tripulantes'; reason = 'Todos los impostores fueron expulsados.'; }
  else if (tp.total > 0 && tp.done >= tp.total) { winner = 'tripulantes'; reason = 'Completaron todas las tareas.'; }
  else if (imps >= crew) { winner = 'impostores'; reason = 'Los impostores igualaron a los tripulantes.'; }
  if (!winner) return false;
  endGame(room, winner, reason);
  return true;
}

function endGame(room, winner, reason) {
  clearTimeout(room.sabTimer);
  room.sabotage = null;
  for (const p of room.players.values()) p.inVent = null;
  room.phase = 'fin';
  room.meeting = null;
  room.ending = { winner, reason };
  sendRoom(room);
  setTimer(room, END_MS, () => backToLobby(room));
}

function killPlayer(room, victim, leaveBody) {
  victim.alive = false;
  victim.moving = false;
  victim.inVent = null;
  releaseHands(room, victim);
  if (leaveBody) room.bodies.push({ id: victim.id, color: victim.color, x: Math.round(victim.x), y: Math.round(victim.y) });
  const sock = io.sockets.sockets.get(victim.socketId);
  if (sock) sock.join(deadRoom(room));
}

function startMeeting(room, caller, reason, bodyId) {
  const now = Date.now();
  room.phase = 'reunion';
  room.meeting = {
    reason,
    callerId: caller.id,
    bodyId: bodyId == null ? null : bodyId,
    stage: 'discusion',
    endsAt: now + room.settings.discussion * 1000,
    votes: new Map(),
    result: null,
  };
  room.chat = [];
  if (room.sabotage && room.sabotage.kind === 'reactor') clearSabotage(room);
  for (const p of room.players.values()) { p.moving = false; p.inVent = null; p.taskOpen = null; }
  sendRoom(room);
  setTimer(room, room.settings.discussion * 1000, () => startVoting(room));
}

function startVoting(room) {
  const m = room.meeting;
  if (!m) return;
  m.stage = 'votacion';
  m.endsAt = Date.now() + room.settings.voting * 1000;
  sendRoom(room);
  setTimer(room, room.settings.voting * 1000, () => finishVoting(room));
}

function maybeEndVoting(room) {
  const m = room.meeting;
  if (!m || m.stage !== 'votacion') return;
  const voters = alivePlayers(room);
  if (voters.every((p) => m.votes.has(p.id))) finishVoting(room);
}

function finishVoting(room) {
  const m = room.meeting;
  if (!m || m.stage !== 'votacion') return;
  const tally = {}; // destino -> [votantes]   ('skip' = saltar)
  for (const [voter, target] of m.votes) {
    if (!room.players.get(voter) || !room.players.get(voter).alive) continue;
    (tally[target] = tally[target] || []).push(voter);
  }
  let best = null, bestN = 0, tie = false;
  for (const [target, voters] of Object.entries(tally)) {
    if (voters.length > bestN) { best = target; bestN = voters.length; tie = false; }
    else if (voters.length === bestN) tie = true;
  }
  let ejected = null;
  if (best && best !== 'skip' && !tie) ejected = room.players.get(Number(best)) || null;
  if (ejected) killPlayer(room, ejected, false);
  const impLeft = alivePlayers(room).filter((p) => p.role === 'impostor').length;
  m.stage = 'resultado';
  m.endsAt = Date.now() + VOTE_REVEAL_MS;
  m.result = {
    tally,
    tie,
    ejectedId: ejected ? ejected.id : null,
    ejectedName: ejected ? ejected.name : null,
    ejectedColor: ejected ? ejected.color : null,
    wasImpostor: ejected ? ejected.role === 'impostor' : null,
    impostorsLeft: impLeft,
  };
  sendRoom(room);
  setTimer(room, VOTE_REVEAL_MS, () => {
    room.phase = 'expulsion';
    m.stage = 'expulsion';
    m.endsAt = Date.now() + EJECT_MS;
    sendRoom(room);
    setTimer(room, EJECT_MS, () => endMeeting(room));
  });
}

function endMeeting(room) {
  if (checkWin(room)) return;
  const now = Date.now();
  room.phase = 'juego';
  room.meeting = null;
  room.bodies = [];
  room.emergencyReadyAt = now + EMERGENCY_COOLDOWN * 1000;
  for (const p of room.players.values()) {
    if (p.role === 'impostor') p.killReadyAt = now + room.settings.killCooldown * 1000;
  }
  placeAll(room, true);
  sendRoom(room);
}

function addChat(room, p, text) {
  const ghost = !p.alive;
  const msg = { id: p.id, name: p.name, color: p.color, text, ghost, t: Date.now() };
  room.chat.push(msg);
  if (room.chat.length > CHAT_HISTORY) room.chat.shift();
  if (ghost) io.to(deadRoom(room)).emit('chat', msg);
  else io.to(room.code).emit('chat', msg);
}

function chatFor(room, p) {
  return (room.chat || []).filter((m) => !m.ghost || !p.alive);
}

// ---------- Eventos ----------
io.on('connection', (socket) => {
  socket.on('crear', (msg, ack) => {
    if (typeof ack !== 'function') return;
    leaveCurrent(socket);
    const token = cleanToken(msg && msg.token);
    if (!token) return ack({ ok: false, error: 'Token inválido, recarga la página.' });
    const code = newCode();
    const room = {
      code, hostId: null, phase: 'lobby', map: 'lobby', players: new Map(), nextId: 1,
      settings: { ...S.DEFAULT_SETTINGS }, bodies: [], meeting: null, chat: [], timer: null,
      emergencyReadyAt: 0, frozenUntil: 0, impostorTotal: 0, ending: null,
      sabotage: null, sabTimer: null, sabotageReadyAt: 0,
    };
    rooms.set(code, room);
    const p = addPlayer(room, socket, cleanName(msg.name), token, msg.color);
    bindSocket(socket, room, p);
    ack({ ok: true, me: p.id, room: stateFor(room, p), chat: [] });
  });

  socket.on('unirse', (msg, ack) => {
    if (typeof ack !== 'function') return;
    const token = cleanToken(msg && msg.token);
    if (!token) return ack({ ok: false, error: 'Token inválido, recarga la página.' });
    const code = String(msg.code || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return ack({ ok: false, error: 'No existe una sala con ese código.' });
    if (socket.data.code && socket.data.code !== code) leaveCurrent(socket);

    // Si este token ya estaba en la sala, es una reconexión.
    const existing = [...room.players.values()].find((q) => q.token === token);
    if (existing) {
      const old = io.sockets.sockets.get(existing.socketId);
      if (old && old.id !== socket.id) old.disconnect(true);
      clearTimeout(existing.removeTimer);
      existing.removeTimer = null;
      existing.socketId = socket.id;
      existing.connected = true;
      if (msg.name && room.phase === 'lobby') existing.name = cleanName(msg.name);
      bindSocket(socket, room, existing);
      ack({ ok: true, me: existing.id, room: stateFor(room, existing), chat: chatFor(room, existing) });
      sendRoom(room);
      return;
    }

    if (room.phase !== 'lobby') return ack({ ok: false, error: 'La partida ya empezó. Espera a la siguiente.' });
    if (room.players.size >= S.MAX_PLAYERS) return ack({ ok: false, error: 'La sala está llena (máx. 12).' });
    const p = addPlayer(room, socket, cleanName(msg.name), token, msg.color);
    bindSocket(socket, room, p);
    ack({ ok: true, me: p.id, room: stateFor(room, p), chat: [] });
    sendRoom(room);
  });

  socket.on('color', (c) => {
    const { room, p } = current(socket);
    if (!room || room.phase !== 'lobby') return;
    c = Number(c);
    if (!Number.isInteger(c) || c < 0 || c >= S.COLORS.length) return;
    if ([...room.players.values()].some((q) => q.id !== p.id && q.color === c)) return;
    p.color = c;
    sendRoom(room);
  });

  socket.on('ajustes', (a) => {
    const { room, p } = current(socket);
    if (!room || room.phase !== 'lobby' || room.hostId !== p.id || !a) return;
    for (const k of Object.keys(S.SETTINGS_OPTIONS)) {
      if (a[k] === undefined) continue;
      const v = Number(a[k]);
      if (S.SETTINGS_OPTIONS[k].includes(v)) room.settings[k] = v;
    }
    sendRoom(room);
  });

  socket.on('mov', (m) => {
    const { room, p } = current(socket);
    if (!room || !m) return;
    if (room.phase !== 'lobby' && room.phase !== 'juego') return;
    const now = Date.now();
    if (room.phase === 'juego' && now < room.frozenUntil) return void socket.emit('corr', { x: p.x, y: p.y });
    const x = Number(m.x), y = Number(m.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const elapsed = Math.min((now - p.lastMoveAt) / 1000, 0.5);
    p.lastMoveAt = now;
    // El servidor aplica el movimiento con las mismas colisiones, limitado a la velocidad máxima.
    const maxStep = S.PLAYER_SPEED * elapsed * 1.4 + 12;
    let dx = x - p.x, dy = y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > maxStep) {
      dx = (dx / d) * maxStep;
      dy = (dy / d) * maxStep;
    }
    if (p.inVent) return void socket.emit('corr', { x: p.x, y: p.y });
    const ghost = inMatch(room) && !p.alive;
    const res = S.move(S.MAPS[room.map], p.x, p.y, dx, dy, S.PLAYER_RADIUS, ghost);
    p.x = res.x;
    p.y = res.y;
    p.f = m.f === -1 ? -1 : 1;
    p.moving = !!m.m;
    p.dirty = true;
    if (Math.hypot(p.x - x, p.y - y) > 24) socket.emit('corr', { x: p.x, y: p.y });
    const sb = room.sabotage;
    if (sb && sb.kind === 'reactor') {
      const fx = S.MAPS[room.map].fixes;
      let changed = false;
      for (const k of ['A', 'B']) if (sb.hands[k] === p.id && !near(p, fx['reactor' + k], S.USE_RANGE)) { sb.hands[k] = null; changed = true; }
      if (changed) sendRoom(room);
    }
  });

  socket.on('empezar', (...args) => {
    const { room, p } = current(socket);
    const reply = args.find((a) => typeof a === 'function') || (() => {});
    if (!room || room.hostId !== p.id || room.phase !== 'lobby') return reply({ ok: false });
    if (room.players.size < S.MIN_PLAYERS) return reply({ ok: false, error: `Se necesitan al menos ${S.MIN_PLAYERS} jugadores.` });
    startGame(room);
    reply({ ok: true });
  });

  socket.on('volverLobby', () => {
    const { room, p } = current(socket);
    if (!room || room.hostId !== p.id || room.phase === 'lobby') return;
    backToLobby(room);
  });

  socket.on('matar', (targetId) => {
    const { room, p } = current(socket);
    if (!room || room.phase !== 'juego' || !p.alive || p.role !== 'impostor') return;
    const now = Date.now();
    if (now < p.killReadyAt || now < room.frozenUntil || p.inVent) return;
    const t = room.players.get(Number(targetId));
    if (!t || !t.alive || t.role === 'impostor') return;
    if (Math.hypot(t.x - p.x, t.y - p.y) > S.KILL_RANGE + 16) return;
    killPlayer(room, t, true);
    // El impostor queda sobre el cuerpo.
    p.x = t.x;
    p.y = t.y;
    p.dirty = true;
    socket.emit('corr', { x: p.x, y: p.y });
    p.killReadyAt = now + room.settings.killCooldown * 1000;
    const vs = io.sockets.sockets.get(t.socketId);
    if (vs) vs.emit('muerte', { killerColor: p.color });
    if (checkWin(room)) return;
    sendRoom(room);
  });

  socket.on('reportar', (bodyId) => {
    const { room, p } = current(socket);
    if (!room || room.phase !== 'juego' || !p.alive) return;
    if (p.inVent) return;
    const b = room.bodies.find((q) => q.id === Number(bodyId));
    if (!b || Math.hypot(b.x - p.x, b.y - p.y) > S.REPORT_RANGE + 16) return;
    startMeeting(room, p, 'cuerpo', b.id);
  });

  socket.on('emergencia', () => {
    const { room, p } = current(socket);
    if (!room || room.phase !== 'juego' || !p.alive) return;
    if (p.emergenciesLeft <= 0 || Date.now() < room.emergencyReadyAt || room.sabotage || p.inVent) return;
    const e = S.MAPS[room.map].emergency;
    if (!e || Math.hypot(e.x * S.TILE - p.x, e.y * S.TILE - p.y) > S.USE_RANGE + 16) return;
    p.emergenciesLeft--;
    startMeeting(room, p, 'emergencia', null);
  });

  socket.on('votar', (target) => {
    const { room, p } = current(socket);
    if (!room || !room.meeting || room.meeting.stage !== 'votacion' || !p.alive) return;
    if (room.meeting.votes.has(p.id)) return;
    if (target !== 'skip') {
      const t = room.players.get(Number(target));
      if (!t || !t.alive) return;
      target = t.id;
    }
    room.meeting.votes.set(p.id, target);
    sendRoom(room);
    maybeEndVoting(room);
  });

  socket.on('chat', (text) => {
    const { room, p } = current(socket);
    if (!room) return;
    text = String(text || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, S.CHAT_MAX);
    if (!text) return;
    const now = Date.now();
    if (now - p.lastChatAt < CHAT_MIN_INTERVAL_MS) return;
    // Vivos: solo en el lobby y en reuniones. Fantasmas: siempre (entre ellos).
    const meetingOpen = room.phase === 'reunion' || room.phase === 'expulsion';
    if (p.alive && !(room.phase === 'lobby' || meetingOpen || room.phase === 'fin')) return;
    p.lastChatAt = now;
    if (room.phase === 'lobby' || room.phase === 'fin') {
      const msg = { id: p.id, name: p.name, color: p.color, text, ghost: false, t: now };
      io.to(room.code).emit('chat', msg);
      return;
    }
    addChat(room, p, text);
  });

  // Tareas: se abre (el servidor anota la hora) y luego se completa.
  socket.on('abrirTarea', (id) => {
    const { room, p } = current(socket);
    if (!room || room.phase !== 'juego' || p.inVent) return;
    const k = p.tasks.find((q) => q.id === id && !q.done);
    const st = k && (S.MAPS[room.map].tasks || []).find((q) => q.id === k.steps[k.step]);
    if (!k || !st || !near(p, st, S.USE_RANGE)) return;
    p.taskOpen = { id, step: k.step, at: Date.now() };
  });

  socket.on('tarea', (id) => {
    const { room, p } = current(socket);
    if (!room || room.phase !== 'juego' || p.role !== 'tripulante') return;
    if (!p.taskOpen || p.taskOpen.id !== id || Date.now() - p.taskOpen.at < 700) return;
    const k = p.tasks.find((q) => q.id === id && !q.done);
    const st = k && (S.MAPS[room.map].tasks || []).find((q) => q.id === k.steps[k.step]);
    if (!k || !st || p.taskOpen.step !== k.step || !near(p, st, S.USE_RANGE)) return;
    k.step++; // siguiente etapa (en otra sala) o tarea terminada
    k.done = k.step >= k.steps.length;
    p.taskOpen = null;
    if (checkWin(room)) return;
    sendRoom(room);
  });

  socket.on('sabotear', (kind) => {
    const { room, p } = current(socket);
    if (!room || room.phase !== 'juego' || p.role !== 'impostor') return;
    const now = Date.now();
    if (room.sabotage || now < room.sabotageReadyAt || now < room.frozenUntil) return;
    if (kind === 'luces') {
      room.sabotage = { kind: 'luces' };
    } else if (kind === 'reactor') {
      room.sabotage = { kind: 'reactor', endsAt: now + S.REACTOR_TIME * 1000, hands: { A: null, B: null } };
      clearTimeout(room.sabTimer);
      room.sabTimer = setTimeout(() => {
        if (rooms.get(room.code) === room && room.phase === 'juego' && room.sabotage && room.sabotage.kind === 'reactor')
          endGame(room, 'impostores', 'El reactor se fundió.');
      }, S.REACTOR_TIME * 1000);
    } else return;
    sendRoom(room);
  });

  socket.on('arreglarLuces', () => {
    const { room, p } = current(socket);
    if (!room || room.phase !== 'juego' || !p.alive || p.inVent) return;
    if (!room.sabotage || room.sabotage.kind !== 'luces') return;
    if (!near(p, S.MAPS[room.map].fixes.luces, S.USE_RANGE)) return;
    clearSabotage(room);
    sendRoom(room);
  });

  // Reactor: hace falta una mano en A y otra en B al mismo tiempo (dos jugadores distintos).
  socket.on('mano', (msg) => {
    const { room, p } = current(socket);
    if (!room || room.phase !== 'juego' || !p.alive || !msg) return;
    const sb = room.sabotage;
    if (!sb || sb.kind !== 'reactor') return;
    const panel = msg.panel === 'B' ? 'B' : 'A';
    if (msg.on) {
      if (!near(p, S.MAPS[room.map].fixes['reactor' + panel], S.USE_RANGE)) return;
      releaseHands(room, p);
      sb.hands[panel] = p.id;
    } else if (sb.hands[panel] === p.id) sb.hands[panel] = null;
    if (sb.hands.A && sb.hands.B && sb.hands.A !== sb.hands.B) clearSabotage(room);
    sendRoom(room);
  });

  socket.on('ventila', () => {
    const { room, p } = current(socket);
    if (!room || room.phase !== 'juego' || !p.alive || p.role !== 'impostor' || Date.now() < room.frozenUntil) return;
    const vents = S.MAPS[room.map].vents || [];
    if (p.inVent) {
      p.inVent = null;
      p.dirty = true;
    } else {
      const v = vents.find((q) => near(p, q, S.USE_RANGE));
      if (!v) return;
      p.inVent = v.id;
      p.x = v.x * S.TILE;
      p.y = v.y * S.TILE;
      p.moving = false;
      socket.emit('corr', { x: p.x, y: p.y });
    }
    sendRoom(room);
  });

  socket.on('ventilaMover', (id) => {
    const { room, p } = current(socket);
    if (!room || room.phase !== 'juego' || !p.inVent) return;
    const vents = S.MAPS[room.map].vents || [];
    const from = vents.find((q) => q.id === p.inVent);
    const to = vents.find((q) => q.id === id);
    if (!from || !to || from.group !== to.group) return;
    p.inVent = to.id;
    p.x = to.x * S.TILE;
    p.y = to.y * S.TILE;
    socket.emit('corr', { x: p.x, y: p.y });
    sendRoom(room);
  });

  socket.on('salir', () => leaveCurrent(socket));

  socket.on('disconnect', () => {
    const { room, p } = current(socket);
    if (!room) return;
    p.connected = false;
    p.moving = false;
    sendRoom(room);
    p.removeTimer = setTimeout(() => {
      if (!p.connected && rooms.get(room.code) === room) removePlayer(room, p);
    }, RECONNECT_GRACE_MS);
  });
});

// Envío periódico de posiciones (solo las que cambiaron). Los fantasmas solo los ven otros fantasmas.
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.phase !== 'lobby' && room.phase !== 'juego') continue;
    const living = [], ghosts = [];
    for (const p of room.players.values()) {
      if (!p.dirty) continue;
      p.dirty = false;
      if (p.inVent) continue;
      const row = [p.id, Math.round(p.x), Math.round(p.y), p.f, p.moving ? 1 : 0];
      if (inMatch(room) && !p.alive) ghosts.push(row);
      else living.push(row);
    }
    if (living.length) io.to(room.code).volatile.emit('s', living);
    if (ghosts.length) io.to(deadRoom(room)).volatile.emit('s', ghosts);
  }
}, TICK_MS);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Amogos corriendo en http://localhost:${PORT}`);
  for (const list of Object.values(os.networkInterfaces()))
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) console.log(`  En tu red: http://${a.address}:${PORT}`);
});
