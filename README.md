# iterumcorp.org

Sitio estático de IterumCorp. HTML + CSS puros, sin build step.

## Estructura

- `index.html` — landing del estudio + captura de emails (Formspree)
- `press.html` — presskit de Singularity
- `style.css` — única hoja de estilos; tokens en `:root`
- `assets/img/` — imágenes (vacío; los placeholders son CSS)
- `assets/press/` — zips descargables del presskit
- `CNAME`, `.nojekyll`, `robots.txt` — GitHub Pages

## Despliegue (GitHub Pages)

1. Repo → Settings → Pages → Source: `main` / root.
2. DNS de `iterumcorp.org`: registros `A` a las IPs de GitHub Pages (185.199.108-111.153) y `CNAME www` → `<usuario>.github.io`.
3. Marcar "Enforce HTTPS" cuando el certificado esté listo.

## Pendientes

- Formspree: sustituir `YOUR_FORM_ID` en `index.html`.
- Sustituir bloques `.ph` por `<img>` reales (respetar dimensiones del `data-dim`).
- Subir zips a `assets/press/` con los nombres ya enlazados en `press.html`.
- OG image en `assets/img/og-1200x630.png`.
- Rellenar enlaces `#` de redes, Steam, itch.
