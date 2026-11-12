// Sonido sintetizado con WebAudio: sin archivos, todo se genera en el momento.
// El navegador solo deja sonar tras un toque del usuario, por eso se "desbloquea" en el primer gesto.
window.Sound = (function () {
  const KEY = 'amogos.silencio';
  let ctx = null, master = null, noiseBuf = null, muted = false;
  let out = null; // bus temporal para atenuar un sonido concreto (p. ej. un asesinato lejano)
  let ambientNodes = null, ambientKind = 'off';
  const lastPlayed = {};
  try { muted = localStorage.getItem(KEY) === '1'; } catch (_) {}

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.8;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      if (ambientKind !== 'off') setAmbient(ambientKind, true);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Un tono con envolvente. o: {type, vol, at, to (frecuencia final), attack}
  function tone(freq, dur, o) {
    if (!ctx) return;
    o = o || {};
    const t0 = ctx.currentTime + (o.at || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t0 + dur);
    const vol = o.vol == null ? 0.2 : o.vol;
    const att = o.attack || 0.006;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(o.dest || out || master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // Ruido filtrado (golpes, viento, "whoosh"). o: {vol, at, type, freq, to, q}
  function noise(dur, o) {
    if (!ctx) return;
    o = o || {};
    const t0 = ctx.currentTime + (o.at || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1000, t0);
    if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    const vol = o.vol == null ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(out || master);
    src.start(t0, Math.random());
    src.stop(t0 + dur + 0.05);
  }

  const arp = (notes, step, o) => notes.forEach((n, i) => tone(n, (o && o.len) || step * 1.6, Object.assign({ at: i * step }, o)));
  const N = { C4: 262, E4: 330, G4: 392, A4: 440, C5: 523, D5: 587, E5: 659, G5: 784, A5: 880, C6: 1047, E6: 1319 };

  const SOUNDS = {
    click: () => tone(720, 0.04, { type: 'square', vol: 0.04 }),
    error: () => tone(200, 0.16, { type: 'sawtooth', vol: 0.09, to: 110 }),
    tarea: () => arp([N.C5, N.E5, N.G5, N.C6], 0.07, { type: 'triangle', vol: 0.16 }),
    pop: () => tone(900, 0.06, { vol: 0.07, to: 1200 }),
    tick: () => tone(1000, 0.035, { vol: 0.07 }),
    voto: () => { tone(520, 0.06, { vol: 0.12 }); tone(780, 0.09, { vol: 0.12, at: 0.06 }); },
    mano: () => tone(180, 0.12, { type: 'triangle', vol: 0.12 }),

    matar: () => {
      noise(0.22, { freq: 1500, to: 400, q: 0.8, vol: 0.28 });
      tone(140, 0.3, { type: 'sawtooth', vol: 0.22, to: 40 });
      tone(900, 0.06, { type: 'square', vol: 0.1, at: 0.02, to: 300 });
    },
    muerte: () => { tone(330, 0.5, { type: 'sawtooth', vol: 0.14, to: 70 }); noise(0.4, { freq: 600, to: 100, vol: 0.14 }); },
    ventila: () => {
      tone(320, 0.05, { type: 'square', vol: 0.08, to: 180 });
      noise(0.09, { freq: 2600, q: 3, vol: 0.12, at: 0.02 });
      tone(110, 0.1, { type: 'triangle', vol: 0.14, at: 0.08 });
    },

    reporte: () => {
      for (let i = 0; i < 3; i++) { tone(880, 0.16, { type: 'square', vol: 0.09, at: i * 0.38 }); tone(660, 0.16, { type: 'square', vol: 0.09, at: i * 0.38 + 0.19 }); }
      tone(70, 0.5, { vol: 0.3, at: 0 });
    },
    emergencia: () => {
      for (let i = 0; i < 5; i++) tone(1200, 0.14, { type: 'square', vol: 0.09, at: i * 0.22 });
      tone(70, 0.5, { vol: 0.3 });
    },
    expulsion: () => {
      noise(1.6, { freq: 200, to: 2600, q: 0.7, vol: 0.2, attack: 0.5 });
      tone(500, 1.6, { type: 'sine', vol: 0.08, to: 90 });
    },
    victoria: () => arp([N.C5, N.E5, N.G5, N.C6, N.E6], 0.13, { type: 'triangle', vol: 0.2, len: 0.5 }),
    derrota: () => arp([N.A4, N.G4, N.E4, N.C4], 0.2, { type: 'sawtooth', vol: 0.1, len: 0.5 }),
    tripulante: () => {
      tone(220, 1.2, { type: 'sine', vol: 0.16, to: 330, attack: 0.3 });
      tone(330, 1.2, { type: 'sine', vol: 0.1, to: 495, attack: 0.3 });
    },
    impostor: () => {
      tone(82, 1.6, { type: 'sawtooth', vol: 0.18, attack: 0.2 });
      tone(87, 1.6, { type: 'sawtooth', vol: 0.14, attack: 0.2 });
      noise(0.5, { freq: 300, to: 80, vol: 0.18, at: 0.1 });
    },

    sabotaje: () => { for (let i = 0; i < 4; i++) tone(i % 2 ? 520 : 760, 0.22, { type: 'square', vol: 0.1, at: i * 0.24 }); tone(60, 0.6, { vol: 0.3 }); },
    alarma: () => tone(i1(), 0.18, { type: 'square', vol: 0.08 }),
    luces: () => { tone(90, 0.4, { vol: 0.3, to: 35 }); noise(0.1, { freq: 3000, vol: 0.15 }); },
    arreglado: () => arp([N.G4, N.C5, N.E5, N.G5], 0.09, { type: 'sine', vol: 0.16 }),
  };
  let alt = 0;
  function i1() { alt = 1 - alt; return alt ? 880 : 660; }

  // Reproduce un efecto. vol (0-1) lo atenúa; no repite el mismo sonido en menos de 40 ms.
  function play(name, opts) {
    if (muted || !SOUNDS[name]) return;
    if (!unlock()) return;
    const now = performance.now();
    if (now - (lastPlayed[name] || 0) < 40) return;
    lastPlayed[name] = now;
    try {
      if (opts && opts.vol != null) {
        out = ctx.createGain();
        out.gain.value = Math.max(0, Math.min(1, opts.vol));
        out.connect(master);
      }
      SOUNDS[name]();
    } catch (_) {}
    out = null;
  }

  // Ambiente continuo: 'space' (zumbido grave), 'ice' (viento) o 'off'.
  function setAmbient(kind, force) {
    if (kind === ambientKind && !force) return;
    ambientKind = kind;
    if (!ctx) return;
    if (ambientNodes) {
      const old = ambientNodes;
      old.gain.gain.cancelScheduledValues(ctx.currentTime);
      old.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      setTimeout(() => { try { old.stop(); } catch (_) {} }, 2000);
      ambientNodes = null;
    }
    if (kind === 'off') return;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(master);
    const nodes = [];
    if (kind === 'space') {
      for (const f of [55, 55.6, 110.3]) {
        const o = ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = f;
        const og = ctx.createGain(); og.gain.value = f > 100 ? 0.012 : 0.03;
        o.connect(og); og.connect(g); o.start(); nodes.push(o);
      }
    } else {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf; src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 450; f.Q.value = 0.6;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
      const lfoG = ctx.createGain(); lfoG.gain.value = 220;
      lfo.connect(lfoG); lfoG.connect(f.frequency);
      const sw = ctx.createOscillator(); sw.frequency.value = 0.07;
      const swG = ctx.createGain(); swG.gain.value = 0.35;
      const amp = ctx.createGain(); amp.gain.value = 0.6;
      sw.connect(swG); swG.connect(amp.gain);
      src.connect(f); f.connect(amp); amp.connect(g);
      src.start(); lfo.start(); sw.start();
      nodes.push(src, lfo, sw);
    }
    g.gain.setTargetAtTime(kind === 'ice' ? 0.09 : 1, ctx.currentTime, 1.2);
    ambientNodes = { gain: g, stop: () => { nodes.forEach((n) => { try { n.stop(); } catch (_) {} }); g.disconnect(); } };
  }

  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (_) {}
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.05);
    if (!muted) unlock();
  }

  // Primer gesto del usuario: desbloquea el audio. Click suave en cualquier botón.
  document.addEventListener('pointerdown', () => unlock(), true);
  document.addEventListener('keydown', () => unlock(), true);
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('button')) play('click'); }, true);
  // Al volver a la pestaña (iOS suspende el audio), reanudar.
  document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx && ctx.state === 'suspended') ctx.resume(); });

  return { unlock, play, ambient: setAmbient, setMuted, isMuted: () => muted, names: Object.keys(SOUNDS) };
})();
