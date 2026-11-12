// Capturas visuales en tamaño de celular horizontal: HUD de partida y cada minijuego.
// Uso: node test/capturas.js [ruta-a-playwright-core]   (con el servidor corriendo)
const path = require('path');
const { io } = require('socket.io-client');
const pwPath = process.argv[2] || 'playwright-core';
const { chromium } = require(pwPath);
const OUT = path.join(__dirname, '..', '.playwright-mcp');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:3000/');
  await page.fill('#nombre', 'Hector');
  await page.click('#btnCrear');
  await wait(600);
  const code = await page.evaluate(() => __amogos.room.code);

  // 2 bots
  const bots = [];
  for (let i = 0; i < 2; i++) {
    const s = io('http://localhost:3000', { transports: ['websocket'], forceNew: true });
    await new Promise((r) => s.emit('unirse', { code, name: ['Ana', 'Beto'][i], token: 'cap' + i + Date.now() }, r));
    bots.push(s);
  }
  await wait(300);
  await page.evaluate(() => document.getElementById('btnEmpezar').click());
  await wait(4500);
  const role = await page.evaluate(() => __amogos.room.me.role);
  await page.screenshot({ path: path.join(OUT, 'f3-hud.png') });

  // Cada minijuego, abierto directamente
  for (const type of ['cables', 'descarga', 'codigo', 'tarjeta', 'interruptores', 'calibrar']) {
    await page.evaluate((t) => Tasks.open(t, { title: 'Prueba: ' + t }), type);
    await wait(500);
    await page.screenshot({ path: path.join(OUT, 'f3-' + type + '.png') });
  }
  await page.evaluate(() => Tasks.close(true));

  // Jugar de verdad un par de minijuegos con clics
  await page.evaluate(() => Tasks.open('interruptores', { title: 'x', onDone: () => (window.__hecho = 'interruptores') }));
  for (const b of await page.$$('.interruptor:not(.encendido)')) await b.click();
  await wait(200);
  const done1 = await page.evaluate(() => window.__hecho);
  await page.evaluate(() => Tasks.open('cables', { title: 'x', onDone: () => (window.__hecho = 'cables') }));
  for (let c = 0; c < 4; c++) {
    await page.click(`.cables-col:first-child .cable[data-c="${c}"]`);
    await page.click(`.cables-col:last-child .cable[data-c="${c}"]`);
  }
  await wait(200);
  const done2 = await page.evaluate(() => window.__hecho);
  await page.evaluate(() => Tasks.open('reactor', { title: 'Reactor: panel A', panel: 'A', onHold: () => {}, hands: () => ({ A: true }) }));
  await wait(400);
  await page.screenshot({ path: path.join(OUT, 'f3-reactor.png') });
  await page.evaluate(() => Tasks.close(true));

  console.log(JSON.stringify({ role, done1, done2, errors }, null, 1));
  bots.forEach((s) => s.disconnect());
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
