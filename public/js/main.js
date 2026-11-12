(function () {
  const S = window.Shared;
  const $ = (id) => document.getElementById(id);
  const show = (id, on) => $(id).classList.toggle('oculto', !on);
  // Escribir el mismo texto otra vez igual obliga al navegador a recalcular el diseño: solo si cambió.
  const setText = (el, v) => { v = String(v); if (el.textContent !== v) el.textContent = v; };

  // Identidad persistente del dispositivo, para reconectar si se cae la conexión.
  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (_) { return null; }
  }
  let token = store('amogos.token');
  if (!token) {
    token = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    store('amogos.token', token);
  }

  const game = {
    room: null, // estado de la sala (versión que el servidor arma para mí)
    me: null, // mi id
    players: new Map(), // id -> {id,name,color,x,y,tx,ty,f,moving,conn,alive,role}
    map: null,
    camX: 0,
    camY: 0,
    killReadyAt: 0, // performance.now() en que puedo volver a matar
    emergencyReadyAt: 0,
    meetingEndsAt: 0,
    frozenUntil: 0,
    phaseStartedAt: 0,
    selectedVote: null,
    chatOpen: false,
    sabotageReadyAt: 0,
    sabotageEndsAt: 0,
    flashUntil: 0, // destello rojo al matar
    justDone: new Set(), // tareas recién terminadas (para animar la lista)
  };

  const socket = io({ transports: ['websocket', 'polling'] });

  // ---------- Pantalla de inicio ----------
  const params = new URLSearchParams(location.search);
  const invitedCode = (params.get('sala') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  $('nombre').value = store('amogos.nombre') || '';
  if (invitedCode.length === 4) {
    $('codigoInvitacion').textContent = invitedCode;
    show('bloqueInvitacion', true);
    show('bloqueNormal', false);
  }
  $('btnOtraSala').onclick = () => {
    show('bloqueInvitacion', false);
    show('bloqueNormal', true);
    history.replaceState(null, '', location.pathname);
  };
  $('codigo').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  });

  function showError(msg) { $('error').textContent = msg || ''; }
  function myName() {
    const n = $('nombre').value.trim().slice(0, S.NAME_MAX);
    store('amogos.nombre', n);
    return n;
  }
  function preferredColor() {
    const c = Number(store('amogos.color'));
    return Number.isInteger(c) ? c : null;
  }

  function goFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen && matchMedia('(pointer: coarse)').matches) {
      el.requestFullscreen({ navigationUI: 'hide' }).then(() => {
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
      }).catch(() => {});
    }
  }

  function handleJoin(res) {
    if (!res || !res.ok) return showError((res && res.error) || 'No se pudo conectar.');
    showError('');
    game.me = res.me;
    clearChat();
    (res.chat || []).forEach(addChatMsg);
    applyRoom(res.room, true);
    show('inicio', false);
    show('hud', true);
    document.body.classList.add('jugando');
    history.replaceState(null, '', '?sala=' + res.room.code);
  }

  $('btnCrear').onclick = () => {
    goFullscreen();
    socket.emit('crear', { name: myName(), token, color: preferredColor() }, handleJoin);
  };
  function join(code) {
    if (!code || code.length !== 4) return showError('El código tiene 4 letras.');
    goFullscreen();
    socket.emit('unirse', { code, name: myName(), token, color: preferredColor() }, handleJoin);
  }
  $('btnUnirse').onclick = () => join($('codigo').value);
  $('codigo').addEventListener('keydown', (e) => { if (e.key === 'Enter') join($('codigo').value); });
  $('btnUnirseInvitacion').onclick = () => join(invitedCode);

  $('btnSalir').onclick = () => {
    if (!confirm('¿Salir de la sala?')) return;
    socket.emit('salir');
    leaveToHome();
  };
  function leaveToHome() {
    game.room = null;
    game.me = null;
    game.players.clear();
    game.map = null;
    Input.setEnabled(false);
    Tasks.close(true);
    Sound.ambient('off');
    for (const id of ['hud', 'selectorColor', 'ajustes', 'menuSabotaje', 'reunion', 'expulsion', 'fin', 'revelacion', 'muerteAviso', 'chatFlotante', 'bloqueInvitacion', 'mapaGrande', 'avisoReunion'])
      show(id, false);
    show('inicio', true);
    show('bloqueNormal', true);
    document.body.classList.remove('jugando');
    history.replaceState(null, '', location.pathname);
  }

  // ---------- Lobby ----------
  $('btnCompartir').onclick = async () => {
    const url = location.origin + '/?sala=' + game.room.code;
    const text = `¡Únete a mi partida de Amogos! Código: ${game.room.code}`;
    try {
      if (navigator.share) return await navigator.share({ title: 'Amogos', text, url });
    } catch (_) { return; }
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copiado. Pásalo por WhatsApp.');
    } catch (_) {
      prompt('Copia este link:', url);
    }
  };
  $('btnColor').onclick = () => { renderColors(); show('selectorColor', true); };
  $('btnCerrarColor').onclick = () => show('selectorColor', false);
  $('btnAjustes').onclick = () => { renderSettings(); show('ajustes', true); };
  $('btnCerrarAjustes').onclick = () => show('ajustes', false);
  $('btnEmpezar').onclick = () => socket.emit('empezar', (res) => { if (res && res.error) toast(res.error); });

  function renderColors() {
    const box = $('colores');
    box.innerHTML = '';
    const taken = new Map(game.room.players.map((p) => [p.color, p.id]));
    S.COLORS.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'color';
      b.style.background = c.body;
      b.title = c.name;
      b.setAttribute('aria-label', c.name);
      const owner = taken.get(i);
      if (owner === game.me) b.classList.add('mio');
      else if (owner != null) b.classList.add('tomado');
      b.onclick = () => {
        if (owner != null && owner !== game.me) return;
        store('amogos.color', String(i));
        socket.emit('color', i);
      };
      box.appendChild(b);
    });
  }

  const SETTINGS_LABELS = {
    map: ['Mapa', (v) => ['Estación Orbital', 'Base Polar', 'Aleatorio'][v]],
    impostors: ['Impostores', (v) => (v === 0 ? 'Auto' : String(v))],
    killCooldown: ['Espera entre asesinatos', (v) => v + ' s'],
    discussion: ['Tiempo de discusión', (v) => v + ' s'],
    voting: ['Tiempo de votación', (v) => v + ' s'],
    emergencies: ['Reuniones de emergencia por jugador', (v) => String(v)],
    tasks: ['Tareas por jugador', (v) => String(v)],
  };
  function renderSettings() {
    const box = $('ajustesLista');
    box.innerHTML = '';
    const isHost = game.room.hostId === game.me;
    for (const [key, [label, fmt]] of Object.entries(SETTINGS_LABELS)) {
      const row = document.createElement('div');
      row.className = 'ajuste';
      const l = document.createElement('span');
      l.textContent = label;
      const opts = document.createElement('div');
      opts.className = 'opciones';
      for (const v of S.SETTINGS_OPTIONS[key]) {
        const b = document.createElement('button');
        b.className = 'opcion' + (game.room.settings[key] === v ? ' activa' : '');
        b.textContent = fmt(v);
        b.disabled = !isHost;
        b.onclick = () => socket.emit('ajustes', { [key]: v });
        opts.appendChild(b);
      }
      row.append(l, opts);
      box.appendChild(row);
    }
    if (!isHost) {
      const n = document.createElement('p');
      n.className = 'tenue';
      n.textContent = 'Solo el host puede cambiar los ajustes.';
      box.appendChild(n);
    }
  }

  let toastTimer = null;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.remove('oculto');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('oculto'), 2500);
  }

  // ---------- Chat ----------
  function clearChat() { $('chatMensajes').innerHTML = ''; }
  function addChatMsg(m) {
    const box = $('chatMensajes');
    const row = document.createElement('div');
    row.className = 'chat-msg' + (m.ghost ? ' fantasma' : '') + (m.system ? ' sistema' : '');
    if (m.system) {
      row.textContent = m.text;
    } else {
      const dot = document.createElement('i');
      dot.className = 'bolita';
      dot.style.background = (S.COLORS[m.color] || S.COLORS[0]).body;
      const txt = document.createElement('div');
      const b = document.createElement('b');
      b.textContent = m.name + ':';
      if (m.ghost) b.prepend(Icons.el('fantasma', 'icono-texto'));
      txt.append(b, document.createTextNode(m.text));
      row.append(dot, txt);
    }
    if (!m.system && m.id !== game.me) Sound.play('pop');
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    box.appendChild(row);
    while (box.children.length > 80) box.firstChild.remove();
    if (atBottom || m.id === game.me) box.scrollTop = box.scrollHeight;
    const visible = !$('reunion').classList.contains('oculto') || game.chatOpen;
    if (!visible && !m.system && m.id !== game.me) show('chatNuevo', true);
  }
  function systemMsg(text) { addChatMsg({ system: true, text }); }

  socket.on('chat', addChatMsg);
  $('chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('chatInput').value.trim();
    if (!v) return;
    socket.emit('chat', v);
    $('chatInput').value = '';
  });
  $('btnChat').onclick = () => setChatOpen(!game.chatOpen);
  $('btnCerrarChat').onclick = () => setChatOpen(false);
  function setChatOpen(open) {
    game.chatOpen = open;
    show('chatFlotante', open && !inMeetingScreen());
    if (open) show('chatNuevo', false);
    if (open) { const b = $('chatMensajes'); b.scrollTop = b.scrollHeight; }
  }
  $('chatInput').addEventListener('focus', () => Input.setEnabled(false));
  $('chatInput').addEventListener('blur', () => updateInputEnabled());

  // ---------- Estado de la sala ----------
  const meP = () => game.players.get(game.me);
  const inMeetingScreen = () => game.room && (game.room.phase === 'reunion');

  function canChatNow() {
    const r = game.room;
    if (!r) return false;
    if (r.phase === 'lobby' || r.phase === 'fin' || r.phase === 'reunion' || r.phase === 'expulsion') return true;
    return r.me && !r.me.alive; // fantasmas en partida
  }

  function updateInputEnabled() {
    const r = game.room;
    const ok = !!r && (r.phase === 'lobby' || r.phase === 'juego') && performance.now() >= game.frozenUntil &&
      document.activeElement !== $('chatInput') && !Tasks.isOpen() && !(r.me && r.me.inVent);
    Input.setEnabled(ok);
  }

  function applyRoom(room, first) {
    const prev = game.room;
    const prevPhase = prev ? prev.phase : null;
    const prevMap = prev ? prev.map : null;
    game.room = room;
    game.map = S.MAPS[room.map];
    const mapChanged = first || prevMap !== room.map;
    const now = performance.now();

    const seen = new Set();
    for (const rp of room.players) {
      seen.add(rp.id);
      let p = game.players.get(rp.id);
      if (!p) {
        p = { id: rp.id, x: rp.x, y: rp.y, tx: rp.x, ty: rp.y, f: rp.f, moving: false };
        game.players.set(rp.id, p);
      }
      p.name = rp.name;
      p.color = rp.color;
      p.conn = rp.conn;
      p.alive = rp.alive !== false;
      p.role = rp.role;
      if (mapChanged || (prevPhase !== room.phase && room.phase === 'juego')) { p.x = p.tx = rp.x; p.y = p.ty = rp.y; }
    }
    for (const id of [...game.players.keys()]) if (!seen.has(id)) game.players.delete(id);

    const me = meP();
    if (me && (mapChanged || prevPhase !== room.phase)) { game.camX = me.x; game.camY = me.y; }

    if (room.me) {
      if (room.me.killIn != null) game.killReadyAt = now + room.me.killIn;
      game.emergencyReadyAt = now + (room.emergencyIn || 0);
    }
    if (room.meeting) game.meetingEndsAt = now + room.meeting.endsIn;
    if (room.me && room.me.sabotageIn != null) game.sabotageReadyAt = now + room.me.sabotageIn;
    if (room.sabotage && room.sabotage.endsIn != null) game.sabotageEndsAt = now + room.sabotage.endsIn;
    // Cerrar minijuegos que ya no tienen sentido
    const cur = Tasks.current();
    if (cur) {
      const stillOk = room.phase === 'juego' && room.me && !room.me.inVent &&
        (cur.opts.kind !== 'luces' || (room.sabotage && room.sabotage.kind === 'luces')) &&
        (cur.opts.kind !== 'reactor' || (room.sabotage && room.sabotage.kind === 'reactor')) &&
        (!cur.opts.taskId || cur.finished || (room.me.tasks || []).some((k) => k.id === cur.opts.taskId && !k.done)) &&
        !(prev && prev.me && prev.me.alive && !room.me.alive);
      if (!stillOk) Tasks.close(true);
    }
    if (room.phase !== 'juego') show('menuSabotaje', false);
    if (prevPhase !== room.phase) game.phaseStartedAt = now;

    // Mensajes de sistema al empezar una reunión
    if (room.phase === 'reunion' && prevPhase !== 'reunion') {
      game.selectedVote = null;
      clearChat();
      systemMsg(meetingSubtitle(room));
      if (!first) meetingSplash(room);
      const vb = $('votos');
      vb.classList.add('entrando');
      setTimeout(() => vb.classList.remove('entrando'), 900);
    }
    if (!first && prev) visualEvents(prev, room);
    if (room.phase === 'lobby' && prevPhase && prevPhase !== 'lobby') clearChat();

    if (!first && prev) audioEvents(prev, room);
    else Sound.ambient(room.map === 'hielo' ? 'ice' : 'space');
    updateHud();
    updateInputEnabled();
  }

  // Sonidos según lo que cambió entre el estado anterior y el nuevo.
  function audioEvents(prev, room) {
    Sound.ambient(room.map === 'hielo' ? 'ice' : 'space');
    if (room.phase !== prev.phase) {
      if (room.phase === 'reunion') Sound.play(room.meeting && room.meeting.reason === 'cuerpo' ? 'reporte' : 'emergencia');
      else if (room.phase === 'expulsion') Sound.play('expulsion');
      else if (room.phase === 'fin' && room.ending && room.me) {
        const crewWin = room.ending.winner === 'tripulantes';
        Sound.play((room.me.role === 'impostor') !== crewWin ? 'victoria' : 'derrota');
      }
    }
    if (room.phase === 'juego' && prev.phase === 'juego') {
      const nb = (room.bodies || []).length, pb = (prev.bodies || []).length;
      const justDied = prev.me && prev.me.alive && room.me && !room.me.alive;
      if (nb > pb && !justDied) {
        const b = room.bodies[nb - 1], me = meP();
        const d = me ? Math.hypot(b.x - me.x, b.y - me.y) : 1e9;
        const ghost = room.me && !room.me.alive;
        if (ghost || d < S.VISION.impostor * 1.4) Sound.play('matar', { vol: ghost ? 0.5 : Math.max(0.3, 1 - d / (S.VISION.impostor * 1.4)) });
      }
      if (!prev.sabotage && room.sabotage) Sound.play(room.sabotage.kind === 'luces' ? 'luces' : 'sabotaje');
      if (prev.sabotage && !room.sabotage) Sound.play('arreglado');
      const pv = prev.me && prev.me.inVent, nv = room.me && room.me.inVent;
      if (pv !== nv) Sound.play('ventila');
    }
    if (room.meeting && prev.meeting && room.meeting.voted.length > prev.meeting.voted.length) Sound.play('voto');
  }

  // Efectos visuales según lo que cambió (partículas en el mundo).
  function visualEvents(prev, room) {
    if (room.phase !== 'juego' || prev.phase !== 'juego') return;
    const me = meP();
    // Salpicadura donde aparece un cuerpo nuevo; si yo maté, destello rojo.
    const pids = new Set((prev.bodies || []).map((b) => b.id));
    for (const b of room.bodies || []) {
      if (pids.has(b.id)) continue;
      Render.burst(b.x, b.y, 'splat');
      Render.burst(b.x, b.y, 'puff', (S.COLORS[b.color] || S.COLORS[0]).body);
      if (me && room.me && room.me.role === 'impostor' && Math.hypot(b.x - me.x, b.y - me.y) < S.KILL_RANGE * 1.6) game.flashUntil = performance.now() + 400;
    }
    // Destellos en la consola de cada tarea que acabo de terminar.
    // (también al pasar de etapa en una tarea de varias partes)
    const was = new Map(((prev.me && prev.me.tasks) || []).map((k) => [k.id, k]));
    for (const k of (room.me && room.me.tasks) || []) {
      const pk = was.get(k.id);
      if (!pk || k.step <= pk.step) continue;
      game.justDone.add(k.id);
      const d = taskDef(pk.station);
      if (d) Render.burst(d.x * S.TILE, d.y * S.TILE, 'sparkle');
      if (!k.done) toast('Etapa ' + k.step + '/' + k.steps + ' lista. Sigue en ' + (taskDef(k.station) || {}).room + '.');
    }
    // Sabotaje arreglado: destellos verdes en los puntos de arreglo.
    if (prev.sabotage && !room.sabotage && game.map.fixes) {
      const fx = game.map.fixes;
      const spots = prev.sabotage.kind === 'luces' ? [fx.luces] : [fx.reactorA, fx.reactorB];
      for (const s of spots) if (s) Render.burst(s.x * S.TILE, s.y * S.TILE, 'sparkle', '#5fe08a');
    }
    // Entrar o salir de una ventilación: nube de humo.
    const pv = prev.me && prev.me.inVent, nv = room.me && room.me.inVent;
    if (pv !== nv && me) {
      const v = (game.map.vents || []).find((q) => q.id === (nv || pv));
      Render.burst(v ? v.x * S.TILE : me.x, v ? v.y * S.TILE : me.y, 'puff');
    }
  }

  function meetingSplash(room) {
    const m = room.meeting;
    $('avisoReunionTexto').textContent = m && m.reason === 'cuerpo' ? '¡CUERPO REPORTADO!' : '¡REUNIÓN DE EMERGENCIA!';
    show('avisoReunion', true);
    clearTimeout(meetingSplash.t);
    meetingSplash.t = setTimeout(() => show('avisoReunion', false), 1700);
  }

  function confetti() {
    const box = $('confeti');
    box.innerHTML = '';
    const cols = S.COLORS.map((c) => c.body);
    for (let i = 0; i < 70; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + '%';
      p.style.background = cols[i % cols.length];
      p.style.animationDuration = 2.2 + Math.random() * 2.5 + 's';
      p.style.animationDelay = Math.random() * 1.5 + 's';
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      box.appendChild(p);
    }
  }

  // ---------- Minimapa y mapa grande ----------
  let bigMapOpen = false;
  function setBigMap(open) {
    bigMapOpen = open && !!game.room && game.room.phase === 'juego';
    lastMapDraw = 0; // dibujar ya, sin esperar
    show('mapaGrande', bigMapOpen);
    if (bigMapOpen) $('mapaTitulo').textContent = game.map.name;
  }
  $('minimapa').onclick = () => setBigMap(!bigMapOpen);
  $('btnCerrarMapa').onclick = () => setBigMap(false);
  // Teclas en PC: E usar, R reportar, Q matar, V ventila, F sabotear, M/Tab mapa, Esc cerrar.
  const KEYS = { e: 'btnUsar', r: 'btnReportar', q: 'btnMatar', v: 'btnVentila', f: 'btnSabotear' };
  addEventListener('keydown', (e) => {
    if (document.activeElement === $('chatInput') || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!game.room || game.room.phase !== 'juego') return;
    const k = e.key.toLowerCase();
    if (k === 'm' || k === 'tab') { e.preventDefault(); setBigMap(!bigMapOpen); return; }
    if (k === 'escape') {
      if (Tasks.isOpen()) Tasks.close(); else if (bigMapOpen) setBigMap(false); else show('menuSabotaje', false);
      return;
    }
    const id = KEYS[k];
    if (!id || (Tasks.isOpen() && k !== 'f')) return;
    const b = $(id);
    if (b.classList.contains('oculto') || b.disabled) return;
    e.preventDefault();
    b.classList.add('tecla-activa');
    setTimeout(() => b.classList.remove('tecla-activa'), 150);
    b.click();
  });

  function mapInfo() {
    const room = game.room, me = meP();
    const pend = ((room.me && room.me.tasks) || []).filter((k) => !k.done).map((k) => taskDef(k.station)).filter(Boolean);
    const sab = room.sabotage, fx = game.map.fixes || {};
    const fixes = !sab ? [] : sab.kind === 'luces' ? [fx.luces] : [fx.reactorA, fx.reactorB];
    const imp = room.me && room.me.role === 'impostor';
    return {
      map: game.map,
      me: me ? { x: me.x, y: me.y, color: me.color } : null,
      tasks: pend,
      fixes: fixes.filter(Boolean),
      vents: imp ? game.map.vents : null,
      emergency: game.map.emergency,
      view: Render.viewSize(),
      imp, sab,
    };
  }
  // Ajusta la resolución del canvas a su tamaño real en pantalla (nítido en celulares).
  // ratio: alto/ancho deseado (mapa grande); null = usar el alto que ya tiene en CSS.
  function fitCanvas(cv, dpr, ratio) {
    const w = cv.clientWidth;
    if (!w) return;
    const h = ratio ? w * ratio : cv.clientHeight;
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  }

  let lastMapDraw = 0;
  function drawMaps(now) {
    const room = game.room;
    const on = !!room && room.phase === 'juego' && !!room.me;
    show('minimapa', on);
    if (!on) { if (bigMapOpen) { bigMapOpen = false; show('mapaGrande', false); } return; }
    // Los mapas solo tienen pulsos suaves: ~15 cuadros por segundo bastan y liberan al celular.
    if (now - lastMapDraw < 66) return;
    lastMapDraw = now;
    const info = mapInfo();
    info.dpr = Math.min(window.devicePixelRatio || 1, 3);
    fitCanvas($('minimapaLienzo'), info.dpr, null);
    Render.minimap($('minimapaLienzo'), info);
    if (bigMapOpen) {
      const cv = $('mapaGrandeLienzo');
      fitCanvas(cv, info.dpr, game.map.height / game.map.width);
      Render.minimap(cv, Object.assign({}, info, { labels: true }));
      show('leyVent', !!info.imp);
      show('leySab', !!info.sab);
    }
  }

  function playerName(id) {
    const p = game.players.get(id);
    return p ? p.name : '¿?';
  }
  function meetingSubtitle(room) {
    const m = room.meeting;
    if (!m) return '';
    if (m.reason === 'cuerpo') return `${playerName(m.callerId)} encontró el cuerpo de ${playerName(m.bodyId)}.`;
    return `${playerName(m.callerId)} llamó a una reunión de emergencia.`;
  }

  function updateHud() {
    const room = game.room;
    if (!room) return;
    const isHost = room.hostId === game.me;
    const phase = room.phase;
    const inLobby = phase === 'lobby';
    const inGame = phase === 'juego';
    const me = room.me;

    $('infoSala').textContent = inLobby ? `Sala ${room.code}` : game.map.name;
    if (inLobby) Icons.set($('infoJugadores'), 'personas', `${room.players.length}/${S.MAX_PLAYERS}`);
    show('infoJugadores', inLobby);
    show('panelLobby', inLobby);
    show('btnEmpezar', inLobby && isHost);
    show('esperaHost', inLobby && !isHost);
    show('panelJuego', inGame);

    // Rol
    const rol = $('infoRol');
    if (me && !inLobby) {
      rol.className = 'chip ' + (!me.alive ? 'chip-fantasma' : me.role === 'impostor' ? 'chip-impostor' : 'chip-tripulante');
      if (!me.alive) Icons.set(rol, 'fantasma', 'Fantasma'); else rol.textContent = me.role === 'impostor' ? 'Impostor' : 'Tripulante';
      show('infoRol', true);
      $('pista').textContent = !me.alive
        ? 'Estás muerto. Puedes hablar con otros fantasmas.'
        : me.role === 'impostor'
          ? 'Mata a los tripulantes sin que te descubran.'
          : 'Encuentra al impostor. Reporta cuerpos o usa el botón de la cafetería.';
    } else show('infoRol', false);

    // Tareas y sabotaje
    show('listaTareas', inGame && !!me);
    if (inGame && me) renderTaskList(room);
    if (room.taskProgress) {
      const tp = room.taskProgress;
      $('barraTareas').style.width = (tp.total ? (tp.done / tp.total) * 100 : 0) + '%';
    }
    const sab = inGame ? room.sabotage : null;
    show('alertaSabotaje', !!sab);
    show('flash', !!sab && sab.kind === 'reactor');
    updateSabotageAlert();

    // Botones de acción
    const alive = me && me.alive;
    const imp = alive && me.role === 'impostor';
    const vented = !!(me && me.inVent);
    show('btnSabotear', !!(inGame && me && me.role === 'impostor' && !vented));
    show('btnVentila', !!(inGame && imp));
    $('btnVentila').querySelector('.etq').textContent = vented ? 'SALIR' : 'VENTILA';
    show('btnVentSig', !!(inGame && imp && vented));
    if (!inGame || !me || me.role !== 'impostor' || vented) show('menuSabotaje', false);
    show('btnMatar', !!(inGame && imp && !vented));
    show('btnReportar', !!(inGame && alive && !vented));
    show('btnUsar', inLobby || (inGame && !vented));

    // Chat: botón visible cuando se puede chatear fuera de la reunión
    const chatBtn = canChatNow() && phase !== 'reunion';
    show('btnChat', chatBtn);
    if (!chatBtn && game.chatOpen) setChatOpen(false);
    if (inGame) Icons.set($('chatTitulo'), 'fantasma', 'Chat de fantasmas'); else $('chatTitulo').textContent = 'Chat';

    // Pantallas
    show('reunion', phase === 'reunion');
    if (phase === 'reunion') {
      $('reunionChat').appendChild($('chat'));
      show('chatFlotante', false);
      show('btnCerrarChat', false);
      renderMeeting();
    } else {
      $('chatFlotante').appendChild($('chat'));
      show('btnCerrarChat', true);
      show('chatFlotante', game.chatOpen && chatBtn);
    }
    show('expulsion', phase === 'expulsion');
    if (phase === 'expulsion') renderEjection();
    show('fin', phase === 'fin');
    if (phase === 'fin') renderEnd();
    if (phase !== 'lobby') { show('selectorColor', false); show('ajustes', false); }
    if (!$('selectorColor').classList.contains('oculto')) renderColors();
    if (!$('ajustes').classList.contains('oculto')) renderSettings();
  }

  // ---------- Tareas y sabotajes ----------
  function taskDef(id) { return (game.map.tasks || []).find((k) => k.id === id); }

  function renderTaskList(room) {
    const me = room.me;
    const ul = $('tareasUl');
    ul.innerHTML = '';
    const imp = me.role === 'impostor';
    $('pista').textContent = !me.alive
      ? (imp ? 'Eres un fantasma. Aún puedes sabotear.' : 'Eres un fantasma: termina tus tareas para ayudar.')
      : imp ? 'Tareas falsas para disimular. Mata, sabotea y usa las ventilaciones.'
        : 'Haz tus tareas o descubre al impostor.';
    if (room.sabotage) {
      const li = document.createElement('li');
      li.className = 'sabotaje';
      Icons.set(li, 'alerta', room.sabotage.kind === 'luces' ? 'Arreglar luces (Eléctrica)' : 'Detener el reactor (Reactor)');
      ul.appendChild(li);
    }
    for (const k of me.tasks || []) {
      const d = taskDef(k.station);
      if (!d) continue;
      const li = document.createElement('li');
      li.className = (k.done ? 'hecha' : '') + (game.justDone.has(k.id) ? ' recien' : '');
      li.textContent = (k.done ? '' : d.room + ': ') + S.taskName(game.map, k.id) + (k.steps > 1 ? ' (' + k.step + '/' + k.steps + ')' : '');
      if (S.HARD_TASKS.includes(d.type)) { const t = document.createElement('b'); t.className = 'dificil'; t.textContent = 'DIFÍCIL'; li.appendChild(t); }
      ul.appendChild(li);
    }
    game.justDone.clear();
  }
  $('btnListaTareas').onclick = () => $('listaTareas').classList.toggle('plegada');

  // Solo reescribe la alerta si cambió el texto (se llama 10 veces por segundo).
  function setAlert(icon, text) {
    const el = $('alertaSabotaje');
    if (el.dataset.t === icon + text) return;
    el.dataset.t = icon + text;
    Icons.set(el, icon, text);
  }
  function updateSabotageAlert() {
    const sab = game.room && game.room.phase === 'juego' ? game.room.sabotage : null;
    if (!sab) return;
    if (sab.kind === 'luces') setAlert('foco', '¡Luces apagadas! Arréglalas en Eléctrica');
    else {
      const s = Math.max(0, Math.ceil((game.sabotageEndsAt - performance.now()) / 1000));
      const h = sab.hands || {};
      setAlert('reactor', '¡Reactor en crisis! ' + s + 's · Manos: ' + ((h.A ? 1 : 0) + (h.B ? 1 : 0)) + '/2');
    }
  }

  // Menú de sabotaje
  $('btnSabotear').onclick = () => {
    const open = $('menuSabotaje').classList.contains('oculto');
    show('menuSabotaje', open);
  };
  $('btnSabLuces').onclick = () => { socket.emit('sabotear', 'luces'); show('menuSabotaje', false); };
  $('btnSabReactor').onclick = () => { socket.emit('sabotear', 'reactor'); show('menuSabotaje', false); };
  $('btnCerrarTarea').onclick = () => Tasks.close();

  // Ventilaciones
  function myVent() {
    const r = game.room;
    if (!r || !r.me || !r.me.inVent) return null;
    return (game.map.vents || []).find((v) => v.id === r.me.inVent) || null;
  }
  $('btnVentila').onclick = () => socket.emit('ventila');
  $('btnVentSig').onclick = () => {
    const v = myVent();
    if (!v) return;
    const group = game.map.vents.filter((q) => q.group === v.group);
    const next = group[(group.indexOf(v) + 1) % group.length];
    socket.emit('ventilaMover', next.id);
  };

  // ---------- Reunión y votación ----------
  function renderMeeting() {
    const room = game.room;
    const m = room.meeting;
    if (!m) return;
    $('reunionTitulo').textContent = m.reason === 'cuerpo' ? '¡Cuerpo reportado!' : 'Reunión de emergencia';
    const me = room.me;
    const canVote = m.stage === 'votacion' && me.alive && !m.voted.includes(game.me);
    $('reunionSub').textContent =
      m.stage === 'discusion' ? 'Discutan. La votación empieza pronto.'
        : m.stage === 'votacion' ? (canVote ? 'Toca a quien quieras expulsar y confirma.' : me.alive ? 'Ya votaste. Esperando a los demás…' : 'Los fantasmas no votan.')
          : 'Resultados de la votación';

    const box = $('votos');
    box.innerHTML = '';
    const tally = (m.result && m.result.tally) || {};
    const list = room.players.slice().sort((a, b) => (b.alive !== false) - (a.alive !== false));
    for (const p of list) {
      const alive = p.alive !== false;
      const card = document.createElement('button');
      card.className = 'voto' + (alive ? '' : ' muerto') + (game.selectedVote === p.id ? ' elegido' : '') +
        (p.role === 'impostor' && me.role === 'impostor' ? ' impostor-aliado' : '');
      card.disabled = !(canVote && alive);
      const cv = document.createElement('canvas');
      cv.width = 40; cv.height = 40;
      cv.style.width = '34px'; cv.style.height = '34px';
      Render.crewOn(cv, p.color, { dead: !alive, scale: 1.15 });
      const name = document.createElement('span');
      name.className = 'nombre';
      name.textContent = p.name + (p.id === game.me ? ' (tú)' : '');
      card.append(cv, name);
      if (p.id === m.callerId) {
        const mk = document.createElement('span'); mk.className = 'marca marca-icono'; mk.appendChild(Icons.el('megafono')); card.appendChild(mk);
      }
      if (m.stage === 'votacion' && m.voted.includes(p.id)) {
        const mk = document.createElement('span'); mk.className = 'marca'; mk.textContent = 'VOTÓ'; card.appendChild(mk);
      }
      if (m.stage === 'resultado' || m.stage === 'expulsion') card.appendChild(voterDots(tally[p.id]));
      if (canVote && game.selectedVote === p.id) {
        const ok = document.createElement('span');
        ok.className = 'confirmar';
        Icons.set(ok, 'check', 'Votar');
        ok.onclick = (e) => { e.stopPropagation(); socket.emit('votar', p.id); game.selectedVote = null; };
        card.appendChild(ok);
      }
      card.onclick = () => { if (canVote && alive) { game.selectedVote = game.selectedVote === p.id ? null : p.id; renderMeeting(); } };
      box.appendChild(card);
    }

    const skip = $('btnSaltar');
    skip.disabled = !canVote;
    skip.textContent = game.selectedVote === 'skip' && canVote ? '¿Seguro? Saltar' : 'Saltar voto';
    skip.onclick = () => {
      if (!canVote) return;
      if (game.selectedVote === 'skip') { socket.emit('votar', 'skip'); game.selectedVote = null; }
      else { game.selectedVote = 'skip'; renderMeeting(); }
    };
    const sv = $('votosSaltar');
    sv.innerHTML = '';
    if (m.stage === 'resultado' && tally.skip) { sv.append('Saltaron: ', voterDots(tally.skip)); }
  }

  function voterDots(voters) {
    const box = document.createElement('span');
    box.className = 'votantes';
    for (const id of voters || []) {
      const p = game.players.get(id);
      const d = document.createElement('i');
      d.style.background = p ? (S.COLORS[p.color] || S.COLORS[0]).body : '#888';
      d.title = p ? p.name : '';
      box.appendChild(d);
    }
    return box;
  }

  function renderEjection() {
    const r = game.room.meeting && game.room.meeting.result;
    if (!r) return;
    let main, sub;
    if (r.ejectedId == null) {
      main = r.tie ? 'Empate. Nadie fue expulsado.' : 'Nadie fue expulsado.';
      sub = '';
    } else {
      main = `${r.ejectedName} ${r.wasImpostor ? 'era' : 'no era'} el impostor.`;
    }
    const n = r.impostorsLeft;
    sub = (sub ? sub + ' ' : '') + `Queda${n === 1 ? '' : 'n'} ${n} impostor${n === 1 ? '' : 'es'}.`;
    typewrite($('expulsionTexto'), main);
    $('expulsionSub').textContent = sub;
  }
  let typeTimer = null, typeTarget = '';
  function typewrite(el, text) {
    if (typeTarget === text) return;
    typeTarget = text;
    clearInterval(typeTimer);
    let i = 0;
    el.textContent = '';
    typeTimer = setInterval(() => {
      i++;
      el.textContent = text.slice(0, i);
      if (i >= text.length) clearInterval(typeTimer);
    }, 55);
  }

  function renderEnd() {
    const e = game.room.ending;
    if (!e) return;
    const crewWin = e.winner === 'tripulantes';
    const me = game.room.me;
    const iWon = me && ((me.role === 'impostor') !== crewWin);
    $('finTitulo').textContent = iWon ? '¡VICTORIA!' : 'DERROTA';
    $('finTitulo').className = 'cartel-titulo ' + (crewWin ? 'titulo-tripulante' : 'titulo-impostor');
    const imps = game.room.players.filter((p) => p.role === 'impostor');
    $('finSub').textContent = `${crewWin ? 'Ganan los tripulantes' : 'Ganan los impostores'}. ${e.reason} ` +
      `Impostor${imps.length === 1 ? '' : 'es'}: ${imps.map((p) => p.name).join(', ') || '—'}.`;
    const winners = game.room.players.filter((p) => (p.role === 'impostor') !== crewWin);
    Render.crewRow($('finLienzo'), winners.map((p) => p.color));
    if (renderEnd.shownFor !== game.phaseStartedAt) {
      renderEnd.shownFor = game.phaseStartedAt;
      if (iWon) confetti(); else $('confeti').innerHTML = '';
    }
  }

  // ---------- Eventos de partida ----------
  socket.on('sala', (room) => { if (game.me != null) applyRoom(room, false); });

  socket.on('revelar', () => {
    const room = game.room;
    if (!room || !room.me) return;
    const imp = room.me.role === 'impostor';
    Sound.play(imp ? 'impostor' : 'tripulante');
    game.frozenUntil = performance.now() + 3800;
    updateInputEnabled();
    $('revelacionTitulo').textContent = imp ? 'IMPOSTOR' : 'TRIPULANTE';
    $('revelacionTitulo').className = 'cartel-titulo ' + (imp ? 'titulo-impostor' : 'titulo-tripulante');
    const n = room.impostorCount;
    if (imp) {
      const mates = room.players.filter((p) => p.role === 'impostor' && p.id !== game.me).map((p) => p.name);
      $('revelacionTexto').textContent = mates.length ? `Tu compañero: ${mates.join(', ')}` : 'Mata sin que te descubran.';
    } else {
      $('revelacionTexto').textContent = `Hay ${n} impostor${n === 1 ? '' : 'es'} entre nosotros.`;
    }
    const team = imp ? room.players.filter((p) => p.role === 'impostor') : room.players;
    const mine = room.players.find((p) => p.id === game.me);
    const colors = [mine.color, ...team.filter((p) => p.id !== game.me).map((p) => p.color)];
    Render.crewRow($('revelacionLienzo'), colors);
    $('revelacion').className = 'cartel ' + (imp ? 'rol-impostor' : 'rol-tripulante');
    show('revelacion', true);
    setTimeout(() => { show('revelacion', false); updateInputEnabled(); }, 3800);
  });

  socket.on('muerte', () => {
    Sound.play('muerte');
    show('muerteAviso', true);
    if (navigator.vibrate) navigator.vibrate([200, 80, 200]);
    setTimeout(() => show('muerteAviso', false), 3000);
  });

  socket.on('s', (list) => {
    for (const [id, x, y, f, m] of list) {
      if (id === game.me) continue; // mi posición la manejo yo
      const p = game.players.get(id);
      if (!p) continue;
      p.tx = x; p.ty = y; p.f = f; p.moving = !!m;
    }
  });

  socket.on('corr', ({ x, y }) => {
    const me = meP();
    if (!me) return;
    if (Math.hypot(me.x - x, me.y - y) > 300) { game.camX = x; game.camY = y; }
    me.x = x; me.y = y;
  });

  // ---------- Acciones ----------
  let target = { kill: null, body: null, emergency: false, use: null };
  $('btnMatar').onclick = () => { if (target.kill != null) socket.emit('matar', target.kill); };
  $('btnReportar').onclick = () => { if (target.body != null) socket.emit('reportar', target.body); };
  $('btnUsar').onclick = () => {
    const u = target.use;
    if (!u) return;
    if (u.kind === 'emergencia') socket.emit('emergencia');
    else if (u.kind === 'luces') {
      Tasks.open('interruptores', { kind: 'luces', title: 'Arreglar luces', hint: 'Enciende todos los interruptores para volver a tener luz.',
        onDone: () => socket.emit('arreglarLuces'), onClose: () => updateInputEnabled() });
    } else if (u.kind === 'reactor') {
      Tasks.open('reactor', { kind: 'reactor', panel: u.panel, title: 'Reactor: panel ' + u.panel,
        onHold: (on) => socket.emit('mano', { panel: u.panel, on }),
        hands: () => game.room && game.room.sabotage && game.room.sabotage.hands,
        onClose: () => updateInputEnabled() });
    } else if (u.kind === 'tarea') {
      const k = (game.room.me.tasks || []).find((q) => q.id === u.id);
      const d = taskDef(k.station);
      socket.emit('abrirTarea', u.id);
      Tasks.open(d.type, { taskId: u.id, step: k.step, steps: k.steps,
        title: d.room + ': ' + S.taskName(game.map, k.id) + (k.steps > 1 ? ' (' + (k.step + 1) + '/' + k.steps + ')' : ''),
        onDone: () => { if (game.room.me.role !== 'impostor') socket.emit('tarea', u.id); },
        onClose: () => updateInputEnabled() });
    }
    updateInputEnabled();
  };

  function updateActions(now) {
    const room = game.room, me = meP();
    target = { kill: null, body: null, emergency: false, use: null };
    if (!room || room.phase !== 'juego' || !me || !room.me) {
      $('btnUsar').disabled = true;
      return;
    }
    const dist = (s) => Math.hypot(s.x * S.TILE - me.x, s.y * S.TILE - me.y);
    const sab = room.sabotage;
    // Botón de sabotaje (impostor): enfriamiento y si ya hay uno activo
    if (room.me.role === 'impostor') {
      const scd = Math.max(0, game.sabotageReadyAt - now);
      setText($('sabCd'), scd > 0 && !sab ? Math.ceil(scd / 1000) : '');
      $('btnSabLuces').disabled = $('btnSabReactor').disabled = !!sab || scd > 0;
      const inV = room.me.inVent;
      const nearVent = (game.map.vents || []).some((v) => dist(v) <= S.USE_RANGE);
      $('btnVentila').disabled = !room.me.alive || !(inV || nearVent);
    }
    // USAR: arreglar sabotaje > tarea propia > botón de emergencia
    if (!room.me.inVent && !Tasks.isOpen()) {
      const fx = game.map.fixes || {};
      if (room.me.alive && sab && sab.kind === 'luces' && fx.luces && dist(fx.luces) <= S.USE_RANGE) target.use = { kind: 'luces' };
      else if (room.me.alive && sab && sab.kind === 'reactor') {
        for (const pn of ['A', 'B']) if (fx['reactor' + pn] && dist(fx['reactor' + pn]) <= S.USE_RANGE) target.use = { kind: 'reactor', panel: pn };
      }
      if (!target.use) {
        let best = null, bd = S.USE_RANGE;
        for (const k of room.me.tasks || []) {
          if (k.done) continue;
          const d = taskDef(k.station);
          if (d && dist(d) <= bd) { best = k.id; bd = dist(d); }
        }
        if (best) target.use = { kind: 'tarea', id: best };
      }
    }
    if (!room.me.alive) {
      $('btnUsar').disabled = !target.use;
      return;
    }
    if (room.me.role === 'impostor') {
      let best = null, bestD = S.KILL_RANGE;
      for (const p of game.players.values()) {
        if (p.id === game.me || !p.alive || p.role === 'impostor') continue;
        const d = Math.hypot(p.x - me.x, p.y - me.y);
        if (d <= bestD) { best = p.id; bestD = d; }
      }
      const cd = Math.max(0, game.killReadyAt - now);
      setText($('matarCd'), cd > 0 ? Math.ceil(cd / 1000) : '');
      if (cd <= 0 && !room.me.inVent) target.kill = best;
      $('btnMatar').disabled = target.kill == null;
    }
    let bestB = null, bestBD = S.REPORT_RANGE;
    for (const b of room.bodies || []) {
      const d = Math.hypot(b.x - me.x, b.y - me.y);
      if (d <= bestBD) { bestB = b.id; bestBD = d; }
    }
    target.body = bestB;
    $('btnReportar').disabled = bestB == null;
    const e = game.map.emergency;
    target.emergency = !!e && room.me.emergencies > 0 && now >= game.emergencyReadyAt && !sab && !room.me.inVent &&
      Math.hypot(e.x * S.TILE - me.x, e.y * S.TILE - me.y) <= S.USE_RANGE;
    if (!target.use && target.emergency) target.use = { kind: 'emergencia' };
    $('btnUsar').disabled = !target.use;
  }

  let lastTickSecond = -1, lastAlarmAt = 0;
  function updateMeetingTimer(now) {
    const m = game.room && game.room.meeting;
    if (!m || game.room.phase !== 'reunion') return;
    const s = Math.max(0, Math.ceil((game.meetingEndsAt - now) / 1000));
    if (m.stage === 'votacion' && s <= 5 && s > 0 && s !== lastTickSecond) { lastTickSecond = s; Sound.play('tick'); }
    setText($('reunionTimer'), m.stage === 'discusion' ? `Discusión: ${s}s` : m.stage === 'votacion' ? `Votación: ${s}s` : 'Resultados');
  }

  // Reconexión automática (pantalla bloqueada, cambio de wifi, etc.)
  socket.on('disconnect', () => { if (game.me != null) show('avisoConexion', true); });
  socket.on('connect', () => {
    show('avisoConexion', false);
    const code = game.room ? game.room.code : null;
    if (code) {
      socket.emit('unirse', { code, name: myName(), token }, (res) => {
        if (res && res.ok) {
          game.me = res.me;
          clearChat();
          (res.chat || []).forEach(addChatMsg);
          applyRoom(res.room, true);
        } else { leaveToHome(); showError((res && res.error) || 'Se perdió la sala.'); }
      });
    }
  });

  // ---------- Bucle principal ----------
  let last = performance.now();
  let sendAcc = 0;
  let wasMoving = false;
  let slowAcc = 0;

  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const room = game.room;
    const me = meP();

    if (me && game.map && room && (room.phase === 'lobby' || room.phase === 'juego')) {
      const ghost = room.phase === 'juego' && room.me && !room.me.alive;
      const v = Input.vector();
      const moving = Math.hypot(v.x, v.y) > 0.01;
      if (moving) {
        const res = S.move(game.map, me.x, me.y, v.x * S.PLAYER_SPEED * dt, v.y * S.PLAYER_SPEED * dt, S.PLAYER_RADIUS, ghost);
        me.x = res.x;
        me.y = res.y;
        if (Math.abs(v.x) > 0.1) me.f = v.x < 0 ? -1 : 1;
      }
      me.moving = moving;
      sendAcc += dt;
      if ((moving && sendAcc >= 0.05) || (!moving && wasMoving)) {
        sendAcc = 0;
        socket.volatile.emit('mov', { x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10, f: me.f, m: moving ? 1 : 0 });
      }
      wasMoving = moving;

      // Los demás se suavizan hacia su última posición conocida.
      const k = Math.min(1, dt * 14);
      for (const p of game.players.values()) {
        if (p.id === game.me) continue;
        p.x += (p.tx - p.x) * k;
        p.y += (p.ty - p.y) * k;
      }
      game.camX += (me.x - game.camX) * Math.min(1, dt * 10);
      game.camY += (me.y - game.camY) * Math.min(1, dt * 10);
    }

    slowAcc += dt;
    if (slowAcc > 0.1) {
      slowAcc = 0;
      updateActions(now);
      updateMeetingTimer(now);
      updateSabotageAlert();
      const sb = room && room.phase === 'juego' ? room.sabotage : null;
      if (sb && sb.kind === 'reactor') {
        const left = (game.sabotageEndsAt - now) / 1000;
        if (now - lastAlarmAt > (left <= 10 ? 450 : 1000)) { lastAlarmAt = now; Sound.play('alarma'); }
      }
    }

    if (room && room.phase === 'reunion') {
      // La pantalla de reunión tapa todo el mundo: no se gasta CPU dibujándolo detrás.
    } else if (room && room.phase === 'expulsion') {
      const r = room.meeting && room.meeting.result;
      const prog = Math.min(1, (now - game.phaseStartedAt) / 5500);
      Render.ejectFrame(r && r.ejectedId != null ? r.ejectedColor : null, prog);
    } else {
      const hostId = room ? room.hostId : null;
      const myRole = room && room.me ? room.me.role : null;
      const playing = room && room.phase === 'juego';
      const alive = !room || !room.me || room.me.alive;
      const sab = playing ? room.sabotage : null;
      let vision = playing && alive ? S.VISION[myRole] : null;
      if (vision && sab && sab.kind === 'luces' && myRole !== 'impostor') vision = S.LIGHTS_VISION;
      const myTasks = new Set(playing && room.me ? (room.me.tasks || []).filter((k) => !k.done).map((k) => k.station) : []);
      const v = playing ? myVent() : null;
      const ventIds = new Set(v ? game.map.vents.filter((q) => q.group === v.group).map((q) => q.id) : []);
      const arrows = [];
      if (sab && game.map.fixes) {
        const fx = game.map.fixes;
        const spots = sab.kind === 'luces' ? [fx.luces] : [fx.reactorA, fx.reactorB];
        for (const s of spots) if (s) arrows.push({ x: s.x * S.TILE, y: s.y * S.TILE });
      }
      Render.frame({
        map: game.map,
        camX: game.camX,
        camY: game.camY,
        bodies: playing ? room.bodies : [],
        vision,
        flicker: !!(sab && sab.kind === 'luces' && myRole !== 'impostor'),
        flashUntil: game.flashUntil,
        myTasks,
        sabotage: sab,
        ventIds,
        arrows,
        players: [...game.players.values()]
          .filter((p) => !playing || p.alive || !alive)
          .filter((p) => !(v && p.id === game.me))
          .map((p) => ({
            ...p,
            host: room && room.phase === 'lobby' && p.id === hostId,
            ghost: playing && !p.alive,
            nameColor: myRole === 'impostor' && p.role === 'impostor' ? '#ff5a6a' : null,
          })),
      });
    }
    drawMaps(now);
    requestAnimationFrame(loop);
  }

  const refreshSoundBtn = () => { $('btnSonido').innerHTML = Icons.html(Sound.isMuted() ? 'mudo' : 'sonido'); };
  $('btnSonido').onclick = () => { Sound.setMuted(!Sound.isMuted()); refreshSoundBtn(); };
  refreshSoundBtn();

  Render.init($('lienzo'));
  Input.attach($('lienzo'));
  requestAnimationFrame(loop);

  // Para pruebas desde la consola.
  window.__amogos = game;
})();
