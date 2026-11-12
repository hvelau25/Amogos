# Notas del proyecto: Amogos

Fuente de verdad del proyecto. Anotar aquí cada decisión en el momento.

## Objetivo
Juego multijugador para jugar con amigos en ratos libres en la uni. Modo clásico tipo 2020: tripulantes vs impostores, tareas, reuniones, votación, chat libre. 2 mapas, 1 modo de juego.

## Decisiones (2026-11-11)
- **Plataforma:** juego web, se entra por link + código de sala. Sin instalar nada.
- **Dispositivo:** celular. Pantalla horizontal, joystick virtual a la izquierda, botones de acción a la derecha (Usar, Matar, Reportar, Sabotear, Ventila). Instalable como PWA ("Agregar a inicio") para pantalla completa.
- **Jugadores:** de 3 a 12. Impostores según el número de jugadores (el host lo puede cambiar): 3-6 → 1, 7-9 → 2, 10-12 → 3.
- **Stack:** Node.js + Express + Socket.IO (servidor que decide todo, para evitar trampas) + cliente en Canvas puro, sin paso de compilación.
- **Hosting:** Render, Railway o Fly.io en plan gratis. Para las pruebas, túnel (Cloudflare Tunnel o ngrok).
- **Estilo visual:** caricatura 2D vista desde arriba, temática espacial, colores vivos, contornos gruesos. Personajes, mapas y arte **propios**, sin copiar los de Among Us.
- **Chat:** libre durante las reuniones. Chat aparte para los fantasmas.
- **Nombre:** Amogos (uso privado entre amigos).
- **Mapas:** Mapa 1 = Estación Orbital, Mapa 2 = base en planeta helado.
- **Personaje:** astronauta propio: cuerpo redondito, casco tipo pecera con cara visible, antena con bolita. 12 colores.
- **Cámara:** ~7.5 casillas de alto en pantalla (se ajustó tras probar; con 9.5 los personajes se veían chicos).
- **Reconexión:** cada dispositivo guarda un token; si se cae la conexión (pantalla bloqueada) tiene 45 s para volver como el mismo jugador. Recargar la página también reconecta.
- **Movimiento:** el cliente se mueve solo (sin lag) y el servidor valida velocidad y paredes; si no cuadra, lo corrige.

## Alcance (modo clásico)
- Lobby con código de sala, colores y nombres
- Roles: tripulante / impostor. Matar con tiempo de espera, ventilaciones
- Tareas como minijuegos, barra de progreso común
- Reportar cuerpo, reunión de emergencia, votación, expulsión
- Sabotajes: luces, reactor (y quizás puertas)
- Visión limitada (el impostor ve más lejos)
- 2 mapas

## Fases
1. [x] Lobby y sala por link, jugadores moviéndose juntos en un mapa simple (con controles de celular)
2. [x] Roles, matar, reportar, votación, chat (primera versión jugable)
3. [x] Tareas, sabotajes y ventilaciones
4. [x] Segundo mapa (Base Polar), arte y sonido
5. [ ] Deploy en hosting gratis y link fijo

## Estado (2026-11-11)
Fase 1 terminada y probada (prueba automática + navegador en tamaño de celular horizontal): crear sala o unirse por link/código, lobby con colores únicos, hasta 12 jugadores, host con estrella, Empezar → Estación Orbital, Volver al lobby, reconexión, choques con paredes, joystick táctil + WASD. Falta probar en celulares reales.
Fase 2 terminada y probada (partida automática + navegador): rol, visión, matar, cuerpo, reportar, reunión con chat, votación, expulsión, fin, vuelta al lobby, reconexión a media partida.
Fase 3 terminada y probada (18 comprobaciones automáticas + capturas en tamaño celular sin errores): tareas con 6 minijuegos, barra y victoria por tareas, luces, reactor, ventilaciones.
Fase 4 terminada y probada (mapas validados, Fase 3 pasa en ambos mapas, capturas sin errores, 21 sonidos generan sin errores): Base Polar, selector de mapa, arte helado, decoración y sonido.

