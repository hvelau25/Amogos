# Subir Amogos a internet (Render, gratis)

El juego queda en un link fijo (`https://amogos-xxxx.onrender.com`) que abre cualquiera, incluso desde la wifi de la uni (solo usa el puerto 443). Tu PC ya no hace falta.

## Pasos (unos 10 minutos)
1. **Repo en GitHub:** entra a https://github.com/new, nombre `amogos`, **Public**, sin README ni nada más → Create repository. (Público porque así Render lo lee sin permisos extra; el código no tiene secretos. Si lo quieres privado, hay que autorizar a Render en GitHub.)
2. **Subir el código** (el commit ya está hecho). En la carpeta del proyecto:
   ```
   git remote add origin https://github.com/TU_USUARIO/amogos.git
   git push -u origin main
   ```
   La primera vez se abre una ventana para iniciar sesión en GitHub.
3. **Render:** entra a https://dashboard.render.com, crea cuenta (botón "GitHub" es lo más rápido).
4. **New +** → **Blueprint** → pega la URL del repo (`https://github.com/TU_USUARIO/amogos`) → **Connect** → **Apply**. Lee `render.yaml` y crea el servicio.
5. Espera 2-3 minutos hasta que diga **Live**. Arriba sale tu link `https://amogos-xxxx.onrender.com`. Ese es el que se pasa a los cuates.

## Para actualizar el juego después
`git add . && git commit -m "cambio" && git push`. Render lo publica solo.

## Cosas del plan gratis
- Si nadie entra durante 15 minutos, el servidor se duerme y la siguiente persona espera ~1 minuto a que despierte. Con una partida en curso no se duerme.
- Si se duerme o se reinicia, las salas se pierden (viven en memoria). Se crea una nueva y listo.
- Para que no se duerma: en https://uptimerobot.com crea un monitor HTTP gratis que visite `https://TU-LINK/salud` cada 5 minutos.
