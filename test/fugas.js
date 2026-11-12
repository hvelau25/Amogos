const path = require('path');
const ROOT = path.join(__dirname, '..');
const LA = process.env.LOCALAPPDATA || '';
const PWPATH = process.env.PW || LA + '/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright-core';
const CHROMEPATH = process.env.CHROME || LA + '/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
const { io } = require(ROOT + '/node_modules/socket.io-client');
const { chromium } = require(PWPATH);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: CHROMEPATH });
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('HeapProfiler.enable');
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:3000/');
  await page.fill('#nombre', 'Leak'); await page.click('#btnCrear'); await wait(600);
  const code = await page.evaluate(() => __amogos.room.code);
  const bots = [];
  for (let i = 0; i < 3; i++) { const s = io('http://localhost:3000', { transports: ['websocket'], forceNew: true }); await new Promise((r) => s.emit('unirse', { code, name: 'B' + i, token: 'lk' + i + Date.now() }, r)); bots.push(s); }
  await page.evaluate(() => document.getElementById('btnEmpezar').click());
  await wait(5000);
  const snap = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    const heap = await page.evaluate(() => Math.round(performance.memory.usedJSHeapSize / 1024));
    const c = await cdp.send('Memory.getDOMCounters');
    return { heapKB: heap, nodes: c.nodes, listeners: c.jsEventListeners };
  };
  const a = await snap();
  const types = ['cables', 'descarga', 'codigo', 'tarjeta', 'interruptores', 'calibrar', 'secuencia', 'frecuencia', 'ordenar'];
  for (let i = 0; i < 60; i++) {
    await page.evaluate(([t, st]) => Tasks.open(t, { title: 'x', step: st }), [types[i % types.length], i % 3]);
    await wait(120);
    await page.evaluate(() => Tasks.close());
    await page.keyboard.press('m'); await wait(60); await page.keyboard.press('m');
    await page.evaluate(() => { const g = __amogos; Render.burst(g.camX, g.camY, 'sparkle'); Render.burst(g.camX, g.camY, 'splat'); Render.burst(g.camX, g.camY, 'puff'); });
  }
  await wait(2500);
  const b = await snap();
  console.log('antes  :', a);
  console.log('después:', b, '(60 ciclos de tarea + mapa + partículas)');
  console.log('crecimiento: heap', b.heapKB - a.heapKB, 'KB | nodos', b.nodes - a.nodes, '| listeners', b.listeners - a.listeners, '| errores:', errors.length ? errors : 'ninguno');
  bots.forEach((x) => x.close());
  await browser.close();
})();
