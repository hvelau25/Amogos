// Mete bots que caminan en círculo en una sala, para probar visualmente.
// En las reuniones escriben en el chat y votan "saltar".
const { io } = require('socket.io-client');
const [code, n = 3, secs = 120] = process.argv.slice(2);
const names = ['Ana', 'Beto', 'Caro', 'Dani', 'Eli', 'Fer', 'Gabi', 'Hugo', 'Iris', 'Juan', 'Kari'];
const frases = ['yo estaba en eléctrica', 'sospecho de alguien…', 'no vi nada', 'saltemos', 'yo hice mis tareas'];
for (let i = 0; i < Number(n); i++) {
  const s = io('http://localhost:3000', { transports: ['websocket'], forceNew: true });
  s.emit('unirse', { code, name: names[i], token: 'bot' + i + 'xxxxxxxx' }, (res) => {
    if (!res.ok) return console.log(res.error);
    let me = res.room.players.find((p) => p.id === res.me), t = i, talked = null, voted = null;
    s.on('sala', (r) => {
      const p = r.players.find((q) => q.id === res.me);
      if (p && Math.hypot(p.x - me.x, p.y - me.y) > 100) me = { ...p };
      const m = r.meeting;
      const alive = !r.me || r.me.alive;
      if (m && alive && talked !== m.callerId + ':' + m.reason + m.bodyId) {
        talked = m.callerId + ':' + m.reason + m.bodyId;
        setTimeout(() => s.emit('chat', frases[(i + Date.now()) % frases.length]), 1500 + i * 900);
      }
      if (m && m.stage === 'votacion' && alive && !m.voted.includes(res.me) && voted !== talked) {
        voted = talked;
        setTimeout(() => s.emit('votar', 'skip'), 1500 + i * 700);
      }
    });
    s.on('corr', (c) => { me.x = c.x; me.y = c.y; });
    setInterval(() => { t += 0.05; const dx = Math.cos(t) * 9, dy = Math.sin(t) * 9; me.x += dx; me.y += dy; s.emit('mov', { x: me.x, y: me.y, f: dx < 0 ? -1 : 1, m: 1 }); }, 50);
  });
}
setTimeout(() => process.exit(0), secs * 1000);
