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
5. [x] Deploy en Render (plan gratis) con link fijo
6. [x] Minimapa, diseño y animación (falta probar en celulares y subir)
7. [x] Tareas por etapas, tareas difíciles, íconos propios y teclas (falta subir)
8. [x] Rendimiento y fluidez, verificado (falta subir y probar en celulares reales)

## Estado (2026-11-11)
Fase 1 terminada y probada (prueba automática + navegador en tamaño de celular horizontal): crear sala o unirse por link/código, lobby con colores únicos, hasta 12 jugadores, host con estrella, Empezar → Estación Orbital, Volver al lobby, reconexión, choques con paredes, joystick táctil + WASD. Probado después en celulares reales (ver "Prueba real").
Fase 2 terminada y probada (partida automática + navegador): rol, visión, matar, cuerpo, reportar, reunión con chat, votación, expulsión, fin, vuelta al lobby, reconexión a media partida.
Fase 3 terminada y probada (18 comprobaciones automáticas + capturas en tamaño celular sin errores): tareas con 6 minijuegos, barra y victoria por tareas, luces, reactor, ventilaciones.
Fase 4 terminada y probada (mapas validados, Fase 3 pasa en ambos mapas, capturas sin errores, 21 sonidos generan sin errores): Base Polar, selector de mapa, arte helado, decoración y sonido.
Fase 5 terminada: en línea en https://amogos-ty3a.onrender.com.

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
- Los sonidos se verificaron por código (los 21 se generan sin errores) y luego se jugó con ellos en celulares reales; el usuario no reportó problemas de volumen.
- Validación automática de mapas (conectividad, spawns para 3-12 jugadores, estaciones alcanzables, ventilaciones fuera de paredes): se corre al editar `shared/game.js` (script de ejemplo en las notas de la sesión; si se agrega un tercer mapa, repetirla).

## Estado de Git (al cerrar la sesión)
- Commit publicado: 67ecb3f en https://github.com/hvelau25/Amogos (rama main). Es lo que corre en Render.
- **Pendiente de subir (2026-11-12): las Fases 6, 7 y 8 completas** (minimapa, estilo dibujado a mano, tareas por etapas y difíciles, íconos propios, teclas, rendimiento, fuentes locales). Todo está sin commit: archivos modificados (index.html, style.css, main.js, render.js, tasks.js, shared/game.js, server/index.js, tests, notas) y archivos nuevos (`public/js/icons.js`, `public/fonts/`, `test/rendimiento.js`, `test/fugas.js`). Verificado en local: humo, partida, fase3 (ambos mapas), rendimiento y fugas. El servidor de Render sigue con el commit 67ecb3f.
- Para subir: `git add -A`, commit y `git push`. Un push a main **reinicia el servidor de Render y borra las salas en curso**, así que hacerlo cuando no haya nadie jugando (el usuario avisa). Después de desplegar: abrir el link, revisar que cargue el menú con las fuentes y probar en celulares reales (rendimiento con las partículas, mapa grande y reunión). Git avisa de LF/CRLF al hacer add; es normal en Windows.
- Antes de tocar el código del juego: leer "Fase 2/3/4" más abajo y probar con `node test/partida.js` y `MAP=hielo node test/fase3.js` (con el servidor local corriendo).

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

## Fase 5: en línea (2026-11-11)
- **Link del juego: https://amogos-ty3a.onrender.com** (Render, plan Free, región Oregon). Repo público: https://github.com/hvelau25/Amogos (rama main). Cuenta de Render: "Hector's workspace".
- Verificado contra el link real: `/salud` responde, los archivos servidos son idénticos al commit 67ecb3f, socket.io responde y `test/humo.js` pasa por WebSocket (con `LAG=600 URL=<link> node test/humo.js`, por la latencia a Oregon).
- Render hace deploy automático en cada `git push` a main.
- Plan gratis: se duerme tras 15 min sin tráfico y despierta en ~50 s; las salas viven en memoria y se pierden si se duerme o reinicia. Para evitar el sueño: monitor gratis en uptimerobot.com que visite `/salud` cada 5 min (pendiente, lo hace el usuario).
- **Prueba real (2026-11-11):** el usuario y sus amigos jugaron varias partidas desde celulares contra el link de Render. Reporte del usuario: "jala súper bien". No reportó bugs ni ajustes pendientes.

## Red de la uni (2026-11-11)
- La red de la uni bloquea los puertos 7844 (túnel de Cloudflare, QUIC y TCP) y 22 (localhost.run). El puerto 443 sí sale. Por eso desde la uni NO sirven los túneles desde la PC del usuario.
- Salidas: (a) hosting en la nube (Fase 5), que solo usa 443; (b) mientras tanto, conectar la PC al hotspot del celular y correr cloudflared (los amigos entran al link por 443 desde la wifi de la uni); (c) misma wifi por IP local, si la uni no aísla los dispositivos.
- Preparado para la Fase 5: `render.yaml` y `DESPLIEGUE.md` (pasos para GitHub + Render). Falta que el usuario cree las cuentas; no se hizo git init ni commit todavía.