## Fase 2 (2026-11-11), decisiones
- Mínimo 3 jugadores para empezar. Impostores: automático según el número de jugadores, o fijo en Ajustes (se limita para que siempre haya más tripulantes).
- Ajustes del host: impostores, espera entre asesinatos (15/25/35/45 s), discusión (15-60 s), votación (30-120 s), reuniones de emergencia por jugador (1-3).
- Al empezar: 4 s de revelación de rol (nadie se mueve) + 12 s antes del primer asesinato. Botón de emergencia: 15 s de espera tras empezar o tras cada reunión.
- Cada jugador recibe una versión distinta del estado: no ve roles ajenos (salvo impostores entre sí) ni a los fantasmas. Al final se revelan todos.
- Visión: tripulante 3,6 casillas, impostor 5,2. No la tapan las paredes (pendiente si se quiere).
- Fantasmas: atraviesan paredes, ven a todos, chat solo entre ellos (también durante reuniones), no votan.
- Chat: libre en el lobby, en reuniones y al final. Los vivos no chatean durante la partida. Máx. 140 caracteres, 1 mensaje cada 0,7 s.
- Votación: se elige y se confirma (2 toques). Empate o mayoría de "saltar" → nadie sale. Se muestra quién votó a quién y si el expulsado era impostor.
- Victoria: impostores ≥ tripulantes vivos → ganan impostores. Sin impostores → ganan tripulantes. (Victoria por tareas llega en la Fase 3.)
- Fin de partida: pantalla de victoria/derrota 9 s y vuelta automática al lobby.

## Fase 3 (2026-11-11), decisiones
Asumidas como en el juego clásico de 2020 (el usuario pidió no preguntar y revisarlas a su vuelta):
- Tareas: 6 minijuegos propios (cables, descarga, código, tarjeta, interruptores, calibrar) en 15 estaciones de la Estación Orbital. Cada tripulante recibe N tareas al azar (ajuste "Tareas por jugador": 2-6, por defecto 4).
- Los impostores reciben una lista de tareas falsas para disimular; pueden abrir los minijuegos pero no cuentan.
- Barra de progreso común (solo cuenta tareas de tripulantes). Si llega al 100 %, ganan los tripulantes.
- Los fantasmas tripulantes siguen haciendo tareas y cuentan para la barra.
- El servidor valida que estés en la estación y que la tarea se haya abierto al menos 0,7 s antes de darla por hecha.
- Sabotajes (impostor, vivo o fantasma): espera de 30 s entre sabotajes (15 s al empezar la partida), solo uno activo a la vez.
  - Luces: la visión de los tripulantes baja a 1,4 casillas hasta que alguien encienda los interruptores en Eléctrica. Siguen apagadas después de una reunión.
  - Reactor: 40 s de cuenta regresiva. Hacen falta dos jugadores distintos con la mano en los paneles A y B del Reactor al mismo tiempo. Si se acaba el tiempo, ganan los impostores. Una reunión lo cancela.
  - Durante un sabotaje no se puede llamar a reunión de emergencia (reportar cuerpos sí).
  - Alerta roja arriba, borde rojo parpadeante (reactor) y flechas en el borde de la pantalla hacia donde se arregla.
- Ventilaciones (solo impostor vivo): 12 en 4 grupos de 3 conectadas. Dentro eres invisible para todos y no puedes matar, reportar ni moverte; el botón "➜ OTRA" salta a la siguiente del grupo. Una reunión saca a todos de las ventilaciones.
- Botón USAR, por prioridad: arreglar sabotaje > tarea propia cercana > botón de emergencia.

## Fase 4 (2026-11-11), decisiones
- **Mapa 2 = Base Polar** (planeta helado): 60x38, 13 salas, 16 tareas, 12 ventilaciones en 4 grupos, luces en Eléctrica, reactor en Generador. Topología distinta a la estación: sala común al centro, anillo de pasillos alrededor y ramales a las esquinas (Invernadero, Laboratorio, Observatorio, Dormitorios, Cocina, Sala de radio, Garaje de trineos, Almacén, Eléctrica, Enfermería, Frigorífico).
- El host elige el mapa en Ajustes (primera opción): Estación Orbital (por defecto), Base Polar o Aleatorio. El lobby sigue siendo la "Nave de despegue".
- Arte helado: cielo con aurora y nieve con parallax, ventisca encima del mapa, piso con grietas y brillos, paredes con borde nevado (paleta por mapa en `palette`). La decoración ahora es una lista `decor` por mapa (mesas, camas, plantas, bancos, consolas, antenas, telescopio, trineos, cajas, barriles, núcleo del reactor); es solo visual, no bloquea.
- **Sonido** (`public/js/audio.js`): todo sintetizado con WebAudio, sin archivos. 21 efectos (click, tarea lista, asesinato con atenuación por distancia, ventilación, alarma de reporte/emergencia, expulsión, victoria/derrota, rol, sabotaje, alarma del reactor que se acelera en los últimos 10 s, cuenta regresiva de votación, chat, etc.) y ambiente por mapa (zumbido grave en estación, viento en la base polar). Botón 🔊/🔇 arriba a la derecha; se recuerda en el dispositivo. El navegador solo deja sonar tras el primer toque, por eso se desbloquea con el primer gesto.
- Pasos al caminar y música quedaron fuera a propósito (ruido y trabajo extra para poco valor).
- Los sonidos solo se verificaron por código (se generan los 21 sin errores). Nadie los ha escuchado todavía: ajustar volúmenes tras probar en celulares reales.
- Validación automática de mapas (conectividad, spawns para 3-12 jugadores, estaciones alcanzables, ventilaciones fuera de paredes): se corre al editar `shared/game.js` (script de ejemplo en las notas de la sesión; si se agrega un tercer mapa, repetirla).

