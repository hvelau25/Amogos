// Rendimiento: peor caso (12 jugadores juntos, luces, mapa grande, partículas, reunión) con CPU limitado (THROTTLE=6 por defecto, simula celular). Uso: [MAP=hielo] node test/rendimiento.js (con el servidor corriendo). Meta: 60 FPS y pocos cuadros >33ms.
const path = require('path');
const ROOT = path.join(__dirname, '..');
const LA = process.env.LOCALAPPDATA || '';
const PWPATH = process.env.PW || LA + '/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright-core';
const CHROMEPATH = process.env.CHROME || LA + '/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
const { io } = require(ROOT + '/node_modules/socket.io-client');
const S = require(ROOT + '/shared/game.js');
const { chromium } = require(PWPATH);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const THROTTLE = Number(process.env.THROTTLE || 6);
const MAPKEY = process.env.MAP || 'estacion';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROMEPATH });
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:3000/');
  await page.fill('#nombre', 'Perf');
  await page.click('#btnCrear');
  await wait(600);
  const code = await page.evaluate(() => __amogos.room.code);
  const bots = [];
  for (let i = 0; i < 11; i++) {
    const s = io('http://localhost:3000', { transports: ['websocket'], forceNew: true });
    s.on('sala', (r) => { s.room = r; });
    const res = await new Promise((r) => s.emit('unirse', { code, name: 'B' + i, token: 'p2' + i + Date.now() }, r));
    s.myId = res.me; s.room = res.room;
    bots.push(s);
  }
  if (MAPKEY === 'hielo') {
    await page.evaluate(() => document.getElementById('btnAjustes').click());
    await wait(200);
    await page.evaluate(() => [...document.querySelectorAll('.opcion')].find((b) => b.textContent === 'Base Polar').click());
    await page.evaluate(() => document.getElementById('btnCerrarAjustes').click());
  }
  await page.evaluate(() => document.getElementById('btnEmpezar').click());
  await wait(4800);
  // Bots alrededor del spawn: se ven todos en pantalla a la vez, moviéndose.
  let tt = 0;
  const timer = setInterval(() => {
    tt += 0.05;
    bots.forEach((b, i) => {
      const p = b.room && b.room.players.find((q) => q.id === b.myId);
      if (!p) return;
      const a = tt * 0.8 + i;
      const map = S.MAPS[b.room.map];
      const cx = map.spawn.x * 64, cy = map.spawn.y * 64;
      const r = S.move(map, p.x, p.y, Math.cos(a) * 10, Math.sin(a) * 10, 22, false);
      p.x = r.x; p.y = r.y;
      b.volatile.emit('mov', { x: r.x, y: r.y, f: Math.cos(a) > 0 ? 1 : -1, m: 1 });
    });
  }, 50);

  await page.evaluate(() => {
    const st = { deltas: [], frame: [], last: 0 };
    window.__perf = st;
    const f = Render.frame;
    Render.frame = function () { const t = performance.now(); const r = f.apply(this, arguments); st.frame.push(performance.now() - t); return r; };
    const tick = (t) => { if (st.last) st.deltas.push(t - st.last); st.last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

  const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : 0; };
  const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  async function measure(label, secs, setup) {
    if (setup) await setup();
    await page.evaluate(() => { const p = window.__perf; p.deltas.length = 0; p.frame.length = 0; });
    const m0 = await metrics();
    await wait(secs * 1000);
    const m1 = await metrics();
    const r = await page.evaluate(() => ({ d: window.__perf.deltas.slice(), f: window.__perf.frame.slice() }));
    const fps = r.d.length / (r.d.reduce((a, b) => a + b, 0) / 1000);
    const per = (k) => ((m1[k] - m0[k]) / secs).toFixed(0);
    console.log(label.padEnd(26), 'FPS', fps.toFixed(0).padStart(3), '| p95', pct(r.d, 0.95).toFixed(0).padStart(3) + 'ms',
      '| >33ms:', String(r.d.filter((x) => x > 33).length).padStart(3), '| mundo avg', avg(r.f).toFixed(1) + 'ms',
      '| layouts/s', per('LayoutCount').padStart(4), '| estilos/s', per('RecalcStyleCount').padStart(4),
      '| CPU script', (((m1.ScriptDuration - m0.ScriptDuration) / secs) * 100).toFixed(0) + '%', '| tarea', (((m1.TaskDuration - m0.TaskDuration) / secs) * 100).toFixed(0) + '%');
  }

  console.log(`\n== PEOR CASO ${MAPKEY}: 12 jugadores juntos, CPU x${THROTTLE} ==`);
  await measure('12 juntos, caminando', 5, async () => { await page.keyboard.down('d'); });
  await page.keyboard.up('d');
  await measure('+ luces apagadas', 5, async () => { await page.evaluate(() => { __amogos.room.sabotage = { kind: 'luces' }; }); });
  await page.evaluate(() => { __amogos.room.sabotage = null; });
  await measure('+ mapa grande abierto', 5, async () => { await page.keyboard.press('m'); });
  await page.keyboard.press('m');
  await measure('+ explosión de partículas', 4, async () => {
    await page.evaluate(() => { for (let i = 0; i < 20; i++) setTimeout(() => { Render.burst(__amogos.camX + i * 10, __amogos.camY, 'sparkle'); Render.burst(__amogos.camX, __amogos.camY + i * 6, 'splat'); }, i * 150); });
  });

  // Reunión con 12 tarjetas: un bot camina al botón y lo presiona
  const b0 = bots[0];
  const em = S.MAPS[MAPKEY].emergency;
  await wait(Math.max(0, 16000 - 5000 - 25000 + 25000)); // el botón se habilita 15 s tras empezar
  const p = b0.room.players.find((q) => q.id === b0.myId);
  let x = p.x, y = p.y;
  clearInterval(timer);
  for (let i = 0; i < 400; i++) {
    const dx = em.x * 64 - x, dy = em.y * 64 + 40 - y, d = Math.hypot(dx, dy);
    if (d < 6) break;
    const st = Math.min(d, 12); x += dx / d * st; y += dy / d * st;
    b0.emit('mov', { x, y, f: 1, m: 1 }); await wait(50);
  }
  b0.emit('emergencia');
  await wait(2500);
  console.log('fase:', await page.evaluate(() => __amogos.room.phase));
  await measure('reunión (12 tarjetas+chat)', 5);
  const mem = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : -1);
  console.log('memoria JS (MB):', mem, '| errores:', errors.length ? errors : 'ninguno');
  bots.forEach((b) => b.close());
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
