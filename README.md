# iterumcorp.org

Sitio estático de IterumCorp. HTML + CSS puros, sin build step.

## Estructura

- `index.html` — portada del estudio (hero, proyecto destacado, corporación, teaser de propósito)
- `singularity.html` — página del juego: combate, jefes, mundo, historia y formulario de acceso (Formspree)
- `proposito.html` — manifiesto / propósito (moodboard de Doré)
- `press.html` — presskit de Singularity
- `contacto.html` — formulario de contacto (Formspree) + correos, personas, canales y puesto abierto
- `site.js` — JS compartido: menú móvil, scroll reveal, subnav activo
- `style.css` — única hoja de estilos; tokens en `:root`
- `assets/img/` — imágenes reales extraídas del pitch deck (key art, gameplay, sprites, concept, emblema, OG) y `dore-*.jpg`: grabados de Gustave Doré (dominio público, Wikimedia Commons) invertidos y virados a cian para la sección Propósito
- `assets/fonts/` — Space Grotesk + IBM Plex Mono autoalojadas (`fonts.css`)
- `assets/press/` — zips descargables del presskit
- `CNAME`, `.nojekyll`, `robots.txt` — GitHub Pages

## Despliegue (GitHub Pages)

1. Repo → Settings → Pages → Source: `main` / root.
2. DNS de `iterumcorp.org`: registros `A` a las IPs de GitHub Pages (185.199.108-111.153) y `CNAME www` → `<usuario>.github.io`.
3. Marcar "Enforce HTTPS" cuando el certificado esté listo.

## Pendientes

- Formspree: sustituir `YOUR_FORM_ID` en `singularity.html` (acceso) y `contacto.html` (contacto); pueden ser dos formularios distintos.
- Subir capturas 1920×1080 finales y sustituir las de baja resolución en `assets/img/`.
- Subir zips a `assets/press/` con los nombres ya enlazados en `press.html`.
- Rellenar enlaces `#` de redes, Steam, itch.
