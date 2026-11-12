# Subir Amogos a internet (Render, gratis)

Así el juego queda en un link fijo (`https://amogos-xxxx.onrender.com`) que abre cualquiera, incluso desde la wifi de la uni (solo usa el puerto 443, el de cualquier página web). Tu PC ya no hace falta.

## Una sola vez
1. Crea una cuenta en https://github.com (gratis).
2. Crea un repositorio nuevo llamado `amogos`, **privado**, vacío (sin README).
3. En la carpeta del proyecto, en una terminal:
   ```
   git init
   git add .
   git commit -m "Amogos"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/amogos.git
   git push -u origin main
   ```
   (`node_modules` no se sube, está en `.gitignore`.)
4. Crea una cuenta en https://render.com con el botón "Sign in with GitHub".
5. En Render: **New +** → **Blueprint** → elige el repo `amogos` → **Apply**. Lee `render.yaml` y crea el servicio solo.
6. Espera 2-3 minutos. Cuando diga **Live**, arriba aparece tu link `https://amogos-xxxx.onrender.com`. Ese es el link para tus cuates.

## Para actualizar el juego después
`git add . && git commit -m "cambio" && git push`. Render lo vuelve a publicar solo.

## Cosas del plan gratis
- Si nadie entra durante 15 minutos, el servidor se duerme. La siguiente persona espera ~1 minuto a que despierte. Mientras hay una partida en curso no se duerme.
- Si se duerme o se reinicia, las salas se pierden (viven en memoria). Se crea una nueva y listo.
- Para que no se duerma: en https://uptimerobot.com crea un monitor HTTP gratis que visite `https://TU-LINK/salud` cada 5 minutos.