## Cómo correrlo
- `npm install` una vez, luego `npm start` → http://localhost:3000 (también muestra la IP de la red local).
- `node test/humo.js` → prueba rápida del servidor (con el servidor corriendo).
- `node test/partida.js` → partida completa automática con 4 jugadores (~1 min).
- `node test/fase3.js` → tareas, ventilaciones, luces y reactor (~2 min). `MAP=hielo node test/fase3.js` para la Base Polar.
- `MAP=hielo ROOMS=comun,garaje CHROME=<chrome.exe> node test/capturas-mapa.js <playwright-core>` → capturas por sala + prueba de los 21 sonidos + selector de mapa.
- `node test/capturas.js <ruta playwright-core>` con `CHROME=<chrome.exe>` → capturas en tamaño celular en `.playwright-mcp/`. En esta PC: playwright-core en `%LOCALAPPDATA%/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright-core` y Chrome en `%LOCALAPPDATA%/ms-playwright/chromium-1248/chrome-win64/chrome.exe`.
- `node test/bots.js CODIGO 3 90` → mete 3 bots caminando en la sala CODIGO por 90 s (en reuniones chatean y votan "saltar"). Lanzarlo como proceso en segundo plano normal: con `( … &)` desde la terminal se cerraba el navegador de pruebas.

## Estructura
- `server/index.js`: salas, jugadores, validación de movimiento, envío de posiciones (20/s).
- `shared/game.js`: constantes, colores, mapas (salas y pasillos como rectángulos) y colisiones. Lo usan servidor y cliente.
- `public/`: index.html, style.css, js/audio.js (sonido), js/input.js (joystick/teclado), js/render.js (dibujo), js/tasks.js (minijuegos), js/main.js (red, UI, bucle).
- En `shared/game.js`, cada mapa define `tasks` (estaciones), `fixes` (dónde se arreglan sabotajes), `vents` (ventilaciones por grupo), `decor` (decoración) y opcionalmente `theme`/`palette`. `MAP_CHOICES` lista los mapas jugables.
- `test/`: humo.js, partida.js, fase3.js (pruebas del servidor), bots.js (bots), capturas.js (capturas con Playwright).

## Red de la uni (2026-11-11)
- La red de la uni bloquea los puertos 7844 (túnel de Cloudflare, QUIC y TCP) y 22 (localhost.run). El puerto 443 sí sale. Por eso desde la uni NO sirven los túneles desde la PC del usuario.
- Salidas: (a) hosting en la nube (Fase 5), que solo usa 443; (b) mientras tanto, conectar la PC al hotspot del celular y correr cloudflared (los amigos entran al link por 443 desde la wifi de la uni); (c) misma wifi por IP local, si la uni no aísla los dispositivos.
- Preparado para la Fase 5: `render.yaml` y `DESPLIEGUE.md` (pasos para GitHub + Render). Falta que el usuario cree las cuentas; no se hizo git init ni commit todavía.

## Pendientes / por decidir
- Siguiente: Fase 5. Seguir `DESPLIEGUE.md` (necesita cuentas del usuario en GitHub y Render).
- Para revisar con el usuario: las decisiones de la Fase 3 asumidas del juego clásico (lista arriba).
- Probar en celulares reales: volumen de sonidos, tamaño de botones, rendimiento con 12 jugadores y con la nieve.
- Posibles mejoras: que las paredes tapen la visión; mapa del juego (botón para ver dónde están tus tareas); sabotaje de puertas.
- Probar en celulares reales (por túnel o red local).
