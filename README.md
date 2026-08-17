# iterumcorp.org

Sitio estático de IterumCorp. HTML + CSS puros. Español como fuente; inglés generado en `en/` (ver *Idiomas*).

## Idiomas (ES → EN)

Las páginas en español de la raíz son la única fuente. Las inglesas (`en/*.html`) y `sitemap.xml` las genera `scripts/i18n.js` (Node ≥ 18, sin dependencias) a partir del diccionario `i18n/en.json`. **No editar `en/` a mano.**

```
npm run i18n:extract   # busca textos nuevos en las páginas ES y los añade a i18n/en.json con valor ""
npm run build          # genera en/*.html + sitemap.xml (lo no traducido queda en español y se avisa)
npm run i18n:check     # falla si hay textos sin traducir o en/ está desactualizado (CI)
```

Flujo al tocar contenido: editas el HTML en español → `npm run i18n:extract` → rellenas los `""` nuevos en `i18n/en.json` (la clave es el texto español, con su marcado inline) → `npm run build` → commit de todo. La Action `.github/workflows/i18n.yml` hace extract + build en cada push a `main` y commitea `en/`, `sitemap.xml` e `i18n/` si cambian; si quedan textos sin traducir, el job falla con la lista.

Cómo detecta textos: cualquier elemento con texto directo es una unidad (su `innerHTML` completo, así el marcado `<span class="blood">` viaja con la traducción); además `alt`, `title`, `aria-label`, `placeholder`, `data-label`, `<meta>` de description/og/twitter y `value` de inputs ocultos/submit. `<script>`, `<style>` y `translate="no"` se ignoran. Las claves que dejan de usarse pasan a `i18n/obsolete.en.json`.

En el navegador: selector `EN`/`ES` en la cabecera (guarda la preferencia en `localStorage`), y un script inline en `<head>` redirige a `/en/` la primera visita si el navegador está en inglés. Cada página lleva `hreflang` es/en/x-default, `og:locale` y canonical propios.

## Estructura

- `index.html` — portada del estudio (hero, proyecto destacado, corporación, teaser de propósito)
- `singularity.html` — página del juego: combate, jefes, mundo, historia y formulario de acceso (Formspree)
- `proposito.html` — manifiesto / propósito (moodboard de Doré)
- `press.html` — presskit de Singularity
- `contacto.html` — formulario de contacto (Formspree) + correos, personas, canales y puesto abierto
- `site.js` — JS compartido: menú móvil, scroll reveal, subnav activo
- `style.css` — única hoja de estilos; tokens en `:root`
- `assets/img/` — imágenes reales extraídas del pitch deck (key art, gameplay, sprites, concept, emblema, OG) y `dore-*.webp`: grabados de Gustave Doré (dominio público, Wikimedia Commons) invertidos y virados a cian para la sección Propósito, reescalados a 800 px y en WebP (~2 MB en total)
- `assets/fonts/` — Space Grotesk + IBM Plex Mono autoalojadas (`fonts.css`)
- `assets/press/` — zips descargables del presskit
- `legal.html` — aviso legal, privacidad y cookies (enlazado desde el pie y las casillas de consentimiento)
- `en/` — páginas en inglés **generadas** · `i18n/en.json` — diccionario ES→EN · `scripts/i18n.js` — extract/build/check · `sitemap.xml` — generado, con alternates hreflang
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
