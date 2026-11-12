// Capturas de un mapa en varias salas + comprobación de que todos los sonidos se generan sin errores.
// Uso: MAP=hielo CHROME=<chrome.exe> node test/capturas-mapa.js <ruta playwright-core>   (servidor corriendo)
const path = require('path');
const { io } = require('socket.io-client');
const S = require('../shared/game.js');
const { chromium } = require(process.argv[2] || 'playwright-core');
const OUT = path.join(__dirname, '..', '.playwright-mcp');
const MAPKEY = process.env.MAP || 'estacion';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME, args: ['--autoplay-policy=no-user-gesture-required'] } : {});
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:3000/');
  await page.fill('#nombre', 'Hector');
  await page.click('#btnCrear');
  await wait(500);
  const code = await page.evaluate(() => __amogos.room.code);
  const bots = [];
  for (let i = 0; i < 3; i++) {
    const s = io('http://localhost:3000', { transports: ['websocket'], forceNew: true });
    await new Promise((r) => s.emit('unirse', { code, name: ['Ana', 'Beto', 'Caro'][i], token: 'map' + i + Date.now() }, r));
    bots.push(s);
  }
  // Ajustes: mapa elegido desde la interfaz (comprueba el selector)
  await page.click('#btnAjustes');
  const labels = await page.$$eval('.ajuste span', (n) => n.map((x) => x.textContent));
  const idx = S.MAP_CHOICES.indexOf(MAPKEY);
  const row = (await page.$$('.ajuste')).find(Boolean);
  const mapRow = await page.evaluateHandle(() => [...document.querySelectorAll('.ajuste')].find((r) => r.querySelector('span').textContent === 'Mapa'));
  await (await mapRow.asElement().$$('.opcion'))[idx].click();
  await wait(300);
  await page.screenshot({ path: path.join(OUT, 'f4-ajustes.png') });
  await page.click('#btnCerrarAjustes');
  await page.click('#btnEmpezar');
  await wait(4500);
  const info = await page.evaluate(() => ({ map: __amogos.room.map, role: __amogos.room.me.role }));

  // Recorrido por salas: se teletransporta solo el cliente (no se envían movimientos).
  const m = S.MAPS[MAPKEY];
  const wanted = (process.env.ROOMS || '').split(',').filter(Boolean);
  const rooms = m.rooms.filter((r) => !wanted.length || wanted.includes(r.id));
  for (const r of rooms) {
    await page.evaluate(([x, y]) => { const me = __amogos.players.get(__amogos.me); me.x = x; me.y = y; __amogos.camX = x; __amogos.camY = y; }, [(r.x + r.w / 2) * S.TILE, (r.y + r.h / 2) * S.TILE]);
    await wait(450);
    await page.screenshot({ path: path.join(OUT, `f4-${MAPKEY}-${r.id}.png`) });
  }

  // Sonidos: todos deben poder generarse sin lanzar errores.
  const snd = await page.evaluate(async () => {
    Sound.setMuted(false);
    Sound.unlock();
    const out = { names: Sound.names, state: null, errors: [] };
    for (const n of Sound.names) { try { Sound.play(n); } catch (e) { out.errors.push(n + ': ' + e.message); } await new Promise((r) => setTimeout(r, 60)); }
    Sound.play('matar', { vol: 0.4 });
    Sound.ambient('ice'); Sound.ambient('space'); Sound.ambient('off');
    Sound.setMuted(true); Sound.setMuted(false);
    out.muteBtn = document.getElementById('btnSonido').textContent;
    return out;
  });

  console.log(JSON.stringify({ info, labels, sonidos: snd.names.length, erroresSonido: snd.errors, muteBtn: snd.muteBtn, errors }, null, 1));
  bots.forEach((s) => s.disconnect());
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