## Fase 6: minimapa, diseño y animación (2026-11-11)
Pedido del usuario: minimapa, más diseño y más animación. **Regla: los monitos (`drawCrew` en render.js) NO se tocan**, al usuario le gustan como están.
- **Minimapa** arriba a la derecha durante la partida (no en el lobby). Muestra: tu posición (punto con pulso) y el área que ves, tus tareas pendientes (rombos amarillos), el botón de emergencia, los puntos de arreglo si hay sabotaje (rojo parpadeante) y, solo para impostores, las ventilaciones. **No muestra a otros jugadores** (sería trampa). Tocarlo (o tecla M/Tab en PC) abre el mapa grande con nombres de salas y leyenda; el mapa grande deja seguir moviéndote con el joystick (solo el ✕ recibe toques).
- **Mundo:** luz suave por sala, ventanas con estrellas, foquitos y tubos en las paredes de la estación; carámbanos y luces azules en la Base Polar; halo y brillo en tus consolas de tarea; onda en el botón de emergencia; ventilas del grupo iluminadas; viñeta en los bordes; las luces "parpadean" durante el sabotaje de luces.
- **Partículas:** polvito al caminar, destellos al terminar una tarea o arreglar un sabotaje, salpicadura y humo al aparecer un cuerpo (destello rojo de pantalla para el impostor que mató), humo al entrar/salir de ventila.
- **Interfaz:** fuentes Lilita One (títulos) y Nunito (texto) desde Google Fonts (si no cargan, usa la del sistema). Logo con letras que saltan, tarjetas tipo vidrio, botones con brillo, botones de acción con icono y aura cuando se pueden usar (MATAR late en rojo), barra de tareas con brillo que corre, joystick más visible.
- **Pantallas:** tripulantes flotando en la pantalla de inicio; revelación de rol con fondo rojo/azul y rayos girando; aviso grande "¡CUERPO REPORTADO!" / "¡REUNIÓN DE EMERGENCIA!" (1,7 s) antes de la votación; tarjetas de voto entran escalonadas; destello rojo al morir; confeti al ganar; planeta y estelas en la expulsión.
- **Nitidez:** el temblor con filtros SVG se veía pixeleado; se cambió por un temblor con transformaciones (rotar y mover medio píxel), que se mantiene en vectores, y el contorno del texto ahora es un trazo real (`-webkit-text-stroke` + `paint-order`). No volver a usar feDisplacementMap. Todo lo que usa Luckiest Guy va en mayúsculas. Los bordes dibujados (::before) reemplazan al borde real (border-width: 0); si se pone borde real otra vez sale "doble borde" porque los hijos absolutos se miden desde adentro del borde.
- **Cambio de estilo (pedido del usuario, misma sesión):** se quitó el look de vidrio y brillos. Ahora la interfaz es estilo *dibujado a mano*, inspirado en el feel del juego de 2020 pero con dibujos propios: botones de acción sin círculo (el ícono SVG es el botón, con contorno negro grueso; texto blanco con contorno negro abajo; gris cuando no se puede usar u oscurecido durante la cuenta regresiva), bordes chuecos y líneas que "hierven" (filtros SVG `#garabato1-3` alternándose cada ~0,17 s) en paneles, chips, botones, tarjetas de voto y títulos. Fuente de títulos y botones: Luckiest Guy. Íconos propios en `index.html` (`#i-usar`, `#i-matar`, `#i-reportar`, `#i-sabotear`, `#i-ventila`, `#i-otra`). Los estilos están al final de `style.css` (sección "Fase 6b").
- Respeta `prefers-reduced-motion` (si el celular tiene animaciones reducidas, se apagan).
- Probado: `test/humo.js` pasa, capturas en 844x390 de inicio, lobby, revelación, juego, mapa grande y reunión en ambos mapas, sin errores en consola. Falta probarlo en celulares reales (rendimiento con las partículas y el desenfoque de vidrio).
- Sin subir a Render todavía (un push reinicia el servidor y borra salas en curso).

