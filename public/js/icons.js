// Íconos propios (estilo dibujado a mano: contorno negro grueso, colores planos).
// Sirven en la interfaz (<svg><use>) y en el canvas (como imagen).
window.Icons = (function () {
  const K = 'stroke="#141420" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"';
  const P = (cx, cy, r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r].map((v) => v.toFixed(2)).join(' ');

  // Aspas del símbolo del reactor (calculadas).
  let aspas = '';
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + i * (Math.PI * 2 / 3);
    const a0 = a - 0.52, a1 = a + 0.52;
    aspas += `<path d="M${P(32, 33, 8, a0)} L${P(32, 33, 22, a0)} A22 22 0 0 1 ${P(32, 33, 22, a1)} L${P(32, 33, 8, a1)} A8 8 0 0 0 ${P(32, 33, 8, a0)} Z" fill="#141420"/>`;
  }

  const DEFS = {
    cerrar: `<path d="M17 17 L47 47 M47 17 L17 47" stroke="#141420" stroke-width="15" stroke-linecap="round"/>
      <path d="M17 17 L47 47 M47 17 L17 47" stroke="#f4f6fc" stroke-width="7" stroke-linecap="round"/>`,
    sonido: `<path d="M8 25 H18 L32 12 V52 L18 39 H8 Z" fill="#f4f6fc" ${K}/>
      <path d="M41 24 Q46 32 41 40 M48 17 Q57 32 48 47" fill="none" stroke="#4fd8ff" stroke-width="5" stroke-linecap="round"/>`,
    mudo: `<path d="M8 25 H18 L32 12 V52 L18 39 H8 Z" fill="#9aa3c7" ${K}/>
      <path d="M41 24 L55 40 M55 24 L41 40" stroke="#141420" stroke-width="10" stroke-linecap="round"/>
      <path d="M41 24 L55 40 M55 24 L41 40" stroke="#ff4d5e" stroke-width="4.5" stroke-linecap="round"/>`,
    chat: `<path d="M10 14 Q10 8 16 8 H50 Q56 8 56 14 V38 Q56 44 50 44 H28 L16 55 L18 44 H16 Q10 44 10 38 Z" fill="#f4f6fc" ${K}/>
      <circle cx="22" cy="26" r="3.5" fill="#141420"/><circle cx="33" cy="26" r="3.5" fill="#141420"/><circle cx="44" cy="26" r="3.5" fill="#141420"/>`,
    foco: `<path d="M32 5 Q50 5 50 23 Q50 32 42 39 V45 H22 V39 Q14 32 14 23 Q14 5 32 5 Z" fill="#ffd34d" ${K}/>
      <path d="M22 45 H42 V52 Q42 58 36 58 H28 Q22 58 22 52 Z" fill="#9aa3c7" ${K}/>
      <path d="M22 51 H42" ${K}/><path d="M23 18 Q25 11 31 10" fill="none" stroke="#fff6c8" stroke-width="4" stroke-linecap="round"/>`,
    reactor: `<circle cx="32" cy="33" r="27" fill="#ffd34d" ${K}/>${aspas}<circle cx="32" cy="33" r="4.5" fill="#141420"/>`,
    alerta: `<path d="M32 6 Q35 6 37 10 L59 51 Q60 57 54 57 H10 Q4 57 5 51 L27 10 Q29 6 32 6 Z" fill="#ffd34d" ${K}/>
      <path d="M32 22 V38" stroke="#141420" stroke-width="7" stroke-linecap="round"/><circle cx="32" cy="47" r="4" fill="#141420"/>`,
    fantasma: `<path d="M12 56 V28 Q12 8 32 8 Q52 8 52 28 V56 L45 50 L38 56 L32 50 L26 56 L19 50 Z" fill="#e8ecff" ${K}/>
      <ellipse cx="25" cy="28" rx="4" ry="6" fill="#141420"/><ellipse cx="39" cy="28" rx="4" ry="6" fill="#141420"/>`,
    personas: `<circle cx="42" cy="20" r="9" fill="#9aa3c7" ${K}/><path d="M28 50 Q28 33 42 33 Q56 33 56 50 Z" fill="#9aa3c7" ${K}/>
      <circle cx="24" cy="22" r="10" fill="#f4f6fc" ${K}/><path d="M8 55 Q8 36 24 36 Q40 36 40 55 Z" fill="#f4f6fc" ${K}/>`,
    check: `<path d="M12 33 L26 47 L53 17" fill="none" stroke="#141420" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 33 L26 47 L53 17" fill="none" stroke="#5fe08a" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
    borrar: `<path d="M22 12 H54 Q58 12 58 16 V48 Q58 52 54 52 H22 L5 32 Z" fill="#f4f6fc" ${K}/>
      <path d="M30 24 L46 40 M46 24 L30 40" stroke="#141420" stroke-width="5.5" stroke-linecap="round"/>`,
    tarjeta: `<rect x="5" y="13" width="54" height="38" rx="6" fill="#bfe6ff" ${K}/>
      <rect x="11" y="20" width="16" height="20" rx="3" fill="#f4f6fc" ${K} stroke-width="3"/>
      <circle cx="19" cy="27" r="3.5" fill="#e23b3b"/><path d="M13 39 Q19 31 25 39" fill="#e23b3b"/>
      <path d="M33 23 H52 M33 31 H52 M33 39 H45" stroke="#141420" stroke-width="3.5" stroke-linecap="round"/>`,
    mano: `<rect x="21" y="9" width="10" height="30" rx="5" fill="#f4f6fc" ${K}/>
      <rect x="31" y="5" width="10" height="33" rx="5" fill="#f4f6fc" ${K}/>
      <rect x="41" y="9" width="9.5" height="29" rx="4.8" fill="#f4f6fc" ${K}/>
      <rect x="50" y="17" width="8.5" height="22" rx="4.2" fill="#f4f6fc" ${K}/>
      <rect x="7" y="30" width="10" height="24" rx="5" fill="#f4f6fc" ${K} transform="rotate(-38 12 42)"/>
      <path d="M20 31 H58 V45 Q58 59 41 59 H33 Q19 59 19 46 Z" fill="#f4f6fc" ${K}/>`,
    megafono: `<rect x="6" y="23" width="12" height="18" rx="4" fill="#c4601a" ${K}/>
      <path d="M17 25 L42 11 L42 53 L17 39 Z" fill="#ff9a3c" ${K}/>
      <ellipse cx="42" cy="32" rx="5" ry="21" fill="#ffd2a1" ${K}/>
      <path d="M51 23 Q55 32 51 41" fill="none" ${K}/>`,
    girar: `<rect x="20" y="6" width="24" height="44" rx="5" fill="#2b3348" ${K}/><rect x="24" y="12" width="16" height="30" rx="2" fill="#4fd8ff"/>
      <path d="M8 40 Q8 58 30 58" fill="none" stroke="#141420" stroke-width="10" stroke-linecap="round"/>
      <path d="M8 40 Q8 58 30 58" fill="none" stroke="#ffcc33" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M28 50 L38 58 L28 64 Z" fill="#ffcc33" ${K} stroke-width="3"/>`,
    estrella: `<path d="M32 5 L40 23 L59 24 L44 37 L49 57 L32 46 L15 57 L20 37 L5 24 L24 23 Z" fill="#ffd34d" ${K}/>`,
    flecha: `<path d="M12 32 H46" stroke="#141420" stroke-width="12" stroke-linecap="round"/><path d="M12 32 H46" stroke="#ffcc33" stroke-width="5" stroke-linecap="round"/>
      <path d="M40 16 L58 32 L40 48 Z" fill="#ffcc33" ${K}/>`,
    triangulo: `<path d="M20 22 L32 36 L44 22 Z" fill="#f4f6fc" ${K} stroke-width="3.5"/>`,
  };

  // Sprite oculto con todos los íconos como <symbol>.
  const sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  sprite.setAttribute('width', '0'); sprite.setAttribute('height', '0');
  sprite.setAttribute('aria-hidden', 'true');
  sprite.style.position = 'absolute';
  sprite.innerHTML = Object.entries(DEFS).map(([k, v]) => `<symbol id="ic-${k}" viewBox="0 0 64 64">${v}</symbol>`).join('');
  document.body.prepend(sprite);

  // <svg class="icono"><use href="#ic-nombre"/></svg>
  function html(name, cls) {
    return `<svg class="icono ${cls || ''}" aria-hidden="true"><use href="#ic-${name}"/></svg>`;
  }
  function el(name, cls) {
    const t = document.createElement('template');
    t.innerHTML = html(name, cls);
    return t.content.firstChild;
  }
  // Cambia el contenido de un elemento por un ícono + texto opcional.
  function set(node, name, text) {
    node.innerHTML = html(name) + (text ? '<span>' + text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]) + '</span>' : '');
  }

  // Versión imagen para el canvas.
  const imgs = {};
  function img(name) {
    if (!imgs[name]) {
      const i = new Image();
      i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="128" height="128">${DEFS[name]}</svg>`);
      imgs[name] = i;
    }
    return imgs[name];
  }
  for (const k of ['foco', 'mano', 'estrella', 'reactor']) img(k); // precarga

  return { html, el, set, img };
})();
