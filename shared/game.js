// Código compartido entre servidor (Node) y cliente (navegador):
// constantes, colores, mapas y colisiones. Así ambos mueven al jugador igual.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Shared = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const TILE = 64;
  const PLAYER_RADIUS = 22;
  const PLAYER_SPEED = 270; // unidades de mundo por segundo
  const MAX_PLAYERS = 12;
  const NAME_MAX = 12;
  const MIN_PLAYERS = 3;
  const KILL_RANGE = 1.5 * TILE; // distancia para matar
  const REPORT_RANGE = 2.2 * TILE; // distancia para reportar un cuerpo
  const USE_RANGE = 1.6 * TILE; // distancia para usar el botón de emergencia
  const VISION = { tripulante: 3.6 * TILE, impostor: 5.2 * TILE };
  const CHAT_MAX = 140;

  // Ajustes de partida que el host puede cambiar en el lobby.
  const SETTINGS_OPTIONS = {
    impostors: [0, 1, 2, 3], // 0 = automático
    killCooldown: [15, 25, 35, 45],
    discussion: [15, 30, 45, 60],
    voting: [30, 60, 90, 120],
    emergencies: [1, 2, 3],
    tasks: [2, 3, 4, 5, 6],
    map: [0, 1, 2], // 0 = Estación Orbital, 1 = Base Polar, 2 = aleatorio
  };
  const DEFAULT_SETTINGS = { impostors: 0, killCooldown: 25, discussion: 30, voting: 60, emergencies: 1, tasks: 4, map: 0 };
  const MAP_CHOICES = ['estacion', 'hielo'];
  const SABOTAGE_COOLDOWN = 30; // segundos entre sabotajes
  const REACTOR_TIME = 40; // segundos para arreglar el reactor
  const LIGHTS_VISION = 1.4 * TILE; // visión de tripulantes con las luces apagadas

  // Tipos de minijuego de las tareas.
  const TASK_TYPES = {
    cables: 'Conectar cables',
    descarga: 'Descargar datos',
    codigo: 'Ingresar código',
    tarjeta: 'Pasar tarjeta',
    interruptores: 'Encender interruptores',
    calibrar: 'Calibrar medidor',
  };

  function impostorCount(players, setting) {
    const auto = players <= 6 ? 1 : players <= 9 ? 2 : 3;
    const max = Math.max(1, Math.floor((players - 1) / 2));
    return Math.min(setting || auto, max);
  }

  const COLORS = [
    { name: 'Rojo', body: '#e23b3b', dark: '#93202a' },
    { name: 'Azul', body: '#2f6fe0', dark: '#1a3f8f' },
    { name: 'Verde', body: '#2fae55', dark: '#1a6b33' },
    { name: 'Rosa', body: '#ef6fbf', dark: '#a63d80' },
    { name: 'Naranja', body: '#f28a1f', dark: '#a35310' },
    { name: 'Amarillo', body: '#f4d23a', dark: '#a8891a' },
    { name: 'Negro', body: '#3b3f4a', dark: '#1d1f26' },
    { name: 'Blanco', body: '#e8edf2', dark: '#9aa3ad' },
    { name: 'Morado', body: '#8a4fd8', dark: '#552e8c' },
    { name: 'Café', body: '#8b5a34', dark: '#55361d' },
    { name: 'Celeste', body: '#3fd6e0', dark: '#1f8a91' },
    { name: 'Lima', body: '#a6e83a', dark: '#66921c' },
  ];

  // Los mapas se definen con rectángulos (en casillas) para salas y pasillos.
  // A partir de eso se genera la cuadrícula de colisión.
  const MAP_DEFS = {
    lobby: {
      id: 'lobby',
      name: 'Nave de despegue',
      width: 16,
      height: 11,
      theme: 'space',
      rooms: [{ id: 'lobby', name: '', x: 1, y: 1, w: 14, h: 9, floor: '#5b6478', label: false }],
      corridors: [],
      spawn: { x: 8, y: 5.5, radius: 2.2 },
    },
    estacion: {
      id: 'estacion',
      name: 'Estación Orbital',
      width: 56,
      height: 36,
      theme: 'space',
      rooms: [
        { id: 'cafeteria', name: 'Cafetería', x: 22, y: 2, w: 12, h: 9, floor: '#7d8aa3' },
        { id: 'motor_sup', name: 'Motor superior', x: 9, y: 3, w: 8, h: 6, floor: '#8a6f5a' },
        { id: 'motor_inf', name: 'Motor inferior', x: 9, y: 26, w: 8, h: 6, floor: '#8a6f5a' },
        { id: 'reactor', name: 'Reactor', x: 1, y: 13, w: 7, h: 9, floor: '#6f8f86' },
        { id: 'seguridad', name: 'Seguridad', x: 11, y: 15, w: 5, h: 5, floor: '#6a6f86' },
        { id: 'enfermeria', name: 'Enfermería', x: 18, y: 12, w: 7, h: 6, floor: '#8fb0b8' },
        { id: 'admin', name: 'Administración', x: 30, y: 16, w: 8, h: 6, floor: '#9a8c6c' },
        { id: 'oxigeno', name: 'Oxígeno', x: 38, y: 11, w: 6, h: 5, floor: '#6fa38a' },
        { id: 'navegacion', name: 'Navegación', x: 46, y: 14, w: 8, h: 7, floor: '#6c7fa6' },
        { id: 'electrica', name: 'Eléctrica', x: 17, y: 24, w: 6, h: 6, floor: '#8f8a5a' },
        { id: 'bodega', name: 'Bodega', x: 24, y: 24, w: 9, h: 9, floor: '#7a6f66' },
        { id: 'comunicaciones', name: 'Comunicaciones', x: 33, y: 30, w: 6, h: 4, floor: '#6f7a8f' },
        { id: 'escudos', name: 'Escudos', x: 40, y: 26, w: 7, h: 6, floor: '#7f7aa3' },
      ],
      corridors: [
        { x: 17, y: 5, w: 5, h: 2 }, // motor sup ↔ cafetería
        { x: 5, y: 7, w: 4, h: 2 }, // reactor ↔ motor sup
        { x: 5, y: 9, w: 2, h: 4 },
        { x: 5, y: 22, w: 2, h: 5 }, // reactor ↔ motor inf
        { x: 5, y: 27, w: 4, h: 2 },
        { x: 8, y: 16, w: 3, h: 2 }, // reactor ↔ seguridad
        { x: 34, y: 6, w: 8, h: 2 }, // cafetería ↔ oxígeno
        { x: 40, y: 8, w: 2, h: 3 },
        { x: 40, y: 16, w: 6, h: 2 }, // oxígeno ↔ navegación
        { x: 27, y: 11, w: 2, h: 13 }, // cafetería ↔ bodega
        { x: 25, y: 14, w: 2, h: 2 }, // enfermería ↔ pasillo central
        { x: 29, y: 18, w: 1, h: 2 }, // admin ↔ pasillo central
        { x: 17, y: 28, w: 7, h: 2 }, // motor inf ↔ eléctrica ↔ bodega
        { x: 33, y: 27, w: 7, h: 2 }, // bodega ↔ escudos
        { x: 46, y: 21, w: 2, h: 5 }, // escudos ↔ navegación
      ],
      corridorFloor: '#565d6e',
      spawn: { x: 28, y: 6.5, radius: 2.4 },
      emergency: { x: 28, y: 8.7 },
      decor: [
        { t: 'table', x: 25, y: 5 }, { t: 'table', x: 31, y: 5 }, { t: 'table', x: 25, y: 9 }, { t: 'table', x: 31, y: 9 }, { t: 'table', x: 28, y: 8.7 },
        { t: 'core', x: 3.5, y: 17.5, c: '80,255,190' },
        { t: 'crate', x: 25.6, y: 30.4 }, { t: 'crate', x: 27.2, y: 31 }, { t: 'crate', x: 30.8, y: 30.6 }, { t: 'crate', x: 31.4, y: 27.6 }, { t: 'crate', x: 25.8, y: 28.2 },
        { t: 'bed', x: 19.4, y: 16.2 }, { t: 'bed', x: 21.5, y: 16.2 },
        { t: 'console', x: 50.5, y: 18.6, w: 3 },
        { t: 'dish', x: 36, y: 32.6 },
        { t: 'barrel', x: 21.2, y: 26.8 }, { t: 'barrel', x: 22, y: 27.3 },
        { t: 'bench', x: 33, y: 18.4, w: 2.2 },
      ],
      // Estaciones de tarea (coordenadas en casillas).
      tasks: [
        { id: 'cab_ele', type: 'cables', room: 'Eléctrica', x: 18.5, y: 24.6 },
        { id: 'cab_adm', type: 'cables', room: 'Administración', x: 32, y: 16.6 },
        { id: 'cab_oxi', type: 'cables', room: 'Oxígeno', x: 39.5, y: 11.6 },
        { id: 'des_caf', type: 'descarga', room: 'Cafetería', x: 23.5, y: 2.6 },
        { id: 'des_com', type: 'descarga', room: 'Comunicaciones', x: 35.5, y: 30.6 },
        { id: 'des_enf', type: 'descarga', room: 'Enfermería', x: 20.5, y: 12.6 },
        { id: 'cod_nav', type: 'codigo', room: 'Navegación', x: 49.5, y: 14.6 },
        { id: 'cod_seg', type: 'codigo', room: 'Seguridad', x: 13.5, y: 15.6 },
        { id: 'tar_adm', type: 'tarjeta', room: 'Administración', x: 36, y: 16.6 },
        { id: 'tar_bod', type: 'tarjeta', room: 'Bodega', x: 28.5, y: 24.6 },
        { id: 'int_msu', type: 'interruptores', room: 'Motor superior', x: 12.5, y: 3.6 },
        { id: 'int_min', type: 'interruptores', room: 'Motor inferior', x: 12.5, y: 26.6 },
        { id: 'cal_rea', type: 'calibrar', room: 'Reactor', x: 4.5, y: 13.6 },
        { id: 'cal_esc', type: 'calibrar', room: 'Escudos', x: 43.5, y: 26.6 },
        { id: 'cal_nav', type: 'calibrar', room: 'Navegación', x: 52.5, y: 14.6 },
      ],
      // Dónde se arreglan los sabotajes.
      fixes: {
        luces: { x: 21.5, y: 24.6, room: 'Eléctrica' },
        reactorA: { x: 1.6, y: 15, room: 'Reactor' },
        reactorB: { x: 1.6, y: 20, room: 'Reactor' },
      },
      // Ventilaciones: las del mismo grupo están conectadas.
      vents: [
        { id: 'v1', group: 'a', x: 14.5, y: 7.5 },
        { id: 'v2', group: 'a', x: 6.5, y: 14.5 },
        { id: 'v3', group: 'a', x: 14.5, y: 30.5 },
        { id: 'v4', group: 'b', x: 14.5, y: 18.5 },
        { id: 'v5', group: 'b', x: 23.5, y: 16.5 },
        { id: 'v6', group: 'b', x: 21.5, y: 28.5 },
        { id: 'v7', group: 'c', x: 32.5, y: 9.5 },
        { id: 'v8', group: 'c', x: 36.5, y: 20.5 },
        { id: 'v9', group: 'c', x: 31.5, y: 31.5 },
        { id: 'v10', group: 'd', x: 52.5, y: 19.5 },
        { id: 'v11', group: 'd', x: 45.5, y: 30.5 },
        { id: 'v12', group: 'd', x: 42.5, y: 14.5 },
      ],
    },
    hielo: {
      id: 'hielo',
      name: 'Base Polar',
      width: 60,
      height: 38,
      theme: 'ice',
      palette: { bgTop: '#08111f', bgBot: '#1b3150', wallTop: '#2f4560', wallFace: '#6a8cab', wallHi: '#e4f0f8', wallLo: '#3d566f' },
      rooms: [
        { id: 'comun', name: 'Sala común', x: 25, y: 15, w: 10, h: 9, floor: '#a9bdd0' },
        { id: 'generador', name: 'Generador', x: 2, y: 15, w: 8, h: 9, floor: '#b3956f' },
        { id: 'frigorifico', name: 'Frigorífico', x: 14, y: 16, w: 6, h: 7, floor: '#b6e0ee' },
        { id: 'invernadero', name: 'Invernadero', x: 3, y: 2, w: 9, h: 7, floor: '#8fb89a' },
        { id: 'laboratorio', name: 'Laboratorio', x: 16, y: 3, w: 8, h: 7, floor: '#9fb5d0' },
        { id: 'observatorio', name: 'Observatorio', x: 38, y: 2, w: 9, h: 7, floor: '#8397bd' },
        { id: 'dormitorios', name: 'Dormitorios', x: 50, y: 6, w: 8, h: 8, floor: '#b9a9c9' },
        { id: 'cocina', name: 'Cocina', x: 50, y: 17, w: 8, h: 6, floor: '#cbb99e' },
        { id: 'radio', name: 'Sala de radio', x: 49, y: 28, w: 9, h: 7, floor: '#8fa2cc' },
        { id: 'garaje', name: 'Garaje de trineos', x: 36, y: 29, w: 8, h: 8, floor: '#9aa5b0' },
        { id: 'almacen', name: 'Almacén', x: 24, y: 30, w: 7, h: 7, floor: '#a59585' },
        { id: 'electrica', name: 'Eléctrica', x: 12, y: 30, w: 8, h: 7, floor: '#a89e72' },
        { id: 'enfermeria', name: 'Enfermería', x: 2, y: 29, w: 7, h: 7, floor: '#bfd6da' },
      ],
      corridors: [
        { x: 10, y: 18, w: 4, h: 2 }, // generador ↔ frigorífico
        { x: 20, y: 18, w: 5, h: 2 }, // frigorífico ↔ sala común
        { x: 12, y: 4, w: 4, h: 2 }, // invernadero ↔ laboratorio
        { x: 5, y: 9, w: 2, h: 6 }, // invernadero ↔ generador
        { x: 24, y: 5, w: 14, h: 2 }, // laboratorio ↔ observatorio
        { x: 29, y: 7, w: 2, h: 8 }, // pasillo norte ↔ sala común
        { x: 47, y: 6, w: 3, h: 2 }, // observatorio ↔ dormitorios
        { x: 53, y: 14, w: 2, h: 3 }, // dormitorios ↔ cocina
        { x: 35, y: 19, w: 15, h: 2 }, // sala común ↔ cocina
        { x: 53, y: 23, w: 2, h: 5 }, // cocina ↔ radio
        { x: 44, y: 31, w: 5, h: 2 }, // garaje ↔ radio
        { x: 31, y: 32, w: 5, h: 2 }, // almacén ↔ garaje
        { x: 29, y: 24, w: 2, h: 6 }, // sala común ↔ almacén
        { x: 20, y: 32, w: 4, h: 2 }, // eléctrica ↔ almacén
        { x: 9, y: 32, w: 3, h: 2 }, // enfermería ↔ eléctrica
        { x: 4, y: 24, w: 2, h: 5 }, // generador ↔ enfermería
      ],
      corridorFloor: '#7a93aa',
      spawn: { x: 30, y: 19.5, radius: 2.4 },
      emergency: { x: 30, y: 19.5 },
      decor: [
        { t: 'table', x: 30, y: 19.5 },
        { t: 'core', x: 5.5, y: 19.6, c: '255,150,60' },
        { t: 'plant', x: 4.4, y: 4.6 }, { t: 'plant', x: 6.2, y: 4.6 }, { t: 'plant', x: 8, y: 4.6 }, { t: 'plant', x: 9.8, y: 4.6 },
        { t: 'plant', x: 4.4, y: 6.6 }, { t: 'plant', x: 9.8, y: 6.6 },
        { t: 'bench', x: 18.5, y: 7.8, w: 3 }, { t: 'bench', x: 21.6, y: 7.8, w: 1.6 },
        { t: 'telescope', x: 42, y: 5.4 },
        { t: 'bed', x: 52, y: 9.6 }, { t: 'bed', x: 55, y: 9.6 }, { t: 'bed', x: 52, y: 12 }, { t: 'bed', x: 55, y: 12 },
        { t: 'table', x: 53.5, y: 20 },
        { t: 'console', x: 52, y: 31.6, w: 3 }, { t: 'dish', x: 55.6, y: 32.8 },
        { t: 'sled', x: 38.6, y: 33.4 }, { t: 'sled', x: 41.2, y: 33.4 },
        { t: 'crate', x: 25.3, y: 34.6 }, { t: 'crate', x: 26.8, y: 34.8 }, { t: 'crate', x: 28.6, y: 34.5 }, { t: 'crate', x: 27.4, y: 33.2 },
        { t: 'barrel', x: 18.2, y: 34.4 }, { t: 'barrel', x: 18.9, y: 35 },
        { t: 'crate', x: 15.2, y: 17.8, c: '#a7d4e6' }, { t: 'crate', x: 18.1, y: 17.8, c: '#a7d4e6' },
        { t: 'bed', x: 4, y: 32.2 }, { t: 'bed', x: 6.4, y: 32.2 },
      ],
      tasks: [
        { id: 'cab_inv', type: 'cables', room: 'Invernadero', x: 5.5, y: 2.6 },
        { id: 'cod_lab', type: 'codigo', room: 'Laboratorio', x: 18.5, y: 3.6 },
        { id: 'cal_lab', type: 'calibrar', room: 'Laboratorio', x: 21.5, y: 3.6 },
        { id: 'des_obs', type: 'descarga', room: 'Observatorio', x: 41.5, y: 2.6 },
        { id: 'cal_obs', type: 'calibrar', room: 'Observatorio', x: 44.5, y: 2.6 },
        { id: 'int_dor', type: 'interruptores', room: 'Dormitorios', x: 52.5, y: 6.6 },
        { id: 'tar_coc', type: 'tarjeta', room: 'Cocina', x: 52.5, y: 17.6 },
        { id: 'des_rad', type: 'descarga', room: 'Sala de radio', x: 52.5, y: 28.6 },
        { id: 'cod_rad', type: 'codigo', room: 'Sala de radio', x: 55.5, y: 28.6 },
        { id: 'cab_gar', type: 'cables', room: 'Garaje de trineos', x: 38.5, y: 29.6 },
        { id: 'int_alm', type: 'interruptores', room: 'Almacén', x: 26.5, y: 30.6 },
        { id: 'cal_gen', type: 'calibrar', room: 'Generador', x: 6.5, y: 15.6 },
        { id: 'des_enf', type: 'descarga', room: 'Enfermería', x: 4.5, y: 29.6 },
        { id: 'cab_ele', type: 'cables', room: 'Eléctrica', x: 14.5, y: 30.6 },
        { id: 'cod_fri', type: 'codigo', room: 'Frigorífico', x: 16.5, y: 16.6 },
        { id: 'tar_com', type: 'tarjeta', room: 'Sala común', x: 27.5, y: 15.6 },
      ],
      fixes: {
        luces: { x: 17.5, y: 30.6, room: 'Eléctrica' },
        reactorA: { x: 2.6, y: 16.5, room: 'Generador' },
        reactorB: { x: 2.6, y: 21.5, room: 'Generador' },
      },
      vents: [
        { id: 'h1', group: 'a', x: 4.5, y: 7.5 },
        { id: 'h2', group: 'a', x: 7.5, y: 22 },
        { id: 'h3', group: 'a', x: 6.5, y: 34 },
        { id: 'h4', group: 'b', x: 22, y: 8 },
        { id: 'h5', group: 'b', x: 17.5, y: 21.5 },
        { id: 'h6', group: 'b', x: 14, y: 35 },
        { id: 'h7', group: 'c', x: 44.5, y: 7 },
        { id: 'h8', group: 'c', x: 26.5, y: 22 },
        { id: 'h9', group: 'c', x: 25.5, y: 35 },
        { id: 'h10', group: 'd', x: 56.3, y: 7.4 },
        { id: 'h11', group: 'd', x: 51, y: 33 },
        { id: 'h12', group: 'd', x: 41.5, y: 35 },
      ],
    },
  };

  function buildMap(def) {
    const grid = new Uint8Array(def.width * def.height); // 0 = sólido, 1 = piso
    const roomOf = new Int16Array(def.width * def.height).fill(-1);
    const fill = (r, roomIdx) => {
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++) {
          if (x < 0 || y < 0 || x >= def.width || y >= def.height) continue;
          grid[y * def.width + x] = 1;
          if (roomIdx >= 0) roomOf[y * def.width + x] = roomIdx;
        }
    };
    def.corridors.forEach((c) => fill(c, -1));
    def.rooms.forEach((r, i) => fill(r, i));
    return Object.assign({}, def, { grid, roomOf });
  }

  const MAPS = {};
  for (const k in MAP_DEFS) MAPS[k] = buildMap(MAP_DEFS[k]);

  function isSolidTile(map, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return true;
    return map.grid[ty * map.width + tx] === 0;
  }

  // Caja de colisión cuadrada del tamaño del jugador.
  function collides(map, x, y, r) {
    const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE);
    const y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) if (isSolidTile(map, tx, ty)) return true;
    return false;
  }

  // Mueve por ejes separados para deslizar contra las paredes.
  function move(map, x, y, dx, dy, r, ghost) {
    r = r || PLAYER_RADIUS;
    if (ghost) {
      // Los fantasmas atraviesan paredes, pero no salen del mapa.
      return {
        x: Math.max(r, Math.min(map.width * TILE - r, x + dx)),
        y: Math.max(r, Math.min(map.height * TILE - r, y + dy)),
      };
    }
    const EPS = 0.01;
    if (dx !== 0) {
      let nx = x + dx;
      if (collides(map, nx, y, r)) {
        nx = dx > 0 ? Math.floor((nx + r) / TILE) * TILE - r - EPS : Math.floor((nx - r) / TILE + 1) * TILE + r + EPS;
        if (collides(map, nx, y, r)) nx = x;
      }
      x = nx;
    }
    if (dy !== 0) {
      let ny = y + dy;
      if (collides(map, x, ny, r)) {
        ny = dy > 0 ? Math.floor((ny + r) / TILE) * TILE - r - EPS : Math.floor((ny - r) / TILE + 1) * TILE + r + EPS;
        if (collides(map, x, ny, r)) ny = y;
      }
      y = ny;
    }
    return { x, y };
  }

  // Posiciones de aparición en círculo alrededor del punto de inicio del mapa.
  function spawnPoint(map, index, total) {
    const s = map.spawn;
    const n = Math.max(total, 1);
    const a = (index / n) * Math.PI * 2 - Math.PI / 2;
    const rad = n === 1 ? 0 : s.radius;
    return { x: (s.x + Math.cos(a) * rad) * TILE, y: (s.y + Math.sin(a) * rad) * TILE };
  }

  function roomAt(map, x, y) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return null;
    const i = map.roomOf[ty * map.width + tx];
    return i >= 0 ? map.rooms[i] : null;
  }

  return { MAP_CHOICES, SABOTAGE_COOLDOWN, REACTOR_TIME, LIGHTS_VISION, TASK_TYPES, TILE, PLAYER_RADIUS, PLAYER_SPEED, MAX_PLAYERS, NAME_MAX, MIN_PLAYERS, KILL_RANGE, REPORT_RANGE, USE_RANGE, VISION, CHAT_MAX, SETTINGS_OPTIONS, DEFAULT_SETTINGS, impostorCount, COLORS, MAPS, isSolidTile, collides, move, spawnPoint, roomAt };
});