## Fase 7: tareas por etapas, tareas difíciles, íconos propios, teclas (2026-11-11)
- **Tareas por etapas** (como el clásico): en `shared/game.js`, cada mapa tiene `chains`. "Reparar cableado" son 3 etapas en 3 salas distintas, con más cables en cada una (4, 5 y 6). "Descargar y subir datos" son 2 etapas: descargar en una sala y subir en otra. Las estaciones que forman parte de una cadena ya no salen como tareas sueltas. En la lista se ve "(1/3)" y al terminar una etapa aparece un aviso que dice dónde sigue. La barra de progreso cuenta cada etapa.
- Servidor: cada tarea del jugador es `{ id, steps:[estaciones], step, done }`; al cliente le llega también `station` (la estación de la etapa actual). Valida que estés en la estación de la etapa actual y que la hayas abierto en esa misma etapa.
- **Tareas difíciles nuevas** (etiqueta roja DIFÍCIL en la lista): *Repetir secuencia* (Simón de 3x3, rondas de 4, 5 y 6; si fallas vuelves a la ronda 1), *Sintonizar frecuencia* (igualar una onda con 2 deslizadores, margen estrecho, mantener 1,2 s) y *Reiniciar en orden* (tocar del 1 al 10 en 9 s; si fallas se revuelven). Estación: Escudos, Comunicaciones, Bodega. Base Polar: Dormitorios, Garaje, Almacén.
- **Íconos propios** en `public/js/icons.js` (sprite SVG + versión imagen para el canvas). Ya no queda ningún emoji en la interfaz (cerrar, sonido, chat, foco, reactor, alerta, fantasma, jugadores, megáfono, check, borrar, tarjeta, mano, girar celular, estrella del host).
- **Teclas en PC:** E usar, R reportar, Q matar, V ventila, F sabotear, M o Tab mapa, Esc cerrar.
- **Mapa grande nítido:** el canvas se ajusta a su tamaño real por la densidad de pantalla, y las salas se dibujan como figuras (antes era casilla por casilla y se estiraba). Los nombres de sala van abajo para no tapar las consolas.
- Pruebas: `test/fase3.js` actualizado para etapas; pasa en ambos mapas. `test/partida.js` y `test/humo.js` pasan. Capturas a 2x sin errores.
- **Ojo:** al cambiar el código del servidor hay que reiniciar `npm start`; si no, el servidor viejo sigue corriendo.

## Fase 8: rendimiento y fluidez (2026-11-11)
Pedido del usuario: que corra fluido, revisar todo antes de subir. Se midió con CPU 6x más lento (simula celular) y 12 jugadores amontonados en pantalla.
- **Antes:** hilo principal al 84 %, dibujo del mundo 8,2 ms, mapa grande a 55 FPS con 21 cuadros lentos, 59 recálculos de estilo y 20 layouts por segundo.
- **Ahora:** hilo al ~50 %, dibujo 4-5 ms, 60 FPS estables en ambos mapas (peor caso incluido), 0 layouts/s, reunión al 10 %. Servidor: 0,8 % de un núcleo con 12 jugadores. Sin fugas (60 ciclos de tarea+mapa+partículas: +150 KB de heap, +2 nodos, 0 listeners).
- **Qué se cambió:** (1) nombres de sala y luces de sala en caché (antes se redibujaban cada cuadro); (2) no dibujar decoración, consolas, ventilas ni jugadores fuera de pantalla; (3) `shade()` memorizado; (4) minimapa y mapa grande a ~15 cuadros/s con los nombres dentro de la imagen guardada; (5) no reescribir textos que no cambiaron (cuentas de MATAR/SABOTEAR, reloj de reunión) porque forzaba layout 10 veces/s; (6) no dibujar el mundo detrás de la reunión; (7) animaciones CSS que repintan sin parar: rayas de la barra de tareas quietas, y el temblor de bordes **congelado en el HUD, minijuegos, reunión y mapa grande** (se conserva en menú de inicio y lobby; cada una costaba ~10 % del hilo); (8) **fuentes alojadas en el servidor** (`public/fonts/`, Luckiest Guy y Nunito, 56 KB) en vez de Google Fonts, que bloqueaba el primer pintado en redes lentas; caché de 1 año solo para `.woff2` (el resto se revalida, así un deploy se ve al instante); (9) el rebote continuo de los botones activos pasó a un "pop" de una sola vez al activarse (con 6 botones activos costaba ~11 % del hilo y 66 recálculos/s; ahora 5/s). **Ojo al medir:** cualquier animación CSS infinita mantiene ~60 recálculos/s en el Chrome de pruebas, aunque sea de `transform`; en celulares con GPU puede ser más barato, pero no se pudo comprobar. Quedan infinitas solo en momentos críticos (alerta de sabotaje, borde rojo del reactor), en el lobby (botón Empezar) y en el menú (logo).
- Render ya comprime con Brotli; no hace falta `compression`.
- **Si algo nuevo se anima en pantalla durante la partida:** usar solo `transform`/`opacity`, evitar `filter`, `box-shadow` o `background-position` animados y no repetir trabajo por cuadro (cachear lo estático). Para volver a ver el temblor de bordes en la reunión: quitar la regla `#reunion *::before, .mapa-grande *::before` al final de `style.css`.
- Pruebas nuevas, con el servidor corriendo: `node test/rendimiento.js` (con `MAP=hielo` para la Base Polar) y `node test/fugas.js`. Meta: 60 FPS, pocos cuadros >33 ms, 0 layouts/s, crecimiento de memoria ~0.

## Pendientes / por decidir
- El proyecto está completo según el alcance original (5 fases). Lo que sigue depende de lo que el usuario pida tras seguir jugando.
- Opcional: monitor UptimeRobot para que no se duerma.
- Para revisar con el usuario cuando quiera: las decisiones de la Fase 3 asumidas del juego clásico (lista arriba, sección "Fase 3").
- Aún sin confirmar: rendimiento con 12 jugadores a la vez y con la nieve de la Base Polar (en las pruebas reales no se reportó nada).
- Posibles mejoras: que las paredes tapen la visión; sabotaje de puertas. (El mapa del juego ya se hizo en la Fase 6.)
