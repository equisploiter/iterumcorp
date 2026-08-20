# iterumcorp.org

Sitio estático de IterumCorp. HTML + CSS puros. Inglés como fuente (y idioma por defecto); español generado en `es/` (ver *Idiomas*).

## Idiomas (EN → ES)

Las páginas en inglés de la raíz son la única fuente. Las españolas (`es/*.html`) y `sitemap.xml` las genera `scripts/i18n.js` (Node ≥ 18, sin dependencias) a partir del diccionario `i18n/es.json`. **No editar `es/` a mano.**

```
npm run i18n:extract   # busca textos nuevos en las páginas EN y los añade a i18n/es.json con valor ""
npm run build          # genera es/*.html + sitemap.xml (lo no traducido queda en inglés y se avisa)
npm run i18n:check     # falla si hay textos sin traducir o es/ está desactualizado (CI)
```

Flujo al tocar contenido: editas el HTML en inglés → `npm run i18n:extract` → rellenas los `""` nuevos en `i18n/es.json` (la clave es el texto inglés, con su marcado inline) → `npm run build` → commit de todo. La Action `.github/workflows/i18n.yml` hace extract + build en cada push a `main` y commitea `es/`, `sitemap.xml` e `i18n/` si cambian; si quedan textos sin traducir, el job falla con la lista.

Cómo detecta textos: cualquier elemento con texto directo es una unidad (su `innerHTML` completo, así el marcado `<span class="blood">` viaja con la traducción); además `alt`, `title`, `aria-label`, `placeholder`, `data-label`, `<meta>` de description/og/twitter y `value` de inputs ocultos/submit. `<script>`, `<style>` y `translate="no"` se ignoran. Las claves que dejan de usarse pasan a `i18n/obsolete.es.json`.

Nombres de archivo: también se traducen. `CONFIG.slugs` en `scripts/i18n.js` mapea `purpose.html` → `proposito.html` y `contact.html` → `contacto.html`; el generador reescribe los enlaces entre páginas, el canonical, el `og:url` y el sitemap en consecuencia. Para renombrar otra página, añade la pareja ahí y al mapa `m` del script inline de redirección.

En el navegador: selector `ES`/`EN` en la cabecera (guarda la preferencia en `localStorage`), y un script inline en `<head>` redirige a `/es/` la primera visita si el navegador está en español. Cada página lleva `hreflang` es/en/x-default (x-default → inglés), `og:locale` y canonical propios.

URLs antiguas: `en/*.html` y los `proposito.html` / `contacto.html` de la raíz quedan como stubs de redirección (meta refresh + canonical) para no romper enlaces ya publicados. No son fuentes: no los toca el generador.

## Estructura

- `index.html` — portada del estudio (hero, proyecto destacado, corporación, teaser de propósito)
- `singular.html` — página del juego: combate, jefes, mundo, historia y formulario de acceso (Formspree)
- `purpose.html` — manifiesto / propósito (moodboard de Doré)
- `press.html` — presskit de Singular
- `contact.html` — formulario de contacto (Formspree) + correos, personas, canales y puesto abierto
- `site.js` — JS compartido: menú móvil, scroll reveal, subnav activo, atribución de campañas (ver *Atribución*)
- `style.css` — única hoja de estilos; tokens en `:root`
- `assets/img/` — imágenes reales extraídas del pitch deck (key art, gameplay, sprites, concept, emblema, OG) y `dore-*.webp`: grabados de Gustave Doré (dominio público, Wikimedia Commons) invertidos y virados a cian para la sección Propósito, reescalados a 800 px y en WebP (~2 MB en total)
- `assets/fonts/` — Space Grotesk + IBM Plex Mono autoalojadas (`fonts.css`)
- `assets/press/` — zips descargables del presskit
- `legal.html` — aviso legal, privacidad y cookies (enlazado desde el pie y las casillas de consentimiento)
- `es/` — páginas en español **generadas** · `i18n/es.json` — diccionario EN→ES · `scripts/i18n.js` — extract/build/check · `sitemap.xml` — generado, con alternates hreflang
- `CNAME`, `.nojekyll`, `robots.txt` — GitHub Pages

## Despliegue (GitHub Pages)

1. Repo → Settings → Pages → Source: `main` / root.
2. DNS de `iterumcorp.org`: registros `A` a las IPs de GitHub Pages (185.199.108-111.153) y `CNAME www` → `<usuario>.github.io`.
3. Marcar "Enforce HTTPS" cuando el certificado esté listo.

## Atribución de campañas (UTM)

Los dos formularios llevan `data-attribution` y cinco campos ocultos vacíos (`origen`, `referente`, `entrada`, `pagina`, `idioma`). El bloque de atribución de `site.js` los rellena en el `submit`, así que la procedencia llega dentro del propio correo de Formspree — sin analítica, sin cookies y sin terceros.

Cómo funciona: al cargar cualquier página se leen de la URL `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `ref`, `gclid`, `fbclid`, `msclkid` y `ttclid`, y se guardan en `sessionStorage` bajo `iterum.attr` junto al referente externo y la página de entrada. Manda el **primer toque**: sólo se sobreescribe si un hit posterior trae etiquetas nuevas, de modo que quien aterriza en `/?utm_source=x` y luego escribe desde `contacto.html` sigue trayendo el origen. Se borra al cerrar la pestaña.

Enlaces a repartir — una URL por destinatario, y el nombre del canal viaja hasta la bandeja:

```
https://iterumcorp.org/singular.html?utm_source=devolver&utm_medium=email&utm_campaign=pitch_q3
https://iterumcorp.org/press.html?utm_source=gamespress&utm_medium=wire&utm_campaign=anuncio
https://iterumcorp.org/?ref=kepler                # forma corta, para enlaces que se leen en voz alta
```

Para añadir campos: un `<input type="hidden" name="…" value="">` en el formulario y un `set(…, …)` en el bloque de atribución. El `value` debe quedar vacío o el extractor de i18n lo tratará como texto traducible.

Lo que esto **no** cubre: si el destinatario mira la web y no envía nada, no queda registro. Para eso hace falta analítica agregada (Plausible, Umami o Cloudflare Web Analytics, todas sin cookies) o el sitemap de un acortador propio.

## Pendientes

- **Formspree: sustituir `YOUR_FORM_ID` en `singular.html` (acceso) y `contact.html` (contacto)**; pueden ser dos formularios distintos. Hasta entonces los formularios no envían a ninguna parte: es lo único que impide que el sitio sea funcional de extremo a extremo. Editar sólo las páginas de la raíz y correr `npm run build` (`es/` es generado).
- Subir capturas 1920×1080 finales y sustituir las de baja resolución en `assets/img/`.
- Subir zips a `assets/press/` con los nombres ya enlazados en `press.html`.
- Rellenar enlaces `#` de redes, Steam, itch.
